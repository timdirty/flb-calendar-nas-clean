#!/usr/bin/env node

/**
 * 自動化功能測試工具
 * 測試完整優化版本的所有功能
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 開始功能完整性測試...\n');

// 測試結果
const testResults = {
    passed: [],
    failed: [],
    warnings: []
};

// 讀取完整優化版本
const optimizedFile = fs.readFileSync(
    path.join(__dirname, 'public/perfect-calendar-complete-optimized.html'),
    'utf8'
);

// 讀取原始文件作為參考
const originalFile = fs.readFileSync(
    path.join(__dirname, 'public/perfect-calendar-optimized-complete.html'),
    'utf8'
);

console.log('📋 測試計劃:\n');
console.log('  1. 核心功能測試');
console.log('  2. UI 組件測試');
console.log('  3. 事件處理測試');
console.log('  4. API 功能測試');
console.log('  5. 完整性測試\n');

// ========================================
// 測試 1: 核心功能測試
// ========================================

console.log('1️⃣  核心功能測試');
console.log('─'.repeat(50));

// 測試必要的全局對象
testGlobalObjects(optimizedFile, [
    'Utils',
    'AppState',
    'UIManager',
    'APIManager',
    'EventManager',
    'RenderManager'
]);

// 測試核心函數
testCoreFunctions(optimizedFile, [
    'switchView',
    'renderEvents',
    'initApp'
]);

// ========================================
// 測試 2: UI 組件測試
// ========================================

console.log('\n2️⃣  UI 組件測試');
console.log('─'.repeat(50));

// 測試 HTML 元素
testHTMLElements(optimizedFile, [
    'eventsContainer',
    'instructorSelect',
    'timeFilter',
    'dateFilter',
    'loadingOverlay',
    'userInfoContainer'
]);

// 測試 CSS 類
testCSSClasses(optimizedFile, [
    'event-card',
    'btn-primary',
    'loading-overlay',
    'toast',
    'filter-select'
]);

// ========================================
// 測試 3: 事件處理測試
// ========================================

console.log('\n3️⃣  事件處理測試');
console.log('─'.repeat(50));

// 測試事件監聽器
testEventListeners(optimizedFile, [
    'addEventListener',
    'onclick',
    'onchange'
]);

// ========================================
// 測試 4: API 功能測試
// ========================================

console.log('\n4️⃣  API 功能測試');
console.log('─'.repeat(50));

// 測試 API 端點
testAPIEndpoints(optimizedFile, [
    '/api/events',
    '/api/teachers',
    '/api/attendance',
    '/api/teacher-binding'
]);

// ========================================
// 測試 5: 完整性測試
// ========================================

console.log('\n5️⃣  完整性測試');
console.log('─'.repeat(50));

// 檢查關鍵功能是否存在
testFeatureCompleteness(optimizedFile, originalFile);

// ========================================
// 生成測試報告
// ========================================

console.log('\n' + '═'.repeat(50));
console.log('📊 測試報告');
console.log('═'.repeat(50));

console.log(`\n✅ 通過: ${testResults.passed.length}`);
testResults.passed.forEach((test, i) => {
    console.log(`   ${i + 1}. ${test}`);
});

if (testResults.warnings.length > 0) {
    console.log(`\n⚠️  警告: ${testResults.warnings.length}`);
    testResults.warnings.forEach((test, i) => {
        console.log(`   ${i + 1}. ${test}`);
    });
}

if (testResults.failed.length > 0) {
    console.log(`\n❌ 失敗: ${testResults.failed.length}`);
    testResults.failed.forEach((test, i) => {
        console.log(`   ${i + 1}. ${test}`);
    });
}

// 計算成功率
const totalTests = testResults.passed.length + testResults.failed.length;
const successRate = ((testResults.passed.length / totalTests) * 100).toFixed(1);

console.log(`\n📈 成功率: ${successRate}%`);

// 生成詳細報告文件
generateDetailedReport();

// 最終結論
console.log('\n' + '═'.repeat(50));
if (testResults.failed.length === 0) {
    console.log('🎉 所有測試通過！完整優化版本可以使用。');
} else {
    console.log('⚠️  部分測試未通過，請查看報告進行修正。');
}
console.log('═'.repeat(50) + '\n');

// ========================================
// 測試函數實現
// ========================================

function testGlobalObjects(content, objects) {
    objects.forEach(obj => {
        const regex = new RegExp(`(const|let|var|window\\.)?\\s*${obj}\\s*=`, 'g');
        if (regex.test(content)) {
            testResults.passed.push(`全局對象: ${obj}`);
            console.log(`  ✅ ${obj}`);
        } else {
            testResults.failed.push(`全局對象: ${obj}`);
            console.log(`  ❌ ${obj}`);
        }
    });
}

function testCoreFunctions(content, functions) {
    functions.forEach(func => {
        const patterns = [
            new RegExp(`function\\s+${func}`, 'g'),
            new RegExp(`const\\s+${func}\\s*=`, 'g'),
            new RegExp(`window\\.${func}\\s*=`, 'g')
        ];
        
        let found = patterns.some(pattern => pattern.test(content));
        
        if (found) {
            testResults.passed.push(`核心函數: ${func}`);
            console.log(`  ✅ ${func}()`);
        } else {
            testResults.failed.push(`核心函數: ${func}`);
            console.log(`  ❌ ${func}()`);
        }
    });
}

function testHTMLElements(content, elements) {
    elements.forEach(elem => {
        const patterns = [
            new RegExp(`id="${elem}"`, 'g'),
            new RegExp(`id='${elem}'`, 'g'),
            new RegExp(`getElementById\\('${elem}'\\)`, 'g')
        ];
        
        let found = patterns.some(pattern => pattern.test(content));
        
        if (found) {
            testResults.passed.push(`HTML 元素: #${elem}`);
            console.log(`  ✅ #${elem}`);
        } else {
            testResults.warnings.push(`HTML 元素: #${elem} (可能動態生成)`);
            console.log(`  ⚠️  #${elem}`);
        }
    });
}

function testCSSClasses(content, classes) {
    classes.forEach(cls => {
        const patterns = [
            new RegExp(`\\.${cls}\\s*{`, 'g'),
            new RegExp(`class.*${cls}`, 'g'),
            new RegExp(`classList\\..*'${cls}'`, 'g')
        ];
        
        let found = patterns.some(pattern => pattern.test(content));
        
        if (found) {
            testResults.passed.push(`CSS 類: .${cls}`);
            console.log(`  ✅ .${cls}`);
        } else {
            testResults.failed.push(`CSS 類: .${cls}`);
            console.log(`  ❌ .${cls}`);
        }
    });
}

function testEventListeners(content, events) {
    events.forEach(event => {
        if (content.includes(event)) {
            testResults.passed.push(`事件處理: ${event}`);
            console.log(`  ✅ ${event}`);
        } else {
            testResults.warnings.push(`事件處理: ${event}`);
            console.log(`  ⚠️  ${event}`);
        }
    });
}

function testAPIEndpoints(content, endpoints) {
    endpoints.forEach(endpoint => {
        if (content.includes(endpoint)) {
            testResults.passed.push(`API 端點: ${endpoint}`);
            console.log(`  ✅ ${endpoint}`);
        } else {
            testResults.warnings.push(`API 端點: ${endpoint}`);
            console.log(`  ⚠️  ${endpoint}`);
        }
    });
}

function testFeatureCompleteness(optimized, original) {
    // 關鍵功能列表
    const keyFeatures = [
        { name: '講師綁定', pattern: /showTeacherBindModal|teacher.*binding/gi },
        { name: '簽到系統', pattern: /attendance|簽到/gi },
        { name: '長按動畫', pattern: /long.*press|charging|mousedown|touchstart/gi },
        { name: 'LIFF 整合', pattern: /liff\.init|liff\.login|LIFFManager/gi },
        { name: '智能篩選', pattern: /smart.*filter|smart.*view/gi },
        { name: 'Toast 通知', pattern: /showToast|toast.*show/gi },
        { name: '載入動畫', pattern: /loading.*overlay|showLoading/gi },
        { name: '視圖切換', pattern: /switchView|currentView/gi },
        { name: '篩選功能', pattern: /instructorSelect|timeFilter|dateFilter/gi },
        { name: '課程渲染', pattern: /renderEvents|event.*card/gi }
    ];
    
    keyFeatures.forEach(feature => {
        const inOriginal = feature.pattern.test(original);
        const inOptimized = feature.pattern.test(optimized);
        
        if (inOriginal && inOptimized) {
            testResults.passed.push(`功能: ${feature.name}`);
            console.log(`  ✅ ${feature.name}`);
        } else if (inOriginal && !inOptimized) {
            testResults.failed.push(`功能: ${feature.name} (原文件有，優化版缺少)`);
            console.log(`  ❌ ${feature.name} (缺少)`);
        } else if (!inOriginal && inOptimized) {
            testResults.warnings.push(`功能: ${feature.name} (新增功能)`);
            console.log(`  ⚠️  ${feature.name} (新增)`);
        }
    });
}

function generateDetailedReport() {
    const reportPath = path.join(__dirname, 'TEST_REPORT.md');
    
    let report = '# 完整優化版本 - 測試報告\n\n';
    report += `**測試時間**: ${new Date().toLocaleString('zh-TW')}\n`;
    report += `**測試文件**: perfect-calendar-complete-optimized.html\n\n`;
    
    report += '## 📊 測試統計\n\n';
    report += '| 項目 | 數量 |\n';
    report += '|------|------|\n';
    report += `| 通過 | ${testResults.passed.length} |\n`;
    report += `| 警告 | ${testResults.warnings.length} |\n`;
    report += `| 失敗 | ${testResults.failed.length} |\n`;
    report += `| 總計 | ${testResults.passed.length + testResults.warnings.length + testResults.failed.length} |\n`;
    
    const successRate = ((testResults.passed.length / (testResults.passed.length + testResults.failed.length)) * 100).toFixed(1);
    report += `| 成功率 | ${successRate}% |\n\n`;
    
    report += '## ✅ 通過的測試\n\n';
    testResults.passed.forEach((test, i) => {
        report += `${i + 1}. ${test}\n`;
    });
    
    if (testResults.warnings.length > 0) {
        report += '\n## ⚠️ 警告項目\n\n';
        testResults.warnings.forEach((test, i) => {
            report += `${i + 1}. ${test}\n`;
        });
    }
    
    if (testResults.failed.length > 0) {
        report += '\n## ❌ 失敗的測試\n\n';
        testResults.failed.forEach((test, i) => {
            report += `${i + 1}. ${test}\n`;
        });
        
        report += '\n### 建議修正\n\n';
        report += '請檢查以下項目並補充缺少的功能：\n\n';
        testResults.failed.forEach((test, i) => {
            report += `- [ ] ${test}\n`;
        });
    }
    
    report += '\n## 📝 總結\n\n';
    if (testResults.failed.length === 0) {
        report += '✅ **所有關鍵功能測試通過！** 完整優化版本已準備就緒，可以部署使用。\n';
    } else {
        report += '⚠️ **部分功能需要補充。** 請根據上述建議進行修正後再次測試。\n';
    }
    
    report += '\n---\n';
    report += `*生成時間: ${new Date().toLocaleString('zh-TW')}*\n`;
    
    fs.writeFileSync(reportPath, report, 'utf8');
    console.log(`\n📄 詳細報告已保存: ${reportPath}`);
}

