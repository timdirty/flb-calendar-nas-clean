#!/usr/bin/env node
/**
 * 修復 synology-calendar-client.js 的時區轉換問題
 * 
 * 問題：Synology Calendar API 的 dtstart 可能已經包含時區信息
 * 導致使用 toLocaleString({ timeZone: 'Asia/Taipei' }) 時重複轉換
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 修復 synology-calendar-client.js 時區轉換...\n');

const filePath = path.join(__dirname, 'synology-calendar-client.js');

// 讀取檔案
let content = fs.readFileSync(filePath, 'utf8');

// 備份
const backupPath = filePath + '.backup-timezone-fix-' + Date.now();
fs.copyFileSync(filePath, backupPath);
console.log(`📦 已備份: ${backupPath}\n`);

// 修復方案：
// 將 toLocaleString 改為直接使用 UTC 方法，然後加上8小時來得到台灣時間

const oldCode = `            // ✅ 轉換為台灣時區的格式化字串（使用 ISO 格式）
            // 使用 'sv-SE' locale 可以得到 YYYY-MM-DD HH:mm:ss 格式
            const startTaiwanStr = startDate.toLocaleString('sv-SE', { 
                timeZone: 'Asia/Taipei',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(' ', 'T');  // 轉換為 ISO 格式：YYYY-MM-DDTHH:mm:ss
            
            const endTaiwanStr = endDate.toLocaleString('sv-SE', { 
                timeZone: 'Asia/Taipei',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(' ', 'T');`;

const newCode = `            // ✅ 修復：Synology Calendar API 返回的 timestamp 可能已經是本地時間
            // 使用 UTC 方法提取時間，然後格式化為 ISO 字串
            const formatDateToTaiwanISO = (date) => {
                // 使用 toLocaleString 但不指定 timeZone，避免重複轉換
                // 改用 sv-SE locale 直接格式化
                const str = date.toLocaleString('sv-SE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
                return str.replace(' ', 'T');
            };
            
            const startTaiwanStr = formatDateToTaiwanISO(startDate);
            const endTaiwanStr = formatDateToTaiwanISO(endDate);`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    console.log('✅ 已修復時區轉換邏輯');
} else {
    console.log('⚠️  找不到目標代碼，可能已經修改過');
    console.log('嘗試另一種修復方式...\n');
    
    // 嘗試只替換關鍵部分
    const pattern = /const startTaiwanStr = startDate\.toLocaleString\('sv-SE',\s*\{[\s\S]*?timeZone:\s*'Asia\/Taipei',[\s\S]*?\}\)\.replace\([^)]+\);/;
    
    if (pattern.test(content)) {
        content = content.replace(pattern, `const startTaiwanStr = startDate.toLocaleString('sv-SE', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(' ', 'T');  // 不指定 timeZone 避免重複轉換`);
        
        const pattern2 = /const endTaiwanStr = endDate\.toLocaleString\('sv-SE',\s*\{[\s\S]*?timeZone:\s*'Asia\/Taipei',[\s\S]*?\}\)\.replace\([^)]+\);/;
        content = content.replace(pattern2, `const endTaiwanStr = endDate.toLocaleString('sv-SE', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).replace(' ', 'T');  // 不指定 timeZone 避免重複轉換`);
        
        console.log('✅ 已移除 timeZone 參數');
    } else {
        console.log('❌ 無法找到匹配的代碼');
        process.exit(1);
    }
}

// 寫回檔案
fs.writeFileSync(filePath, content, 'utf8');
console.log(`✅ 已更新: ${filePath}\n`);

console.log('📋 接下來的步驟：');
console.log('1. 清除現有提醒：sudo bash fix-time.sh');
console.log('2. 或直接重啟容器：sudo docker restart flb-calendar-nas');
console.log('3. 等待30秒後檢查結果');
console.log('4. 驗證：https://calendar.funlearnbar.synology.me/course-reminder-management.html\n');


