/**
 * 統一日期格式化工具
 * 用於前後端統一的日期格式化
 */

/**
 * 格式化日期為 YYYY-MM-DD
 * @param {Date|string|number} dateInput - 日期輸入（可選）
 * @returns {string} 格式化的日期字串
 */
function formatDateYYYYMMDD(dateInput) {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        if (isNaN(d.getTime())) {
            return formatDateYYYYMMDD(Date.now());
        }
        
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    } catch (e) {
        console.error('❌ 格式化日期失敗:', e);
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
}

/**
 * 格式化日期時間為 YYYY-MM-DD HH:mm:ss
 * @param {Date|string|number} dateInput - 日期輸入（可選）
 * @returns {string} 格式化的日期時間字串
 */
function formatDateTime(dateInput) {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        if (isNaN(d.getTime())) {
            return formatDateTime(Date.now());
        }
        
        const date = formatDateYYYYMMDD(d);
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return `${date} ${hours}:${minutes}:${seconds}`;
    } catch (e) {
        console.error('❌ 格式化日期時間失敗:', e);
        return formatDateYYYYMMDD(Date.now()) + ' 00:00:00';
    }
}

/**
 * 格式化日期為台灣格式（民國年）
 * @param {Date|string|number} dateInput - 日期輸入（可選）
 * @returns {string} 格式化的台灣日期字串（例：114/11/17）
 */
function formatDateTaiwan(dateInput) {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        if (isNaN(d.getTime())) {
            return formatDateTaiwan(Date.now());
        }
        
        const year = d.getFullYear() - 1911; // 轉換為民國年
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        return `${year}/${month}/${day}`;
    } catch (e) {
        console.error('❌ 格式化台灣日期失敗:', e);
        const now = new Date();
        const rocYear = now.getFullYear() - 1911;
        return `${rocYear}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
    }
}

/**
 * 格式化日期為顯示用格式（含星期）
 * @param {Date|string|number} dateInput - 日期輸入（可選）
 * @returns {string} 格式化的顯示日期（例：2025年11月17日(日)）
 */
function formatDateDisplay(dateInput) {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        if (isNaN(d.getTime())) {
            return formatDateDisplay(Date.now());
        }
        
        const year = d.getFullYear();
        const month = d.getMonth() + 1;
        const day = d.getDate();
        const weekdayChars = ['日', '一', '二', '三', '四', '五', '六'];
        const weekday = weekdayChars[d.getDay()];
        
        return `${year}年${month}月${day}日(${weekday})`;
    } catch (e) {
        console.error('❌ 格式化顯示日期失敗:', e);
        return formatDateYYYYMMDD(Date.now());
    }
}

/**
 * 取得星期漢字
 * @param {Date|string|number} dateInput - 日期輸入（可選）
 * @returns {string} 星期漢字
 */
function getWeekdayChar(dateInput) {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        const weekdayChars = ['日', '一', '二', '三', '四', '五', '六'];
        return weekdayChars[d.getDay()] || '';
    } catch (e) {
        return '';
    }
}

/**
 * 計算日期差距（天數）
 * @param {Date|string|number} date1 - 日期1
 * @param {Date|string|number} date2 - 日期2
 * @returns {number} 相差天數（date1 - date2）
 */
function daysDifference(date1, date2) {
    try {
        const d1 = new Date(date1);
        const d2 = new Date(date2);
        
        if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
            return 0;
        }
        
        const diffTime = d1.getTime() - d2.getTime();
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } catch (e) {
        return 0;
    }
}

/**
 * 判斷是否為今天
 * @param {Date|string|number} dateInput - 日期輸入
 * @returns {boolean} 是否為今天
 */
function isToday(dateInput) {
    try {
        const d = new Date(dateInput);
        const today = new Date();
        
        return d.getFullYear() === today.getFullYear() &&
               d.getMonth() === today.getMonth() &&
               d.getDate() === today.getDate();
    } catch (e) {
        return false;
    }
}

/**
 * 判斷是否為過去日期
 * @param {Date|string|number} dateInput - 日期輸入
 * @returns {boolean} 是否為過去日期
 */
function isPastDate(dateInput) {
    try {
        const d = new Date(dateInput);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        
        return d < today;
    } catch (e) {
        return false;
    }
}

/**
 * 判斷是否為未來日期
 * @param {Date|string|number} dateInput - 日期輸入
 * @returns {boolean} 是否為未來日期
 */
function isFutureDate(dateInput) {
    try {
        const d = new Date(dateInput);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        d.setHours(0, 0, 0, 0);
        
        return d > today;
    } catch (e) {
        return false;
    }
}

// 前端相容性別名（向後相容）
const formatDateTWISO = formatDateYYYYMMDD;
const formatDateKey = formatDateYYYYMMDD;

// Node.js 環境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatDateYYYYMMDD,
        formatDateTime,
        formatDateTaiwan,
        formatDateDisplay,
        getWeekdayChar,
        daysDifference,
        isToday,
        isPastDate,
        isFutureDate,
        // 相容性別名
        formatDateTWISO,
        formatDateKey
    };
}

// 瀏覽器環境
if (typeof window !== 'undefined') {
    window.DateFormatter = {
        formatDateYYYYMMDD,
        formatDateTime,
        formatDateTaiwan,
        formatDateDisplay,
        getWeekdayChar,
        daysDifference,
        isToday,
        isPastDate,
        isFutureDate,
        // 相容性別名
        formatDateTWISO,
        formatDateKey
    };
}
