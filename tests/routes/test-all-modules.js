/**
 * 🧪 全模組整合測試腳本
 * 
 * 用途：測試所有已完成的 API 模組
 * 階段：Phase 2, 3, 4, 6 (Events)
 * 
 * 執行前請確保伺服器已啟動：
 * PORT=3000 DISABLE_AUTO_REMINDERS=true \
 * USE_ROUTES_PHASE2=true USE_ROUTES_PHASE3=true \
 * USE_ROUTES_PHASE4=true USE_ROUTES_PHASE6=true \
 * ENABLE_HOLIDAYS_V2=true ENABLE_STUDENTS_V2=true \
 * ENABLE_ATTENDANCE_V2=true ENABLE_NOTIFICATIONS_V2=true \
 * ENABLE_EVENTS_V2=true \
 * node server.js
 */

const axios = require('axios');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v3';  // 🔥 [修復 2025-11-27] 改為 v3 避免與舊系統衝突

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
 * 執行單一測試
 */
async function runTest(name, method, endpoint, options = {}) {
    try {
        const url = `${BASE_URL}${API_PREFIX}${endpoint}`;
        const config = {
            method,
            url,
            validateStatus: () => true, // 接受所有狀態碼
            ...options
        };

        const response = await axios(config);
        const success = response.status >= 200 && response.status < 300;
        
        if (success) {
            results.passed++;
            results.details.push({
                name,
                status: 'PASS',
                code: response.status,
                endpoint
            });
            console.log(`${colors.green}✅${colors.reset} ${name}: ${response.status}`);
        } else {
            results.failed++;
            results.details.push({
                name,
                status: 'FAIL',
                code: response.status,
                endpoint,
                error: response.data?.error || response.statusText
            });
            console.log(`${colors.red}❌${colors.reset} ${name}: ${response.status} - ${response.data?.error || response.statusText}`);
        }
        
        return response;
    } catch (error) {
        results.failed++;
        results.details.push({
            name,
            status: 'ERROR',
            endpoint,
            error: error.message
        });
        console.log(`${colors.red}❌${colors.reset} ${name}: ${error.message}`);
        return null;
    }
}

/**
 * 主測試函數
 */
async function runAllTests() {
    console.log(`${colors.blue}🧪 開始全模組整合測試...${colors.reset}\n`);
    console.log(`📍 測試目標: ${BASE_URL}${API_PREFIX}`);
    console.log('─'.repeat(60));
    
    // ==========================================
    // 📅 階段二：獨立模組測試
    // ==========================================
    console.log(`\n${colors.blue}📅 階段二：獨立模組 (Holidays, Templates, System)${colors.reset}\n`);
    
    // Holidays 模組 (9個端點)
    console.log(`${colors.yellow}🎄 Holidays 模組${colors.reset}`);
    await runTest('取得所有假期', 'GET', '/holidays');
    await runTest('檢查指定日期', 'GET', '/holidays/check/2025-01-01');
    await runTest('取得月份假期', 'GET', '/holidays/month/2025/1');
    await runTest('取得同步狀態', 'GET', '/holidays/status');
    
    // Templates 模組 (5個端點)
    console.log(`\n${colors.yellow}📋 Templates 模組${colors.reset}`);
    await runTest('取得範本設定', 'GET', '/templates');
    await runTest('取得 Flex Message 範本', 'GET', '/templates/flex-templates');
    
    // System 模組 (7個端點)
    console.log(`\n${colors.yellow}⚙️ System 模組${colors.reset}`);
    await runTest('健康檢查', 'GET', '/system/health');
    await runTest('系統資訊', 'GET', '/system/info');
    await runTest('系統時間', 'GET', '/system/time');
    await runTest('系統狀態', 'GET', '/system/status');
    
    // ==========================================
    // 👥 階段三：學生管理測試
    // ==========================================
    console.log(`\n${colors.blue}👥 階段三：學生管理 (Students, Temporary Students, Attendance)${colors.reset}\n`);
    
    // Students 模組 (10個端點)
    console.log(`${colors.yellow}👥 Students 模組${colors.reset}`);
    await runTest('取得所有學生', 'GET', '/students');
    await runTest('搜尋學生', 'GET', '/students/search?keyword=王');
    await runTest('學生統計', 'GET', '/students/stats');
    
    // Temporary Students 模組 (8個端點)
    console.log(`\n${colors.yellow}📝 Temporary Students 模組${colors.reset}`);
    await runTest('取得臨時學生', 'GET', '/temporary-students');
    await runTest('臨時學生統計', 'GET', '/temporary-students/stats');
    
    // Attendance 模組 (8個端點)
    console.log(`\n${colors.yellow}✅ Attendance 模組${colors.reset}`);
    await runTest('取得簽到統計', 'GET', '/attendance/stats');
    await runTest('取得簽到報表', 'GET', '/attendance/report');
    
    // ==========================================
    // 📢 階段四：通知系統測試
    // ==========================================
    console.log(`\n${colors.blue}📢 階段四：通知系統 (Reminders, Notifications, Student Reminders, Webhook)${colors.reset}\n`);
    
    // Reminders 模組 (11個端點)
    console.log(`${colors.yellow}📢 Reminders 模組${colors.reset}`);
    await runTest('取得提醒狀態', 'GET', '/reminders/status');
    await runTest('取得提醒統計', 'GET', '/reminders/stats');
    await runTest('取得提醒設定', 'GET', '/reminders/settings');
    
    // Notifications 模組 (8個端點)
    console.log(`\n${colors.yellow}🔔 Notifications 模組${colors.reset}`);
    await runTest('取得通知狀態', 'GET', '/notifications/status');
    await runTest('取得通知統計', 'GET', '/notifications/stats');
    await runTest('取得通知設定', 'GET', '/notifications/settings');
    
    // Student Reminders 模組 (7個端點)
    console.log(`\n${colors.yellow}👤 Student Reminders 模組${colors.reset}`);
    await runTest('取得提醒偏好', 'GET', '/student-reminders/preferences');
    await runTest('取得提醒統計', 'GET', '/student-reminders/stats');
    
    // Webhook 模組 (4個端點)
    console.log(`\n${colors.yellow}🌐 Webhook 模組${colors.reset}`);
    await runTest('驗證 Webhook', 'GET', '/webhook/verify');
    
    // ==========================================
    // 📅 階段六：Events 模組測試
    // ==========================================
    console.log(`\n${colors.blue}📅 階段六：日曆核心 (Events)${colors.reset}\n`);
    
    // Events 模組 (8個端點)
    console.log(`${colors.yellow}📅 Events 模組${colors.reset}`);
    await runTest('取得所有事件', 'GET', '/events');
    await runTest('取得快取狀態', 'GET', '/events/cache/status');
    
    // ==========================================
    // 📊 測試結果統計
    // ==========================================
    console.log('\n' + '─'.repeat(60));
    console.log(`\n${colors.blue}📊 測試結果統計${colors.reset}\n`);
    
    const total = results.passed + results.failed + results.skipped;
    const passRate = total > 0 ? ((results.passed / total) * 100).toFixed(1) : 0;
    
    console.log(`總測試數: ${total}`);
    console.log(`${colors.green}✅ 通過: ${results.passed}${colors.reset}`);
    console.log(`${colors.red}❌ 失敗: ${results.failed}${colors.reset}`);
    console.log(`${colors.yellow}⏸️ 跳過: ${results.skipped}${colors.reset}`);
    console.log(`\n通過率: ${passRate}%`);
    
    // 顯示失敗的測試
    if (results.failed > 0) {
        console.log(`\n${colors.red}❌ 失敗的測試:${colors.reset}`);
        results.details
            .filter(d => d.status === 'FAIL' || d.status === 'ERROR')
            .forEach(d => {
                console.log(`  - ${d.name} (${d.endpoint})`);
                if (d.error) console.log(`    錯誤: ${d.error}`);
            });
    }
    
    // 詳細結果
    console.log(`\n${colors.blue}📋 詳細結果:${colors.reset}`);
    results.details.forEach(d => {
        const icon = d.status === 'PASS' ? '✅' : (d.status === 'FAIL' ? '❌' : '⚠️');
        const color = d.status === 'PASS' ? colors.green : (d.status === 'FAIL' ? colors.red : colors.yellow);
        console.log(`  ${color}${icon}${colors.reset} ${d.name} - ${d.code || 'N/A'}`);
    });
    
    console.log('\n' + '─'.repeat(60));
    
    // 返回退出碼
    process.exit(results.failed > 0 ? 1 : 0);
}

// 執行測試
if (require.main === module) {
    runAllTests().catch(error => {
        console.error(`${colors.red}❌ 測試執行失敗:${colors.reset}`, error.message);
        process.exit(1);
    });
}

module.exports = { runAllTests };
