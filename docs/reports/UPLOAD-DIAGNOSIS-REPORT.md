# 📋 上傳功能診斷報告

**問題描述**: 選擇照片/影片後，只顯示預覽縮圖，但沒有自動觸發上傳

**日期**: 2025-11-07  
**狀態**: 🔍 診斷中

---

## 📊 完整上傳流程追蹤

### 1. 檔案選擇 (learning-record-upload.js)

```javascript
// 行 7413-7507
async function handleFileSelect(event, studentIndex, type) {
  var files = Array.prototype.slice.call(event.target.files);
  var entry = ensureStudentFileEntry(studentIndex, student);
  
  // ✅ 使用共用模組處理
  await window.SharedIntegration.handleStudentMediaSelect({
    files: files,
    studentIndex: studentIndex,
    type: type,
    entry: entry,
    checkUpload: function(idx) {
      checkUploadReady(idx, { silent: true });
    }
  });
  
  // ✅ 渲染預覽
  window.SharedMediaPreviewer.renderPreviews({ ... });
  
  // ✅ 檢查上傳條件
  checkUploadReady(studentIndex); // 👈 關鍵呼叫
}
```

### 2. 共用整合層 (shared-integration.js)

```javascript
// 行 38-88
async function handleStudentMediaSelect(options) {
  var entry = options.entry;
  var type = options.type; // 'photos' or 'videos'
  
  // ✅ 使用共用上傳器處理檔案
  var processedFiles = await Uploader.processFiles({
    files: files,
    type: type === 'photos' ? 'image' : 'video',
    
    onFileProcessed: function(file, index) {
      // ✅ 立即加入 entry
      entry[type].push(file); // 👈 檔案應該在這裡加入
    },
    
    onComplete: function(allFiles) {
      // ✅ 呼叫檢查上傳
      if (typeof options.checkUpload === 'function') {
        options.checkUpload(studentIndex); // 👈 應該觸發
      }
    }
  });
}
```

### 3. 共用上傳器 (shared-media-uploader.js)

```javascript
// 行 325-545
async function processFiles(options) {
  var validFiles = []; // 驗證後的檔案
  var processedFiles = []; // 處理後的檔案
  
  // 📋 驗證所有檔案
  files.forEach(function(file) {
    if (validateFileType(file, type, config) && validateFileSize(file, config)) {
      validFiles.push(file);
    }
  });
  
  // 🚀 流式處理檔案
  for (var i = 0; i < validFiles.length; i++) {
    var file = validFiles[i];
    var processedFile = file;
    
    // 壓縮照片（如果需要）
    if (compress && !isVideo) {
      processedFile = await compressImage(file, config);
    }
    
    processedFiles.push(processedFile);
    
    // ✅ 單檔處理完成回調
    if (typeof options.onFileProcessed === 'function') {
      options.onFileProcessed(processedFile, i); // 👈 應該觸發
    }
  }
  
  // ✅ 全部完成回調
  if (typeof options.onComplete === 'function') {
    options.onComplete(processedFiles); // 👈 應該觸發
  }
  
  return processedFiles;
}
```

### 4. 檢查上傳條件 (learning-record-upload.js)

```javascript
// 行 8546-8597
function checkUploadReady(studentIndex, opts) {
  var ready = isUploadReady(studentIndex);     // 👈 檢查是否可上傳
  var pending = hasPendingChanges(studentIndex); // 👈 檢查是否有變更
  
  if (ready && pending) {
    if (!skipAuto) {
      scheduleAutoUpload(studentIndex); // 👈 觸發自動上傳
    }
  } else {
    cancelAutoUpload(studentIndex);
  }
}

// 行 3663-3677
function hasPendingChanges(index) {
  var base = studentFiles[index] || {};
  if (base.locked) return false;
  
  // ✅ 關鍵檢查：如果有新照片或影片
  if ((base.photos && base.photos.length) || (base.videos && base.videos.length)) {
    return true; // 👈 應該返回 true
  }
  
  // ... 其他評語檢查
}

// 行 3679-3684
function isUploadReady(index) {
  var base = studentFiles[index] || {};
  if (base.locked) return false;
  return hasPendingChanges(index); // 👈 依賴 hasPendingChanges
}
```

### 5. 排程自動上傳 (learning-record-upload.js)

```javascript
// 行 3706-3734
function scheduleAutoUpload(index) {
  if (uploadingStudents[index]) return;
  if (studentFiles[index] && studentFiles[index].locked) return;
  
  cancelAutoUpload(index);
  
  // 📐 智慧延遲
  var base = studentFiles[index] || {};
  var hasNewPhotos = Array.isArray(base.photos) && base.photos.length > 0;
  var hasNewVideos = Array.isArray(base.videos) && base.videos.length > 0;
  var delay = (hasNewPhotos || hasNewVideos) ? 80 : 1600; // 👈 有新檔案：80ms
  
  autoUploadTimers[index] = setTimeout(function () {
    delete autoUploadTimers[index];
    
    // 🧩 防抖：檢查快照
    var snap = computeChangeSnapshot(index);
    if (lastSubmittedSnapshot[index] && lastSubmittedSnapshot[index] === snap) {
      return; // 👈 可能在這裡被跳過！
    }
    
    // ✅ 最終觸發上傳
    if (isUploadReady(index) && hasPendingChanges(index) && !uploadingStudents[index]) {
      try {
        uploadStudentRecord(index); // 👈 應該觸發上傳
      } catch (e) {
        console.error('自動上傳失敗', e);
      }
    }
  }, delay);
}
```

---

## 🔍 潛在問題點

### ⚠️ 問題 1: entry 參考傳遞

**位置**: `shared-integration.js` 第 60 行

```javascript
onFileProcessed: function(file, index) {
  entry[type].push(file); // 👈 這裡的 entry 是否正確指向 studentFiles[studentIndex]？
}
```

**可能原因**:
- `entry` 是 `ensureStudentFileEntry(studentIndex, student)` 返回的物件
- 如果這個物件不是 `studentFiles[studentIndex]` 的引用，檔案就不會加入正確的位置

**檢查方式**:
```javascript
// 在 shared-integration.js 第 60 行加入日誌
console.log('🔍 [DEBUG] entry === studentFiles[' + studentIndex + ']?', 
            entry === window.studentFiles[studentIndex]);
console.log('🔍 [DEBUG] entry[type]:', entry[type]);
console.log('🔍 [DEBUG] studentFiles[' + studentIndex + '][' + type + ']:', 
            window.studentFiles[studentIndex][type]);
```

---

### ⚠️ 問題 2: 快照防抖機制

**位置**: `learning-record-upload.js` 第 3725 行

```javascript
var snap = computeChangeSnapshot(index);
if (lastSubmittedSnapshot[index] && lastSubmittedSnapshot[index] === snap) {
  return; // 👈 如果快照相同，跳過上傳
}
```

**可能原因**:
- 如果 `lastSubmittedSnapshot[index]` 已經存在相同的快照，就不會上傳
- 但實際上檔案可能是新的

**檢查方式**:
```javascript
// 在 scheduleAutoUpload 函數中加入日誌
console.log('🔍 [DEBUG] 快照檢查:', {
  index: index,
  currentSnap: snap,
  lastSnap: lastSubmittedSnapshot[index],
  isSame: lastSubmittedSnapshot[index] === snap
});
```

---

### ⚠️ 問題 3: uploadingStudents 狀態

**位置**: `learning-record-upload.js` 第 3730 行

```javascript
if (isUploadReady(index) && hasPendingChanges(index) && !uploadingStudents[index]) {
  uploadStudentRecord(index);
}
```

**可能原因**:
- 如果 `uploadingStudents[index]` 是 `true`，就不會觸發上傳
- 可能上一次上傳沒有正確清理狀態

**檢查方式**:
```javascript
// 在 scheduleAutoUpload 函數中加入日誌
console.log('🔍 [DEBUG] 上傳條件檢查:', {
  index: index,
  isReady: isUploadReady(index),
  hasPending: hasPendingChanges(index),
  isUploading: uploadingStudents[index],
  willUpload: isUploadReady(index) && hasPendingChanges(index) && !uploadingStudents[index]
});
```

---

## 🔧 立即修復方案

### 修復 1: 確保 entry 正確引用

**檔案**: `public/js/pages/learning-record-upload.js`

```javascript
// 在 handleFileSelect 函數中（第 7446 行之前）
async function handleFileSelect(event, studentIndex, type) {
  // ... 現有代碼 ...
  
  var entry = ensureStudentFileEntry(studentIndex, student || {});
  
  // 🔥 新增：確保 entry 是 studentFiles[studentIndex] 的引用
  console.log('🔍 [DEBUG handleFileSelect] entry 檢查:', {
    studentIndex: studentIndex,
    type: type,
    entryEqualsStudentFiles: entry === studentFiles[studentIndex],
    entryPhotosLength: entry.photos.length,
    entryVideosLength: entry.videos.length
  });
  
  // 🚀 使用共用模組處理
  if (window.SharedIntegration && typeof window.SharedIntegration.handleStudentMediaSelect === 'function') {
    try {
      console.log('🎯 [handleFileSelect] 使用共用模組處理');
      
      // 🔥 修復：直接傳遞 studentFiles[studentIndex] 而不是 entry
      await window.SharedIntegration.handleStudentMediaSelect({
        files: files,
        studentIndex: studentIndex,
        type: type,
        entry: studentFiles[studentIndex], // 👈 直接使用 studentFiles
        // ... 其他參數
      });
      
      // ... 後續代碼
    }
  }
}
```

---

### 修復 2: 在 shared-integration.js 加入除錯日誌

**檔案**: `public/js/modules/learning-upload/shared-integration.js`

```javascript
// 在 handleStudentMediaSelect 函數中（第 48-76 行）
async function handleStudentMediaSelect(options) {
  try {
    var files = options.files;
    var studentIndex = options.studentIndex;
    var type = options.type;
    var entry = options.entry;
    
    console.log('🎯 [SharedIntegration] 處理學生媒體:', {
      studentIndex: studentIndex,
      type: type,
      filesCount: files.length,
      entryPhotosLength: entry.photos.length,
      entryVideosLength: entry.videos.length
    });
    
    var processedFiles = await Uploader.processFiles({
      files: files,
      type: type === 'photos' ? 'image' : 'video',
      compress: type === 'photos',
      
      onFileProcessed: function(file, index) {
        // 立即加入 entry
        console.log('📦 [SharedIntegration] 檔案處理完成:', {
          fileName: file.name,
          fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
          index: index,
          entryLengthBefore: entry[type].length
        });
        
        entry[type].push(file);
        
        console.log('✅ [SharedIntegration] 檔案已加入 entry:', {
          entryLengthAfter: entry[type].length
        });
      },
      
      onComplete: function(allFiles) {
        console.log('✅ [SharedIntegration] 學生媒體處理完成:', {
          allFilesLength: allFiles.length,
          entryPhotosLength: entry.photos.length,
          entryVideosLength: entry.videos.length
        });
        
        if (typeof options.checkUpload === 'function') {
          console.log('🚀 [SharedIntegration] 準備呼叫 checkUpload');
          options.checkUpload(studentIndex);
        } else {
          console.warn('⚠️ [SharedIntegration] checkUpload 回調不存在');
        }
      }
    });
    
    return processedFiles;
  } catch (error) {
    console.error('❌ [SharedIntegration] handleStudentMediaSelect 失敗:', error);
    throw error;
  }
}
```

---

### 修復 3: 在 checkUploadReady 加入除錯日誌

**檔案**: `public/js/pages/learning-record-upload.js`

```javascript
// 在 checkUploadReady 函數中（第 8546 行）
function checkUploadReady(studentIndex, opts) {
  var ready = isUploadReady(studentIndex);
  var pending = hasPendingChanges(studentIndex);
  var btn = document.getElementById('upload-btn-' + studentIndex);
  var base = studentFiles[studentIndex] || {};
  
  // 🔥 新增除錯日誌
  console.log('🔍 [checkUploadReady] 檢查上傳條件:', {
    studentIndex: studentIndex,
    ready: ready,
    pending: pending,
    locked: base.locked,
    photosLength: base.photos ? base.photos.length : 0,
    videosLength: base.videos ? base.videos.length : 0,
    skipAuto: !!(opts && opts.skipAuto),
    willSchedule: ready && pending && !(opts && opts.skipAuto)
  });
  
  // ... 現有代碼 ...
  
  var skipAuto = !!(opts && opts.skipAuto);
  if (ready && pending) {
    if (!skipAuto) {
      console.log('🚀 [checkUploadReady] 準備排程自動上傳');
      scheduleAutoUpload(studentIndex);
    } else {
      console.log('⏭️ [checkUploadReady] skipAuto=true，跳過排程');
    }
  } else {
    console.log('❌ [checkUploadReady] 條件不符，取消自動上傳');
    cancelAutoUpload(studentIndex);
  }
  
  // ... 後續代碼
}
```

---

### 修復 4: 在 scheduleAutoUpload 加入除錯日誌

**檔案**: `public/js/pages/learning-record-upload.js`

```javascript
// 在 scheduleAutoUpload 函數中（第 3706 行）
function scheduleAutoUpload(index) {
  console.log('⏰ [scheduleAutoUpload] 開始:', {
    index: index,
    isUploading: uploadingStudents[index],
    isLocked: studentFiles[index] && studentFiles[index].locked
  });
  
  if (uploadingStudents[index]) {
    console.log('❌ [scheduleAutoUpload] 學生正在上傳中，跳過');
    return;
  }
  if ((studentFiles[index] && studentFiles[index].locked)) {
    console.log('❌ [scheduleAutoUpload] 學生已鎖定，跳過');
    return;
  }
  
  cancelAutoUpload(index);
  
  var base = studentFiles[index] || {};
  var hasNewPhotos = Array.isArray(base.photos) && base.photos.length > 0;
  var hasNewVideos = Array.isArray(base.videos) && base.videos.length > 0;
  var delay = (hasNewPhotos || hasNewVideos) ? 80 : 1600;
  
  console.log('⏱️ [scheduleAutoUpload] 設定延遲:', {
    delay: delay + 'ms',
    hasNewPhotos: hasNewPhotos,
    hasNewVideos: hasNewVideos
  });
  
  autoUploadTimers[index] = setTimeout(function () {
    delete autoUploadTimers[index];
    
    console.log('🎬 [scheduleAutoUpload] 延遲結束，準備上傳');
    
    // 防抖檢查
    try {
      var snap = computeChangeSnapshot(index);
      var lastSnap = lastSubmittedSnapshot[index];
      
      console.log('🔍 [scheduleAutoUpload] 快照檢查:', {
        currentSnap: snap,
        lastSnap: lastSnap,
        isSame: lastSnap === snap
      });
      
      if (lastSnap && lastSnap === snap) {
        console.log('⏭️ [scheduleAutoUpload] 快照相同，跳過上傳');
        return;
      }
    } catch (e) {
      console.error('❌ [scheduleAutoUpload] 快照檢查失敗:', e);
    }
    
    // 最終上傳條件檢查
    var finalReady = isUploadReady(index);
    var finalPending = hasPendingChanges(index);
    var finalUploading = uploadingStudents[index];
    
    console.log('🔍 [scheduleAutoUpload] 最終檢查:', {
      isReady: finalReady,
      hasPending: finalPending,
      isUploading: finalUploading,
      willUpload: finalReady && finalPending && !finalUploading
    });
    
    if (finalReady && finalPending && !finalUploading) {
      try {
        console.log('🚀 [scheduleAutoUpload] 觸發 uploadStudentRecord');
        uploadStudentRecord(index);
      } catch (e) {
        console.error('❌ [scheduleAutoUpload] 上傳失敗:', e);
      }
    } else {
      console.log('❌ [scheduleAutoUpload] 條件不符，取消上傳');
    }
  }, delay);
}
```

---

## 🧪 測試步驟

### 步驟 1: 套用除錯日誌

1. 複製上述修復代碼到對應檔案
2. 重新載入頁面（清除快取）

### 步驟 2: 選擇單張照片

1. 選擇一張照片（約 1-5 MB）
2. 觀察瀏覽器 Console 日誌
3. 尋找以下關鍵日誌：

```
✅ 預期看到的日誌序列：
🔍 [DEBUG handleFileSelect] entry 檢查
🎯 [handleFileSelect] 使用共用模組處理
🎯 [SharedIntegration] 處理學生媒體
📦 [SharedIntegration] 檔案處理完成
✅ [SharedIntegration] 檔案已加入 entry
✅ [SharedIntegration] 學生媒體處理完成
🚀 [SharedIntegration] 準備呼叫 checkUpload
🔍 [checkUploadReady] 檢查上傳條件
🚀 [checkUploadReady] 準備排程自動上傳
⏰ [scheduleAutoUpload] 開始
⏱️ [scheduleAutoUpload] 設定延遲: 80ms
🎬 [scheduleAutoUpload] 延遲結束，準備上傳
🔍 [scheduleAutoUpload] 快照檢查
🔍 [scheduleAutoUpload] 最終檢查
🚀 [scheduleAutoUpload] 觸發 uploadStudentRecord
```

### 步驟 3: 分析日誌

根據日誌輸出，找出中斷的環節：

- 如果在「檔案已加入 entry」後沒有後續日誌 → **問題在 onComplete 回調**
- 如果在「checkUploadReady」顯示 `ready=false` 或 `pending=false` → **問題在條件檢查**
- 如果在「快照檢查」顯示 `isSame=true` → **問題在防抖機制**
- 如果在「最終檢查」顯示 `willUpload=false` → **問題在上傳條件**

---

## 📝 回報格式

請複製以下格式，並貼上完整的 Console 日誌：

```
【測試環境】
- 瀏覽器：Chrome / Safari / Firefox（版本：___）
- 裝置：iPhone / Android / 電腦
- 檔案類型：照片 / 影片
- 檔案大小：___ MB

【問題描述】
- 選擇後是否顯示預覽：是 / 否
- 是否進入上傳狀態：是 / 否
- 重新整理後是否有上傳：是 / 否

【Console 日誌】
（完整複製貼上）
```

---

## 🎯 預期結果

修復後的正常流程：

1. ✅ 選擇檔案
2. ✅ 顯示預覽縮圖（載入中狀態）
3. ✅ 80ms 後自動觸發上傳
4. ✅ 預覽顯示上傳進度（5% → 100%）
5. ✅ 上傳完成後顯示成功圖標（✓）
6. ✅ 重新整理後檔案已存在

---

**建立時間**: 2025-11-07  
**最後更新**: 2025-11-07  
**狀態**: 🔧 等待測試反饋


