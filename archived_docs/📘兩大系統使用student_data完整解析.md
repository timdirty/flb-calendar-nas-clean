# 📘 兩大系統使用 student_data.json 完整解析

**文件日期：** 2025-10-17  
**系統版本：** v1.0

---

## 🎯 系統概覽

### 系統 1：學生提醒系統
**檔案**：`course-reminder-management.html`  
**用途**：自動生成並發送學生家長提醒（LINE 通知）

### 系統 2：課程管理系統
**檔案**：`perfect-calendar-optimized-complete2.html`  
**用途**：課程行事曆、學生簽到管理、出席統計

---

## 📊 student_data.json 資料結構

```json
{
  "success": true,
  "count": 85,
  "students": [
    {
      "name": "學生姓名",
      "course": "SPIKE",
      "period": "六 1600-1800",
      "userId": "LINE User ID",
      "remaining": 15,
      "attendance": [
        {
          "date": "2025-10-17",
          "present": true        // true=出席, false=缺席, "leave"=請假
        }
      ]
    }
  ],
  "lastUpdated": "2025-10-17T08:13:40.099Z",
  "updateNote": "最後更新時間: 2025/10/17 下午4:13:40"
}
```

**關鍵欄位說明**：
- `name`: 學生姓名
- `course`: 課程類型（SPIKE、BOOST、SPM、ESM 等）
- `period`: 上課時段（用於匹配行事曆）
- `userId`: LINE User ID（用於發送提醒）
- `remaining`: 剩餘堂數
- `attendance`: 出席記錄陣列

---

## 🔄 資料更新機制（後端自動）

### 時間軸（參考您提供的圖片）

```
時間        事件                          說明
────────────────────────────────────────────────────
00:00    🌅 Midnight Cleanup          清理 + 更新資料 + 重新生成
00:05    🔄 更新 + 生成                更新 student_data.json
00:10    🔄 更新 + 生成                更新 student_data.json
...      每 5 分鐘重複                 持續更新
19:30    👨‍🎓 發送學生提醒            發送給家長
23:55    🔄 更新 + 生成                最後一次檢查
00:00    🌅 新一天開始                 重新整理
```

### 更新來源

**主要來源**：Google Sheets API  
**更新頻率**：每 5 分鐘 + Midnight Cleanup

**程式碼位置**：
- `server.js` → `updateStudentDataFromGoogleSheets()` (第 279 行)
- `reminder-scheduler.js` → `updateStudentData()` (第 2466 行)

**更新流程**：
```
每 5 分鐘 / Midnight Cleanup
  ↓
調用 Google Sheets API
  ↓
獲取最新學生資料（包含出席記錄）
  ↓
覆蓋寫入 public/student_data.json
  ↓
前端系統可讀取最新資料
```

---

## 📱 系統 1：學生提醒系統 (course-reminder-management.html)

### 🎯 使用目的

生成並發送學生家長提醒（明天的課程通知）

### 📖 讀取方式

**API 端點**：`GET /api/students`

```javascript
// course-reminder-management.html (第 3542 行)
async function loadStudents() {
    const response = await fetch('/api/students');
    const data = await response.json();
    students = data.data || [];  // 獲取學生陣列
}
```

**後端處理**：
```javascript
// server.js (第 3672 行)
app.get('/api/students', (req, res) => {
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
    
    res.json({
        success: true,
        data: studentData.students || []  // 返回學生陣列
    });
});
```

### 📋 使用場景

#### 1️⃣ 生成學生提醒（每 5 分鐘檢查）

**時機**：課程前一天

**程式碼位置**：`reminder-scheduler.js` → `generateStudentReminders()` (第 1615 行)

**流程**：
```javascript
// 1. 載入學生資料
const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
const students = studentData.students || [];

// 2. 遍歷明天的課程
for (const event of tomorrowEvents) {
    // 3. 檢查是否包含跳過關鍵字
    if (event.title.includes('停課') || event.title.includes('請假')) {
        continue; // ❌ 跳過整個課程
    }
    
    // 4. 尋找匹配的學生
    const matchedStudents = this.findMatchingStudents(students, event);
    
    // 5. 為每個學生檢查請假狀態
    for (const student of matchedStudents) {
        // ⭐ 檢查 attendance 欄位
        if (student.attendance && student.attendance[courseDate] === false) {
            console.log(`❌ 學生 ${student.name} 請假，跳過`);
            continue; // ❌ 跳過該學生
        }
        
        if (student.attendance && student.attendance[courseDate] === 'leave') {
            console.log(`❌ 學生 ${student.name} 請假，跳過`);
            continue; // ❌ 跳過該學生
        }
        
        // ✅ 創建學生提醒
        const reminder = await this.createStudentReminder(student, event);
        newStudentReminders.push(reminder);
    }
}
```

#### 2️⃣ 發送學生提醒（每天 19:30）

**時機**：每天 19:30-19:35

**程式碼位置**：`reminder-scheduler.js` → `processStudentReminders()` (第 1490 行)

**流程**：
```javascript
// 1. 載入待發送的學生提醒
const pendingStudentReminders = studentReminders.filter(r => 
    r.status === 'pending' && 
    new Date(r.scheduledTime) <= now
);

// 2. 發送 LINE 訊息給家長
for (const reminder of pendingStudentReminders) {
    await this.sendLineMessage(reminder.parentUserId, reminder.message);
    
    // 3. 標記為已發送
    reminder.status = 'sent';
    reminder.sentAt = new Date().toISOString();
}
```

### ✅ 系統 1 總結

| 項目 | 說明 |
|------|------|
| **讀取方式** | API `/api/students` |
| **讀取頻率** | 每 5 分鐘（生成提醒時） |
| **使用欄位** | `name`, `course`, `period`, `userId`, `attendance` |
| **主要功能** | 檢查請假狀態，決定是否發送提醒 |
| **寫入** | ❌ 不寫入（唯讀） |

---

## 📅 系統 2：課程管理系統 (perfect-calendar-optimized-complete2.html)

### 🎯 使用目的

1. 顯示學生名單
2. 管理學生簽到
3. 統計出席人數

### 📖 讀取方式

**直接讀取檔案**：`/student_data.json`

```javascript
// perfect-calendar-optimized-complete2.html (第 18441 行)
async function loadCourseStudents() {
    // 🔥 加上 no-cache 確保獲取最新資料
    const response = await fetch('/student_data.json', {
        cache: 'no-cache',
        headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    });
    
    const studentData = await response.json();
    const students = studentData.students;
    
    // 過濾符合課程和時間的學生
    const filteredStudents = students.filter(student => {
        const courseMatch = student.course === course;
        const timeMatch = student.period.includes(time);
        return courseMatch && timeMatch;
    });
}
```

### 📋 使用場景

#### 1️⃣ 載入學生名單（點擊課程時）

**時機**：點擊行事曆上的課程

**程式碼位置**：`loadCourseStudents()` (第 18418 行)

**流程**：
```
用戶點擊課程
  ↓
載入 student_data.json (no-cache)
  ↓
過濾符合課程+時間的學生
  ↓
顯示學生名單（包含剩餘堂數）
  ↓
顯示簽到按鈕
```

#### 2️⃣ 統計出席人數（顯示在行事曆上）

**時機**：渲染行事曆事件時

**程式碼位置**：計算學生人數 (第 16477 行)

**流程**：
```javascript
// 1. 載入最新學生資料
const response = await fetch('/student_data.json', { cache: 'no-cache' });
const studentData = await response.json();

// 2. 計算今天實際出席的學生人數
const today = new Date().toISOString().split('T')[0];

// 3. 遍歷學生的 attendance 陣列
const attendedStudents = studentData.students.filter(student => {
    // 檢查課程和時間匹配
    const courseMatch = student.course === currentCourse;
    const timeMatch = student.period === currentTime;
    
    if (!courseMatch || !timeMatch) return false;
    
    // ⭐ 檢查今天的 attendance 記錄
    const todayAttendance = student.attendance.find(a => a.date === today);
    return todayAttendance && todayAttendance.present === true;
});

// 4. 顯示人數
studentCount = attendedStudents.length;
```

#### 3️⃣ 更新簽到記錄（學生簽到時）

**時機**：點擊簽到按鈕

**程式碼位置**：`updateStudentDataJson()` (第 19314 行)

**流程**：
```javascript
// 1. 發送請求到後端
async function updateStudentDataJson(studentName, status) {
    const today = new Date().toISOString().split('T')[0];
    
    const response = await fetch('/api/update-student-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            studentName: studentName,
            date: today,
            present: status === 'present' ? true : false
        })
    });
    
    return await response.json();
}

// 2. 同時更新 Google Sheets 和 student_data.json
const [jsonResult, sheetsResult] = await Promise.allSettled([
    updateStudentDataJson(studentName, status),
    updateGoogleSheets(studentName, status)
]);
```

**後端處理**：
```javascript
// server.js (第 1914 行)
app.post('/api/update-student-attendance', async (req, res) => {
    const { studentName, date, present } = req.body;
    
    // 1. 讀取 student_data.json
    const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
    
    // 2. 找到學生
    const student = studentData.students.find(s => s.name === studentName);
    
    // 3. 更新 attendance 陣列
    const existingRecord = student.attendance.find(a => a.date === date);
    if (existingRecord) {
        existingRecord.present = present;  // 更新現有記錄
    } else {
        student.attendance.push({ date, present });  // 新增記錄
    }
    
    // 4. 寫入檔案
    fs.writeFileSync(studentDataPath, JSON.stringify(studentData, null, 2));
    
    res.json({ success: true });
});
```

### ✅ 系統 2 總結

| 項目 | 說明 |
|------|------|
| **讀取方式** | 直接讀取 `/student_data.json` |
| **讀取頻率** | 每次點擊課程時（with no-cache） |
| **使用欄位** | `name`, `course`, `period`, `remaining`, `attendance` |
| **主要功能** | 顯示學生名單、管理簽到、統計出席 |
| **寫入** | ✅ 可寫入（更新 `attendance` 欄位） |

---

## 🔄 完整資料流程圖

```
Google Sheets (主資料庫)
        ↓ 每 5 分鐘
[後端自動同步] server.js
        ↓
public/student_data.json
        ↓
    ┌───────┴───────┐
    ↓               ↓
[系統1]         [系統2]
學生提醒系統    課程管理系統
    ↓               ↓
讀取（唯讀）    讀取 + 寫入
    ↓               ↓
檢查請假狀態    管理簽到記錄
    ↓               ↓
生成提醒        更新 attendance
    ↓               ↓
發送 LINE       回寫到檔案 + Google Sheets
```

---

## ⏰ 附圖說明：更新時機

### 您提供的圖片顯示的排程：

```
00:00 🌅 Midnight Cleanup
      → 清理所有提醒
      → 更新 student_data.json ✅
      → 重新生成提醒

00:05 🔄 更新 + 生成
      → 更新 student_data.json ✅
      → 生成學生提醒
      → 檢查請假，跳過提醒

00:10 🔄 更新 + 生成
      → 更新 student_data.json ✅
      → 生成學生提醒
      → 檢查請假，跳過提醒

...   每 5 分鐘重複
      → 持續更新 student_data.json ✅

19:30 👨‍🎓 發送學生提醒
      → 發送給家長

23:55 🔄 更新 + 生成
      → 最後一次檢查
```

**是的！圖中的「更新」指的是**：
1. ✅ **重新更新行事曆資料**（從 CalDAV）
2. ✅ **重新更新 student_data.json**（從 Google Sheets）
3. ✅ **重新生成提醒**（基於最新資料）

---

## 📊 兩系統對比表

| 項目 | 系統 1：學生提醒 | 系統 2：課程管理 |
|------|-----------------|-----------------|
| **檔案** | course-reminder-management.html | perfect-calendar-optimized-complete2.html |
| **讀取方式** | API `/api/students` | 直接讀取 `/student_data.json` |
| **快取策略** | 無（後端每次讀檔） | `no-cache`（強制最新） |
| **讀取時機** | 每 5 分鐘（生成提醒時） | 每次點擊課程時 |
| **使用欄位** | name, course, period, userId, attendance | name, course, period, remaining, attendance |
| **主要用途** | 檢查請假，決定是否提醒 | 顯示名單，管理簽到 |
| **寫入功能** | ❌ 不寫入（唯讀） | ✅ 可寫入（更新 attendance） |
| **更新來源** | 後端自動（Google Sheets） | 手動簽到 + 後端自動 |

---

## 🔧 關鍵差異

### 讀取方式差異

**系統 1（學生提醒）**：
```javascript
// 透過 API 讀取
fetch('/api/students')
  ↓
server.js 讀取檔案
  ↓
返回 students 陣列
```

**系統 2（課程管理）**：
```javascript
// 直接讀取檔案
fetch('/student_data.json', { cache: 'no-cache' })
  ↓
直接獲取完整 JSON
  ↓
自己解析 students 陣列
```

### 為什麼系統 2 不用 API？

1. **效能考量**：避免額外的後端處理
2. **即時性**：直接讀取檔案，減少延遲
3. **no-cache 強制最新**：每次都獲取最新資料

---

## ✅ 總結

### 關鍵重點

1. **student_data.json 是核心資料檔**
   - 由後端每 5 分鐘自動更新（從 Google Sheets）
   - Midnight Cleanup 時完整重新載入

2. **系統 1（學生提醒）**
   - **唯讀**：只檢查 `attendance` 決定是否發送提醒
   - **自動化**：每 5 分鐘檢查，19:30 發送

3. **系統 2（課程管理）**
   - **讀寫**：顯示學生名單 + 更新簽到記錄
   - **互動性**：用戶點擊簽到，立即更新

4. **雙向同步**
   - Google Sheets → student_data.json（後端自動，每 5 分鐘）
   - 用戶簽到 → student_data.json + Google Sheets（即時寫入）

5. **請假機制**
   - 在 Google Sheets 更新請假狀態
   - 最多 5 分鐘後同步到 student_data.json
   - 系統 1 自動跳過請假學生的提醒

---

**文件建立者**：AI Assistant  
**建立時間**：2025-10-17  
**版本**：v1.0

