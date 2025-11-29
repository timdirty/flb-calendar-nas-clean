#!/usr/bin/env node

/**
 * 自動化構建工具 - 完整功能優化版本
 * 從原始文件提取所有功能，整合到優化結構中
 */

const fs = require('fs');
const path = require('path');

console.log('🔨 開始構建完整優化版本...\n');

// 讀取原始文件
const originalFile = fs.readFileSync(
    path.join(__dirname, 'public/perfect-calendar-optimized-complete.html'),
    'utf8'
);

// 讀取優化基礎文件
const optimizedBase = fs.readFileSync(
    path.join(__dirname, 'public/perfect-calendar-fully-optimized.html'),
    'utf8'
);

console.log('✅ 原始文件大小:', (originalFile.length / 1024).toFixed(2), 'KB');
console.log('✅ 優化基礎文件大小:', (optimizedBase.length / 1024).toFixed(2), 'KB\n');

// 提取關鍵功能模塊
const extractedModules = {
    teacherBinding: extractTeacherBindingCode(originalFile),
    attendance: extractAttendanceCode(originalFile),
    longPress: extractLongPressCode(originalFile),
    smartFilter: extractSmartFilterCode(originalFile),
    countdown: extractCountdownCode(originalFile),
    floatingMenu: extractFloatingMenuCode(originalFile),
    reporting: extractReportingCode(originalFile),
    notifications: extractNotificationsCode(originalFile)
};

console.log('📦 已提取的功能模塊:');
Object.keys(extractedModules).forEach(name => {
    const size = (extractedModules[name].length / 1024).toFixed(2);
    console.log(`  - ${name}: ${size} KB`);
});
console.log('');

// 構建完整優化版本
const completeOptimized = buildCompleteVersion(optimizedBase, extractedModules);

// 寫入文件
const outputPath = path.join(__dirname, 'public/perfect-calendar-complete-optimized.html');
fs.writeFileSync(outputPath, completeOptimized, 'utf8');

console.log('✅ 完整優化版本已生成:', outputPath);
console.log('📊 最終文件大小:', (completeOptimized.length / 1024).toFixed(2), 'KB');
console.log('📉 減少:', ((1 - completeOptimized.length / originalFile.length) * 100).toFixed(1), '%\n');

// 生成功能清單
generateFeatureList(extractedModules, outputPath);

// 提取函數實現
function extractTeacherBindingCode(content) {
    const start = content.indexOf('// ==================== 講師綁定功能 ====================');
    const end = content.indexOf('// ==================== 講師綁定功能結束 ====================');
    
    if (start === -1 || end === -1) {
        console.warn('⚠️  找不到講師綁定功能代碼');
        return '';
    }
    
    return content.substring(start, end + 50);
}

function extractAttendanceCode(content) {
    const start = content.indexOf('// ==================== 簽到系統功能 ====================');
    const end = content.indexOf('// ==================== 簽到系統功能結束 ====================');
    
    if (start === -1) {
        // 嘗試其他標記
        const altStart = content.indexOf('function handleDirectAttendance');
        if (altStart === -1) {
            console.warn('⚠️  找不到簽到系統功能代碼');
            return '';
        }
        return extractFunctionBlock(content, altStart, 5000);
    }
    
    return content.substring(start, end > start ? end + 50 : content.length);
}

function extractLongPressCode(content) {
    // 尋找長按相關的事件監聽器
    const patterns = [
        /document\.addEventListener\('mousedown'[\s\S]{1,3000}?}\);/g,
        /document\.addEventListener\('touchstart'[\s\S]{1,3000}?}\);/g,
        /let.*isCharging[\s\S]{1,2000}?;/g
    ];
    
    let extracted = '// ========== 長按集氣動畫功能 ==========\n';
    
    patterns.forEach(pattern => {
        const matches = content.match(pattern);
        if (matches) {
            matches.forEach(match => {
                if (!extracted.includes(match.substring(0, 50))) {
                    extracted += match + '\n\n';
                }
            });
        }
    });
    
    return extracted;
}

function extractSmartFilterCode(content) {
    const funcs = [
        'smartViewSelection',
        'smartInstructorViewSelection',
        'advancedSmartViewSelection',
        'showSmartFilterNotification'
    ];
    
    let code = '// ========== 智能篩選功能 ==========\n';
    
    funcs.forEach(funcName => {
        const funcCode = extractFunction(content, funcName);
        if (funcCode) {
            code += funcCode + '\n\n';
        }
    });
    
    return code;
}

function extractCountdownCode(content) {
    const funcs = ['calculateCountdown', 'updateAllCountdowns'];
    
    let code = '// ========== 倒數計時功能 ==========\n';
    
    funcs.forEach(funcName => {
        const funcCode = extractFunction(content, funcName);
        if (funcCode) {
            code += funcCode + '\n\n';
        }
    });
    
    return code;
}

function extractFloatingMenuCode(content) {
    const start = content.indexOf('function initializeFloatingMenu');
    if (start === -1) {
        console.warn('⚠️  找不到懸浮選單功能代碼');
        return '';
    }
    
    return extractFunctionBlock(content, start, 2000);
}

function extractReportingCode(content) {
    const funcs = [
        'showTeacherReport',
        'submitTeacherReport',
        'bindReportMenu'
    ];
    
    let code = '// ========== 報表功能 ==========\n';
    
    funcs.forEach(funcName => {
        const funcCode = extractFunction(content, funcName);
        if (funcCode) {
            code += funcCode + '\n\n';
        }
    });
    
    return code;
}

function extractNotificationsCode(content) {
    const funcs = [
        'sendLineNotification',
        'showNotification',
        'showToast'
    ];
    
    let code = '// ========== 通知功能 ==========\n';
    
    funcs.forEach(funcName => {
        const funcCode = extractFunction(content, funcName);
        if (funcCode) {
            code += funcCode + '\n\n';
        }
    });
    
    return code;
}

// 輔助函數：提取單個函數
function extractFunction(content, funcName) {
    const patterns = [
        new RegExp(`function ${funcName}\\s*\\([^)]*\\)\\s*{`, 'g'),
        new RegExp(`const ${funcName}\\s*=\\s*function\\s*\\([^)]*\\)\\s*{`, 'g'),
        new RegExp(`const ${funcName}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*{`, 'g'),
        new RegExp(`async function ${funcName}\\s*\\([^)]*\\)\\s*{`, 'g')
    ];
    
    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
            const startIndex = content.indexOf(match[0]);
            return extractFunctionBlock(content, startIndex, 2000);
        }
    }
    
    return null;
}

// 輔助函數：提取函數塊
function extractFunctionBlock(content, startIndex, maxLength) {
    let braceCount = 0;
    let inFunction = false;
    let functionCode = '';
    
    for (let i = startIndex; i < Math.min(startIndex + maxLength, content.length); i++) {
        const char = content[i];
        functionCode += char;
        
        if (char === '{') {
            braceCount++;
            inFunction = true;
        } else if (char === '}') {
            braceCount--;
            if (inFunction && braceCount === 0) {
                return functionCode;
            }
        }
    }
    
    return functionCode;
}

// 構建完整版本
function buildCompleteVersion(base, modules) {
    // 找到插入點（在 initApp 函數之前）
    const insertPoint = base.indexOf('async function initApp()');
    
    if (insertPoint === -1) {
        console.error('❌ 找不到插入點');
        return base;
    }
    
    // 組合所有模塊
    let modulesCode = '\n            // ================================================\n';
    modulesCode += '            // 完整功能模塊（從原文件提取）\n';
    modulesCode += '            // ================================================\n\n';
    
    Object.keys(modules).forEach(name => {
        if (modules[name]) {
            modulesCode += modules[name] + '\n\n';
        }
    });
    
    // 插入模塊代碼
    return base.substring(0, insertPoint) + modulesCode + base.substring(insertPoint);
}

// 生成功能清單
function generateFeatureList(modules, outputPath) {
    const listPath = path.join(__dirname, 'COMPLETE_FEATURE_LIST.md');
    
    let markdown = '# 完整優化版本 - 功能清單\n\n';
    markdown += `**生成時間**: ${new Date().toLocaleString('zh-TW')}\n`;
    markdown += `**文件位置**: ${outputPath}\n\n`;
    
    markdown += '## ✅ 已整合的功能模塊\n\n';
    
    const moduleNames = {
        teacherBinding: '講師綁定功能',
        attendance: '簽到系統',
        longPress: '長按集氣動畫',
        smartFilter: '智能篩選',
        countdown: '倒數計時',
        floatingMenu: '懸浮選單',
        reporting: '報表功能',
        notifications: '通知系統'
    };
    
    Object.keys(modules).forEach((key, index) => {
        const name = moduleNames[key] || key;
        const size = (modules[key].length / 1024).toFixed(2);
        const hasCode = modules[key].length > 100;
        
        markdown += `${index + 1}. **${name}** ${hasCode ? '✅' : '⚠️'}\n`;
        markdown += `   - 代碼大小: ${size} KB\n`;
        markdown += `   - 狀態: ${hasCode ? '已整合' : '未找到'}\n\n`;
    });
    
    markdown += '\n## 📊 優化統計\n\n';
    markdown += '| 項目 | 數值 |\n';
    markdown += '|------|------|\n';
    markdown += `| 總模塊數 | ${Object.keys(modules).length} |\n`;
    markdown += `| 成功整合 | ${Object.values(modules).filter(m => m.length > 100).length} |\n`;
    markdown += `| 待完善 | ${Object.values(modules).filter(m => m.length <= 100).length} |\n`;
    
    fs.writeFileSync(listPath, markdown, 'utf8');
    console.log('✅ 功能清單已生成:', listPath);
}

console.log('\n🎉 構建完成！');
console.log('下一步: node test-complete-optimized.js 進行功能測試');

