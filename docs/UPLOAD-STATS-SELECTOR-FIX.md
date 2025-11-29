# 上傳統計選擇器修復

## 📅 修復日期
2025-11-28

## 🔥 問題發現

控制台大量警告訊息：
```
⚠️ [上傳統計] 參數不完整，跳過請求: {eventId: '...', date: '2025-11-28', courseName: ''}
```

## 🎯 根本原因

**錯誤的 DOM 選擇器**

```javascript
// ❌ 錯誤：使用 .title 選擇器
const courseName = card ? (card.querySelector('.title')?.textContent?.trim() || '') : '';
```

**課程卡片實際 HTML 結構**（`createEventCard` 第 12474-12475 行）：

```html
<div class="event-card">
    <div class="event-header">
        <div>
            <div class="event-title">  ← 正確的 class 是 event-title
                SPIKE 五 16:10-17:40 松山 第2週
            </div>
            ...
        </div>
    </div>
</div>
```

因為 `.title` 選擇器找不到元素，`querySelector` 返回 `null`，導致：
- `courseName` 始終是空字串 `''`
- 前端參數驗證將請求攔截（因為 `!courseName` 為 true）
- 控制台顯示「參數不完整」警告

## ✅ 解決方案

**修改位置**：`public/js/main.js`

### 1. 第一個呼叫點（第 5947 行）

```javascript
// 取得課程名稱（使用 .event-title 選擇器）
const courseName = card ? (card.querySelector('.event-title')?.textContent?.trim() || '') : '';
```

### 2. 第二個呼叫點（第 11916 行）

```javascript
// 取得課程名稱（使用 .event-title 選擇器）
const courseName = card ? (card.querySelector('.event-title')?.textContent?.trim() || '') : '';
```

## 📊 修復前後對比

### 修復前
```
📊 [上傳統計] 查詢參數: {eventId: '20251118T033250-...', dateStr: '2025-11-28', courseName: '', hasCard: true}
⚠️ [上傳統計] 參數不完整，跳過請求: {eventId: '...', date: '2025-11-28', courseName: ''}
```

### 修復後（預期）
```
📊 [上傳統計] 查詢參數: {eventId: '20251118T033250-...', dateStr: '2025-11-28', courseName: 'SPIKE 五 16:10-17:40 松山 第2週', hasCard: true}
✅ [上傳統計] 查詢成功: {studentCount: 5, uploadedStudentCount: 2, ...}
```

## 🧪 測試步驟

1. **清除瀏覽器快取**
   ```
   Cmd+Shift+R (macOS) 或 Ctrl+Shift+R (Windows)
   ```

2. **重新載入頁面**
   ```
   http://localhost:3000/perfect-calendar-modular.html
   ```

3. **檢查 Console 日誌**
   - ✅ 應該看到 `courseName` 不再是空字串
   - ✅ 應該看到 `✅ [上傳統計] 查詢成功` 訊息
   - ❌ 不應該再看到「參數不完整」警告

4. **檢查課程卡片**
   - 已過期的課程應該顯示上傳統計
   - 統計資訊格式：`👥2/5 📁8 ✓總覽`

## 📁 相關檔案

- **修改檔案**：`public/js/main.js`（第 5947、11916 行）
- **HTML 結構**：`public/js/main.js`（第 12474-12475 行）
- **API 端點**：`routes/v2-courses.js`（第 385-528 行）
- **參數驗證**：`routes/v2-courses.js`（第 401-410 行）

## 🔍 技術細節

### DOM 查詢鏈
```
card (event-card)
  └─ .closest('.event-card')  ✅ 找到卡片
      └─ .querySelector('.event-title')  ✅ 找到標題（修復後）
          └─ .textContent.trim()  ✅ 取得文字
```

### 為什麼之前會出錯
1. `.title` 不存在於課程卡片 HTML 中
2. `querySelector('.title')` 返回 `null`
3. `null?.textContent` 返回 `undefined`
4. `undefined || ''` 返回空字串 `''`
5. 前端驗證攔截請求

## ⚠️ 注意事項

1. **不要混淆其他元素**
   - `.event-title` = 課程標題（正確）
   - `.title` = 不存在
   - `.event-instructor` = 講師名稱
   - `.event-detail` = 其他詳細資訊

2. **Badge 干擾**
   - `event-title` 內可能包含 badge（停課、體驗、代課等）
   - `textContent` 會包含所有文字
   - 需要後端 `cleanCourseName` 清理

3. **空值處理**
   - 使用 `?.` 可選鏈防止 null 錯誤
   - 使用 `|| ''` 提供預設空字串
   - 前端驗證確保不發送空值

## 📚 相關文檔

- [400 錯誤修復總結](./UPLOAD-STATS-400-ERROR-FIX.md)
- [路由修復記錄](./UPLOAD-STATS-ROUTE-FIX.md)
- [修復總結](./UPLOAD-STATS-FIX-SUMMARY.md)

---

**修復人員**: AI Assistant  
**修復日期**: 2025-11-28  
**狀態**: ✅ 完成，待瀏覽器驗證
