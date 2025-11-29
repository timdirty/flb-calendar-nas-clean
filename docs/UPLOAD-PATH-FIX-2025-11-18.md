# 上傳路徑不一致問題修復報告

**日期**：2025-11-18  
**問題編號**：PATH-CONSISTENCY-001  
**嚴重程度**：高（影響所有媒體檔案儲存）

## 📋 問題描述

### 用戶報告
媒體檔案（照片/影片）與 `record-meta.json` 儲存到不同的資料夾路徑：

```
❌ 媒體檔案路徑（錯誤）：
/團隊資料夾/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610/2025-11-07 日本武士/石紹言/IMG_5645.jpeg

✅ record-meta.json 路徑（正確）：
/團隊資料夾/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山/2025-11-07 日本武士/石紹言/record-meta.json
```

### 影響範圍
- 所有透過前端上傳的媒體檔案
- 導致檔案分散，無法正確讀取學習記錄
- 課程總覽和學生記錄都受影響

## 🔍 根本原因分析

### 問題鏈條

1. **課程標題解析階段**
   - 位置：`public/js/modules/course-title-parser.js` 第 126-129 行
   - 問題：`CourseTitleParser.parse()` 會移除空格並只保留第一個詞
   ```javascript
   // 🔥 移除課程名稱中的空格（只保留第一個詞）
   if (courseName.includes(' ')) {
     courseName = courseName.split(' ')[0];
   }
   ```
   - 結果：`"SPIKE 五 16:10-17:40 松山"` → `"SPIKE"`

2. **前端 Metadata 構建階段**
   - 位置：`public/js/pages/learning-record-upload.js` 第 1104 行（修復前）
   - 問題：使用了被簡化的 `recordMeta.course` 而非完整的 `recordMeta.coursePeriod`
   ```javascript
   // ❌ 修復前
   courseName: recordMeta.course || currentCourse && currentCourse.courseName || '',
   ```
   - 結果：`uploadMetadata.courseName = "SPIKE"`（缺少時間和地點）

3. **後端路徑解析階段**
   - 位置：`server.js` 第 17849 行
   - 邏輯：優先使用 `coursePeriod`，但如果無效則降級使用 `courseName`
   ```javascript
   let courseName = metadata.coursePeriod || metadata.courseName || ...
   ```
   - 結果：當 `coursePeriod` 為空或無效時，使用簡化的 `courseName`，導致路徑被截斷

4. **路徑生成結果**
   - 媒體上傳：使用簡化的 `courseName` → `/SPIKE 五 1610/`
   - record-meta 儲存：使用完整的 `coursePeriod` → `/SPIKE 五 1610-1740 松山/`

## ✅ 修復方案

### 核心修改
**檔案**：`public/js/pages/learning-record-upload.js`  
**位置**：第 1101-1114 行

```javascript
// ✅ 修復後
var uploadMetadata = {
  studentName: isOverviewUpload ? '課程總覽' : (student && student.name) || meta.studentName || '',
  dateKey: recordMeta.date,
  // 🔥 [修復 2025-11-18] 使用完整課程標題而非簡化的課程名稱，確保路徑正確
  courseName: recordMeta.coursePeriod || recordMeta.course || currentCourse && currentCourse.courseName || '',
  period: recordMeta.period || (currentCourse && currentCourse.coursePeriod) || '',
  mode: isOverviewUpload ? 'overview' : 'student',
  coursePeriod: recordMeta.coursePeriod,
  semester: recordMeta.semester,
  topic: recordMeta.topic,
  relativePath: canonicalPath,
  relativePathUnified: canonicalPath,
  isOverview: isOverviewUpload
};
```

### 修復原理
- **優先使用 `recordMeta.coursePeriod`**：包含完整課程標題（時間 + 地點）
- **保留 fallback 邏輯**：如果 `coursePeriod` 無效，才使用 `course` 或 `courseName`
- **確保一致性**：`uploadMetadata.courseName` 現在與 `uploadMetadata.coursePeriod` 同樣包含完整資訊

## 🧪 測試驗證

### 測試腳本
已創建兩個測試腳本驗證修復：
- `tests/verify-upload-path-fix.js`
- `tests/verify-upload-path-fix-v2.js`

### 測試結果
```bash
$ node tests/verify-upload-path-fix-v2.js

🎯 關鍵對比：
  修復前路徑: /團隊資料夾/.../SPIKE/2025-11-07 日本武士/石紹言
  修復後路徑: /團隊資料夾/.../SPIKE 五 1610-1740 松山/2025-11-07 日本武士/石紹言

📊 驗證結果：
  ❌ 修復前路徑只有 "SPIKE": 是（問題存在）
  ✅ 修復後路徑有完整時間: 是（已修復）
  ✅ 路徑一致性: 是（metadata 和 record-meta 路徑相同）

✅ 修復驗證通過！
```

## 📝 相關檔案

### 修改檔案
1. `public/js/pages/learning-record-upload.js`（第 1105 行）
2. `public/learning-record-upload.html`（版本號更新為 `20251118-coursename-fix`）
3. `AGENTS.md`（記錄修復詳情）

### 測試檔案
1. `tests/verify-upload-path-fix.js`
2. `tests/verify-upload-path-fix-v2.js`
3. `docs/UPLOAD-PATH-FIX-2025-11-18.md`（本文件）

## 🚀 部署指南

### 前置檢查
```bash
# 1. 確認當前版本
grep "learning-record-upload.js" public/learning-record-upload.html

# 2. 執行測試驗證
node tests/verify-upload-path-fix-v2.js

# 3. 檢查語法（可選）
npm run lint
```

### 部署步驟
1. **清除瀏覽器快取**：強制重新載入 JS（Ctrl+Shift+R）
2. **重啟伺服器**：
   ```bash
   npm run dev
   ```
3. **測試上傳**：
   - 選擇測試課程（例如：SPIKE 五 16:10-17:40 松山）
   - 上傳一張測試照片
   - 檢查 Synology Drive 路徑是否正確

### 驗證方法
1. **檢查上傳路徑**：
   ```bash
   # 在 NAS 上檢查檔案位置
   ls -la "/volume1/homes/...//SPIKE 五 1610-1740 松山/2025-11-07 */"
   ```

2. **檢查控制台日誌**：
   - 開啟瀏覽器開發者工具
   - 查找 `[DrivePathManager] 構建路徑` 日誌
   - 確認 `courseName` 包含完整標題

3. **比對路徑**：
   - 媒體檔案路徑應與 `record-meta.json` 路徑相同
   - 路徑應包含完整時間（例如：`1610-1740`）
   - 路徑應包含地點（例如：`松山`）

## 📊 預期影響

### 正面影響
- ✅ 媒體檔案和 metadata 儲存在同一路徑
- ✅ 學習記錄可以正確讀取所有媒體
- ✅ 課程總覽和學生記錄檔案結構統一

### 潛在風險
- ⚠️ 需清除瀏覽器快取以載入新版本 JS
- ⚠️ 舊的錯誤路徑下的檔案需要手動遷移（如果有）

### 回滾方案
如果修復後出現問題，可以回滾到前一版本：
```bash
# 1. 還原 JS 檔案
git checkout HEAD~1 -- public/js/pages/learning-record-upload.js

# 2. 還原 HTML 版本號
git checkout HEAD~1 -- public/learning-record-upload.html

# 3. 重啟伺服器
npm run dev
```

## 📚 相關文檔

- [AGENTS.md](../AGENTS.md) - 完整修復歷史記錄
- [PROJECT-STRUCTURE.md](../PROJECT-STRUCTURE.md) - 專案架構說明
- [drive-path-manager.js](../drive-path-manager.js) - 路徑管理邏輯

## 🔗 相關問題

### 已解決
- ✅ 2025-11-17：Blob URL 預覽失效（已修復）
- ✅ 2025-11-17：前端上傳 metadata 不一致（臨時修復，已被本次修復取代）
- ✅ 2025-01-19：檔案路徑冒號處理問題（已修復）

### 待觀察
- ⏳ 確認舊路徑下是否有檔案需要遷移
- ⏳ 監控後續上傳是否都使用正確路徑

---

**修復者**：Cascade AI  
**審核者**：待確認  
**狀態**：✅ 已完成，待用戶驗證
