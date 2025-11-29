// 測試學生篩選邏輯
const fs = require('fs');
const path = require('path');

// 讀取學生資料
const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));

// 模擬課程資料
const course = {
  title: "SPIKE PRO 日 10:00-12:00 第5週",
  start: "2025-10-19T10:00:00",
  end: "2025-10-19T12:00:00",
  instructor: "TIM"
};

// 提取課程名稱
const courseName = "SPIKE PRO";

// 提取課程時段（模擬 extractPeriodFromTitle）
const extractPeriodFromTitle = (title, start, end) => {
  let startDate, endDate;
  
  if (typeof start === 'string' && !start.includes('Z') && !start.includes('+') && !start.includes('-', 10)) {
    startDate = new Date(start + '+08:00');
    endDate = new Date(end + '+08:00');
  } else {
    startDate = new Date(start);
    endDate = new Date(end);
  }
  
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[startDate.getDay()];
  
  const pad = (num) => String(num).padStart(2, '0');
  const startTime = `${pad(startDate.getHours())}${pad(startDate.getMinutes())}`;
  const endTime = `${pad(endDate.getHours())}${pad(endDate.getMinutes())}`;
  
  return `${weekday} ${startTime}-${endTime}`;
};

const coursePeriod = extractPeriodFromTitle(course.title, course.start, course.end);

console.log('📚 測試學生篩選邏輯\n');
console.log('課程資訊:');
console.log('  標題:', course.title);
console.log('  開始時間:', course.start);
console.log('  結束時間:', course.end);
console.log('  提取的課程名稱:', courseName);
console.log('  提取的課程時段:', coursePeriod);
console.log('');

// 使用與 server.js 相同的篩選邏輯
const students = studentData.students.filter(student => {
  // 檢查剩餘堂數
  const hasRemainingClasses = (student.remaining || 0) >= 0;
  
  // 精準比對課程名稱
  const courseMatch = student.course.replace(/\s+/g, '').toLowerCase() === courseName.replace(/\s+/g, '').toLowerCase();
  
  // 精準比對時間
  let timeMatch = false;
  if (student.period) {
    const normalizeTimeFormat = (timeStr) => {
      if (!timeStr) return '';
      
      return timeStr
        .replace(/\s*第[一二三四五六七八九十\d]+周\s*/gi, '')
        .replace(/\s*Week\s*\d+\s*/gi, '')
        .replace(/\s*week\s*\d+\s*/gi, '')
        .replace(/\s+/g, '')
        .toLowerCase()
        .replace(/(\d{1,2}):(\d{2})/g, (match, h, m) => {
          return h.padStart(2, '0') + m;
        });
    };
    
    const cleanStudentPeriod = normalizeTimeFormat(student.period);
    const cleanTargetTime = normalizeTimeFormat(coursePeriod);
    
    const extractBaseTime = (timeStr) => {
      return timeStr
        .replace(/\s*第\d+週\s*代課\s*$/, '')
        .replace(/\s*第\d+週\s*$/, '')
        .replace(/\s*代課\s*$/, '')
        .replace(/\s+$/, '');
    };
    
    const baseStudentPeriod = extractBaseTime(cleanStudentPeriod);
    const baseTargetTime = extractBaseTime(cleanTargetTime);
    
    timeMatch = cleanStudentPeriod === cleanTargetTime || 
               (cleanStudentPeriod && cleanStudentPeriod.startsWith(cleanTargetTime) && 
                cleanStudentPeriod.length > cleanTargetTime.length) ||
               (baseStudentPeriod && baseTargetTime && baseStudentPeriod === baseTargetTime) ||
               (baseStudentPeriod && baseTargetTime && 
                baseStudentPeriod.replace(/(\d{1,2}):(\d{2})/g, (match, h, m) => h.padStart(2, '0') + m) === baseTargetTime) ||
               (baseStudentPeriod && baseTargetTime && 
                baseStudentPeriod === baseTargetTime.replace(/(\d{1,2}):(\d{2})/g, (match, h, m) => h.padStart(2, '0') + m));
    
    if (courseMatch) {
      console.log(`學生: ${student.name}`);
      console.log(`  課程匹配: ${courseMatch}`);
      console.log(`  學生時段: ${student.period}`);
      console.log(`  清理後: ${cleanStudentPeriod}`);
      console.log(`  基本時段: ${baseStudentPeriod}`);
      console.log(`  目標時段: ${coursePeriod}`);
      console.log(`  清理後: ${cleanTargetTime}`);
      console.log(`  基本時段: ${baseTargetTime}`);
      console.log(`  時段匹配: ${timeMatch}`);
      console.log(`  剩餘堂數: ${student.remaining} (檢查: ${hasRemainingClasses})`);
      console.log(`  最終結果: ${hasRemainingClasses && courseMatch && timeMatch ? '✅ 匹配' : '❌ 不匹配'}`);
      console.log('');
    }
  }
  
  return hasRemainingClasses && courseMatch && timeMatch;
});

console.log('\n📊 篩選結果:');
console.log(`  匹配的學生數: ${students.length}`);
console.log(`  學生名單: ${students.map(s => s.name).join(', ') || '(無)'}`);

