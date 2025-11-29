/**
 * ============================================
 * 共用媒體載入器模組
 * ============================================
 * 功能：統一處理照片/影片的載入與渲染（已上傳的記錄）
 * 使用場景：學生頁面、課程總覽、抽屜
 */

(function (global) {
  'use strict';

  // ==================== 配置 ====================
  var DEFAULT_CONFIG = {
    // API 端點
    photoApiBase: '/api/learning-records/photo',
    videoApiBase: '/api/drive-media/records',
    
    // 快取
    cacheEnabled: true,
    cacheTTL: 5 * 60 * 1000, // 5 分鐘
    
    // 渲染
    containerClass: 'file-previews',
    loadedClass: 'file-preview loaded',
    thumbnailSize: 'medium' // small, medium, large
  };

  // ==================== 快取 ====================
  var cache = {
    photos: new Map(), // recordId -> { data, timestamp }
    videos: new Map()
  };

  // ==================== 工具函數 ====================
  
  /**
   * 檢查快取是否有效
   */
  function isCacheValid(cacheEntry, ttl) {
    if (!cacheEntry) return false;
    return (Date.now() - cacheEntry.timestamp) < ttl;
  }

  /**
   * 創建已上傳媒體的預覽元素
   */
  function ensureDriveProxy(pathValue) {
    if (!pathValue) return '';
    var str = String(pathValue).trim();
    if (!str) return '';
    if (/^https?:\/\//i.test(str)) return str;
    if (str.indexOf('/api/drive-media') === 0) return str;
    var normalized = str.startsWith('/') ? str : '/' + str;
    return '/api/drive-media' + normalized;
  }

  function resolveMediaUrl(media) {
    if (!media) return '';
    return media.url || media.proxyUrl || ensureDriveProxy(media.drivePath || media.path);
  }

  function resolveThumbnail(media) {
    if (!media) return '';
    return media.thumbnail || media.thumbnailProxyUrl || ensureDriveProxy(media.thumbnailPath || media.posterPath);
  }

  function createUploadedPreviewElement(media, index, type, config) {
    var previewDiv = document.createElement('div');
    previewDiv.className = config.loadedClass;
    previewDiv.id = type + '-loaded-' + media.id + '-' + index;
    previewDiv.setAttribute('data-record-id', media.id || '');
    previewDiv.setAttribute('data-file-type', type);
    
    if (type === 'photo') {
      // 照片預覽
      var thumbnailUrl = media.thumbnail || media.url || media.proxyUrl || ensureDriveProxy(media.drivePath || media.path) || '';
      var img = document.createElement('img');
      img.src = thumbnailUrl;
      img.alt = media.filename || '照片';
      img.loading = 'lazy';
      previewDiv.appendChild(img);
      
    } else if (type === 'video') {
      // 影片預覽
      var video = document.createElement('video');
      video.setAttribute('preload', 'metadata');
      video.muted = true;
      video.setAttribute('playsinline', '');
      
      // 如果有海報圖，使用海報圖
      var posterUrl = media.poster || resolveThumbnail(media);
      if (posterUrl) {
        video.poster = posterUrl;
      }
      
      var mediaUrl = resolveMediaUrl(media);
      if (mediaUrl) {
        video.src = mediaUrl;
      }
      
      previewDiv.appendChild(video);
      
      // 影片圖標
      var playIcon = document.createElement('div');
      playIcon.className = 'video-play-icon';
      playIcon.innerHTML = '<i class="fas fa-play-circle"></i>';
      previewDiv.appendChild(playIcon);
    }
    
    return previewDiv;
  }

  // ==================== 主要功能 ====================
  
  /**
   * 載入照片記錄
   * 
   * @param {Object} options - 配置選項
   * @param {string} options.recordId - 記錄 ID
   * @param {boolean} options.forceRefresh - 強制刷新（跳過快取）
   * @param {Object} options.config - 自訂配置
   * 
   * @returns {Promise<Object>} 照片資料
   */
  async function loadPhotos(options) {
    try {
      var recordId = options.recordId;
      var forceRefresh = options.forceRefresh || false;
      var config = Object.assign({}, DEFAULT_CONFIG, options.config || {});
      
      // 檢查快取
      if (!forceRefresh && config.cacheEnabled) {
        var cached = cache.photos.get(recordId);
        if (isCacheValid(cached, config.cacheTTL)) {
          console.log('📦 [loadPhotos] 使用快取:', recordId);
          return cached.data;
        }
      }
      
      // 從 API 載入
      var url = config.photoApiBase + '/' + encodeURIComponent(recordId);
      var response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
      }
      
      var data = await response.json();
      if (data && data.record && !data.videos) {
        data = { videos: [data.record] };
      }
      
      // 更新快取
      if (config.cacheEnabled) {
        cache.photos.set(recordId, {
          data: data,
          timestamp: Date.now()
        });
      }
      
      console.log('✅ [loadPhotos] 載入完成:', recordId, '- 共', (data.photos || []).length, '張');
      return data;
      
    } catch (error) {
      console.error('❌ [loadPhotos] 載入失敗:', error);
      throw error;
    }
  }

  /**
   * 載入影片記錄
   * 
   * @param {Object} options - 配置選項
   * @param {string} options.recordId - 記錄 ID
   * @param {boolean} options.forceRefresh - 強制刷新（跳過快取）
   * @param {Object} options.config - 自訂配置
   * 
   * @returns {Promise<Object>} 影片資料
   */
  async function loadVideos(options) {
    try {
      var recordId = options.recordId;
      var forceRefresh = options.forceRefresh || false;
      var config = Object.assign({}, DEFAULT_CONFIG, options.config || {});
      
      // 檢查快取
      if (!forceRefresh && config.cacheEnabled) {
        var cached = cache.videos.get(recordId);
        if (isCacheValid(cached, config.cacheTTL)) {
          console.log('📦 [loadVideos] 使用快取:', recordId);
          return cached.data;
        }
      }
      
      // 從 API 載入
      var url = config.videoApiBase + '/' + encodeURIComponent(recordId);
      var response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('HTTP ' + response.status + ': ' + response.statusText);
      }
      
      var data = await response.json();
      
      // 更新快取
      if (config.cacheEnabled) {
        cache.videos.set(recordId, {
          data: data,
          timestamp: Date.now()
        });
      }
      
      console.log('✅ [loadVideos] 載入完成:', recordId, '- 共', (data.videos || []).length, '支');
      return data;
      
    } catch (error) {
      console.error('❌ [loadVideos] 載入失敗:', error);
      throw error;
    }
  }

  /**
   * 渲染已上傳的媒體
   * 
   * @param {Object} options - 配置選項
   * @param {string|Element} options.container - 預覽容器（ID 或元素）
   * @param {Object[]} options.media - 媒體列表
   * @param {string} options.type - 類型：'photo' 或 'video'
   * @param {boolean} options.clearExisting - 是否清除現有內容（預設 true）
   * @param {Function} options.onClick - 點擊回調 (media, index)
   * @param {Object} options.config - 自訂配置
   * 
   * @returns {Array} 創建的預覽元素列表
   */
  function renderUploadedMedia(options) {
    try {
      // 🔒 參數驗證
      if (!options || !options.container) {
        throw new Error('缺少必要參數：container');
      }
      
      var container = typeof options.container === 'string' 
        ? document.getElementById(options.container) || document.querySelector(options.container)
        : options.container;
      
      if (!container) {
        throw new Error('找不到容器');
      }
      
      var media = options.media || [];
      var type = options.type || 'photo';
      var clearExisting = options.clearExisting !== false;
      var config = Object.assign({}, DEFAULT_CONFIG, options.config || {});
      
      console.log('🎨 [renderUploadedMedia] 渲染', type, ':', media.length, '個');
      
      // 🧹 清除現有內容
      if (clearExisting) {
        container.innerHTML = '';
      }
      
      if (!media.length) {
        console.log('✅ [renderUploadedMedia] 沒有', type, '需要渲染');
        return [];
      }
      
      // 🎯 創建預覽元素
      var fragment = document.createDocumentFragment();
      var previewElements = [];
      
      media.forEach(function(item, index) {
        try {
          var previewElement = createUploadedPreviewElement(item, index, type, config);
          
          // 添加點擊事件
          if (typeof options.onClick === 'function') {
            previewElement.style.cursor = 'pointer';
            previewElement.addEventListener('click', function(e) {
              options.onClick(item, index, previewElement);
            });
          }
          
          fragment.appendChild(previewElement);
          previewElements.push(previewElement);
          
        } catch (itemErr) {
          console.error('❌ [renderUploadedMedia] 渲染失敗:', item, itemErr);
        }
      });
      
      container.appendChild(fragment);
      
      console.log('✅ [renderUploadedMedia] 渲染完成:', previewElements.length, '個元素');
      return previewElements;
      
    } catch (error) {
      console.error('❌ [renderUploadedMedia] 渲染時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 清除快取
   * 
   * @param {string} type - 類型：'photo', 'video', 'all'
   */
  function clearCache(type) {
    if (type === 'photo' || type === 'all') {
      cache.photos.clear();
      console.log('✅ [clearCache] 照片快取已清除');
    }
    if (type === 'video' || type === 'all') {
      cache.videos.clear();
      console.log('✅ [clearCache] 影片快取已清除');
    }
  }

  // ==================== 導出模組 ====================
  
  var SharedMediaLoader = {
    loadPhotos: loadPhotos,
    loadVideos: loadVideos,
    renderUploadedMedia: renderUploadedMedia,
    clearCache: clearCache,
    createUploadedPreviewElement: createUploadedPreviewElement,
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };

  // 掛載到全域
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedMediaLoader;
  } else {
    global.SharedMediaLoader = SharedMediaLoader;
  }

})(typeof window !== 'undefined' ? window : this);
