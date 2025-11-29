/**
 * 🧪 Phase 3 模組測試
 * 
 * 測試 Students、Temporary Students 和 Attendance 模組的所有端點
 * 
 * 使用方法：
 * 1. 啟動伺服器：
 *    PORT=3000 DISABLE_AUTO_REMINDERS=true \
 *    USE_ROUTES_PHASE3=true \
 *    ENABLE_STUDENTS_V2=true \
 *    ENABLE_TEMPORARY_STUDENTS_V2=true \
 *    ENABLE_ATTENDANCE_V2=true \
 *    node server.js
 * 
 * 2. 執行測試：
 *    node tests/routes/test-phase3-modules.js
 */

const axios = require('axios');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v3';

// 測試結果統計
const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    details: []
};

// 顏色輸出
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

/**
 * 執行測試
 */
async function runTest(name, method, path, data = null, expectedStatus = 200) {
    try {
        const url = `${BASE_URL}${API_PREFIX}${path}`;
        console.log(`\n🧪 測試: ${name}`);
        console.log(`   ${method} ${url}`);
        
        let response;
        if (method === 'GET') {
            response = await axios.get(url);
        } else if (method === 'POST') {
            response = await axios.post(url, data || {});
        } else if (method === 'PUT') {
            response = await axios.put(url, data || {});
        } else if (method === 'DELETE') {
            response = await axios.delete(url);
        }
        
        if (response.status === expectedStatus) {
            console.log(`${colors.green}✅ 通過${colors.reset} - ${response.status}`);
            results.passed++;
            results.details.push({ name, status: 'passed', code: response.status });
            return response.data;
        } else {
            console.log(`${colors.red}❌ 失敗${colors.reset} - 預期 ${expectedStatus}, 得到 ${response.status}`);
            results.failed++;
            results.details.push({ name, status: 'failed', code: response.status });
            return null;
        }
    } catch (error) {
        if (error.response) {
            const status = error.response.status;
            // 401 是預期的（需要認證）
            if (expectedStatus === 401 && status === 401) {
                console.log(`${colors.green}✅ 通過${colors.reset} - ${status} (需要認證，符合預期)`);
                results.passed++;
                results.details.push({ name, status: 'passed', code: status });
                return null;
            }
            console.log(`${colors.red}❌ 失敗${colors.reset} - ${status}: ${error.response.data?.error || error.message}`);
            results.failed++;
            results.details.push({ 
                name, 
                status: 'failed', 
                code: status,
                error: error.response.data?.error || error.message
            });
        } else {
            console.log(`${colors.red}❌ 錯誤${colors.reset} - ${error.message}`);
            results.failed++;
            results.details.push({ name, status: 'error', error: error.message });
        }
        return null;
    }
}

/**
 * 主測試函數
 */
async function main() {
    console.log(`${colors.blue}🎄 開始測試 Phase 3 模組...${colors.reset}`);
    console.log(`\n📍 測試目標: ${BASE_URL}${API_PREFIX}`);
    console.log('────────────────────────────────────────────────────────────\n');
    
    // ==================== Students 模組測試 ====================
    console.log(`${colors.blue}\n👥 Students 模組${colors.reset}`);
    
    await runTest(
        '1. 取得所有學生',
        'GET',
        '/students'
    );
    
    await runTest(
        '2. 從 Google Sheets 取得學生',
        'GET',
        '/students/from-sheets'
    );
    
    await runTest(
        '3. 按課程取得學生',
        'GET',
        '/students/by-course?course=測試課程'
    );
    
    await runTest(
        '4. 取得學生資料檔案',
        'GET',
        '/students/data'
    );
    
    await runTest(
        '5. 搜尋學生',
        'GET',
        '/students/search?keyword=測試'
    );
    
    await runTest(
        '6. 取得學生統計',
        'GET',
        '/students/stats'
    );
    
    await runTest(
        '7. 清除學生快取',
        'POST',
        '/students/clear-cache'
    );
    
    // ==================== Temporary Students 模組測試 ====================
    console.log(`${colors.blue}\n🎓 Temporary Students 模組${colors.reset}`);
    
    await runTest(
        '8. 取得臨時學生列表',
        'GET',
        '/temporary-students'
    );
    
    await runTest(
        '9. 取得封存記錄',
        'GET',
        '/temporary-students/archive'
    );
    
    // ==================== Attendance 模組測試 ====================
    console.log(`${colors.blue}\n📊 Attendance 模組${colors.reset}`);
    
    await runTest(
        '10. 查詢簽到狀態',
        'GET',
        '/attendance/status?course=測試課程&date=2025-01-01'
    );
    
    await runTest(
        '11. 查詢隊列狀態',
        'GET',
        '/attendance/queue/stats'
    );
    
    await runTest(
        '12. 調試學生列表',
        'GET',
        '/attendance/debug/students'
    );
    
    // ==================== 測試結果統計 ====================
    console.log('\n────────────────────────────────────────────────────────────');
    console.log(`\n${colors.blue}📊 測試結果統計${colors.reset}\n`);
    
    const total = results.passed + results.failed + results.skipped;
    console.log(`總測試數: ${total}`);
    console.log(`${colors.green}✅ 通過: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}❌ 失敗: ${results.failed}${colors.reset}`);
    console.log(`${colors.yellow}⏸️ 跳過: ${results.skipped}${colors.reset}`);
    
    const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
    console.log(`\n通過率: ${passRate}%`);
    
    // 評級
    let grade = 'F';
    if (passRate >= 90) grade = 'A';
    else if (passRate >= 80) grade = 'B';
    else if (passRate >= 70) grade = 'C';
    else if (passRate >= 60) grade = 'D';
    
    const gradeColor = grade === 'A' ? colors.green : 
                       grade === 'B' ? colors.blue : 
                       grade === 'C' ? colors.yellow : colors.red;
    console.log(`評級: ${gradeColor}${grade}${colors.reset} ${grade === 'A' ? '優秀' : grade === 'B' ? '良好' : grade === 'C' ? '及格' : '不及格'}`);
    
    // 失敗的測試
    if (results.failed > 0) {
        console.log(`\n${colors.red}❌ 失敗的測試:${colors.reset}`);
        results.details.filter(d => d.status === 'failed' || d.status === 'error').forEach(detail => {
            console.log(`  - ${detail.name} (${detail.code || 'N/A'})`);
            if (detail.error) {
                console.log(`    錯誤: ${detail.error}`);
            }
        });
    }
    
    // 詳細結果
    console.log(`\n📋 詳細結果:`);
    results.details.forEach((detail, index) => {
        const icon = detail.status === 'passed' ? '✅' : '❌';
        console.log(`  ${icon} ${index + 1}. ${detail.name} - ${detail.code || 'N/A'}`);
    });
    
    console.log('\n────────────────────────────────────────────────────────────');
    
    // 總結
    if (results.failed === 0) {
        console.log(`\n${colors.green}🎉 所有測試通過！Phase 3 模組運作正常！${colors.reset}`);
    } else {
        console.log(`\n${colors.yellow}⚠️ 有 ${results.failed} 個測試失敗，請檢查上述錯誤訊息${colors.reset}`);
    }
    
    // 返回退出碼
    process.exit(results.failed > 0 ? 1 : 0);
}

// 執行測試
main().catch(error => {
    console.error(`${colors.red}❌ 測試執行失敗:${colors.reset}`, error);
    process.exit(1);
});
