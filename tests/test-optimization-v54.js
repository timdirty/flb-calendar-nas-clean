#!/usr/bin/env node

/**
 * 🧪 系統優化測試腳本 v54
 * 測試所有統一模組的功能
 */

const path = require('path');
const fs = require('fs');
const assert = require('assert');

// 載入統一模組
const semesterHelper = require('../utils/semester-helper');
const dateFormatter = require('../utils/date-formatter');
const courseNameCleaner = require('../utils/course-name-cleaner');
const metadataTransformer = require('../utils/metadata-transformer');
const DrivePathHelper = require('../utils/drive-path-helper');

// 測試結果統計
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const errors = [];

// 測試輔助函數
function test(name, fn) {
    totalTests++;
    try {
        fn();
        passedTests++;
        console.log(`✅ ${name}`);
    } catch (error) {
        failedTests++;
        errors.push({ name, error: error.message });
        console.log(`❌ ${name}`);
        console.error(`   錯誤: ${error.message}`);
    }
}

function testSection(title) {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`📊 ${title}`);
    console.log(`${'='.repeat(50)}`);
}

// ============================================
// 1. 測試學期計算（semester-helper）
// ============================================
testSection('測試學期計算模組');

test('getCurrentSemester - 2025年1月應返回冬令營', () => {
    const result = semesterHelper.getCurrentSemester('2025-01-15');
    assert.strictEqual(result, '冬令營-2025');
});

test('getCurrentSemester - 2025年3月應返回114-2', () => {
    const result = semesterHelper.getCurrentSemester('2025-03-15');
    assert.strictEqual(result, '114-2');
});

test('getCurrentSemester - 2025年7月應返回夏令營', () => {
    const result = semesterHelper.getCurrentSemester('2025-07-15');
    assert.strictEqual(result, '夏令營-2025');
});

test('getCurrentSemester - 2025年9月應返回114-1', () => {
    const result = semesterHelper.getCurrentSemester('2025-09-15');
    assert.strictEqual(result, '114-1');
});

test('isSemesterFormat - 驗證有效格式', () => {
    assert.strictEqual(semesterHelper.isSemesterFormat('114-1'), true);
    assert.strictEqual(semesterHelper.isSemesterFormat('114-2'), true);
    assert.strictEqual(semesterHelper.isSemesterFormat('夏令營-2025'), true);
    assert.strictEqual(semesterHelper.isSemesterFormat('冬令營-2025'), true);
});

test('isSemesterFormat - 驗證無效格式', () => {
    assert.strictEqual(semesterHelper.isSemesterFormat('2025-01'), false);
    assert.strictEqual(semesterHelper.isSemesterFormat('114'), false);
    assert.strictEqual(semesterHelper.isSemesterFormat('abc-1'), false);
});

test('getPreviousSemester - 114-2的上一個學期是114-1', () => {
    const result = semesterHelper.getPreviousSemester('114-2');
    assert.strictEqual(result, '114-1');
});

test('getNextSemester - 114-1的下一個學期是114-2', () => {
    const result = semesterHelper.getNextSemester('114-1');
    assert.strictEqual(result, '114-2');
});

// ============================================
// 2. 測試日期格式化（date-formatter）
// ============================================
testSection('測試日期格式化模組');

test('formatDateYYYYMMDD - 格式化日期物件', () => {
    const date = new Date('2025-01-17T08:30:00');
    const result = dateFormatter.formatDateYYYYMMDD(date);
    assert.strictEqual(result, '2025-01-17');
});

test('formatDateYYYYMMDD - 格式化日期字串', () => {
    const result = dateFormatter.formatDateYYYYMMDD('2025-01-17T08:30:00');
    assert.strictEqual(result, '2025-01-17');
});

test('formatDateTWISO - 台灣日期格式', () => {
    const date = new Date('2025-01-17T08:30:00');
    const result = dateFormatter.formatDateTWISO(date);
    assert.strictEqual(result, '2025-01-17');
});

test('formatDateDisplay - 顯示格式', () => {
    const date = new Date('2025-01-17T08:30:00');
    const result = dateFormatter.formatDateDisplay(date);
    assert.ok(result.includes('1月17日'));
});

test('formatDateTime - 日期時間格式', () => {
    const date = new Date('2025-01-17T08:30:45');
    const result = dateFormatter.formatDateTime(date);
    assert.ok(result.includes('2025-01-17'));
    assert.ok(result.includes('08:30:45'));
});

// ============================================
// 3. 測試課程名稱清理（course-name-cleaner）
// ============================================
testSection('測試課程名稱清理模組');

test('cleanCourseName - 移除「第X週」', () => {
    const result = courseNameCleaner.cleanCourseName('SPIKE 五 1610-1740 松山 第8週');
    assert.strictEqual(result, 'SPIKE 五 1610-1740 松山');
});

test('cleanCourseName - 移除「week X」', () => {
    const result = courseNameCleaner.cleanCourseName('Python Programming Week 5');
    assert.strictEqual(result, 'Python Programming');
});

test('cleanCourseName - 移除「w8」格式', () => {
    const result = courseNameCleaner.cleanCourseName('機器人課程 w8');
    assert.strictEqual(result, '機器人課程');
});

test('cleanCourseName - 保持沒有週次的名稱不變', () => {
    const result = courseNameCleaner.cleanCourseName('SPIKE 五 1610-1740 松山');
    assert.strictEqual(result, 'SPIKE 五 1610-1740 松山');
});

test('isSameCourse - 判斷相同課程', () => {
    const result = courseNameCleaner.isSameCourse(
        'SPIKE 五 1610-1740 松山 第8週',
        'SPIKE 五 1610-1740 松山 第5週'
    );
    assert.strictEqual(result, true);
});

test('extractWeekInfo - 提取週次資訊', () => {
    const result = courseNameCleaner.extractWeekInfo('SPIKE 五 1610-1740 松山 第8週');
    assert.strictEqual(result, '第8週');
});

// ============================================
// 4. 測試路徑處理（drive-path-helper）
// ============================================
testSection('測試路徑處理模組');

const pathHelper = new DrivePathHelper();

test('buildPath - 建構學生路徑', () => {
    const result = pathHelper.buildPath({
        semester: '114-1',
        courseName: 'SPIKE 五 1610-1740 松山',
        date: '2025-01-17',
        topic: '機器人課程',
        studentName: '王小明'
    });
    assert.ok(result.includes('114-1'));
    assert.ok(result.includes('SPIKE'));
    assert.ok(result.includes('2025-01-17'));
    assert.ok(result.includes('王小明'));
});

test('buildPath - 建構課程總覽路徑', () => {
    const result = pathHelper.buildPath({
        semester: '114-1',
        courseName: 'SPIKE 五 1610-1740 松山',
        date: '2025-01-17',
        topic: '機器人課程',
        isOverview: true
    });
    assert.ok(result.includes('課程總覽'));
});

test('sanitizeSegment - 清理不合法字元', () => {
    const result = pathHelper.sanitizeSegment('課程<>:"|?*名稱', false);
    assert.ok(!result.includes('<'));
    assert.ok(!result.includes('>'));
    assert.ok(!result.includes(':'));
    assert.ok(!result.includes('?'));
    assert.ok(!result.includes('*'));
});

test('sanitizeSegment - 清理課程名稱週次', () => {
    const result = pathHelper.sanitizeSegment('SPIKE 五 1610-1740 松山 第8週', true);
    assert.strictEqual(result, 'SPIKE 五 1610-1740 松山');
});

test('stripRootPrefix - 移除根路徑前綴', () => {
    const result = pathHelper.stripRootPrefix('/Fun Learn Bar/FLB-Learning-Portfolio/114-1/課程');
    assert.strictEqual(result, '114-1/課程');
});

test('isSemesterSegment - 判斷學期段落', () => {
    assert.strictEqual(pathHelper.isSemesterSegment('114-1'), true);
    assert.strictEqual(pathHelper.isSemesterSegment('課程名稱'), false);
});

test('isDateSegment - 判斷日期段落', () => {
    assert.strictEqual(pathHelper.isDateSegment('2025-01-17'), true);
    assert.strictEqual(pathHelper.isDateSegment('2025-01-17 機器人課程'), true);
    assert.strictEqual(pathHelper.isDateSegment('機器人課程'), false);
});

// ============================================
// 5. 測試 Metadata 轉換（metadata-transformer）
// ============================================
testSection('測試 Metadata 轉換模組');

test('normalize - 標準化前端格式', () => {
    const input = {
        studentName: '王小明',
        dateKey: '2025-01-17',
        courseName: 'SPIKE課程',
        mode: 'student',
        semester: '114-1',
        topic: '機器人'
    };
    const result = metadataTransformer.normalize(input);
    assert.strictEqual(result.studentName, '王小明');
    assert.strictEqual(result.date, '2025-01-17');
    assert.strictEqual(result.courseName, 'SPIKE課程');
    assert.strictEqual(result.isOverview, false);
});

test('normalize - 標準化後端格式', () => {
    const input = {
        student: '李小華',
        date: '2025-01-17',
        courseTitle: 'Python程式',
        teacherName: '張老師',
        isOverview: true
    };
    const result = metadataTransformer.normalize(input);
    assert.strictEqual(result.studentName, '課程總覽'); // isOverview = true 時
    assert.strictEqual(result.courseName, 'Python程式');
    assert.strictEqual(result.instructorName, '張老師');
    assert.strictEqual(result.isOverview, true);
});

test('validate - 驗證必要欄位', () => {
    const metadata = {
        semester: '114-1',
        courseName: 'SPIKE課程',
        date: '2025-01-17',
        studentName: '王小明'
    };
    const result = metadataTransformer.validate(metadataTransformer.normalize(metadata));
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.missing.length, 0);
});

test('validate - 檢測缺失欄位', () => {
    const metadata = {
        courseName: 'SPIKE課程'
        // 缺少 semester, date, studentName
    };
    const result = metadataTransformer.validate(metadataTransformer.normalize(metadata));
    assert.strictEqual(result.valid, false);
    assert.ok(result.missing.length > 0);
});

test('merge - 合併多個 metadata', () => {
    const meta1 = { semester: '114-1', courseName: 'SPIKE' };
    const meta2 = { date: '2025-09-17', topic: '機器人' };  // 使用9月日期確保是114-1學期
    const meta3 = { studentName: '王小明' };
    
    const result = metadataTransformer.merge(meta1, meta2, meta3);
    assert.strictEqual(result.semester, '114-1');
    assert.strictEqual(result.courseName, 'SPIKE');
    assert.strictEqual(result.date, '2025-09-17');
    assert.strictEqual(result.topic, '機器人');
    assert.strictEqual(result.studentName, '王小明');
});

test('toFrontendFormat - 轉換為前端格式', () => {
    const metadata = metadataTransformer.normalize({
        semester: '114-1',
        courseName: 'SPIKE課程',
        date: '2025-01-17',
        studentName: '王小明'
    });
    const result = metadataTransformer.toFrontendFormat(metadata);
    assert.strictEqual(result.dateKey, '2025-01-17');
    assert.strictEqual(result.mode, 'student');
    assert.strictEqual(result.coursePeriod, 'SPIKE課程');
});

test('toBackendFormat - 轉換為後端格式', () => {
    const metadata = metadataTransformer.normalize({
        semester: '114-1',
        courseName: 'SPIKE課程',
        date: '2025-01-17',
        studentName: '王小明',
        instructorName: '張老師'
    });
    const result = metadataTransformer.toBackendFormat(metadata);
    assert.strictEqual(result.dateKey, '2025-01-17');
    assert.strictEqual(result.teacherName, '張老師');
    assert.strictEqual(result.metadata._normalized, true);
});

// ============================================
// 6. 整合測試
// ============================================
testSection('整合測試');

test('完整流程 - 從參數到路徑', () => {
    // 1. 接收前端參數（使用9月日期以確保是114-1學期）
    const frontendParams = {
        courseName: 'SPIKE 五 1610-1740 松山 第8週',
        date: '2025-09-17T08:30:00',
        studentName: '王小明',
        topic: '機器人課程',
        comment: '今天表現很好'
    };
    
    // 2. 標準化 metadata
    const normalized = metadataTransformer.normalize(frontendParams);
    
    // 3. 清理課程名稱
    const cleanedCourseName = courseNameCleaner.cleanCourseName(normalized.courseName);
    
    // 4. 計算學期
    const semester = semesterHelper.getCurrentSemester(normalized.date);
    
    // 5. 格式化日期
    const formattedDate = dateFormatter.formatDateYYYYMMDD(normalized.date);
    
    // 6. 建構路徑
    const path = pathHelper.buildPath({
        semester: semester,
        courseName: cleanedCourseName,
        date: formattedDate,
        topic: normalized.topic,
        studentName: normalized.studentName
    });
    
    // 驗證結果
    assert.ok(path.includes('114-'));  // 包含學期
    assert.ok(path.includes('SPIKE 五 1610-1740 松山')); // 課程名稱已清理週次
    assert.ok(path.includes('2025-09-17')); // 日期格式正確
    assert.ok(path.includes('王小明')); // 包含學生名稱
});

test('完整流程 - 課程總覽模式', () => {
    // 1. 接收前端參數（課程總覽）
    const frontendParams = {
        courseName: 'Python Programming Week 5',
        date: new Date('2025-01-17'),
        isOverview: true,
        topic: '函式與模組',
        instructorName: '李老師'
    };
    
    // 2. 標準化 metadata
    const normalized = metadataTransformer.normalize(frontendParams);
    
    // 3. 驗證課程總覽設定
    assert.strictEqual(normalized.isOverview, true);
    assert.strictEqual(normalized.studentName, '課程總覽');
    
    // 4. 建構路徑
    const path = pathHelper.buildPath({
        semester: semesterHelper.getCurrentSemester(normalized.date),
        courseName: courseNameCleaner.cleanCourseName(normalized.courseName),
        date: dateFormatter.formatDateYYYYMMDD(normalized.date),
        topic: normalized.topic,
        isOverview: normalized.isOverview
    });
    
    // 驗證結果
    assert.ok(path.includes('課程總覽'));
    assert.ok(path.includes('Python Programming')); // 週次已移除
    assert.ok(!path.includes('Week 5')); // 確認週次被移除
});

// ============================================
// 測試總結
// ============================================
console.log(`\n${'='.repeat(50)}`);
console.log('📊 測試總結');
console.log(`${'='.repeat(50)}`);
console.log(`總測試數: ${totalTests}`);
console.log(`✅ 通過: ${passedTests}`);
console.log(`❌ 失敗: ${failedTests}`);
console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

if (failedTests > 0) {
    console.log(`\n❌ 失敗的測試:`);
    errors.forEach(({ name, error }) => {
        console.log(`  - ${name}: ${error}`);
    });
    process.exit(1);
} else {
    console.log(`\n🎉 所有測試通過！系統優化驗證成功！`);
    process.exit(0);
}
