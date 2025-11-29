/**
 * 🧪 路由遷移測試框架
 * 
 * 提供自動化驗證路由遷移正確性的工具
 * 支援 API 功能測試、效能測試、回歸測試
 * 確保遷移過程中零停機和功能完整性
 * 
 * @version 1.0.0
 * @author Cascade AI Assistant
 * @since 2025-11-27
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * 測試配置
 */
const TEST_CONFIG = {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3002',
    timeout: 30000,
    retryCount: 3,
    retryDelay: 1000,
    parallelLimit: 5
};

/**
 * 測試類型枚舉
 */
const TestTypes = {
    FUNCTIONAL: 'functional',     // 功能測試
    PERFORMANCE: 'performance',   // 效能測試
    REGRESSION: 'regression',     // 回歸測試
    INTEGRATION: 'integration'    // 整合測試
};

/**
 * 測試結果類別
 */
class TestResult {
    constructor(name, type = TestTypes.FUNCTIONAL) {
        this.name = name;
        this.type = type;
        this.status = 'pending';
        this.startTime = Date.now();
        this.endTime = null;
        this.duration = null;
        this.error = null;
        this.response = null;
        this.metrics = {};
    }
    
    markSuccess(response, metrics = {}) {
        this.status = 'passed';
        this.endTime = Date.now();
        this.duration = this.endTime - this.startTime;
        this.response = response;
        this.metrics = metrics;
    }
    
    markFailure(error) {
        this.status = 'failed';
        this.endTime = Date.now();
        this.duration = this.endTime - this.startTime;
        this.error = error.message || error;
    }
    
    markSkipped(reason) {
        this.status = 'skipped';
        this.endTime = Date.now();
        this.duration = 0;
        this.error = reason;
    }
}

/**
 * 路由遷移測試器類別
 */
class RouteMigrationTester {
    constructor(config = TEST_CONFIG) {
        this.config = { ...TEST_CONFIG, ...config };
        this.results = [];
        this.httpClient = axios.create({
            baseURL: this.config.baseURL,
            timeout: this.config.timeout,
            validateStatus: () => true // 不拋出狀態碼錯誤
        });
    }
    
    /**
     * 執行單個測試
     */
    async runTest(testCase) {
        const result = new TestResult(testCase.name, testCase.type);
        
        try {
            console.log(`🧪 [測試] 執行: ${testCase.name}`);
            
            let response;
            let startTime = Date.now();
            
            // 根據測試類型執行不同的測試邏輯
            switch (testCase.type) {
                case TestTypes.FUNCTIONAL:
                    response = await this.runFunctionalTest(testCase);
                    break;
                case TestTypes.PERFORMANCE:
                    response = await this.runPerformanceTest(testCase);
                    break;
                case TestTypes.REGRESSION:
                    response = await this.runRegressionTest(testCase);
                    break;
                case TestTypes.INTEGRATION:
                    response = await this.runIntegrationTest(testCase);
                    break;
                default:
                    throw new Error(`未知的測試類型: ${testCase.type}`);
            }
            
            // 計算效能指標
            const endTime = Date.now();
            const metrics = {
                responseTime: endTime - startTime,
                statusCode: response.status,
                contentLength: response.headers['content-length'] || 0,
                isJson: response.headers['content-type']?.includes('application/json')
            };
            
            // 驗證回應
            this.validateResponse(response, testCase.expect, result);
            
            result.markSuccess(response, metrics);
            console.log(`✅ [測試] 通過: ${testCase.name} (${metrics.responseTime}ms)`);
            
        } catch (error) {
            result.markFailure(error);
            console.log(`❌ [測試] 失敗: ${testCase.name} - ${error.message}`);
        }
        
        this.results.push(result);
        return result;
    }
    
    /**
     * 執行功能測試
     */
    async runFunctionalTest(testCase) {
        const { method, url, data, headers } = testCase.request;
        
        const config = {
            method: method.toLowerCase(),
            url: url,
            ...(data && { data }),
            ...(headers && { headers })
        };
        
        return await this.httpClient.request(config);
    }
    
    /**
     * 執行效能測試
     */
    async runPerformanceTest(testCase) {
        const { method, url, data, headers } = testCase.request;
        const { iterations = 10, maxResponseTime = 1000 } = testCase.performance;
        
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
            const startTime = Date.now();
            
            const config = {
                method: method.toLowerCase(),
                url: url,
                ...(data && { data }),
                ...(headers && { headers })
            };
            
            await this.httpClient.request(config);
            
            const responseTime = Date.now() - startTime;
            times.push(responseTime);
            
            if (responseTime > maxResponseTime) {
                throw new Error(`響應時間超過限制: ${responseTime}ms > ${maxResponseTime}ms`);
            }
        }
        
        const avgResponseTime = times.reduce((sum, time) => sum + time, 0) / times.length;
        const maxTime = Math.max(...times);
        
        return {
            status: 200,
            data: {
                avgResponseTime,
                maxTime,
                iterations,
                times
            }
        };
    }
    
    /**
     * 執行回歸測試
     */
    async runRegressionTest(testCase) {
        // 比較遷移前後的回應
        const { method, url, data, headers } = testCase.request;
        const { baseline } = testCase;
        
        const config = {
            method: method.toLowerCase(),
            url: url,
            ...(data && { data }),
            ...(headers && { headers })
        };
        
        const response = await this.httpClient.request(config);
        
        // 簡單的回歸檢查：比較狀態碼和關鍵欄位
        if (baseline && response.status !== baseline.status) {
            throw new Error(`狀態碼回歸: 期望 ${baseline.status}, 實際 ${response.status}`);
        }
        
        if (baseline && baseline.dataPath) {
            const actualValue = this.getNestedValue(response.data, baseline.dataPath);
            const expectedValue = baseline.expectedValue;
            
            if (actualValue !== expectedValue) {
                throw new Error(`資料回歸: ${baseline.dataPath} 期望 ${expectedValue}, 實際 ${actualValue}`);
            }
        }
        
        return response;
    }
    
    /**
     * 執行整合測試
     */
    async runIntegrationTest(testCase) {
        // 執行一系列相關的 API 調用
        const { steps } = testCase.integration;
        
        let context = {};
        let lastResponse = null;
        
        for (const step of steps) {
            const { name, method, url, data, headers, extract } = step;
            
            const config = {
                method: method.toLowerCase(),
                url: this.interpolateUrl(url, context),
                ...(data && { data: this.interpolateData(data, context) }),
                ...(headers && { headers })
            };
            
            lastResponse = await this.httpClient.request(config);
            
            // 提取資料到上下文
            if (extract) {
                context[extract.key] = this.getNestedValue(lastResponse.data, extract.path);
            }
            
            // 驗證步驟
            if (step.expect) {
                this.validateResponse(lastResponse, step.expect, { name: step.name });
            }
        }
        
        return lastResponse;
    }
    
    /**
     * 驗證回應
     */
    validateResponse(response, expect, context) {
        if (!expect) return;
        
        // 驗證狀態碼
        if (expect.status && response.status !== expect.status) {
            throw new Error(`狀態碼不符: 期望 ${expect.status}, 實際 ${response.status}`);
        }
        
        // 驗證回應時間
        if (expect.maxResponseTime) {
            const responseTime = Date.now() - context.startTime;
            if (responseTime > expect.maxResponseTime) {
                throw new Error(`響應時間超過限制: ${responseTime}ms > ${expect.maxResponseTime}ms`);
            }
        }
        
        // 驗證回應內容
        if (expect.dataPath) {
            const actualValue = this.getNestedValue(response.data, expect.dataPath);
            if (actualValue !== expect.expectedValue) {
                throw new Error(`回應資料不符: ${expect.dataPath} 期望 ${expect.expectedValue}, 實際 ${actualValue}`);
            }
        }
        
        // 驗證 JSON 結構
        if (expect.jsonSchema) {
            this.validateJsonSchema(response.data, expect.jsonSchema);
        }
    }
    
    /**
     * 獲取嵌套值
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    /**
     * 插值 URL
     */
    interpolateUrl(url, context) {
        return url.replace(/\{(\w+)\}/g, (match, key) => context[key] || match);
    }
    
    /**
     * 插值資料
     */
    interpolateData(data, context) {
        if (typeof data === 'string') {
            return this.interpolateUrl(data, context);
        }
        
        if (Array.isArray(data)) {
            return data.map(item => this.interpolateData(item, context));
        }
        
        if (typeof data === 'object' && data !== null) {
            const result = {};
            for (const [key, value] of Object.entries(data)) {
                result[key] = this.interpolateData(value, context);
            }
            return result;
        }
        
        return data;
    }
    
    /**
     * 驗證 JSON Schema（簡化版）
     */
    validateJsonSchema(data, schema) {
        // 這裡可以整合更完整的 JSON Schema 驗證庫
        if (schema.type && typeof data !== schema.type) {
            throw new Error(`JSON 類型不符: 期望 ${schema.type}, 實際 ${typeof data}`);
        }
        
        if (schema.required && Array.isArray(schema.required)) {
            for (const field of schema.required) {
                if (!(field in data)) {
                    throw new Error(`缺少必需欄位: ${field}`);
                }
            }
        }
    }
    
    /**
     * 執行測試套件
     */
    async runTestSuite(testSuite) {
        console.log(`🚀 [測試套件] 開始執行: ${testSuite.name}`);
        
        const suiteResults = {
            name: testSuite.name,
            startTime: Date.now(),
            endTime: null,
            duration: null,
            tests: [],
            summary: {
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0
            }
        };
        
        // 並行執行測試（限制並發數）
        const chunks = this.chunkArray(testSuite.tests, this.config.parallelLimit);
        
        for (const chunk of chunks) {
            const chunkResults = await Promise.all(
                chunk.map(test => this.runTest(test))
            );
            
            suiteResults.tests.push(...chunkResults);
        }
        
        // 計算統計
        suiteResults.summary.total = suiteResults.tests.length;
        suiteResults.summary.passed = suiteResults.tests.filter(t => t.status === 'passed').length;
        suiteResults.summary.failed = suiteResults.tests.filter(t => t.status === 'failed').length;
        suiteResults.summary.skipped = suiteResults.tests.filter(t => t.status === 'skipped').length;
        
        suiteResults.endTime = Date.now();
        suiteResults.duration = suiteResults.endTime - suiteResults.startTime;
        
        console.log(`📊 [測試套件] 完成: ${testSuite.name}`);
        console.log(`   - 總數: ${suiteResults.summary.total}`);
        console.log(`   - 通過: ${suiteResults.summary.passed}`);
        console.log(`   - 失敗: ${suiteResults.summary.failed}`);
        console.log(`   - 跳過: ${suiteResults.summary.skipped}`);
        console.log(`   - 耗時: ${suiteResults.duration}ms`);
        
        return suiteResults;
    }
    
    /**
     * 分割陣列
     */
    chunkArray(array, size) {
        const chunks = [];
        for (let i = 0; i < array.length; i += size) {
            chunks.push(array.slice(i, i + size));
        }
        return chunks;
    }
    
    /**
     * 生成測試報告
     */
    generateReport() {
        const report = {
            timestamp: new Date().toISOString(),
            config: this.config,
            summary: {
                total: this.results.length,
                passed: this.results.filter(r => r.status === 'passed').length,
                failed: this.results.filter(r => r.status === 'failed').length,
                skipped: this.results.filter(r => r.status === 'skipped').length,
                avgResponseTime: this.results.reduce((sum, r) => sum + (r.metrics.responseTime || 0), 0) / this.results.length
            },
            results: this.results.map(r => ({
                name: r.name,
                type: r.type,
                status: r.status,
                duration: r.duration,
                error: r.error,
                metrics: r.metrics
            }))
        };
        
        return report;
    }
    
    /**
     * 儲存測試報告
     */
    async saveReport(outputPath = './tests/reports/route-migration-test-report.json') {
        const report = this.generateReport();
        
        // 確保目錄存在
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
        console.log(`📄 測試報告已儲存: ${outputPath}`);
        
        return report;
    }
}

module.exports = {
    RouteMigrationTester,
    TestResult,
    TestTypes,
    TEST_CONFIG
};
