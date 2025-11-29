/**
 * ⚙️ System Handler - 系統狀態管理業務邏輯
 * 
 * 處理系統健康檢查、日誌、快取管理等功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const fs = require('fs');
const path = require('path');

class SystemHandler {
    constructor(services = {}) {
        this.reminderScheduler = services.reminderScheduler;
        this.eventsCache = services.eventsCache;
        this.notionCourseSyncManager = services.notionCourseSyncManager;
    }

    /**
     * 🏥 健康檢查
     */
    async getHealth() {
        return {
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version
        };
    }

    /**
     * 🕐 取得系統時間
     */
    async getSystemTime() {
        try {
            const now = new Date();
            const utcTime = now.toISOString();
            
            // 台北時間 (UTC+8)
            const taipeiTime = new Date(now.getTime() + (8 * 60 * 60 * 1000))
                .toISOString()
                .replace('T', ' ')
                .substring(0, 19);
            
            const timestamp = now.getTime();

            return {
                success: true,
                data: {
                    utc: utcTime,
                    taipei: taipeiTime,
                    timestamp: timestamp,
                    timezone: 'Asia/Taipei',
                    offset: '+08:00'
                }
            };
        } catch (error) {
            console.error('❌ [SystemHandler] 取得系統時間失敗:', error);
            throw error;
        }
    }

    /**
     * 📊 取得系統狀態
     */
    async getSystemStatus() {
        try {
            const studentDataPath = path.join(__dirname, '../../public', 'student_data.json');
            const studentDataExists = fs.existsSync(studentDataPath);

            let studentCount = 0;
            if (studentDataExists) {
                try {
                    const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
                    studentCount = Object.keys(studentData).length;
                } catch (err) {
                    console.error('❌ [SystemHandler] 讀取學生資料失敗:', err);
                }
            }

            // 事件快取狀態
            const eventsCacheStatus = this.eventsCache ? {
                hasData: !!this.eventsCache.data,
                eventCount: this.eventsCache.data ? Object.keys(this.eventsCache.data).length : 0,
                lastUpdate: this.eventsCache.lastUpdate
            } : null;

            return {
                success: true,
                data: {
                    studentData: {
                        exists: studentDataExists,
                        count: studentCount
                    },
                    eventsCache: eventsCacheStatus,
                    memory: process.memoryUsage(),
                    uptime: process.uptime(),
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            console.error('❌ [SystemHandler] 取得系統狀態失敗:', error);
            throw error;
        }
    }

    /**
     * 📝 取得系統日誌
     */
    async getLogs(limit = 100) {
        try {
            const remindersData = this.reminderScheduler ? 
                this.reminderScheduler.loadReminders() : 
                { autoReminders: [], manualReminders: [] };

            const logs = {
                autoReminders: remindersData.autoReminders || [],
                manualReminders: remindersData.manualReminders || [],
                timestamp: new Date().toISOString(),
                total: (remindersData.autoReminders?.length || 0) + (remindersData.manualReminders?.length || 0)
            };

            return {
                success: true,
                data: logs
            };
        } catch (error) {
            console.error('❌ [SystemHandler] 取得系統日誌失敗:', error);
            throw error;
        }
    }

    /**
     * 🗑️ 清除所有快取
     */
    async clearAllCache() {
        try {
            if (this.eventsCache) {
                this.eventsCache.data = null;
                this.eventsCache.lastUpdate = null;
            }

            console.log('✅ [SystemHandler] 所有快取已清除');

            return {
                success: true,
                message: '所有快取已清除',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            console.error('❌ [SystemHandler] 清除快取失敗:', error);
            throw error;
        }
    }

    /**
     * 📋 取得 Notion 課程同步日誌
     */
    async getNotionCourseSyncLogs(limit = 100) {
        try {
            if (!this.notionCourseSyncManager) {
                throw new Error('Notion 課程同步管理器未初始化');
            }

            const logs = await this.notionCourseSyncManager.getLogs(limit);

            return {
                success: true,
                data: logs,
                limit
            };
        } catch (error) {
            console.error('❌ [SystemHandler] 取得 Notion 同步日誌失敗:', error);
            throw error;
        }
    }

    /**
     * 📊 取得完整系統資訊（除錯用）
     */
    async getFullSystemInfo() {
        try {
            const health = await this.getHealth();
            const systemTime = await this.getSystemTime();
            const systemStatus = await this.getSystemStatus();

            return {
                success: true,
                data: {
                    health: health.data || health,
                    time: systemTime.data,
                    status: systemStatus.data,
                    node: {
                        version: process.version,
                        platform: process.platform,
                        arch: process.arch,
                        env: process.env.NODE_ENV || 'development'
                    }
                }
            };
        } catch (error) {
            console.error('❌ [SystemHandler] 取得系統資訊失敗:', error);
            throw error;
        }
    }
}

module.exports = SystemHandler;
