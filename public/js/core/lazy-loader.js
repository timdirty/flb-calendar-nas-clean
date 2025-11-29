// ============================================
// 懶加載管理器 - 老舊裝置優化版
// ============================================
// 版本：2024-10-26-PERFORMANCE-BOOST
// 用於按需載入模組，減少初始載入時間

(function() {
    'use strict';
    
    console.log('🚀 懶加載管理器初始化...');
    
    // 模組載入狀態追蹤
    const loadedModules = new Map();
    const loadingPromises = new Map();
    
    /**
     * 懶加載 JavaScript 模組
     * @param {string} moduleName - 模組名稱
     * @param {string} modulePath - 模組路徑
     * @returns {Promise} 載入完成的 Promise
     */
    function loadModule(moduleName, modulePath) {
        // 如果已經載入，直接返回
        if (loadedModules.has(moduleName)) {
            return Promise.resolve(loadedModules.get(moduleName));
        }
        
        // 如果正在載入，返回現有的 Promise
        if (loadingPromises.has(moduleName)) {
            return loadingPromises.get(moduleName);
        }
        
        // 開始載入模組
        const loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = modulePath + '?v=' + (window.APP_VERSION || Date.now());
            script.async = true;
            
            script.onload = () => {
                console.log(`✅ 模組載入成功: ${moduleName}`);
                loadedModules.set(moduleName, true);
                loadingPromises.delete(moduleName);
                resolve();
            };
            
            script.onerror = () => {
                console.error(`❌ 模組載入失敗: ${moduleName}`);
                loadingPromises.delete(moduleName);
                reject(new Error(`Failed to load module: ${moduleName}`));
            };
            
            document.head.appendChild(script);
        });
        
        loadingPromises.set(moduleName, loadPromise);
        return loadPromise;
    }
    
    /**
     * 批量載入多個模組
     * @param {Array} modules - 模組配置陣列 [{name, path}]
     * @returns {Promise} 所有模組載入完成的 Promise
     */
    function loadModules(modules) {
        const promises = modules.map(module => 
            loadModule(module.name, module.path)
        );
        return Promise.all(promises);
    }
    
    /**
     * 使用 IntersectionObserver 實現可見時載入
     * @param {Element} element - 目標元素
     * @param {Function} callback - 載入回調
     */
    function loadOnVisible(element, callback) {
        if (!element) return;
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    callback();
                    observer.unobserve(element);
                }
            });
        }, {
            rootMargin: '50px' // 提前50px開始載入
        });
        
        observer.observe(element);
    }
    
    /**
     * 使用 requestIdleCallback 在瀏覽器空閒時載入
     * @param {Function} callback - 載入回調
     */
    function loadOnIdle(callback) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(callback, { timeout: 2000 });
        } else {
            // 降級方案：使用 setTimeout
            setTimeout(callback, 1);
        }
    }
    
    // 導出到全域
    window.LazyLoader = {
        loadModule,
        loadModules,
        loadOnVisible,
        loadOnIdle,
        isLoaded: (moduleName) => loadedModules.has(moduleName)
    };
    
    console.log('✅ 懶加載管理器就緒');
    
})();

