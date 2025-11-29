// ============================================
// 🔥 效能優化器、記憶體管理器、模組管理器
// ============================================
// 版本：2024-10-25-MODULAR

(function() {
    'use strict';
    
        // 性能優化工具
        const PerformanceOptimizer = {
            // 性能監控數據
            metrics: {
                api: {
                    requests: 0,
                    successes: 0,
                    failures: 0,
                    averageResponseTime: 0,
                    totalResponseTime: 0
                },
                attendance: {
                    loadAttempts: 0,
                    successfulLoads: 0,
                    failedLoads: 0,
                    averageLoadTime: 0,
                    totalLoadTime: 0
                },
                memory: {
                    start: (performance.memory && performance.memory.usedJSHeapSize) ? performance.memory.usedJSHeapSize : 0,
                    peak: 0,
                    current: 0
                }
            },
            
            // 記錄API請求
            recordApiRequest(success, responseTime) {
                this.metrics.api.requests++;
                this.metrics.api.totalResponseTime += responseTime;
                this.metrics.api.averageResponseTime = this.metrics.api.totalResponseTime / this.metrics.api.requests;
                
                if (success) {
                    this.metrics.api.successes++;
                } else {
                    this.metrics.api.failures++;
                }
            },
            
            // 記錄學生資料載入
            recordAttendanceLoad(success, loadTime) {
                this.metrics.attendance.loadAttempts++;
                this.metrics.attendance.totalLoadTime += loadTime;
                this.metrics.attendance.averageLoadTime = this.metrics.attendance.totalLoadTime / this.metrics.attendance.loadAttempts;
                
                if (success) {
                    this.metrics.attendance.successfulLoads++;
                } else {
                    this.metrics.attendance.failedLoads++;
                }
            },
            
            // 更新記憶體使用情況
            updateMemoryUsage() {
                try {
                    if (performance.memory && performance.memory.usedJSHeapSize) {
                        this.metrics.memory.current = performance.memory.usedJSHeapSize;
                        this.metrics.memory.peak = Math.max(this.metrics.memory.peak, this.metrics.memory.current);
                    }
                } catch (e) {
                    // 某些瀏覽器不支援 performance.memory
                }
            },
            
            // 獲取性能報告
            getPerformanceReport() {
                this.updateMemoryUsage();
                return {
                    api: {
                        ...this.metrics.api,
                        successRate: this.metrics.api.requests > 0 ? 
                            (this.metrics.api.successes / this.metrics.api.requests * 100).toFixed(2) + '%' : '0%'
                    },
                    attendance: {
                        ...this.metrics.attendance,
                        successRate: this.metrics.attendance.loadAttempts > 0 ? 
                            (this.metrics.attendance.successfulLoads / this.metrics.attendance.loadAttempts * 100).toFixed(2) + '%' : '0%'
                    },
                    memory: {
                        ...this.metrics.memory,
                        usageIncrease: this.metrics.memory.current - this.metrics.memory.start,
                        peakIncrease: this.metrics.memory.peak - this.metrics.memory.start
                    }
                };
            },
            
            // 延遲載入LIFF SDK
            loadLIFFSDK() {
                return new Promise((resolve, reject) => {
                    if (typeof liff !== 'undefined') {
                        console.log('✅ LIFF SDK已存在');
                        resolve();
                        return;
                    }
                    
                    const script = document.createElement('script');
                    script.charset = 'utf-8';
                    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
                    script.async = true;
                    script.defer = true;
                    script.onload = () => {
                        console.log('✅ LIFF SDK載入成功');
                        resolve();
                    };
                    script.onerror = () => {
                        console.error('❌ LIFF SDK載入失敗');
                        reject(new Error('LIFF SDK載入失敗'));
                    };
                    document.head.appendChild(script);
                });
            },
            
            // 預載入關鍵資源 - 優化版本
            preloadCriticalResources() {
                const criticalResources = [
                    { href: '/api/events', as: 'fetch', type: 'application/json', priority: 'high' },
                    { href: '/api/teachers', as: 'fetch', type: 'application/json', priority: 'high' },
                    { href: 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css', as: 'style', priority: 'low' }
                ];
                
                criticalResources.forEach(resource => {
                    const link = document.createElement('link');
                    link.rel = resource.priority === 'high' ? 'preload' : 'prefetch';
                    link.href = resource.href;
                    link.as = resource.as;
                    if (resource.type) link.type = resource.type;
                    if (resource.priority === 'high') {
                        link.crossOrigin = 'anonymous';
                    }
                    document.head.appendChild(link);
                });
                
                // 預載入關鍵圖片
                this.preloadCriticalImages();
            },
            
            // 預載入關鍵圖片
            preloadCriticalImages() {
                const criticalImages = [
                    'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMCA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDQgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjRkZGRkZGIi8+Cjwvc3ZnPgo='
                ];
                
                criticalImages.forEach(src => {
                    const img = new Image();
                    img.src = src;
                });
            },
            
            // 懶載入非關鍵功能
            lazyLoadNonCriticalFeatures() {
                // 使用 Intersection Observer 懶載入
                if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
                        entries.forEach(entry => {
                            if (entry.isIntersecting) {
                                const element = entry.target;
                                if (element.dataset.lazyLoad) {
                                    this.loadLazyContent(element);
                                    observer.unobserve(element);
                                }
                            }
                        });
                    });
                    
                    // 觀察所有需要懶載入的元素
                    document.querySelectorAll('[data-lazy-load]').forEach(el => {
                        observer.observe(el);
                    });
                }
            },
            
            // 載入懶載入內容
            loadLazyContent(element) {
                const loadType = element.dataset.lazyLoad;
                switch (loadType) {
                    case 'attendance-modal':
                        this.loadAttendanceModal();
                        break;
                    case 'teacher-options':
                        this.loadTeacherOptions();
                        break;
                    case 'time-filters':
                        this.loadTimeFilters();
                        break;
                    case 'event-cards':
                        this.loadEventCards();
                        break;
                    case 'floating-menu':
                        this.loadFloatingMenu();
                        break;
                    case 'notifications':
                        this.loadNotifications();
                        break;
                    case 'charts':
                        this.loadCharts();
                        break;
                case 'desktop-calendar':
                    this.loadDesktopCalendar();
                    break;
                }
            },
            
            // 載入簽到模態框
            loadAttendanceModal() {
                console.log('懶載入簽到模態框...');
                // 這裡可以載入簽到相關的額外功能
            },
            
            // 載入講師選項
            loadTeacherOptions() {
                console.log('懶載入講師選項...');
                // 這裡可以載入講師相關的額外功能
            },
            
            // 載入時間篩選
            loadTimeFilters() {
                console.log('懶載入時間篩選...');
                // 這裡可以載入時間篩選的額外功能
            },
            
            // 載入事件卡片
            loadEventCards() {
                console.log('懶載入事件卡片...');
                // 載入事件卡片的額外功能
                this.optimizeEventCards();
            },
            
            // 載入懸浮選單
            loadFloatingMenu() {
                console.log('懶載入懸浮選單...');
                // 載入懸浮選單的額外功能
                this.optimizeFloatingMenu();
            },
            
            // 載入通知系統
            loadNotifications() {
                console.log('懶載入通知系統...');
                // 載入通知系統的額外功能
                this.optimizeNotifications();
            },
            
            // 載入圖表
            loadCharts() {
                console.log('懶載入圖表...');
                // 載入圖表的額外功能
                this.optimizeCharts();
            },

        // 載入桌機日曆（已整合到 Special Events Manager）
        loadDesktopCalendar() {
            console.log('懶載入桌機日曆...');
            // Special Events Manager 的日曆視圖已經整合到主系統中
            // 不需要額外的初始化
            console.log('✅ Special Events Manager 日曆視圖已啟用');
        },
            
            // 優化事件卡片
            optimizeEventCards() {
                const eventCards = document.querySelectorAll('.event-card');
                eventCards.forEach(card => {
                    // 添加視覺優化
                    card.style.willChange = 'transform, opacity';
                    card.style.contain = 'layout style paint';
                });
            },
            
            // 優化懸浮選單
            optimizeFloatingMenu() {
                const floatingMenu = document.getElementById('floatingStatsMenu');
                if (floatingMenu) {
                    floatingMenu.style.willChange = 'transform, opacity';
                    floatingMenu.style.contain = 'layout style paint';
                }
            },
            
            // 優化通知系統
            optimizeNotifications() {
                const notifications = document.querySelectorAll('.toast, .countdown-toast');
                notifications.forEach(notification => {
                    notification.style.willChange = 'transform, opacity';
                    notification.style.contain = 'layout style paint';
                });
            },
            
            // 優化圖表
            optimizeCharts() {
                const charts = document.querySelectorAll('[class*="chart"], [class*="graph"]');
                charts.forEach(chart => {
                    chart.style.willChange = 'transform, opacity';
                    chart.style.contain = 'layout style paint';
                });
            },
            
            // 優化DOM操作
            batchDOMUpdates(updates) {
                requestAnimationFrame(() => {
                    updates.forEach(update => update());
                });
            },
            
            // 防抖函數 - 優化版本
            debounce(func, wait, immediate = false) {
                let timeout;
                return function executedFunction(...args) {
                    const later = () => {
                        timeout = null;
                        if (!immediate) func(...args);
                    };
                    const callNow = immediate && !timeout;
                    clearTimeout(timeout);
                    timeout = setTimeout(later, wait);
                    if (callNow) func(...args);
                };
            },
            
            // 節流函數 - 優化版本
            throttle(func, limit) {
                let inThrottle;
                return function() {
                    const args = arguments;
                    const context = this;
                    if (!inThrottle) {
                        func.apply(context, args);
                        inThrottle = true;
                        setTimeout(() => inThrottle = false, limit);
                    }
                };
            },
            
            // 新增：批量處理函數
            batchProcess(items, processor, batchSize = 10) {
                const results = [];
                for (let i = 0; i < items.length; i += batchSize) {
                    const batch = items.slice(i, i + batchSize);
                    results.push(...batch.map(processor));
                }
                return results;
            },
            
            // 新增：性能監控
            performanceMonitor: {
                metrics: new Map(),
                start(name) {
                    this.metrics.set(name, performance.now());
                },
                end(name) {
                    const startTime = this.metrics.get(name);
                    if (startTime) {
                        const duration = performance.now() - startTime;
                        console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
                        this.metrics.delete(name);
                        return duration;
                    }
                }
            }
        };
        
        // 記憶體管理器
        const MemoryManager = {
            cache: new Map(),
            maxCacheSize: 100,
            cleanup() {
                if (this.cache.size > this.maxCacheSize) {
                    const keys = Array.from(this.cache.keys());
                    const toDelete = keys.slice(0, keys.length - this.maxCacheSize);
                    toDelete.forEach(key => this.cache.delete(key));
                }
            },
            get(key) {
                return this.cache.get(key);
            },
            set(key, value) {
                this.cache.set(key, value);
                this.cleanup();
            },
            clear() {
                this.cache.clear();
            },
            // 清理過期的快取
            cleanupExpired() {
                const now = Date.now();
                for (const [key, value] of this.cache.entries()) {
                    if (value.expiry && now > value.expiry) {
                        this.cache.delete(key);
                    }
                }
            }
        };
        
        // 模組管理器
        const ModuleManager = {
            modules: new Map(),
            loaded: new Set(),
            
            // 註冊模組
            register(name, module) {
                this.modules.set(name, module);
            },
            
            // 載入模組
            async load(name) {
                if (this.loaded.has(name)) {
                    return this.modules.get(name);
                }
                
                const module = this.modules.get(name);
                if (!module) {
                    throw new Error(`模組 ${name} 未找到`);
                }
                
                if (module.init) {
                    await module.init();
                }
                
                this.loaded.add(name);
                return module;
            },
            
            // 載入多個模組
            async loadMultiple(names) {
                const promises = names.map(name => this.load(name));
                return Promise.all(promises);
            },
            
            // 清理模組
            cleanup(name) {
                const module = this.modules.get(name);
                if (module && module.cleanup) {
                    module.cleanup();
                }
                this.loaded.delete(name);
            }
        };
        
            // 暴露到全局
            window.PerformanceOptimizer = PerformanceOptimizer;
            window.MemoryManager = MemoryManager;
            window.ModuleManager = ModuleManager;
            
            // 添加測試Google Sheets API功能
            window.testGoogleSheetsAPI = function() {
                console.log('🧪 測試Google Sheets API...');
                
                const testPayload = {
                    action: "update",
                    name: "測試學生",
                    date: "2025-09-22",
                    present: true,
                    teacher: "測試講師",
                    course: "測試課程",
                    period: "測試時段"
                };
                
                const proxyUrl = '/api/proxy/google-sheets';
                
                fetch(proxyUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'updateAttendance',
                        googleSheetsUrl: "https://script.google.com/macros/s/AKfycbxfj5fwNIc8ncbqkOm763yo6o06wYPHm2nbfd_1yLkHlakoS9FtYfYJhvGCaiAYh_vjIQ/dev",
                        payload: testPayload
                    })
                })
                .then(response => {
                    console.log('📥 API回應狀態:', response.status);
                    return response.json();
                })
                .then(data => {
                    console.log('📥 API回應內容:', data);
                    showToast('🧪 Google Sheets API測試完成，請查看控制台', 'info', 3000);
                })
                .catch(error => {
                    console.error('❌ API測試失敗:', error);
                    showToast('❌ Google Sheets API測試失敗', 'error', 3000);
                });
            };

    // 標記模組已載入
    if (window.LOAD_PROGRESS) {
        window.LOAD_PROGRESS.updateProgress('Performance');
    }
    console.error('✅ Performance Optimizer, Memory Manager, Module Manager 已載入');
    
})();
