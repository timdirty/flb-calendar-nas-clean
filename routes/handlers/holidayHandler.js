/**
 * 🎄 假期管理路由處理器
 * 
 * 處理所有假期相關的 API 端點
 * 支援假期資料的讀取、快取管理、同步功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { createInternalError, createBusinessError } = require('../middleware/errorHandler');

// 🔥 [修復] 使用 console 替代 logger，避免初始化問題
// const logger = require('../../utils/logger');

/**
 * 假期處理器類別
 */
class HolidayHandler {
    constructor(holidaySyncManager) {
        this.holidaySyncManager = holidaySyncManager;
    }
    
    /**
     * 獲取假期資料
     */
    async getHolidays(req, res, next) {
        try {
            console.log('📝 [Holiday] 請求獲取假期資料');
            
            // 使用傳入的 holidaySyncManager 實例，或建立新實例
            let holidayManager = this.holidaySyncManager;
            console.log('🔍 [Holiday] holidayManager exists:', !!holidayManager);
            
            if (!holidayManager) {
                console.log('⚠️ [Holiday] holidaySyncManager 未傳入，建立新實例');
                const HolidaySyncManager = require('../../holiday-sync-manager');
                holidayManager = new HolidaySyncManager();
                console.log('🔍 [Holiday] 新實例創建完成');
            }
            
            console.log('🔍 [Holiday] 調用 getHolidays()...');
            const holidays = holidayManager.getHolidays();
            console.log('🔍 [Holiday] getHolidays() 返回:', holidays ? '有資料' : '無資料');
            
            // 🔥 [修復] 確保返回的資料結構正確
            const responseData = holidays || {
                holidays: [],
                enabledDates: [],
                year: new Date().getFullYear(),
                customHolidays: []
            };
            
            console.log('✅ [Holiday] 返回假期資料，數量:', responseData.holidays?.length || 0);
            return res.json({
                success: true,
                data: responseData,
                lastSync: holidayManager.lastSyncTime || null,
                count: responseData.holidays?.length || 0
            });
            
        } catch (error) {
            console.error('❌ [Holiday] 獲取假期資料失敗:', error.message);
            console.error('❌ [Holiday] 錯誤堆疊:', error.stack);
            next(createInternalError('獲取假期資料失敗', { originalError: error.message }));
        }
    }
    
    /**
     * 清除假期快取
     */
    async clearHolidayCache(req, res, next) {
        try {
            console.log('🗑️ [Holiday] 請求清除假期快取');
            
            // 清除快取
            delete req.app.locals.holidayCache;
            
            console.log('✅ [Holiday] 假期快取已清除');
            return res.json({
                success: true,
                message: '假期快取已清除'
            });
            
        } catch (error) {
            console.error('❌ [Holiday] 清除假期快取失敗:', error);
            next(createInternalError('清除假期快取失敗', { originalError: error.message }));
        }
    }
    
    /**
     * 同步假期資料
     */
    async syncHolidays(req, res, next) {
        try {
            console.log('🔄 [Holiday] 請求同步假期資料');
            
            if (!this.holidaySyncManager) {
                console.warn('⚠️ [Holiday] 假期同步管理器未初始化');
                return next(createBusinessError('假期同步功能暫時不可用'));
            }
            
            // 執行同步
            const syncResult = await this.holidaySyncManager.syncHolidays();
            
            // 清除快取以使用新資料
            delete req.app.locals.holidayCache;
            
            console.log('✅ [Holiday] 假期同步完成:', syncResult);
            return res.json({
                success: true,
                message: '假期資料同步完成',
                data: syncResult
            });
            
        } catch (error) {
            console.error('❌ [Holiday] 同步假期資料失敗:', error);
            next(createInternalError('同步假期資料失敗', { originalError: error.message }));
        }
    }
    
    /**
     * 獲取假期同步狀態
     */
    async getHolidaySyncStatus(req, res, next) {
        try {
            console.log('📊 [Holiday] 請求獲取假期同步狀態');
            
            if (!this.holidaySyncManager) {
                return res.json({
                    success: true,
                    data: {
                        available: false,
                        message: '假期同步功能暫時不可用'
                    }
                });
            }
            
            // 🔥 [修復] 正確的方法名是 getStatus()，且是同步方法（不需要 await）
            const status = this.holidaySyncManager.getStatus();
            
            console.log('✅ [Holiday] 返回假期同步狀態');
            return res.json({
                success: true,
                data: {
                    available: true,
                    ...status
                }
            });
            
        } catch (error) {
            console.error('❌ [Holiday] 獲取假期同步狀態失敗:', error.message);
            console.error('❌ [Holiday] 錯誤堆疊:', error.stack);
            next(createInternalError('獲取假期同步狀態失敗', { originalError: error.message }));
        }
    }
    
    /**
     * 手動添加假期
     */
    async addHoliday(req, res, next) {
        try {
            console.log('➕ [Holiday] 請求添加假期:', req.body);
            
            const { date, name, type } = req.body;
            
            // 驗證必要參數
            if (!date || !name) {
                return next(createBusinessError('缺少必要參數：日期和名稱', {
                    required: ['date', 'name'],
                    provided: Object.keys(req.body)
                }));
            }
            
            // 驗證日期格式
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                return next(createBusinessError('日期格式錯誤，請使用 YYYY-MM-DD 格式', {
                    provided: date,
                    expected: 'YYYY-MM-DD'
                }));
            }
            
            // 讀取現有假期資料
            const fs = require('fs').promises;
            const path = require('path');
            const holidaysPath = path.join(process.cwd(), 'data', 'holidays.json');
            
            let holidays = [];
            try {
                const holidayData = await fs.readFile(holidaysPath, 'utf8');
                holidays = JSON.parse(holidayData);
            } catch (error) {
                console.log('📝 [Holiday] 創建新的假期檔案');
            }
            
            // 檢查是否已存在相同日期的假期
            const existingHoliday = holidays.find(h => h.date === date);
            if (existingHoliday) {
                return next(createBusinessError('該日期已存在假期', {
                    date,
                    existing: existingHoliday
                }));
            }
            
            // 添加新假期
            const newHoliday = {
                date,
                name,
                type: type || 'holiday',
                createdAt: new Date().toISOString(),
                source: 'manual'
            };
            
            holidays.push(newHoliday);
            holidays.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // 儲存檔案
            await fs.writeFile(holidaysPath, JSON.stringify(holidays, null, 2));
            
            // 清除快取
            delete req.app.locals.holidayCache;
            
            console.log('✅ [Holiday] 假期添加成功:', newHoliday);
            return res.json({
                success: true,
                message: '假期添加成功',
                data: newHoliday
            });
            
        } catch (error) {
            console.error('❌ [Holiday] 添加假期失敗:', error);
            next(createInternalError('添加假期失敗', { originalError: error.message }));
        }
    }
    
    /**
     * 刪除假期
     */
    async removeHoliday(req, res, next) {
        try {
            const { date } = req.params;
            console.log('🗑️ [Holiday] 請求刪除假期:', date);
            
            // 驗證日期格式
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (!dateRegex.test(date)) {
                return next(createBusinessError('日期格式錯誤，請使用 YYYY-MM-DD 格式', {
                    provided: date,
                    expected: 'YYYY-MM-DD'
                }));
            }
            
            // 讀取現有假期資料
            const fs = require('fs').promises;
            const path = require('path');
            const holidaysPath = path.join(process.cwd(), 'data', 'holidays.json');
            
            let holidays = [];
            try {
                const holidayData = await fs.readFile(holidaysPath, 'utf8');
                holidays = JSON.parse(holidayData);
            } catch (error) {
                return next(createBusinessError('假期檔案不存在'));
            }
            
            // 找到要刪除的假期
            const holidayIndex = holidays.findIndex(h => h.date === date);
            if (holidayIndex === -1) {
                return next(createBusinessError('找不到指定日期的假期', { date }));
            }
            
            const removedHoliday = holidays[holidayIndex];
            holidays.splice(holidayIndex, 1);
            
            // 儲存檔案
            await fs.writeFile(holidaysPath, JSON.stringify(holidays, null, 2));
            
            // 清除快取
            delete req.app.locals.holidayCache;
            
            console.log('✅ [Holiday] 假期刪除成功:', removedHoliday);
            return res.json({
                success: true,
                message: '假期刪除成功',
                data: removedHoliday
            });
            
        } catch (error) {
            console.error('❌ [Holiday] 刪除假期失敗:', error);
            next(createInternalError('刪除假期失敗', { originalError: error.message }));
        }
    }
}

module.exports = HolidayHandler;
