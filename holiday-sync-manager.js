/**
 * 假日同步管理器
 * 功能：定期從遠端同步台灣假日資料
 * 版本：2024-10-26
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const schedule = require('node-schedule');

class HolidaySyncManager {
    constructor() {
        this.cacheFile = path.join(__dirname, 'data', 'holidays-cache.json');
        this.remoteUrl = 'https://course-viewer.funlearnbar.synology.me/config/holidays.json';
        this.syncJob = null;
        this.cache = null;
        this.lastSyncTime = null;
        this.isSyncing = false; // 🚀 防止重複同步
        
        // 確保 data 目錄存在
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
        
        // 初始化時載入快取
        this.loadCache();
    }
    
    /**
     * 從本地檔案載入快取
     */
    loadCache() {
        try {
            if (fs.existsSync(this.cacheFile)) {
                const data = fs.readFileSync(this.cacheFile, 'utf8');
                const parsed = JSON.parse(data);
                this.cache = parsed.data;
                this.lastSyncTime = parsed.lastSyncTime;
                console.log(`✅ [假日同步] 已載入本地快取 (${this.cache?.holidays?.length || 0} 個假日)`);
                console.log(`📅 [假日同步] 上次同步時間: ${this.lastSyncTime || '未知'}`);
            } else {
                console.log('⚠️ [假日同步] 本地快取不存在，將進行首次同步');
            }
        } catch (error) {
            console.error('❌ [假日同步] 載入本地快取失敗:', error);
            this.cache = null;
        }
    }
    
    /**
     * 同步假日資料
     */
    async syncHolidays() {
        // 🚀 防止重複同步
        if (this.isSyncing) {
            console.log('⏳ [假日同步] 同步進行中，跳過');
            return { success: false, message: '同步進行中' };
        }
        
        this.isSyncing = true;
        
        try {
            console.log('🔄 [假日同步] 開始同步假日資料...');
            
            const response = await axios.get(this.remoteUrl, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'FLB-Calendar-System/1.0'
                }
            });
            
            if (response.status === 200 && response.data) {
                const holidayData = response.data;
                
                // 驗證資料格式
                if (!holidayData.holidays || !Array.isArray(holidayData.holidays)) {
                    throw new Error('假日資料格式不正確');
                }
                
                // 儲存到快取
                this.cache = holidayData;
                this.lastSyncTime = new Date().toISOString();
                
                const cacheData = {
                    data: holidayData,
                    lastSyncTime: this.lastSyncTime,
                    syncedAt: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
                };
                
                // 🚀 改用異步寫入（避免阻塞）
                await fs.promises.writeFile(this.cacheFile, JSON.stringify(cacheData, null, 2), 'utf8');
                
                console.log(`✅ [假日同步] 同步成功！共 ${holidayData.holidays.length} 個假日`);
                console.log(`📅 [假日同步] 涵蓋年份: ${holidayData.year || '未指定'}`);
                console.log(`💾 [假日同步] 已儲存至: ${this.cacheFile}`);
                
                return {
                    success: true,
                    count: holidayData.holidays.length,
                    year: holidayData.year,
                    syncTime: this.lastSyncTime
                };
            } else {
                throw new Error(`HTTP 狀態碼: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ [假日同步] 同步失敗:', error.message);
            
            // 如果有本地快取，繼續使用
            if (this.cache) {
                console.log('⚠️ [假日同步] 使用本地快取資料');
                return {
                    success: false,
                    error: error.message,
                    usingCache: true,
                    cacheCount: this.cache.holidays?.length || 0
                };
            }
            
            return {
                success: false,
                error: error.message,
                usingCache: false
            };
        } finally {
            // 🚀 確保釋放同步鎖
            this.isSyncing = false;
        }
    }
    
    /**
     * 取得假日資料
     */
    getHolidays() {
        if (!this.cache) {
            // 🔧 開發模式：不觸發背景同步，僅返回空資料
            if (process.env.DISABLE_AUTO_REMINDERS === 'true') {
                console.log('⚠️ [假日同步] 快取為空（開發模式），請手動執行 /api/sync-holidays');
            } else {
                // 🚀 生產環境：只在未同步時觸發一次背景同步（避免頻繁調用）
                if (!this.isSyncing && !this.lastSyncTime) {
                    console.log('⚠️ [假日同步] 首次載入，觸發背景同步...');
                    this.syncHolidays().catch(err => {
                        console.error('❌ [假日同步] 背景同步失敗:', err);
                    });
                }
            }
            return {
                holidays: [],
                enabledDates: [],
                year: new Date().getFullYear(),
                customHolidays: []
            };
        }
        
        return this.cache;
    }
    
    /**
     * 檢查指定日期是否為假日
     * @param {string} dateStr - 日期字串 (YYYY-MM-DD)
     * @returns {object|null} 假日資訊或 null
     */
    isHoliday(dateStr) {
        if (!this.cache || !this.cache.holidays) {
            return null;
        }
        
        const holiday = this.cache.holidays.find(h => h.date === dateStr);
        return holiday || null;
    }
    
    /**
     * 取得指定月份的所有假日
     * @param {number} year - 年份
     * @param {number} month - 月份 (1-12)
     * @returns {array} 假日列表
     */
    getHolidaysInMonth(year, month) {
        if (!this.cache || !this.cache.holidays) {
            return [];
        }
        
        const monthStr = String(month).padStart(2, '0');
        const prefix = `${year}-${monthStr}`;
        
        return this.cache.holidays.filter(h => h.date.startsWith(prefix));
    }
    
    /**
     * 啟動定期同步任務
     * @param {string} cronSchedule - Cron 表達式 (預設：每天凌晨 3 點) - 不建議使用，請使用 scheduleOptions
     * @param {Object} scheduleOptions - 排程選項物件 (推薦使用，支援時區設定)
     */
    startScheduledSync(cronSchedule = '0 3 * * *', scheduleOptions = null) {
        // 🔧 開發環境控制：禁用自動同步
        if (process.env.DISABLE_AUTO_REMINDERS === 'true') {
            console.log('⚠️ [假日同步] 已禁用自動同步（開發模式）');
            console.log('   手動 API 仍可使用：/api/sync-holidays');
            return;
        }

        if (this.syncJob) {
            console.log('⚠️ [假日同步] 定期同步任務已在運行');
            return;
        }
        
        // 立即執行一次同步
        this.syncHolidays().then(result => {
            console.log('🎯 [假日同步] 初始同步完成:', result);
        }).catch(err => {
            console.error('❌ [假日同步] 初始同步失敗:', err);
        });
        
        // 設定定期同步 (預設每天凌晨 3 點，使用台灣時區)
        const scheduleConfig = scheduleOptions || { hour: 3, minute: 0, tz: 'Asia/Taipei' };
        this.syncJob = schedule.scheduleJob(scheduleConfig, async () => {
            console.log('⏰ [假日同步] 執行定期同步... (台灣時間)');
            await this.syncHolidays();
        });
        
        const scheduleDesc = scheduleOptions ? 
            `{ hour: ${scheduleConfig.hour}, minute: ${scheduleConfig.minute}, tz: ${scheduleConfig.tz} }` : 
            cronSchedule;
        console.log(`✅ [假日同步] 定期同步任務已啟動 (排程: ${scheduleDesc})`);
        console.log('📅 [假日同步] 下次同步時間:', this.syncJob.nextInvocation().toString());
    }
    
    /**
     * 停止定期同步任務
     */
    stopScheduledSync() {
        if (this.syncJob) {
            this.syncJob.cancel();
            this.syncJob = null;
            console.log('✅ [假日同步] 定期同步任務已停止');
        }
    }
    
    /**
     * 取得同步狀態
     */
    getStatus() {
        return {
            hasCache: !!this.cache,
            holidayCount: this.cache?.holidays?.length || 0,
            year: this.cache?.year || null,
            lastSyncTime: this.lastSyncTime,
            isScheduled: !!this.syncJob,
            nextSync: this.syncJob ? this.syncJob.nextInvocation().toString() : null
        };
    }
}

module.exports = HolidaySyncManager;

