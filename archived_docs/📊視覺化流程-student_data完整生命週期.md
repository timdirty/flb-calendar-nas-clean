# 📊 視覺化流程 - student_data.json 完整生命週期

## 🔄 完整資料流程圖

```
┌─────────────────────────────────────────────────────────────┐
│                    Google Sheets (主資料庫)                   │
│  - 學生基本資料                                              │
│  - 出席記錄                                                  │
│  - 請假狀態                                                  │
└────────────────┬────────────────────────────────────────────┘
                 ↓
         每 5 分鐘自動同步
         (包含 Midnight Cleanup)
                 ↓
┌─────────────────────────────────────────────────────────────┐
│               後端服務器 (server.js)                          │
│  updateStudentDataFromGoogleSheets()                        │
│  - 調用 Google Sheets API                                  │
│  - 解析學生資料                                             │
│  - 覆蓋寫入檔案                                             │
└────────────────┬────────────────────────────────────────────┘
                 ↓
         寫入本地檔案
                 ↓
┌─────────────────────────────────────────────────────────────┐
│            public/student_data.json                         │
│  {                                                          │
│    "students": [...],                                       │
│    "lastUpdated": "2025-10-17T08:13:40.099Z"               │
│  }                                                          │
└────────┬─────────────────────────────┬──────────────────────┘
         ↓                             ↓
    ┌────────────┐              ┌─────────────┐
    │  系統 1    │              │   系統 2    │
    │ 學生提醒    │              │  課程管理   │
    └────┬───────┘              └──────┬──────┘
         ↓                             ↓
    [唯讀模式]                     [讀寫模式]
         ↓                             ↓
         │                             │
         │                      ┌──────┴──────┐
         │                      ↓             ↓
         │              [讀取最新資料]  [更新簽到記錄]
         │                      ↓             ↓
         │              顯示學生名單    POST /api/update-
         │              統計出席人數    student-attendance
         │                      ↓             ↓
         ↓                      │      ┌──────┴──────┐
   檢查請假狀態                 │      ↓             ↓
         ↓                      │  更新本地檔  更新 Google
   跳過請假學生                 │      ↓        Sheets
         ↓                      │      │             ↓
   生成學生提醒                 │      │             │
         ↓                      │      └──────┬──────┘
   19:30 發送 LINE              │             ↓
         ↓                      └──────→  雙向同步
    [完成]                                    ↓
                                          [完成]
```

---

## ⏰ 時間線視覺化（24 小時循環）

```
00:00 ┃ 🌅 Midnight Cleanup
      ┃    ├─ 清空所有提醒
      ┃    ├─ 更新 student_data.json ✅
      ┃    └─ 重新生成所有提醒
      ┃
00:05 ┃ 🔄 排程執行
      ┃    ├─ 更新 student_data.json ✅
      ┃    ├─ 生成學生提醒
      ┃    └─ 檢查請假，跳過提醒
      ┃
00:10 ┃ 🔄 排程執行
      ┃    └─ 同上
      ┃
...   ┃ 🔄 每 5 分鐘重複
      ┃    └─ 持續更新 student_data.json ✅
      ┃
08:00 ┃ 🔔 發送今日提醒（給講師）
      ┃
09:00 ┃ 📅 講師開始使用課程管理系統
      ┃    ├─ 點擊課程
      ┃    ├─ 讀取 student_data.json (no-cache)
      ┃    ├─ 顯示學生名單
      ┃    └─ 學生簽到 → 即時更新檔案 + Google Sheets
      ┃
...   ┃ 🔄 每 5 分鐘持續更新
      ┃
19:30 ┃ 👨‍🎓 發送學生提醒時段 (19:30-19:35)
      ┃    ├─ 載入待發送的學生提醒
      ┃    ├─ 檢查請假狀態（最新資料）
      ┃    ├─ 發送 LINE 通知給家長
      ┃    └─ 標記為已發送
      ┃
...   ┃ 🔄 繼續每 5 分鐘更新
      ┃
23:55 ┃ 🔄 最後一次檢查
      ┃    ├─ 更新 student_data.json ✅
      ┃    └─ 生成提醒
      ┃
24:00 ┃ 🌅 新的一天開始（回到 00:00）
```

---

## 🎬 場景流程圖

### 場景 A：學生請假流程

```
步驟 1: 家長在 Google Sheets 標記請假
        ↓
     "2025-10-18": "leave"
        ↓
        
步驟 2: 後端自動同步（最多 5 分鐘）
        ↓
   排程器執行
        ↓
   updateStudentDataFromGoogleSheets()
        ↓
   更新 student_data.json
        ↓
   {
     "attendance": [
       { "date": "2025-10-18", "present": "leave" }
     ]
   }
        ↓
        
步驟 3: 系統 1 檢測（生成提醒時）
        ↓
   generateStudentReminders()
        ↓
   遍歷明天的課程
        ↓
   檢查學生請假狀態
        ↓
   if (attendance[courseDate] === 'leave') {
     ❌ 跳過該學生
   }
        ↓
   結果: 該學生不會收到 LINE 提醒 ✅
        ↓
        
步驟 4: 系統 2 顯示（講師查看時）
        ↓
   點擊課程
        ↓
   loadCourseStudents()
        ↓
   顯示學生名單（標記請假）
        ↓
   統計出席人數（扣除請假學生）
        ↓
   結果: 行事曆上人數減少 ✅
```

### 場景 B：講師簽到流程

```
步驟 1: 講師點擊課程（系統 2）
        ↓
   fetch('/student_data.json', { cache: 'no-cache' })
        ↓
   顯示學生名單
        ↓
   [小明] [簽到按鈕]
   [小華] [簽到按鈕]
        ↓
        
步驟 2: 點擊簽到按鈕
        ↓
   updateStudentDataJson('小明', 'present')
        ↓
   POST /api/update-student-attendance
   {
     "studentName": "小明",
     "date": "2025-10-17",
     "present": true
   }
        ↓
        
步驟 3: 後端雙向更新
        ↓
   ┌──────────────┬──────────────┐
   ↓              ↓              ↓
更新檔案         更新 Google   前端顯示
student_data.json  Sheets       ✅ 已簽到
   ↓              ↓
即時寫入         同步更新
   ↓              ↓
   └──────────────┴──────────────┘
        ↓
        
步驟 4: 下次排程讀取（最多 5 分鐘）
        ↓
   系統 1 讀取最新資料
        ↓
   統計中包含小明的出席記錄 ✅
        ↓
   結果: 資料完全同步 ✅
```

### 場景 C：生成並發送學生提醒

```
時間: 2025-10-17 19:30（課程前一天）
        ↓
        
步驟 1: 排程器執行
        ↓
   generateStudentReminders()
        ↓
   載入 student_data.json
        ↓
   獲取明天（2025-10-18）的課程
        ↓
   
步驟 2: 遍歷課程事件
        ↓
   課程: "SPIKE 六 16:00-18:00 第4週"
        ↓
   檢查 1: 標題包含跳過關鍵字？
        ↓
   ❌ 沒有 "停課" 或 "請假" → 繼續
        ↓
   
步驟 3: 尋找匹配的學生
        ↓
   過濾條件:
   - course: "SPIKE"
   - period: "六 1600-1800"
        ↓
   找到學生:
   - 小明 (userId: U123...)
   - 小華 (userId: U456...)
   - 小強 (userId: "") ❌ 沒有 LINE ID，跳過
        ↓
   
步驟 4: 檢查個別請假狀態
        ↓
   ┌─────────┬─────────┐
   ↓         ↓         ↓
  小明       小華      小強
   ↓         ↓         ↓
attendance  attendance 無 LINE ID
2025-10-18  2025-10-18  ❌ 跳過
"leave"     true
   ↓         ↓
 ❌ 請假    ✅ 正常
 跳過       創建提醒
            ↓
            
步驟 5: 創建提醒
        ↓
   createStudentReminder(小華, event)
        ↓
   {
     "id": "student_xxx",
     "studentName": "小華",
     "parentUserId": "U456...",
     "courseName": "SPIKE 六 16:00-18:00 第4週",
     "courseDate": "2025-10-18",
     "scheduledTime": "2025-10-17T11:30:00.000Z",
     "status": "pending"
   }
        ↓
        
步驟 6: 等待發送時間（19:30）
        ↓
   processStudentReminders()
        ↓
   發送 LINE 訊息給 U456...
        ↓
   👋 您好！
   📚 課程提醒通知
   📖 課程：SPIKE 六 16:00-18:00 第4週
   📅 日期：2025年10月18日 星期六
   ⏰ 時間：16:00
   ...
        ↓
        
步驟 7: 標記已發送
        ↓
   reminder.status = 'sent'
   reminder.sentAt = "2025-10-17T11:30:15.000Z"
        ↓
   結果: 小華家長收到提醒 ✅
         小明家長未收到（請假）✅
         小強家長未收到（無 LINE ID）✅
```

---

## 🔍 系統 1 vs 系統 2 詳細對比

```
┌─────────────────────────────────────────────────────────┐
│              系統 1：學生提醒系統                         │
│         (course-reminder-management.html)               │
└─────────────────────────────────────────────────────────┘

讀取方式:
   GET /api/students
      ↓
   server.js 讀取 student_data.json
      ↓
   返回 students 陣列

使用欄位:
   ✓ name        → 匹配學生
   ✓ course      → 匹配課程類型
   ✓ period      → 匹配上課時段
   ✓ userId      → 發送 LINE 通知
   ✓ attendance  → 檢查請假狀態

處理邏輯:
   if (標題包含 "停課" 或 "請假") {
     ❌ 跳過整個課程
   }
   
   for each student {
     if (attendance[date] === false || "leave") {
       ❌ 跳過該學生
     } else if (userId === "") {
       ❌ 沒有 LINE ID，跳過
     } else {
       ✅ 創建提醒
     }
   }

輸出結果:
   → 學生提醒列表（待發送）
   → 19:30 發送 LINE 通知

──────────────────────────────────────────────────────────

┌─────────────────────────────────────────────────────────┐
│              系統 2：課程管理系統                         │
│      (perfect-calendar-optimized-complete2.html)        │
└─────────────────────────────────────────────────────────┘

讀取方式:
   GET /student_data.json (no-cache)
      ↓
   直接讀取完整 JSON
      ↓
   前端自己解析 students

使用欄位:
   ✓ name        → 顯示學生姓名
   ✓ course      → 過濾課程
   ✓ period      → 過濾時段
   ✓ remaining   → 顯示剩餘堂數
   ✓ attendance  → 顯示出席記錄 + 統計人數

處理邏輯:
   // 載入學生名單
   const filteredStudents = students.filter(s => {
     return s.course === course && 
            s.period.includes(time) &&
            s.remaining >= 0;  // 允許 0 堂課的學生
   });
   
   // 統計今天出席人數
   const attendedToday = filteredStudents.filter(s => {
     const todayRecord = s.attendance.find(a => 
       a.date === today
     );
     return todayRecord && todayRecord.present === true;
   }).length;

寫入功能:
   用戶點擊簽到
      ↓
   POST /api/update-student-attendance
   {
     "studentName": "小明",
     "date": "2025-10-17",
     "present": true
   }
      ↓
   server.js 更新 student_data.json
      ↓
   同時更新 Google Sheets

輸出結果:
   → 顯示學生名單（包含剩餘堂數）
   → 顯示簽到狀態
   → 統計出席人數
   → 行事曆上顯示人數
```

---

## ✅ 總結：完整生命週期

```
1. 📥 資料來源
   Google Sheets (主資料庫)
   
2. 🔄 自動同步（每 5 分鐘）
   updateStudentDataFromGoogleSheets()
   → 覆蓋 student_data.json
   
3. 📖 系統 1 讀取（唯讀）
   GET /api/students
   → 檢查請假
   → 生成提醒
   → 發送 LINE
   
4. 📖 系統 2 讀取（互動）
   GET /student_data.json (no-cache)
   → 顯示名單
   → 管理簽到
   → 統計人數
   
5. 💾 系統 2 寫入
   POST /api/update-student-attendance
   → 更新 student_data.json
   → 同步 Google Sheets
   
6. 🔁 循環重複
   每 5 分鐘重新同步
   → 確保資料永遠最新
```

**關鍵特點**：
- ✅ 自動化：後端每 5 分鐘自動同步
- ✅ 雙向同步：簽到即時更新到 Google Sheets
- ✅ 防重複：系統 1 已修復重複創建問題
- ✅ 即時性：系統 2 使用 no-cache 確保最新
- ✅ 請假檢查：雙重機制（行事曆 + 學生個別）

---

**文件建立者**：AI Assistant  
**建立時間**：2025-10-17  
**版本**：v1.0

