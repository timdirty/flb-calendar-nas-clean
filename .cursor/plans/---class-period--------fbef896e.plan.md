<!-- fbef896e-6fc0-4038-b73d-17b5e2d850ba 908159c7-bac6-41e9-8c90-71937e3cb6ee -->
# Period 結構化與精確匹配實施計劃

## 核心目標
**做更精確的課程-學生匹配，減少誤判**

## 實施策略：方案 A

### 特點
- ✅ Google Sheets **不需改動**
- ✅ 保留原始 `period` 字串（向後兼容）
- ✅ 自動添加 `periodParsed` 結構化欄位
- ✅ 新舊系統並存，平滑過渡

---

## 一、資料結構設計

### 1.1 增強後的 student_data.json 格式

```json
{
  "name": "蔡定言",
  "course": "SPIKE",
  "period": "三 1830-2030",           // 保留原始（向後兼容）
  "periodParsed": {                   // 新增結構化欄位
    "weekdays": ["三"],               // 星期陣列（支援 "一四"）
    "startTime": "18:30",             // HH:MM 標準格式
    "endTime": "20:30",               // HH:MM 標準格式
    "location": null,                 // 地點（到府、松山等）
    "note": null,                     // 備註（客製化等）
    "raw": "三 1830-2030"             // 原始字串備份
  },
  "remaining": 11,
  "userId": "Ud01f8449..."
}
```

### 1.2 解析規則範例

| 原始 period | periodParsed 輸出 |
|-------------|-------------------|
| `"三 0840-0920"` | `{weekdays:["三"], startTime:"08:40", endTime:"09:20"}` |
| `"19:30-21:00"` | `{weekdays:[], startTime:"19:30", endTime:"21:00"}` |
| `"一四 1930-2030 到府"` | `{weekdays:["一","四"], startTime:"19:30", endTime:"20:30", location:"到府"}` |
| `"六 1530-1700 到府"` | `{weekdays:["六"], startTime:"15:30", endTime:"17:00", location:"到府"}` |
| `"一 1930-2100 客製化"` | `{weekdays:["一"], startTime:"19:30", endTime:"21:00", note:"客製化"}` |
| `""` (空) | `{weekdays:[], startTime:null, endTime:null}` |

---

## 二、後端實施（server.js）

### 2.1 新增 Period 解析函數

**位置**: `server.js` 全域函數區

**函數簽名**:
```javascript
function parsePeriodString(periodStr) {
  // 回傳 periodParsed 物件
}
```

**實作重點**:
1. **星期提取**: 正則匹配 `[一二三四五六日]`
2. **時間提取**: 正則匹配 `HHMM-HHMM` 或 `HH:MM-HH:MM`
3. **地點/備註**: 關鍵字匹配（到府、松山、客製化等）
4. **時間標準化**: 統一轉為 `HH:MM` 格式
5. **錯誤處理**: 解析失敗回傳 null 值

**範例實作**:
```javascript
function parsePeriodString(periodStr) {
  if (!periodStr || typeof periodStr !== 'string') {
    return { weekdays: [], startTime: null, endTime: null, location: null, note: null, raw: periodStr };
  }

  const result = {
    weekdays: [],
    startTime: null,
    endTime: null,
    location: null,
    note: null,
    raw: periodStr
  };

  // 1. 提取星期
  const weekdayPattern = /[一二三四五六日]/g;
  const weekdayMatches = periodStr.match(weekdayPattern);
  if (weekdayMatches) {
    result.weekdays = [...new Set(weekdayMatches)]; // 去重
  }

  // 2. 提取時間範圍（支援 HHMM 或 HH:MM）
  const timePattern = /(\d{1,2}):?(\d{2})\s*[-~]\s*(\d{1,2}):?(\d{2})/;
  const timeMatch = periodStr.match(timePattern);
  if (timeMatch) {
    const [_, h1, m1, h2, m2] = timeMatch;
    result.startTime = `${h1.padStart(2, '0')}:${m1}`;
    result.endTime = `${h2.padStart(2, '0')}:${m2}`;
  }

  // 3. 提取地點
  if (periodStr.includes('到府')) result.location = '到府';
  else if (periodStr.includes('松山')) result.location = '松山';

  // 4. 提取備註
  if (periodStr.includes('客製化')) result.note = '客製化';
  else if (periodStr.includes('包班')) result.note = '包班';

  return result;
}
```

### 2.2 修改學生資料更新流程

**位置**: `server.js:279-395` 的 `updateStudentDataFromGoogleSheets()`

**修改點**: 在寫入檔案前，為每個學生添加 `periodParsed`

```javascript
// 在 line 343 附近，寫入前處理
if (response.data && response.data.success) {
  const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
  
  // 🔥 新增：為每個學生添加 periodParsed
  if (response.data.students && Array.isArray(response.data.students)) {
    response.data.students = response.data.students.map(student => ({
      ...student,
      periodParsed: parsePeriodString(student.period || '')
    }));
  }
  
  const updatedData = {
    ...response.data,
    lastUpdated: new Date().toISOString(),
    updateNote: `// 最後更新時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`
  };
  
  fs.writeFileSync(studentDataPath, JSON.stringify(updatedData, null, 2));
  // ...
}
```

---

## 三、前端匹配增強（course-student-matcher.js）

### 3.1 新增精確匹配函數

**函數簽名**:
```javascript
/**
 * 精確匹配學生到事件
 * @param {Object} student - 學生物件
 * @param {Object} event - CalDAV 事件物件
 * @param {Object} options - 匹配選項
 * @returns {Object} 匹配結果 {matched: boolean, confidence: number, reason: string}
 */
function matchStudentToEvent(student, event, options = {})
```

### 3.2 匹配邏輯流程

```javascript
function matchStudentToEvent(student, event, options = {}) {
  const result = {
    matched: false,
    confidence: 0,  // 0-100
    reason: ''
  };

  // 1. 課程名稱匹配（必要條件）
  const courseName = extractCourseName(event.title || '');
  if (courseName.toUpperCase() !== (student.course || '').toUpperCase()) {
    result.reason = '課程名稱不匹配';
    return result;
  }
  result.confidence += 40; // 課程匹配 +40 分

  // 2. 優先使用結構化 periodParsed（如果存在）
  if (student.periodParsed && student.periodParsed.startTime) {
    
    // 2a. 星期匹配（如果都有星期資訊）
    const eventWeekday = getEventWeekday(event); // 從事件提取星期
    if (eventWeekday && student.periodParsed.weekdays.length > 0) {
      if (student.periodParsed.weekdays.includes(eventWeekday)) {
        result.confidence += 30; // 星期匹配 +30 分
      } else {
        result.reason = '星期不匹配';
        return result;
      }
    }

    // 2b. 時間匹配
    const eventStartTime = formatTime(event.start); // "HH:MM"
    const eventEndTime = formatTime(event.end);     // "HH:MM"
    
    if (eventStartTime === student.periodParsed.startTime &&
        eventEndTime === student.periodParsed.endTime) {
      result.confidence += 30; // 時間完全匹配 +30 分
      result.matched = true;
      result.reason = '精確匹配（課程+星期+時間）';
      return result;
    } else if (timeOverlap(eventStartTime, eventEndTime, 
                          student.periodParsed.startTime, 
                          student.periodParsed.endTime)) {
      result.confidence += 15; // 時間部分重疊 +15 分
    }
  }

  // 3. 降級匹配：使用原始 period 字串
  if (student.period && isTimeMatch(student.period, event.time || '')) {
    result.confidence += 20;
    result.matched = result.confidence >= 60; // 信心度 >= 60 才算匹配
    result.reason = result.matched ? '字串匹配（降級）' : '信心度不足';
    return result;
  }

  result.reason = '無法匹配';
  return result;
}
```

### 3.3 輔助函數

```javascript
// 從事件中提取星期
function getEventWeekday(event) {
  if (event.weekday) return event.weekday;
  if (event.start) {
    const date = new Date(event.start);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return weekdays[date.getDay()];
  }
  return null;
}

// 格式化時間為 HH:MM
function formatTime(dateStr) {
  const date = new Date(dateStr);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// 檢查時間重疊
function timeOverlap(start1, end1, start2, end2) {
  return start1 < end2 && start2 < end1;
}
```

### 3.4 修改現有函數使用新邏輯

**修改**: `findStudentsByCourse()` 函數

增加選項支援精確匹配：
```javascript
function findStudentsByCourse(courseName, studentData, options = {}) {
  const {
    includeZeroRemaining = true,
    event = null,  // 🔥 新增：如果提供事件，進行精確匹配
    minConfidence = 60  // 🔥 新增：最低信心度閾值
  } = options;
  
  // ... 現有邏輯 ...
  
  let matchedStudents = studentData.students.filter(/* ... */);
  
  // 🔥 新增：如果提供事件，進行精確匹配並排序
  if (event) {
    matchedStudents = matchedStudents
      .map(student => ({
        student,
        matchResult: matchStudentToEvent(student, event, options)
      }))
      .filter(item => item.matchResult.confidence >= minConfidence)
      .sort((a, b) => b.matchResult.confidence - a.matchResult.confidence)
      .map(item => ({
        ...item.student,
        _matchConfidence: item.matchResult.confidence,
        _matchReason: item.matchResult.reason
      }));
  }
  
  return matchedStudents;
}
```

---

## 四、管理後台介面（admin-dashboard.html）

### 4.1 第一階段：Period 驗證與顯示

在管理後台新增"**時段管理**"分頁：

**功能 1：Period 格式驗證**
- 列出所有學生的 period
- 標示解析成功 ✅ / 失敗 ❌
- 顯示 periodParsed 詳細資訊
- 標記需要手動修正的資料

**功能 2：匹配測試工具**
- 輸入事件標題、時間、星期
- 即時顯示匹配的學生列表
- 顯示匹配信心度和原因

**UI 草稿**:
```html
<div class="period-management">
  <h3>📅 時段管理</h3>
  
  <!-- 統計卡片 -->
  <div class="stats-cards">
    <div class="card">
      <h4>✅ 解析成功</h4>
      <p class="count">85</p>
    </div>
    <div class="card warning">
      <h4>⚠️ 需要檢查</h4>
      <p class="count">2</p>
    </div>
  </div>
  
  <!-- Period 列表 -->
  <table class="period-table">
    <thead>
      <tr>
        <th>學生</th>
        <th>課程</th>
        <th>原始 Period</th>
        <th>解析結果</th>
        <th>狀態</th>
      </tr>
    </thead>
    <tbody id="periodTableBody">
      <!-- 動態生成 -->
    </tbody>
  </table>
  
  <!-- 匹配測試 -->
  <div class="match-tester">
    <h4>🧪 匹配測試工具</h4>
    <input type="text" placeholder="課程名稱 (如 SPIKE)">
    <input type="text" placeholder="星期 (如 三)">
    <input type="text" placeholder="時間 (如 18:30-20:30)">
    <button>測試匹配</button>
    <div id="matchResults"></div>
  </div>
</div>
```

### 4.2 第二階段：未來功能（預留介面）

**按鈕/選單預留**:
```html
<div class="future-features" style="opacity: 0.5; pointer-events: none;">
  <button disabled>📊 時段統計</button>
  <button disabled>⚠️ 衝突檢測</button>
  <button disabled>📅 視覺化時間表</button>
  <button disabled>🔧 批次修正工具</button>
</div>
<p class="hint">🚧 這些功能將在未來版本推出</p>
```

**功能清單**:
- 📊 時段統計儀表板（最忙時段、空閒時段）
- ⚠️ 時間衝突檢測（同講師/教室/學生）
- 📅 視覺化週課表（甘特圖）
- 🔧 批次修正 period 格式
- 📈 匹配成功率分析
- 📤 匯出報表（PDF/Excel）

---

## 五、減少誤判的關鍵改進

### 5.1 誤判場景與解決方案

| 誤判場景 | 舊邏輯問題 | 新邏輯解決 |
|---------|-----------|-----------|
| **同課程不同時段** | 只比對課程名稱，所有 SPIKE 學生都匹配 | 檢查星期+時間，只匹配對應時段 |
| **時間格式差異** | "0840" vs "08:40" 不匹配 | 標準化為 "08:40"，成功匹配 |
| **多星期課程** | "一四" 難以解析 | weekdays: ["一","四"]，精確匹配 |
| **特殊標記干擾** | "到府" 影響時間比對 | 分離 location，不影響匹配 |
| **缺少星期資訊** | 無法判斷 | 降級匹配，使用時間比對 |

### 5.2 信心度評分機制

- **100分**：課程名稱 + 星期 + 時間完全匹配
- **70-90分**：課程名稱 + 時間匹配（無星期或星期匹配）
- **60-69分**：課程名稱 + 時間部分重疊
- **40-59分**：僅課程名稱匹配（降級到字串匹配）
- **<40分**：不匹配

---

## 六、測試計劃

### 6.1 單元測試

**測試 `parsePeriodString()`**:
```javascript
console.assert(parsePeriodString("三 0840-0920").startTime === "08:40");
console.assert(parsePeriodString("一四 1930-2030 到府").weekdays.length === 2);
console.assert(parsePeriodString("").startTime === null);
```

**測試 `matchStudentToEvent()`**:
```javascript
// 完全匹配
const result1 = matchStudentToEvent(
  { course: "SPIKE", periodParsed: { weekdays: ["三"], startTime: "18:30", endTime: "20:30" }},
  { title: "SPIKE — 1830-2030", start: "2025-10-16T18:30:00" }
);
console.assert(result1.matched === true);
console.assert(result1.confidence >= 90);
```

### 6.2 整合測試

1. 觸發 `/api/update-student-data`
2. 檢查 `student_data.json` 是否有 `periodParsed`
3. 在日曆介面測試學生匹配
4. 驗證匹配數量和正確性

### 6.3 邊界案例測試

- ✅ 空字串 `""`
- ✅ 僅時間 `"1930-2030"`
- ✅ 跨午夜 `"2300-0100"`
- ✅ 特殊字元 `"1930~2100"`（用 ~ 非 -）
- ✅ 多星期 `"一二三四五"`

---

## 七、實施順序

### Phase 1：後端基礎（必須）
1. ✅ 實作 `parsePeriodString()` 函數
2. ✅ 修改 `updateStudentDataFromGoogleSheets()`
3. ✅ 觸發更新，生成帶 `periodParsed` 的資料
4. ✅ 驗證資料格式正確

### Phase 2：前端匹配（核心）
1. ✅ 實作 `matchStudentToEvent()` 函數
2. ✅ 修改 `findStudentsByCourse()` 支援精確匹配
3. ✅ 在日曆介面套用新匹配邏輯
4. ✅ 測試匹配精確度提升

### Phase 3：管理介面（輔助）
1. ✅ 新增"時段管理"分頁
2. ✅ 實作 Period 驗證顯示
3. ✅ 實作匹配測試工具
4. 📋 預留未來功能按鈕（disabled）

### Phase 4：優化與擴展（選配）
1. 📋 時段統計儀表板
2. 📋 衝突檢測功能
3. 📋 視覺化時間表
4. 📋 批次修正工具

---

## 八、成功指標

### 量化指標
- ✅ Period 解析成功率 > 95%
- ✅ 匹配精確度提升（減少誤判）
- ✅ 平均匹配信心度 > 80 分

### 質化指標
- ✅ 同課程不同時段不再誤匹配
- ✅ 時間格式差異不再影響匹配
- ✅ 系統向後兼容，無破壞性變更

---

## 九、注意事項

### 9.1 向後兼容性
- ✅ 保留原始 `period` 欄位
- ✅ 現有系統可繼續使用
- ✅ 新功能選擇性啟用

### 9.2 錯誤處理
- ❗ 解析失敗時不中斷流程
- ❗ 記錄無法解析的 period 供檢查
- ❗ 提供降級匹配機制

### 9.3 效能考量
- ✅ 只在更新時解析一次（不是每次使用）
- ✅ 結構化資料查詢更快
- ✅ 預期效能提升而非下降


### To-dos

- [ ] 實作 parsePeriodString() 函數於 server.js
- [ ] 修改 updateStudentDataFromGoogleSheets() 添加 periodParsed
- [ ] 實作 matchStudentToEvent() 於 course-student-matcher.js
- [ ] 增強 findStudentsByCourse() 支援精確匹配
- [ ] 在管理後台新增時段管理分頁
- [ ] 實作 Period 格式驗證與顯示介面
- [ ] 實作匹配測試工具
- [ ] 執行整合測試驗證匹配精確度