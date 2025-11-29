# V2 學生 API - 完整功能對照文檔

> 本文檔記錄 V2 學生 API (`routes/v2-students.js`) 與原版 `perfect-calendar-modular.html` 的完整對齊情況

## ✅ 功能對照表

| 功能項目 | 原版 | V2 API | 狀態 |
|---------|------|--------|------|
| **資料完整性檢查** | ✅ | ✅ | ✅ 完全對齊 |
| **剩餘堂數篩選** | ✅ | ✅ | ✅ 完全對齊 |
| **智能持續顯示** | ✅ | ✅ | ✅ 完全對齊 |
| **出缺席狀態檢查** | ✅ | ✅ | ✅ 完全對齊 |
| **課程特殊事件** | ✅ | ✅ | ✅ 完全對齊 |
| **課程匹配（時間+星期+地點）** | ✅ | ✅ | ✅ 完全對齊 |

---

## 📋 詳細功能說明

### 1. 資料完整性檢查

**規則**：只保留有完整 `course` 和 `period` 的學生

**實現位置**：
- `routes/v2-students.js` 第111-116行

**測試結果**：
```
✅ 測試 1: 資料完整性檢查（必須有 course 和 period）
   結果: 2 / 4 位學生有完整資料
   ✅ 預期: 2 位（學生A, D）
   ✅ 通過
```

**程式碼**：
```javascript
let filteredStudents = students.filter(student => {
  const hasCourse = student.course && String(student.course).trim() !== '';
  const hasPeriod = student.period && String(student.period).trim() !== '';
  return hasCourse && hasPeriod;
});
```

---

### 2. 剩餘堂數篩選

**規則**：
- 從 `admin-dashboard.html` 讀取配置：`minRemainingClasses`（預設 1）
- 剩餘堂數 >= 最小堂數才顯示
- **例外**：補課學生 (`type: 'makeup'`) 和體驗學生 (`type: 'trial'`) 跳過檢查

**實現位置**：
- 配置讀取：`getStudentFilterConfig()` 第23-40行
- 篩選邏輯：第152-183行

**測試結果**：
```
✅ 測試 2: 剩餘堂數篩選（最小堂數 = 1）
   結果: 2 / 4 位學生通過
   ✅ 預期: 2 位（學生E, H）
   ✅ 通過
```

**程式碼**：
```javascript
const filterConfig = getStudentFilterConfig(); // { minRemainingClasses: 1 }
const isMakeupOrTrial = student.type === 'makeup' || student.type === 'trial';

if (filterConfig.enableRemainingCheck && !isMakeupOrTrial) {
  const remaining = parseInt(student.remaining) || 0;
  let hasRemainingClasses = remaining >= filterConfig.minRemainingClasses;
  // ...
}
```

---

### 3. 智能持續顯示

**規則**：
- 即使剩餘堂數 < 最小值，如果學生**一週內有簽到記錄**，仍然顯示
- 從 `admin-dashboard.html` 讀取配置：`showInCurrentWeek`（預設 `true`）

**實現位置**：
- 第158-177行

**測試結果**：
```
✅ 測試 3: 智能持續顯示（一週內有簽到記錄）
   結果: 1 / 2 位學生通過
   ✅ 預期: 1 位（學生I，7天內有簽到）
   ✅ 通過
```

**程式碼**：
```javascript
if (!hasRemainingClasses && filterConfig.showInCurrentWeek) {
  // 找出最後一次出席日期
  let lastAttendanceDate = student.lastAttendanceDate || student.last_attendance_date;
  if (!lastAttendanceDate && student.attendance && Array.isArray(student.attendance)) {
    const presentRecords = student.attendance.filter(record => record.present === true);
    if (presentRecords.length > 0) {
      presentRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
      lastAttendanceDate = presentRecords[0].date;
    }
  }
  if (lastAttendanceDate) {
    const attendanceDate = new Date(lastAttendanceDate);
    const now = new Date();
    const daysDiff = Math.floor((now - attendanceDate) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 7) {
      hasRemainingClasses = true; // ✅ 繼續顯示
      console.log(`   🎯 智能持續顯示: ${student.name} (上次簽到 ${daysDiff} 天前)`);
    }
  }
}
```

---

### 4. 出缺席狀態檢查

**規則**：
- 根據課程日期檢查學生當天的出缺席狀態
- 狀態：`present`（出席）、`leave`（請假）、`absent`（缺席）、`unknown`（未記錄）
- **請假或缺席時鎖定上傳** (`attendanceLocked: true`)

**實現位置**：
- 狀態檢查：`checkAttendanceStatus()` 第57-95行
- 應用邏輯：第243-255行

**測試結果**：
```
✅ 測試 4: 出缺席狀態檢查（請假/缺席鎖定上傳）
   結果: 2 位學生被鎖定
     ✅ 學生K: present (locked: false)
     🔒 學生L: leave (locked: true)
     🔒 學生M: absent (locked: true)
   ✅ 預期: 2 位學生被鎖定（學生L, M）
   ✅ 通過
```

**程式碼**：
```javascript
function checkAttendanceStatus(student, dateKey) {
  const records = Array.isArray(student.attendance) ? student.attendance : [];
  const matchedRecord = records.find(entry => {
    if (!entry || !entry.date) return false;
    const entryDate = new Date(entry.date).toISOString().split('T')[0];
    return entryDate === dateKey;
  });

  if (!matchedRecord) {
    return { status: 'unknown', locked: false };
  }

  const presentValue = matchedRecord.present;
  let status = 'unknown';

  if (presentValue === true) {
    status = 'present';
  } else if (presentValue === false) {
    status = 'absent';
  } else if (typeof presentValue === 'string') {
    const normalized = presentValue.toLowerCase();
    if (normalized === 'leave') {
      status = 'leave';
    } else if (normalized === 'absent' || normalized === 'absence') {
      status = 'absent';
    }
  }

  // 🔥 請假或缺席時鎖定上傳
  const locked = (status === 'leave' || status === 'absent');

  return { status, locked };
}
```

**返回格式**：
```javascript
{
  id: "student-1",
  name: "學生姓名",
  attendance: "leave",           // 出缺席狀態
  attendanceLocked: true,        // 是否被鎖定
  // ...
}
```

---

### 5. 課程特殊事件（停課檢查）

**規則**：
- 檢查課程標題是否包含停課關鍵字：`['停課', '取消', '暫停', '休息', '放假', '請假']`
- 若課程停課，**不返回任何學生**（停課不可上傳）

**實現位置**：
- 停課檢查：`isCourseSuspended()` 第45-49行
- 應用邏輯：第128-133行

**測試結果**：
```
✅ 測試 5: 課程特殊事件（停課不可上傳）
   ✅ "ESM 日 9:30-10:30 第8週" => false (預期: false)
   ✅ "[停課] ESM 日 9:30-10:30 第8週" => true (預期: true)
   ✅ "ESM 日 9:30-10:30 停課 第8週" => true (預期: true)
   ✅ "[取消] SPM 日 10:00-11:30" => true (預期: true)
   ✅ "SPIKE 日 10:00-12:00 暫停" => true (預期: true)
   ✅ 全部通過
```

**程式碼**：
```javascript
const SUSPENSION_KEYWORDS = ['停課', '取消', '暫停', '休息', '放假', '請假'];

function isCourseSuspended(courseTitle) {
  if (!courseTitle) return false;
  const titleUpper = courseTitle.toUpperCase();
  return SUSPENSION_KEYWORDS.some(keyword => titleUpper.includes(keyword.toUpperCase()));
}

// 應用
const isSuspended = isCourseSuspended(courseTitle);
if (isSuspended) {
  console.warn(`⛔ [V2 Students] 課程已停課，不返回學生:`, courseTitle);
  return []; // 停課時不返回任何學生
}
```

---

### 6. 課程匹配（時間+星期+地點）

**規則**：
- 使用 `StudentCourseMatcher.matchStudentsForEvent()` 進行精確匹配
- **課程名稱**：必須完全相同（ESM, SPM, SPIKE 等）
- **星期**：必須完全相同（日、一、二...）
- **時間**：開始時間差異 ≤ 10 分鐘，持續時間差異 ≤ 20 分鐘
- **地點**：智能匹配（到府/站所名稱）

**實現位置**：
- 第190-227行

**測試結果**：
```
✅ 測試 6: 課程匹配（時間+星期+地點）
   結果: 1 位學生匹配
     ✅ 學生N
   ✅ 預期: 1 位（學生N）
   ✅ 通過
```

**程式碼**：
```javascript
filteredStudents = StudentCourseMatcher.matchStudentsForEvent(
  event,
  filteredStudents,  // 使用已過濾的學生列表
  {
    withConfidence: true,        // 啟用信心度評分
    timeTolerance: 10,           // 開始時間容忍 10 分鐘
    durationTolerance: 20,       // 持續時間容忍 20 分鐘
    checkRemaining: false,       // 不檢查剩餘堂數（已在前面檢查）
    strictDateCheck: false       // 不嚴格檢查日期
  }
);
```

---

## 🔍 API 使用範例

### 請求

```http
GET /api/v2/students/courses/ESM%20%E6%97%A5%209:30-10:30%20%E7%AC%AC8%E9%80%B1/students
?courseTitle=ESM%20%E6%97%A5%209:30-10:30%20%E7%AC%AC8%E9%80%B1
```

### 回應

```json
{
  "success": true,
  "data": [
    {
      "id": "student-1",
      "name": "曹坤鎰 (Ivan）",
      "courseId": "ESM 日 9:30-10:30 第8週",
      "attendance": "present",        // ✅ 已出席
      "attendanceLocked": false,      // ✅ 未鎖定，可上傳
      "comment": "",
      "uploadStatus": {
        "photos": 0,
        "videos": 0,
        "completed": false
      },
      "metadata": {
        "course": "ESM",
        "period": "ESM 日 9:30-10:30",
        "remaining": 10
      }
    },
    {
      "id": "student-2",
      "name": "桐桐",
      "courseId": "ESM 日 9:30-10:30 第8週",
      "attendance": "leave",          // 🔒 請假
      "attendanceLocked": true,       // 🔒 已鎖定，不可上傳
      "comment": "",
      // ...
    }
  ],
  "message": "找到 6 位學生",
  "metadata": {
    "courseTitle": "ESM 日 9:30-10:30 第8週",
    "totalStudents": 96,
    "matchedStudents": 6,
    "hasEventMatch": true
  }
}
```

---

## 📊 日誌輸出範例

```
📊 [V2 Students] 資料完整性檢查: {
  原始學生數: 96,
  有完整資料: 90,
  被過濾掉: 6
}
⚙️ [V2 Students] 學生篩選配置: {
  debugMode: false,
  enableRemainingCheck: true,
  minRemainingClasses: 1,
  showInCurrentWeek: true
}
   🎯 智能持續顯示: 張三 (上次簽到 5 天前)
   ❌ 過濾學生: 李四 (剩餘堂數: 0 < 1)
✅ [V2 Students] 剩餘堂數篩選後: 85 位學生
📚 [V2 Students] 課程匹配: {
  courseTitle: 'ESM 日 9:30-10:30 第8週',
  parsed: 'ESM',
  weekday: '日',
  location: ''
}
   🔒 鎖定學生: 王五 (今日已請假)
✅ [V2 Students] 最終返回: 6 位學生
```

---

## ✅ 完整對齊確認

| 檢查項目 | 原版行為 | V2 API 行為 | 狀態 |
|---------|---------|------------|------|
| 資料完整性檢查 | 只顯示有 course 和 period 的學生 | ✅ 完全相同 | ✅ |
| 剩餘堂數篩選 | 從 admin-dashboard 讀取配置 | ✅ 完全相同 | ✅ |
| 智能持續顯示 | 一週內有簽到記錄仍顯示 | ✅ 完全相同 | ✅ |
| 補課/體驗學生 | 跳過剩餘堂數檢查 | ✅ 完全相同 | ✅ |
| 出缺席狀態 | 檢查當天記錄 | ✅ 完全相同 | ✅ |
| 請假/缺席鎖定 | 鎖定上傳功能 | ✅ 完全相同 | ✅ |
| 停課檢查 | 停課時不返回學生 | ✅ 完全相同 | ✅ |
| 課程匹配 | 時間+星期+地點匹配 | ✅ 完全相同 | ✅ |
| 匹配容忍度 | 時間 ±10分，持續 ±20分 | ✅ 完全相同 | ✅ |

---

## 🧪 測試驗證

執行完整測試：
```bash
node tests/test-v2-students-complete.js
```

**測試結果**：
```
📊 測試結果: 6 / 6 通過

🎉 恭喜！所有測試通過！

✅ 已驗證功能：
   1. ✅ 資料完整性檢查（course + period）
   2. ✅ 剩餘堂數篩選
   3. ✅ 智能持續顯示（一週內有簽到記錄）
   4. ✅ 出缺席狀態檢查（請假/缺席鎖定）
   5. ✅ 課程特殊事件（停課檢查）
   6. ✅ 課程匹配（時間+星期+地點）

💡 V2 學生 API 與原版 perfect-calendar-modular.html 完全對齊！
```

---

## 📝 總結

✅ **V2 學生 API 已完整實現原版所有學生篩選邏輯**

所有功能已通過自動化測試驗證，與 `perfect-calendar-modular.html` 和 `admin-dashboard.html` 的行為完全一致。

**實現文件**：
- 主要邏輯：`routes/v2-students.js`
- 測試腳本：`tests/test-v2-students-complete.js`
- 本文檔：`docs/V2-STUDENTS-API-COMPLETE.md`

**最後更新**：2025-11-23
