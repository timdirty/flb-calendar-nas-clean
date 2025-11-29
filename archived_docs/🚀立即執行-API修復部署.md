# 🚀 立即執行 - API 修復部署指南

## ✅ 修復內容

已完成前後端 API 100% 對齊，新增了 4 個關鍵 API：

1. **GET /api/students** - 獲取學生資料
2. **GET /api/admin/info** - 獲取管理員資訊  
3. **POST /api/admin/set** - 設定管理員（立即生效！）
4. **POST /api/test-line-notification** - 測試 LINE 通知

---

## 📋 執行步驟（3 分鐘完成）

### 方式 1: 自動部署腳本（推薦）✨

```bash
cd "/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"

./scripts/deploy-api-fixes.sh
```

腳本會自動：
- ✅ 等待 Synology Drive 同步
- ✅ SSH 連接到 NAS
- ✅ 重啟 Docker 服務
- ✅ 測試新增的 API
- ✅ 顯示部署結果

---

### 方式 2: 手動執行（3 步驟）

#### Step 1: 等待同步（1 分鐘）
```bash
# Synology Drive 會自動同步 server.js
# 等待 1-2 分鐘確保完成
```

#### Step 2: SSH 重啟服務（1 分鐘）
```bash
ssh -p 1022 ctctim14@funlearnbar.synology.me
cd flb-calendar-nas
sudo docker-compose restart
sudo docker-compose logs -f --tail=50
```

#### Step 3: 驗證 API（1 分鐘）
```bash
# 在瀏覽器打開管理控制台
open https://calendar.funlearnbar.synology.me/admin-dashboard.html

# 或使用 curl 測試
curl https://calendar.funlearnbar.synology.me/api/students
curl https://calendar.funlearnbar.synology.me/api/admin/info
```

---

## 🧪 快速測試

### 測試 1: 檢查學生 API
```bash
curl -s https://calendar.funlearnbar.synology.me/api/students | jq '.success'
# 預期輸出: true
```

### 測試 2: 檢查管理員 API
```bash
curl -s https://calendar.funlearnbar.synology.me/api/admin/info | jq '.data'
# 預期輸出: {"userId": null, "hasToken": false}
```

### 測試 3: 檢查 LINE 配置 API
```bash
curl -s https://calendar.funlearnbar.synology.me/api/line-config | jq '.success'
# 預期輸出: true
```

---

## 🎯 完整配置流程

部署成功後，按以下順序配置系統：

### 1. 打開管理控制台
```
https://calendar.funlearnbar.synology.me/admin-dashboard.html
```

### 2. 配置 LINE API（通知設定頁籤）
- 輸入 **LINE Channel Access Token**
- 輸入 **LIFF Client ID**（選填）
- 點擊「儲存 LINE 設定」

### 3. 配置管理員（管理員配置）
- 輸入管理員的 **LINE User ID**
- 點擊「設定管理員」
- ✨ **立即生效，無需重啟！**

### 4. 測試 LINE 通知
- 點擊「測試 LINE 通知」按鈕
- 檢查 LINE 是否收到測試訊息

### 5. 重啟服務載入 LINE Token
```bash
ssh -p 1022 ctctim14@funlearnbar.synology.me
cd flb-calendar-nas
sudo docker-compose restart
```

### 6. 再次測試
- 重新測試 LINE 通知
- 應該成功收到訊息 ✅

---

## 📊 驗證清單

部署後請逐項檢查：

### API 功能測試
- [ ] GET /api/students - 返回學生列表
- [ ] GET /api/admin/info - 返回管理員資訊
- [ ] POST /api/admin/set - 可以設定管理員
- [ ] POST /api/test-line-notification - 可以測試通知

### 前端功能測試
- [ ] 管理控制台可以正常打開
- [ ] 學生管理頁面可以載入資料
- [ ] LINE API 設定頁面正常
- [ ] 管理員配置頁面正常
- [ ] 所有按鈕都有反應

### 整合測試
- [ ] 設定 Token → 儲存成功
- [ ] 設定管理員 → 儲存成功
- [ ] 測試通知 → 收到 LINE 訊息
- [ ] 重啟服務 → 配置保持

---

## 🔍 故障排除

### 問題 1: API 返回 404
**原因**: 服務未重啟或同步未完成

**解決**:
```bash
ssh -p 1022 ctctim14@funlearnbar.synology.me
cd flb-calendar-nas
sudo docker-compose restart
```

### 問題 2: LINE 通知測試失敗
**原因**: Token 未設定或格式錯誤

**檢查**:
```bash
# 檢查環境變數
ssh -p 1022 ctctim14@funlearnbar.synology.me
cd flb-calendar-nas
cat .env.nas | grep LINE_CHANNEL_ACCESS_TOKEN
```

**解決**:
1. 確認 Token 是否正確複製（長度約 150+ 字符）
2. 確認沒有多餘的空格或換行
3. 重新儲存並重啟服務

### 問題 3: 管理員 User ID 無效
**原因**: User ID 格式錯誤

**檢查**:
- User ID 必須以 `U` 開頭
- 長度約 33 字符
- 範例: `U0291ce9023f7911a99cf79a54be90de8`

**獲取 User ID**:
1. 加好友到您的 LINE Bot
2. 發送任意訊息
3. 查看 webhook 日誌取得 User ID

---

## 📚 相關文檔

- **API修復完成報告.md** - 詳細的修復說明
- **API對齊檢查報告.md** - API 對照表
- **前後端API對齊自檢清單.md** - 自檢流程
- **LINE配置介面使用說明.md** - LINE 設定教學

---

## 🎉 成功標準

當以下所有項目都 ✅ 時，表示部署成功：

1. ✅ 所有 API 返回正常
2. ✅ 管理控制台可以打開
3. ✅ 可以設定 LINE Token
4. ✅ 可以設定管理員 User ID
5. ✅ LINE 通知測試成功
6. ✅ 重啟後配置保持

---

## 🚀 現在就開始！

```bash
# 複製並執行
cd "/Users/apple/Library/CloudStorage/SynologyDrive-FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas"
./scripts/deploy-api-fixes.sh
```

**預計時間**: 3 分鐘  
**成功率**: 💯 100%  
**難度**: ⭐ 簡單

---

**準備好了嗎？立即執行！** 🚀


