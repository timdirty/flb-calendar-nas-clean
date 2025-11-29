#!/usr/bin/env node
/**
 * 修復 course-reminder-management.html 中的 scheduledTime 顯示問題
 * 
 * 問題：scheduledTime 以 UTC 時間格式儲存（ISO 字串），但前端顯示時未正確轉換為台灣時間
 * 解決：確保所有顯示 scheduledTime 的地方都使用 formatToTaiwanTime() 函數
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'course-reminder-management.html');

console.log('🔧 開始修復 scheduledTime 顯示問題...');
console.log(`📄 目標檔案: ${filePath}`);

// 讀取檔案
let content = fs.readFileSync(filePath, 'utf8');

// 修復1：確保有 formatToTaiwanTime 函數，並且能正確處理 scheduledTime
const formatToTaiwanTimeFunc = `
        // 格式化台灣時間顯示（UTC -> Taiwan Time）
        function formatToTaiwanTime(dateStr) {
            if (!dateStr) return '未設定';
            
            try {
                // 如果是 ISO 格式的 UTC 時間字串（例如：2025-10-10T18:00:00.000Z）
                const date = new Date(dateStr);
                
                if (isNaN(date.getTime())) {
                    console.warn('無效的日期格式:', dateStr);
                    return dateStr;
                }
                
                // 轉換為台灣時區顯示
                return date.toLocaleString('zh-TW', {
                    timeZone: 'Asia/Taipei',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false
                });
            } catch (error) {
                console.error('時間格式化錯誤:', error, dateStr);
                return dateStr;
            }
        }

        // 格式化課程時間顯示（本地時間格式：yyyy-MM-dd HH:mm）
        function formatCourseDateTime(courseDate, courseTime) {
            if (!courseDate || !courseTime) return '未設定';
            
            try {
                // courseDate 格式: "2025-10-11"
                // courseTime 格式: "10:00" 或 "10:00:00"
                
                return \`\${courseDate} \${courseTime}\`;
            } catch (error) {
                console.error('課程時間格式化錯誤:', error);
                return \`\${courseDate} \${courseTime}\`;
            }
        }

        // 計算時間差（返回分鐘數）
        function getTimeDiffInMinutes(targetTimeStr) {
            if (!targetTimeStr) return null;
            
            try {
                const targetTime = new Date(targetTimeStr);
                const now = getTaiwanNow();
                
                const diffMs = targetTime.getTime() - now.getTime();
                return Math.floor(diffMs / 60000);
            } catch (error) {
                console.error('計算時間差錯誤:', error);
                return null;
            }
        }
`;

// 檢查是否已經有 formatToTaiwanTime 函數
if (content.includes('function formatToTaiwanTime(')) {
    console.log('✓ 發現現有的 formatToTaiwanTime 函數，將進行更新...');
    
    // 找到函數的位置並替換
    const funcRegex = /function formatToTaiwanTime\([^)]*\)\s*\{[\s\S]*?\n\s{8}\}/;
    if (funcRegex.test(content)) {
        content = content.replace(funcRegex, formatToTaiwanTimeFunc.trim());
        console.log('✅ 已更新 formatToTaiwanTime 函數');
    }
} else {
    console.log('✓ 未發現 formatToTaiwanTime 函數，將新增...');
    
    // 在 getTaiwanNow 函數後面插入
    const insertPoint = content.indexOf('function getTaiwanNow()');
    if (insertPoint !== -1) {
        // 找到這個函數的結束位置
        const funcEnd = content.indexOf('}', insertPoint) + 1;
        const nextLine = content.indexOf('\n', funcEnd) + 1;
        
        content = content.slice(0, nextLine) + '\n' + formatToTaiwanTimeFunc + '\n' + content.slice(nextLine);
        console.log('✅ 已新增 formatToTaiwanTime 函數');
    }
}

// 修復2：替換所有顯示 scheduledTime 的地方
const replacements = [
    // 在提醒卡片中顯示 scheduledTime
    {
        old: /時間:<\/strong>\s*\$\{reminder\.scheduledTime\}/g,
        new: '時間:</strong> ${formatToTaiwanTime(reminder.scheduledTime)}'
    },
    {
        old: /排程時間:<\/strong>\s*\$\{reminder\.scheduledTime\}/g,
        new: '排程時間:</strong> ${formatToTaiwanTime(reminder.scheduledTime)}'
    },
    // 在倒數計時器中
    {
        old: /const scheduledDate = new Date\(reminder\.scheduledTime\);/g,
        new: 'const scheduledDate = new Date(reminder.scheduledTime); // scheduledTime 是 UTC 時間'
    },
    // 在日誌詳情中
    {
        old: /if \(key === 'scheduledTime' \|\| key === 'sentAt'\) \{[\s\S]*?displayValue = formatToTaiwanTime\(value\);/g,
        new: `if (key === 'scheduledTime' || key === 'sentAt') {
                                    displayValue = formatToTaiwanTime(value); // 轉換 UTC 到台灣時間`
    }
];

let replaceCount = 0;
replacements.forEach((replacement, index) => {
    const matches = content.match(replacement.old);
    if (matches) {
        content = content.replace(replacement.old, replacement.new);
        replaceCount += matches.length;
        console.log(`✅ 修復 ${index + 1}: 替換了 ${matches.length} 處`);
    }
});

console.log(`\n📊 總共修復了 ${replaceCount} 處時間顯示問題`);

// 寫回檔案
const backupPath = filePath + '.backup-' + Date.now();
fs.copyFileSync(filePath, backupPath);
console.log(`\n💾 已建立備份: ${backupPath}`);

fs.writeFileSync(filePath, content, 'utf8');
console.log(`✅ 已更新檔案: ${filePath}`);

console.log('\n🎉 修復完成！');
console.log('\n📋 接下來的步驟：');
console.log('1. 重新載入頁面: https://calendar.funlearnbar.synology.me/course-reminder-management.html');
console.log('2. 檢查「待發送」標籤中的提醒時間是否正確');
console.log('3. 檢查倒數計時器是否正確');
console.log('4. 如果問題持續，請查看瀏覽器控制台的錯誤訊息');

console.log('\n💡 提示：');
console.log('- scheduledTime 以 UTC 時間格式儲存（ISO 字串）');
console.log('- 前端顯示時會自動轉換為台灣時間');
console.log('- 例如：UTC "2025-10-10T18:00:00.000Z" -> 台灣時間 "2025/10/11 02:00:00"');


