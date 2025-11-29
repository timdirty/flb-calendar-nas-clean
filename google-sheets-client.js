// google-sheets-client.js
// 🚀 Google Sheets API 客戶端（終極方案）

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

class GoogleSheetsClient {
    constructor(options = {}) {
        this.SPREADSHEET_ID = options.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '1A2dPb0iyvaqVGTOKqGcsq7aC6UHNttVcJ82r-G0xevk';
        this.auth = null;
        this.sheets = null;
        this.cache = {
            studentIndex: null,
            courseStructure: {},
            lastUpdate: 0
        };
        this.CACHE_TTL = 5 * 60 * 1000; // 5 分鐘快取
        this.sheetMetaCache = new Map();
    }

    // ==================== 初始化 ====================
    
    async initialize() {
        try {
            const keyFilePath = path.join(__dirname, 'service-account.json');
            
            if (!fs.existsSync(keyFilePath)) {
                throw new Error('找不到 service-account.json，請確認檔案存在');
            }

            const credentials = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));

            this.auth = new google.auth.GoogleAuth({
                credentials,
                scopes: ['https://www.googleapis.com/auth/spreadsheets']
            });

            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            
            console.log('✅ Google Sheets API 初始化成功');
            return true;
        } catch (error) {
            console.error('❌ Google Sheets API 初始化失敗:', error);
            throw error;
        }
    }

    // ==================== 快取管理 ====================

    isCacheValid() {
        return this.cache.studentIndex && 
               (Date.now() - this.cache.lastUpdate < this.CACHE_TTL);
    }

    clearCache() {
        this.cache = {
            studentIndex: null,
            courseStructure: {},
            lastUpdate: 0
        };
        console.log('🔄 快取已清除');
    }

    // ==================== 讀取資料 ====================

    async getSheetData(range, useRawValues = false) {
        try {
            const options = {
                spreadsheetId: this.SPREADSHEET_ID,
                range: range
            };
            
            // 🎯 如果需要原始值（序號），使用 UNFORMATTED_VALUE
            if (useRawValues) {
                options.valueRenderOption = 'UNFORMATTED_VALUE';
                options.dateTimeRenderOption = 'SERIAL_NUMBER';
            }
            
            const response = await this.sheets.spreadsheets.values.get(options);
            return response.data.values || [];
        } catch (error) {
            console.error(`❌ 讀取 ${range} 失敗:`, error);
            throw error;
        }
    }

    // ==================== 建立學生索引 ====================

    async buildStudentIndex() {
        if (this.isCacheValid()) {
            console.log('✅ 使用快取的學生索引');
            return this.cache.studentIndex;
        }

        console.log('🔄 建立新的學生索引...');
        const startTime = Date.now();

        try {
            // 🎯 讀取「學生Data(Sync Notion Class)」工作表 A2:U
            // A(0)=姓名, F(5)=課程, G(6)=時段, I(8)=剩餘堂數, U(20)=userId
            const studentData = await this.getSheetData("'學生Data(Sync Notion Class)'!A2:U");
            
            if (!studentData || studentData.length === 0) {
                throw new Error('學生Data(Sync Notion Class) 工作表為空');
            }

            // 建立索引：key = 學生姓名, value = 課程資訊
            const studentIndex = new Map();
            
            for (let i = 0; i < studentData.length; i++) {
                const row = studentData[i];
                const name = (row[0] || '').toString().trim();
                const course = (row[5] || '').toString().trim();
                const period = (row[6] || '').toString().trim();
                const remaining = Number(row[8] || 0);
                const userId = (row[20] || '').toString().trim();
                
                if (!name) continue;

                // 一個學生可能有多個課程，用「姓名|||課程|||時段」作為完整 key
                const fullKey = `${name}|||${course}|||${period}`;
                
                if (!studentIndex.has(name)) {
                    studentIndex.set(name, {
                        name: name,
                        courses: [],  // 所有課程的陣列
                        coursePeriods: new Map(), // 課程 -> 時段 Map
                        userRow: i + 2, // Google Sheets 從 1 開始，且略過表頭
                        userId: userId
                    });
                }
                
                const student = studentIndex.get(name);
                
                // 添加課程（去重）
                if (course && !student.courses.includes(course)) {
                    student.courses.push(course);
                }
                
                // 添加課程時段資訊
                if (course && period) {
                    if (!student.coursePeriods.has(course)) {
                        student.coursePeriods.set(course, []);
                    }
                    student.coursePeriods.get(course).push({
                        period: period,
                        remaining: remaining,
                        fullKey: fullKey
                    });
                }
            }

            this.cache.studentIndex = studentIndex;
            this.cache.lastUpdate = Date.now();

            const elapsed = Date.now() - startTime;
            console.log(`✅ 學生索引建立完成 (${studentIndex.size} 位學生, ${elapsed}ms)`);

            return studentIndex;
        } catch (error) {
            console.error('❌ 建立學生索引失敗:', error);
            throw error;
        }
    }

    // ==================== 取得課程結構 ====================

    async getCourseStructure(courseName) {
        if (this.cache.courseStructure[courseName]) {
            console.log(`✅ 使用快取的課程結構: ${courseName}`);
            return this.cache.courseStructure[courseName];
        }

        console.log(`🔄 讀取課程結構: ${courseName}`);
        const startTime = Date.now();

        try {
            // 🎯 批次讀取兩個範圍：B7:B（學生名單）和 F6:CZ6（日期標題）
            const response = await this.sheets.spreadsheets.values.batchGet({
                spreadsheetId: this.SPREADSHEET_ID,
                ranges: [
                    `'${courseName}'!B7:B200`,    // 學生名單（最多200人）
                    `'${courseName}'!F6:CZ6`      // 日期標題（104個日期欄位）
                ],
                valueRenderOption: 'UNFORMATTED_VALUE',
                dateTimeRenderOption: 'SERIAL_NUMBER'
            });

            const namesData = response.data.valueRanges[0]?.values || [];
            const datesData = response.data.valueRanges[1]?.values?.[0] || [];

            // 建立學生名稱 -> 行索引 Map
            const studentToRow = new Map();
            namesData.forEach((row, idx) => {
                const name = (row[0] || '').toString().trim();
                if (name) {
                    studentToRow.set(name, 7 + idx); // 第 7 行開始
                }
            });

            // 建立日期 -> 欄索引 Map（轉換序號為日期字串）
            const dateToCol = new Map();
            let firstEmptyCol = 6 + datesData.length; // 預設最後一欄之後
            
            datesData.forEach((cell, offset) => {
                if (!cell || cell === '') {
                    // 記錄第一個空欄位
                    if (6 + offset < firstEmptyCol) {
                        firstEmptyCol = 6 + offset;
                    }
                } else {
                    // 轉換日期序號為 yyyy-MM-dd 格式
                    const dateStr = this.serialToDate(cell);
                    if (dateStr) {
                        dateToCol.set(dateStr, 6 + offset); // F 欄是第 6 欄
                    }
                }
            });

            const structure = {
                studentToRow,
                dateToCol,
                firstEmptyCol,
                totalStudents: studentToRow.size,
                totalDates: dateToCol.size
            };

            this.cache.courseStructure[courseName] = structure;

            const elapsed = Date.now() - startTime;
            console.log(`✅ 課程結構載入完成: ${courseName} (${structure.totalStudents} 位學生, ${structure.totalDates} 個日期, ${elapsed}ms)`);

            return structure;
        } catch (error) {
            console.error(`❌ 讀取課程結構失敗: ${courseName}`, error);
            throw error;
        }
    }

    // ==================== 日期序號轉換 ====================

    serialToDate(serial) {
        if (typeof serial === 'number' && !isNaN(serial)) {
            // ✅ Google Sheets 日期序列號使用 UTC 計算
            // Excel/Google Sheets 的基準日期：1899-12-30
            const baseDate = Date.UTC(1899, 11, 30); // UTC
            const targetDate = new Date(baseDate + serial * 86400000);
            
            if (!isNaN(targetDate.getTime())) {
                // 使用 UTC 方法取得年月日
                const year = targetDate.getUTCFullYear();
                const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
                const day = String(targetDate.getUTCDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
        
        // 如果已經是字串格式的日期
        const str = String(serial || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
            return str;
        }
        
        return '';
    }

    // 🎯 將 yyyy-MM-dd 字串轉換為 Google Sheets 日期序號
    dateToSerial(dateStr) {
        // 解析 yyyy-MM-dd 格式
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
        if (!match) return null;
        
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // JavaScript 月份從0開始
        const day = parseInt(match[3], 10);
        
        // ✅ Google Sheets 日期序列號使用 UTC 計算
        // Excel/Google Sheets 的日期序號從 1899-12-30 開始計算
        const targetDate = Date.UTC(year, month, day);
        const baseDate = Date.UTC(1899, 11, 30); // 1899-12-30 UTC
        
        const diffTime = targetDate - baseDate;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
        
        return diffDays;
    }

    // ==================== 批次寫入 ====================

    async batchUpdate(updates, valueInputOption = 'RAW') {
        try {
            // 🎯 預設使用 RAW 模式寫入已轉換好的值（如日期序號）
            // 若需要讓 Google Sheets 自動解析，可傳入 'USER_ENTERED'
            const response = await this.sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: this.SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: valueInputOption,
                    data: updates
                }
            });
            return response.data;
        } catch (error) {
            console.error('❌ 批次寫入失敗:', error);
            throw error;
        }
    }
    
    async appendRows(range, values, valueInputOption = 'RAW') {
        try {
            const response = await this.sheets.spreadsheets.values.append({
                spreadsheetId: this.SPREADSHEET_ID,
                range,
                valueInputOption,
                insertDataOption: 'INSERT_ROWS',
                requestBody: {
                    values
                }
            });
            return response.data;
        } catch (error) {
            console.error('❌ 追加資料失敗:', error);
            throw error;
        }
    }

    async batchUpdateRequest(requests) {
        try {
            const response = await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId: this.SPREADSHEET_ID,
                requestBody: { requests }
            });
            return response.data;
        } catch (error) {
            console.error('❌ Google Sheets batchUpdate 失敗:', error);
            throw error;
        }
    }

    async getSheetProperties(sheetName, useCache = true) {
        if (useCache && this.sheetMetaCache.has(sheetName)) {
            return this.sheetMetaCache.get(sheetName);
        }

        try {
            const response = await this.sheets.spreadsheets.get({
                spreadsheetId: this.SPREADSHEET_ID
            });

            const sheet = response.data.sheets?.find(s => s.properties?.title === sheetName);
            if (sheet && sheet.properties) {
                this.sheetMetaCache.set(sheetName, sheet.properties);
                return sheet.properties;
            }

            console.warn(`⚠️ 找不到工作表: ${sheetName}`);
            return null;
        } catch (error) {
            console.error('❌ 取得工作表資訊失敗:', error);
            throw error;
        }
    }

    // ==================== A1 轉換工具 ====================

    toA1Notation(row, col) {
        let columnName = '';
        let tempCol = col;
        
        while (tempCol > 0) {
            const remainder = (tempCol - 1) % 26;
            columnName = String.fromCharCode(65 + remainder) + columnName;
            tempCol = Math.floor((tempCol - 1) / 26);
        }
        
        return `${columnName}${row}`;
    }
}

module.exports = GoogleSheetsClient;
