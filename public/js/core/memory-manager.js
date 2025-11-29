// ============================================
// 記憶體管理工具 - 老舊裝置優化版
// ============================================
// 版本：2024-10-26-PERFORMANCE-BOOST
// 防止記憶體洩漏，自動清理未使用的資源

(function() {
    'use strict';
    
    console.log('🚀 記憶體管理工具初始化...');
    
    // 事件監聽器追蹤
    const eventListeners = new WeakMap();
    
    // 定時器追蹤
    const timers = new Set();
    
    // 快取管理
    const caches = new Map();
    
    /**
     * 安全添加事件監聽器（自動追蹤）
     * @param {Element} element - 目標元素
     * @param {string} event - 事件名稱
     * @param {Function} handler - 處理函數
     * @param {Object} options - 選項
     */
    function addEventListener(element, event, handler, options = {}) {
        if (!element || !event || !handler) return;
        
        // 添加 passive 選項以提升滾動效能
        const finalOptions = {
            passive: ['scroll', 'touchstart', 'touchmove', 'wheel'].includes(event),
            ...options
        };
        
        element.addEventListener(event, handler, finalOptions);
        
        // 追蹤監聽器
        if (!eventListeners.has(element)) {
            eventListeners.set(element, []);
        }
        
        eventListeners.get(element).push({
            event,
            handler,
            options: finalOptions
        });
        
        console.log(`✅ 已追蹤事件監聽器: ${event} on`, element);
    }
    
    /**
     * 移除元素的所有事件監聽器
     * @param {Element} element - 目標元素
     */
    function removeAllEventListeners(element) {
        if (!element || !eventListeners.has(element)) return;
        
        const listeners = eventListeners.get(element);
        listeners.forEach(({ event, handler, options }) => {
            element.removeEventListener(event, handler, options);
        });
        
        eventListeners.delete(element);
        console.log('🗑️ 已清除元素的所有事件監聽器');
    }
    
    /**
     * 安全設置定時器（自動追蹤）
     * @param {Function} callback - 回調函數
     * @param {number} delay - 延遲時間
     * @param {boolean} isInterval - 是否為 interval
     * @returns {number} 定時器 ID
     */
    function setTimer(callback, delay, isInterval = false) {
        const timerId = isInterval 
            ? setInterval(callback, delay)
            : setTimeout(() => {
                callback();
                timers.delete(timerId);
            }, delay);
        
        timers.add(timerId);
        console.log(`⏰ 已追蹤定時器: ${isInterval ? 'interval' : 'timeout'} #${timerId}`);
        
        return timerId;
    }
    
    /**
     * 清除定時器
     * @param {number} timerId - 定時器 ID
     */
    function clearTimer(timerId) {
        if (!timerId) return;
        
        clearTimeout(timerId);
        clearInterval(timerId);
        timers.delete(timerId);
        
        console.log(`🗑️ 已清除定時器: #${timerId}`);
    }
    
    /**
     * 清除所有定時器
     */
    function clearAllTimers() {
        timers.forEach(timerId => {
            clearTimeout(timerId);
            clearInterval(timerId);
        });
        
        timers.clear();
        console.log('🗑️ 已清除所有定時器');
    }
    
    /**
     * 創建 LRU 快取（最近最少使用）
     * @param {number} maxSize - 最大快取項目數
     * @returns {Object} 快取物件
     */
    function createLRUCache(maxSize = 100) {
        const cache = new Map();
        
        return {
            get(key) {
                if (!cache.has(key)) return undefined;
                
                // 移到最後（最近使用）
                const value = cache.get(key);
                cache.delete(key);
                cache.set(key, value);
                
                return value;
            },
            
            set(key, value) {
                // 如果已存在，先刪除（重新設置到最後）
                if (cache.has(key)) {
                    cache.delete(key);
                }
                
                cache.set(key, value);
                
                // 超過大小限制，刪除最舊的項目
                if (cache.size > maxSize) {
                    const firstKey = cache.keys().next().value;
                    cache.delete(firstKey);
                }
            },
            
            has(key) {
                return cache.has(key);
            },
            
            clear() {
                cache.clear();
            },
            
            get size() {
                return cache.size;
            }
        };
    }
    
    /**
     * 註冊命名快取
     * @param {string} name - 快取名稱
     * @param {number} maxSize - 最大大小
     */
    function registerCache(name, maxSize = 100) {
        const cache = createLRUCache(maxSize);
        caches.set(name, cache);
        console.log(`📦 已註冊快取: ${name} (最大 ${maxSize} 項)`);
        return cache;
    }
    
    /**
     * 獲取命名快取
     * @param {string} name - 快取名稱
     */
    function getCache(name) {
        return caches.get(name);
    }
    
    /**
     * 清除命名快取
     * @param {string} name - 快取名稱
     */
    function clearCache(name) {
        const cache = caches.get(name);
        if (cache) {
            cache.clear();
            console.log(`🗑️ 已清除快取: ${name}`);
        }
    }
    
    /**
     * 清除所有快取
     */
    function clearAllCaches() {
        caches.forEach((cache, name) => {
            cache.clear();
            console.log(`🗑️ 已清除快取: ${name}`);
        });
    }
    
    /**
     * 記憶體清理（釋放未使用的資源）
     */
    function cleanup() {
        console.log('🧹 開始記憶體清理...');
        
        // 清除所有定時器
        clearAllTimers();
        
        // 清除所有快取
        clearAllCaches();
        
        // 觸發垃圾回收（如果瀏覽器支援）
        if (window.gc) {
            window.gc();
            console.log('🗑️ 已觸發垃圾回收');
        }
        
        console.log('✅ 記憶體清理完成');
    }
    
    /**
     * 監控記憶體使用
     */
    function monitorMemoryUsage() {
        if (!performance.memory) {
            console.warn('⚠️ 此瀏覽器不支援記憶體監控');
            return;
        }
        
        const used = performance.memory.usedJSHeapSize;
        const total = performance.memory.totalJSHeapSize;
        const limit = performance.memory.jsHeapSizeLimit;
        
        const usedMB = (used / 1024 / 1024).toFixed(2);
        const totalMB = (total / 1024 / 1024).toFixed(2);
        const limitMB = (limit / 1024 / 1024).toFixed(2);
        const usagePercent = ((used / limit) * 100).toFixed(2);
        
        console.log(`💾 記憶體使用: ${usedMB}MB / ${totalMB}MB (限制: ${limitMB}MB, 使用率: ${usagePercent}%)`);
        
        // 記憶體使用過高警告
        if (usagePercent > 90) {
            console.warn('⚠️ 記憶體使用率超過 90%！建議清理');
            return 'critical';
        } else if (usagePercent > 70) {
            console.warn('⚠️ 記憶體使用率超過 70%');
            return 'warning';
        }
        
        return 'ok';
    }
    
    /**
     * 自動記憶體管理（定期檢查和清理）
     */
    function startAutoCleanup(interval = 300000) { // 預設 5 分鐘
        const timerId = setInterval(() => {
            const status = monitorMemoryUsage();
            
            if (status === 'critical') {
                console.log('🚨 記憶體使用緊急，執行自動清理');
                cleanup();
            } else if (status === 'warning') {
                console.log('⚠️ 記憶體使用偏高，清理部分快取');
                clearAllCaches();
            }
        }, interval);
        
        console.log(`✅ 已啟動自動記憶體管理（每 ${interval / 1000} 秒檢查）`);
        
        return timerId;
    }
    
    /**
     * 防止記憶體洩漏的 cleanup 鉤子
     */
    window.addEventListener('beforeunload', () => {
        console.log('🚪 頁面即將離開，執行最終清理');
        cleanup();
    });
    
    // 導出到全域
    window.MemoryManager = {
        addEventListener,
        removeAllEventListeners,
        setTimer,
        clearTimer,
        clearAllTimers,
        createLRUCache,
        registerCache,
        getCache,
        clearCache,
        clearAllCaches,
        cleanup,
        monitorMemoryUsage,
        startAutoCleanup
    };
    
    console.log('✅ 記憶體管理工具就緒');
    
    // 自動啟動記憶體監控（5 分鐘檢查一次）
    if (performance.memory) {
        startAutoCleanup(300000);
    }
    
})();

