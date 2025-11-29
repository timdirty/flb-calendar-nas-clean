#!/usr/bin/env node

/**
 * 清理重複的學生提醒
 * 
 * 問題：同一學生、同一課程、同一日期有多個重複提醒
 * 解決：保留最新創建的提醒，刪除舊的重複提醒
 */

const fs = require('fs');
const path = require('path');

function cleanDuplicateStudentReminders() {
  console.log('🔧 開始清理重複的學生提醒...\n');
  
  // 讀取提醒資料
  const remindersPath = path.join(__dirname, 'data', 'reminders.json');
  
  if (!fs.existsSync(remindersPath)) {
    console.error('❌ 找不到提醒資料檔案:', remindersPath);
    return;
  }
  
  const remindersData = JSON.parse(fs.readFileSync(remindersPath, 'utf8'));
  const studentReminders = remindersData.studentReminders || [];
  
  console.log(`📊 目前總共有 ${studentReminders.length} 個學生提醒`);
  
  // 建立唯一鍵 Map：studentName + courseName + courseDate
  const uniqueRemindersMap = new Map();
  const duplicates = [];
  
  // 遍歷所有學生提醒，找出重複
  for (const reminder of studentReminders) {
    const key = `${reminder.studentName}|${reminder.courseName}|${reminder.courseDate}`;
    
    if (uniqueRemindersMap.has(key)) {
      // 已存在相同的提醒，比較創建時間
      const existing = uniqueRemindersMap.get(key);
      const existingTime = new Date(existing.createdAt).getTime();
      const currentTime = new Date(reminder.createdAt).getTime();
      
      if (currentTime > existingTime) {
        // 當前提醒更新，保留當前，標記舊的為重複
        duplicates.push(existing);
        uniqueRemindersMap.set(key, reminder);
        console.log(`🔄 更新保留: ${reminder.studentName} - ${reminder.courseName} (${reminder.courseDate})`);
      } else {
        // 舊的提醒更新，保留舊的，標記當前為重複
        duplicates.push(reminder);
        console.log(`⏭️ 跳過重複: ${reminder.studentName} - ${reminder.courseName} (${reminder.courseDate})`);
      }
    } else {
      // 第一次遇到這個組合，保留
      uniqueRemindersMap.set(key, reminder);
    }
  }
  
  // 統計結果
  const uniqueReminders = Array.from(uniqueRemindersMap.values());
  const removedCount = duplicates.length;
  
  console.log('\n📊 清理結果:');
  console.log(`   原始提醒數: ${studentReminders.length}`);
  console.log(`   保留提醒數: ${uniqueReminders.length}`);
  console.log(`   移除重複數: ${removedCount}`);
  
  if (removedCount === 0) {
    console.log('\n✅ 沒有發現重複的學生提醒');
    return;
  }
  
  // 顯示重複的詳細資訊
  console.log('\n🔍 重複提醒詳細資訊:');
  const duplicateGroups = new Map();
  
  for (const dup of duplicates) {
    const key = `${dup.studentName} - ${dup.courseName} (${dup.courseDate})`;
    if (!duplicateGroups.has(key)) {
      duplicateGroups.set(key, []);
    }
    duplicateGroups.get(key).push(dup);
  }
  
  for (const [key, dups] of duplicateGroups.entries()) {
    console.log(`   ${key}: ${dups.length} 個重複`);
    for (const dup of dups) {
      console.log(`      - ID: ${dup.id}, 創建時間: ${dup.createdAt}`);
    }
  }
  
  // 備份原始資料
  const backupPath = remindersPath + '.backup-clean-duplicates-' + Date.now();
  fs.writeFileSync(backupPath, JSON.stringify(remindersData, null, 2));
  console.log(`\n💾 已備份原始資料到: ${backupPath}`);
  
  // 更新提醒資料（只保留唯一的學生提醒）
  remindersData.studentReminders = uniqueReminders;
  fs.writeFileSync(remindersPath, JSON.stringify(remindersData, null, 2));
  
  console.log(`\n✅ 清理完成！已移除 ${removedCount} 個重複的學生提醒`);
  console.log(`✅ 當前學生提醒數: ${uniqueReminders.length}`);
}

// 執行清理
cleanDuplicateStudentReminders();

