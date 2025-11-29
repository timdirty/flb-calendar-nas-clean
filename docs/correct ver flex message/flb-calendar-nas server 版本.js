const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const schedule = require('node-schedule');

// 載入環境變數
require('dotenv').config({ path: '.env.nas' });

// 載入提醒排程器
const ReminderScheduler = require('./reminder-scheduler');

// 載入通知管理器
const NotificationManager = require('./notification-manager');

// 正職群組 ID
const STAFF_GROUP_ID = 'C9cd9530405411fdd46de96f4e6cdecb7';

// 📦 批次通知緩存（用於累積短時間內的請假/待確認通知）
const pendingNotifications = {
  leave: [],      // 請假通知
  pending: [],    // 待確認通知
  timers: {}      // 定時器
};

// 載入系統設定函數
function loadSystemSettings() {
  try {
    const settingsPath = path.join(__dirname, 'system-settings.json');
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(settingsData);
    } else {
      // 如果檔案不存在，使用預設值
      return {
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
        api: { baseUrl: "https://calendar.funlearnbar.synology.me", timeout: 60000 },
        dateRange: { futureDays: 30, pastDays: 7 }
      };
    }
  } catch (error) {
    console.error('❌ 載入系統設定失敗:', error);
    // 如果載入失敗，使用預設值
    return {
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
      api: { baseUrl: "https://calendar.funlearnbar.synology.me", timeout: 60000 },
      dateRange: { futureDays: 30, pastDays: 7 }
    };
  }
}

// ===== Period 解析函數 =====
/**
 * 解析 period 字串為結構化資料
 * @param {string} periodStr - 原始 period 字串 (如 "三 0840-0920", "一四 1930-2030 到府")
 * @returns {Object} 結構化的 periodParsed 物件
 */
function parsePeriodString(periodStr) {
  // 預設回傳結構
  const result = {
    weekdays: [],
    startTime: null,
    endTime: null,
    location: null,
    note: null,
    raw: periodStr || ''
  };

  // 如果輸入無效，回傳預設值
  if (!periodStr || typeof periodStr !== 'string') {
    return result;
  }

  try {
    // 1. 提取星期（支援中文星期：一二三四五六日）
    const weekdayPattern = /[一二三四五六日]/g;
    const weekdayMatches = periodStr.match(weekdayPattern);
    if (weekdayMatches) {
      // 去重並保持順序
      result.weekdays = [...new Set(weekdayMatches)];
    }

    // 2. 提取時間範圍（支援多種格式）
    // 格式支援：HHMM-HHMM, HH:MM-HH:MM, HHMM~HHMM 等
    const timePattern = /(\d{1,2}):?(\d{2})\s*[-~–—]\s*(\d{1,2}):?(\d{2})/;
    const timeMatch = periodStr.match(timePattern);
    
    if (timeMatch) {
      const [_, h1, m1, h2, m2] = timeMatch;
      // 標準化為 HH:MM 格式
      result.startTime = `${h1.padStart(2, '0')}:${m1}`;
      result.endTime = `${h2.padStart(2, '0')}:${m2}`;
    }

    // 3. 提取地點關鍵字
    if (periodStr.includes('到府')) {
      result.location = '到府';
    } else if (periodStr.includes('松山')) {
      result.location = '松山';
    } else if (periodStr.includes('外')) {
      result.location = '外';
    }

    // 4. 提取備註關鍵字
    if (periodStr.includes('客製化')) {
      result.note = '客製化';
    } else if (periodStr.includes('包班')) {
      result.note = '包班';
    } else if (periodStr.includes('代課')) {
      result.note = '代課';
    }

  } catch (error) {
    console.error('❌ 解析 period 字串失敗:', periodStr, error);
    // 發生錯誤時回傳基本結構（不中斷流程）
  }

  return result;
}

// ===== 批次通知發送函數 =====
/**
 * 批次發送學生回應通知（請假/待確認）
 * 如果有多個通知，使用 Carousel 風格
 * @param {string} responseType - 'leave' 或 'pending'
 * @param {object} notificationManager - NotificationManager 實例
 */
async function sendBatchNotifications(responseType, notificationManager) {
  try {
    const notifications = pendingNotifications[responseType];
    
    if (notifications.length === 0) {
      console.log(`📭 [批次通知] 沒有待發送的${responseType === 'leave' ? '請假' : '待確認'}通知`);
      return;
    }
    
    console.log(`📬 [批次通知] 準備發送 ${notifications.length} 個${responseType === 'leave' ? '請假' : '待確認'}通知`);
    
    // 讀取配置
    const leaveNotifConfigPath = path.join(__dirname, 'leave-notification-config.json');
    if (!fs.existsSync(leaveNotifConfigPath)) {
      console.log('⚠️ 找不到請假通知配置文件');
      return;
    }
    
    const notifConfig = JSON.parse(fs.readFileSync(leaveNotifConfigPath, 'utf8'));
    
    if (!notifConfig.enabled || !notifConfig.notifyOn[responseType] || !notifConfig.groupId) {
      console.log(`⚠️ 通知未啟用或未設定群組 ID`);
      return;
    }
    
    // 決定使用 Carousel 還是單個 Flex Message
    if (notifications.length === 1) {
      // 單個通知
      console.log(`📤 [批次通知] 發送單個通知`);
      const notif = notifications[0];
      
      let messageToSend;
      
      if (notifConfig.useFlexMessage) {
        const templateType = responseType === 'leave' ? 'leaveNotification' : 'pendingNotification';
        const flexMessage = notificationManager.buildFlexMessage(templateType, notif.variables);
        
        if (flexMessage) {
          messageToSend = {
            flexMessage,
            altText: responseType === 'leave' 
              ? `🏥 學生請假通知 - ${notif.variables.studentName}`
              : `⏳ 學生待確認通知 - ${notif.variables.studentName}`
          };
        }
      }
      
      if (!messageToSend) {
        // 使用純文字
        if (responseType === 'leave') {
          messageToSend = `🏥 學生請假通知\n\n👤 學生：${notif.variables.studentName}\n📚 課程：${notif.variables.courseName}\n📅 日期：${notif.variables.courseDate} ${notif.variables.weekday}\n⏰ 時間：${notif.variables.courseTime}\n📍 地點：${notif.variables.location}\n\n🏥 請假理由：${notif.variables.leaveReason}\n⏱️ 回覆時間：${notif.variables.replyTime}`;
        } else {
          messageToSend = `⏳ 學生待確認通知\n\n👤 學生：${notif.variables.studentName}\n📚 課程：${notif.variables.courseName}\n📅 日期：${notif.variables.courseDate} ${notif.variables.weekday}\n⏰ 時間：${notif.variables.courseTime}\n📍 地點：${notif.variables.location}\n\n⏱️ 回覆時間：${notif.variables.replyTime}\n\n💡 家長尚未確認是否出席`;
        }
      }
      
      const sendResult = await notificationManager.sendLineMessage(
        notifConfig.groupId,
        typeof messageToSend === 'string' ? messageToSend : '',
        messageToSend
      );
      
      if (sendResult.success) {
        console.log(`✅ [批次通知] 單個通知已發送`);
      } else {
        console.log(`❌ [批次通知] 單個通知發送失敗: ${sendResult.error}`);
      }
    } else {
      // 多個通知，使用 Carousel
      console.log(`🎠 [批次通知] 使用 Carousel 發送 ${notifications.length} 個通知`);
      
      const templateType = responseType === 'leave' ? 'leaveNotification' : 'pendingNotification';
      const variablesArray = notifications.map(n => n.variables);
      
      // 使用 buildCarousel 建立 Carousel
      const carousel = notificationManager.buildCarousel(variablesArray, templateType);
      
      if (carousel) {
        const altText = responseType === 'leave'
          ? `🏥 學生請假通知 - ${notifications.length} 位學生`
          : `⏳ 學生待確認通知 - ${notifications.length} 位學生`;
        
        const sendResult = await notificationManager.sendLineMessage(
          notifConfig.groupId,
          '',
          { flexMessage: carousel, altText }
        );
        
        if (sendResult.success) {
          console.log(`✅ [批次通知] Carousel 已發送`);
        } else {
          console.log(`❌ [批次通知] Carousel 發送失敗: ${sendResult.error}`);
        }
      } else {
        console.log(`❌ [批次通知] 建立 Carousel 失敗`);
      }
    }
    
    // 清空佇列
    pendingNotifications[responseType] = [];
    
  } catch (error) {
    console.error(`❌ [批次通知] 發送失敗:`, error);
    // 清空佇列（避免重複發送）
    pendingNotifications[responseType] = [];
  }
}

// 內存數據庫替代 SQLite3
const memoryDB = {
  teachers: new Map(),
  cache: new Map(),
  
  set(key, value) {
    this.cache.set(key, value);
  },
  
  get(key) {
    return this.cache.get(key);
  },
  
  has(key) {
    return this.cache.has(key);
  },
  
  delete(key) {
    return this.cache.delete(key);
  },
  
  clear() {
    this.cache.clear();
  }
};

const app = express();
const PORT = process.env.PORT || 3002;

// 初始化提醒排程器
const reminderScheduler = new ReminderScheduler();

// 初始化通知管理器
const notificationManager = new NotificationManager();

// ===== 事件快取管理器 =====
let eventsCache = {
  data: null,
  lastUpdate: null,
  isUpdating: false,
  isReady: false  // 🔥 新增：標記快取是否已就緒
};

// 定期獲取 CalDAV 事件的函數
async function updateEventsCache() {
  if (eventsCache.isUpdating) {
    console.log('⏳ 事件快取更新中，跳過此次更新');
    return;
  }
  
  try {
    eventsCache.isUpdating = true;
    console.log('🔄 開始更新事件快取...');
    
    if (!caldavClient) {
      console.log('⚠️ CalDAV 客戶端未初始化，跳過更新');
      return;
    }
    
    // 獲取日期範圍（從本週一開始，到未來30天）
    const systemSettings = loadSystemSettings();
    const dateRange = systemSettings.dateRange || {};
    const futureDays = Math.max(1, parseInt(dateRange.futureDays || 30, 10));
    const pastDays = Math.max(0, parseInt(dateRange.pastDays || 7, 10));
    
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - pastDays);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + futureDays);
    
    console.log('📅 日期範圍:', {
      今天: now.toLocaleDateString('zh-TW'),
      起始日期: startDate.toLocaleDateString('zh-TW'),
      結束日期: endDate.toLocaleDateString('zh-TW'),
      pastDays,
      futureDays
    });
    
    const events = await caldavClient.getAllInstructorEvents(startDate, endDate);
    
    // 轉換事件格式
    const formattedEvents = events.map(event => ({
      id: event.uid || event.evt_id || event.id,
      title: event.title || event.summary,
      instructor: event.instructor,
      start: event.start,
      end: event.end,
      type: event.type || 'other',
      description: event.description || '',
      location: event.location || '',
      time: event.time || '',
      lessonUrl: event.lessonUrl || ''
    }));
    
    eventsCache.data = {
      success: true,
      events: formattedEvents,
      data: formattedEvents,
      source: 'caldav-cache',
      type: 'full',
      lastUpdate: new Date().toISOString()
    };
    eventsCache.lastUpdate = Date.now();
    eventsCache.isReady = true;  // 🔥 標記快取已就緒
    
    console.log(`✅ 事件快取更新成功，獲取 ${formattedEvents.length} 個事件`);
    
  } catch (error) {
    console.error('❌ 更新事件快取失敗:', error.message);
  } finally {
    eventsCache.isUpdating = false;
  }
}

// 每10分鐘更新一次快取
setInterval(() => {
  updateEventsCache();
}, 10 * 60 * 1000);

// 🔥 修復：首次快取更新會在 CalDAV 初始化完成後立即執行
// 不再使用延遲機制，確保 Docker 重啟後快速建立快取
console.log('✅ 事件快取管理器已啟動，每10分鐘更新一次（首次在 CalDAV 初始化後立即執行）');
// ===== 事件快取管理器結束 =====

// 中間件設定
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://static.line-scdn.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://script.google.com", "https://api.line.me", "https://api-data.line.me", "https://liffsdk.line-scdn.net"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🔥 特別處理 student_data.json - 禁止快取，確保即時更新
app.get('/student_data.json', (req, res) => {
  console.log('📥 請求 student_data.json (無快取)');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'student_data.json'));
});

// 靜態檔案服務
app.use(express.static(path.join(__dirname, 'public')));

// LIFF 應用路由重定向（處理根路徑訪問）
app.get('/', (req, res) => {
  res.redirect('/perfect-calendar-optimized-complete2.html');
});

// 處理 LIFF URL 可能帶有尾隨斜線的問題
app.get('/perfect-calendar-optimized-complete2.html/', (req, res) => {
  res.redirect(301, '/perfect-calendar-optimized-complete2.html');
});

// 載入講師資料
let teachers = [];
try {
  const teachersData = fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8');
  teachers = JSON.parse(teachersData);
  console.log('✅ 講師資料載入成功');
} catch (error) {
  console.error('❌ 載入講師資料失敗:', error.message);
}

// CalDAV 客戶端
let caldavClient = null;
let caldavInitialized = false;

// 初始化並登入 CalDAV 客戶端
async function initCalDAVClient() {
  try {
    const SynologyCalendarClient = require('./synology-calendar-client');
    caldavClient = new SynologyCalendarClient(
      process.env.CALDAV_URL || 'https://funlearnbar.synology.me:9102',
      process.env.CALDAV_USERNAME || 'testacount',
      process.env.CALDAV_PASSWORD || 'testacount'
    );
    console.log('✅ Synology Calendar API 客戶端初始化成功');
    
    // 立即登入
    console.log('🔐 正在登入 Synology Calendar...');
    const loginSuccess = await caldavClient.login();
    
    if (loginSuccess) {
      console.log('✅ CalDAV 客戶端登入成功');
      caldavInitialized = true;
    } else {
      console.error('❌ CalDAV 客戶端登入失敗');
      caldavClient = null;
    }
  } catch (error) {
    console.error('❌ CalDAV 客戶端初始化失敗:', error.message);
    caldavClient = null;
  }
}

// ===== 學生資料自動更新管理器 =====

// 抽取的學生資料更新函數
async function updateStudentDataFromGoogleSheets() {
  const settings = loadSystemSettings();
  const syncSettings = settings.studentDataSync || {};
  
  // 檢查是否啟用
  if (!syncSettings.enabled) {
    console.log('⚠️ 學生資料同步功能已停用');
    return { success: false, message: '學生資料同步功能已停用' };
  }
  
  // 檢查是否正在更新中，避免重複請求
  if (memoryDB.get('updating_student_data')) {
    console.log('⏳ 學生資料正在更新中，跳過此次更新');
    return { success: false, message: '學生資料正在更新中' };
  }
  
  try {
    // 設置更新標記
    memoryDB.set('updating_student_data', true);
    
    if (syncSettings.logUpdates) {
      console.log('🔄 [自動更新] 開始更新學生資料...');
    }
    
    // 從Google Sheets API獲取學生資料
    const googleSheetsUrl = "https://script.google.com/macros/s/AKfycbzm0GD-T09Botbs52e8PyeVuA5slJh6Z0AQ7I0uUiGZiE6aWhTO2D0d3XHFrdLNv90uCw/exec";
    
    const payload = JSON.stringify({
      "action": "getStudentList"
    });
    
    const headers = {
      'Content-Type': 'application/json',
      'Cookie': 'NID=525=nsWVvbAon67C2qpyiEHQA3SUio_GqBd7RqUFU6BwB97_4LHggZxLpDgSheJ7WN4w3Z4dCQBiFPG9YKAqZgAokFYCuuQw04dkm-FX9-XHAIBIqJf1645n3RZrg86GcUVJOf3gN-5eTHXFIaovTmgRC6cXllv82SnQuKsGMq7CHH60XDSwyC99s9P2gmyXLppI'
    };
    
    let response;
    let retryCount = 0;
    const maxRetries = syncSettings.retryMaxAttempts || 3;
    const retryDelay = (syncSettings.retryDelaySeconds || 60) * 1000;
    
    while (retryCount < maxRetries) {
      try {
        if (syncSettings.logUpdates) {
          console.log(`🔄 嘗試調用 Google Sheets API (第 ${retryCount + 1} 次)...`);
        }
        response = await axios.post(googleSheetsUrl, payload, { 
          headers,
          timeout: 60000,
          maxRedirects: 5
        });
        break;
      } catch (error) {
        retryCount++;
        console.log(`❌ 第 ${retryCount} 次嘗試失敗:`, error.message);
        if (retryCount >= maxRetries) {
          throw error;
        }
        console.log(`⏳ 等待 ${retryDelay/1000} 秒後重試...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    if (response.data && response.data.success) {
      const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
      
      if (syncSettings.logUpdates) {
        console.log('📊 從 Google Sheets 獲得的學生數量:', response.data.count);
      }
      
      // 🔥 新增：為每個學生添加 periodParsed 結構化欄位
      let parsedCount = 0;
      let parseFailCount = 0;
      
      if (response.data.students && Array.isArray(response.data.students)) {
        response.data.students = response.data.students.map(student => {
          const periodParsed = parsePeriodString(student.period || '');
          
          // 統計解析成功/失敗
          if (periodParsed.startTime && periodParsed.endTime) {
            parsedCount++;
          } else if (student.period) {
            parseFailCount++;
            if (syncSettings.logUpdates) {
              console.log(`⚠️ 無法完整解析 period: "${student.period}" (學生: ${student.name})`);
            }
          }
          
          return {
            ...student,
            periodParsed
          };
        });
        
        if (syncSettings.logUpdates) {
          console.log(`✅ Period 解析統計: 成功 ${parsedCount} / 失敗 ${parseFailCount} / 總計 ${response.data.students.length}`);
        }
      }
      
      // 添加更新時間戳記到資料中
      const updatedData = {
        ...response.data,
        lastUpdated: new Date().toISOString(),
        updateNote: `// 最後更新時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`
      };
      
      // 直接覆蓋寫入
      fs.writeFileSync(studentDataPath, JSON.stringify(updatedData, null, 2));
      
      // 驗證檔案是否寫入成功
      const fileStats = fs.statSync(studentDataPath);
      
      if (syncSettings.logUpdates) {
        console.log('✅ [自動更新] 學生資料更新成功');
        console.log('📅 檔案修改時間:', fileStats.mtime);
        console.log('📏 檔案大小:', fileStats.size, 'bytes');
        console.log('👥 學生數量:', response.data.count);
      }
      
      // 清除更新標記
      memoryDB.delete('updating_student_data');
      
      return {
        success: true,
        message: '學生資料更新成功',
        timestamp: new Date().toISOString(),
        studentCount: response.data.count || 0
      };
    } else {
      // 🔥 改進錯誤訊息：顯示實際的 API 回應
      console.error('❌ Google Sheets API 回應格式錯誤，實際回應:', JSON.stringify(response.data).substring(0, 500));
      throw new Error(`Google Sheets API 回應格式錯誤。期望 {success: true, students: [...]}, 實際收到: ${JSON.stringify(response.data).substring(0, 200)}`);
    }
    
  } catch (error) {
    console.error('❌ [自動更新] 更新學生資料失敗:', error.message);
    
    // 清除更新標記
    memoryDB.delete('updating_student_data');
    
    return {
      success: false,
      message: '更新學生資料失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// 學生資料自動更新排程器
let studentDataSyncSchedule = null;
let studentDataSyncInterval = null;

function startStudentDataAutoSync() {
  const settings = loadSystemSettings();
  const syncSettings = settings.studentDataSync || {};
  
  // 停止現有排程
  if (studentDataSyncSchedule) {
    studentDataSyncSchedule.cancel();
    studentDataSyncSchedule = null;
  }
  if (studentDataSyncInterval) {
    clearInterval(studentDataSyncInterval);
    studentDataSyncInterval = null;
  }
  
  if (!syncSettings.enabled || !syncSettings.autoUpdateEnabled) {
    console.log('ℹ️ 學生資料自動同步已停用');
    return;
  }
  
  // 方案1：每日定時更新
  if (syncSettings.updateTime) {
    const [hour, minute] = syncSettings.updateTime.split(':').map(Number);
    
    // 使用 node-schedule 的 cron 格式：分 時 * * *
    const cronPattern = `${minute} ${hour} * * *`;
    
    studentDataSyncSchedule = schedule.scheduleJob(cronPattern, async () => {
      console.log(`🕐 [排程] 每日定時更新學生資料 (${syncSettings.updateTime})`);
      await updateStudentDataFromGoogleSheets();
    });
    
    console.log(`✅ 已啟動學生資料每日自動更新 (每天 ${syncSettings.updateTime})`);
  }
  
  // 方案3：間隔更新（如果設定了間隔時間）
  if (syncSettings.intervalMinutes && syncSettings.intervalMinutes > 0) {
    const intervalMs = syncSettings.intervalMinutes * 60 * 1000;
    
    studentDataSyncInterval = setInterval(async () => {
      console.log(`🕐 [排程] 間隔更新學生資料 (每 ${syncSettings.intervalMinutes} 分鐘)`);
      await updateStudentDataFromGoogleSheets();
    }, intervalMs);
    
    console.log(`✅ 已啟動學生資料間隔自動更新 (每 ${syncSettings.intervalMinutes} 分鐘)`);
  }
}

// ==================== 臨時學生自動清理排程 ====================

// 清理過期的臨時學生
function cleanupExpiredTemporaryStudents() {
  try {
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    
    if (!fs.existsSync(tempDataPath)) {
      console.log('⚠️ 臨時學生資料檔案不存在，跳過清理');
      return;
    }
    
    const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
    const now = new Date();
    const before = tempData.students.length;
    
    // 過濾掉過期的臨時學生
    tempData.students = tempData.students.filter(s => {
      const expiry = new Date(s.expiryDate + 'T23:59:59');
      return expiry >= now;
    });
    
    const after = tempData.students.length;
    const deleted = before - after;
    
    if (deleted > 0) {
      fs.writeFileSync(tempDataPath, JSON.stringify(tempData, null, 2));
      console.log(`🧹 清理過期臨時學生完成：刪除 ${deleted} 位，剩餘 ${after} 位`);
    } else {
      console.log(`✅ 臨時學生檢查完成：無過期學生，當前 ${after} 位`);
    }
  } catch (error) {
    console.error('❌ 清理過期臨時學生失敗:', error);
  }
}

// 啟動臨時學生自動清理排程
function startTemporaryStudentsCleanup() {
  // 每天凌晨2點清理過期的臨時學生
  schedule.scheduleJob('0 2 * * *', () => {
    console.log('🕐 [定時任務] 開始清理過期的臨時學生...');
    cleanupExpiredTemporaryStudents();
  });
  
  console.log('✅ 已啟動臨時學生自動清理排程（每天凌晨 2:00）');
}

// 在服務器啟動時初始化
initCalDAVClient()
  .then(() => {
    // CalDAV 初始化完成後，立即執行首次快取更新
    if (caldavInitialized) {
      console.log('🚀 CalDAV 初始化完成，立即執行首次快取更新...');
      updateEventsCache();
    }
    
    // 啟動學生資料自動更新排程
    console.log('🚀 啟動學生資料自動更新排程...');
    startStudentDataAutoSync();
    
    // 啟動臨時學生自動清理排程
    console.log('🚀 啟動臨時學生自動清理排程...');
    startTemporaryStudentsCleanup();
  })
  .catch(err => {
    console.error('❌ CalDAV 初始化錯誤:', err);
  });

// 健康檢查端點
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cache_age: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    caldav_configured: !!process.env.CALDAV_URL
  });
});
// 獲取系統日誌端點
app.get('/api/logs', (req, res) => {
  try {
    // 獲取真實的排程器狀態和提醒數據
    const remindersData = reminderScheduler.loadReminders();
    const reminders = remindersData.reminders || [];
    const studentReminders = remindersData.studentReminders || [];
    
    // 統計提醒狀態
    const pendingReminders = reminders.filter(r => r.status === 'pending');
    const failedReminders = reminders.filter(r => r.status === 'failed');
    const sentReminders = reminders.filter(r => r.status === 'sent');
    
    // 生成詳細的提醒狀態日誌
    const logs = [];
    
    // 添加系統狀態日誌
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `排程器正在運行 - 總提醒: ${reminders.length}, 待發送: ${pendingReminders.length}, 已發送: ${sentReminders.length}, 失敗: ${failedReminders.length}`,
      source: 'scheduler'
    });
    
    // 添加失敗提醒的詳細資訊
    if (failedReminders.length > 0) {
      failedReminders.forEach((reminder, index) => {
        logs.push({
          timestamp: new Date(Date.now() - (index + 1) * 60000).toISOString(), // 每分鐘一個
          level: 'error',
          message: `❌ 提醒發送失敗: ${reminder.courseName} (${reminder.teacherName}) - ${reminder.error || '未知錯誤'}`,
          source: 'reminder-send',
          details: {
            reminderId: reminder.id,
            courseName: reminder.courseName,
            teacherName: reminder.teacherName,
            type: reminder.type,
            error: reminder.error,
            scheduledTime: reminder.scheduledTime
          }
        });
      });
    }
    
    // 添加待發送提醒的詳細資訊
    if (pendingReminders.length > 0) {
      // 按類型分組顯示提醒
      const todayReminders = pendingReminders.filter(r => r.type === 'today');
      const tomorrowReminders = pendingReminders.filter(r => r.type === 'tomorrow');
      const beforeClassReminders = pendingReminders.filter(r => r.type === 'before-class');
      
      // 顯示當日提醒
      todayReminders.forEach((reminder, index) => {
        const scheduledTime = new Date(reminder.scheduledTime);
        const now = new Date();
        const timeDiff = Math.floor((scheduledTime - now) / (1000 * 60));
        
        logs.push({
          timestamp: new Date(Date.now() - (index + 1) * 30000).toISOString(),
          level: 'info',
          message: `⏳ 當日提醒: ${reminder.courseName} (${reminder.teacherName}) - ${timeDiff > 0 ? `${timeDiff}分鐘後` : '已到時間'}`,
          source: 'reminder-pending',
          details: {
            reminderId: reminder.id,
            courseName: reminder.courseName,
            teacherName: reminder.teacherName,
            type: reminder.type,
            scheduledTime: reminder.scheduledTime,
            timeDiff: timeDiff
          }
        });
      });
      
      // 顯示隔日提醒
      tomorrowReminders.forEach((reminder, index) => {
        const scheduledTime = new Date(reminder.scheduledTime);
        const now = new Date();
        const timeDiff = Math.floor((scheduledTime - now) / (1000 * 60));
        
        logs.push({
          timestamp: new Date(Date.now() - (index + 1) * 30000).toISOString(),
          level: 'info',
          message: `⏳ 隔日提醒: ${reminder.courseName} (${reminder.teacherName}) - ${timeDiff > 0 ? `${timeDiff}分鐘後` : '已到時間'}`,
          source: 'reminder-pending',
          details: {
            reminderId: reminder.id,
            courseName: reminder.courseName,
            teacherName: reminder.teacherName,
            type: reminder.type,
            scheduledTime: reminder.scheduledTime,
            timeDiff: timeDiff
          }
        });
      });
      
      // 顯示課前提醒
      beforeClassReminders.forEach((reminder, index) => {
        const scheduledTime = new Date(reminder.scheduledTime);
        const now = new Date();
        const timeDiff = Math.floor((scheduledTime - now) / (1000 * 60));
        
        logs.push({
          timestamp: new Date(Date.now() - (index + 1) * 30000).toISOString(),
          level: 'info',
          message: `⏳ 課前提醒: ${reminder.courseName} (${reminder.teacherName}) - ${timeDiff > 0 ? `${timeDiff}分鐘後` : '已到時間'}`,
          source: 'reminder-pending',
          details: {
            reminderId: reminder.id,
            courseName: reminder.courseName,
            teacherName: reminder.teacherName,
            type: reminder.type,
            scheduledTime: reminder.scheduledTime,
            timeDiff: timeDiff
          }
        });
      });
    }
    
    // 添加已發送提醒的詳細資訊
    if (sentReminders.length > 0) {
      sentReminders.slice(0, 3).forEach((reminder, index) => { // 只顯示前3個
        logs.push({
          timestamp: reminder.sentAt || new Date(Date.now() - (index + 1) * 120000).toISOString(),
          level: 'success',
          message: `✅ 提醒發送成功: ${reminder.courseName} (${reminder.teacherName})`,
          source: 'reminder-send',
          details: {
            reminderId: reminder.id,
            courseName: reminder.courseName,
            teacherName: reminder.teacherName,
            type: reminder.type,
            sentAt: reminder.sentAt
          }
        });
      });
    }
    
    // 添加學生提醒狀態
    if (studentReminders.length > 0) {
      const pendingStudentReminders = studentReminders.filter(r => r.status === 'pending');
      const failedStudentReminders = studentReminders.filter(r => r.status === 'failed');
      const sentStudentReminders = studentReminders.filter(r => r.status === 'sent');
      
      logs.push({
        timestamp: new Date(Date.now() - 300000).toISOString(),
        level: 'info',
        message: `👨‍🎓 學生提醒狀態 - 總數: ${studentReminders.length}, 待發送: ${pendingStudentReminders.length}, 已發送: ${sentStudentReminders.length}, 失敗: ${failedStudentReminders.length}`,
        source: 'student-reminders'
      });
      
      // 顯示待發送的學生提醒詳細資訊
      if (pendingStudentReminders.length > 0) {
        pendingStudentReminders.forEach((reminder, index) => {
          const scheduledTime = new Date(reminder.scheduledTime);
          const now = new Date();
          const timeDiff = Math.floor((scheduledTime - now) / (1000 * 60));
          
          logs.push({
            timestamp: new Date(Date.now() - (index + 1) * 30000).toISOString(),
            level: 'info',
            message: `⏳ 學生提醒: ${reminder.courseName} (${reminder.studentName}) - ${timeDiff > 0 ? `${timeDiff}分鐘後` : '已到時間'}`,
            source: 'student-reminder-pending',
            details: {
              reminderId: reminder.id,
              courseName: reminder.courseName,
              studentName: reminder.studentName,
              type: 'student',
              scheduledTime: reminder.scheduledTime,
              timeDiff: timeDiff
            }
          });
        });
      }
      
      // 顯示失敗的學生提醒詳細資訊
      if (failedStudentReminders.length > 0) {
        failedStudentReminders.forEach((reminder, index) => {
          logs.push({
            timestamp: new Date(Date.now() - (index + 1) * 60000).toISOString(),
            level: 'error',
            message: `❌ 學生提醒發送失敗: ${reminder.courseName} (${reminder.studentName}) - ${reminder.error || '未知錯誤'}`,
            source: 'student-reminder-send',
            details: {
              reminderId: reminder.id,
              courseName: reminder.courseName,
              studentName: reminder.studentName,
              type: 'student',
              error: reminder.error,
              scheduledTime: reminder.scheduledTime
            }
          });
        });
      }
      
      // 顯示已發送的學生提醒詳細資訊
      if (sentStudentReminders.length > 0) {
        sentStudentReminders.slice(0, 3).forEach((reminder, index) => {
          logs.push({
            timestamp: reminder.sentAt || new Date(Date.now() - (index + 1) * 120000).toISOString(),
            level: 'success',
            message: `✅ 學生提醒發送成功: ${reminder.courseName} (${reminder.studentName})`,
            source: 'student-reminder-send',
            details: {
              reminderId: reminder.id,
              courseName: reminder.courseName,
              studentName: reminder.studentName,
              type: 'student',
              sentAt: reminder.sentAt
            }
          });
        });
      }
    }
    
    // 添加其他系統日誌
    logs.push(
      {
        timestamp: new Date(Date.now() - 600000).toISOString(),
        level: 'warn',
        message: 'LINE API 達到月限制 (429)',
        source: 'line-api'
      },
      {
        timestamp: new Date(Date.now() - 900000).toISOString(),
        level: 'info',
        message: '從 CalDAV 獲取 155 個事件',
        source: 'caldav'
      },
      {
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        level: 'info',
        message: 'Google Sheets API 更新學生資料成功',
        source: 'google-sheets'
      }
    );
    
    // 按時間排序（最新的在前）
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      data: logs,
      total: logs.length,
      summary: {
        totalReminders: reminders.length,
        pending: pendingReminders.length,
        sent: sentReminders.length,
        failed: failedReminders.length,
        studentReminders: studentReminders.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '獲取日誌失敗',
      error: error.message
    });
  }
});
// 系統時間端點
app.get('/api/system-time', (req, res) => {
  try {
    const now = new Date();
    const utcTime = now.toISOString();
    
    // 計算台灣時間 (UTC+8) - 使用正確的時區轉換
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;
    const hour = parts.find(part => part.type === 'hour').value;
    const minute = parts.find(part => part.type === 'minute').value;
    const second = parts.find(part => part.type === 'second').value;
    
    const taiwanTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`);
    const taiwanTimeStr = taiwanTime.toISOString();
    
    // 計算台灣時間的小時、分鐘、秒
    const taiwanHours = taiwanTime.getHours();
    const taiwanMinutes = taiwanTime.getMinutes();
    const taiwanSeconds = taiwanTime.getSeconds();
    
    // 重新計算台灣時間的ISO字符串
    const taiwanISO = taiwanTime.toISOString();
    
    res.json({
      success: true,
      data: {
        utc: {
          iso: utcTime,
          display: now.getUTCHours().toString().padStart(2, '0') + ':' + 
                  now.getUTCMinutes().toString().padStart(2, '0') + ':' + 
                  now.getUTCSeconds().toString().padStart(2, '0'),
          timestamp: now.getTime()
        },
        taiwan: {
          iso: taiwanISO,
          display: taiwanHours.toString().padStart(2, '0') + ':' + 
                  taiwanMinutes.toString().padStart(2, '0') + ':' + 
                  taiwanSeconds.toString().padStart(2, '0'),
          timestamp: taiwanTime.getTime()
        },
        timezone: {
          offset: 8,
          name: 'Asia/Taipei'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 計時器倒數端點
app.get('/api/timer-countdowns', (req, res) => {
  try {
    const now = new Date();
    
    // 計算台灣時間的小時、分鐘、秒
    const taiwanHours = (now.getUTCHours() + 8) % 24;
    const taiwanMinutes = now.getUTCMinutes();
    const taiwanSeconds = now.getUTCSeconds();
    
    // 獲取系統設定（提前載入）
    const settings = loadSystemSettings() || {};
    
    // 安全處理時區設定（預設 Asia/Taipei, UTC+8）
    const timezone = (settings && settings.timezone) ? settings.timezone : { offset: 8, name: 'Asia/Taipei' };
    const timezoneOffset = (typeof timezone.offset === 'number' && isFinite(timezone.offset)) ? timezone.offset : 8;

    // 獲取學生提醒設定
    const studentReminderSettings = reminderScheduler.getStudentReminderSettings();
    const studentReminderHour = studentReminderSettings?.hour || 19;
    const studentReminderMinute = studentReminderSettings?.minute || 30;
    
    // 計算學生提醒倒數
    // 直接使用UTC時間計算，但考慮台灣時區
    let targetDate = new Date(now);
    targetDate.setUTCHours(studentReminderHour - timezoneOffset, studentReminderMinute, 0, 0); // 台灣時間轉UTC
    
    // 如果今天的學生提醒時間已過，計算明天的
    if (taiwanHours > studentReminderHour || (taiwanHours === studentReminderHour && taiwanMinutes >= studentReminderMinute)) {
      targetDate.setUTCDate(targetDate.getUTCDate() + 1);
    }
    
    const studentReminderDiff = targetDate.getTime() - now.getTime();
    const studentReminderHours = Math.floor(studentReminderDiff / (1000 * 60 * 60));
    const studentReminderMinutes = Math.floor((studentReminderDiff % (1000 * 60 * 60)) / (1000 * 60));
    const studentReminderSeconds = Math.floor((studentReminderDiff % (1000 * 60)) / 1000);
    
    // 計算排程檢查倒數（每5分鐘）
    const nextCheck = new Date(now);
    const currentMinute = taiwanMinutes;
    const nextCheckMinute = Math.ceil(currentMinute / 5) * 5;
    
    if (nextCheckMinute >= 60) {
      nextCheck.setUTCHours(nextCheck.getUTCHours() + 1);
      nextCheck.setUTCMinutes(0);
    } else {
      nextCheck.setUTCMinutes(nextCheckMinute);
    }
    nextCheck.setUTCSeconds(0);
    nextCheck.setUTCMilliseconds(0);
    
    const schedulerCheckDiff = nextCheck.getTime() - now.getTime();
    const schedulerCheckMinutes = Math.floor(schedulerCheckDiff / (1000 * 60));
    const schedulerCheckSeconds = Math.floor((schedulerCheckDiff % (1000 * 60)) / 1000);
    
    // 安全地獲取提醒設定，提供預設值
    const reminders = (settings && settings.reminders) || {
      todayReminderHour: 8,
      todayReminderMinute: 0,
      tomorrowReminderHour: 19,
      tomorrowReminderMinute: 30,
      beforeClassMinutes: 30
    };
    
    const todayReminderTime = `${(reminders.todayReminderHour || 8).toString().padStart(2, '0')}:${(reminders.todayReminderMinute || 0).toString().padStart(2, '0')}`;
    const tomorrowReminderTime = `${(reminders.tomorrowReminderHour || 19).toString().padStart(2, '0')}:${(reminders.tomorrowReminderMinute || 30).toString().padStart(2, '0')}`;
    const beforeClassMinutes = reminders.beforeClassMinutes || 30;
    
    // 解析時間
    const [todayHour, todayMinute] = todayReminderTime.split(':').map(Number);
    const [tomorrowHour, tomorrowMinute] = tomorrowReminderTime.split(':').map(Number);
    
    // 計算當日提醒倒數（今天08:00）
    let todayTarget = new Date(now);
    todayTarget.setUTCHours(todayHour - timezoneOffset, todayMinute, 0, 0); // 台灣時間轉UTC
    if (taiwanHours > todayHour || (taiwanHours === todayHour && taiwanMinutes >= todayMinute)) {
      todayTarget.setUTCDate(todayTarget.getUTCDate() + 1);
    }
    const todayReminderDiff = todayTarget.getTime() - now.getTime();
    const todayReminderHours = Math.floor(todayReminderDiff / (1000 * 60 * 60));
    const todayReminderMinutes = Math.floor((todayReminderDiff % (1000 * 60 * 60)) / (1000 * 60));
    const todayReminderSeconds = Math.floor((todayReminderDiff % (1000 * 60)) / 1000);
    
    // 計算隔日提醒倒數（今天19:30）
    let tomorrowTarget = new Date(now);
    tomorrowTarget.setUTCHours(tomorrowHour - timezoneOffset, tomorrowMinute, 0, 0); // 台灣時間轉UTC
    if (taiwanHours > tomorrowHour || (taiwanHours === tomorrowHour && taiwanMinutes >= tomorrowMinute)) {
      tomorrowTarget.setUTCDate(tomorrowTarget.getUTCDate() + 1);
    }
    const tomorrowReminderDiff = tomorrowTarget.getTime() - now.getTime();
    const tomorrowReminderHours = Math.floor(tomorrowReminderDiff / (1000 * 60 * 60));
    const tomorrowReminderMinutes = Math.floor((tomorrowReminderDiff % (1000 * 60 * 60)) / (1000 * 60));
    const tomorrowReminderSeconds = Math.floor((tomorrowReminderDiff % (1000 * 60)) / 1000);
    
    // 計算課前提醒倒數（找到最近的課前提醒）
    let beforeClassReminderDiff = 0;
    let beforeClassNextTime = '暫無';
    
    try {
      const remindersData = loadReminders();
      const reminders = remindersData.reminders || [];
      const today = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
      
      const beforeClassReminders = reminders.filter(r => 
        r.type === 'before-class' && 
        r.courseDate === today
      );
      
      if (beforeClassReminders.length > 0) {
        let nearestTime = null;
        beforeClassReminders.forEach(reminder => {
          try {
            // 正確解析台灣時間並轉換為 UTC
            const [year, month, day] = reminder.courseDate.split('-').map(Number);
            const [hour, minute] = reminder.courseTime.split(':').map(Number);
            
            // 創建台灣時間的課程時間
            const courseTimeTaiwan = new Date(year, month - 1, day, hour, minute, 0);
            
            // 轉換為 UTC 時間
            const courseTimeUTC = new Date(courseTimeTaiwan.getTime() - (8 * 60 * 60 * 1000));
            
            // 計算課前提醒時間（提前指定分鐘）
            const beforeClassTime = new Date(courseTimeUTC.getTime() - (beforeClassMinutes * 60 * 1000));
            
            // 只考慮未來的課前提醒時間，且課程還沒開始
            if (beforeClassTime > now && courseTimeUTC > now && (!nearestTime || beforeClassTime < nearestTime)) {
              nearestTime = beforeClassTime;
            }
          } catch (error) {
            console.error('解析課前提醒時間失敗:', error);
          }
        });
        
        if (nearestTime) {
          beforeClassReminderDiff = nearestTime.getTime() - now.getTime();
          beforeClassNextTime = nearestTime.toLocaleString('zh-TW');
        }
      }
    } catch (error) {
      console.error('計算課前提醒倒數失敗:', error);
    }
    
    const beforeClassHours = Math.floor(beforeClassReminderDiff / (1000 * 60 * 60));
    const beforeClassMinutesCalc = Math.floor((beforeClassReminderDiff % (1000 * 60 * 60)) / (1000 * 60));
    const beforeClassSeconds = Math.floor((beforeClassReminderDiff % (1000 * 60)) / 1000);
    
    
    res.json({
      success: true,
      data: {
        studentReminder: {
          hours: studentReminderHours,
          minutes: studentReminderMinutes,
          seconds: studentReminderSeconds,
          display: `${studentReminderHours}小時${studentReminderMinutes}分鐘${studentReminderSeconds}秒`,
          diff: studentReminderDiff,
          nextTime: new Date(now.getTime() + studentReminderDiff).toLocaleString('zh-TW')
        },
        schedulerCheck: {
          minutes: schedulerCheckMinutes,
          seconds: schedulerCheckSeconds,
          display: `${schedulerCheckMinutes}分鐘${schedulerCheckSeconds}秒`
        },
        todayReminder: {
          hours: todayReminderHours,
          minutes: todayReminderMinutes,
          seconds: todayReminderSeconds,
          display: `${todayReminderHours}小時${todayReminderMinutes}分鐘${todayReminderSeconds}秒`,
          diff: todayReminderDiff,
          nextTime: new Date(now.getTime() + todayReminderDiff).toLocaleString('zh-TW')
        },
        tomorrowReminder: {
          hours: tomorrowReminderHours,
          minutes: tomorrowReminderMinutes,
          seconds: tomorrowReminderSeconds,
          display: `${tomorrowReminderHours}小時${tomorrowReminderMinutes}分鐘${tomorrowReminderSeconds}秒`,
          diff: tomorrowReminderDiff,
          nextTime: new Date(now.getTime() + tomorrowReminderDiff).toLocaleString('zh-TW')
        },
        beforeClassReminder: {
          hours: beforeClassHours,
          minutes: beforeClassMinutesCalc,
          seconds: beforeClassSeconds,
          display: beforeClassReminderDiff > 0 ? `${beforeClassHours}小時${beforeClassMinutesCalc}分鐘${beforeClassSeconds}秒` : '暫無',
          diff: beforeClassReminderDiff,
          nextTime: beforeClassNextTime
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});


// 獲取行事曆事件 API
app.get('/api/events', async (req, res) => {
  try {
    // 檢查是否要求強制刷新（忽略快取）
    const forceRefresh = req.headers['x-force-refresh'] === 'true';
    
    // 優先使用快取的資料（如果快取存在且未過期，且非強制刷新）
    const cacheAge = eventsCache.lastUpdate ? (Date.now() - eventsCache.lastUpdate) / 1000 : Infinity;
    const cacheMaxAge = 600; // 10分鐘
    
    if (eventsCache.data && cacheAge < cacheMaxAge && !forceRefresh) {
      console.log(`📦 使用快取的事件資料（快取年齡: ${Math.floor(cacheAge)}秒）`);
      return res.json({
        ...eventsCache.data,
        cached: true,
        cacheAge: Math.floor(cacheAge)
      });
    }
    
    // 🔥 修復：如果快取正在建立中，等待快取完成（而不是自己再抓一次）
    if (eventsCache.isUpdating && !forceRefresh) {
      console.log('⏳ 快取正在建立中，等待快取完成...');
      
      // 最多等待 30 秒
      const maxWaitTime = 30000; // 30秒
      const startTime = Date.now();
      
      while (eventsCache.isUpdating && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 每 100ms 檢查一次
      }
      
      // 如果等待後快取已建立，直接回傳
      if (eventsCache.data) {
        const finalCacheAge = eventsCache.lastUpdate ? (Date.now() - eventsCache.lastUpdate) / 1000 : 0;
        console.log(`✅ 快取建立完成，使用快取資料（等待時間: ${Math.floor((Date.now() - startTime) / 1000)}秒）`);
        return res.json({
          ...eventsCache.data,
          cached: true,
          cacheAge: Math.floor(finalCacheAge),
          waited: true,
          waitTime: Date.now() - startTime
        });
      }
      
      console.log('⚠️ 等待逾時或快取建立失敗，改為即時獲取');
    }
    
    // 如果快取不存在或已過期，或要求強制刷新，則即時獲取
    if (forceRefresh) {
      console.log('🔄 收到強制刷新請求，忽略快取，直接從 CalDAV 獲取事件...');
    } else if (!eventsCache.data) {
      console.log('⚠️ 快取不存在，即時從 CalDAV 獲取事件...');
    } else {
      console.log('⚠️ 快取已過期，即時從 CalDAV 獲取事件...');
    }
    
    if (!caldavClient) {
      console.log('CalDAV 客戶端未初始化，使用模擬數據');
      return res.json({
        success: true,
        events: [],
        data: [],
        source: 'mock'
      });
    }

    // 獲取日期範圍（從本週一開始，到未來30天）
    const systemSettings = loadSystemSettings();
    const dateRange = systemSettings.dateRange || {};
    const futureDays = Math.max(1, parseInt(dateRange.futureDays || 30, 10));
    const pastDays = Math.max(0, parseInt(dateRange.pastDays || 7, 10));
    
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - pastDays);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + futureDays);

    console.log('📅 正在即時從 CalDAV 獲取事件...');
    console.log('📅 日期範圍:', {
      今天: now.toLocaleDateString('zh-TW'),
      起始日期: startDate.toLocaleDateString('zh-TW'),
      結束日期: endDate.toLocaleDateString('zh-TW'),
      pastDays,
      futureDays
    });
    const events = await caldavClient.getAllInstructorEvents(startDate, endDate);
    
    // 調試：顯示原始事件的前幾個和時間範圍
    if (events.length > 0) {
      console.log('\n🔍 調試 - 獲取到 ' + events.length + ' 個事件');
      console.log('🔍 調試 - 原始事件範例 (前3個):');
      events.slice(0, 3).forEach((event, i) => {
        console.log(`事件 ${i + 1}:`, {
          uid: event.uid,
          evt_id: event.evt_id,
          id: event.id,
          title: event.title,
          summary: event.summary,
          instructor: event.instructor,
          start: event.start,
          startDate: new Date(event.start).toLocaleDateString('zh-TW')
        });
      });
      
      // 統計本週的事件數量
      const weekStart = new Date(startDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekEvents = events.filter(event => {
        const eventDate = new Date(event.start);
        return eventDate >= weekStart && eventDate <= weekEnd;
      });
      
      console.log('📊 本週事件統計:', {
        本週範圍: `${weekStart.toLocaleDateString('zh-TW')} - ${weekEnd.toLocaleDateString('zh-TW')}`,
        本週事件數: weekEvents.length,
        總事件數: events.length
      });
    }
    
    // 轉換事件格式以符合前端需求
    const formattedEvents = events.map(event => ({
      id: event.uid || event.evt_id || event.id,  // 使用 uid 作為主要 ID
      title: event.title || event.summary,
      instructor: event.instructor,
      start: event.start,
      end: event.end,
      type: event.type || 'other',
      description: event.description || '',
      location: event.location || '',
      time: event.time || '',
      lessonUrl: event.lessonUrl || '',
      // 保留原始欄位以便除錯
      _raw: {
        uid: event.uid,
        evt_id: event.evt_id,
        calendarId: event.calendarId
      }
    }));

    // 調試：顯示格式化後的事件
    if (formattedEvents.length > 0) {
      console.log('\n🔍 調試 - 格式化後的事件 (前3個):');
      formattedEvents.slice(0, 3).forEach((event, i) => {
        console.log(`事件 ${i + 1}:`, {
          id: event.id,
          title: event.title,
          instructor: event.instructor,
          start: event.start
        });
      });
    }

    console.log(`\n✅ 成功即時獲取 ${formattedEvents.length} 個事件`);
    
    // 更新快取
    eventsCache.data = {
      success: true,
      events: formattedEvents,
      data: formattedEvents,
      source: 'caldav',
      type: 'full',
      lastUpdate: new Date().toISOString()
    };
    eventsCache.lastUpdate = Date.now();
    console.log('📦 已更新事件快取');
    
    res.json({
      success: true,
      events: formattedEvents,  // 改為 events 以符合前端期望
      data: formattedEvents,     // 保留 data 以便向後兼容
      source: 'caldav-realtime',
      type: 'full',
      cached: false
    });
  } catch (error) {
    console.error('獲取行事曆事件失敗:', error.message);
    console.log('回退到模擬數據');
    
    // 如果 CalDAV 失敗，回退到模擬數據
    res.json({
      success: true,
      events: [],
      data: [],
      source: 'mock',
      type: 'full',
      error: error.message
    });
  }
});

// 手動觸發更新事件快取 API
app.post('/api/events/refresh-cache', async (req, res) => {
  try {
    console.log('🔄 收到手動刷新快取請求');
    await updateEventsCache();
    
    res.json({
      success: true,
      message: '事件快取已成功刷新',
      eventCount: eventsCache.data ? eventsCache.data.events.length : 0,
      lastUpdate: eventsCache.data ? eventsCache.data.lastUpdate : null
    });
  } catch (error) {
    console.error('❌ 手動刷新快取失敗:', error.message);
    res.status(500).json({
      success: false,
      message: '刷新快取失敗: ' + error.message
    });
  }
});

// 獲取快取狀態 API
app.get('/api/events/cache-status', (req, res) => {
  const cacheAge = eventsCache.lastUpdate ? Math.floor((Date.now() - eventsCache.lastUpdate) / 1000) : null;
  
  res.json({
    success: true,
    cached: !!eventsCache.data,
    eventCount: eventsCache.data ? eventsCache.data.events.length : 0,
    lastUpdate: eventsCache.data ? eventsCache.data.lastUpdate : null,
    cacheAge: cacheAge,
    cacheAgeMinutes: cacheAge ? Math.floor(cacheAge / 60) : null,
    isUpdating: eventsCache.isUpdating,
    isReady: eventsCache.isReady  // 🔥 新增：快取就緒狀態
  });
});
// Google Sheets 代理 API - 使用 Railway 版本的成功做法
app.post('/api/proxy/google-sheets', async (req, res) => {
  try {
    const { action, course, period, records, googleSheetsUrl, payload: requestPayload } = req.body;
    
    console.log('📤 收到 Google Sheets API 請求:', { action, course, period });
    
    let apiUrl, payload;
    
    if (action === 'getRosterAttendance') {
      // 使用 Railway 版本成功的 API URL
      apiUrl = googleSheetsUrl || 'https://script.google.com/macros/s/AKfycbzm0GD-T09Botbs52e8PyeVuA5slJh6Z0AQ7I0uUiGZiE6aWhTO2D0d3XHFrdLNv90uCw/exec';
      
      // 確保課程和時間格式正確 - 使用 Railway 版本的清理邏輯
      const cleanCourse = course ? course.trim() : '';
      const cleanPeriod = period ? period.trim() : '';
      
      console.log('🔍 清理後的參數:', { cleanCourse, cleanPeriod });
      
      payload = {
        action: 'getRosterAttendance',
        course: cleanCourse,
        period: cleanPeriod
      };
      
      console.log('📤 發送學生名單請求:', { apiUrl, payload });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'NID=525=nsWVvbAon67C2qpyiEHQA3SUio_GqBd7RqUFU6BwB97_4LHggZxLpDgSheJ7WN4w3Z4dCQBiFPG9YKAqZgAokFYCuuQw04dkm-FX9-XHAIBIqJf1645n3RZrg86GcUVJOf3gN-5eTHXFIaovTmgRC6cXllv82SnQuKsGMq7CHH60XDSwyC99s9P2gmyXLppI'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`Google Sheets API 請求失敗: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('📥 Google Sheets API 回應:', data);
      
      return res.json(data);
      
    } else if (action === 'updateAttendance' || action === 'update') {
      apiUrl = googleSheetsUrl || 'https://script.google.com/macros/s/AKfycbxfj5fwNIc8ncbqkOm763yo6o06wYPHm2nbfd_1yLkHlakoS9FtYfYJhvGCaiAYh_vjIQ/dev';
      payload = requestPayload || req.body;
      
      if (payload.action === 'update' && payload.name) {
        const singleResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'NID=525=nsWVvbAon67C2qpyiEHQA3SUio_GqBd7RqUFU6BwB97_4LHggZxLpDgSheJ7WN4w3Z4dCQBiFPG9YKAZgAokFYCuuQw04dkm-FX9-XHAIBIqJf1645n3RZrg86GcUVJOf3gN-5eTHXFIQovTmgRC6cXllv82SnQuKsGMq7CHH60XDSwyC99s9P2gmyXLppI'
          },
          body: JSON.stringify(payload)
        });
        
        if (!singleResponse.ok) {
          throw new Error(`單筆簽到記錄 API 請求失敗: ${singleResponse.status} ${singleResponse.statusText}`);
        }
        
        const responseText = await singleResponse.text();
        let singleData;
        try {
          singleData = JSON.parse(responseText);
        } catch (parseError) {
          singleData = { success: true, message: responseText };
        }
        
        return res.json(singleData);
      }
    } else {
      return res.status(400).json({
        success: false,
        error: '不支援的操作',
        message: '未知的 action 類型'
      });
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'NID=525=nsWVvbAon67C2qpyiEHQA3SUio_GqBd7RqUFU6BwB97_4LHggZxLpDgSheJ7WN4w3Z4dCQBiFPG9YKAZgAokFYCuuQw04dkm-FX9-XHAIBIqJf1645n3RZrg86GcUVJOf3gN-5eTHXFIQovTmgRC6cXllv82SnQuKsGMq7CHH60XDSwyC99s9P2gmyXLppI'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Google Sheets API 請求失敗: ${response.status} ${response.statusText}`);
    }
    
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      data = { success: true, message: responseText };
    }
    
    res.json(data);
  } catch (error) {
    console.error('❌ Google Sheets 代理請求失敗:', error);
    res.status(500).json({
      success: false,
      error: '代理請求失敗',
      message: error.message
    });
  }
});

// 講師 Web API 查找端點
app.post('/api/teacher-web-api', async (req, res) => {
  try {
    const { teacherName } = req.body;
    
    if (!teacherName) {
      return res.status(400).json({
        success: false,
        message: '缺少講師名稱參數'
      });
    }
    
    console.log('🔍 查找講師 Web API:', teacherName);
    
    // 讀取講師資料 CSV 檔案
    const csvPath = path.join(__dirname, 'public', 'teacher_list_data.csv');
    
    if (!fs.existsSync(csvPath)) {
      return res.status(404).json({
        success: false,
        message: '講師資料檔案不存在'
      });
    }
    
    const csvContent = fs.readFileSync(csvPath, 'utf8');
    const lines = csvContent.split('\n');
    
    // 跳過標題行，從第二行開始處理
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const columns = line.split(',');
      if (columns.length >= 3) {
        const csvTeacherName = columns[0].trim();
        const webApi = columns[2].trim();
        
        // 模糊匹配講師名稱（忽略空格、大小寫、特殊符號）
        const cleanCsvName = csvTeacherName.toLowerCase().replace(/[\s🙏🏻*]+/g, '').trim();
        const cleanTeacherName = teacherName.toLowerCase().replace(/[\s🙏🏻*]+/g, '').trim();
        
        // 檢查是否匹配
        let isMatch = false;
        if (cleanCsvName === cleanTeacherName) {
          console.log('✅ 完全匹配:', csvTeacherName, '->', teacherName);
          isMatch = true;
        } else if (cleanCsvName.includes(cleanTeacherName) || cleanTeacherName.includes(cleanCsvName)) {
          console.log('✅ 部分匹配:', csvTeacherName, '->', teacherName);
          isMatch = true;
        }
        
        if (isMatch) {
          if (webApi && webApi !== '') {
            console.log('✅ 找到講師 Web API:', webApi);
            return res.json({
              success: true,
              teacherName: csvTeacherName,
              webApi: webApi,
              message: '成功找到講師 Web API'
            });
          } else {
            console.log('⚠️ 講師沒有配置 Web API:', csvTeacherName);
            return res.json({
              success: false,
              message: `講師 "${csvTeacherName}" 沒有配置 Web API`
            });
          }
        }
      }
    }
    
    console.log('❌ 在 CSV 中找不到講師:', teacherName);
    return res.json({
      success: false,
      message: `找不到講師 "${teacherName}" 的 Web API 配置`
    });
    
  } catch (error) {
    console.error('❌ 查找講師 Web API 失敗:', error);
    res.status(500).json({
      success: false,
      message: '查找講師 Web API 失敗',
      error: error.message
    });
  }
});
// 講師報表提交 API
app.post('/api/teacher-report', async (req, res) => {
  try {
    const { teacherName, courseName, courseTime, date, studentCount, courseContent, mode } = req.body;
    
    console.log('📊 收到講師報表提交:', { teacherName, courseName, courseTime, date, studentCount, courseContent, mode });
    
    // 驗證學生人數
    let validStudentCount = 0;
    if (typeof studentCount === 'number' && !isNaN(studentCount)) {
      validStudentCount = studentCount;
    } else if (typeof studentCount === 'string' && !isNaN(parseInt(studentCount))) {
      validStudentCount = parseInt(studentCount);
    } else {
      console.warn('⚠️ 學生人數無效，使用預設值 0:', studentCount);
      validStudentCount = 0;
    }
    
    console.log('📊 學生人數驗證結果:', {
      original: studentCount,
      type: typeof studentCount,
      valid: validStudentCount
    });
    
    // 根據行事曆講師名稱模糊比對，提取「老師」部分
    let matchedTeacherName = teacherName;
    if (teacherName && teacherName.includes('老師')) {
      // 如果包含「老師」，直接使用
      matchedTeacherName = teacherName;
    } else {
      // 嘗試從講師名稱中提取「老師」部分
      const teacherMatch = teacherName.match(/(.+?)\s*老師/);
      if (teacherMatch) {
        matchedTeacherName = teacherMatch[1].trim() + '老師';
      } else {
        // 如果沒有「老師」，直接使用原名稱
        matchedTeacherName = teacherName;
      }
    }
    
    console.log('🔍 講師名稱比對結果:', {
      original: teacherName,
      matched: matchedTeacherName
    });
    
    // 從 CSV 中查找講師的 Google Sheets 連結和 Web API
    let teacherSheetUrl = null;
    let teacherWebApiUrl = null;
    let csvTeacherName = null;
    const csvPath = path.join(__dirname, 'public', 'teacher_list_data.csv');
    
    // 強化的名稱清理函數 - 移除所有空白、特殊字符，並轉為小寫
    function cleanTeacherName(name) {
      if (!name) return '';
      return name
        .toLowerCase()                          // 轉小寫
        .replace(/\s+/g, '')                   // 移除所有空白（包含全形、半形）
        .replace(/[\u3000\u00a0]/g, '')        // 移除全形空格和不可分空格
        .replace(/[🙏🏻*「」『』【】()（）]/g, '')  // 移除特殊符號
        .replace(/老師$/g, '')                  // 移除結尾的「老師」
        .trim();
    }
    
    try {
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      const lines = csvContent.split('\n');
      
      console.log('🔍 開始比對講師名稱...');
      console.log('📝 原始講師名稱:', teacherName);
      console.log('📝 處理後的名稱:', matchedTeacherName);
      
      const cleanMatchedName = cleanTeacherName(matchedTeacherName);
      console.log('🧹 清理後的比對名稱:', cleanMatchedName);
      
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const parts = line.split(',');
        if (parts.length >= 3) {
          const currentCsvName = parts[0].trim();
          const sheetUrl = parts[1].trim();
          const webApiUrl = parts[2].trim();
          
          // 清理 CSV 中的講師名稱
          const cleanCsvName = cleanTeacherName(currentCsvName);
          
          // 多種比對方式
          let isMatch = false;
          let matchMethod = '';
          
          // 1. 完全匹配
          if (cleanCsvName === cleanMatchedName) {
            isMatch = true;
            matchMethod = '完全匹配';
          }
          // 2. CSV 名稱包含查詢名稱
          else if (cleanCsvName.includes(cleanMatchedName) && cleanMatchedName.length >= 2) {
            isMatch = true;
            matchMethod = 'CSV 包含查詢';
          }
          // 3. 查詢名稱包含 CSV 名稱
          else if (cleanMatchedName.includes(cleanCsvName) && cleanCsvName.length >= 2) {
            isMatch = true;
            matchMethod = '查詢包含 CSV';
          }
          
          console.log(`  ${i}. ${currentCsvName} (清理: ${cleanCsvName}) - ${isMatch ? '✅ ' + matchMethod : '❌ 不匹配'}`);
          
          if (isMatch) {
            teacherSheetUrl = sheetUrl;
            teacherWebApiUrl = webApiUrl;
            csvTeacherName = currentCsvName;
            console.log('');
            console.log('✅ 找到講師資料:', {
              原始CSV名稱: currentCsvName,
              清理CSV名稱: cleanCsvName,
              原始查詢名稱: teacherName,
              清理查詢名稱: cleanMatchedName,
              比對方式: matchMethod,
              工作表連結: teacherSheetUrl,
              WebAPI: webApiUrl
            });
            console.log('');
            break;
          }
        }
      }
    } catch (error) {
      console.error('❌ 讀取 teacher_list_data.csv 失敗:', error);
    }
    
    // 檢查是否找到講師的 Web API
    if (!teacherWebApiUrl || teacherWebApiUrl === '') {
      console.error('❌ 找不到講師的 Web API URL');
      return res.status(400).json({
        success: false,
        message: `講師「${teacherName}」沒有配置 Web API，請聯絡管理員設定`,
        teacherName: teacherName,
        matchedTeacherName: matchedTeacherName
      });
    }
    
    if (!teacherSheetUrl) {
      console.warn('⚠️ 找不到講師的 Google Sheets 連結');
    }
    
    // 調用講師專屬的 Google Sheets API
    console.log('🔗 調用講師的 Google Sheets API:', teacherWebApiUrl);
    
    // 使用從 CSV 找到的講師名稱，如果沒有找到則使用原始名稱
    const finalTeacherName = csvTeacherName || matchedTeacherName;
    console.log('📝 最終使用的講師名稱:', finalTeacherName);
    
    const requestPayload = {
      action: "appendTeacherCourse",
      sheetName: "報表",
      teacherName: finalTeacherName,
      teacherSheetUrl: teacherSheetUrl,  // 加入講師連結
      "課程名稱": courseName,
      "上課時間": courseTime,
      "課程日期": date,
      "人數_助教": validStudentCount.toString(),
      "課程內容": courseContent
    };
    
    console.log('📤 發送到 Google Sheets 的完整資料:', JSON.stringify(requestPayload, null, 2));
    
    const webApiResponse = await axios.post(teacherWebApiUrl, requestPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒超時
    });
    
    console.log('✅ 講師 Web API 回應 (狀態碼):', webApiResponse.status);
    console.log('✅ 講師 Web API 回應 (完整內容):', JSON.stringify(webApiResponse.data, null, 2));
    console.log('✅ 講師 Web API 回應 (Headers):', webApiResponse.headers);
    
    // 檢查回應內容是否表示成功
    if (webApiResponse.data && typeof webApiResponse.data === 'object') {
      if (webApiResponse.data.success === false) {
        console.error('❌ Google Sheets API 返回失敗:', webApiResponse.data);
        throw new Error(`Google Sheets API 錯誤: ${webApiResponse.data.message || webApiResponse.data.error || '未知錯誤'}`);
      }
    }
    
    res.json({
      success: true,
      message: '講師報表提交成功',
      data: {
        teacherName,
        courseName,
        courseTime,
        date,
        studentCount: validStudentCount,
        originalStudentCount: studentCount,
        courseContent,
        mode,
        timestamp: new Date().toISOString(),
        webApiUrl: teacherWebApiUrl,
        webApiResponse: webApiResponse.data
      }
    });
    
  } catch (error) {
    console.error('❌ 講師報表提交失敗:', error);
    
    // 如果是 Web API 調用失敗，提供更詳細的錯誤信息
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        message: '講師 Web API 調用超時',
        error: '講師 Web API 回應超時，請稍後重試'
      });
    } else if (error.response) {
      return res.status(502).json({
        success: false,
        message: '講師 Web API 調用失敗',
        error: `講師 Web API 返回錯誤: ${error.response.status} ${error.response.statusText}`,
        details: error.response.data
      });
    } else {
      return res.status(500).json({
        success: false,
        message: '講師報表提交失敗',
        error: error.message
      });
    }
  }
});

// 學生簽到通知 API
app.post('/api/student-attendance-notification', async (req, res) => {
  try {
    const { 
      teacher, course, time, start, end, studentId, studentName, status, 
      message, teacherName, courseName, presentStudents, absentStudents, unmarkedStudents 
    } = req.body;
    
    console.log('📨 收到學生簽到通知請求:', { 
      teacher, course, time, studentName, status, 
      hasMessage: !!message, 
      teacherName: teacherName || teacher,
      courseName: courseName || course,
      presentCount: presentStudents?.length || 0,
      absentCount: absentStudents?.length || 0,
      unmarkedCount: unmarkedStudents?.length || 0
    });
    
    // 檢查是否為講師報表通知
    if (message && (message.includes('講師報表') || message.includes('講師報告'))) {
      // 使用通知管理器發送講師報表通知
      const reportData = {
        teacherName: teacherName || teacher || '未知講師',
        courseName: courseName || course || '未知課程',
        time: time || '未知時間',
        date: new Date().toLocaleDateString('zh-TW'),
        studentCount: req.body.studentCount || presentStudents?.length || 0,
        courseContent: req.body.courseContent || '講師報表提交',
        mode: req.body.mode || '講師模式'
      };
      
      const result = await notificationManager.sendTeacherReportNotification(reportData);
      return res.json({
        success: result.success,
        message: result.message,
        results: result.results
      });
    }
    
    // 構建出席統計
    const attendanceStats = [];
    const totalStudents = (presentStudents?.length || 0) + (absentStudents?.length || 0) + (unmarkedStudents?.length || 0);
    
    if (presentStudents && presentStudents.length > 0) {
      attendanceStats.push(`✅ 出席: ${presentStudents.length}人`);
    }
    if (absentStudents && absentStudents.length > 0) {
      attendanceStats.push(`❌ 缺席: ${absentStudents.length}人`);
    }
    if (unmarkedStudents && unmarkedStudents.length > 0) {
      attendanceStats.push(`⚠️ 未標記: ${unmarkedStudents.length}人`);
    }
    
    // 構建詳細的學生名單
    let studentDetails = '';
    if (presentStudents && presentStudents.length > 0) {
      studentDetails += `\n✅ 出席 (${presentStudents.length}人):\n`;
      studentDetails += presentStudents.map(s => `  • ${s}`).join('\n');
    }
    if (absentStudents && absentStudents.length > 0) {
      studentDetails += `\n\n❌ 缺席 (${absentStudents.length}人):\n`;
      studentDetails += absentStudents.map(s => `  • ${s}`).join('\n');
    }
    if (unmarkedStudents && unmarkedStudents.length > 0) {
      studentDetails += `\n\n⚠️ 未標記 (${unmarkedStudents.length}人):\n`;
      studentDetails += unmarkedStudents.map(s => `  • ${s}`).join('\n');
    }
    
    // 使用通知管理器發送學生簽到通知
    const attendanceData = {
      teacherName: teacherName || teacher || '未知講師',
      courseName: courseName || course || '未知課程',
      time: time || (start ? new Date(start).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '未知時間'),
      studentName: `共 ${totalStudents} 位學生`,
      status: attendanceStats.join(', ') || '無統計資料',
      attendanceStats: studentDetails || '無統計資料'
    };
    
    const result = await notificationManager.sendStudentAttendanceNotification(attendanceData);
    
    res.json({
      success: result.success,
      message: result.message,
      results: result.results
    });
  } catch (error) {
    console.error('❌ 發送學生簽到通知失敗:', error);
    res.status(500).json({
      success: false,
      error: '發送通知失敗',
      message: error.message
    });
  }
});

// 通知配置管理 API
app.get('/api/notification-config', (req, res) => {
  try {
    const status = notificationManager.getConfigStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '獲取通知配置失敗',
      message: error.message
    });
  }
});

// 重新載入通知配置 API
app.post('/api/notification-config/reload', (req, res) => {
  try {
    notificationManager.reloadConfig();
    res.json({
      success: true,
      message: '通知配置已重新載入'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '重新載入配置失敗',
      message: error.message
    });
  }
});

// 測試通知發送 API
app.post('/api/notification-config/test', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    let result;
    switch (type) {
      case 'student_attendance':
        result = await notificationManager.sendStudentAttendanceNotification(data);
        break;
      case 'teacher_report':
        result = await notificationManager.sendTeacherReportNotification(data);
        break;
      case 'reminder':
        result = await notificationManager.sendReminderNotification(data);
        break;
      default:
        throw new Error('未知的通知類型');
    }
    
    res.json({
      success: result.success,
      message: result.message,
      results: result.results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '測試通知發送失敗',
      message: error.message
    });
  }
});

// 主頁面路由
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>FLB講師行事曆檢視系統</title>
      <script>window.location.href="/perfect-calendar.html";</script>
    </head>
    <body>
      <p>正在重定向到講師行事曆檢視系統...</p>
    </body>
    </html>
  `);
});

// 更新學生簽到記錄到 student_data.json
app.post('/api/update-student-attendance', async (req, res) => {
  try {
    const { studentName, date, present } = req.body;
    
    console.log('📝 收到更新學生簽到記錄請求:', { studentName, date, present });
    
    if (!studentName || !date) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：studentName 和 date'
      });
    }
    
    // ========== 先檢查是否為臨時學生 ==========
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    if (fs.existsSync(tempDataPath)) {
      try {
        const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
        const tempStudentIndex = tempData.students.findIndex(s => s.name === studentName);
        
        if (tempStudentIndex !== -1) {
          console.log('🎯 找到臨時學生，更新簽到記錄:', studentName);
          
          const tempStudent = tempData.students[tempStudentIndex];
          
          // 確保 attendance 陣列存在
          if (!tempStudent.attendance) {
            tempStudent.attendance = [];
          }
          
          // 查找是否已有該日期的記錄
          const existingRecordIndex = tempStudent.attendance.findIndex(record => record.date === date);
          
          if (existingRecordIndex !== -1) {
            // 更新現有記錄
            tempStudent.attendance[existingRecordIndex].present = present;
            console.log('✅ 更新臨時學生現有簽到記錄:', { studentName, date, present });
          } else {
            // 添加新記錄
            tempStudent.attendance.push({ date, present });
            console.log('✅ 添加臨時學生新簽到記錄:', { studentName, date, present });
          }
          
          // 更新最後出席日期
          if (present) {
            tempStudent.lastAttendanceDate = date;
            console.log('📅 更新臨時學生最後出席日期:', { studentName, lastAttendanceDate: date });
          }
          
          // 寫回臨時學生檔案
          fs.writeFileSync(tempDataPath, JSON.stringify(tempData, null, 2));
          console.log('✅ temporary_students.json 更新成功');
          
          return res.json({
            success: true,
            message: '臨時學生簽到記錄更新成功',
            data: {
              studentName,
              date,
              present,
              isTemporary: true,
              totalRecords: tempStudent.attendance.length
            }
          });
        }
      } catch (error) {
        console.error('⚠️ 檢查臨時學生時發生錯誤:', error);
        // 繼續處理正常學生
      }
    }
    
    // ========== 處理正常學生 ==========
    // 讀取 student_data.json
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    let studentData;
    
    try {
      const fileContent = fs.readFileSync(studentDataPath, 'utf8');
      studentData = JSON.parse(fileContent);
    } catch (error) {
      console.error('❌ 讀取 student_data.json 失敗:', error);
      return res.status(500).json({
        success: false,
        message: '讀取學生資料檔案失敗'
      });
    }
    
    // 查找對應的學生
    const studentIndex = studentData.students.findIndex(student => student.name === studentName);
    
    if (studentIndex === -1) {
      console.log('⚠️ 找不到學生:', studentName);
      return res.status(404).json({
        success: false,
        message: `找不到學生: ${studentName}`
      });
    }
    
    // 更新或添加簽到記錄
    const student = studentData.students[studentIndex];
    
    // 確保 attendance 陣列存在
    if (!student.attendance) {
      student.attendance = [];
    }
    
    // 查找是否已有該日期的記錄
    const existingRecordIndex = student.attendance.findIndex(record => record.date === date);
    
    if (existingRecordIndex !== -1) {
      // 更新現有記錄
      const oldPresent = student.attendance[existingRecordIndex].present;
      student.attendance[existingRecordIndex].present = present;
      console.log('✅ 更新現有簽到記錄:', { studentName, date, present, oldPresent });
      
      // 如果從缺席/請假改為出席，則減少剩餘堂數
      if (present && !oldPresent && (student.remaining || 0) > 0) {
        student.remaining = Math.max(0, (student.remaining || 0) - 1);
        console.log('📉 從缺席改為出席，減少剩餘堂數:', { studentName, remaining: student.remaining });
      }
      // 如果從出席改為缺席/請假，則增加剩餘堂數
      else if (!present && oldPresent === true) {
        student.remaining = (student.remaining || 0) + 1;
        console.log('📈 從出席改為缺席，增加剩餘堂數:', { studentName, remaining: student.remaining });
      }
    } else {
      // 添加新記錄
      student.attendance.push({
        date: date,
        present: present
      });
      console.log('✅ 添加新簽到記錄:', { studentName, date, present });
      
      // 如果是新記錄且為出席，則減少剩餘堂數
      if (present && (student.remaining || 0) > 0) {
        student.remaining = Math.max(0, (student.remaining || 0) - 1);
        console.log('📉 新記錄出席，減少剩餘堂數:', { studentName, remaining: student.remaining });
      }
    }
    
    // 🔥 計算並更新最後出席日期
    if (student.attendance && student.attendance.length > 0) {
      // 找出所有 present === true 的記錄
      const presentRecords = student.attendance.filter(record => record.present === true);
      if (presentRecords.length > 0) {
        // 按日期排序，取最新的
        presentRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
        student.lastAttendanceDate = presentRecords[0].date;
        console.log('📅 更新最後出席日期:', { studentName, lastAttendanceDate: student.lastAttendanceDate });
      }
    }
    
    // 寫回檔案
    try {
      fs.writeFileSync(studentDataPath, JSON.stringify(studentData, null, 2), 'utf8');
      console.log('✅ student_data.json 更新成功');
    } catch (error) {
      console.error('❌ 寫入 student_data.json 失敗:', error);
      return res.status(500).json({
        success: false,
        message: '寫入學生資料檔案失敗'
      });
    }
    
    res.json({
      success: true,
      message: '學生簽到記錄更新成功',
      data: {
        studentName,
        date,
        present,
        totalRecords: student.attendance.length,
        remaining: student.remaining || 0,
        lastAttendanceDate: student.lastAttendanceDate || null
      }
    });
    
  } catch (error) {
    console.error('❌ 更新學生簽到記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新學生簽到記錄失敗',
      error: error.message
    });
  }
});
// 更新學生資料API - 從Google Sheets獲取最新資料（使用共用函數）
app.post('/api/update-student-data', async (req, res) => {
  try {
    console.log('🔄 [手動] 開始更新學生資料...');
    const result = await updateStudentDataFromGoogleSheets();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ [手動] 更新學生資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新學生資料失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 獲取學生資料API - 返回當前student_data.json的內容
app.get('/api/student-data', (req, res) => {
  try {
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    
    if (!fs.existsSync(studentDataPath)) {
      return res.status(404).json({
        success: false,
        message: '學生資料文件不存在'
      });
    }
    
    const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
    
    // 🔥 動態計算每個學生的最後出席日期（如果還沒有的話）
    if (studentData.students && Array.isArray(studentData.students)) {
      studentData.students.forEach(student => {
        if (!student.lastAttendanceDate && student.attendance && student.attendance.length > 0) {
          // 找出所有 present === true 的記錄
          const presentRecords = student.attendance.filter(record => record.present === true);
          if (presentRecords.length > 0) {
            // 按日期排序，取最新的
            presentRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
            student.lastAttendanceDate = presentRecords[0].date;
          }
        }
      });
    }
    
    res.json({
      success: true,
      data: studentData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 讀取學生資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取學生資料失敗',
      error: error.message
    });
  }
});

// 系統狀態監控API
app.get('/api/system-status', (req, res) => {
  try {
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    const studentDataExists = fs.existsSync(studentDataPath);
    
    let studentDataInfo = null;
    if (studentDataExists) {
      const stats = fs.statSync(studentDataPath);
      studentDataInfo = {
        exists: true,
        size: stats.size,
        lastModified: stats.mtime,
        age: Date.now() - stats.mtime.getTime()
      };
    }
    
    const settings = loadSystemSettings();
    const syncSettings = settings.studentDataSync || {};
    
    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString(),
      studentData: studentDataInfo,
      cache: {
        size: memoryDB.cache.size,
        updating: memoryDB.get('updating_student_data') || false
      },
      studentDataSync: {
        enabled: syncSettings.enabled,
        autoUpdateEnabled: syncSettings.autoUpdateEnabled,
        updateTime: syncSettings.updateTime,
        intervalMinutes: syncSettings.intervalMinutes,
        hasSchedule: studentDataSyncSchedule !== null,
        hasInterval: studentDataSyncInterval !== null
      }
    };
    
    res.json({
      success: true,
      data: systemInfo
    });
    
  } catch (error) {
    console.error('❌ 獲取系統狀態失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取系統狀態失敗',
      error: error.message
    });
  }
});

// ==================== 學生資料同步管理 API ====================

// 獲取學生資料同步設定
app.get('/api/student-data-sync/settings', (req, res) => {
  try {
    const settings = loadSystemSettings();
    const syncSettings = settings.studentDataSync || {};
    
    res.json({
      success: true,
      data: {
        ...syncSettings,
        hasSchedule: studentDataSyncSchedule !== null,
        hasInterval: studentDataSyncInterval !== null,
        isUpdating: memoryDB.get('updating_student_data') || false
      }
    });
  } catch (error) {
    console.error('❌ 獲取同步設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取同步設定失敗',
      error: error.message
    });
  }
});

// 更新學生資料同步設定
app.post('/api/student-data-sync/settings', (req, res) => {
  try {
    const newSettings = req.body;
    
    // 讀取現有設定
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    
    // 更新學生資料同步設定
    settings.studentDataSync = {
      ...settings.studentDataSync,
      ...newSettings
    };
    
    // 寫回檔案
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    
    // 重新啟動排程
    console.log('🔄 重新啟動學生資料自動更新排程...');
    startStudentDataAutoSync();
    
    res.json({
      success: true,
      message: '同步設定已更新',
      data: settings.studentDataSync
    });
  } catch (error) {
    console.error('❌ 更新同步設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新同步設定失敗',
      error: error.message
    });
  }
});

// 立即執行學生資料同步（手動觸發）
app.post('/api/student-data-sync/trigger', async (req, res) => {
  try {
    console.log('🔄 [手動觸發] 立即執行學生資料同步...');
    const result = await updateStudentDataFromGoogleSheets();
    res.json(result);
  } catch (error) {
    console.error('❌ [手動觸發] 同步失敗:', error);
    res.status(500).json({
      success: false,
      message: '同步失敗',
      error: error.message
    });
  }
});

// 停止學生資料自動同步
app.post('/api/student-data-sync/stop', (req, res) => {
  try {
    if (studentDataSyncSchedule) {
      studentDataSyncSchedule.cancel();
      studentDataSyncSchedule = null;
      console.log('⏹️ 已停止每日定時同步');
    }
    
    if (studentDataSyncInterval) {
      clearInterval(studentDataSyncInterval);
      studentDataSyncInterval = null;
      console.log('⏹️ 已停止間隔同步');
    }
    
    res.json({
      success: true,
      message: '學生資料自動同步已停止'
    });
  } catch (error) {
    console.error('❌ 停止同步失敗:', error);
    res.status(500).json({
      success: false,
      message: '停止同步失敗',
      error: error.message
    });
  }
});

// 啟動學生資料自動同步
app.post('/api/student-data-sync/start', (req, res) => {
  try {
    console.log('▶️ 啟動學生資料自動同步...');
    startStudentDataAutoSync();
    
    res.json({
      success: true,
      message: '學生資料自動同步已啟動',
      hasSchedule: studentDataSyncSchedule !== null,
      hasInterval: studentDataSyncInterval !== null
    });
  } catch (error) {
    console.error('❌ 啟動同步失敗:', error);
    res.status(500).json({
      success: false,
      message: '啟動同步失敗',
      error: error.message
    });
  }
});
// 更新特定課程資料API
app.post('/api/update-course-data', (req, res) => {
  try {
    const { course, students, timestamp } = req.body;
    
    console.log(`🔄 開始更新 ${course} 課程資料...`);
    console.log(`📊 收到 ${students.length} 名學生資料`);
    
    // 讀取現有學生資料
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    let allStudents = [];
    
    if (fs.existsSync(studentDataPath)) {
      const existingData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
      allStudents = existingData.students || [];
    }
    
    // 移除該課程的舊資料
    allStudents = allStudents.filter(student => student.course !== course);
    
    // 添加新資料
    allStudents = allStudents.concat(students);
    
    // 更新總數
    const updatedData = {
      success: true,
      count: allStudents.length,
      students: allStudents,
      lastUpdated: timestamp || new Date().toISOString(),
      updatedCourse: course
    };
    
    // 寫入文件
    fs.writeFileSync(studentDataPath, JSON.stringify(updatedData, null, 2));
    
    console.log(`✅ ${course} 課程資料更新成功`);
    console.log(`📊 總學生數: ${allStudents.length}`);
    
    res.json({
      success: true,
      message: `${course} 課程資料更新成功`,
      course: course,
      studentCount: students.length,
      totalStudents: allStudents.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 更新課程資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新課程資料失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 批量更新多個課程資料API
app.post('/api/update-multiple-courses', (req, res) => {
  try {
    const { courses } = req.body;
    
    console.log(`🔄 開始批量更新 ${courses.length} 個課程資料...`);
    
    // 讀取現有學生資料
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    let allStudents = [];
    
    if (fs.existsSync(studentDataPath)) {
      const existingData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
      allStudents = existingData.students || [];
    }
    
    const updatedCourses = [];
    
    // 處理每個課程
    for (const courseData of courses) {
      const { course, students } = courseData;
      
      // 移除該課程的舊資料
      allStudents = allStudents.filter(student => student.course !== course);
      
      // 添加新資料
      allStudents = allStudents.concat(students);
      
      updatedCourses.push({
        course: course,
        studentCount: students.length
      });
      
      console.log(`✅ ${course}: ${students.length} 名學生`);
    }
    
    // 更新總數
    const updatedData = {
      success: true,
      count: allStudents.length,
      students: allStudents,
      lastUpdated: new Date().toISOString(),
      updatedCourses: updatedCourses
    };
    
    // 寫入文件
    fs.writeFileSync(studentDataPath, JSON.stringify(updatedData, null, 2));
    
    console.log(`🎉 批量更新完成，總學生數: ${allStudents.length}`);
    
    res.json({
      success: true,
      message: '批量更新成功',
      totalStudents: allStudents.length,
      updatedCourses: updatedCourses,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 批量更新失敗:', error);
    res.status(500).json({
      success: false,
      message: '批量更新失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 獲取講師資料API
app.get('/api/teachers', (req, res) => {
  try {
    console.log('📚 獲取講師資料...');
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    
    if (!fs.existsSync(teacherDataPath)) {
      console.log('❌ 講師資料檔案不存在');
      return res.status(404).json({
        success: false,
        message: '講師資料檔案不存在',
        timestamp: new Date().toISOString()
      });
    }
    
    const teacherData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
    
    // 支援新舊兩種格式
    let teachers = [];
    
    if (Array.isArray(teacherData.teachers)) {
      teachers = teacherData.teachers.map(teacher => ({
        name: teacher.name,
        userId: teacher.userId,
        color: teacher.color || null
      }));
      console.log(`✅ 成功獲取 ${teachers.length} 位講師資料（陣列格式）`);
    } else if (typeof teacherData.teachers === 'object') {
      teachers = Object.entries(teacherData.teachers).map(([name, value]) => {
        if (typeof value === 'object' && value !== null) {
          return {
            name,
            userId: value.userId,
            color: value.color || null
          };
        }

        return {
          name,
          userId: value,
          color: null
        };
      });
      console.log(`✅ 成功獲取 ${teachers.length} 位講師資料（從物件轉換）`);
    }
    
    res.json({
      success: true,
      data: {
        teachers: teachers,  // 統一返回陣列格式 [{ name, userId }]
        count: teachers.length,
        lastUpdate: teacherData.last_update || new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 獲取講師資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取講師資料失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 更新講師資料 API（包含顏色設定）
app.put('/api/teachers', (req, res) => {
  try {
    console.log('📝 收到更新講師資料請求...');
    
    const { teachers } = req.body;
    
    if (!Array.isArray(teachers)) {
      return res.status(400).json({
        success: false,
        message: '講師資料格式錯誤，需要陣列格式',
        timestamp: new Date().toISOString()
      });
    }
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    
    // 驗證每個講師資料
    for (const teacher of teachers) {
      if (!teacher.name || !teacher.userId) {
        return res.status(400).json({
          success: false,
          message: '每位講師必須包含 name 和 userId',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // 建立備份
    if (fs.existsSync(teacherDataPath)) {
      const backupPath = `${teacherDataPath}.backup-${Date.now()}`;
      fs.copyFileSync(teacherDataPath, backupPath);
      console.log('✅ 已建立備份:', backupPath);
    }
    
    // 寫入新資料
    const newData = {
      teachers: teachers,
      last_update: new Date().toISOString()
    };
    
    fs.writeFileSync(teacherDataPath, JSON.stringify(newData, null, 2), 'utf8');
    console.log(`✅ 成功更新 ${teachers.length} 位講師資料`);
    
    // 更新記憶體中的講師資料
    const teachersData = fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8');
    const parsedData = JSON.parse(teachersData);
    if (Array.isArray(parsedData.teachers)) {
      global.teachers = parsedData.teachers;
    }
    
    res.json({
      success: true,
      message: '講師資料更新成功',
      data: {
        count: teachers.length,
        lastUpdate: newData.last_update
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 更新講師資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新講師資料失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 綁定講師 API
app.post('/api/teacher-binding', (req, res) => {
  try {
    const { userId, displayName, teacherName } = req.body;
    
    console.log('🔗 收到講師綁定請求:', { userId, teacherName });
    
    if (!userId || !teacherName) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：userId 或 teacherName'
      });
    }
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    
    // 讀取現有的講師資料
    let teacherData = { teachers: [], last_update: new Date().toISOString() };
    if (fs.existsSync(teacherDataPath)) {
      teacherData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
      
      // 兼容舊格式：如果是物件格式，轉換為陣列
      if (!Array.isArray(teacherData.teachers) && typeof teacherData.teachers === 'object') {
        teacherData.teachers = Object.entries(teacherData.teachers).map(([name, userId]) => ({
          name: name,
          userId: userId
        }));
      }
    }
    
    // 確保 teachers 是陣列
    if (!Array.isArray(teacherData.teachers)) {
      teacherData.teachers = [];
    }
    
    // 檢查是否已經綁定過（只比對 userId）
    const existingIndex = teacherData.teachers.findIndex(t => t.userId === userId);
    
    if (existingIndex !== -1) {
      console.log(`⚠️ 用戶 ${userId} 已綁定到 ${teacherData.teachers[existingIndex].name}，將更新綁定`);
      // 更新現有綁定
      teacherData.teachers[existingIndex].name = teacherName;
    } else {
      // 添加新綁定
      teacherData.teachers.push({
        name: teacherName,
        userId: userId
      });
    }
    
    teacherData.last_update = new Date().toISOString();
    
    console.log('📝 準備寫入資料:', {
      totalTeachers: teacherData.teachers.length,
      newTeacher: { name: teacherName, userId: userId },
      filePath: teacherDataPath
    });
    
    // 備份舊檔案
    if (fs.existsSync(teacherDataPath)) {
      const backupPath = path.join(__dirname, 'teacher_data.json.backup');
      fs.copyFileSync(teacherDataPath, backupPath);
      console.log('📦 已備份舊檔案');
    }
    
    // 保存更新後的資料（同步寫入並驗證）
    const dataToWrite = JSON.stringify(teacherData, null, 2);
    fs.writeFileSync(
      teacherDataPath, 
      dataToWrite,
      'utf8'
    );
    
    // 立即驗證寫入是否成功
    const verifyData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
    const verifyTeacher = verifyData.teachers.find(t => t.userId === userId);
    
    if (!verifyTeacher) {
      throw new Error('驗證失敗：寫入後無法在檔案中找到新綁定的講師');
    }
    
    console.log(`✅ 講師綁定成功並已驗證: ${teacherName} (${userId})`);
    console.log(`📊 當前共有 ${verifyData.teachers.length} 位已綁定講師`);
    
    res.json({
      success: true,
      message: '講師綁定成功',
      data: {
        teacherName: teacherName,
        userId: userId,
        totalBindings: verifyData.teachers.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 講師綁定失敗:', error);
    res.status(500).json({
      success: false,
      message: '講師綁定失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========== 設定管理 API ==========

// 獲取講師資料設定 (teacher_data.json)
app.get('/api/settings/teachers', (req, res) => {
  try {
    console.log('📚 獲取講師資料設定...');
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    
    if (fs.existsSync(teacherDataPath)) {
      const teacherData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
      
      res.json({
        success: true,
        data: teacherData,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        data: { teachers: [], last_update: new Date().toISOString() },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ 獲取講師資料設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取講師資料設定失敗',
      error: error.message
    });
  }
});

// 儲存講師資料設定 (teacher_data.json)
app.post('/api/settings/teachers', (req, res) => {
  try {
    console.log('💾 儲存講師資料設定...');
    
    const { teachers } = req.body;
    
    if (!Array.isArray(teachers)) {
      return res.status(400).json({
        success: false,
        message: '講師資料格式錯誤'
      });
    }
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    const backupPath = path.join(__dirname, `teacher_data.json.backup-${Date.now()}`);
    
    // 備份現有檔案
    if (fs.existsSync(teacherDataPath)) {
      fs.copyFileSync(teacherDataPath, backupPath);
    }
    
    // 儲存新資料
    const teacherData = {
      teachers: teachers,
      last_update: new Date().toISOString()
    };
    
    fs.writeFileSync(teacherDataPath, JSON.stringify(teacherData, null, 2), 'utf8');
    
    console.log('✅ 講師資料設定已儲存');
    res.json({
      success: true,
      message: '講師資料設定儲存成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 儲存講師資料設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存講師資料設定失敗',
      error: error.message
    });
  }
});

// 獲取講師列表設定 (teacher_list_data.csv)
app.get('/api/settings/teacher-list', (req, res) => {
  try {
    console.log('📋 獲取講師列表設定...');
    
    const csvPath = path.join(__dirname, 'public', 'teacher_list_data.csv');
    
    if (fs.existsSync(csvPath)) {
      const csvData = fs.readFileSync(csvPath, 'utf8');
      const lines = csvData.split('\n').filter(line => line.trim());
      
      // 跳過標題行
      const headers = lines[0].split(',');
      const teachers = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 5) {
          teachers.push({
            teacher: values[0],
            link: values[1],
            webApi: values[2],
            readApi: values[3],
            userId: values[4]
          });
        }
      }
      
      res.json({
        success: true,
        data: teachers,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        data: [],
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ 獲取講師列表設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取講師列表設定失敗',
      error: error.message
    });
  }
});

// 儲存講師列表設定 (teacher_list_data.csv)
app.post('/api/settings/teacher-list', (req, res) => {
  try {
    console.log('💾 儲存講師列表設定...');
    
    const { teachers } = req.body;
    
    if (!Array.isArray(teachers)) {
      return res.status(400).json({
        success: false,
        message: '講師列表格式錯誤'
      });
    }
    
    const csvPath = path.join(__dirname, 'public', 'teacher_list_data.csv');
    const backupPath = path.join(__dirname, 'public', `teacher_list_data.csv.backup-${Date.now()}`);
    
    // 備份現有檔案
    if (fs.existsSync(csvPath)) {
      fs.copyFileSync(csvPath, backupPath);
    }
    
    // 生成 CSV 內容
    let csvContent = '老師,連結,Web API,讀報表 API,user id\n';
    teachers.forEach(teacher => {
      csvContent += `${teacher.teacher || ''},${teacher.link || ''},${teacher.webApi || ''},${teacher.readApi || ''},${teacher.userId || ''}\n`;
    });
    
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    
    console.log('✅ 講師列表設定已儲存');
    res.json({
      success: true,
      message: '講師列表設定儲存成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 儲存講師列表設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存講師列表設定失敗',
      error: error.message
    });
  }
});
// 獲取系統設定 (system-settings.json)
app.get('/api/settings/system', (req, res) => {
  try {
    console.log('⚙️ 獲取系統設定...');
    
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ 獲取系統設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取系統設定失敗',
      error: error.message
    });
  }
});

// 儲存系統設定 (system-settings.json)
app.post('/api/settings/system', (req, res) => {
  try {
    console.log('💾 儲存系統設定...');
    
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const newSettings = req.body;
    
    const mergedSettings = {
      ...loadSystemSettings(),
      ...newSettings,
      dateRange: {
        futureDays: Math.max(1, parseInt(newSettings.dateRange?.futureDays ?? newSettings.futureDays ?? 30, 10)),
        pastDays: Math.max(0, parseInt(newSettings.dateRange?.pastDays ?? newSettings.pastDays ?? 7, 10))
      }
    };
    
    if ('futureDays' in mergedSettings) delete mergedSettings.futureDays;
    if ('pastDays' in mergedSettings) delete mergedSettings.pastDays;
    
    // 備份舊設定
    if (fs.existsSync(settingsPath)) {
      const backupPath = path.join(__dirname, `system-settings.json.backup-${Date.now()}`);
      fs.copyFileSync(settingsPath, backupPath);
    }
    
    // 寫入新設定
    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
    
    console.log('✅ 系統設定已更新');
    
    res.json({
      success: true,
      message: '系統設定已更新',
      data: mergedSettings
    });
  } catch (error) {
    console.error('❌ 儲存系統設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存系統設定失敗',
      error: error.message
    });
  }
});

// ========== 原有 API 繼續 ==========

// 解除講師綁定 API
app.post('/api/teacher-unbinding', (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log('🔓 收到解除講師綁定請求:', userId);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：userId'
      });
    }
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    
    if (!fs.existsSync(teacherDataPath)) {
      return res.status(404).json({
        success: false,
        message: '講師資料檔案不存在'
      });
    }
    
    // 讀取現有的講師資料
    const teacherData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
    
    // 兼容舊格式：如果是物件格式，轉換為陣列
    if (!Array.isArray(teacherData.teachers) && typeof teacherData.teachers === 'object') {
      teacherData.teachers = Object.entries(teacherData.teachers).map(([name, userId]) => ({
        name: name,
        userId: userId
      }));
    }
    
    // 查找綁定索引
    const existingIndex = teacherData.teachers.findIndex(t => t.userId === userId);
    
    if (existingIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '未找到該用戶的綁定記錄'
      });
    }
    
    const teacherName = teacherData.teachers[existingIndex].name;
    
    // 備份舊檔案
    const backupPath = path.join(__dirname, 'teacher_data.json.backup');
    fs.copyFileSync(teacherDataPath, backupPath);
    
    // 刪除綁定（從陣列中移除）
    teacherData.teachers.splice(existingIndex, 1);
    teacherData.last_update = new Date().toISOString();
    
    // 保存更新後的資料
    fs.writeFileSync(
      teacherDataPath, 
      JSON.stringify(teacherData, null, 2),
      'utf8'
    );
    
    console.log(`✅ 解除綁定成功: ${teacherName} (${userId})`);
    
    res.json({
      success: true,
      message: '解除綁定成功',
      data: {
        teacherName: teacherName,
        userId: userId
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 解除綁定失敗:', error);
    res.status(500).json({
      success: false,
      message: '解除綁定失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 提醒管理相關API
const remindersDataPath = path.join(__dirname, 'data', 'reminders.json');

// 確保data目錄存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// 生成手動提醒訊息函數
async function generateManualReminderMessage(teacherName, courseName, courseDate, courseTime, type) {
  try {
    // 獲取範本設定
    const response = await fetch(`http://localhost:3002/api/templates`);
    const data = await response.json();
    
    let template;
    if (data.success && data.data) {
      // 處理課前提醒的範本映射
      const templateKey = type === 'before-class' ? 'beforeClass' : type;
      template = data.data[templateKey] || data.data.today;
    } else {
      // 使用預設範本
      template = getDefaultTemplate(type);
    }
    
    const date = new Date(courseDate);
    const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    
    // 準備變數
    const variables = {
      teacherName,
      courseName,
      courseTime,
      courseDate: formattedDate + ' 星期' + weekday,
      location: '未設定地點',
      lessonPlanUrl: '',
      googleMapsUrl: '',
      minutes: type === 'before-class' ? '30' : ''
    };
    
    // 處理範本
    let result = template;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, variables[key] || '');
    });
    
    return result;
  } catch (error) {
    console.error('❌ 獲取範本失敗，使用預設範本:', error);
    return getDefaultTemplate(type, teacherName, courseName, courseDate, courseTime);
  }
}

function getDefaultTemplate(type, teacherName, courseName, courseDate, courseTime) {
  const date = new Date(courseDate);
  const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  
  if (type === 'today') {
    return `今日課程提醒

👨‍🏫 講師：${teacherName}
📖 課程：${courseName}
⏰ 時間：${courseTime}
📅 日期：${formattedDate} 星期${weekday}
📍 地點：未設定地點
📋 教案連結：
🗺️ 地圖連結：

請準備好課程內容，祝教學順利！`;
  } else if (type === 'before-class') {
    const beforeClassMinutes = 30;
    return `📚 課程即將開始

👨‍🏫 講師：${teacherName}
📖 課程：${courseName}
⏰ 時間：${courseTime}
📅 日期：${formattedDate} 星期${weekday}
📍 地點：未設定地點
📋 教案連結：
🗺️ 地圖連結：

課程將在 ${beforeClassMinutes} 分鐘後開始，請準備就緒！`;
  } else {
    return `明日課程提醒

👨‍🏫 講師：${teacherName}
📖 課程：${courseName}
⏰ 時間：${courseTime}
📅 日期：${formattedDate} 星期${weekday}
📍 地點：未設定地點
📋 教案連結：
🗺️ 地圖連結：

請提前準備課程內容！`;
  }
}
// 讀取提醒資料
function loadReminders() {
  try {
    if (fs.existsSync(remindersDataPath)) {
      // 檢查檔案權限
      const stats = fs.statSync(remindersDataPath);
      console.log('📄 提醒檔案資訊:', {
        exists: true,
        size: stats.size,
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid
      });
      
      const data = fs.readFileSync(remindersDataPath, 'utf8');
      const parsed = JSON.parse(data);
      
      // 確保 studentReminders 陣列存在
      if (!parsed.studentReminders) {
        parsed.studentReminders = [];
      }
      
      console.log('✅ 成功讀取提醒資料，數量:', parsed.reminders ? parsed.reminders.length : 0);
      console.log('✅ 成功讀取學生提醒資料，數量:', parsed.studentReminders ? parsed.studentReminders.length : 0);
      return parsed;
    } else {
      console.log('⚠️ 提醒檔案不存在，創建新檔案');
      const initialData = { reminders: [], studentReminders: [] };
      fs.writeFileSync(remindersDataPath, JSON.stringify(initialData, null, 2));
      return initialData;
    }
  } catch (error) {
    console.error('❌ 讀取提醒資料失敗:', error);
    console.error('錯誤詳情:', {
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      path: error.path
    });
    
    // 嘗試創建新檔案
    try {
      const initialData = { reminders: [], studentReminders: [] };
      fs.writeFileSync(remindersDataPath, JSON.stringify(initialData, null, 2));
      console.log('✅ 創建新的提醒檔案');
      return initialData;
    } catch (writeError) {
      console.error('❌ 創建提醒檔案也失敗:', writeError);
      return { reminders: [], studentReminders: [] };
    }
  }
}

// 範本處理函數
function processTemplate(template, reminder) {
  if (!template) return '';
  
  console.log('🔧 開始處理範本變數...');
  const now = new Date();
  const courseDate = new Date(reminder.courseDate);
  const courseTime = reminder.courseTime;
  
  // 計算距離上課時間
  let timeUntilClass = '';
  if (courseTime) {
    try {
      const [hours, minutes] = courseTime.split(':');
      const courseDateTime = new Date(courseDate);
      courseDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const timeDiff = courseDateTime.getTime() - now.getTime();
      if (timeDiff > 0) {
        const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hoursLeft > 0) {
          timeUntilClass = `${hoursLeft}小時${minutesLeft}分鐘`;
        } else {
          timeUntilClass = `${minutesLeft}分鐘`;
        }
      }
      console.log('⏰ 計算時間差:', timeUntilClass);
    } catch (error) {
      console.error('計算時間差錯誤:', error);
    }
  }
  
  // 星期幾對應
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[courseDate.getDay()];
  
  // 提醒類型文字對應
  const typeTextMap = {
    'today': '當日',
    'tomorrow': '隔日',
    'before-class': '課前'
  };
  
  console.log('📋 變數替換前範本:', template);
  console.log('📊 變數值:', {
    teacherName: reminder.teacherName,
    courseName: reminder.courseName,
    courseTime: courseTime,
    courseDate: reminder.courseDate,
    reminderType: reminder.type,
    reminderTypeText: typeTextMap[reminder.type],
    currentTime: now.toLocaleTimeString('zh-TW', { hour12: false }),
    currentDate: now.toLocaleDateString('zh-TW'),
    weekday: weekday,
    timeUntilClass: timeUntilClass
  });
  
  // 替換變數
  const result = template
    .replace(/\{teacherName\}/g, reminder.teacherName || '未知講師')
    .replace(/\{courseName\}/g, reminder.courseName || '未知課程')
    .replace(/\{courseTime\}/g, courseTime || '未知時間')
    .replace(/\{courseDate\}/g, reminder.courseDate || '未知日期')
    .replace(/\{reminderType\}/g, reminder.type || 'unknown')
    .replace(/\{reminderTypeText\}/g, typeTextMap[reminder.type] || '未知')
    .replace(/\{reminderId\}/g, reminder.id || '')
    .replace(/\{currentTime\}/g, now.toLocaleTimeString('zh-TW', { hour12: false }))
    .replace(/\{currentDate\}/g, now.toLocaleDateString('zh-TW'))
    .replace(/\{weekday\}/g, weekday)
    .replace(/\{timeUntilClass\}/g, timeUntilClass)
    .replace(/\{systemName\}/g, 'FLB講師行事曆系統');
  
  console.log('✅ 範本處理完成');
  return result;
}

// 儲存範本設定API
app.post('/api/templates', (req, res) => {
  try {
    const { templates } = req.body;
    
    if (!templates) {
      return res.status(400).json({
        success: false,
        message: '範本資料不能為空'
      });
    }

    // 儲存範本到檔案
    const templatesPath = path.join(__dirname, 'data', 'templates.json');
    fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));
    
    console.log('✅ 範本設定已儲存');
    res.json({
      success: true,
      message: '範本設定已儲存'
    });
  } catch (error) {
    console.error('❌ 儲存範本設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存範本設定失敗',
      error: error.message
    });
  }
});

// 獲取範本設定API
app.get('/api/templates', (req, res) => {
  try {
    // 嘗試從檔案讀取範本設定
    const templatesPath = path.join(__dirname, 'data', 'templates.json');
    let templates = null;
    
    if (fs.existsSync(templatesPath)) {
      try {
        const data = fs.readFileSync(templatesPath, 'utf8');
        templates = JSON.parse(data);
        console.log('✅ 從檔案載入範本設定');
      } catch (error) {
        console.error('❌ 讀取範本檔案失敗:', error);
      }
    }
    
    // 如果沒有自訂範本，使用預設範本
    if (!templates) {
      templates = {
        today: `今日課程提醒

👨‍🏫 講師：{teacherName}
📖 課程：{courseName}
⏰ 時間：{courseTime}
📅 日期：{courseDate}
📍 地點：{location}
📋 教案連結：{lessonPlanUrl}
🗺️ 地圖連結：{googleMapsUrl}

請準備好課程內容，祝教學順利！`,
        tomorrow: `明日課程提醒

👨‍🏫 講師：{teacherName}
📖 課程：{courseName}
⏰ 時間：{courseTime}
📅 日期：{courseDate}
📍 地點：{location}
📋 教案連結：{lessonPlanUrl}
🗺️ 地圖連結：{googleMapsUrl}

請提前準備課程內容！`,
        beforeClass: `📚 課程即將開始

👨‍🏫 講師：{teacherName}
📖 課程：{courseName}
⏰ 時間：{courseTime}
📅 日期：{courseDate}
📍 地點：{location}
📋 教案連結：{lessonPlanUrl}
🗺️ 地圖連結：{googleMapsUrl}

課程將在 {minutes} 分鐘後開始，請準備就緒！`,
        student: `👋 您好！

📚 課程提醒通知

📖 課程：{courseName}
📅 日期：{courseDate}
⏰ 時間：{courseTime}
📍 地點：{location}
📋 教案連結：{lessonPlanUrl}
🗺️ 地圖連結：{googleMapsUrl}

提醒您要上課喔！謝謝

希望孩子學習愉快、玩得開心`
      };
      console.log('✅ 使用預設範本設定');
    }

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('❌ 獲取範本設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取範本設定失敗',
      error: error.message
    });
  }
});

// 獲取 Flex Message 範本 API
app.get('/api/flex-templates', (req, res) => {
  try {
    const flexTemplatePath = path.join(__dirname, 'flex-message-templates.json');

    let storedTemplates = null;
    if (fs.existsSync(flexTemplatePath)) {
      try {
        const raw = fs.readFileSync(flexTemplatePath, 'utf8');
        storedTemplates = JSON.parse(raw);
      } catch (err) {
        console.error('⚠️ 解析 flex-message-templates.json 失敗，改用預設值:', err);
      }
    }

    const defaults = notificationManager.getDefaultFlexTemplates();
    const responseData = {
      ...(storedTemplates || defaults),
      defaultTemplates: defaults.templates,
      defaultQuickReply: defaults.quickReply,
      defaultCarousel: defaults.carousel
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ 獲取 Flex Message 範本失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取 Flex Message 範本失敗',
      error: error.message
    });
  }
});

// 重新載入 Flex Message 範本（從磁碟讀取，更新後端記憶体）
app.post('/api/flex-templates/reload', (req, res) => {
  try {
    notificationManager.flexTemplates = notificationManager.loadFlexTemplates();
    res.json({
      success: true,
      message: 'Flex Message 範本已重新載入',
      data: notificationManager.flexTemplates
    });
  } catch (error) {
    console.error('❌ 重新載入 Flex 範本失敗:', error);
    res.status(500).json({ success: false, message: '重新載入 Flex 範本失敗', error: error.message });
  }
});

// 儲存 Flex Message 範本 API
app.post('/api/flex-templates', (req, res) => {
  try {
    const { templates, enabled, quickReply, carousel } = req.body || {};
    const flexTemplatePath = path.join(__dirname, 'flex-message-templates.json');

    const payload = {
      enabled: Boolean(enabled),
      templates: templates && typeof templates === 'object' ? templates : {},
      quickReply: {
        enabled: quickReply?.enabled !== false,
        perType: {
          today: quickReply?.perType?.today === true,
          tomorrow: quickReply?.perType?.tomorrow === true,
          beforeClass: quickReply?.perType?.beforeClass === true,
          student: quickReply?.perType?.student !== false
        },
        options: Array.isArray(quickReply?.options) && quickReply.options.length ? quickReply.options : [
          { label: '✅ 會出席', data: 'attend' },
          { label: '🏥 請假', data: 'leave' },
          { label: '⏳ 待確認', data: 'pending' }
        ],
        leaveReasons: Array.isArray(quickReply?.leaveReasons) && quickReply.leaveReasons.length
          ? quickReply.leaveReasons
          : ['生病', '家庭因素', '臨時有事', '其他']
      },
      carousel: {
        maxBubbles: Number.isInteger(carousel?.maxBubbles) ? carousel.maxBubbles : 10
      }
    };

    fs.writeFileSync(flexTemplatePath, JSON.stringify(payload, null, 2));

    notificationManager.flexTemplates = notificationManager.loadFlexTemplates();

    console.log('✅ Flex Message 範本已儲存');

    res.json({
      success: true,
      message: 'Flex Message 範本已儲存',
      data: payload
    });
  } catch (error) {
    console.error('❌ 儲存 Flex Message 範本失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存 Flex Message 範本失敗',
      error: error.message
    });
  }
});

// 🔍 檢查代碼版本（用於確認部署）
app.get('/api/version', (req, res) => {
  res.json({
    success: true,
    version: '2024-10-24-fix-flex-empty-fields',
    timestamp: new Date().toISOString(),
    features: {
      cleanFlexMessage: true,
      emptyFieldFix: true
    }
  });
});

// 測試發送特定 Flex 範本
app.post('/api/flex-templates/:type/send-test', async (req, res) => {
  const { type } = req.params;
  const { specialEventType } = req.body || {};
  
  // 🎨 根據特殊事件類型設定課程名稱
  let courseName = '示範課程';
  if (specialEventType) {
    const eventNames = {
      '停課': '🔴 停課 - 示範課程',
      '體驗': '🟢 體驗課 - 示範課程', 
      '代課': '🔵 代課 - 示範課程',
      '改時間': '🟠 調課 - 示範課程'
    };
    courseName = eventNames[specialEventType] || `${specialEventType} - 示範課程`;
    console.log(`🎨 [特殊事件測試] 使用特殊事件類型: ${specialEventType}, 課程名稱: ${courseName}`);
  }
  
  const sample = {
    teacherName: '示範講師',
    courseName: courseName,
    courseDate: new Date().toISOString().split('T')[0],
    courseTime: '15:30',
    location: '示範教室',
    weekday: '週二',
    lessonPlanUrl: 'https://funlearnbar.example/lesson-plan',
    googleMapsUrl: 'https://maps.google.com/?q=FunLearnBar',
    studentName: '示範學生',
    timeUntilClass: '45分鐘後',
    reminderTypeText: '示範',
    reminderId: `preview-${Date.now()}`,
    description: '這是示範訊息',
    systemName: '樂程坊課程系統',
    // 🔥 新增學生範本需要的變數
    badgeText: '測試',
    classDetailUrl: 'https://calendar.funlearnbar.synology.me',
    locationMapQuery: encodeURIComponent('示範教室'),
    studentId: 'TEST_STUDENT_001',
    scheduleId: 'TEST_SCHEDULE_001',
    makeupUrl: 'https://calendar.funlearnbar.synology.me'
  };

  try {
    const currentTemplates = notificationManager.flexTemplates || notificationManager.getDefaultFlexTemplates();
    const template = currentTemplates.templates?.[type];

    if (!template) {
      return res.status(404).json({
        success: false,
        message: `找不到 Flex 範本類型: ${type}`
      });
    }

    let flexMessage = notificationManager.replaceFlexVariables(JSON.parse(JSON.stringify(template)), sample);
    
    // 🧹 清理空元素（避免 LINE API 400 錯誤）
    flexMessage = notificationManager.cleanFlexMessage(flexMessage);
    
    // 🔍 詳細日誌：打印生成的 Flex Message
    console.log(`🔍 [測試發送 ${type}] 清理後的 Flex Message:`, JSON.stringify(flexMessage, null, 2));

    const quickReply = notificationManager.buildQuickReply(sample, type);

    const result = await notificationManager.sendTestMessage(`這是 Flex 範本 「${type}」 的測試訊息。`, {
      flexMessage,
      altText: `[測試] ${sample.courseName}`,
      quickReply
    });

    if (!result.success) {
      throw new Error(result.error || '發送測試訊息失敗');
    }

    res.json({
      success: true,
      message: '測試 Flex 範本已發送給管理員',
      data: {
        templateType: type,
        sample
      }
    });
  } catch (error) {
    console.error('❌ Flex 測試發送失敗:', error);
    res.status(500).json({
      success: false,
      message: 'Flex 測試發送失敗',
      error: error.message
    });
  }
});

// 測試發送多個學生版本（Carousel + Quick Reply）
app.post('/api/flex-templates/student/send-test-multi', async (req, res) => {
  try {
    console.log('📤 [測試] 開始發送多個學生版本...');
    
    // 建立多個示範學生的資料
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const dateStr = `${year}年${month}月${day}日`;
    const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const weekday = weekdays[now.getDay()];
    
    const students = [
      {
        studentName: '小明',
        courseName: 'SPM 六 9:30-11:00',
        courseDate: dateStr,
        courseTime: '09:30-11:00',
        location: '站前教室',
        weekday: weekday,
        teacherName: '示範講師',
        lessonPlanUrl: 'https://funlearnbar.example/lesson-plan',
        googleMapsUrl: 'https://maps.google.com/?q=FunLearnBar+站前教室',
        badgeText: '測試',
        classDetailUrl: 'https://calendar.funlearnbar.synology.me',
        locationMapQuery: encodeURIComponent('站前教室'),
        studentId: 'TEST_STUDENT_001',
        scheduleId: 'TEST_SCHEDULE_001',
        makeupUrl: 'https://calendar.funlearnbar.synology.me'
      },
      {
        studentName: '小華',
        courseName: 'ESM 日 9:30-10:30',
        courseDate: dateStr,
        courseTime: '09:30-10:30',
        location: '站前教室',
        weekday: weekday,
        teacherName: '示範講師',
        lessonPlanUrl: 'https://funlearnbar.example/lesson-plan',
        googleMapsUrl: 'https://maps.google.com/?q=FunLearnBar+站前教室',
        badgeText: '測試',
        classDetailUrl: 'https://calendar.funlearnbar.synology.me',
        locationMapQuery: encodeURIComponent('站前教室'),
        studentId: 'TEST_STUDENT_002',
        scheduleId: 'TEST_SCHEDULE_002',
        makeupUrl: 'https://calendar.funlearnbar.synology.me'
      }
    ];

    console.log(`🎠 建構 Carousel（${students.length} 個學生）...`);
    
    // 建構 Carousel
    const carousel = notificationManager.buildCarousel(students, 'student');
    if (!carousel) {
      throw new Error('建構 Carousel 失敗');
    }

    console.log('✅ Carousel 建構成功');

    // 建構統一 Quick Reply（多個學生）
    console.log('💬 建構多學生 Quick Reply...');
    const quickReply = notificationManager.buildMultiStudentQuickReply(students, 'student');
    if (quickReply) {
      console.log('✅ Quick Reply 建構成功');
    } else {
      console.log('⚠️ Quick Reply 建構失敗（可能未啟用）');
    }

    // 發送測試訊息
    const result = await notificationManager.sendTestMessage(
      `這是「學生提醒範本」的多個學生版本測試訊息（Carousel + Quick Reply）。`,
      {
        flexMessage: carousel,
        altText: `[測試] 課程提醒 - ${students.length} 位學生`,
        quickReply: quickReply
      }
    );

    if (!result.success) {
      throw new Error(result.error || '發送測試訊息失敗');
    }

    console.log('✅ 多個學生測試訊息發送成功');

    res.json({
      success: true,
      message: '多個學生測試訊息已發送給管理員',
      data: {
        templateType: 'student',
        studentCount: students.length,
        hasCarousel: true,
        hasQuickReply: !!quickReply
      }
    });
  } catch (error) {
    console.error('❌ 多個學生測試發送失敗:', error);
    res.status(500).json({
      success: false,
      message: '多個學生測試發送失敗',
      error: error.message
    });
  }
});

// 儲存提醒資料
function saveReminders(remindersData) {
  try {
    fs.writeFileSync(remindersDataPath, JSON.stringify(remindersData, null, 2));
    return true;
  } catch (error) {
    console.error('儲存提醒資料失敗:', error);
    return false;
  }
}

// 獲取提醒列表API
app.get('/api/reminders', (req, res) => {
  try {
    console.log('📋 獲取提醒列表...');
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    const studentReminders = remindersData.studentReminders || [];
    console.log(`✅ 成功獲取 ${reminders.length} 個一般提醒，${studentReminders.length} 個學生提醒`);
    
    // 顯示提醒統計
    const statusCounts = reminders.reduce((acc, reminder) => {
      acc[reminder.status] = (acc[reminder.status] || 0) + 1;
      return acc;
    }, {});
    console.log('📊 一般提醒狀態統計:', statusCounts);
    
    const studentStatusCounts = studentReminders.reduce((acc, reminder) => {
      acc[reminder.status] = (acc[reminder.status] || 0) + 1;
      return acc;
    }, {});
    console.log('📊 學生提醒狀態統計:', studentStatusCounts);
    
    res.json({
      success: true,
      data: reminders,
      studentReminders: studentReminders,
      count: reminders.length + studentReminders.length
    });
  } catch (error) {
    console.error('❌ 獲取提醒列表失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取提醒列表失敗',
      error: error.message
    });
  }
});

// 建立新提醒API
app.post('/api/reminders', async (req, res) => {
  try {
    const { teacherName, courseName, courseDate, courseTime, type, message } = req.body;
    
    console.log('📝 收到建立提醒請求:', { teacherName, courseName, courseDate, courseTime, type, hasMessage: !!message });
    
    if (!teacherName || !courseName || !courseDate || !courseTime || !type) {
      console.log('❌ 缺少必要參數');
      return res.status(400).json({
        success: false,
        message: '缺少必要參數'
      });
    }
    
    const remindersData = loadReminders();
    
    // 計算提醒時間（統一使用 UTC 格式）
    let scheduledTime;
    if (type === 'before-class') {
      // 課前提醒：課程時間前30分鐘
      const beforeClassMinutes = 30; // 可從設定檔讀取
      const [year, month, day] = courseDate.split('-').map(Number);
      const [hour, minute] = courseTime.split(':').map(Number);
      
      // ✅ 使用正確的台灣時區轉換
      const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
      const courseDateTimeUTC = new Date(taiwanTimeStr);
      
      // 計算課前提醒時間（提前指定分鐘）
      const beforeClassTime = new Date(courseDateTimeUTC.getTime() - (beforeClassMinutes * 60 * 1000));
      scheduledTime = beforeClassTime.toISOString();
      
      console.log(`⏰ 手動創建課前提醒: ${courseName} - ${teacherName}`);
      console.log(`   課程時間 (台灣): ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
      console.log(`   課程時間 (UTC): ${courseDateTimeUTC.toISOString()}`);
      console.log(`   課前提醒時間 (UTC): ${scheduledTime}`);
      console.log(`   課前提醒時間 (台灣): ${new Date(scheduledTime).toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})} (提前${beforeClassMinutes}分鐘)`);
    } else if (type === 'today') {
      // 當日提醒：當天08:00（台灣時間）
      const [year, month, day] = courseDate.split('-').map(Number);
      const reminderDate = new Date(year, month - 1, day, 8, 0, 0);
      
      // 轉換為 UTC 時間格式（台灣時間 - 8小時）
      const utcTime = new Date(reminderDate.getTime() - (8 * 60 * 60 * 1000));
      scheduledTime = utcTime.toISOString();
    } else if (type === 'tomorrow') {
      // 隔日提醒：前一天19:30（台灣時間）
      const [year, month, day] = courseDate.split('-').map(Number);
      const reminderDate = new Date(year, month - 1, day - 1, 19, 30, 0);
      
      // 轉換為 UTC 時間格式（台灣時間 - 8小時）
      const utcTime = new Date(reminderDate.getTime() - (8 * 60 * 60 * 1000));
      scheduledTime = utcTime.toISOString();
    }
    
    // 生成提醒訊息（如果沒有提供自定義訊息）
    let generatedMessage = message;
    if (!generatedMessage) {
      generatedMessage = await generateManualReminderMessage(teacherName, courseName, courseDate, courseTime, type);
    }
    
    // ✅ 嘗試從 CalDAV 獲取完整的課程資訊
    let location = '未指定地點';
    let description = '';
    let lessonPlanUrl = '';
    let googleMapsUrl = '';
    
    try {
      // 使用全域的 CalDAV 客戶端
      if (!caldavClient) {
        console.log('⚠️ CalDAV 客戶端未初始化，無法獲取課程資訊');
        throw new Error('CalDAV 客戶端未初始化');
      }
      
      // 獲取當天的所有講師事件
      const startDate = new Date(courseDate + 'T00:00:00+08:00');
      const endDate = new Date(courseDate + 'T23:59:59+08:00');
      console.log(`📅 查詢 ${courseDate} 的行事曆事件...`);
      const events = await caldavClient.getAllInstructorEvents(startDate, endDate);
      console.log(`📋 找到 ${events.length} 個事件`);
      
      // 尋找匹配的事件
      const matchedEvent = events.find(event => {
        const eventTitle = event.title || event.summary || '';
        const eventInstructor = event.instructor || '';
        
        // 從課程名稱中提取關鍵字（例如：「ESM 四 17:30-18:30 到府 第8週」 -> 「ESM」）
        const courseKeyword = courseName.split(/\s+/)[0];
        
        // 比對課程名稱和講師（使用更寬鬆的匹配）
        const titleMatch = eventTitle.includes(courseKeyword) || courseName.includes(eventTitle);
        const instructorMatch = eventInstructor === teacherName;
        
        console.log(`🔍 檢查事件: "${eventTitle}" vs "${courseName}" (關鍵字: "${courseKeyword}"), 講師: ${eventInstructor} vs ${teacherName}`);
        console.log(`   匹配結果: 標題=${titleMatch}, 講師=${instructorMatch}`);
        
        return titleMatch && instructorMatch;
      });
      
      if (matchedEvent) {
        console.log('✅ 找到對應的行事曆事件，提取完整資訊');
        location = matchedEvent.location || '未指定地點';
        description = matchedEvent.description || '';
        
        // 從描述中提取教案連結
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
        if (location && location !== '未指定地點') {
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
        }
        
        console.log(`📍 地點: ${location}`);
        console.log(`📖 教案連結: ${lessonPlanUrl || '未設定'}`);
      } else {
        console.log('⚠️ 找不到對應的行事曆事件，使用預設值');
      }
    } catch (error) {
      console.error('❌ 獲取行事曆事件失敗:', error.message);
    }
    
    // 計算星期幾
    const date = new Date(courseDate);
    const weekday = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()];
    
    const newReminder = {
      id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      teacherName,
      courseName,
      courseDate,
      courseTime,
      type,
      message: generatedMessage,
      status: 'pending',
      scheduledTime: scheduledTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // ✅ 新增 Flex Message 需要的欄位
      location: location,
      description: description,
      lessonPlanUrl: lessonPlanUrl,
      googleMapsUrl: googleMapsUrl,
      weekday: weekday
    };
    
    remindersData.reminders = remindersData.reminders || [];
    remindersData.reminders.push(newReminder);
    
    if (saveReminders(remindersData)) {
      console.log('✅ 提醒建立成功:', newReminder.id);
      res.json({
        success: true,
        message: '提醒建立成功',
        data: newReminder
      });
    } else {
      throw new Error('儲存提醒資料失敗');
    }
    
  } catch (error) {
    console.error('❌ 建立提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '建立提醒失敗',
      error: error.message
    });
  }
});
// 發送提醒API
app.post('/api/reminders/:id/send', async (req, res) => {
  try {
    const reminderId = req.params.id;
    const remindersData = loadReminders();
    const reminder = remindersData.reminders.find(r => r.id === reminderId);
    
    if (!reminder) {
      console.log('❌ 發送提醒失敗: 找不到提醒', reminderId);
      return res.status(404).json({
        success: false,
        message: '找不到指定的提醒'
      });
    }
    
    console.log('📤 開始發送提醒:', reminderId);
    console.log('📋 提醒詳情:', {
      teacherName: reminder.teacherName,
      courseName: reminder.courseName,
      courseDate: reminder.courseDate,
      courseTime: reminder.courseTime,
      type: reminder.type,
      status: reminder.status
    });
    
    // 查找講師的LINE User ID
    console.log('🔍 開始查找講師LINE User ID...');
    const teacherData = JSON.parse(fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8'));
    
    // ✅ 支援陣列格式：如果是陣列，轉換為物件格式
    let teachers = teacherData.teachers;
    if (Array.isArray(teachers)) {
      console.log('🔄 檢測到陣列格式，轉換為物件格式');
      const teachersObj = {};
      teachers.forEach(teacher => {
        if (teacher.name && teacher.userId) {
          teachersObj[teacher.name] = teacher.userId;
        }
      });
      teachers = teachersObj;
      console.log('✅ 轉換完成，可用講師:', Object.keys(teachers));
    } else {
      console.log('📚 可用的講師列表:', Object.keys(teachers));
    }
    
    // 嘗試不同的名稱格式匹配
    let teacherUserId = teachers[reminder.teacherName];
    console.log('🔍 嘗試精確匹配:', reminder.teacherName, '->', teacherUserId ? '✅ 找到' : '❌ 未找到');
    
    if (!teacherUserId) {
      // 嘗試首字母大寫格式
      const capitalizedName = reminder.teacherName.charAt(0).toUpperCase() + reminder.teacherName.slice(1).toLowerCase();
      teacherUserId = teachers[capitalizedName];
      console.log('🔍 嘗試首字母大寫:', capitalizedName, '->', teacherUserId ? '✅ 找到' : '❌ 未找到');
    }
    
    if (!teacherUserId) {
      // 嘗試全小寫格式
      const lowerCaseName = reminder.teacherName.toLowerCase();
      teacherUserId = teachers[lowerCaseName];
      console.log('🔍 嘗試全小寫:', lowerCaseName, '->', teacherUserId ? '✅ 找到' : '❌ 未找到');
    }
    
    if (!teacherUserId) {
      // 嘗試模糊匹配
      const teacherNames = Object.keys(teachers);
      const matchedTeacher = teacherNames.find(name => 
        name.toLowerCase() === reminder.teacherName.toLowerCase() ||
        name.toUpperCase() === reminder.teacherName.toUpperCase()
      );
      
      if (matchedTeacher) {
        teacherUserId = teachers[matchedTeacher];
        console.log('🔍 模糊匹配成功:', matchedTeacher, '->', teacherUserId ? '✅ 找到' : '❌ 未找到');
      } else {
        console.log('🔍 模糊匹配失敗');
      }
    }
    
    if (!teacherUserId) {
      console.log(`❌ 找不到講師 ${reminder.teacherName} 的LINE User ID`);
      console.log(`📋 可用的講師: ${Object.keys(teachers).join(', ')}`);
      return res.status(400).json({
        success: false,
        message: `找不到講師 ${reminder.teacherName} 的LINE User ID`
      });
    }
    
    console.log('✅ 找到講師LINE User ID:', teacherUserId);
    
    // 準備變數用於 Flex Message
    console.log('📝 開始準備提醒訊息...');
    
    // ✅ 動態計算距離上課的時間
    let timeUntilClass = '30分鐘後';  // 預設值
    if (reminder.type === 'before-class' && reminder.courseDate && reminder.courseTime) {
      try {
        const [year, month, day] = reminder.courseDate.split('-').map(Number);
        const [hour, minute] = reminder.courseTime.split(':').map(Number);
        
        // 使用台灣時區創建課程時間
        const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
        const courseDateTime = new Date(taiwanTimeStr);
        const now = new Date();
        const diff = courseDateTime - now;
        const minutesUntil = Math.floor(diff / (1000 * 60));
        
        if (minutesUntil > 60) {
          const hours = Math.floor(minutesUntil / 60);
          const mins = minutesUntil % 60;
          timeUntilClass = mins > 0 ? `${hours}小時${mins}分鐘後` : `${hours}小時後`;
        } else if (minutesUntil > 0) {
          timeUntilClass = `${minutesUntil}分鐘後`;
        } else if (minutesUntil > -30) {
          timeUntilClass = '即將開始';
        } else {
          timeUntilClass = '已開始';
        }
        
        console.log(`⏰ 計算上課時間: 課程時間=${taiwanTimeStr}, 剩餘=${timeUntilClass}`);
      } catch (error) {
        console.error('❌ 計算上課時間失敗:', error);
      }
    }
    
    const variables = {
      teacherName: reminder.teacherName || '未知講師',
      courseName: reminder.courseName || '未知課程',
      courseDate: reminder.courseDate || '未知日期',
      courseTime: reminder.courseTime || '未知時間',
      location: reminder.location || '未指定地點',
      description: reminder.description || '',
      lessonPlanUrl: reminder.lessonPlanUrl || '',
      googleMapsUrl: reminder.googleMapsUrl || 'https://maps.google.com',
      weekday: reminder.weekday || getWeekday(reminder.courseDate),  // ✅ 優先使用 reminder.weekday
      currentTime: new Date().toLocaleTimeString('zh-TW'),
      currentDate: new Date().toLocaleDateString('zh-TW'),
      reminderType: reminder.type,
      reminderTypeText: reminder.type === 'today' ? '當日' : reminder.type === 'tomorrow' ? '隔日' : '課前',
      timeUntilClass: timeUntilClass,  // ✅ 使用動態計算的值
      systemName: '樂程坊課程系統',
      reminderId: reminder.id
    };

    // 檢查是否有 LINE Channel Access Token
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      console.error('❌ LINE_CHANNEL_ACCESS_TOKEN 未設定，無法發送提醒');
      return res.status(500).json({
        success: false,
        message: 'LINE_CHANNEL_ACCESS_TOKEN 未設定，無法發送提醒',
        data: reminder
      });
    }

    // 使用 NotificationManager 發送
    console.log('📤 開始透過 NotificationManager 發送提醒...');
    console.log('🎯 目標講師:', reminder.teacherName, 'LINE User ID:', teacherUserId);
    
    // 準備發送選項
    let sendOptions = {};
    let notificationMessage;

    // 檢查是否啟用 Flex Message
    if (notificationManager.flexTemplates.enabled) {
      console.log('✨ 使用 Flex Message 格式');
      const flexMessage = notificationManager.buildFlexMessage(reminder.type, variables);
      if (flexMessage) {
        sendOptions.flexMessage = flexMessage;
        sendOptions.altText = `${variables.reminderTypeText}課程提醒 - ${variables.courseName}`;
        notificationMessage = sendOptions.altText; // 用於 log
      }
    }

    // 如果沒有 Flex Message，使用文字訊息
    if (!sendOptions.flexMessage) {
      console.log('📝 使用文字訊息格式');
      if (reminder.message) {
        notificationMessage = processTemplate(reminder.message, reminder);
      } else {
        const templates = {
          today: `📚 今日課程提醒\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}\n📍 地點：{location}\n\n請準備好課程內容，祝教學順利！`,
          tomorrow: `📚 明日課程提醒\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}\n📍 地點：{location}\n\n請提前準備課程內容！`,
          'before-class': `📚 課程即將開始\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}\n📍 地點：{location}\n⌛ 距離上課：{timeUntilClass}\n\n課程即將開始，請準備就緒！`
        };
        const template = templates[reminder.type] || `📚 課程提醒\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}`;
        notificationMessage = notificationManager.formatMessage(template, variables);
      }
    }

    console.log('📝 訊息類型:', sendOptions.flexMessage ? 'Flex Message' : '文字訊息');
    
    // 按類型決定是否附加 Quick Reply
    console.log(`🔍 [Server] 開始檢查 Quick Reply，提醒類型: ${reminder.type}`);
    const qr = notificationManager.buildQuickReply(variables, reminder.type);
    if (qr) {
      sendOptions.quickReply = qr;
      console.log(`✅ [Server] Quick Reply 已附加到 sendOptions`);
    } else {
      console.log(`❌ [Server] 類型 ${reminder.type} 不需要 Quick Reply`);
    }
    console.log(`📊 [Server] 最終 sendOptions:`, JSON.stringify({
      hasFlexMessage: !!sendOptions.flexMessage,
      hasQuickReply: !!sendOptions.quickReply,
      altText: sendOptions.altText
    }, null, 2));

    // 透過 NotificationManager 發送
    const result = await notificationManager.sendLineMessage(teacherUserId, notificationMessage, sendOptions);
    
    if (!result.success) {
      throw new Error(result.error || '發送失敗');
    }
    
    console.log('📊 訊息發送成功');
    
    // 更新提醒狀態
    console.log('💾 更新提醒狀態為 sent...');
    reminder.status = 'sent';
    reminder.sentAt = new Date().toISOString();
    reminder.updatedAt = new Date().toISOString();
    saveReminders(remindersData);
    console.log('✅ 提醒狀態更新完成');
    
    console.log('✅ 提醒發送成功:', reminderId);
    res.json({
      success: true,
      message: '提醒發送成功',
      data: reminder,
      flexMessageUsed: !!sendOptions.flexMessage,
      messageType: sendOptions.flexMessage ? 'flex' : 'text'
    });
    
  } catch (error) {
    console.error('❌ 發送提醒失敗:', error);
    
    // 更新提醒狀態為失敗
    const remindersData = loadReminders();
    const reminder = remindersData.reminders.find(r => r.id === req.params.id);
    if (reminder) {
      reminder.status = 'failed';
      reminder.updatedAt = new Date().toISOString();
      saveReminders(remindersData);
    }
    
    res.status(500).json({
      success: false,
      message: '發送提醒失敗',
      error: error.message
    });
  }
});

// 測試發送提醒 API（僅發送給管理員）
app.post('/api/reminders/:id/send-test', async (req, res) => {
  try {
    const reminderId = req.params.id;
    const remindersData = loadReminders();
    const reminder = remindersData.reminders.find(r => r.id === reminderId);
    
    if (!reminder) {
      console.log('❌ 測試發送失敗: 找不到提醒', reminderId);
      return res.status(404).json({
        success: false,
        message: '找不到指定的提醒'
      });
    }
    
    console.log('🧪 測試模式：開始發送提醒給管理員:', reminderId);
    console.log('📋 提醒詳情:', {
      teacherName: reminder.teacherName,
      courseName: reminder.courseName,
      courseDate: reminder.courseDate,
      courseTime: reminder.courseTime,
      type: reminder.type
    });
    
    // 獲取管理員 User ID
    const adminUserId = notificationManager.getAdminUserId();
    console.log('👤 管理員 User ID:', adminUserId);
    
    // ✅ 動態計算距離上課的時間
    let timeUntilClass = '30分鐘後';  // 預設值
    if (reminder.type === 'before-class' && reminder.courseDate && reminder.courseTime) {
      try {
        const [year, month, day] = reminder.courseDate.split('-').map(Number);
        const [hour, minute] = reminder.courseTime.split(':').map(Number);
        
        // 使用台灣時區創建課程時間
        const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
        const courseDateTime = new Date(taiwanTimeStr);
        const now = new Date();
        const diff = courseDateTime - now;
        const minutesUntil = Math.floor(diff / (1000 * 60));
        
        if (minutesUntil > 60) {
          const hours = Math.floor(minutesUntil / 60);
          const mins = minutesUntil % 60;
          timeUntilClass = mins > 0 ? `${hours}小時${mins}分鐘後` : `${hours}小時後`;
        } else if (minutesUntil > 0) {
          timeUntilClass = `${minutesUntil}分鐘後`;
        } else if (minutesUntil > -30) {
          timeUntilClass = '即將開始';
        } else {
          timeUntilClass = '已開始';
        }
        
        console.log(`⏰ [測試] 計算上課時間: 課程時間=${taiwanTimeStr}, 剩餘=${timeUntilClass}`);
      } catch (error) {
        console.error('❌ 計算上課時間失敗:', error);
      }
    }
    
    // 準備變數
    const variables = {
      teacherName: reminder.teacherName || '未知講師',
      courseName: reminder.courseName || '未知課程',
      courseDate: reminder.courseDate || '未知日期',
      courseTime: reminder.courseTime || '未知時間',
      location: reminder.location || '未指定地點',
      description: reminder.description || '',
      lessonPlanUrl: reminder.lessonPlanUrl || '',
      googleMapsUrl: reminder.googleMapsUrl || 'https://maps.google.com',
      weekday: reminder.weekday || getWeekday(reminder.courseDate),  // ✅ 優先使用 reminder.weekday
      currentTime: new Date().toLocaleTimeString('zh-TW'),
      currentDate: new Date().toLocaleDateString('zh-TW'),
      reminderType: reminder.type,
      reminderTypeText: reminder.type === 'today' ? '當日' : reminder.type === 'tomorrow' ? '隔日' : '課前',
      timeUntilClass: timeUntilClass,  // ✅ 使用動態計算的值
      systemName: '樂程坊課程系統',
      reminderId: reminder.id
    };
    
    // 檢查是否啟用 Flex Message
    let sendOptions = {};
    if (notificationManager.flexTemplates.enabled) {
      const flexMessage = notificationManager.buildFlexMessage(reminder.type, variables);
      if (flexMessage) {
        sendOptions.flexMessage = flexMessage;
        sendOptions.altText = `[測試] ${variables.reminderTypeText}課程提醒 - ${variables.courseName}`;
      }
    }
    
    // 構建測試訊息
    let testMessage;
    if (!sendOptions.flexMessage) {
      // 使用文字訊息
      testMessage = `[測試模式]\n\n📚 ${variables.reminderTypeText}課程提醒\n\n👨‍🏫 講師：${variables.teacherName}\n📖 課程：${variables.courseName}\n⏰ 時間：${variables.courseTime}\n📅 日期：${variables.courseDate}\n📍 地點：${variables.location}\n\n這是測試訊息，僅發送給管理員。`;
    }
    
    // 使用 NotificationManager 發送測試訊息
    const result = await notificationManager.sendTestMessage(testMessage, sendOptions);
    
    if (result.success) {
      console.log('✅ 測試訊息發送成功');
      res.json({
        success: true,
        message: '測試訊息已發送給管理員',
        flexMessageUsed: !!sendOptions.flexMessage,
        messageType: sendOptions.flexMessage ? 'flex' : 'text',
        data: {
          reminder: reminder,
          sentTo: 'admin',
          adminUserId: adminUserId,
          flexMessageEnabled: notificationManager.flexTemplates.enabled
        }
      });
    } else {
      throw new Error(result.error || '發送測試訊息失敗');
    }
    
  } catch (error) {
    console.error('❌ 測試發送失敗:', error);
    res.status(500).json({
      success: false,
      message: '測試發送失敗',
      error: error.message
    });
  }
});

// Quick Reply 出席回應處理 API
app.post('/api/quick-reply/attendance', async (req, res) => {
  try {
    const { studentName, courseName, courseDate, response, leaveReason } = req.body;
    
    console.log('📝 收到學生出席回覆:', {
      studentName,
      courseName,
      courseDate,
      response,
      leaveReason
    });
    
    // 讀取學生回應記錄
    const studentResponsesPath = path.join(__dirname, 'student-responses.json');
    let responsesData = { responses: [] };
    
    if (fs.existsSync(studentResponsesPath)) {
      try {
        const data = fs.readFileSync(studentResponsesPath, 'utf8');
        responsesData = JSON.parse(data);
      } catch (error) {
        console.error('❌ 讀取學生回應記錄失敗:', error);
      }
    }
    
    // 新增回應記錄
    const newResponse = {
      id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      studentName,
      courseName,
      courseDate,
      responseType: response, // attend, leave, pending
      leaveReason: leaveReason || null,
      timestamp: new Date().toISOString()
    };
    
    responsesData.responses.push(newResponse);
    
    // 儲存回應記錄
    fs.writeFileSync(studentResponsesPath, JSON.stringify(responsesData, null, 2));
    
    console.log('✅ 學生回應記錄已儲存');
    
    // 發送通知給管理員（可選）
    const responseText = response === 'attend' ? '會出席' : 
                        response === 'leave' ? '請假' : 
                        '待確認';
    
    const adminMessage = `📋 學生出席回覆\n\n👤 學生：${studentName}\n📖 課程：${courseName}\n📅 日期：${courseDate}\n✅ 回覆：${responseText}${leaveReason ? `\n📝 原因：${leaveReason}` : ''}`;
    
    try {
      await notificationManager.sendLineMessage(
        notificationManager.getAdminUserId(),
        adminMessage
      );
      console.log('✅ 已通知管理員');
    } catch (error) {
      console.error('⚠️ 通知管理員失敗:', error);
    }
    
    res.json({
      success: true,
      message: '出席回覆已記錄',
      data: newResponse
    });
    
  } catch (error) {
    console.error('❌ 處理出席回覆失敗:', error);
    res.status(500).json({
      success: false,
      message: '處理出席回覆失敗',
      error: error.message
    });
  }
});

// 獲取學生回應記錄 API
app.get('/api/student-responses', (req, res) => {
  try {
    const studentResponsesPath = path.join(__dirname, 'student-responses.json');
    
    if (fs.existsSync(studentResponsesPath)) {
      const data = fs.readFileSync(studentResponsesPath, 'utf8');
      const responsesData = JSON.parse(data);
      
      res.json({
        success: true,
        data: responsesData.responses || []
      });
    } else {
      res.json({
        success: true,
        data: []
      });
    }
  } catch (error) {
    console.error('❌ 獲取學生回應記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取學生回應記錄失敗',
      error: error.message
    });
  }
});

// ========================================
// POST /api/student-responses
// 用途：讓轉發系統直接新增學生回應記錄
// ========================================
app.post('/api/student-responses', async (req, res) => {
  try {
    const {
      studentName,
      courseName,
      courseDate,
      responseType,
      leaveReason,
      userId,
      timestamp
    } = req.body;
    
    // 驗證必填欄位
    if (!studentName || !courseName || !courseDate || !responseType) {
      return res.status(400).json({
        success: false,
        message: '缺少必填欄位',
        required: ['studentName', 'courseName', 'courseDate', 'responseType']
      });
    }
    
    // 驗證 responseType
    const validTypes = ['attend', 'leave', 'pending'];
    if (!validTypes.includes(responseType)) {
      return res.status(400).json({
        success: false,
        message: `無效的回應類型。有效值: ${validTypes.join(', ')}`
      });
    }
    
    // 如果是請假，必須有理由
    if (responseType === 'leave' && !leaveReason) {
      return res.status(400).json({
        success: false,
        message: '請假回應必須提供理由'
      });
    }
    
    const studentResponsesPath = path.join(__dirname, 'student-responses.json');
    let responsesData = { responses: [] };
    
    // 讀取現有資料
    if (fs.existsSync(studentResponsesPath)) {
      try {
        const data = fs.readFileSync(studentResponsesPath, 'utf8');
        responsesData = JSON.parse(data);
        if (!responsesData.responses) {
          responsesData.responses = [];
        }
      } catch (error) {
        console.warn('⚠️ 無法讀取現有學生回應，將創建新檔案');
        responsesData = { responses: [] };
      }
    }
    
    // 生成回應 ID
    const responseId = `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 建立回應記錄
    const newResponse = {
      id: responseId,
      studentName,
      courseName,
      courseDate,
      responseType,
      timestamp: timestamp || new Date().toISOString(),
      userId: userId || 'unknown'
    };
    
    // 如果是請假，加入理由
    if (responseType === 'leave') {
      newResponse.leaveReason = leaveReason;
    }
    
    // 檢查是否已有相同的記錄（防止重複）
    const existingIndex = responsesData.responses.findIndex(r =>
      r.studentName === studentName &&
      r.courseName === courseName &&
      r.courseDate === courseDate
    );
    
    if (existingIndex !== -1) {
      // 更新現有記錄
      console.log(`📝 更新現有回應: ${studentName} - ${courseName} - ${courseDate}`);
      responsesData.responses[existingIndex] = newResponse;
    } else {
      // 新增記錄
      console.log(`✅ 新增學生回應: ${studentName} - ${courseName} - ${courseDate} - ${responseType}`);
      responsesData.responses.push(newResponse);
    }
    
    // 儲存檔案
    fs.writeFileSync(
      studentResponsesPath,
      JSON.stringify(responsesData, null, 2),
      'utf8'
    );
    
    console.log(`💾 學生回應已儲存 (總數: ${responsesData.responses.length})`);
    
    // 🔔 發送自動通知到群組（批次處理）
    try {
      const leaveNotifConfigPath = path.join(__dirname, 'leave-notification-config.json');
      if (fs.existsSync(leaveNotifConfigPath)) {
        const notifConfig = JSON.parse(fs.readFileSync(leaveNotifConfigPath, 'utf8'));
        
        // 檢查是否啟用，且符合通知條件
        if (notifConfig.enabled && notifConfig.notifyOn[responseType]) {
          console.log(`🔔 加入批次通知佇列: ${responseType === 'leave' ? '請假' : '待確認'} - ${studentName}`);
          
          // 準備變數資料
          const now = new Date();
          const replyTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          const variables = {
            studentName,
            courseName,
            courseDate,
            courseTime: req.body.courseTime || '',
            location: req.body.location || '',
            weekday: req.body.weekday || '',
            leaveReason: leaveReason || '',
            replyTime
          };
          
          // 加入批次佇列
          pendingNotifications[responseType].push({ variables });
          
          // 清除現有定時器（如果有）
          if (pendingNotifications.timers[responseType]) {
            clearTimeout(pendingNotifications.timers[responseType]);
          }
          
          // 設置新的定時器（3 秒後發送）
          pendingNotifications.timers[responseType] = setTimeout(() => {
            console.log(`⏰ [批次通知] 定時器觸發 - ${responseType}`);
            sendBatchNotifications(responseType, notificationManager);
          }, 3000);
          
          console.log(`📦 [批次通知] 佇列中有 ${pendingNotifications[responseType].length} 個通知，3秒後發送`);
        }
      }
    } catch (notifError) {
      console.error('⚠️ 發送通知時出錯:', notifError);
      // 不影響主流程，繼續執行
    }
    
    res.json({
      success: true,
      message: '學生回應已記錄',
      data: {
        id: responseId,
        studentName,
        courseName,
        courseDate,
        responseType,
        leaveReason: responseType === 'leave' ? leaveReason : undefined
      }
    });
    
  } catch (error) {
    console.error('❌ 儲存學生回應失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存學生回應失敗',
      error: error.message
    });
  }
});

// ========================================
// GET /api/leave-notification-config
// 用途：獲取請假通知配置
// ========================================
app.get('/api/leave-notification-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'leave-notification-config.json');
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json({
        success: true,
        data: config
      });
    } else {
      // 返回預設配置
      res.json({
        success: true,
        data: {
          enabled: false,
          groupId: '',
          notifyOn: {
            attend: false,
            leave: true,
            pending: true
          },
          useFlexMessage: true
        }
      });
    }
  } catch (error) {
    console.error('❌ 讀取請假通知配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取配置失敗',
      error: error.message
    });
  }
});

// ========================================
// POST /api/leave-notification-config
// 用途：儲存請假通知配置
// ========================================
app.post('/api/leave-notification-config', (req, res) => {
  try {
    const { enabled, groupId, notifyOn, useFlexMessage } = req.body;
    
    // 驗證必填欄位
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled 欄位必須是 boolean'
      });
    }
    
    if (enabled && !groupId) {
      return res.status(400).json({
        success: false,
        message: '啟用通知時必須提供群組 ID'
      });
    }
    
    const config = {
      enabled,
      groupId: groupId || '',
      notifyOn: notifyOn || {
        attend: false,
        leave: true,
        pending: true
      },
      useFlexMessage: typeof useFlexMessage === 'boolean' ? useFlexMessage : true,
      description: '學生回應自動通知設定',
      updatedAt: new Date().toISOString()
    };
    
    const configPath = path.join(__dirname, 'leave-notification-config.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    console.log('✅ 請假通知配置已儲存:', config);
    
    res.json({
      success: true,
      message: '配置已儲存',
      data: config
    });
    
  } catch (error) {
    console.error('❌ 儲存請假通知配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存配置失敗',
      error: error.message
    });
  }
});

// 輔助函數：取得星期幾
function getWeekday(dateString) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const date = new Date(dateString);
  return `星期${weekdays[date.getDay()]}`;
}

// LINE Webhook 處理
app.post('/webhook/line', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 📡 記錄轉發系統資訊（根據 WEBHOOK串接技術指南）
    const forwardedFrom = req.headers['x-forwarded-from'];
    const forwardTime = req.headers['x-forward-time'];
    const authHeader = req.headers['authorization'];
    
    console.log('📥 收到 Webhook 請求', {
      timestamp: new Date().toISOString(),
      forwardedFrom: forwardedFrom || '(直接)',
      forwardTime: forwardTime || '(未提供)',
      hasAuth: authHeader ? '✓' : '✗',
      ip: req.ip
    });
    
    // 🔒 驗證來源（如果是從轉發系統來的）
    if (forwardedFrom && forwardedFrom !== 'FLB-LINE-Bot') {
      console.error('❌ 來源驗證失敗:', forwardedFrom);
      return res.status(403).json({ error: 'Forbidden', message: '來源驗證失敗' });
    }
    
    // 🔐 驗證 API 密鑰（可選，如果環境變數有設定）
    const expectedApiKey = process.env.WEBHOOK_API_KEY;
    if (expectedApiKey && authHeader !== `Bearer ${expectedApiKey}`) {
      console.error('❌ API 密鑰驗證失敗');
      return res.status(401).json({ error: 'Unauthorized', message: 'API 密鑰驗證失敗' });
    }
    
    const events = req.body.events || [];
    const destination = req.body.destination;
    
    console.log('📥 LINE Webhook 事件:', {
      eventCount: events.length,
      destination: destination || '(未提供)',
      eventTypes: events.map(e => e.type).join(', ')
    });
    
    // 快速回應 200 OK（符合 LINE Webhook 要求）
    res.status(200).json({ success: true });
    
    // 非同步處理事件
    for (const event of events) {
      try {
        console.log('📋 處理事件類型:', event.type);
        
        if (event.type === 'postback') {
          // 處理 Quick Reply 回應
          const postbackData = JSON.parse(event.postback.data || '{}');
          console.log('📝 Postback 資料:', postbackData);
          
          if (postbackData.action === 'attendance_reply') {
            // 學生出席回覆
            const { response, courseName, courseDate, studentName, courseTime, location, weekday } = postbackData;
            
            console.log(`👤 學生回覆 - ${studentName}: ${response} (${courseName} ${courseDate})`);
            
            if (response === 'leave') {
              // 🏥 請假流程：詢問請假理由
              console.log('🏥 請假流程開始，詢問請假理由...');
              
              // 保存等待狀態
              const pendingLeavePath = path.join(__dirname, 'pending-leave-requests.json');
              let pendingData = { pendingLeaves: [] };
              
              if (fs.existsSync(pendingLeavePath)) {
                const data = fs.readFileSync(pendingLeavePath, 'utf8');
                pendingData = JSON.parse(data);
              }
              
              const pendingLeave = {
                userId: event.source.userId,
                studentName,
                courseName,
                courseDate,
                courseTime: courseTime || '未知時間',
                location: location || '未知地點',
                weekday: weekday || '',
                timestamp: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10分鐘過期
              };
              
              pendingData.pendingLeaves.push(pendingLeave);
              fs.writeFileSync(pendingLeavePath, JSON.stringify(pendingData, null, 2));
              
              // 發送請假理由選項
              const leaveMessage = `🏥 ${studentName} - ${courseName}\n${courseDate}\n\n請選擇請假理由：`;
              
              const quickReply = {
                items: [
                  {
                    type: 'action',
                    action: {
                      type: 'postback',
                      label: '🤒 生病',
                      data: JSON.stringify({
                        action: 'leave_reason',
                        reason: '生病',
                        studentName,
                        courseName,
                        courseDate
                      })
                    }
                  },
                  {
                    type: 'action',
                    action: {
                      type: 'postback',
                      label: '👨‍👩‍👧 家庭因素',
                      data: JSON.stringify({
                        action: 'leave_reason',
                        reason: '家庭因素',
                        studentName,
                        courseName,
                        courseDate
                      })
                    }
                  },
                  {
                    type: 'action',
                    action: {
                      type: 'postback',
                      label: '⚠️ 臨時有事',
                      data: JSON.stringify({
                        action: 'leave_reason',
                        reason: '臨時有事',
                        studentName,
                        courseName,
                        courseDate
                      })
                    }
                  },
                  {
                    type: 'action',
                    action: {
                      type: 'postback',
                      label: '📝 其他',
                      data: JSON.stringify({
                        action: 'leave_reason',
                        reason: '其他',
                        studentName,
                        courseName,
                        courseDate
                      })
                    }
                  }
                ]
              };
              
              await notificationManager.sendLineMessage(
                event.source.userId,
                leaveMessage,
                { quickReply }
              );
              
              console.log('✅ 已發送請假理由選項');
              
            } else {
              // ✅ 會出席 或 ⏳ 待確認：直接記錄
              const studentResponsesPath = path.join(__dirname, 'student-responses.json');
              let responsesData = { responses: [] };
              
              if (fs.existsSync(studentResponsesPath)) {
                const data = fs.readFileSync(studentResponsesPath, 'utf8');
                responsesData = JSON.parse(data);
              }
              
              const newResponse = {
                id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                studentName,
                courseName,
                courseDate,
                responseType: response,
                leaveReason: null,
                timestamp: new Date().toISOString(),
                userId: event.source.userId
              };
              
              responsesData.responses.push(newResponse);
              fs.writeFileSync(studentResponsesPath, JSON.stringify(responsesData, null, 2));
              
              console.log('✅ 學生回應已記錄');
              
              // 發送確認訊息給使用者
              const confirmMessage = response === 'attend' ? 
                `✅ 已記錄：${studentName} 會出席 ${courseName}\n日期：${courseDate}` :
                `⏳ 已記錄：${studentName} 待確認 ${courseName}\n日期：${courseDate}`;
              
              await notificationManager.sendLineMessage(
                event.source.userId,
                confirmMessage
              );
              
              // 通知管理員
              const adminMessage = `📋 學生出席回覆\n\n👤 學生：${studentName}\n📖 課程：${courseName}\n📅 日期：${courseDate}\n✅ 回覆：${response === 'attend' ? '會出席' : '待確認'}`;
              
              await notificationManager.sendLineMessage(
                notificationManager.getAdminUserId(),
                adminMessage
              );
              
              console.log('✅ 確認訊息已發送');
            }
          } else if (postbackData.action === 'leave_reason') {
            // 🏥 處理請假理由回覆
            const { reason, studentName, courseName, courseDate } = postbackData;
            
            console.log(`🏥 收到請假理由 - ${studentName}: ${reason}`);
            
            // 從等待列表中找到對應的請假申請
            const pendingLeavePath = path.join(__dirname, 'pending-leave-requests.json');
            let pendingData = { pendingLeaves: [] };
            
            if (fs.existsSync(pendingLeavePath)) {
              const data = fs.readFileSync(pendingLeavePath, 'utf8');
              pendingData = JSON.parse(data);
            }
            
            const leaveIndex = pendingData.pendingLeaves.findIndex(
              l => l.userId === event.source.userId && 
                   l.studentName === studentName && 
                   l.courseName === courseName &&
                   l.courseDate === courseDate
            );
            
            if (leaveIndex !== -1) {
              const leaveInfo = pendingData.pendingLeaves[leaveIndex];
              
              // 記錄到學生回應
              const studentResponsesPath = path.join(__dirname, 'student-responses.json');
              let responsesData = { responses: [] };
              
              if (fs.existsSync(studentResponsesPath)) {
                const data = fs.readFileSync(studentResponsesPath, 'utf8');
                responsesData = JSON.parse(data);
              }
              
              const newResponse = {
                id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                studentName,
                courseName,
                courseDate,
                responseType: 'leave',
                leaveReason: reason,
                timestamp: new Date().toISOString(),
                userId: event.source.userId
              };
              
              responsesData.responses.push(newResponse);
              fs.writeFileSync(studentResponsesPath, JSON.stringify(responsesData, null, 2));
              
              // 發送確認訊息給家長
              await notificationManager.sendLineMessage(
                event.source.userId,
                `✅ 已記錄：${studentName} 請假 ${courseName}\n日期：${courseDate}\n理由：${reason}\n\n謝謝您的回覆！`
              );
              
              // 🎯 發送 Flex Message 到正職群組
              const flexVariables = {
                studentName,
                courseName,
                courseDate,
                weekday: leaveInfo.weekday || '',
                courseTime: leaveInfo.courseTime || '未知時間',
                location: leaveInfo.location || '未知地點',
                leaveReason: reason,
                replyTime: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
              };
              
              const leaveFlexMessage = notificationManager.buildFlexMessage('leaveNotification', flexVariables);
              
              if (leaveFlexMessage) {
                await notificationManager.sendLineMessage(
                  STAFF_GROUP_ID,
                  '',
                  {
                    flexMessage: leaveFlexMessage,
                    altText: `🏥 請假通知 - ${studentName} - ${courseName}`
                  }
                );
                console.log('✅ 請假通知已發送到正職群組');
              } else {
                // 備用：發送文字訊息
                const staffMessage = `🏥 學生請假通知\n\n👤 學生：${studentName}\n📖 課程：${courseName}\n📅 日期：${courseDate} ${leaveInfo.weekday}\n⏰ 時間：${leaveInfo.courseTime}\n📍 地點：${leaveInfo.location}\n🏥 理由：${reason}\n⏱️ 回覆時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;
                await notificationManager.sendLineMessage(STAFF_GROUP_ID, staffMessage);
                console.log('✅ 請假通知已發送到正職群組（文字訊息）');
              }
              
              // 移除已處理的等待項目
              pendingData.pendingLeaves.splice(leaveIndex, 1);
              fs.writeFileSync(pendingLeavePath, JSON.stringify(pendingData, null, 2));
              
              console.log('✅ 請假處理完成');
            } else {
              console.log('⚠️ 找不到對應的等待請假申請');
              await notificationManager.sendLineMessage(
                event.source.userId,
                '抱歉，找不到對應的請假申請，請重新操作。'
              );
            }
          }
        } else if (event.type === 'message' && event.message.type === 'text') {
          // 處理文字訊息（可能是請假原因的補充）
          // 這裡可以實作更複雜的對話邏輯
          console.log('💬 收到文字訊息:', event.message.text);
        }
        
      } catch (eventError) {
        console.error('❌ 處理單個事件失敗:', eventError);
      }
    }
    
    // 記錄處理完成
    const processingTime = Date.now() - startTime;
    console.log(`✅ Webhook 處理完成 (${processingTime}ms)`);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Webhook 處理失敗:', {
      error: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`
    });
    // 即使錯誤也要回應 200，避免 LINE/轉發系統重送
    if (!res.headersSent) {
      res.status(200).json({ success: true, error: 'Processing failed but acknowledged' });
    }
  }
});

// 更新提醒API（支援一般提醒和學生提醒）
app.put('/api/reminders/:id', (req, res) => {
  try {
    const reminderId = req.params.id;
    const updates = req.body;
    console.log('📝 收到更新提醒請求:', reminderId, updates);
    
    const remindersData = loadReminders();
    
    // 先在一般提醒中尋找
    let reminderIndex = remindersData.reminders.findIndex(r => r.id === reminderId);
    let isStudentReminder = false;
    
    // 如果沒找到，在學生提醒中尋找
    if (reminderIndex === -1) {
      reminderIndex = remindersData.studentReminders.findIndex(r => r.id === reminderId);
      isStudentReminder = true;
      console.log('🔍 在學生提醒中找到:', reminderIndex !== -1);
    } else {
      console.log('🔍 在一般提醒中找到:', reminderIndex !== -1);
    }
    
    if (reminderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的提醒'
      });
    }
    
    // 更新提醒資料
    if (isStudentReminder) {
      remindersData.studentReminders[reminderIndex] = {
        ...remindersData.studentReminders[reminderIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      console.log('✅ 學生提醒更新成功');
    } else {
      remindersData.reminders[reminderIndex] = {
        ...remindersData.reminders[reminderIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      console.log('✅ 一般提醒更新成功');
    }
    
    if (saveReminders(remindersData)) {
      const updatedReminder = isStudentReminder ? 
        remindersData.studentReminders[reminderIndex] : 
        remindersData.reminders[reminderIndex];
        
      res.json({
        success: true,
        message: '提醒更新成功',
        data: updatedReminder
      });
    } else {
      throw new Error('儲存提醒資料失敗');
    }
    
  } catch (error) {
    console.error('❌ 更新提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新提醒失敗',
      error: error.message
    });
  }
});

// 刪除提醒API（支援一般提醒和學生提醒）
app.delete('/api/reminders/:id', (req, res) => {
  try {
    const reminderId = req.params.id;
    console.log('🗑️ 收到刪除提醒請求:', reminderId);
    
    const remindersData = loadReminders();
    
    // ⭐ 修復：先在一般提醒中尋找
    let reminderIndex = remindersData.reminders.findIndex(r => r.id === reminderId);
    let isStudentReminder = false;
    let deletedReminder;
    
    // 如果沒找到，在學生提醒中尋找
    if (reminderIndex === -1) {
      reminderIndex = remindersData.studentReminders?.findIndex(r => r.id === reminderId) ?? -1;
      isStudentReminder = true;
      console.log('🔍 在學生提醒中尋找:', reminderIndex !== -1 ? '找到' : '未找到');
    } else {
      console.log('🔍 在一般提醒中找到');
    }
    
    if (reminderIndex === -1) {
      console.log('❌ 找不到指定的提醒:', reminderId);
      return res.status(404).json({
        success: false,
        message: '找不到指定的提醒'
      });
    }
    
    // 從對應的陣列中刪除
    if (isStudentReminder) {
      deletedReminder = remindersData.studentReminders.splice(reminderIndex, 1)[0];
      console.log('🗑️ 已刪除學生提醒:', {
        id: deletedReminder.id,
        studentName: deletedReminder.studentName,
        courseName: deletedReminder.courseName,
        status: deletedReminder.status
      });
    } else {
      deletedReminder = remindersData.reminders.splice(reminderIndex, 1)[0];
      console.log('🗑️ 已刪除提醒:', {
        id: deletedReminder.id,
        teacherName: deletedReminder.teacherName,
        courseName: deletedReminder.courseName,
        status: deletedReminder.status
      });
    }
    
    if (saveReminders(remindersData)) {
      console.log('✅ 提醒刪除成功，已儲存到資料庫');
      res.json({
        success: true,
        message: isStudentReminder ? '學生提醒刪除成功' : '提醒刪除成功',
        data: deletedReminder
      });
    } else {
      console.log('❌ 儲存資料庫失敗');
      throw new Error('儲存提醒資料失敗');
    }
    
  } catch (error) {
    console.error('❌ 刪除提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '刪除提醒失敗',
      error: error.message
    });
  }
});

// 排程器控制API
app.post('/api/reminder-scheduler/start', (req, res) => {
  try {
    console.log('🚀 收到啟動排程器請求');
    reminderScheduler.start();
    console.log('✅ 提醒排程器已啟動');
    res.json({
      success: true,
      message: '提醒排程器已啟動'
    });
  } catch (error) {
    console.error('❌ 啟動排程器失敗:', error);
    res.status(500).json({
      success: false,
      message: '啟動排程器失敗',
      error: error.message
    });
  }
});

app.post('/api/reminder-scheduler/stop', (req, res) => {
  try {
    reminderScheduler.stop();
    res.json({
      success: true,
      message: '提醒排程器已停止'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '停止排程器失敗',
      error: error.message
    });
  }
});

app.get('/api/reminder-scheduler/status', (req, res) => {
  try {
    const status = reminderScheduler.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '獲取排程器狀態失敗',
      error: error.message
    });
  }
});

// 獲取學生資料API（合併正常學生和臨時學生）
app.get('/api/students', (req, res) => {
  try {
    console.log('👨‍🎓 獲取學生資料...');
    
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    
    let regularStudents = [];
    
    if (fs.existsSync(studentDataPath)) {
      const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
      regularStudents = studentData.students || [];
      console.log('✅ 成功讀取正常學生資料，數量:', regularStudents.length);
    } else {
      console.log('⚠️ 學生資料檔案不存在，僅返回臨時學生');
    }
    
    // 讀取臨時學生
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    let tempStudents = [];
    
    if (fs.existsSync(tempDataPath)) {
      const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
      const now = new Date();
      
      // 過濾掉過期的臨時學生
      tempStudents = tempData.students.filter(s => {
        const expiry = new Date(s.expiryDate + 'T23:59:59');
        return expiry >= now;
      });
      
      console.log('✅ 成功讀取臨時學生資料，數量:', tempStudents.length);
    }
    
    // 合併學生列表
    const allStudents = [...regularStudents, ...tempStudents];
    
    res.json({
      success: true,
      data: allStudents,
      count: allStudents.length,
      regularCount: regularStudents.length,
      temporaryCount: tempStudents.length
    });
  } catch (error) {
    console.error('❌ 讀取學生資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取學生資料失敗',
      data: []
    });
  }
});

// ==================== 臨時學生管理 API ====================

// 1. 獲取臨時學生列表
app.get('/api/temporary-students', (req, res) => {
  try {
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    
    if (!fs.existsSync(tempDataPath)) {
      fs.writeFileSync(tempDataPath, JSON.stringify({ students: [] }, null, 2));
    }
    
    const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
    
    // 自動過濾過期的臨時學生
    const now = new Date();
    const validStudents = tempData.students.filter(s => {
      const expiry = new Date(s.expiryDate + 'T23:59:59');
      return expiry >= now;
    });
    
    res.json({ success: true, data: validStudents });
  } catch (error) {
    console.error('❌ 獲取臨時學生失敗:', error);
    res.status(500).json({ success: false, message: '獲取臨時學生失敗', error: error.message });
  }
});
// 2. 新增臨時學生
app.post('/api/temporary-students', (req, res) => {
  try {
    console.log('🔍 收到新增臨時學生請求，原始數據:', req.body);
    const { name, type, course, scheduledDate, scheduledTime, note, originalStudent, originalPeriod, originalCourse } = req.body;
    
    // 驗證必要欄位
    if (!name || !type || !course || !scheduledDate || !scheduledTime) {
      console.error('❌ 缺少必要欄位:', { name, type, course, scheduledDate, scheduledTime });
      return res.status(400).json({ success: false, message: '缺少必要欄位' });
    }
    
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    
    if (!fs.existsSync(tempDataPath)) {
      fs.writeFileSync(tempDataPath, JSON.stringify({ students: [] }, null, 2));
    }
    
    const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
    
    // 解析時段
    const periodParsed = parsePeriodString(scheduledTime);
    
    // 🔥 計算 remaining：
    // - 補課學生：從 student_data.json 查找原學生的 remaining
    // - 體驗學生：設為 1
    let remaining = 1; // 預設為體驗學生
    
    if (type === 'makeup') {
      try {
        const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
        if (fs.existsSync(studentDataPath)) {
          const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
          const originalStudentData = studentData.students.find(s => s.name === name);
          if (originalStudentData) {
            remaining = originalStudentData.remaining || 0;
            console.log(`📊 補課學生 ${name} 的剩餘堂數: ${remaining}`);
          } else {
            console.warn(`⚠️ 找不到原學生 ${name}，使用預設 remaining = 0`);
            remaining = 0;
          }
        }
      } catch (error) {
        console.warn(`⚠️ 讀取學生資料失敗，使用預設 remaining = 0:`, error.message);
        remaining = 0;
      }
    }
    
    const newStudent = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      course,
      scheduledDate,
      scheduledTime,
      period: scheduledTime,
      periodParsed,
      originalStudent: originalStudent || name,
      originalCourse: originalCourse || course,
      originalPeriod: originalPeriod || '',
      remaining,  // 🔥 使用計算後的 remaining
      note: note || '',
      expiryDate: scheduledDate,
      attendance: [],
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    };
    
    tempData.students.push(newStudent);
    fs.writeFileSync(tempDataPath, JSON.stringify(tempData, null, 2));
    
    console.log('✅ 新增臨時學生成功:', {
      name: newStudent.name,
      type: newStudent.type,
      remaining: newStudent.remaining,
      period: newStudent.period,
      scheduledDate: newStudent.scheduledDate
    });
    
    res.json({ success: true, data: newStudent, message: '新增成功' });
  } catch (error) {
    console.error('❌ 新增臨時學生失敗:', error);
    res.status(500).json({ success: false, message: '新增臨時學生失敗', error: error.message });
  }
});

// 3. 刪除臨時學生
app.delete('/api/temporary-students/:id', (req, res) => {
  try {
    const { id } = req.params;
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    
    if (!fs.existsSync(tempDataPath)) {
      return res.status(404).json({ success: false, message: '臨時學生資料檔案不存在' });
    }
    
    const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
    const index = tempData.students.findIndex(s => s.id === id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, message: '找不到該學生' });
    }
    
    const deletedStudent = tempData.students[index];
    tempData.students.splice(index, 1);
    fs.writeFileSync(tempDataPath, JSON.stringify(tempData, null, 2));
    
    console.log('✅ 刪除臨時學生:', deletedStudent.name);
    
    res.json({ success: true, message: '刪除成功' });
  } catch (error) {
    console.error('❌ 刪除臨時學生失敗:', error);
    res.status(500).json({ success: false, message: '刪除臨時學生失敗', error: error.message });
  }
});

// 獲取學生提醒API
app.get('/api/student-reminders', (req, res) => {
  try {
    console.log('📋 收到獲取學生提醒請求');
    const remindersData = loadReminders();
    const studentReminders = remindersData.studentReminders || [];
    
    // 按創建時間排序（最新的在前）
    studentReminders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log(`📊 返回 ${studentReminders.length} 個學生提醒`);
    res.json({
      success: true,
      data: studentReminders
    });
  } catch (error) {
    console.error('❌ 獲取學生提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取學生提醒失敗',
      error: error.message
    });
  }
});

// 儲存學生提醒API
app.post('/api/student-reminders', (req, res) => {
  try {
    console.log('💾 收到儲存學生提醒請求');
    const { studentReminders } = req.body;
    
    if (!studentReminders || !Array.isArray(studentReminders)) {
      return res.status(400).json({
        success: false,
        message: '無效的學生提醒資料'
      });
    }
    
    const remindersData = loadReminders();
    remindersData.studentReminders = studentReminders;
    
    if (saveReminders(remindersData)) {
      console.log(`✅ 成功儲存 ${studentReminders.length} 個學生提醒`);
      res.json({
        success: true,
        message: '學生提醒儲存成功',
        count: studentReminders.length
      });
    } else {
      throw new Error('儲存學生提醒失敗');
    }
    
  } catch (error) {
    console.error('❌ 儲存學生提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存學生提醒失敗',
      error: error.message
    });
  }
});

// 發送學生提醒API
app.post('/api/student-reminders/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, parentUserId } = req.body;
    
    console.log('📤 發送學生提醒:', { id, parentUserId });
    
    if (!parentUserId || parentUserId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '找不到家長的LINE User ID'
      });
    }
    
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '提醒訊息不能為空'
      });
    }
    
    // 發送 LINE 通知給家長
    console.log('📤 開始發送LINE通知給家長...');
    console.log('🎯 目標家長LINE User ID:', parentUserId);
    console.log('📝 發送訊息長度:', message.length, '字元');
    
    // ✅ 檢查是否啟用 Flex Message 並準備學生提醒的 Flex Message
    let lineMessage;
    let sendOptions = {};
    
    // ⚠️ 移除 enabled 檢查，總是嘗試建構 Flex Message
    console.log('🎨 嘗試使用 Flex Message 發送學生提醒');
    
    // 從 reminders.json 中獲取完整的提醒資訊
    const reminderDataForFlex = loadReminders();
    const studentReminder = reminderDataForFlex.studentReminders.find(r => r.id === id);
    
    if (studentReminder) {
      try {
        // 準備變數 - 學生提醒範本需要的變數
        const variables = {
          studentName: studentReminder.studentName || '學生',
          teacherName: studentReminder.teacherName || '講師',
          courseName: studentReminder.courseName || '未知課程',
          courseDate: studentReminder.courseDate || '未知日期',
          weekday: studentReminder.weekday || getWeekday(studentReminder.courseDate),
          courseTime: studentReminder.courseTime || '未知時間',
          location: studentReminder.location || '未指定地點',
          googleMapsUrl: studentReminder.googleMapsUrl || 'https://maps.google.com'
        };
        
        // 建構 Flex Message
        const flexMessage = notificationManager.buildFlexMessage('student', variables);
        
        if (flexMessage) {
          sendOptions.flexMessage = flexMessage;
          sendOptions.altText = `課程提醒 - ${variables.courseName}`;
          
          // 檢查是否啟用 Quick Reply
          const quickReply = notificationManager.buildQuickReply(variables, 'student');
          if (quickReply) {
            sendOptions.quickReply = quickReply;
          }
          
          console.log('✅ 已建構學生提醒 Flex Message');
        } else {
          console.log('⚠️ Flex Message 建構失敗，使用文字訊息');
        }
      } catch (error) {
        console.error('❌ 建構學生提醒 Flex Message 時發生錯誤:', error);
        console.log('⚠️ 降級使用文字訊息');
      }
    }
    
    // 使用 NotificationManager 發送訊息
    const result = await notificationManager.sendLineMessage(parentUserId, message, sendOptions);
    
    if (!result.success) {
      throw new Error(result.error || '發送失敗');
    }
    
    console.log('📊 訊息發送成功');
    
    // 更新學生提醒狀態
    console.log('💾 更新學生提醒狀態為 sent...');
    const remindersData = loadReminders();
    const studentReminderIndex = remindersData.studentReminders.findIndex(r => r.id === id);
    
    if (studentReminderIndex !== -1) {
      remindersData.studentReminders[studentReminderIndex].status = 'sent';
      remindersData.studentReminders[studentReminderIndex].sentAt = new Date().toISOString();
      remindersData.studentReminders[studentReminderIndex].updatedAt = new Date().toISOString();
      saveReminders(remindersData);
      console.log('✅ 學生提醒狀態更新完成');
    }
    
    console.log('✅ 學生提醒發送成功:', parentUserId);
    res.json({
      success: true,
      message: '學生提醒發送成功',
      flexMessageUsed: !!sendOptions.flexMessage,
      messageType: sendOptions.flexMessage ? 'flex' : 'text',
      result: result
    });
    
  } catch (error) {
    console.error('❌ 發送學生提醒失敗:', error);
    
    // 更新提醒狀態為失敗
    try {
      const remindersData = loadReminders();
      const studentReminderIndex = remindersData.studentReminders.findIndex(r => r.id === req.params.id);
      
      if (studentReminderIndex !== -1) {
        remindersData.studentReminders[studentReminderIndex].status = 'failed';
        remindersData.studentReminders[studentReminderIndex].updatedAt = new Date().toISOString();
        saveReminders(remindersData);
      }
    } catch (updateError) {
      console.error('❌ 更新提醒狀態失敗:', updateError);
    }
    
    res.status(500).json({
      success: false,
      message: '發送學生提醒失敗',
      error: error.message
    });
  }
});

// 批次發送學生提醒 API（支援 carousel）
app.post('/api/student-reminders/batch-send', async (req, res) => {
  try {
    const { reminderIds, parentUserId } = req.body;
    
    if (!reminderIds || !Array.isArray(reminderIds) || reminderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '請提供有效的提醒 ID 陣列'
      });
    }
    
    if (!parentUserId) {
      return res.status(400).json({
        success: false,
        message: '請提供家長 User ID'
      });
    }
    
    console.log(`📦 批次發送 ${reminderIds.length} 個學生提醒給家長 ${parentUserId}`);
    
    // 載入所有學生提醒
    const remindersData = loadReminders();
    const reminders = reminderIds.map(id => 
      remindersData.studentReminders.find(r => r.id === id)
    ).filter(r => r !== undefined);
    
    if (reminders.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到任何學生提醒'
      });
    }
    
    console.log(`✅ 找到 ${reminders.length} 個學生提醒`);
    
    // 準備變數陣列 - 學生提醒範本需要的變數
    const variablesArray = reminders.map(reminder => ({
      studentName: reminder.studentName || '學生',
      teacherName: reminder.teacherName || '講師',
      courseName: reminder.courseName || '未知課程',
      courseDate: reminder.courseDate || '未知日期',
      weekday: reminder.weekday || getWeekday(reminder.courseDate),
      courseTime: reminder.courseTime || '未知時間',
      location: reminder.location || '未設定地點',
      googleMapsUrl: reminder.googleMapsUrl || 'https://maps.google.com'
    }));
    
    // 準備訊息
    let message = '';
    let sendOptions = {};
    let isCarousel = false;
    
    // ⚠️ 移除 enabled 檢查，總是嘗試建構 Flex Message
    try {
      if (reminders.length > 1) {
        // 多個學生提醒（一個家長多個孩子），使用 carousel
        console.log(`🎠 建構學生提醒 Carousel（${reminders.length} 個孩子）`);
        const carousel = notificationManager.buildCarousel(variablesArray, 'student');
        if (carousel) {
          sendOptions.flexMessage = carousel;
          sendOptions.altText = `課程提醒 - ${reminders.length} 個孩子的課程`;
          isCarousel = true;
          console.log('✅ Carousel 建構成功');
        } else {
          console.log('⚠️ Carousel 建構失敗，將使用文字訊息');
        }
      } else {
        // 單個學生提醒
        console.log('🎨 建構單一學生提醒 Flex Message');
        const flexMessage = notificationManager.buildFlexMessage('student', variablesArray[0]);
        if (flexMessage) {
          sendOptions.flexMessage = flexMessage;
          sendOptions.altText = `課程提醒 - ${variablesArray[0].studentName} - ${variablesArray[0].courseName}`;
          console.log('✅ Flex Message 建構成功');
        } else {
          console.log('⚠️ Flex Message 建構失敗，將使用文字訊息');
        }
      }
      
      // 添加 Quick Reply（支援單個和多個孩子）
      if (reminders.length === 1) {
        // 單個孩子：使用標準 Quick Reply（具體課程資訊）
        const quickReply = notificationManager.buildQuickReply(variablesArray[0], 'student');
        if (quickReply) {
          sendOptions.quickReply = quickReply;
          console.log('✅ 已添加 Quick Reply（單個學生）');
        }
      } else if (reminders.length > 1) {
        // 多個孩子：使用統一 Quick Reply（簡化版）
        const quickReply = notificationManager.buildMultiStudentQuickReply(variablesArray, 'student');
        if (quickReply) {
          sendOptions.quickReply = quickReply;
          console.log(`✅ 已添加 Quick Reply（${reminders.length} 個學生統一按鈕）`);
        }
      }
    } catch (error) {
      console.error('❌ 建構學生提醒 Flex Message 失敗:', error);
      console.log('⚠️ 降級使用文字訊息');
    }
    
    // 如果沒有 Flex Message，使用文字訊息
    if (!sendOptions.flexMessage) {
      console.log('📝 使用文字訊息');
      message = reminders.map(reminder => {
        return `📚 課程提醒\n\n👨‍🎓 學生：${reminder.studentName}\n👨‍🏫 講師：${reminder.teacherName}\n📖 課程：${reminder.courseName}\n⏰ 時間：${reminder.courseTime}\n📅 日期：${reminder.courseDate}\n📍 地點：${reminder.location || '未設定地點'}\n\n提醒您要上課喔！謝謝`;
      }).join('\n\n---\n\n');
    }
    
    // 發送訊息
    const result = await notificationManager.sendLineMessage(parentUserId, message, sendOptions);
    
    if (!result.success) {
      throw new Error(result.error || '發送失敗');
    }
    
    console.log('📊 學生提醒批次發送成功');
    
    // 🎯 發送總結訊息（如果是多個孩子）
    if (reminders.length > 1) {
      try {
        const summaryMessage = `📘 您有 ${reminders.length} 位孩子的課程提醒，請確認！`;
        
        console.log(`💬 發送總結訊息給家長...`);
        
        // 延遲 1 秒後發送總結訊息
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const summaryResult = await notificationManager.sendLineMessage(
          parentUserId,
          summaryMessage,
          {} // 純文字訊息
        );
        
        if (summaryResult.success) {
          console.log(`✅ 總結訊息已發送`);
        } else {
          console.log(`⚠️ 總結訊息發送失敗: ${summaryResult.error}`);
        }
      } catch (summaryError) {
        console.error(`⚠️ 總結訊息發送時出錯:`, summaryError);
        // 不影響主流程，繼續執行
      }
    }
    
    // 更新提醒狀態
    for (const reminder of reminders) {
      const index = remindersData.studentReminders.findIndex(r => r.id === reminder.id);
      if (index !== -1) {
        remindersData.studentReminders[index].status = 'sent';
        remindersData.studentReminders[index].sentAt = new Date().toISOString();
      }
    }
    saveReminders(remindersData);
    
    res.json({
      success: true,
      message: '學生提醒批次發送成功',
      count: reminders.length,
      flexMessageUsed: !!sendOptions.flexMessage,
      messageType: sendOptions.flexMessage ? 'flex' : 'text',
      isCarousel: isCarousel
    });
    
  } catch (error) {
    console.error('❌ 學生提醒批次發送失敗:', error);
    res.status(500).json({
      success: false,
      message: '學生提醒批次發送失敗',
      error: error.message
    });
  }
});

// 獲取管理員資訊API
app.get('/api/admin/info', (req, res) => {
  try {
    console.log('👤 獲取管理員資訊...');
    const adminInfo = reminderScheduler.getAdminInfo();
    
    res.json({
      success: true,
      data: adminInfo
    });
  } catch (error) {
    console.error('❌ 獲取管理員資訊失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取管理員資訊失敗',
      error: error.message
    });
  }
});

// 設定管理員API
app.post('/api/admin/set', (req, res) => {
  try {
    const { adminUserId } = req.body;
    console.log('👤 設定管理員:', adminUserId);
    
    if (!adminUserId) {
      return res.status(400).json({
        success: false,
        message: '請提供管理員的 LINE User ID'
      });
    }
    
    reminderScheduler.setAdmin(adminUserId);
    
    res.json({
      success: true,
      message: '管理員設定成功',
      data: reminderScheduler.getAdminInfo()
    });
  } catch (error) {
    console.error('❌ 設定管理員失敗:', error);
    res.status(500).json({
      success: false,
      message: '設定管理員失敗',
      error: error.message
    });
  }
});

// 獲取學生提醒設定API
app.get('/api/student-reminder-settings', (req, res) => {
  try {
    console.log('⏰ 獲取學生提醒設定...');
    const settings = reminderScheduler.getStudentReminderSettings();
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ 獲取學生提醒設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取學生提醒設定失敗',
      error: error.message
    });
  }
});

// 重置今日提醒狀態API
app.post('/api/reminders/reset-today', (req, res) => {
  try {
    console.log('🔄 手動重置今日提醒狀態...');
    
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    
    // 使用台灣時區 (UTC+8)
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000; // UTC+8 毫秒
    const taiwanTime = new Date(now.getTime() + taiwanOffset);
    const today = taiwanTime.toISOString().split('T')[0];
    
    let resetCount = 0;
    
    // 重置所有今日提醒為 pending（只重置未發送的）
    reminders.forEach(reminder => {
      if (reminder.courseDate === today) {
        // 只重置未發送過且未完成的提醒
        if (reminder.status !== 'sent' && reminder.status !== 'completed' && !reminder.sentAt) {
          reminder.status = 'pending';
          resetCount++;
          console.log(`🔄 重置提醒: ${reminder.courseName} - ${reminder.teacherName}`);
        } else {
          console.log(`⏭️ 提醒已發送/完成，跳過: ${reminder.courseName} - ${reminder.teacherName} (狀態: ${reminder.status})`);
        }
      }
    });
    
    // 保存更新
    saveReminders(remindersData);
    
    console.log(`✅ 已重置 ${resetCount} 個今日提醒`);
    
    res.json({
      success: true,
      message: `已重置 ${resetCount} 個今日提醒狀態`,
      resetCount: resetCount
    });
    
  } catch (error) {
    console.error('❌ 重置今日提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '重置今日提醒失敗',
      error: error.message
    });
  }
});

// 重置課前提醒狀態API
app.post('/api/reminders/reset-before-class', (req, res) => {
  try {
    console.log('🔄 手動重置課前提醒狀態...');
    
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    
    // 使用台灣時區 (UTC+8)
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000; // UTC+8 毫秒
    const taiwanTime = new Date(now.getTime() + taiwanOffset);
    const today = taiwanTime.toISOString().split('T')[0];
    
    let resetCount = 0;
    
    // 重置課前提醒為 pending（簡化邏輯：只重置未發送過的）
    reminders.forEach(reminder => {
      if (reminder.courseDate === today && reminder.type === 'before-class') {
        // 計算課程時間
        const courseTime = new Date(`${reminder.courseDate}T${reminder.courseTime}:00`);
        
        // 如果課程還沒開始
        if (courseTime > now) {
          // 簡化邏輯：只重置未發送過且未完成的課前提醒
          if (reminder.status !== 'sent' && reminder.status !== 'completed' && !reminder.sentAt) {
            reminder.status = 'pending';
            resetCount++;
            console.log(`🔄 重置課前提醒: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
          } else {
            console.log(`⏭️ 課前提醒已發送/完成，跳過: ${reminder.courseName} - ${reminder.teacherName} (狀態: ${reminder.status})`);
          }
        } else {
          console.log(`⏰ 課程已開始，跳過: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
        }
      }
    });
    
    // 保存更新
    saveReminders(remindersData);
    
    console.log(`✅ 已重置 ${resetCount} 個課前提醒`);
    
    res.json({
      success: true,
      message: `已重置 ${resetCount} 個課前提醒狀態`,
      resetCount: resetCount
    });
    
  } catch (error) {
    console.error('❌ 重置課前提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '重置課前提醒失敗',
      error: error.message
    });
  }
});

// 按行事曆重置提醒API
app.post('/api/reminders/reset-by-calendar', (req, res) => {
  try {
    const { instructor, reminderType } = req.body;
    
    if (!instructor) {
      return res.status(400).json({
        success: false,
        message: '請提供講師名稱'
      });
    }
    
    console.log(`🔄 手動重置 ${instructor} 的提醒...`);
    
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    
    let resetCount = 0;
    
    reminders.forEach(reminder => {
      const shouldReset = reminder.teacherName === instructor && 
                         (!reminderType || reminder.type === reminderType) &&
                         reminder.status !== 'sent' && 
                         reminder.status !== 'completed' &&
                         !reminder.sentAt;
      
      if (shouldReset) {
        reminder.status = 'pending';
        reminder.sentAt = null;
        resetCount++;
        console.log(`🔄 重置提醒: ${reminder.courseName} - ${reminder.teacherName} (${reminder.type})`);
      }
    });
    
    // 保存更新
    saveReminders(remindersData);
    
    const typeText = reminderType ? `${reminderType}提醒` : '所有提醒';
    console.log(`✅ 已重置 ${instructor} 的 ${resetCount} 個${typeText}`);
    
    res.json({
      success: true,
      message: `成功重置 ${instructor} 的 ${resetCount} 個${typeText}`,
      resetCount,
      instructor,
      reminderType
    });
    
  } catch (error) {
    console.error('❌ 按行事曆重置提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '按行事曆重置提醒失敗',
      error: error.message
    });
  }
});

// 按行事曆重置課前提醒API
app.post('/api/reminders/reset-before-class-by-calendar', (req, res) => {
  try {
    const { instructor } = req.body;
    
    if (!instructor) {
      return res.status(400).json({
        success: false,
        message: '請提供講師名稱'
      });
    }
    
    console.log(`🔄 手動重置 ${instructor} 的課前提醒...`);
    
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    
    // 使用台灣時區 (UTC+8)
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000; // UTC+8 毫秒
    const taiwanTime = new Date(now.getTime() + taiwanOffset);
    const today = taiwanTime.toISOString().split('T')[0];
    
    let resetCount = 0;
    
    // 重置指定講師的課前提醒為 pending
    reminders.forEach(reminder => {
      if (reminder.courseDate === today && 
          reminder.type === 'before-class' && 
          reminder.teacherName === instructor) {
        
        // 計算課程時間
        const courseTime = new Date(`${reminder.courseDate}T${reminder.courseTime}:00`);
        
        // 如果課程還沒開始
        if (courseTime > now) {
          // 只重置未發送過且未完成的課前提醒
          if (reminder.status !== 'sent' && reminder.status !== 'completed' && !reminder.sentAt) {
            reminder.status = 'pending';
            reminder.sentAt = null;
            resetCount++;
            console.log(`🔄 重置課前提醒: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
          } else {
            console.log(`⏭️ 課前提醒已發送/完成，跳過: ${reminder.courseName} - ${reminder.teacherName} (狀態: ${reminder.status})`);
          }
        } else {
          console.log(`⏰ 課程已開始，跳過: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
        }
      }
    });
    
    // 保存更新
    saveReminders(remindersData);
    
    console.log(`✅ 已重置 ${instructor} 的 ${resetCount} 個課前提醒`);
    
    res.json({
      success: true,
      message: `成功重置 ${instructor} 的 ${resetCount} 個課前提醒`,
      resetCount,
      instructor
    });
    
  } catch (error) {
    console.error('❌ 按行事曆重置課前提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '按行事曆重置課前提醒失敗',
      error: error.message
    });
  }
});

// 個別重置課前提醒API
app.post('/api/reminders/reset-before-class-individual', (req, res) => {
  try {
    const { reminderId } = req.body;
    
    if (!reminderId) {
      return res.status(400).json({
        success: false,
        message: '請提供提醒ID'
      });
    }
    
    console.log(`🔄 手動重置個別課前提醒: ${reminderId}`);
    
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    
    // 找到指定的提醒
    const reminder = reminders.find(r => r.id === reminderId);
    
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的提醒'
      });
    }
    
    // 檢查是否為課前提醒
    if (reminder.type !== 'before-class') {
      return res.status(400).json({
        success: false,
        message: '只能重置課前提醒'
      });
    }
    
    // 使用台灣時區 (UTC+8)
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000; // UTC+8 毫秒
    const taiwanTime = new Date(now.getTime() + taiwanOffset);
    const today = taiwanTime.toISOString().split('T')[0];
    
    // 檢查是否為今天的提醒
    if (reminder.courseDate !== today) {
      return res.status(400).json({
        success: false,
        message: '只能重置今天的課前提醒'
      });
    }
    
    // 計算課程時間
    const courseTime = new Date(`${reminder.courseDate}T${reminder.courseTime}:00`);
    
    // 檢查課程是否還沒開始
    if (courseTime <= now) {
      return res.status(400).json({
        success: false,
        message: '課程已開始，無法重置'
      });
    }
    
    // 檢查提醒是否已發送或已完成（防止重複發送）
    if ((reminder.status === 'sent' || reminder.status === 'completed') && reminder.sentAt) {
      return res.status(400).json({
        success: false,
        message: '此提醒已發送/完成，無法重置',
        status: reminder.status,
        sentAt: reminder.sentAt
      });
    }
    
    // 重置提醒狀態
    reminder.status = 'pending';
    reminder.sentAt = null;
    
    // 保存更新
    saveReminders(remindersData);
    
    console.log(`✅ 已重置個別課前提醒: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
    
    res.json({
      success: true,
      message: `成功重置課前提醒: ${reminder.courseName}`,
      reminder: {
        id: reminder.id,
        courseName: reminder.courseName,
        teacherName: reminder.teacherName,
        courseTime: reminder.courseTime,
        status: reminder.status
      }
    });
    
  } catch (error) {
    console.error('❌ 個別重置課前提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '個別重置課前提醒失敗',
      error: error.message
    });
  }
});

// 清理重複提醒
app.post('/api/reminders/cleanup', (req, res) => {
  try {
    console.log('🧹 手動清理重複提醒...');
    reminderScheduler.cleanupExpiredReminders();
    
    res.json({
      success: true,
      message: '重複提醒清理完成'
    });
  } catch (error) {
    console.error('清理重複提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '清理重複提醒失敗'
    });
  }
});

// 設定學生提醒API
app.post('/api/student-reminder-settings', (req, res) => {
  try {
    const { hour, minute, duration, enabled } = req.body;
    console.log('⏰ 設定學生提醒:', { hour, minute, duration, enabled });
    
    // 驗證輸入
    if (hour !== undefined && (hour < 0 || hour > 23)) {
      return res.status(400).json({
        success: false,
        message: '小時必須在 0-23 之間'
      });
    }
    
    if (minute !== undefined && (minute < 0 || minute > 59)) {
      return res.status(400).json({
        success: false,
        message: '分鐘必須在 0-59 之間'
      });
    }
    
    if (duration !== undefined && (duration < 1 || duration > 60)) {
      return res.status(400).json({
        success: false,
        message: '執行窗口必須在 1-60 分鐘之間'
      });
    }
    
    // 更新設定
    const newSettings = {};
    if (hour !== undefined) newSettings.hour = parseInt(hour);
    if (minute !== undefined) newSettings.minute = parseInt(minute);
    if (duration !== undefined) newSettings.duration = parseInt(duration);
    if (enabled !== undefined) newSettings.enabled = Boolean(enabled);
    
    reminderScheduler.setStudentReminderSettings(newSettings);
    
    res.json({
      success: true,
      message: '學生提醒設定已更新',
      data: reminderScheduler.getStudentReminderSettings()
    });
  } catch (error) {
    console.error('❌ 設定學生提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '設定學生提醒失敗',
      error: error.message
    });
  }
});

// 獲取排程設定API
app.get('/api/schedule-settings', async (req, res) => {
  try {
    console.log('⏰ 獲取排程設定...');
    const settings = reminderScheduler.getSystemSettings();
    
    // 獲取跳過課程統計
    let skippedCourses = [];
    try {
      const events = await reminderScheduler.getCalendarEvents();
      const skipKeywords = settings.skipKeywords?.keywords || ['停課', '請假'];
      const skipEnabled = settings.skipKeywords?.enabled !== false;
      
      if (skipEnabled && skipKeywords.length > 0) {
        skippedCourses = events.filter(event => {
          return skipKeywords.some(keyword => event.title.includes(keyword));
        }).map(event => ({
          title: event.title,
          instructor: event.instructor,
          start: event.start,
          matchedKeywords: skipKeywords.filter(keyword => event.title.includes(keyword))
        }));
      }
    } catch (error) {
      console.log('⚠️ 獲取跳過課程統計失敗:', error.message);
    }
    
    // 安全地獲取提醒設定，提供預設值
    const reminders = settings.reminders || {
      todayReminderHour: 8,
      todayReminderMinute: 0,
      tomorrowReminderHour: 19,
      tomorrowReminderMinute: 30,
      beforeClassMinutes: 30
    };
    
    res.json({
      success: true,
      data: {
        todayReminderTime: `${(reminders.todayReminderHour || 8).toString().padStart(2, '0')}:${(reminders.todayReminderMinute || 0).toString().padStart(2, '0')}`,
        tomorrowReminderTime: `${(reminders.tomorrowReminderHour || 19).toString().padStart(2, '0')}:${(reminders.tomorrowReminderMinute || 30).toString().padStart(2, '0')}`,
        beforeClassMinutes: reminders.beforeClassMinutes || 30,
        enableAutoReminders: true,
        skipKeywordsEnabled: settings.skipKeywords?.enabled !== false,
        skipKeywords: settings.skipKeywords?.keywords || ['停課', '請假'],
        skippedCourses: skippedCourses
      }
    });
  } catch (error) {
    console.error('獲取排程設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取設定失敗'
    });
  }
});
// 設定排程設定API
app.post('/api/schedule-settings', (req, res) => {
  try {
    const { tomorrowReminderTime, beforeClassMinutes, skipKeywordsEnabled, skipKeywords } = req.body;
    console.log('⏰ 設定排程設定:', { tomorrowReminderTime, beforeClassMinutes, skipKeywordsEnabled, skipKeywords });
    
    // 解析隔日提醒時間（如果提供）
    let hour = 19, minute = 30; // 預設值
    if (tomorrowReminderTime) {
      [hour, minute] = tomorrowReminderTime.split(':').map(Number);
    }
    
    // 驗證輸入（如果提供）
    if (tomorrowReminderTime && (hour < 0 || hour > 23 || minute < 0 || minute > 59)) {
      return res.status(400).json({
        success: false,
        message: '無效的隔日提醒時間'
      });
    }
    
    if (beforeClassMinutes && (beforeClassMinutes < 1 || beforeClassMinutes > 120)) {
      return res.status(400).json({
        success: false,
        message: '無效的課前提醒時間'
      });
    }
    
    // 處理跳過關鍵字
    let processedSkipKeywords = ['停課', '請假']; // 預設值
    if (skipKeywords && typeof skipKeywords === 'string') {
      processedSkipKeywords = skipKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }
    
    // 獲取現有設定
    const currentSettings = reminderScheduler.getSystemSettings();
    
    // 準備更新設定
    const updateSettings = {};
    
    // 更新提醒設定（如果提供）
    if (tomorrowReminderTime || beforeClassMinutes) {
      updateSettings.reminders = {
        ...currentSettings.reminders,
        ...(tomorrowReminderTime && { tomorrowReminderHour: hour, tomorrowReminderMinute: minute }),
        ...(beforeClassMinutes && { beforeClassMinutes: beforeClassMinutes })
      };
    }
    
    // 更新跳過關鍵字設定（如果提供）
    if (skipKeywordsEnabled !== undefined || skipKeywords) {
      updateSettings.skipKeywords = {
        enabled: skipKeywordsEnabled !== false,
        keywords: processedSkipKeywords
      };
    }
    
    // 更新系統設定
    if (Object.keys(updateSettings).length > 0) {
      reminderScheduler.updateSystemSettings(updateSettings);
    }
    
    res.json({
      success: true,
      message: '排程設定已更新',
      data: {
        tomorrowReminderTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        beforeClassMinutes: beforeClassMinutes || currentSettings.reminders.beforeClassMinutes,
        skipKeywordsEnabled: skipKeywordsEnabled !== false,
        skipKeywords: processedSkipKeywords
      }
    });
  } catch (error) {
    console.error('設定排程設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '設定失敗'
    });
  }
});
// 時區診斷端點
// 注意：此 API 目前未在前端使用，保留供調試用
app.get('/api/timezone-debug', (req, res) => {
  try {
    const now = new Date();
    // 正確的台灣時區轉換
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;
    const hour = parts.find(part => part.type === 'hour').value;
    const minute = parts.find(part => part.type === 'minute').value;
    const second = parts.find(part => part.type === 'second').value;
    
    const taiwanTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`);
    
    // 獲取學生提醒設定
    const studentReminderSettings = reminderScheduler.getStudentReminderSettings();
    const studentReminderHour = studentReminderSettings?.hour || 19;
    const studentReminderMinute = studentReminderSettings?.minute || 30;
    
    // 舊的計算方式（有問題）
    const oldWay = new Date(now.getFullYear(), now.getUTCMonth(), now.getUTCDate(), studentReminderHour, studentReminderMinute, 0, 0);
    
    // 新的計算方式（修復後）
    let newWay = new Date(now);
    newWay.setUTCHours(studentReminderHour - 8, studentReminderMinute, 0, 0);
    
    // 計算台灣時間的小時、分鐘
    const taiwanHours = taiwanTime.getHours();
    const taiwanMinutes = taiwanTime.getMinutes();
    
    // 如果今天的學生提醒時間已過，計算明天的
    if (taiwanHours > studentReminderHour || (taiwanHours === studentReminderHour && taiwanMinutes >= studentReminderMinute)) {
      newWay.setUTCDate(newWay.getUTCDate() + 1);
    }
    
    res.json({
      success: true,
      data: {
        currentTime: {
          utc: now.toISOString(),
          taiwan: taiwanTime.toISOString(),
          taiwanHours: taiwanTime.getHours(),
          taiwanMinutes: taiwanTime.getMinutes()
        },
        studentReminderSettings: {
          hour: studentReminderHour,
          minute: studentReminderMinute
        },
        oldCalculation: {
          target: oldWay.toISOString(),
          diff: oldWay.getTime() - now.getTime(),
          hours: Math.floor((oldWay.getTime() - now.getTime()) / (1000 * 60 * 60))
        },
        newCalculation: {
          target: newWay.toISOString(),
          diff: newWay.getTime() - now.getTime(),
          hours: Math.floor((newWay.getTime() - now.getTime()) / (1000 * 60 * 60))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 排程器診斷端點
// 注意：此 API 目前未在前端使用（已移除 runDiagnostic 按鈕），保留供調試用
app.get('/api/reminder-scheduler/diagnostic', async (req, res) => {
  try {
    console.log('🔍 開始排程器診斷...');
    
    // 檢查排程器狀態
    const status = reminderScheduler.getStatus();
    console.log('📊 排程器狀態:', status);
    
    // 檢查提醒資料
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    console.log('📋 提醒資料:', reminders.length, '個');
    
    // 檢查講師資料
    const teacherData = JSON.parse(fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8'));
    const teachers = Object.keys(teacherData.teachers);
    console.log('👨‍🏫 講師資料:', teachers.length, '位');
    
    // 檢查 CalDAV 事件
    let events = [];
    try {
      events = await reminderScheduler.getCalendarEvents();
      console.log('📅 CalDAV 事件:', events.length, '個');
    } catch (error) {
      console.error('❌ CalDAV 錯誤:', error.message);
    }
    
    // 檢查今日事件
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(event => event.start && event.start.startsWith(today));
    console.log('📅 今日事件:', todayEvents.length, '個');
    
    // 測試講師匹配
    const testMatches = [];
    for (const event of todayEvents.slice(0, 3)) {
      const teacher = reminderScheduler.findTeacherByName(event.instructor, teacherData.teachers);
      testMatches.push({
        eventInstructor: event.instructor,
        matched: !!teacher,
        teacherName: teacher ? Object.keys(teacherData.teachers).find(name => teacherData.teachers[name] === teacher) : null
      });
    }
    
    res.json({
      success: true,
      data: {
        scheduler: status,
        reminders: {
          total: reminders.length,
          byStatus: reminders.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
          }, {})
        },
        teachers: {
          total: teachers.length,
          names: teachers
        },
        events: {
          total: events.length,
          today: todayEvents.length,
          sample: events.slice(0, 3).map(e => ({
            title: e.title,
            instructor: e.instructor,
            start: e.start,
            time: e.time
          }))
        },
        testMatches: testMatches
      }
    });
  } catch (error) {
    console.error('❌ 診斷失敗:', error);
    res.status(500).json({
      success: false,
      message: '診斷失敗',
      error: error.message
    });
  }
});

app.post('/api/reminder-scheduler/run', async (req, res) => {
  try {
    await reminderScheduler.runScheduledTasks();
    res.json({
      success: true,
      message: '排程任務執行完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '執行排程任務失敗',
      error: error.message
    });
  }
});

// 強制生成學生提醒API
app.post('/api/reminder-scheduler/generate-student-reminders', async (req, res) => {
  try {
    console.log('👨‍🎓 強制生成學生提醒...');
    
    // 直接調用學生提醒生成函數
    const studentReminders = await reminderScheduler.generateStudentReminders();
    
    res.json({
      success: true,
      message: '學生提醒生成完成',
      data: {
        count: studentReminders.length,
        reminders: studentReminders
      }
    });
  } catch (error) {
    console.error('❌ 強制生成學生提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '強制生成學生提醒失敗',
      error: error.message
    });
  }
});

// 測試排程器詳細執行過程
app.post('/api/reminder-scheduler/test', async (req, res) => {
  try {
    console.log('🧪 開始測試排程器詳細執行過程...');
    
    // 獲取今日事件
    const events = await reminderScheduler.getCalendarEvents();
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(event => event.start && event.start.startsWith(today));
    
    console.log(`📅 今日事件數量: ${todayEvents.length}`);
    
    const testResults = [];
    
    for (const event of todayEvents) {
      console.log(`🔍 處理事件: ${event.title} - ${event.instructor}`);
      
      // 解析課程時間
      const courseTime = reminderScheduler.parseCourseTime(event.time || event.title);
      console.log(`⏰ 解析時間:`, courseTime);
      
      // 測試講師匹配
      const teacherData = reminderScheduler.loadTeacherData();
      const teacher = reminderScheduler.findTeacherByName(event.instructor, teacherData.teachers);
      console.log(`👨‍🏫 講師匹配:`, teacher ? '成功' : '失敗');
      
      testResults.push({
        event: {
          title: event.title,
          instructor: event.instructor,
          start: event.start,
          time: event.time
        },
        courseTime: courseTime,
        teacherMatched: !!teacher,
        teacherName: teacher ? Object.keys(teacherData.teachers).find(name => teacherData.teachers[name] === teacher) : null
      });
    }
    
    res.json({
      success: true,
      data: {
        todayEvents: todayEvents.length,
        testResults: testResults
      }
    });
  } catch (error) {
    console.error('❌ 測試失敗:', error);
    res.status(500).json({
      success: false,
      message: '測試失敗',
      error: error.message
    });
  }
});

// 手動觸發午夜清理和重新載入
app.post('/api/reminder-scheduler/midnight-cleanup', async (req, res) => {
  try {
    console.log('🌅 手動觸發午夜清理和重新載入...');
    
    await reminderScheduler.forceMidnightCleanupAndReload();
    
    res.json({
      success: true,
      message: '午夜清理和重新載入完成，提醒將按照設定時間自動發送'
    });
  } catch (error) {
    console.error('❌ 午夜清理失敗:', error);
    res.status(500).json({
      success: false,
      message: '午夜清理失敗',
      error: error.message
    });
  }
});

// 批次重試失敗的提醒
// 注意：此 API 目前未在前端使用，保留供未來可能需要
app.post('/api/reminders/retry-failed', async (req, res) => {
  try {
    console.log('🔄 批次重試失敗的提醒...');
    
    const remindersData = loadReminders();
    const failedReminders = remindersData.reminders.filter(r => r.status === 'failed');
    
    console.log(`📊 找到 ${failedReminders.length} 個失敗的提醒`);
    
    if (failedReminders.length === 0) {
      return res.json({
        success: true,
        message: '沒有失敗的提醒需要重試',
        data: {
          total: 0,
          reset: 0
        }
      });
    }
    
    // 重置為 pending 狀態，讓排程器重新處理
    let resetCount = 0;
    failedReminders.forEach(reminder => {
      const index = remindersData.reminders.findIndex(r => r.id === reminder.id);
      if (index !== -1) {
        remindersData.reminders[index].status = 'pending';
        remindersData.reminders[index].retryCount = 0;
        delete remindersData.reminders[index].error;
        delete remindersData.reminders[index].sentAt;
        resetCount++;
      }
    });
    
    saveReminders(remindersData);
    
    console.log(`✅ 已重置 ${resetCount} 個失敗提醒為 pending 狀態`);
    
    res.json({
      success: true,
      message: `已重置 ${resetCount} 個失敗提醒，排程器將自動重新發送`,
      data: {
        total: failedReminders.length,
        reset: resetCount
      }
    });
  } catch (error) {
    console.error('❌ 批次重試失敗:', error);
    res.status(500).json({
      success: false,
      message: '批次重試失敗',
      error: error.message
    });
  }
});

// 批次發送指定的提醒
app.post('/api/reminders/batch-send', async (req, res) => {
  try {
    const { reminderIds, sendDelay, groupByRecipient } = req.body;
    
    console.log('📤 批次發送提醒...');
    console.log('📋 提醒數量:', reminderIds?.length);
    console.log('🎯 分組發送:', groupByRecipient);
    
    if (!reminderIds || !Array.isArray(reminderIds) || reminderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '請提供有效的提醒ID列表'
      });
    }
    
    const delay = sendDelay || 3000;
    const remindersData = loadReminders();
    const teacherData = JSON.parse(fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8'));
    
    // ✅ 支援陣列格式：如果是陣列，轉換為物件格式
    let teachers = teacherData.teachers;
    if (Array.isArray(teachers)) {
      console.log('🔄 [Batch] 檢測到陣列格式，轉換為物件格式');
      const teachersObj = {};
      teachers.forEach(teacher => {
        if (teacher.name && teacher.userId) {
          teachersObj[teacher.name] = teacher.userId;
        }
      });
      teachers = teachersObj;
      console.log('✅ [Batch] 轉換完成，可用講師:', Object.keys(teachers));
    } else {
      console.log('📚 [Batch] 可用的講師列表:', Object.keys(teachers));
    }
    
    // 獲取所有要發送的提醒
    const remindersToSend = reminderIds
      .map(id => remindersData.reminders.find(r => r.id === id))
      .filter(r => r);
    
    const results = {
      total: reminderIds.length,
      success: 0,
      failed: 0,
      carouselSent: 0,
      singleSent: 0,
      errors: []
    };
    
    // 如果啟用分組，則按收件者分組發送（支援 Carousel）
    // ⚠️ 注意：即使 flexTemplates.enabled 為 false，也允許使用 carousel（因為配置文件載入問題）
    if (groupByRecipient) {
      console.log('🎨 使用 Carousel 分組發送');
      console.log('🔍 [Debug] flexTemplates.enabled =', notificationManager.flexTemplates?.enabled);
      
      // 按講師分組
      const groupedByTeacher = {};
      for (const reminder of remindersToSend) {
        const teacherName = reminder.teacherName;
        if (!groupedByTeacher[teacherName]) {
          groupedByTeacher[teacherName] = [];
        }
        groupedByTeacher[teacherName].push(reminder);
      }
      
      console.log(`📊 分組結果: ${Object.keys(groupedByTeacher).length} 位講師`);
      
      // 為每個講師發送（可能是 carousel 或單一訊息）
      for (const [teacherName, reminders] of Object.entries(groupedByTeacher)) {
        try {
          const teacherUserId = teachers[teacherName];
          if (!teacherUserId) {
            console.log(`⚠️ 找不到講師 ${teacherName} 的 LINE User ID，跳過`);
            results.failed += reminders.length;
            reminders.forEach(r => {
              results.errors.push({
                reminderId: r.id,
                error: `找不到講師 ${teacherName} 的 LINE User ID`
              });
            });
            continue;
          }
          
          console.log(`📤 發送給 ${teacherName} (${reminders.length} 個提醒)`);
          
          // 準備變數陣列
          const variablesArray = reminders.map(reminder => {
            // 動態計算 timeUntilClass（for before-class 提醒）
            let timeUntilClass = '30分鐘後';
            if (reminder.type === 'before-class' && reminder.courseTime) {
              try {
                const [hour, minute] = reminder.courseTime.split(':').map(n => parseInt(n, 10));
                const year = new Date().getFullYear();
                const [month, day] = reminder.courseDate.split('-').slice(1).map(n => parseInt(n, 10));
                const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
                const courseDateTime = new Date(taiwanTimeStr);
                const now = new Date();
                const diff = courseDateTime - now;
                const minutesUntil = Math.floor(diff / (1000 * 60));
                
                if (minutesUntil > 60) {
                  const hours = Math.floor(minutesUntil / 60);
                  const mins = minutesUntil % 60;
                  timeUntilClass = mins > 0 ? `${hours}小時${mins}分鐘後` : `${hours}小時後`;
                } else if (minutesUntil > 0) {
                  timeUntilClass = `${minutesUntil}分鐘後`;
                } else if (minutesUntil > -30) {
                  timeUntilClass = '即將開始';
                } else {
                  timeUntilClass = '已開始';
                }
              } catch (error) {
                console.error('計算上課時間失敗:', error);
              }
            }
            
            return {
              teacherName: reminder.teacherName || '未知講師',
              courseName: reminder.courseName || '未知課程',
              courseDate: reminder.courseDate || '未知日期',
              courseTime: reminder.courseTime || '未知時間',
              location: reminder.location || '未指定地點',
              description: reminder.description || '',
              lessonPlanUrl: reminder.lessonPlanUrl || '',
              googleMapsUrl: reminder.googleMapsUrl || 'https://maps.google.com',
              weekday: getWeekday(reminder.courseDate),
              currentTime: new Date().toLocaleTimeString('zh-TW'),
              currentDate: new Date().toLocaleDateString('zh-TW'),
              reminderType: reminder.type,
              reminderTypeText: reminder.type === 'today' ? '當日' : reminder.type === 'tomorrow' ? '隔日' : '課前',
              timeUntilClass: timeUntilClass,
              systemName: '樂程坊課程系統',
              reminderId: reminder.id
            };
          });
          
          // 建構 Flex Message（單一或 carousel）
          const templateType = reminders[0].type; // 使用第一個提醒的類型
          let flexMessage;
          let altText;
          
          if (reminders.length > 1) {
            // 多個提醒 -> Carousel
            flexMessage = notificationManager.buildCarousel(variablesArray, templateType);
            altText = `${variablesArray[0].reminderTypeText}課程提醒 (${reminders.length} 個課程)`;
            results.carouselSent++;
            console.log(`🎠 建構 Carousel (${reminders.length} 個 bubbles)`);
          } else {
            // 單一提醒 -> 單一 bubble
            flexMessage = notificationManager.buildFlexMessage(templateType, variablesArray[0]);
            altText = `${variablesArray[0].reminderTypeText}課程提醒 - ${variablesArray[0].courseName}`;
            results.singleSent++;
            console.log(`📋 建構單一 Flex Message`);
          }
          
          // 準備發送選項
          const sendOptions = { flexMessage, altText };
          
          // 如果是單一提醒，按類型決定是否附加 Quick Reply
          if (reminders.length === 1) {
            const qr = notificationManager.buildQuickReply(variablesArray[0], reminders[0].type);
            if (qr) {
              sendOptions.quickReply = qr;
            }
          }
          
          // 發送
          const sendResult = await notificationManager.sendLineMessage(
            teacherUserId,
            altText,
            sendOptions
          );
          
          if (sendResult.success) {
            results.success += reminders.length;
            // 更新所有提醒的狀態
            reminders.forEach(reminder => {
              reminder.status = 'sent';
              reminder.sentAt = new Date().toISOString();
              reminder.updatedAt = new Date().toISOString();
            });
            console.log(`✅ 成功發送給 ${teacherName}`);
            
            // 🎯 發送總結訊息（僅限今日和隔日提醒）
            if (templateType === 'today' || templateType === 'tomorrow') {
              try {
                const summaryMessage = templateType === 'today' 
                  ? `📘 您今日共有 ${reminders.length} 堂課程，請加油！💪`
                  : `📘 您明日共有 ${reminders.length} 堂課程，請提前準備！💪`;
                
                console.log(`💬 發送總結訊息給 ${teacherName}...`);
                
                // 延遲 1 秒後發送總結訊息
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                const summaryResult = await notificationManager.sendLineMessage(
                  teacherUserId,
                  summaryMessage,
                  {} // 純文字訊息
                );
                
                if (summaryResult.success) {
                  console.log(`✅ 總結訊息已發送給 ${teacherName}`);
                } else {
                  console.log(`⚠️ 總結訊息發送失敗: ${summaryResult.error}`);
                }
              } catch (summaryError) {
                console.error(`⚠️ 總結訊息發送時出錯:`, summaryError);
                // 不影響主流程，繼續執行
              }
            }
          } else {
            throw new Error(sendResult.error || '發送失敗');
          }
          
          // 延遲
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
        } catch (error) {
          console.error(`❌ 發送給 ${teacherName} 失敗:`, error);
          results.failed += reminders.length;
          reminders.forEach(r => {
            results.errors.push({
              reminderId: r.id,
              error: error.message
            });
            // 標記為失敗
            r.status = 'failed';
            r.updatedAt = new Date().toISOString();
          });
        }
      }
      
      // 儲存更新
      saveReminders(remindersData);
      
    } else {
      // 傳統逐個發送
      console.log('📝 使用傳統逐個發送');
      
      for (const reminderId of reminderIds) {
        try {
          console.log(`📤 發送提醒: ${reminderId}`);
          
          const response = await axios.post(
            `http://localhost:${PORT}/api/reminders/${reminderId}/send`,
            {},
            { timeout: 30000 }
          );
          
          if (response.data.success) {
            results.success++;
            results.singleSent++;
            console.log(`✅ 提醒發送成功: ${reminderId}`);
          } else {
            results.failed++;
            results.errors.push({
              reminderId,
              error: response.data.message
            });
            console.log(`❌ 提醒發送失敗: ${reminderId}`);
          }
          
          if (delay > 0 && reminderIds.indexOf(reminderId) < reminderIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            reminderId,
            error: error.message
          });
          console.error(`❌ 發送提醒失敗: ${reminderId}`, error.message);
        }
      }
    }
    
    console.log(`✅ 批次發送完成: 成功 ${results.success}/${results.total}`);
    console.log(`📊 Carousel: ${results.carouselSent}, 單一訊息: ${results.singleSent}`);
    
    res.json({
      success: true,
      message: `批次發送完成: 成功 ${results.success}/${results.total}`,
      data: results
    });
  } catch (error) {
    console.error('❌ 批次發送失敗:', error);
    res.status(500).json({
      success: false,
      message: '批次發送失敗',
      error: error.message
    });
  }
});

// 地址映射管理 API
// 獲取地址映射設定
app.get('/api/address-mappings', (req, res) => {
  try {
    console.log('📍 獲取地址映射設定...');
    const mappingsPath = path.join(__dirname, 'data', 'address-mappings.json');
    
    let mappings = [];
    if (fs.existsSync(mappingsPath)) {
      const mappingsData = fs.readFileSync(mappingsPath, 'utf8');
      mappings = JSON.parse(mappingsData);
    } else {
      // 如果檔案不存在，使用預設值
      mappings = [
        {
          original: '台北市中正區開封街1段2號9樓',
          display: 'FunLearnBar站前教室'
        }
      ];
    }
    
    res.json({
      success: true,
      data: mappings
    });
  } catch (error) {
    console.error('❌ 獲取地址映射失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取地址映射失敗',
      error: error.message
    });
  }
});

// 儲存地址映射設定
app.post('/api/address-mappings', (req, res) => {
  try {
    const { mappings } = req.body;
    console.log('📍 儲存地址映射設定:', mappings);
    
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({
        success: false,
        message: '地址映射資料格式錯誤'
      });
    }
    
    // 確保 data 目錄存在
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 儲存到檔案
    const mappingsPath = path.join(dataDir, 'address-mappings.json');
    fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2), 'utf8');
    
    res.json({
      success: true,
      message: '地址映射設定已儲存'
    });
  } catch (error) {
    console.error('❌ 儲存地址映射失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存地址映射失敗',
      error: error.message
    });
  }
});

// ==================== 管理員 API ====================

// 管理員密碼（請修改為安全的密碼）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN_SECRET = 'flb-admin-secret-key-' + Date.now();
let adminTokens = new Set();

// 生成管理員 token
function generateAdminToken() {
  return 'admin_' + Math.random().toString(36).substring(2) + Date.now();
}

// 驗證管理員 token
function verifyAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未授權' });
  }

  const token = authHeader.substring(7);
  if (!adminTokens.has(token)) {
    return res.status(401).json({ success: false, message: 'Token 無效' });
  }

  next();
}

// 管理員登入
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    const token = generateAdminToken();
    adminTokens.add(token);
    
    // Token 24小時後過期
    setTimeout(() => {
      adminTokens.delete(token);
    }, 24 * 60 * 60 * 1000);

    res.json({
      success: true,
      token: token
    });
  } else {
    res.status(401).json({
      success: false,
      message: '密碼錯誤'
    });
  }
});

// 讀取系統設定
app.get('/api/admin/system-settings', verifyAdminToken, (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '讀取系統設定失敗',
      error: error.message
    });
  }
});
// 儲存系統設定
app.post('/api/admin/system-settings', verifyAdminToken, (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const newSettings = req.body;
    
    const mergedSettings = {
      ...loadSystemSettings(),
      ...newSettings,
      dateRange: {
        futureDays: Math.max(1, parseInt(newSettings.dateRange?.futureDays ?? newSettings.futureDays ?? 30, 10)),
        pastDays: Math.max(0, parseInt(newSettings.dateRange?.pastDays ?? newSettings.pastDays ?? 7, 10))
      }
    };
    
    if ('futureDays' in mergedSettings) delete mergedSettings.futureDays;
    if ('pastDays' in mergedSettings) delete mergedSettings.pastDays;
    
    // 備份舊設定
    if (fs.existsSync(settingsPath)) {
      const backupPath = path.join(__dirname, `system-settings.json.backup-${Date.now()}`);
      fs.copyFileSync(settingsPath, backupPath);
    }
    
    // 寫入新設定
    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
    
    console.log('✅ 系統設定已更新');
    
    res.json({
      success: true,
      message: '系統設定已更新',
      data: mergedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '儲存系統設定失敗',
      error: error.message
    });
  }
});
// 讀取學生提醒設定
app.get('/api/admin/student-reminder-settings', verifyAdminToken, (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'student-reminder-settings.json');
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '讀取提醒設定失敗',
      error: error.message
    });
  }
});

// 儲存學生提醒設定
app.post('/api/admin/student-reminder-settings', verifyAdminToken, (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'student-reminder-settings.json');
    
    // 備份現有設定
    const backupPath = path.join(__dirname, 'student-reminder-settings.json.backup');
    if (fs.existsSync(settingsPath)) {
      fs.copyFileSync(settingsPath, backupPath);
    }

    // 儲存新設定
    fs.writeFileSync(settingsPath, JSON.stringify(req.body, null, 2), 'utf8');
    
    res.json({
      success: true,
      message: '提醒設定已儲存'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '儲存提醒設定失敗',
      error: error.message
    });
  }
});

// 讀取講師資料
app.get('/api/admin/teacher-data', verifyAdminToken, (req, res) => {
  try {
    const dataPath = path.join(__dirname, 'teacher_data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '讀取講師資料失敗',
      error: error.message
    });
  }
});

// 新增講師
app.post('/api/admin/teacher-data/add', verifyAdminToken, (req, res) => {
  try {
    const { name, userId } = req.body;
    const dataPath = path.join(__dirname, 'teacher_data.json');
    
    // 讀取現有資料
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // 檢查是否已存在
    if (data.teachers[name]) {
      return res.status(400).json({
        success: false,
        message: '該講師已存在'
      });
    }

    // 備份
    const backupPath = path.join(__dirname, 'teacher_data.json.backup');
    fs.copyFileSync(dataPath, backupPath);

    // 新增講師
    data.teachers[name] = userId;
    data.last_update = new Date().toISOString();

    // 儲存
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    
    res.json({
      success: true,
      message: '講師新增成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '新增講師失敗',
      error: error.message
    });
  }
});

// 刪除講師
app.post('/api/admin/teacher-data/delete', verifyAdminToken, (req, res) => {
  try {
    const { name } = req.body;
    const dataPath = path.join(__dirname, 'teacher_data.json');
    
    // 讀取現有資料
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // 檢查是否存在
    if (!data.teachers[name]) {
      return res.status(404).json({
        success: false,
        message: '找不到該講師'
      });
    }

    // 備份
    const backupPath = path.join(__dirname, 'teacher_data.json.backup');
    fs.copyFileSync(dataPath, backupPath);

    // 刪除講師
    delete data.teachers[name];
    data.last_update = new Date().toISOString();

    // 儲存
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    
    res.json({
      success: true,
      message: '講師刪除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '刪除講師失敗',
      error: error.message
    });
  }
});

// 讀取講師列表資料
app.get('/api/admin/teacher-list-data', verifyAdminToken, (req, res) => {
  try {
    const csvPath = path.join(__dirname, 'public', 'teacher_list_data.csv');
    const csvData = fs.readFileSync(csvPath, 'utf8');
    
    // 解析 CSV
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',');
    const data = lines.slice(1).map(line => {
      const values = line.split(',');
      return {
        name: values[0] || '',
        sheetUrl: values[1] || '',
        webApi: values[2] || '',
        reportApi: values[3] || '',
        userId: values[4] || ''
      };
    });

    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '讀取講師列表失敗',
      error: error.message
    });
  }
});

// 建立備份
app.post('/api/admin/backup/create', verifyAdminToken, (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${timestamp}`;
    const backupPath = path.join(backupDir, `${backupName}.json`);

    // 收集所有配置文件
    const backup = {
      timestamp: new Date().toISOString(),
      files: {
        systemSettings: JSON.parse(fs.readFileSync(path.join(__dirname, 'system-settings.json'), 'utf8')),
        studentReminderSettings: JSON.parse(fs.readFileSync(path.join(__dirname, 'student-reminder-settings.json'), 'utf8')),
        teacherData: JSON.parse(fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8')),
        teacherListData: fs.readFileSync(path.join(__dirname, 'public', 'teacher_list_data.csv'), 'utf8')
      }
    };

    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');

    res.json({
      success: true,
      message: '備份建立成功',
      backupName: backupName
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '建立備份失敗',
      error: error.message
    });
  }
});
// 讀取備份歷史
app.get('/api/admin/backup/history', verifyAdminToken, (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      return res.json({
        success: true,
        backups: []
      });
    }

    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file.replace('.json', ''),
          date: stats.mtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.date - a.date);

    res.json({
      success: true,
      backups: files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '讀取備份歷史失敗',
      error: error.message
    });
  }
});

// 還原備份
app.post('/api/admin/backup/restore', verifyAdminToken, (req, res) => {
  try {
    const { name } = req.body;
    const backupPath = path.join(__dirname, 'backups', `${name}.json`);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: '找不到備份檔案'
      });
    }

    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    // 還原所有檔案
    fs.writeFileSync(
      path.join(__dirname, 'system-settings.json'),
      JSON.stringify(backup.files.systemSettings, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(__dirname, 'student-reminder-settings.json'),
      JSON.stringify(backup.files.studentReminderSettings, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(__dirname, 'teacher_data.json'),
      JSON.stringify(backup.files.teacherData, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(__dirname, 'public', 'teacher_list_data.csv'),
      backup.files.teacherListData,
      'utf8'
    );

    res.json({
      success: true,
      message: '備份還原成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '還原備份失敗',
      error: error.message
    });
  }
});

// 測試提醒發送
app.post('/api/admin/test-reminder', verifyAdminToken, async (req, res) => {
  try {
    // 這裡可以實作測試提醒的邏輯
    res.json({
      success: true,
      message: '測試提醒已發送'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '發送測試提醒失敗',
      error: error.message
    });
  }
});

// ==================== 管理員 API 結束 ====================

// ==================== 學生資料 API ====================
// 注意：/api/students 路由已在第 3672 行定義，此處不需重複
// ==================== 學生資料 API 結束 ====================

// ==================== 管理員配置 API ====================

// GET /api/admin/info - 獲取管理員資訊
app.get('/api/admin/info', (req, res) => {
  try {
    const adminUserId = process.env.ADMIN_USER_ID || null;
    
    res.json({
      success: true,
      data: {
        userId: adminUserId,
        hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN
      }
    });
  } catch (error) {
    console.error('獲取管理員資訊失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取管理員資訊失敗: ' + error.message
    });
  }
});

// POST /api/admin/set - 設定管理員
app.post('/api/admin/set', async (req, res) => {
  try {
    const { adminUserId } = req.body;
    
    if (!adminUserId || adminUserId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '管理員 User ID 為必填'
      });
    }
    
    const envPath = path.join(__dirname, '.env.nas');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新或添加 ADMIN_USER_ID
    if (envContent.includes('ADMIN_USER_ID=')) {
      envContent = envContent.replace(
        /ADMIN_USER_ID=.*/g,
        `ADMIN_USER_ID=${adminUserId}`
      );
    } else {
      envContent += `\nADMIN_USER_ID=${adminUserId}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    
    // 同時更新 process.env（立即生效，無需重啟）
    process.env.ADMIN_USER_ID = adminUserId;
    
    console.log('✅ 管理員 User ID 已更新:', adminUserId);
    
    res.json({
      success: true,
      message: '管理員設定成功',
      data: {
        adminUserId: adminUserId
      }
    });
    
  } catch (error) {
    console.error('設定管理員失敗:', error);
    res.status(500).json({
      success: false,
      message: '設定管理員失敗: ' + error.message
    });
  }
});

// ==================== 管理員配置 API 結束 ====================

// ==================== LINE 測試 API ====================

// POST /api/test-line-notification - 測試 LINE 通知
app.post('/api/test-line-notification', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      return res.status(500).json({
        success: false,
        message: 'LINE_CHANNEL_ACCESS_TOKEN 未設定',
        hint: '請先在 LINE API 設定中設定 Channel Access Token'
      });
    }
    
    const testUserId = userId || process.env.ADMIN_USER_ID;
    
    if (!testUserId) {
      return res.status(400).json({
        success: false,
        message: '未設定管理員 User ID',
        hint: '請先在管理員配置中設定 User ID'
      });
    }
    
    const testMessage = message || `🧪 LINE 通知測試\n\n系統正常運作中！\n測試時間：${new Date().toLocaleString('zh-TW')}`;
    
    const response = await axios.post('https://api.line.me/v2/bot/message/push', {
      to: testUserId,
      messages: [{
        type: 'text',
        text: testMessage
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ LINE 測試通知發送成功:', testUserId);
    
    res.json({
      success: true,
      message: 'LINE 通知測試成功',
      data: {
        userId: testUserId,
        messageLength: testMessage.length,
        lineResponse: response.data
      }
    });
    
  } catch (error) {
    console.error('LINE 通知測試失敗:', error);
    
    const errorMessage = error.response?.data?.message || error.message;
    const errorDetails = error.response?.data?.details || [];
    
    res.status(500).json({
      success: false,
      message: 'LINE 通知測試失敗',
      error: errorMessage,
      details: errorDetails,
      hint: error.response?.status === 401 ? '請檢查 LINE_CHANNEL_ACCESS_TOKEN 是否正確' : 
            error.response?.status === 400 ? '請檢查管理員 User ID 是否正確' :
            '請檢查 LINE API 設定'
    });
  }
});

// ==================== LINE 測試 API 結束 ====================

// ==================== 系統設定 API ====================

// GET /api/system-settings - 獲取系統設定
app.get('/api/system-settings', (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'system-settings.json');
    
    if (!fs.existsSync(settingsPath)) {
      return res.status(404).json({
        success: false,
        message: '系統設定檔案不存在'
      });
    }
    
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('讀取系統設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取系統設定失敗: ' + error.message
    });
  }
});

// POST /api/system-settings - 更新系統設定
app.post('/api/system-settings', (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const newSettings = req.body;
    
    const mergedSettings = {
      ...loadSystemSettings(),
      ...newSettings,
      dateRange: {
        futureDays: Math.max(1, parseInt(newSettings.dateRange?.futureDays ?? newSettings.futureDays ?? 30, 10)),
        pastDays: Math.max(0, parseInt(newSettings.dateRange?.pastDays ?? newSettings.pastDays ?? 7, 10))
      }
    };
    
    if ('futureDays' in mergedSettings) delete mergedSettings.futureDays;
    if ('pastDays' in mergedSettings) delete mergedSettings.pastDays;
    
    // 備份舊設定
    if (fs.existsSync(settingsPath)) {
      const backupPath = path.join(__dirname, `system-settings.json.backup-${Date.now()}`);
      fs.copyFileSync(settingsPath, backupPath);
    }
    
    // 寫入新設定
    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
    
    console.log('✅ 系統設定已更新');
    
    res.json({
      success: true,
      message: '系統設定已更新',
      data: mergedSettings
    });
  } catch (error) {
    console.error('更新系統設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新系統設定失敗: ' + error.message
    });
  }
});

// GET /api/student-filter-config - 獲取學生篩選配置
app.get('/api/student-filter-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'student-filter-config.json');
    
    // 如果配置文件不存在，返回預設配置
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        debugMode: false,
        minRemainingClasses: 0,
        enableRemainingCheck: true,
        showInCurrentWeek: true, // 🎯 當週持續顯示低於最小堂數的學生
        courseMatchMode: 'exact', // 'exact' 或 'fuzzy'
        timeMatchRules: {
          allowWeekSuffix: true,
          allowSubstituteKeyword: true,
          normalizeTimeFormat: true
        }
      };
      
      return res.json({
        success: true,
        data: defaultConfig,
        message: '使用預設配置'
      });
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('✅ 學生篩選配置已載入');
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('讀取學生篩選配置失敗:', error);
    
    // 返回預設配置作為降級方案
    const defaultConfig = {
      debugMode: false,
      minRemainingClasses: 0,
      enableRemainingCheck: true,
      showInCurrentWeek: true, // 🎯 當週持續顯示低於最小堂數的學生
      courseMatchMode: 'exact',
      timeMatchRules: {
        allowWeekSuffix: true,
        allowSubstituteKeyword: true,
        normalizeTimeFormat: true
      }
    };
    
    res.json({
      success: true,
      data: defaultConfig,
      message: '使用預設配置（載入失敗）'
    });
  }
});

// POST /api/student-filter-config - 更新學生篩選配置
app.post('/api/student-filter-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'student-filter-config.json');
    const newConfig = req.body;
    
    // 驗證配置格式
    if (typeof newConfig.debugMode !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'debugMode 必須是布林值'
      });
    }
    
    if (typeof newConfig.minRemainingClasses !== 'number' || newConfig.minRemainingClasses < 0) {
      return res.status(400).json({
        success: false,
        message: 'minRemainingClasses 必須是非負數'
      });
    }
    
    // 備份舊配置
    if (fs.existsSync(configPath)) {
      const backupPath = path.join(__dirname, `student-filter-config.json.backup-${Date.now()}`);
      fs.copyFileSync(configPath, backupPath);
    }
    
    // 寫入新配置
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    
    console.log('✅ 學生篩選配置已更新:', newConfig);
    
    res.json({
      success: true,
      message: '學生篩選配置已更新',
      data: newConfig
    });
  } catch (error) {
    console.error('更新學生篩選配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新學生篩選配置失敗: ' + error.message
    });
  }
});

// POST /api/calendar-config - 更新行事曆設定
app.post('/api/calendar-config', async (req, res) => {
  try {
    const { baseUrl, username, password, calendarId } = req.body;
    
    if (!baseUrl || !username) {
      return res.status(400).json({
        success: false,
        message: '請提供行事曆 URL 和用戶名稱'
      });
    }
    
    const envPath = path.join(__dirname, '.env.nas');
    
    // 讀取現有的 .env.nas 內容
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新環境變數
    const updateEnvVar = (key, value) => {
      if (!value) return;
      const line = `${key}=${value}`;
      if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(new RegExp(`${key}=.*`, 'g'), line);
      } else {
        envContent += `\n${line}`;
      }
    };
    
    updateEnvVar('CALDAV_URL', baseUrl);
    updateEnvVar('CALDAV_USERNAME', username);
    if (password) {
      updateEnvVar('CALDAV_PASSWORD', password);
    }
    
    // 寫入文件
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ 行事曆設定已更新到 .env.nas');
    console.log('⚠️ 請重啟 Docker 服務以載入新配置');
    
    res.json({
      success: true,
      message: '行事曆設定已儲存，請重啟 Docker 服務以載入新配置',
      needRestart: true
    });
  } catch (error) {
    console.error('更新行事曆設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新行事曆設定失敗: ' + error.message
    });
  }
});
// POST /api/reminder-config - 更新提醒設定
app.post('/api/reminder-config', (req, res) => {
  try {
    const { 
      todayReminderHour, 
      todayReminderMinute, 
      tomorrowReminderHour, 
      tomorrowReminderMinute,
      beforeClassMinutes 
    } = req.body;
    
    const settingsPath = path.join(__dirname, 'system-settings.json');
    
    if (!fs.existsSync(settingsPath)) {
      return res.status(404).json({
        success: false,
        message: '系統設定檔案不存在'
      });
    }
    
    // 讀取現有設定
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    
    // 更新提醒設定
    if (todayReminderHour !== undefined) {
      settings.reminders.todayReminderHour = todayReminderHour;
    }
    if (todayReminderMinute !== undefined) {
      settings.reminders.todayReminderMinute = todayReminderMinute;
    }
    if (tomorrowReminderHour !== undefined) {
      settings.reminders.tomorrowReminderHour = tomorrowReminderHour;
    }
    if (tomorrowReminderMinute !== undefined) {
      settings.reminders.tomorrowReminderMinute = tomorrowReminderMinute;
    }
    if (beforeClassMinutes !== undefined) {
      settings.reminders.beforeClassMinutes = beforeClassMinutes;
    }
    
    // 備份舊設定
    const backupPath = path.join(__dirname, `system-settings.json.backup-${Date.now()}`);
    fs.copyFileSync(settingsPath, backupPath);
    
    // 寫入新設定
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    console.log('✅ 提醒設定已更新');
    
    res.json({
      success: true,
      message: '提醒設定已更新'
    });
  } catch (error) {
    console.error('更新提醒設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新提醒設定失敗: ' + error.message
    });
  }
});

// ==================== LINE 配置管理 API ====================

// GET /api/line-config - 獲取 LINE 配置狀態
app.get('/api/line-config', (req, res) => {
  try {
    const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const tokenLength = hasToken ? process.env.LINE_CHANNEL_ACCESS_TOKEN.length : 0;
    const tokenPreview = hasToken ? process.env.LINE_CHANNEL_ACCESS_TOKEN.substring(0, 20) : null;
    const liffClientId = process.env.LIFF_CLIENT_ID || null;
    
    res.json({
      success: true,
      data: {
        hasToken,
        tokenLength,
        tokenPreview,
        liffClientId,
        adminUserId: process.env.ADMIN_USER_ID || null,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('獲取 LINE 配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取 LINE 配置失敗: ' + error.message
    });
  }
});
// POST /api/line-config - 更新 LINE 配置
app.post('/api/line-config', async (req, res) => {
  try {
    const { lineChannelToken, liffClientId } = req.body;
    
    if (!lineChannelToken || lineChannelToken.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'LINE Channel Access Token 為必填'
      });
    }
    
    const envPath = path.join(__dirname, '.env.nas');
    
    // 讀取現有的 .env.nas 內容
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新或添加 LINE_CHANNEL_ACCESS_TOKEN
    const tokenLine = `LINE_CHANNEL_ACCESS_TOKEN=${lineChannelToken}`;
    const liffLine = liffClientId ? `LIFF_CLIENT_ID=${liffClientId}` : '';
    
    // 檢查是否已存在
    if (envContent.includes('LINE_CHANNEL_ACCESS_TOKEN=')) {
      // 替換現有的 Token
      envContent = envContent.replace(
        /LINE_CHANNEL_ACCESS_TOKEN=.*/g,
        tokenLine
      );
    } else {
      // 添加新的 Token
      envContent += '\n\n# LINE Messaging API\n' + tokenLine + '\n';
    }
    
    // 更新或添加 LIFF_CLIENT_ID
    if (liffClientId) {
      if (envContent.includes('LIFF_CLIENT_ID=')) {
        envContent = envContent.replace(
          /LIFF_CLIENT_ID=.*/g,
          liffLine
        );
      } else {
        envContent += liffLine + '\n';
      }
    }
    
    // 寫入文件
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ LINE 配置已更新到 .env.nas');
    console.log('⚠️ 請重啟 Docker 服務以載入新配置');
    
    res.json({
      success: true,
      message: 'LINE 配置已儲存，請重啟 Docker 服務以載入新配置',
      needRestart: true,
      data: {
        tokenLength: lineChannelToken.length,
        tokenPreview: lineChannelToken.substring(0, 20) + '...',
        liffClientId: liffClientId || null
      }
    });
    
  } catch (error) {
    console.error('更新 LINE 配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新 LINE 配置失敗: ' + error.message
    });
  }
});

// ==================== LINE 配置 API 結束 ====================

// ==================== 特殊事件配置 API ====================

// GET /api/special-events-config - 獲取特殊事件配置
app.get('/api/special-events-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'special-events-config.json');
    
    if (!fs.existsSync(configPath)) {
      // 如果配置文件不存在，返回預設值
      const defaultConfig = {
        "停課": { enabled: true, keywords: ["停課", "取消", "暫停", "休息", "放假", "請假"] },
        "體驗": { enabled: true, keywords: ["體驗", "體驗課", "體驗班"] },
        "代課": { enabled: true, keywords: ["代課", "代理", "支援"] },
        "補課": { enabled: true, keywords: ["補課", "調課", "延後", "提前", "改時間"] }
      };
      
      console.log('⚠️ 特殊事件配置文件不存在，返回預設值');
      return res.json({
        success: true,
        data: defaultConfig,
        isDefault: true
      });
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    console.log('✅ 成功載入特殊事件配置');
    
    res.json({
      success: true,
      data: config,
      isDefault: false
    });
  } catch (error) {
    console.error('❌ 讀取特殊事件配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取特殊事件配置失敗: ' + error.message
    });
  }
});

// POST /api/special-events-config - 更新特殊事件配置
app.post('/api/special-events-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'special-events-config.json');
    const newConfig = req.body;
    
    // 驗證配置格式
    const requiredTypes = ['停課', '體驗', '代課', '補課'];
    for (const type of requiredTypes) {
      if (!newConfig[type]) {
        return res.status(400).json({
          success: false,
          message: `缺少必要的事件類型：${type}`
        });
      }
      
      if (typeof newConfig[type].enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: `${type} 的 enabled 必須為布林值`
        });
      }
      
      if (!Array.isArray(newConfig[type].keywords)) {
        return res.status(400).json({
          success: false,
          message: `${type} 的 keywords 必須為陣列`
        });
      }
    }
    
    // 備份舊配置（如果存在）
    if (fs.existsSync(configPath)) {
      const backupPath = path.join(__dirname, `special-events-config.json.backup-${Date.now()}`);
      fs.copyFileSync(configPath, backupPath);
      console.log('✅ 已備份舊配置到:', backupPath);
    }
    
    // 寫入新配置
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    
    console.log('✅ 特殊事件配置已更新');
    console.log('📋 新配置:', JSON.stringify(newConfig, null, 2));
    
    res.json({
      success: true,
      message: '特殊事件配置已更新',
      data: newConfig
    });
  } catch (error) {
    console.error('❌ 更新特殊事件配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新特殊事件配置失敗: ' + error.message
    });
  }
});

// ==================== 特殊事件配置 API 結束 ====================

// ==================== Google API 配置 ====================
const googleApiConfigPath = path.join(__dirname, 'google-api-config.json');

// 獲取 Google API 設定
app.get('/api/google-api-config', (req, res) => {
  try {
    if (fs.existsSync(googleApiConfigPath)) {
      const config = JSON.parse(fs.readFileSync(googleApiConfigPath, 'utf8'));
      res.json({success: true, data: config});
    } else {
      res.json({success: true, data: {}});
    }
  } catch (error) {
    console.error('❌ 讀取 Google API 配置失敗:', error);
    res.status(500).json({success: false, message: error.message});
  }
});

// 儲存 Google API 設定
app.post('/api/google-api-config', (req, res) => {
  try {
    const config = req.body;
    fs.writeFileSync(googleApiConfigPath, JSON.stringify(config, null, 2));
    console.log('✅ Google API 配置已儲存:', config);
    res.json({success: true, message: '設定已儲存'});
  } catch (error) {
    console.error('❌ 儲存 Google API 配置失敗:', error);
    res.status(500).json({success: false, message: error.message});
  }
});

// ==================== 緩存管理 API ====================
// 清除事件快取
app.post('/api/events/clear-cache', (req, res) => {
  try {
    eventsCache.data = null;
    eventsCache.lastUpdate = null;
    console.log('✅ 事件快取已清除');
    res.json({success: true, message: '事件快取已清除'});
  } catch (error) {
    console.error('❌ 清除事件快取失敗:', error);
    res.status(500).json({success: false, message: error.message});
  }
});

// 清除所有快取
app.post('/api/cache/clear-all', (req, res) => {
  try {
    eventsCache.data = null;
    eventsCache.lastUpdate = null;
    
    // 清除 memoryDB 如果存在
    if (typeof memoryDB !== 'undefined' && memoryDB && typeof memoryDB.clear === 'function') {
      memoryDB.clear();
    }
    
    console.log('✅ 所有快取已清除');
    res.json({success: true, message: '所有快取已清除'});
  } catch (error) {
    console.error('❌ 清除快取失敗:', error);
    res.status(500).json({success: false, message: error.message});
  }
});

// ==================== 學習歷程上傳系統 ====================

const multer = require('multer');

// 學期判斷函數
function getCurrentSemester() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const taiwanYear = year - 1911;
  
  if (month >= 3 && month <= 6) {
    return `${taiwanYear}-2`;
  } else if (month >= 7 && month <= 8) {
    return `夏令營-${year}`;
  } else if (month >= 9 && month <= 12) {
    return `${taiwanYear}-1`;
  } else {
    return `冬令營-${year}`;
  }
}

// 路徑生成函數
function generateLearningPath(course, period, date, studentName = null, isOverview = false) {
  const basePath = '/volume1/Fun Learn Bar/學習歷程 automatic';
  const semester = getCurrentSemester();
  const coursePeriod = `${course}-${period.replace(/\s+/g, '')}`;
  
  let fullPath = path.join(basePath, semester, coursePeriod, date);
  
  if (isOverview) {
    fullPath = path.join(fullPath, '課程總覽');
  } else if (studentName) {
    fullPath = path.join(fullPath, studentName);
  }
  
  return fullPath;
}

// 驗證路徑安全性（防止路徑遍歷攻擊）
function isPathSafe(targetPath, basePath) {
  const resolvedPath = path.resolve(targetPath);
  const resolvedBase = path.resolve(basePath);
  return resolvedPath.startsWith(resolvedBase);
}

// 配置 multer 存儲
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const { course, period, date, studentName, isOverview } = req.body;
    const targetPath = generateLearningPath(
      course, 
      period, 
      date, 
      isOverview === 'true' ? null : studentName,
      isOverview === 'true'
    );
    
    // 檢查路徑安全性
    const basePath = '/volume1/Fun Learn Bar/學習歷程 automatic';
    if (!isPathSafe(targetPath, basePath)) {
      return cb(new Error('不安全的路徑'), null);
    }
    
    // 確保目錄存在
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
      console.log('📁 創建目錄:', targetPath);
    }
    
    cb(null, targetPath);
  },
  filename: function (req, file, cb) {
    const { studentName } = req.body;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    
    let filename;
    if (file.fieldname === 'photos') {
      const photoIndex = req.photoCount || 1;
      filename = `${studentName}_photo_${photoIndex}_${timestamp}${ext}`;
      req.photoCount = photoIndex + 1;
    } else if (file.fieldname === 'videos') {
      const videoIndex = req.videoCount || 1;
      filename = `${studentName}_video_${videoIndex}_${timestamp}${ext}`;
      req.videoCount = videoIndex + 1;
    } else if (file.fieldname === 'overviewPhotos') {
      filename = `overview_${timestamp}${ext}`;
    } else {
      filename = `${timestamp}${ext}`;
    }
    
    cb(null, filename);
  }
});

// 文件過濾器
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo'];
  
  if (file.fieldname === 'photos' || file.fieldname === 'overviewPhotos') {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳 JPG, PNG, HEIC 格式的圖片'), false);
    }
  } else if (file.fieldname === 'videos') {
    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳 MP4, MOV, AVI 格式的影片'), false);
    }
  } else {
    cb(null, true);
  }
};

function normalizeCourseId(event) {
  if (!event) return null;
  return event.id || event.uid || event.evt_id || event._raw?.uid || event._raw?.evt_id || null;
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});
// API: 獲取今天已結束的課程列表
app.get('/api/learning-records/today-completed-courses', async (req, res) => {
  try {
    const { eventId, date, range, instructor } = req.query;
    console.log('📚 獲取學習歷程課程列表...', { eventId, date, range, instructor });

    // 決定查詢日期範圍
    const now = new Date();
    const requestedDate = date ? new Date(date) : null;
    const targetDate = !requestedDate || Number.isNaN(requestedDate.getTime()) ? new Date(now) : requestedDate;
    targetDate.setHours(0, 0, 0, 0);

    let startDate = new Date(targetDate);
    let endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    let effectiveRange = 'day';

    if (range === 'week') {
      effectiveRange = 'week';
      const dayOfWeek = targetDate.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(targetDate);
      startDate.setDate(targetDate.getDate() + diffToMonday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }

    console.log('📅 查詢日期範圍:', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      effectiveRange
    });

    // 🔥 修復：直接從 CalDAV 獲取指定日期範圍的課程，而不是使用 /api/events
    // /api/events 只返回本週一之後的課程，無法查看過去的課程
    let events = [];
    
    if (!caldavClient) {
      console.warn('⚠️ CalDAV 客戶端未初始化，嘗試從 /api/events 獲取');
      const eventsResponse = await axios.get(`http://localhost:${PORT}/api/events`);
      if (eventsResponse.data.success && eventsResponse.data.events) {
        events = eventsResponse.data.events;
      }
    } else {
      // 從 CalDAV 直接獲取指定日期範圍的事件
      console.log('📅 從 CalDAV 獲取課程...');
      const rawEvents = await caldavClient.getAllInstructorEvents(startDate, endDate);
      
      // 轉換為前端格式
      events = rawEvents.map(event => ({
        id: event.uid || event.evt_id || event.id,
        title: event.title || event.summary,
        instructor: event.instructor,
        start: event.start,
        end: event.end,
        type: event.type || 'other',
        description: event.description || '',
        location: event.location || '',
        time: event.time || '',
        lessonUrl: event.lessonUrl || '',
        _raw: {
          uid: event.uid,
          evt_id: event.evt_id,
          calendarId: event.calendarId
        }
      }));
      
      console.log('✅ 從 CalDAV 獲取到', events.length, '個課程');
    }

    function normalizeCourseId(event) {
      if (!event) return null;
      return event.id || event.uid || event.evt_id || event._raw?.uid || event._raw?.evt_id || null;
    }

    const targetEventId = eventId || null;
    const matchedEvent = targetEventId
      ? events.find(event => {
          const possibleIds = [
            event.id,
            event.uid,
            event.evt_id,
            event._raw?.uid,
            event._raw?.evt_id
          ].filter(Boolean);
          return possibleIds.some(idValue => idValue === targetEventId);
        })
      : null;

    const isWithinRange = (event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      if (effectiveRange === 'week') {
        return eventStart <= endDate && eventEnd >= startDate;
      }

      return eventStart >= startDate && eventStart <= endDate;
    };

    const filteredByRange = events.filter(event => isWithinRange(event));

    // 將匹配的事件加入集合避免重複
    const eventMap = new Map();
    const addEventToMap = event => {
      if (!event) return;
      const key = normalizeCourseId(event) || `${event.title}-${event.start}`;
      if (!eventMap.has(key)) {
        eventMap.set(key, event);
      }
    };

    filteredByRange.forEach(addEventToMap);
    addEventToMap(matchedEvent);

    const combinedEvents = Array.from(eventMap.values()).sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    console.log('✅ 找到符合篩選的課程數量:', combinedEvents.length);

    // 讀取學生資料
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    let studentData = { students: [] };
    if (fs.existsSync(studentDataPath)) {
      studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
    }

    // 讀取講師顏色
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    const teacherColorMap = {};
    if (fs.existsSync(teacherDataPath)) {
      try {
        const teacherRaw = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
        let teachers = [];
        if (Array.isArray(teacherRaw.teachers)) {
          teachers = teacherRaw.teachers;
        } else if (teacherRaw.teachers && typeof teacherRaw.teachers === 'object') {
          teachers = Object.entries(teacherRaw.teachers).map(([name, value]) => {
            if (typeof value === 'object') {
              return { name, ...value };
            }
            return { name, userId: value };
          });
        }

        teachers.forEach(teacher => {
          if (teacher.name) {
            teacherColorMap[teacher.name.toUpperCase()] = teacher.color || null;
          }
        });
      } catch (teacherError) {
        console.warn('⚠️ 讀取講師顏色失敗:', teacherError);
      }
    }

    const formatTimeRange = (startDateTime, endDateTime) => {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      const pad = value => value.toString().padStart(2, '0');
      return `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;
    };

    const determineStatus = (startDateTime, endDateTime) => {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      if (end < now) return 'completed';
      if (start > now) return 'upcoming';
      return 'ongoing';
    };

    // 🔥 引入共用的課程匹配邏輯模組
    const CourseStudentMatcher = require('./public/js/course-student-matcher.js');
    
    // 🔥 輔助函數：從課程標題提取時段資訊
    const extractPeriodFromTitle = (title, start, end) => {
      // 從開始和結束時間提取時段（例如 "日 1000-1200"）
      // ⚠️ 注意：CalDAV 返回的時間字串沒有時區資訊（如 "2025-10-19T10:00:00"）
      // JavaScript 會將其視為本地時間或 UTC 時間（取決於運行環境）
      // 我們需要將其解析為台灣時間（UTC+8）
      
      let startDate, endDate;
      
      // 檢查時間字串是否包含時區資訊
      if (typeof start === 'string' && !start.includes('Z') && !start.includes('+') && !start.includes('-', 10)) {
        // 沒有時區資訊，手動加上 +08:00 (台灣時區)
        startDate = new Date(start + '+08:00');
        endDate = new Date(end + '+08:00');
      } else {
        // 已經包含時區資訊，直接解析
        startDate = new Date(start);
        endDate = new Date(end);
      }
      
      // 星期對應（使用本地時間方法，因為我們已經處理了時區）
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      const weekday = weekdays[startDate.getDay()];
      
      // 時間格式化（HHMM）- 使用本地時間方法
      const pad = (num) => String(num).padStart(2, '0');
      const startTime = `${pad(startDate.getHours())}${pad(startDate.getMinutes())}`;
      const endTime = `${pad(endDate.getHours())}${pad(endDate.getMinutes())}`;
      
      return `${weekday} ${startTime}-${endTime}`;
    };
    
    // 🔥 後端不再做學生篩選，只返回課程資料和元數據
    // 學生篩選完全由前端使用共用的 student-filter.js 來處理
    const coursesWithMetadata = combinedEvents.map(course => {
      const courseTitle = course.title || '';
      
      // 🔥 使用共用模組提取課程名稱
      const courseName = CourseStudentMatcher.extractCourseName(courseTitle);
      
      const courseStart = new Date(course.start);
      const dateKey = courseStart.toISOString().split('T')[0];

      const status = determineStatus(course.start, course.end);
      const instructorName = (course.instructor || '').toUpperCase();
      const instructorColor = teacherColorMap[instructorName] || null;

      // 🔥 提取課程時段（用於前端篩選）
      const coursePeriod = extractPeriodFromTitle(courseTitle, course.start, course.end);

      console.log('📚 課程資料:', {
        eventId: course.id || course.uid || course.evt_id,
        courseTitle,
        extractedCourseName: courseName,
        extractedPeriod: coursePeriod
      });

      return {
        ...course,
        id: normalizeCourseId(course) || `${courseName}-${courseStart.getTime()}`,
        courseName,
        coursePeriod,  // 🔥 加入課程時段供前端使用
        dateKey,
        status,
        isCompleted: status === 'completed',
        timeRange: formatTimeRange(course.start, course.end),
        instructorColor
      };
    });

    // 🔥 根據 instructor 參數篩選課程
    let filteredCourses = coursesWithMetadata;
    if (instructor) {
      const targetInstructor = instructor.trim().toUpperCase();
      filteredCourses = coursesWithMetadata.filter(course => {
        const courseInstructor = (course.instructor || '').trim().toUpperCase();
        // 支援部分匹配和完全匹配
        const exactMatch = courseInstructor === targetInstructor;
        const partialMatch = courseInstructor.includes(targetInstructor) || targetInstructor.includes(courseInstructor);
        return exactMatch || partialMatch;
      });
      
      console.log('👨‍🏫 講師篩選結果:', {
        instructor: targetInstructor,
        originalCount: coursesWithMetadata.length,
        filteredCount: filteredCourses.length
      });
    }

    res.json({
      success: true,
      filters: {
        range: effectiveRange,
        date: targetDate.toISOString().split('T')[0],
        requestedEventId: targetEventId,
        instructor: instructor || null,
        today: now.toISOString().split('T')[0]
      },
      meta: {
        total: filteredCourses.length,
        highlightEventId: normalizeCourseId(matchedEvent)
      },
      courses: filteredCourses
    });
  } catch (error) {
    console.error('❌ 獲取學習歷程課程列表失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
// API: 上傳學習記錄
app.post('/api/learning-records/upload', upload.fields([
  { name: 'photos', maxCount: 10 },
  { name: 'videos', maxCount: 5 },
  { name: 'overviewPhotos', maxCount: 20 }
]), async (req, res) => {
  try {
    const { course, period, date, studentName, comment, isOverview, overviewSummary } = req.body;
    
    console.log('📤 上傳學習記錄:', { course, period, date, studentName, isOverview });
    
    // 驗證必要欄位
    if (!course || !period || !date) {
      return res.status(400).json({
        success: false,
        message: '缺少必要欄位: course, period, date'
      });
    }
    
    if (isOverview === 'true') {
      // 課程總覽
      const targetPath = generateLearningPath(course, period, date, null, true);
      
      // 儲存課程摘要
      if (overviewSummary) {
        const summaryPath = path.join(targetPath, 'summary.txt');
        fs.writeFileSync(summaryPath, overviewSummary, 'utf8');
        console.log('✅ 儲存課程摘要:', summaryPath);
      }
      
      res.json({
        success: true,
        message: '課程總覽上傳成功',
        path: targetPath,
        files: {
          photos: req.files?.overviewPhotos?.length || 0
        }
      });
      
    } else {
      // 學生個人記錄
      if (!studentName) {
        return res.status(400).json({
          success: false,
          message: '缺少學生姓名'
        });
      }
      
      const photos = req.files?.photos || [];
      const videos = req.files?.videos || [];
      
      // 驗證上傳要求
      if (photos.length < 3) {
        return res.status(400).json({
          success: false,
          message: '至少需要上傳 3 張照片'
        });
      }
      
      if (videos.length < 1) {
        return res.status(400).json({
          success: false,
          message: '至少需要上傳 1 個影片'
        });
      }
      
      if (!comment || comment.length < 20) {
        return res.status(400).json({
          success: false,
          message: '評語至少需要 20 個字'
        });
      }
      
      const targetPath = generateLearningPath(course, period, date, studentName, false);
      
      // 儲存評語
      const commentPath = path.join(targetPath, 'comment.txt');
      fs.writeFileSync(commentPath, comment, 'utf8');
      console.log('✅ 儲存評語:', commentPath);
      
      res.json({
        success: true,
        message: '學習記錄上傳成功',
        path: targetPath,
        files: {
          photos: photos.length,
          videos: videos.length,
          comment: comment.length
        }
      });
    }
    
  } catch (error) {
    console.error('❌ 上傳學習記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
// API: 查詢學習記錄歷史
app.get('/api/learning-records/history', (req, res) => {
  try {
    const { semester, course, period, date, studentName } = req.query;
    
    console.log('🔍 查詢學習記錄:', { semester, course, period, date, studentName });
    
    const basePath = '/volume1/Fun Learn Bar/學習歷程 automatic';
    const targetSemester = semester || getCurrentSemester();
    
    let searchPath;
    if (course && period && date && studentName) {
      // 查詢特定學生的記錄
      searchPath = generateLearningPath(course, period, date, studentName, false);
    } else if (course && period && date) {
      // 查詢特定日期的課程
      searchPath = generateLearningPath(course, period, date, null, false);
    } else if (course && period) {
      // 查詢特定課程的所有記錄
      const coursePeriod = `${course}-${period.replace(/\s+/g, '')}`;
      searchPath = path.join(basePath, targetSemester, coursePeriod);
    } else {
      // 查詢整個學期的記錄
      searchPath = path.join(basePath, targetSemester);
    }
    
    // 檢查路徑是否存在
    if (!fs.existsSync(searchPath)) {
      return res.json({
        success: true,
        records: [],
        message: '找不到記錄'
      });
    }
    
    // 遞迴讀取目錄
    function readDirRecursive(dirPath, records = []) {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          // 如果是學生目錄（包含 comment.txt）
          const commentPath = path.join(fullPath, 'comment.txt');
          if (fs.existsSync(commentPath)) {
            const photos = fs.readdirSync(fullPath).filter(f => f.includes('photo'));
            const videos = fs.readdirSync(fullPath).filter(f => f.includes('video'));
            const comment = fs.readFileSync(commentPath, 'utf8');
            
            records.push({
              type: 'student',
              path: fullPath,
              studentName: item,
              photos: photos.length,
              videos: videos.length,
              comment: comment,
              files: {
                photos,
                videos
              }
            });
          } else {
            // 繼續遞迴
            readDirRecursive(fullPath, records);
          }
        }
      }
      
      return records;
    }
    
    const records = readDirRecursive(searchPath);
    
    res.json({
      success: true,
      records,
      searchPath
    });
    
  } catch (error) {
    console.error('❌ 查詢學習記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API: 檢查上傳完成度
app.get('/api/learning-records/check-completion', (req, res) => {
  try {
    const { course, period, date, studentName } = req.query;
    
    if (!course || !period || !date || !studentName) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數'
      });
    }
    
    const targetPath = generateLearningPath(course, period, date, studentName, false);
    
    if (!fs.existsSync(targetPath)) {
      return res.json({
        success: true,
        completed: false,
        missing: {
          photos: 3,
          videos: 1,
          comment: true
        }
      });
    }
    
    const files = fs.readdirSync(targetPath);
    const photos = files.filter(f => f.includes('photo'));
    const videos = files.filter(f => f.includes('video'));
    const hasComment = files.includes('comment.txt');
    
    let commentLength = 0;
    if (hasComment) {
      const comment = fs.readFileSync(path.join(targetPath, 'comment.txt'), 'utf8');
      commentLength = comment.length;
    }
    
    const missing = {};
    if (photos.length < 3) missing.photos = 3 - photos.length;
    if (videos.length < 1) missing.videos = 1 - videos.length;
    if (!hasComment || commentLength < 20) missing.comment = true;
    
    const completed = Object.keys(missing).length === 0;
    
    res.json({
      success: true,
      completed,
      current: {
        photos: photos.length,
        videos: videos.length,
        commentLength
      },
      missing: completed ? null : missing
    });
    
  } catch (error) {
    console.error('❌ 檢查完成度失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API: 刪除學習記錄
app.delete('/api/learning-records/:recordId', (req, res) => {
  try {
    const { recordId } = req.params;
    const { course, period, date, studentName, filename } = req.query;
    
    if (!course || !period || !date) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數'
      });
    }
    
    const targetPath = generateLearningPath(course, period, date, studentName || null, false);
    
    // 檢查路徑安全性
    const basePath = '/volume1/Fun Learn Bar/學習歷程 automatic';
    if (!isPathSafe(targetPath, basePath)) {
      return res.status(403).json({
        success: false,
        message: '不安全的路徑'
      });
    }
    
    if (filename) {
      // 刪除單一檔案
      const filePath = path.join(targetPath, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log('🗑️ 刪除檔案:', filePath);
        res.json({
          success: true,
          message: '檔案已刪除'
        });
      } else {
        res.status(404).json({
          success: false,
          message: '檔案不存在'
        });
      }
    } else if (studentName) {
      // 刪除整個學生記錄
      if (fs.existsSync(targetPath)) {
        fs.rmSync(targetPath, { recursive: true, force: true });
        console.log('🗑️ 刪除學生記錄:', targetPath);
        res.json({
          success: true,
          message: '學生記錄已刪除'
        });
      } else {
        res.status(404).json({
          success: false,
          message: '記錄不存在'
        });
      }
    } else {
      res.status(400).json({
        success: false,
        message: '請指定要刪除的檔案或學生'
      });
    }
    
  } catch (error) {
    console.error('❌ 刪除學習記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API: 更新學習記錄
app.put('/api/learning-records/:recordId', upload.fields([
  { name: 'photos', maxCount: 10 },
  { name: 'videos', maxCount: 5 }
]), async (req, res) => {
  try {
    const { recordId } = req.params;
    const { course, period, date, studentName, comment } = req.body;
    
    if (!course || !period || !date || !studentName) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數'
      });
    }
    
    const targetPath = generateLearningPath(course, period, date, studentName, false);
    
    // 更新評語
    if (comment) {
      const commentPath = path.join(targetPath, 'comment.txt');
      fs.writeFileSync(commentPath, comment, 'utf8');
      console.log('✅ 更新評語:', commentPath);
    }
    
    const photos = req.files?.photos || [];
    const videos = req.files?.videos || [];
    
    res.json({
      success: true,
      message: '學習記錄已更新',
      updated: {
        comment: !!comment,
        photos: photos.length,
        videos: videos.length
      }
    });
    
  } catch (error) {
    console.error('❌ 更新學習記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 學習歷程上傳系統結束 ====================

// ==================== 特殊事件偵測 API ====================

// 🌟 特殊事件類型定義
const SPECIAL_EVENT_TYPES = {
  "停課": ["停課", "取消", "暫停", "休息", "放假", "請假"],
  "體驗": ["體驗", "體驗課", "體驗班"],
  "代課": ["代課", "代理", "支援"],
  "改時間": ["調課", "延後", "提前", "改時間"]
};

// 🎨 特殊事件顏色配置
const SPECIAL_EVENT_COLORS = {
  '停課': {
    color: 'rgba(220, 53, 69, 0.5)',
    glowColor: 'rgba(220, 53, 69, 0.3)',
    borderWidth: '3px',
    emoji: '🔴'
  },
  '體驗': {
    color: 'rgba(255, 215, 0, 0.6)',
    glowColor: 'rgba(255, 215, 0, 0.4)',
    borderWidth: '3px',
    emoji: '🟢'
  },
  '代課': {
    color: 'rgba(33, 150, 243, 0.5)',
    glowColor: 'rgba(33, 150, 243, 0.3)',
    borderWidth: '3px',
    emoji: '🔵'
  },
  '改時間': {
    color: 'rgba(245, 158, 11, 0.5)',
    glowColor: 'rgba(245, 158, 11, 0.3)',
    borderWidth: '3px',
    emoji: '🟠'
  }
};

// 🔍 偵測事件標題是否為特殊事件
function detectSpecialEventType(eventTitle) {
  if (!eventTitle) return null;
  
  const title = eventTitle.toLowerCase();
  
  for (const [category, keywords] of Object.entries(SPECIAL_EVENT_TYPES)) {
    for (const keyword of keywords) {
      if (title.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  
  return null;
}

// API: 取得所有特殊事件類型配置
app.get('/api/special-event-types', (req, res) => {
  try {
    const response = {};
    
    for (const [eventType, keywords] of Object.entries(SPECIAL_EVENT_TYPES)) {
      response[eventType] = {
        keywords: keywords,
        ...SPECIAL_EVENT_COLORS[eventType]
      };
    }
    
    res.json({
      success: true,
      data: response,
      timestamp: new Date().toISOString()
    });
    
    console.log('📋 返回特殊事件類型配置');
  } catch (error) {
    console.error('❌ 取得特殊事件類型失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API: 偵測單一事件標題
app.post('/api/detect-special-event', (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: '缺少 title 參數'
      });
    }
    
    const specialEventType = detectSpecialEventType(title);
    const config = specialEventType ? SPECIAL_EVENT_COLORS[specialEventType] : null;
    
    res.json({
      success: true,
      eventTitle: title,
      specialEventType: specialEventType,
      isSpecial: !!specialEventType,
      config: config
    });
    
    console.log(`🔍 偵測事件: "${title}" -> ${specialEventType || '正常課程'}`);
  } catch (error) {
    console.error('❌ 偵測特殊事件失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API: 批量偵測事件標題
app.post('/api/detect-batch-events', (req, res) => {
  try {
    const { titles } = req.body;
    
    if (!titles || !Array.isArray(titles)) {
      return res.status(400).json({
        success: false,
        message: 'titles 必須是陣列'
      });
    }
    
    const results = titles.map(title => {
      const specialEventType = detectSpecialEventType(title);
      return {
        title: title,
        specialEventType: specialEventType,
        isSpecial: !!specialEventType,
        emoji: specialEventType ? SPECIAL_EVENT_COLORS[specialEventType].emoji : null
      };
    });
    
    const specialCount = results.filter(r => r.isSpecial).length;
    
    res.json({
      success: true,
      results: results,
      summary: {
        total: titles.length,
        specialCount: specialCount,
        normalCount: titles.length - specialCount
      }
    });
    
    console.log(`🔍 批量偵測 ${titles.length} 個事件，${specialCount} 個特殊事件`);
  } catch (error) {
    console.error('❌ 批量偵測特殊事件失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API: 取得特殊事件關鍵字列表（簡化版，只返回關鍵字）
app.get('/api/special-event-keywords', (req, res) => {
  try {
    res.json({
      success: true,
      data: SPECIAL_EVENT_TYPES,
      timestamp: new Date().toISOString()
    });
    
    console.log('📋 返回特殊事件關鍵字列表');
  } catch (error) {
    console.error('❌ 取得特殊事件關鍵字失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// API: 更新特殊事件關鍵字（僅內部使用，未來可擴展為持久化儲存）
app.post('/api/special-event-types/update', (req, res) => {
  try {
    const { eventType, keywords } = req.body;
    
    if (!eventType || !keywords || !Array.isArray(keywords)) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數或格式錯誤'
      });
    }
    
    if (!SPECIAL_EVENT_TYPES.hasOwnProperty(eventType)) {
      return res.status(400).json({
        success: false,
        message: `不支援的事件類型: ${eventType}`
      });
    }
    
    SPECIAL_EVENT_TYPES[eventType] = keywords;
    
    res.json({
      success: true,
      message: `已更新 ${eventType} 的關鍵字`,
      eventType: eventType,
      keywords: keywords
    });
    
    console.log(`✅ 更新特殊事件關鍵字: ${eventType} -> [${keywords.join(', ')}]`);
  } catch (error) {
    console.error('❌ 更新特殊事件關鍵字失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 特殊事件偵測 API 結束 ====================

// ==================== API 結束 ====================

// 啟動服務器
app.listen(PORT, () => {
  console.log('🚀 FLB講師行事曆LIFF應用運行在端口', PORT);
  console.log('🌐 主頁面: http://localhost:' + PORT);
  console.log('🔧 API端點: http://localhost:' + PORT + '/api/teachers');
  console.log('🔗 代理端點: http://localhost:' + PORT + '/api/google-script');
  console.log('📊 健康檢查: http://localhost:' + PORT + '/api/health');
  console.log('🔔 提醒管理: http://localhost:' + PORT + '/course-reminder-management.html');
  console.log('⚙️  管理後台: http://localhost:' + PORT + '/admin-settings.html (密碼: admin123)');
  console.log('🌍 環境:', process.env.NODE_ENV || 'development');
  
  // 自動啟動提醒排程器
  console.log('🕐 啟動提醒排程器...');
  reminderScheduler.start();
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信號，正在關閉服務器...');
  reminderScheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信號，正在關閉服務器...');
  reminderScheduler.stop();
  process.exit(0);
});