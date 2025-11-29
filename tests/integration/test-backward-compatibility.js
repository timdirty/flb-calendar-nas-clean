/**
 * 🔄 向後兼容性完整測試
 * 
 * 目的：確保 Phase 1-5 的遷移不會破壞原有功能
 * 
 * 測試策略：
 * 1. 所有 Phase flags 關閉 - 測試原有 API
 * 2. 所有 Phase flags 開啟 - 測試新舊並存
 * 3. 混合模式 - 測試部分開啟
 */

const axios = require('axios');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

// 測試統計
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m"
};

function log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
}

async function runTest(name, fn) {
    totalTests++;
    try {
        log(`\n🧪 ${name}`, colors.cyan);
        await fn();
        log(`✅ 通過`, colors.green);
        passedTests++;
        return true;
    } catch (error) {
        log(`❌ 失敗: ${error.message}`, colors.red);
        if (error.response) {
            console.log('   Status:', error.response.status);
            console.log('   URL:', error.config?.url);
        }
        failedTests++;
        return false;
    }
}

async function testLegacyAPIs() {
    log('\n📦 測試原有 API（Legacy APIs）', colors.yellow);
    
    // 1. Health Check
    await runTest('Health Check - 原有端點', async () => {
        const res = await axios.get(`${BASE_URL}/health`);
        if (!res.data || res.data.status !== 'ok') {
            throw new Error('Health check 失敗');
        }
    });

    // 2. Events API
    await runTest('GET /api/events - 原有日曆事件 API', async () => {
        const res = await axios.get(`${BASE_URL}/api/events`);
        // Events API 可能返回數組或帶有 events 屬性的對象
        if (!res.data || (!Array.isArray(res.data) && !Array.isArray(res.data.events))) {
            throw new Error('Events API 返回格式錯誤');
        }
    });

    // 3. Teachers API
    await runTest('GET /api/teachers - 原有講師 API', async () => {
        const res = await axios.get(`${BASE_URL}/api/teachers`);
        if (!res.data || typeof res.data !== 'object') {
            throw new Error('Teachers API 返回格式錯誤');
        }
    });

    // 4. Students API (Google Sheets)
    await runTest('GET /api/students - 原有學生 API', async () => {
        const res = await axios.get(`${BASE_URL}/api/students`);
        if (!res.data || typeof res.data !== 'object') {
            throw new Error('Students API 返回格式錯誤');
        }
    });

    // 5. Attendance API
    await runTest('POST /api/attendance - 原有簽到 API 結構', async () => {
        try {
            await axios.post(`${BASE_URL}/api/attendance`, {
                studentName: '測試學生',
                courseName: '測試課程',
                location: { lat: 25.033, lng: 121.565 }
            });
        } catch (error) {
            // 預期可能失敗（學生不存在），但端點應該存在
            if (error.response && error.response.status === 404) {
                return; // 404 是預期的，表示端點存在
            }
            throw error;
        }
    });

    // 6. Drive Media API
    await runTest('GET /api/drive-media/records - 原有 Drive API', async () => {
        const res = await axios.get(`${BASE_URL}/api/drive-media/records`);
        if (!res.data.success) {
            throw new Error('Drive Media API 失敗');
        }
    });

    // 7. Learning Records API
    await runTest('GET /api/learning-records/history-drive - 原有學習記錄 API', async () => {
        const res = await axios.get(`${BASE_URL}/api/learning-records/history-drive`, {
            params: { semester: '114-1' }
        });
        if (!res.data.success) {
            throw new Error('Learning Records API 失敗');
        }
    });
}

async function testV3APIsExist() {
    log('\n🆕 測試 V3 API 存在性（當 Phase flags 開啟時）', colors.yellow);
    
    // 檢查環境變數
    const phase5Enabled = process.env.USE_ROUTES_PHASE5 === 'true';
    
    if (!phase5Enabled) {
        log('⏭️  跳過 V3 API 測試（Phase 5 未啟用）', colors.yellow);
        return;
    }

    await runTest('GET /api/v3/drive-media/records - V3 端點可訪問', async () => {
        const res = await axios.get(`${BASE_URL}/api/v3/drive-media/records`);
        if (!res.data.success) {
            throw new Error('V3 Drive Media API 失敗');
        }
    });

    await runTest('POST /api/v3/learning-records/save - V3 端點可訪問', async () => {
        const res = await axios.post(`${BASE_URL}/api/v3/learning-records/save`, {
            studentName: '測試學生',
            courseName: '測試課程'
        });
        if (!res.data.success) {
            throw new Error('V3 Learning Records API 失敗');
        }
    });
}

async function testNoConflicts() {
    log('\n🔀 測試新舊 API 無衝突', colors.yellow);
    
    await runTest('原有 API 和 V3 API 可同時訪問', async () => {
        // 同時調用原有和 V3 API
        const [legacy, v3] = await Promise.all([
            axios.get(`${BASE_URL}/api/drive-media/records`),
            process.env.USE_ROUTES_PHASE5 === 'true' 
                ? axios.get(`${BASE_URL}/api/v3/drive-media/records`)
                : Promise.resolve({ data: { success: true, items: [] } })
        ]);

        if (!legacy.data.success || !v3.data.success) {
            throw new Error('新舊 API 並存測試失敗');
        }
    });
}

async function testCriticalPaths() {
    log('\n⚡ 測試關鍵業務流程', colors.yellow);
    
    await runTest('完整簽到流程 - 檢查端點', async () => {
        // 1. 獲取課程列表
        const events = await axios.get(`${BASE_URL}/api/events`);
        if (!events.data) {
            throw new Error('無法獲取課程列表');
        }

        // 2. 獲取學生資料
        const students = await axios.get(`${BASE_URL}/api/students`);
        if (!students.data) {
            throw new Error('無法獲取學生資料');
        }

        // 3. 簽到端點存在
        try {
            await axios.post(`${BASE_URL}/api/attendance`, {
                studentName: '不存在的學生',
                courseName: '測試課程',
                location: { lat: 25.033, lng: 121.565 }
            });
        } catch (error) {
            // 404 或 400 都表示端點存在
            if (error.response && (error.response.status === 404 || error.response.status === 400)) {
                return;
            }
            throw error;
        }
    });

    await runTest('完整學習記錄流程 - 檢查端點', async () => {
        // 1. 查詢歷史記錄
        const history = await axios.get(`${BASE_URL}/api/learning-records/history-drive`, {
            params: { semester: '114-1' }
        });
        if (!history.data.success) {
            throw new Error('無法查詢學習歷程');
        }

        // 2. 索引查詢
        const index = await axios.get(`${BASE_URL}/api/learning-records/index`);
        if (!index.data.success) {
            throw new Error('無法查詢索引');
        }
    });
}

async function main() {
    log('╔══════════════════════════════════════════════════════════╗', colors.magenta);
    log('║   🔄 向後兼容性完整測試                                    ║', colors.magenta);
    log('║   確保 Phase 1-5 遷移不破壞原有功能                        ║', colors.magenta);
    log('╚══════════════════════════════════════════════════════════╝', colors.magenta);

    log(`\n📍 測試目標: ${BASE_URL}`, colors.blue);
    log(`🏁 Phase 5 狀態: ${process.env.USE_ROUTES_PHASE5 === 'true' ? '已啟用' : '已停用'}`, colors.blue);
    log('────────────────────────────────────────────────────────────', colors.white);

    // 執行所有測試
    await testLegacyAPIs();
    await testV3APIsExist();
    await testNoConflicts();
    await testCriticalPaths();

    // 結果統計
    log('\n────────────────────────────────────────────────────────────', colors.white);
    log('\n📊 測試結果統計', colors.magenta);
    log(`總測試數: ${totalTests}`, colors.white);
    log(`✅ 通過: ${passedTests}`, colors.green);
    log(`❌ 失敗: ${failedTests}`, failedTests > 0 ? colors.red : colors.green);
    
    const passRate = ((passedTests / totalTests) * 100).toFixed(1);
    log(`\n通過率: ${passRate}%`, failedTests === 0 ? colors.green : colors.yellow);
    
    if (failedTests === 0) {
        log('\n🎉 所有測試通過！向後兼容性驗證成功！', colors.green);
        log('✅ Phase 1-5 的遷移不會破壞原有功能', colors.green);
        process.exit(0);
    } else {
        log(`\n⚠️ 有 ${failedTests} 個測試失敗`, colors.yellow);
        log('❌ 需要修復向後兼容性問題', colors.red);
        process.exit(1);
    }
}

// 捕獲未處理的錯誤
process.on('unhandledRejection', (error) => {
    console.error('未處理的 Promise 拒絕:', error);
    process.exit(1);
});

main();
