#!/usr/bin/env node

/**
 * 測試 fs.existsSync 修復
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const API_BASE = 'http://localhost:3002';

// 創建測試檔案
function createTestFile(size = 1024 * 100) { // 100KB
  const buffer = Buffer.alloc(size);
  for (let i = 0; i < size; i++) {
    buffer[i] = Math.floor(Math.random() * 256);
  }
  return buffer;
}

async function testChunkedUpload() {
  console.log('\n🧪 開始測試分片上傳修復...\n');

  const testData = createTestFile();
  const filename = `test-file-${Date.now()}.bin`;
  const chunkSize = 32 * 1024; // 32KB chunks
  
  try {
    // 1. 初始化上傳
    console.log('1️⃣ 初始化上傳...');
    const initRes = await axios.post(`${API_BASE}/api/drive-upload/init`, {
      filename,
      fileSize: testData.length,
      chunkSize,
      fileType: 'application/octet-stream',
      metadata: {
        semester: '114-1',
        courseName: '測試課程',
        date: '2025-01-17',
        topic: '測試主題',
        studentName: '測試學生'
      }
    });

    if (!initRes.data.success) {
      throw new Error('初始化失敗: ' + initRes.data.message);
    }

    const { uploadId, totalChunks } = initRes.data;
    console.log(`✅ 初始化成功: uploadId=${uploadId}, totalChunks=${totalChunks}`);

    // 2. 上傳分片
    console.log('\n2️⃣ 上傳分片...');
    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, testData.length);
      const chunk = testData.slice(start, end);

      const form = new FormData();
      form.append('uploadId', uploadId);
      form.append('chunkIndex', i.toString());
      form.append('chunk', chunk, {
        filename: `chunk_${i}`,
        contentType: 'application/octet-stream'
      });

      const chunkRes = await axios.post(
        `${API_BASE}/api/drive-upload/chunk`,
        form,
        { headers: form.getHeaders() }
      );

      if (!chunkRes.data.success) {
        throw new Error(`分片 ${i} 上傳失敗: ${chunkRes.data.message}`);
      }
      
      process.stdout.write(`  分片 ${i + 1}/${totalChunks} ✓\n`);
    }

    console.log('✅ 所有分片上傳成功');

    // 3. 完成上傳（測試 fs.existsSync 修復）
    console.log('\n3️⃣ 完成上傳（合併分片）...');
    const completeRes = await axios.post(`${API_BASE}/api/drive-upload/complete`, {
      uploadId,
      metadata: {
        semester: '114-1',
        courseName: '測試課程',
        date: '2025-01-17',
        topic: '測試主題',
        studentName: '測試學生'
      }
    });

    if (!completeRes.data.success) {
      throw new Error('合併失敗: ' + completeRes.data.message);
    }

    console.log('✅ 檔案合併成功！');
    console.log('📁 檔案資訊:', {
      id: completeRes.data.record.id,
      fileName: completeRes.data.record.fileName,
      size: completeRes.data.record.size,
      drivePath: completeRes.data.record.drivePath
    });
    
    console.log('\n🎉 測試通過！fs.existsSync 問題已修復\n');
    return true;

  } catch (error) {
    console.error('\n❌ 測試失敗:', error.message);
    if (error.response) {
      console.error('響應狀態:', error.response.status);
      console.error('響應資料:', error.response.data);
    }
    return false;
  }
}

// 執行測試
testChunkedUpload().then(success => {
  process.exit(success ? 0 : 1);
});
