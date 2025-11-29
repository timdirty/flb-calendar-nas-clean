// ============================================
// 虛擬滾動組件 - 老舊裝置優化版
// ============================================
// 版本：2024-10-26-PERFORMANCE-BOOST
// 只渲染可見區域的項目，大幅減少 DOM 節點數量

(function() {
    'use strict';
    
    console.log('🚀 虛擬滾動組件初始化...');
    
    class VirtualScroller {
        constructor(options) {
            this.container = options.container;
            this.items = options.items || [];
            this.renderItem = options.renderItem;
            this.itemHeight = options.itemHeight || 150; // 預設項目高度
            this.bufferSize = options.bufferSize || 3; // 上下緩衝區項目數量
            
            this.scrollTop = 0;
            this.viewportHeight = 0;
            this.totalHeight = 0;
            
            this.init();
        }
        
        init() {
            if (!this.container) {
                console.error('❌ 虛擬滾動容器不存在');
                return;
            }
            
            // 設置容器樣式
            this.container.style.position = 'relative';
            this.container.style.overflow = 'auto';
            
            // 創建內容容器
            this.contentContainer = document.createElement('div');
            this.contentContainer.style.position = 'relative';
            this.container.appendChild(this.contentContainer);
            
            // 綁定滾動事件（使用 passive 提升效能）
            this.container.addEventListener('scroll', this.handleScroll.bind(this), { passive: true });
            
            // 監聽視窗大小變化
            this.resizeObserver = new ResizeObserver(() => this.update());
            this.resizeObserver.observe(this.container);
            
            this.update();
        }
        
        handleScroll() {
            this.scrollTop = this.container.scrollTop;
            
            // 使用 requestAnimationFrame 優化滾動效能
            if (!this.rafId) {
                this.rafId = requestAnimationFrame(() => {
                    this.render();
                    this.rafId = null;
                });
            }
        }
        
        update() {
            this.viewportHeight = this.container.clientHeight;
            this.totalHeight = this.items.length * this.itemHeight;
            this.contentContainer.style.height = this.totalHeight + 'px';
            this.render();
        }
        
        render() {
            const startIndex = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.bufferSize);
            const endIndex = Math.min(
                this.items.length,
                Math.ceil((this.scrollTop + this.viewportHeight) / this.itemHeight) + this.bufferSize
            );
            
            // 清空現有內容（使用 DocumentFragment 優化效能）
            const fragment = document.createDocumentFragment();
            
            // 只渲染可見範圍的項目
            for (let i = startIndex; i < endIndex; i++) {
                const item = this.items[i];
                const itemElement = this.renderItem(item, i);
                
                // 設置項目位置
                if (itemElement) {
                    itemElement.style.position = 'absolute';
                    itemElement.style.top = (i * this.itemHeight) + 'px';
                    itemElement.style.width = '100%';
                    fragment.appendChild(itemElement);
                }
            }
            
            // 一次性更新 DOM
            this.contentContainer.innerHTML = '';
            this.contentContainer.appendChild(fragment);
            
            console.log(`📊 虛擬滾動渲染: ${startIndex}-${endIndex} / ${this.items.length}`);
        }
        
        setItems(items) {
            this.items = items;
            this.update();
        }
        
        destroy() {
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
            if (this.rafId) {
                cancelAnimationFrame(this.rafId);
            }
        }
    }
    
    // 導出到全域
    window.VirtualScroller = VirtualScroller;
    
    console.log('✅ 虛擬滾動組件就緒');
    
})();

