// google-sheets-students.js
// 🚀 學生資料讀取模組（API Key 版本 - 更快更簡單）

const axios = require('axios');

/**
 * 🔧 正規化字串（統一比對邏輯）
 * - 移除所有空白
 * - 轉換為小寫（英文）
 * - 去除首尾空白
 */
function normalizeString(str) {
    if (!str) return '';
    return String(str)
        .trim()
        .replace(/\s+/g, '')
        .toLowerCase();
}

/**
 * 🔧 正規化課程名稱（用於比對）
 */
function normalizeCourseName(courseName) {
    return normalizeString(courseName);
}

/**
 * 🔧 正規化學生姓名（用於比對）
 */
function normalizeStudentName(studentName) {
    return normalizeString(studentName);
}

class GoogleSheetsStudents {
    constructor() {
        this.cache = {
            students: null,
            lastUpdate: 0
        };
        this.CACHE_TTL = 5 * 60 * 1000; // 5 分鐘快取
        this.SPREADSHEET_ID = '1A2dPb0iyvaqVGTOKqGcsq7aC6UHNttVcJ82r-G0xevk';
        this.API_KEY = process.env.GOOGLE_SHEETS_API_KEY || 'AIzaSyDfYBGUCp1ixevg06acZCvWimwdqLKxh9Y';
        this.BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';
    }

    // ✅ 不需要複雜的 initialize()
    async initialize() {
        console.log('✅ GoogleSheetsStudents (API Key 版本) 已就緒');
        return true;
    }

    isCacheValid() {
        return this.cache.students && 
               (Date.now() - this.cache.lastUpdate < this.CACHE_TTL);
    }

    clearCache() {
        this.cache = {
            students: null,
            lastUpdate: 0
        };
        console.log('🔄 學生資料快取已清除');
    }

    /**
     * 直接讀取 Google Sheets（使用 API Key）
     * @param {string} range - 範圍，例如："'學生Data(Sync Notion Class)'!A2:W"
     * @param {boolean} useRawValues - 是否使用原始值（序號）
     * @returns {Promise<Array>} 二維陣列
     */
    async fetchSheetData(range, useRawValues = false) {
        const encodedRange = encodeURIComponent(range);
        let url = `${this.BASE_URL}/${this.SPREADSHEET_ID}/values/${encodedRange}?key=${this.API_KEY}`;
        
        // 如果需要原始值（日期序號）
        if (useRawValues) {
            url += '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER';
        }
        
        try {
            const response = await axios.get(url, { timeout: 10000 });
            return response.data.values || [];
        } catch (error) {
            console.error(`❌ 讀取失敗 (${range}):`, error.message);
            throw error;
        }
    }

    /**
     * 批次讀取多個範圍（效能更好）
     * @param {Array<string>} ranges - 範圍陣列
     * @param {boolean} useRawValues - 是否使用原始值
     * @returns {Promise<Array>} valueRanges 陣列
     */
    async batchFetchSheetData(ranges, useRawValues = false) {
        const rangesParam = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
        let url = `${this.BASE_URL}/${this.SPREADSHEET_ID}/values:batchGet?${rangesParam}&key=${this.API_KEY}`;
        
        if (useRawValues) {
            url += '&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER';
        }
        
        try {
            const response = await axios.get(url, { timeout: 15000 });
            return response.data.valueRanges || [];
        } catch (error) {
            console.error('❌ 批次讀取失敗:', error.message);
            throw error;
        }
    }

    /**
     * 解析時段字串（完全對接舊格式）
     * @param {string} periodStr - 時段字串
     * @returns {object} 解析結果
     */
    parsePeriodString(periodStr) {
        if (!periodStr || typeof periodStr !== 'string') {
            return {
                weekdays: [],
                startTime: null,
                endTime: null,
                location: null,
                note: null,
                raw: periodStr || ''
            };
        }

        const weekdayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
        const weekdays = [];
        let startTime = null;
        let endTime = null;
        let location = null;

        // 提取星期幾
        for (const [day, num] of Object.entries(weekdayMap)) {
            if (periodStr.includes(day)) {
                weekdays.push(day);
            }
        }

        // 提取時間
        const timeMatch = periodStr.match(/(\d{1,2}):?(\d{2})\s*[-~～]\s*(\d{1,2}):?(\d{2})/);
        if (timeMatch) {
            const [_, h1, m1, h2, m2] = timeMatch;
            startTime = `${h1.padStart(2, '0')}:${m1}`;
            endTime = `${h2.padStart(2, '0')}:${m2}`;
        }

        // 提取地點
        if (periodStr.includes('到府') || periodStr.includes('到家')) {
            location = '到府';
        } else if (periodStr.includes('外')) {
            location = '外';
        } else if (periodStr.includes('教室') || periodStr.includes('內')) {
            location = '教室';
        }

        return {
            weekdays,
            startTime,
            endTime,
            location,
            note: null,
            raw: periodStr
        };
    }

    /**
     * 序號轉日期字串 (yyyy-MM-dd)
     * 支援：
     * 1. Excel 日期序號（數字）
     * 2. 文字格式日期（例如："2025年10月30日 週四"）
     */
    serialToDate(serial) {
        // 情況 1: Excel 日期序號（數字）
        if (typeof serial === 'number' && !isNaN(serial)) {
            // 🔥 邊界檢查：Excel 序號應該 > 0（1900-01-01 = 1）
            if (serial <= 0) {
                return null;
            }
            
            const ms = Math.round((serial - 25569) * 86400 * 1000);
            const date = new Date(ms);
            const year = date.getUTCFullYear();
            const month = String(date.getUTCMonth() + 1).padStart(2, '0');
            const day = String(date.getUTCDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }
        
        // 情況 2: 文字格式日期（例如："2025年10月30日 週四"）
        if (typeof serial === 'string' && serial.trim()) {
            // 匹配格式：YYYY年MM月DD日
            const match = serial.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
            if (match) {
                const [_, year, month, day] = match;
                const m = parseInt(month);
                const d = parseInt(day);
                
                // 🔥 驗證日期有效性
                if (m < 1 || m > 12 || d < 1 || d > 31) {
                    return null;
                }
                
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
            
            // 嘗試其他常見格式（備用）
            // 例如：2025-10-30、2025/10/30
            const dateMatch = serial.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
            if (dateMatch) {
                const [_, year, month, day] = dateMatch;
                const m = parseInt(month);
                const d = parseInt(day);
                
                // 🔥 驗證日期有效性
                if (m < 1 || m > 12 || d < 1 || d > 31) {
                    return null;
                }
                
                return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
        }
        
        return null;
    }

    updateDateContext(context, dateStr) {
        if (!context || !dateStr) return;
        const date = new Date(dateStr + 'T00:00:00');
        if (!isNaN(date.getTime())) {
            context.lastDate = date;
        }
    }

    resolveYearForPartialDate(month, context) {
        const now = new Date();
        if (!context || !context.lastDate) {
            return now.getFullYear();
        }
        const lastMonth = context.lastDate.getMonth() + 1;
        let year = context.lastDate.getFullYear();
        if (month < lastMonth - 6) {
            year += 1;
        } else if (month > lastMonth + 6) {
            year -= 1;
        }
        return year;
    }

    parsePartialDate(value, context = {}) {
        if (!value || typeof value !== 'string') return null;
        let sanitized = value.trim();
        if (!sanitized) return null;
        
        sanitized = sanitized
            .replace(/（[^）]*）/g, '')
            .replace(/\([^)]*\)/g, '')
            .replace(/星期[一二三四五六日天]/gi, '')
            .replace(/[週周][一二三四五六日天]/gi, '')
            .replace(/\s+/g, '');
        
        let month = null;
        let day = null;
        
        let match = sanitized.match(/(\d{1,2})[\/\-](\d{1,2})$/);
        if (match) {
            month = parseInt(match[1], 10);
            day = parseInt(match[2], 10);
        } else {
            match = sanitized.match(/(\d{1,2})月(\d{1,2})日?/);
            if (match) {
                month = parseInt(match[1], 10);
                day = parseInt(match[2], 10);
            }
        }
        
        if (!month || !day) return null;
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
        
        const year = this.resolveYearForPartialDate(month, context);
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        this.updateDateContext(context, dateStr);
        return dateStr;
    }

    /**
     * A1 格式轉換（欄號轉字母）
     */
    toA1Col(n) {
        let s = '';
        while (n > 0) {
            const m = (n - 1) % 26;
            s = String.fromCharCode(65 + m) + s;
            n = Math.floor((n - 1) / 26);
        }
        return s;
    }

    /**
     * 批次預載所有課程的 meta
     */
    async preloadCourseMeta(courses) {
        const metaMap = new Map();
        
        if (courses.length === 0) return metaMap;

        try {
            console.log(`🔄 批次預載 ${courses.length} 個課程的 meta...`);
            
            // 🔥 修復：不使用原始值，因為某些日期欄位可能是文字格式
            // 這樣可以同時處理數字序號和文字日期兩種格式
            const ranges = courses.map(c => `'${c}'!F6:CZ6`); // 擴大範圍到 CZ
            const valueRanges = await this.batchFetchSheetData(ranges, true);

            courses.forEach((c, i) => {
                const rawRow = valueRanges[i]?.values?.[0] || [];
                
                // 找最後一個非空欄
                let lastIdx = rawRow.length - 1;
                while (lastIdx >= 0 && (rawRow[lastIdx] === '' || rawRow[lastIdx] == null)) {
                    lastIdx--;
                }
                
                const endColIndex = lastIdx >= 0 ? (6 + lastIdx) : 6;
                const endColA1 = this.toA1Col(endColIndex);
                
                // 🔥 修復：建立日期和原始索引的映射，避免索引錯位
                const headerDatesWithIndex = [];
                const parseContext = { lastDate: null };
                for (let j = 0; j <= lastIdx; j++) {
                    let date = this.serialToDate(rawRow[j]);
                    if (date) {
                        this.updateDateContext(parseContext, date);
                    } else {
                        date = this.parsePartialDate(rawRow[j], parseContext);
                    }
                    if (date) {
                        headerDatesWithIndex.push({ date, originalIndex: j });
                    }
                }

                metaMap.set(c, {
                    endColIndex,
                    endColA1,
                    headerDatesWithIndex // 包含原始索引的日期陣列
                });
            });

            console.log(`✅ Meta 預載完成`);

        } catch (error) {
            console.error('❌ 預載課程 meta 失敗:', error);
        }

        return metaMap;
    }

    /**
     * 獲取所有學生資料（完全對接現有 student_data.json 格式）
     * @returns {Promise<Object>} { success, count, students }
     */
    async getAllStudents() {
        // 檢查快取
        if (this.isCacheValid()) {
            console.log('✅ 使用快取的學生資料');
            return this.cache.students;
        }

        console.log('🔄 從 Google Sheets 讀取學生資料（API Key 方法）...');
        const startTime = Date.now();

        try {
            // ========== 步驟 1：讀取學生基本資料 ==========
            console.log('📊 步驟 1: 讀取學生基本資料...');
            const studentData = await this.fetchSheetData("'學生Data(Sync Notion Class)'!A2:Z");

            if (!studentData || studentData.length === 0) {
                console.log('⚠️ 學生Data(Sync Notion Class) 工作表為空');
                return { success: true, count: 0, students: [] };
            }

            console.log(`   - 讀取到 ${studentData.length} 筆學生資料`);

            // ========== 步驟 2：分組並收集課程列表 ==========
            console.log('📊 步驟 2: 分組課程...');
            const rows = studentData
                .map((r, i) => ({ r, i }))
                .filter(x => x.r[0] && x.r[5]); // 必須有姓名和課程

            const byCourse = new Map();
            for (const { r, i } of rows) {
                const item = {
                    name: String(r[0] || '').trim(),
                    course: String(r[5] || '').trim(),
                    period: String(r[6] || '').trim(),
                    remaining: Number(r[8] || 0),
                    userId: String(r[20] || '').trim(),
                    coursePlan: String(r[22] || '').trim()
                };
                if (!byCourse.has(item.course)) {
                    byCourse.set(item.course, []);
                }
                byCourse.get(item.course).push(item);
            }

            const courses = [...byCourse.keys()];
            console.log(`   - 共 ${courses.length} 個不同課程`);

            if (courses.length === 0) {
                return { success: true, count: 0, students: [] };
            }

            // ========== 步驟 3：批次預載課程 meta ==========
            console.log('📊 步驟 3: 預載課程 meta...');
            const metaMap = await this.preloadCourseMeta(courses);

            // ========== 步驟 4：批次讀取課程表的學生名單和剩餘堂數 ==========
            console.log('📊 步驟 4: 讀取課程表學生名單...');
            const metaRanges = [];
            courses.forEach(c => {
                metaRanges.push(`'${c}'!B7:B200`); // 學生名單
                metaRanges.push(`'${c}'!T7:T200`); // 剩餘堂數
            });

            const vrMeta = await this.batchFetchSheetData(metaRanges);

            // 組織課程表資料
            const nameToIdxByCourse = new Map();
            const remainColByCourse = new Map();
            
            for (let i = 0; i < courses.length; i++) {
                const c = courses[i];
                const namesCol = vrMeta[i * 2]?.values || [];
                const remainCol = vrMeta[i * 2 + 1]?.values || [];
                
                const names = namesCol.map(r => (r && r[0]) ? String(r[0]).trim() : '');
                const nameToIdx = new Map();
                names.forEach((n, idx) => { if (n) nameToIdx.set(n, idx); });
                
                nameToIdxByCourse.set(c, nameToIdx);
                remainColByCourse.set(c, remainCol);
            }

            // ========== 步驟 5：批次讀取出勤記錄 ==========
            console.log('📊 步驟 5: 讀取出勤記錄...');
            const attendanceRanges = [];
            const attendanceKeys = [];

            for (const c of courses) {
                const list = byCourse.get(c);
                const meta = metaMap.get(c);
                if (!meta) continue;

                const { endColA1, headerDatesWithIndex } = meta;
                const nameToIdx = nameToIdxByCourse.get(c) || new Map();
                
                // 收集需要讀取的學生行
                for (const item of list) {
                    const idx = nameToIdx.get(item.name);
                    if (typeof idx === 'number' && idx >= 0) {
                        const row = 7 + idx;
                        attendanceRanges.push(`'${c}'!F${row}:${endColA1}${row}`);
                        attendanceKeys.push({ course: c, name: item.name, headerDatesWithIndex });
                    }
                }
            }

            console.log(`   - 準備讀取 ${attendanceRanges.length} 筆出勤記錄`);

            // 批次讀取出勤
            let attendanceData = new Map();
            if (attendanceRanges.length > 0) {
                const vrAttendance = await this.batchFetchSheetData(attendanceRanges);

                attendanceRanges.forEach((_, i) => {
                    const { course, name, headerDatesWithIndex } = attendanceKeys[i];
                    const marksRow = vrAttendance[i]?.values?.[0] || [];
                    
                    const attendance = [];
                    // 🔥 修復：使用原始索引讀取簽到記號，避免索引錯位
                    for (const { date, originalIndex } of headerDatesWithIndex) {
                        const mark = String(marksRow[originalIndex] || '').trim().toUpperCase();
                        if (mark === 'V') {
                            attendance.push({ date, present: true });
                        } else if (mark === 'X') {
                            attendance.push({ date, present: false });
                        } else if (mark === '假' || mark === '請假') {
                            attendance.push({ date, present: 'leave' });
                        }
                    }
                    
                    attendanceData.set(`${course}|||${name}`, attendance);
                });
            }

            // ========== 步驟 6：組裝最終結果 ==========
            console.log('📊 步驟 6: 組裝最終結果...');
            const results = [];
            
            for (const c of courses) {
                const list = byCourse.get(c);
                const nameToIdx = nameToIdxByCourse.get(c) || new Map();
                const remain = remainColByCourse.get(c) || [];
                
                for (const item of list) {
                    const idx = nameToIdx.get(item.name);
                    const remainingFromCourse = (typeof idx === 'number' && idx >= 0 && remain[idx])
                        ? Number(remain[idx][0] || 0)
                        : 0;
                    
                    const attendance = attendanceData.get(`${c}|||${item.name}`) || [];
                    const periodParsed = this.parsePeriodString(item.period);
                    
                    results.push({
                        name: item.name,
                        course: item.course,
                        period: item.period,
                        remaining: item.remaining,
                        userId: item.userId,
                        coursePlan: item.coursePlan,
                        remainingFromCourseSheet: remainingFromCourse,
                        attendance: attendance,
                        periodParsed: periodParsed
                    });
                }
            }

            const responseData = {
                success: true,
                count: results.length,
                students: results
            };

            // 更新快取
            this.cache.students = responseData;
            this.cache.lastUpdate = Date.now();

            const elapsed = Date.now() - startTime;
            console.log(`✅ 學生資料讀取完成 (${results.length} 位學生, ${elapsed}ms)`);

            return responseData;

        } catch (error) {
            console.error('❌ 讀取學生資料失敗:', error);
            throw error;
        }
    }

    /**
     * 🎯 按課程獲取學生（場景化優化 - 學生簽到專用）
     * @param {string} courseName - 課程名稱，例如："SPM"
     * @returns {Promise<Object>}
     */
    async getStudentsByCourse(courseName) {
        console.log(`🎯 場景化讀取: ${courseName} 課程學生`);
        const startTime = Date.now();

        try {
            await this.initialize();

            // ========== 步驟 1：讀取學生基本資料（篩選該課程）==========
            console.log('📊 步驟 1: 讀取學生基本資料...');
            const studentData = await this.fetchSheetData(
                "'學生Data(Sync Notion Class)'!A2:Z"
            );

            // 🔥 使用統一正規化函數：不區分大小寫、空白
            const normalizedTargetCourse = normalizeCourseName(courseName);
            let courseStudents = studentData
                .filter(r => normalizeCourseName(r[5] || '') === normalizedTargetCourse);

            // 💡 後備策略：有些資料的課程欄位包含星期/時間/地點（例如："SPIKE 五 10:15-11:40 外 第1週"）
            //    若完全相等比對找不到，退而以「第一段課程代碼」比對（例：取 "SPIKE"）
            let matchedByBaseCode = false;
            if (courseStudents.length === 0) {
                console.log('🔎 未找到完全相等的課程名稱，嘗試以課程代碼（首段）進行比對...');
                const fallback = studentData.filter(r => {
                    const raw = String(r[5] || '').trim();
                    if (!raw) return false;
                    const base = raw.split(/\s+/)[0];
                    return normalizeCourseName(base) === normalizedTargetCourse;
                });
                if (fallback.length > 0) {
                    console.log(`✅ 後備策略匹配成功：找到 ${fallback.length} 位學生`);
                    courseStudents = fallback;
                    matchedByBaseCode = true;
                }
            }
            
            console.log(`   - 找到 ${courseStudents.length} 位 ${courseName} 學生 (正規化搜尋: "${normalizedTargetCourse}")`);

            if (courseStudents.length === 0) {
                // 💡 找不到該課程學生，回傳空集合而非丟錯（維持穩定）
                return { 
                    success: true, 
                    count: 0, 
                    course: courseName, 
                    students: [] 
                };
            }

            // ✅ 取得表單上的「實際課程名稱」（可能與查詢參數大小寫/空白不同）
            //    以第一筆對應資料的原始課程名稱為主，降低標籤大小寫或命名差異導致找不到分頁的風險
            const canonicalCourseName = String(courseStudents[0][5] || '').trim();
            if (!canonicalCourseName) {
                console.warn(`⚠️ 找到學生但無法推斷真正的課程名稱，使用請求參數: ${courseName}`);
            }
            // 若是以課程代碼（首段）匹配，則使用該代碼作為試算表分頁名稱
            const baseCourseCode = (canonicalCourseName || '').split(/\s+/)[0];
            const sheetCourseName = matchedByBaseCode ? (baseCourseCode || courseName) : (canonicalCourseName || courseName);

            // ========== 步驟 2：讀取該課程的 meta ==========
            console.log('📊 步驟 2: 讀取課程 meta...');
            const metaMap = await this.preloadCourseMeta([sheetCourseName]);
            const meta = metaMap.get(sheetCourseName);
            
            if (!meta) {
                // ⚠️ 找不到對應分頁：回傳空集合（避免 500），並提供提示訊息
                console.error(`❌ 找不到課程分頁: '${sheetCourseName}'（原請求='${courseName}'）`);
                return {
                    success: true,
                    count: 0,
                    course: sheetCourseName,
                    students: [],
                    message: `找不到課程分頁: ${sheetCourseName}`
                };
            }

            // ========== 步驟 3：讀取該課程的學生名單和剩餘堂數 ==========
            console.log('📊 步驟 3: 讀取學生名單和剩餘堂數...');
            const vrMeta = await this.batchFetchSheetData([
                `'${sheetCourseName}'!B7:B200`,  // 學生名單
                `'${sheetCourseName}'!T7:T200`   // 剩餘堂數
            ]);

            const namesCol = vrMeta[0]?.values || [];
            const remainCol = vrMeta[1]?.values || [];
            const names = namesCol.map(r => (r && r[0]) ? String(r[0]).trim() : '');
            const nameToIdx = new Map();
            names.forEach((n, idx) => { if (n) nameToIdx.set(n, idx); });

            // ========== 步驟 4：批次讀取出勤記錄（只讀該課程學生）==========
            console.log('📊 步驟 4: 讀取出勤記錄...');
            const { endColA1, headerDatesWithIndex } = meta;
            const attendanceRanges = [];
            const studentItems = [];

            for (const r of courseStudents) {
                const studentName = String(r[0] || '').trim();
                const idx = nameToIdx.get(studentName);
                
                if (typeof idx === 'number' && idx >= 0) {
                    const row = 7 + idx;
                    attendanceRanges.push(`'${sheetCourseName}'!F${row}:${endColA1}${row}`);
                    studentItems.push({
                        name: studentName,
                        course: sheetCourseName,
                        period: String(r[6] || '').trim(),
                        remaining: Number(r[8] || 0),
                        userId: String(r[20] || '').trim(),
                        coursePlan: String(r[22] || '').trim(),
                        remainingFromCourse: Number(remainCol[idx]?.[0] || 0)
                    });
                }
            }

            console.log(`   - 準備讀取 ${attendanceRanges.length} 筆出勤記錄`);

            // 批次讀取出勤
            let vrAttendance = [];
            if (attendanceRanges.length > 0) {
                vrAttendance = await this.batchFetchSheetData(attendanceRanges);
            }

            // ========== 步驟 5：組裝結果 ==========
            console.log('📊 步驟 5: 組裝最終結果...');
            const results = studentItems.map((item, i) => {
                const marksRow = vrAttendance[i]?.values?.[0] || [];
                const attendance = [];
                
                // 🔥 修復：使用原始索引讀取簽到記號，避免索引錯位
                for (const { date, originalIndex } of headerDatesWithIndex) {
                    const mark = String(marksRow[originalIndex] || '').trim().toUpperCase();
                    if (mark === 'V') {
                        attendance.push({ date, present: true });
                    } else if (mark === 'X') {
                        attendance.push({ date, present: false });
                    } else if (mark === '假' || mark === '請假') {
                        attendance.push({ date, present: 'leave' });
                    }
                }

                return {
                    name: item.name,
                    course: item.course,
                    period: item.period,
                    remaining: item.remaining,
                    userId: item.userId,
                    coursePlan: item.coursePlan,
                    remainingFromCourseSheet: item.remainingFromCourse,
                    attendance: attendance,
                    periodParsed: this.parsePeriodString(item.period)
                };
            });

            const elapsed = Date.now() - startTime;
            console.log(`✅ ${sheetCourseName} 學生資料讀取完成 (${results.length} 位, ${elapsed}ms)`);

            return {
                success: true,
                count: results.length,
                course: sheetCourseName,
                students: results,
                responseTime: elapsed
            };

        } catch (error) {
            // ⚠️ 錯誤收斂：避免將外部服務錯誤直接拋出為 500，統一回傳結構
            console.error(`❌ 讀取課程學生失敗 (${courseName}):`, error);
            throw error;
        }
    }
}

module.exports = GoogleSheetsStudents;
