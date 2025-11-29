# FLB 學習歷程上傳中心 V2 企劃書

> 狀態：草案（可隨時補充 / 調整）  
> 目標：定義 V2 上傳中心完整需求，並拆成可以「一步一步做」的實作階段。

---

## 1. 定位與目標

### 1.1 角色

- **講師**
  - 從「講師行事曆 (`perfect-calendar-modular.html`)」或獨立入口，快速進入「當天某堂課 → 某位學生」上傳學習歷程。
  - 針對每位學生，為當堂課上傳「照片／影片」與撰寫「短評語」。

- **管理者 / 助理**
  - 能快速瀏覽：
    - 每堂課目前「有幾位學生已上傳」。
    - 個別學生「上傳幾筆」「是否有評語」「最後上傳時間／最後評語時間」。

### 1.2 核心目標

- **類 LINE 相簿／記事本體驗**
  - 上傳完檔案 **不會消失**。
  - 重新整理或改天打開，同一位學生以前上傳的全部紀錄都會出現，包含評語。

- **資料一致性**
  - 評語與媒體全部統一儲存在 Synology Drive 的學習歷程路徑下，由 `drive-path-manager.js` + `learning-upload-helper.js` 管理。

- **行動裝置優先**
  - 手機單手操作順暢，關鍵操作集中在下方（開始上傳 / 清除全部）。
  - 錯誤時有明確提示（前端 UI + 伺服器 log）。

- **日常教學流程整合**
  - 講師可以直接從 `perfect-calendar-modular.html` 的課程卡片，一鍵跳轉到該堂課的 V2 上傳中心，減少找課程的步驟。

---

## 2. 進入點與導覽流

### 2.1 從 perfect-calendar-modular.html 深入連結

- 在 `public/perfect-calendar-modular.html` 的每日課程卡片或 Drawer 中，新增「📷 上傳學習歷程」按鈕。
- 點擊後開啟 V2 上傳中心，例如：
  - `/frontend-v2/index.html?courseId=<evt_id>&courseTitle=<URLEncodedTitle>&date=<YYYY-MM-DD>`
- V2 前端啟動時：
  - 從 query string 讀取 `courseId / courseTitle / date`。
  - 自動選定對應課程，並切換到「學生管理」頁，讓講師直接選學生上傳。

### 2.2 獨立入口

- 提供獨立入口路徑（例如 `/frontend-v2/` 或 `/learning-upload-v2`）。
- 沒有從行事曆 deep link 時：
  - 顯示「今日課程」清單，讓講師手動選擇課程 → 學生 → 上傳。

---

## 3. V2 前端頁面結構與資料流

### 3.1 主分頁

1. **課程選擇（CourseList）**
2. **學生管理（StudentList）**
3. **媒體上傳（單一學生）**
   - 學生分頁（個別學生）
   - 課程總覽分頁（若該堂課沒有學生，或老師只想記錄整堂課時）

### 3.2 對應後端 API

- `GET /v2/courses` → 今日課程列表。
- `GET /v2/courses/:courseId/students` → 指定課程學生列表（含出缺席、remaining 等狀態）。
- `GET /v2/students/:id/learning-records` → 單一學生「當堂課」已上傳的媒體＋評語。
- `POST /learning-records/upload-drive`（既有）→ 實際上傳照片 / 影片到 Synology Drive。
- `PATCH /v2/students/:id/comment` → 更新該堂課該學生的評語（`comment.txt` + `record-meta.json.comment`）。
- （未來）課程／學生上傳狀態彙總 API → 給列表頁顯示 Badge 與統計用。

---

## 4. 前端功能規格

### 4.1 課程選擇頁（CourseList）

**功能**

- 顯示「今日課程」清單（已存在）。
- 若從行事曆 deep link 帶入 `courseId`：
  - 自動高亮該課程卡片並切到學生管理。

**附加資訊（中期）**

- 每張課程卡顯示：
  - 課程名稱（完整標題）。
  - 時間與地點。
  - 總學生數（已實作）：
    - 由後端 `/api/v2/courses` 透過 `GoogleSheetsStudents.getAllStudents()` + `transformStudentsToV2Format` 計算。
    - 與學生管理頁相同的剩餘堂數／智能持續顯示／課程匹配邏輯，確保「課程卡顯示的人數」＝「學生管理實際可上傳的人數」。
  - 已上傳學生數與檔案數（已實作）：
    - 由 `/api/v2/courses` 的 `uploadedStudentCount` / `totalUploadedFiles` 欄位提供，
      使用與學生列表相同的媒體統計規則（優先採用 `photos-meta.json / videos-meta.json` 等新 meta，舊欄位僅作備援）。
    - 前端顯示為「已上傳 X / 總學生 Y（共 Z 個檔案）」。
  - 課程總覽上傳狀態（已實作）：
    - 由 `overviewUploaded` / `overviewFileCount` 欄位提供。
    - 前端顯示為「📋 課程總覽 已上傳（N 個檔案）」或「📋 課程總覽 尚未上傳」。

---

### 4.2 學生管理頁（StudentList）

**顯示欄位**

- 學生姓名。
- 出缺席狀態：`present / leave / absent / unknown`。
  - `leave` 與 `absent` → 上傳鎖定（前端按鈕禁用＋提示文字）。
- 上傳概況（已實作）：
  - 來自 `GET /v2/courses/:courseId/students` 的 `uploadStatus` 與 `uploadOverview` 欄位。
  - 初次載入學生管理頁就會顯示：
    - `📷 照片 N`（照片數，以 `photos-meta.json` / `media-meta.json` 為主）。
    - `🎬 影片 M`（影片數，同上）。
    - `💬 評語 ✓ / –`（是否有評語，來自 `record-meta.json.comment` 或 `comment.txt`）。
- 時間資訊（規劃中）：
  - `lastUploadAt`：該學生當堂課最後一次媒體上傳時間（後端已提供欄位）。
  - `lastCommentAt`：最後一次評語更新時間（後端已提供欄位）。
  - 前端可視需求以小字顯示，例如「最後上傳：21:35」「最後評語：21:40」。

**互動**

- 點學生卡片 → 切到「媒體上傳」頁（學生分頁），並帶入：
  - `course`：`id`, `name`, `date`, `semester`。
  - `student`：`id`, `name`, `attendanceStatus` 等。

---

### 4.3 媒體上傳頁（單一學生）

#### 4.3.1 評語編輯（CommentEditor）

**UI**

- Textarea，手機自動聚焦＋捲動至可見區（已實作，保留）。
- 字數限制（需修正）：
  - 最少 **5 字**。
  - 最多 **50 字**。
- 顯示「目前字數 / 50」。

**儲存流程**

- `PATCH /v2/students/:id/comment`，body 包含：
  - `semester`（由課程日期推算，與 `semester-helper` 一致）。
  - `courseName`（完整課程標題：含週次、時間、地點）。
  - `date`（YYYY-MM-DD）。
  - `studentName`。
  - `comment`。
- 後端行為：
  - 利用 `buildStudentRecordPath` 找到正確目錄。
  - 目錄不存在或 Synology 408 → 自動建立目錄後再寫入。
  - 寫入 `comment.txt`，同步更新 `record-meta.json.comment`。 
  - 更新 `record-meta.json.lastCommentAt`（ISO 時間）。

**評語規則**

- 一位學生一堂課「一個評語」，可以多次覆寫，永遠以最後一次為準。
- 不保留歷史版本，簡化前端 UI 與儲存空間。

**前端回饋**

- 成功：
  - 在 CommentEditor 下方顯示簡短「評語已儲存」小提示；目前不顯示時間，未來可再加入「（HH:MM）」與淡出效果。
- 失敗：
  - 在 CommentEditor 下方顯示「評語儲存失敗，請稍後再試」。
  - 觸發全域錯誤提示列（頁面頂部紅色 banner），統一提示上傳／評語／刪除等錯誤。
  - 於 console 中列出詳細 log（包含 Synology error code）。

---

#### 4.3.2 媒體上傳（本次選擇）

**選檔**

- 支援 `image/*, video/*`。
- `multiple=true`，每次最多 20 個檔案。
- 不限制總次數；可多批上傳。

**跨學生不中斷（行為設計）**

- 上傳任務以「`courseId + studentId`」為 key 管理：
  - 每位學生有自己的 upload task / state。
  - 上傳 A 學生時，可切換到 B 學生頁面：
    - A 的當前進度會保留在狀態中，不自動清除（已實作）。
  - 進階保護（未來強化）：限制「同時間只啟動一個上傳請求」，並在切換前提示「有上傳進行中」；
    目前尚未啟用此限制，保留為日後優化選項。

**預覽（FilePreview）**

- 顯示：
  - 圖片／影片縮圖。
  - 檔名、大小。
  - 上傳狀態：`pending / uploading / completed / error`。
  - 長按放大預覽（已實作）。

- 刪除按鈕（你希望新舊都能管理）：
  - 「本次選擇」檔案（尚未上傳）：
    - 按下刪除 → 從前端 state 中移除，不觸發後端。
  - 「已上傳（回填）」檔案：
    - 按下刪除 → 呼叫後端刪除 API（需新增 V2 封裝），
      - 傳入 `semester, courseName, date, studentName, mediaType, fileName/path`。
      - 後端刪除實體檔案與 meta 紀錄，必要時重新計算 `lastUploadAt`。
    - 成功後前端從 `allFiles` 移除該條目；失敗則顯示錯誤提示。

**上傳行為與進度可視化**

- 點「開始上傳」：
  - 透過 `useUploadStudentRecord` hook：
    - 收集 `currentTask.files`（僅本次新選）。
    - 建立 `FormData`，夾帶：
      - 課程資訊：`semester, courseName, date, topic`。
      - 學生資訊：`studentName / id`。
      - 評語可選（可傳目前 student.comment，但建議仍以 PATCH 為主）。
  - 顯示 **進度列**：
    - 全局進度：已上傳檔數 / 總檔數。
    - 單檔進度：百分比或 loading 狀態。
- 回傳成功：
  - 由回應資料取得 `proxyUrl / path`，填入對應檔案的 `file.url`，並標為 `completed`。
  - 不清空列表，維持照片「相簿感」。

---

#### 4.3.3 已上傳紀錄（回填）

- 進入「媒體上傳」頁，且已選定 `course + student` 時：

1. 呼叫 `useStudentLearningRecords(selectedCourse, selectedStudent)`：
   - `GET /v2/students/:id/learning-records`。
   - Query：`semester, courseName, date, studentName`。
2. 從回傳中取得：
   - `photos[] (name, url, size, createdAt?)`。
   - `videos[] (name, url, size, createdAt?)`。
   - `comment`。
   - `lastUploadAt`, `lastCommentAt`（若 `record-meta.json` 有記錄）。
3. 轉成 `MediaFile`，狀態 `completed`，帶 `url`，合併進 `allFiles`：
   - `allFiles = currentTask.files(本次選擇) + uploadedFiles(從 Drive 回填)`。

**顯示邏輯**

- 只要 `allFiles.length > 0` 就顯示預覽區（不再依賴 `currentTask` 是否存在）。
- 文案示例（目前實作）：
  - 「本次選擇 X 個檔案」：針對本次新選擇的檔案。
  - 若 Drive 已有紀錄，另在「Drive 已有紀錄」區塊顯示「共 Y 個檔案」（Y = Drive 回來的照片數 + 影片數）。

**FilePreview 顯示來源**

- 若 `file.url` 存在 → 以 `url` 顯示（Drive 檔案）。
- 否則以 `preview`（本地 blob）顯示。

---

## 5. 後端功能規格

### 5.1 學習記錄讀取（已實作，需補欄位）

- `GET /api/v2/students/:id/learning-records`
  - Query：`semester, courseName, date, studentName`。
  - 使用 `buildStudentRecordPath(semester, courseName, date, topic=null, studentName)` → `basePath`。
  - `_directoryExists(basePath)`：
    - `false` → 回傳：`photos: [], videos: [], comment: null, lastUploadAt: null, lastCommentAt: null`。
    - `true` →：
      - 讀 `photos-meta.json*`、`videos-meta.json*` → 產生含 `url / size / createdAt` 的列表。
      - 讀 `comment.txt` → 評語。
      - 讀 `record-meta.json`（如有）→ `lastUploadAt`, `lastCommentAt`。

### 5.2 評語更新（已加強）

- `PATCH /api/v2/students/:id/comment`
  - 驗證 `semester, courseName, date, studentName` 必填。
  - 呼叫 `learningUploadHelper.updateStudentComment()`：
    - 內部使用 `buildStudentRecordPath(...)` 計算路徑。
    - `_directoryExists` 若拋出 408 / not-exist → `_ensureDirectoryExists(basePath)` 自動建立。
    - 寫入 `comment.txt`，更新 `record-meta.json.comment`。
    - 更新 `record-meta.json.lastCommentAt`。
  - 回傳 `success, basePath, comment, updatedAt` 等欄位。

### 5.3 上傳媒體（既有）

- `POST /learning-records/upload-drive`
  - 透過 `uploadMediaFromLocalFile`：
    - 依 `semester, courseName, date, topic, studentName, isOverview` 決定使用 `buildStudentRecordPath` 或 `buildOverviewRecordPath`。
    - 建立媒體檔案與 meta 檔（`photos-meta.json / videos-meta.json`）。
    - 更新 `record-meta.json.lastUploadAt`。

### 5.4 既有檔案刪除（V2 封裝）

- 已實作 V2 API：`DELETE /api/v2/students/:id/learning-records/media`。
  - Body：
    - `semester, courseName, date, studentName, topic`。
    - `fileName`（由前端指定要刪除的檔案名稱）。
  - 內部呼叫 `learningUploadHelper.deleteSingleFile(basePath, fileName)`：
    - 刪除 Synology Drive 上的對應檔案。
    - 下次讀取 `photos-meta.json / videos-meta.json` 時，自然反映更新後的列表與最後上傳時間。

### 5.5 課程總覽（Overview）

- 若該堂課沒有學生（或使用者手動切到「課程總覽」分頁）：
  - 使用 `isOverview=true` 路徑：`buildOverviewRecordPath(semester, courseName, date, topic)`。
  - 上傳：
    - 仍用 `POST /learning-records/upload-drive`，但 `isOverview=true`。
  - 查詢：
    - 目前實作：透過 `GET /api/v2/learning-records` 搭配 `semester, courseName, date` 取得所有紀錄，
      並在後端以 `isOverview=true` 過濾與排序後回傳給前端使用。
    - 未來如有需要，可再新增 overview 專用 API 以簡化查詢。

---

## 6. 非功能性需求

### 6.1 行動端體驗

- 單手操作：
  - 底部固定「開始上傳 / 清除全部」操作列（已完成，持續優化）。
- 鍵盤遮擋問題：
  - 評語輸入欄會自動捲動到可見區域（已實作）。
- 點擊區域：
  - `CourseList / StudentList` 卡片按鈕尺寸和間距適合手指點擊（`mobile-ux-4` 視實際使用再微調）。

### 6.2 穩定性與錯誤處理

- Synology 連線 / 408 錯誤：
  - 後端要有具體錯誤 log，並在「目錄不存在」場景自動建立目錄。
- 前端：
  - 遇到 API 失敗，至少顯示簡短錯誤訊息，避免老師不知道發生什麼事。
  - 目前已實作全域錯誤提示列（紅色 banner），統一顯示上傳／評語／刪除等失敗狀態。

### 6.3 一致性

- 所有 Synology Drive 路徑操作都透過：
  - `drive-path-manager.js`。
  - `learning-upload-helper.js`。
- 學期計算統一透過：
  - 後端 `semester-helper`。
  - 前端 `utils/semester.ts`。

---

## 7. 實作里程碑與步驟（一步一步做）

### Phase 1：穩定版（核心體驗打底）

1. **評語條件調整與 PATCH 穩定化**
   - [x] 調整 CommentEditor 字數限制為 5–50 字，並顯示字數。
   - [x] 在 PATCH 成功／失敗時，加入明確的 UI 提示文字。

2. **已上傳紀錄回填與保留**
   - [x] 完成 `GET /v2/students/:id/learning-records` 基礎實作（含讀取 comment / photos / videos）。
   - [x] 在前端合併 `currentTask.files + learningRecords` 成 `allFiles`，並改成只要有檔案就顯示預覽區。

3. **基本上傳進度 UI**
   - [x] 在上傳時於底部操作列顯示簡單的「已上傳 / 總數」文字。
   - [x] 每個檔案加上 `uploading / completed / error` 標籤樣式（含上傳失敗標記）。

> ✅ Phase 1 完成後：
> - 老師可以穩定上傳照片／影片與評語。
> - 重新整理或改天打開，仍可看到該堂課該學生的全部紀錄。

---

### Phase 2：行事曆整合與課程總覽

4. **perfect-calendar-modular.html 深入連結**
   - [x] 在每日課程卡／Drawer 中新增「📷 上傳學習歷程」按鈕。
   - [x] 設計並實作 deep link URL（攜帶 `courseId / courseTitle / date`）。
   - [x] 在 V2 前端啟動時解析 query，若有 `courseId` 則自動選課程並跳到學生頁（含開發模式自動導向 `localhost:5173` 的 Vite dev server）。

5. **課程總覽頁（Overview）**

- [x] 在主導航中加入「課程總覽」分頁，與「學生管理」「媒體上傳」同層級，並將整體 V2 導覽列改為 `sticky top-0`，滾動時仍保持可見，方便在各分頁間切換。
- [x] 進入條件：已選定課程，與學生名單無關（即使沒有學生也可使用）。
- [x] 在該頁提供：
   - 簡短課程總結文字區塊（對應 overview summary，拆為「學生狀況」「遇到問題」「解決方法」三段輸入）。
   - 課程總覽專用的檔案上傳器（使用 `isOverview=true` 路徑）。
- [x] 「課程總覽已上傳紀錄」的回填與瀏覽 UI（從 Synology Drive 讀取 summary + 媒體，回填文字並以縮圖卡片預覽）。
- [x] 課程總覽上傳條件與 UX：
   - 只要有**任一段文字**或**至少一個媒體檔**即可觸發上傳；完全空白時按鈕維持停用。
   - 課程總覽頁底部提供固定浮動操作列（類似學生上傳頁）：顯示「已編輯課程總覽文字／尚未編輯」與選擇檔案數，並提供「清除全部」「上傳課程總覽」按鈕。
   - 上傳成功後僅清空本次上傳檔案陣列，保留畫面上的文字與 Drive 回填內容，並在標題下方顯示「課程總覽已上傳」提示小字。

> ✅ Phase 2 完成後：
> - 老師可以直接從行事曆一鍵跳到上傳中心。
> - 即使某堂課沒有學生名單，也能用「課程總覽」記錄當天活動。

---

### Phase 3：上傳狀態總覽與刪除功能

6. **上傳狀態 Badge 與最後時間**
   - [x] 在 `GET /v2/courses/:courseId/students` 中補齊每位學生的上傳概況欄位：
     - `uploadStatus.photos / uploadStatus.videos`：照片／影片數量。
     - `uploadOverview.uploadedCount / hasComment / lastUploadAt / lastCommentAt`。
     - 以 Synology Drive 新媒體 meta（`photos-meta.json / videos-meta.json / media-meta.json`）為優先來源，舊 `record-meta.json` 僅作備援。
   - [x] 學生管理頁 StudentCard 初次載入即顯示：
     - `📷 照片 N / 🎬 影片 M / 💬 評語 ✓` 等概況，不需先進入詳情頁。
     - 額外顯示「✅ 已上傳 N 筆 / ⏳ 未上傳」 Badge，來源為 `uploadOverview.uploadedCount` 或照片＋影片數。
   - [x] 在 `/api/v2/courses` 中重用 `transformStudentsToV2Format` 計算課程 `studentCount`：
     - 確保課程卡顯示的學生總數與學生管理頁經過剩餘堂數與出缺席篩選後的一致。
   - [x] 進一步在 StudentList 卡片上顯示：
     - `未上傳` 或 `已上傳 N 筆` 的 Badge，直接使用 `uploadOverview.uploadedCount`。
   - [x] 顯示「最後上傳 / 最後評語」時間（HH:MM 簡短格式）。

7. **刪除已上傳檔案**
  - [x] 新增 `DELETE /api/v2/students/:id/learning-records/media` V2 API，依課程與學生資訊計算正確 Drive 路徑並刪除單一檔案。
  - [x] 在 RemoteMediaCard / StudentMediaDrawer 中對「已上傳檔案」啟用刪除按鈕，呼叫該 API。
  - [x] 刪除成功後重新載入學生學習記錄，前端列表即反映最新狀態（照片／影片數與 StudentCard 上傳概況同步更新）。

> ✅ Phase 3 完成後：
> - 助理 / 老師可以透過學生列表快速看出「誰已上傳」「誰還沒上傳」。
> - 可以從 V2 介面管理（刪除）錯誤的上傳檔案。

---

## 8. 後續可討論項目

- 歷史評語版本與完整修改紀錄（✅ 已完成第一版，仍可擴充）：
  - 當前實作：每次更新學生評語時，後端會在覆寫 `comment.txt` 前將舊版本追加寫入同目錄下的 `comment-history.json`（預設最多保留 20 筆，超出時捨棄最舊資料）。
  - 前端 CommentEditor 於評語區下方提供「查看歷史評語」展開區，反向時間排序顯示最近數筆文字與時間標記，僅供檢視，尚未支援一鍵還原舊版本。
  - 未來可討論：是否開放「從歷史紀錄一鍵回復為目前評語」、或提供更精細的版本篩選與權限控制。
- 是否要限制刪除權限（例如：只有當天可以刪除，或只有特定角色可刪）？
  - 當前實作：V2 介面只要看得到檔案，就可以觸發刪除 API，未限制時間範圍。
  - 建議未來規則：
    - 課程結束後 **7 天內** 老師仍可透過 V2 刪除錯誤上傳的媒體。
    - 超過 7 天後：可完全鎖定刪除，或改由管理員專用介面（非 V2）處理，避免誤刪。
- 是否需要在 V2 內嵌 `special-events-manager.html` 或僅保留為獨立管理工具？
  - 建議：維持 `special-events-manager.html` 為獨立管理工具，不直接嵌入 V2 學習歷程上傳介面，
    以避免老師日常操作畫面過於複雜。
  - 如有需要，可在未來於 V2 管理頁面提供「前往特殊事件管理」的連結，保持功能關聯但介面分離。

---

> 本企劃書為 V2 上傳中心的開發藍圖。後續實作時，若有新需求或限制，可直接在本檔追加條目並標註日期。
