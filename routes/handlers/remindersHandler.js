/**
 * 📢 Reminders Handler - 提醒管理業務邏輯
 * 
 * 處理課程提醒、排程管理、提醒設定
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createInternalError, createBusinessError } = require('../middleware/errorHandler');

class RemindersHandler {
    constructor(services = {}) {
        this.reminderScheduler = services.reminderScheduler;
        this.notificationManager = services.notificationManager;
    }

    /**
     * 取得提醒設定
     */
    async getSettings(req, res, next) {
        try {
            if (!this.reminderScheduler) {
                return res.json({
                    success: true,
                    data: {
                        enabled: false,
                        message: '提醒服務未啟用'
                    }
                });
            }

            const settings = this.reminderScheduler.getSettings ? 
                this.reminderScheduler.getSettings() : 
                { enabled: false };

            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('❌ 取得提醒設定失敗:', error);
            next(createInternalError('取得提醒設定失敗', { originalError: error.message }));
        }
    }

    /**
     * 更新提醒設定
     */
    async updateSettings(req, res, next) {
        try {
            const newSettings = req.body;

            if (!this.reminderScheduler) {
                return next(createBusinessError('提醒服務未啟用'));
            }

            if (typeof this.reminderScheduler.updateSettings !== 'function') {
                return next(createBusinessError('不支援更新設定功能'));
            }

            await this.reminderScheduler.updateSettings(newSettings);

            res.json({
                success: true,
                message: '提醒設定已更新',
                data: newSettings
            });
        } catch (error) {
            console.error('❌ 更新提醒設定失敗:', error);
            next(createInternalError('更新提醒設定失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得排程狀態
     */
    async getScheduleStatus(req, res, next) {
        try {
            if (!this.reminderScheduler) {
                return res.json({
                    success: true,
                    data: {
                        enabled: false,
                        message: '提醒服務未啟用'
                    }
                });
            }

            const status = {
                enabled: true,
                isRunning: this.reminderScheduler.isRunning || false,
                nextRun: this.reminderScheduler.nextRun || null,
                lastRun: this.reminderScheduler.lastRun || null
            };

            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('❌ 取得排程狀態失敗:', error);
            next(createInternalError('取得排程狀態失敗', { originalError: error.message }));
        }
    }

    /**
     * 啟動排程
     */
    async startSchedule(req, res, next) {
        try {
            if (!this.reminderScheduler) {
                return next(createBusinessError('提醒服務未啟用'));
            }

            if (typeof this.reminderScheduler.start === 'function') {
                await this.reminderScheduler.start();
            }

            res.json({
                success: true,
                message: '提醒排程已啟動'
            });
        } catch (error) {
            console.error('❌ 啟動排程失敗:', error);
            next(createInternalError('啟動排程失敗', { originalError: error.message }));
        }
    }

    /**
     * 停止排程
     */
    async stopSchedule(req, res, next) {
        try {
            if (!this.reminderScheduler) {
                return next(createBusinessError('提醒服務未啟用'));
            }

            if (typeof this.reminderScheduler.stop === 'function') {
                await this.reminderScheduler.stop();
            }

            res.json({
                success: true,
                message: '提醒排程已停止'
            });
        } catch (error) {
            console.error('❌ 停止排程失敗:', error);
            next(createInternalError('停止排程失敗', { originalError: error.message }));
        }
    }

    /**
     * 手動觸發提醒
     */
    async triggerReminder(req, res, next) {
        try {
            const { courseId, type } = req.body;

            if (!courseId) {
                return next(createBusinessError('缺少必要參數：courseId'));
            }

            if (!this.reminderScheduler) {
                return next(createBusinessError('提醒服務未啟用'));
            }

            if (typeof this.reminderScheduler.sendReminder !== 'function') {
                return next(createBusinessError('不支援手動觸發功能'));
            }

            await this.reminderScheduler.sendReminder(courseId, type);

            res.json({
                success: true,
                message: '提醒已發送'
            });
        } catch (error) {
            console.error('❌ 觸發提醒失敗:', error);
            next(createInternalError('觸發提醒失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得提醒歷史
     */
    async getHistory(req, res, next) {
        try {
            const { limit = 50, offset = 0 } = req.query;

            if (!this.reminderScheduler) {
                return res.json({
                    success: true,
                    data: {
                        history: [],
                        total: 0
                    }
                });
            }

            const history = this.reminderScheduler.getHistory ? 
                await this.reminderScheduler.getHistory(parseInt(limit), parseInt(offset)) : 
                [];

            res.json({
                success: true,
                data: {
                    history: history,
                    total: history.length,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });
        } catch (error) {
            console.error('❌ 取得提醒歷史失敗:', error);
            next(createInternalError('取得提醒歷史失敗', { originalError: error.message }));
        }
    }

    /**
     * 清除提醒歷史
     */
    async clearHistory(req, res, next) {
        try {
            if (!this.reminderScheduler) {
                return next(createBusinessError('提醒服務未啟用'));
            }

            if (typeof this.reminderScheduler.clearHistory === 'function') {
                await this.reminderScheduler.clearHistory();
            }

            res.json({
                success: true,
                message: '提醒歷史已清除'
            });
        } catch (error) {
            console.error('❌ 清除提醒歷史失敗:', error);
            next(createInternalError('清除提醒歷史失敗', { originalError: error.message }));
        }
    }

    /**
     * 測試提醒
     */
    async testReminder(req, res, next) {
        try {
            const { recipient, message } = req.body;

            if (!recipient || !message) {
                return next(createBusinessError('缺少必要參數：recipient, message'));
            }

            if (!this.notificationManager) {
                return next(createBusinessError('通知服務未啟用'));
            }

            // 發送測試通知
            if (typeof this.notificationManager.sendMessage === 'function') {
                await this.notificationManager.sendMessage(recipient, message);
            }

            res.json({
                success: true,
                message: '測試提醒已發送'
            });
        } catch (error) {
            console.error('❌ 測試提醒失敗:', error);
            next(createInternalError('測試提醒失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得即將發送的提醒
     */
    async getPendingReminders(req, res, next) {
        try {
            if (!this.reminderScheduler) {
                return res.json({
                    success: true,
                    data: {
                        pending: [],
                        count: 0
                    }
                });
            }

            const pending = this.reminderScheduler.getPendingReminders ? 
                await this.reminderScheduler.getPendingReminders() : 
                [];

            res.json({
                success: true,
                data: {
                    pending: pending,
                    count: pending.length
                }
            });
        } catch (error) {
            console.error('❌ 取得待發送提醒失敗:', error);
            next(createInternalError('取得待發送提醒失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得統計資訊
     */
    async getStats(req, res, next) {
        try {
            if (!this.reminderScheduler) {
                return res.json({
                    success: true,
                    data: {
                        enabled: false,
                        total: 0,
                        sent: 0,
                        failed: 0
                    }
                });
            }

            const stats = this.reminderScheduler.getStats ? 
                await this.reminderScheduler.getStats() : 
                { total: 0, sent: 0, failed: 0 };

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('❌ 取得統計資訊失敗:', error);
            next(createInternalError('取得統計資訊失敗', { originalError: error.message }));
        }
    }
}

module.exports = RemindersHandler;
