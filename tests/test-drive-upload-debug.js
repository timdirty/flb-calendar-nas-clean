/**
 * 🔍 診斷腳本：檢查為什麼檔案沒有上傳到 Drive
 * 只上傳了 record-meta.json
 */

const SynologyDriveClient = require('../synology-drive-client');
const DrivePathManager = require('../drive-path-manager');
const LearningUploadHelper = require('../learning-upload-helper');
const path = require('path');
const fs = require('fs');

// 載入環境變數
require('dotenv').config({ path: path.join(__dirname, '..', '.env.nas') });

// 創建測試圖片
function createTestImage(name = 'test.jpg') {
    // 最小的 JPEG 圖片 (1x1 紅色)
    const hexData = 'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00e3681ffd9';
    return {
        buffer: Buffer.from(hexData, 'hex'),
        name: name,
        originalname: name,
        mimetype: 'image/jpeg',
        size: 627
    };
}

async function testDriveUpload() {
    console.log('\n========================================');
    console.log('🔍 診斷 Drive 上傳問題');
    console.log('========================================\n');

    try {
        // 1. 初始化客戶端
        console.log('📋 步驟 1: 初始化 Drive 客戶端');
        const driveClient = new SynologyDriveClient({
            host: process.env.SYNOLOGY_HOST,
            username: process.env.SYNOLOGY_USERNAME,
            password: process.env.SYNOLOGY_PASSWORD,
            sessionName: 'DriveUploadDebug',
            driveRoot: process.env.SYNOLOGY_DRIVE_ROOT || '/Fun Learn Bar/FLB-Learning-Portfolio'
        });

        const pathManager = new DrivePathManager(process.env.SYNOLOGY_DRIVE_ROOT || '/Fun Learn Bar/FLB-Learning-Portfolio');
        
        const learningUploadHelper = new LearningUploadHelper(driveClient, pathManager);
        console.log('✅ 客戶端初始化成功\n');

        // 2. 測試登入
        console.log('📋 步驟 2: 測試 Drive 登入');
        await driveClient.ensureAuthenticated();
        console.log('✅ 登入成功，SID:', driveClient.sid ? driveClient.sid.substring(0, 8) + '****' : 'N/A');
        console.log('\n');

        // 3. 測試直接上傳檔案
        console.log('📋 步驟 3: 測試直接上傳單個檔案');
        const testPath = '/Fun Learn Bar/FLB-Learning-Portfolio/test-debug-' + Date.now() + '.txt';
        const testBuffer = Buffer.from('這是一個測試檔案 ' + new Date().toISOString(), 'utf-8');
        
        console.log('   上傳路徑:', testPath);
        console.log('   檔案大小:', testBuffer.length, 'bytes');
        
        try {
            const uploadResult = await driveClient.uploadFile(testBuffer, testPath, {
                contentType: 'text/plain',
                overwrite: true
            });
            console.log('✅ 直接上傳成功:', uploadResult);
        } catch (error) {
            console.error('❌ 直接上傳失敗:', error.message);
            console.error('   詳細錯誤:', error);
        }
        console.log('\n');

        // 4. 測試學生記錄上傳（含照片）
        console.log('📋 步驟 4: 測試學生記錄上傳');
        
        const testData = {
            semester: '114-1',
            courseName: 'DEBUG測試課程',
            date: '2025-11-17',
            topic: '除錯測試主題',
            studentName: '測試學生DEBUG',
            comment: '這是測試評語，用於診斷檔案上傳問題。檔案應該要被上傳到 Drive。'
        };

        // 準備測試照片
        const photo1 = createTestImage('debug-photo1.jpg');
        const photo2 = createTestImage('debug-photo2.jpg');

        console.log('   測試資料:');
        console.log('   - 學期:', testData.semester);
        console.log('   - 課程:', testData.courseName);
        console.log('   - 日期:', testData.date);
        console.log('   - 學生:', testData.studentName);
        console.log('   - 照片數:', 2);
        console.log('   - 照片1 buffer 大小:', photo1.buffer.length);
        console.log('   - 照片2 buffer 大小:', photo2.buffer.length);
        console.log('\n');

        console.log('🚀 開始上傳學生記錄...');
        
        try {
            const result = await learningUploadHelper.uploadStudentRecord({
                ...testData,
                photos: [photo1, photo2],
                videos: []
            });

            console.log('\n✅ 學生記錄上傳結果:');
            console.log('   - 成功:', result.success);
            console.log('   - 基礎路徑:', result.basePath);
            console.log('   - 照片數:', result.photos?.length || 0);
            console.log('   - 影片數:', result.videos?.length || 0);
            console.log('   - 元資料:', result.metadata ? '已建立' : '未建立');
            
            if (result.photos && result.photos.length > 0) {
                console.log('\n   📸 照片詳情:');
                result.photos.forEach((photo, i) => {
                    console.log(`     照片 ${i+1}:`);
                    console.log(`       - 檔名: ${photo.fileName}`);
                    console.log(`       - 路徑: ${photo.drivePath}`);
                    console.log(`       - 大小: ${photo.size} bytes`);
                });
            }

            console.log('\n');

            // 5. 檢查檔案是否真的存在
            console.log('📋 步驟 5: 驗證檔案是否真的上傳到 Drive');
            
            if (result.basePath) {
                console.log('   檢查路徑:', result.basePath);
                
                try {
                    const listResult = await driveClient.listFolder(result.basePath);
                    console.log('   📁 資料夾內容:');
                    
                    if (listResult.files && listResult.files.length > 0) {
                        listResult.files.forEach(file => {
                            console.log(`     - ${file.name} (${file.size} bytes)`);
                        });
                    } else {
                        console.log('     （資料夾是空的）');
                    }
                } catch (listError) {
                    console.error('   ❌ 無法列出資料夾內容:', listError.message);
                }
            }

        } catch (error) {
            console.error('\n❌ 學生記錄上傳失敗:');
            console.error('   錯誤訊息:', error.message);
            console.error('   錯誤堆疊:', error.stack);
        }

    } catch (error) {
        console.error('\n❌ 測試失敗:');
        console.error('   錯誤訊息:', error.message);
        console.error('   錯誤堆疊:', error.stack);
    }

    console.log('\n========================================');
    console.log('診斷完成');
    console.log('========================================\n');
}

// 執行測試
testDriveUpload().catch(console.error);
