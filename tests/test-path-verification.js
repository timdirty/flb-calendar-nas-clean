/**
 * 路徑驗證測試 - 確保所有檔案都上傳到正確的資料夾
 * 測試不同課程名稱格式的路徑處理
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

// 創建測試影片
function createTestVideo(name = 'test.mp4') {
    const videoHeader = Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
        0x69, 0x73, 0x6F, 0x6D, 0x00, 0x00, 0x02, 0x00,
        0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32,
        0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
    ]);
    return {
        buffer: videoHeader,
        name: name,
        mimetype: 'video/mp4',
        size: 32
    };
}

// 測試案例：不同的課程名稱格式
const TEST_COURSES = [
    {
        name: 'SPIKE 五 16:10-17:40 松山',
        expectedPath: 'SPIKE 五 1610-1740 松山',
        description: 'SPIKE 課程（冒號轉換）'
    },
    {
        name: 'ESM 四 17:30-18:30 到府',
        expectedPath: 'ESM 四 1730-1830 到府',
        description: 'ESM 課程（到府）'
    },
    {
        name: 'BOOST 六 15:30-17:00 到府',
        expectedPath: 'BOOST 六 1530-1700 到府',
        description: 'BOOST 課程'
    },
    {
        name: 'EV3 三 18:30-20:00 松山',
        expectedPath: 'EV3 三 1830-2000 松山',
        description: 'EV3 課程'
    },
    {
        name: 'MINECRAFT 日 10:00-11:30 內湖',
        expectedPath: 'MINECRAFT 日 1000-1130 內湖',
        description: 'MINECRAFT 課程'
    }
];

async function testCourseUpload(courseInfo) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📚 測試課程：${courseInfo.description}`);
    console.log(`   原始名稱：${courseInfo.name}`);
    console.log(`   預期路徑：${courseInfo.expectedPath}`);
    console.log('='.repeat(60));
    
    try {
        const form = new FormData();
        
        // 基本資料
        form.append('semester', '114-1');
        form.append('courseName', courseInfo.name);
        form.append('date', '2025-11-17');
        form.append('topic', '路徑驗證測試');
        form.append('studentName', '測試學生');
        form.append('comment', `這是 ${courseInfo.description} 的測試評語，用於驗證檔案上傳到正確的資料夾路徑。`);
        form.append('isOverview', 'false');
        
        // 添加照片
        const photo1 = createTestImage('photo1.jpg');
        const photo2 = createTestImage('photo2.jpg');
        
        form.append('photos', photo1.buffer, {
            filename: photo1.name,
            contentType: photo1.mimetype
        });
        form.append('photos', photo2.buffer, {
            filename: photo2.name,
            contentType: photo2.mimetype
        });
        
        // 添加影片
        const video = createTestVideo('video.mp4');
        form.append('videos', video.buffer, {
            filename: video.name,
            contentType: video.mimetype
        });
        
        // 上傳
        console.log('🚀 開始上傳檔案...');
        const response = await axios.post(
            `${SERVER_URL}/api/learning-records/upload-drive`,
            form,
            {
                headers: form.getHeaders(),
                timeout: 30000
            }
        );
        
        if (response.data.success) {
            const data = response.data.data;
            console.log('✅ 上傳成功！');
            console.log(`   實際路徑：${data.basePath}`);
            console.log(`   照片數量：${data.photos} 張`);
            console.log(`   影片數量：${data.videos} 個`);
            console.log(`   評語：${data.comment ? '已儲存' : '未儲存'}`);
            
            // 驗證路徑是否正確
            if (data.basePath.includes(courseInfo.expectedPath)) {
                console.log('✅ 路徑驗證：正確！檔案已上傳到預期的資料夾');
                return { success: true, path: data.basePath };
            } else {
                console.log(`❌ 路徑驗證：錯誤！`);
                console.log(`   預期包含：${courseInfo.expectedPath}`);
                console.log(`   實際路徑：${data.basePath}`);
                return { success: false, path: data.basePath, expected: courseInfo.expectedPath };
            }
        } else {
            console.log('❌ 上傳失敗：', response.data.error);
            return { success: false, error: response.data.error };
        }
        
    } catch (error) {
        console.log('❌ 測試失敗：', error.message);
        return { success: false, error: error.message };
    }
}

async function testFileQuery(courseInfo) {
    console.log('\n📂 查詢已上傳的檔案...');
    
    try {
        const response = await axios.get(
            `${SERVER_URL}/api/learning-records/history-drive`,
            {
                params: {
                    semester: '114-1',
                    courseName: courseInfo.name,
                    date: '2025-11-17'
                },
                timeout: 10000
            }
        );
        
        if (response.data.success && response.data.data.length > 0) {
            console.log(`✅ 找到 ${response.data.data.length} 筆記錄`);
            const latestRecord = response.data.data[response.data.data.length - 1];
            console.log(`   學生：${latestRecord.studentName}`);
            console.log(`   照片：${latestRecord.photos?.length || 0} 張`);
            console.log(`   影片：${latestRecord.videos?.length || 0} 個`);
            console.log(`   路徑：${latestRecord.recordPath || latestRecord.path}`);
            return true;
        } else {
            console.log('⚠️ 未找到記錄');
            return false;
        }
    } catch (error) {
        console.log('❌ 查詢失敗：', error.message);
        return false;
    }
}

async function runAllTests() {
    console.log('\n' + '='.repeat(70));
    console.log('🔍 完整路徑驗證測試');
    console.log('測試時間：' + new Date().toLocaleString('zh-TW'));
    console.log('目的：確保所有檔案都上傳到正確的課程資料夾');
    console.log('='.repeat(70));
    
    // 檢查伺服器
    console.log('\n📡 檢查伺服器狀態...');
    try {
        const health = await axios.get(`${SERVER_URL}/api/health`);
        console.log('✅ 伺服器正常運行');
    } catch (error) {
        console.log('❌ 伺服器未啟動，請先執行: npm run dev');
        process.exit(1);
    }
    
    const results = [];
    
    // 測試每個課程
    for (const course of TEST_COURSES) {
        const uploadResult = await testCourseUpload(course);
        const queryResult = await testFileQuery(course);
        
        results.push({
            course: course.name,
            description: course.description,
            uploadSuccess: uploadResult.success,
            querySuccess: queryResult,
            actualPath: uploadResult.path,
            expectedPath: course.expectedPath
        });
        
        // 短暫延遲，避免太快
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // 總結報告
    console.log('\n' + '='.repeat(70));
    console.log('📊 測試結果總結');
    console.log('='.repeat(70));
    
    let passCount = 0;
    let failCount = 0;
    
    for (const result of results) {
        const status = result.uploadSuccess && result.querySuccess ? '✅ 通過' : '❌ 失敗';
        const pathCorrect = result.actualPath && result.actualPath.includes(result.expectedPath);
        
        console.log(`\n${result.description}：${status}`);
        console.log(`  課程名稱：${result.course}`);
        console.log(`  上傳狀態：${result.uploadSuccess ? '✅' : '❌'}`);
        console.log(`  查詢狀態：${result.querySuccess ? '✅' : '❌'}`);
        console.log(`  路徑正確：${pathCorrect ? '✅' : '❌'}`);
        
        if (result.actualPath) {
            console.log(`  實際路徑：${result.actualPath}`);
        }
        
        if (result.uploadSuccess && result.querySuccess && pathCorrect) {
            passCount++;
        } else {
            failCount++;
        }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log(`測試完成：${passCount} 通過 / ${failCount} 失敗`);
    
    if (failCount === 0) {
        console.log('🎉 所有檔案都已正確上傳到對應的課程資料夾！');
    } else {
        console.log('⚠️ 有部分測試失敗，請檢查上方的錯誤訊息');
    }
    console.log('='.repeat(70) + '\n');
    
    process.exit(failCount === 0 ? 0 : 1);
}

// 執行測試
runAllTests().catch(console.error);
