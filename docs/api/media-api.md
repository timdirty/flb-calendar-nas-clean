# 📸🎬 新版媒體 API 文檔

版本：2.0.0  
更新日期：2025-11-03  
狀態：✅ 已上線

---

## 概述

新版媒體 API 提供統一的照片和影片上傳、處理、預覽功能，使用分片上傳技術，支援大檔案、斷點續傳、自動轉碼與縮圖生成。

### 主要優勢

- ✅ 統一的儲存目錄結構（學習歷程 automatic）
- ✅ 自動生成縮圖與轉碼（照片3種尺寸、影片WebM格式）
- ✅ 分片上傳支援大檔案（無大小限制）
- ✅ 更好的元資料管理
- ✅ 支援照片與影片統一處理流程
- ✅ 前端壓縮節省 40-60% 流量

### 與舊版差異

| 項目 | 舊版 API | 新版 API |
|------|---------|---------|
| 端點 | `/api/learning-records/upload/*` | `/api/media/videos/*` |
| 上傳方式 | Multer 直接上傳 / 分片上傳 | 統一分片上傳 |
| 儲存位置 | 分散式 | 統一（學習歷程目錄） |
| 縮圖生成 | 手動觸發 | 自動背景處理 |
| 影片轉碼 | 可選 | 自動 WebM 轉碼 |
| 前端壓縮 | 無 | PhotoPreprocessor 自動壓縮 |
| 元資料 | 簡單 | 完整（bucket、索引） |

---

## API 端點

### 1. 初始化上傳

**端點:** `POST /api/media/videos/init`

**用途:** 建立上傳會話，獲取 uploadId

**請求參數:**
```json
{
  "filename": "photo.jpg",
  "fileSize": 5242880,
  "fileType": "image/jpeg",
  "chunkSize": 6291456,
  "metadata": {
    "courseName": "Python",
    "period": "五-0810-0940",
    "coursePeriod": "Python-五-0810-0940",
    "date": "2025-11-03",
    "dateKey": "2025-11-03",
    "studentName": "王小明",
    "instructorName": "李老師",
    "isOverview": false
  }
}
```

**回應:**
```json
{
  "success": true,
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "totalChunks": 5,
  "chunkSize": 6291456,
  "expiresAt": 1699000000000
}
```

### 2. 上傳分片

**端點:** `POST /api/media/videos/chunk`

**用途:** 上傳單一分片

**請求參數 (FormData):**
- `chunk` (File): 分片檔案
- `uploadId` (String): 上傳會話 ID
- `chunkIndex` (Number): 分片索引（從 0 開始）

**回應:**
```json
{
  "success": true,
  "receivedChunks": 3,
  "totalChunks": 5
}
```

### 3. 完成上傳

**端點:** `POST /api/media/videos/complete`

**用途:** 合併分片並觸發後續處理

**請求參數:**
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "courseName": "Python",
    "period": "五-0810-0940",
    "coursePeriod": "Python-五-0810-0940",
    "date": "2025-11-03",
    "studentName": "王小明"
  }
}
```

**回應:**
```json
{
  "success": true,
  "record": {
    "id": "media-123456",
    "bucketId": "abc123def",
    "filename": "photo-1699000000000.jpg",
    "fileSize": 5242880,
    "fileType": "image/jpeg",
    "status": "queued",
    "uploadedAt": 1699000000000,
    "relativePath": "114-1/Python-五-0810-0940/2025-11-03/王小明",
    "courseName": "Python",
    "studentName": "王小明"
  },
  "bucket": {
    "bucketId": "abc123def",
    "baseDir": "/volume1/Fun Learn Bar/學習歷程 automatic/114-1/Python-五-0810-0940/2025-11-03/王小明",
    "semester": "114-1",
    "coursePeriod": "Python-五-0810-0940",
    "dateKey": "2025-11-03",
    "studentName": "王小明"
  }
}
```

### 4. 查詢媒體列表

**端點:** `GET /api/media/videos`

**用途:** 查詢媒體記錄

**請求參數 (Query):**
- `status` (可選): 狀態過濾（queued, processing, ready, error）
- `bucketId` (可選): 儲存桶 ID 過濾

**回應:**
```json
{
  "success": true,
  "data": [
    {
      "id": "media-123456",
      "filename": "photo-1699000000000.jpg",
      "status": "ready",
      "thumbnailRelative": "114-1/Python-五-0810-0940/2025-11-03/王小明/photo-1699000000000.thumb.jpg"
    }
  ]
}
```

### 5. 查詢單一媒體

**端點:** `GET /api/media/videos/:recordId`

**回應:**
```json
{
  "success": true,
  "record": {
    "id": "media-123456",
    "status": "ready",
    "filename": "photo-1699000000000.jpg",
    "fileSize": 5242880,
    "originRelative": "114-1/.../photo-1699000000000.jpg",
    "thumbnailRelative": "114-1/.../photo-1699000000000.thumb.jpg"
  }
}
```

### 6. 下載媒體檔案

**端點:** `GET /api/media/videos/:recordId/download`

**用途:** 下載原始檔案或轉碼後的檔案

**回應:** 檔案串流（video/webm, image/jpeg, etc.）

### 7. 獲取影片縮圖

**端點:** `GET /api/media/videos/:recordId/thumbnail`

**回應:** 縮圖圖片串流（image/jpeg）

### 8. 獲取照片預覽

**端點:** `GET /api/media/photos/:photoId/preview`

**請求參數 (Query):**
- `size` (可選): 尺寸（small, medium, original，預設 small）
- `date`: 日期
- `studentName`: 學生姓名
- `coursePeriod`: 課程時段

**回應:** 照片串流（image/jpeg）

### 9. 獲取照片原圖

**端點:** `GET /api/media/photos/:photoId/original`

**請求參數:** 同上

**回應:** 原圖串流（image/*）

---

## 前端使用範例

### 使用 PhotoPreprocessor 壓縮照片

```javascript
// 1. 選擇檔案
const files = document.getElementById('photoInput').files;

// 2. 前端壓縮
const compressResults = await PhotoPreprocessor.compressBatch(files, {
    onProgress: (percent, current, total) => {
        console.log(`壓縮進度: ${current}/${total} (${percent}%)`);
    }
});

// 3. 使用壓縮後的 blob 上傳
for (const result of compressResults) {
    if (result.success) {
        const file = new File([result.blob], `photo-${Date.now()}.jpg`, {
            type: 'image/jpeg'
        });
        await uploadPhoto(file);
    }
}
```

### 使用 ChunkedUploader 上傳

```javascript
async function uploadPhoto(file) {
    const record = await ChunkedUploader.uploadFileChunked(file, {
        onProgress: (percent, uploadedBytes, totalBytes) => {
            console.log(`上傳進度: ${percent}%`);
            updateProgressBar(percent);
        },
        onChunkComplete: (completedChunks, totalChunks) => {
            console.log(`分片進度: ${completedChunks}/${totalChunks}`);
        },
        metadata: {
            courseName: '網頁設計',
            period: '五-0810-0940',
            date: '2025-11-03',
            studentName: '王小明'
        }
    });
    
    console.log('✅ 上傳完成:', record);
    return record;
}
```

### 使用 MediaPreview 顯示預覽

```javascript
// 顯示照片預覽
const photoPreview = MediaPreview.createPhotoPreview(record, {
    size: 'small',
    onClick: (rec) => {
        // 點擊放大到 medium，再點擊顯示原圖
        MediaPreview.showPhotoDetail(rec);
    }
});
container.appendChild(photoPreview);

// 顯示影片預覽
const videoPreview = MediaPreview.createVideoPreview(record, {
    onClick: (rec) => {
        // 點擊播放影片
        MediaPreview.openVideoPlayer(rec);
    }
});
container.appendChild(videoPreview);
```

---

## 後端處理流程

### 照片處理流程

1. 上傳完成後自動進入照片處理佇列
2. 使用 Sharp 生成 3 種尺寸縮圖：
   - **small**: 200x200（列表用，fit: cover）
   - **medium**: 800x800（預覽用，fit: inside）
   - **original**: 保留原圖
3. 自動壓縮與優化（品質 80-85%）
4. 更新索引狀態為 `ready`

### 影片處理流程

1. 上傳完成後自動進入影片轉碼佇列
2. 使用 FFmpeg 轉碼為 WebM 格式（VP9 + Opus）
   - CRF: 28（高品質）
   - 解析度: 最大 1280px 寬度
   - 多執行緒加速（row-mt, tile-columns）
3. 提取影片縮圖（第 2 秒畫面，1280px 寬度）
4. 更新索引狀態為 `ready`

### 並發處理

- **轉碼並發數**: CPU 核心數 / 2（較耗資源）
- **縮圖並發數**: CPU 核心數 - 2（輕量任務）
- 可透過環境變數覆蓋：
  - `MEDIA_TRANSCODE_CONCURRENCY`
  - `MEDIA_POSTER_CONCURRENCY`

---

## 錯誤碼

| 錯誤碼 | 說明 | 處理方式 |
|--------|------|---------|
| 400 | 缺少必要參數 | 檢查請求參數 |
| 404 | 上傳會話不存在或已過期 | 重新初始化上傳 |
| 500 | 伺服器錯誤 | 查看日誌，聯絡管理員 |

---

## 效能優化建議

### 前端優化

1. **使用 PhotoPreprocessor 壓縮**: 節省 40-60% 上傳流量
2. **調整分片大小**: 預設 6MB，網路不穩定時可降低至 2MB
3. **並發上傳控制**: 同時最多 3 個檔案上傳
4. **使用懶加載**: MediaPreview 自動支援 Intersection Observer

### 後端優化

1. **調整轉碼品質**: 修改 `MEDIA_TRANSCODE_CRF` 環境變數（預設 28）
2. **調整並發數**: 根據伺服器 CPU 調整
3. **監控佇列狀態**: 查看定時輸出的統計日誌

---

## 常見問題

**Q: 上傳失敗，顯示「上傳會話不存在」？**  
A: 會話可能已過期（預設 1 小時），請重新初始化上傳。

**Q: 照片上傳後沒有縮圖？**  
A: 縮圖生成在背景進行，請稍等片刻後刷新。查看伺服器日誌確認處理狀態。

**Q: 影片轉碼耗時太長？**  
A: 大檔案轉碼需要時間，可以調整 `cpu-used` 參數或降低輸出解析度。

**Q: HEIC 格式照片無法上傳？**  
A: HEIC 格式瀏覽器不支援壓縮，建議先轉換為 JPEG 格式。

**Q: 如何回滾到舊版 API？**  
A: 請參考 `rollback-guide.md` 文檔。

---

## 相關連結

- [回滾指南](./rollback-guide.md)
- [開發環境設定](./開發環境設定.md)
- [Synology Calendar API Guide](../Calendar_API_Guide.txt)



版本：2.0.0  
更新日期：2025-11-03  
狀態：✅ 已上線

---

## 概述

新版媒體 API 提供統一的照片和影片上傳、處理、預覽功能，使用分片上傳技術，支援大檔案、斷點續傳、自動轉碼與縮圖生成。

### 主要優勢

- ✅ 統一的儲存目錄結構（學習歷程 automatic）
- ✅ 自動生成縮圖與轉碼（照片3種尺寸、影片WebM格式）
- ✅ 分片上傳支援大檔案（無大小限制）
- ✅ 更好的元資料管理
- ✅ 支援照片與影片統一處理流程
- ✅ 前端壓縮節省 40-60% 流量

### 與舊版差異

| 項目 | 舊版 API | 新版 API |
|------|---------|---------|
| 端點 | `/api/learning-records/upload/*` | `/api/media/videos/*` |
| 上傳方式 | Multer 直接上傳 / 分片上傳 | 統一分片上傳 |
| 儲存位置 | 分散式 | 統一（學習歷程目錄） |
| 縮圖生成 | 手動觸發 | 自動背景處理 |
| 影片轉碼 | 可選 | 自動 WebM 轉碼 |
| 前端壓縮 | 無 | PhotoPreprocessor 自動壓縮 |
| 元資料 | 簡單 | 完整（bucket、索引） |

---

## API 端點

### 1. 初始化上傳

**端點:** `POST /api/media/videos/init`

**用途:** 建立上傳會話，獲取 uploadId

**請求參數:**
```json
{
  "filename": "photo.jpg",
  "fileSize": 5242880,
  "fileType": "image/jpeg",
  "chunkSize": 6291456,
  "metadata": {
    "courseName": "Python",
    "period": "五-0810-0940",
    "coursePeriod": "Python-五-0810-0940",
    "date": "2025-11-03",
    "dateKey": "2025-11-03",
    "studentName": "王小明",
    "instructorName": "李老師",
    "isOverview": false
  }
}
```

**回應:**
```json
{
  "success": true,
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "totalChunks": 5,
  "chunkSize": 6291456,
  "expiresAt": 1699000000000
}
```

### 2. 上傳分片

**端點:** `POST /api/media/videos/chunk`

**用途:** 上傳單一分片

**請求參數 (FormData):**
- `chunk` (File): 分片檔案
- `uploadId` (String): 上傳會話 ID
- `chunkIndex` (Number): 分片索引（從 0 開始）

**回應:**
```json
{
  "success": true,
  "receivedChunks": 3,
  "totalChunks": 5
}
```

### 3. 完成上傳

**端點:** `POST /api/media/videos/complete`

**用途:** 合併分片並觸發後續處理

**請求參數:**
```json
{
  "uploadId": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": {
    "courseName": "Python",
    "period": "五-0810-0940",
    "coursePeriod": "Python-五-0810-0940",
    "date": "2025-11-03",
    "studentName": "王小明"
  }
}
```

**回應:**
```json
{
  "success": true,
  "record": {
    "id": "media-123456",
    "bucketId": "abc123def",
    "filename": "photo-1699000000000.jpg",
    "fileSize": 5242880,
    "fileType": "image/jpeg",
    "status": "queued",
    "uploadedAt": 1699000000000,
    "relativePath": "114-1/Python-五-0810-0940/2025-11-03/王小明",
    "courseName": "Python",
    "studentName": "王小明"
  },
  "bucket": {
    "bucketId": "abc123def",
    "baseDir": "/volume1/Fun Learn Bar/學習歷程 automatic/114-1/Python-五-0810-0940/2025-11-03/王小明",
    "semester": "114-1",
    "coursePeriod": "Python-五-0810-0940",
    "dateKey": "2025-11-03",
    "studentName": "王小明"
  }
}
```

### 4. 查詢媒體列表

**端點:** `GET /api/media/videos`

**用途:** 查詢媒體記錄

**請求參數 (Query):**
- `status` (可選): 狀態過濾（queued, processing, ready, error）
- `bucketId` (可選): 儲存桶 ID 過濾

**回應:**
```json
{
  "success": true,
  "data": [
    {
      "id": "media-123456",
      "filename": "photo-1699000000000.jpg",
      "status": "ready",
      "thumbnailRelative": "114-1/Python-五-0810-0940/2025-11-03/王小明/photo-1699000000000.thumb.jpg"
    }
  ]
}
```

### 5. 查詢單一媒體

**端點:** `GET /api/media/videos/:recordId`

**回應:**
```json
{
  "success": true,
  "record": {
    "id": "media-123456",
    "status": "ready",
    "filename": "photo-1699000000000.jpg",
    "fileSize": 5242880,
    "originRelative": "114-1/.../photo-1699000000000.jpg",
    "thumbnailRelative": "114-1/.../photo-1699000000000.thumb.jpg"
  }
}
```

### 6. 下載媒體檔案

**端點:** `GET /api/media/videos/:recordId/download`

**用途:** 下載原始檔案或轉碼後的檔案

**回應:** 檔案串流（video/webm, image/jpeg, etc.）

### 7. 獲取影片縮圖

**端點:** `GET /api/media/videos/:recordId/thumbnail`

**回應:** 縮圖圖片串流（image/jpeg）

### 8. 獲取照片預覽

**端點:** `GET /api/media/photos/:photoId/preview`

**請求參數 (Query):**
- `size` (可選): 尺寸（small, medium, original，預設 small）
- `date`: 日期
- `studentName`: 學生姓名
- `coursePeriod`: 課程時段

**回應:** 照片串流（image/jpeg）

### 9. 獲取照片原圖

**端點:** `GET /api/media/photos/:photoId/original`

**請求參數:** 同上

**回應:** 原圖串流（image/*）

---

## 前端使用範例

### 使用 PhotoPreprocessor 壓縮照片

```javascript
// 1. 選擇檔案
const files = document.getElementById('photoInput').files;

// 2. 前端壓縮
const compressResults = await PhotoPreprocessor.compressBatch(files, {
    onProgress: (percent, current, total) => {
        console.log(`壓縮進度: ${current}/${total} (${percent}%)`);
    }
});

// 3. 使用壓縮後的 blob 上傳
for (const result of compressResults) {
    if (result.success) {
        const file = new File([result.blob], `photo-${Date.now()}.jpg`, {
            type: 'image/jpeg'
        });
        await uploadPhoto(file);
    }
}
```

### 使用 ChunkedUploader 上傳

```javascript
async function uploadPhoto(file) {
    const record = await ChunkedUploader.uploadFileChunked(file, {
        onProgress: (percent, uploadedBytes, totalBytes) => {
            console.log(`上傳進度: ${percent}%`);
            updateProgressBar(percent);
        },
        onChunkComplete: (completedChunks, totalChunks) => {
            console.log(`分片進度: ${completedChunks}/${totalChunks}`);
        },
        metadata: {
            courseName: '網頁設計',
            period: '五-0810-0940',
            date: '2025-11-03',
            studentName: '王小明'
        }
    });
    
    console.log('✅ 上傳完成:', record);
    return record;
}
```

### 使用 MediaPreview 顯示預覽

```javascript
// 顯示照片預覽
const photoPreview = MediaPreview.createPhotoPreview(record, {
    size: 'small',
    onClick: (rec) => {
        // 點擊放大到 medium，再點擊顯示原圖
        MediaPreview.showPhotoDetail(rec);
    }
});
container.appendChild(photoPreview);

// 顯示影片預覽
const videoPreview = MediaPreview.createVideoPreview(record, {
    onClick: (rec) => {
        // 點擊播放影片
        MediaPreview.openVideoPlayer(rec);
    }
});
container.appendChild(videoPreview);
```

---

## 後端處理流程

### 照片處理流程

1. 上傳完成後自動進入照片處理佇列
2. 使用 Sharp 生成 3 種尺寸縮圖：
   - **small**: 200x200（列表用，fit: cover）
   - **medium**: 800x800（預覽用，fit: inside）
   - **original**: 保留原圖
3. 自動壓縮與優化（品質 80-85%）
4. 更新索引狀態為 `ready`

### 影片處理流程

1. 上傳完成後自動進入影片轉碼佇列
2. 使用 FFmpeg 轉碼為 WebM 格式（VP9 + Opus）
   - CRF: 28（高品質）
   - 解析度: 最大 1280px 寬度
   - 多執行緒加速（row-mt, tile-columns）
3. 提取影片縮圖（第 2 秒畫面，1280px 寬度）
4. 更新索引狀態為 `ready`

### 並發處理

- **轉碼並發數**: CPU 核心數 / 2（較耗資源）
- **縮圖並發數**: CPU 核心數 - 2（輕量任務）
- 可透過環境變數覆蓋：
  - `MEDIA_TRANSCODE_CONCURRENCY`
  - `MEDIA_POSTER_CONCURRENCY`

---

## 錯誤碼

| 錯誤碼 | 說明 | 處理方式 |
|--------|------|---------|
| 400 | 缺少必要參數 | 檢查請求參數 |
| 404 | 上傳會話不存在或已過期 | 重新初始化上傳 |
| 500 | 伺服器錯誤 | 查看日誌，聯絡管理員 |

---

## 效能優化建議

### 前端優化

1. **使用 PhotoPreprocessor 壓縮**: 節省 40-60% 上傳流量
2. **調整分片大小**: 預設 6MB，網路不穩定時可降低至 2MB
3. **並發上傳控制**: 同時最多 3 個檔案上傳
4. **使用懶加載**: MediaPreview 自動支援 Intersection Observer

### 後端優化

1. **調整轉碼品質**: 修改 `MEDIA_TRANSCODE_CRF` 環境變數（預設 28）
2. **調整並發數**: 根據伺服器 CPU 調整
3. **監控佇列狀態**: 查看定時輸出的統計日誌

---

## 常見問題

**Q: 上傳失敗，顯示「上傳會話不存在」？**  
A: 會話可能已過期（預設 1 小時），請重新初始化上傳。

**Q: 照片上傳後沒有縮圖？**  
A: 縮圖生成在背景進行，請稍等片刻後刷新。查看伺服器日誌確認處理狀態。

**Q: 影片轉碼耗時太長？**  
A: 大檔案轉碼需要時間，可以調整 `cpu-used` 參數或降低輸出解析度。

**Q: HEIC 格式照片無法上傳？**  
A: HEIC 格式瀏覽器不支援壓縮，建議先轉換為 JPEG 格式。

**Q: 如何回滾到舊版 API？**  
A: 請參考 `rollback-guide.md` 文檔。

---

## 相關連結

- [回滾指南](./rollback-guide.md)
- [開發環境設定](./開發環境設定.md)
- [Synology Calendar API Guide](../Calendar_API_Guide.txt)

