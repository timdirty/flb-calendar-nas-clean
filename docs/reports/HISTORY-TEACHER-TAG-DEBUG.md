# 歷史記錄講師標籤除錯指南

**日期**: 2025-11-06  
**問題**: 歷史記錄頁面不顯示講師浮動標籤  
**狀態**: 🔍 除錯中

---

## ✅ 已確認的部分

### 1. 後端 API 正常
```bash
curl "http://localhost:3002/api/learning-records/history?range=thisWeek"
```

**返回資料包含 teacher 欄位**:
```json
{
  "teacher": "TIM",
  "course": "ESM 二 16:00-17:00 外 第10週",
  "date": "2025-11-04"
}
```

### 2. 講師提取邏輯測試通過
- ✅ 成功率: 100% (13/13)
- ✅ 支援三重保險機制
- ✅ 大小寫不敏感

---

## 🔍 需要檢查的部分

### 檢查點 1: 講師顏色映射是否載入

**打開瀏覽器 Console**，尋找以下日誌：

```javascript
✅ 講師顏色已載入: 15 位講師
📋 講師清單: ["YOKI", "TED", "AGNES", ...]
🎨 講師顏色映射: { YOKI: "#FF6B6B", TED: "#4ECDC4", ... }
```

**如果沒看到** → 講師 API 載入失敗

**如果看到但數量為 0** → teacher_data.json 格式錯誤

### 檢查點 2: 講師提取是否成功

**尋找以下日誌**（前5筆記錄）:

```javascript
🔍 [記錄 1] 講師來源: 課程總覽 - AGNES
🔍 [記錄 2] 講師來源: 第一位學生 - HANSEN
🔍 [記錄 3] 講師來源: 前端提取 - TIM
```

**如果看到**:
```javascript
⚠️ [記錄 1] 無法提取講師: { course: "...", path: "" }
```
→ 講師提取失敗

### 檢查點 3: 講師標籤樣式是否生成

**尋找以下日誌**:

```javascript
🎨 [記錄 1] 講師標籤: {
  teacher: "AGNES",
  teacherColor: "#95E1D3",
  hasTag: true,
  tagStyle: "✅ 有樣式"
}
```

**如果看到**:
```javascript
🎨 [記錄 1] 講師標籤: {
  teacher: null,
  teacherColor: "❌ 無顏色",
  hasTag: false,
  tagStyle: "❌ 無樣式"
}
```
→ teacher 為 null，後端沒有返回或前端沒有正確接收

---

## 🐛 可能的問題和解決方案

### 問題 1: 講師顏色映射未載入

**原因**: `/api/teachers` API 失敗

**解決方案**:
1. 檢查 `teacher_data.json` 是否存在
2. 檢查文件格式是否正確
3. 手動訪問 `http://localhost:3002/api/teachers` 查看返回內容

### 問題 2: 講師名稱大小寫不匹配

**原因**: 後端返回 "agnes"，但顏色映射中是 "AGNES"

**解決方案**: 已在代碼中實現大小寫不敏感比對

### 問題 3: 講師標籤沒有樣式

**原因**: `teacherColor` 為 null

**解決方案**: 已添加預設藍色樣式
```javascript
// 即使沒有顏色，也會顯示藍色標籤
teacherTagStyle = 'background: #3b82f6; color: #ffffff; border: 1px solid #3b82f6;';
```

### 問題 4: CSS 隱藏了標籤

**原因**: CSS 樣式錯誤

**檢查**: 使用瀏覽器開發者工具檢查元素
```html
<span class="record-tag record-tag--teacher" style="background: #95E1D3; ...">
  <i class="fas fa-user-tie"></i> AGNES
</span>
```

如果元素存在但看不見 → CSS 問題  
如果元素不存在 → JavaScript 渲染問題

---

## 📝 除錯步驟

### 步驟 1: 清除快取並重新載入

1. 按 `Ctrl + Shift + R` (Windows) 或 `Cmd + Shift + R` (Mac)
2. 或在開發者工具中勾選 "Disable cache"

### 步驟 2: 打開 Console 並查看日誌

1. 按 `F12` 開啟開發者工具
2. 切換到 "Console" 頁籤
3. 重新開啟歷史記錄面板
4. 查看上述檢查點的日誌

### 步驟 3: 檢查 HTML 元素

1. 切換到 "Elements" 頁籤
2. 找到 `.history-record` 元素
3. 展開查看是否有 `.record-tag--teacher` 元素
4. 檢查該元素的 `style` 屬性

### 步驟 4: 檢查 Network 請求

1. 切換到 "Network" 頁籤
2. 重新載入頁面
3. 找到 `/api/teachers` 請求
4. 查看 Response 是否正確返回講師資料

### 步驟 5: 手動測試 API

在 Console 中執行：

```javascript
// 測試講師 API
fetch('/api/teachers')
  .then(r => r.json())
  .then(data => console.log('講師資料:', data));

// 測試歷史記錄 API
fetch('/api/learning-records/history?range=thisWeek')
  .then(r => r.json())
  .then(data => {
    console.log('記錄數:', data.records.length);
    console.log('第一筆記錄:', data.records[0]);
    console.log('第一筆記錄的講師:', data.records[0].teacher);
  });

// 檢查顏色映射
console.log('講師顏色映射:', window.teacherColorMap);
```

---

## 🔧 臨時測試修改

如果需要快速測試，可以在 Console 中手動設定：

```javascript
// 1. 手動設定講師顏色映射
window.teacherColorMap = {
  'YOKI': '#FF6B6B',
  'TED': '#4ECDC4',
  'AGNES': '#95E1D3',
  'HANSEN': '#FFD93D',
  'JAMES': '#6BCF7F',
  'IVAN': '#A8E6CF',
  'XIAN': '#FFB6C1',
  'EASON': '#87CEEB',
  'BELLA': '#DDA0DD',
  'GILLIAN': '#F0E68C',
  'DANIEL': '#FFA07A',
  'Dirty': '#20B2AA',
  'TIM': '#778899',
  'Melody': '#FFB6D9'
};

// 2. 重新載入歷史記錄
document.getElementById('openHistoryBtn').click();
```

---

## 📸 需要提供的截圖/資訊

請提供以下資訊協助除錯：

1. **Console 日誌截圖**（需包含）:
   - `✅ 講師顏色已載入: X 位講師`
   - `🔍 [記錄 X] 講師來源: ...`
   - `🎨 [記錄 X] 講師標籤: ...`

2. **Elements 檢查截圖**:
   - `.history-record` 的 HTML 結構
   - 是否有 `.record-tag--teacher` 元素

3. **Network 請求截圖**:
   - `/api/teachers` 的 Response
   - `/api/learning-records/history` 的 Response

4. **實際顯示截圖**:
   - 歷史記錄卡片的樣子
   - 有顯示課程類型標籤嗎？

---

## 🎯 預期結果

正常情況下應該看到：

```
資訊課501 四 13:20-14:00 外 第10週
[HANSEN] [資訊課]
```

其中 `[HANSEN]` 是講師標籤，`[資訊課]` 是課程類型標籤。

---

**下一步**: 請按照除錯步驟操作，並提供上述資訊。

