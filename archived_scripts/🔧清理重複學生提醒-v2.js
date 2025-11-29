#!/usr/bin/env node

/**
 * 清理重複學生提醒腳本 v2
 * 
 * 功能：
 * - 檢測並刪除重複的學生提醒
 * - 保留狀態較優先的提醒（sent > pending > failed > cancelled）
 * - 同時保留最早創建的提醒
 * - 備份原始資料
 */

const fs = require('fs');
const path = require('path');

const remindersPath = path.join(__dirname, 'data', 'reminders.json');
const backupPath = path.join(__dirname, 'data', `reminders.json.backup-cleanup-${Date.now()}`);

console.log('🔍 開始清理重複學生提醒...\n');

// 讀取提醒資料
let remindersData;
try {
  remindersData = JSON.parse(fs.readFileSync(remindersPath, 'utf8'));
  console.log(`✅ 成功讀取提醒資料`);
} catch (error) {
  console.error('❌ 讀取提醒資料失敗:', error.message);
  process.exit(1);
}

// 備份原始資料
try {
  fs.writeFileSync(backupPath, JSON.stringify(remindersData, null, 2), 'utf8');
  console.log(`💾 已備份原始資料到: ${path.basename(backupPath)}\n`);
} catch (error) {
  console.error('❌ 備份失敗:', error.message);
  process.exit(1);
}

const studentReminders = remindersData.studentReminders || [];
console.log(`📊 總學生提醒數: ${studentReminders.length}`);

if (studentReminders.length === 0) {
  console.log('✅ 沒有學生提醒，無需清理');
  process.exit(0);
}

// 定義狀態優先級（數字越大優先級越高）
const statusPriority = {
  'sent': 4,
  'completed': 4,
  'pending': 3,
  'pending-retry': 2,
  'failed': 1,
  'cancelled': 0,
  'expired': 0
};

// 按 studentName + courseName + courseDate 分組
const groups = {};
const duplicates = [];

studentReminders.forEach((reminder, index) => {
  const key = `${reminder.studentName}|||${reminder.courseName}|||${reminder.courseDate}`;
  
  if (!groups[key]) {
    groups[key] = [];
  }
  
  groups[key].push({
    index,
    reminder,
    priority: statusPriority[reminder.status] || 0,
    createdAt: new Date(reminder.createdAt || 0)
  });
});

console.log(`📦 共有 ${Object.keys(groups).length} 個唯一組合\n`);

// 找出重複的提醒
Object.entries(groups).forEach(([key, items]) => {
  if (items.length > 1) {
    const [studentName, courseName, courseDate] = key.split('|||');
    
    // 排序：優先級高的在前，優先級相同則最早創建的在前
    items.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.createdAt - b.createdAt;
    });
    
    const keep = items[0];
    const remove = items.slice(1);
    
    console.log(`🔍 發現重複提醒:`);
    console.log(`   學生: ${studentName}`);
    console.log(`   課程: ${courseName}`);
    console.log(`   日期: ${courseDate}`);
    console.log(`   重複數: ${items.length}`);
    console.log(`   保留: [${keep.reminder.status}] ID: ${keep.reminder.id}`);
    console.log(`   刪除: ${remove.map(r => `[${r.reminder.status}] ID: ${r.reminder.id}`).join(', ')}`);
    console.log('');
    
    duplicates.push(...remove);
  }
});

if (duplicates.length === 0) {
  console.log('✅ 沒有發現重複提醒！');
  process.exit(0);
}

console.log(`\n📊 統計:`);
console.log(`   重複提醒總數: ${duplicates.length}`);
console.log(`   保留提醒數: ${studentReminders.length - duplicates.length}`);

// 創建不包含重複提醒的新陣列
const duplicateIndices = new Set(duplicates.map(d => d.index));
const cleanedStudentReminders = studentReminders.filter((_, index) => !duplicateIndices.has(index));

// 更新資料
remindersData.studentReminders = cleanedStudentReminders;

// 儲存清理後的資料
try {
  fs.writeFileSync(remindersPath, JSON.stringify(remindersData, null, 2), 'utf8');
  console.log(`\n✅ 成功清理重複提醒`);
  console.log(`💾 已儲存到: ${remindersPath}`);
  console.log(`\n🎉 清理完成！剩餘學生提醒數: ${cleanedStudentReminders.length}`);
} catch (error) {
  console.error('\n❌ 儲存失敗:', error.message);
  console.log(`⚠️ 原始資料已備份至: ${backupPath}`);
  process.exit(1);
}

console.log(`\n📝 如需還原，請執行:`);
console.log(`   cp ${path.basename(backupPath)} reminders.json`);

