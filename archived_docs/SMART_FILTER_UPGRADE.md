# 🎯 學生篩選器智能升級說明 (v2.2.0)

## 📅 更新日期
2025-10-21

## 🎯 升級目的
解決 API 回傳數據中 `course` 欄位與 `period` 欄位不一致的問題，讓篩選器能更智能地匹配學生。

---

## 🔍 問題描述

### 問題 1: 課程名稱不一致
**API 數據結構：**
```json
{
    "name": "陳杰睿",
    "course": "SPIKE",                    // ⚠️ 只有 "SPIKE"
    "period": "SPIKE PRO 日 10:00-12:00"  // ⚠️ 但這裡是 "SPIKE PRO"
}
```

**舊版篩選器行為：**
```javascript
// 呼叫：filterStudentsByCourseAndTime(students, "SPIKE PRO", "日 10:00-12:00")
// 結果：❌ 匹配失敗（因為 "SPIKE" !== "SPIKE PRO"）
```

### 問題 2: 時段字串包含課程名稱
**API 數據結構：**
```json
{
    "course": "Minecraft",
    "period": "MINECRAFT 二 11:00-12:00"  // period 包含課程名稱前綴
}
```

**舊版篩選器行為：**
```javascript
// 呼叫：filterStudentsByCourseAndTime(students, "Minecraft", "二 11:00-12:00")
// 結果：❌ 時間匹配失敗（因為 "MINECRAFT二11:00-12:00" !== "二11:00-12:00"）
```

---

## ✨ 升級內容

### 1. 智能課程匹配（三層匹配機制）

#### **方法 1: 直接比對 `student.course`**
```javascript
normalizedStudentCourse === normalizedCourse
// 例: "spike" === "spike" → ✅
```

#### **方法 2: 檢查 `student.period` 前綴**
```javascript
student.period.startsWith(course)
// 例: "SPIKE PRO 日 10:00" 以 "SPIKE PRO" 開頭 → ✅
```

#### **方法 3: 反向檢查（處理 SPIKE vs SPIKE PRO）**
```javascript
// student.course="SPIKE", period="SPIKE PRO 日 10:00", 目標="SPIKE PRO"
if (period.startsWith(course) && course.startsWith(student.course)) {
    // ✅ 匹配成功
}
```

### 2. 智能時間匹配（自動移除課程名稱前綴）

**新增 `extractBaseTime()` 前置處理：**
```javascript
// 輸入: "SPIKE PRO 日 10:00-12:00"
// 步驟1: 移除開頭的英文、數字、空格 → "日 10:00-12:00"
// 步驟2: 移除週次 → "日 10:00-12:00"
// 步驟3: 移除特殊事件關鍵字 → "日 10:00-12:00"
// 輸出: "日1000-1200" (標準化後)
```

**正則表達式：**
```javascript
result = result.replace(/^[A-Za-z0-9\s]+?(?=[一二三四五六日\d]|$)/, '').trim();
```

### 3. 增強調試信息

**新版調試輸出：**
```javascript
console.log(`🔍 詳細比對: ${student.name}`, {
    course: {
        target: "SPIKE PRO",
        studentCourse: "SPIKE",
        match: true  // ✅ 智能匹配成功
    },
    time: {
        target: "日 10:00-12:00",
        studentPeriod: "SPIKE PRO 日 10:00-12:00",
        base: {
            student: "日1000-1200",
            target: "日1000-1200"
        },
        match: true  // ✅ 時間匹配成功
    }
});
```

---

## 📊 測試案例

### ✅ 測試 1: SPIKE PRO 課程
```javascript
await filterStudentsByCourseAndTime(students, "SPIKE PRO", "日 10:00-12:00");

// 預期結果：找到 2 位學生
// ✅ 陳杰睿 (course: "SPIKE", period: "SPIKE PRO 日 10:00-12:00")
// ✅ 顏世餘 (course: "SPIKE", period: "SPIKE PRO 日 10:00-12:00")
```

### ✅ 測試 2: Minecraft 課程
```javascript
await filterStudentsByCourseAndTime(students, "Minecraft", "二 11:00-12:00");

// 預期結果：找到 3 位學生
// ✅ a1123 (period: "MINECRAFT 二 11:00-12:00")
// ✅ b (period: "MINECRAFT 二 11:00-12:00")
// ✅ c (period: "MINECRAFT 二 11:00-12:00")
```

### ❌ 測試 3: period 為空
```javascript
// 學生: { name: "李霽 JI", course: "Minecraft", period: "" }
await filterStudentsByCourseAndTime(students, "Minecraft", "任意時段");

// 預期結果：不會找到
// ❌ 李霽 JI (period 為空，無法時間匹配)
```

### ❌ 測試 4: 負數剩餘堂數
```javascript
// 學生: { name: "Meow", remaining: -0.5 }
await filterStudentsByCourseAndTime(students, "SPM", "三1630-1730 到府");

// 預期結果：不會找到
// ❌ Meow (remaining < 0，被過濾)
```

---

## 🎨 使用方式

### 基本調用
```javascript
const students = await filterStudentsByCourseAndTime(
    allStudents,
    "SPIKE PRO",      // 課程名稱（會自動匹配 course 或 period）
    "日 10:00-12:00"  // 時間段（會自動移除 period 中的課程名稱前綴）
);
```

### 帶配置調用
```javascript
const students = await filterStudentsByCourseAndTime(
    allStudents,
    "SPIKE PRO",
    "日 10:00-12:00",
    {
        debugMode: true,              // 啟用詳細日誌
        minRemainingClasses: 1,       // 最小剩餘堂數
        enableRemainingCheck: true,   // 啟用堂數檢查
        showInCurrentWeek: true,      // 當週豁免低堂數
        courseDate: new Date()        // 課程日期
    }
);
```

---

## 🧪 測試頁面

開啟瀏覽器訪問：
```
http://localhost:3000/test-smart-filter.html
```

測試頁面會自動執行以下測試：
1. ✅ SPIKE PRO 課程（智能課程匹配）
2. ✅ Minecraft 課程（智能時間匹配）
3. ✅ period 為空的處理
4. ✅ 負數剩餘堂數過濾
5. ✅ ESM 課程匹配
6. ✅ BOOST 課程（類似時段）

---

## 🔄 相容性

### ✅ 完全向下相容
- 舊版調用方式依然有效
- 新版增加智能匹配，不影響原有功能
- 所有配置參數保持一致

### 📦 影響的檔案
- ✅ `public/js/student-filter.js` (v2.2.0)
- ✅ `public/perfect-calendar-optimized-complete2.html` (使用此模組)
- ✅ `public/learning-record-upload.html` (使用此模組)

---

## 📝 版本歷史

### v2.2.0 (2025-10-21)
- 🎯 新增智能課程匹配（三層匹配機制）
- 🎯 新增智能時間匹配（自動移除課程名稱前綴）
- 📊 增強調試信息輸出
- 🧪 新增 test-smart-filter.html 測試頁面

### v2.1.0 (2025-10-19)
- 🎯 當週持續顯示低堂數學生功能
- 🔥 從後端獲取特殊事件關鍵字

### v2.0.0
- 🔄 重構為獨立模組
- 📦 支援多頁面共用

---

## 🐛 已知限制

### 1. period 為空的學生
- ❌ 無法透過時間篩選匹配
- ✅ 仍可透過課程名稱篩選

### 2. 負數或 null 的剩餘堂數
- ❌ 負數會被視為堂數不足（預期行為）
- ✅ null 會自動轉換為 0

### 3. 課程名稱前綴匹配
- ⚠️ 可能產生誤匹配（例如："SPIKE" 會匹配到 "SPIKE PRO"）
- ✅ 透過三層匹配機制最小化誤匹配

---

## 💡 建議

### 對於 API 提供者
建議統一 `course` 和 `period` 的課程名稱格式：
```json
{
    "course": "SPIKE PRO",              // 修改為完整名稱
    "period": "SPIKE PRO 日 10:00-12:00"
}
```

### 對於前端開發者
呼叫篩選器時，使用 `debugMode: true` 來觀察匹配邏輯：
```javascript
const students = await filterStudentsByCourseAndTime(
    allStudents,
    "SPIKE PRO",
    "日 10:00-12:00",
    { debugMode: true }
);
```

---

## 📞 問題回報

如果發現任何匹配問題，請提供：
1. 目標課程名稱
2. 目標時間段
3. 學生的 `course` 和 `period` 欄位內容
4. 預期結果 vs 實際結果

---

## ✅ 結論

**student-filter.js v2.2.0** 現在可以正確處理：
- ✅ course 和 period 不一致的情況
- ✅ period 包含課程名稱前綴
- ✅ 多種時間格式（HH:MM 或 HHMM）
- ✅ 特殊事件關鍵字過濾
- ✅ 當週豁免邏輯
- ✅ 負數和 null 的剩餘堂數

**篩選器已經準備好接受您目前的 API 數據格式！** 🎉


