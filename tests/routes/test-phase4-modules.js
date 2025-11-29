const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 配置
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}/api/v3`;
const ADMIN_LOGIN_URL = `http://localhost:${PORT}/api/admin/login`;
const WEBHOOK_URL = `http://localhost:${PORT}/api/v3/webhook`;

// 測試狀態
let serverProcess = null;
let authToken = null;
let testsPassed = 0;
let testsFailed = 0;

// 顏色輸出
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m"
};

function log(message, color = colors.white) {
    console.log(`${color}${message}${colors.reset}`);
}

async function runTest(name, fn) {
    try {
        log(`\n🧪 測試: ${name}`, colors.cyan);
        await fn();
        log(`✅ 通過`, colors.green);
        testsPassed++;
        return true;
    } catch (error) {
        log(`❌ 失敗: ${error.message}`, colors.red);
        if (error.response) {
            console.log('   Status:', error.response.status);
            console.log('   Data:', JSON.stringify(error.response.data, null, 2));
        }
        testsFailed++;
        return false;
    }
}

async function login() {
    try {
        log(`\n🔑 嘗試管理員登入...`, colors.yellow);
        const response = await axios.post(ADMIN_LOGIN_URL, {
            password: process.env.ADMIN_PASSWORD || 'admin123'
        });
        
        if (response.data.success) {
            authToken = response.data.token;
            log(`✅ 登入成功 (Token: ${authToken.substring(0, 10)}...)`, colors.green);
        } else {
            throw new Error('登入失敗: ' + response.data.message);
        }
    } catch (error) {
        throw new Error('登入請求失敗: ' + error.message);
    }
}

// 獲取帶認證的 headers
function getAuthHeaders() {
    return {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    };
}

async function main() {
    log(`🎄 開始測試 Phase 4 模組 (通知系統)...`, colors.magenta);
    
    // 1. 登入獲取 Token
    try {
        await login();
    } catch (error) {
        log(`❌ 嚴重錯誤: 無法登入，終止測試`, colors.red);
        console.error(error);
        process.exit(1);
    }

    log(`\n📍 測試目標: ${BASE_URL}`, colors.blue);
    log(`────────────────────────────────────────────────────────────`, colors.white);

    // ==================== Reminders 模組 ====================
    log(`\n📢 Reminders 模組`, colors.yellow);
    
    await runTest('1. 取得提醒設定', async () => {
        const res = await axios.get(`${BASE_URL}/reminders/settings`, getAuthHeaders());
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    await runTest('2. 取得提醒統計', async () => {
        const res = await axios.get(`${BASE_URL}/reminders/stats`, getAuthHeaders());
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    await runTest('3. 取得即將發送的提醒', async () => {
        const res = await axios.get(`${BASE_URL}/reminders/pending`, getAuthHeaders());
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    // ==================== Notifications 模組 ====================
    log(`\n🔔 Notifications 模組`, colors.yellow);

    await runTest('4. 取得 Flex Message 範本列表', async () => {
        const res = await axios.get(`${BASE_URL}/notifications/flex-templates`, getAuthHeaders());
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    await runTest('5. 取得通知歷史', async () => {
        const res = await axios.get(`${BASE_URL}/notifications/history`, getAuthHeaders());
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    await runTest('6. 取得通知統計', async () => {
        const res = await axios.get(`${BASE_URL}/notifications/stats`, getAuthHeaders());
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    // ==================== Student Reminders 模組 ====================
    log(`\n👤 Student Reminders 模組`, colors.yellow);

    await runTest('7. 取得學生提醒設定', async () => {
        const res = await axios.get(`${BASE_URL}/student-reminders/settings`, getAuthHeaders());
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    await runTest('8. 取得學生列表', async () => {
        const res = await axios.get(`${BASE_URL}/student-reminders/students`, getAuthHeaders());
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    // ==================== Webhook 模組 ====================
    log(`\n🌐 Webhook 模組`, colors.yellow);

    await runTest('9. 取得 Webhook 統計', async () => {
        const res = await axios.get(`${BASE_URL}/webhook/stats`, getAuthHeaders());
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    await runTest('10. 測試 Webhook (無需 Token)', async () => {
        // Webhook 通常驗證 LINE 簽名，但在測試模式下可能放行或有特殊處理
        // 這裡我們測試管理員測試端點
        const res = await axios.post(`${BASE_URL}/webhook/test`, {}, getAuthHeaders());
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    log(`────────────────────────────────────────────────────────────`, colors.white);
    log(`\n📊 測試結果統計`, colors.magenta);
    log(`總測試數: ${testsPassed + testsFailed}`, colors.white);
    log(`✅ 通過: ${testsPassed}`, colors.green);
    log(`❌ 失敗: ${testsFailed}`, testsFailed > 0 ? colors.red : colors.green);
    
    const passRate = ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1);
    log(`\n通過率: ${passRate}%`, testsFailed === 0 ? colors.green : colors.yellow);
    
    if (testsPassed === 10) {
        log(`評級: A 優秀`, colors.green);
    } else if (testsPassed >= 8) {
        log(`評級: B 良好`, colors.blue);
    } else {
        log(`評級: C 需改進`, colors.yellow);
    }

    log(`\n────────────────────────────────────────────────────────────`, colors.white);

    if (testsFailed > 0) {
        log(`\n⚠️ 有 ${testsFailed} 個測試失敗，請檢查日誌`, colors.yellow);
        process.exit(1);
    } else {
        log(`\n🎉 所有測試通過！Phase 4 模組運作正常！`, colors.green);
        process.exit(0);
    }
}

main();
