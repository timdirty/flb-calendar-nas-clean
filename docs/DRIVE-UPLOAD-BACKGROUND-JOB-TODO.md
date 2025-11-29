# Drive 背景上傳 Job 待辦清單（Phase 2）

> 目標：將「寫入 Synology Drive」改為背景 Job，縮短前端同步等待時間，避免上傳大檔時卡在 100%。
>
> 範圍優先：先完成 V2 Chunk Pipeline（`/api/drive-upload/*`）的背景化，再視情況擴充到舊版直傳 `/learning-records/upload-drive`。

---

## 一、現況摘要

- 大檔上傳流程：
  - 前端：`/api/drive-upload/init` → 多次 `/chunk` → `/complete`。
  - 後端：`handleDriveUploadComplete`：
    - `mergeDriveChunks(session)` 合併為本機大檔。
    - `learningUploadHelper.uploadMediaFromLocalFile`：
      - 呼叫 `SynologyDriveClient.uploadFile` 寫入 Drive。
      - 產生縮圖（影片）。
      - 更新 `photos-meta.json` / `videos-meta.json` / `record-meta.json`。
      - 更新 `driveMediaIndex`。
- 小檔（直傳）流程：
  - `/learning-records/upload-drive` → `uploadStudentRecord` / `uploadOverviewRecord`，內部同樣直接呼叫 `driveClient.uploadFile` + meta。
- 問題：
  - Synology Drive I/O 與網路延遲高，`uploadFile` 可能 timeout + 重試，導致整個 HTTP 請求長時間佔住，前端維持在「上傳中 100%」。

---

## 二、整體設計（目標狀態）

### 2.1 核心概念

- 將「寫入 Synology Drive + 產生縮圖 + 更新 meta / index」改為**背景 Job**：
  - 前端 HTTP 請求只負責：
    - 完成 chunk 併檔（或接收小檔）。
    - 建立一筆 Job（JSON）。
    - 立即回應 200/202，狀態為 `queued`。
  - 背景 Worker 定期撿 `pending` Job：
    - 呼叫既有 `uploadMediaFromLocalFile`。
    - 更新 `driveMediaIndex`。
    - 標記 Job `done` / `error`。

### 2.2 階段拆分

- **Phase A：Chunk Pipeline 背景化（優先）**
  - 僅改 `/api/drive-upload/complete` → Job + Worker。
  - 保留直傳 `/learning-records/upload-drive` 暫時同步，避免一次動太多路徑。
- **Phase B：legacy 直傳背景化（選做）**
  - 將 `uploadStudentRecord` / `uploadOverviewRecord` 的 Drive 寫入也改為 Job。
- **Phase C：狀態查詢與觀測（後續）**
  - 新增 `/api/drive-upload/status/:jobId`。（非立即必須）
  - log 與 alert 調整。

---

## 三、Phase A：Chunk Pipeline 背景化（實作順序）

> 目標：`/api/drive-upload/complete` 不再同步寫入 Drive，只建立 Job 並快速回應。

### A-1. 建立 Job Queue 資料結構

- [ ] **建立檔案** `services/drive-upload-queue.js`：
  - [ ] 匯入必要模組：`fs`, `path`, `crypto` 或 `uuid`、`safe-file-operations`（若已存在）。
  - [ ] 常數：
    - [ ] `QUEUE_FILE_PATH`：放在 `data/drive-upload-jobs.json`。
    - [ ] `DEFAULT_MAX_ATTEMPTS = 3`。
  - [ ] 函式：
    - [ ] `loadQueue()` / `saveQueue(queue)`：安全讀寫 JSON（空檔時要自動補 `{ jobs: [] }`）。
    - [ ] `enqueueJob(payload)`：
      - 生成 `id`（時間戳 + 隨機字串）。
      - 設定欄位：`status: 'pending'`, `attempts: 0`, `createdAt`, `updatedAt`。
      - 寫回檔案並回傳新增 job。
    - [ ] `getPendingJobs(limit)`：
      - 讀檔 → 篩 `status === 'pending'`，依 `createdAt` 排序，取前 `limit` 筆。
    - [ ] `updateJob(id, patch)`：
      - 找到 job，套用 patch，更新 `updatedAt`，寫回檔案。
    - [ ] `markJobDone(id, extra)` / `markJobError(id, error)`（可包成 helper）。

### A-2. 調整 `/api/drive-upload/complete` → 建立 Job

- [ ] 在 `server.js` 的 `handleDriveUploadComplete` 中：
  - [ ] **保留**：
    - `ensureDriveServicesReady` 檢查。
    - 取得 `uploadId`、`session`、`mergedMetadata`、`context` 等邏輯。
  - [ ] **變更**：
    - [ ] 原本：

      ```js
      mergedFilePath = await mergeDriveChunks(session);
      const uploadResult = await learningUploadHelper.uploadMediaFromLocalFile({ ... });
      await driveMediaIndex.appendRecord({...uploadResult...});
      res.json({ success: true, record: {...} });
      ```

    - [ ] 改為：

      ```js
      const mergedFilePath = await mergeDriveChunks(session);

      const job = await driveUploadQueue.enqueueJob({
        localPath: mergedFilePath,
        semester: context.semester,
        courseName: context.courseName,
        date: context.date,
        topic: context.topic,
        studentName: context.studentName,
        isOverview: context.isOverview,
        mediaCategory: determineMediaCategory(session.fileType, session.filename),
        source: 'chunk'
      });

      await driveChunkRegistry.removeSession(uploadId, { skipFilesystemCleanup: true });

      return res.status(202).json({
        success: true,
        status: 'queued',
        jobId: job.id
      });
      ```
  - [ ] **錯誤處理調整**：
    - 如果 `mergeDriveChunks` 失敗，仍回 500（屬於前半段問題）。
    - Job 建立失敗時回 500，確保前端看到明確錯誤。

### A-3. 新增背景 Worker（同一 Node 進程）

- [ ] 在 `server.js` 初始化區域：
  - [ ] 匯入 `drive-upload-queue` 模組。
  - [ ] 新增環境變數開關：`ENABLE_DRIVE_UPLOAD_WORKER`（預設 `true` 在 dev）。
  - [ ] 若啟用，設定 `setInterval(processDriveUploadJobs, 5000)`。

- [ ] 實作 `processDriveUploadJobs`：

  ```js
  async function processDriveUploadJobs() {
    try {
      const maxConcurrent = 1; // 先保守一支一支處理
      const jobs = await driveUploadQueue.getPendingJobs(maxConcurrent);
      for (const job of jobs) {
        await driveUploadQueue.updateJob(job.id, { status: 'processing', attempts: job.attempts + 1 });
        try {
          const result = await learningUploadHelper.uploadMediaFromLocalFile({
            localPath: job.localPath,
            originalName: job.originalName,
            mimeType: job.mimeType,
            mediaCategory: job.mediaCategory,
            semester: job.semester,
            courseName: job.courseName,
            date: job.date,
            topic: job.topic,
            studentName: job.studentName,
            isOverview: job.isOverview
          });

          // append 到 driveMediaIndex
          const mediaId = (result.mediaEntry && result.mediaEntry.id) || `drive-${Date.now()}-${Math.random().toString(16).slice(2,8)}`;
          await driveMediaIndex.appendRecord({
            id: mediaId,
            drivePath: result.remotePath,
            proxyUrl: result.proxyUrl,
            mimeType: result.mimeType,
            size: result.size,
            courseName: job.courseName,
            studentName: job.studentName,
            dateKey: job.date,
            isOverview: job.isOverview,
            uploadedAt: Date.now()
          });

          await driveUploadQueue.markJobDone(job.id, { mediaId, proxyUrl: result.proxyUrl });

          // 清理 localPath
          try { await fs.promises.unlink(job.localPath); } catch (_) {}
        } catch (err) {
          const hasMore = (job.attempts || 0) + 1 < (job.maxAttempts || 3);
          await driveUploadQueue.markJobError(job.id, {
            message: err.message,
            hasMoreAttempts: hasMore
          });
        }
      }
    } catch (e) {
      console.error('❌ [DriveUploadWorker] 處理 Job 失敗:', e);
    }
  }
  ```

> 實作時要依專案現有的 log 風格與 helper 實際簽名做微調，上述為結構示意。

### A-4. 前端 Chunk 完成回應調整

- [ ] 在 `frontend-v2/src/services/upload/chunkUploadClient.ts` 的 `completeChunkUpload` 中：
  - [ ] 支援 202 + `status: 'queued'` 回傳：
    - 若 `response.status === 202` 或 `response.data.status === 'queued'`，回傳：

      ```ts
      return {
        success: true,
        uploadId,
        // record 為 null 或部分資訊，但標註 queued
        record: undefined,
        status: 'queued',
        jobId: (response.data as any).jobId,
      } as any;
      ```

- [ ] 在 `App.tsx` → `handleStartUpload` 大檔處理區段：
  - [ ] 呼叫 `completeChunkUpload` 後：
    - 若有 `record.proxyUrl`：維持現有邏輯 `completeFile(..., proxyUrl)`。
    - 若 `status === 'queued'`：
      - 先 `completeFile(currentTask.id, entry.id, '')`。
      - （選擇性）在 `uploadStore` 為該 file 記錄 `isProcessing: true` & `jobId`。

- [ ] 在 `FilePreview` / 狀態顯示：
  - [ ] 若 file 已經 `completed` 但 `isProcessing === true`，文案改為「已送達（伺服器處理中）」；
  - [ ] 完全成功後（未來若有 `/status`）可再進一步更新。

---

## 四、Phase B：legacy 直傳背景化（之後再做）

> 先記錄 todo，等 Phase A 穩定後再依需求啟動。

- [ ] 將 `learning-upload-helper.uploadStudentRecord` / `uploadOverviewRecord` 中的 `driveClient.uploadFile` 呼叫改為：
  - 寫入 NAS 暫存檔。
  - 建立 Job，字段與 Phase A 類似，但 source 標記為 `legacy`。
  - 立即回傳「已排程上傳」的結果給前端。
- [ ] 後端現有使用這兩個 helper 的 API（舊版 UI）要同步調整回傳格式與錯誤訊息。

---

## 五、Phase C：狀態查詢與觀測（選做）

- [ ] 新增 `GET /api/drive-upload/status/:jobId`：
  - 回傳：`{ status, attempts, error, mediaId, proxyUrl }`。
- [ ] 前端（V2）：
  - 在上傳完成後，可選擇性輪詢幾次狀態（例如 3 分鐘內每 10 秒一次），
    將「已送達（伺服器處理中）」更新為「已完成」。
- [ ] 觀測與告警：
  - 若 job 長時間停在 `pending` / `processing` 可在 log 中輸出警示訊息，後續再視情況接入告警系統。

---

## 六、實作與驗證流程建議

1. **先完成 Phase A 的程式碼修改**：
   - services/drive-upload-queue.js
   - server.js：`handleDriveUploadComplete` + Worker 初始化。
   - chunkUploadClient + App.tsx 前端調整。

2. **本地測試 Scenario**：
   - 單一大檔（chunk route）：
     - 觀察：
       - `/drive-upload/chunk` → 多個 200。
       - `/drive-upload/complete` → 202 queued。
       - 立刻看到前端顯示「已送達（伺服器處理中）」。
       - 過一段時間後檢查 Drive：檔案與縮圖存在，meta / index 正確。
   - Synology 故意斷線或變慢：
     - Worker log 應該顯示 retry / error，job 狀態變為 error；
     - 前端仍不會被長時間 block。

3. **觀察一段時間 log，確認沒有 Job 堆積或 localPath 未被清理**。

4. **若行為穩定，再考慮啟動 Phase B / Phase C。**
