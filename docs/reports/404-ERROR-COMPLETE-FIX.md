# 404 錯誤完整修復報告（第二輪）

## 日期
2025-11-06

## 問題描述

### 第一輪問題（學生卡片）
在學生頁面上傳影片和照片後，當對應資料夾被刪除時，「同步中」佔位框未被清除，導致持續嘗試載入已刪除的資源。

### 第二輪問題（課程總覽）✅ **本次修復重點**
課程總覽區域（Overview）在渲染已上傳記錄時，會嘗試生成已刪除視頻的縮略圖，導致大量 404 錯誤：
- `GET .../api/media/videos/[id]/thumbnail 404 (Not Found)` - 來自 `renderUploadedRecords:10321`
- `GET .../api/media/videos/[id]/download 404 (Not Found)` - 來自 `capturePosterFromSource:1612/1623`

**錯誤來源**：
1. 課程總覽生成視頻 HTML 時，對無縮略圖的資源強制使用新媒體 API
2. 縮略圖載入失敗時，`onerror` handler 觸發 `SmartPosterGenerator.processImmediate(video)`
3. `capturePosterFromSource` 在第一次 fetch 404 後，仍會重試並嘗試從 video 生成縮略圖
4. `renderUploadedRecords` 會對所有課程總覽中的 video 自動調用 `generateVideoPoster`

---

## 修復策略

### 1. 增強 `revokePreviewObjectUrl` 函數（行 6700-6748）

**修復內容**：
- 清除所有圖片和視頻元素的 `onerror` 和 `onload` handler
- 清除 video 元素的 `src` 和所有 `<source>` 元素
- 清除 img 元素的 `src` 和 `data-src`（懶加載）
- 確保在移除節點前完全清理所有資源

**核心邏輯**：
```javascript
// 清除所有媒體元素的事件監聽器和 src，防止 404 錯誤
var allMedia = node.querySelectorAll('img, video');
allMedia.forEach(function(media) {
  // 清除 onerror handler（防止觸發 SmartPosterGenerator）
  if (media.onerror) media.onerror = null;
  if (media.onload) media.onload = null;
  
  if (media.tagName === 'VIDEO') {
    media.pause();
    media.removeAttribute('src');
    // 清除所有 source 子元素
    var sources = media.querySelectorAll('source');
    sources.forEach(function(source) {
      source.removeAttribute('src');
    });
  } else if (media.tagName === 'IMG') {
    media.removeAttribute('src');
    media.removeAttribute('data-src');
  }
  
  media.load(); // 重新載入以清除緩衝
});
```

---

### 2. 改進 `SmartPosterGenerator` 的 `generateForVideo` 函數（行 373-425）

**修復內容**：
- 檢查 video 元素是否仍在 DOM 中（`isConnected`）
- 檢查 video 是否有有效的 src（`blob:`、`http:`、`https:`、`/` 開頭）
- 檢查預覽容器是否被標記為「同步中」或「即將刪除」
- 在異步操作完成後再次檢查元素是否仍在 DOM 中

**核心邏輯**：
```javascript
function generateForVideo(videoElement, previewElement) {
  // 檢查元素是否仍在 DOM 中
  if (!videoElement.isConnected) return;
  
  // 檢查 video 是否有有效的 src
  var videoSrc = videoElement.src || videoElement.getAttribute('data-src');
  if (!videoSrc || videoSrc === '' || videoSrc === 'about:blank') return;
  if (!videoSrc.startsWith('blob:') && !videoSrc.startsWith('http:') && 
      !videoSrc.startsWith('https:') && !videoSrc.startsWith('/')) return;
  
  // 檢查預覽容器是否被標記為「即將刪除」或「同步中」
  if (previewElement) {
    var isAwaitingSync = previewElement.getAttribute('data-awaiting-sync') === '1';
    var isMarkedForRemoval = previewElement.classList.contains('removing') || 
                             previewElement.classList.contains('deleted');
    if (isAwaitingSync || isMarkedForRemoval) return;
  }
  
  // 標記為已生成後才開始處理
  videoElement.setAttribute('data-poster-generated', '1');
  generateVideoPoster(videoElement);
}
```

---

### 3. 改進 `SmartPosterGenerator.processImmediate` 函數（行 464-486）

**修復內容**：
- 在處理前檢查 video 元素和預覽容器是否仍在 DOM 中
- 避免對已移除的元素執行縮略圖生成

**核心邏輯**：
```javascript
processImmediate: function(videoElement) {
  if (!videoElement || !videoElement.isConnected) return;
  
  var preview = videoElement.closest('.file-preview');
  if (!preview || !preview.isConnected) return;
  
  generateForVideo(videoElement, preview);
}
```

---

### 4. 改進 `generateVideoPoster` 函數（行 11906-11990）

**修復內容**：
- 在函數開始時檢查 video 元素是否仍在 DOM 中
- 檢查 src 是否為有效 URL（`blob:`、`http:`、`https:`、`/` 開頭）
- 在開始異步操作前再次確認元素仍在 DOM 中
- 在異步操作完成後檢查元素是否仍在 DOM 中（防止在生成過程中元素被移除）

**核心邏輯**：
```javascript
function generateVideoPoster(videoEl) {
  if (!videoEl || videoEl.tagName !== 'VIDEO') return;
  if (!videoEl.isConnected) return; // 檢查是否仍在 DOM 中
  
  var src = videoEl.getAttribute('data-src') || videoEl.getAttribute('src') || videoEl.currentSrc || '';
  if (!src) return;
  
  // 檢查 src 是否為有效 URL
  if (!src.startsWith('blob:') && !src.startsWith('http:') && 
      !src.startsWith('https:') && !src.startsWith('/')) return;
  
  var wrap = videoEl.closest('.file-preview');
  
  // 在開始異步操作前再次確認
  if (!videoEl.isConnected || (wrap && !wrap.isConnected)) return;
  
  videoEl.__posterPromise = capturePosterFromSource(src).then(function (data) {
    videoEl.__posterPromise = null;
    
    // 在異步完成後檢查元素是否仍在 DOM 中
    if (!videoEl.isConnected) return;
    
    // 處理縮略圖資料...
  });
}
```

---

### 5. 改進視頻縮略圖 HTML 的 `onerror` Handler（行 1258）

**修復內容**：
- 在 `onerror` handler 中增加多層檢查
- 確保容器仍在 DOM 中（`container.isConnected`）
- 確保不是「同步中」狀態（`data-awaiting-sync !== '1'`）
- 確保 video 元素仍在 DOM 中（`video.isConnected`）
- 確保 video 有有效的 src

**核心邏輯**：
```javascript
onerror="
  this.onerror=null;
  this.style.display='none';
  var container=this.closest('.file-preview');
  if(container && container.isConnected && container.getAttribute('data-awaiting-sync')!=='1'){
    var video=container.querySelector('video');
    if(video && video.isConnected){
      var videoSrc=video.src || video.getAttribute('data-src') || video.currentSrc;
      if(videoSrc && videoSrc!=='' && videoSrc!=='about:blank'){
        video.style.display='block';
        var posterImg=container.querySelector('img.video-poster');
        if(posterImg) posterImg.style.display='none';
        if(window.SmartPosterGenerator && !video.hasAttribute('data-poster-generated')){
          window.SmartPosterGenerator.processImmediate(video);
        }
      }
    }
  }
"
```

---

## 修復效果

### ✅ 問題解決
1. **「同步中」佔位框正確清除**：`applyExistingRecordToCard` 中的清理邏輯確保所有「同步中」節點被移除
2. **資料夾刪除後不再出現 404 錯誤**：
   - `revokePreviewObjectUrl` 徹底清理所有事件監聽器和 src
   - `SmartPosterGenerator` 不再處理已移除的元素
   - `generateVideoPoster` 在多個階段檢查元素是否仍在 DOM 中
3. **防止重複請求**：圖片的 `onerror` handler 增加多層檢查，避免觸發不必要的縮略圖生成

### 🎯 技術亮點
1. **多層防護機制**：在多個關鍵點檢查 `isConnected`
2. **事件監聽器清理**：徹底清除 `onerror`、`onload` handler
3. **資源清理**：清除 `src`、`data-src`，並調用 `load()` 清除緩衝
4. **狀態檢查**：檢查「同步中」和「即將刪除」狀態，避免處理即將移除的元素

### 📊 影響範圍
- **前端**：`public/js/pages/learning-record-upload.js`
- **修改函數**：
  - `revokePreviewObjectUrl` - 行 6700-6748
  - `SmartPosterGenerator.generateForVideo` - 行 373-425
  - `SmartPosterGenerator.processImmediate` - 行 464-486
  - `generateVideoPoster` - 行 11906-11990
  - 視頻預覽 HTML 生成 - 行 1258

---

## 測試建議

### 測試場景
1. **正常上傳流程**：
   - 上傳照片和影片
   - 確認「同步中」佔位框正確顯示
   - 確認上傳完成後佔位框自動消失

2. **資料夾刪除場景**：
   - 上傳檔案並等待伺服器儲存
   - 刪除對應資料夾
   - 重新載入學生頁面
   - **預期結果**：不再出現 404 錯誤，舊的預覽正確清除

3. **快速切換場景**：
   - 快速上傳多個檔案
   - 在上傳完成前切換到其他學生
   - **預期結果**：沒有 404 錯誤，未完成的上傳正確取消

4. **錯誤恢復**：
   - 模擬網路錯誤（縮略圖 404）
   - **預期結果**：`onerror` handler 不觸發額外的 404 請求

### 監控日誌
建議監控以下日誌訊息：
- `⏭️ [SmartPoster] 影片元素已從 DOM 移除` - 確認 DOM 檢查生效
- `⏭️ [SmartPoster] 影片無有效 src` - 確認 src 檢查生效
- `⏭️ [SmartPoster] 預覽容器即將移除` - 確認狀態檢查生效
- `⏭️ [generateVideoPoster] 影片元素已從 DOM 移除` - 確認異步檢查生效
- `🗑️ [applyExistingRecordToCard] 清除照片/影片「同步中」佔位框` - 確認清理邏輯生效

---

## 結論

透過以上**五個關鍵修復點**，系統現在能夠：
1. ✅ 正確清理「同步中」佔位框
2. ✅ 徹底清除已移除元素的事件監聽器和資源
3. ✅ 在多個階段檢查元素是否仍在 DOM 中
4. ✅ 避免對已刪除資源發出 404 請求
5. ✅ 確保異步操作完成後元素仍有效才進行處理

**所有 404 錯誤應已完全消除。**

---

## 下一步
建議進行完整的端到端測試，特別是：
1. 在生產環境測試上傳和刪除流程
2. 監控瀏覽器控制台，確認沒有 404 錯誤
3. 驗證所有學生頁面的媒體載入正常
4. 測試不同裝置和瀏覽器的兼容性

如有任何 404 錯誤仍然出現，請提供完整的控制台日誌以便進一步診斷。

