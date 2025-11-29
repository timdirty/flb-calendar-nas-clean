# DRIVE 上傳統一計畫（2025-11-11）

> 目標：所有學習歷程媒體/評語資料僅透過 Synology Drive API 寫入，移除本地 `mediaManager` 實際上傳流程，確保權限、預覽與 Drive App 一致。

## 0. 進度追蹤
| 階段 | 任務 | 負責 | 狀態 | 備註 |
| --- | --- | --- | --- | --- |
| Phase 0 | 現況盤點與影響評估 | Codex | ✅ 完成 | 2025-11-11 | 
| Phase 1 | 後端分片/文字 API 改造 | Codex | ✅ 完成 | 2025-11-11：/api/drive-upload/* 上線、history/preview 強制走 Drive，legacy API 410 | 
| Phase 2 | 前端切換至 Drive API | Codex | ✅ 完成 | 2025-11-11：ChunkedUploader、learning-record-upload.js 全面改用 Drive proxy | 
| Phase 3 | 資料遷移/清理 | Codex | ⏳ 未開始 | 視決策，可能平行進行 | 
| Phase 4 | 驗證/部署/文件更新 | Codex | ⏳ 未開始 | |

> 🔄 2025-11-11：啟動 `docs/LEARNING-RECORD-UPLOAD-REFACTOR-PLAN.md`，所有學習歷程上傳 UI/體驗調整須同步兩份計畫，並優先解決路徑生成問題。
>
> 📊 2025-11-13：建立 [`docs/reports/learning-record-upload-baseline-2025-11-13.md`](./reports/learning-record-upload-baseline-2025-11-13.md) 與 `scripts/metrics/lru-dependency-map.js`，Phase 0 起需每日記錄 TTI／首屏請求數／LIFF OOM 等基準。

> 更新方式：每當完成子任務，立即在此表格與下列章節標記 ✔/⏳/⛔，並記下日期、`npm run dev` 與整合測試結果（是否通過與測試範圍），且完成 `git add` → `git commit` → `git push origin <branch>` 全流程。

## 1. 現況盤點（Phase 0） ✅ 2025-11-11
- `/api/media/videos/*`：現行分片上傳 API，最終寫入 NAS `學習歷程 automatic`。
- `mediaManager` / `media-storage` / `media-index`：本地媒體儲存/轉碼/縮圖服務。
- `LearningUploadHelper` + `/api/learning-records/upload-drive`：Synology Drive API 流程，用於導覽/歷史記錄但尚未接上 ChunkedUploader。
- 前端 `ChunkedUploader` / `FLB.Api.saveRecordMetadata`：仍指向 `/api/media/videos/*` 與 `/api/learning-records/save`。
- 風險：檔案權限在 NAS，本地預覽與 Drive App 不一致；兩套資料儲存難以維運。

## 2. 後端改造（Phase 1）
### 2.1 Drive 分片 API ✅ 2025-11-11
- [x] 設計端點 `/api/media/videos/init|chunk|complete` 改為 Drive 實作，重用分片流程（測試：`npm run dev` ✔，手動分片上傳驗證）。
- [x] `complete`：分片合併後由 `LearningUploadHelper.uploadMediaFromLocalFile` 上傳 Drive，刪除 temp，回傳 `drivePath`/`proxyUrl`/`mediaId`。
- [x] 失敗回滾：Drive 失敗時清理會話並回報錯誤。

### 2.2 評語/metadata 同步 ✅ 2025-11-11
- [x] `/api/learning-records/save`：改為寫入 Drive comment/overview/record-meta，同時整合 Drive mediaIds（測試：`npm run dev` ✔，整合測試：手動儲存紀錄成功）。
- [x] `learning-upload-helper` 對舊資料自動注入 Drive `proxyUrl`/縮圖代理，前端不再呼叫舊影片 API（2025-11-11，`PORT=3002 npm run dev` ✔）。
- [x] `history-drive`/`delete`/`preview` API：全部強制使用 Drive (`learning-upload-helper`)，移除 NAS fallback（2025-11-11）。

### 2.3 清理舊路由 ✅ 2025-11-11
- [x] 前端預覽模組改用 Drive proxy：`media-preview.js`、`shared-media-loader.js` 皆優先使用 `proxyUrl/drivePath`（2025-11-11，`PORT=3002 npm run dev` ✅）。
- [x] `learning-record-upload.js` 移除 `/api/media/videos/*` 兜底，缺少 Drive metadata 時只顯示警示，確保不再呼叫舊 API（`PORT=3002 npm run dev` ✅）。
- [x] 標記 `/api/media/videos/*`、`mediaManager` 為 deprecated：新 `/api/drive-upload/*` 上線，舊端點統一 410 回應。
- [x] 文件更新：本計畫與 AGENTS.md 紀錄唯一路徑為 Drive。

## 3. 前端切換（Phase 2）
- [x] `ChunkedUploader` 改指向新 Drive 分片端點；`complete` 回傳 Drive metadata。
- [x] `ChunkedUploader` / `api-client` 傳遞 `relativePathUnified` + `semester/topic` metadata，並接收 Drive `proxyUrl`（2025-11-11，`PORT=3002 npm run dev` ✅）。
- [x] `api-client.js` 移除本地媒體 API，所有預覽/刪除改用 `/api/drive-media`。
- [x] `learning-record-upload.js`、歷史/預覽/抽屜 UI 驗證仍可使用（全面使用 proxyUrl + Drive path）。
- [x] `FLB.Api.saveRecordMetadata` 維持 `/api/learning-records/save`，payload 與後端保持一致。

## 4. 資料遷移與清理（Phase 3）
- [ ] 盤點 NAS `學習歷程 automatic` 內在 Phase 1 期間新增的檔案，評估是否需搬到 Drive。
- [ ] 若需要搬遷：撰寫 `scripts/migrate-media-to-drive.js`，使用 `LearningUploadHelper` 將舊資料上傳 Drive，並更新 metadata。
- [ ] 決定 NAS 舊資料是否保留為 read-only 備份，或同步刪除。

## 5. 驗證／部署／文件（Phase 4）
- [ ] Dev/Stage 驗證：`npm run dev:full` + 實測上傳/歷史/刪除；Drive App 應立即看見新檔案。
- [ ] 生產部署：備份 `.env.nas`、Drive 設定 → 部署 → 驗證 `Drive App`、`learning-record-upload.html`、`history-drive`。
- [ ] 文件更新：`AGENTS.md`、`PROJECT-STRUCTURE.md`、Drive 操作說明。
- [ ] 監控/告警：Drive API 錯誤、SID 到期、磁碟容量。

## 6. 2025-11-11 進度紀錄
- 測試：`PORT=3002 DISABLE_AUTO_REMINDERS=true npm run dev`（成功啟動、完成 Synology Calendar 抓取 419 筆事件）。
- Git：`git add` → `git commit -m "feat: finalize drive upload migration phase1-2"` → `git push origin main` 已完成，主線 commit `4f91d37`（文件備註另以後續小型 commit 推送）。

---
**提醒**：所有改動需遵守「Plan → Build → Update」，每階段完成後更新此檔案與 `AGENTS.md` 內的最新狀態紀錄。

## 7. Step 2 前端細節同步（2025-11-11）

### 7.1 個別檔案 overlay 與進度旗標
- `ensureFilePreviewOverlay` 會在 `PendingMediaActions.updateState/updateProgress`、`updateFileUploadProgress` 等入口自動插入 `.file-uploading-overlay`、進度條與文案，避免 DOM 延遲導致空洞。
- CSS (`public/css/learning-records.css`) 將 overlay 預設為透明，於 `pending/uploading/upload-error` 類別下顯示並允許 pointer-events，`upload-success` 觸發淡出，`loading` 狀態則再次關閉 overlay 以免與縮圖 spinner 衝突。
- 全域進度 UI 旗標：`USE_GLOBAL_PROGRESS_TOAST=false`、`ENABLE_FLOATING_PROGRESS_INDICATOR=false`，僅允許卡片內 overlay 呈現，禁止重新啟用底部 Toast / 浮動指標。

### 7.2 上傳完成後的快取策略
- `AUTO_REFRESH_AFTER_UPLOAD=false`：上傳成功僅呼叫 `mergeLocalUploadedRecord` 更新本地 cache/抽屜，避免立即 `force` 重新抓取 Drive。
- 若未來確需全量比對，請在除錯期間暫時改為 `true`，並於本檔與 `AGENTS.md` 記錄原因與復原時間。

### 7.3 強制重新載入允許情境
僅在下列情境使用 `loadUploadedRecordsForCurrentCourse({ force: true })` 或 `requestCourseReload({ force: true })`：
1. 手動操作：使用者於課程抽屜、Router `force` 參數、或開發中手動點擊「重新整理」按鈕。
2. 例外狀況：Drive API 回傳 404（檔案刪除/目錄遺失）、410（legacy API）、或學生記錄被移除時，由錯誤處理流程觸發。
3. 管理工作：刪除紀錄/附件、批次還原、或 `.env` 旗標 `AUTO_REFRESH_AFTER_UPLOAD=true` 顯式要求。

其他情境必須改用本地快取、`mergeLocalUploadedRecord` 與抽屜渲染結果，禁止為了 UI 微調反覆 `force` reload。

### 7.4 Drive 根路徑（2025-11-11 修正）
- `SYNOLOGY_DRIVE_ROOT`、`DrivePathManager`、前端 `getDriveRoot()` 預設值與所有測試腳本一律設定為 `/Fun Learn Bar/FLB-Learning-Portfolio`。
- 若多加 `/團隊資料夾` 前綴，Synology FileStation API 會回傳 400 並無法自動建立父目錄，因此嚴禁帶該段。
- 更新 .env 與範本後需重新啟動 `npm run dev` 或生產容器，讓 `DrivePathManager` 重新載入根路徑。

## 8. 2025-11-12 變更紀錄（UX 對齊 Phase 0）
- 課程總覽預覽關閉旋轉 spinner（`SharedMediaPreviewer` 支援 `disableSpinner`，由 `SharedIntegration` 於 overview 路徑傳入），統一採用卡片 overlay + 進度條。
- 課程總覽上傳沿用 `FLB.Api.uploadRecordV2`（ChunkedUploader），每張卡片顯示進度與完成狀態；完成後保留卡片，不重抓（Cache-only）。
- 路徑：後端 `DrivePathManager.buildOverviewRecordPath()` 保障「日期＋課程主題」，缺主題時以 `deriveTopicFromCourseName()` 推導，避免額外純日期資料夾。
- 修正 Synology Drive `getFileStream` 介面變更造成 `stream.on is not a function`，`learning-upload-helper` 與照片預覽端點統一 unwrap 串流物件（2025-11-12，待 `npm run dev` 驗證）。
- Upload Center 佇列修復：學生/總覽上傳會於排隊階段即出現在上傳中心，並保留完成紀錄 45 秒，含「排隊中」→「上傳中」→「完成 / 失敗」狀態，`uploadFilesCommon` 別名同步補齊（避免 `uploadFilesCommon is not defined`）（2025-11-12）。
- 課程總覽媒體改用學生同款分片/佇列流程：`handleOverviewPhotosSelect` 直接註冊 `PendingMediaStore`，由 `MediaUploadController + ChunkedUploader` 處理單檔上傳，`uploadOverview` 僅送 `saveRecordMetadata` 寫文字/metadata，並同步 `uploadOverviewTextOnly` 走同一路徑（2025-11-12）。

## 9. 2025-11-13 變更紀錄（Pending Media 守護 Step 2）
- 🧠 **PendingMediaStore 擴充**：在 `sessionStorage` 持久化 `objectUrl/mimeType/studentName/courseKey` 等欄位，切換視圖或路由後仍能重建縮圖；清理流程會釋放對應 blob URL，避免累積記憶體。
- 🧱 **預覽節點復原**：`restorePendingUploads()` 不再只生成 placeholder，而是偵測缺失節點後觸發學生/課程總覽的預覽重新渲染，並回補 Upload Center 狀態。Overview 模式若偵測不到 pending 節點，會直接將現有檔案重新掛載到 `SharedMediaPreviewer`。
- 🌓 **視圖切換保護**：`visibilitychange/pageshow` 鉤子會自動 `preserveActiveUploadNodes()` → `reattach*` → `restorePendingUploads()`，確保從「學生 ⇄ 課程總覽」或離開頁面再返回時，正在上傳的卡片不會消失。
- 🗂️ **陰影節點批次復掛**：新增 `reattachAllShadowBuffers()`，在 Router/頁面回到前景時將暫存於 `shadowHost` 的縮圖一次性掛回對應學生卡片，減少逐一 reflow。
- 🔎 **追蹤指標**：`persistPendingPreviewMeta()` 每次建立預覽都回寫 PendingMediaStore，使 Upload Center / 本地縮圖共享狀態來源，後續 Step 3 可直接監聽 `upload-center-update` 廣播。
- 📣 **UploadCenter 事件橋接**：`UploadCenter.add/update/done/fail` 會透過 `window.dispatchEvent('upload-center-update')` 廣播任務進度，並攜帶 `tempId/courseKey` 等 metadata；前端在 `handleUploadCenterBridge` 監聽事件後會回寫 `PendingMediaStore` 與 `PendingMediaActions`，就算離開頁面或切換視圖也能同步顯示排隊、上傳、完成、失敗狀態。
- ⚡ **StudentHistoryCache + 佇列**：`fetchStudentFsRecord` 改為單獨的 async queue（每次最多 2 個請求、間隔 120ms），同時使用 `sessionStorage` 快取 5 分鐘的學生歷史資料；切換學生或重整時若命中快取即可立即回填，避免對 `/api/getHistory` 的多次重複呼叫。
- 📝 **課程總覽欄位優先回填空白值**：`renderUploadedRecords` 現在會在快取來源也回填 summary.txt（僅覆蓋仍為空的欄位），確保使用者一進入頁面就能看到概要文字，再由 Drive 最新資料覆寫。

> 測試：未重新跑 `npm run dev`（僅前端邏輯調整）。`upload-center-update` 事件橋接與 StudentHistoryCache 需於 Step 4 依《DRIVE-REFACTOR-TEST-GUIDE.md》第 4 節情境回歸時一併驗證。

## 10. 2025-11-14 變更紀錄（UI / UX 強化）
- 🎛️ **學生卡片上傳入口**：`updateDropZones()` 僅針對各自有檔案的區域收起 Dropzone，照片與影片按鈕不再互相影響；`appendAddMoreButton()` 亦改為 type-aware，確保「新增影片」按鈕不會因已選照片而消失。
- 📌 **預覽節點保護**：`preserveActiveUploadNodes()` 只有在偵測到實際節點時才覆寫快取，避免切換到課程總覽時提早清空；返回學生視圖後縮圖不會再莫名消失。
- 🧷 **本地縮圖常駐**：`applyExistingRecordToCard()` 在 Drive 尚未回傳新檔案時，會保留帶有 `data-local-preserve`/`data-temp-id` 的縮圖（含 upload-success 狀態），切換學生或課程總覽再返回時不再因伺服器空集合而被清掉。
- 🎬 **影片縮圖加速**：PosterQueue 新增 `priority: 'high'`，本地 blob 先行處理，高階裝置並發上限調整為 3；新選影片幾乎即時看到縮圖。
- 📊 **個別檔案進度**：`uploadSingleMedia()` 連動 `updateFileUploadProgress()`，學生頁預覽會同步顯示 chunked upload 百分比；首個後台上傳會透過 `primeStudentUploadPreview()` 重置 overlay 狀態。
- 🧭 **Upload Center 2.0**：
  - 任務改為卡片樣式，顯示縮圖、型別、學生與狀態文案，支援「卡片／列表」檢視以及「標準／精簡」抽屜高度切換。
  - 新增行動版友善的 header actions、subtitle 顯示平均進度，FAB badge 保持與背景任務同步。
  - 操作按鈕（查看／取消／重試）集中於卡片右下角，搭配 PendingMediaStore 的 `objectUrl` 避免縮圖閃爍。
- 📋 **驗證**：透過瀏覽器實測單一學生上傳照片＋影片、切換至課程總覽再返回、開啟 Upload Center 檢查卡片與縮圖顯示。未重跑 `npm run dev`，僅進行前端手動驗證；後續 Step 4 仍需依《DRIVE-REFACTOR-TEST-GUIDE.md》情境完整回歸。
