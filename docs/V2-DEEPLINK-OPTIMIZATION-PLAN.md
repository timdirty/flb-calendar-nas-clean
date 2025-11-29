# V2 Deep Link 載入加速與今日課程快取規劃

> 版本：2025-11-25（基準分支：`v2-frontend-stable-2025-11-25`）
>
> 目標：在維持既有 skeleton 體感流暢的前提下，透過 **專用 Deep Link API + 後端快取** 實際降低 API 次數與延遲，讓行事曆 deep link 進入 V2 學習歷程頁面時「真的變快」。

---

## 1. 目標與範圍

- **主要目標**
  - Deep link 進入時：前端只需打一支 API，就能拿到「課程 + 學生列表 + 必要設定」。
  - 後端對「今日課程」提供快取／預熱能力，減少重複從 Synology Calendar 計算的成本。
- **不調整的部分**
  - 既有 skeleton / shimmer 動畫、UI 風格維持不變（只改資料來源）。
  - 既有 V2 學生 API、課程 API 的對外介面保持相容（可在內部共用邏輯）。

---

## 2. 現況快速整理

### 2.1 Deep Link 現行流程（前端）

- `App.tsx`：
  - 讀取 URL query：`courseId`、`courseTitle`、`date`、`instructor`。
  - 目前流程：
    1. 先透過 `useTodayCourses()` 打一般「今日課程」 API。
    2. 在前端的 effect 裡，用這些課程資料 **自己找目標課程**。
    3. 找到後，再走既有的課程選取流程：
       - `selectCourse(course)`
       - `useStudentsByCourse(...)` 再打一次學生 API。

### 2.2 今日課程與學生資料

- 今日課程：從 Synology Calendar 取得，現有 API 會為每次請求重新查詢與轉換。
- 學生列表：V2 學生 API (`routes/v2-students.js`) 已經封裝好過濾邏輯（出缺席、最少堂數等）。

**問題點**
- Deep link 情境下一次進來要：
  - 打「今日課程」
  - 找目標課
  - 打「學生名單」
- 多個 round-trip，且 Calendar 查詢成本高，效能上有優化空間。

---

## 3. 新架構總覽

### 3.1 新增兩個關鍵能力

1. **Deep Link 專用 API**
   - 路徑：`GET /api/v2/deeplink-course`
   - 功能：一次回傳
     - 目標課程資訊 `course`
     - 該課程學生列表 `students`
     - 必要設定 `settings`（學期、主題、教室等）

2. **今日課程快取 / 預熱服務**
   - 封裝在後端 service，如 `services/today-courses-service.js`：
     - `getTodayCourses({ useCache: true })`
     - `refreshTodayCourses()`
   - 優先使用記憶體快取，必要時可搭配本機檔案備援。

### 3.2 資料流（Deep Link）

1. 行事曆 deep link 開啟 V2：`?courseId=...&courseTitle=...&date=...&instructor=...`
2. 前端檢測到有 deep link 參數 → 改打：
   - `GET /api/v2/deeplink-course?...`
3. 後端處理步驟：
   1. 優先從「今日課程快取」尋找目標課程。
   2. 找不到再查 Synology Calendar / DB 做備援。
   3. 用共用 V2 學生邏輯取得學生列表。
   4. 組合 `course + students + settings` 回傳。
4. 前端收到結果後：
   - `selectCourse(course)` + `setStudents(students)` + `setCurrentPage('students')`。
   - 其餘流程（skeleton、媒體上傳、課程總覽）保持既有邏輯。

---

## 4. 後端實作規劃

### 4.1 今日課程快取 Service

**目標檔案建議**
- `services/today-courses-service.js`

**內部功能**

1. `getCacheKeyForDate(date: string): string`
   - 輸入 `YYYY-MM-DD`，回傳 key：`today-courses:<date>`。

2. `getTodayCourses({ useCache = true }): Promise<Course[]>`
   - 流程：
     1. 決定今天日期（以 `Asia/Taipei` 為準）。
     2. 若 `useCache === true`：
        - 先查記憶體 map 是否有 `key`。
        - 若有且未過期 → 直接回傳。
     3. 若無快取或 `useCache === false`：
        - 呼叫既有 Calendar / 課程查詢邏輯，取得今日所有課程資料。
        - 將結果轉換成 V2 用的 `Course` 物件陣列。
        - 寫入記憶體快取，TTL 可設定為 **當天有效**。
        - （選配）序列化存到 `data/cache/today-courses-<date>.json` 備援。

3. `refreshTodayCourses(): Promise<Course[]>`
   - 強制忽略現有快取，重算今日課程並覆蓋快取。
   - 供：排程、維運腳本或管理介面使用。

**實作步驟**

1. 建立新檔 `services/today-courses-service.js`：
   - 匯入 `synology-calendar-client.js` 或現有今天課程查詢工具。
   - 定義 in-memory cache 結構：
     - 例如：
       - `const memoryCache = new Map();`
       - value 內可包含 `{ data, expiredAt }`。
   - 實作 `getTodayCourses` 與 `refreshTodayCourses`。

2. 在現有「今日課程」 API（若有 `/api/v2/courses/today` 類似路由）中，改用 `today-courses-service`：
   - 由：直接查 Calendar → 改為 `await getTodayCourses({ useCache: true })`。

3. 撰寫簡單 Node 測試腳本（放在 `tests/manual/`）：
   - 連續呼叫 `getTodayCourses` 多次，確認第二次之後不再打 Synology Calendar（可看日誌）。

### 4.2 Deep Link 專用 API

**目標檔案**
- 新增路由：`routes/v2-deeplink.js`（或併入 `routes/v2-courses.js`，建議獨立檔）。
- 在 `server.js` 中掛載：
  - `app.use('/api/v2', require('./routes/v2-deeplink'));`

**API 規格**

- Method：`GET`
- Path：`/api/v2/deeplink-course`
- Query 參數：
  - `courseId?: string`
  - `courseTitle?: string`
  - `date?: string`（`YYYY-MM-DD`）
  - `instructor?: string`

**回傳格式**

```jsonc
{
  "course": { /* Course 物件，沿用 v2-courses 格式 */ },
  "students": [ /* 學生列表，沿用 v2-students 格式 */ ],
  "settings": {
    "semester": "2025上",
    "topic": "Scratch 入門",
    "classroom": "A 教室"
  }
}
```

**主要步驟**

1. 驗證 query 參數
   - 若 `courseId`、`courseTitle`、`date` 都缺 → 回 `400`：
     - `{ code: 'MISSING_DEEPLINK_PARAMS', message: '需要至少 courseId 或 (courseTitle + date)' }`

2. 尋找課程邏輯（可抽成 helper：`resolveDeepLinkCourse()`）
   - 優先呼叫 `today-courses-service.getTodayCourses({ useCache: true })` 拿今日課程列表。
   - 尋找順序：
     1. 若有 `courseId`：
        - 當日課程內找 `id === courseId` 或 `String(id) === String(courseId)`。
     2. 若找不到且有 `courseTitle + date`：
        - 重算指定日期課程列表（可用現有 `getCourses({ startDate: date, endDate: date })`）。
        - 找 `name === courseTitle && date === date`。
     3. 若只有 `courseTitle`：
        - 用搜尋 API `searchCourses(courseTitle)`，取最符合的一筆。
   - 若最終仍找不到 → 回 `404`：
     - `{ code: 'COURSE_NOT_FOUND', message: '找不到對應課程' }`

3. 取得學生列表
   - 匯入並呼叫 V2 學生服務或路由中的共用函式，例如：
     - `getStudentsForCourse({ courseId, courseName, semester, topic })`
   - 注意要尊重現有所有篩選規則（缺席/請假、最小堂數等）。

4. 組裝 settings
   - 從 `course` 取出：`semester`, `topic`, `classroom` 等欄位。
   - 若缺少，可透過 `course-topic-helper` 或其他 helper 計算。

5. 回傳結果
   - `res.json({ course, students, settings })`。

6. 日誌與錯誤處理
   - 成功：📝 記錄 `courseId` / `courseTitle + date` 與找到的課程 id。
   - 失敗：❌ 記錄錯誤 code 與 query 內容，方便除錯。

---

## 5. 前端 V2 整合規劃

### 5.1 新增 API Client

**檔案**
- `frontend-v2/src/services/api/courseApi.ts`

**新增函式（示意）**

```ts
async function getDeeplinkCourse(params: {
  courseId?: string;
  courseTitle?: string;
  date?: string;
  instructor?: string;
}) {
  return client.get('/api/v2/deeplink-course', { params });
}
```

> 實作時要沿用現有 `client.ts` 的錯誤處理與 baseURL 設定。

### 5.2 調整 App.tsx Deep Link 流程

1. 在解析 URL 的 `useEffect` 之後，新增一個專門處理 deep link 的 `useEffect`：
   - 若 `initialCourseParams` 存在，且尚未套用：
     1. 呼叫 `getDeeplinkCourse(initialCourseParams)`。
     2. 若成功：
        - `selectCourse(result.course)`
        - `setStudents(result.students)`
        - 初始化與課程設定相關的狀態（如 topicForPath 等）。
        - `setCurrentPage('students')`。
        - 設定 `hasAppliedInitialCourse = true`，避免重複執行。
     3. 若失敗（404/500）：
        - 保留現有 fallback：讓畫面留在「課程列表」，並顯示簡短錯誤提示。

2. deep link 專用流程與現有 `useTodayCourses + useStudentsByCourse` 共存：
   - 無 deep link → 走舊邏輯。
   - 有 deep link → 以 `deeplink-course` 結果為主，`useTodayCourses` 只作 UI 顯示「今日課程列表」。

3. Skeleton / UI 無需調整
   - 學生列表與課程總覽仍透過 `studentsLoading` / `isCourseOverviewLoading` 控制骨架顯示即可。

---

## 6. 測試與驗證計畫

### 6.1 後端測試

1. 手動 API 測試（curl 或 Postman）
   - `GET /api/v2/deeplink-course?courseId=...`
   - `GET /api/v2/deeplink-course?courseTitle=...&date=...`
   - 錯誤案例：缺參數、亂填 courseId。

2. 今日課程快取測試
   - 撰寫 `tests/manual/test-today-courses-cache.js`：
     - 連續呼叫 `getTodayCourses({ useCache: true })` 三次。
     - 確認日誌中只有第一次實際觸發 Calendar 查詢。

### 6.2 前端測試

1. Deep Link 進入
   - 使用行事曆連結開啟 V2，觀察：
     - 頂端藍色 banner 顯示「正在依行事曆連結載入課程…」並有 pulse 動畫。
     - 學生列表 skeleton → 實際學生列表。
     - 課程總覽 / 媒體上傳功能仍可正常操作。

2. 無 Deep Link 一般進入
   - 直接開 `perfect-calendar-modular.html` 並點選 V2 入口：
     - 今日課程列表正常載入（可用 cache）。
     - 學生列表、課程總覽無異常。

3. 上傳後回填行為
   - 學生媒體上傳成功後：
     - 學生頁面：Drive 區塊 skeleton → 新的「已上傳」列表。
   - 課程總覽上傳成功後：
     - 課程總覽頁面：Drive 區塊 skeleton → 新的「課程總覽已上傳」列表。

---

## 7. Rollout 與分支策略

1. 以目前 `v2-frontend-stable-2025-11-25` 為基準：
   - 新開分支：`feat/v2-deeplink-performance`。

2. 在該分支完成上述後端與前端實作＋測試。

3. 完成後：
   - 開 PR 從 `feat/v2-deeplink-performance` → `v2-frontend-stable-2025-11-25`。
   - 在 PR 描述中附上：
     - 變更檔案列表摘要。
     - 實測步驟與結果（含 deep link、今日課程快取測試）。

4. 如需再推更穩定版本：
   - 從更新後的 `v2-frontend-stable-2025-11-25` 再切新 tag 或新 stable 分支（例如 `v2-frontend-stable-2025-12-XX`）。
