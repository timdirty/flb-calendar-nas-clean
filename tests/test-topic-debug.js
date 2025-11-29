/**
 * Topic 生成調試測試
 */

const {
    deriveTopicFromCourseName,
    sanitizeTopicForPath
} = require('../utils/course-topic-helper');

const testCases = [
    '[代課] MINECRAFT 二 11:00-12:00 第7週',
    'MINECRAFT 二 11:00-12:00 第7週',
    '[改時間] SPM 三 16:30-17:30 第12週',
    'SPM 三 16:30-17:30 第12週'
];

console.log('🔍 調試 Topic 生成\n');
console.log('=' .repeat(80));

for (const testInput of testCases) {
    const result = deriveTopicFromCourseName(testInput);
    console.log(`\n輸入: ${testInput}`);
    console.log(`輸出: ${result}`);
    console.log(`長度: ${result.length}`);
}

console.log('\n' + '='.repeat(80));
console.log('\n驗證一致性:');

const pair1 = deriveTopicFromCourseName(testCases[0]);
const pair2 = deriveTopicFromCourseName(testCases[1]);
console.log(`\nMINECRAFT 有 [代課]: "${pair1}"`);
console.log(`MINECRAFT 無標記:   "${pair2}"`);
console.log(`一致性: ${pair1 === pair2 ? '✅ 相同' : '❌ 不同'}`);

const pair3 = deriveTopicFromCourseName(testCases[2]);
const pair4 = deriveTopicFromCourseName(testCases[3]);
console.log(`\nSPM 有 [改時間]: "${pair3}"`);
console.log(`SPM 無標記:      "${pair4}"`);
console.log(`一致性: ${pair3 === pair4 ? '✅ 相同' : '❌ 不同'}`);
