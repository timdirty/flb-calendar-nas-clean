// ============================================
// 智能動畫管理器 - 按需載入動畫
// ============================================
// 版本：2025-01-16-GPU-OPTIMIZATION
// 功能：只在元素可見時啟動動畫，大幅降低 GPU 負載

(function() {
    'use strict';
    
    console.log('🎬 智能動畫管理器載入中...');
    
    /**
     * 智能動畫管理器
     * 使用 Intersection Observer 監控元素可見性
     * 只在元素可見時才啟動動畫
     */
    class SmartAnimationManager {
        constructor() {
            this.observers = new Map();
            this.animatedElements = new WeakMap();
            this.config = {
                // 元素需要至少 10% 可見才啟動動畫
                threshold: 0.1,
                // 提前 50px 開始載入
                rootMargin: '50px'
            };
            
            // 統計資訊
            this.stats = {
                totalElements: 0,
                activeAnimations: 0,
                savedGPU: 0
            };
            
            this.init();
        }
        
        init() {
            // 創建主要的 Intersection Observer
            this.mainObserver = new IntersectionObserver(
                (entries) => this.handleIntersection(entries),
                this.config
            );
            
            console.log('✅ 智能動畫管理器初始化完成');
        }
        
        /**
         * 處理元素可見性變化
         */
        handleIntersection(entries) {
            entries.forEach(entry => {
                const element = entry.target;
                const animationClass = this.animatedElements.get(element);
                
                if (!animationClass) return;
                
                if (entry.isIntersecting) {
                    // 元素進入視窗，啟動動畫
                    this.enableAnimation(element, animationClass);
                } else {
                    // 元素離開視窗，停用動畫
                    this.disableAnimation(element, animationClass);
                }
            });
        }
        
        /**
         * 註冊需要智能管理的元素
         * @param {HTMLElement|string} elementOrSelector - 元素或選擇器
         * @param {string} animationClass - 動畫類別名稱
         */
        observe(elementOrSelector, animationClass) {
            let elements;
            
            if (typeof elementOrSelector === 'string') {
                elements = document.querySelectorAll(elementOrSelector);
            } else if (elementOrSelector instanceof HTMLElement) {
                elements = [elementOrSelector];
            } else if (elementOrSelector instanceof NodeList) {
                elements = elementOrSelector;
            } else {
                console.warn('⚠️ 無效的元素或選擇器:', elementOrSelector);
                return;
            }
            
            elements.forEach(element => {
                if (!element) return;
                
                // 記錄元素的動畫類別
                this.animatedElements.set(element, animationClass);
                
                // 開始觀察
                this.mainObserver.observe(element);
                
                this.stats.totalElements++;
            });
            
            console.log(`📊 已註冊 ${elements.length} 個元素使用智能動畫: ${animationClass}`);
        }
        
        /**
         * 停止觀察元素
         */
        unobserve(element) {
            this.mainObserver.unobserve(element);
            this.animatedElements.delete(element);
        }
        
        /**
         * 啟動元素動畫
         */
        enableAnimation(element, animationClass) {
            if (!element.classList.contains(animationClass)) {
                element.classList.add(animationClass);
                this.stats.activeAnimations++;
                
                // 添加自定義屬性標記
                element.setAttribute('data-animation-active', 'true');
            }
        }
        
        /**
         * 停用元素動畫
         */
        disableAnimation(element, animationClass) {
            if (element.classList.contains(animationClass)) {
                element.classList.remove(animationClass);
                this.stats.activeAnimations--;
                
                // 移除自定義屬性標記
                element.removeAttribute('data-animation-active');
                
                this.stats.savedGPU++;
            }
        }
        
        /**
         * 批量註冊常見動畫元素
         */
        registerCommonAnimations() {
            console.log('🎬 開始註冊智能動畫元素...');
            
            // 1. 背景動畫（只在首屏可見時啟動）
            const body = document.body;
            if (body) {
                // 首屏直接啟動背景動畫，提供完整體驗
                setTimeout(() => {
                    body.classList.add('animate-background');
                    console.log('✅ 背景動畫已啟動（首屏體驗）');
                }, 100);
            }
            
            // 2. 公告擺動動畫（按需載入）
            this.observeWhenReady('.announcement-note', 'animate-swing');
            
            // 3. 徽章脈衝動畫（按需載入）
            this.observeWhenReady('.today-badge', 'animate-pulse-badge');
            this.observeWhenReady('.sparkle-icon', 'animate-sparkle');
            
            // 4. 時間變更動畫（按需載入）
            this.observeWhenReady('.time-change-highlight', 'animate-time-change');
            this.observeWhenReady('.time-change-icon', 'animate-time-icon');
            
            // ⚠️ 充電動畫不使用按需載入（互動反饋，必須即時顯示）
            // this.observeWhenReady('.event-card.charging', 'animate-charging');
            
            // 5. 脈衝效果（按需載入）
            this.observeWhenReady('.pulse-effect', 'animate-pulse');
            this.observeWhenReady('.status-loading', 'animate-pulse');
            
            // 7. 發光效果（按需載入）
            this.observeWhenReady('.glow-effect', 'animate-glow');
            
            // 8. 定期檢查新增的動畫元素（處理動態生成的內容）
            this.startDynamicObserver();
            
            console.log('✅ 已註冊所有常見動畫元素');
        }
        
        /**
         * 當元素準備好時再觀察（處理動態生成的元素）
         */
        observeWhenReady(selector, animationClass, retryCount = 0) {
            const elements = document.querySelectorAll(selector);
            
            if (elements.length > 0) {
                this.observe(elements, animationClass);
            } else if (retryCount < 5) {
                // 元素可能還沒載入，稍後重試
                setTimeout(() => {
                    this.observeWhenReady(selector, animationClass, retryCount + 1);
                }, 500);
            }
        }
        
        /**
         * 啟動動態觀察器（處理 DOM 變化）
         */
        startDynamicObserver() {
            // 使用 MutationObserver 監控 DOM 變化
            this.mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            // 檢查新增的元素是否需要動畫
                            this.checkAndObserveNewElement(node);
                        }
                    });
                });
            });
            
            this.mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
            
            console.log('✅ 動態觀察器已啟動');
        }
        
        /**
         * 檢查並觀察新元素
         */
        checkAndObserveNewElement(element) {
            // 定義需要觀察的元素類型
            const watchList = [
                { selector: '.announcement-note', animation: 'animate-swing' },
                { selector: '.today-badge', animation: 'animate-pulse-badge' },
                { selector: '.sparkle-icon', animation: 'animate-sparkle' },
                { selector: '.time-change-highlight', animation: 'animate-time-change' },
                { selector: '.time-change-icon', animation: 'animate-time-icon' },
                // ⚠️ 充電動畫不使用按需載入（互動反饋，必須即時顯示）
                // { selector: '.event-card.charging', animation: 'animate-charging' },
                { selector: '.pulse-effect', animation: 'animate-pulse' },
                { selector: '.glow-effect', animation: 'animate-glow' }
            ];
            
            watchList.forEach(({ selector, animation }) => {
                if (element.matches && element.matches(selector)) {
                    this.observe(element, animation);
                } else if (element.querySelectorAll) {
                    const children = element.querySelectorAll(selector);
                    if (children.length > 0) {
                        this.observe(children, animation);
                    }
                }
            });
        }
        
        /**
         * 獲取統計資訊
         */
        getStats() {
            return {
                ...this.stats,
                efficiency: this.stats.totalElements > 0 
                    ? Math.round((this.stats.savedGPU / this.stats.totalElements) * 100) 
                    : 0
            };
        }
        
        /**
         * 銷毀管理器
         */
        destroy() {
            this.mainObserver.disconnect();
            this.observers.clear();
            this.animatedElements = new WeakMap();
            console.log('🗑️ 智能動畫管理器已銷毀');
        }
    }
    
    // 導出到全域
    window.SmartAnimationManager = SmartAnimationManager;
    
    // 創建全域實例
    window.smartAnimationManager = new SmartAnimationManager();
    
    // 頁面載入完成後註冊動畫
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                window.smartAnimationManager.registerCommonAnimations();
            }, 1000); // 延遲 1 秒，確保 DOM 完全載入
        });
    } else {
        setTimeout(() => {
            window.smartAnimationManager.registerCommonAnimations();
        }, 1000);
    }
    
    // 每 30 秒輸出統計
    setInterval(() => {
        const stats = window.smartAnimationManager.getStats();
        console.log(`📊 動畫管理統計: 總元素 ${stats.totalElements} | 活躍動畫 ${stats.activeAnimations} | 節省 GPU ${stats.savedGPU} 次 | 效率 ${stats.efficiency}%`);
    }, 30000);
    
    console.log('✅ 智能動畫管理器載入完成');
})();

