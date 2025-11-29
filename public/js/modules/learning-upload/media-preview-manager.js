/**
 * 學習歷程上傳系統 - 媒體預覽管理模組
 * 統一管理照片、影片預覽的生成、顯示、清理
 */

(function (global) {
  'use strict';

  const BlobURL = global.LearningUploadBlobURL;
  const PosterManager = global.LearningUploadPosterManager;
  const DOM = global.LearningUploadDOM;

  // ============================================
  // 媒體預覽管理器
  // ============================================
  class MediaPreviewManager {
    constructor() {
      this.previewCache = new Map(); // 預覽快取：fileId -> { url, type, element }
      this.loadingPreviews = new Set(); // 正在載入的預覽
    }

    /**
     * 生成照片預覽
     */
    async generatePhotoPreview(file, options = {}) {
      try {
        const fileId = this.generateFileId(file);
        
        // 檢查快取
        if (this.previewCache.has(fileId)) {
          return this.previewCache.get(fileId);
        }

        // 防止重複生成
        if (this.loadingPreviews.has(fileId)) {
          return await this.waitForPreview(fileId);
        }

        this.loadingPreviews.add(fileId);

        // 創建 Blob URL
        // 🔥 使用 BlobURLManager
        const blobUrl = window.BlobURLManager ? 
          window.BlobURLManager.createObjectURL(file, { 
            source: 'media-preview-manager',
            type: 'photo',
            fileId: fileId 
          }) : URL.createObjectURL(file);

        // 創建預覽元素
        const preview = this.createPhotoPreviewElement(blobUrl, file, options);

        // 快取
        const cacheEntry = {
          url: blobUrl,
          type: 'photo',
          element: preview,
          file: file,
          timestamp: Date.now()
        };
        this.previewCache.set(fileId, cacheEntry);
        this.loadingPreviews.delete(fileId);

        return cacheEntry;

      } catch (error) {
        console.error('❌ 生成照片預覽失敗:', error);
        throw error;
      }
    }

    /**
     * 生成影片預覽
     */
    async generateVideoPreview(file, options = {}) {
      try {
        const fileId = this.generateFileId(file);
        
        // 檢查快取
        if (this.previewCache.has(fileId)) {
          return this.previewCache.get(fileId);
        }

        // 防止重複生成
        if (this.loadingPreviews.has(fileId)) {
          return await this.waitForPreview(fileId);
        }

        this.loadingPreviews.add(fileId);

        // 創建 Blob URL
        // 🔥 使用 BlobURLManager
        const blobUrl = window.BlobURLManager ? 
          window.BlobURLManager.createObjectURL(file, { 
            source: 'media-preview-manager',
            type: 'video',
            fileId: fileId 
          }) : URL.createObjectURL(file);

        // 生成影片縮圖（如果有 PosterManager）
        let posterUrl = null;
        if (PosterManager) {
          try {
            posterUrl = await PosterManager.generate(file);
          } catch (posterError) {
            console.warn('⚠️ 影片縮圖生成失敗:', posterError);
          }
        }

        // 創建預覽元素
        const preview = this.createVideoPreviewElement(blobUrl, file, {
          ...options,
          posterUrl: posterUrl
        });

        // 快取
        const cacheEntry = {
          url: blobUrl,
          posterUrl: posterUrl,
          type: 'video',
          element: preview,
          file: file,
          timestamp: Date.now()
        };
        this.previewCache.set(fileId, cacheEntry);
        this.loadingPreviews.delete(fileId);

        return cacheEntry;

      } catch (error) {
        console.error('❌ 生成影片預覽失敗:', error);
        this.loadingPreviews.delete(this.generateFileId(file));
        throw error;
      }
    }

    /**
     * 創建照片預覽元素
     */
    createPhotoPreviewElement(blobUrl, file, options = {}) {
      const container = document.createElement('div');
      container.className = 'file-preview-item';
      container.dataset.fileId = this.generateFileId(file);
      container.dataset.type = 'photo';

      const img = document.createElement('img');
      img.src = blobUrl;
      img.alt = file.name;
      img.dataset.objectUrl = blobUrl;
      img.loading = 'lazy'; // 懶加載優化

      // 刪除按鈕
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'file-delete-btn';
      deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
      deleteBtn.onclick = () => {
        if (options.onDelete) {
          options.onDelete(file, container);
        }
        this.removePreview(file);
      };

      container.appendChild(img);
      container.appendChild(deleteBtn);

      return container;
    }

    /**
     * 創建影片預覽元素
     */
    createVideoPreviewElement(blobUrl, file, options = {}) {
      const container = document.createElement('div');
      container.className = 'file-preview-item video-preview';
      container.dataset.fileId = this.generateFileId(file);
      container.dataset.type = 'video';

      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'video-wrapper';

      if (options.posterUrl) {
        // 使用縮圖
        const poster = document.createElement('img');
        poster.src = options.posterUrl;
        poster.className = 'video-poster';
        poster.dataset.objectUrl = options.posterUrl;
        poster.loading = 'lazy';
        videoWrapper.appendChild(poster);
      } else {
        // 使用 video 元素
        const video = document.createElement('video');
        video.src = blobUrl;
        video.className = 'video-element';
        video.controls = false;
        video.preload = 'metadata';
        video.dataset.objectUrl = blobUrl;
        videoWrapper.appendChild(video);
      }

      // 播放圖標疊加層
      const playOverlay = document.createElement('div');
      playOverlay.className = 'video-play-overlay';
      playOverlay.innerHTML = '<i class="fas fa-play-circle"></i>';
      playOverlay.onclick = () => {
        if (options.onPlay) {
          options.onPlay(file, blobUrl);
        }
      };

      // 刪除按鈕
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'file-delete-btn';
      deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
      deleteBtn.onclick = () => {
        if (options.onDelete) {
          options.onDelete(file, container);
        }
        this.removePreview(file);
      };

      videoWrapper.appendChild(playOverlay);
      container.appendChild(videoWrapper);
      container.appendChild(deleteBtn);

      return container;
    }

    /**
     * 批次生成預覽
     */
    async generatePreviews(files, type, options = {}) {
      const results = [];
      const maxConcurrent = options.maxConcurrent || 3;

      for (let i = 0; i < files.length; i += maxConcurrent) {
        const batch = files.slice(i, i + maxConcurrent);
        const batchResults = await Promise.allSettled(
          batch.map(file => 
            type === 'photo' 
              ? this.generatePhotoPreview(file, options)
              : this.generateVideoPreview(file, options)
          )
        );
        
        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error('❌ 預覽生成失敗:', batch[index].name, result.reason);
            results.push(null);
          }
        });
      }

      return results;
    }

    /**
     * 移除預覽
     */
    removePreview(file) {
      const fileId = this.generateFileId(file);
      const cached = this.previewCache.get(fileId);
      
      if (cached) {
        // 釋放 Blob URLs
        if (cached.url) {
          // 🔥 使用 BlobURLManager
          if (window.BlobURLManager) {
            window.BlobURLManager.revokeObjectURL(cached.url);
          } else {
            URL.revokeObjectURL(cached.url);
          }
        }
        if (cached.posterUrl) {
          // 🔥 使用 BlobURLManager
          if (window.BlobURLManager) {
            window.BlobURLManager.revokeObjectURL(cached.posterUrl);
          } else {
            URL.revokeObjectURL(cached.posterUrl);
          }
        }

        // 移除 DOM 元素
        if (cached.element && cached.element.parentNode) {
          cached.element.parentNode.removeChild(cached.element);
        }

        this.previewCache.delete(fileId);
        console.log('🧹 已移除預覽:', file.name);
      }
    }

    /**
     * 清除所有預覽
     */
    clearAll() {
      this.previewCache.forEach((cached, fileId) => {
        // 釋放 Blob URLs
        if (cached.url) {
          // 🔥 使用 BlobURLManager
          if (window.BlobURLManager) {
            window.BlobURLManager.revokeObjectURL(cached.url);
          } else {
            try {
              URL.revokeObjectURL(cached.url);
            } catch (e) {}
          }
        }
        if (cached.posterUrl) {
          // 🔥 使用 BlobURLManager
          if (window.BlobURLManager) {
            window.BlobURLManager.revokeObjectURL(cached.posterUrl);
          } else {
            try {
              URL.revokeObjectURL(cached.posterUrl);
            } catch (e) {}
          }
        }
      });

      this.previewCache.clear();
      this.loadingPreviews.clear();
    }

    /**
     * 清除過期預覽（超過指定時間）
     */
    clearExpired(maxAge = 300000) { // 預設 5 分鐘
      const now = Date.now();
      const expired = [];

      this.previewCache.forEach((cached, fileId) => {
        if (now - cached.timestamp > maxAge) {
          expired.push(fileId);
        }
      });

      expired.forEach(fileId => {
        const cached = this.previewCache.get(fileId);
        if (cached && cached.file) {
          this.removePreview(cached.file);
        }
      });

      if (expired.length > 0) {
        console.log(`🧹 已清除 ${expired.length} 個過期預覽`);
      }
    }

    /**
     * 生成檔案 ID
     */
    generateFileId(file) {
      return `${file.name}-${file.size}-${file.lastModified}`;
    }

    /**
     * 等待預覽生成完成
     */
    async waitForPreview(fileId, timeout = 10000) {
      const startTime = Date.now();
      
      while (this.loadingPreviews.has(fileId)) {
        if (Date.now() - startTime > timeout) {
          throw new Error('預覽生成超時');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return this.previewCache.get(fileId);
    }

    /**
     * 取得統計資訊
     */
    getStats() {
      const photos = [];
      const videos = [];

      this.previewCache.forEach(cached => {
        if (cached.type === 'photo') {
          photos.push(cached);
        } else if (cached.type === 'video') {
          videos.push(cached);
        }
      });

      return {
        total: this.previewCache.size,
        photos: photos.length,
        videos: videos.length,
        loading: this.loadingPreviews.size
      };
    }
  }

  // ============================================
  // 導出
  // ============================================
  const mediaPreviewManager = new MediaPreviewManager();
  global.LearningMediaPreviewManager = mediaPreviewManager;

  // 定期清除過期預覽（每 2 分鐘）
  setInterval(() => {
    try {
      mediaPreviewManager.clearExpired();
    } catch (error) {
      console.error('❌ 清除過期預覽失敗:', error);
    }
  }, 120000);

  console.log('✅ MediaPreviewManager 已載入');

})(window);

