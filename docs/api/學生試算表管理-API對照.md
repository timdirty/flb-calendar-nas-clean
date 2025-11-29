# 學生試算表管理（Beta）- 前後端 API 對照

## ✅ 功能概述

「學生試算表管理（Beta）」是一個完整的學生資料管理介面，提供：
- 📊 即時同步 Google Sheets 學生資料
- ✏️ CRUD 操作（新增、讀取、更新、刪除）
- 🔍 多條件篩選與搜尋
- 📈 學生統計數據視覺化

---

## 📂 相關檔案

### 前端
- `public/admin-student-sheet.html` - 學生試算表管理主頁面
- `public/js/admin-student-sheet.js` - 前端邏輯與 API 調用
- `public/admin-dashboard.html` - 控制台（含選單入口）

### 後端
- `server.js` - 主伺服器（包含所有 API 端點）
- `google-sheets-students.js` - Google Sheets 學生資料讀取模組
- `google-sheets-client.js` - Google Sheets API 客戶端

---

## 🔗 API 端點對照表

| 功能 | 前端調用 | 後端端點 | 方法 | 文件位置 |
|------|---------|---------|------|---------|
| **讀取學生試算表** | `fetch('/api/admin/student-sheet')` | `app.get('/api/admin/student-sheet', ...)` | GET | server.js:6161 |
| **新增學生資料** | `fetch('/api/admin/student-sheet', {method: 'POST'})` | `app.post('/api/admin/student-sheet', ...)` | POST | server.js:6277 |
| **更新學生資料** | `fetch('/api/admin/student-sheet/:row', {method: 'PATCH'})` | `app.patch('/api/admin/student-sheet/:row', ...)` | PATCH | server.js:6203 |
| **刪除學生資料** | `fetch('/api/admin/student-sheet/:row', {method: 'DELETE'})` | `app.delete('/api/admin/student-sheet/:row', ...)` | DELETE | server.js:6331 |
| **讀取群組資料** | `fetch('/api/admin/groups')` | `app.get('/api/admin/groups', ...)` | GET | server.js:6182 |
| **讀取家長用戶** | `fetch('/api/parent-users')` | `app.get('/api/parent-users', ...)` | GET | server.js:10446 |
| **讀取篩選配置** | `fetch('/api/student-filter-config')` | `app.get('/api/student-filter-config', ...)` | GET | server.js:13525 |
| **更新篩選配置** | `fetch('/api/student-filter-config', {method: 'POST'})` | `app.post('/api/student-filter-config', ...)` | POST | server.js:13585 |

---

## 📋 API 詳細說明

### 1. GET /api/admin/student-sheet
**功能**: 讀取學生試算表資料（含快取機制）

**Query 參數**:
- `force` (可選): 值為 `1` 或 `true` 時強制重新抓取

**回應格式**:
```json
{
  "success": true,
  "columns": [
    {"key": "name", "label": "學生姓名", "width": 120},
    {"key": "courseName", "label": "課程名稱", "width": 180},
    ...
  ],
  "rows": [
    {
      "rowNumber": 2,
      "name": "王小明",
      "courseName": "Python 程式設計",
      "remainingSessions": 8,
      ...
    }
  ],
  "fetchedAt": "2025-11-02T12:00:00.000Z"
}
```

**前端調用** (admin-student-sheet.js:798):
```javascript
const response = await fetch(url.toString());
const data = await response.json();
```

---

### 2. POST /api/admin/student-sheet
**功能**: 新增學生資料到試算表

**請求 Body**:
```json
{
  "values": {
    "name": "王小明",
    "courseName": "Python 程式設計",
    "remainingSessions": 10,
    "courseCategory": "程式設計",
    "parentName": "王爸爸",
    "userId": "U1234567890abcdef",
    ...
  }
}
```

**回應格式**:
```json
{
  "success": true,
  "rowNumber": 15,
  "updatedRange": "'學生資料'!A15:W15",
  "values": ["王小明", "Python 程式設計", ...]
}
```

**前端調用** (admin-student-sheet.js:1162):
```javascript
response = await fetch(API_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: formData })
});
```

---

### 3. PATCH /api/admin/student-sheet/:row
**功能**: 更新指定行的學生資料

**路徑參數**:
- `row`: 試算表行號（必須 ≥ 2）

**請求 Body**:
```json
{
  "values": {
    "remainingSessions": 7,
    "note": "已補課一次"
  }
}
```

**回應格式**:
```json
{
  "success": true,
  "rowNumber": 5,
  "updatedRange": "'學生資料'!A5:W5"
}
```

**前端調用** (admin-student-sheet.js:1168):
```javascript
response = await fetch(`${API_ENDPOINT}/${state.editingRowNumber}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values: formData })
});
```

---

### 4. DELETE /api/admin/student-sheet/:row
**功能**: 刪除指定行的學生資料

**路徑參數**:
- `row`: 試算表行號（必須 ≥ 2）

**回應格式**:
```json
{
  "success": true,
  "rowNumber": 5
}
```

**前端調用** (admin-student-sheet.js:1199):
```javascript
const response = await fetch(`${API_ENDPOINT}/${rowNumber}`, { 
    method: 'DELETE' 
});
```

---

### 5. GET /api/admin/groups
**功能**: 讀取群組資料（用於通知對象選擇）

**Query 參數**:
- `force` (可選): 強制重新抓取

**回應格式**:
```json
{
  "success": true,
  "groups": [
    {
      "groupName": "Python 週三班",
      "groupId": "C1234567890abcdef",
      "courseName": "Python 程式設計",
      ...
    }
  ],
  "columns": [...],
  "fetchedAt": "2025-11-02T12:00:00.000Z"
}
```

**前端調用** (admin-student-sheet.js:854):
```javascript
const response = await fetch('/api/admin/groups');
const data = await response.json();
```

---

### 6. GET /api/parent-users
**功能**: 讀取家長用戶資料（用於自動完成）

**回應格式**:
```json
{
  "success": true,
  "parents": [
    {
      "parentName": "王爸爸",
      "userId": "U1234567890abcdef"
    }
  ]
}
```

**前端調用** (admin-student-sheet.js:825):
```javascript
const response = await fetch('/api/parent-users');
const data = await response.json();
```

---

### 7. GET/POST /api/student-filter-config
**功能**: 讀取/更新學生篩選規則配置

**回應格式** (GET):
```json
{
  "success": true,
  "config": {
    "debugMode": false,
    "minRemainingClasses": 0,
    "enableRemainingCheck": true,
    "showInCurrentWeek": true,
    "courseMatchMode": "exact",
    ...
  }
}
```

**前端調用** (admin-student-sheet.js:119):
```javascript
const response = await fetch('/api/student-filter-config');
const data = await response.json();
```

---

## 🔧 後端配置

### Google Sheets 設定
- **試算表 ID**: `1A2dPb0iyvaqVGTOKqGcsq7aC6UHNttVcJ82r-G0xevk`
- **工作表名稱**: `學生資料`
- **API 金鑰**: 環境變數 `GOOGLE_SHEETS_API_KEY`

### 快取機制
- **快取時間**: 5 分鐘（300,000 ms）
- **強制更新**: 使用 `force=true` 參數
- **快取失效**: 新增/更新/刪除操作後自動失效

---

## 📊 資料欄位對照

| 欄位 Key | 中文名稱 | 資料類型 | 必填 |
|---------|---------|---------|------|
| name | 學生姓名 | 字串 | ✅ |
| courseName | 課程名稱 | 字串 | ✅ |
| remainingSessions | 剩餘堂數 | 數字 | ⚠️ |
| courseCategory | 課程類型 | 字串 | - |
| parentName | 家長姓名 | 字串 | - |
| userId | LINE User ID | 字串 | - |
| notificationTargetType | 通知對象 | 字串 | - |
| note | 備註 | 長文字 | - |
| purchasedSessions | 購買堂數 | 數字 | - |
| currentTuition | 課程費用 | 數字 | - |
| isEarlyBird | 早鳥優惠 | 布林 | - |
| isReturning | 回流學生 | 布林 | - |
| isGroupSignup | 團報 | 布林 | - |
| isSuperEarlyBird | 超級早鳥 | 布林 | - |
| billingInfo | 付款資訊 | 長文字 | - |
| coursePlan | 課程規劃 | 長文字 | - |

---

## 🎨 前端功能特色

### 1. 即時搜尋與篩選
- 關鍵字搜尋（學生姓名、課程名稱、家長、User ID）
- 課程名稱篩選
- 課程類型篩選
- 通知對象篩選（個別/群組）
- 剩餘堂數篩選（全部/僅 0 堂/僅 ≦ 5 堂）
- 缺少聯絡資訊篩選

### 2. 統計儀表板
- 總學生數（含個別/群組分佈）
- 個別通知學生數
- 群組通知學生數
- 待補資料學生數

### 3. 資料操作
- 新增學生
- 編輯學生資料
- 刪除學生
- 批次操作（未來功能）

### 4. 自動完成
- 家長姓名自動完成（基於現有資料）
- 群組名稱自動完成

---

## 🚀 使用方式

### 1. 從控制台進入
1. 開啟 `admin-dashboard.html`
2. 在左側選單找到「基本管理」→「學生試算表管理（Beta）」
3. 點擊後會跳轉到 `admin-student-sheet.html`

### 2. 操作流程
1. **載入資料**: 頁面自動載入學生試算表資料
2. **搜尋篩選**: 使用上方篩選器快速找到目標學生
3. **新增學生**: 點擊「新增學生」按鈕，填寫表單後儲存
4. **編輯學生**: 點擊表格右側「編輯」按鈕，修改資料後儲存
5. **刪除學生**: 點擊「刪除」按鈕，確認後刪除
6. **強制更新**: 點擊「強制重新抓取」按鈕，從 Google Sheets 重新抓取最新資料

---

## ⚠️ 注意事項

### 安全性
- 所有 API 需要適當的權限驗證（建議在生產環境啟用）
- Google Sheets API 金鑰應存放在環境變數中
- Service Account JSON 檔案不應提交到版本控制

### 效能
- 使用快取機制減少 Google Sheets API 調用
- 前端使用防抖（Debounce）優化搜尋效能
- 批次操作建議分批處理，避免超時

### 資料一致性
- 新增/更新/刪除操作後會自動失效快取
- 建議定期使用「強制重新抓取」確保資料同步
- 多人同時編輯時可能產生衝突，建議協調操作時間

---

## 🔄 版本歷史

- **v2025-11-02**: 完整功能實作，前後端對齊驗證完成
- **v2025-11-03**: 加入到 admin-dashboard.html 選單中

---

## 📝 待辦事項

- [ ] 批次匯入功能
- [ ] 批次匯出功能（CSV/Excel）
- [ ] 資料變更歷史記錄
- [ ] 權限管理（不同角色的操作權限）
- [ ] 資料驗證強化（電話號碼、Email 格式等）

---

**文件版本**: 1.0  
**最後更新**: 2025-11-03  
**維護者**: FLB Team

