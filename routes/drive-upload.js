/**
 * ☁️ Drive Upload Routes - Drive 上傳路由
 * 
 * 提供檔案分片上傳到 Synology Drive 的功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const DriveUploadHandler = require('./handlers/driveUploadHandler');
const { asyncHandler } = require('./middleware/errorHandler');

// Multer 配置：用於處理分片上傳
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const tempDir = path.join(os.tmpdir(), 'flb-drive-upload');
        cb(null, tempDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, `chunk-${uniqueSuffix}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB per chunk
    }
});

/**
 * 初始化 Drive Upload 路由
 * @param {Object} services - 服務實例集合
 * @returns {Router} Express 路由實例
 */
function initDriveUploadRoutes(services = {}) {
    const router = express.Router();
    const handler = new DriveUploadHandler(services);

    // ==================== 檔案上傳 ====================

    /**
     * POST /api/v3/drive-upload/init
     * 初始化檔案上傳
     */
    router.post('/init',
        asyncHandler(handler.initUpload.bind(handler))
    );

    /**
     * POST /api/v3/drive-upload/chunk
     * 上傳檔案分片
     */
    router.post('/chunk',
        upload.single('chunk'),
        asyncHandler(handler.uploadChunk.bind(handler))
    );

    /**
     * POST /api/v3/drive-upload/complete
     * 完成檔案上傳
     */
    router.post('/complete',
        asyncHandler(handler.completeUpload.bind(handler))
    );

    // ==================== 上傳狀態查詢 ====================

    /**
     * GET /api/v3/drive-upload/status/:sessionId
     * 查詢上傳狀態
     */
    router.get('/status/:sessionId',
        asyncHandler(handler.getUploadStatus.bind(handler))
    );

    console.log('✅ [DriveUpload] Drive Upload 路由已初始化');
    return router;
}

module.exports = initDriveUploadRoutes;
