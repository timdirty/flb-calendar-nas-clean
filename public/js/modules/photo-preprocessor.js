/**
 * 📸 照片預處理模組（前端壓縮）
 * 功能：
 * 1. 瀏覽器端壓縮（Canvas API）
 * 2. HEIC/HEIF 格式檢測與提示
 * 3. 批次處理支援
 * 4. 進度回調與效能追蹤
 * 
 * 壓縮策略：
 * - 原圖 > 2MB：壓縮至 1920px 寬度，品質 85%
 * - 原圖 ≤ 2MB：保持原樣
 * - 支援 JPEG、PNG、WebP
 * 
 * 版本：1.0.0
 * 日期：2025-11-03
 */

(function (global) {
    'use strict';

    // 🔧 配置參數
    const CONFIG = {
        THRESHOLD_SIZE: 2 * 1024 * 1024,    // 2MB - 超過此大小才壓縮
        MAX_WIDTH: 1920,                     // 最大寬度
        MAX_HEIGHT: 1920,                    // 最大高度
        QUALITY: 0.85,                       // JPEG 品質（0-1）
        OUTPUT_FORMAT: 'image/jpeg',         // 輸出格式
        HEIC_EXTENSIONS: ['.heic', '.heif'], // HEIC 副檔名
    };

    /**
     * 檢查是否為 HEIC/HEIF 格式
     */
    function isHEICFormat(file) {
        if (!file || !file.name) return false;
        const fileName = file.name.toLowerCase();
        return CONFIG.HEIC_EXTENSIONS.some(ext => fileName.endsWith(ext));
    }

    /**
     * 壓縮單張照片
     * @param {File} file - 原始照片檔案
     * @param {Object} options - 壓縮選項
     * @returns {Promise<Object>} 壓縮結果
     */
    async function compressPhoto(file, options = {}) {
        // 合併選項
        const {
            maxWidth = CONFIG.MAX_WIDTH,
            maxHeight = CONFIG.MAX_HEIGHT,
            quality = CONFIG.QUALITY,
            format = CONFIG.OUTPUT_FORMAT,
            thresholdSize = CONFIG.THRESHOLD_SIZE
        } = options;

        // 🎯 效能追蹤開始
        const startTime = performance.now();
        performance.mark('compress-start');

        try {
            // 🔍 HEIC 格式檢測
            if (isHEICFormat(file)) {
                console.warn('⚠️ [照片壓縮] HEIC 格式不支援瀏覽器壓縮，建議轉換為 JPEG');
                return {
                    blob: file,
                    originalSize: file.size,
                    compressedSize: file.size,
                    savings: 0,
                    skipped: true,
                    reason: 'HEIC 格式'
                };
            }

            // 📏 小於閾值直接返回
            if (file.size <= thresholdSize) {
                console.log(`✅ [照片壓縮] 檔案小於 ${(thresholdSize / 1024 / 1024).toFixed(1)}MB，跳過壓縮`);
                return {
                    blob: file,
                    originalSize: file.size,
                    compressedSize: file.size,
                    savings: 0,
                    skipped: true,
                    reason: '檔案已經夠小'
                };
            }

            // 📖 讀取圖片
            const imageData = await readFileAsDataURL(file);

            // 🖼️ 載入圖片
            const img = await loadImage(imageData);

            // 📐 計算縮放尺寸
            let { width, height } = img;
            const needsResize = width > maxWidth || height > maxHeight;

            if (needsResize) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
                console.log(`📐 [照片壓縮] 縮放尺寸: ${img.width}x${img.height} → ${width}x${height}`);
            }

            // 🎨 使用 Canvas 壓縮
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d', {
                alpha: format === 'image/png', // PNG 保留透明度
                desynchronized: true           // 提升效能
            });

            // 繪製圖片
            ctx.drawImage(img, 0, 0, width, height);

            // 🔄 轉換為 Blob
            const blob = await canvasToBlob(canvas, format, quality);

            // 📊 計算壓縮效果
            const originalSize = file.size;
            const compressedSize = blob.size;
            const savings = ((1 - compressedSize / originalSize) * 100).toFixed(2);

            // ⏱️ 效能追蹤結束
            performance.mark('compress-end');
            performance.measure('photo-compression', 'compress-start', 'compress-end');
            const duration = performance.now() - startTime;

            const measure = performance.getEntriesByName('photo-compression')[0];
            console.log(`⏱️ [照片壓縮] 耗時: ${duration.toFixed(2)}ms (${file.name})`);
            console.log(`📦 [照片壓縮] 壓縮效果: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (節省 ${savings}%)`);

            // 清理 Performance Entries
            performance.clearMarks();
            performance.clearMeasures();

            return {
                blob,
                originalSize,
                compressedSize,
                savings: parseFloat(savings),
                duration: Math.round(duration),
                skipped: false,
                originalName: file.name
            };

        } catch (error) {
            console.error('❌ [照片壓縮] 壓縮失敗:', error);
            
            // 失敗時返回原檔案
            return {
                blob: file,
                originalSize: file.size,
                compressedSize: file.size,
                savings: 0,
                skipped: true,
                error: error.message,
                originalName: file.name
            };
        }
    }

    /**
     * 批次壓縮照片
     * @param {FileList|Array} files - 照片檔案列表
     * @param {Object} options - 壓縮選項與回調
     * @returns {Promise<Array>} 壓縮結果列表
     */
    async function compressBatch(files, options = {}) {
        const {
            onProgress,
            onSingleComplete,
            ...compressOptions
        } = options;

        const fileArray = Array.from(files);
        const results = [];
        const startTime = Date.now();

        console.log(`🚀 [批次壓縮] 開始處理 ${fileArray.length} 張照片`);

        for (let i = 0; i < fileArray.length; i++) {
            try {
                const file = fileArray[i];
                const result = await compressPhoto(file, compressOptions);
                results.push({ success: true, ...result });

                // 單張完成回調
                if (typeof onSingleComplete === 'function') {
                    onSingleComplete(result, i + 1, fileArray.length);
                }

                // 進度回調
                if (typeof onProgress === 'function') {
                    const percent = ((i + 1) / fileArray.length) * 100;
                    onProgress(percent, i + 1, fileArray.length);
                }

            } catch (error) {
                console.error(`❌ [批次壓縮] 處理失敗 [${fileArray[i].name}]:`, error);
                results.push({
                    success: false,
                    error: error.message,
                    originalName: fileArray[i].name,
                    blob: fileArray[i],
                    originalSize: fileArray[i].size,
                    compressedSize: fileArray[i].size,
                    savings: 0
                });
            }
        }

        const duration = Date.now() - startTime;
        const totalOriginalSize = results.reduce((sum, r) => sum + r.originalSize, 0);
        const totalCompressedSize = results.reduce((sum, r) => sum + r.compressedSize, 0);
        const totalSavings = ((1 - totalCompressedSize / totalOriginalSize) * 100).toFixed(2);

        console.log(`✅ [批次壓縮] 完成！總耗時: ${(duration / 1000).toFixed(2)}s`);
        console.log(`📊 [批次壓縮] 總節省空間: ${totalSavings}%`);
        console.log(`   原始大小: ${(totalOriginalSize / 1024 / 1024).toFixed(2)}MB`);
        console.log(`   壓縮後: ${(totalCompressedSize / 1024 / 1024).toFixed(2)}MB`);

        return results;
    }

    /**
     * 讀取檔案為 Data URL
     */
    function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * 載入圖片
     */
    function loadImage(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = dataURL;
        });
    }

    /**
     * Canvas 轉 Blob
     */
    function canvasToBlob(canvas, format, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Canvas toBlob 失敗'));
                    }
                },
                format,
                quality
            );
        });
    }

    /**
     * 格式化檔案大小
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 🌐 暴露全域 API
    global.PhotoPreprocessor = {
        compressPhoto,
        compressBatch,
        isHEICFormat,
        formatFileSize,
        CONFIG
    };

    console.log('✅ PhotoPreprocessor 模組已載入');

})(window);
