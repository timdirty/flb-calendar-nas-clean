/**
 * 🧪 Events 模組快速測試
 * 
 * 快速驗證 Events 端點可訪問性
 */

const http = require('http');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v3/events';  // 🔥 [修復 2025-11-27] 改為 v3

// 測試結果統計
let passed = 0;
let failed = 0;
const results = [];

/**
 * 發送 HTTP 請求
 */
function makeRequest(method, path) {
    return new Promise((resolve, reject) => {
        const options = {
            method,
            hostname: 'localhost',
            port: 3000,
            path: `${API_PREFIX}${path}`,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: JSON.parse(data)
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data
                    });
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * 測試單個端點
 */
async function testEndpoint(name, method, path, expectedStatus = 200) {
    try {
        const response = await makeRequest(method, path);
        const success = response.status === expectedStatus || 
                       response.status === 200 || 
                       (response.data && response.data.success);
        
        if (success) {
            passed++;
            results.push({ name, status: '✅', response: response.status });
            console.log(`✅ ${name}: ${response.status}`);
        } else {
            failed++;
            results.push({ name, status: '❌', response: response.status });
            console.log(`❌ ${name}: ${response.status}`);
        }
    } catch (error) {
        failed++;
        results.push({ name, status: '❌', error: error.message });
        console.log(`❌ ${name}: ${error.message}`);
    }
}

/**
 * 執行測試
 */
async function runTests() {
    console.log('🧪 開始測試 Events 模組...\n');
    console.log('📍 測試目標:', BASE_URL + API_PREFIX);
    console.log('─'.repeat(50));

    // 公開端點
    await testEndpoint('取得所有事件', 'GET', '/events');
    await testEndpoint('取得快取狀態', 'GET', '/events/cache/status');

    console.log('\n' + '─'.repeat(50));
    console.log(`\n📊 測試結果: ${passed} 通過, ${failed} 失敗`);
    console.log(`通過率: ${((passed / (passed + failed)) * 100).toFixed(1)}%\n`);

    // 顯示詳細結果
    console.log('詳細結果:');
    results.forEach(r => {
        console.log(`  ${r.status} ${r.name} - ${r.response || r.error}`);
    });

    process.exit(failed > 0 ? 1 : 0);
}

// 執行測試
runTests().catch(error => {
    console.error('測試執行失敗:', error);
    process.exit(1);
});
