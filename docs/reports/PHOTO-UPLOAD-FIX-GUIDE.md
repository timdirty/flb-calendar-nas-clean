# 照片上傳顯示問題修復指南

## 問題描述

學生上傳 3 張照片，但只顯示 1 張照片的預覽。

## 修復內容

### 1. 優化 `shared-media-previewer.js`

**問題根源**：
- 在流式處理時，`renderPreviews` 被多次調用
- 每次調用都會重新渲染所有檔案，導致預覽重複或丟失
- `clearExisting` 參數的行為不夠智能

**修復方案**：
1. **智能預覽檢測**：檢查容器中已存在的預覽數量
2. **避免重複渲染**：如果預覽已存在，跳過渲染
3. **增量渲染**：只渲染新增的檔案，不重複渲染已有的
4. **保護已上傳預覽**：即使清除預覽，也保留 `.existing` 和 `.loaded` 類別的節點

### 2. 新增診斷工具 `debug-photo-upload.js`

提供以下功能：
- 檢查學生的照片狀態（記憶體 + DOM）
- 啟用詳細日誌模式
- 監聽 `renderPreviews` 調用
- 檢測重複預覽和 Blob URL 洩漏

## 測試步驟

### 方法一：使用診斷工具（推薦）

1. **打開學習記錄上傳頁面**
   ```
   https://calendar.funlearnbar.synology.me/learning-record-upload.html
   ```

2. **在瀏覽器控制台中載入診斷工具**
   ```html
   <!-- 方法 A：在 HTML 中添加 -->
   <script src="/debug-photo-upload.js"></script>
   
   <!-- 方法 B：直接在控制台中複製貼上 debug-photo-upload.js 的內容 -->
   ```

3. **啟用監聽**
   ```javascript
   PhotoUploadDebugger.watchRenderPreviews()
   ```

4. **選擇 3 張照片**
   - 觀察控制台輸出，查看 `renderPreviews` 的調用次數和參數
   - 每次調用應該顯示：
     - 檔案數量
     - `clearExisting` 參數值
     - 調用堆疊

5. **檢查照片狀態**
   ```javascript
   PhotoUploadDebugger.checkPhotoState(0)  // 檢查第一個學生
   ```
   
   **預期結果**：
   - 記憶體中的照片數量：3
   - DOM 預覽容器總預覽數：3（如果有已上傳的，則更多）
   - 新上傳預覽：3

### 方法二：手動測試

1. **清除瀏覽器快取**
   ```javascript
   localStorage.clear()
   sessionStorage.clear()
   location.reload(true)
   ```

2. **選擇課程和學生**

3. **上傳 3 張照片**（每張約 1-5 MB）

4. **檢查預覽**
   - 應該看到 3 張照片的縮圖
   - 每張照片都應該有刪除按鈕（❌）
   - 每張照片都應該有載入進度

5. **檢查 DOM**
   ```javascript
   // 在控制台執行
   var container = document.getElementById('photos-preview-0')
   console.log('總預覽數:', container.children.length)
   console.log('新上傳:', container.querySelectorAll('.new-upload').length)
   console.log('已上傳:', container.querySelectorAll('.existing, .loaded').length)
   ```

### 方法三：測試已上傳照片 + 新照片

1. **選擇一個已有上傳記錄的學生**

2. **檢查初始狀態**
   ```javascript
   PhotoUploadDebugger.checkPhotoState(0)
   ```
   
   應該看到：
   - 已上傳預覽：X 個（已有的照片數量）
   - 新上傳預覽：0

3. **再上傳 3 張新照片**

4. **再次檢查狀態**
   ```javascript
   PhotoUploadDebugger.checkPhotoState(0)
   ```
   
   **預期結果**：
   - 已上傳預覽：X 個（保持不變）
   - 新上傳預覽：3 個（新增）
   - 總計：X + 3 個

## 常見問題排查

### 問題 A：仍然只顯示 1 張照片

**可能原因**：
1. 檔案處理失敗（壓縮、iCloud 下載等）
2. 記憶體不足
3. 網路問題

**排查步驟**：
```javascript
// 1. 檢查 studentFiles 陣列
console.log('照片陣列:', studentFiles[0].photos)
console.log('照片數量:', studentFiles[0].photos.length)

// 2. 檢查每張照片
studentFiles[0].photos.forEach((photo, idx) => {
  console.log(`照片 ${idx}:`, photo.name, photo.size / 1024 / 1024, 'MB')
})

// 3. 檢查 DOM
var container = document.getElementById('photos-preview-0')
console.log('DOM 預覽數:', container.children.length)
```

**如果 `studentFiles[0].photos.length` 只有 1**：
- 問題在檔案處理階段，不是預覽渲染問題
- 檢查控制台是否有錯誤訊息
- 嘗試使用較小的檔案（< 1 MB）

**如果 `studentFiles[0].photos.length` 是 3，但 DOM 只有 1 個預覽**：
- 問題在預覽渲染階段
- 執行 `PhotoUploadDebugger.watchRenderPreviews()` 再重新上傳
- 查看哪次 `renderPreviews` 調用清除了預覽

### 問題 B：預覽重複

**症狀**：同一張照片出現多次

**原因**：`renderPreviews` 被多次調用，且沒有正確檢測已有預覽

**解決方法**：
- 確認修復後的 `shared-media-previewer.js` 已部署
- 清除瀏覽器快取並重新載入

### 問題 C：已上傳的照片被清除

**症狀**：上傳新照片後，已有的照片預覽消失

**原因**：`clearExisting: true` 或 `updateFilePreviews` 被意外調用

**檢查**：
```javascript
// 監聽 renderPreviews
PhotoUploadDebugger.watchRenderPreviews()

// 查看是否有 clearExisting: true 的調用
```

## 部署步驟

### 開發環境測試

```bash
# 1. 重啟開發伺服器
npm run dev

# 2. 打開瀏覽器測試
# http://localhost:3002/learning-record-upload.html
```

### 生產環境部署

```bash
# 1. 備份現有檔案
cp public/js/modules/learning-upload/shared-media-previewer.js \
   public/js/modules/learning-upload/shared-media-previewer.js.backup-$(date +%Y%m%d-%H%M%S)

# 2. 重新構建 Docker 容器
docker-compose build --no-cache

# 3. 重啟服務
docker-compose up -d

# 4. 檢查日誌
docker-compose logs -f --tail=50
```

### 驗證部署

1. **檢查檔案更新時間**
   ```bash
   ls -lh public/js/modules/learning-upload/shared-media-previewer.js
   ```

2. **清除瀏覽器快取**
   - Chrome: Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)
   - 或使用無痕模式

3. **測試上傳**
   - 選擇 3 張照片
   - 確認 3 張都顯示

## 回滾方案

如果修復後仍有問題，可以回滾：

```bash
# 1. 停止服務
docker-compose down

# 2. 還原備份
cp public/js/modules/learning-upload/shared-media-previewer.js.backup-YYYYMMDD-HHMMSS \
   public/js/modules/learning-upload/shared-media-previewer.js

# 3. 重啟服務
docker-compose up -d
```

## 技術細節

### 修復前的行為

```javascript
// 流式處理循環
for (var i = 0; i < 3; i++) {
  entry.photos.push(processedFile)  // 第 1 次: [file1], 第 2 次: [file1, file2], 第 3 次: [file1, file2, file3]
  
  if (i === 2) {  // 最後一個
    renderPreviews({
      files: entry.photos,  // [file1, file2, file3]
      clearExisting: false
    })
    // ❌ 問題：會創建 3 個新預覽，但可能與之前的預覽衝突
  }
}
```

### 修復後的行為

```javascript
renderPreviews({
  files: [file1, file2, file3],
  clearExisting: false
})

// ✅ 修復：智能檢測
// 1. 檢查容器中已有的 .new-upload 預覽數量
// 2. 如果 existingCount === files.length，跳過渲染
// 3. 如果 existingCount < files.length，只渲染新增的部分
// 4. 範例：existingCount=0, files.length=3 → 渲染全部 3 個
//         existingCount=3, files.length=3 → 跳過（已存在）
```

## 日誌範例

### 正常流程（3 張照片）

```
🎨 [renderPreviews] 渲染預覽: 1 個檔案, clearExisting: false
💡 [renderPreviews] 保留模式，現有新上傳預覽: 0 個
✅ [renderPreviews] 預覽渲染完成: 1 個新元素, 總計: 1 個

🎨 [renderPreviews] 渲染預覽: 2 個檔案, clearExisting: false
💡 [renderPreviews] 保留模式，現有新上傳預覽: 1 個
📝 [renderPreviews] 只渲染新增的 1 個檔案
✅ [renderPreviews] 預覽渲染完成: 1 個新元素, 總計: 2 個

🎨 [renderPreviews] 渲染預覽: 3 個檔案, clearExisting: false
💡 [renderPreviews] 保留模式，現有新上傳預覽: 2 個
📝 [renderPreviews] 只渲染新增的 1 個檔案
✅ [renderPreviews] 預覽渲染完成: 1 個新元素, 總計: 3 個
```

### 異常流程（只有 1 張照片）

```
🎨 [renderPreviews] 渲染預覽: 1 個檔案, clearExisting: false
💡 [renderPreviews] 保留模式，現有新上傳預覽: 0 個
✅ [renderPreviews] 預覽渲染完成: 1 個新元素, 總計: 1 個

❌ 沒有後續的 renderPreviews 調用
→ 說明：只有 1 個檔案被處理成功
→ 檢查：studentFiles[0].photos.length 是否為 1
```

## 聯絡資訊

如果問題仍未解決，請提供以下資訊：

1. **控制台完整日誌**（特別是 `renderPreviews` 相關）
2. **`PhotoUploadDebugger.checkPhotoState(0)` 的輸出**
3. **檔案資訊**（數量、大小、格式）
4. **瀏覽器和裝置**（Chrome/Safari, 版本, iOS/Android）
5. **是否有已上傳的照片**（測試新學生 vs 已有記錄的學生）

---

**最後更新**: 2025-11-05  
**版本**: 1.0  
**相關文件**: 
- `public/js/modules/learning-upload/shared-media-previewer.js`
- `public/js/pages/learning-record-upload.js`
- `public/debug-photo-upload.js`

