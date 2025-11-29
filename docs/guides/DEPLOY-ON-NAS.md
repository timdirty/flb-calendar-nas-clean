# 在 Synology NAS 上部署分片上傳功能

## 🔍 當前狀況

- **問題**：生產環境顯示 `502 Bad Gateway`，分片上傳 API 無法使用
- **原因**：Docker 容器內運行舊版本代碼
- **解決方案**：在 Synology NAS 上重新構建並部署 Docker 容器

---

## 📍 部署環境說明

### 代碼同步方式
由於您使用 **Synology Drive** 同步專案資料夾，代碼變更應該**已自動同步到 NAS**。只需在 NAS 上重新構建 Docker 映像即可。

### NAS 上的專案路徑（預估）
根據 `docker-compose.yml` 中的映射路徑 `/volume1/Fun Learn Bar/學習歷程 automatic`，專案可能位於：
```
/volume1/Fun Learn Bar/flb-calendar-nas/
或
/volume1/SynologyDrive/FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/
```

---

## 🚀 方案 1：透過 SSH 在 NAS 上部署（推薦）

### 步驟 1：SSH 連接到 NAS

```bash
# 替換為您的 NAS IP 和使用者名稱
ssh your-username@your-nas-ip

# 範例
ssh admin@192.168.1.100
# 或
ssh admin@calendar.funlearnbar.synology.me
```

### 步驟 2：進入專案目錄

```bash
# 尋找專案目錄（使用以下任一命令）
cd /volume1/SynologyDrive/FLBTim/樂程坊計畫/課程資料/Cursor/講師行事曆檢視/flb-calendar-nas/
# 或
find /volume1 -name "flb-calendar-nas" -type d 2>/dev/null

# 確認是否在正確目錄（應該看到 docker-compose.yml）
ls -lh docker-compose.yml
```

### 步驟 3：執行自動化部署腳本

```bash
# 設定執行權限（如果尚未設定）
chmod +x deploy-production.sh

# 執行部署
./deploy-production.sh
```

### 步驟 4：驗證部署結果

部署腳本會自動執行以下檢查：
- ✅ 停止舊容器
- ✅ 重新構建映像（包含新代碼）
- ✅ 啟動新容器
- ✅ 健康檢查
- ✅ 測試分片上傳 API

成功後您應該看到：
```
🎉 部署完成！
✅ 健康檢查通過 (HTTP 200)
✅ 分片上傳 API 正常
```

---

## 🔧 方案 2：手動逐步部署（適合除錯）

如果自動化腳本失敗，可以手動執行以下步驟：

### 步驟 1：SSH 連接並進入目錄
```bash
ssh your-username@your-nas-ip
cd /path/to/flb-calendar-nas
```

### 步驟 2：檢查代碼是否已同步
```bash
# 檢查新檔案是否存在
ls -lh utils/media-processor.js
ls -lh public/js/modules/chunked-uploader.js

# 檢查 package.json 是否包含新依賴
grep -A 5 '"dependencies"' package.json | grep -E "(sharp|p-queue|uuid)"

# 檢查 server.js 是否包含新 API
grep -n "api/learning-records/upload/init" server.js
```

如果這些檔案不存在或內容舊舊的，說明 Synology Drive 同步有延遲，需要手動觸發同步或等待。

### 步驟 3：停止舊容器
```bash
docker-compose down
```

### 步驟 4：重新構建映像
```bash
# 不使用快取，確保包含所有新代碼
docker-compose build --no-cache
```

### 步驟 5：啟動新容器
```bash
docker-compose up -d
```

### 步驟 6：查看日誌
```bash
# 即時監控日誌
docker-compose logs -f

# 或只查看最後 50 行
docker-compose logs --tail=50
```

### 步驟 7：測試 API
```bash
# 健康檢查
curl http://localhost:3000/health

# 測試分片上傳初始化
curl -X POST http://localhost:3000/api/learning-records/upload/init \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","fileSize":10485760,"fileType":"image/jpeg","chunkSize":5242880}'
```

**注意**：容器內端口是 3000，映射到宿主機 3001。在 NAS SSH 內測試使用 `localhost:3000`，從外部訪問使用 `your-nas-ip:3001` 或域名。

---

## 🔍 方案 3：透過 Synology Docker GUI 部署

如果您不習慣命令列，也可以透過 Synology 的 Docker 套件 GUI 操作：

### 步驟 1：登入 Synology DSM
瀏覽器訪問：`http://your-nas-ip:5000`

### 步驟 2：打開 Docker 套件
套件中心 → Docker → 開啟

### 步驟 3：停止舊容器
- 容器 → 找到 `flb-calendar-nas` → 停止 → 刪除

### 步驟 4：刪除舊映像（可選）
- 映像 → 找到 `flb-calendar-nas_flb-calendar` → 刪除

### 步驟 5：重新構建
這個步驟**必須透過 SSH 或命令列執行**：
```bash
cd /path/to/flb-calendar-nas
docker-compose build --no-cache
docker-compose up -d
```

或者使用 Synology 的「專案」功能（如果已設定）。

---

## ⚠️ 常見問題排除

### Q1: SSH 連接失敗
**解決方案**：
1. 確認 NAS SSH 服務已啟用（控制台 → 終端機和 SNMP → 啟動 SSH）
2. 檢查 IP 位址是否正確
3. 檢查防火牆設定

### Q2: 找不到專案目錄
**解決方案**：
```bash
# 搜尋專案目錄
find /volume1 -name "docker-compose.yml" -path "*flb-calendar*" 2>/dev/null

# 或搜尋特定檔案
find /volume1 -name "deploy-production.sh" 2>/dev/null
```

### Q3: docker-compose 命令不存在
**解決方案**：
```bash
# Synology 可能使用 docker compose（空格）而非 docker-compose（連字符）
docker compose down
docker compose build --no-cache
docker compose up -d
```

### Q4: 權限不足
**解決方案**：
```bash
# 使用 sudo（需要管理員權限）
sudo docker-compose down
sudo docker-compose build --no-cache
sudo docker-compose up -d
```

### Q5: 構建失敗（依賴安裝錯誤）
**解決方案**：
```bash
# 檢查 npm 日誌
docker-compose logs

# 可能是網路問題，嘗試使用其他 npm registry
# 編輯 Dockerfile，將 registry.npmmirror.com 改為 registry.npmjs.org

# 或清理並重試
docker system prune -a  # 清理所有未使用的映像和快取
docker-compose build --no-cache
```

---

## 📊 預期結果

### 部署成功後的檢查項目

#### 1. 容器狀態正常
```bash
$ docker-compose ps
NAME                STATUS
flb-calendar-nas    Up X minutes (healthy)
```

#### 2. 日誌無錯誤
```bash
$ docker-compose logs --tail=30
✅ 伺服器啟動成功
📡 監聽端口 3000
```

#### 3. API 測試成功
```bash
$ curl http://localhost:3000/api/learning-records/upload/init \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","fileSize":10485760,"fileType":"image/jpeg","chunkSize":5242880}'

{
  "success": true,
  "uploadId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "totalChunks": 2,
  "message": "上傳初始化成功"
}
```

#### 4. 瀏覽器測試
訪問 `https://calendar.funlearnbar.synology.me/`，上傳大檔案（>= 10MB），應該看到：
- **控制台日誌**：`📦 使用分片上傳: xxx.mp4 15.5 MB`
- **上傳進度**：顯示分片上傳進度
- **無 502 錯誤**

---

## 🔄 如果 Synology Drive 同步有延遲

### 手動觸發同步
1. 在 Mac 上右鍵專案資料夾 → Synology Drive → 立即同步
2. 或在 Synology DSM 中 Synology Drive → 檢視同步狀態

### 手動上傳檔案
如果同步失敗，可以使用以下方式：

#### 透過 File Station
1. 登入 Synology DSM
2. 打開 File Station
3. 找到專案目錄
4. 手動上傳這些檔案：
   - `utils/media-processor.js`
   - `public/js/modules/chunked-uploader.js`
   - `public/js/pages/learning-record-upload.js`
   - `server.js`
   - `package.json`
   - `deploy-production.sh`

#### 透過 SCP
```bash
# 從 Mac 上傳到 NAS
scp utils/media-processor.js your-username@your-nas-ip:/path/to/flb-calendar-nas/utils/
scp public/js/modules/chunked-uploader.js your-username@your-nas-ip:/path/to/flb-calendar-nas/public/js/modules/
# ... 其他檔案
```

---

## 📚 相關文檔

- [生產環境部署指南](./PRODUCTION-DEPLOYMENT-GUIDE.md)
- [分片上傳整合狀態](./CHUNKED-UPLOAD-INTEGRATION-STATUS.md)
- [502 錯誤診斷](./502-ERROR-DIAGNOSIS.md)

---

## 📞 如果仍然無法解決

請提供以下資訊：

1. **NAS 系統資訊**
   ```bash
   uname -a
   docker --version
   docker-compose --version
   ```

2. **容器日誌**
   ```bash
   docker-compose logs --tail=100 > deploy-logs.txt
   ```

3. **檔案檢查結果**
   ```bash
   ls -lh utils/media-processor.js
   ls -lh public/js/modules/chunked-uploader.js
   grep "api/learning-records/upload/init" server.js
   ```

4. **測試結果**
   ```bash
   curl -v http://localhost:3000/health
   curl -v -X POST http://localhost:3000/api/learning-records/upload/init \
     -H "Content-Type: application/json" \
     -d '{"filename":"test.jpg","fileSize":10485760,"fileType":"image/jpeg","chunkSize":5242880}'
   ```

---

**最後更新**: 2025-11-03  
**狀態**: ✅ 等待 NAS 部署驗證


