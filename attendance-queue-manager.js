// ============================================
// 📦 可靠的簽到隊列管理器（後端版本）
// ============================================
// 版本：2024-10-26 - 立即更新 student_data.json + 失敗回退機制
const fs = require('fs');
const path = require('path');
const axios = require('axios');

class AttendanceQueueManager {
    constructor(queueFilePath, notificationManager, options = {}) {
        this.queueFilePath = queueFilePath;
        this.notificationManager = notificationManager;
        this.courseHistoryLogger = options.courseHistoryLogger || null;
        this.isProcessing = false;
        this.maxRetries = 5; // 最多重試5次
        this.retryDelay = 5000; // 5秒重試一次
        
        // 確保隊列文件存在
        this.ensureQueueFile();
        
        // 啟動背景處理器（每30秒檢查一次）
        this.startBackgroundProcessor();
        
        console.log('✅ 簽到隊列管理器已初始化（立即更新模式）');
    }
    
    // 確保隊列文件存在
    ensureQueueFile() {
        const dir = path.dirname(this.queueFilePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log('📁 已創建目錄:', dir);
        }
        
        if (!fs.existsSync(this.queueFilePath)) {
            fs.writeFileSync(this.queueFilePath, JSON.stringify([]), 'utf8');
            console.log('📝 已創建隊列文件:', this.queueFilePath);
        }
    }
    
    // 讀取隊列
    readQueue() {
        try {
            const data = fs.readFileSync(this.queueFilePath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('❌ 讀取隊列失敗:', error);
            return [];
        }
    }
    
    // 寫入隊列
    writeQueue(queue) {
        try {
            fs.writeFileSync(this.queueFilePath, JSON.stringify(queue, null, 2), 'utf8');
        } catch (error) {
            console.error('❌ 寫入隊列失敗:', error);
        }
    }
    
    // 添加記錄到隊列（student_data.json 已在 server.js 中立即更新）
    async addToQueue(record) {
        const queue = this.readQueue();
        const newRecord = {
            ...record,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            retryCount: 0,
            status: 'pending',
            lastError: null
        };
        
        queue.push(newRecord);
        this.writeQueue(queue);
        
        console.log('📝 已添加到簽到隊列（僅處理 Google Sheets）:', {
            id: newRecord.id,
            student: newRecord.studentName,
            status: newRecord.attendanceStatus,
            hasPreviousState: !!newRecord.previousState
        });
        
        // 立即嘗試處理這筆記錄
        setTimeout(() => this.processQueue(), 100);
        
        return newRecord.id;
    }
    
    // 處理單筆記錄（只處理 Google Sheets，student_data.json 已在提交時立即更新）
    async processRecord(record) {
        console.log(`🔄 處理簽到記錄 - Google Sheets (第 ${record.retryCount + 1} 次嘗試):`, {
            id: record.id,
            student: record.studentName,
            status: record.attendanceStatus
        });
        
        try {
            // 只處理 Google Sheets（student_data.json 已在提交時立即更新）
            const sheetsResult = await this.updateGoogleSheets(record);
            
            if (sheetsResult.success) {
                console.log('✅ Google Sheets 更新成功:', record.id);
                this.logCourseHistory(record);
                return {
                    success: true,
                    sheetsSuccess: true
                };
            }
            
            throw new Error(sheetsResult.error || 'Google Sheets 更新失敗');
            
        } catch (error) {
            console.error('❌ Google Sheets 更新失敗:', error);
            throw error;
        }
    }
    
    // 回退 student_data.json（僅在持續失敗時調用）
    async rollbackStudentDataJson(record) {
        const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
        
        // 只有正式學生且有 previousState 才需要回退
        if (record.isTemporaryStudent || !record.previousState) {
            console.log('ℹ️ 無需回退 student_data.json');
            return { success: true, message: '無需回退' };
        }
        
        try {
            console.log('⏪ 回退 student_data.json:', {
                student: record.studentName,
                date: record.date
            });
            
            // 讀取並回退 student_data.json
            const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
            const student = studentData.students.find(s => s.name === record.studentName);
            
            if (!student) {
                throw new Error(`找不到學生: ${record.studentName}`);
            }
            
            // 回退出席記錄和剩餘堂數
            student.attendance = record.previousState.attendance;
            student.remaining = record.previousState.remaining;
            
            // 寫回檔案
            fs.writeFileSync(studentDataPath, JSON.stringify(studentData, null, 2), 'utf8');
            
            console.log('✅ student_data.json 已回退:', {
                student: record.studentName,
                remaining: student.remaining
            });
            
            return { success: true };
            
        } catch (error) {
            console.error('❌ 回退 student_data.json 失敗:', error);
            return { success: false, error: error.message };
        }
    }
    
    // 更新 Google Sheets
    async updateGoogleSheets(record) {
        const googleSheetsUrl = "https://script.google.com/macros/s/AKfycbxfj5fwNIc8ncbqkOm763yo6o06wYPHm2nbfd_1yLkHlakoS9FtYfYJhvGCaiAYh_vjIQ/dev";
        
        const payload = {
            action: "update",
            name: record.studentName,
            date: record.date,
            present: record.attendanceStatus === 'present'
        };
        
        console.log('📤 發送到 Google Sheets:', payload);
        
        const response = await axios.post(googleSheetsUrl, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000 // 10秒超時
        });
        
        console.log('✅ Google Sheets 更新成功:', response.data);
        
        return {
            success: true,
            data: response.data
        };
    }
    
    // 處理隊列
    async processQueue() {
        if (this.isProcessing) {
            console.log('⏳ 隊列正在處理中，跳過本次執行');
            return;
        }
        
        this.isProcessing = true;
        
        try {
            const queue = this.readQueue();
            const pendingRecords = queue.filter(r => r.status === 'pending' || r.status === 'retrying');
            
            if (pendingRecords.length === 0) {
                return;
            }
            
            console.log(`🔄 開始處理隊列，共 ${pendingRecords.length} 筆待處理記錄`);
            
            for (const record of pendingRecords) {
                try {
                    const result = await this.processRecord(record);
                    
                    if (result.success) {
                        // 成功：從隊列移除
                        this.removeFromQueue(record.id);
                        console.log('✅ 記錄處理成功並移除:', record.id);
                    }
                    
                } catch (error) {
                    // 失敗：增加重試次數
                    record.retryCount += 1;
                    record.lastError = error.message;
                    record.lastErrorDetails = error.details || {};
                    
                    if (record.retryCount >= this.maxRetries) {
                        // 達到最大重試次數：標記為失敗、回退 student_data.json 並通知管理員
                        record.status = 'failed';
                        this.updateQueueRecord(record);
                        
                        console.error(`❌ 記錄處理失敗，已重試 ${this.maxRetries} 次:`, {
                            id: record.id,
                            student: record.studentName,
                            error: error.message
                        });
                        
                        // 🔥 回退 student_data.json 並發送失敗通知給管理員
                        await this.notifyAdminFailure(record);
                        
                    } else {
                        // 繼續重試
                        record.status = 'retrying';
                        this.updateQueueRecord(record);
                        
                        console.log(`⚠️ 記錄處理失敗，將重試 (${record.retryCount}/${this.maxRetries}):`, {
                            id: record.id,
                            student: record.studentName
                        });
                    }
                }
            }
            
        } finally {
            this.isProcessing = false;
        }
    }

    logCourseHistory(record) {
        if (!this.courseHistoryLogger) {
            return;
        }
        if (record.attendanceStatus !== 'present') {
            return;
        }
        this.courseHistoryLogger.enqueueLog({
            studentName: record.studentName,
            courseName: record.courseNameForLog || record.course || record.courseName || '',
            courseCategory: record.courseCategory || record.courseType || '',
            courseTopic: record.courseTopic || '',
            date: record.date,
            teacher: record.teacher || '',
            courseTime: record.time || record.courseTime || '',
            lessonUrl: record.lessonUrl || '',
            eventId: record.eventId || '',
            source: 'queue',
            attendanceStatus: record.attendanceStatus
        });
    }
    
    // 更新隊列中的記錄
    updateQueueRecord(updatedRecord) {
        const queue = this.readQueue();
        const index = queue.findIndex(r => r.id === updatedRecord.id);
        
        if (index !== -1) {
            queue[index] = {
                ...queue[index],
                ...updatedRecord,
                updatedAt: new Date().toISOString()
            };
            this.writeQueue(queue);
        }
    }
    
    // 從隊列移除記錄
    removeFromQueue(recordId) {
        const queue = this.readQueue();
        const filtered = queue.filter(r => r.id !== recordId);
        this.writeQueue(filtered);
        console.log('🗑️ 已從隊列移除記錄:', recordId);
    }
    
    // 🔥 通知管理員失敗記錄（並回退 student_data.json）
    async notifyAdminFailure(record) {
        try {
            // 先回退 student_data.json（如果有 previousState）
            console.log('⏪ 嘗試回退 student_data.json...');
            const rollbackResult = await this.rollbackStudentDataJson(record);
            
            const rollbackMessage = rollbackResult.success 
                ? '\n⏪ student_data.json 已回退' 
                : '\n❌ student_data.json 回退失敗';
            
            const statusText = record.attendanceStatus === 'present' ? '出席' : '缺席';
            const message = `⚠️ 【簽到記錄保存失敗】

👤 學生：${record.studentName}
📚 課程：${record.course}
👨‍🏫 講師：${record.teacher}
⏰ 時間：${record.time}
📅 日期：${record.date}
✅ 狀態：${statusText}

❌ 錯誤：${record.lastError}
🔄 重試次數：${record.retryCount} 次
📝 記錄ID：${record.id}${rollbackMessage}

請盡快手動處理此記錄！`;
            
            // 從 notification-config.json 讀取正職群組 ID
            let staffGroupId = 'C9cd9530405411fdd46de96f4e6cdecb7'; // 預設值
            try {
                const configPath = path.join(__dirname, 'notification-config.json');
                if (fs.existsSync(configPath)) {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                    staffGroupId = config?.roles?.admin?.group_id || staffGroupId;
                }
            } catch (error) {
                console.error('❌ 讀取正職群組 ID 失敗，使用預設值:', error);
            }
            
            if (this.notificationManager) {
                await this.notificationManager.sendGroupNotification(staffGroupId, message);
                console.log('📧 已發送失敗通知給管理員');
            } else {
                console.error('❌ NotificationManager 未初始化，無法發送通知');
            }
            
        } catch (error) {
            console.error('❌ 發送失敗通知時發生錯誤:', error);
        }
    }
    
    // 啟動背景處理器
    startBackgroundProcessor() {
        // 每30秒檢查一次隊列
        setInterval(() => {
            // 🚀 只在有待處理項目時才輸出日誌（減少日誌噪音）
            const queue = this.readQueue();
            const pendingRecords = queue.filter(r => r.status === 'pending' || r.status === 'retrying');
            
            if (pendingRecords.length > 0) {
                console.log(`⏰ 定時檢查簽到隊列... (待處理: ${pendingRecords.length})`);
            }
            
            this.processQueue().catch(error => {
                console.error('❌ 處理隊列時發生錯誤:', error);
            });
        }, 30000); // 30秒
        
        console.log('✅ 背景處理器已啟動（每30秒執行一次，僅在有待處理項目時輸出日誌）');
    }
    
    // 獲取隊列統計
    getQueueStats() {
        const queue = this.readQueue();
        return {
            total: queue.length,
            pending: queue.filter(r => r.status === 'pending').length,
            retrying: queue.filter(r => r.status === 'retrying').length,
            failed: queue.filter(r => r.status === 'failed').length
        };
    }
}

module.exports = AttendanceQueueManager;
