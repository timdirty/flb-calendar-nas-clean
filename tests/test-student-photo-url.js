#!/usr/bin/env node

/**
 * 測試學生照片 URL 生成問題
 * 檢查 buildDrivePhotoPreviewUrl 是否正確處理相對路徑
 */

// 測試用的 ensureDriveAbsolutePath 函數
function ensureDriveAbsolutePath(p) {
  const driveRoot = '/Fun Learn Bar/FLB-Learning-Portfolio';
  const target = String(p || '').trim();
  if (!target) return driveRoot;
  
  let normalized = target.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
  
  // 如果不是以 / 開頭，加上 /
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }
  
  // 如果已經包含 Drive 根路徑，直接返回
  if (normalized.startsWith(driveRoot)) {
    return normalized;
  }
  
  // 否則，加上 Drive 根路徑
  normalized = normalized.replace(/^\/+/, '');
  const result = (driveRoot + '/' + normalized).replace(/\/{2,}/g, '/');
  return result;
}

// 測試案例
const testCases = [
  {
    name: '相對路徑（學期開頭）',
    input: '114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/學生名/IMG_5631.jpeg',
    expected: '/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/學生名/IMG_5631.jpeg'
  },
  {
    name: '相對路徑（斜線開頭）',
    input: '/114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/學生名/IMG_5631.jpeg',
    expected: '/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/學生名/IMG_5631.jpeg'
  },
  {
    name: '絕對路徑（已包含根）',
    input: '/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/學生名/IMG_5631.jpeg',
    expected: '/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/學生名/IMG_5631.jpeg'
  },
  {
    name: '課程總覽路徑',
    input: '114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/課程總覽/IMG_5644.jpeg',
    expected: '/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/課程總覽/IMG_5644.jpeg'
  }
];

console.log('🧪 測試 ensureDriveAbsolutePath 函數\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = ensureDriveAbsolutePath(testCase.input);
  const success = result === testCase.expected;
  
  if (success) {
    passed++;
    console.log(`✅ 測試 ${index + 1}: ${testCase.name}`);
  } else {
    failed++;
    console.log(`❌ 測試 ${index + 1}: ${testCase.name}`);
    console.log(`   輸入: ${testCase.input}`);
    console.log(`   預期: ${testCase.expected}`);
    console.log(`   實際: ${result}`);
  }
});

console.log('\n📊 測試結果:');
console.log(`   ✅ 通過: ${passed}`);
console.log(`   ❌ 失敗: ${failed}`);

// 測試完整的 URL 生成
console.log('\n🔧 測試完整的 URL 生成:');

const relativePath = '114-1/SPIKE 五 1610-1740 松山/2025-01-17 機器人/學生名';
const filename = 'IMG_5631.jpeg';

const absolutePath = ensureDriveAbsolutePath(relativePath);
const fullPath = (absolutePath + '/' + filename).replace(/\/+/g, '/');
const finalUrl = '/api/drive-media' + fullPath;

console.log(`\n相對路徑: ${relativePath}`);
console.log(`檔案名稱: ${filename}`);
console.log(`絕對路徑: ${absolutePath}`);
console.log(`完整路徑: ${fullPath}`);
console.log(`最終 URL: ${finalUrl}`);
console.log(`編碼 URL: ${encodeURI(finalUrl)}`);
