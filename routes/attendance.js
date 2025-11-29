/**
 * ✅ Attendance Routes - 簽到管理路由
 * 
 * 提供學生簽到、隊列管理、快取控制功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const AttendanceHandler = require('./handlers/attendanceHandler');
const { asyncHandler } = require('./middleware/errorHandler');

/**
 * 初始化 Attendance 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initAttendanceRoutes(services = {}) {
    const router = express.Router();
    const handler = new AttendanceHandler(services);

    // ==================== 簽到功能 ====================

    /**
     * POST /api/v2/attendance/fast
     * 極速簽到
     */
    router.post('/fast',
        asyncHandler(handler.recordFastAttendance.bind(handler))
    );

    /**
     * POST /api/v2/attendance/queue
     * 簽到隊列（異步處理）
     */
    router.post('/queue',
        asyncHandler(handler.queueAttendance.bind(handler))
    );

    /**
     * GET /api/v2/attendance/status
     * 查詢簽到狀態
     * Query: ?course=課程名稱&date=日期
     */
    router.get('/status',
        asyncHandler(handler.getAttendanceStatus.bind(handler))
    );

    // ==================== 隊列管理 ====================

    /**
     * GET /api/v2/attendance/queue/stats
     * 查詢隊列狀態
     */
    router.get('/queue/stats',
        asyncHandler(handler.getQueueStats.bind(handler))
    );

    /**
     * POST /api/v2/attendance/queue/retry-failed
     * 重試失敗記錄
     */
    router.post('/queue/retry-failed',
        asyncHandler(handler.retryFailed.bind(handler))
    );

    // ==================== 管理功能 ====================

    /**
     * POST /api/v2/attendance/clear-cache
     * 清除快取
     */
    router.post('/clear-cache',
        asyncHandler(handler.clearCache.bind(handler))
    );

    /**
     * GET /api/v2/attendance/debug/students
     * 調試：查看學生列表
     */
    router.get('/debug/students',
        asyncHandler(handler.debugStudents.bind(handler))
    );

    /**
     * POST /api/v2/attendance/quick-reply
     * Quick Reply 出席回應
     */
    router.post('/quick-reply',
        asyncHandler(handler.quickReplyAttendance.bind(handler))
    );

    console.log('✅ [Attendance] Attendance 路由已初始化');
    return router;
}

module.exports = initAttendanceRoutes;
