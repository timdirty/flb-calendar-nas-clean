#!/usr/bin/env node

/**
 * 📋 Grid 佈局驗證測試
 * 
 * 此腳本驗證課程總覽 Grid 佈局是否正確設定
 * 
 * 使用方法:
 *   node tests/verify-grid-layout.js
 * 
 * 或在瀏覽器 Console 中執行:
 *   1. 打開課程總覽頁面
 *   2. 按 F12 打開開發者工具
 *   3. 貼上此腳本的瀏覽器版本
 */

const fs = require('fs');
const path = require('path');

console.log('');
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║              📋 課程總覽 Grid 佈局驗證測試                         ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');
console.log('');

const testResults = {
    passed: [],
    failed: [],
    warnings: []
};

// ==================== 測試 1: HTML 內聯樣式檢查 ====================
function testInlineStyles() {
    console.log('📋 測試 1: 檢查 HTML 內聯樣式...');
    console.log('─'.repeat(60));
    
    const htmlFile = path.join(__dirname, '../public/learning-record-upload.html');
    
    if (!fs.existsSync(htmlFile)) {
        console.log('  ❌ HTML 檔案不存在');
        testResults.failed.push('HTML 檔案不存在');
        return;
    }
    
    const htmlContent = fs.readFileSync(htmlFile, 'utf8');
    
    // 檢查 overviewPhotosPreviews
    const photosPreviewRegex = /<div[^>]+id="overviewPhotosPreviews"[^>]*style="[^"]*display:grid[^"]*"/;
    if (photosPreviewRegex.test(htmlContent)) {
        console.log('  ✅ overviewPhotosPreviews 包含 display:grid 內聯樣式');
        testResults.passed.push('overviewPhotosPreviews Grid 內聯樣式存在');
    } else {
        console.log('  ❌ overviewPhotosPreviews 缺少 display:grid 內聯樣式');
        testResults.failed.push('overviewPhotosPreviews Grid 內聯樣式缺失');
    }
    
    // 檢查 overviewExistingPreviews
    const existingPreviewRegex = /<div[^>]+id="overviewExistingPreviews"[^>]*style="[^"]*display:grid[^"]*"/;
    if (existingPreviewRegex.test(htmlContent)) {
        console.log('  ✅ overviewExistingPreviews 包含 display:grid 內聯樣式');
        testResults.passed.push('overviewExistingPreviews Grid 內聯樣式存在');
    } else {
        console.log('  ❌ overviewExistingPreviews 缺少 display:grid 內聯樣式');
        testResults.failed.push('overviewExistingPreviews Grid 內聯樣式缺失');
    }
    
    // 檢查 grid-template-columns
    const gridColumnsRegex = /grid-template-columns:repeat\(3,60px\)/;
    if (gridColumnsRegex.test(htmlContent)) {
        console.log('  ✅ Grid 列數設定正確 (3 列 × 60px)');
        testResults.passed.push('Grid 列數設定正確');
    } else {
        console.log('  ⚠️ Grid 列數設定可能不正確');
        testResults.warnings.push('Grid 列數設定需要檢查');
    }
    
    console.log('');
}

// ==================== 測試 2: CSS 檔案檢查 ====================
function testCSSFiles() {
    console.log('📋 測試 2: 檢查 CSS 檔案...');
    console.log('─'.repeat(60));
    
    const cssFiles = [
        { path: '../public/css/learning-records.css', name: 'learning-records.css' },
        { path: '../public/css/overview-layout-compact.css', name: 'overview-layout-compact.css' },
        { path: '../public/css/delete-button-fix.css', name: 'delete-button-fix.css' }
    ];
    
    cssFiles.forEach(file => {
        const fullPath = path.join(__dirname, file.path);
        if (fs.existsSync(fullPath)) {
            console.log(`  ✅ ${file.name} 存在`);
            testResults.passed.push(`CSS 檔案存在: ${file.name}`);
            
            // 檢查是否包含 Grid 相關設定
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('overviewPhotosPreviews') || content.includes('overviewExistingPreviews')) {
                console.log(`     - 包含課程總覽相關設定 ✅`);
            }
        } else {
            console.log(`  ❌ ${file.name} 不存在`);
            testResults.failed.push(`CSS 檔案缺失: ${file.name}`);
        }
    });
    
    console.log('');
}

// ==================== 測試 3: 版本號檢查 ====================
function testVersionNumbers() {
    console.log('📋 測試 3: 檢查版本號...');
    console.log('─'.repeat(60));
    
    const htmlFile = path.join(__dirname, '../public/learning-record-upload.html');
    
    if (!fs.existsSync(htmlFile)) {
        console.log('  ❌ HTML 檔案不存在');
        return;
    }
    
    const htmlContent = fs.readFileSync(htmlFile, 'utf8');
    
    // 檢查 CSS 版本號
    const cssVersionRegex = /learning-records\.css\?v=(\S+)/;
    const cssMatch = htmlContent.match(cssVersionRegex);
    if (cssMatch && cssMatch[1].includes('20251119')) {
        console.log(`  ✅ learning-records.css 版本號: ${cssMatch[1]}`);
        testResults.passed.push('CSS 版本號已更新');
    } else {
        console.log(`  ⚠️ learning-records.css 版本號可能需要更新`);
        testResults.warnings.push('CSS 版本號需要檢查');
    }
    
    // 檢查 JS 版本號
    const jsVersionRegex = /learning-record-upload\.js\?v=(\S+)/;
    const jsMatch = htmlContent.match(jsVersionRegex);
    if (jsMatch && jsMatch[1].includes('20251119')) {
        console.log(`  ✅ learning-record-upload.js 版本號: ${jsMatch[1]}`);
        testResults.passed.push('JS 版本號已更新');
    } else {
        console.log(`  ⚠️ learning-record-upload.js 版本號可能需要更新`);
        testResults.warnings.push('JS 版本號需要檢查');
    }
    
    console.log('');
}

// ==================== 測試 4: JavaScript 衝突檢查 ====================
function testJavaScriptConflicts() {
    console.log('📋 測試 4: 檢查 JavaScript 是否會覆蓋樣式...');
    console.log('─'.repeat(60));
    
    const jsFile = path.join(__dirname, '../public/js/pages/learning-record-upload.js');
    
    if (!fs.existsSync(jsFile)) {
        console.log('  ❌ JavaScript 檔案不存在');
        testResults.failed.push('JavaScript 檔案不存在');
        return;
    }
    
    const jsContent = fs.readFileSync(jsFile, 'utf8');
    
    // 檢查是否有動態修改 display
    const displayModifyRegex = /overviewPhotosPreviews.*\.style\.display|overviewExistingPreviews.*\.style\.display/;
    if (!displayModifyRegex.test(jsContent)) {
        console.log('  ✅ JavaScript 不會動態修改 display 樣式');
        testResults.passed.push('無 JavaScript 衝突');
    } else {
        console.log('  ⚠️ JavaScript 可能會動態修改 display 樣式');
        testResults.warnings.push('JavaScript 可能會覆蓋樣式');
    }
    
    console.log('');
}

// ==================== 執行所有測試 ====================
function runAllTests() {
    testInlineStyles();
    testCSSFiles();
    testVersionNumbers();
    testJavaScriptConflicts();
    
    // 列印結果摘要
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║                    📊 測試結果摘要                                   ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    
    const passedCount = testResults.passed.length;
    const failedCount = testResults.failed.length;
    const warningsCount = testResults.warnings.length;
    const totalCount = passedCount + failedCount + warningsCount;
    
    console.log(`總計: ${totalCount} 個測試`);
    console.log(`通過: ${passedCount} ✅`);
    console.log(`失敗: ${failedCount} ❌`);
    console.log(`警告: ${warningsCount} ⚠️`);
    console.log('');
    
    if (failedCount > 0) {
        console.log('❌ 失敗的測試:');
        testResults.failed.forEach(f => {
            console.log(`  - ${f}`);
        });
        console.log('');
    }
    
    if (warningsCount > 0) {
        console.log('⚠️ 警告:');
        testResults.warnings.forEach(w => {
            console.log(`  - ${w}`);
        });
        console.log('');
    }
    
    if (failedCount === 0 && warningsCount === 0) {
        console.log('🎉 所有測試通過！Grid 佈局已正確設定！');
        console.log('');
        console.log('📝 下一步:');
        console.log('  1. 清除瀏覽器快取 (Cmd+Shift+Delete / Ctrl+Shift+Delete)');
        console.log('  2. 強制刷新頁面 (Cmd+Shift+R / Ctrl+Shift+R)');
        console.log('  3. 驗證課程總覽照片是否整齊排列成網格');
    } else if (failedCount > 0) {
        console.log('⚠️ 部分測試失敗，請檢查修復');
    } else {
        console.log('✅ 測試通過（有警告），Grid 佈局應該正常運作');
    }
    
    console.log('');
    
    // 返回測試結果
    process.exit(failedCount > 0 ? 1 : 0);
}

// ==================== 瀏覽器版本測試腳本 ====================
function generateBrowserScript() {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║              🌐 瀏覽器 Console 測試腳本                            ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('將以下腳本複製到瀏覽器開發者工具 Console 中執行:');
    console.log('');
    console.log('─'.repeat(60));
    console.log(`
(function() {
    console.log('📋 Grid 佈局即時驗證');
    console.log('─'.repeat(60));
    
    const containers = [
        { id: 'overviewPhotosPreviews', name: '待上傳預覽' },
        { id: 'overviewExistingPreviews', name: '已上傳預覽' }
    ];
    
    containers.forEach(container => {
        const el = document.getElementById(container.id);
        if (!el) {
            console.log(\`❌ \${container.name}: 元素不存在\`);
            return;
        }
        
        const computed = window.getComputedStyle(el);
        const display = computed.display;
        const gridTemplateColumns = computed.gridTemplateColumns;
        const gap = computed.gap;
        
        console.log(\`\\n📦 \${container.name}:\`);
        console.log(\`  display: \${display} \${display === 'grid' ? '✅' : '❌'}\`);
        console.log(\`  grid-template-columns: \${gridTemplateColumns}\`);
        console.log(\`  gap: \${gap}\`);
        
        if (display !== 'grid') {
            console.log(\`  ⚠️ 警告: display 不是 grid，請檢查內聯樣式\`);
        }
    });
    
    console.log('\\n─'.repeat(60));
    console.log('✅ 驗證完成');
})();
    `);
    console.log('─'.repeat(60));
    console.log('');
}

// 執行測試
if (require.main === module) {
    runAllTests();
    generateBrowserScript();
}

module.exports = {
    runAllTests,
    testInlineStyles,
    testCSSFiles,
    testVersionNumbers,
    testJavaScriptConflicts
};
