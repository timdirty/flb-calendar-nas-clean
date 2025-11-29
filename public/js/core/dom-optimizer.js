// ============================================
// DOM 操作優化工具 - 老舊裝置優化版
// ============================================
// 版本：2024-10-26-PERFORMANCE-BOOST
// 減少重繪和回流，批量處理 DOM 操作

(function() {
    'use strict';
    
    console.log('🚀 DOM 優化工具初始化...');
    
    /**
     * 批量更新 DOM（使用 DocumentFragment）
     * @param {Element} container - 容器元素
     * @param {Array} elements - 要添加的元素陣列
     */
    function batchAppend(container, elements) {
        if (!container || !elements || elements.length === 0) return;
        
        const fragment = document.createDocumentFragment();
        elements.forEach(el => {
            if (el instanceof Element) {
                fragment.appendChild(el);
            }
        });
        
        container.appendChild(fragment);
    }
    
    /**
     * 批量更新樣式（一次性修改，減少回流）
     * @param {Element} element - 目標元素
     * @param {Object} styles - 樣式物件
     */
    function batchUpdateStyles(element, styles) {
        if (!element || !styles) return;
        
        const cssText = Object.entries(styles)
            .map(([key, value]) => {
                // 將 camelCase 轉為 kebab-case
                const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${cssKey}: ${value}`;
            })
            .join('; ');
        
        element.style.cssText += cssText;
    }
    
    /**
     * 使用 class 而非內嵌樣式（更高效）
     * @param {Element} element - 目標元素
     * @param {Array} classes - class 名稱陣列
     */
    function addClasses(element, classes) {
        if (!element || !classes) return;
        element.classList.add(...classes);
    }
    
    /**
     * 防抖函數（減少事件觸發頻率）
     * @param {Function} func - 要防抖的函數
     * @param {number} wait - 等待時間（毫秒）
     * @returns {Function} 防抖後的函數
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * 節流函數（限制執行頻率）
     * @param {Function} func - 要節流的函數
     * @param {number} limit - 時間間隔（毫秒）
     * @returns {Function} 節流後的函數
     */
    function throttle(func, limit = 100) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * 讀取階段批量處理（避免交錯讀寫造成回流）
     * @param {Array} readFuncs - 讀取操作陣列
     * @param {Array} writeFuncs - 寫入操作陣列
     */
    function batchReadWrite(readFuncs, writeFuncs) {
        // 先執行所有讀取操作
        const readResults = readFuncs.map(func => func());
        
        // 再執行所有寫入操作
        requestAnimationFrame(() => {
            writeFuncs.forEach((func, index) => {
                func(readResults[index]);
            });
        });
    }
    
    /**
     * 使用 CSS transform 代替 top/left（觸發合成而非重排）
     * @param {Element} element - 目標元素
     * @param {number} x - X 軸位移
     * @param {number} y - Y 軸位移
     */
    function fastTransform(element, x, y) {
        if (!element) return;
        element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        element.style.willChange = 'transform';
    }
    
    /**
     * 清除 will-change（避免過度使用）
     * @param {Element} element - 目標元素
     */
    function clearWillChange(element) {
        if (!element) return;
        setTimeout(() => {
            element.style.willChange = 'auto';
        }, 300);
    }
    
    /**
     * 延遲執行非關鍵任務（使用 requestIdleCallback）
     * @param {Function} callback - 要執行的回調
     * @param {Object} options - 選項
     */
    function runWhenIdle(callback, options = {}) {
        const { timeout = 2000 } = options;
        
        if ('requestIdleCallback' in window) {
            requestIdleCallback(callback, { timeout });
        } else {
            // 降級方案
            setTimeout(callback, 1);
        }
    }
    
    /**
     * 使用 IntersectionObserver 實現懶加載
     * @param {Element} element - 目標元素
     * @param {Function} callback - 可見時的回調
     * @param {Object} options - IntersectionObserver 選項
     */
    function observeVisibility(element, callback, options = {}) {
        if (!element || !('IntersectionObserver' in window)) {
            callback();
            return;
        }
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback();
                    observer.unobserve(element);
                }
            });
        }, {
            rootMargin: options.rootMargin || '50px',
            threshold: options.threshold || 0
        });
        
        observer.observe(element);
    }
    
    /**
     * 移除所有子元素（高效版本）
     * @param {Element} element - 目標元素
     */
    function removeAllChildren(element) {
        if (!element) return;
        
        // 使用 textContent 比 innerHTML 更快且更安全
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
    
    /**
     * 創建元素助手（減少冗長代碼）
     * @param {string} tag - 標籤名稱
     * @param {Object} options - 選項
     * @returns {Element} 創建的元素
     */
    function createElement(tag, options = {}) {
        const element = document.createElement(tag);
        
        if (options.className) {
            element.className = options.className;
        }
        
        if (options.id) {
            element.id = options.id;
        }
        
        if (options.text) {
            element.textContent = options.text;
        }
        
        if (options.html) {
            element.innerHTML = options.html;
        }
        
        if (options.attributes) {
            Object.entries(options.attributes).forEach(([key, value]) => {
                element.setAttribute(key, value);
            });
        }
        
        if (options.styles) {
            batchUpdateStyles(element, options.styles);
        }
        
        if (options.children) {
            options.children.forEach(child => {
                if (child instanceof Element) {
                    element.appendChild(child);
                }
            });
        }
        
        return element;
    }
    
    // 導出到全域
    window.DOMOptimizer = {
        batchAppend,
        batchUpdateStyles,
        addClasses,
        debounce,
        throttle,
        batchReadWrite,
        fastTransform,
        clearWillChange,
        runWhenIdle,
        observeVisibility,
        removeAllChildren,
        createElement
    };
    
    console.log('✅ DOM 優化工具就緒');
    
})();

