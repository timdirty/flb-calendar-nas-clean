/**
 * 👤 Student Reminders Routes - 學生提醒管理路由
 * 
 * 提供學生提醒設定、批次提醒功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const StudentRemindersHandler = require('./handlers/studentRemindersHandler');
const { asyncHandler } = require('./middleware/errorHandler');
const { verifyAdminToken } = require('./middleware/auth');

/**
 * 初始化 Student Reminders 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initStudentRemindersRoutes(services = {}) {
    const router = express.Router();
    const handler = new StudentRemindersHandler(services);

    // ==================== 設定管理 ====================

    /**
     * GET /api/v2/student-reminders/settings
     * 取得學生提醒設定
     */
    router.get('/settings',
        verifyAdminToken,
        asyncHandler(handler.getSettings.bind(handler))
    );

    /**
     * POST /api/v2/student-reminders/settings
     * 更新學生提醒設定
     */
    router.post('/settings',
        verifyAdminToken,
        asyncHandler(handler.updateSettings.bind(handler))
    );

    /**
     * GET /api/v2/student-reminders/settings/:studentId
     * 取得學生提醒設定（按學生）
     */
    router.get('/settings/:studentId',
        verifyAdminToken,
        asyncHandler(handler.getStudentSettings.bind(handler))
    );

    /**
     * POST /api/v2/student-reminders/settings/:studentId
     * 更新學生提醒設定（按學生）
     */
    router.post('/settings/:studentId',
        verifyAdminToken,
        asyncHandler(handler.updateStudentSettings.bind(handler))
    );

    // ==================== 發送提醒 ====================

    /**
     * POST /api/v2/student-reminders/send
     * 發送學生提醒
     */
    router.post('/send',
        verifyAdminToken,
        asyncHandler(handler.sendStudentReminder.bind(handler))
    );

    /**
     * POST /api/v2/student-reminders/send-batch
     * 批次發送學生提醒
     */
    router.post('/send-batch',
        verifyAdminToken,
        asyncHandler(handler.sendBatchStudentReminders.bind(handler))
    );

    // ==================== 資料查詢 ====================

    /**
     * GET /api/v2/student-reminders/students
     * 取得學生列表
     */
    router.get('/students',
        verifyAdminToken,
        asyncHandler(handler.getStudentList.bind(handler))
    );

    console.log('✅ [StudentReminders] Student Reminders 路由已初始化');
    return router;
}

module.exports = initStudentRemindersRoutes;
