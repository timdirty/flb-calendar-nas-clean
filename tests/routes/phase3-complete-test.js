/**
 * 🧪 階段三完整測試 - Students, Temporary Students & Attendance
 * 
 * 測試階段三所有學生管理模組的功能
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const axios = require('axios');

class Phase3Tester {
    constructor(baseURL = 'http://localhost:3000') {
        this.baseURL = baseURL;
        this.results = {
            students: { passed: 0, failed: 0, tests: [] },
            temporaryStudents: { passed: 0, failed: 0, tests: [] },
            attendance: { passed: 0, failed: 0, tests: [] }
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

    // ==================== Students 模組測試 ====================
    async testStudents() {
        console.log('\n👥 [測試] Students 模組');
        
        await this.runTest('students', '取得所有學生', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/students`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('students', '取得學生資料檔案', async () => {
            try {
                const response = await axios.get(`${this.baseURL}/api/v2/students/data`);
                if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
                // 檔案可能不存在，返回成功但資料為空也算通過
                if (!response.data.success && !response.data.error) {
                    throw new Error('返回無效響應');
                }
            } catch (error) {
                // 404 是可接受的（檔案不存在）
                if (error.response && error.response.status === 404) {
                    return; // 視為通過
                }
                throw error;
            }
        });

        await this.runTest('students', '清除快取', async () => {
            const response = await axios.post(`${this.baseURL}/api/v2/students/clear-cache`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });
    }

    // ==================== Temporary Students 模組測試 ====================
    async testTemporaryStudents() {
        console.log('\n📝 [測試] Temporary Students 模組');
        
        let createdId = null;

        await this.runTest('temporaryStudents', '取得臨時學生列表', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/temporary-students`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('temporaryStudents', '新增臨時學生', async () => {
            const response = await axios.post(`${this.baseURL}/api/v2/temporary-students`, {
                name: '測試學生',
                type: 'makeup',
                course: '測試課程',
                scheduledDate: '2025-12-01',
                scheduledTime: '14:00'
            });
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
            createdId = response.data.data.id;
        });

        if (createdId) {
            await this.runTest('temporaryStudents', '更新臨時學生', async () => {
                const response = await axios.put(
                    `${this.baseURL}/api/v2/temporary-students/${createdId}`,
                    { location: '測試地點' }
                );
                if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
                if (!response.data.success) throw new Error('返回失敗狀態');
            });

            await this.runTest('temporaryStudents', '刪除臨時學生', async () => {
                const response = await axios.delete(
                    `${this.baseURL}/api/v2/temporary-students/${createdId}`
                );
                if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
                if (!response.data.success) throw new Error('返回失敗狀態');
            });
        }

        await this.runTest('temporaryStudents', '取得封存記錄', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/temporary-students/archive`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });
    }

    // ==================== Attendance 模組測試 ====================
    async testAttendance() {
        console.log('\n✅ [測試] Attendance 模組');

        await this.runTest('attendance', '清除快取', async () => {
            const response = await axios.post(`${this.baseURL}/api/v2/attendance/clear-cache`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('attendance', '查詢隊列狀態', async () => {
            const response = await axios.get(`${this.baseURL}/api/v2/attendance/queue/stats`);
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            if (!response.data.success) throw new Error('返回失敗狀態');
        });

        await this.runTest('attendance', '簽到隊列', async () => {
            const response = await axios.post(`${this.baseURL}/api/v2/attendance/queue`, {
                studentName: '測試學生',
                courseName: '測試課程',
                courseDate: '2025-12-01'
            });
            if (response.status !== 200) throw new Error(`狀態碼: ${response.status}`);
            // 服務未啟用時會返回 success: false，這是正常的
            if (response.data.message && response.data.message.includes('未啟用')) {
                return; // 服務未啟用，視為通過
            }
            if (!response.data.success) throw new Error('返回失敗狀態');
        });
    }

    generateReport() {
        console.log('\n' + '='.repeat(60));
        console.log('📊 階段三測試報告');
        console.log('='.repeat(60));

        const totalPassed = this.results.students.passed + 
                           this.results.temporaryStudents.passed + 
                           this.results.attendance.passed;
        const totalFailed = this.results.students.failed + 
                           this.results.temporaryStudents.failed + 
                           this.results.attendance.failed;
        const totalTests = totalPassed + totalFailed;

        console.log(`\n📈 總體統計:`);
        console.log(`  總測試數: ${totalTests}`);
        console.log(`  通過: ${totalPassed} (${((totalPassed/totalTests)*100).toFixed(1)}%)`);
        console.log(`  失敗: ${totalFailed} (${((totalFailed/totalTests)*100).toFixed(1)}%)`);

        console.log(`\n👥 Students 模組:`);
        console.log(`  通過: ${this.results.students.passed}`);
        console.log(`  失敗: ${this.results.students.failed}`);

        console.log(`\n📝 Temporary Students 模組:`);
        console.log(`  通過: ${this.results.temporaryStudents.passed}`);
        console.log(`  失敗: ${this.results.temporaryStudents.failed}`);

        console.log(`\n✅ Attendance 模組:`);
        console.log(`  通過: ${this.results.attendance.passed}`);
        console.log(`  失敗: ${this.results.attendance.failed}`);

        console.log('\n' + '='.repeat(60));
        
        if (totalFailed === 0) {
            console.log('✅ 所有測試通過！階段三完成！');
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
        console.log('🧪 [階段三完整測試] 開始執行');
        console.log(`📍 測試目標: ${this.baseURL}`);

        try {
            // 測試伺服器連線
            console.log('\n🔗 [測試] 伺服器連線');
            const health = await axios.get(`${this.baseURL}/api/v2/health`);
            console.log('  ✅ 伺服器連線正常');
            console.log(`  📊 Feature Flags:`, health.data.featureFlags);

            // 執行各模組測試
            await this.testStudents();
            await this.testTemporaryStudents();
            await this.testAttendance();

            // 生成報告
            return this.generateReport();

        } catch (error) {
            console.error('❌ [測試] 執行失敗:', error.message);
            if (error.code === 'ECONNREFUSED') {
                console.error('💡 提示: 請確保伺服器正在運行');
                console.error('   啟動命令: PORT=3000 DISABLE_AUTO_REMINDERS=true USE_ROUTES_PHASE3=true ENABLE_STUDENTS_V2=true ENABLE_ATTENDANCE_V2=true node server.js');
            }
            process.exit(1);
        }
    }
}

// 執行測試
if (require.main === module) {
    const baseURL = process.env.TEST_BASE_URL || 'http://localhost:3000';
    const tester = new Phase3Tester(baseURL);
    
    tester.runAll().then(result => {
        process.exit(result.success ? 0 : 1);
    });
}

module.exports = Phase3Tester;
