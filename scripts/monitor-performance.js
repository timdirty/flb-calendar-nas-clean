#!/usr/bin/env node

/**
 * 🔍 生產環境效能監控腳本
 * 用於持續監控系統效能並生成報告
 */

const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const http = require('http');

// 設定
const CONFIG = {
    // API 端點
    apiBase: process.env.API_BASE_URL || 'http://localhost:3002',
    
    // 監控間隔（毫秒）
    checkInterval: 60000, // 每分鐘
    
    // 報告輸出
    reportPath: path.join(__dirname, '../logs/performance-monitor.log'),
    alertPath: path.join(__dirname, '../logs/performance-alerts.log'),
    
    // 效能閾值
    thresholds: {
        apiResponseTime: 200,    // ms
        memoryUsage: 1024,       // MB
        cpuUsage: 80,            // %
        errorRate: 1             // %
    }
};

// 監控數據
const monitorData = {
    startTime: new Date(),
    checks: [],
    alerts: [],
    statistics: {
        totalChecks: 0,
        successfulChecks: 0,
        failedChecks: 0,
        averageResponseTime: 0,
        maxResponseTime: 0,
        minResponseTime: Infinity
    }
};

/**
 * 測試 API 端點
 */
async function checkApiEndpoint(endpoint) {
    return new Promise((resolve) => {
        const startTime = performance.now();
        
        http.get(`${CONFIG.apiBase}${endpoint}`, (res) => {
            const endTime = performance.now();
            const responseTime = endTime - startTime;
            
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                resolve({
                    endpoint,
                    statusCode: res.statusCode,
                    responseTime,
                    success: res.statusCode === 200,
                    dataSize: data.length
                });
            });
        }).on('error', (err) => {
            resolve({
                endpoint,
                statusCode: 0,
                responseTime: 0,
                success: false,
                error: err.message
            });
        });
    });
}

/**
 * 檢查記憶體使用
 */
function checkMemoryUsage() {
    const usage = process.memoryUsage();
    return {
        rss: Math.round(usage.rss / 1024 / 1024),        // MB
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024)
    };
}

/**
 * 執行效能檢查
 */
async function performCheck() {
    console.log(`\n⏰ [${new Date().toISOString()}] 開始效能檢查...`);
    
    const checkResult = {
        timestamp: new Date().toISOString(),
        apis: [],
        memory: null,
        alerts: []
    };
    
    // 1. 檢查 API 端點
    const endpoints = [
        '/health',
        '/api/events',
        '/api/students',
        '/api/system-config'
    ];
    
    for (const endpoint of endpoints) {
        const result = await checkApiEndpoint(endpoint);
        checkResult.apis.push(result);
        
        // 檢查是否超過閾值
        if (result.responseTime > CONFIG.thresholds.apiResponseTime) {
            const alert = `⚠️ API 響應時間過長: ${endpoint} - ${result.responseTime.toFixed(2)}ms`;
            checkResult.alerts.push(alert);
            console.warn(alert);
        }
        
        if (!result.success) {
            const alert = `❌ API 錯誤: ${endpoint} - ${result.error || `狀態碼 ${result.statusCode}`}`;
            checkResult.alerts.push(alert);
            console.error(alert);
        }
    }
    
    // 2. 檢查記憶體使用
    checkResult.memory = checkMemoryUsage();
    
    if (checkResult.memory.heapUsed > CONFIG.thresholds.memoryUsage) {
        const alert = `⚠️ 記憶體使用過高: ${checkResult.memory.heapUsed}MB`;
        checkResult.alerts.push(alert);
        console.warn(alert);
    }
    
    // 3. 更新統計
    monitorData.checks.push(checkResult);
    monitorData.statistics.totalChecks++;
    
    const successfulApis = checkResult.apis.filter(api => api.success).length;
    if (successfulApis === checkResult.apis.length) {
        monitorData.statistics.successfulChecks++;
    } else {
        monitorData.statistics.failedChecks++;
    }
    
    // 計算平均響應時間
    const avgTime = checkResult.apis.reduce((sum, api) => sum + api.responseTime, 0) / checkResult.apis.length;
    monitorData.statistics.averageResponseTime = 
        (monitorData.statistics.averageResponseTime * (monitorData.statistics.totalChecks - 1) + avgTime) 
        / monitorData.statistics.totalChecks;
    
    // 更新最大/最小響應時間
    checkResult.apis.forEach(api => {
        if (api.responseTime > monitorData.statistics.maxResponseTime) {
            monitorData.statistics.maxResponseTime = api.responseTime;
        }
        if (api.responseTime < monitorData.statistics.minResponseTime) {
            monitorData.statistics.minResponseTime = api.responseTime;
        }
    });
    
    // 4. 記錄到檔案
    await logResults(checkResult);
    
    // 5. 顯示摘要
    console.log('📊 檢查完成:');
    console.log(`  - API 成功率: ${(successfulApis / checkResult.apis.length * 100).toFixed(1)}%`);
    console.log(`  - 平均響應時間: ${avgTime.toFixed(2)}ms`);
    console.log(`  - 記憶體使用: ${checkResult.memory.heapUsed}MB`);
    
    if (checkResult.alerts.length > 0) {
        console.log(`  - 警報數量: ${checkResult.alerts.length}`);
    }
    
    return checkResult;
}

/**
 * 記錄結果到檔案
 */
async function logResults(checkResult) {
    // 確保日誌目錄存在
    const logDir = path.dirname(CONFIG.reportPath);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    // 記錄一般日誌
    const logLine = JSON.stringify(checkResult) + '\n';
    fs.appendFileSync(CONFIG.reportPath, logLine);
    
    // 記錄警報
    if (checkResult.alerts.length > 0) {
        const alertLines = checkResult.alerts.map(alert => 
            `[${checkResult.timestamp}] ${alert}\n`
        ).join('');
        fs.appendFileSync(CONFIG.alertPath, alertLines);
    }
}

/**
 * 生成報告
 */
function generateReport() {
    const runTime = (Date.now() - monitorData.startTime) / 1000; // 秒
    const runHours = (runTime / 3600).toFixed(2);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 效能監控報告');
    console.log('='.repeat(60));
    console.log(`運行時間: ${runHours} 小時`);
    console.log(`總檢查次數: ${monitorData.statistics.totalChecks}`);
    console.log(`成功次數: ${monitorData.statistics.successfulChecks}`);
    console.log(`失敗次數: ${monitorData.statistics.failedChecks}`);
    console.log(`成功率: ${(monitorData.statistics.successfulChecks / monitorData.statistics.totalChecks * 100).toFixed(2)}%`);
    console.log(`平均響應時間: ${monitorData.statistics.averageResponseTime.toFixed(2)}ms`);
    console.log(`最快響應: ${monitorData.statistics.minResponseTime.toFixed(2)}ms`);
    console.log(`最慢響應: ${monitorData.statistics.maxResponseTime.toFixed(2)}ms`);
    console.log(`總警報數: ${monitorData.alerts.length}`);
    console.log('='.repeat(60));
    
    // 儲存詳細報告
    const reportFile = path.join(__dirname, `../logs/performance-report-${Date.now()}.json`);
    fs.writeFileSync(reportFile, JSON.stringify(monitorData, null, 2));
    console.log(`\n📄 詳細報告已儲存至: ${reportFile}`);
}

/**
 * 處理退出信號
 */
function handleExit() {
    console.log('\n\n🛑 監控停止中...');
    generateReport();
    process.exit(0);
}

// 註冊退出處理
process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

/**
 * 主程式
 */
async function main() {
    console.log('🚀 效能監控啟動');
    console.log(`監控間隔: ${CONFIG.checkInterval / 1000} 秒`);
    console.log(`API 端點: ${CONFIG.apiBase}`);
    console.log('按 Ctrl+C 停止監控並生成報告\n');
    
    // 立即執行第一次檢查
    await performCheck();
    
    // 定期執行檢查
    setInterval(async () => {
        await performCheck();
        
        // 每小時生成一次摘要
        if (monitorData.statistics.totalChecks % 60 === 0) {
            console.log('\n📈 每小時摘要:');
            generateReport();
        }
    }, CONFIG.checkInterval);
}

// 啟動監控
main().catch(error => {
    console.error('❌ 監控啟動失敗:', error);
    process.exit(1);
});
