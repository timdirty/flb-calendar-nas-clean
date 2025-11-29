/**
 * 學習歷程上傳系統 - 影片縮圖管理器
 * 處理影片縮圖生成、快取和載入
 */

(function (global) {
  'use strict';

  const Constants = global.LearningUploadConstants;
  const Config = global.LearningUploadConfig;
  const MediaCache = global.LearningUploadMediaCache;
  const BlobURL = global.LearningUploadBlobURL;
  
  // 🚀 新增：Worker 和 IndexedDB 支援
  const WorkerPoolManager = global.WorkerPoolManager;
  const IndexedDBCache = global.LearningUploadIndexedDBCache || global.IndexedDBCache;

  // ============================================
  // 影片縮圖佇列（避免同時處理多個影片）
  // ============================================
  class PosterQueue {
    constructor() {
      this.queue = [];
      this.active = 0;
      this.limit = Constants.MEDIA?.POSTER_QUEUE_LIMIT || 1;
      this.adjustLimit();
    }

    /**
     * 動態調整並發限制
     */
    adjustLimit() {
      const hc = navigator.hardwareConcurrency || 0;
      const dm = navigator.deviceMemory || 0;
      const isLowEnd = (hc > 0 && hc <= 4) || (dm > 0 && dm <= 2);
      
      this.limit = isLowEnd ? 1 : 2;
      console.log(`🎬 [PosterQueue] 並發限制設為: ${this.limit}`);
    }

    /**
     * 加入佇列
     */
    enqueue(fn) {
      this.queue.push({ fn: fn });
      this.pump();
    }

    /**
     * 處理佇列
     */
    pump() {
      if (this.active >= this.limit || this.queue.length === 0) return;

      const job = this.queue.shift();
      this.active++;

      Promise.resolve()
        .then(() => job.fn())
        .catch(() => {}) // 忽略錯誤，避免整列卡死
        .finally(() => {
          this.active = Math.max(0, this.active - 1);
          this.pump();
        });
    }

    /**
     * 清空佇列
     */
    clear() {
      this.queue = [];
    }

    /**
     * 獲取統計
     */
    stats() {
      return {
        active: this.active,
        queued: this.queue.length,
        limit: this.limit
      };
    }
  }

  // ============================================
  // 影片縮圖管理器
  // ============================================
  class VideoPosterManager {
    constructor() {
      this.queue = new PosterQueue();
      this.cache = window.__videoPosterCache || {};
      this.readyCache = window.__videoThumbnailReadyCache || {};
      this.errorRegistry = {};
      this.retryRegistry = {};
      this.retryLimit = Constants.MEDIA?.POSTER_RETRY_LIMIT || 5;
      
      window.__videoPosterCache = this.cache;
      window.__videoThumbnailReadyCache = this.readyCache;
      
      // 🚀 初始化 Worker 池和 IndexedDB 快取
      this.workerPool = null;
      this.cacheManager = null;
      this.workerSupported = false;
      this.cacheSupported = false;
      
      this.initializeOptimizations();
    }
    
    /**
     * 🚀 初始化優化功能（Worker 和 IndexedDB）
     */
    initializeOptimizations() {
      try {
        // 初始化 Worker 池
        if (WorkerPoolManager) {
          this.workerPool = WorkerPoolManager.getVideoThumbnailWorkerPool();
          this.workerSupported = this.workerPool.isWorkerSupported;
          console.log('✅ [VideoPoster] Worker 池已初始化', {
            supported: this.workerSupported
          });
        }
        
        // 初始化 IndexedDB 快取
        if (IndexedDBCache) {
          this.cacheManager = IndexedDBCache.getCacheManager();
          this.cacheSupported = true;
          console.log('✅ [VideoPoster] IndexedDB 快取已初始化');
        }
      } catch (error) {
        console.warn('⚠️ [VideoPoster] 優化功能初始化失敗（將使用傳統方式）:', error);
      }
    }

    /**
     * 為影片元素生成縮圖
     */
    async generate(videoElement, options) {
      if (!videoElement) return null;

      const src = options?.src || videoElement.src || videoElement.getAttribute('data-src');
      if (!src) return null;

      // 🎬 大檔案跳過縮圖生成（避免記憶體爆炸）
      const fileSize = options?.fileSize || 0;
      const file = options?.file; // 新增：取得檔案物件
      const skipThreshold = (Config?.get('video.posterSkipThresholdMB') || 100) * 1024 * 1024;
      
      if (fileSize > skipThreshold) {
        console.log('🎬 [VideoPoster] 大檔案 (' + (fileSize / 1024 / 1024).toFixed(1) + ' MB) 跳過縮圖生成，使用靜態圖標');
        return this.getStaticPlaceholder();
      }

      // 檢查記憶體快取
      const cacheKey = this.normalizeKey(src);
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        console.log('✅ [VideoPoster] 使用記憶體快取');
        return cached;
      }
      
      // 🚀 檢查 IndexedDB 快取
      if (this.cacheSupported && file) {
        try {
          const hash = await this.calculateFileHash(file);
          const cachedBlob = await this.cacheManager.getThumbnail(hash);
          
          if (cachedBlob) {
            console.log('✅ [VideoPoster] 使用 IndexedDB 快取:', hash.substring(0, 8));
            // 🔥 使用 BlobURLManager
            const url = window.BlobURLManager ? 
              window.BlobURLManager.createObjectURL(cachedBlob, { 
                source: 'video-poster',
                type: 'cached-poster' 
              }) : URL.createObjectURL(cachedBlob);
            this.saveToCache(cacheKey, url);
            this.markReady(cacheKey);
            return url;
          }
        } catch (error) {
          console.warn('⚠️ [VideoPoster] IndexedDB 快取讀取失敗:', error);
        }
      }

      // 加入佇列處理
      return new Promise((resolve) => {
        this.queue.enqueue(async () => {
          try {
            let poster = null;
            let shouldSaveToIndexedDB = false;
            let fileHash = null;
            
            // 🚀 嘗試使用 Worker 生成
            if (this.workerSupported && file && fileSize < 50 * 1024 * 1024) {
              try {
                console.log('🚀 [VideoPoster] 使用 Worker 生成縮圖');
                const thumbnailBlob = await this.workerPool.execute('generate', {
                  videoBlob: file,
                  options: {
                    quality: Config.get('media.videoPoster.quality') || 0.8,
                    targetWidth: 200,
                    targetHeight: 150
                  }
                }, { timeout: 15000 });
                
                // 🔥 使用 BlobURLManager
                poster = window.BlobURLManager ? 
                  window.BlobURLManager.createObjectURL(thumbnailBlob, { 
                    source: 'video-poster',
                    type: 'worker-generated' 
                  }) : URL.createObjectURL(thumbnailBlob);
                shouldSaveToIndexedDB = true;
                fileHash = await this.calculateFileHash(file);
                
                console.log('✅ [VideoPoster] Worker 生成成功');
                
                // 儲存到 IndexedDB
                if (this.cacheSupported && fileHash) {
                  try {
                    await this.cacheManager.saveThumbnail(fileHash, thumbnailBlob, {
                      fileSize,
                      timestamp: Date.now()
                    });
                    console.log('✅ [VideoPoster] 已儲存到 IndexedDB');
                  } catch (error) {
                    console.warn('⚠️ [VideoPoster] IndexedDB 儲存失敗:', error);
                  }
                }
              } catch (workerError) {
                // 🔍 檢查是否為預期的 Worker 不支援錯誤
                if (workerError.message && workerError.message.includes('WORKER_NOT_SUPPORTED')) {
                  console.log('💡 [VideoPoster] Worker 環境不支援影片處理，使用主線程');
                } else {
                  console.warn('⚠️ [VideoPoster] Worker 生成失敗，降級到主線程:', workerError.message);
                }
                poster = null;
              }
            }
            
            // 降級：使用主線程生成
            if (!poster) {
              console.log('🎬 [VideoPoster] 使用主線程生成縮圖');
              poster = await this.capture(src, options);
            }
            
            if (poster) {
              this.saveToCache(cacheKey, poster);
              this.markReady(cacheKey);
            }
            
            resolve(poster);
          } catch (e) {
            console.error('❌ [VideoPoster] 生成失敗:', e);
            this.recordError(cacheKey, e.message);
            // 生成失敗時使用靜態佔位圖，不影響上傳流程
            resolve(this.getStaticPlaceholder());
          }
        });
      });
    }
    
    /**
     * 🚀 計算檔案雜湊（用於 IndexedDB 快取鍵）
     */
    async calculateFileHash(file) {
      if (!file) return null;
      
      try {
        // 只取前 1MB 計算雜湊（提升效能）
        const chunk = file.slice(0, Math.min(1024 * 1024, file.size));
        const buffer = await chunk.arrayBuffer();
        
        if (crypto && crypto.subtle) {
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          return hashHex.substring(0, 16); // 取前 16 個字元
        } else {
          // 降級：使用簡單雜湊
          return `${file.size}-${file.name}-${file.lastModified}`;
        }
      } catch (error) {
        console.warn('⚠️ [VideoPoster] 雜湊計算失敗:', error);
        return `${file.size}-${Date.now()}`;
      }
    }

    /**
     * 🎬 取得靜態佔位圖（大檔案或生成失敗時使用）
     */
    getStaticPlaceholder() {
      // 返回一個簡單的 SVG 影片圖標
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">' +
        '<rect width="200" height="150" fill="#1e293b"/>' +
        '<g transform="translate(100, 75)">' +
        '<circle cx="0" cy="0" r="25" fill="#3b82f6" opacity="0.3"/>' +
        '<path d="M-8,-12 L-8,12 L12,0 Z" fill="#60a5fa"/>' +
        '</g>' +
        '<text x="100" y="130" text-anchor="middle" fill="#94a3b8" font-size="12" font-family="Arial">影片</text>' +
        '</svg>';
      
      return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }

    /**
     * 擷取影片幀作為縮圖
     */
    async capture(src, options) {
      const opts = {
        quality: Config.get('media.videoPoster.quality') || 0.7,
        maxWidth: Config.get('media.videoPoster.maxWidth') || 640,
        maxHeight: Config.get('media.videoPoster.maxHeight') || 360,
        ...options
      };

      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.muted = true;

        const cleanup = () => {
          try {
            video.pause();
            video.removeAttribute('src');
            video.load();
            video.remove(); // 🎬 立即從 DOM 移除（如果有）
          } catch (e) {}
        };

        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('縮圖生成超時'));
        }, 5000); // 🎬 5 秒超時（從 10 秒縮短）

        video.addEventListener('loadedmetadata', () => {
          try {
            // 選擇適當的時間點
            const duration = video.duration;
            if (isNaN(duration) || duration <= 0) {
              cleanup();
              clearTimeout(timeout);
              reject(new Error('無效的影片時長'));
              return;
            }

            // 選擇 1 秒或 10% 位置
            video.currentTime = Math.min(1, duration * 0.1);
          } catch (e) {
            cleanup();
            clearTimeout(timeout);
            reject(e);
          }
        });

        video.addEventListener('seeked', () => {
          try {
            clearTimeout(timeout);

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // 計算縮放比例
            let width = video.videoWidth;
            let height = video.videoHeight;

            if (width > opts.maxWidth || height > opts.maxHeight) {
              const ratio = Math.min(opts.maxWidth / width, opts.maxHeight / height);
              width = Math.floor(width * ratio);
              height = Math.floor(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            // 繪製幀
            ctx.drawImage(video, 0, 0, width, height);

            // 轉換為 Blob
            canvas.toBlob((blob) => {
              cleanup();
              if (blob) {
                // 🔥 使用 BlobURLManager
                const url = window.BlobURLManager ? 
                  window.BlobURLManager.createObjectURL(blob, { 
                    source: 'video-poster',
                    type: 'fallback-generated' 
                  }) : URL.createObjectURL(blob);
                resolve(url);
              } else {
                reject(new Error('無法生成縮圖'));
              }
            }, 'image/jpeg', opts.quality);

          } catch (e) {
            cleanup();
            clearTimeout(timeout);
            reject(e);
          }
        });

        video.addEventListener('error', (e) => {
          cleanup();
          clearTimeout(timeout);
          reject(new Error('影片載入失敗'));
        });

        // 開始載入
        video.src = src;

      });
    }

    /**
     * 正規化快取鍵
     */
    normalizeKey(url) {
      if (!url) return '';
      try {
        const parsed = new URL(url, window.location.origin);
        parsed.searchParams.delete('_t');
        return parsed.toString();
      } catch (e) {
        return url;
      }
    }

    /**
     * 從快取獲取
     */
    getFromCache(key) {
      return this.cache[key] || (MediaCache?.get(`poster:${key}`));
    }

    /**
     * 保存到快取
     */
    saveToCache(key, value) {
      this.cache[key] = value;
      if (MediaCache) {
        MediaCache.set(`poster:${key}`, value, { type: 'poster' });
      }
    }

    /**
     * 標記為就緒
     */
    markReady(key) {
      this.readyCache[key] = true;
    }

    /**
     * 檢查是否就緒
     */
    isReady(key) {
      return !!this.readyCache[key];
    }

    /**
     * 記錄錯誤
     */
    recordError(key, message) {
      const errorKey = `${key}::${message}`;
      this.errorRegistry[errorKey] = (this.errorRegistry[errorKey] || 0) + 1;
    }

    /**
     * 排程重試
     */
    scheduleRetry(videoElement, src) {
      const key = this.normalizeKey(src);
      
      if (!this.retryRegistry[key]) {
        this.retryRegistry[key] = { count: 0, timer: null };
      }

      const entry = this.retryRegistry[key];
      if (entry.count >= this.retryLimit) return;

      if (entry.timer) {
        clearTimeout(entry.timer);
      }

      entry.count++;
      const delay = 400 * entry.count + 400;

      entry.timer = setTimeout(() => {
        entry.timer = null;
        if (videoElement.isConnected) {
          this.generate(videoElement, { src });
        }
      }, delay);
    }

    /**
     * 清理資源
     */
    cleanup() {
      // 清理重試計時器
      Object.values(this.retryRegistry).forEach(entry => {
        if (entry.timer) {
          clearTimeout(entry.timer);
        }
      });
      this.retryRegistry = {};
      
      // 清空佇列
      this.queue.clear();
    }
  }

  // ============================================
  // 導出
  // ============================================
  const posterManager = new VideoPosterManager();
  global.LearningUploadPosterManager = posterManager;

})(window);