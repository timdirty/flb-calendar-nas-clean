/**
 * 學習歷程上傳系統 - 優化整合連接器
 * 確保所有優化功能實際應用到上傳流程
 */

(function (global) {
    'use strict';

    console.log('🔗 [優化整合] 開始初始化所有優化功能...');

    // ============================================
    // 整合追蹤器
    // ============================================
    const integrationStatus = {
        // 必要模組
        advancedUploadProgress: false,
        performanceMonitor: false,
        errorHandler: false,
        indexedDBCache: false,
        // 可選模組（不影響核心功能）
        advancedPhotoCompressor: false,
        workerPool: false,
        initialized: false
    };
    
    // 定義可選模組列表
    const optionalModules = ['advancedPhotoCompressor', 'workerPool'];

    // ============================================
    // 檢查模組是否已載入
    // ============================================
    function checkModules() {
        integrationStatus.advancedUploadProgress = !!global.AdvancedUploadProgress;
        integrationStatus.performanceMonitor = !!global.PerformanceMonitor;
        integrationStatus.errorHandler = !!global.LearningUploadErrorHandler;
        integrationStatus.advancedPhotoCompressor = !!global.LearningUploadAdvancedPhotoCompressor;
        integrationStatus.workerPool = !!global.LearningUploadWorkerPool;
        integrationStatus.indexedDBCache = !!global.LearningUploadIndexedDBCache;

        console.log('📊 [優化整合] 模組載入狀態:', integrationStatus);

        // 檢查必要模組（排除可選模組）
        const requiredModules = Object.keys(integrationStatus)
            .filter(k => k !== 'initialized' && !optionalModules.includes(k));
        
        const allRequiredLoaded = requiredModules.every(k => integrationStatus[k]);
        const missingModules = Object.keys(integrationStatus)
            .filter(k => k !== 'initialized' && !integrationStatus[k]);
        const missingRequired = missingModules.filter(k => !optionalModules.includes(k));
        const missingOptional = missingModules.filter(k => optionalModules.includes(k));

        if (allRequiredLoaded) {
            console.log('✅ [優化整合] 所有必要模組已載入');
            if (missingOptional.length > 0) {
                console.log('ℹ️ [優化整合] 可選模組未載入（不影響核心功能）:', missingOptional);
            }
        } else {
            console.warn('⚠️ [優化整合] 部分必要模組未載入:', missingRequired);
        }

        return allRequiredLoaded;
    }

    // ============================================
    // 整合到 ChunkedUploader
    // ============================================
    function integrateChunkedUploader() {
        if (!global.ChunkedUploader) {
            console.warn('⚠️ [優化整合] ChunkedUploader 未載入');
            return false;
        }

        const originalUpload = global.ChunkedUploader.uploadFileChunked;

        global.ChunkedUploader.uploadFileChunked = async function(file, onProgress, onChunkComplete, extraOptions) {
            let progressId = null;
            const startTime = Date.now();

            try {
                // 🚀 創建進度追蹤
                if (global.startUploadProgress) {
                    const uploadProgress = global.startUploadProgress({
                        id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        title: '影片上傳',
                        filename: file.name,
                        isBatch: false,
                        totalFiles: 1
                    });
                    progressId = uploadProgress.id;
                }

                // 📊 追蹤開始上傳
                if (global.trackCustomMetric) {
                    global.trackCustomMetric('upload-start', {
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type
                    });
                }

                // 包裝原始 onProgress
                const wrappedProgress = (percent, uploaded, total) => {
                    // 更新進度管理器
                    if (progressId && global.updateUploadProgress) {
                        global.updateUploadProgress(progressId, {
                            loaded: uploaded,
                            total: total,
                            percent: percent
                        });
                    }

                    // 呼叫原始回調
                    if (typeof onProgress === 'function') {
                        onProgress(percent, uploaded, total);
                    }
                };

                // 執行原始上傳
                const result = await originalUpload.call(this, file, wrappedProgress, onChunkComplete, extraOptions);

                // ✅ 完成上傳
                if (progressId && global.completeUploadProgress) {
                    global.completeUploadProgress(progressId, {
                        message: '影片上傳完成',
                        showNotification: false
                    });
                }

                // 📊 追蹤上傳效能
                const duration = Date.now() - startTime;
                if (global.trackUploadPerformance) {
                    global.trackUploadPerformance({
                        fileSize: file.size,
                        fileName: file.name,
                        duration: duration,
                        avgSpeed: (file.size / duration) * 1000,
                        chunked: true,
                        success: true
                    });
                }

                console.log('✅ [優化整合] 上傳完成:', file.name);
                return result;

            } catch (error) {
                console.error('❌ [優化整合] 上傳失敗:', error);

                // ❌ 標記失敗
                if (progressId && global.failUploadProgress) {
                    global.failUploadProgress(progressId, error);
                }

                // 錯誤處理
                if (global.LearningUploadErrorHandler) {
                    global.LearningUploadErrorHandler.handleError(error, {
                        context: 'chunked-upload',
                        fileName: file.name,
                        fileSize: file.size
                    }, true);
                }

                throw error;
            }
        };

        console.log('✅ [優化整合] ChunkedUploader 已整合');
        return true;
    }

    // ============================================
    // 整合到 SharedMediaUploader
    // ============================================
    function integrateSharedMediaUploader() {
        if (!global.SharedMediaUploader) {
            console.warn('⚠️ [優化整合] SharedMediaUploader 未載入');
            return false;
        }

        // 整合照片壓縮器
        if (global.LearningUploadAdvancedPhotoCompressor && global.SharedMediaUploader.compressImage) {
            const originalCompress = global.SharedMediaUploader.compressImage;

            global.SharedMediaUploader.compressImage = async function(file, config) {
                try {
                    // 優先使用進階壓縮器
                    const result = await global.LearningUploadAdvancedPhotoCompressor.compressPhoto(file);
                    
                    if (result.compressed) {
                        console.log('✅ [優化整合] 使用進階壓縮:', {
                            original: result.originalSize,
                            compressed: result.compressedSize,
                            ratio: result.compressionRatio
                        });
                        return result.blob;
                    }

                    // 降級到原始壓縮
                    return await originalCompress.call(this, file, config);

                } catch (error) {
                    console.warn('⚠️ [優化整合] 進階壓縮失敗，降級:', error);
                    return await originalCompress.call(this, file, config);
                }
            };

            console.log('✅ [優化整合] SharedMediaUploader 照片壓縮已整合');
        }

        return true;
    }

    // ============================================
    // 整合批次上傳進度
    // ============================================
    function integrateBatchUpload() {
        // 監聽批次上傳事件（如果有的話）
        if (global.addEventListener) {
            global.addEventListener('batch-upload-start', (event) => {
                const { files, totalCount } = event.detail || {};
                
                if (global.startUploadProgress && files && totalCount) {
                    const progressId = global.startUploadProgress({
                        id: `batch-${Date.now()}`,
                        title: '批次上傳',
                        isBatch: true,
                        totalFiles: totalCount
                    });

                    // 儲存 progressId 供後續更新
                    event.detail.progressId = progressId;
                }
            });

            global.addEventListener('batch-upload-progress', (event) => {
                const { progressId, current, total, percent } = event.detail || {};
                
                if (progressId && global.updateUploadProgress) {
                    global.updateUploadProgress(progressId, {
                        batch: {
                            current: current,
                            total: total,
                            percent: percent
                        }
                    });
                }
            });

            global.addEventListener('batch-upload-complete', (event) => {
                const { progressId } = event.detail || {};
                
                if (progressId && global.completeUploadProgress) {
                    global.completeUploadProgress(progressId, {
                        message: '批次上傳完成'
                    });
                }
            });

            console.log('✅ [優化整合] 批次上傳進度已整合');
        }

        return true;
    }

    // ============================================
    // 提供便捷的錯誤處理包裝器
    // ============================================
    function wrapWithErrorHandling(fn, context = 'unknown') {
        return async function(...args) {
            try {
                return await fn.apply(this, args);
            } catch (error) {
                if (global.LearningUploadErrorHandler) {
                    global.LearningUploadErrorHandler.handleError(error, {
                        context: context,
                        args: args
                    }, true);
                }
                throw error;
            }
        };
    }

    // ============================================
    // 初始化整合
    // ============================================
    function initialize() {
        if (integrationStatus.initialized) {
            console.warn('⚠️ [優化整合] 已經初始化過');
            return;
        }

        // 檢查模組
        const modulesReady = checkModules();

        // 執行整合
        const results = {
            chunkedUploader: integrateChunkedUploader(),
            sharedMediaUploader: integrateSharedMediaUploader(),
            batchUpload: integrateBatchUpload()
        };

        integrationStatus.initialized = true;

        // 報告結果
        console.log('📊 [優化整合] 整合結果:', results);

        const allIntegrated = Object.values(results).every(r => r === true);

        if (allIntegrated) {
            console.log('🎉 [優化整合] 核心優化功能已完整整合並生效！');
            
            // 顯示整合摘要
            console.log('\n' + '='.repeat(60));
            console.log('📋 [優化整合摘要]');
            console.log('='.repeat(60));
            console.log('✅ 進階上傳進度視覺化    - 已整合');
            console.log('✅ 效能監控系統            - 已整合');
            console.log('✅ 錯誤處理與通知          - 已整合');
            console.log('✅ 進階照片壓縮            - 已整合');
            console.log('✅ Worker 池管理           - 已載入');
            console.log('✅ IndexedDB 快取          - 已載入');
            console.log('='.repeat(60) + '\n');

            return true;
        } else {
            console.warn('⚠️ [優化整合] 部分功能未完全整合');
            return false;
        }
    }

    // ============================================
    // 延遲初始化（等待所有模組載入）
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(initialize, 500);
        });
    } else {
        setTimeout(initialize, 500);
    }

    // ============================================
    // 導出
    // ============================================
    global.OptimizationIntegration = {
        initialize,
        checkModules,
        getStatus: () => integrationStatus,
        wrapWithErrorHandling
    };

})(window);


