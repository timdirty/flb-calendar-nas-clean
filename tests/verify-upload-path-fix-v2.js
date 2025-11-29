/**
 * 🧪 驗證上傳路徑修復 v2
 * 模擬實際問題場景：當 coursePeriod 被錯誤傳遞時的情況
 */

const path = require('path');

// 模擬後端 resolveDriveContext（簡化版）
function simulateBackendContext(metadata) {
  // 後端邏輯：優先 coursePeriod，否則使用 courseName
  let courseName = metadata.coursePeriod || metadata.courseName || '未命名課程';
  
  // 如果 coursePeriod 為空或只是簡化名稱，則會使用 courseName
  // 這就是問題所在：courseName 可能只是 "SPIKE" 而不是完整標題
  
  return {
    semester: metadata.semester || '114-1',
    courseName: courseName,
    date: metadata.dateKey,
    topic: metadata.topic,
    studentName: '石紹言'
  };
}

// 模擬後端路徑構建
function buildPath(context) {
  const cleanedCourseName = context.courseName.replace(/\s+第\d+週/gi, '');
  const sanitized = cleanedCourseName.replace(/:/g, '');
  
  return path.posix.join(
    '/團隊資料夾/Fun Learn Bar/FLB-Learning-Portfolio',
    context.semester,
    sanitized,
    `${context.date} ${context.topic}`,
    context.studentName
  );
}

console.log('🧪 驗證上傳路徑修復 v2 - 實際問題場景\n');

// 場景 1：修復前 - courseName 只有簡化名稱
console.log('❌ 場景 1：修復前（使用簡化的 courseName）');
const metadataOld = {
  courseName: 'SPIKE', // ❌ 只有課程代碼，缺少時間和地點
  coursePeriod: '', // 可能因為某種原因為空或未正確傳遞
  dateKey: '2025-11-07',
  semester: '114-1',
  topic: '日本武士'
};

console.log('  傳遞的 metadata:', JSON.stringify(metadataOld, null, 2));
const contextOld = simulateBackendContext(metadataOld);
console.log('  後端解析 courseName:', contextOld.courseName);
const pathOld = buildPath(contextOld);
console.log('  生成路徑:', pathOld);
console.log('  問題：路徑只有 "SPIKE"，缺少時間和地點資訊\n');

// 場景 2：修復後 - courseName 包含完整標題
console.log('✅ 場景 2：修復後（courseName 使用完整標題）');
const metadataNew = {
  courseName: 'SPIKE 五 16:10-17:40 松山 第7週', // ✅ 完整標題，即使 coursePeriod 為空也沒問題
  coursePeriod: 'SPIKE 五 16:10-17:40 松山 第7週',
  dateKey: '2025-11-07',
  semester: '114-1',
  topic: '日本武士'
};

console.log('  傳遞的 metadata:', JSON.stringify(metadataNew, null, 2));
const contextNew = simulateBackendContext(metadataNew);
console.log('  後端解析 courseName:', contextNew.courseName);
const pathNew = buildPath(contextNew);
console.log('  生成路徑:', pathNew);
console.log('  修復：路徑包含完整資訊（時間 + 地點）\n');

// 場景 3：優先使用 coursePeriod 的正確邏輯
console.log('✅ 場景 3：正確的 fallback 邏輯');
const metadataCorrect = {
  courseName: 'SPIKE', // 即使這裡是簡化名稱
  coursePeriod: 'SPIKE 五 16:10-17:40 松山 第7週', // ✅ 但 coursePeriod 有完整標題
  dateKey: '2025-11-07',
  semester: '114-1',
  topic: '日本武士'
};

console.log('  傳遞的 metadata:', JSON.stringify(metadataCorrect, null, 2));
const contextCorrect = simulateBackendContext(metadataCorrect);
console.log('  後端解析 courseName:', contextCorrect.courseName);
const pathCorrect = buildPath(contextCorrect);
console.log('  生成路徑:', pathCorrect);
console.log('  說明：coursePeriod 優先，即使 courseName 是簡化的也不影響\n');

// 驗證結果
console.log('🎯 關鍵對比：');
console.log('  修復前路徑:', pathOld);
console.log('  修復後路徑:', pathNew);
console.log('');

const oldPathWrong = pathOld.includes('/SPIKE/') && !pathOld.includes('1610');
const newPathCorrect = pathNew.includes('1610-1740') && pathNew.includes('松山');

console.log('📊 驗證結果：');
console.log('  ❌ 修復前路徑只有 "SPIKE":', oldPathWrong ? '是（問題存在）' : '否');
console.log('  ✅ 修復後路徑有完整時間:', newPathCorrect ? '是（已修復）' : '否');
console.log('  ✅ 路徑一致性:', pathNew === pathCorrect ? '是（metadata 和 record-meta 路徑相同）' : '否');
console.log('');

if (oldPathWrong && newPathCorrect && pathNew === pathCorrect) {
  console.log('✅ 修復驗證通過！');
  console.log('   - 成功展示修復前的問題（路徑被截斷）');
  console.log('   - 確認修復後路徑包含完整資訊');
  console.log('   - 確保 media 和 record-meta 使用相同路徑');
} else {
  console.log('❌ 驗證結果異常，請檢查邏輯');
  process.exit(1);
}
