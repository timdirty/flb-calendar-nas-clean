const axios = require('axios');

// 配置
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}/api/v3`;
const ADMIN_LOGIN_URL = `http://localhost:${PORT}/api/admin/login`;

// 測試狀態
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
    cyan: "\x1b[36m"
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

function getAuthHeaders() {
    return {
        headers: {
            'Authorization': `Bearer ${authToken}`
        }
    };
}

async function main() {
    log(`🎄 開始測試 Phase 5 模組 (媒體系統)...`, colors.magenta);
    
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

    // ==================== Drive Upload 模組 ====================
    log(`\n☁️ Drive Upload 模組`, colors.yellow);
    
    await runTest('1. 初始化檔案上傳', async () => {
        const res = await axios.post(`${BASE_URL}/drive-upload/init`, {
            filename: 'test.jpg',
            fileSize: 1024000,
            fileType: 'image/jpeg'
        });
        if (!res.data.success) throw new Error('回應 success 不為 true');
        if (!res.data.uploadId) throw new Error('未返回 uploadId');
    });

    // ==================== Drive Media 模組 ====================
    log(`\n💾 Drive Media 模組`, colors.yellow);

    await runTest('2. 取得 Drive 媒體記錄列表', async () => {
        const res = await axios.get(`${BASE_URL}/drive-media/records`);
        if (!res.data.success) throw new Error('回應 success 不為 true');
        if (!Array.isArray(res.data.items)) throw new Error('items 不是陣列');
    });

    await runTest('3. 取得 Drive 檔案代理 URL', async () => {
        const res = await axios.post(`${BASE_URL}/drive-media/url`, {
            path: '/test/path/file.jpg'
        });
        if (!res.data.success) throw new Error('回應 success 不為 true');
        if (!res.data.data || !res.data.data.proxyUrl) throw new Error('未返回 proxyUrl');
    });

    // ==================== Learning Records 模組 ====================
    log(`\n📚 Learning Records 模組`, colors.yellow);

    await runTest('4. 儲存學習記錄', async () => {
        const res = await axios.post(`${BASE_URL}/learning-records/save`, {
            studentName: '測試學生',
            courseName: '測試課程',
            date: '2025-01-01',
            notes: '測試筆記'
        });
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    await runTest('5. 查詢學習歷程記錄', async () => {
        const res = await axios.get(`${BASE_URL}/learning-records/history-drive`, {
            params: {
                semester: '114-1',
                courseName: '測試課程'
            }
        });
        if (!res.data.success) throw new Error('回應 success 不為 true');
        if (!Array.isArray(res.data.records)) throw new Error('records 不是陣列');
    });

    await runTest('6. 取得今天已結束的課程列表', async () => {
        const res = await axios.get(`${BASE_URL}/learning-records/today-completed-courses`);
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    await runTest('7. 讀取完整學習歷程索引', async () => {
        const res = await axios.get(`${BASE_URL}/learning-records/index`);
        if (!res.data.success) throw new Error('回應 success 不為 true');
    });

    // ==================== Legacy Media Upload 模組 ====================
    log(`\n🚫 Legacy Media Upload 模組 (應返回 410)`, colors.yellow);

    await runTest('8. Legacy init (應返回 410)', async () => {
        try {
            await axios.post(`${BASE_URL}/media/videos/init`, {});
            throw new Error('應該返回 410 錯誤');
        } catch (error) {
            if (error.response && error.response.status === 410) {
                // 正確返回 410
                return;
            }
            throw error;
        }
    });

    await runTest('9. Legacy videos 列表 (應返回 410)', async () => {
        try {
            await axios.get(`${BASE_URL}/media/videos`);
            throw new Error('應該返回 410 錯誤');
        } catch (error) {
            if (error.response && error.response.status === 410) {
                // 正確返回 410
                return;
            }
            throw error;
        }
    });

    log(`────────────────────────────────────────────────────────────`, colors.white);
    log(`\n📊 測試結果統計`, colors.magenta);
    log(`總測試數: ${testsPassed + testsFailed}`, colors.white);
    log(`✅ 通過: ${testsPassed}`, colors.green);
    log(`❌ 失敗: ${testsFailed}`, testsFailed > 0 ? colors.red : colors.green);
    
    const passRate = ((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1);
    log(`\n通過率: ${passRate}%`, testsFailed === 0 ? colors.green : colors.yellow);
    
    if (testsPassed === 9) {
        log(`評級: A 優秀`, colors.green);
    } else if (testsPassed >= 7) {
        log(`評級: B 良好`, colors.blue);
    } else {
        log(`評級: C 需改進`, colors.yellow);
    }

    log(`\n────────────────────────────────────────────────────────────`, colors.white);

    if (testsFailed > 0) {
        log(`\n⚠️ 有 ${testsFailed} 個測試失敗，請檢查日誌`, colors.yellow);
        process.exit(1);
    } else {
        log(`\n🎉 所有測試通過！Phase 5 模組運作正常！`, colors.green);
        process.exit(0);
    }
}

main();
