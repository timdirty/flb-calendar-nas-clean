# 學生預覽功能完整測試計劃

## 目標
驗證學生頁面的已上傳照片/影片預覽是否能正確顯示並保持可見

## 測試環境
- 本地開發：`npm run dev` (http://localhost:3002)
- 測試頁面：learning-record-upload.html

## 核心邏輯流程

### 1. 初始渲染流程
```
renderStudentCards()
  └── applyExistingRecordToCard(index, student, uploaded)
      ├── 保存 pending 檔案 (pendingPhotoFiles, pendingVideoFiles)
      ├── 清空 base.photos, base.videos
      ├── 保存 .file-preview.new-upload 節點 (preserveNewPhotoNodes)
      ├── 移除 .file-preview.existing, .file-preview.loaded 節點
      ├── 渲染已上傳檔案 (添加 .existing 類)
      ├── 重新插入 .file-preview.new-upload 節點
      └── 恢復 pending 檔案 (base.photos = pendingPhotoFiles)
```

### 2. 選擇新檔案流程
```
handleFileSelect(event, studentIndex, type)
  ├── SharedIntegration.handleStudentMediaSelect()
  │   ├── SharedMediaUploader.processFiles()
  │   └── 加入 entry[type] (但不調用 updatePreview)
  └── SharedMediaPreviewer.renderPreviews()
      └── 渲染新檔案 (添加 .new-upload 類, clearExisting: false)
```

### 3. 切換學生流程
```
renderStudentCards()
  └── applyExistingRecordToCard(index, student, uploaded)
      [重複步驟 1，保留 .new-upload 節點]
  └── restoreDraftForStudent(index)
      [已禁用 updateFilePreviews 調用]
```

## 測試場景

### 場景 A：打開學生頁面
**預期行為**：
1. ✅ `applyExistingRecordToCard` 被調用
2. ✅ 已上傳的照片/影片顯示（添加 `.existing` 類）
3. ✅ `restoreDraftForStudent` 被調用但不渲染（已禁用）
4. ✅ 沒有調用 `updateFilePreviews`（或只在必要時調用）

**驗證日誌**：
```javascript
// 應該看到：
🔄 [applyExistingRecordToCard] 開始
🔍 [applyExistingRecordToCard] 容器狀態
🗑️ [applyExistingRecordToCard] 移除舊的已上傳照片節點
✅ [applyExistingRecordToCard] 渲染完成
📝 [restoreDraftForStudent] 開始
⚠️ [restoreDraftForStudent] 沒有有效的草稿照片，跳過渲染

// 不應該看到：
🎨 [updateFilePreviews] 被調用 (除非有特殊情況)
```

### 場景 B：選擇新照片
**預期行為**：
1. ✅ `handleFileSelect` 被調用
2. ✅ `SharedIntegration.handleStudentMediaSelect` 處理檔案
3. ✅ `SharedMediaPreviewer.renderPreviews` 渲染新預覽（clearExisting: false）
4. ✅ **已上傳的預覽仍然存在**（.existing 節點未被清除）
5. ✅ 新上傳的預覽顯示（添加 .new-upload 類）

**驗證日誌**：
```javascript
// 應該看到：
🎯 [handleFileSelect] 使用共用模組處理
✅ [SharedIntegration] 學生媒體處理完成
🎨 [renderPreviews] 渲染預覽 (clearExisting: false)

// 不應該看到：
🎨 [updateFilePreviews] 被調用 (共用模組已處理)
```

### 場景 C：切換到其他學生再切回來
**預期行為**：
1. ✅ 切換到其他學生：`renderStudentCards` 被調用
2. ✅ 切回原學生：`applyExistingRecordToCard` 被調用
3. ✅ **已上傳的預覽顯示**（從 API 重新渲染）
4. ✅ **新上傳但未保存的預覽仍然存在**（從 preserveNewPhotoNodes 恢復）

**驗證日誌**：
```javascript
// 切回原學生時應該看到：
🔄 [applyExistingRecordToCard] 開始
🔍 [applyExistingRecordToCard] 保存新上傳節點: preserveNewPhotoNodes: X
🗑️ [applyExistingRecordToCard] 移除舊的已上傳照片節點
✅ [applyExistingRecordToCard] 渲染完成: existingPhotosCount: X, newUploadPhotosCount: Y
✅ [applyExistingRecordToCard] 恢復待上傳檔案: pendingPhotoFiles: Y
```

### 場景 D：點擊其他 UI 元素
**預期行為**：
1. ✅ 可能觸發 UI 更新（例如 `renderBottomTabs`）
2. ✅ **不應該**觸發 `applyExistingRecordToCard`（除非明確需要）
3. ✅ **不應該**觸發 `updateFilePreviews`（除非明確需要）
4. ✅ 預覽保持不變

**驗證日誌**：
```javascript
// 不應該看到：
🔄 [applyExistingRecordToCard] 開始 (除非明確需要)
🎨 [updateFilePreviews] 被調用 (除非明確需要)
```

## 關鍵檢查點

### DOM 檢查
打開瀏覽器開發者工具 Elements 標籤，檢查預覽容器：

```html
<div id="photos-preview-0">
  <!-- 已上傳的照片（由 applyExistingRecordToCard 渲染）-->
  <div class="file-preview existing loaded preview-clickable">...</div>
  <div class="file-preview existing loaded preview-clickable">...</div>
  
  <!-- 新上傳但未保存的照片（由 SharedMediaPreviewer 渲染）-->
  <div class="file-preview new-upload loading preview-clickable">...</div>
  <div class="file-preview new-upload loading preview-clickable">...</div>
</div>
```

### JavaScript 檢查
在控制台執行：

```javascript
// 檢查容器狀態
var container = document.getElementById('photos-preview-0');
console.log('容器子節點數:', container.children.length);
console.log('已上傳預覽:', container.querySelectorAll('.file-preview.existing, .file-preview.loaded').length);
console.log('新上傳預覽:', container.querySelectorAll('.file-preview.new-upload').length);

// 檢查 studentFiles
console.log('待上傳檔案:', studentFiles[0].photos.length);
console.log('已上傳計數:', studentFiles[0].existingCounts);
```

## 已修復的問題

### 1. restoreDraftForStudent 禁用 updateFilePreviews
**問題**：草稿恢復時調用 `updateFilePreviews` 會清除已上傳的預覽  
**修復**：完全禁用草稿恢復中的 `updateFilePreviews` 調用

### 2. SharedIntegration 禁用 onComplete 中的 updatePreview
**問題**：共用模組完成時調用 `updatePreview` 會清除已上傳的預覽  
**修復**：禁用 `onComplete` 中的 `updatePreview` 調用

### 3. 所有 updateFilePreviews 調用點使用共用預覽器
**問題**：直接調用 `updateFilePreviews` 可能清除已上傳的預覽  
**修復**：優先使用 `SharedMediaPreviewer.renderPreviews` 並設置 `clearExisting: false`

### 4. updateFilePreviews 保護機制
**問題**：如果必須調用 `updateFilePreviews`，需要保護已上傳的預覽  
**修復**：在函數開始時保存 `.existing, .loaded` 節點，結尾時重新插入

## 測試執行

### 步驟 1：準備環境
```bash
cd /path/to/flb-calendar-nas
npm run dev
```

### 步驟 2：打開測試頁面
瀏覽器訪問：http://localhost:3002/learning-record-upload.html

### 步驟 3：打開開發者工具
- F12 或右鍵 → 檢查
- Console 標籤（查看日誌）
- Elements 標籤（查看 DOM）

### 步驟 4：選擇測試課程
選擇一個有已上傳檔案的課程和學生

### 步驟 5：執行測試場景
按順序執行場景 A、B、C、D

### 步驟 6：記錄結果
- 截圖/複製控制台日誌
- 截圖 DOM 結構
- 記錄任何異常行為

## 預期結果

✅ **所有場景通過**：
- 已上傳的預覽始終顯示
- 新上傳的預覽正確顯示
- 切換學生後預覽正確恢復
- UI 更新不影響預覽顯示

❌ **如果失敗**：
- 查看控制台日誌，找出調用 `updateFilePreviews` 的堆棧
- 查看 DOM 結構，檢查節點類名和數量
- 檢查 `studentFiles` 狀態

## 調試命令

```javascript
// 啟用詳細日誌
window.DEBUG_PREVIEW = true;

// 檢查特定學生狀態
function checkStudentState(index) {
  var base = studentFiles[index];
  var photosContainer = document.getElementById('photos-preview-' + index);
  var videosContainer = document.getElementById('videos-preview-' + index);
  
  return {
    base: {
      photos: base ? base.photos.length : 0,
      videos: base ? base.videos.length : 0,
      existingCounts: base ? base.existingCounts : {}
    },
    dom: {
      photosChildren: photosContainer ? photosContainer.children.length : 0,
      videosChildren: videosContainer ? videosContainer.children.length : 0,
      photosExisting: photosContainer ? photosContainer.querySelectorAll('.existing, .loaded').length : 0,
      videosExisting: videosContainer ? videosContainer.querySelectorAll('.existing, .loaded').length : 0,
      photosNewUpload: photosContainer ? photosContainer.querySelectorAll('.new-upload').length : 0,
      videosNewUpload: videosContainer ? videosContainer.querySelectorAll('.new-upload').length : 0
    }
  };
}

// 使用
console.log(checkStudentState(0));
```

## 完成標準

- [ ] 場景 A 通過
- [ ] 場景 B 通過
- [ ] 場景 C 通過
- [ ] 場景 D 通過
- [ ] DOM 檢查正確
- [ ] JavaScript 檢查正確
- [ ] 無異常日誌
- [ ] 無 JavaScript 錯誤

