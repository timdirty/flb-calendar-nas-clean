# 🔴 緊急問題：路徑編碼導致無法回填照片

**發現時間**：2025-11-16  
**嚴重程度**：🔴 高（完全無法回填照片）  
**影響範圍**：所有包含中文字元的課程路徑

---

## 問題現象

### 實際錯誤日誌
```
📋 [SynologyDrive] 列出目錄檔案: /Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE äº 1610-1740 æ±/2025-11-14
❌ [SynologyDrive] 列出檔案失敗: {
  errorCode: 408,
  errorMsg: '未知錯誤',
  folderPath: '/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE äº\x94 1610-1740 æ\x9D¾å±± ç¬¬8é\x80±/2025-11-14'
}
```

### 正確路徑應該是
```
/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山 第8週/2025-11-14
```

---

## 根本原因

### 編碼錯誤分析

**錯誤的編碼**：
- `äº\x94` = 五（UTF-8 bytes: E4 BA 94）
- `æ\x9D¾` = 松（UTF-8 bytes: E6 9D BE）
- `å±±` = 山（UTF-8 bytes: E5 B1 B1）
- `ç¬¬` = 第（UTF-8 bytes: E7 AC AC）
- `8é\x80±` = 8週（UTF-8 bytes: 38 E9 80 B1）

**問題**：UTF-8 字元被錯誤解析為 Latin-1/ISO-8859-1

### 可能原因

1. **Axios 預設編碼**：axios 使用 GET 請求時，params 可能未正確處理 UTF-8
2. **Node.js 環境編碼**：伺服器環境變數未設定 UTF-8
3. **URL 編碼遺漏**：路徑參數未經過 `encodeURIComponent`

---

## 驗證步驟

### 步驟 1：檢查環境編碼

```bash
# 在伺服器執行
echo $LANG
echo $LC_ALL
node -e "console.log(process.env.LANG, process.env.LC_ALL)"
```

**預期輸出**：
```
zh_TW.UTF-8
zh_TW.UTF-8
```

### 步驟 2：測試 API 直接調用

```bash
# 使用正確的 URL 編碼
curl -v "http://localhost:3000/api/learning-records/history-drive?semester=114-1&courseName=SPIKE%20%E4%BA%94%201610-1740%20%E6%9D%BE%E5%B1%B1%20%E7%AC%AC8%E9%80%B1&date=2025-11-14"
```

### 步驟 3：檢查 Axios 請求

在 `synology-drive-client.js` 第 705 行，查看 axios 發送的實際請求：

```javascript
console.log('📤 [Debug] Axios params:', JSON.stringify(params, null, 2));
console.log('📤 [Debug] folder_path encoding:', Buffer.from(params.folder_path, 'utf8').toString('hex'));
```

---

## ✅ 修復已完成

### 修復內容

已修改 `synology-drive-client.js` 的 `listFiles` 方法（第 705-713 行）：

**修改前**（第 705 行）：
```javascript
const response = await this.axiosInstance.get(this.apiUrl, { params });
```

**修改後**（第 705-713 行）：
```javascript
// 🔥 [修復 2025-11-16] 改用 POST 方法避免 URL 編碼問題
// GET 請求在處理包含中文的路徑時，會導致編碼錯誤（UTF-8 被誤解為 Latin-1）
// 使用 POST + application/x-www-form-urlencoded 可確保正確編碼
const formData = new URLSearchParams(params);
const response = await this.axiosInstance.post(this.apiUrl, formData, {
    headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
    }
});
```

### 為什麼 POST 能解決問題？

1. **GET 請求**：參數在 URL 中，axios 使用 `querystring` 模組編碼，可能導致 UTF-8 → Latin-1 錯誤轉換
2. **POST 請求**：參數在 body 中，`URLSearchParams` 確保正確 UTF-8 編碼，Content-Type 明確告知伺服器編碼方式
3. **Synology FileStation API**：支援 GET 和 POST 兩種方法，功能完全相同

---

## 立即測試

### 測試 1：手動建立 metadata.json

在石紹言資料夾中建立 `metadata.json`：

```json
{
  "semester": "114-1",
  "courseName": "SPIKE 五 1610-1740 松山 第8週",
  "date": "2025-11-14",
  "topic": "洞棍發射器",
  "studentName": "石紹言",
  "uploadTime": "2025-11-16T09:44:10.048Z",
  "comment": "",
  "photos": [
    {
      "fileName": "IMG_5624-1763286248876-n6hi0u.jpeg",
      "size": 189179,
      "proxyUrl": "/api/drive-media/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山 第8週/2025-11-14 洞棍發射器/石紹言/IMG_5624-1763286248876-n6hi0u.jpeg"
    }
  ],
  "videos": [],
  "totalPhotos": 4,
  "totalVideos": 0
}
```

### 測試 2：清除快取並重新載入

```javascript
// 在瀏覽器 Console 執行
localStorage.clear();
sessionStorage.clear();
location.reload();
```

### 測試 3：驗證照片回填

1. 開啟 `http://localhost:3000/learning-record-upload.html`
2. 選擇課程「SPIKE 五 1610-1740 松山 第8週」
3. 檢查石紹言的卡片是否顯示照片

---

## 預期結果

修復後應該看到：

```
📋 [SynologyDrive] 列出目錄檔案: /Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山 第8週/2025-11-14
✅ [SynologyDrive] 找到 X 個檔案
✅ [歷史記錄] 找到 Y 筆記錄
```

---

## 回報清單

請提供以下資訊以確認修復：

- [ ] 環境編碼設定（`echo $LANG`）
- [ ] Node.js 版本（`node --version`）
- [ ] 測試 API 返回結果
- [ ] 前端 Console 日誌截圖
- [ ] 照片是否正確回填

---

## 相關文件

- 主要修復：`docs/FIX-PHOTO-MISMATCH-20251116.md`
- 診斷步驟：`docs/DEBUG-PHOTO-MISMATCH-STEPS.md`
- 規範記錄：`AGENTS.md` 第 134-140 行
