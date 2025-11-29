/**
 * ============================================
 * Drive 上傳功能測試腳本
 * ============================================
 * 功能：測試 Synology Drive 上傳 API
 * 使用：node test-drive-upload.js
 * 日期：2025-11-08
 */

require('dotenv').config({ path: '.env.nas' });
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

// 配置
const SERVER_URL = process.env.TEST_SERVER_URL || 'http://localhost:3002';
const API_ENDPOINT = '/api/learning-records/upload-drive';

/**
 * 創建測試用的照片 Buffer（1x1 PNG）
 */
function createTestPhoto(name) {
    // 1x1 透明 PNG（最小化的 PNG 檔案）
    const pngBuffer = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
        0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
        0x42, 0x60, 0x82
    ]);
    
    return {
        buffer: pngBuffer,
        originalname: name,
        mimetype: 'image/png',
        size: pngBuffer.length
    };
}

/**
 * 測試 1：上傳學生記錄（照片 + 評語）
 */
async function testStudentUpload() {
    console.log('\n📤 測試 1：上傳學生記錄');
    console.log('='.repeat(50));
    
    try {
        const form = new FormData();
        
        // 基本資料
        form.append('semester', '114-1');
        form.append('courseName', 'SPIKE 三 18:30-20:30 第8週');
        form.append('date', '2025-11-08');
        form.append('topic', 'Drive API 測試');
        form.append('studentName', '測試學生');
        form.append('comment', '這是一個測試評語，用於驗證 Synology Drive API 上傳功能是否正常運作。評語需要至少 20 個字。');
        form.append('isOverview', 'false');
        
        // 添加 3 張測試照片（滿足門檻）
        const photo1 = createTestPhoto('test_photo_1.png');
        const photo2 = createTestPhoto('test_photo_2.png');
        const photo3 = createTestPhoto('test_photo_3.png');
        
        form.append('photos', photo1.buffer, {
            filename: photo1.originalname,
            contentType: photo1.mimetype
        });
        form.append('photos', photo2.buffer, {
            filename: photo2.originalname,
            contentType: photo2.mimetype
        });
        form.append('photos', photo3.buffer, {
            filename: photo3.originalname,
            contentType: photo3.mimetype
        });
        
        console.log('📝 上傳資料:');
        console.log('  學期:', '114-1');
        console.log('  課程:', 'SPIKE 三 18:30-20:30 第8週');
        console.log('  日期:', '2025-11-08');
        console.log('  學生:', '測試學生');
        console.log('  照片數量:', '3');
        console.log('  評語長度:', 60);
        
        const response = await axios.post(
            `${SERVER_URL}${API_ENDPOINT}`,
            form,
            {
                headers: form.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        );
        
        if (response.data.success) {
            console.log('\n✅ 測試通過！');
            console.log('📁 Drive 路徑:', response.data.data.basePath);
            console.log('📸 照片數量:', response.data.data.photos);
            console.log('💬 評語字數:', response.data.data.comment.length);
            
            if (response.data.data.files && response.data.data.files.photos) {
                console.log('\n📋 已上傳的照片:');
                response.data.data.files.photos.forEach((photo, i) => {
                    console.log(`  ${i + 1}. ${photo.name} (${photo.size} bytes)`);
                    console.log(`     URL: ${photo.url}`);
                });
            }
            
            return true;
        } else {
            console.error('\n❌ 測試失敗:', response.data.error || response.data.message);
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ 測試失敗（例外）:', error.message);
        if (error.response) {
            console.error('伺服器回應:', error.response.data);
        }
        return false;
    }
}

/**
 * 測試 2：上傳課程總覽（照片 + 摘要）
 */
async function testOverviewUpload() {
    console.log('\n📤 測試 2：上傳課程總覽');
    console.log('='.repeat(50));
    
    try {
        const form = new FormData();
        
        // 基本資料
        form.append('semester', '114-1');
        form.append('courseName', 'SPIKE 三 18:30-20:30 第8週');
        form.append('date', '2025-11-08');
        form.append('topic', 'Drive API 測試');
        form.append('overviewSummary', '本週課程進行順利，學生們對 Synology Drive API 整合展現高度興趣。');
        form.append('isOverview', 'true');
        
        // 添加課程總覽照片
        const photo1 = createTestPhoto('overview_photo_1.png');
        const photo2 = createTestPhoto('overview_photo_2.png');
        
        form.append('overviewPhotos', photo1.buffer, {
            filename: photo1.originalname,
            contentType: photo1.mimetype
        });
        form.append('overviewPhotos', photo2.buffer, {
            filename: photo2.originalname,
            contentType: photo2.mimetype
        });
        
        console.log('📝 上傳資料:');
        console.log('  學期:', '114-1');
        console.log('  課程:', 'SPIKE 三 18:30-20:30 第8週');
        console.log('  日期:', '2025-11-08');
        console.log('  類型:', '課程總覽');
        console.log('  照片數量:', '2');
        console.log('  摘要長度:', 40);
        
        const response = await axios.post(
            `${SERVER_URL}${API_ENDPOINT}`,
            form,
            {
                headers: form.getHeaders(),
                maxBodyLength: Infinity,
                maxContentLength: Infinity
            }
        );
        
        if (response.data.success) {
            console.log('\n✅ 測試通過！');
            console.log('📁 Drive 路徑:', response.data.data.basePath);
            console.log('📸 照片數量:', response.data.data.photos);
            console.log('💬 摘要長度:', response.data.data.summary?.length || 0);
            
            if (response.data.data.files && response.data.data.files.photos) {
                console.log('\n📋 已上傳的照片:');
                response.data.data.files.photos.forEach((photo, i) => {
                    console.log(`  ${i + 1}. ${photo.name} (${photo.size} bytes)`);
                    console.log(`     URL: ${photo.url}`);
                });
            }
            
            return true;
        } else {
            console.error('\n❌ 測試失敗:', response.data.error || response.data.message);
            return false;
        }
        
    } catch (error) {
        console.error('\n❌ 測試失敗（例外）:', error.message);
        if (error.response) {
            console.error('伺服器回應:', error.response.data);
        }
        return false;
    }
}

/**
 * 測試 3：門檻驗證（照片不足）
 */
async function testPhotoThreshold() {
    console.log('\n📤 測試 3：門檻驗證（照片不足應失敗）');
    console.log('='.repeat(50));
    
    try {
        const form = new FormData();
        
        form.append('semester', '114-1');
        form.append('courseName', 'SPIKE 三 18:30-20:30 第8週');
        form.append('date', '2025-11-08');
        form.append('studentName', '測試學生');
        form.append('comment', '這是一個測試評語，用於驗證門檻檢查功能。評語需要至少 20 個字符。');
        form.append('isOverview', 'false');
        
        // 只添加 1 張照片（不足 3 張）
        const photo1 = createTestPhoto('test_photo_1.png');
        form.append('photos', photo1.buffer, {
            filename: photo1.originalname,
            contentType: photo1.mimetype
        });
        
        console.log('📝 上傳資料（不滿足門檻）:');
        console.log('  照片數量:', '1 （需要 3 張）');
        
        const response = await axios.post(
            `${SERVER_URL}${API_ENDPOINT}`,
            form,
            {
                headers: form.getHeaders()
            }
        );
        
        if (!response.data.success) {
            console.log('\n✅ 測試通過！正確阻止了不符合門檻的上傳');
            console.log('錯誤訊息:', response.data.error);
            return true;
        } else {
            console.error('\n❌ 測試失敗：應該拒絕上傳但卻成功了');
            return false;
        }
        
    } catch (error) {
        // 預期會失敗（400 或 500）
        if (error.response && error.response.status === 400) {
            console.log('\n✅ 測試通過！正確阻止了不符合門檻的上傳');
            console.log('錯誤訊息:', error.response.data.error);
            return true;
        } else {
            console.error('\n❌ 測試失敗（非預期錯誤）:', error.message);
            return false;
        }
    }
}

/**
 * 測試 4：評語驗證（評語不足）
 */
async function testCommentThreshold() {
    console.log('\n📤 測試 4：評語驗證（評語不足應失敗）');
    console.log('='.repeat(50));
    
    try {
        const form = new FormData();
        
        form.append('semester', '114-1');
        form.append('courseName', 'SPIKE 三 18:30-20:30 第8週');
        form.append('date', '2025-11-08');
        form.append('studentName', '測試學生');
        form.append('comment', '太短'); // 只有 2 個字（需要 20 個字）
        form.append('isOverview', 'false');
        
        // 添加足夠的照片
        for (let i = 1; i <= 3; i++) {
            const photo = createTestPhoto(`test_photo_${i}.png`);
            form.append('photos', photo.buffer, {
                filename: photo.originalname,
                contentType: photo.mimetype
            });
        }
        
        console.log('📝 上傳資料（不滿足評語門檻）:');
        console.log('  評語長度:', '2 字（需要 20 字）');
        
        const response = await axios.post(
            `${SERVER_URL}${API_ENDPOINT}`,
            form,
            {
                headers: form.getHeaders()
            }
        );
        
        if (!response.data.success) {
            console.log('\n✅ 測試通過！正確阻止了評語不足的上傳');
            console.log('錯誤訊息:', response.data.error);
            return true;
        } else {
            console.error('\n❌ 測試失敗：應該拒絕上傳但卻成功了');
            return false;
        }
        
    } catch (error) {
        // 預期會失敗（400 或 500）
        if (error.response && error.response.status === 400) {
            console.log('\n✅ 測試通過！正確阻止了評語不足的上傳');
            console.log('錯誤訊息:', error.response.data.error);
            return true;
        } else {
            console.error('\n❌ 測試失敗（非預期錯誤）:', error.message);
            return false;
        }
    }
}

/**
 * 主測試流程
 */
async function runAllTests() {
    console.log('\n🚀 開始 Synology Drive 上傳測試');
    console.log('='.repeat(50));
    console.log('伺服器:', SERVER_URL);
    console.log('API 端點:', API_ENDPOINT);
    console.log('='.repeat(50));
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0
    };
    
    // 測試 1：學生記錄上傳
    results.total++;
    if (await testStudentUpload()) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    // 等待 1 秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 測試 2：課程總覽上傳
    results.total++;
    if (await testOverviewUpload()) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    // 等待 1 秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 測試 3：照片門檻驗證
    results.total++;
    if (await testPhotoThreshold()) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    // 等待 1 秒
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 測試 4：評語門檻驗證
    results.total++;
    if (await testCommentThreshold()) {
        results.passed++;
    } else {
        results.failed++;
    }
    
    // 總結
    console.log('\n' + '='.repeat(50));
    console.log('🎉 測試完成！');
    console.log('='.repeat(50));
    console.log('總測試數:', results.total);
    console.log('✅ 通過:', results.passed);
    console.log('❌ 失敗:', results.failed);
    console.log('成功率:', Math.round((results.passed / results.total) * 100) + '%');
    console.log('='.repeat(50));
    
    if (results.failed === 0) {
        console.log('\n🎊 所有測試通過！Synology Drive 上傳功能運作正常！');
        process.exit(0);
    } else {
        console.log('\n⚠️ 有測試失敗，請檢查錯誤訊息並修正。');
        process.exit(1);
    }
}

// 執行測試
runAllTests().catch(error => {
    console.error('\n❌ 測試執行失敗:', error.message);
    process.exit(1);
});

