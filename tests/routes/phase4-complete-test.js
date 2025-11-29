/**
 * 🧪 階段四完整測試 - Reminders, Notifications, Student Reminders & Webhook
 * 
 * 測試階段四所有通知系統模組的功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const axios = require('axios');

class Phase4Tester {
    constructor(baseURL = 'http://localhost:3000') {
        this.baseURL = baseURL;
        this.results = {
            reminders: { passed: 0, failed: 0, tests: [] },
            notifications: { passed: 0, failed: 0, tests: [] },
            studentReminders: { passed: 0, failed: 0, tests: [] },
            webhook: { passed: 0, failed: 0, tests: [] }
        };
    }

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

    // ==================== Reminders 模組測試 ====================
    async testReminders() {
        console.log('\n📢 [測試] Reminders 模組');
        
        await this.runTest('reminders', '取得提醒設定', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/reminders/settings`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('reminders', '取得排程狀態', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/reminders/schedule/status`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('reminders', '取得統計資訊', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/reminders/stats`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });
    }

    // ==================== Notifications 模組測試 ====================
    async testNotifications() {
        console.log('\n🔔 [測試] Notifications 模組');
        
        await this.runTest('notifications', '取得 Flex 範本列表', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/notifications/flex-templates`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('notifications', '取得統計資訊', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/notifications/stats`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('notifications', '取得發送歷史', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/notifications/history?limit=10`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });
    }

    // ==================== Student Reminders 模組測試 ====================
    async testStudentReminders() {
        console.log('\n👤 [測試] Student Reminders 模組');
        
        await this.runTest('studentReminders', '取得學生提醒設定', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/student-reminders/settings`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('studentReminders', '取得學生列表', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/student-reminders/students`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });
    }

    // ==================== Webhook 模組測試 ====================
    async testWebhook() {
        console.log('\n🌐 [測試] Webhook 模組');
        
        await this.runTest('webhook', '取得 Webhook 統計', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/webhook/stats`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('webhook', '測試 Webhook', async () => {
            const response = await axios.post(`${this.baseURL}/api/v2/webhook/test`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 階段四測試報告');
        console.log('='.repeat(60));

        const totalPassed = this.results.reminders.passed + 
                           this.results.notifications.passed + 
                           this.results.studentReminders.passed + 
                           this.results.webhook.passed;
        const totalFailed = this.results.reminders.failed + 
                           this.results.notifications.failed + 
                           this.results.studentReminders.failed + 
                           this.results.webhook.failed;
        const totalTests = totalPassed + totalFailed;

        console.log(`\n📈 總體統計:`);
        console.log(`  總測試數: ${totalTests}`);
        console.log(`  通過: ${totalPassed} (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
        console.log(`  失敗: ${totalFailed} (${((totalFailed/totalTests)*100).toFixed(1)}%)`);

        console.log(`\n📢 Reminders 模組:`);
        console.log(`  通過: ${this.results.reminders.passed}`);
        console.log(`  失敗: ${this.results.reminders.failed}`);

        console.log(`\n🔔 Notifications 模組:`);
        console.log(`  通過: ${this.results.notifications.passed}`);
        console.log(`  失敗: ${this.results.notifications.failed}`);

        console.log(`\n👤 Student Reminders 模組:`);
        console.log(`  通過: ${this.results.studentReminders.passed}`);
        console.log(`  失敗: ${this.results.studentReminders.failed}`);

        console.log(`\n🌐 Webhook 模組:`);
        console.log(`  通過: ${this.results.webhook.passed}`);
        console.log(`  失敗: ${this.results.webhook.failed}`);

        console.log('\n' + '='.repeat(60));
        
        if (totalFailed === 0) {
            console.log('✅ 所有測試通過！階段四完成！');
        } else {
            console.log(`⚠️ 發現 ${totalFailed} 個失敗測試`);
        }

        return {
            success: totalFailed === 0,
            totalTests,
            totalPassed,
            totalFailed,
            modules: this.results
        };
    }

    async runAll() {
        console.log('🧪 [階段四完整測試] 開始執行');
        console.log(`📍 測試目標: ${this.baseURL}`);

        try {
            // 測試伺服器連線
            console.log('\n🔗 [測試] 伺服器連線');
            const health = await axios.get(`${this.baseURL}/api/v2/health`);
            console.log('  ✅ 伺服器連線正常');
            console.log(`  📊 Feature Flags:`, health.data.featureFlags);

            // 執行各模組測試
            await this.testReminders();
            await this.testNotifications();
            await this.testStudentReminders();
            await this.testWebhook();

            // 生成報告
            return this.generateReport();

        } catch (error) {
            console.error('❌ [測試] 執行失敗:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.error('💡 提示: 請確保伺服器正在運行');
                console.error('   啟動命令: PORT=3000 DISABLE_AUTO_REMINDERS=true USE_ROUTES_PHASE4=true ENABLE_NOTIFICATIONS_V2=true node server.js');
            }
            process.exit(1);
        }
    }
}

// 執行測試
if (require.main === module) {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
    const tester = new Phase4Tester(baseURL);
    
    tester.runAll().then(result => {
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = Phase4Tester;
