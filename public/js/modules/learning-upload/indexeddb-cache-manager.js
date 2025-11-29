/**
 * ============================================
 * IndexedDB 快取管理器
 * ============================================
 * 功能：本地快取影片縮圖、上傳佇列和草稿
 * 支援：自動清理、配額管理、版本控制
 */

(function (global) {
  'use strict';

  // ==================== 配置 ====================
  const CONFIG = {
    dbName: 'FLB_LearningRecords',
    version: 1,
    stores: {
      thumbnails: 'thumbnails',        // 影片縮圖
      uploadQueue: 'uploadQueue',      // 上傳佇列
      drafts: 'drafts'                 // 草稿
    },
    thumbnailMaxAge: 30 * 24 * 60 * 60 * 1000,  // 30 天
    thumbnailMaxSize: 50 * 1024 * 1024,          // 50 MB
    autoCleanup: true,
    cleanupInterval: 24 * 60 * 60 * 1000         // 每 24 小時清理一次
  };

  // ==================== IndexedDB 快取管理器 ====================
  class IndexedDBCacheManager {
    constructor(options = {}) {
      this.config = { ...CONFIG, ...options };
      this.db = null;
      this.isOpen = false;
      this.initPromise = null;
      
      // 自動清理
      if (this.config.autoCleanup) {
        this.startAutoCleanup();
      }
    }

    /**
     * 初始化資料庫
     */
    async init() {
      if (this.isOpen) return this.db;
      if (this.initPromise) return this.initPromise;

      this.initPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
          console.warn('⚠️ [IndexedDB] 瀏覽器不支援 IndexedDB');
          reject(new Error('IndexedDB 不支援'));
          return;
        }

        const request = indexedDB.open(this.config.dbName, this.config.version);

        request.onerror = () => {
          console.error('❌ [IndexedDB] 開啟失敗:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          this.isOpen = true;
          console.log('✅ [IndexedDB] 已開啟');
          resolve(this.db);
        };

        request.onupgradeneeded = (event) => {
          console.log('🔄 [IndexedDB] 升級資料庫...');
          const db = event.target.result;

          // 創建 thumbnails store
          if (!db.objectStoreNames.contains(this.config.stores.thumbnails)) {
            const thumbnailStore = db.createObjectStore(this.config.stores.thumbnails, { keyPath: 'hash' });
            thumbnailStore.createIndex('timestamp', 'timestamp', { unique: false });
            thumbnailStore.createIndex('size', 'size', { unique: false });
            console.log('✅ [IndexedDB] 創建 thumbnails store');
          }

          // 創建 uploadQueue store
          if (!db.objectStoreNames.contains(this.config.stores.uploadQueue)) {
            const queueStore = db.createObjectStore(this.config.stores.uploadQueue, { keyPath: 'id', autoIncrement: true });
            queueStore.createIndex('status', 'status', { unique: false });
            queueStore.createIndex('timestamp', 'timestamp', { unique: false });
            console.log('✅ [IndexedDB] 創建 uploadQueue store');
          }

          // 創建 drafts store
          if (!db.objectStoreNames.contains(this.config.stores.drafts)) {
            const draftStore = db.createObjectStore(this.config.stores.drafts, { keyPath: 'key' });
            draftStore.createIndex('timestamp', 'timestamp', { unique: false });
            console.log('✅ [IndexedDB] 創建 drafts store');
          }
        };
      });

      return this.initPromise;
    }

    /**
     * 儲存縮圖到快取
     */
    async saveThumbnail(hash, blob, metadata = {}) {
      try {
        await this.init();

        const data = {
          hash,
          blob,
          size: blob.size,
          type: blob.type,
          timestamp: Date.now(),
          metadata
        };

        const transaction = this.db.transaction([this.config.stores.thumbnails], 'readwrite');
        const store = transaction.objectStore(this.config.stores.thumbnails);
        
        await new Promise((resolve, reject) => {
          const request = store.put(data);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        console.log('✅ [IndexedDB] 縮圖已儲存:', hash.substring(0, 8));
        return true;
      } catch (error) {
        console.error('❌ [IndexedDB] 儲存縮圖失敗:', error);
        return false;
      }
    }

    /**
     * 從快取讀取縮圖
     */
    async getThumbnail(hash) {
      try {
        await this.init();

        const transaction = this.db.transaction([this.config.stores.thumbnails], 'readonly');
        const store = transaction.objectStore(this.config.stores.thumbnails);

        const data = await new Promise((resolve, reject) => {
          const request = store.get(hash);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

        if (!data) {
          return null;
        }

        // 檢查是否過期
        const age = Date.now() - data.timestamp;
        if (age > this.config.thumbnailMaxAge) {
          console.log('⏰ [IndexedDB] 縮圖已過期:', hash.substring(0, 8));
          await this.deleteThumbnail(hash);
          return null;
        }

        console.log('✅ [IndexedDB] 縮圖已讀取:', hash.substring(0, 8));
        return data.blob;
      } catch (error) {
        console.error('❌ [IndexedDB] 讀取縮圖失敗:', error);
        return null;
      }
    }

    /**
     * 刪除縮圖
     */
    async deleteThumbnail(hash) {
      try {
        await this.init();

        const transaction = this.db.transaction([this.config.stores.thumbnails], 'readwrite');
        const store = transaction.objectStore(this.config.stores.thumbnails);

        await new Promise((resolve, reject) => {
          const request = store.delete(hash);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        console.log('🗑️ [IndexedDB] 縮圖已刪除:', hash.substring(0, 8));
        return true;
      } catch (error) {
        console.error('❌ [IndexedDB] 刪除縮圖失敗:', error);
        return false;
      }
    }

    /**
     * 清理過期的縮圖
     */
    async cleanupExpiredThumbnails() {
      try {
        await this.init();

        const now = Date.now();
        const transaction = this.db.transaction([this.config.stores.thumbnails], 'readwrite');
        const store = transaction.objectStore(this.config.stores.thumbnails);
        const index = store.index('timestamp');

        const thumbnails = await new Promise((resolve, reject) => {
          const request = index.openCursor();
          const results = [];
          
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          
          request.onerror = () => reject(request.error);
        });

        let deletedCount = 0;
        for (const thumbnail of thumbnails) {
          const age = now - thumbnail.timestamp;
          if (age > this.config.thumbnailMaxAge) {
            await this.deleteThumbnail(thumbnail.hash);
            deletedCount++;
          }
        }

        if (deletedCount > 0) {
          console.log(`🧹 [IndexedDB] 清理了 ${deletedCount} 個過期縮圖`);
        }

        return deletedCount;
      } catch (error) {
        console.error('❌ [IndexedDB] 清理失敗:', error);
        return 0;
      }
    }

    /**
     * 清理超大的快取（基於配額）
     */
    async cleanupBySize() {
      try {
        await this.init();

        const transaction = this.db.transaction([this.config.stores.thumbnails], 'readonly');
        const store = transaction.objectStore(this.config.stores.thumbnails);
        const index = store.index('timestamp');

        // 獲取所有縮圖（按時間排序）
        const thumbnails = await new Promise((resolve, reject) => {
          const request = index.openCursor(null, 'next');
          const results = [];
          
          request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          
          request.onerror = () => reject(request.error);
        });

        // 計算總大小
        let totalSize = thumbnails.reduce((sum, t) => sum + t.size, 0);

        if (totalSize <= this.config.thumbnailMaxSize) {
          return 0;
        }

        console.log(`⚠️ [IndexedDB] 快取超過限制: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

        // 刪除最舊的縮圖直到符合限制
        let deletedCount = 0;
        for (const thumbnail of thumbnails) {
          if (totalSize <= this.config.thumbnailMaxSize) break;
          
          await this.deleteThumbnail(thumbnail.hash);
          totalSize -= thumbnail.size;
          deletedCount++;
        }

        console.log(`🧹 [IndexedDB] 清理了 ${deletedCount} 個舊縮圖以釋放空間`);
        return deletedCount;
      } catch (error) {
        console.error('❌ [IndexedDB] 按大小清理失敗:', error);
        return 0;
      }
    }

    /**
     * 啟動自動清理
     */
    startAutoCleanup() {
      console.log('⏰ [IndexedDB] 啟動自動清理');
      
      // 立即執行一次清理
      this.runCleanup();

      // 設定定期清理
      this.cleanupTimer = setInterval(() => {
        this.runCleanup();
      }, this.config.cleanupInterval);
    }

    /**
     * 執行清理
     */
    async runCleanup() {
      console.log('🧹 [IndexedDB] 開始自動清理...');
      
      try {
        const expiredCount = await this.cleanupExpiredThumbnails();
        const sizeCount = await this.cleanupBySize();
        
        console.log(`✅ [IndexedDB] 清理完成: ${expiredCount + sizeCount} 項`);
      } catch (error) {
        console.error('❌ [IndexedDB] 自動清理失敗:', error);
      }
    }

    /**
     * 獲取統計資訊
     */
    async getStats() {
      try {
        await this.init();

        const transaction = this.db.transaction([this.config.stores.thumbnails], 'readonly');
        const store = transaction.objectStore(this.config.stores.thumbnails);

        const thumbnails = await new Promise((resolve, reject) => {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error);
        });

        const totalSize = thumbnails.reduce((sum, t) => sum + t.size, 0);
        const oldestTimestamp = thumbnails.length > 0
          ? Math.min(...thumbnails.map(t => t.timestamp))
          : null;

        return {
          count: thumbnails.length,
          totalSize,
          totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
          oldestTimestamp,
          maxSize: this.config.thumbnailMaxSize,
          maxSizeMB: (this.config.thumbnailMaxSize / 1024 / 1024).toFixed(2),
          usagePercent: ((totalSize / this.config.thumbnailMaxSize) * 100).toFixed(1)
        };
      } catch (error) {
        console.error('❌ [IndexedDB] 獲取統計失敗:', error);
        return null;
      }
    }

    /**
     * 清除所有資料
     */
    async clearAll() {
      try {
        await this.init();

        const stores = Object.values(this.config.stores);
        const transaction = this.db.transaction(stores, 'readwrite');

        for (const storeName of stores) {
          const store = transaction.objectStore(storeName);
          await new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
          });
        }

        console.log('🗑️ [IndexedDB] 已清除所有資料');
        return true;
      } catch (error) {
        console.error('❌ [IndexedDB] 清除資料失敗:', error);
        return false;
      }
    }

    /**
     * 關閉資料庫
     */
    close() {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }

      if (this.db) {
        this.db.close();
        this.db = null;
        this.isOpen = false;
        console.log('✅ [IndexedDB] 已關閉');
      }
    }
  }

  // ==================== 全域單例 ====================
  let globalCacheManager = null;

  /**
   * 獲取全域快取管理器
   */
  function getCacheManager() {
    if (!globalCacheManager) {
      globalCacheManager = new IndexedDBCacheManager();
    }
    return globalCacheManager;
  }

  // ==================== 頁面卸載時關閉 ====================
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (globalCacheManager) {
        globalCacheManager.close();
      }
    });
  }

  // ==================== 導出 ====================
  const IndexedDBCache = {
    IndexedDBCacheManager,
    getCacheManager
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = IndexedDBCache;
  } else if (typeof global !== 'undefined') {
    global.IndexedDBCache = IndexedDBCache;
    global.LearningUploadIndexedDBCache = IndexedDBCache;
  }

})(typeof window !== 'undefined' ? window : this);

