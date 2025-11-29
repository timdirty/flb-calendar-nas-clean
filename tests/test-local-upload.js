/**
 * 本地測試：透過 server.js API 測試上傳功能
 * 直接調用本地伺服器的 API，而非直接連接 Synology
 */

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const SERVER_URL = 'http://localhost:3002';

// 創建測試圖片
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

async function testLocalUpload() {
    console.log('\n========================================');
    console.log('🔍 本地測試：檔案上傳到 Drive');
    console.log('========================================\n');

    try {
        // 1. 檢查伺服器狀態
        console.log('📋 步驟 1: 檢查伺服器狀態');
        const healthResponse = await axios.get(`${SERVER_URL}/api/health`);
        console.log('✅ 伺服器狀態:', healthResponse.data.status || 'ok');
        console.log('\n');

        // 2. 測試學生記錄上傳
        console.log('📋 步驟 2: 測試學生記錄上傳（含照片）');
        
        const form = new FormData();
        
        // 基本資料
        form.append('semester', '114-1');
        form.append('courseName', 'SPIKE 五 16:10-17:40 松山');
        form.append('date', '2025-11-17');
        form.append('topic', '本地測試主題');
        form.append('studentName', '本地測試學生');
        form.append('comment', '這是本地測試評語，用於診斷為什麼只有 record-meta.json 被建立，而沒有實際的檔案被上傳。');
        form.append('isOverview', 'false');
        
        // 添加測試照片
        const photo1 = createTestImage('local-test-photo1.jpg');
        const photo2 = createTestImage('local-test-photo2.jpg');
        const photo3 = createTestImage('local-test-photo3.jpg');
        
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
        
        console.log('   上傳資料:');
        console.log('   - 學期: 114-1');
        console.log('   - 課程: SPIKE 五 16:10-17:40 松山');
        console.log('   - 日期: 2025-11-17');
        console.log('   - 學生: 本地測試學生');
        console.log('   - 照片數: 3');
        console.log('   - 每張照片大小: 627 bytes');
        console.log('\n');
        
        console.log('🚀 開始上傳...');
        const response = await axios.post(
            `${SERVER_URL}/api/learning-records/upload-drive`,
            form,
            {
                headers: form.getHeaders(),
                timeout: 30000
            }
        );
        
        if (response.data.success) {
            console.log('\n✅ 上傳成功！');
            console.log('   回應資料:');
            console.log('   - 基礎路徑:', response.data.data.basePath);
            console.log('   - 照片數量:', response.data.data.photos);
            console.log('   - 評語字數:', response.data.data.comment?.length || 0);
            
            if (response.data.data.files?.photos) {
                console.log('\n   📸 照片詳情:');
                response.data.data.files.photos.forEach((photo, i) => {
                    console.log(`     照片 ${i+1}:`);
                    console.log(`       - 檔名: ${photo.name}`);
                    console.log(`       - URL: ${photo.url}`);
                    console.log(`       - 大小: ${photo.size} bytes`);
                });
            }
            
            console.log('\n');
            
            // 3. 驗證檔案是否存在
            console.log('📋 步驟 3: 從 API 查詢已上傳的記錄');
            
            const historyResponse = await axios.get(
                `${SERVER_URL}/api/learning-records/history-drive`,
                {
                    params: {
                        semester: '114-1',
                        courseName: 'SPIKE 五 16:10-17:40 松山',
                        date: '2025-11-17',
                        studentName: '本地測試學生'
                    },
                    timeout: 10000
                }
            );
            
            if (historyResponse.data.success) {
                console.log('✅ 成功查詢到記錄');
                const records = historyResponse.data.data;
                
                if (records && records.length > 0) {
                    console.log(`   找到 ${records.length} 筆記錄`);
                    
                    const latestRecord = records[records.length - 1];
                    console.log('\n   最新記錄:');
                    console.log('   - 學生:', latestRecord.studentName);
                    console.log('   - 照片數:', latestRecord.photos?.length || 0);
                    console.log('   - 影片數:', latestRecord.videos?.length || 0);
                    console.log('   - 評語:', latestRecord.comment ? latestRecord.comment.substring(0, 50) + '...' : '無');
                    
                    // 檢查照片 URL 是否可訪問
                    if (latestRecord.photos && latestRecord.photos.length > 0) {
                        console.log('\n   🔍 檢查照片 URL 是否可訪問...');
                        const testPhotoUrl = `${SERVER_URL}${latestRecord.photos[0]}`;
                        
                        try {
                            const photoResponse = await axios.head(testPhotoUrl);
                            console.log(`   ✅ 照片 URL 可訪問 (狀態碼: ${photoResponse.status})`);
                        } catch (photoError) {
                            console.log(`   ❌ 照片 URL 無法訪問: ${photoError.message}`);
                        }
                    }
                }
            } else {
                console.log('❌ 查詢記錄失敗');
            }
            
        } else {
            console.error('\n❌ 上傳失敗:', response.data.error || response.data.message);
        }
        
    } catch (error) {
        console.error('\n❌ 測試失敗:');
        if (error.response) {
            console.error('   HTTP 狀態碼:', error.response.status);
            console.error('   錯誤訊息:', error.response.data?.error || error.response.data?.message || error.message);
        } else {
            console.error('   錯誤訊息:', error.message);
        }
    }
    
    console.log('\n========================================');
    console.log('測試完成');
    console.log('========================================\n');
}

// 執行測試
testLocalUpload().catch(console.error);
