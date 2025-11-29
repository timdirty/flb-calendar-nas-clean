/**
 * 🔔 Notifications Routes - 通知管理路由
 * 
 * 提供通知發送、Flex Message 管理功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const NotificationsHandler = require('./handlers/notificationsHandler');
const { asyncHandler } = require('./middleware/errorHandler');
const { verifyAdminToken } = require('./middleware/auth');

/**
 * 初始化 Notifications 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initNotificationsRoutes(services = {}) {
    const router = express.Router();
    const handler = new NotificationsHandler(services);

    // ==================== 發送通知 ====================

    /**
     * POST /api/v2/notifications/send
     * 發送通知
     */
    router.post('/send',
        verifyAdminToken,
        asyncHandler(handler.sendNotification.bind(handler))
    );

    /**
     * POST /api/v2/notifications/send-batch
     * 批次發送通知
     */
    router.post('/send-batch',
        verifyAdminToken,
        asyncHandler(handler.sendBatchNotifications.bind(handler))
    );

    /**
     * POST /api/v2/notifications/send-flex
     * 發送 Flex Message
     */
    router.post('/send-flex',
        verifyAdminToken,
        asyncHandler(handler.sendFlexMessage.bind(handler))
    );

    // ==================== Flex Message 管理 ====================

    /**
     * GET /api/v2/notifications/flex-templates
     * 取得 Flex Message 範本列表
     */
    router.get('/flex-templates',
        verifyAdminToken,
        asyncHandler(handler.getFlexTemplates.bind(handler))
    );

    /**
     * GET /api/v2/notifications/flex-templates/:templateId
     * 取得指定 Flex Message 範本
     */
    router.get('/flex-templates/:templateId',
        verifyAdminToken,
        asyncHandler(handler.getFlexTemplate.bind(handler))
    );

    /**
     * PUT /api/v2/notifications/flex-templates/:templateId
     * 更新 Flex Message 範本
     */
    router.put('/flex-templates/:templateId',
        verifyAdminToken,
        asyncHandler(handler.updateFlexTemplate.bind(handler))
    );

    // ==================== 資料查詢 ====================

    /**
     * GET /api/v2/notifications/history
     * 取得發送歷史
     * Query: ?limit=50&offset=0
     */
    router.get('/history',
        verifyAdminToken,
        asyncHandler(handler.getHistory.bind(handler))
    );

    /**
     * GET /api/v2/notifications/stats
     * 取得統計資訊
     */
    router.get('/stats',
        verifyAdminToken,
        asyncHandler(handler.getStats.bind(handler))
    );

    console.log('✅ [Notifications] Notifications 路由已初始化');
    return router;
}

module.exports = initNotificationsRoutes;
