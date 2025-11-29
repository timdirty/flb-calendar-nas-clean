# 學生預覽消失問題 - 完整修復總結

## 問題描述
用戶報告：「觸發更新時 已上傳圖片只會出現一下 然後就不見了」

## 根本原因分析

### 1. 草稿恢復機制問題
**文件**：`public/js/pages/learning-record-upload.js`  
**函數**：`restoreDraftForStudent(index)`  
**問題**：
- File 對象無法序列化到 localStorage
- 草稿恢復時無論是否有有效檔案都調用 `updateFilePreviews`
- `updateFilePreviews` 會清除並重建 `.new-upload` 預覽，可能干擾已上傳的預覽

**修復** (第 4784-4797 行)：
```javascript
// 🔥 [完全禁用] 不要在這裡調用 updateFilePreviews
// 理由：
// 1. File 對象無法序列化到 localStorage，草稿恢復時都是無效的
// 2. 調用 updateFilePreviews 會清除已上傳的預覽（即使有保護機制）
// 3. 新選擇的檔案會在 handleFileSelect 中正確渲染
// 4. 已上傳的檔案會在 applyExistingRecordToCard 中正確渲染
```

### 2. 共用整合層問題
**文件**：`public/js/modules/learning-upload/shared-integration.js`  
**函數**：`handleStudentMediaSelect()`  
**問題**：
- `onComplete` 回調中調用 `options.updatePreview`
- 這會觸發 `updateFilePreviews`，清除已上傳的預覽

**修復** (第 65-76 行)：
```javascript
onComplete: function(allFiles) {
  console.log('✅ [SharedIntegration] 學生媒體處理完成:', allFiles.length, '個檔案');
  
  // 🔥 [修復] 不要調用 updatePreview，避免清除已上傳的預覽
  // 新檔案的預覽已經在 handleFileSelect 中使用共用預覽器渲染了
  // if (typeof options.updatePreview === 'function') {
  //   options.updatePreview(studentIndex, type);
  // }
  if (typeof options.checkUpload === 'function') {
    options.checkUpload(studentIndex);
  }
}
```

### 3. 所有 `updateFilePreviews` 調用點
**問題**：多處直接調用 `updateFilePreviews`，沒有使用共用預覽器的保護機制

**修復位置**：
1. **`handleFileSelect` 備援邏輯** (第 5701-5724 行)
   - 優先使用 `SharedMediaPreviewer.renderPreviews` with `clearExisting: false`
   - 只有在共用預覽器不可用時才回退到 `updateFilePreviews`

2. **快速套用影片模板** (第 5066-5087 行)
   - 同樣優先使用 `SharedMediaPreviewer.renderPreviews`

3. **快速套用上一個影片** (第 5798-5819 行)
   - 同樣優先使用 `SharedMediaPreviewer.renderPreviews`

4. **流式處理預覽更新** (第 5661-5681 行)
   - 同樣優先使用 `SharedMediaPreviewer.renderPreviews`

5. **`removeFile` 函數** (第 6303-6309 行)
   - 保持使用 `updateFilePreviews`（因為它已有保護機制）

### 4. `updateFilePreviews` 保護機制
**文件**：`public/js/pages/learning-record-upload.js`  
**函數**：`updateFilePreviews(studentIndex, type)`  
**已有的保護機制** (第 6015-6017 行, 6147-6155 行)：
```javascript
// 保存已上傳的預覽節點
var existingNodes = Array.prototype.slice.call(
  previewContainer.querySelectorAll('.file-preview.existing, .file-preview.loaded')
);

// ... 清除並重建 .new-upload 節點 ...

// 重新插入已上傳的預覽節點
if (existingNodes.length > 0) {
  existingNodes.forEach(function(node) {
    if (node.parentNode !== previewContainer) {
      previewContainer.insertBefore(node, previewContainer.firstChild);
    }
  });
}
```

**問題**：儘管有保護機制，但頻繁調用仍可能導致閃爍或其他問題

**解決方案**：減少 `updateFilePreviews` 的調用頻率，優先使用共用預覽器

## 完整的渲染流程

### 初始載入
```
renderStudentCards()
  └── 從快取或 API 獲取已上傳記錄
      └── applyExistingRecordToCard(index, student, uploaded)
          ├── 保存待上傳檔案 (pendingPhotoFiles, pendingVideoFiles)
          ├── 清空 base.photos, base.videos
          ├── 保存 .file-preview.new-upload 節點
          ├── 移除 .file-preview.existing, .file-preview.loaded 節點
          ├── 渲染已上傳檔案 (添加 .existing 類)
          ├── 重新插入 .file-preview.new-upload 節點
          └── 恢復待上傳檔案 (base.photos = pendingPhotoFiles)
      └── restoreDraftForStudent(index)
          └── [已禁用] 不再調用 updateFilePreviews
```

### 選擇新檔案
```
handleFileSelect(event, studentIndex, type)
  ├── SharedIntegration.handleStudentMediaSelect()
  │   ├── SharedMediaUploader.processFiles()
  │   │   └── 壓縮、驗證、加入 entry[type]
  │   └── onComplete (不調用 updatePreview)
  └── SharedMediaPreviewer.renderPreviews()
      ├── clearExisting: false （不清除現有預覽）
      └── 渲染新檔案 (添加 .new-upload 類)
```

### 切換學生
```
renderStudentCards()
  └── [重複初始載入流程]
      └── applyExistingRecordToCard 會：
          ✅ 保留新上傳的 .new-upload 節點
          ✅ 重新渲染已上傳的 .existing 節點
          ✅ 恢復待上傳檔案到 base.photos/videos
```

## 調試日誌增強

### 新增日誌位置

1. **`applyExistingRecordToCard` 開始** (第 5119 行)
```javascript
console.log('🔄 [applyExistingRecordToCard] 開始:', { 
  index: index, 
  student: student.name, 
  hasPhotos: uploaded.files && uploaded.files.photos ? uploaded.files.photos.length : 0 
});
```

2. **容器狀態檢查** (第 5123-5128 行)
```javascript
console.log('🔍 [applyExistingRecordToCard] 容器狀態:', {
  photosPreview: photosPreview ? '存在' : '不存在',
  videosPreview: videosPreview ? '存在' : '不存在',
  photosPreviewChildren: photosPreview ? photosPreview.children.length : 0,
  videosPreviewChildren: videosPreview ? videosPreview.children.length : 0
});
```

3. **保存新上傳節點** (第 5215-5221 行)
```javascript
console.log('🔍 [applyExistingRecordToCard] 保存新上傳節點:', {
  student: student.name,
  preserveNewPhotoNodes: preserveNewPhotoNodes.length,
  preserveNewVideoNodes: preserveNewVideoNodes.length,
  existingPhotos: existingPhotos.length,
  existingVideos: existingVideos.length
});
```

4. **移除舊節點** (第 5226 行)
```javascript
console.log('🗑️ [applyExistingRecordToCard] 移除舊的已上傳照片節點:', oldNodes.length);
```

5. **渲染完成** (第 5365-5373 行)
```javascript
console.log('✅ [applyExistingRecordToCard] 渲染完成:', {
  index: index,
  student: student.name,
  photosPreviewChildren: photosPreview ? photosPreview.children.length : 0,
  videosPreviewChildren: videosPreview ? videosPreview.children.length : 0,
  existingPhotosCount: photosPreview ? photosPreview.querySelectorAll('.file-preview.existing, .file-preview.loaded').length : 0,
  newUploadPhotosCount: photosPreview ? photosPreview.querySelectorAll('.file-preview.new-upload').length : 0
});
```

6. **恢復待上傳檔案** (第 5419-5425 行)
```javascript
console.log('✅ [applyExistingRecordToCard] 恢復待上傳檔案:', {
  student: student.name,
  pendingPhotoFiles: pendingPhotoFiles.length,
  pendingVideoFiles: pendingVideoFiles.length,
  basePhotos: base.photos.length,
  baseVideos: base.videos.length
});
```

7. **`restoreDraftForStudent` 狀態** (第 4744-4753 行)
```javascript
console.log('📝 [restoreDraftForStudent] 開始:', { index: index });
console.log('🔍 [restoreDraftForStudent] 草稿狀態:', { 
  hasDraft: !!draft,
  draftPhotos: draft && draft.photos ? draft.photos.length : 0,
  draftVideos: draft && draft.videos ? draft.videos.length : 0
});
```

8. **`updateFilePreviews` 調用追蹤** (第 6000-6013 行)
```javascript
console.log('🎨 [updateFilePreviews] 被調用:', { 
  studentIndex: studentIndex, 
  type: type, 
  stack: new Error().stack.split('\n')[2] 
});
console.log('🔍 [updateFilePreviews] 開始前狀態:', {
  containerChildren: previewContainer.children.length,
  existingCount: previewContainer.querySelectorAll('.file-preview.existing, .file-preview.loaded').length,
  newUploadCount: previewContainer.querySelectorAll('.file-preview.new-upload').length,
  filesCount: files.length
});
```

## 測試工具

### 1. 測試計劃文檔
**文件**：`TEST_STUDENT_PREVIEW.md`  
**內容**：完整的測試場景、驗證步驟、預期結果

### 2. 瀏覽器測試輔助工具
**文件**：`public/test-preview-helper.js`  
**使用方法**：
```javascript
// 在瀏覽器控制台中載入
<script src="/test-preview-helper.js"></script>

// 或直接複製貼上腳本內容

// 使用
PreviewTestHelper.checkStudent(0);     // 檢查學生 0
PreviewTestHelper.checkAll();          // 檢查所有學生
PreviewTestHelper.runFullTest(0);      // 運行完整測試
```

## 驗證步驟

### 快速驗證
```bash
# 1. 啟動開發伺服器
npm run dev

# 2. 打開測試頁面
# http://localhost:3002/learning-record-upload.html

# 3. 打開瀏覽器開發者工具 (F12)

# 4. 執行測試
# 在控制台執行：
PreviewTestHelper.runFullTest(0);
```

### 預期日誌輸出
```
✅ 初始載入：
  🔄 [applyExistingRecordToCard] 開始
  🔍 [applyExistingRecordToCard] 容器狀態
  🗑️ [applyExistingRecordToCard] 移除舊的已上傳照片節點
  ✅ [applyExistingRecordToCard] 渲染完成
  📝 [restoreDraftForStudent] 開始
  ⚠️ [restoreDraftForStudent] 沒有有效的草稿照片，跳過渲染

✅ 選擇新檔案：
  🎯 [handleFileSelect] 使用共用模組處理
  ✅ [SharedIntegration] 學生媒體處理完成
  🎨 [renderPreviews] 渲染預覽 (clearExisting: false)

✅ 切換學生：
  🔄 [applyExistingRecordToCard] 開始
  🔍 [applyExistingRecordToCard] 保存新上傳節點: preserveNewPhotoNodes: X
  ✅ [applyExistingRecordToCard] 渲染完成: existingPhotosCount: X, newUploadPhotosCount: Y
  ✅ [applyExistingRecordToCard] 恢復待上傳檔案

❌ 不應該出現（除非特殊情況）：
  🎨 [updateFilePreviews] 被調用 (頻繁出現表示有問題)
```

## 文件清單

### 修改的文件
1. `public/js/pages/learning-record-upload.js`
   - 禁用 `restoreDraftForStudent` 中的 `updateFilePreviews`
   - 所有 `updateFilePreviews` 調用點優先使用共用預覽器
   - 增強調試日誌

2. `public/js/modules/learning-upload/shared-integration.js`
   - 禁用 `onComplete` 中的 `updatePreview` 調用

### 新增的文件
1. `TEST_STUDENT_PREVIEW.md` - 完整測試計劃
2. `public/test-preview-helper.js` - 瀏覽器測試工具
3. `COMPLETE_FIX_SUMMARY.md` - 本文件

## 下一步

### 立即執行
```bash
# 1. 確保開發伺服器正在運行
npm run dev

# 2. 在瀏覽器中測試
# - 打開 http://localhost:3002/learning-record-upload.html
# - 載入測試工具 (複製 test-preview-helper.js 內容到控制台)
# - 執行：PreviewTestHelper.runFullTest(0)
# - 按照指示完成所有測試場景

# 3. 記錄結果
# - 截圖控制台日誌
# - 截圖 DOM 結構 (Elements 標籤)
# - 記錄任何異常行為
```

### 如果測試通過
```bash
# 部署到生產環境
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 如果測試失敗
1. 查看控制台日誌，找出問題所在
2. 使用 `PreviewTestHelper.checkStudent(index)` 檢查詳細狀態
3. 檢查 DOM 結構，確認節點類名和數量
4. 提供完整的日誌和狀態信息以進行進一步診斷

## 總結

這次修復的核心策略是：
1. **減少不必要的 `updateFilePreviews` 調用**
2. **優先使用共用預覽器的非破壞性渲染**（`clearExisting: false`）
3. **確保 `applyExistingRecordToCard` 正確保留和恢復所有預覽節點**
4. **增強調試日誌以便快速定位問題**

修復後的預期行為：
- ✅ 已上傳的預覽始終顯示
- ✅ 新上傳的預覽正確顯示並保留
- ✅ 切換學生後所有預覽正確恢復
- ✅ UI 更新不會影響預覽顯示

