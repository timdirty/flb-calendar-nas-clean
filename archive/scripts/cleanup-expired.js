const fs = require('fs');
const path = require('path');

const remindersPath = path.join(__dirname, 'data', 'reminders.json');
const data = JSON.parse(fs.readFileSync(remindersPath, 'utf8'));

const now = new Date();
// 台灣時間
now.setHours(now.getHours() + 8);

let cleanedCount = 0;

console.log('🔍 檢查過期提醒...');
console.log(`當前台灣時間: ${now.toISOString()}`);

data.reminders.forEach(reminder => {
  if (reminder.courseDate && reminder.courseTime) {
    const [hour, minute] = reminder.courseTime.split(':');
    const courseDateTime = new Date(reminder.courseDate);
    courseDateTime.setHours(parseInt(hour), parseInt(minute), 0, 0);
    
    // 課程結束後 30 分鐘
    const minutesSinceCourse = (now - courseDateTime) / (1000 * 60);
    
    if (minutesSinceCourse > 30 && !['sent', 'expired'].includes(reminder.status)) {
      console.log(`🗑️ 清理過期提醒: ${reminder.courseName} (${reminder.courseDate} ${reminder.courseTime}) - 狀態: ${reminder.status}`);
      reminder.status = 'expired';
      reminder.error = '課程時間已過';
      cleanedCount++;
    }
  }
});

if (cleanedCount > 0) {
  fs.writeFileSync(remindersPath, JSON.stringify(data, null, 2));
  console.log(`✅ 已清理 ${cleanedCount} 個過期提醒`);
} else {
  console.log('ℹ️ 沒有需要清理的過期提醒');
}

