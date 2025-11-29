/**
 * 🧪 特殊課程名稱處理測試
 * 測試代課、改時間等特殊事件的課程名稱清理
 */

const { cleanCourseName } = require('../utils/course-name-cleaner');

function testSpecialCourseNames() {
    console.log('🧪 測試特殊課程名稱處理...\n');

    const testCases = [
        // 代課事件
        {
            input: '［代課] MINECRAFT 二11:00-12:00第7週',
            expected: 'MINECRAFT 二 1100-1200',
            description: '代課事件 + 全形方括號 + 時間冒號 + 週次'
        },
        {
            input: '[代課] SPM 三 16:30-18:00 第5週',
            expected: 'SPM 三 1630-1800',
            description: '代課事件 + 半形方括號 + 時間冒號 + 週次'
        },
        {
            input: '［代課］BOOST 四15:30-17:00到府',
            expected: 'BOOST 四 1530-1700到府',
            description: '代課事件（無週次）'
        },
        
        // 改時間事件
        {
            input: '［改時間] SPIKE 五 16:10-17:40 第8週',
            expected: 'SPIKE 五 1610-1740',
            description: '改時間事件'
        },
        {
            input: '[改時間] ESM 四 17:30-18:30 到府',
            expected: 'ESM 四 1730-1830 到府',
            description: '改時間事件（到府）'
        },
        
        // 停課事件
        {
            input: '［停課] SPM 二 14:30-15:30',
            expected: 'SPM 二 1430-1530',
            description: '停課事件'
        },
        
        // 體驗課
        {
            input: '［體驗] SPIKE PRO 日 10:00-12:00 第3週',
            expected: 'SPIKE PRO 日 1000-1200',
            description: '體驗課事件'
        },
        
        // 複合標記
        {
            input: '［代課］［改時間] MINECRAFT 三 18:00-19:30 第6週',
            expected: 'MINECRAFT 三 1800-1930',
            description: '多個標記'
        },
        
        // 正常課程（對照組）
        {
            input: 'SPIKE 五 16:10-17:40 松山 第8週',
            expected: 'SPIKE 五 1610-1740 松山',
            description: '正常課程（無特殊標記）'
        },
        
        // 邊界情況
        {
            input: '   ［代課]   MINECRAFT 二11:00-12:00第7週   ',
            expected: 'MINECRAFT 二 1100-1200',
            description: '前後多餘空白'
        },
        {
            input: '',
            expected: '',
            description: '空字串'
        },
        {
            input: null,
            expected: '',
            description: 'null 值'
        }
    ];

    let passed = 0;
    let total = testCases.length;

    testCases.forEach((testCase, index) => {
        const result = cleanCourseName(testCase.input);
        const success = result === testCase.expected;
        
        console.log(`${index + 1}. ${testCase.description}`);
        console.log(`   輸入: "${testCase.input}"`);
        console.log(`   預期: "${testCase.expected}"`);
        console.log(`   結果: "${result}"`);
        console.log(`   ${success ? '✅ 通過' : '❌ 失敗'}`);
        console.log('');
        
        if (success) passed++;
    });

    console.log(`📊 測試結果: ${passed}/${total} 通過`);
    
    if (passed === total) {
        console.log('🎉 所有測試通過！特殊課程名稱處理正常');
    } else {
        console.log('⚠️ 有測試失敗，需要檢查清理邏輯');
    }

    return passed === total;
}

// 測試索引 key 生成
function testIndexKeyGeneration() {
    console.log('\n🔑 測試索引 key 生成...\n');

    const { buildCourseKey } = require('../utils/learning-records-index');

    const testCases = [
        {
            semester: '2025上學期',
            courseName: '［代課] MINECRAFT 二11:00-12:00第7週',
            date: '2025-11-27',
            topic: '機器人程式設計',
            expectedKey: '2025上學期::MINECRAFT 二 1100-1200::2025-11-27::機器人程式設計'
        },
        {
            semester: '2025上學期',
            courseName: '[改時間] SPIKE 五 16:10-17:40 第8週',
            date: '2025-11-28',
            topic: '',
            expectedKey: '2025上學期::SPIKE 五 1610-1740::2025-11-28::'
        }
    ];

    let passed = 0;
    let total = testCases.length;

    testCases.forEach((testCase, index) => {
        // 注意：buildCourseKey 內部不會自動清理課程名稱，需要外部清理
        const { cleanCourseName } = require('../utils/course-name-cleaner');
        const cleanedCourseName = cleanCourseName(testCase.courseName);
        
        const result = buildCourseKey(
            testCase.semester,
            cleanedCourseName,
            testCase.date,
            testCase.topic
        );
        
        const success = result === testCase.expectedKey;
        
        console.log(`${index + 1}. 索引 key 測試`);
        console.log(`   原始課程: "${testCase.courseName}"`);
        console.log(`   清理課程: "${cleanedCourseName}"`);
        console.log(`   預期 key: "${testCase.expectedKey}"`);
        console.log(`   結果 key: "${result}"`);
        console.log(`   ${success ? '✅ 通過' : '❌ 失敗'}`);
        console.log('');
        
        if (success) passed++;
    });

    console.log(`📊 索引 key 測試結果: ${passed}/${total} 通過`);
    
    return passed === total;
}

// 執行所有測試
if (require.main === module) {
    console.log('🚀 開始特殊課程名稱完整測試\n');
    console.log('=' .repeat(60));
    
    const nameTestPassed = testSpecialCourseNames();
    const keyTestPassed = testIndexKeyGeneration();
    
    console.log('\n' + '=' .repeat(60));
    console.log('📋 最終結果:');
    console.log(`   課程名稱清理: ${nameTestPassed ? '✅' : '❌'}`);
    console.log(`   索引 key 生成: ${keyTestPassed ? '✅' : '❌'}`);
    console.log(`   整體狀態: ${nameTestPassed && keyTestPassed ? '🎉 全部通過' : '⚠️ 有失敗項目'}`);
}

module.exports = {
    testSpecialCourseNames,
    testIndexKeyGeneration
};
