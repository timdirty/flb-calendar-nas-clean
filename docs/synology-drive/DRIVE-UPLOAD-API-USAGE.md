# Synology Drive 上傳 API - 使用說明

**API 版本**: v1.0.0  
**建立日期**: 2025-11-08  
**狀態**: ✅ 可用（與舊版 API 並存）

---

## 📖 概述

新的 Drive 版本上傳 API 提供與舊版相同的功能，但將檔案儲存到 Synology Drive 而非本地檔案系統。

### 主要優勢

- ✅ **中央化儲存**: 所有檔案統一儲存在 NAS Drive
- ✅ **安全存取**: 透過代理 API 存取，不暴露 SID
- ✅ **自動備份**: 利用 NAS 的備份機制
- ✅ **擴展性**: 不受本地磁碟空間限制
- ✅ **向後相容**: 舊版 API 仍可使用

---

## 🔗 API 端點

### 新版（Drive）
```
POST /api/learning-records/upload-drive
```

### 舊版（本地）
```
POST /api/learning-records/upload
```

---

## 📤 請求格式

### Content-Type
```
multipart/form-data
```

### 必要欄位

#### 學生記錄
| 欄位 | 類型 | 說明 | 必要 |
|------|------|------|------|
| `semester` | string | 學期（例如：114-1） | ✅ |
| `courseName` | string | 課程名稱（例如：SPIKE 三 18:30-20:30 第8週） | ✅ |
| `date` | string | 日期（YYYY-MM-DD） | ✅ |
| `studentName` | string | 學生姓名 | ✅ |
| `comment` | string | 評語（至少 20 字） | ✅ |
| `photos` | file[] | 照片檔案（至少 3 張） | ✅ |
| `videos` | file[] | 影片檔案 | ❌ |
| `topic` | string | 主題 | ❌ |
| `isOverview` | boolean/string | 是否為課程總覽（'false'） | ✅ |

#### 課程總覽
| 欄位 | 類型 | 說明 | 必要 |
|------|------|------|------|
| `semester` | string | 學期 | ✅ |
| `courseName` | string | 課程名稱 | ✅ |
| `date` | string | 日期（YYYY-MM-DD） | ✅ |
| `overviewPhotos` | file[] | 課程總覽照片 | ❌ |
| `videos` | file[] | 課程總覽影片 | ❌ |
| `overviewSummary` | string | 課程摘要 | ❌ |
| `topic` | string | 主題 | ❌ |
| `isOverview` | boolean/string | 是否為課程總覽（'true'） | ✅ |

### 向後相容欄位

為了與舊版前端相容，以下欄位也被支援：

| 欄位 | 說明 | 用途 |
|------|------|------|
| `course` | 課程名稱（短版） | 與 `period` 組合使用 |
| `period` | 時段 | 與 `course` 組合使用 |
| `coursePeriod` | 完整課程路徑 | 例如：114-1/SPIKE 三... |
| `relativePath` | 相對路徑 | 直接指定路徑 |

---

## 📨 回應格式

### 成功回應（200 OK）

#### 學生記錄
```json
{
  "success": true,
  "message": "學習記錄上傳成功",
  "data": {
    "basePath": "/FLB-Learning-Portfolio/114-1/SPIKE.../2025-11-08/測試學生",
    "studentName": "測試學生",
    "photos": 3,
    "videos": 0,
    "comment": {
      "text": "評語內容...",
      "length": 60
    },
    "files": {
      "photos": [
        {
          "name": "測試學生_photo_1_1699401234567_abc123.jpg",
          "url": "/api/drive-media/FLB-Learning-Portfolio/.../photo_1.jpg",
          "size": 12345
        }
      ],
      "videos": []
    },
    "metadata": {
      "semester": "114-1",
      "courseName": "SPIKE 三 18:30-20:30 第8週",
      "date": "2025-11-08",
      "studentName": "測試學生",
      "uploadTime": "2025-11-08T00:00:00.000Z",
      "totalPhotos": 3,
      "totalVideos": 0
    }
  }
}
```

#### 課程總覽
```json
{
  "success": true,
  "message": "課程總覽上傳成功",
  "data": {
    "basePath": "/FLB-Learning-Portfolio/114-1/SPIKE.../2025-11-08/課程總覽",
    "photos": 2,
    "videos": 0,
    "summary": {
      "text": "本週課程進行順利...",
      "length": 40
    },
    "files": {
      "photos": [
        {
          "name": "overview_photo_1_1699401234567_abc123.jpg",
          "url": "/api/drive-media/FLB-Learning-Portfolio/.../overview_photo_1.jpg",
          "size": 12345
        }
      ],
      "videos": []
    },
    "metadata": {
      "semester": "114-1",
      "courseName": "SPIKE 三 18:30-20:30 第8週",
      "date": "2025-11-08",
      "isOverview": true,
      "uploadTime": "2025-11-08T00:00:00.000Z",
      "totalPhotos": 2,
      "totalVideos": 0
    }
  }
}
```

### 錯誤回應

#### 400 Bad Request（驗證失敗）
```json
{
  "success": false,
  "error": "至少需要上傳 3 張照片"
}
```

```json
{
  "success": false,
  "error": "評語至少需要 20 個字"
}
```

```json
{
  "success": false,
  "error": "缺少必要欄位: semester, courseName, date"
}
```

#### 500 Internal Server Error（伺服器錯誤）
```json
{
  "success": false,
  "error": "上傳失敗: 連線逾時"
}
```

---

## 🧪 測試範例

### 使用 cURL（學生記錄）

```bash
curl -X POST http://localhost:3002/api/learning-records/upload-drive \
  -F "semester=114-1" \
  -F "courseName=SPIKE 三 18:30-20:30 第8週" \
  -F "date=2025-11-08" \
  -F "topic=測試主題" \
  -F "studentName=測試學生" \
  -F "comment=這是一個測試評語，用於驗證 Synology Drive API 上傳功能是否正常運作。評語需要至少 20 個字。" \
  -F "isOverview=false" \
  -F "photos=@photo1.jpg" \
  -F "photos=@photo2.jpg" \
  -F "photos=@photo3.jpg"
```

### 使用 cURL（課程總覽）

```bash
curl -X POST http://localhost:3002/api/learning-records/upload-drive \
  -F "semester=114-1" \
  -F "courseName=SPIKE 三 18:30-20:30 第8週" \
  -F "date=2025-11-08" \
  -F "overviewSummary=本週課程進行順利，學生們展現高度學習興趣。" \
  -F "isOverview=true" \
  -F "overviewPhotos=@overview1.jpg" \
  -F "overviewPhotos=@overview2.jpg"
```

### 使用 JavaScript（Fetch API）

```javascript
async function uploadStudentRecord() {
  const formData = new FormData();
  
  // 基本資料
  formData.append('semester', '114-1');
  formData.append('courseName', 'SPIKE 三 18:30-20:30 第8週');
  formData.append('date', '2025-11-08');
  formData.append('studentName', '測試學生');
  formData.append('comment', '這是一個測試評語，長度超過 20 個字符。');
  formData.append('isOverview', 'false');
  
  // 添加照片
  const photoInput = document.querySelector('#photo-input');
  for (const file of photoInput.files) {
    formData.append('photos', file);
  }
  
  try {
    const response = await fetch('/api/learning-records/upload-drive', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ 上傳成功！', result.data);
      alert('學習記錄上傳成功！');
    } else {
      console.error('❌ 上傳失敗:', result.error);
      alert('上傳失敗: ' + result.error);
    }
  } catch (error) {
    console.error('❌ 網路錯誤:', error);
    alert('網路錯誤，請檢查連線');
  }
}
```

### 使用 Node.js（測試腳本）

```javascript
// 參考 test-drive-upload.js
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');

async function testUpload() {
  const form = new FormData();
  
  form.append('semester', '114-1');
  form.append('courseName', 'SPIKE 三 18:30-20:30 第8週');
  form.append('date', '2025-11-08');
  form.append('studentName', '測試學生');
  form.append('comment', '評語至少 20 個字符...');
  form.append('isOverview', 'false');
  
  form.append('photos', fs.createReadStream('photo1.jpg'));
  form.append('photos', fs.createReadStream('photo2.jpg'));
  form.append('photos', fs.createReadStream('photo3.jpg'));
  
  const response = await axios.post(
    'http://localhost:3002/api/learning-records/upload-drive',
    form,
    {
      headers: form.getHeaders()
    }
  );
  
  console.log(response.data);
}
```

---

## 🚀 快速開始

### 1. 確認伺服器運行

```bash
# 啟動伺服器
npm run dev

# 或生產模式
npm start
```

伺服器應顯示：
```
✅ Synology Drive 客戶端已初始化
🚀 FLB講師行事曆LIFF應用運行在端口 3002
```

### 2. 執行測試腳本

```bash
# 執行完整測試
node test-drive-upload.js
```

測試會自動執行 4 個測試案例：
1. ✅ 學生記錄上傳
2. ✅ 課程總覽上傳
3. ✅ 照片門檻驗證
4. ✅ 評語門檻驗證

### 3. 檢查 Drive 中的檔案

登入 Synology NAS 網頁介面，開啟 File Station，檢查：

```
/FLB-Learning-Portfolio/
  └── 114-1/
      └── SPIKE 三 18:30-20:30 第8週/
          └── 2025-11-08/
              ├── 測試學生/
              │   ├── 測試學生_photo_1_*.png
              │   ├── 測試學生_photo_2_*.png
              │   ├── 測試學生_photo_3_*.png
              │   ├── comment.txt
              │   └── record-meta.json
              └── 課程總覽/
                  ├── overview_photo_1_*.png
                  ├── overview_photo_2_*.png
                  ├── summary.txt
                  └── record-meta.json
```

---

## 🔄 從舊版 API 遷移

### 前端修改

#### 修改 API 端點

```javascript
// 舊版
const API_ENDPOINT = '/api/learning-records/upload';

// 新版
const API_ENDPOINT = '/api/learning-records/upload-drive';
```

#### 參數格式調整（建議）

```javascript
// 建議使用新格式（更明確）
formData.append('semester', '114-1');
formData.append('courseName', 'SPIKE 三 18:30-20:30 第8週');

// 舊格式仍可使用（向後相容）
formData.append('coursePeriod', '114-1/SPIKE 三 18:30-20:30 第8週');
```

### 回應格式變更

新版 API 回應中的檔案 URL 使用代理格式：

```javascript
// 舊版（本地路徑）
const photoUrl = `/data/learning-portfolio/${semester}/.../photo.jpg`;

// 新版（代理 URL）
const photoUrl = result.data.files.photos[0].url;
// 例如：/api/drive-media/FLB-Learning-Portfolio/.../photo.jpg
```

---

## ⚠️ 注意事項

### 檔案大小限制
- 最大單檔: 200MB
- 最大總大小: 無限制（受 Drive 空間限制）

### 門檻要求

#### 學生記錄
- 照片: 至少 3 張
- 評語: 至少 20 個字

#### 課程總覽
- 照片: 無限制（0 張也可）
- 摘要: 無限制（可為空）

### 支援的檔案格式

#### 照片
- JPG / JPEG
- PNG
- HEIC / HEIF
- GIF
- WebP

#### 影片
- MP4
- MOV
- AVI
- WebM

### 效能考量

- 大檔案上傳需要較長時間
- 建議照片控制在 5MB 以內
- 建議影片控制在 100MB 以內
- 批次上傳建議每次不超過 10 個檔案

---

## 🐛 常見問題

### Q: 上傳失敗，錯誤訊息「連線逾時」？
**A**: 檢查環境變數 `.env.nas` 中的 `SYNOLOGY_HOST` 是否正確，並確認 NAS 可以連線。

### Q: 上傳成功但在 Drive 中找不到檔案？
**A**: 檢查 `SYNOLOGY_DRIVE_ROOT` 路徑設定，並確認該目錄在 Drive 中存在。

### Q: 照片上傳後無法預覽？
**A**: 確認代理 API (`/api/drive-media/*`) 運作正常，可以使用瀏覽器直接存取測試。

### Q: 舊版 API 和新版 API 可以並存嗎？
**A**: 可以！新版 API 使用不同的端點，不會影響舊版。建議逐步遷移。

### Q: 如何回滾到舊版本？
**A**: 只需將前端 API 端點改回 `/api/learning-records/upload` 即可。

---

## 📞 技術支援

### 日誌查看

```bash
# Docker 環境
docker-compose logs -f --tail=100 web

# 本地環境
tail -f logs/server.log
```

### 關鍵日誌標籤

- `[Drive 上傳]` - 上傳流程
- `[Drive 代理]` - 檔案存取
- `[SynologyDrive]` - Drive API 呼叫
- `[DrivePathManager]` - 路徑管理

### 手動測試 Drive 連線

```bash
node test-drive-connection.js
```

---

## 📚 相關文檔

- **SYNOLOGY-DRIVE-IMPLEMENTATION-GUIDE.md** - 完整實施指南
- **DRIVE-INTEGRATION-SUMMARY.md** - 整合總結
- **SYNOLOGY-DRIVE-INTEGRATION-PROGRESS.md** - 進度追蹤

---

**文檔版本**: 1.0.0  
**建立日期**: 2025-11-08  
**維護者**: AI Assistant + User

