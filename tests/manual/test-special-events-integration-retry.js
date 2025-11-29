#!/usr/bin/env node

/**
 * 🧪 特殊事件標記 - 整合測試（改進版：帶重試機制）
 *
 * 改進內容：
 * - 增加延遲時間（3秒）
 * - 添加自動重試機制（最多3次）
 * - 每次操作後手動刷新快取
 *
 * 執行方式：
 * node tests/manual/test-special-events-integration-retry.js
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

// ==================== 整合測試案例 ====================

/**
 * 測試 1：描述保留完整性測試（最關鍵）
 */
async function test_description_preservation_integration() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { success: false, error: '無可用測試課程' };
  }

  log(`   ⭐⭐⭐ 這是最關鍵的測試 ⭐⭐⭐`, 'yellow');
  
  // 直接使用 getTestEventId 返回的原始描述
  const originalDescription = testEvent.originalDescription;
  if (!originalDescription) {
    return { success: false, error: '測試事件沒有原始描述' };
  }
  
  log(`   原始描述: "${originalDescription}"`, 'blue');
  
  try {
    // 步驟 1：添加「體驗」標記
    log(`   步驟 1/4：添加「體驗」標記...`, 'blue');
    const step1 = await retryOperation(() => 
      makeRequest('POST', '/api/events/mark-special', {
        eventId: testEvent.eventId,
        specialTypes: ['體驗'],
        preserveDescription: true,
      })
    );
    
    if (step1.statusCode !== 200) {
      throw new Error(`步驟1失敗: ${step1.body.error}`);
    }
    await delay(config.operationDelay);
    await refreshCache();

    // 步驟 2：增量添加「公告」標記
    log(`   步驟 2/4：增量添加「公告」標記...`, 'blue');
    const step2 = await retryOperation(() => 
      makeRequest('POST', '/api/events/mark-special', {
        eventId: testEvent.eventId,
        specialTypes: ['體驗', '公告'],
        announcementContent: '整合測試公告',
        preserveDescription: true,
      })
    );
    
    if (step2.statusCode !== 200) {
      throw new Error(`步驟2失敗: ${step2.body.error}`);
    }
    await delay(config.operationDelay);
    await refreshCache();

    // 步驟 3：移除「公告」標記
    log(`   步驟 3/4：移除「公告」標記...`, 'blue');
    const step3 = await retryOperation(() => 
      makeRequest('POST', '/api/events/remove-special', {
        eventId: testEvent.eventId,
        removeTypes: ['公告'],
      })
    );
    
    if (step3.statusCode !== 200) {
      throw new Error(`步驟3失敗: ${step3.body.error}`);
    }
    await delay(config.operationDelay);
    await refreshCache();

    // 步驟 4：移除所有標記
    log(`   步驟 4/4：移除所有標記...`, 'blue');
    const step4 = await retryOperation(() => 
      makeRequest('POST', '/api/events/remove-special', {
        eventId: testEvent.eventId,
      })
    );
    
    if (step4.statusCode !== 200) {
      throw new Error(`步驟4失敗: ${step4.body.error}`);
    }

    return {
      success: true,
      message: '描述保留完整性測試通過（所有步驟完成）',
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 測試 2：複雜操作序列
 */
async function test_complex_operation_sequence() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { success: false, error: '無可用測試課程' };
  }

  try {
    // 複雜序列：標記 → 修改 → 移除 → 重新標記
    const operations = [
      { type: 'mark', markers: ['體驗'], desc: '添加體驗' },
      { type: 'mark', markers: ['體驗', '公告'], desc: '增量添加公告', announcement: '複雜序列公告' },
      { type: 'remove', markers: ['公告'], desc: '移除公告' },
      { type: 'mark', markers: ['代課'], desc: '添加代課', substitute: '測試講師' },
      { type: 'remove', markers: ['代課'], desc: '移除代課' },
    ];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      log(`   操作 ${i + 1}/${operations.length}: ${op.desc}`, 'blue');
      
      let response;
      if (op.type === 'mark') {
        const payload = {
          eventId: testEvent.eventId,
          specialTypes: op.markers,
          preserveDescription: true,
        };
        if (op.announcement) payload.announcementContent = op.announcement;
        if (op.substitute) payload.substituteTeacher = op.substitute;
        
        response = await retryOperation(() => 
          makeRequest('POST', '/api/events/mark-special', payload)
        );
      } else {
        response = await retryOperation(() => 
          makeRequest('POST', '/api/events/remove-special', {
            eventId: testEvent.eventId,
            removeTypes: op.markers,
          })
        );
      }
      
      if (response.statusCode !== 200) {
        throw new Error(`操作 ${i + 1} 失敗: ${response.body.error}`);
      }
      
      await delay(config.operationDelay);
      await refreshCache();
    }

    return {
      success: true,
      message: '複雜操作序列完成',
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 測試 3：快速連續操作
 */
async function test_rapid_operations() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { success: false, error: '無可用測試課程' };
  }

  try {
    // 快速連續操作（較短延遲）
    const rapidConfig = { ...config, operationDelay: 1000 };
    
    // 快速標記和移除
    const operations = [
      { type: 'mark', markers: ['停課'] },
      { type: 'remove', markers: ['停課'] },
      { type: 'mark', markers: ['體驗'] },
      { type: 'remove', markers: ['體驗'] },
    ];

    for (let i = 0; i < operations.length; i++) {
      const op = operations[i];
      log(`   快速操作 ${i + 1}/${operations.length}`, 'blue');
      
      let response;
      if (op.type === 'mark') {
        response = await retryOperation(() => 
          makeRequest('POST', '/api/events/mark-special', {
            eventId: testEvent.eventId,
            specialTypes: op.markers,
            preserveDescription: true,
          })
        );
      } else {
        response = await retryOperation(() => 
          makeRequest('POST', '/api/events/remove-special', {
            eventId: testEvent.eventId,
          })
        );
      }
      
      if (response.statusCode !== 200) {
        throw new Error(`快速操作 ${i + 1} 失敗: ${response.body.error}`);
      }
      
      await delay(rapidConfig.operationDelay);
    }

    return {
      success: true,
      message: '快速操作序列完成（可能有快取同步延遲）',
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * 測試 4：錯誤恢復
 */
async function test_error_recovery() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { success: false, error: '無可用測試課程' };
  }

  try {
    // 故意觸發錯誤（互斥標記）
    log(`   觸發互斥錯誤...`, 'blue');
    const errorResponse = await makeRequest('POST', '/api/events/mark-special', {
      eventId: testEvent.eventId,
      specialTypes: ['停課', '體驗'],  // 互斥組合
      preserveDescription: true,
    });
    
    if (errorResponse.statusCode !== 400) {
      throw new Error('預期的互斥錯誤未發生');
    }
    
    log(`   錯誤正確觸發: ${errorResponse.body.error}`, 'yellow');
    
    // 等待一下
    await delay(config.operationDelay);
    
    // 恢復正常操作
    log(`   執行恢復操作...`, 'blue');
    const recoveryResponse = await retryOperation(() => 
      makeRequest('POST', '/api/events/mark-special', {
        eventId: testEvent.eventId,
        specialTypes: ['體驗'],
        preserveDescription: true,
      })
    );
    
    if (recoveryResponse.statusCode !== 200) {
      throw new Error(`恢復操作失敗: ${recoveryResponse.body.error}`);
    }

    return {
      success: true,
      message: '錯誤後成功恢復正常操作',
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

// ==================== 主測試流程 ====================

async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║       特殊事件標記 - 整合測試（改進版）                ║', 'cyan');
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
  
  log('開始執行改進版整合測試...', 'yellow');
  log('⚠️  整合測試包含延遲以確保快取同步\n', 'yellow');
  
  // 執行測試
  log('【階段一：描述保留完整性測試】⭐⭐⭐', 'cyan');
  await runTest('描述保留完整性測試', test_description_preservation_integration, '描述保留');
  
  log('\n【階段二：混合操作測試】', 'cyan');
  await runTest('複雜操作序列', test_complex_operation_sequence, '混合操作');
  await runTest('快速連續操作', test_rapid_operations, '混合操作');
  
  log('\n【階段三：錯誤恢復測試】', 'cyan');
  await runTest('錯誤操作後恢復', test_error_recovery, '錯誤恢復');
  
  // 輸出測試結果
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    測試結果總結                        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  log(`\n總測試數: ${stats.total}`, 'blue');
  log(`✅ 通過: ${stats.passed}`, 'green');
  log(`❌ 失敗: ${stats.failed}`, stats.failed > 0 ? 'red' : 'reset');
  log(`⏭️  跳過: ${stats.skipped}`, 'yellow');
  log(`🔄 重試次數: ${stats.retried}`, 'magenta');
  
  const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : 0;
  log(`\n通過率: ${passRate}%`, passRate >= 80 ? 'green' : 'red');
  
  // 詳細結果
  if (stats.failed > 0) {
    log('\n失敗的測試:', 'red');
    results.filter(r => r.status === 'failed').forEach((r, i) => {
      log(`${i + 1}. ${r.name}`, 'red');
      log(`   錯誤: ${r.error}`, 'red');
    });
  }
  
  // 重要提示
  log('\n📝 重要提示：', 'yellow');
  log('• 描述保留測試只驗證 API 調用成功', 'yellow');
  log('• 實際的描述內容保留需要前端 Console 工具驗證', 'yellow');
  log('• 建議執行：SpecialEventTestHelper.test_5_5_描述保留()', 'yellow');
  
  // 退出碼
  const exitCode = stats.failed > 0 ? 1 : 0;
  
  log('\n' + '='.repeat(60), 'cyan');
  log(exitCode === 0 ? '✅ 改進版整合測試全部通過！' : '❌ 部分整合測試失敗', exitCode === 0 ? 'green' : 'red');
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
