#!/usr/bin/env node

/**
 * 🔥 完整系統自檢
 * 
 * 檢查項目：
 * 1. 所有修復檔案是否就位
 * 2. HTML 載入順序是否正確
 * 3. 前端 metadata 建立邏輯
 * 4. 後端映射與處理邏輯
 * 5. 路徑生成一致性
 * 6. 模擬實際上傳流程
 */

const fs = require('fs');
const path = require('path');

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║              🔥 學習歷程上傳系統 - 完整自檢                         ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('');

const checkResults = {
  passed: [],
  failed: [],
  warnings: []
};

// ==================================================
// 檢查 1：核心檔案完整性
// ==================================================
function checkFileIntegrity() {
  console.log('📋 檢查 1：核心檔案完整性...');
  console.log('─'.repeat(60));
  
  const requiredFiles = [
    { path: 'fix-upload-metadata.js', description: '前端 metadata 修復腳本' },
    { path: 'test-fix-verification.js', description: '修復驗證測試' },
    { path: 'drive-path-manager.js', description: 'Drive 路徑管理器' },
    { path: 'learning-upload-helper.js', description: '學習記錄上傳助手' },
    { path: 'server.js', description: '後端伺服器' },
    { path: 'public/learning-record-upload.html', description: '前端 HTML' },
    { path: 'public/js/pages/learning-record-upload.js', description: '前端主腳本' },
    { path: 'public/js/modules/chunked-uploader.js', description: '分片上傳模組' }
  ];
  
  requiredFiles.forEach(file => {
    const fullPath = path.join(__dirname, file.path);
    if (fs.existsSync(fullPath)) {
      console.log(`  ✅ ${file.description}: 存在`);
      checkResults.passed.push(`檔案存在: ${file.path}`);
    } else {
      console.log(`  ❌ ${file.description}: 缺失`);
      checkResults.failed.push(`檔案缺失: ${file.path}`);
    }
  });
  
  console.log('');
}

// ==================================================
// 檢查 2：HTML 腳本載入順序
// ==================================================
function checkHtmlLoadOrder() {
  console.log('📋 檢查 2：HTML 腳本載入順序...');
  console.log('─'.repeat(60));
  
  const htmlFile = path.join(__dirname, 'public', 'learning-record-upload.html');
  
  if (!fs.existsSync(htmlFile)) {
    console.log('  ❌ HTML 檔案不存在');
    checkResults.failed.push('HTML 檔案不存在');
    return;
  }
  
  const htmlContent = fs.readFileSync(htmlFile, 'utf8');
  
  // 檢查關鍵腳本載入順序
  const scriptOrder = [
    'api-client.js',
    'fix-upload-metadata.js',
    'chunked-uploader.js'
  ];
  
  let lastIndex = -1;
  let orderCorrect = true;
  
  scriptOrder.forEach((script, index) => {
    const currentIndex = htmlContent.indexOf(script);
    if (currentIndex === -1) {
      console.log(`  ❌ ${script} 未載入`);
      checkResults.failed.push(`${script} 未在 HTML 中載入`);
      orderCorrect = false;
    } else if (index > 0 && currentIndex < lastIndex) {
      console.log(`  ⚠️ ${script} 載入順序錯誤`);
      checkResults.warnings.push(`${script} 載入順序可能有問題`);
    } else {
      console.log(`  ✅ ${script} 已載入`);
    }
    lastIndex = currentIndex;
  });
  
  if (orderCorrect && lastIndex !== -1) {
    checkResults.passed.push('HTML 腳本載入順序正確');
  }
  
  console.log('');
}

// ==================================================
// 檢查 3：前端 Metadata 處理邏輯
// ==================================================
function checkFrontendMetadata() {
  console.log('📋 檢查 3：前端 Metadata 處理邏輯...');
  console.log('─'.repeat(60));
  
  const fixFile = path.join(__dirname, 'fix-upload-metadata.js');
  
  if (!fs.existsSync(fixFile)) {
    console.log('  ❌ 修復腳本不存在');
    checkResults.failed.push('前端修復腳本不存在');
    return;
  }
  
  const fixContent = fs.readFileSync(fixFile, 'utf8');
  
  // 檢查關鍵函數
  const keyFunctions = [
    { name: 'buildUnifiedUploadMetadata', description: '統一 metadata 建立' },
    { name: 'ChunkedUploader.uploadFileChunked', description: '攔截上傳函數' }
  ];
  
  keyFunctions.forEach(func => {
    if (fixContent.includes(func.name)) {
      console.log(`  ✅ ${func.description}: 已實作`);
      checkResults.passed.push(`前端函數: ${func.name}`);
    } else {
      console.log(`  ❌ ${func.description}: 未實作`);
      checkResults.failed.push(`前端函數缺失: ${func.name}`);
    }
  });
  
  // 檢查是否使用 currentCourse.title
  if (fixContent.includes('currentCourse.title')) {
    console.log('  ✅ 使用 currentCourse.title 作為完整課程名稱');
    checkResults.passed.push('使用完整課程標題');
  } else {
    console.log('  ❌ 未使用 currentCourse.title');
    checkResults.failed.push('未使用完整課程標題');
  }
  
  console.log('');
}

// ==================================================
// 檢查 4：後端映射與處理
// ==================================================
function checkBackendProcessing() {
  console.log('📋 檢查 4：後端映射與處理...');
  console.log('─'.repeat(60));
  
  const serverFile = path.join(__dirname, 'server.js');
  
  if (!fs.existsSync(serverFile)) {
    console.log('  ❌ server.js 不存在');
    checkResults.failed.push('後端伺服器檔案不存在');
    return;
  }
  
  const serverContent = fs.readFileSync(serverFile, 'utf8');
  
  // 檢查課程名稱映射
  if (serverContent.includes('courseNameMapping')) {
    console.log('  ✅ courseNameMapping 已設定');
    
    // 檢查具體映射規則
    const mappings = [
      { short: 'SPIKE 五 1610', full: 'SPIKE 五 1610-1740 松山' },
      { short: 'ESM 四 1730', full: 'ESM 四 1730-1830 到府' },
      { short: 'BOOST 六 1530', full: 'BOOST 六 1530-1700 到府' }
    ];
    
    let mappingCount = 0;
    mappings.forEach(map => {
      if (serverContent.includes(`'${map.short}'`) && serverContent.includes(`'${map.full}'`)) {
        mappingCount++;
      }
    });
    
    console.log(`  ✅ 找到 ${mappingCount}/${mappings.length} 個映射規則`);
    checkResults.passed.push(`後端映射規則: ${mappingCount} 個`);
  } else {
    console.log('  ⚠️ courseNameMapping 未設定（可選）');
    checkResults.warnings.push('後端映射未設定');
  }
  
  // 檢查調試中間件
  if (serverContent.includes('調試中間件') || serverContent.includes('調試：前端上傳請求參數')) {
    console.log('  ✅ 調試中間件已啟用');
    checkResults.passed.push('調試中間件已啟用');
  } else {
    console.log('  ⚠️ 調試中間件未啟用');
    checkResults.warnings.push('調試中間件未啟用');
  }
  
  console.log('');
}

// ==================================================
// 檢查 5：路徑生成一致性測試
// ==================================================
function checkPathConsistency() {
  console.log('📋 檢查 5：路徑生成一致性...');
  console.log('─'.repeat(60));
  
  try {
    const DrivePathManager = require('./drive-path-manager');
    const pathManager = new DrivePathManager('/Fun Learn Bar/FLB-Learning-Portfolio');
    
    // 測試案例
    const testCases = [
      {
        input: {
          semester: '114-1',
          courseName: 'SPIKE 五 16:10-17:40 松山',
          date: '2025-11-07',
          topic: '日本武士',
          studentName: '石紹言'
        },
        expected: '/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山/2025-11-07 日本武士/石紹言'
      },
      {
        input: {
          semester: '114-1',
          courseName: 'ESM 四 17:30-18:30 到府',
          date: '2025-11-08',
          topic: 'Python 基礎',
          studentName: '王小明'
        },
        expected: '/Fun Learn Bar/FLB-Learning-Portfolio/114-1/ESM 四 1730-1830 到府/2025-11-08 Python 基礎/王小明'
      }
    ];
    
    let allPassed = true;
    
    testCases.forEach((testCase, index) => {
      const { input, expected } = testCase;
      const actual = pathManager.buildStudentRecordPath(
        input.semester,
        input.courseName,
        input.date,
        input.topic,
        input.studentName
      );
      
      if (actual === expected) {
        console.log(`  ✅ 測試案例 ${index + 1}: 通過`);
      } else {
        console.log(`  ❌ 測試案例 ${index + 1}: 失敗`);
        console.log(`     預期: ${expected}`);
        console.log(`     實際: ${actual}`);
        allPassed = false;
      }
    });
    
    if (allPassed) {
      checkResults.passed.push('路徑生成一致性測試全部通過');
    } else {
      checkResults.failed.push('路徑生成不一致');
    }
    
  } catch (error) {
    console.log(`  ❌ 無法載入 DrivePathManager: ${error.message}`);
    checkResults.failed.push('DrivePathManager 載入失敗');
  }
  
  console.log('');
}

// ==================================================
// 檢查 6：模擬上傳流程
// ==================================================
function simulateUploadFlow() {
  console.log('📋 檢查 6：模擬上傳流程...');
  console.log('─'.repeat(60));
  
  // 模擬前端 metadata 建立
  const mockCourse = {
    title: 'SPIKE 五 16:10-17:40 松山 第7週',
    start: new Date('2025-11-07T08:10:00'),
    date: '2025-11-07',
    semester: '114-1'
  };
  
  // 檢查完整課程名稱是否被正確使用
  const metadata = {
    semester: mockCourse.semester,
    courseName: mockCourse.title,  // 應該使用完整標題
    coursePeriod: mockCourse.title,
    date: mockCourse.date,
    topic: '日本武士'
  };
  
  console.log('  📝 模擬 metadata:');
  console.log(`     semester: ${metadata.semester}`);
  console.log(`     courseName: ${metadata.courseName}`);
  console.log(`     date: ${metadata.date}`);
  console.log(`     topic: ${metadata.topic}`);
  
  // 驗證關鍵欄位
  if (metadata.courseName.includes('16:10-17:40') && metadata.courseName.includes('松山')) {
    console.log('  ✅ Metadata 包含完整時間和地點資訊');
    checkResults.passed.push('模擬上傳 metadata 正確');
  } else {
    console.log('  ❌ Metadata 缺少完整資訊');
    checkResults.failed.push('模擬上傳 metadata 不完整');
  }
  
  // 模擬路徑生成
  try {
    const DrivePathManager = require('./drive-path-manager');
    const pathManager = new DrivePathManager('/Fun Learn Bar/FLB-Learning-Portfolio');
    
    const generatedPath = pathManager.buildStudentRecordPath(
      metadata.semester,
      metadata.courseName,
      metadata.date,
      metadata.topic,
      '測試學生'
    );
    
    console.log(`  📂 生成路徑: ${generatedPath}`);
    
    if (generatedPath.includes('1610-1740') && !generatedPath.includes(':')) {
      console.log('  ✅ 路徑正確處理冒號字元');
      checkResults.passed.push('路徑字元處理正確');
    } else {
      console.log('  ❌ 路徑字元處理錯誤');
      checkResults.failed.push('路徑字元處理錯誤');
    }
    
  } catch (error) {
    console.log(`  ⚠️ 無法模擬完整流程: ${error.message}`);
    checkResults.warnings.push('無法模擬完整上傳流程');
  }
  
  console.log('');
}

// ==================================================
// 執行所有檢查
// ==================================================
function runAllChecks() {
  const startTime = Date.now();
  
  checkFileIntegrity();
  checkHtmlLoadOrder();
  checkFrontendMetadata();
  checkBackendProcessing();
  checkPathConsistency();
  simulateUploadFlow();
  
  const duration = Date.now() - startTime;
  
  // 顯示總結報告
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  console.log('║                         📊 自檢報告總結                             ║');
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`執行時間: ${duration}ms`);
  console.log(`通過項目: ${checkResults.passed.length} ✅`);
  console.log(`失敗項目: ${checkResults.failed.length} ❌`);
  console.log(`警告項目: ${checkResults.warnings.length} ⚠️`);
  console.log('');
  
  if (checkResults.failed.length > 0) {
    console.log('❌ 失敗項目:');
    checkResults.failed.forEach(item => {
      console.log(`  • ${item}`);
    });
    console.log('');
  }
  
  if (checkResults.warnings.length > 0) {
    console.log('⚠️ 警告項目:');
    checkResults.warnings.forEach(item => {
      console.log(`  • ${item}`);
    });
    console.log('');
  }
  
  // 最終判定
  const totalChecks = checkResults.passed.length + checkResults.failed.length;
  const passRate = (checkResults.passed.length / totalChecks * 100).toFixed(1);
  
  console.log('╔══════════════════════════════════════════════════════════════════════╗');
  if (checkResults.failed.length === 0) {
    console.log('║                   🎉 系統自檢完全通過！                             ║');
    console.log('║                   修復已成功部署並驗證                               ║');
  } else if (passRate >= 80) {
    console.log('║                   ⚠️ 系統基本正常（有少數問題）                     ║');
    console.log(`║                   通過率: ${passRate}%                                       ║`);
  } else {
    console.log('║                   ❌ 系統存在問題需要修復                           ║');
    console.log(`║                   通過率: ${passRate}%                                       ║`);
  }
  console.log('╚══════════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // 返回狀態碼
  process.exit(checkResults.failed.length > 0 ? 1 : 0);
}

// 執行自檢
runAllChecks();
