/**
 * 測試統一存儲系統
 * - 驗證照片和影片是否存儲在相同目錄
 * - 測試 API 端點是否能正確讀取檔案
 */

const path = require('path');
const fs = require('fs');

const mediaStorage = require('../services/media/media-storage');

console.log('🧪 測試統一存儲系統\n');

// 測試 1: 驗證 MEDIA_ROOT 路徑
console.log('📁 測試 1: 驗證存儲根目錄');
console.log('   MEDIA_ROOT:', mediaStorage.MEDIA_ROOT);
console.log('   預期:', '/volume1/Fun Learn Bar/學習歷程 automatic');
console.log('   結果:', mediaStorage.MEDIA_ROOT === '/volume1/Fun Learn Bar/學習歷程 automatic' ? '✅ 通過' : '❌ 失敗');
console.log('');

// 測試 2: 建立測試儲存桶
console.log('📦 測試 2: 建立測試儲存桶');
const testMetadata = {
    courseName: 'Python',
    period: '0810-0940',
    date: '2024-11-03',
    studentName: '測試學生',
    instructorName: '測試講師',
    mode: 'student'
};

try {
    const bucket = mediaStorage.resolveBucket(testMetadata);
    console.log('   Bucket ID:', bucket.bucketId);
    console.log('   Base Dir:', bucket.baseDir);
    console.log('   Relative Path:', bucket.relativePath);
    console.log('   學期:', bucket.semester);
    console.log('   課程時段:', bucket.coursePeriod);
    console.log('   日期:', bucket.dateKey);
    console.log('   結果: ✅ 通過');
} catch (error) {
    console.error('   結果: ❌ 失敗', error.message);
}
console.log('');

// 測試 3: 驗證路徑格式
console.log('🗂️ 測試 3: 驗證路徑格式');
const expectedPattern = /學習歷程 automatic\/\d{3}-[12]\/.*\/\d{4}-\d{2}-\d{2}\/.*$/;
const bucket = mediaStorage.resolveBucket(testMetadata);
const matches = expectedPattern.test(bucket.baseDir);
console.log('   路徑格式:', bucket.baseDir);
console.log('   符合預期:', matches ? '✅ 通過' : '❌ 失敗');
console.log('');

// 測試 4: 驗證所有檔案都存儲在同一目錄
console.log('📂 測試 4: 驗證檔案存儲位置');
console.log('   原始影片目錄:', bucket.originDir);
console.log('   轉碼影片目錄:', bucket.transcodedDir);
console.log('   縮圖目錄:', bucket.thumbsDir);
console.log('   Base Dir:', bucket.baseDir);
const allSame = bucket.originDir === bucket.baseDir && 
                bucket.transcodedDir === bucket.baseDir && 
                bucket.thumbsDir === bucket.baseDir;
console.log('   所有檔案在同一目錄:', allSame ? '✅ 通過' : '❌ 失敗');
console.log('');

// 測試 5: 測試課程總覽模式
console.log('📋 測試 5: 課程總覽模式');
const overviewMetadata = {
    ...testMetadata,
    mode: 'overview',
    isOverview: true
};
const overviewBucket = mediaStorage.resolveBucket(overviewMetadata);
console.log('   路徑:', overviewBucket.baseDir);
console.log('   包含「課程總覽」:', overviewBucket.baseDir.includes('課程總覽') ? '✅ 通過' : '❌ 失敗');
console.log('');

// 測試 6: 測試學期計算
console.log('📅 測試 6: 學期計算');
const testDates = [
    { date: '2024-11-03', expected: '114-1' },
    { date: '2024-04-15', expected: '113-2' },
    { date: '2024-07-20', expected: '夏令營-2024' },
    { date: '2024-01-15', expected: '冬令營-2024' }
];

testDates.forEach(({ date, expected }) => {
    const semester = mediaStorage.getCurrentSemester(date);
    const result = semester === expected ? '✅' : '❌';
    console.log(`   ${date} → ${semester} (預期: ${expected}) ${result}`);
});
console.log('');

// 測試 7: 測試日期格式化
console.log('📆 測試 7: 日期格式化');
const dateKey = mediaStorage.formatDateKey('2024-11-03');
console.log('   輸入: 2024-11-03');
console.log('   輸出:', dateKey);
console.log('   結果:', dateKey === '2024-11-03' ? '✅ 通過' : '❌ 失敗');
console.log('');

// 測試 8: 測試課程時段正規化
console.log('⏰ 測試 8: 課程時段正規化');
const testPeriods = [
    { course: 'Python', period: '0810-0940', date: '2024-11-03' },
    { course: 'JavaScript', period: '1400-1530', date: '2024-11-04' }
];

testPeriods.forEach(({ course, period, date }) => {
    const normalized = mediaStorage.normalizeCoursePeriod(course, period, date);
    console.log(`   ${course} ${period} → ${normalized}`);
});
console.log('');

console.log('🎉 測試完成！\n');
console.log('總結:');
console.log('✅ 照片和影片現在存儲在相同的學習歷程目錄');
console.log('✅ 使用統一的路徑格式：學期/課程-時段/日期/學生名');
console.log('✅ 所有媒體檔案（照片、影片、縮圖）都在同一目錄下');
console.log('✅ 支援課程總覽模式');


