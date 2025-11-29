# LEARNING-RECORD-UPLOAD-REFACTOR-PLAN (2025-11-11)

> 目標：用「最高規格」重整 `learning-record-upload.html` 與其前後端流程，建立可逐段交付的藍圖，並優先解決「重複上傳造成錯誤路徑」等核心缺陷。

## 0. 背景與範圍
- **頁面**：`public/learning-record-upload.html`、`public/js/pages/learning-record-upload.js`（17k+ 行）。
- **模組**：`public/js/modules/learning-upload/*`、IndexedDB 快取、`FLB.SmartUploadManager`、`PendingMediaStore`、`State`、`Course Manager` 等。
- **後端**：`server.js`（Drive 分片 API、`/api/learning-records/save`）、`learning-upload-helper.js`、`synology-drive-client.js`、`drive-path-manager.js`。
- **當前問題**：
  1. 首次上傳路徑正確，但第二次以上在同學生頁面上傳時，Synology Drive 會產生錯誤資料夾（課程/日期錯位或多一層隨機名稱）。
  2. 前端檔案流（預覽、上傳、刪除、下載、模板）交織在單檔內，UI/狀態/錯誤處理重疊，維修成本極高。
  3. Router / StateStore / Worker / IndexedDB 彼此狀態不同步，背景排程（靜默縮圖檢查）與實際 UI 行為可能衝突。

## 1. 現況痛點（Phase 0 輸入）
| 編號 | 痛點 | 細節 | 影響 |
| --- | --- | --- | --- |
| P0-1 | 路徑生成不穩定 | `buildRecordOperationMeta` 依賴快取 `relativePath` 與 `composeRelativePath`；第二次上傳會偏離 `drive-path-manager` 規格（例如：topic fallback 取錯、course title 被 router 改寫）。 | 媒體落入錯誤資料夾，Drive 同步後需人工搬檔。 |
| P0-2 | 事件流過長 | 單檔 17k 行混合 DOM/業務/Net call；`PendingMediaStore`/`MediaUploadController`/`SmartUploadManager` 互相取代。 | 新功能或修補都可能觸發回歸。 |
| P0-3 | 狀態多源 | Router、StateStore、`studentFiles`、`cacheMeta`、`uploadedRecordsCache` 各自管理資料；抽屜/Modal/歷史列表未共享同一 truth。 | 切換學生/重整頁面可能遺失未送資料。 |
| P0-4 | UI/UX 不一致 | 相同元件（進度、overlay、抽屜）有多套 DOM 實作，CSS 無法統一控管。 | 用戶感受「混亂」，也降低 debug 效率。 |

## 2. Phase 0 — 現況盤點＋路徑修復基準
- **時間窗**：2025-11-11 ~ 2025-11-13（先完成再進入重構）。
- **總目標**：
  1. 完整描繪「從檔案選取 → 分片 → Drive 寫入 → metadata 儲存 → UI 更新」的事件序列。
  2. 找出「二次上傳路徑錯誤」的確切根因並提出修正方案（可立即套用暫時補丁）。
  3. 建立量測面（TTI、請求數、LIFF OOM 率、平均上傳時長、失敗率），之後每階段都能對照實際成效。
- **任務矩陣**：

| 編號 | 工作項目 | 涉及檔案 | 產出/驗證 |
| --- | --- | --- | --- |
| P0-A | 建立時序圖：Router → State → Pending store → Upload manager → API | `public/js/pages/learning-record-upload.js`、`public/js/modules/learning-upload/*` | Mermaid/PlantUML 圖 + 文件段落。 |
| P0-B | 路徑生成稽核：比對 `buildRecordOperationMeta` vs `drive-path-manager.buildStudentRecordPath` | 前端檔案、`drive-path-manager.js`、`server.js` | 設計監控鉤子：記錄 metadata（semester/course/date/topic/student/relativePath）與後端實際結果；用兩次上傳重現 bug。 |
| P0-C | 快取一致性檢查：`getRecordCacheEntry`、`mergeLocalUploadedRecord`、IndexedDB | `public/js/modules/learning-upload/indexeddb-cache-manager.js` 等 | 列診斷清單（快取鍵、TTL、可否清空），以便 Phase 1 重構。 |
| P0-D | 文件同步 | `docs/DRIVE-UPLOAD-MIGRATION-PLAN.md`、`AGENTS.md` | 新增「Learning Record Upload Refactor」章節、記錄 path bug 描述與進度。 |

- **2025-11-11 即時執行**
  - ✅ P0-B1：前端 `DrivePathDebugMonitor` 建立，`MediaUploadController` 紀錄每次上傳 metadata 與 canonical path，並同步 `window.__drivePathDebug`。
  - ✅ P0-B2：後端 `handleDriveUploadComplete` 驗證 `semester/courseName/date/studentName`，並將 metadata、context 與 Synology canonical path 寫入 `logs/drive-path-monitor.log`；缺欄位直接 400。
  - ✅ P0-B3：`buildRecordOperationMeta` 改為始終以 `composeRelativePath` 重新產生 canonical path，並強制 `relativePathUnified` 使用最新值。
  - ✅ P0-B4（進行中）：cache-only 模式建立，學生/總覽上傳改為僅移除 hover、保留當前預覽，不再觸發 `requestCourseReload`，僅在初次載入或錯誤（404/刪除）時才允許 `allowCacheBypass` 重新抓取。

- **快速修補（若找到原因）**：Phase 0 允許針對路徑錯誤推出 hotfix（例如：強制覆寫 `relativePathUnified`、在 `server.js resolveDriveContext` 增加嚴格驗證）。
- **驗證方式**：
  - 依 `AGENTS.md` 規範，以背景方式執行 `PORT=3002 DISABLE_AUTO_REMINDERS=true npm run dev`，記錄 PID+log。
  - 撰寫手動測試腳本：同一學生連續上傳 3 次（照片/影片/純評語），比對 Drive 目錄。

### 2.1 指標基準與量測流程
- **文件**：`docs/reports/learning-record-upload-baseline-2025-11-13.md`
  - 定義 TTI / 首屏請求數 / LIFF OOM 率 / 平均上傳時長 / 上傳失敗率。
  - 提供連續兩天的數據表格與填寫規範，需同步到 Google Sheet《LRU-Baseline》。
- **工具**：
  - `node scripts/metrics/lru-dependency-map.js [html] [--markdown]`：解析 `public/learning-record-upload copy.html` 內 20+ `<script>`，輸出 JSON 或 Markdown，歸檔於 `docs/reports/lru-deps-YYYYMMDD.md`。
  - DevTools Performance / Network：量測 TTI 與首屏請求數。
  - LINE LIFF console + Sentry：統計 OOM 率。
  - UploadCenter `upload-events`（待建）+ `/tmp/npm-dev.log`：計算平均上傳時長與失敗率。
- **行動項目**：
  1. [ ] 依文件完成 11/13、11/14 的指標填寫（桌機 + 實機各 3 次取平均）。
  2. [ ] 在 `docs/DRIVE-UPLOAD-MIGRATION-PLAN.md` 「進度追蹤」章節放入指標連結。
  3. [ ] Phase 1 開始前，確認連續兩日指標已蒐集成功並於本檔記錄連結（Sheet / Markdown）。

## 3. Phase 1 — 架構分層（Core Controller + 狀態）
- **前提**：Phase 0 完成並 Hotfix path issue。
- **目標**：將現有單檔拆成可維護模組，確保「狀態 → DOM → API」各司其職。
- **策略**：
  1. 建立 `UploadExperienceController`（新檔案，負責 orchestrate state/queue/uploader）。
  2. 改寫 `MediaUploadController` 與 `SmartUploadManager`，統一 metadata 入口與事件發佈（使用事件匯流排 `window.dispatchEvent` 或專屬 emitter）。
  3. 整合狀態：以 `StateManager`（既有模組）為單一來源，加入 `students`, `pendingUploads`, `historyCache` slice。
  4. 引入型別定義/註記（JSDoc）協助 IDE 理解。
- **交付**：
  - 新增 `public/js/modules/learning-upload/controllers/upload-experience-controller.js`（或更貼切命名）。
  - `public/js/pages/learning-record-upload.js` 裁切目標：< 8,000 行；僅保留頁面初始化、事件掛載、模組 wiring。
  - 單元測試（可用 `tests/unit/upload-experience-controller.test.js`）。

## 4. Phase 2 — UI / UX 重構
- **目標**：
  - 明確分離「上傳面板」「歷史快取」「模板管理」「Drive 檔案瀏覽」。
  - 使用共用 UI 元件（progress、overlay、drawer、tabs），引入 `public/js/modules/learning-upload/ui/*` 的新 renderer。
- **舉措**：
  1. 建立 `components/` 資料夾存放純 DOM 架構（無業務邏輯）。
  2. 把 `ensureFilePreviewOverlay` 等 UI 共用函數抽出，避免多處複製。
  3. 重新規劃 CSS（`public/css/learning-records.css` + `history-records-*.css`），定義 BEM-like class。
  4. 製作互動原型（Figma/碼面 Demo）並記錄於 `docs/features/learning-record-upload-ui-v3.md`。
- **驗證**：
  - 行動/桌面實測：Chrome DevTools + 實機。
  - 無障礙（keyboard tab flow、screen reader label）。

## 5. Phase 3 — 系統強化與部署
- **內容**：
  1. 自動化測試：加入 Cypress/Playwright 指令式流程（至少涵蓋上傳/刪除/歷史/模板）。
  2. 監控/告警：在後端 `learning-upload-helper`、`drive-path-manager` 加入結構化日誌，並同步到 `logs/drive-upload/*.log`。
  3. 部署 runbook：更新 `docs/guides/DEPLOY-ON-NAS.md` 與 `docs/DRIVE-UPLOAD-MIGRATION-PLAN.md`，新增「UI V3 上線檢查清單」。
  4. 回溯：保留 `learning-record-upload.js.backup-YYYYMMDD-HHMMSS` 以符合 AGENTS 規範。

## 6. Path Issue 調查備忘（Phase 0 必做）
1. **症狀**：同學生連續上傳時，Drive 產生新資料夾，例如：
   - 第一次：`/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE.../2025-11-11 主題/王小明`
   - 第二次：`/Fun Learn Bar/FLB-Learning-Portfolio/114-1/王小明/2025-11-11/SPIKE...`
2. **可能成因**：
   - `relativePath` 從 cache 讀取時缺少 semester，導致 `composeRelativePath` 重新組裝錯位。
   - `currentCourse.title` 在「歷史抽屜」或「模板面板」操作後被覆寫，導致 `coursePeriodValue` 不再等於第一次的名稱。
   - 前端 metadata 傳給 `/api/drive-upload/init` 時 `relativePath`/`relativePathUnified` 未同步，導致 `resolveDriveContext` 只能依賴其他欄位，進而建錯資料夾。
3. **檢查清單**：
   - [ ] 在 `MediaUploadController.uploadSingleMedia` log 出 `uploadMetadata`。
   - [ ] 在 `server.js resolveDriveContext` log 入參 vs `drivePathManager.buildStudentRecordPath` 結果。
   - [ ] 比對 `LearningUploadHelper.uploadStudentRecord` 的 `basePath` 與 `driveClient.ensureFolderExists` 實際建立的目錄。
   - [ ] 驗證 `drive-path-manager.sanitizeComponent` 是否處理「學生含斜線/冒號」等特殊字元。

## 7. 文件與追蹤
- **本檔（Refactor Plan）**：隨進度更新，標記 Phase/任務狀態、測試紀錄、git commit。
- **`docs/DRIVE-UPLOAD-MIGRATION-PLAN.md`**：新增章節連結到本計畫；Drive 統一計畫與 UI 重構互相參照。
- **`AGENTS.md`**：在「最近重要更新」加入「2025-11-11｜Learning Record Upload Refactor 計畫啟動」，明確要求後續任務遵守本藍圖。
- **看板/待辦**：使用文件內 checklist + 回應用戶時同步目前階段與下一步，確保「隨時更新計劃待辦」。

## 8. 下一步
1. 完成 Phase 0 任務 P0-A ~ P0-D。
2. Hotfix 路徑錯誤後，在本檔與 `AGENTS.md` 記錄修正方式與驗證結果。
3. 進入 Phase 1，開始拆分控制器與狀態層。

---
*維護人：Codex（GPT-5）。任何規範調整請同步修改本檔與 `AGENTS.md`。*
