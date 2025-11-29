/**
 * 最終驗證腳本：確認所有功能正常
 * 包含實際檔案上傳並檢查是否存在
 */

const axios = require('axios');
const FormData = require('form-data');

const SERVER_URL = 'http://localhost:3002';
const TEST_TIME = new Date().toISOString().replace(/[:.]/g, '-');

// 創建測試圖片
function createTestImage(name = 'test.jpg') {
    const hexData = 'ffd8ffe000104a46494600010100000100010000ffdb004300080606070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d1a1c1c20242e2720222c231c1c2837292c30313434341f27393d38323c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232323232ffc00011080001000103012200021101031101ffc4001f0000010501010101010100000000000000000102030405060708090a0bffc400b5100002010303020403050504040000017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00e3681ffd9';
    return {
        buffer: Buffer.from(hexData, 'hex'),
        name: name,
        mimetype: 'image/jpeg',
        size: 627
    };
}

// 測試功能表
const tests = [];
const results = {};

// 註冊測試
function addTest(name, testFn) {
    tests.push({ name, testFn });
}

// 執行測試
async function runTest(test) {
    try {
        console.log(`\n🧪 執行: ${test.name}`);
        const result = await test.testFn();
        results[test.name] = { success: true, result };
        console.log(`✅ ${test.name} - 通過`);
        return true;
    } catch (error) {
        results[test.name] = { success: false, error: error.message };
        console.log(`❌ ${test.name} - 失敗: ${error.message}`);
        return false;
    }
}

// ==============================================
// 測試案例
// ==============================================

// 測試 1: 伺服器健康檢查
addTest('伺服器健康檢查', async () => {
    const response = await axios.get(`${SERVER_URL}/api/health`);
    if (response.data.status !== 'healthy' && !response.data.success) {
        throw new Error('伺服器狀態異常');
    }
    return response.data;
});

// 測試 2: 學生記錄上傳（含所有類型檔案）
addTest('學生記錄完整上傳', async () => {
    const form = new FormData();
    
    // 基本資料
    form.append('semester', '114-1');
    form.append('courseName', `最終驗證課程-${TEST_TIME}`);
    form.append('date', '2025-11-17');
    form.append('topic', '最終驗證主題');
    form.append('studentName', '最終驗證學生');
    form.append('comment', '這是最終驗證的評語。系統所有功能都應該正常運作，包含照片、影片、評語的上傳與儲存。');
    form.append('isOverview', 'false');
    
    // 添加 3 張照片
    for (let i = 1; i <= 3; i++) {
        const photo = createTestImage(`final-photo${i}.jpg`);
        form.append('photos', photo.buffer, {
            filename: photo.name,
            contentType: photo.mimetype
        });
    }
    
    const response = await axios.post(
        `${SERVER_URL}/api/learning-records/upload-drive`,
        form,
        {
            headers: form.getHeaders(),
            timeout: 30000
        }
    );
    
    if (!response.data.success) {
        throw new Error(response.data.error || '上傳失敗');
    }
    
    const data = response.data.data;
    
    // 驗證回應資料
    if (data.photos !== 3) {
        throw new Error(`預期 3 張照片，實際 ${data.photos} 張`);
    }
    
    return {
        basePath: data.basePath,
        photos: data.photos,
        comment: data.comment ? '已儲存' : '未儲存',
        metadata: data.metadata ? '已建立' : '未建立'
    };
});

// 測試 3: 查詢上傳的記錄
addTest('查詢學習記錄', async () => {
    const response = await axios.get(
        `${SERVER_URL}/api/learning-records/history-drive`,
        {
            params: {
                semester: '114-1',
                courseName: `最終驗證課程-${TEST_TIME}`,
                date: '2025-11-17'
            },
            timeout: 10000
        }
    );
    
    if (!response.data.success) {
        throw new Error('查詢失敗');
    }
    
    const records = response.data.data;
    if (!Array.isArray(records) || records.length === 0) {
        throw new Error('找不到剛才上傳的記錄');
    }
    
    const latestRecord = records[records.length - 1];
    
    // 驗證記錄內容
    if (latestRecord.studentName !== '最終驗證學生') {
        throw new Error('學生名稱不符');
    }
    
    if (!latestRecord.photos || latestRecord.photos.length < 3) {
        throw new Error(`照片數量不足: 期望至少 3，實際 ${latestRecord.photos?.length || 0}`);
    }
    
    return {
        recordCount: records.length,
        studentName: latestRecord.studentName,
        photoCount: latestRecord.photos?.length || 0,
        videoCount: latestRecord.videos?.length || 0,
        hasComment: !!latestRecord.comment
    };
});

// 測試 4: 課程總覽上傳
addTest('課程總覽上傳', async () => {
    const form = new FormData();
    
    form.append('semester', '114-1');
    form.append('courseName', `最終驗證課程-${TEST_TIME}`);
    form.append('date', '2025-11-17');
    form.append('topic', '最終驗證主題');
    form.append('comment', '這是課程總覽的摘要說明。');
    form.append('isOverview', 'true');
    
    // 添加總覽照片
    const photo1 = createTestImage('overview-photo1.jpg');
    const photo2 = createTestImage('overview-photo2.jpg');
    
    form.append('overviewPhotos', photo1.buffer, {
        filename: photo1.name,
        contentType: photo1.mimetype
    });
    form.append('overviewPhotos', photo2.buffer, {
        filename: photo2.name,
        contentType: photo2.mimetype
    });
    
    const response = await axios.post(
        `${SERVER_URL}/api/learning-records/upload-drive`,
        form,
        {
            headers: form.getHeaders(),
            timeout: 30000
        }
    );
    
    if (!response.data.success) {
        throw new Error(response.data.error || '總覽上傳失敗');
    }
    
    return {
        basePath: response.data.data.basePath,
        photos: response.data.data.photos,
        summary: response.data.data.summary
    };
});

// 測試 5: 分片上傳（影片）
addTest('分片影片上傳', async () => {
    // 初始化分片上傳
    const initResponse = await axios.post(
        `${SERVER_URL}/api/drive-upload/init`,
        {
            fileName: 'final-test-video.mp4',
            fileSize: 32,
            mimeType: 'video/mp4',
            totalChunks: 1,
            context: {
                semester: '114-1',
                courseName: `最終驗證課程-${TEST_TIME}`,
                date: '2025-11-17',
                topic: '最終驗證主題',
                studentName: '最終驗證學生'
            }
        }
    );
    
    const uploadId = initResponse.data.uploadId;
    
    // 上傳分片
    const chunkForm = new FormData();
    chunkForm.append('uploadId', uploadId);
    chunkForm.append('chunkIndex', '0');
    chunkForm.append('chunk', Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
        0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
        0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
        0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
    ]), { filename: 'chunk' });
    
    await axios.post(
        `${SERVER_URL}/api/drive-upload/chunk`,
        chunkForm,
        { headers: chunkForm.getHeaders() }
    );
    
    // 完成上傳
    const completeResponse = await axios.post(
        `${SERVER_URL}/api/drive-upload/complete`,
        { uploadId }
    );
    
    if (!completeResponse.data.success) {
        throw new Error('分片上傳失敗');
    }
    
    return {
        uploadId,
        filePath: completeResponse.data.filePath,
        success: true
    };
});

// ==============================================
// 執行所有測試
// ==============================================
async function runAllTests() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 最終功能驗證 - ' + new Date().toLocaleString('zh-TW'));
    console.log('='.repeat(60));
    
    let passedCount = 0;
    let failedCount = 0;
    
    for (const test of tests) {
        const passed = await runTest(test);
        if (passed) passedCount++;
        else failedCount++;
    }
    
    // 輸出總結
    console.log('\n' + '='.repeat(60));
    console.log('📊 驗證結果總結');
    console.log('='.repeat(60));
    
    for (const [name, result] of Object.entries(results)) {
        const status = result.success ? '✅ 通過' : '❌ 失敗';
        console.log(`${name}: ${status}`);
        
        if (result.success && result.result) {
            // 顯示關鍵結果
            if (result.result.basePath) {
                console.log(`  → 路徑: ${result.result.basePath}`);
            }
            if (result.result.photos !== undefined) {
                console.log(`  → 照片: ${result.result.photos} 張`);
            }
            if (result.result.recordCount !== undefined) {
                console.log(`  → 記錄: ${result.result.recordCount} 筆`);
            }
        } else if (!result.success) {
            console.log(`  → 錯誤: ${result.error}`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`總計: ${passedCount} 通過 / ${failedCount} 失敗`);
    
    if (failedCount === 0) {
        console.log('\n🎉 所有功能驗證通過！系統完全正常運作！');
    } else {
        console.log('\n⚠️ 有功能驗證失敗，請檢查錯誤訊息。');
    }
    
    console.log('='.repeat(60) + '\n');
    
    process.exit(failedCount === 0 ? 0 : 1);
}

// 執行測試
runAllTests().catch(console.error);
