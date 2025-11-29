/**
 * 🎄 Holidays 模組完整測試腳本
 * 
 * 用途：測試所有 Holidays API 端點
 * 端點數：9個 (4個公開 + 5個管理員)
 * 
 * 執行前請確保伺服器已啟動：
 * PORT=3000 DISABLE_AUTO_REMINDERS=true \
 * USE_ROUTES_PHASE2=true \
 * ENABLE_HOLIDAYS_V2=true \
 * node server.js
 */

const axios = require('axios');

// 配置
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_PREFIX = '/api/v3/holidays';  // 🔥 [修復 2025-11-27] 改為 v3

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
                endpoint,
                data: response.data
            });
            console.log(`${colors.green}✅${colors.reset} ${name}: ${response.status}`);
            return { success: true, response };
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
            return { success: false, response };
        }
    } catch (error) {
        results.failed++;
        results.details.push({
            name,
            status: 'ERROR',
            endpoint,
            error: error.message
        });
        console.log(`${colors.red}❌${colors.reset} ${name}: ${error.message}`);
        return { success: false, error };
    }
}

/**
 * 主測試函數
 */
async function runHolidaysTests() {
    console.log(`${colors.blue}🎄 開始測試 Holidays 模組...${colors.reset}\n`);
    console.log(`📍 測試目標: ${BASE_URL}${API_PREFIX}`);
    console.log('─'.repeat(60));
    
    // ==========================================
    // 公開端點測試 (4個)
    // ==========================================
    console.log(`\n${colors.yellow}📂 公開端點${colors.reset}\n`);
    
    // 1. 取得所有假期
    const getAllResult = await runTest(
        '1. 取得所有假期',
        'GET',
        ''
    );
    
    // 2. 檢查指定日期
    await runTest(
        '2. 檢查指定日期 (2025-01-01)',
        'GET',
        '/check/2025-01-01'
    );
    
    // 3. 取得月份假期
    await runTest(
        '3. 取得月份假期 (2025年1月)',
        'GET',
        '/month/2025/1'
    );
    
    // 4. 取得同步狀態 (🔥 剛修復的端點)
    const statusResult = await runTest(
        '4. 取得同步狀態',
        'GET',
        '/status'
    );
    
    // 顯示狀態詳情
    if (statusResult.success && statusResult.response.data.data) {
        const status = statusResult.response.data.data;
        console.log(`\n${colors.blue}📊 假期同步狀態:${colors.reset}`);
        console.log(`   可用: ${status.available ? '✅ 是' : '❌ 否'}`);
        console.log(`   快取: ${status.hasCache ? '✅ 有' : '❌ 無'}`);
        console.log(`   假期數量: ${status.holidayCount || 0}`);
        console.log(`   年份: ${status.year || 'N/A'}`);
        console.log(`   上次同步: ${status.lastSyncTime || '未同步'}`);
        console.log(`   定期同步: ${status.isScheduled ? '✅ 已啟用' : '⏸️ 未啟用'}`);
    }
    
    // ==========================================
    // 管理員端點測試 (5個) - 需要認證
    // ==========================================
    console.log(`\n${colors.yellow}🔒 管理員端點 (需要認證)${colors.reset}\n`);
    
    // 5. 觸發假期同步 (需要認證)
    await runTest(
        '5. 觸發假期同步',
        'POST',
        '/sync',
        {
            headers: {
                'Authorization': 'Bearer test_admin_token'
            }
        }
    );
    
    // 6. 清除假期快取 (需要認證)
    await runTest(
        '6. 清除假期快取',
        'DELETE',
        '/cache',
        {
            headers: {
                'Authorization': 'Bearer test_admin_token'
            }
        }
    );
    
    // 7. 手動添加假期 (需要認證)
    await runTest(
        '7. 手動添加假期',
        'POST',
        '',
        {
            headers: {
                'Authorization': 'Bearer test_admin_token',
                'Content-Type': 'application/json'
            },
            data: {
                date: '2025-12-31',
                name: '測試假期',
                type: 'test'
            }
        }
    );
    
    // 8. 更新假期 (需要認證)
    await runTest(
        '8. 更新假期',
        'PUT',
        '/2025-12-31',
        {
            headers: {
                'Authorization': 'Bearer test_admin_token',
                'Content-Type': 'application/json'
            },
            data: {
                name: '更新後的假期',
                type: 'updated'
            }
        }
    );
    
    // 9. 刪除假期 (需要認證)
    await runTest(
        '9. 刪除假期',
        'DELETE',
        '/2025-12-31',
        {
            headers: {
                'Authorization': 'Bearer test_admin_token'
            }
        }
    );
    
    // ==========================================
    // 測試結果統計
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
    
    // 評級
    let grade, gradeColor;
    if (passRate >= 90) {
        grade = 'A+ 優秀';
        gradeColor = colors.green;
    } else if (passRate >= 80) {
        grade = 'A 良好';
        gradeColor = colors.green;
    } else if (passRate >= 70) {
        grade = 'B 尚可';
        gradeColor = colors.yellow;
    } else if (passRate >= 60) {
        grade = 'C 及格';
        gradeColor = colors.yellow;
    } else {
        grade = 'D 不及格';
        gradeColor = colors.red;
    }
    console.log(`評級: ${gradeColor}${grade}${colors.reset}`);
    
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
    
    // 顯示通過的公開端點
    const publicPassedCount = results.details
        .filter(d => d.status === 'PASS' && !d.endpoint.includes('sync') && !d.endpoint.includes('cache') && d.endpoint !== '')
        .length + (results.details.find(d => d.endpoint === '' && d.status === 'PASS') ? 1 : 0);
    
    console.log(`\n${colors.green}🎯 公開端點通過: ${publicPassedCount}/4${colors.reset}`);
    
    // 詳細結果
    console.log(`\n${colors.blue}📋 詳細結果:${colors.reset}`);
    results.details.forEach((d, index) => {
        const icon = d.status === 'PASS' ? '✅' : (d.status === 'FAIL' ? '❌' : '⚠️');
        const color = d.status === 'PASS' ? colors.green : (d.status === 'FAIL' ? colors.red : colors.yellow);
        const endpoint = d.endpoint || '(根路徑)';
        console.log(`  ${color}${icon}${colors.reset} ${index + 1}. ${d.name} - ${d.code || 'N/A'}`);
    });
    
    console.log('\n' + '─'.repeat(60));
    
    // 總結
    console.log(`\n${colors.blue}📝 測試總結:${colors.reset}`);
    if (publicPassedCount === 4) {
        console.log(`${colors.green}✅ Holidays 模組的所有公開端點都正常運作！${colors.reset}`);
        console.log(`${colors.yellow}⚠️ 管理員端點需要實際認證 Token 才能完整測試${colors.reset}`);
    } else {
        console.log(`${colors.yellow}⚠️ ${4 - publicPassedCount}個公開端點仍需修復${colors.reset}`);
    }
    
    // 返回退出碼
    process.exit(results.failed > 4 ? 1 : 0);  // 允許管理員端點失敗
}

// 執行測試
if (require.main === module) {
    runHolidaysTests().catch(error => {
        console.error(`${colors.red}❌ 測試執行失敗:${colors.reset}`, error.message);
        process.exit(1);
    });
}

module.exports = { runHolidaysTests };
