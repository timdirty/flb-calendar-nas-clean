/**
 * 📚 Learning Records Routes - 學習記錄路由
 * 
 * 提供學習記錄儲存、查詢和 Drive 上傳功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const LearningRecordsHandler = require('./handlers/learningRecordsHandler');
const { asyncHandler } = require('./middleware/errorHandler');

/**
 * 初始化 Learning Records 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initLearningRecordsRoutes(services = {}) {
    const router = express.Router();
    const handler = new LearningRecordsHandler(services);

    // ==================== 儲存與上傳 ====================

    /**
     * POST /api/v3/learning-records/save
     * 儲存學習記錄（純文字）
     * Body: { studentName, courseName, date, semester, topic, notes }
     */
    router.post('/save',
        asyncHandler(handler.saveRecord.bind(handler))
    );

    /**
     * POST /api/v3/learning-records/upload-drive
     * 上傳學習記錄到 Drive（包含媒體）
     * 注意：需要使用 multipart/form-data
     */
    router.post('/upload-drive',
        asyncHandler(handler.uploadToDrive.bind(handler))
    );

    // ==================== 查詢功能 ====================

    /**
     * GET /api/v3/learning-records/history-drive
     * 查詢學習歷程記錄（從 Drive）
     * Query: ?semester=&courseName=&date=
     */
    router.get('/history-drive',
        asyncHandler(handler.getHistoryFromDrive.bind(handler))
    );

    /**
     * GET /api/v3/learning-records/today-completed-courses
     * 取得今天已結束的課程列表
     * Query: ?eventId=&date=&range=&instructor=&cache=
     */
    router.get('/today-completed-courses',
        asyncHandler(handler.getTodayCompletedCourses.bind(handler))
    );

    /**
     * GET /api/v3/learning-records/index/course
     * 讀取單堂課的學習歷程索引摘要
     * Query: ?semester=&courseName=&date=&topic=
     */
    router.get('/index/course',
        asyncHandler(handler.getCourseIndex.bind(handler))
    );

    /**
     * GET /api/v3/learning-records/index
     * 讀取完整學習歷程集中索引
     */
    router.get('/index',
        asyncHandler(handler.getFullIndex.bind(handler))
    );

    // ==================== 刪除功能 ====================

    /**
     * DELETE /api/v3/learning-records/drive/*
     * 刪除學習記錄（從 Drive）
     * 路徑格式：/api/v3/learning-records/drive/{record_path}
     */
    router.delete('/drive/*',
        asyncHandler(handler.deleteRecord.bind(handler))
    );

    /**
     * POST /api/v3/learning-records/drive/batch-delete
     * 批次刪除學習記錄
     * Body: { recordPaths: ["/path1", "/path2", ...] }
     */
    router.post('/drive/batch-delete',
        asyncHandler(handler.batchDelete.bind(handler))
    );

    console.log('✅ [LearningRecords] Learning Records 路由已初始化');
    return router;
}

module.exports = initLearningRecordsRoutes;
