/**
 * ✅ Attendance Handler - 簽到管理業務邏輯
 * 
 * 處理學生簽到、隊列管理、快取控制
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createInternalError, createBusinessError } = require('../middleware/errorHandler');

class AttendanceHandler {
    constructor(services = {}) {
        this.fastAttendanceService = services.fastAttendance;
        this.attendanceQueueManager = services.attendanceQueueManager;
    }

    /**
     * 極速簽到
     */
    async recordFastAttendance(req, res, next) {
        try {
            const { 
                studentName, courseName, courseDate, 
                location, checkInTime, userId 
            } = req.body;

            // 驗證必要參數
            if (!studentName || !courseName || !courseDate) {
                return next(createBusinessError('缺少必要參數：studentName, courseName, courseDate'));
            }

            if (!this.fastAttendanceService) {
                throw new Error('FastAttendance 服務未初始化');
            }

            // 執行簽到
            const result = await this.fastAttendanceService.recordAttendance({
                studentName,
                courseName,
                courseDate,
                location: location || '',
                checkInTime: checkInTime || new Date().toISOString(),
                userId: userId || ''
            });

            console.log('✅ 簽到成功:', studentName, courseName);

            res.json({
                success: true,
                message: '簽到成功',
                data: result
            });
        } catch (error) {
            console.error('❌ 簽到失敗:', error);
            next(createInternalError('簽到失敗', { originalError: error.message }));
        }
    }

    /**
     * 簽到隊列（異步處理）
     */
    async queueAttendance(req, res, next) {
        try {
            const attendanceData = req.body;

            if (!attendanceData.studentName || !attendanceData.courseName || !attendanceData.courseDate) {
                return next(createBusinessError('缺少必要參數'));
            }

            if (!this.attendanceQueueManager) {
                return res.json({
                    success: false,
                    message: '簽到隊列服務未啟用，請使用極速簽到功能'
                });
            }

            // 加入隊列
            const queueId = await this.attendanceQueueManager.addToQueue(attendanceData);

            console.log('📥 簽到已加入隊列:', queueId);

            // 立即返回
            res.json({
                success: true,
                message: '簽到已加入處理隊列',
                data: {
                    queueId,
                    status: 'queued'
                }
            });
        } catch (error) {
            console.error('❌ 簽到隊列失敗:', error);
            next(createInternalError('簽到隊列失敗', { originalError: error.message }));
        }
    }

    /**
     * 查詢簽到狀態
     */
    async getAttendanceStatus(req, res, next) {
        try {
            const { course, date } = req.query;

            if (!course || !date) {
                return next(createBusinessError('缺少必要參數：course, date'));
            }

            if (!this.fastAttendanceService) {
                throw new Error('FastAttendance 服務未初始化');
            }

            const status = await this.fastAttendanceService.getAttendanceStatus(course, date);

            res.json({
                success: true,
                data: status
            });
        } catch (error) {
            console.error('❌ 查詢簽到狀態失敗:', error);
            next(createInternalError('查詢簽到狀態失敗', { originalError: error.message }));
        }
    }

    /**
     * 查詢隊列狀態
     */
    async getQueueStats(req, res, next) {
        try {
            if (!this.attendanceQueueManager) {
                return res.json({
                    success: true,
                    data: {
                        enabled: false,
                        message: '簽到隊列服務未啟用'
                    }
                });
            }

            const stats = this.attendanceQueueManager.getQueueStats();

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('❌ 查詢隊列狀態失敗:', error);
            next(createInternalError('查詢隊列狀態失敗', { originalError: error.message }));
        }
    }

    /**
     * 重試失敗記錄
     */
    async retryFailed(req, res, next) {
        try {
            if (!this.attendanceQueueManager) {
                throw new Error('AttendanceQueueManager 服務未初始化');
            }

            await this.attendanceQueueManager.processQueue();
            const stats = this.attendanceQueueManager.getQueueStats();

            res.json({
                success: true,
                message: '失敗記錄重試中',
                data: stats
            });
        } catch (error) {
            console.error('❌ 重試失敗記錄失敗:', error);
            next(createInternalError('重試失敗記錄失敗', { originalError: error.message }));
        }
    }

    /**
     * 清除快取
     */
    async clearCache(req, res, next) {
        try {
            if (this.fastAttendanceService && typeof this.fastAttendanceService.clearCache === 'function') {
                this.fastAttendanceService.clearCache();
            }

            res.json({
                success: true,
                message: '簽到快取已清除'
            });
        } catch (error) {
            console.error('❌ 清除快取失敗:', error);
            next(createInternalError('清除快取失敗', { originalError: error.message }));
        }
    }

    /**
     * 調試：查看學生列表
     */
    async debugStudents(req, res, next) {
        try {
            if (!this.fastAttendanceService) {
                throw new Error('FastAttendance 服務未初始化');
            }

            if (!this.fastAttendanceService.initialized) {
                await this.fastAttendanceService.initialize();
            }

            const students = this.fastAttendanceService.getStudentList ? 
                await this.fastAttendanceService.getStudentList() : 
                [];

            res.json({
                success: true,
                data: students,
                count: students.length
            });
        } catch (error) {
            console.error('❌ 取得學生列表失敗:', error);
            next(createInternalError('取得學生列表失敗', { originalError: error.message }));
        }
    }

    /**
     * Quick Reply 出席回應
     */
    async quickReplyAttendance(req, res, next) {
        try {
            const { studentName, courseName, courseDate, response, leaveReason } = req.body;

            if (!studentName || !courseName || !courseDate || !response) {
                return next(createBusinessError('缺少必要參數'));
            }

            // 根據回應處理
            let result;
            if (response === 'attend') {
                // 簽到
                result = await this.recordFastAttendance({
                    body: { studentName, courseName, courseDate }
                }, { json: () => {} }, () => {});
            } else if (response === 'leave') {
                // 請假處理
                result = {
                    status: 'leave',
                    reason: leaveReason || '未提供原因'
                };
            } else {
                return next(createBusinessError('無效的回應類型'));
            }

            res.json({
                success: true,
                message: 'Quick Reply 處理完成',
                data: result
            });
        } catch (error) {
            console.error('❌ Quick Reply 處理失敗:', error);
            next(createInternalError('Quick Reply 處理失敗', { originalError: error.message }));
        }
    }
}

module.exports = AttendanceHandler;
