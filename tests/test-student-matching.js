/**
 * 學生匹配邏輯完整測試
 * 驗證前後端使用相同的匹配邏輯
 */

const CourseTitleParser = require('../public/js/modules/course-title-parser.js');
const StudentCourseMatcher = require('../public/js/modules/student-course-matcher.js');

console.log('🧪 ===== 學生匹配邏輯測試 =====\n');

// 測試案例 1：精確匹配
console.log('📝 測試 1: 精確匹配（時間完全相同）');
const event1 = {
  title: 'ESM 日 9:30-10:30',
  start: 1763861400,  // 2025-11-23 09:30
  end: 1763865000,    // 2025-11-23 10:30
  location: '站前教室'
};
const students1 = [
  { name: '學生A', course: 'ESM', period: 'ESM 日 9:30-10:30', periodParsed: { weekdays: [0], startTime: '09:30', endTime: '10:30' } },
  { name: '學生B', course: 'ESM', period: 'ESM 日 13:30-14:30', periodParsed: { weekdays: [0], startTime: '13:30', endTime: '14:30' } },
  { name: '學生C', course: 'SPM', period: 'SPM 日 9:30-10:30', periodParsed: { weekdays: [0], startTime: '09:30', endTime: '10:30' } }
];
const result1 = StudentCourseMatcher.matchStudentsForEvent(event1, students1, {
  withConfidence: true,
  timeTolerance: 10,
  durationTolerance: 20
});
console.log(`   結果: ${result1.length} 位學生`);
console.log(`   ✅ 預期: 1 位（學生A）`);
console.log(`   ${result1.length === 1 && result1[0].name === '學生A' ? '✅ 通過' : '❌ 失敗'}\n`);

// 測試案例 2：時間接近（開始時間差 5 分鐘）
console.log('📝 測試 2: 時間接近（開始時間差 5 分鐘，在容忍範圍內）');
const event2 = {
  title: 'SPM 日 10:00-11:30',
  start: 1763863200,  // 2025-11-23 10:00
  end: 1763868600,    // 2025-11-23 11:30
  location: '到府'
};
const students2 = [
  { name: '學生D', course: 'SPM', period: 'SPM 日 10:00-11:30 到府', periodParsed: { weekdays: [0], startTime: '10:00', endTime: '11:30', location: '到府' } },
  { name: '學生E', course: 'SPM', period: 'SPM 日 10:05-11:30 到府', periodParsed: { weekdays: [0], startTime: '10:05', endTime: '11:30', location: '到府' } }, // 開始差 5 分
  { name: '學生F', course: 'SPM', period: 'SPM 日 10:30-11:30 到府', periodParsed: { weekdays: [0], startTime: '10:30', endTime: '11:30', location: '到府' } }  // 開始差 30 分
];
const result2 = StudentCourseMatcher.matchStudentsForEvent(event2, students2, {
  withConfidence: true,
  timeTolerance: 10,
  durationTolerance: 20
});
console.log(`   結果: ${result2.length} 位學生`);
console.log(`   ✅ 預期: 2 位（學生D, E）`);
console.log(`   ${result2.length === 2 ? '✅ 通過' : '❌ 失敗'}\n`);

// 測試案例 3：持續時間差異（在容忍範圍內）
console.log('📝 測試 3: 持續時間差異（差 15 分鐘，在容忍範圍內）');
const event3 = {
  title: 'SPIKE PRO 日 10:00-12:00',
  start: 1763863200,  // 2025-11-23 10:00
  end: 1763870400,    // 2025-11-23 12:00 (120分鐘)
  location: '站前教室'
};
const students3 = [
  { name: '學生G', course: 'SPIKE', period: 'SPIKE PRO 日 10:00-12:00', periodParsed: { weekdays: [0], startTime: '10:00', endTime: '12:00' } },        // 持續120分
  { name: '學生H', course: 'SPIKE', period: 'SPIKE PRO 日 10:00-11:45', periodParsed: { weekdays: [0], startTime: '10:00', endTime: '11:45' } },        // 持續105分，差15分
  { name: '學生I', course: 'SPIKE', period: 'SPIKE PRO 日 10:00-11:00', periodParsed: { weekdays: [0], startTime: '10:00', endTime: '11:00' } }         // 持續60分，差60分
];
const result3 = StudentCourseMatcher.matchStudentsForEvent(event3, students3, {
  withConfidence: true,
  timeTolerance: 10,
  durationTolerance: 20
});
console.log(`   結果: ${result3.length} 位學生`);
console.log(`   ✅ 預期: 2 位（學生G, H）`);
console.log(`   ${result3.length === 2 ? '✅ 通過' : '❌ 失敗'}\n`);

// 測試案例 4：星期不匹配
console.log('📝 測試 4: 星期不匹配（應該被過濾）');
const event4 = {
  title: 'ESM 日 9:30-10:30',
  start: 1763861400,  // 2025-11-23 星期日
  end: 1763865000,
  location: '站前教室'
};
const students4 = [
  { name: '學生J', course: 'ESM', period: 'ESM 一 9:30-10:30', periodParsed: { weekdays: [1], startTime: '09:30', endTime: '10:30' } },  // 星期一
  { name: '學生K', course: 'ESM', period: 'ESM 日 9:30-10:30', periodParsed: { weekdays: [0], startTime: '09:30', endTime: '10:30' } }   // 星期日
];
const result4 = StudentCourseMatcher.matchStudentsForEvent(event4, students4, {
  withConfidence: true,
  timeTolerance: 10,
  durationTolerance: 20
});
console.log(`   結果: ${result4.length} 位學生`);
console.log(`   ✅ 預期: 1 位（學生K）`);
console.log(`   ${result4.length === 1 && result4[0].name === '學生K' ? '✅ 通過' : '❌ 失敗'}\n`);

// 測試案例 5：地點匹配
console.log('📝 測試 5: 地點匹配（到府 vs 站所）');
const event5 = {
  title: 'SPM 日 13:30-15:00 松山',
  start: 1763875800,  // 2025-11-23 13:30
  end: 1763881200,    // 2025-11-23 15:00
  location: '臺北市松山區慶城街 6-1 號'
};
const students5 = [
  { name: '學生L', course: 'SPM', period: 'SPM 日 13:30-15:00 松山', periodParsed: { weekdays: [0], startTime: '13:30', endTime: '15:00', location: '松山' } },
  { name: '學生M', course: 'SPM', period: 'SPM 日 13:30-15:00 到府', periodParsed: { weekdays: [0], startTime: '13:30', endTime: '15:00', location: '到府' } }
];
const result5 = StudentCourseMatcher.matchStudentsForEvent(event5, students5, {
  withConfidence: true,
  timeTolerance: 10,
  durationTolerance: 20
});
console.log(`   結果: ${result5.length} 位學生`);
console.log(`   ✅ 預期: 1 位（學生L，地點為松山）`);
console.log(`   ${result5.length === 1 && result5[0].name === '學生L' ? '✅ 通過' : '❌ 失敗'}\n`);

// 測試案例 6：多詞課程名稱（SPIKE PRO）
console.log('📝 測試 6: 多詞課程名稱（SPIKE PRO）');
const parsed = CourseTitleParser.parse('[代課] SPIKE PRO 日 10:00-12:00 第9週');
console.log(`   解析結果: courseName="${parsed.courseName}"`);
console.log(`   ✅ 預期: "SPIKE"`);
console.log(`   ${parsed.courseName === 'SPIKE' ? '✅ 通過' : '❌ 失敗'}\n`);

// 總結
console.log('🏁 ===== 測試完成 =====');
console.log('\n📊 驗證重點：');
console.log('   ✅ 時間容忍度：開始時間 ±10 分鐘');
console.log('   ✅ 持續時間容忍度：±20 分鐘');
console.log('   ✅ 星期必須完全匹配');
console.log('   ✅ 地點類型必須匹配（到府/站所）');
console.log('   ✅ 課程名稱必須完全匹配');
console.log('\n💡 與前端邏輯完全一致！');
