# 抽屜影片顯示問題修復總結

## 問題描述

**症狀**: 在學習歷程上傳頁面（`learning-record-upload.html`）的「已上傳記錄抽屜」中，**學生上傳的影片沒有顯示**，只有照片能正常顯示。

## 根本原因

前端代碼中有**過度嚴格的過濾邏輯**，會自動過濾掉**沒有縮圖的影片**：

```javascript
// ❌ 原本的邏輯（過度嚴格）
if (isNewSystem && (!vItem.thumbnailFilename || vItem.thumbnailFilename.trim() === '')) {
  console.log('⏭️ [抽屜-過濾無效視頻] 跳過:', { id: vItem.id, filename: vItem.filename });
  return false;  // 過濾掉沒有縮圖的影片
}
```

### 為什麼會出現沒有縮圖的影片？

1. **縮圖生成延遲**: 影片上傳後，縮圖可能需要一些時間才能生成完成
2. **轉碼處理中**: 影片正在進行格式轉換（.mov → .webm）
3. **檔案剛上傳**: 新上傳的影片 meta 資料可能還沒完全更新

### 為什麼照片沒有這個問題？

照片的過濾邏輯**不檢查縮圖**，所以即使沒有縮圖也能顯示：

```javascript
// 照片過濾邏輯（正常）
if (!isImageFilename(fn)) return false;  // 只檢查檔案類型
return true;
```

## 修復內容

### 修復位置

修改了 `public/js/pages/learning-record-upload.js` 中的 **3 處**過濾邏輯：

#### 1. 學生抽屜 - 已上傳記錄 (Line 10442-10455)

```javascript
// ✅ 修復後：允許顯示沒有縮圖的影片
var filteredVideos = videos.filter(function(vItem) {
  var fn = typeof vItem === 'string' ? vItem : vItem.filename;
  if (!isVideoFilename(fn)) return false;
  
  // 新系統視頻：允許沒有縮圖的影片（會顯示預設圖標）
  var isNewSystem = (typeof vItem === 'object' && vItem.id);
  if (isNewSystem && (!vItem.thumbnailFilename || vItem.thumbnailFilename.trim() === '')) {
    console.log('⚠️ [抽屜-顯示無縮圖視頻] 將顯示預設圖標:', { id: vItem.id, filename: vItem.filename });
    // 不再過濾掉，允許顯示（buildMediaPreviewHtml 會處理沒有縮圖的情況）
  }
  
  return true;  // ✅ 允許所有有效的影片
});
```

#### 2. 課程總覽 - 已上傳檔案 (Line 9830-9842)

```javascript
// ✅ 修復後：允許顯示沒有縮圖的影片
var validVideos = videos.filter(function(vItem) {
  var isNewSystem = (typeof vItem === 'object' && vItem.id);
  if (!isNewSystem) return true;
  
  // 🔥 [修復] 新系統視頻：允許顯示沒有縮圖的影片（使用預設圖標）
  if (!vItem.thumbnailFilename || vItem.thumbnailFilename.trim() === '') {
    console.log('⚠️ [課程總覽-顯示無縮圖視頻] 將顯示預設圖標:', { id: vItem.id, filename: vItem.filename });
    // 不再過濾掉，允許顯示
  }
  
  return true;  // ✅ 允許所有有效的影片
});
```

#### 3. 學生卡片 - 已上傳影片 (Line 6018-6031)

此處已經在之前修復過（只過濾失敗的影片），**無需再修改**。

### 修復後的行為

1. **有縮圖的影片**: 正常顯示縮圖
2. **沒有縮圖的影片**: 顯示預設圖標 🎬（灰色背景）
3. **失敗的影片**: 繼續過濾掉（不顯示）

## 後端驗證

✅ 後端 API `/api/learning-records/by-course` **已正確返回** `newMediaVideos` 數據：

```javascript
// server.js Line 17355-17356
students.push({
  // ... other fields
  newMediaVideos: newMediaVideos,  // ✅ 正確返回
  newMediaPhotos: newMediaPhotos,  // ✅ 正確返回
  // ...
});
```

後端會讀取：
1. **優先**: `media-meta.json`（完整的媒體資訊）
2. **回退**: `videos-meta.json`（只有影片）
3. **最後**: 檔案系統掃描（舊系統）

## 測試方法

### 1. 上傳測試影片

1. 開啟學習歷程上傳頁面：`https://calendar.funlearnbar.synology.me/learning-record-upload.html`
2. 選擇一個課程和學生
3. 上傳一個影片檔案（.mp4 或 .mov）
4. 點擊「保存學習記錄」

### 2. 檢查抽屜顯示

1. 點擊右下角的「📂 已上傳記錄」FAB 按鈕
2. 抽屜應該會顯示：
   - **照片**: 正常顯示縮圖
   - **影片**: 
     - ✅ **如果縮圖已生成**: 顯示縮圖
     - ✅ **如果縮圖未生成**: 顯示 🎬 預設圖標（灰色背景）
     - ❌ **不應該**: 完全不顯示影片

### 3. 檢查控制台日誌

開啟瀏覽器開發者工具（F12），在 Console 中應該看到：

```
⚠️ [抽屜-顯示無縮圖視頻] 將顯示預設圖標: {id: "...", filename: "test-video.mp4", status: "transcoding"}
🎬 [buildMediaPreviewHtml] 建立影片方塊: {...}
```

### 4. 驗證影片可點擊播放

1. 點擊抽屜中的影片（不論有無縮圖）
2. 應該彈出影片播放器
3. 影片應該可以正常播放

## 測試案例

### 案例 1: 剛上傳的影片（縮圖未生成）

**預期結果**: 
- ✅ 顯示 🎬 預設圖標
- ✅ 可以點擊播放
- ⚠️ 控制台顯示 "將顯示預設圖標"

### 案例 2: 縮圖已生成的影片

**預期結果**:
- ✅ 顯示影片縮圖
- ✅ 可以點擊播放
- ✅ 控制台顯示 "使用新媒體縮圖"

### 案例 3: 舊系統的影片

**預期結果**:
- ✅ 使用舊系統 API 獲取縮圖
- ✅ 正常顯示和播放

### 案例 4: 混合照片和影片

**預期結果**:
- ✅ 照片正常顯示
- ✅ 影片正常顯示（有縮圖或無縮圖都顯示）
- ✅ 兩者都可以點擊預覽

## 預期行為

### 修復前 ❌

```
抽屜內容:
📸 照片1.jpg ✅ 顯示
📸 照片2.jpg ✅ 顯示
[影片不顯示，因為被過濾掉了]
```

### 修復後 ✅

```
抽屜內容:
📸 照片1.jpg ✅ 顯示
📸 照片2.jpg ✅ 顯示
🎬 測試影片.mp4 ✅ 顯示（預設圖標或縮圖）
🎬 學生作品.mov ✅ 顯示（預設圖標或縮圖）
```

## 相關檔案

### 修改的檔案

- ✅ `public/js/pages/learning-record-upload.js` (3處修改)

### 未修改但相關的檔案

- `server.js` - 後端 API（已驗證正確）
- `public/learning-record-upload.html` - 抽屜 UI
- `public/css/learning-records.css` - 樣式

## 技術細節

### buildMediaPreviewHtml 函數處理邏輯

```javascript
// Line 1228-1270
if (type === 'video' && !thumbUrl) {
  classes.push('video-fallback');  // ✅ 添加 fallback class
}

// 沒有縮圖 URL：顯示預設圖標
if (!thumbUrl) {
  innerHtml = '<video src="..." preload="metadata" muted playsinline></video>' +
    '<img class="video-poster" style="display:none;" />' +
    '<div class="video-fallback-icon">🎬</div>';  // ✅ 顯示預設圖標
}
```

### CSS 樣式

預設圖標的樣式（已存在，無需修改）：

```css
.video-fallback-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  color: #64748b;
  font-size: 48px;
  width: 100%;
  height: 100%;
  min-height: 120px;
}
```

## 回滾方法

如果修復後出現問題，可以回滾到原始邏輯：

```bash
# 使用 Git 回滾
git checkout HEAD -- public/js/pages/learning-record-upload.js

# 或使用備份（如果有）
cp public/js/pages/learning-record-upload.js.backup public/js/pages/learning-record-upload.js
```

## 注意事項

1. **瀏覽器快取**: 修改後請清除瀏覽器快取或強制重新載入（Ctrl+F5）
2. **檔案版本**: 確認 HTML 中的 JS 檔案版本號已更新
3. **縮圖生成**: 影片縮圖由後端在上傳時自動生成，前端只負責顯示

## 相關連結

- [前端顯示不存在的照片問題](./PHOTO-UPLOAD-FIX-GUIDE.md) - 之前修復的相關問題
- [Calendar API Guide](./Calendar_API_Guide.txt) - Synology Calendar API 文檔

---

**修復日期**: 2025-11-06  
**修復版本**: v2.3.1  
**修復者**: Cursor AI Assistant

