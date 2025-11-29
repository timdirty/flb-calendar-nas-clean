/**
 * 學習歷程上傳系統 - 媒體快取管理器
 * 統一管理媒體檔案的快取策略
 */

(function (global) {
  'use strict';

  const Config = global.LearningUploadConfig;

  // ============================================
  // 媒體快取管理器
  // ============================================
  class MediaCache {
    constructor() {
      this.cache = new Map();
      this.maxSize = Config.get('cache.maxSize') || 50 * 1024 * 1024; // 50MB
      this.currentSize = 0;
      this.strategy = Config.get('cache.strategy') || 'lru'; // lru, fifo
      
      // LRU: 記錄訪問時間
      this.accessLog = new Map();
    }

    /**
     * 添加到快取
     */
    set(key, value, metadata) {
      if (!key) return false;

      const size = this.estimateSize(value);
      
      // 如果單個項目超過快取大小，不快取
      if (size > this.maxSize) {
        console.warn('⚠️ [MediaCache] 項目過大，不快取:', key);
        return false;
      }

      // 確保有足夠空間
      this.ensureSpace(size);

      const entry = {
        value: value,
        size: size,
        metadata: metadata || {},
        createdAt: Date.now(),
        accessedAt: Date.now()
      };

      this.cache.set(key, entry);
      this.accessLog.set(key, Date.now());
      this.currentSize += size;

      return true;
    }

    /**
     * 從快取獲取
     */
    get(key) {
      const entry = this.cache.get(key);
      if (!entry) return null;

      // 更新訪問時間（LRU）
      entry.accessedAt = Date.now();
      this.accessLog.set(key, Date.now());

      return entry.value;
    }

    /**
     * 檢查是否在快取中
     */
    has(key) {
      return this.cache.has(key);
    }

    /**
     * 從快取移除
     */
    delete(key) {
      const entry = this.cache.get(key);
      if (!entry) return false;

      this.currentSize -= entry.size;
      this.cache.delete(key);
      this.accessLog.delete(key);

      return true;
    }

    /**
     * 清空快取
     */
    clear() {
      this.cache.clear();
      this.accessLog.clear();
      this.currentSize = 0;
    }

    /**
     * 確保有足夠空間
     */
    ensureSpace(needed) {
      while (this.currentSize + needed > this.maxSize && this.cache.size > 0) {
        const keyToRemove = this.selectVictim();
        if (keyToRemove) {
          this.delete(keyToRemove);
        } else {
          break;
        }
      }
    }

    /**
     * 選擇要移除的項目
     */
    selectVictim() {
      if (this.strategy === 'lru') {
        return this.selectLRU();
      } else if (this.strategy === 'fifo') {
        return this.selectFIFO();
      }
      return null;
    }

    /**
     * LRU: 選擇最久未訪問的
     */
    selectLRU() {
      let oldest = null;
      let oldestTime = Infinity;

      this.accessLog.forEach((time, key) => {
        if (time < oldestTime) {
          oldestTime = time;
          oldest = key;
        }
      });

      return oldest;
    }

    /**
     * FIFO: 選擇最早創建的
     */
    selectFIFO() {
      let oldest = null;
      let oldestTime = Infinity;

      this.cache.forEach((entry, key) => {
        if (entry.createdAt < oldestTime) {
          oldestTime = entry.createdAt;
          oldest = key;
        }
      });

      return oldest;
    }

    /**
     * 估算大小（bytes）
     */
    estimateSize(value) {
      if (!value) return 0;

      if (typeof value === 'string') {
        return value.length * 2; // UTF-16
      } else if (value instanceof Blob || value instanceof File) {
        return value.size;
      } else if (value instanceof ArrayBuffer) {
        return value.byteLength;
      } else if (typeof value === 'object') {
        try {
          return JSON.stringify(value).length * 2;
        } catch (e) {
          return 1024; // 預設 1KB
        }
      }

      return 100; // 預設大小
    }

    /**
     * 獲取統計資訊
     */
    getStats() {
      return {
        size: this.cache.size,
        currentSize: this.currentSize,
        maxSize: this.maxSize,
        utilization: (this.currentSize / this.maxSize * 100).toFixed(2) + '%',
        strategy: this.strategy
      };
    }

    /**
     * 清理過期項目
     */
    cleanup(maxAge) {
      const now = Date.now();
      const age = maxAge || Config.get('cache.ttl') || 30 * 60 * 1000;

      const toRemove = [];
      this.cache.forEach((entry, key) => {
        if (now - entry.accessedAt > age) {
          toRemove.push(key);
        }
      });

      toRemove.forEach(key => this.delete(key));

      if (toRemove.length > 0) {
        console.log(`🧹 [MediaCache] 清理了 ${toRemove.length} 個過期項目`);
      }

      return toRemove.length;
    }
  }

  // ============================================
  // 導出
  // ============================================
  const mediaCache = new MediaCache();
  global.LearningUploadMediaCache = mediaCache;

  // 定期清理過期項目
  setInterval(() => {
    mediaCache.cleanup();
  }, 10 * 60 * 1000); // 每 10 分鐘

})(window);
