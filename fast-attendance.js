// fast-attendance.js
// 🚀 極速簽到邏輯（HTTP API 優化版 - 直接使用快取端點）

const GoogleSheetsClient = require('./google-sheets-client');
const axios = require('axios');

class FastAttendanceManager {
    constructor() {
        this.sheetsClient = new GoogleSheetsClient();
        this.initialized = false;
        this.apiBaseUrl = process.env.API_BASE_URL || 'http://localhost:3000';
    }

    // ==================== 初始化 ====================

    async initialize() {
        if (this.initialized) return true;

        try {
            await this.sheetsClient.initialize();
            this.initialized = true;
            console.log('✅ FastAttendanceManager 初始化成功（HTTP API 模式）');
            return true;
        } catch (error) {
            console.error('❌ FastAttendanceManager 初始化失敗:', error);
            throw error;
        }
    }

    // ==================== 日期格式化 ====================
    
    // 🎯 將 yyyy-MM-dd 格式化為中文日期格式（例：2025年10月29日 週三）
    formatDateToChinese(dateStr) {
        try {
            const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
            if (!match) return dateStr;
            
            const year = parseInt(match[1], 10);
            const month = parseInt(match[2], 10);
            const day = parseInt(match[3], 10);
            
            // 創建日期物件（使用 UTC 避免時區問題）
            const date = new Date(Date.UTC(year, month - 1, day));
            
            // 星期對照
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekday = weekdays[date.getUTCDay()];
            
            // 格式化為 "'2025年10月29日 週三" （加上單引號強制為文字）
            return `'${year}年${month}月${day}日 週${weekday}`;
        } catch (error) {
            console.error('❌ 日期格式化失敗:', error);
            return dateStr;
        }
    }

    // ==================== 快速簽到 ====================

    // 🔥 使用 HTTP API 加速簽到（利用現有快取，預期提升 60-90% 速度）
    async signIn(studentName, courseName, date, mark = 'V', options = {}) {
        const startTime = Date.now();
        const breakdown = {};

        try {
            // 確保已初始化
            if (!this.initialized) {
                await this.initialize();
            }

            console.log(`🚀 開始簽到流程: ${studentName} -> ${courseName} @ ${date}`);

            let courseType = options.courseType;
            let studentIndex = options.studentIndex;
            let studentRemaining = null;
            let targetRow = null;

            // ========== 🔥 快速路徑：如果前端已傳遞完整資料，直接使用 ==========
            if (courseType && studentIndex !== undefined && studentIndex >= 0) {
                console.log(`⚡⚡⚡ 使用快速模式（前端已提供資料，跳過 loadStudentData + loadNames）`);
                console.log(`    - courseType: ${courseType}`);
                console.log(`    - studentIndex: ${studentIndex}`);
                
                breakdown.loadStudentData = 0; // 🔥 跳過（節省 ~500ms）
                breakdown.loadNames = 0;        // 🔥 跳過（節省 ~500ms）
                
                // 🔥 直接計算目標行號
                targetRow = 7 + studentIndex; // B7 開始
                console.log(`✅ 快速定位學生行號: ${targetRow} (節省約 1000ms 查詢時間)`);
                
                // 🔥 查詢真實剩餘堂數（2025-01-16 修復）
                // ✅ 即使在快速模式下，也要查詢 Google Sheets 的真實剩餘堂數
                const t_remaining = Date.now();
                try {
                    // 讀取剩餘堂數（E欄）
                    const remainingCell = this.sheetsClient.toA1Notation(targetRow, 5); // E欄
                    const remainingData = await this.sheetsClient.getSheetData(`'${courseType}'!${remainingCell}`, false);
                    
                    if (remainingData && remainingData[0] && remainingData[0][0] !== undefined && remainingData[0][0] !== null && remainingData[0][0] !== '') {
                        studentRemaining = parseInt(remainingData[0][0]);
                        console.log(`📚 從 Google Sheets 查詢真實剩餘堂數: ${studentRemaining} 堂 (耗時 ${Date.now() - t_remaining}ms)`);
                    } else {
                        console.warn(`⚠️ 剩餘堂數為空，設為 0`);
                        studentRemaining = 0;
                    }
                } catch (error) {
                    console.error('❌ 查詢剩餘堂數失敗:', error);
                    studentRemaining = null;
                }
                breakdown.loadRemaining = Date.now() - t_remaining;
            } else {
                // ========== 原有流程（Fallback）：後端重新查詢 ==========
                console.log('⚠️ 前端未提供完整資料，使用 Fallback 模式（較慢，需查詢 ~1000ms）');
                
                // 步驟 1：獲取課程類型（~500ms）
                const t1 = Date.now();
                
                try {
                    const response = await axios.get(`${this.apiBaseUrl}/api/students/from-sheets`, {
                        timeout: 5000,
                        headers: { 'Cache-Control': 'no-cache' }
                    });
                    
                    if (response.data.success) {
                        const studentRecord = response.data.students.find(s => s.name === studentName);
                        if (studentRecord) {
                            courseType = studentRecord.course;
                        }
                    }
                } catch (error) {
                    console.log('⚠️ HTTP API 失敗，改用直接讀取:', error.message);
                }
                
                breakdown.loadStudentData = Date.now() - t1;
                
                if (!courseType) {
                    return {
                        success: false,
                        error: `找不到該學生: ${studentName}`,
                        hint: '請確認學生是否存在於「學生Data(Sync Notion Class)」工作表中',
                        performance: { totalMs: Date.now() - startTime, breakdown }
                    };
                }
                
                console.log(`✅ 找到課程類型: ${courseType} (HTTP API，耗時 ${breakdown.loadStudentData}ms)`);

                // 步驟 2：使用場景化 API 獲取課程學生名單（~500ms）
                const t2 = Date.now();
                
                let studentNames = [];
                
                try {
                    // 🚀 使用場景化 API（比全部讀取快 70%）
                    const response = await axios.get(
                        `${this.apiBaseUrl}/api/students/by-course?course=${encodeURIComponent(courseType)}`,
                        {
                            timeout: 5000,
                            headers: { 'Cache-Control': 'no-cache' }
                        }
                    );
                    
                    if (response.data.success) {
                        const students = response.data.students;
                        studentNames = students.map(s => s.name);
                        studentIndex = studentNames.indexOf(studentName);
                        
                        // 🔥 找到該學生的剩餘堂數
                        const studentData = students.find(s => s.name === studentName);
                        if (studentData) {
                            studentRemaining = studentData.remaining;
                            console.log(`📚 學生剩餘堂數: ${studentRemaining}`);
                        }
                        
                        console.log(`🎯 場景化 API 返回 ${studentNames.length} 位學生 (耗時 ${Date.now() - t2}ms)`);
                    }
                } catch (error) {
                    console.log('⚠️ 場景化 API 失敗，改用直接讀取:', error.message);
                }
                
                breakdown.loadNames = Date.now() - t2;
                
                // 🔥 Fallback: 如果 HTTP API 失敗，直接讀取 Google Sheets
                if (studentIndex === -1) {
                    console.log('⚠️ HTTP API 中找不到學生，改用直接讀取...');
                    const t2b = Date.now();
                    const namesData = await this.sheetsClient.getSheetData(`'${courseType}'!B7:B200`);
                    const directStudentNames = namesData.map(r => (r[0] || '').toString().trim());
                    const directIndex = directStudentNames.indexOf(studentName);
                    breakdown.loadNames = Date.now() - t2b;
                    
                    if (directIndex === -1) {
                        return {
                            success: false,
                            error: `課程表中找不到學生名稱: ${studentName}`,
                            courseType: courseType,
                            performance: { totalMs: Date.now() - startTime, breakdown }
                        };
                    }
                    
                    const targetRow = 7 + directIndex;
                    console.log(`✅ 找到學生行號: ${targetRow} (直接讀取)`);
                    
                    // 繼續使用直接讀取的流程
                    return await this.signInDirect(studentName, courseType, date, mark, targetRow, startTime, breakdown);
                }
                
                targetRow = 7 + studentIndex; // B7 開始
                console.log(`✅ 找到學生行號: ${targetRow} (HTTP API 快取，耗時 ${breakdown.loadNames}ms)`);
            }

            // ========== 步驟 3：讀取日期表頭 (F6:ZZ6) - 讀取格式化字串 ==========
            const t3 = Date.now();
            // 🎯 使用 useRawValues=false 讀取格式化後的字串（中文格式）
            const headerData = await this.sheetsClient.getSheetData(`'${courseType}'!F6:ZZ6`, false);
            const header = headerData[0] || [];
            breakdown.loadHeader = Date.now() - t3;
            
            console.log(`📊 讀取到 ${header.length} 個表頭欄位`);
            
            // 🎯 將目標日期格式化為中文格式，用於比對
            const chineseDate = this.formatDateToChinese(date);
            console.log(`🔍 目標日期: ${date} → ${chineseDate}`);
            
            // 🔍 查找日期對應的欄位（比對中文格式字串）
            let colOffset = -1;
            
            console.log(`🔍 開始搜尋現有日期欄位...`);
            for (let i = 0; i < header.length; i++) {
                const cell = header[i];
                
                // 跳過空欄位（注意：0 不是空）
                if (cell === null || cell === undefined || cell === '') continue;
                
                // 記錄所有非空欄位的值（調試用）
                if (i < 10) {
                    console.log(`  - 欄位[${i}]: ${typeof cell} = ${cell}`);
                }
                
                // 🎯 比對中文格式字串（向後兼容 yyyy-MM-dd 格式）
                // 注意：Google Sheets 會自動移除開頭的單引號，所以比對時不需要包含單引號
                const cellStr = String(cell).trim();
                const chineseDateWithoutQuote = chineseDate.replace(/^'/, ''); // 移除開頭的單引號
                const match = (cellStr === chineseDateWithoutQuote) ||  // 比對中文格式（無單引號）
                             (cellStr === chineseDate) ||                // 比對中文格式（含單引號，以防萬一）
                             (cellStr === date);                         // 比對原始格式（向後兼容）
                
                if (match) {
                    colOffset = i;
                    console.log(`✅✅✅ 找到現有日期欄位！`);
                    console.log(`   - 位置: 第 ${i} 個偏移 (第 ${6+i} 欄)`);
                    console.log(`   - 儲存格值: ${cell}`);
                    console.log(`   - 目標格式: ${chineseDate}`);
                    break;
                }
            }
            
            if (colOffset !== -1) {
                console.log(`🔄 使用現有日期欄位，不新增重複表頭`);
            } else {
                console.log(`➕ 未找到現有日期欄位，將新增表頭`);
                console.log(`   - 搜尋範圍: ${header.length} 個欄位`);
            }
            
            // 如果找不到日期欄，找第一個空欄或在最後新增
            let needHeader = false;
            if (colOffset === -1) {
                needHeader = true;
                // 找第一個空欄
                for (let i = 0; i < header.length; i++) {
                    if (!header[i] || header[i] === '') {
                        colOffset = i;
                        break;
                    }
                }
                // 如果沒有空欄，在最後新增
                if (colOffset === -1) {
                    colOffset = header.length;
                }
            }
            
            const targetCol = 6 + colOffset; // F欄是第6欄
            console.log(`✅ 目標欄位: ${targetCol} (${needHeader ? '需新增表頭' : '已存在'})`);

            // ========== 步驟 4：準備批次更新 ==========
            const t4 = Date.now();
            const updates = [];
            
            // 如果需要新增日期表頭
            if (needHeader) {
                const headerCell = this.sheetsClient.toA1Notation(6, targetCol);
                // 🎯 將 yyyy-MM-dd 格式化為中文日期格式（例：2025年10月29日 週三）
                const chineseDate = this.formatDateToChinese(date);
                updates.push({
                    range: `'${courseType}'!${headerCell}`,
                    values: [[chineseDate]]
                });
                console.log(`📝 新增日期表頭: ${date} → ${chineseDate} 在 ${headerCell}`);
            }
            
            // 更新簽到記號
            const markCell = this.sheetsClient.toA1Notation(targetRow, targetCol);
            updates.push({
                range: `'${courseType}'!${markCell}`,
                values: [[mark]]
            });
            console.log(`📝 更新簽到記號: ${mark} 在 ${markCell}`);
            
            breakdown.prepareUpdates = Date.now() - t4;

            // ========== 步驟 5：執行批次寫入 ==========
            const t5 = Date.now();
            // 🎯 使用 USER_ENTERED 模式，將中文日期當作文字儲存
            await this.sheetsClient.batchUpdate(updates, 'USER_ENTERED');
            breakdown.batchWrite = Date.now() - t5;
            
            // 清除課程結構快取
            if (this.sheetsClient.cache.courseStructure[courseType]) {
                delete this.sheetsClient.cache.courseStructure[courseType];
            }

            // ========== 步驟 6：回傳結果 ==========
            const totalMs = Date.now() - startTime;

            return {
                success: true,
                message: '簽到狀態已更新',
                data: {
                    name: studentName,
                    course: courseType,
                    date: date,
                    mark: mark,
                    row: targetRow,
                    col: targetCol,
                    cell: markCell,
                    newColumn: needHeader,
                    remaining: studentRemaining  // 🔥 回傳剩餘堂數
                },
                performance: {
                    totalMs: totalMs,
                    breakdown: breakdown,
                    target: '< 1000ms',
                    achieved: totalMs < 500 ? '🎉 極速' : totalMs < 1000 ? '✅ 優秀' : '⚠️ 可優化'
                }
            };

        } catch (error) {
            console.error('❌ 簽到失敗:', error);
            return {
                success: false,
                error: error.message,
                stack: error.stack,
                performance: { totalMs: Date.now() - startTime }
            };
        }
    }

    // ==================== Fallback: 直接讀取模式（當快取失效時）====================

    async signInDirect(studentName, courseType, date, mark, targetRow, startTime, breakdown) {
        try {
            // ========== 讀取日期表頭 ==========
            const t3 = Date.now();
            const headerData = await this.sheetsClient.getSheetData(`'${courseType}'!F6:ZZ6`, false);
            const header = headerData[0] || [];
            breakdown.loadHeader = Date.now() - t3;
            
            console.log(`📊 讀取到 ${header.length} 個表頭欄位`);
            
            // 🎯 將目標日期格式化為中文格式，用於比對
            const chineseDate = this.formatDateToChinese(date);
            console.log(`🔍 目標日期: ${date} → ${chineseDate}`);
            
            // 🔍 查找日期對應的欄位（比對中文格式字串）
            let colOffset = -1;
            
            console.log(`🔍 開始搜尋現有日期欄位...`);
            for (let i = 0; i < header.length; i++) {
                const cell = header[i];
                
                // 跳過空欄位（注意：0 不是空）
                if (cell === null || cell === undefined || cell === '') continue;
                
                // 🎯 比對中文格式字串（向後兼容 yyyy-MM-dd 格式）
                // 注意：Google Sheets 會自動移除開頭的單引號，所以比對時不需要包含單引號
                const cellStr = String(cell).trim();
                const chineseDateWithoutQuote = chineseDate.replace(/^'/, ''); // 移除開頭的單引號
                const match = (cellStr === chineseDateWithoutQuote) ||  // 比對中文格式（無單引號）
                             (cellStr === chineseDate) ||                // 比對中文格式（含單引號，以防萬一）
                             (cellStr === date);                         // 比對原始格式（向後兼容）
                
                if (match) {
                    colOffset = i;
                    console.log(`✅✅✅ 找到現有日期欄位！位置: ${i}`);
                    break;
                }
            }
            
            // 如果找不到日期欄，找第一個空欄或在最後新增
            let needHeader = false;
            if (colOffset === -1) {
                needHeader = true;
                // 找第一個空欄
                for (let i = 0; i < header.length; i++) {
                    if (!header[i] || header[i] === '') {
                        colOffset = i;
                        break;
                    }
                }
                // 如果沒有空欄，在最後新增
                if (colOffset === -1) {
                    colOffset = header.length;
                }
            }
            
            const targetCol = 6 + colOffset; // F欄是第6欄
            console.log(`✅ 目標欄位: ${targetCol} (${needHeader ? '需新增表頭' : '已存在'})`);

            // ========== 準備批次更新 ==========
            const t4 = Date.now();
            const updates = [];
            
            // 如果需要新增日期表頭
            if (needHeader) {
                const headerCell = this.sheetsClient.toA1Notation(6, targetCol);
                const chineseDate = this.formatDateToChinese(date);
                updates.push({
                    range: `'${courseType}'!${headerCell}`,
                    values: [[chineseDate]]
                });
                console.log(`📝 新增日期表頭: ${date} → ${chineseDate} 在 ${headerCell}`);
            }
            
            // 更新簽到記號
            const markCell = this.sheetsClient.toA1Notation(targetRow, targetCol);
            updates.push({
                range: `'${courseType}'!${markCell}`,
                values: [[mark]]
            });
            console.log(`📝 更新簽到記號: ${mark} 在 ${markCell}`);
            
            breakdown.prepareUpdates = Date.now() - t4;

            // ========== 執行批次寫入 ==========
            const t5 = Date.now();
            // 🎯 使用 USER_ENTERED 模式，將中文日期當作文字儲存
            await this.sheetsClient.batchUpdate(updates, 'USER_ENTERED');
            breakdown.batchWrite = Date.now() - t5;
            
            // 🔥 清除快取（確保下次讀取最新資料）
            // 注意：HTTP API 快取由 GoogleSheetsStudents 模組管理（自動 TTL），這裡只清除本地快取
            if (this.sheetsClient.cache.courseStructure[courseType]) {
                delete this.sheetsClient.cache.courseStructure[courseType];
            }

            // ========== 回傳結果 ==========
            const totalMs = Date.now() - startTime;

            return {
                success: true,
                message: '簽到狀態已更新（直接模式）',
                data: {
                    name: studentName,
                    course: courseType,
                    date: date,
                    mark: mark,
                    row: targetRow,
                    col: targetCol,
                    cell: markCell,
                    newColumn: needHeader
                },
                performance: {
                    totalMs: totalMs,
                    breakdown: breakdown,
                    target: '< 1000ms',
                    achieved: totalMs < 500 ? '🎉 極速' : totalMs < 1000 ? '✅ 優秀' : '⚠️ 可優化',
                    mode: 'direct'
                }
            };
        } catch (error) {
            console.error('❌ 直接簽到失敗:', error);
            throw error;
        }
    }

    // ==================== 清除快取 ====================

    clearCache() {
        this.sheetsClient.clearCache();
        console.log('🧹 FastAttendance 本地快取已清除');
        console.log('💡 提示: HTTP API 快取由 GoogleSheetsStudents 模組管理（5分鐘 TTL）');
    }
    
    // 🔥 清除 HTTP API 快取（呼叫清除端點）
    async clearHttpCache() {
        try {
            const response = await axios.post(`${this.apiBaseUrl}/api/students/clear-cache`, {
                timeout: 3000
            });
            
            if (response.data.success) {
                console.log('✅ HTTP API 快取已清除');
                return true;
            }
        } catch (error) {
            console.error('❌ 清除 HTTP API 快取失敗:', error.message);
        }
        return false;
    }

    // ==================== 🏥 請假管理專用方法 ====================

    /**
     * 標記學生請假
     * @param {string} studentName - 學生姓名
     * @param {string} courseName - 課程名稱
     * @param {string} date - 日期 (YYYY-MM-DD)
     * @param {string} reason - 請假原因（可選）
     * @param {object} options - 選項（courseType, studentIndex）
     * @returns {Promise<object>} 結果
     */
    async markLeave(studentName, courseName, date, reason = '', options = {}) {
        console.log(`🏥 標記請假: ${studentName} -> ${courseName} @ ${date}`);
        if (reason) {
            console.log(`   原因: ${reason}`);
        }

        try {
            // 使用 signIn 方法，傳入 mark='假'
            const result = await this.signIn(
                studentName,
                courseName,
                date,
                '假',  // 🏥 請假標記
                options
            );

            if (result.success) {
                console.log(`✅ 請假標記成功: ${studentName}`);
                return {
                    success: true,
                    message: '請假標記已寫入 Google Sheets',
                    data: {
                        ...result.data,
                        reason: reason
                    },
                    performance: result.performance
                };
            } else {
                return result;
            }
        } catch (error) {
            console.error('❌ 標記請假失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 取消請假（清除請假標記）
     * @param {string} studentName - 學生姓名
     * @param {string} courseName - 課程名稱
     * @param {string} date - 日期 (YYYY-MM-DD)
     * @param {object} options - 選項（courseType, studentIndex）
     * @returns {Promise<object>} 結果
     */
    async cancelLeave(studentName, courseName, date, options = {}) {
        console.log(`🔄 取消請假: ${studentName} -> ${courseName} @ ${date}`);

        try {
            // 使用空字串清除標記
            const result = await this.signIn(
                studentName,
                courseName,
                date,
                '',  // 🔄 空標記表示清除
                options
            );

            if (result.success) {
                console.log(`✅ 請假已取消: ${studentName}`);
                return {
                    success: true,
                    message: '請假標記已清除',
                    data: result.data,
                    performance: result.performance
                };
            } else {
                return result;
            }
        } catch (error) {
            console.error('❌ 取消請假失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 查詢特定課程、日期的所有學生簽到狀態
     * @param {string} courseName - 課程名稱
     * @param {string} date - 日期 (YYYY-MM-DD)
     * @returns {Promise<object>} 結果
     */
    async getAttendanceStatus(courseName, date) {
        console.log(`📊 查詢簽到狀態: ${courseName} @ ${date}`);
        const startTime = Date.now();

        try {
            await this.initialize();

            // 步驟 1：讀取該課程的學生名單
            const namesData = await this.sheetsClient.getSheetData(`'${courseName}'!B7:B200`);
            const studentNames = namesData.map(r => (r[0] || '').toString().trim()).filter(n => n);

            if (studentNames.length === 0) {
                return {
                    success: true,
                    course: courseName,
                    date: date,
                    students: []
                };
            }

            console.log(`   - 找到 ${studentNames.length} 位學生`);

            // 步驟 2：讀取日期表頭
            const headerData = await this.sheetsClient.getSheetData(`'${courseName}'!F6:ZZ6`, false);
            const header = headerData[0] || [];

            // 步驟 3：找到日期對應的欄位
            const chineseDate = this.formatDateToChinese(date);
            let colOffset = -1;

            for (let i = 0; i < header.length; i++) {
                const cell = header[i];
                if (cell === null || cell === undefined || cell === '') continue;

                // 注意：Google Sheets 會自動移除開頭的單引號
                const cellStr = String(cell).trim();
                const chineseDateWithoutQuote = chineseDate.replace(/^'/, '');
                const match = (cellStr === chineseDateWithoutQuote) ||  // 比對中文格式（無單引號）
                             (cellStr === chineseDate) ||                // 比對中文格式（含單引號）
                             (cellStr === date);                         // 比對原始格式（向後兼容）

                if (match) {
                    colOffset = i;
                    break;
                }
            }

            // 如果找不到該日期欄位，表示尚未有任何簽到記錄
            if (colOffset === -1) {
                console.log(`   - 該日期尚未有簽到記錄`);
                return {
                    success: true,
                    course: courseName,
                    date: date,
                    students: studentNames.map(name => ({
                        name: name,
                        status: '未簽到',
                        mark: ''
                    }))
                };
            }

            const targetCol = 6 + colOffset;
            console.log(`   - 日期欄位: 第 ${targetCol} 欄`);

            // 步驟 4：批次讀取所有學生的簽到記錄
            const startRow = 7;
            const endRow = 7 + studentNames.length - 1;
            const colA1 = this.sheetsClient.toA1Col(targetCol);
            const range = `'${courseName}'!${colA1}${startRow}:${colA1}${endRow}`;

            console.log(`   - 讀取範圍: ${range}`);
            const marksData = await this.sheetsClient.getSheetData(range);

            // 步驟 5：組裝結果
            const students = studentNames.map((name, index) => {
                const mark = (marksData[index] && marksData[index][0]) 
                    ? String(marksData[index][0]).trim().toUpperCase() 
                    : '';

                let status = '未簽到';
                if (mark === 'V') {
                    status = 'present';
                } else if (mark === 'X') {
                    status = 'absent';
                } else if (mark === '假' || mark === '請假') {
                    status = 'leave';
                } else if (mark !== '') {
                    status = '其他';
                }

                return {
                    name: name,
                    status: status,
                    mark: mark
                };
            });

            const elapsed = Date.now() - startTime;
            console.log(`✅ 簽到狀態查詢完成 (${students.length} 位學生, ${elapsed}ms)`);

            return {
                success: true,
                course: courseName,
                date: date,
                students: students,
                performance: {
                    totalMs: elapsed
                }
            };

        } catch (error) {
            console.error('❌ 查詢簽到狀態失敗:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = FastAttendanceManager;

