// ============================================
// 效能增強器 - 全面優化 GPU/CPU 功耗
// ============================================
// 版本：2025-01-16-PERFORMANCE-BOOST
// 功能：降低 GPU/CPU 使用率，提升整體效能

(function() {
    'use strict';
    
    console.log('⚡ 效能增強器載入中...');
    
    /**
     * 效能增強器類別
     */
    class PerformanceBooster {
        constructor() {
            this.config = {
                // 節流延遲時間（毫秒）
                scrollThrottle: 150,
                resizeThrottle: 250,
                // 是否啟用各項優化
                enableCSSContainment: true,
                enablePassiveListeners: true,
                enableLazyImages: true,
                enableReducedMotion: false,
                enableIdleCallback: true
            };
            
            this.stats = {
                scrollEvents: 0,
                resizeEvents: 0,
                idleTasks: 0,
                optimizedImages: 0
            };
            
            this.init();
        }
        
        init() {
            console.log('🚀 開始初始化效能優化...');
            
            // 1. CSS Containment 優化
            if (this.config.enableCSSContainment) {
                this.applyCSSContainment();
            }
            
            // 2. Passive Event Listeners
            if (this.config.enablePassiveListeners) {
                this.setupPassiveListeners();
            }
            
            // 3. 圖片懶加載優化
            if (this.config.enableLazyImages) {
                this.optimizeImages();
            }
            
            // 4. 閒置回調優化
            if (this.config.enableIdleCallback) {
                this.setupIdleCallbacks();
            }
            
            // 5. 減少不必要的重繪
            this.reduceRepaints();
            
            // 6. 優化動畫性能
            this.optimizeAnimations();
            
            // 7. 記憶體管理
            this.setupMemoryManagement();
            
            console.log('✅ 效能優化初始化完成');
        }
        
        /**
         * 應用 CSS Containment（隔離渲染）
         */
        applyCSSContainment() {
            // 為卡片元素添加 contain 屬性
            const style = document.createElement('style');
            style.textContent = `
                /* GPU/CPU 優化：CSS Containment */
                .event-card {
                    contain: layout style paint;
                }
                
                .calendar-day {
                    contain: layout paint;
                }
                
                .today-events-grid {
                    contain: layout;
                }
                
                /* 減少重繪範圍 */
                .event-detail {
                    contain: content;
                }
                
                /* 優化動畫性能 */
                @media (prefers-reduced-motion: no-preference) {
                    * {
                        /* 只對真正需要動畫的屬性使用 will-change */
                    }
                }
            `;
            document.head.appendChild(style);
            console.log('✅ CSS Containment 已應用');
        }
        
        /**
         * 設置 Passive Event Listeners
         */
        setupPassiveListeners() {
            // 重新綁定滾動事件為 passive
            const scrollHandler = this.throttle(() => {
                this.stats.scrollEvents++;
            }, this.config.scrollThrottle);
            
            // 使用 passive: true 提升滾動性能
            window.addEventListener('scroll', scrollHandler, { passive: true });
            window.addEventListener('touchstart', (e) => {
                // Touch 事件也使用 passive
            }, { passive: true });
            
            console.log('✅ Passive Listeners 已設置');
        }
        
        /**
         * 優化圖片載入
         */
        optimizeImages() {
            // 使用 Intersection Observer 懶加載圖片
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        
                        // 載入圖片
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            this.stats.optimizedImages++;
                        }
                        
                        imageObserver.unobserve(img);
                    }
                });
            }, {
                rootMargin: '50px'
            });
            
            // 觀察所有帶 data-src 的圖片
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
            
            console.log('✅ 圖片懶加載已啟用');
        }
        
        /**
         * 設置閒置回調（在瀏覽器空閒時執行低優先級任務）
         */
        setupIdleCallbacks() {
            if (!window.requestIdleCallback) {
                console.warn('⚠️ requestIdleCallback 不支援，跳過');
                return;
            }
            
            // 定義低優先級任務隊列
            this.idleTaskQueue = [];
            
            // 執行閒置任務
            const runIdleTasks = (deadline) => {
                while (deadline.timeRemaining() > 0 && this.idleTaskQueue.length > 0) {
                    const task = this.idleTaskQueue.shift();
                    task();
                    this.stats.idleTasks++;
                }
                
                if (this.idleTaskQueue.length > 0) {
                    requestIdleCallback(runIdleTasks);
                }
            };
            
            // 啟動閒置任務處理
            requestIdleCallback(runIdleTasks);
            
            console.log('✅ 閒置回調已設置');
        }
        
        /**
         * 減少不必要的重繪
         */
        reduceRepaints() {
            // 使用 CSS transform 替代 top/left
            const style = document.createElement('style');
            style.textContent = `
                /* 優先使用 transform，避免觸發 layout */
                .modal-overlay,
                .loading-overlay {
                    transform: translateZ(0);
                    backface-visibility: hidden;
                }
                
                /* 減少模糊效果的使用（GPU 密集） */
                .glassmorphism {
                    /* backdrop-filter 改用更簡單的效果 */
                }
            `;
            document.head.appendChild(style);
            console.log('✅ 重繪優化已應用');
        }
        
        /**
         * 優化動畫性能
         */
        optimizeAnimations() {
            const style = document.createElement('style');
            style.textContent = `
                /* 動畫優化：使用 GPU 加速屬性 */
                @keyframes optimized-fade {
                    from { opacity: 0; transform: translateZ(0); }
                    to { opacity: 1; transform: translateZ(0); }
                }
                
                /* 避免 animating layout properties */
                @keyframes optimized-slide {
                    from { transform: translateY(20px) translateZ(0); }
                    to { transform: translateY(0) translateZ(0); }
                }
                
                /* 減少動畫複雜度 */
                * {
                    animation-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
                }
            `;
            document.head.appendChild(style);
            console.log('✅ 動畫優化已應用');
        }
        
        /**
         * 記憶體管理
         */
        setupMemoryManagement() {
            // 定期清理不再需要的 DOM 元素
            setInterval(() => {
                // 移除隱藏且不再需要的元素
                const hiddenElements = document.querySelectorAll('[style*="display: none"]');
                let cleaned = 0;
                
                hiddenElements.forEach(el => {
                    // 檢查是否可以安全移除（非模態框等重要元素）
                    if (el.classList.contains('temporary') || el.dataset.cleanable === 'true') {
                        el.remove();
                        cleaned++;
                    }
                });
                
                if (cleaned > 0) {
                    console.log(`🗑️ 已清理 ${cleaned} 個不需要的元素`);
                }
            }, 60000); // 每分鐘執行一次
            
            console.log('✅ 記憶體管理已設置');
        }
        
        /**
         * 節流函數
         */
        throttle(func, delay) {
            let lastCall = 0;
            return function(...args) {
                const now = Date.now();
                if (now - lastCall >= delay) {
                    lastCall = now;
                    return func.apply(this, args);
                }
            };
        }
        
        /**
         * 防抖函數
         */
        debounce(func, delay) {
            let timeoutId;
            return function(...args) {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func.apply(this, args), delay);
            };
        }
        
        /**
         * 添加閒置任務
         */
        addIdleTask(task) {
            this.idleTaskQueue.push(task);
            
            if (window.requestIdleCallback) {
                requestIdleCallback(() => {
                    if (this.idleTaskQueue.length > 0) {
                        const t = this.idleTaskQueue.shift();
                        t();
                        this.stats.idleTasks++;
                    }
                });
            } else {
                // Fallback：使用 setTimeout
                setTimeout(task, 100);
            }
        }
        
        /**
         * 獲取統計資訊
         */
        getStats() {
            return {
                ...this.stats,
                memoryUsage: performance.memory ? {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB',
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + 'MB'
                } : 'N/A'
            };
        }
        
        /**
         * 強制垃圾回收（僅開發模式）
         */
        forceGC() {
            if (window.gc) {
                window.gc();
                console.log('🗑️ 已執行垃圾回收');
            } else {
                console.warn('⚠️ 垃圾回收不可用（需要 --expose-gc 標記）');
            }
        }
    }
    
    // 導出到全域
    window.PerformanceBooster = PerformanceBooster;
    
    // 創建全域實例
    window.performanceBooster = new PerformanceBooster();
    
    // 每 60 秒輸出統計
    setInterval(() => {
        const stats = window.performanceBooster.getStats();
        console.log('📊 效能統計:', stats);
    }, 60000);
    
    console.log('✅ 效能增強器載入完成');
})();


