/**
 * 👥 Students Routes - 學生管理路由
 * 
 * 提供學生資料的查詢、同步、快取管理功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const StudentsHandler = require('./handlers/studentsHandler');
const { asyncHandler } = require('./middleware/errorHandler');
const { verifyAdminToken } = require('./middleware/auth');

/**
 * 初始化 Students 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initStudentsRoutes(services = {}) {
    const router = express.Router();
    const handler = new StudentsHandler(services);

    // ==================== 學生資料查詢 API ====================

    /**
     * GET /api/v2/students
     * 取得所有學生（合併正常和臨時學生）
     */
    router.get('/',
        asyncHandler(handler.getAllStudents.bind(handler))
    );

    /**
     * GET /api/v2/students/from-sheets
     * 從 Google Sheets 取得學生資料
     */
    router.get('/from-sheets',
        asyncHandler(handler.getStudentsFromSheets.bind(handler))
    );

    /**
     * GET /api/v2/students/by-course
     * 按課程取得學生
     * Query: ?course=課程名稱
     */
    router.get('/by-course',
        asyncHandler(handler.getStudentsByCourse.bind(handler))
    );

    /**
     * GET /api/v2/students/data
     * 取得學生資料檔案
     */
    router.get('/data',
        asyncHandler(handler.getStudentData.bind(handler))
    );

    /**
     * GET /api/v2/students/search
     * 搜尋學生
     * Query: ?keyword=關鍵字
     */
    router.get('/search',
        asyncHandler(handler.searchStudents.bind(handler))
    );

    /**
     * GET /api/v2/students/stats
     * 取得學生統計資訊
     */
    router.get('/stats',
        asyncHandler(handler.getStudentsStats.bind(handler))
    );

    // ==================== 快取管理 API ====================

    /**
     * POST /api/v2/students/clear-cache
     * 清除學生資料快取
     */
    router.post('/clear-cache',
        asyncHandler(handler.clearCache.bind(handler))
    );

    // ==================== 同步管理 API ====================

    /**
     * GET /api/v2/students/sync/settings
     * 取得同步設定
     */
    router.get('/sync/settings',
        verifyAdminToken,
        asyncHandler(handler.getSyncSettings.bind(handler))
    );

    /**
     * POST /api/v2/students/sync/settings
     * 更新同步設定
     */
    router.post('/sync/settings',
        verifyAdminToken,
        asyncHandler(handler.updateSyncSettings.bind(handler))
    );

    /**
     * POST /api/v2/students/sync/trigger
     * 手動觸發同步
     */
    router.post('/sync/trigger',
        verifyAdminToken,
        asyncHandler(handler.triggerSync.bind(handler))
    );

    /**
     * POST /api/v2/students/sync/start
     * 啟動自動同步
     */
    router.post('/sync/start',
        verifyAdminToken,
        asyncHandler(handler.startAutoSync.bind(handler))
    );

    /**
     * POST /api/v2/students/sync/stop
     * 停止自動同步
     */
    router.post('/sync/stop',
        verifyAdminToken,
        asyncHandler(handler.stopAutoSync.bind(handler))
    );

    console.log('✅ [Students] Students 路由已初始化');
    return router;
}

module.exports = initStudentsRoutes;
