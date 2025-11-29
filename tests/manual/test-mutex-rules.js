#!/usr/bin/env node

/**
 * 🧪 互斥規則驗證測試
 * 
 * 測試目的：
 * 驗證後端互斥規則驗證是否正確拒絕衝突的標記組合
 * 
 * 執行方式：
 * node tests/manual/test-mutex-rules.js
 */

const { makeRequest, checkServerHealth, getTestEventId } = require('./test-special-events-api');

// 測試統計
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
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

async function runTest(name, testFn) {
  stats.total++;
  
  try {
    log(`\n🧪 ${name}`, 'cyan');
    const result = await testFn();
    
    if (result.success) {
      stats.passed++;
      log(`✅ 通過`, 'green');
      if (result.message) log(`   ${result.message}`, 'blue');
      results.push({ name, status: 'passed', message: result.message });
    } else {
      stats.failed++;
      log(`❌ 失敗: ${result.error}`, 'red');
      results.push({ name, status: 'failed', error: result.error });
    }
  } catch (error) {
    stats.failed++;
    log(`❌ 異常: ${error.message}`, 'red');
    results.push({ name, status: 'failed', error: error.message });
  }
}

// ==================== 互斥規則測試 ====================

/**
 * 測試 1：停課 + 體驗（應該被拒絕）
 */
async function test_mutex_cancelled_experience() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { success: false, error: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['停課', '體驗'],
    preserveDescription: true,
  });
  
  // 應該返回 400 錯誤
  if (response.statusCode === 400 && response.body.error.includes('互斥')) {
    return {
      success: true,
      message: `正確拒絕：${response.body.error}`,
    };
  } else {
    return {
      success: false,
      error: `未正確拒絕互斥標記，statusCode: ${response.statusCode}`,
    };
  }
}

/**
 * 測試 2：停課 + 代課（應該被拒絕）
 */
async function test_mutex_cancelled_substitute() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { success: false, error: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['停課', '代課'],
    substituteTeacher: '測試講師',
    preserveDescription: true,
  });
  
  if (response.statusCode === 400 && response.body.error.includes('互斥')) {
    return {
      success: true,
      message: `正確拒絕：${response.body.error}`,
    };
  } else {
    return {
      success: false,
      error: `未正確拒絕互斥標記，statusCode: ${response.statusCode}`,
    };
  }
}

/**
 * 測試 3：停課 + 改時間（應該被拒絕）
 */
async function test_mutex_cancelled_reschedule() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { success: false, error: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['停課', '改時間'],
    newStartTime: Math.floor(Date.now() / 1000) + 3600,
    newEndTime: Math.floor(Date.now() / 1000) + 7200,
    preserveDescription: true,
  });
  
  if (response.statusCode === 400 && response.body.error.includes('互斥')) {
    return {
      success: true,
      message: `正確拒絕：${response.body.error}`,
    };
  } else {
    return {
      success: false,
      error: `未正確拒絕互斥標記，statusCode: ${response.statusCode}`,
    };
  }
}

/**
 * 測試 4：體驗 + 停課（應該被拒絕，反向測試）
 */
async function test_mutex_experience_cancelled() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { success: false, error: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗', '停課'],
    preserveDescription: true,
  });
  
  if (response.statusCode === 400 && response.body.error.includes('互斥')) {
    return {
      success: true,
      message: `正確拒絕（反向）：${response.body.error}`,
    };
  } else {
    return {
      success: false,
      error: `未正確拒絕互斥標記，statusCode: ${response.statusCode}`,
    };
  }
}

/**
 * 測試 5：體驗 + 公告（應該被接受，不互斥）
 */
async function test_no_mutex_experience_announcement() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { success: false, error: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗', '公告'],
    announcementContent: '測試公告',
    preserveDescription: true,
  });
  
  if (response.statusCode === 200 && response.body.success) {
    return {
      success: true,
      message: '正確接受不互斥的標記組合',
    };
  } else {
    return {
      success: false,
      error: `錯誤拒絕不互斥的標記，statusCode: ${response.statusCode}, error: ${response.body.error}`,
    };
  }
}

/**
 * 測試 6：代課 + 改時間（應該被接受，不互斥）
 */
async function test_no_mutex_substitute_reschedule() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { success: false, error: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['代課', '改時間'],
    substituteTeacher: '測試講師B',
    newStartTime: Math.floor(Date.now() / 1000) + 3600,
    newEndTime: Math.floor(Date.now() / 1000) + 7200,
    preserveDescription: true,
  });
  
  if (response.statusCode === 200 && response.body.success) {
    return {
      success: true,
      message: '正確接受不互斥的標記組合',
    };
  } else {
    return {
      success: false,
      error: `錯誤拒絕不互斥的標記，statusCode: ${response.statusCode}, error: ${response.body.error}`,
    };
  }
}

// ==================== 主測試流程 ====================

async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║              互斥規則驗證測試                          ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  // 檢查伺服器
  log('\n📡 檢查伺服器狀態...', 'yellow');
  const serverRunning = await checkServerHealth();
  
  if (!serverRunning) {
    log('\n❌ 伺服器未運行！', 'red');
    process.exit(1);
  }
  
  log('✅ 伺服器運行正常\n', 'green');
  
  log('開始測試互斥規則...', 'yellow');
  
  // 互斥規則測試（應該被拒絕）
  log('\n【階段一：互斥標記組合（應該被拒絕）】', 'cyan');
  await runTest('停課 + 體驗', test_mutex_cancelled_experience);
  await runTest('停課 + 代課', test_mutex_cancelled_substitute);
  await runTest('停課 + 改時間', test_mutex_cancelled_reschedule);
  await runTest('體驗 + 停課（反向）', test_mutex_experience_cancelled);
  
  // 非互斥組合測試（應該被接受）
  log('\n【階段二：不互斥標記組合（應該被接受）】', 'cyan');
  await runTest('體驗 + 公告', test_no_mutex_experience_announcement);
  await runTest('代課 + 改時間', test_no_mutex_substitute_reschedule);
  
  // 輸出測試結果
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║                    測試結果總結                        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  log(`\n總測試數: ${stats.total}`, 'blue');
  log(`✅ 通過: ${stats.passed}`, 'green');
  log(`❌ 失敗: ${stats.failed}`, stats.failed > 0 ? 'red' : 'reset');
  
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
  
  // 退出碼
  const exitCode = stats.failed > 0 ? 1 : 0;
  
  log('\n' + '='.repeat(60), 'cyan');
  log(exitCode === 0 ? '✅ 互斥規則驗證測試全部通過！' : '❌ 部分測試失敗', exitCode === 0 ? 'green' : 'red');
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
