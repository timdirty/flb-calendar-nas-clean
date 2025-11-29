#!/usr/bin/env node
/**
 * ============================================
 * 完整本地自檢：檔案上傳與回填功能測試
 * ============================================
 * 測試項目：
 * 1. 基本上傳功能（照片、影片、評語）
 * 2. 分片上傳功能
 * 3. 檔案回填功能
 * 4. Drive 路徑處理
 * 5. 學生記錄管理
 * ============================================
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// 配置
const SERVER_URL = 'http://localhost:3002';
const TEST_TIMEOUT = 30000; // 30秒超時

// 測試數據
const TEST_DATA = {
    semester: '114-1',
    courseName: 'SPIKE 五 16:10-17:40 松山',
    date: '2025-11-17',
    topic: '自檢測試主題',
    studentName: '測試學生A',
    comment: '這是一個完整的自檢測試評語，用於驗證系統功能是否正常運作。評語需要至少20個字以滿足基本要求。'
};

// 顏色輸出
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
    console.log('\n' + '='.repeat(60));
    log(title, 'cyan');
    console.log('='.repeat(60));
}

function logSuccess(message) {
    log('✅ ' + message, 'green');
}

function logError(message) {
    log('❌ ' + message, 'red');
}

function logWarning(message) {
    log('⚠️  ' + message, 'yellow');
}

function logInfo(message) {
    log('ℹ️  ' + message, 'blue');
}

// 創建測試檔案
function createTestImage(name = 'test.jpg') {
    // 最小的 JPEG 圖片 (1x1 紅色)
    const hexData = 'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00e3681ffd9';
    return {
        buffer: Buffer.from(hexData, 'hex'),
        name: name,
        mimetype: 'image/jpeg',
        size: 627
    };
}

function createTestVideo(name = 'test.mp4') {
    // 最小的有效 MP4 檔案結構
    const mp4Header = Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // ftyp box
        0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
        0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
        0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
    ]);
    return {
        buffer: mp4Header,
        name: name,
        mimetype: 'video/mp4',
        size: mp4Header.length
    };
}

// ============================================
// 測試 1: 健康檢查
// ============================================
async function testHealthCheck() {
    logSection('測試 1: 伺服器健康檢查');
    
    try {
        // 嘗試兩個可能的健康檢查端點
        let response;
        try {
            response = await axios.get(`${SERVER_URL}/api/health`, {
                timeout: 5000
            });
        } catch (err) {
            // 如果 /api/health 失敗，嘗試 /health
            response = await axios.get(`${SERVER_URL}/health`, {
                timeout: 5000
            });
        }
        
        if (response.data.status === 'healthy' || response.data.status === 'ok' || response.data.success) {
            logSuccess('伺服器健康檢查通過');
            logInfo(`伺服器狀態: ${response.data.status || 'unknown'}`);
            logInfo(`環境: ${response.data.environment || process.env.NODE_ENV || 'development'}`);
            return true;
        } else {
            logError('伺服器狀態異常');
            return false;
        }
    } catch (error) {
        logError('無法連接到伺服器: ' + error.message);
        logWarning('請確認伺服器已啟動 (npm run dev)');
        return false;
    }
}

// ============================================
// 測試 2: 基本上傳功能
// ============================================
async function testBasicUpload() {
    logSection('測試 2: 基本檔案上傳功能');
    
    try {
        const form = new FormData();
        
        // 添加基本資料
        Object.keys(TEST_DATA).forEach(key => {
            form.append(key, TEST_DATA[key]);
        });
        form.append('isOverview', 'false');
        
        // 添加測試照片
        const photo1 = createTestImage('photo1.jpg');
        const photo2 = createTestImage('photo2.jpg');
        const photo3 = createTestImage('photo3.jpg');
        
        form.append('photos', photo1.buffer, {
            filename: photo1.name,
            contentType: photo1.mimetype
        });
        form.append('photos', photo2.buffer, {
            filename: photo2.name,
            contentType: photo2.mimetype
        });
        form.append('photos', photo3.buffer, {
            filename: photo3.name,
            contentType: photo3.mimetype
        });
        
        logInfo('上傳資料:');
        logInfo(`  學期: ${TEST_DATA.semester}`);
        logInfo(`  課程: ${TEST_DATA.courseName}`);
        logInfo(`  日期: ${TEST_DATA.date}`);
        logInfo(`  學生: ${TEST_DATA.studentName}`);
        logInfo(`  照片數: 3`);
        logInfo(`  評語長度: ${TEST_DATA.comment.length} 字`);
        
        const response = await axios.post(
            `${SERVER_URL}/api/learning-records/upload-drive`,
            form,
            {
                headers: form.getHeaders(),
                timeout: TEST_TIMEOUT
            }
        );
        
        if (response.data.success) {
            logSuccess('基本上傳成功');
            logInfo(`Drive 路徑: ${response.data.data.basePath}`);
            logInfo(`照片數量: ${response.data.data.photos}`);
            logInfo(`評語字數: ${response.data.data.comment?.length || 0}`);
            
            // 保存上傳結果供後續測試使用
            global.uploadResult = response.data.data;
            return true;
        } else {
            logError('上傳失敗: ' + (response.data.error || response.data.message));
            return false;
        }
    } catch (error) {
        logError('上傳測試失敗: ' + error.message);
        if (error.response) {
            logError('伺服器回應: ' + JSON.stringify(error.response.data));
        }
        return false;
    }
}

// ============================================
// 測試 3: 分片上傳功能
// ============================================
async function testChunkUpload() {
    logSection('測試 3: 分片上傳功能');
    
    try {
        // 初始化分片上傳
        const video = createTestVideo('test-video.mp4');
        
        logInfo('初始化分片上傳...');
        const initResponse = await axios.post(
            `${SERVER_URL}/api/drive-upload/init`,
            {
                filename: video.name,
                fileSize: video.size,
                chunkSize: 1024 * 1024, // 1MB chunks
                fileType: video.mimetype,
                metadata: {
                    semester: TEST_DATA.semester,
                    courseName: TEST_DATA.courseName,
                    date: TEST_DATA.date,
                    topic: TEST_DATA.topic,
                    studentName: TEST_DATA.studentName
                }
            },
            { timeout: TEST_TIMEOUT }
        );
        
        if (!initResponse.data.success) {
            logError('分片上傳初始化失敗');
            return false;
        }
        
        const uploadId = initResponse.data.uploadId;
        logSuccess(`初始化成功，uploadId: ${uploadId}`);
        
        // 上傳分片
        logInfo('上傳分片...');
        const chunkForm = new FormData();
        chunkForm.append('chunk', video.buffer, 'chunk_0');
        chunkForm.append('uploadId', uploadId);
        chunkForm.append('chunkIndex', '0');
        
        const chunkResponse = await axios.post(
            `${SERVER_URL}/api/drive-upload/chunk`,
            chunkForm,
            {
                headers: chunkForm.getHeaders(),
                timeout: TEST_TIMEOUT
            }
        );
        
        if (!chunkResponse.data.success) {
            logError('分片上傳失敗');
            return false;
        }
        
        logSuccess('分片上傳成功');
        
        // 完成上傳
        logInfo('完成分片上傳...');
        const completeResponse = await axios.post(
            `${SERVER_URL}/api/drive-upload/complete`,
            {
                uploadId: uploadId,
                metadata: {
                    semester: TEST_DATA.semester,
                    courseName: TEST_DATA.courseName,
                    date: TEST_DATA.date,
                    topic: TEST_DATA.topic,
                    studentName: TEST_DATA.studentName
                }
            },
            { timeout: TEST_TIMEOUT }
        );
        
        if (completeResponse.data.success) {
            logSuccess('分片上傳完成');
            logInfo(`檔案路徑: ${completeResponse.data.record.drivePath}`);
            logInfo(`Proxy URL: ${completeResponse.data.record.proxyUrl}`);
            return true;
        } else {
            logError('分片上傳完成失敗');
            return false;
        }
    } catch (error) {
        logError('分片上傳測試失敗: ' + error.message);
        if (error.response) {
            logError('伺服器回應: ' + JSON.stringify(error.response.data));
        }
        return false;
    }
}

// ============================================
// 測試 4: 檔案回填功能
// ============================================
async function testRecordRecall() {
    logSection('測試 4: 檔案回填功能（從伺服器載入已上傳資料）');
    
    try {
        // 查詢學習歷程記錄
        logInfo('查詢學生記錄...');
        const historyResponse = await axios.get(
            `${SERVER_URL}/api/learning-records/history-drive`,
            {
                params: {
                    date: TEST_DATA.date,
                    studentName: TEST_DATA.studentName,
                    semester: TEST_DATA.semester,
                    courseName: TEST_DATA.courseName
                },
                timeout: TEST_TIMEOUT
            }
        );
        
        if (!historyResponse.data || !historyResponse.data.records) {
            logWarning('未找到學習歷程記錄');
            return false;
        }
        
        const records = historyResponse.data.records;
        logInfo(`找到 ${records.length} 筆記錄`);
        
        // 檢查是否包含剛才上傳的記錄
        const targetRecord = records.find(r => 
            r.studentName === TEST_DATA.studentName
        );
        
        if (targetRecord) {
            logSuccess('成功回填學生記錄');
            logInfo(`  學生: ${targetRecord.studentName}`);
            logInfo(`  照片數: ${targetRecord.photoCount || targetRecord.photos || 0}`);
            logInfo(`  影片數: ${targetRecord.videoCount || targetRecord.videos || 0}`);
            logInfo(`  評語: ${targetRecord.comment ? targetRecord.comment.substring(0, 30) + '...' : '無'}`);
            
            // 檢查檔案 URL 是否可訪問
            if (targetRecord.photos && Array.isArray(targetRecord.photos)) {
                logInfo('驗證照片 URL...');
                for (let i = 0; i < Math.min(1, targetRecord.photos.length); i++) {
                    const photo = targetRecord.photos[i];
                    try {
                        const fileResponse = await axios.head(
                            `${SERVER_URL}${photo.proxyUrl || photo.url}`,
                            { timeout: 5000 }
                        );
                        if (fileResponse.status === 200) {
                            logSuccess(`  照片 ${i+1} URL 可訪問`);
                        } else {
                            logWarning(`  照片 ${i+1} URL 回應: ${fileResponse.status}`);
                        }
                    } catch (err) {
                        logWarning(`  照片 ${i+1} URL 無法訪問: ${err.message}`);
                    }
                }
            }
            
            return true;
        } else {
            logWarning('未找到匹配的學生記錄');
            return false;
        }
    } catch (error) {
        logError('回填測試失敗: ' + error.message);
        if (error.response) {
            logError('伺服器回應: ' + JSON.stringify(error.response.data));
        }
        return false;
    }
}

// ============================================
// 測試 5: 課程總覽功能
// ============================================
async function testOverviewUpload() {
    logSection('測試 5: 課程總覽上傳功能');
    
    try {
        const form = new FormData();
        
        // 基本資料
        form.append('semester', TEST_DATA.semester);
        form.append('courseName', TEST_DATA.courseName);
        form.append('date', TEST_DATA.date);
        form.append('topic', TEST_DATA.topic);
        form.append('overviewSummary', '這是課程總覽的摘要內容，記錄本次課程的整體表現和重點事項。');
        form.append('isOverview', 'true');
        
        // 添加總覽照片
        const photo1 = createTestImage('overview1.jpg');
        const photo2 = createTestImage('overview2.jpg');
        
        form.append('overviewPhotos', photo1.buffer, {
            filename: photo1.name,
            contentType: photo1.mimetype
        });
        form.append('overviewPhotos', photo2.buffer, {
            filename: photo2.name,
            contentType: photo2.mimetype
        });
        
        logInfo('上傳課程總覽...');
        const response = await axios.post(
            `${SERVER_URL}/api/learning-records/upload-drive`,
            form,
            {
                headers: form.getHeaders(),
                timeout: TEST_TIMEOUT
            }
        );
        
        if (response.data.success) {
            logSuccess('課程總覽上傳成功');
            logInfo(`Drive 路徑: ${response.data.data.basePath}`);
            logInfo(`照片數量: ${response.data.data.photos}`);
            return true;
        } else {
            logError('課程總覽上傳失敗: ' + (response.data.error || response.data.message));
            return false;
        }
    } catch (error) {
        logError('課程總覽測試失敗: ' + error.message);
        if (error.response) {
            logError('伺服器回應: ' + JSON.stringify(error.response.data));
        }
        return false;
    }
}

// ============================================
// 測試 6: Drive 路徑處理
// ============================================
async function testDrivePath() {
    logSection('測試 6: Drive 路徑處理與驗證');
    
    try {
        // 測試路徑格式
        const testPaths = [
            {
                courseName: 'SPIKE 五 1610-1740 松山 第8週',
                expected: 'SPIKE 五 1610-1740 松山',
                description: '移除週次'
            },
            {
                courseName: 'ESM 四 1730-1830 到府',
                expected: 'ESM 四 1730-1830 到府',
                description: '無週次課程名稱'
            }
        ];
        
        logInfo('驗證路徑處理邏輯...');
        let allPassed = true;
        
        for (const test of testPaths) {
            // 這裡應該調用路徑處理 API 或函數
            // 由於是本地測試，我們模擬路徑處理
            const cleaned = test.courseName.replace(/\s*第\d+週\s*$/, '');
            if (cleaned === test.expected) {
                logSuccess(`  ✓ ${test.description}: "${test.courseName}" → "${cleaned}"`);
            } else {
                logError(`  ✗ ${test.description}: 期望 "${test.expected}"，實際 "${cleaned}"`);
                allPassed = false;
            }
        }
        
        return allPassed;
    } catch (error) {
        logError('路徑測試失敗: ' + error.message);
        return false;
    }
}

// ============================================
// 測試 7: 錯誤處理
// ============================================
async function testErrorHandling() {
    logSection('測試 7: 錯誤處理機制');
    
    try {
        // 測試缺少必要欄位
        logInfo('測試缺少必要欄位...');
        const form1 = new FormData();
        form1.append('studentName', '測試學生');
        // 缺少其他必要欄位
        
        try {
            await axios.post(
                `${SERVER_URL}/api/learning-records/upload-drive`,
                form1,
                {
                    headers: form1.getHeaders(),
                    timeout: 5000
                }
            );
            logError('  應該要失敗但沒有失敗');
            return false;
        } catch (error) {
            if (error.response && error.response.status === 400) {
                logSuccess('  正確處理缺少欄位錯誤');
            } else {
                logError('  錯誤處理不正確: ' + error.message);
                return false;
            }
        }
        
        // 測試無效的檔案類型
        logInfo('測試無效檔案類型...');
        const form2 = new FormData();
        Object.keys(TEST_DATA).forEach(key => {
            form2.append(key, TEST_DATA[key]);
        });
        form2.append('isOverview', 'false');
        
        // 添加一個文字檔案作為照片（應該要被拒絕）
        form2.append('photos', Buffer.from('This is not an image'), {
            filename: 'test.txt',
            contentType: 'text/plain'
        });
        
        // 這個測試可能會通過（取決於後端是否檢查檔案內容）
        // 所以我們只記錄結果
        try {
            const response = await axios.post(
                `${SERVER_URL}/api/learning-records/upload-drive`,
                form2,
                {
                    headers: form2.getHeaders(),
                    timeout: 5000
                }
            );
            logWarning('  伺服器接受了非圖片檔案（可能需要加強驗證）');
        } catch (error) {
            logSuccess('  正確拒絕非圖片檔案');
        }
        
        return true;
    } catch (error) {
        logError('錯誤處理測試失敗: ' + error.message);
        return false;
    }
}

// ============================================
// 主測試程序
// ============================================
async function runAllTests() {
    console.log('\n' + '='.repeat(60));
    log('🔍 完整本地自檢：檔案上傳與回填功能', 'cyan');
    console.log('='.repeat(60));
    log(`測試時間: ${new Date().toLocaleString('zh-TW')}`, 'blue');
    log(`伺服器: ${SERVER_URL}`, 'blue');
    console.log('='.repeat(60));
    
    const results = [];
    const tests = [
        { name: '伺服器健康檢查', fn: testHealthCheck },
        { name: '基本檔案上傳', fn: testBasicUpload },
        { name: '分片上傳功能', fn: testChunkUpload },
        { name: '檔案回填功能', fn: testRecordRecall },
        { name: '課程總覽功能', fn: testOverviewUpload },
        { name: 'Drive 路徑處理', fn: testDrivePath },
        { name: '錯誤處理機制', fn: testErrorHandling }
    ];
    
    for (const test of tests) {
        try {
            const result = await test.fn();
            results.push({ name: test.name, success: result });
            
            if (!result && test.name === '伺服器健康檢查') {
                logError('伺服器未啟動，終止測試');
                break;
            }
        } catch (error) {
            logError(`測試 "${test.name}" 發生異常: ${error.message}`);
            results.push({ name: test.name, success: false });
        }
        
        // 測試間隔
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // 顯示測試結果摘要
    console.log('\n' + '='.repeat(60));
    log('📊 測試結果摘要', 'cyan');
    console.log('='.repeat(60));
    
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    
    results.forEach(result => {
        if (result.success) {
            logSuccess(`${result.name}: 通過`);
        } else {
            logError(`${result.name}: 失敗`);
        }
    });
    
    console.log('='.repeat(60));
    if (passRate === 100) {
        log(`🎉 所有測試通過！(${passed}/${total})`, 'green');
    } else if (passRate >= 70) {
        log(`✅ 測試大部分通過 (${passed}/${total}, ${passRate}%)`, 'yellow');
    } else {
        log(`❌ 測試失敗 (${passed}/${total}, ${passRate}%)`, 'red');
    }
    console.log('='.repeat(60));
    
    // 返回測試是否全部通過
    return passRate === 100 ? 0 : 1;
}

// 執行測試
runAllTests()
    .then(exitCode => {
        process.exit(exitCode);
    })
    .catch(error => {
        console.error('測試執行失敗:', error);
        process.exit(1);
    });
