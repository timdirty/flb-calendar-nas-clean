/**
 * 🚫 Legacy Media Upload Routes - Legacy 媒體上傳路由（已棄用）
 * 
 * 此 API 已停止服務，請改用 /api/v3/drive-upload/* 或 /api/v3/drive-media/*
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 * @deprecated 請使用新的 Drive API
 */

const express = require('express');

const LEGACY_MEDIA_API_MESSAGE = 'Legacy media API 已停止服務，請改用 /api/v3/drive-upload/* 或 /api/v3/drive-media/*';

/**
 * 回應 Legacy API 請求
 */
function respondLegacyMediaApi(req, res) {
    // 清理可能存在的臨時檔案
    if (req && req.file && req.file.path) {
        try {
            const fs = require('fs');
            if (fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }
        } catch (cleanupErr) {
            console.error('⚠️ [LegacyMedia] 清理臨時檔案失敗:', cleanupErr.message);
        }
    }

    res.status(410).json({
        success: false,
        error: 'API_DEPRECATED',
        message: LEGACY_MEDIA_API_MESSAGE,
        migration: {
            upload: '/api/v3/drive-upload',
            media: '/api/v3/drive-media',
            docs: 'https://github.com/your-repo/api-docs'
        }
    });
}

/**
 * 初始化 Legacy Media Upload 路由
 * @param {Object} services - 服務實例集合（未使用）
 * @returns {Router} Express 路由實例
 */
function initMediaUploadRoutes(services = {}) {
    const router = express.Router();

    // ==================== Legacy Video API (已棄用) ====================

    /**
     * POST /api/v3/media/videos/init
     * 初始化影片上傳（已棄用）
     * @deprecated 請使用 POST /api/v3/drive-upload/init
     */
    router.post('/videos/init', respondLegacyMediaApi);

    /**
     * POST /api/v3/media/videos/chunk
     * 上傳影片分片（已棄用）
     * @deprecated 請使用 POST /api/v3/drive-upload/chunk
     */
    router.post('/videos/chunk', respondLegacyMediaApi);

    /**
     * POST /api/v3/media/videos/complete
     * 完成影片上傳（已棄用）
     * @deprecated 請使用 POST /api/v3/drive-upload/complete
     */
    router.post('/videos/complete', respondLegacyMediaApi);

    /**
     * GET /api/v3/media/videos
     * 取得影片列表（已棄用）
     * @deprecated 請使用 GET /api/v3/drive-media/records
     */
    router.get('/videos', respondLegacyMediaApi);

    /**
     * GET /api/v3/media/videos/:recordId
     * 取得單筆影片記錄（已棄用）
     * @deprecated 請使用 GET /api/v3/drive-media/records/:recordId
     */
    router.get('/videos/:recordId', respondLegacyMediaApi);

    /**
     * GET /api/v3/media/videos/:recordId/download
     * 下載影片（已棄用）
     * @deprecated 請使用 GET /api/v3/drive-media/proxy/*
     */
    router.get('/videos/:recordId/download', respondLegacyMediaApi);

    /**
     * GET /api/v3/media/videos/:recordId/thumbnail
     * 取得影片縮圖（已棄用）
     * @deprecated 請使用 GET /api/v3/drive-media/proxy/*
     */
    router.get('/videos/:recordId/thumbnail', respondLegacyMediaApi);

    console.log('⚠️ [MediaUpload] Legacy Media Upload 路由已初始化（僅返回 410 Gone）');
    return router;
}

module.exports = initMediaUploadRoutes;
