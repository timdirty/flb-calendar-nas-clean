/**
 * 🧪 API 分析器測試工具
 * 
 * 測試 API 分析器的準確性
 * 先小範圍測試，再完整分析
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const { ApiAnalyzer } = require('./apiAnalyzer');
const fs = require('fs');
const path = require('path');

async function testAnalyzer() {
    console.log('🧪 開始測試 API 分析器...\n');
    
    try {
        // 1. 小範圍測試（前 5000 行）
        console.log('📊 執行小範圍測試（前 5000 行）...');
        const smallAnalyzer = new ApiAnalyzer('./server.js');
        
        // 手動讀取前 5000 行進行測試
        const serverContent = fs.readFileSync('./server.js', 'utf8');
        const first5000Lines = serverContent.split('\n').slice(0, 5000).join('\n');
        
        // 創建臨時檔案
        const tempFile = './temp-server-sample.js';
        fs.writeFileSync(tempFile, first5000Lines);
        
        const smallAnalyzerInstance = new ApiAnalyzer(tempFile);
        const smallReport = await smallAnalyzerInstance.scanServerFile();
        
        console.log('✅ 小範圍測試結果:');
        console.log(`   - 發現端點: ${smallReport.summary.totalEndpoints}`);
        console.log(`   - 功能域: ${Object.keys(smallReport.statistics.byDomain).length}`);
        console.log(`   - 平均複雜度: ${smallReport.summary.avgComplexity}`);
        
        // 顯示前 10 個端點
        console.log('\n📋 前 10 個端點:');
        smallReport.endpoints.slice(0, 10).forEach((ep, index) => {
            console.log(`   ${index + 1}. ${ep.method} ${ep.route} (${ep.domain})`);
        });
        
        // 清理臨時檔案
        fs.unlinkSync(tempFile);
        
        // 2. 完整分析
        console.log('\n📊 執行完整分析...');
        const fullAnalyzer = new ApiAnalyzer('./server.js');
        const fullReport = await fullAnalyzer.scanServerFile();
        
        console.log('✅ 完整分析結果:');
        console.log(`   - 總端點數: ${fullReport.summary.totalEndpoints}`);
        console.log(`   - 功能域數: ${fullReport.summary.totalDomains}`);
        console.log(`   - 依賴模組: ${fullReport.summary.totalDependencies}`);
        console.log(`   - 平均複雜度: ${fullReport.summary.avgComplexity}`);
        
        // 3. 按功能域統計
        console.log('\n🏗️ 功能域統計:');
        const domainStats = Object.entries(fullReport.statistics.byDomain)
            .sort(([,a], [,b]) => b - a);
        
        domainStats.forEach(([domain, count]) => {
            const domainInfo = fullReport.domains[domain];
            console.log(`   - ${domain}: ${count} 端點 (複雜度: ${domainInfo.stats.avgComplexity})`);
        });
        
        // 4. 遷移計畫摘要
        console.log('\n🚀 遷移計畫摘要:');
        fullReport.migrationPlan.forEach((phase, index) => {
            console.log(`   ${phase.name}: ${phase.title}`);
            console.log(`     - 端點數: ${phase.stats.endpointCount}`);
            console.log(`     - 功能域: ${phase.domains.join(', ')}`);
            console.log(`     - 預估複雜度: ${phase.stats.estimatedComplexity}`);
        });
        
        // 5. 儲存報告
        console.log('\n💾 儲存分析報告...');
        
        // JSON 報告
        await fullAnalyzer.saveReport('./docs/API-ANALYSIS-REPORT.json');
        
        // Markdown 報告
        const markdownReport = fullAnalyzer.generateMarkdownReport();
        fs.writeFileSync('./docs/API-ANALYSIS-REPORT.md', markdownReport);
        
        console.log('✅ JSON 報告: ./docs/API-ANALYSIS-REPORT.json');
        console.log('✅ Markdown 報告: ./docs/API-ANALYSIS-REPORT.md');
        
        // 6. 問題檢查
        console.log('\n🔍 檢查潛在問題...');
        
        const unknownEndpoints = fullReport.endpoints.filter(ep => ep.domain === 'unknown');
        if (unknownEndpoints.length > 0) {
            console.log(`⚠️  發現 ${unknownEndpoints.length} 個未分類的端點:`);
            unknownEndpoints.slice(0, 5).forEach(ep => {
                console.log(`   - ${ep.method} ${ep.route}`);
            });
        }
        
        const highComplexityEndpoints = fullReport.endpoints.filter(ep => ep.complexity >= 4);
        if (highComplexityEndpoints.length > 0) {
            console.log(`⚠️  發現 ${highComplexityEndpoints.length} 個高複雜度端點 (>=4):`);
            highComplexityEndpoints.slice(0, 5).forEach(ep => {
                console.log(`   - ${ep.method} ${ep.route} (複雜度: ${ep.complexity})`);
            });
        }
        
        // 7. 生成遷移建議
        console.log('\n💡 遷移建議:');
        console.log('1. 優先遷移高優先級、低複雜度的端點');
        console.log('2. 保留高複雜度端點到後期階段');
        console.log('3. 注意依賴關係，確保相關模組一起遷移');
        console.log('4. 每個階段完成後進行完整測試');
        
        return fullReport;
        
    } catch (error) {
        console.error('❌ 測試失敗:', error.message);
        throw error;
    }
}

// 執行測試
if (require.main === module) {
    testAnalyzer()
        .then(() => {
            console.log('\n🎉 API 分析器測試完成！');
        })
        .catch(error => {
            console.error('\n💥 測試失敗:', error);
            process.exit(1);
        });
}

module.exports = { testAnalyzer };
