/**
 * 測試腳本：模擬上傳流程，追蹤為什麼檔案沒有真正上傳
 */

const path = require('path');
const fs = require('fs');

// Mock Synology Drive Client - 追蹤所有呼叫
class MockDriveClient {
    constructor() {
        this.uploadedFiles = [];
        this.createdFolders = [];
        console.log('🔧 [Mock] DriveClient 已建立');
    }
    
    async ensureFolderExists(folderPath) {
        console.log('📁 [Mock] ensureFolderExists 被呼叫:', folderPath);
        this.createdFolders.push(folderPath);
        return { success: true };
    }
    
    async uploadFile(fileSource, remotePath, options = {}) {
        const isBuffer = Buffer.isBuffer(fileSource);
        const fileSize = isBuffer ? fileSource.length : 'unknown';
        
        console.log('📤 [Mock] uploadFile 被呼叫:');
        console.log('   - 遠端路徑:', remotePath);
        console.log('   - 檔案類型:', isBuffer ? 'Buffer' : typeof fileSource);
        console.log('   - 檔案大小:', fileSize);
        console.log('   - Content-Type:', options.contentType);
        console.log('   - Overwrite:', options.overwrite);
        
        this.uploadedFiles.push({
            path: remotePath,
            isBuffer,
            size: fileSize,
            contentType: options.contentType
        });
        
        // 模擬成功回應
        return {
            success: true,
            path: remotePath,
            data: {}
        };
    }
    
    async listFolder(folderPath) {
        console.log('📂 [Mock] listFolder 被呼叫:', folderPath);
        return { files: [] };
    }
}

// 載入真實的模組
const DrivePathManager = require('../drive-path-manager');
const LearningUploadHelper = require('../learning-upload-helper');

// 創建測試圖片
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

async function testMockUpload() {
    console.log('\n========================================');
    console.log('🔍 模擬測試：追蹤上傳流程');
    console.log('========================================\n');
    
    try {
        // 1. 初始化
        console.log('📋 步驟 1: 初始化模組');
        const mockDriveClient = new MockDriveClient();
        const pathManager = new DrivePathManager('/Fun Learn Bar/FLB-Learning-Portfolio');
        const uploadHelper = new LearningUploadHelper(mockDriveClient, pathManager);
        console.log('✅ 模組初始化完成\n');
        
        // 2. 準備測試資料
        console.log('📋 步驟 2: 準備測試資料');
        const testData = {
            semester: '114-1',
            courseName: 'MOCK測試課程',
            date: '2025-11-17',
            topic: 'Mock測試主題',
            studentName: 'Mock測試學生',
            comment: '這是Mock測試評語，用於追蹤上傳流程。我們要確認每個檔案都被正確上傳。'
        };
        
        const photo1 = createTestImage('mock-photo1.jpg');
        const photo2 = createTestImage('mock-photo2.jpg');
        const photo3 = createTestImage('mock-photo3.jpg');
        
        console.log('   測試資料準備完成');
        console.log('   - 照片數: 3');
        console.log('   - 每張大小: 627 bytes\n');
        
        // 3. 執行上傳
        console.log('📋 步驟 3: 執行上傳');
        console.log('🚀 呼叫 uploadStudentRecord...\n');
        
        const result = await uploadHelper.uploadStudentRecord({
            ...testData,
            photos: [photo1, photo2, photo3],
            videos: []
        });
        
        console.log('\n✅ 上傳完成，結果:');
        console.log('   - 成功:', result.success);
        console.log('   - 基礎路徑:', result.basePath);
        console.log('   - 照片數:', result.photos?.length || 0);
        console.log('   - 影片數:', result.videos?.length || 0);
        console.log('   - 評語:', result.comment ? '已儲存' : '未儲存');
        console.log('   - 元資料:', result.metadata ? '已建立' : '未建立');
        
        // 4. 分析 Mock 記錄
        console.log('\n📋 步驟 4: 分析 Mock DriveClient 呼叫記錄');
        console.log('   📁 建立的資料夾數:', mockDriveClient.createdFolders.length);
        console.log('   📤 上傳的檔案數:', mockDriveClient.uploadedFiles.length);
        
        if (mockDriveClient.createdFolders.length > 0) {
            console.log('\n   建立的資料夾:');
            mockDriveClient.createdFolders.forEach((folder, i) => {
                console.log(`     ${i+1}. ${folder}`);
            });
        }
        
        if (mockDriveClient.uploadedFiles.length > 0) {
            console.log('\n   上傳的檔案:');
            mockDriveClient.uploadedFiles.forEach((file, i) => {
                console.log(`     ${i+1}. ${path.basename(file.path)}`);
                console.log(`        - 路徑: ${file.path}`);
                console.log(`        - 類型: ${file.contentType}`);
                console.log(`        - 大小: ${file.size} bytes`);
            });
        }
        
        // 5. 檢查問題
        console.log('\n📋 步驟 5: 診斷分析');
        
        const expectedFiles = 5; // 3 photos + 1 comment + 1 record-meta
        const actualFiles = mockDriveClient.uploadedFiles.length;
        
        if (actualFiles < expectedFiles) {
            console.log(`   ⚠️ 警告: 預期上傳 ${expectedFiles} 個檔案，實際上傳 ${actualFiles} 個`);
            
            // 檢查哪些檔案沒有上傳
            const uploadedPaths = mockDriveClient.uploadedFiles.map(f => path.basename(f.path));
            const hasPhotos = uploadedPaths.filter(p => p.includes('photo')).length;
            const hasComment = uploadedPaths.some(p => p.includes('comment'));
            const hasMeta = uploadedPaths.some(p => p.includes('meta'));
            
            console.log(`   - 照片: ${hasPhotos}/3`);
            console.log(`   - 評語: ${hasComment ? '✓' : '✗'}`);
            console.log(`   - 元資料: ${hasMeta ? '✓' : '✗'}`);
            
            if (hasPhotos === 0) {
                console.log('\n   ❌ 問題: 沒有任何照片被上傳！');
                console.log('   可能原因:');
                console.log('   1. uploadFile 方法沒有被正確呼叫');
                console.log('   2. 照片 buffer 處理有問題');
                console.log('   3. 上傳邏輯被跳過');
            }
        } else {
            console.log(`   ✅ 所有檔案都已上傳 (${actualFiles}/${expectedFiles})`);
        }
        
        // 6. 檢查實際的 photos-meta.json 和 videos-meta.json
        const photosMetaFile = mockDriveClient.uploadedFiles.find(f => f.path.includes('photos-meta.json'));
        const videosMetaFile = mockDriveClient.uploadedFiles.find(f => f.path.includes('videos-meta.json'));
        
        if (photosMetaFile || videosMetaFile) {
            console.log('\n   🆕 新媒體系統檔案:');
            if (photosMetaFile) console.log('     - photos-meta.json ✓');
            if (videosMetaFile) console.log('     - videos-meta.json ✓');
        }
        
    } catch (error) {
        console.error('\n❌ 測試失敗:');
        console.error('   錯誤訊息:', error.message);
        console.error('   錯誤堆疊:', error.stack);
    }
    
    console.log('\n========================================');
    console.log('測試完成');
    console.log('========================================\n');
}

// 執行測試
testMockUpload().catch(console.error);
