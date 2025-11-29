#!/usr/bin/env node

/**
 * 測試上傳統計 API 功能
 * 驗證路由修復後 API 端點是否正常工作
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// 測試用例
const testCases = [
  {
    name: '測試 1: SPIKE 五 16:10-17:40 松山',
    path: '/api/v2/courses/upload-stats?date=2025-01-19&courseName=SPIKE%20五%2016:10-17:40%20松山'
  },
  {
    name: '測試 2: SPM 三 16:30-17:30 到府',
    path: '/api/v2/courses/upload-stats?date=2025-01-14&courseName=SPM%20三%2016:30-17:30%20到府'
  },
  {
    name: '測試 3: 缺少參數（應返回 400）',
    path: '/api/v2/courses/upload-stats?date=2025-01-19',
    expectError: true
  }
];

/**
 * 執行 HTTP GET 請求
 */
function makeRequest(path) {
  return new Promise((resolve, reject) => {
    const url = BASE_URL + path;
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: json });
        } catch (error) {
          reject(new Error(`JSON 解析失敗: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * 執行所有測試
 */
async function runTests() {
  console.log('🧪 開始測試上傳統計 API\n');
  console.log('='.repeat(60));
  
  let passedCount = 0;
  let failedCount = 0;
  
  for (const testCase of testCases) {
    console.log(`\n📋 ${testCase.name}`);
    console.log(`   路徑: ${testCase.path}`);
    
    try {
      const result = await makeRequest(testCase.path);
      
      if (testCase.expectError) {
        // 預期錯誤的測試
        if (result.statusCode >= 400) {
          console.log(`   ✅ 通過 - 返回預期的錯誤狀態碼 ${result.statusCode}`);
          console.log(`   錯誤訊息: ${result.data.error}`);
          passedCount++;
        } else {
          console.log(`   ❌ 失敗 - 應返回錯誤但狀態碼為 ${result.statusCode}`);
          failedCount++;
        }
      } else {
        // 預期成功的測試
        if (result.statusCode === 200 && result.data.success) {
          console.log(`   ✅ 通過 - 返回狀態碼 ${result.statusCode}`);
          console.log(`   統計資料:`);
          console.log(`     - 課程名稱: ${result.data.data.courseName}`);
          console.log(`     - 日期: ${result.data.data.date}`);
          console.log(`     - 學生總數: ${result.data.data.studentCount}`);
          console.log(`     - 已上傳學生: ${result.data.data.uploadedStudentCount}`);
          console.log(`     - 上傳檔案數: ${result.data.data.totalUploadedFiles}`);
          console.log(`     - 總覽已上傳: ${result.data.data.overviewUploaded}`);
          console.log(`     - 上傳百分比: ${result.data.data.uploadPercentage}%`);
          passedCount++;
        } else {
          console.log(`   ❌ 失敗 - 狀態碼 ${result.statusCode}`);
          console.log(`   回應: ${JSON.stringify(result.data, null, 2)}`);
          failedCount++;
        }
      }
    } catch (error) {
      console.log(`   ❌ 失敗 - ${error.message}`);
      failedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 測試結果總結:`);
  console.log(`   ✅ 通過: ${passedCount}`);
  console.log(`   ❌ 失敗: ${failedCount}`);
  console.log(`   📈 通過率: ${((passedCount / testCases.length) * 100).toFixed(1)}%`);
  
  if (failedCount === 0) {
    console.log('\n🎉 所有測試通過！');
    process.exit(0);
  } else {
    console.log('\n⚠️  部分測試失敗，請檢查日誌');
    process.exit(1);
  }
}

// 執行測試
runTests().catch((error) => {
  console.error('測試執行失敗:', error);
  process.exit(1);
});
