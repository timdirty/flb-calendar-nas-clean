/**
 * 學習歷程上傳系統 - 效能監控系統
 * 追蹤 Web Vitals、上傳效能、錯誤、用戶行為
 */

(function (global) {
    'use strict';

    // ============================================
    // 效能監控器
    // ============================================
    class PerformanceMonitor {
        constructor() {
            this.metrics = {
                webVitals: {},
                uploads: [],
                errors: [],
                userActions: [],
                resources: [],
                customMetrics: {}
            };

            this.config = {
                enabled: true,
                sampleRate: 1.0, // 100% 取樣
                maxMetrics: 1000,
                reportInterval: 60000, // 60秒
                endpoint: '/api/performance-metrics' // 效能數據上傳端點
            };

            this.sessionId = this.generateSessionId();
            this.pageLoadTime = Date.now();
            
            this.init();
        }

        /**
         * 初始化監控
         */
        init() {
            if (!this.config.enabled) {
                console.log('⚠️ [效能監控] 已禁用');
                return;
            }

            // 監控 Web Vitals
            this.monitorWebVitals();

            // 監控資源載入
            this.monitorResourceLoading();

            // 監控錯誤
            this.monitorErrors();

            // 監控用戶行為
            this.monitorUserActions();

            // 監控記憶體
            this.monitorMemory();

            // 定期報告
            this.startPeriodicReporting();

            // 頁面卸載時最終報告
            this.setupUnloadReporting();

            console.log('✅ [效能監控] 已初始化 (Session:', this.sessionId.substring(0, 8) + ')');
        }

        /**
         * 生成 Session ID
         */
        generateSessionId() {
            return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }

        /**
         * 監控 Web Vitals
         */
        monitorWebVitals() {
            // LCP (Largest Contentful Paint)
            this.observeLCP();

            // FID (First Input Delay)
            this.observeFID();

            // CLS (Cumulative Layout Shift)
            this.observeCLS();

            // FCP (First Contentful Paint)
            this.observeFCP();

            // TTFB (Time to First Byte)
            this.observeTTFB();
        }

        /**
         * 觀察 LCP
         */
        observeLCP() {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    
                    this.metrics.webVitals.lcp = {
                        value: lastEntry.renderTime || lastEntry.loadTime,
                        rating: this.getRating('lcp', lastEntry.renderTime || lastEntry.loadTime),
                        timestamp: Date.now()
                    };
                    
                    console.log('📊 [Web Vitals] LCP:', this.metrics.webVitals.lcp.value.toFixed(2), 'ms');
                });
                
                observer.observe({ type: 'largest-contentful-paint', buffered: true });
            } catch (error) {
                console.warn('⚠️ [效能監控] LCP 不支援');
            }
        }

        /**
         * 觀察 FID
         */
        observeFID() {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        this.metrics.webVitals.fid = {
                            value: entry.processingStart - entry.startTime,
                            rating: this.getRating('fid', entry.processingStart - entry.startTime),
                            timestamp: Date.now()
                        };
                        
                        console.log('📊 [Web Vitals] FID:', this.metrics.webVitals.fid.value.toFixed(2), 'ms');
                    });
                });
                
                observer.observe({ type: 'first-input', buffered: true });
            } catch (error) {
                console.warn('⚠️ [效能監控] FID 不支援');
            }
        }

        /**
         * 觀察 CLS
         */
        observeCLS() {
            try {
                let clsValue = 0;
                
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    
                    entries.forEach((entry) => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    });
                    
                    this.metrics.webVitals.cls = {
                        value: clsValue,
                        rating: this.getRating('cls', clsValue),
                        timestamp: Date.now()
                    };
                });
                
                observer.observe({ type: 'layout-shift', buffered: true });
            } catch (error) {
                console.warn('⚠️ [效能監控] CLS 不支援');
            }
        }

        /**
         * 觀察 FCP
         */
        observeFCP() {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        if (entry.name === 'first-contentful-paint') {
                            this.metrics.webVitals.fcp = {
                                value: entry.startTime,
                                rating: this.getRating('fcp', entry.startTime),
                                timestamp: Date.now()
                            };
                            
                            console.log('📊 [Web Vitals] FCP:', this.metrics.webVitals.fcp.value.toFixed(2), 'ms');
                        }
                    });
                });
                
                observer.observe({ type: 'paint', buffered: true });
            } catch (error) {
                console.warn('⚠️ [效能監控] FCP 不支援');
            }
        }

        /**
         * 觀察 TTFB
         */
        observeTTFB() {
            try {
                const navTiming = performance.getEntriesByType('navigation')[0];
                if (navTiming) {
                    const ttfb = navTiming.responseStart - navTiming.requestStart;
                    
                    this.metrics.webVitals.ttfb = {
                        value: ttfb,
                        rating: this.getRating('ttfb', ttfb),
                        timestamp: Date.now()
                    };
                    
                    console.log('📊 [Web Vitals] TTFB:', this.metrics.webVitals.ttfb.value.toFixed(2), 'ms');
                }
            } catch (error) {
                console.warn('⚠️ [效能監控] TTFB 不支援');
            }
        }

        /**
         * 取得評級
         */
        getRating(metric, value) {
            const thresholds = {
                lcp: { good: 2500, needsImprovement: 4000 },
                fid: { good: 100, needsImprovement: 300 },
                cls: { good: 0.1, needsImprovement: 0.25 },
                fcp: { good: 1800, needsImprovement: 3000 },
                ttfb: { good: 800, needsImprovement: 1800 }
            };

            const threshold = thresholds[metric];
            if (!threshold) return 'unknown';

            if (value <= threshold.good) return 'good';
            if (value <= threshold.needsImprovement) return 'needs-improvement';
            return 'poor';
        }

        /**
         * 監控資源載入
         */
        monitorResourceLoading() {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    
                    entries.forEach((entry) => {
                        if (entry.initiatorType === 'script' || 
                            entry.initiatorType === 'img' || 
                            entry.initiatorType === 'video') {
                            
                            this.metrics.resources.push({
                                name: entry.name,
                                type: entry.initiatorType,
                                duration: entry.duration,
                                size: entry.transferSize || 0,
                                timestamp: Date.now()
                            });

                            // 限制數量
                            if (this.metrics.resources.length > this.config.maxMetrics) {
                                this.metrics.resources.shift();
                            }
                        }
                    });
                });
                
                observer.observe({ type: 'resource', buffered: true });
            } catch (error) {
                console.warn('⚠️ [效能監控] 資源監控不支援');
            }
        }

        /**
         * 監控錯誤
         */
        monitorErrors() {
            // JavaScript 錯誤
            window.addEventListener('error', (event) => {
                this.recordError({
                    type: 'javascript',
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno,
                    stack: event.error?.stack,
                    timestamp: Date.now()
                });
            });

            // Promise 拒絕
            window.addEventListener('unhandledrejection', (event) => {
                this.recordError({
                    type: 'promise',
                    message: event.reason?.message || 'Promise rejected',
                    stack: event.reason?.stack,
                    timestamp: Date.now()
                });
            });
        }

        /**
         * 記錄錯誤
         */
        recordError(error) {
            this.metrics.errors.push(error);
            
            // 限制數量
            if (this.metrics.errors.length > this.config.maxMetrics) {
                this.metrics.errors.shift();
            }

            console.error('📊 [錯誤監控]', error);
        }

        /**
         * 監控用戶行為
         */
        monitorUserActions() {
            // 點擊事件
            document.addEventListener('click', (event) => {
                const target = event.target;
                if (target.tagName === 'BUTTON' || target.closest('button')) {
                    this.recordUserAction({
                        type: 'click',
                        target: target.textContent || target.value || 'button',
                        timestamp: Date.now()
                    });
                }
            }, { capture: true });

            // 表單提交
            document.addEventListener('submit', (event) => {
                this.recordUserAction({
                    type: 'submit',
                    target: event.target.id || 'form',
                    timestamp: Date.now()
                });
            }, { capture: true });
        }

        /**
         * 記錄用戶行為
         */
        recordUserAction(action) {
            this.metrics.userActions.push(action);
            
            // 限制數量
            if (this.metrics.userActions.length > this.config.maxMetrics) {
                this.metrics.userActions.shift();
            }
        }

        /**
         * 監控記憶體
         */
        monitorMemory() {
            if (!performance.memory) return;

            setInterval(() => {
                this.metrics.customMetrics.memory = {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
                    usageRatio: (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(2),
                    timestamp: Date.now()
                };
            }, 30000); // 每 30 秒
        }

        /**
         * 追蹤上傳效能
         */
        trackUpload(uploadData) {
            this.metrics.uploads.push({
                ...uploadData,
                timestamp: Date.now()
            });

            // 限制數量
            if (this.metrics.uploads.length > this.config.maxMetrics) {
                this.metrics.uploads.shift();
            }

            console.log('📊 [上傳監控]', uploadData);
        }

        /**
         * 追蹤自訂指標
         */
        trackCustomMetric(name, value, metadata = {}) {
            this.metrics.customMetrics[name] = {
                value,
                metadata,
                timestamp: Date.now()
            };

            console.log(`📊 [自訂指標] ${name}:`, value);
        }

        /**
         * 取得效能報告
         */
        getReport() {
            return {
                sessionId: this.sessionId,
                pageLoadTime: this.pageLoadTime,
                duration: Date.now() - this.pageLoadTime,
                url: window.location.href,
                userAgent: navigator.userAgent,
                deviceInfo: this.getDeviceInfo(),
                metrics: {
                    webVitals: this.metrics.webVitals,
                    uploads: this.metrics.uploads,
                    errors: this.metrics.errors.length,
                    userActions: this.metrics.userActions.length,
                    resources: {
                        total: this.metrics.resources.length,
                        avgDuration: this.calculateAvgResourceDuration()
                    },
                    customMetrics: this.metrics.customMetrics
                }
            };
        }

        /**
         * 取得裝置資訊
         */
        getDeviceInfo() {
            return {
                screen: {
                    width: window.screen.width,
                    height: window.screen.height
                },
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                },
                devicePixelRatio: window.devicePixelRatio,
                hardwareConcurrency: navigator.hardwareConcurrency,
                deviceMemory: navigator.deviceMemory,
                connection: navigator.connection ? {
                    effectiveType: navigator.connection.effectiveType,
                    downlink: navigator.connection.downlink,
                    rtt: navigator.connection.rtt
                } : null
            };
        }

        /**
         * 計算平均資源載入時間
         */
        calculateAvgResourceDuration() {
            if (this.metrics.resources.length === 0) return 0;
            
            const total = this.metrics.resources.reduce((sum, r) => sum + r.duration, 0);
            return (total / this.metrics.resources.length).toFixed(2);
        }

        /**
         * 定期報告
         */
        startPeriodicReporting() {
            setInterval(() => {
                this.sendReport();
            }, this.config.reportInterval);
        }

        /**
         * 設置卸載報告
         */
        setupUnloadReporting() {
            window.addEventListener('beforeunload', () => {
                this.sendReport(true);
            });
        }

        /**
         * 發送報告
         */
        sendReport(isUnload = false) {
            const report = this.getReport();
            
            // 取樣控制
            if (Math.random() > this.config.sampleRate) {
                return;
            }

            try {
                if (isUnload && navigator.sendBeacon) {
                    // 使用 sendBeacon 在頁面卸載時發送
                    navigator.sendBeacon(
                        this.config.endpoint,
                        JSON.stringify(report)
                    );
                } else {
                    // 使用 fetch
                    fetch(this.config.endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(report),
                        keepalive: true
                    }).catch(error => {
                        console.warn('⚠️ [效能監控] 報告發送失敗:', error);
                    });
                }

                console.log('📊 [效能監控] 報告已發送', isUnload ? '(卸載)' : '(定期)');
            } catch (error) {
                console.error('❌ [效能監控] 報告發送錯誤:', error);
            }
        }

        /**
         * 取得完整數據（用於除錯）
         */
        getFullMetrics() {
            return this.metrics;
        }

        /**
         * 清除數據
         */
        clearMetrics() {
            this.metrics = {
                webVitals: {},
                uploads: [],
                errors: [],
                userActions: [],
                resources: [],
                customMetrics: {}
            };
            
            console.log('🧹 [效能監控] 數據已清除');
        }

        /**
         * 啟用/禁用監控
         */
        setEnabled(enabled) {
            this.config.enabled = enabled;
            console.log(`${enabled ? '✅' : '❌'} [效能監控] ${enabled ? '已啟用' : '已禁用'}`);
        }
    }

    // ============================================
    // 導出
    // ============================================
    const performanceMonitor = new PerformanceMonitor();

    global.PerformanceMonitor = performanceMonitor;

    // 便捷函數
    global.trackUploadPerformance = function(uploadData) {
        return performanceMonitor.trackUpload(uploadData);
    };

    global.trackCustomMetric = function(name, value, metadata) {
        return performanceMonitor.trackCustomMetric(name, value, metadata);
    };

    global.getPerformanceReport = function() {
        return performanceMonitor.getReport();
    };

})(window);


