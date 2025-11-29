/**
 * 🧪 Students 模組測試
 * 
 * 測試 Students 模組的基本功能
 * 
 * @version 1.0.0
 * @since 2025-11-27
 */

const axios = require('axios');

class StudentsModuleTester {
    constructor(baseURL = 'http://localhost:3000') {
        this.baseURL = baseURL;
        this.results = { passed: 0, failed: 0, tests: [] };
    }

    async runTest(name, testFn) {
        console.log(`  🧪 測試: ${name}`);
        try {
            await testFn();
            this.results.passed++;
            this.results.tests.push({ name, status: '✅ 通過' });
            console.log(`    ✅ 通過`);
            return true;
        } catch (error) {
            this.results.failed++;
            this.results.tests.push({ name, status: '❌ 失敗', error: error.message });
            console.log(`    ❌ 失敗: ${error.message}`);
            return false;
        }
    }

    async testStudentsModule() {
        console.log('\n👥 [測試] Students 模組');

        await this.runTest('取得所有學生', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/students`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('取得學生資料檔案', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/students/data`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('清除快取', async () => {
            const response = await axios.post(`${this.baseURL}/api/v2/students/clear-cache`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 Students 模組測試報告');
        console.log('='.repeat(60));

        const totalTests = this.results.passed + this.results.failed;
        console.log(`\n📈 統計:`);
        console.log(`  總測試數: ${totalTests}`);
        console.log(`  通過: ${this.results.passed} (${((this.results.passed/totalTests)*100).toFixed(1)}%)`);
        console.log(`  失敗: ${this.results.failed} (${((this.results.failed/totalTests)*100).toFixed(1)}%)`);

        console.log('\n' + '='.repeat(60));
        
        if (this.results.failed === 0) {
            console.log('✅ 所有測試通過！');
        } else {
            console.log(`⚠️ 發現 ${this.results.failed} 個失敗測試`);
        }

        return {
            success: this.results.failed === 0,
            totalTests,
            passed: this.results.passed,
            failed: this.results.failed,
            tests: this.results.tests
        };
    }

    async runAll() {
        console.log('🧪 [Students 模組測試] 開始執行');
        console.log(`📍 測試目標: ${this.baseURL}`);

        try {
            // 測試伺服器連線
            console.log('\n🔗 [測試] 伺服器連線');
            const health = await axios.get(`${this.baseURL}/api/v2/health`);
            console.log('  ✅ 伺服器連線正常');

            // 執行 Students 模組測試
            await this.testStudentsModule();

            // 生成報告
            return this.generateReport();

        } catch (error) {
            console.error('❌ [測試] 執行失敗:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.error('💡 提示: 請確保伺服器正在運行');
                console.error('   啟動命令: PORT=3000 DISABLE_AUTO_REMINDERS=true USE_ROUTES_PHASE3=true ENABLE_STUDENTS_V2=true node server.js');
            }
            process.exit(1);
        }
    }
}

// 執行測試
if (require.main === module) {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
    const tester = new StudentsModuleTester(baseURL);
    
    tester.runAll().then(result => {
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = StudentsModuleTester;
