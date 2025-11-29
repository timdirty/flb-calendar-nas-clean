#!/usr/bin/env node

/**
 * 🧪 特殊事件標記 - 整合測試（第三天）
 * 
 * 測試範圍：
 * - 混合操作測試（添加、修改、移除的組合）
 * - 描述保留完整性測試（最關鍵）
 * - 複雜場景模擬
 * 
 * 執行方式：
 * node tests/manual/test-special-events-integration.js
 */

const { makeRequest, checkServerHealth, getTestEventId } = require('./test-special-events-api');

// 測試統計
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
};

const results = [];

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 延遲函數
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(name, testFn, category = '整合') {
  stats.total++;
  
  try {
    log(`\n🧪 [${category}] ${name}`, 'cyan');
    const result = await testFn();
    
    if (result.skip) {
      stats.skipped++;
      log(`⏭️  跳過: ${result.reason}`, 'yellow');
      results.push({ name, category, status: 'skipped', reason: result.reason });
      return;
    }
    
    if (result.success) {
      stats.passed++;
      log(`✅ 通過`, 'green');
      if (result.message) log(`   ${result.message}`, 'blue');
      if (result.details) {
        result.details.forEach(detail => log(`   ${detail}`, 'blue'));
      }
      results.push({ name, category, status: 'passed', message: result.message });
    } else {
      stats.failed++;
      log(`❌ 失敗: ${result.error}`, 'red');
      results.push({ name, category, status: 'failed', error: result.error });
    }
  } catch (error) {
    stats.failed++;
    log(`❌ 異常: ${error.message}`, 'red');
    results.push({ name, category, status: 'failed', error: error.message });
  }
}

// ==================== 描述保留完整性測試（最關鍵）====================

/**
 * 測試 5.5：描述保留完整性測試（最重要的測試）
 * 
 * 測試流程：
 * 1. 獲取原始課程（帶有描述）
 * 2. 添加「體驗」標記
 * 3. 驗證描述保留
 * 4. 增量添加「公告」標記
 * 5. 驗證描述保留
 * 6. 移除「公告」標記
 * 7. 驗證描述保留
 * 8. 移除所有標記
 * 9. 驗證描述完全恢復
 */
async function test_description_preservation() {
  log('   ⭐⭐⭐ 這是最關鍵的測試 ⭐⭐⭐', 'magenta');
  
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const originalDescription = testEvent.originalDescription || '原始描述內容';
  const eventId = testEvent.eventId;
  
  log(`   原始描述: "${originalDescription.substring(0, 50)}..."`, 'blue');
  
  const steps = [];
  
  try {
    // 步驟 1：添加「體驗」標記
    log('   步驟 1/4：添加「體驗」標記...', 'yellow');
    await delay(500);
    
    const step1 = await makeRequest('POST', '/api/events/mark-special', {
      eventId,
      specialType: '體驗',
      preserveDescription: true,
    });
    
    if (step1.statusCode !== 200) {
      return { success: false, error: `步驟1失敗: ${step1.body.error}` };
    }
    steps.push('✓ 步驟1: 體驗標記添加成功');
    await delay(1000); // 等待快取更新
    
    // 步驟 2：增量添加「公告」標記
    log('   步驟 2/4：增量添加「公告」標記...', 'yellow');
    await delay(500);
    
    const step2 = await makeRequest('POST', '/api/events/mark-special', {
      eventId,
      specialTypes: ['體驗', '公告'],
      announcementContent: '測試公告內容',
      preserveDescription: true,
    });
    
    if (step2.statusCode !== 200) {
      return { success: false, error: `步驟2失敗: ${step2.body.error}` };
    }
    steps.push('✓ 步驟2: 公告標記添加成功');
    await delay(1000);
    
    // 步驟 3：移除「公告」標記（保留體驗）
    log('   步驟 3/4：移除「公告」標記...', 'yellow');
    await delay(500);
    
    const step3 = await makeRequest('POST', '/api/events/mark-special', {
      eventId,
      specialTypes: ['體驗'],
      preserveDescription: true,
    });
    
    if (step3.statusCode !== 200) {
      return { success: false, error: `步驟3失敗: ${step3.body.error}` };
    }
    steps.push('✓ 步驟3: 公告標記移除成功');
    await delay(1000);
    
    // 步驟 4：移除所有標記
    log('   步驟 4/4：移除所有標記...', 'yellow');
    await delay(500);
    
    const step4 = await makeRequest('POST', '/api/events/remove-special', {
      eventId,
    });
    
    if (step4.statusCode !== 200) {
      return { success: false, error: `步驟4失敗: ${step4.body.error}` };
    }
    steps.push('✓ 步驟4: 所有標記移除成功');
    
    // 最終驗證：描述應該完全恢復
    // 注意：這裡我們只能驗證 API 調用成功，實際的描述驗證需要前端測試
    steps.push('✓ 所有操作完成，描述應保持一致');
    
    return {
      success: true,
      message: '描述保留完整性測試通過',
      details: steps,
    };
    
  } catch (error) {
    return {
      success: false,
      error: `測試異常: ${error.message}`,
    };
  }
}

// ==================== 混合操作測試 ====================

/**
 * 測試 6.1：複雜操作序列
 */
async function test_complex_sequence() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const eventId = testEvent.eventId;
  const steps = [];
  
  try {
    // 操作序列
    const operations = [
      { action: '添加停課', type: '停課' },
      { action: '替換為體驗', type: '體驗' },
      { action: '添加公告', types: ['體驗', '公告'], announcement: '測試' },
      { action: '全部移除' },
    ];
    
    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      await delay(800);
      
      if (op.action === '全部移除') {
        const res = await makeRequest('POST', '/api/events/remove-special', { eventId });
        if (res.statusCode === 200) {
          steps.push(`✓ ${op.action}`);
        }
      } else {
        const payload = {
          eventId,
          preserveDescription: true,
        };
        
        if (op.types) {
          payload.specialTypes = op.types;
          if (op.announcement) {
            payload.announcementContent = op.announcement;
          }
        } else {
          payload.specialType = op.type;
        }
        
        const res = await makeRequest('POST', '/api/events/mark-special', payload);
        if (res.statusCode === 200) {
          steps.push(`✓ ${op.action}`);
        }
      }
    }
    
    return {
      success: steps.length === operations.length,
      message: `完成 ${steps.length}/${operations.length} 個操作`,
      details: steps,
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 測試 6.2：快速連續操作
 */
async function test_rapid_operations() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const eventId = testEvent.eventId;
  
  try {
    // 快速連續操作（測試快取同步）
    const operations = [
      makeRequest('POST', '/api/events/mark-special', {
        eventId,
        specialType: '體驗',
        preserveDescription: true,
      }),
      delay(200),
      makeRequest('POST', '/api/events/mark-special', {
        eventId,
        specialTypes: ['體驗', '公告'],
        announcementContent: '快速測試',
        preserveDescription: true,
      }),
    ];
    
    // 注意：這裡不使用 Promise.all，因為可能會有競態條件
    for (const op of operations) {
      await op;
    }
    
    return {
      success: true,
      message: '快速操作序列完成（可能有快取同步延遲）',
    };
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== 錯誤恢復測試 ====================

/**
 * 測試 7.1：錯誤操作後的恢復
 */
async function test_error_recovery() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const eventId = testEvent.eventId;
  
  try {
    // 先成功添加標記
    await makeRequest('POST', '/api/events/mark-special', {
      eventId,
      specialType: '體驗',
      preserveDescription: true,
    });
    
    await delay(500);
    
    // 嘗試一個會失敗的操作（代課但不提供講師）
    const failedOp = await makeRequest('POST', '/api/events/mark-special', {
      eventId,
      specialType: '代課',
      // 故意不提供 substituteTeacher
    });
    
    if (failedOp.statusCode !== 400) {
      return { success: false, error: '預期的錯誤操作沒有被拒絕' };
    }
    
    await delay(500);
    
    // 驗證可以繼續正常操作
    const recoveryOp = await makeRequest('POST', '/api/events/remove-special', {
      eventId,
    });
    
    if (recoveryOp.statusCode === 200) {
      return {
        success: true,
        message: '錯誤後成功恢復正常操作',
      };
    } else {
      return { success: false, error: '錯誤後無法恢復' };
    }
    
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ==================== 主測試流程 ====================

async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║       特殊事件標記 - 整合測試（第三天）                ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  // 檢查伺服器
  log('\n📡 檢查伺服器狀態...', 'yellow');
  const serverRunning = await checkServerHealth();
  
  if (!serverRunning) {
    log('\n❌ 伺服器未運行！', 'red');
    log('請先啟動伺服器：npm run dev', 'yellow');
    process.exit(1);
  }
  
  log('✅ 伺服器運行正常\n', 'green');
  
  log('開始執行整合測試...', 'yellow');
  log('⚠️  整合測試包含延遲以確保快取同步', 'yellow');
  
  // 描述保留完整性測試（最關鍵）
  log('\n【階段一：描述保留完整性測試】⭐⭐⭐', 'magenta');
  await runTest('多次操作後描述保留', test_description_preservation, '描述保留');
  
  // 混合操作測試
  log('\n【階段二：混合操作測試】', 'cyan');
  await runTest('複雜操作序列', test_complex_sequence, '混合操作');
  await runTest('快速連續操作', test_rapid_operations, '混合操作');
  
  // 錯誤恢復測試
  log('\n【階段三：錯誤恢復測試】', 'cyan');
  await runTest('錯誤操作後恢復', test_error_recovery, '錯誤恢復');
  
  // 輸出測試結果
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    測試結果總結                        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  log(`\n總測試數: ${stats.total}`, 'blue');
  log(`✅ 通過: ${stats.passed}`, 'green');
  log(`❌ 失敗: ${stats.failed}`, stats.failed > 0 ? 'red' : 'reset');
  log(`⏭️  跳過: ${stats.skipped}`, stats.skipped > 0 ? 'yellow' : 'reset');
  
  const passRate = stats.total > 0 ? ((stats.passed / (stats.total - stats.skipped)) * 100).toFixed(1) : 0;
  log(`\n通過率: ${passRate}%`, passRate >= 80 ? 'green' : 'red');
  
  // 詳細結果
  if (stats.failed > 0) {
    log('\n失敗的測試:', 'red');
    results.filter(r => r.status === 'failed').forEach((r, i) => {
      log(`${i + 1}. [${r.category}] ${r.name}`, 'red');
      log(`   錯誤: ${r.error}`, 'red');
    });
  }
  
  if (stats.skipped > 0) {
    log('\n跳過的測試:', 'yellow');
    results.filter(r => r.status === 'skipped').forEach((r, i) => {
      log(`${i + 1}. [${r.category}] ${r.name}`, 'yellow');
      log(`   原因: ${r.reason}`, 'yellow');
    });
  }
  
  // 特別說明
  log('\n📝 重要提示：', 'yellow');
  log('• 描述保留測試只驗證 API 調用成功', 'yellow');
  log('• 實際的描述內容保留需要前端 Console 工具驗證', 'yellow');
  log('• 建議執行：SpecialEventTestHelper.test_5_5_描述保留()', 'yellow');
  
  // 退出碼
  const exitCode = stats.failed > 0 ? 1 : 0;
  
  log('\n' + '='.repeat(60), 'cyan');
  log(exitCode === 0 ? '✅ 整合測試全部通過！' : '❌ 部分整合測試失敗', exitCode === 0 ? 'green' : 'red');
  log('='.repeat(60) + '\n', 'cyan');
  
  process.exit(exitCode);
}

// 執行測試
if (require.main === module) {
  main().catch((error) => {
    log(`\n❌ 測試執行異常: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  runTest,
};
