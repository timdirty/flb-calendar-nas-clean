/**
 * ☁️ Drive Upload Handler - Drive 上傳處理器
 * 
 * 處理檔案分片上傳到 Synology Drive 的業務邏輯
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createBusinessError, createInternalError } = require('../middleware/errorHandler');
const logger = require('../../utils/logger');

class DriveUploadHandler {
    constructor(services = {}) {
        this.driveClient = services.driveClient;
        this.driveChunkRegistry = services.driveChunkRegistry;
        this.driveUploadQueue = services.driveUploadQueue;
        this.drivePathManager = services.drivePathManager;
    }

    /**
     * 輔助函數：解析 metadata 輸入
     */
    parseMetadataInput(metadata) {
        if (!metadata) return {};
        if (typeof metadata === 'string') {
            try {
                return JSON.parse(metadata);
            } catch (e) {
                logger.warn('⚠️ metadata 解析失敗，使用空物件');
                return {};
            }
        }
        return metadata;
    }

    /**
     * POST /api/v3/drive-upload/init
     * 初始化檔案上傳
     */
    async initUpload(req, res, next) {
        try {
            const payload = req.body || {};
            const filename = String(payload.filename || payload.fileName || '').trim();
            const fileSize = Number(payload.fileSize || 0);
            const chunkSize = Number(payload.chunkSize || 6 * 1024 * 1024); // 預設 6MB

            if (!filename) {
                return next(createBusinessError('缺少必要參數：filename'));
            }

            // 對於空檔案或小檔案，允許 fileSize = 0 或很小
            if (fileSize < 0) {
                return next(createBusinessError('檔案大小不能為負數'));
            }

            // 如果檔案大小為 0，將其作為單一分片處理
            const effectiveChunkSize = fileSize === 0 ? 1 : chunkSize;

            if (fileSize > Number(process.env.MEDIA_FILE_MAX_SIZE || 2 * 1024 * 1024 * 1024)) {
                return next(createBusinessError('檔案過大，請分割或壓縮後再上傳'));
            }

            const metadata = this.parseMetadataInput(payload.metadata);

            if (!this.driveChunkRegistry) {
                throw new Error('Drive 分片註冊表服務未初始化');
            }

            const session = await this.driveChunkRegistry.createSession({
                filename,
                fileSize,
                chunkSize: effectiveChunkSize,
                fileType: payload.fileType || 'application/octet-stream',
                metadata,
                expireMs: Number(payload.expireMs || 0) || undefined
            });

            logger.info('✅ [DriveUpload] 上傳初始化成功:', { uploadId: session.uploadId });

            res.json({
                success: true,
                uploadId: session.uploadId,
                totalChunks: session.totalChunks,
                chunkSize: session.chunkSize,
                expiresAt: session.expiresAt
            });
        } catch (error) {
            console.error('❌ [DriveUpload] 初始化上傳失敗:', error.message, error.stack);
            logger.error('❌ [DriveUpload] 初始化上傳失敗:', error);
            next(createInternalError('初始化上傳失敗', { originalError: error.message }));
        }
    }

    /**
     * POST /api/v3/drive-upload/chunk
     * 上傳檔案分片
     */
    async uploadChunk(req, res, next) {
        try {
            const { sessionId, chunkIndex } = req.body;
            const file = req.file;

            if (!sessionId || chunkIndex === undefined || !file) {
                return next(createBusinessError('缺少必要參數：sessionId, chunkIndex, file'));
            }

            logger.info('☁️ [DriveUpload] 上傳分片:', { sessionId, chunkIndex, size: file.size });

            // 檢查 session 是否存在
            if (this.driveUploadQueue) {
                const session = await this.driveUploadQueue.getSession(sessionId);
                if (!session) {
                    return next(createBusinessError('上傳 session 不存在'));
                }

                // 記錄分片
                await this.driveUploadQueue.addChunk(sessionId, {
                    index: parseInt(chunkIndex),
                    size: file.size,
                    path: file.path,
                    uploadedAt: new Date().toISOString()
                });
            }

            logger.info('✅ [DriveUpload] 分片上傳成功:', { sessionId, chunkIndex });

            res.json({
                success: true,
                data: {
                    sessionId,
                    chunkIndex: parseInt(chunkIndex),
                    received: true
                }
            });
        } catch (error) {
            logger.error('❌ [DriveUpload] 分片上傳失敗:', error);
            next(createInternalError('分片上傳失敗', { originalError: error.message }));
        }
    }

    /**
     * POST /api/v3/drive-upload/complete
     * 完成檔案上傳
     */
    async completeUpload(req, res, next) {
        try {
            const { sessionId, metadata } = req.body;

            if (!sessionId) {
                return next(createBusinessError('缺少必要參數：sessionId'));
            }

            logger.info('☁️ [DriveUpload] 完成上傳:', { sessionId });

            // 檢查 Drive 服務是否就緒
            if (!this.driveClient || !this.driveClient.isAuthenticated()) {
                throw new Error('Synology Drive 服務未就緒');
            }

            let finalPath = null;

            if (this.driveUploadQueue) {
                // 取得 session 資訊
                const session = await this.driveUploadQueue.getSession(sessionId);
                if (!session) {
                    return next(createBusinessError('上傳 session 不存在'));
                }

                // 合併分片並上傳到 Drive
                const result = await this.driveUploadQueue.completeUpload(sessionId, metadata);
                finalPath = result.path;

                // 清理 session
                await this.driveUploadQueue.cleanupSession(sessionId);
            }

            logger.info('✅ [DriveUpload] 上傳完成:', { sessionId, path: finalPath });

            res.json({
                success: true,
                data: {
                    sessionId,
                    path: finalPath,
                    uploadedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            logger.error('❌ [DriveUpload] 完成上傳失敗:', error);
            next(createInternalError('完成上傳失敗', { originalError: error.message }));
        }
    }

    /**
     * GET /api/v3/drive-upload/status/:sessionId
     * 查詢上傳狀態
     */
    async getUploadStatus(req, res, next) {
        try {
            const { sessionId } = req.params;

            if (!sessionId) {
                return next(createBusinessError('缺少必要參數：sessionId'));
            }

            logger.info('📊 [DriveUpload] 查詢上傳狀態:', { sessionId });

            if (!this.driveUploadQueue) {
                return next(createInternalError('Drive 上傳隊列服務未初始化'));
            }

            const session = await this.driveUploadQueue.getSession(sessionId);
            if (!session) {
                return next(createBusinessError('上傳 session 不存在'));
            }

            res.json({
                success: true,
                data: {
                    sessionId,
                    status: session.status,
                    fileName: session.fileName,
                    fileSize: session.fileSize,
                    uploadedChunks: session.chunks?.length || 0,
                    totalChunks: Math.ceil(session.fileSize / (1024 * 1024 * 5)),
                    progress: session.chunks?.length 
                        ? (session.chunks.length / Math.ceil(session.fileSize / (1024 * 1024 * 5)) * 100).toFixed(2) 
                        : 0
                }
            });
        } catch (error) {
            logger.error('❌ [DriveUpload] 查詢上傳狀態失敗:', error);
            next(createInternalError('查詢上傳狀態失敗', { originalError: error.message }));
        }
    }
}

module.exports = DriveUploadHandler;
