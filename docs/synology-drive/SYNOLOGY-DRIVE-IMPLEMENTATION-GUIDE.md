# Synology Drive API 整合 - 詳細實施指南

**文檔日期**: 2025-11-08  
**適用版本**: v1.0.0  
**狀態**: 階段性完成（基礎架構已建立）

---

## 📋 總覽

本指南提供完整的 Synology Drive API 整合步驟，包括已完成的工作、待實施的功能，以及詳細的程式碼範例。

### 已完成工作（✅ 50%）

1. ✅ **專案備份** - 完整備份到 `backups/backup-20251108-004413/`
2. ✅ **Drive 客戶端模組** - `synology-drive-client.js`（完整）
3. ✅ **路徑管理模組** - `drive-path-manager.js`（完整）
4. ✅ **環境變數配置** - `.env.nas`（範本）
5. ✅ **Multer 重構** - 改為 memory storage
6. ✅ **代理 API** - `/api/drive-media/*` 安全存取

### 待完成工作（⏳ 50%）

1. ⏳ **上傳 API 重構** - 將 Buffer 上傳到 Drive
2. ⏳ **預覽 API 重構** - 從 Drive 讀取檔案列表
3. ⏳ **刪除 API 重構** - 調用 Drive 刪除
4. ⏳ **前端 URL 更新** - 使用代理 URL
5. ⏳ **測試** - 單元測試、整合測試
6. ⏳ **部署** - 配置環境變數、上線

---

## 📂 檔案結構

```
flb-calendar-nas/
├── synology-drive-client.js          ✅ Drive API 客戶端（新增）
├── drive-path-manager.js             ✅ 路徑管理器（新增）
├── .env.nas                           ✅ 環境變數（範本已建立，需填入真實值）
├── server.js                          ⚠️ 部分重構（需繼續）
├── backups/
│   └── backup-20251108-004413/       ✅ 完整備份
└── public/
    └── js/
        └── modules/
            └── learning-upload/       ⏳ 待更新（前端 URL）
```

---

## 🔧 環境變數配置

### 步驟 1：填寫 .env.nas

請編輯 `.env.nas` 檔案，填入真實的 Synology NAS 資訊：

```env
# Synology NAS 主機（不含協定）
SYNOLOGY_HOST=your-nas.synology.me

# 端口（HTTPS 預設 5001）
SYNOLOGY_PORT=5001

# 協定
SYNOLOGY_PROTOCOL=https

# 登入帳號（需有 FileStation 權限）
SYNOLOGY_USERNAME=your-username

# 登入密碼
SYNOLOGY_PASSWORD=your-secure-password

# Drive 根目錄
SYNOLOGY_DRIVE_ROOT=/Fun Learn Bar/FLB-Learning-Portfolio
```

### 步驟 2：驗證連線

啟動伺服器後，檢查日誌是否有：

```
✅ Synology Drive 客戶端已初始化
```

### 步驟 3：測試認證

創建測試腳本 `test-drive-connection.js`:

```javascript
require('dotenv').config({ path: '.env.nas' });
const SynologyDriveClient = require('./synology-drive-client');

async function testConnection() {
    const client = new SynologyDriveClient({
        host: process.env.SYNOLOGY_HOST,
        port: process.env.SYNOLOGY_PORT || 5001,
        protocol: process.env.SYNOLOGY_PROTOCOL || 'https',
        username: process.env.SYNOLOGY_USERNAME,
        password: process.env.SYNOLOGY_PASSWORD
    });

    try {
        console.log('🔐 測試登入...');
        await client.login();
        console.log('✅ 登入成功！');

        console.log('📁 測試創建目錄...');
        await client.createFolder('/FLB-Learning-Portfolio/test');
        console.log('✅ 目錄創建成功！');

        console.log('📋 測試列出檔案...');
        const result = await client.listFiles('/FLB-Learning-Portfolio');
        console.log('✅ 找到', result.files.length, '個檔案');

        await client.logout();
        console.log('✅ 所有測試通過！');
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
    }
}

testConnection();
```

執行測試：

```bash
node test-drive-connection.js
```

---

## 📤 上傳 API 重構範例

### 現有上傳 API

位置：`server.js` line 16901

```javascript
app.post('/api/learning-records/upload', upload.fields([
  { name: 'photos', maxCount: 50 },
  { name: 'videos', maxCount: 20 },
  { name: 'overviewPhotos', maxCount: 50 }
]), async (req, res) => {
  // 現有實作：檔案已由 multer 寫入本地磁碟
  // 需改為：從 req.files[].buffer 上傳到 Drive
});
```

### 重構後（範例）

```javascript
app.post('/api/learning-records/upload', upload.fields([
  { name: 'photos', maxCount: 50 },
  { name: 'videos', maxCount: 20 },
  { name: 'overviewPhotos', maxCount: 50 }
]), async (req, res) => {
  try {
    const { 
      semester, 
      courseName, 
      date, 
      topic, 
      studentName, 
      isOverview 
    } = req.body;

    console.log('📤 [學習記錄上傳] 開始上傳到 Drive:', {
      semester,
      courseName,
      date,
      topic,
      studentName: studentName || '課程總覽'
    });

    // 構建 Drive 路徑
    const basePath = isOverview === 'true'
      ? drivePathManager.buildOverviewRecordPath(semester, courseName, date, topic)
      : drivePathManager.buildStudentRecordPath(semester, courseName, date, topic, studentName);

    console.log('📁 [Drive 上傳] 目標路徑:', basePath);

    // 確保目錄存在
    await driveClient.ensureFolderExists(basePath);

    // 上傳所有檔案
    const uploadResults = [];
    
    // 處理照片
    if (req.files.photos && req.files.photos.length > 0) {
      console.log('📸 [Drive 上傳] 上傳', req.files.photos.length, '張照片');
      
      for (const photo of req.files.photos) {
        const fileName = `${studentName || 'overview'}_photo_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(photo.originalname)}`;
        const filePath = path.posix.join(basePath, fileName);
        
        const result = await driveClient.uploadFile(photo.buffer, filePath, {
          contentType: photo.mimetype,
          overwrite: false
        });
        
        uploadResults.push({
          type: 'photo',
          originalName: photo.originalname,
          drivePath: result.path,
          proxyUrl: `/api/drive-media${result.path.substring(1)}`, // 移除開頭的 /
          size: photo.size
        });
      }
    }

    // 處理影片（類似）
    if (req.files.videos && req.files.videos.length > 0) {
      console.log('🎥 [Drive 上傳] 上傳', req.files.videos.length, '個影片');
      
      for (const video of req.files.videos) {
        const fileName = `${studentName || 'overview'}_video_${Date.now()}_${Math.random().toString(36).substring(7)}${path.extname(video.originalname)}`;
        const filePath = path.posix.join(basePath, fileName);
        
        const result = await driveClient.uploadFile(video.buffer, filePath, {
          contentType: video.mimetype,
          overwrite: false
        });
        
        uploadResults.push({
          type: 'video',
          originalName: video.originalname,
          drivePath: result.path,
          proxyUrl: `/api/drive-media${result.path.substring(1)}`,
          size: video.size
        });
      }
    }

    // 儲存元資料到 Drive（record-meta.json）
    const metadata = {
      semester,
      courseName,
      date,
      topic,
      studentName: studentName || null,
      isOverview: isOverview === 'true',
      uploadTime: new Date().toISOString(),
      files: uploadResults,
      comment: req.body.comment || ''
    };

    const metaPath = drivePathManager.getRecordMetaPath(basePath);
    const metaBuffer = Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');
    
    await driveClient.uploadFile(metaBuffer, metaPath, {
      contentType: 'application/json',
      overwrite: true
    });

    console.log('✅ [Drive 上傳] 上傳完成:', uploadResults.length, '個檔案');

    res.json({
      success: true,
      message: '上傳成功',
      data: {
        basePath,
        uploadCount: uploadResults.length,
        files: uploadResults
      }
    });

  } catch (error) {
    console.error('❌ [Drive 上傳] 失敗:', error.message);
    res.status(500).json({
      success: false,
      error: '上傳失敗: ' + error.message
    });
  }
});
```

---

## 🔍 預覽 API 重構範例

### 現有預覽 API

位置：`server.js` line 18695

```javascript
app.get('/api/learning-records/file', (req, res) => {
  // 現有實作：從本地檔案系統讀取
  // 需改為：從 Drive 讀取檔案列表
});
```

### 重構後（範例）

```javascript
app.get('/api/learning-records/file', async (req, res) => {
  try {
    const { semester, course, date, student } = req.query;

    console.log('🔍 [學習記錄查詢]:', { semester, course, date, student });

    // 構建 Drive 路徑
    const basePath = student 
      ? drivePathManager.buildStudentRecordPath(semester, course, date, null, student)
      : drivePathManager.buildOverviewRecordPath(semester, course, date, null);

    console.log('📁 [Drive 查詢] 路徑:', basePath);

    // 列出目錄中的檔案
    const result = await driveClient.listFiles(basePath);

    // 過濾照片和影片
    const photos = result.files
      .filter(file => drivePathManager.isImageFile(file.name))
      .map(file => ({
        name: file.name,
        path: file.path,
        proxyUrl: `/api/drive-media${file.path.substring(1)}`,
        size: file.additional?.size || 0,
        uploadTime: file.additional?.time?.mtime || null
      }));

    const videos = result.files
      .filter(file => drivePathManager.isVideoFile(file.name))
      .map(file => ({
        name: file.name,
        path: file.path,
        proxyUrl: `/api/drive-media${file.path.substring(1)}`,
        size: file.additional?.size || 0,
        uploadTime: file.additional?.time?.mtime || null
      }));

    // 讀取元資料
    let metadata = {};
    const metaPath = drivePathManager.getRecordMetaPath(basePath);
    try {
      const metaFileStream = await driveClient.getFileStream(metaPath);
      const metaContent = await streamToString(metaFileStream);
      metadata = JSON.parse(metaContent);
    } catch (metaError) {
      console.warn('⚠️ [Drive 查詢] 未找到元資料檔案');
    }

    res.json({
      success: true,
      data: {
        photos,
        videos,
        metadata,
        totalFiles: photos.length + videos.length
      }
    });

  } catch (error) {
    console.error('❌ [Drive 查詢] 失敗:', error.message);
    res.status(500).json({
      success: false,
      error: '查詢失敗: ' + error.message
    });
  }
});

// 輔助函數：將 Stream 轉為字串
function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}
```

---

## 🗑️ 刪除 API 重構範例

### 現有刪除 API

位置：`server.js` line 18337

```javascript
app.delete('/api/learning-records/:recordId', async (req, res) => {
  // 現有實作：刪除本地檔案
  // 需改為：調用 Drive 刪除
});
```

### 重構後（範例）

```javascript
app.delete('/api/learning-records/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { filePath } = req.query; // 可選：指定單一檔案路徑

    console.log('🗑️ [刪除記錄]:', { recordId, filePath });

    if (filePath) {
      // 刪除單一檔案
      const drivePath = drivePathManager.localToDrivePath(filePath);
      await driveClient.deleteFile(drivePath);
      
      console.log('✅ [Drive 刪除] 單一檔案已刪除');
      
      res.json({
        success: true,
        message: '檔案已刪除'
      });
    } else {
      // 刪除整個記錄目錄
      // recordId 格式範例：114-1/SPIKE.../2025-11-05/蔡定言
      const drivePath = drivePathManager.buildPath({
        // 從 recordId 解析參數...
        // 這裡需要根據你的 recordId 格式來解析
      });
      
      await driveClient.deleteFile(drivePath, { recursive: true });
      
      console.log('✅ [Drive 刪除] 目錄已刪除');
      
      res.json({
        success: true,
        message: '記錄已刪除'
      });
    }

  } catch (error) {
    console.error('❌ [Drive 刪除] 失敗:', error.message);
    res.status(500).json({
      success: false,
      error: '刪除失敗: ' + error.message
    });
  }
});
```

---

## 🎨 前端 URL 更新

### 需要更新的檔案

1. **public/js/modules/learning-upload/shared-media-loader.js**
2. **public/js/modules/learning-upload/shared-media-previewer.js**
3. **public/js/pages/learning-record-upload.js**

### 更新範例

#### 原本（本地路徑）

```javascript
// shared-media-loader.js
const photoUrl = `/data/learning-portfolio/${semester}/${course}/${date}/${student}/${photoName}`;
```

#### 更新後（代理 URL）

```javascript
// shared-media-loader.js
const photoUrl = `/api/drive-media/FLB-Learning-Portfolio/${semester}/${course}/${date}/${student}/${photoName}`;
```

或使用後端提供的 URL：

```javascript
// 假設後端回傳的資料已包含 proxyUrl
const photoUrl = record.files[0].proxyUrl; // 例如：/api/drive-media/FLB-Learning-Portfolio/.../photo.jpg
```

---

## 🧪 測試計畫

### 單元測試

創建 `test/drive-client.test.js`:

```javascript
const SynologyDriveClient = require('../synology-drive-client');

describe('SynologyDriveClient', () => {
  let client;

  beforeAll(() => {
    client = new SynologyDriveClient({
      host: process.env.SYNOLOGY_HOST,
      port: 5001,
      protocol: 'https',
      username: process.env.SYNOLOGY_USERNAME,
      password: process.env.SYNOLOGY_PASSWORD
    });
  });

  test('應該能夠成功登入', async () => {
    const result = await client.login();
    expect(result.success).toBe(true);
    expect(client.sid).toBeDefined();
  });

  test('應該能夠創建目錄', async () => {
    const testPath = '/FLB-Learning-Portfolio/test-' + Date.now();
    const result = await client.createFolder(testPath);
    expect(result.success).toBe(true);
  });

  // 更多測試...
});
```

### 整合測試

手動測試步驟：

1. **上傳測試**
   - 開啟前端上傳頁面
   - 選擇學生和課程
   - 上傳照片/影片
   - 檢查 NAS Drive 中是否出現檔案

2. **預覽測試**
   - 查詢已上傳的記錄
   - 檢查照片/影片是否正確顯示
   - 檢查代理 URL 是否有效

3. **刪除測試**
   - 刪除單一檔案
   - 刪除整個記錄
   - 檢查 NAS Drive 中檔案是否已移除

---

## 🚀 部署步驟

### 1. 準備環境

```bash
# 填寫 .env.nas 真實值
nano .env.nas

# 安裝依賴（如果尚未安裝）
npm install
```

### 2. 測試連線

```bash
# 執行連線測試腳本
node test-drive-connection.js
```

### 3. 啟動伺服器（開發模式）

```bash
# 使用 nodemon（自動重啟）
npm run dev
```

### 4. 驗證功能

- 訪問健康檢查：`http://localhost:3002/api/health`
- 測試代理 API：`http://localhost:3002/api/drive-media/FLB-Learning-Portfolio/test.txt`

### 5. 部署到生產環境

```bash
# 構建 Docker 容器（如果使用 Docker）
docker-compose build --no-cache

# 啟動服務
docker-compose up -d

# 查看日誌
docker-compose logs -f --tail=100
```

---

## ⚠️ 注意事項

### 安全性

1. **不要提交 .env.nas 到 Git**
   - 已在 `.gitignore` 中排除
   - 包含敏感的登入資訊

2. **SID 管理**
   - SID 會自動過期（約 1 小時）
   - Drive 客戶端會自動重新認證
   - 代理 API 有重試機制

3. **路徑驗證**
   - 所有 Drive 路徑都會驗證是否在根目錄下
   - 防止路徑穿越攻擊

### 效能

1. **檔案大小限制**
   - 已提升到 200MB
   - 大型檔案建議分片上傳

2. **快取策略**
   - 代理 API 設定 24 小時快取
   - 減少重複下載

3. **並發控制**
   - 批次上傳時建議控制並發數
   - 避免超過 Drive API 限制

### 相容性

1. **向後相容**
   - 新上傳使用 Drive
   - 舊檔案仍可從本地讀取
   - 需要在預覽 API 中處理雙重來源

2. **漸進遷移**
   - 建議先在測試環境驗證
   - 逐步將舊檔案遷移到 Drive
   - 保留本地備份至少 30 天

---

## 📞 支援與除錯

### 常見問題

**Q: 登入失敗，error code 400**
- A: 檢查帳號密碼是否正確
- A: 確認帳號有 FileStation 權限

**Q: 上傳失敗，error code 1100**
- A: 目錄已存在，這是正常的（會自動處理）

**Q: 代理 API 回傳 500 錯誤**
- A: 檢查 SID 是否過期（查看日誌）
- A: 確認檔案路徑正確

### 日誌查看

```bash
# Docker 環境
docker-compose logs -f web

# 本地環境
tail -f logs/server.log
```

### 除錯技巧

1. **啟用詳細日誌**
   - 在 Drive 客戶端中已包含詳細日誌
   - 所有操作都會記錄

2. **使用 Synology File Station**
   - 直接在 NAS 網頁介面檢查檔案
   - 驗證檔案是否成功上傳

3. **測試 API**
   ```bash
   # 測試代理 API
   curl http://localhost:3002/api/drive-media/FLB-Learning-Portfolio/test.txt
   
   # 測試上傳 API（使用 Postman 或類似工具）
   ```

---

## 📚 參考資源

- **Synology Drive 官方文檔**: [https://www.synology.com/](https://www.synology.com/)
- **專案 .cursorrules**: 完整的編碼規範
- **AGENTS.md**: 專案指引
- **SYNOLOGY-DRIVE-INTEGRATION-PROGRESS.md**: 進度追蹤

---

**文檔維護者**: AI Assistant + User  
**最後更新**: 2025-11-08  
**版本**: 1.0.0  
**狀態**: 基礎架構完成，待完成上傳/預覽/刪除 API 重構
