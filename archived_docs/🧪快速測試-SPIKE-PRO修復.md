# 🧪 快速測試 - SPIKE PRO 課程名稱修復

**測試日期**: 2025-10-19  
**修復內容**: 
1. ✅ 共用模組 `course-student-matcher.js` 支援複合課程名稱
2. ✅ 學生資料 `student_data.json` 已更新（陳杰睿、顏世餘 → SPIKE PRO）

---

## 🎯 測試步驟

### 1. 強制重新整理瀏覽器
```
Cmd + Shift + R  (Mac)
Ctrl + Shift + R (Windows)
```

**目的**: 清除快取，載入最新版本的 JavaScript

---

### 2. 檢查共用模組版本

**開啟瀏覽器 Console**，應該看到：
```
✅ CourseStudentMatcher v1.0.0 已載入
```

---

### 3. 測試課程名稱提取功能

**在瀏覽器 Console 執行**：

```javascript
// 測試 1: SPIKE PRO（複合名稱）
window.CourseStudentMatcher.extractCourseName('SPIKE PRO 日 10:00-12:00 第5週')
// 預期結果: "SPIKE PRO" ✅

// 測試 2: SPIKE（單一名稱）
window.CourseStudentMatcher.extractCourseName('SPIKE 日 15:00-17:00 第4週')
// 預期結果: "SPIKE" ✅

// 測試 3: SPM（單一名稱）
window.CourseStudentMatcher.extractCourseName('SPM 日 13:30-15:00 松山 第5週')
// 預期結果: "SPM" ✅

// 測試 4: 複雜的複合名稱
window.CourseStudentMatcher.extractCourseName('SPIKE ADVANCED 日 14:00-16:00 第3週')
// 預期結果: "SPIKE ADVANCED" ✅
```

---

### 4. 測試實際課程（重點測試）

#### 步驟：
1. 開啟學習歷程上傳頁面：
   ```
   http://your-nas-ip:3000/learning-record-upload.html?eventId=20251018T043723-ouqqshoc@cal.synology.com&date=2025-10-19&time=10:00&instructor=TIM
   ```

2. 查看課程列表，應該只顯示 **1 堂課程**：
   ```
   ✅ SPIKE PRO 日 10:00-12:00 第5週
   ```

3. 點擊該課程

4. **驗證學生名單**：
   ```
   ✅ 應該只顯示 2 位學生：
      - 陳杰睿（剩餘 14 堂）
      - 顏世餘（剩餘 14 堂）
   
   ❌ 不應該顯示 25 位學生
   ```

5. **檢查 Console 日誌**：
   ```javascript
   📚 extractCourseName: {
     input: "SPIKE PRO 日 10:00-12:00 第5週",
     output: "SPIKE PRO"  // ✅ 正確
   }
   
   🎯 選擇課程: {
     courseTitle: "SPIKE PRO 日 10:00-12:00 第5週",
     studentsCount: 2,  // ✅ 正確（不是 25）
     students: ["陳杰睿", "顏世餘"]
   }
   ```

---

### 5. 驗證學生資料更新

**檢查 student_data.json**：
```bash
cat public/student_data.json | jq '.students[] | select(.name == "陳杰睿" or .name == "顏世餘") | {name, course, period}'
```

**預期輸出**：
```json
{
  "name": "陳杰睿",
  "course": "SPIKE PRO",  // ✅ 已從 "SPIKE" 更新為 "SPIKE PRO"
  "period": "日 1000-1200"
}
{
  "name": "顏世餘",
  "course": "SPIKE PRO",  // ✅ 已從 "SPIKE" 更新為 "SPIKE PRO"
  "period": "日 1000-1200"
}
```

---

## ❌ 常見問題排查

### 問題 1: 還是顯示 25 位學生

**可能原因**：
1. 瀏覽器快取未清除
2. 學生資料未同步

**解決方案**：
```bash
# 1. 確認檔案已同步
ls -la /volume1/docker/flb-calendar/public/js/course-student-matcher.js
ls -la /volume1/docker/flb-calendar/public/student_data.json

# 2. 強制重新整理瀏覽器
# 3. 清除瀏覽器快取並重新載入
```

---

### 問題 2: 顯示 0 位學生

**可能原因**：
1. 學生的 `course` 欄位不是 `"SPIKE PRO"`
2. 學生的 `period` 欄位格式錯誤

**解決方案**：
```bash
# 檢查學生資料
cat public/student_data.json | jq '.students[] | select(.course | contains("SPIKE")) | {name, course, period}'

# 確認這兩位學生的資料：
# course: "SPIKE PRO"（完全匹配）
# period: "日 1000-1200"（時段匹配）
```

---

### 問題 3: Console 沒有顯示日誌

**可能原因**：
- 共用模組未載入

**解決方案**：
```javascript
// 檢查模組是否存在
console.log(window.CourseStudentMatcher);

// 如果是 undefined，檢查：
// 1. 檔案路徑是否正確
// 2. HTML 是否引入 <script src="/js/course-student-matcher.js"></script>
```

---

## ✅ 測試通過標準

| 測試項目 | 預期結果 | 實際結果 |
|---------|---------|---------|
| 共用模組載入 | ✅ CourseStudentMatcher v1.0.0 已載入 | ☐ |
| 提取 SPIKE PRO | ✅ "SPIKE PRO" | ☐ |
| 提取 SPIKE | ✅ "SPIKE" | ☐ |
| 課程顯示數量 | ✅ 1 堂課程 | ☐ |
| 學生顯示數量 | ✅ 2 位學生 | ☐ |
| 學生名單 | ✅ 陳杰睿、顏世餘 | ☐ |
| 學生資料更新 | ✅ course: "SPIKE PRO" | ☐ |

---

## 📊 修復前後對比

| 項目 | 修復前 ❌ | 修復後 ✅ |
|-----|---------|---------|
| 正則表達式 | `/^([A-Z]+)/i` | `/^([A-Z]+(?:\s+[A-Z]+)*)/i` |
| 提取結果 | "SPIKE" | "SPIKE PRO" |
| 匹配學生 | 25 位（所有 SPIKE 學生） | 2 位（只有 SPIKE PRO 學生） |
| student_data.json | course: "SPIKE" | course: "SPIKE PRO" |

---

## 🎉 測試完成！

如果所有測試都通過，表示修復成功！

**相關文件**：
- 📖 `✅課程名稱提取修復-複合名稱支援.md`（完整說明）
- 🚀 `🚀立即部署-課程名稱提取修復.sh`（部署腳本）

---

## 📝 後續建議

1. **統一課程命名規範**：
   - 建議所有複合名稱課程都在 `student_data.json` 中使用完整名稱
   - 例如：`SPIKE PRO`、`SPIKE ADVANCED`、`SPIKE BASIC`

2. **定期檢查課程名稱一致性**：
   ```bash
   # 檢查所有 SPIKE 相關課程
   cat public/student_data.json | jq '.students[] | select(.course | contains("SPIKE")) | .course' | sort | uniq -c
   ```

3. **建立課程代碼對照表**（可選）：
   ```json
   {
     "courseMapping": {
       "SPIKE": "SPIKE BASIC",
       "SPIKE PRO": "SPIKE PRO",
       "SPIKE ADVANCED": "SPIKE ADVANCED"
     }
   }
   ```

