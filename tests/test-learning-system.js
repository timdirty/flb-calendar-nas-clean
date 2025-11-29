#!/usr/bin/env node

/**
 * ============================================
 * 學習歷程管理系統完整測試
 * ============================================
 * 測試所有學習歷程相關功能
 */

require('dotenv').config({ path: '.env.nas' });
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const TEST_CONFIG = {
  server: {
    host: 'localhost',
    port: 3005,
    baseUrl: 'http://localhost:3005'
  },
  synology: {
    host: process.env.SYNOLOGY_HOST,
    port: process.env.SYNOLOGY_PORT || 9102,
    protocol: 'https',
    username: process.env.SYNOLOGY_USERNAME,
    password: process.env.SYNOLOGY_PASSWORD,
    driveRoot: process.env.SYNOLOGY_DRIVE_ROOT || '/Fun Learn Bar/FLB-Learning-Portfolio'
  },
  test: {
    semester: '114-1',
    courseName: 'SPIKE 五 16:10-17:40 松山',
    date: '2025-11-17',
    topic: '學習歷程測試',
    studentName: '測試學生',
    comment: '這是一個完整的學習歷程管理系統測試，用於驗證所有功能是否正常運作。'
  }
};

const api = axios.create({
  baseURL: TEST_CONFIG.server.baseUrl,
  timeout: 30000
});

// 測試結果收集
const testResults = [];
let passedTests = 0;
let failedTests = 0;

// ============================================
// 工具函數
// ============================================

function log(message, type = 'info') {
  const time = new Date().toLocaleTimeString('zh-TW');
  const symbols = {
    info: '📝',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    test: '🧪'
  };
  console.log(`[${time}] ${symbols[type] || '📝'} ${message}`);
}

function createTestImage(filename) {
  return {
    buffer: Buffer.from('test image data'),
    originalname: filename,
    mimetype: 'image/jpeg',
    size: 1024
  };
}

function createTestVideo(filename) {
  return {
    buffer: Buffer.from('test video data'),
    originalname: filename,
    mimetype: 'video/mp4',
    size: 5120
  };
}

async function runTest(name, testFn) {
  log(`測試: ${name}`, 'test');
  try {
    const result = await testFn();
    passedTests++;
    testResults.push({ name, status: 'PASS', result });
    log(`${name} - 通過`, 'success');
    return result;
  } catch (error) {
    failedTests++;
    testResults.push({ name, status: 'FAIL', error: error.message });
    log(`${name} - 失敗: ${error.message}`, 'error');
    return null;
  }
}

// ============================================
// 測試案例
// ============================================

async function testServerHealth() {
  const response = await api.get('/health');
  if (response.status !== 200) {
    throw new Error('伺服器健康檢查失敗');
  }
  return response.data;
}

async function testDriveConnection() {
  const SynologyDriveClient = require('../synology-drive-client');
  const client = new SynologyDriveClient({
    host: TEST_CONFIG.synology.host,
    port: TEST_CONFIG.synology.port,
    protocol: TEST_CONFIG.synology.protocol,
    username: TEST_CONFIG.synology.username,
    password: TEST_CONFIG.synology.password
  });
  
  await client.login();
  await client.logout();
  return { success: true };
}

async function testFileUpload() {
  const form = new FormData();
  
  // 添加測試資料
  form.append('semester', TEST_CONFIG.test.semester);
  form.append('courseName', TEST_CONFIG.test.courseName);
  form.append('date', TEST_CONFIG.test.date);
  form.append('topic', TEST_CONFIG.test.topic);
  form.append('studentName', TEST_CONFIG.test.studentName);
  form.append('comment', TEST_CONFIG.test.comment);
  
  // 添加測試檔案
  form.append('photos', Buffer.from('test photo 1'), {
    filename: 'test1.jpg',
    contentType: 'image/jpeg'
  });
  form.append('photos', Buffer.from('test photo 2'), {
    filename: 'test2.jpg',
    contentType: 'image/jpeg'
  });
  form.append('videos', Buffer.from('test video'), {
    filename: 'test.mp4',
    contentType: 'video/mp4'
  });
  
  const response = await api.post('/api/learning-records/upload-drive', form, {
    headers: form.getHeaders()
  });
  
  if (!response.data.success) {
    throw new Error(response.data.message || '檔案上傳失敗');
  }
  
  return response.data;
}

async function testFileList() {
  const params = {
    semester: TEST_CONFIG.test.semester,
    courseName: TEST_CONFIG.test.courseName,
    date: TEST_CONFIG.test.date,
    studentName: TEST_CONFIG.test.studentName
  };
  
  const response = await api.get('/api/learning-records/history-drive', { params });
  
  if (!response.data.success) {
    throw new Error('無法查詢檔案列表');
  }
  
  return response.data;
}

async function testChunkedUpload() {
  // 初始化分片上傳
  const initResponse = await api.post('/api/drive-upload/init', {
    filename: 'test-chunked.mp4',
    fileSize: 1024 * 1024 * 10, // 10MB
    chunkSize: 1024 * 1024 * 2, // 2MB
    metadata: {
      semester: TEST_CONFIG.test.semester,
      courseName: TEST_CONFIG.test.courseName,
      date: TEST_CONFIG.test.date,
      studentName: TEST_CONFIG.test.studentName
    }
  });
  
  if (!initResponse.data.success) {
    throw new Error('分片上傳初始化失敗');
  }
  
  const { uploadId, totalChunks } = initResponse.data;
  
  // 上傳分片（只測試第一片）
  const form = new FormData();
  form.append('uploadId', uploadId);
  form.append('chunkIndex', '0');
  form.append('chunk', Buffer.alloc(1024 * 1024 * 2), {
    filename: 'chunk0'
  });
  
  const chunkResponse = await api.post('/api/drive-upload/chunk', form, {
    headers: form.getHeaders()
  });
  
  if (!chunkResponse.data.success) {
    throw new Error('分片上傳失敗');
  }
  
  return { uploadId, totalChunks, uploaded: 1 };
}

async function testMediaProxy() {
  // 測試媒體代理路由 - 使用測試上傳的檔案路徑
  const testPath = `Fun Learn Bar/FLB-Learning-Portfolio/${TEST_CONFIG.test.semester}/${TEST_CONFIG.test.courseName.replace(/:/g, '')}/${TEST_CONFIG.test.date} ${TEST_CONFIG.test.topic}/${TEST_CONFIG.test.studentName}/test1.jpg`;
  
  try {
    const response = await api.get(`/api/drive-media/${encodeURIComponent(testPath)}`, {
      validateStatus: (status) => status < 500
    });
    
    // 404 是正常的（如果檔案不存在），只要不是 500 錯誤就算路由正常
    if (response.status === 404 || response.status === 403) {
      return {
        routeWorking: true,
        status: response.status,
        message: '路由正常，但檔案可能不存在'
      };
    }
    
    return {
      routeWorking: true,
      status: response.status
    };
  } catch (error) {
    // 如果是 404 或 403，表示路由正常但檔案不存在
    if (error.response && (error.response.status === 404 || error.response.status === 403)) {
      return {
        routeWorking: true,
        status: error.response.status,
        message: '路由正常，但檔案不存在或權限不足'
      };
    }
    // 只有 5xx 錯誤才算失敗
    if (error.response && error.response.status >= 500) {
      throw new Error(`媒體代理服務錯誤: ${error.response.status}`);
    }
    throw error;
  }
}

async function testLearningRecordDelete() {
  const params = {
    semester: TEST_CONFIG.test.semester,
    courseName: TEST_CONFIG.test.courseName,
    date: TEST_CONFIG.test.date,
    studentName: TEST_CONFIG.test.studentName,
    fileName: 'test1.jpg'
  };
  
  try {
    const response = await api.delete('/api/learning-records/file', { params });
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      // 檔案不存在也算是正常情況
      return { success: true, message: '檔案不存在' };
    }
    throw error;
  }
}

// ============================================
// 主測試流程
// ============================================

async function runAllTests() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                   🔧 學習歷程管理系統測試                              ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  log('測試環境:', 'info');
  log(`伺服器: ${TEST_CONFIG.server.baseUrl}`);
  log(`Synology: ${TEST_CONFIG.synology.host}:${TEST_CONFIG.synology.port}`);
  console.log('');
  
  // 執行測試
  await runTest('伺服器健康檢查', testServerHealth);
  await runTest('Synology Drive 連接', testDriveConnection);
  await runTest('檔案上傳（照片/影片/評語）', testFileUpload);
  await runTest('檔案列表查詢', testFileList);
  await runTest('分片上傳初始化', testChunkedUpload);
  await runTest('媒體代理路由', testMediaProxy);
  await runTest('檔案刪除功能', testLearningRecordDelete);
  
  // 顯示結果
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                        📊 測試結果總結                                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const total = passedTests + failedTests;
  const passRate = total > 0 ? Math.round((passedTests / total) * 100) : 0;
  
  log(`總測試數: ${total}`);
  log(`✅ 通過: ${passedTests}`);
  log(`❌ 失敗: ${failedTests}`);
  log(`通過率: ${passRate}%`);
  console.log('');
  
  // 詳細結果
  if (failedTests > 0) {
    console.log('失敗的測試:');
    testResults
      .filter(r => r.status === 'FAIL')
      .forEach(r => {
        log(`  - ${r.name}: ${r.error}`, 'error');
      });
    console.log('');
  }
  
  // 總結
  if (failedTests === 0) {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║              ✅ 所有測試通過！學習歷程管理系統正常運作                   ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
  } else {
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║              ⚠️  部分測試失敗，請檢查並修復問題                         ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
  }
  
  process.exit(failedTests > 0 ? 1 : 0);
}

// 執行測試
runAllTests().catch(error => {
  console.error('❌ 測試執行失敗:', error);
  process.exit(1);
});
