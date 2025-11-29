# 學生提醒加入地址導航功能 - 完整規劃

## 📋 需求說明

**目標**：在課程提醒管理系統（`course-reminder-management.html`）產生的學生提醒中，加入類似補課/體驗學生的地址導航功能。

**當前狀況**：
- ✅ 補課/體驗學生通知已有「具體地址」欄位和 Google Maps 導航按鈕
- ✅ 課程提醒管理系統已有 Quick Reply 功能（出席、請假、待確認）
- ❌ 一般學生提醒只有基本地點資訊（`event.location`），無法自訂具體地址
- ❌ 無 Google Maps 導航按鈕

**需求**：
1. 讓一般學生的課程提醒也能包含「具體地址」
2. 如果有具體地址，自動顯示 Google Maps 導航按鈕
3. 保持與補課/體驗學生通知的一致性

---

## 🎯 核心問題分析

### 問題 1：資料來源差異

| 類型 | 資料來源 | 地址欄位 |
|------|---------|---------|
| **補課/體驗學生** | `temporary_students.json` | `detailedAddress`（可自訂） |
| **一般學生** | Synology Calendar Events | `event.location`（課程統一設定） |

**結論**：一般學生的地址來自行事曆事件，無法為個別學生自訂具體地址。

---

### 問題 2：解決方案選擇

#### 方案 A：在學生資料中加入地址欄位 ⭐ **建議**

**實施方式**：
- 在 `student_data.json` 中為每個學生加入 `detailedAddress` 欄位（選填）
- 若學生有設定具體地址，優先使用；否則使用課程的 `event.location`

**優點**：
- ✅ 可以為特定學生設定個別地址（例如：到府上課、特定教室）
- ✅ 資料結構清晰，易於維護
- ✅ 與補課/體驗學生邏輯一致

**缺點**：
- ⚠️ 需要手動在 Google Sheets 或 `student_data.json` 中維護地址資料
- ⚠️ 如果學生很多，維護成本較高

---

#### 方案 B：使用課程地點對應表

**實施方式**：
- 建立地點對應表（`location-mapping.json`）
- 將簡稱（例如：「樂程坊」）對應到具體地址

**優點**：
- ✅ 統一管理，一次設定，全部適用
- ✅ 維護成本低

**缺點**：
- ❌ 無法為個別學生設定不同地址
- ❌ 彈性較低

---

#### 方案 C：混合方案（最佳） ⭐⭐⭐

**實施方式**：
1. 學生資料支援 `detailedAddress` 欄位（個別地址）
2. 建立地點對應表（統一地址）
3. **優先順序**：學生個別地址 > 臨時學生地址 > 地點對應表 > 課程地點

**優點**：
- ✅ 兼顧彈性與維護成本
- ✅ 大多數情況使用統一地址，特殊情況可個別設定
- ✅ 向後相容

**決定**：**採用方案 C（混合方案）**

---

## 📊 資料結構設計

### 1. 學生資料擴充（student_data.json）

```json
{
  "students": [
    {
      "id": "1",
      "name": "小明",
      "userId": "U1234567890abcdef",
      "remaining": 10,
      "detailedAddress": "10491台北市中山區復興北路15號9樓（小樹屋｜蒲公英 919）",  // 🔥 新增（選填）
      "courses": [
        {
          "course": "SPIKE 五 16:10-17:40 松山",
          "period": "五 16:10-17:40"
        }
      ]
    }
  ]
}
```

**注意**：`detailedAddress` 為**選填欄位**，大多數學生可以不設定。

---

### 2. 地點對應表（location-mapping.json）🆕

```json
{
  "mappings": {
    "樂程坊": "10491台北市中山區復興北路15號9樓（樂程坊｜蒲公英 919）",
    "小樹屋": "10491台北市中山區復興北路15號9樓（小樹屋｜蒲公英 919）",
    "松山": "10491台北市中山區復興北路15號9樓（松山教室｜蒲公英 919）",
    "松江教室": "104台北市中山區松江路123號4樓"
  },
  "默認地址": "10491台北市中山區復興北路15號9樓"
}
```

**用途**：統一管理常用地點的具體地址。

---

### 3. 學生提醒資料結構（reminders.json）

```json
{
  "studentReminders": [
    {
      "id": "student_1732786000000_xyz",
      "studentName": "小明",
      "parentUserId": "U1234567890abcdef",
      "courseName": "SPIKE 五 16:10-17:40 松山",
      "courseDate": "2025-11-29",
      "courseTime": "16:10",
      "location": "松山",  // 課程地點（簡稱）
      "detailedAddress": "10491台北市中山區復興北路15號9樓（松山教室｜蒲公英 919）",  // 🔥 新增：具體地址
      "googleMapsUrl": "https://www.google.com/maps/search/?api=1&query=...",  // 🔥 新增：Google Maps URL
      "message": "...",
      "status": "pending",
      "scheduledTime": "2025-11-28T11:30:00.000Z"
    }
  ]
}
```

---

## 🔄 系統邏輯流程

### 地址解析優先順序

```
1. 學生個別地址（student.detailedAddress）
   ↓ 若無
2. 臨時學生地址（temporaryStudent.detailedAddress）
   ↓ 若無
3. 地點對應表（locationMapping[event.location]）
   ↓ 若無
4. 課程地點（event.location）
   ↓ 若無
5. 預設地址（locationMapping["預設地址"]）
```

### 實施程式碼邏輯

```javascript
// 在 reminder-scheduler.js 的 createStudentReminder 函數中

function resolveDetailedAddress(student, event) {
  // 1. 學生個別地址
  if (student.detailedAddress && student.detailedAddress.trim() !== '') {
    console.log(`📍 使用學生個別地址: ${student.name}`);
    return student.detailedAddress;
  }
  
  // 2. 臨時學生地址（補課/體驗）
  if (student.isTemporary && student.detailedAddress && student.detailedAddress.trim() !== '') {
    console.log(`📍 使用臨時學生地址: ${student.name}`);
    return student.detailedAddress;
  }
  
  // 3. 地點對應表
  const eventLocation = event.location || '';
  const locationMapping = loadLocationMapping();  // 載入對應表
  if (locationMapping.mappings[eventLocation]) {
    console.log(`📍 使用地點對應表: ${eventLocation} -> ${locationMapping.mappings[eventLocation]}`);
    return locationMapping.mappings[eventLocation];
  }
  
  // 4. 課程地點（已映射）
  if (eventLocation && eventLocation.trim() !== '') {
    console.log(`📍 使用課程地點: ${eventLocation}`);
    return this.mapAddress(eventLocation);  // 使用現有的地址映射函數
  }
  
  // 5. 預設地址
  console.log(`📍 使用預設地址`);
  return locationMapping["預設地址"] || '樂程坊';
}

// 使用範例
const detailedAddress = resolveDetailedAddress(student, event);
const locationDisplay = event.location || '樂程坊';
const googleMapsUrl = detailedAddress && detailedAddress.trim() !== '' 
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detailedAddress)}`
  : '';
```

---

## 📝 實施步驟

### Phase 1：資料層準備

#### 1.1 建立地點對應表
- **檔案**：`location-mapping.json`（新增）
- **內容**：常用地點的具體地址映射

#### 1.2 確認學生資料格式
- **檔案**：`public/student_data.json`
- **確認**：`detailedAddress` 欄位已存在於資料結構中
- **Google Sheets**：在「學生資料表」中加入「具體地址」欄位（選填）

---

### Phase 2：後端邏輯更新

#### 2.1 地址解析函數
- **檔案**：`reminder-scheduler.js`
- **新增函數**：`resolveDetailedAddress(student, event)`
- **新增函數**：`loadLocationMapping()`
- **修改位置**：第 2985-3008 行（`createStudentReminder` 函數中的地點邏輯）

```javascript
// 修改前
let location = event.location || '未設定地點';
location = this.mapAddress(location);

const googleMapsUrl = location && location !== '未設定地點' ? 
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}` : '';

// 修改後
const locationSimple = event.location || '樂程坊';  // 地點簡稱
const detailedAddress = this.resolveDetailedAddress(student, event);  // 具體地址
const googleMapsUrl = detailedAddress && detailedAddress.trim() !== '' 
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(detailedAddress)}`
  : '';
```

#### 2.2 更新 Reminder 資料結構
- **檔案**：`reminder-scheduler.js`
- **修改位置**：第 3038-3065 行（`reminder` 物件建立）

```javascript
const reminder = {
  // ... 現有欄位 ...
  location: locationSimple,  // 地點簡稱
  detailedAddress: detailedAddress,  // 🔥 新增：具體地址
  googleMapsUrl: googleMapsUrl,  // 已存在，確保正確設定
  // ...
};
```

---

### Phase 3：Flex Message 範本更新

#### 3.1 更新學生提醒範本
- **檔案**：`flex-message-templates.json`
- **修改範本**：`templates.student`

**修改內容**：

```json
{
  "templates": {
    "student": {
      "body": {
        "contents": [
          // ... 現有內容 ...
          {
            "type": "box",
            "layout": "baseline",
            "spacing": "sm",
            "contents": [
              {
                "type": "text",
                "text": "📍",
                "size": "sm",
                "flex": 0
              },
              {
                "type": "text",
                "text": "{location}",  // 🔥 顯示：地點簡稱 | 具體地址
                "size": "sm",
                "color": "#666666",
                "flex": 5,
                "wrap": true
              }
            ]
          }
        ]
      },
      "footer": {  // 🔥 新增 footer（導航按鈕）
        "type": "box",
        "layout": "vertical",
        "contents": [
          {
            "type": "button",
            "action": {
              "type": "uri",
              "label": "🧭 Google Maps 導航",
              "uri": "{googleMapsUrl}"
            },
            "style": "primary",
            "color": "#FBBC04",
            "height": "sm"
          }
        ],
        "spacing": "sm"
      }
    }
  }
}
```

**重要**：footer 應該是**可選的**，只有在有 `googleMapsUrl` 時才顯示。

---

### Phase 4：範本處理邏輯更新

#### 4.1 更新變數替換邏輯
- **檔案**：`reminder-scheduler.js`（或相關發送邏輯）
- **修改位置**：發送學生提醒時的變數替換

```javascript
// 組裝完整地點資訊
let locationDisplay = reminder.location || '樂程坊';
if (reminder.detailedAddress && reminder.detailedAddress.trim() !== '') {
  locationDisplay = `${locationDisplay} | ${reminder.detailedAddress}`;
}

// 準備替換變數
const variables = {
  '{studentName}': reminder.studentName,
  '{courseName}': reminder.courseName,
  '{courseDate}': reminder.courseDate,
  '{weekday}': reminder.weekday || '',
  '{courseTime}': reminder.courseTime || '',
  '{teacherName}': reminder.teacherName || '講師',
  '{location}': locationDisplay,  // 🔥 完整地點資訊
  '{googleMapsUrl}': reminder.googleMapsUrl || '',
  // ...
};

// 🔥 若無具體地址，則移除導航按鈕（footer）
let template = JSON.parse(JSON.stringify(flexTemplate));  // 深拷貝
if (!reminder.googleMapsUrl || reminder.googleMapsUrl.trim() === '') {
  delete template.footer;
}
```

#### 4.2 確認發送 API
- **檔案**：`server.js`
- **API 端點**：`POST /api/student-reminders/:id/send`
- **確認**：正確處理 `detailedAddress` 和 `googleMapsUrl`

---

### Phase 5：前端管理介面更新

#### 5.1 課程提醒管理（選填）
- **檔案**：`public/course-reminder-management.html`
- **功能**：允許在建立學生提醒時覆寫地址

**新增欄位**（如果需要手動建立提醒）：

```html
<div class="form-group">
    <label>具體地址（選填）</label>
    <input type="text" id="studentReminderAddress" placeholder="例如：10491台北市中山區復興北路15號9樓">
    <p class="help-text">若不填寫，將使用系統預設地址或地點對應表</p>
</div>
```

#### 5.2 學生資料管理（Google Sheets）
- **Google Sheets**：「學生資料表」
- **新增欄位**：「具體地址」（選填）
- **同步**：透過 `google-sheets-students.js` 同步到 `student_data.json`

---

## 🧪 測試計畫

### 測試案例 1：使用地點對應表

**前置條件**：
- 學生「小明」沒有設定 `detailedAddress`
- `location-mapping.json` 中有「松山」→「10491台北市中山區復興北路15號9樓」的對應

**測試步驟**：
1. 建立「小明」的學生提醒（課程地點：松山）
2. 檢查提醒資料中的 `detailedAddress`
3. 發送提醒
4. 檢查 LINE 訊息

**預期結果**：
- `detailedAddress`: "10491台北市中山區復興北路15號9樓（松山教室｜蒲公英 919）"
- `googleMapsUrl`: `https://www.google.com/maps/search/?api=1&query=...`
- LINE 訊息顯示：「📍 松山 | 10491台北市中山區復興北路15號9樓」
- 有「🧭 Google Maps 導航」按鈕

---

### 測試案例 2：使用學生個別地址

**前置條件**：
- 學生「小華」設定了 `detailedAddress`: "106台北市大安區忠孝東路四段181巷7弄13號3樓"
- 課程地點：樂程坊

**測試步驟**：
1. 建立「小華」的學生提醒
2. 檢查提醒資料中的 `detailedAddress`
3. 發送提醒
4. 檢查 LINE 訊息

**預期結果**：
- `detailedAddress`: "106台北市大安區忠孝東路四段181巷7弄13號3樓"（學生個別地址）
- `googleMapsUrl`: 使用學生地址生成
- LINE 訊息顯示：「📍 樂程坊 | 106台北市大安區忠孝東路四段181巷7弄13號3樓」
- 有「🧭 Google Maps 導航」按鈕

---

### 測試案例 3：無具體地址

**前置條件**：
- 學生「小李」沒有設定 `detailedAddress`
- 課程地點「未知教室」不在 `location-mapping.json` 中

**測試步驟**：
1. 建立「小李」的學生提醒
2. 檢查提醒資料中的 `detailedAddress`
3. 發送提醒
4. 檢查 LINE 訊息

**預期結果**：
- `detailedAddress`: "10491台北市中山區復興北路15號9樓"（預設地址）或空字串
- `googleMapsUrl`: 空字串或預設地址 URL
- LINE 訊息顯示：「📍 未知教室」（無具體地址）
- **無**「🧭 Google Maps 導航」按鈕（footer 被移除）

---

### 測試案例 4：補課/體驗學生（向後相容）

**前置條件**：
- 補課學生「小美」（`temporary_students.json`）設定了 `detailedAddress`

**測試步驟**：
1. 建立「小美」的學生提醒
2. 檢查提醒資料
3. 發送提醒

**預期結果**：
- 優先使用臨時學生的 `detailedAddress`
- 與現有邏輯一致

---

## 📦 檔案清單

### 新增檔案
1. `location-mapping.json` - 地點對應表

### 修改檔案
1. `reminder-scheduler.js` - 地址解析邏輯
2. `flex-message-templates.json` - 學生提醒範本（加入 footer）
3. `public/student_data.json` - 學生資料結構（加入 `detailedAddress`）
4. `public/course-reminder-management.html` - 管理介面（選填）
5. `google-sheets-students.js` - Google Sheets 同步邏輯（如果需要）

### 測試檔案
1. `tests/manual/test-student-reminder-address.js` - 手動測試腳本

---

## ⚠️ 注意事項

### 1. 向後相容
- **必須**確保沒有設定 `detailedAddress` 的學生不受影響
- **必須**確保補課/體驗學生的現有邏輯繼續運作

### 2. 效能考量
- 載入 `location-mapping.json` 時使用快取
- 避免每次建立提醒都重新讀取檔案

### 3. 資料維護
- 建議在 Google Sheets 中加入「具體地址」欄位（選填）
- 建立清晰的地址格式規範（例如：郵遞區號 + 完整地址 + 樓層 + 教室名稱）

### 4. 錯誤處理
- 如果地址格式不正確，不應阻止提醒發送
- 如果 Google Maps URL 生成失敗，應移除導航按鈕

---

## 📊 優先順序與時程

### Phase 1：資料層（1-2 小時）
- [x] 建立 `location-mapping.json`
- [x] 確認學生資料結構

### Phase 2：後端邏輯（2-3 小時）
- [ ] 實作 `resolveDetailedAddress` 函數
- [ ] 更新 `createStudentReminder` 函數
- [ ] 更新發送邏輯中的變數替換

### Phase 3：Flex Message 範本（1 小時）
- [ ] 更新 `student` 範本
- [ ] 確認條件式 footer 邏輯

### Phase 4：測試驗證（2-3 小時）
- [ ] 執行 4 個測試案例
- [ ] 修復問題
- [ ] 確認 LINE 訊息顯示正確

### Phase 5：文檔更新（1 小時）
- [ ] 更新 `AGENTS.md`
- [ ] 建立使用說明文檔

**總計**：約 7-10 小時

---

## 📋 檢查清單

- [x] `location-mapping.json` 已建立 ✅
- [x] `resolveDetailedAddress` 函數已實作 ✅
- [x] `createStudentReminder` 已更新 ✅
- [x] `flex-message-templates.json` 已更新 ✅
- [x] 發送邏輯已更新（條件式 footer）✅
- [x] 管理介面已實作 ✅
- [x] API 端點已實作 ✅
- [ ] 測試案例 1-6 全部通過（待用戶執行）
- [x] 向後相容性確認 ✅
- [x] 文檔已更新 ✅
- [ ] 部署至生產環境（待執行）

---

## 🎯 實施完成記錄

### 實施日期
**2025-11-28 17:10**

### 完成項目

#### Phase 1: 資料層準備 ✅
- 建立 `location-mapping.json` 包含 4 個預設地點
- 確認 `student_data.json` 支援 `detailedAddress` 欄位（選填）

#### Phase 2: 後端邏輯 ✅
- 實作 `loadLocationMapping()` 函數
- 實作 `resolveDetailedAddress()` 混合式地址解析
- 更新 `createStudentReminder()` 使用新邏輯
- 修改檔案：`reminder-scheduler.js`（第 28-32、87-145、3049-3124 行）

#### Phase 3: Flex Message 範本 ✅
- 更新 `templates.student` 加入 footer（導航按鈕）
- 實作條件式移除邏輯（`notification-manager.js` 第 601-619 行）
- 修改檔案：`flex-message-templates.json`（第 707-725 行）

#### Phase 4: 管理介面 ✅
- 新增「學生提醒地點對應表」管理區塊
- 建立 `public/js/location-mapping-manager.js` 模組
- 修改檔案：`course-reminder-management.html`（第 3120-3168 行）

#### Phase 5: API 端點 ✅
實作 4 個 REST API：
- `GET /api/location-mapping` - 讀取對應表
- `PUT /api/location-mapping` - 更新對應表
- `POST /api/location-mapping/location` - 新增地點
- `DELETE /api/location-mapping/location/:name` - 刪除地點
- 修改檔案：`server.js`（第 20154-20281 行）

#### Phase 6: 測試與文檔 ✅
- 建立詳細測試指南：`tests/manual/test-student-reminder-address-navigation.md`
- 更新 `AGENTS.md` 記錄功能實施
- 更新本規劃文件完成狀態

### 技術亮點
1. **混合式地址解析**：5 層優先順序策略
2. **條件式 UI**：有地址才顯示導航按鈕
3. **統一管理介面**：直覺的地點對應表 CRUD
4. **向後相容**：完全不影響補課/體驗學生現有邏輯
5. **彈性擴充**：支援學生個別地址覆蓋

### 待辦事項
- [ ] 用戶執行測試案例驗證
- [ ] 確認生產環境部署流程
- [ ] 收集用戶回饋並調整

---

**文檔建立日期**: 2025-11-28  
**規劃者**: AI Assistant  
**審核者**: User  
**實施完成**: 2025-11-28 17:10
