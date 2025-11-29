/**
 * 學習歷程上傳系統 - Blob URL 生命週期管理器
 * 追蹤和管理所有 Blob URL，防止記憶體洩漏
 */

(function (global) {
  'use strict';

  // ============================================
  // Blob URL 管理器
  // ============================================
  class BlobURLManager {
    constructor() {
      // 追蹤所有 Blob URL
      this.urls = new Map(); // url -> { created: timestamp, refs: number, element: element }
      this.elementMap = new WeakMap(); // element -> url
      
      // 自動清理配置
      this.autoCleanup = true;
      this.cleanupInterval = 60000; // 60 秒檢查一次
      this.maxAge = 5 * 60 * 1000; // 5 分鐘未使用自動清理
      
      // 監聽頁面可見性
      this.setupVisibilityListener();
      
      // 啟動自動清理
      if (this.autoCleanup) {
        this.startAutoCleanup();
      }
    }

    /**
     * 創建 Blob URL 並追蹤
     */
    create(blob, element, metadata) {
      try {
        const url = URL.createObjectURL(blob);
        const now = Date.now();
        
        this.urls.set(url, {
          created: now,
          lastUsed: now,
          refs: 1,
          element: element || null,
          metadata: metadata || {},
          blob: blob // 保存引用以便驗證
        });
        
        if (element) {
          this.elementMap.set(element, url);
          // 元素移除時自動清理
          this.watchElementRemoval(element);
        }
        
        return url;
      } catch (e) {
        console.error('❌ 創建 Blob URL 失敗:', e);
        return null;
      }
    }

    /**
     * 註冊 Blob URL（已存在的 URL）
     */
    register(url, element, metadata) {
      if (!url || !url.startsWith('blob:')) {
        return false;
      }
      
      const existing = this.urls.get(url);
      if (existing) {
        existing.refs++;
        existing.lastUsed = Date.now();
        if (element) {
          existing.element = element;
          this.elementMap.set(element, url);
          this.watchElementRemoval(element);
        }
      } else {
        this.urls.set(url, {
          created: Date.now(),
          lastUsed: Date.now(),
          refs: 1,
          element: element || null,
          metadata: metadata || {}
        });
        
        if (element) {
          this.elementMap.set(element, url);
          this.watchElementRemoval(element);
        }
      }
      
      return true;
    }

    /**
     * 釋放 Blob URL（減少引用計數）
     */
    release(url, force) {
      if (!url || !url.startsWith('blob:')) {
        return false;
      }
      
      const entry = this.urls.get(url);
      if (!entry) {
        // 未知的 URL，直接嘗試釋放
        try {
          URL.revokeObjectURL(url);
          return true;
        } catch (e) {
          return false;
        }
      }
      
      if (force || entry.refs <= 1) {
        try {
          URL.revokeObjectURL(url);
          this.urls.delete(url);
          
          // 清理元素映射
          if (entry.element) {
            this.elementMap.delete(entry.element);
          }
          
          return true;
        } catch (e) {
          console.error('❌ 釋放 Blob URL 失敗:', e);
          return false;
        }
      } else {
        entry.refs--;
        entry.lastUsed = Date.now();
        return false; // 未實際釋放
      }
    }

    /**
     * 監聽元素移除
     */
    watchElementRemoval(element) {
      if (!element || !element.parentNode) {
        return;
      }
      
      // 使用 MutationObserver 監聽元素移除
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.removedNodes.forEach((node) => {
            if (node === element || node.contains && node.contains(element)) {
              const url = this.elementMap.get(element);
              if (url) {
                this.release(url, true);
                observer.disconnect();
              }
            }
          });
        });
      });
      
      observer.observe(element.parentNode, {
        childList: true,
        subtree: true
      });
      
      // 設置觀察器引用（避免被 GC）
      if (!element.__blobObserver) {
        element.__blobObserver = observer;
      }
    }

    /**
     * 根據元素獲取 URL
     */
    getURLByElement(element) {
      return this.elementMap.get(element);
    }

    /**
     * 清理所有未使用的 URL
     */
    cleanupUnused(maxAge) {
      const now = Date.now();
      const age = maxAge || this.maxAge;
      const toRemove = [];
      
      this.urls.forEach((entry, url) => {
        // 檢查元素是否還在 DOM 中
        if (entry.element) {
          if (!entry.element.isConnected) {
            toRemove.push(url);
            return;
          }
        }
        
        // 檢查是否過期
        if (now - entry.lastUsed > age) {
          toRemove.push(url);
        }
      });
      
      let cleaned = 0;
      toRemove.forEach(url => {
        if (this.release(url, true)) {
          cleaned++;
        }
      });
      
      if (cleaned > 0) {
        console.log(`🧹 清理了 ${cleaned} 個未使用的 Blob URL`);
      }
      
      return cleaned;
    }

    /**
     * 清理所有 URL
     */
    cleanupAll() {
      let count = 0;
      this.urls.forEach((entry, url) => {
        if (this.release(url, true)) {
          count++;
        }
      });
      
      this.elementMap = new WeakMap();
      console.log(`🧹 清理了所有 ${count} 個 Blob URL`);
      return count;
    }

    /**
     * 設置頁面可見性監聽
     */
    setupVisibilityListener() {
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) {
            // 頁面隱藏時清理未使用的 URL
            this.cleanupUnused(this.maxAge / 2); // 使用更短的超時時間
          }
        });
      }
    }

    /**
     * 啟動自動清理
     */
    startAutoCleanup() {
      if (this._cleanupTimer) {
        clearInterval(this._cleanupTimer);
      }
      
      this._cleanupTimer = setInterval(() => {
        this.cleanupUnused();
      }, this.cleanupInterval);
    }

    /**
     * 停止自動清理
     */
    stopAutoCleanup() {
      if (this._cleanupTimer) {
        clearInterval(this._cleanupTimer);
        this._cleanupTimer = null;
      }
    }

    /**
     * 獲取統計信息
     */
    getStats() {
      return {
        total: this.urls.size,
        byElement: Array.from(this.urls.values()).filter(e => e.element).length,
        orphaned: Array.from(this.urls.values()).filter(e => e.element && !e.element.isConnected).length
      };
    }

    /**
     * 清理資源
     */
    destroy() {
      this.stopAutoCleanup();
      this.cleanupAll();
      this.urls.clear();
      this.elementMap = new WeakMap();
    }
  }

  // ============================================
  // 導出
  // ============================================
  const blobURLManager = new BlobURLManager();
  global.LearningUploadBlobURL = blobURLManager;

  // 頁面卸載時清理
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      blobURLManager.cleanupAll();
    });
    
    window.addEventListener('pagehide', () => {
      blobURLManager.cleanupAll();
    });
  }

})(window);
