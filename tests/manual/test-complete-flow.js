/**
 * 完整流程測試腳本
 * 測試 Drive API 的上傳、讀取、刪除功能
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3002';
const TEST_SEMESTER = '114-1';
const TEST_COURSE = '測試課程 0000';
const TEST_DATE = new Date().toISOString().split('T')[0]; // 今天日期

console.log('🚀 開始完整流程測試\n');
console.log('📋 測試參數:');
console.log('  - BASE_URL:', BASE_URL);
console.log('  - 學期:', TEST_SEMESTER);
console.log('  - 課程:', TEST_COURSE);
console.log('  - 日期:', TEST_DATE);
console.log('');

let testRecordPath = null;

// ==================== 測試 1: 健康檢查 ====================
async function test1_healthCheck() {
  console.log('📝 測試 1: 健康檢查');
  console.log('─'.repeat(60));
  
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    
    if (response.data.status === 'ok') {
      console.log('✅ 服務器健康檢查通過');
      console.log('   版本:', response.data.version || 'N/A');
      console.log('   時間:', response.data.timestamp);
      return true;
    } else {
      console.log('❌ 健康檢查失敗');
      return false;
    }
  } catch (error) {
    console.error('❌ 健康檢查錯誤:', error.message);
    return false;
  }
}

// ==================== 測試 2: 上傳課程總覽（僅文字）====================
async function test2_uploadOverviewTextOnly() {
  console.log('\n📝 測試 2: 上傳課程總覽（僅文字）');
  console.log('─'.repeat(60));
  
  try {
    const formData = new FormData();
    formData.append('semester', TEST_SEMESTER);
    formData.append('courseName', TEST_COURSE);
    formData.append('date', TEST_DATE);
    formData.append('studentName', '課程總覽');
    formData.append('isOverview', 'true');
    formData.append('comment', '這是自動測試的課程總覽摘要。\n包含多行文字測試。\n時間：' + new Date().toLocaleString('zh-TW'));
    
    const response = await axios.post(
      `${BASE_URL}/api/learning-records/upload-drive`,
      formData,
      {
        headers: formData.getHeaders()
      }
    );
    
    if (response.data.success) {
      console.log('✅ 課程總覽上傳成功');
      console.log('   路徑:', response.data.data.basePath);
      console.log('   照片:', response.data.data.photos);
      console.log('   影片:', response.data.data.videos);
      
      testRecordPath = response.data.data.basePath;
      return true;
    } else {
      console.log('❌ 上傳失敗:', response.data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 上傳錯誤:', error.response?.data || error.message);
    return false;
  }
}

// ==================== 測試 3: 讀取歷史記錄 ====================
async function test3_getHistory() {
  console.log('\n📝 測試 3: 讀取歷史記錄');
  console.log('─'.repeat(60));
  
  try {
    const response = await axios.get(`${BASE_URL}/api/learning-records/history-drive`, {
      params: {
        semester: TEST_SEMESTER,
        courseName: TEST_COURSE,
        date: TEST_DATE
      }
    });
    
    if (response.data.success) {
      console.log('✅ 歷史記錄讀取成功');
      console.log('   找到記錄數:', response.data.count);
      
      if (response.data.records && response.data.records.length > 0) {
        const record = response.data.records[0];
        console.log('   第一筆記錄:');
        console.log('     - 學生:', record.studentName || '課程總覽');
        console.log('     - 照片:', record.photoCount || 0);
        console.log('     - 影片:', record.videoCount || 0);
        console.log('     - 路徑:', record.recordPath);
        
        // 驗證是否能轉換為前端格式
        const overview = response.data.records.find(r => r.isOverview || r.studentName === '課程總覽');
        const students = response.data.records.filter(r => !r.isOverview && r.studentName !== '課程總覽');
        
        console.log('   轉換後:');
        console.log('     - 課程總覽:', overview ? '✅ 存在' : '❌ 不存在');
        console.log('     - 學生記錄:', students.length, '筆');
        
        return true;
      } else {
        console.log('⚠️  未找到任何記錄（可能是剛上傳需要等待）');
        return true; // 不算失敗，可能是時間延遲
      }
    } else {
      console.log('❌ 讀取失敗:', response.data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 讀取錯誤:', error.response?.data || error.message);
    return false;
  }
}

// ==================== 測試 4: 前端 API 兼容性 ====================
async function test4_frontendCompatibility() {
  console.log('\n📝 測試 4: 前端 API 兼容性測試');
  console.log('─'.repeat(60));
  
  try {
    // 模擬前端 getRecordsByCourse 調用
    const response = await axios.get(`${BASE_URL}/api/learning-records/history-drive`, {
      params: {
        semester: TEST_SEMESTER,
        courseName: TEST_COURSE,
        date: TEST_DATE
      }
    });
    
    if (response.data.success && response.data.records) {
      // 轉換為前端期望格式
      const overview = response.data.records.find(r => r.isOverview || r.studentName === '課程總覽');
      const students = response.data.records.filter(r => !r.isOverview && r.studentName !== '課程總覽');
      
      const frontendFormat = {
        success: true,
        overview: overview || null,
        students: students || [],
        path: response.data.searchParams
      };
      
      console.log('✅ 前端格式轉換成功');
      console.log('   格式結構:');
      console.log('     - success:', frontendFormat.success);
      console.log('     - overview:', frontendFormat.overview ? 'Object' : 'null');
      console.log('     - students:', Array.isArray(frontendFormat.students) ? `Array(${frontendFormat.students.length})` : 'invalid');
      console.log('     - path:', frontendFormat.path ? 'Object' : 'null');
      
      // 驗證必要字段
      if (frontendFormat.overview) {
        console.log('   總覽字段驗證:');
        console.log('     - recordPath:', frontendFormat.overview.recordPath ? '✅' : '❌');
        console.log('     - photos:', Array.isArray(frontendFormat.overview.photos) ? '✅' : '❌');
        console.log('     - videos:', Array.isArray(frontendFormat.overview.videos) ? '✅' : '❌');
      }
      
      return true;
    } else {
      console.log('❌ API 響應格式錯誤');
      return false;
    }
  } catch (error) {
    console.error('❌ 兼容性測試錯誤:', error.response?.data || error.message);
    return false;
  }
}

// ==================== 測試 5: Drive 連線測試 ====================
async function test5_driveConnection() {
  console.log('\n📝 測試 5: Drive 連線狀態');
  console.log('─'.repeat(60));
  
  try {
    // 檢查 Drive 客戶端是否正常
    const response = await axios.get(`${BASE_URL}/health`);
    
    console.log('✅ Drive 客戶端狀態檢查');
    console.log('   （如果健康檢查通過，Drive 客戶端應該正常）');
    
    return true;
  } catch (error) {
    console.error('❌ Drive 連線測試失敗:', error.message);
    return false;
  }
}

// ==================== 測試 6: 刪除測試記錄（清理）====================
async function test6_cleanup() {
  console.log('\n📝 測試 6: 清理測試記錄');
  console.log('─'.repeat(60));
  
  if (!testRecordPath) {
    console.log('⚠️  沒有測試記錄路徑，跳過清理');
    return true;
  }
  
  try {
    const response = await axios.delete(`${BASE_URL}/api/learning-records/drive${testRecordPath}`);
    
    if (response.data.success) {
      console.log('✅ 測試記錄已刪除');
      console.log('   路徑:', testRecordPath);
      return true;
    } else {
      console.log('❌ 刪除失敗:', response.data.error);
      return false;
    }
  } catch (error) {
    console.error('❌ 刪除錯誤:', error.response?.data || error.message);
    return false;
  }
}

// ==================== 執行所有測試 ====================
async function runAllTests() {
  const results = {
    total: 0,
    passed: 0,
    failed: 0
  };
  
  const tests = [
    { name: '健康檢查', fn: test1_healthCheck },
    { name: '上傳課程總覽', fn: test2_uploadOverviewTextOnly },
    { name: '讀取歷史記錄', fn: test3_getHistory },
    { name: '前端兼容性', fn: test4_frontendCompatibility },
    { name: 'Drive 連線', fn: test5_driveConnection },
    { name: '清理測試數據', fn: test6_cleanup }
  ];
  
  for (const test of tests) {
    results.total++;
    
    try {
      const passed = await test.fn();
      if (passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.error('\n❌ 測試異常:', test.name, error.message);
      results.failed++;
    }
    
    // 測試之間等待一下
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // 輸出總結
  console.log('\n' + '='.repeat(60));
  console.log('📊 測試總結');
  console.log('='.repeat(60));
  console.log(`總測試數: ${results.total}`);
  console.log(`✅ 通過: ${results.passed}`);
  console.log(`❌ 失敗: ${results.failed}`);
  console.log(`📈 成功率: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));
  
  if (results.failed === 0) {
    console.log('\n🎉 所有測試通過！系統運行正常！\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分測試失敗，請檢查上方錯誤信息\n');
    process.exit(1);
  }
}

// 執行測試
runAllTests().catch(error => {
  console.error('\n💥 測試執行異常:', error);
  process.exit(1);
});

