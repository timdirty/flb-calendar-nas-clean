// ============================================
// 時間工具模組 - 統一使用台北時區 (Asia/Taipei)
// ============================================
// 🔥 所有日期操作統一使用此模組，確保時區一致性
// 版本：2025-11-01

(function() {
    'use strict';

    // 台北時區常數
    const TIMEZONE = 'Asia/Taipei';
    const TIMEZONE_OFFSET = 8; // UTC+8

    /**
     * 將任意日期轉換為台北時區的日期物件
     * @param {Date|string|number} dateInput - 日期輸入（Date物件、ISO字串、時間戳）
     * @returns {Date} 台北時區的日期物件
     */
    function toTaipeiDate(dateInput) {
        if (!dateInput) {
            return new Date();
        }

        let date;
        if (dateInput instanceof Date) {
            date = new Date(dateInput);
        } else if (typeof dateInput === 'string') {
            // 解析 ISO 字串，考慮時區
            date = new Date(dateInput);
        } else if (typeof dateInput === 'number') {
            date = new Date(dateInput);
        } else {
            date = new Date();
        }

        // 使用 Intl API 獲取台北時區的日期時間組件
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: TIMEZONE,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const parts = formatter.formatToParts(date);
        const year = parseInt(parts.find(p => p.type === 'year').value);
        const month = parseInt(parts.find(p => p.type === 'month').value) - 1; // 月份從 0 開始
        const day = parseInt(parts.find(p => p.type === 'day').value);
        const hour = parseInt(parts.find(p => p.type === 'hour').value);
        const minute = parseInt(parts.find(p => p.type === 'minute').value);
        const second = parseInt(parts.find(p => p.type === 'second').value);

        // 創建本地日期物件（使用台北時區的數值）
        return new Date(year, month, day, hour, minute, second);
    }

    /**
     * 獲取台北時區的今天日期（00:00:00）
     * @returns {Date} 台北時區今天的開始時間
     */
    function getTodayInTaipei() {
        const now = new Date();
        const taipeiDate = toTaipeiDate(now);
        taipeiDate.setHours(0, 0, 0, 0);
        return taipeiDate;
    }

    /**
     * 獲取指定日期的台北時區日期（00:00:00）
     * @param {Date|string} dateInput - 日期輸入
     * @returns {Date} 台北時區的日期（當天開始）
     */
    function getDateStartInTaipei(dateInput) {
        const taipeiDate = toTaipeiDate(dateInput);
        taipeiDate.setHours(0, 0, 0, 0);
        return taipeiDate;
    }

    /**
     * 獲取指定日期的台北時區日期（23:59:59）
     * @param {Date|string} dateInput - 日期輸入
     * @returns {Date} 台北時區的日期（當天結束）
     */
    function getDateEndInTaipei(dateInput) {
        const taipeiDate = toTaipeiDate(dateInput);
        taipeiDate.setHours(23, 59, 59, 999);
        return taipeiDate;
    }

    /**
     * 格式化日期為 YYYY-MM-DD（使用台北時區）
     * @param {Date|string} dateInput - 日期輸入
     * @returns {string} YYYY-MM-DD 格式的日期字串
     */
    function formatDateKey(dateInput) {
        const taipeiDate = toTaipeiDate(dateInput);
        const year = taipeiDate.getFullYear();
        const month = String(taipeiDate.getMonth() + 1).padStart(2, '0');
        const day = String(taipeiDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 格式化日期為 YYYY/MM/DD（使用台北時區）
     * @param {Date|string} dateInput - 日期輸入
     * @returns {string} YYYY/MM/DD 格式的日期字串
     */
    function formatDateForDisplay(dateInput) {
        const taipeiDate = toTaipeiDate(dateInput);
        return `${taipeiDate.getFullYear()}/${String(taipeiDate.getMonth() + 1).padStart(2, '0')}/${String(taipeiDate.getDate()).padStart(2, '0')}`;
    }

    /**
     * 格式化時間為 HH:mm（使用台北時區）
     * @param {Date|string} dateInput - 日期輸入
     * @returns {string} HH:mm 格式的時間字串
     */
    function formatTimeForDisplay(dateInput) {
        const taipeiDate = toTaipeiDate(dateInput);
        return `${String(taipeiDate.getHours()).padStart(2, '0')}:${String(taipeiDate.getMinutes()).padStart(2, '0')}`;
    }

    /**
     * 比較兩個日期是否在同一天（使用台北時區）
     * @param {Date|string} date1 - 第一個日期
     * @param {Date|string} date2 - 第二個日期
     * @returns {boolean} 是否在同一天
     */
    function isSameDayInTaipei(date1, date2) {
        const key1 = formatDateKey(date1);
        const key2 = formatDateKey(date2);
        return key1 === key2;
    }

    /**
     * 獲取本週週日的日期（使用台北時區）
     * @param {Date|string} dateInput - 參考日期（預設為今天）
     * @returns {Date} 本週週日的日期
     */
    function getWeekStartInTaipei(dateInput) {
        const taipeiDate = toTaipeiDate(dateInput || new Date());
        const dayOfWeek = taipeiDate.getDay(); // 0 = 週日, 1 = 週一, ..., 6 = 週六
        const weekStart = new Date(taipeiDate);
        weekStart.setDate(taipeiDate.getDate() - dayOfWeek);
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
    }

    /**
     * 獲取事件日期在台北時區的日期鍵
     * @param {Object} event - 事件物件（包含 start 屬性）
     * @returns {string} YYYY-MM-DD 格式的日期鍵
     */
    function getEventDateKeyInTaipei(event) {
        if (!event || !event.start) {
            return null;
        }
        return formatDateKey(event.start);
    }

    /**
     * 檢查事件是否在指定日期範圍內（使用台北時區）
     * @param {Object} event - 事件物件（包含 start 和 end 屬性）
     * @param {Date} rangeStart - 範圍開始日期
     * @param {Date} rangeEnd - 範圍結束日期
     * @returns {boolean} 事件是否在範圍內
     */
    function isEventInDateRangeInTaipei(event, rangeStart, rangeEnd) {
        if (!event || !event.start) {
            return false;
        }

        const eventStart = getDateStartInTaipei(event.start);
        const eventEnd = event.end ? getDateEndInTaipei(event.end) : eventStart;
        const rangeStartDate = getDateStartInTaipei(rangeStart);
        const rangeEndDate = getDateEndInTaipei(rangeEnd);

        // 事件與範圍有交集即為在範圍內
        return (eventStart <= rangeEndDate && eventEnd >= rangeStartDate);
    }

    // 導出工具函數（掛載到 window 對象）
    window.TaipeiTimeUtils = {
        TIMEZONE,
        TIMEZONE_OFFSET,
        toTaipeiDate,
        getTodayInTaipei,
        getDateStartInTaipei,
        getDateEndInTaipei,
        formatDateKey,
        formatDateForDisplay,
        formatTimeForDisplay,
        isSameDayInTaipei,
        getWeekStartInTaipei,
        getEventDateKeyInTaipei,
        isEventInDateRangeInTaipei
    };

    console.log('✅ 時間工具模組已載入（統一使用台北時區）');
})();







































