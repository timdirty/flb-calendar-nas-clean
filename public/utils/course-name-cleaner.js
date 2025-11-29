/**
 * 🧹 課程名稱清理工具
 * 用於移除課程名稱中的週次部分，確保同一課程使用相同資料夾
 * 
 * 例如：
 * - "SPIKE 五 1610-1740 松山 第8週" -> "SPIKE 五 1610-1740 松山"
 * - "ESM 四 1730-1830 到府 第11週" -> "ESM 四 1730-1830 到府"
 */

/**
 * 清理課程名稱，移除週次資訊
 * @param {string} courseName - 原始課程名稱
 * @returns {string} 清理後的課程名稱
 */
function cleanCourseName(courseName) {
    if (!courseName) return '';
    
    let cleaned = String(courseName).trim();
    
    // 移除各種格式的週次標記
    // 例如：第8週、第10週、week 8、Week 10 等
    cleaned = cleaned
        .replace(/\s+第\d+週/gi, '')      // 中文週次（第X週）
        .replace(/\s+第.{1,3}週/gi, '')   // 中文週次（第一週、第二週等）
        .replace(/\s+week\s*\d+/gi, '')   // 英文週次（week X）
        .replace(/\s+w\d+/gi, '')         // 簡寫週次（w8）
        .replace(/\s+週\d+/gi, '')        // 週X格式
        .replace(/\s*[-_]\s*第\d+週/gi, '') // 帶分隔符的週次
        .replace(/\s*[-_]\s*week\s*\d+/gi, '') // 帶分隔符的英文週次
        .trim();
    
    // 清理多餘的空格
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // 移除末尾可能殘留的分隔符
    cleaned = cleaned.replace(/[-_,，、]\s*$/, '').trim();
    
    return cleaned;
}

/**
 * 從 coursePeriod 格式中清理課程名稱
 * @param {string} coursePeriod - 格式如 "114-1/SPIKE 三 18:30-20:30 第8週"
 * @returns {string} 清理後的 coursePeriod
 */
function cleanCoursePeriod(coursePeriod) {
    if (!coursePeriod) return '';
    
    const parts = coursePeriod.split('/');
    if (parts.length < 2) {
        // 如果沒有學期部分，直接清理整個字串
        return cleanCourseName(coursePeriod);
    }
    
    // 保留學期部分，清理課程名稱部分
    const semester = parts[0];
    const courseNamePart = parts.slice(1).join('/');
    const cleanedCourseName = cleanCourseName(courseNamePart);
    
    return `${semester}/${cleanedCourseName}`;
}

/**
 * 判斷課程名稱是否包含週次資訊
 * @param {string} courseName - 課程名稱
 * @returns {boolean} 是否包含週次
 */
function hasWeekInfo(courseName) {
    if (!courseName) return false;
    
    const patterns = [
        /第\d+週/,           // 中文週次
        /第.{1,3}週/,        // 中文週次（文字）
        /week\s*\d+/i,       // 英文週次
        /w\d+/i,            // 簡寫週次
        /週\d+/              // 週X格式
    ];
    
    return patterns.some(pattern => pattern.test(courseName));
}

/**
 * 提取週次資訊
 * @param {string} courseName - 課程名稱
 * @returns {string|null} 週次資訊，如果沒有則返回 null
 */
function extractWeekInfo(courseName) {
    if (!courseName) return null;
    
    // 嘗試匹配各種週次格式
    const patterns = [
        /(第\d+週)/,
        /(第.{1,3}週)/,
        /(week\s*\d+)/i,
        /(w\d+)/i,
        /(週\d+)/
    ];
    
    for (const pattern of patterns) {
        const match = courseName.match(pattern);
        if (match) {
            return match[1];
        }
    }
    
    return null;
}

/**
 * 比較兩個課程名稱是否為同一課程（忽略週次）
 * @param {string} name1 - 第一個課程名稱
 * @param {string} name2 - 第二個課程名稱
 * @returns {boolean} 是否為同一課程
 */
function isSameCourse(name1, name2) {
    const clean1 = cleanCourseName(name1);
    const clean2 = cleanCourseName(name2);
    
    return clean1 === clean2;
}

// Node.js 環境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        cleanCourseName,
        cleanCoursePeriod,
        hasWeekInfo,
        extractWeekInfo,
        isSameCourse
    };
}

// 瀏覽器環境
if (typeof window !== 'undefined') {
    window.CourseNameCleaner = {
        cleanCourseName,
        cleanCoursePeriod,
        hasWeekInfo,
        extractWeekInfo,
        isSameCourse
    };
}

// 測試案例（開發時使用）
if (typeof require !== 'undefined' && require.main === module) {
    // 執行測試
    const testCases = [
        'SPIKE 五 1610-1740 松山 第8週',
        'SPIKE 三 18:30-20:30 第8週',
        'ESM 四 17:30-18:30 到府 第11週',
        'BOOST 六1530-1700 到府 第3週',
        'SPM 四 1730-1830 到府 第2週',
        'SPIKE PRO 日 1000-1200 第8週',
        '114-1/SPIKE 三 18:30-20:30 第8週'
    ];
    
    console.log('📋 課程名稱清理測試：\n');
    testCases.forEach(test => {
        const cleaned = test.includes('/') ? cleanCoursePeriod(test) : cleanCourseName(test);
        const hasWeek = hasWeekInfo(test);
        const weekInfo = extractWeekInfo(test);
        
        console.log(`原始: ${test}`);
        console.log(`清理: ${cleaned}`);
        console.log(`包含週次: ${hasWeek}`);
        console.log(`週次資訊: ${weekInfo || '無'}`);
        console.log('---');
    });
}
