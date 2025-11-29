# 生產環境部署指南 - 分片上傳功能

## 🔍 問題診斷

### 現象
- 前端顯示 `502 Bad Gateway` 錯誤
- 控制台日誌：`POST .../upload/init 502` 和 `POST .../upload/chunk 502`
- 訪問的是生產環境 URL：`https://calendar.funlearnbar.synology.me`

### 根本原因
**Docker 容器內運行的是舊版本代碼**，不包含新的分片上傳 API 端點。Docker 映像需要重新構建並重新部署。

---

## ✅ 解決方案：重新部署 Docker 容器

### 方案 1：一鍵重新部署（推薦）

```bash
# 停止並移除舊容器
docker-compose down

# 重新構建映像（包含新代碼）
docker-compose build --no-cache

# 啟動新容器
docker-compose up -d

# 查看啟動日誌
docker-compose logs -f --tail=50
```

### 方案 2：逐步檢查部署

```bash
# 1. 停止舊容器
docker-compose down
echo "✅ 舊容器已停止"

# 2. 檢查代碼文件是否存在
echo "🔍 檢查新增的模組..."
ls -lh utils/media-processor.js
ls -lh public/js/modules/chunked-uploader.js

# 3. 檢查依賴是否已更新
echo "🔍 檢查 package.json..."
grep -A 3 '"dependencies"' package.json | grep -E "(sharp|p-queue|uuid)"

# 4. 重新構建（不使用快取，確保包含所有更改）
echo "🏗️ 開始重新構建 Docker 映像..."
docker-compose build --no-cache

# 5. 啟動容器
echo "🚀 啟動新容器..."
docker-compose up -d

# 6. 等待容器完全啟動
echo "⏳ 等待 10 秒讓容器完全啟動..."
sleep 10

# 7. 檢查容器狀態
echo "📊 容器狀態："
docker-compose ps

# 8. 查看最新日誌
echo "📋 最新日誌："
docker-compose logs --tail=30

# 9. 測試健康檢查
echo "🩺 測試健康檢查端點..."
curl http://localhost:3001/health

# 10. 測試新 API（分片上傳初始化）
echo "🧪 測試分片上傳 API..."
curl -X POST http://localhost:3001/api/learning-records/upload/init \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","fileSize":10485760,"fileType":"image/jpeg","chunkSize":5242880}'
```

---

## 🔧 進階診斷

### 檢查容器內部是否包含新代碼

```bash
# 進入運行中的容器
docker exec -it flb-calendar-nas sh

# 檢查新模組是否存在
ls -l /app/utils/media-processor.js
ls -l /app/public/js/modules/chunked-uploader.js

# 檢查 package.json 中的依賴
cat /app/package.json | grep -A 5 '"dependencies"'

# 檢查 node_modules 是否包含新套件
ls -l /app/node_modules/ | grep -E "(sharp|p-queue|uuid)"

# 檢查伺服器代碼是否包含新 API 端點
grep -n "api/learning-records/upload/init" /app/server.js

# 離開容器
exit
```

### 查看容器完整日誌

```bash
# 查看所有日誌
docker-compose logs

# 持續監控日誌
docker-compose logs -f

# 只查看最近 100 行
docker-compose logs --tail=100
```

---

## 📝 部署檢查清單

### 部署前
- [x] 確認 `package.json` 已包含新依賴（`sharp`, `p-queue`, `uuid`）
- [x] 確認 `server.js` 已包含分片上傳 API 端點
- [x] 確認 `utils/media-processor.js` 已創建
- [x] 確認 `public/js/modules/chunked-uploader.js` 已創建
- [x] 確認 `public/js/pages/learning-record-upload.js` 已整合分片上傳邏輯

### 部署中
- [ ] 執行 `docker-compose down` 停止舊容器
- [ ] 執行 `docker-compose build --no-cache` 重新構建
- [ ] 執行 `docker-compose up -d` 啟動新容器
- [ ] 檢查 `docker-compose ps` 確認容器運行正常

### 部署後
- [ ] 測試 `/health` 端點（應返回 200 OK）
- [ ] 測試 `/api/learning-records/upload/init` 端點（應返回 JSON，不是 502）
- [ ] 在瀏覽器中上傳小檔案（< 10MB，應使用舊方法）
- [ ] 在瀏覽器中上傳大檔案（>= 10MB，應使用分片上傳）
- [ ] 檢查瀏覽器控制台，確認顯示 `📦 使用分片上傳` 日誌
- [ ] 檢查伺服器日誌，確認顯示分片上傳相關日誌

---

## ⚠️ 常見問題

### Q1: 重新構建後仍然 502 錯誤？
**A**: 可能是 Nginx 反向代理設定問題。檢查 NAS 的 Nginx 配置是否正確轉發到 `localhost:3001`。

### Q2: 容器啟動後立即停止？
**A**: 檢查日誌 `docker-compose logs`，可能是依賴安裝失敗或代碼語法錯誤。

### Q3: API 測試返回 404？
**A**: 確認容器內的 `server.js` 是否包含新 API 端點。使用 `docker exec` 進入容器檢查。

### Q4: 依賴安裝失敗（sharp、p-queue 等）？
**A**: 
```bash
# 清理並重新安裝
docker-compose down
docker rmi flb-calendar-nas_flb-calendar  # 刪除舊映像
docker-compose build --no-cache           # 強制重新構建
docker-compose up -d
```

---

## 🎯 預期結果

部署成功後，您應該看到：

### 1. 容器正常運行
```bash
$ docker-compose ps
NAME                IMAGE                      STATUS
flb-calendar-nas    flb-calendar-nas_flb-calendar   Up X minutes (healthy)
```

### 2. 健康檢查成功
```bash
$ curl http://localhost:3001/health
{"status":"ok"}
```

### 3. 新 API 可用
```bash
$ curl -X POST http://localhost:3001/api/learning-records/upload/init \
  -H "Content-Type: application/json" \
  -d '{"filename":"test.jpg","fileSize":10485760,"fileType":"image/jpeg","chunkSize":5242880}'

{
  "success": true,
  "uploadId": "...",
  "totalChunks": 2,
  "message": "上傳初始化成功"
}
```

### 4. 瀏覽器控制台日誌（上傳大檔案時）
```
📦 使用分片上傳: large-video.mp4 15.5 MB
🚀 開始分片上傳 (分片數: 4)
⬆️ 上傳分片 [1/4]
⬆️ 上傳分片 [2/4]
⬆️ 上傳分片 [3/4]
⬆️ 上傳分片 [4/4]
✅ 上傳完成
```

---

## 📚 相關文檔

- [分片上傳整合狀態報告](./CHUNKED-UPLOAD-INTEGRATION-STATUS.md)
- [502 錯誤診斷報告](./502-ERROR-DIAGNOSIS.md)
- [Docker Compose 配置](../docker-compose.yml)
- [Dockerfile](../Dockerfile)

---

**最後更新**: 2025-11-03  
**狀態**: ✅ 等待部署驗證


