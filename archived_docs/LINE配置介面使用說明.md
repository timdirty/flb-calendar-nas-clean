# 📱 LINE 配置介面使用說明

## ✨ 新功能

現在您可以直接在**管理控制台**設定 LINE Channel Access Token，無需手動編輯 `.env.nas` 文件！

---

## 🎯 使用步驟

### 步驟 1: 取得 LINE Channel Access Token

1. 訪問 [LINE Developers Console](https://developers.line.biz/console/)
2. 登入您的帳號
3. 選擇您的 Messaging API Channel
4. 點擊 **"Messaging API"** 分頁
5. 找到 **"Channel access token (long-lived)"**
6. 點擊 **"Issue"** 或複製現有的 Token

### 步驟 2: 在管理控制台設定

1. **打開管理控制台**
   ```
   https://calendar.funlearnbar.synology.me/admin-dashboard.html
   ```

2. **點擊 "通知設定" 分頁**

3. **找到 "LINE API 設定" 區塊**

4. **輸入 LINE Channel Access Token**
   - 貼上您複製的 Token
   - 可以點擊眼睛圖示 👁️ 顯示/隱藏 Token
   - 系統會驗證 Token 長度（應該 > 100 字元）

5. **（選填）輸入 LIFF Client ID**
   - 如果您有使用 LIFF 功能，請填寫
   - 如果沒有，可以留空

6. **點擊 "儲存 LINE 設定"**

### 步驟 3: 重啟 Docker 服務

設定儲存後，畫面會顯示重啟指令：

```bash
ssh -p 1022 ctctim14@funlearnbar.synology.me
cd /volume1/homes/ctctim14/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas
sudo docker-compose restart
```

### 步驟 4: 測試 LINE 通知

重啟服務後：

1. 回到管理控制台
2. 點擊 **"測試 LINE 通知"** 按鈕
3. 檢查您的 LINE 是否收到測試訊息

---

## 🎨 介面功能

### 1. 載入當前設定

- 按鈕：**"載入當前設定"**
- 功能：顯示當前 Token 狀態
- 顯示資訊：
  - ✅ Token 是否已設定
  - 📏 Token 長度
  - 👁️ Token 預覽（前 20 字元）
  - 🆔 LIFF Client ID

### 2. 儲存 LINE 設定

- 按鈕：**"儲存 LINE 設定"**
- 功能：將 Token 儲存到 `.env.nas`
- 自動驗證：
  - Token 不能為空
  - Token 長度檢查
  - 格式驗證

### 3. 測試 LINE 通知

- 按鈕：**"測試 LINE 通知"**
- 功能：發送測試訊息到管理員 LINE
- 測試內容：
  ```
  🧪 LINE 通知測試
  
  系統配置正常！
  測試時間：2025-10-10 21:30:00
  ```

### 4. 顯示/隱藏 Token

- 按鈕：👁️ 眼睛圖示
- 功能：切換 Token 的顯示/隱藏狀態
- 預設：隱藏（密碼模式）

---

## 🔍 狀態指示

### ✅ Token 已設定（綠色）

```
✅ LINE Token 已設定

• Token 長度: 185 字元
• 預覽: channelAccessToken1...
• 狀態: 正常
```

### ❌ Token 未設定（紅色）

```
❌ LINE Token 未設定

• LINE 通知功能將無法使用
• 請輸入 Token 並儲存
```

### ⚠️ 需要重啟（黃色）

```
重要：需要重啟服務

請在 NAS 上執行以下命令以重啟 Docker 服務：
cd flb-calendar-nas && sudo docker-compose restart
```

### ✅ 測試成功（綠色）

```
✅ LINE 通知測試成功

• 訊息已發送到管理員
• LINE API 連接正常
• 通知功能可以使用
```

### ❌ 測試失敗（紅色）

```
❌ LINE 通知測試失敗

• LINE_CHANNEL_ACCESS_TOKEN 未設定
• 請檢查 Token 是否正確
• 錯誤詳情: ...
```

---

## 🛡️ 安全提示

### Token 安全性

- ✅ **Token 以密碼模式儲存**（預設隱藏）
- ✅ **不會在前端保存完整 Token**
- ✅ **只顯示前 20 字元預覽**
- ✅ **儲存到伺服器端的 .env.nas 文件**

### 重要提醒

1. **請妥善保管您的 Token**
   - 不要洩漏給他人
   - 不要上傳到公開的程式碼庫

2. **Token 洩漏處理**
   - 立即到 LINE Developers Console 重新發行
   - 舊的 Token 會自動失效

3. **需要重啟服務**
   - Token 設定後必須重啟 Docker 才會生效
   - 環境變數只在服務啟動時載入

---

## 🔧 技術細節

### 後端 API

#### GET /api/line-config
獲取 LINE 配置狀態

**回應範例**:
```json
{
  "success": true,
  "data": {
    "hasToken": true,
    "tokenLength": 185,
    "tokenPreview": "channelAccessToken1...",
    "liffClientId": "2006697806-9J1YDavm",
    "adminUserId": "U0291ce9023f7911a99cf79a54be90de8",
    "environment": "production"
  }
}
```

#### POST /api/line-config
更新 LINE 配置

**請求範例**:
```json
{
  "lineChannelToken": "channelAccessToken123456...",
  "liffClientId": "2006697806-9J1YDavm"
}
```

**回應範例**:
```json
{
  "success": true,
  "message": "LINE 配置已儲存，請重啟 Docker 服務以載入新配置",
  "needRestart": true,
  "data": {
    "tokenLength": 185,
    "tokenPreview": "channelAccessToken1...",
    "liffClientId": "2006697806-9J1YDavm"
  }
}
```

### .env.nas 格式

設定後，`.env.nas` 會自動更新為：

```env
# Synology Calendar API 配置
CALDAV_URL=https://funlearnbar.synology.me:9102
CALDAV_USERNAME=testacount
CALDAV_PASSWORD=testacount

# LINE LIFF 配置
LIFF_CLIENT_ID=2006697806-9J1YDavm

# 伺服器配置
PORT=3000
NODE_ENV=production

# LINE Messaging API
LINE_CHANNEL_ACCESS_TOKEN=channelAccessToken123456...
```

---

## 🧪 測試流程

### 完整測試步驟

1. **設定 Token**
   ```
   管理控制台 → 通知設定 → LINE API 設定 → 輸入 Token → 儲存
   ```

2. **重啟服務**
   ```bash
   ssh -p 1022 ctctim14@funlearnbar.synology.me
   cd flb-calendar-nas
   sudo docker-compose restart
   ```

3. **載入設定**
   ```
   管理控制台 → 通知設定 → 載入當前設定
   ```
   應該顯示：✅ Token 已設定

4. **測試通知**
   ```
   管理控制台 → 通知設定 → 測試 LINE 通知
   ```
   應該收到測試訊息

5. **驗證功能**
   - 學生提醒應該正常發送
   - 課程提醒應該正常發送
   - 日誌中無 500 錯誤

---

## ❓ 常見問題

### Q1: 設定後還是無法發送通知？

**檢查**:
1. 是否已重啟 Docker 服務？
   ```bash
   sudo docker-compose ps
   # 應該顯示 Up 狀態
   ```

2. 檢查環境變數是否載入
   ```bash
   sudo docker-compose exec flb-calendar-nas env | grep LINE
   # 應該顯示 TOKEN
   ```

3. 查看錯誤日誌
   ```bash
   sudo docker-compose logs | grep -i "line"
   ```

### Q2: Token 長度警告？

**原因**: Token 長度 < 100 字元，可能複製不完整

**解決**:
1. 重新到 LINE Console 複製完整 Token
2. 確認沒有多餘的空格或換行
3. Token 通常是 150-200 字元

### Q3: 測試成功但實際通知失敗？

**檢查**:
1. 管理員 User ID 是否正確設定？
2. 學生的 LINE User ID 是否正確？
3. 檢查提醒時間設定是否正確？

### Q4: 如何更換 Token？

**步驟**:
1. 到 LINE Console 重新發行 Token
2. 在管理控制台輸入新的 Token
3. 點擊儲存
4. 重啟 Docker 服務

---

## 🎉 總結

### 優點

✅ **無需 SSH** - 直接在網頁介面設定  
✅ **即時驗證** - 立即測試 Token 是否正確  
✅ **安全儲存** - Token 加密儲存在伺服器  
✅ **狀態顯示** - 清楚知道當前設定狀態  
✅ **一鍵測試** - 快速驗證功能是否正常

### 使用建議

1. **首次設定**: 設定 Token → 重啟 → 測試
2. **定期檢查**: 每月檢查一次 Token 狀態
3. **Token 更新**: 有安全疑慮時立即更換
4. **備份設定**: 定期備份 .env.nas 文件

---

**現在就去管理控制台試試新的 LINE 配置介面吧！** 🚀

**網址**: https://calendar.funlearnbar.synology.me/admin-dashboard.html


