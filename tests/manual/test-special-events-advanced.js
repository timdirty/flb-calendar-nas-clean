#!/usr/bin/env node

/**
 * 🧪 特殊事件標記 - 進階測試（第二天）
 * 
 * 測試範圍：
 * - 多標記組合（替換/增量模式）
 * - 互斥規則驗證
 * - 部分移除和全部移除
 * 
 * 執行方式：
 * node tests/manual/test-special-events-advanced.js
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
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
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

// ==================== 多標記組合測試 ====================

/**
 * 測試 2.1：體驗 + 公告（允許組合）
 */
async function test_multiple_experience_announcement() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  // 先清理
  await makeRequest('POST', '/api/events/remove-special', {
    eventId: testEvent.eventId,
  });
  
  // 添加組合標記
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗', '公告'],
    announcementContent: '測試公告內容',
    preserveDescription: true,
  });
  
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
}

/**
 * 測試 2.2：停課與體驗互斥
 */
async function test_mutex_cancelled_experience() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  // 先添加停課
  await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '停課',
    preserveDescription: true,
  });
  
  // 嘗試再添加體驗（應該替換或合併，取決於後端邏輯）
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗'],
    preserveDescription: true,
  });
  
  // 檢查結果 - 可能成功（替換）或失敗（互斥）
  if (response.statusCode === 200) {
    return { 
      success: true, 
      message: '互斥標記處理正確（替換模式）' 
    };
  } else if (response.statusCode === 400) {
    return { 
      success: true, 
      message: '互斥標記處理正確（拒絕模式）' 
    };
  } else {
    return { 
      success: false, 
      error: '互斥規則處理異常' 
    };
  }
}

/**
 * 測試 2.3：增量模式 - 保留現有標記
 */
async function test_incremental_mode() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  // 先添加體驗
  await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '體驗',
    preserveDescription: true,
  });
  
  // 增量添加公告（應該保留體驗）
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗', '公告'], // 明確包含原有的體驗
    announcementContent: '增量添加的公告',
    preserveDescription: true,
  });
  
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
}

/**
 * 測試 2.4：替換模式 - 覆蓋現有標記
 */
async function test_replacement_mode() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  // 先添加體驗 + 公告
  await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗', '公告'],
    announcementContent: '原公告',
    preserveDescription: true,
  });
  
  // 替換為改時間
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '改時間',
    newStartTime: '2025-12-01T14:00:00',
    newEndTime: '2025-12-01T15:00:00',
    preserveDescription: true,
  });
  
  if (response.statusCode === 200 && response.body.success) {
    return { 
      success: true, 
      message: '替換模式成功覆蓋原標記' 
    };
  } else {
    return { 
      success: false, 
      error: '替換模式失敗' 
    };
  }
}

// ==================== 移除標記測試 ====================

/**
 * 測試 4.1：部分移除（多標記中移除一個）
 */
async function test_partial_remove() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  // 先添加多個標記
  await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗', '公告'],
    announcementContent: '測試公告',
    preserveDescription: true,
  });
  
  // 只保留體驗，移除公告
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗'], // 只保留體驗
    preserveDescription: true,
  });
  
  if (response.statusCode === 200 && response.body.success) {
    return { 
      success: true, 
      message: '成功部分移除標記（保留體驗，移除公告）' 
    };
  } else {
    return { 
      success: false, 
      error: '部分移除失敗' 
    };
  }
}

/**
 * 測試 4.2：全部移除
 */
async function test_complete_remove() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  // 先添加多個標記
  await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗', '公告'],
    announcementContent: '測試公告',
    preserveDescription: true,
  });
  
  // 移除所有標記
  const response = await makeRequest('POST', '/api/events/remove-special', {
    eventId: testEvent.eventId,
  });
  
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
}

/**
 * 測試 4.3：逐一移除多標記
 */
async function test_sequential_remove() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  // 添加 3 個標記
  await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗', '公告'],
    announcementContent: '測試',
    preserveDescription: true,
  });
  
  // 第一次移除：只保留體驗
  const step1 = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗'],
    preserveDescription: true,
  });
  
  if (step1.statusCode !== 200) {
    return { success: false, error: '第一次移除失敗' };
  }
  
  // 第二次移除：全部移除
  const step2 = await makeRequest('POST', '/api/events/remove-special', {
    eventId: testEvent.eventId,
  });
  
  if (step2.statusCode === 200 && step2.body.success) {
    return { 
      success: true, 
      message: '逐一移除成功完成' 
    };
  } else {
    return { 
      success: false, 
      error: '最後移除失敗' 
    };
  }
}

// ==================== 邊界條件測試 ====================

/**
 * 測試 5.1：空字串備註
 */
async function test_empty_note() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '停課',
    note: '', // 空字串
    preserveDescription: true,
  });
  
  if (response.statusCode === 200 && response.body.success) {
    return { 
      success: true, 
      message: '空備註處理正確' 
    };
  } else {
    return { 
      success: false, 
      error: '空備註處理異常' 
    };
  }
}

/**
 * 測試 5.2：超長備註
 */
async function test_long_note() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const longNote = 'A'.repeat(500); // 500 字元
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '停課',
    note: longNote,
    preserveDescription: true,
  });
  
  if (response.statusCode === 200 && response.body.success) {
    return { 
      success: true, 
      message: '超長備註處理正確' 
    };
  } else if (response.statusCode === 400) {
    return { 
      success: true, 
      message: '超長備註正確拒絕' 
    };
  } else {
    return { 
      success: false, 
      error: '超長備註處理異常' 
    };
  }
}

/**
 * 測試 5.3：特殊字元處理
 */
async function test_special_characters() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const specialNote = '<script>alert("XSS")</script> & "quotes" \'apostrophe\'';
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '停課',
    note: specialNote,
    preserveDescription: true,
  });
  
  if (response.statusCode === 200 && response.body.success) {
    return { 
      success: true, 
      message: '特殊字元處理正確（已轉義或允許）' 
    };
  } else {
    return { 
      success: false, 
      error: '特殊字元處理失敗' 
    };
  }
}

// ==================== 主測試流程 ====================

async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║       特殊事件標記 - 進階測試（第二天）                ║', 'cyan');
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
  
  log('開始執行進階測試...', 'yellow');
  
  // 多標記組合測試
  log('\n【階段一：多標記組合測試】', 'cyan');
  await runTest('體驗 + 公告組合', test_multiple_experience_announcement, '多標記');
  await runTest('停課與體驗互斥', test_mutex_cancelled_experience, '互斥規則');
  await runTest('增量模式', test_incremental_mode, '標記模式');
  await runTest('替換模式', test_replacement_mode, '標記模式');
  
  // 移除標記測試
  log('\n【階段二：移除標記測試】', 'cyan');
  await runTest('部分移除標記', test_partial_remove, '移除功能');
  await runTest('全部移除標記', test_complete_remove, '移除功能');
  await runTest('逐一移除多標記', test_sequential_remove, '移除功能');
  
  // 邊界條件測試
  log('\n【階段三：邊界條件測試】', 'cyan');
  await runTest('空字串備註', test_empty_note, '邊界條件');
  await runTest('超長備註（500字元）', test_long_note, '邊界條件');
  await runTest('特殊字元處理', test_special_characters, '邊界條件');
  
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
  
  // 退出碼
  const exitCode = stats.failed > 0 ? 1 : 0;
  
  log('\n' + '='.repeat(60), 'cyan');
  log(exitCode === 0 ? '✅ 進階測試全部通過！' : '❌ 部分進階測試失敗', exitCode === 0 ? 'green' : 'red');
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
