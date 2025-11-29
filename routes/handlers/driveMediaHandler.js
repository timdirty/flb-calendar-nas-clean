/**
 * 📁 Drive Media Handler - Drive 媒體處理器
 * 
 * 處理 Drive 媒體記錄查詢和代理存取的業務邏輯
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createBusinessError, createInternalError } = require('../middleware/errorHandler');
const logger = require('../../utils/logger');

class DriveMediaHandler {
    constructor(services = {}) {
        this.driveClient = services.driveClient;
        this.driveMediaIndex = services.driveMediaIndex;
    }

    /**
     * 輔助函數：格式化 Drive 媒體記錄
     */
    formatDriveMediaRecord(record) {
        if (!record) return null;
        return {
            id: record.id,
            dateKey: record.dateKey,
            courseName: record.courseName,
            studentName: record.studentName,
            isOverview: record.isOverview || false,
            instructorName: record.instructorName,
            courseId: record.courseId,
            path: record.path,
            createdAt: record.createdAt,
            mediaType: record.mediaType
        };
    }

    /**
     * 輔助函數：檢查字串匹配
     */
    matchesFilterField(value, expected) {
        if (!expected) return true;
        const actual = String(value || '').toLowerCase();
        const target = String(expected || '').toLowerCase();
        return actual.includes(target);
    }

    /**
     * 輔助函數：過濾 Drive 媒體記錄
     */
    filterDriveMediaRecord(record, filters) {
        if (!record) return false;
        if (filters.date && String(record.dateKey || '') !== String(filters.date)) return false;
        if (filters.course && !this.matchesFilterField(record.courseName, filters.course)) return false;
        if (filters.student && !this.matchesFilterField(record.studentName, filters.student)) return false;
        if (filters.instructor && !this.matchesFilterField(record.instructorName, filters.instructor)) return false;
        if (filters.courseId && !this.matchesFilterField(record.courseId, filters.courseId)) return false;
        if (filters.mode === 'overview' && !record.isOverview) return false;
        if (filters.mode === 'student' && record.isOverview) return false;
        return true;
    }

    /**
     * GET /api/v3/drive-media/records
     * 取得 Drive 媒體記錄列表
     */
    async getRecords(req, res, next) {
        try {
            logger.info('📁 [DriveMedia] 查詢媒體記錄:', req.query);

            if (!this.driveMediaIndex) {
                throw new Error('Drive 媒體索引服務未初始化');
            }

            // 構建過濾條件
            const filters = {
                date: req.query.date,
                course: req.query.course || req.query.courseName,
                student: req.query.student || req.query.studentName,
                instructor: req.query.instructor,
                courseId: req.query.courseId,
                mode: req.query.mode
            };

            const driveItems = (await this.driveMediaIndex.listRecords())
                .map(record => this.formatDriveMediaRecord(record))
                .filter(Boolean)
                .filter(record => this.filterDriveMediaRecord(record, filters));

            logger.info(`✅ [DriveMedia] 找到 ${driveItems.length} 筆記錄`);

            res.json({
                success: true,
                items: driveItems
            });
        } catch (error) {
            logger.error('❌ [DriveMedia] 查詢媒體記錄失敗:', error);
            next(createInternalError('查詢媒體記錄失敗', { originalError: error.message }));
        }
    }

    /**
     * GET /api/v3/drive-media/records/:recordId
     * 取得單筆 Drive 媒體記錄
     */
    async getRecord(req, res, next) {
        try {
            const { recordId } = req.params;

            if (!recordId) {
                return next(createBusinessError('缺少必要參數：recordId'));
            }

            logger.info('📁 [DriveMedia] 查詢單筆記錄:', { recordId });

            if (!this.driveMediaIndex) {
                throw new Error('Drive 媒體索引服務未初始化');
            }

            const record = await this.driveMediaIndex.findRecordById(recordId);

            if (!record) {
                return next(createBusinessError('記錄不存在'));
            }

            logger.info('✅ [DriveMedia] 找到記錄');

            res.json({
                success: true,
                data: record
            });
        } catch (error) {
            logger.error('❌ [DriveMedia] 查詢單筆記錄失敗:', error);
            next(createInternalError('查詢單筆記錄失敗', { originalError: error.message }));
        }
    }

    /**
     * GET /api/v3/drive-media/proxy/*
     * Drive 檔案代理存取
     */
    async proxyFile(req, res, next) {
        try {
            // 提取檔案路徑
            const filePath = '/' + (req.params[0] || '');

            logger.info('📁 [DriveMedia] 代理檔案存取:', { filePath });

            if (!this.driveClient || !this.driveClient.isAuthenticated()) {
                throw new Error('Synology Drive 服務未就緒');
            }

            // 透過 Drive Client 下載檔案
            const fileStream = await this.driveClient.downloadFile(filePath);

            // 設定適當的 headers
            const ext = filePath.split('.').pop().toLowerCase();
            const contentTypes = {
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'png': 'image/png',
                'gif': 'image/gif',
                'mp4': 'video/mp4',
                'webm': 'video/webm',
                'pdf': 'application/pdf'
            };

            res.set('Content-Type', contentTypes[ext] || 'application/octet-stream');
            res.set('Cache-Control', 'public, max-age=31536000'); // 快取一年

            // 串流回傳檔案
            fileStream.pipe(res);

            logger.info('✅ [DriveMedia] 檔案代理成功');
        } catch (error) {
            logger.error('❌ [DriveMedia] 檔案代理失敗:', error);
            next(createInternalError('檔案代理失敗', { originalError: error.message }));
        }
    }

    /**
     * POST /api/v3/drive-media/url
     * 取得 Drive 檔案的代理 URL
     */
    async getProxyUrl(req, res, next) {
        try {
            const { path: drivePath } = req.body;

            if (!drivePath) {
                return next(createBusinessError('缺少必要參數：path'));
            }

            logger.info('🔗 [DriveMedia] 產生代理 URL:', { drivePath });

            // 清理路徑
            const cleanPath = drivePath.startsWith('/') ? drivePath.substring(1) : drivePath;

            // 構建代理 URL
            const proxyUrl = `/api/v3/drive-media/proxy/${cleanPath}`;

            logger.info('✅ [DriveMedia] 代理 URL 已產生');

            res.json({
                success: true,
                data: {
                    originalPath: drivePath,
                    proxyUrl: proxyUrl
                }
            });
        } catch (error) {
            logger.error('❌ [DriveMedia] 產生代理 URL 失敗:', error);
            next(createInternalError('產生代理 URL 失敗', { originalError: error.message }));
        }
    }
}

module.exports = DriveMediaHandler;
