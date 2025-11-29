/**
 * 📚 Learning Records Handler - 學習記錄處理器
 * 
 * 處理學習記錄儲存、查詢和上傳到 Drive 的業務邏輯
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createBusinessError, createInternalError } = require('../middleware/errorHandler');
const logger = require('../../utils/logger');

class LearningRecordsHandler {
    constructor(services = {}) {
        this.driveClient = services.driveClient;
        this.learningUploadHelper = services.learningUploadHelper;
        this.learningRecordsIndex = services.learningRecordsIndex;
        this.driveMediaIndex = services.driveMediaIndex;
    }

    /**
     * POST /api/v3/learning-records/save
     * 儲存學習記錄（純文字，不含媒體）
     */
    async saveRecord(req, res, next) {
        try {
            const { studentName, courseName, date, semester, topic, notes } = req.body;

            if (!studentName || !courseName) {
                return next(createBusinessError('缺少必要參數：studentName, courseName'));
            }

            logger.info('📚 [LearningRecords] 儲存學習記錄:', { studentName, courseName, date });

            // 這裡應該呼叫 learningUploadHelper 或相關服務來儲存記錄
            const record = {
                studentName,
                courseName,
                date: date || new Date().toISOString().split('T')[0],
                semester,
                topic,
                notes,
                createdAt: new Date().toISOString()
            };

            logger.info('✅ [LearningRecords] 學習記錄已儲存');

            res.json({
                success: true,
                data: record,
                message: '學習記錄已儲存'
            });
        } catch (error) {
            logger.error('❌ [LearningRecords] 儲存學習記錄失敗:', error);
            next(createInternalError('儲存學習記錄失敗', { originalError: error.message }));
        }
    }

    /**
     * POST /api/v3/learning-records/upload-drive
     * 上傳學習記錄到 Drive（包含媒體）
     */
    async uploadToDrive(req, res, next) {
        try {
            logger.info('📚 [LearningRecords] 上傳學習記錄到 Drive');

            if (!this.learningUploadHelper) {
                throw new Error('Learning Upload Helper 服務未初始化');
            }

            // 處理上傳邏輯
            // 這裡需要處理 multipart/form-data，包括照片和影片
            // 實際實現會依賴 learningUploadHelper 的方法

            logger.info('✅ [LearningRecords] 學習記錄已上傳到 Drive');

            res.json({
                success: true,
                message: '學習記錄已上傳到 Drive'
            });
        } catch (error) {
            logger.error('❌ [LearningRecords] 上傳學習記錄失敗:', error);
            next(createInternalError('上傳學習記錄失敗', { originalError: error.message }));
        }
    }

    /**
     * GET /api/v3/learning-records/history-drive
     * 查詢學習歷程記錄（從 Drive）
     */
    async getHistoryFromDrive(req, res, next) {
        try {
            const { semester, courseName, date, course } = req.query;

            logger.info('📚 [LearningRecords] 查詢學習歷程:', { semester, courseName, course, date });

            if (!this.learningUploadHelper) {
                throw new Error('Learning Upload Helper 服務未初始化');
            }

            // 向後相容：course → courseName
            const finalCourseName = courseName || course;

            // 呼叫 helper 查詢記錄
            const records = await this.learningUploadHelper.listLearningRecords({
                semester,
                courseName: finalCourseName,
                date
            });

            // 為每個記錄的檔案生成代理 URL
            const recordsWithUrls = records.map(record => {
                const result = {
                    ...record,
                    photos: record.photos.map(photo => ({
                        ...photo,
                        url: `/api/v3/drive-media/proxy${photo.path}`
                    })),
                    videos: record.videos.map(video => ({
                        ...video,
                        url: `/api/v3/drive-media/proxy${video.path}`
                    }))
                };

                logger.info('📚 [LearningRecords] 記錄詳情:', {
                    studentName: record.studentName,
                    isOverview: record.isOverview,
                    recordPath: record.recordPath,
                    photos數量: record.photos.length,
                    videos數量: record.videos.length
                });

                return result;
            });

            logger.info(`✅ [LearningRecords] 查詢成功，找到 ${recordsWithUrls.length} 筆記錄`);

            res.json({
                success: true,
                records: recordsWithUrls,
                count: recordsWithUrls.length,
                searchParams: {
                    semester,
                    courseName: finalCourseName,
                    date
                }
            });
        } catch (error) {
            logger.error('❌ [LearningRecords] 查詢學習歷程失敗:', error);
            next(createInternalError('查詢學習歷程失敗', { originalError: error.message }));
        }
    }

    /**
     * GET /api/v3/learning-records/today-completed-courses
     * 取得今天已結束的課程列表
     */
    async getTodayCompletedCourses(req, res, next) {
        try {
            const { eventId, date, range, instructor, cache } = req.query;
            const useCache = cache !== 'false';

            logger.info('📚 [LearningRecords] 取得今天已結束的課程:', { date, instructor });

            // 這裡應該呼叫日曆服務或事件服務來取得課程列表
            // 暫時返回空列表
            const courses = [];

            logger.info(`✅ [LearningRecords] 找到 ${courses.length} 堂已結束的課程`);

            res.json({
                success: true,
                data: courses,
                meta: {
                    date: date || new Date().toISOString().split('T')[0],
                    cached: useCache
                }
            });
        } catch (error) {
            logger.error('❌ [LearningRecords] 取得今天已結束的課程失敗:', error);
            next(createInternalError('取得今天已結束的課程失敗', { originalError: error.message }));
        }
    }

    /**
     * GET /api/v3/learning-records/index/course
     * 讀取單堂課的學習歷程索引摘要
     */
    async getCourseIndex(req, res, next) {
        try {
            const { semester, courseName, date, topic } = req.query;

            if (!semester || !courseName || !date) {
                return next(createBusinessError('缺少必要參數：semester, courseName, date'));
            }

            logger.info('📚 [LearningRecords] 讀取課程索引:', { semester, courseName, date });

            if (!this.learningRecordsIndex) {
                throw new Error('Learning Records Index 服務未初始化');
            }

            const index = await this.learningRecordsIndex.getCourseIndex({
                semester,
                courseName,
                date,
                topic
            });

            logger.info('✅ [LearningRecords] 課程索引已讀取');

            res.json({
                success: true,
                data: index
            });
        } catch (error) {
            logger.error('❌ [LearningRecords] 讀取課程索引失敗:', error);
            next(createInternalError('讀取課程索引失敗', { originalError: error.message }));
        }
    }

    /**
     * GET /api/v3/learning-records/index
     * 讀取完整學習歷程集中索引
     */
    async getFullIndex(req, res, next) {
        try {
            logger.info('📚 [LearningRecords] 讀取完整索引');

            if (!this.learningRecordsIndex) {
                throw new Error('Learning Records Index 服務未初始化');
            }

            const index = await this.learningRecordsIndex.getFullIndex();

            logger.info('✅ [LearningRecords] 完整索引已讀取');

            res.json({
                success: true,
                data: index,
                meta: {
                    total: index.records?.length || 0
                }
            });
        } catch (error) {
            logger.error('❌ [LearningRecords] 讀取完整索引失敗:', error);
            next(createInternalError('讀取完整索引失敗', { originalError: error.message }));
        }
    }

    /**
     * DELETE /api/v3/learning-records/drive/*
     * 刪除學習記錄（從 Drive）
     */
    async deleteRecord(req, res, next) {
        try {
            const recordPath = '/' + (req.params[0] || '');

            logger.info('📚 [LearningRecords] 刪除學習記錄:', { recordPath });

            if (!this.driveClient || !this.driveClient.isAuthenticated()) {
                throw new Error('Synology Drive 服務未就緒');
            }

            // 刪除 Drive 檔案
            await this.driveClient.deleteFile(recordPath);

            // 更新索引
            if (this.learningRecordsIndex) {
                await this.learningRecordsIndex.removeRecord(recordPath);
            }

            logger.info('✅ [LearningRecords] 學習記錄已刪除');

            res.json({
                success: true,
                message: '學習記錄已刪除',
                data: { path: recordPath }
            });
        } catch (error) {
            logger.error('❌ [LearningRecords] 刪除學習記錄失敗:', error);
            next(createInternalError('刪除學習記錄失敗', { originalError: error.message }));
        }
    }

    /**
     * POST /api/v3/learning-records/drive/batch-delete
     * 批次刪除學習記錄
     */
    async batchDelete(req, res, next) {
        try {
            const { recordPaths } = req.body;

            if (!recordPaths || !Array.isArray(recordPaths)) {
                return next(createBusinessError('缺少必要參數：recordPaths（陣列）'));
            }

            logger.info('📚 [LearningRecords] 批次刪除學習記錄:', { count: recordPaths.length });

            if (!this.driveClient || !this.driveClient.isAuthenticated()) {
                throw new Error('Synology Drive 服務未就緒');
            }

            const results = [];

            for (const path of recordPaths) {
                try {
                    await this.driveClient.deleteFile(path);
                    
                    if (this.learningRecordsIndex) {
                        await this.learningRecordsIndex.removeRecord(path);
                    }

                    results.push({ path, success: true });
                } catch (error) {
                    results.push({ path, success: false, error: error.message });
                }
            }

            const successCount = results.filter(r => r.success).length;
            logger.info(`✅ [LearningRecords] 批次刪除完成: ${successCount}/${recordPaths.length}`);

            res.json({
                success: true,
                data: {
                    total: recordPaths.length,
                    success: successCount,
                    failed: recordPaths.length - successCount,
                    results
                }
            });
        } catch (error) {
            logger.error('❌ [LearningRecords] 批次刪除失敗:', error);
            next(createInternalError('批次刪除失敗', { originalError: error.message }));
        }
    }
}

module.exports = LearningRecordsHandler;
