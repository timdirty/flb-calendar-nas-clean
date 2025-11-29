// ============================================
// 效能監控工具 - 老舊裝置優化版
// ============================================
// 版本：2024-10-26-PERFORMANCE-BOOST
// 追蹤和報告效能指標

(function() {
    'use strict';
    
    console.log('🚀 效能監控工具初始化...');
    
    // 效能指標收集器
    const metrics = {
        pageLoadStart: performance.now(),
        firstPaint: null,
        firstContentfulPaint: null,
        domInteractive: null,
        domComplete: null,
        loadComplete: null,
        jsHeapSize: null,
        longTasks: []
    };
    
    /**
     * 收集核心網頁指標
     */
    function collectCoreWebVitals() {
        // 使用 PerformanceObserver 收集 FCP
        if ('PerformanceObserver' in window) {
            try {
                // First Contentful Paint
                const fcpObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.name === 'first-contentful-paint') {
                            metrics.firstContentfulPaint = entry.startTime;
                            console.log(`⚡ FCP: ${entry.startTime.toFixed(2)}ms`);
                        }
                    }
                });
                fcpObserver.observe({ entryTypes: ['paint'] });
                
                // Largest Contentful Paint
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    console.log(`⚡ LCP: ${lastEntry.startTime.toFixed(2)}ms`);
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
                
                // First Input Delay (使用 first-input 替代)
                const fidObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        const delay = entry.processingStart - entry.startTime;
                        console.log(`⚡ FID: ${delay.toFixed(2)}ms`);
                    }
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
                
                // Long Tasks (效能瓶頸檢測)
                const longTaskObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        metrics.longTasks.push({
                            duration: entry.duration,
                            startTime: entry.startTime
                        });
                        console.warn(`⚠️ 長任務檢測: ${entry.duration.toFixed(2)}ms`);
                    }
                });
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                
            } catch (error) {
                console.warn('⚠️ PerformanceObserver 不支援:', error);
            }
        }
        
        // 收集導航時機
        window.addEventListener('load', () => {
            setTimeout(() => {
                const navTiming = performance.getEntriesByType('navigation')[0];
                if (navTiming) {
                    metrics.domInteractive = navTiming.domInteractive;
                    metrics.domComplete = navTiming.domComplete;
                    metrics.loadComplete = navTiming.loadEventEnd;
                    
                    console.log('📊 頁面載入時機:');
                    console.log(`  - DOM 互動: ${navTiming.domInteractive.toFixed(2)}ms`);
                    console.log(`  - DOM 完成: ${navTiming.domComplete.toFixed(2)}ms`);
                    console.log(`  - 載入完成: ${navTiming.loadEventEnd.toFixed(2)}ms`);
                }
            }, 0);
        });
    }
    
    /**
     * 收集記憶體使用資訊
     */
    function collectMemoryInfo() {
        if (performance.memory) {
            metrics.jsHeapSize = {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
            
            const usedMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
            const totalMB = (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2);
            
            console.log(`💾 記憶體使用: ${usedMB}MB / ${totalMB}MB`);
            
            // 警告：記憶體使用過高
            if (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit > 0.9) {
                console.warn('⚠️ 記憶體使用接近上限！');
            }
        }
    }
    
    /**
     * 追蹤自定義指標
     */
    function markTime(name) {
        if ('performance' in window && performance.mark) {
            performance.mark(name);
            console.log(`⏱️ 標記: ${name}`);
        }
    }
    
    /**
     * 測量兩個標記之間的時間
     */
    function measureTime(name, startMark, endMark) {
        if ('performance' in window && performance.measure) {
            try {
                performance.measure(name, startMark, endMark);
                const measure = performance.getEntriesByName(name)[0];
                console.log(`⏱️ ${name}: ${measure.duration.toFixed(2)}ms`);
                return measure.duration;
            } catch (error) {
                console.warn(`⚠️ 無法測量 ${name}:`, error);
            }
        }
        return 0;
    }
    
    /**
     * 獲取資源載入統計
     */
    function getResourceStats() {
        const resources = performance.getEntriesByType('resource');
        
        const stats = {
            total: resources.length,
            scripts: resources.filter(r => r.initiatorType === 'script').length,
            styles: resources.filter(r => r.initiatorType === 'link' || r.initiatorType === 'css').length,
            images: resources.filter(r => r.initiatorType === 'img').length,
            totalSize: 0,
            totalDuration: 0
        };
        
        resources.forEach(resource => {
            stats.totalSize += resource.transferSize || 0;
            stats.totalDuration += resource.duration;
        });
        
        stats.totalSizeKB = (stats.totalSize / 1024).toFixed(2);
        stats.avgDuration = (stats.totalDuration / stats.total).toFixed(2);
        
        console.log('📦 資源載入統計:');
        console.log(`  - 總資源: ${stats.total}`);
        console.log(`  - 腳本: ${stats.scripts}`);
        console.log(`  - 樣式: ${stats.styles}`);
        console.log(`  - 圖片: ${stats.images}`);
        console.log(`  - 總大小: ${stats.totalSizeKB}KB`);
        console.log(`  - 平均載入時間: ${stats.avgDuration}ms`);
        
        return stats;
    }
    
    /**
     * 生成效能報告
     */
    function generateReport() {
        console.log('📊 ========== 效能報告 ==========');
        
        collectMemoryInfo();
        const resourceStats = getResourceStats();
        
        console.log('\n核心指標:');
        if (metrics.firstContentfulPaint) {
            console.log(`  ✅ FCP: ${metrics.firstContentfulPaint.toFixed(2)}ms`);
        }
        
        if (metrics.longTasks.length > 0) {
            console.log(`\n⚠️ 檢測到 ${metrics.longTasks.length} 個長任務`);
            metrics.longTasks.forEach((task, i) => {
                console.log(`  ${i + 1}. ${task.duration.toFixed(2)}ms @ ${task.startTime.toFixed(2)}ms`);
            });
        }
        
        console.log('\n優化建議:');
        
        if (resourceStats.scripts > 10) {
            console.log('  ⚠️ 腳本文件過多，考慮合併或延遲載入');
        }
        
        if (resourceStats.totalSize > 1024 * 1024) { // > 1MB
            console.log('  ⚠️ 總資源大小過大，考慮壓縮或分割');
        }
        
        if (metrics.longTasks.length > 5) {
            console.log('  ⚠️ 長任務過多，考慮代碼分割或 Web Worker');
        }
        
        console.log('================================\n');
        
        return {
            metrics,
            resourceStats
        };
    }
    
    /**
     * 監控 FPS（幀率）
     */
    function monitorFPS(duration = 1000) {
        let frameCount = 0;
        let lastTime = performance.now();
        
        function countFrame() {
            frameCount++;
            const currentTime = performance.now();
            
            if (currentTime >= lastTime + duration) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                console.log(`🎬 FPS: ${fps}`);
                
                if (fps < 30) {
                    console.warn('⚠️ 幀率過低！考慮優化動畫和渲染');
                }
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            requestAnimationFrame(countFrame);
        }
        
        requestAnimationFrame(countFrame);
    }
    
    // 自動收集指標
    collectCoreWebVitals();
    
    // 頁面載入完成後生成報告
    window.addEventListener('load', () => {
        setTimeout(() => {
            generateReport();
            
            // 開始監控 FPS（可選）
            // monitorFPS();
        }, 1000);
    });
    
    // 導出到全域
    window.PerformanceMonitor = {
        markTime,
        measureTime,
        getResourceStats,
        generateReport,
        monitorFPS,
        metrics
    };
    
    console.log('✅ 效能監控工具就緒');
    
})();

