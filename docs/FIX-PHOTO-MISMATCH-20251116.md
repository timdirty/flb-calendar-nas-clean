# 照片回填學生錯配問題修復報告

**修復日期**：2025-11-16  
**修復人員**：Cascade AI  
**問題追蹤**：照片上傳到正確資料夾，但回填時顯示在錯誤學生卡片

---

## 問題描述

### 現象
- ✅ 上傳 A 學生的照片，檔案正確儲存到 **A 學生資料夾**
- ❌ 重新載入頁面後，照片卻出現在 **C 學生的卡片**上
- ❌ 照片 URL 使用了錯誤的學生名稱參數

### 影響範圍
- 新媒體系統照片（使用 Drive Photo Preview API）
- 主卡片照片回填功能（`applyExistingRecordToCard`）

---

## 根本原因分析

### 問題定位
**檔案**：`public/js/pages/learning-record-upload.js`  
**函數**：`applyExistingRecordToCard`  
**行數**：第 9718 行（修復前）

### 原始邏輯錯誤
```javascript
// ❌ 錯誤：優先使用 uploaded.studentName（可能不準確）
var studentName = uploaded.studentName || (student && student.name) || '';
```

### 錯誤流程
1. **上傳階段**：
   - 照片正確上傳到 `/學生A/` 資料夾 ✅
   - 後端建立 `metadata.json`，記錄 `studentName`

2. **metadata 錯誤場景**：
   - 如果後端路徑解析或 metadata 寫入錯誤
   - `uploaded.studentName` 可能被誤設為 "學生C"

3. **回填階段**：
   - 前端從快取讀取 `uploaded` 記錄
   - 建構照片 URL 時使用 `uploaded.studentName`（錯誤的 "學生C"）
   - 結果：URL 參數錯誤，但實際檔案在學生A資料夾

4. **顯示錯亂**：
   - 在學生C的卡片上，使用錯誤參數請求學生A的照片
   - 可能成功（如果 API 容錯），導致照片錯配
   - 或失敗（404），導致照片無法顯示

---

## 修復方案

### 修復邏輯
**優先順序調整**：優先使用當前卡片對應的 `student.name`（最準確）

```javascript
// ✅ 正確：優先使用當前卡片的 student.name
var studentName = (student && student.name) || uploaded.studentName || '';
```

### 修復位置
**檔案**：`public/js/pages/learning-record-upload.js`  
**行數**：第 9719 行  
**函數**：`applyExistingRecordToCard(index, student, uploaded)`

### 修復程式碼
```javascript
if (isNewSystem) {
  // 新系統：使用縮圖 API（使用 coursePeriod）
  var coursePeriod = uploaded.coursePeriod || (currentCourse && currentCourse.coursePeriod) || '';
  var date = uploaded.date || (currentCourse && currentCourse.date) || '';
  // 🔥 [修復] 優先使用當前卡片的 student.name，避免 uploaded.studentName 錯誤導致照片錯配
  var studentName = (student && student.name) || uploaded.studentName || '';
  
  // 🔥 [重要] date 應該是完整資料夾名稱（包含主題），例如 "2025-11-05 四足獸"
  url = buildDrivePhotoPreviewUrl(photoId, uploaded, {
    date: date,
    studentName: studentName,  // ← 使用正確的學生名稱
    coursePeriod: coursePeriod,
    courseName: courseNameHint,
    semester: semesterHint,
    relativePath: relativePathHint
  });
}
```

---

## 自檢驗證

### ✅ 已檢查項目

#### 1. 修復點正確性
- ✅ 第 9719 行已修復（優先使用 `student.name`）
- ✅ 註解清楚說明修復原因

#### 2. 調用路徑檢查
- ✅ `applyExistingRecordToCard(idx, students[idx], uploaded)` - 第 8254 行
  - 傳入正確的 `students[idx]`（當前卡片學生）
- ✅ `applyExistingRecordToCard(index, student, studentRecord)` - 第 8598 行
  - 傳入正確的 `student` 參數

#### 3. 其他相關函數檢查
- ✅ `buildRecordFileUrl(uploaded, filename)` - 第 9739 行（舊系統照片）
  - 使用 `uploaded.relativePath`，如果路徑正確則不受影響
  - 如果 `relativePath` 也錯誤，需要後端修復
  
- ✅ `renderUploadedRecords` 中的照片渲染 - 第 15070 行
  - 使用 `r.studentName`（抽屜面板，非卡片回填）
  - 這是正確的，因為 `r` 本身就是該學生的記錄

#### 4. studentNameKey 使用
- ✅ 第 9602 行：`var studentNameKey = String(student.name || student.studentName || uploaded.studentName || '')`
  - 優先順序正確（先用 `student.name`）

---

## 潛在風險評估

### ⚠️ 需注意的場景

#### 場景 1：舊系統照片/影片
如果 `uploaded.relativePath` 本身包含錯誤的學生名稱（例如路徑是 `/.../學生C/...`），則舊系統的檔案 URL 仍可能錯誤。

**建議**：
- 檢查後端 `learning-upload-helper.js` 中 `relativePath` 的建構邏輯
- 確保路徑使用的學生名稱與實際上傳的一致

#### 場景 2：後端 metadata 錯誤
如果後端持續產生錯誤的 `studentName` metadata，建議：
1. 檢查 `learning-upload-helper.js` 第 1252 行的邏輯
2. 確保優先使用上傳時傳入的 `metadata.studentName`
3. 避免從路徑解析學生名稱時出錯

---

## 測試計劃

### 測試環境
```bash
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
npm run dev
```

### 測試步驟

#### 測試 1：基本照片上傳與回填
1. 開啟 `http://localhost:3000/learning-record-upload.html`
2. 選擇一個課程（包含多位學生）
3. 為 **學生A** 上傳照片 → 確認上傳成功
4. 為 **學生C** 上傳照片 → 確認上傳成功
5. 重新整理頁面或切換課程
6. **驗證**：
   - ✅ 學生A 卡片只顯示學生A的照片
   - ✅ 學生C 卡片只顯示學生C的照片
   - ✅ 不會出現照片錯配

#### 測試 2：Console 日誌檢查
開啟瀏覽器 DevTools → Console，觀察：
```
📸 [主卡片-新系統] 照片縮圖: { 
  photoId: '...', 
  studentName: '應為當前學生',  // ← 檢查此欄位
  url: '...' 
}
```

#### 測試 3：混合上傳測試
1. 上傳學生A的照片
2. 不重新載入，直接上傳學生B的照片
3. 重新載入頁面
4. **驗證**：兩位學生的照片都正確顯示在各自卡片

#### 測試 4：抽屜面板檢查
1. 點擊「已上傳記錄」抽屜
2. **驗證**：每位學生的照片都正確顯示在對應的學生區塊

---

## ✅ 路徑編碼問題修復完成

### 問題發現
從日誌發現路徑中的中文字元被錯誤編碼：
```
SPIKE äº\x94 1610-1740 æ\x9D¾å±± ç¬¬8é\x80±
```
正確應該是：
```
SPIKE 五 1610-1740 松山 第8週
```

### 根本原因
Synology Drive API 請求時，`synology-drive-client.js` 使用 GET 方法，axios 處理 URL 參數時 UTF-8 字元被錯誤解析為 Latin-1。

### 修復內容
修改 `synology-drive-client.js` 第 705-713 行：
- 將 `axios.get(this.apiUrl, { params })` 改為 `axios.post(this.apiUrl, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })`
- 使用 `URLSearchParams` 確保正確 UTF-8 編碼

### 影響範圍
所有包含中文字元的 Synology Drive 路徑操作（列出檔案、讀取學習記錄等）

### 測試方法
1. 重啟伺服器：`npm run dev` 或 `PORT=3000 node server.js`
2. 執行：`curl "http://localhost:3000/api/learning-records/history-drive?semester=114-1&courseName=SPIKE%20%E4%BA%94%201610-1740%20%E6%9D%BE%E5%B1%B1%20%E7%AC%AC8%E9%80%B1&date=2025-11-14"`
3. 驗證：`count` > 0 且記錄正確

---

## 回滾方案

如果修復造成問題，可快速回滾：

### 方法 1：Git 回滾
```bash
git diff HEAD learning-record-upload.js  # 檢查變更
git checkout HEAD -- public/js/pages/learning-record-upload.js  # 回滾
```

### 方法 2：手動回滾
將第 9719 行改回原始邏輯：
```javascript
var studentName = uploaded.studentName || (student && student.name) || '';
```

---

## 後續建議

### 短期
- [ ] 執行完整測試計劃
- [ ] 確認生產環境是否有相同問題
- [ ] 檢查是否有已錯配的歷史資料需要修正

### 中期
- [ ] 檢查後端 `learning-upload-helper.js` 的 metadata 寫入邏輯
- [ ] 確保 `relativePath` 建構時使用正確的學生名稱
- [ ] 增加上傳時的 `studentName` 驗證

### 長期
- [ ] 考慮在後端增加一致性檢查（檔案路徑 vs metadata）
- [ ] 建立自動化測試，防止類似問題再次發生
- [ ] 定期審查學生名稱匹配邏輯，確保準確性

---

## 相關文件

- **主要修復**：`public/js/pages/learning-record-upload.js` 第 9719 行
- **規範記錄**：`AGENTS.md` 第 134-140 行
- **後端邏輯**：`learning-upload-helper.js` 第 1252 行
- **測試報告**：待補充

---

## 結論

**修復狀態**：✅ 已完成  
**風險等級**：🟢 低（僅調整優先順序，不改變邏輯）  
**測試狀態**：⏳ 待測試  
**部署建議**：測試通過後可立即部署

此修復確保照片回填時，始終使用當前卡片對應的學生名稱來建構 URL，避免因 metadata 錯誤導致的照片錯配問題。
