# 修復 SYNOLOGY_HOST 環境變數問題

## 問題描述
錯誤訊息：`getaddrinfo ENOTFOUND undefined`

這表示 `SYNOLOGY_HOST` 環境變數在 Docker 容器內部為 `undefined`。

## 解決步驟

### 1. 確認 NAS 上的 .env.nas 檔案

在 NAS 上檢查 `.env.nas` 檔案是否包含以下配置：

```bash
# Synology Drive（2025-11-08 新增）🆕
SYNOLOGY_HOST=funlearnbar.synology.me
SYNOLOGY_PORT=9102
SYNOLOGY_PROTOCOL=https
SYNOLOGY_USERNAME=ctctim14
SYNOLOGY_PASSWORD=A880318TIMGOOD
SYNOLOGY_DRIVE_ROOT=/Fun Learn Bar/FLB-Learning-Portfolio
```

### 2. 重啟 Docker 容器

Docker Compose 使用 `env_file` 配置，環境變數在容器啟動時載入。修改 `.env.nas` 後需要重啟容器：

```bash
# 在 NAS 上執行
cd /path/to/flb-calendar-nas
docker-compose restart flb-calendar
```

或者完全重建：

```bash
docker-compose down
docker-compose up -d
```

### 3. 驗證環境變數已載入

檢查容器日誌，應該看到：

```
✅ [SynologyDrive] 客戶端已初始化: {
  host: 'funlearnbar.synology.me',
  protocol: 'https',
  port: 9102
}
```

如果看到警告訊息，表示環境變數仍未正確載入。

### 4. 手動檢查容器內環境變數

在 NAS 上執行：

```bash
docker exec flb-calendar-nas env | grep SYNOLOGY
```

應該看到所有 `SYNOLOGY_*` 環境變數。

### 5. 如果環境變數仍然缺失

檢查 `docker-compose.yml` 中的 `env_file` 配置：

```yaml
env_file:
  - .env.nas
```

確認 `.env.nas` 檔案路徑正確（相對於 `docker-compose.yml` 的位置）。

## 常見問題

### Q: 為什麼修改了 .env.nas 但容器還是讀不到？
A: Docker Compose 的 `env_file` 只在容器啟動時載入，需要重啟容器。

### Q: 如何確認環境變數是否正確載入？
A: 查看容器啟動日誌，應該看到 `✅ Synology Drive 客戶端已初始化`，而不是警告訊息。

### Q: 容器內部的環境變數和 .env.nas 不一致？
A: 確認 NAS 上的 `.env.nas` 檔案是否與本機同步，可能需要手動同步檔案。

## 驗證清單

- [ ] `.env.nas` 檔案包含 `SYNOLOGY_HOST=funlearnbar.synology.me`
- [ ] 所有 `SYNOLOGY_*` 環境變數都已設置
- [ ] Docker 容器已重啟
- [ ] 容器日誌顯示 `✅ Synology Drive 客戶端已初始化`
- [ ] 上傳功能測試通過



