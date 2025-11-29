/**
 * 🌐 Webhook Routes - LINE Webhook 路由
 * 
 * 處理 LINE Webhook 事件、Quick Reply、Postback
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const WebhookHandler = require('./handlers/webhookHandler');
const { asyncHandler } = require('./middleware/errorHandler');
const { verifyAdminToken } = require('./middleware/auth');

/**
 * 初始化 Webhook 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initWebhookRoutes(services = {}) {
    const router = express.Router();
    const handler = new WebhookHandler(services);

    // ==================== LINE Webhook ====================

    /**
     * POST /api/v2/webhook
     * 處理 LINE Webhook
     * 注意：此端點不需要 admin token，因為是 LINE 平台調用
     */
    router.post('/',
        asyncHandler(handler.handleWebhook.bind(handler))
    );

    /**
     * POST /api/v2/webhook/line
     * 處理 LINE Webhook (別名)
     */
    router.post('/line',
        asyncHandler(handler.handleWebhook.bind(handler))
    );

    // ==================== 管理功能 ====================

    /**
     * GET /api/v2/webhook/stats
     * 取得 Webhook 統計
     */
    router.get('/stats',
        verifyAdminToken,
        asyncHandler(handler.getStats.bind(handler))
    );

    /**
     * POST /api/v2/webhook/test
     * 測試 Webhook
     */
    router.post('/test',
        verifyAdminToken,
        asyncHandler(handler.testWebhook.bind(handler))
    );

    console.log('✅ [Webhook] Webhook 路由已初始化');
    return router;
}

module.exports = initWebhookRoutes;
