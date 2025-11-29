/**
 * 🎅 Holidays 路由並行測試框架
 * 
 * 驗證 v1 和 v2 路由的行為一致性
 * 確保遷移過程中的零停機和功能完整性
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class HolidaysParallelTester {
    constructor(baseURL = 'http://localhost:3002') {
        this.baseURL = baseURL;
        this.testResults = [];
        this.adminToken = null;
        this.testStartTime = Date.now();
    }

    /**
     * 執行完整的並行測試套件
     */
    async runFullTestSuite() {
        console.log('🎅 [HolidaysTest] 開始執行並行測試套件');
        
        try {
            // 1. 登入取得管理員 token
            await this.loginAdmin();
            
            // 2. 基礎功能測試
            await this.testBasicEndpoints();
            
            // 3. 參數驗證測試
            await this.testParameterValidation();
            
            // 4. 認證權限測試
            await this.testAuthentication();
            
            // 5. 錯誤處理測試
            await this.testErrorHandling();
            
            // 6. 效能比較測試
            await this.testPerformance();
            
            // 7. 生成測試報告
            await this.generateTestReport();
            
            console.log('✅ [HolidaysTest] 並行測試套件執行完成');
            return this.testResults;
            
        } catch (error) {
            console.error('❌ [HolidaysTest] 測試套件執行失敗:', error);
            throw error;
        }
    }

    /**
     * 登入取得管理員 token
     */
    async loginAdmin() {
        try {
            console.log('🔐 [HolidaysTest] 登入取得管理員 token');
            
            const response = await axios.post(`${this.baseURL}/api/admin/login`, {
                password: process.env.ADMIN_PASSWORD || 'admin123'
            });
            
            if (response.data.success) {
                this.adminToken = response.data.token;
                console.log('✅ [HolidaysTest] 管理員登入成功');
                return true;
            } else {
                throw new Error('管理員登入失敗');
            }
            
        } catch (error) {
            console.error('❌ [HolidaysTest] 管理員登入失敗:', error.message);
            throw error;
        }
    }

    /**
     * 基礎功能測試
     */
    async testBasicEndpoints() {
        console.log('📋 [HolidaysTest] 執行基礎功能測試');
        
        const testCases = [
            {
                name: '取得所有假期資料',
                method: 'GET',
                url: '/api/holidays',
                v2Url: '/api/v2/holidays',
                expectedStatus: 200
            },
            {
                name: '取得假期同步狀態',
                method: 'GET',
                url: '/api/holidays/status',
                v2Url: '/api/v2/holidays/status',
                expectedStatus: 200
            },
            {
                name: '檢查指定日期是否為假日',
                method: 'GET',
                url: '/api/holidays/check/2025-01-01',
                v2Url: '/api/v2/holidays/check/2025-01-01',
                expectedStatus: 200
            },
            {
                name: '取得指定月份的假日',
                method: 'GET',
                url: '/api/holidays/2025/1',
                v2Url: '/api/v2/holidays/2025/1',
                expectedStatus: 200
            }
        ];

        for (const testCase of testCases) {
            await this.runParallelTest(testCase);
        }
    }

    /**
     * 參數驗證測試
     */
    async testParameterValidation() {
        console.log('✅ [HolidaysTest] 執行參數驗證測試');
        
        const testCases = [
            {
                name: '無效日期格式',
                method: 'GET',
                url: '/api/holidays/check/invalid-date',
                v2Url: '/api/v2/holidays/check/invalid-date',
                expectedStatus: 400
            },
            {
                name: '無效年份',
                method: 'GET',
                url: '/api/holidays/abc/1',
                v2Url: '/api/v2/holidays/abc/1',
                expectedStatus: 400
            },
            {
                name: '無效月份',
                method: 'GET',
                url: '/api/holidays/2025/13',
                v2Url: '/api/v2/holidays/2025/13',
                expectedStatus: 400
            },
            {
                name: '負數月份',
                method: 'GET',
                url: '/api/holidays/2025/-1',
                v2Url: '/api/v2/holidays/2025/-1',
                expectedStatus: 400
            }
        ];

        for (const testCase of testCases) {
            await this.runParallelTest(testCase);
        }
    }

    /**
     * 認證權限測試
     */
    async testAuthentication() {
        console.log('🔒 [HolidaysTest] 執行認證權限測試');
        
        const testCases = [
            {
                name: '未認證觸發同步',
                method: 'POST',
                url: '/api/holidays/sync',
                v2Url: '/api/v2/holidays/sync',
                expectedStatus: 401,
                noAuth: true
            },
            {
                name: '無效 token 觸發同步',
                method: 'POST',
                url: '/api/holidays/sync',
                v2Url: '/api/v2/holidays/sync',
                expectedStatus: 401,
                headers: { 'Authorization': 'Bearer invalid-token' }
            },
            {
                name: '正確認證觸發同步',
                method: 'POST',
                url: '/api/holidays/sync',
                v2Url: '/api/v2/holidays/sync',
                expectedStatus: 200,
                headers: { 'Authorization': `Bearer ${this.adminToken}` }
            }
        ];

        for (const testCase of testCases) {
            await this.runParallelTest(testCase);
        }
    }

    /**
     * 錯誤處理測試
     */
    async testErrorHandling() {
        console.log('⚠️ [HolidaysTest] 執行錯誤處理測試');
        
        const testCases = [
            {
                name: '不存在的端點',
                method: 'GET',
                url: '/api/holidays/nonexistent',
                v2Url: '/api/v2/holidays/nonexistent',
                expectedStatus: 404
            },
            {
                name: '錯誤的 HTTP 方法',
                method: 'DELETE',
                url: '/api/holidays',
                v2Url: '/api/v2/holidays',
                expectedStatus: 404
            }
        ];

        for (const testCase of testCases) {
            await this.runParallelTest(testCase);
        }
    }

    /**
     * 效能比較測試
     */
    async testPerformance() {
        console.log('⚡ [HolidaysTest] 執行效能比較測試');
        
        const testCase = {
            name: '效能比較 - 取得所有假期',
            method: 'GET',
            url: '/api/holidays',
            v2Url: '/api/v2/holidays',
            expectedStatus: 200,
            measurePerformance: true
        };

        await this.runParallelTest(testCase, 5); // 執行 5 次取平均
    }

    /**
     * 執行並行測試
     */
    async runParallelTest(testCase, iterations = 1) {
        console.log(`🧪 [HolidaysTest] 測試: ${testCase.name}`);
        
        const results = {
            name: testCase.name,
            iterations: [],
            summary: {
                identical: true,
                statusMatch: true,
                performanceDelta: 0,
                error: null
            }
        };

        for (let i = 0; i < iterations; i++) {
            try {
                const startTime = Date.now();
                
                // 準備請求配置
                const v1Config = {
                    method: testCase.method,
                    url: `${this.baseURL}${testCase.url}`,
                    timeout: 5000
                };
                
                const v2Config = {
                    method: testCase.method,
                    url: `${this.baseURL}${testCase.v2Url}`,
                    timeout: 5000
                };

                // 添加認證標頭
                if (testCase.headers) {
                    v1Config.headers = testCase.headers;
                    v2Config.headers = testCase.headers;
                }

                // 執行並行請求
                const [v1Response, v2Response] = await Promise.all([
                    axios(v1Config),
                    axios(v2Config)
                ]);

                const endTime = Date.now();
                const duration = endTime - startTime;

                // 比較響應
                const iteration = {
                    iteration: i + 1,
                    duration,
                    v1: {
                        status: v1Response.status,
                        data: v1Response.data,
                        responseTime: v1Response.headers['x-response-time'] || 'N/A'
                    },
                    v2: {
                        status: v2Response.status,
                        data: v2Response.data,
                        responseTime: v2Response.headers['x-response-time'] || 'N/A'
                    },
                    comparison: this.compareResponses(v1Response, v2Response)
                };

                results.iterations.push(iteration);

                // 更新摘要
                if (!iteration.comparison.identical) {
                    results.summary.identical = false;
                }
                if (!iteration.comparison.statusMatch) {
                    results.summary.statusMatch = false;
                }

                console.log(`  ✓ 迭代 ${i + 1}: ${iteration.comparison.identical ? '一致' : '不一致'}`);

            } catch (error) {
                const errorInfo = this.handleTestError(error);
                results.iterations.push({
                    iteration: i + 1,
                    error: errorInfo
                });
                results.summary.error = errorInfo;
                console.log(`  ❌ 迭代 ${i + 1}: ${errorInfo.message}`);
            }
        }

        // 計算平均效能
        if (iterations > 1 && results.iterations.length > 0) {
            const avgDuration = results.iterations.reduce((sum, iter) => sum + (iter.duration || 0), 0) / results.iterations.length;
            results.summary.avgDuration = Math.round(avgDuration);
        }

        this.testResults.push(results);
        return results;
    }

    /**
     * 比較兩個響應
     */
    compareResponses(v1Response, v2Response) {
        const comparison = {
            statusMatch: v1Response.status === v2Response.status,
            identical: false,
            differences: []
        };

        if (comparison.statusMatch) {
            // 深度比較響應數據
            const v1Data = JSON.stringify(v1Response.data, null, 2);
            const v2Data = JSON.stringify(v2Response.data, null, 2);
            
            comparison.identical = v1Data === v2Data;
            
            if (!comparison.identical) {
                // 找出具體差異
                const v1Keys = Object.keys(v1Response.data);
                const v2Keys = Object.keys(v2Response.data);
                
                if (v1Keys.length !== v2Keys.length) {
                    comparison.differences.push(`鍵數量不同: v1=${v1Keys.length}, v2=${v2Keys.length}`);
                }
                
                for (const key of v1Keys) {
                    if (!v2Keys.includes(key)) {
                        comparison.differences.push(`v1 缺少鍵: ${key}`);
                    }
                }
                
                for (const key of v2Keys) {
                    if (!v1Keys.includes(key)) {
                        comparison.differences.push(`v2 缺少鍵: ${key}`);
                    }
                }
            }
        }

        return comparison;
    }

    /**
     * 處理測試錯誤
     */
    handleTestError(error) {
        if (error.response) {
            return {
                type: 'HTTP_ERROR',
                status: error.response.status,
                message: error.response.data?.error || error.message,
                data: error.response.data
            };
        } else if (error.code === 'ECONNREFUSED') {
            return {
                type: 'CONNECTION_ERROR',
                message: '無法連接到伺服器',
                code: error.code
            };
        } else {
            return {
                type: 'UNKNOWN_ERROR',
                message: error.message,
                code: error.code
            };
        }
    }

    /**
     * 生成測試報告
     */
    async generateTestReport() {
        console.log('📊 [HolidaysTest] 生成測試報告');
        
        const report = {
            timestamp: new Date().toISOString(),
            duration: Date.now() - this.testStartTime,
            summary: {
                totalTests: this.testResults.length,
                passedTests: this.testResults.filter(r => r.summary.identical && r.summary.statusMatch).length,
                failedTests: this.testResults.filter(r => !r.summary.identical || !r.summary.statusMatch).length,
                errorTests: this.testResults.filter(r => r.summary.error).length
            },
            results: this.testResults,
            recommendations: this.generateRecommendations()
        };

        // 儲存報告
        const reportPath = path.join(__dirname, '../../reports', 'holidays-parallel-test-report.json');
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

        // 生成 Markdown 報告
        const markdownReport = this.generateMarkdownReport(report);
        const markdownPath = path.join(__dirname, '../../reports', 'holidays-parallel-test-report.md');
        await fs.writeFile(markdownPath, markdownReport);

        console.log(`📄 [HolidaysTest] 測試報告已儲存: ${markdownPath}`);
        return report;
    }

    /**
     * 生成建議
     */
    generateRecommendations() {
        const recommendations = [];
        
        const failedTests = this.testResults.filter(r => !r.summary.identical || !r.summary.statusMatch);
        if (failedTests.length > 0) {
            recommendations.push('發現行為不一致的測試，建議檢查並修復 v2 路由實現');
        }
        
        const errorTests = this.testResults.filter(r => r.summary.error);
        if (errorTests.length > 0) {
            recommendations.push('發現錯誤測試，建議檢查網路連接或伺服器狀態');
        }
        
        if (failedTests.length === 0 && errorTests.length === 0) {
            recommendations.push('✅ 所有測試通過，可以安全啟用 v2 路由');
            recommendations.push('建議設置 ENABLE_HOLIDAYS_V2=true 啟用 holidays v2 模組');
        }
        
        return recommendations;
    }

    /**
     * 生成 Markdown 報告
     */
    generateMarkdownReport(report) {
        return `# 🎅 Holidays 路由並行測試報告

## 📊 測試摘要

- **測試時間**: ${report.timestamp}
- **執行時長**: ${report.duration}ms
- **總測試數**: ${report.summary.totalTests}
- **通過測試**: ${report.summary.passedTests}
- **失敗測試**: ${report.summary.failedTests}
- **錯誤測試**: ${report.summary.errorTests}

## 📋 測試結果

${report.results.map(result => `
### ${result.name}

- **狀態**: ${result.summary.identical && result.summary.statusMatch ? '✅ 通過' : '❌ 失敗'}
- **迭代次數**: ${result.iterations.length}
${result.summary.avgDuration ? `- **平均時長**: ${result.summary.avgDuration}ms` : ''}
${result.summary.error ? `- **錯誤**: ${result.summary.error.message}` : ''}

${result.iterations.map(iter => `
- 迭代 ${iter.iteration}: ${iter.comparison ? (iter.comparison.identical ? '一致' : '不一致') : (iter.error ? '錯誤' : '未知')}
`).join('')}
`).join('')}

## 💡 建議

${report.recommendations.map(rec => `- ${rec}`).join('\n')}

---
*報告由 HolidaysParallelTester 自動生成*
`;
    }
}

module.exports = HolidaysParallelTester;
