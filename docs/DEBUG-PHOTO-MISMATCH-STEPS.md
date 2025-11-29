# 照片回填錯配問題診斷步驟

**問題現象**：
- ✅ 照片正確上傳到石紹言的資料夾：`/團隊資料夾/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山 第8週/2025-11-14 洞棍發射器/石紹言`
- ❌ 前端回填時照片顯示在錯誤的學生卡片上

---

## 診斷步驟

### 步驟 1：檢查後端返回的 studentName

開啟瀏覽器訪問 `http://localhost:3000/learning-record-upload.html`

按 F12 開啟 DevTools → Console，執行：

```javascript
// 查看快取中的學生記錄
const cache = window.FLB.State.get().uploadedRecordsCache;
console.log('快取學生列表：', cache.students.map(s => ({
  studentName: s.studentName,
  photos: s.photos || s.newMediaPhotos?.length || 0,
  videos: s.videos || s.newMediaVideos?.length || 0
})));
```

**檢查點**：
- 石紹言的記錄中，`studentName` 是否為 `"石紹言"`？
- 如果不是，記錄實際的值（可能是其他學生的名字）

---

### 步驟 2：檢查 metadata.json

在 Synology Drive 中，查看石紹言資料夾中的 `metadata.json` 或 `record-meta.json`：

路徑：`/團隊資料夾/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山 第8週/2025-11-14 洞棍發射器/石紹言/metadata.json`

**檢查點**：
- `metadata.studentName` 的值是什麼？
- 是否為 `"石紹言"`？

---

### 步驟 3：檢查前端學生列表

在 Console 執行：

```javascript
// 查看當前課程的學生列表
const students = window.FLB.State.get().students || [];
console.log('學生列表：', students.map((s, idx) => ({
  index: idx,
  name: s.name,
  studentName: s.studentName
})));
```

**檢查點**：
- 找到石紹言在列表中的 index
- 確認 `students[index].name === "石紹言"`

---

### 步驟 4：檢查學生匹配邏輯

重新載入頁面，觀察 Console 日誌：

```
🔍 [學生回填] 查找學生記錄: {
  目標學生: "石紹言",
  快取中學生數量: X,
  快取中學生名稱列表: ["...", "...", ...]
}

✅ [學生回填] 字串匹配成功: "石紹言" == "石紹言"
或
⚠️ [學生回填] 未找到學生記錄: "石紹言"
```

**檢查點**：
- 是否有匹配成功的日誌？
- 如果匹配到錯誤的學生，記錄匹配的名稱

---

### 步驟 5：檢查照片 URL 建構

在 Console 觀察：

```
📸 [主卡片-新系統] 照片縮圖: {
  photoId: "photo-xxx",
  studentName: "???",  // ← 這裡應該是 "石紹言"
  url: "..."
}
```

**檢查點**：
- `studentName` 是否為當前卡片對應的學生？
- 如果不是，記錄實際的值

---

## 可能的問題與解決方案

### 問題 A：後端 metadata.studentName 錯誤

**症狀**：metadata.json 中 `studentName` 不是 "石紹言"

**原因**：上傳時前端傳入錯誤的 studentName

**解決方案**：
1. 檢查前端上傳程式碼（第 11594 行）：
   ```javascript
   studentName: String(student.name || student.studentName || '')
   ```
2. 確認上傳時 `student` 物件是正確的
3. 可能需要手動修正 Drive 中的 metadata.json

---

### 問題 B：路徑解析錯誤

**症狀**：metadata.json 不存在或讀取失敗，fallback 到路徑解析，但解析出錯誤的 studentName

**原因**：`pathInfo.studentName` 從路徑 `parts[3]` 提取，但可能提取到錯誤的值

**解決方案**：
1. 檢查後端日誌中的路徑解析輸出：
   ```
   🔍 [DrivePathManager] 解析路徑: {
     original: "...",
     parts: ["114-1", "SPIKE ...", "2025-11-14 洞棍發射器", "石紹言"],
     studentName: "???"
   }
   ```
2. 如果 `parts[3]` 不是 "石紹言"，檢查路徑格式是否正確

---

### 問題 C：前端學生匹配失敗

**症狀**：後端返回正確的 studentName，但前端匹配到錯誤的學生

**原因**：學生名稱比對邏輯有問題（空白、大小寫、特殊字元）

**解決方案**：
1. 已修復（使用 NormalizeUtils）
2. 如果仍有問題，檢查 `NormalizeUtils.isSameStudent` 的實作

---

### 問題 D：照片 URL 使用錯誤的 studentName

**症狀**：匹配正確，但建構 URL 時使用 `uploaded.studentName` 而非 `student.name`

**解決方案**：
✅ **已修復**（2025-11-16）
- 修改 `public/js/pages/learning-record-upload.js` 第 9719 行
- 將優先順序改為 `(student && student.name) || uploaded.studentName`

---

## 緊急修復方案

如果上述步驟都無法解決，可以手動修正 Drive 中的 metadata：

### 1. 找到錯誤的 metadata.json
路徑：`/團隊資料夾/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山 第8週/2025-11-14 洞棍發射器/石紹言/metadata.json`

### 2. 編輯 metadata.json
將 `studentName` 欄位改為正確的值：
```json
{
  "semester": "114-1",
  "courseName": "SPIKE 五 1610-1740 松山 第8週",
  "date": "2025-11-14",
  "topic": "洞棍發射器",
  "studentName": "石紹言",  // ← 確保這裡是正確的
  "uploadTime": "...",
  "comment": "...",
  ...
}
```

### 3. 清除前端快取
在 Console 執行：
```javascript
localStorage.removeItem('uploadedRecordsCache');
sessionStorage.clear();
location.reload();
```

---

## 測試驗證

修復後，執行以下測試：

### 1. 上傳測試
- 為學生A上傳照片
- 為學生B上傳照片
- 重新載入頁面
- **驗證**：每位學生的照片都在正確的卡片上

### 2. API 測試
```bash
curl "http://localhost:3000/api/learning-records/history-drive?semester=114-1&courseName=SPIKE%20%E4%BA%94%201610-1740%20%E6%9D%BE%E5%B1%B1%20%E7%AC%AC8%E9%80%B1&date=2025-11-14" | jq '.records[] | {studentName, photoCount, videoCount}'
```

**注意**：中文必須使用 URL 編碼（%E4%BA%94 = 五）

**驗證**：每筆記錄的 `studentName` 都正確

### 3. Console 日誌測試
觀察以下日誌是否正確：
- `🔍 [構建記錄] 合併 metadata 和 pathInfo`
- `✅ [學生回填] 字串匹配成功`
- `📸 [主卡片-新系統] 照片縮圖`

---

## 回報格式

請將以下資訊提供給開發團隊：

```
1. 步驟 1 結果：快取中石紹言的 studentName = ???
2. 步驟 2 結果：metadata.json 中的 studentName = ???
3. 步驟 3 結果：前端學生列表中石紹言的 index = ?, name = ???
4. 步驟 4 結果：匹配日誌顯示 ???
5. 步驟 5 結果：照片 URL 中的 studentName = ???
6. 截圖：顯示錯配情況的螢幕截圖
```

---

## 聯絡資訊

如有問題，請提供：
- 完整的 Console 日誌（右鍵 → Save as...）
- 網路請求記錄（Network tab）
- 錯配的具體情況描述
