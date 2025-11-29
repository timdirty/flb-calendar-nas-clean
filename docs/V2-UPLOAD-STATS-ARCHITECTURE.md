# 📊 V2 課程上傳統計完整架構文檔

> **建立日期**: 2025-11-26  
> **目的**: 在課程選擇區顯示每個課程的上傳狀況  
> **核心技術**: learning-records-index.js 快速查詢

---

## 🎯 需求說明

### 使用者需求
在課程列表（課程選擇區）中，每個課程卡片應該顯示：
1. **已上傳學生數 / 總學生數**（例如：已上傳 3 / 總學生 5）
2. **總上傳檔案數**（例如：共 12 個檔案）
3. **課程總覽上傳狀態**（已上傳 / 尚未上傳）

### 技術要求
- 使用 `learning-records-index.json` 快速查詢，避免每次都掃描 Synology Drive
- 前後端統一使用相同的課程名稱清理邏輯
- 支援今日課程、本週課程、全部課程的統計顯示

---

## 📁 系統架構總覽

### 後端架構

```
┌─────────────────────────────────────────────────────────────┐
│                        後端 API 層                            │
├─────────────────────────────────────────────────────────────┤
│  routes/v2-courses.js                                        │
│  ├─ GET /api/v2/courses?includeStats=true                   │
│  ├─ GET /api/v2/courses/:id                                 │
│  └─ GET /api/v2/courses/search?q=keyword                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     核心服務層                                │
├─────────────────────────────────────────────────────────────┤
│  utils/learning-records-index.js                            │
│  ├─ getCourseSummary(semester, courseName, date, topic)    │
│  ├─ updateStudentRecordSummary(...)                        │
│  ├─ updateOverviewRecordSummary(...)                       │
│  └─ removeRecordByDrivePath(fullPath)                      │
├─────────────────────────────────────────────────────────────┤
│  utils/course-name-cleaner.js                               │
│  ├─ cleanCourseName(name) - 移除週次                        │
│  └─ isSameCourse(name1, name2) - 判斷是否同一課程            │
├─────────────────────────────────────────────────────────────┤
│  utils/semester-helper.js                                   │
│  └─ getCurrentSemester(date) - 取得學期                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                     資料儲存層                                │
├─────────────────────────────────────────────────────────────┤
│  data/learning-records-index.json                           │
│  {                                                           │
│    "version": 1,                                            │
│    "updatedAt": "2025-11-26T14:24:09.710Z",                │
│    "courses": {                                             │
│      "114-1::SPIKE PRO 日 1000-1200::2025-11-23::": {      │
│        "semester": "114-1",                                 │
│        "courseName": "SPIKE PRO 日 1000-1200",             │
│        "date": "2025-11-23",                               │
│        "topic": "",                                         │
│        "overview": { hasPhotos, hasVideos, hasSummary },   │
│        "students": {                                        │
│          "陳杰睿": {                                         │
│            "photoCount": 4,                                 │
│            "videoCount": 0,                                 │
│            "hasComment": false,                             │
│            "hasAnyUpload": true,                            │
│            "lastUploadTime": "2025-11-26T14:20:29.035Z"   │
│          }                                                   │
│        }                                                     │
│      }                                                       │
│    }                                                         │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
```

### 前端架構

```
┌─────────────────────────────────────────────────────────────┐
│                      前端頁面層                               │
├─────────────────────────────────────────────────────────────┤
│  frontend-v2/src/App.tsx                                    │
│  ├─ 課程範圍選擇: today / week / all                         │
│  ├─ 課程過濾: 講師 / 課別 / 週次 / 關鍵字                     │
│  └─ 頁面切換: courses / students / overview                 │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      元件層                                   │
├─────────────────────────────────────────────────────────────┤
│  components/course/CourseList.tsx                           │
│  └─ 渲染課程列表（grid 或 horizontal）                       │
│                                                              │
│  components/course/CourseCard.tsx                           │
│  ├─ 顯示課程基本資訊（名稱、日期、地點、講師）                │
│  ├─ 顯示學生數量與上傳統計 ⭐                                 │
│  │   - uploadedStudentCount / studentCount                 │
│  │   - totalUploadedFiles                                  │
│  └─ 顯示課程總覽上傳狀態 ⭐                                   │
│      - overviewUploaded                                     │
│      - overviewFileCount                                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   React Query Hooks                          │
├─────────────────────────────────────────────────────────────┤
│  hooks/useCourses.ts                                        │
│  ├─ useTodayCourses() - 今日課程 + 統計 ⭐                   │
│  ├─ useWeekCourses() - 本週課程 + 統計 ⭐                    │
│  └─ useCourses(params) - 自訂範圍課程                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      API 服務層                               │
├─────────────────────────────────────────────────────────────┤
│  services/api/courseApi.ts                                  │
│  ├─ getCourses({ includeStats: true/false })               │
│  ├─ getTodayCourses() - 預設 includeStats: true ⭐          │
│  └─ getWeekCourses() - 預設 includeStats: true ⭐           │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    HTTP GET /api/v2/courses
```

---

## 🔄 資料流程圖

### 課程列表載入流程

```
使用者開啟頁面
    ↓
App.tsx 初始化
    ↓
useTodayCourses() Hook 執行
    ↓
courseApi.getTodayCourses()
    ├─ 設定 includeStats: true
    └─ 呼叫 courseApi.getCourses({ startDate, endDate, includeStats: true })
    ↓
HTTP GET /api/v2/courses?startDate=2025-11-26&endDate=2025-11-26&includeStats=true
    ↓
routes/v2-courses.js 處理請求
    ├─ 從 eventsCache 取得課程事件
    ├─ 轉換為課程格式 (eventToCourse)
    ├─ 計算學生數量 (transformStudentsToV2Format)
    └─ 計算上傳統計 ⭐
        ├─ 取得 semester (semesterHelper.getCurrentSemester)
        ├─ 清理課程名稱 (courseNameCleaner.cleanCourseName)
        └─ 查詢索引 (learningRecordsIndex.getCourseSummary)
            ├─ 讀取 data/learning-records-index.json
            ├─ 統計已上傳學生數
            ├─ 統計總上傳檔案數
            └─ 檢查課程總覽狀態
    ↓
返回課程資料 (含上傳統計)
    ↓
React Query 快取資料
    ↓
CourseList 渲染課程列表
    ↓
CourseCard 顯示每個課程
    ├─ 顯示「已上傳 X / 總學生 Y」
    ├─ 顯示「共 Z 個檔案」
    └─ 顯示「課程總覽已上傳 / 尚未上傳」
```

### 上傳後索引更新流程

```
使用者上傳學習記錄
    ↓
learning-upload-helper.js 處理上傳
    ↓
上傳成功後更新索引
    ├─ learningRecordsIndex.updateStudentRecordSummary({
    │     semester, courseName, date, topic,
    │     studentName, photoCount, videoCount, hasComment
    │  })
    └─ learningRecordsIndex.updateOverviewRecordSummary({
          semester, courseName, date, topic,
          hasPhotos, hasVideos, hasSummary
      })
    ↓
更新 data/learning-records-index.json
    ├─ 使用 safe-file-operations.js 原子寫入
    └─ 清除快取 (SmartCacheManager)
    ↓
下次查詢時返回最新統計
```

---

## 📝 關鍵程式碼位置

### 後端關鍵檔案

| 檔案路徑 | 功能說明 | 關鍵函數/API |
|---------|---------|-------------|
| `routes/v2-courses.js` | V2 課程 API 路由 | `GET /api/v2/courses` (第118-322行) |
| `utils/learning-records-index.js` | 學習記錄索引管理 | `getCourseSummary()` (第309-329行) |
| `utils/course-name-cleaner.js` | 課程名稱清理 | `cleanCourseName()` |
| `utils/semester-helper.js` | 學期計算 | `getCurrentSemester()` |
| `learning-upload-helper.js` | 學習記錄上傳處理 | 上傳後更新索引 |

### 前端關鍵檔案

| 檔案路徑 | 功能說明 | 關鍵元件/函數 |
|---------|---------|-------------|
| `frontend-v2/src/App.tsx` | 主應用程式 | 課程範圍選擇、過濾邏輯 |
| `frontend-v2/src/components/course/CourseCard.tsx` | 課程卡片 | 上傳統計顯示 (第90-121行) |
| `frontend-v2/src/components/course/CourseList.tsx` | 課程列表 | 渲染課程卡片 |
| `frontend-v2/src/hooks/useCourses.ts` | 課程資料 Hooks | `useTodayCourses()`, `useWeekCourses()` |
| `frontend-v2/src/services/api/courseApi.ts` | 課程 API 服務 | `getTodayCourses()`, `getWeekCourses()` |

---

## 🔧 V2 路徑規劃

### API 路由結構

```
/api/v2/
├── courses                    # 課程相關 API
│   ├── GET /courses          # 取得課程列表
│   │   ├── ?startDate=YYYY-MM-DD
│   │   ├── &endDate=YYYY-MM-DD
│   │   ├── &includeStats=true/false  ⭐ 是否包含上傳統計
│   │   └── &mode=summary/full
│   ├── GET /courses/:id      # 取得單一課程
│   └── GET /courses/search   # 搜尋課程
│       └── ?q=keyword
│
├── students                   # 學生相關 API
│   ├── GET /students         # 取得學生列表
│   │   ├── ?courseId=xxx
│   │   ├── &courseName=xxx
│   │   └── &semester=xxx
│   └── POST /students/:id/comment  # 更新學生評語
│
├── upload                     # 上傳相關 API
│   ├── POST /upload/student-record    # 上傳學生記錄
│   └── POST /upload/overview-record   # 上傳課程總覽
│
└── deeplink-course           # Deep Link 課程查詢
    └── GET /deeplink-course
        ├── ?courseId=xxx
        ├── &courseTitle=xxx
        ├── &date=YYYY-MM-DD
        └── &instructor=xxx
```

### 前端路由結構

```
frontend-v2/
├── src/
│   ├── App.tsx                      # 主應用（路由管理）
│   ├── main.tsx                     # 應用入口
│   │
│   ├── components/                  # UI 元件
│   │   ├── course/
│   │   │   ├── CourseCard.tsx      # 課程卡片 ⭐
│   │   │   ├── CourseList.tsx      # 課程列表 ⭐
│   │   │   └── CourseDrawer.tsx    # 課程抽屜
│   │   ├── student/
│   │   │   ├── StudentCard.tsx
│   │   │   ├── StudentList.tsx
│   │   │   └── StudentMediaDrawer.tsx
│   │   ├── upload/
│   │   │   ├── MediaUploader.tsx
│   │   │   ├── FilePreview.tsx
│   │   │   └── RemoteMediaCard.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Card.tsx
│   │       └── Loading.tsx
│   │
│   ├── hooks/                       # React Query Hooks
│   │   ├── useCourses.ts           # 課程資料 ⭐
│   │   ├── useStudents.ts          # 學生資料
│   │   └── useUpload.ts            # 上傳功能
│   │
│   ├── services/                    # 服務層
│   │   ├── api/
│   │   │   ├── client.ts           # API 客戶端
│   │   │   ├── courseApi.ts        # 課程 API ⭐
│   │   │   └── studentApi.ts       # 學生 API
│   │   └── upload/
│   │       └── uploadConfig.ts
│   │
│   ├── store/                       # Zustand 狀態管理
│   │   ├── courseStore.ts
│   │   ├── studentStore.ts
│   │   └── uploadStore.ts
│   │
│   ├── types/                       # TypeScript 類型定義
│   │   └── index.ts
│   │
│   └── utils/                       # 工具函數
│       ├── courseName.ts
│       ├── courseTopic.ts
│       ├── media.ts
│       └── semester.ts
```

---

## 🎨 CourseCard 顯示邏輯

### 上傳統計顯示條件

```typescript
// CourseCard.tsx 第 90-121 行

{/* 學生上傳統計 - 僅在有資料時顯示 */}
{typeof course.uploadedStudentCount === 'number' && (
  <div className="pl-6 flex flex-wrap items-center gap-2 text-xs text-gray-500">
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
      已上傳 {course.uploadedStudentCount} / 總學生 {course.studentCount}
    </span>
    {typeof course.totalUploadedFiles === 'number' && course.totalUploadedFiles > 0 && (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200 text-[11px]">
        共 {course.totalUploadedFiles} 個檔案
      </span>
    )}
  </div>
)}

{/* 課程總覽上傳狀態 */}
{typeof course.overviewUploaded === 'boolean' && (
  <div className="pl-6 flex flex-wrap items-center gap-2 mt-1 text-[11px]">
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${
      course.overviewUploaded
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-gray-50 text-gray-500 border-gray-200'
    }`}>
      <span className="mr-1">📋</span>
      {course.overviewUploaded ? '課程總覽已上傳' : '課程總覽尚未上傳'}
    </span>
  </div>
)}
```

---

## ✅ 已完成的修改

### 後端修改

1. ✅ **routes/v2-courses.js** (第17行)
   - 引入 `learningRecordsIndex` 模組

2. ✅ **routes/v2-courses.js** (第208-265行)
   - 使用 `learningRecordsIndex.getCourseSummary()` 快速查詢
   - 統計已上傳學生數 (`uploadedStudentCount`)
   - 統計總上傳檔案數 (`totalUploadedFiles`)
   - 檢查課程總覽狀態 (`overviewUploaded`, `overviewFileCount`)

### 前端修改

1. ✅ **frontend-v2/src/services/api/courseApi.ts** (第61-75行)
   - `getTodayCourses()` 預設啟用 `includeStats: true`

2. ✅ **frontend-v2/src/services/api/courseApi.ts** (第77-95行)
   - `getWeekCourses()` 預設啟用 `includeStats: true`

3. ✅ **frontend-v2/src/components/course/CourseCard.tsx** (第90-121行)
   - 已有完整的上傳統計顯示邏輯（無需修改）

---

## 🔍 待確認問題

### 問題 1: 索引資料是否正確更新？

**檢查點**:
- `data/learning-records-index.json` 是否存在且有資料？ ✅ 已確認（15KB）
- 上傳學習記錄後，索引是否自動更新？ ⚠️ 待確認
- 索引中的課程名稱是否經過清理（移除週次）？ ⚠️ 待確認

**驗證方法**:
```bash
# 檢查索引檔案內容
cat data/learning-records-index.json | jq '.courses | keys'

# 檢查特定課程的統計
cat data/learning-records-index.json | jq '.courses["114-1::SPIKE PRO 日 1000-1200::2025-11-23::"]'
```

### 問題 2: API 是否正確返回統計資料？

**檢查點**:
- `/api/v2/courses?includeStats=true` 是否返回統計欄位？ ✅ 已確認（有欄位但值為 0）
- 統計數字是否正確？ ⚠️ 待確認（目前都是 0）

**驗證方法**:
```bash
# 測試今日課程 API
curl "http://localhost:3000/api/v2/courses?startDate=$(date +%Y-%m-%d)&endDate=$(date +%Y-%m-%d)&includeStats=true" | jq '.data[0]'
```

### 問題 3: 前端是否正確顯示統計？

**檢查點**:
- CourseCard 是否收到統計資料？ ⚠️ 待確認
- 統計數字是否正確顯示？ ⚠️ 待確認
- 條件渲染邏輯是否正確？ ✅ 已確認（邏輯正確）

**驗證方法**:
- 開啟 `http://localhost:5174/`
- 檢查瀏覽器 Console
- 檢查 Network 面板的 API 回應

---

## 🚨 可能的問題點

### 1. 課程名稱不一致

**問題**: 索引中的課程名稱可能包含週次，但 API 查詢時已清理週次
```javascript
// 索引中: "SPIKE PRO 日 1000-1200 第8週"
// 查詢時: "SPIKE PRO 日 1000-1200"
// 結果: 找不到匹配的課程
```

**解決方案**: 確保索引更新時也使用 `cleanCourseName()`

### 2. 學期格式不一致

**問題**: 索引中的學期格式可能與查詢時不同
```javascript
// 索引中: "114-1"
// 查詢時: "2025上學期"
// 結果: 找不到匹配的課程
```

**解決方案**: 統一學期格式或建立映射關係

### 3. 日期格式不一致

**問題**: 索引中的日期格式可能與查詢時不同
```javascript
// 索引中: "2025-11-23"
// 查詢時: "20251123"
// 結果: 找不到匹配的課程
```

**解決方案**: 統一使用 `YYYY-MM-DD` 格式

---

## 📋 下一步待辦清單

詳見 `V2-UPLOAD-STATS-TODO.md`

---

## 📚 參考資料

- [learning-records-index.js 原始碼](../utils/learning-records-index.js)
- [v2-courses.js 原始碼](../routes/v2-courses.js)
- [courseApi.ts 原始碼](../frontend-v2/src/services/api/courseApi.ts)
- [CourseCard.tsx 原始碼](../frontend-v2/src/components/course/CourseCard.tsx)
