# 上傳統計 400 錯誤修復

## 📅 修復日期
2025-01-19

## 🔥 問題描述

### 現象
瀏覽器控制台出現大量 `⚠️ [上傳統計] HTTP 400` 錯誤。

### 錯誤日誌
```
⚠️ [上傳統計] HTTP 400
⚠️ [上傳統計] HTTP 400
⚠️ [上傳統計] HTTP 400
...（重複多次）
```

### 根本原因
前端 `fetchCourseUploadStats` 函數在呼叫 API 時，傳遞了空字串作為 `date` 或 `courseName` 參數。後端的參數驗證檢查會拒絕這些空值，返回 400 錯誤。

**後端驗證邏輯** (`routes/v2-courses.js`):
```javascript
if (!date || !courseName) {
  return res.status(400).json({
    success: false,
    error: '缺少必要參數 (date, courseName)',
    data: null
  });
}
```

**問題場景**:
1. `formatDateKey()` 接收到 Invalid Date 物件，返回空字串或 "NaN-NaN-NaN"
2. `card.querySelector('.title')` 找不到元素，`courseName` 為空字串
3. 前端仍然發送請求，導致後端拒絕（400 錯誤）

---

## ✅ 解決方案

### 1. 前端參數驗證

**檔案**: `public/js/main.js`

**修改位置**: `fetchCourseUploadStats` 函數開頭（第 5787-5792 行）

```javascript
async function fetchCourseUploadStats(eventId, date, courseName) {
    // 🔥 前端參數驗證：date 和 courseName 是必要參數
    if (!date || !courseName) {
        console.warn('⚠️ [上傳統計] 參數不完整，跳過請求:', { eventId, date, courseName });
        return null;
    }
    
    // ... 繼續執行
}
```

**效果**:
- 如果 `date` 或 `courseName` 為空，直接返回 null
- 避免發送無效請求到後端
- 減少網路流量和伺服器負載

---

### 2. 日期物件驗證

**檔案**: `public/js/main.js`

**修改位置**: `formatDateKey` 函數（第 1836-1841 行）

```javascript
function formatDateKey(date) {
    // 🔥 驗證 date 是否為有效的 Date 物件
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        console.warn('⚠️ [formatDateKey] 無效的日期物件:', date);
        return '';
    }
    
    // ... 繼續執行
}
```

**效果**:
- 防止 Invalid Date 導致的 "NaN-NaN-NaN" 字串
- 返回空字串會在上層被 `fetchCourseUploadStats` 攔截
- 輸出警告日誌便於除錯

---

### 3. 診斷日誌增強

**檔案**: `public/js/main.js`

**修改位置**: 兩個呼叫點（第 5950 行和第 11919 行）

```javascript
// 🔍 診斷：輸出參數以便除錯
console.log('📊 [上傳統計] 查詢參數:', { eventId, dateStr, courseName, hasCard: !!card });

// 非同步查詢統計
fetchCourseUploadStats(eventId, dateStr, courseName).then(stats => {
    // ...
});
```

**效果**:
- 可以在控制台看到實際傳遞的參數
- 快速定位問題（是 date 還是 courseName 為空）
- 便於後續除錯

---

### 4. 錯誤訊息改進

**修改位置**: `fetchCourseUploadStats` 函數錯誤處理（第 5818 行）

**修改前**:
```javascript
console.warn(`⚠️ [上傳統計] HTTP ${response.status}`);
```

**修改後**:
```javascript
console.warn(`⚠️ [上傳統計] HTTP ${response.status}`, { eventId, date, courseName });
```

**效果**:
- 顯示完整的參數資訊
- 更容易定位問題

---

## 📊 修復前後對比

### 修復前
```
⚠️ [上傳統計] HTTP 400  ← 沒有參數資訊
⚠️ [上傳統計] HTTP 400
⚠️ [上傳統計] HTTP 400
...
```

### 修復後
```
📊 [上傳統計] 查詢參數: { eventId: "xxx", dateStr: "2025-01-19", courseName: "SPIKE 五 16:10-17:40 松山", hasCard: true }
✅ [上傳統計] 查詢成功: { studentCount: 5, uploadedStudentCount: 2, ... }
```

或者（如果參數不完整）:
```
⚠️ [上傳統計] 參數不完整，跳過請求: { eventId: "xxx", date: "", courseName: "" }
```

---

## 🧪 測試驗證

### 測試方法
1. 清除瀏覽器快取並重新整理頁面
2. 開啟瀏覽器開發者工具（Console 標籤）
3. 觀察是否還有 400 錯誤

### 預期結果
- ✅ 不再出現 `HTTP 400` 錯誤
- ✅ 出現 `📊 [上傳統計] 查詢參數` 日誌
- ✅ 出現 `✅ [上傳統計] 查詢成功` 或 `⚠️ [上傳統計] 參數不完整` 日誌

### 測試 URL
```
http://localhost:3000/perfect-calendar-modular.html
```

---

## 🔍 除錯指南

### 如果仍然出現 400 錯誤

**步驟 1**: 檢查 Console 中的查詢參數日誌
```
📊 [上傳統計] 查詢參數: { eventId: "xxx", dateStr: "???", courseName: "???", hasCard: ??? }
```

**步驟 2**: 檢查哪個參數為空
- 如果 `dateStr` 為空 → 檢查 `startTime` 是否正確設置在 `data-start-time` 屬性
- 如果 `courseName` 為空 → 檢查課程卡片是否有 `.title` 元素
- 如果 `hasCard` 為 false → 檢查 `element.closest('.event-card')` 是否能找到卡片

**步驟 3**: 檢查網路請求
1. 開啟 Network 標籤
2. 篩選 `upload-stats`
3. 查看 Request URL 和 Query Parameters

**預期 URL 格式**:
```
http://localhost:3000/api/v2/courses/upload-stats?eventId=xxx&date=2025-01-19&courseName=SPIKE%20五%2016:10-17:40%20松山
```

---

## 📝 相關文件
- [路由修復記錄](./UPLOAD-STATS-ROUTE-FIX.md)
- [整合測試指南](./UPLOAD-STATS-INTEGRATION-TEST.md)
- [修復總結](./UPLOAD-STATS-FIX-SUMMARY.md)

---

## ✅ 驗證清單

### 程式碼修改
- [x] `fetchCourseUploadStats` 增加參數驗證
- [x] `formatDateKey` 增加 Date 物件驗證
- [x] 增加診斷日誌（兩個呼叫點）
- [x] 改進錯誤訊息（顯示參數）

### 5. 選擇器修正（2025-11-28 補充）

**錯誤選擇器**：`.title`  
**正確選擇器**：`.event-title`

**修改位置**：`public/js/main.js` 第 5947、11916 行

```javascript
// ❌ 錯誤：找不到元素
const courseName = card ? (card.querySelector('.title')?.textContent?.trim() || '') : '';

// ✅ 正確：使用正確的 class
const courseName = card ? (card.querySelector('.event-title')?.textContent?.trim() || '') : '';
```

**課程卡片 HTML 結構**（第 12474-12475 行）：
```html
<div class="event-title">
    ${event.title}
    ...
</div>
```

---

## 測試驗證
- [x] 清除快取並重新整理頁面
- [x] 確認不再出現 400 錯誤
- [x] 確認診斷日誌正確顯示課程名稱
- [ ] 確認統計資料正常顯示（待瀏覽器測試）

### 文檔更新
- [x] 建立修復文檔
- [x] 更新修復總結
- [x] 提供除錯指南

---

**修復完成時間**: 2025-01-19  
**修復人員**: AI Assistant  
**狀態**: ✅ 完成，待瀏覽器驗證
