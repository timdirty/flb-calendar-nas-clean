/**
 * 🔍 完整自檢驗證腳本
 * 使用正確的端口 9102 進行 Synology Drive 連接測試
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// 載入環境變數
require('dotenv').config({ path: path.join(__dirname, '..', '.env.nas') });

// 載入模組
const SynologyDriveClient = require('../synology-drive-client');
const DrivePathManager = require('../drive-path-manager');
const LearningUploadHelper = require('../learning-upload-helper');

// ============================================
// 測試配置
// ============================================
const TEST_CONFIG = {
  synology: {
    host: process.env.SYNOLOGY_HOST || 'funlearnbar.synology.me',
    port: 9102,  // 🔥 正確的端口
    protocol: 'https',
    username: process.env.SYNOLOGY_USERNAME,
    password: process.env.SYNOLOGY_PASSWORD,
    driveRoot: process.env.SYNOLOGY_DRIVE_ROOT || '/Fun Learn Bar/FLB-Learning-Portfolio'
  },
  server: {
    url: 'http://localhost:3002'
  },
  test: {
    semester: '114-1',
    courseName: 'VALIDATION測試課程',
    date: '2025-11-17',
    topic: '完整驗證主題',
    studentName: '驗證測試學生',
    comment: '這是完整驗證測試的評語，用於確認系統所有功能都正常運作。包含照片上傳、影片上傳、元資料建立等。'
  }
};

// ============================================
// 輔助函數
// ============================================
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('zh-TW');
  const prefix = {
    info: '📝',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    test: '🧪'
  }[type] || '📝';
  
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function createTestImage(name = 'test.jpg', size = 627) {
  // 最小的 JPEG 圖片 (1x1 紅色)
  const hexData = 'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00e3681ffd9';
  return {
    buffer: Buffer.from(hexData, 'hex'),
    name: name,
    originalname: name,
    mimetype: 'image/jpeg',
    size: size
  };
}

function createTestVideo(name = 'test.mp4') {
  // 最小的有效 MP4 檔案結構
  const mp4Header = Buffer.from([
    0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
    0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
  ]);
  return {
    buffer: mp4Header,
    name: name,
    originalname: name,
    mimetype: 'video/mp4',
    size: mp4Header.length
  };
}

// ============================================
// 測試步驟
// ============================================

/**
 * 步驟 1: 測試 Synology Drive 連接
 */
async function testDriveConnection() {
  log('步驟 1: 測試 Synology Drive 連接', 'test');
  
  try {
    // 測試 HTTPS 連接到端口 9102
    const testUrl = `https://${TEST_CONFIG.synology.host}:${TEST_CONFIG.synology.port}/webapi/entry.cgi`;
    log(`測試連接: ${testUrl}`);
    
    const response = await axios.get(testUrl, {
      timeout: 10000,
      httpsAgent: new (require('https').Agent)({
        rejectUnauthorized: false
      })
    });
    
    log('Synology Drive API 端點可訪問', 'success');
    log(`回應狀態: ${response.status}`);
    return true;
  } catch (error) {
    log(`無法連接到 Synology Drive: ${error.message}`, 'error');
    if (error.code === 'ECONNREFUSED') {
      log('請檢查:', 'warning');
      log('1. DSM 是否正在運行', 'warning');
      log('2. 端口 9102 是否已開放', 'warning');
      log('3. 防火牆設定是否正確', 'warning');
    }
    return false;
  }
}

/**
 * 步驟 2: 測試 Synology Drive 登入
 */
async function testDriveLogin() {
  log('步驟 2: 測試 Synology Drive 登入', 'test');
  
  try {
    const driveClient = new SynologyDriveClient({
      host: TEST_CONFIG.synology.host,
      port: TEST_CONFIG.synology.port,
      protocol: TEST_CONFIG.synology.protocol,
      username: TEST_CONFIG.synology.username,
      password: TEST_CONFIG.synology.password
    });
    
    log('嘗試登入...');
    const loginResult = await driveClient.login();
    
    if (loginResult.success) {
      log('登入成功！', 'success');
      log(`SID: ${loginResult.sid.substring(0, 8)}****`);
      
      // 登出
      await driveClient.logout();
      log('登出成功', 'success');
      
      return true;
    } else {
      log('登入失敗', 'error');
      return false;
    }
  } catch (error) {
    log(`登入測試失敗: ${error.message}`, 'error');
    return false;
  }
}

/**
 * 步驟 3: 測試檔案上傳到 Drive
 */
async function testFileUpload() {
  log('步驟 3: 測試檔案上傳到 Drive', 'test');
  
  try {
    // 初始化客戶端
    const driveClient = new SynologyDriveClient({
      host: TEST_CONFIG.synology.host,
      port: TEST_CONFIG.synology.port,
      protocol: TEST_CONFIG.synology.protocol,
      username: TEST_CONFIG.synology.username,
      password: TEST_CONFIG.synology.password
    });
    
    const pathManager = new DrivePathManager(TEST_CONFIG.synology.driveRoot);
    const uploadHelper = new LearningUploadHelper(driveClient, pathManager);
    
    // 準備測試資料
    const testData = {
      ...TEST_CONFIG.test,
      photos: [
        createTestImage('validation-photo1.jpg'),
        createTestImage('validation-photo2.jpg'),
        createTestImage('validation-photo3.jpg')
      ],
      videos: [
        createTestVideo('validation-video1.mp4')
      ]
    };
    
    log(`上傳 ${testData.photos.length} 張照片, ${testData.videos.length} 個影片`);
    
    // 執行上傳
    const result = await uploadHelper.uploadStudentRecord(testData);
    
    if (result.success) {
      log('檔案上傳成功！', 'success');
      log(`基礎路徑: ${result.basePath}`);
      log(`照片上傳: ${result.photos.length} 張`);
      log(`影片上傳: ${result.videos.length} 個`);
      log(`評語: ${result.comment ? '已儲存' : '未儲存'}`);
      log(`元資料: ${result.metadata ? '已建立' : '未建立'}`);
      
      return {
        success: true,
        basePath: result.basePath,
        uploadedFiles: {
          photos: result.photos.length,
          videos: result.videos.length,
          comment: !!result.comment,
          metadata: !!result.metadata
        }
      };
    } else {
      log('檔案上傳失敗', 'error');
      return { success: false };
    }
  } catch (error) {
    log(`檔案上傳測試失敗: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * 步驟 4: 測試從 Drive 讀取檔案列表
 */
async function testFileList(basePath) {
  log('步驟 4: 測試從 Drive 讀取檔案列表', 'test');
  
  if (!basePath) {
    log('沒有基礎路徑，跳過檔案列表測試', 'warning');
    return { success: false, reason: '沒有基礎路徑' };
  }
  
  try {
    const driveClient = new SynologyDriveClient({
      host: TEST_CONFIG.synology.host,
      port: TEST_CONFIG.synology.port,
      protocol: TEST_CONFIG.synology.protocol,
      username: TEST_CONFIG.synology.username,
      password: TEST_CONFIG.synology.password
    });
    
    await driveClient.ensureAuthenticated();
    
    log(`列出資料夾內容: ${basePath}`);
    const listResult = await driveClient.listFolder(basePath);
    
    if (listResult.files && listResult.files.length > 0) {
      log(`找到 ${listResult.files.length} 個檔案:`, 'success');
      listResult.files.forEach(file => {
        log(`  - ${file.name} (${file.size} bytes)`);
      });
      
      // 檢查預期的檔案
      const expectedFiles = [
        'validation-photo1.jpg',
        'validation-photo2.jpg', 
        'validation-photo3.jpg',
        'validation-video1.mp4',
        'comment.txt',
        'record-meta.json',
        'photos-meta.json',
        'videos-meta.json'
      ];
      
      const foundFiles = listResult.files.map(f => f.name);
      const missingFiles = expectedFiles.filter(f => 
        !foundFiles.some(found => found.includes(f.replace('validation-', '').replace('.jpg', '').replace('.mp4', '')))
      );
      
      if (missingFiles.length > 0) {
        log(`缺少預期檔案: ${missingFiles.join(', ')}`, 'warning');
      } else {
        log('所有預期檔案都存在！', 'success');
      }
      
      return {
        success: true,
        fileCount: listResult.files.length,
        files: foundFiles,
        missingFiles
      };
    } else {
      log('資料夾是空的或無法讀取', 'warning');
      return { success: false, fileCount: 0 };
    }
  } catch (error) {
    log(`檔案列表測試失敗: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * 步驟 5: 測試本地伺服器 API
 */
async function testServerAPI() {
  log('步驟 5: 測試本地伺服器 API', 'test');
  
  try {
    // 檢查健康狀態
    const healthResponse = await axios.get(`${TEST_CONFIG.server.url}/api/health`);
    log('伺服器健康檢查通過', 'success');
    
    // 測試上傳 API
    const form = new FormData();
    Object.keys(TEST_CONFIG.test).forEach(key => {
      form.append(key, TEST_CONFIG.test[key]);
    });
    form.append('isOverview', 'false');
    
    const photo = createTestImage('api-test-photo.jpg');
    form.append('photos', photo.buffer, {
      filename: photo.name,
      contentType: photo.mimetype
    });
    
    const uploadResponse = await axios.post(
      `${TEST_CONFIG.server.url}/api/learning-records/upload-drive`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 30000
      }
    );
    
    if (uploadResponse.data.success) {
      log('API 上傳測試成功', 'success');
      
      // 測試查詢 API
      const historyResponse = await axios.get(
        `${TEST_CONFIG.server.url}/api/learning-records/history-drive`,
        {
          params: {
            semester: TEST_CONFIG.test.semester,
            courseName: TEST_CONFIG.test.courseName,
            date: TEST_CONFIG.test.date
          }
        }
      );
      
      if (historyResponse.data.success) {
        log('API 查詢測試成功', 'success');
        log(`找到 ${historyResponse.data.data?.length || 0} 筆記錄`);
      }
      
      return { success: true };
    } else {
      log('API 上傳失敗', 'error');
      return { success: false };
    }
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log('本地伺服器未啟動', 'warning');
      log('請執行: npm run dev', 'warning');
    } else {
      log(`API 測試失敗: ${error.message}`, 'error');
    }
    return { success: false, error: error.message };
  }
}

// ============================================
// 主測試函數
// ============================================
async function runCompleteValidation() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         🔍 Synology Drive 完整自檢驗證                        ║');
  console.log('║         使用端口: 9102                                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log('');
  
  const results = {
    connection: false,
    login: false,
    upload: false,
    fileList: false,
    serverAPI: false
  };
  
  try {
    // 步驟 1: 測試連接
    results.connection = await testDriveConnection();
    if (!results.connection) {
      log('連接失敗，無法繼續測試', 'error');
      printSummary(results);
      return;
    }
    
    console.log('');
    
    // 步驟 2: 測試登入
    results.login = await testDriveLogin();
    if (!results.login) {
      log('登入失敗，無法繼續測試', 'error');
      printSummary(results);
      return;
    }
    
    console.log('');
    
    // 步驟 3: 測試檔案上傳
    const uploadResult = await testFileUpload();
    results.upload = uploadResult.success;
    
    console.log('');
    
    // 步驟 4: 測試檔案列表
    if (uploadResult.basePath) {
      const listResult = await testFileList(uploadResult.basePath);
      results.fileList = listResult.success;
    }
    
    console.log('');
    
    // 步驟 5: 測試伺服器 API
    results.serverAPI = await testServerAPI();
    
  } catch (error) {
    log(`測試過程發生錯誤: ${error.message}`, 'error');
    console.error(error);
  }
  
  console.log('');
  printSummary(results);
}

/**
 * 打印測試摘要
 */
function printSummary(results) {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                      📊 測試結果摘要                          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  const tests = [
    { name: 'Drive 連接 (9102)', result: results.connection },
    { name: 'Drive 登入', result: results.login },
    { name: '檔案上傳', result: results.upload },
    { name: '檔案列表', result: results.fileList },
    { name: '伺服器 API', result: results.serverAPI }
  ];
  
  tests.forEach(test => {
    const status = test.result ? '✅ 通過' : '❌ 失敗';
    console.log(`  ${test.name}: ${status}`);
  });
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.values(results).length;
  const allPassed = passed === total;
  
  console.log('');
  console.log(`總計: ${passed}/${total} 通過`);
  
  if (allPassed) {
    console.log('');
    console.log('🎉 所有測試通過！系統運作正常。');
  } else {
    console.log('');
    console.log('⚠️ 有測試失敗，請檢查上方錯誤訊息。');
  }
  
  console.log('');
}

// ============================================
// 執行測試
// ============================================
runCompleteValidation().catch(console.error);
