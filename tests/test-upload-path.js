#!/usr/bin/env node

/**
 * ============================================
 * 測試上傳路徑問題
 * ============================================
 * 驗證檔案是否會上傳到正確的路徑
 */

require('dotenv').config({ path: '.env.nas' });
const SynologyDriveClient = require('../synology-drive-client');
const DrivePathManager = require('../drive-path-manager');
const LearningUploadHelper = require('../learning-upload-helper');

async function testUpload() {
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                    測試上傳路徑                                        ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
    
    // 初始化客戶端
    const driveClient = new SynologyDriveClient({
        host: process.env.SYNOLOGY_HOST,
        port: process.env.SYNOLOGY_PORT || 9102,
        protocol: 'https',
        username: process.env.SYNOLOGY_USERNAME,
        password: process.env.SYNOLOGY_PASSWORD
    });
    
    const pathManager = new DrivePathManager(process.env.SYNOLOGY_DRIVE_ROOT || '/Fun Learn Bar/FLB-Learning-Portfolio');
    const uploadHelper = new LearningUploadHelper(driveClient, pathManager);
    
    // 測試參數
    const testParams = {
        semester: '114-1',
        courseName: 'SPIKE 五 16:10-17:40 松山',
        date: new Date().toISOString().split('T')[0],  // 今天的日期
        topic: '路徑測試',
        studentName: '測試學生_' + Date.now()
    };
    
    console.log('📋 測試參數：');
    console.log('  課程名稱:', testParams.courseName);
    console.log('  學期:', testParams.semester);
    console.log('  日期:', testParams.date);
    console.log('  主題:', testParams.topic);
    console.log('  學生:', testParams.studentName);
    console.log('');
    
    // 生成預期路徑
    const expectedPath = pathManager.buildStudentRecordPath(
        testParams.semester,
        testParams.courseName,
        testParams.date,
        testParams.topic,
        testParams.studentName
    );
    
    console.log('✅ 預期路徑:');
    console.log(' ', expectedPath);
    console.log('');
    
    // 創建測試檔案
    const testPhoto = {
        originalname: 'test-photo.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('test photo data'),
        size: 15
    };
    
    const testComment = '這是一個路徑測試，檢查檔案是否會儲存到正確的位置。時間: ' + new Date().toISOString();
    
    try {
        console.log('🚀 開始上傳測試...\n');
        
        // 執行上傳
        const result = await uploadHelper.uploadStudentRecord({
            ...testParams,
            photos: [testPhoto],
            videos: [],
            comment: testComment
        });
        
        console.log('✅ 上傳成功！\n');
        console.log('📁 實際儲存路徑:');
        console.log(' ', result.basePath);
        console.log('');
        
        // 驗證路徑
        if (result.basePath === expectedPath) {
            console.log('✅ 路徑正確！檔案儲存在預期位置');
        } else {
            console.log('❌ 路徑錯誤！');
            console.log('  預期:', expectedPath);
            console.log('  實際:', result.basePath);
        }
        
        // 檢查各檔案
        console.log('\n📄 上傳的檔案：');
        if (result.metadata) {
            console.log('  ✅ record-meta.json:', result.metadataPath || '已創建');
        }
        if (result.photos && result.photos.length > 0) {
            console.log('  ✅ 照片:', result.photos[0].drivePath);
        }
        if (result.newMediaPhotos && result.newMediaPhotos.length > 0) {
            console.log('  ✅ photos-meta.json: 已更新');
        }
        
        // 列出目錄內容確認
        console.log('\n📂 驗證目錄內容...');
        const listResult = await driveClient.listFiles(result.basePath);
        if (listResult.success && listResult.files) {
            console.log('  目錄中有', listResult.files.length, '個檔案：');
            listResult.files.forEach(file => {
                console.log('    -', file.name);
            });
        }
        
        // 檢查是否有檔案在錯誤的路徑
        const wrongPath = result.basePath.replace('SPIKE 五 1610-1740 松山', 'SPIKE 五 1610');
        console.log('\n🔍 檢查錯誤路徑:', wrongPath);
        try {
            const wrongResult = await driveClient.listFiles(wrongPath);
            if (wrongResult.success && wrongResult.files && wrongResult.files.length > 0) {
                console.log('⚠️  發現檔案在錯誤路徑！共', wrongResult.files.length, '個檔案：');
                wrongResult.files.forEach(file => {
                    console.log('    -', file.name);
                });
            } else {
                console.log('✅ 錯誤路徑中沒有檔案（正確）');
            }
        } catch (error) {
            console.log('✅ 錯誤路徑不存在（正確）');
        }
        
    } catch (error) {
        console.error('❌ 上傳失敗:', error.message);
        console.error('錯誤詳情:', error);
    }
    
    console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                        測試完成                                        ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
}

// 執行測試
testUpload().catch(console.error);
