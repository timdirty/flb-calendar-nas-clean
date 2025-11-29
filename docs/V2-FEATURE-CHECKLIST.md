# 📋 FLB V2 功能清單與開發進度

## ✅ 第一階段：核心功能 (MVP) - 7天

### Day 1-2：專案基礎
- [ ] React + TypeScript 專案設置
- [ ] TailwindCSS + Shadcn/ui 配置
- [ ] 基礎路由設置
- [ ] 全域樣式與主題
- [ ] 錯誤邊界 (ErrorBoundary)
- [ ] Loading 元件
- [ ] Toast 通知元件

### Day 3：課程管理
- [ ] **CourseList** - 課程列表元件
- [ ] **CourseCard** - 課程卡片元件
- [ ] **CourseFilter** - 日期/講師篩選
- [ ] **courseStore** - 課程狀態管理
- [ ] **API: fetchCourses** - 取得課程列表
- [ ] **Hook: useCourses** - 課程資料 Hook

### Day 4：學生管理
- [ ] **StudentList** - 學生列表元件
- [ ] **StudentCard** - 學生卡片元件
- [ ] **AttendanceStatus** - 出席狀態元件
- [ ] **studentStore** - 學生狀態管理
- [ ] **API: fetchStudents** - 取得學生列表
- [ ] **Hook: useStudents** - 學生資料 Hook

### Day 5-6：媒體上傳（核心）
- [ ] **MediaUploader** - 統一上傳元件
  - [ ] 拖拽上傳
  - [ ] 點擊選擇
  - [ ] 多檔上傳
  - [ ] 檔案驗證
- [ ] **MediaPreview** - 統一預覽元件
  - [ ] 照片預覽
  - [ ] 影片預覽（含縮圖）
  - [ ] 刪除按鈕
  - [ ] 狀態指示器
- [ ] **ProgressBar** - 進度條元件
- [ ] **ChunkedUploader** - 分片上傳服務
- [ ] **uploadStore** - 上傳狀態管理
- [ ] **API: initUpload/uploadChunk/completeUpload**
- [ ] **Hook: useUpload** - 上傳邏輯 Hook

### Day 7：整合與測試
- [ ] 完整上傳流程測試
- [ ] 錯誤處理完善
- [ ] UI/UX 調整
- [ ] 響應式佈局檢查
- [ ] 手機端測試

---

## 🚧 第二階段：進階功能 - 4天

### Day 8：學生上傳頁面
- [ ] **StudentUpload** 頁面
- [ ] 左側學生列表
- [ ] 右側上傳區域
- [ ] 底部進度追蹤
- [ ] 評語輸入框
- [ ] 批次上傳支援

### Day 9：課程總覽頁面
- [ ] **OverviewUpload** 頁面
- [ ] 照片上傳區
- [ ] 影片上傳區
- [ ] 課程摘要輸入
- [ ] 主題設定
- [ ] 總覽預覽

### Day 10：歷史記錄
- [ ] **History** 頁面
- [ ] 記錄列表
- [ ] 日期篩選
- [ ] 課程篩選
- [ ] 照片/影片瀏覽器
- [ ] 記錄刪除功能

### Day 11：效能優化
- [ ] 圖片壓縮 (ImageCompressor)
- [ ] 影片縮圖生成 (ThumbnailGenerator)
- [ ] 虛擬滾動 (react-window)
- [ ] 懶載入 (React.lazy)
- [ ] 快取策略 (React Query)

---

## 💡 第三階段：企業功能 - 3天

### Day 12：進階體驗
- [ ] 深色模式支援
- [ ] 鍵盤快捷鍵
- [ ] 拖拽排序
- [ ] 範本管理
- [ ] 快速填寫

### Day 13：資料管理
- [ ] 批次操作
- [ ] 匯出功能
- [ ] 備份還原
- [ ] 資料統計

### Day 14：部署與監控
- [ ] 生產建構
- [ ] 效能監控
- [ ] 錯誤追蹤 (Sentry)
- [ ] 使用分析
- [ ] 文件完善

---

## 📊 元件清單（共 30+ 個）

### 📄 頁面元件 (4)
- [ ] CourseSelection.tsx
- [ ] StudentUpload.tsx
- [ ] OverviewUpload.tsx
- [ ] History.tsx

### 🎓 課程元件 (3)
- [ ] CourseList.tsx
- [ ] CourseCard.tsx
- [ ] CourseFilter.tsx

### 👥 學生元件 (4)
- [ ] StudentList.tsx
- [ ] StudentCard.tsx
- [ ] AttendanceStatus.tsx
- [ ] StudentProgress.tsx

### 📷 媒體元件 (6)
- [ ] MediaUploader.tsx
- [ ] MediaPreview.tsx
- [ ] PhotoPreview.tsx
- [ ] VideoPreview.tsx
- [ ] ProgressBar.tsx
- [ ] ThumbnailGenerator.tsx

### 📝 表單元件 (3)
- [ ] CommentInput.tsx
- [ ] TopicInput.tsx
- [ ] FormField.tsx

### 🎨 UI 元件 (10+)
- [ ] Button.tsx
- [ ] Modal.tsx
- [ ] Toast.tsx
- [ ] Loading.tsx
- [ ] ErrorBoundary.tsx
- [ ] Header.tsx
- [ ] Sidebar.tsx
- [ ] Footer.tsx
- [ ] Card.tsx
- [ ] Badge.tsx

---

## 🔌 API 端點清單

### 課程相關
- [ ] `GET /api/v2/courses` - 取得課程列表
- [ ] `GET /api/v2/courses/:id` - 取得單一課程

### 學生相關
- [ ] `GET /api/v2/courses/:courseId/students` - 取得學生列表
- [ ] `PATCH /api/v2/students/:id/attendance` - 更新出席狀態

### 上傳相關
- [ ] `POST /api/v2/upload/init` - 初始化上傳
- [ ] `POST /api/v2/upload/chunk` - 上傳分片
- [ ] `POST /api/v2/upload/complete` - 完成上傳

### 歷史相關
- [ ] `GET /api/v2/records` - 取得歷史記錄
- [ ] `DELETE /api/v2/records/:id` - 刪除記錄

---

## 🧪 測試清單

### 單元測試
- [ ] 元件渲染測試
- [ ] Hooks 邏輯測試
- [ ] 工具函數測試
- [ ] Store 狀態測試

### 整合測試
- [ ] 上傳流程測試
- [ ] 表單提交測試
- [ ] API 整合測試

### E2E 測試
- [ ] 完整使用者流程
- [ ] 錯誤處理測試
- [ ] 響應式測試

---

## 🎯 效能指標

### 核心指標
- [ ] FCP < 1s
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] 包體積 < 500KB (gzip)

### 功能指標
- [ ] 上傳成功率 > 99%
- [ ] 平均上傳速度提升 30%
- [ ] 記憶體使用 < 100MB

---

## 📱 瀏覽器支援

- [ ] Chrome 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Edge 90+
- [ ] iOS Safari 14+
- [ ] Android Chrome 90+

---

## 🚀 部署檢查清單

### 建構
- [ ] 生產環境建構成功
- [ ] 沒有 console.log
- [ ] 沒有未使用的程式碼
- [ ] Source map 已移除

### 配置
- [ ] 環境變數設置正確
- [ ] API 端點正確
- [ ] CORS 設置正確
- [ ] 快取策略設置

### 測試
- [ ] 所有測試通過
- [ ] 手動測試完成
- [ ] 效能測試通過
- [ ] 安全掃描通過

### 監控
- [ ] 錯誤追蹤設置
- [ ] 效能監控設置
- [ ] 使用分析設置
- [ ] 日誌系統設置

---

_最後更新：2025-11-23_
