/**
 * 🧪 完整的 Topic 生成邊界條件測試
 * 涵蓋所有特殊情況與邊界條件
 */

const DrivePathManager = require('../drive-path-manager');
const { 
    deriveTopicFromCourseName,
    extractCourseTopicForPath,
    sanitizeTopicForPath
} = require('../utils/course-topic-helper');

console.log('🧪 完整邊界條件與特殊情況測試\n');
console.log('═'.repeat(80));

// ============================================
// 測試分類
// ============================================

const testSuites = {
    // 1. 特殊事件標記測試
    specialMarkers: [
        {
            category: '特殊事件標記',
            cases: [
                { input: '[代課] MINECRAFT 二 11:00-12:00', expected: 'MINECRAFT', desc: '代課標記' },
                { input: '[改時間] SPM 三 16:30-17:30', expected: 'SPM', desc: '改時間標記' },
                { input: '[體驗] SPIKE 五 16:10-17:40', expected: 'SPIKE', desc: '體驗標記' },
                { input: '[停課] PYTHON 一 18:00-19:30', expected: 'PYTHON', desc: '停課標記' },
                { input: '代課 MINECRAFT 二 11:00-12:00', expected: 'MINECRAFT', desc: '無中括號代課' },
                { input: '[代課][改時間] SPM 三 16:30', expected: 'SPM', desc: '多重標記' },
                { input: '   [代課]   MINECRAFT 二 11:00', expected: 'MINECRAFT', desc: '標記前後有空白' },
                { input: '[]MINECRAFT 二 11:00-12:00', expected: 'MINECRAFT', desc: '空中括號' },
                { input: '[   ] MINECRAFT 二 11:00', expected: 'MINECRAFT', desc: '中括號內只有空白' }
            ]
        }
    ],

    // 2. 時間格式測試
    timeFormats: [
        {
            category: '時間格式',
            cases: [
                { input: 'MINECRAFT 二 11:00-12:00', expected: 'MINECRAFT', desc: '冒號格式' },
                { input: 'MINECRAFT 二 1100-1200', expected: 'MINECRAFT', desc: '無冒號格式' },
                { input: 'SPM 三 16:30-17:30', expected: 'SPM', desc: '含分鐘的時間' },
                { input: 'SPIKE 五 9:00-10:30', expected: 'SPIKE', desc: '單數小時' },
                { input: 'EV3 一 18:00-20:00', expected: 'EV3', desc: '跨兩小時' },
                { input: 'PYTHON 四 14:00-15:00', expected: 'PYTHON', desc: '下午時段' }
            ]
        }
    ],

    // 3. 星期與時段組合
    weekdayPatterns: [
        {
            category: '星期與時段',
            cases: [
                { input: 'MINECRAFT 一 11:00-12:00', expected: 'MINECRAFT', desc: '星期一' },
                { input: 'MINECRAFT 日 11:00-12:00', expected: 'MINECRAFT', desc: '星期日' },
                { input: 'MINECRAFT 六 11:00-12:00', expected: 'MINECRAFT', desc: '星期六' },
                { input: 'MINECRAFT 11:00-12:00', expected: 'MINECRAFT', desc: '無星期' },
                { input: 'MINECRAFT二11:00-12:00', expected: 'MINECRAFT', desc: '無空白' },
                { input: 'MINECRAFT  二  11:00-12:00', expected: 'MINECRAFT', desc: '多個空白' }
            ]
        }
    ],

    // 4. 課程前綴測試
    coursePrefixes: [
        {
            category: '課程前綴',
            cases: [
                { input: 'SPIKE 三 18:30-20:30', expected: 'SPIKE', desc: 'SPIKE 課程' },
                { input: 'SPM 三 16:30-17:30', expected: 'SPM', desc: 'SPM 課程' },
                { input: 'ESM 五 10:00-11:30', expected: 'ESM', desc: 'ESM 課程' },
                { input: 'BOOST 二 14:00-15:30', expected: 'BOOST', desc: 'BOOST 課程' },
                { input: 'EV3 四 16:00-17:30', expected: 'EV3', desc: 'EV3 課程' },
                { input: 'MINECRAFT 二 11:00-12:00', expected: 'MINECRAFT', desc: 'MINECRAFT 課程' },
                { input: 'SCRATCH 三 13:00-14:30', expected: 'SCRATCH', desc: 'SCRATCH 課程' },
                { input: 'PYTHON 一 18:00-19:30', expected: 'PYTHON', desc: 'PYTHON 課程' },
                { input: 'spike 三 18:30-20:30', expected: 'spike', desc: '小寫 spike' },
                { input: 'Minecraft 二 11:00-12:00', expected: 'Minecraft', desc: '混合大小寫' }
            ]
        }
    ],

    // 5. 週次標記測試
    weekNumbers: [
        {
            category: '週次標記',
            cases: [
                { input: 'MINECRAFT 二 11:00-12:00 第7週', expected: 'MINECRAFT', desc: '第N週' },
                { input: 'SPM 三 16:30-17:30 第12週', expected: 'SPM', desc: '雙位數週次' },
                { input: 'SPIKE 五 16:10-17:40 第1週', expected: 'SPIKE', desc: '第一週' },
                { input: 'PYTHON 一 18:00-19:30 week 5', expected: 'PYTHON', desc: 'week N' },
                { input: 'EV3 四 14:00-15:30 W8', expected: 'EV3', desc: 'W8 格式' },
                { input: 'BOOST 二 10:00-11:30 週3', expected: 'BOOST', desc: '週N 格式' }
            ]
        }
    ],

    // 6. 空值與特殊字元
    edgeCases: [
        {
            category: '邊界條件',
            cases: [
                { input: '', expected: '', desc: '空字串' },
                { input: '   ', expected: '', desc: '只有空白' },
                { input: '[代課]', expected: '', desc: '只有標記' },
                { input: '二 11:00-12:00', expected: '', desc: '只有時間無課程' },
                { input: '第7週', expected: '', desc: '只有週次' },
                { input: 'MINECRAFT', expected: 'MINECRAFT', desc: '只有課程名' },
                { input: 'A', expected: '', desc: '單字母（太短）' },
                { input: 'AB', expected: 'AB', desc: '兩字母（最小長度）' }
            ]
        }
    ],

    // 7. 複雜組合
    complexCases: [
        {
            category: '複雜組合',
            cases: [
                { 
                    input: '[代課] MINECRAFT 二 11:00-12:00 第7週 - 張老師', 
                    expected: 'MINECRAFT', 
                    desc: '完整格式含講師' 
                },
                { 
                    input: '[改時間] SPM 三 16:30-17:30 第12週 松山校區', 
                    expected: 'SPM', 
                    desc: '含校區資訊' 
                },
                { 
                    input: 'SPIKE 五 1610-1740 第1週', 
                    expected: 'SPIKE', 
                    desc: '無冒號+週次' 
                },
                {
                    input: '[體驗] [代課] MINECRAFT 二 11:00-12:00',
                    expected: 'MINECRAFT',
                    desc: '多個中括號標記'
                },
                {
                    input: 'MINECRAFT   二   11:00-12:00   第7週',
                    expected: 'MINECRAFT',
                    desc: '多個空白字元'
                }
            ]
        }
    ],

    // 8. 一致性測試（有/無標記）
    consistencyPairs: [
        {
            category: '一致性配對',
            pairs: [
                {
                    with: '[代課] MINECRAFT 二 11:00-12:00 第7週',
                    without: 'MINECRAFT 二 11:00-12:00 第7週',
                    desc: 'MINECRAFT 代課'
                },
                {
                    with: '[改時間] SPM 三 16:30-17:30 第12週',
                    without: 'SPM 三 16:30-17:30 第12週',
                    desc: 'SPM 改時間'
                },
                {
                    with: '[體驗] SPIKE 五 16:10-17:40 第1週',
                    without: 'SPIKE 五 16:10-17:40 第1週',
                    desc: 'SPIKE 體驗'
                },
                {
                    with: '[停課] PYTHON 一 18:00-19:30',
                    without: 'PYTHON 一 18:00-19:30',
                    desc: 'PYTHON 停課'
                }
            ]
        }
    ]
};

// ============================================
// 測試執行器
// ============================================

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function runTestCase(testCase, category) {
    totalTests++;
    const result = deriveTopicFromCourseName(testCase.input);
    const passed = result === testCase.expected;
    
    if (passed) {
        passedTests++;
        console.log(`  ✅ ${testCase.desc}`);
        console.log(`     輸入: "${testCase.input}"`);
        console.log(`     期望: "${testCase.expected}" | 實際: "${result}"`);
    } else {
        failedTests.push({ category, ...testCase, actual: result });
        console.log(`  ❌ ${testCase.desc}`);
        console.log(`     輸入: "${testCase.input}"`);
        console.log(`     期望: "${testCase.expected}" | 實際: "${result}" ⚠️`);
    }
}

function runConsistencyTest(pair, category) {
    const resultWith = deriveTopicFromCourseName(pair.with);
    const resultWithout = deriveTopicFromCourseName(pair.without);
    const passed = resultWith === resultWithout;
    
    totalTests++;
    if (passed) {
        passedTests++;
        console.log(`  ✅ ${pair.desc} - 一致性`);
        console.log(`     有標記: "${pair.with}" → "${resultWith}"`);
        console.log(`     無標記: "${pair.without}" → "${resultWithout}"`);
    } else {
        failedTests.push({ 
            category, 
            desc: `${pair.desc} - 一致性不符`,
            with: pair.with,
            without: pair.without,
            resultWith,
            resultWithout
        });
        console.log(`  ❌ ${pair.desc} - 一致性不符 ⚠️`);
        console.log(`     有標記: "${pair.with}" → "${resultWith}"`);
        console.log(`     無標記: "${pair.without}" → "${resultWithout}"`);
    }
}

// ============================================
// 執行所有測試
// ============================================

// 1-7: 單一測試案例
for (const [key, suites] of Object.entries(testSuites)) {
    if (key === 'consistencyPairs') continue; // 稍後處理
    
    for (const suite of suites) {
        console.log(`\n${'─'.repeat(80)}`);
        console.log(`📋 ${suite.category}`);
        console.log('─'.repeat(80));
        
        for (const testCase of suite.cases) {
            runTestCase(testCase, suite.category);
        }
    }
}

// 8: 一致性配對測試
console.log(`\n${'─'.repeat(80)}`);
console.log(`📋 一致性配對測試`);
console.log('─'.repeat(80));

for (const suite of testSuites.consistencyPairs) {
    for (const pair of suite.pairs) {
        runConsistencyTest(pair, suite.category);
    }
}

// ============================================
// 完整路徑生成測試
// ============================================

console.log(`\n${'═'.repeat(80)}`);
console.log(`🔨 完整路徑生成測試`);
console.log('═'.repeat(80));

const pathManager = new DrivePathManager();
const pathTests = [
    {
        params: {
            semester: '2025上學期',
            courseName: '[代課] MINECRAFT 二 11:00-12:00 第7週',
            date: '2025-11-25',
            topic: null,
            studentName: 'c'
        },
        expectedTopic: 'MINECRAFT'
    },
    {
        params: {
            semester: '2025上學期',
            courseName: 'MINECRAFT 二 11:00-12:00 第7週',
            date: '2025-11-25',
            topic: null,
            studentName: 'c'
        },
        expectedTopic: 'MINECRAFT'
    }
];

let pathTestPassed = true;
const paths = [];

for (const test of pathTests) {
    const fullPath = pathManager.buildPath(test.params);
    paths.push(fullPath);
    
    // 驗證路徑是否包含正確的 topic
    const includesTopic = fullPath.includes(`2025-11-25 ${test.expectedTopic}`);
    
    console.log(`\n課程: ${test.params.courseName}`);
    console.log(`路徑: ${fullPath}`);
    console.log(`Topic 正確: ${includesTopic ? '✅' : '❌'}`);
    
    if (!includesTopic) {
        pathTestPassed = false;
        totalTests++;
    } else {
        totalTests++;
        passedTests++;
    }
}

// 驗證兩個路徑是否相同
console.log(`\n路徑一致性檢查:`);
console.log(`路徑 1: ${paths[0]}`);
console.log(`路徑 2: ${paths[1]}`);
console.log(`一致性: ${paths[0] === paths[1] ? '✅ 相同' : '❌ 不同'}`);

if (paths[0] !== paths[1]) {
    pathTestPassed = false;
}

// ============================================
// 測試結果總結
// ============================================

console.log(`\n${'═'.repeat(80)}`);
console.log(`📊 測試結果總結`);
console.log('═'.repeat(80));

console.log(`\n總測試數: ${totalTests}`);
console.log(`通過: ${passedTests} ✅`);
console.log(`失敗: ${failedTests.length} ${failedTests.length > 0 ? '❌' : '✅'}`);
console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(2)}%`);

if (failedTests.length > 0) {
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`❌ 失敗案例詳情`);
    console.log('═'.repeat(80));
    
    for (const fail of failedTests) {
        console.log(`\n類別: ${fail.category}`);
        console.log(`描述: ${fail.desc}`);
        if (fail.input) {
            console.log(`輸入: "${fail.input}"`);
            console.log(`期望: "${fail.expected}"`);
            console.log(`實際: "${fail.actual}"`);
        } else {
            console.log(`有標記: "${fail.with}" → "${fail.resultWith}"`);
            console.log(`無標記: "${fail.without}" → "${fail.resultWithout}"`);
        }
    }
}

console.log(`\n${'═'.repeat(80)}`);
console.log(`🎯 最終結論: ${failedTests.length === 0 && pathTestPassed ? '✅ 所有測試通過' : '❌ 有測試失敗'}`);
console.log('═'.repeat(80));

process.exit(failedTests.length === 0 && pathTestPassed ? 0 : 1);
