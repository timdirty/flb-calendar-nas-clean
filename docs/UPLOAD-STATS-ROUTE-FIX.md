# 上傳統計 API 路由修復記錄

## 📅 修復日期
2025-01-19

## 🔥 問題描述

### 現象
前端呼叫 `/api/v2/courses/upload-stats` 返回 404 錯誤，但後端已經實作該端點。

### 根本原因
**路由優先級問題** - Express 路由匹配採用「先到先得」原則，具體路徑 `/courses/upload-stats` 被動態路由 `/courses/:id` 提前攔截。

#### 原路由順序（錯誤）
```javascript
router.get('/courses', ...);           // ✅ 正常
router.get('/courses/:id', ...);       // ❌ 攔截所有 /courses/* 請求
router.get('/courses/search', ...);    // ❌ 永遠無法到達
router.get('/courses/upload-stats', ...); // ❌ 永遠無法到達
```

當呼叫 `/api/v2/courses/upload-stats` 時：
1. Express 從上到下匹配路由
2. `/courses/:id` 匹配成功（將 `upload-stats` 視為課程 ID）
3. 後續的 `/courses/upload-stats` 永遠不會被執行
4. 返回「課程不存在」錯誤

## ✅ 解決方案

### 修改檔案
`/routes/v2-courses.js`

### 修復方法
將具體路徑路由移到動態路由之前：

```javascript
// ✅ 正確的路由順序
router.get('/courses', ...);              // 列表
router.get('/courses/search', ...);       // 🔥 移到 :id 前面
router.get('/courses/upload-stats', ...); // 🔥 移到 :id 前面
router.get('/courses/:id', ...);          // 動態路由放最後
```

### 關鍵變更
1. **移動 `/courses/search`**（第 322-373 行）
   - 從第 381 行移到第 326 行
   - 在 `/courses/:id` 之前註冊

2. **移動 `/courses/upload-stats`**（第 375-528 行）
   - 從第 440 行移到第 385 行
   - 在 `/courses/:id` 之前註冊

3. **刪除重複路由**（第 585-791 行）
   - 移除原位置的重複定義
   - 避免混淆和維護問題

## 🧪 測試驗證

### 測試腳本
`/tests/test-upload-stats-api.js`

### 測試結果
```
✅ 測試 1: SPIKE 五 16:10-17:40 松山 - 通過
✅ 測試 2: SPM 三 16:30-17:30 到府 - 通過
✅ 測試 3: 缺少參數測試 - 通過
📈 通過率: 100.0%
```

### API 回應範例
```json
{
  "success": true,
  "data": {
    "eventId": null,
    "date": "2025-01-19",
    "courseName": "SPIKE 五 1610-1740 松山",
    "studentCount": 5,
    "uploadedStudentCount": 0,
    "totalUploadedFiles": 0,
    "overviewUploaded": false,
    "uploadPercentage": 0,
    "lastUpdatedAt": null
  }
}
```

## 📊 影響範圍

### 修復的端點
- ✅ `GET /api/v2/courses/upload-stats` - 現在可以正常訪問
- ✅ `GET /api/v2/courses/search` - 確保不被攔截

### 不受影響的端點
- ✅ `GET /api/v2/courses` - 列表查詢
- ✅ `GET /api/v2/courses/:id` - 單一課程查詢（動態路由）

## 💡 經驗教訓

### Express 路由最佳實踐
1. **具體路徑優先** - 靜態路由應該在動態路由之前註冊
2. **動態路由放最後** - 帶 `:id` 參數的路由應該在最後
3. **避免重複定義** - 同一路由只定義一次
4. **遵循順序規則**：
   ```
   /resource
   /resource/specific-action-1
   /resource/specific-action-2
   /resource/:id              ← 動態路由最後
   /resource/:id/sub-resource
   ```

### 路由衝突檢測
使用以下命令檢查路由定義：
```bash
grep -n "router.get('/courses" routes/v2-courses.js
```

## 🔗 相關文檔
- [Express 路由文檔](https://expressjs.com/en/guide/routing.html)
- `/docs/CALENDAR-UPLOAD-STATS-IMPLEMENTATION-PLAN.md` - 原始實作計畫
- `/docs/CALENDAR-UPLOAD-STATS-CHANGELOG.md` - 變更記錄

## ✅ 驗證清單
- [x] API 端點正常響應
- [x] 返回正確的統計資料
- [x] 參數驗證正常工作
- [x] 測試腳本全部通過
- [x] 文檔已更新
- [x] 路由順序正確

## 🚀 下一步
- [ ] 前端整合測試（在日曆介面中驗證）
- [ ] 效能監控（大量課程查詢）
- [ ] 增加更多測試用例
