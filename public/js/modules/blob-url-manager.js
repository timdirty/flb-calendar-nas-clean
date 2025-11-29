/**
 * 🔗 Blob URL 統一管理器
 * 解決內存洩漏和 URL 重複創建問題
 */

(function(global) {
    'use strict';

    /**
     * Blob URL 管理器類別
     */
    class BlobURLManager {
        constructor() {
            this.urlMap = new Map(); // URL -> { refCount, metadata, createdAt, file }
            this.fileToUrl = new WeakMap(); // File -> URL (弱引用，檔案被回收時自動清理)
            this.debugMode = false; // 除錯模式
            
            // 統計資訊
            this.stats = {
                created: 0,
                reused: 0,
                revoked: 0,
                cleaned: 0
            };
            
            // 定期清理過期 URL（每 5 分鐘）
            this.startCleanupTimer();
        }

        /**
         * 創建或重用 Blob URL
         * @param {File|Blob} file - 檔案或 Blob 物件
         * @param {Object} metadata - 額外的元資料（可選）
         * @returns {string} Blob URL
         */
        createObjectURL(file, metadata = {}) {
            if (!file) {
                console.error('❌ [BlobURL] 檔案為空');
                return '';
            }

            // 檢查是否已有相同檔案的 URL
            if (this.fileToUrl.has(file)) {
                const existingUrl = this.fileToUrl.get(file);
                const entry = this.urlMap.get(existingUrl);
                
                if (entry) {
                    // 增加引用計數
                    entry.refCount++;
                    this.stats.reused++;
                    
                    if (this.debugMode || file.__objectUrl) {
                        console.log('♻️ [BlobURL] 重用已存在的 URL:', 
                            this.getShortUrl(existingUrl), 
                            '引用數:', entry.refCount,
                            metadata.fileName || '');
                    }
                    
                    return existingUrl;
                }
            }

            // 創建新的 Blob URL
            const url = URL.createObjectURL(file);
            
            // 儲存到管理器
            this.urlMap.set(url, {
                refCount: 1,
                createdAt: Date.now(),
                metadata: metadata,
                file: file,
                size: file.size || 0,
                type: file.type || 'unknown'
            });
            
            this.fileToUrl.set(file, url);
            
            // 在檔案物件上保存 URL（與 v48 修復相容）
            if (file && typeof file === 'object') {
                try {
                    file.__objectUrl = url;
                } catch (e) {
                    // 某些 Blob 物件可能不允許添加屬性
                }
            }
            
            this.stats.created++;
            
            if (this.debugMode) {
                console.log('🆕 [BlobURL] 創建新 URL:', 
                    this.getShortUrl(url),
                    metadata.fileName || '',
                    this.formatSize(file.size || 0));
            }
            
            return url;
        }

        /**
         * 釋放 Blob URL
         * @param {string} url - 要釋放的 URL
         * @param {boolean} force - 是否強制釋放（忽略引用計數）
         */
        revokeObjectURL(url, force = false) {
            if (!url || !url.startsWith('blob:')) {
                return;
            }

            const entry = this.urlMap.get(url);
            if (!entry) {
                // URL 不在管理器中，直接釋放
                try {
                    URL.revokeObjectURL(url);
                    if (this.debugMode) {
                        console.log('🗑️ [BlobURL] 釋放未管理的 URL:', this.getShortUrl(url));
                    }
                } catch (e) {}
                return;
            }

            // 減少引用計數
            entry.refCount--;

            if (force || entry.refCount <= 0) {
                // 真正釋放 URL
                try {
                    URL.revokeObjectURL(url);
                    this.urlMap.delete(url);
                    this.stats.revoked++;
                    
                    if (this.debugMode) {
                        console.log('🗑️ [BlobURL] 釋放:', 
                            this.getShortUrl(url),
                            entry.metadata.fileName || '');
                    }
                } catch (e) {
                    console.error('❌ [BlobURL] 釋放失敗:', e);
                }
            } else {
                if (this.debugMode) {
                    console.log('📉 [BlobURL] 減少引用:', 
                        this.getShortUrl(url),
                        '剩餘:', entry.refCount);
                }
            }
        }

        /**
         * 清理過期的 Blob URL
         * @param {number} maxAge - 最大存活時間（毫秒），預設 30 分鐘
         * @returns {number} 清理的 URL 數量
         */
        cleanup(maxAge = 30 * 60 * 1000) {
            const now = Date.now();
            const toRevoke = [];
            
            this.urlMap.forEach((entry, url) => {
                // 清理條件：
                // 1. 超過最大存活時間
                // 2. 引用計數為 0 且超過 5 分鐘
                const age = now - entry.createdAt;
                const shouldClean = age > maxAge || 
                                   (entry.refCount <= 0 && age > 5 * 60 * 1000);
                
                if (shouldClean) {
                    toRevoke.push(url);
                }
            });
            
            toRevoke.forEach(url => {
                try {
                    URL.revokeObjectURL(url);
                    this.urlMap.delete(url);
                    this.stats.cleaned++;
                } catch (e) {}
            });
            
            if (toRevoke.length > 0) {
                console.log('🧹 [BlobURL] 清理過期 URL:', toRevoke.length, '個');
            }
            
            return toRevoke.length;
        }

        /**
         * 清理所有 Blob URL
         */
        cleanupAll() {
            const count = this.urlMap.size;
            
            this.urlMap.forEach((entry, url) => {
                try {
                    URL.revokeObjectURL(url);
                } catch (e) {}
            });
            
            this.urlMap.clear();
            console.log('🧹 [BlobURL] 清理所有 URL:', count, '個');
        }

        /**
         * 取得統計資訊
         * @returns {Object} 統計資訊
         */
        getStats() {
            const activeUrls = Array.from(this.urlMap.entries()).map(([url, entry]) => ({
                url: this.getShortUrl(url),
                refCount: entry.refCount,
                age: this.formatAge(Date.now() - entry.createdAt),
                size: this.formatSize(entry.size),
                type: entry.type,
                metadata: entry.metadata
            }));

            return {
                summary: {
                    active: this.urlMap.size,
                    created: this.stats.created,
                    reused: this.stats.reused,
                    revoked: this.stats.revoked,
                    cleaned: this.stats.cleaned,
                    reuseRate: this.stats.created > 0 ? 
                        ((this.stats.reused / (this.stats.created + this.stats.reused)) * 100).toFixed(1) + '%' : 
                        '0%'
                },
                urls: activeUrls
            };
        }

        /**
         * 開啟/關閉除錯模式
         * @param {boolean} enabled - 是否開啟
         */
        setDebugMode(enabled) {
            this.debugMode = enabled;
            console.log('🔧 [BlobURL] 除錯模式:', enabled ? '開啟' : '關閉');
        }

        /**
         * 開始定期清理計時器
         */
        startCleanupTimer() {
            // 每 5 分鐘執行一次清理
            setInterval(() => {
                this.cleanup();
            }, 5 * 60 * 1000);
        }

        /**
         * 取得短 URL（用於顯示）
         * @private
         */
        getShortUrl(url) {
            if (!url) return '';
            const match = url.match(/blob:.*\/([^/]+)$/);
            return match ? match[1].substring(0, 8) + '...' : url.substring(5, 20);
        }

        /**
         * 格式化檔案大小
         * @private
         */
        formatSize(bytes) {
            if (bytes === 0) return '0 B';
            const k = 1024;
            const sizes = ['B', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
        }

        /**
         * 格式化時間
         * @private
         */
        formatAge(ms) {
            const seconds = Math.floor(ms / 1000);
            if (seconds < 60) return seconds + ' 秒';
            const minutes = Math.floor(seconds / 60);
            if (minutes < 60) return minutes + ' 分鐘';
            const hours = Math.floor(minutes / 60);
            return hours + ' 小時';
        }

        /**
         * 檢查 URL 是否由管理器管理
         * @param {string} url - 要檢查的 URL
         * @returns {boolean} 是否被管理
         */
        isManaged(url) {
            return this.urlMap.has(url);
        }

        /**
         * 取得 URL 的元資料
         * @param {string} url - Blob URL
         * @returns {Object|null} 元資料
         */
        getMetadata(url) {
            const entry = this.urlMap.get(url);
            return entry ? entry.metadata : null;
        }
    }

    // 創建全域實例
    const instance = new BlobURLManager();

    // 覆蓋原生方法（可選，需要謹慎使用）
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;

    // 提供相容性包裝（可以透過設定啟用）
    function enableGlobalOverride() {
        URL.createObjectURL = function(file) {
            // 使用管理器創建
            return instance.createObjectURL(file, {
                source: 'global-override',
                timestamp: Date.now()
            });
        };

        URL.revokeObjectURL = function(url) {
            // 使用管理器釋放
            instance.revokeObjectURL(url);
        };

        console.log('✅ [BlobURL] 全域覆蓋已啟用');
    }

    // 還原原生方法
    function disableGlobalOverride() {
        URL.createObjectURL = originalCreateObjectURL;
        URL.revokeObjectURL = originalRevokeObjectURL;
        console.log('✅ [BlobURL] 全域覆蓋已停用');
    }

    // 匯出到全域
    global.BlobURLManager = instance;
    global.BlobURLManager.enableGlobalOverride = enableGlobalOverride;
    global.BlobURLManager.disableGlobalOverride = disableGlobalOverride;
    
    // 方便的別名
    global.BlobURL = instance;

    // 在頁面卸載時清理所有 URL
    if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', function() {
            instance.cleanupAll();
        });
    }

    console.log('✅ [BlobURL] 管理器已初始化');
    
})(typeof window !== 'undefined' ? window : global);
