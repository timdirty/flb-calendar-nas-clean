#!/usr/bin/env node

/**
 * 🧪 特殊事件標記 API 自動化測試
 * 
 * 此腳本測試特殊事件標記的後端 API 功能
 * 包括：添加標記、移除標記、參數驗證、互斥規則等
 * 
 * 執行方式：
 * node tests/manual/test-special-events-api.js
 */

const http = require('http');

// 測試配置
const config = {
  host: 'localhost',
  port: 3000, // 修改為實際運行的端口
  timeout: 10000,
};

// 測試統計
const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  skipped: 0,
};

// 測試結果
const results = [];

// 顏色輸出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * 輸出帶顏色的日誌
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * HTTP 請求輔助函數
 */
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: config.host,
      port: config.port,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: config.timeout,
    };

    const req = http.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonBody = body ? JSON.parse(body) : {};
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: jsonBody,
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

/**
 * 測試用例基類
 */
async function runTest(name, testFn, category = '一般') {
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

/**
 * 檢查伺服器是否運行
 */
async function checkServerHealth() {
  try {
    const response = await makeRequest('GET', '/health');
    return response.statusCode === 200;
  } catch (error) {
    return false;
  }
}

/**
 * 獲取測試用課程 ID
 */
async function getTestEventId() {
  try {
    const response = await makeRequest('GET', '/api/events');
    console.log('🔍 [getTestEventId] API 響應:', JSON.stringify(response, null, 2));
    
    if (response.statusCode === 200 && response.body) {
      console.log('🔍 [getTestEventId] 響應結構:', {
        hasData: !!response.body.data,
        dataKeys: response.body.data ? Object.keys(response.body.data) : [],
        bodyKeys: Object.keys(response.body)
      });
      
      const events = Array.isArray(response.body.data) ? response.body.data : 
                     (response.body.data.events || response.body.data.data || []);
      
      console.log('🔍 [getTestEventId] 解析的事件數量:', events.length);
      if (events.length > 0) {
        console.log('🔍 [getTestEventId] 第一個事件結構:', Object.keys(events[0] || {}));
        
        // 找一個測試用課程（標題包含「測試」或使用第一個）
        const testEvent = events.find(e => e.title && e.title.includes('測試')) || events[0];
        console.log('🔍 [getTestEventId] 選中的測試事件:', testEvent);
        
        if (!testEvent) {
          console.log('❌ [getTestEventId] 沒有找到可用的事件');
          return null;
        }
        
        const eventId = testEvent.id || testEvent.uid || testEvent.evt_id;
        console.log('🔍 [getTestEventId] 事件 ID:', eventId);
        
        if (!eventId) {
          console.log('❌ [getTestEventId] 事件沒有有效的 ID');
          return null;
        }
        
        return {
          eventId: eventId,
          originalTitle: testEvent.title,
          originalDescription: testEvent.description,
          instructor: testEvent.instructor,
        };
      } else {
        console.log('❌ [getTestEventId] 事件列表為空');
      }
    } else {
      console.log('❌ [getTestEventId] API 響應異常:', response.statusCode);
    }
    return null;
  } catch (error) {
    console.error('❌ [getTestEventId] 獲取課程失敗:', error);
    return null;
  }
}

// ==================== 測試案例 ====================

/**
 * 測試 1：健康檢查
 */
async function test_health_check() {
  const response = await makeRequest('GET', '/health');
  
  if (response.statusCode === 200) {
    return { success: true, message: '伺服器運行正常' };
  } else {
    return { success: false, error: `伺服器狀態異常: ${response.statusCode}` };
  }
}

/**
 * 測試 2：獲取課程列表
 */
async function test_get_events() {
  const response = await makeRequest('GET', '/api/events');
  
  if (response.statusCode === 200 && response.body.data) {
    const events = Array.isArray(response.body.data) ? response.body.data : 
                   (response.body.data.events || response.body.data.data || []);
    
    if (events.length > 0) {
      return { success: true, message: `成功獲取 ${events.length} 個課程` };
    } else {
      return { success: false, error: '課程列表為空' };
    }
  } else {
    return { success: false, error: `獲取課程失敗: ${response.statusCode}` };
  }
}

/**
 * 測試 3：缺少必要參數 - eventId
 */
async function test_missing_eventId() {
  const response = await makeRequest('POST', '/api/events/mark-special', {
    specialType: '停課',
  });
  
  if (response.statusCode === 400 && response.body.error) {
    return { success: true, message: '正確拒絕缺少 eventId' };
  } else {
    return { success: false, error: '未正確驗證必要參數' };
  }
}

/**
 * 測試 4：缺少必要參數 - specialType
 */
async function test_missing_specialType() {
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: 'test-event-id',
  });
  
  if (response.statusCode === 400 && response.body.error) {
    return { success: true, message: '正確拒絕缺少 specialType' };
  } else {
    return { success: false, error: '未正確驗證必要參數' };
  }
}

/**
 * 測試 5：代課標記 - 缺少代課講師
 */
async function test_substitute_missing_teacher() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '代課',
    // 故意不提供 substituteTeacher
  });
  
  if (response.statusCode === 400 && response.body.error) {
    return { success: true, message: '正確拒絕缺少代課講師' };
  } else {
    return { success: false, error: '未正確驗證代課講師' };
  }
}

/**
 * 測試 6：代課標記 - 選擇原授課講師
 */
async function test_substitute_same_teacher() {
  const testEvent = await getTestEventId();
  if (!testEvent || !testEvent.instructor) {
    return { skip: true, reason: '無可用測試課程或課程無講師資訊' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '代課',
    substituteTeacher: testEvent.instructor, // 使用原講師
  });
  
  if (response.statusCode === 400 && response.body.error && 
      response.body.error.includes('原授課講師')) {
    return { success: true, message: '正確拒絕選擇原講師作為代課講師' };
  } else {
    return { success: false, error: '未正確驗證代課講師衝突' };
  }
}

/**
 * 測試 7：改時間標記 - 缺少新時間
 */
async function test_reschedule_missing_time() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '改時間',
    // 故意不提供 newStartTime 和 newEndTime
  });
  
  if (response.statusCode === 400 && response.body.error) {
    return { success: true, message: '正確拒絕缺少新時間' };
  } else {
    return { success: false, error: '未正確驗證新時間參數' };
  }
}

/**
 * 測試 8：公告標記 - 缺少公告內容
 */
async function test_announcement_missing_content() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '公告',
    // 故意不提供 announcementContent
  });
  
  if (response.statusCode === 400 && response.body.error) {
    return { success: true, message: '正確拒絕缺少公告內容' };
  } else {
    return { success: false, error: '未正確驗證公告內容' };
  }
}

/**
 * 測試 9：停課標記（實際標記測試）
 */
async function test_mark_class_cancelled() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  log(`   使用課程: ${testEvent.originalTitle}`, 'blue');
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialType: '停課',
    note: 'API 測試 - 停課標記',
    preserveDescription: true,
  });
  
  if (response.statusCode === 200 && response.body.success) {
    return { success: true, message: '成功添加停課標記' };
  } else {
    return { success: false, error: response.body.error || '標記失敗' };
  }
}

/**
 * 測試 10：移除特殊事件標記
 */
async function test_remove_special_event() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/remove-special', {
    eventId: testEvent.eventId,
  });
  
  if (response.statusCode === 200 && response.body.success) {
    return { success: true, message: '成功移除特殊事件標記' };
  } else if (response.statusCode === 404) {
    return { skip: true, reason: '課程不存在或快取未就緒' };
  } else {
    return { success: false, error: response.body.error || '移除失敗' };
  }
}

/**
 * 測試 11：多標記組合（體驗 + 公告）
 */
async function test_multiple_markers() {
  const testEvent = await getTestEventId();
  if (!testEvent) {
    return { skip: true, reason: '無可用測試課程' };
  }
  
  const response = await makeRequest('POST', '/api/events/mark-special', {
    eventId: testEvent.eventId,
    specialTypes: ['體驗', '公告'],
    announcementContent: 'API 測試 - 多標記組合',
    preserveDescription: true,
  });
  
  if (response.statusCode === 200 && response.body.success) {
    return { success: true, message: '成功添加多標記' };
  } else {
    return { success: false, error: response.body.error || '多標記失敗' };
  }
}

// ==================== 主測試流程 ====================

async function main() {
  log('\n╔════════════════════════════════════════════════════════╗', 'cyan');
  log('║     特殊事件標記 API 自動化測試                        ║', 'cyan');
  log('╚════════════════════════════════════════════════════════╝', 'cyan');
  
  // 檢查伺服器
  log('\n📡 檢查伺服器狀態...', 'yellow');
  const serverRunning = await checkServerHealth();
  
  if (!serverRunning) {
    log('\n❌ 伺服器未運行！', 'red');
    log('請先啟動伺服器：npm run dev', 'yellow');
    log('或確認伺服器運行在 http://localhost:3002', 'yellow');
    process.exit(1);
  }
  
  log('✅ 伺服器運行正常\n', 'green');
  
  // 執行測試
  log('開始執行測試...', 'yellow');
  
  // 基礎測試
  await runTest('健康檢查', test_health_check, '基礎');
  await runTest('獲取課程列表', test_get_events, '基礎');
  
  // 參數驗證測試
  await runTest('缺少 eventId 參數', test_missing_eventId, '參數驗證');
  await runTest('缺少 specialType 參數', test_missing_specialType, '參數驗證');
  await runTest('代課標記 - 缺少代課講師', test_substitute_missing_teacher, '參數驗證');
  await runTest('代課標記 - 選擇原授課講師', test_substitute_same_teacher, '參數驗證');
  await runTest('改時間標記 - 缺少新時間', test_reschedule_missing_time, '參數驗證');
  await runTest('公告標記 - 缺少公告內容', test_announcement_missing_content, '參數驗證');
  
  // 實際標記測試
  await runTest('添加停課標記', test_mark_class_cancelled, '標記功能');
  await runTest('多標記組合', test_multiple_markers, '標記功能');
  await runTest('移除特殊事件標記', test_remove_special_event, '標記功能');
  
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
  log(exitCode === 0 ? '✅ 所有測試通過！' : '❌ 部分測試失敗', exitCode === 0 ? 'green' : 'red');
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
  makeRequest,
  checkServerHealth,
  getTestEventId,
};
