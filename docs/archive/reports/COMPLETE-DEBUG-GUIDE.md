# 完整調試指南 - Drive 數據回填

**日期**: 2025-11-08  
**版本**: v2.4.3  
**狀態**: 🔧 調試中

---

## 🎯 當前問題

**症狀**:
- ✅ 初始載入不會自動上傳（已修復）
- ❌ 不會從 Drive 相對應資料夾回填資料

---

## 📊 完整數據流程檢查清單

### 階段 1: 選擇課程

```javascript
// 1. 用戶選擇課程
selectCourse(course) 
  ↓
// 2. 清空表單字段（不觸發上傳）
清空 ov_perf, ov_issue, ov_solution 等字段
  ↓
// 3. 調用載入記錄
loadUploadedRecordsForCurrentCourse({ force: false })
```

**檢查點 1**: 在瀏覽器 Console 執行
```javascript
// 觀察選擇課程時的日誌
// 應該看到：
console.log('📝 選擇課程:', course);
console.log('🔍 [歷史記錄] 查詢參數:', { semester, courseName, date });
```

---

### 階段 2: API 調用

```javascript
// 調用後端 API
GET /api/learning-records/history-drive
  ?semester=114-1
  &courseName=[課程名]
  &date=2025-11-03
```

**檢查點 2**: 在瀏覽器 DevTools → Network 標籤
1. 找到 `history-drive` 請求
2. 查看 **Request URL**
3. 查看 **Response**

**預期響應格式**:
```json
{
  "success": true,
  "records": [
    {
      "semester": "114-1",
      "courseName": "課程名",
      "date": "2025-11-03",
      "isOverview": true,
      "studentName": "課程總覽",
      "summary": "課程紀錄內容\n課程種類：...\n學生的狀況與表現：-111\n遇到的問題：-222\n解決的方法：-333",
      "recordPath": "/Fun Learn Bar/FLB-Learning-Portfolio/...",
      "photos": [...],
      "videos": [...],
      "photoCount": 2,
      "videoCount": 0
    }
  ],
  "count": 1
}
```

---

### 階段 3: 數據轉換

```javascript
// getRecordsByCourse 轉換格式
{
  success: true,
  overview: {
    summary: "課程紀錄內容\n...",  // ← 重要！
    photos: [...],
    videos: [...]
  },
  students: [...]
}
  ↓
// renderUploadedRecords 處理
if (data.overview && data.overview.summary) {
  hydrateOverviewFieldsFromSummary(data.overview.summary);
}
```

**檢查點 3**: 在 Console 執行
```javascript
// 獲取當前狀態
var state = FLB.State.get();
console.log('📦 Overview 數據:', state.uploadedRecordsCache?.overview);
console.log('📝 Summary 內容:', state.uploadedRecordsCache?.overview?.summary);
```

---

### 階段 4: 表單回填

```javascript
// hydrateOverviewFieldsFromSummary 解析文本
解析 "學生的狀況與表現：-111" → ov_perf.value = "-111"
解析 "遇到的問題：-222"       → ov_issue.value = "-222"
解析 "解決的方法：-333"       → ov_solution.value = "-333"
```

**檢查點 4**: 在 Console 執行
```javascript
// 檢查表單字段
console.log('ov_perf:', document.getElementById('ov_perf')?.value);
console.log('ov_issue:', document.getElementById('ov_issue')?.value);
console.log('ov_solution:', document.getElementById('ov_solution')?.value);

// 手動觸發回填（測試）
var state = FLB.State.get();
if (state.uploadedRecordsCache?.overview?.summary) {
  hydrateOverviewFieldsFromSummary(state.uploadedRecordsCache.overview.summary);
  console.log('✅ 已手動觸發回填');
}
```

---

## 🔍 完整調試步驟

### 步驟 1: 啟動開發服務器

```bash
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 確保服務器已啟動
npm run dev
```

### 步驟 2: 打開瀏覽器並清除快取

```
1. 打開 http://localhost:3002/learning-record-upload.html
2. 按 Ctrl+Shift+R (強制刷新)
3. 打開 DevTools (F12)
4. 切換到 Console 標籤
```

### 步驟 3: 選擇課程並觀察日誌

```javascript
// 應該看到以下日誌序列：

1. 📝 選擇課程: { id: "...", title: "...", ... }

2. 🔍 [歷史記錄] 查詢參數: { 
      
     semester: "114-1", 
     courseName: "...", 
     date: "2025-11-03" 
   }

3. 🔍 [歷史記錄] 搜尋路徑: "/Fun Learn Bar/FLB-Learning-Portfolio/..."

4. ✅ [歷史記錄] 找到 X 筆記錄

5. 📦 [renderUploadedRecords] API返回数据: { ... }

6. 🔄 [回填表單] 開始回填課程總覽數據...

7. 📝 [回填表單] Summary 內容: "課程紀錄內容\n..."

8. ✅ [回填表單] 表單回填完成

9. ✅ [回填表單] 已重置文字快照，禁用自動上傳
```

### 步驟 4: 檢查 Network 請求

在 DevTools → Network 標籤:

1. **找到 `history-drive` 請求**
   - 狀態應該是 `200 OK`
   - Method: `GET`

2. **檢查 Request URL**:
   ```
   http://localhost:3002/api/learning-records/history-drive
     ?semester=114-1
     &courseName=[課程名]
     &date=2025-11-03
   ```

3. **檢查 Response**:
   - 點擊 Preview 或 Response 標籤
   - 確認有 `records` 陣列
   - 確認第一筆記錄有 `summary` 字段

### 步驟 5: 手動測試回填

如果自動回填沒有工作，在 Console 執行：

```javascript
// 1. 檢查數據是否存在
var state = FLB.State.get();
console.log('State:', state);
console.log('Overview:', state.uploadedRecordsCache?.overview);

// 2. 如果有 overview.summary，手動觸發回填
if (state.uploadedRecordsCache?.overview?.summary) {
  var summary = state.uploadedRecordsCache.overview.summary;
  console.log('📄 Summary 完整內容:', summary);
  
  // 手動回填
  hydrateOverviewFieldsFromSummary(summary);
  
  // 檢查結果
  console.log('回填後:');
  console.log('  ov_perf:', document.getElementById('ov_perf')?.value);
  console.log('  ov_issue:', document.getElementById('ov_issue')?.value);
  console.log('  ov_solution:', document.getElementById('ov_solution')?.value);
} else {
  console.error('❌ 沒有找到 overview.summary');
  console.log('可能的問題:');
  console.log('1. API 沒有返回數據');
  console.log('2. 數據格式不正確');
  console.log('3. recordPath 路徑錯誤');
}
```

---

## 🐛 常見問題排查

### 問題 1: API 返回空陣列

**症狀**: `records: []`

**可能原因**:
1. **Drive 路徑不匹配**
   ```
   後端查詢: /Fun Learn Bar/FLB-Learning-Portfolio/114-1/課程A/2025-11-03/
   實際路徑: /Fun Learn Bar/FLB-Learning-Portfolio/114-1/課程B/2025-11-03/
   ```

2. **日期格式不匹配**
   ```
   後端查詢: 2025-11-03
   實際目錄: 2025-11-3 (缺少前導零)
   ```

3. **metadata.json 不存在**

**解決方案**:
```bash
# 在服務器端執行
node tests/manual/test-drive-connection.js

# 或在 Console 執行
fetch('/api/learning-records/history-drive?semester=114-1&courseName=測試課程&date=2025-11-08')
  .then(r => r.json())
  .then(d => console.log('API 響應:', d));
```

---

### 問題 2: API 有數據但 summary 為空

**症狀**: `records[0].summary === ""` 或 `undefined`

**可能原因**:
1. **metadata.json 缺少 summary 字段**
2. **summary.txt 文件不存在**
3. **上傳時 comment 為空**

**解決方案**:
```javascript
// 檢查 metadata.json 內容
// 在 Synology Drive 中打開：
// /Fun Learn Bar/FLB-Learning-Portfolio/114-1/[課程名]/[日期]/課程總覽/metadata.json

// 應該包含：
{
  "semester": "114-1",
  "courseName": "...",
  "date": "2025-11-03",
  "isOverview": true,
  "summary": "課程紀錄內容\n課程種類：...\n學生的狀況與表現：-111\n...",
  // ↑ 重要：summary 必須有值
  "uploadTime": "...",
  "photos": [...],
  "videos": [...]
}
```

---

### 問題 3: 有 summary 但沒有回填

**症狀**: Console 看到 summary 內容，但表單還是空的

**可能原因**:
1. **summary 格式不正確**
   ```
   錯誤: "學生的狀況與表現-111"     (缺少冒號)
   正確: "學生的狀況與表現：-111"   (全角冒號)
   ```

2. **hydrateOverviewFieldsFromSummary 沒有被調用**

3. **表單字段 ID 不匹配**

**解決方案**:
```javascript
// 檢查 summary 格式
var summary = state.uploadedRecordsCache.overview.summary;
console.log('Summary:', summary);

// 檢查是否包含正確的標籤
console.log('包含「學生的狀況與表現：」?', summary.includes('學生的狀況與表現：'));
console.log('包含「遇到的問題：」?', summary.includes('遇到的問題：'));
console.log('包含「解決的方法：」?', summary.includes('解決的方法：'));

// 手動解析測試
var match = summary.match(/^學生的狀況與表現：(.*)$/m);
console.log('解析結果:', match ? match[1] : '未匹配');
```

---

## 🧪 完整測試腳本

在 Console 貼上並執行：

```javascript
(async function fullTest() {
  console.log('🚀 開始完整測試...\n');
  
  // 1. 檢查當前課程
  var state = FLB.State.get();
  var currentCourse = state.selectedCourse;
  
  if (!currentCourse) {
    console.error('❌ 沒有選擇課程！請先選擇一個課程。');
    return;
  }
  
  console.log('✅ 當前課程:', currentCourse.title);
  console.log('   日期:', currentCourse.date || currentCourse.formattedDate);
  
  // 2. 檢查 API 響應
  try {
    var parsed = global.FLB.Course.parseTitle(currentCourse.title || '');
    var courseName = currentCourse.courseName || parsed.courseName;
    var dateStr = currentCourse.date || currentCourse.formattedDate;
    
    var url = '/api/learning-records/history-drive?semester=114-1&courseName=' + 
              encodeURIComponent(courseName + ' ' + (parsed.period || '')) + 
              '&date=' + dateStr;
    
    console.log('\n📡 調用 API:', url);
    
    var response = await fetch(url);
    var data = await response.json();
    
    console.log('\n📦 API 響應:', data);
    console.log('   找到記錄數:', data.count);
    
    if (data.records && data.records.length > 0) {
      var overview = data.records.find(r => r.isOverview);
      
      if (overview) {
        console.log('\n✅ 找到課程總覽');
        console.log('   照片數:', overview.photoCount);
        console.log('   影片數:', overview.videoCount);
        console.log('   Summary 長度:', overview.summary?.length || 0);
        console.log('   Summary 預覽:', overview.summary?.substring(0, 100));
        
        // 3. 測試回填
        if (overview.summary) {
          console.log('\n🔄 測試回填...');
          
          hydrateOverviewFieldsFromSummary(overview.summary);
          
          console.log('\n📝 回填結果:');
          console.log('   ov_perf:', document.getElementById('ov_perf')?.value || '(空)');
          console.log('   ov_issue:', document.getElementById('ov_issue')?.value || '(空)');
          console.log('   ov_solution:', document.getElementById('ov_solution')?.value || '(空)');
          
          if (document.getElementById('ov_perf')?.value) {
            console.log('\n✅ 回填成功！');
          } else {
            console.log('\n❌ 回填失敗！Summary 格式可能不正確。');
            console.log('   完整 Summary:', overview.summary);
          }
        } else {
          console.error('\n❌ Summary 為空！');
        }
      } else {
        console.error('\n❌ 沒有找到課程總覽記錄');
      }
    } else {
      console.error('\n❌ API 沒有返回任何記錄');
      console.log('   可能原因:');
      console.log('   1. Drive 路徑不存在');
      console.log('   2. metadata.json 文件損壞');
      console.log('   3. 路徑或日期格式不匹配');
    }
  } catch (error) {
    console.error('\n❌ 測試失敗:', error);
  }
  
  console.log('\n🏁 測試完成');
})();
```

---

## 📋 檢查結果匯報格式

請提供以下信息：

### 1. Console 日誌
```
貼上 Console 中的完整日誌（從選擇課程開始）
```

### 2. Network 請求詳情
```
Request URL: http://localhost:3002/api/learning-records/history-drive?...
Status Code: 200 OK / 404 Not Found / 500 Error

Response Preview:
{
  "success": true/false,
  "records": [...],
  "count": X
}
```

### 3. 測試腳本結果
```
貼上完整測試腳本的輸出
```

### 4. 當前表單狀態
```
ov_perf: (值或空)
ov_issue: (值或空)
ov_solution: (值或空)
```

---

**現在請執行完整測試並提供結果！** 🚀

