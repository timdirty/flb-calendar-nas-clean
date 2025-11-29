/**
 * 📢 Reminders Routes - 提醒管理路由
 * 
 * 提供課程提醒、排程管理、提醒設定功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const RemindersHandler = require('./handlers/remindersHandler');
const { asyncHandler } = require('./middleware/errorHandler');
const { verifyAdminToken } = require('./middleware/auth');

/**
 * 初始化 Reminders 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initRemindersRoutes(services = {}) {
    const router = express.Router();
    const handler = new RemindersHandler(services);

    // ==================== 設定管理 ====================

    /**
     * GET /api/v2/reminders/settings
     * 取得提醒設定
     */
    router.get('/settings',
        verifyAdminToken,
        asyncHandler(handler.getSettings.bind(handler))
    );

    /**
     * POST /api/v2/reminders/settings
     * 更新提醒設定
     */
    router.post('/settings',
        verifyAdminToken,
        asyncHandler(handler.updateSettings.bind(handler))
    );

    // ==================== 排程管理 ====================

    /**
     * GET /api/v2/reminders/schedule/status
     * 取得排程狀態
     */
    router.get('/schedule/status',
        verifyAdminToken,
        asyncHandler(handler.getScheduleStatus.bind(handler))
    );

    /**
     * POST /api/v2/reminders/schedule/start
     * 啟動排程
     */
    router.post('/schedule/start',
        verifyAdminToken,
        asyncHandler(handler.startSchedule.bind(handler))
    );

    /**
     * POST /api/v2/reminders/schedule/stop
     * 停止排程
     */
    router.post('/schedule/stop',
        verifyAdminToken,
        asyncHandler(handler.stopSchedule.bind(handler))
    );

    // ==================== 提醒操作 ====================

    /**
     * POST /api/v2/reminders/trigger
     * 手動觸發提醒
     */
    router.post('/trigger',
        verifyAdminToken,
        asyncHandler(handler.triggerReminder.bind(handler))
    );

    /**
     * POST /api/v2/reminders/test
     * 測試提醒
     */
    router.post('/test',
        verifyAdminToken,
        asyncHandler(handler.testReminder.bind(handler))
    );

    // ==================== 資料查詢 ====================

    /**
     * GET /api/v2/reminders/history
     * 取得提醒歷史
     * Query: ?limit=50&offset=0
     */
    router.get('/history',
        verifyAdminToken,
        asyncHandler(handler.getHistory.bind(handler))
    );

    /**
     * DELETE /api/v2/reminders/history
     * 清除提醒歷史
     */
    router.delete('/history',
        verifyAdminToken,
        asyncHandler(handler.clearHistory.bind(handler))
    );

    /**
     * GET /api/v2/reminders/pending
     * 取得即將發送的提醒
     */
    router.get('/pending',
        verifyAdminToken,
        asyncHandler(handler.getPendingReminders.bind(handler))
    );

    /**
     * GET /api/v2/reminders/stats
     * 取得統計資訊
     */
    router.get('/stats',
        verifyAdminToken,
        asyncHandler(handler.getStats.bind(handler))
    );

    console.log('✅ [Reminders] Reminders 路由已初始化');
    return router;
}

module.exports = initRemindersRoutes;
