#!/usr/bin/env node

/**
 * JavaScript 語法檢查工具
 * 提取 HTML 中的 JavaScript 並檢查語法
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filePath = path.join(__dirname, 'public/perfect-calendar-complete-optimized.html');
const content = fs.readFileSync(filePath, 'utf8');

console.log('🔍 開始檢查 JavaScript 語法...\n');

// 提取所有 script 標籤內容
const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
let match;
let scriptIndex = 0;
let totalErrors = 0;

while ((match = scriptRegex.exec(content)) !== null) {
    scriptIndex++;
    const scriptContent = match[1];
    const scriptStart = match.index;
    const lineNumber = content.substring(0, scriptStart).split('\n').length;
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📜 Script Block #${scriptIndex} (起始於第 ${lineNumber} 行)`);
    console.log('─'.repeat(60));
    
    if (!scriptContent.trim()) {
        console.log('ℹ️  空的 script 標籤');
        continue;
    }
    
    // 檢查語法
    try {
        // 使用 vm 模組檢查語法（不執行）
        new vm.Script(scriptContent);
        console.log('✅ 語法正確');
    } catch (error) {
        totalErrors++;
        console.log('❌ 發現語法錯誤:');
        console.log(`   錯誤訊息: ${error.message}`);
        
        if (error.stack) {
            const stackLines = error.stack.split('\n').slice(0, 3);
            stackLines.forEach(line => console.log(`   ${line}`));
        }
        
        // 顯示錯誤位置的代碼
        if (error.lineNumber) {
            const lines = scriptContent.split('\n');
            const errorLine = error.lineNumber - 1;
            const start = Math.max(0, errorLine - 2);
            const end = Math.min(lines.length, errorLine + 3);
            
            console.log('\n   錯誤位置的代碼:');
            for (let i = start; i < end; i++) {
                const marker = i === errorLine ? ' >>> ' : '     ';
                console.log(`   ${marker}${i + 1}: ${lines[i]}`);
            }
        }
    }
    
    // 檢查常見問題
    const issues = [];
    
    // 檢查未閉合的大括號
    const openBraces = (scriptContent.match(/\{/g) || []).length;
    const closeBraces = (scriptContent.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
        issues.push(`大括號不平衡: ${openBraces} 個 { vs ${closeBraces} 個 }`);
    }
    
    // 檢查未閉合的小括號
    const openParens = (scriptContent.match(/\(/g) || []).length;
    const closeParens = (scriptContent.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
        issues.push(`小括號不平衡: ${openParens} 個 ( vs ${closeParens} 個 )`);
    }
    
    // 檢查未閉合的方括號
    const openBrackets = (scriptContent.match(/\[/g) || []).length;
    const closeBrackets = (scriptContent.match(/\]/g) || []).length;
    if (openBrackets !== closeBrackets) {
        issues.push(`方括號不平衡: ${openBrackets} 個 [ vs ${closeBrackets} 個 ]`);
    }
    
    if (issues.length > 0) {
        console.log('\n⚠️  可能的問題:');
        issues.forEach(issue => console.log(`   • ${issue}`));
    }
}

console.log('\n' + '='.repeat(60));
console.log('📊 檢查總結');
console.log('='.repeat(60));
console.log(`Script 區塊總數: ${scriptIndex}`);
console.log(`發現的錯誤: ${totalErrors}`);

if (totalErrors === 0) {
    console.log('\n✅ 所有 JavaScript 語法正確！');
    process.exit(0);
} else {
    console.log(`\n❌ 發現 ${totalErrors} 個語法錯誤，請修復後重試。`);
    process.exit(1);
}

