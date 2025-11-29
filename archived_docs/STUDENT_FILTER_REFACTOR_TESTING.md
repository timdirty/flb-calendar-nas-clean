# 學生篩選邏輯重構測試文檔

## 📋 重構摘要

已成功將學生篩選邏輯統一到共用模組 `/public/js/student-filter.js`，並提供集中的後台管理界面。

### ✅ 已完成項目

1. ✅ **更新共用模組** (`public/js/student-filter.js`)
   - 添加調試模式參數
   - 添加可配置的剩餘堂數檢查
   - 添加從後端讀取配置的功能
   - 添加快取機制（5分鐘有效期）

2. ✅ **整合到 perfect-calendar** (`public/perfect-calendar-optimized-complete2.html`)
   - 引入 `student-filter.js` 模組
   - 替換內嵌邏輯為共用函數調用
   - 保留必要的調試輸出

3. ✅ **後端 API** (`server.js`)
   - `GET /api/student-filter-config` - 讀取配置
   - `POST /api/student-filter-config` - 保存配置
   - 提供預設配置降級方案
   - 自動備份舊配置

4. ✅ **Admin Dashboard** (`public/admin-dashboard.html`)
   - 新增「學生篩選規則」標籤頁
   - 提供完整的配置管理界面
   - 實時預覽配置
   - 測試、重置功能

## 🧪 測試計劃

### 階段一：基本功能測試

#### 1. Admin Dashboard - 配置管理測試

**測試步驟：**
1. 開啟 `http://localhost:3000/admin-dashboard.html`
2. 點擊「學生篩選規則」標籤
3. 驗證所有配置項目都正確顯示
4. 測試「重新載入」按鈕 - 應該載入當前配置
5. 測試「恢復預設值」按鈕 - 應該恢復到預設值
6. 測試「測試配置」按鈕 - 應該顯示測試結果

**預期結果：**
- ✅ 所有按鈕正常運作
- ✅ 配置預覽區域顯示正確的 JSON
- ✅ 修改配置時預覽即時更新

#### 2. 配置儲存與載入測試

**測試步驟：**
1. 修改以下配置：
   - ✅ 啟用詳細調試日誌
   - ✅ 最小剩餘堂數改為 1
   - ✅ 取消勾選「允許週次後綴」
2. 點擊「儲存所有設定」
3. 重新整理頁面
4. 再次進入「學生篩選規則」標籤

**預期結果：**
- ✅ 配置成功儲存
- ✅ 重新整理後配置保持一致
- ✅ `student-filter-config.json` 文件已創建
- ✅ 備份文件已創建（如果之前有配置）

#### 3. API 端點測試

**測試步驟：**
```bash
# 測試 GET 端點
curl http://localhost:3000/api/student-filter-config

# 測試 POST 端點
curl -X POST http://localhost:3000/api/student-filter-config \
  -H "Content-Type: application/json" \
  -d '{
    "debugMode": true,
    "minRemainingClasses": 0,
    "enableRemainingCheck": true,
    "courseMatchMode": "exact",
    "timeMatchRules": {
      "allowWeekSuffix": true,
      "allowSubstituteKeyword": true,
      "normalizeTimeFormat": true
    }
  }'
```

**預期結果：**
- ✅ GET 請求返回正確的配置 JSON
- ✅ POST 請求成功保存配置
- ✅ 返回 `{ success: true, ... }` 格式

### 階段二：Perfect Calendar 整合測試

#### 4. Perfect Calendar - 學生篩選測試

**測試步驟：**
1. 開啟 `http://localhost:3000/perfect-calendar-optimized-complete2.html`
2. 登入並進入日曆頁面
3. 點擊任一課程事件
4. 觀察瀏覽器 Console

**預期結果（調試模式開啟時）：**
- ✅ Console 顯示 `🔍 開始篩選學生:` 日誌
- ✅ Console 顯示每個學生的匹配詳情
- ✅ Console 顯示 `✅ 篩選完成:` 日誌
- ✅ 學生列表正確顯示

**預期結果（調試模式關閉時）：**
- ✅ 只顯示基本的篩選日誌
- ✅ 沒有詳細的匹配過程日誌
- ✅ 學生列表正確顯示

#### 5. 剩餘堂數篩選測試

**測試步驟：**
1. 在 Admin Dashboard 設定「最小剩餘堂數」為 1
2. 儲存配置
3. 在 Perfect Calendar 點擊課程
4. 確認只顯示剩餘堂數 >= 1 的學生

**測試數據：**
- 學生 A: 剩餘 5 堂 → 應該顯示 ✅
- 學生 B: 剩餘 0 堂 → 不應該顯示 ❌
- 學生 C: 剩餘 -1 堂 → 不應該顯示 ❌

**預期結果：**
- ✅ 篩選邏輯正確應用配置
- ✅ 前端快取在配置更新後被清除

#### 6. 時間匹配規則測試

**測試案例：**

| 學生時間 | 課程時間 | 允許週次後綴 | 應該匹配？ |
|---------|---------|-------------|----------|
| 日 10:00-12:00 | 日 10:00-12:00 | ✅ | ✅ |
| 日 10:00-12:00 第3週 | 日 10:00-12:00 | ✅ | ✅ |
| 日 10:00-12:00 第3週 | 日 10:00-12:00 | ❌ | ❌ |
| 日 10:00-12:00 代課 | 日 10:00-12:00 | ✅ (允許代課) | ✅ |
| 日 1000-1200 | 日 10:00-12:00 | ✅ (標準化) | ✅ |

**測試步驟：**
1. 在 Admin Dashboard 修改時間匹配規則
2. 測試各種時間格式組合
3. 驗證匹配結果

### 階段三：Learning Record Upload 測試

#### 7. Learning Record Upload - 向後兼容測試

**測試步驟：**
1. 開啟 `http://localhost:3000/learning-record-upload.html`
2. 上傳學習記錄檔案
3. 驗證學生匹配功能

**預期結果：**
- ✅ 學生篩選功能正常運作
- ✅ 使用共用配置
- ✅ 沒有破壞原有功能

### 階段四：配置快取測試

#### 8. 前端快取機制測試

**測試步驟：**
1. 在 Admin Dashboard 修改配置並儲存
2. 開啟 Perfect Calendar
3. 檢查 localStorage 中的快取
4. 等待 5 分鐘後重新整理
5. 驗證快取是否過期並重新載入

**驗證快取的方法：**
```javascript
// 在瀏覽器 Console 執行
console.log('快取配置:', localStorage.getItem('student_filter_config'));
console.log('快取時間:', new Date(parseInt(localStorage.getItem('student_filter_config_time'))));
```

**預期結果：**
- ✅ 配置正確快取到 localStorage
- ✅ 5 分鐘內使用快取，不發送 API 請求
- ✅ 5 分鐘後自動重新載入最新配置

### 階段五：錯誤處理測試

#### 9. API 失敗降級測試

**測試步驟：**
1. 停止伺服器
2. 開啟 Perfect Calendar
3. 觀察錯誤處理

**預期結果：**
- ✅ 顯示警告訊息：`⚠️ 獲取學生篩選配置失敗，使用預設值`
- ✅ 使用內建的預設配置
- ✅ 不影響正常使用

#### 10. 配置驗證測試

**測試步驟：**
```bash
# 測試無效的 debugMode
curl -X POST http://localhost:3000/api/student-filter-config \
  -H "Content-Type: application/json" \
  -d '{"debugMode": "invalid", "minRemainingClasses": 0, "enableRemainingCheck": true}'

# 測試負數的 minRemainingClasses
curl -X POST http://localhost:3000/api/student-filter-config \
  -H "Content-Type: application/json" \
  -d '{"debugMode": false, "minRemainingClasses": -999, "enableRemainingCheck": true}'
```

**預期結果：**
- ✅ 返回 400 錯誤和適當的錯誤訊息
- ✅ 不儲存無效配置

## 📝 測試結果記錄

### 測試日期：2025-10-19

| 測試項目 | 狀態 | 備註 |
|---------|------|------|
| 1. Admin Dashboard 配置管理 | ⏳ 待測試 | |
| 2. 配置儲存與載入 | ⏳ 待測試 | |
| 3. API 端點 | ⏳ 待測試 | |
| 4. Perfect Calendar 整合 | ⏳ 待測試 | |
| 5. 剩餘堂數篩選 | ⏳ 待測試 | |
| 6. 時間匹配規則 | ⏳ 待測試 | |
| 7. Learning Record Upload 兼容性 | ⏳ 待測試 | |
| 8. 配置快取機制 | ⏳ 待測試 | |
| 9. API 失敗降級 | ⏳ 待測試 | |
| 10. 配置驗證 | ⏳ 待測試 | |

## 🐛 已知問題

*(測試後填寫)*

## 🎯 後續改進建議

1. 考慮添加課程名稱模糊匹配功能（目前只有精確匹配）
2. 考慮添加批次測試工具，模擬各種學生資料組合
3. 考慮添加配置歷史記錄功能
4. 將 `course-reminder-management.html` 也整合到共用邏輯

## 📚 相關檔案

### 核心檔案
- `public/js/student-filter.js` - 共用篩選邏輯
- `public/js/course-student-matcher.js` - 課程匹配工具
- `server.js` - 後端 API (行 5672-5774)
- `student-filter-config.json` - 配置檔案（由 API 自動創建）

### 使用頁面
- `public/perfect-calendar-optimized-complete2.html`
- `public/learning-record-upload.html`
- `public/admin-dashboard.html`

### 測試工具
- 瀏覽器 DevTools Console
- cURL 命令行工具
- Admin Dashboard 測試功能

## 🚀 快速測試命令

```bash
# 1. 啟動伺服器
npm start

# 2. 測試 API
curl http://localhost:3000/api/student-filter-config

# 3. 查看日誌
tail -f logs/system.log

# 4. 檢查配置文件
cat student-filter-config.json
```

---

**測試人員：** _______________
**測試完成日期：** _______________
**最終評價：** ⭐⭐⭐⭐⭐

