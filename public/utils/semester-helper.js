/**
 * 統一學期計算工具
 * 用於前後端統一的學期計算邏輯
 */

/**
 * 計算當前學期（台灣學制）
 * @param {Date|string|number} dateInput - 日期輸入（可選）
 * @returns {string} 學期字串，格式：114-1、114-2、夏令營-2025、冬令營-2025
 */
function getCurrentSemester(dateInput) {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        if (isNaN(d.getTime())) {
            return getCurrentSemester(Date.now());
        }
        
        const year = d.getFullYear();
        const month = d.getMonth() + 1; // 1-12
        const taiwanYear = year - 1911;
        
        // 統一邏輯（修正後端錯誤）
        if (month >= 3 && month <= 6) return `${taiwanYear}-2`;   // 下學期（3-6月）
        if (month >= 7 && month <= 8) return `夏令營-${year}`;    // 暑假（7-8月）
        if (month >= 9 && month <= 12) return `${taiwanYear}-1`;  // 上學期（9-12月）
        return `冬令營-${year}`;                                   // 寒假（1-2月）
    } catch (e) {
        console.error('❌ 計算學期失敗:', e);
        const fallbackYear = new Date().getFullYear() - 1911;
        return `${fallbackYear}-1`; // 預設值
    }
}

/**
 * 取得上一個學期
 * @param {string} semester - 學期字串
 * @returns {string} 上一個學期
 */
function getPreviousSemester(semester) {
    if (!semester) return getCurrentSemester();
    
    const parts = semester.split('-');
    if (parts.length !== 2) {
        // 處理夏令營/冬令營
        if (semester.startsWith('夏令營-')) {
            const year = parseInt(semester.replace('夏令營-', ''));
            return `${year - 1911}-2`; // 夏令營前是下學期
        }
        if (semester.startsWith('冬令營-')) {
            const year = parseInt(semester.replace('冬令營-', ''));
            return `${year - 1912}-1`; // 冬令營前是上一年的上學期
        }
        return semester;
    }
    
    const rocYear = parseInt(parts[0]);
    const term = parseInt(parts[1]);
    
    if (term === 2) {
        return `${rocYear}-1`; // 下學期前是同年上學期
    } else {
        return `${rocYear - 1}-2`; // 上學期前是去年下學期
    }
}

/**
 * 取得下一個學期
 * @param {string} semester - 學期字串
 * @returns {string} 下一個學期
 */
function getNextSemester(semester) {
    if (!semester) return getCurrentSemester();
    
    const parts = semester.split('-');
    if (parts.length !== 2) {
        // 處理夏令營/冬令營
        if (semester.startsWith('夏令營-')) {
            const year = parseInt(semester.replace('夏令營-', ''));
            return `${year - 1911}-1`; // 夏令營後是上學期
        }
        if (semester.startsWith('冬令營-')) {
            const year = parseInt(semester.replace('冬令營-', ''));
            return `${year - 1911}-2`; // 冬令營後是下學期
        }
        return semester;
    }
    
    const rocYear = parseInt(parts[0]);
    const term = parseInt(parts[1]);
    
    if (term === 1) {
        return `${rocYear}-2`; // 上學期後是同年下學期
    } else {
        return `${rocYear + 1}-1`; // 下學期後是明年上學期
    }
}

/**
 * 判斷是否為有效的學期格式
 * @param {string} val - 要檢查的字串
 * @returns {boolean} 是否為有效學期格式
 */
function isSemesterFormat(val) {
    if (!val) return false;
    return /^(\d{3}-[12]|(?:夏令營|冬令營)-\d{4})$/i.test(String(val).trim());
}

/**
 * 比較兩個學期的先後
 * @param {string} semester1 - 學期1
 * @param {string} semester2 - 學期2
 * @returns {number} -1: semester1 較早, 0: 相同, 1: semester1 較晚
 */
function compareSemesters(semester1, semester2) {
    if (semester1 === semester2) return 0;
    
    // 轉換為可比較的數值
    const toValue = (sem) => {
        if (sem.startsWith('夏令營-')) {
            const year = parseInt(sem.replace('夏令營-', ''));
            return year * 10 + 5.5; // 夏令營在年中
        }
        if (sem.startsWith('冬令營-')) {
            const year = parseInt(sem.replace('冬令營-', ''));
            return year * 10 + 1.5; // 冬令營在年初
        }
        const parts = sem.split('-');
        const rocYear = parseInt(parts[0]);
        const term = parseInt(parts[1]);
        const year = rocYear + 1911;
        return year * 10 + (term === 1 ? 9 : 3); // 上學期9月，下學期3月
    };
    
    const val1 = toValue(semester1);
    const val2 = toValue(semester2);
    
    return val1 < val2 ? -1 : 1;
}

// Node.js 環境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getCurrentSemester,
        getPreviousSemester,
        getNextSemester,
        isSemesterFormat,
        compareSemesters
    };
}

// 瀏覽器環境
if (typeof window !== 'undefined') {
    window.SemesterHelper = {
        getCurrentSemester,
        getPreviousSemester,
        getNextSemester,
        isSemesterFormat,
        compareSemesters
    };
}
