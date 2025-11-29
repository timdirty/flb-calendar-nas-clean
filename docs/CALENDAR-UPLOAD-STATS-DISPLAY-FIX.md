# 📊 行事曆上傳統計顯示修復

**修復日期**: 2025-11-28  
**問題**: 課程卡片上的上傳統計顯示不完整，無法看到學生總數和課程總覽狀態  
**影響檔案**: `public/js/main.js`

---

## 🔥 問題描述

### 原始問題
雖然 API 端點 `/api/v2/courses/upload-stats` 正確返回完整資料：
```json
{
  "studentCount": 2,
  "uploadedStudentCount": 0,
  "totalUploadedFiles": 0,
  "overviewUploaded": false
}
```

但前端**只在有上傳記錄時才顯示統計**，導致：
- ❌ 沒有上傳時顯示「尚無上傳」，無法看到學生總數
- ❌ 課程總覽狀態（未上傳）不顯示
- ❌ 無法快速了解課程是否需要上傳學習歷程

### 預期行為（參考 frontend-v2）
應該像 `frontend-v2/src/components/course/CourseCard.tsx` 一樣顯示：
1. **始終顯示** 學生總數（👥 N位）
2. **始終顯示** 上傳進度（✓X/Y）
3. **有檔案時** 顯示檔案數（📁N）
4. **始終顯示** 課程總覽狀態（📋✓ 或 📋⊗）

---

## ✅ 修復內容

### 修改位置
`public/js/main.js` 兩處渲染邏輯：
- **第 5953-6000 行**：主要渲染邏輯
- **第 11933-11980 行**：批次渲染邏輯

### 修復前邏輯
```javascript
// ❌ 舊邏輯：只在有上傳時才顯示
const parts = [];

if (typeof stats.uploadedStudentCount === 'number' && stats.studentCount > 0) {
    parts.push(`👥${stats.uploadedStudentCount}/${stats.studentCount}`);
}

if (stats.overviewUploaded) {
    parts.push(`📋✓`);
}

// 如果 parts 為空，顯示「尚無上傳」
if (parts.length > 0) {
    statsContainer.innerHTML = parts.join(' · ');
} else {
    statsContainer.innerHTML = `尚無上傳`;
}
```

### 修復後邏輯
```javascript
// ✅ 新邏輯：始終顯示完整資訊
const parts = [];

// 1️⃣ 學生總數（始終顯示）
if (typeof stats.studentCount === 'number') {
    const studentText = `👥 ${stats.studentCount}位`;
    parts.push(`<span style="color:#4b5563;">${studentText}</span>`);
}

// 2️⃣ 上傳進度（有學生時顯示，顏色根據百分比）
if (typeof stats.uploadedStudentCount === 'number' && stats.studentCount > 0) {
    const pct = stats.uploadPercentage || 0;
    const color = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
    const uploadText = `✓${stats.uploadedStudentCount}/${stats.studentCount}`;
    parts.push(`<span style="color:${color};font-weight:500;">${uploadText}</span>`);
}

// 3️⃣ 檔案數統計（有檔案時顯示）
if (stats.totalUploadedFiles > 0) {
    parts.push(`<span style="color:#6b7280;">📁${stats.totalUploadedFiles}</span>`);
}

// 4️⃣ 課程總覽狀態（始終顯示，區分已上傳/未上傳）
if (typeof stats.overviewUploaded === 'boolean') {
    if (stats.overviewUploaded) {
        parts.push(`<span style="color:#10b981;font-weight:500;">📋✓</span>`);
    } else {
        parts.push(`<span style="color:#9ca3af;">📋⊗</span>`);
    }
}

// 渲染統計（至少會有學生總數）
if (parts.length > 0) {
    statsContainer.innerHTML = parts.join(' <span style="color:#d1d5db;">·</span> ');
} else {
    statsContainer.innerHTML = `<span style="color:#9ca3af;font-size:10px;">載入中...</span>`;
}
```

---

## 🎨 顯示效果對比

### 修復前
| 情境 | 舊版顯示 | 問題 |
|------|---------|------|
| 有學生，無上傳 | `尚無上傳` | ❌ 看不到學生總數 |
| 有學生，部分上傳 | `👥2/5` | ❌ 看不到總覽狀態 |
| 有學生，全部上傳 | `👥5/5 · 📁12` | ❌ 看不到總覽狀態 |

### 修復後
| 情境 | 新版顯示 | 效果 |
|------|---------|------|
| 有學生，無上傳 | `👥 5位 · ✓0/5 · 📋⊗` | ✅ 完整資訊 |
| 有學生，部分上傳 | `👥 5位 · ✓2/5 · 📁8 · 📋⊗` | ✅ 完整資訊 |
| 有學生，全部上傳 | `👥 5位 · ✓5/5 · 📁12 · 📋✓` | ✅ 完整資訊 |
| 有總覽，無學生上傳 | `👥 5位 · ✓0/5 · 📋✓` | ✅ 清楚顯示總覽已完成 |

---

## 🎯 圖示說明

| 圖示 | 意義 | 顏色邏輯 |
|------|------|----------|
| 👥 N位 | 學生總數 | 灰色 (#4b5563) |
| ✓X/Y | 已上傳/總學生數 | 紅色 (<50%) → 橙色 (50-79%) → 綠色 (≥80%) |
| 📁N | 上傳檔案總數 | 灰色 (#6b7280) |
| 📋✓ | 課程總覽已上傳 | 綠色 (#10b981) |
| 📋⊗ | 課程總覽未上傳 | 淺灰色 (#9ca3af) |

---

## 🧪 測試驗證

### 1. 瀏覽器 Console 測試
```javascript
// 測試統計查詢
fetchCourseUploadStats(
  '20251118T033250-lbszlgtb@cal.synology.com',
  '2025-11-28',
  'SPIKE 五 16:10-17:40 松山'
).then(stats => {
  console.log('📊 統計結果:', stats);
  console.log('👥 學生數:', stats?.studentCount);
  console.log('✓ 已上傳:', stats?.uploadedStudentCount);
  console.log('📋 總覽:', stats?.overviewUploaded);
});
```

### 2. 視覺檢查清單
- [ ] 每個課程卡片都顯示學生總數
- [ ] 上傳進度顏色正確（紅/橙/綠）
- [ ] 課程總覽狀態始終顯示（✓ 或 ⊗）
- [ ] 沒有上傳時不顯示「尚無上傳」
- [ ] 統計資料排列整齊，用「·」分隔

### 3. 預期日誌
```
📊 [上傳統計] 查詢參數: {eventId: "...", dateStr: "2025-11-28", courseName: "SPIKE 五 16:10-17:40 松山"}
✅ [上傳統計] 查詢成功: {studentCount: 2, uploadedStudentCount: 0, ...}
```

---

## 📝 相關文件

- **API 文檔**: `docs/CALENDAR-UPLOAD-STATS-CHANGELOG.md`
- **後端修復**: `docs/UPLOAD-STATS-FIX-SUMMARY.md`
- **V2 架構**: `docs/V2-UPLOAD-STATS-ARCHITECTURE.md`
- **測試腳本**: `tests/test-upload-stats-api.js`

---

## ✅ 狀態

- [x] 後端 API 正常運作（返回完整統計資料）
- [x] 前端渲染邏輯已修復（兩處）
- [ ] 需要清除瀏覽器快取並重新載入驗證
- [ ] 需要在實際課程卡片上測試顯示效果

---

## 🚀 下一步

1. **清除快取**：`Ctrl/Cmd + Shift + R` 強制重新載入
2. **檢查顯示**：確認所有課程卡片都正確顯示統計
3. **測試互動**：點擊「上傳學習歷程」按鈕，檢查功能正常
4. **提交變更**：
   ```bash
   git add public/js/main.js docs/CALENDAR-UPLOAD-STATS-DISPLAY-FIX.md
   git commit -m "fix: 修復課程上傳統計顯示邏輯，始終顯示學生數和總覽狀態"
   ```
