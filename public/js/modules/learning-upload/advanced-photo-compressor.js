/**
 * 學習歷程上傳系統 - 進階照片壓縮器
 * 提供智能動態壓縮策略與批次處理優化
 */

(function (global) {
    'use strict';

    const ErrorHandler = global.LearningUploadErrorHandler;
    const ErrorTypes = global.LearningUploadErrorTypes;

    // ============================================
    // 動態壓縮策略配置
    // ============================================
    const CompressionProfiles = {
        // 極小檔案（< 500KB）- 跳過壓縮
        TINY: {
            threshold: 500 * 1024,
            quality: 1.0,
            maxDimension: 0, // 不調整尺寸
            skip: true,
            name: '極小檔案'
        },
        // 小檔案（500KB - 1MB）- 輕度壓縮
        SMALL: {
            threshold: 1 * 1024 * 1024,
            quality: 0.92,
            maxDimension: 2400,
            name: '小檔案'
        },
        // 中檔案（1MB - 3MB）- 標準壓縮
        MEDIUM: {
            threshold: 3 * 1024 * 1024,
            quality: 0.88,
            maxDimension: 2048,
            name: '中檔案'
        },
        // 大檔案（3MB - 10MB）- 中度壓縮
        LARGE: {
            threshold: 10 * 1024 * 1024,
            quality: 0.82,
            maxDimension: 1920,
            name: '大檔案'
        },
        // 超大檔案（> 10MB）- 強力壓縮
        HUGE: {
            threshold: Infinity,
            quality: 0.75,
            maxDimension: 1600,
            name: '超大檔案'
        }
    };

    // ============================================
    // 進階照片壓縮器
    // ============================================
    class AdvancedPhotoCompressor {
        constructor() {
            this.isProcessing = false;
            this.stats = {
                total: 0,
                compressed: 0,
                skipped: 0,
                failed: 0,
                totalOriginalSize: 0,
                totalCompressedSize: 0
            };
            
            // 批次處理配置
            this.batchConfig = {
                batchSize: 3,      // 每批處理 3 張（避免記憶體壓力）
                delayMs: 100,      // 批次間隔 100ms
                maxConcurrent: 2   // 最多 2 張同時處理
            };
        }

        /**
         * 選擇壓縮配置（基於檔案大小）
         */
        selectCompressionProfile(fileSize) {
            if (fileSize < CompressionProfiles.TINY.threshold) {
                return CompressionProfiles.TINY;
            } else if (fileSize < CompressionProfiles.SMALL.threshold) {
                return CompressionProfiles.SMALL;
            } else if (fileSize < CompressionProfiles.MEDIUM.threshold) {
                return CompressionProfiles.MEDIUM;
            } else if (fileSize < CompressionProfiles.LARGE.threshold) {
                return CompressionProfiles.LARGE;
            } else {
                return CompressionProfiles.HUGE;
            }
        }

        /**
         * 壓縮單張照片（動態品質）
         */
        async compressSingle(file, options = {}) {
            if (!file || !file.type.startsWith('image/')) {
                throw new Error('不是有效的圖片檔案');
            }

            const startTime = performance.now();
            
            try {
                // 選擇壓縮配置
                const profile = this.selectCompressionProfile(file.size);
                
                console.log(`📸 [進階壓縮] ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB) - 使用配置: ${profile.name}`);

                // 跳過極小檔案
                if (profile.skip) {
                    console.log('✅ [進階壓縮] 檔案已經夠小，跳過壓縮');
                    return {
                        blob: file,
                        originalSize: file.size,
                        compressedSize: file.size,
                        savings: 0,
                        skipped: true,
                        reason: profile.name,
                        duration: 0
                    };
                }

                // 檢查是否為 HEIC
                if (this.isHEICFormat(file)) {
                    console.warn('⚠️ [進階壓縮] HEIC 格式，需要轉換');
                    return await this.handleHEICFile(file, profile);
                }

                // 讀取並壓縮圖片
                const imageData = await this.readFileAsDataURL(file);
                const img = await this.loadImage(imageData);

                // 計算目標尺寸
                let { width, height } = img;
                
                if (profile.maxDimension > 0) {
                    const maxDim = Math.max(width, height);
                    if (maxDim > profile.maxDimension) {
                        const ratio = profile.maxDimension / maxDim;
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                        console.log(`📐 [進階壓縮] 調整尺寸: ${img.width}x${img.height} → ${width}x${height}`);
                    }
                }

                // Canvas 壓縮
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d', {
                    alpha: file.type === 'image/png',
                    desynchronized: true
                });

                // 高品質繪製
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, width, height);

                // 轉換為 Blob
                const outputFormat = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                const blob = await this.canvasToBlob(canvas, outputFormat, profile.quality);

                // 清理 Canvas
                ctx.clearRect(0, 0, width, height);
                canvas.width = 0;
                canvas.height = 0;

                // 統計
                const duration = performance.now() - startTime;
                const originalSize = file.size;
                const compressedSize = blob.size;
                const savings = ((1 - compressedSize / originalSize) * 100);

                // 如果壓縮後反而更大，使用原檔
                if (compressedSize >= originalSize) {
                    console.log('ℹ️ [進階壓縮] 壓縮後體積未減少，使用原檔');
                    return {
                        blob: file,
                        originalSize,
                        compressedSize: originalSize,
                        savings: 0,
                        skipped: true,
                        reason: '壓縮無效',
                        duration: Math.round(duration)
                    };
                }

                console.log(`✅ [進階壓縮] 完成: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (節省 ${savings.toFixed(1)}%) - ${duration.toFixed(0)}ms`);

                return {
                    blob,
                    originalSize,
                    compressedSize,
                    savings: savings,
                    duration: Math.round(duration),
                    skipped: false,
                    quality: profile.quality,
                    profile: profile.name
                };

            } catch (error) {
                console.error('❌ [進階壓縮] 壓縮失敗:', error);
                
                // 使用錯誤處理器
                if (ErrorHandler) {
                    ErrorHandler.handleError({
                        type: ErrorTypes.COMPRESSION_FAILED,
                        originalError: error,
                        context: { filename: file.name },
                        showNotification: false
                    });
                }

                // 返回原檔案
                return {
                    blob: file,
                    originalSize: file.size,
                    compressedSize: file.size,
                    savings: 0,
                    skipped: true,
                    error: error.message,
                    duration: 0
                };
            }
        }

        /**
         * 批次壓縮（優化版）
         */
        async compressBatch(files, options = {}) {
            if (this.isProcessing) {
                throw new Error('批次壓縮正在進行中');
            }

            this.isProcessing = true;
            this.resetStats();

            const {
                onProgress,
                onSingleComplete,
                onBatchStart,
                onBatchComplete,
                onError,
                ...compressOptions
            } = options;

            const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
            const total = fileArray.length;
            const results = [];

            console.log(`🚀 [批次壓縮] 開始處理 ${total} 張照片`);
            
            if (typeof onBatchStart === 'function') {
                onBatchStart(total);
            }

            const startTime = Date.now();

            try {
                // 分批處理
                for (let i = 0; i < fileArray.length; i += this.batchConfig.batchSize) {
                    const batch = fileArray.slice(i, i + this.batchConfig.batchSize);
                    
                    console.log(`📦 [批次壓縮] 處理第 ${Math.floor(i / this.batchConfig.batchSize) + 1} 批 (${batch.length} 張)`);

                    // 並發處理當前批次（限制並發數）
                    const batchPromises = batch.map((file, batchIndex) => {
                        return this.compressSingleWithDelay(
                            file,
                            compressOptions,
                            batchIndex * (this.batchConfig.delayMs / this.batchConfig.batchSize)
                        );
                    });

                    const batchResults = await Promise.allSettled(batchPromises);

                    // 處理結果
                    batchResults.forEach((result, batchIndex) => {
                        const globalIndex = i + batchIndex;
                        
                        if (result.status === 'fulfilled') {
                            const data = result.value;
                            results.push(data);
                            
                            // 更新統計
                            this.updateStats(data);

                            // 單張完成回調
                            if (typeof onSingleComplete === 'function') {
                                onSingleComplete(data, globalIndex + 1, total);
                            }
                        } else {
                            console.error(`❌ [批次壓縮] 第 ${globalIndex + 1} 張失敗:`, result.reason);
                            results.push({
                                blob: fileArray[globalIndex],
                                originalSize: fileArray[globalIndex].size,
                                compressedSize: fileArray[globalIndex].size,
                                savings: 0,
                                skipped: true,
                                error: result.reason.message,
                                duration: 0
                            });
                            
                            this.stats.failed++;

                            // 錯誤回調
                            if (typeof onError === 'function') {
                                onError(result.reason, globalIndex + 1);
                            }
                        }

                        // 進度回調
                        if (typeof onProgress === 'function') {
                            const percent = ((globalIndex + 1) / total) * 100;
                            onProgress(percent, globalIndex + 1, total);
                        }
                    });

                    // 批次間隔（最後一批不延遲）
                    if (i + this.batchConfig.batchSize < fileArray.length) {
                        await this.delay(this.batchConfig.delayMs);
                    }
                }

                const duration = Date.now() - startTime;

                // 完成統計
                const summary = {
                    ...this.stats,
                    duration,
                    averageTime: total > 0 ? Math.round(duration / total) : 0,
                    compressionRatio: this.stats.totalOriginalSize > 0 
                        ? ((1 - this.stats.totalCompressedSize / this.stats.totalOriginalSize) * 100).toFixed(1)
                        : 0
                };

                console.log('✅ [批次壓縮] 完成:', summary);

                if (typeof onBatchComplete === 'function') {
                    onBatchComplete(summary, results);
                }

                return {
                    results,
                    summary
                };

            } finally {
                this.isProcessing = false;
            }
        }

        /**
         * 帶延遲的單張壓縮
         */
        async compressSingleWithDelay(file, options, delayMs) {
            if (delayMs > 0) {
                await this.delay(delayMs);
            }
            return this.compressSingle(file, options);
        }

        /**
         * 延遲函數
         */
        delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * 更新統計
         */
        updateStats(result) {
            this.stats.total++;
            
            if (result.skipped) {
                this.stats.skipped++;
            } else {
                this.stats.compressed++;
            }

            this.stats.totalOriginalSize += result.originalSize;
            this.stats.totalCompressedSize += result.compressedSize;
        }

        /**
         * 重置統計
         */
        resetStats() {
            this.stats = {
                total: 0,
                compressed: 0,
                skipped: 0,
                failed: 0,
                totalOriginalSize: 0,
                totalCompressedSize: 0
            };
        }

        /**
         * 檢查是否為 HEIC 格式
         */
        isHEICFormat(file) {
            if (!file || !file.name) return false;
            const fileName = file.name.toLowerCase();
            return fileName.endsWith('.heic') || fileName.endsWith('.heif');
        }

        /**
         * 處理 HEIC 檔案（提示轉換）
         */
        async handleHEICFile(file, profile) {
            console.warn('⚠️ [進階壓縮] HEIC 格式暫不支援轉換，返回原檔');
            
            // 顯示錯誤提示
            if (ErrorHandler) {
                ErrorHandler.handleError({
                    type: ErrorTypes.FILE_TYPE_INVALID,
                    message: 'HEIC/HEIF 格式照片需要先轉換為 JPEG',
                    suggestions: [
                        '在手機上匯出時選擇「相容格式」',
                        '使用照片 App 轉換為 JPEG',
                        '或使用線上轉換工具'
                    ],
                    showNotification: false // 批次時不顯示，統一在最後提示
                });
            }

            return {
                blob: file,
                originalSize: file.size,
                compressedSize: file.size,
                savings: 0,
                skipped: true,
                reason: 'HEIC 格式需轉換',
                isHEIC: true,
                duration: 0
            };
        }

        /**
         * 讀取檔案為 DataURL
         */
        readFileAsDataURL(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = e => resolve(e.target.result);
                reader.onerror = e => reject(new Error('檔案讀取失敗'));
                reader.readAsDataURL(file);
            });
        }

        /**
         * 載入圖片
         */
        loadImage(dataURL) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('圖片載入失敗'));
                img.src = dataURL;
            });
        }

        /**
         * Canvas 轉 Blob
         */
        canvasToBlob(canvas, format, quality) {
            return new Promise((resolve, reject) => {
                canvas.toBlob(
                    blob => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error('Canvas 轉換失敗'));
                        }
                    },
                    format,
                    quality
                );
            });
        }

        /**
         * 取得統計資料
         */
        getStats() {
            return { ...this.stats };
        }
    }

    // ============================================
    // 導出
    // ============================================
    const compressor = new AdvancedPhotoCompressor();
    
    global.AdvancedPhotoCompressor = compressor;
    
    // 便捷函數
    global.compressPhoto = function(file, options) {
        return compressor.compressSingle(file, options);
    };

    global.compressPhotos = function(files, options) {
        return compressor.compressBatch(files, options);
    };

})(window);


