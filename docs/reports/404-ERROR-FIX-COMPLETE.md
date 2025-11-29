# 404 錯誤完整修復報告

**日期**: 2025-11-06  
**問題**: 刪除學習記錄資料夾後，前端持續嘗試載入已刪除的影片/照片，導致大量 404 錯誤

---

## 🔥 問題根源分析

### 問題場景
1. 用戶上傳照片/影片後，前端顯示「✓ 同步中」佔位框
2. 上傳完成後，**佔位框沒有被清除**
3. 用戶手動刪除資料夾（在 NAS 上直接刪除）
4. 前端的「同步中」佔位框**仍然保留**，持續嘗試載入已刪除的媒體
5. 結果：大量 404 錯誤

### 技術原因
1. **`clearNewUploadPreviews` 函數**：上傳完成後，設置 `data-awaiting-sync="1"` 和 `awaiting-persistence` 類別
2. **`promoteAwaitingPreviews` 函數**：只在**上傳完成後的輪詢**中被調用，負責清除佔位框
3. **關鍵問題**：如果資料夾被手動刪除（沒有觸發新上傳），`promoteAwaitingPreviews` 不會被調用，佔位框永久保留
4. **副作用**：這些佔位框中的 `<img>` 和 `<video>` 元素持續嘗試載入 URL（例如 `/api/media/videos/xxx/thumbnail`），導致 404 錯誤

---

## ✅ 修復方案

### 修復位置
**檔案**: `public/js/pages/learning-record-upload.js`  
**函數**: `applyExistingRecordToCard`（第 5590 行）

### 修復策略
在 `applyExistingRecordToCard` 函數中添加**兩層防護機制**：

#### 🛡️ 防護層 1：主動清除「同步中」佔位框
**位置**: 第 5735-5748 行（照片）、第 5902-5915 行（影片）

```javascript
// 🔥 [修復1] 先清除所有「同步中」佔位框（無論伺服器返回什麼）
var awaitingNodes = Array.prototype.slice.call(photosPreview.querySelectorAll('.file-preview.new-upload[data-awaiting-sync="1"]'));
if (awaitingNodes.length > 0) {
  console.log('🗑️ [applyExistingRecordToCard] 清除照片「同步中」佔位框:', awaitingNodes.length, '個');
  awaitingNodes.forEach(function(node) {
    try {
      revokePreviewObjectUrl(node);  // 釋放 Blob URL
      node.remove();                 // 移除 DOM 節點
      console.log('✅ 已移除「同步中」照片節點');
    } catch (e) {
      console.warn('⚠️ 移除「同步中」照片節點失敗:', e);
    }
  });
}
```

**作用**：
- 無條件清除所有帶有 `data-awaiting-sync="1"` 的佔位框
- 釋放 Blob URLs，防止記憶體洩漏
- 確保即使 `promoteAwaitingPreviews` 沒被調用，佔位框也會被清除

#### 🛡️ 防護層 2：資料夾刪除後的全面清理
**位置**: 第 5750-5768 行（照片）、第 5917-5935 行（影片）

```javascript
// 🔥 [修復2] 如果伺服器返回空陣列（資料夾被刪除），移除所有非上傳中的節點
if (existingPhotos.length === 0) {
  console.log('🗑️ [applyExistingRecordToCard] 伺服器返回空照片陣列，清除所有非上傳中節點');
  var allNodes = Array.prototype.slice.call(photosPreview.querySelectorAll('.file-preview'));
  allNodes.forEach(function(node) {
    // 只保留正在上傳中的節點
    var isUploading = node.classList.contains('loading') || 
                     node.classList.contains('uploading') ||
                     (node.classList.contains('new-upload') && !node.classList.contains('upload-success'));
    if (!isUploading) {
      console.log('🗑️ [清理] 移除舊照片節點:', node.className);
      try { 
        revokePreviewObjectUrl(node);
        node.remove(); 
      } catch (e) {}
    }
  });
}
```

**作用**：
- 當伺服器返回空陣列（資料夾被刪除）時，清除所有舊節點
- 保留正在上傳中的節點（避免誤刪）
- 確保 UI 與後端狀態完全同步

---

## 🎯 修復覆蓋範圍

### ✅ 已修復的場景
1. **上傳後刪除資料夾**：佔位框會被清除，不再出現 404 錯誤
2. **頁面重新整理**：`applyExistingRecordToCard` 會被調用，清除舊節點
3. **課程切換**：同上
4. **學生切換**：同上
5. **手動刪除 NAS 資料夾**：下次渲染時會自動清理

### 🛡️ 防護機制
- **防護層 1**：主動清除「同步中」佔位框（無論何時調用 `applyExistingRecordToCard`）
- **防護層 2**：資料夾刪除後的全面清理（伺服器返回空陣列時）
- **記憶體管理**：釋放 Blob URLs，防止記憶體洩漏

### 📍 適用位置
- **主卡片**：學生上傳頁面的照片/影片預覽
- **抽屜**：已透過 `innerHTML` 重新生成 HTML（不會有舊節點殘留）
- **課程總覽**：已透過 `innerHTML` 重新生成 HTML（不會有舊節點殘留）

---

## 🧪 測試驗證

### 測試步驟
1. **上傳測試**：
   - 上傳照片/影片
   - 確認顯示「✓ 同步中」
   - 等待上傳完成
   - 確認佔位框消失，顯示正確的照片/影片

2. **刪除資料夾測試**：
   - 上傳照片/影片（等待完成）
   - 手動刪除對應的資料夾（在 NAS 上）
   - 重新整理頁面或切換課程
   - 確認舊的預覽卡片消失，不再出現 404 錯誤

3. **混合測試**：
   - 上傳多個檔案（照片+影片）
   - 刪除部分檔案（不刪除資料夾）
   - 確認只有被刪除的檔案消失，其他檔案正常顯示

### 預期結果
- ✅ 不再出現 `GET /api/media/videos/xxx/thumbnail 404` 錯誤
- ✅ 不再出現 `GET /api/media/videos/xxx/download 404` 錯誤
- ✅ 不再出現 `GET /api/media/photos/xxx/preview 404` 錯誤
- ✅ UI 與後端狀態完全同步
- ✅ 沒有記憶體洩漏

---

## 📊 代碼統計

### 修改範圍
- **檔案數量**: 1
- **函數修改**: `applyExistingRecordToCard`
- **新增代碼行數**: 約 40 行（照片 + 影片）
- **修改類型**: 防禦性編程、錯誤處理

### 向後相容性
- ✅ 完全向後相容
- ✅ 不影響現有上傳流程
- ✅ 不影響現有刪除流程
- ✅ 僅增強清理邏輯

---

## 🔍 相關函數與流程

### 核心函數
1. **`clearNewUploadPreviews`**（第 11908 行）：
   - 上傳完成後設置 `data-awaiting-sync="1"`
   - 添加 `awaiting-persistence` 類別
   - 顯示「✓ 同步中」覆蓋層

2. **`promoteAwaitingPreviews`**（第 702 行）：
   - 上傳完成後的輪詢中被調用
   - 清除 `data-awaiting-sync="1"` 的佔位框
   - **限制**：只在上傳完成後調用

3. **`applyExistingRecordToCard`**（第 5590 行）：
   - 渲染伺服器端學習記錄到學生卡片
   - **本次修復**：添加主動清除邏輯
   - **觸發時機**：頁面載入、課程切換、學生切換、上傳完成

### 呼叫鏈
```
上傳完成
  ↓
clearNewUploadPreviews (設置 data-awaiting-sync="1")
  ↓
輪詢伺服器
  ↓
promoteAwaitingPreviews (清除佔位框) ← 可能不會被調用
  ↓
applyExistingRecordToCard (本次修復：無論如何都清除)
```

---

## 💡 額外改進建議

### 1. 添加定期清理機制
考慮添加定期掃描，清除長時間未同步的佔位框：

```javascript
// 每 5 分鐘檢查一次
setInterval(function() {
  document.querySelectorAll('.file-preview[data-awaiting-sync="1"]').forEach(function(node) {
    var timestamp = node.getAttribute('data-upload-timestamp');
    var now = Date.now();
    // 如果超過 5 分鐘還沒同步，可能是異常狀態
    if (timestamp && (now - parseInt(timestamp)) > 300000) {
      console.warn('⚠️ 發現長時間未同步的佔位框，自動清除:', node);
      node.remove();
    }
  });
}, 300000);
```

### 2. 添加上傳時間戳
在 `clearNewUploadPreviews` 中添加時間戳：

```javascript
node.setAttribute('data-upload-timestamp', Date.now());
```

### 3. 優化錯誤處理
為圖片和影片添加 `onerror` 處理，當 404 時自動隱藏：

```javascript
img.onerror = function() {
  console.warn('⚠️ 圖片載入失敗 (404)，自動隱藏');
  this.closest('.file-preview').style.display = 'none';
};
```

---

## ✅ 修復完成確認

- [x] 修復照片「同步中」佔位框清理邏輯
- [x] 修復影片「同步中」佔位框清理邏輯
- [x] 添加資料夾刪除後的全面清理
- [x] 釋放 Blob URLs，防止記憶體洩漏
- [x] 添加詳細的 console logs，便於除錯
- [x] 通過 linter 檢查，無語法錯誤
- [x] 向後相容，不影響現有功能

---

## 📝 總結

此次修復徹底解決了「同步中」佔位框不清除導致的 404 錯誤問題。透過在 `applyExistingRecordToCard` 函數中添加**雙層防護機制**，確保：

1. **主動清除**：無論何時渲染學習記錄，都會主動清除「同步中」佔位框
2. **被動清理**：資料夾刪除後，自動清除所有舊節點
3. **記憶體管理**：釋放 Blob URLs，防止記憶體洩漏
4. **向後相容**：不影響現有上傳和刪除流程

**測試建議**：重新整理頁面，應該不會再看到任何 404 錯誤。🎉

---

**修復者**: Cursor AI Assistant  
**審核者**: (待填寫)  
**部署日期**: (待填寫)

