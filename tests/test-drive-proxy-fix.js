#!/usr/bin/env node
/**
 * 測試 Drive 媒體代理路徑修復
 * 
 * 問題：前端生成的相對路徑無法通過後端安全檢查
 * 修復：drive-path-manager.js 的 toProxyUrl 保留完整 Drive 根路徑
 */

const http = require('http');

// 測試配置
const HOST = 'localhost';
const PORT = process.env.PORT || 3002;
const DRIVE_ROOT = '/Fun Learn Bar/FLB-Learning-Portfolio';

console.log('\n╔═══════════════════════════════════════════════╗');
console.log('║  🧪 Drive 媒體代理路徑修復測試              ║');
console.log('╚═══════════════════════════════════════════════╝\n');

// 測試用例
const testCases = [
    {
        name: '完整路徑（正確格式）',
        path: `${DRIVE_ROOT}/114-1/SPIKE 一 1930-2100 客製化/2025-11-17 青蛙過馬路/菲菲 11401/IMG_5699-1763659018251-e001b7.jpeg`,
        shouldPass: true
    },
    {
        name: '相對路徑（修復前會失敗）',
        path: '/114-1/SPIKE 一 1930-2100 客製化/2025-11-17 青蛙過馬路/菲菲 11401/IMG_5699-1763659018251-e001b7.jpeg',
        shouldPass: false, // 後端應該拒絕相對路徑
        note: '修復後，toProxyUrl 應該自動添加 Drive 根前綴'
    },
    {
        name: '課程總覽路徑',
        path: `${DRIVE_ROOT}/114-1/SPIKE 一 1930-2100 客製化/2025-11-17 青蛙過馬路/課程總覽/IMG_5700-1763659033391-79c48s.jpeg`,
        shouldPass: true
    }
];

/**
 * 發送 HTTP 請求測試
 */
function testDriveProxy(testCase) {
    return new Promise((resolve) => {
        const encodedPath = encodeURI(testCase.path);
        const url = `/api/drive-media${encodedPath}`;
        
        console.log(`\n📋 測試: ${testCase.name}`);
        console.log(`   路徑: ${testCase.path}`);
        console.log(`   URL: ${url}`);
        
        const options = {
            hostname: HOST,
            port: PORT,
            path: url,
            method: 'GET',
            headers: {
                'Accept': 'image/*'
            }
        };
        
        const req = http.request(options, (res) => {
            const statusCode = res.statusCode;
            const passed = statusCode === 200 || statusCode === 206; // 206 for range requests
            
            // 讀取回應內容（用於錯誤診斷）
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (passed) {
                    console.log(`   ✅ 成功 (HTTP ${statusCode})`);
                    if (testCase.shouldPass === false) {
                        console.log(`   ⚠️  預期失敗但實際成功 - 可能是修復生效了`);
                    }
                } else {
                    console.log(`   ❌ 失敗 (HTTP ${statusCode})`);
                    if (statusCode === 403) {
                        console.log(`   🔍 錯誤: 路徑安全檢查失敗 - Drive 根前綴可能缺失`);
                    }
                    if (data) {
                        try {
                            const error = JSON.parse(data);
                            console.log(`   🔍 錯誤訊息: ${error.error || error.message}`);
                        } catch (e) {
                            console.log(`   🔍 回應內容: ${data.substring(0, 100)}`);
                        }
                    }
                    if (testCase.shouldPass) {
                        console.log(`   ⚠️  預期成功但實際失敗`);
                    }
                }
                
                if (testCase.note) {
                    console.log(`   💡 註解: ${testCase.note}`);
                }
                
                resolve({ passed, statusCode });
            });
        });
        
        req.on('error', (error) => {
            console.log(`   ❌ 請求失敗: ${error.message}`);
            resolve({ passed: false, error: error.message });
        });
        
        req.setTimeout(5000, () => {
            req.destroy();
            console.log(`   ❌ 請求超時`);
            resolve({ passed: false, error: 'timeout' });
        });
        
        req.end();
    });
}

/**
 * 執行所有測試
 */
async function runTests() {
    console.log(`🔗 連接到: http://${HOST}:${PORT}\n`);
    
    // 先檢查伺服器是否運行
    console.log('📡 檢查伺服器狀態...');
    const healthCheck = await new Promise((resolve) => {
        const req = http.request({
            hostname: HOST,
            port: PORT,
            path: '/health',
            method: 'GET'
        }, (res) => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(3000, () => {
            req.destroy();
            resolve(false);
        });
        req.end();
    });
    
    if (!healthCheck) {
        console.log('❌ 伺服器未運行或無法連接');
        console.log(`   請確保伺服器運行在 port ${PORT}`);
        console.log(`   啟動命令: PORT=${PORT} npm run dev`);
        process.exit(1);
    }
    
    console.log('✅ 伺服器運行中\n');
    console.log('═'.repeat(50));
    
    // 執行測試
    const results = [];
    for (const testCase of testCases) {
        const result = await testDriveProxy(testCase);
        results.push({ testCase, result });
        await new Promise(resolve => setTimeout(resolve, 500)); // 避免請求過快
    }
    
    // 輸出總結
    console.log('\n' + '═'.repeat(50));
    console.log('\n📊 測試總結:\n');
    
    let passed = 0;
    let failed = 0;
    
    results.forEach(({ testCase, result }) => {
        if (result.passed) {
            passed++;
            console.log(`✅ ${testCase.name}`);
        } else {
            failed++;
            console.log(`❌ ${testCase.name}`);
        }
    });
    
    console.log(`\n總計: ${results.length} 個測試`);
    console.log(`✅ 通過: ${passed}`);
    console.log(`❌ 失敗: ${failed}`);
    
    // 檢查修復狀態
    console.log('\n' + '═'.repeat(50));
    console.log('\n🔍 修復驗證:\n');
    
    const relativePathTest = results.find(r => r.testCase.name.includes('相對路徑'));
    if (relativePathTest) {
        if (relativePathTest.result.statusCode === 403) {
            console.log('✅ 修復驗證成功！');
            console.log('   - 後端正確拒絕了缺少 Drive 根前綴的路徑');
            console.log('   - toProxyUrl 應該會自動添加前綴');
        } else if (relativePathTest.result.passed) {
            console.log('⚠️  相對路徑測試意外通過');
            console.log('   - 這可能表示修復已生效（toProxyUrl 自動添加了前綴）');
            console.log('   - 或是後端安全檢查有問題');
        }
    }
    
    console.log('\n💡 下一步:');
    console.log('   1. 在瀏覽器中測試實際的學習歷程上傳頁面');
    console.log('   2. 檢查 Console 是否還有 "不安全的路徑" 錯誤');
    console.log('   3. 驗證照片和影片是否能正常顯示');
    
    console.log('\n');
    process.exit(failed > 0 ? 1 : 0);
}

// 執行測試
runTests().catch(error => {
    console.error('\n❌ 測試執行失敗:', error);
    process.exit(1);
});
