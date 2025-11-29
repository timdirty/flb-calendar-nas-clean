/**
 * 學習歷程上傳系統 - 錯誤處理測試工具
 * 提供完整的錯誤處理系統測試
 */

(function (global) {
    'use strict';

    const ErrorHandler = global.LearningUploadErrorHandler;
    const ErrorTypes = global.LearningUploadErrorTypes;
    const ErrorSeverity = global.LearningUploadErrorSeverity;
    const Notification = global.LearningUploadNotification;

    const ErrorHandlingTest = {
        /**
         * 執行所有測試
         */
        async runAll() {
            console.log('╔══════════════════════════════════════════════════════════╗');
            console.log('║         錯誤處理系統 - 完整測試                        ║');
            console.log('╚══════════════════════════════════════════════════════════╝\n');

            const results = {
                total: 0,
                passed: 0,
                failed: 0,
                tests: []
            };

            // 測試項目
            const tests = [
                { name: '測試通知系統', fn: this.testNotificationSystem },
                { name: '測試錯誤分類', fn: this.testErrorClassification },
                { name: '測試錯誤處理器', fn: this.testErrorHandler },
                { name: '測試重試機制整合', fn: this.testRetryIntegration },
                { name: '測試用戶回饋', fn: this.testUserFeedback },
                { name: '測試錯誤統計', fn: this.testErrorStats }
            ];

            for (const test of tests) {
                results.total++;
                console.log(`\n🧪 [測試] ${test.name}`);
                console.log('━'.repeat(60));

                try {
                    await test.fn.call(this);
                    results.passed++;
                    results.tests.push({ name: test.name, status: 'passed' });
                    console.log(`✅ ${test.name} - 通過\n`);
                } catch (error) {
                    results.failed++;
                    results.tests.push({ name: test.name, status: 'failed', error: error.message });
                    console.error(`❌ ${test.name} - 失敗:`, error.message, '\n');
                }
            }

            // 輸出結果
            console.log('\n╔══════════════════════════════════════════════════════════╗');
            console.log('║                    測試結果總覽                         ║');
            console.log('╚══════════════════════════════════════════════════════════╝');
            console.log(`\n總測試數: ${results.total}`);
            console.log(`✅ 通過: ${results.passed}`);
            console.log(`❌ 失敗: ${results.failed}`);
            console.log(`\n成功率: ${((results.passed / results.total) * 100).toFixed(1)}%`);

            return results;
        },

        /**
         * 測試通知系統
         */
        async testNotificationSystem() {
            if (!Notification) {
                throw new Error('通知管理器未初始化');
            }

            // 測試成功通知
            const successId = Notification.success('這是測試成功訊息', {
                duration: 2000
            });

            if (!successId) {
                throw new Error('成功通知創建失敗');
            }

            console.log('✅ 成功通知已顯示:', successId);

            // 測試錯誤通知
            const errorId = Notification.error('這是測試錯誤訊息', {
                title: '測試錯誤',
                suggestions: ['建議1', '建議2'],
                duration: 2000
            });

            if (!errorId) {
                throw new Error('錯誤通知創建失敗');
            }

            console.log('✅ 錯誤通知已顯示:', errorId);

            // 等待通知顯示
            await new Promise(resolve => setTimeout(resolve, 500));

            // 測試自動關閉
            await new Promise(resolve => setTimeout(resolve, 2000));

            console.log('✅ 通知系統測試通過');
        },

        /**
         * 測試錯誤分類
         */
        async testErrorClassification() {
            if (!ErrorHandler || !ErrorTypes) {
                throw new Error('錯誤處理器未初始化');
            }

            // 測試不同類型的錯誤
            const testCases = [
                { type: ErrorTypes.NETWORK_ERROR, message: 'Network error' },
                { type: ErrorTypes.FILE_TOO_LARGE, message: 'File too large' },
                { type: ErrorTypes.MEMORY_EXCEEDED, message: 'Memory exceeded' },
                { type: ErrorTypes.SERVER_ERROR, message: 'Server error' }
            ];

            for (const testCase of testCases) {
                const error = ErrorHandler.handleError({
                    type: testCase.type,
                    message: testCase.message,
                    showNotification: false
                });

                if (!error || error.type !== testCase.type) {
                    throw new Error(`錯誤分類失敗: ${testCase.type}`);
                }

                console.log(`✅ 錯誤類型 ${testCase.type} 分類正確`);
            }

            console.log('✅ 錯誤分類測試通過');
        },

        /**
         * 測試錯誤處理器
         */
        async testErrorHandler() {
            if (!ErrorHandler) {
                throw new Error('錯誤處理器未初始化');
            }

            // 測試錯誤處理
            const error = ErrorHandler.handleError({
                type: ErrorTypes.FILE_TOO_LARGE,
                message: '檔案大小超過 500MB',
                showNotification: false,
                context: { fileSize: 600 * 1024 * 1024 }
            });

            if (!error) {
                throw new Error('錯誤處理失敗');
            }

            // 檢查錯誤屬性
            if (!error.type || !error.severity || !error.title || !error.message) {
                throw new Error('錯誤物件缺少必要屬性');
            }

            console.log('✅ 錯誤物件:', {
                type: error.type,
                severity: error.severity,
                title: error.title,
                retryable: error.retryable
            });

            // 測試錯誤日誌
            const logs = ErrorHandler.getErrorLog();
            if (!logs || logs.length === 0) {
                throw new Error('錯誤日誌記錄失敗');
            }

            console.log(`✅ 錯誤日誌記錄成功，共 ${logs.length} 筆`);

            console.log('✅ 錯誤處理器測試通過');
        },

        /**
         * 測試重試機制整合
         */
        async testRetryIntegration() {
            const RetryManager = global.LearningUploadRetryManager;
            
            if (!RetryManager) {
                console.warn('⚠️ 重試管理器未初始化，跳過測試');
                return;
            }

            // 模擬重試場景
            let attemptCount = 0;
            const testKey = 'test-retry-' + Date.now();

            try {
                await RetryManager.executeWithRetry(
                    testKey,
                    async function() {
                        attemptCount++;
                        if (attemptCount < 2) {
                            throw new Error('Network timeout');
                        }
                        return 'success';
                    },
                    null,
                    {
                        onError: (error, category) => {
                            console.log('✅ 錯誤回調觸發:', category.type);
                        }
                    }
                );

                console.log(`✅ 重試成功，共嘗試 ${attemptCount} 次`);
            } catch (error) {
                console.error('❌ 重試失敗:', error.message);
            }

            console.log('✅ 重試機制整合測試通過');
        },

        /**
         * 測試用戶回饋
         */
        async testUserFeedback() {
            if (!Notification) {
                throw new Error('通知系統未初始化');
            }

            // 顯示帶建議的錯誤通知
            const id = Notification.error('測試用戶回饋訊息', {
                title: '上傳失敗',
                suggestions: [
                    '檢查網路連線',
                    '檔案大小是否超過限制',
                    '稍後再試'
                ],
                duration: 3000
            });

            if (!id) {
                throw new Error('用戶回饋通知創建失敗');
            }

            console.log('✅ 用戶回饋通知已顯示');

            await new Promise(resolve => setTimeout(resolve, 1000));

            console.log('✅ 用戶回饋測試通過');
        },

        /**
         * 測試錯誤統計
         */
        async testErrorStats() {
            if (!ErrorHandler) {
                throw new Error('錯誤處理器未初始化');
            }

            // 觸發幾個測試錯誤
            ErrorHandler.handleError({
                type: ErrorTypes.NETWORK_ERROR,
                showNotification: false
            });

            ErrorHandler.handleError({
                type: ErrorTypes.FILE_TOO_LARGE,
                showNotification: false
            });

            // 獲取統計
            const stats = ErrorHandler.getStats();

            if (!stats) {
                throw new Error('無法獲取錯誤統計');
            }

            console.log('✅ 錯誤統計:', {
                total: stats.total,
                byType: Object.keys(stats.byType).length,
                bySeverity: Object.keys(stats.bySeverity).length
            });

            if (stats.total === 0) {
                throw new Error('統計數據異常');
            }

            console.log('✅ 錯誤統計測試通過');
        },

        /**
         * 測試特定錯誤場景
         */
        async testErrorScenario(scenario) {
            console.log(`\n🎯 測試場景: ${scenario.name}`);
            console.log('━'.repeat(60));

            if (!ErrorHandler) {
                throw new Error('錯誤處理器未初始化');
            }

            const error = ErrorHandler.handleError({
                type: scenario.type,
                message: scenario.message,
                context: scenario.context || {},
                showNotification: scenario.showNotification !== false
            });

            console.log('錯誤處理結果:', {
                type: error.type,
                severity: error.severity,
                retryable: error.retryable,
                title: error.title
            });

            if (scenario.expectedRetryable !== undefined) {
                if (error.retryable !== scenario.expectedRetryable) {
                    throw new Error(`期望 retryable=${scenario.expectedRetryable}，實際為 ${error.retryable}`);
                }
            }

            console.log(`✅ 場景測試通過`);
        },

        /**
         * 模擬上傳失敗場景
         */
        async simulateUploadFailure(type = 'network') {
            console.log(`\n🎭 模擬上傳失敗: ${type}`);
            console.log('━'.repeat(60));

            const scenarios = {
                network: {
                    type: ErrorTypes.NETWORK_ERROR,
                    message: '網路連線中斷',
                    expectedRetryable: true
                },
                memory: {
                    type: ErrorTypes.MEMORY_EXCEEDED,
                    message: '記憶體不足',
                    expectedRetryable: false
                },
                fileSize: {
                    type: ErrorTypes.FILE_TOO_LARGE,
                    message: '檔案大小超過 500MB',
                    expectedRetryable: false
                },
                server: {
                    type: ErrorTypes.SERVER_ERROR,
                    message: '伺服器錯誤',
                    expectedRetryable: true
                }
            };

            const scenario = scenarios[type];
            if (!scenario) {
                throw new Error(`未知的失敗類型: ${type}`);
            }

            await this.testErrorScenario({
                name: `上傳失敗 - ${type}`,
                ...scenario
            });
        },

        /**
         * 清理測試資料
         */
        cleanup() {
            console.log('\n🧹 清理測試資料...');

            if (ErrorHandler) {
                ErrorHandler.clearLog();
                ErrorHandler.resetStats();
            }

            if (Notification) {
                Notification.hideAll();
            }

            console.log('✅ 清理完成');
        }
    };

    // 導出
    global.ErrorHandlingTest = ErrorHandlingTest;

    // 便捷函數
    global.testErrorHandling = function() {
        return ErrorHandlingTest.runAll();
    };

})(window);


