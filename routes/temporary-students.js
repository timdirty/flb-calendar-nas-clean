/**
 * 📝 Temporary Students Routes - 臨時學生管理路由
 * 
 * 提供臨時學生的 CRUD 操作、封存、備份與還原功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const TemporaryStudentsHandler = require('./handlers/temporaryStudentsHandler');
const { asyncHandler } = require('./middleware/errorHandler');
const { verifyAdminToken } = require('./middleware/auth');

/**
 * 初始化 Temporary Students 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initTemporaryStudentsRoutes(services = {}) {
    const router = express.Router();
    const handler = new TemporaryStudentsHandler(services);

    // ==================== CRUD 操作 ====================

    /**
     * GET /api/v2/temporary-students
     * 取得臨時學生列表
     */
    router.get('/',
        asyncHandler(handler.getTemporaryStudents.bind(handler))
    );

    /**
     * POST /api/v2/temporary-students
     * 新增臨時學生
     */
    router.post('/',
        asyncHandler(handler.addTemporaryStudent.bind(handler))
    );

    /**
     * PUT /api/v2/temporary-students/:id
     * 更新臨時學生
     */
    router.put('/:id',
        asyncHandler(handler.updateTemporaryStudent.bind(handler))
    );

    /**
     * DELETE /api/v2/temporary-students/:id
     * 刪除臨時學生
     */
    router.delete('/:id',
        asyncHandler(handler.deleteTemporaryStudent.bind(handler))
    );

    // ==================== 封存與備份 ====================

    /**
     * GET /api/v2/temporary-students/archive
     * 取得封存記錄
     * Query: ?type=&course=&dateFrom=&dateTo=&name=&search=&limit=
     */
    router.get('/archive',
        asyncHandler(handler.getArchive.bind(handler))
    );

    /**
     * POST /api/v2/temporary-students/backup
     * 建立備份
     */
    router.post('/backup',
        verifyAdminToken,
        asyncHandler(handler.createBackup.bind(handler))
    );

    /**
     * GET /api/v2/temporary-students/backups
     * 取得備份清單
     */
    router.get('/backups',
        verifyAdminToken,
        asyncHandler(handler.getBackups.bind(handler))
    );

    /**
     * POST /api/v2/temporary-students/restore
     * 還原備份
     */
    router.post('/restore',
        verifyAdminToken,
        asyncHandler(handler.restoreBackup.bind(handler))
    );

    console.log('✅ [TemporaryStudents] Temporary Students 路由已初始化');
    return router;
}

module.exports = initTemporaryStudentsRoutes;
