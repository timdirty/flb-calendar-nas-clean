#!/usr/bin/env node

/**
 * 測試學生照片 URL 生成的完整流程
 * 模擬 buildDrivePhotoPreviewUrl 的各種場景
 */

// 模擬 ensureDriveAbsolutePath 函數
function ensureDriveAbsolutePath(p) {
  const driveRoot = '/Fun Learn Bar/FLB-Learning-Portfolio';
  const target = String(p || '').trim();
  if (!target) return driveRoot;
  
  let normalized = target.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  if (normalized.startsWith(driveRoot)) {
    return normalized;
  }
  
  normalized = normalized.replace(/^\/+/, '');
  const result = (driveRoot + '/' + normalized).replace(/\/{2,}/g, '/');
  return result;
}

// 模擬 buildDrivePhotoPreviewUrl 函數
function buildDrivePhotoPreviewUrl(photoId, record, overrides) {
  console.log('🔥 [buildDrivePhotoPreviewUrl] 開始處理', {
    photoId: photoId,
    hasRecord: !!record,
    hasOverrides: !!overrides,
    'overrides.relativePath': overrides && overrides.relativePath,
    'overrides.filename': overrides && overrides.filename
  });
  
  if (!photoId) return '';
  
  // 模擬 entry 為 null（找不到對應的 photo entry）
  const entry = null;
  
  if (entry) {
    console.log('✅ 找到 entry，使用 entry 的路徑');
    // 實際代碼會處理 entry 的各種情況
  }
  
  // Fallback 邏輯
  console.log('🔥 進入 fallback 邏輯，entry 為:', entry);
  
  const fallbackBase = (overrides && overrides.relativePath) || '';
  const fallbackName = (overrides && overrides.filename) || '';
  
  console.log('🔥 fallback 參數', {
    fallbackBase: fallbackBase,
    fallbackName: fallbackName
  });
  
  if (fallbackBase && fallbackName) {
    // 確保路徑包含 Drive 根前綴
    let absolutePath = fallbackBase;
    if (!fallbackBase.startsWith('/Fun Learn Bar/FLB-Learning-Portfolio')) {
      absolutePath = ensureDriveAbsolutePath(fallbackBase);
    }
    console.log('🔍 fallbackBase:', fallbackBase, '→ absolutePath:', absolutePath);
    
    // 構建完整路徑
    const fullPath = (absolutePath + '/' + fallbackName).replace(/\/+/g, '/');
    const finalUrl = '/api/drive-media' + fullPath;
    console.log('🔍 fallback fullPath:', fullPath, '→ finalUrl:', finalUrl);
    return encodeURI(finalUrl);
  }
  
  // 如果沒有 fallbackName，但有 photoId
  if (fallbackBase && photoId) {
    console.log('🔥 無 fallbackName，使用 photoId 作為檔名');
    let absolutePath = fallbackBase;
    if (!fallbackBase.startsWith('/Fun Learn Bar/FLB-Learning-Portfolio')) {
      absolutePath = ensureDriveAbsolutePath(fallbackBase);
    }
    const fallbackFilename = photoId + (photoId.indexOf('.') === -1 ? '.jpeg' : '');
    const fullPath = (absolutePath + '/' + fallbackFilename).replace(/\/+/g, '/');
    const finalUrl = '/api/drive-media' + fullPath;
    console.log('🔍 photoId fallback:', {
      photoId: photoId,
      fallbackFilename: fallbackFilename,
      fullPath: fullPath,
      finalUrl: finalUrl
    });
    return encodeURI(finalUrl);
  }
  
  console.log('❌ 無法構建 URL，返回空字串');
  return '';
}

// 測試場景
console.log('🧪 測試學生照片 URL 生成\n');
console.log('=' .repeat(80));

// 場景 1：有 filename 的情況（修復後）
console.log('\n📝 場景 1：有 filename 的情況（修復後）');
const url1 = buildDrivePhotoPreviewUrl('photo123', null, {
  relativePath: '114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/魏翔燊',
  filename: 'IMG_5631.jpeg'
});
console.log('✅ 生成的 URL:', url1);

console.log('\n' + '=' .repeat(80));

// 場景 2：沒有 filename 的情況（修復前）
console.log('\n📝 場景 2：沒有 filename 的情況（修復前的問題）');
const url2 = buildDrivePhotoPreviewUrl('photo123', null, {
  relativePath: '114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/魏翔燊'
  // 注意：沒有 filename！
});
console.log(url2 ? '✅ 生成的 URL:' : '❌ 無法生成 URL:', url2 || '(空字串)');

console.log('\n' + '=' .repeat(80));

// 場景 3：課程總覽照片
console.log('\n📝 場景 3：課程總覽照片');
const url3 = buildDrivePhotoPreviewUrl('overview001', null, {
  relativePath: '114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/課程總覽',
  filename: 'IMG_5644.jpeg'
});
console.log('✅ 生成的 URL:', url3);

console.log('\n' + '=' .repeat(80));

// 驗證 URL 格式
console.log('\n🔍 驗證生成的 URL 格式:');
const testUrl = url1 || url3;
if (testUrl) {
  const decoded = decodeURI(testUrl);
  console.log('編碼 URL:', testUrl);
  console.log('解碼 URL:', decoded);
  
  // 檢查是否包含必要的部分
  const hasApiPrefix = decoded.startsWith('/api/drive-media');
  const hasDriveRoot = decoded.includes('/Fun Learn Bar/FLB-Learning-Portfolio');
  const hasSemester = decoded.includes('114-1');
  const hasCourseName = decoded.includes('SPIKE');
  const hasFilename = decoded.includes('.jpeg') || decoded.includes('.jpg');
  
  console.log('\n✅ 檢查清單:');
  console.log('  ✓ API 前綴:', hasApiPrefix ? '✅' : '❌');
  console.log('  ✓ Drive 根路徑:', hasDriveRoot ? '✅' : '❌');
  console.log('  ✓ 學期:', hasSemester ? '✅' : '❌');
  console.log('  ✓ 課程名稱:', hasCourseName ? '✅' : '❌');
  console.log('  ✓ 檔案名稱:', hasFilename ? '✅' : '❌');
  
  if (hasApiPrefix && hasDriveRoot && hasSemester && hasCourseName && hasFilename) {
    console.log('\n🎉 URL 格式正確！');
  } else {
    console.log('\n⚠️ URL 格式可能有問題，請檢查上述項目');
  }
}
