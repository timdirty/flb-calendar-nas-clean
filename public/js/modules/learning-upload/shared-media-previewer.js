/**
 * ============================================
 * 共用媒體預覽器模組
 * ============================================
 * 功能：統一處理照片/影片的預覽生成與管理
 * 使用場景：學生頁面、課程總覽、抽屜
 */

(function (global) {
  'use strict';

  // ==================== 配置 ====================
  var DEFAULT_CONFIG = {
    // 預覽樣式
    containerClass: 'file-previews',
    previewClass: 'file-preview',
    newUploadClass: 'new-upload',
    loadingClass: 'loading',
    clickableClass: 'preview-clickable',
    
    // Blob URL 管理
    trackBlobUrls: true,
    autoCleanup: true,
    
    // 🚀 優化：懶加載與 Intersection Observer
    lazyLoad: true,
    initialPreviewCount: 5,
    useIntersectionObserver: true, // 使用 Intersection Observer
    intersectionOptions: {
      root: null,
      rootMargin: '50px', // 提前 50px 開始載入
      threshold: 0.01 // 元素只需要露出 1% 就觸發
    },
    unloadInvisible: false, // 是否卸載不可見元素（進階優化）
    unloadDistance: 1000, // 超過多少像素視為不可見
    // 與學生頁一致：允許關閉旋轉載入指示（overview 需關閉）
    disableSpinner: false
  };

  // ==================== 狀態管理 ====================
  var blobUrlRegistry = new Map(); // containerId -> Set<url>
  var intersectionObservers = new Map(); // containerId -> IntersectionObserver

  // ==================== 工具函數 ====================
  
  /**
   * 清理容器中的所有 Blob URLs
   */
  function cleanupContainerBlobUrls(containerId) {
    if (!blobUrlRegistry.has(containerId)) return 0;
    
    var urls = blobUrlRegistry.get(containerId);
    var count = 0;
    
    urls.forEach(function(url) {
      try {
        URL.revokeObjectURL(url);
        count++;
      } catch (e) {
        console.warn('⚠️ [Blob URL 清理] 無法釋放:', url, e);
      }
    });
    
    blobUrlRegistry.delete(containerId);
    console.log('✅ [Blob URL 清理] 已釋放', count, '個 URL (' + containerId + ')');
    return count;
  }

  /**
   * 註冊 Blob URL
   */
  function registerBlobUrl(containerId, url) {
    if (!blobUrlRegistry.has(containerId)) {
      blobUrlRegistry.set(containerId, new Set());
    }
    blobUrlRegistry.get(containerId).add(url);
  }

  /**
   * 🚀 新增：設置 Intersection Observer
   * 監控預覽元素的可見性，只在進入視口時載入資源
   */
  function setupIntersectionObserver(container, config) {
    if (!config.useIntersectionObserver || !('IntersectionObserver' in window)) {
      console.log('⚠️ [懶加載] Intersection Observer 不可用或已禁用');
      return null;
    }

    var containerId = container.id || 'container-' + Date.now();
    
    // 如果已存在 Observer，先清理
    if (intersectionObservers.has(containerId)) {
      var existingObserver = intersectionObservers.get(containerId);
      existingObserver.disconnect();
    }

    var options = config.intersectionOptions || DEFAULT_CONFIG.intersectionOptions;
    
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        var element = entry.target;
        
        if (entry.isIntersecting) {
          // 元素進入視口
          handleElementVisible(element, container, config);
        } else if (config.unloadInvisible) {
          // 元素離開視口（可選）
          handleElementInvisible(element, config);
        }
      });
    }, options);

    intersectionObservers.set(containerId, observer);
    console.log('✅ [懶加載] Intersection Observer 已設置 (' + containerId + ')');
    
    return observer;
  }

  /**
   * 🚀 處理元素進入視口
   */
  function handleElementVisible(element, container, config) {
    // 檢查是否已載入
    if (element.hasAttribute('data-loaded')) {
      return;
    }

    console.log('👁️ [懶加載] 元素進入視口:', element.id);
    
    // 載入圖片
    var img = element.querySelector('img:not(.video-poster)');
    if (img && img.hasAttribute('data-src')) {
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
    }

    // 生成影片縮圖
    var isVideo = element.getAttribute('data-file-type') === 'video';
    if (isVideo && !element.hasAttribute('data-poster-generated')) {
      try {
        var video = element.querySelector('video');
        if (video && typeof window.LearningUploadPosterManager !== 'undefined') {
          var fileSize = parseInt(element.getAttribute('data-file-size') || '0', 10);
          
          window.LearningUploadPosterManager.generate(video, {
            src: video.src,
            fileSize: fileSize,
            file: element._fileObject // 如果有儲存
          }).then(function(posterUrl) {
            if (posterUrl) {
              var posterImg = element.querySelector('.video-poster');
              if (posterImg) {
                posterImg.src = posterUrl;
                posterImg.style.display = 'block';
              }
              element.setAttribute('data-poster-generated', 'true');
              console.log('✅ [懶加載] 影片縮圖生成完成:', element.id);
            }
          }).catch(function(error) {
            console.warn('⚠️ [懶加載] 影片縮圖生成失敗:', error);
          });
        }
      } catch (error) {
        console.warn('⚠️ [懶加載] 影片處理失敗:', error);
      }
    }

    // 標記為已載入
    element.setAttribute('data-loaded', 'true');
    element.classList.remove(config.loadingClass);
  }

  /**
   * 🚀 處理元素離開視口（進階優化）
   */
  function handleElementInvisible(element, config) {
    // 檢查是否遠離視口
    var rect = element.getBoundingClientRect();
    var viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    var distance = Math.min(
      Math.abs(rect.top - viewportHeight),
      Math.abs(rect.bottom)
    );

    if (distance > config.unloadDistance) {
      console.log('💤 [懶加載] 元素遠離視口，卸載資源:', element.id);
      
      // 卸載圖片
      var img = element.querySelector('img:not(.video-poster)');
      if (img && img.src) {
        img.setAttribute('data-src', img.src);
        img.src = '';
      }

      // 卸載影片縮圖
      var posterImg = element.querySelector('.video-poster');
      if (posterImg && posterImg.src) {
        posterImg.src = '';
        posterImg.style.display = 'none';
      }

      // 移除已載入標記
      element.removeAttribute('data-loaded');
      element.removeAttribute('data-poster-generated');
    }
  }

  /**
   * 🚀 清理 Intersection Observer
   */
  function cleanupIntersectionObserver(containerId) {
    if (!intersectionObservers.has(containerId)) return;
    
    var observer = intersectionObservers.get(containerId);
    observer.disconnect();
    intersectionObservers.delete(containerId);
    
    console.log('✅ [懶加載] Observer 已清理 (' + containerId + ')');
  }

  /**
   * 創建預覽元素
   */
  function createPreviewElement(file, index, config, containerId) {
    var isImage = /^image\//i.test(file.type);
    
    // 🔥 檢測 HEIC 格式（瀏覽器不支援預覽）
    var isHeic = /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name) || 
                 /heic|heif/i.test(file.type);
    
    // 🔹 創建容器
    var previewDiv = document.createElement('div');
    previewDiv.className = [
      config.previewClass,
      config.newUploadClass,
      config.loadingClass,
      config.clickableClass
    ].join(' ');
    previewDiv.id = (isImage ? 'preview-image-' : 'preview-video-') + index;
    previewDiv.setAttribute('data-file-index', index); // 🔥 新增：用於進度條更新
    previewDiv.setAttribute('data-file-type', isImage ? 'image' : 'video');
    previewDiv.setAttribute('data-file-name', file.name || '');

    // 🆕 與學生頁一致：掛上 tempId，讓 PendingMediaActions 能定位節點更新進度
    try {
      var pm = file && file.__pendingMeta ? file.__pendingMeta : null;
      if (pm && pm.tempId) {
        previewDiv.setAttribute('data-temp-id', pm.tempId);
        previewDiv.setAttribute('data-pending-state', pm.state || 'queued');
        // 預設顯示覆蓋層：pending/ready 先給 pending，uploading/failed 對應樣式
        var state = String(pm.state || 'queued');
        if (state === 'uploading') {
          previewDiv.classList.add('uploading');
        } else if (state === 'failed') {
          previewDiv.classList.add('upload-error');
        } else {
          previewDiv.classList.add('pending');
        }
      }
    } catch (_) {}
    
    // 🔥 HEIC 格式：使用占位符，不創建 blob URL
    if (isHeic) {
      console.log('🔮 [HEIC] 使用占位符預覽:', file.name);
      
      // 不創建 blob URL，直接顯示占位符
      var placeholder = document.createElement('div');
      placeholder.className = 'heic-placeholder';
      placeholder.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;min-height:120px;text-align:center;border-radius:8px;';
      
      placeholder.innerHTML = 
        '<i class="fas fa-image" style="font-size:48px;margin-bottom:10px;opacity:0.9;"></i>' +
        '<div style="font-size:14px;font-weight:500;margin-bottom:5px;">HEIC 格式</div>' +
        '<div style="font-size:12px;opacity:0.8;">' + (file.name || '') + '</div>' +
        '<div style="font-size:11px;opacity:0.7;margin-top:8px;">⏳ 準備上傳...</div>';
      
      previewDiv.appendChild(placeholder);
      
      // 🔥 新增：HEIC 也需要進度條和覆蓋層
      var overlay = document.createElement('div');
      overlay.className = 'file-uploading-overlay';
      // 🔥 [修復 2025-11-18] 不設定 inline style，由 CSS 控制
      // overlay.style.display = 'flex';
      
      var progressText = document.createElement('span');
      progressText.className = 'progress-text';
      progressText.textContent = '準備中';
      overlay.appendChild(progressText);
      
      var progressBar = document.createElement('div');
      progressBar.className = 'file-upload-progress';
      var progressFill = document.createElement('div');
      progressFill.className = 'file-upload-progress-fill';
      progressFill.style.width = '0px'; // 0% = 0px
      progressBar.appendChild(progressFill);
      overlay.appendChild(progressBar);
      
      previewDiv.appendChild(overlay);
      
      // 保留 loading 類（不要立即標記為 loaded，等上傳完成）
      // previewDiv.classList.add('loaded'); // ❌ 刪除這行
      // previewDiv.classList.remove('loading'); // ❌ 刪除這行
      
    } else {
      // 🔹 非 HEIC：正常創建 blob URL 或縮圖
      var url;
      
      // 🖼️ 照片：使用縮圖生成器（提升載入速度）
      if (isImage && window.thumbnailGenerator) {
        // 先設置佔位符
        url = '';
        previewDiv.classList.add('generating-thumbnail');
        
        // 異步生成縮圖
        window.thumbnailGenerator.generate(file).then(function(thumbnailUrl) {
          previewDiv.setAttribute('data-object-url', thumbnailUrl);
          previewDiv.classList.remove('generating-thumbnail');
          
          // 更新圖片 src
          var img = previewDiv.querySelector('img');
          if (img) {
            img.src = thumbnailUrl;
            console.log('✅ [SharedPreviewer] 縮圖已載入:', file.name);
          }
          
          // 🔥 註冊 Blob URL 到容器（用於後續清理）
          if (config.trackBlobUrls) {
            registerBlobUrl(containerId, thumbnailUrl);
          }
        }).catch(function(err) {
          console.error('❌ [SharedPreviewer] 縮圖生成失敗，降級到原圖:', file.name, err);
          // 降級：使用原圖
          var fallbackUrl = window.BlobURLManager ? 
            window.BlobURLManager.createObjectURL(file, { 
              source: 'media-previewer-fallback',
              fileName: file.name,
              index: index 
            }) : URL.createObjectURL(file);
          previewDiv.setAttribute('data-object-url', fallbackUrl);
          previewDiv.classList.remove('generating-thumbnail');
          
          var img = previewDiv.querySelector('img');
          if (img) {
            img.src = fallbackUrl;
          }
        });
      } 
      // 🎬 影片：使用原檔案
      else {
        url = window.BlobURLManager ? 
          window.BlobURLManager.createObjectURL(file, { 
            source: 'media-previewer',
            fileName: file.name,
            index: index 
          }) : URL.createObjectURL(file);
        previewDiv.setAttribute('data-object-url', url);
      }
      
      // 🔹 媒體元素
      if (isImage) {
        var img = document.createElement('img');
        
        // 🚀 優化：使用 Intersection Observer 時延遲載入
        if (config.useIntersectionObserver && config.lazyLoad && index >= config.initialPreviewCount) {
          img.setAttribute('data-src', url || ''); // 儲存 URL，稍後載入
          img.alt = file.name || '照片';
          img.className = 'loading'; // 標記為載入中
          // 不設置 src，等待 Observer 觸發或縮圖生成完成
        } else {
          if (url) {
            img.src = url;
          }
          img.alt = file.name || '照片';
          img.loading = config.lazyLoad ? 'lazy' : 'eager';
          img.className = url ? '' : 'loading';
        }
        
        previewDiv.appendChild(img);
      } else {
        // 影片
        var video = document.createElement('video');
        video.src = url;
        video.setAttribute('preload', 'metadata');
        video.muted = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('crossorigin', 'anonymous');
        
        // 🚀 儲存檔案資訊供 Intersection Observer 使用
        previewDiv.setAttribute('data-file-size', file.size || 0);
        previewDiv._fileObject = file; // 儲存檔案物件參考
        
        previewDiv.appendChild(video);
        
        // 影片海報圖（後續生成）
        var posterImg = document.createElement('img');
        posterImg.className = 'video-poster';
        posterImg.src = '';
        posterImg.alt = '';
        posterImg.setAttribute('aria-hidden', 'true');
        posterImg.style.display = 'none';
        previewDiv.appendChild(posterImg);
        
        // 影片圖標（備用）
        var fallbackIcon = document.createElement('div');
        fallbackIcon.className = 'video-fallback-icon';
        fallbackIcon.setAttribute('aria-hidden', 'true');
        fallbackIcon.style.display = 'none';
        fallbackIcon.textContent = '🎬';
        previewDiv.appendChild(fallbackIcon);
      }
    }
    
    // 🔥 [簡化 2025-11-23] 直接刪除旋轉載入指示器，避免 CSS 禁用的複雜性
    // 不再創建 .thumb-loading 元素
    
    // 🔹 上傳進度覆蓋層
    var overlay = document.createElement('div');
    overlay.className = 'file-uploading-overlay';
    // 🔥 [修復 2025-11-18] 不設定 inline style，由 CSS 控制
    // overlay.style.display = 'flex';
    
    var progressText = document.createElement('span');
    progressText.className = 'progress-text';
    progressText.textContent = '準備中';
    overlay.appendChild(progressText);
    
    var progressBar = document.createElement('div');
    progressBar.className = 'file-upload-progress';
    var progressFill = document.createElement('div');
    progressFill.className = 'file-upload-progress-fill';
    progressFill.style.width = '0px'; // 0% = 0px
    progressBar.appendChild(progressFill);
    overlay.appendChild(progressBar);
    
    previewDiv.appendChild(overlay);

    // 🔥 [簡化 2025-11-23] 直接設置為已載入狀態，不需要處理 spinner
    previewDiv.classList.add('loaded');

    return { element: previewDiv, url: url, isImage: isImage };
  }

  /**
   * 創建刪除按鈕
   * 
   * 🔥 [統一 2025-11-19] 注意：
   * - 此函數僅創建基礎按鈕並設置初始 onclick 作為備援
   * - 統一的刪除按鈕綁定由 renderPreviews 函數調用 ensureDeleteButtonWorks 處理
   * - ensureDeleteButtonWorks 會克隆按鈕並重新綁定事件，確保可靠性
   * 
   * @param {number} index - 檔案索引
   * @param {boolean} isImage - 是否為圖片
   * @param {Function} onRemove - 刪除回調函數
   * @returns {HTMLElement} 刪除按鈕元素
   */
  function createRemoveButton(index, isImage, onRemove) {
    var removeBtn = document.createElement('button');
    removeBtn.className = 'remove-btn';
    removeBtn.type = 'button';
    removeBtn.setAttribute('data-index', index);
    
    // 設置初始 onclick（作為備援，實際由 ensureDeleteButtonWorks 重新綁定）
    if (typeof onRemove === 'function') {
      removeBtn.onclick = function(e) {
        e.stopPropagation();
        onRemove(index, isImage);
      };
    }
    
    var removeIcon = document.createElement('i');
    removeIcon.className = 'fas fa-times';
    removeBtn.appendChild(removeIcon);
    
    return removeBtn;
  }

  // ==================== 主要功能 ====================
  
  /**
   * 渲染檔案預覽
   * 
   * @param {Object} options - 配置選項
   * @param {string|Element} options.container - 預覽容器（ID 或元素）
   * @param {File[]} options.files - 檔案列表
   * @param {boolean} options.clearExisting - 是否清除現有預覽（預設 true）
   * @param {Function} options.onRemove - 刪除回調 (index, isImage)
   * @param {Function} options.onClick - 點擊預覽回調 (file, index)
   * @param {Object} options.config - 自訂配置
   * 
   * @returns {Array} 創建的預覽元素列表
   */
  function renderPreviews(options) {
    try {
      // 🔒 參數驗證
      if (!options || !options.container) {
        throw new Error('缺少必要參數：container');
      }
      
      var container = typeof options.container === 'string' 
        ? document.getElementById(options.container) || document.querySelector(options.container)
        : options.container;
      
      if (!container) {
        throw new Error('找不到預覽容器');
      }
      
      var files = options.files || [];
      var clearExisting = options.clearExisting !== false;
      var config = Object.assign({}, DEFAULT_CONFIG, options.config || {});
      var containerId = container.id || 'container-' + Date.now();
      
      console.log('🎨 [renderPreviews] 渲染預覽:', files.length, '個檔案, clearExisting:', clearExisting);
      
      // 🧹 清除現有預覽與 Blob URLs
      if (clearExisting) {
        cleanupContainerBlobUrls(containerId);
        // 🔥 [修復] 只清除 .new-upload 節點，保留 .existing 和 .loaded 節點
        var newUploadNodes = container.querySelectorAll('.file-preview.new-upload');
        newUploadNodes.forEach(function(node) {
          try {
            var blobUrl = node.getAttribute('data-object-url') || node.getAttribute('data-blob-url');
            if (blobUrl && blobUrl.startsWith('blob:')) {
              URL.revokeObjectURL(blobUrl);
            }
            node.remove();
          } catch (e) {}
        });
      }
      
      if (!files.length) {
        console.log('✅ [renderPreviews] 沒有檔案，預覽容器已清空');
        return [];
      }
      
      // 🔥 [修復] 當 clearExisting=false 時，檢查現有預覽，避免重複
      var existingPreviewCount = 0;
      if (!clearExisting) {
        var existingPreviews = container.querySelectorAll('.file-preview.new-upload');
        existingPreviewCount = existingPreviews.length;
        console.log('💡 [renderPreviews] 保留模式，現有新上傳預覽:', existingPreviewCount, '個');
        
        // 🔥 如果檔案數量與現有預覽數量相同，直接返回（避免重複渲染）
        if (existingPreviewCount === files.length) {
          console.log('✅ [renderPreviews] 預覽已存在，跳過渲染');
          return Array.prototype.slice.call(existingPreviews);
        }
        
        // 🔥 如果檔案數量增加，只渲染新增的檔案
        if (existingPreviewCount > 0 && existingPreviewCount < files.length) {
          console.log('📝 [renderPreviews] 只渲染新增的', (files.length - existingPreviewCount), '個檔案');
          files = files.slice(existingPreviewCount);
        }
      }
      
      // 🎯 創建預覽元素
      var fragment = document.createDocumentFragment();
      var previewElements = [];
      
      files.forEach(function(file, index) {
        try {
          // 🔥 [修復] 調整索引，考慮已存在的預覽
          var actualIndex = clearExisting ? index : (existingPreviewCount + index);
          var preview = createPreviewElement(file, actualIndex, config, containerId);
          
          // 註冊 Blob URL
          if (config.trackBlobUrls) {
            registerBlobUrl(containerId, preview.url);
          }
          
          // 添加刪除按鈕
          if (typeof options.onRemove === 'function') {
            var removeBtn = createRemoveButton(actualIndex, preview.isImage, options.onRemove);
            preview.element.appendChild(removeBtn);
          }
          
          // 添加點擊事件
          if (typeof options.onClick === 'function') {
            preview.element.style.cursor = 'pointer';
            preview.element.addEventListener('click', function(e) {
              // 不觸發刪除按鈕的點擊
              if (e.target.closest('.remove-btn')) return;
              options.onClick(file, actualIndex, preview.element);
            });
          }
          
          fragment.appendChild(preview.element);
          previewElements.push(preview);
          
        } catch (fileErr) {
          console.error('❌ [renderPreviews] 創建預覽失敗:', file.name, fileErr);
        }
      });
      
      container.appendChild(fragment);
      
      // 🔥 [簡化 2025-11-23] 已刪除旋轉載入指示器，不需要附加處理器
      
      // 🚀 優化：設置 Intersection Observer
      if (config.useIntersectionObserver) {
        var observer = setupIntersectionObserver(container, config);
        
        if (observer) {
          // 觀察所有預覽元素（包括新增和現有的）
          var allPreviews = container.querySelectorAll('.file-preview.new-upload');
          allPreviews.forEach(function(preview) {
            // 跳過已經在視口中的前幾個元素
            var previewIndex = parseInt(preview.id.match(/\d+$/)?.[0] || '0', 10);
            if (previewIndex >= config.initialPreviewCount || preview.getAttribute('data-file-type') === 'video') {
              observer.observe(preview);
            } else {
              // 前幾個元素立即標記為已載入
              preview.setAttribute('data-loaded', 'true');
            }
          });
          
          console.log('✅ [renderPreviews] Intersection Observer 已設置，監控', allPreviews.length, '個預覽');
        }
      } else {
        // 🔥 [修復] 傳統方式：智能生成影片縮圖（與抽屜、課程總覽一致）
        try {
          if (typeof window.SmartPosterGenerator !== 'undefined' && 
              typeof window.SmartPosterGenerator.processContainer === 'function') {
            // 🔥 只處理新增的影片預覽（避免重複處理已生成縮圖的影片）
            var newVideos = container.querySelectorAll('.file-preview.new-upload[data-preview-type="video"]:not([data-poster-generated])');
            if (newVideos.length > 0) {
              window.SmartPosterGenerator.processContainer(container);
              console.log('✅ [renderPreviews] 已觸發影片縮圖生成:', newVideos.length, '個');
            }
          }
        } catch (e) {
          console.warn('⚠️ [renderPreviews] 影片縮圖生成失敗:', e);
        }
      }
      
      // 🔥 [統一 2025-11-19] 統一刪除按鈕綁定方式：使用 ensureDeleteButtonWorks
      // 確保所有預覽的刪除按鈕都使用相同的可靠綁定機制
      if (typeof window.ensureDeleteButtonWorks === 'function') {
        try {
          var allNewPreviews = container.querySelectorAll('.file-preview.new-upload');
          console.log('🔧 [renderPreviews] 統一綁定刪除按鈕:', allNewPreviews.length, '個預覽');
          
          allNewPreviews.forEach(function(preview) {
            // ensureDeleteButtonWorks 需要 data-file-id，如果沒有則跳過
            if (preview.getAttribute('data-file-id')) {
              window.ensureDeleteButtonWorks(preview);
            } else {
              console.warn('⚠️ [renderPreviews] 預覽缺少 data-file-id，跳過統一綁定:', preview.id);
            }
          });
          
          console.log('✅ [renderPreviews] 刪除按鈕已統一綁定');
        } catch (bindErr) {
          console.warn('⚠️ [renderPreviews] 統一綁定刪除按鈕失敗:', bindErr);
        }
      } else {
        console.warn('⚠️ [renderPreviews] ensureDeleteButtonWorks 不可用，使用 onclick 綁定');
      }
      
      var totalPreviews = container.querySelectorAll('.file-preview.new-upload').length;
      console.log('✅ [renderPreviews] 預覽渲染完成:', previewElements.length, '個新元素, 總計:', totalPreviews, '個');
      return previewElements;
      
    } catch (error) {
      console.error('❌ [renderPreviews] 渲染預覽時發生錯誤:', error);
      throw error;
    }
  }

  /**
   * 更新預覽的上傳進度
   * 
   * 🔥 [統一 2025-11-19] 使用 SharedPreviewRenderer 統一進度顯示
   * 
   * @param {string|Element} preview - 預覽元素（ID 或元素）
   * @param {number} progress - 進度百分比 (0-100)
   * @param {string} status - 狀態文字（可選）
   */
  function updatePreviewProgress(preview, progress, status) {
    try {
      var element = typeof preview === 'string' 
        ? document.getElementById(preview) || document.querySelector(preview)
        : preview;
      
      if (!element) {
        console.warn('⚠️ [updatePreviewProgress] 找不到預覽元素:', preview);
        return;
      }
      
      // 🔥 [統一 2025-11-19] 優先使用 SharedPreviewRenderer 統一接口
      if (typeof window.SharedPreviewRenderer !== 'undefined' && 
          typeof window.SharedPreviewRenderer.setProgress === 'function') {
        window.SharedPreviewRenderer.setProgress(element, progress, status || '');
        console.log('✅ [updatePreviewProgress] 使用 SharedPreviewRenderer:', progress + '%');
        return;
      }
      
      // 降級：直接操作 DOM（向後兼容）
      console.warn('⚠️ [updatePreviewProgress] SharedPreviewRenderer 不可用，使用降級方案');
      
      // 更新進度條
      var progressFill = element.querySelector('.file-upload-progress-fill');
      if (progressFill) {
        var bounded = Math.min(100, Math.max(0, progress));
        var pixelWidth = Math.round(70 * bounded / 100);
        progressFill.style.width = pixelWidth + 'px';
      }
      
      // 更新狀態文字
      if (status) {
        var progressText = element.querySelector('.progress-text');
        if (progressText) {
          progressText.textContent = status;
        }
      }
      
      // 完成時隱藏覆蓋層
      if (progress >= 100) {
        var overlay = element.querySelector('.file-uploading-overlay');
        // 🔥 [修復 2025-11-18] 不設定 inline style，由 CSS 控制
        // if (overlay) {
        //   setTimeout(function() {
        //     overlay.style.display = 'none';
        //   }, 500);
        // }
        element.classList.remove('loading');
      }
      
    } catch (error) {
      console.error('❌ [updatePreviewProgress] 更新進度時發生錯誤:', error);
    }
  }

  /**
   * 清理指定容器的所有預覽
   * 
   * @param {string|Element} container - 容器（ID 或元素）
   */
  function cleanupPreviews(container) {
    try {
      var element = typeof container === 'string' 
        ? document.getElementById(container) || document.querySelector(container)
        : container;
      
      if (!element) {
        console.warn('⚠️ [cleanupPreviews] 找不到容器:', container);
        return;
      }
      
      var containerId = element.id || 'unknown';
      
      // 🚀 清理 Intersection Observer
      cleanupIntersectionObserver(containerId);
      
      // 清理 Blob URLs
      cleanupContainerBlobUrls(containerId);
      
      element.innerHTML = '';
      
      console.log('✅ [cleanupPreviews] 預覽已清理 (' + containerId + ')');
      
    } catch (error) {
      console.error('❌ [cleanupPreviews] 清理預覽時發生錯誤:', error);
    }
  }

  /**
   * 全域清理（頁面卸載時使用）
   */
  function cleanupAll() {
    // 🚀 清理所有 Intersection Observers
    intersectionObservers.forEach(function(observer, containerId) {
      observer.disconnect();
    });
    intersectionObservers.clear();
    console.log('✅ [全域清理] 已清理所有 Intersection Observers');
    
    // 清理所有 Blob URLs
    var totalUrls = 0;
    blobUrlRegistry.forEach(function(urls, containerId) {
      urls.forEach(function(url) {
        try {
          URL.revokeObjectURL(url);
          totalUrls++;
        } catch (e) {}
      });
    });
    blobUrlRegistry.clear();
    console.log('✅ [全域清理] 已釋放所有 Blob URLs:', totalUrls, '個');
  }

  // ==================== 導出模組 ====================
  
  var SharedMediaPreviewer = {
    renderPreviews: renderPreviews,
    updatePreviewProgress: updatePreviewProgress,
    cleanupPreviews: cleanupPreviews,
    cleanupAll: cleanupAll,
    createPreviewElement: createPreviewElement,
    createRemoveButton: createRemoveButton,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
    // 🚀 新增：Intersection Observer 相關方法
    setupIntersectionObserver: setupIntersectionObserver,
    cleanupIntersectionObserver: cleanupIntersectionObserver
  };

  // 掛載到全域
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedMediaPreviewer;
  } else {
    global.SharedMediaPreviewer = SharedMediaPreviewer;
  }

  // 🔥 頁面卸載時自動清理
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanupAll);
  }

})(typeof window !== 'undefined' ? window : this);
