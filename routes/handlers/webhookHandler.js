/**
 * 🌐 Webhook Handler - LINE Webhook 業務邏輯
 * 
 * 處理 LINE Webhook 事件、Quick Reply、Postback
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createInternalError, createBusinessError } = require('../middleware/errorHandler');
const crypto = require('crypto');

class WebhookHandler {
    constructor(services = {}) {
        this.notificationManager = services.notificationManager;
        this.channelSecret = process.env.LINE_CHANNEL_SECRET || '';
    }

    /**
     * 驗證 LINE Webhook 簽名
     */
    verifySignature(body, signature) {
        const hash = crypto
            .createHmac('SHA256', this.channelSecret)
            .update(Buffer.from(JSON.stringify(body)))
            .digest('base64');
        return hash === signature;
    }

    /**
     * 處理 LINE Webhook
     */
    async handleWebhook(req, res, next) {
        try {
            const signature = req.headers['x-line-signature'];
            const body = req.body;

            // 驗證簽名
            if (!this.verifySignature(body, signature)) {
                console.error('❌ [Webhook] 無效的簽名');
                return res.status(401).json({ error: '無效的簽名' });
            }

            // 處理事件
            const events = body.events || [];
            const results = [];

            for (const event of events) {
                try {
                    const result = await this.processEvent(event);
                    results.push(result);
                } catch (error) {
                    console.error('❌ [Webhook] 處理事件失敗:', error);
                    results.push({ success: false, error: error.message });
                }
            }

            res.json({
                success: true,
                results
            });
        } catch (error) {
            console.error('❌ 處理 Webhook 失敗:', error);
            next(createInternalError('處理 Webhook 失敗', { originalError: error.message }));
        }
    }

    /**
     * 處理單個事件
     */
    async processEvent(event) {
        console.log('📩 [Webhook] 處理事件:', event.type);

        switch (event.type) {
            case 'message':
                return await this.handleMessage(event);
            case 'postback':
                return await this.handlePostback(event);
            case 'follow':
                return await this.handleFollow(event);
            case 'unfollow':
                return await this.handleUnfollow(event);
            default:
                console.log('⚠️ [Webhook] 未處理的事件類型:', event.type);
                return { success: true, message: '事件類型未處理' };
        }
    }

    /**
     * 處理訊息事件
     */
    async handleMessage(event) {
        const message = event.message;
        const userId = event.source.userId;

        console.log('💬 [Webhook] 收到訊息:', message.type, message.text);

        // 這裡可以根據訊息內容做出回應
        // 例如：關鍵字回覆、自動回應等

        return {
            success: true,
            type: 'message',
            messageType: message.type,
            userId
        };
    }

    /**
     * 處理 Postback 事件
     */
    async handlePostback(event) {
        const data = event.postback.data;
        const userId = event.source.userId;

        console.log('🔄 [Webhook] 收到 Postback:', data);

        // 解析 Postback data
        const params = new URLSearchParams(data);
        const action = params.get('action');

        // 根據 action 處理不同的操作
        // 例如：確認簽到、請假申請等

        return {
            success: true,
            type: 'postback',
            action,
            userId
        };
    }

    /**
     * 處理 Follow 事件
     */
    async handleFollow(event) {
        const userId = event.source.userId;

        console.log('➕ [Webhook] 新用戶關注:', userId);

        // 發送歡迎訊息
        if (this.notificationManager) {
            await this.notificationManager.sendMessage(
                userId,
                '歡迎使用 FLB 講師行事曆系統！'
            );
        }

        return {
            success: true,
            type: 'follow',
            userId
        };
    }

    /**
     * 處理 Unfollow 事件
     */
    async handleUnfollow(event) {
        const userId = event.source.userId;

        console.log('➖ [Webhook] 用戶取消關注:', userId);

        return {
            success: true,
            type: 'unfollow',
            userId
        };
    }

    /**
     * 取得 Webhook 統計
     */
    async getStats(req, res, next) {
        try {
            // 這裡可以實現統計邏輯
            // 例如：事件數量、類型分佈等

            res.json({
                success: true,
                data: {
                    enabled: true,
                    totalEvents: 0,
                    messageEvents: 0,
                    postbackEvents: 0,
                    followEvents: 0,
                    unfollowEvents: 0
                }
            });
        } catch (error) {
            console.error('❌ 取得 Webhook 統計失敗:', error);
            next(createInternalError('取得 Webhook 統計失敗', { originalError: error.message }));
        }
    }

    /**
     * 測試 Webhook
     */
    async testWebhook(req, res, next) {
        try {
            const testEvent = {
                type: 'message',
                message: {
                    type: 'text',
                    text: '測試訊息'
                },
                source: {
                    userId: 'test-user'
                }
            };

            const result = await this.processEvent(testEvent);

            res.json({
                success: true,
                message: 'Webhook 測試完成',
                data: result
            });
        } catch (error) {
            console.error('❌ 測試 Webhook 失敗:', error);
            next(createInternalError('測試 Webhook 失敗', { originalError: error.message }));
        }
    }
}

module.exports = WebhookHandler;
