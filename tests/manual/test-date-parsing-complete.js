// 完整的日期解析邊界條件測試
const GoogleSheetsStudents = require('./google-sheets-students.js');

// ============================================
// 測試配置
// ============================================
const COLORS = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(color, emoji, message) {
    console.log(`${COLORS[color]}${emoji} ${message}${COLORS.reset}`);
}

function header(title) {
    console.log('\n' + '='.repeat(60));
    console.log(`  ${title}`);
    console.log('='.repeat(60) + '\n');
}

// ============================================
// 測試 1: 日期解析功能（各種格式）
// ============================================
async function testDateParsing() {
    header('測試 1: 日期解析功能');
    
    const gs = new GoogleSheetsStudents();
    
    const testCases = [
        // 數字序號格式
        { input: 45963, expected: '2025-11-02', description: '標準 Excel 序號' },
        { input: 44927, expected: '2023-01-01', description: '2023年序號' },
        { input: 0, expected: null, description: '無效序號 (0)' },
        { input: -1, expected: null, description: '負數序號' },
        
        // 中文日期格式
        { input: '2025年10月30日 週四', expected: '2025-10-30', description: '中文日期 + 星期' },
        { input: '2025年11月6日 週四', expected: '2025-11-06', description: '中文日期 + 星期' },
        { input: '2025年1月1日', expected: '2025-01-01', description: '中文日期（無星期）' },
        { input: '2025年12月31日 週三', expected: '2025-12-31', description: '年底日期' },
        
        // 斜線格式
        { input: '2025/10/30', expected: '2025-10-30', description: '斜線格式' },
        { input: '2025/1/1', expected: '2025-01-01', description: '斜線格式（單位數）' },
        
        // 橫線格式
        { input: '2025-10-30', expected: '2025-10-30', description: '橫線格式' },
        { input: '2025-1-1', expected: '2025-01-01', description: '橫線格式（單位數）' },
        
        // 空值和無效值
        { input: '', expected: null, description: '空字串' },
        { input: null, expected: null, description: 'null' },
        { input: undefined, expected: null, description: 'undefined' },
        { input: 'invalid date', expected: null, description: '無效文字' },
        { input: '2025年13月50日', expected: null, description: '無效日期（超出範圍）' },
        { input: NaN, expected: null, description: 'NaN' },
        
        // 邊界值
        { input: '   2025年10月30日 週四   ', expected: '2025-10-30', description: '前後有空白' },
        { input: '2025年1月1日', expected: '2025-01-01', description: '年初' },
        { input: '2025年12月31日', expected: '2025-12-31', description: '年末' }
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const test of testCases) {
        const result = gs.serialToDate(test.input);
        const success = result === test.expected;
        
        if (success) {
            passed++;
            log('green', '✅', `${test.description}: ${JSON.stringify(test.input)} → ${result}`);
        } else {
            failed++;
            log('red', '❌', `${test.description}: ${JSON.stringify(test.input)}`);
            log('red', '  ', `  預期: ${test.expected}, 實際: ${result}`);
        }
    }
    
    console.log('\n' + '-'.repeat(60));
    log(failed === 0 ? 'green' : 'yellow', '📊', `測試結果: ${passed} 通過, ${failed} 失敗`);
    
    return failed === 0;
}

// ============================================
// 測試 2: 實際 Google Sheets 表頭讀取
// ============================================
async function testRealSheetHeaders() {
    header('測試 2: 實際 Google Sheets 表頭讀取');
    
    const gs = new GoogleSheetsStudents();
    
    try {
        // 測試 ESM 課程
        log('blue', '📊', '讀取 ESM 課程表頭（擴大範圍到 CZ）...');
        const headerData = await gs.fetchSheetData("'ESM'!F6:CZ6", true);
        const headers = headerData[0] || [];
        
        log('cyan', '📈', `表頭總長度: ${headers.length} 欄`);
        
        // 解析所有日期
        const dates = [];
        const invalidDates = [];
        
        headers.forEach((value, index) => {
            if (value !== null && value !== undefined && value !== '') {
                const date = gs.serialToDate(value);
                if (date) {
                    dates.push({ index, value, date });
                } else {
                    invalidDates.push({ index, value });
                }
            }
        });
        
        log('green', '✅', `成功解析 ${dates.length} 個日期`);
        
        if (invalidDates.length > 0) {
            log('yellow', '⚠️', `${invalidDates.length} 個欄位無法解析為日期`);
            invalidDates.slice(0, 5).forEach(item => {
                log('yellow', '  ', `  索引 ${item.index}: ${JSON.stringify(item.value)}`);
            });
        }
        
        // 顯示最後 15 個日期
        console.log('\n📅 最後 15 個日期:');
        dates.slice(-15).forEach(d => {
            const typeInfo = typeof d.value === 'number' ? '(數字序號)' : '(文字格式)';
            console.log(`   ${d.date} ${typeInfo} [索引: ${d.index}]`);
        });
        
        // 檢查關鍵日期
        console.log('\n🔍 檢查關鍵日期:');
        const keyDates = ['2025-10-30', '2025-11-06', '2025-11-02'];
        keyDates.forEach(keyDate => {
            const found = dates.find(d => d.date === keyDate);
            if (found) {
                log('green', '✅', `${keyDate} 存在於索引 ${found.index}`);
            } else {
                log('red', '❌', `${keyDate} 不存在`);
            }
        });
        
        return true;
        
    } catch (error) {
        log('red', '❌', `測試失敗: ${error.message}`);
        return false;
    }
}

// ============================================
// 測試 3: ESM 課程所有學生的出席記錄
// ============================================
async function testESMStudents() {
    header('測試 3: ESM 課程所有學生出席記錄');
    
    const gs = new GoogleSheetsStudents();
    gs.clearCache();
    
    try {
        log('blue', '📊', '讀取 ESM 課程所有學生...');
        const data = await gs.getStudentsByCourse('ESM');
        
        log('green', '✅', `成功讀取 ${data.students.length} 位學生`);
        
        // 檢查每位學生
        console.log('\n👥 學生出席記錄統計:');
        console.log('-'.repeat(80));
        console.log('姓名'.padEnd(20) + '出席次數'.padEnd(12) + '最後出席日期'.padEnd(20) + '包含10/30'.padEnd(12) + '包含11/6');
        console.log('-'.repeat(80));
        
        let totalStudents = 0;
        let studentsWithAttendance = 0;
        let studentsWith1030 = 0;
        let studentsWith1106 = 0;
        
        for (const student of data.students) {
            totalStudents++;
            const attendanceCount = student.attendance.length;
            
            if (attendanceCount > 0) {
                studentsWithAttendance++;
            }
            
            const lastAttendance = student.attendance.length > 0 
                ? student.attendance[student.attendance.length - 1].date 
                : 'N/A';
            
            const has1030 = student.attendance.some(a => a.date === '2025-10-30');
            const has1106 = student.attendance.some(a => a.date === '2025-11-06');
            
            if (has1030) studentsWith1030++;
            if (has1106) studentsWith1106++;
            
            const name = student.name.padEnd(20);
            const count = String(attendanceCount).padEnd(12);
            const last = lastAttendance.padEnd(20);
            const check1030 = (has1030 ? '✅' : '  ').padEnd(12);
            const check1106 = has1106 ? '✅' : '  ';
            
            console.log(`${name}${count}${last}${check1030}${check1106}`);
        }
        
        console.log('-'.repeat(80));
        console.log('\n📊 統計摘要:');
        log('cyan', '📈', `總學生數: ${totalStudents}`);
        log('cyan', '📈', `有出席記錄: ${studentsWithAttendance}`);
        log('cyan', '📈', `包含 10/30: ${studentsWith1030}`);
        log('cyan', '📈', `包含 11/6: ${studentsWith1106}`);
        
        return true;
        
    } catch (error) {
        log('red', '❌', `測試失敗: ${error.message}`);
        console.error(error.stack);
        return false;
    }
}

// ============================================
// 測試 4: Audrey 的完整出席記錄
// ============================================
async function testAudreyAttendance() {
    header('測試 4: Audrey 完整出席記錄驗證');
    
    const gs = new GoogleSheetsStudents();
    gs.clearCache();
    
    try {
        const data = await gs.getStudentsByCourse('ESM');
        const audrey = data.students.find(s => s.name === 'Audrey');
        
        if (!audrey) {
            log('red', '❌', '找不到 Audrey');
            return false;
        }
        
        log('green', '✅', `找到 Audrey (剩餘堂數: ${audrey.remaining})`);
        log('cyan', '📋', `時段: ${audrey.period}`);
        
        console.log('\n📅 完整出席記錄:');
        console.log('-'.repeat(60));
        
        audrey.attendance.forEach((record, index) => {
            const status = record.present === true ? '✅ 出席' : 
                          record.present === false ? '❌ 缺席' : 
                          '📝 請假';
            console.log(`  ${index + 1}. ${record.date} ${status}`);
        });
        
        console.log('-'.repeat(60));
        
        // 關鍵日期檢查
        const keyDates = [
            { date: '2025-10-30', expected: true },
            { date: '2025-11-06', expected: true },
            { date: '2025-10-16', expected: true }
        ];
        
        console.log('\n🔍 關鍵日期驗證:');
        let allPassed = true;
        
        for (const check of keyDates) {
            const record = audrey.attendance.find(a => a.date === check.date);
            const exists = !!record;
            const isPresent = record?.present === true;
            
            if (exists && isPresent === check.expected) {
                log('green', '✅', `${check.date}: 存在且正確 (${isPresent ? '出席' : '缺席'})`);
            } else if (exists) {
                log('yellow', '⚠️', `${check.date}: 存在但狀態不符 (預期: ${check.expected ? '出席' : '缺席'})`);
                allPassed = false;
            } else {
                log('red', '❌', `${check.date}: 不存在`);
                allPassed = false;
            }
        }
        
        return allPassed;
        
    } catch (error) {
        log('red', '❌', `測試失敗: ${error.message}`);
        return false;
    }
}

// ============================================
// 測試 5: 混合格式處理（同一行有數字和文字）
// ============================================
async function testMixedFormats() {
    header('測試 5: 混合日期格式處理');
    
    const gs = new GoogleSheetsStudents();
    
    try {
        log('blue', '📊', '讀取 ESM 課程表頭（檢查混合格式）...');
        const headerData = await gs.fetchSheetData("'ESM'!F6:CZ6", true);
        const headers = headerData[0] || [];
        
        const numberDates = [];
        const textDates = [];
        
        headers.forEach((value, index) => {
            if (value !== null && value !== undefined && value !== '') {
                const date = gs.serialToDate(value);
                if (date) {
                    if (typeof value === 'number') {
                        numberDates.push({ index, date, value });
                    } else {
                        textDates.push({ index, date, value });
                    }
                }
            }
        });
        
        log('cyan', '📊', `數字格式日期: ${numberDates.length} 個`);
        log('cyan', '📊', `文字格式日期: ${textDates.length} 個`);
        
        if (textDates.length > 0) {
            console.log('\n📝 文字格式日期範例:');
            textDates.slice(0, 10).forEach(d => {
                console.log(`  索引 ${d.index}: "${d.value}" → ${d.date}`);
            });
        }
        
        // 檢查連續性
        const allDates = [...numberDates, ...textDates].sort((a, b) => a.index - b.index);
        console.log('\n🔗 檢查日期連續性（最後 10 個）:');
        allDates.slice(-10).forEach((d, i, arr) => {
            const type = typeof d.value === 'number' ? '數字' : '文字';
            const marker = i > 0 && arr[i-1].index !== d.index - 1 ? '⚠️ 跳躍' : '  ';
            console.log(`  ${marker} 索引 ${d.index} [${type}]: ${d.date}`);
        });
        
        return true;
        
    } catch (error) {
        log('red', '❌', `測試失敗: ${error.message}`);
        return false;
    }
}

// ============================================
// 測試 6: API 快取行為
// ============================================
async function testCacheBehavior() {
    header('測試 6: API 快取行為');
    
    const gs = new GoogleSheetsStudents();
    
    try {
        // 第一次讀取（無快取）
        log('blue', '📊', '第一次讀取（無快取）...');
        gs.clearCache();
        const start1 = Date.now();
        const data1 = await gs.getStudentsByCourse('ESM');
        const time1 = Date.now() - start1;
        log('cyan', '⏱️', `耗時: ${time1}ms`);
        
        // 第二次讀取（使用快取）
        log('blue', '📊', '第二次讀取（使用快取）...');
        const start2 = Date.now();
        const data2 = await gs.getStudentsByCourse('ESM');
        const time2 = Date.now() - start2;
        log('cyan', '⏱️', `耗時: ${time2}ms`);
        
        // 驗證資料一致性
        const audrey1 = data1.students.find(s => s.name === 'Audrey');
        const audrey2 = data2.students.find(s => s.name === 'Audrey');
        
        const consistent = JSON.stringify(audrey1) === JSON.stringify(audrey2);
        
        if (consistent) {
            log('green', '✅', '快取資料一致');
        } else {
            log('red', '❌', '快取資料不一致');
            return false;
        }
        
        if (time2 < time1 * 0.1) {
            log('green', '✅', `快取效能提升: ${Math.round((1 - time2/time1) * 100)}%`);
        } else {
            log('yellow', '⚠️', '快取效能提升不明顯');
        }
        
        return true;
        
    } catch (error) {
        log('red', '❌', `測試失敗: ${error.message}`);
        return false;
    }
}

// ============================================
// 主測試執行
// ============================================
async function runAllTests() {
    console.log('\n' + '🧪'.repeat(30));
    console.log('  完整邊界條件測試套件');
    console.log('🧪'.repeat(30));
    
    const results = {
        passed: 0,
        failed: 0,
        tests: []
    };
    
    const tests = [
        { name: '日期解析功能', fn: testDateParsing },
        { name: 'Google Sheets 表頭讀取', fn: testRealSheetHeaders },
        { name: 'ESM 所有學生出席記錄', fn: testESMStudents },
        { name: 'Audrey 完整驗證', fn: testAudreyAttendance },
        { name: '混合日期格式處理', fn: testMixedFormats },
        { name: 'API 快取行為', fn: testCacheBehavior }
    ];
    
    for (const test of tests) {
        try {
            const passed = await test.fn();
            if (passed) {
                results.passed++;
                results.tests.push({ name: test.name, status: 'PASS' });
            } else {
                results.failed++;
                results.tests.push({ name: test.name, status: 'FAIL' });
            }
        } catch (error) {
            results.failed++;
            results.tests.push({ name: test.name, status: 'ERROR', error: error.message });
            log('red', '❌', `測試執行錯誤: ${error.message}`);
        }
    }
    
    // 最終報告
    header('測試總結');
    
    results.tests.forEach(test => {
        if (test.status === 'PASS') {
            log('green', '✅', `${test.name}: 通過`);
        } else if (test.status === 'FAIL') {
            log('red', '❌', `${test.name}: 失敗`);
        } else {
            log('red', '💥', `${test.name}: 錯誤 (${test.error})`);
        }
    });
    
    console.log('\n' + '='.repeat(60));
    if (results.failed === 0) {
        log('green', '🎉', `所有測試通過！(${results.passed}/${results.passed + results.failed})`);
        console.log('='.repeat(60));
        process.exit(0);
    } else {
        log('red', '⚠️', `${results.failed} 個測試失敗 (${results.passed}/${results.passed + results.failed})`);
        console.log('='.repeat(60));
        process.exit(1);
    }
}

// 執行測試
runAllTests().catch(error => {
    console.error('💥 測試執行失敗:', error);
    process.exit(1);
});

