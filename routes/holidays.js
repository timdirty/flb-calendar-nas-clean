/**
 * 🎄 假期管理路由模組
 * 
 * 提供所有假期相關的 API 端點
 * 支援假期資料讀取、檢查、同步功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const express = require('express');
const router = express.Router();

// 中間件
const { asyncHandler, notFoundHandler } = require('./middleware/errorHandler');
const { verifyAdminToken } = require('./middleware/auth');
const { validateParams, validateBody } = require('./validators/requestValidator');

// 處理器
const HolidayHandler = require('./handlers/holidayHandler');

// 驗證規則
const { ValidationRules, CommonSchemas } = require('./validators/requestValidator');

/**
 * 初始化假期路由
 */
function initHolidayRoutes(holidaySyncManager) {
    const holidayHandler = new HolidayHandler(holidaySyncManager);
    
    // 取得所有假日資料（公開端點）
    router.get('/',
        asyncHandler(holidayHandler.getHolidays.bind(holidayHandler))
    );
    
    // 檢查指定日期是否為假日（公開端點）
    router.get('/check/:date',
        validateParams({
            date: [ValidationRules.required, ValidationRules.date]
        }),
        asyncHandler(async (req, res, next) => {
            try {
                const { date } = req.params;
                const holidayManager = require('../holiday-sync-manager');
                const holidayManagerInstance = new holidayManager();
                const holiday = holidayManagerInstance.isHoliday(date);
                
                res.json({
                    success: true,
                    date: date,
                    isHoliday: !!holiday,
                    holiday: holiday
                });
            } catch (error) {
                const { createInternalError } = require('./middleware/errorHandler');
                next(createInternalError('檢查假日失敗', { originalError: error.message }));
            }
        })
    );
    
    // 取得指定月份的假日（公開端點）
    router.get('/month/:year/:month',
        validateParams({
            year: [ValidationRules.required, ValidationRules.integer, ValidationRules.positive],
            month: [ValidationRules.required, ValidationRules.integer, (value) => {
                const month = parseInt(value);
                if (month < 1 || month > 12) {
                    return '月份必須在 1-12 之間';
                }
                return null;
            }]
        }),
        asyncHandler(async (req, res, next) => {
            try {
                const year = parseInt(req.params.year);
                const month = parseInt(req.params.month);
                
                const holidayManager = require('../holiday-sync-manager');
                const holidayManagerInstance = new holidayManager();
                const holidays = holidayManagerInstance.getHolidaysInMonth(year, month);
                
                res.json({
                    success: true,
                    year: year,
                    month: month,
                    holidays: holidays,
                    count: holidays.length
                });
            } catch (error) {
                const { createInternalError } = require('./middleware/errorHandler');
                next(createInternalError('取得月份假日失敗', { originalError: error.message }));
            }
        })
    );
    
    // 手動觸發同步（需要管理員權限）
    router.post('/sync',
        verifyAdminToken,
        asyncHandler(holidayHandler.syncHolidays.bind(holidayHandler))
    );
    
    // 取得假日同步狀態（公開端點）
    router.get('/status',
        asyncHandler(holidayHandler.getHolidaySyncStatus.bind(holidayHandler))
    );
    
    // 清除假期快取（需要管理員權限）
    router.delete('/cache',
        verifyAdminToken,
        asyncHandler(holidayHandler.clearHolidayCache.bind(holidayHandler))
    );
    
    // 手動添加假期（需要管理員權限）
    router.post('/',
        verifyAdminToken,
        validateBody({
            date: [ValidationRules.required, ValidationRules.date],
            name: [ValidationRules.required, ValidationRules.maxLength(100)],
            type: [ValidationRules.optional, ValidationRules.enum(['holiday', 'working_day', 'special'])]
        }),
        asyncHandler(holidayHandler.addHoliday.bind(holidayHandler))
    );
    
    // 刪除假期（需要管理員權限）
    router.delete('/:date',
        verifyAdminToken,
        validateParams({
            date: [ValidationRules.required, ValidationRules.date]
        }),
        asyncHandler(holidayHandler.removeHoliday.bind(holidayHandler))
    );
    
    return router;
}

module.exports = initHolidayRoutes;
