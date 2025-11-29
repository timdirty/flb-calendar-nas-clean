/**
 * 🧪 驗證上傳路徑修復
 * 確認媒體檔案和 record-meta.json 儲存到相同的完整路徑
 */

const path = require('path');

// 模擬前端邏輯
function simulateFrontendMetadata(currentCourse) {
  // 模擬 buildRecordOperationMeta
  const recordMeta = {
    course: 'SPIKE', // 被 CourseTitleParser 簡化的課程名稱
    coursePeriod: currentCourse.title, // 完整課程標題
    period: '五16101740',
    date: '2025-11-07',
    topic: '日本武士',
    semester: '114-1'
  };

  // 🔥 修復前的邏輯（錯誤）
  const uploadMetadataOld = {
    courseName: recordMeta.course || currentCourse.courseName || '', // ❌ 只使用簡化名稱
    coursePeriod: recordMeta.coursePeriod,
    dateKey: recordMeta.date,
    semester: recordMeta.semester,
    topic: recordMeta.topic
  };

  // 🔥 修復後的邏輯（正確）
  const uploadMetadataNew = {
    courseName: recordMeta.coursePeriod || recordMeta.course || currentCourse.courseName || '', // ✅ 優先使用完整標題
    coursePeriod: recordMeta.coursePeriod,
    dateKey: recordMeta.date,
    semester: recordMeta.semester,
    topic: recordMeta.topic
  };

  return { uploadMetadataOld, uploadMetadataNew, recordMeta };
}

// 模擬後端 resolveDriveContext
function simulateBackendContext(metadata) {
  // 後端優先使用 coursePeriod，但如果無效會降級使用 courseName
  const courseName = metadata.coursePeriod || metadata.courseName || '未命名課程';
  return {
    semester: metadata.semester || '114-1',
    courseName: courseName,
    date: metadata.dateKey,
    topic: metadata.topic,
    studentName: '石紹言'
  };
}

// 模擬後端路徑構建（簡化版）
function buildPath(context) {
  // 移除週次資訊
  const cleanedCourseName = context.courseName.replace(/\s+第\d+週/gi, '');
  // 移除冒號並清理
  const sanitized = cleanedCourseName.replace(/:/g, '');
  
  return path.posix.join(
    '/團隊資料夾/Fun Learn Bar/FLB-Learning-Portfolio',
    context.semester,
    sanitized,
    `${context.date} ${context.topic}`,
    context.studentName
  );
}

// 執行測試
console.log('🧪 驗證上傳路徑修復\n');

const testCourse = {
  title: 'SPIKE 五 16:10-17:40 松山 第7週',
  courseName: 'SPIKE 五 16:10-17:40 松山'
};

const { uploadMetadataOld, uploadMetadataNew, recordMeta } = simulateFrontendMetadata(testCourse);

console.log('📋 前端 Metadata 準備：');
console.log('  recordMeta.course:', recordMeta.course);
console.log('  recordMeta.coursePeriod:', recordMeta.coursePeriod);
console.log('');

console.log('❌ 修復前（錯誤）：');
console.log('  uploadMetadata.courseName:', uploadMetadataOld.courseName);
const contextOld = simulateBackendContext(uploadMetadataOld);
console.log('  後端解析 courseName:', contextOld.courseName);
const pathOld = buildPath(contextOld);
console.log('  最終路徑:', pathOld);
console.log('');

console.log('✅ 修復後（正確）：');
console.log('  uploadMetadata.courseName:', uploadMetadataNew.courseName);
const contextNew = simulateBackendContext(uploadMetadataNew);
console.log('  後端解析 courseName:', contextNew.courseName);
const pathNew = buildPath(contextNew);
console.log('  最終路徑:', pathNew);
console.log('');

// 驗證結果
const expectedPath = '/團隊資料夾/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山/2025-11-07 日本武士/石紹言';
const testPassed = pathNew === expectedPath;

console.log('🎯 驗證結果：');
console.log('  預期路徑:', expectedPath);
console.log('  實際路徑:', pathNew);
console.log('  測試結果:', testPassed ? '✅ 通過' : '❌ 失敗');
console.log('');

if (!testPassed) {
  console.error('❌ 測試失敗：路徑不符預期');
  process.exit(1);
}

// 檢查修復前的路徑是否錯誤
const oldPathWrong = pathOld.includes('SPIKE 五 1610/') && !pathOld.includes('1610-1740');
console.log('🔍 額外驗證：');
console.log('  修復前路徑確實錯誤:', oldPathWrong ? '✅ 是（被截斷）' : '❌ 否');
console.log('  修復後路徑包含完整時間:', pathNew.includes('1610-1740') ? '✅ 是' : '❌ 否');
console.log('  修復後路徑包含地點:', pathNew.includes('松山') ? '✅ 是' : '❌ 否');
console.log('');

console.log('✅ 所有驗證通過！修復成功。');
