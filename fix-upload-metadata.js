/**
 * 🔥 學習歷程上傳路徑修復方案
 * 
 * 問題診斷：
 * - 前端在上傳媒體檔案時，使用了截斷的課程名稱（如 "SPIKE 五 1610"）
 * - 儲存 record-meta.json 時，使用了完整的課程名稱（如 "SPIKE 五 16:10-17:40 松山 第7週"）
 * - 這導致檔案被存儲到不同的路徑
 * 
 * 修復方案：
 * 1. 在 ChunkedUploader 建立 metadata 時，確保使用完整課程名稱
 * 2. 在所有上傳點統一使用 currentCourse.title（完整課程標題）
 * 3. 確保前後端 courseName 處理一致
 */

// ==================================================
// 第一步：修改 ChunkedUploader 的 metadata 建立邏輯
// ==================================================

/**
 * 建立統一的上傳 metadata
 * 這個函數應該在所有媒體上傳時被調用
 */
function buildUnifiedUploadMetadata() {
  // 獲取當前課程資訊
  const currentCourse = window.currentCourse || 
                        (window.FLB && window.FLB.State && window.FLB.State.get().currentCourse) || 
                        {};
  
  // ✅ 關鍵修正：使用完整課程標題
  const fullCourseTitle = (currentCourse.title || '').trim();
  
  // 從快取或狀態中獲取其他資訊
  const cacheMeta = (window.FLB && FLB.State && FLB.State.get().uploadedRecordsCache && 
                     FLB.State.get().uploadedRecordsCache.meta) || {};
  
  // 日期處理
  let dateValue = '';
  if (currentCourse.start) {
    const startDate = new Date(currentCourse.start);
    dateValue = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;
  } else if (currentCourse.date) {
    dateValue = currentCourse.date;
  } else if (currentCourse.formattedDate) {
    dateValue = currentCourse.formattedDate;
  }
  
  // 主題處理
  let topicValue = '';
  if (currentCourse.topic) {
    topicValue = currentCourse.topic;
  } else {
    // 嘗試從課程名稱中提取主題
    const topicMatch = fullCourseTitle.match(/第\d+週\s*(.+?)$/);
    if (topicMatch && topicMatch[1]) {
      topicValue = topicMatch[1].trim();
    }
  }
  
  // 學期處理
  const semesterValue = cacheMeta.semester || 
                        currentCourse.semester || 
                        (typeof getCurrentSemester === 'function' ? getCurrentSemester() : '114-1');
  
  // 構建統一的 metadata
  const metadata = {
    semester: semesterValue,
    courseName: fullCourseTitle,  // ✅ 使用完整課程標題
    coursePeriod: fullCourseTitle,  // ✅ 保持一致
    date: dateValue,
    topic: topicValue,
    dateKey: dateValue,
    // 構建相對路徑
    relativePath: `${semesterValue}/${fullCourseTitle}${dateValue ? '/' + dateValue + (topicValue ? ' ' + topicValue : '') : ''}`
  };
  
  console.log('📋 [buildUnifiedUploadMetadata] 統一的上傳 metadata:', metadata);
  
  return metadata;
}

// ==================================================
// 第二步：攔截並修正 ChunkedUploader.uploadFileChunked
// ==================================================

if (window.ChunkedUploader && window.ChunkedUploader.uploadFileChunked) {
  const originalUploadFileChunked = window.ChunkedUploader.uploadFileChunked;
  
  window.ChunkedUploader.uploadFileChunked = async function(file, onProgress, onChunkComplete, extraOptions) {
    console.log('🔧 [修復] 攔截 ChunkedUploader.uploadFileChunked');
    
    // 獲取統一的 metadata
    const unifiedMetadata = buildUnifiedUploadMetadata();
    
    // 合併到 extraOptions
    if (!extraOptions) {
      extraOptions = {};
    }
    
    if (!extraOptions.metadata) {
      extraOptions.metadata = {};
    }
    
    // ✅ 覆蓋關鍵欄位，確保使用完整課程名稱
    extraOptions.metadata = Object.assign(extraOptions.metadata, {
      semester: unifiedMetadata.semester,
      courseName: unifiedMetadata.courseName,
      coursePeriod: unifiedMetadata.coursePeriod,
      date: unifiedMetadata.date,
      dateKey: unifiedMetadata.dateKey,
      topic: unifiedMetadata.topic,
      relativePath: unifiedMetadata.relativePath,
      relativePathUnified: unifiedMetadata.relativePath
    });
    
    console.log('📋 [修復] 修正後的 metadata:', extraOptions.metadata);
    
    // 調用原始函數
    return originalUploadFileChunked.call(this, file, onProgress, onChunkComplete, extraOptions);
  };
  
  console.log('✅ [修復] ChunkedUploader.uploadFileChunked 已被攔截並修正');
}

// ==================================================
// 第三步：攔截並修正 FLB.Api.uploadMediaFile（如果存在）
// ==================================================

if (window.FLB && window.FLB.Api && window.FLB.Api.uploadMediaFile) {
  const originalUploadMediaFile = window.FLB.Api.uploadMediaFile;
  
  window.FLB.Api.uploadMediaFile = async function(file, metadata, onProgress) {
    console.log('🔧 [修復] 攔截 FLB.Api.uploadMediaFile');
    
    // 獲取統一的 metadata
    const unifiedMetadata = buildUnifiedUploadMetadata();
    
    // 合併 metadata
    metadata = Object.assign({}, metadata, {
      semester: unifiedMetadata.semester,
      courseName: unifiedMetadata.courseName,
      coursePeriod: unifiedMetadata.coursePeriod,
      date: unifiedMetadata.date,
      dateKey: unifiedMetadata.dateKey,
      topic: unifiedMetadata.topic,
      relativePath: unifiedMetadata.relativePath,
      relativePathUnified: unifiedMetadata.relativePath
    });
    
    console.log('📋 [修復] 修正後的 API metadata:', metadata);
    
    // 調用原始函數
    return originalUploadMediaFile.call(this, file, metadata, onProgress);
  };
  
  console.log('✅ [修復] FLB.Api.uploadMediaFile 已被攔截並修正');
}

// ==================================================
// 第四步：提供全域修復函數
// ==================================================

window.fixUploadMetadata = buildUnifiedUploadMetadata;

// ==================================================
// 第五步：自動執行修復
// ==================================================

console.log('');
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║     🔥 學習歷程上傳路徑修復已載入                       ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log('║ 問題：前端上傳使用截斷的課程名稱                        ║');
console.log('║ 修復：統一使用完整課程標題                              ║');
console.log('║ 狀態：✅ 已攔截關鍵函數                                 ║');
console.log('╚══════════════════════════════════════════════════════════╝');
console.log('');

// 導出修復狀態
window.__uploadMetadataFixed = true;
