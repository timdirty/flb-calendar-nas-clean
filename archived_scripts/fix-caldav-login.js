#!/usr/bin/env node
/**
 * 修復 server.js - 在創建 CalDAV 客戶端後自動登入
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 修復 CalDAV 客戶端初始化...\n');

const filePath = path.join(__dirname, 'server.js');

// 讀取檔案
let content = fs.readFileSync(filePath, 'utf8');

// 備份
const backupPath = filePath + '.backup-caldav-login-' + Date.now();
fs.copyFileSync(filePath, backupPath);
console.log(`📦 已備份: ${backupPath}\n`);

// 找到 caldavClient 初始化的地方
const oldInit = `// CalDAV 客戶端
let caldavClient = null;
try {
// 使用官方 Synology Calendar API 而不是 CalDAV
const SynologyCalendarClient = require('./synology-calendar-client');
  caldavClient = new SynologyCalendarClient(
    process.env.CALDAV_URL || 'https://funlearnbar.synology.me:9102',
    process.env.CALDAV_USERNAME || 'testacount',
    process.env.CALDAV_PASSWORD || 'testacount'
  );
  console.log('✅ Synology Calendar API 客戶端初始化成功');
} catch (error) {
  console.error('CalDAV 客戶端初始化失敗:', error.message);
}`;

const newInit = `// CalDAV 客戶端
let caldavClient = null;
let caldavInitialized = false;

// 初始化並登入 CalDAV 客戶端
async function initCalDAVClient() {
  try {
    const SynologyCalendarClient = require('./synology-calendar-client');
    caldavClient = new SynologyCalendarClient(
      process.env.CALDAV_URL || 'https://funlearnbar.synology.me:9102',
      process.env.CALDAV_USERNAME || 'testacount',
      process.env.CALDAV_PASSWORD || 'testacount'
    );
    console.log('✅ Synology Calendar API 客戶端初始化成功');
    
    // 立即登入
    console.log('🔐 正在登入 Synology Calendar...');
    const loginSuccess = await caldavClient.login();
    
    if (loginSuccess) {
      console.log('✅ CalDAV 客戶端登入成功');
      caldavInitialized = true;
    } else {
      console.error('❌ CalDAV 客戶端登入失敗');
      caldavClient = null;
    }
  } catch (error) {
    console.error('❌ CalDAV 客戶端初始化失敗:', error.message);
    caldavClient = null;
  }
}

// 在服務器啟動時初始化
initCalDAVClient().catch(err => {
  console.error('❌ CalDAV 初始化錯誤:', err);
});`;

if (content.includes(oldInit)) {
  content = content.replace(oldInit, newInit);
  console.log('✅ 已修改 CalDAV 客戶端初始化邏輯');
} else {
  console.log('⚠️  找不到目標代碼，手動處理...');
  
  // 嘗試另一種匹配方式
  const pattern = /\/\/ CalDAV 客戶端\nlet caldavClient = null;[\s\S]*?console\.error\('CalDAV 客戶端初始化失敗:', error\.message\);\n}/;
  
  if (pattern.test(content)) {
    content = content.replace(pattern, newInit);
    console.log('✅ 已修改 CalDAV 客戶端初始化邏輯（使用備用匹配）');
  } else {
    console.error('❌ 無法找到匹配的代碼');
    process.exit(1);
  }
}

// 寫回檔案
fs.writeFileSync(filePath, content, 'utf8');
console.log(`✅ 已更新: ${filePath}\n`);

console.log('📋 接下來的步驟：');
console.log('1. 複製修改後的檔案到容器：');
console.log('   sudo docker cp ./server.js flb-calendar-nas:/app/server.js');
console.log('2. 重啟容器：');
console.log('   sudo docker restart flb-calendar-nas');
console.log('3. 等待30秒後測試：');
console.log('   sudo bash trigger-reminders.sh\n');


