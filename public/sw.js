// ============================================
// Service Worker - 老舊裝置優化版
// ============================================
// 版本：2025-11-01-CACHE-FIX
// 提供離線支持和智能快取策略
// 🔥 修復：增強 cache.put() 錯誤處理，避免 NetworkError

const CACHE_VERSION = 'flb-calendar-v2025-11-01-fix2';
const CACHE_STATIC = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;
const CACHE_API = `${CACHE_VERSION}-api`;

// 需要預快取的靜態資源
const STATIC_ASSETS = [
    '/',
    '/perfect-calendar-modular.html',
    '/css/styles.css',
    '/js/core/config.js',
    '/js/core/error-handler.js',
    '/js/core/lazy-loader.js',
    '/js/core/performance-optimizer.js',
    '/js/core/virtual-scroller.js',
    '/js/modules/course-student-matcher.js',
    '/js/modules/student-filter.js',
    '/js/pages/learning-record-upload.js',
    '/js/modules/url-utils.js',
    '/js/modules/id-utils.js',
    '/js/modules/course-utils.js',
    '/js/modules/api-client.js',
    '/js/modules/ui/toast.js',
    '/logo.jpg'
];

// 動態快取的最大數量
const MAX_DYNAMIC_CACHE = 50;
const MAX_API_CACHE = 20;

// 安裝 Service Worker
self.addEventListener('install', (event) => {
    console.log('[SW] 安裝中...');
    
    event.waitUntil(
        caches.open(CACHE_STATIC)
            .then(cache => {
                console.log('[SW] 預快取靜態資源');
                return cache.addAll(STATIC_ASSETS);
            })
            .catch(err => {
                console.warn('[SW] 預快取失敗:', err);
            })
    );
    
    // 強制跳過等待，立即激活
    self.skipWaiting();
});

// 激活 Service Worker
self.addEventListener('activate', (event) => {
    console.log('[SW] 激活中...');
    
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name.startsWith('flb-calendar-') && name !== CACHE_VERSION)
                        .map(name => {
                            console.log('[SW] 清除舊快取:', name);
                            return caches.delete(name);
                        })
                );
            })
    );
    
    // 立即控制所有頁面
    return self.clients.claim();
});

// 攔截請求
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // 跳過非 GET 請求
    if (request.method !== 'GET') {
        return;
    }
    
    // 跨網域資源直接經 fetch
    if (url.origin !== self.location.origin) {
        event.respondWith(fetch(request));
        return;
    }

    // API 請求：網路優先，失敗時使用快取
    if (url.pathname.includes('/api/')) {
        // 🚫 指定 API 永不快取（即時性要求）：by-course、file、0(刪除/更新索引)
        const nonCacheable = (
            url.pathname.includes('/api/learning-records/by-course') ||
            url.pathname.includes('/api/learning-records/file') ||
            url.pathname.match(/\/api\/learning-records\/(0|upload)/)
        );
        if (nonCacheable) {
            event.respondWith(fetch(request));
            return;
        }
        event.respondWith(networkFirstStrategy(request, CACHE_API));
        return;
    }
    
    // 靜態資源：快取優先，失敗時使用網路
    if (isStaticAsset(url)) {
        event.respondWith(cacheFirstStrategy(request, CACHE_STATIC));
        return;
    }
    
    // 動態內容：網路優先，失敗時使用快取
    event.respondWith(networkFirstStrategy(request, CACHE_DYNAMIC));
});

/**
 * 快取優先策略（適用於靜態資源）
 */
async function cacheFirstStrategy(request, cacheName) {
    try {
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            // 背景更新快取
            updateCacheInBackground(request, cache);
            return cachedResponse;
        }
        
        const networkResponse = await fetch(request);
        
        // 🔥 修復：更嚴格的響應檢查，避免快取 opaque 響應導致錯誤
        if (networkResponse && 
            networkResponse.ok && 
            networkResponse.status === 200 &&
            networkResponse.type !== 'error' && 
            networkResponse.type !== 'opaque' &&
            request.url.startsWith(self.location.origin)) {
            try {
                const responseToCache = networkResponse.clone();
                cache.put(request, responseToCache).catch(err => {
                    console.warn('[SW] 快取寫入失敗（靜默忽略）:', err.message);
                });
            } catch (cacheError) {
                console.warn('[SW] 快取克隆失敗（靜默忽略）:', cacheError.message);
            }
        }
        
        return networkResponse;
        
    } catch (error) {
        console.error('[SW] 快取優先策略失敗:', error);
        
        // 返回離線頁面或預設響應
        return new Response('離線模式', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * 網路優先策略（適用於 API 和動態內容）
 */
async function networkFirstStrategy(request, cacheName) {
    try {
        const networkResponse = await fetch(request);
        
        // 🔥 修復：更嚴格的響應檢查，避免快取 opaque 響應導致錯誤
        if (networkResponse && 
            networkResponse.ok && 
            networkResponse.status === 200 &&
            networkResponse.type !== 'error' && 
            networkResponse.type !== 'opaque' &&
            request.url.startsWith(self.location.origin)) {
            const cache = await caches.open(cacheName);
            
            // 限制快取大小
            limitCacheSize(cacheName, cacheName === CACHE_API ? MAX_API_CACHE : MAX_DYNAMIC_CACHE);
            
            try {
                const responseToCache = networkResponse.clone();
                cache.put(request, responseToCache).catch(err => {
                    console.warn('[SW] 快取寫入失敗（靜默忽略）:', err.message);
                });
            } catch (cacheError) {
                console.warn('[SW] 快取克隆失敗（靜默忽略）:', cacheError.message);
            }
        }
        
        return networkResponse;
        
    } catch (error) {
        console.warn('[SW] 網路請求失敗，嘗試使用快取:', request.url);
        
        const cache = await caches.open(cacheName);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return new Response('離線模式', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * 背景更新快取
 */
function updateCacheInBackground(request, cache) {
    fetch(request)
        .then(response => {
            // 🔥 修復：更嚴格的響應檢查，避免快取 opaque 響應導致錯誤
            if (response && 
                response.ok && 
                response.status === 200 &&
                response.type !== 'error' && 
                response.type !== 'opaque' &&
                request.url.startsWith(self.location.origin)) {
                return cache.put(request, response.clone()).catch(err => {
                    console.warn('[SW] 背景快取更新失敗（靜默忽略）:', err.message);
                });
            }
        })
        .catch(() => {
            // 靜默失敗
        });
}

/**
 * 限制快取大小
 */
async function limitCacheSize(cacheName, maxSize) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    if (keys.length > maxSize) {
        // 刪除最舊的項目
        await cache.delete(keys[0]);
        limitCacheSize(cacheName, maxSize);
    }
}

/**
 * 判斷是否為靜態資源
 */
function isStaticAsset(url) {
    const staticExtensions = ['.js', '.css', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.woff', '.woff2'];
    return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

// 處理消息（用於手動更新快取等）
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(name => caches.delete(name))
                );
            })
        );
    }
});

console.log('[SW] Service Worker 已載入');
