/**
 * ============================================
 * 👁️ 惰性預覽載入器（企業級）
 * ============================================
 * 功能：使用 Intersection Observer 實現預覽的惰性載入
 * 特點：
 * - 僅載入可視區域的預覽
 * - 離開可視區域自動釋放 Blob URL
 * - 大幅減少記憶體使用
 * - 提升初始載入速度
 */

(function (global) {
  'use strict';

  // ==================== 配置 ====================
  
  var DEFAULT_CONFIG = {
    // Intersection Observer 配置
    rootMargin: '200px',  // 提前 200px 開始載入
    threshold: 0.01,      // 只要 1% 可見就觸發
    
    // Blob URL 管理
    autoRevoke: true,     // 離開可視區域自動釋放
    revokeDelay: 2000    // 延遲釋放（防止頻繁切換）
  };

  // ==================== 狀態管理 ====================
  
  var observerInstance = null;
  var loadedPreviews = new Map(); // 存儲已載入的預覽
  var revokeTimers = new Map();   // 存儲釋放計時器

  // ==================== 核心函數 ====================

  /**
   * 初始化 Intersection Observer
   */
  function initObserver(config) {
    config = config || DEFAULT_CONFIG;
    
    if (observerInstance) {
      console.log('✅ [LazyPreview] Observer 已存在，跳過初始化');
      return observerInstance;
    }

    try {
      observerInstance = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          var target = entry.target;
          var previewId = target.id || target.getAttribute('data-preview-id');
          
          if (entry.isIntersecting) {
            // 進入可視區域 - 載入預覽
            console.log('👁️ [LazyPreview] 進入可視區域:', previewId);
            
            // 取消待執行的釋放計時器
            if (revokeTimers.has(previewId)) {
              clearTimeout(revokeTimers.get(previewId));
              revokeTimers.delete(previewId);
            }
            
            loadPreview(target);
          } else {
            // 離開可視區域 - 延遲釋放
            console.log('👁️ [LazyPreview] 離開可視區域:', previewId);
            
            if (config.autoRevoke) {
              var timer = setTimeout(function() {
                unloadPreview(target);
                revokeTimers.delete(previewId);
              }, config.revokeDelay);
              
              revokeTimers.set(previewId, timer);
            }
          }
        });
      }, {
        rootMargin: config.rootMargin,
        threshold: config.threshold
      });

      console.log('✅ [LazyPreview] Observer 初始化成功');
      return observerInstance;
      
    } catch (error) {
      console.error('❌ [LazyPreview] Observer 初始化失敗:', error);
      return null;
    }
  }

  /**
   * 觀察預覽元素
   * @param {HTMLElement} element - 預覽元素
   */
  function observe(element) {
    if (!element) return;
    
    if (!observerInstance) {
      initObserver();
    }
    
    if (observerInstance) {
      observerInstance.observe(element);
      console.log('👁️ [LazyPreview] 開始觀察:', element.id);
    }
  }

  /**
   * 停止觀察預覽元素
   * @param {HTMLElement} element - 預覽元素
   */
  function unobserve(element) {
    if (!element || !observerInstance) return;
    
    observerInstance.unobserve(element);
    console.log('👁️ [LazyPreview] 停止觀察:', element.id);
  }

  /**
   * 載入預覽
   * @param {HTMLElement} element - 預覽元素
   */
  function loadPreview(element) {
    if (!element) return;
    
    var previewId = element.id || element.getAttribute('data-preview-id');
    
    // 已載入，跳過
    if (loadedPreviews.has(previewId)) {
      console.log('⏭️ [LazyPreview] 預覽已載入，跳過:', previewId);
      return;
    }

    try {
      // 取得檔案資訊（從 data 屬性）
      var fileData = element.getAttribute('data-file');
      if (!fileData) {
        console.warn('⚠️ [LazyPreview] 缺少檔案資訊:', previewId);
        return;
      }

      var file = JSON.parse(fileData);
      
      // 檢查是否為照片（影片維持輕量級圖標）
      var isImage = /^image\//i.test(file.type);
      if (!isImage) {
        console.log('⏭️ [LazyPreview] 影片維持輕量級預覽:', previewId);
        return;
      }

      // 創建 Blob URL
      // 🔥 使用 BlobURLManager
      var blobUrl = window.BlobURLManager ? 
        window.BlobURLManager.createObjectURL(file.blob || file, { 
          source: 'lazy-preview-loader',
          fileName: file.name 
        }) : URL.createObjectURL(file.blob || file);
      
      // 找到圖標容器並替換為實際圖片
      var iconContainer = element.querySelector('.photo-placeholder-icon, .video-placeholder-icon');
      if (iconContainer && iconContainer.parentNode) {
        var img = document.createElement('img');
        img.src = blobUrl;
        img.alt = file.name;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        
        // 圖片載入完成後替換
        img.onload = function() {
          iconContainer.parentNode.replaceChild(img, iconContainer);
          console.log('✅ [LazyPreview] 預覽已載入:', previewId);
        };
        
        img.onerror = function() {
          console.warn('⚠️ [LazyPreview] 預覽載入失敗:', previewId);
        };
      }
      
      // 記錄已載入
      loadedPreviews.set(previewId, {
        blobUrl: blobUrl,
        loadedAt: Date.now()
      });
      
    } catch (error) {
      console.error('❌ [LazyPreview] 載入預覽失敗:', error);
    }
  }

  /**
   * 卸載預覽（釋放記憶體）
   * @param {HTMLElement} element - 預覽元素
   */
  function unloadPreview(element) {
    if (!element) return;
    
    var previewId = element.id || element.getAttribute('data-preview-id');
    
    // 未載入，跳過
    if (!loadedPreviews.has(previewId)) {
      return;
    }

    try {
      var preview = loadedPreviews.get(previewId);
      
      // 釋放 Blob URL
      if (preview.blobUrl) {
        URL.revokeObjectURL(preview.blobUrl);
        console.log('🗑️ [LazyPreview] 已釋放 Blob URL:', previewId);
      }
      
      // 移除記錄
      loadedPreviews.delete(previewId);
      
      // 可選：將圖片替換回輕量級圖標（節省記憶體）
      var img = element.querySelector('img');
      if (img && img.parentNode) {
        var icon = document.createElement('div');
        icon.className = 'photo-placeholder-icon';
        icon.innerHTML = '<i class="fas fa-image"></i>';
        icon.style.cssText = 'font-size:48px;color:#94a3b8;';
        img.parentNode.replaceChild(icon, img);
      }
      
    } catch (error) {
      console.error('❌ [LazyPreview] 卸載預覽失敗:', error);
    }
  }

  /**
   * 銷毀 Observer 並清理所有資源
   */
  function destroy() {
    // 清理所有計時器
    revokeTimers.forEach(function(timer) {
      clearTimeout(timer);
    });
    revokeTimers.clear();
    
    // 釋放所有 Blob URL
    loadedPreviews.forEach(function(preview) {
      if (preview.blobUrl) {
        URL.revokeObjectURL(preview.blobUrl);
      }
    });
    loadedPreviews.clear();
    
    // 銷毀 Observer
    if (observerInstance) {
      observerInstance.disconnect();
      observerInstance = null;
    }
    
    console.log('🗑️ [LazyPreview] 已銷毀並清理所有資源');
  }

  // ==================== 導出模組 ====================
  
  var LazyPreviewLoader = {
    initObserver: initObserver,
    observe: observe,
    unobserve: unobserve,
    loadPreview: loadPreview,
    unloadPreview: unloadPreview,
    destroy: destroy,
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };

  // 掛載到全域
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LazyPreviewLoader;
  } else {
    global.LazyPreviewLoader = LazyPreviewLoader;
  }

  console.log('✅ LazyPreviewLoader 模組已載入');

})(typeof window !== 'undefined' ? window : this);

