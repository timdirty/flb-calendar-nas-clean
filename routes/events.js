/**
 * 📅 Events Routes - 事件管理路由
 */

const express = require('express');
const EventsHandler = require('./handlers/eventsHandler');
const { asyncHandler } = require('./middleware/errorHandler');
const { verifyAdminToken } = require('./middleware/auth');

/**
 * 初始化 Events 路由
 */
function initEventsRoutes(services = {}) {
    const router = express.Router();
    const handler = new EventsHandler(services);

    // 📖 公開端點
    router.get('/', asyncHandler(handler.getEvents.bind(handler)));
    router.get('/cache/status', asyncHandler(handler.getCacheStatus.bind(handler)));
    router.get('/:eventId', asyncHandler(handler.getEvent.bind(handler)));

    // 🔒 管理員端點
    router.post('/', verifyAdminToken, asyncHandler(handler.createEvent.bind(handler)));
    router.put('/:eventId', verifyAdminToken, asyncHandler(handler.updateEvent.bind(handler)));
    router.delete('/:eventId', verifyAdminToken, asyncHandler(handler.deleteEvent.bind(handler)));
    router.post('/cache/clear', verifyAdminToken, asyncHandler(handler.clearCache.bind(handler)));
    router.post('/mark-special', verifyAdminToken, asyncHandler(handler.markSpecial.bind(handler)));

    console.log('✅ [Events] Events 路由已初始化');
    return router;
}

module.exports = { initEventsRoutes };
