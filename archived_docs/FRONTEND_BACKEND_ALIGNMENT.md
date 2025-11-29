# 前後端功能對齊完整說明

**更新日期**: 2025-10-22  
**狀態**: ✅ 前後端已完全對齊

---

## 🎯 導航入口 (新增)

### 1. 管理後台 (admin-dashboard.html)

#### **頂部快速訪問按鈕** ⭐
位置：統計卡片上方
```html
🚀 課程提醒完整管理 → (點擊前往 course-reminder-management.html)
```

#### **統計卡片 - 提醒數** ⭐  
位置：第四個統計卡片
- 顯示提醒總數
- 點擊整個卡片 → 跳轉到課程提醒管理
- 提示文字：「點擊管理」

#### **通知設定標籤** ⭐
位置：「通知設定」標籤內第一個卡片
- 大型導航卡片（漸層背景）
- 功能介紹與說明
- 兩個按鈕：
  - 「前往課程提醒管理頁面」（同頁跳轉）
  - 「在新分頁開啟」（新分頁）

### 2. 課程提醒管理 (course-reminder-management.html)

#### **麵包屑導航** ⭐ 新增
```
管理後台 > 課程提醒管理
```

#### **頁面標題區** ⭐ 改進
- 標題：「課程提醒完整管理系統」
- 功能標籤：
  - ✅ Flex Message 支援
  - 🧪 測試發送功能
- 右側按鈕：
  - 「返回後台」→ admin-dashboard.html
  - 「查看行事曆」→ perfect-calendar-optimized-complete2.html (新分頁)

---

## 📱 完整功能地圖

### **頁面 1: 提醒管理**

| 前端 UI | 後端 API | 說明 |
|---------|---------|------|
| 提醒列表 | `GET /api/reminders` | 顯示所有提醒 ✅ |
| 篩選按鈕 | - | 前端過濾 (全部/當日/隔日) ✅ |
| 發送按鈕 | `POST /api/reminders/:id/send` | 發送提醒 ✅ |
| 測試發送按鈕 | `POST /api/reminders/:id/send-test` | 測試發送給管理員 ✅ |
| 編輯按鈕 | - | 打開編輯模態框 ✅ |
| 刪除按鈕 | `DELETE /api/reminders/:id` | 刪除提醒 ✅ |
| 批量操作 | `POST /api/reminders/batch-send` | 批量發送 ✅ |

### **頁面 2: 排程設定**

| 前端 UI | 後端 API | 說明 |
|---------|---------|------|
| 當日提醒時間 | `GET/POST /api/schedule-settings` | 設定當日提醒時間 ✅ |
| 隔日提醒時間 | `GET/POST /api/schedule-settings` | 設定隔日提醒時間 ✅ |
| 課前提醒分鐘 | `GET/POST /api/schedule-settings` | 設定課前提醒分鐘數 ✅ |
| 啟用自動提醒 | `GET/POST /api/schedule-settings` | 開關自動提醒 ✅ |
| 排程狀態顯示 | `GET /api/scheduler-status` | 顯示排程器狀態 ✅ |
| 倒數計時器 | - | 前端計算 ✅ |

### **頁面 3: 訊息範本 (Flex Message)** ⭐ 完整對齊

#### **Flex Message 設定區域**

| 前端 UI | 後端 API | JavaScript 函數 | 說明 |
|---------|---------|-----------------|------|
| 啟用 Flex Message | `GET/POST /api/flex-templates` | `toggleFlexMessageEditor()` | 開關 Flex Message ✅ |
| 範本類型選擇器 | - | `loadCurrentFlexTemplate()` | 切換範本類型 ✅ |
| JSON 編輯器 | - | `validateFlexJson()` | 編輯 JSON ✅ |
| 驗證 JSON 按鈕 | - | `validateFlexJson()` | 驗證格式 ✅ |
| **測試發送按鈕** ⭐ | **`POST /api/flex-templates/:type/send-test`** ⭐ | **`sendTestFlexTemplate()`** ⭐ | **測試發送給管理員** ✅ |
| 預覽按鈕 | - | `previewFlexMessage()` | 視覺化預覽 ✅ |
| 儲存範本按鈕 | `POST /api/flex-templates` | `saveFlexTemplate()` | 儲存單個範本 ✅ |
| 載入預設範本 | - | `loadPresetTemplate()` | 載入預設 ✅ |
| 重新載入伺服器資料 | `GET /api/flex-templates` | `loadFlexTemplates()` | 從伺服器載入 ✅ |

#### **預覽功能**

| 前端 UI | JavaScript 函數 | 說明 |
|---------|-----------------|------|
| 預覽容器 | `renderFlexMessagePreview()` | 渲染預覽 ✅ |
| 範本概要面板 | `updateFlexSummary()` | 顯示變數摘要 ✅ |
| 變數列表 | `extractVariables()` | 提取變數 ✅ |
| 示範資料 | `buildSampleDataForTemplate()` | 構建示範資料 ✅ |

#### **Quick Reply 設定**

| 前端 UI | 後端 API | JavaScript 函數 | 說明 |
|---------|---------|-----------------|------|
| 啟用 Quick Reply | `POST /api/flex-templates` | `saveAllFlexSettings()` | 開關快速回覆 ✅ |
| 回覆選項列表 | - | `renderQuickReplyOptions()` | 顯示選項 ✅ |
| 新增選項按鈕 | - | - | 新增回覆選項 ✅ |
| 刪除選項按鈕 | - | - | 刪除回覆選項 ✅ |
| 請假原因設定 | `POST /api/flex-templates` | `collectLeaveReasons()` | 設定請假原因 ✅ |

#### **儲存設定**

| 前端 UI | 後端 API | JavaScript 函數 | 說明 |
|---------|---------|-----------------|------|
| 儲存所有設定按鈕 | `POST /api/flex-templates` | `saveAllFlexSettings()` | 一鍵儲存全部 ✅ |

#### **傳統文字範本**

| 前端 UI | 後端 API | JavaScript 函數 | 說明 |
|---------|---------|-----------------|------|
| 當日提醒範本 | `POST /api/templates` | `saveTemplates()` | 文字範本 ✅ |
| 隔日提醒範本 | `POST /api/templates` | `saveTemplates()` | 文字範本 ✅ |
| 課前提醒範本 | `POST /api/templates` | `saveTemplates()` | 文字範本 ✅ |
| 學生提醒範本 | `POST /api/templates` | `saveTemplates()` | 文字範本 ✅ |

### **頁面 4: 學生提醒設定**

| 前端 UI | 後端 API | 說明 |
|---------|---------|------|
| 提醒時間 (時/分) | `GET/POST /api/student-reminder-settings` | 設定學生提醒時間 ✅ |
| 提醒期間 (天數) | `GET/POST /api/student-reminder-settings` | 設定提前幾天 ✅ |

---

## 🔌 後端 API 完整列表

### Flex Message 相關 API ⭐

```javascript
// 1. 獲取 Flex Message 範本
GET /api/flex-templates
回應: {
  success: true,
  data: {
    enabled: boolean,
    templates: {
      today: Object,
      tomorrow: Object,
      beforeClass: Object,
      student: Object
    },
    quickReply: {
      enabled: boolean,
      options: Array,
      leaveReasons: Array
    },
    carousel: { maxBubbles: number },
    defaultTemplates: Object  // 預設範本參考
  }
}

// 2. 儲存 Flex Message 範本
POST /api/flex-templates
請求: {
  enabled: boolean,
  templates: Object,
  quickReply: Object,
  carousel: Object
}
回應: {
  success: true,
  message: "Flex Message 範本已儲存",
  data: Object  // 儲存後的完整資料
}

// 3. 測試發送 Flex 範本 ⭐ 新增
POST /api/flex-templates/:type/send-test
參數: type = 'today' | 'tomorrow' | 'beforeClass' | 'student'
回應: {
  success: true,
  message: "測試 Flex 範本已發送給管理員",
  data: {
    templateType: string,
    sample: Object  // 示範資料
  }
}

// 範例：測試發送當日提醒範本
POST /api/flex-templates/today/send-test
```

### 提醒管理 API

```javascript
// 1. 獲取提醒列表
GET /api/reminders
回應: {
  success: true,
  data: Array<Reminder>
}

// 2. 發送提醒
POST /api/reminders/:id/send
回應: { success: true, message: "提醒已發送" }

// 3. 測試發送提醒 (僅發送給管理員)
POST /api/reminders/:id/send-test
回應: {
  success: true,
  message: "測試訊息已發送給管理員",
  data: { flexMessageEnabled: boolean }
}

// 4. 刪除提醒
DELETE /api/reminders/:id
回應: { success: true }

// 5. 批量發送
POST /api/reminders/batch-send
請求: { reminderIds: Array<string> }
回應: { success: true, results: Array }
```

### 排程設定 API

```javascript
// 獲取/儲存排程設定
GET/POST /api/schedule-settings
資料: {
  todayReminderTime: "08:00",
  tomorrowReminderTime: "18:00",
  beforeClassMinutes: 30,
  enableAutoReminders: true
}

// 獲取排程器狀態
GET /api/scheduler-status
回應: {
  success: true,
  status: "active" | "stopped",
  nextRun: Date,
  lastRun: Date
}
```

### 範本管理 API

```javascript
// 獲取/儲存訊息範本 (傳統文字)
GET/POST /api/templates
資料: {
  today: string,
  tomorrow: string,
  beforeClass: string,
  student: string
}
```

### 學生提醒設定 API

```javascript
// 獲取/儲存學生提醒設定
GET/POST /api/student-reminder-settings
資料: {
  hour: number,      // 19
  minute: number,    // 30
  duration: number   // 7 (天)
}
```

---

## 🎨 前端元件完整性檢查

### ✅ 所有可見的 UI 元素

#### **提醒管理頁面**
- ✅ 提醒列表卡片
- ✅ 篩選按鈕組 (全部/當日/隔日)
- ✅ 每個提醒的操作按鈕 (發送/測試/編輯/刪除)
- ✅ 批量操作按鈕
- ✅ 統計計數器

#### **排程設定頁面**
- ✅ 排程狀態儀表板
- ✅ 倒數計時器 (3個)
- ✅ 時間輸入框
- ✅ 啟用/停用開關
- ✅ 儲存設定按鈕

#### **訊息範本頁面** ⭐
- ✅ Flex Message 啟用開關
- ✅ 編輯模式切換 (JSON/可視化)
- ✅ 範本類型選擇器 (4種)
- ✅ JSON 編輯器 (語法高亮)
- ✅ 工具列按鈕：
  - ✅ 重新載入伺服器資料
  - ✅ 套用預設範本
  - ✅ 驗證 JSON
  - ✅ 儲存此範本
- ✅ **測試發送按鈕** ⭐ (新增)
- ✅ 預覽 Flex Message 按鈕
- ✅ 預覽容器 (視覺化顯示)
- ✅ 範本概要面板 (變數摘要)
- ✅ Quick Reply 設定區域
- ✅ 回覆選項列表 (可新增/刪除)
- ✅ 請假原因輸入框
- ✅ 儲存所有設定按鈕
- ✅ 傳統文字範本區域 (4個)
- ✅ 變數說明面板

#### **學生提醒設定頁面**
- ✅ 時間選擇器 (時/分)
- ✅ 期間選擇器 (天數)
- ✅ 儲存設定按鈕

---

## 🔄 資料流程圖

### Flex Message 完整流程

```
使用者操作                  前端處理                      後端處理                    LINE API
─────────────────────────────────────────────────────────────────────────────────────

1. 選擇範本類型
   └─> loadCurrentFlexTemplate()
       └─> 從 flexTemplatesData 載入
           └─> 顯示在 JSON 編輯器

2. 編輯 JSON
   └─> 輸入/修改 JSON
       └─> validateFlexJson()
           └─> 顯示驗證結果

3. 預覽訊息
   └─> previewFlexMessage()
       └─> buildSampleDataForTemplate()
       └─> applyVariablesToFlex()
       └─> renderFlexMessagePreview()
           └─> 視覺化顯示

4. 測試發送 ⭐
   └─> sendTestFlexTemplate()
       └─> validateFlexJson()
       └─> POST /api/flex-templates/:type/send-test
           └─> notificationManager.replaceFlexVariables()
           └─> notificationManager.buildQuickReply()
           └─> notificationManager.sendTestMessage()
               └─> LINE Messaging API
                   └─> 管理員收到測試訊息

5. 儲存範本
   └─> saveFlexTemplate()
       └─> 更新 flexTemplatesData
           └─> 顯示提示訊息

6. 儲存所有設定
   └─> saveAllFlexSettings()
       └─> 收集所有設定
       └─> POST /api/flex-templates
           └─> 寫入 flex-message-templates.json
           └─> notificationManager.loadFlexTemplates()
               └─> 重新載入範本

7. 實際發送提醒
   └─> [提醒管理頁面]
       └─> POST /api/reminders/:id/send
           └─> notificationManager.sendReminder()
               └─> 使用 Flex Template
               └─> replaceFlexVariables()
               └─> buildQuickReply()
               └─> sendLineMessage()
                   └─> LINE Messaging API
                       └─> 用戶收到訊息
```

---

## 📝 使用流程示範

### 情境 1: 編輯並測試 Flex Message

```
步驟 1: 從管理後台進入
  ├─> 點擊頂部「課程提醒完整管理」按鈕
  └─> 或點擊「提醒數」統計卡片

步驟 2: 切換到「訊息範本」標籤
  ├─> 勾選「啟用 Flex Message」
  └─> Flex Message 編輯器顯示

步驟 3: 選擇範本類型
  ├─> 選擇「當日提醒範本」
  └─> JSON 自動載入到編輯器

步驟 4: 編輯範本 (可選)
  ├─> 修改 JSON 內容
  ├─> 點擊「驗證 JSON」
  └─> 確認格式正確

步驟 5: 預覽效果
  ├─> 點擊「預覽 Flex Message」
  ├─> 查看視覺化預覽
  └─> 檢查變數摘要

步驟 6: 測試發送 ⭐
  ├─> 點擊「測試發送」按鈕
  ├─> 系統驗證 JSON
  ├─> 發送到管理員 LINE
  └─> 查看實際效果

步驟 7: 儲存範本
  ├─> 確認無誤後點擊「儲存此範本」
  └─> 或點擊「儲存所有 Flex Message 設定」

步驟 8: 設定 Quick Reply (可選)
  ├─> 向下滾動到 Quick Reply 區域
  ├─> 編輯回覆選項
  ├─> 設定請假原因
  └─> 點擊「儲存所有設定」

完成！現在實際發送提醒時會使用新的 Flex Message 範本。
```

### 情境 2: 發送實際提醒

```
步驟 1: 切換到「提醒管理」標籤
  └─> 查看提醒列表

步驟 2: 選擇要發送的提醒
  ├─> 可以先點擊「測試」按鈕測試
  └─> 管理員會收到測試訊息

步驟 3: 確認後正式發送
  ├─> 點擊「發送」按鈕
  └─> 訊息發送給實際收件人

步驟 4: 批量發送 (可選)
  ├─> 勾選多個提醒
  ├─> 點擊「批量發送」
  └─> 一次發送多個提醒
```

---

## 🎯 變數系統完整說明

### 支援的變數列表

```javascript
{
  // 基本資訊
  teacherName: '講師姓名',          // 講師名稱
  courseName: '課程名稱',            // 課程名稱
  courseTime: '15:30',              // 課程時間 (HH:MM)
  courseDate: '2025-10-22',         // 課程日期 (YYYY-MM-DD)
  location: '上課地點',              // 地點
  
  // 擴充資訊
  weekday: '週二',                   // 星期
  lessonPlanUrl: 'https://...',     // 教案連結
  googleMapsUrl: 'https://...',     // Google 地圖連結
  studentName: '學生姓名',           // 學生名稱 (學生提醒用)
  timeUntilClass: '45分鐘後',       // 距離上課時間 (課前提醒用)
  reminderTypeText: '當日',         // 提醒類型文字
  reminderId: 'abc123',             // 提醒ID
  description: '請攜帶作品資料',      // 描述
  systemName: '樂程坊課程系統'        // 系統名稱
}
```

### 在 Flex Message 中使用變數

```json
{
  "type": "bubble",
  "header": {
    "type": "box",
    "contents": [{
      "type": "text",
      "text": "📚 {reminderTypeText}課程提醒",
      "color": "#ffffff"
    }]
  },
  "body": {
    "type": "box",
    "contents": [
      {
        "type": "text",
        "text": "{teacherName} 講師",
        "weight": "bold"
      },
      {
        "type": "text",
        "text": "{courseName}"
      },
      {
        "type": "text",
        "text": "⏰ {courseTime}"
      },
      {
        "type": "text",
        "text": "📍 {location}"
      }
    ]
  }
}
```

---

## ✅ 完成檢查清單

### 前端 UI
- ✅ 導航入口 (admin-dashboard → course-reminder-management)
- ✅ 麵包屑導航
- ✅ 返回按鈕
- ✅ 頁面標題與功能標籤
- ✅ Flex Message 編輯器
- ✅ JSON 驗證功能
- ✅ 預覽功能
- ✅ 測試發送按鈕 ⭐
- ✅ Quick Reply 設定
- ✅ 變數說明面板
- ✅ 所有按鈕都有功能

### 後端 API
- ✅ GET /api/flex-templates
- ✅ POST /api/flex-templates
- ✅ POST /api/flex-templates/:type/send-test ⭐
- ✅ GET /api/reminders
- ✅ POST /api/reminders/:id/send
- ✅ POST /api/reminders/:id/send-test
- ✅ GET/POST /api/schedule-settings
- ✅ GET /api/scheduler-status
- ✅ 所有 API 都有對應前端

### JavaScript 函數
- ✅ loadFlexTemplates()
- ✅ validateFlexJson()
- ✅ previewFlexMessage()
- ✅ renderFlexMessagePreview()
- ✅ saveFlexTemplate()
- ✅ saveAllFlexSettings()
- ✅ sendTestFlexTemplate() ⭐
- ✅ 所有函數都已實現

### notification-manager.js
- ✅ loadFlexTemplates()
- ✅ replaceFlexVariables()
- ✅ buildQuickReply()
- ✅ sendTestMessage()
- ✅ sendLineMessage()
- ✅ 完整整合

### 資料持久化
- ✅ flex-message-templates.json (自動生成)
- ✅ 前後端同步機制
- ✅ 預設範本機制

---

## 🚀 啟動指南

### 1. 啟動伺服器
```bash
cd /path/to/flb-calendar-nas
node server.js
```

### 2. 訪問管理後台
```
http://localhost:3001/admin-dashboard.html
```

### 3. 前往課程提醒管理
方式 1: 點擊頂部「課程提醒完整管理」按鈕
方式 2: 點擊「提醒數」統計卡片
方式 3: 切換到「通知設定」標籤，點擊導航卡片
方式 4: 直接訪問 `http://localhost:3001/course-reminder-management.html`

### 4. 開始使用
- 編輯 Flex Message 範本
- 使用測試發送功能確認效果
- 儲存設定
- 發送實際提醒

---

## 📚 相關文件

- **完整功能報告**: `FLEX_FIX_REPORT.md`
- **部署指南**: `FLEX_MESSAGE_DEPLOYMENT_GUIDE.md`
- **計畫文件**: `.cursor/plans/flex-c37cfefb.plan.md`
- **前端**: `public/course-reminder-management.html`
- **後端**: `server.js`
- **通知管理**: `notification-manager.js`

---

**更新時間**: 2025-10-22  
**狀態**: ✅ 所有功能已完成並前後端完全對齊  
**版本**: 2.0

