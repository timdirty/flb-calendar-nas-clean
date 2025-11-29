/**
 * 學習歷程上傳系統 - 整合驗證工具
 * 自動檢查所有優化功能是否正確整合
 */

(function (global) {
    'use strict';

    const IntegrationVerification = {
        /**
         * 完整驗證所有整合
         */
        runFullVerification() {
            console.log('\n' + '='.repeat(70));
            console.log('🔍 [整合驗證] 開始完整驗證...');
            console.log('='.repeat(70) + '\n');

            const results = {
                modules: this.verifyModules(),
                integration: this.verifyIntegration(),
                functionality: this.verifyFunctionality()
            };

            this.printReport(results);

            return results;
        },

        /**
         * 驗證所有模組是否已載入
         */
        verifyModules() {
            console.log('📦 [模組驗證] 檢查所有必要模組...\n');

            const modules = [
                { name: 'AdvancedUploadProgress', path: 'window.AdvancedUploadProgress', description: '進階上傳進度' },
                { name: 'PerformanceMonitor', path: 'window.PerformanceMonitor', description: '效能監控' },
                { name: 'LearningUploadErrorHandler', path: 'window.LearningUploadErrorHandler', description: '錯誤處理器' },
                { name: 'LearningUploadUserNotification', path: 'window.LearningUploadUserNotification', description: '用戶通知' },
                { name: 'LearningUploadAdvancedPhotoCompressor', path: 'window.LearningUploadAdvancedPhotoCompressor', description: '進階照片壓縮' },
                { name: 'LearningUploadWorkerPool', path: 'window.LearningUploadWorkerPool', description: 'Worker 池' },
                { name: 'LearningUploadIndexedDBCache', path: 'window.LearningUploadIndexedDBCache', description: 'IndexedDB 快取' },
                { name: 'LearningUploadVideoPosterManager', path: 'window.LearningUploadVideoPosterManager', description: '影片縮圖管理' },
                { name: 'SharedMediaUploader', path: 'window.SharedMediaUploader', description: '共用媒體上傳器' },
                { name: 'ChunkedUploader', path: 'window.ChunkedUploader', description: '分片上傳器' }
            ];

            const results = modules.map(module => {
                const exists = this.getNestedProperty(global, module.path);
                const status = exists ? '✅' : '❌';
                
                console.log(`  ${status} ${module.description.padEnd(20)} (${module.name})`);
                
                return {
                    name: module.name,
                    path: module.path,
                    description: module.description,
                    loaded: !!exists
                };
            });

            const loadedCount = results.filter(r => r.loaded).length;
            console.log(`\n  總計: ${loadedCount}/${results.length} 個模組已載入\n`);

            return results;
        },

        /**
         * 驗證整合狀態
         */
        verifyIntegration() {
            console.log('🔗 [整合驗證] 檢查功能整合狀態...\n');

            const integrations = [
                {
                    name: '上傳進度追蹤',
                    check: () => {
                        return typeof global.startUploadProgress === 'function' &&
                               typeof global.updateUploadProgress === 'function' &&
                               typeof global.completeUploadProgress === 'function';
                    }
                },
                {
                    name: '效能監控追蹤',
                    check: () => {
                        return typeof global.trackUploadPerformance === 'function' &&
                               typeof global.trackCustomMetric === 'function';
                    }
                },
                {
                    name: '錯誤處理系統',
                    check: () => {
                        return global.LearningUploadErrorHandler && 
                               typeof global.LearningUploadErrorHandler.handleError === 'function';
                    }
                },
                {
                    name: '用戶通知系統',
                    check: () => {
                        return global.LearningUploadUserNotification && 
                               typeof global.LearningUploadUserNotification.success === 'function';
                    }
                },
                {
                    name: 'ChunkedUploader 整合',
                    check: () => {
                        // 檢查函數是否被包裝過
                        const fn = global.ChunkedUploader?.uploadFileChunked;
                        return fn && fn.toString().includes('progressId');
                    }
                },
                {
                    name: 'Worker 池啟用',
                    check: () => {
                        return global.LearningUploadWorkerPool && 
                               global.LearningUploadWorkerPool.workers && 
                               global.LearningUploadWorkerPool.workers.length > 0;
                    }
                },
                {
                    name: 'IndexedDB 快取就緒',
                    check: () => {
                        return global.LearningUploadIndexedDBCache && 
                               global.LearningUploadIndexedDBCache.db !== null;
                    }
                }
            ];

            const results = integrations.map(integration => {
                let integrated = false;
                let error = null;

                try {
                    integrated = integration.check();
                } catch (e) {
                    error = e.message;
                }

                const status = integrated ? '✅' : '❌';
                console.log(`  ${status} ${integration.name}${error ? ` (錯誤: ${error})` : ''}`);

                return {
                    name: integration.name,
                    integrated: integrated,
                    error: error
                };
            });

            const integratedCount = results.filter(r => r.integrated).length;
            console.log(`\n  總計: ${integratedCount}/${results.length} 項功能已整合\n`);

            return results;
        },

        /**
         * 驗證功能可用性
         */
        verifyFunctionality() {
            console.log('⚙️  [功能驗證] 測試核心功能...\n');

            const tests = [
                {
                    name: '創建上傳進度',
                    test: () => {
                        if (!global.startUploadProgress) return false;
                        
                        const progress = global.startUploadProgress({
                            id: 'test-progress',
                            title: '測試上傳',
                            filename: 'test.mp4'
                        });
                        
                        const created = !!progress && !!progress.id;
                        
                        // 清理
                        if (created && global.AdvancedUploadProgress) {
                            global.AdvancedUploadProgress.removeUpload(progress.id);
                        }
                        
                        return created;
                    }
                },
                {
                    name: '效能監控報告',
                    test: () => {
                        if (!global.getPerformanceReport) return false;
                        
                        const report = global.getPerformanceReport();
                        return !!report && !!report.sessionId;
                    }
                },
                {
                    name: '錯誤分類',
                    test: () => {
                        if (!global.LearningUploadErrorTypes) return false;
                        
                        return global.LearningUploadErrorTypes.NETWORK === 'NETWORK' &&
                               global.LearningUploadErrorTypes.MEMORY === 'MEMORY';
                    }
                },
                {
                    name: 'Worker 池任務提交',
                    test: () => {
                        if (!global.LearningUploadWorkerPool) return false;
                        
                        return typeof global.LearningUploadWorkerPool.submitTask === 'function';
                    }
                },
                {
                    name: 'IndexedDB 快取操作',
                    test: () => {
                        if (!global.LearningUploadIndexedDBCache) return false;
                        
                        return typeof global.LearningUploadIndexedDBCache.get === 'function' &&
                               typeof global.LearningUploadIndexedDBCache.put === 'function';
                    }
                },
                {
                    name: '記憶體狀態檢查',
                    test: () => {
                        if (!global.SharedMediaUploader) return false;
                        
                        return typeof global.SharedMediaUploader.checkMemoryPressure === 'function';
                    }
                }
            ];

            const results = tests.map(test => {
                let passed = false;
                let error = null;

                try {
                    passed = test.test();
                } catch (e) {
                    error = e.message;
                }

                const status = passed ? '✅' : '❌';
                console.log(`  ${status} ${test.name}${error ? ` (錯誤: ${error})` : ''}`);

                return {
                    name: test.name,
                    passed: passed,
                    error: error
                };
            });

            const passedCount = results.filter(r => r.passed).length;
            console.log(`\n  總計: ${passedCount}/${results.length} 項測試通過\n`);

            return results;
        },

        /**
         * 打印完整報告
         */
        printReport(results) {
            console.log('='.repeat(70));
            console.log('📊 [整合驗證] 完整報告');
            console.log('='.repeat(70) + '\n');

            // 模組載入統計
            const modulesLoaded = results.modules.filter(m => m.loaded).length;
            const modulesTotal = results.modules.length;
            const modulesPercent = ((modulesLoaded / modulesTotal) * 100).toFixed(0);

            console.log(`📦 模組載入: ${modulesLoaded}/${modulesTotal} (${modulesPercent}%)`);

            // 功能整合統計
            const integrationsComplete = results.integration.filter(i => i.integrated).length;
            const integrationsTotal = results.integration.length;
            const integrationsPercent = ((integrationsComplete / integrationsTotal) * 100).toFixed(0);

            console.log(`🔗 功能整合: ${integrationsComplete}/${integrationsTotal} (${integrationsPercent}%)`);

            // 功能測試統計
            const testsPassed = results.functionality.filter(f => f.passed).length;
            const testsTotal = results.functionality.length;
            const testsPercent = ((testsPassed / testsTotal) * 100).toFixed(0);

            console.log(`⚙️  功能測試: ${testsPassed}/${testsTotal} (${testsPercent}%)\n`);

            // 整體狀態
            const overallPercent = ((modulesLoaded + integrationsComplete + testsPassed) / 
                                   (modulesTotal + integrationsTotal + testsTotal) * 100).toFixed(0);

            console.log(`⭐ 整體完成度: ${overallPercent}%\n`);

            // 評級
            let rating, message;
            if (overallPercent >= 95) {
                rating = 'A+';
                message = '🎉 優秀！所有優化功能已完整整合並生效！';
            } else if (overallPercent >= 85) {
                rating = 'A';
                message = '✅ 良好！大部分優化功能已整合，系統可用。';
            } else if (overallPercent >= 70) {
                rating = 'B';
                message = '⚠️  一般。部分功能未整合，建議檢查。';
            } else {
                rating = 'C';
                message = '❌ 需要改進。多項功能未整合，請排查問題。';
            }

            console.log(`📈 評級: ${rating}`);
            console.log(`💬 狀態: ${message}\n`);

            // 問題列表
            const issues = [];

            results.modules.filter(m => !m.loaded).forEach(m => {
                issues.push(`模組未載入: ${m.description}`);
            });

            results.integration.filter(i => !i.integrated).forEach(i => {
                issues.push(`功能未整合: ${i.name}${i.error ? ` (${i.error})` : ''}`);
            });

            results.functionality.filter(f => !f.passed).forEach(f => {
                issues.push(`測試未通過: ${f.name}${f.error ? ` (${f.error})` : ''}`);
            });

            if (issues.length > 0) {
                console.log('⚠️  發現的問題:\n');
                issues.forEach((issue, index) => {
                    console.log(`  ${index + 1}. ${issue}`);
                });
                console.log('');
            }

            console.log('='.repeat(70) + '\n');

            return {
                rating,
                overallPercent: parseFloat(overallPercent),
                issues
            };
        },

        /**
         * 取得嵌套屬性
         */
        getNestedProperty(obj, path) {
            const parts = path.replace('window.', '').split('.');
            let current = obj;

            for (const part of parts) {
                if (current && typeof current === 'object' && part in current) {
                    current = current[part];
                } else {
                    return undefined;
                }
            }

            return current;
        }
    };

    // 導出
    global.IntegrationVerification = IntegrationVerification;

    // 便捷函數
    global.verifyIntegration = function() {
        return IntegrationVerification.runFullVerification();
    };

    console.log('✅ [整合驗證] 驗證工具已載入');
    console.log('💡 使用 verifyIntegration() 來執行完整驗證');

})(window);


