/**
 * 快速路徑檢查 - 測試課程名稱路徑轉換
 */

const path = require('path');

// 添加 drive-path-manager
const DrivePathManager = require('../drive-path-manager');
const drivePathManager = new DrivePathManager({
    driveRoot: '/Fun Learn Bar/FLB-Learning-Portfolio'
});

// 測試案例：不同的課程名稱格式
const TEST_COURSES = [
    {
        name: 'SPIKE 五 16:10-17:40 松山',
        expectedPath: 'SPIKE 五 1610-1740 松山',
        description: 'SPIKE 課程（松山）'
    },
    {
        name: 'ESM 四 17:30-18:30 到府',
        expectedPath: 'ESM 四 1730-1830 到府',
        description: 'ESM 課程（到府）'
    },
    {
        name: 'BOOST 六 15:30-17:00 到府',
        expectedPath: 'BOOST 六 1530-1700 到府',
        description: 'BOOST 課程'
    },
    {
        name: 'EV3 三 18:30-20:00 松山',
        expectedPath: 'EV3 三 1830-2000 松山',
        description: 'EV3 課程'
    },
    {
        name: 'MINECRAFT 日 10:00-11:30 內湖',
        expectedPath: 'MINECRAFT 日 1000-1130 內湖',
        description: 'MINECRAFT 課程'
    },
    {
        name: 'SPIKE 五 16:10',
        expectedPath: 'SPIKE 五 1610',
        description: '不完整課程名稱（缺少結束時間和地點）'
    }
];

console.log('\n' + '='.repeat(70));
console.log('🔍 課程名稱路徑轉換測試');
console.log('測試 drive-path-manager 的 sanitizeComponent 功能');
console.log('='.repeat(70));

console.log('\n📚 測試課程名稱轉換：\n');

let passCount = 0;
let failCount = 0;

for (const course of TEST_COURSES) {
    // 使用 sanitizeComponent 轉換課程名稱
    const sanitized = drivePathManager.sanitizeComponent(course.name);
    
    // 建立完整路徑
    const fullPath = drivePathManager.buildPath({
        semester: '114-1',
        courseName: course.name,
        date: '2025-11-17',
        topic: '測試主題',
        studentName: '測試學生'
    });
    
    // 檢查是否正確轉換
    const isCorrect = sanitized === course.expectedPath;
    const status = isCorrect ? '✅' : '❌';
    
    console.log(`${status} ${course.description}`);
    console.log(`   原始: ${course.name}`);
    console.log(`   預期: ${course.expectedPath}`);
    console.log(`   實際: ${sanitized}`);
    console.log(`   完整路徑: ${fullPath}`);
    console.log('');
    
    if (isCorrect) {
        passCount++;
    } else {
        failCount++;
    }
}

// 測試實際路徑建立
console.log('='.repeat(70));
console.log('📁 測試完整路徑建立：\n');

const testParams = {
    semester: '114-1',
    courseName: 'SPIKE 五 16:10-17:40 松山',
    date: '2025-11-17',
    topic: '機器人專題',
    studentName: '王小明'
};

const builtPath = drivePathManager.buildPath(testParams);
const expectedFullPath = '/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE 五 1610-1740 松山/2025-11-17 機器人專題/王小明';

console.log('測試參數:');
console.log(`  學期: ${testParams.semester}`);
console.log(`  課程: ${testParams.courseName}`);
console.log(`  日期: ${testParams.date}`);
console.log(`  主題: ${testParams.topic}`);
console.log(`  學生: ${testParams.studentName}`);
console.log('');
console.log('建立的路徑:');
console.log(`  ${builtPath}`);
console.log('');
console.log('預期的路徑:');
console.log(`  ${expectedFullPath}`);
console.log('');

const pathCorrect = builtPath === expectedFullPath;
console.log(pathCorrect ? '✅ 路徑建立正確！' : '❌ 路徑建立錯誤！');

// 總結
console.log('\n' + '='.repeat(70));
console.log('📊 測試結果總結');
console.log('='.repeat(70));
console.log(`課程名稱轉換: ${passCount} 通過 / ${failCount} 失敗`);
console.log(`路徑建立測試: ${pathCorrect ? '✅ 通過' : '❌ 失敗'}`);

if (failCount === 0 && pathCorrect) {
    console.log('\n🎉 所有測試通過！課程名稱會正確轉換到對應的資料夾路徑。');
} else {
    console.log('\n⚠️ 有測試失敗，請檢查上方的錯誤訊息。');
}

console.log('='.repeat(70) + '\n');

process.exit(failCount === 0 && pathCorrect ? 0 : 1);
