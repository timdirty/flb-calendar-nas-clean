/**
 * 🧪 階段二完整測試 - Templates & System & Holidays
 * 
 * 測試階段二所有獨立模組的功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const axios = require('axios');

class Phase2Tester {
    constructor(baseURL = 'http://localhost:3000') {
        this.baseURL = baseURL;
        this.results = {
            holidays: { passed: 0, failed: 0, tests: [] },
            templates: { passed: 0, failed: 0, tests: [] },
            system: { passed: 0, failed: 0, tests: [] }
        };
    }

    /**
     * 執行單一測試
     */
    async runTest(module, name, testFn) {
        console.log(`  🧪 測試: ${name}`);
        try {
            await testFn();
            this.results[module].passed++;
            this.results[module].tests.push({ name, status: '✅ 通過' });
            console.log(`    ✅ 通過`);
            return true;
        } catch (error) {
            this.results[module].failed++;
            this.results[module].tests.push({ 
                name, 
                status: '❌ 失敗', 
                error: error.message 
            });
            console.log(`    ❌ 失敗: ${error.message}`);
            return false;
        }
    }

    /**
     * 測試 Holidays 模組
     */
    async testHolidays() {
        console.log('\n🎅 [測試] Holidays 模組');
        
        await this.runTest('holidays', '取得所有假期', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/holidays`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
        });

        await this.runTest('holidays', '檢查指定日期', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/holidays/check/2025-01-01`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
        });

        await this.runTest('holidays', '取得月份假日', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/holidays/month/2025/1`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
        });
    }

    /**
     * 測試 Templates 模組
     */
    async testTemplates() {
        console.log('\n📋 [測試] Templates 模組');

        await this.runTest('templates', '取得範本設定', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/templates`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('templates', '取得 Flex Message 範本', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/templates/flex-templates`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('templates', '儲存範本設定', async () => {
            const testData = {
                templates: {
                    test: { message: 'Test template' }
                }
            };
            const response = await axios.post(`${this.baseURL}/api/v2/templates`, testData);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });
    }

    /**
     * 測試 System 模組
     */
    async testSystem() {
        console.log('\n⚙️ [測試] System 模組');

        await this.runTest('system', '健康檢查', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/system/health`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('system', '取得系統時間', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/system/time`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
            if (!response.data.data.taipei) throw new Error('缺少台北時間');
        });

        await this.runTest('system', '取得系統狀態', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/system/status`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('system', '取得系統日誌', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/system/logs?limit=10`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('system', '取得完整系統資訊', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/system/info`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });
    }

    /**
     * 生成測試報告
     */
    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 階段二測試報告');
        console.log('='.repeat(60));

        const totalPassed = this.results.holidays.passed + 
                           this.results.templates.passed + 
                           this.results.system.passed;
        const totalFailed = this.results.holidays.failed + 
                           this.results.templates.failed + 
                           this.results.system.failed;
        const totalTests = totalPassed + totalFailed;

        console.log(`\n📈 總體統計:`);
        console.log(`  總測試數: ${totalTests}`);
        console.log(`  通過: ${totalPassed} (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
        console.log(`  失敗: ${totalFailed} (${((totalFailed/totalTests)*100).toFixed(1)}%)`);

        console.log(`\n🎅 Holidays 模組:`);
        console.log(`  通過: ${this.results.holidays.passed}`);
        console.log(`  失敗: ${this.results.holidays.failed}`);

        console.log(`\n📋 Templates 模組:`);
        console.log(`  通過: ${this.results.templates.passed}`);
        console.log(`  失敗: ${this.results.templates.failed}`);

        console.log(`\n⚙️ System 模組:`);
        console.log(`  通過: ${this.results.system.passed}`);
        console.log(`  失敗: ${this.results.system.failed}`);

        console.log('\n' + '='.repeat(60));
        
        if (totalFailed === 0) {
            console.log('✅ 所有測試通過！階段二完成！');
        } else {
            console.log(`⚠️ 發現 ${totalFailed} 個失敗測試，需要修復`);
        }

        return {
            success: totalFailed === 0,
            totalTests,
            totalPassed,
            totalFailed,
            modules: this.results
        };
    }

    /**
     * 執行所有測試
     */
    async runAll() {
        console.log('🧪 [階段二完整測試] 開始執行');
        console.log(`📍 測試目標: ${this.baseURL}`);

        try {
            // 先測試伺服器連線
            console.log('\n🔗 [測試] 伺服器連線');
            const health = await axios.get(`${this.baseURL}/api/v2/health`);
            console.log('  ✅ 伺服器連線正常');
            console.log(`  📊 Feature Flags:`, health.data.featureFlags);

            // 執行各模組測試
            await this.testHolidays();
            await this.testTemplates();
            await this.testSystem();

            // 生成報告
            return this.generateReport();

        } catch (error) {
            console.error('❌ [測試] 執行失敗:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.error('💡 提示: 請確保伺服器正在運行');
                console.error('   啟動命令: PORT=3000 DISABLE_AUTO_REMINDERS=true USE_ROUTES_PHASE2=true ENABLE_HOLIDAYS_V2=true ENABLE_TEMPLATES_V2=true ENABLE_SYSTEM_V2=true node server.js');
            }
            process.exit(1);
        }
    }
}

// 執行測試
if (require.main === module) {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
    const tester = new Phase2Tester(baseURL);
    
    tester.runAll().then(result => {
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = Phase2Tester;
