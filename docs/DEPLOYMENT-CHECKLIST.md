# 🚀 Phase 1-5 部署檢查清單

**版本**: Phase 1-5 完成版  
**更新日期**: 2025-11-27  
**狀態**: 準備部署

---

## ✅ 部署前檢查 (Pre-Deployment)

### 代碼準備

- [ ] 所有代碼已提交到 Git
- [ ] 創建部署分支或標籤
- [ ] 代碼審查完成（如適用）
- [ ] 所有測試通過（58/58）
- [ ] 文檔已更新

### 環境準備

- [ ] 複製 `.env.production.example` 為 `.env.production`
- [ ] 填寫所有必要的環境變數
- [ ] 驗證 Synology Calendar 連線
- [ ] 驗證 Synology Drive 連線
- [ ] 驗證 Google Sheets 連線
- [ ] 驗證 LINE 連線

### 備份

- [ ] 備份當前生產環境代碼
- [ ] 備份所有 JSON 配置文件
  - `notification-config.json`
  - `student-reminder-settings.json`
  - `system-settings.json`
  - `teacher_data.json`
- [ ] 備份數據庫（如有）
- [ ] 記錄當前系統狀態

### 監控準備

- [ ] 設置性能監控
- [ ] 配置錯誤告警
- [ ] 準備日誌收集
- [ ] 測試告警通知

---

## 🚀 部署流程 (Deployment)

### Week 1: 代碼部署（所有 Phase Flags 關閉）

#### Day 1: 部署代碼

```bash
# 1. 進入專案目錄
cd /path/to/flb-calendar-nas

# 2. 拉取最新代碼
git pull origin main  # 或您的分支名稱

# 3. 安裝依賴（如有更新）
npm install

# 4. 確認環境變數
cat .env.production | grep USE_ROUTES

# 應該看到:
# USE_ROUTES_PHASE1=false
# USE_ROUTES_PHASE2=false
# USE_ROUTES_PHASE3=false
# USE_ROUTES_PHASE4=false
# USE_ROUTES_PHASE5=false

# 5. 重啟服務
pm2 restart flb-calendar-nas

# 或使用其他方式
# npm run start
```

#### Day 1-3: 驗證基本功能

```bash
# 檢查服務狀態
pm2 status

# 檢查日誌
pm2 logs flb-calendar-nas --lines 100

# 測試關鍵端點
curl http://calendar.funlearnbar.synology.me/health
curl http://calendar.funlearnbar.synology.me/api/events
curl http://calendar.funlearnbar.synology.me/api/students
```

**檢查項目**:
- [ ] 服務正常啟動
- [ ] 無錯誤日誌
- [ ] Health Check 返回 OK
- [ ] Events API 正常
- [ ] Students API 正常
- [ ] 簽到功能正常
- [ ] 通知發送正常

**監控指標**（48 小時）:
- [ ] CPU 使用率正常（< 70%）
- [ ] 記憶體使用正常（< 80%）
- [ ] 錯誤率 < 0.1%
- [ ] 無用戶投訴

---

### Week 2: 逐步啟用 Phase 2-5

#### Day 4-5: 啟用 Phase 2（獨立模組）

```bash
# 修改環境變數
export USE_ROUTES_PHASE2=true

# 重啟服務
pm2 restart flb-calendar-nas

# 驗證
curl http://calendar.funlearnbar.synology.me/api/v3/health
curl http://calendar.funlearnbar.synology.me/api/v3/holidays
```

**檢查項目**:
- [ ] V3 Health 端點正常
- [ ] V3 Holidays 端點正常
- [ ] 原有功能不受影響
- [ ] 無錯誤日誌

**監控**（24 小時）:
- [ ] 響應時間無惡化
- [ ] 錯誤率 < 0.1%
- [ ] 記憶體穩定

#### Day 6: 啟用 Phase 3（學生管理）

```bash
export USE_ROUTES_PHASE3=true
pm2 restart flb-calendar-nas

# 驗證學生管理功能
curl http://calendar.funlearnbar.synology.me/api/v3/students
curl http://calendar.funlearnbar.synology.me/api/v3/attendance/queue/status
```

**檢查項目**:
- [ ] V3 Students API 正常
- [ ] V3 Attendance API 正常
- [ ] 簽到流程正常
- [ ] 補課功能正常
- [ ] 請假功能正常

#### Day 7: 啟用 Phase 4（通知系統）

```bash
export USE_ROUTES_PHASE4=true
pm2 restart flb-calendar-nas

# 驗證通知功能
curl http://calendar.funlearnbar.synology.me/api/v3/notifications/queue/status
```

**檢查項目**:
- [ ] V3 Notifications API 正常
- [ ] V3 Reminders API 正常
- [ ] LINE 通知正常發送
- [ ] 課程提醒正常

#### Day 8-9: 啟用 Phase 5（媒體系統）

```bash
export USE_ROUTES_PHASE5=true
pm2 restart flb-calendar-nas

# 驗證媒體功能
curl http://calendar.funlearnbar.synology.me/api/v3/drive-media/records
curl http://calendar.funlearnbar.synology.me/api/v3/learning-records/history-drive?semester=114-1
```

**檢查項目**:
- [ ] V3 Drive Media API 正常
- [ ] V3 Drive Upload 正常
- [ ] V3 Learning Records 正常
- [ ] 檔案上傳功能正常
- [ ] 學習歷程查詢正常

---

### Week 3: 全面監控和評估

#### 監控儀表板

**系統健康**:
```
CPU 使用率: _____ % (目標 < 70%)
記憶體使用: _____ % (目標 < 80%)
磁碟 I/O: _____ % (目標 < 60%)
服務 Uptime: _____ % (目標 > 99.9%)
```

**API 性能**:
```
平均響應時間: _____ ms (目標 < 500ms)
P95 響應時間: _____ ms (目標 < 2s)
P99 響應時間: _____ ms (目標 < 3s)
錯誤率: _____ % (目標 < 0.1%)
```

**業務指標**:
```
事件快取命中率: _____ % (目標 > 80%)
簽到成功率: _____ % (目標 > 99%)
通知送達率: _____ % (目標 > 95%)
檔案上傳成功率: _____ % (目標 > 98%)
```

#### 用戶反饋

- [ ] 收集用戶反饋
- [ ] 處理用戶問題
- [ ] 記錄改進建議

---

## 🚨 緊急回滾流程

### 何時回滾

**立即回滾**:
- 🚨 錯誤率 > 1%
- 🚨 API 完全無響應
- 🚨 數據丟失或損壞
- 🚨 安全漏洞發現
- 🚨 大量用戶投訴

**考慮回滾**:
- ⚠️ 錯誤率 > 0.5%
- ⚠️ 響應時間 > 5s
- ⚠️ 記憶體持續增長
- ⚠️ 功能異常報告

### 回滾步驟

```bash
# 1. 立即關閉所有 Phase Flags
export USE_ROUTES_PHASE1=false
export USE_ROUTES_PHASE2=false
export USE_ROUTES_PHASE3=false
export USE_ROUTES_PHASE4=false
export USE_ROUTES_PHASE5=false

# 2. 重啟服務
pm2 restart flb-calendar-nas

# 3. 驗證恢復
curl http://calendar.funlearnbar.synology.me/health
curl http://calendar.funlearnbar.synology.me/api/events

# 4. 檢查日誌
pm2 logs flb-calendar-nas --lines 50

# 5. 通知團隊
# 發送回滾通知

# 6. 如果環境變數回滾無效，回滾代碼
git checkout previous-stable-version
npm install
pm2 restart flb-calendar-nas
```

### 回滾後檢查

- [ ] 所有核心功能恢復
- [ ] 錯誤率恢復正常
- [ ] 用戶可正常使用
- [ ] 記錄回滾原因
- [ ] 分析問題根因

---

## 📋 部署後檢查 (Post-Deployment)

### Day 10: 全面評估

**功能驗證**:
- [ ] 所有 V3 API 正常運作
- [ ] 原有 API 不受影響
- [ ] 新舊 API 數據一致
- [ ] 無功能退化

**性能驗證**:
- [ ] 響應時間符合標準
- [ ] 記憶體使用穩定
- [ ] CPU 使用正常
- [ ] 無資源洩漏

**安全驗證**:
- [ ] 權限控制正常
- [ ] Token 驗證有效
- [ ] 無安全漏洞
- [ ] 日誌審計通過

**用戶滿意度**:
- [ ] 無用戶投訴
- [ ] 功能使用順暢
- [ ] 性能符合預期

---

## 📊 成功標準

部署被認為成功需要滿足：

1. **穩定運行** ✅
   - 連續 7 天無重大問題
   - 錯誤率 < 0.1%
   - Uptime > 99.9%

2. **性能達標** ✅
   - 響應時間無明顯惡化
   - 記憶體使用穩定
   - CPU 使用正常

3. **功能完整** ✅
   - 所有測試通過
   - 無功能退化
   - 用戶滿意

4. **可維護性** ✅
   - 日誌清晰
   - 監控有效
   - 問題可追溯

---

## 📝 部署記錄

### 部署日誌

| 日期 | 操作 | 執行人 | 狀態 | 備註 |
|------|------|--------|------|------|
| YYYY-MM-DD | 部署 Phase 1-5 代碼 | | ⏳ | Flags 關閉 |
| YYYY-MM-DD | 啟用 Phase 2 | | ⏳ | |
| YYYY-MM-DD | 啟用 Phase 3 | | ⏳ | |
| YYYY-MM-DD | 啟用 Phase 4 | | ⏳ | |
| YYYY-MM-DD | 啟用 Phase 5 | | ⏳ | |
| YYYY-MM-DD | 全面評估 | | ⏳ | |

### 問題記錄

| 日期 | 問題描述 | 影響範圍 | 解決方案 | 狀態 |
|------|---------|---------|---------|------|
| | | | | |

### 改進建議

| 日期 | 建議 | 優先級 | 負責人 | 狀態 |
|------|------|--------|--------|------|
| | | | | |

---

## 🎯 下一步

部署成功後：

1. **Week 4**: 收集反饋，優化性能
2. **Week 5-6**: 評估 Phase 6 開發時機
3. **持續改進**: 根據監控數據調整

---

**負責人簽名**: _____________  
**審核人簽名**: _____________  
**日期**: _____________
