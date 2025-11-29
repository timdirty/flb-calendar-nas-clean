/**
 * 📁 Drive Media Routes - Drive 媒體路由
 * 
 * 提供 Drive 媒體記錄查詢和檔案代理存取功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const DriveMediaHandler = require('./handlers/driveMediaHandler');
const { asyncHandler } = require('./middleware/errorHandler');

/**
 * 初始化 Drive Media 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initDriveMediaRoutes(services = {}) {
    const router = express.Router();
    const handler = new DriveMediaHandler(services);

    // ==================== 媒體記錄查詢 ====================

    /**
     * GET /api/v3/drive-media/records
     * 取得 Drive 媒體記錄列表
     * Query: ?date=&semester=&courseName=&studentName=&limit=
     */
    router.get('/records',
        asyncHandler(handler.getRecords.bind(handler))
    );

    /**
     * GET /api/v3/drive-media/records/:recordId
     * 取得單筆 Drive 媒體記錄
     */
    router.get('/records/:recordId',
        asyncHandler(handler.getRecord.bind(handler))
    );

    // ==================== 檔案代理存取 ====================

    /**
     * GET /api/v3/drive-media/proxy/*
     * Drive 檔案代理存取
     * 路徑格式：/api/v3/drive-media/proxy/{drive_path}
     */
    router.get('/proxy/*',
        asyncHandler(handler.proxyFile.bind(handler))
    );

    /**
     * POST /api/v3/drive-media/url
     * 取得 Drive 檔案的代理 URL
     * Body: { path: "/path/to/file.jpg" }
     */
    router.post('/url',
        asyncHandler(handler.getProxyUrl.bind(handler))
    );

    console.log('✅ [DriveMedia] Drive Media 路由已初始化');
    return router;
}

module.exports = initDriveMediaRoutes;
