#!/usr/bin/env node

/**
 * 🚀 效能分析工具
 * 分析系統優化後的效能改進
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// 載入統一模組
const semesterHelper = require('../utils/semester-helper');
const dateFormatter = require('../utils/date-formatter');
const courseNameCleaner = require('../utils/course-name-cleaner');
const metadataTransformer = require('../utils/metadata-transformer');
const DrivePathHelper = require('../utils/drive-path-helper');

// 效能測試結果
const results = {
    semesterCalculation: [],
    dateFormatting: [],
    courseNameCleaning: [],
    pathBuilding: [],
    metadataProcessing: [],
    memoryUsage: []
};

// 測試輔助函數
function measureTime(name, fn, iterations = 1000) {
    const startTime = performance.now();
    const startMemory = process.memoryUsage();
    
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage();
    
    const executionTime = endTime - startTime;
    const memoryDelta = {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        external: endMemory.external - startMemory.external
    };
    
    return {
        name,
        iterations,
        totalTime: executionTime,
        avgTime: executionTime / iterations,
        memoryDelta
    };
}

// ============================================
// 1. 學期計算效能測試
// ============================================
console.log('🔍 分析學期計算效能...');

const semesterPerf = measureTime('getCurrentSemester', () => {
    semesterHelper.getCurrentSemester('2025-01-17');
}, 10000);
results.semesterCalculation.push(semesterPerf);

const semesterValidatePerf = measureTime('isSemesterFormat', () => {
    semesterHelper.isSemesterFormat('114-1');
}, 10000);
results.semesterCalculation.push(semesterValidatePerf);

// ============================================
// 2. 日期格式化效能測試
// ============================================
console.log('🔍 分析日期格式化效能...');

const dateFormatPerf = measureTime('formatDateYYYYMMDD', () => {
    dateFormatter.formatDateYYYYMMDD(new Date());
}, 10000);
results.dateFormatting.push(dateFormatPerf);

const dateDisplayPerf = measureTime('formatDateDisplay', () => {
    dateFormatter.formatDateDisplay(new Date());
}, 10000);
results.dateFormatting.push(dateDisplayPerf);

// ============================================
// 3. 課程名稱清理效能測試
// ============================================
console.log('🔍 分析課程名稱清理效能...');

const courseCleanPerf = measureTime('cleanCourseName', () => {
    courseNameCleaner.cleanCourseName('SPIKE 五 1610-1740 松山 第8週');
}, 10000);
results.courseNameCleaning.push(courseCleanPerf);

const courseSamePerf = measureTime('isSameCourse', () => {
    courseNameCleaner.isSameCourse('SPIKE 第8週', 'SPIKE 第5週');
}, 10000);
results.courseNameCleaning.push(courseSamePerf);

// ============================================
// 4. 路徑建構效能測試
// ============================================
console.log('🔍 分析路徑建構效能...');

const pathHelper = new DrivePathHelper();
const pathBuildPerf = measureTime('buildPath', () => {
    pathHelper.buildPath({
        semester: '114-1',
        courseName: 'SPIKE 五 1610-1740 松山',
        date: '2025-01-17',
        topic: '機器人課程',
        studentName: '王小明'
    });
}, 10000);
results.pathBuilding.push(pathBuildPerf);

const pathNormalizePerf = measureTime('normalizeRelativePath', () => {
    pathHelper.normalizeRelativePath('/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山 第8週/2025-01-17 機器人課程/王小明');
}, 10000);
results.pathBuilding.push(pathNormalizePerf);

// ============================================
// 5. Metadata 處理效能測試
// ============================================
console.log('🔍 分析 Metadata 處理效能...');

const testMetadata = {
    courseName: 'SPIKE 五 1610-1740 松山 第8週',
    date: '2025-01-17',
    studentName: '王小明',
    topic: '機器人課程',
    instructorName: '張老師'
};

const metaNormalizePerf = measureTime('normalize', () => {
    metadataTransformer.normalize(testMetadata);
}, 10000);
results.metadataProcessing.push(metaNormalizePerf);

const metaMergePerf = measureTime('merge', () => {
    metadataTransformer.merge(
        { semester: '114-1' },
        { courseName: 'SPIKE' },
        { date: '2025-01-17' }
    );
}, 10000);
results.metadataProcessing.push(metaMergePerf);

const metaValidatePerf = measureTime('validate', () => {
    metadataTransformer.validate(testMetadata);
}, 10000);
results.metadataProcessing.push(metaValidatePerf);

// ============================================
// 6. 批次處理效能測試
// ============================================
console.log('🔍 分析批次處理效能...');

const batchProcessPerf = measureTime('batchProcessing', () => {
    // 模擬完整的檔案上傳 metadata 處理流程
    const raw = {
        courseName: 'SPIKE 五 1610-1740 松山 第8週',
        date: new Date(),
        studentName: '學生' + Math.floor(Math.random() * 100),
        topic: '主題' + Math.floor(Math.random() * 10)
    };
    
    // 1. 標準化
    const normalized = metadataTransformer.normalize(raw);
    
    // 2. 清理課程名稱
    const cleanedCourseName = courseNameCleaner.cleanCourseName(normalized.courseName);
    
    // 3. 計算學期
    const semester = semesterHelper.getCurrentSemester(normalized.date);
    
    // 4. 格式化日期
    const formattedDate = dateFormatter.formatDateYYYYMMDD(normalized.date);
    
    // 5. 建構路徑
    pathHelper.buildPath({
        semester,
        courseName: cleanedCourseName,
        date: formattedDate,
        topic: normalized.topic,
        studentName: normalized.studentName
    });
}, 1000);
results.batchProcessing = batchProcessPerf;

// ============================================
// 7. 記憶體使用分析
// ============================================
console.log('🔍 分析記憶體使用...');

// 強制 GC（如果可用）
if (global.gc) {
    global.gc();
}

const memBefore = process.memoryUsage();

// 建立大量物件測試記憶體
const objects = [];
for (let i = 0; i < 1000; i++) {
    objects.push({
        metadata: metadataTransformer.normalize(testMetadata),
        path: pathHelper.buildPath({
            semester: '114-1',
            courseName: 'Test Course ' + i,
            date: '2025-01-17',
            topic: 'Topic ' + i,
            studentName: 'Student ' + i
        }),
        semester: semesterHelper.getCurrentSemester(),
        date: dateFormatter.formatDateYYYYMMDD(new Date())
    });
}

const memAfter = process.memoryUsage();

results.memoryUsage = {
    before: memBefore,
    after: memAfter,
    delta: {
        rss: (memAfter.rss - memBefore.rss) / 1024 / 1024, // MB
        heapUsed: (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024, // MB
        external: (memAfter.external - memBefore.external) / 1024 / 1024 // MB
    },
    objectsCreated: objects.length
};

// ============================================
// 8. 結果輸出
// ============================================
console.log('\n' + '='.repeat(60));
console.log('📊 效能分析報告');
console.log('='.repeat(60));

// 學期計算
console.log('\n📅 學期計算效能：');
results.semesterCalculation.forEach(r => {
    console.log(`  - ${r.name}: ${r.avgTime.toFixed(4)}ms/次 (${r.iterations}次測試)`);
});

// 日期格式化
console.log('\n📆 日期格式化效能：');
results.dateFormatting.forEach(r => {
    console.log(`  - ${r.name}: ${r.avgTime.toFixed(4)}ms/次 (${r.iterations}次測試)`);
});

// 課程名稱清理
console.log('\n🏷️ 課程名稱清理效能：');
results.courseNameCleaning.forEach(r => {
    console.log(`  - ${r.name}: ${r.avgTime.toFixed(4)}ms/次 (${r.iterations}次測試)`);
});

// 路徑建構
console.log('\n📁 路徑建構效能：');
results.pathBuilding.forEach(r => {
    console.log(`  - ${r.name}: ${r.avgTime.toFixed(4)}ms/次 (${r.iterations}次測試)`);
});

// Metadata 處理
console.log('\n🔄 Metadata 處理效能：');
results.metadataProcessing.forEach(r => {
    console.log(`  - ${r.name}: ${r.avgTime.toFixed(4)}ms/次 (${r.iterations}次測試)`);
});

// 批次處理
console.log('\n📦 批次處理效能：');
console.log(`  - 完整流程: ${results.batchProcessing.avgTime.toFixed(4)}ms/次 (${results.batchProcessing.iterations}次測試)`);

// 記憶體使用
console.log('\n💾 記憶體使用分析：');
console.log(`  - RSS 增加: ${results.memoryUsage.delta.rss.toFixed(2)} MB`);
console.log(`  - Heap 增加: ${results.memoryUsage.delta.heapUsed.toFixed(2)} MB`);
console.log(`  - External 增加: ${results.memoryUsage.delta.external.toFixed(2)} MB`);
console.log(`  - 建立物件數: ${results.memoryUsage.objectsCreated}`);

// ============================================
// 9. 效能評分
// ============================================
console.log('\n' + '='.repeat(60));
console.log('🎯 效能評分');
console.log('='.repeat(60));

// 計算平均效能
const allPerfs = [
    ...results.semesterCalculation,
    ...results.dateFormatting,
    ...results.courseNameCleaning,
    ...results.pathBuilding,
    ...results.metadataProcessing
];

const avgPerf = allPerfs.reduce((sum, r) => sum + r.avgTime, 0) / allPerfs.length;
const maxPerf = Math.max(...allPerfs.map(r => r.avgTime));
const minPerf = Math.min(...allPerfs.map(r => r.avgTime));

console.log(`平均執行時間: ${avgPerf.toFixed(4)}ms`);
console.log(`最快操作: ${minPerf.toFixed(4)}ms`);
console.log(`最慢操作: ${maxPerf.toFixed(4)}ms`);

// 效能等級評定
let grade = 'A';
if (avgPerf > 1) grade = 'B';
if (avgPerf > 5) grade = 'C';
if (avgPerf > 10) grade = 'D';
if (avgPerf > 50) grade = 'F';

console.log(`\n效能等級: ${grade}`);

// 效能建議
console.log('\n💡 優化建議：');
if (maxPerf > 10) {
    console.log('  ⚠️ 發現某些操作超過 10ms，建議進行優化');
}
if (results.memoryUsage.delta.heapUsed > 10) {
    console.log('  ⚠️ 記憶體使用增長較大，建議檢查是否有洩漏');
}
if (avgPerf < 1) {
    console.log('  ✅ 整體效能優秀，所有操作都在 1ms 以內');
}

// ============================================
// 10. 輸出報告檔案
// ============================================
const reportPath = path.join(__dirname, 'performance-report.json');
const report = {
    timestamp: new Date().toISOString(),
    summary: {
        avgPerformance: avgPerf,
        maxPerformance: maxPerf,
        minPerformance: minPerf,
        grade: grade,
        memoryUsage: results.memoryUsage.delta
    },
    details: results
};

fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\n📊 詳細報告已儲存至: ${reportPath}`);

// 結束
console.log('\n✅ 效能分析完成！');
process.exit(0);
