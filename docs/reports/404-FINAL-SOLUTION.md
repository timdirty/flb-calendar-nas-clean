# 404 錯誤最終解決方案

## 當前狀態分析（2025-11-06）

### ✅ 已解決
- 縮略圖 `/thumbnail` 端點的 404 錯誤已完全消除
- 「同步中」佔位框正確清除
- `SmartPosterGenerator` 不再處理已移除的元素

### ❌ 剩餘問題
- Video `/download` 端點仍有大量 404 錯誤
- **根本原因**：伺服器返回的 `newMediaVideos` 資料包含已刪除視頻的記錄（meta 資料未同步清理）

---

## 問題根源

當資料夾被刪除後，實際視頻檔案已不存在，但：
1. `videos-meta.json` 中仍有這些視頻的記錄（id, filename, thumbnailFilename 等）
2. API `/api/learning-records/uploaded` 返回這些 meta 資料
3. 前端根據 meta 資料創建 video 元素，設置 `src="/api/media/videos/:id/download"`
4. 瀏覽器自動嘗試載入 video src，導致 404

---

## 最終解決方案：前端過濾無效視頻記錄

由於後端清理 meta 資料需要較大改動，暫時採用前端解決方案：**在渲染前檢查視頻狀態，過濾掉可能不存在的視頻**。

### 策略
1. 如果視頻沒有縮略圖（`thumbnailFilename` 為空），且狀態不是 `completed`，視為「可能不存在」
2. 對於「可能不存在」的視頻，使用 HEAD 請求預檢查其存在性
3. 只渲染確認存在的視頻

### 實作位置
- `applyExistingRecordToCard` - 學生卡片視頻渲染（行 6016-6084）
- `renderUploadedRecords` (課程總覽抽屜) - 行 9662-9691
- `renderDrawer` (學生抽屜) - 行 10251-10329

---

## 替代方案（推薦長期）

### 後端修復
在 `server.js` 的學習記錄 API 中，增加檔案存在性檢查：

```javascript
// 當讀取 videos-meta.json 時，同步檢查實際檔案是否存在
const videosMetaPath = path.join(recordDir, 'videos-meta.json');
if (fs.existsSync(videosMetaPath)) {
  const videosMeta = JSON.parse(fs.readFileSync(videosMetaPath, 'utf8'));
  
  // 過濾掉實際檔案已被刪除的視頻
  record.newMediaVideos = videosMeta.videos.filter(video => {
    const videoPath = path.join(recordDir, 'videos', video.filename);
    return fs.existsSync(videoPath);
  });
}
```

### 優點
1. 徹底解決問題（前端不會收到無效資料）
2. 減少前端邏輯複雜度
3. 資料一致性更好

### 缺點
1. 需要修改後端代碼
2. 每次請求都要檢查檔案系統（可能影響效能）

---

## 臨時緩解方案（最快實施）

在前端完全不渲染沒有縮略圖的視頻：

```javascript
// 在生成視頻 HTML 前過濾
existingVideos = existingVideos.filter(function(item) {
  var isNewSystem = (typeof item === 'object' && item.id);
  if (!isNewSystem) return true; // 舊系統視頻保留
  
  // 新系統視頻：只保留有縮略圖的
  if (!item.thumbnailFilename || item.thumbnailFilename.trim() === '') {
    console.log('⏭️ [過濾無效視頻] 跳過無縮略圖視頻:', item.id, item.filename);
    return false;
  }
  
  return true;
});
```

### 優點
- 立即生效，無需後端修改
- 簡單直接

### 缺點
- 可能會隱藏正在轉碼中的視頻（縮略圖尚未生成）
- 不是根本解決方案

---

## 建議實施順序

1. **立即**：實施臨時緩解方案（前端過濾無縮略圖視頻）
2. **短期**：後端增加檔案存在性檢查
3. **長期**：實作自動清理機制（當檔案被刪除時，同步清理 meta 資料）

---

## 測試驗證

實施後需確認：
- ✅ 控制台沒有任何 404 錯誤（thumbnail 和 download 都不應出現）
- ✅ 正常的視頻（有縮略圖）仍能正確顯示
- ✅ 正在轉碼的視頻（無縮略圖但 status=processing）能正確處理
- ✅ 上傳新視頻後能正常顯示

---

## 結論

當前最實際的解決方案是：**前端過濾無效視頻記錄**。這需要在三個渲染位置（學生卡片、課程總覽、抽屜）增加過濾邏輯，只渲染有有效縮略圖的視頻。

後續可以考慮後端修復，從根本上解決資料不一致的問題。

