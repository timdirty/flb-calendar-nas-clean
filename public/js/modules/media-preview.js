/**
 * 🖼️🎬 統一媒體預覽組件
 * 功能：
 * 1. 照片預覽：優先載入 small 縮圖，點擊載入 medium，再點擊載入原圖
 * 2. 影片預覽：顯示 poster 縮圖，點擊播放 webm 轉碼版本
 * 3. 懶加載支援（Intersection Observer）
 * 4. 錯誤處理與 fallback
 * 5. 全螢幕播放器
 * 
 * 版本：1.0.0
 * 日期：2025-11-03
 */

(function (global) {
    'use strict';

    // 🔧 配置參數
    const CONFIG = {
        PHOTO_SIZES: {
            SMALL: 'small',      // 列表用（200x200）
            MEDIUM: 'medium',    // 預覽用（800x800）
            ORIGINAL: 'original' // 原圖
        },
        LAZY_LOAD: true,         // 是否啟用懶加載
        LAZY_ROOT_MARGIN: '50px', // 懶加載觸發邊距
        PLACEHOLDER_PHOTO: '/assets/placeholder-photo.png',
        PLACEHOLDER_VIDEO: '/assets/placeholder-video.png'
    };

    /**
     * 創建照片預覽元素
     * @param {Object} record - 媒體記錄物件
     * @param {Object} options - 選項
     * @returns {HTMLElement} 預覽元素
     */
    function createPhotoPreview(record, options = {}) {
        const {
            size = CONFIG.PHOTO_SIZES.SMALL,
            onClick,
            lazyLoad = CONFIG.LAZY_LOAD,
            className = ''
        } = options;

        // 建構縮圖 URL
        const thumbUrl = buildPhotoURL(record, size);

        // 創建容器
        const container = document.createElement('div');
        container.classList.add('media-preview-container', 'photo-preview-container');
        if (className) {
            className.split(' ').forEach(cls => container.classList.add(cls));
        }

        // 創建圖片元素
        const img = document.createElement('img');
        img.classList.add('media-preview', `media-preview--${size}`);
        img.alt = record.originalName || '照片';
        img.setAttribute('data-record-id', record.id);

        // 懶加載處理
        if (lazyLoad) {
            img.loading = 'lazy'; // 原生懶加載
            img.setAttribute('data-src', thumbUrl);
            img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"%3E%3C/svg%3E'; // 佔位 SVG
            
            // 使用 Intersection Observer
            if ('IntersectionObserver' in window) {
                observeLazyImage(img, thumbUrl);
            } else {
                img.src = thumbUrl; // 不支援就直接載入
            }
        } else {
            img.src = thumbUrl;
        }

        // 錯誤處理
        img.addEventListener('error', () => {
            console.warn('⚠️ [照片預覽] 載入失敗:', thumbUrl);
            img.src = CONFIG.PLACEHOLDER_PHOTO;
            img.classList.add('media-preview--error');
        });

        // 點擊事件
        if (typeof onClick === 'function') {
            container.style.cursor = 'pointer';
            container.addEventListener('click', () => onClick(record));
        } else {
            // 預設行為：點擊放大
            container.style.cursor = 'pointer';
            container.addEventListener('click', () => showPhotoDetail(record));
        }

        container.appendChild(img);
        return container;
    }

    /**
     * 創建影片預覽元素
     * @param {Object} record - 媒體記錄物件
     * @param {Object} options - 選項
     * @returns {HTMLElement} 預覽元素
     */
    function createVideoPreview(record, options = {}) {
        const {
            onClick,
            lazyLoad = CONFIG.LAZY_LOAD,
            className = ''
        } = options;

        // 建構縮圖 URL
        const posterUrl = buildVideoThumbnailURL(record);

        // 創建容器
        const container = document.createElement('div');
        container.classList.add('media-preview-container', 'video-preview-container');
        if (className) {
            className.split(' ').forEach(cls => container.classList.add(cls));
        }
        container.setAttribute('data-record-id', record.id);

        // 創建縮圖
        const poster = document.createElement('img');
        poster.classList.add('video-preview-poster');
        poster.alt = record.originalName || '影片';

        // 懶加載處理
        if (lazyLoad) {
            poster.loading = 'lazy';
            poster.setAttribute('data-src', posterUrl);
            poster.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720"%3E%3C/svg%3E';
            
            if ('IntersectionObserver' in window) {
                observeLazyImage(poster, posterUrl);
            } else {
                poster.src = posterUrl;
            }
        } else {
            poster.src = posterUrl;
        }

        poster.addEventListener('error', () => {
            console.warn('⚠️ [影片預覽] 縮圖載入失敗:', posterUrl);
            poster.src = CONFIG.PLACEHOLDER_VIDEO;
        });

        // 播放按鈕
        const playBtn = document.createElement('button');
        playBtn.classList.add('video-preview-play-btn');
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.setAttribute('aria-label', '播放影片');

        // 時長標籤（如果有的話）
        if (record.duration) {
            const durationLabel = document.createElement('div');
            durationLabel.classList.add('video-preview-duration');
            durationLabel.textContent = formatDuration(record.duration);
            container.appendChild(durationLabel);
        }

        container.appendChild(poster);
        container.appendChild(playBtn);

        // 點擊播放
        container.style.cursor = 'pointer';
        container.addEventListener('click', () => {
            if (typeof onClick === 'function') {
                onClick(record);
            } else {
                openVideoPlayer(record);
            }
        });

        return container;
    }

    /**
     * 打開全螢幕影片播放器
     * @param {Object} record - 影片記錄物件
     */
    function openVideoPlayer(record) {
        // 建構影片 URL
        const videoUrl = buildVideoURL(record);
        const posterUrl = buildVideoThumbnailURL(record);

        // 創建 overlay
        const overlay = document.createElement('div');
        overlay.classList.add('video-player-overlay');
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.2s ease;
        `;

        // 創建影片元素
        const video = document.createElement('video');
        video.src = videoUrl;
        video.controls = true;
        video.autoplay = true;
        video.poster = posterUrl;
        video.style.cssText = `
            max-width: 90vw;
            max-height: 90vh;
            border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        `;

        // 關閉按鈕
        const closeBtn = document.createElement('button');
        closeBtn.classList.add('video-player-close');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.setAttribute('aria-label', '關閉播放器');
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 44px;
            height: 44px;
            border-radius: 22px;
            border: 2px solid white;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            font-size: 18px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
            closeBtn.style.transform = 'scale(1.1)';
        });
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'rgba(0, 0, 0, 0.7)';
            closeBtn.style.transform = 'scale(1)';
        });

        closeBtn.addEventListener('click', () => {
            video.pause();
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
        });

        // 點擊背景關閉
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                video.pause();
                overlay.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => overlay.remove(), 200);
            }
        });

        // ESC 鍵關閉
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                video.pause();
                overlay.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => overlay.remove(), 200);
                document.removeEventListener('keydown', handleEsc);
            }
        };
        document.addEventListener('keydown', handleEsc);

        overlay.appendChild(video);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

        console.log('🎬 [影片播放器] 已打開:', record.originalName);
    }

    /**
     * 顯示照片詳情（漸進式載入）
     * @param {Object} record - 照片記錄物件
     */
    function showPhotoDetail(record) {
        // 創建 overlay
        const overlay = document.createElement('div');
        overlay.classList.add('photo-detail-overlay');
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.95);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            animation: fadeIn 0.2s ease;
        `;

        // 創建圖片容器
        const imgContainer = document.createElement('div');
        imgContainer.style.cssText = `
            max-width: 90vw;
            max-height: 90vh;
            position: relative;
        `;

        // 創建圖片（先顯示 medium，再載入原圖）
        const img = document.createElement('img');
        img.style.cssText = `
            max-width: 100%;
            max-height: 90vh;
            border-radius: 8px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        `;

        // 顯示 medium
        const mediumUrl = buildPhotoURL(record, CONFIG.PHOTO_SIZES.MEDIUM);
        img.src = mediumUrl;

        // 載入指示器
        const loader = document.createElement('div');
        loader.textContent = '載入原圖中...';
        loader.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 14px;
        `;

        // 點擊載入原圖
        img.addEventListener('click', () => {
            if (img.getAttribute('data-loaded-original')) return;
            
            imgContainer.appendChild(loader);
            
            const originalUrl = buildPhotoURL(record, CONFIG.PHOTO_SIZES.ORIGINAL);
            const originalImg = new Image();
            
            originalImg.onload = () => {
                img.src = originalUrl;
                img.setAttribute('data-loaded-original', 'true');
                loader.remove();
                console.log('✅ [照片詳情] 原圖已載入');
            };
            
            originalImg.onerror = () => {
                loader.textContent = '原圖載入失敗';
                setTimeout(() => loader.remove(), 2000);
            };
            
            originalImg.src = originalUrl;
        });

        // 關閉按鈕
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.setAttribute('aria-label', '關閉');
        closeBtn.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            width: 44px;
            height: 44px;
            border-radius: 22px;
            border: 2px solid white;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            font-size: 18px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        closeBtn.addEventListener('click', () => {
            overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => overlay.remove(), 200);
        });

        // 點擊背景關閉
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.style.animation = 'fadeOut 0.2s ease';
                setTimeout(() => overlay.remove(), 200);
            }
        });

        imgContainer.appendChild(img);
        overlay.appendChild(imgContainer);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);

        console.log('🖼️ [照片詳情] 已打開:', record.originalName);
    }

    // ==================== 輔助函數 ====================

    function ensureDriveProxy(pathValue) {
        if (!pathValue) return '';
        const str = String(pathValue).trim();
        if (!str) return '';
        if (/^https?:\/\//i.test(str)) return str;
        if (str.indexOf('/api/drive-media') === 0) return str;
        const normalized = str.startsWith('/') ? str : '/' + str;
        return `/api/drive-media${normalized}`;
    }

    function deriveDrivePath(record) {
        if (!record) return '';
        if (record.drivePath) return record.drivePath;
        if (record.path) return record.path;
        const base = record.relativePath || record.recordPath || '';
        const name = record.filename || record.fileName || record.name;
        if (base && name) {
            return `${base.replace(/\/+/g, '/')}/${name}`.replace(/\/+/g, '/');
        }
        return '';
    }

    /**
     * 建構照片 URL（優先使用 Drive 路徑）
     */
    function buildPhotoURL(record, size = 'small') {
        if (record) {
            if (record.proxyUrl) return ensureDriveProxy(record.proxyUrl);
            if (record.drivePath || record.path) return ensureDriveProxy(record.drivePath || record.path);
        }
        const fallbackPath = deriveDrivePath(record);
        return fallbackPath ? ensureDriveProxy(fallbackPath) : '';
    }

    /**
     * 建構影片 URL（優先使用 Drive 路徑或 proxy）
     */
    function buildVideoURL(record) {
        if (record) {
            if (record.proxyUrl) return ensureDriveProxy(record.proxyUrl);
            if (record.drivePath || record.path) return ensureDriveProxy(record.drivePath || record.path);
        }
        const fallbackPath = deriveDrivePath(record);
        return fallbackPath ? ensureDriveProxy(fallbackPath) : '';
    }

    /**
     * 建構影片縮圖 URL
     */
    function buildVideoThumbnailURL(record) {
        if (record) {
            if (record.thumbnailProxyUrl) return ensureDriveProxy(record.thumbnailProxyUrl);
            if (record.thumbnailPath) return ensureDriveProxy(record.thumbnailPath);
        }
        const fallbackPath = record && record.drivePath
            ? record.drivePath
            : deriveDrivePath(record && record.thumbnailFilename ? {
                drivePath: record.thumbnailPath,
                path: record.thumbnailPath,
                relativePath: record.relativePath,
                filename: record.thumbnailFilename
            } : null);
        return fallbackPath ? ensureDriveProxy(fallbackPath) : '';
    }

    /**
     * 格式化時長
     */
    function formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        
        if (h > 0) {
            return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${m}:${String(s).padStart(2, '0')}`;
    }

    /**
     * 懶加載 Intersection Observer
     */
    const lazyImageObserver = ('IntersectionObserver' in window) 
        ? new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const src = img.getAttribute('data-src');
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                        lazyImageObserver.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: CONFIG.LAZY_ROOT_MARGIN
        })
        : null;

    function observeLazyImage(img, src) {
        if (lazyImageObserver) {
            img.setAttribute('data-src', src);
            lazyImageObserver.observe(img);
        } else {
            img.src = src;
        }
    }

    // 🌐 暴露全域 API
    global.MediaPreview = {
        createPhotoPreview,
        createVideoPreview,
        openVideoPlayer,
        showPhotoDetail,
        CONFIG
    };

    // 🎨 注入樣式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        .video-preview-container {
            position: relative;
            border-radius: 8px;
            overflow: hidden;
        }
        
        .video-preview-poster {
            width: 100%;
            height: auto;
            display: block;
            background: #0b1220;
        }
        
        .video-preview-play-btn {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 60px;
            height: 60px;
            border-radius: 30px;
            border: none;
            background: rgba(255, 255, 255, 0.9);
            color: #0f172a;
            font-size: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }
        
        .video-preview-play-btn:hover {
            transform: translate(-50%, -50%) scale(1.1);
            background: white;
        }
        
        .video-preview-duration {
            position: absolute;
            bottom: 8px;
            right: 8px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .media-preview--error {
            opacity: 0.5;
        }
    `;
    document.head.appendChild(style);

    console.log('✅ MediaPreview 模組已載入');

})(window);
