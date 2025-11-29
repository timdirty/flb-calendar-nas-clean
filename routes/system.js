/**
 * ⚙️ System Routes - 系統狀態管理路由
 * 
 * 提供健康檢查、日誌查詢、快取管理等系統功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const SystemHandler = require('./handlers/systemHandler');
const { asyncHandler } = require('./middleware/errorHandler');

/**
 * 初始化 System 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initSystemRoutes(services = {}) {
    const router = express.Router();
    const handler = new SystemHandler(services);

    // ==================== 健康檢查 API ====================

    /**
     * GET /api/v2/system/health
     * 系統健康檢查
     */
    router.get('/health', asyncHandler(async (req, res) => {
        console.log('🏥 [System] 健康檢查');
        
        const result = await handler.getHealth();
        res.json(result);
    }));

    /**
     * GET /api/v2/system/info
     * 取得完整系統資訊（除錯用）
     */
    router.get('/info', asyncHandler(async (req, res) => {
        console.log('📊 [System] 取得完整系統資訊');
        
        const result = await handler.getFullSystemInfo();
        res.json(result);
    }));

    // ==================== 時間 API ====================

    /**
     * GET /api/v2/system/time
     * 取得系統時間
     */
    router.get('/time', asyncHandler(async (req, res) => {
        console.log('🕐 [System] 取得系統時間');
        
        const result = await handler.getSystemTime();
        res.json(result);
    }));

    // ==================== 狀態 API ====================

    /**
     * GET /api/v2/system/status
     * 取得系統狀態
     */
    router.get('/status', asyncHandler(async (req, res) => {
        console.log('📊 [System] 取得系統狀態');
        
        const result = await handler.getSystemStatus();
        res.json(result);
    }));

    // ==================== 日誌 API ====================

    /**
     * GET /api/v2/system/logs
     * 取得系統日誌
     */
    router.get('/logs', asyncHandler(async (req, res) => {
        console.log('📝 [System] 取得系統日誌');
        
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        const result = await handler.getLogs(limit);
        res.json(result);
    }));

    /**
     * GET /api/v2/system/notion-sync-logs
     * 取得 Notion 課程同步日誌
     */
    router.get('/notion-sync-logs', asyncHandler(async (req, res) => {
        console.log('📋 [System] 取得 Notion 同步日誌');
        
        const limit = req.query.limit ? parseInt(req.query.limit) : 100;
        const result = await handler.getNotionCourseSyncLogs(limit);
        res.json(result);
    }));

    // ==================== 快取管理 API ====================

    /**
     * POST /api/v2/system/cache/clear
     * 清除所有快取
     */
    router.post('/cache/clear', asyncHandler(async (req, res) => {
        console.log('🗑️ [System] 清除所有快取');
        
        const result = await handler.clearAllCache();
        res.json(result);
    }));

    console.log('✅ [System] System 路由已初始化');
    return router;
}

module.exports = initSystemRoutes;
