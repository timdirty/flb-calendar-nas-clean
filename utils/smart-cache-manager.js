// ============================================
// 🚀 智能快取管理器（TTL 支援）
// ============================================
// 版本：2025-11-01 - 效能優化
// 功能：記憶體快取、自動過期、統計追蹤

class SmartCacheManager {
    constructor(options = {}) {
        this.cache = new Map();
        this.defaultTTL = options.defaultTTL || 300000; // 預設5分鐘
        this.maxSize = options.maxSize || 1000; // 最大快取數量
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0
        };
        
        // 定期清理過期項目（每分鐘）
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
        
        console.log(`✅ 智能快取管理器已啟動（TTL: ${this.defaultTTL}ms, MaxSize: ${this.maxSize}）`);
    }

    // ==================== 基本操作 ====================

    /**
     * 設定快取項目
     * @param {string} key - 鍵
     * @param {any} value - 值
     * @param {number} ttl - 存活時間（毫秒）
     */
    set(key, value, ttl = null) {
        // 檢查快取大小限制
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }
        
        const expiry = Date.now() + (ttl || this.defaultTTL);
        
        this.cache.set(key, {
            value,
            expiry,
            createdAt: Date.now(),
            hits: 0
        });
        
        this.stats.sets++;
    }

    /**
     * 獲取快取項目
     * @param {string} key - 鍵
     * @returns {any} 值（如果存在且未過期）
     */
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            return null;
        }
        
        // 檢查是否過期
        if (Date.now() > item.expiry) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }
        
        // 增加命中次數
        item.hits++;
        this.stats.hits++;
        
        return item.value;
    }

    /**
     * 檢查鍵是否存在且未過期
     * @param {string} key - 鍵
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * 刪除快取項目
     * @param {string} key - 鍵
     * @returns {boolean} 是否成功刪除
     */
    delete(key) {
        return this.cache.delete(key);
    }

    /**
     * 清空所有快取
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        console.log(`🧹 已清空 ${size} 個快取項目`);
    }

    // ==================== 進階操作 ====================

    /**
     * 獲取或設定快取（如果不存在則調用 factory 函數）
     * @param {string} key - 鍵
     * @param {Function} factory - 產生值的函數（異步）
     * @param {number} ttl - 存活時間
     * @returns {Promise<any>} 值
     */
    async getOrSet(key, factory, ttl = null) {
        // 先嘗試從快取取得
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }
        
        // 快取未命中，調用 factory 函數
        try {
            const value = await factory();
            this.set(key, value, ttl);
            return value;
        } catch (error) {
            console.error(`❌ getOrSet 失敗 (key: ${key}):`, error);
            throw error;
        }
    }

    /**
     * 批次設定多個快取項目
     * @param {Array<{key: string, value: any, ttl?: number}>} items
     */
    batchSet(items) {
        items.forEach(item => {
            this.set(item.key, item.value, item.ttl);
        });
        console.log(`📦 批次設定 ${items.length} 個快取項目`);
    }

    /**
     * 批次獲取多個快取項目
     * @param {Array<string>} keys
     * @returns {Map<string, any>} 結果 Map
     */
    batchGet(keys) {
        const results = new Map();
        keys.forEach(key => {
            const value = this.get(key);
            if (value !== null) {
                results.set(key, value);
            }
        });
        return results;
    }

    /**
     * 更新快取項目（延長 TTL）
     * @param {string} key - 鍵
     * @param {number} ttl - 新的 TTL
     * @returns {boolean} 是否成功
     */
    touch(key, ttl = null) {
        const item = this.cache.get(key);
        if (!item) return false;
        
        item.expiry = Date.now() + (ttl || this.defaultTTL);
        return true;
    }

    // ==================== 清理與維護 ====================

    /**
     * 清理過期項目
     * @returns {number} 清理的項目數量
     */
    cleanup() {
        const now = Date.now();
        let count = 0;
        
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiry) {
                this.cache.delete(key);
                count++;
            }
        }
        
        if (count > 0) {
            console.log(`🧹 清理 ${count} 個過期快取項目`);
        }
        
        return count;
    }

    /**
     * 移除最舊的項目（LRU）
     */
    evictOldest() {
        let oldestKey = null;
        let oldestTime = Infinity;
        
        for (const [key, item] of this.cache.entries()) {
            if (item.createdAt < oldestTime) {
                oldestTime = item.createdAt;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.cache.delete(oldestKey);
            this.stats.evictions++;
            console.log(`⚠️ 快取已滿，移除最舊項目: ${oldestKey}`);
        }
    }

    // ==================== 統計與監控 ====================

    /**
     * 獲取快取統計資訊
     * @returns {object} 統計資訊
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;
        
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            hits: this.stats.hits,
            misses: this.stats.misses,
            sets: this.stats.sets,
            evictions: this.stats.evictions,
            hitRate: `${hitRate}%`
        };
    }

    /**
     * 列出所有快取鍵（用於除錯）
     * @returns {Array<string>}
     */
    keys() {
        return Array.from(this.cache.keys());
    }

    /**
     * 獲取快取項目的詳細資訊
     * @param {string} key
     * @returns {object|null}
     */
    getItemInfo(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        const now = Date.now();
        return {
            key,
            exists: true,
            expired: now > item.expiry,
            createdAt: new Date(item.createdAt).toISOString(),
            expiresAt: new Date(item.expiry).toISOString(),
            ttlRemaining: Math.max(0, item.expiry - now),
            hits: item.hits,
            size: JSON.stringify(item.value).length
        };
    }

    /**
     * 列印快取摘要（除錯用）
     */
    printSummary() {
        const stats = this.getStats();
        console.log('📊 快取摘要:');
        console.log(`   - 當前大小: ${stats.size}/${stats.maxSize}`);
        console.log(`   - 命中率: ${stats.hitRate}`);
        console.log(`   - 總命中: ${stats.hits}`);
        console.log(`   - 總未命中: ${stats.misses}`);
        console.log(`   - 總設定: ${stats.sets}`);
        console.log(`   - 總驅逐: ${stats.evictions}`);
    }

    // ==================== 清理 ====================

    /**
     * 銷毀快取管理器
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.clear();
        console.log('🛑 智能快取管理器已關閉');
    }
}

// 導出類別（可創建多個實例）
module.exports = SmartCacheManager;











































