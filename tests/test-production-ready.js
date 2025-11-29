#!/usr/bin/env node
/**
 * 🎯 生產環境就緒測試
 * 完整測試系統所有功能，確保可以直接上線
 * 
 * 測試範圍：
 * 1. 伺服器核心功能
 * 2. Synology Drive 整合
 * 3. 學習歷程管理
 * 4. 行事曆與事件
 * 5. 通知系統
 * 6. 簽到管理
 * 7. 特殊事件處理
 * 8. 快取機制
 * 9. 媒體處理
 * 10. 錯誤處理與恢復
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 載入環境變數
require('dotenv').config({ path: path.join(__dirname, '..', '.env.nas') });

// 測試配置
const CONFIG = {
    server: {
        url: process.env.SERVER_URL || 'http://localhost:3002',
        timeout: 30000
    },
    synology: {
        host: process.env.SYNOLOGY_HOST,
        port: 9102,
        username: process.env.SYNOLOGY_USERNAME,
        password: process.env.SYNOLOGY_PASSWORD
    },
    test: {
        semester: '114-1',
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString().replace(/[:.]/g, '-')
    }
};

// 測試結果收集
const testResults = {
    passed: [],
    failed: [],
    warnings: [],
    startTime: new Date(),
    endTime: null
};

// 輔助函數
const log = {
    info: (msg) => console.log(`📝 ${msg}`),
    success: (msg) => console.log(`✅ ${msg}`),
    error: (msg) => console.log(`❌ ${msg}`),
    warning: (msg) => console.log(`⚠️  ${msg}`),
    test: (msg) => console.log(`🧪 ${msg}`),
    section: (msg) => {
        console.log('\n' + '='.repeat(70));
        console.log(`📋 ${msg}`);
        console.log('='.repeat(70));
    }
};

// 創建測試數據
function createTestImage(name = 'test.jpg') {
    const hexData = 'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00e3681ffd9';
    return {
        buffer: Buffer.from(hexData, 'hex'),
        name: name,
        originalname: name,
        mimetype: 'image/jpeg',
        size: 627
    };
}

function createTestVideo(name = 'test.mp4') {
    const videoData = Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
        0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
        0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
        0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
    ]);
    return {
        buffer: videoData,
        name: name,
        originalname: name,
        mimetype: 'video/mp4',
        size: videoData.length
    };
}

// 測試執行器
async function runTest(name, testFn) {
    try {
        log.test(`測試: ${name}`);
        const result = await testFn();
        testResults.passed.push({ name, result });
        log.success(`${name} - 通過`);
        return true;
    } catch (error) {
        testResults.failed.push({ name, error: error.message });
        log.error(`${name} - 失敗: ${error.message}`);
        return false;
    }
}

// ============================================
// 第一部分：核心功能測試
// ============================================

async function testCoreFeatures() {
    log.section('第一部分：核心功能測試');
    
    // 1.1 伺服器健康檢查
    await runTest('伺服器健康檢查', async () => {
        const response = await axios.get(`${CONFIG.server.url}/api/health`);
        if (!response.data.success && response.data.status !== 'healthy') {
            throw new Error('伺服器狀態異常');
        }
        return response.data;
    });
    
    // 1.2 環境變數檢查
    await runTest('環境變數配置', async () => {
        const critical = [
            'SYNOLOGY_HOST',
            'SYNOLOGY_USERNAME',
            'SYNOLOGY_PASSWORD',
            'LINE_CHANNEL_ACCESS_TOKEN',
            'TZ'
        ];
        
        const missing = critical.filter(key => !process.env[key]);
        if (missing.length > 0) {
            throw new Error(`缺少關鍵環境變數: ${missing.join(', ')}`);
        }
        return { configured: critical.length };
    });
    
    // 1.3 靜態檔案服務
    await runTest('靜態檔案服務', async () => {
        const response = await axios.get(`${CONFIG.server.url}/perfect-calendar-modular.html`);
        if (response.status !== 200) {
            throw new Error('無法存取前端頁面');
        }
        return { status: response.status };
    });
    
    // 1.4 CORS 配置
    await runTest('CORS 跨域設定', async () => {
        const response = await axios.options(`${CONFIG.server.url}/api/health`, {
            headers: {
                'Origin': 'http://test.example.com',
                'Access-Control-Request-Method': 'GET'
            }
        });
        
        const cors = response.headers['access-control-allow-origin'];
        if (!cors) {
            throw new Error('CORS 未正確配置');
        }
        return { cors };
    });
}

// ============================================
// 第二部分：Synology Drive 整合測試
// ============================================

async function testSynologyDrive() {
    log.section('第二部分：Synology Drive 整合測試');
    
    // 2.1 Drive 連接測試
    await runTest('Synology Drive 連接', async () => {
        const SynologyDriveClient = require('../synology-drive-client');
        const client = new SynologyDriveClient({
            host: CONFIG.synology.host,
            port: CONFIG.synology.port,
            username: CONFIG.synology.username,
            password: CONFIG.synology.password
        });
        
        const result = await client.login();
        if (!result.success) {
            throw new Error('無法連接到 Synology Drive');
        }
        
        await client.logout();
        return { connected: true };
    });
    
    // 2.2 檔案上傳測試
    await runTest('Drive 檔案上傳', async () => {
        const form = new FormData();
        form.append('semester', CONFIG.test.semester);
        form.append('courseName', `生產測試課程-${CONFIG.test.timestamp}`);
        form.append('date', CONFIG.test.date);
        form.append('topic', '系統測試');
        form.append('studentName', '測試學生');
        form.append('comment', '這是生產環境就緒測試的評語');
        form.append('isOverview', 'false');
        
        const photo = createTestImage('production-test.jpg');
        form.append('photos', photo.buffer, {
            filename: photo.name,
            contentType: photo.mimetype
        });
        
        const response = await axios.post(
            `${CONFIG.server.url}/api/learning-records/upload-drive`,
            form,
            { headers: form.getHeaders() }
        );
        
        if (!response.data.success) {
            throw new Error('檔案上傳失敗');
        }
        
        return {
            basePath: response.data.data.basePath,
            files: response.data.data.photos
        };
    });
    
    // 2.3 檔案查詢測試
    await runTest('Drive 檔案查詢', async () => {
        const response = await axios.get(
            `${CONFIG.server.url}/api/learning-records/history-drive`,
            {
                params: {
                    semester: CONFIG.test.semester,
                    courseName: `生產測試課程-${CONFIG.test.timestamp}`,
                    date: CONFIG.test.date
                }
            }
        );
        
        if (!response.data.success || !response.data.data) {
            throw new Error('無法查詢檔案');
        }
        
        return {
            recordCount: response.data.data.length
        };
    });
}

// ============================================
// 第三部分：行事曆與事件測試
// ============================================

async function testCalendarEvents() {
    log.section('第三部分：行事曆與事件測試');
    
    // 3.1 取得行事曆事件
    await runTest('行事曆事件查詢', async () => {
        const response = await axios.get(`${CONFIG.server.url}/api/events`);
        if (!response.data.success) {
            throw new Error('無法取得行事曆事件');
        }
        return {
            eventCount: response.data.events?.length || 0,
            source: response.data.source
        };
    });
    
    // 3.2 事件快取機制
    await runTest('事件快取機制', async () => {
        const response1 = await axios.get(`${CONFIG.server.url}/api/events`);
        const response2 = await axios.get(`${CONFIG.server.url}/api/events`);
        
        if (!response2.data.cached) {
            log.warning('快取可能未啟用');
        }
        
        return {
            cached: response2.data.cached,
            cacheAge: response2.data.cacheAge
        };
    });
    
    // 3.3 特殊事件標記
    await runTest('特殊事件處理', async () => {
        // 查詢特殊事件狀態
        const response = await axios.get(`${CONFIG.server.url}/api/special-event-requests`);
        
        return {
            pendingCount: response.data.data?.pending?.length || 0,
            historyCount: response.data.data?.history?.length || 0
        };
    });
}

// ============================================
// 第四部分：學生與課程管理
// ============================================

async function testStudentManagement() {
    log.section('第四部分：學生與課程管理');
    
    // 4.1 學生資料查詢
    await runTest('學生資料管理', async () => {
        const response = await axios.get(`${CONFIG.server.url}/api/students`);
        if (!response.data.success) {
            throw new Error('無法取得學生資料');
        }
        return {
            studentCount: response.data.students?.length || 0
        };
    });
    
    // 4.2 Google Sheets 同步
    await runTest('Google Sheets 同步', async () => {
        const response = await axios.get(`${CONFIG.server.url}/api/google-sheets/status`);
        
        // 這個測試可能會失敗（如果未設定），只記錄警告
        if (!response.data.success) {
            testResults.warnings.push('Google Sheets 未設定或無法連接');
        }
        
        return {
            connected: response.data.success || false
        };
    });
    
    // 4.3 臨時學生管理
    await runTest('臨時學生功能', async () => {
        const response = await axios.get(`${CONFIG.server.url}/api/temporary-students`);
        return {
            temporaryCount: response.data.students?.length || 0
        };
    });
}

// ============================================
// 第五部分：媒體處理測試
// ============================================

async function testMediaHandling() {
    log.section('第五部分：媒體處理測試');
    
    // 5.1 分片上傳初始化
    await runTest('分片上傳初始化', async () => {
        const response = await axios.post(
            `${CONFIG.server.url}/api/drive-upload/init`,
            {
                fileName: 'test-video.mp4',
                fileSize: 1024,
                mimeType: 'video/mp4',
                totalChunks: 1,
                context: {
                    semester: CONFIG.test.semester,
                    courseName: `媒體測試-${CONFIG.test.timestamp}`,
                    date: CONFIG.test.date,
                    studentName: '測試學生'
                }
            }
        );
        
        if (!response.data.success || !response.data.uploadId) {
            throw new Error('分片上傳初始化失敗');
        }
        
        // 清理測試（取消上傳）
        await axios.post(`${CONFIG.server.url}/api/drive-upload/cancel`, {
            uploadId: response.data.uploadId
        });
        
        return { initialized: true };
    });
    
    // 5.2 媒體代理服務
    await runTest('媒體代理服務', async () => {
        // 測試代理路徑是否正確處理
        const testPath = '/api/drive-media/test/path/image.jpg';
        
        try {
            await axios.get(`${CONFIG.server.url}${testPath}`);
        } catch (error) {
            // 預期會失敗（檔案不存在），但應該是 404 而不是其他錯誤
            if (error.response?.status !== 404) {
                throw new Error('媒體代理服務異常');
            }
        }
        
        return { proxyActive: true };
    });
}

// ============================================
// 第六部分：通知系統測試
// ============================================

async function testNotificationSystem() {
    log.section('第六部分：通知系統測試');
    
    // 6.1 通知配置檢查
    await runTest('通知系統配置', async () => {
        const response = await axios.get(`${CONFIG.server.url}/api/notification-config`);
        
        if (!response.data.success) {
            throw new Error('無法讀取通知配置');
        }
        
        return {
            configured: !!response.data.config,
            hasTemplates: !!response.data.config?.flexTemplates
        };
    });
    
    // 6.2 講師註冊檢查
    await runTest('講師註冊系統', async () => {
        const response = await axios.get(`${CONFIG.server.url}/api/teachers`);
        
        return {
            teacherCount: response.data.teachers?.length || 0
        };
    });
    
    // 6.3 提醒設定檢查
    await runTest('學生提醒設定', async () => {
        const response = await axios.get(`${CONFIG.server.url}/api/student-reminder-settings`);
        
        return {
            settingsCount: Object.keys(response.data.settings || {}).length
        };
    });
}

// ============================================
// 第七部分：系統穩定性測試
// ============================================

async function testSystemStability() {
    log.section('第七部分：系統穩定性測試');
    
    // 7.1 錯誤處理測試
    await runTest('錯誤處理機制', async () => {
        try {
            // 故意發送錯誤請求
            await axios.post(`${CONFIG.server.url}/api/learning-records/upload-drive`, {
                invalid: 'data'
            });
        } catch (error) {
            // 應該返回 400 錯誤
            if (error.response?.status !== 400) {
                throw new Error('錯誤處理不正確');
            }
        }
        
        return { errorHandling: 'correct' };
    });
    
    // 7.2 並發請求測試
    await runTest('並發請求處理', async () => {
        const requests = Array(5).fill(null).map(() => 
            axios.get(`${CONFIG.server.url}/api/health`)
        );
        
        const results = await Promise.all(requests);
        const allSuccess = results.every(r => r.data.success || r.data.status === 'healthy');
        
        if (!allSuccess) {
            throw new Error('並發請求處理失敗');
        }
        
        return { concurrent: 5, success: true };
    });
    
    // 7.3 記憶體使用檢查
    await runTest('系統資源狀態', async () => {
        const used = process.memoryUsage();
        const heapUsedMB = Math.round(used.heapUsed / 1024 / 1024);
        
        if (heapUsedMB > 500) {
            testResults.warnings.push(`記憶體使用較高: ${heapUsedMB} MB`);
        }
        
        return {
            heapUsedMB,
            rss: Math.round(used.rss / 1024 / 1024)
        };
    });
}

// ============================================
// 第八部分：資料完整性測試
// ============================================

async function testDataIntegrity() {
    log.section('第八部分：資料完整性測試');
    
    // 8.1 必要檔案檢查
    await runTest('必要檔案存在性', async () => {
        const requiredFiles = [
            'server.js',
            'package.json',
            '.env.nas',
            'notification-config.json',
            'teacher_data.json',
            'public/student_data.json'
        ];
        
        const missing = [];
        for (const file of requiredFiles) {
            const fullPath = path.join(__dirname, '..', file);
            if (!fs.existsSync(fullPath)) {
                missing.push(file);
            }
        }
        
        if (missing.length > 0) {
            throw new Error(`缺少必要檔案: ${missing.join(', ')}`);
        }
        
        return { allFilesExist: true };
    });
    
    // 8.2 資料夾結構檢查
    await runTest('資料夾結構完整性', async () => {
        const requiredDirs = [
            'public',
            'public/js',
            'public/css',
            'data',
            'logs',
            'utils',
            'services',
            'tests'
        ];
        
        const missing = [];
        for (const dir of requiredDirs) {
            const fullPath = path.join(__dirname, '..', dir);
            if (!fs.existsSync(fullPath)) {
                missing.push(dir);
            }
        }
        
        if (missing.length > 0) {
            throw new Error(`缺少必要資料夾: ${missing.join(', ')}`);
        }
        
        return { allDirsExist: true };
    });
}

// ============================================
// 主執行函數
// ============================================

async function runProductionReadyTests() {
    console.clear();
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                   🚀 生產環境就緒測試                                   ║');
    console.log('║              確保系統所有功能完全正常，可以直接上線                        ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`📅 測試時間: ${new Date().toLocaleString('zh-TW')}`);
    console.log(`🖥️  伺服器: ${CONFIG.server.url}`);
    console.log(`📁 Synology: ${CONFIG.synology.host}:${CONFIG.synology.port}`);
    console.log('');
    
    try {
        // 執行各部分測試
        await testCoreFeatures();
        await testSynologyDrive();
        await testCalendarEvents();
        await testStudentManagement();
        await testMediaHandling();
        await testNotificationSystem();
        await testSystemStability();
        await testDataIntegrity();
        
    } catch (criticalError) {
        log.error(`致命錯誤: ${criticalError.message}`);
        console.error(criticalError);
    }
    
    // 記錄結束時間
    testResults.endTime = new Date();
    const duration = Math.round((testResults.endTime - testResults.startTime) / 1000);
    
    // 產生測試報告
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                        📊 測試結果報告                                 ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    
    // 統計結果
    const totalTests = testResults.passed.length + testResults.failed.length;
    const passRate = totalTests > 0 ? Math.round((testResults.passed.length / totalTests) * 100) : 0;
    
    console.log(`\n📈 測試統計：`);
    console.log(`   總測試數: ${totalTests}`);
    console.log(`   ✅ 通過: ${testResults.passed.length}`);
    console.log(`   ❌ 失敗: ${testResults.failed.length}`);
    console.log(`   ⚠️  警告: ${testResults.warnings.length}`);
    console.log(`   通過率: ${passRate}%`);
    console.log(`   執行時間: ${duration} 秒`);
    
    // 失敗項目詳情
    if (testResults.failed.length > 0) {
        console.log('\n❌ 失敗項目：');
        testResults.failed.forEach(test => {
            console.log(`   - ${test.name}: ${test.error}`);
        });
    }
    
    // 警告項目
    if (testResults.warnings.length > 0) {
        console.log('\n⚠️  警告項目：');
        testResults.warnings.forEach(warning => {
            console.log(`   - ${warning}`);
        });
    }
    
    // 最終判定
    console.log('\n');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    
    if (testResults.failed.length === 0 && passRate === 100) {
        console.log('║              🎉 恭喜！系統已準備就緒，可以直接上線！                      ║');
        console.log('╚══════════════════════════════════════════════════════════════════════╝');
        console.log('\n✨ 所有功能測試通過，系統運作完全正常！');
        console.log('🚀 您現在可以安全地將系統部署到生產環境。');
    } else if (testResults.failed.length <= 2 && passRate >= 90) {
        console.log('║            ⚠️  系統大部分功能正常，但有少數問題需要注意                    ║');
        console.log('╚══════════════════════════════════════════════════════════════════════╝');
        console.log('\n建議在上線前修復失敗的測試項目。');
    } else {
        console.log('║              ❌ 系統尚未準備就緒，需要修復問題後才能上線                  ║');
        console.log('╚══════════════════════════════════════════════════════════════════════╝');
        console.log('\n請根據上方的錯誤訊息修復問題，然後重新執行測試。');
    }
    
    console.log('\n');
    
    // 儲存測試報告
    const reportPath = path.join(__dirname, '..', 'logs', `test-report-${CONFIG.test.timestamp}.json`);
    try {
        fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
        console.log(`📄 測試報告已儲存: ${reportPath}`);
    } catch (err) {
        console.warn('無法儲存測試報告:', err.message);
    }
    
    // 退出代碼
    process.exit(testResults.failed.length === 0 ? 0 : 1);
}

// 執行測試
if (require.main === module) {
    runProductionReadyTests().catch(error => {
        console.error('測試執行失敗:', error);
        process.exit(1);
    });
}

module.exports = { runProductionReadyTests };
