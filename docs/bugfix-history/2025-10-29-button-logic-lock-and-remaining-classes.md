# 🔒 學生簽到按鈕邏輯鎖 + 剩餘堂數正確計算

**日期**: 2025-10-29  
**版本**: v2.1-button-logic  
**類型**: Bug Fix + Enhancement

---

## 📋 問題描述

### 問題 1: 按鈕邏輯鎖未正確實現
- 點擊「簽到」後，簽到按鈕沒有被禁用（應該變灰且無法再點擊）
- 點擊「缺席」後，缺席按鈕沒有被禁用（應該變灰且無法再點擊）
- 初次顯示學生簽到頁面時，沒有根據學生狀態設置按鈕的初始狀態

### 問題 2: 剩餘堂數計算錯誤
- 點擊「缺席」按鈕時會扣除一堂（不正確，缺席不應該扣堂數）
- 從「已簽到」改為「缺席」時，沒有加回之前扣除的一堂

---

## ✅ 修復方案

### 1. 按鈕初始狀態邏輯鎖

#### 修改位置 1: 主學生列表渲染（行 15976-16047）

**修改前**:
```javascript
<button class="attendance-btn present-btn liquid-button" 
    data-student-id="${studentId}" 
    style="
        opacity: 1;
        cursor: pointer;
        pointer-events: auto;
    ">
```

**修改後**:
```javascript
<button class="attendance-btn present-btn liquid-button" 
    data-student-id="${studentId}"
    ${currentStatus === 'present' ? 'disabled' : ''}
    style="
        opacity: ${currentStatus === 'present' ? '0.6' : '1'};
        cursor: ${currentStatus === 'present' ? 'not-allowed' : 'pointer'};
        pointer-events: ${currentStatus === 'present' ? 'none' : 'auto'};
    ">
```

同樣修改缺席按鈕的邏輯。

#### 修改位置 2: 簡化學生列表（行 10712-10824）

在 `recreateStudentAttendanceContent` 函數中的學生列表生成邏輯：

1. **新增狀態檢查**:
```javascript
// 🔥 檢查學生當前出席狀態
let currentStatus = null;
if (student.attendance && Array.isArray(student.attendance)) {
    const today = formatDateKey(new Date());
    const todayAttendance = student.attendance.find(record => record.date === today);
    if (todayAttendance) {
        if (todayAttendance.present === true) {
            currentStatus = 'present';
        } else if (todayAttendance.present === false) {
            currentStatus = 'absent';
        } else if (todayAttendance.present === 'leave') {
            currentStatus = 'leave';
        }
    }
}
```

2. **根據狀態設置按鈕**:
```javascript
<button class="attendance-btn present-btn liquid-button" 
    data-student-id="${studentId}"
    ${currentStatus === 'present' ? 'disabled' : ''}
    style="
        cursor: ${currentStatus === 'present' ? 'not-allowed' : 'pointer'};
        opacity: ${currentStatus === 'present' ? '0.6' : '1'};
        pointer-events: ${currentStatus === 'present' ? 'none' : 'auto'};
    ">
```

### 2. 按鈕點擊後的狀態更新

#### 修改位置 3: updateStudentStatus 函數（行 18371-18507）

**修改前**:
```javascript
// 🔥 先啟用所有按鈕（預設狀態）
if (presentBtn) {
    presentBtn.disabled = false;
    presentBtn.style.opacity = '1';
    presentBtn.style.cursor = 'pointer';
}
```

**修改後**:
```javascript
// 🔥 先啟用所有按鈕（預設狀態）
if (presentBtn) {
    presentBtn.disabled = false;
    presentBtn.style.opacity = '1';
    presentBtn.style.cursor = 'pointer';
    presentBtn.style.pointerEvents = 'auto';  // ← 新增
}
```

**邏輯鎖實現**:
```javascript
// 🔥 邏輯鎖：根據當前狀態禁用相應按鈕
if (status === 'present') {
    // 已簽到，禁用簽到按鈕
    if (presentBtn) {
        presentBtn.disabled = true;
        presentBtn.style.opacity = '0.6';
        presentBtn.style.cursor = 'not-allowed';
        presentBtn.style.pointerEvents = 'none';  // ← 新增
    }
    // 啟用缺席按鈕（允許改為缺席）
    if (absentBtn) {
        absentBtn.disabled = false;
        absentBtn.style.opacity = '1';
        absentBtn.style.cursor = 'pointer';
        absentBtn.style.pointerEvents = 'auto';  // ← 新增
    }
} else if (status === 'absent') {
    // 已缺席，禁用缺席按鈕
    if (absentBtn) {
        absentBtn.disabled = true;
        absentBtn.style.opacity = '0.6';
        absentBtn.style.cursor = 'not-allowed';
        absentBtn.style.pointerEvents = 'none';  // ← 新增
    }
    // 啟用簽到按鈕（允許改為簽到）
    if (presentBtn) {
        presentBtn.disabled = false;
        presentBtn.style.opacity = '1';
        presentBtn.style.cursor = 'pointer';
        presentBtn.style.pointerEvents = 'auto';  // ← 新增
    }
}
```

### 3. 剩餘堂數計算修正

#### 修改位置 4: 簽到按鈕點擊（行 16297-16336）

**修改前**:
```javascript
// 簽到時，剩餘堂數減1
newRemaining = Math.max(0, studentData.remaining - 1);
```

**修改後**:
```javascript
// 🔥 簽到邏輯：檢查之前的狀態
const today = formatDateKey(new Date());
let previousStatus = null;

// 檢查學生之前的出席狀態
if (studentData.attendance && Array.isArray(studentData.attendance)) {
    const todayAttendance = studentData.attendance.find(record => record.date === today);
    if (todayAttendance) {
        if (todayAttendance.present === true) {
            previousStatus = 'present';
        } else if (todayAttendance.present === false) {
            previousStatus = 'absent';
        }
    }
}

// 根據之前的狀態計算新的剩餘堂數
if (previousStatus === 'present') {
    // 之前已經是簽到狀態，維持不變（避免重複扣除）
    newRemaining = studentData.remaining;
    console.log(`📚 重複簽到，維持不變: ${studentData.remaining}`);
} else if (previousStatus === 'absent') {
    // 之前是缺席，改成簽到時扣一堂
    newRemaining = Math.max(0, studentData.remaining - 1);
    console.log(`📚 從缺席改為簽到，扣除一堂: ${studentData.remaining} -> ${newRemaining}`);
} else {
    // 之前未簽到，正常扣一堂
    newRemaining = Math.max(0, studentData.remaining - 1);
    console.log(`📚 首次簽到，扣除一堂: ${studentData.remaining} -> ${newRemaining}`);
}
```

#### 修改位置 5: 缺席按鈕點擊（行 16406-16441）

**修改前**:
```javascript
// 缺席時，剩餘堂數也減1（因為課程已進行）
newRemaining = Math.max(0, studentData.remaining - 1);
```

**修改後**:
```javascript
// 🔥 缺席邏輯：檢查之前的狀態
const today = formatDateKey(new Date());
let previousStatus = null;

// 檢查學生之前的出席狀態
if (studentData.attendance && Array.isArray(studentData.attendance)) {
    const todayAttendance = studentData.attendance.find(record => record.date === today);
    if (todayAttendance) {
        if (todayAttendance.present === true) {
            previousStatus = 'present';
        } else if (todayAttendance.present === false) {
            previousStatus = 'absent';
        }
    }
}

// 根據之前的狀態計算新的剩餘堂數
if (previousStatus === 'present') {
    // 之前是已簽到，改成缺席時要加一堂回來（因為簽到時已扣除）
    newRemaining = studentData.remaining + 1;
    console.log(`📚 從簽到改為缺席，加回一堂: ${studentData.remaining} -> ${newRemaining}`);
} else {
    // 之前不是簽到狀態（未簽到或已缺席），維持堂數不變
    newRemaining = studentData.remaining;
    console.log(`📚 缺席不扣堂數，維持不變: ${studentData.remaining}`);
}
```

---

## 📊 修改後的行為邏輯

### 按鈕邏輯鎖

| 當前狀態 | 簽到按鈕 | 缺席按鈕 |
|---------|---------|---------|
| 未簽到   | ✅ 可點擊 (opacity: 1) | ✅ 可點擊 (opacity: 1) |
| 已簽到   | 🔒 禁用 (opacity: 0.6) | ✅ 可點擊 (可改為缺席) |
| 已缺席   | ✅ 可點擊 (可改為簽到) | 🔒 禁用 (opacity: 0.6) |

### 剩餘堂數計算邏輯

| 操作 | 之前狀態 | 堂數變化 | 計算邏輯 |
|-----|---------|---------|---------|
| 點擊簽到 | 未簽到 | -1 | 首次簽到扣一堂 |
| 點擊簽到 | 已簽到 | 不變 | 重複簽到不扣 |
| 點擊簽到 | 已缺席 | -1 | 從缺席改簽到扣一堂 |
| 點擊缺席 | 未簽到 | 不變 | 缺席不扣堂數 |
| 點擊缺席 | 已簽到 | +1 | 加回之前扣除的 |
| 點擊缺席 | 已缺席 | 不變 | 重複缺席不扣 |

---

## 🎯 使用者體驗改善

### 改善前
- ❌ 點擊「簽到」後，按鈕仍可繼續點擊
- ❌ 點擊「缺席」會扣除堂數（使用者感到困惑）
- ❌ 從「已簽到」改為「缺席」後，堂數不正確
- ❌ 初次打開頁面，按鈕狀態與實際狀態不符

### 改善後
- ✅ 點擊「簽到」後，簽到按鈕變灰禁用（視覺回饋清晰）
- ✅ 點擊「缺席」不扣堂數（符合邏輯）
- ✅ 從「已簽到」改為「缺席」會加回一堂（正確）
- ✅ 初次打開頁面，按鈕狀態正確反映學生當前狀態
- ✅ 即時的前端反饋，無需等待後端同步

---

## 🧪 測試場景

### 場景 1: 首次簽到
1. 學生狀態：未簽到，剩餘 10 堂
2. 點擊「出席」按鈕
3. **預期結果**:
   - 簽到按鈕變灰禁用 (opacity: 0.6)
   - 缺席按鈕保持可點擊
   - 剩餘堂數變為 9 堂

### 場景 2: 首次缺席
1. 學生狀態：未簽到，剩餘 10 堂
2. 點擊「缺席」按鈕
3. **預期結果**:
   - 缺席按鈕變灰禁用 (opacity: 0.6)
   - 簽到按鈕保持可點擊
   - 剩餘堂數維持 10 堂（不變）

### 場景 3: 從簽到改為缺席
1. 學生狀態：已簽到，剩餘 9 堂
2. 點擊「缺席」按鈕
3. **預期結果**:
   - 缺席按鈕變灰禁用
   - 簽到按鈕變回可點擊
   - 剩餘堂數變為 10 堂（加回一堂）

### 場景 4: 從缺席改為簽到
1. 學生狀態：已缺席，剩餘 10 堂
2. 點擊「出席」按鈕
3. **預期結果**:
   - 簽到按鈕變灰禁用
   - 缺席按鈕變回可點擊
   - 剩餘堂數變為 9 堂（扣除一堂）

### 場景 5: 重新打開頁面
1. 學生狀態：已簽到，剩餘 9 堂
2. 關閉並重新打開學生簽到頁面
3. **預期結果**:
   - 簽到按鈕初始就是禁用狀態 (opacity: 0.6)
   - 缺席按鈕初始就是可點擊狀態
   - 剩餘堂數顯示 9 堂

---

## 📝 技術細節

### CSS 屬性組合
為了確保按鈕完全禁用，使用了三重保險：

1. **disabled 屬性**: HTML 原生禁用
2. **pointer-events: none**: CSS 層級禁用點擊
3. **cursor: not-allowed**: 視覺提示

### 狀態檢查時機
- **渲染時**: 在生成 HTML 時檢查狀態並設置初始按鈕狀態
- **點擊時**: 在按鈕點擊處理函數中檢查之前的狀態來計算堂數
- **更新時**: 在 `updateStudentStatus` 函數中根據新狀態設置按鈕

---

## 🚀 部署建議

1. **清除快取**: 建議使用者清除瀏覽器快取，確保載入最新的 JS 檔案
2. **版本號更新**: HTML 檔案中的 JS 版本號已更新為 `?v=2025-10-29-button-logic`
3. **測試驗證**: 部署後請測試所有場景，確保邏輯正確

---

## 📚 相關檔案

- `public/js/main.js` (主要修改)
  - 行 10712-10824: 簡化學生列表渲染
  - 行 15976-16047: 主學生列表渲染
  - 行 16197-16472: 按鈕事件監聽器設置
  - 行 18334-18507: 學生狀態更新函數

---

## 🔧 關鍵技術修復

### 問題：檢查按鈕狀態的時機

**原始問題**：
在按鈕點擊處理函數中，開頭就會把當前按鈕設為 `disabled`，導致後續檢查按鈕狀態時無法正確判斷之前的狀態。

例如：
```javascript
// ❌ 錯誤：先設置 disabled，再檢查狀態
this.disabled = true;  // 缺席按鈕被禁用

// 後面檢查時...
if (absentBtn.disabled) {  // 此時會是 true，但這是剛設置的！
    previousStatus = 'absent';
}
```

**解決方案**：
在設置 `disabled` 之前，先檢查並保存兩個按鈕的狀態：

```javascript
// ✅ 正確：先檢查並保存狀態，再設置 disabled
const studentCard = document.querySelector(`.student-card[data-student-id="${studentId}"]`);
let wasPreviouslyPresent = false;
let wasPreviouslyAbsent = false;

if (studentCard) {
    const presentBtn = studentCard.querySelector('.present-btn');
    const absentBtn = studentCard.querySelector('.absent-btn');
    
    // 保存之前的狀態
    if (presentBtn && (presentBtn.disabled || presentBtn.hasAttribute('disabled'))) {
        wasPreviouslyPresent = true;
    }
    if (absentBtn && (absentBtn.disabled || absentBtn.hasAttribute('disabled'))) {
        wasPreviouslyAbsent = true;
    }
}

// 然後才設置當前按鈕為 disabled
this.disabled = true;

// 後續使用保存的狀態來計算堂數
if (wasPreviouslyPresent) {
    // 從簽到改為缺席，加回一堂
    newRemaining = studentData.remaining + 1;
}
```

### 修改位置總結

1. **行 16280-16302**: 簽到按鈕 - 在設置 disabled 前保存狀態
2. **行 16326-16340**: 簽到按鈕 - 使用保存的狀態計算堂數
3. **行 16425-16447**: 缺席按鈕 - 在設置 disabled 前保存狀態
4. **行 16471-16481**: 缺席按鈕 - 使用保存的狀態計算堂數

---

## ✅ 驗證完成

- [x] 語法檢查通過（無 linter 錯誤）
- [x] 按鈕邏輯鎖正確實現
- [x] 剩餘堂數計算邏輯正確
- [x] 初始狀態正確顯示
- [x] 從簽到改為缺席會加回一堂（✅ 修復完成）
- [x] 所有場景邏輯驗證完成

---

**修復者**: Cursor AI Assistant  
**審核者**: Tim  
**狀態**: ✅ 完成並待部署  
**最後更新**: 2025-10-29 (修復狀態檢查時機問題)

