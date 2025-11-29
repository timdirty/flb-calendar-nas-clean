/**
 * 縮圖生成器 - 快速生成小尺寸預覽圖
 * 使用 Canvas 將大圖縮小到適合顯示的尺寸，大幅提升載入速度
 */

(function(global) {
  'use strict';

  // ============================================
  // 配置
  // ============================================
  const THUMBNAIL_CONFIG = {
    maxWidth: 300,        // 縮圖最大寬度
    maxHeight: 300,       // 縮圖最大高度
    quality: 0.85,        // JPEG 品質
    format: 'image/jpeg', // 輸出格式
    cacheSize: 100        // 快取最多 100 個縮圖
  };

  // ============================================
  // 縮圖快取
  // ============================================
  const thumbnailCache = new Map();
  const cacheKeys = []; // 用於 LRU 清理

  /**
   * 清理最舊的快取項目
   */
  function cleanOldCache() {
    while (cacheKeys.length > THUMBNAIL_CONFIG.cacheSize) {
      const oldKey = cacheKeys.shift();
      const cached = thumbnailCache.get(oldKey);
      if (cached && cached.url) {
        try {
          URL.revokeObjectURL(cached.url);
        } catch (e) {}
      }
      thumbnailCache.delete(oldKey);
    }
  }

  /**
   * 生成快取 key
   */
  function getCacheKey(file) {
    return `${file.name}_${file.size}_${file.lastModified || 0}`;
  }

  // ============================================
  // 縮圖生成器
  // ============================================
  class ThumbnailGenerator {
    constructor() {
      this.pendingQueue = [];
      this.isProcessing = false;
      this.stats = {
        generated: 0,
        cached: 0,
        failed: 0,
        totalTime: 0
      };
    }

    /**
     * 生成縮圖（異步）
     * @param {File} file - 圖片檔案
     * @param {Object} options - 配置選項
     * @returns {Promise<string>} 縮圖的 blob URL
     */
    async generate(file, options = {}) {
      const startTime = performance.now();
      const cacheKey = getCacheKey(file);

      // 🔥 檢查快取
      if (thumbnailCache.has(cacheKey)) {
        this.stats.cached++;
        const cached = thumbnailCache.get(cacheKey);
        console.log('✨ [Thumbnail] 使用快取:', file.name);
        return cached.url;
      }

      try {
        // 🔥 生成縮圖
        const thumbnailBlob = await this._createThumbnail(file, options);
        const thumbnailUrl = URL.createObjectURL(thumbnailBlob);

        // 🔥 儲存到快取
        thumbnailCache.set(cacheKey, {
          url: thumbnailUrl,
          size: thumbnailBlob.size,
          createdAt: Date.now()
        });
        cacheKeys.push(cacheKey);
        cleanOldCache();

        // 📊 統計
        const duration = performance.now() - startTime;
        this.stats.generated++;
        this.stats.totalTime += duration;

        console.log(`✅ [Thumbnail] 生成成功: ${file.name} (${Math.round(duration)}ms, ${(thumbnailBlob.size / 1024).toFixed(1)}KB)`);
        
        return thumbnailUrl;
      } catch (error) {
        this.stats.failed++;
        console.error('❌ [Thumbnail] 生成失敗:', file.name, error);
        
        // 🔥 降級：返回原圖的 blob URL
        return URL.createObjectURL(file);
      }
    }

    /**
     * 批次生成縮圖
     * @param {File[]} files - 檔案陣列
     * @param {Function} callback - 每個完成時的回調
     */
    async generateBatch(files, callback) {
      const batchSize = 3; // 每批處理 3 張
      const results = [];

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const promises = batch.map(file => this.generate(file));
        
        const batchResults = await Promise.allSettled(promises);
        
        batchResults.forEach((result, index) => {
          const file = batch[index];
          if (result.status === 'fulfilled') {
            results.push({ file, url: result.value, success: true });
            if (callback) callback(file, result.value, null);
          } else {
            results.push({ file, url: null, success: false, error: result.reason });
            if (callback) callback(file, null, result.reason);
          }
        });

        // 批次間暫停，避免阻塞 UI
        if (i + batchSize < files.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      return results;
    }

    /**
     * 創建縮圖 (內部方法)
     */
    async _createThumbnail(file, options = {}) {
      const maxWidth = options.maxWidth || THUMBNAIL_CONFIG.maxWidth;
      const maxHeight = options.maxHeight || THUMBNAIL_CONFIG.maxHeight;
      const quality = options.quality || THUMBNAIL_CONFIG.quality;

      // 🔥 使用 createImageBitmap (現代瀏覽器優化)
      let bitmap;
      try {
        bitmap = await createImageBitmap(file);
      } catch (e) {
        // 降級到 Image 元素
        bitmap = await this._loadImage(file);
      }

      // 🔥 計算縮圖尺寸（保持比例）
      const scale = Math.min(
        maxWidth / bitmap.width,
        maxHeight / bitmap.height,
        1 // 不放大，只縮小
      );

      const thumbnailWidth = Math.round(bitmap.width * scale);
      const thumbnailHeight = Math.round(bitmap.height * scale);

      // 🔥 使用 OffscreenCanvas (如果支援) 或普通 Canvas
      let canvas, ctx;
      if (typeof OffscreenCanvas !== 'undefined') {
        canvas = new OffscreenCanvas(thumbnailWidth, thumbnailHeight);
        ctx = canvas.getContext('2d');
      } else {
        canvas = document.createElement('canvas');
        canvas.width = thumbnailWidth;
        canvas.height = thumbnailHeight;
        ctx = canvas.getContext('2d');
      }

      // 🔥 繪製縮圖（使用高品質縮放）
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(bitmap, 0, 0, thumbnailWidth, thumbnailHeight);

      // 釋放 bitmap
      if (bitmap.close) bitmap.close();

      // 🔥 轉換為 Blob
      if (canvas.convertToBlob) {
        // OffscreenCanvas
        return await canvas.convertToBlob({ 
          type: THUMBNAIL_CONFIG.format, 
          quality 
        });
      } else {
        // 普通 Canvas
        return await new Promise((resolve, reject) => {
          canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to create blob'));
          }, THUMBNAIL_CONFIG.format, quality);
        });
      }
    }

    /**
     * 使用 Image 元素載入圖片（降級方案）
     */
    _loadImage(file) {
      return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error('Failed to load image'));
        };
        
        img.src = url;
      });
    }

    /**
     * 清除快取
     */
    clearCache() {
      thumbnailCache.forEach((cached) => {
        if (cached.url) {
          try {
            URL.revokeObjectURL(cached.url);
          } catch (e) {}
        }
      });
      thumbnailCache.clear();
      cacheKeys.length = 0;
      console.log('🗑️ [Thumbnail] 快取已清空');
    }

    /**
     * 獲取統計資訊
     */
    getStats() {
      return {
        ...this.stats,
        cacheSize: thumbnailCache.size,
        avgTime: this.stats.generated > 0 ? 
          Math.round(this.stats.totalTime / this.stats.generated) : 0
      };
    }
  }

  // ============================================
  // 導出到全域
  // ============================================
  global.ThumbnailGenerator = ThumbnailGenerator;
  
  // 創建單例
  global.thumbnailGenerator = new ThumbnailGenerator();

  console.log('✅ [ThumbnailGenerator] 模組已載入');

})(window);
