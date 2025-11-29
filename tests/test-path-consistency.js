#!/usr/bin/env node

/**
 * ============================================
 * 測試路徑一致性問題
 * ============================================
 * 驗證 record-meta.json 和 photos-meta.json 是否儲存到相同路徑
 */

require('dotenv').config({ path: '.env.nas' });
const DrivePathManager = require('../drive-path-manager');

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║                    測試路徑一致性                                      ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('');

// 初始化路徑管理器
const pathManager = new DrivePathManager(process.env.SYNOLOGY_DRIVE_ROOT || '/Fun Learn Bar/FLB-Learning-Portfolio');

// 測試案例
const testCases = [
    {
        name: 'SPIKE 課程（包含冒號）',
        params: {
            semester: '114-1',
            courseName: 'SPIKE 五 16:10-17:40 松山',
            date: '2025-11-07',
            topic: '日本武士',
            studentName: '石紹言'
        }
    },
    {
        name: 'ESM 課程（包含冒號）',
        params: {
            semester: '114-1',
            courseName: 'ESM 四 17:30-18:30 到府',
            date: '2025-11-14',
            topic: '機器人',
            studentName: '測試學生'
        }
    }
];

console.log('📋 測試 sanitizeComponent 函數：');
console.log('----------------------------------------');

// 測試 sanitizeComponent
const testStrings = [
    'SPIKE 五 16:10-17:40 松山',
    'ESM 四 17:30-18:30 到府',
    'BOOST 六 15:30-17:00 到府'
];

testStrings.forEach(str => {
    const sanitized = pathManager.sanitizeComponent(str);
    console.log(`原始: "${str}"`);
    console.log(`清理後: "${sanitized}"`);
    console.log('');
});

console.log('📂 測試完整路徑生成：');
console.log('----------------------------------------');

testCases.forEach(testCase => {
    console.log(`\n${testCase.name}:`);
    console.log('參數:', JSON.stringify(testCase.params, null, 2));
    
    // 生成基礎路徑
    const basePath = pathManager.buildStudentRecordPath(
        testCase.params.semester,
        testCase.params.courseName,
        testCase.params.date,
        testCase.params.topic,
        testCase.params.studentName
    );
    
    console.log('\n生成的路徑:');
    console.log('基礎路徑:', basePath);
    
    // 生成各種檔案路徑
    const recordMetaPath = pathManager.getRecordMetaPath(basePath);
    const photosMetaPath = pathManager.getPhotosMetaPath(basePath);
    const videosMetaPath = pathManager.getVideosMetaPath(basePath);
    
    console.log('record-meta.json:', recordMetaPath);
    console.log('photos-meta.json:', photosMetaPath);
    console.log('videos-meta.json:', videosMetaPath);
    
    // 檢查路徑是否一致
    const recordDir = recordMetaPath.substring(0, recordMetaPath.lastIndexOf('/'));
    const photosDir = photosMetaPath.substring(0, photosMetaPath.lastIndexOf('/'));
    const videosDir = videosMetaPath.substring(0, videosMetaPath.lastIndexOf('/'));
    
    const isConsistent = (recordDir === photosDir) && (photosDir === videosDir);
    
    console.log('\n路徑一致性檢查:');
    if (isConsistent) {
        console.log('✅ 所有檔案在相同目錄！');
    } else {
        console.log('❌ 檔案路徑不一致！');
        console.log('  record-meta 目錄:', recordDir);
        console.log('  photos-meta 目錄:', photosDir);
        console.log('  videos-meta 目錄:', videosDir);
    }
    
    console.log('========================================');
});

console.log('\n');
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║                        測試完成                                        ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('');

// 檢查重要問題
const problemCase = pathManager.buildStudentRecordPath(
    '114-1',
    'SPIKE 五 16:10-17:40 松山',
    '2025-11-07',
    '日本武士',
    '石紹言'
);

console.log('🔍 檢查關鍵問題：');
console.log('期望路徑應該是:');
console.log('  /Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山/2025-11-07 日本武士/石紹言');
console.log('實際生成路徑:');
console.log(' ', problemCase);

if (problemCase.includes('SPIKE 五 1610-1740 松山')) {
    console.log('✅ 路徑正確！冒號已被正確移除');
} else if (problemCase.includes('SPIKE 五 1610')) {
    console.log('❌ 路徑被截斷！只有 "SPIKE 五 1610"');
} else {
    console.log('❌ 路徑格式異常！');
}

console.log('');
