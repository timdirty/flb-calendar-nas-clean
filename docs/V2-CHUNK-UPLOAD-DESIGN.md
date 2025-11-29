# V2 學生學習紀錄 Chunk Upload 設計企劃書

## 1. 背景與目標

- 目前 V2 上傳流程：
  - 前端一次收集一位學生本次所有檔案 (`files: File[]`)，分成 `photos` / `videos`，
    透過 `FormData` 呼叫 `POST /api/learning-records/upload-drive`。
  - 後端使用 `multer.upload.fields([...])` 於單一請求中接收多檔，
    再交由 `learning-upload-helper` 上傳至 Synology Drive 並寫入 metadata。
  - 進度條使用瀏覽器的 `onUploadProgress`，顯示**整個 HTTP 請求的總 bytes** 進度，而非 per-file。
- 問題與限制：
  - 大檔（特別是 > 200–300MB 影片）在行動網路/LTE 下容易卡在 80% 左右失敗，
    需要重新整包上傳一次，體驗不佳。
  - 目前後端只針對單檔設 `multer.limits.fileSize = 600MB`，無分片機制。
  - 進度條無法精準反映「每個檔案」的狀態，老師難以知道是哪支影片拖慢或失敗。

> 目標：
> - 為 V2 學生學習紀錄建立一套可選用的 **Chunk Upload 機制**，
> - 在網路不穩（行動網路）情境下，提高大檔上傳成功率，
> - 並為未來「per-file 進度條」與「斷線續傳」打好基礎。

---

## 2. 現況簡述

### 2.1 前端 V2 上傳流程（學生）

- `useUploadStudentRecord` → `uploadApi.uploadStudentRecord`：
  - 將 `files: File[]` 依 MIME type 切成 `photos[]` / `videos[]`。
  - 組出 `FormData`：`semester, courseName, date, studentName, topic, comment, photos[], videos[]`。
  - 呼叫 `apiClient.post('/learning-records/upload-drive', formData, { onUploadProgress })`。
  - `onUploadProgress` 目前只提供「這次 request 的整體進度」，上層用這個數字去更新 UI。

### 2.2 後端 `/api/learning-records/upload-drive`

- 路由：

```js
app.post('/api/learning-records/upload-drive', upload.fields([
  { name: 'photos', maxCount: 50 },
  { name: 'videos', maxCount: 20 },
  { name: 'overviewPhotos', maxCount: 50 },
  { name: 'overviewVideos', maxCount: 20 },
]), async (req, res) => { ... });
```

- `upload` 使用 `multer`，目前設定：

```js
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 600 * 1024 * 1024, // 600MB（單檔上限）
  },
});
```

- Handler 取得 `req.files.photos / req.files.videos`，交給 `learning-upload-helper` 實際寫入 Drive + metadata。
- 目前沒有專用的 chunk API，也未使用 `mediaChunkUpload`。

---

## 3. 需求與範圍

### 3.1 功能需求

1. **Chunk Upload 支援（大檔專用）**
   - 針對單檔大小 > `LARGE_FILE_THRESHOLD_MB`（例如 100MB），
     前端改走「分片上傳」流程：將影片拆成多個小 chunk（5–15MB），分批傳送。
   - 後端負責暫存所有 chunk，全部到齊後合併成完整檔案，再交由現有 `learning-upload-helper`。

2. **與現有 API 共存**
   - 小檔案（≤ `LARGE_FILE_THRESHOLD_MB`）仍透過現有 `/learning-records/upload-drive` 直傳。
   - Chunk 流程只針對「特定大影片」啟用，避免一次改動過多邏輯。

3. **錯誤處理與重試**
   - 單一 chunk 上傳失敗時，可重試數次（例如 3 次），若仍失敗，回報整支影片上傳失敗。
   - 不要求第一版就支援真正的「斷線後續傳」，但架構上預留 `uploadId + chunkIndex`，日後可擴充。

4. **進度條優化（per-file 粗粒度）**
   - 對於使用 chunk upload 的影片，前端可依「已完成 chunk / 總 chunk」計算該檔案進度。
   - 對於仍走舊直傳流程的檔案，可維持現有行為（總 bytes），但 UI 上以檔案大小比例平均分配。

### 3.2 非功能性需求

- 不影響既有日曆、簽到流程。
- 不影響既有 `learning-record-upload.html` 老版頁面邏輯。
- 不引入大型新依賴（遵守 AGENTS.md：維持既有技術棧）。

---

## 4. 架構與流程總覽

### 4.1 高層流程（大檔影片）

1. 老師在 V2 選取檔案。
2. 前端檢查每個檔案大小：
   - 若 `size <= LARGE_FILE_THRESHOLD_MB`：加入「一般上傳清單」。
   - 若 `size > LARGE_FILE_THRESHOLD_MB`：加入「Chunk 上傳清單」。
3. `handleStartUpload` 送出上傳任務時：
   - 對於「一般清單」：照舊呼叫 `uploadStudentRecord`，一次直傳多檔。
   - 對於「Chunk 清單」：
     1. 呼叫 `POST /api/learning-records/chunk/init`，取得 `uploadId`。
     2. 將該影片 `File` 用 `Blob.slice` 切片，逐個呼叫 `POST /api/learning-records/chunk/upload`。
     3. 全部 chunk 成功後，呼叫 `POST /api/learning-records/chunk/complete`，
        由後端合併檔案並寫入 Drive / metadata。

### 4.2 進度條設計

- **目前**：單一 request 的 `onUploadProgress`，映射到所有檔案的同一數字（整體進度）。
- **改進方向**：
  - 一般直傳：依檔案 `size` 比例，將整體進度拆分給各檔案（估算式 per-file）。
  - Chunk 上傳影片：`per-file` = `已完成 chunk bytes / 檔案總 size`，更精準。

---

## 5. 後端 Chunk Upload 設計

### 5.1 既有 Drive Chunk API（/api/drive-upload/*）

> 備註：原先構想的 `/api/learning-records/chunk/*` 與本節描述概念相同，實作上已統一為可重用的 `/api/drive-upload/*`，供 V2 學生學習紀錄與其他模組共用。

1. `POST /api/drive-upload/init`
   - 請求（`Content-Type: application/json`）：
     - `filename: string`（原始檔名）
     - `fileSize: number`（位元組）
     - `fileType?: string`（MIME type，例如 `video/mp4`）
     - `chunkSize?: number`（單一分片大小，預設 6MB）
     - `metadata?: object | string`：
       - 建議欄位：`semester, courseName, date, dateKey, studentName, topic, mode, relativePathUnified`
       - `mode: 'student' | 'overview'` 影響路徑推導（對應 `resolveDriveContext`）
   - 回應：
     - `{ success: true, uploadId, totalChunks, chunkSize, expiresAt }`
   - 行為：
     - 透過 `MediaSessionRegistry.createSession` 建立上傳會話。
     - 以 `uploadId` 建立暫存目錄 `data/drive-media-temp/<uploadId>/`。
     - 將 `metadata` 存入記憶體中的 session 供 complete 階段使用。

2. `POST /api/drive-upload/chunk`
   - 請求（`multipart/form-data`）欄位：
     - `uploadId: string`
     - `chunkIndex: number`（從 0 開始）
     - `chunk: file`（使用 `mediaChunkUpload.single('chunk')`）
   - 行為：
     - 依 `uploadId` 取得 session，驗證會話存在且未過期。
     - 將收到的臨時檔移動為：`data/drive-media-temp/<uploadId>/chunk_<chunkIndex>`。
     - 更新 `session.receivedChunks`。
   - 回應：
     - `{ success: true, receivedChunks, totalChunks, progress }`

3. `POST /api/drive-upload/complete`
   - 請求（`Content-Type: application/json`）：
     - `uploadId: string`
     - `metadata?: object | string`（可再次覆蓋 / 補充 init 階段的 metadata）
   - 行為：
     - 透過 `MediaSessionRegistry.getSession` 取得 session，確認 `receivedChunks` 數量與 `totalChunks` 一致。
     - 呼叫 `mergeDriveChunks(session)` 依序合併 `chunk_0..chunk_N` 產生暫存完整檔。
     - 透過 `resolveDriveContext(metadata)` 推導：
       - `semester, courseName, dateKey/date, topic, studentName, isOverview`。
     - 呼叫 `learningUploadHelper.uploadMediaFromLocalFile(...)` 將檔案上傳至 Synology Drive，並產生 proxy URL。
     - 透過 `driveMediaIndex.appendRecord(...)` 將媒體記錄寫入 `data/drive-media-index.json`。
     - 最後移除 session 與暫存檔（`driveChunkRegistry.removeSession` + 刪除合併檔）。
   - 回應：
     - `{ success: true, record: { id, storage: 'drive', drivePath, proxyUrl, mimeType, size, courseName, studentName, dateKey, isOverview } }`

4. （選配）`POST /api/drive-upload/cancel`（尚未實作，可保留設計構想）
   - 構想：允許前端中途取消，後端刪除對應 `uploadId` 的暫存資料夾與 session。

### 5.2 檔案儲存與清理策略

- 暫存根目錄：`data/drive-media-temp/`（專供 chunk 暫存使用，由 `MediaSessionRegistry` 管理）。
- 每個上傳：
  - 目錄：`data/drive-media-temp/<uploadId>/`
  - 分片檔案：`chunk_<index>`（例如 `chunk_0`, `chunk_1`, ...）
- 清理：
  - 成功完成：`/complete` 階段會呼叫 `driveChunkRegistry.removeSession(uploadId)`，連同暫存目錄一併移除。
  - 逾時 / 過期：`MediaSessionRegistry.cleanupExpired()` 會定期掃描並移除 `expiresAt` 已過期的 session 與其暫存資料夾。
  - 未來若實作 cancel API，可在取消時立即清理對應 `uploadId`。

---

## 6. 前端 V2 設計

### 6.1 觸發條件與策略

- 增加常數：
  - `LARGE_FILE_THRESHOLD_MB`（例如 100MB）。
  - `CHUNK_SIZE_SMALL/ MEDIUM/ LARGE` 可參考舊版 config：6 / 10 / 15MB。
- 在 V2 上傳流程（`MediaUploader` + `handleStartUpload`）：
  - 判斷每支影片檔案：
    - 若 `size <= LARGE_FILE_THRESHOLD_MB` → 保持在「一般 files 陣列」中，一起走舊 API。
    - 若 `size > LARGE_FILE_THRESHOLD_MB` → 放入「需要 chunk 的影片清單」。

### 6.2 前端 Chunk 上傳流程（單一影片）

1. `init`：
   - 呼叫 `POST /api/drive-upload/init`（`Content-Type: application/json`），傳入：
     - `filename, fileSize, fileType`
     - `chunkSize`（依影片大小決定，如 10MB / 15MB）
     - `metadata` 物件，建議包含：
       - `semester, courseName, date, studentName, topic, mode, relativePathUnified`
   - 取得 `uploadId, totalChunks, chunkSize, expiresAt`，記錄在前端 state。

2. `split & upload`：
   - 使用 `file.slice(start, end)` 將影片切成 chunk，chunk 大小應與 `init` 回傳的 `chunkSize` 一致：
     - 小於 150MB：chunk size 10MB
     - 150MB 以上：chunk size 15MB
   - 對每個 chunk 建立 `FormData`，逐個呼叫 `POST /api/drive-upload/chunk`：
     - 欄位：`chunk`（檔案）、`uploadId`、`chunkIndex`
     - 失敗時重試最多 3 次（網路錯誤或 5xx / timeout），仍失敗則整支影片標記為錯誤，並在 UI 顯示錯誤訊息。
   - 更新 per-file 進度：
     - 以 `已完成 chunk 累積 bytes / 檔案總 size` 為主，必要時可輔助參考 API 回傳的 `progress`。

3. `complete`：
   - 所有 chunk 成功後，呼叫 `POST /api/drive-upload/complete`（`Content-Type: application/json`）：
     - Body：`{ uploadId, metadata }`，`metadata` 可與 init 相同或補充 `relativePathUnified` 等欄位。
   - 若成功：
     - 從回應的 `record` 建立前端媒體列表項目：
       - `id, proxyUrl, mimeType, size, courseName, studentName, dateKey, isOverview` 等。
     - 將該影片標記為 `status: success`，並與現有照片/其他檔案結果一併整理顯示。
   - 若失敗：
     - 將該影片標記為 `status: error`，保留錯誤訊息供 UI 顯示，必要時可提供重新上傳按鈕。

### 6.3 UI 與進度條調整

- 在 V2 前端上傳清單中，每個檔案維護：
  - `status: idle | uploading | processing | success | error`
  - `progress: 0–100`
  - `errorMessage?: string`
- 對於一般直傳檔案：
  - 使用 request 總進度與檔案大小比例估算 per-file 進度（粗略即可）。
- 對於 chunk 大檔：
  - 使用 chunk 完成度來更新 per-file 進度，更精準、對齊實際上傳階段。

---

## 7. 開發步驟建議（Phase by Phase）

### Phase 0：前置清理與保護

- 確認現有 `/api/learning-records/upload-drive` 在區網 + 600MB 上限下穩定可用。
- 為 `mediaChunkTempDir` 增加基本錯誤 log 與防呆（已存在則略過）。

### Phase 1：後端 Chunk API 雛型

1. 在 `server.js` 中掛載 3 個新路由：`/chunk/init`、`/chunk/upload`、`/chunk/complete`。
2. 先用 Postman / `tests/manual` 撰寫簡單測試腳本：
   - 模擬一支小檔案切 3 片上傳，驗證後端可順利合併並寫入暫存。
3. 尚未整合 `learning-upload-helper`，先只完成 「合併成完整檔案」與暫存清理。

### Phase 2：與 `learning-upload-helper` 整合

1. 在 `learning-upload-helper.js` 中新增一個「從本地完整檔案路徑建立影片記錄」的 helper 函數（如已有可重用）。
2. `chunk/complete` 成功合併後，呼叫該 helper 實際寫入 Synology Drive 與 metadata。
3. 建立對應的 `tests/manual` 測試腳本，驗證完整流程（chunk → 合併 → Drive → metadata）。

### Phase 3：前端 V2 整合（實驗開關）

1. 在 V2 的 upload hook / component 中加入 feature flag，例如：`ENABLE_CHUNK_UPLOAD`。
2. 僅在開啟 flag + 檔案大小超過 `LARGE_FILE_THRESHOLD_MB` 時啟用 chunk 流程。
3. 實作 per-file 進度條更新邏輯，並在 UI 標記大檔為「分段上傳中」。
4. 在測試環境（例如 dev port 3002）使用行動網路 / 模擬高延遲環境進行壓力測試。

### Phase 4：穩定後才預設開啟

1. 逐步將 `ENABLE_CHUNK_UPLOAD` 從預設關閉改為預設開啟。
2. 保留環境變數或設定檔開關，以便在問題時快速切回直傳模式。

---

## 8. 測試與驗證建議

- **單檔場景**：
  - 50MB、150MB、400MB 影片，區網 + 行動網路各測一次。
- **多檔混合**：
  - 多張照片 + 1 支大影片，看整體任務完成時間與 per-file 進度是否合理。
- **錯誤場景**：
  - 中途關閉 Wi-Fi / 切換網路，觀察 chunk 重試與錯誤提示。
- **回溯機制**：
  - 若 chunk API 出現嚴重問題，確認仍可改回使用舊 `/upload-drive` 流程（flag 關閉）。

---

## 9. 後續可擴充方向

- 斷線續傳：
  - 依 `uploadId` 查詢已存在的 chunk，僅補傳缺少部分。
- 多學生批次 + chunk 結合：
  - 在 V2 支援一次對多位學生排程上傳，由 queue 控制同時進行的 chunk 任務數量。
- 後端監控：
  - 在 `logs/` 中記錄 chunk 任務統計（成功率、平均時間、失敗分佈）。

