<!-- bd8f011c-3dd8-4093-9533-eef3e0edaca0 d3601d6e-3167-4b2b-b9aa-e9043aac249d -->
# Synology Drive API 整合重構計畫

## 專案範圍

將 FLB 學習歷程上傳系統從本地檔案儲存重構為 Synology Drive API 儲存，包含所有上傳、預覽、刪除功能。

---

## 第一階段：完整備份與環境準備

### 1.1 創建專案備份

- 在專案根目錄創建 `backups/backup-YYYYMMDD-HHMMSS/` 目錄
- 備份所有相關檔案：
  - `server.js`（主伺服器）
  - `public/learning-record-upload.html`（前端頁面）
  - `public/js/pages/learning-record-upload.js`（前端主程式）
  - `public/js/modules/learning-upload/`（所有上傳相關模組）
  - `package.json`（依賴清單）
  - 現有 `data/learning-portfolio/` 結構範例（僅結構，不含實際檔案）

### 1.2 研究 Synology Drive API

基於網路搜尋結果，Synology Drive 使用以下 API：

**認證 API（SYNO.API.Auth）**

```
POST /webapi/entry.cgi
api=SYNO.API.Auth
version=3
method=login
account=<username>
passwd=<password>
session=FileStation
format=sid
```

**上傳 API（SYNO.FileStation.Upload）**

```
POST /webapi/entry.cgi
api=SYNO.FileStation.Upload
version=2
method=upload
path=<destination_folder>
create_parents=true
overwrite=true
_sid=<session_id>
```

**列表 API（SYNO.FileStation.List）**

```
GET /webapi/entry.cgi
api=SYNO.FileStation.List
version=2
method=list
folder_path=<path>
_sid=<session_id>
```

**刪除 API（SYNO.FileStation.Delete）**

```
POST /webapi/entry.cgi
api=SYNO.FileStation.Delete
version=2
method=delete
path=<file_path>
_sid=<session_id>
```

**下載/預覽 API（SYNO.FileStation.Download）**

```
GET /webapi/entry.cgi
api=SYNO.FileStation.Download
version=2
method=download
path=<file_path>
mode=open (for preview)
_sid=<session_id>
```

---

## 第二階段：建立 Synology Drive 客戶端模組

### 2.1 創建核心客戶端 `synology-drive-client.js`

建立新模組 `synology-drive-client.js`，實作：

**基礎功能**

- `login()` - 認證並獲取 SID
- `logout()` - 登出並清除 SID
- `ensureAuthenticated()` - 確保有效的 SID（自動重新認證）

**檔案操作**

- `uploadFile(localPath, remotePath, metadata)` - 上傳單個檔案
- `uploadMultipleFiles(files, remoteFolder)` - 批次上傳
- `listFiles(remotePath)` - 列出目錄檔案
- `deleteFile(remotePath)` - 刪除檔案
- `getFileUrl(remotePath)` - 獲取預覽/下載 URL
- `createFolder(remotePath)` - 創建目錄（支援遞迴創建）

**錯誤處理**

- 統一錯誤格式
- 自動重試機制（網路錯誤）
- SID 過期自動重新認證

### 2.2 環境變數配置

在 `.env.nas` 新增：

```env
SYNOLOGY_HOST=your-synology-host.synology.me
SYNOLOGY_PORT=5001
SYNOLOGY_PROTOCOL=https
SYNOLOGY_USERNAME=your-username
SYNOLOGY_PASSWORD=your-password
SYNOLOGY_DRIVE_ROOT=/FLB-Learning-Portfolio
```

### 2.3 建立路徑管理模組 `drive-path-manager.js`

負責將現有路徑結構映射到 Drive：

**路徑格式**

```
/FLB-Learning-Portfolio/{學期}/{課程名稱}/{日期}_{主題}/{學生名稱或課程總覽}/
```

例如：

```
/FLB-Learning-Portfolio/114-1/SPIKE 三 18:30-20:30 第8週/2025-11-05_四足獸/蔡定言/
```

**功能**

- `buildPath(semester, courseName, date, topic, studentName)` - 構建完整路徑
- `parsePath(fullPath)` - 解析路徑為元件
- `ensureFolderExists(path)` - 確保路徑存在

---

## 第三階段：重構後端 API

### 3.1 替換 Multer 為記憶體儲存

修改 `server.js`：

```javascript
// 舊版（刪除）
const storage = multer.diskStorage({...});

// 新版
const storage = multer.memoryStorage(); // 暫存於記憶體
const upload = multer({
  storage: storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB
});
```

### 3.2 重構上傳 API `/api/learning-portfolio`

**流程**

1. 接收前端上傳（含 Buffer）
2. 構建 Drive 路徑（使用 `drive-path-manager`）
3. 調用 `synology-drive-client.uploadFile()`
4. 儲存元資料到 Drive（`record-meta.json`）
5. 回傳成功訊息（含 Drive 檔案 ID）

**新增功能**

- 支援分片上傳（大檔案 > 100MB）
- 上傳進度回報（透過 WebSocket 或 SSE）
- 失敗自動重試

### 3.3 重構預覽 API `/api/learning-portfolio/:semester/:course/:date/:student`

**流程**

1. 接收查詢參數
2. 構建 Drive 路徑
3. 調用 `synology-drive-client.listFiles()`
4. 讀取 `record-meta.json`
5. 為每個檔案生成預覽 URL（使用 `getFileUrl()`）
6. 回傳檔案列表和預覽 URL

**URL 策略**

- 照片：直接使用 Drive 預覽 URL（帶 SID）
- 影片：生成縮圖 + 預覽 URL
- 前端使用代理 URL（避免暴露 SID）

### 3.4 重構刪除 API `/api/learning-portfolio/delete`

**流程**

1. 接收檔案路徑或 ID
2. 驗證權限
3. 調用 `synology-drive-client.deleteFile()`
4. 更新元資料（移除記錄）
5. 回傳成功訊息

### 3.5 新增代理 API `/api/drive-media/:path`

為安全性，不直接暴露 Drive URL 給前端：

```javascript
app.get('/api/drive-media/*', async (req, res) => {
  const filePath = req.params[0];
  const fileStream = await driveClient.getFileStream(filePath);
  fileStream.pipe(res);
});
```

---

## 第四階段：更新前端邏輯

### 4.1 修改上傳邏輯（不需大幅改動）

`shared-media-uploader.js` 和 `shared-integration.js`：

- 保持現有上傳流程
- 後端會自動處理 Drive 儲存
- 前端無需知道儲存位置

### 4.2 修改預覽邏輯

`shared-media-loader.js` 和 `shared-media-previewer.js`：

- 將本地路徑 `/data/learning-portfolio/...` 替換為代理路徑 `/api/drive-media/...`
- 保持現有預覽組件不變

### 4.3 修改刪除邏輯

`learning-record-upload.js` 中的刪除函數：

- API 端點保持不變 `/api/learning-portfolio/delete`
- 後端會處理 Drive 刪除

---

## 第五階段：資料遷移與測試

### 5.1 資料遷移腳本（可選）

創建 `scripts/migrate-to-drive.js`：

- 讀取 `data/learning-portfolio/` 結構
- 批次上傳到 Synology Drive
- 保持相同目錄結構
- 生成遷移報告

### 5.2 測試計畫

**單元測試**

- `synology-drive-client.js` 各功能
- 路徑管理功能
- 錯誤處理

**整合測試**

- 上傳流程（小檔案、大檔案）
- 預覽功能（照片、影片）
- 刪除功能
- 並發上傳

**端到端測試**

- 完整上傳工作流程
- 學生模式上傳
- 課程總覽上傳
- 歷史記錄查詢

---

## 第六階段：部署與監控

### 6.1 部署前檢查清單

- [ ] 環境變數配置完成
- [ ] Synology Drive API 連線測試通過
- [ ] 所有測試通過
- [ ] 備份現有資料
- [ ] 文檔更新

### 6.2 逐步部署策略

1. **第一階段**：僅新上傳使用 Drive（舊資料保持本地）
2. **第二階段**：預覽功能切換到 Drive
3. **第三階段**：完全切換到 Drive
4. **第四階段**：清理本地檔案（保留備份）

### 6.3 監控與日誌

- Drive API 呼叫次數
- 上傳成功率
- 錯誤類型統計
- 平均回應時間

---

## 關鍵檔案清單

### 新增檔案

1. `synology-drive-client.js` - Drive API 客戶端
2. `drive-path-manager.js` - 路徑管理
3. `scripts/migrate-to-drive.js` - 資料遷移腳本（可選）
4. `backups/backup-YYYYMMDD-HHMMSS/` - 完整備份

### 主要修改檔案

1. `server.js` - 上傳/預覽/刪除 API 重構
2. `package.json` - 新增依賴（axios 用於 HTTP 請求）
3. `.env.nas` - Drive 認證配置
4. `public/js/modules/learning-upload/shared-media-loader.js` - 預覽 URL 更新

### 保持不變（最小修改）

1. `public/learning-record-upload.html` - 前端 HTML 結構
2. `public/js/pages/learning-record-upload.js` - 核心邏輯
3. 前端上傳模組（`shared-media-uploader.js` 等）

---

## 風險與緩解

### 風險 1：Drive API 限制

- **風險**：請求頻率限制、檔案大小限制
- **緩解**：實作請求佇列、分片上傳

### 風險 2：網路不穩定

- **風險**：上傳中斷、下載失敗
- **緩解**：自動重試機制、斷點續傳

### 風險 3：SID 過期

- **風險**：長時間操作後認證失效
- **緩解**：自動檢測並重新認證

### 風險 4：遷移資料遺失

- **風險**：遷移過程中資料損壞
- **緩解**：完整備份、分批驗證、保留本地副本

---

## 預估時程

- **第一階段（備份與準備）**：0.5 天
- **第二階段（Drive 客戶端）**：2 天
- **第三階段（後端 API）**：3 天
- **第四階段（前端更新）**：1 天
- **第五階段（測試）**：2 天
- **第六階段（部署）**：1 天

**總計**：約 9.5 工作天

---

## 成功標準

- ✅ 所有上傳功能正常運作
- ✅ 預覽速度不低於原系統
- ✅ 刪除功能即時生效
- ✅ 目錄結構與原系統一致
- ✅ 錯誤處理完善，用戶體驗友善
- ✅ 無資料遺失
- ✅ 系統穩定運行 7 天無重大錯誤

### To-dos

- [ ] 創建完整專案備份到 backups/ 目錄（含時間戳）
- [ ] 建立 synology-drive-client.js 模組（認證、上傳、列表、刪除、預覽）
- [ ] 建立 drive-path-manager.js 模組（路徑構建與解析）
- [ ] 更新 .env.nas 新增 Synology Drive 認證資訊
- [ ] 重構 server.js 上傳 API，整合 Drive 客戶端（替換 multer disk storage）
- [ ] 重構 server.js 預覽 API，從 Drive 讀取檔案列表
- [ ] 重構 server.js 刪除 API，調用 Drive 刪除功能
- [ ] 新增 /api/drive-media/* 代理端點（安全預覽檔案）
- [ ] 更新前端預覽 URL 從本地路徑改為代理路徑
- [ ] 撰寫並執行單元測試（Drive 客戶端、路徑管理）
- [ ] 執行整合測試（上傳、預覽、刪除完整流程）
- [ ] 部署到生產環境並監控運行狀態