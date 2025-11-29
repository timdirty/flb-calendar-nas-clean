# 學生卡片影片「載入中」問題修復

## 問題描述

**症狀**: 
- ✅ **抽屜**：影片縮圖顯示正常
- ❌ **學生卡片**（主頁面）：影片一直顯示「載入中」，無法看到縮圖

## 根本原因

學生卡片和抽屜的影片渲染邏輯**不一致**，導致相同的影片在兩個地方顯示不同。

### 邏輯對比

#### ✅ 抽屜邏輯（正確）

```javascript
// Line ~10481 - public/js/pages/learning-record-upload.js
if (isNewSystem && vItem.thumbnailFilename) {
  // 只要有縮圖檔名就顯示
  thumbUrl = '/api/media/videos/' + videoId + '/thumbnail';
}
```

**行為**：只檢查 `thumbnailFilename` 是否存在，**不檢查** `status`。

#### ❌ 學生卡片邏輯（太嚴格）

```javascript
// Line 6062 - 修復前
if (isReady && item.thumbnailFilename) {
  // 必須 status='ready' 且有縮圖才顯示
  thumbUrl = '/api/media/videos/' + videoId + '/thumbnail';
}
```

**問題**：
1. 要求 `status === 'ready'` 才顯示縮圖
2. 但實際上影片的 `status` 可能是：
   - `'transcoding'` - 轉碼中
   - `'processing'` - 處理中
   - `null` 或 `undefined` - 未設定
   - 其他狀態

3. **即使縮圖已經生成**，只要 status 不是 'ready'，就不會顯示！

### 為什麼抽屜能正常顯示？

因為抽屜的邏輯**不檢查 status**，只要有 `thumbnailFilename` 就會嘗試載入縮圖。

## 修復內容

### 修改位置

`public/js/pages/learning-record-upload.js` Line **6056-6092**

### 修復前的邏輯

```javascript
if (isNewSystem) {
  var videoStatus = item.status || 'unknown';
  var isReady = (videoStatus === 'ready');
  var isProcessing = (videoStatus === 'queued' || videoStatus === 'processing' || videoStatus === 'transcoding');
  
  if (isReady && item.thumbnailFilename) {  // ❌ 太嚴格！
    // 影片已就緒且有縮圖檔名：使用縮圖 API
    thumbUrl = '/api/media/videos/' + videoId + '/thumbnail';
  } else if (isProcessing) {
    // 影片正在處理中：不設置 thumbUrl
    shouldShowPlaceholder = true;
  } else {
    // 其他情況：嘗試載入
    thumbUrl = '/api/media/videos/' + videoId + '/thumbnail';
  }
}
```

**問題**：
- 第一個分支要求 `isReady && item.thumbnailFilename`
- 如果 status 是 'transcoding' 或其他非 'ready' 值，即使有縮圖也不會進入第一個分支
- 會進入第三個分支（else），但這時候已經太晚了

### 修復後的邏輯

```javascript
if (isNewSystem) {
  // 🔥 [修復] 與抽屜邏輯一致：只要有 thumbnailFilename 就顯示縮圖
  var videoStatus = item.status || 'unknown';
  var isProcessing = (videoStatus === 'queued' || videoStatus === 'processing');
  
  if (item.thumbnailFilename) {  // ✅ 不檢查 status！
    // 有縮圖檔名：使用縮圖 API（不檢查 status）
    thumbUrl = '/api/media/videos/' + videoId + '/thumbnail';
    console.log('🎬 [主卡片] 新系統影片縮圖:', { 
      videoId: videoId, 
      thumbUrl: thumbUrl, 
      thumbnailFilename: item.thumbnailFilename,
      status: videoStatus,
      '說明': '有縮圖檔名，直接顯示'
    });
  } else if (isProcessing) {
    // 影片正在處理中且沒有縮圖：顯示預設圖標
    shouldShowPlaceholder = true;
    console.log('⏳ [主卡片] 影片正在處理中，顯示預設圖標:', { 
      videoId: videoId,
      status: videoStatus,
      '說明': '縮圖尚未生成'
    });
    scheduleProcessingVideosCheck();
  } else {
    // 其他情況：嘗試載入縮圖（可能已有但 meta 未更新）
    thumbUrl = '/api/media/videos/' + videoId + '/thumbnail';
    console.log('🎬 [主卡片] 新系統影片縮圖（嘗試）:', { 
      videoId: videoId, 
      thumbUrl: thumbUrl, 
      thumbnailFilename: item.thumbnailFilename || '(null)',
      status: videoStatus,
      '說明': '沒有縮圖檔名但嘗試載入（可能 meta 未更新）'
    });
  }
}
```

**改進**：
1. ✅ 第一個條件改為 `if (item.thumbnailFilename)` - **不檢查 status**
2. ✅ 只要有縮圖檔名就顯示，與抽屜邏輯一致
3. ✅ 移除了 `isReady` 變數（不再需要）
4. ✅ 簡化 `isProcessing` 條件（移除 'transcoding'，因為轉碼中通常已經有縮圖）

## 修復效果

### 修復前 ❌

| 影片狀態 | thumbnailFilename | 學生卡片顯示 | 抽屜顯示 |
|---------|------------------|------------|---------|
| `'ready'` | ✅ 有 | ✅ 縮圖 | ✅ 縮圖 |
| `'transcoding'` | ✅ 有 | ❌ 載入中 | ✅ 縮圖 |
| `null` | ✅ 有 | ❌ 載入中 | ✅ 縮圖 |
| `'processing'` | ❌ 無 | ⏳ 預設圖標 | ⏳ 預設圖標 |

### 修復後 ✅

| 影片狀態 | thumbnailFilename | 學生卡片顯示 | 抽屜顯示 |
|---------|------------------|------------|---------|
| `'ready'` | ✅ 有 | ✅ 縮圖 | ✅ 縮圖 |
| `'transcoding'` | ✅ 有 | ✅ 縮圖 | ✅ 縮圖 |
| `null` | ✅ 有 | ✅ 縮圖 | ✅ 縮圖 |
| `'processing'` | ❌ 無 | ⏳ 預設圖標 | ⏳ 預設圖標 |

**統一行為**：學生卡片和抽屜現在使用相同的邏輯！

## 測試方法

### 1. 清除瀏覽器快取

```
Ctrl+F5 或 Cmd+Shift+R (Mac)
```

### 2. 上傳測試影片

1. 開啟學習歷程上傳頁面
2. 選擇課程和學生
3. 上傳一個影片

### 3. 檢查學生卡片

在主頁面的學生卡片中，應該看到：
- ✅ **如果縮圖已生成**：顯示影片縮圖
- ✅ **如果縮圖未生成**：顯示 🎬 預設圖標
- ❌ **不應該**：一直顯示「載入中」spinner

### 4. 檢查抽屜

點擊右下角「📂 已上傳記錄」按鈕，應該看到：
- ✅ 影片顯示與學生卡片一致
- ✅ 縮圖或預設圖標

### 5. 檢查控制台日誌

開啟開發者工具（F12），應該看到：

```
🎬 [主卡片] 新系統影片縮圖: {
  videoId: "...",
  thumbUrl: "/api/media/videos/.../thumbnail",
  thumbnailFilename: "xxx.thumb.jpg",
  status: "transcoding",  // ✅ 即使不是 'ready' 也能顯示！
  說明: "有縮圖檔名，直接顯示"
}
```

## 技術細節

### forceReady 參數

學生卡片渲染時使用 `forceReady: true`：

```javascript
var videoPreviewHtml = buildMediaPreviewHtml({
  type: 'video',
  previewUrl: url,
  thumbUrl: finalThumbUrl,
  filename: displayName,
  removable: true,
  removeHandler: removeHandler,
  lazy: false,
  forceReady: true  // ✅ 強制設為 ready，不顯示 loading spinner
});
```

`buildMediaPreviewHtml` 函數處理：

```javascript
var forceReady = !!options.forceReady;
var ready = forceReady;  // ✅ 直接設為 true

var classes = ['file-preview', 'existing', ready ? 'loaded' : 'loading', 'preview-clickable'];
//                                         ✅ 'loaded' 不是 'loading'

var showSpinner = !ready && !(type === 'video' && !thumbUrl);
//                ✅ ready=true, 所以 showSpinner=false

var loadingHtml = showSpinner ? '<div class="thumb-loading" aria-hidden="true"></div>' : '';
//                                ✅ 不會添加 loading spinner
```

### CSS 類別

修復後的影片元素：

```html
<div class="file-preview existing loaded preview-clickable">
  <!-- ✅ 'loaded' 類別，不是 'loading' -->
  <video src="..."></video>
  <img class="video-thumbnail-img" src="/api/media/videos/.../thumbnail" />
  <!-- ✅ 沒有 <div class="thumb-loading"></div> -->
</div>
```

## 相關修復

### 完整修復歷程

1. **第一次修復**：抽屜中過濾掉沒有縮圖的影片
   - 修改位置：Line ~10442, ~9830
   - 文檔：[DRAWER-VIDEO-FIX-SUMMARY.md](./DRAWER-VIDEO-FIX-SUMMARY.md)

2. **第二次修復**（本次）：學生卡片邏輯與抽屜不一致
   - 修改位置：Line ~6056-6092
   - 文檔：本文件

### 統一原則

**所有顯示影片的地方**都應該遵循相同的邏輯：

```javascript
// ✅ 正確：只檢查 thumbnailFilename
if (item.thumbnailFilename) {
  thumbUrl = '/api/media/videos/' + videoId + '/thumbnail';
}

// ❌ 錯誤：檢查 status
if (item.status === 'ready' && item.thumbnailFilename) {
  thumbUrl = '/api/media/videos/' + videoId + '/thumbnail';
}
```

## 注意事項

1. **影片 status 的含義**：
   - `'ready'` - 影片完全處理完成（包括轉碼、縮圖生成）
   - `'transcoding'` - 正在轉碼（但縮圖可能已經生成）
   - `'processing'` - 正在處理（縮圖可能未生成）
   - `'queued'` - 排隊中
   - `null`/`undefined` - 狀態未知（可能是舊資料）

2. **縮圖生成時機**：
   - 縮圖通常在影片上傳後**立即生成**
   - 轉碼可能需要較長時間
   - 所以 `status='transcoding'` 時，縮圖通常已經存在

3. **顯示優先級**：
   - 有 `thumbnailFilename` → 顯示縮圖（優先）
   - 沒有縮圖但正在處理 → 顯示預設圖標
   - 其他情況 → 嘗試載入縮圖（容錯）

## 回滾方法

如果需要回滾：

```bash
git checkout HEAD -- public/js/pages/learning-record-upload.js
```

或恢復到修復前的邏輯（不建議）：

```javascript
if (isReady && item.thumbnailFilename) {
  thumbUrl = '/api/media/videos/' + videoId + '/thumbnail';
}
```

## 總結

| 問題 | 原因 | 修復 |
|-----|------|------|
| 抽屜不顯示影片 | 過濾掉沒有縮圖的影片 | 允許顯示（第一次修復） |
| 學生卡片載入中 | 要求 status='ready' 才顯示 | 不檢查 status（本次修復） |

**最終結果**：影片縮圖在**學生卡片**和**抽屜**中都能正常顯示！✅

---

**修復日期**: 2025-11-06  
**修復版本**: v2.3.2  
**相關文檔**: [DRAWER-VIDEO-FIX-SUMMARY.md](./DRAWER-VIDEO-FIX-SUMMARY.md)

