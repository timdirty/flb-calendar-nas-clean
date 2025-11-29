# 📊 V2 學生管理頁面統計測試指南

> **測試日期**: 2025-11-26  
> **目的**: 驗證學生管理頁面的上傳統計功能

---

## 🎯 測試目標

驗證學生管理頁面能正確顯示：
1. ✅ 出席統計（總數、出席、請假、缺席）
2. ✅ 上傳進度（已完成 / 總數）
3. ✅ 集中索引摘要（學生數、已有上傳、已有評語）

---

## 🚀 測試步驟

### 1. 啟動服務

**後端**（已啟動，PID 5019）:
```bash
# 檢查後端狀態
ps aux | grep "node.*server.js" | grep -v grep

# 如果沒有運行，啟動後端
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
nohup sh -c 'PORT=3000 DISABLE_AUTO_REMINDERS=true node server.js' > /tmp/flb-calendar-server.log 2>&1 & echo $!
```

**前端**:
```bash
# 啟動前端開發伺服器
cd /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/frontend-v2
npm run dev
```

### 2. 開啟前端

開啟瀏覽器：`http://localhost:5174/`

### 3. 選擇有上傳記錄的課程

**測試課程**（2025-11-26）:
- **SPM 三1630-1730 到府 第12週**
  - 預期：1位學生，22個檔案（18照片 + 4影片），有評語

**測試課程**（2025-11-24）:
- **SPM 一 1930-2030 到府 第4週**
  - 預期：1位學生，12個檔案（6照片 + 6影片），有評語

### 4. 進入學生管理頁面

點擊課程卡片 → 進入學生管理頁面

---

## ✅ 預期結果

### 出席統計（白色框）
```
總數：1  ● 出席：0  ● 請假：0  ● 缺席：0
```

### 上傳進度（藍色進度條）
```
上傳進度：1 / 1 位學生
```

### 集中索引摘要（綠色框）
```
📊 集中索引：本堂課上傳狀態
學生數：1  已有上傳：1  已有評語：1
```

### 學生卡片
每個學生卡片應該顯示：
- ✅ 學生姓名
- ✅ 上傳狀態標記（如果有上傳）
- ✅ 評語標記（如果有評語）

---

## 🔍 測試 API

### 測試課程索引 API

```bash
# SPM 三1630-1730 到府（2025-11-26）
curl -s "http://localhost:3000/api/learning-records/index/course?semester=2025%E4%B8%8A%E5%AD%B8%E6%9C%9F&courseName=SPM%20%E4%B8%891630-1730%20%E5%88%B0%E5%BA%9C&date=2025-11-26" | jq '.'

# 預期結果
{
  "success": true,
  "data": {
    "semester": "2025上學期",
    "courseName": "SPM 三1630-1730 到府",
    "date": "2025-11-26",
    "topic": "拳擊機器",
    "overview": {
      "hasPhotos": false,
      "hasVideos": false,
      "hasSummary": true,
      "lastUpdatedAt": "2025-11-26T15:21:25.652Z"
    },
    "students": {
      "王奕甯，王奕棋": {
        "studentName": "王奕甯，王奕棋",
        "photoCount": 18,
        "videoCount": 4,
        "hasComment": true,
        "hasAnyUpload": true,
        "lastUpdatedAt": "2025-11-26T15:15:43.526Z",
        "lastUploadTime": "2025-11-26T15:15:43.526Z"
      }
    }
  }
}
```

### 測試課程列表 API

```bash
# 獲取 2025-11-26 的課程（含統計）
curl -s "http://localhost:3000/api/v2/courses?startDate=2025-11-26&endDate=2025-11-26&includeStats=true" | jq '.data[] | select(.name | contains("SPM 三")) | {name, uploadedStudentCount, totalUploadedFiles, overviewUploaded}'

# 預期結果
{
  "name": "SPM 三1630-1730 到府 第12週",
  "uploadedStudentCount": 1,
  "totalUploadedFiles": 22,
  "overviewUploaded": true
}
```

---

## 🐛 故障排除

### 問題 1: 看不到集中索引摘要

**可能原因**:
- 前端快取未更新
- 課程沒有上傳記錄

**解決方案**:
1. 重新整理頁面（Ctrl+R 或 Cmd+R）
2. 清除瀏覽器快取：`localStorage.clear()` + `sessionStorage.clear()`
3. 選擇有上傳記錄的課程

### 問題 2: 統計數字為 0

**可能原因**:
- 索引檔案未更新
- 課程名稱不匹配

**解決方案**:
1. 檢查索引檔案：
   ```bash
   cat /Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/data/learning-records-index.json | jq '.courses | keys'
   ```
2. 測試 API（見上方測試 API 章節）
3. 檢查後端日誌：
   ```bash
   tail -n 50 /tmp/flb-calendar-server.log
   ```

### 問題 3: API 返回 404

**可能原因**:
- 後端伺服器未啟動
- 端口不正確

**解決方案**:
1. 檢查後端狀態：`ps aux | grep "node.*server.js"`
2. 重啟後端（見步驟 1）
3. 確認端口：應該是 3000

---

## 📝 測試記錄

| 測試項目 | 狀態 | 備註 |
|---------|------|------|
| 後端 API 正常 | ✅ | 已驗證 |
| 課程列表統計 | ✅ | 已驗證 |
| 索引 API | ✅ | 已驗證 |
| 前端顯示 | ⏳ | 待測試 |

---

## 🎯 成功標準

- [x] 後端 API 返回正確的索引資料
- [x] 課程列表顯示上傳統計
- [ ] 學生管理頁面顯示集中索引摘要
- [ ] 學生卡片顯示上傳狀態標記

---

**測試完成後，請更新此文檔並記錄結果！**
