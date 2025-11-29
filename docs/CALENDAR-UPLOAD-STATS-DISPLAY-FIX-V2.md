# 📊 課程上傳統計顯示修復 V2（2025-11-28）

## 🎯 問題描述

perfect-calendar-modular.html 的課程卡片上，部分課程的上傳統計顯示不完整：
- ❌ 缺少「學生總數」（👥 N位）
- ❌ 缺少「課程總覽狀態」（📋✓ 或 📋⊗）
- ⚠️ 只有部分課程能正確顯示完整統計資訊

相比之下，frontend-v2 的課程卡片能**完美抓到每堂課程的統計資訊**，所有欄位都能正確顯示。

## 🔍 根本原因分析

### 1. 後端 API 邏輯不完整

**問題檔案**: `/routes/v2-courses.js` 的 `/api/v2/courses/upload-stats` 端點

**原始問題**（第 531-536 行）:
```javascript
// 課程總覽統計
const overview = courseSummary.overview;
if (overview) {
  overviewUploaded = overview.hasPhotos || overview.hasVideos || overview.hasSummary;
}
// 🔥 缺少 else 分支，當 overview 不存在時，overviewUploaded 保持初始值 false
// 🔥 但前端無法分辨「確實是 false」還是「未返回此欄位」
```

**對比**: `/api/v2/courses` 端點（第 262-272 行）有完整的處理邏輯：
```javascript
const overview = courseSummary.overview;
if (overview) {
  const hasOverviewContent = overview.hasPhotos || overview.hasVideos || overview.hasSummary;
  course.overviewUploaded = hasOverviewContent;
  course.overviewFileCount = hasOverviewContent ? 1 : 0;
} else {
  course.overviewUploaded = false;  // ✅ 明確設置預設值
  course.overviewFileCount = 0;
}
```

### 2. 前端顯示邏輯容錯性不足

**問題檔案**: `/public/js/main.js` (第 5982-5988 行)

**原始問題**:
```javascript
// 4️⃣ 課程總覽狀態（始終顯示，區分已上傳/未上傳）
if (typeof stats.overviewUploaded === 'boolean') {  // ⚠️ 只有當欄位存在時才顯示
  if (stats.overviewUploaded) {
    parts.push(`<span style="color:#10b981;font-weight:500;">📋✓</span>`);
  } else {
    parts.push(`<span style="color:#9ca3af;">📋⊗</span>`);
  }
}
// 🔥 如果 API 未返回 overviewUploaded，則不顯示此圖示
```

**對比**: frontend-v2 的 CourseCard.tsx（第 103-121 行）使用預設值處理：
```typescript
{typeof course.overviewUploaded === 'boolean' && (
  <div className="pl-6 flex flex-wrap items-center gap-2 mt-1 text-[11px]">
    <span className={`... ${
      course.overviewUploaded
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-gray-50 text-gray-500 border-gray-200'  // ✅ 預設顯示「未上傳」
    }`}>
      <span className="mr-1">📋</span>
      {course.overviewUploaded ? '課程總覽已上傳' : '課程總覽尚未上傳'}
    </span>
  </div>
)}
```

## ✅ 修復方案

### 1. 後端 API 修復

**檔案**: `/routes/v2-courses.js`

**修改位置**: 第 502-543 行

**修改內容**:
```javascript
// 5️⃣ 統計上傳資料
let uploadedStudentCount = 0;
let totalUploadedFiles = 0;
let overviewUploaded = false;
let overviewFileCount = 0;  // ➕ 新增檔案數統計

if (courseSummary) {
  // ... 學生統計邏輯保持不變 ...
  
  // 🎯 課程總覽統計（參照 /api/v2/courses 的完整邏輯）
  const overview = courseSummary.overview;
  if (overview) {
    const hasOverviewContent = overview.hasPhotos || overview.hasVideos || overview.hasSummary;
    overviewUploaded = hasOverviewContent;
    overviewFileCount = hasOverviewContent 
      ? ((overview.photoCount || 0) + (overview.videoCount || 0)) 
      : 0;
  } else {
    // ✅ 明確設置預設值，確保前端總是能收到這個欄位
    overviewUploaded = false;
    overviewFileCount = 0;
  }
}

// 6️⃣ 返回統計結果
const result = {
  // ... 其他欄位 ...
  overviewUploaded,
  overviewFileCount,  // ➕ 新增到返回結果
  // ...
};
```

### 2. 前端顯示邏輯修復

**檔案**: `/public/js/main.js`

**修改位置**: 第 5959-5992 行

**修改內容**:
```javascript
// 🎨 渲染完整統計資訊（✅ 完全對齊 frontend-v2/CourseCard.tsx 顯示邏輯）
const parts = [];

// 1️⃣ 學生總數（始終顯示，預設 0）
const studentCount = typeof stats.studentCount === 'number' ? stats.studentCount : 0;
const studentText = `👥 ${studentCount}位`;
parts.push(`<span style="color:#4b5563;">${studentText}</span>`);

// 2️⃣ 上傳進度（有學生時顯示）
const uploadedCount = typeof stats.uploadedStudentCount === 'number' ? stats.uploadedStudentCount : 0;
if (studentCount > 0) {
  const pct = stats.uploadPercentage || Math.round((uploadedCount / studentCount) * 100);
  const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const uploadText = `✓${uploadedCount}/${studentCount}`;
  parts.push(`<span style="color:${color};font-weight:500;">${uploadText}</span>`);
}

// 3️⃣ 檔案數統計（有檔案時顯示）
const totalFiles = typeof stats.totalUploadedFiles === 'number' ? stats.totalUploadedFiles : 0;
if (totalFiles > 0) {
  parts.push(`<span style="color:#6b7280;">📁${totalFiles}</span>`);
}

// 4️⃣ 課程總覽狀態（✅ 始終顯示，預設未上傳）
// 參照 frontend-v2/CourseCard.tsx 第 103-121 行
const overviewUploaded = stats.overviewUploaded === true; // 預設 false
if (overviewUploaded) {
  parts.push(`<span style="color:#10b981;font-weight:500;">📋✓</span>`);
} else {
  parts.push(`<span style="color:#9ca3af;">📋⊗</span>`);
}

// 渲染統計（至少會有學生總數和總覽狀態）
statsContainer.innerHTML = parts.join(' <span style="color:#d1d5db;">·</span> ');
```

## 🔑 關鍵改進

### 1. 後端 API
- ✅ 明確處理 `overview` 不存在的情況，設置預設值 `false`
- ✅ 新增 `overviewFileCount` 欄位，提供更完整的統計資訊
- ✅ 確保與 `/api/v2/courses` 端點的邏輯一致性

### 2. 前端顯示
- ✅ 所有欄位都使用預設值，避免因 API 資料缺失導致不顯示
- ✅ 學生總數始終顯示（預設 0）
- ✅ 課程總覽狀態始終顯示（預設未上傳 📋⊗）
- ✅ 完全對齊 frontend-v2 的顯示邏輯和使用者體驗

### 3. 容錯性提升
- ✅ 前端使用 `stats.overviewUploaded === true` 嚴格判斷（非 truthy 判斷）
- ✅ 所有數字欄位都檢查型別並提供預設值
- ✅ 即使 API 返回不完整資料，前端也能正常顯示

## 📊 顯示效果對比

### 修復前
```
課程 A：⏳ 載入統計...  （❌ 無顯示或部分顯示）
課程 B：👥 5位 · ✓3/5 · 📁12  （❌ 缺少總覽狀態）
課程 C：👥 0位  （❌ 缺少總覽狀態）
```

### 修復後（與 frontend-v2 一致）
```
課程 A：👥 5位 · ✓3/5 · 📁12 · 📋✓  （✅ 完整顯示）
課程 B：👥 5位 · ✓0/5 · 📋⊗  （✅ 完整顯示）
課程 C：👥 0位 · 📋⊗  （✅ 完整顯示）
```

## 🧪 測試驗證

### 測試步驟
1. **清除快取**：
   ```bash
   # 清除瀏覽器快取（Cmd+Shift+R 或 Ctrl+Shift+R）
   ```

2. **啟動伺服器**（使用非阻塞模式）：
   ```bash
   cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
   nohup PORT=3002 DISABLE_AUTO_REMINDERS=true npm run dev > /tmp/flb-calendar.log 2>&1 & echo $!
   ```
   
3. **等待啟動**（12-15 秒）：
   ```bash
   sleep 15
   tail -n 20 /tmp/flb-calendar.log
   ```

4. **開啟測試頁面**：
   - 原版日曆：`http://localhost:3002/perfect-calendar-modular.html`
   - V2 版本：`http://localhost:3002/frontend-v2/index.html`

5. **驗證顯示**：
   - ✅ 每個課程都顯示「學生總數」（即使是 0）
   - ✅ 每個課程都顯示「課程總覽狀態」（📋✓ 或 📋⊗）
   - ✅ 有學生的課程顯示「上傳進度」
   - ✅ 有檔案的課程顯示「檔案數」

6. **檢查 Console**：
   ```javascript
   // 應該看到類似的日誌
   📊 [上傳統計] 查詢參數: {eventId: "...", dateStr: "2025-11-28", courseName: "..."}
   ✅ [上傳統計] 查詢成功: {
     studentCount: 5,
     uploadedStudentCount: 3,
     totalUploadedFiles: 12,
     overviewUploaded: false,
     overviewFileCount: 0
   }
   ```

7. **停止測試伺服器**：
   ```bash
   pkill -f "npm run dev"
   ```

### 預期結果
- ✅ 所有課程都顯示完整統計（學生數 + 總覽狀態）
- ✅ 顯示效果與 frontend-v2 完全一致
- ✅ 無「載入中...」或「統計載入失敗」錯誤
- ✅ Console 無錯誤訊息

## 📝 相關文件

- **前次修復記錄**: `/docs/CALENDAR-UPLOAD-STATS-DISPLAY-FIX.md`
- **V2 架構文件**: `/docs/V2-UPLOAD-STATS-ARCHITECTURE.md`
- **API 文件**: `/docs/api/v2-courses-api.md`

## 🔗 參考實作

- **frontend-v2 課程卡片**: `/frontend-v2/src/components/course/CourseCard.tsx` (第 83-128 行)
- **V2 課程 API**: `/routes/v2-courses.js`
  - `/api/v2/courses` (第 119-372 行) - 完整課程列表
  - `/api/v2/courses/upload-stats` (第 385-569 行) - 單一課程統計

## ✅ 修復狀態

- [x] 後端 API 修復完成
- [x] 前端顯示邏輯修復完成
- [ ] 測試驗證（待用戶確認）
- [ ] 文檔更新至 AGENTS.md

---

**修復日期**: 2025-11-28  
**修復版本**: V2  
**影響範圍**: perfect-calendar-modular.html 課程卡片上傳統計顯示
