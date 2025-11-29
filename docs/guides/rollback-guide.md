# 🔙 媒體 API 回滾指南

版本：1.0.0  
更新日期：2025-11-03  
緊急聯絡：管理員

---

## ⚠️ 警告

回滾到舊版 API 會影響正在使用新版功能的用戶。請確保：

1. 所有用戶已被通知
2. 已備份重要資料
3. 已記錄回滾原因
4. 準備好在必要時再次切換回新版

---

## 回滾原因檢查清單

在決定回滾前，請先檢查以下問題：

- [ ] 新版 API 是否真的有問題？（查看日誌）
- [ ] 問題是否可以快速修復？（< 30 分鐘）
- [ ] 是否有替代解決方案？
- [ ] 資料完整性是否受影響？
- [ ] 用戶是否能接受短期服務中斷？

**如果大部分答案是「否」，建議先嘗試修復而非回滾。**

---

## 完整回滾步驟

### 階段一：備份與準備（估計 5 分鐘）

#### 1. 備份配置檔案

```bash
cd /path/to/flb-calendar-nas

# 備份關鍵檔案
cp server.js server.js.backup-$(date +%Y%m%d-%H%M%S)-before-rollback
cp public/js/modules/chunked-uploader.js public/js/modules/chunked-uploader.js.backup
cp public/learning-record-upload.html public/learning-record-upload.html.backup

echo "✅ 備份完成"
```

#### 2. 記錄當前狀態

```bash
# 查看媒體處理佇列狀態
docker-compose logs --tail=100 | grep "媒體處理統計"

# 記錄當前上傳任務
curl https://calendar.funlearnbar.synology.me/api/media/videos?status=processing

# 保存輸出到檔案
docker-compose logs --tail=500 > logs/rollback-preparation-$(date +%Y%m%d-%H%M%S).log
```

### 階段二：後端 API 回滾（估計 10 分鐘）

#### 1. 重新啟用舊版分片上傳 API

編輯 `server.js`：

```javascript
// 找到這兩個區塊，移除註解標記 /* 和 */

// 區塊 1：舊版分片上傳 API（約 line 15569-15863）
// ==================== 🔒 舊版分片上傳 API（已停用，保留供緊急回滾） ====================
//
// ... 說明文字 ...
//
// ====================================================================================

/*  <-- 移除這行
// 初始化分片上傳
app.post('/api/learning-records/upload/init', (req, res) => {
    // ... 完整代碼 ...
});
*/  <-- 移除這行

// 區塊 2：舊版 Multer 直接上傳 API（約 line 15896-16188）
// ==================== 🔒 舊版 Multer 直接上傳 API（已停用，保留供緊急回滾） ====================
//
// ... 說明文字 ...
//
// ====================================================================================

/*  <-- 移除這行
// API: 上傳學習記錄
app.post('/api/learning-records/upload', upload.fields([
    // ... 完整代碼 ...
]);
*/  <-- 移除這行
```

**或使用 sed 自動移除（謹慎使用）：**

```bash
# 🔥 警告：執行前請再次確認備份
cd /path/to/flb-calendar-nas

# 移除第一個區塊的註解
sed -i.bak '15588s|^/\*|  |' server.js
sed -i.bak '15863s|^\*/|  |' server.js

# 移除第二個區塊的註解
sed -i.bak '15908s|^/\*|  |' server.js
sed -i.bak '16188s|^\*/|  |' server.js

echo "✅ 舊版 API 已重新啟用"
```

#### 2. 註解新版媒體 API（可選，避免衝突）

找到新版 API 區塊（約 line 14992-15400），加上註解：

```javascript
// ==================== 🔒 新版媒體 API（臨時停用，回滾使用） ====================
/*
app.post('/api/media/videos/init', async (req, res) => {
    // ... 完整代碼 ...
});

app.post('/api/media/videos/chunk', mediaChunkUpload.single('chunk'), async (req, res) => {
    // ... 完整代碼 ...
});

app.post('/api/media/videos/complete', async (req, res) => {
    // ... 完整代碼 ...
});

// ... 其他新版端點 ...
*/
// ==================== 🔒 END 新版媒體 API ====================
```

### 階段三：前端回滾（估計 10 分鐘）

#### 1. 修改 ChunkedUploader 模組

編輯 `public/js/modules/chunked-uploader.js`：

```javascript
// 找到 initSession 函數（約 line 33），修改 API 端點
async function initSession({ filename, fileSize, fileType, chunkSize, metadata }) {
    // 🔙 回滾：使用舊版端點
    const res = await fetch('/api/learning-records/upload/init', {  // ← 修改這行
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filename,
            fileSize,
            fileType,
            chunkSize
            // ⚠️ 注意：舊版不支援 metadata
        })
    });
    // ... 其餘不變 ...
}

// 找到 sendChunk 函數（約 line 59），修改 API 端點
async function sendChunk({ uploadId, chunkIndex, blob }) {
    const formData = new FormData();
    formData.append('chunk', blob);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex);

    // 🔙 回滾：使用舊版端點
    const res = await fetch('/api/learning-records/upload/chunk', {  // ← 修改這行
        method: 'POST',
        body: formData
    });
    // ... 其餘不變 ...
}

// 找到 completeSession 函數（約 line 83），修改 API 端點
async function completeSession(uploadId, metadata) {
    // 🔙 回滾：使用舊版端點
    const res = await fetch('/api/learning-records/upload/complete', {  // ← 修改這行
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uploadId,
            targetPath: metadata?.targetPath || null  // 舊版需要 targetPath
        })
    });
    // ... 其餘不變 ...
}
```

#### 2. 移除前端壓縮（可選）

如果前端壓縮導致問題，可以暫時禁用：

編輯 `public/learning-record-upload.html`：

```html
<!-- 註解掉照片壓縮模組 -->
<!-- 
<script defer src="/js/modules/photo-preprocessor.js?v=20251103-compress"></script>
-->
```

然後在 `public/js/pages/learning-record-upload.js` 中跳過壓縮步驟（或直接使用原始檔案）。

### 階段四：重啟服務（估計 5 分鐘）

#### 1. 測試配置

```bash
# 檢查語法錯誤
node -c server.js

# 如果有錯誤，修正後再繼續
```

#### 2. 重啟 Docker 容器

```bash
cd /path/to/flb-calendar-nas

# 停止現有容器
docker-compose down

# 重新構建並啟動
docker-compose build --no-cache
docker-compose up -d

# 查看日誌確認啟動成功
docker-compose logs -f --tail=100
```

#### 3. 驗證服務

```bash
# 健康檢查
curl https://calendar.funlearnbar.synology.me/health

# 測試舊版 API
curl -X POST https://calendar.funlearnbar.synology.me/api/learning-records/upload/init \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test.jpg",
    "fileSize": 1024000,
    "fileType": "image/jpeg",
    "chunkSize": 6291456
  }'

# 預期回應：{"success":true,"uploadId":"...","totalChunks":...}
```

### 階段五：監控與驗證（估計 10 分鐘）

#### 1. 監控錯誤日誌

```bash
# 持續監控日誌
docker-compose logs -f | grep -E "(ERROR|WARN|❌|⚠️)"

# 監控上傳狀態
watch -n 5 'curl -s https://calendar.funlearnbar.synology.me/api/media/videos | jq'
```

#### 2. 手動測試上傳

1. 開啟 `https://calendar.funlearnbar.synology.me/learning-record-upload.html`
2. 選擇一張小圖片（< 5MB）
3. 測試上傳流程
4. 確認檔案正確保存
5. 檢查縮圖是否生成

#### 3. 通知用戶

```markdown
📢 系統公告

由於技術問題，學習歷程上傳功能已臨時回滾到舊版。
- 功能正常運作
- 資料完全安全
- 預計 [時間] 恢復新版

如有問題請聯絡管理員。
```

---

## 資料相容性說明

### 新版資料結構

新版 API 使用統一的學習歷程目錄結構：

```
/volume1/Fun Learn Bar/學習歷程 automatic/
  114-1/                     # 學期
    Python-五-0810-0940/     # 課程-時段
      2025-11-03/            # 日期
        王小明/               # 學生
          photo.jpg
          photo.thumb.jpg    # 縮圖
          video.mp4          # 原始影片
          video.webm         # 轉碼影片
          video.thumb.jpg    # 影片縮圖
          media-meta.json    # 元資料
```

### 舊版資料結構

舊版 API 使用分散式目錄：

```
/volume1/Fun Learn Bar/學習歷程 automatic/
  114-1/
    Python/
      五-0810-0940/
        2025-11-03/
          王小明/
            files...
```

### 相容性處理

- ✅ 舊版 API 可以讀取新版資料（檔案路徑相容）
- ✅ 新版 API 可以讀取舊版資料（向下相容）
- ⚠️ 回滾後新上傳的檔案會使用舊版結構
- ⚠️ 可能需要手動遷移資料以保持一致性

---

## 常見回滾問題

### Q1: 回滾後前端顯示「上傳失敗」

**原因:** 前端仍在調用新版 API 端點  
**解決:** 確認 `chunked-uploader.js` 已修改端點，清除瀏覽器快取（Ctrl+F5）

### Q2: 回滾後影片沒有自動轉碼

**原因:** 舊版 API 不支援自動轉碼  
**解決:** 這是預期行為，可以手動觸發轉碼或等待恢復新版

### Q3: 回滾後部分照片無法預覽

**原因:** 舊版 API 縮圖生成邏輯不同  
**解決:** 
```bash
# 手動觸發縮圖生成
curl -X POST https://calendar.funlearnbar.synology.me/api/learning-records/regenerate-thumbnails
```

### Q4: Docker 容器無法啟動

**原因:** server.js 語法錯誤  
**解決:**
```bash
# 檢查語法
node -c server.js

# 如果有錯誤，回復備份
cp server.js.backup-* server.js

# 重新啟動
docker-compose up -d
```

---

## 再次切換回新版

如果問題已修復，想切換回新版：

1. 將 `server.js` 的註解恢復（重新註解舊版 API）
2. 將 `chunked-uploader.js` 的端點改回 `/api/media/videos/*`
3. 重新啟用 PhotoPreprocessor
4. 重啟服務
5. 測試驗證

---

## 緊急聯絡

- **管理員郵箱:** admin@funlearnbar.com
- **技術支援:** 
- **文檔位置:** `/docs/media-api.md`

---

## 變更記錄

| 日期 | 版本 | 說明 |
|------|------|------|
| 2025-11-03 | 1.0.0 | 初版回滾指南 |

---

**最後更新:** 2025-11-03  
**文檔狀態:** ✅ 已驗證



版本：1.0.0  
更新日期：2025-11-03  
緊急聯絡：管理員

---

## ⚠️ 警告

回滾到舊版 API 會影響正在使用新版功能的用戶。請確保：

1. 所有用戶已被通知
2. 已備份重要資料
3. 已記錄回滾原因
4. 準備好在必要時再次切換回新版

---

## 回滾原因檢查清單

在決定回滾前，請先檢查以下問題：

- [ ] 新版 API 是否真的有問題？（查看日誌）
- [ ] 問題是否可以快速修復？（< 30 分鐘）
- [ ] 是否有替代解決方案？
- [ ] 資料完整性是否受影響？
- [ ] 用戶是否能接受短期服務中斷？

**如果大部分答案是「否」，建議先嘗試修復而非回滾。**

---

## 完整回滾步驟

### 階段一：備份與準備（估計 5 分鐘）

#### 1. 備份配置檔案

```bash
cd /path/to/flb-calendar-nas

# 備份關鍵檔案
cp server.js server.js.backup-$(date +%Y%m%d-%H%M%S)-before-rollback
cp public/js/modules/chunked-uploader.js public/js/modules/chunked-uploader.js.backup
cp public/learning-record-upload.html public/learning-record-upload.html.backup

echo "✅ 備份完成"
```

#### 2. 記錄當前狀態

```bash
# 查看媒體處理佇列狀態
docker-compose logs --tail=100 | grep "媒體處理統計"

# 記錄當前上傳任務
curl https://calendar.funlearnbar.synology.me/api/media/videos?status=processing

# 保存輸出到檔案
docker-compose logs --tail=500 > logs/rollback-preparation-$(date +%Y%m%d-%H%M%S).log
```

### 階段二：後端 API 回滾（估計 10 分鐘）

#### 1. 重新啟用舊版分片上傳 API

編輯 `server.js`：

```javascript
// 找到這兩個區塊，移除註解標記 /* 和 */

// 區塊 1：舊版分片上傳 API（約 line 15569-15863）
// ==================== 🔒 舊版分片上傳 API（已停用，保留供緊急回滾） ====================
//
// ... 說明文字 ...
//
// ====================================================================================

/*  <-- 移除這行
// 初始化分片上傳
app.post('/api/learning-records/upload/init', (req, res) => {
    // ... 完整代碼 ...
});
*/  <-- 移除這行

// 區塊 2：舊版 Multer 直接上傳 API（約 line 15896-16188）
// ==================== 🔒 舊版 Multer 直接上傳 API（已停用，保留供緊急回滾） ====================
//
// ... 說明文字 ...
//
// ====================================================================================

/*  <-- 移除這行
// API: 上傳學習記錄
app.post('/api/learning-records/upload', upload.fields([
    // ... 完整代碼 ...
]);
*/  <-- 移除這行
```

**或使用 sed 自動移除（謹慎使用）：**

```bash
# 🔥 警告：執行前請再次確認備份
cd /path/to/flb-calendar-nas

# 移除第一個區塊的註解
sed -i.bak '15588s|^/\*|  |' server.js
sed -i.bak '15863s|^\*/|  |' server.js

# 移除第二個區塊的註解
sed -i.bak '15908s|^/\*|  |' server.js
sed -i.bak '16188s|^\*/|  |' server.js

echo "✅ 舊版 API 已重新啟用"
```

#### 2. 註解新版媒體 API（可選，避免衝突）

找到新版 API 區塊（約 line 14992-15400），加上註解：

```javascript
// ==================== 🔒 新版媒體 API（臨時停用，回滾使用） ====================
/*
app.post('/api/media/videos/init', async (req, res) => {
    // ... 完整代碼 ...
});

app.post('/api/media/videos/chunk', mediaChunkUpload.single('chunk'), async (req, res) => {
    // ... 完整代碼 ...
});

app.post('/api/media/videos/complete', async (req, res) => {
    // ... 完整代碼 ...
});

// ... 其他新版端點 ...
*/
// ==================== 🔒 END 新版媒體 API ====================
```

### 階段三：前端回滾（估計 10 分鐘）

#### 1. 修改 ChunkedUploader 模組

編輯 `public/js/modules/chunked-uploader.js`：

```javascript
// 找到 initSession 函數（約 line 33），修改 API 端點
async function initSession({ filename, fileSize, fileType, chunkSize, metadata }) {
    // 🔙 回滾：使用舊版端點
    const res = await fetch('/api/learning-records/upload/init', {  // ← 修改這行
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filename,
            fileSize,
            fileType,
            chunkSize
            // ⚠️ 注意：舊版不支援 metadata
        })
    });
    // ... 其餘不變 ...
}

// 找到 sendChunk 函數（約 line 59），修改 API 端點
async function sendChunk({ uploadId, chunkIndex, blob }) {
    const formData = new FormData();
    formData.append('chunk', blob);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', chunkIndex);

    // 🔙 回滾：使用舊版端點
    const res = await fetch('/api/learning-records/upload/chunk', {  // ← 修改這行
        method: 'POST',
        body: formData
    });
    // ... 其餘不變 ...
}

// 找到 completeSession 函數（約 line 83），修改 API 端點
async function completeSession(uploadId, metadata) {
    // 🔙 回滾：使用舊版端點
    const res = await fetch('/api/learning-records/upload/complete', {  // ← 修改這行
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uploadId,
            targetPath: metadata?.targetPath || null  // 舊版需要 targetPath
        })
    });
    // ... 其餘不變 ...
}
```

#### 2. 移除前端壓縮（可選）

如果前端壓縮導致問題，可以暫時禁用：

編輯 `public/learning-record-upload.html`：

```html
<!-- 註解掉照片壓縮模組 -->
<!-- 
<script defer src="/js/modules/photo-preprocessor.js?v=20251103-compress"></script>
-->
```

然後在 `public/js/pages/learning-record-upload.js` 中跳過壓縮步驟（或直接使用原始檔案）。

### 階段四：重啟服務（估計 5 分鐘）

#### 1. 測試配置

```bash
# 檢查語法錯誤
node -c server.js

# 如果有錯誤，修正後再繼續
```

#### 2. 重啟 Docker 容器

```bash
cd /path/to/flb-calendar-nas

# 停止現有容器
docker-compose down

# 重新構建並啟動
docker-compose build --no-cache
docker-compose up -d

# 查看日誌確認啟動成功
docker-compose logs -f --tail=100
```

#### 3. 驗證服務

```bash
# 健康檢查
curl https://calendar.funlearnbar.synology.me/health

# 測試舊版 API
curl -X POST https://calendar.funlearnbar.synology.me/api/learning-records/upload/init \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test.jpg",
    "fileSize": 1024000,
    "fileType": "image/jpeg",
    "chunkSize": 6291456
  }'

# 預期回應：{"success":true,"uploadId":"...","totalChunks":...}
```

### 階段五：監控與驗證（估計 10 分鐘）

#### 1. 監控錯誤日誌

```bash
# 持續監控日誌
docker-compose logs -f | grep -E "(ERROR|WARN|❌|⚠️)"

# 監控上傳狀態
watch -n 5 'curl -s https://calendar.funlearnbar.synology.me/api/media/videos | jq'
```

#### 2. 手動測試上傳

1. 開啟 `https://calendar.funlearnbar.synology.me/learning-record-upload.html`
2. 選擇一張小圖片（< 5MB）
3. 測試上傳流程
4. 確認檔案正確保存
5. 檢查縮圖是否生成

#### 3. 通知用戶

```markdown
📢 系統公告

由於技術問題，學習歷程上傳功能已臨時回滾到舊版。
- 功能正常運作
- 資料完全安全
- 預計 [時間] 恢復新版

如有問題請聯絡管理員。
```

---

## 資料相容性說明

### 新版資料結構

新版 API 使用統一的學習歷程目錄結構：

```
/volume1/Fun Learn Bar/學習歷程 automatic/
  114-1/                     # 學期
    Python-五-0810-0940/     # 課程-時段
      2025-11-03/            # 日期
        王小明/               # 學生
          photo.jpg
          photo.thumb.jpg    # 縮圖
          video.mp4          # 原始影片
          video.webm         # 轉碼影片
          video.thumb.jpg    # 影片縮圖
          media-meta.json    # 元資料
```

### 舊版資料結構

舊版 API 使用分散式目錄：

```
/volume1/Fun Learn Bar/學習歷程 automatic/
  114-1/
    Python/
      五-0810-0940/
        2025-11-03/
          王小明/
            files...
```

### 相容性處理

- ✅ 舊版 API 可以讀取新版資料（檔案路徑相容）
- ✅ 新版 API 可以讀取舊版資料（向下相容）
- ⚠️ 回滾後新上傳的檔案會使用舊版結構
- ⚠️ 可能需要手動遷移資料以保持一致性

---

## 常見回滾問題

### Q1: 回滾後前端顯示「上傳失敗」

**原因:** 前端仍在調用新版 API 端點  
**解決:** 確認 `chunked-uploader.js` 已修改端點，清除瀏覽器快取（Ctrl+F5）

### Q2: 回滾後影片沒有自動轉碼

**原因:** 舊版 API 不支援自動轉碼  
**解決:** 這是預期行為，可以手動觸發轉碼或等待恢復新版

### Q3: 回滾後部分照片無法預覽

**原因:** 舊版 API 縮圖生成邏輯不同  
**解決:** 
```bash
# 手動觸發縮圖生成
curl -X POST https://calendar.funlearnbar.synology.me/api/learning-records/regenerate-thumbnails
```

### Q4: Docker 容器無法啟動

**原因:** server.js 語法錯誤  
**解決:**
```bash
# 檢查語法
node -c server.js

# 如果有錯誤，回復備份
cp server.js.backup-* server.js

# 重新啟動
docker-compose up -d
```

---

## 再次切換回新版

如果問題已修復，想切換回新版：

1. 將 `server.js` 的註解恢復（重新註解舊版 API）
2. 將 `chunked-uploader.js` 的端點改回 `/api/media/videos/*`
3. 重新啟用 PhotoPreprocessor
4. 重啟服務
5. 測試驗證

---

## 緊急聯絡

- **管理員郵箱:** admin@funlearnbar.com
- **技術支援:** 
- **文檔位置:** `/docs/media-api.md`

---

## 變更記錄

| 日期 | 版本 | 說明 |
|------|------|------|
| 2025-11-03 | 1.0.0 | 初版回滾指南 |

---

**最後更新:** 2025-11-03  
**文檔狀態:** ✅ 已驗證

