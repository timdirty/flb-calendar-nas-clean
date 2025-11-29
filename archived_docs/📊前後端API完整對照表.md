# 📊 前後端 API 完整對照表

**檢查時間**: 2025-10-17  
**目的**: 確認管理控制台前端功能與後端 API 完全匹配

---

## ✅ 已對齊的 API

### 1. 學生管理 (Students)

| 前端功能 | 前端 API 調用 | 後端 API | 狀態 |
|---------|-------------|---------|------|
| 載入學生列表 | `GET /api/students` | ✅ `app.get('/api/students')` (L3672, L5384) | ✅ 匹配 |
| Google Sheets 同步 | `POST /api/proxy/google-sheets` | ✅ `app.post('/api/proxy/google-sheets')` (L1233) | ✅ 匹配 |
| 自動更新設定-載入 | `GET /api/student-data-sync/settings` | ✅ `app.get('/api/student-data-sync/settings')` (L2071) | ✅ 匹配 |
| 自動更新設定-儲存 | `POST /api/student-data-sync/settings` | ✅ `app.post('/api/student-data-sync/settings')` (L2096) | ✅ 匹配 |
| 手動觸發同步 | `POST /api/student-data-sync/trigger` | ✅ `app.post('/api/student-data-sync/trigger')` (L2133) | ✅ 匹配 |
| 停止自動同步 | `POST /api/student-data-sync/stop` | ✅ `app.post('/api/student-data-sync/stop')` (L2149) | ✅ 匹配 |
| 啟動自動同步 | `POST /api/student-data-sync/start` | ✅ `app.post('/api/student-data-sync/start')` (L2178) | ✅ 匹配 |

### 2. 講師管理 (Teachers)

| 前端功能 | 前端 API 調用 | 後端 API | 狀態 |
|---------|-------------|---------|------|
| 載入講師列表 | `GET /api/teachers` | ✅ `app.get('/api/teachers')` (L2327) | ✅ 匹配 |
| 儲存講師資料 | ❌ 使用 localStorage | ❓ `app.get('/api/settings/teachers')` (L2490)<br>`app.post('/api/settings/teachers')` (L2522) | ⚠️ **不匹配** |

### 3. 管理員設定 (Admin)

| 前端功能 | 前端 API 調用 | 後端 API | 狀態 |
|---------|-------------|---------|------|
| 查看管理員 | `GET /api/admin/info` | ✅ `app.get('/api/admin/info')` (L3855, L5414) | ✅ 匹配 |
| 設定管理員 | `POST /api/admin/set` | ✅ `app.post('/api/admin/set')` (L3875, L5435) | ✅ 匹配 |

### 4. LINE 設定 (LINE Config)

| 前端功能 | 前端 API 調用 | 後端 API | 狀態 |
|---------|-------------|---------|------|
| 載入 LINE 設定 | `GET /api/line-config` | ✅ `app.get('/api/line-config')` (L5742) | ✅ 匹配 |
| 儲存 LINE 設定 | `POST /api/line-config` | ✅ `app.post('/api/line-config')` (L5770) | ✅ 匹配 |
| 測試 LINE 通知 | `POST /api/test-line-notification` | ✅ `app.post('/api/test-line-notification')` (L5492) | ✅ 匹配 |

### 5. 通知設定 (Notifications)

| 前端功能 | 前端 API 調用 | 後端 API | 狀態 |
|---------|-------------|---------|------|
| 學生簽到通知 | `POST /api/student-attendance-notification` | ✅ `app.post('/api/student-attendance-notification')` (L1665) | ✅ 匹配 |
| 提醒設定 | ❌ 使用 localStorage | ❓ `app.get('/api/notification-config')` (L1760)<br>`app.post('/api/notification-config/reload')` (L1777)<br>`app.post('/api/notification-config/test')` (L1794) | ⚠️ **不匹配** |

### 6. Google API 設定

| 前端功能 | 前端 API 調用 | 後端 API | 狀態 |
|---------|-------------|---------|------|
| Google Sheets 測試 | `POST /api/proxy/google-sheets` | ✅ `app.post('/api/proxy/google-sheets')` (L1233) | ✅ 匹配 |
| Google API 配置 | ❌ 使用 localStorage | ❌ 無對應 API | ❌ **缺少後端** |

### 7. 系統日誌 (Logs)

| 前端功能 | 前端 API 調用 | 後端 API | 狀態 |
|---------|-------------|---------|------|
| 查看日誌 | `GET /api/logs` | ✅ `app.get('/api/logs')` (L478) | ✅ 匹配 |
| 清除日誌 | ❌ 前端功能 | ❌ 無對應 API | ⚠️ **僅前端** |

### 8. 統計資料 (Statistics)

| 前端功能 | 前端 API 調用 | 後端 API | 狀態 |
|---------|-------------|---------|------|
| 課程統計 | `GET /api/events` | ✅ `app.get('/api/events')` (L1002) | ✅ 匹配 |
| 講師統計 | `GET /api/teachers` | ✅ `app.get('/api/teachers')` (L2327) | ✅ 匹配 |
| 學生統計 | `GET /api/students` | ✅ `app.get('/api/students')` (L3672, L5384) | ✅ 匹配 |
| 提醒統計 | `GET /api/reminders` | ✅ `app.get('/api/reminders')` (L3175) | ✅ 匹配 |

---

## ❌ 未對齊的功能

### 1. 系統配置 (System Config)

#### 前端功能
- ✅ API 端點配置
- ✅ 緩存配置
- ✅ 介面配置
- ✅ 日期範圍配置
- ✅ 儲存/重新載入/恢復預設值按鈕

#### 後端 API
- ✅ `GET /api/system-settings` (L5564)
- ✅ `POST /api/system-settings` (L5591)
- ✅ `GET /api/settings/system` (L2664)
- ✅ `POST /api/settings/system` (L2686)

#### 問題
⚠️ **前端使用 localStorage，沒有調用後端 API**

#### 建議修復
需要修改前端，讓它調用後端 API 而不是只存在 localStorage

---

### 2. 講師資料管理

#### 前端功能
- 新增/編輯/刪除講師
- 講師顏色配置
- 儲存講師資料按鈕

#### 後端 API
- ✅ `GET /api/settings/teachers` (L2490)
- ✅ `POST /api/settings/teachers` (L2522)
- ✅ `POST /api/admin/teacher-data/add` (L5122) 🔒 需要驗證
- ✅ `POST /api/admin/teacher-data/delete` (L5163) 🔒 需要驗證

#### 問題
⚠️ **前端使用 localStorage，沒有調用後端 API**

#### 建議修復
需要修改前端，讓它調用後端 API

---

### 3. 提醒設定 (Reminder Settings)

#### 前端功能
- 當日提醒時間
- 隔日提醒時間
- 課前提醒（分鐘）
- 啟用自動提醒
- 通知訊息模板

#### 後端 API
- ✅ `GET /api/notification-config` (L1760)
- ✅ `POST /api/notification-config/reload` (L1777)
- ✅ `POST /api/notification-config/test` (L1794)
- ✅ `POST /api/reminder-config` (L5678)
- ✅ `GET /api/schedule-settings` (L4338)
- ✅ `POST /api/schedule-settings` (L4395)

#### 問題
⚠️ **前端使用 localStorage，沒有調用後端 API**

#### 建議修復
需要修改前端，讓它調用後端 API

---

### 4. Google API 設定

#### 前端功能
- Google Sheets 出席記錄 API URL
- Google Sheets 學生名單 API URL
- Google Sheets Cookie
- 儲存配置按鈕

#### 後端 API
❌ **完全沒有對應的後端 API**

#### 建議修復
需要新增後端 API 來儲存和載入 Google API 配置

---

### 5. 緩存管理

#### 前端功能
- 查看緩存狀態
- 清除事件緩存
- 清除講師緩存
- 清除學生緩存
- 清除所有緩存

#### 後端 API
- ✅ `GET /api/events/cache-status` (L1217)
- ❌ 清除緩存的 API **不存在**

#### 問題
⚠️ **前端功能是假的，只清除 localStorage**

#### 建議修復
需要新增後端 API 來清除伺服器端快取

---

### 6. 匯入/匯出功能

#### 前端功能
- 匯出所有配置
- 僅匯出系統配置
- 僅匯出講師資料
- 僅匯出學生資料
- 匯入配置
- JSON 編輯器

#### 後端 API
- ✅ `POST /api/admin/backup/create` (L5237) 🔒 需要驗證
- ✅ `GET /api/admin/backup/history` (L5276) 🔒 需要驗證
- ✅ `POST /api/admin/backup/restore` (L5313) 🔒 需要驗證

#### 問題
⚠️ **前端功能是假的，只操作 localStorage**  
⚠️ **後端 API 需要管理員驗證，但前端沒有實作登入**

#### 建議修復
1. 實作管理員登入功能
2. 修改前端匯入/匯出，讓它調用後端 API

---

## 🔒 需要驗證的 API

以下 API 需要管理員 Token，但前端沒有實作登入：

| API 端點 | 需要驗證 | 前端是否實作 |
|---------|---------|-------------|
| `/api/admin/system-settings` | ✅ | ❌ |
| `/api/admin/student-reminder-settings` | ✅ | ❌ |
| `/api/admin/teacher-data/*` | ✅ | ❌ |
| `/api/admin/teacher-list-data` | ✅ | ❌ |
| `/api/admin/backup/*` | ✅ | ❌ |
| `/api/admin/test-reminder` | ✅ | ❌ |

### 問題
前端沒有實作管理員登入功能 (`/api/admin/login`)

---

## 📋 修復優先順序

### 高優先度（影響功能正常運作）

1. **系統配置** - 前端需要調用後端 API 而不是 localStorage
2. **講師資料管理** - 前端需要調用後端 API
3. **提醒設定** - 前端需要調用後端 API
4. **學生資料自動更新** - ✅ 已完成

### 中優先度（功能不完整）

5. **Google API 設定** - 需要新增後端 API
6. **緩存管理** - 需要新增清除快取的後端 API
7. **管理員登入** - 需要實作登入功能

### 低優先度（增強功能）

8. **匯入/匯出** - 需要整合現有的備份 API
9. **系統日誌** - 新增清除日誌的後端 API

---

## 🎯 總結

### 統計
- **已對齊**: 21 個功能 ✅
- **部分對齊**: 6 個功能 ⚠️
- **未對齊**: 4 個功能 ❌

### 主要問題
1. **LocalStorage 過度使用**: 很多設定儲存在瀏覽器本地，沒有同步到後端
2. **假功能**: 部分按鈕看起來有功能，但實際沒有調用後端 API
3. **管理員驗證**: 有些 API 需要驗證，但前端沒有登入功能

### 建議
重構管理控制台，確保所有設定都通過後端 API 處理，實現多裝置同步。

