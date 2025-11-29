# 前端整合指南

**目的**: 將分片上傳功能整合到 `learning-record-upload.js`  
**難度**: ⭐⭐⭐ (中等)  
**預計時間**: 30-60 分鐘

## 📋 整合檢查清單

- [x] ChunkedUploader 模組已引入 HTML
- [x] 後端分片上傳 API 已就緒
- [ ] 修改前端上傳邏輯（本指南重點）
- [ ] 測試小檔案上傳（< 10MB）
- [ ] 測試大檔案上傳（>= 10MB）
- [ ] 測試批次上傳

---

## 🎯 整合策略

由於 `learning-record-upload.js` 非常大（87000+ 行），我們採用**最小侵入式整合**策略：

### 策略 1: 包裝現有上傳函數（推薦）⭐

找到現有的檔案上傳函數，在其前面加入檔案大小判斷，大檔案走分片上傳，小檔案走原有流程。

**優點**: 
- 風險最低
- 不影響現有邏輯
- 易於測試和回滾

**整合步驟**:

#### 步驟 1: 找到上傳函數

在 `learning-record-upload.js` 中搜尋關鍵字：

```javascript
// 可能的函數名稱
- uploadStudentFiles
- uploadLearningRecord
- handleFileUpload
- submitUploadForm
```

#### 步驟 2: 加入檔案大小判斷

在上傳函數**開頭**加入：

```javascript
// 🔥 新增：檔案大小判斷
async function uploadStudentFiles(photos, videos, studentInfo) {
    // === 新增程式碼開始 ===
    
    // 分離大檔案和小檔案
    const allFiles = [...photos, ...videos];
    const largeFiles = allFiles.filter(f => 
        window.ChunkedUploader && ChunkedUploader.shouldUseChunkedUpload(f)
    );
    const smallFiles = allFiles.filter(f => 
        !window.ChunkedUploader || !ChunkedUploader.shouldUseChunkedUpload(f)
    );
    
    console.log('📊 檔案分類:', {
        total: allFiles.length,
        large: largeFiles.length,
        small: smallFiles.length
    });
    
    // 如果有大檔案，使用分片上傳
    if (largeFiles.length > 0) {
        return await uploadWithChunkedUploader(largeFiles, smallFiles, studentInfo);
    }
    
    // === 新增程式碼結束 ===
    
    // 原有程式碼繼續...
    // ... (保持不變)
}
```

#### 步驟 3: 新增分片上傳處理函數

在檔案**適當位置**（建議在上傳相關函數附近）加入：

```javascript
/**
 * 🔥 新增：使用分片上傳處理大檔案
 */
async function uploadWithChunkedUploader(largeFiles, smallFiles, studentInfo) {
    try {
        const results = {
            largeFiles: [],
            smallFiles: null,
            success: true
        };
        
        // 1. 上傳大檔案（使用分片上傳）
        for (const file of largeFiles) {
            try {
                console.log('📦 分片上傳:', file.name);
                
                const result = await ChunkedUploader.uploadFileChunked(
                    file,
                    (percent, uploadedBytes, totalBytes) => {
                        // 更新進度條（使用現有的進度更新函數）
                        if (typeof updateProgressBar === 'function') {
                            updateProgressBar(file.name, percent);
                        }
                        console.log(`進度: ${percent}% - ${ChunkedUploader.formatFileSize(uploadedBytes)}/${ChunkedUploader.formatFileSize(totalBytes)}`);
                    }
                );
                
                results.largeFiles.push({
                    filename: file.name,
                    success: true,
                    path: result.path
                });
                
            } catch (error) {
                console.error('❌ 大檔案上傳失敗:', file.name, error);
                results.largeFiles.push({
                    filename: file.name,
                    success: false,
                    error: error.message
                });
            }
        }
        
        // 2. 上傳小檔案 + 其他資料（使用原有方式）
        if (smallFiles.length > 0) {
            // 呼叫原有的上傳函數（需根據實際函數名稱調整）
            results.smallFiles = await uploadFilesTraditional(smallFiles, studentInfo);
        }
        
        return results;
        
    } catch (error) {
        console.error('❌ 分片上傳處理失敗:', error);
        throw error;
    }
}
```

---

## 🔍 如何找到正確的整合點

### 方法 1: 搜尋 FormData

在 `learning-record-upload.js` 中搜尋：

```javascript
// 搜尋關鍵字
"new FormData"
"formData.append"
```

找到類似這樣的程式碼：

```javascript
const formData = new FormData();
formData.append('photos', photoFile);
formData.append('videos', videoFile);
formData.append('studentName', studentName);

// 在這裡加入判斷邏輯
```

### 方法 2: 搜尋 fetch 或 XMLHttpRequest

```javascript
// 搜尋關鍵字
"fetch('/api/learning-records/upload'"
"XMLHttpRequest"
"xhr.send"
```

找到上傳請求的發送位置。

### 方法 3: 搜尋上傳按鈕事件

```javascript
// 搜尋關鍵字
"uploadBtn"
"submitUpload"
"upload-btn"
".addEventListener('click'"
```

找到上傳觸發的事件處理函數。

---

## 📝 具體整合範例

### 範例 A: 在表單提交事件中整合

**原有程式碼** (簡化版):

```javascript
// 原有程式碼
document.getElementById('uploadBtn').addEventListener('click', async function() {
    const photos = getSelectedPhotos();
    const videos = getSelectedVideos();
    const studentName = document.getElementById('studentName').value;
    
    const formData = new FormData();
    photos.forEach(p => formData.append('photos', p));
    videos.forEach(v => formData.append('videos', v));
    formData.append('studentName', studentName);
    
    const response = await fetch('/api/learning-records/upload', {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    console.log('上傳結果:', result);
});
```

**整合後程式碼**:

```javascript
// 🔥 整合分片上傳
document.getElementById('uploadBtn').addEventListener('click', async function() {
    const photos = getSelectedPhotos();
    const videos = getSelectedVideos();
    const studentName = document.getElementById('studentName').value;
    
    // === 新增：檔案大小判斷 ===
    const allFiles = [...photos, ...videos];
    const hasLargeFile = allFiles.some(f => 
        window.ChunkedUploader && ChunkedUploader.shouldUseChunkedUpload(f)
    );
    
    if (hasLargeFile) {
        console.log('🔄 使用混合上傳模式（大+小檔案）');
        
        // 分離大小檔案
        const largeFiles = allFiles.filter(f => ChunkedUploader.shouldUseChunkedUpload(f));
        const smallFiles = allFiles.filter(f => !ChunkedUploader.shouldUseChunkedUpload(f));
        
        // 先上傳大檔案
        for (const file of largeFiles) {
            try {
                await ChunkedUploader.uploadFileChunked(file, (percent) => {
                    console.log(`${file.name}: ${percent}%`);
                });
            } catch (error) {
                console.error('大檔案上傳失敗:', error);
                alert(`上傳失敗: ${file.name}`);
                return;
            }
        }
        
        // 再上傳小檔案（使用原有方式）
        if (smallFiles.length > 0) {
            const formData = new FormData();
            smallFiles.forEach(f => {
                if (photos.includes(f)) formData.append('photos', f);
                if (videos.includes(f)) formData.append('videos', f);
            });
            formData.append('studentName', studentName);
            
            const response = await fetch('/api/learning-records/upload', {
                method: 'POST',
                body: formData
            });
            const result = await response.json();
            console.log('小檔案上傳結果:', result);
        }
        
        alert('所有檔案上傳完成！');
        return;
    }
    // === 新增結束 ===
    
    // 原有程式碼繼續（處理全部都是小檔案的情況）
    const formData = new FormData();
    photos.forEach(p => formData.append('photos', p));
    videos.forEach(v => formData.append('videos', v));
    formData.append('studentName', studentName);
    
    const response = await fetch('/api/learning-records/upload', {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    console.log('上傳結果:', result);
});
```

---

## 🧪 測試步驟

### 測試 1: 小檔案上傳（確保不影響原有功能）

```bash
# 準備測試檔案
- 3 張照片（每張 2-5MB）
- 1 支影片（8MB）
```

**預期行為**:
- 應該走原有上傳流程
- 控制台顯示: `📤 使用標準上傳`
- 上傳成功，功能正常

### 測試 2: 大檔案上傳（測試分片上傳）

```bash
# 準備測試檔案
- 1 支大影片（50-100MB）
```

**預期行為**:
- 控制台顯示: `📦 使用分片上傳`
- 顯示上傳進度（每個分片完成時更新）
- 最終顯示: `✅ 檔案上傳成功`

### 測試 3: 混合上傳（大+小檔案）

```bash
# 準備測試檔案
- 2 張照片（每張 3MB）
- 1 支大影片（50MB）
```

**預期行為**:
- 先上傳大影片（分片）
- 再上傳小照片（原有方式）
- 全部成功

---

## 🐛 常見問題排除

### 問題 1: `ChunkedUploader is not defined`

**原因**: 模組未正確載入

**解決**:
```html
<!-- 檢查 HTML 中是否有引入 -->
<script defer src="/js/modules/chunked-uploader.js?v=20251103-upload-opt"></script>
```

並確認在主程式載入**之前**引入。

### 問題 2: 分片上傳進度不更新

**原因**: 進度回調函數未正確設置

**解決**:
```javascript
// 確保傳入進度回調
await ChunkedUploader.uploadFileChunked(
    file,
    (percent) => {
        console.log(`進度: ${percent}%`);  // 至少要有 console.log
        // 更新 UI 的程式碼
    }
);
```

### 問題 3: 上傳後縮圖未生成

**原因**: 後端異步處理需要時間

**解決**:
- 縮圖生成是異步的，不會阻塞上傳回應
- 重新整理頁面即可看到縮圖
- 或實作輪詢機制檢查縮圖狀態

### 問題 4: 大檔案上傳到一半失敗

**原因**: 網路中斷或超時

**解決**:
```javascript
// 分片上傳已內建重試機制（每個分片失敗會重試 3 次）
// 如果還是失敗，檢查網路連線
```

---

## 📊 效能監控

### 在控制台查看上傳統計

```javascript
// 後端會自動記錄效能統計
// 查看伺服器日誌:
⏱️  上傳效能統計: {
  duration: '1234ms',
  fileCount: 5,
  totalSize: '45.67 MB',
  avgSpeed: '37.02 MB/s',
  statusCode: 200,
  timestamp: '2025-11-03T...'
}
```

### 查看佇列狀態

```javascript
// 在瀏覽器控制台執行（僅供除錯）
fetch('/api/learning-records/upload/queue-stats')
    .then(r => r.json())
    .then(console.log);
```

---

## ✅ 整合完成檢查

完成整合後，請確認：

- [ ] 小檔案（< 10MB）上傳正常（走原有流程）
- [ ] 大檔案（>= 10MB）使用分片上傳
- [ ] 進度條正常顯示
- [ ] 上傳完成後縮圖可查看（可能需要等待數秒）
- [ ] 錯誤處理正常（網路中斷、檔案過大等）
- [ ] 控制台無錯誤訊息
- [ ] 後端日誌顯示效能統計

---

## 🔗 相關檔案

- 整合範例: `public/js/modules/upload-integration-example.js`
- ChunkedUploader 模組: `public/js/modules/chunked-uploader.js`
- 後端 API: `server.js` (第 14881-15177 行)
- 媒體處理: `utils/media-processor.js`
- 完整文檔: `docs/learning-upload-optimization.md`

---

## 💡 進階整合建議

### 建議 1: 加入視覺化進度條

```javascript
// 使用更好的進度 UI
function showUploadProgress(filename, percent) {
    const container = document.getElementById('uploadProgressContainer');
    let bar = document.getElementById(`progress-${filename}`);
    
    if (!bar) {
        bar = document.createElement('div');
        bar.id = `progress-${filename}`;
        bar.className = 'upload-progress-bar';
        bar.innerHTML = `
            <div class="filename">${filename}</div>
            <div class="bar-container">
                <div class="bar-fill" style="width: 0%"></div>
            </div>
            <div class="percent">0%</div>
        `;
        container.appendChild(bar);
    }
    
    const fill = bar.querySelector('.bar-fill');
    const percentText = bar.querySelector('.percent');
    fill.style.width = `${percent}%`;
    percentText.textContent = `${percent}%`;
}
```

### 建議 2: 加入取消上傳功能

```javascript
let activeUploads = new Map(); // 追蹤進行中的上傳

async function uploadWithCancel(file) {
    const uploadId = generateUploadId();
    activeUploads.set(uploadId, { file, cancelled: false });
    
    try {
        await ChunkedUploader.uploadFileChunked(file, (percent) => {
            const upload = activeUploads.get(uploadId);
            if (upload && upload.cancelled) {
                throw new Error('Upload cancelled by user');
            }
            // 更新進度...
        });
    } finally {
        activeUploads.delete(uploadId);
    }
}

function cancelUpload(uploadId) {
    const upload = activeUploads.get(uploadId);
    if (upload) {
        upload.cancelled = true;
    }
}
```

---

**文檔版本**: 1.0  
**最後更新**: 2025-11-03  
**維護者**: FLB Team

