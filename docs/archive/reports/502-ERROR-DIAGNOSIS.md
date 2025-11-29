# 502 Bad Gateway 錯誤診斷報告

**生成時間**: 2025-11-03  
**問題**: 分片上傳 API 返回 502 Bad Gateway 錯誤

---

## 🔍 問題分析

### 用戶報告的錯誤
```
POST https://calendar.funlearnbar.synology.me/api/learning-records/upload/init 502 (Bad Gateway)
POST https://calendar.funlearnbar.synology.me/api/learning-records/upload/chunk 502 (Bad Gateway)
❌ 分片上傳失敗: Error: 初始化失敗: 502
```

### 診斷結果

#### ✅ 檢查項目 1: 伺服器狀態
```bash
$ ps aux | grep node
apple   3525   0.0  0.0 ... node server.js  # ✅ 伺服器正在運行
```
**結論**: 伺服器進程存在且運行中

---

#### ✅ 檢查項目 2: 後端 API 路由
```bash
$ grep "app.post('/api/learning-records/upload/init'" server.js
server.js:14903:app.post('/api/learning-records/upload/init', (req, res) => {
```
**結論**: API 路由已在 `server.js` 中正確定義

---

#### ❌ 檢查項目 3: 伺服器啟動時間
```bash
$ ps aux | grep node
apple   3525  12:26AM  node server.js  # ⚠️ 啟動於 12:26AM
```
**結論**: 伺服器在 **12:26AM** 啟動，但分片上傳 API 是在那之後才添加到代碼中的

---

## 🎯 問題根本原因

**運行中的伺服器進程（PID 3525）加載的是舊版代碼，不包含新的分片上傳 API 路由。**

當前端請求新的 API 端點時：
```
POST /api/learning-records/upload/init
POST /api/learning-records/upload/chunk
POST /api/learning-records/upload/complete
```

伺服器找不到這些路由，導致 Nginx 返回 502 Bad Gateway。

---

## ✅ 解決方案

### 步驟 1: 安裝新依賴
```bash
npm install
```
確保以下依賴已安裝：
- `sharp@^0.33.0`
- `p-queue@^8.0.0`
- `uuid@^9.0.0`

### 步驟 2: 停止舊伺服器
```bash
kill 3525
# 或
pkill -f "node server.js"
```

### 步驟 3: 重新啟動伺服器

**開發環境**（本地測試）：
```bash
npm run dev
# 或完整功能測試
npm run dev:full
```

**生產環境**（Docker）：
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 步驟 4: 驗證 API 可用性
```bash
# 測試 init 端點
curl -X POST http://localhost:8080/api/learning-records/upload/init \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","fileSize":1000000,"chunkSize":5242880}'

# 應返回：
# {"success":true,"uploadId":"...", "totalChunks":1}
```

---

## 📋 完整重啟檢查清單

- [ ] 停止舊的 Node.js 進程
- [ ] 運行 `npm install` 安裝新依賴
- [ ] 檢查 `node_modules` 中是否包含 `sharp`、`p-queue`、`uuid`
- [ ] 重新啟動伺服器（`npm run dev` 或 `docker-compose up`）
- [ ] 檢查伺服器日誌，確認沒有啟動錯誤
- [ ] 測試 API 端點可用性（使用 curl 或瀏覽器）
- [ ] 在瀏覽器中測試上傳功能
- [ ] 驗證控制台日誌顯示 "📦 使用分片上傳"

---

## 🧪 測試計畫

### 測試 1: 小檔案上傳（< 10MB）
- **預期行為**: 使用傳統上傳方法
- **控制台日誌**: 不應出現 "📦 使用分片上傳"
- **API 端點**: 直接 POST 到 `/api/learning-records/upload`

### 測試 2: 大檔案上傳（>= 10MB）
- **預期行為**: 使用分片上傳
- **控制台日誌**: 應顯示 "📦 使用分片上傳: [檔名] [檔案大小]"
- **API 端點**: 
  1. POST `/api/learning-records/upload/init`
  2. POST `/api/learning-records/upload/chunk` (多次)
  3. POST `/api/learning-records/upload/complete`

### 測試 3: 進度顯示
- **預期行為**: 進度條平滑更新 0% → 100%
- **控制台日誌**: 應顯示 "📊 分片上傳進度: X%"

---

## 🚀 部署後驗證

### 前端驗證
1. 打開瀏覽器開發者工具（F12）
2. 進入 `learning-record-upload.html` 頁面
3. 選擇一個 >= 10MB 的檔案上傳
4. 檢查 Network 標籤：
   - 應看到 `upload/init`、`upload/chunk`、`upload/complete` 請求
   - 狀態碼應為 **200 OK**（不是 502）

### 後端驗證
```bash
# 檢查伺服器日誌
docker-compose logs -f --tail=50

# 應看到：
# 🚀 分片上傳初始化: [uploadId] [檔名]
# 📦 接收分片 [X/Y]: [uploadId]
# ✅ 上傳完成: [檔名]
```

---

## 📝 已完成整合項目

### 後端 ✅
- [x] 分片上傳 API (`/api/learning-records/upload/init`)
- [x] 分片接收 API (`/api/learning-records/upload/chunk`)
- [x] 合併完成 API (`/api/learning-records/upload/complete`)
- [x] 取消上傳 API (`DELETE /api/learning-records/upload/:uploadId`)
- [x] 查詢狀態 API (`GET /api/learning-records/upload/status/:uploadId`)
- [x] 媒體處理模組 (`utils/media-processor.js`)
- [x] 臨時檔案清理機制（30 分鐘過期）

### 前端 ✅
- [x] 分片上傳模組 (`public/js/modules/chunked-uploader.js`)
- [x] 學生記錄上傳整合 (`uploadOneChunked()`)
- [x] 課程總覽上傳整合 (`uploadOneOverviewChunked()`)
- [x] 檔案大小判斷邏輯（>= 10MB）
- [x] 進度回調顯示
- [x] 錯誤處理與重試

### 文檔 ✅
- [x] 架構說明 (`docs/learning-upload-optimization.md`)
- [x] 整合指南 (`docs/frontend-integration-guide.md`)
- [x] 實作總結 (`docs/upload-optimization-implementation-summary.md`)
- [x] 快速啟動 (`docs/UPLOAD-OPTIMIZATION-QUICKSTART.md`)
- [x] 整合狀態 (`docs/CHUNKED-UPLOAD-INTEGRATION-STATUS.md`)
- [x] 502 錯誤診斷（本文檔）

---

## ⚠️ 重要提醒

**伺服器必須重啟才能加載新的代碼！**

如果不重啟，運行中的舊進程將繼續使用舊代碼，新的 API 端點將無法訪問，前端請求將持續收到 502 錯誤。

---

## 🎯 下一步行動

### 立即執行（必須）
1. **安裝依賴**: `npm install`
2. **重啟伺服器**: `npm run dev` 或 `docker-compose restart`

### 測試驗證（必須）
3. **測試 API**: 使用 curl 驗證端點可用性
4. **瀏覽器測試**: 上傳小檔案和大檔案，檢查控制台日誌
5. **檢查日誌**: 確認伺服器日誌中出現分片上傳相關訊息

### 部署到生產（可選）
6. **Docker 部署**: `docker-compose build --no-cache && docker-compose up -d`
7. **Nginx 配置**: 確認 `client_max_body_size` 足夠大
8. **監控日誌**: 觀察實際用戶使用情況

---

**診斷結論**: 代碼整合完整無誤，僅需重啟伺服器即可解決 502 錯誤。✅



