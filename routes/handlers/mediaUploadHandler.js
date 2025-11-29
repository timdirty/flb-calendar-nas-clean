/**
 * 📸 Media Upload Handler - 媒體上傳業務邏輯
 * 
 * 處理媒體檔案上傳、批次上傳、媒體管理
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createInternalError, createBusinessError } = require('../middleware/errorHandler');

class MediaUploadHandler {
    constructor(services = {}) {
        this.mediaManager = services.mediaManager;
    }

    /**
     * 上傳媒體檔案
     */
    async uploadMedia(req, res, next) {
        try {
            if (!req.file && !req.files) {
                return next(createBusinessError('未提供檔案'));
            }

            if (!this.mediaManager) {
                return next(createBusinessError('媒體服務未啟用'));
            }

            const files = req.files || [req.file];
            const results = [];

            for (const file of files) {
                const result = await this.mediaManager.saveMedia(file);
                results.push(result);
            }

            res.json({
                success: true,
                message: '媒體上傳成功',
                data: results.length === 1 ? results[0] : results
            });
        } catch (error) {
            console.error('❌ 媒體上傳失敗:', error);
            next(createInternalError('媒體上傳失敗', { originalError: error.message }));
        }
    }

    /**
     * 批次上傳媒體
     */
    async batchUpload(req, res, next) {
        try {
            if (!req.files || req.files.length === 0) {
                return next(createBusinessError('未提供檔案'));
            }

            if (!this.mediaManager) {
                return next(createBusinessError('媒體服務未啟用'));
            }

            const results = [];
            const errors = [];

            for (const file of req.files) {
                try {
                    const result = await this.mediaManager.saveMedia(file);
                    results.push({ success: true, file: file.originalname, data: result });
                } catch (err) {
                    errors.push({ success: false, file: file.originalname, error: err.message });
                }
            }

            res.json({
                success: errors.length === 0,
                message: `批次上傳完成：${results.length} 成功，${errors.length} 失敗`,
                data: {
                    total: req.files.length,
                    successful: results.length,
                    failed: errors.length,
                    results,
                    errors
                }
            });
        } catch (error) {
            console.error('❌ 批次上傳失敗:', error);
            next(createInternalError('批次上傳失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得媒體資訊
     */
    async getMedia(req, res, next) {
        try {
            const { mediaId } = req.params;

            if (!this.mediaManager) {
                return next(createBusinessError('媒體服務未啟用'));
            }

            const media = await this.mediaManager.getMediaInfo(mediaId);

            if (!media) {
                return next(createBusinessError('媒體不存在'));
            }

            res.json({
                success: true,
                data: media
            });
        } catch (error) {
            console.error('❌ 取得媒體資訊失敗:', error);
            next(createInternalError('取得媒體資訊失敗', { originalError: error.message }));
        }
    }

    /**
     * 刪除媒體
     */
    async deleteMedia(req, res, next) {
        try {
            const { mediaId } = req.params;

            if (!this.mediaManager) {
                return next(createBusinessError('媒體服務未啟用'));
            }

            await this.mediaManager.deleteMedia(mediaId);

            res.json({
                success: true,
                message: '媒體已刪除'
            });
        } catch (error) {
            console.error('❌ 刪除媒體失敗:', error);
            next(createInternalError('刪除媒體失敗', { originalError: error.message }));
        }
    }

    /**
     * 列出媒體檔案
     */
    async listMedia(req, res, next) {
        try {
            const { type, limit = 50, offset = 0 } = req.query;

            if (!this.mediaManager) {
                return res.json({
                    success: true,
                    data: {
                        media: [],
                        total: 0
                    }
                });
            }

            const media = await this.mediaManager.listMedia({
                type,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                success: true,
                data: media
            });
        } catch (error) {
            console.error('❌ 列出媒體失敗:', error);
            next(createInternalError('列出媒體失敗', { originalError: error.message }));
        }
    }

    /**
     * 處理媒體（壓縮、轉換等）
     */
    async processMedia(req, res, next) {
        try {
            const { mediaId, operation, options } = req.body;

            if (!mediaId || !operation) {
                return next(createBusinessError('缺少必要參數：mediaId, operation'));
            }

            if (!this.mediaManager) {
                return next(createBusinessError('媒體服務未啟用'));
            }

            const result = await this.mediaManager.processMedia(mediaId, operation, options);

            res.json({
                success: true,
                message: '媒體處理完成',
                data: result
            });
        } catch (error) {
            console.error('❌ 媒體處理失敗:', error);
            next(createInternalError('媒體處理失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得媒體統計
     */
    async getStats(req, res, next) {
        try {
            if (!this.mediaManager) {
                return res.json({
                    success: true,
                    data: {
                        total: 0,
                        byType: {},
                        totalSize: 0
                    }
                });
            }

            const stats = await this.mediaManager.getStats();

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('❌ 取得媒體統計失敗:', error);
            next(createInternalError('取得媒體統計失敗', { originalError: error.message }));
        }
    }
}

module.exports = MediaUploadHandler;
