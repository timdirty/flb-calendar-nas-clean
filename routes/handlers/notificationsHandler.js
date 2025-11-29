/**
 * 🔔 Notifications Handler - 通知管理業務邏輯
 * 
 * 處理通知發送、Flex Message 管理
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createInternalError, createBusinessError } = require('../middleware/errorHandler');

class NotificationsHandler {
    constructor(services = {}) {
        this.notificationManager = services.notificationManager;
    }

    /**
     * 發送通知
     */
    async sendNotification(req, res, next) {
        try {
            const { recipient, message, type } = req.body;

            if (!recipient || !message) {
                return next(createBusinessError('缺少必要參數：recipient, message'));
            }

            if (!this.notificationManager) {
                return next(createBusinessError('通知服務未啟用'));
            }

            const result = await this.notificationManager.sendMessage(recipient, message, type);

            res.json({
                success: true,
                message: '通知已發送',
                data: result
            });
        } catch (error) {
            console.error('❌ 發送通知失敗:', error);
            next(createInternalError('發送通知失敗', { originalError: error.message }));
        }
    }

    /**
     * 批次發送通知
     */
    async sendBatchNotifications(req, res, next) {
        try {
            const { recipients, message, type } = req.body;

            if (!recipients || !Array.isArray(recipients) || !message) {
                return next(createBusinessError('缺少必要參數：recipients (陣列), message'));
            }

            if (!this.notificationManager) {
                return next(createBusinessError('通知服務未啟用'));
            }

            const results = [];
            for (const recipient of recipients) {
                try {
                    const result = await this.notificationManager.sendMessage(recipient, message, type);
                    results.push({ recipient, success: true, result });
                } catch (err) {
                    results.push({ recipient, success: false, error: err.message });
                }
            }

            res.json({
                success: true,
                message: '批次通知已發送',
                data: {
                    total: recipients.length,
                    successful: results.filter(r => r.success).length,
                    failed: results.filter(r => !r.success).length,
                    results
                }
            });
        } catch (error) {
            console.error('❌ 批次發送通知失敗:', error);
            next(createInternalError('批次發送通知失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得 Flex Message 範本列表
     */
    async getFlexTemplates(req, res, next) {
        try {
            if (!this.notificationManager) {
                return res.json({
                    success: true,
                    data: []
                });
            }

            const templates = this.notificationManager.getFlexTemplates ? 
                await this.notificationManager.getFlexTemplates() : 
                [];

            res.json({
                success: true,
                data: templates
            });
        } catch (error) {
            console.error('❌ 取得 Flex 範本失敗:', error);
            next(createInternalError('取得 Flex 範本失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得指定 Flex Message 範本
     */
    async getFlexTemplate(req, res, next) {
        try {
            const { templateId } = req.params;

            if (!this.notificationManager) {
                return next(createBusinessError('通知服務未啟用'));
            }

            const template = this.notificationManager.getFlexTemplate ? 
                await this.notificationManager.getFlexTemplate(templateId) : 
                null;

            if (!template) {
                return next(createBusinessError('範本不存在'));
            }

            res.json({
                success: true,
                data: template
            });
        } catch (error) {
            console.error('❌ 取得 Flex 範本失敗:', error);
            next(createInternalError('取得 Flex 範本失敗', { originalError: error.message }));
        }
    }

    /**
     * 更新 Flex Message 範本
     */
    async updateFlexTemplate(req, res, next) {
        try {
            const { templateId } = req.params;
            const templateData = req.body;

            if (!this.notificationManager) {
                return next(createBusinessError('通知服務未啟用'));
            }

            if (typeof this.notificationManager.updateFlexTemplate !== 'function') {
                return next(createBusinessError('不支援更新範本功能'));
            }

            await this.notificationManager.updateFlexTemplate(templateId, templateData);

            res.json({
                success: true,
                message: 'Flex 範本已更新'
            });
        } catch (error) {
            console.error('❌ 更新 Flex 範本失敗:', error);
            next(createInternalError('更新 Flex 範本失敗', { originalError: error.message }));
        }
    }

    /**
     * 發送 Flex Message
     */
    async sendFlexMessage(req, res, next) {
        try {
            const { recipient, templateId, data } = req.body;

            if (!recipient || !templateId) {
                return next(createBusinessError('缺少必要參數：recipient, templateId'));
            }

            if (!this.notificationManager) {
                return next(createBusinessError('通知服務未啟用'));
            }

            const result = await this.notificationManager.sendFlexMessage(recipient, templateId, data);

            res.json({
                success: true,
                message: 'Flex Message 已發送',
                data: result
            });
        } catch (error) {
            console.error('❌ 發送 Flex Message 失敗:', error);
            next(createInternalError('發送 Flex Message 失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得發送歷史
     */
    async getHistory(req, res, next) {
        try {
            const { limit = 50, offset = 0 } = req.query;

            if (!this.notificationManager) {
                return res.json({
                    success: true,
                    data: {
                        history: [],
                        total: 0
                    }
                });
            }

            const history = this.notificationManager.getHistory ? 
                await this.notificationManager.getHistory(parseInt(limit), parseInt(offset)) : 
                [];

            res.json({
                success: true,
                data: {
                    history,
                    total: history.length,
                    limit: parseInt(limit),
                    offset: parseInt(offset)
                }
            });
        } catch (error) {
            console.error('❌ 取得發送歷史失敗:', error);
            next(createInternalError('取得發送歷史失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得統計資訊
     */
    async getStats(req, res, next) {
        try {
            if (!this.notificationManager) {
                return res.json({
                    success: true,
                    data: {
                        enabled: false,
                        total: 0,
                        sent: 0,
                        failed: 0
                    }
                });
            }

            const stats = this.notificationManager.getStats ? 
                await this.notificationManager.getStats() : 
                { total: 0, sent: 0, failed: 0 };

            res.json({
                success: true,
                data: stats
            });
        } catch (error) {
            console.error('❌ 取得統計資訊失敗:', error);
            next(createInternalError('取得統計資訊失敗', { originalError: error.message }));
        }
    }
}

module.exports = NotificationsHandler;
