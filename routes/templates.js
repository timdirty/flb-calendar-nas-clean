/**
 * 📋 Templates Routes - 範本管理路由
 * 
 * 提供範本配置和 Flex Message 範本的 CRUD 操作
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const TemplateHandler = require('./handlers/templateHandler');
const { asyncHandler } = require('./middleware/errorHandler');

/**
 * 初始化 Templates 路由
 * @param {Object} notificationManager - 通知管理器實例
 * @returns {Router} Express 路由實例
 */
function initTemplatesRoutes(notificationManager) {
    const router = express.Router();
    const handler = new TemplateHandler(notificationManager);

    // ==================== 範本設定 API ====================

    /**
     * GET /api/v2/templates
     * 取得所有範本設定
     */
    router.get('/', asyncHandler(async (req, res) => {
        console.log('📋 [Templates] 取得範本設定');
        
        const result = await handler.getTemplates();
        res.json(result);
    }));

    /**
     * POST /api/v2/templates
     * 儲存範本設定
     */
    router.post('/', asyncHandler(async (req, res) => {
        console.log('💾 [Templates] 儲存範本設定');
        
        const { templates } = req.body;
        const result = await handler.saveTemplates(templates);
        res.json(result);
    }));

    // ==================== Flex Message 範本 API ====================

    /**
     * GET /api/v2/flex-templates
     * 取得 Flex Message 範本
     */
    router.get('/flex-templates', asyncHandler(async (req, res) => {
        console.log('📄 [Templates] 取得 Flex Message 範本');
        
        const result = await handler.getFlexTemplates();
        res.json(result);
    }));

    /**
     * POST /api/v2/flex-templates
     * 儲存 Flex Message 範本
     */
    router.post('/flex-templates', asyncHandler(async (req, res) => {
        console.log('💾 [Templates] 儲存 Flex Message 範本');
        
        const result = await handler.saveFlexTemplates(req.body);
        res.json(result);
    }));

    /**
     * POST /api/v2/flex-templates/reload
     * 重新載入 Flex Message 範本
     */
    router.post('/flex-templates/reload', asyncHandler(async (req, res) => {
        console.log('🔄 [Templates] 重新載入 Flex Message 範本');
        
        const result = await handler.reloadFlexTemplates();
        res.json(result);
    }));

    /**
     * POST /api/v2/flex-templates/:type/send-test
     * 測試發送特定 Flex 範本
     */
    router.post('/flex-templates/:type/send-test', asyncHandler(async (req, res) => {
        const { type } = req.params;
        console.log(`📤 [Templates] 測試發送 Flex 範本: ${type}`);
        
        const result = await handler.sendTestFlexTemplate(type, req.body);
        res.json(result);
    }));

    console.log('✅ [Templates] Templates 路由已初始化');
    return router;
}

module.exports = initTemplatesRoutes;
