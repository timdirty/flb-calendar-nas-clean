const fs = require('fs');
const path = require('path');
const axios = require('axios');
const CourseTitleParser = require('./public/js/modules/course-title-parser');
const StudentCourseMatcher = require('./public/js/modules/student-course-matcher');
const CourseStudentMatcher = require('./public/js/modules/course-student-matcher');
const TeacherRegistry = require('./teacher-registry');

class ReminderScheduler {
  constructor() {
    this.remindersDataPath = path.join(__dirname, 'data', 'reminders.json');
    this.teacherDataPath = path.join(__dirname, 'teacher_data.json');
    this.isRunning = false;
    this.scheduleInterval = null;
    this.startTime = null;
    this.lastRunTime = null;
    this.adminUserId = null; // 管理員的 LINE User ID
    this.studentReminderSettings = null; // 學生提醒設定，從設定檔載入
    this.systemSettings = null; // 系統設定，從設定檔載入
    
    // 防重複觸發的時間記錄
    this.lastMidnightCleanup = null;
    this.lastTodayReminder = null;
    this.lastTomorrowReminder = null;
    this.lastStudentReminder = null;
    
    // 排程任務執行鎖，防止重疊執行
    this.isExecuting = false;
    
    // 🔥 地點對應表快取
    this.locationMapping = null;
    this.locationMappingPath = path.join(__dirname, 'location-mapping.json');
  }

  // 啟動排程器
  async start() {
    if (this.isRunning) {
      console.log('⚠️ 排程器已在運行中，更新啟動時間');
      this.startTime = Date.now();
      return;
    }

    console.log('🕐 啟動提醒排程器...');
    
    // 載入系統設定
    this.loadSystemSettings();
    
    // 載入學生提醒設定
    await this.loadStudentReminderSettings();
    
    this.isRunning = true;
    this.startTime = Date.now();
    
    // 立即執行一次
    this.runScheduledTasks();
    
    // 從設定檔讀取檢查間隔
    const checkInterval = this.systemSettings?.scheduler?.checkInterval || 5;
    this.scheduleInterval = setInterval(async () => {
      // 防止重疊執行
      if (this.isExecuting) {
        console.log('⏳ 上一次排程任務還在執行中，跳過此次執行');
        return;
      }
      
      this.isExecuting = true;
      try {
        await this.runScheduledTasks();
      } finally {
        this.isExecuting = false;
      }
    }, checkInterval * 60 * 1000);
    
    console.log(`✅ 提醒排程器已啟動，每${checkInterval}分鐘檢查一次`);
  }

  // 停止排程器
  stop() {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }
    this.isRunning = false;
    console.log('🛑 提醒排程器已停止');
  }

  // 🔥 載入地點對應表
  loadLocationMapping() {
    try {
      // 使用快取
      if (this.locationMapping) {
        return this.locationMapping;
      }
      
      if (!fs.existsSync(this.locationMappingPath)) {
        console.log('⚠️ 地點對應表不存在，使用空對應表');
        return { mappings: {}, '預設地址': '樂程坊' };
      }
      
      const data = fs.readFileSync(this.locationMappingPath, 'utf8');
      this.locationMapping = JSON.parse(data);
      console.log(`✅ 載入地點對應表，共 ${Object.keys(this.locationMapping.mappings || {}).length} 個地點`);
      
      return this.locationMapping;
    } catch (error) {
      console.error('❌ 載入地點對應表失敗:', error);
      return { mappings: {}, '預設地址': '樂程坊' };
    }
  }
  
  // 🔥 解析具體地址（優先順序：學生個別 > 臨時學生 > 地點對應表 > 課程地點 > 預設）
  resolveDetailedAddress(student, event) {
    // 1. 學生個別地址
    if (student.detailedAddress && student.detailedAddress.trim() !== '') {
      console.log(`📍 [地址解析] 使用學生個別地址: ${student.name}`);
      return student.detailedAddress;
    }
    
    // 2. 臨時學生地址（補課/體驗）
    if (student.isTemporary && student.detailedAddress && student.detailedAddress.trim() !== '') {
      console.log(`📍 [地址解析] 使用臨時學生地址: ${student.name}`);
      return student.detailedAddress;
    }
    
    // 3. 地點對應表
    const eventLocation = event.location || '';
    const locationMapping = this.loadLocationMapping();
    
    if (eventLocation && locationMapping.mappings[eventLocation]) {
      console.log(`📍 [地址解析] 使用地點對應表: ${eventLocation} -> ${locationMapping.mappings[eventLocation]}`);
      return locationMapping.mappings[eventLocation];
    }
    
    // 4. 課程地點（已映射）
    if (eventLocation && eventLocation.trim() !== '') {
      const mappedLocation = this.mapAddress(eventLocation);
      console.log(`📍 [地址解析] 使用課程地點映射: ${eventLocation} -> ${mappedLocation}`);
      return mappedLocation;
    }
    
    // 5. 預設地址
    const defaultAddress = locationMapping['預設地址'] || '樂程坊';
    console.log(`📍 [地址解析] 使用預設地址: ${defaultAddress}`);
    return defaultAddress;
  }
  
  // 取得「正式 + 臨時」學生清單（用於即時 baseline 計算）
  getCombinedStudents() {
    try {
      const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
      const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
      let students = Array.isArray(studentData.students) ? studentData.students.slice() : [];

      const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
      if (fs.existsSync(tempDataPath)) {
        try {
          const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
          const now = new Date();
          const validTemps = Array.isArray(tempData.students)
            ? tempData.students.filter(s => {
                if (!s) return false;
                if (!s.expiryDate) return true;
                const expiry = new Date(`${s.expiryDate}T23:59:59`);
                return expiry >= now;
              })
            : [];

          // 合併 userId：補課學生若無 userId，從正式學生取用
          const mapByName = new Map();
          students.forEach(st => { if (st?.name) mapByName.set(st.name, st); });
          const mergedTemps = validTemps.map(t => {
            const copy = { ...t, isTemporary: true, temporaryType: t.type };
            if (copy.type === 'makeup' && !copy.userId) {
              const regular = mapByName.get(copy.name);
              if (regular?.userId) copy.userId = regular.userId;
            }
            return copy;
          });

          students = [...students, ...mergedTemps];
        } catch (e) {
          console.error('⚠️ 載入臨時學生失敗（忽略臨時學生）:', e.message);
        }
      }
      return students;
    } catch (e) {
      console.error('❌ 讀取學生清單失敗:', e);
      return [];
    }
  }

  /**
   * 依指定日期即時建立學生提醒 baseline（不落盤、不變更 reminders.json）
   * @param {string} dateStr YYYY-MM-DD（台灣時區）
   * @returns {Promise<Array>} studentReminders-like 陣列
   */
  async generateStudentBaselineForDate(dateStr) {
    try {
      if (!dateStr || !/\d{4}-\d{2}-\d{2}/.test(dateStr)) return [];

      // 取得學生與事件
      const students = this.getCombinedStudents();
      const events = await this.getCalendarEvents();

      const sameDayEvents = events.filter(e => (e?.start || '').startsWith(dateStr));
      if (sameDayEvents.length === 0) return [];

      const results = [];
      for (const event of sameDayEvents) {
        const parsed = this.parseCourseTitle(event.title || '');
        const matched = this.findMatchingStudents(students, parsed, event, dateStr);
        for (const student of matched) {
          if (!student?.userId) continue; // 沒有 LINE userId 無法通知
          const reminder = await this.createStudentReminder(student, event, parsed, dateStr);
          // 標記此 baseline 為即時產生，避免外部誤用
          reminder.__ephemeral = true;
          results.push(reminder);
        }
      }
      return results;
    } catch (error) {
      console.error('❌ 產生即時學生 baseline 失敗:', error);
      return [];
    }
  }

  // 讀取提醒資料
  loadReminders() {
    // ✅ 優化：使用緩存（避免重複讀取檔案）
    if (this.cachedReminders) {
      return this.cachedReminders;
    }
    
    try {
      if (fs.existsSync(this.remindersDataPath)) {
        const data = fs.readFileSync(this.remindersDataPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('讀取提醒資料失敗:', error);
    }
    return { reminders: [], studentReminders: [] };
  }

  // 讀取講師資料
  loadTeachers() {
    if (this.cachedTeachers) {
      return this.cachedTeachers;
    }

    try {
      const teacherData = TeacherRegistry.getTeacherData();
      this.cachedTeachers = teacherData;
      return teacherData;
    } catch (error) {
      console.error('讀取講師資料失敗:', error);
      return { teachers: {} };
    }
  }

  // 獲取台灣時間（統一工具函數）
  getTaiwanTime() {
    // 獲取當前 UTC 時間
    const now = new Date();
    
    // 台灣時區是 UTC+8，所以加上 8 小時
    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    
    return taiwanTime;
  }

  // 獲取台灣時間的日期字串（YYYY-MM-DD）
  getTaiwanDateString() {
    return this.getTaiwanTime().toISOString().split('T')[0];
  }

  getTomorrowDateString() {
    const tomorrow = new Date(this.getTaiwanTime());
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  // 載入系統設定
  loadSystemSettings() {
    try {
      const settingsPath = path.join(__dirname, 'system-settings.json');
      if (fs.existsSync(settingsPath)) {
        const settingsData = fs.readFileSync(settingsPath, 'utf8');
        this.systemSettings = JSON.parse(settingsData);
        console.log('✅ 載入系統設定:', this.systemSettings);
      } else {
        // 如果檔案不存在，使用預設值
        this.systemSettings = {
          scheduler: { checkInterval: 5, timeout: 60000, retryDelay: 1000 },
          timezone: { offset: 8, name: "Asia/Taipei" },
          reminders: { 
            todayReminderHour: 8, 
            todayReminderMinute: 0, 
            beforeClassMinutes: 30, 
            tomorrowReminderHour: 19, 
            tomorrowReminderMinute: 30, 
            sendDelay: 1000 
          },
          studentReminders: { defaultHour: 19, defaultMinute: 30, defaultDuration: 5, defaultEnabled: true },
          matching: { durationTolerance: 30, timeTolerance: 30 },
          api: { baseUrl: "https://calendar.funlearnbar.synology.me", timeout: 60000 }
        };
        console.log('⚠️ 使用預設系統設定:', this.systemSettings);
      }
    } catch (error) {
      console.error('❌ 載入系統設定失敗:', error);
      // 如果載入失敗，使用預設值
      this.systemSettings = {
        scheduler: { checkInterval: 5, timeout: 60000, retryDelay: 1000 },
        timezone: { offset: 8, name: "Asia/Taipei" },
        reminders: { 
          todayReminderHour: 8, 
          todayReminderMinute: 0, 
          beforeClassMinutes: 30, 
          tomorrowReminderHour: 19, 
          tomorrowReminderMinute: 30, 
          sendDelay: 1000 
        },
        studentReminders: { defaultHour: 19, defaultMinute: 30, defaultDuration: 5, defaultEnabled: true },
        matching: { durationTolerance: 30, timeTolerance: 30 },
        api: { baseUrl: "https://calendar.funlearnbar.synology.me", timeout: 60000 }
      };
      console.log('⚠️ 使用預設系統設定:', this.systemSettings);
    }
  }

  // 載入學生提醒設定
  async loadStudentReminderSettings() {
    try {
      // 先嘗試從檔案讀取
      const settingsPath = path.join(__dirname, 'student-reminder-settings.json');
      if (fs.existsSync(settingsPath)) {
        const settingsData = fs.readFileSync(settingsPath, 'utf8');
        const settings = JSON.parse(settingsData);
        this.studentReminderSettings = settings;
        console.log('✅ 從檔案載入學生提醒設定:', this.studentReminderSettings);
        return;
      }
      
      // 如果檔案不存在，嘗試從API讀取
      const response = await fetch(`${this.systemSettings?.api?.baseUrl}/api/student-reminder-settings`);
      const data = await response.json();
      
      if (data.success && data.data) {
        this.studentReminderSettings = data.data;
        // 儲存到檔案
        this.saveStudentReminderSettings();
        console.log('✅ 從API載入學生提醒設定:', this.studentReminderSettings);
      } else {
        // 如果載入失敗，使用預設值
        this.studentReminderSettings = {
          hour: this.systemSettings?.studentReminders?.defaultHour || 19,
          minute: this.systemSettings?.studentReminders?.defaultMinute || 30,
          duration: this.systemSettings?.studentReminders?.defaultDuration || 5,
          enabled: this.systemSettings?.studentReminders?.defaultEnabled || true
        };
        this.saveStudentReminderSettings();
        console.log('⚠️ 使用預設學生提醒設定:', this.studentReminderSettings);
      }
    } catch (error) {
      console.error('❌ 載入學生提醒設定失敗:', error);
      // 如果載入失敗，使用預設值
      this.studentReminderSettings = {
        hour: this.systemSettings?.studentReminders?.defaultHour || 19,
        minute: this.systemSettings?.studentReminders?.defaultMinute || 30,
        duration: this.systemSettings?.studentReminders?.defaultDuration || 5,
        enabled: this.systemSettings?.studentReminders?.defaultEnabled || true
      };
      this.saveStudentReminderSettings();
      console.log('⚠️ 使用預設學生提醒設定:', this.studentReminderSettings);
    }
  }

  // 儲存學生提醒設定到檔案
  saveStudentReminderSettings() {
    try {
      const settingsPath = path.join(__dirname, 'student-reminder-settings.json');
      fs.writeFileSync(settingsPath, JSON.stringify(this.studentReminderSettings, null, 2));
      console.log('💾 學生提醒設定已儲存到檔案');
    } catch (error) {
      console.error('❌ 儲存學生提醒設定失敗:', error);
    }
  }

  // 獲取系統設定
  getSystemSettings() {
    return this.systemSettings;
  }

  // 更新系統設定
  updateSystemSettings(updates) {
    try {
      // 合併更新
      this.systemSettings = {
        ...this.systemSettings,
        ...updates
      };
      
      // 儲存到檔案
      const settingsPath = path.join(__dirname, 'system-settings.json');
      const settingsData = JSON.stringify(this.systemSettings, null, 2);
      fs.writeFileSync(settingsPath, settingsData);
      
      console.log('💾 系統設定已更新:', updates);
      console.log('💾 系統設定已儲存到檔案');
    } catch (error) {
      console.error('❌ 更新系統設定失敗:', error);
      throw error;
    }
  }

  // 儲存提醒資料
  saveReminders(remindersData) {
    try {
      fs.writeFileSync(this.remindersDataPath, JSON.stringify(remindersData, null, 2));
      return true;
    } catch (error) {
      console.error('儲存提醒資料失敗:', error);
      return false;
    }
  }

  // 清理過期提醒
  cleanupExpiredReminders() {
    try {
      console.log('🧹 清理過期提醒...');
      const remindersData = this.loadReminders();
      const reminders = remindersData.reminders || [];
      const studentReminders = remindersData.studentReminders || [];
      
      // 使用台灣時區 (UTC+8)
      const taiwanTime = this.getTaiwanTime();
      const today = this.getTaiwanDateString();
      
      // 清理重複提醒
      const uniqueReminders = this.removeDuplicateReminders(reminders);
      console.log(`🔄 清理重複提醒: ${reminders.length} -> ${uniqueReminders.length}`);
      
      // ✅ 清理沒有 UID 的舊提醒（遺留數據，無法精確匹配）
      const remindersWithUID = uniqueReminders.filter(r => {
        if (!r.uid && (r.status === 'pending' || r.status === 'failed' || r.status === 'pending-retry')) {
          console.log(`🗑️ 清理無 UID 的舊提醒（遺留數據）: ${r.courseName} - ${r.teacherName} (${r.type})`);
          return false;  // 過濾掉
        }
        return true;  // 保留
      });
      console.log(`🔄 清理無 UID 提醒: ${uniqueReminders.length} -> ${remindersWithUID.length}`);
      
      // 清理一般提醒：保留今天和未來的提醒，並重置今天的提醒狀態
      const activeReminders = [];
      
      for (const reminder of remindersWithUID) {
        if (reminder.courseDate >= today) {
          // 如果是今天的提醒，檢查是否需要重置狀態
          if (reminder.courseDate === today) {
            // 檢查是否為課前提醒（scheduledTime 在未來）
            const scheduledTime = reminder.scheduledTime ? new Date(reminder.scheduledTime) : null;
            const now = new Date();
            
            // 檢查 scheduledTime 是否有效
            if (scheduledTime && isNaN(scheduledTime.getTime())) {
              console.log(`⚠️ 無效的 scheduledTime: ${reminder.scheduledTime} for ${reminder.courseName}`);
              activeReminders.push(reminder); // 保留提醒但跳過時間檢查
              continue;
            }
            
            // 計算課程時間（✅ 正確的時區轉換）
            let courseTime;
            try {
              // 解析為台灣時間（UTC+8）
              const [year, month, day] = reminder.courseDate.split('-').map(Number);
              const [hour, minute] = reminder.courseTime.split(':').map(Number);
              
              // ✅ 使用正確的台灣時區轉換
              const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
              courseTime = new Date(taiwanTimeStr);
              
              // 檢查 courseTime 是否有效
              if (isNaN(courseTime.getTime())) {
                console.log(`⚠️ 無效的 courseTime for ${reminder.courseName}`);
                activeReminders.push(reminder); // 保留提醒但跳過時間檢查
                continue;
              }
            } catch (error) {
              console.log(`⚠️ 課程時間解析錯誤: ${reminder.courseName} - ${error.message}`);
              activeReminders.push(reminder); // 保留提醒但跳過時間檢查
              continue;
            }
            
            const beforeClassMinutes = this.systemSettings?.reminders?.beforeClassMinutes || 30;
            
            const expectedBeforeClassTime = new Date(courseTime.getTime() - (beforeClassMinutes * 60 * 1000));
            
            // 根據提醒類型決定是否重置
            if (reminder.type === 'today') {
              // 當日提醒：只有未發送過的提醒才重置
              if (reminder.status === 'sent' && reminder.sentAt) {
                // 已發送過的提醒，保持狀態不變
                console.log(`✅ 當日提醒已發送，保持狀態: ${reminder.courseName} - ${reminder.teacherName} (發送時間: ${reminder.sentAt})`);
                activeReminders.push(reminder);
              } else if (scheduledTime && scheduledTime > now) {
                // 未發送且提醒時間還沒到，重置為 pending
                reminder.status = 'pending';
                console.log(`🔄 重置當日提醒狀態: ${reminder.courseName} - ${reminder.teacherName} (提醒時間: ${scheduledTime.toISOString()})`);
                activeReminders.push(reminder);
              } else {
                // ⭐ 關鍵修復：提醒時間已過，檢查課程是否已結束
                const minutesSinceCourse = (now - courseTime) / (1000 * 60);
                if (minutesSinceCourse > 30) {
                  // 課程已結束30分鐘以上，標記為expired並移除
                  console.log(`🗑️ 移除過期當日提醒: ${reminder.courseName} - ${reminder.teacherName} (課程已結束 ${Math.floor(minutesSinceCourse)} 分鐘)`);
                  // 不加入 activeReminders，即移除
                } else if (reminder.status === 'pending') {
                  // 課程還沒結束或剛結束，保持pending狀態
                  const timeStr = scheduledTime && !isNaN(scheduledTime.getTime()) ? scheduledTime.toISOString() : 'N/A';
                  console.log(`⏰ 當日提醒時間已過但課程未結束，保持狀態: ${reminder.courseName} - ${reminder.teacherName} (時間: ${timeStr})`);
                  activeReminders.push(reminder);
                } else {
                  // 其他狀態保留
                  activeReminders.push(reminder);
                }
              }
            } else if (reminder.type === 'before-class') {
              // 課前提醒：如果課程已經結束，檢查是否需要保留記錄；如果課程還沒開始，重置為 pending
              if (courseTime <= now) {
                // 課程已結束
                // ⭐ 關鍵修復：如果已發送過，保留記錄（防止重啟後重複發送）
                if (reminder.status === 'sent' && reminder.sentAt) {
                  // 已發送過的課前提醒，保留記錄但標記為 completed
                  reminder.status = 'completed';
                  activeReminders.push(reminder);
                  console.log(`✅ 課前提醒已發送並完成，保留記錄: ${reminder.courseName} - ${reminder.teacherName} (發送時間: ${reminder.sentAt})`);
                } else {
                  // 未發送過且已過期，可以安全移除
                  console.log(`🗑️ 移除未發送的過期課前提醒: ${reminder.courseName} - ${reminder.teacherName} (課程已結束: ${courseTime.toISOString()})`);
                  // 不加入 activeReminders，即移除
                }
              } else {
                // 課程還沒開始，只重置未發送且非失敗狀態的提醒
                if (reminder.status !== 'sent' && 
                    reminder.status !== 'failed' && 
                    reminder.status !== 'pending-retry' && 
                    !reminder.sentAt) {
                  reminder.status = 'pending';
                  const timeStr = scheduledTime && !isNaN(scheduledTime.getTime()) ? scheduledTime.toISOString() : 'N/A';
                  console.log(`🔄 重置課前提醒狀態: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()}, 提醒時間: ${timeStr})`);
                } else if (reminder.status === 'failed' || reminder.status === 'pending-retry') {
                  console.log(`⚠️ 課前提醒發送失敗或等待重試，保持狀態 ${reminder.status}: ${reminder.courseName} - ${reminder.teacherName}`);
                } else {
                  console.log(`⏭️ 課前提醒已發送，保持狀態 ${reminder.status}: ${reminder.courseName} - ${reminder.teacherName}`);
                }
                activeReminders.push(reminder);
              }
            } else {
              // 隔日提醒：只有未發送過的提醒才重置
              if (reminder.status === 'sent' && reminder.sentAt) {
                // 已發送過的提醒，保持狀態不變
                console.log(`✅ 隔日提醒已發送，保持狀態: ${reminder.courseName} - ${reminder.teacherName} (發送時間: ${reminder.sentAt})`);
                activeReminders.push(reminder);
              } else if (scheduledTime && scheduledTime > now) {
                // 未發送且提醒時間還沒到，重置為 pending
                reminder.status = 'pending';
                console.log(`🔄 重置隔日提醒狀態: ${reminder.courseName} - ${reminder.teacherName} (提醒時間: ${scheduledTime.toISOString()})`);
                activeReminders.push(reminder);
              } else {
                // ⭐ 關鍵修復：提醒時間已過，檢查課程是否已結束
                const minutesSinceCourse = (now - courseTime) / (1000 * 60);
                if (minutesSinceCourse > 30) {
                  // 課程已結束30分鐘以上，直接移除
                  console.log(`🗑️ 移除過期隔日提醒: ${reminder.courseName} - ${reminder.teacherName} (課程已結束 ${Math.floor(minutesSinceCourse)} 分鐘)`);
                  // 不加入 activeReminders，即移除
                } else if (reminder.status === 'pending') {
                  // 課程還沒結束或剛結束，保持pending狀態
                  const timeStr = scheduledTime && !isNaN(scheduledTime.getTime()) ? scheduledTime.toISOString() : 'N/A';
                  console.log(`⏰ 隔日提醒時間已過但課程未結束，保持狀態: ${reminder.courseName} - ${reminder.teacherName} (時間: ${timeStr})`);
                  activeReminders.push(reminder);
                } else {
                  // 其他狀態保留
                  activeReminders.push(reminder);
                }
              }
            }
          } else {
            // 未來的提醒，直接保留
            activeReminders.push(reminder);
          }
        }
      }
      
      // ✅ 清理沒有 UID 的學生舊提醒（遺留數據）
      const studentRemindersWithUID = studentReminders.filter(r => {
        if (!r.uid && (r.status === 'pending' || r.status === 'failed' || r.status === 'pending-retry')) {
          console.log(`🗑️ 清理無 UID 的學生舊提醒（遺留數據）: ${r.studentName} - ${r.courseName}`);
          return false;  // 過濾掉
        }
        return true;  // 保留
      });
      console.log(`🔄 清理學生無 UID 提醒: ${studentReminders.length} -> ${studentRemindersWithUID.length}`);
      
      // 清理學生提醒：保留今天和未來的提醒，並重置今天的提醒狀態
      const activeStudentReminders = studentRemindersWithUID.filter(reminder => {
        if (reminder.courseDate >= today) {
          // 如果是今天的提醒，檢查是否需要重置狀態
          if (reminder.courseDate === today) {
            // 檢查提醒時間是否還沒到
            const scheduledTime = reminder.scheduledTime ? new Date(reminder.scheduledTime) : null;
            const now = new Date();
            
            // 只有未發送過的提醒才重置
            if (reminder.status === 'sent' && reminder.sentAt) {
              // 已發送過的學生提醒，保持狀態不變
              console.log(`✅ 學生提醒已發送，保持狀態: ${reminder.studentName} - ${reminder.courseName} (發送時間: ${reminder.sentAt})`);
            } else if (scheduledTime && !isNaN(scheduledTime.getTime()) && scheduledTime > now) {
              // 提醒時間還沒到，重置為待發送狀態
              reminder.status = 'pending';
              console.log(`🔄 重置今日學生提醒狀態: ${reminder.studentName} - ${reminder.courseName} (提醒時間: ${scheduledTime.toISOString()})`);
            } else {
              const timeStr = scheduledTime && !isNaN(scheduledTime.getTime()) ? scheduledTime.toISOString() : 'N/A';
              console.log(`⏰ 學生提醒時間已過，保持狀態: ${reminder.studentName} - ${reminder.courseName} (時間: ${timeStr})`);
            }
          }
          return true;
        }
        return false;
      });
      
      let cleanedCount = 0;
      
      if (activeReminders.length !== reminders.length) {
        remindersData.reminders = activeReminders;
        cleanedCount += reminders.length - activeReminders.length;
      }
      
      if (activeStudentReminders.length !== studentReminders.length) {
        remindersData.studentReminders = activeStudentReminders;
        cleanedCount += studentReminders.length - activeStudentReminders.length;
      }
      
      // 清理超過 24 小時的 completed 狀態提醒（避免數據文件無限增長）
      const oneDayAgo = new Date(Date.now()  - (24 * 60 * 60 * 1000));
      const beforeCleanupCount = remindersData.reminders.length;
      remindersData.reminders = remindersData.reminders.filter(reminder => {
        if (reminder.status === 'completed' && reminder.sentAt) {
          const sentTime = new Date(reminder.sentAt);
          if (sentTime < oneDayAgo) {
            console.log(`🗑️ 清理舊的 completed 提醒: ${reminder.courseName} - ${reminder.teacherName} (發送時間: ${reminder.sentAt})`);
            return false; // 移除
          }
        }
        return true; // 保留
      });
      const completedCleanedCount = beforeCleanupCount - remindersData.reminders.length;
      if (completedCleanedCount > 0) {
        cleanedCount += completedCleanedCount;
        console.log(`✅ 清理了 ${completedCleanedCount} 個超過 24 小時的 completed 提醒`);
      }
      
      // ✅ 優化 4：清理課程日期已過的 cancelled 提醒
      const beforeCancelledCleanupCount = remindersData.reminders.length;
      remindersData.reminders = remindersData.reminders.filter(reminder => {
        if (reminder.status === 'cancelled' && reminder.courseDate && reminder.courseDate < today) {
          console.log(`🗑️ 清理過期的 cancelled 提醒: ${reminder.courseName} - ${reminder.teacherName} (${reminder.courseDate})`);
          return false; // 移除
        }
        return true; // 保留
      });
      const cancelledCleanedCount = beforeCancelledCleanupCount - remindersData.reminders.length;
      if (cancelledCleanedCount > 0) {
        cleanedCount += cancelledCleanedCount;
        console.log(`✅ 清理了 ${cancelledCleanedCount} 個過期的 cancelled 提醒`);
      }
      
      // ✅ 同樣清理學生提醒中過期的 cancelled
      const beforeStudentCancelledCleanup = remindersData.studentReminders.length;
      remindersData.studentReminders = remindersData.studentReminders.filter(reminder => {
        if (reminder.status === 'cancelled' && reminder.courseDate && reminder.courseDate < today) {
          console.log(`🗑️ 清理過期的 cancelled 學生提醒: ${reminder.studentName} - ${reminder.courseName} (${reminder.courseDate})`);
          return false; // 移除
        }
        return true; // 保留
      });
      const studentCancelledCleanedCount = beforeStudentCancelledCleanup - remindersData.studentReminders.length;
      if (studentCancelledCleanedCount > 0) {
        cleanedCount += studentCancelledCleanedCount;
        console.log(`✅ 清理了 ${studentCancelledCleanedCount} 個過期的 cancelled 學生提醒`);
      }
      
      // ✅ 清理課程日期已過的 expired 提醒
      const beforeExpiredCleanup = remindersData.reminders.length;
      remindersData.reminders = remindersData.reminders.filter(reminder => {
        if (reminder.status === 'expired' && reminder.courseDate && reminder.courseDate < today) {
          console.log(`🗑️ 清理過期的 expired 提醒: ${reminder.courseName} - ${reminder.teacherName} (${reminder.courseDate})`);
          return false; // 移除
        }
        return true; // 保留
      });
      const expiredCleanedCount = beforeExpiredCleanup - remindersData.reminders.length;
      if (expiredCleanedCount > 0) {
        cleanedCount += expiredCleanedCount;
        console.log(`✅ 清理了 ${expiredCleanedCount} 個過期的 expired 提醒`);
      }
      
      // ✅ 同樣清理學生提醒中的 expired
      const beforeStudentExpiredCleanup = remindersData.studentReminders.length;
      remindersData.studentReminders = remindersData.studentReminders.filter(reminder => {
        if (reminder.status === 'expired' && reminder.courseDate && reminder.courseDate < today) {
          console.log(`🗑️ 清理過期的 expired 學生提醒: ${reminder.studentName} - ${reminder.courseName} (${reminder.courseDate})`);
          return false; // 移除
        }
        return true; // 保留
      });
      const studentExpiredCleanedCount = beforeStudentExpiredCleanup - remindersData.studentReminders.length;
      if (studentExpiredCleanedCount > 0) {
        cleanedCount += studentExpiredCleanedCount;
        console.log(`✅ 清理了 ${studentExpiredCleanedCount} 個過期的 expired 學生提醒`);
      }
      
      if (cleanedCount > 0) {
        this.saveReminders(remindersData);
        console.log(`✅ 總共清理了 ${cleanedCount} 個過期/舊提醒`);
      }
    } catch (error) {
      console.error('清理過期提醒失敗:', error);
    }
  }

  // 移除重複提醒
  removeDuplicateReminders(reminders) {
    const seen = new Set();
    const unique = [];
    
    for (const reminder of reminders) {
      // ✅ 優化：優先使用 UID 作為去重 key（更準確、效能更好）
      const key = reminder.uid 
        ? `${reminder.uid}-${reminder.type}` 
        : `${reminder.teacherName}-${reminder.courseName}-${reminder.courseDate}-${reminder.type}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(reminder);
      } else {
        console.log(`🗑️ 移除重複提醒: ${reminder.courseName} - ${reminder.teacherName} (${reminder.type})`);
      }
    }
    
    return unique;
  }

  // 計算課程前提醒時間
  calculateReminderTime(courseDate, courseTime, beforeClassMinutes = null) {
    const courseDateTime = new Date(`${courseDate}T${courseTime}:00`);
    const minutes = beforeClassMinutes || this.systemSettings?.reminders?.beforeClassMinutes || 30;
    const beforeClassTime = new Date(courseDateTime.getTime() - (minutes * 60 * 1000));
    return beforeClassTime;
  }

  // 創建提醒
  createReminder(teacherName, courseName, courseDate, courseTime, type, message = null) {
    const remindersData = this.loadReminders();
    this.loadTeachers(); // 確保講師資料已快取
    const normalizedTeacherName = (teacherName || '').trim() || teacherName;
    const normalizedCourseName = (courseName || '').trim() || courseName;
    
    // 使用模糊匹配查找講師的 LINE User ID
    const teacher = this.findTeacherByName(normalizedTeacherName);
    if (!teacher) {
      console.error(`❌ 找不到講師 ${normalizedTeacherName || teacherName} 的 LINE User ID`);
      return null;
    }

    const teacherDisplayName = teacher.displayName || teacher.name || normalizedTeacherName;
    if (!teacher.userId) {
      console.warn(`⚠️ 講師 ${teacherDisplayName} 未設定 LINE User ID，提醒將無法發送`);
    }

    const reminderTime = this.calculateReminderTime(courseDate, courseTime);
    const now = new Date();
    
    // 檢查是否已經過了提醒時間
    if (reminderTime < now) {
      console.log(`⏰ 提醒時間已過，跳過 ${normalizedTeacherName} 的 ${normalizedCourseName} 提醒`);
      return null;
    }

    const reminder = {
      id: Date.now().toString(),
      teacherName: teacherDisplayName,
      teacherUserId: teacher.userId || null,
      courseName: normalizedCourseName,
      courseDate: courseDate,
      courseTime: courseTime,
      type: type,
      message: message || this.generateDefaultMessage(teacherDisplayName, normalizedCourseName, courseDate, courseTime),
      scheduledTime: reminderTime.toISOString(),
      status: 'pending',
      createdAt: now.toISOString()
    };

    remindersData.reminders.push(reminder);
    this.saveReminders(remindersData);
    
    console.log(`✅ 創建提醒: ${teacherDisplayName} - ${normalizedCourseName} (${reminderTime.toLocaleString()})`);
    return reminder;
  }

  // 轉換講師名稱為標準格式（去除空白、符號、老師等字樣）
  normalizeTeacherName(name) {
    return TeacherRegistry.normalizeTeacherName(name);
  }

  // 查找講師（模糊匹配）
  findTeacherByName(teacherName) {
    return TeacherRegistry.findTeacherByName(teacherName);
  }

  // 生成預設訊息
  generateDefaultMessage(teacherName, courseName, courseDate, courseTime) {
    const courseDateTime = new Date(`${courseDate}T${courseTime}:00`);
    const formattedDate = courseDateTime.toLocaleDateString('zh-TW');
    const formattedTime = courseDateTime.toLocaleTimeString('zh-TW', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    return `您好 ${teacherName} 講師！提醒您今天 ${formattedDate} ${formattedTime} 有 ${courseName} 課程，請提前準備！`;
  }

  // 批次發送提醒（同一講師的多個提醒，支援 carousel）
  async sendReminderBatch(reminders, reminderType) {
    if (!reminders || reminders.length === 0) {
      console.log('⚠️ 沒有提醒需要發送');
      return;
    }
    
    const teacherNameRaw = reminders[0].teacherName || '未知講師';
    const teacherName = teacherNameRaw.trim() || teacherNameRaw;
    this.loadTeachers(); // 確保講師資料快取
    
    // 查找講師 User ID
    let teacherUserId = reminders.find(r => r.teacherUserId)?.teacherUserId || null;
    let teacherInfo = null;
    let resolvedTeacherName = teacherName;

    if (teacherUserId) {
      teacherInfo = TeacherRegistry.findTeacherByUserId(teacherUserId);
    }

    if (!teacherInfo) {
      teacherInfo = this.findTeacherByName(teacherName);
      if (teacherInfo && !teacherUserId) {
        teacherUserId = teacherInfo.userId || null;
      }
    }

    if (teacherInfo && teacherInfo.name) {
      resolvedTeacherName = teacherInfo.displayName || teacherInfo.name;
    }

    if (!teacherUserId) {
      console.error(`⚠️ 找不到講師 ${teacherName} 的 LINE User ID`);
      const availableTeachers = TeacherRegistry.getTeacherList().map(t => t.name).join(', ');
      if (availableTeachers) {
        console.error(`📋 已設定的講師清單: ${availableTeachers}`);
      }
      reminders.forEach(reminder => {
        reminder.status = 'failed';
        reminder.error = '找不到講師 LINE User ID';
        reminder.teacherUserId = null;
      });
      throw new Error(`找不到講師 ${teacherName} 的 LINE User ID`);
    }

    // 將解析後的 User ID 寫回提醒，避免下次重複解析
    reminders.forEach(reminder => {
      reminder.teacherUserId = teacherUserId;
      if (!reminder.teacherName || this.normalizeTeacherName(reminder.teacherName) === this.normalizeTeacherName(resolvedTeacherName)) {
        reminder.teacherName = resolvedTeacherName;
      }
    });
    
    console.log(`📤 批次發送 ${reminders.length} 個提醒給 ${resolvedTeacherName} (${teacherUserId})`);
    
    // 透過 API 批次發送（支援 carousel）
    const response = await axios.post(
      `${this.systemSettings?.api?.baseUrl || 'http://localhost:3000'}/api/reminders/batch-send`,
      {
        reminderIds: reminders.map(r => r.id),
        sendDelay: this.systemSettings?.reminders?.sendDelay || 3000,
        groupByRecipient: true  // 啟用分組和 carousel
      },
      { timeout: 15000 }
    );
    
    if (!response.data.success) {
      throw new Error(response.data.message || '批次發送失敗');
    }
    
    console.log(`✅ 批次發送成功: ${teacherName}`);
    console.log(`📊 成功: ${response.data.success}, 失敗: ${response.data.failed}`);
    console.log(`🎠 Carousel 發送: ${response.data.carouselSent}, 單一發送: ${response.data.singleSent}`);
  }
  
  // 發送單個提醒
  async sendReminder(reminder) {
    this.loadTeachers();
    const teacherNameRaw = reminder.teacherName || '未知講師';
    const teacherName = teacherNameRaw.trim() || teacherNameRaw;
    
    // ✅ 重新載入最新資料，確保使用最新的 User ID
    TeacherRegistry.reload();
    
    let teacherUserId = reminder.teacherUserId || null;
    let teacherInfo = null;
    let resolvedTeacherName = teacherName;

    // ✅ 如果提醒中存儲的 User ID 是測試 ID，則忽略它，重新查找
    if (teacherUserId && (teacherUserId === 'local-test-user' || teacherUserId.startsWith('test-') || teacherUserId.startsWith('local-'))) {
      console.log(`⚠️ 提醒中存儲的 User ID "${teacherUserId}" 是測試 ID，重新查找...`);
      teacherUserId = null;
    }

    if (teacherUserId) {
      teacherInfo = TeacherRegistry.findTeacherByUserId(teacherUserId);
      // ✅ 如果 User ID 對應的講師名稱不匹配，重新查找
      if (teacherInfo && teacherInfo.name !== teacherName) {
        console.log(`⚠️ User ID 對應的講師名稱不匹配 (${teacherInfo.name} vs ${teacherName})，重新查找...`);
        teacherInfo = null;
        teacherUserId = null;
      }
    }

    if (!teacherInfo) {
      teacherInfo = this.findTeacherByName(teacherName);
      if (teacherInfo && teacherInfo.userId) {
        teacherUserId = teacherInfo.userId;
        console.log(`✅ 從 TeacherRegistry 找到講師 ${teacherName}: ${teacherUserId}`);
      }
    }

    if (teacherInfo && teacherInfo.name) {
      resolvedTeacherName = teacherInfo.displayName || teacherInfo.name;
    }

    // ✅ 再次驗證 User ID 不是測試 ID
    if (teacherUserId && (teacherUserId === 'local-test-user' || teacherUserId.startsWith('test-') || teacherUserId.startsWith('local-'))) {
      console.log(`❌ 找到的 User ID "${teacherUserId}" 仍然是測試 ID，無法發送`);
      reminder.status = reminder.status === 'sent' ? reminder.status : 'failed';
      reminder.error = `User ID 格式無效: ${teacherUserId}`;
      reminder.teacherUserId = null;
      return;
    }

    if (!teacherUserId) {
      console.log(`⚠️ 找不到講師 ${teacherName} 的LINE User ID`);
      const availableTeachers = TeacherRegistry.getTeacherList().map(t => t.name).join(', ');
      if (availableTeachers) {
        console.log(`📋 已設定的講師清單: ${availableTeachers}`);
      }
      reminder.status = reminder.status === 'sent' ? reminder.status : 'failed';
      reminder.error = '找不到講師 LINE User ID';
      reminder.teacherUserId = null;
      return;
    }

    reminder.teacherUserId = teacherUserId;
    reminder.teacherName = resolvedTeacherName;

    try {
      // 發送LINE通知
      console.log(`📤 發送提醒給 ${reminder.teacherName} (${teacherUserId}): ${reminder.message}`);
      
      // ✅ 準備 Flex Message（如果啟用）
      let sendOptions = {};
      
      // 使用 API 發送（支援 Flex Message）
      const response = await axios.post(`${this.systemSettings?.api?.baseUrl || 'http://localhost:3000'}/api/reminders/${reminder.id}/send`, {}, {
        timeout: 15000
      });
      
      if (!response.data.success) {
        throw new Error(response.data.message || '發送失敗');
      }
      
      console.log(`✅ 提醒發送成功: ${reminder.teacherName}`);
      console.log(`📊 使用 Flex Message: ${response.data.flexMessageUsed || false}`);
      
      // 增加發送間隔，避免觸發速率限制
      const sendDelay = this.systemSettings?.reminders?.sendDelay || 3000; // 預設3秒間隔
      console.log(`⏳ 等待 ${sendDelay}ms 後發送下一個提醒...`);
      await new Promise(resolve => setTimeout(resolve, sendDelay));
      
    } catch (error) {
      console.error(`❌ 發送提醒失敗: ${reminder.teacherName}`);
      console.error(`❌ 錯誤訊息: ${error.message}`);
      console.error(`❌ 詳細錯誤:`, error);
      
      // 根據錯誤類型決定是否重試
      const remindersData = this.loadReminders();
      const reminderIndex = remindersData.reminders.findIndex(r => r.id === reminder.id);
      if (reminderIndex !== -1) {
        const currentReminder = remindersData.reminders[reminderIndex];
        
        // 初始化重試相關欄位
        if (!currentReminder.retryCount) currentReminder.retryCount = 0;
        if (!currentReminder.maxRetries) currentReminder.maxRetries = 3;
        
        // ⭐ 修復：檢查是否應該重試（包含網絡錯誤）
        const shouldRetry = error.message.includes('429') || 
                           error.message.includes('速率限制') ||
                           error.message.includes('timeout') ||
                           error.message.includes('ENOTFOUND') ||
                           error.message.includes('ECONNREFUSED') ||
                           error.message.includes('ETIMEDOUT') ||
                           error.message.includes('ENETUNREACH') ||
                           error.message.includes('ECONNRESET');
        
        if (shouldRetry && currentReminder.retryCount < currentReminder.maxRetries) {
          // 計算下次重試時間（指數退避）
          const delay = Math.min(5000 * Math.pow(2, currentReminder.retryCount), 300000);
          
          currentReminder.status = 'pending-retry';
          currentReminder.retryCount++;
          currentReminder.nextRetryTime = new Date(Date.now() + delay).toISOString();
          currentReminder.lastError = error.message;
          
          console.log(`⏰ 提醒將在 ${delay/1000} 秒後重試 (${currentReminder.retryCount}/${currentReminder.maxRetries}): ${reminder.teacherName}`);
        } else {
          // 達到最大重試次數或非可重試錯誤
          currentReminder.status = 'failed';
          currentReminder.sentAt = new Date().toISOString();
          currentReminder.error = error.message;
          
          console.log(`❌ 提醒發送失敗（${shouldRetry ? '已達最大重試次數' : '不可重試錯誤'}）: ${reminder.teacherName}`);
        }
        
        this.saveReminders(remindersData);
        console.log(`💾 提醒狀態已更新為 ${currentReminder.status}: ${reminder.teacherName}`);
      }
    }
  }

  // 從行事曆創建提醒
  async createRemindersFromCalendar() {
    try {
      console.log('📅 從行事曆創建提醒...');
      
      // 獲取行事曆事件
      console.log('🔄 準備獲取行事曆事件...');
      const events = await this.getCalendarEvents();
      console.log(`📊 獲取到 ${events.length} 個行事曆事件`);
      
      // 使用台灣時區 (UTC+8)
      const taiwanTime = this.getTaiwanTime();
      
      const today = new Date(taiwanTime);
      const tomorrow = new Date(taiwanTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      // 篩選今天和明天的事件
      const relevantEvents = events.filter(event => {
        const eventDate = event.start.split('T')[0];
        return eventDate === todayStr || eventDate === tomorrowStr;
      });
      
      console.log(`找到 ${relevantEvents.length} 個相關事件`);
      
      // 載入現有提醒
      const remindersData = this.loadReminders();
      const existingReminders = remindersData.reminders || [];
      
        // 為每個事件創建提醒（統一處理邏輯）
        for (const event of relevantEvents) {
          const eventDate = event.start.split('T')[0];
          const isToday = eventDate === todayStr;
          const isTomorrow = eventDate === tomorrowStr;
          
          if (!isToday && !isTomorrow) continue;
          
          // 統一處理當日課程提醒
          if (isToday) {
            await this.createRemindersForEvent(event, eventDate, 'today', existingReminders);
            await this.createRemindersForEvent(event, eventDate, 'before-class', existingReminders);
          } else if (isTomorrow) {
            await this.createRemindersForEvent(event, eventDate, 'tomorrow', existingReminders);
          }
        }
      
      // ✅ 優化 5：建立行事曆事件索引（性能優化）
      // ✅ P1-10修復：使用所有事件，不只是今天和明天
      console.log('🔍 建立行事曆事件索引（全部事件）...');
      const eventMap = new Map();
      const uidMap = new Map();  // ✅ 新增：UID 索引（用於精確匹配）
      
      events.forEach(e => {
        // 原來的 key（兼容舊數據）
        const key = `${e.instructor}_${e.title}_${e.start.split('T')[0]}`;
        eventMap.set(key, e);
        
        // ✅ 新增：UID 索引
        if (e.uid) {
          uidMap.set(e.uid, e);
        }
      });
      console.log(`📊 索引建立完成：${eventMap.size} 個事件（UID 索引: ${uidMap.size}）`);
      
      // ✅ 反向檢查 - 取消/更新/恢復提醒
      console.log('🔍 檢查課程變更...');
      let cancelledCount = 0;
      let updatedCount = 0;
      let restoredCount = 0;
      
      for (const reminder of existingReminders) {
        // 跳過已發送的提醒（不處理）
        if (reminder.status === 'sent' || reminder.status === 'completed') continue;
        
        // ✅ 優先使用 UID 匹配（精確匹配編輯後的事件）
        let matchingEvent = null;
        
        if (reminder.uid && uidMap.has(reminder.uid)) {
          // 使用 UID 精確匹配
          matchingEvent = uidMap.get(reminder.uid);
          console.log(`🎯 使用 UID 精確匹配: ${reminder.courseName} (UID: ${reminder.uid.substring(0, 20)}...)`);
        } else if (!reminder.uid) {
          // ⚠️ 沒有 UID 的舊提醒，嘗試名稱匹配
          const key = `${reminder.teacherName}_${reminder.courseName}_${reminder.courseDate}`;
          matchingEvent = eventMap.get(key);
          if (matchingEvent) {
            console.log(`🔍 使用名稱匹配（舊數據，無 UID）: ${reminder.courseName}`);
          } else {
            console.log(`⚠️ 無 UID 且無法名稱匹配的舊提醒: ${reminder.courseName} - ${reminder.teacherName}`);
          }
        }
        
        // === P0-6修復：處理 pending/failed/pending-retry 提醒 ===
        if (reminder.status === 'pending' || reminder.status === 'failed' || reminder.status === 'pending-retry') {
          if (!matchingEvent) {
            // 課程已刪除或無法匹配
            const oldStatus = reminder.status;
            reminder.status = 'cancelled';
            
            // ✅ 根據是否有 UID 設置不同的錯誤訊息
            if (!reminder.uid) {
              reminder.error = '舊提醒（無 UID），無法匹配行事曆事件';
            } else {
              reminder.error = '行事曆已刪除此課程';
            }
            
            reminder.cancelledAt = new Date().toISOString();
            cancelledCount++;
            console.log(`🗑️ 取消提醒（${reminder.error}，原狀態: ${oldStatus}）: ${reminder.courseName} - ${reminder.teacherName} (${reminder.courseDate})`);
          } else {
            // ✅ P1-7修復：更新課程時間和其他資訊
            let hasChanges = false;
            
            // ✅ 修復：更新課程名稱（確保編輯標題後不產生重複提醒）
            if (reminder.courseName !== matchingEvent.title) {
              console.log(`🔄 更新課程名稱: ${reminder.courseName} → ${matchingEvent.title}`);
              reminder.courseName = matchingEvent.title;
              hasChanges = true;
            }
            
            // 更新課程時間
            const eventTime = matchingEvent.start.split('T')[1]?.substring(0, 5);
            if (eventTime && reminder.courseTime !== eventTime) {
              console.log(`🔄 更新課程時間: ${reminder.courseName} ${reminder.courseTime} → ${eventTime}`);
              reminder.courseTime = eventTime;
              hasChanges = true;
              
              // 重新計算 scheduledTime（如果是課前提醒）
              if (reminder.type === 'before-class') {
                const beforeClassMinutes = this.systemSettings?.reminders?.beforeClassMinutes || 30;
                const courseDateTime = new Date(matchingEvent.start);
                const newScheduledTime = new Date(courseDateTime.getTime() - (beforeClassMinutes * 60 * 1000));
                reminder.scheduledTime = newScheduledTime.toISOString();
                console.log(`   更新課前提醒時間: ${newScheduledTime.toISOString()}`);
              }
            }
            
            // ✅ P1-7修復：更新地點資訊
            const newLocation = this.mapAddress(matchingEvent.location || '未設定地點');
            if (reminder.location !== newLocation) {
              console.log(`   更新地點: ${reminder.location} → ${newLocation}`);
              reminder.location = newLocation;
              reminder.googleMapsUrl = newLocation && newLocation !== '未設定地點' ?
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(newLocation)}` : '';
              hasChanges = true;
            }
            
            // ✅ P1-7修復：更新教案連結
            const description = matchingEvent.description || '';
            const notionMatch = description.match(/\(https:\/\/www\.notion\.so\/([^)]+)\)/) || 
                                description.match(/https:\/\/www\.notion\.so\/([^)\s]+)/);
            if (notionMatch) {
              const newLessonPlanUrl = `https://www.notion.so/${notionMatch[1]}`;
              if (reminder.lessonPlanUrl !== newLessonPlanUrl) {
                console.log(`   更新教案連結`);
                reminder.lessonPlanUrl = newLessonPlanUrl;
                reminder.description = description;
                hasChanges = true;
              }
            }
            
            if (hasChanges) {
              reminder.updatedAt = new Date().toISOString();
              updatedCount++;
              
              // ✅ 修復：重新生成 message（包含更新後的課程名稱和資訊）
              try {
                const eventDate = matchingEvent.start.split('T')[0];
                const weekdayMap = { '0': '週日', '1': '週一', '2': '週二', '3': '週三', '4': '週四', '5': '週五', '6': '週六' };
                const weekday = weekdayMap[new Date(matchingEvent.start).getUTCDay()];
                const description = matchingEvent.description || '';
                
                reminder.message = await this.generateReminderMessage(
                  reminder.teacherName,
                  matchingEvent.title,
                  eventDate,
                  eventTime || reminder.courseTime,
                  reminder.type,
                  reminder.location,
                  description,
                  reminder.lessonPlanUrl
                );
                reminder.weekday = weekday;
                console.log(`   ✅ 已重新生成提醒訊息（包含新的課程名稱）`);
              } catch (error) {
                console.error(`   ⚠️ 重新生成提醒訊息失敗:`, error);
              }
            }
          }
        }
        
        // === 優化 3：處理 cancelled 提醒（自動恢復） ===
        else if (reminder.status === 'cancelled') {
          // 檢查課程是否已恢復
          if (matchingEvent) {
            // ✅ 停課邏輯調整：不再檢查停課關鍵字，因為停課也要通知講師
            // 恢復提醒
            reminder.status = 'pending';
            delete reminder.error;
            delete reminder.cancelledAt;
            reminder.restoredAt = new Date().toISOString();
            restoredCount++;
            console.log(`♻️ 恢復提醒（課程已恢復）: ${reminder.courseName} - ${reminder.teacherName} (${reminder.courseDate})`);
          }
        }
      }
      
      // 輸出統計
      if (cancelledCount > 0) {
        console.log(`✅ 已取消 ${cancelledCount} 個提醒`);
      }
      if (updatedCount > 0) {
        console.log(`✅ 已更新 ${updatedCount} 個提醒的課程時間`);
      }
      if (restoredCount > 0) {
        console.log(`✅ 已恢復 ${restoredCount} 個提醒`);
      }
      
      // 儲存更新後的提醒
      remindersData.reminders = existingReminders;
      this.saveReminders(remindersData);
      
      console.log(`📝 總共 ${existingReminders.length} 個提醒`);
      
    } catch (error) {
      console.error('❌ 從行事曆創建提醒失敗:', error);
    }
  }

  // 統一的提醒創建輔助函數（避免重複邏輯）
  async createRemindersForEvent(event, eventDate, type, existingReminders) {
    const typeNames = {
      'today': '當日提醒',
      'tomorrow': '隔日提醒', 
      'before-class': '課前提醒'
    };
    
    const typeName = typeNames[type] || type;
    console.log(`📅 處理${typeName}: ${event.title} - ${event.instructor}`);
    
    // 特殊處理課前提醒的時間檢查
    if (type === 'before-class') {
      // 使用 CalDAV 客戶端已經解析好的時間
      const courseTime = new Date(event.start);
      const now = new Date();
      const beforeClassMinutes = this.systemSettings?.reminders?.beforeClassMinutes || 30;
      const beforeClassTime = new Date(courseTime.getTime() - (beforeClassMinutes * 60 * 1000));
      
      console.log(`⏰ 檢查課前提醒時間: ${event.title} - ${event.instructor}`);
      console.log(`   課程時間: ${courseTime.toISOString()}`);
      console.log(`   台灣時間: ${courseTime.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
      console.log(`   課前提醒時間: ${beforeClassTime.toISOString()}`);
      console.log(`   台灣時間: ${beforeClassTime.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
      console.log(`   現在時間: ${now.toISOString()}`);
      console.log(`   台灣時間: ${now.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})}`);
      
      // 只有課程還沒開始才創建課前提醒
      if (courseTime <= now) {
        console.log(`⏭️ 跳過${typeName}: ${event.title} - ${event.instructor} (課程已開始)`);
        return;
      }
      
      // 如果課前提醒時間已過，仍然創建提醒但標記為已過期
      if (beforeClassTime <= now) {
        console.log(`⚠️ 課前提醒時間已過但仍創建: ${event.title} - ${event.instructor} (提醒時間: ${beforeClassTime.toISOString()})`);
      }
    }
    
    const reminder = await this.createReminderFromEvent(event, type);
    if (reminder) {
      // ✅ 優化：優先使用 UID 檢查重複提醒
      const existingReminder = existingReminders.find(r => {
        if (event.uid && r.uid) {
          // 使用 UID 精確匹配（編輯課程標題後仍能識別為同一課程）
          return r.uid === event.uid && r.type === type;
        } else {
          // Fallback：名稱匹配（兼容沒有 UID 的舊提醒）
          return r.teacherName === event.instructor &&
                 r.courseName === event.title &&
                 r.courseDate === eventDate &&
                 r.type === type;
        }
      });
      
      if (!existingReminder) {
        existingReminders.push(reminder);
        console.log(`✅ 創建${typeName}: ${event.title} - ${event.instructor}`);
      } else {
        // 檢查提醒是否已經發送過或已完成
        if ((existingReminder.status === 'sent' || existingReminder.status === 'completed') && existingReminder.sentAt) {
          console.log(`⏭️ ${typeName}已發送，跳過創建: ${event.title} - ${event.instructor} (狀態: ${existingReminder.status}, 發送時間: ${existingReminder.sentAt})`);
        } else {
          console.log(`⏭️ ${typeName}已存在: ${event.title} - ${event.instructor} (狀態: ${existingReminder.status})`);
        }
      }
    }
  }

  // 統一的提醒創建函數（避免重複邏輯）
  async createReminderFromEvent(event, type) {
    const eventDate = event.start.split('T')[0];
    const eventTime = event.start.split('T')[1].substring(0, 5);
    const instructorName = (event.instructor || '').trim();
    this.loadTeachers();
    let matchedTeacher = null;
    if (event.teacherUserId) {
      matchedTeacher = TeacherRegistry.findTeacherByUserId(event.teacherUserId);
    }
    if (!matchedTeacher) {
      matchedTeacher = this.findTeacherByName(instructorName);
    }
    const resolvedTeacherName = matchedTeacher?.displayName || matchedTeacher?.name || instructorName || event.instructor || '未知講師';
    const resolvedTeacherUserId = matchedTeacher?.userId || null;
    
    // ✅ 停課邏輯調整：不跳過講師提醒，改為發送停課特殊事件通知
    // 講師提醒正常創建，系統會自動使用停課特殊事件模板（通過 detectSpecialEventType）
    console.log(`📝 創建講師提醒: ${event.title} - ${resolvedTeacherName}`);
    
    // 計算提醒時間（使用正確的台灣時區轉換）
    let scheduledTime;
    if (type === 'today') {
      // 當日提醒：從設定檔讀取時間
      const todayReminderHour = this.systemSettings?.reminders?.todayReminderHour || 8;
      const todayReminderMinute = this.systemSettings?.reminders?.todayReminderMinute || 0;
      
      // 使用課程日期而不是當前日期來計算提醒時間
      const [year, month, day] = eventDate.split('-').map(Number);
      
      // ✅ 正確方法：創建台灣時間字串並轉換為 UTC
      const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${todayReminderHour.toString().padStart(2, '0')}:${todayReminderMinute.toString().padStart(2, '0')}:00+08:00`;
      const scheduledTimeDate = new Date(taiwanTimeStr);
      scheduledTime = scheduledTimeDate.toISOString();
      
      console.log(`⏰ 創建當日提醒: ${event.title} - ${event.instructor}`);
      console.log(`   課程時間: ${event.start}`);
      console.log(`   提醒時間 (台灣): ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${todayReminderHour.toString().padStart(2, '0')}:${todayReminderMinute.toString().padStart(2, '0')}:00`);
      console.log(`   提醒時間 (UTC): ${scheduledTime}`);
    } else if (type === 'before-class') {
      // 課前提醒：課程時間前30分鐘（可從設定檔讀取）
      const beforeClassMinutes = this.systemSettings?.reminders?.beforeClassMinutes || 30;
      
      // event.start 是台灣時間格式，需要正確轉換為 UTC
      const courseTimeStr = event.start;
      
      // 解析台灣時間
      const [datePart, timePart] = courseTimeStr.split('T');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      
      // ✅ 正確方法：創建台灣時間字串並轉換為 UTC
      const taiwanCourseTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
      const courseTimeUTC = new Date(taiwanCourseTimeStr);
      
      // 計算課前提醒時間（提前指定分鐘）
      const beforeClassTime = new Date(courseTimeUTC.getTime() - (beforeClassMinutes * 60 * 1000));
      scheduledTime = beforeClassTime.toISOString();
      
      console.log(`⏰ 創建課前提醒: ${event.title} - ${event.instructor}`);
      console.log(`   課程時間 (台灣): ${taiwanCourseTimeStr}`);
      console.log(`   課程時間 (UTC): ${courseTimeUTC.toISOString()}`);
      console.log(`   課前提醒時間 (UTC): ${scheduledTime}`);
      console.log(`   課前提醒時間 (台灣): ${beforeClassTime.toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})} (提前${beforeClassMinutes}分鐘)`);
    } else {
      // 隔日提醒：今天時間（可從設定檔讀取）
      // 隔日提醒應該在今天發送，提醒明天的課程
      const tomorrowReminderHour = this.systemSettings?.reminders?.tomorrowReminderHour || 19;
      const tomorrowReminderMinute = this.systemSettings?.reminders?.tomorrowReminderMinute || 30;
      
      // 隔日提醒應該在課程前一天發送
      // 使用課程日期的前一天來計算隔日提醒時間
      const [year, month, day] = eventDate.split('-').map(Number);
      const courseDate = new Date(year, month - 1, day);
      const reminderDate = new Date(courseDate);
      reminderDate.setDate(reminderDate.getDate() - 1);
      
      // ✅ 正確方法：創建台灣時間字串並轉換為 UTC
      const reminderYear = reminderDate.getFullYear();
      const reminderMonth = reminderDate.getMonth() + 1;
      const reminderDay = reminderDate.getDate();
      const taiwanTimeStr = `${reminderYear}-${reminderMonth.toString().padStart(2, '0')}-${reminderDay.toString().padStart(2, '0')}T${tomorrowReminderHour.toString().padStart(2, '0')}:${tomorrowReminderMinute.toString().padStart(2, '0')}:00+08:00`;
      const utcTime = new Date(taiwanTimeStr);
      scheduledTime = utcTime.toISOString();
      
      console.log(`⏰ 創建隔日提醒: ${event.title} - ${event.instructor}`);
      console.log(`   課程時間: ${event.start}`);
      console.log(`   提醒時間 (台灣): ${taiwanTimeStr}`);
      console.log(`   提醒時間 (UTC): ${scheduledTime}`);
    }
    
    // 生成提醒訊息
    const message = await this.generateReminderMessage(event, type);
    
    // ✅ 提取額外欄位供 Flex Message 使用（與 generateReminderMessage 相同的邏輯）
    let location = event.location || '未設定地點';
    location = this.mapAddress(location);
    
    const description = event.description || '';
    
    // 從描述中提取教案連結
    let lessonPlanUrl = '';
    const notionUrlRegex = /\(https:\/\/www\.notion\.so\/([^)]+)\)/;
    let notionMatch = description.match(notionUrlRegex);
    
    if (!notionMatch) {
      const generalNotionRegex = /https:\/\/www\.notion\.so\/([^)\s]+)/;
      notionMatch = description.match(generalNotionRegex);
    }
    
    if (notionMatch) {
      lessonPlanUrl = `https://www.notion.so/${notionMatch[1]}`;
    }
    
    // 生成 Google Maps URL
    const googleMapsUrl = location && location !== '未設定地點' ? 
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : '';
    
    // 計算星期幾
    const date = new Date(eventDate);
    const weekday = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()];
    
    return {
      id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uid: event.uid,              // ✅ CalDAV UID（用於精確匹配編輯後的事件）
      evt_id: event.evt_id,        // ✅ Synology 內部事件 ID
      teacherName: resolvedTeacherName,
      teacherUserId: resolvedTeacherUserId,
      courseName: event.title,
      courseDate: eventDate,
      courseTime: eventTime,
      type: type,
      status: 'pending',
      scheduledTime: scheduledTime,
      createdAt: new Date().toISOString(),
      message: message,
      // ✅ 新增以下欄位供 Flex Message 使用
      location: location,
      description: description,
      lessonPlanUrl: lessonPlanUrl,
      googleMapsUrl: googleMapsUrl,
      weekday: weekday
    };
  }

  // 獲取範本設定
  async getTemplates() {
    try {
      const baseUrl = this.systemSettings?.api?.baseUrl || 'http://localhost:3000';
      console.log('🔍 嘗試從API獲取範本:', `${baseUrl}/api/templates`);
      
      const response = await fetch(`${baseUrl}/api/templates`);
      const data = await response.json();

      if (data.success && data.data) {
        console.log('✅ 從API獲取範本成功:', data.data);
        return data.data;
      } else {
        console.log('⚠️ API返回失敗，使用預設範本:', data);
        return this.getDefaultTemplates();
      }
    } catch (error) {
      console.error('❌ 獲取範本失敗:', error);
      console.log('🔄 使用預設範本');
      return this.getDefaultTemplates();
    }
  }

  // 預設範本
  getDefaultTemplates() {
    return {
      today: "今日課程提醒\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}\n📍 地點：{location}\n-\n📋 教案連結：{lessonPlanUrl}\n-\n-\n請準備好課程內容，祝教學順利！",
      tomorrow: "明日課程提醒\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}\n📍 地點：{location}\n-\n-\n請提前準備課程內容！",
      beforeClass: "📚 課程即將開始\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}\n📍 地點：{location}\n-\n📋 教案連結：{lessonPlanUrl}\n-\n🗺️ 地圖連結：{googleMapsUrl}\n-\n-\n課程將在 {minutes} 分鐘後開始，請準備就緒！",
      student: "👋 您好！\n\n📚 課程提醒通知\n\n📖 課程：{courseName}\n📅 日期：{courseDate}\n⏰ 時間：{courseTime}\n\n📍地點：{location}\n\n\n提醒您要上課喔！謝謝🙏🏻\n\n希望孩子學習愉快、玩得開心 🎉🧱"
    };
  }

  // 處理範本變數
  processTemplate(template, variables) {
    if (!template) return '';
    
    let result = template;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, variables[key] || '');
    });
    
    return result;
  }

  // 生成提醒訊息
  async generateReminderMessage(event, type) {
    const eventDate = event.start.split('T')[0];
    const eventTime = event.start.split('T')[1].substring(0, 5);
    const teacherName = event.instructor;
    const courseName = event.title;
    let location = event.location || '未設定地點';
    
    // 地址映射邏輯：從設定檔讀取地址映射
    location = this.mapAddress(location);
    
    const description = event.description || '';
    
    // 從描述中提取教案連結 - 使用與 perfect-calendar-optimized-complete.html 相同的邏輯
    let lessonPlanUrl = '';
    
    // 尋找教案連結 - 從原始描述中提取
    const notionUrlRegex = /\(https:\/\/www\.notion\.so\/([^)]+)\)/;
    let notionMatch = description.match(notionUrlRegex);
    
    // 如果沒有找到括號內的連結，則匹配一般的 Notion 連結
    if (!notionMatch) {
      const generalNotionRegex = /https:\/\/www\.notion\.so\/([^)\s]+)/;
      notionMatch = description.match(generalNotionRegex);
    }
    
    if (notionMatch) {
      lessonPlanUrl = `https://www.notion.so/${notionMatch[1]}`;
    }
    
    // 生成Google Maps URL
    const googleMapsUrl = location && location !== '未設定地點' ? 
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : '';
    
    const date = new Date(eventDate);
    const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    
    // 獲取範本設定
    const templates = await this.getTemplates();
    // 處理範本鍵名對應
    let templateKey = type;
    if (type === 'before-class') {
      templateKey = 'beforeClass';
    }
    const template = templates[templateKey] || templates.today;
    
    // 計算課前提醒的剩餘分鐘數
    let minutes = '';
    if (type === 'before-class') {
      const beforeClassMinutes = this.systemSettings?.reminders?.beforeClassMinutes || 30;
      minutes = beforeClassMinutes.toString();
    }
    
    // 準備變數
    const variables = {
      teacherName,
      courseName,
      courseTime: eventTime,
      courseDate: formattedDate + ' 星期' + weekday,
      location,
      lessonPlanUrl,
      googleMapsUrl,
      minutes
    };
    
    // 處理範本
    const message = this.processTemplate(template, variables);
    
    console.log(`📋 使用範本生成${type}提醒訊息`);
    return message;
  }

  // 統一的提醒處理函數（避免重複邏輯）
  async processRemindersByType(type, typeName) {
    try {
      console.log(`📅 處理${typeName}...`);
      const remindersData = this.loadReminders();
      const reminders = remindersData.reminders || [];
      
      // 統一使用 UTC 時間進行比較
      const nowUTC = new Date();
      const nowTaiwan = this.getTaiwanTime();
      const today = this.getTaiwanDateString();
      
      // ⭐ 關鍵修復：過濾出課程還沒結束的提醒
      // 先標記已結束課程的提醒為 expired（包含pending和failed狀態）
      let expiredBeforeProcessCount = 0;
      reminders.forEach(reminder => {
        if ((reminder.status === 'pending' || reminder.status === 'failed') && reminder.courseDate && reminder.courseTime) {
          try {
            // ✅ 正確時區轉換：解析為台灣時間（UTC+8）
            const [year, month, day] = reminder.courseDate.split('-').map(Number);
            const [hour, minute] = reminder.courseTime.split(':').map(Number);
            // ✅ 使用正確的台灣時區轉換
            const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
            const courseTimeUTC = new Date(taiwanTimeStr);
            const now = new Date();
            
            // 課程結束後30分鐘就標記為過期（不再發送任何類型的提醒）
            const minutesSinceCourse = (now - courseTimeUTC) / (1000 * 60);
            
            if (minutesSinceCourse > 30) {
              console.log(`⏭️ 跳過已結束課程的${typeName}: ${reminder.courseName} (狀態: ${reminder.status}, 課程時間: ${courseTimeUTC.toISOString()}, 已過 ${Math.floor(minutesSinceCourse)} 分鐘)`);
              reminder.status = 'expired';
              reminder.error = '課程已結束';
              expiredBeforeProcessCount++;
            }
          } catch (error) {
            // 時間解析失敗，跳過
            console.error(`⚠️ 解析課程時間失敗: ${reminder.courseName} - ${error.message}`);
          }
        }
      });
      
      // 立即保存 expired 狀態，防止重複處理
      if (expiredBeforeProcessCount > 0) {
        this.saveReminders(remindersData);
        console.log(`💾 已標記並保存 ${expiredBeforeProcessCount} 個過期${typeName}`);
      }
      
      // 對於課前提醒，需要檢查時間是否已到，但課程可能還沒開始
      let filteredReminders;
      if (type === 'before-class') {
        // ⭐ 關鍵修復：過濾出課程還沒開始的課前提醒
        filteredReminders = reminders.filter(reminder => {
          if (reminder.courseDate !== today || 
              reminder.status !== 'pending' ||
              reminder.type !== type) {
            return false;
          }
          
          // 檢查課程時間是否還沒開始
          try {
            // ✅ 正確時區轉換：解析為台灣時間（UTC+8）
            const [year, month, day] = reminder.courseDate.split('-').map(Number);
            const [hour, minute] = reminder.courseTime.split(':').map(Number);
            // ✅ 使用正確的台灣時區轉換
            const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
            const courseTimeUTC = new Date(taiwanTimeStr);
            const now = new Date();
            
            // 如果課程已經開始，不發送課前提醒
            if (courseTimeUTC <= now) {
              console.log(`⏭️ 跳過已開始的課程課前提醒: ${reminder.courseName} (課程時間: ${courseTimeUTC.toISOString()})`);
              // 標記為 expired，避免重複檢查
              reminder.status = 'expired';
              reminder.error = '課程已開始';
              return false;
            }
            
            // 檢查提醒時間是否已到
            const scheduledTime = new Date(reminder.scheduledTime);
            return scheduledTime <= nowUTC;
          } catch (error) {
            console.error(`⚠️ 解析課程時間失敗: ${reminder.courseName} - ${error.message}`);
            return false;
          }
        });
      } else {
        // 對於隔日提醒，課程日期是明天，但提醒應該在今天發送
        // 隔日提醒應該篩選課程日期為明天的提醒
        const targetDate = type === 'tomorrow' ? this.getTomorrowDateString() : today;
        filteredReminders = reminders.filter(reminder => 
          reminder.courseDate === targetDate && 
          reminder.status === 'pending' &&
          reminder.type === type &&
          new Date(reminder.scheduledTime) <= nowUTC
        );
      }
      
      console.log(`找到 ${filteredReminders.length} 個${typeName}`);
      
      // 詳細記錄提醒狀態
      const targetDate = type === 'tomorrow' ? this.getTomorrowDateString() : today;
      const pendingReminders = reminders.filter(r => r.courseDate === targetDate && r.status === 'pending' && r.type === type);
      const futureReminders = pendingReminders.filter(r => new Date(r.scheduledTime) > nowUTC);
      
      // 過濾準備發送的提醒，並確保 scheduledTime 不是過去的日期
      const readyReminders = pendingReminders.filter(r => {
        const scheduledTimeUTC = new Date(r.scheduledTime);
        if (scheduledTimeUTC > nowUTC) return false;
        
        // 將 UTC 時間轉換為台灣時間的日期字串
        const taiwanScheduledTime = new Date(scheduledTimeUTC.getTime() + 8*60*60*1000);
        const scheduledDateStr = taiwanScheduledTime.toISOString().split('T')[0];
        
        // 對於today和tomorrow提醒，確保scheduledTime的日期不早於預期日期
        if (type === 'today') {
          if (scheduledDateStr < today) {
            console.log(`⏭️ 跳過過期的今日提醒: ${r.courseName} (scheduled: ${scheduledDateStr}, today: ${today})`);
            // 標記為expired
            r.status = 'expired';
            r.error = '提醒時間已過期（scheduled date < today）';
            return false;
          }
        } else if (type === 'tomorrow') {
          const tomorrowDate = this.getTomorrowDateString();
          if (scheduledDateStr < tomorrowDate) {
            console.log(`⏭️ 跳過過期的隔日提醒: ${r.courseName} (scheduled: ${scheduledDateStr}, tomorrow: ${tomorrowDate})`);
            r.status = 'expired';
            r.error = '提醒時間已過期（scheduled date < tomorrow）';
            return false;
          }
        }
        
        return true;
      });
      
      console.log(`📊 ${typeName}統計:`);
      console.log(`   總待發送: ${pendingReminders.length}`);
      console.log(`   未來提醒: ${futureReminders.length}`);
      console.log(`   準備發送: ${readyReminders.length}`);
      
      if (readyReminders.length > 0) {
        console.log(`📋 準備發送的${typeName}:`);
        readyReminders.forEach(r => {
          const scheduledTime = new Date(r.scheduledTime);
          const timeDiff = Math.floor((scheduledTime - nowUTC) / (1000 * 60));
          console.log(`   - ${r.courseName} (${r.teacherName}): ${scheduledTime.toISOString()} (${timeDiff}分鐘後)`);
        });
      }
      
      let sentCount = 0;
      let failedCount = 0;
      
      // ✅ 按講師分組提醒，以便合併發送
      const remindersByTeacher = {};
      for (const reminder of filteredReminders) {
        const teacherNameRaw = reminder.teacherName || '未知講師';
        const teacherKey = this.normalizeTeacherName(teacherNameRaw) || (teacherNameRaw.trim() || teacherNameRaw);
        const displayName = teacherNameRaw.trim() || teacherNameRaw;
        if (!remindersByTeacher[teacherKey]) {
          remindersByTeacher[teacherKey] = {
            displayName,
            reminders: []
          };
        }
        remindersByTeacher[teacherKey].displayName = remindersByTeacher[teacherKey].displayName || displayName;
        remindersByTeacher[teacherKey].reminders.push(reminder);
      }
      
      const teacherGroups = Object.values(remindersByTeacher);
      console.log(`👥 共有 ${teacherGroups.length} 位講師需要發送提醒`);
      
      // 逐講師發送（同一講師的多堂課會合併成 carousel）
      for (const group of teacherGroups) {
        const teacherName = group.displayName || '未知講師';
        const teacherReminders = group.reminders;
        try {
          console.log(`📤 發送提醒給 ${teacherName}（共 ${teacherReminders.length} 堂課）`);
          
          // 使用批次發送（支援 carousel）
          await this.sendReminderBatch(teacherReminders, type);
          
          // 標記所有提醒為已發送
          for (const reminder of teacherReminders) {
            reminder.status = 'sent';
            reminder.sentAt = new Date().toISOString();
            sentCount++;
            console.log(`✅ 發送成功: ${reminder.teacherName} - ${reminder.courseName}`);
          }
          
          // 避免發送太快，增加間隔時間避免觸發 LINE API 速率限制
          const delay = this.systemSettings?.reminders?.sendDelay || 3000;
          console.log(`⏳ 等待 ${delay}ms 後發送下一位講師的提醒...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          
        } catch (error) {
          failedCount += teacherReminders.length;
          console.error(`❌ 發送提醒失敗: ${teacherName}`, error.message);
          
          // 標記所有提醒為失敗
          for (const reminder of teacherReminders) {
            reminder.status = 'failed';
            reminder.error = error.message;
          }
          
          // 如果是速率限制錯誤，增加更長的等待時間
          if (error.message.includes('速率限制')) {
            console.log('⏳ 檢測到速率限制，等待 10 秒...');
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      }
      
      console.log(`📊 ${typeName}發送結果: 成功 ${sentCount} 個，失敗 ${failedCount} 個`);
      
      // ⭐ 修復：確保所有狀態變更都被保存（包括sent和failed狀態）
      if (sentCount > 0 || failedCount > 0 || expiredBeforeProcessCount > 0) {
        this.saveReminders(remindersData);
        console.log(`💾 已保存所有狀態變更: sent=${sentCount}, failed=${failedCount}, expired=${expiredBeforeProcessCount}`);
      }
      
      return {
        sentCount,
        failedCount,
        totalProcessed: filteredReminders.length,
        type: type,
        typeName: typeName
      };
      
    } catch (error) {
      console.error(`處理${typeName}失敗:`, error);
      return {
        sentCount: 0,
        failedCount: 0,
        totalProcessed: 0,
        type: type,
        typeName: typeName,
        error: error.message
      };
    }
  }

  // 處理今日提醒
  async processTodayReminders() {
    // 檢查是否到了當日提醒時間（每天08:00-08:10執行）
    const taiwanTime = this.getTaiwanTime();
    // ✅ 修復：使用 getUTCHours/getUTCMinutes
    const currentHour = taiwanTime.getUTCHours();
    const currentMinute = taiwanTime.getUTCMinutes();
    
    const todayReminderHour = this.systemSettings?.reminders?.todayReminderHour || 8;
    const todayReminderMinute = this.systemSettings?.reminders?.todayReminderMinute || 0;
    const todayReminderDuration = this.systemSettings?.reminders?.todayReminderDuration || 10;
    
    const today = this.getTaiwanDateString();
    
    // ⭐ 修復：從數據文件檢查今天是否已經發送過當日提醒
    const remindersData = this.loadReminders();
    const todayReminders = remindersData.reminders?.filter(r => 
      r.type === 'today' && 
      r.courseDate === today
    ) || [];
    
    // ✅ 關鍵修復：檢查是否有「今天發送」的提醒（不只是 sent 狀態，還要確認發送日期是今天）
    const hasSentToday = todayReminders.some(r => {
      if ((r.status !== 'sent' && r.status !== 'completed') || !r.sentAt) {
        return false;
      }
      // 檢查 sentAt 的日期是否為今天
      const sentDate = new Date(r.sentAt).toISOString().split('T')[0];
      return sentDate === today;
    });
    
    if (hasSentToday) {
      console.log(`⏰ 當日提醒今天已經發送過（${today}），跳過重複觸發`);
      this.lastTodayReminder = today; // ✅ 修復：確保設置內存標記
      return;
    }
    
    // 檢查今天是否已經觸發過當日提醒（內存檢查，作為第二層防護）
    if (this.lastTodayReminder === today) {
      console.log(`⏰ 當日提醒今天已經觸發過（內存檢查，${today}），跳過重複觸發`);
      return;
    }
    
    // 檢查是否在指定的小時和分鐘範圍內
    const isInTriggerWindow = (currentHour === todayReminderHour && 
                              currentMinute >= todayReminderMinute && 
                              currentMinute <= (todayReminderMinute + todayReminderDuration - 1));
    
    // ⭐ 修復：如果已經過了觸發窗口超過1小時，不再發送（避免重啟後重複發送）
    const hoursSinceTrigger = currentHour - todayReminderHour;
    const minutesSinceTrigger = (currentHour * 60 + currentMinute) - (todayReminderHour * 60 + todayReminderMinute + todayReminderDuration);
    
    if (!isInTriggerWindow) {
      if (minutesSinceTrigger > 60) {
        console.log(`⏰ 已過當日提醒時間超過1小時（${Math.floor(minutesSinceTrigger)}分鐘），跳過發送以避免重複（${today}）`);
        this.lastTodayReminder = today; // ✅ 修復：確保設置內存標記
        return;
      } else if (minutesSinceTrigger < 0) {
        console.log(`⏰ 未到當日提醒時間（每天${todayReminderHour}:${todayReminderMinute}-${todayReminderHour}:${todayReminderMinute + todayReminderDuration - 1}），跳過`);
        return;
      }
    }
    
    console.log(`📅 開始處理當日提醒（${today}）...`);
    
    // ✅ 修復：在發送前立即設置內存標記，防止異步操作期間的競態條件
    this.lastTodayReminder = today;
    
    await this.processRemindersByType('today', '今日提醒');
  }

  // 處理隔日提醒
  async processTomorrowReminders() {
    // 檢查是否到了隔日提醒時間（每天19:30-19:45執行）
    const taiwanTime = this.getTaiwanTime();
    // ✅ 修復：使用 getUTCHours/getUTCMinutes
    const currentHour = taiwanTime.getUTCHours();
    const currentMinute = taiwanTime.getUTCMinutes();
    
    const tomorrowReminderHour = this.systemSettings?.reminders?.tomorrowReminderHour || 19;
    const tomorrowReminderMinute = this.systemSettings?.reminders?.tomorrowReminderMinute || 30;
    const tomorrowReminderDuration = this.systemSettings?.reminders?.tomorrowReminderDuration || 15;
    
    const today = this.getTaiwanDateString();
    
    // ⭐ 修復：從數據文件檢查今天是否已經發送過隔日提醒
    const remindersData = this.loadReminders();
    const tomorrowDate = this.getTomorrowDateString();
    const tomorrowReminders = remindersData.reminders?.filter(r => 
      r.type === 'tomorrow' && 
      r.courseDate === tomorrowDate
    ) || [];
    
    // ✅ 關鍵修復：檢查是否有「今天發送」的隔日提醒（不只是 sent 狀態，還要確認發送日期是今天）
    const hasSentToday = tomorrowReminders.some(r => {
      if ((r.status !== 'sent' && r.status !== 'completed') || !r.sentAt) {
        return false;
      }
      // 檢查 sentAt 的日期是否為今天
      const sentDate = new Date(r.sentAt).toISOString().split('T')[0];
      const isToday = sentDate === today;
      if (isToday) {
        console.log(`🔍 [隔日提醒] 發現今天已發送的提醒: ${r.courseName} (發送時間: ${r.sentAt})`);
      }
      return isToday;
    });
    
    if (hasSentToday) {
      console.log(`⏰ 隔日提醒今天已經發送過（${today}），跳過重複觸發`);
      this.lastTomorrowReminder = today; // ✅ 修復：確保設置內存標記
      return;
    }
    
    // 檢查今天是否已經觸發過隔日提醒（內存檢查，作為第二層防護）
    if (this.lastTomorrowReminder === today) {
      console.log(`⏰ 隔日提醒今天已經觸發過（${today}），跳過重複觸發`);
      return;
    }
    
    // 檢查是否在指定的小時和分鐘範圍內
    const isInTriggerWindow = (currentHour === tomorrowReminderHour && 
                              currentMinute >= tomorrowReminderMinute && 
                              currentMinute <= (tomorrowReminderMinute + tomorrowReminderDuration - 1));
    
    // ⭐ 修復：如果已經過了觸發窗口超過1小時，不再發送（避免重啟後重複發送）
    const minutesSinceTrigger = (currentHour * 60 + currentMinute) - (tomorrowReminderHour * 60 + tomorrowReminderMinute + tomorrowReminderDuration);
    
    if (!isInTriggerWindow) {
      if (minutesSinceTrigger > 60) {
        console.log(`⏰ 已過隔日提醒時間超過1小時（${Math.floor(minutesSinceTrigger)}分鐘），跳過發送以避免重複（${today}）`);
        this.lastTomorrowReminder = today; // ✅ 修復：確保設置內存標記
        return;
      } else if (minutesSinceTrigger < 0) {
        console.log(`⏰ 未到隔日提醒時間（每天${tomorrowReminderHour}:${tomorrowReminderMinute}-${tomorrowReminderHour}:${tomorrowReminderMinute + tomorrowReminderDuration - 1}），跳過`);
        return;
      }
    }
    
    console.log(`📅 開始處理隔日提醒（${today}）...`);
    
    // ✅ 修復：在發送前立即設置內存標記，防止異步操作期間的競態條件
    this.lastTomorrowReminder = today;
    
    await this.processRemindersByType('tomorrow', '隔日提醒');
  }

  // 處理課前提醒
  async processBeforeClassReminders() {
    await this.processRemindersByType('before-class', '課前提醒');
  }

  // 處理重試提醒
  async processRetryReminders() {
    try {
      console.log('🔄 處理重試提醒...');
      const remindersData = this.loadReminders();
      const now = new Date();
      const taiwanNow = this.getTaiwanTime();
      
      // ✅ P0-8修復：獲取行事曆事件並建立索引
      const events = await this.getCalendarEvents();
      const eventMap = new Map();
      const uidMap = new Map();  // ✅ 優化：新增 UID 索引
      
      events.forEach(e => {
        // 原來的 key（兼容舊數據）
        const key = `${e.instructor}_${e.title}_${e.start.split('T')[0]}`;
        eventMap.set(key, e);
        
        // ✅ 優化：UID 索引
        if (e.uid) {
          uidMap.set(e.uid, e);
        }
      });
      console.log(`📊 重試檢查：已建立 ${eventMap.size} 個事件索引（UID 索引: ${uidMap.size}）`);
      
      const retryReminders = [];
      let expiredCount = 0;
      let cancelledCount = 0;
      
      // 檢查每個 pending-retry 提醒
      for (const reminder of remindersData.reminders) {
        if (reminder.status !== 'pending-retry') continue;
        if (!reminder.nextRetryTime) continue;
        if (new Date(reminder.nextRetryTime) > now) continue;
        
        // ✅ P0-8修復 + 優化：檢查課程是否仍在行事曆中（優先使用 UID）
        let matchingEvent = null;
        
        if (reminder.uid && uidMap.has(reminder.uid)) {
          // 使用 UID 精確匹配
          matchingEvent = uidMap.get(reminder.uid);
          console.log(`🎯 重試檢查使用 UID 精確匹配: ${reminder.courseName}`);
        } else {
          // Fallback：使用名稱匹配（兼容沒有 UID 的舊提醒）
          const key = `${reminder.teacherName}_${reminder.courseName}_${reminder.courseDate}`;
          matchingEvent = eventMap.get(key);
        }
        
        if (!matchingEvent) {
          console.log(`🗑️ 取消重試（課程已刪除）: ${reminder.courseName} - ${reminder.teacherName}`);
          reminder.status = 'cancelled';
          reminder.error = '行事曆已刪除此課程（取消重試）';
          reminder.cancelledAt = new Date().toISOString();
          cancelledCount++;
          continue;
        }
        
        // ✨ 檢查課程時間是否已過
        if (reminder.courseDate && reminder.courseTime) {
          const [hour, minute] = reminder.courseTime.split(':');
          const courseDateTime = new Date(reminder.courseDate);
          courseDateTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
          
          // 課程結束後 30 分鐘內都不再重試
          const minutesSinceCourse = (taiwanNow - courseDateTime) / (1000 * 60);
          
          if (minutesSinceCourse > 30) {
            console.log(`⏭️ 跳過已過期的課程重試: ${reminder.courseName} (${reminder.courseDate} ${reminder.courseTime})`);
            reminder.status = 'expired';
            reminder.error = '課程時間已過';
            expiredCount++;
            continue;
          }
        }
        
        retryReminders.push(reminder);
      }
      
      console.log(`🔄 找到 ${retryReminders.length} 個需要重試的提醒`);
      if (cancelledCount > 0) {
        console.log(`🗑️ 已取消 ${cancelledCount} 個已刪除課程的重試`);
      }
      if (expiredCount > 0) {
        console.log(`⏭️ 已標記 ${expiredCount} 個過期提醒為 expired`);
      }
      
      for (const reminder of retryReminders) {
        // 恢復為 pending 狀態以便重新發送
        reminder.status = 'pending';
        console.log(`🔄 重試提醒: ${reminder.courseName} - ${reminder.teacherName} (第 ${reminder.retryCount} 次重試)`);
        await this.sendReminder(reminder);
        
        // 增加發送間隔
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      // 保存更新（包括標記為 expired 的提醒）
      if (expiredCount > 0 || retryReminders.length > 0) {
        this.saveReminders(remindersData);
      }
      
      if (retryReminders.length > 0) {
        console.log(`✅ 完成處理 ${retryReminders.length} 個重試提醒`);
      }
    } catch (error) {
      console.error('❌ 處理重試提醒失敗:', error);
    }
  }

  // 處理學生提醒
  async processStudentReminders() {
    // ✅ 新增：文件鎖機制，防止重複觸發
    const lockFile = path.join(__dirname, 'data', 'student-reminders.lock');
    
    try {
      console.log('👨‍🎓 處理學生提醒...');
      
      // ✅ 檢查鎖文件是否存在
      if (fs.existsSync(lockFile)) {
        const lockTime = fs.statSync(lockFile).mtime;
        const now = new Date();
        const diffMinutes = (now - lockTime) / (1000 * 60);
        
        if (diffMinutes < 10) {
          console.log('🔒 學生提醒正在處理中（鎖文件存在），跳過重複觸發');
          console.log(`   鎖文件創建時間: ${lockTime.toISOString()}`);
          console.log(`   已存在時間: ${Math.floor(diffMinutes)} 分鐘`);
          return;
        } else {
          console.log(`⚠️ 鎖文件已過期（超過 ${Math.floor(diffMinutes)} 分鐘），刪除並繼續`);
          fs.unlinkSync(lockFile);
        }
      }
      
      // ✅ 創建鎖文件
      fs.writeFileSync(lockFile, JSON.stringify({
        timestamp: new Date().toISOString(),
        process: 'processStudentReminders'
      }));
      console.log('🔒 已創建學生提醒處理鎖');
      
      // 重新載入學生提醒設定，確保使用最新設定
      await this.loadStudentReminderSettings();
      
      // 檢查學生提醒是否啟用
      if (!this.studentReminderSettings?.enabled) {
        console.log('⏰ 學生提醒功能已停用，跳過');
        return;
      }
      
      // 檢查是否到了學生提醒時間（每天19:30-19:35執行）
      // 使用台灣時區 (UTC+8)
      const taiwanTime = this.getTaiwanTime();
      
      // ✅ 修復：getTaiwanTime() 返回的是 UTC 時間對象，需要使用 getUTCHours/getUTCMinutes
      const currentHour = taiwanTime.getUTCHours();
      const currentMinute = taiwanTime.getUTCMinutes();
      
      // 檢查是否到了學生提醒時間（每天特定時間執行）
      const studentReminderHour = this.studentReminderSettings?.hour || 19;
      const studentReminderMinute = this.studentReminderSettings?.minute || 30;
      const studentReminderDuration = this.studentReminderSettings?.duration || 15 // 15分鐘執行窗口
      
      // 計算執行窗口的結束時間
      const endHour = Math.floor((studentReminderMinute + studentReminderDuration) / 60) + studentReminderHour;
      const endMinute = (studentReminderMinute + studentReminderDuration) % 60;
      
      // 詳細調試日誌
      console.log(`🔍 [學生提醒時間檢查]`);
      console.log(`   當前時間: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
      console.log(`   執行窗口: ${studentReminderHour}:${studentReminderMinute.toString().padStart(2, '0')} - ${endHour}:${endMinute.toString().padStart(2, '0')}`);
      console.log(`   執行時長: ${studentReminderDuration} 分鐘`);
      
    // 檢查是否在指定的時間範圍內
    const isInTimeWindow = 
      (currentHour === studentReminderHour && currentMinute >= studentReminderMinute) ||
      (currentHour === endHour && currentMinute < endMinute) ||
      (currentHour > studentReminderHour && currentHour < endHour);
    
    if (!isInTimeWindow) {
      // 判斷是未到還是已過
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      const startTimeInMinutes = studentReminderHour * 60 + studentReminderMinute;
      const endTimeInMinutes = endHour * 60 + endMinute;
      
      if (currentTimeInMinutes < startTimeInMinutes) {
        console.log(`⏰ 未到學生提醒時間（執行窗口: ${studentReminderHour}:${studentReminderMinute.toString().padStart(2, '0')}-${endHour}:${endMinute.toString().padStart(2, '0')}），跳過`);
      } else {
        console.log(`⏰ 已過學生提醒時間（執行窗口: ${studentReminderHour}:${studentReminderMinute.toString().padStart(2, '0')}-${endHour}:${endMinute.toString().padStart(2, '0')}），跳過`);
      }
      return;
    }
    
    console.log(`✅ 當前時間在學生提醒執行窗口內，繼續處理...`);
    
    // ⭐ 修復：從數據文件檢查今天是否已經發送過學生提醒（持久化檢查）
    const today = this.getTaiwanDateString();
    const tomorrowDate = this.getTomorrowDateString();
    const remindersDataCheck = this.loadReminders();
    
    // ✅ 關鍵修復：檢查是否有「今天發送」的學生提醒（不只是 sent 狀態，還要確認發送日期是今天）
    const studentRemindersToday = remindersDataCheck.studentReminders?.filter(r => {
      if (r.courseDate !== tomorrowDate) return false; // 學生提醒是針對明天的課程
      if ((r.status !== 'sent' && r.status !== 'completed') || !r.sentAt) return false;
      
      // 檢查 sentAt 的日期是否為今天
      const sentDate = new Date(r.sentAt).toISOString().split('T')[0];
      const isToday = sentDate === today;
      if (isToday) {
        console.log(`🔍 [學生提醒] 發現今天已發送的提醒: ${r.studentName} - ${r.courseName} (發送時間: ${r.sentAt})`);
      }
      return isToday;
    }) || [];
    
    if (studentRemindersToday.length > 0) {
      console.log(`⏰ 學生提醒今天已經發送過（${today}，針對明天${tomorrowDate}的課程），跳過重複觸發`);
      console.log(`📊 今天已發送的學生提醒數量: ${studentRemindersToday.length}`);
      this.lastStudentReminder = today; // ✅ 修復：確保設置內存標記
      return;
    }
    
    console.log(`✅ [學生提醒] 確認今天尚未發送過（${today}），可以繼續處理`);
    
    // 檢查今天是否已經觸發過學生提醒（內存檢查，作為第二層防護）
    if (this.lastStudentReminder === today) {
      console.log(`⏰ 學生提醒今天已經觸發過（內存檢查，${today}），跳過重複觸發`);
      return;
    }
    
    console.log(`👨‍🎓 開始處理學生提醒（${today}）...`);
    
    // ✅ 修復：在發送前立即設置內存標記，防止異步操作期間的競態條件
    this.lastStudentReminder = today;
      
      // 載入已存在的學生提醒（不重新生成）
      const remindersData = this.loadReminders();
      const studentReminders = remindersData.studentReminders || [];
      
      // ⭐ 修復：先標記已結束課程的學生提醒為 expired
      const nowUTC = new Date();
      let expiredCount = 0;
      
      studentReminders.forEach(reminder => {
        if (reminder.status === 'pending' && reminder.courseDate && reminder.courseTime) {
          try {
            // ✅ 正確時區轉換：解析為台灣時間（UTC+8）
            const [year, month, day] = reminder.courseDate.split('-').map(Number);
            const [hour, minute] = reminder.courseTime.split(':').map(Number);
            // ✅ 使用正確的台灣時區轉換
            const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
            const courseTimeUTC = new Date(taiwanTimeStr);
            
            // 課程結束後30分鐘就標記為過期（不再發送學生提醒）
            const minutesSinceCourse = (nowUTC - courseTimeUTC) / (1000 * 60);
            
            if (minutesSinceCourse > 30) {
              console.log(`⏭️ 跳過已結束課程的學生提醒: ${reminder.studentName} - ${reminder.courseName} (課程已結束 ${Math.floor(minutesSinceCourse)} 分鐘)`);
              reminder.status = 'expired';
              reminder.error = '課程已結束';
              expiredCount++;
            }
          } catch (error) {
            console.error(`⚠️ 解析學生提醒課程時間失敗: ${reminder.courseName} - ${error.message}`);
          }
        }
      });
      
      // 立即保存 expired 狀態
      if (expiredCount > 0) {
        this.saveReminders(remindersData);
        console.log(`💾 已標記並保存 ${expiredCount} 個過期學生提醒`);
      }
      
      // 篩選出待發送的學生提醒（排除已過期的）
      const pendingStudentReminders = studentReminders.filter(reminder => 
        reminder.status === 'pending' && 
        new Date(reminder.scheduledTime) <= nowUTC
      );
      
      if (pendingStudentReminders.length === 0) {
        console.log('📝 沒有需要發送的學生提醒');
        return;
      }
      
      console.log(`📝 找到 ${pendingStudentReminders.length} 個待發送的學生提醒`);
      
      // ⭐ 新增：發送前重新驗證學生請假狀態
      console.log('🔍 發送前重新驗證學生請假狀態...');
      const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
      const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
      const students = studentData.students || [];
      
      // 過濾出確認可以發送的提醒（重新檢查請假狀態）
      const validReminders = [];
      const cancelledReminders = [];
      
      for (const reminder of pendingStudentReminders) {
        // 找到對應的學生
        const student = students.find(s => s.name === reminder.studentName);
        
        if (!student) {
          console.log(`⚠️ 找不到學生資料: ${reminder.studentName}，保留提醒`);
          validReminders.push(reminder);
          continue;
        }
        
        // 檢查該日期是否請假
        const courseDate = reminder.courseDate;
        const attendanceRecord = student.attendance?.find(a => a.date === courseDate);
        
        if (attendanceRecord && (attendanceRecord.present === false || attendanceRecord.present === 'leave')) {
          console.log(`❌ 學生 ${reminder.studentName} 在 ${courseDate} 請假，取消發送提醒`);
          reminder.status = 'cancelled';
          reminder.cancelReason = '學生請假';
          reminder.cancelledAt = new Date().toISOString();
          cancelledReminders.push(reminder);
        } else {
          validReminders.push(reminder);
        }
      }
      
      // 保存取消的提醒狀態
      if (cancelledReminders.length > 0) {
        console.log(`🚫 取消 ${cancelledReminders.length} 個提醒（學生請假）`);
        this.saveReminders(remindersData);
      }
      
      if (validReminders.length === 0) {
        console.log('📝 沒有需要發送的學生提醒（全部已取消）');
        return;
      }
      
      console.log(`✅ 確認可發送 ${validReminders.length} 個學生提醒`);
      
      // 發送學生提醒
      const results = await this.sendStudentReminders(validReminders);
      
      // 通知管理員結果
      await this.notifyAdminStudentReminderResults(results);
      
    } catch (error) {
      console.error('❌ 處理學生提醒失敗:', error);
    } finally {
      // ✅ 釋放鎖文件
      const lockFile = path.join(__dirname, 'data', 'student-reminders.lock');
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
        console.log('🔓 已釋放學生提醒處理鎖');
      }
    }
  }

  // 生成學生提醒
  async generateStudentReminders() {
    try {
      console.log('🔄 開始生成學生提醒...');
      
      // 載入已存在的學生提醒
      const remindersData = this.loadReminders();
      const existingStudentReminders = remindersData.studentReminders || [];
      
      // 載入正式學生資料
      const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
      const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
      let students = studentData.students || [];
      
      console.log(`📚 載入 ${students.length} 位正式學生資料`);
      
      // ✅ 新增：載入臨時學生資料（體驗課、補課學生）
      const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
      let temporaryStudents = [];
      
      if (fs.existsSync(tempDataPath)) {
        try {
          const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
          const now = new Date();
          
          // 過濾掉過期的臨時學生
          temporaryStudents = tempData.students.filter(s => {
            if (!s.expiryDate) return true; // 沒有過期日期的保留
            const expiry = new Date(s.expiryDate + 'T23:59:59');
            return expiry >= now;
          });
          
          console.log(`📚 載入 ${temporaryStudents.length} 位臨時學生（體驗/補課）`);
          
          // ✅ 處理臨時學生的 userId
          const studentMap = new Map();
          students.forEach(student => {
            if (student.name) {
              studentMap.set(student.name, student);
            }
          });
          
          temporaryStudents = temporaryStudents.map(tempStudent => {
            const processed = { ...tempStudent };
            
            // 如果是補課學生且沒有userId，從正式學生中獲取
            if (processed.type === 'makeup' && !processed.userId) {
              const regularStudent = studentMap.get(processed.name);
              if (regularStudent && regularStudent.userId) {
                processed.userId = regularStudent.userId;
                console.log(`🔄 補課學生自動獲取userId: ${processed.name} → ${processed.userId}`);
              }
            }
            
            // 標記為臨時學生
            processed.isTemporary = true;
            processed.temporaryType = processed.type; // 保留類型（trial/makeup）
            
            return processed;
          });
          
          // ✅ 合併學生列表
          students = [...students, ...temporaryStudents];
          console.log(`📚 總學生數（正式+臨時）: ${students.length}`);
        } catch (error) {
          console.error('⚠️ 載入臨時學生失敗:', error);
        }
      } else {
        console.log('ℹ️ 沒有臨時學生資料檔案，僅使用正式學生');
      }
      
      // 載入行事曆事件
      const events = await this.getCalendarEvents();
      
      // 使用台灣時區 (UTC+8)
      const taiwanTime = this.getTaiwanTime();
      
      const today = new Date(taiwanTime);
      const tomorrow = new Date(taiwanTime);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      
      // 篩選今天和明天的課程事件
      const relevantEvents = events.filter(event => {
        const eventDate = event.start.split('T')[0];
        return eventDate === todayStr || eventDate === tomorrowStr;
      });
      
      console.log(`📅 相關課程事件（今天+明天）: ${relevantEvents.length}`);
      console.log(`📅 今天: ${todayStr}, 明天: ${tomorrowStr}`);
      
      // 只為明天的課程生成學生提醒（學生提醒在課程前一天發送）
      const tomorrowEvents = events.filter(event => {
        const eventDate = event.start.split('T')[0];
        return eventDate === tomorrowStr;
      });
      
      console.log(`📅 明天課程事件（需要生成學生提醒）: ${tomorrowEvents.length}`);
      
      const newStudentReminders = [];
      
      for (const event of tomorrowEvents) {
        console.log(`🔍 處理事件: ${event.title}`);
        
        // 檢查是否包含跳過關鍵字
        const skipKeywords = this.systemSettings?.skipKeywords?.keywords || ['停課', '請假'];
        const skipEnabled = this.systemSettings?.skipKeywords?.enabled !== false;
        
        if (skipEnabled && skipKeywords.length > 0) {
          const hasSkipKeyword = skipKeywords.some(keyword => event.title.includes(keyword));
          
          if (hasSkipKeyword) {
            console.log(`⏭️ 跳過學生提醒 - 行事曆標題包含跳過關鍵字: ${event.title}`);
            continue; // 跳過此事件
          }
        }
        
        // 解析課程標題
        const parsed = this.parseCourseTitle(event.title);
        console.log(`📝 解析結果: 課程="${parsed.courseName}", 時間資訊="${parsed.timeInfo}", 特殊字樣=${parsed.hasSpecialKeyword}`);
        
        // 獲取課程日期
        const courseDate = event.start.split('T')[0];
        
        // 尋找匹配的學生
        const matchedStudents = this.findMatchingStudents(students, parsed, event, courseDate);
        console.log(`📚 課程 ${event.title} 找到 ${matchedStudents.length} 位學生`);
        
        // 為每個匹配的學生創建提醒
        for (const student of matchedStudents) {
          if (!student.userId || student.userId.trim() === '') {
            console.log(`⚠️ 學生 ${student.name} 沒有 LINE User ID，跳過提醒`);
            continue;
          }
          
          // ⭐ 檢查 1: 是否已經存在相同的學生提醒（從檔案載入的）
          // ✅ 優化：優先使用 UID 檢查重複
          const existingReminder = existingStudentReminders.find(r => {
            if (event.uid && r.uid) {
              // 使用 UID + 學生名稱精確匹配（編輯課程標題後仍能識別）
              return r.uid === event.uid && r.studentName === student.name;
            } else {
              // Fallback：名稱匹配（兼容沒有 UID 的舊提醒）
              return r.studentName === student.name &&
                     r.courseName === event.title &&
                     r.courseDate === courseDate;
            }
          });
          
          if (existingReminder) {
            console.log(`⏭️ 學生提醒已存在（從文件載入）: ${student.name} - ${event.title}`);
            continue;
          }
          
          // ⭐ 檢查 2: 是否在本次執行中已經創建過相同的提醒（防止重複）
          // ✅ 優化：優先使用 UID 檢查重複
          const newReminder = newStudentReminders.find(r => {
            if (event.uid && r.uid) {
              return r.uid === event.uid && r.studentName === student.name;
            } else {
              return r.studentName === student.name &&
                     r.courseName === event.title &&
                     r.courseDate === courseDate;
            }
          });
          
          if (newReminder) {
            console.log(`⏭️ 學生提醒已存在（本次已創建）: ${student.name} - ${event.title}`);
            continue;
          }
          
          const reminder = await this.createStudentReminder(student, event, parsed, courseDate);
          newStudentReminders.push(reminder);
          console.log(`✅ 為學生 ${student.name} 創建提醒`);
        }
      }
      
      // ✅ 優化 5：建立行事曆事件索引（性能優化）
      console.log('🔍 建立行事曆事件索引（學生提醒）...');
      const eventMap = new Map();
      const uidMap = new Map();  // ✅ 新增：UID 索引（用於精確匹配）
      
      events.forEach(e => {
        // 原來的 key（兼容舊數據）
        const key = `${e.title}_${e.start.split('T')[0]}`;
        eventMap.set(key, e);
        
        // ✅ 新增：UID 索引
        if (e.uid) {
          uidMap.set(e.uid, e);
        }
      });
      console.log(`📊 索引建立完成：${eventMap.size} 個事件（UID 索引: ${uidMap.size}）`);
      
      // ✅ 反向檢查 - 取消/更新/恢復學生提醒
      console.log('🔍 檢查課程變更（學生提醒）...');
      let cancelledStudentCount = 0;
      let updatedStudentCount = 0;
      let restoredStudentCount = 0;
      
      const skipKeywords = this.systemSettings?.skipKeywords?.keywords || ['停課', '請假'];
      const skipEnabled = this.systemSettings?.skipKeywords?.enabled !== false;
      
      for (const reminder of existingStudentReminders) {
        // 跳過已發送的提醒（不處理）
        if (reminder.status === 'sent' || reminder.status === 'completed') continue;
        
        // ✅ 優先使用 UID 匹配（精確匹配編輯後的事件）
        let matchingEvent = null;
        
        if (reminder.uid && uidMap.has(reminder.uid)) {
          // 使用 UID 精確匹配
          matchingEvent = uidMap.get(reminder.uid);
          console.log(`🎯 學生提醒使用 UID 精確匹配: ${reminder.courseName} (UID: ${reminder.uid.substring(0, 20)}...)`);
        } else if (!reminder.uid) {
          // ⚠️ 沒有 UID 的舊提醒，嘗試名稱匹配
          const key = `${reminder.courseName}_${reminder.courseDate}`;
          matchingEvent = eventMap.get(key);
          if (matchingEvent) {
            console.log(`🔍 學生提醒使用名稱匹配（舊數據，無 UID）: ${reminder.courseName}`);
          } else {
            console.log(`⚠️ 無 UID 且無法名稱匹配的學生舊提醒: ${reminder.studentName} - ${reminder.courseName}`);
          }
        }
        
        // === 優化：處理 pending/failed 學生提醒 ===
        if (reminder.status === 'pending' || reminder.status === 'failed') {
          if (!matchingEvent) {
            // 課程已刪除或無法匹配
            const oldStatus = reminder.status;
            reminder.status = 'cancelled';
            
            // ✅ 根據是否有 UID 設置不同的錯誤訊息
            if (!reminder.uid) {
              reminder.error = '舊提醒（無 UID），無法匹配行事曆事件';
            } else {
              reminder.error = '行事曆已刪除此課程';
            }
            
            reminder.cancelledAt = new Date().toISOString();
            cancelledStudentCount++;
            console.log(`🗑️ 取消學生提醒（${reminder.error}，原狀態: ${oldStatus}）: ${reminder.studentName} - ${reminder.courseName} (${reminder.courseDate})`);
          } else {
            // ✅ 檢查停課關鍵字
            if (skipEnabled && skipKeywords.length > 0) {
              const hasSkipKeyword = skipKeywords.some(kw => matchingEvent.title.includes(kw));
              if (hasSkipKeyword) {
                reminder.status = 'cancelled';
                reminder.error = '課程已標記為停課';
                reminder.cancelledAt = new Date().toISOString();
                cancelledStudentCount++;
                console.log(`🗑️ 取消學生提醒（課程停課）: ${reminder.studentName} - ${reminder.courseName} (${reminder.courseDate})`);
                continue;
              }
            }
            
            // ✅ 優化：更新課程時間和其他資訊
            let hasChanges = false;
            
            // ✅ 修復：更新課程名稱（確保編輯標題後不產生重複提醒）
            if (reminder.courseName !== matchingEvent.title) {
              console.log(`🔄 更新學生提醒課程名稱: ${reminder.courseName} → ${matchingEvent.title}`);
              reminder.courseName = matchingEvent.title;
              hasChanges = true;
            }
            
            // 更新課程時間
            const eventTime = matchingEvent.start.split('T')[1]?.substring(0, 5);
            if (eventTime && reminder.courseTime !== eventTime) {
              console.log(`🔄 更新學生提醒課程時間: ${reminder.courseName} ${reminder.courseTime} → ${eventTime}`);
              reminder.courseTime = eventTime;
              hasChanges = true;
            }
            
            // ✅ 優化：更新地點資訊
            const newLocation = this.mapAddress(matchingEvent.location || '未設定地點');
            if (reminder.location !== newLocation) {
              console.log(`   更新學生提醒地點: ${reminder.location} → ${newLocation}`);
              reminder.location = newLocation;
              reminder.googleMapsUrl = newLocation && newLocation !== '未設定地點' ?
                `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(newLocation)}` : '';
              hasChanges = true;
            }
            
            // ✅ 優化：更新教案連結
            const description = matchingEvent.description || '';
            const notionMatch = description.match(/\(https:\/\/www\.notion\.so\/([^)]+)\)/) || 
                                description.match(/https:\/\/www\.notion\.so\/([^)\s]+)/);
            if (notionMatch) {
              const newLessonPlanUrl = `https://www.notion.so/${notionMatch[1]}`;
              if (reminder.lessonPlanUrl !== newLessonPlanUrl) {
                console.log(`   更新學生提醒教案連結`);
                reminder.lessonPlanUrl = newLessonPlanUrl;
                reminder.description = description;
                hasChanges = true;
              }
            }
            
            if (hasChanges) {
              reminder.updatedAt = new Date().toISOString();
              updatedStudentCount++;
              
              // ✅ 修復：重新生成 message（包含更新後的課程名稱和資訊）
              try {
                const eventDate = matchingEvent.start.split('T')[0];
                const weekdayMap = { '0': '週日', '1': '週一', '2': '週二', '3': '週三', '4': '週四', '5': '週五', '6': '週六' };
                const weekday = weekdayMap[new Date(matchingEvent.start).getUTCDay()];
                
                reminder.message = await this.generateStudentReminderMessage(
                  reminder.studentName,
                  matchingEvent.title,
                  eventDate,
                  eventTime || reminder.courseTime,
                  matchingEvent
                );
                reminder.weekday = weekday;
                console.log(`   ✅ 已重新生成學生提醒訊息（包含新的課程名稱）`);
              } catch (error) {
                console.error(`   ⚠️ 重新生成學生提醒訊息失敗:`, error);
              }
            }
          }
        }
        
        // === 優化 3：處理 cancelled 學生提醒（自動恢復） ===
        else if (reminder.status === 'cancelled') {
          // 檢查課程是否已恢復
          if (matchingEvent) {
            // 檢查是否不再有停課關鍵字
            const hasSkipKeyword = skipEnabled && skipKeywords.some(kw => matchingEvent.title.includes(kw));
            
            if (!hasSkipKeyword) {
              // 恢復學生提醒
              reminder.status = 'pending';
              delete reminder.error;
              delete reminder.cancelledAt;
              reminder.restoredAt = new Date().toISOString();
              restoredStudentCount++;
              console.log(`♻️ 恢復學生提醒（課程已恢復）: ${reminder.studentName} - ${reminder.courseName} (${reminder.courseDate})`);
            }
          }
        }
      }
      
      // 輸出統計
      if (cancelledStudentCount > 0) {
        console.log(`✅ 已取消 ${cancelledStudentCount} 個學生提醒`);
      }
      if (updatedStudentCount > 0) {
        console.log(`✅ 已更新 ${updatedStudentCount} 個學生提醒的課程時間`);
      }
      if (restoredStudentCount > 0) {
        console.log(`✅ 已恢復 ${restoredStudentCount} 個學生提醒`);
      }
      
      // 合併新提醒和已存在的提醒
      const allStudentReminders = [...existingStudentReminders, ...newStudentReminders];
      
      // 更新提醒資料
      remindersData.studentReminders = allStudentReminders;
      this.saveReminders(remindersData);
      
      // 儲存學生提醒到後端
      if (newStudentReminders.length > 0) {
        await this.saveStudentRemindersToBackend(newStudentReminders);
      }
      
      console.log(`🎯 總共生成 ${newStudentReminders.length} 個新學生提醒，總計 ${allStudentReminders.length} 個學生提醒`);
      return allStudentReminders;
      
    } catch (error) {
      console.error('❌ 生成學生提醒失敗:', error);
      return [];
    }
  }

  // 解析課程標題
  parseCourseTitle(title) {
    const parsed = CourseTitleParser.parse(title);
    console.log(`📝 解析結果:`, parsed);
    return parsed;
  }

  // 尋找匹配的學生 (透過共用模組)
  findMatchingStudents(students, parsed, event, courseDate) {
    // ✅ 與前端統一：讀取學生篩選配置（minRemainingClasses / enableRemainingCheck / showInCurrentWeek）
    const configPath = path.join(__dirname, 'data', 'student-filter-config.json');
    let filterConfig = {
      debugMode: false,
      minRemainingClasses: 0,
      enableRemainingCheck: true,
      showInCurrentWeek: true
    };
    try {
      if (fs.existsSync(configPath)) {
        filterConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
    } catch (e) {
      console.warn('⚠️ 載入學生篩選配置失敗，使用預設值:', e.message);
    }

    const normalizeCourse = (s) => String(s || '').trim().replace(/\s+/g, '').toLowerCase();
    const sharedMatcher = (CourseStudentMatcher && typeof CourseStudentMatcher.normalizeTimeFormat === 'function') ? CourseStudentMatcher : null;
    const normalizeTimeFormat = (timeStr) => {
      if (sharedMatcher) {
        return sharedMatcher.normalizeTimeFormat(timeStr);
      }
      if (!timeStr) return '';
      return String(timeStr)
        .replace(/\s*第[一二三四五六七八九十\d]+[周週]\s*/gi, '')
        .replace(/\s*Week\s*\d+\s*/gi, '')
        .replace(/\s*week\s*\d+\s*/gi, '')
        .replace(/\s+/g, '')
        .toLowerCase()
        .replace(/(\d{1,2}):(\d{2})/g, (m, h, m2) => String(h).padStart(2, '0') + String(m2));
    };
    const getDefaultKeywords = () => ({
      allKeywords: ['停課','取消','暫停','休息','放假','請假','體驗','體驗課','體驗班','代課','代理','支援','補課','調課','延後','提前','改時間'],
      byType: {}
    });
    const extractBaseTime = (timeStr, specialKeywords) => {
      let result = String(timeStr || '');
      // 去掉前綴的課程英文/數字直到星期字樣
      result = result.replace(/^[A-Za-z0-9\s]+(?=[一二三四五六日]|$)/, '');
      result = result.replace(/\s*第\d+[周週]\s*/g, '');
      if (specialKeywords && specialKeywords.allKeywords && specialKeywords.allKeywords.length) {
        const keywordsPattern = specialKeywords.allKeywords.map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const regex = new RegExp(`\
\s*(${keywordsPattern})\s*$`, 'gi');
        result = result.replace(regex, '');
      }
      return result.replace(/\s+$/, '');
    };
    const specialKeywords = getDefaultKeywords();

    const courseName = parsed?.course || parsed?.courseName || '';
    const targetTime = parsed?.period || parsed?.timeInfo || '';
    const normalizedCourse = normalizeCourse(courseName);
    const cleanTargetTime = normalizeTimeFormat(targetTime);
    const baseTargetTime = extractBaseTime(cleanTargetTime, specialKeywords);

    // ✅ 先做基本資格過濾（剩餘堂數、當日請假、臨時學生日期檢查）
    const eligibleStudents = students.filter(student => {
      const remaining = Number(student.remaining || 0);
      if (filterConfig.enableRemainingCheck) {
        if (remaining < Number(filterConfig.minRemainingClasses || 0)) {
          console.log(`❌ 學生 ${student.name} 剩餘堂數不足: ${remaining} < ${filterConfig.minRemainingClasses}`);
          return false;
        }
      }

      // ✅ 檢查臨時學生（體驗課/補課）的 scheduledDate 是否與課程日期匹配
      // ⚠️ 後端提醒系統：始終使用嚴格檢查，確保提醒只在正確日期發送
      // 💡 與前端不同：前端顯示模式可以提前看到所有學生（備課用），但提醒必須精確
      if (student.isTemporary && student.scheduledDate) {
        if (student.scheduledDate !== courseDate) {
          if (filterConfig.debugMode) {
            console.log(`❌ 臨時學生 ${student.name} 的排定日期 ${student.scheduledDate} 與課程日期 ${courseDate} 不符，跳過提醒`);
          }
          return false;
        }
        if (filterConfig.debugMode) {
          console.log(`✅ 臨時學生 ${student.name} 的排定日期 ${student.scheduledDate} 與課程日期 ${courseDate} 匹配，可發送提醒`);
        }
      }

      if (Array.isArray(student.attendance)) {
        const attendanceRecord = student.attendance.find(a => a.date === courseDate);
        if (attendanceRecord && (attendanceRecord.present === false || attendanceRecord.present === 'leave')) {
          console.log(`❌ 學生 ${student.name} 在 ${courseDate} 請假，跳過`);
          return false;
        }
      }
      return true;
    });

    // ✅ 使用與前端相同的課程/時間比對策略（沒有 period → 一律不匹配）
    const matched = eligibleStudents.filter(student => {
      // 課程名稱比對（含 period 前綴容錯）
      const studentCourse = normalizeCourse(student.course || student.courseName || '');
      let courseMatch = studentCourse === normalizedCourse;
      if (!courseMatch && student.period) {
        const periodNorm = normalizeCourse(student.period);
        if (periodNorm.startsWith(normalizedCourse)) {
          courseMatch = true;
        }
        if (!courseMatch && normalizedCourse.startsWith(studentCourse) && periodNorm.startsWith(normalizedCourse)) {
          courseMatch = true;
        }
      }
      if (!courseMatch) return false;

      // 時間比對（需有學生 period 才能比對）
      if (!student.period) return false; // ✅ 重點：無時段的學生不生成提醒

      let timeMatch = false;
      if (sharedMatcher && typeof sharedMatcher.isTimeMatch === 'function' && targetTime) {
        timeMatch = sharedMatcher.isTimeMatch(student.period, targetTime);
      } else {
        const cleanStudentPeriod = normalizeTimeFormat(student.period);
        const baseStudentPeriod = extractBaseTime(cleanStudentPeriod, specialKeywords);

        const exactMatch = cleanStudentPeriod === cleanTargetTime;
        const startsWith = cleanStudentPeriod && cleanTargetTime && cleanStudentPeriod.startsWith(cleanTargetTime) && cleanStudentPeriod.length > cleanTargetTime.length;
        const baseMatch = baseStudentPeriod && baseTargetTime && baseStudentPeriod === baseTargetTime;
        timeMatch = !!(exactMatch || startsWith || baseMatch);
      }

      if (!timeMatch && filterConfig.debugMode) {
        console.log(`⛔ 時間不匹配: ${student.name} | studentPeriod=${student.period} | target=${targetTime}`);
      }
      return timeMatch;
    });

    console.log(`📚 課程 ${event.title} 統一篩選後符合學生數: ${matched.length}`);
    return matched;
  }

  // 匹配時間資訊
  matchTimeInfo(studentPeriod, targetTimeInfo) {
    console.log(`🔍 開始時間匹配: 學生=${studentPeriod}, 目標=${targetTimeInfo}`);
    
    if (!studentPeriod || !targetTimeInfo) {
      console.log('❌ 時間資訊為空');
      return false;
    }
    
    if (CourseStudentMatcher && typeof CourseStudentMatcher.isTimeMatch === 'function') {
      const result = CourseStudentMatcher.isTimeMatch(studentPeriod, targetTimeInfo);
      console.log(`⏰ 共用模組時間匹配結果: ${result}`);
      return result;
    }
    
    // fallback 舊邏輯
    const normalizeTimeFormat = (timeStr) => {
      if (!timeStr) return '';
      
      let normalized = timeStr
        .replace(/\s*第[一二三四五六七八九十\d]+週\s*/gi, '')
        .replace(/\s*Week\s*\d+\s*/gi, '')
        .replace(/\s*week\s*\d+\s*/gi, '')
        .replace(/\s+/g, ' ')  // 保留單個空格，用於後續處理
        .trim();
      
      // 將 HH:MM-HH:MM 格式統一轉換為 HHMM-HHMM
      normalized = normalized.replace(/(\d{1,2}):(\d{2})/g, (match, h, m) => {
        return h.padStart(2, '0') + m;
      });
      
      return normalized.toLowerCase();
    };
    
    const cleanStudentPeriod = normalizeTimeFormat(studentPeriod);
    const cleanTargetTime = normalizeTimeFormat(targetTimeInfo);
    
    console.log(`🧹 標準化後: 學生="${cleanStudentPeriod}", 目標="${cleanTargetTime}"`);
    
    // 提取星期
    const studentWeekdays = cleanStudentPeriod.match(/[一二三四五六日]/g) || [];
    const targetWeekdays = cleanTargetTime.match(/[一二三四五六日]/g) || [];
    console.log(`📅 星期: 學生=[${studentWeekdays}], 目標=[${targetWeekdays}]`);
    
    // 檢查星期匹配
    const weekdayMatch = targetWeekdays.some(day => studentWeekdays.includes(day));
    console.log(`📅 星期匹配: ${weekdayMatch}`);
    if (!weekdayMatch) return false;
    
    // 提取時間部分（移除星期和地點等）
    const extractTimePart = (timeStr) => {
      // 匹配時間範圍格式 HHMM-HHMM
      const timeMatch = timeStr.match(/(\d{4})-(\d{4})/);
      return timeMatch ? `${timeMatch[1]}-${timeMatch[2]}` : '';
    };
    
    const studentTimePart = extractTimePart(cleanStudentPeriod);
    const targetTimePart = extractTimePart(cleanTargetTime);
    
    console.log(`⏰ 時間部分: 學生="${studentTimePart}", 目標="${targetTimePart}"`);
    
    // 時間匹配
    if (studentTimePart && targetTimePart) {
      const timeMatch = studentTimePart === targetTimePart;
      console.log(`⏰ 時間匹配結果: ${timeMatch}`);
      return timeMatch;
    }
    
    // 如果無法提取時間部分，嘗試完整匹配（移除地點後綴）
    const removeLocation = (timeStr) => {
      return timeStr
        .replace(/\s*(到府|外|內|松山|站前|客製化)\s*$/, '')
        .trim();
    };
    
    const baseStudentPeriod = removeLocation(cleanStudentPeriod);
    const baseTargetTime = removeLocation(cleanTargetTime);
    
    console.log(`🔧 移除地點後: 學生="${baseStudentPeriod}", 目標="${baseTargetTime}"`);
    
    const fallbackMatch = baseStudentPeriod === baseTargetTime || 
                          baseStudentPeriod.includes(baseTargetTime) ||
                          baseTargetTime.includes(baseStudentPeriod);
    
    console.log(`⏰ 備用匹配結果: ${fallbackMatch}`);
    return fallbackMatch;
  }

  // ✅ 優化 1: 統一時間提取邏輯 - 提取時間範圍的通用函數
  extractTimeRange(text) {
    if (!text) return null;
    
    // 優先匹配有冒號格式: "11:00-13:00" 或 "9:30-11:00"
    let match = text.match(/(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/);
    if (match) {
      return {
        startHour: parseInt(match[1]),
        startMinute: parseInt(match[2]),
        endHour: parseInt(match[3]),
        endMinute: parseInt(match[4]),
        format: 'colon',
        raw: match[0]
      };
    }
    
    // 備用：匹配無冒號格式: "1100-1300" 或 "0930-1100"
    match = text.match(/(\d{4})-(\d{4})/);
    if (match) {
      const startTime = match[1].padStart(4, '0');
      const endTime = match[2].padStart(4, '0');
      return {
        startHour: parseInt(startTime.substring(0, 2)),
        startMinute: parseInt(startTime.substring(2, 4)),
        endHour: parseInt(endTime.substring(0, 2)),
        endMinute: parseInt(endTime.substring(2, 4)),
        format: 'plain',
        raw: match[0]
      };
    }
    
    return null;
  }

  // ✅ 優化 2: 計算持續時間（統一函數）
  calculateDuration(text) {
    const timeRange = this.extractTimeRange(text);
    if (!timeRange) {
      console.log(`⚠️ 無法從 "${text}" 提取時間範圍`);
      return 0;
    }
    
    const start = timeRange.startHour * 60 + timeRange.startMinute;
    const end = timeRange.endHour * 60 + timeRange.endMinute;
    const duration = end - start;
    
    console.log(`⏱️ 時間範圍: ${timeRange.raw} → ${duration}分鐘 (${timeRange.format}格式)`);
    return duration;
  }

  // 計算事件持續時間（保持向後兼容）
  calculateEventDuration(eventTitle) {
    return this.calculateDuration(eventTitle);
  }

  // 計算學生課程持續時間（保持向後兼容）
  calculateStudentDuration(studentPeriod) {
    return this.calculateDuration(studentPeriod);
  }

  // 創建學生提醒
  async createStudentReminder(student, event, parsed, courseDate) {
    // 使用台灣時區 (UTC+8)
    const taiwanTime = this.getTaiwanTime();
    
    // 計算學生提醒的發送時間（課程前一天19:30台灣時間）
    // 學生提醒應該在課程前一天發送，提醒隔天的課程
    const studentReminderHour = this.systemSettings?.studentReminders?.defaultHour || 19;
    const studentReminderMinute = this.systemSettings?.studentReminders?.defaultMinute || 30;
    
    // 使用課程日期的前一天來計算學生提醒時間
    const [year, month, day] = courseDate.split('-').map(Number);
    const courseDateObj = new Date(year, month - 1, day);
    const reminderDateObj = new Date(courseDateObj.getTime() - (24 * 60 * 60 * 1000)); // 前一天
    
    // ✅ 正確方法：創建台灣時間字串並轉換為 UTC
    const reminderYear = reminderDateObj.getFullYear();
    const reminderMonth = reminderDateObj.getMonth() + 1;
    const reminderDay = reminderDateObj.getDate();
    const taiwanTimeStr = `${reminderYear}-${reminderMonth.toString().padStart(2, '0')}-${reminderDay.toString().padStart(2, '0')}T${studentReminderHour.toString().padStart(2, '0')}:${studentReminderMinute.toString().padStart(2, '0')}:00+08:00`;
    const utcTime = new Date(taiwanTimeStr);
    const scheduledTime = utcTime.toISOString();
    
    // 🔥 使用新的地址解析邏輯
    const locationSimple = event.location || '樂程坊';  // 地點簡稱
    const detailedAddress = this.resolveDetailedAddress(student, event);  // 具體地址
    
    // 生成 Google Maps URL（使用具體地址）
    const googleMapsUrl = detailedAddress && detailedAddress.trim() !== '' 
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detailedAddress)}`
      : '';
    
    const description = event.description || '';
    
    // 從描述中提取教案連結
    let lessonPlanUrl = '';
    const notionUrlRegex = /\(https:\/\/www\.notion\.so\/([^)]+)\)/;
    let notionMatch = description.match(notionUrlRegex);
    
    if (!notionMatch) {
      const generalNotionRegex = /https:\/\/www\.notion\.so\/([^)\s]+)/;
      notionMatch = description.match(generalNotionRegex);
    }
    
    if (notionMatch) {
      lessonPlanUrl = `https://www.notion.so/${notionMatch[1]}`;
    }
    
    // 計算星期幾
    const date = new Date(courseDate);
    const weekday = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()];
    
    // ✅ 新增：檢測特殊事件類型（用於學生特殊範本）
    let specialEventType = null;
    
    // 1. 體驗課學生 → studentExperience
    if (student.isTemporary && student.temporaryType === 'trial') {
      specialEventType = '體驗';
      console.log(`🟢 檢測到體驗課學生: ${student.name}`);
    }
    // ✅ 新增：2. 補課學生 → studentTimeChange
    else if (student.isTemporary && student.temporaryType === 'makeup') {
      specialEventType = '改時間';
      console.log(`🟠 檢測到補課學生: ${student.name}`);
    }
    // 3. 檢測課程標題中的特殊事件（代課、調課）
    else {
      const title = event.title || '';
      if (title.includes('代課') || title.includes('代理') || title.includes('支援')) {
        specialEventType = '代課';
        console.log(`🔵 檢測到代課: ${title}`);
      } else if (title.includes('調課') || title.includes('延後') || title.includes('提前') || title.includes('改時間')) {
        specialEventType = '改時間';
        console.log(`🟠 檢測到調課/改時間: ${title}`);
      }
    }
    
    const reminder = {
      id: `student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uid: event.uid,              // ✅ CalDAV UID（用於精確匹配編輯後的事件）
      evt_id: event.evt_id,        // ✅ Synology 內部事件 ID
      studentName: student.name,
      parentUserId: student.userId,
      teacherName: event.instructor || '未知講師',
      courseName: event.title,
      courseDate: courseDate,
      courseTime: event.start.split('T')[1].substring(0, 5),
      message: await this.generateStudentReminderMessage(student.name, event.title, courseDate, event.start.split('T')[1].substring(0, 5), event),
      status: 'pending',
      scheduledTime: scheduledTime,
      createdAt: new Date().toISOString(),
      type: 'student_reminder',
      // ✅ 新增 Flex Message 需要的欄位
      location: locationSimple,  // 🔥 地點簡稱
      detailedAddress: detailedAddress,  // 🔥 具體地址
      description: description,
      lessonPlanUrl: lessonPlanUrl,
      googleMapsUrl: googleMapsUrl,
      weekday: weekday,
      // ✅ 新增：記錄特殊事件類型（用於範本選擇）
      specialEventType: specialEventType,
      // ✅ 新增：記錄是否為臨時學生
      isTemporary: student.isTemporary || false,
      temporaryType: student.temporaryType || null
    };
    
    console.log(`⏰ 創建學生提醒: ${event.title} - ${student.name}`);
    console.log(`   提醒時間: ${scheduledTime} (台灣時間 ${studentReminderHour}:${studentReminderMinute.toString().padStart(2, '0')})`);
    
    return reminder;
  }

  // 生成學生提醒訊息
  async generateStudentReminderMessage(studentName, courseTitle, courseDate, courseTime, event = null) {
    const date = new Date(courseDate);
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${weekday}`;
    
    // 獲取範本設定
    const templates = await this.getTemplates();
    const template = templates.student;
    
    // 準備變數
    const variables = {
      courseName: courseTitle,
      courseDate: formattedDate,
      courseTime: courseTime,
      location: '未設定地點',
      lessonPlanUrl: '',
      googleMapsUrl: ''
    };
    
    // 如果有事件資料，加入地點和教案連結
    if (event) {
      let location = event.location || '未設定地點';
      
      // 地址映射邏輯：從設定檔讀取地址映射
      location = this.mapAddress(location);
      
      const description = event.description || '';
      
      // 從描述中提取教案連結 - 使用與 perfect-calendar-optimized-complete.html 相同的邏輯
      let lessonPlanUrl = '';
      
      // 尋找教案連結 - 從原始描述中提取
      const notionUrlRegex = /\(https:\/\/www\.notion\.so\/([^)]+)\)/;
      let notionMatch = description.match(notionUrlRegex);
      
      // 如果沒有找到括號內的連結，則匹配一般的 Notion 連結
      if (!notionMatch) {
        const generalNotionRegex = /https:\/\/www\.notion\.so\/([^)\s]+)/;
        notionMatch = description.match(generalNotionRegex);
      }
      
      if (notionMatch) {
        lessonPlanUrl = `https://www.notion.so/${notionMatch[1]}`;
      }
      
      // 生成Google Maps URL
      const googleMapsUrl = location && location !== '未設定地點' ? 
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : '';
      
      variables.location = location;
      variables.lessonPlanUrl = lessonPlanUrl;
      variables.googleMapsUrl = googleMapsUrl;
    }
    
    // 處理範本
    const message = this.processTemplate(template, variables);
    
    console.log(`📋 使用範本生成學生提醒訊息`);
    return message;
  }

  // 儲存學生提醒到後端
  async saveStudentRemindersToBackend(studentReminders) {
    try {
      console.log('💾 儲存學生提醒到後端...');
      
      const baseUrl = this.systemSettings?.api?.baseUrl || 'http://localhost:3000';
      const response = await axios.post(`${baseUrl}/api/student-reminders`, {
        studentReminders
      });
      
      if (response.data.success) {
        console.log('✅ 學生提醒已儲存到後端');
      } else {
        console.error('❌ 儲存學生提醒到後端失敗:', response.data.message);
      }
    } catch (error) {
      console.error('❌ 儲存學生提醒到後端失敗:', error);
    }
  }

  // 發送學生提醒
  async sendStudentReminders(studentReminders) {
    const results = {
      total: studentReminders.length,
      success: [],
      failed: []
    };
    
    console.log(`📤 開始發送 ${studentReminders.length} 個學生提醒...`);
    
    // ✅ 按家長分組（同一家長的多個孩子合併成 carousel）
    const remindersByParent = {};
    for (const reminder of studentReminders) {
      const parentUserId = reminder.parentUserId;
      if (!remindersByParent[parentUserId]) {
        remindersByParent[parentUserId] = [];
      }
      remindersByParent[parentUserId].push(reminder);
    }
    
    console.log(`👨‍👩‍👧‍👦 共有 ${Object.keys(remindersByParent).length} 位家長需要發送學生提醒`);
    
    // 逐家長發送（同一家長的多個孩子會合併成 carousel）
    for (const [parentUserId, parentReminders] of Object.entries(remindersByParent)) {
      try {
        console.log(`📤 發送學生提醒給家長（共 ${parentReminders.length} 個孩子）`);
        
        // 使用批次發送（支援 carousel）
        const success = await this.sendStudentReminderBatch(parentReminders, parentUserId);
        
        if (success) {
          // 標記所有提醒為已發送
          for (const reminder of parentReminders) {
            results.success.push(reminder);
          }
        } else {
          // 標記所有提醒為失敗
          for (const reminder of parentReminders) {
            results.failed.push(reminder);
          }
        }
        
        // 避免發送太快
        const delay = this.systemSettings?.reminders?.sendDelay || 3000;
        console.log(`⏳ 等待 ${delay}ms 後發送下一位家長的提醒...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        
      } catch (error) {
        console.error(`❌ 發送學生提醒失敗: ${parentUserId}`, error);
        for (const reminder of parentReminders) {
          results.failed.push({ ...reminder, error: error.message });
        }
      }
    }
    
    console.log(`📊 學生提醒發送結果: 成功 ${results.success.length} 個，失敗 ${results.failed.length} 個`);
    return results;
  }
  
  // 批次發送學生提醒（同一家長的多個孩子，支援 carousel）
  async sendStudentReminderBatch(reminders, parentUserId) {
    try {
      console.log(`📤 批次發送 ${reminders.length} 個學生提醒給家長 ${parentUserId}`);
      
      // 透過 API 批次發送（支援 carousel）
      const response = await axios.post(
        `${this.systemSettings?.api?.baseUrl || 'http://localhost:3000'}/api/student-reminders/batch-send`,
        {
          reminderIds: reminders.map(r => r.id),
          parentUserId: parentUserId
        },
        { timeout: 15000 }
      );
      
      if (!response.data.success) {
        throw new Error(response.data.message || '批次發送失敗');
      }
      
      console.log(`✅ 學生提醒批次發送成功`);
      console.log(`📊 成功: ${response.data.success || reminders.length}, 失敗: ${response.data.failed || 0}`);
      console.log(`🎠 使用 ${response.data.messageType || 'text'} 格式`);
      
      // 更新本地狀態
      const remindersData = this.loadReminders();
      for (const reminder of reminders) {
        const index = remindersData.studentReminders.findIndex(r => r.id === reminder.id);
        if (index !== -1) {
          remindersData.studentReminders[index].status = 'sent';
          remindersData.studentReminders[index].sentAt = new Date().toISOString();
        }
      }
      this.saveReminders(remindersData);
      console.log(`💾 已更新 ${reminders.length} 個學生提醒狀態`);
      
      return true;
      
    } catch (error) {
      console.error(`❌ 學生提醒批次發送失敗:`, error);
      
      // 更新本地狀態為失敗
      const remindersData = this.loadReminders();
      for (const reminder of reminders) {
        const index = remindersData.studentReminders.findIndex(r => r.id === reminder.id);
        if (index !== -1) {
          remindersData.studentReminders[index].status = 'failed';
          remindersData.studentReminders[index].error = error.message;
        }
      }
      this.saveReminders(remindersData);
      
      return false;
    }
  }

  // 發送單個學生提醒
  async sendStudentReminder(reminder) {
    try {
      console.log(`📤 發送學生提醒: ${reminder.studentName} -> ${reminder.parentUserId}`);
      
      const response = await axios.post(`${this.systemSettings?.api?.baseUrl}/api/student-reminders/${reminder.id}/send`, {
        message: reminder.message,
        parentUserId: reminder.parentUserId
      });
      
      if (response.data.success) {
        console.log(`✅ 學生提醒發送成功: ${reminder.studentName}`);
        
        // ⭐ 修復：本地立即更新狀態，確保與 API 同步
        const remindersData = this.loadReminders();
        const studentReminderIndex = remindersData.studentReminders.findIndex(r => r.id === reminder.id);
        if (studentReminderIndex !== -1) {
          remindersData.studentReminders[studentReminderIndex].status = 'sent';
          remindersData.studentReminders[studentReminderIndex].sentAt = new Date().toISOString();
          this.saveReminders(remindersData);
          console.log(`💾 已本地更新學生提醒狀態: ${reminder.studentName}`);
        }
        
        // 增加發送間隔，避免觸發速率限制
        const sendDelay = this.systemSettings?.reminders?.sendDelay || 3000; // 預設3秒間隔
        console.log(`⏳ 等待 ${sendDelay}ms 後發送下一個學生提醒...`);
        await new Promise(resolve => setTimeout(resolve, sendDelay));
        
        return true;
      } else {
        console.error(`❌ 學生提醒發送失敗: ${reminder.studentName} - ${response.data.message}`);
        
        // ⭐ 修復：本地更新失敗狀態
        const remindersData = this.loadReminders();
        const studentReminderIndex = remindersData.studentReminders.findIndex(r => r.id === reminder.id);
        if (studentReminderIndex !== -1) {
          remindersData.studentReminders[studentReminderIndex].status = 'failed';
          remindersData.studentReminders[studentReminderIndex].error = response.data.message;
          this.saveReminders(remindersData);
        }
        
        return false;
      }
    } catch (error) {
      console.error(`❌ 發送學生提醒失敗: ${reminder.studentName}`, error);
      
      // ⭐ 修復：本地更新失敗狀態
      try {
        const remindersData = this.loadReminders();
        const studentReminderIndex = remindersData.studentReminders.findIndex(r => r.id === reminder.id);
        if (studentReminderIndex !== -1) {
          remindersData.studentReminders[studentReminderIndex].status = 'failed';
          remindersData.studentReminders[studentReminderIndex].error = error.message;
          this.saveReminders(remindersData);
        }
      } catch (updateError) {
        console.error(`❌ 更新學生提醒狀態失敗:`, updateError);
      }
      
      return false;
    }
  }

  // 設定管理員
  setAdmin(adminUserId) {
    this.adminUserId = adminUserId;
    console.log('👤 管理員已設定:', adminUserId);
  }

  // 獲取管理員資訊
  getAdminInfo() {
    // ✅ 方案B：優先從 notification-config.json 讀取管理員配置
    try {
      const configPath = path.join(__dirname, 'notification-config.json');
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configData);
        const adminUserId = config?.roles?.admin?.user_id;
        
        if (adminUserId) {
          console.log('✅ 從 notification-config.json 讀取管理員:', adminUserId);
          
          // 從 teacher_data.json 查找管理員名稱
          try {
            const teacherDataPath = path.join(__dirname, 'teacher_data.json');
            if (fs.existsSync(teacherDataPath)) {
              const teacherData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
              const teachers = teacherData.teachers || [];
              
              // ✅ 支援陣列格式的 teacher_data.json
              let adminName = '管理員';
              if (Array.isArray(teachers)) {
                const admin = teachers.find(t => t.userId === adminUserId);
                if (admin) {
                  adminName = admin.name;
                }
              } else {
                // 支援物件格式（向後兼容）
                adminName = Object.keys(teachers).find(name => teachers[name] === adminUserId) || '管理員';
              }
              
              return {
                userId: adminUserId,
                name: adminName,
                isSet: true,
                source: 'notification-config.json'
              };
            }
          } catch (teacherError) {
            console.error('⚠️ 讀取講師資料失敗，但管理員 ID 已取得:', teacherError);
            return {
              userId: adminUserId,
              name: '管理員',
              isSet: true,
              source: 'notification-config.json'
            };
          }
        }
      }
    } catch (error) {
      console.error('⚠️ 讀取 notification-config.json 失敗:', error);
    }
    
    // ⚠️ Fallback 1: 如果 notification-config.json 不存在，使用 this.adminUserId
    if (this.adminUserId) {
      console.log('⚠️ 使用 this.adminUserId:', this.adminUserId);
      const teacherList = TeacherRegistry.getTeacherList();
      const adminEntry = teacherList.find(teacher => teacher.userId === this.adminUserId);
      return {
        userId: this.adminUserId,
        name: adminEntry?.name || '未知',
        isSet: true,
        source: 'this.adminUserId'
      };
    }
    
    // ⚠️ Fallback 2: 最後手段 - 返回第一個講師（不推薦）
    console.warn('⚠️ 未找到管理員配置，使用第一個講師作為後備（不推薦）');
    const teacherList = TeacherRegistry.getTeacherList();
    const firstTeacher = teacherList[0];
    return {
      userId: firstTeacher?.userId || null,
      name: firstTeacher?.name || '未設定',
      isSet: false,
      source: 'fallback-first-teacher'
    };
  }

  // 設定學生提醒時間
  setStudentReminderSettings(settings) {
    this.studentReminderSettings = {
      ...this.studentReminderSettings,
      ...settings
    };
    // 儲存到檔案
    this.saveStudentReminderSettings();
    console.log('⏰ 學生提醒設定已更新:', this.studentReminderSettings);
  }

  // 獲取學生提醒設定
  getStudentReminderSettings() {
    return this.studentReminderSettings;
  }

  // 重置課前提醒狀態
  resetBeforeClassReminders() {
    try {
      console.log('🔄 重置課前提醒狀態...');
      
      // 載入提醒資料
      const remindersData = this.loadReminders();
      const reminders = remindersData.reminders || [];
      
      // 使用台灣時區 (UTC+8)
      const taiwanTime = this.getTaiwanTime();
      const today = this.getTaiwanDateString();
      const now = new Date();
      
      let resetCount = 0;
      
      reminders.forEach(reminder => {
        if (reminder.type === 'before-class' && reminder.courseDate === today) {
          // 計算課程時間（✅ 正確時區轉換）
          try {
            const [year, month, day] = reminder.courseDate.split('-').map(Number);
            const [hour, minute] = reminder.courseTime.split(':').map(Number);
            // ✅ 使用正確的台灣時區轉換
            const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
            const courseTime = new Date(taiwanTimeStr);
            if (!isNaN(courseTime.getTime()) && courseTime > now) {
              // 計算課前提醒時間（課程時間前30分鐘）
              const beforeClassMinutes = this.systemSettings?.reminders?.beforeClassMinutes || 30;
              const beforeClassTime = new Date(courseTime.getTime() - (beforeClassMinutes * 60 * 1000));
              
              // ⭐ 修復：如果課前提醒時間還沒到且還沒發送過（排除failed狀態），重置為 pending
              if (beforeClassTime > now && 
                  reminder.status !== 'sent' && 
                  reminder.status !== 'completed' && 
                  reminder.status !== 'failed' && 
                  reminder.status !== 'pending-retry' && 
                  !reminder.sentAt) {
                reminder.status = 'pending';
                reminder.sentAt = null;
                resetCount++;
                console.log(`🔄 重置課前提醒: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()}, 提醒時間: ${beforeClassTime.toISOString()})`);
              } else if (beforeClassTime > now && (reminder.status === 'sent' || reminder.status === 'completed')) {
                console.log(`⏰ 課前提醒已發送/完成，保持狀態 ${reminder.status}: ${reminder.courseName} - ${reminder.teacherName} (提醒時間: ${beforeClassTime.toISOString()})`);
              } else if (reminder.status === 'failed' || reminder.status === 'pending-retry') {
                console.log(`⚠️ 課前提醒發送失敗或等待重試，保持狀態 ${reminder.status}: ${reminder.courseName} - ${reminder.teacherName}`);
              } else {
                console.log(`⏰ 課前提醒時間已過，保持狀態 ${reminder.status}: ${reminder.courseName} - ${reminder.teacherName} (提醒時間: ${beforeClassTime.toISOString()})`);
              }
            } else {
              console.log(`⏰ 課程已開始，跳過: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
            }
          } catch (error) {
            console.log(`⚠️ 課程時間解析錯誤: ${reminder.courseName} - ${error.message}`);
          }
        }
      });
      
      if (resetCount > 0) {
        // 保存更新
        this.saveReminders(remindersData);
        console.log(`✅ 重置了 ${resetCount} 個課前提醒狀態（僅初次重置）`);
      } else {
        console.log(`📝 沒有需要重置的課前提醒`);
      }
      
    } catch (error) {
      console.error('❌ 重置課前提醒失敗:', error);
    }
  }

  // 通知管理員學生提醒結果
  async notifyAdminStudentReminderResults(results) {
    try {
      console.log('📧 準備通知管理員學生提醒結果...');
      
      // 獲取管理員資訊
      const adminInfo = this.getAdminInfo();
      
      if (!adminInfo.userId) {
        console.log('⚠️ 找不到管理員的 LINE User ID，跳過通知');
        return;
      }
      
      // 生成結果報告
      const report = this.generateStudentReminderReport(results);
      
      // 發送通知給管理員
      await this.sendLineMessage(adminInfo.userId, report);
      
      console.log(`✅ 管理員通知已發送給 ${adminInfo.name} (${adminInfo.userId})`);
    } catch (error) {
      console.error('❌ 通知管理員失敗:', error);
    }
  }

  // 生成學生提醒結果報告
  generateStudentReminderReport(results) {
    const { total, success, failed } = results;
    const successCount = success.length;
    const failedCount = failed.length;
    
    let report = `📊 學生提醒發送結果報告\n\n`;
    report += `📅 時間: ${new Date().toLocaleString('zh-TW')}\n`;
    report += `📈 總計: ${total} 個提醒\n`;
    report += `✅ 成功: ${successCount} 個\n`;
    report += `❌ 失敗: ${failedCount} 個\n\n`;
    
    if (successCount > 0) {
      report += `✅ 成功發送:\n`;
      success.forEach(reminder => {
        report += `• ${reminder.studentName} - ${reminder.courseName}\n`;
      });
      report += `\n`;
    }
    
    if (failedCount > 0) {
      report += `❌ 發送失敗:\n`;
      failed.forEach(reminder => {
        const reason = reminder.error || '未知原因';
        report += `• ${reminder.studentName} - ${reminder.courseName} (${reason})\n`;
      });
    }
    
    return report;
  }

  // 發送 LINE 訊息（帶重試機制）
  async sendLineMessage(userId, message, retryCount = 0) {
    // 檢查 LINE Token 是否存在
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      console.error('❌ LINE_CHANNEL_ACCESS_TOKEN 未設定，無法發送提醒');
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN 未設定，無法發送提醒');
    }

    const maxRetries = 3;
    const baseDelay = 5000; // 5秒基礎延遲

    try {
      console.log(`📤 開始發送LINE通知... (嘗試 ${retryCount + 1}/${maxRetries + 1})`);
      console.log('🎯 目標講師LINE User ID:', userId);
      console.log('📝 發送訊息長度:', message.length, '字元');
      
      const response = await axios.post('https://api.line.me/v2/bot/message/push', {
        to: userId,
        messages: [{
          type: 'text',
          text: message
        }]
      }, {
        headers: {
          'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📊 LINE API 回應狀態:', response.status);
      console.log('📊 LINE API 回應資料:', response.data);
      console.log('✅ LINE 訊息發送成功');
      return response.data;
    } catch (error) {
      console.error('❌ LINE 訊息發送失敗:', error.message);
      console.error('❌ 詳細錯誤資訊:', error.response?.data || error);
      
      // 處理速率限制錯誤
      if (error.response?.status === 429) {
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount); // 指數退避
          console.log(`⚠️ LINE API 速率限制，${delay/1000}秒後重試 (${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.sendLineMessage(userId, message, retryCount + 1);
        } else {
          console.error('❌ LINE API 速率限制，已達最大重試次數');
          throw new Error('LINE API 速率限制，已達最大重試次數');
        }
      }
      
      throw error;
    }
  }

  // 獲取行事曆事件
  async getCalendarEvents() {
    // ✅ 優化：使用緩存（避免重複API調用）
    if (this.cachedEvents) {
      return this.cachedEvents;
    }
    
    try {
      const baseUrl = this.systemSettings?.api?.baseUrl || 'http://localhost:3000';
      console.log('🔗 使用 API URL:', baseUrl);
      const response = await axios.get(`${baseUrl}/api/events`);
      return response.data.data || [];
    } catch (error) {
      console.error('❌ 獲取行事曆事件失敗:', error);
      return [];
    }
  }

  // 更新學生資料
  async updateStudentData() {
    try {
      console.log('🔄 排程器更新學生資料...');
      
      const response = await axios.post(`${this.systemSettings?.api?.baseUrl}/api/update-student-data`, {}, {
        timeout: this.systemSettings?.api?.timeout || 60000
      });
      
      if (response.data.success) {
        console.log('✅ 排程器成功更新學生資料');
        console.log(`📊 學生數量: ${response.data.studentCount || 0}`);
      } else {
        console.log('⚠️ 排程器更新學生資料失敗:', response.data.message);
      }
    } catch (error) {
      console.error('❌ 排程器更新學生資料錯誤:', error.message);
    }
  }

  // 執行排程任務
  async runScheduledTasks() {
    try {
      console.log('🕐 執行排程任務...');
      this.lastRunTime = new Date().toISOString();
      
      // ✅ 優化：初始化緩存（一次性載入所有數據）
      console.log('📦 初始化緩存...');
      this.cachedReminders = this.loadReminders();
      this.cachedTeachers = this.loadTeachers();
      this.cachedEvents = await this.getCalendarEvents();
      console.log(`✅ 緩存初始化完成（提醒: ${this.cachedReminders.reminders?.length || 0}, 行事曆事件: ${this.cachedEvents.length}）`);
      
      // 檢查是否為00:00-00:10之間，如果是則強制清理和重新載入
      const taiwanTime = this.getTaiwanTime();
      const currentHour = taiwanTime.getHours();
      const currentMinute = taiwanTime.getMinutes();
      
      if (currentHour === 0 && currentMinute <= 10) {
        // 檢查今天是否已經執行過午夜清理（防止重複執行）
        const todayDate = taiwanTime.toISOString().split('T')[0];
        const lastCleanupDate = this.lastMidnightCleanup ? 
          new Date(this.lastMidnightCleanup).toISOString().split('T')[0] : null;
        
        if (lastCleanupDate === todayDate) {
          console.log('⏭️ 今日已執行過午夜清理，跳過');
        } else {
          console.log('🌅 檢測到新的一天開始，執行強制清理和重新載入...');
          await this.forceMidnightCleanupAndReload();
        }
        return; // 執行完強制清理後直接返回，不執行其他任務
      }
      
      // 更新學生資料（每5分鐘更新一次）
      await this.updateStudentData();
      
      // 清理過期提醒（錯誤不影響後續執行）
      try {
        this.cleanupExpiredReminders();
      } catch (error) {
        console.error('❌ 清理過期提醒失敗:', error);
      }
      
      // 創建新的提醒（基於行事曆事件）
      console.log('📅 準備創建提醒...');
      await this.createRemindersFromCalendar();
      console.log('✅ 提醒創建完成');
      
      // 生成學生提醒（每次排程都檢查並生成）
      console.log('👨‍🎓 準備生成學生提醒...');
      await this.generateStudentReminders();
      console.log('✅ 學生提醒生成完成');
      
      // 重置課前提醒狀態（每次排程都執行）
      console.log('🔄 準備執行課前提醒重置...');
      this.resetBeforeClassReminders();
      console.log('✅ 課前提醒重置執行完成');
      
      // 處理重試提醒（優先處理）
      await this.processRetryReminders();
      
      // 處理今日提醒
      await this.processTodayReminders();
      
      // 處理隔日提醒
      await this.processTomorrowReminders();
      
      // 處理課前提醒
      await this.processBeforeClassReminders();
      
      // 處理學生提醒
      await this.processStudentReminders();
      
      console.log('✅ 排程任務執行完成');
    } catch (error) {
      console.error('❌ 排程任務執行失敗:', error);
    } finally {
      // ✅ 優化：保存並清除緩存（確保緩存不會跨排程週期）
      try {
        if (this.cachedReminders) {
          console.log('💾 保存緩存數據...');
          this.saveReminders(this.cachedReminders);
          console.log('✅ 緩存數據已保存');
        }
      } catch (error) {
        console.error('❌ 保存緩存數據失敗:', error);
      }
      
      // 清除所有緩存
      delete this.cachedReminders;
      delete this.cachedTeachers;
      delete this.cachedEvents;
      console.log('🧹 緩存已清除');
    }
  }

  // ✅ 優化：強制刷新行事曆（用於即時響應）
  async forceRefresh() {
    try {
      console.log('🔄 強制刷新行事曆...');
      
      // 清除緩存
      delete this.cachedEvents;
      delete this.cachedReminders;
      delete this.cachedTeachers;
      
      // 重新載入所有數據
      this.cachedReminders = this.loadReminders();
      this.cachedTeachers = this.loadTeachers();
      this.cachedEvents = await this.getCalendarEvents();
      
      console.log(`✅ 緩存已刷新（提醒: ${this.cachedReminders.reminders?.length || 0}, 行事曆事件: ${this.cachedEvents.length}）`);
      
      // 執行反向檢查（偵測刪除/修改的課程）
      await this.createRemindersFromCalendar();
      
      // ✅ 修復：先保存統計數據（在清除緩存之前）
      const stats = {
        reminders: this.cachedReminders?.reminders?.length || 0,
        studentReminders: this.cachedReminders?.studentReminders?.length || 0,
        events: this.cachedEvents?.length || 0
      };
      
      // 保存並清除緩存
      if (this.cachedReminders) {
        this.saveReminders(this.cachedReminders);
        console.log('💾 緩存數據已保存');
      }
      
      delete this.cachedEvents;
      delete this.cachedReminders;
      delete this.cachedTeachers;
      console.log('🧹 緩存已清除');
      
      return {
        success: true,
        message: '行事曆已強制刷新',
        stats: stats
      };
    } catch (error) {
      console.error('❌ 強制刷新失敗:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  // 強制午夜清理和重新載入
  async forceMidnightCleanupAndReload() {
    try {
      console.log('🌅 開始強制午夜清理和重新載入...');
      
      // 清除緩存，確保使用最新資料
      delete this.cachedReminders;
      delete this.cachedTeachers;
      delete this.cachedEvents;
      TeacherRegistry.reload();
      this.cachedTeachers = TeacherRegistry.getTeacherData();

      // 1. 先清理過期或重複的提醒資料
      console.log('🧹 清理過期提醒與狀態...');
      this.cleanupExpiredReminders();

      // 2. 更新學生資料
      console.log('👨‍🎓 更新學生資料...');
      await this.updateStudentData();
      
      // 3. 重新從行事曆創建提醒（保留既有資料，僅同步差異）
      console.log('📅 重新同步講師提醒...');
      await this.createRemindersFromCalendar();
      
      // 4. 重新生成學生提醒（確保今日/明日皆存在）
      console.log('👨‍🎓 補齊學生提醒...');
      await this.generateStudentReminders();

      // 5. 重置當日課前提醒狀態（避免重複發送）
      console.log('🔄 重置當日課前提醒狀態...');
      this.resetBeforeClassReminders();
      
      console.log('✅ 午夜清理和重新載入完成');
      console.log('ℹ️ 提醒將按照設定的時間自動發送，不會立即發送');
      
      // 記錄清理時間
      this.lastMidnightCleanup = new Date().toISOString();
      
    } catch (error) {
      console.error('❌ 午夜清理和重新載入失敗:', error);
    } finally {
      delete this.cachedReminders;
      delete this.cachedTeachers;
      delete this.cachedEvents;
    }
  }

  // 獲取排程器狀態
  getStatus() {
    const remindersData = this.loadReminders();
    const reminders = remindersData.reminders || [];
    
     // 計算運行時間
     const uptime = this.startTime ? Date.now() - this.startTime : 0;
     const uptimeMinutes = Math.floor(uptime / (1000 * 60));
     const uptimeHours = Math.floor(uptimeMinutes / 60);
     const remainingMinutes = uptimeMinutes % 60;
    
    // 獲取最後執行時間
    const lastRunTime = this.lastRunTime || null;
    
    return {
      isRunning: this.isRunning,
      hasSchedule: reminders.length > 0,
      totalReminders: reminders.length,
      pendingReminders: reminders.filter(r => r.status === 'pending').length,
      sentReminders: reminders.filter(r => r.status === 'sent').length,
      lastRunTime: lastRunTime,
      lastMidnightCleanup: this.lastMidnightCleanup,
      uptime: uptime,
      uptimeMinutes: uptimeMinutes,
      uptimeHours: uptimeHours,
      remainingMinutes: remainingMinutes,
      uptimeDisplay: uptimeHours > 0 ? `${uptimeHours}小時${remainingMinutes}分鐘` : `${uptimeMinutes}分鐘`
    };
  }

  // 地址映射方法
  mapAddress(originalAddress) {
    try {
      const mappingsPath = path.join(__dirname, 'data', 'address-mappings.json');
      
      if (fs.existsSync(mappingsPath)) {
        const mappingsData = fs.readFileSync(mappingsPath, 'utf8');
        const mappings = JSON.parse(mappingsData);
        
        // 尋找匹配的地址映射
        const mapping = mappings.find(m => m.original === originalAddress);
        if (mapping) {
          console.log(`📍 地址映射: ${originalAddress} → ${mapping.display}`);
          return mapping.display;
        }
      }
    } catch (error) {
      console.error('❌ 讀取地址映射失敗:', error);
    }
    
    // 如果沒有找到映射或讀取失敗，返回原始地址
    return originalAddress;
  }
}

module.exports = ReminderScheduler;
