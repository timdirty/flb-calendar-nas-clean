#!/usr/bin/env node

/**
 * 修復缺失的關鍵功能
 * - 添加講師綁定功能
 * - 添加 initApp 函數
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 開始修復缺失的關鍵功能...\n');

const targetFile = path.join(__dirname, 'public/perfect-calendar-complete-optimized.html');
const originalFile = path.join(__dirname, 'public/perfect-calendar-optimized-complete.html');

if (!fs.existsSync(targetFile)) {
    console.error('❌ 找不到目標文件:', targetFile);
    process.exit(1);
}

if (!fs.existsSync(originalFile)) {
    console.error('❌ 找不到原始文件:', originalFile);
    process.exit(1);
}

let content = fs.readFileSync(targetFile, 'utf8');
const originalContent = fs.readFileSync(originalFile, 'utf8');

// ============================================
// 1. 提取並添加講師綁定功能
// ============================================

console.log('1️⃣  提取講師綁定功能...');

// 從原始文件提取講師綁定功能
const teacherBindingStart = originalContent.indexOf('// ==================== 講師綁定功能 ====================');
const teacherBindingEnd = originalContent.indexOf('// ==================== 講師綁定功能結束 ====================');

if (teacherBindingStart === -1 || teacherBindingEnd === -1) {
    console.error('❌ 找不到講師綁定功能代碼');
} else {
    const teacherBindingCode = originalContent.substring(teacherBindingStart, teacherBindingEnd + '// ==================== 講師綁定功能結束 ===================='.length);
    console.log(`   提取了 ${teacherBindingCode.split('\n').length} 行代碼`);
    
    // 在 </script> 前插入講師綁定功能
    const scriptEndIndex = content.lastIndexOf('    </script>');
    if (scriptEndIndex !== -1) {
        content = content.substring(0, scriptEndIndex) + 
                  '\n        ' + teacherBindingCode + '\n\n' +
                  content.substring(scriptEndIndex);
        console.log('   ✅ 講師綁定功能已添加');
    }
}

// ============================================
// 2. 提取並添加講師綁定相關的 HTML 元素
// ============================================

console.log('\n2️⃣  提取講師綁定相關的 HTML...');

// 提取講師綁定對話框 HTML
const bindModalStart = originalContent.indexOf('<!-- 講師綁定對話框 -->');
const bindModalEnd = originalContent.indexOf('</div>', originalContent.indexOf('<!-- 講師綁定對話框 -->')) + 6;

if (bindModalStart !== -1 && bindModalEnd !== -1) {
    const bindModalHTML = originalContent.substring(bindModalStart, bindModalEnd);
    
    // 檢查是否已存在
    if (!content.includes('<!-- 講師綁定對話框 -->')) {
        // 在 </body> 前插入
        const bodyEndIndex = content.lastIndexOf('</body>');
        if (bodyEndIndex !== -1) {
            content = content.substring(0, bodyEndIndex) + 
                      '\n    ' + bindModalHTML + '\n\n' +
                      content.substring(bodyEndIndex);
            console.log('   ✅ 講師綁定對話框 HTML 已添加');
        }
    } else {
        console.log('   ℹ️  講師綁定對話框 HTML 已存在');
    }
}

// 提取解除綁定對話框
const unbindModalPattern = /<!-- 解除綁定確認對話框[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
const unbindModalMatch = originalContent.match(unbindModalPattern);

if (unbindModalMatch && !content.includes('<!-- 解除綁定確認對話框 -->')) {
    const bodyEndIndex = content.lastIndexOf('</body>');
    if (bodyEndIndex !== -1) {
        content = content.substring(0, bodyEndIndex) + 
                  '\n    ' + unbindModalMatch[0] + '\n\n' +
                  content.substring(bodyEndIndex);
        console.log('   ✅ 解除綁定對話框 HTML 已添加');
    }
}

// ============================================
// 3. 添加 initApp 函數
// ============================================

console.log('\n3️⃣  添加 initApp 函數...');

const initAppCode = `
        // ==================== 主要初始化函數 ====================
        async function initApp() {
            console.log('🚀 開始初始化應用程式...');
            
            try {
                // 1. LIFF 初始化
                if (typeof LIFFManager !== 'undefined') {
                    await LIFFManager.init();
                }
                
                // 2. 載入事件資料
                if (typeof loadAllEvents === 'function') {
                    await loadAllEvents();
                }
                
                // 3. 檢查講師綁定
                if (typeof checkTeacherBinding === 'function') {
                    await checkTeacherBinding();
                }
                
                // 4. 初始化 UI
                if (typeof initUI === 'function') {
                    initUI();
                }
                
                // 5. 自動滑動到行事曆
                if (typeof autoScrollToCalendar === 'function') {
                    autoScrollToCalendar();
                }
                
                console.log('✅ 應用程式初始化完成');
            } catch (error) {
                console.error('❌ 初始化失敗:', error);
            }
        }
        // ==================== 主要初始化函數結束 ====================
`;

if (!content.includes('async function initApp')) {
    const scriptEndIndex = content.lastIndexOf('    </script>');
    if (scriptEndIndex !== -1) {
        content = content.substring(0, scriptEndIndex) + 
                  '\n' + initAppCode + '\n' +
                  content.substring(scriptEndIndex);
        console.log('   ✅ initApp 函數已添加');
    }
} else {
    console.log('   ℹ️  initApp 函數已存在');
}

// ============================================
// 4. 保存修復後的文件
// ============================================

console.log('\n4️⃣  保存修復後的文件...');

fs.writeFileSync(targetFile, content, 'utf8');

const finalLines = content.split('\n').length;
const finalSizeKB = (content.length / 1024).toFixed(2);

console.log(`   文件大小: ${finalSizeKB} KB`);
console.log(`   總行數: ${finalLines}`);
console.log('   ✅ 文件已保存');

// ============================================
// 5. 驗證修復
// ============================================

console.log('\n5️⃣  驗證修復...');

const checks = [
    { name: '講師綁定功能', pattern: /講師綁定功能/ },
    { name: 'initApp 函數', pattern: /async function initApp/ },
    { name: '講師綁定對話框', pattern: /講師綁定對話框/ },
    { name: 'showTeacherBindModal', pattern: /function showTeacherBindModal/ },
    { name: 'confirmTeacherBinding', pattern: /function confirmTeacherBinding/ },
    { name: 'showUnbindButton', pattern: /function showUnbindButton/ },
    { name: 'confirmUnbind', pattern: /function confirmUnbind/ }
];

let passedChecks = 0;
checks.forEach(check => {
    if (check.pattern.test(content)) {
        console.log(`   ✅ ${check.name}`);
        passedChecks++;
    } else {
        console.log(`   ❌ ${check.name}`);
    }
});

console.log(`\n✅ 驗證完成: ${passedChecks}/${checks.length} 通過`);

// ============================================
// 總結
// ============================================

console.log('\n' + '═'.repeat(60));
console.log('📊 修復總結');
console.log('═'.repeat(60));
console.log(`✅ 講師綁定功能: ${content.includes('講師綁定功能') ? '已添加' : '❌ 失敗'}`);
console.log(`✅ initApp 函數: ${content.includes('async function initApp') ? '已添加' : '❌ 失敗'}`);
console.log(`✅ HTML 對話框: ${content.includes('講師綁定對話框') ? '已添加' : '❌ 失敗'}`);
console.log(`📊 功能完整性: ${((passedChecks / checks.length) * 100).toFixed(1)}%`);
console.log('═'.repeat(60));

if (passedChecks === checks.length) {
    console.log('🎉 所有關鍵功能已修復！');
    process.exit(0);
} else {
    console.log('⚠️  部分功能修復失敗，請檢查');
    process.exit(1);
}

