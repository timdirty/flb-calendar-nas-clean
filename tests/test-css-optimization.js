#!/usr/bin/env node

/**
 * CSS 優化驗證測試腳本
 * 版本：1.0.0
 * 日期：2025-11-23
 * 
 * 此腳本驗證 CSS 整合優化的正確性
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 開始 CSS 優化驗證測試...\n');

const projectRoot = path.join(__dirname, '..');
const cssDir = path.join(projectRoot, 'public', 'css');
const htmlFile = path.join(projectRoot, 'public', 'learning-record-upload.html');

let passedTests = 0;
let totalTests = 0;

function test(name, condition) {
    totalTests++;
    if (condition) {
        console.log(`✅ ${name}`);
        passedTests++;
        return true;
    } else {
        console.log(`❌ ${name}`);
        return false;
    }
}

// ========================================
// Test 1: 新檔案存在性
// ========================================
console.log('📦 測試 1: 檢查新建檔案是否存在\n');

test('upload-ui-fixes.css 已創建', 
    fs.existsSync(path.join(cssDir, 'upload-ui-fixes.css')));

test('learning-upload-layout.css 已創建', 
    fs.existsSync(path.join(cssDir, 'learning-upload-layout.css')));

// ========================================
// Test 2: HTML 引用更新
// ========================================
console.log('\n📄 測試 2: 檢查 HTML 引用是否正確更新\n');

const htmlContent = fs.readFileSync(htmlFile, 'utf-8');

test('HTML 引用 upload-ui-fixes.css', 
    htmlContent.includes('upload-ui-fixes.css'));

test('HTML 引用 learning-upload-layout.css', 
    htmlContent.includes('learning-upload-layout.css'));

test('HTML 不再引用 progress-bar-override.css', 
    !htmlContent.includes('progress-bar-override.css'));

test('HTML 不再引用 hover-fix.css', 
    !htmlContent.includes('hover-fix.css'));

test('HTML 不再引用 delete-button-fix.css', 
    !htmlContent.includes('delete-button-fix.css'));

// ========================================
// Test 3: 內嵌樣式檢查
// ========================================
console.log('\n🎨 測試 3: 檢查內嵌樣式是否已移除\n');

// 檢查是否還有大量內嵌樣式（允許少量必要的內嵌樣式）
const styleTagCount = (htmlContent.match(/<style>/g) || []).length;
test(`內嵌 <style> 標籤數量合理 (${styleTagCount} <= 2)`, 
    styleTagCount <= 2);

// 檢查是否有進度條相關的內嵌樣式
test('無進度條內嵌樣式', 
    !htmlContent.includes('.file-upload-progress {') && 
    !htmlContent.includes('.file-upload-progress-fill {'));

// 檢查是否有刪除按鈕相關的內嵌樣式
test('無刪除按鈕內嵌樣式', 
    !htmlContent.includes('.remove-btn {'));

// ========================================
// Test 4: CSS 檔案內容驗證
// ========================================
console.log('\n🔍 測試 4: 驗證 CSS 檔案內容完整性\n');

const uploadUiFixesContent = fs.readFileSync(
    path.join(cssDir, 'upload-ui-fixes.css'), 'utf-8'
);

test('upload-ui-fixes.css 包含進度條樣式', 
    uploadUiFixesContent.includes('.file-upload-progress'));

test('upload-ui-fixes.css 包含 Overlay 樣式', 
    uploadUiFixesContent.includes('.file-uploading-overlay'));

test('upload-ui-fixes.css 包含刪除按鈕樣式', 
    uploadUiFixesContent.includes('.remove-btn'));

test('upload-ui-fixes.css 包含分節註解', 
    uploadUiFixesContent.includes('Section 1:') && 
    uploadUiFixesContent.includes('Section 2:'));

const layoutContent = fs.readFileSync(
    path.join(cssDir, 'learning-upload-layout.css'), 'utf-8'
);

test('learning-upload-layout.css 包含課程總覽佈局', 
    layoutContent.includes('#overviewPhotosPreviews'));

test('learning-upload-layout.css 包含學生容器樣式', 
    layoutContent.includes('.student-photos'));

test('learning-upload-layout.css 包含模式切換樣式', 
    layoutContent.includes('.mode-switch-inner'));

test('learning-upload-layout.css 包含響應式設計', 
    layoutContent.includes('@media'));

// ========================================
// Test 5: 檔案大小檢查
// ========================================
console.log('\n📊 測試 5: 檢查檔案大小合理性\n');

const uploadUiFixesSize = fs.statSync(path.join(cssDir, 'upload-ui-fixes.css')).size;
const layoutSize = fs.statSync(path.join(cssDir, 'learning-upload-layout.css')).size;
const htmlSize = fs.statSync(htmlFile).size;

test(`upload-ui-fixes.css 大小合理 (${Math.round(uploadUiFixesSize/1024)}KB)`, 
    uploadUiFixesSize > 5000 && uploadUiFixesSize < 50000);

test(`learning-upload-layout.css 大小合理 (${Math.round(layoutSize/1024)}KB)`, 
    layoutSize > 5000 && layoutSize < 50000);

test(`HTML 檔案大小減少 (${Math.round(htmlSize/1024)}KB < 100KB)`, 
    htmlSize < 100000);

// ========================================
// Test 6: 語法檢查
// ========================================
console.log('\n✔️ 測試 6: 基本語法檢查\n');

// 檢查大括號配對
function checkBraces(content, filename) {
    const openBraces = (content.match(/{/g) || []).length;
    const closeBraces = (content.match(/}/g) || []).length;
    return test(`${filename} 大括號配對正確 (${openBraces} = ${closeBraces})`, 
        openBraces === closeBraces);
}

checkBraces(uploadUiFixesContent, 'upload-ui-fixes.css');
checkBraces(layoutContent, 'learning-upload-layout.css');

// 檢查是否有語法錯誤跡象
test('upload-ui-fixes.css 無明顯語法錯誤', 
    !uploadUiFixesContent.includes(';;') && 
    !uploadUiFixesContent.includes('}}'));

test('learning-upload-layout.css 無明顯語法錯誤', 
    !layoutContent.includes(';;') && 
    !layoutContent.includes('}}'));

// ========================================
// Test 7: 向後相容性
// ========================================
console.log('\n🔄 測試 7: 向後相容性檢查\n');

// 檢查舊檔案是否還存在（供回滾使用）
test('舊檔案 progress-bar-override.css 仍保留', 
    fs.existsSync(path.join(cssDir, 'progress-bar-override.css')));

test('舊檔案 hover-fix.css 仍保留', 
    fs.existsSync(path.join(cssDir, 'hover-fix.css')));

test('舊檔案 delete-button-fix.css 仍保留', 
    fs.existsSync(path.join(cssDir, 'delete-button-fix.css')));

// ========================================
// 測試總結
// ========================================
console.log('\n' + '='.repeat(50));
console.log('📈 測試結果總結\n');
console.log(`✅ 通過: ${passedTests}/${totalTests}`);
console.log(`❌ 失敗: ${totalTests - passedTests}/${totalTests}`);
console.log(`📊 通過率: ${Math.round(passedTests/totalTests * 100)}%`);

if (passedTests === totalTests) {
    console.log('\n🎉 所有測試通過！CSS 優化成功！');
    process.exit(0);
} else {
    console.log('\n⚠️ 有測試失敗，請檢查上述錯誤');
    process.exit(1);
}
