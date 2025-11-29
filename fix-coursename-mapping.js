/**
 * 課程名稱映射修復
 * 
 * 如果前端只能取得部分課程名稱（如 "SPIKE 五 1610"），
 * 我們需要在後端建立映射來還原完整名稱
 */

// 將此添加到 server.js 中

// 課程名稱映射表
const courseNameMapping = {
    'SPIKE 五 1610': 'SPIKE 五 1610-1740 松山',
    'SPIKE 五 16:10': 'SPIKE 五 16:10-17:40 松山',
    'ESM 四 1730': 'ESM 四 1730-1830 到府',
    'ESM 四 17:30': 'ESM 四 17:30-18:30 到府',
    'BOOST 六 1530': 'BOOST 六 1530-1700 到府',
    'BOOST 六 15:30': 'BOOST 六 15:30-17:00 到府',
    // 根據需要添加更多映射
};

/**
 * 修復截斷的課程名稱
 */
function fixCourseName(courseName) {
    if (!courseName) return courseName;
    
    // 直接查找映射
    if (courseNameMapping[courseName]) {
        console.log('📝 課程名稱映射：', courseName, '→', courseNameMapping[courseName]);
        return courseNameMapping[courseName];
    }
    
    // 嘗試部分匹配（如果課程名稱包含時間但缺少地點）
    for (const [shortName, fullName] of Object.entries(courseNameMapping)) {
        if (courseName.startsWith(shortName)) {
            console.log('📝 課程名稱部分匹配：', courseName, '→', fullName);
            return fullName;
        }
    }
    
    // 如果沒有映射，返回原始名稱
    return courseName;
}

// 在 upload-drive API 中使用
// 修改第 18396 行附近：
/*
let finalCourseName = fixCourseName(courseName);
*/

// 或者更智能的方案：根據時間查詢完整事件名稱
async function getFullCourseName(partialName, date, time) {
    try {
        // 從行事曆 API 查詢當天該時間的事件
        const events = await calendarClient.getEvents({
            date: date,
            instructor: req.body.instructor // 如果有講師資訊
        });
        
        // 找到匹配的事件
        for (const event of events) {
            // 檢查時間和部分名稱是否匹配
            if (event.title && event.title.includes(partialName)) {
                console.log('📅 從行事曆找到完整名稱：', event.title);
                return event.title;
            }
        }
    } catch (error) {
        console.error('❌ 無法查詢行事曆：', error.message);
    }
    
    return partialName;
}

console.log('✅ 課程名稱修復方案已準備');
console.log('請根據實際情況選擇：');
console.log('  1. 使用靜態映射表（簡單但需要維護）');
console.log('  2. 從行事曆 API 動態查詢（複雜但自動化）');
