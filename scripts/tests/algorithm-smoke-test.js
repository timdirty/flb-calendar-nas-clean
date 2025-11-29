#!/usr/bin/env node
/**
 * 驗證課程標題解析 + 時間匹配 + 排程/篩選邏輯。
 */

const path = require('path');

function log(title, data) {
  console.log(`\n=== ${title} ===`);
  if (Array.isArray(data)) {
    data.forEach(item => console.log(item));
  } else {
    console.log(data);
  }
}

function expect(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const CourseTitleParser = require(path.join(__dirname, '../../public/js/modules/course-title-parser.js'));
  const CourseStudentMatcher = require(path.join(__dirname, '../../public/js/modules/course-student-matcher.js'));
  const ReminderScheduler = require(path.join(__dirname, '../../reminder-scheduler.js'));

  // 1. CourseTitleParser 檢查
  const parserCases = [
    {
      input: 'BOOST 六15:30-17:00到府 第3週',
      expected: { course: 'BOOST', weekday: '六', start: '1530', end: '1700', location: '到府' }
    },
    {
      input: 'SPIKE 日1100-1300松山校區',
      expected: { course: 'SPIKE', weekday: '日', start: '1100', end: '1300', location: '松山校區' }
    },
    {
      input: '資訊課401 六 19:30-21:00 內湖',
      expected: { course: '資訊課401', weekday: '六', start: '1930', end: '2100', location: '內湖' }
    }
  ];
  parserCases.forEach(({ input, expected }) => {
    const result = CourseTitleParser.parse(input);
    expect(result.course === expected.course, `Parser course mismatch: ${input}`);
    expect(result.weekday === expected.weekday, `Parser weekday mismatch: ${input}`);
    expect(result.startTime === expected.start, `Parser start mismatch: ${input}`);
    expect(result.endTime === expected.end, `Parser end mismatch: ${input}`);
    expect(result.location === expected.location, `Parser location mismatch: ${input} => ${result.location}`);
  });
  log('CourseTitleParser', parserCases.map(c => `✔ ${c.input}`));

  // 2. CourseStudentMatcher normalize / isTimeMatch
  const normalizeCases = [
    { input: 'BOOST 六15:30-17:00 到府', expected: '六1530-1700' },
    { input: 'BOOST六1530-1700松山校區', expected: '六1530-1700' },
    { input: '六1530-1700松山校區第3週', expected: '六1530-1700' },
    { input: '1530-1700在府', expected: '1530-1700' }
  ];
  normalizeCases.forEach(({ input, expected }) => {
    const result = CourseStudentMatcher.normalizeTimeFormat(input);
    expect(result === expected, `normalizeTimeFormat mismatch: ${input} => ${result}, expect ${expected}`);
  });
  const matchPairs = [
    ['BOOST 六15:30-17:00到府', '六 15:30-17:00 松山校區', true],
    ['SPIKE 日11:00-13:00松山', '日 11:00-13:00', true],
    ['BOOST 六15:30-17:00到府', '六 18:00-20:00', false]
  ];
  matchPairs.forEach(([studentPeriod, targetPeriod, expected]) => {
    const result = CourseStudentMatcher.isTimeMatch(studentPeriod, targetPeriod);
    expect(result === expected, `isTimeMatch mismatch: ${studentPeriod} vs ${targetPeriod}`);
  });
  log('CourseStudentMatcher', [...normalizeCases.map(c => `✔ normalize ${c.input}`), ...matchPairs.map(p => `✔ match ${p[0]} / ${p[1]}`)]);

  // 3. ReminderScheduler matching
  const scheduler = new ReminderScheduler();
  const reminderStudents = [
    { name: 'Louis', course: 'BOOST', period: 'BOOST 六15:30-17:00 到府', remaining: 1 },
    { name: 'Amy', course: 'BOOST', period: 'BOOST 六18:00-20:00 到府', remaining: 1 }
  ];
  const parsedEvent = {
    course: 'BOOST',
    courseName: 'BOOST',
    period: '六15:30-17:00到府',
    timeInfo: '六15:30-17:00到府'
  };
  const matched = scheduler.findMatchingStudents(reminderStudents, parsedEvent, { title: 'BOOST 六15:30-17:00到府' }, '2025-11-15');
  expect(Array.isArray(matched) && matched.length === 1 && matched[0].name === 'Louis', 'ReminderScheduler should match only Louis');
  log('ReminderScheduler', matched.map(s => `✔ matched ${s.name}`));

  // 4. Student Filter (browser 模組) 測試
  global.window = {
    LOAD_PROGRESS: { updateProgress: () => {} },
    CourseStudentMatcher
  };
  const storage = new Map();
  global.localStorage = {
    getItem: key => (storage.has(key) ? storage.get(key) : null),
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear()
  };
  global.fetch = async () => ({
    json: async () => ({ success: false })
  });
  require(path.join(__dirname, '../../public/js/modules/student-filter.js'));
  const filterStudents = window.filterStudentsByCourseAndTime;
  const sampleStudents = [
    { name: 'Louis', course: 'BOOST', period: 'BOOST 六15:30-17:00 松山校區', remaining: 1, attendance: [] },
    { name: 'Amy', course: 'BOOST', period: 'BOOST 六18:00-20:00 松山校區', remaining: 1, attendance: [] },
    { name: 'Ben', course: 'SPIKE', period: 'SPIKE 日11:00-13:00 松山', remaining: 1, attendance: [] }
  ];
  const filtered = await filterStudents(sampleStudents, 'BOOST', '六15:30-17:00到府', { debugMode: false });
  expect(filtered.length === 1 && filtered[0].name === 'Louis', 'Student filter should only include Louis');
  log('StudentFilter', filtered.map(s => `✔ matched ${s.name}`));

  console.log('\n🎉 所有演算法測試通過，可進入部署流程。');
})().catch(err => {
  console.error('❌ 算法測試失敗:', err);
  process.exit(1);
});
