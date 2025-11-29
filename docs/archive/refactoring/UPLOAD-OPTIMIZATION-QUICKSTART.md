# 學習歷程上傳優化 - 快速入門指南

**適用對象**: 開發者、系統管理員  
**預計時間**: 10 分鐘  
**前置需求**: Node.js 18+, npm

---

## 🚀 5 步驟快速啟用

### 步驟 1: 安裝依賴（2 分鐘）

```bash
cd /path/to/flb-calendar-nas
npm install
```

**新增的依賴**:
- `sharp` - 高效能圖片處理
- `p-queue` - 任務佇列管理
- `uuid` - 唯一 ID 生成

### 步驟 2: 驗證安裝（1 分鐘）

```bash
chmod +x test-upload-optimization.sh
./test-upload-optimization.sh
```

**預期結果**: `✅ 通過: 14` （API 測試需伺服器運行）

### 步驟 3: 啟動伺服器（1 分鐘）

```bash
# 開發環境
npm run dev

# 或生產環境
npm start
```

### 步驟 4: 測試分片上傳 API（3 分鐘）

```bash
# 初始化上傳
curl -X POST http://localhost:8080/api/learning-records/upload/init \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "test-video.mp4",
    "fileSize": 52428800,
    "fileType": "video/mp4",
    "chunkSize": 5242880
  }'

# 預期回應
# {
#   "success": true,
#   "uploadId": "550e8400-...",
#   "totalChunks": 10
# }
```

### 步驟 5: 瀏覽器測試（3 分鐘）

1. 開啟 http://localhost:8080/learning-record-upload.html
2. 選擇一個大檔案（>= 10MB）
3. 開啟瀏覽器控制台
4. 上傳檔案
5. 查看控制台輸出

**預期輸出**:
```
📦 使用分片上傳: large-video.mp4 50.00 MB
✅ 分片 1/10 完成 (10%)
✅ 分片 2/10 完成 (20%)
...
✅ 檔案上傳成功
```

---

## 💡 快速參考

### 什麼檔案會使用分片上傳？

- 檔案大小 **>= 10MB** 自動啟用分片上傳
- 檔案大小 **< 10MB** 使用原有上傳方式

### 如何查看上傳進度？

```javascript
// 在瀏覽器控制台執行
await ChunkedUploader.uploadFileChunked(file, (percent) => {
    console.log(`進度: ${percent}%`);
});
```

### 如何取消上傳？

```javascript
const uploadId = '550e8400-...';
await ChunkedUploader.cancelUpload(uploadId);
```

### 如何查看縮圖生成狀態？

```bash
# 查看伺服器日誌
docker-compose logs -f --tail=50

# 或本地開發
npm run dev  # 日誌會顯示在終端
```

---

## 📁 關鍵檔案位置

| 檔案 | 用途 |
|------|------|
| `utils/media-processor.js` | 縮圖生成與佇列管理 |
| `public/js/modules/chunked-uploader.js` | 前端分片上傳模組 |
| `server.js` (第 14881-15177 行) | 分片上傳 API |
| `docs/learning-upload-optimization.md` | 完整文檔 |
| `docs/frontend-integration-guide.md` | 前端整合指南 |

---

## 🔍 常見問題

### Q1: 為什麼我的檔案沒有使用分片上傳？

**A**: 檔案小於 10MB。分片上傳僅適用於大檔案。

```javascript
// 檢查檔案大小
console.log(file.size); // 位元組
console.log(file.size / 1024 / 1024); // MB
```

### Q2: 縮圖什麼時候生成？

**A**: 上傳完成後**異步生成**，不會阻塞上傳回應。

- 生成時間：圖片 ~1-3 秒，影片 ~5-10 秒
- 查看日誌確認：`✅ 圖片縮圖生成完成`

### Q3: 如何整合到現有上傳流程？

**A**: 參考 `docs/frontend-integration-guide.md` 中的範例。

**最簡單的整合**:
```javascript
if (ChunkedUploader.shouldUseChunkedUpload(file)) {
    await ChunkedUploader.uploadFileChunked(file, onProgress);
} else {
    await traditionalUpload(file);
}
```

### Q4: 上傳失敗怎麼辦？

**A**: 
1. 檢查伺服器日誌
2. 確認 `data/` 目錄有寫入權限
3. 檢查網路連線
4. 重試上傳（分片會自動重試 3 次）

### Q5: 如何調整效能參數？

**A**: 修改 `utils/media-processor.js`

```javascript
// 調整並發數
const imageQueue = new PQueue({ concurrency: 4 }); // 預設 2

// 調整縮圖品質
.webp({ quality: 90 }) // 預設 85
```

---

## 🎯 下一步

### 開發者

1. 閱讀完整文檔: `docs/learning-upload-optimization.md`
2. 參考整合指南: `docs/frontend-integration-guide.md`
3. 修改 `learning-record-upload.js` 整合分片上傳

### 測試人員

1. 執行手動測試（小檔案、大檔案、批次上傳）
2. 驗證縮圖生成
3. 測試錯誤處理（網路中斷、檔案過大）

### 系統管理員

1. 部署到生產環境
2. 配置 Nginx 快取
3. 監控伺服器資源（CPU、記憶體、磁碟）
4. 定期清理 `data/upload-chunks/` 過期檔案

---

## 📊 監控與維護

### 查看佇列狀態

```bash
# 在伺服器上執行
curl http://localhost:8080/api/learning-records/upload/queue-stats
```

### 清理過期分片

```bash
# 手動清理（超過 24 小時的分片）
find data/upload-chunks -type d -mtime +1 -exec rm -rf {} \;
```

### 查看縮圖大小統計

```bash
# 統計縮圖目錄大小
du -sh data/learning-portfolio/*/thumbnails
```

---

## 🆘 需要幫助？

### 文檔資源

- 📘 [完整架構文檔](./learning-upload-optimization.md)
- 📗 [前端整合指南](./frontend-integration-guide.md)
- 📙 [實施總結](./upload-optimization-implementation-summary.md)

### 測試工具

```bash
# 執行完整測試
./test-upload-optimization.sh

# 測試單一 API
curl http://localhost:8080/health
```

### 除錯模式

```bash
# 啟用詳細日誌
NODE_ENV=development npm run dev

# 查看 Sharp 版本
npm list sharp

# 查看 p-queue 版本
npm list p-queue
```

---

## ✅ 檢查清單

安裝完成後請確認：

- [ ] `npm install` 成功
- [ ] 測試腳本通過 14/16 項目
- [ ] 伺服器成功啟動
- [ ] 可訪問 `/health` 端點
- [ ] 分片上傳 API 可正常回應
- [ ] 上傳檔案後有縮圖生成日誌

---

**版本**: 1.0  
**最後更新**: 2025-11-03  
**預估閱讀時間**: 10 分鐘




