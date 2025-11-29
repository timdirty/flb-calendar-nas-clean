#!/usr/bin/env node

/**
 * 本地端自檢腳本
 * 驗證修復後的文件是否正確
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 開始本地端自檢...\n');
console.log('═'.repeat(60));

const results = {
    passed: [],
    failed: [],
    warnings: []
};

// 讀取文件
const filePath = path.join(__dirname, 'public/perfect-calendar-complete-optimized.html');

if (!fs.existsSync(filePath)) {
    console.error('❌ 文件不存在:', filePath);
    process.exit(1);
}

const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log(`📄 文件資訊`);
console.log('─'.repeat(60));
console.log(`路徑: ${filePath}`);
console.log(`大小: ${(content.length / 1024).toFixed(2)} KB`);
console.log(`行數: ${lines.length}`);
console.log('');

// ============================================
// 測試 1: HTML 結構完整性
// ============================================

console.log('1️⃣  HTML 結構完整性測試');
console.log('─'.repeat(60));

// 1.1 檢查基本結構
const hasDoctype = content.includes('<!DOCTYPE html>');
const hasHtmlOpen = content.includes('<html');
const hasHtmlClose = content.includes('</html>');
const hasHead = content.includes('<head>') && content.includes('</head>');
const hasBody = content.includes('<body>') && content.includes('</body>');

if (hasDoctype && hasHtmlOpen && hasHtmlClose && hasHead && hasBody) {
    results.passed.push('HTML 基本結構完整');
    console.log('  ✅ HTML 基本結構完整');
} else {
    results.failed.push('HTML 基本結構不完整');
    console.log('  ❌ HTML 基本結構不完整');
}

// 1.2 檢查文件結尾
const trimmedContent = content.trim();
const endsWithHTML = trimmedContent.endsWith('</html>');

if (endsWithHTML) {
    results.passed.push('文件正確結束於 </html>');
    console.log('  ✅ 文件正確結束於 </html>');
} else {
    results.failed.push('文件結尾不正確');
    console.log('  ❌ 文件結尾不正確');
    console.log(`  最後 50 字元: "${trimmedContent.slice(-50)}"`);
}

// 1.3 檢查 </html> 之後是否有內容
const htmlEndIndex = content.lastIndexOf('</html>');
const afterHTML = content.substring(htmlEndIndex + 7).trim();

if (afterHTML.length === 0) {
    results.passed.push('</html> 之後無多餘內容');
    console.log('  ✅ </html> 之後無多餘內容');
} else {
    results.failed.push(`</html> 之後發現 ${afterHTML.length} 字元的多餘內容`);
    console.log(`  ❌ </html> 之後發現多餘內容 (${afterHTML.length} 字元)`);
    console.log(`  內容預覽: "${afterHTML.substring(0, 100)}..."`);
}

console.log('');

// ============================================
// 測試 2: JavaScript 語法檢查
// ============================================

console.log('2️⃣  JavaScript 語法檢查');
console.log('─'.repeat(60));

// 2.1 檢查 script 標籤配對
const scriptOpenTags = (content.match(/<script[^>]*>/g) || []).length;
const scriptCloseTags = (content.match(/<\/script>/g) || []).length;

if (scriptOpenTags === scriptCloseTags) {
    results.passed.push(`所有 script 標籤正確閉合 (${scriptOpenTags} 對)`);
    console.log(`  ✅ 所有 script 標籤正確閉合 (${scriptOpenTags} 對)`);
} else {
    results.failed.push(`script 標籤不匹配: ${scriptOpenTags} 開 vs ${scriptCloseTags} 閉`);
    console.log(`  ❌ script 標籤不匹配: ${scriptOpenTags} 開 vs ${scriptCloseTags} 閉`);
}

// 2.2 檢查是否有未閉合的大括號
const openBraces = (content.match(/\{/g) || []).length;
const closeBraces = (content.match(/\}/g) || []).length;

if (Math.abs(openBraces - closeBraces) < 10) { // 允許一些誤差（CSS 中的大括號）
    results.passed.push(`大括號大致平衡 (${openBraces} vs ${closeBraces})`);
    console.log(`  ✅ 大括號大致平衡`);
} else {
    results.warnings.push(`大括號可能不平衡 (${openBraces} vs ${closeBraces})`);
    console.log(`  ⚠️  大括號可能不平衡 (${openBraces} vs ${closeBraces})`);
}

// 2.3 檢查常見語法錯誤
const commonErrors = [
    { pattern: /function\s+\w+\s*\([^)]*\)\s*$/, desc: '函數定義不完整' },
    { pattern: /\}\s*else\s*$/, desc: 'else 語句不完整' },
    { pattern: /if\s*\([^)]*$/, desc: 'if 條件不完整' }
];

let syntaxIssues = 0;
lines.forEach((line, index) => {
    commonErrors.forEach(error => {
        if (error.pattern.test(line.trim())) {
            syntaxIssues++;
            if (syntaxIssues <= 5) { // 只顯示前 5 個
                console.log(`  ⚠️  行 ${index + 1}: ${error.desc}`);
            }
        }
    });
});

if (syntaxIssues === 0) {
    results.passed.push('未發現常見語法錯誤');
    console.log('  ✅ 未發現常見語法錯誤');
} else {
    results.warnings.push(`發現 ${syntaxIssues} 個可能的語法問題`);
}

console.log('');

// ============================================
// 測試 3: CSS/資源載入檢查
// ============================================

console.log('3️⃣  CSS/資源載入檢查');
console.log('─'.repeat(60));

// 3.1 檢查 preload 是否有 crossorigin
const preloadTags = content.match(/<link[^>]*rel="preload"[^>]*>/g) || [];
let preloadIssues = 0;

preloadTags.forEach(tag => {
    if (!tag.includes('crossorigin')) {
        preloadIssues++;
        if (preloadIssues <= 3) {
            console.log(`  ⚠️  Preload 缺少 crossorigin: ${tag.substring(0, 80)}...`);
        }
    }
});

if (preloadIssues === 0) {
    results.passed.push('所有 preload 標籤都有 crossorigin');
    console.log('  ✅ 所有 preload 標籤都有 crossorigin');
} else {
    results.warnings.push(`${preloadIssues} 個 preload 標籤缺少 crossorigin`);
}

// 3.2 檢查 preconnect
const hasPreconnect = content.includes('<link rel="preconnect"');
if (hasPreconnect) {
    results.passed.push('使用 preconnect 優化');
    console.log('  ✅ 使用 preconnect 優化');
}

// 3.3 檢查 CSS 變數
const hasCSSVars = content.includes(':root') && content.includes('--');
if (hasCSSVars) {
    results.passed.push('使用 CSS 變數系統');
    console.log('  ✅ 使用 CSS 變數系統');
}

console.log('');

// ============================================
// 測試 4: 功能完整性檢查
// ============================================

console.log('4️⃣  功能完整性檢查');
console.log('─'.repeat(60));

const requiredFunctions = [
    { name: 'Utils', pattern: /const\s+Utils\s*=/ },
    { name: 'AppState', pattern: /const\s+AppState\s*=/ },
    { name: 'UIManager', pattern: /const\s+UIManager\s*=/ },
    { name: 'APIManager', pattern: /const\s+APIManager\s*=/ },
    { name: 'EventManager', pattern: /const\s+EventManager\s*=/ },
    { name: 'RenderManager', pattern: /const\s+RenderManager\s*=/ },
    { name: 'LIFFManager', pattern: /const\s+LIFFManager\s*=/ },
    { name: '講師綁定功能', pattern: /講師綁定功能|showTeacherBindModal/ },
    { name: 'switchView', pattern: /window\.switchView\s*=|function\s+switchView/ },
    { name: 'initApp', pattern: /async\s+function\s+initApp/ }
];

let foundFunctions = 0;
requiredFunctions.forEach(func => {
    if (func.pattern.test(content)) {
        foundFunctions++;
        console.log(`  ✅ ${func.name}`);
    } else {
        console.log(`  ❌ ${func.name} (未找到)`);
        results.failed.push(`缺少功能: ${func.name}`);
    }
});

const completeness = (foundFunctions / requiredFunctions.length * 100).toFixed(1);
console.log(`\n  功能完整性: ${completeness}%`);

if (foundFunctions === requiredFunctions.length) {
    results.passed.push('所有核心功能都存在');
} else {
    results.warnings.push(`${requiredFunctions.length - foundFunctions} 個功能缺失`);
}

console.log('');

// ============================================
// 測試 5: 文件大小與性能
// ============================================

console.log('5️⃣  文件大小與性能');
console.log('─'.repeat(60));

const fileSizeKB = content.length / 1024;

if (fileSizeKB < 350) {
    results.passed.push(`文件大小適中 (${fileSizeKB.toFixed(2)} KB)`);
    console.log(`  ✅ 文件大小適中 (${fileSizeKB.toFixed(2)} KB)`);
} else if (fileSizeKB < 500) {
    results.warnings.push(`文件稍大 (${fileSizeKB.toFixed(2)} KB)`);
    console.log(`  ⚠️  文件稍大 (${fileSizeKB.toFixed(2)} KB)`);
} else {
    results.failed.push(`文件過大 (${fileSizeKB.toFixed(2)} KB)`);
    console.log(`  ❌ 文件過大 (${fileSizeKB.toFixed(2)} KB)`);
}

// 估算壓縮後大小（大約 30-40% 的原始大小）
const estimatedGzipKB = fileSizeKB * 0.35;
console.log(`  📦 預估 Gzip 後: ~${estimatedGzipKB.toFixed(2)} KB`);

console.log('');

// ============================================
// 生成報告
// ============================================

console.log('═'.repeat(60));
console.log('📊 自檢結果總結');
console.log('═'.repeat(60));

console.log(`\n✅ 通過: ${results.passed.length}`);
results.passed.forEach((item, i) => {
    console.log(`   ${i + 1}. ${item}`);
});

if (results.warnings.length > 0) {
    console.log(`\n⚠️  警告: ${results.warnings.length}`);
    results.warnings.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item}`);
    });
}

if (results.failed.length > 0) {
    console.log(`\n❌ 失敗: ${results.failed.length}`);
    results.failed.forEach((item, i) => {
        console.log(`   ${i + 1}. ${item}`);
    });
}

const totalTests = results.passed.length + results.failed.length;
const successRate = (results.passed.length / totalTests * 100).toFixed(1);

console.log(`\n📈 成功率: ${successRate}%`);

// ============================================
// 最終判斷
// ============================================

console.log('\n' + '═'.repeat(60));

if (results.failed.length === 0) {
    console.log('🎉 所有關鍵測試通過！文件可以使用。');
    console.log('═'.repeat(60));
    process.exit(0);
} else {
    console.log('⚠️  發現 ' + results.failed.length + ' 個問題需要修復。');
    console.log('═'.repeat(60));
    process.exit(1);
}

