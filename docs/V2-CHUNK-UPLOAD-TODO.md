# V2 Chunk Upload 開發待辦與階段規劃

> 搭配閱讀：`docs/V2-CHUNK-UPLOAD-DESIGN.md`
>
> 目標：為 V2 學生學習紀錄與課程總覽建立穩定的分片上傳機制，提升大檔影片在不穩網路下的成功率，並保持與既有直傳流程（/api/learning-records/upload-drive）的共存與可回退能力。

---

## 0. 執行原則與邊界

- [x] **維持後端唯一分片管線**：前端一律透過 `/api/drive-upload/init|chunk|complete`，不再新增 `/api/learning-records/chunk/*`。（2025-11-25 已確認並更新設計文件）
- [x] **與現有直傳共存**：小檔維持舊流程，大檔才啟用 chunk；可透過 feature flag 一鍵關閉。（2025-11-25 V2 學生／總覽皆已依 `ENABLE_CHUNK_UPLOAD` 決策）
- [x] **避免一次大改**：先讓單一大檔流程穩定，再擴充多檔混合、批次上傳等情境。（2025-11-25 目前僅針對單課程的檔案上傳調整）
- [ ] **所有錯誤有明確訊息**：包含「檔案過大、網路 timeout、伺服器錯誤、使用者取消」。
- [ ] **每一階段皆可獨立驗證**：有對應的測試指令／手動驗證步驟。

---

## 1. Phase 0：現況確認與後端健康檢查

- [x] **確認 `/api/drive-upload/*` 狀態**
  - [x] 閱讀 `server.js` 中 `handleDriveUploadInit/Chunk/Complete` 實作與 `MediaSessionRegistry` 行為（已完成一次，但實作變更時需再檢查）。
  - [x] 閱讀 `learning-upload-helper.uploadMediaFromLocalFile`，確認課程總覽與學生記錄路徑推導邏輯。
- [ ] **執行整合測試腳本（選用於迭代節點）**
  - [ ] 啟動 dev server（3002）並確認健康：`curl http://localhost:3002/health`。
  - [ ] 執行 `node tests/integration/test-drive-api.js`，確認：
    - [ ] 三個檔案（小圖 / 中圖 / 大影片）皆能透過 `/api/drive-upload/*` 成功上傳。
    - [ ] `/api/learning-records/save` 可順利關聯 mediaIds。
- [ ] **確認後端檔案大小限制配置**
  - [ ] 確認 `.env.nas` 中 `MEDIA_FILE_MAX_SIZE` 與 `MEDIA_CHUNK_MAX_SIZE`，確保與前端預設 `LARGE_FILE_THRESHOLD_MB` 一致或合理。

---

## 2. Phase 1：前端共用 Chunk Upload Client 與設定

> 目標：建立一個供 V2 學生／課程總覽共用的 chunk upload client，不直接綁定 UI，方便後續 hook/component 使用。

### 2.1 設定檔與常數

- [x] 新增（或擴充）前端設定檔：`frontend-v2/src/services/upload/uploadConfig.ts`
  - [x] `LARGE_FILE_THRESHOLD_MB`（預設 100MB，可日後調整）
  - [x] `CHUNK_SIZE_SMALL = 10 * 1024 * 1024`
  - [x] `CHUNK_SIZE_LARGE = 15 * 1024 * 1024`
  - [x] `CHUNK_MAX_RETRIES = 3`
  - [x] `CHUNK_REQUEST_TIMEOUT_MS = 120000`
  - [x] `ENABLE_CHUNK_UPLOAD`（來自 Vite env，預設開啟） （2025-11-25 建立 uploadConfig.ts 完成）

### 2.2 Chunk Upload Client 模組

- [x] 新增 `frontend-v2/src/services/upload/chunkUploadClient.ts`
  - [x] 定義型別：
    - [x] `ChunkUploadMetadataBase`（共用欄位：`semester, courseName, date, studentName, topic, mode, relativePathUnified` 等）
    - [x] `ChunkInitResult`、`ChunkUploadProgress`、`ChunkCompleteResult`
  - [x] `initChunkUpload(file, metadata)`：
    - [x] 呼叫 `POST /api/drive-upload/init`（JSON）
    - [x] 計算 / 決定 `chunkSize`（依檔案大小選 small / large）
    - [x] 回傳 `{ uploadId, totalChunks, chunkSize, expiresAt }`
  - [x] `uploadChunk({ uploadId, chunkIndex, blob, signal })`：
    - [x] 建立 `FormData`：`chunk`, `uploadId`, `chunkIndex`
    - [x] 支援 `AbortController` 中止請求（介面已預留 `signal`，目前未在 App 中使用）
    - [x] 內建重試機制（最多 `CHUNK_MAX_RETRIES` 次；限網路錯誤、timeout、5xx）
    - [x] 回傳 `{ success, receivedChunks, totalChunks, progress }`
  - [x] `completeUpload({ uploadId, metadata })`：
    - [x] 呼叫 `POST /api/drive-upload/complete`（JSON）
    - [x] 回傳後端 `record` 結構（`DriveMediaRecord`）
  - [x] 統一錯誤格式：
    - [x] 自訂錯誤型別 `ChunkUploadError`，包含 `code`（`TIMEOUT | NETWORK | SERVER | CLIENT | CANCELLED`）與 `message`。（2025-11-25 完成初版 client 實作）

### 2.3 單元測試／模擬測試（可延後）

- [ ] 為 `chunkUploadClient` 撰寫基本單元測試（mock fetch / axios）：
  - [ ] init 正常回傳與錯誤路徑
  - [ ] chunk 上傳重試邏輯
  - [ ] complete 成功與錯誤處理

---

## 3. Phase 2：V2 學生媒體上傳整合 Chunk Upload

> 目標：針對 V2 學生學習紀錄上傳，將「大檔影片」改走 chunk upload，並為每個檔案提供 `status + progress + errorMessage`。

### 3.1 鎖定整合點（程式檔案）

- [x] 在 `frontend-v2` 中尋找並確認：
  - [x] 學生媒體上傳 hook：`src/hooks/useUpload.ts`（`useUploadStudentRecord`）。
  - [x] 學生上傳 UI／流程：`src/App.tsx`（`handleFilesSelect` + `handleStartUpload`）。
  - [x] 呼叫 `/api/learning-records/upload-drive` 的封裝模組：`src/services/api/uploadApi.ts`。
- [x] 在 TODO 檔中補上實際檔名與路徑，方便後續查閱。（2025-11-25 已補）

### 3.2 建立 per-file 狀態模型

- [ ] 定義 `UploadItem` 型別，用於 V2 學生上傳：
  - [ ] `id: string`
  - [ ] `file: File`
  - [ ] `kind: 'photo' | 'video'`
  - [ ] `strategy: 'legacy' | 'chunk'`
  - [ ] `status: 'idle' | 'uploading' | 'processing' | 'success' | 'error'`
  - [ ] `progress: number`
  - [ ] `errorMessage?: string`
  - [ ] `uploadId?: string`
  - [ ] `record?: DriveMediaRecord`
- [ ] 在 hook / component 中維護 `uploadItems[]`，取代原本僅靠單一整體進度的狀態。

### 3.3 決策：legacy vs chunk

- [ ] 在選檔或上傳準備階段：
  - [ ] 若 `ENABLE_CHUNK_UPLOAD === false` → 全部 `strategy: 'legacy'`，維持舊行為。
  - [ ] 若為影片且 `file.size > LARGE_FILE_THRESHOLD_MB` → `strategy: 'chunk'`。
  - [ ] 其餘檔案（包含小影片、小照片）→ `strategy: 'legacy'`。

### 3.4 實作大檔 chunk 上傳流程

- [x] 針對每個 `strategy === 'chunk'` 的影片檔（實作集中在 `App.tsx/handleStartUpload`）：
  - [x] 呼叫 `initChunkUpload(file, metadata)`，metadata 包含：`semester, courseName, date, studentName, topic` 與 `mode: 'student'`。
  - [x] 使用 `file.slice` 依 `chunkSize` 切片並逐個呼叫 `uploadChunk`，每完成一個 chunk 以 bytes 比例更新 `updateFileProgress`。
  - [x] 所有 chunk 完成後呼叫 `completeChunkUpload`，將回傳的 `record.proxyUrl` 寫入對應檔案（`completeFile`）。
- [x] 錯誤處理：
  - [x] 若多次重試後仍失敗，將該檔案 `status` 標為 `error`，並顯示錯誤訊息。
  - [x] 若屬於 timeout（`ChunkUploadError.code === 'TIMEOUT'`），以友善文案提示並設定 `globalError`。（2025-11-25 完成學生端 chunk 流程接線）

### 3.5 Legacy 小檔流程維持

- [x] 現有 `/api/learning-records/upload-drive` 呼叫保持：
  - [x] 僅針對非大檔或未啟用 chunk 的檔案（`legacyEntries`）。
  - [x] 使用現有 `onUploadProgress` 更新這些檔案的 progress。
  - [x] 依檔案大小比例拆配整體進度（以 request bytes 為基礎，平均套用於 legacy 檔案）。（2025-11-25 已在 `handleStartUpload` 中完成）

### 3.6 學生端 UI 調整

- [ ] 在 V2 學生上傳列表中：
  - [ ] 顯示每個檔案的 `status`（上傳中／排隊中／失敗／完成）。
  - [ ] 顯示 `progress` 百分比或圓環條。
  - [ ] 在 `status === 'error'` 時顯示錯誤訊息與「重試」按鈕。
  - [ ] 在大檔上傳中可標示「分段上傳中」字樣，讓老師知道這支影片正在特別處理。

---

## 4. Phase 3：V2 課程總覽 Chunk Upload 整合

> 目標：課程總覽影片也能使用分片上傳，並正確寫入 `isOverview` 媒體記錄。

### 4.1 整合點確認

- [x] 在 `frontend-v2` 中尋找：
  - [x] 課程總覽上傳 hook / component：`App.tsx` 中的 `handleStartOverviewUpload` + `useUploadOverviewRecord`。
  - [x] 呼叫 `/api/learning-records/upload-drive` 上傳 `overviewPhotos` / `overviewVideos` 的位置：`src/services/api/uploadApi.ts`。

### 4.2 決策與 metadata 差異

- [x] 同樣以 `ENABLE_CHUNK_UPLOAD` 與 `LARGE_FILE_THRESHOLD_MB` 決定 legacy vs chunk（在 `handleStartOverviewUpload` 中以 `overviewLegacyFiles` / `overviewChunkFiles` 分流）。
- [x] chunk metadata 改用：
  - [x] `mode: 'overview'`
  - [x] `semester, courseName, date, topic` 由當前課程資訊推導。
  - [ ] 未使用 `relativePathUnified`（未來如需可再補）。

### 4.3 課程總覽 UI 調整

- [x] 在 V2 課程總覽媒體上傳區塊中：
  - [x] 以 `overviewPreviewFiles` 的 `status/progress` 顯示上傳進度（小檔直傳 + 大檔 chunk）。
  - [ ] 區分「學生媒體」與「總覽媒體」的標籤或說明文字（目前僅文案區隔，尚未額外標籤）。

---

## 5. Phase 4：錯誤處理、Timeout 與 UX 統一

> 目標：不論是 legacy 還是 chunk，上傳失敗時都能給老師明確、集中且不吵的提示。

- [ ] 定義錯誤文案對照表（可放在 `frontend-v2/src/config/errorMessages.ts` 或類似位置）：
  - [ ] 檔案過大（後端 400 + `檔案過大`）
  - [ ] 網路 timeout / 連線錯誤
  - [ ] 伺服器錯誤（5xx）
  - [ ] 使用者主動取消
- [ ] 建立「全域上傳錯誤 banner」機制：
  - [ ] 當多個上傳同時發生 timeout / 5xx 時，在畫面上方顯示醒目的錯誤列。
  - [ ] banner 支援關閉，但一段時間內若再出現嚴重錯誤可再次顯示。
- [ ] chunk 專屬 UX：
  - [ ] 某支影片多次 chunk 上傳失敗時，將錯誤狀態同步到上傳列表／UploadCenter（如有 V2 對應）。
  - [ ] 提供「僅重試此檔案」的操作，而不影響其他檔案。

---

## 6. Phase 5：測試、驗證與 Rollout 策略

### 6.1 開發環境測試

- [ ] 在 dev（PORT=3002）環境中測試以下情境：
  - [ ] 50MB、150MB、400MB 影片（以 V2 介面實際上傳）。
  - [ ] 多張照片 + 至少一支大影片混合上傳。
  - [ ] 手動中斷網路／切換 Wi-Fi，觀察 chunk 重試與錯誤提示。

### 6.2 與舊版 learning-record-upload.html 比較

- [ ] 確認 V2 新流程不影響舊版頁面：
  - [ ] 仍可使用舊頁面上傳，且不會誤用 `/api/drive-upload/*`。
  - [ ] 舊頁面的 UploadCenter 正常顯示 legacy 上傳進度。

### 6.3 Rollout 與回退

- [ ] 以 `ENABLE_CHUNK_UPLOAD` 作為主開關：
  - [ ] dev 環境預設開啟，方便測試。
  - [ ] production 先以「預設關閉 + 部分時段／帳號啟用」方式灰度釋出（若有需要，可透過設定檔控制）。
- [ ] 規劃回退步驟：
  - [ ] 關閉 `ENABLE_CHUNK_UPLOAD` 後，所有上傳自動回到 `/api/learning-records/upload-drive` 直傳模式。
  - [ ] chunk 專用 UI 標記與錯誤提示需優雅退場，不影響主流程。

---

## 7. 文件與追蹤

- [ ] 維護 `docs/V2-CHUNK-UPLOAD-DESIGN.md`：
  - [ ] 每完成一個 Phase，如有實作差異需更新設計文件。
- [ ] 在此 `V2-CHUNK-UPLOAD-TODO.md` 上持續打勾與補充：
  - [ ] 每次實作完一部分，就更新對應 checkbox 並簡短註記測試結果（可在行尾加入日期與註解）。
- [ ] 若有重大問題與 workaround，新增一份 `docs/V2-CHUNK-UPLOAD-KNOWN-ISSUES.md` 紀錄。
