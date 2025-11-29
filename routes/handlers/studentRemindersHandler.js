/**
 * 👤 Student Reminders Handler - 學生提醒管理業務邏輯
 * 
 * 處理學生提醒設定、批次提醒
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createInternalError, createBusinessError } = require('../middleware/errorHandler');
const fs = require('fs');
const path = require('path');

class StudentRemindersHandler {
    constructor(services = {}) {
        this.notificationManager = services.notificationManager;
        this.SETTINGS_PATH = path.join(process.cwd(), 'student-reminder-settings.json');
    }

    /**
     * 取得學生提醒設定
     */
    async getSettings(req, res, next) {
        try {
            let settings = {};
            if (fs.existsSync(this.SETTINGS_PATH)) {
                settings = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf8'));
            }

            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('❌ 取得學生提醒設定失敗:', error);
            next(createInternalError('取得學生提醒設定失敗', { originalError: error.message }));
        }
    }

    /**
     * 更新學生提醒設定
     */
    async updateSettings(req, res, next) {
        try {
            const newSettings = req.body;

            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(newSettings, null, 2), 'utf8');

            res.json({
                success: true,
                message: '學生提醒設定已更新',
                data: newSettings
            });
        } catch (error) {
            console.error('❌ 更新學生提醒設定失敗:', error);
            next(createInternalError('更新學生提醒設定失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得學生提醒設定（按學生）
     */
    async getStudentSettings(req, res, next) {
        try {
            const { studentId } = req.params;

            let settings = {};
            if (fs.existsSync(this.SETTINGS_PATH)) {
                const allSettings = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf8'));
                settings = allSettings[studentId] || {};
            }

            res.json({
                success: true,
                data: settings
            });
        } catch (error) {
            console.error('❌ 取得學生提醒設定失敗:', error);
            next(createInternalError('取得學生提醒設定失敗', { originalError: error.message }));
        }
    }

    /**
     * 更新學生提醒設定（按學生）
     */
    async updateStudentSettings(req, res, next) {
        try {
            const { studentId } = req.params;
            const studentSettings = req.body;

            let allSettings = {};
            if (fs.existsSync(this.SETTINGS_PATH)) {
                allSettings = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf8'));
            }

            allSettings[studentId] = studentSettings;

            fs.writeFileSync(this.SETTINGS_PATH, JSON.stringify(allSettings, null, 2), 'utf8');

            res.json({
                success: true,
                message: '學生提醒設定已更新',
                data: studentSettings
            });
        } catch (error) {
            console.error('❌ 更新學生提醒設定失敗:', error);
            next(createInternalError('更新學生提醒設定失敗', { originalError: error.message }));
        }
    }

    /**
     * 發送學生提醒
     */
    async sendStudentReminder(req, res, next) {
        try {
            const { studentId, message, type } = req.body;

            if (!studentId || !message) {
                return next(createBusinessError('缺少必要參數：studentId, message'));
            }

            if (!this.notificationManager) {
                return next(createBusinessError('通知服務未啟用'));
            }

            // 從設定檔取得學生的 LINE userId
            let settings = {};
            if (fs.existsSync(this.SETTINGS_PATH)) {
                settings = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf8'));
            }

            const studentSettings = settings[studentId];
            if (!studentSettings || !studentSettings.lineUserId) {
                return next(createBusinessError('學生未設定 LINE'));
            }

            await this.notificationManager.sendMessage(studentSettings.lineUserId, message, type);

            res.json({
                success: true,
                message: '學生提醒已發送'
            });
        } catch (error) {
            console.error('❌ 發送學生提醒失敗:', error);
            next(createInternalError('發送學生提醒失敗', { originalError: error.message }));
        }
    }

    /**
     * 批次發送學生提醒
     */
    async sendBatchStudentReminders(req, res, next) {
        try {
            const { studentIds, message, type } = req.body;

            if (!studentIds || !Array.isArray(studentIds) || !message) {
                return next(createBusinessError('缺少必要參數：studentIds (陣列), message'));
            }

            if (!this.notificationManager) {
                return next(createBusinessError('通知服務未啟用'));
            }

            let settings = {};
            if (fs.existsSync(this.SETTINGS_PATH)) {
                settings = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf8'));
            }

            const results = [];
            for (const studentId of studentIds) {
                const studentSettings = settings[studentId];
                if (!studentSettings || !studentSettings.lineUserId) {
                    results.push({ studentId, success: false, error: '未設定 LINE' });
                    continue;
                }

                try {
                    await this.notificationManager.sendMessage(studentSettings.lineUserId, message, type);
                    results.push({ studentId, success: true });
                } catch (err) {
                    results.push({ studentId, success: false, error: err.message });
                }
            }

            res.json({
                success: true,
                message: '批次學生提醒已發送',
                data: {
                    total: studentIds.length,
                    successful: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                    results
                }
            });
        } catch (error) {
            console.error('❌ 批次發送學生提醒失敗:', error);
            next(createInternalError('批次發送學生提醒失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得學生列表
     */
    async getStudentList(req, res, next) {
        try {
            let settings = {};
            if (fs.existsSync(this.SETTINGS_PATH)) {
                settings = JSON.parse(fs.readFileSync(this.SETTINGS_PATH, 'utf8'));
            }

            const students = Object.keys(settings).map(studentId => ({
                studentId,
                ...settings[studentId]
            }));

            res.json({
                success: true,
                data: {
                    students,
                    count: students.length
                }
            });
        } catch (error) {
            console.error('❌ 取得學生列表失敗:', error);
            next(createInternalError('取得學生列表失敗', { originalError: error.message }));
        }
    }
}

module.exports = StudentRemindersHandler;
