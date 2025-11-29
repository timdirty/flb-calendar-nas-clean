# 🔄 Synology Calendar API 遷移說明

## 📋 更新內容

### 從 CalDAV 協議遷移到官方 Synology Calendar API

#### ✅ 新增檔案
1. **synology-calendar-client.js** - 新的 Synology Calendar API 客戶端
   - 使用官方 Synology WebAPI
   - 支援 Session 認證
   - 完整的錯誤處理和重試機制

#### 📝 修改檔案
1. **server.js** - 更新為使用新的 API 客戶端
2. **.env.nas** - 更新 API URL 配置
3. **caldav-client.js** - 保留作為備份（可選）

---

## 🚀 API 端點說明

### 認證
```
POST /webapi/auth.cgi
- api: SYNO.API.Auth
- method: login
- account: 用戶名
- passwd: 密碼
- session: Calendar
```

### 獲取日曆列表
```
GET /webapi/entry.cgi
- api: SYNO.Cal.Cal
- method: list
- _sid: Session ID
```

### 獲取事件
```
GET /webapi/entry.cgi
- api: SYNO.Cal.Event
- method: list
- cal_id: 日曆 ID
- start: 開始時間戳
- end: 結束時間戳
- _sid: Session ID
```

---

## 🔧 環境變數配置

```bash
# Synology Calendar API 配置
CALDAV_URL=https://funlearnbar.synology.me:9102
CALDAV_USERNAME=testacount
CALDAV_PASSWORD=testacount

# LINE LIFF 配置
LIFF_CLIENT_ID=2006697806-9J1YDavm

# 伺服器配置
PORT=3000
NODE_ENV=production
```

**⚠️ 重要：**
- URL 不再包含 `/caldav` 路徑
- 使用標準 Synology WebAPI 端點
- Session 會自動管理和刷新

---

## 📦 部署步驟

### 方法 1：自動部署（推薦）

```bash
cd "/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

# 執行遠程部署腳本
./remote-redeploy.sh
```

### 方法 2：SSH 手動部署

```bash
# 1. SSH 連接到 NAS
ssh ctctim14@funlearnbar.synology.me

# 2. 進入項目目錄
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas

# 3. 確認文件已同步
ls -la synology-calendar-client.js .env.nas

# 4. 重啟 Docker 服務
sudo docker-compose down
sudo docker-compose build --no-cache
sudo docker-compose up -d

# 5. 查看日誌確認啟動成功
sudo docker-compose logs -f
```

---

## ✅ 部署後驗證

### 1. 檢查容器狀態
```bash
sudo docker-compose ps
```

應該顯示服務正在運行

### 2. 查看日誌
```bash
sudo docker-compose logs --tail=100
```

應該看到：
```
✅ Synology Calendar API 客戶端初始化
📡 API Base URL: https://funlearnbar.synology.me:9102
👤 用戶名: testacount
```

### 3. 測試 API 端點

在瀏覽器控制台執行：
```javascript
// 清除舊快取
localStorage.clear();
sessionStorage.clear();

// 測試 API
fetch('/api/events')
  .then(r => r.json())
  .then(data => {
    console.log('✅ API 回應:', data);
    console.log('📊 事件數量:', data.events?.length || 0);
    console.log('📡 資料來源:', data.source);
  });
```

**預期結果：**
- ✅ `success: true`
- ✅ `source: "synology"` 或 `"caldav"`（不再是 `"mock"`）
- ✅ `events.length > 0`

---

## 🐛 故障排除

### 問題 1：401 認證錯誤
**原因：** 用戶名或密碼錯誤

**解決：** 檢查 `.env.nas` 中的認證資訊

### 問題 2：連接超時
**原因：** NAS 網路不可達

**解決：** 
1. 確認 NAS 在線：`ping funlearnbar.synology.me`
2. 確認端口開放：`telnet funlearnbar.synology.me 9102`

### 問題 3：返回空事件
**原因：** 日曆為空或時間範圍不正確

**解決：**
1. 登入 NAS Calendar 確認有事件
2. 檢查日誌中的時間範圍

---

## 📊 性能優化

新的 Synology API 客戶端提供：

1. **Session 管理** - 自動維護和刷新 Session
2. **錯誤重試** - 401 錯誤自動重新登入
3. **並行請求** - 同時獲取多個日曆的事件
4. **詳細日誌** - 完整的操作追蹤

---

## 📚 參考資料

- Synology Calendar API 官方文檔
- /webapi/query.cgi - 查詢可用 API
- DSM > 套件中心 > Calendar > 設定 > API

---

## 🎉 預期改進

- ✅ 不再有 HTTP 405 錯誤
- ✅ 正確讀取所有講師的日曆
- ✅ 快速響應（使用 Session 認證）
- ✅ 完整的錯誤處理
- ✅ 自動重試機制

---

**最後更新：** 2025-10-09
**版本：** 2.0.0 - Synology API Migration


