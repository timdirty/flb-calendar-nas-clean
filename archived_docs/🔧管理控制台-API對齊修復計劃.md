# 🔧 管理控制台 - API 對齊修復計劃

**建立時間**: 2025-10-17  
**目的**: 修復前後端 API 不匹配的問題

---

## 📊 現況分析

根據完整的前後端 API 對照檢查，發現以下問題：

### ✅ 已正常運作 (7 個功能)
1. 學生資料管理（包含新增的自動更新功能）
2. 管理員設定
3. LINE API 設定
4. 學生簽到通知
5. 系統日誌查看
6. Google Sheets 同步測試
7. 統計資料顯示

### ⚠️  需要修復 (6 個功能)
1. **系統配置** - 使用 localStorage 而非後端 API
2. **講師資料管理** - 使用 localStorage 而非後端 API  
3. **提醒設定** - 使用 localStorage 而非後端 API
4. **Google API 設定** - 沒有後端 API
5. **緩存管理** - 清除功能僅在前端
6. **匯入/匯出** - 功能不完整

---

## 🎯 修復方案

### 方案 A：快速修復（推薦）
**目標**: 修復最關鍵的功能，讓設定可以跨裝置同步

**修復項目**:
1. ✅ 系統配置 → 調用現有的 `/api/system-settings`
2. ✅ 講師資料 → 調用現有的 `/api/settings/teachers`
3. ✅ 提醒設定 → 調用現有的 `/api/schedule-settings`
4. ✅ Google API 設定 → 新增簡單的後端 API

**估計時間**: 2-3 小時

### 方案 B：完整修復
**目標**: 所有功能都完整實作

**修復項目**:
- 方案 A 的所有項目
- 實作管理員登入功能
- 整合備份/還原 API
- 新增緩存管理 API
- 完整的錯誤處理

**估計時間**: 1-2 天

---

## 🔧 具體修復步驟

### 1. 系統配置修復

#### 現況
前端使用 `localStorage.setItem('flb_admin_config_system', ...)`

#### 修復
```javascript
// 儲存設定
async function saveSystemConfig() {
    const config = {
        apiEndpoints: { /* ... */ },
        cacheConfig: { /* ... */ },
        interfaceConfig: { /* ... */ },
        dateRangeConfig: { /* ... */ }
    };
    
    const response = await fetch('/api/system-settings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(config)
    });
}

// 載入設定
async function loadSystemConfig() {
    const response = await fetch('/api/system-settings');
    const result = await response.json();
    // 填充表單
}
```

#### 後端 API
✅ 已存在：
- `GET /api/system-settings` (L5564)
- `POST /api/system-settings` (L5591)

---

### 2. 講師資料修復

#### 現況
前端使用 `localStorage.setItem('flb_admin_config_teachers', ...)`

#### 修復
```javascript
// 儲存講師資料
async function saveTeachers() {
    const response = await fetch('/api/settings/teachers', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(currentConfig.teachers)
    });
}

// 載入講師資料
async function loadTeachers() {
    const response = await fetch('/api/settings/teachers');
    const result = await response.json();
    currentConfig.teachers = result.data;
    renderTeachersTable();
}
```

#### 後端 API
✅ 已存在：
- `GET /api/settings/teachers` (L2490)
- `POST /api/settings/teachers` (L2522)

---

### 3. 提醒設定修復

#### 現況
前端使用 `localStorage.setItem('flb_admin_config_notifications', ...)`

#### 修復
```javascript
// 儲存提醒設定
async function saveNotificationConfig() {
    const config = {
        todayReminderTime: document.getElementById('todayReminderTime').value,
        nextDayReminderTime: document.getElementById('nextDayReminderTime').value,
        beforeClassMinutes: parseInt(document.getElementById('beforeClassMinutes').value),
        autoReminderEnabled: document.getElementById('autoReminderEnabled').checked,
        // ...
    };
    
    const response = await fetch('/api/schedule-settings', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(config)
    });
}

// 載入提醒設定
async function loadNotificationConfig() {
    const response = await fetch('/api/schedule-settings');
    const result = await response.json();
    // 填充表單
}
```

#### 後端 API
✅ 已存在：
- `GET /api/schedule-settings` (L4338)
- `POST /api/schedule-settings` (L4395)

---

### 4. Google API 設定修復

#### 現況
前端使用 `localStorage.setItem('flb_admin_config_google', ...)`

#### 需要新增
後端需要新增 API 來儲存 Google API 配置

#### 修復（後端）
```javascript
// 新增到 server.js

// 獲取 Google API 設定
app.get('/api/google-api-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'google-api-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      res.json({success: true, data: config});
    } else {
      res.json({success: true, data: {}});
    }
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

// 儲存 Google API 設定
app.post('/api/google-api-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'google-api-config.json');
    fs.writeFileSync(configPath, JSON.stringify(req.body, null, 2));
    res.json({success: true, message: '設定已儲存'});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});
```

#### 修復（前端）
```javascript
// 載入 Google API 設定
async function loadGoogleConfig() {
    const response = await fetch('/api/google-api-config');
    const result = await response.json();
    if (result.success && result.data) {
        document.getElementById('googleSheetsAttendanceUrl').value = result.data.attendanceUrl || '';
        document.getElementById('googleSheetsRosterUrl').value = result.data.rosterUrl || '';
        document.getElementById('googleSheetsCookie').value = result.data.cookie || '';
    }
}

// 儲存 Google API 設定
async function saveGoogleConfig() {
    const config = {
        attendanceUrl: document.getElementById('googleSheetsAttendanceUrl').value,
        rosterUrl: document.getElementById('googleSheetsRosterUrl').value,
        cookie: document.getElementById('googleSheetsCookie').value
    };
    
    const response = await fetch('/api/google-api-config', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(config)
    });
}
```

---

### 5. 緩存管理修復

#### 現況
前端的清除緩存只清除 localStorage，沒有清除伺服器快取

#### 需要新增（後端）
```javascript
// 清除事件快取
app.post('/api/events/clear-cache', (req, res) => {
  eventsCache.data = null;
  eventsCache.lastUpdate = null;
  res.json({success: true, message: '事件快取已清除'});
});

// 清除所有快取
app.post('/api/cache/clear-all', (req, res) => {
  eventsCache.data = null;
  eventsCache.lastUpdate = null;
  memoryDB.clear();
  res.json({success: true, message: '所有快取已清除'});
});
```

#### 修復（前端）
```javascript
async function clearEventsCache() {
    if (confirm('確定要清除事件緩存嗎？')) {
        const response = await fetch('/api/events/clear-cache', {
            method: 'POST'
        });
        const result = await response.json();
        if (result.success) {
            showAlert('✅ 事件快取已清除', 'success');
            loadCacheStatus();
        }
    }
}
```

---

## 📝 修復檢查清單

### 階段 1：關鍵功能 (高優先度)
- [ ] 系統配置 - 調用後端 API
- [ ] 講師資料 - 調用後端 API
- [ ] 提醒設定 - 調用後端 API
- [ ] Google API 設定 - 新增後端 API

### 階段 2：增強功能 (中優先度)
- [ ] 緩存管理 - 新增後端 API
- [ ] 清除日誌 - 新增後端 API

### 階段 3：完整功能 (低優先度)
- [ ] 管理員登入 - 實作完整驗證
- [ ] 匯入/匯出 - 整合備份 API

---

## 🚀 開始修復

**建議**: 從階段 1 開始，逐步修復每個功能

**測試**: 每修復一個功能，立即測試前後端是否正常運作

**文檔**: 更新 API 文檔，記錄所有變更

