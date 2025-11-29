# 📅 Phase 6 實施計劃 - 日曆核心模組

**狀態**: ⏸️ 暫停評估  
**決策**: 等待 Phase 1-5 生產環境穩定性驗證後再繼續  
**決策時間**: 2025-11-27 22:14  
**風險等級**: 🔴 高  
**預估時間**: 1 週

---

## 🎯 目標

將 server.js 中最核心的日曆、管理員和特殊事件相關端點遷移至模組化架構。

---

## 📊 端點清單

### 6.1 Events 模組 (6 個端點)
- [x] `GET /api/events` - 獲取行事曆事件
- [x] `POST /api/events/refresh-cache` - 手動刷新快取
- [x] `GET /api/events/cache-status` - 獲取快取狀態
- [x] `POST /api/events/mark-special` - 標記特殊事件
- [x] `POST /api/events/remove-special` - 移除特殊事件標記
- [x] `POST /api/events/clear-cache` - 清除事件快取

### 6.2 Calendar 模組 (3 個端點)
- [x] `GET /api/calendar-events` - 兼容別名
- [x] `POST /api/calendar/force-refresh` - 強制刷新行事曆
- [x] `POST /api/calendar-config` - 更新行事曆設定

### 6.3 Admin 模組 (18 個端點)
- [x] `POST /api/admin/login` - 管理員登入
- [x] `GET /api/admin/system-settings` - 讀取系統設定
- [x] `POST /api/admin/system-settings` - 儲存系統設定
- [x] `GET /api/admin/student-reminder-settings` - 讀取學生提醒設定
- [x] `POST /api/admin/student-reminder-settings` - 儲存學生提醒設定
- [x] `GET /api/admin/teacher-data` - 讀取講師資料
- [x] `POST /api/admin/teacher-data/add` - 新增講師
- [x] `POST /api/admin/teacher-data/delete` - 刪除講師
- [x] `GET /api/admin/teacher-list-data` - 讀取講師列表資料
- [x] `POST /api/admin/backup/create` - 建立備份
- [x] `GET /api/admin/backup/history` - 讀取備份歷史
- [x] `POST /api/admin/backup/restore` - 還原備份
- [x] `POST /api/admin/test-reminder` - 測試提醒發送
- [x] `GET /api/admin/info` - 獲取管理員資訊
- [x] `POST /api/admin/set` - 設定管理員
- [x] `GET /api/admin/student-sheet` - 獲取學生試算表
- [x] `GET /api/admin/groups` - 獲取群組資料
- [x] `POST /api/admin/student-sheet` - 更新學生試算表

### 6.4 Special Events 模組 (7 個端點)
- [x] `GET /api/special-events/requests` - 獲取特殊事件申請
- [x] `POST /api/special-events/requests` - 提交特殊事件申請
- [x] `GET /api/special-events-config` - 獲取特殊事件配置
- [x] `POST /api/special-events-config` - 更新特殊事件配置
- [x] `GET /api/special-event-types` - 獲取特殊事件類型
- [x] `GET /api/special-event-keywords` - 獲取關鍵字
- [x] `POST /api/detect-special-event` - 偵測特殊事件

**總計**: 34 個端點

---

## ⚠️ 風險評估

### 高風險項目
1. **Events API** - 核心功能，影響整個系統
2. **Admin 權限驗證** - 安全關鍵
3. **快取機制** - 需保持原有行為

### 降低風險策略
1. **逐模組測試** - 每個模組完成後立即測試
2. **保留原有實現** - 新舊並存，通過 Feature Flag 切換
3. **完整驗證** - 使用之前的嚴格驗證流程
4. **快速回滾** - 出問題立即關閉 Phase 6 Flag

---

## 🔧 實施步驟

### 步驟 1: 創建 Handlers ✅
- [x] `routes/handlers/eventsHandler.js`
- [x] `routes/handlers/calendarHandler.js`
- [x] `routes/handlers/adminHandler.js`
- [x] `routes/handlers/specialEventsHandler.js`

### 步驟 2: 創建 Routes
- [ ] `routes/events.js`
- [ ] `routes/calendar.js`
- [ ] `routes/admin.js`
- [ ] `routes/special-events.js`

### 步驟 3: 整合路由
- [ ] 更新 `routes/index.js` 添加 Phase 6 條件載入
- [ ] 設置 `USE_ROUTES_PHASE6=false` 環境變數

### 步驟 4: 測試
- [ ] 創建 `tests/routes/test-phase6-modules.js`
- [ ] Phase 6 關閉測試 (確保不影響原有功能)
- [ ] Phase 6 開啟測試 (確保新功能正常)
- [ ] 並存測試 (確保無衝突)

### 步驟 5: 驗證
- [ ] 運行完整系統驗證
- [ ] 性能測試
- [ ] 安全測試 (Admin 權限)
- [ ] 更新文檔

---

## 🧪 測試計劃

### 關鍵測試場景

**Events API**:
```bash
# 獲取事件
curl http://localhost:3000/api/events?start=2025-11-01&end=2025-11-30

# 刷新快取
curl -X POST http://localhost:3000/api/events/refresh-cache

# 快取狀態
curl http://localhost:3000/api/events/cache-status
```

**Admin API**:
```bash
# 登入
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"admin123"}'

# 系統設定 (需要 token)
curl http://localhost:3000/api/admin/system-settings \
  -H "Authorization: Bearer <token>"
```

**Special Events**:
```bash
# 獲取配置
curl http://localhost:3000/api/special-events-config

# 偵測事件
curl -X POST http://localhost:3000/api/detect-special-event \
  -H "Content-Type: application/json" \
  -d '{"title":"測試停課"}'
```

---

## 📋 驗收標準

### 功能完整性
- [ ] 所有 34 個端點正常運作
- [ ] 事件快取機制正常
- [ ] Admin 權限驗證正確
- [ ] 特殊事件偵測準確

### 性能要求
- [ ] Events API < 2s
- [ ] Admin API < 500ms
- [ ] 快取命中率 > 80%

### 安全要求
- [ ] Admin 端點需要驗證
- [ ] Token 機制正常
- [ ] 無權限繞過漏洞

### 兼容性
- [ ] Phase 6 關閉時，原有功能 100% 正常
- [ ] Phase 6 開啟時，新舊並存無衝突
- [ ] Feature Flag 切換無副作用

---

## 📝 進度追蹤

**開始時間**: 2025-11-27 22:10  
**預計完成**: 2025-11-28  

| 任務 | 狀態 | 完成時間 |
|------|------|----------|
| 端點分析 | ✅ | 2025-11-27 22:15 |
| Events Handler | 🚧 | - |
| Calendar Handler | ⏳ | - |
| Admin Handler | ⏳ | - |
| Special Events Handler | ⏳ | - |
| Routes 創建 | ⏳ | - |
| 整合測試 | ⏳ | - |
| 完整驗證 | ⏳ | - |
| 文檔更新 | ⏳ | - |

---

## 🔄 回滾計劃

如果 Phase 6 出現問題：

```bash
# 立即關閉 Phase 6
export USE_ROUTES_PHASE6=false

# 重啟服務
pm2 restart flb-calendar-nas

# 驗證恢復
curl http://localhost:3000/health
curl http://localhost:3000/api/events
```

---

**負責人**: Cascade AI Assistant  
**審核**: 待用戶確認  
**風險等級**: 🔴 高 - 需要特別謹慎
