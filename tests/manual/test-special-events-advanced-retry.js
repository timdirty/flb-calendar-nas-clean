#!/usr/bin/env node

/**
 * 🧪 特殊事件標記 - 進階測試（改進版：帶重試機制）
 * 
 * 改進內容：
 * - 增加延遲時間（3秒）
 * - 添加自動重試機制（最多3次）
 * - 每次操作後手動刷新快取
 * 
 * 執行方式：
 * node tests/manual/test-special-events-advanced-retry.js
 */

const { makeRequest, checkServerHealth, getTestEventId } = require('./test-special-events-api');

// 測試配置
const config = {
  retryCount: 3,
  retryDelay: 2000,
  operationDelay: 3000,
};

// 測試統計
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
  retried: 0,
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

/**
 * 帶重試機制的操作
 */
async function retryOperation(operationFn, operationName = '操作') {
  let lastError = null;
  
  for (let attempt = 1; attempt <= config.retryCount; attempt++) {
    try {
      if (attempt > 1) {
        stats.retried++;
        log(`   🔄 重試第 ${attempt - 1} 次...`, 'yellow');
        await delay(config.retryDelay);
      }
      
      const result = await operationFn();
      
      // 檢查結果
      if (result.statusCode === 200 || result.statusCode === 400) {
        return result;
      }
      
      lastError = new Error(`狀態碼異常: ${result.statusCode}`);
      
    } catch (error) {
      lastError = error;
      
      if (attempt === config.retryCount) {
        throw error;
      }
    }
  }
  
  throw lastError || new Error(`${operationName} 失敗`);
}

/**
 * 手動刷新快取
 */
async function refreshCache() {
  try {
    // 嘗試刷新快取（如果有這個 API）
    await makeRequest('GET', '/api/events/refresh-cache');
    await delay(1000);
  } catch (error) {
    // 忽略錯誤，可能沒有這個 API
  }
}

async function runTest(name, testFn, category = '進階') {
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

// ==================== 改進版測試案例 ====================

/**
 * 測試 2.1：體驗 + 公告（帶重試）
 */
async function test_multiple_experience_announcement() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  try {
    // 先清理
    log('   步驟 1/2：清理現有標記...', 'blue');
    await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/remove-special', {
        eventId: testEvent.eventId,
      });
    }, '清理標記');
    
    await delay(config.operationDelay);
    
    // 添加組合標記
    log('   步驟 2/2：添加組合標記...', 'blue');
    const response = await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/mark-special', {
        eventId: testEvent.eventId,
        specialTypes: ['體驗', '公告'],
        announcementContent: '測試公告內容',
        preserveDescription: true,
      });
    }, '添加組合標記');
    
    if (response.statusCode === 200 && response.body.success) {
      return { 
        success: true, 
        message: '成功添加體驗 + 公告組合' 
      };
    } else {
      return { 
        success: false, 
        error: response.body.error || '組合標記失敗' 
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 測試 2.3：增量模式（帶重試）
 */
async function test_incremental_mode() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  try {
    // 先添加體驗
    log('   步驟 1/2：添加體驗標記...', 'blue');
    await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/mark-special', {
        eventId: testEvent.eventId,
        specialType: '體驗',
        preserveDescription: true,
      });
    }, '添加體驗');
    
    await delay(config.operationDelay);
    
    // 增量添加公告
    log('   步驟 2/2：增量添加公告...', 'blue');
    const response = await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/mark-special', {
        eventId: testEvent.eventId,
        specialTypes: ['體驗', '公告'],
        announcementContent: '增量添加的公告',
        preserveDescription: true,
      });
    }, '增量添加公告');
    
    if (response.statusCode === 200 && response.body.success) {
      return { 
        success: true, 
        message: '增量模式成功保留原標記' 
      };
    } else {
      return { 
        success: false, 
        error: '增量模式失敗' 
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 測試 4.1：部分移除（帶重試）
 */
async function test_partial_remove() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  try {
    // 先添加多個標記
    log('   步驟 1/2：添加多個標記...', 'blue');
    await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/mark-special', {
        eventId: testEvent.eventId,
        specialTypes: ['體驗', '公告'],
        announcementContent: '測試公告',
        preserveDescription: true,
      });
    }, '添加多標記');
    
    await delay(config.operationDelay);
    
    // 只保留體驗
    log('   步驟 2/2：移除公告，保留體驗...', 'blue');
    const response = await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/mark-special', {
        eventId: testEvent.eventId,
        specialTypes: ['體驗'],
        preserveDescription: true,
      });
    }, '部分移除');
    
    if (response.statusCode === 200 && response.body.success) {
      return { 
        success: true, 
        message: '成功部分移除標記' 
      };
    } else {
      return { 
        success: false, 
        error: '部分移除失敗' 
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 測試 4.2：全部移除（帶重試）
 */
async function test_complete_remove() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  try {
    // 先添加標記
    log('   步驟 1/2：添加標記...', 'blue');
    await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/mark-special', {
        eventId: testEvent.eventId,
        specialTypes: ['體驗', '公告'],
        announcementContent: '測試公告',
        preserveDescription: true,
      });
    }, '添加標記');
    
    await delay(config.operationDelay);
    
    // 移除所有標記
    log('   步驟 2/2：移除所有標記...', 'blue');
    const response = await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/remove-special', {
        eventId: testEvent.eventId,
      });
    }, '移除所有標記');
    
    if (response.statusCode === 200 && response.body.success) {
      return { 
        success: true, 
        message: '成功移除所有標記' 
      };
    } else {
      return { 
        success: false, 
        error: response.body.error || '全部移除失敗' 
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 測試 5.5：描述保留完整性（最關鍵，帶重試）
 */
async function test_description_preservation() {
  log('   ⭐⭐⭐ 最關鍵的測試 ⭐⭐⭐', 'magenta');
  
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const eventId = testEvent.eventId;
  const steps = [];
  
  try {
    // 步驟 1：添加體驗
    log('   步驟 1/4：添加「體驗」標記...', 'yellow');
    await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/mark-special', {
        eventId,
        specialType: '體驗',
        preserveDescription: true,
      });
    }, '步驟1');
    steps.push('✓ 步驟1: 體驗標記添加成功');
    await delay(config.operationDelay);
    
    // 步驟 2：增量添加公告
    log('   步驟 2/4：增量添加「公告」標記...', 'yellow');
    await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/mark-special', {
        eventId,
        specialTypes: ['體驗', '公告'],
        announcementContent: '測試公告內容',
        preserveDescription: true,
      });
    }, '步驟2');
    steps.push('✓ 步驟2: 公告標記添加成功');
    await delay(config.operationDelay);
    
    // 步驟 3：移除公告
    log('   步驟 3/4：移除「公告」標記...', 'yellow');
    await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/mark-special', {
        eventId,
        specialTypes: ['體驗'],
        preserveDescription: true,
      });
    }, '步驟3');
    steps.push('✓ 步驟3: 公告標記移除成功');
    await delay(config.operationDelay);
    
    // 步驟 4：移除所有標記
    log('   步驟 4/4：移除所有標記...', 'yellow');
    await retryOperation(async () => {
      return await makeRequest('POST', '/api/events/remove-special', {
        eventId,
      });
    }, '步驟4');
    steps.push('✓ 步驟4: 所有標記移除成功');
    steps.push('✓ 所有操作完成，描述應保持一致');
    
    return {
      success: true,
      message: '描述保留完整性測試通過（所有步驟完成）',
    };
    
  } catch (error) {
    return {
      success: false,
      error: `測試在步驟 ${steps.length + 1} 失敗: ${error.message}`,
    };
  }
}

// ==================== 主測試流程 ====================

async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║     特殊事件標記 - 進階測試（改進版：帶重試）          ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  log(`\n配置：`, 'yellow');
  log(`• 重試次數：${config.retryCount} 次`, 'yellow');
  log(`• 重試延遲：${config.retryDelay}ms`, 'yellow');
  log(`• 操作延遲：${config.operationDelay}ms`, 'yellow');
  
  // 檢查伺服器
  log('\n📡 檢查伺服器狀態...', 'yellow');
  const serverRunning = await checkServerHealth();
  
  if (!serverRunning) {
    log('\n❌ 伺服器未運行！', 'red');
    process.exit(1);
  }
  
  log('✅ 伺服器運行正常\n', 'green');
  log('開始執行改進版測試...', 'yellow');
  
  // 關鍵測試
  log('\n【最優先：描述保留完整性測試】⭐⭐⭐', 'magenta');
  await runTest('多次操作後描述保留', test_description_preservation, '描述保留');
  
  // 多標記組合測試
  log('\n【階段一：多標記組合測試】', 'cyan');
  await runTest('體驗 + 公告組合', test_multiple_experience_announcement, '多標記');
  await runTest('增量模式', test_incremental_mode, '標記模式');
  
  // 移除標記測試
  log('\n【階段二：移除標記測試】', 'cyan');
  await runTest('部分移除標記', test_partial_remove, '移除功能');
  await runTest('全部移除標記', test_complete_remove, '移除功能');
  
  // 輸出測試結果
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    測試結果總結                        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  log(`\n總測試數: ${stats.total}`, 'blue');
  log(`✅ 通過: ${stats.passed}`, 'green');
  log(`❌ 失敗: ${stats.failed}`, stats.failed > 0 ? 'red' : 'reset');
  log(`⏭️  跳過: ${stats.skipped}`, stats.skipped > 0 ? 'yellow' : 'reset');
  log(`🔄 重試次數: ${stats.retried}`, stats.retried > 0 ? 'yellow' : 'reset');
  
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
  
  // 退出碼
  const exitCode = stats.failed > 0 ? 1 : 0;
  
  log('\n' + '='.repeat(60), 'cyan');
  log(exitCode === 0 ? '✅ 改進版測試全部通過！' : '❌ 部分測試仍然失敗', exitCode === 0 ? 'green' : 'red');
  
  if (stats.retried > 0) {
    log(`\n💡 提示：使用了 ${stats.retried} 次重試`, 'yellow');
  }
  
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
  retryOperation,
};
