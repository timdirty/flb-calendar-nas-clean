/**
 * 📅 Events Handler - 事件管理業務邏輯
 * 
 * 處理日曆事件的查詢、建立、更新、刪除
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createInternalError, createBusinessError } = require('../middleware/errorHandler');

class EventsHandler {
    constructor(services = {}) {
        this.calendarClient = services.calendarClient;
        this.eventsCache = services.eventsCache || { events: [], lastUpdate: null };
    }

    /**
     * 取得所有事件
     */
    async getEvents(req, res, next) {
        try {
            const forceRefresh = req.headers['x-force-refresh'] === 'true';
            
            // 檢查快取
            if (!forceRefresh && this.eventsCache.events && this.eventsCache.events.length > 0) {
                const cacheAge = Date.now() - (this.eventsCache.lastUpdate || 0);
                if (cacheAge < 5 * 60 * 1000) { // 5分鐘快取
                    return res.json({
                        success: true,
                        data: this.eventsCache.events,
                        cached: true,
                        cacheAge: Math.floor(cacheAge / 1000)
                    });
                }
            }

            if (!this.calendarClient) {
                return res.json({
                    success: true,
                    data: [],
                    message: '日曆服務未啟用'
                });
            }

            const events = await this.calendarClient.getEvents();
            
            // 更新快取
            this.eventsCache.events = events;
            this.eventsCache.lastUpdate = Date.now();

            res.json({
                success: true,
                data: events,
                cached: false
            });
        } catch (error) {
            console.error('❌ 取得事件失敗:', error);
            next(createInternalError('取得事件失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得單一事件
     */
    async getEvent(req, res, next) {
        try {
            const { eventId } = req.params;

            if (!this.calendarClient) {
                return next(createBusinessError('日曆服務未啟用'));
            }

            const event = await this.calendarClient.getEvent(eventId);

            if (!event) {
                return next(createBusinessError('事件不存在'));
            }

            res.json({
                success: true,
                data: event
            });
        } catch (error) {
            console.error('❌ 取得事件失敗:', error);
            next(createInternalError('取得事件失敗', { originalError: error.message }));
        }
    }

    /**
     * 建立事件
     */
    async createEvent(req, res, next) {
        try {
            const eventData = req.body;

            if (!eventData.title || !eventData.start) {
                return next(createBusinessError('缺少必要欄位：title, start'));
            }

            if (!this.calendarClient) {
                return next(createBusinessError('日曆服務未啟用'));
            }

            const newEvent = await this.calendarClient.createEvent(eventData);

            // 清除快取
            this.eventsCache.events = [];
            this.eventsCache.lastUpdate = null;

            res.json({
                success: true,
                message: '事件建立成功',
                data: newEvent
            });
        } catch (error) {
            console.error('❌ 建立事件失敗:', error);
            next(createInternalError('建立事件失敗', { originalError: error.message }));
        }
    }

    /**
     * 更新事件
     */
    async updateEvent(req, res, next) {
        try {
            const { eventId } = req.params;
            const eventData = req.body;

            if (!this.calendarClient) {
                return next(createBusinessError('日曆服務未啟用'));
            }

            const updatedEvent = await this.calendarClient.updateEvent(eventId, eventData);

            // 清除快取
            this.eventsCache.events = [];
            this.eventsCache.lastUpdate = null;

            res.json({
                success: true,
                message: '事件更新成功',
                data: updatedEvent
            });
        } catch (error) {
            console.error('❌ 更新事件失敗:', error);
            next(createInternalError('更新事件失敗', { originalError: error.message }));
        }
    }

    /**
     * 刪除事件
     */
    async deleteEvent(req, res, next) {
        try {
            const { eventId } = req.params;

            if (!this.calendarClient) {
                return next(createBusinessError('日曆服務未啟用'));
            }

            await this.calendarClient.deleteEvent(eventId);

            // 清除快取
            this.eventsCache.events = [];
            this.eventsCache.lastUpdate = null;

            res.json({
                success: true,
                message: '事件已刪除'
            });
        } catch (error) {
            console.error('❌ 刪除事件失敗:', error);
            next(createInternalError('刪除事件失敗', { originalError: error.message }));
        }
    }

    /**
     * 取得快取狀態
     */
    async getCacheStatus(req, res, next) {
        try {
            // 🔥 [修復] 確保 eventsCache 已初始化
            if (!this.eventsCache) {
                this.eventsCache = { events: [], lastUpdate: null };
            }
            
            const cacheAge = this.eventsCache.lastUpdate 
                ? Math.floor((Date.now() - this.eventsCache.lastUpdate) / 1000) 
                : null;
            
            res.json({
                success: true,
                data: {
                    cached: Array.isArray(this.eventsCache.events) && this.eventsCache.events.length > 0,
                    eventCount: Array.isArray(this.eventsCache.events) ? this.eventsCache.events.length : 0,
                    cacheAge,
                    lastUpdate: this.eventsCache.lastUpdate
                }
            });
        } catch (error) {
            console.error('❌ 取得快取狀態失敗:', error);
            next(createInternalError('取得快取狀態失敗', { originalError: error.message }));
        }
    }

    /**
     * 清除快取
     */
    async clearCache(req, res, next) {
        try {
            this.eventsCache.events = [];
            this.eventsCache.lastUpdate = null;

            res.json({
                success: true,
                message: '快取已清除'
            });
        } catch (error) {
            console.error('❌ 清除快取失敗:', error);
            next(createInternalError('清除快取失敗', { originalError: error.message }));
        }
    }

    /**
     * 標記特殊事件
     */
    async markSpecial(req, res, next) {
        try {
            const { eventId, markers } = req.body;

            if (!eventId || !markers) {
                return next(createBusinessError('缺少必要參數：eventId, markers'));
            }

            if (!this.calendarClient) {
                return next(createBusinessError('日曆服務未啟用'));
            }

            const result = await this.calendarClient.markSpecialEvent(eventId, markers);

            // 清除快取
            this.eventsCache.events = [];
            this.eventsCache.lastUpdate = null;

            res.json({
                success: true,
                message: '特殊事件標記成功',
                data: result
            });
        } catch (error) {
            console.error('❌ 標記特殊事件失敗:', error);
            next(createInternalError('標記特殊事件失敗', { originalError: error.message }));
        }
    }
}

module.exports = EventsHandler;
