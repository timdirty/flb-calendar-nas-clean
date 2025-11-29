# 📋 V2 課程上傳統計待辦清單

> **建立日期**: 2025-11-26  
> **目標**: 在課程選擇區顯示每個課程的上傳狀況  
> **參考文檔**: [V2-UPLOAD-STATS-ARCHITECTURE.md](./V2-UPLOAD-STATS-ARCHITECTURE.md)

---

## 🎯 總體進度

- [x] 階段一：完整梳理現有架構
- [ ] 階段二：確認 V2 路徑規劃與 API 流程
- [ ] 階段三：診斷並修復問題
- [ ] 階段四：測試驗證
- [ ] 階段五：文檔更新與記憶保存

---

## 📊 階段一：完整梳理現有架構 ✅

### ✅ 已完成項目

1. [x] 建立完整架構文檔 `V2-UPLOAD-STATS-ARCHITECTURE.md`
2. [x] 梳理後端資料流程
3. [x] 梳理前端資料流程
4. [x] 確認關鍵程式碼位置
5. [x] 列出已完成的修改
6. [x] 識別待確認問題

---

## 🔍 階段二：確認 V2 路徑規劃與 API 流程

### 2.1 後端索引更新流程驗證

**目標**: 確認上傳學習記錄後，索引是否正確更新

#### 檢查點 1: 索引更新觸發點
- [ ] 檢查 `learning-upload-helper.js` 是否在上傳成功後呼叫索引更新
  ```bash
  grep -n "learningRecordsIndex.update" learning-upload-helper.js
  ```
- [ ] 確認更新時使用的參數格式是否正確
  - [ ] semester 格式
  - [ ] courseName 是否經過 `cleanCourseName()` 清理
  - [ ] date 格式 (YYYY-MM-DD)
  - [ ] topic 是否正確提取

#### 檢查點 2: 索引資料結構驗證
- [ ] 檢查現有索引檔案的課程 key 格式
  ```bash
  cat data/learning-records-index.json | jq '.courses | keys' | head -20
  ```
- [ ] 確認課程名稱是否包含週次（應該要移除）
- [ ] 確認學期格式是否一致

#### 檢查點 3: 索引查詢邏輯驗證
- [ ] 檢查 `v2-courses.js` 中查詢索引時使用的參數
  - [ ] semester 來源與格式
  - [ ] courseName 清理邏輯
  - [ ] date 格式
  - [ ] topic 處理

**預期結果**:
- 索引更新與查詢使用相同的課程名稱清理邏輯
- 學期格式統一
- 日期格式統一為 `YYYY-MM-DD`

**驗證命令**:
```bash
# 1. 檢查索引檔案中的課程 key
cat data/learning-records-index.json | jq '.courses | keys | .[]' | grep "SPIKE"

# 2. 檢查特定課程的資料
cat data/learning-records-index.json | jq '.courses | to_entries | .[] | select(.key | contains("SPIKE")) | {key: .key, students: (.value.students | keys)}'

# 3. 測試 API 查詢
curl -s "http://localhost:3000/api/v2/courses?startDate=2025-11-23&endDate=2025-11-23&includeStats=true" | jq '.data[] | select(.name | contains("SPIKE")) | {name, uploadedStudentCount, totalUploadedFiles}'
```

---

### 2.2 前端 API 呼叫流程驗證

**目標**: 確認前端是否正確呼叫 API 並取得統計資料

#### 檢查點 1: API 參數傳遞
- [ ] 確認 `courseApi.getTodayCourses()` 是否正確設定 `includeStats: true`
- [ ] 確認 `courseApi.getWeekCourses()` 是否正確設定 `includeStats: true`
- [ ] 檢查 `courseApi.getCourses()` 的參數處理邏輯

#### 檢查點 2: React Query 快取策略
- [ ] 檢查 `useTodayCourses` 的 staleTime 設定
- [ ] 檢查 `useWeekCourses` 的 staleTime 設定
- [ ] 確認快取是否會影響統計資料的即時性

#### 檢查點 3: 資料型別定義
- [ ] 檢查 `types/index.ts` 中 Course 型別是否包含統計欄位
  ```typescript
  interface Course {
    // ... 其他欄位
    uploadedStudentCount?: number;
    totalUploadedFiles?: number;
    overviewUploaded?: boolean;
    overviewFileCount?: number;
  }
  ```

**驗證方法**:
1. 開啟瀏覽器開發者工具
2. 切換到 Network 面板
3. 重新載入頁面
4. 檢查 `/api/v2/courses` 請求
   - 確認 URL 參數包含 `includeStats=true`
   - 確認回應資料包含統計欄位

---

### 2.3 CourseCard 顯示邏輯驗證

**目標**: 確認 CourseCard 是否正確顯示統計資料

#### 檢查點 1: 條件渲染邏輯
- [ ] 確認 `typeof course.uploadedStudentCount === 'number'` 條件是否正確
- [ ] 確認 `typeof course.overviewUploaded === 'boolean'` 條件是否正確
- [ ] 檢查是否有其他條件阻止顯示

#### 檢查點 2: 資料傳遞鏈
- [ ] App.tsx → CourseList → CourseCard 的 props 傳遞是否完整
- [ ] 檢查是否有中間層過濾或轉換資料

**驗證方法**:
1. 在 CourseCard.tsx 中加入 console.log
   ```typescript
   console.log('CourseCard received:', {
     name: course.name,
     uploadedStudentCount: course.uploadedStudentCount,
     totalUploadedFiles: course.totalUploadedFiles,
     overviewUploaded: course.overviewUploaded
   });
   ```
2. 檢查瀏覽器 Console 輸出

---

## 🔧 階段三：診斷並修復問題

### 3.1 問題診斷清單

根據階段二的驗證結果，逐一診斷以下可能的問題：

#### 問題 A: 課程名稱不一致 ⚠️

**症狀**: API 查詢返回 `uploadedStudentCount: 0`，但索引檔案中有資料

**可能原因**:
1. 索引更新時沒有清理週次
2. API 查詢時清理了週次，但索引中保留週次
3. 課程名稱格式不一致（空格、大小寫等）

**診斷步驟**:
- [ ] 比對索引中的課程 key 與 API 查詢時的課程名稱
  ```bash
  # 索引中的課程名稱
  cat data/learning-records-index.json | jq '.courses | keys | .[]' | head -5
  
  # API 查詢時的課程名稱（從後端日誌）
  # 需要在 v2-courses.js 第215行加入 console.log
  ```

**修復方案**:
- [ ] 選項 1: 修改 `learning-upload-helper.js`，更新索引時使用 `cleanCourseName()`
- [ ] 選項 2: 修改 `v2-courses.js`，查詢時嘗試多種課程名稱格式
- [ ] 選項 3: 建立課程名稱映射表

**修復位置**:
```javascript
// learning-upload-helper.js
const { cleanCourseName } = require('./utils/course-name-cleaner');

// 更新索引時
await learningRecordsIndex.updateStudentRecordSummary({
  semester,
  courseName: cleanCourseName(courseName), // ⭐ 加入清理
  date,
  topic,
  studentName,
  photoCount,
  videoCount,
  hasComment
});
```

---

#### 問題 B: 學期格式不一致 ⚠️

**症狀**: 索引中使用 "114-1"，但 API 查詢使用 "2025上學期"

**可能原因**:
1. 索引更新與 API 查詢使用不同的學期計算邏輯
2. 學期格式沒有統一

**診斷步驟**:
- [ ] 檢查索引中的學期格式
  ```bash
  cat data/learning-records-index.json | jq '.courses | to_entries | .[0].value.semester'
  ```
- [ ] 檢查 API 查詢時的學期格式
  ```javascript
  // v2-courses.js 第211行
  console.log('Querying index with semester:', semester);
  ```

**修復方案**:
- [ ] 統一使用 `semesterHelper.getCurrentSemester(date)` 計算學期
- [ ] 或建立學期格式轉換函數

**修復位置**:
```javascript
// learning-upload-helper.js
const semesterHelper = require('./utils/semester-helper');

// 更新索引時
const semester = semesterHelper.getCurrentSemester(date);
await learningRecordsIndex.updateStudentRecordSummary({
  semester, // ⭐ 使用統一格式
  // ...
});
```

---

#### 問題 C: 索引未自動更新 ⚠️

**症狀**: 上傳學習記錄後，索引檔案沒有更新

**可能原因**:
1. `learning-upload-helper.js` 沒有呼叫索引更新
2. 索引更新失敗但沒有錯誤訊息
3. 檔案權限問題

**診斷步驟**:
- [ ] 檢查 `learning-upload-helper.js` 是否有索引更新邏輯
  ```bash
  grep -A 10 "learningRecordsIndex.update" learning-upload-helper.js
  ```
- [ ] 檢查後端日誌是否有索引更新的訊息
- [ ] 檢查檔案權限
  ```bash
  ls -la data/learning-records-index.json
  ```

**修復方案**:
- [ ] 在上傳成功後加入索引更新邏輯
- [ ] 加入錯誤處理與日誌輸出

**修復位置**:
```javascript
// learning-upload-helper.js
// 在上傳成功後
try {
  await learningRecordsIndex.updateStudentRecordSummary({
    semester,
    courseName: cleanCourseName(courseName),
    date,
    topic,
    studentName,
    photoCount,
    videoCount,
    hasComment
  });
  console.log('✅ 索引更新成功:', { semester, courseName, date, studentName });
} catch (error) {
  console.error('❌ 索引更新失敗:', error);
}
```

---

#### 問題 D: API 查詢邏輯錯誤 ⚠️

**症狀**: 索引有資料，但 API 查詢返回 0

**可能原因**:
1. `learningRecordsIndex.getCourseSummary()` 參數錯誤
2. 課程 key 建構邏輯不一致
3. 快取問題

**診斷步驟**:
- [ ] 在 `v2-courses.js` 加入詳細日誌
  ```javascript
  console.log('🔍 查詢索引:', { semester, courseName, date, topic });
  const courseSummary = await learningRecordsIndex.getCourseSummary({
    semester,
    courseName: normalizedCourseName,
    date: course.date,
    topic: '',
  });
  console.log('📊 索引查詢結果:', courseSummary);
  ```
- [ ] 檢查 `learning-records-index.js` 中的 `buildCourseKey()` 邏輯

**修復方案**:
- [ ] 確保查詢參數與索引 key 建構邏輯一致
- [ ] 清除快取後重試

---

### 3.2 修復優先順序

根據診斷結果，按以下順序修復：

1. **高優先級** - 影響核心功能
   - [ ] 問題 C: 索引未自動更新
   - [ ] 問題 A: 課程名稱不一致

2. **中優先級** - 影響資料準確性
   - [ ] 問題 B: 學期格式不一致
   - [ ] 問題 D: API 查詢邏輯錯誤

3. **低優先級** - 優化與改進
   - [ ] 加入更詳細的日誌
   - [ ] 加入錯誤處理
   - [ ] 優化快取策略

---

## ✅ 階段四：測試驗證

### 4.1 後端測試

#### 測試 1: 索引更新測試
```bash
# 1. 備份現有索引
cp data/learning-records-index.json data/learning-records-index.backup.json

# 2. 上傳一筆測試資料（透過前端或 API）

# 3. 檢查索引是否更新
cat data/learning-records-index.json | jq '.updatedAt'

# 4. 檢查新增的課程資料
cat data/learning-records-index.json | jq '.courses | to_entries | sort_by(.value.overview.lastUpdatedAt) | reverse | .[0]'
```

#### 測試 2: API 查詢測試
```bash
# 測試今日課程（含統計）
curl -s "http://localhost:3000/api/v2/courses?startDate=$(date +%Y-%m-%d)&endDate=$(date +%Y-%m-%d)&includeStats=true" \
  | jq '.data[] | {name, studentCount, uploadedStudentCount, totalUploadedFiles, overviewUploaded}'

# 測試特定日期課程
curl -s "http://localhost:3000/api/v2/courses?startDate=2025-11-23&endDate=2025-11-23&includeStats=true" \
  | jq '.data[] | select(.uploadedStudentCount > 0)'
```

#### 測試 3: 課程名稱清理測試
```bash
# 測試課程名稱清理邏輯
node -e "
const { cleanCourseName } = require('./utils/course-name-cleaner');
console.log(cleanCourseName('SPIKE 五 1610-1740 松山 第8週'));
console.log(cleanCourseName('SPIKE PRO 日 1000-1200 第5週'));
"
```

---

### 4.2 前端測試

#### 測試 1: API 呼叫測試
1. 開啟 `http://localhost:5174/`
2. 打開瀏覽器開發者工具 → Network 面板
3. 重新載入頁面
4. 檢查 `/api/v2/courses` 請求
   - [ ] URL 包含 `includeStats=true`
   - [ ] 回應包含統計欄位
   - [ ] 統計數字正確

#### 測試 2: UI 顯示測試
1. 檢查課程卡片是否顯示統計資訊
   - [ ] 「已上傳 X / 總學生 Y」
   - [ ] 「共 Z 個檔案」
   - [ ] 「課程總覽已上傳 / 尚未上傳」
2. 切換課程範圍（今日 / 本週 / 全部）
   - [ ] 統計資料是否正確更新
3. 過濾課程（講師 / 課別 / 週次）
   - [ ] 統計資料是否正確顯示

#### 測試 3: 即時更新測試
1. 上傳一筆學習記錄
2. 重新載入課程列表
3. 檢查統計數字是否更新
   - [ ] 已上傳學生數 +1
   - [ ] 總上傳檔案數增加

---

### 4.3 整合測試

#### 測試場景 1: 新課程上傳
1. 選擇一個沒有上傳記錄的課程
2. 上傳學生學習記錄（照片 + 評語）
3. 重新載入課程列表
4. 預期結果：
   - [ ] 課程卡片顯示「已上傳 1 / 總學生 X」
   - [ ] 顯示「共 Y 個檔案」
   - [ ] 課程總覽顯示「尚未上傳」

#### 測試場景 2: 課程總覽上傳
1. 選擇一個已有學生記錄的課程
2. 上傳課程總覽（照片 + 影片 + 總結）
3. 重新載入課程列表
4. 預期結果：
   - [ ] 課程總覽顯示「已上傳」
   - [ ] 總上傳檔案數包含總覽檔案

#### 測試場景 3: 多學生上傳
1. 選擇一個課程
2. 依序上傳 3 位學生的學習記錄
3. 每次上傳後重新載入課程列表
4. 預期結果：
   - [ ] 已上傳學生數依序為 1, 2, 3
   - [ ] 總上傳檔案數累加

---

## 📝 階段五：文檔更新與記憶保存

### 5.1 更新文檔

- [ ] 更新 `AGENTS.md` 記錄本次修改
- [ ] 更新 `PROJECT-STRUCTURE.md` 補充 V2 架構
- [ ] 建立 `V2-UPLOAD-STATS-COMPLETE.md` 完成報告

### 5.2 建立記憶點

使用 `create_memory` 工具保存以下關鍵資訊：

- [ ] V2 課程上傳統計實作完成
- [ ] learning-records-index 快速查詢機制
- [ ] 課程名稱清理邏輯統一
- [ ] 前後端統計資料流程

### 5.3 清理與優化

- [ ] 移除測試用的 console.log
- [ ] 優化錯誤處理
- [ ] 加入必要的註解
- [ ] 更新版本號

---

## 📊 進度追蹤

### 當前狀態
- **階段**: 二（確認 V2 路徑規劃與 API 流程）
- **進度**: 0%
- **下一步**: 執行階段二的檢查點 1

### 時間記錄
- 2025-11-26 22:50 - 建立架構文檔與待辦清單

---

## 🎯 成功標準

### 必須達成
1. ✅ 課程卡片顯示「已上傳 X / 總學生 Y」
2. ✅ 課程卡片顯示「共 Z 個檔案」
3. ✅ 課程卡片顯示課程總覽上傳狀態
4. ✅ 統計數字即時更新（上傳後重新載入即可看到）
5. ✅ 統計數字準確無誤

### 期望達成
1. ⭐ 查詢速度快（< 100ms）
2. ⭐ 前後端邏輯統一
3. ⭐ 完整的錯誤處理
4. ⭐ 詳細的日誌輸出

---

## 📞 需要協助時

如果遇到問題，請提供以下資訊：
1. 當前執行到哪個階段的哪個檢查點
2. 遇到什麼錯誤或異常現象
3. 相關的日誌輸出
4. 已嘗試的解決方法

---

**最後更新**: 2025-11-26 22:50  
**負責人**: Cascade AI  
**審核人**: Tim (ctctim14)
