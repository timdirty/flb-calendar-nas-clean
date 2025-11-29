/**
 * Topic 生成一致性測試
 * 驗證 [代課] MINECRAFT 與 MINECRAFT 是否產生相同的 topic
 */

const DrivePathManager = require('../drive-path-manager');
const { deriveTopicFromCourseName } = require('../utils/course-topic-helper');

console.log('🧪 測試 Topic 生成一致性\n');

const testCases = [
    {
        name: '代課標記的 MINECRAFT 課程',
        input: '[代課] MINECRAFT 二 11:00-12:00 第7週'
    },
    {
        name: '無標記的 MINECRAFT 課程',
        input: 'MINECRAFT 二 11:00-12:00 第7週'
    },
    {
        name: '改時間標記的 SPM 課程',
        input: '[改時間] SPM 三 16:30-17:30 第12週'
    },
    {
        name: '無標記的 SPM 課程',
        input: 'SPM 三 16:30-17:30 第12週'
    },
    {
        name: '體驗標記的 SPIKE 課程',
        input: '[體驗] SPIKE 五 16:10-17:40 第1週'
    },
    {
        name: '無標記的 SPIKE 課程',
        input: 'SPIKE 五 16:10-17:40 第1週'
    }
];

console.log('═'.repeat(80));
console.log('1️⃣ 測試 utils/course-topic-helper.js 的 deriveTopicFromCourseName');
console.log('═'.repeat(80));

const helperResults = [];
for (const testCase of testCases) {
    const topic = deriveTopicFromCourseName(testCase.input);
    helperResults.push({ name: testCase.name, input: testCase.input, topic });
    console.log(`\n📝 ${testCase.name}`);
    console.log(`   輸入: ${testCase.input}`);
    console.log(`   Topic: ${topic}`);
}

console.log('\n' + '═'.repeat(80));
console.log('2️⃣ 測試 drive-path-manager.js 的 deriveTopicFromCourseName');
console.log('═'.repeat(80));

const pathManager = new DrivePathManager();
const managerResults = [];
for (const testCase of testCases) {
    const topic = pathManager.deriveTopicFromCourseName(testCase.input);
    managerResults.push({ name: testCase.name, input: testCase.input, topic });
    console.log(`\n📝 ${testCase.name}`);
    console.log(`   輸入: ${testCase.input}`);
    console.log(`   Topic: ${topic}`);
}

console.log('\n' + '═'.repeat(80));
console.log('3️⃣ 一致性驗證');
console.log('═'.repeat(80));

let allPassed = true;

// 驗證配對課程的 topic 是否相同
const pairs = [
    { indices: [0, 1], description: 'MINECRAFT 課程（有/無 [代課]）' },
    { indices: [2, 3], description: 'SPM 課程（有/無 [改時間]）' },
    { indices: [4, 5], description: 'SPIKE 課程（有/無 [體驗]）' }
];

for (const pair of pairs) {
    const [idx1, idx2] = pair.indices;
    
    const helperTopic1 = helperResults[idx1].topic;
    const helperTopic2 = helperResults[idx2].topic;
    const helperMatch = helperTopic1 === helperTopic2;
    
    const managerTopic1 = managerResults[idx1].topic;
    const managerTopic2 = managerResults[idx2].topic;
    const managerMatch = managerTopic1 === managerTopic2;
    
    const crossMatch = helperTopic1 === managerTopic1 && helperTopic2 === managerTopic2;
    
    console.log(`\n✅ ${pair.description}`);
    console.log(`   course-topic-helper: ${helperMatch ? '✅ 一致' : '❌ 不一致'} (${helperTopic1} vs ${helperTopic2})`);
    console.log(`   drive-path-manager:  ${managerMatch ? '✅ 一致' : '❌ 不一致'} (${managerTopic1} vs ${managerTopic2})`);
    console.log(`   交叉驗證:            ${crossMatch ? '✅ 一致' : '❌ 不一致'}`);
    
    if (!helperMatch || !managerMatch || !crossMatch) {
        allPassed = false;
    }
}

console.log('\n' + '═'.repeat(80));
console.log('4️⃣ 完整路徑測試');
console.log('═'.repeat(80));

const pathTests = [
    {
        params: {
            semester: '2025上學期',
            courseName: '[代課] MINECRAFT 二 11:00-12:00 第7週',
            date: '2025-11-25',
            topic: null, // 讓系統自動推導
            studentName: 'c'
        },
        description: '有 [代課] 標記的課程'
    },
    {
        params: {
            semester: '2025上學期',
            courseName: 'MINECRAFT 二 11:00-12:00 第7週',
            date: '2025-11-25',
            topic: null, // 讓系統自動推導
            studentName: 'c'
        },
        description: '無標記的課程'
    }
];

const paths = [];
for (const test of pathTests) {
    const fullPath = pathManager.buildPath(test.params);
    paths.push({ description: test.description, path: fullPath });
    console.log(`\n📂 ${test.description}`);
    console.log(`   路徑: ${fullPath}`);
}

// 驗證兩個路徑是否相同
const pathMatch = paths[0].path === paths[1].path;
console.log(`\n路徑一致性: ${pathMatch ? '✅ 相同' : '❌ 不同'}`);
if (!pathMatch) {
    console.log(`   有標記: ${paths[0].path}`);
    console.log(`   無標記: ${paths[1].path}`);
    allPassed = false;
}

console.log('\n' + '═'.repeat(80));
console.log(`📊 最終結果: ${allPassed ? '✅ 所有測試通過' : '❌ 有測試失敗'}`);
console.log('═'.repeat(80));

process.exit(allPassed ? 0 : 1);
