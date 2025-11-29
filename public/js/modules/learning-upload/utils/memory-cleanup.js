/**
 * 學習歷程上傳系統 - 記憶體清理工具
 * 提供統一的記憶體清理機制，防止記憶體洩漏
 */

(function (global) {
  'use strict';

  const BlobURLManager = global.LearningUploadBlobURL;
  const State = global.LearningUploadState;
  
  // 🚀 新增：Worker 和 IndexedDB 管理器
  const WorkerPoolManager = global.WorkerPoolManager;
  const IndexedDBCache = global.LearningUploadIndexedDBCache || global.IndexedDBCache;

  // ============================================
  // 記憶體清理管理器
  // ============================================
  class MemoryCleanupManager {
    constructor() {
      this.cleanupTasks = [];
      this.isCleaning = false;
      this.setupGlobalCleanup();
    }

    /**
     * 註冊清理任務
     */
    register(task) {
      if (typeof task === 'function') {
        this.cleanupTasks.push({
          name: 'anonymous',
          fn: task,
          priority: 0
        });
      } else if (task && typeof task.fn === 'function') {
        this.cleanupTasks.push({
          name: task.name || 'anonymous',
          fn: task.fn,
          priority: task.priority || 0
        });
      }
    }

    /**
     * 執行清理
     */
    async cleanup(options) {
      if (this.isCleaning) {
        console.warn('⚠️ 清理任務正在執行中，跳過');
        return;
      }

      this.isCleaning = true;
      const opts = {
        force: false,
        silent: false,
        ...options
      };

      try {
        if (!opts.silent) {
          console.log('🧹 開始清理記憶體...');
        }

        // 按優先級排序
        const tasks = [...this.cleanupTasks].sort((a, b) => b.priority - a.priority);

        for (const task of tasks) {
          try {
            await task.fn(opts);
          } catch (e) {
            console.error(`❌ 清理任務失敗 [${task.name}]:`, e);
          }
        }

        // 🎬 強化清理：清除所有 Blob URLs
        if (BlobURLManager) {
          if (opts.force) {
            BlobURLManager.cleanupAll();
          } else {
            BlobURLManager.cleanupUnused();
          }
        }

        // 🎬 強化清理：清除所有隱藏的 canvas 元素
        if (opts.force || opts.includeCanvas) {
          this.cleanupCanvasElements();
        }

        // 🎬 強化清理：清除影片元素
        if (opts.force || opts.includeVideo) {
          this.cleanupVideoElements();
        }

        if (!opts.silent) {
          console.log('✅ 記憶體清理完成');
        }
      } catch (e) {
        console.error('❌ 記憶體清理失敗:', e);
      } finally {
        this.isCleaning = false;
      }
    }

    /**
     * 🎬 緊急清理（激進模式）
     * 當記憶體危急時使用，會清除所有可能的資源
     */
    emergencyCleanup() {
      console.error('🚨 [記憶體] 執行緊急清理...');
      
      try {
        // 1. 清除所有 Blob URLs
        if (BlobURLManager) {
          BlobURLManager.cleanupAll();
          if (BlobURLManager.revokeAll) {
            BlobURLManager.revokeAll();
          }
        }
        
        // 2. 清除所有 Canvas 元素
        this.cleanupCanvasElements();
        
        // 3. 清除所有影片元素
        this.cleanupVideoElements();
        
        // 4. 清除圖片快取
        this.cleanupImageCache();
        
        // 5. 清空狀態快取
        if (State) {
          try {
            const revokes = State.get('pendingOverlayRevokes');
            if (revokes instanceof Set) {
              revokes.forEach(url => {
                try { URL.revokeObjectURL(url); } catch (e) {}
              });
              revokes.clear();
            }
            State.set('shadowBuffers', {});
            State.set('uploadCache', {});
          } catch (e) {}
        }
        
        // 6. 🚀 新增：清理 Worker 池（釋放 Worker 資源）
        if (WorkerPoolManager) {
          try {
            const workerPool = WorkerPoolManager.getVideoThumbnailWorkerPool();
            if (workerPool && typeof workerPool.clearQueue === 'function') {
              workerPool.clearQueue();
              console.log('✅ [記憶體] Worker 佇列已清理');
            }
          } catch (e) {
            console.warn('⚠️ [記憶體] Worker 清理失敗:', e);
          }
        }
        
        // 7. 🚀 新增：清理 IndexedDB 過期快取（釋放磁碟空間）
        if (IndexedDBCache) {
          try {
            const cacheManager = IndexedDBCache.getCacheManager();
            if (cacheManager && typeof cacheManager.cleanupExpired === 'function') {
              // 非同步執行，不阻塞緊急清理
              cacheManager.cleanupExpired().catch(e => {
                console.warn('⚠️ [記憶體] IndexedDB 清理失敗:', e);
              });
              console.log('✅ [記憶體] IndexedDB 清理已啟動');
            }
          } catch (e) {
            console.warn('⚠️ [記憶體] IndexedDB 清理失敗:', e);
          }
        }
        
        // 8. 強制垃圾回收（如果可用）
        if (typeof global.gc === 'function') {
          try {
            global.gc();
            console.log('✅ [記憶體] 已觸發垃圾回收');
          } catch (e) {}
        }
        
        console.log('✅ [記憶體] 緊急清理完成');
        return true;
      } catch (error) {
        console.error('❌ [記憶體] 緊急清理失敗:', error);
        return false;
      }
    }

    /**
     * 🎬 清除 Canvas 元素
     */
    cleanupCanvasElements() {
      try {
        const canvases = document.querySelectorAll('canvas');
        let cleaned = 0;
        
        canvases.forEach(canvas => {
          try {
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            // 縮小到最小尺寸釋放記憶體
            canvas.width = 1;
            canvas.height = 1;
            cleaned++;
          } catch (e) {}
        });
        
        if (cleaned > 0) {
          console.log('🧹 [Canvas] 已清理', cleaned, '個 Canvas 元素');
        }
      } catch (error) {
        console.warn('⚠️ [Canvas] 清理失敗:', error);
      }
    }

    /**
     * 🎬 清除影片元素
     */
    cleanupVideoElements() {
      try {
        const videos = document.querySelectorAll('video');
        let cleaned = 0;
        
        videos.forEach(video => {
          try {
            video.pause();
            video.removeAttribute('src');
            video.load();
            cleaned++;
          } catch (e) {}
        });
        
        if (cleaned > 0) {
          console.log('🧹 [Video] 已清理', cleaned, '個影片元素');
        }
      } catch (error) {
        console.warn('⚠️ [Video] 清理失敗:', error);
      }
    }

    /**
     * 🎬 清除圖片快取
     */
    cleanupImageCache() {
      try {
        // 清除所有隱藏或未掛載的圖片
        const images = document.querySelectorAll('img[style*="display: none"], img[hidden]');
        images.forEach(img => {
          try {
            img.removeAttribute('src');
            img.remove();
          } catch (e) {}
        });
      } catch (error) {
        console.warn('⚠️ [Image] 清理失敗:', error);
      }
    }

    /**
     * 🎬 啟動記憶體監控器（上傳期間使用）
     * @param {Function} onCritical - 記憶體危急時的回調函數
     * @param {number} interval - 檢查間隔（毫秒）
     * @returns {Function} 停止監控的函數
     */
    startMemoryMonitor(onCritical, interval = 2000) {
      console.log('📊 [記憶體] 啟動記憶體監控器（間隔:', interval, 'ms）');
      
      const monitorId = setInterval(() => {
        const status = this.checkMemoryPressure();
        
        if (status.level === 'critical') {
          console.error('🚨 [記憶體] 記憶體危急！比例:', (status.ratio * 100).toFixed(1) + '%');
          
          // 執行緊急清理
          this.emergencyCleanup();
          
          // 呼叫回調
          if (typeof onCritical === 'function') {
            try {
              onCritical(status);
            } catch (e) {
              console.error('❌ [記憶體] 回調執行失敗:', e);
            }
          }
        } else if (status.level === 'high') {
          console.warn('⚠️ [記憶體] 記憶體使用較高，比例:', (status.ratio * 100).toFixed(1) + '%');
        }
      }, interval);
      
      // 返回停止函數
      return () => {
        clearInterval(monitorId);
        console.log('✅ [記憶體] 記憶體監控器已停止');
      };
    }

    /**
     * 清理課程切換相關資源
     */
    cleanupCourseChange() {
      return this.cleanup({
        scope: 'course',
        silent: false
      });
    }

    /**
     * 清理頁面卸載資源
     */
    cleanupPageUnload() {
      return this.cleanup({
        scope: 'page',
        force: true,
        silent: false
      });
    }

    /**
     * 設置全局清理
     */
    setupGlobalCleanup() {
      // 頁面卸載時清理
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', () => {
          this.cleanupPageUnload();
        });

        window.addEventListener('pagehide', () => {
          this.cleanupPageUnload();
        });

        // 頁面隱藏時部分清理
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
              // 清理未使用的 Blob URL
              if (BlobURLManager) {
                BlobURLManager.cleanupUnused(2 * 60 * 1000); // 2 分鐘
              }
            }
          });
        }
      }
    }

    /**
     * 註冊預設清理任務
     */
    registerDefaultTasks() {
      // 清理 Blob URL
      this.register({
        name: 'blob-urls',
        priority: 10,
        fn: async (opts) => {
          if (BlobURLManager) {
            if (opts.force) {
              BlobURLManager.cleanupAll();
            } else {
              BlobURLManager.cleanupUnused();
            }
          }
        }
      });

      // 清理狀態中的快取
      this.register({
        name: 'state-cache',
        priority: 5,
        fn: async (opts) => {
          if (State) {
            // 清理 pendingOverlayRevokes
            const revokes = State.get('pendingOverlayRevokes');
            if (revokes instanceof Set) {
              revokes.forEach(url => {
                try {
                  URL.revokeObjectURL(url);
                } catch (e) {}
              });
              revokes.clear();
            }

            // 清理 shadowBuffers
            State.set('shadowBuffers', {});
          }
        }
      });

      // 清理 DOM 快取
      this.register({
        name: 'dom-cache',
        priority: 3,
        fn: async (opts) => {
          const DOM = global.LearningUploadDOM;
          if (DOM && DOM.cache) {
            DOM.cache.clear();
          }
        }
      });

      // 🚀 新增：清理 Worker 池
      this.register({
        name: 'worker-pool',
        priority: 8,
        fn: async (opts) => {
          if (WorkerPoolManager) {
            try {
              const workerPool = WorkerPoolManager.getVideoThumbnailWorkerPool();
              if (workerPool && typeof workerPool.clearQueue === 'function') {
                workerPool.clearQueue();
                console.log('🧹 [Worker] 佇列已清理');
              }
            } catch (e) {
              console.warn('⚠️ [Worker] 清理失敗:', e);
            }
          }
        }
      });

      // 🚀 新增：清理 IndexedDB 過期快取
      this.register({
        name: 'indexeddb-cache',
        priority: 7,
        fn: async (opts) => {
          if (IndexedDBCache && opts.force) {
            try {
              const cacheManager = IndexedDBCache.getCacheManager();
              if (cacheManager && typeof cacheManager.cleanupExpired === 'function') {
                await cacheManager.cleanupExpired();
                console.log('🧹 [IndexedDB] 過期快取已清理');
              }
            } catch (e) {
              console.warn('⚠️ [IndexedDB] 清理失敗:', e);
            }
          }
        }
      });
    }

    /**
     * 獲取記憶體使用統計
     */
    getMemoryStats() {
      const stats = {
        blobURLs: BlobURLManager ? BlobURLManager.getStats() : null,
        performance: null,
        workerPool: null,
        indexedDB: null
      };

      // 如果支援 performance.memory
      if (performance && performance.memory) {
        stats.performance = {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
          ratio: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(1) + '%'
        };
      }

      // 🚀 新增：Worker 池統計
      if (WorkerPoolManager) {
        try {
          const workerPool = WorkerPoolManager.getVideoThumbnailWorkerPool();
          if (workerPool && typeof workerPool.getStats === 'function') {
            stats.workerPool = workerPool.getStats();
          }
        } catch (e) {
          console.warn('⚠️ [Stats] Worker 統計失敗:', e);
        }
      }

      // 🚀 新增：IndexedDB 統計
      if (IndexedDBCache) {
        try {
          const cacheManager = IndexedDBCache.getCacheManager();
          if (cacheManager && typeof cacheManager.getStats === 'function') {
            stats.indexedDB = cacheManager.getStats();
          }
        } catch (e) {
          console.warn('⚠️ [Stats] IndexedDB 統計失敗:', e);
        }
      }

      return stats;
    }

    /**
     * 檢查記憶體壓力等級
     * @returns {Object} { level: 'normal'|'medium'|'high'|'critical', ratio: number }
     */
    checkMemoryPressure() {
      // 不支援 performance.memory 時返回正常
      if (!performance || !performance.memory) {
        return { level: 'normal', ratio: 0 };
      }

      const { usedJSHeapSize, jsHeapSizeLimit } = performance.memory;
      const usageRatio = usedJSHeapSize / jsHeapSizeLimit;

      if (usageRatio > 0.9) {
        console.warn('⚠️ 記憶體壓力：critical (' + (usageRatio * 100).toFixed(1) + '%)');
        return { level: 'critical', ratio: usageRatio };
      }
      if (usageRatio > 0.7) {
        console.warn('⚠️ 記憶體壓力：high (' + (usageRatio * 100).toFixed(1) + '%)');
        return { level: 'high', ratio: usageRatio };
      }
      if (usageRatio > 0.5) {
        return { level: 'medium', ratio: usageRatio };
      }
      
      return { level: 'normal', ratio: usageRatio };
    }
  }

  // ============================================
  // 導出
  // ============================================
  const cleanupManager = new MemoryCleanupManager();
  cleanupManager.registerDefaultTasks();
  
  global.LearningUploadCleanup = cleanupManager;
  
  // 導出便捷函數供外部使用
  global.checkMemoryPressure = function() {
    return cleanupManager.checkMemoryPressure();
  };

})(window);
