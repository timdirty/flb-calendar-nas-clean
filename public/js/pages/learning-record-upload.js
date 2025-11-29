(function (global) {
  'use strict';

  var MOBILE_BREAKPOINT = 860;
  function detectMobileDevice() {
    try {
      var ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
      if (/Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua)) return true;
      if (typeof window !== 'undefined') {
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return true;
        var w = Math.min(window.innerWidth || 0, window.innerHeight || 0);
        if (w && w <= MOBILE_BREAKPOINT) return true;
      }
    } catch (e) {}
    return false;
  }
  var __IS_MOBILE_DEVICE = detectMobileDevice();
  function isMobileDevice() { return __IS_MOBILE_DEVICE; }
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', function () {
      __IS_MOBILE_DEVICE = detectMobileDevice();
      window.__IS_MOBILE_DEVICE = __IS_MOBILE_DEVICE;
    });
    window.__IS_MOBILE_DEVICE = __IS_MOBILE_DEVICE;
  }

  // ============================================
  // 🔥 全域錯誤攔截器（防止頁面崩潰/刷新）
  // ============================================
  (function setupGlobalErrorHandlers() {
    console.log('🛡️ [全域防護] 設置錯誤攔截器...');
    
    // 1. 攔截未捕獲的錯誤
    window.addEventListener('error', function(event) {
      // 🔥 過濾圖片/影片載入錯誤
      if (event.target && (event.target.tagName === 'IMG' || event.target.tagName === 'VIDEO')) {
        var src = event.target.src || '';
        
        // 🔥 過濾無效的 src（頁面 URL、HTML 文件等）
        var isInvalidSrc = !src || 
                          src === location.href || 
                          src.indexOf('.html') > -1 || 
                          src.indexOf('?') === 0 ||
                          src === 'about:blank';
        
        if (!isInvalidSrc) {
          console.warn('⚠️ [媒體載入] 格式不支援或載入失敗:', src);
        }
        
        event.preventDefault();
        return false;
      }
      
      // 🔥 過濾 undefined 或空錯誤
      const errorMsg = event.error?.message || event.message;
      if (!errorMsg || errorMsg === 'undefined' || errorMsg === 'null') {
        return false; // 忽略無意義的錯誤
      }
      
      console.error('❌ [全域錯誤]', errorMsg);
      console.error('❌ [錯誤堆疊]', event.error?.stack);
      
      // 防止錯誤傳播到瀏覽器（避免頁面刷新）
      event.preventDefault();
      event.stopPropagation();
      
      // 顯示友善提示
      if (typeof showToast === 'function') {
        showToast('發生錯誤：' + errorMsg, 'error');
      }
      
      return false; // 阻止預設行為
    }, true); // 使用捕獲階段，最早攔截
    
    // 2. 攔截未處理的 Promise 拒絕
    window.addEventListener('unhandledrejection', function(event) {
      console.error('❌ [未處理的 Promise 拒絕]', event.reason);
      
      // 防止錯誤傳播
      event.preventDefault();
      event.stopPropagation();
      
      // 顯示友善提示
      if (typeof showToast === 'function') {
        showToast('異步操作失敗：' + (event.reason && event.reason.message || event.reason || '未知錯誤'), 'error');
      }
      
      return false;
    });
    
    console.log('✅ [全域防護] 錯誤攔截器已啟動');
  })();

  // ============================================
  // 🔥 [簡化 2025-11-23] 已從源頭刪除 .thumb-loading 創建邏輯，不再需要禁用樣式

  // ============================================
  // 🔥 版本檢測與自動清除緩存（解決手機緩存問題）
  // ============================================
  (function checkVersionAndClearCache() {
    var CURRENT_VERSION = '20251107-memory-optimized';
    var STORAGE_KEY = 'app_version';

    
    // ==================== 🧠 記憶體壓力檢測工具 ====================
    function checkMemoryPressure() {
      try {
        if (!performance || !performance.memory) {
          console.warn('⚠️ performance.memory API 不可用，跳過記憶體檢測');
          return { level: 'unknown', ratio: 0, available: 0, used: 0, limit: 0 };
        }
        var used = performance.memory.usedJSHeapSize;
        var limit = performance.memory.jsHeapSizeLimit;
        var ratio = used / limit;
        var available = limit - used;
        
        var level = 'normal';
        if (ratio > 0.95) level = 'critical';
        else if (ratio > 0.85) level = 'high';
        else if (ratio > 0.70) level = 'medium';
        
        console.log('🧠 記憶體狀態:', {
          level: level,
          ratio: (ratio * 100).toFixed(1) + '%',
          used: (used / 1024 / 1024).toFixed(1) + ' MB',
          limit: (limit / 1024 / 1024).toFixed(1) + ' MB',
          available: (available / 1024 / 1024).toFixed(1) + ' MB'
        });
        
        return { level: level, ratio: ratio, available: available, used: used, limit: limit };
      } catch (e) {
        console.warn('⚠️ 記憶體檢測失敗:', e);
        return { level: 'unknown', ratio: 0, available: 0, used: 0, limit: 0 };
      }
    }
    
    // ==================== 🧹 緊急記憶體清理函數 ====================
    function emergencyMemoryCleanup() {
      console.log('🚨 執行緊急記憶體清理...');
      var cleaned = { blobs: 0, canvas: 0, videos: 0, listeners: 0 };
      
      try {
        // 1. 清理所有 Blob URLs（包含隱藏元素）
        var allElements = document.querySelectorAll('img[src^="blob:"], video[src^="blob:"], source[src^="blob:"], [data-object-url^="blob:"]');
        allElements.forEach(function(el) {
          try {
            var blobUrl = el.src || el.getAttribute('data-object-url');
            if (blobUrl && blobUrl.indexOf('blob:') === 0) {
              URL.revokeObjectURL(blobUrl);
              cleaned.blobs++;
              if (el.src) el.src = '';
              if (el.hasAttribute('data-object-url')) el.removeAttribute('data-object-url');
            }
          } catch (e) {}
        });
        
        // 2. 清理所有 Canvas 元素
        var allCanvas = document.querySelectorAll('canvas');
        allCanvas.forEach(function(canvas) {
          try {
            var ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            canvas.width = 1;
            canvas.height = 1;
            cleaned.canvas++;
          } catch (e) {}
        });
        
        // 3. 清理所有 Video 元素並移除事件監聽器
        var allVideos = document.querySelectorAll('video');
        allVideos.forEach(function(video) {
          try {
            video.pause();
            video.src = '';
            video.load();
            // 移除常見事件監聽器
            var events = ['loadedmetadata', 'loadeddata', 'seeked', 'error', 'canplay'];
            events.forEach(function(evt) {
              try {
                // 克隆節點以移除所有監聽器
                var clone = video.cloneNode(false);
                if (video.parentNode) {
                  video.parentNode.replaceChild(clone, video);
                  cleaned.listeners++;
                }
              } catch (e) {}
            });
            cleaned.videos++;
          } catch (e) {}
        });
        
        // 4. 清空全域變數快取
        if (window.__videoThumbnailReadyCache) window.__videoThumbnailReadyCache = {};
        if (window.__videoPosterCache) window.__videoPosterCache = {};
        if (window.__thumbReadyCache) window.__thumbReadyCache = {};
        if (window.LearningUploadBlobURL) {
          try {
            if (typeof window.LearningUploadBlobURL.cleanup === 'function') {
              window.LearningUploadBlobURL.cleanup();
            }
          } catch (e) {}
        }
        
        console.log('✅ 緊急清理完成:', cleaned);
        return cleaned;
      } catch (error) {
        console.error('❌ 緊急清理失敗:', error);
        return cleaned;
      }
    }
    
    try {
      // ==================== 檢查記憶體狀態 ====================
      var memStatus = checkMemoryPressure();
      
      // 如果記憶體壓力過高，執行緊急清理
      if (memStatus.level === 'critical' || memStatus.level === 'high') {
        console.warn('⚠️ 檢測到記憶體壓力過高 (' + memStatus.level + ')，執行緊急清理');
        emergencyMemoryCleanup();
        
        // 清理後再次檢測
        setTimeout(function() {
          var afterClean = checkMemoryPressure();
          console.log('🔄 清理後記憶體狀態:', afterClean.level, '(' + (afterClean.ratio * 100).toFixed(1) + '%)');
        }, 100);
      }
      
      // ==================== 版本檢測與清理 ====================
      var storedVersion = localStorage.getItem(STORAGE_KEY);
      
      // 如果版本不同，強制清除所有緩存
      if (storedVersion !== CURRENT_VERSION) {
        console.log('🔄 偵測到新版本:', CURRENT_VERSION, '(舊版本:', storedVersion || '無', ')');
        console.log('🧹 自動清除緩存中...');
        
        // 先執行緊急清理
        emergencyMemoryCleanup();
        
        // 1. 清除 localStorage（除了當前版本標記）
        var keysToRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key !== STORAGE_KEY) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(function(key) {
          localStorage.removeItem(key);
        });
        
        // 2. 清除 sessionStorage
        sessionStorage.clear();
        
        // 3. 清除 cookies
        document.cookie.split(";").forEach(function(c) { 
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        
        // 4. 清除 Service Worker 緩存
        if ('caches' in window) {
          caches.keys().then(function(names) {
            names.forEach(function(name) {
              caches.delete(name);
            });
          });
        }
        
        // 5. 更新版本號
        localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
        
        console.log('✅ 緩存已清除，即將重新載入頁面...');
        
        // 6. 強制重新載入（繞過緩存）
        setTimeout(function() {
          window.location.reload(true);
        }, 500);
        
        // 阻止腳本繼續執行
        return;
      } else {
        console.log('✅ 版本檢查通過:', CURRENT_VERSION);
      }
      
      // ==================== 設置全域錯誤邊界 ====================
      window.addEventListener('error', function(event) {
        // 檢測 OOM 錯誤
        if (event.message && (
          event.message.indexOf('out of memory') !== -1 ||
          event.message.indexOf('memory') !== -1 && event.message.indexOf('exceeded') !== -1
        )) {
          console.error('🚨 檢測到記憶體溢出錯誤，執行緊急清理');
          emergencyMemoryCleanup();
          
          // 顯示友善提示
          if (typeof window.showToast === 'function') {
            window.showToast('檔案太多或太大，請減少選擇或分批上傳', 'error');
          } else {
            alert('⚠️ 裝置記憶體不足\n\n建議：\n1. 減少一次選擇的檔案數量\n2. 分批上傳大檔案\n3. 關閉其他瀏覽器分頁');
          }
        }
      });
      
      // 暴露緊急清理函數給全域使用
      window.__emergencyMemoryCleanup = emergencyMemoryCleanup;
      window.__checkMemoryPressure = checkMemoryPressure;
      
    } catch (error) {
      console.error('❌ 版本檢查失敗:', error);
      // 即使檢查失敗，也繼續執行，不影響功能
    }
  })();

  // ============================================
  // 📦 整合新模組系統（向後兼容）
  // ============================================
  var State = global.LearningUploadState;
  var Config = global.LearningUploadConfig;
  var Constants = global.LearningUploadConstants;
  var DOM = global.LearningUploadDOM;
  var BlobURL = global.LearningUploadBlobURL;
  var Attendance = global.LearningUploadAttendance;
  var CourseManager = global.LearningUploadCourseManager;
  var StudentManager = global.LearningUploadStudentManager;
  var RetryManager = global.LearningUploadRetryManager;
  var UploadQueue = global.LearningUploadQueue;
  var MediaCache = global.LearningUploadMediaCache;
  var PosterManager = global.LearningUploadPosterManager;

  // 🧭 Synology Drive 路徑監控：記錄每次上傳的 metadata 與推算結果
  var DrivePathDebugMonitor = (function () {
    var MAX_ENTRIES = 200;
    var buffer = [];

    function push(entry) {
      buffer.push(entry);
      if (buffer.length > MAX_ENTRIES) {
        buffer.shift();
      }
    }

    function record(stage, payload) {
      try {
        var entry = {
          stage: stage || 'unknown',
          timestamp: new Date().toISOString(),
          payload: payload || {}
        };
        push(entry);
        if (window.__FLB_DEBUG_DRIVE_PATH === true) {
          console.log('🧭 [DrivePathDebug]', entry);
        }
      } catch (err) {
        console.warn('⚠️ [DrivePathDebug] 無法記錄:', err);
      }
    }

    function exportLogs() {
      return buffer.slice();
    }

    var api = { record: record, exportLogs: exportLogs };
    try {
      window.__drivePathDebug = window.__drivePathDebug || {};
      window.__drivePathDebug.monitor = api;
      window.__drivePathDebug.entries = buffer;
    } catch (e) {}
    return api;
  })();

  // 狀態與常量（向後兼容的全域變數）
  var currentCourse = null;
  var studentFiles = {};
  var OVERVIEW_UPLOAD_INDEX = -101;
  var overviewUploadEntry = null;
  if (typeof window !== 'undefined') {
    window.overviewPhotosFiles = window.overviewPhotosFiles || [];
    window.overviewVideosFiles = window.overviewVideosFiles || [];
  }
  var allCourses = [];
  var highlightedCourseId = null;
  var courseFiltersMeta = {};
  var currentFilterDateOverride = null;
  var currentUser = null;
  var currentTeacher = null;
  var urlInstructor = null;
  var activeFilters = { instructor: '', courseType: '', studentQuery: '' };
  var USE_GLOBAL_PROGRESS_TOAST = false; // ✅ 僅透過卡片顯示進度，關閉底部進度條
  var ENABLE_FLOATING_PROGRESS_INDICATOR = false; // ✅ 關閉底部浮動進度條，改由每個檔案顯示
  // 背景上傳中心預設不自動打開（使用者需要時再點開）
  var AUTO_OPEN_UPLOAD_CENTER = false;
  // 🗓️ 星期篩選：一(1)~日(7)，空集合＝不過濾
  var activeWeekdays = new Set();
  var allStudentsGlobal = [];
  var autoUploadTimers = {};
  var uploadingStudents = {};
  var uploadRetryCount = {}; // 🔒 記錄每位學生的上傳重試次數
  var MAX_UPLOAD_RETRIES = 3; // 🔒 上傳失敗最大重試次數
  var AUTO_REFRESH_AFTER_UPLOAD = false; // 🔁 預設僅使用本地快取，不在每次上傳後強制重抓
  var currentSwipeDetach = null;
  var topTabsStickyObserver = null;
  var previewOverlayEl = null;
  var previewOverlayBody = null;
  var currentOverlayUrl = null;
  var pendingOverlayRevokes = new Set();
  var PendingMediaActions = {
    updateState: function(tempId, state, text) {
      if (!tempId) return;
      if (window.PendingMediaStore) {
        PendingMediaStore.update(tempId, { state: state, updatedAt: Date.now(), statusText: text });
      }
      // 🔥 [修復 2025-11-16] 嘗試多種方式查找節點，避免找不到
      var preview = document.querySelector('.file-preview[data-temp-id="' + tempId + '"]');
      
      if (!preview) {
        // 嘗試通過 media-id 查找（如果已經設置）
        preview = document.querySelector('.file-preview[data-media-id="' + tempId + '"]');
      }
      
      if (!preview && window.PendingMediaStore) {
        // 🔥 嘗試通過 PendingMediaStore 查找文件名，再通過文件名匹配節點
        var storeData = PendingMediaStore.get(tempId);
        if (storeData && storeData.fileName) {
          var allPreviews = document.querySelectorAll('.file-preview[data-file-name]');
          for (var i = 0; i < allPreviews.length; i++) {
            if (allPreviews[i].getAttribute('data-file-name') === storeData.fileName) {
              preview = allPreviews[i];
              // 補設 data-temp-id
              preview.setAttribute('data-temp-id', tempId);
              console.log('🔧 [降級查找] 通過文件名找到節點並補設 data-temp-id:', {
                tempId: tempId,
                fileName: storeData.fileName
              });
              break;
            }
          }
        }
      }
      
      if (!preview) {
        console.warn('⚠️ [PendingMediaActions] 無法找到預覽節點:', {
          tempId: tempId,
          嘗試選擇器: [
            '.file-preview[data-temp-id="' + tempId + '"]',
            '.file-preview[data-media-id="' + tempId + '"]',
            '通過文件名降級查找'
          ],
          當前DOM中所有tempId: Array.from(document.querySelectorAll('.file-preview[data-temp-id]')).map(function(n) { return n.getAttribute('data-temp-id'); }).slice(0, 5)
        });
        return;
      }
      
      console.log('✅ [PendingMediaActions] 找到預覽節點:', {
        tempId: tempId,
        state: state,
        節點類名: preview.className
      });
      // 🔥 [修復 2025-11-23] 只在需要顯示進度時才創建 overlay
      // synced/failed 狀態不需要 overlay，避免短暫顯示「已完成」標籤
      var overlayHelpers = null;
      if (state !== 'synced' && state !== 'failed') {
        overlayHelpers = ensureFilePreviewOverlay(preview);
      }
      try { PendingMediaActions.stopSim(tempId); } catch (e) {}
      preview.setAttribute('data-pending-state', state);
      
      // 🔥 [修復 2025-11-16] 如果已經是 synced 狀態，不要重複處理，避免類被反復移除
      // 但是要確保第一次處理時也能正確設置狀態
      if (state === 'synced' && preview.classList.contains('synced-preview') && preview.getAttribute('data-synced') === '1') {
        console.log('⏭️ [跳過] 節點已處於 synced 狀態:', tempId);
        return;
      }
      
      preview.classList.remove('pending', 'uploading', 'upload-error', 'upload-success');
      if (state === 'synced') {
        preview.classList.add('upload-success');
        setPreviewProgress(preview, 100);
        // 🔥 [修復 2025-11-23] 移除 loading 類，避免 CSS 強制顯示 overlay
        preview.classList.remove('new-upload', 'loading');
        // 🔥 [修復 2025-11-16] 個別照片上傳完畢立即移除 hover-disabled 並釋放記憶體
        preview.classList.remove('hover-disabled');
        preview.classList.add('existing', 'synced-preview');
        preview.setAttribute('data-awaiting-sync', '1');
        preview.setAttribute('data-synced', '1'); // 立即標記為已同步
        
        // 🔥 [修復 2025-11-23] 再次確保移除 loading 類（防止時序問題）
        preview.classList.remove('loading', 'new-upload', 'pending', 'uploading');
        
        // 🐛 [診斷 2025-11-16] 輸出節點狀態，確認類正確添加
        console.log('✅ [updateState] 節點已標記為 synced:', {
          tempId: tempId,
          classes: preview.className,
          hasUploadSuccess: preview.classList.contains('upload-success'),
          hasSyncedPreview: preview.classList.contains('synced-preview'),
          hasExisting: preview.classList.contains('existing'),
          hasLoading: preview.classList.contains('loading')
        });
        
        // 🔥 [修復 2025-11-16] 直接為刪除按鈕添加內聯樣式，強制禁用 hover 效果
        var removeBtn = preview.querySelector('.remove-btn');
        if (removeBtn) {
          removeBtn.setAttribute('data-hover-disabled', 'true');
          console.log('✅ [updateState] 已為刪除按鈕禁用 hover 效果');
        }
        
        // 🔥 [修復 2025-11-23] 直接移除 overlay，確保不會顯示「已同步」標籤
        // 即使 overlayHelpers 是 null，也要檢查是否有遺留的 overlay 需要移除
        var existingOverlay = preview.querySelector('.file-uploading-overlay');
        if (existingOverlay) {
          try {
            // 直接從 DOM 移除 overlay 元素
            if (existingOverlay.parentNode) {
              existingOverlay.parentNode.removeChild(existingOverlay);
              console.log('✅ [updateState] overlay 已完全移除');
            }
          } catch (err) {
            // 降級方案：隱藏 overlay
            existingOverlay.style.opacity = '0';
            existingOverlay.style.pointerEvents = 'none';
            existingOverlay.style.display = 'none';
            console.log('✅ [updateState] overlay 已隱藏（降級方案）');
          }
        }
        
        // 🔥 [修復 2025-11-16] 強制重新應用 CSS 規則，解決第一個項目 hover 效果不被移除的問題
        // 使用更激進的方式強制瀏覽器重新計算樣式
        // 1. 先強制重排
        void preview.offsetHeight;
        
        // 🧧 釋放記憶體：移除不再需要的暫存資料
        try {
          // 🔥 [修復 2025-11-16] 先將預覽 src 切換為伺服器 URL，再釋放 Blob URL
          // 這樣可以避免 "媒體載入失敗" 警告
          if (window.PendingMediaStore) {
            var storeData = PendingMediaStore.get(tempId);
            if (storeData && storeData.proxyUrl) {
              var mediaEl = preview.querySelector('img, video');
              if (mediaEl) {
                // 先保存舊的 src（可能是 blob URL）
                var oldSrc = mediaEl.src;
                var isBlob = oldSrc && oldSrc.startsWith('blob:');
                
                // 先清除 onerror 避免觸發全域錯誤處理器
                var oldOnerror = mediaEl.onerror;
                mediaEl.onerror = null;
                
                // 🔥 確保新的 URL 有效後再更新
                if (storeData.proxyUrl && !storeData.proxyUrl.startsWith('blob:')) {
                  // 更新 src 為伺服器 URL
                  mediaEl.src = storeData.proxyUrl;
                  // 🔥 [修復 2025-11-17] 同步更新 preview 元素的 data-preview-url 屬性
                  preview.setAttribute('data-preview-url', storeData.proxyUrl);
                  preview.setAttribute('data-object-url', storeData.proxyUrl);
                  
                  console.log('✅ [記憶體釋放] 已切換預覽 URL:', {
                    from: isBlob ? 'blob' : 'other',
                    to: storeData.proxyUrl.substring(0, 50) + '...'
                  });
                  
                  // 在延遲後釋放 blob URL，確保圖片已經載入
                  if (isBlob) {
                    setTimeout(function() {
                      try {
                        URL.revokeObjectURL(oldSrc);
                        console.log('🗑️ Blob URL 已釋放:', oldSrc);
                      } catch (e) {}
                    }, 500);
                  }
                }
                
                // 恢復 onerror（如果需要）
                setTimeout(function() {
                  if (oldOnerror) mediaEl.onerror = oldOnerror;
                }, 100);
              }
            }
          }
          
          // 🔥 [修復 2025-11-23] 移除 overlay，再進行克隆
          var overlayNode = preview.querySelector('.file-uploading-overlay');
          if (overlayNode && overlayNode.parentNode) {
            try {
              overlayNode.parentNode.removeChild(overlayNode);
              console.log('🗑️ [克隆前] overlay 已移除');
            } catch (err) {
              // 降級方案：隱藏
              overlayNode.style.display = 'none';
            }
          }
          
          // 🔥 [修復 2025-11-16] 對前兩個元素使用克隆方式徹底重建 DOM
          var parent = preview.parentNode;
          if (parent) {
            var siblings = Array.prototype.slice.call(parent.children);
            var nodeIndex = siblings.indexOf(preview);
            if (nodeIndex >= 0 && nodeIndex <= 1) {
              console.log('🔧 [特殊處理] 第', nodeIndex + 1, '個元素，使用克隆方式完全重建');
              
              // 克隆節點（此時 overlay 已隱藏、src 已更新）
              var clone = preview.cloneNode(true);
              
              // 🔥 [修復 2025-11-17] 確保克隆節點有正確的 data-preview-url
              if (window.PendingMediaStore) {
                var storeData = PendingMediaStore.get(tempId);
                if (storeData && storeData.proxyUrl && !storeData.proxyUrl.startsWith('blob:')) {
                  clone.setAttribute('data-preview-url', storeData.proxyUrl);
                  clone.setAttribute('data-object-url', storeData.proxyUrl);
                  console.log('🔧 [克隆節點] 已設置正確的 data-preview-url');
                }
              }
              
              // 確保類別正確
              clone.classList.remove('hover-disabled', 'pending', 'uploading');
              clone.classList.add('upload-success', 'existing', 'synced-preview');
              
              // 🔥 [修復 2025-11-16] 為克隆節點的刪除按鈕禁用 hover 效果
              var cloneRemoveBtn = clone.querySelector('.remove-btn');
              if (cloneRemoveBtn) {
                cloneRemoveBtn.setAttribute('data-hover-disabled', 'true');
                // 🔥 [修復 2025-11-17] 重新綁定刪除按鈕事件（克隆不會保留 onclick）
                ensureDeleteButtonWorks(clone);
              }
              
              // 替換節點
              parent.replaceChild(clone, preview);
              preview = clone;
              
              // 強制重排
              void parent.offsetHeight;
            }
          }
          
          // 再次確認移除 overlay（針對克隆後的節點）
          var finalOverlay = preview.querySelector('.file-uploading-overlay');
          if (finalOverlay && finalOverlay.parentNode) {
            try {
              finalOverlay.parentNode.removeChild(finalOverlay);
              console.log('🗑️ [克隆後] overlay 已移除');
            } catch (err) {
              // 降級方案：隱藏
              finalOverlay.style.display = 'none';
            }
          }
          
          // 🔥 [修復 2025-11-16] 不要立即移除 data-temp-id，改為添加穩定標識符
          // 這樣即使之後再次調用 updateState，也能找到節點
          preview.setAttribute('data-media-id', tempId);
          preview.setAttribute('data-synced', '1');
          
          // 🔥 [修復 2025-11-17] 確保刪除按鈕事件持續有效
          ensureDeleteButtonWorks(preview);
          
          // 延遲移除 data-temp-id，確保所有相關操作都完成
          setTimeout(function() {
            if (preview && preview.parentNode) {
              preview.removeAttribute('data-temp-id');
            }
          }, 1000);
          
          // 🔥 不要在這裡立即釋放 Blob URL，已經在上面處理了
          // revokePreviewObjectUrl(preview);
        } catch (e) {
          console.warn('⚠️ 釋放記憶體失敗:', e);
        }
      } else if (state === 'failed') {
        preview.classList.add('upload-error');
      } else if (state === 'uploading') {
        preview.classList.add('uploading');
        // 啟動 UI 模擬（避免沒有進度事件時長時間卡在 0）
        try { PendingMediaActions.startSim(tempId, 95); } catch (e) {}
      } else {
        preview.classList.add('pending');
      }
      // 🔥 [修復 2025-11-23] 只在非 synced/failed 狀態才設置進度文字
      // synced/failed 狀態的 overlay 已被移除，不需要設置文字
      if (state !== 'synced' && state !== 'failed') {
        if (!text) {
          if (state === 'processing') text = '壓縮中…';
          else if (state === 'ready') text = '等待上傳';
          else if (state === 'uploading') text = '上傳中…';
        }
        if (text && overlayHelpers && overlayHelpers.progressText) {
          overlayHelpers.progressText.textContent = text;
        }
        // 確保 overlay 可見
        try {
          var ov = preview.querySelector('.file-uploading-overlay');
          if (ov) {
            ov.style.display = 'flex';
            ov.style.opacity = '1';
            ov.style.pointerEvents = 'auto';
          }
        } catch (e) {}
      }
      if (state === 'queued') {
        setPreviewProgress(preview, 3);
      } else if (state === 'processing') {
        setPreviewProgress(preview, 12);
      } else if (state === 'ready') {
        setPreviewProgress(preview, 18);
      } else if (state === 'synced' || state === 'failed') {
        try { PendingMediaActions.stopSim(tempId); } catch (e) {}
      }
    },
    updateProgress: function(tempId, percent, label) {
      var preview = document.querySelector('.file-preview[data-temp-id="' + tempId + '"]');
      if (!preview) return;
      ensureFilePreviewOverlay(preview);
      var bounded = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
      var last = Number(preview.getAttribute('data-last-progress') || '0');
      if (bounded === 100 && last <= 1) {
        animatePreviewProgress(preview, 0, 100, 800);
      } else if (bounded - last >= 15 && bounded < 100) {
        animatePreviewProgress(preview, last, bounded, 600);
      } else {
        setPreviewProgress(preview, bounded);
      }
      if (label) {
        var overlayHelpers = ensureFilePreviewOverlay(preview);
        if (overlayHelpers && overlayHelpers.progressText) {
          overlayHelpers.progressText.textContent = label;
        } else {
          var progressText = preview.querySelector('.progress-text');
          if (progressText) progressText.textContent = label;
        }
      }
      // 強制顯示覆蓋層
      try {
        var ov = preview.querySelector('.file-uploading-overlay');
        if (ov) {
          ov.style.display = 'flex';
          ov.style.opacity = '1';
          ov.style.pointerEvents = 'auto';
        }
      } catch (e) {}
    },
    startSim: function(tempId, maxPct) {
      try {
        if (!tempId) return;
        this.__simTimers = this.__simTimers || {};
        if (this.__simTimers[tempId]) return;
        var self = this;
        this.__simTimers[tempId] = setInterval(function(){
          var preview = document.querySelector('.file-preview[data-temp-id="' + tempId + '"]');
          if (!preview) { self.stopSim(tempId); return; }
          var last = Number(preview.getAttribute('data-last-progress') || "0");
          var cap = Math.max(50, Math.min(95, Number(maxPct) || 95));
          if (last >= cap) return;
          var next = Math.min(cap, last + 1);
          setPreviewProgress(preview, next);
          var txt = preview.querySelector('.progress-text');
          if (txt && (!txt.textContent || /等待上傳|排隊中/.test(txt.textContent))) { txt.textContent = "上傳中… " + next + "%"; }
        }, 300);
      } catch (e) {}
    },
    stopSim: function(tempId) {
      try { if (this.__simTimers && this.__simTimers[tempId]) { clearInterval(this.__simTimers[tempId]); delete this.__simTimers[tempId]; } } catch (e) {}
    },
    remove: function(tempId) {
      if (!tempId) return;
      if (window.PendingMediaStore) {
        PendingMediaStore.remove(tempId);
      }
      var preview = document.querySelector('.file-preview[data-temp-id="' + tempId + '"]');
      if (preview) {
        revokePreviewObjectUrl(preview);
        try { preview.remove(); } catch (e) {}
      }
    }
  };
  window.PendingMediaActions = PendingMediaActions;

  var CommentSyncManager = (function() {
    var hydrationQueue = {};

    function getTextarea(index) {
      return document.getElementById('comment-' + index);
    }

    function ensureEntry(index) {
      if (typeof index !== 'number') return null;
      ensureStudentFileEntry(index, currentCourse && currentCourse.students ? currentCourse.students[index] : {});
      var base = studentFiles[index];
      base.existingCounts = base.existingCounts || { photos: 0, videos: 0, text: 0 };
      return base;
    }

    function updateIndicators(index, value) {
      var len = String(value || '').length;
      var charsEl = document.getElementById('comment-chars-' + index);
      if (charsEl) charsEl.textContent = String(len);
      var countEl = document.getElementById('comment-count-' + index);
      if (countEl) countEl.textContent = String(len);
      try { updateIndicator(index, 'comment', len >= 1); } catch (e) {}
      try { updateCapsule(index); } catch (e) {}
      var base = studentFiles[index];
      if (base && base.existingCounts) {
        base.existingCounts.text = len;
      }
    }

    function persistDraft(index) {
      try {
        if (!(window.FLB && FLB.State)) return;
        var st = FLB.State.get();
        var drafts = Object.assign({}, st.drafts || {});
        drafts[String(index)] = Object.assign({}, drafts[String(index)] || {}, {
          comment: studentFiles[index].comment || '',
          photos: studentFiles[index].photos || [],
          videos: studentFiles[index].videos || []
        });
        FLB.State.set({ drafts: drafts });
      } catch (e) {}
    }

    function handleInput(index, value, options) {
      var base = ensureEntry(index);
      if (!base) return;
      base.comment = value;
      try { delete lastSubmittedSnapshot[index]; } catch (e) {}
      updateIndicators(index, value);
      resetUploadRetryState(index);
      if (!(options && options.skipDraft)) {
        persistDraft(index);
      }
      try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}
    }

    function flashSaved(textarea) {
      if (!textarea) return;
      textarea.classList.add('comment-saved-flash');
      setTimeout(function() {
        textarea.classList.remove('comment-saved-flash');
      }, 2000);
    }

    function handleBlur(index) {
      var textarea = getTextarea(index);
      var value = textarea ? (textarea.value || '') : (studentFiles[index] && studentFiles[index].comment) || '';
      handleInput(index, value, { skipDraft: false });
      if (hasPendingChanges(index)) {
        flashSaved(textarea);
      }
      if (value && value.trim().length >= 5) {
        try {
          lastCommentTemplate = value;
          refreshSuggestionChipsAll();
        } catch (e) {}
      }
      checkUploadReady(index);
      try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}
      try { if (typeof renderBottomTabs === 'function') renderBottomTabs(); } catch (e) {}
    }

    function handleKeyDown(index, evt) {
      if (evt && evt.key === 'Enter') {
        setTimeout(function() {
          handleBlur(index);
        }, 0);
      }
    }

    function bind(index) {
      var textarea = getTextarea(index);
      if (!textarea) return;
      if (textarea.dataset.commentBound === '1') return;
      textarea.dataset.commentBound = '1';
      textarea.addEventListener('input', function (e) {
        handleInput(index, e.target.value || '', { skipDraft: false });
      });
      textarea.addEventListener('blur', function () {
        handleBlur(index);
      });
      textarea.addEventListener('keydown', function (evt) {
        handleKeyDown(index, evt);
      });
      updateIndicators(index, textarea.value || (studentFiles[index] && studentFiles[index].comment) || '');
    }

    function hydrate(index, value, opts) {
      var base = ensureEntry(index);
      if (!base) return false;
      if (typeof value === 'string') {
        base.comment = value;
      }
      var target = (typeof value === 'string') ? value : base.comment || '';
      var textarea = getTextarea(index);
      if (textarea) {
        if (textarea.value !== target) {
          textarea.value = target;
        }
        updateIndicators(index, target);
        delete hydrationQueue[index];
        bind(index);
        return true;
      }
      var attempts = (hydrationQueue[index] && hydrationQueue[index].attempts) || 0;
      var maxAttempts = (opts && opts.maxAttempts) || 8;
      if (attempts >= maxAttempts) {
        delete hydrationQueue[index];
        return false;
      }
      hydrationQueue[index] = { attempts: attempts + 1, value: target };
      setTimeout(function () {
        hydrate(index, target, opts);
      }, (opts && opts.delay) || 140);
      return false;
    }

    function markSynced(index, value) {
      // 增加嘗試次數，避免慢速裝置 DOM 尚未就緒時回填失敗
      hydrate(index, value, { maxAttempts: 12, delay: 120 });
    }

    return {
      bind: bind,
      hydrate: hydrate,
      markSynced: markSynced,
      handleInput: handleInput
    };
  })();
  window.CommentSyncManager = CommentSyncManager;

  function ensureFilePreviewOverlay(preview) {
    if (!preview) return null;
    var overlay = preview.querySelector('.file-uploading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'file-uploading-overlay';
      preview.appendChild(overlay);
    }
    var progressText = overlay.querySelector('.progress-text');
    if (!progressText) {
      progressText = document.createElement('span');
      progressText.className = 'progress-text';
      progressText.textContent = '等待上傳';
      overlay.insertBefore(progressText, overlay.firstChild);
    }
    var progressBar = overlay.querySelector('.file-upload-progress');
    var progressFill = null;
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'file-upload-progress';
      overlay.appendChild(progressBar);
    }
    progressFill = progressBar.querySelector('.file-upload-progress-fill');
    if (!progressFill) {
      progressFill = document.createElement('div');
      progressFill.className = 'file-upload-progress-fill';
      progressBar.appendChild(progressFill);
    }
    return {
      overlay: overlay,
      progressText: progressText,
      progressBar: progressBar,
      progressFill: progressFill
    };
  }

  function buildUploadCenterMetaPayload(task, overrideName) {
    var baseMeta = (task && task.meta) || {};
    var payload = {
      tempId: baseMeta.tempId,
      entryIndex: typeof baseMeta.entryIndex === 'number' ? baseMeta.entryIndex : null,
      mediaType: task ? task.type : '',
      fileName: overrideName || (task && task.file && task.file.name) || '',
      isOverview: task ? task.studentIndex === OVERVIEW_UPLOAD_INDEX : false,
      studentName: getStudentNameByIndex(task ? task.studentIndex : null) || baseMeta.studentName || ''
    };
    try {
      if (baseMeta.statusText) payload.statusText = baseMeta.statusText;
    } catch (e) {}
    var previewUrl = '';
    var thumbUrl = baseMeta.thumbUrl || '';
    try {
      if (baseMeta.objectUrl) {
        previewUrl = baseMeta.objectUrl;
      } else if (baseMeta.tempId && window.PendingMediaStore && typeof PendingMediaStore.get === 'function') {
        var pendingEntry = PendingMediaStore.get(baseMeta.tempId);
        if (pendingEntry) {
          previewUrl = pendingEntry.objectUrl || pendingEntry.previewUrl || pendingEntry.proxyUrl || '';
          if (!thumbUrl && pendingEntry.thumbnailUrl) thumbUrl = pendingEntry.thumbnailUrl;
          if (!payload.studentName && pendingEntry.studentName) payload.studentName = pendingEntry.studentName;
          if (!payload.mediaType && pendingEntry.type) payload.mediaType = pendingEntry.type;
        }
      }
    } catch (e) {}
    if (!previewUrl && baseMeta.previewUrl) previewUrl = baseMeta.previewUrl;
    if (!thumbUrl && baseMeta.proxyUrl && payload.mediaType === 'photos') thumbUrl = baseMeta.proxyUrl;
    if (thumbUrl) payload.thumbUrl = thumbUrl;
    if (previewUrl) payload.previewUrl = previewUrl;
    if (baseMeta.proxyUrl) payload.proxyUrl = baseMeta.proxyUrl;
    payload.previewType = baseMeta.previewType || (task && task.type === 'videos' ? 'video' : 'image');
    try {
      payload.courseKey = getCourseCacheKey(currentCourse);
    } catch (e) {
      payload.courseKey = null;
    }
    return payload;
  }

  var MediaUploadController = (function(){
    var queue = [];
    var active = { photos: 0, videos: 0 };
    var limits = computeConcurrencyLimits();

    function computeConcurrencyLimits() {
      try {
        var mem = checkMemoryPressure && checkMemoryPressure();
        var level = mem && mem.level ? mem.level : 'normal';
        var mobile = typeof isMobileDevice === 'function' ? isMobileDevice() : false;
        if (level === 'critical') return { photos: 1, videos: 1 };
        if (level === 'high' || mobile) return { photos: 1, videos: 1 };
        if (level === 'medium') return { photos: 2, videos: 1 };
        return { photos: 3, videos: 1 };
      } catch (e) {
        return { photos: 2, videos: 1 };
      }
    }

    function refreshLimits() {
      limits = computeConcurrencyLimits();
    }

    function enqueue(task) {
      if (!task || !task.file || !task.meta) return;
      queue.push(task);
      try {
        if (typeof UploadCenter !== 'undefined' && UploadCenter && typeof UploadCenter.add === 'function') {
          var idxForTask = (typeof task.meta.entryIndex === 'number') ? task.meta.entryIndex : 0;
          var displayName = (task.file && task.file.name) || '';
          UploadCenter.add(
            task.studentIndex,
            (task.type === 'videos' ? 'videos' : 'photos'),
            idxForTask,
            displayName,
            null,
            {
              initialStatus: 'queued',
              statusOnReuse: 'queued',
              resetProgressOnReuse: true,
              meta: buildUploadCenterMetaPayload(task, displayName)
            }
          );
        }
      } catch (_) {}
      processQueue();
    }

    function processQueue() {
      refreshLimits();
      if (!queue.length) return;
      queue.sort(function(a, b) {
        var sizeA = a.file ? a.file.size : 0;
        var sizeB = b.file ? b.file.size : 0;
        return sizeA - sizeB;
      });
      for (var i = 0; i < queue.length; i++) {
        var task = queue[i];
        if (canStart(task)) {
          queue.splice(i, 1);
          startTask(task);
          i--;
        }
      }
    }

    function canStart(task) {
      var key = task.type === 'videos' ? 'videos' : 'photos';
      return active[key] < (limits[key] || 1);
    }

    async function startTask(task) {
      var key = task.type === 'videos' ? 'videos' : 'photos';
      active[key] = (active[key] || 0) + 1;
      try {
        await uploadSingleMedia(task);
      } catch (err) {
        console.error('❌ [MediaUploadController] 單檔上傳失敗:', err);
      } finally {
        active[key] = Math.max(0, (active[key] || 1) - 1);
        processQueue();
      }
    }

    async function uploadSingleMedia(task) {
      var studentIndex = task.studentIndex;
      var file = task.file;
      var meta = task.meta;
      if (!file || !meta) return;
      var isOverviewUpload = studentIndex === OVERVIEW_UPLOAD_INDEX;
      try { primeStudentUploadPreview(studentIndex); } catch (e) {}
      // 記錄背景上傳計數與 UploadCenter 任務
      try { incActiveUpload(studentIndex); } catch (e) {}
      try {
        if (typeof UploadCenter !== 'undefined' && UploadCenter && typeof UploadCenter.add === 'function') {
          var idxForTask = (typeof meta.entryIndex === 'number') ? meta.entryIndex : 0;
          UploadCenter.add(
            studentIndex,
            (task.type === 'videos' ? 'videos' : 'photos'),
            idxForTask,
            (file && file.name) || '',
            null,
            {
              statusOnReuse: 'uploading',
              meta: buildUploadCenterMetaPayload(task, (file && file.name) || '')
            }
          );
        }
      } catch (e) {}
      var tempId = meta.tempId;
      var student = (!isOverviewUpload && currentCourse && currentCourse.students) ? currentCourse.students[studentIndex] : null;
      var recordMeta = buildRecordOperationMeta(isOverviewUpload ? '課程總覽' : (student && student.name));
      var canonicalPath = recordMeta.canonicalRelativePath || recordMeta.relativePathUnified || recordMeta.relativePath || '';
      var uploadMetadata = {
        studentName: isOverviewUpload ? '課程總覽' : (student && student.name) || meta.studentName || '',
        dateKey: recordMeta.date,
        // 🔥 [修復 2025-11-18] 使用完整課程標題而非簡化的課程名稱，確保路徑正確
        courseName: recordMeta.coursePeriod || recordMeta.course || currentCourse && currentCourse.courseName || '',
        period: recordMeta.period || (currentCourse && currentCourse.coursePeriod) || '',
        mode: isOverviewUpload ? 'overview' : 'student',
        coursePeriod: recordMeta.coursePeriod,
        semester: recordMeta.semester,
        topic: recordMeta.topic,
        relativePath: canonicalPath,
        relativePathUnified: canonicalPath,
        isOverview: isOverviewUpload
      };

      DrivePathDebugMonitor.record('client:upload-metadata-prep', {
        tempId: tempId,
        studentName: uploadMetadata.studentName,
        courseName: uploadMetadata.courseName,
        semester: uploadMetadata.semester,
        dateKey: uploadMetadata.dateKey,
        topic: uploadMetadata.topic,
        relativePath: uploadMetadata.relativePath,
        cacheRelativePath: recordMeta.relativePath,
        relativePathUnified: uploadMetadata.relativePathUnified
      });

      PendingMediaStore && PendingMediaStore.update(tempId, { state: 'uploading' });
      PendingMediaActions.updateState(tempId, 'uploading', '上傳中…');

      try {
        var mediaRecord = await global.FLB.Api.uploadMediaStandalone(file, uploadMetadata, function(percent){
          var safePct = Math.max(1, Math.min(100, Math.round(percent || 0)));
          var label = '上傳中… ' + safePct + '%';
          PendingMediaActions.updateProgress(tempId, percent, label);
          try {
            if (typeof UploadCenter !== 'undefined' && UploadCenter && typeof UploadCenter.update === 'function') {
              var idxForTask = (typeof meta.entryIndex === 'number') ? meta.entryIndex : 0;
              UploadCenter.update(studentIndex, (task.type === 'videos' ? 'videos' : 'photos'), idxForTask, safePct);
            }
          } catch (_) {}
          try {
            console.log('🔍 [上傳進度] meta:', {
              hasEntryIndex: typeof meta.entryIndex === 'number',
              entryIndex: meta.entryIndex,
              studentIndex: studentIndex,
              type: task.type,
              percent: safePct
            });
            if (typeof meta.entryIndex === 'number') {
              updateFileUploadProgress(studentIndex, (task.type === 'videos' ? 'videos' : 'photos'), meta.entryIndex, safePct);
            } else {
              console.warn('⚠️ [上傳進度] meta.entryIndex 不是數字，使用模擬進度');
              simulateIndividualFileProgress(studentIndex, safePct);
            }
          } catch (e) {
            console.error('❌ [上傳進度] 更新失敗:', e);
          }
        });
        var mediaId = mediaRecord && mediaRecord.id;
        if (!mediaId) {
          throw new Error('媒體上傳未返回 ID');
        }
        meta.mediaId = mediaId;
        if (mediaRecord.proxyUrl) meta.proxyUrl = mediaRecord.proxyUrl;
        if (mediaRecord.drivePath) meta.drivePath = mediaRecord.drivePath;
        if (mediaRecord.mimeType) meta.mimeType = mediaRecord.mimeType;
        PendingMediaStore && PendingMediaStore.update(tempId, { state: 'synced', mediaId: mediaId, mediaType: task.type, proxyUrl: meta.proxyUrl });
        PendingMediaActions.updateState(tempId, 'synced', '已完成');
        try {
          if (typeof UploadCenter !== 'undefined' && UploadCenter && typeof UploadCenter.done === 'function') {
            var idxForTask2 = (typeof meta.entryIndex === 'number') ? meta.entryIndex : 0;
            UploadCenter.done(studentIndex, (task.type === 'videos' ? 'videos' : 'photos'), idxForTask2);
          }
        } catch (_) {}
        try {
          if (typeof meta.entryIndex === 'number') {
            updateFileUploadProgress(studentIndex, (task.type === 'videos' ? 'videos' : 'photos'), meta.entryIndex, 100);
          }
        } catch (e) {}
      } catch (error) {
        PendingMediaStore && PendingMediaStore.update(tempId, { state: 'failed', error: error && error.message });
        PendingMediaActions.updateState(tempId, 'failed', (error && error.message) || '上傳失敗');
        try {
          if (typeof UploadCenter !== 'undefined' && UploadCenter && typeof UploadCenter.fail === 'function') {
            var idxForTask3 = (typeof meta.entryIndex === 'number') ? meta.entryIndex : 0;
            UploadCenter.fail(studentIndex, (task.type === 'videos' ? 'videos' : 'photos'), idxForTask3, (error && error.message) || '上傳失敗');
          }
        } catch (_) {}
        throw error;
      } finally {
        try { decActiveUpload(studentIndex); } catch (e) {}
      }
    }

    return {
      enqueue: enqueue,
      refreshLimits: refreshLimits
    };
  })();
  window.MediaUploadController = MediaUploadController;
  
  // 🔗 狀態同步（雙向同步新舊系統狀態）
  function syncStateToManager() {
    if (!State) return;
    
    State.set('currentCourse', currentCourse);
    // 🔥 [修復 2025-11-18] 直接传递引用，File 对象无法 JSON 序列化
    State.set('studentFiles', studentFiles);
    State.set('allCourses', allCourses);
    State.set('activeFilters', activeFilters);
    State.set('allStudentsGlobal', allStudentsGlobal);
    State.set('currentUser', currentUser);
    State.set('currentTeacher', currentTeacher);
  }
  
  function syncStateFromManager() {
    if (!State) return;
    
    currentCourse = State.get('currentCourse') || null;
    studentFiles = State.get('studentFiles') || {};
    allCourses = State.get('allCourses') || [];
    activeFilters = State.get('activeFilters') || { instructor: '', courseType: '', studentQuery: '' };
    allStudentsGlobal = State.get('allStudentsGlobal') || [];
    currentUser = State.get('currentUser') || null;
    currentTeacher = State.get('currentTeacher') || null;
  }
  var previewOverlayBound = false;
  var lastOverviewSnapshot = '';
  var lastOverviewHydratedKey = null;
  var forceNextOverviewUpload = false; // 🔥 強制下次上傳標記（用於清空欄位後的上傳）
  var overviewScheduleTimer = null;
  var lastAutoUploadAt = {}; // ⏱️ 每位學生最近一次自動上傳時間戳，避免過於頻繁（後端負擔）
  var lastSubmittedSnapshot = {}; // 🧩 防抖：上一次提交內容的快照，用於阻止重複上傳
  var activeUploadsByStudent = {}; // 📡 追蹤各學生背景上傳數量（切換學生不會中斷）
  var previewProgressPrimed = {};
  var activeUploadsTotal = 0;
  var shadowBuffersByCourse = {};
  var overviewShadowBuffersByCourse = {};
  var overviewAutoTimer = null; // ⏱️ 課程總覽自動上傳排程
  var uploadedCacheHydratedAt = 0; // 🕒 本地快取最近 hydrate 時刻
  var UPLOADED_CACHE_TTL = 30 * 60 * 1000; // 30 分鐘內僅用快取不重抓
  var batchFsFetchMode = false; // 🧵 批次補齊模式：抑制重複 UI 重繪
  var cacheClearInProgress = false; // 🔒 快取清除進行中（防止重複清除）
  var courseLoadStateByKey = {};
  var STUDENT_HISTORY_CACHE_KEY = 'lr_student_history_cache_v1';
  // ⚡ 始終抓取最新出缺席/歷程：停用學生歷史快取（TTL=0）
  var STUDENT_HISTORY_CACHE_TTL = 0; // 0 表示每次必須重新請求最新資料
  var studentHistoryCacheStore = loadStudentHistoryCache();
  var studentHistoryCachePersistTimer = null;
  var studentHistoryFetchQueue = createAsyncQueue(2, 120);

  function markUploadedCacheDirty(reason, force) {
    if (!force && !AUTO_REFRESH_AFTER_UPLOAD) {
      if (reason) {
        console.log('🧊 [快取] Cache-only 模式，略過重抓:', reason);
      }
      return;
    }
    uploadedCacheHydratedAt = 0;
    if (force) {
      courseLoadStateByKey = {};
      studentHistoryCacheStore = {};
      persistStudentHistoryCache();
    }
    if (reason) {
      console.log('🗑️ [快取] 已清除快取 (理由: ' + reason + ')');
    }
  }

  function loadStudentHistoryCache() {
    if (typeof window === 'undefined' || !window.sessionStorage) return {};
    try {
      var raw = window.sessionStorage.getItem(STUDENT_HISTORY_CACHE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (e) {
      console.warn('⚠️ [StudentHistoryCache] 讀取失敗:', e.message);
      return {};
    }
  }

  function persistStudentHistoryCache() {
    if (studentHistoryCachePersistTimer || typeof window === 'undefined' || !window.sessionStorage) return;
    studentHistoryCachePersistTimer = setTimeout(function () {
      studentHistoryCachePersistTimer = null;
      try {
        window.sessionStorage.setItem(STUDENT_HISTORY_CACHE_KEY, JSON.stringify(studentHistoryCacheStore || {}));
      } catch (e) {
        console.warn('⚠️ [StudentHistoryCache] 寫入失敗:', e.message);
      }
    }, 60);
  }

  function getStudentHistoryCacheKey(courseKey, studentName) {
    var normalized = normalizeToken(studentName || '');
    return String(courseKey || '__unknown_course__') + '::' + normalized;
  }

  function pruneStudentHistoryCache() {
    var now = Date.now();
    Object.keys(studentHistoryCacheStore || {}).forEach(function (key) {
      var entry = studentHistoryCacheStore[key];
      if (!entry || !entry.savedAt || (now - entry.savedAt) > STUDENT_HISTORY_CACHE_TTL) {
        delete studentHistoryCacheStore[key];
      }
    });
  }

  var StudentHistoryCache = {
    get: function (courseKey, studentName) {
      if (!studentHistoryCacheStore) return null;
      var key = getStudentHistoryCacheKey(courseKey, studentName);
      var entry = studentHistoryCacheStore[key];
      if (!entry) return null;
      if ((Date.now() - entry.savedAt) > STUDENT_HISTORY_CACHE_TTL) {
        delete studentHistoryCacheStore[key];
        persistStudentHistoryCache();
        return null;
      }
      return entry;
    },
    set: function (courseKey, studentName, payload) {
      if (!courseKey || !studentName || !payload) return;
      var key = getStudentHistoryCacheKey(courseKey, studentName);
      studentHistoryCacheStore = studentHistoryCacheStore || {};
      studentHistoryCacheStore[key] = {
        data: payload,
        savedAt: Date.now()
      };
      pruneStudentHistoryCache();
      persistStudentHistoryCache();
    },
    clear: function (courseKey, studentName) {
      if (!studentHistoryCacheStore) return;
      var key = getStudentHistoryCacheKey(courseKey, studentName);
      if (studentHistoryCacheStore[key]) {
        delete studentHistoryCacheStore[key];
        persistStudentHistoryCache();
      }
    },
    clearCourse: function (courseKey) {
      if (!studentHistoryCacheStore) return;
      if (!courseKey) {
        studentHistoryCacheStore = {};
        persistStudentHistoryCache();
        return;
      }
      var prefix = String(courseKey) + '::';
      Object.keys(studentHistoryCacheStore).forEach(function (key) {
        if (key.indexOf(prefix) === 0) {
          delete studentHistoryCacheStore[key];
        }
      });
      persistStudentHistoryCache();
    },
    pruneCourse: function (courseKey, normalizedNameSet) {
      if (!studentHistoryCacheStore || !courseKey) return;
      var prefix = String(courseKey) + '::';
      var shouldClearAll = !(normalizedNameSet && normalizedNameSet.size);
      Object.keys(studentHistoryCacheStore).forEach(function (key) {
        if (key.indexOf(prefix) !== 0) return;
        if (shouldClearAll) {
          delete studentHistoryCacheStore[key];
          return;
        }
        var normalizedName = key.slice(prefix.length);
        if (!normalizedNameSet.has(normalizedName)) {
          delete studentHistoryCacheStore[key];
        }
      });
      persistStudentHistoryCache();
    }
  };

  function buildNormalizedNameSet(records) {
    var set = new Set();
    if (!Array.isArray(records)) return set;
    records.forEach(function (rec) {
      var normalized = normalizeToken(rec && (rec.studentName || rec.name));
      if (normalized) set.add(normalized);
    });
    return set;
  }

  function pruneStudentHistoryForCourse(courseKey, normalizedNameSet) {
    if (!courseKey || !StudentHistoryCache || typeof StudentHistoryCache.pruneCourse !== 'function') return;
    try {
      StudentHistoryCache.pruneCourse(courseKey, normalizedNameSet);
    } catch (e) {
      console.warn('⚠️ [StudentHistoryCache] pruneCourse 失敗:', e && e.message);
    }
  }

  function clearStudentStateForMissingRecords(courseKey, normalizedNameSet) {
    if (!currentCourse || !Array.isArray(currentCourse.students)) return;
    var shouldResetAll = !(normalizedNameSet && normalizedNameSet.size);
    currentCourse.students.forEach(function (student, idx) {
      var normalized = normalizeToken(student && (student.name || student.studentName || student.displayName));
      if (!normalized) return;
      if (!shouldResetAll && normalizedNameSet.has(normalized)) return;
      var base = studentFiles[idx];
      var hasSyncedData = !!(base && base.existingCounts && (
        (base.existingCounts.photos || 0) > 0 ||
        (base.existingCounts.videos || 0) > 0 ||
        (base.existingCounts.text || 0) > 0
      ));
      if (!hasSyncedData) {
        if (StudentHistoryCache && typeof StudentHistoryCache.clear === 'function') {
          StudentHistoryCache.clear(courseKey, student && student.name);
        }
        return;
      }
      if (hasPendingChanges(idx)) return;
      resetStudentLocalState(idx, student);
      if (StudentHistoryCache && typeof StudentHistoryCache.clear === 'function') {
        StudentHistoryCache.clear(courseKey, student && student.name);
      }
    });
  }

  function createAsyncQueue(concurrency, delayMs) {
    concurrency = Math.max(1, Number(concurrency) || 1);
    var delay = Math.max(0, Number(delayMs) || 0);
    var active = 0;
    var queue = [];

    function runNext() {
      if (!queue.length) return;
      if (active >= concurrency) return;
      var task = queue.shift();
      if (!task || typeof task.fn !== 'function') return;
      active++;
      Promise.resolve()
        .then(task.fn)
        .then(task.resolve, task.reject)
        .finally(function () {
          active = Math.max(0, active - 1);
          if (delay > 0) {
            setTimeout(runNext, delay);
          } else {
            runNext();
          }
        });
    }

    return {
      enqueue: function (fn) {
        return new Promise(function (resolve, reject) {
          queue.push({ fn: fn, resolve: resolve, reject: reject });
          runNext();
        });
      }
    };
  }

  function invalidateCourseLoadState(courseKey) {
    if (!courseLoadStateByKey) courseLoadStateByKey = {};
    if (!courseKey) {
      courseLoadStateByKey = {};
    } else {
      delete courseLoadStateByKey[courseKey];
    }
  }

  function markCourseLoadReady(courseKey) {
    if (!courseKey) return;
    courseLoadStateByKey = courseLoadStateByKey || {};
    courseLoadStateByKey[courseKey] = {
      ready: true,
      loadedAt: Date.now()
    };
  }
  // ====== 全域分享：最近一次選取的影片與評語範本（方便套用到其他學生） ======
  var lastSharedVideoFiles = [];
  var lastCommentTemplate = '';
  var videoTemplatesMem = [];
  var videoPosterCache = window.__videoPosterCache || {};
  window.__videoPosterCache = videoPosterCache;
  var videoThumbnailReadyCache = window.__videoThumbnailReadyCache || {};  // 🔥 新增：記錄影片縮圖是否已就緒
  window.__videoThumbnailReadyCache = videoThumbnailReadyCache;
  var thumbReadyCache = window.__thumbReadyCache;
  var posterErrorPanelEl = null;
  var posterErrorQueue = [];
  var posterRetryRegistry = {};
  var POSTER_RETRY_LIMIT = 5;
  var UPLOAD_CANCELLED_FLAG = '__UPLOAD_CANCELLED__';
  var ATTENDANCE_STATUS_TEXT = {
    present: '✅ 已出席，請完成上傳。',
    leave: '🏥 今日已請假，系統已鎖定上傳。',
    absent: '⚠️ 今日缺席，系統已鎖定上傳。',
    unknown: '🕒 尚未紀錄出缺席。'
  };
  var ATTENDANCE_STATUS_CLASS = {
    present: 'status-present',
    leave: 'status-leave',
    absent: 'status-absent',
    unknown: 'status-unknown'
  };
  var hasRenderedUploadedRecords = false;
  var recordsLoadingHideTimer = null;
  var recordsLoadingVisible = false;
  var __pendingLoadOptions = null;
  var __pendingLoadTimer = null;
  var __studentProgressTimers = {};
  var __studentProgressValues = {};

  function startStudentProgressAnimation(studentIndex) {
    try {
      var containers = ['#photos-preview-' + studentIndex, '#videos-preview-' + studentIndex];
      containers.forEach(function(sel){
        var host = document.querySelector(sel);
        if (!host) return;
        var previews = host.querySelectorAll('.file-preview.new-upload, .file-preview.pending');
        Array.prototype.forEach.call(previews, function(node){
          node.classList.add('uploading');
          ensureProgressBar(node);
          var fill = node.querySelector('.file-upload-progress-fill');
          if (fill) fill.style.width = '0%';
        });
      });
      __studentProgressValues[studentIndex] = 0;
      if (__studentProgressTimers[studentIndex]) clearInterval(__studentProgressTimers[studentIndex]);
      __studentProgressTimers[studentIndex] = setInterval(function(){
        var p = (__studentProgressValues[studentIndex] || 0) + 3;
        if (p > 95) p = 95; // 預留最後完成時段
        __studentProgressValues[studentIndex] = p;
        containers.forEach(function(sel){ updateAllFileProgressBars(sel, p); });
      }, 180);
    } catch (e) { console.warn('⚠️ startStudentProgressAnimation 失敗:', e); }
  }

  function stopStudentProgressAnimation(studentIndex, done) {
    try {
      var p = done ? 100 : (__studentProgressValues[studentIndex] || 0);
      var containers = ['#photos-preview-' + studentIndex, '#videos-preview-' + studentIndex];
      containers.forEach(function(sel){ updateAllFileProgressBars(sel, p); });
      if (__studentProgressTimers[studentIndex]) {
        clearInterval(__studentProgressTimers[studentIndex]);
        delete __studentProgressTimers[studentIndex];
      }
      if (done) {
        // 標記完成：保留縮圖，隱藏 overlay
        containers.forEach(function(sel){
          var all = document.querySelectorAll(sel + ' .file-preview.uploading');
          Array.prototype.forEach.call(all, function(node){
            var overlay = node.querySelector('.file-uploading-overlay');
            if (overlay) overlay.style.opacity = '0';
            node.classList.add('upload-success', 'synced');
            node.classList.remove('uploading', 'new-upload', 'pending');
          });
        });
      }
    } catch (e) { console.warn('⚠️ stopStudentProgressAnimation 失敗:', e); }
  }

  function setRecordsLoadingState(isLoading, opts) {
    opts = opts || {};
    var overlay = document.getElementById('recordsLoadingOverlay');
    if (!overlay) return;
    var messageEl = document.getElementById('recordsLoadingMessage');
    var subEl = document.getElementById('recordsLoadingSub');
    var spinnerEl = overlay.querySelector('.lr-loading-spinner');
    if (recordsLoadingHideTimer) {
      clearTimeout(recordsLoadingHideTimer);
      recordsLoadingHideTimer = null;
    }
    if (messageEl && opts.message) {
      messageEl.textContent = opts.message;
    }
    if (subEl) {
      if (opts.subMessage === null) {
        subEl.style.display = 'none';
      } else {
        subEl.style.display = '';
        if (opts.subMessage) {
          subEl.textContent = opts.subMessage;
        }
      }
    }
    if (spinnerEl) {
      spinnerEl.style.display = (opts.showSpinner === false) ? 'none' : '';
    }
    if (isLoading) {
      recordsLoadingVisible = true;
      overlay.classList.add('visible');
      overlay.classList.remove('error');
      overlay.setAttribute('aria-busy', 'true');
    } else {
      recordsLoadingVisible = false;
      overlay.setAttribute('aria-busy', 'false');
      if (opts.status === 'error') {
        overlay.classList.add('visible');
        overlay.classList.add('error');
        if (spinnerEl) spinnerEl.style.display = 'none';
        recordsLoadingHideTimer = setTimeout(function () {
          overlay.classList.remove('visible');
          overlay.classList.remove('error');
        }, Math.max(1800, Number(opts.hideAfter || 2200)));
      } else {
        overlay.classList.remove('visible');
        overlay.classList.remove('error');
      }
    }
  }

  function mergeLoadOptions(existing, incoming) {
    var base = existing ? Object.assign({}, existing) : {};
    var next = incoming || {};
    if (next.force) base.force = true;
    if (next.showLoader) base.showLoader = true;
    if (typeof next.retryMissing !== 'undefined') {
      base.retryMissing = !!next.retryMissing;
    }
    if (typeof next.clearCache !== 'undefined') {
      base.clearCache = !!next.clearCache;
    }
    if (typeof next.skipMissingCheck !== 'undefined') {
      base.skipMissingCheck = next.skipMissingCheck;
    } else if (typeof base.skipMissingCheck === 'undefined' && existing && typeof existing.skipMissingCheck !== 'undefined') {
      base.skipMissingCheck = existing.skipMissingCheck;
    }
    if (next.loadingMessage) base.loadingMessage = next.loadingMessage;
    if (next.loadingSubMessage) base.loadingSubMessage = next.loadingSubMessage;
    if (typeof next.loadingMessage === 'string' && !next.loadingMessage.trim()) delete base.loadingMessage;
    if (typeof next.loadingSubMessage === 'string' && !next.loadingSubMessage.trim()) delete base.loadingSubMessage;
    return base;
  }

  function schedulePendingLoad(delayMs) {
    if (__pendingLoadTimer) clearTimeout(__pendingLoadTimer);
    __pendingLoadTimer = setTimeout(function() {
      __pendingLoadTimer = null;
      triggerPendingLoad();
    }, Math.max(0, Number(delayMs || 0)));
  }

  function shouldAllowReload(opts) {
    if (!uploadedCacheHydratedAt) return true; // 尚未 hydrate，視為初始載入
    if (AUTO_REFRESH_AFTER_UPLOAD) return true;
    if (opts && (opts.allowCacheBypass || opts.force || opts.clearCache || opts.retryMissing)) return true;
    return false;
  }

  function resetUploadedCacheTimestamp(reason, force) {
    markUploadedCacheDirty(reason || 'manual-reset', force !== false);
  }

  function requestCourseReload(options) {
    var opts = options || {};
    var courseKey = null;
    try { courseKey = getCourseCacheKey(currentCourse || {}); } catch (e) {}
    if (!shouldAllowReload(opts)) {
      console.log('🧊 [快取] 跳過 requestCourseReload（cache-only）:', opts.reason || '未指定');
      return;
    }
    resetUploadedCacheTimestamp(opts.reason || 'requestCourseReload', true);
    if (courseKey) {
      invalidateCourseLoadState(courseKey);
      StudentHistoryCache.clearCourse(courseKey);
    } else {
      invalidateCourseLoadState();
      StudentHistoryCache.clearCourse();
    }
    __pendingLoadOptions = mergeLoadOptions(__pendingLoadOptions, opts);
    schedulePendingLoad(opts.delay || 0);
  }

  function triggerPendingLoad() {
    if (!__pendingLoadOptions) return;
    if (__loadingUploadedRecords) {
      schedulePendingLoad(200);
      return;
    }
    var nextOpts = __pendingLoadOptions;
    __pendingLoadOptions = null;
    try {
      var key = getCourseCacheKey(currentCourse || {});
      if (isDriveMissingThrottled(key, nextOpts)) {
        console.log('ℹ️ [triggerPendingLoad] Drive 目錄仍不可用，取消排程');
        return;
      }
    } catch (e) {}
    loadUploadedRecordsForCurrentCourse(nextOpts || {});
  }
  function isRecordsLoadingOverlayActive() {
    return recordsLoadingVisible;
  }

  // ============================================
  // 🧠 記憶體壓力監控器（主動防止OOM）
  // ============================================
  var MemoryPressureMonitor = (function() {
    var instance = null;
    
    function MemoryPressureMonitorClass() {
      this.isMonitoring = false;
      this.monitorInterval = null;
      this.checkIntervalMs = 5000; // 每 5 秒檢測一次
      this.mode = 'normal'; // normal | degraded | warning | critical
      this.listeners = [];
      this.stats = {
        checks: 0,
        warnings: 0,
        cleanups: 0,
        lastCheck: 0
      };
      
      // 配置閾值
      this.thresholds = {
        degraded: 0.70,  // 70% 啟動降級模式
        warning: 0.85,   // 85% 警告模式
        critical: 0.95   // 95% 緊急清理
      };
      
      // 降級模式配置
      this.degradedConfig = {
        batchSize: 2,           // 減少批次大小
        skipThumbnails: true,   // 跳過縮圖生成
        delayMs: 1000           // 增加延遲
      };
    }
    
    MemoryPressureMonitorClass.prototype.start = function() {
      if (this.isMonitoring) {
        console.log('⚠️ 記憶體監控器已在運行');
        return;
      }
      
      console.log('🧠 啟動記憶體壓力監控器（間隔:', this.checkIntervalMs, 'ms）');
      this.isMonitoring = true;
      
      var self = this;
      this.monitorInterval = setInterval(function() {
        self.check();
      }, this.checkIntervalMs);
      
      // 立即執行一次檢測
      this.check();
    };
    
    MemoryPressureMonitorClass.prototype.stop = function() {
      if (!this.isMonitoring) return;
      
      console.log('🛑 停止記憶體監控器');
      this.isMonitoring = false;
      
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
      }
    };
    
    MemoryPressureMonitorClass.prototype.check = function() {
      this.stats.checks++;
      this.stats.lastCheck = Date.now();
      
      var memStatus = typeof window.__checkMemoryPressure === 'function' 
        ? window.__checkMemoryPressure() 
        : { level: 'unknown', ratio: 0 };
      
      var ratio = memStatus.ratio || 0;
      var oldMode = this.mode;
      var newMode = 'normal';
      
      // 判斷模式
      if (ratio >= this.thresholds.critical) {
        newMode = 'critical';
      } else if (ratio >= this.thresholds.warning) {
        newMode = 'warning';
      } else if (ratio >= this.thresholds.degraded) {
        newMode = 'degraded';
      }
      
      // 模式變更處理
      if (newMode !== oldMode) {
        console.log('🔄 記憶體模式變更:', oldMode, '→', newMode, '(' + (ratio * 100).toFixed(1) + '%)');
        this.mode = newMode;
        this.onModeChange(newMode, ratio);
      }
      
      // 執行對應動作
      if (newMode === 'critical') {
        this.handleCritical();
      } else if (newMode === 'warning') {
        this.handleWarning();
      } else if (newMode === 'degraded') {
        this.handleDegraded();
      }
      
      // 通知監聽器
      this.notifyListeners({
        mode: newMode,
        ratio: ratio,
        memStatus: memStatus
      });
    };
    
    MemoryPressureMonitorClass.prototype.handleDegraded = function() {
      console.log('🟡 進入降級模式：減少批次大小、跳過縮圖');
      // 降級模式不主動清理，只調整處理策略
    };
    
    MemoryPressureMonitorClass.prototype.handleWarning = function() {
      console.warn('🟠 記憶體警告：建議暫停處理大檔案');
      this.stats.warnings++;
      
      // 顯示用戶提示（僅第一次）
      if (this.stats.warnings === 1) {
        if (typeof window.showToast === 'function') {
          window.showToast('記憶體使用量較高，建議減少檔案數量', 'warning');
        }
      }
    };
    
    MemoryPressureMonitorClass.prototype.handleCritical = function() {
      console.error('🔴 記憶體緊急狀態：執行清理');
      this.stats.cleanups++;
      
      // 執行緊急清理
      if (typeof window.__emergencyMemoryCleanup === 'function') {
        window.__emergencyMemoryCleanup();
      }
      
      // 顯示用戶提示
      if (typeof window.showToast === 'function') {
        window.showToast('記憶體不足，已自動清理，請分批上傳', 'error');
      } else {
        console.error('⚠️ 裝置記憶體不足，建議：\n1. 分批上傳\n2. 關閉其他分頁');
      }
    };
    
    MemoryPressureMonitorClass.prototype.onModeChange = function(newMode, ratio) {
      // 暴露模式給全域使用
      window.__memoryMode = newMode;
      window.__memoryRatio = ratio;
      
      // 根據模式調整配置
      if (window.LearningUploadConfig && typeof window.LearningUploadConfig.set === 'function') {
        if (newMode === 'degraded' || newMode === 'warning' || newMode === 'critical') {
          window.LearningUploadConfig.set('batchSize', this.degradedConfig.batchSize);
          window.LearningUploadConfig.set('skipThumbnails', this.degradedConfig.skipThumbnails);
          window.LearningUploadConfig.set('delayBetweenBatches', this.degradedConfig.delayMs);
        } else {
          // 恢復正常配置
          window.LearningUploadConfig.set('batchSize', 5);
          window.LearningUploadConfig.set('skipThumbnails', false);
          window.LearningUploadConfig.set('delayBetweenBatches', 50);
        }
      }
    };
    
    MemoryPressureMonitorClass.prototype.addListener = function(callback) {
      if (typeof callback === 'function') {
        this.listeners.push(callback);
      }
    };
    
    MemoryPressureMonitorClass.prototype.notifyListeners = function(data) {
      this.listeners.forEach(function(callback) {
        try {
          callback(data);
        } catch (e) {
          console.error('❌ 記憶體監控器監聽器錯誤:', e);
        }
      });
    };
    
    MemoryPressureMonitorClass.prototype.getStatus = function() {
      return {
        isMonitoring: this.isMonitoring,
        mode: this.mode,
        stats: this.stats,
        config: this.degradedConfig
      };
    };
    
    // 單例模式
    return {
      getInstance: function() {
        if (!instance) {
          instance = new MemoryPressureMonitorClass();
        }
        return instance;
      }
    };
  })();
  
  // 創建全域實例
  var memoryMonitor = MemoryPressureMonitor.getInstance();

  // ============================================
  // 📂 檔案分類與排序工具（智能分批上傳）
  // ============================================
  
  /**
   * 檔案大小分類
   */
  function classifyFileBySize(file) {
    if (!file || !file.size) {
      return { category: 'unknown', priority: 999, label: '未知' };
    }
    
    var sizeMB = file.size / (1024 * 1024);
    
    if (sizeMB < 5) {
      return { category: 'tiny', priority: 1, label: '極小', sizeMB: sizeMB };
    } else if (sizeMB < 20) {
      return { category: 'small', priority: 2, label: '小', sizeMB: sizeMB };
    } else if (sizeMB < 50) {
      return { category: 'medium', priority: 3, label: '中', sizeMB: sizeMB };
    } else if (sizeMB < 150) {
      return { category: 'large', priority: 4, label: '大', sizeMB: sizeMB };
    } else {
      return { category: 'huge', priority: 5, label: '超大', sizeMB: sizeMB };
    }
  }
  
  /**
   * 檔案分類與排序（優先小檔案）
   * @param {FileList|Array} files - 檔案列表
   * @returns {Array} 排序後的檔案陣列，每個元素包含 {file, classification, index}
   */
  function classifyAndSortFiles(files) {
    if (!files || !files.length) {
      return [];
    }
    
    // 轉換為陣列並添加分類資訊
    var classified = Array.prototype.map.call(files, function(file, index) {
      var classification = classifyFileBySize(file);
      return {
        file: file,
        classification: classification,
        originalIndex: index,
        isImage: /^image\//i.test(file.type),
        isVideo: /^video\//i.test(file.type)
      };
    });
    
    // 排序：優先級 -> 檔案類型（圖片優先） -> 大小
    classified.sort(function(a, b) {
      // 1. 按優先級排序（小檔案優先）
      if (a.classification.priority !== b.classification.priority) {
        return a.classification.priority - b.classification.priority;
      }
      
      // 2. 圖片優先於影片（圖片處理較快）
      if (a.isImage && !b.isImage) return -1;
      if (!a.isImage && b.isImage) return 1;
      
      // 3. 按檔案大小排序（小優先）
      return a.file.size - b.file.size;
    });
    
    console.log('📂 檔案分類與排序完成:', {
      total: classified.length,
      tiny: classified.filter(function(f) { return f.classification.category === 'tiny'; }).length,
      small: classified.filter(function(f) { return f.classification.category === 'small'; }).length,
      medium: classified.filter(function(f) { return f.classification.category === 'medium'; }).length,
      large: classified.filter(function(f) { return f.classification.category === 'large'; }).length,
      huge: classified.filter(function(f) { return f.classification.category === 'huge'; }).length
    });
    
    return classified;
  }
  
  /**
   * 將已分類的檔案分批（根據大小動態調整批次）
   * @param {Array} classifiedFiles - 已分類的檔案
   * @returns {Array} 批次陣列，每個批次包含 {files, delay, batchSize}
   */
  function createFileBatches(classifiedFiles) {
    if (!classifiedFiles || !classifiedFiles.length) {
      return [];
    }
    
    // 🧠 檢測記憶體壓力並調整策略
    var memoryPressure = typeof window.__checkMemoryPressure === 'function' 
      ? window.__checkMemoryPressure() 
      : { level: 'low', ratio: 0 };
    
    console.log('🧠 記憶體壓力等級:', memoryPressure.level, '(' + (memoryPressure.ratio * 100).toFixed(1) + '%)');
    
    // 根據記憶體壓力過濾大檔案
    var filteredFiles = classifiedFiles;
    if (memoryPressure.level === 'critical') {
      // Critical: 僅處理 < 5MB 檔案
      filteredFiles = classifiedFiles.filter(function(item) {
        var sizeOk = item.file.size < 5 * 1024 * 1024;
        if (!sizeOk) {
          console.warn('⚠️ [記憶體不足] 跳過大檔案:', item.file.name, '(' + (item.file.size / 1024 / 1024).toFixed(1) + 'MB)');
          if (typeof window.showToast === 'function') {
            window.showToast('記憶體不足，已跳過 ' + item.file.name, 'warning');
          }
        }
        return sizeOk;
      });
    } else if (memoryPressure.level === 'high') {
      // High: 僅處理 < 15MB 檔案
      filteredFiles = classifiedFiles.filter(function(item) {
        var sizeOk = item.file.size < 15 * 1024 * 1024;
        if (!sizeOk) {
          console.warn('⚠️ [記憶體壓力高] 跳過大檔案:', item.file.name, '(' + (item.file.size / 1024 / 1024).toFixed(1) + 'MB)');
        }
        return sizeOk;
      });
    }
    
    var batches = [];
    var currentBatch = [];
    var currentBatchCategory = null;
    
    filteredFiles.forEach(function(item, index) {
      var category = item.classification.category;
      
      // 決定批次大小和延遲（基礎值）
      var batchSize, delayMs;
      if (category === 'tiny') {
        batchSize = 5; // 極小檔案：一次 5 個
        delayMs = 100;
      } else if (category === 'small') {
        batchSize = 3; // 小檔案：一次 3 個
        delayMs = 300;
      } else if (category === 'medium') {
        batchSize = 2; // 中檔案：一次 2 個
        delayMs = 500;
      } else if (category === 'large') {
        batchSize = 1; // 大檔案：逐個處理
        delayMs = 1000;
      } else {
        batchSize = 1; // 超大檔案：逐個處理，延遲更長
        delayMs = 1500;
      }
      
      // 🧠 根據記憶體壓力調整批次參數
      if (memoryPressure.level === 'critical') {
        batchSize = Math.max(1, Math.floor(batchSize / 4)); // 減至1/4
        delayMs = Math.min(5000, delayMs * 4); // 延遲翻4倍
      } else if (memoryPressure.level === 'high') {
        batchSize = Math.max(1, Math.floor(batchSize / 2)); // 減半
        delayMs = Math.min(3000, delayMs * 2); // 延遲翻倍
      } else if (memoryPressure.level === 'medium') {
        batchSize = Math.max(1, Math.floor(batchSize * 0.75)); // 減至3/4
        delayMs = Math.min(2000, Math.floor(delayMs * 1.2)); // 延遲增20%
      }
      
      // 如果類別變更或達到批次大小，創建新批次
      if (currentBatch.length === 0) {
        currentBatchCategory = category;
        currentBatch.push(item);
      } else if (currentBatchCategory === category && currentBatch.length < batchSize) {
        currentBatch.push(item);
      } else {
        // 完成當前批次
        batches.push({
          files: currentBatch.slice(),
          delay: delayMs,
          category: currentBatchCategory,
          batchSize: currentBatch.length
        });
        
        // 開始新批次
        currentBatchCategory = category;
        currentBatch = [item];
      }
    });
    
    // 添加最後一個批次
    if (currentBatch.length > 0) {
      batches.push({
        files: currentBatch,
        delay: batches.length > 0 ? 500 : 0, // 第一批立即處理
        category: currentBatchCategory,
        batchSize: currentBatch.length
      });
    }
    
    // 第一批無延遲
    if (batches.length > 0) {
      batches[0].delay = 0;
    }
    
    console.log('📦 創建批次完成:', {
      memoryLevel: memoryPressure.level,
      filteredCount: filteredFiles.length,
      skippedCount: classifiedFiles.length - filteredFiles.length,
      totalBatches: batches.length,
      batches: batches.map(function(b, i) {
        return {
          batch: i + 1,
          category: b.category,
          files: b.batchSize,
          delay: b.delay + 'ms'
        };
      })
    });
    
    return batches;
  }
  
  /**
   * 檔案數量與大小驗證
   * @returns {Object} { valid, error, warning }
   */
  function validateFilesBeforeUpload(files) {
    if (!files || !files.length) {
      return { valid: false, error: '未選擇任何檔案' };
    }
    
    var maxFiles = 20;
    var maxTotalSizeMB = 500;
    var warnTotalSizeMB = 200;
    
    var totalSize = 0;
    for (var i = 0; i < files.length; i++) {
      totalSize += files[i].size || 0;
    }
    var totalSizeMB = totalSize / (1024 * 1024);
    
    // 檔案數量限制
    if (files.length > maxFiles) {
      return {
        valid: false,
        error: '檔案數量過多（' + files.length + ' 個），最多 ' + maxFiles + ' 個\n\n建議分批上傳'
      };
    }
    
    // 總大小限制
    if (totalSizeMB > maxTotalSizeMB) {
      return {
        valid: false,
        error: '檔案總大小過大（' + totalSizeMB.toFixed(1) + ' MB），最大 ' + maxTotalSizeMB + ' MB\n\n建議分批上傳或壓縮影片'
      };
    }
    
    // 警告（但允許繼續）
    if (totalSizeMB > warnTotalSizeMB) {
      return {
        valid: true,
        warning: '檔案較大（' + totalSizeMB.toFixed(1) + ' MB），上傳可能需要較長時間'
      };
    }
    
    return { valid: true };
  }

  function formatDateKey(value) {
    if (!value && value !== 0) return '';
    try {
      if (value instanceof Date) {
        if (isNaN(value.getTime())) return '';
        return value.toISOString().slice(0, 10);
      }
      if (typeof value === 'number') {
        var dateFromNumber = new Date(value);
        if (isNaN(dateFromNumber.getTime())) return '';
        return dateFromNumber.toISOString().slice(0, 10);
      }
      var text = String(value || '').trim();
      if (!text) return '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
      var parsed = new Date(text);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    } catch (e) {}
    return '';
  }

  function resolveStudentAttendance(student, targetDateKey) {
    var fallback = { status: 'unknown', message: ATTENDANCE_STATUS_TEXT.unknown, record: null };
    if (!student || !targetDateKey) return fallback;
    var records = Array.isArray(student.attendance) ? student.attendance : [];
    var matchedRecord = null;
    for (var i = 0; i < records.length; i++) {
      var entry = records[i];
      if (!entry) continue;
      var entryKey = formatDateKey(entry.date);
      if (entryKey === targetDateKey) {
        matchedRecord = entry;
        break;
      }
    }
    if (!matchedRecord) return fallback;
    var presentValue = matchedRecord.present;
    if (presentValue === true) {
      return { status: 'present', message: ATTENDANCE_STATUS_TEXT.present, record: matchedRecord };
    }
    if (presentValue === false) {
      return { status: 'absent', message: ATTENDANCE_STATUS_TEXT.absent, record: matchedRecord };
    }
    if (typeof presentValue === 'string') {
      var normalized = presentValue.toLowerCase();
      if (normalized === 'leave') {
        return { status: 'leave', message: ATTENDANCE_STATUS_TEXT.leave, record: matchedRecord };
      }
      if (normalized === 'absent' || normalized === 'absence') {
        return { status: 'absent', message: ATTENDANCE_STATUS_TEXT.absent, record: matchedRecord };
      }
      if (normalized === 'present') {
        return { status: 'present', message: ATTENDANCE_STATUS_TEXT.present, record: matchedRecord };
      }
    }
    return fallback;
  }

  function augmentCourseAttendance(course) {
    if (!course || !Array.isArray(course.students)) return;
    var targetKey = formatDateKey(course.start) || formatDateKey(course.date) || formatDateKey(course.dateKey);
    if (!targetKey && course.meta && course.meta.date) {
      targetKey = formatDateKey(course.meta.date);
    }
    course.attendanceDateKey = targetKey;
    course.students.forEach(function (student) {
      var info = targetKey ? resolveStudentAttendance(student, targetKey) : { status: 'unknown', message: ATTENDANCE_STATUS_TEXT.unknown, record: null };
      student.attendanceStatus = info.status;
      student.attendanceMessage = info.message;
      student.attendanceRecord = info.record;
    });
  }
  var serverMediaIndex = {
    photos: Object.create(null),
    videos: Object.create(null)
  };
  var posterErrorRegistry = {};

  function resetServerMediaIndex() {
    try {
      serverMediaIndex.photos = Object.create(null);
      serverMediaIndex.videos = Object.create(null);
    } catch (e) {
      serverMediaIndex = {
        photos: Object.create(null),
        videos: Object.create(null)
      };
    }
  }

  function resetPosterErrorRegistry() {
    try {
      posterErrorRegistry = {};
      var panel = ensurePosterErrorPanel();
      if (panel) {
        panel.innerHTML = '';
        panel.classList.remove('show');
      }
      posterRetryRegistry = {};
    } catch (e) {
      posterErrorRegistry = {};
      posterRetryRegistry = {};
    }
  }

  function clearThumbReadyCache() {
    try {
      if (thumbReadyCache && typeof thumbReadyCache.clear === 'function') {
        thumbReadyCache.clear();
      } else if (thumbReadyCache && thumbReadyCache._map) {
        thumbReadyCache._map = {};
      }
    } catch (e) {}
  }
  var FAST_POSTER_SAMPLE_LIMIT = 3;
  var FAST_POSTER_TIMEOUT = 1500;
  var DEFAULT_POSTER_TIMEOUT = 2800;

  // 🎞️ 影片縮圖任務序列（避免同時擷取多支影片在 iOS/行動端失敗）
  var PosterQueue = (function(){
    var q = [];
    var active = 0;
    var limit = 1; // 對齊 LINE：單工擷取較穩定
    function pump(){
      if (active >= limit || q.length === 0) return;
      var job = q.shift();
      active++;
      Promise.resolve().then(job.fn)
        .catch(function(){ /* 忽略單一任務錯誤，避免整列卡死 */ })
        .finally(function(){ active = Math.max(0, active - 1); pump(); });
    }
    return {
      enqueue: function(fn, opts){
        var job = { fn: fn };
        if (opts && opts.priority === 'high') {
          q.unshift(job);
        } else {
          q.push(job);
        }
        pump();
      },
      setLimit: function(n){ limit = Math.max(1, n|0); },
      stats: function(){ return { active: active, queued: q.length, limit: limit }; },
      clear: function(){ q = []; } // 🔥 新增：清空佇列
    };
  })();

  // 🚀 動態調整並發限制：根據設備性能調整
  (function adjustPosterQueueLimit() {
    try {
      // 檢測設備性能
      var isLowEnd = false;
      var hc = navigator.hardwareConcurrency || 0;
      var dm = navigator.deviceMemory || 0;
      
      // 低階設備：CPU 核心 <= 4 或記憶體 <= 2GB
      if ((hc > 0 && hc <= 4) || (dm > 0 && dm <= 2)) {
        isLowEnd = true;
      }
      
      // 根據設備調整並發限制
      var highEnd = (!isLowEnd && ((hc && hc >= 8) || (dm && dm >= 6)));
      var newLimit = isLowEnd ? 1 : (highEnd ? 3 : 2);
      PosterQueue.setLimit(newLimit);
      console.log('🎬 影片縮圖並發限制設為:', newLimit, '(低階設備:', isLowEnd, ')');
    } catch (e) {
      // 預設使用保守值
      PosterQueue.setLimit(1);
    }
  })();

  // 🎯 智能縮圖生成管理器（優先處理可見區域，延遲處理不可見區域）
  var SmartPosterGenerator = (function() {
    var observer = null;
    var initialized = false;
    
    function init() {
      if (initialized) return;
      initialized = true;
      
      try {
        // 使用 IntersectionObserver 檢測可見性
        observer = new IntersectionObserver(function(entries) {
          entries.forEach(function(entry) {
            if (entry.isIntersecting) {
              var preview = entry.target;
              var video = preview.querySelector('video');
              if (video) {
                generateForVideo(video, preview);
              }
            }
          });
        }, { 
          rootMargin: '100px',  // 提前 100px 開始加載
          threshold: 0.01       // 只要有 1% 可見就觸發
        });
        
        console.log('✅ SmartPosterGenerator 初始化成功');
      } catch (e) {
        console.warn('⚠️ SmartPosterGenerator 初始化失敗（降級為立即處理）:', e);
        observer = null;
      }
    }
    
    function generateForVideo(videoElement, previewElement) {
      try {
        // 🔥 [修復] 檢查元素是否仍在 DOM 中
        if (!videoElement.isConnected) {
          console.log('⏭️ [SmartPoster] 影片元素已從 DOM 移除，跳過縮圖生成');
          return;
        }
        
        // 檢查是否已生成
        if (videoElement.hasAttribute('data-poster-generated')) {
          return;
        }
        
        // 🔥 [修復] 檢查 video 是否有有效的 src
        var videoSrc = videoElement.src || videoElement.getAttribute('data-src');
        if (!videoSrc || videoSrc === '' || videoSrc === 'about:blank') {
          console.log('⏭️ [SmartPoster] 影片無有效 src，跳過縮圖生成');
          return;
        }
        
        // 🔥 [修復] 檢查預覽容器是否被標記為「即將刪除」或「同步中」
        if (previewElement) {
          var isAwaitingSync = previewElement.getAttribute('data-awaiting-sync') === '1';
          var isMarkedForRemoval = previewElement.classList.contains('removing') || 
                                   previewElement.classList.contains('deleted');
          
          if (isAwaitingSync || isMarkedForRemoval) {
            console.log('⏭️ [SmartPoster] 預覽容器即將移除，跳過縮圖生成');
            return;
          }
        }
        
        // 標記為已生成（避免重複）
        videoElement.setAttribute('data-poster-generated', '1');
        
        console.log('🎬 [SmartPoster] 開始生成縮圖:', videoSrc);
        
        // 調用現有的 generateVideoPoster
        generateVideoPoster(videoElement);
        
        // 如果有預覽容器，移除 loading 狀態
        if (previewElement) {
          setTimeout(function() {
            if (previewElement.isConnected) {
              previewElement.classList.remove('loading');
            }
          }, 500);
        }
      } catch (e) {
        console.warn('⚠️ [SmartPoster] 本地縮圖生成失敗:', e);
        // 失敗時依賴後端輪詢機制
      }
    }
    
    return {
      init: init,
      
      /**
       * 處理容器內所有影片預覽（智能模式：可見立即處理，不可見延遲）
       * @param {HTMLElement} container - 容器元素
       */
      processContainer: function(container) {
        if (!container) return;
        
        try {
          var previews = container.querySelectorAll('.file-preview[data-preview-type="video"]');
          console.log('🎬 [SmartPoster] 處理容器內影片數量:', previews.length);
          
          if (!previews.length) return;
          
          previews.forEach(function(preview) {
            var video = preview.querySelector('video');
            if (!video) return;
            
            // 如果支援 IntersectionObserver，使用智能加載
            if (observer) {
              observer.observe(preview);
            } else {
              // 降級：立即生成
              generateForVideo(video, preview);
            }
          });
        } catch (e) {
          console.warn('⚠️ [SmartPoster] processContainer 失敗:', e);
        }
      },
      
      /**
       * 立即生成縮圖（用於剛上傳的影片，優先級最高）
       * @param {HTMLVideoElement} videoElement - video 元素
       */
      processImmediate: function(videoElement) {
        if (!videoElement) return;
        
        // 🔥 [修復] 檢查元素是否仍在 DOM 中
        if (!videoElement.isConnected) {
          console.log('⏭️ [SmartPoster] processImmediate: 影片元素已從 DOM 移除');
          return;
        }
        
        try {
          var preview = videoElement.closest('.file-preview');
          
          // 🔥 [修復] 再次確認預覽容器仍在 DOM 中
          if (!preview || !preview.isConnected) {
            console.log('⏭️ [SmartPoster] processImmediate: 預覽容器已從 DOM 移除');
            return;
          }
          
          generateForVideo(videoElement, preview);
        } catch (e) {
          console.warn('⚠️ [SmartPoster] processImmediate 失敗:', e);
        }
      },
      
      /**
       * 取消觀察（清理）
       */
      cleanup: function() {
        if (observer) {
          try {
            observer.disconnect();
          } catch (e) {}
        }
      }
    };
  })();
  if (!thumbReadyCache || typeof thumbReadyCache.add !== 'function') {
    try { thumbReadyCache = new Set(); }
    catch (e) {
      thumbReadyCache = {
        _map: {},
        add: function (key) { if (key) this._map[key] = true; },
        has: function (key) { return !!(key && this._map[key]); }
      };
    }
    window.__thumbReadyCache = thumbReadyCache;
  }
  function normalizeThumbKey(url) {
    if (!url) return '';
    try {
      var baseOrigin = (typeof window !== 'undefined' && window.location) ? (window.location.origin || (window.location.protocol + '//' + window.location.host)) : undefined;
      var parsed = new URL(url, baseOrigin);
      parsed.searchParams.delete('_t');
      return parsed.toString();
    } catch (e) {
      try {
        var idx = url.indexOf('?');
        if (idx === -1) return url;
        var base = url.substring(0, idx);
        var params = url.substring(idx + 1).split('&').filter(function (seg) {
          return seg && seg.split('=')[0] !== '_t';
        });
        return params.length ? (base + '?' + params.join('&')) : base;
      } catch (_) {
        return url;
      }
    }
  }
  function isThumbReady(url) {
    try {
      if (!url) return false;
      var key = normalizeThumbKey(url);
      return !!(key && thumbReadyCache && typeof thumbReadyCache.has === 'function' && thumbReadyCache.has(key));
    }
    catch (e) { return false; }
  }
  function rememberThumb(url) {
    try {
      if (!url) return;
      var key = normalizeThumbKey(url);
      if (key && thumbReadyCache && typeof thumbReadyCache.add === 'function') thumbReadyCache.add(key);
    }
    catch (e) {}
  }

  function ensurePosterErrorPanel() {
    try {
      if (posterErrorPanelEl && posterErrorPanelEl.parentNode) return posterErrorPanelEl;
      posterErrorPanelEl = document.getElementById('posterErrorPanel');
      return posterErrorPanelEl;
    } catch (e) {
      posterErrorPanelEl = null;
      return null;
    }
  }

  function pushPosterErrorMessage(context, detail) {
    try {
      var panel = ensurePosterErrorPanel();
      if (!panel) {
      posterErrorQueue.push({ context: context, detail: detail });
        if (posterErrorQueue.length > 5) posterErrorQueue.shift();
        return;
      }
      var text = '🎬 縮圖異常 ' + String(context || '未知') + '：' + String(detail || '未知錯誤');
      console.warn('[PosterError]', text);
      var entry = document.createElement('div');
      entry.className = 'poster-error-entry';
      entry.textContent = text;
      panel.appendChild(entry);
      requestAnimationFrame(function(){
        try { entry.classList.add('visible'); } catch (e) {}
      });
      panel.classList.add('show');
      while (panel.childNodes.length > 5) {
        try { panel.removeChild(panel.firstChild); } catch (e) {}
      }
      setTimeout(function(){
        try {
          entry.classList.remove('visible');
          setTimeout(function(){
            try { if (entry.parentNode) entry.parentNode.removeChild(entry); } catch (e) {}
            var p = ensurePosterErrorPanel();
            if (p && !p.childNodes.length) p.classList.remove('show');
          }, 220);
        } catch (err) {}
      }, 10000);
    } catch (err) {}
  }

  function schedulePosterRetry(videoEl, src) {
    try {
      if (!videoEl || !src) return;
      if (!videoEl.isConnected) return;
      var key = normalizeThumbKey(src || videoEl.getAttribute('data-src') || videoEl.getAttribute('src'));
      if (!key) return;
      if (!posterRetryRegistry[key]) posterRetryRegistry[key] = { count: 0, timer: null };
      var entry = posterRetryRegistry[key];
      if (entry.count >= POSTER_RETRY_LIMIT) return;
      if (entry.timer) {
        clearTimeout(entry.timer);
        entry.timer = null;
      }
      entry.count += 1;
      var delay = 400 * entry.count + 400;
      entry.timer = setTimeout(function () {
        entry.timer = null;
        if (!videoEl.isConnected) return;
        try { videoEl.removeAttribute('poster'); } catch (e) {}
        try { videoEl.__hasPoster = false; } catch (e) {}
        try { videoEl.__posterPromise = null; } catch (e) {}
        try { generateVideoPoster(videoEl); } catch (e) {}
      }, delay);
    } catch (err) {}
  }

  function reportPosterError(context, detail) {
    try {
      var toastFn = global.FLB && global.FLB.UI && typeof global.FLB.UI.toast === 'function' ? global.FLB.UI.toast : null;
      var key = context + '::' + String(detail || '').slice(0, 80);
      posterErrorRegistry[key] = (posterErrorRegistry[key] || 0) + 1;
      var firstHit = posterErrorRegistry[key] === 1;
      if (firstHit) pushPosterErrorMessage(context, detail);
      if (!firstHit) return;
      if (toastFn) {
        toastFn('🎬 縮圖異常 ' + context + '：' + String(detail || '未知錯誤'), 'warning');
      }
    } catch (e) {}
  }

  function getDriveRoot() {
    var root = window.SYNOLOGY_DRIVE_ROOT;
    if (!root || !String(root).trim()) {
      root = '/Fun Learn Bar/FLB-Learning-Portfolio';
    }
    root = String(root).trim();
    if (!root.startsWith('/')) {
      root = '/' + root;
    }
    return root.replace(/\/+$/, '');
  }

  function isSemesterSegment(val) {
    if (!val) return false;
    return /^(\d{3}-[12]|(?:夏令營|冬令營)-\d{4})$/i.test(String(val).trim());
  }

  function sanitizeDriveSegment(segment) {
    if (segment === undefined || segment === null) return '';
    
    // 🔥 使用統一的 DrivePathHelper（如果可用）
    if (window.drivePathHelper && window.drivePathHelper.sanitizeSegment) {
      // 預設為課程名稱段落，啟用週次清理
      return window.drivePathHelper.sanitizeSegment(segment, true);
    }
    
    // 備用邏輯
    var cleaned = String(segment);
    if (window.CourseNameCleaner && window.CourseNameCleaner.cleanCourseName) {
      cleaned = window.CourseNameCleaner.cleanCourseName(cleaned);
    } else {
      // 備用：移除週次標記
      cleaned = cleaned
        .replace(/\s+第\d+週/gi, '')
        .replace(/\s+第.{1,3}週/gi, '')
        .replace(/\s+week\s*\d+/gi, '')
        .replace(/\s+w\d+/gi, '');
    }
    
    // 再進行字元清理
    return cleaned
      .replace(/[<>:"|?*]/g, '')
      .replace(/[\\\/]/g, '-')
      .replace(/：/g, '-')
      .replace(/:/g, '-')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function normalizeSegmentForComparison(value) {
    if (!value) return '';
    return sanitizeDriveSegment(value)
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  function resolveSemesterSegment(info, cacheMeta) {
    var candidates = [];
    if (info && info.semester) candidates.push(info.semester);
    if (cacheMeta && cacheMeta.semester) candidates.push(cacheMeta.semester);
    if (currentCourse) {
      ['semester', 'semesterCode', 'semesterLabel', 'semesterName'].forEach(function (key) {
        if (currentCourse[key]) candidates.push(currentCourse[key]);
      });
      if (currentCourse.meta && currentCourse.meta.semester) {
        candidates.push(currentCourse.meta.semester);
      }
    }
    if (typeof window !== 'undefined' && window.ACTIVE_SEMESTER) candidates.push(window.ACTIVE_SEMESTER);
    if (typeof getCurrentSemester === 'function') candidates.push(getCurrentSemester());
    for (var i = 0; i < candidates.length; i++) {
      var candidate = String(candidates[i] || '').trim();
      if (candidate && isSemesterSegment(candidate)) {
        return candidate;
      }
    }
    var fallback = (typeof getCurrentSemester === 'function') ? getCurrentSemester() : '';
    return isSemesterSegment(fallback) ? fallback : '';
  }

  function shouldFallbackTopic(topicValue, coursePeriodValue) {
    if (!topicValue) return true;
    var topicNormalized = normalizeSegmentForComparison(topicValue);
    if (!topicNormalized) return true;
    if (topicNormalized === '課程') return true;
    var courseNormalized = normalizeSegmentForComparison(coursePeriodValue || '');
    if (courseNormalized && topicNormalized === courseNormalized) return true;
    return false;
  }

  function stripDriveRootPrefix(p) {
    var normalized = String(p || '').replace(/\\/g, '/').trim();
    if (!normalized) return '';
    normalized = normalized.replace(/\/{2,}/g, '/');
    var root = getDriveRoot();
    if (normalized.startsWith(root)) {
      normalized = normalized.slice(root.length);
    }
    return normalized.replace(/^\/+/, '');
  }

  function normalizeDriveRelativePath(relativePath, record, cacheEntry) {
    var base = relativePath || (record && (record.relativePath || record.recordPath || record.path)) || '';
    if (!base && cacheEntry && cacheEntry.entry && cacheEntry.entry.relativePath) {
      base = cacheEntry.entry.relativePath;
    }
    var cleaned = stripDriveRootPrefix(base);
    if (!cleaned) return '';
    var segments = cleaned.split('/').map(function (seg) { return seg.trim(); }).filter(Boolean);
    if (!segments.length) return '';
    if (!isSemesterSegment(segments[0])) {
      var metaInfo = cacheEntry && cacheEntry.info;
      var cacheMeta = cacheEntry && cacheEntry.cacheMeta;
      var fallbackSemester = (record && record.semester) ||
        (metaInfo && metaInfo.semester) ||
        (cacheMeta && cacheMeta.semester) ||
        (currentCourse && currentCourse.semester) || '';
      if (!fallbackSemester && record && record.path) {
        try {
          var parsed = parseFsCourseInfo(record.path, record.studentName || record.name);
          fallbackSemester = parsed && parsed.semester;
        } catch (e) {}
      }
      if (!fallbackSemester) {
        fallbackSemester = getCurrentSemester();
      }
      if (fallbackSemester) {
        segments.unshift(fallbackSemester);
      }
    }
    segments = segments.map(function (seg, idx) {
      if (!seg) return '';
      if (idx === 0 && isSemesterSegment(seg)) {
        return seg.trim();
      }
      return sanitizeDriveSegment(seg);
    }).filter(Boolean);
    return segments.join('/');
  }

  function ensureDriveAbsolutePath(p) {
    var cleanRoot = getDriveRoot();
    var target = String(p || '').trim();
    console.log('🔍 [ensureDriveAbsolutePath] 輸入:', { 
      input: p, 
      target: target,
      cleanRoot: cleanRoot,
      'target.startsWith(cleanRoot)': target.startsWith(cleanRoot)
    });
    
    if (!target) return cleanRoot;
    var normalized = target.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    if (normalized.startsWith(cleanRoot)) {
      console.log('🔍 [ensureDriveAbsolutePath] 已是絕對路徑:', normalized);
      return normalized;
    }
    normalized = normalized.replace(/^\/+/, '');
    var result = (cleanRoot + '/' + normalized).replace(/\/{2,}/g, '/');
    console.log('🔍 [ensureDriveAbsolutePath] 添加前綴後:', result);
    return result;
  }

  function buildDriveProxyPath(pathValue, filename) {
    try {
      var absolutePath = pathValue ? ensureDriveAbsolutePath(pathValue) : getDriveRoot();
      
      // 🔥 修復 2025-11-21：保留完整的 Drive 根路徑
      // 後端 /api/drive-media 端點需要完整的路徑來驗證安全性
      var driveRoot = getDriveRoot();
      var pathSegment = absolutePath;
      
      // 確保路徑以 Drive 根路徑開頭
      if (!absolutePath.startsWith(driveRoot)) {
        console.warn('⚠️ [buildDriveProxyPath] 路徑缺少 Drive 根前綴:', absolutePath);
        pathSegment = ensureDriveAbsolutePath(absolutePath);
      }
      
      var segments = [];
      
      // 🔥 關鍵修復：保留完整路徑，只對檔案名稱部分進行處理
      if (pathSegment) {
        var cleanPath = pathSegment.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
        // 直接使用完整路徑，不移除 Drive 根路徑
        segments.push(cleanPath.replace(/^\//, '')); // 移除開頭的斜線，但保留其餘部分
      }
      
      // 添加檔案名稱
      if (filename) {
        var cleanFilename = String(filename).trim();
        if (cleanFilename) {
          // 只對檔案名稱進行基本的清理，不移除路徑分隔符
          cleanFilename = cleanFilename
            .replace(/[<>:"|?*]/g, '')     // 移除 Windows 不合法字元
            .replace(/\\/, '/')             // 反斜線改為正斜線
            .replace(/\s+/g, ' ')           // 多個空白合併為一個
            .trim();
          segments.push(cleanFilename);
        }
      }
      
      if (!segments.length) return '';
      return segments.map(function (seg) { return encodeURIComponent(seg); }).join('/');
    } catch (e) {
      console.error('❌ [buildDriveProxyPath] 失敗:', e);
      return '';
    }
  }

  function buildDirectFileUrl(relativePath, filename, options) {
    options = options || {};
    var contextRecord = options.record || null;
    var cacheEntry = options.cacheEntry || null;
    
    // 🔥 處理 filename 可能是物件的情況（例如 {name: 'xxx.jpg', path: '...', size: ...}）
    var actualFilename = filename;
    if (!actualFilename) {
      console.warn('⚠️ buildDirectFileUrl: 缺少 filename', { relativePath });
      return '';
    }
    if (typeof actualFilename === 'object' && actualFilename !== null) {
      actualFilename = actualFilename.name || actualFilename.filename || actualFilename.path || '';
      if (!actualFilename) {
        console.warn('⚠️ buildDirectFileUrl: filename 物件缺少 name/filename/path 屬性', filename);
        return '';
      }
    }
    
    actualFilename = String(actualFilename || '').trim();
    if (!actualFilename) {
      console.warn('⚠️ buildDirectFileUrl: filename 為空', { filename, relativePath });
      return '';
    }
    
    // 🔥 修復 2025-11-21：直接確保路徑包含 Drive 根前綴
    // 不再使用 normalizeDriveRelativePath，因為它會移除前綴
    var processedPath = relativePath || (contextRecord && (contextRecord.relativePath || contextRecord.recordPath || contextRecord.path)) || '';
    if (!processedPath && cacheEntry && cacheEntry.entry && cacheEntry.entry.relativePath) {
      processedPath = cacheEntry.entry.relativePath;
    }
    
    console.log('🔍 [buildDirectFileUrl] 處理前:', { 
      originalPath: relativePath, 
      processedPath: processedPath,
      '是否為相對路徑': /^\d+-\d\//.test(processedPath)
    });
    
    // 確保路徑是絕對路徑且包含 Drive 根前綴
    var absolutePath = ensureDriveAbsolutePath(processedPath);
    console.log('🔍 [buildDirectFileUrl] ensureDriveAbsolutePath 後:', absolutePath);
    if (!absolutePath) {
      console.warn('⚠️ buildDirectFileUrl: 無法構建絕對路徑', { filename: actualFilename, relativePath, record: contextRecord && contextRecord.studentName });
      return '';
    }
    
    // 構建代理路徑（不再移除前綴）
    var proxyPath = buildDriveProxyPath(absolutePath, actualFilename);
    if (!proxyPath) {
      console.warn('⚠️ buildDirectFileUrl: 無法構建代理路徑', { absolutePath, actualFilename });
      return '';
    }
    
    var url = '/api/drive-media/' + proxyPath;
    if (options && options.cacheBust) {
      url += (url.indexOf('?') === -1 ? '?' : '&') + '_t=' + Date.now();
    }
    return url;
  }

  function markPreviewDeleting(previewEl, label) {
    if (!previewEl) return;
    previewEl.classList.add('preview-removing');
    previewEl.style.pointerEvents = 'none';
    var overlay = previewEl.querySelector('.file-uploading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'file-uploading-overlay';
      var span = document.createElement('span');
      span.className = 'progress-text';
      overlay.appendChild(span);
      previewEl.appendChild(overlay);
    }
    var textNode = overlay.querySelector('.progress-text');
    if (textNode) textNode.textContent = label || '刪除中...';
    // 🔥 [修復 2025-11-18] 不設定 inline style，由 CSS .preview-removing 控制
    // overlay.style.display = 'flex';
  }

  function clearPreviewDeleting(previewEl) {
    if (!previewEl) return;
    previewEl.classList.remove('preview-removing');
    previewEl.style.pointerEvents = '';
    var overlay = previewEl.querySelector('.file-uploading-overlay');
    // 🔥 [修復 2025-11-18] 不設定 inline style，由 CSS 控制
    // if (overlay) overlay.style.display = '';
    previewEl.style.opacity = '';
    previewEl.style.transform = '';
    delete previewEl.__removing;
  }

  function animatePreviewRemoval(previewEl) {
    if (!previewEl) return;
    if (previewEl.__removing) return;
    previewEl.__removing = true;
    previewEl.classList.add('preview-removing');
    requestAnimationFrame(function(){
      previewEl.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
      previewEl.style.opacity = '0';
      previewEl.style.transform = 'scale(0.92)';
    });
    setTimeout(function(){
      if (previewEl && previewEl.parentNode) {
        try { previewEl.parentNode.removeChild(previewEl); } catch (e) {}
      }
    }, 220);
  }

  function getServerMediaSet(type, studentName) {
    var map = serverMediaIndex[type];
    if (!studentName) studentName = '__anon__';
    if (!map[studentName]) map[studentName] = new Set();
    return map[studentName];
  }

  function rememberServerMediaList(studentName, type, list) {
    try {
      if (!Array.isArray(list)) return;
      var set = getServerMediaSet(type, studentName);
      list.forEach(function (name) { if (name) set.add(name); });
    } catch (e) {}
  }
  
  // 🔥 新增：清除学生的媒体缓存（用于删除文件后重新加载）
  function clearServerMediaCache(studentName, type) {
    try {
      var map = serverMediaIndex[type];
      if (!map) return;
      if (!studentName) studentName = '__anon__';
      if (map[studentName]) {
        map[studentName].clear();
        console.log('🧹 已清除快取:', studentName, type);
      }
    } catch (e) {
      console.error('❌ 清除媒體快取失敗:', e);
    }
  }
  
  // 🧹 清除所有學生的媒體快取（用於課程切換）
  function clearAllServerMediaCache() {
    try {
      console.log('🧹 清除所有伺服器媒體快取...');
      resetServerMediaIndex();
    } catch (e) {
      console.error('❌ 清除所有媒體快取失敗:', e);
    }
  }

  function computeServerMediaDiff(studentName, type, list) {
    var diff = [];
    try {
      if (!Array.isArray(list)) return diff;
      var set = getServerMediaSet(type, studentName);
      list.forEach(function (name) {
        if (!name) return;
        if (!set.has(name)) diff.push(name);
      });
    } catch (e) {}
    return diff;
  }

  function generatePosterForFile(file, previewNode, previewUrl) {
    try {
      if (!file || !previewNode) return;
      if (!(file.type || '').startsWith('video/')) return;
      var videoEl = previewNode.querySelector('video');
      if (!videoEl) return;
      var existing = videoEl.getAttribute('data-local-poster');
      if (existing) return;
      var targetUrl = previewUrl || videoEl.getAttribute('data-preview-url') || previewNode.getAttribute('data-preview-url');
      var blobUrl = targetUrl || URL.createObjectURL(file);
      if (!targetUrl) {
        videoEl.setAttribute('data-local-src', blobUrl);
      }
      var applyPoster = function (data) {
        try {
          if (data && data.length > 32) {
            var cacheKey = normalizeThumbKey(blobUrl || targetUrl || ('blob:' + Date.now()));
            videoPosterCache[cacheKey] = data;
            videoEl.setAttribute('poster', data);
            videoEl.setAttribute('data-local-poster', data);
            var posterImg = previewNode.querySelector('img.video-poster');
            if (posterImg) {
              posterImg.src = data;
              posterImg.style.display = 'block';
            }
            previewNode.classList.remove('video-fallback');
            var fallbackIcon = previewNode.querySelector('.video-fallback-icon');
            if (fallbackIcon) fallbackIcon.style.display = 'none';
            rememberThumb(cacheKey);
          } else {
            reportPosterError('poster-empty', file && file.name || targetUrl || '');
            var fallbackIcon2 = previewNode.querySelector('.video-fallback-icon');
            if (fallbackIcon2) fallbackIcon2.style.display = 'block';
            previewNode.classList.add('video-fallback');
          }
        } catch (e) {}
      };
      var preferFastPoster = !!file && file.size && file.size <= (120 * 1024 * 1024);
      var posterOptions = {
        keepObjectUrl: true,
        timeoutMs: preferFastPoster ? FAST_POSTER_TIMEOUT : DEFAULT_POSTER_TIMEOUT
      };
      if (preferFastPoster) {
        posterOptions.maxSamples = FAST_POSTER_SAMPLE_LIMIT;
      }
      // 以序列方式擷取，避免同時對多支影片取樣導致後面任務拿到空白幀
      PosterQueue.enqueue(function(){
        return capturePosterFromSource(blobUrl, posterOptions)
          .then(applyPoster)
          .catch(function (err) {
            reportPosterError('poster-queue', err && err.message || (file && file.name) || targetUrl || '');
          });
      }, { priority: 'high' });
    } catch (e) {}
  }

  function promoteAwaitingPreviews(studentIndex, type, newFiles, record) {
    try {
      // 🔥 [修復] 不檢查 newFiles，直接清除所有「同步中」佔位框
      var container = document.getElementById(type + '-preview-' + studentIndex);
      if (!container) return;
      
      var awaiting = Array.prototype.slice.call(container.querySelectorAll('.file-preview.new-upload[data-awaiting-sync="1"]'));
      
      // 🔥 如果有佔位節點，直接移除（伺服器已經回傳正確檔案）
      if (awaiting.length > 0) {
        console.log('🗑️ [promoteAwaitingPreviews] 移除', awaiting.length, '個「同步中」佔位框');
        awaiting.forEach(function(node) {
          try {
            revokePreviewObjectUrl(node);
            node.remove();
            console.log('✅ 已移除佔位節點:', node.getAttribute('data-file-id'));
          } catch (e) {
            console.warn('⚠️ 移除佔位節點失敗:', e);
          }
        });
      }
      
      return; // 不再需要其他處理，讓正常的渲染流程顯示伺服器檔案
      
      /* 舊邏輯保留作為參考
      var studentName = record.studentName || (studentFiles[studentIndex] && studentFiles[studentIndex].name) || '';
      var typeIsVideo = type === 'videos';
      var typeIsPhoto = type === 'photos';
      var thumbMap = typeIsVideo ? (record.videoThumbnails || (record.files && record.files.videoThumbnails) || {}) : null;
      var state = studentFiles[studentIndex] || null;
      
      newFiles.forEach(function (filename) {
        var driveOpts = { record: record };
        var previewUrl = buildDirectFileUrl(record.relativePath, filename, driveOpts);
        var thumbName = typeIsVideo && thumbMap ? thumbMap[filename] : '';
        var thumbUrl = thumbName ? buildDirectFileUrl(record.relativePath, thumbName, driveOpts) : '';
        var handler = "return deleteStudentFile(this, '" + String(studentName || '').replace(/'/g, "\\'") + "', '" + String(filename || '').replace(/'/g, "\\'") + "')";
        
        var placeholder = awaiting.shift();
        
        // 🔥 照片特殊處理：保留本地 Blob URL 作為臨時預覽
        if (typeIsPhoto && placeholder) {
          var img = placeholder.querySelector('img');
          var localBlobUrl = img ? img.src : '';
          
          // 如果是本地 Blob URL，先保留它，等靜默輪詢替換
          if (localBlobUrl && localBlobUrl.indexOf('blob:') === 0) {
            console.log('🔄 [promoteAwaitingPreviews] 保留本地照片預覽:', filename, '等待後端縮圖就緒');
            
            // 🔥 移除上傳覆蓋層（顯示底層預覽）
            var uploadOverlay = placeholder.querySelector('.file-uploading-overlay');
            if (uploadOverlay) {
              uploadOverlay.remove();
              console.log('✅ [promoteAwaitingPreviews] 移除上傳覆蓋層，顯示本地預覽');
            }
            
            // 不移除 placeholder，而是更新它的屬性
            placeholder.setAttribute('data-preview-url', previewUrl);
            placeholder.setAttribute('data-filename', filename);
            placeholder.setAttribute('data-thumb-ready', '0');  // 標記為未就緒
            placeholder.setAttribute('data-awaiting-backend', '1');  // 標記為等待後端
            placeholder.classList.remove('new-upload', 'uploading', 'loading');
            placeholder.classList.remove('data-awaiting-sync');  // 移除 data-awaiting-sync
            placeholder.setAttribute('data-awaiting-sync', '0');  // 更新屬性為 0
            placeholder.classList.add('awaiting-backend-thumb');  // 新增樣式類別
            
            // 🔥 添加微妙的視覺指示器（等待後端）
            var waitingIndicator = placeholder.querySelector('.waiting-backend-indicator');
            if (!waitingIndicator) {
              waitingIndicator = document.createElement('div');
              waitingIndicator.className = 'waiting-backend-indicator';
              waitingIndicator.style.cssText = 'position:absolute;top:4px;left:4px;background:rgba(59,130,246,0.9);color:white;padding:2px 6px;border-radius:4px;font-size:10px;pointer-events:none;z-index:2;';
              waitingIndicator.innerHTML = '<i class="fas fa-sync fa-spin" style="font-size:8px;margin-right:4px;"></i>處理中';
              placeholder.appendChild(waitingIndicator);
            }
            
            // 添加刪除按鈕
            var existingRemoveBtn = placeholder.querySelector('.remove-preview');
            if (!existingRemoveBtn) {
              var removeBtn = document.createElement('button');
              removeBtn.className = 'remove-preview';
              removeBtn.setAttribute('onclick', handler);
              removeBtn.innerHTML = '<i class="fas fa-times"></i>';
              placeholder.appendChild(removeBtn);
            }
            
            // 不釋放 Blob URL，讓靜默輪詢機制處理
            return;
          }
        }
        
        // 🔥 影片特殊處理：保留本地預覽直到後端縮圖就緒
        if (typeIsVideo && placeholder) {
          var video = placeholder.querySelector('video');
          var localSrc = video && (video.getAttribute('data-local-src') || video.src) || '';
          
          // 如果有本地影片源，保留它用於播放
          if (localSrc && localSrc.indexOf('blob:') === 0) {
            console.log('🔄 [promoteAwaitingPreviews] 保留本地影片預覽:', filename, '等待後端縮圖就緒');
            
            // 🔥 移除上傳覆蓋層（顯示底層預覽）
            var uploadOverlay = placeholder.querySelector('.file-uploading-overlay');
            if (uploadOverlay) {
              uploadOverlay.remove();
              console.log('✅ [promoteAwaitingPreviews] 移除影片上傳覆蓋層');
            }
            
            // 更新屬性
            placeholder.setAttribute('data-preview-url', previewUrl);
            placeholder.setAttribute('data-filename', filename);
            placeholder.setAttribute('data-thumb-ready', thumbUrl ? '1' : '0');
            placeholder.setAttribute('data-awaiting-backend', thumbUrl ? '0' : '1');
            placeholder.classList.remove('new-upload', 'uploading', 'loading');
            placeholder.classList.remove('data-awaiting-sync');
            placeholder.setAttribute('data-awaiting-sync', '0');
            
            // 如果還沒有縮圖，添加等待指示器
            if (!thumbUrl) {
              placeholder.classList.add('awaiting-backend-thumb');
              var waitingIndicator = placeholder.querySelector('.waiting-backend-indicator');
              if (!waitingIndicator) {
                waitingIndicator = document.createElement('div');
                waitingIndicator.className = 'waiting-backend-indicator';
                waitingIndicator.style.cssText = 'position:absolute;top:4px;left:4px;background:rgba(239,68,68,0.9);color:white;padding:2px 6px;border-radius:4px;font-size:10px;pointer-events:none;z-index:2;';
                waitingIndicator.innerHTML = '<i class="fas fa-sync fa-spin" style="font-size:8px;margin-right:4px;"></i>生成中';
                placeholder.appendChild(waitingIndicator);
              }
            }
            
            // 添加刪除按鈕
            var existingRemoveBtn = placeholder.querySelector('.remove-preview');
            if (!existingRemoveBtn) {
              var removeBtn = document.createElement('button');
              removeBtn.className = 'remove-preview';
              removeBtn.setAttribute('onclick', handler);
              removeBtn.innerHTML = '<i class="fas fa-times"></i>';
              placeholder.appendChild(removeBtn);
            }
            
            // 🔥 重新生成本地縮圖（移除覆蓋層後可能需要）
            if (video) {
              setTimeout(function() {
                processPosterImmediate(video);
              }, 150);
            }
            
            // 不釋放 Blob URL
            return;
          }
        }
        
        // 🔥 其他情況：使用原有邏輯
        var relatedFromPromotion = [];
        if (typeIsVideo) {
          addRelatedFile(relatedFromPromotion, thumbName);
        }
        var html = buildMediaPreviewHtml({
          type: typeIsVideo ? 'video' : 'image',
          previewUrl: previewUrl,
          thumbUrl: thumbUrl,
          filename: filename,
          removable: true,
          removeHandler: handler,
          lazy: !thumbUrl,
          forceReady: !!thumbUrl,
          recordPath: record && (record.relativePath || record.recordPath || record.path) || '',
          relatedFiles: relatedFromPromotion
        });
        
        if (placeholder) {
          try { revokePreviewObjectUrl(placeholder); } catch (e) {}
          placeholder.insertAdjacentHTML('afterend', html);
          try { placeholder.remove(); } catch (e) {}
        } else {
          container.insertAdjacentHTML('beforeend', html);
        }
        
        if (state && state.localFiles) {
          if (typeIsVideo && Array.isArray(state.localFiles.videos) && state.localFiles.videos.length) state.localFiles.videos.shift();
          if (!typeIsVideo && Array.isArray(state.localFiles.photos) && state.localFiles.photos.length) state.localFiles.photos.shift();
        }
      });
      
      try {
        setupLazyMedia(container);
        attachThumbLoadingHandlers(container);
        
        // 🔥 生成影片縮圖（上傳完成後從後端獲取記錄時）
        if (typeIsVideo) {
          processPosterContainer(container);
        }
      } catch (e) {}
      */
    } catch (err) {
      console.warn('⚠️ [promoteAwaitingPreviews] 執行失敗:', err);
    }
  }

  // ==================== 靜默縮圖輪詢（避免頁面跳動）====================
  
  /**
   * 🔥 靜默檢查學生照片縮圖狀態
   * 保留本地 Blob URL 直到後端縮圖就緒，避免預覽消失
   */
  function silentCheckStudentPhotoThumbnails(studentIndex, studentName) {
    if (!studentName) return Promise.resolve(false);
    
    // 🔍 嘗試從多個來源獲取 date
    var dateValue = currentCourse.date || currentCourse.classDate || currentCourse.day || '';
    
    // 如果還是空的，嘗試從 URL 參數獲取
    if (!dateValue) {
      try {
        var urlParams = new URLSearchParams(window.location.search);
        dateValue = urlParams.get('date') || '';
      } catch (e) {}
    }
    
    // 如果還是空的，不調用 API（避免 400 錯誤）
    if (!dateValue) {
      console.warn('⚠️ [照片-靜默輪詢] 無法獲取 date 參數，跳過檢查');
      return Promise.resolve(false);
    }
    
    // 調用 lookup-student API（輕量級，只返回一個學生的數據）
    var params = new URLSearchParams({
      coursePeriod: currentCourse.courseName || '',
      date: dateValue,
      studentName: studentName
    });
    
    return fetch('/api/learning-records/lookup-student?' + params.toString())
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data || !data.success || !data.record) {
          return false;
        }
        
        var record = data.record;
        var card = document.getElementById('student-card-' + studentIndex);
        if (!card) return false;
        
        var photoPreviews = card.querySelectorAll('.file-preview[data-preview-type="image"]');
        var updatedCount = 0;
        
        photoPreviews.forEach(function(preview) {
          // 檢查是否還在使用本地 Blob URL
          var img = preview.querySelector('img');
          if (!img) return;
          
          var currentSrc = img.src || '';
          
          // 如果已經是後端 URL，跳過
          if (currentSrc.indexOf('/api/drive-media/') > -1 || 
              currentSrc.indexOf('/api/learning-records/') > -1) {
            return;
          }
          
          // 如果是本地 Blob URL，嘗試替換為後端 URL
          if (currentSrc.indexOf('blob:') === 0) {
            var filename = preview.getAttribute('data-filename');
            if (!filename && record.files && record.files.photos.length > updatedCount) {
              var photoItem = record.files.photos[updatedCount];
              // 🔥 處理 photoItem 可能是物件的情況
              filename = typeof photoItem === 'string' ? photoItem : (photoItem && (photoItem.name || photoItem.filename || photoItem.path)) || '';
            }
            
            if (filename) {
              // 構建後端縮圖 URL
              var thumbnailUrl = buildDirectFileUrl(record.relativePath, filename, { record: record });
              
              // 🔥 先檢查縮圖是否可用（HEAD 請求）
              fetch(thumbnailUrl, { method: 'HEAD' })
                .then(function(res) {
                  if (res.ok) {
                    // 縮圖已就緒，替換為後端 URL
                    img.src = thumbnailUrl;
                    preview.classList.remove('loading', 'awaiting-backend-thumb');
                    preview.classList.add('loaded');
                    preview.setAttribute('data-thumb-ready', '1');
                    preview.setAttribute('data-preview-url', thumbnailUrl);
                    preview.setAttribute('data-awaiting-backend', '0');
                    
                    // 🔥 移除「處理中」指示器
                    var waitingIndicator = preview.querySelector('.waiting-backend-indicator');
                    if (waitingIndicator) {
                      waitingIndicator.remove();
                      console.log('✅ [照片-靜默更新] 移除「處理中」指示器');
                    }
                    
                    // 釋放本地 Blob URL
                    try {
                      URL.revokeObjectURL(currentSrc);
                      console.log('✅ [照片-靜默更新] 釋放 Blob URL:', currentSrc.substring(0, 30) + '...');
                    } catch (e) {}
                    
                    updatedCount++;
                    console.log('✅ [照片-靜默更新] 縮圖:', filename, '從 Blob 切換到後端');
                  }
                })
                .catch(function(err) {
                  console.log('🕒 [照片-靜默更新] 縮圖尚未就緒:', filename);
                });
            }
          }
        });
        
        // 返回是否有更新（異步的，所以這裡總是返回 true 表示嘗試過）
        return true;
      })
      .catch(function(err) {
        console.warn('⚠️ [照片-靜默輪詢失敗]:', err);
        return false;
      });
  }
  
  /**
   * 靜默檢查學生影片縮圖狀態
   * 只更新縮圖圖片，不重繪整個卡片
   */
  function silentCheckStudentVideoThumbnails(studentIndex, studentName) {
    if (!studentName) return Promise.resolve();
    
    // 🔍 嘗試從多個來源獲取 date
    var dateValue = currentCourse.date || currentCourse.classDate || currentCourse.day || '';
    
    // 如果還是空的，嘗試從 URL 參數獲取
    if (!dateValue) {
      try {
        var urlParams = new URLSearchParams(window.location.search);
        dateValue = urlParams.get('date') || '';
      } catch (e) {}
    }
    
    // 如果還是空的，不調用 API（避免 400 錯誤）
    if (!dateValue) {
      console.warn('⚠️ [靜默輪詢] 無法獲取 date 參數，跳過檢查');
      return Promise.resolve();
    }
    
    // 調用 lookup-student API（輕量級，只返回一個學生的數據）
    var params = new URLSearchParams({
      coursePeriod: currentCourse.courseName || '',
      date: dateValue,
      studentName: studentName
    });
    
    return fetch('/api/learning-records/lookup-student?' + params.toString())
      .then(function(res) { return res.json(); })
      .then(function(data) {
        if (!data.success || !data.record) return false;
        
        var record = data.record;
        var videoThumbnails = record.videoThumbnails || (record.files && record.files.videoThumbnails) || {};
        
        // 🔍 檢查是否有新的縮圖
        var hasNewThumbnails = Object.keys(videoThumbnails).length > 0;
        console.log('🔍 [靜默輪詢] 學生:', studentName, '縮圖數量:', Object.keys(videoThumbnails).length);
        
        if (!hasNewThumbnails) return false;  // 沒有新縮圖，不更新
        
        // 🔥 只更新影片方塊的縮圖部分（不重繪整個卡片）
        var card = document.querySelector('.student-upload-card[data-student-index="' + studentIndex + '"]');
        if (!card) return false;
        
        var videoPreviews = card.querySelectorAll('.file-preview[data-preview-type="video"]');
        var updatedCount = 0;
        
        videoPreviews.forEach(function(preview) {
          if (preview.getAttribute('data-thumb-ready') === '1') return;
          
          var videoUrl = preview.getAttribute('data-preview-url') || '';
          if (!videoUrl) return;
          
          var filenameKey = preview.getAttribute('data-source-filename') ||
                            preview.getAttribute('data-filename') || '';
          var thumbName = filenameKey ? videoThumbnails[filenameKey] : null;
          var thumbUrl = '';
          var thumbCacheKey = studentName + ':' + (filenameKey || videoUrl);
          
          if (thumbName) {
            thumbUrl = buildRecordFileUrl(record, thumbName);
          }
          
          if (!thumbUrl) {
            console.warn('⏭️ [影片-靜默更新] 找不到 Drive 縮圖對應檔案，跳過:', {
              student: studentName,
              filenameKey: filenameKey
            });
            return;
          }
          
          var posterImg = preview.querySelector('.video-poster');
          var fallbackIcon = preview.querySelector('.video-fallback-icon');
          var thumbLoading = preview.querySelector('.thumb-loading');
          
          if (!posterImg) return;
          
          if (posterImg.src && posterImg.style.display !== 'none' && posterImg.complete) {
            console.log('⏭️ [影片-靜默更新] 縮圖已存在，跳過:', filenameKey || videoUrl);
            return;
          }
          
          posterImg.src = thumbUrl + (thumbUrl.indexOf('?') > -1 ? '&' : '?') + 't=' + Date.now();
          posterImg.style.display = '';
          if (fallbackIcon) fallbackIcon.style.display = 'none';
          if (thumbLoading) thumbLoading.remove();
          preview.classList.remove('loading', 'awaiting-backend-thumb');
          preview.classList.add('loaded');
          preview.setAttribute('data-thumb-ready', '1');
          preview.setAttribute('data-awaiting-backend', '0');
          
          var waitingIndicator = preview.querySelector('.waiting-backend-indicator');
          if (waitingIndicator) {
            waitingIndicator.remove();
            console.log('✅ [影片-靜默更新] 移除「生成中」指示器');
          }
          
          videoThumbnailReadyCache[thumbCacheKey] = true;
          updatedCount++;
          console.log('✅ [影片-靜默更新] 縮圖已更新:', thumbCacheKey);
        });
        
        if (updatedCount > 0) {
          console.log('✅ [靜默輪詢完成] 更新了', updatedCount, '個縮圖，無頁面跳動');
          return true;
        }
        return false;
      })
      .catch(function(err) {
        console.warn('⚠️ [靜默輪詢失敗]:', err);
        return false;
      });
  }

  function buildMediaPreviewHtml(options) {
    options = options || {};
    var type = options.type === 'video' ? 'video' : 'image';
    var previewUrl = String(options.previewUrl || '');
    var thumbUrl = String(options.thumbUrl || '');
    var filename = options.filename || '';
    var sourceFilename = options.sourceFilename || filename || '';
    var videoIdValue = options.videoId || '';
    var altText = options.alt || filename || '';
    var removable = !!options.removable;
    var removeHandler = removable ? (options.removeHandler || '') : '';
    var lazy = !!options.lazy;
    var extraClasses = Array.isArray(options.extraClasses) ? options.extraClasses.slice() : [];
    var baseAlt = FLB && FLB.Course && typeof FLB.Course.escapeHtml === 'function'
      ? FLB.Course.escapeHtml(altText)
      : altText.replace(/[<>&"]/g, '');
    var safePreviewUrl = FLB && FLB.Course && typeof FLB.Course.escapeHtml === 'function'
      ? FLB.Course.escapeHtml(previewUrl)
      : previewUrl.replace(/[<>&"]/g, '');
    var safeThumbUrl = FLB && FLB.Course && typeof FLB.Course.escapeHtml === 'function'
      ? FLB.Course.escapeHtml(thumbUrl)
      : thumbUrl.replace(/[<>&"]/g, '');
    var safeFilename = FLB && FLB.Course && typeof FLB.Course.escapeHtml === 'function'
      ? FLB.Course.escapeHtml(filename)
      : String(filename || '').replace(/[<>&"]/g, '');
    var safeSourceFilename = '';
    if (sourceFilename) {
      safeSourceFilename = FLB && FLB.Course && typeof FLB.Course.escapeHtml === 'function'
        ? FLB.Course.escapeHtml(sourceFilename)
        : String(sourceFilename || '').replace(/[<>&"]/g, '');
    }
    var safeVideoId = '';
    if (videoIdValue) {
      safeVideoId = FLB && FLB.Course && typeof FLB.Course.escapeHtml === 'function'
        ? FLB.Course.escapeHtml(String(videoIdValue))
        : String(videoIdValue || '').replace(/[<>&"]/g, '');
    }
    var forceReady = !!options.forceReady;
    var ready = forceReady;
    if (!ready) {
      if (type === 'image') {
        ready = isThumbReady(previewUrl);
      } else if (thumbUrl) {
        try {
          var posterKey = normalizeThumbKey(previewUrl);
          videoPosterCache[posterKey] = thumbUrl;
        } catch (e) {}
        ready = isThumbReady(thumbUrl);
      }
    }
    if (ready) {
      if (type === 'image') rememberThumb(previewUrl);
      else if (thumbUrl) rememberThumb(thumbUrl);
    }
    if (forceReady && !ready) {
      ready = true;
      if (type === 'image') rememberThumb(previewUrl);
      else if (thumbUrl) rememberThumb(thumbUrl);
    }
    var classes = ['file-preview', 'existing', ready ? 'loaded' : 'loading', 'preview-clickable'];
    if (lazy) classes.push('lazy');
    if (type === 'video' && !thumbUrl) classes.push('video-fallback');
    extraClasses.forEach(function (cls) { if (cls && classes.indexOf(cls) === -1) classes.push(cls); });
    
    // 🔍 [調試] 檢查是否包含 synced-preview
    if (extraClasses && extraClasses.indexOf('synced-preview') !== -1) {
      console.log('✅ [buildMediaPreviewHtml] 添加 synced-preview 類別:', {
        type: type,
        filename: filename,
        extraClasses: extraClasses,
        finalClasses: classes
      });
    }
    var recordPathAttr = options.recordPath || '';
    var mediaIdAttr = options.mediaId || '';
    var relatedFilesList = Array.isArray(options.relatedFiles) ? options.relatedFiles.filter(Boolean) : [];
    var attrs = ' data-preview-type="' + type + '" data-preview-url="' + safePreviewUrl + '"';
    if (filename) attrs += ' data-filename="' + safeFilename + '"';
    if (safeSourceFilename) attrs += ' data-source-filename="' + safeSourceFilename + '"';
    if (safeVideoId) attrs += ' data-video-id="' + safeVideoId + '"';
    if (filename) attrs += ' data-file-name="' + encodeDataAttr(filename) + '"';
    if (type === 'video' && !thumbUrl) attrs += ' data-static-thumb="1"';
    if (ready) attrs += ' data-thumb-ready="1"';
    if (recordPathAttr) {
      attrs += ' data-record-path="' + encodeDataAttr(recordPathAttr) + '"';
    }
    if (mediaIdAttr) {
      attrs += ' data-media-id="' + encodeDataAttr(mediaIdAttr) + '"';
    }
    if (relatedFilesList.length) {
      try {
        var encodedRelated = encodeDataAttr(JSON.stringify(relatedFilesList));
        attrs += ' data-related-files="' + encodedRelated + '"';
      } catch (attrErr) {}
    }
    
    // 🔍 調試：輸出 data-preview-url（影片類型）
    if (type === 'video') {
      console.log('🎬 [buildMediaPreviewHtml] 建立影片方塊:', {
        'previewUrl(影片)': previewUrl,
        'thumbUrl(縮圖)': thumbUrl,
        'data-preview-url將設為': safePreviewUrl,
        '是否為縮圖': previewUrl.indexOf('.thumb.jpg') > -1 || previewUrl.indexOf('.preview.jpg') > -1
      });
    }
    // 🔥 檢測 HEIC 格式（瀏覽器不支援預覽）
    var isHeic = /\.heic$/i.test(filename) || /\.heif$/i.test(filename);
    
    // 🔥 [簡化 2025-11-23] 直接刪除旋轉載入指示器邏輯
    var innerHtml = '';
    if (type === 'image') {
      if (isHeic) {
        // 🔥 HEIC 格式：顯示占位圖標和提示
        innerHtml = '<div class="heic-placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:20px;min-height:120px;text-align:center;border-radius:8px;">';
        innerHtml += '<i class="fas fa-image" style="font-size:48px;margin-bottom:10px;opacity:0.9;"></i>';
        innerHtml += '<div style="font-size:14px;font-weight:500;margin-bottom:5px;">HEIC 格式</div>';
        innerHtml += '<div style="font-size:12px;opacity:0.8;">' + safeFilename + '</div>';
        innerHtml += '<div style="font-size:11px;opacity:0.7;margin-top:8px;">✅ 已上傳 (瀏覽器不支援預覽)</div>';
        innerHtml += '</div>';
      } else if (ready || !lazy) {
        innerHtml = '<img src="' + safePreviewUrl + '" alt="' + baseAlt + '" onerror="this.onerror=null;var container=this.closest(\'.file-preview\');if(container){container.innerHTML=\'<div style=\\\'text-align:center;padding:20px;color:#888;\\\'><i class=\\\'fas fa-exclamation-triangle\\\'></i><br>載入失敗</div>\'}">';
      } else {
        innerHtml = '<img loading="lazy" data-src="' + safePreviewUrl + '" alt="' + baseAlt + '" onerror="this.onerror=null;var container=this.closest(\'.file-preview\');if(container){container.innerHTML=\'<div style=\\\'text-align:center;padding:20px;color:#888;\\\'><i class=\\\'fas fa-exclamation-triangle\\\'></i><br>載入失敗</div>\'}">';
      }
    } else {
      // 🔥 [修復] 當縮圖 URL 存在時，先嘗試顯示縮圖，如果 404 則從影片生成
      // 始終創建 video 元素（用於 SmartPosterGenerator 生成縮圖作為 fallback）
      var videoAttr = lazy ? ' data-src="' + safePreviewUrl + '"' : ' src="' + safePreviewUrl + '"';
      if (thumbUrl) {
        // 🔥 [修復] 有縮圖 URL：先顯示縮圖 img，如果載入失敗則顯示備用圖標
        // 不再嘗試從 video 生成縮圖，避免 404 錯誤
        innerHtml = '<img class="video-thumbnail-img" src="' + safeThumbUrl + '" alt="' + baseAlt + ' 縮圖" onerror="this.onerror=null;this.style.display=\'none\';var container=this.closest(\'.file-preview\');if(container){var fallbackIcon=container.querySelector(\'.video-fallback-icon\');if(fallbackIcon){fallbackIcon.style.display=\'flex\';}container.classList.add(\'video-fallback\');console.log(\'⚠️ [縮圖載入失敗] 不嘗試從 video 生成（可能 404）:\',this.src);}" style="display:block;">';
        innerHtml += '<video' + videoAttr + ' preload="metadata" muted playsinline crossorigin="anonymous" style="display:none;"></video>';
        innerHtml += '<img class="video-poster" alt="" aria-hidden="true" style="display:none;" />';
        innerHtml += '<div class="video-fallback-icon" style="display:none;align-items:center;justify-content:center;background:#f1f5f9;color:#64748b;font-size:48px;width:100%;height:100%;min-height:120px;" aria-hidden="true">🎬</div>';
      } else {
        // 沒有縮圖 URL：直接使用 video 元素，讓 SmartPosterGenerator 生成縮圖
        var posterAttr = ' style="display:none" src=""';
        innerHtml =
          '<video' + videoAttr + ' preload="metadata" muted playsinline crossorigin="anonymous"></video>' +
          '<img class="video-poster" alt="" aria-hidden="true"' + posterAttr + ' />' +
          '<div class="video-fallback-icon" aria-hidden="true">🎬</div>';
      }
    }
    var removeHtml = '';
    if (removable && removeHandler) {
      var safeHandler = String(removeHandler).replace(/"/g, '&quot;');
      removeHtml = '<button class="remove-btn" onclick="' + safeHandler + '"><i class="fas fa-times"></i></button>';
    }
    
    // 🔥 媒體類型標籤（照片/影片）
    var mediaTypeLabel = '';
    if (options.showTypeLabel !== false) {  // 預設顯示，可透過 showTypeLabel: false 關閉
      if (type === 'image') {
        mediaTypeLabel = '<div class="media-type-badge photo-badge"><i class="fas fa-image"></i></div>';
      } else {
        mediaTypeLabel = '<div class="media-type-badge video-badge"><i class="fas fa-video"></i></div>';
      }
    }
    
    // 🔥 [簡化 2025-11-23] 移除 loadingHtml，直接返回不含旋轉載入指示器的 HTML
    return '<div class="' + classes.join(' ') + '"' + attrs + '>' + innerHtml + removeHtml + mediaTypeLabel + '</div>';
  }
  // 🚦 上傳傳輸量管控（位元組預算）：允許併發，但限制同時上傳中的總位元組量，避免塞爆頻寬/NAS
  var UploadBudget = (function(){
    var MAX_BUDGET = 40 * 1024 * 1024; // 40MB 同時上限（可依網路條件調整）
    try {
      var dl = (navigator.connection && navigator.connection.downlink) ? navigator.connection.downlink : 0;
      if (dl && dl < 2) MAX_BUDGET = 16 * 1024 * 1024; // 慢速網路收斂
      else if (dl && dl > 10) MAX_BUDGET = 64 * 1024 * 1024; // 快速網路放寬
    } catch (e) {}
    var MAX_UNIT = Math.max(1, Math.floor(MAX_BUDGET * 0.9));
    var used = 0; var q = [];
    function pump(){
      var i = 0;
      while (i < q.length) {
        var it = q[i];
        if (used + it.size <= MAX_BUDGET) {
          used += it.size; q.splice(i,1); try { it.resolve({ token: {}, size: it.size }); } catch (e) {}
        } else { i++; }
      }
    }
    return {
      acquire: function(size){
        size = Math.max(1, size | 0);
        var unit = Math.min(size, MAX_UNIT);
        return new Promise(function(resolve){
          if (used + unit <= MAX_BUDGET) { used += unit; resolve({ token: {}, size: unit }); }
          else { q.push({ size: unit, resolve: resolve }); pump(); }
        });
      },
      release: function(tok){
        try { used = Math.max(0, used - (tok && tok.size || 0)); } catch (e) { used = 0; }
        pump();
      },
      info: function(){ return { max: MAX_BUDGET, used: used }; }
    };
  })();

  function processPosterContainer(container) {
    if (!container || !SmartPosterGenerator) return;
    if (isMobileDevice()) {
      return;
    }
    try {
      processPosterContainer(container);
    } catch (err) {
      console.warn('⚠️ [Poster] 容器處理失敗:', err);
    }
  }

  function processPosterImmediate(videoEl) {
    if (!videoEl || !SmartPosterGenerator) return;
    if (isMobileDevice()) return;
    try {
      processPosterImmediate(videoEl);
    } catch (err) {
      console.warn('⚠️ [Poster] 即時處理失敗:', err);
    }
  }

  // 🔥 URL 參數解析（備援機制：當 FLB.UrlParams 未載入時直接解析）
  function parseUrlParams() {
    try {
      // 先取舊版解析結果，再以原始 URL 參數補齊缺漏的鍵（course/topic/student/autoLoad）
      var base = {};
      if (global.FLB && FLB.UrlParams && typeof FLB.UrlParams.getTargetInfo === 'function') {
        try { base = FLB.UrlParams.getTargetInfo() || {}; } catch (e) { base = {}; }
      }
      var sp = new URLSearchParams(global.location.search);
      var merged = {
        eventId: (base.eventId || sp.get('eventId') || '').trim(),
        date: (base.date || sp.get('date') || '').trim(),
        time: (base.time || sp.get('time') || '').trim(),
        end: (base.end || sp.get('end') || '').trim(),
        instructor: (base.instructor || sp.get('instructor') || '').trim(),
        course: (base.course || sp.get('course') || '').trim(),
        topic: (base.topic || sp.get('topic') || '').trim(),
        student: (base.student || sp.get('student') || '').trim(),
        autoLoad: ('' + (base.autoLoad != null ? base.autoLoad : (sp.get('autoLoad') || ''))).trim()
      };
      return merged;
    } catch (e) {
      console.error('❌ URL 參數解析失敗:', e);
      return { eventId: '', date: '', time: '', instructor: '', course: '', topic: '', student: '', autoLoad: '' };
    }
  }

  var initialDeepLinkParams = parseUrlParams();
  console.log('🔗 [URL 參數] 初始參數:', initialDeepLinkParams);
  // 若舊版解析缺少 course/autoLoad，但 URL 有，這裡再次合併一次以保險
  try {
    var sp2 = new URLSearchParams(global.location.search);
    if (!initialDeepLinkParams.course && sp2.has('course')) {
      initialDeepLinkParams.course = (sp2.get('course') || '').trim();
    }
    if (!initialDeepLinkParams.autoLoad && sp2.has('autoLoad')) {
      initialDeepLinkParams.autoLoad = (sp2.get('autoLoad') || '').trim();
    }
  } catch (e) {}
  
  try {
    if (initialDeepLinkParams && (initialDeepLinkParams.eventId || initialDeepLinkParams.date)) {
      window.__deepLinkInfo = Object.assign({}, initialDeepLinkParams);
      console.log('✅ [URL 參數] DeepLink 資訊已設定:', window.__deepLinkInfo);
    } else {
      window.__deepLinkInfo = null;
      console.warn('⚠️ [URL 參數] 無有效的 DeepLink 參數');
    }
  } catch (e) {
    console.error('❌ [URL 參數] DeepLink 設定失敗:', e);
    window.__deepLinkInfo = null;
  }

  // ==================== 時區工具（台灣時區一致化） ====================
  function formatDateTWISO(d) {
    try {
      var dd = (d instanceof Date) ? d : new Date(d);
      var s = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dd);
      var m = s.match(/(\d{4})\D(\d{2})\D(\d{2})/);
      return m ? (m[1] + '-' + m[2] + '-' + m[3]) : dd.toISOString().split('T')[0];
    } catch (e) { try { return new Date(d).toISOString().split('T')[0]; } catch (e2) { return ''; } }
  }
  function formatTimeHHMMTW(d) {
    try {
      var dd = (d instanceof Date) ? d : new Date(d);
      var s = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false }).format(dd);
      // 確保為 HH:MM
      var mm = s.match(/(\d{2})\D(\d{2})/);
      return mm ? (mm[1] + ':' + mm[2]) : s;
    } catch (e) { try { var h = String(new Date(d).getHours()).padStart(2,'0'); var m = String(new Date(d).getMinutes()).padStart(2,'0'); return h + ':' + m; } catch (e2) { return ''; } }
  }

  function isImageFilename(name) {
    if (!name) return false;
    return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(String(name));
  }
  function isVideoFilename(name) {
    if (!name) return false;
    return /\.(mp4|mov|m4v|avi|wmv|webm|mts|m2ts|3gp)$/i.test(String(name));
  }

  function isGeneratedThumbnailName(name) {
    // 🔥 过滤所有缩图文件：.thumb.jpg（小缩图）和 .preview.jpg（预览图）
    try { return /\.(thumb|preview)\.(jpe?g|png|webp)$/i.test(String(name || '')); } catch (e) { return false; }
  }

  function primeVideoFrame(videoEl) {
    try {
      if (!videoEl || videoEl.tagName !== 'VIDEO') return;
      if ((!videoEl.currentSrc && !videoEl.getAttribute('src'))) {
        if (!videoEl.__primePending) {
          videoEl.__primePending = true;
          var retry = function () {
            try { videoEl.removeEventListener('loadedmetadata', retry); } catch (e) {}
            try { videoEl.removeEventListener('loadeddata', retry); } catch (e) {}
            videoEl.__primePending = false;
            videoEl.__primed = false;
            primeVideoFrame(videoEl);
          };
          try { videoEl.addEventListener('loadedmetadata', retry, { once: true }); } catch (e) {}
          try { videoEl.addEventListener('loadeddata', retry, { once: true }); } catch (e) {}
        }
        return;
      }
      if (videoEl.__primed) return;
      videoEl.__primed = true;
      var stop = function () {
        try { videoEl.pause(); } catch (e) {}
        try {
          if (isFinite(videoEl.currentTime) && videoEl.currentTime > 0.35) {
            videoEl.currentTime = Math.max(0.05, Math.min(videoEl.currentTime, (videoEl.duration || videoEl.currentTime)));
          }
        } catch (e) {}
      };
      try { videoEl.muted = true; videoEl.playsInline = true; } catch (e) {}
      var playPromise = null;
      try { playPromise = videoEl.play(); } catch (e) { videoEl.__primed = false; stop(); return; }
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function(){ setTimeout(stop, 90); }).catch(function(err){ videoEl.__primed = false; stop(); });
      } else {
        setTimeout(stop, 90);
      }
    } catch (e) {}
  }

  function analyzeFrameQuality(ctx, w, h) {
    try {
      var sx = Math.floor(w * 0.1);
      var sy = Math.floor(h * 0.1);
      var sw = Math.max(1, Math.floor(w * 0.8));
      var sh = Math.max(1, Math.floor(h * 0.8));
      var data = ctx.getImageData(sx, sy, sw, sh).data;
      var samples = 0;
      var bright = 0;
      for (var i = 0; i < data.length; i += 4 * 24) {
        var r = data[i], g = data[i + 1], b = data[i + 2];
        var lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        if (lum > 24) bright++;
        samples++;
      }
      return samples ? (bright / samples) : 0;
    } catch (e) { return 0; }
  }

  function computePosterTimes(duration, options) {
    options = options || {};
    try {
      var times = [];
      if (!duration || !isFinite(duration) || duration <= 0.2) {
        return [0.12];
      }
      var checkpoints = [0.05, 0.12, 0.25, 0.38, 0.52, 0.68, 0.82];
      for (var i = 0; i < checkpoints.length; i++) {
        var t = checkpoints[i] * duration;
        t = Math.min(Math.max(t, 0.08), Math.max(duration - 0.1, 0.18));
        if (times.indexOf(t) === -1) times.push(t);
      }
      if (options.maxSamples && options.maxSamples > 0) {
        return times.slice(0, options.maxSamples);
      }
      return times;
    } catch (e) { return [0.12]; }
  }

  function capturePosterFromSource(src, opts) {
    opts = opts || {};
    var keepObjectUrl = !!opts.keepObjectUrl;
    var maxSamples = (opts && opts.maxSamples) ? Math.max(1, opts.maxSamples | 0) : null;
    var posterTimeoutMs = Math.max(800, (opts && opts.timeoutMs) || DEFAULT_POSTER_TIMEOUT);
    return new Promise(function (resolve) {
      var helper = null;
      var objectUrl = null;
      var shouldRevoke = false;
      var cleaned = false;
      var bestCanvasData = null;
      var bestDimensions = null;
      var canvas = null; // 🔥 追蹤 Canvas 以便清理
      var timeoutTimer = null;
      var cleanup = function () {
        if (cleaned) return;
        cleaned = true;
        if (timeoutTimer) {
          clearTimeout(timeoutTimer);
          timeoutTimer = null;
        }
        if (helper) {
          try { helper.pause(); } catch (e) {}
          try { helper.removeAttribute('src'); if (typeof helper.load === 'function') helper.load(); } catch (e) {}
          try { helper.remove(); } catch (e) {}
        }
        if (objectUrl && shouldRevoke) {
          try { URL.revokeObjectURL(objectUrl); } catch (e) {}
        }
        // 🔥 清理 Canvas
        if (canvas) {
          try {
            var ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            canvas.width = 1;
            canvas.height = 1;
            canvas = null;
          } catch (e) {}
        }
        helper = null;
        objectUrl = null;
        bestCanvasData = null;
        bestDimensions = null;
      };
      var startExtraction = function (videoSrc) {
        try {
          helper = document.createElement('video');
          helper.preload = 'auto';
          helper.muted = true;
          helper.playsInline = true;
          helper.src = videoSrc;
          helper.style.position = 'fixed';
          helper.style.opacity = '0';
          helper.style.pointerEvents = 'none';
          helper.style.left = '-10000px';
          helper.addEventListener('error', function (ev) { reportPosterError('video-load', helper && helper.src || src); cleanup(); resolve(''); }, { once: true });
          helper.addEventListener('loadedmetadata', function handleMeta() {
            helper.removeEventListener('loadedmetadata', handleMeta);
            var duration = Number(helper.duration || 0);
            var times = computePosterTimes(duration, { maxSamples: maxSamples || undefined });
            canvas = document.createElement('canvas'); // 🔥 使用外部變數以便清理
            var ctx = canvas.getContext('2d');
            var idx = 0;
            var bestScore = -1;
            var bestData = '';
            var tryNext = function () {
              if (idx >= times.length) {
                if (!bestData && bestCanvasData && bestDimensions) {
                  try {
                    canvas.width = bestDimensions.width;
                    canvas.height = bestDimensions.height;
                    var put = canvas.getContext('2d');
                    put.putImageData(bestCanvasData, 0, 0);
                    bestData = canvas.toDataURL('image/jpeg', 0.72);
                  } catch (reuseErr) {}
                }
                if (!bestData && bestScore >= 0 && bestCanvasData && bestDimensions) {
                  try {
                    canvas.width = bestDimensions.width;
                    canvas.height = bestDimensions.height;
                    var ctxReuse = canvas.getContext('2d');
                    ctxReuse.putImageData(bestCanvasData, 0, 0);
                    ctxReuse.globalCompositeOperation = 'lighter';
                    ctxReuse.fillStyle = 'rgba(255,255,255,0.25)';
                    ctxReuse.fillRect(0, 0, bestDimensions.width, bestDimensions.height);
                    bestData = canvas.toDataURL('image/jpeg', 0.72);
                  } catch (boostErr) {}
                }
                if (!bestData) {
                  reportPosterError('poster-dark-frame', src);
                }
                cleanup();
                resolve(bestData || '');
                return;
              }
              var target = times[idx++];
              var onSeeked = function () {
                helper.removeEventListener('seeked', onSeeked);
                try {
                  var vw = helper.videoWidth || 0;
                  var vh = helper.videoHeight || 0;
                  if (!vw || !vh) { reportPosterError('poster-no-dim', src + ' @t=' + target); tryNext(); return; }
                  var low = isLowEndDevice();
                  var maxW = low ? 200 : 320;
                  var maxH = low ? 200 : 320;
                  var scale = Math.min(maxW / vw, maxH / vh, 1);
                  var w = Math.max(1, Math.round(vw * scale));
                  var h = Math.max(1, Math.round(vh * scale));
                  canvas.width = w; canvas.height = h;
                  ctx.drawImage(helper, 0, 0, w, h);
                  var score = analyzeFrameQuality(ctx, w, h);
                  if (score < 0.24) {
                    try {
                      var img = ctx.getImageData(0, 0, w, h);
                      var dataArr = img.data;
                      for (var p = 0; p < dataArr.length; p += 4) {
                        dataArr[p] = Math.min(255, dataArr[p] * 2.5 + 40);
                        dataArr[p + 1] = Math.min(255, dataArr[p + 1] * 2.45 + 36);
                        dataArr[p + 2] = Math.min(255, dataArr[p + 2] * 2.5 + 40);
                      }
                      ctx.putImageData(img, 0, 0);
                      score = analyzeFrameQuality(ctx, w, h);
                    } catch (boostErr) {}
                  }
                  if (score > bestScore) {
                    bestScore = score;
                    try {
                      bestCanvasData = ctx.getImageData(0, 0, w, h);
                      bestDimensions = { width: w, height: h };
                      bestData = canvas.toDataURL('image/jpeg', 0.82);
                    } catch (errData) { bestData = ''; }
                  }
                  if (score >= 0.32) {
                    cleanup();
                    resolve(bestData);
                    return;
                  }
                } catch (err) {}
                tryNext();
              };
              helper.addEventListener('seeked', onSeeked, { once: true });
              try {
                helper.currentTime = Math.max(0.08, Math.min(target, Math.max(helper.duration - 0.2, 0.2)));
              } catch (errSeek) {
                onSeeked();
              }
            };
            tryNext();
          });
          document.body.appendChild(helper);
          timeoutTimer = setTimeout(function(){
            reportPosterError('poster-timeout', src);
            cleanup();
            resolve('');
          }, posterTimeoutMs);
        } catch (err) {
          cleanup();
          resolve('');
        }
      };
      try {
        if (src.indexOf('blob:') === 0) {
          objectUrl = src;
          shouldRevoke = !keepObjectUrl;
          startExtraction(src);
          return;
        }
        fetch(src, {
          credentials: 'include',
          mode: 'cors',
          headers: { Range: 'bytes=0-1800000' }
        }).then(function (resp) {
          if (!resp.ok) {
            // 🔥 [修復] 404 錯誤直接停止，不要繼續嘗試
            if (resp.status === 404) {
              console.log('⏭️ [capturePosterFromSource] 資源不存在 (404)，跳過縮圖生成:', src);
              cleanup();
              resolve('');
              throw new Error('404_STOP'); // 特殊錯誤，阻止後續 catch
            }
            reportPosterError('poster-fetch-' + resp.status, src);
            return Promise.reject(new Error('fetch fail ' + resp.status));
          }
          return resp.blob();
        }).catch(function (err) {
          // 🔥 [修復] 如果是 404_STOP，直接結束
          if (err && err.message === '404_STOP') {
            return Promise.reject(err);
          }
          return fetch(src, { credentials: 'include', mode: 'cors' }).then(function (resp) {
            if (!resp.ok) {
              // 🔥 [修復] 第二次 fetch 也檢查 404
              if (resp.status === 404) {
                console.log('⏭️ [capturePosterFromSource] 資源不存在 (404 - 第二次嘗試)，跳過縮圖生成:', src);
                cleanup();
                resolve('');
                throw new Error('404_STOP');
              }
              reportPosterError('poster-fetch2-' + resp.status, src);
              throw new Error('fetch fail ' + resp.status);
            }
            return resp.blob();
          });
        }).then(function (blob) {
          if (!blob || !blob.size) { reportPosterError('poster-blob-empty', src); cleanup(); resolve(''); return; }
          objectUrl = URL.createObjectURL(blob);
          shouldRevoke = true;
          startExtraction(objectUrl);
        }).catch(function (err) {
          // 🔥 [修復] 如果是 404_STOP，不要嘗試 startExtraction
          if (err && err.message === '404_STOP') {
            return; // 已在前面 cleanup 和 resolve
          }
          startExtraction(src);
        });
      } catch (err) {
        reportPosterError('poster-exception', err && err.message || src);
        startExtraction(src);
      }
    });
  }

  function buildDeepLinkParams(course) {
    try {
      var fallback = window.__deepLinkInfo || initialDeepLinkParams || null;
      if (!course) return fallback;
      var eventId = course.eventId || course.eventUuid || course.id || (fallback && fallback.eventId) || '';
      var start = course.start ? (course.start instanceof Date ? course.start : new Date(course.start)) : null;
      var dateStr = start ? formatDateTWISO(start) : '';
      var timeStr = start ? formatTimeHHMMTW(start) : '';
      var instructorName = course.instructor || (currentTeacher && currentTeacher.name) || '';
      if (!dateStr && fallback && fallback.date) dateStr = fallback.date;
      if (!timeStr && fallback && fallback.time) timeStr = fallback.time;
      if (!instructorName && fallback && fallback.instructor) instructorName = fallback.instructor;
      return {
        eventId: eventId || '',
        date: dateStr || '',
        time: timeStr || '',
        instructor: instructorName || ''
      };
    } catch (e) {
      return window.__deepLinkInfo || null;
    }
  }

  // ==================== 課程標題 → 課程-時段（檔案夾命名一致） ====================
  function buildNormalizedCoursePeriodFromTitle(title, fallbackCourseName) {
    try {
      var p = (global.FLB && global.FLB.CourseTitleParser && typeof global.FLB.CourseTitleParser.parse === 'function')
        ? global.FLB.CourseTitleParser.parse(title || '')
        : null;
      var courseName = (p && (p.courseName || p.course)) || fallbackCourseName || '';
      var weekday = (p && p.weekday) || '';
      var st = (p && p.startTime) || '';
      var et = (p && p.endTime) || '';
      var period = '';
      if (weekday && st && et) period = weekday + '-' + st + '-' + et; else period = (p && p.period) || '';
      // 移除可能殘留的空白與地點資訊
      period = String(period || '').replace(/\s+/g, '');
      // 若 period 僅含時間且沒有連字號，補上
      var m = period.match(/^([一二三四五六日])?\s*(\d{2}:?\d{2})[-~–—]?(\d{2}:?\d{2})/);
      if (!weekday && m) {
        var wd = m[1] || '';
        var s1 = m[2].replace(':', '');
        var s2 = m[3].replace(':', '');
        period = (wd ? (wd + '-') : '') + s1 + '-' + s2;
      } else if (weekday && st && et) {
        period = weekday + '-' + st + '-' + et;
      }
      return { courseName: courseName, period: period, coursePeriod: courseName ? (period ? (courseName + '-' + period) : courseName) : period };
    } catch (e) {
      var c = (fallbackCourseName || '').trim();
      return { courseName: c, period: '', coursePeriod: c };
    }
  }

  function _toLowerSafe(s) { try { return String(s || '').toLowerCase(); } catch (e) { return String(s || ''); } }
  function _decodeSafe(s) { try { return decodeURIComponent(s); } catch (e) { return String(s || ''); } }
  function filenamesEqual(a, b) {
    if (!a || !b) return false;
    var A = String(a), B = String(b);
    if (A === B) return true;
    var aBase = A.split('/').pop(); var bBase = B.split('/').pop();
    if (aBase === bBase) return true;
    var AL = _toLowerSafe(_decodeSafe(A)); var BL = _toLowerSafe(_decodeSafe(B));
    if (AL === BL) return true;
    if (AL.endsWith('/' + BL) || BL.endsWith('/' + AL)) return true;
    var ALB = AL.split('/').pop(); var BLB = BL.split('/').pop();
    return ALB === BLB;
  }

  function encodeDataAttr(value) {
    try {
      return encodeURIComponent(String(value || ''));
    } catch (e) {
      return String(value || '');
    }
  }

  function decodeDataAttr(value) {
    if (!value) return '';
    try {
      return decodeURIComponent(value);
    } catch (e) {
      return value;
    }
  }

  function addRelatedFile(list, value) {
    if (!Array.isArray(list)) return;
    var candidate = String(value || '').trim();
    if (!candidate) return;
    var exists = list.some(function (item) { return filenamesEqual(item, candidate); });
    if (!exists) list.push(candidate);
  }

  function parseRelatedFilesAttr(attr) {
    if (!attr) return [];
    try {
      var decoded = decodeDataAttr(attr);
      var parsed = JSON.parse(decoded);
      if (Array.isArray(parsed)) {
        return parsed.filter(function (name) { return typeof name === 'string' && name.trim().length; });
      }
    } catch (e) {}
    return [];
  }
  var UPLOAD_CENTER_DONE_TTL = 45000; // ✅ 完成紀錄保留 45 秒，方便檢查重試

  function readUploadCenterPref(key, fallback) {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return fallback;
      var val = window.sessionStorage.getItem(key);
      return val || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeUploadCenterPref(key, value) {
    try {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      window.sessionStorage.setItem(key, value);
    } catch (e) {}
  }
  var UploadCenter = {
    // 進度渲染節流狀態
    __lastRenderAt: 0,
    __renderTimer: null,
    __minInterval: 280,
    __doneTtl: UPLOAD_CENTER_DONE_TTL,
    viewMode: readUploadCenterPref('uploadCenterViewMode', 'list'),
    drawerMode: readUploadCenterPref('uploadCenterDrawerMode', 'standard'),
    tasks: [], // {id, sid, studentIndex, type, fileIndex, name, percent, viewPercent, status}
    setViewMode: function(mode) {
      var next = (mode === 'list') ? 'list' : 'card';
      if (next === this.viewMode) return;
      this.viewMode = next;
      writeUploadCenterPref('uploadCenterViewMode', next);
      this.scheduleRender();
    },
    setDrawerMode: function(mode) {
      var next = (mode === 'compact') ? 'compact' : 'standard';
      if (next === this.drawerMode) return;
      this.drawerMode = next;
      writeUploadCenterPref('uploadCenterDrawerMode', next);
      this._applyDrawerModeClass();
      this.scheduleRender();
    },
    add: function (studentIndex, type, fileIndex, name, abortFn, options) {
      options = options || {};
      try {
        var sid = String(studentIndex) + '-' + String(type) + '-' + String(fileIndex);
        var wasEmpty = this.tasks.length === 0;
        var existed = this.tasks.find(function (t) { return t.sid === sid; });
        if (existed) {
          this._applyTaskMeta(existed, options.meta);
          existed.status = (options.statusOnReuse || 'uploading');
          if (options.resetProgressOnReuse) {
            existed.percent = 0;
            existed.viewPercent = 0;
          }
          if (typeof abortFn === 'function') {
            existed.abort = abortFn;
          }
          existed.error = options.errorMessage || '';
          if (typeof options.keepAlive === 'boolean') {
            existed.keepAlive = options.keepAlive;
          }
          if (existed.__cleanupTimer) {
            clearTimeout(existed.__cleanupTimer);
            existed.__cleanupTimer = null;
          }
          this.scheduleRender();
          this._broadcast('queued', existed, { reused: true });
          return existed;
        }
        var initialStatus = options.initialStatus || 'uploading';
        var initialPercent = Number(options.initialPercent);
        if (!Number.isFinite(initialPercent)) initialPercent = initialStatus === 'queued' ? 0 : 0;
        var t = {
          id: 't-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
          sid: sid,
          studentIndex: studentIndex,
          type: type,
          fileIndex: fileIndex,
          name: name || (type === 'comment' ? '評論' : (type + '-' + fileIndex)),
          percent: initialPercent,
          viewPercent: initialPercent,
          status: initialStatus,
          abort: (typeof abortFn === 'function') ? abortFn : null,
          error: '',
          keepAlive: options.keepAlive !== false,
          createdAt: Date.now(),
          __cleanupTimer: null,
          meta: {}
        };
        this._applyTaskMeta(t, options.meta);
        this.tasks.unshift(t);
        this.scheduleRender();
        // 🔧 依設定決定是否自動展開（預設關閉）
        try {
          if (typeof AUTO_OPEN_UPLOAD_CENTER !== 'undefined' && AUTO_OPEN_UPLOAD_CENTER) {
            var drawer = document.getElementById('uploadCenterDrawer');
            var closed = !drawer || drawer.style.display === 'none' || /translateY\(110%\)/.test(drawer.style.transform || '');
            if (wasEmpty || closed) {
              if (typeof window !== 'undefined' && typeof window.openUploadCenter === 'function') {
                window.openUploadCenter();
              } else {
                this.open();
                var b = document.getElementById('uploadCenterBackdrop');
                if (b) b.style.display = 'block';
              }
            }
          }
        } catch (e) {}
        this._broadcast('queued', t);
        return t;
      } catch (e) { return null; }
    },
    update: function (studentIndex, type, fileIndex, percent) {
      try {
        var sid = String(studentIndex) + '-' + String(type) + '-' + String(fileIndex);
        var t = this.tasks.find(function (x) { return x.sid === sid; });
        if (t) {
          var p = Number(percent);
          if (!Number.isFinite(p)) p = 0;
          p = Math.max(0, Math.min(100, Math.round(p)));
          if (p < 1 && t.percent > 0) p = t.percent; // 避免回退到 0
          if (p > t.percent) t.percent = p; // 僅允許單向遞增
          // 平滑補間到 viewPercent
          var start = Number(t.viewPercent || 0);
          var end = Math.max(start, t.percent);
          if (t.__animTimer) { clearInterval(t.__animTimer); t.__animTimer = null; }
          if (end - start >= 15 || (end === 100 && start <= 1)) {
            var duration = (end === 100 && start <= 1) ? 800 : 600;
            var steps = Math.max(3, Math.floor(duration / 120));
            var i = 0, delta = (end - start) / steps;
            var self = this;
            t.__animTimer = setInterval(function(){
              i++;
              t.viewPercent = Math.min(100, Math.round(start + delta * i));
              self.scheduleRender();
              if (i >= steps || t.viewPercent >= end) {
                clearInterval(t.__animTimer); t.__animTimer = null; t.viewPercent = end; self.scheduleRender();
              }
            }, 120);
          } else {
            t.viewPercent = end;
          }
          this.scheduleRender();
          this._broadcast('progress', t, { percent: p, viewPercent: t.viewPercent });
        }
      } catch (e) {}
    },
    done: function (studentIndex, type, fileIndex) {
      try {
        var sid = String(studentIndex) + '-' + String(type) + '-' + String(fileIndex);
        var task = this.tasks.find(function (x) { return x.sid === sid; });
        if (!task) return;
        if (task.__animTimer) { clearInterval(task.__animTimer); task.__animTimer = null; }
        task.status = 'done';
        task.percent = 100;
        task.viewPercent = 100;
        task.error = '';
        task.completedAt = Date.now();
        task.abort = null;
        this.scheduleRender();
        this._broadcast('done', task, { completedAt: task.completedAt });
        this._scheduleDoneCleanup(task);
      } catch (e) {}
    },
    fail: function (studentIndex, type, fileIndex, msg) {
      try {
        var sid = String(studentIndex) + '-' + String(type) + '-' + String(fileIndex);
        var t = this.tasks.find(function (x) { return x.sid === sid; });
        if (t) {
          if (t.__cleanupTimer) { clearTimeout(t.__cleanupTimer); t.__cleanupTimer = null; }
          t.status = 'error';
          t.error = msg || '';
          this.scheduleRender();
          this._broadcast('error', t, { message: msg || '' });
        }
      } catch (e) {}
    },
    _scheduleDoneCleanup: function(task) {
      if (!task) return;
      if (!task.keepAlive) {
        this._removeTaskBySid(task.sid);
        return;
      }
      if (task.__cleanupTimer) {
        clearTimeout(task.__cleanupTimer);
      }
      var ttl = Number(this.__doneTtl) || UPLOAD_CENTER_DONE_TTL;
      var self = this;
      task.__cleanupTimer = setTimeout(function(){
        task.__cleanupTimer = null;
        self._removeTaskBySid(task.sid);
      }, ttl);
    },
    _removeTaskBySid: function(sid) {
      if (typeof sid === 'undefined') return;
      var idx = this.tasks.findIndex(function (x) { return x.sid === sid; });
      if (idx > -1) {
        var target = this.tasks[idx];
        if (target && target.__cleanupTimer) { clearTimeout(target.__cleanupTimer); target.__cleanupTimer = null; }
        if (target && target.__animTimer) { clearInterval(target.__animTimer); target.__animTimer = null; }
        this.tasks.splice(idx, 1);
        this.scheduleRender();
        console.log('✅ [UploadCenter] 已清除任務:', sid);
        this._broadcast('removed', target);
      }
    },
    scheduleRender: function () {
      try {
        var now = Date.now();
        var elapsed = now - (this.__lastRenderAt || 0);
        if (elapsed >= this.__minInterval) {
          this.__lastRenderAt = now;
          return this.render();
        }
        if (this.__renderTimer) return; // 已排程
        var self = this;
        this.__renderTimer = setTimeout(function () {
          self.__renderTimer = null;
          self.__lastRenderAt = Date.now();
          try { self.render(); } catch (e) {}
        }, Math.max(32, this.__minInterval - elapsed));
      } catch (e) {
        try { this.render(); } catch (_) {}
      }
    },
    _applyDrawerModeClass: function () {
      try {
        var drawer = document.getElementById('uploadCenterDrawer');
        if (!drawer) return;
        drawer.setAttribute('data-drawer-mode', this.drawerMode || 'standard');
      } catch (e) {}
    },
    open: function () {
      try {
        var d = document.getElementById('uploadCenterDrawer');
        if (d) {
          this._applyDrawerModeClass();
          this.render();
          d.style.display = 'block';
          requestAnimationFrame(function(){ try { d.style.transform = 'translateY(0)'; } catch (e) {} });
        }
      } catch (e) {}
    },
    close: function () {
      try {
        var d = document.getElementById('uploadCenterDrawer');
        if (d) {
          d.style.transform = 'translateY(110%)';
          setTimeout(function(){ try { d.style.display = 'none'; } catch (e) {} }, 260);
        }
      } catch (e) {}
    },
    render: function () {
      try {
        var list = document.getElementById('uploadCenterList');
        var badge = document.getElementById('uploadCenterBadge');
        var fab = document.getElementById('uploadCenterFab');
        if (!list || !badge) return;
        this._applyDrawerModeClass();
        list.dataset.viewMode = this.viewMode || 'card';
        var badgeCount = this.tasks.filter(function (t) { return t && (t.status === 'uploading' || t.status === 'queued' || t.status === 'error'); }).length;
        if (badgeCount > 0) {
          badge.textContent = String(badgeCount);
          badge.style.display = 'flex';
        } else {
          badge.style.display = 'none';
        }
        var actives = this.tasks.filter(function (t) { return t && t.status === 'uploading'; });
        var avg = 0;
        if (actives.length) {
          var sum = actives.reduce(function (s, t) { return s + (Number((t.viewPercent != null ? t.viewPercent : t.percent)) || 0); }, 0);
          avg = Math.max(0, Math.min(100, Math.round(sum / actives.length)));
        }
        if (fab) {
          if (this.tasks.length) {
            fab.style.display = 'block';
          } else {
            fab.style.display = 'none';
          }
          if (actives.length) {
            fab.classList.add('progress');
            try { fab.style.setProperty('--ucp', avg + '%'); } catch (e) {}
          } else {
            fab.classList.remove('progress');
            try { fab.style.removeProperty('--ucp'); } catch (e) {}
          }
        }
        if (!actives.length) {
          try { window.__stuTransferPct = null; window.__ovTransferPct = null; } catch (e) {}
        }

        if (!this.tasks.length) {
          try { window.__stuTransferPct = null; window.__ovTransferPct = null; } catch (e) {}
          if (typeof window.__onUploadCenterRender === 'function') { try { window.__onUploadCenterRender(this.tasks); } catch (e) {} }
          this._updateToolbarState(0, avg);
          list.innerHTML = '<div class="uc-empty-state">目前沒有上傳任務</div>';
          return;
        }

        var order = { uploading: 0, queued: 1, error: 2, done: 3 };
        var items = this.tasks.slice().sort(function (a, b) {
          var oa = order[a.status] != null ? order[a.status] : 9;
          var ob = order[b.status] != null ? order[b.status] : 9;
          if (oa !== ob) return oa - ob;
          return (b.id || '').localeCompare(a.id || '');
        });
        var statusLabelMap = {
          uploading: '⬆️ 上傳中',
          queued: '⏳ 排隊中',
          error: '❌ 失敗',
          done: '✅ 完成'
        };
        var typeLabelMap = {
          photos: '照片',
          videos: '影片',
          comment: '評語',
          overview: '總覽',
          batch: '批次'
        };
        var escapeHtml = function (str) {
          return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        };
        var encodeCssUrl = function (url) {
          return String(url || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
        };
        var resolvePreviewUrl = function (task) {
          if (!task || !task.meta) return '';
          if (task.meta.previewUrl) return task.meta.previewUrl;
          if (task.meta.thumbUrl) return task.meta.thumbUrl;
          if (task.meta.objectUrl) return task.meta.objectUrl;
          if (task.meta.proxyUrl && task.type === 'photos') return task.meta.proxyUrl;
          try {
            if (task.meta.tempId && window.PendingMediaStore && typeof PendingMediaStore.get === 'function') {
              var entry = PendingMediaStore.get(task.meta.tempId);
              if (entry && (entry.objectUrl || entry.previewUrl || entry.proxyUrl)) {
                return entry.objectUrl || entry.previewUrl || entry.proxyUrl;
              }
            }
          } catch (e) {}
          return '';
        };

        list.innerHTML = items.map(function (t) {
          var name = escapeHtml(t.name || '');
          var shown = Math.max(0, Math.min(100, Math.round((t.viewPercent != null ? t.viewPercent : t.percent) || 0)));
          var typeLabel = typeLabelMap[t.type] || t.type || '任務';
          var statusLabel = statusLabelMap[t.status] || '處理中';
          var studentLabel = escapeHtml((t.meta && t.meta.studentName) || (t.studentIndex === OVERVIEW_UPLOAD_INDEX ? '課程總覽' : getStudentNameByIndex(t.studentIndex)));
          var previewUrl = resolvePreviewUrl(t);
          var thumbClass = previewUrl ? 'has-thumb' : 'no-thumb';
          var thumbContent = '';
          if (previewUrl) {
            thumbContent = '<img class="uc-thumb-img" src="' + escapeHtml(previewUrl) + '" alt="媒體縮圖">';
          } else {
            var placeholderIcon = (t.type === 'videos') ? '<i class="fas fa-play"></i>' : '<i class="fas fa-image"></i>';
            var placeholderText = t.type === 'videos' ? '影片' : '照片';
            thumbContent = '<div class="uc-thumb-placeholder">' + placeholderIcon + '<span>' + placeholderText + '</span></div>';
          }
          var statusText = escapeHtml((t.meta && t.meta.statusText) || t.error || statusLabel);
          var percentBadge = t.status === 'done' ? '完成' : (shown + '%');
          return (
            '<div class="uc-task" data-status="' + t.status + '" data-type="' + escapeHtml(t.type || '') + '">' +
              '<div class="uc-thumb ' + thumbClass + '">' + thumbContent +
                '<span class="uc-type-badge">' + typeLabel + '</span>' +
                (t.type === 'videos' ? '<span class="uc-type-icon"><i class="fas fa-film"></i></span>' : '<span class="uc-type-icon"><i class="fas fa-image"></i></span>') +
              '</div>' +
              '<div class="uc-body">' +
                '<div class="uc-head-row">' +
                  '<div class="uc-title" title="' + name + '">' + name + '</div>' +
                  '<div class="uc-percent">' + percentBadge + '</div>' +
                '</div>' +
                '<div class="uc-meta-row">' +
                  '<span class="uc-student">' + (studentLabel || '-') + '</span>' +
                  '<span class="uc-status-text">' + statusText + '</span>' +
                '</div>' +
                '<div class="uc-progress-bar"><span style="width:' + shown + '%"></span></div>' +
                '<div class="uc-actions">' +
                  '<button class="uc-btn" data-open="' + t.studentIndex + '"><i class="fas fa-eye"></i></button>' +
                  (t.status === 'uploading' && t.abort ? '<button class="uc-btn" data-cancel="' + t.sid + '"><i class="fas fa-ban"></i></button>' : '') +
                  (t.status === 'error' ? '<button class="uc-btn" data-retry="' + t.studentIndex + '"><i class="fas fa-sync-alt"></i></button>' : '') +
                '</div>' +
              '</div>' +
            '</div>'
          );
        }).join('');

        Array.prototype.forEach.call(list.querySelectorAll('[data-open]'), function (btn) {
          btn.addEventListener('click', function () {
            try {
              var idx = parseInt(btn.getAttribute('data-open'), 10) || 0;
              if (idx < 0) {
                if (window.FLB && FLB.Router) FLB.Router.navigate({ step: 'overview' });
              } else {
                jumpToStudentIndex(idx);
              }
              UploadCenter.close();
            } catch (e) {}
          });
        });
        Array.prototype.forEach.call(list.querySelectorAll('[data-retry]'), function (btn) {
          btn.addEventListener('click', function () {
            try { var idx = parseInt(btn.getAttribute('data-retry'), 10) || 0; uploadStudentRecord(idx); } catch (e) {}
          });
        });
        Array.prototype.forEach.call(list.querySelectorAll('[data-cancel]'), function (btn) {
          btn.addEventListener('click', function(){
            try {
              var sid = btn.getAttribute('data-cancel');
              var task = UploadCenter.tasks.find(function(t){ return t.sid === sid; });
              if (task && typeof task.abort === 'function') { task.abort(); task.status = 'error'; task.error = '已取消'; UploadCenter.render(); }
            } catch (e) {}
          });
        });
        this._updateToolbarState(badgeCount, avg);
        try { if (window.__onUploadCenterRender) window.__onUploadCenterRender(UploadCenter.tasks); } catch (e) {}
      } catch (e) {}
    },
    _updateToolbarState: function (badgeCount, avg) {
      try {
        var viewToggle = document.getElementById('uploadCenterViewToggle');
        if (viewToggle) {
          var isCard = (this.viewMode || 'card') === 'card';
          viewToggle.setAttribute('data-mode', this.viewMode || 'card');
          viewToggle.classList.toggle('active', isCard);
          viewToggle.innerHTML = isCard
            ? '<i class="fas fa-list"></i> 列表檢視'
            : '<i class="fas fa-th-large"></i> 卡片檢視';
        }
        var sizeToggle = document.getElementById('uploadCenterSizeToggle');
        if (sizeToggle) {
          var isCompact = (this.drawerMode || 'standard') === 'compact';
          sizeToggle.setAttribute('data-size', this.drawerMode || 'standard');
          sizeToggle.classList.toggle('active', isCompact);
          sizeToggle.innerHTML = isCompact
            ? '<i class="fas fa-expand-alt"></i> 展開視窗'
            : '<i class="fas fa-compress-alt"></i> 精簡視窗';
        }
        var subtitle = document.getElementById('uploadCenterSubTitle');
        if (subtitle) {
          if (badgeCount > 0) {
            subtitle.textContent = '背景同步進行中 · 平均 ' + Math.max(0, Math.min(100, Math.round(avg || 0))) + '%';
          } else {
            subtitle.textContent = '後台持續同步，關閉頁面不會影響';
          }
        }
      } catch (e) {}
    },
    reset: function () {
      try {
        this.tasks.forEach(function (t) {
          if (!t) return;
          if (t.__cleanupTimer) { clearTimeout(t.__cleanupTimer); t.__cleanupTimer = null; }
          if (t.__animTimer) { clearInterval(t.__animTimer); t.__animTimer = null; }
          if (typeof t.abort === 'function') { try { t.abort(); } catch (e) {} }
        });
      } catch (e) {}
      this.tasks = [];
      try { this.render(); } catch (e) {}
    },
    _applyTaskMeta: function(task, meta) {
      if (!task) return;
      if (!task.meta) task.meta = {};
      if (meta && typeof meta === 'object') {
        try {
          task.meta = Object.assign({}, task.meta, meta);
        } catch (e) {}
      }
    },
    _broadcast: function(action, task, extras) {
      if (typeof window === 'undefined' || !task) return;
      try {
        var payload = {
          action: action,
          task: {
            id: task.id,
            sid: task.sid,
            studentIndex: task.studentIndex,
            type: task.type,
            fileIndex: task.fileIndex,
            status: task.status,
            percent: task.percent,
            viewPercent: task.viewPercent,
            name: task.name,
            meta: task.meta ? Object.assign({}, task.meta) : {}
          }
        };
        if (extras && typeof extras === 'object') {
          payload.changes = extras;
        }
        window.dispatchEvent(new CustomEvent('upload-center-update', { detail: payload }));
      } catch (e) {}
    }
  };

  // ====== UI：補齊中徽章（顯示補查缺漏記錄的進度） ======
  function ensureSyncBadgeHost() {
    var host = document.getElementById('lrSyncBadge');
    if (host) return host;
    try {
      host = document.createElement('div');
      host.id = 'lrSyncBadge';
      host.style.position = 'fixed';
      // ✅ 置中，並避開 toast 區（預留 72px）
      host.style.left = '50%';
      host.style.transform = 'translateX(-50%)';
      host.style.top = '84px';
      host.style.zIndex = '1001';
      host.style.display = 'none';
      host.style.padding = '8px 12px';
      host.style.borderRadius = '999px';
      host.style.background = 'rgba(59,130,246,0.95)';
      host.style.color = '#fff';
      host.style.fontWeight = '700';
      host.style.boxShadow = '0 8px 20px rgba(59,130,246,0.3)';
      host.innerHTML = '<span class="spin" style="display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.6);border-top-color:#fff;border-radius:50%;margin-right:8px;vertical-align:-2px;animation:lrspin .8s linear infinite"></span><span class="text">補齊中…</span>';
      var style = document.createElement('style');
      style.textContent = '@keyframes lrspin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);
      document.body.appendChild(host);
    } catch (e) {}
    return host || null;
  }
  function showSyncBadge(done, total) {
    var host = ensureSyncBadgeHost();
    if (!host) return;
    var text = host.querySelector('.text');
    if (text) text.textContent = '補齊中… ' + done + '/' + total;
    host.style.display = 'inline-flex';
    host.style.alignItems = 'center';
  }
  function hideSyncBadge() {
    var host = document.getElementById('lrSyncBadge');
    if (host) host.style.display = 'none';
  }

  // ==================== 視覺焦點：高亮目前學生卡片 ====================
  // 💡 某些路由切換或初始化流程會在 renderStudentPager() 結尾呼叫此函數；
  //    若未定義會造成 ReferenceError。此處提供安全實作以便高亮目前卡片並自動捲動。
  function ensureHighlightStyle() {
    try {
      if (document.getElementById('lr-highlight-style')) return;
      var style = document.createElement('style');
      style.id = 'lr-highlight-style';
      style.textContent = (
        '.student-card.highlight-current{'
        + 'box-shadow:0 16px 36px rgba(59,130,246,0.22);'
        + 'border-color:rgba(59,130,246,0.55);'
        + 'transform:translateY(-2px);'
        + '}'
      );
      document.head.appendChild(style);
    } catch (e) { /* 忽略樣式注入失敗 */ }
  }
  function highlightCurrentStudentCard(index) {
    try {
      ensureHighlightStyle();
      // 移除既有高亮
      var highlighted = document.querySelectorAll('.student-card.highlight-current');
      for (var i = 0; i < highlighted.length; i++) { highlighted[i].classList.remove('highlight-current'); }
      // 套用至目標卡片
      var el = document.getElementById('student-' + index);
      if (!el) return; // ⚠️ 若卡片尚未渲染（例如虛擬清單），安全跳過
      el.classList.add('highlight-current');
      // 視口捲動：以滑動容器為優先
      try {
        var viewport = el.closest('.student-slide-viewport');
        if (viewport && typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (typeof el.scrollIntoView === 'function') {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch (e2) { /* 忽略捲動失敗 */ }
    } catch (err) {
      console.warn('⚠️ highlightCurrentStudentCard 執行發生例外（已忽略）', err);
    }
  }
  // 🔁 覆蓋全域佔位，避免路由切換或其他模組在初期呼叫時發生未定義錯誤
  try { global.highlightCurrentStudentCard = highlightCurrentStudentCard; } catch (e) {}

  function incActiveUpload(studentIndex) {
    try {
      var k = String(studentIndex);
      activeUploadsByStudent[k] = (activeUploadsByStudent[k] || 0) + 1;
      activeUploadsTotal++;
    } catch (e) {}
  }
  function decActiveUpload(studentIndex) {
    try {
      var k = String(studentIndex);
      if (activeUploadsByStudent[k] > 0) {
        activeUploadsByStudent[k]--;
      } else {
        activeUploadsByStudent[k] = 0;
      }
      if (activeUploadsByStudent[k] === 0) {
        delete previewProgressPrimed[k];
      }
      if (activeUploadsTotal > 0) activeUploadsTotal--;
    } catch (e) {}
  }

  // 🚧 防止誤關視窗造成上傳中斷（僅在有背景上傳時提示）
  try {
    window.addEventListener('beforeunload', function (e) {
      if (activeUploadsTotal > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  } catch (e) {}

  // ==================== 網路狀況偵測（智慧併發/壓縮） ====================
  function getConnectionProfile() {
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
      var et = String(c.effectiveType || '').toLowerCase();
      var down = Number(c.downlink || 0);
      var save = !!c.saveData;
      var slow = save || et.indexOf('2g') !== -1 || et.indexOf('3g') !== -1 || down > 0 && down < 1.5;
      var fast = !slow && (et.indexOf('4g') !== -1 || down >= 5);
      var photoLimit = slow ? 1 : (fast ? 4 : 3);
      var videoLimit = slow ? 1 : (fast ? 2 : 1);
      return { effectiveType: et, downlink: down, saveData: save, slow: slow, fast: fast, photoLimit: photoLimit, videoLimit: videoLimit };
    } catch (e) { return { effectiveType: 'unknown', downlink: 0, saveData: false, slow: false, fast: true, photoLimit: 3, videoLimit: 1 }; }
  }

  // ==================== 影像壓縮（加速上傳） ====================
  async function compressImageIfNeeded(file) {
    try {
      if (!file || !/^image\//i.test(file.type)) return file;
      // 跳過不易轉碼的格式（HEIC/HEIF 由裝置/瀏覽器決定，無法用 canvas 安全轉碼）
      if (/heic|heif/i.test(file.type)) return file;
      // 小檔不壓縮，避免畫質損失
      var sizeMB = (file.size || 0) / (1024 * 1024);
      if (sizeMB <= 0.5) return file;

      // 動態目標（畫質/尺寸）：依檔案大小 + 網路狀況調整
      var profile = getConnectionProfile();
      var maxDim = 1600;
      var quality = 0.78;
      if (sizeMB > 4) { maxDim = 1400; quality = 0.72; }
      else if (sizeMB > 2) { maxDim = 1600; quality = 0.75; }
      else { maxDim = 1800; quality = 0.80; }
      if (profile.slow) { maxDim = Math.min(maxDim, 1400); quality = Math.min(quality, 0.72); }
      if (profile.fast && sizeMB < 1.2) { maxDim = Math.max(maxDim, 1800); quality = Math.max(quality, 0.80); }

      // 讀取影像
      var bitmap = null;
      if (global.createImageBitmap) {
        try { bitmap = await global.createImageBitmap(file); } catch (e) { bitmap = null; }
      }
      var url = null, img = null;
      if (!bitmap) {
        url = URL.createObjectURL(file);
        img = new Image();
        img.decoding = 'async';
        img.src = url;
        await new Promise(function (resolve, reject) {
          img.onload = function () { resolve(); };
          img.onerror = function (err) { reject(err); };
        });
      }

      var sw = bitmap ? bitmap.width : (img && img.naturalWidth) || 0;
      var sh = bitmap ? bitmap.height : (img && img.naturalHeight) || 0;
      if (!sw || !sh) { if (url) try { URL.revokeObjectURL(url); } catch (e) {} return file; }

      var scale = 1;
      if (sw > sh && sw > maxDim) scale = maxDim / sw;
      if (sh >= sw && sh > maxDim) scale = maxDim / sh;
      if (!(scale < 1)) { if (url) try { URL.revokeObjectURL(url); } catch (e) {} return file; }

      var tw = Math.max(1, Math.round(sw * scale));
      var th = Math.max(1, Math.round(sh * scale));
      var canvas, ctx;
      try {
        if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(tw, th);
          ctx = canvas.getContext('2d');
        }
      } catch (e) {}
      if (!ctx) {
        canvas = document.createElement('canvas');
        canvas.width = tw; canvas.height = th;
        ctx = canvas.getContext('2d');
      }
      if (!ctx) { if (url) try { URL.revokeObjectURL(url); } catch (e) {} return file; }
      ctx.drawImage(bitmap || img, 0, 0, tw, th);

      var blob = await new Promise(function (resolve) {
        if (canvas.convertToBlob) {
          canvas.convertToBlob({ type: 'image/jpeg', quality: quality }).then(resolve).catch(function(){ resolve(null); });
        } else if (canvas.toBlob) {
          canvas.toBlob(function (b) { resolve(b); }, 'image/jpeg', quality);
        } else {
          try {
            var dataUrl = canvas.toDataURL('image/jpeg', quality);
            var bstr = atob(dataUrl.split(',')[1]);
            var n = bstr.length; var u8 = new Uint8Array(n);
            while (n--) u8[n] = bstr.charCodeAt(n);
            resolve(new Blob([u8], { type: 'image/jpeg' }));
          } catch (e) { resolve(null); }
        }
      });

      if (url) { try { URL.revokeObjectURL(url); } catch (e) {} }
      if (!blob || !blob.size || blob.size >= file.size) return file; // 壓縮失敗或無效就用原檔

      var newName = (file.name || 'photo')
        .replace(/\.(heic|heif|png|jpg|jpeg|webp)$/i, '') + '_compressed.jpg';
      try {
        return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() });
      } catch (e) {
        // Safari < 14 無 File 建構子
        blob.name = newName; // 非標準但作為兼容
        return blob;
      }
    } catch (e) { return file; }
  }

  // 🎞️ 瀏覽器端影片壓縮（Canvas + MediaRecorder）：降解析度/幀率/比特率，提高上傳速度
  async function compressVideoIfNeeded(file) {
    // ⚠️ 影片壓縮會造成顯著延遲（需完整播放/轉碼），先行停用，改以後端或專用工具處理
    return file;
  }

  /**
   * 批次處理檔案壓縮（優化版：防止記憶體崩潰）
   * @param {File[]} files - 檔案陣列
   * @param {string} type - 檔案類型（'photos' 或 'videos'）
   * @param {Object} options - 選項
   * @param {Function} options.onProgress - 進度回調 ({ current, total })
   * @returns {Promise<File[]>} 處理後的檔案陣列
   */
  async function maybeCompressFiles(files, type, options) {
    options = options || {};
    console.log('🔄 [maybeCompressFiles] 開始處理', files.length, '個', type, '檔案');
    
    // 取得配置
    var Config = window.LearningUploadConfig;
    var isLowEnd = Config && Config.detectLowEndDevice && Config.detectLowEndDevice();
    var batchSize = isLowEnd 
      ? (Config && Config.get('processing.batchSizeLowEnd') || 3)
      : (Config && Config.get('processing.batchSize') || 5);
    var delayBetweenBatches = (Config && Config.get('processing.delayBetweenBatches')) || 50;
    
    var onProgress = options.onProgress || function() {};
    var out = [];
    
    // 照片壓縮（分批並行處理）
    if (type === 'photos') {
      for (var i = 0; i < files.length; i += batchSize) {
        var batch = files.slice(i, i + batchSize);
        var batchNum = Math.floor(i / batchSize) + 1;
        var totalBatches = Math.ceil(files.length / batchSize);
        
        console.log(`📦 [批次 ${batchNum}/${totalBatches}] 處理 ${batch.length} 個檔案...`);
        
        // 並行處理當前批次
        var batchResults = await Promise.all(
          batch.map(function(file) {
            return compressImageIfNeeded(file).catch(function(err) {
              console.error('❌ 壓縮失敗，使用原檔案:', file.name, err);
              return file;
            });
          })
        );
        
        out.push.apply(out, batchResults);
        
        // 更新進度
        onProgress({ current: out.length, total: files.length });
        console.log(`✅ [批次 ${batchNum}/${totalBatches}] 完成，已處理 ${out.length}/${files.length}`);
        
        // 批次間清理記憶體與延遲（給瀏覽器喘息時間）
        if (i + batchSize < files.length) {
          // 延遲
          await new Promise(function(resolve) { setTimeout(resolve, delayBetweenBatches); });
          
          // 清理記憶體
          if (window.LearningUploadCleanup) {
            try {
              window.LearningUploadCleanup.cleanup({ silent: true });
            } catch (e) {
              console.warn('⚠️ 記憶體清理失敗:', e);
            }
          }
        }
      }
      
      console.log('✅ [maybeCompressFiles] 照片處理完成，輸出', out.length, '個檔案');
      return out;
    }
    
    // 影片處理（同樣分批）
    if (type === 'videos') {
      for (var j = 0; j < files.length; j += batchSize) {
        var videoBatch = files.slice(j, j + batchSize);
        var videoBatchResults = await Promise.all(
          videoBatch.map(function(file) {
            return compressVideoIfNeeded(file).catch(function(err) {
              console.error('❌ 影片處理失敗，使用原檔案:', file.name, err);
              return file;
            });
          })
        );
        
        out.push.apply(out, videoBatchResults);
        onProgress({ current: out.length, total: files.length });
        
        // 批次間延遲
        if (j + batchSize < files.length) {
          await new Promise(function(resolve) { setTimeout(resolve, delayBetweenBatches); });
        }
      }
      
      console.log('✅ [maybeCompressFiles] 影片處理完成，輸出', out.length, '個檔案');
      return out;
    }
    
    return files;
  }

  // ==================== 工具函數 ====================
  function parseFsCourseInfo(fullPath, studentName) {
    if (!fullPath) return null;
    try {
      var parts = String(fullPath).split(/[\\\/]+/).filter(Boolean);
      if (!parts.length) return null;
      var studentIndex = -1;
      if (studentName) {
        studentIndex = parts.lastIndexOf(studentName);
      }
      var readDateAndTopic = function(raw) {
        var out = { date: raw || '', topic: '' };
        if (!raw) return out;
        var match = String(raw).match(/^(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/);
        if (match) {
          out.date = match[1];
          out.topic = match[2] || '';
        }
        return out;
      };

      if (studentIndex >= 2) {
        var infoA = readDateAndTopic(parts[studentIndex - 1] || '');
        return {
          studentName: studentName,
          date: infoA.date,
          topic: infoA.topic,
          coursePeriod: parts[studentIndex - 2] || '',
          semester: parts[studentIndex - 3] || ''
        };
      }
      if (parts.length >= 3) {
        var infoB = readDateAndTopic(parts[parts.length - 1] || '');
        return {
          studentName: studentName || '',
          date: infoB.date,
          topic: infoB.topic,
          coursePeriod: parts[parts.length - 2] || '',
          semester: parts[parts.length - 3] || ''
        };
      }
    } catch (e) {}
    return null;
  }

  function splitCoursePeriod(coursePeriod) {
    if (!coursePeriod) return { course: '', period: '' };
    var trimmed = String(coursePeriod).trim();
    var timeMatch = trimmed.match(/^(.*?)(\d{4}-\d{4})$/);
    if (timeMatch) {
      var courseName = timeMatch[1].replace(/[-\s]+$/g, '');
      return {
        course: courseName,
        period: timeMatch[2]
      };
    }
    var idx = trimmed.lastIndexOf('-');
    if (idx <= 0) return { course: trimmed, period: '' };
    return {
      course: trimmed.slice(0, idx),
      period: trimmed.slice(idx + 1)
    };
  }

  /**
   * 取得當前學期（與後端邏輯一致）
   */
  function getCurrentSemester() {
    var now = new Date();
    var month = now.getMonth() + 1;
    var year = now.getFullYear();
    var taiwanYear = year - 1911;
    
    if (month >= 3 && month <= 6) {
      return taiwanYear + '-2';
    } else if (month >= 7 && month <= 8) {
      return '夏令營-' + year;
    } else if (month >= 9 && month <= 12) {
      return taiwanYear + '-1';
    } else {
      return '冬令營-' + year;
    }
  }

  function extractRelativePath(absPath) {
    if (!absPath) return '';
    var marker = '學習歷程 automatic';
    var idx = absPath.indexOf(marker);
    if (idx === -1) return '';
    var rel = absPath.slice(idx + marker.length);
    rel = rel.replace(/^[/\\]+/, '');
    return rel.replace(/\\/g, '/');
  }

  // ==================== 🎓 教案解析邏輯（移植自 main.js） ====================
  
  /**
   * 預設課程顏色配置（備用）
   */
  function getFallbackCourseColors() {
    return {
      'ESM': '#FFB3D9',
      'SPM': '#FFA726',
      'SPIKE': '#FFD54F',
      'BOOST': '#4FC3F7',
      'EV3': '#66BB6A',
      'SCRATCH': '#FF6B6B',
      'MINECRAFT': '#8BC34A',
      'PYTHON': '#8B5CF6',
      'OTHER': '#9E9E9E'
    };
  }
  
  /**
   * 從課程名稱生成顏色
   */
  function generateCourseColor(courseName) {
    var colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
      '#DFE6E9', '#A29BFE', '#FD79A8', '#FDCB6E', '#6C5CE7',
      '#00B894', '#E17055', '#74B9FF', '#A29BFE', '#FF7675'
    ];
    var hash = 0;
    for (var i = 0; i < courseName.length; i++) {
      hash = courseName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }
  
  /**
   * 取得預設課程類別配置
   */
  function getDefaultCourseCategoriesForRendering() {
    var COURSE_TYPE_COLORS = window.COURSE_TYPE_COLORS || getFallbackCourseColors();
    return [
      { id: 'esm', name: 'ESM', keyword: 'ESM教案', color: COURSE_TYPE_COLORS.ESM || '#FFB3D9', enabled: true },
      { id: 'spm', name: 'SPM', keyword: 'SPM教案', color: COURSE_TYPE_COLORS.SPM || '#FFA726', enabled: true },
      { id: 'spike', name: 'SPIKE', keyword: 'SPIKE教案', color: COURSE_TYPE_COLORS.SPIKE || '#FFD54F', enabled: true },
      { id: 'boost', name: 'BOOST', keyword: 'BOOST教案', color: COURSE_TYPE_COLORS.BOOST || '#4FC3F7', enabled: true },
      { id: 'ev3', name: 'EV3', keyword: 'EV3教案', color: COURSE_TYPE_COLORS.EV3 || '#66BB6A', enabled: true },
      { id: 'minecraft', name: 'MINECRAFT', keyword: 'MINECRAFT教案', color: COURSE_TYPE_COLORS.MINECRAFT || '#8BC34A', enabled: true },
      { id: 'scratch', name: 'SCRATCH', keyword: 'Scratch教案', color: COURSE_TYPE_COLORS.SCRATCH || '#FF6B6B', enabled: true }
    ];
  }
  
  /**
   * 從 URL 和事件資訊中提取教案詳細資訊（移植自 main.js）
   */
  function extractLessonInfoFromUrl(lessonUrl, event) {
    var lessonName = '查看教案';
    var lessonType = '教案';
    var lessonColor = '#667eea';
    var matched = false;
    
    var description = event.description || '';
    var COURSE_TYPE_COLORS = window.COURSE_TYPE_COLORS || getFallbackCourseColors();
    
    // 使用全域快取的課程類別配置
    var courseCategories = window.courseCategoriesCache || getDefaultCourseCategoriesForRendering();
    
    // 🔥 第一步：嘗試匹配預定義的課程類別
    for (var i = 0; i < courseCategories.length; i++) {
      var category = courseCategories[i];
      if (!category.enabled) continue;
      
      var courseTypeName = category.name.toUpperCase();
      var keyword = category.keyword || (courseTypeName + '教案');
      
      // 轉義特殊字符
      var escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // 匹配模式
      var regex1 = new RegExp('(' + escapedKeyword + ')[:\\：\\s]+([^（(\n]*?)(?:[（(]+https:\\/\\/www\\.notion\\.so)', 'i');
      var regex2 = new RegExp('(' + courseTypeName + '教案)[:\\：\\s]+([^（(\n]*?)(?:[（(]+https:\\/\\/www\\.notion\\.so)', 'i');
      var regex3 = new RegExp('(' + courseTypeName + ')[^：:\n]*教案[：:\\s]+([^（(\n]*?)(?:[（(]+https:\\/\\/www\\.notion\\.so)', 'i');
      var regex4 = new RegExp('(' + escapedKeyword + ')[^（(]*?[:\\：]?\\s+([^（(\n]{1,50})(?:[（(]+https:\\/\\/www\\.notion\\.so)', 'i');
      
      var lessonMatch = description.match(regex1) || 
                       description.match(regex2) || 
                       description.match(regex3) ||
                       description.match(regex4);
      
      if (lessonMatch && lessonMatch[2]) {
        var extracted = lessonMatch[2].trim();
        
        // 清理尾部括號、冒號、空格
        extracted = extracted.replace(/[（(]+$/, '');
        extracted = extracted.replace(/[:：]+$/, '');
        extracted = extracted.replace(/[\s　]+$/, '');
        extracted = extracted.trim();
        
        // 如果包含開括號，在開括號前截取
        if (extracted.indexOf('(') !== -1 || extracted.indexOf('（') !== -1) {
          var bracketIndex = Math.min(
            extracted.indexOf('(') !== -1 ? extracted.indexOf('(') : Infinity,
            extracted.indexOf('（') !== -1 ? extracted.indexOf('（') : Infinity
          );
          if (bracketIndex !== Infinity && bracketIndex > 0) {
            extracted = extracted.substring(0, bracketIndex).trim();
          }
        }
        
        if (extracted && extracted.length > 0 && extracted !== '查看教案' && extracted.indexOf('http') === -1) {
          lessonName = extracted;
          lessonType = category.name;
          lessonColor = COURSE_TYPE_COLORS[lessonType] || category.color || '#667eea';
          matched = true;
          console.log('✅ 識別預定義課程類別: ' + category.name + ', 教案名稱: ' + lessonName);
          break;
        }
      }
    }
    
    // 🔥 第二步：如果沒有匹配預定義類別，智能識別任意課程類別
    if (!matched && event.title) {
      var extractedCourseName = '';
      if (window.CourseStudentMatcher && window.CourseStudentMatcher.extractCourseName) {
        extractedCourseName = window.CourseStudentMatcher.extractCourseName(event.title);
      } else {
        var titleMatch = event.title.match(/^([A-Z0-9]+(?:\s+[A-Z0-9]+)*|[一-龥]+(?:\d+)?)/i);
        if (titleMatch && titleMatch[1]) {
          extractedCourseName = titleMatch[1].trim().toUpperCase();
        }
      }
      
      if (extractedCourseName) {
        var smartRegex1 = new RegExp('(' + extractedCourseName + '教案)[:\\：\\s]+([^（(\n]*?)(?:[（(]+https:\\/\\/www\\.notion\\.so)', 'i');
        var smartRegex2 = new RegExp('(' + extractedCourseName + ')[^：:\n]*教案[：:\\s]+([^（(\n]*?)(?:[（(]+https:\\/\\/www\\.notion\\.so)', 'i');
        var smartRegex3 = new RegExp('(' + extractedCourseName + '教案)[^（(]*?[:\\：]?\\s+([^（(\n]{1,50})(?:[（(]+https:\\/\\/www\\.notion\\.so)', 'i');
        
        var smartMatch = description.match(smartRegex1) || 
                        description.match(smartRegex2) ||
                        description.match(smartRegex3);
        
        if (smartMatch && smartMatch[2]) {
          var extracted2 = smartMatch[2].trim();
          
          extracted2 = extracted2.replace(/[（(]+$/, '');
          extracted2 = extracted2.replace(/[:：]+$/, '');
          extracted2 = extracted2.replace(/[\s　]+$/, '');
          extracted2 = extracted2.trim();
          
          if (extracted2.indexOf('(') !== -1 || extracted2.indexOf('（') !== -1) {
            var bracketIndex2 = Math.min(
              extracted2.indexOf('(') !== -1 ? extracted2.indexOf('(') : Infinity,
              extracted2.indexOf('（') !== -1 ? extracted2.indexOf('（') : Infinity
            );
            if (bracketIndex2 !== Infinity && bracketIndex2 > 0) {
              extracted2 = extracted2.substring(0, bracketIndex2).trim();
            }
          }
          
          if (extracted2 && extracted2.length > 0 && extracted2 !== '查看教案' && extracted2.indexOf('http') === -1) {
            lessonName = extracted2;
            lessonType = extractedCourseName;
            lessonColor = COURSE_TYPE_COLORS[lessonType] || generateCourseColor(extractedCourseName);
            console.log('🧠 智能識別新課程類別: ' + extractedCourseName + ', 教案名稱: ' + lessonName);
          }
        }
      }
    }
    
    // 🔥 第三步：如果還是沒找到教案名稱，嘗試更寬鬆的匹配
    if (lessonName === '查看教案' && description) {
      var beforeLinkMatch = description.match(/([^：:\n]{1,50})(?:[：:]?\s*)?(?:[（(]*)?https:\/\/www\.notion\.so/);
      if (beforeLinkMatch && beforeLinkMatch[1]) {
        var candidate = beforeLinkMatch[1].trim();
        candidate = candidate.replace(/(?:^[^\s]*教案[：:\s]*)/i, '');
        
        candidate = candidate.replace(/[（(]+$/, '');
        candidate = candidate.replace(/[:：]+$/, '');
        candidate = candidate.replace(/[\s　]+$/, '');
        candidate = candidate.trim();
        
        if (candidate.indexOf('(') !== -1 || candidate.indexOf('（') !== -1) {
          var bracketIndex3 = Math.min(
            candidate.indexOf('(') !== -1 ? candidate.indexOf('(') : Infinity,
            candidate.indexOf('（') !== -1 ? candidate.indexOf('（') : Infinity
          );
          if (bracketIndex3 !== Infinity && bracketIndex3 > 0) {
            candidate = candidate.substring(0, bracketIndex3).trim();
          }
        }
        
        if (candidate && candidate.length > 0 && candidate.length <= 30 && 
            candidate.indexOf('http') === -1 && candidate.indexOf('班級') === -1 && candidate.indexOf('講師') === -1) {
          lessonName = candidate;
          console.log('🔍 寬鬆匹配找到教案名稱: ' + lessonName);
        }
      }
    }
    
    // 🔥 第四步：如果 lessonType 還是"教案"，嘗試從描述中提取"教案"前的文字
    if (lessonType === '教案' && description) {
      var lessonTypePattern = /([A-Za-z0-9\u4e00-\u9fa5]+)\s*教案[：:\s]*/i;
      var typeMatch = description.match(lessonTypePattern);
      
      if (typeMatch && typeMatch[1]) {
        var extractedType = typeMatch[1].trim();
        
        var invalidTypes = ['查看', '課程', '教案', '名稱', '連結', 'http', 'https', 'www'];
        if (invalidTypes.indexOf(extractedType) === -1 && extractedType.length <= 20) {
          lessonType = extractedType;
          console.log('✅ 自動識別教案類型: ' + lessonType);
        }
      }
    }
    
    return {
      url: lessonUrl,
      name: lessonName,
      type: lessonType,
      color: lessonColor
    };
  }
  
  /**
   * 同步提取教案資訊（移植自 main.js）
   */
  function extractLessonInfoSync(event) {
    // 🎯 第一步：優先使用後端提供的 lessonPlanUrl（如果存在）
    if (event.lessonPlanUrl && typeof event.lessonPlanUrl === 'string' && event.lessonPlanUrl.trim() !== '') {
      var lessonUrl = event.lessonPlanUrl.trim();
      if (lessonUrl.indexOf('notion.so/') !== -1) {
        console.log('✅ 使用後端提供的教案連結:', lessonUrl);
        return extractLessonInfoFromUrl(lessonUrl, event);
      }
    }
    
    // 🎯 第二步：從描述中提取
    if (!event.description) {
      return null;
    }
    
    var lessonUrl = null;
    
    // 方式1：匹配 Notion URL（包括參數）
    var notionUrlPattern = /https:\/\/www\.notion\.so\/[^\s\n\r\)\uFF09]+/;
    var urlMatch = event.description.match(notionUrlPattern);
    
    if (urlMatch) {
      lessonUrl = urlMatch[0];
    }
    
    // 方式2：更寬鬆的格式
    if (!lessonUrl) {
      var generalPattern = /https:\/\/www\.notion\.so\/[^\s\n\r]+/;
      var generalMatch = event.description.match(generalPattern);
      if (generalMatch) {
        lessonUrl = generalMatch[0].replace(/[)）]+$/, '').trim();
      }
    }
    
    if (!lessonUrl) {
      return null;
    }
    
    // 從連結中提取 Notion ID
    var urlIdMatch = lessonUrl.match(/notion\.so\/([^?\s]+)/);
    if (!urlIdMatch) {
      return null;
    }
    
    return extractLessonInfoFromUrl(lessonUrl, event);
  }

  /**
   * 從課程物件中提取課程主題（用於資料夾命名）
   * @param {Object} course - 課程物件（currentCourse）
   * @returns {string} 課程主題（已清理特殊字符）
   */
  function extractCourseTopicForPath(course) {
    if (!course) return '';
    
    // 🔥 第一優先：使用教案解析邏輯
    var lessonInfo = extractLessonInfoSync(course);
    
    if (lessonInfo && lessonInfo.name && lessonInfo.name !== '查看教案') {
      var topic = lessonInfo.name;
      
      // 清理：移除空格、檔案系統禁用字符
      topic = topic
        .replace(/\s+/g, '')  // "ai 客製" -> "ai客製"
        .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '')  // 移除檔案系統禁用字符
        .substring(0, 50)
        .trim();
      
      if (topic) {
        console.log('📁 提取課程主題（教案）:', topic);
        return topic;
      }
    }
    
    // 🔥 第二備用：從課程標題中提取特殊標記
    if (course.title) {
      var title = course.title;
      
      // 移除特殊事件標記
      var specialMarkers = ['[停課]', '[體驗]', '[改時間]', '[代課]'];
      specialMarkers.forEach(function(marker) {
        title = title.replace(marker, '');
      });
      
      // 移除講師名稱（假設格式為「課程 - 講師」）
      title = title.replace(/\s*[-－]\s*[^-－]+$/, '');
      
      // 移除課程類型前綴（如 SPIKE、SPM 等）
      title = title.replace(/^(SPIKE|SPM|ESM|BOOST|EV3|MINECRAFT|SCRATCH|PYTHON)\s+/i, '');
      
      // 移除時段（如 「一 0900-1030」）
      title = title.replace(/[日一二三四五六]\s+\d{4}-\d{4}/g, '');
      
      // 移除「第N週」標記
      title = title.replace(/第\d+週/g, '');
      
      // 清理空白與特殊字符
      title = title
        .trim()
        .replace(/\s+/g, '')
        .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '')
        .substring(0, 50)
        .trim();
      
      if (title) {
        console.log('📁 提取課程主題（標題）:', title);
        return title;
      }
    }
    
    // 🔥 第三備用：使用課程 ID 的一部分（確保總是有主題）
    if (course.id) {
      var idPart = course.id.split('-')[0] || course.id.substring(0, 8);
      console.log('📁 使用課程 ID 作為主題:', idPart);
      return idPart;
    }
    
    console.log('📁 無法提取課程主題，使用預設值');
    return '課程';  // 總是返回一個預設值，避免純日期資料夾
  }

  function composeRelativePath(info, studentName, cacheMeta) {
    // 🔥 使用統一的 DrivePathHelper（如果可用）
    if (window.drivePathHelper && window.drivePathHelper.buildPath) {
      var normalizedStudent = (studentName || '').trim();
      var semester = resolveSemesterSegment(info, cacheMeta);
      var coursePeriodRaw = (info && info.coursePeriod) || (cacheMeta && cacheMeta.coursePeriod) || '';
      if (!coursePeriodRaw && currentCourse) {
        coursePeriodRaw = currentCourse.title || currentCourse.courseName || currentCourse.coursePeriod || '';
      }
      
      var date = (info && info.date) || (cacheMeta && cacheMeta.date) || '';
      var topicHint = (info && info.topic) || (cacheMeta && cacheMeta.topic) || '';
      if (shouldFallbackTopic(topicHint, coursePeriodRaw) && currentCourse) {
        topicHint = extractCourseTopicForPath(currentCourse);
      }
      
      return window.drivePathHelper.buildPath({
        semester: semester,
        courseName: coursePeriodRaw,
        date: date,
        topic: topicHint,
        studentName: normalizedStudent,
        isOverview: normalizedStudent === '課程總覽'
      });
    }
    
    // 備用邏輯
    var normalizedStudent = (studentName || '').trim();
    var semester = resolveSemesterSegment(info, cacheMeta);
    var coursePeriodRaw = (info && info.coursePeriod) || (cacheMeta && cacheMeta.coursePeriod) || '';
    if (!coursePeriodRaw && currentCourse) {
      coursePeriodRaw = currentCourse.title || currentCourse.courseName || currentCourse.coursePeriod || '';
    }
    var coursePeriod = sanitizeDriveSegment(coursePeriodRaw) || '未命名課程';
    var date = (info && info.date) || (cacheMeta && cacheMeta.date) || '';
    var isOverview = normalizedStudent === '課程總覽';

    var topicHint = (info && info.topic) || (cacheMeta && cacheMeta.topic) || '';
    if (shouldFallbackTopic(topicHint, coursePeriodRaw) && currentCourse) {
      topicHint = extractCourseTopicForPath(currentCourse);
    }
    var sanitizedTopic = sanitizeDriveSegment(topicHint);

    var dateFolder = sanitizeDriveSegment(date);
    if (dateFolder && sanitizedTopic) {
      dateFolder = dateFolder + ' ' + sanitizedTopic;
    } else if (!dateFolder) {
      dateFolder = sanitizedTopic ? sanitizedTopic : '未命名主題';
    }
    
    // 🔍 除錯：輸出路徑組合資訊（特別是課程總覽）
    if (isOverview) {
      console.log('📁 [composeRelativePath] 課程總覽:', {
        date: date,
        topic: sanitizedTopic,
        dateFolder: dateFolder,
        semester: semester,
        coursePeriod: coursePeriod,
        currentCourse: currentCourse ? {
          title: currentCourse.title,
          description: currentCourse.description
        } : null
      });
    }
    
    var parts = [];
    if (semester) parts.push(semester);
    if (coursePeriod) parts.push(coursePeriod);
    if (dateFolder) parts.push(dateFolder);
    if (normalizedStudent) parts.push(normalizedStudent);
    if (parts.length) return parts.join('/');
    if (cacheMeta && cacheMeta.relativePath) {
      var base = String(cacheMeta.relativePath).replace(/[/\\]+$/, '').replace(/\\/g, '/');
      return normalizedStudent ? (base ? base + '/' + normalizedStudent : normalizedStudent) : base;
    }
    return '';
  }

  // 🧭 將 relativePath 中的課程段替換為指定的 coursePeriod（保留其餘結構）
  function rewriteRelativePathCoursePeriod(relativePath, coursePeriod) {
    try {
      var rel = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
      if (!rel) return rel;
      var parts = rel.split('/');
      var cpIndex = 0;
      // 判斷第一段是否為學期標記
      if (/^(\d{3}-[12]|夏令營-\d{4}|冬令營-\d{4})$/.test(parts[0] || '')) cpIndex = 1;
      if (parts.length > cpIndex) parts[cpIndex] = String(coursePeriod || '').trim();
      return parts.join('/');
    } catch (e) { return String(relativePath || ''); }
  }

  function clearStudentDraftEntry(index) {
    if (!(window.FLB && FLB.State)) return;
    try {
      var stDraft = FLB.State.get();
      if (!stDraft || !stDraft.drafts || !stDraft.drafts.hasOwnProperty(String(index))) return;
      var draftsClean = Object.assign({}, stDraft.drafts);
      delete draftsClean[String(index)];
      FLB.State.set({ drafts: draftsClean });
      console.log('🧹 [草稿] 已清除學生草稿:', index);
    } catch (e) {
      console.warn('⚠️ [草稿] 清除失敗:', e);
    }
  }

  function resetStudentLocalState(index, student) {
    ensureStudentFileEntry(index, student || {});
    var base = studentFiles[index];
    base.photos = [];
    base.videos = [];
    base.comment = '';
    base.baselineComment = '';
    base.syncedComment = '';
    base.lastSyncedAt = 0;
    base.existingCounts = { photos: 0, videos: 0, text: 0 };
    cancelAutoUpload(index);
    var commentArea = document.getElementById('comment-' + index);
    if (commentArea) commentArea.value = '';
    try {
      ['photos', 'videos'].forEach(function(type) {
        var wrap = document.getElementById(type + '-preview-' + index);
        if (!wrap) return;
        var nodes = wrap.querySelectorAll('.file-preview.existing');
        Array.prototype.forEach.call(nodes, function(node) { node.remove(); });
      });
    } catch (e) {}
    try { clearStudentDraftEntry(index); } catch (e) {}
    try { checkUploadReady(index, { silent: true }); } catch (e) {}
    console.log('🧼 [學生狀態] 已重置本地狀態並取消排程:', student && student.name, index);
  }

  function normalizeNewlines(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function formatCommentForInput(value) {
    return normalizeNewlines(value || '');
  }

  function normalizeComment(value) {
    return normalizeNewlines(typeof value === 'string' ? value : '').trim();
  }

  function getSyncedComment(base) {
    if (!base) return '';
    if (typeof base.syncedComment === 'string') return base.syncedComment;
    if (typeof base.baselineComment === 'string') return normalizeComment(base.baselineComment);
    return '';
  }

  function markCommentSynced(index, comment, opts) {
    if (typeof index !== 'number') return;
    if (!studentFiles[index]) studentFiles[index] = { photos: [], videos: [], comment: '', baselineComment: '', syncedComment: '', existingCounts: { photos: 0, videos: 0, text: 0 } };
    var base = studentFiles[index];
    var formatted = formatCommentForInput(comment);
    var normalized = normalizeComment(formatted);
    base.comment = (opts && opts.skipCommentAssign) ? base.comment : formatted;
    base.baselineComment = formatted;
    base.syncedComment = normalized;
    base.lastSyncedAt = Date.now();
    base.existingCounts = base.existingCounts || { photos: 0, videos: 0, text: 0 };
    base.existingCounts.text = normalized.length;
    if (!(opts && opts.skipDraftClear)) {
      try { clearStudentDraftEntry(index); } catch (e) {}
    }
    CommentSyncManager.markSynced(index, base.comment);
  }

  function hasCommentChanged(base) {
    if (!base) return false;
    return normalizeComment(base.comment) !== getSyncedComment(base);
  }

  function safeResolveRelativePathHint(record, fallback) {
    if (typeof resolveRelativePathHint === 'function') {
      try { return resolveRelativePathHint(record, fallback); } catch (e) {}
    }
    if (record) {
      if (record.relativePath) return record.relativePath;
      if (record.recordPath) return record.recordPath;
      if (record.path) return record.path;
    }
    return fallback || '';
  }

  // 方便 DevTools 檢查
  if (typeof window !== 'undefined') {
    window.studentFiles = studentFiles;
    window.resetStudentLocalState = resetStudentLocalState;
    window.clearStudentDraftEntry = clearStudentDraftEntry;
  }

  // ✅ Synology Drive 新媒體 API 參數工具（供 buildRecordFileUrl、抽屜等共用）
  function resolveRelativePathHint(record, fallback) {
    if (record) {
      if (record.relativePath) return record.relativePath;
      if (record.recordPath) return record.recordPath;
      if (record.path) return record.path;
    }
    return fallback || '';
  }

  function findPhotoEntryById(record, photoId) {
    if (!record || !photoId) return null;
    var candidates = [];
    if (Array.isArray(record.newMediaPhotos)) candidates.push(record.newMediaPhotos);
    if (Array.isArray(record.photos)) candidates.push(record.photos);
    if (record.files && Array.isArray(record.files.photos)) candidates.push(record.files.photos);
    for (var i = 0; i < candidates.length; i++) {
      var match = candidates[i].find(function(entry) {
        if (!entry) return false;
        if (entry.id && entry.id === photoId) return true;
        if (entry.photoId && entry.photoId === photoId) return true;
        return false;
      });
      if (match) return match;
    }
    return null;
  }

  function buildDrivePhotoPreviewUrl(photoId, record, overrides) {
    console.log('🔥 [buildDrivePhotoPreviewUrl] 開始處理', {
      photoId: photoId,
      recordStudentName: record && record.studentName,
      recordRelativePath: record && record.relativePath,
      recordPath: record && record.path,
      overridesRelativePath: overrides && overrides.relativePath,
      overridesFilename: overrides && overrides.filename
    });
    if (!photoId) return '';
    var entry = findPhotoEntryById(record, photoId);
    if (entry) {
      if (entry.proxyUrl) return entry.proxyUrl;
      if (entry.thumbnailProxyUrl && overrides && overrides.useThumbnail) {
        return entry.thumbnailProxyUrl;
      }
      if (entry.drivePath || entry.path) {
        // 🔥 修復 2025-11-21：確保路徑包含 Drive 根前綴
        var pathValue = entry.drivePath || entry.path;
        var absolutePath = pathValue;
        if (!pathValue.startsWith('/Fun Learn Bar/FLB-Learning-Portfolio')) {
          absolutePath = ensureDriveAbsolutePath(pathValue);
        }
        console.log('🔍 [buildDrivePhotoPreviewUrl] drivePath:', pathValue, '→ absolutePath:', absolutePath);
        
        // 🔥 關鍵修復：直接構建完整路徑，不依賴 ensureDriveMediaProxy
        var finalUrl = '/api/drive-media' + absolutePath;
        console.log('🔍 [buildDrivePhotoPreviewUrl] drivePath finalUrl:', finalUrl);
        return encodeURI(finalUrl);
      }
      var derivedBase = entry.relativePath || entry.recordPath || safeResolveRelativePathHint(record);
      var derivedName = entry.filename || entry.fileName || entry.name;
      if (derivedBase && derivedName) {
        // 🔥 修復 2025-11-21：確保路徑包含 Drive 根前綴
        // derivedBase 可能是相對路徑，需要轉換為絕對路徑
        var absolutePath = derivedBase;
        if (!derivedBase.startsWith('/Fun Learn Bar/FLB-Learning-Portfolio')) {
          absolutePath = ensureDriveAbsolutePath(derivedBase);
        }
        console.log('🔍 [buildDrivePhotoPreviewUrl] derivedBase:', derivedBase, '→ absolutePath:', absolutePath);
        
        // 🔥 關鍵修復：直接構建完整路徑，不依賴 ensureDriveMediaProxy
        var fullPath = (absolutePath + '/' + derivedName).replace(/\/+/g, '/');
        var finalUrl = '/api/drive-media' + fullPath;
        console.log('🔍 [buildDrivePhotoPreviewUrl] fullPath:', fullPath, '→ finalUrl:', finalUrl);
        return encodeURI(finalUrl);
      }
    }
    console.log('🔥 [buildDrivePhotoPreviewUrl] 進入 fallback 邏輯，entry 為:', entry);
    var fallbackBase = (overrides && overrides.relativePath) || safeResolveRelativePathHint(record);
    var fallbackName = entry && (entry.filename || entry.name) || (overrides && overrides.filename);
    console.log('🔥 [buildDrivePhotoPreviewUrl] fallback 參數', {
      fallbackBase: fallbackBase,
      fallbackName: fallbackName,
      'overrides.relativePath': overrides && overrides.relativePath,
      'overrides.filename': overrides && overrides.filename
    });
    
    if (fallbackBase && fallbackName) {
      // 🔥 修復 2025-11-21：確保路徑包含 Drive 根前綴
      // fallbackBase 可能是相對路徑，需要轉換為絕對路徑
      var absolutePath = fallbackBase;
      if (!fallbackBase.startsWith('/Fun Learn Bar/FLB-Learning-Portfolio')) {
        absolutePath = ensureDriveAbsolutePath(fallbackBase);
      }
      console.log('🔍 [buildDrivePhotoPreviewUrl] fallbackBase:', fallbackBase, '→ absolutePath:', absolutePath);
      
      // 🔥 關鍵修復：直接構建完整路徑，不依賴 ensureDriveMediaProxy
      var fullPath = (absolutePath + '/' + fallbackName).replace(/\/+/g, '/');
      var finalUrl = '/api/drive-media' + fullPath;
      console.log('🔍 [buildDrivePhotoPreviewUrl] fallback fullPath:', fullPath, '→ finalUrl:', finalUrl);
      return encodeURI(finalUrl);
    }
    
    // 🔥 如果沒有 fallbackName，但有 photoId，構建一個基於 photoId 的預設路徑
    if (fallbackBase && photoId) {
      console.log('🔥 [buildDrivePhotoPreviewUrl] 無 fallbackName，使用 photoId 作為檔名');
      var absolutePath = fallbackBase;
      if (!fallbackBase.startsWith('/Fun Learn Bar/FLB-Learning-Portfolio')) {
        absolutePath = ensureDriveAbsolutePath(fallbackBase);
      }
      // 假設 photoId 就是檔名（不含副檔名），添加 .jpeg 副檔名
      var fallbackFilename = photoId + (photoId.indexOf('.') === -1 ? '.jpeg' : '');
      var fullPath = (absolutePath + '/' + fallbackFilename).replace(/\/+/g, '/');
      var finalUrl = '/api/drive-media' + fullPath;
      console.log('🔍 [buildDrivePhotoPreviewUrl] photoId fallback:', {
        photoId: photoId,
        fallbackFilename: fallbackFilename,
        fullPath: fullPath,
        finalUrl: finalUrl
      });
      return encodeURI(finalUrl);
    }
    
    console.log('❌ [buildDrivePhotoPreviewUrl] 無法構建 URL，返回空字串');
    return '';
  }

  function getRecordCacheEntry(studentName) {
    if (!(window.FLB && FLB.State)) return null;
    var st = FLB.State.get();
    var cache = st.uploadedRecordsCache || {};
    var students = Array.isArray(cache.students) ? cache.students : [];
    var entry = students.find(function (r) { return (r.studentName || '') === (studentName || ''); }) || null;
    var info = parseFsCourseInfo(entry && entry.path ? entry.path : (cache && cache.path), entry ? entry.studentName : studentName);
    var relativePath = '';
    if (entry && entry.relativePath) {
      relativePath = entry.relativePath;
    } else if (entry && entry.path) {
      relativePath = extractRelativePath(entry.path);
    }
    if (!info && currentCourse) {
      var startDate = currentCourse.start ? new Date(currentCourse.start) : null;
      var dateStr = startDate ? formatDateTWISO(startDate) : (cache && cache.meta && cache.meta.date) || '';
      var fullTitle = (currentCourse && currentCourse.title) ? String(currentCourse.title).trim() : '';
      var fallbackTopic = extractCourseTopicForPath(currentCourse);
      info = {
        studentName: studentName || '',
        date: dateStr,
        topic: fallbackTopic,
        coursePeriod: fullTitle,
        semester: cache && cache.meta && cache.meta.semester || ''
      };
    }
    if (!relativePath) {
      relativePath = composeRelativePath(info, studentName, cache.meta);
    }
    var coursePeriodInfo = info ? splitCoursePeriod(info.coursePeriod) : { course: '', period: '' };
    return {
      entry: entry,
      info: info,
      course: coursePeriodInfo.course,
      period: coursePeriodInfo.period,
      coursePeriod: info ? info.coursePeriod : '',
      date: info ? info.date : '',
      topic: info ? info.topic : '',
      relativePath: relativePath,
      cacheMeta: cache.meta || {}
    };
  }

  function ensureDriveMediaProxy(pathValue) {
    if (!pathValue) return '';
    var str = String(pathValue || '').trim();
    if (!str) return '';
    if (/^https?:\/\//i.test(str)) return str;
    if (str.indexOf('/api/drive-media') === 0) return encodeURI(str);
    
    // 🔥 修復 2025-11-21：確保路徑包含 Drive 根前綴
    // 如果是相對路徑（以學期代號開頭，如 114-1），則添加前綴
    var absolutePath = str;
    if (!str.startsWith('/Fun Learn Bar/FLB-Learning-Portfolio')) {
      // 檢查是否是相對路徑（以學期代號開頭）
      if (/^\d+-\d\//.test(str)) {
        absolutePath = '/Fun Learn Bar/FLB-Learning-Portfolio/' + str;
      } else {
        absolutePath = ensureDriveAbsolutePath(str);
      }
    }
    
    var finalUrl = encodeURI(('/api/drive-media' + absolutePath).replace(/\/{2,}/g, '/'));
    console.log('🔍 [ensureDriveMediaProxy] input:', pathValue, '→ output:', finalUrl);
    return finalUrl;
  }

  function resolveVideoMetaUrl(record, meta, requestThumbnail) {
    if (!meta) return '';
    if (requestThumbnail) {
      if (meta.thumbnailProxyUrl) return meta.thumbnailProxyUrl;
      if (meta.thumbnailFilename) {
        return buildRecordFileUrl(record, meta.thumbnailFilename, { _skipNewMedia: true });
      }
    } else {
      if (meta.proxyUrl) return meta.proxyUrl;
      if (meta.transcodedProxyUrl) return meta.transcodedProxyUrl;
      if (meta.drivePath) return ensureDriveMediaProxy(meta.drivePath);
      if (meta.transcodedFilename) {
        return buildRecordFileUrl(record, meta.transcodedFilename, { _skipNewMedia: true });
      }
      if (meta.filename) {
        return buildRecordFileUrl(record, meta.filename, { _skipNewMedia: true });
      }
    }
    // 🔥 [修復 2025-11-23] 只在完全找不到任何 URL 時才警告
    // 如果有 filename，buildRecordFileUrl 會處理降級邏輯，不需要警告
    return '';
  }

  function normalizeVideoMeta(entry) {
    if (!entry || typeof entry !== 'object') return null;
    return {
      id: entry.id || entry.mediaId || entry.videoId || null,
      proxyUrl: entry.proxyUrl || entry.url || null,
      transcodedProxyUrl: entry.transcodedProxyUrl || null,
      drivePath: entry.drivePath || entry.path || null,
      filename: entry.fileName || entry.filename || null,
      originalName: entry.originalName || entry.originaName || entry.originalFilename || null,
      transcodedFilename: entry.transcodedFilename || null,
      thumbnailProxyUrl: entry.thumbnailProxyUrl || null,
      thumbnailFilename: entry.thumbnailFilename || null
    };
  }

  function buildRecordFileUrl(record, filename, options) {
    options = options || {};
    var skipNewMediaCheck = !!options._skipNewMedia;
    if (!record || !filename) return '';
    var fileMeta = null;

    // 🔥 安全檢查：如果 filename 是物件，嘗試提取實際檔名
    if (typeof filename === 'object' && filename !== null) {
      fileMeta = filename;
      console.warn('⚠️ [buildRecordFileUrl] filename 是物件，嘗試提取:', filename);
      // 嘗試直接使用 proxyUrl
      if (!skipNewMediaCheck && (fileMeta.proxyUrl || fileMeta.transcodedProxyUrl || fileMeta.drivePath)) {
        var directMetaUrl = fileMeta.proxyUrl || fileMeta.transcodedProxyUrl || ensureDriveMediaProxy(fileMeta.drivePath);
        if (directMetaUrl) return directMetaUrl;
      }
      var actualFilename = fileMeta.filename || fileMeta.transcodedFilename || fileMeta.name || fileMeta.originalName || fileMeta.originalname || fileMeta.drivePath || '';
      if (actualFilename && typeof actualFilename === 'string') {
        console.log('✅ [buildRecordFileUrl] 成功提取 filename:', actualFilename);
        filename = actualFilename;
      } else {
        console.error('❌ [buildRecordFileUrl] 無法從物件中提取 filename:', filename);
        return '';  // 無法提取，返回空字串
      }
    }

    // 🔥 最後確認 filename 是字串
    if (typeof filename !== 'string') {
      console.error('❌ [buildRecordFileUrl] filename 不是字串:', { filename, type: typeof filename });
      return '';
    }
    
    // 🔍 調試：檢查是否為縮圖文件
    var isThumbnail = isGeneratedThumbnailName(filename);
    var isVideo = isVideoFilename(filename);

    if (fileMeta) {
      if (isThumbnail && (fileMeta.thumbnailProxyUrl || fileMeta.thumbnailFilename)) {
        if (fileMeta.thumbnailProxyUrl) return fileMeta.thumbnailProxyUrl;
        return buildRecordFileUrl(record, fileMeta.thumbnailFilename, { _skipNewMedia: true });
      }
      if (!isThumbnail && (fileMeta.proxyUrl || fileMeta.transcodedProxyUrl || fileMeta.drivePath)) {
        if (fileMeta.proxyUrl) return fileMeta.proxyUrl;
        if (fileMeta.transcodedProxyUrl) return fileMeta.transcodedProxyUrl;
        if (fileMeta.drivePath) return ensureDriveMediaProxy(fileMeta.drivePath);
      }
    }

    // 🔍 完整调试：显示 record 对象的关键字段
    console.log('🔗 [buildRecordFileUrl] 構建URL:', {
      'filename': filename,
      '是否為縮圖': isThumbnail,
      '是否為影片': isVideo,
      'record.studentName': record.studentName || record.name,
      'hasNewMediaVideos': !!(record.newMediaVideos && record.newMediaVideos.length),
      'hasNewMediaPhotos': !!(record.newMediaPhotos && record.newMediaPhotos.length),
      'record.newMediaVideos': record.newMediaVideos,
      'record.newMediaPhotos': record.newMediaPhotos,
      'record所有key': Object.keys(record || {})
    });

    var relativePathHint = safeResolveRelativePathHint(record);

    // 🔥 優先檢查新媒體系統數組（by-course API 返回的格式）
    // 檢查影片
    function matchVideoFromList(list) {
      if (!list || !list.length) return null;
      return list.map(normalizeVideoMeta).find(function(meta) {
        if (!meta) return false;
        if (fileMeta && meta.id && fileMeta.id && meta.id === fileMeta.id) return true;
        var names = [meta.filename, meta.originalName, meta.transcodedFilename].filter(Boolean);
        return names.some(function(name) { return name === filename; });
      });
    }

    if (!skipNewMediaCheck && record.newMediaVideos && Array.isArray(record.newMediaVideos)) {
      var matchedVideo = matchVideoFromList(record.newMediaVideos);
      if (matchedVideo) {
        var videoUrl = resolveVideoMetaUrl(record, matchedVideo, isThumbnail);
        if (videoUrl) return videoUrl;
      }
    }

    if (!skipNewMediaCheck && Array.isArray(record.videos) && record.videos.length && typeof record.videos[0] === 'object') {
      var legacyVideo = matchVideoFromList(record.videos);
      if (legacyVideo) {
        var legacyUrl = resolveVideoMetaUrl(record, legacyVideo, isThumbnail);
        if (legacyUrl) return legacyUrl;
      }
    }

    if (!skipNewMediaCheck && record.files && Array.isArray(record.files.videos) && record.files.videos.length && typeof record.files.videos[0] === 'object') {
      var fileListVideo = matchVideoFromList(record.files.videos);
      if (fileListVideo) {
        var fileListUrl = resolveVideoMetaUrl(record, fileListVideo, isThumbnail);
        if (fileListUrl) return fileListUrl;
      }
    }
    
    // 檢查照片
    if (!skipNewMediaCheck && record.newMediaPhotos && Array.isArray(record.newMediaPhotos)) {
      var photo = record.newMediaPhotos.find(function(p) {
        if (fileMeta && p.id && fileMeta.id && p.id === fileMeta.id) return true;
        return p.filename === filename || p.originalName === filename;
      });
      if (photo && (photo.id || photo.proxyUrl)) {
        if (photo.proxyUrl) {
          console.log('📸 [新媒體系統] 使用照片 proxyUrl:', photo.proxyUrl);
          return photo.proxyUrl;
        }
        // 🔥 [修復] 構建完整的預覽 URL（包含必要參數）
        var coursePeriod = record.coursePeriod || (currentCourse && currentCourse.coursePeriod) || '';
        var date = record.date || (currentCourse && currentCourse.date) || '';
        var studentName = record.studentName || record.name || '';
        var courseName = record.courseName || (currentCourse && currentCourse.courseName) || '';
        var semester = record.semester || (currentCourse && currentCourse.semester) || '';
        var url = buildDrivePhotoPreviewUrl(photo.id, record, {
          date: date,
          studentName: studentName,
          coursePeriod: coursePeriod,
          courseName: courseName,
          semester: semester,
          relativePath: relativePathHint
        });
        
        console.log('📸 [新媒體系統] 使用照片 API:', { photoId: photo.id, coursePeriod: coursePeriod, date: date, studentName: studentName, url: url });
        return url;
      }
    }
    
    // 🔥 兼容舊的單個 mediaId/photoId 格式（向後兼容）
    if (record.photoId) {
      var photoId = record.photoId;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(photoId))) {
        console.log('📸 [舊格式] 使用新媒體照片 API:', photoId, filename);
        return buildDrivePhotoPreviewUrl(photoId, record, { relativePath: relativePathHint });
      }
    }
    
    if (record.mediaId || record.videoMediaId) {
      var mediaId = record.mediaId || record.videoMediaId;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(mediaId))) {
        console.warn('🎬 [舊格式] mediaId 僅支援 Drive 資料，請確認紀錄已遷移:', mediaId, filename);
        return '';
      }
    }
    
    // 🔥 [修復 2025-11-23] 使用標準 Drive API 路徑（動態構建）
    // 註：proxyUrl 和 Drive 代理路徑都是通過 Drive API 訪問，只是 URL 來源不同
    console.log('🔗 [buildRecordFileUrl] 使用 Drive API 路徑:', filename);
    
    // 🔥 再次確保 filename 是字串（防止在後續處理中 filename 被重新賦值為物件）
    var actualFilename = filename;
    if (typeof actualFilename === 'object' && actualFilename !== null) {
      actualFilename = actualFilename.filename || actualFilename.name || actualFilename.path || '';
      if (!actualFilename) {
        console.error('❌ [buildRecordFileUrl] 無法從物件中提取 filename:', filename);
        return '';
      }
    }
    actualFilename = String(actualFilename || '').trim();
    if (!actualFilename) {
      console.error('❌ [buildRecordFileUrl] filename 為空:', { filename, record: record.studentName });
      return '';
    }
    
    var meta = getRecordCacheEntry(record.studentName || '');
    var relativePath = '';
    
    // 優先使用伺服器回傳的路徑（避免被本地推導值覆蓋）
    if (record && record.relativePath) {
      relativePath = record.relativePath;
    } else if (record && record.recordPath) {
      relativePath = record.recordPath;
    } else if (record && record.path) {
      try {
        relativePath = extractRelativePath(record.path) || record.path || '';
      } catch (errRel) {
        relativePath = record.path || '';
      }
    }
    
    // 若伺服器未提供，再回退到本地快取推導值
    if (!relativePath && meta && meta.relativePath) {
      relativePath = meta.relativePath;
    } else if (!relativePath && meta && meta.entry && meta.entry.relativePath) {
      relativePath = meta.entry.relativePath;
    }

    if (!relativePath) {
      console.warn('⚠️ 無法獲取 relativePath，無法構建 Drive 路徑');
      return '';
    }
    
    // 🔥 修復 2025-11-21：relativePath 由後端 API 返回，可能是相對路徑
    // buildDirectFileUrl 會通過 normalizeDriveRelativePath 和 ensureDriveAbsolutePath 正確處理
    var directOptions = Object.assign({}, options || {});
    if (!directOptions.record) {
      directOptions.record = record;
    }
    if (!directOptions.cacheEntry) {
      directOptions.cacheEntry = meta || null;
    }
    var url = buildDirectFileUrl(relativePath, actualFilename, directOptions);
    if (!url) {
      console.warn('⚠️ 無法構建 Drive 代理 URL', { relativePath: relativePath, filename: actualFilename });
    }
    return url;
  }

  function getExistingCounts(index) {
    var base = studentFiles[index] || {};
    return base.existingCounts || { photos: 0, videos: 0, text: 0 };
  }

  function refreshRecordItemStats(recordItem) {
    if (!recordItem) return;
    var stats = recordItem.querySelector('.record-item-stats');
    if (!stats) return;
    var photosNow = recordItem.querySelectorAll('.file-previews .file-preview.existing img').length;
    var videosNow = recordItem.querySelectorAll('.file-previews .file-preview.existing video').length;
    stats.innerHTML = '<span><i class="fas fa-camera"></i> ' + photosNow + '</span><span><i class="fas fa-video"></i> ' + videosNow + '</span>';
  }

  function getTotalCount(index, type) {
    var existing = getExistingCounts(index);
    var base = studentFiles[index] || {};
    var current = Array.isArray(base[type]) ? base[type].length : 0;
    if (type === 'photos') return (existing.photos || 0) + current;
    if (type === 'videos') return (existing.videos || 0) + current;
    return current;
  }

  function ensureStudentFileEntry(index, student) {
    if (index === OVERVIEW_UPLOAD_INDEX) {
      if (!overviewUploadEntry) {
        overviewUploadEntry = {
          photos: [],
          videos: [],
          comment: '',
          baselineComment: '',
          syncedComment: '',
          existingCounts: { photos: 0, videos: 0, text: 0 },
          locked: false,
          lockReason: '',
          lockStatus: ''
        };
      }
      studentFiles[OVERVIEW_UPLOAD_INDEX] = overviewUploadEntry;
      return overviewUploadEntry;
    }
    if (!studentFiles[index]) {
      studentFiles[index] = { photos: [], videos: [], comment: '', baselineComment: '', syncedComment: '', existingCounts: { photos: 0, videos: 0, text: 0 } };
    } else if (!studentFiles[index].existingCounts) {
      studentFiles[index].existingCounts = { photos: 0, videos: 0, text: 0 };
    }
    var base = studentFiles[index];
    if (typeof base.syncedComment !== 'string') {
      base.syncedComment = normalizeComment(base.baselineComment);
    }
    if (typeof base.locked !== 'boolean') base.locked = false;
    if (typeof base.lockReason !== 'string') base.lockReason = '';
    if (typeof base.lockStatus !== 'string') base.lockStatus = '';
    if (window.FLB && FLB.State) {
      var st = FLB.State.get();
      if (st && st.uploadedRecordsCache) {
        var records = Array.isArray(st.uploadedRecordsCache.students) ? st.uploadedRecordsCache.students : [];
        var record = records.find(function (r) {
          try {
            if (window.NormalizeUtils && NormalizeUtils.isSameStudent) {
              return NormalizeUtils.isSameStudent(r && r.studentName, student && student.name);
            }
          } catch (e) {}
          var a = String(r && r.studentName || '').trim().toLowerCase().replace(/\s+/g, '');
          var b = String(student && student.name || '').trim().toLowerCase().replace(/\s+/g, '');
          return a === b;
        });
        if (record) {
          var counts = base.existingCounts;
          var photoCount = record.photos != null ? record.photos : (record.files && record.files.photos ? record.files.photos.length : 0) || 0;
          var videoCount = record.videos != null ? record.videos : (record.files && record.files.videos ? record.files.videos.length : 0) || 0;
          counts.photos = Math.max(counts.photos || 0, photoCount);
          counts.videos = Math.max(counts.videos || 0, videoCount);
          counts.text = Math.max(counts.text || 0, (record.comment || '').length);
          if (record && typeof record.comment === 'string') {
            if (!base.baselineComment) base.baselineComment = record.comment;
            base.syncedComment = normalizeComment(record.comment);
          }
        }
      }
    }
    return base;
  }

  function calculateStudentCompletion(index) {
    if (!(window.FLB && FLB.State)) return { percent: 0, done: false, needsVideo: true };
    var st = FLB.State.get();
    if (!st || !Array.isArray(st.students)) return { percent: 0, done: false, needsVideo: true };
    var student = st.students[index];
    if (!student) return { percent: 0, done: false, needsVideo: true };
    var base = ensureStudentFileEntry(index, student);
    var photos = getTotalCount(index, 'photos');
    var videos = getTotalCount(index, 'videos');
    var existing = base.existingCounts || {};
    var commentLen = Math.max(existing.text || 0, (base.comment || '').trim().length);
    var photoRatio = Math.min(photos, 3) / 3;
    var commentRatio = Math.min(commentLen, 20) / 20; // 建議 20 字，百分比隨字數上升
    var videoRatio = Math.min(videos, 1);
    var done = (photoRatio >= 1 && commentLen > 0); // ✅ 只要有打字就算完成
    var percentBase = Math.round(((photoRatio + commentRatio) / 2) * 100);
    var percent = percentBase;
    if (videoRatio >= 1 && percentBase >= 90) {
      percent = 100;
    }
    percent = Math.min(100, Math.max(percent, done ? 100 : percentBase));
    return { percent: percent, done: done, needsVideo: videoRatio < 1 };
  }

  function hasPendingChanges(index) {
    var base = studentFiles[index] || {};
    if (base.locked) return false;
    if ((base.photos && base.photos.length) || (base.videos && base.videos.length)) return true;
    var comment = normalizeComment(base.comment);
    var synced = getSyncedComment(base);
    if (!comment && !synced) return false;
    if (comment !== synced) return true;
    return false;
  }

  function isUploadReady(index) {
    // 🎯 部分上傳：只要有變更就可上傳
    var base = studentFiles[index] || {};
    if (base.locked) return false;
    return hasPendingChanges(index);
  }

  function cancelAutoUpload(index) {
    if (autoUploadTimers[index]) {
      clearTimeout(autoUploadTimers[index]);
      delete autoUploadTimers[index];
    }
  }

  // 🧩 計算目前使用者「變更內容」的快照（照片數與大小總和、影片數與大小總和、評語字串）
  function computeChangeSnapshot(index) {
    try {
      var base = studentFiles[index] || {};
      var photos = Array.isArray(base.photos) ? base.photos : [];
      var videos = Array.isArray(base.videos) ? base.videos : [];
      var comment = (base.comment || '').trim();
      var sizePhotos = photos.reduce(function (s, f) { return s + (f && f.size ? f.size : 0); }, 0);
      var sizeVideos = videos.reduce(function (s, f) { return s + (f && f.size ? f.size : 0); }, 0);
      return [photos.length, sizePhotos, videos.length, sizeVideos, comment].join('|');
    } catch (e) { return '0|0|0|0|'; }
  }

  function scheduleAutoUpload(index) {
    if (uploadingStudents[index]) return;
    if ((studentFiles[index] && studentFiles[index].locked)) return;
    cancelAutoUpload(index);
    // 📐 智慧延遲：僅評語變更 → 較長延遲（減少磁碟寫入）；有新檔案 → 立即一些
    var base = studentFiles[index] || {};
    var hasNewPhotos = Array.isArray(base.photos) && base.photos.length > 0;
    var hasNewVideos = Array.isArray(base.videos) && base.videos.length > 0;
    var commentChanged = hasCommentChanged(base);
    var commentOnly = (!hasNewPhotos && !hasNewVideos) && commentChanged;
    var delay = commentOnly ? 1600 : 80;
    // ⛔ 若是純評語且距離上次自動上傳未滿 1.6s，跳過排程，避免過頻
    if (commentOnly && lastAutoUploadAt[index] && (Date.now() - lastAutoUploadAt[index] < delay)) {
      return;
    }
    autoUploadTimers[index] = setTimeout(function () {
      delete autoUploadTimers[index];
      // 🧩 防抖：若與上一次提交快照相同，直接略過
      try {
        var snap = computeChangeSnapshot(index);
        if (lastSubmittedSnapshot[index] && lastSubmittedSnapshot[index] === snap) {
          return;
        }
      } catch (e) {}
      if (isUploadReady(index) && hasPendingChanges(index) && !uploadingStudents[index]) {
        try { uploadStudentRecord(index); } catch (e) { console.error('自動上傳失敗', e); }
      }
    }, delay);
  }

  function resetUploadRetryState(studentIndex) {
    if (uploadRetryCount[studentIndex]) {
      uploadRetryCount[studentIndex] = 0;
    }
    var btn = document.getElementById('upload-btn-' + studentIndex);
    if (!btn) return;
    btn.classList.remove('error');
    btn.classList.remove('uploading');
    if (!uploadingStudents[studentIndex]) {
      btn.innerHTML = '<i class="fas fa-robot"></i> 系統自動上傳';
      btn.disabled = false;
    }
  }

  function setCapsulePercentIdle(index, percent) {
    if (uploadingStudents[index]) return;
    var pctEl = document.getElementById('cap-percent-' + index);
    if (pctEl) pctEl.textContent = Math.max(0, Math.min(100, Math.round(percent))) + '%';
  }

  function updateUploadProgressDisplay(index, percent) {
    var pctEl = document.getElementById('cap-percent-' + index);
    if (pctEl) pctEl.textContent = Math.max(0, Math.min(100, Math.round(percent))) + '%';
    var btn = document.getElementById('upload-btn-' + index);
    if (btn) {
      if (percent >= 0 && percent <= 100) {
        btn.innerHTML = '<span class="loading"></span> 上傳中 ' + Math.max(0, Math.min(100, Math.round(percent))) + '%';
      }
    }
  }

  function mergeRecordCaches(prevCache, nextCache) {
    prevCache = prevCache || {};
    nextCache = nextCache || {};
    var currentCourseKey = getCourseCacheKey();
    var prevCourseKey = prevCache.__courseKey || null;
    var sameCourseAsPrev = prevCourseKey && currentCourseKey && prevCourseKey === currentCourseKey;
    var merged = {
      overview: nextCache.overview || null,
      students: [],
      path: nextCache.path || prevCache.path || '',
      meta: Object.assign({}, prevCache.meta || {}, nextCache.meta || {})
    };

    if (merged.path && (!merged.meta || !merged.meta.coursePeriod)) {
      var infoFromPath = parseFsCourseInfo(merged.path);
      if (infoFromPath) {
        merged.meta = Object.assign({}, merged.meta, {
          coursePeriod: infoFromPath.coursePeriod,
          date: infoFromPath.date,
          semester: infoFromPath.semester
        });
      }
    }

    var map = {};
    function put(rec) {
      if (!rec) return;
      var key = String(rec.studentName || '').trim();
      if (!key) return;
      if (!map[key]) {
        map[key] = {
          studentName: key,
          files: { photos: [], videos: [], videoThumbnails: {} },
          videoThumbnails: {},
          photos: 0,
          videos: 0,
          comment: '',
          path: rec.path || null,
          coursePeriod: rec.coursePeriod || '',
          date: rec.date || '',
          semester: rec.semester || '',
          // 🔥 [修復] 保留新媒體系統的照片和影片
          newMediaPhotos: [],
          newMediaVideos: []
        };
      }
      var dst = map[key];
      if (rec && (rec.authoritative === true || rec.__hasServer === true)) {
        dst.__hasServer = true;
      }
      if (rec.path) dst.path = rec.path;
      if (rec.relativePath) dst.relativePath = rec.relativePath;
      var files = rec.files || {};
      var photos = Array.isArray(files.photos) ? files.photos.slice() : [];
      var videos = Array.isArray(files.videos) ? files.videos.slice() : [];
      if (!photos.length && files.list && Array.isArray(files.list.photos)) {
        photos = files.list.photos.slice();
      } else if (!photos.length && files.fileList && Array.isArray(files.fileList.photos)) {
        photos = files.fileList.photos.slice();
      }
      if (!videos.length && files.list && Array.isArray(files.list.videos)) {
        videos = files.list.videos.slice();
      } else if (!videos.length && files.fileList && Array.isArray(files.fileList.videos)) {
        videos = files.fileList.videos.slice();
      }
      var thumbs = Object.assign({}, rec.videoThumbnails || files.videoThumbnails || {});
      
      // 🔥 [修復] 提取新媒體系統的照片和影片
      var newMediaPhotos = Array.isArray(rec.newMediaPhotos) ? rec.newMediaPhotos.slice() : [];
      var newMediaVideos = Array.isArray(rec.newMediaVideos) ? rec.newMediaVideos.slice() : [];
      
      if (rec.authoritative === true) {
        // ✅ 後端資料為權威，但若伺服器暫時回傳 0 檔（延遲一致性），避免把使用者剛上傳的縮圖清空
        var serverPhotoCount = photos.length + newMediaPhotos.length;
        var serverVideoCount = videos.length + newMediaVideos.length;
        var serverHasFiles = (serverPhotoCount + serverVideoCount) > 0;
        var serverEmpty = (serverPhotoCount + serverVideoCount) === 0 && (!rec.comment || rec.comment.length === 0);
        var hadLocal = !!(dst.localFiles && ((dst.localFiles.photos && dst.localFiles.photos.length) || (dst.localFiles.videos && dst.localFiles.videos.length)));
        var hadPrevServer = !!((dst.files && dst.files.photos && dst.files.photos.length) || (dst.files && dst.files.videos && dst.files.videos.length));
        var shouldPreserveLocalOnly = serverEmpty && hadLocal && !hadPrevServer;

        if (shouldPreserveLocalOnly) {
          // ⚠️ 跳過覆蓋：保留現有本地/前次伺服器資料，待下一輪載入再更新
          if (typeof rec.comment === 'string' && rec.comment) dst.comment = rec.comment;
        } else {
          // 🧹 安全覆蓋：清理本地暫存 URL，改用伺服器權威結果
          // 🔥 添加日志：确认清除本地暂存
          if (hadLocal && serverHasFiles) {
            console.log('🔄 [清除本地暂存] 学生:', key, '服务器端已有', serverPhotoCount, '张照片,', serverVideoCount, '支影片');
          }
          try {
            if (dst.localFiles) {
              try {
                (dst.localFiles.photos || []).forEach(function (u) { try { if (typeof u === 'string' && u.indexOf('blob:') === 0) URL.revokeObjectURL(u); } catch (e) {} });
                (dst.localFiles.videos || []).forEach(function (u) { try { if (typeof u === 'string' && u.indexOf('blob:') === 0) URL.revokeObjectURL(u); } catch (e) {} });
              } catch (e) {}
              dst.localFiles = { photos: [], videos: [] };
            }
          } catch (e) {}
          dst.files.photos = Array.from(new Set(photos));
          dst.files.videos = Array.from(new Set(videos));
          dst.files.videoThumbnails = Object.assign({}, thumbs);
          dst.videoThumbnails = Object.assign({}, thumbs);
          // 🔥 [修復] 保存新媒體系統的照片和影片
          dst.newMediaPhotos = newMediaPhotos.slice();
          dst.newMediaVideos = newMediaVideos.slice();
          console.log('✅ [mergeRecordCaches-權威] 更新媒體:', rec.studentName, {
            照片: newMediaPhotos.length,
            影片: newMediaVideos.length
          });
          dst.photos = (typeof rec.photos === 'number') ? rec.photos : (newMediaPhotos.length || dst.files.photos.length);
          dst.videos = (typeof rec.videos === 'number') ? rec.videos : (newMediaVideos.length || dst.files.videos.length);
          if (typeof rec.comment === 'string') dst.comment = rec.comment;
        }
      } else {
        // 📝 本地合併（樂觀更新）
        if (rec.comment !== undefined && rec.comment !== null && rec.comment !== '') dst.comment = rec.comment;
        
        // 🔥 新增：如果服务器端返回了文件，清除对应类型的本地暂存
        var serverHasPhotos = photos.length > 0;
        var serverHasVideos = videos.length > 0;
        if (serverHasPhotos || serverHasVideos) {
          var hadLocalFiles = !!(dst.localFiles && ((dst.localFiles.photos && dst.localFiles.photos.length) || (dst.localFiles.videos && dst.localFiles.videos.length)));
          if (hadLocalFiles) {
            console.log('🔄 [清除本地暂存-非权威] 学生:', key, '服务器端返回', photos.length, '张照片,', videos.length, '支影片');
            if (serverHasPhotos && dst.localFiles && dst.localFiles.photos) {
              try {
                dst.localFiles.photos.forEach(function (u) { 
                  try { if (typeof u === 'string' && u.indexOf('blob:') === 0) URL.revokeObjectURL(u); } catch (e) {} 
                });
                dst.localFiles.photos = [];
              } catch (e) {}
            }
            if (serverHasVideos && dst.localFiles && dst.localFiles.videos) {
              try {
                dst.localFiles.videos.forEach(function (u) { 
                  try { if (typeof u === 'string' && u.indexOf('blob:') === 0) URL.revokeObjectURL(u); } catch (e) {} 
                });
                dst.localFiles.videos = [];
              } catch (e) {}
            }
          }
        }
        
        dst.files.photos = Array.from(new Set((dst.files.photos || []).concat(photos)));
        dst.files.videos = Array.from(new Set((dst.files.videos || []).concat(videos)));
        dst.videoThumbnails = dst.videoThumbnails || {};
        Object.keys(thumbs).forEach(function (name) {
          dst.videoThumbnails[name] = thumbs[name];
        });
        dst.files.videoThumbnails = Object.assign({}, dst.videoThumbnails);
        // 🔥 [修復] 合併新媒體系統的照片和影片
        // 🔥 [重要] 非權威模式也應該合併新媒體數據（例如從 API 獲取的學生列表）
        if (Array.isArray(rec.newMediaPhotos)) {
          if (newMediaPhotos.length > 0) {
            dst.newMediaPhotos = newMediaPhotos.slice();
            console.log('📸 [mergeRecordCaches-非權威] 更新照片:', rec.studentName, newMediaPhotos.length, '張');
          }
        }
        if (Array.isArray(rec.newMediaVideos)) {
          if (newMediaVideos.length > 0) {
            dst.newMediaVideos = newMediaVideos.slice();
            console.log('🎬 [mergeRecordCaches-非權威] 更新影片:', rec.studentName, newMediaVideos.length, '個');
          }
        }
        dst.photos = Math.max(dst.photos || 0, rec.photos || newMediaPhotos.length || photos.length || dst.files.photos.length);
        dst.videos = Math.max(dst.videos || 0, rec.videos || newMediaVideos.length || videos.length || dst.files.videos.length);
        // 🔄 合併本地暫存檔（Object URL），供 UI 立即顯示
        if (rec.localFiles) {
          dst.localFiles = dst.localFiles || { photos: [], videos: [] };
          if (Array.isArray(rec.localFiles.photos)) {
            rec.localFiles.photos.forEach(function (u) {
              if (typeof u === 'string' && dst.localFiles.photos.indexOf(u) === -1) dst.localFiles.photos.push(u);
            });
          }
          if (Array.isArray(rec.localFiles.videos)) {
            rec.localFiles.videos.forEach(function (u) {
              if (typeof u === 'string' && dst.localFiles.videos.indexOf(u) === -1) dst.localFiles.videos.push(u);
            });
          }
        }
      }
      if ((!dst.coursePeriod || !dst.date) && rec.path) {
        var info = parseFsCourseInfo(rec.path, key);
        if (info) {
          dst.coursePeriod = info.coursePeriod;
          dst.date = info.date;
          dst.semester = info.semester;
        }
      }
      if ((!dst.coursePeriod || !dst.date) && rec.coursePeriod && rec.date) {
        dst.coursePeriod = rec.coursePeriod;
        dst.date = rec.date;
      }
      if (!dst.semester && rec.semester) dst.semester = rec.semester;
      if (!dst.relativePath && dst.path) dst.relativePath = extractRelativePath(dst.path);
    }

    if (sameCourseAsPrev) {
      (Array.isArray(prevCache.students) ? prevCache.students : []).forEach(put);
    }
    (Array.isArray(nextCache.students) ? nextCache.students : []).forEach(put);

    merged.students = Object.keys(map).map(function (k) { return map[k]; });

    if (nextCache && nextCache.__authoritative === true) {
      merged.students = merged.students.filter(function (entry) {
        if (entry.__hasServer) return true;
        var hasLocalPending = !!(entry.localFiles && (
          (Array.isArray(entry.localFiles.photos) && entry.localFiles.photos.length) ||
          (Array.isArray(entry.localFiles.videos) && entry.localFiles.videos.length)
        ));
        return hasLocalPending;
      });
    }

    if (!merged.meta.date && merged.students.length) {
      merged.meta.date = merged.students[0].date || merged.meta.date;
    }
    if (!merged.meta.coursePeriod && merged.students.length) {
      merged.meta.coursePeriod = merged.students[0].coursePeriod || merged.meta.coursePeriod;
    }
    if (!merged.meta.relativePath && merged.students.length) {
      var relBase = merged.students[0].relativePath;
      if (relBase) {
        var parts = relBase.split('/').slice(0, -1);
        merged.meta.relativePath = parts.join('/');
      }
    }
    merged.__courseKey = currentCourseKey;
    return merged;
  }

  function buildRecordOperationMeta(studentName) {
    var entryMeta = getRecordCacheEntry(studentName) || {};
    var cacheMeta = entryMeta.cacheMeta || ((window.FLB && FLB.State && FLB.State.get().uploadedRecordsCache && FLB.State.get().uploadedRecordsCache.meta) || {});
    var info = entryMeta.info || null;
    var startDate = currentCourse && currentCourse.start ? formatDateTWISO(new Date(currentCourse.start)) : '';
    // ✅ 依使用者需求：資料夾名稱直接使用「行事曆課程標題」完整字串，避免任何自組與時區問題
    var rawTitle = (currentCourse && currentCourse.title) ? String(currentCourse.title).trim() : '';
    var courseValue = (entryMeta.course ? entryMeta.course : (currentCourse && currentCourse.courseName) || '').trim();
    var periodValue = (entryMeta.period || '').trim();
    // ⛔ 忽略舊快取的 coursePeriod，統一使用完整課程標題
    var coursePeriodValue = rawTitle;
    var dateValue = entryMeta.date || startDate;
    
    // 🔥 特別處理：課程總覽的日期可能來自 currentCourse.date
    if (studentName === '課程總覽' && !dateValue && currentCourse) {
      dateValue = currentCourse.date || currentCourse.formattedDate || '';
    }
    
    // 🔥 修復：總是使用完整的資訊來生成 relativePath（確保包含日期和主題）
    // 先嘗試使用快取的 relativePath，但只在它包含日期時才使用
    var relativePathValue = '';
    if (entryMeta.relativePath && dateValue && entryMeta.relativePath.indexOf(dateValue) !== -1) {
      relativePathValue = entryMeta.relativePath;
    }
    
    // 如果沒有有效的 relativePath，使用完整資訊生成新的
    var topicValue = (entryMeta && entryMeta.topic) || (info && info.topic) || (cacheMeta && cacheMeta.topic) || '';
    if (shouldFallbackTopic(topicValue, coursePeriodValue)) {
      try {
        topicValue = currentCourse ? extractCourseTopicForPath(currentCourse) : '';
      } catch (e) {
        topicValue = '';
      }
    }

    var fullInfo = {
      coursePeriod: coursePeriodValue,
      date: dateValue,
      topic: topicValue,
      semester:
        (info && info.semester) ||
        (cacheMeta && cacheMeta.semester) ||
        (currentCourse && currentCourse.semester) ||
        (typeof getCurrentSemester === 'function' ? getCurrentSemester() : '')
    };
    fullInfo.semester = resolveSemesterSegment(fullInfo, cacheMeta);

    // 🔒 以最新資訊組合 canonical 路徑，避免沿用舊快取
    // 修正：先計算 semesterValue 再帶入 canonicalInfo，避免 undefined 造成資料夾缺段
    var semesterValue = fullInfo.semester;
    var canonicalInfo = {
      semester: semesterValue,
      coursePeriod: coursePeriodValue,
      date: dateValue,
      topic: topicValue
    };
    var canonicalRelativePath = composeRelativePath(canonicalInfo, studentName, cacheMeta);

    if (!relativePathValue) {
      relativePathValue = canonicalRelativePath;
    }

    // 🔍 除錯：輸出課程總覽的路徑生成
    if (studentName === '課程總覽') {
      console.log('📁 [buildRecordOperationMeta] 課程總覽路徑生成:', {
        fullInfo: fullInfo,
        canonicalInfo: canonicalInfo,
        currentCourse: currentCourse,
        relativePathValue: relativePathValue,
        canonicalRelativePath: canonicalRelativePath,
        topic: topicValue || 'no-topic'
      });
    }

    var relativePathUnified = canonicalRelativePath || rewriteRelativePathCoursePeriod(relativePathValue, coursePeriodValue);

    // 🔍 除錯：輸出最終結果（特別是課程總覽）
    if (studentName === '課程總覽') {
      console.log('📁 [buildRecordOperationMeta] 最終結果:', {
        relativePathValue: relativePathValue,
        relativePathUnified: relativePathUnified,
        coursePeriodValue: coursePeriodValue
      });
    }

    // 不再強制組合/正規化 period；保留使用者原標題以便 NAS 目錄直接對應
    periodValue = String(periodValue || '').replace(/\s+/g, '').replace(/:(?=\d{2})/g, '');
    coursePeriodValue = String(coursePeriodValue || '').trim();

    return {
      studentName: studentName,
      course: courseValue,
      period: periodValue,
      coursePeriod: coursePeriodValue,
      date: dateValue,
      // relativePath：維持「目前檔案實際所在」的相對路徑（用於刪除/讀取）
      relativePath: relativePathValue,
      // relativePathUnified：用於「新的上傳」要寫入的統一路徑（以完整標題為主）
      relativePathUnified: relativePathUnified,
      canonicalRelativePath: canonicalRelativePath,
      semester: semesterValue,
      topic: topicValue
    };
  }

  var STATUS_LABELS = { completed: '已結束', upcoming: '尚未開始', ongoing: '進行中' };
  var STATUS_ICONS = { completed: 'fa-flag-checkered', upcoming: 'fa-hourglass-half', ongoing: 'fa-play-circle' };

  function showToast(msg, type) { (global.FLB && global.FLB.UI && global.FLB.UI.toast) ? global.FLB.UI.toast(msg, type) : alert(String(msg)); }
  
  // 🔥 顯示中央載入提示（帶動畫）
  function showCenterLoading(message) {
    // 移除舊的載入提示
    hideCenterLoading();
    
    var overlay = document.createElement('div');
    overlay.id = 'centerLoadingOverlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.2s ease-out;
    `;
    
    var loadingBox = document.createElement('div');
    loadingBox.style.cssText = `
      background: white;
      padding: 32px 40px;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      min-width: 200px;
      animation: slideUp 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
    `;
    
    // Loading 動畫（旋轉圓圈）
    var spinner = document.createElement('div');
    spinner.style.cssText = `
      width: 48px;
      height: 48px;
      border: 4px solid #e5e7eb;
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    `;
    
    var text = document.createElement('div');
    text.textContent = message || '載入中...';
    text.style.cssText = `
      font-size: 16px;
      font-weight: 600;
      color: #1f2937;
    `;
    
    loadingBox.appendChild(spinner);
    loadingBox.appendChild(text);
    overlay.appendChild(loadingBox);
    
    // 添加動畫 CSS
    if (!document.getElementById('centerLoadingStyles')) {
      var style = document.createElement('style');
      style.id = 'centerLoadingStyles';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to { 
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(overlay);
    return overlay;
  }
  
  // 🔥 隱藏中央載入提示
  function hideCenterLoading() {
    var overlay = document.getElementById('centerLoadingOverlay');
    if (overlay) {
      overlay.style.animation = 'fadeOut 0.2s ease-out';
      setTimeout(function() {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 200);
    }
  }

  // 讀取當前使用者/講師
  async function loadCurrentUser() {
    try {
      var savedUser = localStorage.getItem('currentUser');
      if (savedUser) {
        currentUser = JSON.parse(savedUser);
        var resp = await fetch('/api/teacher-data');
        if (resp.ok) {
          var data = await resp.json();
          var teachers = data.teachers || [];
          currentTeacher = teachers.find(function (t) { return t.userId === currentUser.userId; }) || null;
        }
      } else {
        showToast('請先在主行事曆登入 LINE 以篩選您的課程', 'warning');
      }
    } catch (e) {
      console.warn('載入用戶資訊失敗', e);
    }
  }

  function updateCourseSummary(allCourseList, meta, filteredCount) {
    var summaryEl = document.getElementById('courseSummary');
    var metaEl = document.getElementById('courseMeta');
    var total = Array.isArray(allCourseList) ? allCourseList.length : 0;
    if (!summaryEl) return;
    if (!total) {
      summaryEl.innerHTML = '<i class="fas fa-info-circle"></i><span>目前沒有符合條件的課程</span>';
      if (metaEl) metaEl.innerHTML = '';
      return;
    }
    var completed = allCourseList.filter(function (c) { return c.status === 'completed'; }).length;
    var upcoming = allCourseList.filter(function (c) { return c.status === 'upcoming'; }).length;
    var ongoing = allCourseList.filter(function (c) { return c.status === 'ongoing'; }).length;
    summaryEl.innerHTML = '<i class="fas fa-info-circle"></i><span>共 ' + total + ' 堂課｜已結束 ' + completed + ' 堂</span>';
    if (!metaEl) return;
    var statusFilterValue = (document.getElementById('statusFilter') || {}).value || 'all';
    var statusLabel = statusFilterValue === 'all' ? '全部狀態' : (STATUS_LABELS[statusFilterValue] || statusFilterValue);
    var items = [];
    var effectiveFilteredCount = filteredCount != null ? filteredCount : total;
    items.push('<span><i class="fas fa-eye"></i> 顯示 ' + effectiveFilteredCount + ' 堂（' + statusLabel + '）</span>');
    if (meta && typeof meta.total === 'number') items.push('<span><i class="fas fa-layer-group"></i> 系統總課程 ' + meta.total + '</span>');
    if (meta && meta.highlightEventId) items.push('<span><i class="fas fa-bullseye"></i> 已鎖定焦點課程</span>');
    if (meta && meta.requestedEventId) items.push('<span><i class="fas fa-link"></i> 來源事件 ' + (global.FLB.Course.escapeHtml(meta.requestedEventId)) + '</span>');
    if (meta && meta.date) items.push('<span><i class="fas fa-calendar-day"></i> 參考日期 ' + (global.FLB.Course.escapeHtml(meta.date)) + '</span>');
    if (meta && meta.range) items.push('<span><i class="fas fa-arrows-alt-h"></i> 範圍 ' + (meta.range === 'week' ? '本週課程' : '當日課程') + '</span>');
    if (upcoming > 0) items.push('<span><i class="fas fa-hourglass-half"></i> 尚未開始 ' + upcoming + '</span>');
    if (ongoing > 0) items.push('<span><i class="fas fa-play-circle"></i> 進行中 ' + ongoing + '</span>');
    metaEl.innerHTML = items.join('');
  }

  function renderFilteredCourses() {
    var statusValue = (document.getElementById('statusFilter') || {}).value || 'all';
    var courses = Array.isArray(allCourses) ? allCourses.slice() : [];
    // 狀態篩選
    var filtered = statusValue === 'all' ? courses : courses.filter(function (c) { return c.status === statusValue; });
    // 星期篩選（若有勾選）
    try {
      if (activeWeekdays && activeWeekdays.size > 0) {
        filtered = filtered.filter(function(c){
          try {
            var d = c.start ? new Date(c.start) : null;
            if (!d) return false;
            var jsDay = d.getDay(); // 0(日) - 6(六)
            var wd = (jsDay === 0) ? 7 : jsDay; // 轉成 1~7
            return activeWeekdays.has(wd);
          } catch (e) { return true; }
        });
      }
    } catch (e) {}
    // 講師篩選
    if (activeFilters.instructor) {
      filtered = filtered.filter(function (c) { return String(c.instructor || '').trim() === activeFilters.instructor; });
    }
    // 類別篩選（以 courseName 為分類）
    if (activeFilters.courseType) {
      filtered = filtered.filter(function (c) { return String(c.courseName || '').trim() === activeFilters.courseType; });
    }
    // 學生搜尋（課程中包含該學生）
    if (activeFilters.studentQuery) {
      var q = activeFilters.studentQuery.trim();
      if (q) {
        filtered = filtered.filter(function (c) {
          return Array.isArray(c.students) && c.students.some(function (s) { return (s && s.name && s.name.indexOf(q) !== -1); });
        });
      }
    }
    return filtered.sort(function (a, b) {
      var aStart = new Date(a.start || a.dateKey || 0).getTime();
      var bStart = new Date(b.start || b.dateKey || 0).getTime();
      return aStart - bStart;
    });
  }

  function renderCourseCards(courses) {
    var courseList = document.getElementById('courseList');
    if (!courseList) return;
    if (!Array.isArray(courses) || courses.length === 0) {
      courseList.innerHTML = '<div class="course-empty-state"><i class="fas fa-calendar-times"></i><div>目前沒有符合條件的課程</div><div>嘗試調整範圍或狀態篩選</div></div>';
      return;
    }
    var currentCourseId = currentCourse && currentCourse.id;

    // ⚡ 大量資料時啟用虛擬清單
    if (courses.length > 50 && window.FLB && FLB.VirtualList) {
      courseList.style.maxHeight = '60vh';
      courseList.style.overflow = 'auto';
      var vl = FLB.VirtualList.mount(courseList, {
        itemHeight: 110,
        count: courses.length,
        renderItem: function (i) {
          var course = courses[i];
          var status = course.status || 'completed';
          var statusLabel = STATUS_LABELS[status] || status;
          var statusIcon = STATUS_ICONS[status] || 'fa-info-circle';
          var isSelected = currentCourseId && course.id === currentCourseId;
          var isHighlighted = highlightedCourseId && course.id === highlightedCourseId;
          var classes = ['course-item'];
          if (isSelected) classes.push('selected');
          if (isHighlighted) classes.push('highlighted');
          var studentsCount = Array.isArray(course.students) ? course.students.length : (function(){
            try {
              if (!Array.isArray(allStudentsGlobal) || !course.courseName) return 0;
              var target = String(course.courseName || '').toUpperCase();
              var count = allStudentsGlobal.filter(function (s) { return (String(s.course || '').toUpperCase() === target); }).length;
              return count > 0 ? ('~' + count) : 0;
            } catch(e) { return 0; }
          })();
          // 保險：整個 overview 區域捕捉 input 事件，避免任何未綁定欄位漏掉
          try {
            var ovRoot = document.getElementById('view-overview');
            if (ovRoot && !ovRoot.__autoBind) {
              ovRoot.__autoBind = true;
              ovRoot.addEventListener('input', function(){
                try { clearTimeout(overviewAutoTimer); overviewAutoTimer = setTimeout(function(){ uploadOverview({ silent:true }); }, 300); } catch (e) {}
              }, true);
            }
          } catch (e) {}
          var instructorLabel = course.instructor ? global.FLB.Course.escapeHtml(course.instructor) : '未指定講師';
          return (
            '<div class="' + classes.join(' ') + '" data-course-id="' + global.FLB.Course.escapeHtml(course.id || '') + '">' +
              '<span class="status-tag ' + global.FLB.Course.escapeHtml(status) + '"><i class="fas ' + statusIcon + '"></i>' + statusLabel + '</span>' +
              '<h3>' + global.FLB.Course.escapeHtml(course.title || course.courseName || '未命名課程') + '</h3>' +
              '<div class="date"><i class="fas fa-calendar-day"></i>' + global.FLB.Course.formatDate(course.dateKey || course.start) + '</div>' +
              '<div class="time"><i class="fas fa-clock"></i>' + global.FLB.Course.formatTimeRange(course) + '</div>' +
              '<div class="progress">' +
                '<span><i class="fas fa-user-friends"></i>' + studentsCount + ' 位學生</span>' +
                '<span><i class="fas fa-chalkboard-teacher"></i>' + instructorLabel + '</span>' +
              '</div>' +
            '</div>'
          );
        }
      });
      // 委派點擊事件
      courseList.addEventListener('click', function (e) {
        var item = e.target.closest('.course-item');
        if (!item) return;
        var courseId = item.getAttribute('data-course-id');
        var course = allCourses.find(function (c) { return String(c.id || '') === String(courseId || ''); });
        if (course) selectCourse(course, item);
      });
      return;
    }

    courseList.innerHTML = courses.map(function (course) {
      var status = course.status || 'completed';
      var statusLabel = STATUS_LABELS[status] || status;
      var statusIcon = STATUS_ICONS[status] || 'fa-info-circle';
      var isSelected = currentCourseId && course.id === currentCourseId;
      var isHighlighted = highlightedCourseId && course.id === highlightedCourseId;
      var classes = ['course-item'];
      if (isSelected) classes.push('selected');
      if (isHighlighted) classes.push('highlighted');
      var studentsCount = Array.isArray(course.students) ? course.students.length : (function(){
        try {
          if (!Array.isArray(allStudentsGlobal) || !course.courseName) return 0;
          var target = String(course.courseName || '').toUpperCase();
          var count = allStudentsGlobal.filter(function (s) { return (String(s.course || '').toUpperCase() === target); }).length;
          return count > 0 ? ('~' + count) : 0; // 近似值
        } catch(e) { return 0; }
      })();
      var instructorLabel = course.instructor ? global.FLB.Course.escapeHtml(course.instructor) : '未指定講師';
      return (
        '<div class="' + classes.join(' ') + '" data-course-id="' + global.FLB.Course.escapeHtml(course.id || '') + '">' +
          '<span class="status-tag ' + global.FLB.Course.escapeHtml(status) + '"><i class="fas ' + statusIcon + '"></i>' + statusLabel + '</span>' +
          '<h3>' + global.FLB.Course.escapeHtml(course.title || course.courseName || '未命名課程') + '</h3>' +
          '<div class="date"><i class="fas fa-calendar-day"></i>' + global.FLB.Course.formatDate(course.dateKey || course.start) + '</div>' +
          '<div class="time"><i class="fas fa-clock"></i>' + global.FLB.Course.formatTimeRange(course) + '</div>' +
          '<div class="progress">' +
            '<span><i class="fas fa-user-friends"></i>' + studentsCount + ' 位學生</span>' +
            '<span><i class="fas fa-chalkboard-teacher"></i>' + instructorLabel + '</span>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    Array.prototype.forEach.call(courseList.querySelectorAll('.course-item'), function (item) {
      var courseId = item.getAttribute('data-course-id');
      var course = allCourses.find(function (c) { return String(c.id || '') === String(courseId || ''); });
      if (!course) return;
      item.addEventListener('click', function () { selectCourse(course, item); });
    });

    // 📌 若有待滾動的課程（例如從查課程 FAB 進入），渲染完列表後捲動至該卡片
    try {
      if (window.__pendingScrollToCourseId) {
        var targetEl = courseList.querySelector('.course-item[data-course-id="' + window.__pendingScrollToCourseId + '"]');
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        window.__pendingScrollToCourseId = null;
      }
    } catch (e) {}
  }

  async function loadCompletedCourses(options) {
    try {
      // 🔥 顯示中央載入提示（更清晰）
      showCenterLoading('載入課程中...');
      var rangeValue = (document.getElementById('rangeFilter') || {}).value || 'today';
      // 🔥 使用備援解析函數（確保在 url-utils.js 未載入時也能工作）
      var target = parseUrlParams() || {};
      var targetEventId = target.eventId || null;
      var targetDate = currentFilterDateOverride || target.date || null;
      var targetTime = target.time || null;
      var targetEnd = target.end || null;
      // 若未提供 time，嘗試從 course 參數中解析 HH:MM 或 HHMM
      if (!targetTime && target && target.course) {
        try {
          var m = String(target.course).match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})|(\d{4})-(\d{4})/);
          if (m) {
            if (m[1] && m[2]) {
              targetTime = m[1];
              targetEnd = m[2];
            } else if (m[3] && m[4]) {
              targetTime = m[3].substring(0,2) + ':' + m[3].substring(2);
              targetEnd  = m[4].substring(0,2) + ':' + m[4].substring(2);
            }
          }
        } catch (e) {}
      }
      console.log('📋 [loadCompletedCourses] URL 參數:', {
        eventId: targetEventId,
        date: targetDate,
        time: targetTime,
        instructor: target.instructor
      });
      var instructor = urlInstructor || (currentTeacher && currentTeacher.name) || null;
      // ⚠️ 若帶有 eventId 或 (date+time) 快速跳轉意圖，為避免資料被講師篩選擋掉，取消 instructor 過濾
      var forceNoInstructor = !!(targetEventId || (targetDate && targetTime) || (target.date && target.course && target.autoLoad));
      var queryInstructor = forceNoInstructor ? null : instructor;

      // 若帶有快速跳轉參數，為提高命中率，初次抓取改為 week 範圍
      var preferWeek = !!(targetEventId || (targetDate && targetTime) || (target.date && target.course && target.autoLoad));
      
      // 🔒 錯誤處理：API 呼叫失敗時提供明確錯誤訊息
      var data;
      try {
        // 🔥 防禦性檢查：確保 API 客戶端已載入
        if (!global.FLB || !global.FLB.Api || typeof global.FLB.Api.getCompletedCourses !== 'function') {
          console.error('❌ [loadCompletedCourses] API 客戶端未載入:', {
            'global.FLB': !!global.FLB,
            'global.FLB.Api': !!(global.FLB && global.FLB.Api),
            'getCompletedCourses': !!(global.FLB && global.FLB.Api && global.FLB.Api.getCompletedCourses)
          });
          throw new Error('API 客戶端尚未載入完成，請稍後再試');
        }
        
        var apiParams = { 
          range: (preferWeek || rangeValue === 'week') ? 'week' : 'day', 
          date: targetDate, 
          eventId: targetEventId, 
          instructor: queryInstructor, 
          cache: 'true' 
        };
        
        console.log('📡 [loadCompletedCourses] API 參數:', apiParams);
        
        data = await global.FLB.Api.getCompletedCourses(apiParams);
        if (!data || typeof data !== 'object') {
          throw new Error('API 回應格式錯誤');
        }
        
        console.log('📊 [loadCompletedCourses] API 回應:', {
          success: data.success,
          coursesCount: data.courses ? data.courses.length : 0,
          meta: data.meta
        });
      } catch (apiError) {
        console.error('❌ [loadCompletedCourses] API 呼叫失敗:', apiError);
        throw new Error('無法載入課程資料: ' + (apiError.message || '網路錯誤'));
      }
      
      // 🔥 如果有 eventId 但找不到課程，嘗試擴大範圍重新查詢
      if (targetEventId && (!data.courses || data.courses.length === 0)) {
        console.warn('⚠️ [loadCompletedCourses] 找不到課程，嘗試擴大範圍到本週...');
        try {
          data = await global.FLB.Api.getCompletedCourses({ 
            range: 'week', 
            date: targetDate, 
            eventId: targetEventId, 
            instructor: null,  // 移除講師過濾
            cache: 'false'  // 不使用快取
          });
          console.log('📊 [loadCompletedCourses] 擴大範圍後找到:', data.courses ? data.courses.length : 0, '個課程');
        } catch (retryError) {
          console.error('❌ [loadCompletedCourses] 重試失敗:', retryError);
        }
      }
      
      var courses = data.courses || [];
      if (!Array.isArray(courses)) {
        console.warn('⚠️ [loadCompletedCourses] courses 不是陣列，使用空陣列');
        courses = [];
      }

      // 一次性載入學生資料，延後到選課時才匹配
      var studentData;
      try {
        studentData = await global.FLB.Api.getStudentData();
        if (!studentData || typeof studentData !== 'object') {
          console.warn('⚠️ [loadCompletedCourses] 學生資料格式錯誤，使用空陣列');
          studentData = { students: [] };
        }
      } catch (studentError) {
        console.error('❌ [loadCompletedCourses] 載入學生資料失敗:', studentError);
        studentData = { students: [] };
      }
      allStudentsGlobal = (studentData && studentData.students) || [];
      if (!Array.isArray(allStudentsGlobal)) {
        allStudentsGlobal = [];
      }

      allCourses = courses.map(function (course) {
        var status = global.FLB.Course.determineStatus(course.start, course.end, new Date());
        return {
          ...course,
          id: course.id || global.FLB.Id.normalizeCourseId(course),
          start: course.start ? new Date(course.start) : null,
          end: course.end ? new Date(course.end) : null,
          status: status,
          // ⚡ 延後匹配，避免頁面初載入大量計算
          students: undefined
        };
      });

      courseFiltersMeta = data.meta || {
        total: allCourses.length,
        requestedEventId: targetEventId,
        date: targetDate,
        range: (rangeValue === 'week' ? 'week' : 'day'),
        highlightEventId: targetEventId || null
      };
      highlightedCourseId = courseFiltersMeta.highlightEventId || targetEventId || null;

      // 🎯 預設以目前老師篩選（避免顯示過多課程）；若為深連結快速跳轉仍以 allCourses 進行選取
      try {
        if (!activeFilters.instructor) {
          activeFilters.instructor = urlInstructor || (currentTeacher && currentTeacher.name) || '';
        }
      } catch (e) {}

      var filtered = renderFilteredCourses();
      updateCourseSummary(allCourses, courseFiltersMeta, filtered.length);
      renderCourseCards(filtered);
      // 確保課程清單步驟顯示篩選 FAB（有時 Router 尚未準備好）
      try { if (window.__lrToggleFilterFab) window.__lrToggleFilterFab(); } catch (e) {}
      // ⚠️ 快速跳轉：若使用者正在操作篩選，則暫時不要自動選課
      var suppressed = !!(options && options.suppressAutoSelect);
      if (!suppressed) {
        try {
          // 全域保護：開啟抽屜或變更篩選後 2 秒內也抑制自動選課
          if (window.__suppressAutoSelectUntil && Date.now() < window.__suppressAutoSelectUntil) suppressed = true;
        } catch (e) {}
      }
      if (!suppressed) {
        autoSelectTargetCourse(allCourses, targetTime);
      }
      try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}

      // 載入完成後初始化高階篩選選單
      initAdvancedFilters();
      
      // 🔥 隱藏中央載入提示
      hideCenterLoading();
    } catch (e) {
      console.error('❌ [loadCompletedCourses] 載入課程失敗:', e);
      
      // 🔥 隱藏中央載入提示
      hideCenterLoading();
      
      var el = document.getElementById('courseList');
      if (el) {
        // 🔒 安全：使用 escapeHtml 防止 XSS
        var escapeHtml = (global.FLB && global.FLB.Course && global.FLB.Course.escapeHtml) || 
                         function(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); };
        var errorMsg = escapeHtml(e.message || '未知錯誤');
        el.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>載入失敗</h3><p>' + errorMsg + '</p><button class="nav-btn" onclick="refreshCourses()" style="margin-top:12px;"><i class="fas fa-sync-alt"></i> 重新載入</button></div>';
      }
      showToast('載入課程失敗: ' + (e.message || '請檢查網路連線'), 'error');
    }
  }

  function autoSelectTargetCourse(courses, fallbackTime) {
    // 向後兼容的原有邏輯
    // 🔥 使用備援解析函數（確保在 url-utils.js 未載入時也能工作）
    var target = parseUrlParams() || {};
    var eventId = target.eventId || null;
    var date = target.date || null;
    var time = target.time || fallbackTime || null;
    var course = target.course || null;     // 🔥 新增：課程名稱
    var autoLoad = target.autoLoad || null; // 🔥 新增：自動載入標記
    
    console.log('🎯 [autoSelectTargetCourse] 嘗試自動選擇:', {
      eventId: eventId,
      date: date,
      time: time,
      course: course,
      autoLoad: autoLoad,
      coursesCount: courses ? courses.length : 0,
      hasCourseManager: !!(CourseManager && CourseManager.autoSelect)
    });
    
    // ⚠️ 參數健壯化：允許僅帶 date 的情境（若該日期僅一堂課，亦自動選取）
    if (!eventId && !(date && time) && !(course && date && autoLoad)) {
      try {
        var candidates = Array.isArray(courses) ? courses.filter(function (c) {
          try { return formatDateTWISO(new Date(c.start)) === date; } catch (e) { return false; }
        }) : [];
        if (date && candidates.length === 1) {
          console.warn('⚠️ [autoSelectTargetCourse] 僅提供 date，僅一堂課，直接選取');
          selectCourse(candidates[0]);
          return;
        }
        // 🧠 進一步嘗試：若有 instructor 參數，且僅有一堂課符合講師，則選取
        var instructor = (parseUrlParams().instructor || '').trim();
        if (date && instructor && candidates.length > 1) {
          var byTeacher = candidates.filter(function (c) { return ((c.instructor || '').trim() === instructor); });
          if (byTeacher.length === 1) {
            console.warn('⚠️ [autoSelectTargetCourse] 使用 date+instructor 唯一匹配');
            selectCourse(byTeacher[0]);
            return;
          }
        }
        if (date && fallbackTime && candidates.length > 1) {
          var t = (fallbackTime + '').slice(0,5);
          var picked = candidates.find(function (c) { return (formatTimeHHMMTW(new Date(c.start))||'').slice(0,5) === t; }) || null;
          if (picked) {
            console.warn('⚠️ [autoSelectTargetCourse] 使用 date+fallbackTime 成功匹配一堂課');
            selectCourse(picked);
            return;
          }
        }
      } catch (e) {}
      console.warn('⚠️ [autoSelectTargetCourse] 缺少必要參數（eventId 或 date+time 或 course+date+autoLoad），且無可用的 date-only 唯一匹配');
      return;
    }
    
    // 🔥 暫時禁用 CourseManager（因為它返回不完整的課程物件）
    // if (CourseManager && CourseManager.autoSelect) {
    //   var selected = CourseManager.autoSelect(courses, fallbackTime);
    //   if (selected && selected.id && selected.title) {  // 確保課程物件完整
    //     console.log('✅ [autoSelectTargetCourse] CourseManager 找到課程:', selected.title);
    //     selectCourse(selected);
    //     return;
    //   } else if (selected) {
    //     console.warn('⚠️ [autoSelectTargetCourse] CourseManager 返回不完整的課程，使用原生邏輯');
    //   }
    // }

    function hhmm(d) { return formatTimeHHMMTW(d); }
    function timesClose(t1, t2, tolMin) {
      try { var a = (t1||'').split(':'); var b=(t2||'').split(':'); var m1= (+a[0])*60+(+a[1]); var m2=(+b[0])*60+(+b[1]); return Math.abs(m1-m2) <= (tolMin||10); } catch (e) { return t1===t2; }
    }

    var targetCourse = null;
    
    // 🔥 優先使用 course+date 匹配（從歷史記錄跳轉時，這個最精確）
    if (course && date && autoLoad) {
      console.log('🔍 [autoSelectTargetCourse] 嘗試使用 course+date 查找:', { course, date });
      
      // 🎯 正規化字串（移除多餘空格、統一格式）
      function normalizeStr(str) {
        if (!str) return '';
        return str.replace(/\s+/g, ' ').trim();
      }
      
      // 🎯 提取課程類型（ESM、SPM、SPIKE 等）
      function extractCourseType(str) {
        if (!str) return '';
        // 匹配課程類型：大寫字母組合（如 ESM、SPM、SPIKE）
        var match = str.match(/^([A-Z]+)/);
        return match ? match[1] : '';
      }
      
      // 🎯 提取週次
      function extractWeek(str) {
        if (!str) return '';
        var match = str.match(/第(\d+)週/);
        return match ? match[1] : '';
      }
      
      // 🎯 提取時間
      function extractTime(str) {
        if (!str) return '';
        var match = str.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})|(\d{4})-(\d{4})/);
        if (match) {
          // 處理 HH:MM-HH:MM 或 HHMM-HHMM 格式
          if (match[1] && match[2]) {
            return match[1] + '-' + match[2];
          } else if (match[3] && match[4]) {
            // 轉換 HHMM 到 HH:MM
            var start = match[3];
            var end = match[4];
            return start.substring(0, 2) + ':' + start.substring(2) + '-' + 
                   end.substring(0, 2) + ':' + end.substring(2);
          }
    }
    return '';
  }

      // 🎯 提取星期（一、二、三、四、五、六、日）
      function extractWeekday(str) {
        if (!str) return '';
        var match = str.match(/[一二三四五六日]/);
        return match ? match[0] : '';
      }
      
      var normalizedCourse = normalizeStr(course);
      // 課別：先用錨點大寫法，若取不到再用全域方法在標題內尋找
      var targetCourseType = extractCourseType(normalizedCourse) || (function(){ try { return extractCourseTypeFromTitle(normalizedCourse) || ''; } catch(e){ return ''; } })();
      var targetWeek = extractWeek(normalizedCourse);
      var targetTime = extractTime(normalizedCourse);
      var targetWeekday = extractWeekday(normalizedCourse);
      
      console.log('🔍 目標課程資訊:', {
        course: normalizedCourse,
        courseType: targetCourseType,
        week: targetWeek,
        time: targetTime,
        weekday: targetWeekday,
        date: date
      });
      
      // 🔥 先做「標題完整相等（規範化）」的快速命中（最強優先）
      (function tryExactNormalizedTitle(){
        try {
          function norm(s){
            return String(s||'')
              .replace(/[\u2013\u2014\-—–]+/g,'-')      // 各種破折/連字號統一
              .replace(/\s+/g,' ')                      // 多空白合併
              .replace(/[\u3000]/g,' ')                  // 全形空白
              .trim();
          }
          var needle = norm(normalizedCourse);
          var exact = (courses||[]).find(function(c){ return norm(c.title||'') === needle && formatDateTWISO(new Date(c.start))===date; })
                   || (Array.isArray(allCourses) ? allCourses.find(function(c){ return norm(c.title||'') === needle && formatDateTWISO(new Date(c.start))===date; }) : null);
          if (exact) {
            console.warn('⚠️ [autoSelectTargetCourse] 使用完整標題相等（最強優先）命中');
            targetCourse = exact;
            return;
          }
        } catch (e) {}
      })();

      // 🔥 記錄所有可用課程的資訊（用於除錯）
      if (courses && courses.length > 0) {
        console.log('📋 當日可用課程:', courses.slice(0, 10).map(function(c) {
          var ds = new Date(c.start);
          var titleTime = extractTime(c.title);
          var eventTime = hhmm(ds);
          return {
            title: c.title,
            date: formatDateTWISO(ds),
            courseType: extractCourseType(c.title),
            week: extractWeek(c.title),
            '標題時間': titleTime || '（無）',
            '事件時間': eventTime,
            '時間來源': titleTime ? '標題優先' : '使用事件時間',
            weekday: extractWeekday(c.title)
          };
        }));
      }
      
      if (!targetCourse) targetCourse = courses.find(function (c) {
        try {
          var ds = new Date(c.start);
          var courseDate = formatDateTWISO(ds);
          var dateMatch = courseDate === date;
          
          if (!dateMatch) return false;
          
          var normalizedTitle = normalizeStr(c.title);
          var currentCourseType = extractCourseType(normalizedTitle);
          var currentWeek = extractWeek(normalizedTitle);
          var currentTime = extractTime(normalizedTitle);
          var currentWeekday = extractWeekday(normalizedTitle);
          
          // 🔥 精確匹配：課程類型（必須）+ 週次（可選）+ 時間（可選）+ 星期（可選）
          var courseTypeMatch = targetCourseType && currentCourseType && 
                                targetCourseType === currentCourseType;
          
          if (!courseTypeMatch) return false;
          
          // 週次匹配（如果兩邊都有，必須相同）
          var weekMatch = !targetWeek || !currentWeek || targetWeek === currentWeek;
          
          // 🔥 時間匹配（優先使用標題中的時間）
          var timeMatch = true;
          if (targetTime && currentTime) {
            // 標題中有時間，使用標題時間進行精確匹配
            timeMatch = currentTime === targetTime;
          } else if (targetTime && !currentTime) {
            // 標題中沒有時間，回退使用事件的 start 時間
            var eventStartTime = hhmm(ds);
            timeMatch = eventStartTime === targetTime || timesClose(eventStartTime, targetTime, 10);
          }
          
          // 星期匹配（如果兩邊都有，必須相同）
          var weekdayMatch = !targetWeekday || !currentWeekday || targetWeekday === currentWeekday;
          
          var allMatch = courseTypeMatch && weekMatch && timeMatch && weekdayMatch;
          
          if (allMatch) {
            console.log('✅ [autoSelectTargetCourse] 精確匹配成功:', {
              title: c.title,
              courseDate: courseDate,
              matches: {
                courseType: currentCourseType + ' = ' + targetCourseType,
                week: (targetWeek && currentWeek) ? (currentWeek + ' = ' + targetWeek) : '（不檢查）',
                time: (targetTime && currentTime) ? (currentTime + ' = ' + targetTime) : (targetTime ? '（回退使用事件時間）' : '（不檢查）'),
                weekday: (targetWeekday && currentWeekday) ? (currentWeekday + ' = ' + targetWeekday) : '（不檢查）'
              }
            });
            return true;
          }
          
          return false;
        } catch (e) {
          console.error('❌ course+date 匹配失敗:', e);
          return false;
        }
      }) || null;

      if (!targetCourse && Array.isArray(allCourses)) {
        console.log('🔍 [autoSelectTargetCourse] 在 allCourses 中使用精確匹配查找...');
        targetCourse = allCourses.find(function (c) {
          try {
            var ds = new Date(c.start);
            var courseDate = formatDateTWISO(ds);
            var dateMatch = courseDate === date;
            
            if (!dateMatch) return false;
            
            var normalizedTitle = normalizeStr(c.title);
            var currentCourseType = extractCourseType(normalizedTitle);
            var currentWeek = extractWeek(normalizedTitle);
            var currentTime = extractTime(normalizedTitle);
            var currentWeekday = extractWeekday(normalizedTitle);
            
            var courseTypeMatch = targetCourseType && currentCourseType && 
                                  targetCourseType === currentCourseType;
            var weekMatch = !targetWeek || !currentWeek || targetWeek === currentWeek;
            
            // 🔥 時間匹配（優先使用標題中的時間）
            var timeMatch = true;
            if (targetTime && currentTime) {
              timeMatch = currentTime === targetTime;
            } else if (targetTime && !currentTime) {
              var eventStartTime = hhmm(ds);
              timeMatch = eventStartTime === targetTime || timesClose(eventStartTime, targetTime, 10);
            }
            
            var weekdayMatch = !targetWeekday || !currentWeekday || targetWeekday === currentWeekday;
            
            return courseTypeMatch && weekMatch && timeMatch && weekdayMatch;
          } catch (e) { return false; }
        }) || null;
      }

      // 🧠 最後一步：以打分方式挑選最可能的一堂（避免時間相同但課別不同時誤選）
      if (!targetCourse) {
        try {
          function norm(s){ return String(s||'').replace(/[\u3000\s]+/g,' ').trim(); }
          function hasKeyword(t, k){ return norm(t).indexOf(k)>=0; }
          var desired = {
            type: targetCourseType,
            week: targetWeek,
            time: targetTime,
            weekday: targetWeekday,
            instructor: (parseUrlParams().instructor||'').trim(),
            raw: normalizedCourse
          };
          var dayList = (courses||[]).filter(function(c){ try { return formatDateTWISO(new Date(c.start))===date; } catch(e){ return false; } });
          var scored = dayList.map(function(c){
            var title = norm(c.title||'');
            var ct = extractCourseType(title) || extractCourseTypeFromTitle(title) || '';
            var wk = extractWeek(title) || '';
            var tm = extractTime(title) || '';
            var wkd = extractWeekday(title) || '';
            var st = hhmm(new Date(c.start));
            var score = 0;
            if (ct && desired.type && ct===desired.type) score += 100; // 強特徵
            if (wk && desired.week && wk===desired.week) score += 30;
            if (tm && desired.time) {
              if (tm===desired.time) score += 25; else if (tm.split('-')[0]===desired.time) score += 15;
            } else if (desired.time && st===desired.time) { score += 10; }
            if (wkd && desired.weekday && wkd===desired.weekday) score += 10;
            if (desired.instructor && (String(c.instructor||'').trim()===desired.instructor)) score += 15;
            // 語義關鍵詞（到府/客製化）
            if (hasKeyword(title, '客製化') && hasKeyword(desired.raw, '客製化')) score += 8;
            if (hasKeyword(title, '到府') && hasKeyword(desired.raw, '到府')) score += 8;
            // 標題子字串相似度
            if (title.indexOf(norm(desired.raw))>=0 || norm(desired.raw).indexOf(title)>=0) score += 12;
            return { course: c, score: score, title: title, ct: ct, wk: wk, tm: tm, st: st };
          }).sort(function(a,b){ return b.score - a.score; });
          if (scored.length && scored[0].score >= 50) {
            console.warn('⚠️ [autoSelectTargetCourse] 使用打分匹配挑選：', scored[0]);
            targetCourse = scored[0].course;
          }
        } catch (e) { console.warn('⚠️ [scoreMatch] 失敗', e); }
      }

      // 🧠 進一步寬鬆比對：同日內，若只有一堂課的標題前綴符合課別（如 SPIKE/ESM/SPM），直接命中
      if (!targetCourse) {
        try {
          var sameDay = courses.filter(function (c) { try { return formatDateTWISO(new Date(c.start)) === date; } catch (e) { return false; } });
          var onlyByType = sameDay.filter(function (c) {
            var ct = extractCourseType((c.title||'').replace(/\s+/g,' ').trim());
            return !!ct && ct === targetCourseType;
          });
          if (onlyByType.length === 1) {
            console.warn('⚠️ [autoSelectTargetCourse] 使用課別前綴唯一匹配（寬鬆規則）');
            targetCourse = onlyByType[0];
          }
        } catch (e) {}
      }

      // 🧠 進一步寬鬆比對：同日內，課程標題包含目標 course 的主要片段（去除多餘空白/全形空白）
      if (!targetCourse) {
        try {
          function norm(s){ return String(s||'').replace(/[\u3000\s]+/g,' ').trim(); }
          var needle = norm(normalizedCourse);
          var cand = courses.filter(function(c){
            try { return formatDateTWISO(new Date(c.start))===date; } catch(e){ return false; }
          }).find(function(c){
            var hay = norm(c.title||'');
            return hay.indexOf(needle)>=0 || needle.indexOf(hay)>=0;
          });
          if (cand) {
            console.warn('⚠️ [autoSelectTargetCourse] 使用標題子字串匹配（寬鬆規則）');
            targetCourse = cand;
          }
        } catch(e) {}
      }
    }
    
    // 🔥 第二優先：使用 eventId 匹配
    if (!targetCourse && eventId) {
      console.log('🔍 [autoSelectTargetCourse] 使用 eventId 查找:', eventId);
      
      targetCourse = courses.find(function (c) {
        var match = false;
        
        // 嘗試多種 ID 匹配方式
        if (c.id === eventId || c.eventId === eventId || c.uid === eventId || c.evt_id === eventId) {
          match = true;
        }
        
        // 檢查 _raw 物件中的 ID
        if (!match && c._raw) {
          if (c._raw.uid === eventId || c._raw.evt_id === eventId) {
            match = true;
          }
        }
        
        // 使用 FLB.Id.matches（如果可用）
        if (!match && global.FLB && global.FLB.Id && typeof global.FLB.Id.matches === 'function') {
          try {
            match = global.FLB.Id.matches(eventId, c);
          } catch (e) {
            console.warn('⚠️ FLB.Id.matches 失敗:', e);
          }
        }
        
        if (match) {
          console.log('✅ [autoSelectTargetCourse] 找到匹配課程:', {
            id: c.id,
            title: c.title,
            matchedBy: c.id === eventId ? 'id' : 
                       c.eventId === eventId ? 'eventId' :
                       c.uid === eventId ? 'uid' :
                       c.evt_id === eventId ? 'evt_id' :
                       'FLB.Id.matches'
          });
        }
        
        return match;
      }) || null;
      
      if (!targetCourse && Array.isArray(allCourses)) {
        console.log('🔍 [autoSelectTargetCourse] 在 allCourses 中查找...');
        targetCourse = allCourses.find(function (c) {
          try { 
            return c.id === eventId || 
                   c.eventId === eventId || 
                   c.uid === eventId || 
                   c.evt_id === eventId ||
                   (c._raw && (c._raw.uid === eventId || c._raw.evt_id === eventId)) ||
                   (global.FLB && global.FLB.Id && global.FLB.Id.matches(eventId, c));
          } catch (e) { return false; }
        }) || null;
      }
    }
    
    // 🔥 第三優先：使用 date+time 匹配
    if (!targetCourse && date && time) {
      console.log('🔍 [autoSelectTargetCourse] 嘗試使用 date+time 查找:', { date, time });
      var desiredType = (function(){
        var p = parseUrlParams() || {};
        if (p.course && p.date && p.autoLoad) {
          var t = (extractCourseType((p.course||'').toString().replace(/\s+/g,' ').trim()) || extractCourseTypeFromTitle(p.course)) || '';
          return t || '';
        }
        return targetCourseType || '';
      })();
      var desiredInstructor = (parseUrlParams().instructor || '').trim();
      var desiredEnd = (parseUrlParams().end || '').trim();

      targetCourse = courses.find(function (c) {
        var ds = new Date(c.start);
        var courseDate = formatDateTWISO(ds);
        var courseTime = hhmm(ds);
        
        var dateMatch = courseDate === date;
        var timeMatch = courseTime === time || timesClose(courseTime, time, 10);
        // 若帶有結束時間（end），則亦需比對事件結束時間（若取得不到結束時間，維持舊規則）
        if (desiredEnd && c.end) {
          var endHHMM = hhmm(new Date(c.end));
          timeMatch = timeMatch && (endHHMM === desiredEnd || timesClose(endHHMM, desiredEnd, 10));
        }
        var typeMatch = true;
        if (desiredType) {
          var ct = extractCourseType((c.title||'').replace(/\s+/g,' ').trim()) || extractCourseTypeFromTitle(c.title||'');
          typeMatch = !!ct && (ct === desiredType);
        }
        var instructorMatch = true;
        if (desiredInstructor) {
          instructorMatch = ((c.instructor||'').trim() === desiredInstructor);
        }
        return dateMatch && timeMatch && typeMatch && instructorMatch;
      }) || null;
      
      if (!targetCourse && Array.isArray(allCourses)) {
        console.log('🔍 [autoSelectTargetCourse] 在 allCourses 中查找...');
        targetCourse = allCourses.find(function (c) {
          try {
            var ds = new Date(c.start);
            var d = formatDateTWISO(ds);
            var t = hhmm(ds);
            if (!(d === date && (t === time || timesClose(t, time, 10)))) return false;
            if (desiredType) {
              var ct = extractCourseType((c.title||'').replace(/\s+/g,' ').trim()) || extractCourseTypeFromTitle(c.title||'');
              if (!(ct && ct === desiredType)) return false;
            }
            if (desiredInstructor) {
              if (((c.instructor||'').trim() !== desiredInstructor)) return false;
            }
            if (desiredEnd && c.end) {
              var e = hhmm(new Date(c.end));
              if (!(e === desiredEnd || timesClose(e, desiredEnd, 10))) return false;
            }
            return true;
          } catch (e) { return false; }
        }) || null;
      }
    }
    
    // 🔥 如果找不到課程，顯示錯誤訊息
    if (!targetCourse && (eventId || (date && time) || (course && date && autoLoad))) {
      console.error('❌ [autoSelectTargetCourse] 未找到匹配課程', {
        eventId: eventId,
        date: date,
        time: time,
        coursesAvailable: courses ? courses.length : 0
      });
      
      showToast('找不到指定的課程，請確認課程是否存在於系統中', 'error');
      
      // 顯示可用課程列表（除錯用）
      if (courses && courses.length > 0) {
        console.log('📋 [autoSelectTargetCourse] 可用課程:', courses.map(function(c) {
          return {
            id: c.id,
            title: c.title,
            date: c.date || (c.start ? new Date(c.start).toISOString().split('T')[0] : ''),
            time: c.start ? formatTimeHHMMTW(new Date(c.start)) : ''
          };
        }));
      }
      return;  // 不創建虛擬課程，直接返回
    }
    
    if (targetCourse) {
      console.log('🎯 [autoSelectTargetCourse] 找到目標課程:', {
        id: targetCourse.id,
        title: targetCourse.title,
        date: targetCourse.date,
        start: targetCourse.start,
        isVirtual: targetCourse.isVirtual
      });
      
      var sel = '.course-item[data-course-id="' + targetCourse.id + '"]';
      var targetEl = document.querySelector(sel);
      if (targetEl) {
        // ✅ 一般清單情況：直接觸發點擊
        targetEl.click();
        setTimeout(function () {
          try { targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
          showToast('已自動定位到課程：' + (targetCourse.title || ''), 'success');
        }, 150);
      } else {
        // 🔁 虛擬清單或尚未渲染目標節點：直接呼叫 selectCourse，避免快跳失效
        try {
          selectCourse(targetCourse, null);
          showToast('已自動定位到課程：' + (targetCourse.title || ''), 'success');
        } catch (e) { 
          console.error('❌ selectCourse 失敗:', e);
        }
      }
      // 二次驗證：若選到的課程與目標不相符，稍後再用 week 範圍強化一次
      try {
        setTimeout(async function(){
          if (!(window.FLB && FLB.State)) return;
          var st = FLB.State.get();
          var selCourse = st && st.selectedCourse;
          var ok = false;
          if (eventId && selCourse) {
            try { ok = FLB.Id.matches(eventId, selCourse); } catch (e) { ok = false; }
          } else if (date && time && selCourse) {
            try {
              var ds = new Date(selCourse.start); var d=formatDateTWISO(ds); var t=hhmm(ds);
              ok = (d===date && (t===time || timesClose(t,time,10)));
            } catch (e) { ok = false; }
          }
          if (!ok) {
            try {
              var retry = await FLB.Api.getCompletedCourses({ range: 'week', date: date, eventId: eventId, instructor: null });
              var list = retry && retry.courses || [];
              var hit = null;
              if (eventId) hit = list.find(function(c){ try { return FLB.Id.matches(eventId, c); } catch(e){ return false; } });
              if (!hit && date && time) {
                hit = list.find(function(c){ var ds2=new Date(c.start); var d2=formatDateTWISO(ds2); var t2=hhmm(ds2); return (d2===date && (t2===time || timesClose(t2,time,10))); });
              }
              if (hit) {
                selectCourse(Object.assign({}, hit, { id: hit.id || FLB.Id.normalizeCourseId(hit), start: new Date(hit.start), end: new Date(hit.end) }), null);
              }
            } catch (e) {}
          }
        }, 400);
      } catch (e) {}
    } else {
      // 🔁 兜底：若當日沒找到，擴大到一週內搜尋且忽略講師過濾
      (async function(){
        try {
          var data = await global.FLB.Api.getCompletedCourses({ range: 'week', date: date, eventId: eventId, instructor: null });
          var courses2 = data.courses || [];
          var hit = null;
          if (eventId) {
            hit = courses2.find(function(c){ try { return global.FLB.Id.matches(eventId, c); } catch(e){ return false; } }) || null;
          }
          if (!hit && date && time) {
            hit = courses2.find(function(c){ var ds=new Date(c.start); var d=formatDateTWISO(ds); var t=hhmm(ds); return (d===date && (t===time || timesClose(t,time,10))); }) || null;
          }
          if (hit) {
            // 以這筆課程覆寫列表，直接選課
            allCourses = courses2.map(function (course) {
              var status = global.FLB.Course.determineStatus(course.start, course.end, new Date());
              return Object.assign({}, course, { id: course.id || global.FLB.Id.normalizeCourseId(course), start: new Date(course.start), end: new Date(course.end), status: status, students: undefined });
            });
            var filtered = renderFilteredCourses();
            renderCourseCards(filtered);
            updateCourseSummary(allCourses, data.meta || {}, filtered.length);
            // 直接選定
            selectCourse(hit, document.querySelector('.course-item[data-course-id="' + (hit.id || global.FLB.Id.normalizeCourseId(hit)) + '"]'));
          }
        } catch (e) {}
      })();
    }
  }

  function deriveCoursePeriodString(course) {
    if (!course) return '';
    var raw = course.coursePeriod || '';
    if (raw && String(raw).trim().length > 0) {
      return String(raw).trim();
    }
    var start = course.start;
    var end = course.end;
    if (!start || !end) return '';
    var startDate = (start instanceof Date) ? start : new Date(start);
    var endDate = (end instanceof Date) ? end : new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return '';
    }
    var weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    var pad = function (num) { return String(num).padStart(2, '0'); };
    var weekday = weekdays[startDate.getDay()];
    return weekday + ' ' + pad(startDate.getHours()) + pad(startDate.getMinutes()) + '-' + pad(endDate.getHours()) + pad(endDate.getMinutes());
  }

  function normalizeTimeToken(token) {
    if (!token) return '';
    var str = String(token);
    if (str.indexOf(':') >= 0) {
      return str.length === 4 ? str : str;
    }
    if (str.length === 4) {
      return str.slice(0, 2) + ':' + str.slice(2);
    }
    if (str.length === 3) {
      return str.charAt(0) + str.slice(1).padStart(3, '0').replace(/(\d{2})(\d{2})/, '$1:$2');
    }
    return str;
  }

  function buildMatchingTimeString(parsed, fallbackPeriod) {
    if (parsed && parsed.weekday && (parsed.startTime || parsed.endTime)) {
      var weekday = parsed.weekday;
      var startToken = normalizeTimeToken(parsed.startTime);
      var endToken = normalizeTimeToken(parsed.endTime);
      if (weekday && startToken && endToken) {
        return weekday + ' ' + startToken + '-' + endToken;
      }
    }
    if (parsed && parsed.period) {
      var period = parsed.period;
      if (parsed.location) {
        var locIdx = period.indexOf(parsed.location);
        if (locIdx > -1) {
          period = period.slice(0, locIdx).trim();
        }
      }
      return period.trim();
    }
    return fallbackPeriod || '';
  }

  function deriveCourseDateISO(course) {
    if (!course) return '';
    try {
      var formatter = (typeof formatDateTWISO === 'function') ? formatDateTWISO : null;
      if (course.start) {
        var startDate = (course.start instanceof Date) ? course.start : new Date(course.start);
        if (!isNaN(startDate.getTime())) {
          return formatter ? formatter(startDate) : startDate.toISOString().slice(0, 10);
        }
      }
      if (course.date) {
        if (formatter) {
          return formatter(new Date(course.date));
        }
        return String(course.date).slice(0, 10);
      }
    } catch (e) {}
    return '';
  }

  async function selectCourse(course, element) {
    // ⚠️ 檢查課程物件是否有效
    if (!course) {
      console.error('❌ selectCourse: 課程物件為空');
      showToast('無法選擇課程：課程資料不存在', 'error');
      return;
    }
    
    // 📝 記錄課程資料（除錯用）
    console.log('📝 選擇課程:', {
      id: course.id,
      title: course.title,
      start: course.start,
      end: course.end,
      date: course.date,
      formattedDate: course.formattedDate
    });
    
    // 🔄 若切換到不同課程，允許下一次 overview hydrate 強制覆寫預設值
    try {
      var incomingCourseKey = getCourseCacheKey(course);
      var activeCourseKey = getCourseCacheKey(currentCourse || {});
      if (!activeCourseKey || incomingCourseKey !== activeCourseKey) {
        console.log('🔄 [selectCourse] 切換到新課程，重置回填狀態');
        lastOverviewHydratedKey = null;
        
        // 🔥 [修復 2025-11-19] 清空課程總覽表單，確保新課程資料能正確回填
        var overviewFieldIds = ['ov_type','ov_date','ov_names','ov_count','ov_teacher','ov_topic','ov_perf','ov_issue','ov_solution'];
        overviewFieldIds.forEach(function(id) {
          var el = document.getElementById(id);
          if (el) {
            el.value = '';
            if (el.dataset) {
              delete el.dataset.userEdited;
              delete el.dataset.lastHydratedValue;
              delete el.dataset.fromSummary;
            }
          }
        });
        console.log('✅ [selectCourse] 課程總覽表單已清空');
      }
    } catch (e) {
      console.error('❌ [selectCourse] 重置回填狀態失敗:', e);
    }
    
    // 🔥 第一步：先隱藏上一堂課的學生和課程總覽內容（避免殘留顯示）
    try {
      console.log('🔒 [selectCourse] 隱藏上一堂課的內容...');
      
      // 隱藏學生卡片容器
      var studentsGrid = document.getElementById('studentsGrid');
      if (studentsGrid) {
        var studentCard = studentsGrid.closest('.glass-card');
        if (studentCard) {
          studentCard.style.display = 'none';
          console.log('✅ [selectCourse] 已隱藏上一堂課的學生卡片');
        }
      }
      
      // ✅ 移除手動隱藏，讓 Router 控制顯示/隱藏
      // 切換課程時，Router 會根據當前 step 自動處理顯示/隱藏
      
      // 隱藏學生導覽列
      var tabs = document.getElementById('topTabs');
      if (tabs) { 
        tabs.innerHTML = ''; 
        tabs.classList.remove('is-sticky'); 
        tabs.scrollLeft = 0;
        tabs.style.display = 'none';
      }
      var bottomTabs = document.getElementById('bottomTabs');
      if (bottomTabs) {
        bottomTabs.innerHTML = '';
        bottomTabs.style.display = 'none';
      }
      try { document.body.classList.remove('with-sticky-tabs'); } catch (e) {}
    } catch (e) {
      console.error('❌ [selectCourse] 隱藏上一堂課內容失敗:', e);
    }
    
    // 🔗 整合 Blob URL 管理器
    if (BlobURL && BlobURL.cleanup) {
      try {
        BlobURL.cleanup();
      } catch (e) {
        console.warn('⚠️ Blob URL 清理失敗:', e);
      }
    }
    
    // 🧹 清理所有預覽容器中的 Blob URL 和 DOM 元素（修復課程切換時的快取問題）
    try {
      console.log('🧹 開始清理上一堂課的所有資料...');
      try { preserveActiveUploadNodes(); } catch (e) {}
      try { preserveOverviewPreviewNodes(); } catch (e) {}
      
      // 1. 清理所有 Blob URL（兼容舊邏輯）
      var allBlobNodes = document.querySelectorAll('[data-object-url]');
      var blobUrlCount = 0;
      Array.prototype.slice.call(allBlobNodes).forEach(function(node) {
        var url = node.getAttribute('data-object-url');
        if (url && url.indexOf('blob:') === 0) {
          try { 
            URL.revokeObjectURL(url); 
            blobUrlCount++;
          } catch (e) {}
        }
      });
      if (blobUrlCount > 0) {
        console.log('🧹 已釋放', blobUrlCount, '個 Blob URL');
      }
      
      // 2. 清空學生預覽容器
      var studentsGrid = document.getElementById('studentsGrid');
      if (studentsGrid) {
        studentsGrid.innerHTML = '';
      }
      
      // 3. 清空課程總覽預覽容器（新上傳的預覽）→ 僅在確定切換到新課程時清空
      var overviewPreviews = document.getElementById('overviewPhotosPreviews');
      if (overviewPreviews) {
        try {
          var nextCourseKey = getCourseCacheKey(course || currentCourse || {});
          var activeKey = getCourseCacheKey(currentCourse || {});
          if (nextCourseKey && activeKey && nextCourseKey !== activeKey) {
            overviewPreviews.innerHTML = '';
          } else {
            // 同課程僅切換視圖：保留使用者的預覽
            console.log('💾 [Overview] 同課程視圖切換，保留預覽節點');
          }
        } catch (_) {}
      }
      
      // 3.5. 🔥 清空課程總覽已上傳區域（伺服器已存在的檔案）
      var overviewExisting = document.getElementById('overviewExistingPreviews');
      if (overviewExisting) {
        try {
          var nextCourseKey2 = getCourseCacheKey(course || currentCourse || {});
          var activeKey2 = getCourseCacheKey(currentCourse || {});
          if (nextCourseKey2 && activeKey2 && nextCourseKey2 !== activeKey2) {
            Array.prototype.slice.call(overviewExisting.querySelectorAll('[data-object-url]')).forEach(function(node) {
              var url = node.getAttribute('data-object-url');
              if (url && url.indexOf('blob:') === 0) {
                try { URL.revokeObjectURL(url); } catch (e) {}
              }
            });
            overviewExisting.innerHTML = '';
            try { delete overviewExisting.dataset.renderSource; } catch (e) {}
            console.log('✅ 已清空課程總覽已上傳區域（切換到新課程）');
          } else {
            console.log('💾 [Overview] 同課程視圖切換，保留已上傳區域');
          }
        } catch (_) {}
      }
      
      // 4. 重置課程總覽輸入（徹底清除 files 屬性）
      var overviewInput = document.getElementById('overviewPhotosInput');
      if (overviewInput) {
        try { 
          overviewInput.value = '';
          // 🔥 使用 DataTransfer 徹底清空 files 屬性
          if (typeof DataTransfer !== 'undefined') {
            try {
              overviewInput.files = new DataTransfer().files;
            } catch (e) {
              // 某些瀏覽器不支援直接設定 files，使用替代方案
              var newInput = overviewInput.cloneNode(true);
              if (overviewInput.parentNode) {
                overviewInput.parentNode.replaceChild(newInput, overviewInput);
                // 重新綁定事件（因為已經在 setupDragAndDrop 中綁定過）
              }
            }
          }
        } catch (e) {
          console.error('❌ 重置課程總覽輸入失敗:', e);
        }
      }
      
      // 5. 清空課程總覽欄位（不觸發自動上傳）
      // 🔥 2025-11-08 修復：禁用自動上傳，等待 Drive 數據加載完成後再回填
      ['ov_type', 'ov_date', 'ov_names', 'ov_count', 'ov_teacher', 'ov_topic', 'ov_perf', 'ov_issue', 'ov_solution'].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) {
          try { 
            el.value = '';
            if (el.dataset) {
              delete el.dataset.userEdited;
              delete el.dataset.lastHydratedValue;
              delete el.dataset.fromSummary;
            }
            // ❌ 不觸發 input 事件，避免自動上傳空白數據
          } catch (e) {}
        }
      });
      try {
        lastTextSnapshot = computeOverviewTextSnapshot();
        lastOverviewSnapshot = computeOverviewSnapshot();
      } catch (e) {}
      
      // ❌ 移除自動上傳邏輯，改為等待 Drive 數據加載後回填
      // 數據加載流程會在後面的 loadUploadedRecordsForCurrentCourse() 中處理
      hasRenderedUploadedRecords = false;
      try {
        var nextCourseKey = getCourseCacheKey(course || currentCourse || {});
        var driveStateForCourse = getCourseDriveStatus(nextCourseKey).state;
        // 顯示時機放寬：首次載入或狀態未知時，也應立即顯示覆蓋層
        if (driveStateForCourse !== 'missing') {
          setRecordsLoadingState(true, {
            message: '正在同步「' + (course.title || course.courseName || '課程') + '」的資料…',
            subMessage: '首次載入會花費數秒，請耐心等候'
          });
        } else {
          setRecordsLoadingState(false);
        }
      } catch (e) {
        setRecordsLoadingState(false);
      }
      
      // 6. 清除待處理的 Blob URL 撤銷
      if (pendingOverlayRevokes && pendingOverlayRevokes.size > 0) {
        pendingOverlayRevokes.forEach(function(url) {
          try { URL.revokeObjectURL(url); } catch (e) {}
        });
        pendingOverlayRevokes.clear();
      }
      
      // 7. 清除所有影片海報快取
      try {
        if (videoPosterCache) {
          Object.keys(videoPosterCache).forEach(function(key) {
            var url = videoPosterCache[key];
            if (url && url.indexOf('blob:') === 0) {
              try { URL.revokeObjectURL(url); } catch (e) {}
            }
          });
          videoPosterCache = {};
          window.__videoPosterCache = {};
        }
      } catch (e) {}
      
      // 8. 清除影片縮圖就緒快取
      try {
        if (videoThumbnailReadyCache) {
          videoThumbnailReadyCache = {};
          window.__videoThumbnailReadyCache = {};
        }
      } catch (e) {}
      
      console.log('✅ 已完成所有預覽內容清理');
    } catch (cleanupError) {
      console.error('❌ 清理預覽內容時發生錯誤:', cleanupError);
    }
    
    // 🔥 延遲多次強制清空課程總覽預覽（確保徹底清除）
    try {
      // 第一次：立即清空
      var overviewInputImmediate = document.getElementById('overviewPhotosInput');
      var overviewPreviewsImmediate = document.getElementById('overviewPhotosPreviews');
      if (overviewInputImmediate) {
        try {
          overviewInputImmediate.value = '';
          if (typeof DataTransfer !== 'undefined') {
            overviewInputImmediate.files = new DataTransfer().files;
          }
        } catch (e) {}
      }
      if (overviewPreviewsImmediate) {
        overviewPreviewsImmediate.innerHTML = '';
      }
      
      // 第二次：延遲 100ms 再清一次（防止事件觸發導致恢復）
      setTimeout(function() {
        try {
          var overviewInput2 = document.getElementById('overviewPhotosInput');
          var overviewPreviews2 = document.getElementById('overviewPhotosPreviews');
          if (overviewInput2) {
            overviewInput2.value = '';
            if (typeof DataTransfer !== 'undefined') {
              try {
                overviewInput2.files = new DataTransfer().files;
              } catch (e) {}
            }
          }
          if (overviewPreviews2) {
            overviewPreviews2.innerHTML = '';
          }
          
          // ✅ 移除強制顯示，讓 Router 控制顯示/隱藏
          console.log('✅ [清理階段2] 已強制清空課程總覽預覽');
        } catch (innerE) {
          console.error('❌ [清理階段2] 強制清空課程總覽預覽失敗:', innerE);
        }
      }, 100);
      
      // 第三次：延遲 300ms 最後確認（防止滾動或視圖切換時恢復）
      setTimeout(function() {
        try {
          var overviewInput3 = document.getElementById('overviewPhotosInput');
          var overviewPreviews3 = document.getElementById('overviewPhotosPreviews');
          if (overviewInput3 && typeof handleOverviewPhotosSelect === 'function') {
            handleOverviewPhotosSelect({ target: overviewInput3 });
          }
          if (overviewPreviews3 && overviewPreviews3.children.length > 0) {
            console.warn('⚠️ [清理階段3] 課程總覽預覽容器仍有內容，強制清空');
            overviewPreviews3.innerHTML = '';
          }
          
          // ✅ 移除強制顯示，讓 Router 控制顯示/隱藏
          console.log('✅ [清理階段3] 最終確認課程總覽已清空');
        } catch (innerE) {
          console.error('❌ [清理階段3] 最終確認失敗:', innerE);
        }
      }, 300);
    } catch (e) {
      console.error('❌ 設置課程總覽清空計時器失敗:', e);
    }
    
    // 🔁 清除自動上傳計時器與暫存狀態，避免舊課程資料影響新課程
    try {
      Object.keys(autoUploadTimers).forEach(function(k){ clearTimeout(autoUploadTimers[k]); });
    } catch (e) {}
    autoUploadTimers = {};
    lastSubmittedSnapshot = {};
    lastAutoUploadAt = {};
    uploadingStudents = {};
    uploadRetryCount = {}; // 🧹 重置上傳重試計數
    // ⚠️ 不重置 activeUploads 計數，避免切換課程期間的背景上傳被誤判為已結束
    // activeUploadsByStudent 與 activeUploadsTotal 會由上傳生命週期自動增減
    
    // 🧹 清除所有快取和索引
    resetServerMediaIndex();
    clearAllServerMediaCache(); // 🔥 新增：清除所有伺服器媒體快取
    clearThumbReadyCache();
    resetPosterErrorRegistry();
    try { PosterQueue.clear(); } catch (e) {} // 🧹 清空影片縮圖生成佇列
    if (overviewScheduleTimer) { try { clearTimeout(overviewScheduleTimer); } catch (e) {} overviewScheduleTimer = null; }
    if (overviewAutoTimer) { try { clearTimeout(overviewAutoTimer); } catch (e) {} overviewAutoTimer = null; }
    lastOverviewSnapshot = '';
    markUploadedCacheDirty('course-switch-finalize', true);
    if (window.FLB && FLB.State && typeof FLB.State.set === 'function') {
      try { FLB.State.set({ drafts: {}, uploadedRecordsCache: {}, currentStudentIndex: 0, progress: { percent: 0, completed: 0, total: 0 } }); } catch (e) {}
    }
    // 🔗 重設網址至站內格式（移除深連結參數）
    try { window.history.replaceState({}, document.title, location.pathname); } catch (e) {}
    currentCourse = course;
    
    // 🔗 確保課程有正確的日期格式（修復 400 錯誤）
    // 優先順序：1. course.start 2. course.date/formattedDate 3. URL 參數 4. deepLinkInfo
    if (currentCourse && currentCourse.start) {
      try {
        var startDate = new Date(currentCourse.start);
        if (!isNaN(startDate.getTime())) {
          var year = startDate.getFullYear();
          var month = String(startDate.getMonth() + 1).padStart(2, '0');
          var day = String(startDate.getDate()).padStart(2, '0');
          currentCourse.date = year + '-' + month + '-' + day;
          currentCourse.formattedDate = currentCourse.date;
          console.log('✅ [日期] 從 start 解析:', currentCourse.date);
        } else {
          console.error('❌ 無效的課程開始時間:', currentCourse.start);
        }
      } catch (e) {
        console.error('❌ 日期格式化失敗:', e);
      }
    }
    
    // 如果沒有 start 但有 date/formattedDate，確保兩者一致
    if (currentCourse && !currentCourse.date && (currentCourse.date || currentCourse.formattedDate)) {
      if (!currentCourse.date && currentCourse.formattedDate) {
        currentCourse.date = currentCourse.formattedDate;
      }
      if (!currentCourse.formattedDate && currentCourse.date) {
        currentCourse.formattedDate = currentCourse.date;
      }
      console.log('✅ [日期] 使用現有日期資訊:', currentCourse.date || currentCourse.formattedDate);
    }
    
    // 🔥 備援：從 URL 參數或 deepLinkInfo 獲取日期
    if (currentCourse && !currentCourse.date && !currentCourse.formattedDate) {
      try {
        // 嘗試從 deepLinkInfo 獲取
        var dlInfo = window.__deepLinkInfo || initialDeepLinkParams || null;
        if (dlInfo && dlInfo.date) {
          currentCourse.date = dlInfo.date;
          currentCourse.formattedDate = dlInfo.date;
          console.log('✅ [日期] 從 URL 參數獲取:', currentCourse.date);
        } else {
          // 最後備援：直接解析 URL
          var urlParams = parseUrlParams();
          if (urlParams && urlParams.date) {
            currentCourse.date = urlParams.date;
            currentCourse.formattedDate = urlParams.date;
            console.log('✅ [日期] 從 URL 直接解析:', currentCourse.date);
          }
        }
      } catch (e) {
        console.error('❌ 從 URL 參數獲取日期失敗:', e);
      }
    }
    
    // 最終檢查：如果還是沒有日期，警告用戶
    if (currentCourse && !currentCourse.date && !currentCourse.formattedDate) {
      console.error('❌ 課程缺少日期資訊:', {
        id: currentCourse?.id,
        title: currentCourse?.title,
        start: currentCourse?.start,
        date: currentCourse?.date,
        formattedDate: currentCourse?.formattedDate,
        urlParams: parseUrlParams(),
        deepLinkInfo: window.__deepLinkInfo
      });
      showToast('課程缺少日期資訊，可能無法正常上傳', 'warning');
    } else {
      console.log('✅ [日期] 最終確認:', {
        date: currentCourse.date,
        formattedDate: currentCourse.formattedDate
      });
    }
    
    // 🔥 [修復 2025-11-18] 必须先设置 currentCourse，否则后续所有函数都无法访问课程数据
    currentCourse = course;
    
    // 从 State 恢复 studentFiles（如果有的话）
    // 注意：这里不会覆盖 currentCourse，只是尝试恢复其他状态
    studentFiles = {};
    
    try { window.__deepLinkInfo = buildDeepLinkParams(course); } catch (e) {}
    try {
      var titleEl = document.getElementById('overviewCourseTitle');
      if (titleEl) titleEl.textContent = course.title || course.courseName || '未命名課程';
    } catch (e) {}
    
    // 🔗 同步到狀態管理器
    if (typeof syncStateToManager === 'function') {
      try {
        syncStateToManager();
      } catch (e) {
        console.warn('⚠️ 狀態同步失敗:', e);
      }
    }
    Array.prototype.forEach.call(document.querySelectorAll('.course-item'), function (it) { it.classList.remove('selected'); });
    if (element) element.classList.add('selected');
    var sec = document.getElementById('studentsSection');
    if (sec) sec.classList.add('active');
    
    // ⚡ 首次點選時才進行學生匹配
    if (typeof course.students === 'undefined') {
      try {
        // 🔥 使用與行事曆完全相同的邏輯
        // 1. 載入本地學生資料
        if ((!allStudentsGlobal || allStudentsGlobal.length === 0) && global.FLB && global.FLB.Api && typeof global.FLB.Api.getStudentData === 'function') {
          var sd = await global.FLB.Api.getStudentData();
          allStudentsGlobal = (sd && sd.students) || [];
          console.log('✅ 已載入本地學生資料:', allStudentsGlobal.length, '位');
        }

        // 2. 使用 CourseTitleParser 解析課程標題（與行事曆相同）
        var title = course.title || course.courseName || '';
        var parsed = (global.FLB && global.FLB.CourseTitleParser && typeof global.FLB.CourseTitleParser.parse === 'function')
          ? global.FLB.CourseTitleParser.parse(title)
          : { course: title.split(/\s+/)[0] || '', period: '' };
        var courseName = parsed.course || parsed.courseName || course.courseName || '';
        if (!courseName && window.CourseStudentMatcher && typeof window.CourseStudentMatcher.extractCourseName === 'function') {
          try {
            courseName = window.CourseStudentMatcher.extractCourseName(title || course.coursePeriod || '');
          } catch (extractErr) {
            console.warn('⚠️ [學習歷程] extractCourseName 失敗，繼續使用原始課程名稱:', extractErr);
          }
        }
        var fallbackPeriod = deriveCoursePeriodString(course);
        var timeStr = buildMatchingTimeString(parsed, fallbackPeriod);
        courseName = (courseName || '').trim();
        timeStr = (timeStr || '').trim();
        if (!parsed.period && fallbackPeriod) {
          console.log('ℹ️ [學習歷程] 使用 fallback 課程時段:', fallbackPeriod);
        }
        if (!courseName || !timeStr) {
          console.warn('⚠️ [學習歷程] 課程名稱或時段為空，可能導致無法篩選學生:', {
            courseName: courseName,
            timeStr: timeStr,
            fallbackPeriod: fallbackPeriod,
            title: title
          });
        }

        console.log('🔍 [學習歷程] 開始取得學生名單...', {
          '原始標題': title,
          '解析結果': parsed,
          'courseName': courseName,
          'timeStr': timeStr
        });

        var courseDateISO = deriveCourseDateISO(course);

        // 3. 使用 student-filter.js 的封裝函數進行匹配（與 perfect-calendar 相同路徑與邏輯）
        if ((typeof filterStudentsWithConfig === 'function' || typeof filterStudentsByCourseAndTime === 'function') && allStudentsGlobal && allStudentsGlobal.length > 0) {
          var matched;
          if (typeof filterStudentsWithConfig === 'function') {
            matched = await filterStudentsWithConfig(
              allStudentsGlobal,
              courseName,
              timeStr,
              { 
                courseDate: courseDateISO || course.date || course.start || null,
                eventMeta: {
                  title: title,
                  start: course.start || null,
                  end: course.end || null,
                  location: course.location || (course.meta && course.meta.location) || '',
                  description: course.description || '',
                  normalizedTimeString: timeStr
                }
              }
            );
          } else {
            // 後備：舊函式（保留一致的 options）
            var cfgFallback = (global.__STUDENT_FILTER_CONFIG) || (global.FLB && FLB.State && FLB.State.get && FLB.State.get().studentFilterConfig) || {};
            matched = await filterStudentsByCourseAndTime(
              allStudentsGlobal,
              courseName,
              timeStr,
              {
                debugMode: !!cfgFallback.debugMode,
                minRemainingClasses: Number(cfgFallback.minRemainingClasses) || 0,
                enableRemainingCheck: (cfgFallback.enableRemainingCheck !== false),
                showInCurrentWeek: (cfgFallback.showInCurrentWeek !== false),
                courseDate: courseDateISO || course.date || course.start || null,
                eventMeta: {
                  title: title,
                  start: course.start || null,
                  end: course.end || null,
                  location: course.location || (course.meta && course.meta.location) || '',
                  description: course.description || '',
                  normalizedTimeString: timeStr
                }
              }
            );
          }
          // 🔥 保留完整學生物件（包含 name, remaining 等屬性）
          course.students = matched;
          augmentCourseAttendance(course);
          
          console.log('✅ [本地資料匹配] 取得學生:', course.students.length, '位', course.students.map(function(s) { return s.name; }));
        } else {
          console.warn('⚠️ filterStudentsByCourseAndTime 不可用或學生資料為空');
          course.students = [];
        }
      } catch (e) {
        console.error('❌ 學生匹配失敗:', e);
        course.students = [];
      }
    }

    augmentCourseAttendance(course);
    
    // 視圖切換：若有學生則進入 student，否則 overview
    if (Array.isArray(course.students) && course.students.length > 0) {
      try {
        // 初始化全域狀態與路由
        if (window.FLB && FLB.State && FLB.Router) {
          FLB.State.set({ selectedCourse: course, students: course.students, currentStudentIndex: 0 });
          FLB.Router.navigate({ step: 'student', studentIndex: 0 });
          renderStudentPager(course, 0);
          setupBottomTabs();
          // 小型膠囊進度已取代大型浮動進度，此處不再啟用浮動進度
          var bt = document.getElementById('bottomTabs');
          if (bt) bt.style.display = 'none';
          try { refreshProgress(); } catch (e) {}
          try { requestCourseReload({ force: true, showLoader: true }); } catch (e) {}
        }
        
        // 🔥 顯示學生卡片容器
        var studentsGrid2 = document.getElementById('studentsGrid');
        if (studentsGrid2) {
          var studentCard2 = studentsGrid2.closest('.glass-card');
          if (studentCard2) {
            studentCard2.style.display = 'block';
            console.log('✅ [selectCourse] 已顯示新課程的學生卡片');
          }
        }
        
        // ✅ 移除強制顯示，讓 Router 的 applyRoute 來控制顯示/隱藏
        // 如果當前在 overview 模式，Router 會自動顯示；如果在 student 模式，會自動隱藏
      } catch (err) {
        console.error('❌ 視圖切換失敗:', err);
      }
    } else {
      // 🔥 無學生課程：強制隱藏所有學生相關 UI
      console.log('⚠️ 此課程無學生名單，清理學生 UI 並顯示課程總覽模式');
      
      try {
        // 隱藏學生導覽列
        var topTabs = document.getElementById('topTabs');
        if (topTabs) {
          topTabs.innerHTML = '';
          topTabs.style.display = 'none';
        }
        
        // 隱藏底部標籤
        var bottomTabs = document.getElementById('bottomTabs');
        if (bottomTabs) {
          bottomTabs.innerHTML = '';
          bottomTabs.style.display = 'none';
        }
        
        // 🔥 隱藏學生卡片容器（無學生時）
        var studentsGrid = document.getElementById('studentsGrid');
        if (studentsGrid) {
          studentsGrid.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><h3>此課程沒有學生資料</h3><p>請使用「課程總覽」上傳</p></div>';
          // 隱藏整個學生卡片容器
          var studentCard = studentsGrid.closest('.glass-card');
          if (studentCard) {
            studentCard.style.display = 'none';
            console.log('✅ [selectCourse] 已隱藏學生卡片容器（無學生課程）');
          }
        }
        
        // 隱藏學生模式切換按鈕（如果需要）
        var modeSwitchBar = document.getElementById('modeSwitchBar');
        if (modeSwitchBar) {
          modeSwitchBar.style.display = 'none';
        }
        
        // ✅ 無學生課程：導航到課程總覽模式，讓 Router 控制顯示
        // 更新狀態並導航到課程總覽（Router 會自動處理顯示）
        if (window.FLB && FLB.State) {
          FLB.State.set({ selectedCourse: course, students: [], currentStudentIndex: 0 });
        }
        if (window.FLB && FLB.Router) {
          FLB.Router.navigate({ step: 'overview' });
        }
        
        // 聚焦到課程總覽區（延遲執行，等待 Router 切換完成）
        setTimeout(function() {
          var overviewSection = document.querySelector('.overview-section');
          if (overviewSection) {
            overviewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100);
        
        showToast('此課程無學生名單，請使用「課程總覽」上傳。', 'info');
      } catch (hideErr) {
        console.error('❌ 隱藏學生 UI 失敗:', hideErr);
      }
    }

    // 若仍需一次性渲染整批卡片，可保留：
    // loadStudentCards(course);
    
    // 若有學生，顯示學生模式切換按鈕
    if (course.students && course.students.length > 0) {
      console.log('✅ 已載入', course.students.length, '位學生:', course.students);
      try {
        var modeSwitchBar = document.getElementById('modeSwitchBar');
        if (modeSwitchBar) {
          modeSwitchBar.style.display = 'block';
        }
      } catch (e) {}
    }
    
    // ✅ 清除課程總覽的載入標記，確保切換課程時重新載入
    var overviewView = document.getElementById('view-overview');
    if (overviewView) {
      delete overviewView.dataset.loaded;
    }
    
    // 載入已上傳記錄列表（使用快取，僅首次補齊）
    try { 
      loadUploadedRecordsForCurrentCourse({ force: false });
      
      // ✅ 移除強制顯示，讓 Router 控制
      // 確保課程總覽的預覽正確渲染（延遲執行，等待 loadUploadedRecordsForCurrentCourse 完成）
      setTimeout(function() {
        try {
          // 等待 loadUploadedRecords 完成（line 5553）
          if (currentCourse && typeof window.LearningOverviewRenderer !== 'undefined') {
            window.LearningOverviewRenderer.render(currentCourse, { skipExisting: true, force: false });
            console.log('✅ [selectCourse] 課程總覽已重新渲染');
          }
          // ✅ 移除再次強制顯示，讓 Router 控制顯示/隱藏
        } catch (e) {
          console.warn('⚠️ [selectCourse] 觸發課程總覽重新渲染失敗:', e);
        }
      }, 800); // 增加延遲到 800ms，確保 loadUploadedRecords 完成
    } catch (e) {}
    sec && sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ========= 上傳節點保護：避免滑動時被清掉 =========
  function getShadowHost() {
    var host = document.getElementById('uploadShadowHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'uploadShadowHost';
      host.style.display = 'none';
      document.body.appendChild(host);
    }
    return host;
  }
  
  function getShadowBuffersForActiveCourse() {
    if (!global.uploadShadowBuffers) global.uploadShadowBuffers = {};
    var key = getCourseCacheKey(currentCourse || {});
    if (!global.uploadShadowBuffers[key]) global.uploadShadowBuffers[key] = {};
    return global.uploadShadowBuffers[key];
  }
  
  function preserveActiveUploadNodes() {
    try {
      var host = getShadowHost();
      if (!host) return;
      var buffers = getShadowBuffersForActiveCourse();
      var containers = document.querySelectorAll('.file-previews[id^="photos-preview-"], .file-previews[id^="videos-preview-"]');
      
      console.log('🔍 [preserveActiveUploadNodes] 找到容器:', containers.length);
      
      containers.forEach(function(container) {
        var allNodes = container.querySelectorAll('.file-preview');
        var preserveNodes = Array.prototype.filter.call(allNodes, shouldPreservePreviewNode);
        
        console.log('📊 [preserveActiveUploadNodes] 容器:', container.id, {
          總節點數: allNodes.length,
          需保存數: preserveNodes.length,
          節點詳情: preserveNodes.map(n => ({
            className: n.className,
            'data-synced': n.getAttribute('data-synced'),
            'data-awaiting-sync': n.getAttribute('data-awaiting-sync'),
            'data-media-id': n.getAttribute('data-media-id'),
            'data-temp-id': n.getAttribute('data-temp-id')
          }))
        });
        
        if (!preserveNodes.length) return;
        var match = container.id.match(/(photos|videos)-preview-(\d+)/);
        if (!match) return;
        var type = match[1] === 'videos' ? 'videos' : 'photos';
        var studentIndex = match[2];
        buffers[studentIndex] = buffers[studentIndex] || { photos: [], videos: [] };
        var bucket = buffers[studentIndex][type] = buffers[studentIndex][type] || [];
        bucket.length = 0;
        preserveNodes.forEach(function(node) {
          try {
            host.appendChild(node);
            bucket.push(node);
            console.log('✅ [preserveActiveUploadNodes] 已保存節點到 shadow DOM');
          } catch (e) {
            console.error('❌ [preserveActiveUploadNodes] 保存節點失敗:', e);
          }
        });
      });
    } catch (e) {
      console.error('❌ [preserveActiveUploadNodes] 總體失敗:', e);
    }
  }
  
  function reattachShadowNodesFor(index) {
    try {
      var k = String(index);
      var buffers = getShadowBuffersForActiveCourse();
      var buf = buffers && buffers[k];
      
      console.log('🔄 [reattachShadowNodesFor] 學生:', index, {
        有緩衝區: !!buf,
        照片節點數: buf && buf.photos ? buf.photos.length : 0,
        影片節點數: buf && buf.videos ? buf.videos.length : 0
      });
      
      if (!buf) return;
      var photos = document.getElementById('photos-preview-' + index);
      var videos = document.getElementById('videos-preview-' + index);
      
      var restoredCount = 0;
      if (photos && Array.isArray(buf.photos)) {
        buf.photos.forEach(function (n) { 
          try { 
            photos.appendChild(n); 
            restoredCount++;
            console.log('✅ [reattachShadowNodesFor] 還原照片節點');
          } catch (e) {
            console.error('❌ [reattachShadowNodesFor] 還原照片節點失敗:', e);
          } 
        });
      }
      if (videos && Array.isArray(buf.videos)) {
        buf.videos.forEach(function (n) { 
          try { 
            videos.appendChild(n); 
            restoredCount++;
            console.log('✅ [reattachShadowNodesFor] 還原影片節點');
          } catch (e) {
            console.error('❌ [reattachShadowNodesFor] 還原影片節點失敗:', e);
          } 
        });
      }
      
      console.log('📊 [reattachShadowNodesFor] 完成還原:', restoredCount, '個節點');
      
      buf.photos = [];
      buf.videos = [];
      try { updateDropZones(index); appendAddMoreButton(index, 'photos'); appendAddMoreButton(index, 'videos'); } catch (e) {}
    } catch (e) {
      console.error('❌ [reattachShadowNodesFor] 總體失敗:', e);
    }
  }

  // ==================== 學生列表渲染（一次載入全部） ====================
  function renderStudentPager(course, index) {
    var grid = document.getElementById('studentsGrid');
    if (!grid) return;
    // 🔥 [修復 2025-11-16] 在重新渲染前先保存所有上傳節點
    console.log('📦 [renderStudentPager] 開始保存上傳節點');
    try { preserveActiveUploadNodes(); } catch (e) {
      console.error('❌ [renderStudentPager] 保存節點失敗:', e);
    }
    var students = (course && course.students) || [];
    if (!students.length) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><h3>此課程沒有學生資料</h3><p>請先在系統中設定學生名單</p></div>';
      return;
    }
    index = Math.max(0, Math.min(students.length - 1, index || 0));
    var prevIndex = index > 0 ? index - 1 : null;
    var nextIndex = index < students.length - 1 ? index + 1 : null;

    function buildStudentCard(student, idx) {
      return (
        '<div class="student-card" id="student-' + idx + '">' +
          '<div class="lr-capsule" style="display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px;background:#f7fafc;border-radius:12px;padding:6px 10px">' +
            '<div class="capsule-stats" style="display:flex;gap:10px">' +
              '<span id="cap-photo-' + idx + '"><i class="fas fa-camera"></i> <span class="v">0</span>/3</span>' +
              '<span id="cap-video-' + idx + '"><i class="fas fa-video"></i> 影片<span class="optional-tag">（選）</span> <span class="v">0</span></span>' +
              '<span id="cap-text-' + idx + '"><i class="fas fa-comment"></i> <span class="v">0</span>/20</span>' +
            '</div>' +
            '<div class="capsule-progress" style="flex:1;margin-left:8px;display:flex;align-items:center;gap:8px">' +
              '<div class="bar" id="cap-bar-' + idx + '" style="flex:1;height:6px;border-radius:3px;background:#e2e8f0;overflow:hidden"><div class="fill" style="width:0%;height:100%;background:#10b981"></div></div>' +
              '<div class="percent" id="cap-percent-' + idx + '" style="min-width:42px;text-align:right;font-size:12px;color:#0f766e;font-weight:600">0%</div>' +
            '</div>' +
          '</div>' +
          '<div class="student-header">' +
            '<div class="student-name">' + (student.name || '') + '</div>' +
            '<div class="student-remaining">剩餘 ' + (student.remaining || 0) + ' 堂</div>' +
          '</div>' +
          '<div class="attendance-status" id="attendance-status-' + idx + '"></div>' +
          '<div class="progress-indicators">' +
            '<div class="indicator" id="photo-indicator-' + idx + '"><div class="icon"><i class="fas fa-camera"></i></div><div class="text"><span id="photo-count-' + idx + '">0</span>/3 照片</div></div>' +
            '<div class="indicator" id="video-indicator-' + idx + '"><div class="icon"><i class="fas fa-video"></i></div><div class="text">影片<span class="optional-tag">（選）</span> <span id="video-count-' + idx + '">0</span> 支</div></div>' +
            '<div class="indicator" id="comment-indicator-' + idx + '"><div class="icon"><i class="fas fa-comment"></i></div><div class="text"><span id="comment-count-' + idx + '">0</span>/20 字</div></div>' +
          '</div>' +
          '<div class="upload-area">' +
            '<label class="upload-label">📸 課程照片（需要 3 張）</label>' +
            '<div class="file-drop-zone" data-student="' + idx + '" data-type="photos"><i class="fas fa-images"></i><div class="text">點擊或拖放照片（需要 3 張）</div></div>' +
            '<input type="file" id="photos-' + idx + '" class="file-input" accept="image/*" multiple data-student="' + idx + '" data-type="photos">' +
            '<div class="file-previews" id="photos-preview-' + idx + '"></div>' +
          '</div>' +
          '<div class="upload-area">' +
            '<label class="upload-label">🎬 課程影片</label>' +
            '<div class="file-drop-zone" data-student="' + idx + '" data-type="videos"><i class="fas fa-video"></i><div class="text">點擊或拖放影片</div></div>' +
            '<input type="file" id="videos-' + idx + '" class="file-input" accept="video/*" multiple data-student="' + idx + '" data-type="videos">' +
            '<div class="file-previews" id="videos-preview-' + idx + '"></div>' +
          '</div>' +
          '<div class="upload-area">' +
            '<label class="upload-label">💬 課程評語（建議至少 20 字）</label>' +
            '<textarea class="comment-area" id="comment-' + idx + '" placeholder="請為 ' + (student.name || '') + ' 撰寫課程評語（建議 20 字以上），描述學習表現、進步情況等..." data-student="' + idx + '"></textarea>' +
            '<div class="char-count"><span id="comment-chars-' + idx + '">0</span> / 20 字</div>' +
            '<div class="comment-save-progress" id="comment-progress-' + idx + '">' +
              '<div class="comment-progress-bar"><div class="comment-progress-fill" id="comment-progress-fill-' + idx + '"></div></div>' +
              '<div class="comment-progress-text" id="comment-progress-text-' + idx + '"></div>' +
            '</div>' +
          '</div>' +
          '<button class="upload-btn auto-mode" id="upload-btn-' + idx + '" onclick="uploadStudentRecord(' + idx + ')" disabled><i class="fas fa-robot"></i> 系統自動上傳</button>' +
        '</div>'
      );
    }

    function buildSlide(idx, role) {
      if (idx === null || typeof idx !== 'number' || !students[idx]) {
        return '<div class="student-slide placeholder" data-role="' + role + '"></div>';
      }
      return '<div class="student-slide" data-role="' + role + '" data-index="' + idx + '">' + buildStudentCard(students[idx], idx) + '</div>';
    }

    var trackHtml = '<div class="student-slide-viewport">' +
      '<div class="student-slide-track">' +
      buildSlide(prevIndex, 'prev') +
      buildSlide(index, 'current') +
      buildSlide(nextIndex, 'next') +
      '</div>' +
      '</div>';
    grid.innerHTML = trackHtml;
    var viewport = grid.querySelector('.student-slide-viewport');
    var track = viewport ? viewport.querySelector('.student-slide-track') : null;
    if (!track) return;
    track.style.willChange = 'transform';

    var indexesToSetup = [prevIndex, index, nextIndex].filter(function (idx) { return typeof idx === 'number' && students[idx]; });
    indexesToSetup.forEach(function (idx) {
      ensureStudentFileEntry(idx, students[idx]);
      setupStudentCard(idx, students[idx]);
    });
    
    // 🔥 [修復 2025-11-16] 還原所有學生的上傳中節點，不只是當前可見的
    // 避免切換學生時丟失其他學生的上傳狀態
    try { reattachAllShadowBuffers(); } catch (e) {}

    function hydrateSlides() {
      var pending = [];
      var seen = {};
      var scheduled = false;

      function enqueue(idx, delay) {
        if (typeof idx !== 'number' || !students[idx]) return;
        if (seen[idx]) return;
        seen[idx] = true;
        var push = function () {
          pending.push(idx);
          schedule(process);
        };
        if (delay && delay > 0) {
          setTimeout(push, delay);
        } else {
          push();
        }
      }

      enqueue(index, 0);
      enqueue(prevIndex, 140);
      enqueue(nextIndex, 240);

      function process(deadline) {
        scheduled = false;
        if (!pending.length) return;
        var start = Date.now();
        while (pending.length) {
          var idx = pending.shift();
          if (typeof idx === 'number' && students[idx]) {
            var uploaded = null;
            try {
              if (window.FLB && FLB.State) {
                var cache = FLB.State.get().uploadedRecordsCache || {};
                var arr = Array.isArray(cache.students) ? cache.students : [];
                
                // 🔍 調試：輸出快取中的學生名稱列表
                console.log('🔍 [學生回填] 查找學生記錄:', {
                  '目標學生': students[idx] && students[idx].name,
                  '快取中學生數量': arr.length,
                  '快取中學生名稱列表': arr.map(r => r.studentName || r.name || '無名稱')
                });
                
                uploaded = arr.find(function (r) {
                  try { 
                    if (window.NormalizeUtils && NormalizeUtils.isSameStudent) {
                      var matched = NormalizeUtils.isSameStudent(r && r.studentName, students[idx] && students[idx].name);
                      if (matched) {
                        console.log('✅ [學生回填] NormalizeUtils 匹配成功:', r.studentName, '==', students[idx].name);
                      }
                      return matched;
                    }
                  } catch (e) {}
                  var a = String(r && r.studentName || r.name || '').trim().toLowerCase().replace(/\s+/g, '');
                  var b = String(students[idx] && students[idx].name || '').trim().toLowerCase().replace(/\s+/g, '');
                  var matched = a === b;
                  if (matched) {
                    console.log('✅ [學生回填] 字串匹配成功:', a, '==', b);
                  }
                  return matched;
                }) || null;
                
                if (uploaded) {
                  console.log('✅ [學生回填] 找到學生記錄:', {
                    studentName: uploaded.studentName,
                    photos: uploaded.photos,
                    videos: uploaded.videos,
                    hasFiles: !!uploaded.files
                  });
                } else {
                  console.warn('⚠️ [學生回填] 未找到學生記錄:', students[idx] && students[idx].name);
                  resetStudentLocalState(idx, students[idx]);
                }
              }
            } catch (e) {
              console.error('❌ [學生回填] 查找失敗:', e);
            }
            if (uploaded) {
              try { 
                console.log('🔄 [學生回填] 應用記錄到卡片:', idx, students[idx].name);
                applyExistingRecordToCard(idx, students[idx], uploaded); 
              } catch (e) {
                console.error('❌ [學生回填] 應用記錄失敗:', e);
              }
            } else {
              console.log('📥 [學生回填] 未找到記錄，嘗試從伺服器獲取:', idx, students[idx].name);
              try { fetchStudentFsRecord(idx, students[idx]); } catch (e) {
                console.error('❌ [學生回填] 從伺服器獲取失敗:', e);
              }
            }
            restoreDraftForStudent(idx);
          }
          if (deadline && typeof deadline.timeRemaining === 'function') {
            if (deadline.timeRemaining() < 6) break;
          } else if ((Date.now() - start) > 12) {
            break;
          }
        }

        if (pending.length) {
          schedule(process);
        }
      }

      function schedule(fn) {
        if (scheduled) return;
        scheduled = true;
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(fn, { timeout: 120 });
        } else {
          setTimeout(fn, 120);
        }
      }

      schedule(process);
    }

    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(hydrateSlides);
    } else {
      setTimeout(hydrateSlides, 0);
    }

    window.FLBStudentPagerHydrate = hydrateSlides;

    setupTopTabsStickyObserver();

    var baseWidth = (viewport && viewport.clientWidth) || grid.clientWidth || window.innerWidth || 1;
    var isAnimating = false;

    function computeWidth() {
      baseWidth = (viewport && viewport.clientWidth) || grid.clientWidth || window.innerWidth || baseWidth || 1;
      return baseWidth;
    }

    function offsetFor(kind, width) {
      if (kind === 'prev') return 0;
      if (kind === 'next') return -2 * width;
      return -width;
    }

    function applyOffset(px) {
      track.style.transform = 'translate3d(' + px + 'px, 0, 0)';
    }

    function immediateTo(kind) {
      var width = computeWidth();
      var offset = offsetFor(kind, width);
      isAnimating = false;
      track.style.transition = 'none';
      applyOffset(offset);
    }

    function animateTo(kind, callback) {
      var width = computeWidth();
      var offset = offsetFor(kind, width);
      isAnimating = true;
      track.style.transition = 'transform 0.25s ease';
      applyOffset(offset);
      var settled = false;
      var done = function () {
        if (settled) return;
        settled = true;
        track.removeEventListener('transitionend', done);
        if (typeof callback === 'function') callback();
      };
      track.addEventListener('transitionend', done);
      setTimeout(done, 280);
    }

    function resetPosition(animated) {
      if (animated) {
        animateTo('current');
      } else {
        immediateTo('current');
      }
    }

    resetPosition(false);

    if (window.__lrStudentPagerResizeHandler) {
      window.removeEventListener('resize', window.__lrStudentPagerResizeHandler);
    }
    window.__lrStudentPagerResizeHandler = function () {
      if (!track || !track.isConnected) return;
      resetPosition(false);
    };
    window.addEventListener('resize', window.__lrStudentPagerResizeHandler);

    if (currentSwipeDetach) currentSwipeDetach();
    var swipeTarget = viewport || grid;
    currentSwipeDetach = FLB.UI.Swipe.attach(swipeTarget, {
      thresholdRatio: 0.2,
      onMove: function (deltaX) {
        if (isAnimating) return;
        var width = computeWidth();
        var adjusted = deltaX;
        if (index <= 0 && deltaX > 0) adjusted = deltaX / 4;
        if (index >= students.length - 1 && deltaX < 0) adjusted = deltaX / 4;
        track.style.transition = 'none';
        applyOffset(offsetFor('current', width) + adjusted);
      },
      onCancel: function () {
        if (!isAnimating) resetPosition(true);
      },
      onMoveEnd: function () {
        if (!isAnimating) resetPosition(true);
      },
      onNext: function () {
        if (index >= students.length - 1) { resetPosition(true); return; }
        animateTo('next', function () { goStudent(+1); });
      },
      onPrev: function () {
        if (index <= 0) { resetPosition(true); return; }
        animateTo('prev', function () { goStudent(-1); });
      }
    });

    window.FLBStudentPager = {
      index: index,
      goNextAnimated: function (after) {
        if (isAnimating) { if (typeof after === 'function') after(); return false; }
        if (index >= students.length - 1) {
          resetPosition(true);
          if (typeof after === 'function') after();
          return false;
        }
        animateTo('next', function () {
          goStudent(+1);
          if (typeof after === 'function') {
            setTimeout(after, 20);
          }
        });
        return true;
      },
      goPrevAnimated: function (after) {
        if (isAnimating) { if (typeof after === 'function') after(); return false; }
        if (index <= 0) {
          resetPosition(true);
          if (typeof after === 'function') after();
          return false;
        }
        animateTo('prev', function () {
          goStudent(-1);
          if (typeof after === 'function') {
            setTimeout(after, 20);
          }
        });
        return true;
      },
      refresh: function () {
        resetPosition(true);
      }
    };

    try { renderDesktopStudentList(); } catch (e) {}
    highlightCurrentStudentCard(index);
  }

  // 🔥 [修復 2025-11-16] 追蹤每個學生的 fetchStudentFsRecord 重試次數
  var studentFetchRetryCount = {};
  
  function fetchStudentFsRecord(index, student) {
    var courseKey = null;
    try { courseKey = getCourseCacheKey(currentCourse || {}); } catch (e) {}
    if (courseKey && tryApplyStudentRecordFromState(courseKey, index, student)) {
      return Promise.resolve();
    }
    if (courseKey) {
      var cachedEntry = StudentHistoryCache.get(courseKey, student && student.name);
      if (cachedEntry && cachedEntry.data) {
        handleStudentHistoryResponse(courseKey, index, student, cachedEntry.data, { source: 'cache' });
        return Promise.resolve();
      }
    }
    
    // 🔥 [修復 2025-11-16] 檢查重試次數，避免無限循環
    var studentKey = courseKey + '|' + (student && student.name || '');
    studentFetchRetryCount[studentKey] = (studentFetchRetryCount[studentKey] || 0) + 1;
    
    // 如果已經重試超過 3 次，停止重試
    if (studentFetchRetryCount[studentKey] > 3) {
      console.warn('⚠️ [fetchStudentFsRecord] 停止重試:', student && student.name, '（已重試', studentFetchRetryCount[studentKey] - 1, '次）');
      return Promise.resolve();
    }
    
    return studentHistoryFetchQueue.enqueue(function () {
      return executeStudentFsRecord(index, student);
    });
  }

  async function executeStudentFsRecord(index, student) {
    // 🛡️ [修復 2025-11-18] 防御性检查：确保 currentCourse 存在
    if (!currentCourse) {
      console.warn('⚠️ [executeStudentFsRecord] currentCourse 为 null，略过查询');
      return;
    }
    
    var courseKey = getCourseCacheKey(currentCourse || {});
    if (getCourseDriveStatus(courseKey).state === 'missing') {
      console.log('ℹ️ [學生回填] Drive 目錄不存在，略過查詢:', student && student.name);
      return;
    }
    try {
      // 🔥 2025-11-08: 改用 Drive API
      if (!currentCourse.start) {
        console.warn('⚠️ [executeStudentFsRecord] currentCourse.start 不存在，略过查询');
        return;
      }
      var startDate = new Date(currentCourse.start);
      var dateStr = formatDateTWISO(startDate);
      
      // 使用 getHistory 查詢該學生的記錄（限定在當前課程）
      var courseSegment = '';
      if (currentCourse) {
        courseSegment = currentCourse.title || currentCourse.coursePeriod || currentCourse.courseName || '';
        courseSegment = sanitizeDriveSegment(courseSegment);
      }
      var semester = (currentCourse && currentCourse.semester) || (currentCourse && currentCourse.semesterCode) || '';
      if (!semester) {
        var cacheMeta = (window.FLB && FLB.State && FLB.State.get().uploadedRecordsCache && FLB.State.get().uploadedRecordsCache.meta) || {};
        semester = cacheMeta.semester || getCurrentSemester();
      }
      var historyParams = {
        date: dateStr,
        studentName: student.name
      };
      if (semester) historyParams.semester = semester;
      if (courseSegment) historyParams.courseName = courseSegment;
      
      var historyResult = await global.FLB.Api.getHistory(historyParams);
      
      // 轉換格式
      var r = null;
      if (historyResult && historyResult.records && historyResult.records.length > 0) {
        var recordRaw = null;
        var normalizedTarget = normalizeToken(student && student.name || '');
        
        // 🔥 [修復 2025-11-16] 嚴格匹配學生名稱，找不到時返回 found: false
        for (var h = 0; h < historyResult.records.length; h++) {
          var candidate = historyResult.records[h];
          var candidateName = normalizeToken(candidate && (candidate.studentName || candidate.name) || '');
          if (candidateName && candidateName === normalizedTarget) {
            recordRaw = candidate;
            console.log('✅ [fetchStudentFsRecord] 找到匹配記錄:', student.name, '=', candidate.studentName);
            break;
          }
        }
        
        // 🔴 [修復 2025-11-16] 如果找不到匹配的記錄，返回 found: false
        // 不要使用第一個記錄，否則會將其他學生的資料錯誤顯示在當前學生卡片上
        if (!recordRaw) {
          console.warn('⚠️ [fetchStudentFsRecord] 找不到學生記錄:', student.name, '(API 返回了', historyResult.records.length, '筆其他學生的記錄)');
          r = { success: true, found: false };
        } else {
          r = {
            success: true,
            found: true,
            studentName: recordRaw.studentName,
            photos: recordRaw.photoCount || 0,
            videos: recordRaw.videoCount || 0,
            comment: (recordRaw.comment || ''),
            files: {
              photos: Array.isArray(recordRaw.photos) ? recordRaw.photos.slice() : [],
              videos: Array.isArray(recordRaw.videos) ? recordRaw.videos.slice() : [],
              videoThumbnails: Object.assign({}, recordRaw.videoThumbnails || (recordRaw.files && recordRaw.files.videoThumbnails) || {})
            },
            path: recordRaw.recordPath,
            relativePath: recordRaw.relativePath,
            semester: recordRaw.semester,
            videoThumbnails: Object.assign({}, recordRaw.videoThumbnails || (recordRaw.files && recordRaw.files.videoThumbnails) || {}),
            newMediaVideos: Array.isArray(recordRaw.newMediaVideos) ? recordRaw.newMediaVideos.slice() : [],
            newMediaPhotos: Array.isArray(recordRaw.newMediaPhotos) ? recordRaw.newMediaPhotos.slice() : []
          };
        }
      } else {
        r = { success: true, found: false };
      }
      StudentHistoryCache.set(courseKey, student && student.name, r);
      handleStudentHistoryResponse(courseKey, index, student, r, { source: 'network' });
    } catch (e) {
      var message = (e && e.message) ? String(e.message) : '';
      var code = (e && (e.code || e.status || e.errorCode)) || null;
      var isTimeout = /408|timeout|超時/i.test(message) || code === 408;
      var isNotFound = /404|not\s*found|不存在/i.test(message) || code === 404;
      console.warn('lookup-student 失敗', e);
      if (isNotFound) {
        noteDriveFetchIssue(courseKey, 'notFound', {
          studentName: student && student.name,
          code: code,
          message: message
        });
        resetStudentLocalState(index, student);
      }
      if (isTimeout) {
        var stats = noteDriveFetchIssue(courseKey, 'timeout', {
          studentName: student && student.name,
          code: code,
          message: message
        }) || { timeouts: 1 };
        var timeoutLabel = stats.timeouts > 1 ? '（累計 ' + stats.timeouts + ' 次逾時）' : '';
        console.warn('⚠️ [Drive] 學生記錄查詢逾時 ' + timeoutLabel + ':', student && student.name, message);
        setCourseDriveStatus(courseKey, 'missing', {
          reason: 'timeout',
          retries: stats.timeouts || 1,
          student: student && student.name,
          lastMessage: message
        });
        requestCourseReload({ retryMissing: true, showLoader: false, delay: DRIVE_MISSING_RETRY_INTERVAL });
      }
      throw e;
    }
  }

  function handleStudentHistoryResponse(courseKey, index, student, result, options) {
    if (!result) return;
    var sourceLabel = (options && options.source) || 'network';
    if (result.success && result.found) {
      if (!(window.FLB && FLB.State)) return;
      var st = FLB.State.get();
      var cache = Object.assign({}, st.uploadedRecordsCache || {});
      var list = Array.isArray(cache.students) ? cache.students.slice() : [];
      var existingIndex = list.findIndex(function (x) {
        try { if (window.NormalizeUtils && NormalizeUtils.isSameStudent) return NormalizeUtils.isSameStudent(x && x.studentName, student && student.name); } catch (e) {}
        var a = String(x && x.studentName || '').trim().toLowerCase().replace(/\s+/g, '');
        var b = String(student && student.name || '').trim().toLowerCase().replace(/\s+/g, '');
        return a === b;
      });
      var studentRecord = {
        studentName: result.studentName,
        photos: result.photos,
        videos: result.videos,
        comment: result.comment,
        files: result.files,
        path: result.path,
        relativePath: result.relativePath,
        semester: result.semester,
        videoThumbnails: result.videoThumbnails || (result.files && result.files.videoThumbnails) || {},
        newMediaVideos: result.newMediaVideos || [],
        newMediaPhotos: result.newMediaPhotos || []
      };
      var info = parseFsCourseInfo(result.path, result.studentName);
      if (info) {
        studentRecord.coursePeriod = info.coursePeriod;
        studentRecord.date = info.date;
        studentRecord.semester = info.semester;
      }
      if (existingIndex >= 0) list[existingIndex] = studentRecord; else list.push(studentRecord);
      cache.students = list;
      FLB.State.set({ uploadedRecordsCache: cache });
      clearDriveFetchStats(courseKey, 'timeout');
      clearDriveFetchStats(courseKey, 'notFound');
      setCourseDriveStatus(courseKey, 'ready', {
        source: 'fetchStudentFsRecord:' + sourceLabel,
        student: student && student.name
      });
      try { applyExistingRecordToCard(index, student, studentRecord); } catch (e) {}
      if (!batchFsFetchMode) {
        try { renderDrawerFromState(); } catch (e) {}
        try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}
        try { if (typeof renderBottomTabs === 'function') renderBottomTabs(); } catch (e) {}
      }
      return;
    }
    if (result.success && !result.found) {
      console.log('ℹ️ [學生回填] 伺服器未找到記錄，重置狀態:', student && student.name, '(source:', sourceLabel + ')');
      noteDriveFetchIssue(courseKey, 'notFound', {
        studentName: student && student.name,
        context: 'history-miss'
      });
      try {
        if (window.FLB && FLB.State) {
          var stMiss = FLB.State.get();
          var cacheMiss = Object.assign({}, stMiss.uploadedRecordsCache || {});
          var listMiss = Array.isArray(cacheMiss.students) ? cacheMiss.students.slice() : [];
          var idxMiss = listMiss.findIndex(function (x) {
            try { if (window.NormalizeUtils && NormalizeUtils.isSameStudent) return NormalizeUtils.isSameStudent(x && x.studentName, student && student.name); } catch (e) {}
            var a = String(x && x.studentName || '').trim().toLowerCase().replace(/\s+/g, '');
            var b = String(student && student.name || '').trim().toLowerCase().replace(/\s+/g, '');
            return a === b;
          });
          if (idxMiss >= 0) {
            listMiss.splice(idxMiss, 1);
            cacheMiss.students = listMiss;
            FLB.State.set({ uploadedRecordsCache: cacheMiss });
          }
        }
      } catch (cacheErr) {
        console.warn('⚠️ [學生回填] 更新快取失敗:', cacheErr);
      }
      resetStudentLocalState(index, student);
    }
  }

  function findStudentRecordInState(studentName) {
    if (!(window.FLB && FLB.State)) return null;
    var st = FLB.State.get();
    var cache = st && st.uploadedRecordsCache;
    var list = Array.isArray(cache && cache.students) ? cache.students : [];
    if (!list.length) return null;
    var target = normalizeToken(studentName || '');
    if (!target) return null;
    for (var i = 0; i < list.length; i++) {
      var candidate = list[i];
      var name = normalizeToken((candidate && (candidate.studentName || candidate.name)) || '');
      if (name && name === target) {
        return candidate;
      }
    }
    return null;
  }

  function buildHistoryPayloadFromStateRecord(record) {
    if (!record) return null;
    var cloneFiles = record.files ? {
      photos: Array.isArray(record.files.photos) ? record.files.photos.slice() : [],
      videos: Array.isArray(record.files.videos) ? record.files.videos.slice() : [],
      videoThumbnails: Object.assign({}, record.files.videoThumbnails || record.videoThumbnails || {})
    } : {
      photos: [],
      videos: [],
      videoThumbnails: {}
    };
    return {
      success: true,
      found: true,
      studentName: record.studentName || record.name,
      photos: record.photos,
      videos: record.videos,
      comment: record.comment,
      files: cloneFiles,
      path: record.path,
      relativePath: record.relativePath,
      semester: record.semester,
      videoThumbnails: record.videoThumbnails || cloneFiles.videoThumbnails || {},
      newMediaVideos: Array.isArray(record.newMediaVideos) ? record.newMediaVideos.slice() : [],
      newMediaPhotos: Array.isArray(record.newMediaPhotos) ? record.newMediaPhotos.slice() : []
    };
  }

  function tryApplyStudentRecordFromState(courseKey, index, student) {
    var existing = findStudentRecordInState(student && student.name);
    if (!existing) return false;
    var payload = buildHistoryPayloadFromStateRecord(existing);
    if (!payload) return false;
    handleStudentHistoryResponse(courseKey, index, student, payload, { source: 'state-cache' });
    if (courseKey) {
      StudentHistoryCache.set(courseKey, student && student.name, payload);
    }
    return true;
  }

  function goStudent(delta) {
    if (!(window.FLB && FLB.State)) return;
    var st = FLB.State.get();
    var next = Math.max(0, Math.min((st.students.length - 1), (st.currentStudentIndex || 0) + delta));
    if (next === st.currentStudentIndex) return;
    FLB.State.set({ currentStudentIndex: next });
    renderStudentPager(st.selectedCourse, next);
    renderBottomTabs();
    try { renderDesktopStudentList(); } catch (e) {}
  }

  function jumpToStudentIndex(targetIndex) {
    if (!(window.FLB && FLB.State)) return;
    var st = FLB.State.get();
    if (!st || !Array.isArray(st.students) || st.students.length === 0) return;
    var clamped = Math.max(0, Math.min(st.students.length - 1, targetIndex));
    var current = st.currentStudentIndex || 0;
    if (clamped === current) {
      if (window.FLBStudentPager && typeof window.FLBStudentPager.refresh === 'function') {
        try { window.FLBStudentPager.refresh(); } catch (e) {}
      }
      return;
    }

    var safetyCounter = 0;
    function proceed() {
      if (!(window.FLB && FLB.State)) return;
      var latestState = FLB.State.get();
      if (!latestState || !Array.isArray(latestState.students)) return;
      var currentIndex = latestState.currentStudentIndex || 0;
      if (currentIndex === clamped) {
        if (window.FLBStudentPager && typeof window.FLBStudentPager.refresh === 'function') {
          try { window.FLBStudentPager.refresh(); } catch (e) {}
        }
        return;
      }
      if (safetyCounter++ > Math.max(50, latestState.students.length * 4)) {
        FLB.State.set({ currentStudentIndex: clamped });
        renderStudentPager(latestState.selectedCourse, clamped);
        renderBottomTabs();
        return;
      }
      var controller = window.FLBStudentPager;
      var direction = clamped > currentIndex ? 1 : -1;
      if (direction > 0 && controller && typeof controller.goNextAnimated === 'function') {
        var moved = controller.goNextAnimated(proceed);
        if (!moved) {
          FLB.State.set({ currentStudentIndex: clamped });
          renderStudentPager(latestState.selectedCourse, clamped);
          renderBottomTabs();
        }
      } else if (direction < 0 && controller && typeof controller.goPrevAnimated === 'function') {
        var movedPrev = controller.goPrevAnimated(proceed);
        if (!movedPrev) {
          FLB.State.set({ currentStudentIndex: clamped });
          renderStudentPager(latestState.selectedCourse, clamped);
          renderBottomTabs();
        }
      } else {
        FLB.State.set({ currentStudentIndex: clamped });
        renderStudentPager(latestState.selectedCourse, clamped);
        renderBottomTabs();
      }
    }

    proceed();
  }

  // ==================== 底部標籤 ====================
  function setupBottomTabs() {
    renderBottomTabs();
  }
  function renderBottomTabs() {
    // 頂部籤列（手機優先）
    var el = document.getElementById('topTabs') || document.getElementById('bottomTabs');
    if (!el || !(window.FLB && FLB.State && FLB.UI && FLB.UI.BottomTabs)) return;
    var st = FLB.State.get();
    if (!st || !Array.isArray(st.students)) return;
    FLB.UI.BottomTabs.render(el, st.students, st.currentStudentIndex, function (i) {
      var completion = calculateStudentCompletion(i);
      var student = (st.students && st.students[i]) || {};
      var status = student.attendanceStatus || 'unknown';
      return {
        done: completion.done,
        percent: completion.percent,
        needsVideo: completion.needsVideo,
        attendanceStatus: status,
        attendanceMessage: student.attendanceMessage || (ATTENDANCE_STATUS_TEXT[status] || '')
      };
    }, function (idx) {
      var route = (window.FLB && FLB.Router && typeof FLB.Router.getRoute === 'function') ? FLB.Router.getRoute() : {};
      var step = (route && route.step) || 'select';
      if (idx === st.currentStudentIndex) {
        if (step !== 'student' && window.FLB && FLB.Router) {
          FLB.Router.navigate({ step: 'student', studentIndex: idx });
          setTimeout(function(){ jumpToStudentIndex(idx); }, 140);
          return;
        }
        if (window.FLBStudentPager && typeof window.FLBStudentPager.refresh === 'function') {
          window.FLBStudentPager.refresh();
        }
        return;
      }
      if (step !== 'student' && window.FLB && FLB.Router) {
        FLB.Router.navigate({ step: 'student', studentIndex: idx });
        setTimeout(function(){ jumpToStudentIndex(idx); }, 140);
      } else {
        jumpToStudentIndex(idx);
      }
    });
    el.style.display = 'flex';
    var activeBtn = null;
    Array.prototype.forEach.call(el.querySelectorAll('.tab-item'), function (btn) {
      var idx = parseInt(btn.getAttribute('data-idx') || '0', 10) || 0;
      var completion = calculateStudentCompletion(idx);
      btn.dataset.percent = completion.percent;
      if (completion.done) btn.classList.add('done'); else btn.classList.remove('done');
      if (completion.needsVideo) btn.classList.add('needs-video'); else btn.classList.remove('needs-video');
      if (idx === (st.currentStudentIndex || 0)) activeBtn = btn;
    });
    if (activeBtn && el && typeof el.scrollTo === 'function') {
      try {
        // 更精準：使用 bounding rect 計算需要的位移，並在現有 scrollLeft 基礎上偏移
        var rBtn = activeBtn.getBoundingClientRect();
        var rCon = el.getBoundingClientRect();
        var delta = (rBtn.left + rBtn.width / 2) - (rCon.left + rCon.width / 2);
        var targetLeft = el.scrollLeft + delta;
        // 加入額外邊距，避免緊貼邊緣
        targetLeft = targetLeft - 24;
        targetLeft = Math.max(0, Math.min(targetLeft, el.scrollWidth - el.clientWidth));
        el.scrollTo({ left: targetLeft, behavior: 'smooth' });
        // 再補一次以確保到位（部分裝置計算會晚一幀）
        setTimeout(function(){ el.scrollTo({ left: targetLeft, behavior: 'smooth' }); }, 80);
      } catch (e) {
        if (typeof activeBtn.scrollIntoView === 'function') {
          activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
        }
      }
    }
    setupTopTabsStickyObserver();
    try { renderDesktopStudentList(); } catch (e) {}
    // 合併上方模式膠囊進度，不再額外渲染 quick grid（節省手機空間）
    try { restorePendingUploads(); } catch (e) {}
  }

  // ==================== 浮動進度 ====================
  var progressInstance = null;
  function setupProgressIndicator() {
    if (!ENABLE_FLOATING_PROGRESS_INDICATOR) {
      var host = document.getElementById('progressIndicator');
      if (host) host.style.display = 'none';
      return;
    }
    var el = document.getElementById('progressIndicator');
    if (!el || !(window.FLB && FLB.UI && FLB.UI.ProgressIndicator)) return;
    progressInstance = FLB.UI.ProgressIndicator.mount(el, {
      onOpenItem: function (item) {
        if (item.kind === 'student') {
          var st = FLB.State.get();
          FLB.State.set({ currentStudentIndex: item.index });
          renderStudentPager(st.selectedCourse, item.index);
          renderBottomTabs();
        } else if (item.kind === 'overview') {
          if (window.FLB && FLB.Router) FLB.Router.navigate({ step: 'overview' });
          document.getElementById('view-overview') && document.getElementById('view-overview').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
    refreshProgress();
  }
  function refreshProgress() {
    if (!(window.FLB && FLB.State && FLB.Checklist)) return;
    var st = FLB.State.get();
    var result = FLB.Checklist.compute(st.students, st.drafts, st.uploadedRecordsCache);
    try { FLB.State.set({ progress: { percent: result.percent, completed: result.completed, total: result.total } }); } catch (e) {}
    if (progressInstance && progressInstance.update) { try { progressInstance.update(result); } catch (e) {} }
    try {
      // 學生模式：使用 Checklist 百分比
      var pctStu = Math.max(0, Math.min(100, Math.round(result.percent || 0)));
      var doneStu = (pctStu >= 100);
      // 記錄 Checklist 百分比，供上傳平均值並列顯示
      try { window.__stuChecklistPct = pctStu; } catch (e) {}
      try {
        var stuFills = document.querySelectorAll('[id="studentModeProgressFill"]');
        var stuTxts = document.querySelectorAll('[id="studentModeProgressText"]');
        // 若當前有傳輸中的平均值，以文字顯示「完成 + （傳輸中 X%）」並維持條為 Checklist 百分比
        var transferPct = (typeof window.__stuTransferPct === 'number') ? window.__stuTransferPct : null;
        var label = (transferPct != null) ? ('完成 ' + pctStu + '%（傳輸中 ' + Math.max(0, Math.min(100, Math.round(transferPct))) + '%）') : ('完成 ' + pctStu + '%');
        stuFills.forEach(function(el){ 
          // 🔥 設置 CSS 變數來控制 ::after 寬度
          el.style.setProperty('--progress-width', pctStu + '%'); 
          if (doneStu) el.classList.add('done'); else el.classList.remove('done'); 
        });
        stuTxts.forEach(function(el){ el.textContent = label; if (doneStu && (transferPct == null)) el.classList.add('done'); else el.classList.remove('done'); });
      } catch (e) {}

      // 總覽模式：媒體（照片或影片至少一個） + 9 個文字欄位；填越多百分比越高
      var ov = (st.uploadedRecordsCache && st.uploadedRecordsCache.overview) || null;
      var photosPresent = !!(ov && Number(ov.photos) > 0);
      var videosPresent = !!(ov && Number(ov.videos) > 0);
      // 從 summary（或當前輸入欄位）估算已填欄位數
      var summaryText = (ov && typeof ov.summary === 'string') ? ov.summary : '';
      function __escRe(str){ try { return String(str||'').replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); } catch (_) { return String(str||''); } }
      function pickFromSummary(s, label){ try { var safe = __escRe(label); var re = new RegExp('^' + safe + '\\s*：(.*)$', 'm'); var m = String(s||'').match(re); return m ? (m[1]||'').trim() : ''; } catch (_) { return ''; } }
      var fieldsFromSummary = summaryText && summaryText.trim() ? {
        type: pickFromSummary(summaryText, '課程種類'),
        date: pickFromSummary(summaryText, '日期'),
        names: pickFromSummary(summaryText, '學生姓名'),
        count: pickFromSummary(summaryText, '上課人數'),
        teacher: pickFromSummary(summaryText, '講師姓名'),
        topic: pickFromSummary(summaryText, '課程主題'),
        perf: pickFromSummary(summaryText, '學生的狀況與表現'),
        issue: pickFromSummary(summaryText, '遇到的問題'),
        solution: pickFromSummary(summaryText, '解決的方法')
      } : null;
      var ids = ['ov_type','ov_date','ov_names','ov_count','ov_teacher','ov_topic','ov_perf','ov_issue','ov_solution'];
      var summaryMap = {
        ov_type: 'type',
        ov_date: 'date',
        ov_names: 'names',
        ov_count: 'count',
        ov_teacher: 'teacher',
        ov_topic: 'topic',
        ov_perf: 'perf',
        ov_issue: 'issue',
        ov_solution: 'solution'
      };
      var textPresentCount = ids.reduce(function(n, id) {
        var el = document.getElementById(id);
        var val = (el && typeof el.value === 'string') ? el.value.trim() : '';
        if (!val && fieldsFromSummary) {
          var key = summaryMap[id];
          if (key && fieldsFromSummary[key]) {
            val = String(fieldsFromSummary[key]).trim();
          }
        }
        return n + (val ? 1 : 0);
      }, 0);
      // 🎯 媒體為「可選，其一即可計分」：照片或影片任一存在視為 1 個完成項
      var localPhotoCount = Array.isArray(window.overviewPhotosFiles) ? window.overviewPhotosFiles.length : 0;
      var localVideoCount = Array.isArray(window.overviewVideosFiles) ? window.overviewVideosFiles.length : 0;
      var mediaDone = (photosPresent || videosPresent || localPhotoCount > 0 || localVideoCount > 0) ? 1 : 0;
      var totalParts = 1 + 9; // 媒體（照片或影片其一） + 9 文字欄位（共 10 項）
      var doneParts = mediaDone + textPresentCount;
      var pctOv = Math.max(0, Math.min(100, Math.round((doneParts / totalParts) * 100)));
      var doneOv = (pctOv >= 100);
      try { window.__ovChecklistPct = pctOv; } catch (e) {}
      try {
        var ovFills = document.querySelectorAll('[id="overviewModeProgressFill"]');
        var ovTxts = document.querySelectorAll('[id="overviewModeProgressText"]');
        var transferOv = (typeof window.__ovTransferPct === 'number') ? window.__ovTransferPct : null;
        var labelOv = (transferOv != null) ? ('完成 ' + pctOv + '%（傳輸中 ' + Math.max(0, Math.min(100, Math.round(transferOv))) + '%）') : ('完成 ' + pctOv + '%');
        ovFills.forEach(function(el){ 
          // 🔥 設置 CSS 變數來控制 ::after 寬度
          el.style.setProperty('--progress-width', pctOv + '%'); 
          if (doneOv && transferOv == null) el.classList.add('done'); else el.classList.remove('done'); 
        });
        ovTxts.forEach(function(el){ el.textContent = labelOv; if (doneOv && transferOv == null) el.classList.add('done'); else el.classList.remove('done'); });
        // 同步更新底部「自動同步」狀態條（若目前沒有實際上傳進行中）
        var syncFill = document.getElementById('overviewSyncFill');
        var syncText = document.getElementById('overviewSyncText');
        if (syncFill && !window.__uploadingOverview) syncFill.style.setProperty('--progress-width', pctOv + '%');
        if (syncText && !window.__uploadingOverview) syncText.textContent = doneOv ? '已同步' : ('同步就緒 完成 ' + pctOv + '%');
      } catch (e) {}
    } catch (e) {}
    try {
      if (!window.__autoOverviewNavigated && result.total > 0 && result.completed === result.total) {
        window.__autoOverviewNavigated = true;
        if (window.FLB && FLB.Router) FLB.Router.navigate({ step: 'overview' });
        var ov = document.getElementById('view-overview');
        if (ov) {
          ov.classList.add('overview-highlight');
          ov.scrollIntoView({ behavior: 'smooth', block: 'start' });
          setTimeout(function(){ try { ov.classList.remove('overview-highlight'); } catch (e) {} }, 2400);
        }
        showToast('所有學生皆已完成，上傳課程總覽吧！', 'success');
      }
    } catch (e) {}
  }

  function loadStudentCards(course) {
    var grid = document.getElementById('studentsGrid');
    if (!grid) return;
    if (!course.students || course.students.length === 0) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-user-slash"></i><h3>此課程沒有學生資料</h3><p>請先在系統中設定學生名單</p></div>';
      return;
    }
    grid.innerHTML = course.students.map(function (student, index) {
      return (
        '<div class="student-card" id="student-' + index + '">' +
          '<div class="progress-indicators">' +
            '<div class="indicator" id="photo-indicator-' + index + '"><div class="icon"><i class="fas fa-camera"></i></div><div class="text"><span id="photo-count-' + index + '">0</span>/3 照片</div></div>' +
            '<div class="indicator" id="video-indicator-' + index + '"><div class="icon"><i class="fas fa-video"></i></div><div class="text">影片<span class="optional-tag">（選）</span> <span id="video-count-' + index + '">0</span> 支</div></div>' +
            '<div class="indicator" id="comment-indicator-' + index + '"><div class="icon"><i class="fas fa-comment"></i></div><div class="text"><span id="comment-count-' + index + '">0</span>/20 字</div></div>' +
          '</div>' +
          '<div class="student-header">' +
            '<div class="student-name">' + (student.name || '') + '</div>' +
            '<div class="student-remaining">剩餘 ' + (student.remaining || 0) + ' 堂</div>' +
          '</div>' +
          '<div class="upload-area">' +
            '<label class="upload-label">📸 課程照片（需要 3 張）</label>' +
            '<div class="file-drop-zone" data-student="' + index + '" data-type="photos"><i class="fas fa-images"></i><div class="text">點擊或拖放照片（需要 3 張）</div></div>' +
            '<input type="file" id="photos-' + index + '" class="file-input" accept="image/*" multiple data-student="' + index + '" data-type="photos">' +
            '<div class="file-previews" id="photos-preview-' + index + '"></div>' +
          '</div>' +
          '<div class="upload-area">' +
            '<label class="upload-label">🎬 課程影片</label>' +
            '<div class="file-drop-zone" data-student="' + index + '" data-type="videos"><i class="fas fa-video"></i><div class="text">點擊或拖放影片</div></div>' +
            '<input type="file" id="videos-' + index + '" class="file-input" accept="video/*" multiple data-student="' + index + '" data-type="videos">' +
            '<div class="file-previews" id="videos-preview-' + index + '"></div>' +
          '</div>' +
          '<div class="upload-area">' +
            '<label class="upload-label">💬 課程評語（建議至少 20 字）</label>' +
            '<textarea class="comment-area" id="comment-' + index + '" placeholder="請為 ' + (student.name || '') + ' 撰寫課程評語（建議 20 字以上），描述學習表現、進步情況等..." data-student="' + index + '"></textarea>' +
            '<div class="char-count"><span id="comment-chars-' + index + '">0</span> / 20 字</div>' +
          '</div>' +
          '<button class="upload-btn auto-mode" id="upload-btn-' + index + '" onclick="uploadStudentRecord(' + index + ')" disabled><i class="fas fa-robot"></i> 系統自動上傳</button>' +
        '</div>'
      );
    }).join('');
    course.students.forEach(function (student, index) { setupStudentCard(index, student); });
  }

  // ==================== 桌面：左側學生清單 ====================
  function renderDesktopStudentList() {
    // 🧹 應用主動需求：移除「桌面左側學生清單」視圖（避免重複 UI）
    try { var panel = document.getElementById('desktopStudentList'); if (panel) panel.style.display = 'none'; } catch (e) {}
    return; // 保留函式接口，避免其他呼叫報錯
  }

  function setStudentLockState(index, locked, reason, statusCode) {
    var student = currentCourse && currentCourse.students ? currentCourse.students[index] : null;
    var entry = ensureStudentFileEntry(index, student || {});
    if (!entry) return;
    entry.locked = !!locked;
    entry.lockReason = locked ? String(reason || '') : '';
    entry.lockStatus = locked ? String(statusCode || '') : '';

    var dropZones = document.querySelectorAll('[data-student="' + index + '"][data-type]');
    dropZones.forEach(function (zone) {
      if (!zone) return;
      if (locked) {
        zone.classList.add('disabled');
        zone.setAttribute('aria-disabled', 'true');
      } else {
        zone.classList.remove('disabled');
        zone.removeAttribute('aria-disabled');
      }
    });

    var fileInputs = [
      document.getElementById('photos-' + index),
      document.getElementById('videos-' + index)
    ];
    fileInputs.forEach(function (input) {
      if (!input) return;
      input.disabled = !!locked;
    });

    var commentArea = document.getElementById('comment-' + index);
    if (commentArea) {
      commentArea.disabled = !!locked;
      if (locked) {
        commentArea.classList.add('disabled');
      } else {
        commentArea.classList.remove('disabled');
      }
    }

    if (locked) {
      cancelAutoUpload(index);
    }

    checkUploadReady(index, { skipAuto: true, silent: true });
  }

  function applyAttendanceStatusToCard(index, student) {
    var status = (student && student.attendanceStatus) || 'unknown';
    var message = (student && student.attendanceMessage) || ATTENDANCE_STATUS_TEXT[status] || ATTENDANCE_STATUS_TEXT.unknown;
    var statusEl = document.getElementById('attendance-status-' + index);
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.className = 'attendance-status ' + (ATTENDANCE_STATUS_CLASS[status] || ATTENDANCE_STATUS_CLASS.unknown);
      statusEl.setAttribute('data-status', status);
    }
    var shouldLock = (status === 'leave' || status === 'absent');
    setStudentLockState(index, shouldLock, message, status);
  }

  function setupStudentCard(index, student) {
    ensureStudentFileEntry(index, student);
    var photosZone = document.querySelector('[data-student="' + index + '"][data-type="photos"]');
    var photosInput = document.getElementById('photos-' + index);
    photosZone && photosZone.addEventListener('click', function () { photosInput && photosInput.click(); });
    photosInput && photosInput.addEventListener('change', function (e) { handleFileSelect(e, index, 'photos'); });
    var videosZone = document.querySelector('[data-student="' + index + '"][data-type="videos"]');
    var videosInput = document.getElementById('videos-' + index);
    videosZone && videosZone.addEventListener('click', function () { videosInput && videosInput.click(); });
    videosInput && videosInput.addEventListener('change', function (e) { handleFileSelect(e, index, 'videos'); });
    // ♻️ 若此學生有上傳中的暫存節點（因滑動被搬到隱藏容器），此處重新掛回預覽區
    console.log('📦 [setupStudentCard] 還原學生節點:', index);
    try { reattachShadowNodesFor(index); } catch (e) {
      console.error('❌ [setupStudentCard] 還原節點失敗:', e);
    }
    CommentSyncManager.bind(index);
    applyAttendanceStatusToCard(index, student);
    try { renderSuggestionChips(index); } catch (e) {}
  }

  function restoreDraftForStudent(index) {
    console.log('📝 [restoreDraftForStudent] 開始:', { index: index });
    try {
      if (!(window.FLB && FLB.State)) return;
      var st = FLB.State.get();
      var draft = st && st.drafts ? st.drafts[String(index)] : null;
      console.log('🔍 [restoreDraftForStudent] 草稿狀態:', { 
        hasDraft: !!draft,
        draftPhotos: draft && draft.photos ? draft.photos.length : 0,
        draftVideos: draft && draft.videos ? draft.videos.length : 0
      });
      if (!studentFiles[index]) studentFiles[index] = { photos: [], videos: [], comment: '', baselineComment: '', syncedComment: '' };
      var base = studentFiles[index];
      
      var hasValidPhotos = false;
      var hasValidVideos = false;
      
      if (draft) {
        // 🔥 [修復] 檢查草稿中的檔案是否有效（File 對象無法序列化到 localStorage）
        if (Array.isArray(draft.photos) && draft.photos.length) {
          // 過濾出有效的 File 對象
          var validPhotos = draft.photos.filter(function(f) { 
            return f && typeof f === 'object' && f.constructor && f.constructor.name === 'File';
          });
          if (validPhotos.length > 0) {
            base.photos = validPhotos;
            hasValidPhotos = true;
          }
        }
        if (Array.isArray(draft.videos) && draft.videos.length) {
          var validVideos = draft.videos.filter(function(f) { 
            return f && typeof f === 'object' && f.constructor && f.constructor.name === 'File';
          });
          if (validVideos.length > 0) {
            base.videos = validVideos;
            hasValidVideos = true;
          }
        }
        // 只在草稿有內容時覆蓋伺服器回填；若草稿為空且已有 baselineComment，維持伺服器內容
        if (typeof draft.comment === 'string') {
          var _trimmed = String(draft.comment).trim();
          if (_trimmed.length > 0) {
            base.comment = draft.comment;
          } else if (base && typeof base.baselineComment === 'string' && base.baselineComment.trim().length > 0) {
            // 保留伺服器回填，不動作
          } else {
            base.comment = '';
          }
        }
      }
      
      // 🔥 [完全禁用] 不要在這裡調用 updateFilePreviews
      // 理由：
      // 1. File 對象無法序列化到 localStorage，草稿恢復時都是無效的
      // 2. 調用 updateFilePreviews 會清除已上傳的預覽（即使有保護機制）
      // 3. 新選擇的檔案會在 handleFileSelect 中正確渲染
      // 4. 已上傳的檔案會在 applyExistingRecordToCard 中正確渲染
      if (hasValidPhotos) {
        console.log('⚠️ [restoreDraftForStudent] 發現草稿照片但跳過渲染，避免清除已上傳預覽');
        // updateFilePreviews(index, 'photos');  // 🔥 禁用
      }
      if (hasValidVideos) {
        console.log('⚠️ [restoreDraftForStudent] 發現草稿影片但跳過渲染，避免清除已上傳預覽');
        // updateFilePreviews(index, 'videos');  // 🔥 禁用
      }
      // 若當前 comment 為空但 baselineComment 有值，優先顯示伺服器回填
      var _hydrateValue = (base.comment && base.comment.trim().length > 0)
        ? base.comment
        : (base.baselineComment || '');
      CommentSyncManager.hydrate(index, _hydrateValue, { delay: 150 });
      try { renderSuggestionChips(index); } catch (e) {}
      checkUploadReady(index, { skipAuto: true, silent: true });
    } catch (e) {}
  }

  // ==================== 評語模板：LocalStorage 管理與面板渲染 ====================
  var TEMPLATE_KEY = 'lr_comment_templates';
  function loadTemplates() {
    try { var raw = localStorage.getItem(TEMPLATE_KEY); if (!raw) return []; var arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
  }
  function saveTemplates(arr) {
    try { localStorage.setItem(TEMPLATE_KEY, JSON.stringify(arr.slice(0, 10))); } catch (e) {}
  }
  function addTemplate(text) {
    var t = String(text || '').trim();
    if (!t) return false;
    var list = loadTemplates();
    // 去重（以相同內容為準）
    list = list.filter(function (x) { return String(x || '').trim() !== t; });
    list.unshift(t);
    saveTemplates(list);
    return true;
  }
  function deleteTemplateByIndex(idx) {
    var list = loadTemplates();
    if (idx >= 0 && idx < list.length) { list.splice(idx, 1); saveTemplates(list); }
  }
  function pinTemplate(idx) {
    var list = loadTemplates();
    if (idx >= 0 && idx < list.length) { var item = list.splice(idx, 1)[0]; list.unshift(item); saveTemplates(list); }
  }

  function openCommentTemplatesPanel() {
    try {
      var panel = document.getElementById('commentTemplatesPanel');
      if (!panel) return;
      renderTemplatesPanel();
      panel.style.display = 'block';
    } catch (e) {}
  }
  function closeCommentTemplatesPanel() {
    var panel = document.getElementById('commentTemplatesPanel');
    if (panel) panel.style.display = 'none';
  }
  function addCurrentCommentAsTemplate() {
    try {
      if (!(window.FLB && FLB.State)) return;
      var st = FLB.State.get();
      var i = st.currentStudentIndex || 0;
      var ta = document.getElementById('comment-' + i);
      var val = ta ? String(ta.value || '').trim() : '';
      if (!val) { showToast('目前學生沒有評語可加入', 'warning'); return; }
      if (addTemplate(val)) { showToast('已加入評語模板', 'success'); renderTemplatesPanel(); lastCommentTemplate = val; refreshSuggestionChipsAll(); }
    } catch (e) {}
  }
  function renderTemplatesPanel() {
    try {
      var list = loadTemplates();
      var listHost = document.getElementById('templateList');
      var targetHost = document.getElementById('templateTargetList');
      if (!listHost || !targetHost) return;
      // 模板列表
      if (!list.length) {
        listHost.innerHTML = '<div style="color:#64748b">尚無模板，請先於任一學生輸入評語，並點選「加入目前評語」。</div>';
      } else {
        listHost.innerHTML = list.map(function (t, idx) {
          var safe = (window.FLB && FLB.Course && FLB.Course.escapeHtml) ? FLB.Course.escapeHtml(t) : t.replace(/[&<>]/g, '');
          return '<div class="template-item" data-idx="' + idx + '" style="padding:10px; border:1px solid rgba(0,0,0,0.06); border-radius:10px; margin-bottom:8px">'
            + '<label style="display:flex; align-items:center; gap:8px">'
            + '<input type="radio" name="tplSel" value="' + idx + '">'
            + '<div style="font-weight:700; color:#0f172a">模板 ' + (idx + 1) + '</div>'
            + '</label>'
            + '<div style="margin-top:6px; font-size:14px; color:#334155">' + safe + '</div>'
            + '<div style="margin-top:8px; display:flex; gap:8px">'
            + '<button class="nav-btn" data-pin="' + idx + '"><i class="fas fa-thumbtack"></i> 置頂</button>'
            + '<button class="nav-btn" data-del="' + idx + '"><i class="fas fa-trash"></i> 刪除</button>'
            + '</div>'
            + '</div>';
        }).join('');
        // 綁定置頂/刪除
        Array.prototype.forEach.call(listHost.querySelectorAll('[data-del]'), function (btn) {
          btn.addEventListener('click', function () { deleteTemplateByIndex(parseInt(btn.getAttribute('data-del'), 10)); renderTemplatesPanel(); });
        });
        Array.prototype.forEach.call(listHost.querySelectorAll('[data-pin]'), function (btn) {
          btn.addEventListener('click', function () { pinTemplate(parseInt(btn.getAttribute('data-pin'), 10)); renderTemplatesPanel(); });
        });
      }
      // 學生清單
      var st = (window.FLB && FLB.State) ? FLB.State.get() : null;
      var students = (st && Array.isArray(st.students)) ? st.students : [];
      targetHost.innerHTML = students.map(function (s, i) {
        var name = (s && s.name) || String(s || '');
        return '<label style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.04)">'
          + '<input type="checkbox" class="tpl-target" value="' + i + '">'
          + '<span>' + ((window.FLB && FLB.Course && FLB.Course.escapeHtml) ? FLB.Course.escapeHtml(name) : name) + '</span>'
          + '</label>';
      }).join('');
    } catch (e) {}
  }
  function selectAllTemplateTargets(val) {
    try { Array.prototype.forEach.call(document.querySelectorAll('#templateTargetList .tpl-target'), function (cb) { cb.checked = !!val; }); } catch (e) {}
  }
  function getSelectedTemplateText() {
    var radios = document.querySelectorAll('#templateList input[name="tplSel"]');
    var idx = -1; Array.prototype.forEach.call(radios, function (r) { if (r.checked) idx = parseInt(r.value, 10); });
    var list = loadTemplates();
    if (idx < 0 || idx >= list.length) return '';
    return String(list[idx] || '');
  }
  function applySelectedTemplate() {
    try {
      var text = getSelectedTemplateText();
      if (!text) { showToast('請先選擇一個模板', 'warning'); return; }
      var onlyEmpty = !!(document.getElementById('applyOnlyEmpty') && document.getElementById('applyOnlyEmpty').checked);
      var targets = Array.prototype.slice.call(document.querySelectorAll('#templateTargetList .tpl-target')).filter(function (cb) { return cb.checked; }).map(function (cb) { return parseInt(cb.value, 10) || 0; });
      if (!targets.length) { showToast('請先勾選要套用的學生', 'warning'); return; }
      targets.forEach(function (idx) { applyTemplateToStudent(idx, text, onlyEmpty); });
      try { refreshProgress(); renderBottomTabs(); } catch (e) {}
      showToast('已套用模板至 ' + targets.length + ' 位學生', 'success');
    } catch (e) {}
  }
  function applyTemplateToStudent(index, text, onlyEmpty) {
    try {
      ensureStudentFileEntry(index, (window.FLB && FLB.State) ? (FLB.State.get().students[index]) : null);
      var base = studentFiles[index];
      var existing = base.existingCounts || {};
      var current = (base.comment || '').trim();
      if (onlyEmpty && (current.length > 0 || (existing.text || 0) > 0)) return;
      base.comment = String(text || '');
      var ta = document.getElementById('comment-' + index);
      if (ta) {
        ta.value = base.comment;
        var evt = new Event('input', { bubbles: true });
        ta.dispatchEvent(evt);
      }
      // 同步 drafts
      if (window.FLB && FLB.State) {
        var st = FLB.State.get();
        var drafts = Object.assign({}, st.drafts || {});
        drafts[String(index)] = Object.assign({}, drafts[String(index)] || {}, { comment: base.comment, photos: base.photos || [], videos: base.videos || [] });
        FLB.State.set({ drafts: drafts });
      }
      lastCommentTemplate = text; // 更新最近模板
      refreshSuggestionChipsAll();
    } catch (e) {}
  }

  // ==================== 影片模板（記憶體面板） ====================
  function addVideoTemplateFromFile(file) {
    try {
      if (!file) return;
      var key = (file.name || '') + '|' + (file.size || 0);
      var exist = videoTemplatesMem.find(function (x) { return x && x.key === key; });
      if (exist) return;
      var url = '';
      try { url = URL.createObjectURL(file); } catch (e) { url = ''; }
      var item = { id: 'vt-' + Date.now() + '-' + Math.floor(Math.random() * 10000), key: key, name: file.name || 'video', size: file.size || 0, url: url, file: file };
      videoTemplatesMem.unshift(item);
      if (videoTemplatesMem.length > 8) {
        var removed = videoTemplatesMem.splice(8);
        removed.forEach(function (it) { try { if (it && it.url && it.url.indexOf('blob:') === 0) URL.revokeObjectURL(it.url); } catch (e) {} });
      }
    } catch (e) {}
  }
  function openVideoTemplatesPanel() {
    try {
      renderVideoTemplatesPanel();
      var p = document.getElementById('videoTemplatesPanel');
      if (p) p.style.display = 'block';
    } catch (e) {}
  }
  function closeVideoTemplatesPanel() {
    var p = document.getElementById('videoTemplatesPanel');
    if (p) p.style.display = 'none';
  }
  function renderVideoTemplatesPanel() {
    try {
      var listHost = document.getElementById('videoTemplateList');
      var targetHost = document.getElementById('videoTemplateTargetList');
      if (!listHost || !targetHost) return;
      if (!videoTemplatesMem.length) {
        listHost.innerHTML = '<div style="color:#64748b">尚無影片模板，請先選取影片或點「加入最近影片」。</div>';
      } else {
        listHost.innerHTML = videoTemplatesMem.map(function (it) {
          var name = (window.FLB && FLB.Course && FLB.Course.escapeHtml) ? FLB.Course.escapeHtml(it.name || '') : (it.name || '');
          return '<div class="template-item" data-vid="' + it.id + '" style="padding:10px; border:1px solid rgba(0,0,0,0.06); border-radius:10px; margin-bottom:8px">'
            + '<label style="display:flex; align-items:center; gap:8px">'
            + '<input type="radio" name="vtSel" value="' + it.id + '">'
            + '<div style="font-weight:700; color:#0f172a">' + name + '</div>'
            + '</label>'
            + '<div style="margin-top:6px"><video src="' + it.url + '" preload="metadata" muted playsinline style="width:100%; border-radius:8px"></video></div>'
            + '<div style="margin-top:8px; display:flex; gap:8px">'
            + '<button class="nav-btn" data-del-v="' + it.id + '"><i class="fas fa-trash"></i> 移除</button>'
            + '</div>'
            + '</div>';
        }).join('');
        // 🎞️ 對齊 LINE：模板影片產生海報圖以避免灰底
        try {
          setTimeout(function(){
            try {
              var vids = listHost.querySelectorAll('video');
              Array.prototype.forEach.call(vids, function(v){ try { generateVideoPoster(v); } catch (e) {} });
            } catch (e) {}
          }, 0);
        } catch (e) {}
        Array.prototype.forEach.call(listHost.querySelectorAll('[data-del-v]'), function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-del-v');
            var i = videoTemplatesMem.findIndex(function (x) { return x && x.id === id; });
            if (i >= 0) {
              var r = videoTemplatesMem.splice(i, 1)[0];
              try { if (r && r.url && r.url.indexOf('blob:') === 0) URL.revokeObjectURL(r.url); } catch (e) {}
            }
            renderVideoTemplatesPanel();
          });
        });
      }
      var st = (window.FLB && FLB.State) ? FLB.State.get() : null;
      var students = (st && Array.isArray(st.students)) ? st.students : [];
      targetHost.innerHTML = students.map(function (s, i) {
        var nm = (s && s.name) || String(s || '');
        return '<label style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-bottom:1px solid rgba(0,0,0,0.04)">'
          + '<input type="checkbox" class="vt-target" value="' + i + '">'
          + '<span>' + ((window.FLB && FLB.Course && FLB.Course.escapeHtml) ? FLB.Course.escapeHtml(nm) : nm) + '</span>'
          + '</label>';
      }).join('');
    } catch (e) {}
  }
  function addLatestVideoToTemplates() {
    try {
      if (lastSharedVideoFiles && lastSharedVideoFiles[0]) {
        addVideoTemplateFromFile(lastSharedVideoFiles[0]);
        renderVideoTemplatesPanel();
        showToast('已加入最近影片為模板', 'success');
      } else {
        showToast('找不到最近選取的影片', 'warning');
      }
    } catch (e) {}
  }
  function getSelectedVideoTemplate() {
    var radios = document.querySelectorAll('#videoTemplateList input[name="vtSel"]');
    var id = ''; Array.prototype.forEach.call(radios, function (r) { if (r.checked) id = r.value; });
    var item = videoTemplatesMem.find(function (x) { return x && x.id === id; });
    return item || null;
  }
  function selectAllVideoTargets(val) {
    try { Array.prototype.forEach.call(document.querySelectorAll('#videoTemplateTargetList .vt-target'), function (cb) { cb.checked = !!val; }); } catch (e) {}
  }
  function applySelectedVideoTemplate() {
    try {
      var tpl = getSelectedVideoTemplate();
      if (!tpl || !tpl.file) { showToast('請先選擇一個影片模板', 'warning'); return; }
      var onlyEmpty = !!(document.getElementById('videoApplyOnlyEmpty') && document.getElementById('videoApplyOnlyEmpty').checked);
      var targets = Array.prototype.slice.call(document.querySelectorAll('#videoTemplateTargetList .vt-target')).filter(function (cb) { return cb.checked; }).map(function (cb) { return parseInt(cb.value, 10) || 0; });
      if (!targets.length) { showToast('請先勾選要套用的學生', 'warning'); return; }
      targets.forEach(function (idx) {
        ensureStudentFileEntry(idx, (window.FLB && FLB.State) ? (FLB.State.get().students[idx]) : null);
        var base = studentFiles[idx];
        var existing = base.existingCounts || {};
        var hasVideoNow = (Array.isArray(base.videos) && base.videos.length > 0) || (existing.videos || 0) > 0;
        if (onlyEmpty && hasVideoNow) return;
        base.videos = (base.videos || []).concat([tpl.file]);
        
        // 🔥 [修復] 使用共用預覽器渲染，避免清除已上傳的預覽
        if (window.SharedMediaPreviewer) {
          try {
            var container = document.getElementById('videos-preview-' + idx);
            if (container) {
              window.SharedMediaPreviewer.renderPreviews({
                container: container,
                files: base.videos,
                clearExisting: false,
                onRemove: function(index) {
                  removeFile(idx, 'videos', index);
                }
              });
              
              // 🔥 [統一 2025-11-19] 設置 data-file-id 並統一綁定
              setTimeout(function() {
                try {
                  var allPreviews = container.querySelectorAll('.file-preview.new-upload');
                  allPreviews.forEach(function(preview, vidx) {
                    if (!preview.getAttribute('data-file-id')) {
                      var fileIndex = preview.getAttribute('data-file-index') || vidx;
                      preview.setAttribute('data-file-id', 'file-' + idx + '-videos-' + fileIndex);
                    }
                    if (typeof window.ensureDeleteButtonWorks === 'function') {
                      window.ensureDeleteButtonWorks(preview);
                    }
                  });
                } catch (bindErr) {
                  console.warn('⚠️ [applyVideoTemplate] 統一綁定失敗:', bindErr);
                }
              }, 100); // 🔧 [統一 2025-11-19] 與 SharedIntegration 保持一致的延遲時間
            }
          } catch (err) {
            console.warn('⚠️ 快速套用影片渲染失敗，回退:', err);
            updateFilePreviews(idx, 'videos');
          }
        } else {
          updateFilePreviews(idx, 'videos');
        }
        
        resetUploadRetryState(idx);
        checkUploadReady(idx);
        if (window.FLB && FLB.State) {
          var st2 = FLB.State.get();
          var drafts2 = Object.assign({}, st2.drafts || {});
          drafts2[String(idx)] = Object.assign({}, drafts2[String(idx)] || {}, { comment: base.comment, photos: base.photos || [], videos: base.videos || [] });
          FLB.State.set({ drafts: drafts2 });
        }
        try { if (typeof isUploadReady === 'function' && isUploadReady(idx) && !uploadingStudents[idx]) uploadStudentRecord(idx); } catch (e) {}
      });
      try { refreshProgress(); renderBottomTabs(); } catch (e) {}
      showToast('已套用影片至 ' + targets.length + ' 位學生', 'success');
    } catch (e) {}
  }

  // 對外（HTML onclick）
  window.openCommentTemplatesPanel = openCommentTemplatesPanel;
  window.closeCommentTemplatesPanel = closeCommentTemplatesPanel;
  window.addCurrentCommentAsTemplate = addCurrentCommentAsTemplate;
  window.applySelectedTemplate = applySelectedTemplate;
  window.selectAllTemplateTargets = selectAllTemplateTargets;
  // 影片模板（暴露給 HTML）
  window.openVideoTemplatesPanel = function(){ try { openVideoTemplatesPanel(); } catch (e) {} };
  window.closeVideoTemplatesPanel = function(){ try { closeVideoTemplatesPanel(); } catch (e) {} };
  window.addLatestVideoToTemplates = function(){ try { addLatestVideoToTemplates(); } catch (e) {} };
  window.applySelectedVideoTemplate = function(){ try { applySelectedVideoTemplate(); } catch (e) {} };
  window.selectAllVideoTargets = function(v){ try { selectAllVideoTargets(v); } catch (e) {} };

  // 將後端既有記錄帶入原預覽欄位與評論，並更新指標與計數
  function applyExistingRecordToCard(index, student, uploaded) {
    console.log('🔄 [applyExistingRecordToCard] 開始:', { 
      index: index, 
      student: student.name, 
      uploaded: uploaded,
      'uploaded.files': uploaded.files,
      'uploaded.files.photos': uploaded.files && uploaded.files.photos ? uploaded.files.photos : null,
      'uploaded.files.videos': uploaded.files && uploaded.files.videos ? uploaded.files.videos : null,
      'uploaded.photos (count)': uploaded.photos,
      'uploaded.videos (count)': uploaded.videos,
      'uploaded.studentName': uploaded.studentName,
      'uploaded.relativePath': uploaded.relativePath
    });
    try {
      var photosPreview = document.getElementById('photos-preview-' + index);
      var videosPreview = document.getElementById('videos-preview-' + index);
      console.log('🔍 [applyExistingRecordToCard] 容器狀態:', {
        photosPreview: photosPreview ? '存在' : '不存在',
        videosPreview: videosPreview ? '存在' : '不存在',
        photosPreviewChildren: photosPreview ? photosPreview.children.length : 0,
        videosPreviewChildren: videosPreview ? videosPreview.children.length : 0
      });
      if (!studentFiles[index]) studentFiles[index] = { photos: [], videos: [], comment: '', baselineComment: '', syncedComment: '' };
      var base = studentFiles[index];
      var relativePathHint = safeResolveRelativePathHint(uploaded);
      var courseNameHint = uploaded.courseName || (currentCourse && currentCourse.courseName) || '';
      var semesterHint = uploaded.semester || (currentCourse && currentCourse.semester) || '';

      console.log('📦 [applyExistingRecordToCard] base 初始狀態:', {
        student: student.name,
        'base.photos': base.photos ? base.photos.length : 0,
        'base.videos': base.videos ? base.videos.length : 0,
        'base.photos類型': base.photos && base.photos[0] ? base.photos[0].constructor.name : 'N/A'
      });
      
      var pendingPhotoFiles = Array.isArray(base.photos) ? base.photos.slice() : [];
      var pendingVideoFiles = Array.isArray(base.videos) ? base.videos.slice() : [];
      var pendingLocalPhotos = base.localFiles && Array.isArray(base.localFiles.photos) ? base.localFiles.photos.slice() : [];
      var pendingLocalVideos = base.localFiles && Array.isArray(base.localFiles.videos) ? base.localFiles.videos.slice() : [];
      
      console.log('💾 [applyExistingRecordToCard] 保存 pending 檔案:', {
        student: student.name,
        pendingPhotoFiles: pendingPhotoFiles.length,
        pendingVideoFiles: pendingVideoFiles.length
      });
      
      // 清空暫存（避免重複累積）
      base.photos = [];
      base.videos = [];
      var syncedCommentValue = formatCommentForInput(uploaded.comment || '');
      markCommentSynced(index, syncedCommentValue);
      
      // 🔥 [修復] 優先使用新媒體系統資料，避免與舊系統重複
      var existingPhotos = [];
      var existingVideos = [];
      
      // 🔥 新增：讀取新媒體系統的影片（從 videos-meta.json）
      if (uploaded.newMediaVideos && Array.isArray(uploaded.newMediaVideos) && uploaded.newMediaVideos.length > 0) {
        console.log('📹 [主卡片] 使用新媒體系統影片:', uploaded.newMediaVideos.length, '個');
        uploaded.newMediaVideos.forEach(function(videoMeta) {
          if (videoMeta && videoMeta.id) {
            // 將新影片資訊加入列表（使用轉碼檔名或原始檔名）
            var displayFilename = videoMeta.transcodedFilename || videoMeta.filename;
            if (displayFilename) {
              existingVideos.push({
                filename: displayFilename,
                originalName: videoMeta.originalName,
                id: videoMeta.id,  // 🔥 [修復] 統一使用 id 欄位（與 API 回傳一致）
                thumbnailFilename: videoMeta.thumbnailFilename,
                uploadedAt: videoMeta.uploadedAt,
                fileSize: videoMeta.fileSize,
                status: videoMeta.status
              });
            }
          }
        });
      } else {
        // 🔥 沒有新媒體影片時，才使用舊系統資料
        var rawVideos = (uploaded.files && Array.isArray(uploaded.files.videos)) ? uploaded.files.videos.slice() : [];
        // 🔥 確保所有影片項目都是字串（如果是物件，提取 name/filename/path）
        existingVideos = rawVideos.map(function(item) {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            return item.filename || item.name || item.path || String(item);
          }
          return String(item || '');
        }).filter(Boolean);
        console.log('📹 [主卡片] 使用舊系統影片:', existingVideos.length, '個');
      }
      
      // 🔥 新增：讀取新媒體系統的照片（從 photos-meta.json）
      if (uploaded.newMediaPhotos && Array.isArray(uploaded.newMediaPhotos) && uploaded.newMediaPhotos.length > 0) {
        console.log('📸 [主卡片] 使用新媒體系統照片:', uploaded.newMediaPhotos.length, '個');
        console.log('📸 [主卡片] 照片ID列表:', uploaded.newMediaPhotos.map(p => p.id));
        uploaded.newMediaPhotos.forEach(function(photoMeta) {
          if (photoMeta && photoMeta.id) {
            if (photoMeta.filename) {
              existingPhotos.push({
                filename: photoMeta.filename,
                originalName: photoMeta.originalName,
                id: photoMeta.id,  // 🔥 [修復] 統一使用 id 欄位（與 API 回傳一致）
                thumbnails: photoMeta.thumbnails,
                uploadedAt: photoMeta.uploadedAt,
                fileSize: photoMeta.fileSize,
                status: photoMeta.status
              });
            }
          }
        });
      } else {
        // 🔥 沒有新媒體照片時，才使用舊系統資料
        var rawPhotos = (uploaded.files && Array.isArray(uploaded.files.photos)) ? uploaded.files.photos.slice() : [];
        // 🔥 確保所有照片項目都是字串（如果是物件，提取 name/filename/path）
        existingPhotos = rawPhotos.map(function(item) {
          if (typeof item === 'string') return item;
          if (typeof item === 'object' && item !== null) {
            return item.filename || item.name || item.path || String(item);
          }
          return String(item || '');
        }).filter(Boolean);
        console.log('📸 [主卡片] 使用舊系統照片:', existingPhotos.length, '張');
      }
      
      console.log('📸 [applyExistingRecordToCard] 旧系统照片数:', (uploaded.files && uploaded.files.photos) ? uploaded.files.photos.length : 0);
      console.log('📸 [applyExistingRecordToCard] existingPhotos总数:', existingPhotos.length);
      
      var studentNameKey = String(student.name || student.studentName || uploaded.studentName || '');
      
      // 🔥 [修復 2025-01-XX] 智能快取：生成內容哈希值
      // 使用照片和影片的 ID/filename 列表來判斷內容是否改變
      var photosHash = existingPhotos.map(function(p) {
        return (typeof p === 'object' && p.id) ? p.id : String(p);
      }).sort().join('|');
      var videosHash = existingVideos.map(function(v) {
        return (typeof v === 'object' && v.id) ? v.id : String(v);
      }).sort().join('|');
      
      // 修复：先清除旧缓存，再添加新数据（避免累积已删除的文件）
      clearServerMediaCache(studentNameKey, 'photos');
      clearServerMediaCache(studentNameKey, 'videos');
      
      rememberServerMediaList(studentNameKey, 'photos', existingPhotos);
      rememberServerMediaList(studentNameKey, 'videos', existingVideos);
      // ✅ 僅渲染可辨識的圖像/影片檔案，避免誤用本地原始檔名造成 404
      // 🔥 修改：照片也可能是物件（新系統）或字串（舊系統）
      existingPhotos = existingPhotos.filter(function (item) {
        if (typeof item === 'string') return isImageFilename(item) && !isGeneratedThumbnailName(item);
        if (item && item.id) return true;  // 🔥 [修復] 新系統照片（使用 id 欄位）
        return false;
      });
      // 🔥 修改：影片可能是物件（新系統）或字串（舊系統）
      existingVideos = existingVideos.filter(function (item) { 
        if (typeof item === 'string') return isVideoFilename(item);
        if (item && item.id) return true;  // 🔥 [修復] 新系統影片（使用 id 欄位）
        return false;
      });
      base.existingCounts = base.existingCounts || { photos: 0, videos: 0, text: 0 };
      base.existingCounts.photos = existingPhotos.length;
      base.existingCounts.videos = existingVideos.length;
      base.existingCounts.text = normalizeComment(uploaded.comment || '').length;
      
      // 🔥 [修復 2025-01-XX] 智能快取渲染：只在內容改變時才重新渲染
      // 檢查容器的 data-render-hash 是否與新內容的哈希值相同
      
      if (photosPreview) {
        var currentPhotosHash = photosPreview.getAttribute('data-render-hash') || '';
        var needsPhotoRender = (currentPhotosHash !== photosHash);
        
        if (needsPhotoRender) {
          console.log('🔄 [applyExistingRecordToCard] 照片內容改變，重新渲染:', {
            student: student.name,
            oldHash: currentPhotosHash.substring(0, 20) + '...',
            newHash: photosHash.substring(0, 20) + '...',
            oldCount: photosPreview.children.length,
            newCount: existingPhotos.length
          });
          
          // 釋放所有 Blob URL
          Array.prototype.slice.call(photosPreview.querySelectorAll('.file-preview')).forEach(function(node) {
            revokePreviewObjectUrl(node);
          });
          photosPreview.innerHTML = '';
        existingPhotos.forEach(function (item) {
          // 🔥 [修復] 處理新系統照片（物件，使用 id 欄位）或舊系統照片（字串）
          // 🔥 也處理後端返回的物件格式（例如 {name: 'xxx.jpg', path: '...', size: ...}）
          var isNewSystem = (typeof item === 'object' && item !== null && item.id);
          var filename;
          if (typeof item === 'string') {
            filename = item;
          } else if (typeof item === 'object' && item !== null) {
            // 優先使用 filename，其次 name，最後 path
            filename = item.filename || item.name || item.path || '';
          } else {
            filename = String(item || '');
          }
          var photoId = isNewSystem ? item.id : null;
          
          // 建立 URL
          var url;
          if (isNewSystem) {
            // 新系統：使用縮圖 API（使用 coursePeriod）
            var coursePeriod = uploaded.coursePeriod || (currentCourse && currentCourse.coursePeriod) || '';
            var date = uploaded.date || (currentCourse && currentCourse.date) || '';
            // 🔥 [修復] 優先使用當前卡片的 student.name，避免 uploaded.studentName 錯誤導致照片錯配
            var studentName = (student && student.name) || uploaded.studentName || '';
            
            // 🔥 [重要] date 應該是完整資料夾名稱（包含主題），例如 "2025-11-05 四足獸"
            url = buildDrivePhotoPreviewUrl(photoId, uploaded, {
              date: date,
              studentName: studentName,
              coursePeriod: coursePeriod,
              courseName: courseNameHint,
              semester: semesterHint,
              relativePath: relativePathHint
            });
            console.log('📸 [主卡片-新系統] 照片縮圖:', { 
              photoId: photoId, 
              coursePeriod: coursePeriod, 
              date: date, 
              studentName: studentName, 
              url: url 
            });
          } else {
            // 舊系統：使用傳統 API
            url = buildRecordFileUrl(uploaded, filename);
          }
          
          var displayName = isNewSystem ? (item.originalName || filename) : filename;
          var removeHandler = "return deleteStudentFile(this, '" + String(student.name || '').replace(/'/g, "\\'") + "', '" + String(filename).replace(/'/g, "\\'") + "')";
          photosPreview.insertAdjacentHTML('beforeend', buildMediaPreviewHtml({
            type: 'image',
            previewUrl: url,
            filename: displayName,
            removable: true,
            removeHandler: removeHandler,
            lazy: false,
            forceReady: true,
            recordPath: relativePathHint || uploaded.relativePath || uploaded.recordPath || uploaded.path || '',
            extraClasses: ['synced-preview']  // 🔥 [修復 2025-11-23] 添加保留類別
          }));
        });
        
        // 🔥 [新增] 更新容器的哈希值標記
        photosPreview.setAttribute('data-render-hash', photosHash);
        console.log('✅ [快取] 照片容器已更新哈希值');
      } else {
        console.log('💾 [快取] 照片內容未改變，使用快取:', {
          student: student.name,
          hash: currentPhotosHash.substring(0, 20) + '...',
          nodeCount: photosPreview.children.length
        });
      }
      }
      
      // 🔥 影片渲染（與照片並列）
      if (videosPreview) {
        var currentVideosHash = videosPreview.getAttribute('data-render-hash') || '';
        var needsVideoRender = (currentVideosHash !== videosHash);
        
        if (needsVideoRender) {
          console.log('🔄 [applyExistingRecordToCard] 影片內容改變，重新渲染:', {
            student: student.name,
            oldHash: currentVideosHash.substring(0, 20) + '...',
            newHash: videosHash.substring(0, 20) + '...',
            oldCount: videosPreview.children.length,
            newCount: existingVideos.length
          });
          
          // 釋放所有 Blob URL
          Array.prototype.slice.call(videosPreview.querySelectorAll('.file-preview')).forEach(function(node) {
            revokePreviewObjectUrl(node);
          });
          videosPreview.innerHTML = '';
        
        var thumbMap = {};
        if (uploaded && uploaded.videoThumbnails && typeof uploaded.videoThumbnails === 'object') thumbMap = uploaded.videoThumbnails;
        else if (uploaded && uploaded.files && uploaded.files.videoThumbnails && typeof uploaded.files.videoThumbnails === 'object') thumbMap = uploaded.files.videoThumbnails;
        
        // 🔍 調試：輸出 thumbMap 內容
        console.log('🎬 [主卡片影片渲染] 學生:', student.name, {
          'thumbMap': thumbMap,
          'existingVideos': existingVideos
        });
        
        // 🔥 [最終修復] 過濾掉可能不存在的視頻（沒有縮略圖的新系統視頻）
        var validVideos = existingVideos.filter(function(item) {
          var isNewSystem = (typeof item === 'object' && item.id);
          if (!isNewSystem) return true; // 舊系統視頻保留
          
          // 🔥 [修復] 新系統視頻：即使 thumbnailFilename 為 null，也要保留（可能縮圖檔案存在但 meta 未更新）
          // 只過濾掉明確標記為失敗的視頻
          if (item.status === 'failed' || item.status === 'error') {
            console.log('⏭️ [過濾無效視頻] 跳過失敗視頻:', { id: item.id, filename: item.filename, status: item.status });
            return false;
          }
          
          return true;
        });
        
        console.log('🔍 [視頻過濾結果] 原始數量:', existingVideos.length, '過濾後:', validVideos.length);
        
        validVideos.forEach(function (item) {
          var isNewSystem = (typeof item === 'object' && item !== null && item.id);
          var filename;
          if (typeof item === 'string') {
            filename = item;
          } else if (typeof item === 'object' && item !== null) {
            filename = item.filename || item.name || item.path || '';
          } else {
            filename = String(item || '');
          }
          var normalizedMeta = isNewSystem ? normalizeVideoMeta(item) : null;
          var videoId = (normalizedMeta && normalizedMeta.id) || (isNewSystem ? item.id : null);
          var sourceFilename = (normalizedMeta && normalizedMeta.filename) || filename;
          
          // 建立影片 URL（優先使用 Drive 代理）
          var url = '';
          if (normalizedMeta) {
            url = resolveVideoMetaUrl(uploaded, normalizedMeta, false);
          }
          if (!url) {
            url = buildRecordFileUrl(uploaded, sourceFilename || filename);
          }
        if (!url && videoId) {
          console.warn('⚠️ [主卡片] 無法取得 Drive 代理，影片暫無法預覽:', { videoId: videoId });
        }
          
          var thumbUrl = '';
          var shouldShowPlaceholder = false;
          
          if (normalizedMeta) {
            thumbUrl = resolveVideoMetaUrl(uploaded, normalizedMeta, true) || '';
          }
          
          if (isNewSystem) {
            var videoStatus = item.status || 'unknown';
            var isProcessing = (
              videoStatus === 'queued' || 
              videoStatus === 'processing' || 
              videoStatus === 'transcoding' ||
              videoStatus === 'uploading'
            );
            
            if (!thumbUrl && item.thumbnailFilename) {
              thumbUrl = buildRecordFileUrl(uploaded, item.thumbnailFilename);
            }
            
            if (!thumbUrl) {
              if (isProcessing) {
                shouldShowPlaceholder = true;
                trackProcessingVideoStudent(student && student.name);
                console.log('⏳ [主卡片] 新系統影片縮圖尚未生成，顯示處理中圖標:', { 
                  videoId: videoId,
                  filename: item.filename,
                  status: videoStatus
                });
                scheduleProcessingVideosCheck();
              } else {
                shouldShowPlaceholder = true;
                console.log('⚠️ [主卡片] 新系統影片缺少縮圖，顯示預設圖示:', { 
                  videoId: videoId,
                  filename: item.filename,
                  status: videoStatus
                });
              }
            }
          } else {
            var thumbName = thumbMap && thumbMap[filename];
            thumbUrl = thumbName ? buildRecordFileUrl(uploaded, thumbName) : '';
            console.log('🎬 [主卡片] 舊系統影片:', {
              filename: filename,
              thumbName: thumbName,
              thumbUrl: thumbUrl,
              videoUrl: url
            });
          }
          
          // 🔥 [手機端修正] 統一使用硬編碼 forceReady: true, lazy: false
          var displayName = isNewSystem ? (item.originalName || filename) : filename;
          var removeHandler = "return deleteStudentFile(this, '" + String(student.name || '').replace(/'/g, "\\'") + "', '" + String(filename).replace(/'/g, "\\'") + "')";
          
          console.log('🎬 [主卡片-最終渲染] 影片:', {
            filename: displayName,
            previewUrl: url,
            thumbUrl: thumbUrl,
            lazy: false,
            forceReady: true,
            '手機端優化': '硬編碼 forceReady=true, lazy=false'
          });
          
          // 🔥 [修復] 不使用「處理中」SVG，讓 buildMediaPreviewHtml 自動處理沒有縮圖的情況
          // 當沒有縮圖時，會自動顯示 🎬 圖標（而不是「處理中」）
          var relatedVideoFiles = [];
          if (isNewSystem) {
            addRelatedFile(relatedVideoFiles, item.thumbnailFilename || (normalizedMeta && normalizedMeta.thumbnailFilename));
            addRelatedFile(relatedVideoFiles, item.transcodedFilename || (normalizedMeta && normalizedMeta.transcodedFilename));
          } else if (thumbName) {
            addRelatedFile(relatedVideoFiles, thumbName);
          }
          var recordPathForVideo = relativePathHint || uploaded.relativePath || uploaded.recordPath || uploaded.path || '';
          var videoPreviewHtml = buildMediaPreviewHtml({
            type: 'video',
            previewUrl: url,
            thumbUrl: thumbUrl,  // 🔥 直接使用 thumbUrl（可能為空）
            filename: displayName,
            sourceFilename: sourceFilename,
            removable: true,
            removeHandler: removeHandler,
            lazy: false,
            forceReady: true,  // 🔥 forceReady=true 會移除 loading spinner
            videoId: videoId,
            recordPath: recordPathForVideo,
            mediaId: videoId,
            relatedFiles: relatedVideoFiles,
            extraClasses: ['synced-preview']  // 🔥 [修復 2025-11-23] 添加保留類別
          });
          
          videosPreview.insertAdjacentHTML('beforeend', videoPreviewHtml);
          
          // 🔥 [新增] 為影片元素添加錯誤處理（404 時自動清除快取）
          try {
            var justInserted = videosPreview.lastElementChild;
            if (justInserted) {
              // 處理縮圖 404（只對有縮圖 URL 的影片）
              if (thumbUrl) {
                var thumbImg = justInserted.querySelector('img[src="' + thumbUrl.replace(/"/g, '\\"') + '"]');
                if (thumbImg && !thumbImg.__errorHandlerAdded) {
                  thumbImg.__errorHandlerAdded = true;
                  thumbImg.onerror = function() {
                    console.warn('⚠️ [縮圖404] 影片縮圖載入失敗，使用佔位符:', { videoId: videoId, thumbUrl: thumbUrl });
                    // 顯示影片圖標佔位符
                    this.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150"%3E%3Crect fill="%23ddd" width="200" height="150"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="40" fill="%23999"%3E%E2%96%B6%3C/text%3E%3C/svg%3E';
                    this.onerror = null;
                  };
                }
              }
              
              // 🔥 [新增] 處理影片本身 404（播放時才會觸發）
              var videoEl = justInserted.querySelector('video');
              if (videoEl && !videoEl.__errorHandlerAdded && isNewSystem) {
                videoEl.__errorHandlerAdded = true;
                videoEl.addEventListener('error', function(e) {
                  console.error('❌ [影片404] 影片載入失敗，可能已被刪除:', { 
                    videoId: videoId, 
                    url: url,
                    errorCode: this.error ? this.error.code : 'unknown'
                  });
                  
                  // 檢查是否是 404 錯誤
                  var is404 = this.error && (this.error.code === 4 || this.error.code === 2);
                  
                  if (is404) {
                    // 嘗試以更嚴格的編碼重建 URL 後重試一次
                    try {
                      var rebuilt = (function(){
                        try {
                          var a = document.createElement('a'); a.href = url;
                          // 將 path 以 / 分段後逐段 encodeURIComponent（保留 / ）
                          var parts = (a.pathname || '').split('/').map(function(seg){ return seg ? encodeURIComponent(decodeURIComponent(seg)) : ''; });
                          var newPath = parts.join('/');
                          var rebuiltUrl = (a.origin || '') + newPath + (a.search || '');
                          return rebuiltUrl;
                        } catch(_) { return url; }
                      })();
                      if (rebuilt && rebuilt !== url) {
                        console.log('🔁 [影片404] 使用重建 URL 重試一次:', rebuilt);
                        this.src = rebuilt;
                        this.load();
                        return; // 若仍錯誤會再次觸發 error 進入快取清理流程
                      }
                    } catch (_) {}
                    // 🔒 防止重複清除（如果已經在清除中，直接返回）
                    if (cacheClearInProgress) {
                      console.log('⏳ 快取清除已在進行中，跳過重複清除');
                      return;
                    }
                    
                    cacheClearInProgress = true;
                    console.log('🧹 [自動清除] 偵測到 404，立即清除快取並重新載入');
                    
                    // 🔥 [修復] 立即清除所有學習記錄快取
                    try {
                      // 清除 State 快取
                      if (window.FLB && FLB.State) {
                        FLB.State.set({ uploadedRecordsCache: null });
                        console.log('✅ State 快取已清除');
                      }
                      
                      // 清除 localStorage 快取
                      var cacheKey = 'lr_uploaded_';
                      var keysToRemove = [];
                      for (var i = 0; i < localStorage.length; i++) {
                        var key = localStorage.key(i);
                        if (key && key.indexOf(cacheKey) === 0) {
                          keysToRemove.push(key);
                        }
                      }
                      keysToRemove.forEach(function(key) {
                        localStorage.removeItem(key);
                      });
                      console.log('✅ localStorage 快取已清除:', keysToRemove.length, '個項目');
                      
                      // 重置快取時間戳
                      markUploadedCacheDirty('drive-404-refresh', true);
                      
                    } catch (cleanError) {
                      console.error('❌ 清除快取失敗:', cleanError);
                    }
                    
                    // 提示用戶
                    showToast('偵測到已刪除的影片，正在重新載入...', 'info');
                    
                    // 立即重新載入（不等待）
                    setTimeout(function() {
                      console.log('🔄 強制重新載入學習記錄 (Drive 404) ...');
                      try {
                        requestCourseReload({ force: true, showLoader: false, retryMissing: true, allowCacheBypass: true, reason: 'drive-404-refresh' });
                        setTimeout(function() {
                          cacheClearInProgress = false;
                          console.log('🔓 快取清除鎖定已解除');
                        }, 3000);
                      } catch (reloadError) {
                        console.error('❌ 重新載入失敗:', reloadError);
                        showToast('重新載入失敗，請手動重新整理頁面', 'error');
                        cacheClearInProgress = false;
                      }
                    }, 1000);
                  }
                }, { once: true });
              }
            }
          } catch (e) {
            console.warn('⚠️ [錯誤處理] 添加錯誤處理器失敗:', e);
          }
        });
        
        // 🔥 [新增] 更新容器的哈希值標記
        videosPreview.setAttribute('data-render-hash', videosHash);
        console.log('✅ [快取] 影片容器已更新哈希值');
        console.log('🎬 [主卡片影片渲染完成] 學生:', student.name, '影片數:', validVideos.length);
      } else {
        console.log('💾 [快取] 影片內容未改變，使用快取:', {
          student: student.name,
          hash: currentVideosHash.substring(0, 20) + '...',
          nodeCount: videosPreview.children.length
        });
      }
      }
      CommentSyncManager.hydrate(index, syncedCommentValue, { delay: 80 });
      // 視覺計數（指標/膠囊/0/3 0/1 0/20）
      var photoCountEl = document.getElementById('photo-count-' + index);
      var videoCountEl = document.getElementById('video-count-' + index);
      var commentCountEl = document.getElementById('comment-count-' + index);
      if (photoCountEl) photoCountEl.textContent = String(existingPhotos.length);
      if (videoCountEl) videoCountEl.textContent = String(existingVideos.length);
      if (commentCountEl) commentCountEl.textContent = String(normalizeComment(uploaded.comment || '').length);
      updateIndicator(index, 'photo', existingPhotos.length >= 3);
      updateIndicator(index, 'video', existingVideos.length >= 1);
      updateIndicator(index, 'comment', (uploaded.comment || '').trim().length >= 1);
      updateCapsule(index);
      try { updateDropZones(index); appendAddMoreButton(index, 'photos'); appendAddMoreButton(index, 'videos'); } catch (e) {}
      
      // 🔍 [調試] 檢查渲染後的狀態
      console.log('✅ [applyExistingRecordToCard] 渲染完成:', {
        index: index,
        student: student.name,
        photosPreviewChildren: photosPreview ? photosPreview.children.length : 0,
        videosPreviewChildren: videosPreview ? videosPreview.children.length : 0,
        existingPhotosCount: photosPreview ? photosPreview.querySelectorAll('.file-preview.existing, .file-preview.loaded').length : 0,
        newUploadPhotosCount: photosPreview ? photosPreview.querySelectorAll('.file-preview.new-upload').length : 0
      });
      try {
        if (photosPreview) {
          setupLazyMedia(photosPreview);
          attachThumbLoadingHandlers(photosPreview);
        }
        if (videosPreview) {
          setupLazyMedia(videosPreview);
          attachThumbLoadingHandlers(videosPreview);
          
          // 🔥 [修復] 只處理尚未生成縮圖的新影片（更嚴格的篩選）
          var needPosterVideos = videosPreview.querySelectorAll('.file-preview.new-upload[data-preview-type="video"]:not([data-poster-generated])');
          if (needPosterVideos.length > 0) {
            console.log('🎬 [applyExistingRecordToCard] 需生成縮圖的影片數量:', needPosterVideos.length);
            processPosterContainer(videosPreview);
          } else {
            console.log('⏭️ [applyExistingRecordToCard] 所有影片已有縮圖，跳過處理');
          }
        }
      } catch (e) {}
      
      base.photos = pendingPhotoFiles;
      base.videos = pendingVideoFiles;
      base.localFiles = base.localFiles || { photos: [], videos: [] };
      base.localFiles.photos = pendingLocalPhotos;
      base.localFiles.videos = pendingLocalVideos;
      
      console.log('✅ [applyExistingRecordToCard] 恢復待上傳檔案:', {
        student: student.name,
        pendingPhotoFiles: pendingPhotoFiles.length,
        pendingVideoFiles: pendingVideoFiles.length,
        basePhotos: base.photos.length,
        baseVideos: base.videos.length
      });
      
      try { checkUploadReady(index, { silent: true }); } catch (e) {}
    } catch (e) {
      console.error('❌ [applyExistingRecordToCard] 錯誤:', e);
    }
  }

  async function handleFileSelect(event, studentIndex, type) {
    try {
      // 🔒 輸入驗證：檢查參數有效性
      if (typeof studentIndex !== 'number' || studentIndex < 0) {
        console.error('❌ [handleFileSelect] 無效的學生索引:', studentIndex);
        showToast('無效的學生索引', 'error');
        return;
      }
      if (type !== 'photos' && type !== 'videos') {
        console.error('❌ [handleFileSelect] 無效的檔案類型:', type);
        showToast('無效的檔案類型', 'error');
        return;
      }
      
      var student = currentCourse && currentCourse.students ? currentCourse.students[studentIndex] : null;
      var entry = ensureStudentFileEntry(studentIndex, student || {});
      if (entry && entry.locked) {
        if (event && event.target) {
          try { event.target.value = ''; } catch (e) {}
        }
        showToast('該學生的上傳已鎖定', 'warning');
        return;
      }
      
      var incomingFiles = Array.prototype.slice.call((event.target && event.target.files) || []);
      console.log('🔍 [handleFileSelect] 學生', studentIndex, type, '- 接收到', incomingFiles.length, '個檔案');
      if (!incomingFiles.length) return;

      var validation = filterValidMediaFiles(incomingFiles, type);
      var files = validation.validFiles;
      if (validation.invalidMessages.length) {
        showToast('部分檔案無法處理：' + validation.invalidMessages.slice(0, 3).join('、'), 'warning');
      }
      if (!files.length) {
        console.warn('⚠️ [handleFileSelect] 沒有可用檔案（全部被過濾）');
        return;
      }
      try { if (event && event.target) event.target.value = ''; } catch (e) {}

      // 🧱 先建立暫存項目與預覽節點，確保 UI 即時顯示
      registerPendingMediaEntries(studentIndex, type, files);
      // 🔥 [修復 2025-11-17] 不在這裡調用 updateFilePreviews，避免重複創建預覽
      // SharedIntegration.handleStudentMediaSelect 的 onComplete 會調用它
      // updateFilePreviews(studentIndex, type);
      try {
        updateDropZones(studentIndex);
        appendAddMoreButton(studentIndex, type);
      } catch (zoneErr) {}
      var immediateCount = getTotalCount(studentIndex, type);
      var requiredCount = (type === 'photos' ? 3 : 1);
      updateIndicator(studentIndex, type === 'photos' ? 'photo' : 'video', immediateCount >= requiredCount);
      var countElIdBase = (type === 'photos' ? 'photo' : 'video') + '-count-' + studentIndex;
      var countElRef = document.getElementById(countElIdBase);
      if (countElRef) countElRef.textContent = String(immediateCount);

      // 🚀 [新增] 使用共用模組處理（優先）
      if (window.SharedIntegration && typeof window.SharedIntegration.handleStudentMediaSelect === 'function') {
        try {
          console.log('🎯 [handleFileSelect] 使用共用模組處理');

          await window.SharedIntegration.handleStudentMediaSelect({
            files: files,
            studentIndex: studentIndex,
            type: type,
            entry: entry,
            updatePreview: updateFilePreviews,
            checkUpload: function(idx) {
              try {
                checkUploadReady(idx, { silent: true });
              } catch (e) {
                console.warn('⚠️ 檢查上傳失敗:', e);
              }
            }
          });

          enqueuePendingUploads(studentIndex, type);
          
          // 最終同步
          try { delete lastSubmittedSnapshot[studentIndex]; } catch (e) {}

          resetUploadRetryState(studentIndex);
          checkUploadReady(studentIndex);
          
          if (typeof refreshProgress === 'function') refreshProgress();
          if (typeof renderBottomTabs === 'function') renderBottomTabs();
          
          // 記錄最近影片（供其他學生快速套用）
          if (type === 'videos' && entry.videos && entry.videos.length) {
            try { lastSharedVideoFiles = entry.videos.slice(-files.length); } catch (e) {}
            try { refreshSuggestionChipsAll(); } catch (e) {}
          }
          
          console.log('✅ [handleFileSelect] 共用模組處理完成');
          return; // 🔥 使用共用模組成功，提前返回
        } catch (sharedErr) {
          console.warn('⚠️ [handleFileSelect] 共用模組處理失敗，回退到原有邏輯:', sharedErr);
          // 繼續使用原有邏輯（作為備援）
          // 回退時重新使用原始 files 陣列
          entry[type] = entry[type] || [];
          // 🔥 [修復 2025-11-17] 回退時需要調用 updateFilePreviews
          updateFilePreviews(studentIndex, type);
        }
      }
      
      console.log('📋 [handleFileSelect] 有效檔案列表:', files.map(f => f.name + ' (' + (f.size / 1024 / 1024).toFixed(2) + ' MB)'));
    
      // 📊 計算總大小並檢查
      var totalSize = files.reduce(function(sum, f) { return sum + f.size; }, 0);
      var totalSizeMB = (totalSize / 1024 / 1024).toFixed(1);
      
      // 🔍 記憶體壓力檢查
      var memoryStatus = window.checkMemoryPressure && window.checkMemoryPressure();
      if (memoryStatus && memoryStatus.level === 'critical') {
        showToast('記憶體不足，請關閉其他應用程式後再試', 'error');
        if (event && event.target) {
          try { event.target.value = ''; } catch (e) {}
        }
        return;
      }
      
      if (memoryStatus && memoryStatus.level === 'high') {
        // 降級處理：減少批次大小
        var Config = window.LearningUploadConfig;
        if (Config && Config.set) {
          Config.set('processing.batchSize', 2);
          console.log('⚠️ 記憶體使用較高，已啟用省記憶體模式（批次大小: 2）');
        }
        showToast('記憶體使用較高，已啟用省記憶體模式', 'warning');
      }
      
      // ⚠️ 檔案大小警告（超過 200MB 需要確認）
      var Config = window.LearningUploadConfig;
      var confirmThreshold = (Config && Config.get('processing.fileSizeConfirmThreshold')) || (200 * 1024 * 1024);
      var warningThreshold = (Config && Config.get('processing.fileSizeWarningThreshold')) || (50 * 1024 * 1024);
      
      if (totalSize > confirmThreshold) {
        var confirmMsg = '您選擇的檔案總大小為 ' + totalSizeMB + ' MB，處理可能需要較長時間。是否繼續？';
        if (!confirm(confirmMsg)) {
          if (event && event.target) {
            try { event.target.value = ''; } catch (e) {}
          }
          return;
        }
      } else if (totalSize > warningThreshold) {
        showToast('處理 ' + totalSizeMB + ' MB 檔案中，請稍候...', 'info');
      }
    
      // 🚀 流式處理：逐個處理檔案，立即加入佇列（不等全部處理完）
      // 優點：1) 記憶體平滑 2) iCloud 逐個下載 3) 即時上傳
      var progressToastId = null;
      var showToastFn = window.FLB && window.FLB.UI && window.FLB.UI.toast;
      var showProgressFn = USE_GLOBAL_PROGRESS_TOAST && window.FLB && window.FLB.UI && window.FLB.UI.showProgressToast;
      var updateProgressFn = USE_GLOBAL_PROGRESS_TOAST && window.FLB && window.FLB.UI && window.FLB.UI.updateProgressToast;
      var hideProgressFn = USE_GLOBAL_PROGRESS_TOAST && window.FLB && window.FLB.UI && window.FLB.UI.hideProgressToast;
      
      var processedCount = 0;
      var totalFiles = files.length;
      
      // 顯示進度 Toast
      if (totalFiles > 3 && showProgressFn) {
        var title = type === 'photos' ? '處理照片' : '處理影片';
        progressToastId = showProgressFn(title, 0);
      }
      
      // ⚡ 逐個處理檔案（流式）
      for (var i = 0; i < files.length; i++) {
        try {
          var file = files[i];
          var fileName = file.name || ('file-' + i);
          var pendingMeta = file && file.__pendingMeta ? file.__pendingMeta : null;

          console.log('📦 [' + (i + 1) + '/' + totalFiles + '] 處理:', fileName);

          if (pendingMeta && pendingMeta.tempId) {
            if (window.PendingMediaStore) {
              PendingMediaStore.update(pendingMeta.tempId, { state: 'processing' });
            }
            if (window.PendingMediaActions) {
              PendingMediaActions.updateState(pendingMeta.tempId, 'processing', '壓縮中…');
            }
          }

          // 壓縮單個檔案
          var processedFile = file;
          if (type === 'photos') {
            try {
              processedFile = await compressImageIfNeeded(file);
            } catch (compressErr) {
              console.warn('⚠️ 壓縮失敗，使用原檔案:', fileName, compressErr);
              processedFile = file;
            }
          }
          
          // 立即更新 entry（不等後續檔案）
          processedFile.__pendingMeta = pendingMeta || processedFile.__pendingMeta || null;
          if (pendingMeta && typeof pendingMeta.entryIndex === 'number') {
            entry[type][pendingMeta.entryIndex] = processedFile;
          } else {
            entry[type].push(processedFile);
          }

          if (pendingMeta && pendingMeta.tempId) {
            if (window.PendingMediaStore) {
              PendingMediaStore.update(pendingMeta.tempId, { state: 'ready' });
            }
            if (window.PendingMediaActions) {
              PendingMediaActions.updateState(pendingMeta.tempId, 'ready', '等待上傳');
            }
          }
          
          // 更新計數
          processedCount++;
          var count = getTotalCount(studentIndex, type);
          var countElId = (type === 'photos' ? 'photo' : 'video') + '-count-' + studentIndex;
          var countEl = document.getElementById(countElId);
          if (countEl) countEl.textContent = String(count);
          
          // 更新進度
          if (progressToastId && updateProgressFn) {
            var pct = Math.round((processedCount / totalFiles) * 100);
            updateProgressFn(progressToastId, pct);
          }
          
          // 🎯 每處理一個就更新預覽與檢查上傳（不等全部）
          if (i % 3 === 0 || i === files.length - 1) {
            // 每 3 個或最後一個才更新 UI，避免頻繁重繪
            // 🔥 [修復] 使用共用預覽器渲染（流式處理）
            if (window.SharedMediaPreviewer) {
              try {
                var container = document.getElementById(type + '-preview-' + studentIndex);
                if (container) {
                  window.SharedMediaPreviewer.renderPreviews({
                    container: container,
                    files: entry[type],
                    clearExisting: false,
                    onRemove: function(idx) {
                      removeFile(studentIndex, type, idx);
                    }
                  });
                  
                  // 🔥 [統一 2025-11-19] 設置 data-file-id 並統一綁定
                  setTimeout(function() {
                    try {
                      var allPreviews = container.querySelectorAll('.file-preview.new-upload');
                      allPreviews.forEach(function(preview, pidx) {
                        if (!preview.getAttribute('data-file-id')) {
                          var fileIndex = preview.getAttribute('data-file-index') || pidx;
                          preview.setAttribute('data-file-id', 'file-' + studentIndex + '-' + type + '-' + fileIndex);
                        }
                        if (typeof window.ensureDeleteButtonWorks === 'function') {
                          window.ensureDeleteButtonWorks(preview);
                        }
                      });
                    } catch (bindErr) {
                      console.warn('⚠️ [流式處理] 統一綁定失敗:', bindErr);
                    }
                  }, 100); // 🔧 [統一 2025-11-19] 與 SharedIntegration 保持一致的延遲時間
                }
              } catch (err) {
                console.warn('⚠️ 流式處理渲染失敗，回退:', err);
                updateFilePreviews(studentIndex, type);
              }
            } else {
              updateFilePreviews(studentIndex, type);
            }
            updateIndicator(studentIndex, (type === 'photos' ? 'photo' : 'video'), count >= (type === 'photos' ? 3 : 1));
            
            // 🔄 同步草稿
            try {
              if (window.FLB && FLB.State) {
                var st = FLB.State.get();
                var drafts = Object.assign({}, st.drafts || {});
                drafts[String(studentIndex)] = Object.assign({}, drafts[String(studentIndex)] || {}, { 
                  comment: entry.comment, 
                  photos: entry.photos || [], 
                  videos: entry.videos || [] 
                });
                FLB.State.set({ drafts: drafts });
              }
            } catch (syncErr) {}
            
            // ⚡ 立即檢查是否可上傳（不等全部處理完）
            try {
              checkUploadReady(studentIndex, { silent: true });
              console.log('🔍 已檢查上傳條件（' + (i + 1) + '/' + totalFiles + '）');
            } catch (uploadCheckErr) {
              console.warn('⚠️ 檢查上傳失敗:', uploadCheckErr);
            }
          }
          
          // 🧹 批次間清理記憶體（每 5 個檔案）
          if ((i + 1) % 5 === 0 && i < files.length - 1) {
            if (window.LearningUploadCleanup) {
              try {
                window.LearningUploadCleanup.cleanup({ silent: true });
              } catch (cleanupErr) {}
            }
            // 給瀏覽器喘息時間（特別是 iCloud 下載）
            await new Promise(function(resolve) { setTimeout(resolve, 50); });
          }
          
        } catch (fileErr) {
          console.error('❌ 處理檔案失敗:', file && file.name, fileErr);
          // 失敗也要加入（使用原檔案），不中斷流程
          if (pendingMeta && typeof pendingMeta.entryIndex === 'number') {
            entry[type][pendingMeta.entryIndex] = file;
          } else {
            entry[type].push(file);
          }
          if (pendingMeta && pendingMeta.tempId) {
            if (window.PendingMediaStore) {
              PendingMediaStore.update(pendingMeta.tempId, { state: 'failed', error: fileErr && fileErr.message });
            }
            if (window.PendingMediaActions) {
              PendingMediaActions.updateState(pendingMeta.tempId, 'failed', (fileErr && fileErr.message) || '處理失敗');
            }
          }
          processedCount++;
        }
      }
      
      // 隱藏進度 Toast
      if (progressToastId && hideProgressFn) {
        hideProgressFn(progressToastId);
      }
      
      console.log('✅ [handleFileSelect] 流式處理完成，共處理', processedCount, '個檔案');

      enqueuePendingUploads(studentIndex, type);
      
      // 🧩 記錄最近一次影片（供其他學生快速套用）
      if (type === 'videos' && entry.videos && entry.videos.length) {
        try { 
          lastSharedVideoFiles = entry.videos.slice(-files.length); // 只記錄本次新增的
        } catch (e) {}
        try { refreshSuggestionChipsAll(); } catch (e) {}
      }
      
      // 最終更新
      try { delete lastSubmittedSnapshot[studentIndex]; } catch (e) {}
      
      // 🔥 [修復] 使用共用預覽器渲染（備援邏輯）
      if (window.SharedMediaPreviewer && entry[type].length > 0) {
        try {
          var container = document.getElementById(type + '-preview-' + studentIndex);
          if (container) {
            console.log('🎨 [handleFileSelect 備援] 使用共用預覽器渲染');
            window.SharedMediaPreviewer.renderPreviews({
              container: container,
              files: entry[type],
              clearExisting: false, // 🔥 關鍵：不清除現有預覽
              onRemove: function(index) {
                removeFile(studentIndex, type, index);
              }
            });
            
            // 🔥 [統一 2025-11-19] 備援邏輯也需要設置 data-file-id 並統一綁定
            setTimeout(function() {
              try {
                var allPreviews = container.querySelectorAll('.file-preview.new-upload');
                console.log('🔧 [handleFileSelect 備援] 設置 data-file-id 並統一綁定:', allPreviews.length, '個預覽');
                
                allPreviews.forEach(function(preview, idx) {
                  // 設置 data-file-id
                  if (!preview.getAttribute('data-file-id')) {
                    var fileIndex = preview.getAttribute('data-file-index') || idx;
                    var fileId = 'file-' + studentIndex + '-' + type + '-' + fileIndex;
                    preview.setAttribute('data-file-id', fileId);
                  }
                  
                  // 統一綁定刪除按鈕
                  if (typeof window.ensureDeleteButtonWorks === 'function') {
                    window.ensureDeleteButtonWorks(preview);
                  }
                });
                
                console.log('✅ [handleFileSelect 備援] data-file-id 設置完成並已統一綁定');
              } catch (bindErr) {
                console.warn('⚠️ [handleFileSelect 備援] 統一綁定失敗:', bindErr);
              }
            }, 100); // 🔧 [統一 2025-11-19] 與 SharedIntegration 保持一致的延遲時間
          }
        } catch (previewErr) {
          console.warn('⚠️ [handleFileSelect 備援] 渲染預覽失敗，回退到 updateFilePreviews:', previewErr);
          updateFilePreviews(studentIndex, type);
        }
      } else {
        // 如果共用預覽器不可用，使用原始方法
        updateFilePreviews(studentIndex, type);
      }
      
      resetUploadRetryState(studentIndex);
      checkUploadReady(studentIndex); // 檢查是否可立即上傳
      
      // 刷新進度
      try {
        if (typeof refreshProgress === 'function') refreshProgress();
        if (typeof renderBottomTabs === 'function') renderBottomTabs();
      } catch (err) {
        console.error('❌ [handleFileSelect] 最終同步失敗:', err);
      }
    } catch (error) {
      console.error('❌ [handleFileSelect] 處理檔案選擇時發生錯誤:', error);
      showToast('處理檔案時發生錯誤: ' + (error.message || '未知錯誤'), 'error');
      if (event && event.target) {
        try { event.target.value = ''; } catch (e) {}
      }
    }
  }

  // ====== 快速套用建議（上一個影片 / 上一則評語） ======
  function renderSuggestionChips(index) {
    try {
      var videosPreview = document.getElementById('videos-preview-' + index);
      var commentArea = document.getElementById('comment-' + index);
      if (!(window.FLB && FLB.State)) return;
      var st = FLB.State.get();
      var student = st && Array.isArray(st.students) ? st.students[index] : null;
      if (!student) return;
      ensureStudentFileEntry(index, student);
      var base = studentFiles[index];
      var existing = base.existingCounts || {};

      // 影片建議：當前未有影片且有全域最近影片
      if (videosPreview) {
        var hasVideoNow = (Array.isArray(base.videos) && base.videos.length > 0) || (existing.videos || 0) > 0;
        var chipId = 'chip-apply-video-' + index;
        var old = document.getElementById(chipId);
        if (hasVideoNow || !lastSharedVideoFiles || lastSharedVideoFiles.length === 0) {
          if (old) old.remove();
        } else {
          if (!old) {
            var html = '<button id="' + chipId + '" class="nav-btn" style="margin-top:8px;display:inline-flex;gap:8px;align-items:center"><i class="fas fa-paperclip"></i> 套用上一個影片</button>';
            videosPreview.insertAdjacentHTML('beforebegin', html);
            old = document.getElementById(chipId);
          }
          if (old && !old.__bound) {
            old.__bound = true;
            old.addEventListener('click', function () {
              try {
                base.videos = (base.videos || []).concat(lastSharedVideoFiles);
                
                // 🔥 [修復] 使用共用預覽器渲染，避免清除已上傳的預覽
                if (window.SharedMediaPreviewer) {
                  try {
                    var container = document.getElementById('videos-preview-' + index);
                    if (container) {
                      window.SharedMediaPreviewer.renderPreviews({
                        container: container,
                        files: base.videos,
                        clearExisting: false,
                        onRemove: function(idx) {
                          removeFile(index, 'videos', idx);
                        }
                      });
                      
                      // 🔥 [統一 2025-11-19] 設置 data-file-id 並統一綁定
                      setTimeout(function() {
                        try {
                          var allPreviews = container.querySelectorAll('.file-preview.new-upload');
                          allPreviews.forEach(function(preview, vidx) {
                            if (!preview.getAttribute('data-file-id')) {
                              var fileIndex = preview.getAttribute('data-file-index') || vidx;
                              preview.setAttribute('data-file-id', 'file-' + index + '-videos-' + fileIndex);
                            }
                            if (typeof window.ensureDeleteButtonWorks === 'function') {
                              window.ensureDeleteButtonWorks(preview);
                            }
                          });
                        } catch (bindErr) {
                          console.warn('⚠️ [套用上一個影片] 統一綁定失敗:', bindErr);
                        }
                      }, 100); // 🔧 [統一 2025-11-19] 與 SharedIntegration 保持一致的延遲時間
                    }
                  } catch (err) {
                    console.warn('⚠️ 套用上一個影片渲染失敗，回退:', err);
                    updateFilePreviews(index, 'videos');
                  }
                } else {
                  updateFilePreviews(index, 'videos');
                }
                
                resetUploadRetryState(index);
                checkUploadReady(index);
                // 草稿同步
                if (window.FLB && FLB.State) {
                  var st2 = FLB.State.get();
                  var drafts2 = Object.assign({}, st2.drafts || {});
                  drafts2[String(index)] = Object.assign({}, drafts2[String(index)] || {}, { comment: base.comment, photos: base.photos || [], videos: base.videos || [] });
                  FLB.State.set({ drafts: drafts2 });
                }
                try { refreshProgress(); renderBottomTabs(); } catch (e) {}
              } catch (e) { console.warn('套用影片失敗', e); }
            });
          }
        }

        // 影片模板入口（永遠顯示，方便管理）
        var manageVidId = 'chip-manage-video-templates-' + index;
        var mgv = document.getElementById(manageVidId);
        if (!mgv) {
          var htmlV = '<button id="' + manageVidId + '" class="nav-btn" style="margin:8px 8px 0 0;display:inline-flex;gap:8px;align-items:center"><i class="fas fa-film"></i> 影片模板</button>';
          videosPreview.insertAdjacentHTML('beforebegin', htmlV);
          mgv = document.getElementById(manageVidId);
        }
        if (mgv && !mgv.__bound) {
          mgv.__bound = true;
          mgv.addEventListener('click', function(){ try { openVideoTemplatesPanel(); } catch (e) {} });
        }
      }

      // 評語建議：顯示「套用上一則」與「附加上一則」
      if (commentArea) {
        var tpl = (lastCommentTemplate || '').trim();
        var chipApplyId = 'chip-apply-comment-' + index;
        var chipAppendId = 'chip-append-comment-' + index;
        var oldApply = document.getElementById(chipApplyId);
        var oldAppend = document.getElementById(chipAppendId);
        if (!tpl) {
          if (oldApply) oldApply.remove();
          if (oldAppend) oldAppend.remove();
        } else {
          if (!oldApply) {
            var htmlApply = '<button id="' + chipApplyId + '" class="nav-btn" style="margin:8px 8px 0 0;display:inline-flex;gap:8px;align-items:center"><i class="fas fa-quote-right"></i> 套用上一則評語</button>';
            commentArea.insertAdjacentHTML('beforebegin', htmlApply);
            oldApply = document.getElementById(chipApplyId);
          }
          if (!oldAppend) {
            var htmlAppend = '<button id="' + chipAppendId + '" class="nav-btn" style="margin:8px 0 0;display:inline-flex;gap:8px;align-items:center"><i class="fas fa-plus"></i> 附加上一則評語</button>';
            commentArea.insertAdjacentHTML('beforebegin', htmlAppend);
            oldAppend = document.getElementById(chipAppendId);
          }
          if (oldApply && !oldApply.__bound) {
            oldApply.__bound = true;
            oldApply.addEventListener('click', function(){
              try {
                commentArea.value = tpl;
                var evt = new Event('input', { bubbles: true });
                commentArea.dispatchEvent(evt);
                commentArea.focus();
              } catch (e) { console.warn('套用評語失敗', e); }
            });
          }
          if (oldAppend && !oldAppend.__bound) {
            oldAppend.__bound = true;
            oldAppend.addEventListener('click', function(){
              try {
                var cur = String(commentArea.value || '');
                var next = cur ? (cur.replace(/\s+$/,'') + '\n' + tpl) : tpl;
                commentArea.value = next;
                var evt = new Event('input', { bubbles: true });
                commentArea.dispatchEvent(evt);
                commentArea.focus();
              } catch (e) { console.warn('附加評語失敗', e); }
            });
          }
        }

        // 管理模板入口（永遠顯示在評語上方，避免找不到）
        var manageId = 'chip-manage-templates-' + index;
        var mg = document.getElementById(manageId);
        if (!mg) {
          var html3 = '<button id="' + manageId + '" class="nav-btn" style="margin:8px 8px 0 0;display:inline-flex;gap:8px;align-items:center"><i class="fas fa-folder-open"></i> 評語模板</button>';
          commentArea.insertAdjacentHTML('beforebegin', html3);
          mg = document.getElementById(manageId);
        }
        if (mg && !mg.__bound) {
          mg.__bound = true;
          mg.addEventListener('click', function(){ try { openCommentTemplatesPanel(); } catch (e) {} });
        }
      }
    } catch (e) {}
  }
  function refreshSuggestionChipsAll() {
    try {
      if (!(window.FLB && FLB.State)) return;
      var st = FLB.State.get();
      if (!st || !Array.isArray(st.students)) return;
      for (var i = 0; i < st.students.length; i++) {
        if (document.getElementById('student-' + i)) renderSuggestionChips(i);
      }
    } catch (e) {}
  }

  function revokePreviewObjectUrl(node) {
    if (!node) return;
    var objectUrl = node.getAttribute('data-object-url');
    if (objectUrl) {
      var overlayActive = previewOverlayEl && previewOverlayEl.classList.contains('open') && objectUrl === currentOverlayUrl;
      if (overlayActive) {
        pendingOverlayRevokes.add(objectUrl);
      } else {
        try { URL.revokeObjectURL(objectUrl); } catch (err) { console.warn('⚠️ 無法釋放預覽 URL:', err); }
      }
      if (!overlayActive) node.removeAttribute('data-object-url');
    }
    
    // 🔥 [修復] 清除所有媒體元素的事件監聽器和 src，防止 404 錯誤
    var allMedia = node.querySelectorAll('img, video');
    allMedia.forEach(function(media) {
      try {
        // 清除 onerror handler（防止觸發 SmartPosterGenerator）
        if (media.onerror) {
          media.onerror = null;
        }
        
        // 清除 onload handler
        if (media.onload) {
          media.onload = null;
        }
        
        // 如果是 video，暫停並清除 src
        if (media.tagName === 'VIDEO') {
          if (typeof media.pause === 'function') media.pause();
          media.removeAttribute('src');
          // 清除所有 source 子元素
          var sources = media.querySelectorAll('source');
          sources.forEach(function(source) {
            source.removeAttribute('src');
          });
        } else if (media.tagName === 'IMG') {
          // 如果是 img，清除 src 和 data-src（懶加載）
          media.removeAttribute('src');
          media.removeAttribute('data-src');
        }
        
        // 重新載入以清除緩衝
        if (typeof media.load === 'function') media.load();
      } catch (err) {
        console.warn('⚠️ 清理媒體元素失敗:', err);
      }
    });
  }

  /**
   * 清理舊的預覽（積極釋放 Blob URL）
   * @param {HTMLElement} container - 預覽容器
   */
  function cleanupOldPreviews(container) {
    if (!container) return;
    
    var oldPreviews = container.querySelectorAll('[data-blob-url], [data-object-url]');
    var cleanedCount = 0;
    
    oldPreviews.forEach(function(el) {
      var blobUrl = el.getAttribute('data-blob-url') || el.getAttribute('data-object-url');
      if (blobUrl && blobUrl.startsWith('blob:')) {
        // 使用 BlobURLManager 釋放
        if (window.LearningUploadBlobURL) {
          try {
            window.LearningUploadBlobURL.release(blobUrl, true);
            cleanedCount++;
          } catch (e) {}
        } else {
          // 降級：直接釋放
          try {
            URL.revokeObjectURL(blobUrl);
            cleanedCount++;
          } catch (e) {}
        }
      }
    });
    
    if (cleanedCount > 0) {
      console.log('🧹 清理了', cleanedCount, '個 Blob URL');
    }
  }

  function updateFilePreviews(studentIndex, type) {
    console.log('🎨 [updateFilePreviews] 被調用:', { studentIndex: studentIndex, type: type, stack: new Error().stack.split('\n')[2] });
    var previewContainer = document.getElementById(type + '-preview-' + studentIndex);
    var files = studentFiles[studentIndex][type] || [];
    if (!previewContainer) {
      console.log('⚠️ [updateFilePreviews] 預覽容器不存在');
      return;
    }
    
    console.log('🔍 [updateFilePreviews] 開始前狀態:', {
      containerChildren: previewContainer.children.length,
      existingCount: previewContainer.querySelectorAll('.file-preview.existing, .file-preview.loaded').length,
      newUploadCount: previewContainer.querySelectorAll('.file-preview.new-upload').length,
      filesCount: files.length
    });
    
    // 🔥 [修復] 保存已上傳的檔案預覽節點，避免被清除
    // ⚠️ [修復 2025-11-18] 排除 .new-upload 節點，因為它們會被清理並重新創建
    var existingNodes = Array.prototype.slice.call(previewContainer.querySelectorAll('.file-preview.existing, .file-preview.loaded')).filter(function(node) {
      return !node.classList.contains('new-upload');
    });
    console.log('💾 [updateFilePreviews] 保存', existingNodes.length, '個已上傳的預覽節點（已排除 new-upload）');
    
    // 🧹 清理舊的 Blob URL（只清理新上傳的），釋放記憶體
    var newUploadNodes = previewContainer.querySelectorAll('.file-preview.new-upload[data-blob-url], .file-preview.new-upload[data-object-url]');
    newUploadNodes.forEach(function(el) {
      var blobUrl = el.getAttribute('data-blob-url') || el.getAttribute('data-object-url');
      if (blobUrl && blobUrl.startsWith('blob:')) {
        try {
          if (window.LearningUploadBlobURL) {
            window.LearningUploadBlobURL.release(blobUrl, true);
          } else {
            URL.revokeObjectURL(blobUrl);
          }
        } catch (e) {}
      }
    });
    
    // 🔒 安全：使用 escapeHtml 函數（如果可用）
    var escapeHtml = (global.FLB && global.FLB.Course && global.FLB.Course.escapeHtml) || 
                     function(str) { return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); };
    
    // 先移除舊的 + 按鈕
    Array.prototype.slice.call(previewContainer.querySelectorAll('.add-more-btn')).forEach(function (n) { try { n.remove(); } catch (e) {} });
    
    // 🔥 [修復 2025-11-17] 只清理舊的預覽，保留已上傳和新建的
    Array.prototype.slice.call(previewContainer.querySelectorAll('.file-preview.new-upload')).forEach(function (node) {
      // ⚠️ 若此縮圖已標記為「等待與伺服器同步」（已上傳但尚未取得正式檔名），先保留，避免畫面消失
      var awaiting = node.getAttribute('data-awaiting-sync') === '1';
      if (awaiting) return;
      revokePreviewObjectUrl(node);
      node.remove();
    });
    
    // 🔒 安全：使用 DocumentFragment 和 DOM API 而非 innerHTML，避免 XSS
    // 📊 漸進式渲染：大量檔案時分批處理，避免卡頓
    var Config = window.LearningUploadConfig;
    var initialPreviewCount = (Config && Config.get('processing.initialPreviewCount')) || 5;
    var shouldUseDeferredRendering = files.length > initialPreviewCount;
    
    var fragment = document.createDocumentFragment();
    var filesToRenderNow = shouldUseDeferredRendering ? files.slice(0, initialPreviewCount) : files;
    var filesToRenderLater = shouldUseDeferredRendering ? files.slice(initialPreviewCount) : [];
    
    // 📸 立即渲染前幾個預覽（或全部，如果不多）
    filesToRenderNow.forEach(function (file, fileIndex) {
      // 🔥 [修復 2025-11-18] 跳過已上傳的檔案，避免重複創建預覽
      // 已上傳的檔案已有 .existing 預覽，會被保存並重新插入
      if (file.__uploaded) {
        console.log('⏭️ [updateFilePreviews] 跳過已上傳檔案:', file.name);
        return;
      }
      
      // 🔥 [修復 2025-11-17] 重用已存在的 blob URL 避免重複創建
      var url;
      var fileId = 'file-' + studentIndex + '-' + type + '-' + fileIndex;
      var isVideo = (type === 'videos');
      var isPhoto = (type === 'photos');
      
      // 🔥 [修復 2025-11-27] 添加唯一上傳 ID 用於重複檢測
      // 使用檔案大小 + 檔案名稱 hash + 索引確保唯一性，即使檔案被重新命名也能匹配
      var fileNameHash = (file.name || '').split('').reduce(function(a, b) {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      var uploadId = 'upload-' + (file.size || 0) + '-' + Math.abs(fileNameHash) + '-' + fileIndex;
      file.__uploadId = uploadId;
      
      // 🔥 重用已存在的 URL
      if (file.__objectUrl && typeof file.__objectUrl === 'string') {
        url = file.__objectUrl;
        console.log('♻️ [updateFilePreviews] 重用已存在的 blob URL:', file.name);
      } 
      // 🔥 照片：異步生成縮圖
      else if (isPhoto && window.thumbnailGenerator) {
        // 先使用佔位符，異步生成縮圖後更新
        url = ''; // 先設為空，稍後更新
        file.__thumbnailPending = true;
        console.log('🖼️ [updateFilePreviews] 開始生成縮圖:', file.name);
        
        // 異步生成縮圖
        window.thumbnailGenerator.generate(file).then(function(thumbnailUrl) {
          file.__objectUrl = thumbnailUrl;
          file.__thumbnailPending = false;
          // 更新 img 的 src
          var img = document.querySelector('#' + fileId + ' img');
          if (img) {
            img.src = thumbnailUrl;
            img.classList.remove('loading');
            console.log('✅ [updateFilePreviews] 縮圖已載入:', file.name);
          }
        }).catch(function(err) {
          console.error('❌ [updateFilePreviews] 縮圖生成失敗，降級到原圖:', file.name, err);
          // 降級：使用原圖
          var fallbackUrl = URL.createObjectURL(file);
          file.__objectUrl = fallbackUrl;
          file.__thumbnailPending = false;
          var img = document.querySelector('#' + fileId + ' img');
          if (img) {
            img.src = fallbackUrl;
            img.classList.remove('loading');
          }
        });
      }
      // 🔥 影片或不支援縮圖：直接使用原檔案
      else {
        url = URL.createObjectURL(file);
        file.__objectUrl = url;
        console.log('🆕 [updateFilePreviews] 創建新的 blob URL:', file.name);
      }
      var pendingMeta = file.__pendingMeta || null;
      // 🔥 [修復 2025-11-16] 確保一定有 tempId
      var tempId = (pendingMeta && pendingMeta.tempId) || ('fallback-' + Date.now() + '-' + Math.random().toString(36).slice(2));
      
      if (pendingMeta) {
        file.__pendingMeta.objectUrl = url;
        pendingMeta.objectUrl = url;
        // 確保 tempId 存在
        if (!pendingMeta.tempId) {
          pendingMeta.tempId = tempId;
          file.__pendingMeta.tempId = tempId;
        }
        persistPendingPreviewMeta(studentIndex, type, pendingMeta, file, url);
      } else {
        // 沒有 pendingMeta，創建一個最小的
        file.__pendingMeta = {
          tempId: tempId,
          studentIndex: studentIndex,
          type: type,
          fileName: file.name,
          state: 'queued',
          objectUrl: url
        };
      }
      
      // 使用 DOM API 創建元素，避免 XSS
      var previewDiv = document.createElement('div');
      previewDiv.className = 'file-preview new-upload loading preview-clickable';
      previewDiv.setAttribute('data-temp', '1');
      previewDiv.setAttribute('data-file-id', fileId);
      previewDiv.setAttribute('data-object-url', url);
      previewDiv.setAttribute('data-preview-type', isVideo ? 'video' : 'image');
      previewDiv.setAttribute('data-preview-url', url);
      previewDiv.setAttribute('data-file-name', file.name); // 🔥 添加文件名用於降級查找
      // 🔥 [修復 2025-11-27] 添加唯一上傳 ID 用於重複檢測
      previewDiv.setAttribute('data-upload-id', uploadId);
      // 🔥 [修復 2025-11-16] 始終設置 data-temp-id
      previewDiv.setAttribute('data-temp-id', tempId);
      previewDiv.setAttribute('data-pending-state', 'queued');
      previewDiv.classList.add('pending');
      
      console.log('✅ [創建預覽] 已設置 data-temp-id:', {
        tempId: tempId,
        fileName: file.name,
        hasPendingMeta: !!pendingMeta
      });
      markPreviewForLocalPreserve(previewDiv);
      
      if (isVideo) {
        var video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.setAttribute('playsinline', '');
        video.setAttribute('preload', 'metadata');
        video.setAttribute('crossorigin', 'anonymous');
        previewDiv.appendChild(video);
        
        var posterImg = document.createElement('img');
        posterImg.className = 'video-poster';
        posterImg.src = '';
        posterImg.alt = '';
        posterImg.setAttribute('aria-hidden', 'true');
        posterImg.style.display = 'none';
        previewDiv.appendChild(posterImg);
        
        var fallbackIcon = document.createElement('div');
        fallbackIcon.className = 'video-fallback-icon';
        fallbackIcon.setAttribute('aria-hidden', 'true');
        fallbackIcon.style.display = 'none';
        fallbackIcon.textContent = '🎬';
        previewDiv.appendChild(fallbackIcon);
      } else {
        var img = document.createElement('img');
        img.src = url;
        img.alt = '預覽';
        img.setAttribute('decoding', 'async');
        previewDiv.appendChild(img);
      }
      
      // 🔥 [簡化 2025-11-23] 直接刪除旋轉載入指示器，避免 CSS 禁用複雜性
      // 不再創建 .thumb-loading 元素，直接設置為已載入狀態
      previewDiv.classList.add('loaded');
      if (window.SharedPreviewRenderer) {
        try {
          window.SharedPreviewRenderer.ensureOverlay(previewDiv);
          window.SharedPreviewRenderer.setProgress(previewDiv, 0, '等待上傳');
        } catch (e) {}
      }
      
      // 🔥 [修復 2025-11-18] 先添加 overlay，再添加刪除按鈕（確保按鈕在最上層）
      var overlay = document.createElement('div');
      overlay.className = 'file-uploading-overlay';
      // 🔥 關鍵：確保 overlay 不阻擋點擊（除非是 uploading 狀態）
      overlay.style.pointerEvents = 'none';
      var progressText = document.createElement('span');
      progressText.className = 'progress-text';
      progressText.textContent = getPendingStatusLabel(pendingMeta);
      overlay.appendChild(progressText);
      var progressBar = document.createElement('div');
      progressBar.className = 'file-upload-progress';
      var progressFill = document.createElement('div');
      progressFill.className = 'file-upload-progress-fill';
      progressBar.appendChild(progressFill);
      overlay.appendChild(progressBar);
      previewDiv.appendChild(overlay);
      
      // 🔥 刪除按鈕在 overlay 之後添加，確保在 DOM 樹最上層
      var removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.type = 'button';
      // 🔥 [修復 2025-11-18] 使用 setAttribute 设置 onclick，调用全局 window.removeFile
      removeBtn.setAttribute('onclick', 'return window.removeFile(' + studentIndex + ', "' + type + '", ' + fileIndex + ');');
      removeBtn.__boundDeleteHandler = true; // 標記已綁定
      var removeIcon = document.createElement('i');
      removeIcon.className = 'fas fa-times';
      removeBtn.appendChild(removeIcon);
      previewDiv.appendChild(removeBtn);
      
      console.log('✅ [創建刪除按鈕] 已綁定:', {
        fileId: 'file-' + studentIndex + '-' + type + '-' + fileIndex,
        onclick: removeBtn.getAttribute('onclick'),
        zIndex: window.getComputedStyle(removeBtn).zIndex
      });
      
      fragment.appendChild(previewDiv);
      
      // 🔥 [修復 2025-11-18] 立即綁定 JavaScript 事件監聽器（不依賴 inline onclick）
      ensureDeleteButtonWorks(previewDiv);
      
      if (isVideo) {
        try { generatePosterForFile(file, previewDiv, url); } catch (posterErr) { console.warn('💡 產生影片預覽失敗', posterErr); }
      }
    });
    
    previewContainer.appendChild(fragment);
    
    // 🔥 [修復 2025-11-18] 移除重複的克隆綁定邏輯
    // 刪除按鈕已在創建時使用 IIFE 正確綁定，無需再次處理
    console.log('✅ [updateFilePreviews] 刪除按鈕已在創建時綁定，共', filesToRenderNow.length, '個預覽');
    
    // 🌀 新增縮圖載入指示器並綁定事件
    try { attachThumbLoadingHandlers(previewContainer); } catch (e) {}
    
    // 🔥 立即生成影片縮圖（學生卡片選擇影片）
    if (type === 'videos') {
      try {
        processPosterContainer(previewContainer);
      } catch (e) {
        console.warn('⚠️ [學生卡片-選擇影片] 智能縮圖生成失敗:', e);
      }
    }
    
    // 更新 DropZone 顯示狀態並在縮圖後加上 + 按鈕
    try { updateDropZones(studentIndex); appendAddMoreButton(studentIndex, type); } catch (e) {}
    
    // 🔥 [修復] 重新插入已上傳的檔案預覽節點（確保它們不會被清除）
    if (existingNodes.length > 0) {
      console.log('✅ [updateFilePreviews] 重新插入', existingNodes.length, '個已上傳的預覽節點');
      existingNodes.forEach(function(node) {
        // 將已上傳的預覽插入到容器開頭（在新上傳的預覽之前）
        if (node.parentNode !== previewContainer) {
          previewContainer.insertBefore(node, previewContainer.firstChild);
        }
      });
    }
    
    // ⏱️ 延遲渲染剩餘預覽（使用 requestIdleCallback）
    if (filesToRenderLater.length > 0) {
      console.log('⏱️ 延遲渲染剩餘', filesToRenderLater.length, '個預覽...');
      
      var renderDeferredPreviews = function() {
        var deferredFragment = document.createDocumentFragment();
        
        filesToRenderLater.forEach(function(file, idx) {
          // 🔥 [修復 2025-11-18] 跳過已上傳的檔案，避免重複創建預覽
          if (file.__uploaded) {
            console.log('⏭️ [延遲渲染] 跳過已上傳檔案:', file.name);
            return;
          }
          
          var fileIndex = initialPreviewCount + idx; // 實際索引
          var url = URL.createObjectURL(file);
          var isVideo = (type === 'videos');
          var fileId = 'file-' + studentIndex + '-' + type + '-' + fileIndex;
          var pendingMeta = file.__pendingMeta || null;
          // 🔥 [修復 2025-11-16] 確保一定有 tempId
          var tempId = (pendingMeta && pendingMeta.tempId) || ('fallback-defer-' + Date.now() + '-' + Math.random().toString(36).slice(2));
          
          if (pendingMeta) {
            file.__pendingMeta.objectUrl = url;
            pendingMeta.objectUrl = url;
            // 確保 tempId 存在
            if (!pendingMeta.tempId) {
              pendingMeta.tempId = tempId;
              file.__pendingMeta.tempId = tempId;
            }
            persistPendingPreviewMeta(studentIndex, type, pendingMeta, file, url);
          } else {
            // 沒有 pendingMeta，創建一個最小的
            file.__pendingMeta = {
              tempId: tempId,
              studentIndex: studentIndex,
              type: type,
              fileName: file.name,
              state: 'queued',
              objectUrl: url
            };
          }
          
        var previewDiv = document.createElement('div');
        previewDiv.className = 'file-preview new-upload loading preview-clickable';
        previewDiv.setAttribute('data-temp', '1');
        previewDiv.setAttribute('data-file-id', fileId);
        previewDiv.setAttribute('data-object-url', url);
        previewDiv.setAttribute('data-preview-type', isVideo ? 'video' : 'image');
        previewDiv.setAttribute('data-preview-url', url);
        previewDiv.setAttribute('data-file-name', file.name); // 🔥 添加文件名用於降級查找
        // 🔥 [修復 2025-11-16] 始終設置 data-temp-id
        previewDiv.setAttribute('data-temp-id', tempId);
        previewDiv.setAttribute('data-pending-state', 'queued');
        previewDiv.classList.add('pending');
        markPreviewForLocalPreserve(previewDiv);
          
          if (isVideo) {
            var video = document.createElement('video');
            video.src = url;
            video.muted = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('preload', 'metadata');
            video.setAttribute('crossorigin', 'anonymous');
            previewDiv.appendChild(video);
            
            var posterImg = document.createElement('img');
            posterImg.className = 'video-poster';
            posterImg.src = '';
            posterImg.alt = '';
        posterImg.setAttribute('aria-hidden', 'true');
            posterImg.style.display = 'none';
            previewDiv.appendChild(posterImg);
            
            var fallbackIcon = document.createElement('div');
            fallbackIcon.className = 'video-fallback-icon';
            fallbackIcon.setAttribute('aria-hidden', 'true');
            fallbackIcon.style.display = 'none';
            fallbackIcon.textContent = '🎬';
            previewDiv.appendChild(fallbackIcon);
          } else {
            var img = document.createElement('img');
            img.src = url;
            img.alt = '預覽';
            img.setAttribute('decoding', 'async');
            img.setAttribute('loading', 'lazy'); // 延遲載入圖片
            previewDiv.appendChild(img);
          }
          
          // 🔥 [簡化 2025-11-23] 直接刪除旋轉載入指示器，直接設置為已載入狀態
          previewDiv.classList.add('loaded');
          
          // 🔥 [修復 2025-11-18] 統一使用共用預覽覆蓋層建立與控制（先添加 overlay）
          try {
            if (window.SharedPreviewRenderer) {
              var ensure = window.SharedPreviewRenderer.ensureOverlay(previewDiv);
              var label = getPendingStatusLabel(pendingMeta) || '等待上傳';
              window.SharedPreviewRenderer.setProgress(previewDiv, 0, label);
            } else {
              var helpers = ensureFilePreviewOverlay(previewDiv);
              if (helpers && helpers.progressText) {
                helpers.progressText.textContent = getPendingStatusLabel(pendingMeta) || '等待上傳';
              }
              // 🔥 確保 overlay 不阻擋點擊
              if (helpers && helpers.overlay) {
                helpers.overlay.style.pointerEvents = 'none';
              }
            }
          } catch (e) {}
          
          // 🔥 [修復 2025-11-18] 刪除按鈕在 overlay 之後添加，確保在最上層
          var removeBtn = document.createElement('button');
          removeBtn.className = 'remove-btn';
          removeBtn.type = 'button';
          // 🔥 [修復 2025-11-18] 使用 setAttribute 统一绑定方式，调用全局 window.removeFile
          removeBtn.setAttribute('onclick', 'return window.removeFile(' + studentIndex + ', "' + type + '", ' + fileIndex + ');');
          removeBtn.__boundDeleteHandler = true;
          var removeIcon = document.createElement('i');
          removeIcon.className = 'fas fa-times';
          removeBtn.appendChild(removeIcon);
          previewDiv.appendChild(removeBtn);
          
          console.log('✅ [延遲渲染-刪除按鈕] 已綁定:', {
            fileId: fileId,
            onclick: removeBtn.getAttribute('onclick')
          });
          
          deferredFragment.appendChild(previewDiv);
          
          // 🔥 [修復 2025-11-18] 立即綁定 JavaScript 事件監聽器（不依賴 inline onclick）
          ensureDeleteButtonWorks(previewDiv);
          
          if (isVideo) {
            try { generatePosterForFile(file, previewDiv, url); } catch (posterErr) { console.warn('💡 產生影片預覽失敗', posterErr); }
          }
        });
        
        if (previewContainer) {
          previewContainer.appendChild(deferredFragment);
          try { attachThumbLoadingHandlers(previewContainer); } catch (e) {}
          
          // 🔥 延遲渲染的影片也需要生成縮圖
          if (type === 'videos') {
            try {
              processPosterContainer(previewContainer);
            } catch (e) {
              console.warn('⚠️ [學生卡片-延遲渲染] 智能縮圖生成失敗:', e);
            }
          }
        }
        
        console.log('✅ 延遲渲染完成');
      };
      
      // 使用 requestIdleCallback 或降級為 setTimeout（並加上保險 timeout）
      var deferredCalled = false;
      var fireDeferred = function () {
        if (deferredCalled) return;
        deferredCalled = true;
        try { renderDeferredPreviews(); } catch (e) { console.warn('⚠️ 延遲渲染失敗', e); }
      };
      if ('requestIdleCallback' in window) {
        requestIdleCallback(function(){ fireDeferred(); }, { timeout: 250 });
        setTimeout(fireDeferred, 200);
      } else {
        setTimeout(fireDeferred, 120);
      }
    }
  }

  function updateDropZones(index) {
    try {
      var tp = getTotalCount(index, 'photos');
      var tv = getTotalCount(index, 'videos');
      var photoZone = document.querySelector('[data-student="' + index + '"][data-type="photos"]');
      var videoZone = document.querySelector('[data-student="' + index + '"][data-type="videos"]');
      if (photoZone) photoZone.style.display = tp > 0 ? 'none' : '';
      if (videoZone) videoZone.style.display = tv > 0 ? 'none' : '';
    } catch (e) {}
  }

  function appendAddMoreButton(index, type) {
    var container = document.getElementById(type + '-preview-' + index);
    if (!container) return;
    var tp = getTotalCount(index, 'photos');
    var tv = getTotalCount(index, 'videos');
    var hideCurrent = type === 'photos' ? tp > 0 : tv > 0;
    if (!hideCurrent) return; // 只有當該類型已選擇檔案時才需要 +
    var btnId = type + '-add-' + index;
    if (document.getElementById(btnId)) return;
    
    // 🔒 安全：使用 DOM API 而非 innerHTML
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'add-more-btn';
    btn.id = btnId;
    btn.setAttribute('aria-label', '新增' + (type === 'photos' ? '照片' : '影片'));
    btn.onclick = function() { return triggerAddFile(index, type); };
    var icon = document.createElement('i');
    icon.className = 'fas fa-plus';
    btn.appendChild(icon);
    container.appendChild(btn);
  }

  function triggerAddFile(studentIndex, type) {
    var input = document.getElementById(type + '-' + studentIndex);
    if (input) input.click();
    return false;
  }

  // 🔥 [新增 2025-11-17] 確保刪除按鈕事件正常工作
  function ensureDeleteButtonWorks(node) {
    try {
      var removeBtn = node.querySelector('.remove-btn');
      if (!removeBtn) return;
      
      // 🔥 強制重新綁定，不管是否已綁定
      // if (removeBtn.__boundDeleteHandler) return;
      
      // 從 data-file-id 獲取資訊
      var fileId = node.getAttribute('data-file-id');
      if (!fileId) return;
      
      var parts = fileId.split('-');
      if (parts.length < 4) return;
      
      // 🔥 [統一 2025-11-19] 支持兩種格式：
      // 1. 學生頁面: file-0-photos-0 (file-studentIndex-type-fileIndex)
      // 2. 課程總覽: file-overview-photos-0 (file-overview-type-fileIndex)
      var isOverview = (parts[1] === 'overview');
      var studentIndex, type, fileIndex;
      
      if (isOverview) {
        // 課程總覽格式: file-overview-photos-0
        type = parts[2];
        fileIndex = parseInt(parts[3]);
        studentIndex = -1; // 標記為課程總覽
      } else {
        // 學生頁面格式: file-0-photos-0
        studentIndex = parseInt(parts[1]);
        type = parts[2];
        fileIndex = parseInt(parts[3]);
      }
      
      // 移除舊的事件監聽器
      var newBtn = removeBtn.cloneNode(true);
      removeBtn.parentNode.replaceChild(newBtn, removeBtn);
      
      // 🔥 [統一 2025-11-19] 根據類型綁定不同的刪除函數
      if (isOverview) {
        // 課程總覽：調用 removeOverviewPhoto 或 removeOverviewVideo
        newBtn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('🔥 [刪除按鈕-課程總覽] 觸發刪除:', fileId, '\u985e型:' + type, '\u7d22引:' + fileIndex);
          
          if (type === 'photos') {
            return removeOverviewPhoto(fileIndex);
          } else if (type === 'videos') {
            return removeOverviewVideo(fileIndex);
          }
        };
      } else {
        // 學生頁面：調用 removeFile
        newBtn.onclick = function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('🔥 [刪除按鈕-學生頁] 觸發刪除:', fileId, '\u5b78生:' + studentIndex, '\u985e型:' + type, '\u7d22引:' + fileIndex);
          return removeFile(studentIndex, type, fileIndex);
        };
      }
      
      // 標記已綁定
      newBtn.__boundDeleteHandler = true;
      
      console.log('✅ [刪除按鈕] 事件已重新綁定:', fileId, isOverview ? '(課程總覽)' : '(學生頁)');
    } catch (e) {
      console.warn('⚠️ [刪除按鈕] 事件綁定失敗:', e);
    }
  }
  
  // 🔥 [修復 2025-11-17] 立即暴露給全域，讓 SharedIntegration 和其他模組可以使用
  window.ensureDeleteButtonWorks = ensureDeleteButtonWorks;
  console.log('🔧 [初始化] ensureDeleteButtonWorks 已暴露到 window');
  
  // 🔥 [新增 2025-11-17] 重新綁定刪除按鈕事件
  function rebindRemoveButton(newNode, originalNode) {
    try {
      // 從原始節點獲取資訊
      var fileId = originalNode.getAttribute('data-file-id') || newNode.getAttribute('data-file-id');
      if (!fileId) return;
      
      // 解析 fileId 格式：file-studentIndex-type-fileIndex
      var parts = fileId.split('-');
      if (parts.length < 4) return;
      
      var studentIndex = parseInt(parts[1]);
      var type = parts[2];
      var fileIndex = parseInt(parts[3]);
      
      var removeBtn = newNode.querySelector('.remove-btn');
      if (removeBtn) {
        // 重新綁定點擊事件
        removeBtn.onclick = function() { 
          return removeFile(studentIndex, type, fileIndex); 
        };
        console.log('✅ [重新綁定] 刪除按鈕事件已重新綁定:', fileId);
      }
    } catch (e) {
      console.warn('⚠️ [重新綁定] 刪除按鈕事件綁定失敗:', e);
    }
  }
  
  function removeFile(studentIndex, type, fileIndex) {
    console.log('🔥 [刪除檔案] 開始刪除:', studentIndex, type, fileIndex);
    
    // 🛡️ 防御性检查
    if (!studentFiles[studentIndex]) {
      console.error('❌ [刪除檔案] 學生不存在:', studentIndex);
      return false;
    }
    
    var list = (studentFiles[studentIndex][type] || []);
    var removed = list[fileIndex];
    list.splice(fileIndex, 1);
    if (removed) {
      clearPendingMeta(removed);
    }
    reindexPendingEntries(list);
    
    // 🔥 [修復] updateFilePreviews 已經有保護機制，會保留已上傳的預覽
    updateFilePreviews(studentIndex, type);
    
    try { updateDropZones(studentIndex); appendAddMoreButton(studentIndex, type); } catch (e) {}
    var count = getTotalCount(studentIndex, type);
    var required = (type === 'photos' ? 3 : 1);
    var countElId = (type === 'photos' ? 'photo' : 'video') + '-count-' + studentIndex;
    var countEl = document.getElementById(countElId);
    if (countEl) countEl.textContent = String(count);
    updateIndicator(studentIndex, (type === 'photos' ? 'photo' : 'video'), count >= required);
    resetUploadRetryState(studentIndex);
    checkUploadReady(studentIndex);
    // 🔄 草稿同步與進度刷新
    try {
      if (window.FLB && FLB.State) {
        var st = FLB.State.get();
        var drafts = Object.assign({}, st.drafts || {});
        drafts[String(studentIndex)] = Object.assign({}, drafts[String(studentIndex)] || {}, { comment: studentFiles[studentIndex].comment, photos: studentFiles[studentIndex].photos || [], videos: studentFiles[studentIndex].videos || [] });
        FLB.State.set({ drafts: drafts });
      }
      if (typeof refreshProgress === 'function') refreshProgress();
      if (typeof renderBottomTabs === 'function') renderBottomTabs();
    } catch (err) { }
    // 🔄 即時同步至抽屜/已上傳記錄
    try {
      if (window.FLB && FLB.State) {
        var stNow = FLB.State.get();
        var studentsArr = stNow && Array.isArray(stNow.students) ? stNow.students : [];
        var targetStudent = studentsArr[studentIndex];
        if (targetStudent) mergeLocalUploadedRecord(studentIndex, targetStudent);
      }
    } catch (e) {}
    return false;
  }

  // ==================== 📊 個別檔案上傳進度追蹤 ====================
  
  // 📊 更新個別檔案上傳進度
  function updateFileUploadProgress(studentIndex, type, fileIndex, progress) {
    var fileId = 'file-' + studentIndex + '-' + type + '-' + fileIndex;
    var filePreview = document.querySelector('[data-file-id="' + fileId + '"]');
    if (!filePreview) return;
    var overlayHelpers = ensureFilePreviewOverlay(filePreview);
    var safeProgress = Number(progress);
    if (!isFinite(safeProgress)) safeProgress = 0;
    safeProgress = Math.max(0, Math.min(100, safeProgress));

    if (safeProgress > 0 && safeProgress < 100) {
      filePreview.classList.add('uploading');
      filePreview.classList.remove('upload-success', 'upload-error');
    }

    setPreviewProgress(filePreview, safeProgress);

    var progressText = (overlayHelpers && overlayHelpers.progressText) || filePreview.querySelector('.progress-text');
    if (progressText) {
      if (safeProgress >= 100) {
        progressText.textContent = '完成';
      } else if (safeProgress <= 2) {
        progressText.textContent = '準備中';
      } else {
        progressText.textContent = Math.round(safeProgress) + '%';
      }
    }

    if (safeProgress >= 100) {
      setTimeout(function () {
        filePreview.classList.remove('uploading');
        filePreview.classList.remove('upload-error');
        filePreview.classList.add('upload-success');
        
        // 🔥 [一進一出 2025-11-27] 移除固定延遲，改為事件驅動
        // 本地預覽將在 Drive 版本渲染完成後立即移除
        console.log('✅ [上傳完成] 本地預覽等待 Drive 版本回填後移除:', {
          fileName: filePreview.getAttribute('data-file-name'),
          uploadId: filePreview.getAttribute('data-upload-id')
        });
        
        // 🔥 [修復 2025-11-18] 立即隱藏 overlay，避免遮擋刪除按鈕
        if (overlayHelpers && overlayHelpers.overlay) {
          overlayHelpers.overlay.style.transition = 'opacity 0.3s ease-out';
          overlayHelpers.overlay.style.opacity = '0';
          overlayHelpers.overlay.style.pointerEvents = 'none';
          setTimeout(function() {
            // 🔥 [修復 2025-11-18] 不設定 inline style，由 CSS 控制
            // overlayHelpers.overlay.style.display = 'none';
            console.log('✅ [進度條-100%] overlay 已隱藏');
          }, 300);
        }
      }, 120);
    }
  }

  // 📊 根據整體進度模擬個別檔案進度
  function simulateIndividualFileProgress(studentIndex, overallProgress) {
    try {
      var photos = (studentFiles[studentIndex] && studentFiles[studentIndex].photos) || [];
      var videos = (studentFiles[studentIndex] && studentFiles[studentIndex].videos) || [];
      if (!photos.length && !videos.length) return;

      // 計算總檔案大小（缺值時使用預設）
      var totalSize = 0;
      var fileSizes = {};

      photos.forEach(function (file, idx) {
        var size = Math.max(1, file.size || 1024 * 1024);
        fileSizes['photos-' + idx] = size;
        totalSize += size;
      });

      videos.forEach(function (file, idx) {
        var size = Math.max(1, file.size || 10 * 1024 * 1024);
        fileSizes['videos-' + idx] = size;
        totalSize += size;
      });

      if (totalSize <= 0) {
        photos.forEach(function (_file, idx) { updateFileUploadProgress(studentIndex, 'photos', idx, overallProgress); });
        videos.forEach(function (_file, idx) { updateFileUploadProgress(studentIndex, 'videos', idx, overallProgress); });
        return;
      }

      var uploadedSize = totalSize * (Math.max(0, overallProgress) / 100);
      var currentSize = 0;
      var minimalProgress = overallProgress > 0 ? Math.min(15, Math.max(5, overallProgress)) : 0;

      photos.forEach(function (file, idx) {
        var fileSize = fileSizes['photos-' + idx];
        var fileProgress = 0;

        if (currentSize + fileSize <= uploadedSize) {
          fileProgress = 100;
        } else if (currentSize < uploadedSize) {
          fileProgress = ((uploadedSize - currentSize) / fileSize) * 100;
        }

        fileProgress = Math.max(0, Math.min(100, fileProgress));
        if (fileProgress > 0 && fileProgress < minimalProgress) fileProgress = minimalProgress;
        if (overallProgress < 100) fileProgress = Math.min(fileProgress, 99);
        updateFileUploadProgress(studentIndex, 'photos', idx, fileProgress);
        currentSize += fileSize;
      });

      videos.forEach(function (file, idx) {
        var fileSize = fileSizes['videos-' + idx];
        var fileProgress = 0;

        if (currentSize + fileSize <= uploadedSize) {
          fileProgress = 100;
        } else if (currentSize < uploadedSize) {
          fileProgress = ((uploadedSize - currentSize) / fileSize) * 100;
        }

        fileProgress = Math.max(0, Math.min(100, fileProgress));
        if (fileProgress > 0 && fileProgress < minimalProgress) fileProgress = minimalProgress;
        if (overallProgress < 100) fileProgress = Math.min(fileProgress, 99);
        updateFileUploadProgress(studentIndex, 'videos', idx, fileProgress);
        currentSize += fileSize;
      });
    } catch (e) {
      console.error('📊 模擬個別檔案進度失敗:', e);
    }
  }

  // 📊 重置所有檔案上傳狀態
  function resetFileUploadStates(studentIndex) {
    ['photos', 'videos'].forEach(function(type) {
      var container = document.getElementById(type + '-preview-' + studentIndex);
      if (!container) return;
      var previews = container.querySelectorAll('.file-preview.new-upload');
      previews.forEach(function(preview) {
        preview.classList.add('uploading');
        preview.classList.remove('upload-success', 'upload-error');
        var progressFill = preview.querySelector('.file-upload-progress-fill');
        if (progressFill) progressFill.style.width = '4px'; // 5% of 70px = 3.5px ≈ 4px
        var progressText = preview.querySelector('.progress-text');
        if (progressText) progressText.textContent = '準備中';
      });
    });
  }

  function primeStudentUploadPreview(studentIndex) {
    if (studentIndex === OVERVIEW_UPLOAD_INDEX) return;
    var key = String(studentIndex);
    if (previewProgressPrimed[key]) return;
    previewProgressPrimed[key] = true;
    resetFileUploadStates(studentIndex);
  }

  // 📊 標記所有檔案上傳失敗
  function markAllFilesUploadError(studentIndex) {
    ['photos', 'videos'].forEach(function(type) {
      var files = (studentFiles[studentIndex] && studentFiles[studentIndex][type]) || [];
      files.forEach(function(file, idx) {
        var fileId = 'file-' + studentIndex + '-' + type + '-' + idx;
        var filePreview = document.querySelector('[data-file-id="' + fileId + '"]');
        if (!filePreview) return;
        filePreview.classList.remove('uploading', 'upload-success');
        filePreview.classList.add('upload-error');
        var progressText = filePreview.querySelector('.progress-text');
        if (progressText) progressText.textContent = '上傳失敗';
        var progressFill = filePreview.querySelector('.file-upload-progress-fill');
        if (progressFill) progressFill.style.width = '70px'; // 100% = 70px
      });
    });
  }

  function updateIndicator(studentIndex, indicatorType, isComplete) {
    var indicator = document.getElementById(indicatorType + '-indicator-' + studentIndex);
    if (!indicator) return;
    if (isComplete) indicator.classList.add('complete'); else indicator.classList.remove('complete');
    updateCapsule(studentIndex);
  }

  function checkUploadReady(studentIndex, opts) {
    var ready = isUploadReady(studentIndex);
    var pending = hasPendingChanges(studentIndex);
    var btn = document.getElementById('upload-btn-' + studentIndex);
    var base = studentFiles[studentIndex] || {};
    if (btn) {
      btn.classList.remove('locked');
    }
    if (base.locked) {
      cancelAutoUpload(studentIndex);
      if (btn) {
        btn.disabled = true;
        btn.classList.add('locked');
        if (!btn.classList.contains('success') && !btn.classList.contains('error')) {
          btn.innerHTML = '<i class="fas fa-lock"></i> 上傳已鎖定';
        }
      }
      updateCapsule(studentIndex);
      if (!(opts && opts.silent)) {
        try { renderBottomTabs(); } catch (e) {}
      }
      return;
    }
    if (btn) {
      if (uploadingStudents[studentIndex]) {
        btn.disabled = true;
      } else {
        btn.disabled = !(ready);
        if (!btn.classList.contains('success') && !btn.classList.contains('error')) {
          if (!pending) {
            btn.innerHTML = '<i class="fas fa-robot"></i> 系統自動上傳';
          } else if (ready) {
            btn.innerHTML = '<i class="fas fa-robot"></i> 排程自動上傳';
          } else {
            btn.innerHTML = '<i class="fas fa-robot"></i> 系統自動上傳';
          }
        }
      }
    }
    updateCapsule(studentIndex);
    var skipAuto = !!(opts && opts.skipAuto);
    if (ready && pending) {
      if (!skipAuto) {
        scheduleAutoUpload(studentIndex);
      }
    } else {
      cancelAutoUpload(studentIndex);
    }
    if (!(opts && opts.silent)) {
      try { renderBottomTabs(); } catch (e) {}
    }
  }

  function updateCapsule(index) {
    try {
      var base = studentFiles[index] || {};
      var existing = base.existingCounts || { photos: 0, videos: 0, text: 0 };
      var photosCount = (base.photos ? base.photos.length : 0) + (existing.photos || 0);
      var videosCount = (base.videos ? base.videos.length : 0) + (existing.videos || 0);
      var textLen = (base.comment ? base.comment.length : 0);
      // 若已有既存評論，取較長者（以達 20 字需求）
      if ((existing.text || 0) > textLen) textLen = existing.text || 0;
      var capP = document.getElementById('cap-photo-' + index);
      var capV = document.getElementById('cap-video-' + index);
      var capT = document.getElementById('cap-text-' + index);
      if (capP) capP.querySelector('.v').textContent = String(Math.min(photosCount, 3));
      if (capV) capV.querySelector('.v').textContent = String(Math.min(videosCount, 1));
      if (capT) capT.querySelector('.v').textContent = String(Math.min(textLen, 20));
      var pctPhotos = Math.min(1, photosCount / 3);
      var pctVideos = Math.min(1, videosCount / 1);
      var pctText = Math.min(1, textLen / 20);
      var percent = Math.round((pctPhotos + pctVideos + pctText) / 3 * 100);
      var bar = document.getElementById('cap-bar-' + index);
      var fill = bar && bar.querySelector('.fill');
      if (fill) fill.style.width = String(percent) + '%';
      setCapsulePercentIdle(index, percent);
    } catch (e) {}
  }

  async function uploadStudentRecord(studentIndex) {
    var student = currentCourse && currentCourse.students && currentCourse.students[studentIndex];
    if (!student || !currentCourse) return;
    var entry = ensureStudentFileEntry(studentIndex, student);
    if (entry && entry.locked) {
      console.warn('⚠️ 學生上傳已鎖定，略過:', student.name || ('#' + studentIndex));
      return;
    }

    var btn = await new Promise(function(resolve) {
      updateDOMAsync(function() {
        var button = document.getElementById('upload-btn-' + studentIndex);
        if (!button) {
          button = { classList: { add: function(){}, remove: function(){}, contains: function(){ return false; } }, disabled: false, innerHTML: '' };
        }
        resolve(button);
      }, 0);
    });

    if (uploadingStudents[studentIndex]) return;
    if (!hasPendingChanges(studentIndex) && !btn.disabled) return;

    if (!uploadRetryCount[studentIndex]) uploadRetryCount[studentIndex] = 0;
    if (uploadRetryCount[studentIndex] >= MAX_UPLOAD_RETRIES) {
      console.error('❌ 學生', student.name, '已達到重試上限', MAX_UPLOAD_RETRIES, '次，停止自動上傳');
      updateDOMAsync(function() {
        btn.classList.add('error');
        btn.innerHTML = '<i class="fas fa-ban"></i> 已達重試上限，請檢查網路';
        btn.disabled = true;
      }, 0);
      showToast(student.name + ' 上傳失敗次數過多，已停止自動重試', 'error');
      return;
    }

    cancelAutoUpload(studentIndex);
    uploadingStudents[studentIndex] = true;
    var baseState = studentFiles[studentIndex] || (studentFiles[studentIndex] = { photos: [], videos: [], comment: '', baselineComment: '', syncedComment: '' });
    var pendingComment = baseState.comment || '';
    var commentChanged = hasCommentChanged(baseState);

    var releaseButtonToIdle = function() {
      updateDOMAsync(function() {
        btn.classList.remove('uploading');
        btn.classList.remove('error');
        if (!uploadingStudents[studentIndex]) {
          btn.innerHTML = '<i class="fas fa-robot"></i> 系統自動上傳';
          btn.disabled = false;
        }
      }, 0);
    };

    try {
      await new Promise(function(resolve) {
        updateDOMAsync(function() {
          btn.classList.remove('error');
          btn.classList.remove('success');
          btn.classList.add('uploading');
          btn.disabled = true;
          btn.innerHTML = '<span class="loading"></span> 同步中…';
          resolve();
        }, 0);
      });

      var mediaSummary = collectPendingMediaSummary(studentIndex);
      var readyMediaIds = mediaSummary.ready.map(function(item) { return item.mediaId; });
      var hasReadyMedia = readyMediaIds.length > 0;

      if (mediaSummary.failed.length > 0) {
        mediaSummary.failed.forEach(function(item) {
          if (item.meta) item.meta.enqueued = false;
          if (window.PendingMediaActions && item.tempId) {
            PendingMediaActions.updateState(item.tempId, 'ready', '重新排隊…');
          }
        });
        enqueuePendingUploads(studentIndex, 'photos');
        enqueuePendingUploads(studentIndex, 'videos');
        updateDOMAsync(function() {
          btn.classList.remove('uploading');
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-sync"></i> 重新排隊中…';
        }, 0);
        showToast((student.name || '') + ' 有 ' + mediaSummary.failed.length + ' 個檔案需要重新上傳，已重新排隊', 'warning');
        scheduleAutoUpload(studentIndex);
        return;
      }

      if (mediaSummary.pending.length > 0) {
        updateDOMAsync(function() {
          btn.classList.remove('uploading');
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-hourglass-half"></i> 等待媒體 ' + mediaSummary.pending.length + ' 個檔案';
        }, 0);
        scheduleAutoUpload(studentIndex);
        return;
      }

      var shouldSubmit = commentChanged || hasReadyMedia;
      if (!shouldSubmit) {
        releaseButtonToIdle();
        return;
      }

      // 🎯 啟動學生檔案進度動畫（避免僅顯示遮罩而無進度）
      try { startStudentProgressAnimation(studentIndex); } catch (e) {}

      var opMeta = buildRecordOperationMeta(student.name);
      var parsed = global.FLB.Course.parseTitle(currentCourse.title || '');
      var parsedCourse = parsed && parsed.courseName ? parsed.courseName : '';
      var parsedPeriodRaw = parsed && parsed.period ? parsed.period : '';
      var courseValue = (opMeta.course || currentCourse.courseName || parsedCourse || '').trim();
      if (!courseValue) {
        courseValue = (parsedCourse || (currentCourse.title || '').split(' ')[0] || 'COURSE').trim();
      }
      var periodValue = (opMeta.period || parsedPeriodRaw.replace(/\s+/g, '') || '').trim();
      if (!periodValue) {
        var derivedPeriod = opMeta.coursePeriod ? opMeta.coursePeriod.split('-').slice(1).join('-') : '';
        periodValue = (derivedPeriod || parsedPeriodRaw.replace(/\s+/g, '') || '0000').trim();
      }
      var dateValue = opMeta.date || (currentCourse.start ? formatDateTWISO(new Date(currentCourse.start)) : '');
      if (!dateValue) {
        throw new Error('缺少日期資訊，無法儲存');
      }

      var payload = {
        course: courseValue,
        period: periodValue,
        date: dateValue,
        studentName: String(student.name || student.studentName || ''),
        comment: normalizeComment(pendingComment),
        mediaIds: readyMediaIds,
        coursePeriod: opMeta.coursePeriod,
        relativePath: opMeta.relativePathUnified || opMeta.relativePath || ''
      };

      try { lastSubmittedSnapshot[studentIndex] = computeChangeSnapshot(studentIndex); } catch (e) {}

      await global.FLB.Api.saveRecordMetadata(payload);
      uploadRetryCount[studentIndex] = 0;
      lastAutoUploadAt[studentIndex] = Date.now();

      var uploadedPhotoCount = mediaSummary.ready.filter(function(item) { return item.type === 'photos'; }).length;
      var uploadedVideoCount = mediaSummary.ready.filter(function(item) { return item.type === 'videos'; }).length;
      try {
        if (typeof mergeLocalUploadedRecord === 'function' && student) {
          mergeLocalUploadedRecord(studentIndex, student);
        }
      } catch (mergeErr) {
        console.warn('⚠️ [uploadStudentRecord] mergeLocalUploadedRecord 失敗:', mergeErr);
      }

      // 🔥 [修復 2025-11-18] 标记文件为已上传，保留引用但清理元数据
      // 这样既支持删除操作，又不会造成内存泄漏
      baseState.existingCounts = baseState.existingCounts || { photos: 0, videos: 0, text: 0 };
      if (uploadedPhotoCount) baseState.existingCounts.photos = (baseState.existingCounts.photos || 0) + uploadedPhotoCount;
      if (uploadedVideoCount) baseState.existingCounts.videos = (baseState.existingCounts.videos || 0) + uploadedVideoCount;
      
      // 标记所有文件为已上传状态，但保留引用
      mediaSummary.ready.forEach(function(item) {
        if (item.file) {
          item.file.__uploaded = true; // 标记为已上传
          // 清理 Blob URL 避免内存泄漏
          if (item.file.__pendingMeta && item.file.__pendingMeta.objectUrl) {
            try {
              // 🔥 [修復 2025-11-21] 如果這個 blob URL 正被 localFiles 使用（由 mergeLocalUploadedRecord 設置），則不要釋放
              // 這是為了解決手機端上傳後，預覽變為空白的問題（因為本地預覽仍依賴此 Blob URL）
              if (item.file.__objectUrl === item.file.__pendingMeta.objectUrl) {
                console.log('♻️ [uploadStudentRecord] 保留 Blob URL 供本地預覽使用:', item.file.__objectUrl);
              } else {
                URL.revokeObjectURL(item.file.__pendingMeta.objectUrl);
              }
            } catch (e) {}
          }
        }
      });
      
      // 🔥 [修復 2025-11-18] 立即同步到 State，避免数据丢失
      if (typeof syncStateToManager === 'function') {
        try {
          syncStateToManager();
          console.log('✅ [上传成功] 已同步 studentFiles 到 State');
        } catch (e) {
          console.warn('⚠️ [上传成功] State 同步失败:', e);
        }
      }
      
      if (commentChanged) {
        markCommentSynced(studentIndex, pendingComment);
      }

      mediaSummary.ready.forEach(function(item) {
        clearPendingMeta(item.file, { removeElement: false });
      });

      updateDOMAsync(function() {
        btn.classList.remove('uploading');
        btn.classList.add('success');
        btn.innerHTML = '<i class="fas fa-check"></i> 已完成';
      }, 0);
      try { stopStudentProgressAnimation(studentIndex, true); } catch (e) {}
      showToast((student.name || '') + ' 的紀錄已同步', 'success');

      setTimeout(function() {
        updateDOMAsync(function() {
          btn.classList.remove('success');
          btn.disabled = true;
          btn.innerHTML = '<i class="fas fa-robot"></i> 系統自動上傳';
        }, 0);
      }, 2400);

      try { updateFilePreviews(studentIndex, 'photos'); } catch (e) {}
      try { updateFilePreviews(studentIndex, 'videos'); } catch (e) {}
      try { updateDropZones(studentIndex); appendAddMoreButton(studentIndex, 'photos'); appendAddMoreButton(studentIndex, 'videos'); } catch (e) {}
      try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}
      try { if (typeof renderBottomTabs === 'function') renderBottomTabs(); } catch (e) {}
      try {
        var courseKeyAfterUpload = getCourseCacheKey(currentCourse || {});
        setCourseDriveStatus(courseKeyAfterUpload, 'ready', {
          source: 'uploadStudentRecord',
          student: student && student.name,
          uploadedPhotos: uploadedPhotoCount,
          uploadedVideos: uploadedVideoCount
        });
      } catch (e) {}
      if (AUTO_REFRESH_AFTER_UPLOAD) {
        setTimeout(function() {
          try { refreshStudentRecordByIndex(studentIndex, { fallbackToFullReload: true }); } catch (e) {}
        }, 600);
      }
      try { lastSubmittedSnapshot[studentIndex] = computeChangeSnapshot(studentIndex); } catch (e) {}
    } catch (error) {
      uploadRetryCount[studentIndex] = (uploadRetryCount[studentIndex] || 0) + 1;
      console.error('❌ [uploadStudentRecord] 儲存失敗:', error);
      updateDOMAsync(function() {
        btn.classList.remove('uploading');
        btn.classList.add('error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 同步失敗，重試';
      }, 0);
      try { stopStudentProgressAnimation(studentIndex, false); } catch (e) {}
      showToast('❌ 同步失敗：' + (error && error.message || error || '未知錯誤'), 'error');
    } finally {
      uploadingStudents[studentIndex] = false;
      checkUploadReady(studentIndex);
    }
  }


  async function refreshStudentRecordByIndex(studentIndex, opts) {
    if (!currentCourse || !currentCourse.students || typeof studentIndex !== 'number') return false;
    var student = currentCourse.students[studentIndex];
    if (!student) return false;
    try {
      await fetchStudentFsRecord(studentIndex, student);
      return true;
    } catch (error) {
      var message = (error && error.message) ? String(error.message) : '';
      var code = (error && (error.code || error.status || error.errorCode)) || null;
      var isTimeout = /408|timeout|超時/i.test(message) || code === 408;
      var isNotFound = /404|not\s*found|不存在/i.test(message) || code === 404;
      if (opts && opts.fallbackToFullReload && isNotFound) {
        console.warn('⚠️ 無法更新學生記錄，改用整體重載:', error);
        requestCourseReload({ force: true, showLoader: false });
      } else if (isTimeout) {
        console.log('ℹ️ 無法連線 Drive（timeout），略過自動重載，稍後會由排程再試。');
      } else if (!(opts && opts.silentFallback)) {
        console.warn('⚠️ 無法更新學生記錄:', error);
      }
      return false;
    }
  }

  function refreshStudentRecordByName(studentName, opts) {
    var idx = findStudentIndexInState(studentName);
    if (idx < 0) return Promise.resolve(false);
    return refreshStudentRecordByIndex(idx, opts);
  }

  function flashCommentSaved(studentIndex) {
    var host = document.getElementById('comment-progress-' + studentIndex);
    if (!host) return;
    var badge = document.createElement('div');
    badge.className = 'comment-saved-check';
    badge.textContent = '✔ 已儲存';
    host.appendChild(badge);
    setTimeout(function () {
      if (badge && badge.parentNode) badge.parentNode.removeChild(badge);
    }, 1200);
  }

  // 🔥 [修復 2025-11-27] 重複檢測：移除已上傳的本地預覽
  // 避免本地預覽和 Drive 版本同時顯示
  function removeDuplicateLocalPreviews(studentName, photoCount, videoCount) {
    try {
      var studentIndex = findStudentIndexInState(studentName);
      if (studentIndex < 0) return;
      
      console.log('🧹 [重複檢測] 開始清理學生預覽:', studentName, {
        studentIndex: studentIndex,
        photoCount: photoCount,
        videoCount: videoCount
      });
      
      ['photos', 'videos'].forEach(function(type) {
        var container = document.getElementById(type + '-preview-' + studentIndex);
        if (!container) return;
        
        var localPreviews = container.querySelectorAll('.file-preview.new-upload[data-upload-id]');
        var totalToRemove = type === 'photos' ? photoCount : videoCount;
        var removedCount = 0;
        
        // 🔥 [修復 2025-11-27] 改進：精確匹配而非計數
        // 檢查所有本地預覽，移除已上傳成功的節點
        var previewsToRemove = [];
        
        Array.prototype.forEach.call(localPreviews, function(preview) {
          // 檢查是否為已上傳成功的預覽
          var isUploadSuccess = preview.classList.contains('upload-success');
          if (!isUploadSuccess) {
            console.log('⏭️ [重複檢測] 跳過未成功預覽:', {
              studentName: studentName,
              type: type,
              uploadId: preview.getAttribute('data-upload-id'),
              fileName: preview.getAttribute('data-file-name')
            });
            return;
          }
          
          // 🔥 [修復 2025-11-27] 額外驗證：檢查是否有對應的檔案對象
          var uploadId = preview.getAttribute('data-upload-id');
          var hasMatchingFile = false;
          
          if (studentFiles[studentIndex] && studentFiles[studentIndex][type]) {
            hasMatchingFile = studentFiles[studentIndex][type].some(function(file) {
              return file.__uploadId === uploadId;
            });
          }
          
          if (!hasMatchingFile) {
            console.log('⏭️ [重複檢測] 跳過無匹配檔案預覽:', {
              studentName: studentName,
              type: type,
              uploadId: uploadId
            });
            return;
          }
          
          // 🔥 [修復 2025-11-27] 精確匹配：移除所有上傳成功的預覽
          // 不再依賴計數，而是移除所有已上傳成功的本地預覽
          previewsToRemove.push(preview);
        });
        
        // 移除所有標記的預覽
        previewsToRemove.forEach(function(preview) {
          console.log('🗑️ [重複檢測] 移除本地預覽:', {
            studentName: studentName,
            type: type,
            uploadId: preview.getAttribute('data-upload-id'),
            fileName: preview.getAttribute('data-file-name')
          });
          
          // 清理 blob URL
          revokePreviewObjectUrl(preview);
          
          // 移除 DOM 節點
          preview.remove();
          removedCount++;
        });
        
        console.log('✅ [重複檢測] 清理完成:', {
          studentName: studentName,
          type: type,
          expected: totalToRemove,
          removed: removedCount,
          remaining: container.querySelectorAll('.file-preview.new-upload[data-upload-id]').length
        });
      });
      
    } catch (e) {
      console.error('❌ [重複檢測] 清理失敗:', e);
    }
  }

  function collectLocalPreviewUrls(studentIndex, type) {
    try {
      var container = document.getElementById(type + '-preview-' + studentIndex);
      if (!container) return [];
      var nodes = container.querySelectorAll('.file-preview.new-upload[data-object-url]');
      var urls = [];
      Array.prototype.forEach.call(nodes, function (node) {
        var url = node.getAttribute('data-object-url');
        if (url && urls.indexOf(url) === -1) urls.push(url);
      });
      return urls;
    } catch (e) { return []; }
  }

  function mergeLocalUploadedRecord(studentIndex, student) {
    try {
      if (!(window.FLB && FLB.State)) return;
      var st = FLB.State.get();
      var cache = Object.assign({}, st.uploadedRecordsCache || {});
      var list = Array.isArray(cache.students) ? cache.students.slice() : [];
      var name = (student && (student.name || student.studentName)) || '';
      var existing = list.findIndex(function (r) { return (r.studentName || '') === name; });
      // ⚠️ 重要：本地檔名（例如 iOS 相簿帶有 emoji 或中文的原始檔名）
      // 並非伺服器實際儲存檔名（伺服器會以「studentName_photo_時間戳」格式命名）。
      // 直接把本地檔名寫進快取，之後渲染 existing 區塊會用 /api/learning-records/file 嘗試讀取，造成 404。
      // 因此這裡不把本地檔名放進快取的 files 清單，僅保留既有（伺服器端）檔案清單，
      // 新增的本地預覽仍由 .new-upload 節點顯示，待下一次伺服器掃描成功後再以正式檔名取代。
      var prev = (existing >= 0) ? (list[existing] || {}) : {};
      var prevPhotos = (prev.files && Array.isArray(prev.files.photos)) ? prev.files.photos.slice() : [];
      var prevVideos = (prev.files && Array.isArray(prev.files.videos)) ? prev.files.videos.slice() : [];
      
      // 🔥 [修復 2025-11-18] 保留原有的新媒體系統數據（抽屜數據消失問題）
      var prevNewMediaPhotos = Array.isArray(prev.newMediaPhotos) ? prev.newMediaPhotos.slice() : [];
      var prevNewMediaVideos = Array.isArray(prev.newMediaVideos) ? prev.newMediaVideos.slice() : [];
      console.log('💾 [mergeLocalUploadedRecord] 保留原有媒體:', name, {
        newMediaPhotos: prevNewMediaPhotos.length,
        newMediaVideos: prevNewMediaVideos.length
      });
      
      // 本地暫存：優先重用 DOM 中現有的 Object URL，確保抽屜/記錄立即顯示
      var localPhotoUrls = collectLocalPreviewUrls(studentIndex, 'photos');
      var localVideoUrls = collectLocalPreviewUrls(studentIndex, 'videos');
      // 🔥 [修復 2025-11-17] 優先使用 studentFiles 中保存的 blob URL
      // 避免重複創建導致播放錯誤
      if (!localPhotoUrls.length && studentFiles[studentIndex]) {
        var localPhotoFiles = (studentFiles[studentIndex].photos || []).slice();
        localPhotoFiles.forEach(function (f) { 
          try { 
            // 檢查是否已有保存的 blob URL
            if (f.__objectUrl && typeof f.__objectUrl === 'string') {
              localPhotoUrls.push(f.__objectUrl);
            } else {
              var u = URL.createObjectURL(f); 
              f.__objectUrl = u; // 保存以供後續使用
              localPhotoUrls.push(u); 
            }
          } catch (e) {} 
        });
      }
      if (!localVideoUrls.length && studentFiles[studentIndex]) {
        var localVideoFiles = (studentFiles[studentIndex].videos || []).slice();
        localVideoFiles.forEach(function (f) { 
          try { 
            // 檢查是否已有保存的 blob URL
            if (f.__objectUrl && typeof f.__objectUrl === 'string') {
              localVideoUrls.push(f.__objectUrl);
            } else {
              var u = URL.createObjectURL(f); 
              f.__objectUrl = u; // 保存以供後續使用
              localVideoUrls.push(u); 
            }
          } catch (e) {} 
        });
      }
      var meta = buildRecordOperationMeta(name);
      var record = {
        studentName: name,
        // ✅ 保持已存在（伺服器端）數量，避免以本地檔名誤導 existing 區塊去讀檔
        photos: (typeof prev.photos === 'number' ? prev.photos : prevPhotos.length),
        videos: (typeof prev.videos === 'number' ? prev.videos : prevVideos.length),
        comment: studentFiles[studentIndex].comment || '',
        // ✅ 僅保留伺服器端已存在的檔名，避免 404（本地預覽用 .new-upload 呈現即可）
        files: { photos: prevPhotos, videos: prevVideos },
        // ✅ 加入本地暫存 Object URL，供 UI 立即顯示
        localFiles: { photos: localPhotoUrls, videos: localVideoUrls },
        // 🔥 [修復 2025-11-18] 保留新媒體系統數據（抽屜數據消失問題）
        newMediaPhotos: prevNewMediaPhotos,
        newMediaVideos: prevNewMediaVideos,
        coursePeriod: meta.coursePeriod,
        date: meta.date,
        relativePath: meta.relativePath,
        semester: (cache.meta && cache.meta.semester) || ''
      };
      console.log('✅ [mergeLocalUploadedRecord] 已保存媒體數據:', name, {
        newMediaPhotos: record.newMediaPhotos.length,
        newMediaVideos: record.newMediaVideos.length,
        localPhotos: localPhotoUrls.length,
        localVideos: localVideoUrls.length
      });
      if (existing >= 0) list[existing] = record; else list.push(record);
      cache.students = list;
      FLB.State.set({ uploadedRecordsCache: cache });
      if (studentFiles[studentIndex]) {
        var base = studentFiles[studentIndex];
        base.existingCounts = base.existingCounts || { photos: 0, videos: 0, text: 0 };
        // ✅ existingCounts 代表伺服器端既有數量，這裡不以本地檔數覆蓋，避免雙重計算
        base.existingCounts.photos = Math.max(base.existingCounts.photos || 0, record.photos || 0);
        base.existingCounts.videos = Math.max(base.existingCounts.videos || 0, record.videos || 0);
        base.localFiles = base.localFiles || { photos: [], videos: [] };
        base.localFiles.photos = localPhotoUrls.slice();
        base.localFiles.videos = localVideoUrls.slice();
      }
      // ⛔ 避免整卡重繪導致本地「待同步」縮圖消失
      // 僅刷新抽屜與底部標籤、進度膠囊
      try { renderDrawerFromState(); } catch (e) {}
      try { 
        var __st = FLB.State.get(); 
        renderUploadedRecords(__st.uploadedRecordsCache || {}, { courseKey: getCourseCacheKey(), allowOverviewFallback: true }); 
      } catch (e) {}
      try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}
      try { renderBottomTabs(); } catch (e) {}
    } catch (e) {}
  }

  // ==================== 課程總覽上傳（Drive API 版本）====================
  
  // 📊 更新課程總覽中每個文件的獨立進度條（按文件大小加權）
function updateIndividualOverviewFileProgress(photos, videos, loaded, total, percentFallback) {
    try {
      var safeTotal = (typeof total === 'number' && total > 0) ? total : 100;
      var safeLoaded = (typeof loaded === 'number' && loaded >= 0) ? loaded : (Math.max(0, Math.min(100, percentFallback || 0)) / 100) * safeTotal;
      var percent = safeTotal > 0 ? Math.round((safeLoaded / safeTotal) * 100) : Math.round(Math.max(0, Math.min(100, percentFallback || 0)));
      // 計算每個文件的大小佔比
      var allFiles = [];
      
      photos.forEach(function(file, idx) {
        allFiles.push({
          file: file,
          size: file.size || 1024 * 1024, // 默認 1MB
          type: 'photo',
          index: idx,
          selector: '#overviewPhotosPreviews .file-preview[data-file-index="' + idx + '"]'
        });
      });
      
      videos.forEach(function(file, idx) {
        // 🔥 影片和照片共用同一個容器，所以索引需要加上照片數量
        var videoIndex = photos.length + idx;
        allFiles.push({
          file: file,
          size: file.size || 5 * 1024 * 1024, // 默認 5MB
          type: 'video',
          index: videoIndex,
          selector: '#overviewPhotosPreviews .file-preview[data-file-index="' + videoIndex + '"]'
        });
      });
      
      if (allFiles.length === 0) {
        return;
      }
      
      var totalSize = allFiles.reduce(function(sum, f) { return sum + f.size; }, 0);
      if (totalSize <= 0) {
        totalSize = allFiles.length || 1;
        allFiles.forEach(function(item) { item.size = item.size || 1; });
      }
      var processedSize = 0;
      
      allFiles.forEach(function(fileInfo) {
        var fileStartByte = processedSize;
        var fileEndByte = processedSize + fileInfo.size;
        processedSize = fileEndByte;
        
        // 計算該文件的上傳進度
        var fileProgress = 0;
        if (safeLoaded >= fileEndByte) {
          fileProgress = 100; // 已完成
        } else if (safeLoaded > fileStartByte) {
          fileProgress = Math.round(((safeLoaded - fileStartByte) / fileInfo.size) * 100);
        } else {
          fileProgress = 0; // 未開始
        }

        var preview = document.querySelector(fileInfo.selector);
        
        if (!preview) {
          // 🔥 容錯方案 1：嘗試通過 data-file-index 直接查找
          // 📝 照片和影片共用同一個容器：overviewPhotosPreviews
          var containerSelector = '#overviewPhotosPreviews';
          var container = document.querySelector(containerSelector);
          if (container) {
            var allPreviews = container.querySelectorAll('.file-preview');
            for (var i = 0; i < allPreviews.length; i++) {
              if (parseInt(allPreviews[i].getAttribute('data-file-index') || '-1', 10) === fileInfo.index) {
                preview = allPreviews[i];
                break;
              }
            }
          }
          
          // 🔥 容錯方案 2：通過位置查找（第 N 個 .file-preview）
          if (!preview && container) {
            var allPreviews2 = container.querySelectorAll('.file-preview');
            if (allPreviews2[fileInfo.index]) {
              preview = allPreviews2[fileInfo.index];
            }
          }
        }
        
        if (preview) {
          var label = (fileProgress >= 100) ? '✓ 完成' : (fileProgress === 0 ? '排隊中…' : (fileProgress + '%'));
          // 🔥 [修復 2025-11-16] 檢查是否已經 synced，如果是則不要重新顯示 overlay
          var isSynced = preview.classList.contains('upload-success') || 
                        preview.classList.contains('synced-preview') || 
                        preview.getAttribute('data-synced') === '1';
          
          if (window.SharedPreviewRenderer) {
            window.SharedPreviewRenderer.setProgress(preview, fileProgress, label);
          } else {
            // 降級：沿用原生邏輯
            var progressFill = preview.querySelector('.file-upload-progress-fill, .fill');
            var progressText = preview.querySelector('.progress-text');
            var overlay = preview.querySelector('.file-uploading-overlay');
            // 🔥 [修復 2025-11-18] 不強制顯示 overlay，由 CSS hover 控制
            // if (overlay && !isSynced) overlay.style.display = 'flex';
            if (progressFill) {
              var pixelWidth = Math.round(70 * fileProgress / 100);
              progressFill.style.width = pixelWidth + 'px';
              progressFill.style.display = 'block';
              progressFill.style.visibility = 'visible';
              progressFill.style.opacity = '1';
            }
            if (progressText) progressText.textContent = label;
          }
        } else {
          console.error('❌ [DOM 查詢] 無法找到預覽元素:', fileInfo);
        }
      });
    } catch (e) {
      console.error('❌ [更新文件進度] 失敗:', e);
      if (e && e.stack) {
        console.error('錯誤堆疊:', e.stack);
      }
    }
  }
  
  // ==================== 共用上傳模組 ====================
  
  /**
   * 🔥 共用的檔案上傳函數（學生和課程總覽共用）
   * @param {Object} options - 上傳選項
   * @param {Array} options.photos - 照片檔案陣列
   * @param {Array} options.videos - 影片檔案陣列
   * @param {Object} options.metadata - 元數據（semester, courseName, date, studentName, comment, isOverview）
   * @param {String} options.containerSelector - 預覽容器選擇器（例如 '#overviewPhotosPreviews' 或 '#photos-preview-0'）
   * @param {Function} options.onProgress - 總體進度回調
   * @param {Function} options.onSuccess - 成功回調
   * @param {Function} options.onError - 錯誤回調
   * @returns {Promise<Object>} 上傳結果
   */
  async function uploadFilesWithSmartManager(options) {
    try {
      var photos = options.photos || [];
      var videos = options.videos || [];
      var metadata = options.metadata || {};
      var containerSelector = options.containerSelector;
      
      // 合併所有文件
      var allFiles = photos.concat(videos);
      
      // 🔥 允許只有評語的上傳（沒有照片或影片也可以）
      var hasComment = metadata.comment && String(metadata.comment).trim().length > 0;
      
      if (allFiles.length === 0 && !hasComment) {
        throw new Error('至少需要上傳 1 張照片、1 個影片或填寫評語');
      }
      
      if (allFiles.length === 0 && hasComment) {
        console.log('📝 [共用上傳] 只有評語，沒有文件');
      } else {
        console.log('📤 [共用上傳] 開始上傳，文件數:', allFiles.length);
      }
      
      // 🚀 使用智能上傳管理器
      if (!global.FLB || !global.FLB.SmartUploadManager) {
        throw new Error('智能上傳管理器未加載');
      }
      
      // 創建上傳管理器
      var uploadManager = new global.FLB.SmartUploadManager({
        onProgress: options.onProgress,
        onFileProgress: options.onFileProgress,
        onComplete: options.onComplete,
        onError: options.onError,
        onMemoryWarning: options.onMemoryWarning
      });
      
      // 🔥 為每個檔案預覽添加 uploading 類並顯示進度條
      if (containerSelector) {
        setupFileProgressBars(photos, videos, containerSelector);
      }
      
      // 🔥 設定進度回調：更新每個檔案的進度條
      var lastLoadedBytes = 0;
      var lastTotalBytes = 0;

      uploadManager.onProgress = function(percent, completed, total, loadedBytes, totalBytes) {
        if (typeof loadedBytes === 'number') {
          lastLoadedBytes = loadedBytes;
        }
        if (typeof totalBytes === 'number' && totalBytes > 0) {
          lastTotalBytes = totalBytes;
        }
        updateDOMAsync(function() {
          var roundedPercent = Math.min(100, Math.max(0, Math.round(percent || 0)));
          var isOverviewContainer = containerSelector === '#overviewPhotosPreviews';
          if (containerSelector) {
            if (isOverviewContainer) {
              updateIndividualOverviewFileProgress(photos, videos, loadedBytes, totalBytes, roundedPercent);
            } else {
              updateAllFileProgressBars(containerSelector, roundedPercent);
            }
          }

          // 調用外部進度回調
          if (options.onProgress) {
            options.onProgress(percent, completed, total);
          }
        });
      };
      
      // 執行上傳
      var uploadResult = await uploadManager.uploadBatchSingleRequest(allFiles, metadata);
      
      // 檢查上傳結果
      if (uploadResult.success) {
        console.log('✅ [共用上傳] 上傳成功:', uploadResult);
        
        // 🔥 更新所有檔案的進度條為 100%
        if (containerSelector) {
          if (containerSelector === '#overviewPhotosPreviews') {
            updateIndividualOverviewFileProgress(photos, videos, lastLoadedBytes || totalBytes || 1, lastTotalBytes || totalBytes || 1, 100);
          } else {
            updateAllFileProgressBars(containerSelector, 100);
          }
        }
        
        // 調用成功回調
        if (options.onSuccess) {
          options.onSuccess(uploadResult);
        }
      } else {
        throw new Error(uploadResult.error || '上傳失敗');
      }
      
      return uploadResult;
      
    } catch (error) {
      console.error('❌ [共用上傳] 失敗:', error);
      
      // 調用錯誤回調
      if (options.onError) {
        options.onError(error);
      }
      
      throw error;
    }
  }
  
  /**
   * 🔥 設置檔案預覽的進度條（共用函數）
   * @param {Array} photos - 照片檔案陣列
   * @param {Array} videos - 影片檔案陣列
   * @param {String} containerSelector - 預覽容器選擇器
   */
  function setupFileProgressBars(photos, videos, containerSelector) {
    updateDOMAsync(function() {
      // 標記所有檔案為上傳中
      photos.forEach(function(file, idx) {
        var preview = document.querySelector(containerSelector + ' .file-preview[data-file-index="' + idx + '"]');
        if (preview) {
          preview.classList.add('uploading');
          preview.classList.remove('new-upload');
          
          // 確保進度條存在並顯示
          ensureProgressBar(preview);
        }
      });
      
      videos.forEach(function(file, idx) {
        // 🔥 影片的索引需要加上照片數量，因為共用同一個容器
        var videoIndex = photos.length + idx;
        var preview = document.querySelector(containerSelector + ' .file-preview[data-file-index="' + videoIndex + '"]');
        if (preview) {
          preview.classList.add('uploading');
          preview.classList.remove('new-upload');
          
          // 確保進度條存在並顯示
          ensureProgressBar(preview);
        }
      });
    }, 0); // 設置 timeout 為 0，確保立即執行
  }
  
  /**
   * 🔥 確保預覽元素有進度條（共用函數）
   * @param {HTMLElement} preview - 預覽元素
   */
  function ensureProgressBar(preview) {
    var overlay = preview.querySelector('.file-uploading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'file-uploading-overlay';
      preview.appendChild(overlay);
    }
    
    var progressBar = overlay.querySelector('.file-upload-progress');
    if (!progressBar) {
      progressBar = document.createElement('div');
      progressBar.className = 'file-upload-progress';
      var progressFill = document.createElement('div');
      progressFill.className = 'file-upload-progress-fill';
      progressBar.appendChild(progressFill);
      overlay.appendChild(progressBar);
    }
    
    var progressText = overlay.querySelector('.progress-text');
    if (!progressText) {
      progressText = document.createElement('div');
      progressText.className = 'progress-text';
      progressText.textContent = '準備中...';
      overlay.insertBefore(progressText, progressBar);
    }
  }
  
  /**
   * 異步更新 DOM（使用 requestIdleCallback）
   * 確保 DOM 更新不阻塞主線程
   * @param {Function} updateFn - 更新函數
   * @param {Number} timeout - 超時時間（毫秒），預設 100ms
   */
  function updateDOMAsync(updateFn, timeout) {
    if (typeof updateFn !== 'function') return;
    
    if (window.requestIdleCallback) {
      window.requestIdleCallback(updateFn, { timeout: timeout || 100 });
    } else {
      // 降級：使用 setTimeout，約 60fps
      setTimeout(updateFn, 16);
    }
  }
  
  var uploadFilesCommon = uploadFilesWithSmartManager; // 向下相容舊命名

  /**
   * 🔥 更新所有檔案的進度條（共用函數）
   * @param {String} containerSelector - 預覽容器選擇器
   * @param {Number} progress - 進度百分比 (0-100)
   */
  function updateAllFileProgressBars(containerSelector, progress) {
    updateDOMAsync(function() {
      var allPreviews = document.querySelectorAll(containerSelector + ' .file-preview.uploading');
      allPreviews.forEach(function(preview) {
        // 🔥 [修復 2025-11-16] 跳過已 synced 的預覽
        var isSynced = preview.classList.contains('upload-success') || 
                      preview.classList.contains('synced-preview') || 
                      preview.getAttribute('data-synced') === '1';
        if (isSynced) return;
        
        var overlay = preview.querySelector('.file-uploading-overlay');
        if (overlay) {
          var progressFill = overlay.querySelector('.file-upload-progress-fill, .file-upload-progress .fill');
          if (progressFill) {
            var pixelWidth = Math.round(70 * progress / 100);
            progressFill.style.width = pixelWidth + 'px';
            progressFill.style.display = 'block';
            progressFill.style.visibility = 'visible';
            progressFill.style.opacity = '1';
          }
          
          var progressText = overlay.querySelector('.progress-text');
          if (progressText) {
            progressText.textContent = progress + '%';
          }
          // 🔥 [修復 2025-11-18] 不強制顯示 overlay，由 CSS hover 控制
          // overlay.style.display = 'flex';
        }
      });
    });
  }
  
  /**
   * 🧹 清理上傳完成後的 UI（從佇列移除，共用函數）
   * @param {Array} photos - 照片檔案陣列
   * @param {Array} videos - 影片檔案陣列
   * @param {String} containerSelector - 預覽容器選擇器
   */
  function cleanupUploadUI(photos, videos, containerSelector, options) {
    var opts = options || {};
    var keepPreview = !!opts.keepPreview;
    var enableDeleteAfterSync = !!opts.enableDeleteAfterSync;
    // 🔥 異步清理 UI（避免阻塞主線程）
    updateDOMAsync(() => {
      try {
        console.log('🧹 [清理 UI] 開始移除上傳完成的文件預覽');

        function markPreviewSynced(preview) {
          if (!preview) return;
          preview.classList.remove('uploading', 'pending', 'new-upload');
          preview.classList.add('upload-success', 'synced');
          preview.setAttribute('data-upload-state', 'synced');
          markPreviewForLocalPreserve(preview);
          var overlay = preview.querySelector('.file-uploading-overlay');
          if (overlay) {
            overlay.style.opacity = '0';
            overlay.style.pointerEvents = 'none';
          }
          var progressText = preview.querySelector('.progress-text');
          if (progressText) {
            progressText.textContent = '已同步';
          }
          var removeBtn = preview.querySelector('.remove-btn');
          if (removeBtn) {
            if (enableDeleteAfterSync) {
              try {
                removeBtn.disabled = false;
                removeBtn.removeAttribute('aria-disabled');
                removeBtn.style.opacity = '';
                removeBtn.style.pointerEvents = '';
              } catch (e) {}
            } else {
              removeBtn.disabled = true;
              removeBtn.setAttribute('aria-disabled', 'true');
              removeBtn.style.opacity = '0.4';
            }
          }
        }

        // 🔥 移除照片預覽或標記為完成
        photos.forEach(function(file, idx) {
          var preview = document.querySelector(containerSelector + ' .file-preview[data-file-index="' + idx + '"]');
          if (preview) {
            if (keepPreview) {
              markPreviewSynced(preview);
            } else {
              preview.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
              preview.style.opacity = '0';
              preview.style.transform = 'scale(0.9)';
              setTimeout(function() {
                updateDOMAsync(() => {
                  preview.remove();
                  console.log('✅ [清理 UI] 照片預覽已移除:', file.name);
                }, 0);
              }, 300);
            }
          } else {
            console.warn('⚠️ [清理 UI] 找不到照片預覽元素:', idx, file.name);
          }
        });
        
        // 🔥 移除影片預覽或標記為完成
        videos.forEach(function(file, idx) {
          // 🔥 影片的索引需要加上照片數量，因為共用同一個容器
          var videoIndex = photos.length + idx;
          var preview = document.querySelector(containerSelector + ' .file-preview[data-file-index="' + videoIndex + '"]');
          if (preview) {
            if (keepPreview) {
              markPreviewSynced(preview);
            } else {
              preview.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
              preview.style.opacity = '0';
              preview.style.transform = 'scale(0.9)';
              setTimeout(function() {
                updateDOMAsync(() => {
                  preview.remove();
                  console.log('✅ [清理 UI] 影片預覽已移除:', file.name);
                }, 0);
              }, 300);
            }
          } else {
            console.warn('⚠️ [清理 UI] 找不到影片預覽元素:', videoIndex, file.name);
          }
        });
        
        console.log('✅ [清理 UI] 所有文件預覽已標記移除');
      } catch (e) {
        console.error('❌ [清理 UI] 失敗:', e);
      }
    }, 0);
  }
  
  // 🧹 清理課程總覽上傳完成後的 UI（從佇列移除）- 保留向後兼容
  function cleanupOverviewUploadUI(photos, videos) {
    cleanupUploadUI(photos, videos, '#overviewPhotosPreviews', { keepPreview: true, enableDeleteAfterSync: true });
    try {
      var cont = document.getElementById('overviewPhotosPreviews');
      if (cont && window.SharedPreviewRenderer) {
        Array.prototype.forEach.call(cont.querySelectorAll('.file-preview'), function (n) {
          window.SharedPreviewRenderer.markSynced(n);
        });
        // 綁定刪除（若稍後沒有由成功回傳的檔名再補綁）
        try { ensureOverviewSyncedDeleteHandlers(); } catch (e) {}
      }
    } catch (e) {}
  }

  // 綁定：對已同步的課程總覽預覽，確保刪除按鈕走 deleteOverviewFile，不觸發重新上傳
  function ensureOverviewSyncedDeleteHandlers() {
    var cont = document.getElementById('overviewPhotosPreviews');
    if (!cont) return;
    Array.prototype.forEach.call(cont.querySelectorAll('.file-preview.upload-success, .file-preview.synced'), function(node){
      var btn = node.querySelector('.remove-btn');
      if (!btn) return;
      if (btn.__ov_synced_bound) return;
      // 以 clone 移除既有 onclick（可能指向 removeOverviewPhoto）
      var fileName = node.getAttribute('data-filename') || node.getAttribute('data-file-name') || '';
      var newBtn = btn.cloneNode(true);
      newBtn.__ov_synced_bound = true;
      newBtn.onclick = function(e){
        try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
        var name = fileName || node.getAttribute('data-filename') || node.getAttribute('data-file-name') || '';
        if (!name) {
          console.warn('⚠️ [OverviewDelete] 無檔名資訊，嘗試從標題推斷');
          try { var img = node.querySelector('img'); if (img && img.alt) name = img.alt; } catch (_) {}
        }
        if (!name) { return false; }
        return deleteOverviewFile(newBtn, name);
      };
      try {
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.disabled = false; newBtn.removeAttribute('aria-disabled'); newBtn.style.opacity = '';
      } catch (_) {}
    });
  }

  // 事件委派：保證所有「已同步」縮圖的刪除都走 deleteOverviewFile，而非重新上傳流程
  (function bindOverviewDeleteDelegation(){
    try {
      var cont = document.getElementById('overviewPhotosPreviews');
      if (!cont || cont.__ov_delete_bound) return;
      cont.__ov_delete_bound = true;
      cont.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('.remove-btn');
        if (!btn) return;
        var node = btn.closest('.file-preview');
        if (!node) return;
        // 只有「已同步/完成」的縮圖才攔截，避免影響尚未上傳的移除邏輯
        var isSynced = node.classList.contains('upload-success') || node.classList.contains('synced');
        if (!isSynced) return;
        try { e.preventDefault(); e.stopPropagation(); if (typeof e.stopImmediatePropagation==='function') e.stopImmediatePropagation(); } catch(_) {}
        var name = node.getAttribute('data-filename') || node.getAttribute('data-file-name') || '';
        if (!name) {
          // 兜底：嘗試從 img.alt 取名
          try { var img = node.querySelector('img'); if (img && img.alt) name = img.alt; } catch(_) {}
        }
        if (!name) return; // 沒有效檔名就交回原流程（不阻擋）
        deleteOverviewFile(btn, name);
      }, true); // useCapture: true，優先攔截
      console.log('✅ [OverviewDelete] 委派已綁定');
    } catch (e) { console.warn('⚠️ [OverviewDelete] 綁定委派失敗:', e); }
  })();

  // 學生頁：委派刪除（針對「已同步」縮圖），避免點擊走 removeFile(index,...) 造成重新上傳
  (function bindStudentDeleteDelegation(){
    try {
      var root = document.getElementById('studentsSection');
      if (!root || root.__stu_delete_bound) return;
      root.__stu_delete_bound = true;
      root.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('.remove-btn');
        if (!btn) return;
        var node = btn.closest('.file-preview');
        if (!node) return;
        var isSynced = node.classList.contains('upload-success') || node.classList.contains('synced');
        console.log('🔍 [委派調試] 點擊刪除按鈕:', {
          isSynced: isSynced,
          classes: node.className,
          onclick: btn.getAttribute('onclick')
        });
        if (!isSynced) return; // 僅攔截已同步的縮圖
        try { e.preventDefault(); e.stopPropagation(); if (typeof e.stopImmediatePropagation==='function') e.stopImmediatePropagation(); } catch(_) {}
        var wrap = btn.closest('.student-card');
        var idx = -1;
        try {
          var m = (wrap && wrap.id || '').match(/student-(\d+)/); idx = m ? parseInt(m[1],10) : -1;
        } catch (_) { idx = -1; }
        var stName = (function(){ try { var el = wrap && wrap.querySelector && wrap.querySelector('.student-name, .student-header .name, .student-card-title'); return el ? el.textContent.trim() : ''; } catch (_) { return ''; } })();
        // 若取不到名稱，從 State 以 index 取
        if (!stName && idx >= 0 && window.FLB && FLB.State) {
          try { var st = FLB.State.get(); var s = (st.students||[])[idx]; stName = (s && s.name) || ''; } catch (_) {}
        }
        var fname = node.getAttribute('data-filename') || node.getAttribute('data-file-name') || '';
        if (!fname) { try { var im = node.querySelector('img'); if (im && im.alt) fname = im.alt; } catch (_) {} }
        if (!stName || !fname) return;
        return deleteStudentFile(btn, stName, fname);
      }, true);
      console.log('✅ [StudentDelete] 委派已綁定');
    } catch (e) { console.warn('⚠️ [StudentDelete] 綁定委派失敗:', e); }
  })();
  
  // 🔥 2025-11-12: 改用 API v2（ChunkedUploader）以與學生頁一致
  async function uploadOverview(options) {
    console.log('📤 [智能上傳] 開始上傳');
    
    if (!currentCourse) { 
      console.error('❌ [uploadOverview] 沒有選擇課程');
      showToast('請先選擇一個課程', 'error'); 
      return;
    }
    
    var silent = options && options.silent;
    
    // 檢查是否正在上傳
    if (window.__uploadingOverview) {
      console.warn('⚠️ 總覽上傳進行中，請稍後');
      return;
    }
    window.__uploadingOverview = true;
    
    try {
      // 🔥 獲取課程資訊
      var parsed = global.FLB.Course.parseTitle(currentCourse.title || '');
        var startDate = new Date(currentCourse.start);
      var dateStr = formatDateTWISO(startDate);
      var courseName = currentCourse.courseName || parsed.courseName;
      var period = (parsed.period || '').replace(/\s+/g, '');
      var semester = '114-1'; // TODO: 從系統設定獲取
      var __ucOverviewIndex = Date.now() % 100000;
      
      // 🔥 獲取所有待上傳的檔案
      var photos = (window.overviewPhotosFiles || []).slice();
      var videos = (window.overviewVideosFiles || []).slice();
      
      // 🔥 重要：使用 buildOverviewBlockFromFields() 構建格式化文本
      var summaryText = '';
      try {
        if (typeof buildOverviewBlockFromFields === 'function') {
          summaryText = buildOverviewBlockFromFields();
      }
    } catch (e) {
        console.warn('⚠️ 無法構建格式化文本:', e);
      }
      
      console.log('📊 [Drive 總覽上傳] 待上傳:', {
        photos: photos.length,
        videos: videos.length,
        summary: summaryText.length,
        summaryPreview: summaryText.substring(0, 100)
      });
      
      // 檢查是否有內容要上傳
      if (photos.length === 0 && videos.length === 0 && summaryText.length === 0) {
        console.warn('⚠️ 沒有內容可上傳');
        showToast('請至少添加照片、影片或總覽摘要', 'warning');
        window.__uploadingOverview = false;
          return; 
        } 
      
      // 🔥 異步查詢 DOM 元素並更新初始 UI（避免阻塞主線程）
      var btn, syncFill, syncText;
      await new Promise(resolve => {
        updateDOMAsync(() => {
          // DOM 查詢
          btn = document.getElementById('uploadOverviewBtn');
          syncFill = document.getElementById('overviewSyncFill');
          syncText = document.getElementById('overviewSyncText');
          
          // 初始 UI 更新
          if (!silent && btn) {
            btn.classList.add('uploading');
            btn.disabled = true;
            btn.innerHTML = '<span class="loading"></span> 準備上傳...';
          } else if (silent && syncText) {
            // 🔥 靜默上傳：顯示同步狀態（讓用戶知道正在上傳）
            syncText.textContent = '準備同步...';
            syncText.style.color = '#3b82f6';
          }
          
          resolve();
        }, 0); // timeout 0 確保立即執行
      });
      
      // 🔥 驗證必要欄位
      if (!dateStr) {
        throw new Error('缺少日期資訊，無法上傳');
      }
      if (!currentCourse || !currentCourse.title) {
        throw new Error('缺少課程資訊，無法上傳');
      }
      if (!semester) {
        throw new Error('缺少學期資訊，無法上傳');
      }
      
      // 構建元數據（確保所有必要欄位都有值）
      // 重要：課程總覽也必須包含 topic，否則後端會只用 date 建立資料夾（少了「日期 主題」）
      var topicForPath = '';
      try {
        topicForPath = extractCourseTopicForPath(currentCourse) || '';
      } catch (e) { topicForPath = ''; }

      var metadata = {
        semester: String(semester).trim(),
        courseName: String(currentCourse.title || (courseName + ' ' + period)).trim(),
        date: String(dateStr).trim(),
        topic: String(topicForPath || '').trim(),
        studentName: '課程總覽',
        isOverview: 'true'
      };
      
      // 🔥 驗證元數據完整性
      if (!metadata.semester || !metadata.courseName || !metadata.date) {
        console.error('❌ [Drive 上傳] 課程總覽元數據不完整:', metadata);
        throw new Error('元數據不完整: ' + JSON.stringify(metadata));
      }
      
      console.log('📋 [Drive 上傳] 課程總覽元數據:', metadata);
      
      if (summaryText) {
        metadata.comment = String(summaryText).trim();
      }
      
      /**
       * 更新課程總覽上傳 UI（提取為獨立函數，便於異步調用）
       */
      function updateOverviewUploadUI(percent, completed, total, silent, btn, syncFill, syncText) {
        var percentRounded = Math.round(percent);
        
        if (!silent && btn) {
          btn.innerHTML = '<span class="loading"></span> 上傳中 ' + percentRounded + '% (' + completed + '/' + total + ')';
        }
        if (syncFill) {
          syncFill.style.width = percentRounded + '%';
        }
        if (syncText) {
          syncText.textContent = '同步中 ' + percentRounded + '% (' + completed + '/' + total + ')';
          syncText.style.color = '#3b82f6';
        }
        
        console.log('📤 [智能上傳] 總體進度:', percentRounded + '%', completed + '/' + total);
      }
      
      ensureOverviewFilesRegistered();
      var overviewEntry = ensureStudentFileEntry(OVERVIEW_UPLOAD_INDEX, { name: '課程總覽' });
      var mediaSummary = collectPendingMediaSummary(OVERVIEW_UPLOAD_INDEX);

      if (mediaSummary.failed.length > 0) {
        mediaSummary.failed.forEach(function(item) {
          if (!item.meta) return;
          item.meta.enqueued = false;
          if (window.PendingMediaStore && item.meta.tempId) {
            PendingMediaStore.update(item.meta.tempId, { state: 'ready', error: null });
          }
          if (window.PendingMediaActions && item.meta.tempId) {
            PendingMediaActions.updateState(item.meta.tempId, 'ready', '重新排隊…');
          }
        });
        enqueuePendingUploads(OVERVIEW_UPLOAD_INDEX, 'photos');
        enqueuePendingUploads(OVERVIEW_UPLOAD_INDEX, 'videos');
        showToast('部分檔案需要重新上傳，已重新排隊', 'warning');
        if (syncText) {
          syncText.textContent = '等待檔案重新排隊…';
          syncText.style.color = '#f59e0b';
        }
        window.__uploadingOverview = false;
        return;
      }

      if (mediaSummary.pending.length > 0) {
        enqueuePendingUploads(OVERVIEW_UPLOAD_INDEX, 'photos');
        enqueuePendingUploads(OVERVIEW_UPLOAD_INDEX, 'videos');
        showToast('仍有 ' + mediaSummary.pending.length + ' 個檔案上傳中，完成後自動同步', 'info');
        if (syncText) {
          syncText.textContent = '⏳ 檔案上傳中，完成後自動同步…';
          syncText.style.color = '#f59e0b';
        }
        scheduleOverviewAutoSave(1200);
        window.__uploadingOverview = false;
        return;
      }

      var readyMediaIds = mediaSummary.ready.map(function(item) { return item.mediaId; }).filter(Boolean);
      var readyPhotos = mediaSummary.ready.filter(function(item) { return item.type === 'photos'; }).map(function(item) { return item.file; });
      var readyVideos = mediaSummary.ready.filter(function(item) { return item.type === 'videos'; }).map(function(item) { return item.file; });

      var commentChanged = hasOverviewTextChanged();
      var hasSummary = summaryText && summaryText.trim().length > 0;
      if (!readyMediaIds.length && !hasSummary && !commentChanged) {
        showToast('沒有新的照片、影片或文字需要同步', 'warning');
        if (!silent && btn) {
          btn.classList.remove('uploading');
          btn.disabled = false;
          btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 上傳課程總覽';
        }
        if (syncText) {
          syncText.textContent = '尚未偵測到變更';
          syncText.style.color = '#64748b';
        }
        window.__uploadingOverview = false;
        return;
      }

      var canonicalMeta = (function(){ try { return buildRecordOperationMeta('課程總覽') || {}; } catch(e){ return {}; } })();
      var payload = {
        course: metadata.courseName || canonicalMeta.course || (currentCourse.courseName || ''),
        period: (canonicalMeta.period || period || '').replace(/\s+/g, ''),
        date: metadata.date,
        studentName: '課程總覽',
        comment: summaryText,
        overviewSummary: summaryText,
        mediaIds: readyMediaIds,
        isOverview: true,
        coursePeriod: canonicalMeta.coursePeriod || currentCourse.title || (courseName + ' ' + period),
        relativePath: canonicalMeta.relativePathUnified || canonicalMeta.relativePath || metadata.relativePath || '',
        instructorName: (currentCourse && currentCourse.instructor) ? currentCourse.instructor : ((currentTeacher && currentTeacher.name) || '')
      };

      if (typeof UploadCenter !== 'undefined' && UploadCenter && typeof UploadCenter.add === 'function') {
        var overviewMeta = { scope: 'overview-meta', courseKey: getCourseCacheKey(currentCourse), isOverview: true };
        UploadCenter.add(OVERVIEW_UPLOAD_INDEX, 'overview', __ucOverviewIndex, '課程總覽', null, { statusOnReuse: 'uploading', meta: overviewMeta });
      }

      await global.FLB.Api.saveRecordMetadata(payload);

      markUploadedCacheDirty('overview-upload-success', false);
      try { lastOverviewSnapshot = computeOverviewSnapshot(); } catch (_) {}
      try { lastTextSnapshot = computeOverviewTextSnapshot(); } catch (_) {}

      mediaSummary.ready.forEach(function(item) {
        clearPendingMeta(item.file, { removeElement: false });
      });

      overviewEntry.photos = [];
      overviewEntry.videos = [];
          replaceArrayContents(window.overviewPhotosFiles, []);
          replaceArrayContents(window.overviewVideosFiles, []);

      if (typeof refreshProgress === 'function') {
        try { refreshProgress(); } catch (_) {}
      }
      try { if (typeof UploadCenter !== 'undefined' && UploadCenter && typeof UploadCenter.done === 'function') { UploadCenter.done(OVERVIEW_UPLOAD_INDEX, 'overview', __ucOverviewIndex); } } catch (e) {}

      setTimeout(function() {
        cleanupOverviewUploadUI(readyPhotos, readyVideos, '#overviewPhotosPreviews', {
          keepPreview: true,
          enableDeleteAfterSync: true
        });
      }, 300);

      updateDOMAsync(function() {
        if (!silent && btn) {
          btn.classList.remove('uploading');
          btn.classList.add('success');
          var uploadedCount = readyMediaIds.length;
          btn.innerHTML = uploadedCount
            ? '<i class="fas fa-check"></i> 上傳成功 (' + uploadedCount + ' 個檔案)'
            : '<i class="fas fa-check"></i> 文字已同步';
        }
        if (syncText) {
          var uploadedCount = readyMediaIds.length;
          if (uploadedCount) {
            syncText.textContent = '✅ 同步完成 (' + uploadedCount + ' 個檔案)';
          } else if (hasSummary) {
            syncText.textContent = '✅ 文字已同步';
          } else {
            syncText.textContent = '✅ 沒有新媒體，文字已確認';
          }
          syncText.style.color = '#10b981';
          syncText.style.fontWeight = 'bold';
        }
      }, 0);

      if (typeof showToast === 'function') {
        if (readyMediaIds.length) {
          showToast('✅ 課程總覽已同步 ' + readyMediaIds.length + ' 個檔案', 'success');
        } else {
          showToast('✅ 課程總覽文字已同步', 'success');
        }
      }

      if (AUTO_REFRESH_AFTER_UPLOAD) {
        setTimeout(function() {
          updateDOMAsync(function() {
            try {
              if (typeof loadUploadedRecordsForCurrentCourse === 'function') {
                resetUploadedCacheTimestamp('overview-upload-refresh', true);
                loadUploadedRecordsForCurrentCourse({ showLoader: false, retryMissing: true, allowCacheBypass: true }).then(function() {
                  if (currentCourse && typeof window.LearningOverviewRenderer !== 'undefined') {
                    window.LearningOverviewRenderer.render(currentCourse, { skipExisting: true });
                    console.log('✅ [回填] 課程總覽已重新渲染');
                  }
                }).catch(function(e) {
                  console.warn('⚠️ 重新載入課程總覽失敗:', e);
                });
              }
            } catch (e) {
              console.warn('⚠️ 重新載入課程總覽失敗:', e);
            }
          }, 0);
        }, 500);
      } else {
        console.log('🧊 [快取] 略過課程總覽重新載入，沿用本地預覽');
      }

      setTimeout(function() {
        updateDOMAsync(function() {
          if (!silent && btn) {
            btn.classList.remove('success');
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 上傳課程總覽';
            btn.disabled = false;
          }
        }, 0);
      }, 2600);
      
      // 上傳完成後重置標記
      window.__uploadingOverview = false;
      
    } catch (error) {
      console.error('❌ [智能上傳] 異常:', error);
      
      // 🔥 異步恢復 UI（避免阻塞主線程）
      updateDOMAsync(function() {
        if (!silent && btn) {
          btn.classList.remove('uploading');
          btn.classList.add('error');
          btn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 上傳失敗，請重試';
          btn.disabled = false;
        }
        
        if (syncText) {
          syncText.textContent = '❌ 同步失敗';
          syncText.style.color = '#ef4444';
        }
      }, 0);
      
      // 🔥 異步重置錯誤狀態
      setTimeout(function() {
        updateDOMAsync(function() {
          if (!silent && btn) {
            btn.classList.remove('error');
            btn.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> 上傳課程總覽';
          }
        }, 0);
      }, 3000);
      
      showToast('上傳失敗: ' + error.message, 'error');
      try { if (typeof UploadCenter !== 'undefined' && UploadCenter && typeof UploadCenter.fail === 'function') { UploadCenter.fail(OVERVIEW_UPLOAD_INDEX, 'overview', __ucOverviewIndex, error && error.message); } } catch (e) {}
      
    } finally {
      window.__uploadingOverview = false;
    }
  }

  var overviewInputBound = false; // 🔥 防止重複綁定
  
  function setupDragAndDrop() {
    var photoZone = document.getElementById('overviewPhotosDropZone');
    var photoInput = document.getElementById('overviewPhotosInput');
    if (photoZone && photoInput) {
      // 🔥 防止重複綁定事件（課程切換時可能會重新調用）
      if (!overviewInputBound) {
        photoZone.addEventListener('click', function () { 
          var input = document.getElementById('overviewPhotosInput');
          if (input) input.click(); 
        });
        photoInput.addEventListener('change', handleOverviewPhotosSelect);
        photoZone.addEventListener('dragover', function (e) { e.preventDefault(); photoZone.classList.add('dragover'); });
        photoZone.addEventListener('dragleave', function () { photoZone.classList.remove('dragover'); });
        photoZone.addEventListener('drop', function (e) { 
          e.preventDefault(); 
          photoZone.classList.remove('dragover'); 
          var input = document.getElementById('overviewPhotosInput');
          if (input && e.dataTransfer && e.dataTransfer.files) {
            input.files = e.dataTransfer.files; 
            handleOverviewPhotosSelect({ target: input }); 
          }
        });
        overviewInputBound = true;
        console.log('✅ 課程總覽拖放事件已綁定');
      }
    }
  }

  // ============ FAB 抽屜行為 ============
  function setupRecordsDrawer() {
    var fab = document.getElementById('recordsFab');
    var drawer = document.getElementById('recordsDrawer');
    var closeBtn = document.getElementById('recordsDrawerClose');
    if (!fab || !drawer || !closeBtn) return;
    var isOpen = false;
    function openDrawer() {
      if (isOpen) return;
      isOpen = true;
      drawer.classList.add('open');
      try { var bd = document.getElementById('recordsBackdrop'); if (bd) bd.style.display = 'block'; } catch (e) {}
      try { renderDrawerFromState(); } catch (e) {}
      if (!uploadedCacheHydratedAt) {
        requestCourseReload({ showLoader: false, delay: 400, allowCacheBypass: true, reason: 'drawer-open-initial' });
      } else if (AUTO_REFRESH_AFTER_UPLOAD) {
        requestCourseReload({ showLoader: false, delay: 400, allowCacheBypass: true, reason: 'drawer-open-refresh' });
      } else {
        console.log('🧊 [recordsDrawer] 使用既有快取，不觸發重新抓取');
      }
    }
    function closeDrawer() {
      if (!isOpen) return;
      isOpen = false;
      drawer.classList.remove('open');
      try { var bd = document.getElementById('recordsBackdrop'); if (bd) bd.style.display = 'none'; } catch (e) {}
    }
    fab.addEventListener('click', function () { isOpen ? closeDrawer() : openDrawer(); });
    closeBtn.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeDrawer();
    });
    closeBtn.addEventListener('touchend', function (event) {
      event.preventDefault();
      event.stopPropagation();
      closeDrawer();
    });
    drawer.addEventListener('transitionend', function () {
      if (!drawer.classList.contains('open')) isOpen = false;
    });
  }

  function handleOverviewPhotosSelect(event) {
    console.log('🚀🚀🚀 [handleOverviewPhotosSelect] 函數被調用');
    
    // 🔥 全域錯誤捕獲（防止任何錯誤導致頁面刷新）
    try {
      // 🔥 阻止任何預設行為（防止表單提交）
      if (event && event.preventDefault) {
        event.preventDefault();
      }
      if (event && event.stopPropagation) {
        event.stopPropagation();
      }
      
      console.log('✅ [handleOverviewPhotosSelect] 已阻止預設行為');
      
      // 🔥 安全地獲取檔案列表
      var files = null;
      try {
        files = Array.prototype.slice.call((event.target && event.target.files) || []);
        console.log('✅ [handleOverviewPhotosSelect] 成功獲取檔案列表，數量:', files.length);
      } catch (fileErr) {
        console.error('❌ [handleOverviewPhotosSelect] 獲取檔案失敗:', fileErr);
        if (typeof showToast === 'function') {
          showToast('檔案讀取失敗，請重試', 'error');
        }
        return;
      }
      
      var previewContainer = document.getElementById('overviewPhotosPreviews');
      if (!previewContainer) {
        console.error('❌ [handleOverviewPhotosSelect] 找不到預覽容器');
        return;
      }
      
      // 🔥 LIFF 環境檢測（最嚴格的記憶體限制）
      var isLIFF = (function() {
        try {
          return typeof liff !== 'undefined' && liff.isInClient && liff.isInClient();
        } catch (e) {
          return false;
        }
      })();
      
      console.log('📸 [課程總覽] handleOverviewPhotosSelect 處理中');
      console.log('📊 [環境] 檔案數量:', files.length, 'LIFF:', isLIFF ? '是（輕量模式）' : '否（標準模式）');
      
      // 🔥 LIFF 特殊處理：如果檔案過多，立即警告並拒絕
      if (isLIFF && files.length > 3) {
        console.warn('⚠️ [LIFF] 檔案數量過多，超過限制');
        if (typeof showToast === 'function') {
          showToast('LINE 環境限制：一次最多上傳 3 個檔案', 'warning');
        }
        // 清空 input
        if (event.target) {
          event.target.value = '';
        }
        return;
      }
    
    // 🔥 重要：先保存文件到全局變數（無論使用哪種處理方式）
    replaceArrayContents(window.overviewPhotosFiles, []);
    replaceArrayContents(window.overviewVideosFiles, []);
    
    // 分類文件
    files.forEach(function(file) {
      // 🔥 修復：支援 HEIC/HEIF 格式
      var isImage = /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(file.name) || 
                    /^image\//i.test(file.type);
      if (isImage) {
        window.overviewPhotosFiles.push(file);
      } else {
        window.overviewVideosFiles.push(file);
      }
    });
    
    console.log('✅ [課程總覽] 文件已保存到全局變數:', {
      photos: window.overviewPhotosFiles.length,
      videos: window.overviewVideosFiles.length,
      photoFiles: window.overviewPhotosFiles.map(function(f) { return f.name; }),
      videoFiles: window.overviewVideosFiles.map(function(f) { return f.name; })
    });
    
    // 🚀 [新增] 使用共用模組處理（優先）
    if (window.SharedIntegration && typeof window.SharedIntegration.handleOverviewMediaSelect === 'function') {
      try {
        console.log('🎯 [handleOverviewPhotosSelect] 使用共用模組處理');
        window.SharedIntegration.handleOverviewMediaSelect({
          files: files,
          previewContainer: previewContainer,
          onRemovePhoto: removeOverviewPhoto,
          onRemoveVideo: removeOverviewVideo,
          scheduleAutoSave: scheduleOverviewAutoSave,
          onProcessed: function(result){
            try {
              replaceArrayContents(window.overviewPhotosFiles, (result && result.images) ? result.images : []);
              replaceArrayContents(window.overviewVideosFiles, (result && result.videos) ? result.videos : []);
              console.log('✅ [Overview] 已接收處理後檔案:', {
                photos: window.overviewPhotosFiles.length,
                videos: window.overviewVideosFiles.length
              });
              syncOverviewPendingEntries({
                photos: window.overviewPhotosFiles,
                videos: window.overviewVideosFiles,
                replace: true
              });
            } catch (e) { console.warn('⚠️ [Overview] 設定處理後檔案失敗:', e); }
          }
        });
      console.log('✅ [handleOverviewPhotosSelect] 共用模組處理完成');
      return; // 🔥 使用共用模組成功，提前返回（pending 已同步）
      } catch (sharedErr) {
        console.warn('⚠️ [handleOverviewPhotosSelect] 共用模組處理失敗，回退到優化邏輯:', sharedErr);
        // 繼續使用優化邏輯（智能分批處理）
      }
    }
    
    // ============================================
    // 🧠 智能分批處理邏輯（記憶體優化版本）
    // ============================================
    
    // 1. 清空容器並釋放舊的 Blob URL
    Array.prototype.slice.call(previewContainer.querySelectorAll('[data-object-url]')).forEach(function(node) {
      var url = node.getAttribute('data-object-url');
      if (url && url.indexOf('blob:') === 0) {
        try { URL.revokeObjectURL(url); } catch (e) {}
      }
    });
    previewContainer.innerHTML = '';
    
    // 2. 如果沒有檔案，直接返回
    if (!files || !files.length) {
      console.log('✅ [課程總覽] 沒有檔案，預覽容器已清空');
      return;
    }
    
    // 3. 檔案驗證
    var validation = validateFilesBeforeUpload(files);
    if (!validation.valid) {
      alert('⚠️ ' + validation.error);
      // 清空 input
      var input = document.getElementById('overviewPhotosInput');
      if (input) {
        input.value = '';
      }
      return;
    }
    
    // 顯示警告（但允許繼續）
    if (validation.warning) {
      if (typeof window.showToast === 'function') {
        window.showToast(validation.warning, 'warning');
      }
    }
    
    // 4. 分類與排序檔案
    var classifiedFiles = classifyAndSortFiles(files);
    if (!classifiedFiles.length) {
      console.warn('⚠️ 檔案分類失敗');
      return;
    }
    
    // 5. 創建批次
    var batches = createFileBatches(classifiedFiles);
    if (!batches.length) {
      console.warn('⚠️ 批次創建失敗');
      return;
    }
    
    console.log('📦 開始分批處理，共', batches.length, '個批次');
    
    // 🎯 顯示進度面板
    var progressPanel = document.getElementById('overviewUploadProgress');
    var progressStats = document.getElementById('overviewProgressStats');
    var progressFill = document.getElementById('overviewProgressFill');
    var progressStep = document.getElementById('overviewProgressStep');
    var progressEta = document.getElementById('overviewProgressEta');
    
    if (progressPanel) {
      progressPanel.style.display = 'block';
    }
    
    // 更新進度函數
    var startTime = Date.now();
    function updateProgress(current, total, step) {
      var percent = total > 0 ? Math.round((current / total) * 100) : 0;
      
      if (progressStats) {
        progressStats.textContent = current + ' / ' + total;
      }
      
      if (progressFill) {
        var pixelWidth = Math.round(70 * percent / 100);
        progressFill.style.width = pixelWidth + 'px';
      }
      
      if (progressStep) {
        progressStep.textContent = step || '處理中...';
      }
      
      if (progressEta && current > 0 && current < total) {
        var elapsed = Date.now() - startTime;
        var avgTimePerFile = elapsed / current;
        var remaining = (total - current) * avgTimePerFile;
        var seconds = Math.round(remaining / 1000);
        
        if (seconds < 60) {
          progressEta.textContent = '預估剩餘: ' + seconds + ' 秒';
        } else {
          var minutes = Math.floor(seconds / 60);
          var secs = seconds % 60;
          progressEta.textContent = '預估剩餘: ' + minutes + ' 分 ' + secs + ' 秒';
        }
      } else if (progressEta && current === total) {
        progressEta.textContent = '✅ 完成';
      }
    }
    
    // 初始化進度
    updateProgress(0, classifiedFiles.length, '準備中...');
    
    // 6. 先創建所有佔位符
    var fragment = document.createDocumentFragment();
    var placeholderMap = {}; // 儲存佔位符元素，key 為原始索引
    
    // 🔥 [修正] 為照片和影片分別計數 displayIndex（用於進度更新）
    var imageDisplayIndex = 0;
    var videoDisplayIndex = 0;
    var displayIndexMap = {}; // originalIndex -> displayIndex 映射
    
    classifiedFiles.forEach(function(item) {
      var file = item.file;
      var index = item.originalIndex;
      var isImg = item.isImage;
      
      // 為當前檔案分配 displayIndex
      if (isImg) {
        displayIndexMap[index] = imageDisplayIndex;
        imageDisplayIndex++;
      } else {
        displayIndexMap[index] = videoDisplayIndex;
        videoDisplayIndex++;
      }
      
      var placeholderDiv = document.createElement('div');
      placeholderDiv.className = 'file-preview placeholder pending';
      placeholderDiv.id = 'ov-placeholder-' + index;
      placeholderDiv.style.background = '#e2e8f0';
      placeholderDiv.style.display = 'flex';
      placeholderDiv.style.flexDirection = 'column';
      placeholderDiv.style.alignItems = 'center';
      placeholderDiv.style.justifyContent = 'center';
      placeholderDiv.style.minHeight = '120px';
      
      // 圖標
      var icon = document.createElement('i');
      icon.className = isImg ? 'fas fa-image' : 'fas fa-video';
      icon.style.fontSize = '32px';
      icon.style.color = '#94a3b8';
      icon.style.marginBottom = '8px';
      placeholderDiv.appendChild(icon);
      
      // 檔名
      var fileName = document.createElement('div');
      fileName.textContent = file.name;
      fileName.style.fontSize = '12px';
      fileName.style.color = '#64748b';
      fileName.style.textAlign = 'center';
      fileName.style.padding = '0 8px';
      fileName.style.overflow = 'hidden';
      fileName.style.textOverflow = 'ellipsis';
      fileName.style.whiteSpace = 'nowrap';
      fileName.style.maxWidth = '100%';
      placeholderDiv.appendChild(fileName);
      
      // 檔案大小 + 分類標籤
      var sizeLabel = document.createElement('div');
      var sizeMB = item.classification.sizeMB.toFixed(1);
      sizeLabel.textContent = sizeMB + ' MB (' + item.classification.label + ')';
      sizeLabel.style.fontSize = '11px';
      sizeLabel.style.color = '#94a3b8';
      sizeLabel.style.marginTop = '4px';
      placeholderDiv.appendChild(sizeLabel);
      
      // 等待標記
      var waitingLabel = document.createElement('div');
      waitingLabel.textContent = '⏳ 等待處理...';
      waitingLabel.className = 'waiting-label';
      waitingLabel.style.fontSize = '11px';
      waitingLabel.style.color = '#3b82f6';
      waitingLabel.style.marginTop = '8px';
      waitingLabel.style.fontWeight = '600';
      placeholderDiv.appendChild(waitingLabel);
      
      fragment.appendChild(placeholderDiv);
      placeholderMap[index] = placeholderDiv;
    });
    
    previewContainer.appendChild(fragment);
    console.log('✅ 已創建', Object.keys(placeholderMap).length, '個佔位符');
    
    // 7. 分批處理並替換佔位符
    var processedCount = 0;
    var totalFiles = classifiedFiles.length;
    
    function processBatch(batchIndex) {
      if (batchIndex >= batches.length) {
        console.log('🎉 所有批次處理完成！');
        
        // 🎯 更新進度為完成並延遲隱藏面板
        updateProgress(totalFiles, totalFiles, '✅ 全部完成');
        setTimeout(function() {
          if (progressPanel) {
            progressPanel.style.display = 'none';
          }
        }, 2000); // 2 秒後隱藏
        
        // 所有批次完成後，觸發自動上傳
        scheduleOverviewAutoSave();
        return;
      }
      
      var batch = batches[batchIndex];
      var delay = batch.delay;
      
      console.log('📦 處理批次', (batchIndex + 1), '/', batches.length, '(延遲:', delay, 'ms, 檔案:', batch.batchSize, ')');
      
      setTimeout(function() {
        // 處理當前批次的所有檔案
        batch.files.forEach(function(item) {
          var file = item.file;
          var index = item.originalIndex;
          var isImg = item.isImage;
          var placeholder = placeholderMap[index];
          
          // 🔥 [修正] 取得對應的 displayIndex（用於預覽 ID 和進度更新）
          var displayIdx = displayIndexMap[index];
          
          if (!placeholder) {
            console.warn('⚠️ 找不到佔位符，索引:', index);
            return;
          }
          
          // 創建實際預覽（非同步，避免阻塞）
          setTimeout(function() {
            try {
              var previewDiv = document.createElement('div');
              previewDiv.className = 'file-preview new-upload preview-clickable';
              // 🔥 使用 displayIdx 確保與流式上傳的 displayIndex 一致
              previewDiv.id = (isImg ? 'ov-prev-image-' : 'ov-prev-video-') + displayIdx;
              markPreviewForLocalPreserve(previewDiv);
              
              // 🔥 LIFF 環境：完全跳過 Blob URL 創建（防止崩潰）
              if (isLIFF) {
                console.log('📱 [LIFF-輕量模式] 跳過預覽生成:', file.name);
                
                // 統一使用簡單圖標（不載入任何資源）
                var icon = document.createElement('div');
                icon.className = isImg ? 'photo-placeholder-icon' : 'video-placeholder-icon';
                icon.textContent = isImg ? '📷' : '🎬';
                icon.style.cssText = 'font-size:48px;text-align:center;padding:40px 20px;background:#f1f5f9;color:#64748b;';
                previewDiv.appendChild(icon);
                
                var filename = document.createElement('div');
                filename.className = 'file-filename';
                filename.textContent = file.name;
                filename.style.cssText = 'font-size:12px;text-align:center;color:#64748b;padding:10px;word-break:break-all;background:#f8fafc;';
                previewDiv.appendChild(filename);
                
                var sizeInfo = document.createElement('div');
                sizeInfo.className = 'file-size-info';
                sizeInfo.textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
                sizeInfo.style.cssText = 'font-size:11px;text-align:center;color:#94a3b8;padding:5px;';
                previewDiv.appendChild(sizeInfo);
              } else if (isImg) {
                // 照片：創建預覽（使用 Blob URL）
                var url = URL.createObjectURL(file);
                previewDiv.setAttribute('data-object-url', url);
                
                var img = document.createElement('img');
                img.src = url;
                img.alt = '照片';
                previewDiv.appendChild(img);
              } else {
                // 🔥 [批次影片上傳優化] 影片：僅顯示圖標和檔名（不載入到記憶體）
                console.log('⏭️ [課程總覽] 批次影片：輕量級預覽（不載入 video 元素）');
                
                // 影片圖標
                var icon = document.createElement('div');
                icon.className = 'video-placeholder-icon';
                icon.textContent = '🎬';
                icon.style.cssText = 'font-size:48px;text-align:center;padding:40px 20px;background:#f1f5f9;color:#64748b;';
                previewDiv.appendChild(icon);
                
                // 檔名顯示
                var filename = document.createElement('div');
                filename.className = 'video-filename';
                filename.textContent = file.name;
                filename.style.cssText = 'font-size:12px;text-align:center;color:#64748b;padding:10px;word-break:break-all;background:#f8fafc;';
                previewDiv.appendChild(filename);
                
                // 檔案大小
                var sizeInfo = document.createElement('div');
                sizeInfo.className = 'video-size-info';
                sizeInfo.textContent = (file.size / 1024 / 1024).toFixed(1) + ' MB';
                sizeInfo.style.cssText = 'font-size:11px;text-align:center;color:#94a3b8;padding:5px;';
                previewDiv.appendChild(sizeInfo);
              }
              
              // 與學生頁一致：不使用旋轉的 thumb-loading，改為統一的 overlay + 進度
              if (window.SharedPreviewRenderer) {
                try {
                  window.SharedPreviewRenderer.ensureOverlay(previewDiv);
                  window.SharedPreviewRenderer.setProgress(previewDiv, 0, '等待上傳');
                } catch (e) {}
              } else {
                var overlay = document.createElement('div');
                overlay.className = 'file-uploading-overlay';
                // 🔥 [修復 2025-11-18] 不設定 inline style，由 CSS 控制
                // overlay.style.display = 'flex';
                var progressText = document.createElement('span');
                progressText.className = 'progress-text';
                progressText.textContent = '等待上傳';
                overlay.appendChild(progressText);
                var progressBar = document.createElement('div');
                progressBar.className = 'file-upload-progress';
                var progressFill = document.createElement('div');
                progressFill.className = 'file-upload-progress-fill';
                progressFill.style.width = '0px'; // 0% = 0px
                progressBar.appendChild(progressFill);
                overlay.appendChild(progressBar);
                previewDiv.appendChild(overlay);
              }
              
              var removeBtn = document.createElement('button');
              removeBtn.className = 'remove-btn';
              removeBtn.type = 'button';
              if (isImg) {
                removeBtn.onclick = function() { removeOverviewPhoto(index); };
              } else {
                removeBtn.onclick = function() { removeOverviewVideo(index); };
              }
              var removeIcon = document.createElement('i');
              removeIcon.className = 'fas fa-times';
              removeBtn.appendChild(removeIcon);
              previewDiv.appendChild(removeBtn);
              
              // 替換佔位符
              if (placeholder.parentNode) {
                placeholder.parentNode.replaceChild(previewDiv, placeholder);
              }
              
              // 🔥 [修復 2025-11-18] 確保刪除按鈕事件可靠綁定
              // 雖然使用了 onclick 直接賦值，但為了最大可靠性仍調用 ensureDeleteButtonWorks
              if (previewDiv.getAttribute('data-file-id') && typeof ensureDeleteButtonWorks === 'function') {
                try {
                  ensureDeleteButtonWorks(previewDiv);
                } catch (e) {
                  console.warn('⚠️ [課程總覽備援] ensureDeleteButtonWorks 失敗:', e);
                }
              }
              
              processedCount++;
              console.log('✅ 處理完成:', file.name, '(', processedCount, '/', totalFiles, ')');
              
              // 🎯 更新進度
              var classification = item.classification ? item.classification.label : '';
              updateProgress(processedCount, totalFiles, '處理 ' + classification + ' 檔案...');
              
            } catch (e) {
              console.error('❌ 處理檔案失敗:', file.name, e);
              processedCount++;
              
              // 🎯 更新進度（失敗也計入）
              updateProgress(processedCount, totalFiles, '處理失敗，繼續...');
              
              // 更新佔位符為錯誤狀態
              if (waitingLabel) {
                waitingLabel.textContent = '❌ 處理失敗';
                waitingLabel.style.color = '#ef4444';
              }
            }
          }, 50); // 小延遲避免阻塞
        });
        
        // 處理下一個批次
        processBatch(batchIndex + 1);
      }, delay);
    }
    
    // 🔥 文件已在共用模块前统一保存，此处直接开始批次处理
    // 開始處理第一個批次（預覽生成）
    processBatch(0);
    
    // 與學生頁一致：不加入旋轉縮圖指示，改由 overlay + 進度呈現
    syncOverviewPendingEntries({
      photos: window.overviewPhotosFiles,
      videos: window.overviewVideosFiles,
      replace: true
    });
    
    } catch (globalErr) {
      // 🔥 捕獲任何未預期的錯誤（防止頁面刷新）
      console.error('❌ [handleOverviewPhotosSelect] 發生致命錯誤:', globalErr);
      console.error('❌ [錯誤堆疊]', globalErr.stack);
      
      // 顯示友善錯誤訊息
      if (typeof showToast === 'function') {
        showToast('檔案處理失敗：' + (globalErr.message || '未知錯誤'), 'error');
      } else {
        alert('⚠️ 檔案處理失敗\n\n' + (globalErr.message || '請重試或聯繫管理員'));
      }
      
      // 清空 input（允許重新選擇）
      try {
        if (event && event.target) {
          event.target.value = '';
        }
      } catch (e) {}
      
      // 不要讓錯誤繼續傳播
      return;
    }
  }

  
  function removeOverviewPhoto(index) {
    var input = document.getElementById('overviewPhotosInput');
    if (!input) return;
    var dt = new DataTransfer();
    Array.prototype.forEach.call(input.files, function (file, i) { if (i !== index) dt.items.add(file); });
    input.files = dt.files;
    handleOverviewPhotosSelect({ target: input });
  }
  function removeOverviewVideo(index) {
    var input = document.getElementById('overviewPhotosInput');
    if (!input) return;
    var dt = new DataTransfer();
    Array.prototype.forEach.call(input.files, function (file, i) { if (i !== index) dt.items.add(file); });
    input.files = dt.files;
    handleOverviewPhotosSelect({ target: input });
  }
  // ============================================
  // 📤 獨立文字上傳（不等待媒體）
  // ============================================
  var lastTextSnapshot = '';
  var textUploadTimer = null;
  var isUploadingText = false;
  
  /**
   * 僅上傳文字欄位（不包含媒體）
   * 用於文字變更時的即時同步
   */
  async function uploadOverviewTextOnly(options) {
    options = options || {};
    var silent = options.silent !== false; // 預設靜默
    
    // 檢查課程資訊
    if (!currentCourse) {
      console.warn('⚠️ [文字上傳] 沒有當前課程');
      return;
    }
    
    // 防止重複上傳
    if (isUploadingText) {
      console.log('⚠️ [文字上傳] 已有上傳進行中，跳過');
      return;
    }
    
    // 計算文字快照
    var currentTextSnapshot = computeOverviewTextSnapshot();
    
    // 如果文字未變更，跳過
    if (currentTextSnapshot === lastTextSnapshot) {
      console.log('⏭️ [文字上傳] 文字內容未變更，跳過');
      return;
    }
    
    console.log('📝 [文字上傳] 開始上傳文字欄位（純文字模式）...');
    isUploadingText = true;
    
    try {
      // 🔥 確保課程有日期
      if (!currentCourse.date && !currentCourse.formattedDate && currentCourse.start) {
        try {
          var tempDate = new Date(currentCourse.start);
          if (!isNaN(tempDate.getTime())) {
            var year = tempDate.getFullYear();
            var month = String(tempDate.getMonth() + 1).padStart(2, '0');
            var day = String(tempDate.getDate()).padStart(2, '0');
            currentCourse.date = year + '-' + month + '-' + day;
            currentCourse.formattedDate = currentCourse.date;
          }
        } catch (e) {}
      }
      
      // 驗證必要欄位
      if (!currentCourse.date && !currentCourse.formattedDate) {
        console.error('❌ [文字上傳] 課程缺少日期資訊');
        return;
      }
      
      // 獲取課程資訊
      var dateStr = currentCourse.date || currentCourse.formattedDate || '';
      if (!dateStr && currentCourse.start) {
        try {
          var startDate = new Date(currentCourse.start);
          if (!isNaN(startDate.getTime())) {
            dateStr = formatDateTWISO(startDate);
          }
        } catch (e) {}
      }
      
      var parsed = {};
      try {
        if (global.FLB && global.FLB.Course && typeof global.FLB.Course.parseTitle === 'function') {
          parsed = global.FLB.Course.parseTitle(currentCourse.title || '') || {};
        }
      } catch (e) {}
      
      var metaPath = buildRecordOperationMeta('課程總覽');
      
      // 課程基本資訊
      var course = currentCourse.course || currentCourse.courseName || parsed.courseName || '直接上傳';
      var period = currentCourse.period || (parsed.period || '').replace(/\s+/g, '') || '0000';
      var coursePeriod = currentCourse.coursePeriod || '';
      
      // 建立總覽文字區塊
      var autoBlock = buildOverviewBlockFromFields();
      
      console.log('📤 [文字上傳] 發送純文字請求:', {
        course: course,
        period: period,
        date: dateStr,
        hasAutoBlock: !!autoBlock,
        relativePath: metaPath && metaPath.relativePathUnified
      });
      
      var payload = {
        course: currentCourse.title || (course + ' ' + period),
        period: period,
        date: dateStr,
        studentName: '課程總覽',
        comment: autoBlock,
        overviewSummary: autoBlock,
        mediaIds: [],
        isOverview: true,
        coursePeriod: metaPath && metaPath.coursePeriod ? metaPath.coursePeriod : (currentCourse.title || ''),
        relativePath: metaPath && (metaPath.relativePathUnified || metaPath.relativePath) ? (metaPath.relativePathUnified || metaPath.relativePath) : ''
      };

      await global.FLB.Api.saveRecordMetadata(payload);

      lastTextSnapshot = currentTextSnapshot;
      try {
        lastOverviewSnapshot = computeOverviewSnapshot();
      } catch (e) {}
      console.log('✅ [文字上傳] 文字欄位上傳成功（純文字模式）');
      
      markUploadedCacheDirty('overview-text-upload', false);
      if (AUTO_REFRESH_AFTER_UPLOAD) {
        setTimeout(function() {
          console.log('🔄 [快取] 觸發課程總覽重新同步（文字上傳）');
          requestCourseReload({ showLoader: false, delay: 0, allowCacheBypass: true, reason: 'overview-text-upload' });
        }, 500);
      } else {
        console.log('🧊 [快取] 文字上傳完成，保持現有預覽（cache-only 模式）');
      }
      
      try {
        var syncText = document.getElementById('overviewSyncText');
        if (syncText && !window.__uploadingOverview) {
          syncText.textContent = '文字已同步';
          setTimeout(function() {
            if (syncText && !window.__uploadingOverview) {
              syncText.textContent = '已同步';
            }
          }, 2000);
        }
      } catch (e) {}
      
    } catch (e) {
      console.error('❌ [文字上傳] 文字欄位上傳失敗:', e);
    } finally {
      isUploadingText = false;
    }
  }
  
  /**
   * 排程文字上傳（獨立於媒體）
   */
  function scheduleTextOnlyUpload(delayMs) {
    var d = Math.max(0, Math.min(2000, Number(delayMs || 800)));
    try {
      if (!hasOverviewTextChanged()) {
        console.log('⏭️ [文字上傳] 內容未變更，跳過排程');
        return;
      }
      clearTimeout(textUploadTimer);
      textUploadTimer = setTimeout(function(){ 
        try { 
          uploadOverviewTextOnly({ silent: true }); 
        } catch (e) {
          console.error('❌ [排程文字上傳] 失敗:', e);
        } 
      }, d);
    } catch (e) {}
  }
  
  function scheduleOverviewAutoSave(delayMs) {
    var d = Math.max(0, Math.min(2000, Number(delayMs || 300))); // 🔥 減少延遲：500ms → 300ms
    try {
      if (!hasOverviewSnapshotChanged()) {
        console.log('⏭️ [自動上傳] 快照未變更，跳過排程');
        return;
      }
      clearTimeout(overviewScheduleTimer);
      
      // 🔥 顯示「準備上傳」提示（更明顯）
      var syncText = document.getElementById('overviewSyncText');
      if (syncText) {
        syncText.textContent = '📤 準備上傳...';
        syncText.style.color = '#f59e0b';
        syncText.style.fontWeight = 'bold'; // 加粗
      }
      
      // 🔥 同時顯示 Toast 提示（更明顯的反饋）
      if (typeof showToast === 'function') {
        var photoCount = window.overviewPhotosFiles?.length || 0;
        var videoCount = window.overviewVideosFiles?.length || 0;
        if (photoCount > 0 || videoCount > 0) {
          showToast('📸 準備上傳 ' + photoCount + ' 張照片', 'info');
        }
      }
      
      console.log('⏰ [自動上傳] 已排程，將在', d, 'ms 後執行');
      console.log('📸 [自動上傳] 照片數:', window.overviewPhotosFiles?.length || 0);
      console.log('🎬 [自動上傳] 影片數:', window.overviewVideosFiles?.length || 0);
      
      overviewScheduleTimer = setTimeout(function(){ 
        try { 
          console.log('⏰ [自動上傳] 開始執行自動上傳');
          uploadOverview({ silent: true }); 
        } catch (e) {
          console.error('❌ [自動上傳] 失敗:', e);
          if (typeof showToast === 'function') {
            showToast('❌ 自動上傳失敗: ' + e.message, 'error');
          }
        } 
      }, d);
    } catch (e) {
      console.error('❌ [排程失敗]:', e);
    }
  }

  // ============================================
  // 📄 快照計算（分離文字與媒體）
  // ============================================
  
  /**
   * 計算文字欄位快照（僅文字內容）
   */
  function computeOverviewTextSnapshot() {
    try {
      var ids = ['ov_type','ov_date','ov_names','ov_count','ov_teacher','ov_topic','ov_perf','ov_issue','ov_solution'];
      var vals = ids.map(function(id){ 
        var el = document.getElementById(id); 
        return el ? String(el.value || '').trim() : ''; 
      });
      return JSON.stringify({ vals: vals, type: 'text' });
    } catch (e) { 
      return String(Date.now()); 
    }
  }
  
  /**
   * 計算媒體檔案快照（僅檔案）
   */
  function computeOverviewMediaSnapshot() {
    try {
      var ip = document.getElementById('overviewPhotosInput');
      var p = [];
      try { 
        p = Array.prototype.map.call((ip && ip.files) || [], function(f){ 
          return f && (f.name + ':' + f.size); 
        }); 
      } catch (_) {}
      return JSON.stringify({ photos: p, type: 'media' });
    } catch (e) { 
      return String(Date.now()); 
    }
  }
  
  /**
   * 計算完整快照（向後兼容）
   */
  function computeOverviewSnapshot() {
    try {
      var textSnapshot = computeOverviewTextSnapshot();
      var mediaSnapshot = computeOverviewMediaSnapshot();
      return JSON.stringify({ text: textSnapshot, media: mediaSnapshot, type: 'combined' });
    } catch (e) { 
      return String(Date.now()); 
    }
  }

  function hasOverviewTextChanged() {
    try {
      return computeOverviewTextSnapshot() !== lastTextSnapshot;
    } catch (e) {
      return true;
    }
  }

  function hasOverviewSnapshotChanged() {
    try {
      return computeOverviewSnapshot() !== lastOverviewSnapshot;
    } catch (e) {
      return true;
    }
  }

  // 🔥 [新增] 排程檢查處理中的影片（10秒後自動重新載入）
  var PROCESSING_VIDEOS_CHECK_MAX = 6;
  var processingVideosCheckTimer = null;
  var processingVideosCheckAttempts = 0;
  var processingVideosCheckCourseKey = '';
  var processingVideosDetectedThisCycle = false;
  var processingVideosLimitToastShown = false;
  var processingVideosStudents = new Set();
  var pendingDeletionConfirmations = {};
  var MAX_DELETION_CONFIRMATION_ATTEMPTS = 4;
  var DELETION_CONFIRMATION_INITIAL_DELAY = 700;
  
  function resetProcessingVideosCheckState() {
    processingVideosCheckAttempts = 0;
    processingVideosDetectedThisCycle = false;
    processingVideosLimitToastShown = false;
    processingVideosStudents.clear();
    if (processingVideosCheckTimer) {
      clearTimeout(processingVideosCheckTimer);
      processingVideosCheckTimer = null;
    }
  }

  function trackProcessingVideoStudent(name) {
    if (!name) return;
    processingVideosDetectedThisCycle = true;
    processingVideosStudents.add(String(name).trim());
  }
  
  function scheduleProcessingVideosCheck() {
    if (processingVideosStudents.size === 0) {
      return;
    }
    
    var courseKey = getCourseCacheKey(currentCourse || {});
    if (processingVideosCheckCourseKey !== courseKey) {
      var snapshot = Array.from(processingVideosStudents);
      resetProcessingVideosCheckState();
      processingVideosCheckCourseKey = courseKey;
      snapshot.forEach(function(name){ processingVideosStudents.add(name); });
      if (processingVideosStudents.size > 0) {
        processingVideosDetectedThisCycle = true;
      }
      if (processingVideosStudents.size === 0) {
        return;
      }
    }
    
    if (processingVideosCheckAttempts >= PROCESSING_VIDEOS_CHECK_MAX) {
      if (!processingVideosLimitToastShown) {
        processingVideosLimitToastShown = true;
        showToast('影片轉檔時間較長，已暫停自動刷新，請稍後手動更新畫面。', 'warning');
      }
      console.warn('⚠️ 影片仍在處理中，但已達自動重載上限，停止重新整理以免干擾操作。');
      return;
    }
    
    if (processingVideosCheckTimer) {
      return;
    }
    
    processingVideosCheckAttempts++;
    console.log('⏰ 排程影片處理狀態檢查（10秒後執行）', { attempt: processingVideosCheckAttempts });
    processingVideosCheckTimer = setTimeout(async function() {
      processingVideosCheckTimer = null;
      console.log('🔄 執行影片處理狀態檢查...');
      
      var pendingStudents = Array.from(processingVideosStudents);
      processingVideosStudents.clear();
      
      if (pendingStudents.length === 0) {
        console.log('✅ 無待更新的處理中影片，停止刷新');
        resetProcessingVideosCheckState();
        return;
      }
      
      for (var i = 0; i < pendingStudents.length; i++) {
        var name = pendingStudents[i];
        try {
          await refreshStudentRecordByName(name, { silentFallback: true });
        } catch (e) {
          console.warn('⚠️ 檢查影片狀態失敗:', name, e);
        }
      }
      
      if (processingVideosStudents.size > 0) {
        scheduleProcessingVideosCheck();
      } else {
        resetProcessingVideosCheckState();
      }
    }, 10000);
  }
  
  // ============================================
  // 🔒 全局鎖機制（防止重複調用和並發問題）
  // ============================================
  var __loadingUploadedRecords = false;
  var __renderingOverview = false;
  var __lastLoadTimestamp = 0;
  var __minLoadInterval = 1000; // 最小載入間隔 1 秒
  var __lastRenderedCourseKey = null;
  var __lastRenderedAt = 0;
  var __minCourseReloadInterval = 6000; // 同課程最短自動重新整理間隔
  var DRIVE_MISSING_RETRY_INTERVAL = 60000;
  var courseDriveStatusMap = {}; // { state, detectedAt, detail }
  var driveFetchBackoffMap = {}; // { [courseKey]: { timeouts, notFound, lastTimeoutDetail, ... } }

  function getCourseDriveStatus(courseKey) {
    if (!courseKey) return { state: 'unknown', detectedAt: 0 };
    return courseDriveStatusMap[courseKey] || { state: 'unknown', detectedAt: 0 };
  }

  function getDriveFetchStats(courseKey) {
    return driveFetchBackoffMap[courseKey] || null;
  }

  function noteDriveFetchIssue(courseKey, issueType, detail) {
    if (!courseKey) return null;
    var entry = driveFetchBackoffMap[courseKey] || { timeouts: 0, notFound: 0 };
    var now = Date.now();
    if (issueType === 'timeout') {
      entry.timeouts = (entry.timeouts || 0) + 1;
      entry.lastTimeoutAt = now;
      entry.lastTimeoutDetail = detail || null;
    } else if (issueType === 'notFound') {
      entry.notFound = (entry.notFound || 0) + 1;
      entry.lastNotFoundAt = now;
      entry.lastNotFoundDetail = detail || null;
    } else if (issueType === 'reset') {
      entry = { timeouts: 0, notFound: 0 };
    }
    entry.updatedAt = now;
    driveFetchBackoffMap[courseKey] = entry;
    return entry;
  }

  function clearDriveFetchStats(courseKey, issueType) {
    if (!courseKey || !driveFetchBackoffMap[courseKey]) return;
    if (!issueType) {
      delete driveFetchBackoffMap[courseKey];
      return;
    }
    var entry = driveFetchBackoffMap[courseKey];
    if (issueType === 'timeout') {
      entry.timeouts = 0;
      delete entry.lastTimeoutAt;
      delete entry.lastTimeoutDetail;
    } else if (issueType === 'notFound') {
      entry.notFound = 0;
      delete entry.lastNotFoundAt;
      delete entry.lastNotFoundDetail;
    }
    entry.updatedAt = Date.now();
    if (!entry.timeouts && !entry.notFound && !entry.lastTimeoutDetail && !entry.lastNotFoundDetail) {
      delete driveFetchBackoffMap[courseKey];
    } else {
      driveFetchBackoffMap[courseKey] = entry;
    }
  }

  function setCourseDriveStatus(courseKey, status, detail) {
    if (!courseKey) return;
    var normalized = status === 'missing' ? 'missing' : (status === 'ready' ? 'ready' : 'unknown');
    var entry = courseDriveStatusMap[courseKey];
    var incomingDetail = detail ? JSON.stringify(detail) : null;
    var existingDetail = entry && entry.detail ? JSON.stringify(entry.detail) : null;
    if (entry && entry.state === normalized && normalized !== 'missing' && incomingDetail === existingDetail) {
      return;
    }
    courseDriveStatusMap[courseKey] = { state: normalized, detectedAt: Date.now(), detail: detail || null };
    console.log('📂 [Drive 狀態] 更新:', { courseKey: courseKey, status: normalized, detail: detail || null });
  }

  function isDriveMissingThrottled(courseKey, opts) {
    if (!courseKey) return false;
    var entry = getCourseDriveStatus(courseKey);
    if (entry.state !== 'missing') return false;
    var allowRetry = !!(opts && (opts.force || opts.retryMissing));
    if (allowRetry) return false;
    var elapsed = Date.now() - entry.detectedAt;
    return elapsed < DRIVE_MISSING_RETRY_INTERVAL;
  }
  
  async function loadUploadedRecordsForCurrentCourse(opts) {
    if (!currentCourse) {
      console.warn('⚠️ [loadUploadedRecordsForCurrentCourse] currentCourse 为 null，关闭加载状态');
      // 🛡️ [修復 2025-11-18] 确保关闭加载状态
      if (isRecordsLoadingOverlayActive()) {
        setRecordsLoadingState(false);
      }
      return;
    }
    var force = !!(opts && opts.force);
    var courseKey = getCourseCacheKey(currentCourse);
    var driveStatusEntry = getCourseDriveStatus(courseKey);
    var driveStatus = driveStatusEntry.state;
    var missingRecently = isDriveMissingThrottled(courseKey, opts);
    // 顯示時機放寬：僅在明確判定為 missing 時不顯示，其餘（unknown/ready）皆顯示
    var shouldShowLoader = (!hasRenderedUploadedRecords || (opts && opts.showLoader)) && driveStatus !== 'missing';
    var loaderDismissed = false;
    processingVideosDetectedThisCycle = false;
    var now = Date.now();
    var courseLoadEntry = courseLoadStateByKey[courseKey];
    if (!force && courseLoadEntry && courseLoadEntry.ready) {
      console.log('ℹ️ [loadUploadedRecords] 已載入課程 ' + courseKey + '，沿用快取');
      if (shouldShowLoader || isRecordsLoadingOverlayActive()) setRecordsLoadingState(false);
      return;
    }

    if (missingRecently) {
      console.log('ℹ️ [loadUploadedRecords] Drive 目錄仍不可用（節流中），略過同步');
      if (shouldShowLoader || isRecordsLoadingOverlayActive()) setRecordsLoadingState(false);
      return;
    }
    
    // 🔒 檢查鎖狀態
    if (__loadingUploadedRecords) {
      console.warn('⚠️ [loadUploadedRecords] 正在載入中，跳過重複調用');
      __pendingLoadOptions = mergeLoadOptions(__pendingLoadOptions, opts);
      schedulePendingLoad(__minLoadInterval);
      if (shouldShowLoader || isRecordsLoadingOverlayActive()) {
        setRecordsLoadingState(false);
      }
      return;
    }

    if (!force && hasRenderedUploadedRecords && __lastRenderedCourseKey === courseKey) {
      var elapsedSinceRender = now - __lastRenderedAt;
      if (elapsedSinceRender < __minCourseReloadInterval) {
        console.log('ℹ️ [loadUploadedRecords] 同課程於', elapsedSinceRender, 'ms 內已載入，跳過自動重載');
        if (shouldShowLoader || isRecordsLoadingOverlayActive()) {
          setRecordsLoadingState(false);
        }
        return;
      }
    }
    
    // 🔒 檢查最小間隔（防抖）
    var sinceLast = now - __lastLoadTimestamp;
    if (sinceLast < __minLoadInterval && !(opts && opts.force)) {
      console.warn('⚠️ [loadUploadedRecords] 距離上次載入小於 1 秒，跳過');
      __pendingLoadOptions = mergeLoadOptions(__pendingLoadOptions, opts);
      schedulePendingLoad(__minLoadInterval - sinceLast);
      if (shouldShowLoader || isRecordsLoadingOverlayActive()) {
        setRecordsLoadingState(false);
      }
      return;
    }
    
    // 🔗 驗證必要欄位
    if (!currentCourse.id) {
      console.error('❌ 課程缺少 ID，無法載入記錄:', currentCourse);
      if (shouldShowLoader) setRecordsLoadingState(false);
      return;
    }
    
    if (shouldShowLoader) {
      setRecordsLoadingState(true, {
        message: (opts && opts.loadingMessage) || '正在同步學習記錄…',
        subMessage: (opts && opts.loadingSubMessage) || '資料載入完成後會自動更新'
      });
    }
    var skipMissingCheck = (opts && opts.skipMissingCheck) || isMobileDevice();
    
    try {
      // 🔒 設置鎖和時間戳
      __loadingUploadedRecords = true;
      __lastLoadTimestamp = now;
      console.log('🔒 [loadUploadedRecords] 已鎖定');
      
      var nowTs = Date.now();
      
      // 🔥 修復：當 force = true 時，跳過 localStorage 缓存渲染，直接从服务器获取
      if (!force) {
        var shouldHydrateCache = !isMobileDevice();
        if (shouldHydrateCache) {
          // ⚡ 本地快取先 hydrate，提升首屏體感
          try {
            var cacheKey = buildLocalCacheKey();
            var cached = localStorage.getItem(cacheKey);
            if (cached) {
              var parsedLocal = JSON.parse(cached);
              var payload = parsedLocal && parsedLocal.data ? parsedLocal.data : parsedLocal;
              var ts = parsedLocal && parsedLocal.ts ? parsedLocal.ts : 0;
              if (payload && typeof payload === 'object' && payload.__courseKey === courseKey) {
                var sanitizedLocal = sanitizeRecordPayload(payload, courseKey);
                renderUploadedRecords(sanitizedLocal, { courseKey: courseKey, allowOverviewFallback: true });
                if (window.FLB && FLB.State) FLB.State.set({ uploadedRecordsCache: sanitizedLocal });
                uploadedCacheHydratedAt = ts || nowTs;
                try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}
              } else if (payload && payload.__courseKey && payload.__courseKey !== courseKey) {
                console.warn('⚠️ [loadUploadedRecords] 快取課程鍵不符，已忽略');
              }
            }
          } catch (e) {}
        } else {
          console.log('ℹ️ [loadUploadedRecords] 手機裝置跳過快取 hydrate');
        }
      } else {
        console.log('🔄 [loadUploadedRecords] force=true，跳过 localStorage 缓存，直接从服务器获取');
      }
      
      if (!force && uploadedCacheHydratedAt && (nowTs - uploadedCacheHydratedAt) < UPLOADED_CACHE_TTL) {
        console.log('ℹ️ 使用快取資料（快取時間:', Math.round((nowTs - uploadedCacheHydratedAt) / 1000), '秒前）');
        __loadingUploadedRecords = false;
        if (shouldShowLoader) setRecordsLoadingState(false);
        return;
      }
      
      // 🔥 確保日期解析正確（處理可能缺少 start 的情況）
      var dateStr = currentCourse.date || currentCourse.formattedDate || '';
      if (!dateStr && currentCourse.start) {
        try {
          var startDate = new Date(currentCourse.start);
          if (!isNaN(startDate.getTime())) {
            dateStr = formatDateTWISO(startDate);
          }
  } catch (e) {
          console.warn('⚠️ 日期解析失敗:', e);
        }
      }
      
      // 🔥 安全地解析課程標題
      var parsed = {};
      try {
        if (global.FLB && global.FLB.Course && typeof global.FLB.Course.parseTitle === 'function') {
          parsed = global.FLB.Course.parseTitle(currentCourse.title || '') || {};
        }
      } catch (e) {
        console.warn('⚠️ 課程標題解析失敗:', e);
      }
      var courseCandidates = [];
      if (currentCourse.courseName) courseCandidates.push(currentCourse.courseName);
      if (parsed.courseName) courseCandidates.push(parsed.courseName);
      if (parsed.course) courseCandidates.push(parsed.course);
      courseCandidates = Array.from(new Set(courseCandidates));
      var periodRaw = currentCourse.coursePeriod || parsed.period || '';
      var periodCandidates = Array.from(new Set([periodRaw, periodRaw.replace(/\s+/g, '')].filter(Boolean)));

      // 🔧 後備清理函數（如果 CourseNameCleaner 模組未載入）
      function fallbackCleanCourseName(name) {
        if (!name) return '';
        return String(name).trim()
          .replace(/\s+第\d+週/gi, '')
          .replace(/\s+第.{1,3}週/gi, '')
          .replace(/\s+week\s*\d+/gi, '')
          .replace(/\s+w\d+/gi, '')
          .replace(/\s+週\d+/gi, '')
          .replace(/\s*[-_]\s*第\d+週/gi, '')
          .replace(/\s*[-_]\s*week\s*\d+/gi, '')
          .replace(/\s+/g, ' ')
          .replace(/[-_,，、]\s*$/, '')
          .trim();
      }

      var resp = null;
      // ✅ 先嘗試使用完整課程標題（行事曆顯示的全名）直查，但需先清理週次
      var cleanedTitle = '';
      try {
        var fullTitle = (currentCourse && currentCourse.title) ? String(currentCourse.title).trim() : '';
        if (fullTitle) {
          // 🔥 [修復 2025-11-19] 清理課程名稱中的週次，確保與 Drive 上的資料夾名稱匹配
          if (window.CourseNameCleaner && typeof window.CourseNameCleaner.cleanCourseName === 'function') {
            cleanedTitle = window.CourseNameCleaner.cleanCourseName(fullTitle);
            console.log('🧹 [loadUploadedRecords] 使用 CourseNameCleaner 清理:', { original: fullTitle, cleaned: cleanedTitle });
          } else {
            // ⚠️ 後備機制：使用內建清理函數
            cleanedTitle = fallbackCleanCourseName(fullTitle);
            console.log('⚠️ [loadUploadedRecords] CourseNameCleaner 未載入，使用後備清理:', { original: fullTitle, cleaned: cleanedTitle });
          }
          // 🔥 只使用 coursePeriod 參數（已清理），不再傳入 course/period 避免混淆
          resp = await global.FLB.Api.getRecordsByCourse({ coursePeriod: cleanedTitle, date: dateStr });
        }
      } catch (e) { 
        console.log('⚠️ [loadUploadedRecords] 使用清理過的課程名稱查詢失敗:', e.message);
      }
      
      // 🔥 如果第一次查詢失敗，也用清理過的 courseCandidates 重試
      if (!resp && cleanedTitle) {
        // 清理所有候選名稱
        var cleanedCandidates = courseCandidates.map(function(name) {
          if (window.CourseNameCleaner && typeof window.CourseNameCleaner.cleanCourseName === 'function') {
            return window.CourseNameCleaner.cleanCourseName(name);
          }
          // ⚠️ 後備機制
          return fallbackCleanCourseName(name);
        });
        
        for (var i = 0; i < cleanedCandidates.length && !resp; i++) {
          try {
            // 🔥 只使用清理過的單一課程名稱，避免傳入多個參數造成混淆
            var r = await global.FLB.Api.getRecordsByCourse({ 
              coursePeriod: cleanedCandidates[i], 
              date: dateStr 
            });
            if (r && (r.overview || (Array.isArray(r.students) && r.students.length))) { 
              resp = r; 
              console.log('✅ [loadUploadedRecords] 使用清理後的候選名稱找到記錄:', cleanedCandidates[i]);
              break; 
            }
          } catch (e) { /* 忽略嘗試失敗，改用下一組 */ }
        }
      }
      
      // 最後兜底：用只有日期查詢（若後端支援）
      if (!resp && cleanedTitle) {
        try { 
          resp = await global.FLB.Api.getRecordsByCourse({ date: dateStr, coursePeriod: cleanedTitle }); 
        } catch (e) {
          console.log('⚠️ [loadUploadedRecords] 最後兜底查詢也失敗:', e.message);
        }
      }
      // 標記伺服器資料為權威，避免刪檔後縮圖仍殘留
      if (resp && Array.isArray(resp.students)) {
        resp = Object.assign({}, resp, { students: resp.students.map(function (r) { return Object.assign({}, r, { authoritative: true }); }) });
      }
      resp = sanitizeRecordPayload(resp, courseKey);
      if (resp) {
        resp.__authoritative = true;
      }
      var normalizedServerSet = buildNormalizedNameSet(resp && resp.students);
      pruneStudentHistoryForCourse(courseKey, normalizedServerSet);
      clearStudentStateForMissingRecords(courseKey, normalizedServerSet);
      var prev = (window.FLB && FLB.State && FLB.State.get().uploadedRecordsCache) ? FLB.State.get().uploadedRecordsCache : {};
      var merged = isMobileDevice() ? (resp || { overview: null, students: [], meta: {}, path: '', __courseKey: courseKey }) : mergeRecordCaches(prev, resp || {});

      // 🔍 調試：輸出合併後的資料
      console.log('🔍 [loadUploadedRecords] 合併後的資料:', {
        'overview存在': !!merged.overview,
        '學生數量': Array.isArray(merged.students) ? merged.students.length : 0,
        '學生名稱列表': Array.isArray(merged.students) ? merged.students.map(s => s.studentName || s.name || '無名稱') : []
      });

      merged = sanitizeRecordPayload(merged, courseKey);
      renderUploadedRecords(merged, { courseKey: courseKey, allowOverviewFallback: !isMobileDevice() });
      try { 
        if (window.FLB && FLB.State) {
          FLB.State.set({ uploadedRecordsCache: merged });
          console.log('✅ [loadUploadedRecords] 已更新 State 快取');
        }
      } catch (e) {
        console.error('❌ [loadUploadedRecords] 更新 State 失敗:', e);
      }
      try { persistLocalUploadedCache(merged); } catch (e) {}
      uploadedCacheHydratedAt = nowTs;
      try { refreshServerMediaIndex(merged); } catch (e) {}
      try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}
      markCourseLoadReady(courseKey);

      // ❌ 移除自動觸發 render 的代碼（避免重複調用和循環）
      // render 應該由外部顯式調用，或在特定事件後調用
      // 不應該在數據載入函數中自動觸發
      /*
      setTimeout(function() {
        try {
          if (currentCourse && typeof window.LearningOverviewRenderer !== 'undefined') {
            window.LearningOverviewRenderer.render(currentCourse, { skipExisting: true, force: force });
            console.log('✅ [loadUploadedRecords] 課程總覽已重新渲染');
          }
        } catch (e) {
          console.warn('⚠️ [loadUploadedRecords] 觸發課程總覽重新渲染失敗:', e);
        }
      }, 300);
      */
      
      // 同步到抽屜面板
      try {
        var drawer = document.getElementById('recordsDrawerContent');
        if (drawer) { renderDrawerFromState(); }
        // 同步刷新當前學生卡片（讓原欄位顯示既有檔案）
        if (typeof window.FLBStudentPagerHydrate === 'function') {
          console.log('🔄 [loadUploadedRecords] 觸發 FLBStudentPagerHydrate');
          window.FLBStudentPagerHydrate();
        }
        if (typeof renderBottomTabs === 'function') renderBottomTabs();
        // 🖥️ 也要刷新桌面左側清單，避免僅前兩位顯示完成狀態 ✅
        try { renderDesktopStudentList(); } catch (e) {}
      } catch (e) {
        console.error('❌ [loadUploadedRecords] 同步到抽屜失敗:', e);
      }
      updateRecordsFabBadge();

      // 🔄 兜底補齊：若後端回傳的學生記錄不完整，逐一補查缺漏者（僅在強制時）
      try {
        if (force && !skipMissingCheck && window.FLB && FLB.State) {
          var stAll = FLB.State.get();
          var allStudents = Array.isArray(stAll.students) ? stAll.students : [];
          var existing = Array.isArray(merged.students) ? merged.students : [];
          var existingNames = existing.reduce(function (acc, r) { if (r && r.studentName) acc[r.studentName] = true; return acc; }, {});
          var missing = [];
          for (var k = 0; k < allStudents.length; k++) {
            var nm = (allStudents[k] && allStudents[k].name) || '';
            if (nm && !existingNames[nm]) missing.push({ name: nm, index: k });
          }
          if (missing.length) {
            // 限速並行（避免同時大量請求） + 批次模式（抑制重繪）
            var concurrency = 6; // 拆批補齊，避免主線阻塞
            batchFsFetchMode = true;
            var ptr = 0;
            var processed = 0;
            showSyncBadge(processed, missing.length);
            async function runNext() {
              if (ptr >= missing.length) return;
              var item = missing[ptr++];
              try { await fetchStudentFsRecord(item.index, { name: item.name }); } catch (e) {}
              processed++;
              showSyncBadge(processed, missing.length);
              return runNext();
            }
            var workers = [];
            for (var w = 0; w < Math.min(concurrency, missing.length); w++) workers.push(runNext());
            await Promise.all(workers);
            // 完成後刷新一次底部標籤與抽屜
            try { if (typeof renderBottomTabs === 'function') renderBottomTabs(); } catch (e) {}
            try { renderDrawerFromState(); } catch (e) {}
            hideSyncBadge();
            batchFsFetchMode = false;
          }
        } else {
          hideSyncBadge();
          batchFsFetchMode = false;
        }
      } catch (e) { /* 忽略兜底失敗 */ }
      __lastRenderedCourseKey = courseKey;
      __lastRenderedAt = Date.now();
      setCourseDriveStatus(courseKey, 'ready', {
        source: 'loadUploadedRecords',
        forceReload: !!force,
        renderedAt: __lastRenderedAt
      });
    } catch (e) {
      const message = (e && e.message) || '';
      const isTimeout = /408|timeout|超時/i.test(message);
      const isNotFound = /404|不存在/i.test(message);
      const treatAsMissing = isNotFound || isTimeout;
      
      if (treatAsMissing) {
        console.log('ℹ️ [載入記錄] Drive 目錄不可用，標記為 missing');
        setCourseDriveStatus(courseKey, 'missing', {
          source: 'loadUploadedRecords',
          reason: isTimeout ? 'timeout' : 'not-found',
          message: message || ''
        });
        if (!hasRenderedUploadedRecords) {
          renderUploadedRecords({ overview: null, students: [] }, { courseKey: courseKey });
          try {
            if (window.FLB && FLB.State) FLB.State.set({ uploadedRecordsCache: null });
          } catch (err) {}
        }
        if (!isTimeout) {
          showToast('NAS 尚未建立「' + (currentCourse && currentCourse.title || currentCourse && currentCourse.courseName || '課程') + '」資料夾，將在有資料後自動重新同步。', 'info');
        } else {
          showToast('無法連線到 NAS 資料夾，稍後會再試。', 'warning');
        }
      } else {
        console.warn('⚠️ [載入記錄] 載入失敗:', message || e);
        showToast('載入學習記錄失敗：' + (message || '請稍後再試'), 'error');
      }
      if (shouldShowLoader) {
        setRecordsLoadingState(false, {
          status: 'error',
          message: '載入失敗，稍後將自動重試',
          subMessage: '資料已保留，不會影響目前內容',
          showSpinner: false,
          hideAfter: 2600
        });
        loaderDismissed = true;
      }
  } finally {
      // 🔓 釋放鎖
      __loadingUploadedRecords = false;
      console.log('🔓 [loadUploadedRecords] 已解鎖');
      if ((shouldShowLoader && !loaderDismissed) || isRecordsLoadingOverlayActive()) {
        setRecordsLoadingState(false);
      }
      if (!processingVideosDetectedThisCycle && processingVideosStudents.size === 0 && !processingVideosCheckTimer) {
        resetProcessingVideosCheckState();
      }
      if (__pendingLoadOptions) {
        schedulePendingLoad(0);
      }
    }
  }

  function buildLocalCacheKey(){
    try {
      var startDate = new Date(currentCourse.start);
      var dateStr = formatDateTWISO(startDate);
      var title = String(currentCourse.title || currentCourse.courseName || '').trim();
      return 'lr_uc_' + dateStr + '_' + title;
    } catch (e) { return 'lr_uc_default'; }
  }
  function getCourseCacheKey(targetCourse){
    try {
      var course = targetCourse || currentCourse || {};
      var id = course.id || course.eventId || course.courseId || '';
      var title = String(course.title || course.courseName || '').trim();
      var date = course.date || course.formattedDate || '';
      if (!date && course.start) {
        var parsed = new Date(course.start);
        if (!isNaN(parsed.getTime())) {
          date = formatDateTWISO(parsed);
        }
      }
      return [id, title, date].join('|');
    } catch (e) {
      return 'lr_uc_key_fallback';
    }
  }

  function getActiveCourseKeySafe() {
    try {
      var key = getCourseCacheKey(currentCourse);
      return key || '__global__';
    } catch (e) {
      return '__global__';
    }
  }

  function getShadowBuffersForActiveCourse() {
    var key = getActiveCourseKeySafe();
    if (!shadowBuffersByCourse[key]) {
      shadowBuffersByCourse[key] = {};
    }
    return shadowBuffersByCourse[key];
  }

  function getOverviewShadowBufferForActiveCourse() {
    var key = getActiveCourseKeySafe();
    if (!overviewShadowBuffersByCourse[key]) {
      overviewShadowBuffersByCourse[key] = { nodes: [] };
    }
    return overviewShadowBuffersByCourse[key];
  }

  function replaceArrayContents(target, source) {
    if (!target) return source ? source.slice() : [];
    target.length = 0;
    if (Array.isArray(source) && source.length) {
      Array.prototype.push.apply(target, source);
    }
    return target;
  }

  function markPreviewForLocalPreserve(preview) {
    try {
      if (!preview) return;
      preview.setAttribute('data-local-preserve', '1');
    } catch (e) {}
  }

  function getStudentNameByIndex(index) {
    try {
      if (index === OVERVIEW_UPLOAD_INDEX) return '課程總覽';
      var courseStudent = (currentCourse && Array.isArray(currentCourse.students))
        ? currentCourse.students[index]
        : null;
      if (courseStudent && courseStudent.name) return String(courseStudent.name);
      if (window.FLB && FLB.State) {
        var st = FLB.State.get();
        if (st && Array.isArray(st.students) && st.students[index] && st.students[index].name) {
          return String(st.students[index].name);
        }
      }
    } catch (e) {}
    return '';
  }

  function shouldPreservePreviewNode(node) {
    if (!node) return false;
    
    // 🔍 [調試] 記錄節點資訊
    var nodeInfo = {
      className: node.className,
      hasSyncedPreview: node.classList && node.classList.contains('synced-preview'),
      hasUploadSuccess: node.classList && node.classList.contains('upload-success'),
      hasSynced: node.classList && node.classList.contains('synced'),
      'data-local-preserve': node.getAttribute && node.getAttribute('data-local-preserve'),
      'data-temp-id': node.hasAttribute && node.hasAttribute('data-temp-id'),
      'data-awaiting-sync': node.hasAttribute && node.hasAttribute('data-awaiting-sync'),
      'data-synced': node.hasAttribute && node.hasAttribute('data-synced')
    };
    
    // ✅ 明確標記為本地保留的節點
    if (node.getAttribute && node.getAttribute('data-local-preserve') === '1') {
      console.log('✅ [shouldPreserve] 保留 (data-local-preserve):', nodeInfo);
      return true;
    }
    if (node.hasAttribute && node.hasAttribute('data-temp-id')) {
      console.log('✅ [shouldPreserve] 保留 (data-temp-id):', nodeInfo);
      return true;
    }
    
    // ✅ 保留上傳中的節點
    if (node.classList && (node.classList.contains('uploading') || node.classList.contains('loading'))) {
      console.log('✅ [shouldPreserve] 保留 (uploading/loading):', nodeInfo);
      return true;
    }
    
    // ✅ 保留剛上傳完成的節點（有這些類別代表是本地上傳完成，尚未被伺服器回填取代）
    if (node.classList && (node.classList.contains('upload-success') || node.classList.contains('synced') || node.classList.contains('synced-preview'))) {
      console.log('✅ [shouldPreserve] 保留 (upload-success/synced/synced-preview):', nodeInfo);
      return true;
    }
    
    // ✅ 保留有 data-awaiting-sync 的節點（已上傳完成但尚未從伺服器回填）
    if (node.hasAttribute && node.hasAttribute('data-awaiting-sync')) {
      console.log('✅ [shouldPreserve] 保留 (data-awaiting-sync):', nodeInfo);
      return true;
    }
    
    // ✅ 保留有 data-synced 的節點（本地上傳後已標記為同步完成）
    if (node.hasAttribute && node.hasAttribute('data-synced')) {
      console.log('✅ [shouldPreserve] 保留 (data-synced):', nodeInfo);
      return true;
    }
    
    // ✅ 保留正在上傳的節點（new-upload 但尚未完成）
    if (node.classList && node.classList.contains('new-upload') && !node.classList.contains('upload-success')) {
      console.log('✅ [shouldPreserve] 保留 (new-upload):', nodeInfo);
      return true;
    }
    
    // ❌ [關鍵修復] 移除 data-media-id 作為保留條件
    // 原因：從伺服器回填的舊節點也會有 data-media-id，導致它們被錯誤保留
    // 只有明確標記為「本地上傳相關」的節點才應該被保留
    
    console.log('❌ [shouldPreserve] 不保留:', nodeInfo);
    return false;
  }

  function normalizeToken(token) {
    return String(token || '')
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[\u3000]/g, '');
  }

  function decodePathSafe(path) {
    try {
      return decodeURIComponent(String(path || ''));
    } catch (e) {
      return String(path || '');
    }
  }

  function buildCourseIdentityTokens() {
    var course = currentCourse || {};
    var tokens = [];
    if (course.title) tokens.push(course.title);
    if (course.courseName) tokens.push(course.courseName);
    if (course.coursePeriod) tokens.push(course.coursePeriod);
    if (course.course && course.course !== course.courseName) tokens.push(course.course);
    return tokens
      .map(function (token) { return normalizeToken(decodePathSafe(token)); })
      .filter(Boolean);
  }

  function doesPathBelongToCurrentCourse(path) {
    if (!currentCourse) return false;
    var decoded = normalizeToken(decodePathSafe(path));
    if (!decoded) return false;
    var date = currentCourse.date || currentCourse.formattedDate || '';
    if (!date && currentCourse.start) {
      try {
        var parsed = new Date(currentCourse.start);
        if (!isNaN(parsed.getTime())) {
          date = formatDateTWISO(parsed);
        }
      } catch (e) {}
    }
    if (date) {
      var normalizedDate = normalizeToken(date);
      if (decoded.indexOf(normalizedDate) === -1) {
        return false;
      }
    }
    var tokens = buildCourseIdentityTokens();
    if (!tokens.length) return true;
    return tokens.some(function (token) {
      return decoded.indexOf(token) !== -1;
    });
  }

  function isStudentRecordFromCurrentCourse(record) {
    if (!record || !currentCourse) return false;
    var recordCoursePeriod = normalizeToken(record.coursePeriod || '');
    var currentCoursePeriod = normalizeToken(currentCourse.coursePeriod || currentCourse.title || currentCourse.courseName || '');
    if (recordCoursePeriod && currentCoursePeriod && recordCoursePeriod === currentCoursePeriod) {
      return true;
    }
    var relativePath = record.relativePath || record.path || (record.files && record.files.relativePath) || '';
    if (relativePath && doesPathBelongToCurrentCourse(relativePath)) return true;
    if (record.semester && currentCourse.semester) {
      if (String(record.semester).trim() !== String(currentCourse.semester).trim()) return false;
    }
    // 如果缺少路徑資訊但課程名稱吻合，也允許
    var nameTokens = buildCourseIdentityTokens();
    if (nameTokens.length && record.course && normalizeToken(record.course) === nameTokens[0]) return true;
    return false;
  }

  function sanitizeRecordPayload(data, courseKey) {
    if (!data) return { overview: null, students: [], __courseKey: courseKey };
    if (!currentCourse) {
      var fallback = Object.assign({}, data);
      if (courseKey) fallback.__courseKey = courseKey;
      return fallback;
    }
    var payload = {
      overview: data.overview || null,
      students: Array.isArray(data.students) ? data.students.slice() : [],
      path: data.path || '',
      meta: Object.assign({}, data.meta || {}),
      __courseKey: courseKey || data.__courseKey || null
    };
    if (payload.overview) {
      var overviewPath = payload.overview.relativePath || payload.overview.path || '';
      if (!doesPathBelongToCurrentCourse(overviewPath)) {
        console.warn('⚠️ [sanitizeRecordPayload] 移除不屬於此課程的課程總覽:', overviewPath);
        payload.overview = null;
      }
    }
    payload.students = payload.students.filter(function (record) {
      var ok = isStudentRecordFromCurrentCourse(record);
      if (!ok) {
        console.warn('⚠️ [sanitizeRecordPayload] 移除不屬於此課程的學生記錄:', record && record.studentName, record && (record.relativePath || record.path));
      }
      return ok;
    });
    return payload;
  }
  function persistLocalUploadedCache(data){
    try {
      var key = buildLocalCacheKey();
      localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data: data }));
    } catch (e) {}
  }

  function updateRecordsFabBadge() {
    var badge = document.getElementById('recordsFabBadge');
    if (!badge) return;
    try {
      var count = 0;
      if (window.FLB && FLB.State) {
        var st = FLB.State.get();
        var cache = st && st.uploadedRecordsCache ? st.uploadedRecordsCache : {};
        var arr = Array.isArray(cache.students) ? cache.students : [];
        count = arr.filter(function (rec) {
          if (!rec) return false;
          var photoTotal = rec.photos != null ? rec.photos : ((rec.files && rec.files.photos && rec.files.photos.length) || 0);
          var videoTotal = rec.videos != null ? rec.videos : ((rec.files && rec.files.videos && rec.files.videos.length) || 0);
          // ➕ 計入本地暫存的檔案數，以便徽章立即反映
          if (rec.localFiles) {
            if (Array.isArray(rec.localFiles.photos)) photoTotal += rec.localFiles.photos.length;
            if (Array.isArray(rec.localFiles.videos)) videoTotal += rec.localFiles.videos.length;
          }
          var hasComment = !!((rec.comment || '').trim().length);
          return photoTotal > 0 || videoTotal > 0 || hasComment;
        }).length;
      }
      if (count > 0) {
        badge.textContent = count > 99 ? '99+' : String(count);
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    } catch (e) {
      badge.style.display = 'none';
    }
  }

  function renderDrawerFromState() {
    try {
      if (!(window.FLB && FLB.State)) return;
      var st = FLB.State.get();
      var data = st.uploadedRecordsCache || {};
      var drawer = document.getElementById('recordsDrawerContent');
      if (!drawer) return;
      var parts = [];
      if (data.overview) {
        var ovp = data.overview.photos || 0; var ovv = data.overview.videos || 0;
        var photoStat = '<span class="media-stat photo-stat"><i class="fas fa-image"></i> <strong>' + ovp + '</strong> 張</span>';
        var videoStat = '<span class="media-stat video-stat"><i class="fas fa-video"></i> <strong>' + ovv + '</strong> 支</span>';
        parts.push('<div class="overview-stats" style="margin-bottom:8px"><i class="fas fa-clipboard-list"></i> 課程總覽' + photoStat + videoStat + '</div>');
      }
      var arr = Array.isArray(data.students) ? data.students : [];
      if (arr.length === 0) {
        parts.push('<div class="empty-state"><i class="fas fa-folder-open"></i> 尚無學生記錄</div>');
      } else {
        parts.push(arr.map(function (r) {
          var sid = encodeURIComponent(r.studentName || '');
          
          // 🔥 [重要修復] 優先使用新媒體系統數據
          var photos = [];
          var videos = [];
          
          if (Array.isArray(r.newMediaPhotos) && r.newMediaPhotos.length > 0) {
            // 新媒體系統：使用 newMediaPhotos (物件陣列)
            photos = r.newMediaPhotos;
            console.log('📸 [抽屜-新系統] 學生照片:', r.studentName, photos.length, '張');
          } else if (Array.isArray(r.files && r.files.photos)) {
            // 舊系統：使用 files.photos (字串陣列)
            photos = r.files.photos.filter(function (fn) { 
              return typeof fn === 'string' && isImageFilename(fn) && !isGeneratedThumbnailName(fn); 
            });
            console.log('📸 [抽屜-舊系統] 學生照片:', r.studentName, photos.length, '張');
          }
          
          if (Array.isArray(r.newMediaVideos) && r.newMediaVideos.length > 0) {
            // 新媒體系統：使用 newMediaVideos (物件陣列)
            videos = r.newMediaVideos;
            console.log('🎬 [抽屜-新系統] 學生影片:', r.studentName, videos.length, '個');
          } else if (Array.isArray(r.files && r.files.videos)) {
            // 舊系統：使用 files.videos (字串陣列)
            videos = r.files.videos.filter(function (fn) { 
              return typeof fn === 'string' && isVideoFilename(fn); 
            });
            console.log('🎬 [抽屜-舊系統] 學生影片:', r.studentName, videos.length, '個');
          }
          
          var localPhotos = (r.localFiles && Array.isArray(r.localFiles.photos)) ? r.localFiles.photos : [];
          var localVideos = (r.localFiles && Array.isArray(r.localFiles.videos)) ? r.localFiles.videos : [];
          // 🔥 [修復 2025-11-17] 本地檔案應該視為已上傳（不再顯示 local 樣式）
          // 因為到這個階段，檔案已經上傳到 Drive，只是還沒有正式的檔案 ID
          var localPhotoBlocks = localPhotos.map(function (url, idx) {
            // 🔥 [修復 2025-11-23] 添加保留標記，確保切換學生時不會丟失這些節點
            // 🔥 [簡化 2025-11-23] 移除 thumb-loading 元素
            return '<div class="file-preview existing synced-preview upload-success preview-clickable" data-preview-type="image" data-preview-url="' + global.FLB.Course.escapeHtml(url) + '" data-local-url="' + global.FLB.Course.escapeHtml(url) + '" data-student="' + global.FLB.Course.escapeHtml(r.studentName) + '" data-awaiting-sync="1" data-synced="1" data-local-preserve="1">' +
              '<img src="' + url + '" alt="照片">' +
              '<button class="remove-btn" type="button" onclick="return false;" style="opacity:0.5;cursor:not-allowed;" title="請重新載入後刪除"><i class="fas fa-times"></i></button>' +
            '</div>';
          }).join('');
      var localVideoBlocks = localVideos.map(function (url, idx) {
        var cacheKeyLocal = normalizeThumbKey(url);
        var pc = videoPosterCache[cacheKeyLocal] || '';
        // 🔥 [修復 2025-11-23] 添加保留標記，確保切換學生時不會丟失這些節點
        return '<div class="file-preview existing synced-preview upload-success preview-clickable" data-preview-type="video" data-preview-url="' + global.FLB.Course.escapeHtml(url) + '" data-local-url="' + global.FLB.Course.escapeHtml(url) + '" data-student="' + global.FLB.Course.escapeHtml(r.studentName) + '" data-awaiting-sync="1" data-synced="1" data-local-preserve="1">' +
          '<video src="' + url + '" preload="metadata" muted playsinline crossorigin="anonymous"' + (pc ? (' poster="' + pc + '"') : '') + '></video>' +
          '<img class="video-poster" alt="" aria-hidden="true" ' + (pc ? ('style="display:block" src="' + pc + '"') : 'style="display:none" src=""') + ' />' +
          '<div class="video-fallback-icon" aria-hidden="true"' + (pc ? ' style="display:none"' : '') + '>🎬</div>' +
          '<button class="remove-btn" type="button" onclick="return false;" style="opacity:0.5;cursor:not-allowed;" title="請重新載入後刪除"><i class="fas fa-times"></i></button>' +
        '</div>';
      }).join('');
          var thumbMapDrawer = {};
          if (r && r.videoThumbnails && typeof r.videoThumbnails === 'object') thumbMapDrawer = r.videoThumbnails;
          else if (r && r.files && r.files.videoThumbnails && typeof r.files.videoThumbnails === 'object') thumbMapDrawer = r.files.videoThumbnails;
          var relativePathHintDrawer = safeResolveRelativePathHint(r);
          var courseNameHintDrawer = r.courseName || '';
          var semesterHintDrawer = r.semester || '';

          // 🔥 照片渲染：區分新舊系統
          var photoBlocks = photos.map(function (pItem) {
            var isNewSystem = (typeof pItem === 'object' && pItem !== null && pItem.id);
            var filename;
            if (typeof pItem === 'string') {
              filename = pItem;
            } else if (typeof pItem === 'object' && pItem !== null) {
              // 優先使用 filename，其次 name，最後 path
              filename = pItem.filename || pItem.name || pItem.path || '';
            } else {
              filename = String(pItem || '');
            }
            var photoId = isNewSystem ? pItem.id : null;
            var url;
            
            if (isNewSystem) {
              // 新系統：使用 Drive proxy (proxyUrl)
              var coursePeriod = r.coursePeriod || '';
              var date = r.date || '';
              var studentName = r.studentName || '';
              url = buildDrivePhotoPreviewUrl(photoId, r, {
                date: date,
                studentName: studentName,
                coursePeriod: coursePeriod,
                courseName: courseNameHintDrawer,
                semester: semesterHintDrawer,
                relativePath: relativePathHintDrawer
              });
            } else {
              // 舊系統：使用傳統 buildRecordFileUrl
              url = buildRecordFileUrl(r, filename);
            }
            
            // 🔥 [修復 2025-11-23] 所有從 newMediaPhotos 渲染的節點都應該被保留
            // 不應該檢查 localFiles（重新載入後 localFiles 是空的）
            var preserveClasses = ['synced-preview'];
            
            var displayName = isNewSystem ? (pItem.originalName || filename) : filename;
            var removeHandler = "return deleteStudentFile(this, '" + (r.studentName || '').replace(/'/g, "\\'") + "', '" + filename.replace(/'/g, "\\'") + "')";
            return buildMediaPreviewHtml({
              type: 'image',
              previewUrl: url,
              filename: displayName,
              removable: true,
              removeHandler: removeHandler,
              lazy: false,
              forceReady: true,
              recordPath: relativePathHintDrawer || r.relativePath || r.recordPath || '',
              extraClasses: preserveClasses
            });
          }).join('');
      // 🔥 [最終修復] 過濾掉可能不存在的視頻（沒有縮略圖的新系統視頻）
      var validVideos = videos.filter(function(vItem) {
        var isNewSystem = (typeof vItem === 'object' && vItem.id);
        if (!isNewSystem) return true; // 舊系統視頻保留
        
        // 🔥 [修復] 新系統視頻：允許顯示沒有縮圖的影片（使用預設圖標）
        if (!vItem.thumbnailFilename || vItem.thumbnailFilename.trim() === '') {
          console.log('⚠️ [課程總覽-顯示無縮圖視頻] 將顯示預設圖標:', { id: vItem.id, filename: vItem.filename, status: vItem.status });
          // 不再過濾掉，允許顯示
        }
        
        return true;
      });
      
      console.log('🔍 [課程總覽-視頻過濾] 原始數量:', videos.length, '過濾後:', validVideos.length);
      
      // 🔥 影片渲染：區分新舊系統
      var videoBlocks = validVideos.map(function (vItem) {
        var isNewSystem = (typeof vItem === 'object' && vItem !== null && vItem.id);
        var filename;
        if (typeof vItem === 'string') {
          filename = vItem;
        } else if (typeof vItem === 'object' && vItem !== null) {
          filename = vItem.filename || vItem.name || vItem.path || '';
        } else {
          filename = String(vItem || '');
        }
        var normalizedMeta = isNewSystem ? normalizeVideoMeta(vItem) : null;
        var videoId = (normalizedMeta && normalizedMeta.id) || (isNewSystem ? vItem.id : null);
        var sourceFilename = (normalizedMeta && normalizedMeta.filename) || filename;
        var url = '';
        if (normalizedMeta) {
          url = resolveVideoMetaUrl(r, normalizedMeta, false);
        }
        if (!url) {
          url = buildRecordFileUrl(r, sourceFilename || filename);
        }
        if (!url && videoId) {
          console.warn('⚠️ [課程總覽] 缺少 Drive 代理，影片暫無法預覽:', { videoId: videoId });
        }
        
        var thumbUrl = '';
        if (normalizedMeta) {
          thumbUrl = resolveVideoMetaUrl(r, normalizedMeta, true) || '';
        }
        if (!thumbUrl) {
          if (isNewSystem && vItem.thumbnailFilename) {
            thumbUrl = buildRecordFileUrl(r, vItem.thumbnailFilename);
          } else {
            var legacyThumb = thumbMapDrawer && thumbMapDrawer[filename];
            thumbUrl = legacyThumb ? buildRecordFileUrl(r, legacyThumb) : '';
          }
        }
        
        var relatedVideoFilesDrawer = [];
        if (isNewSystem) {
          addRelatedFile(relatedVideoFilesDrawer, vItem.thumbnailFilename || (normalizedMeta && normalizedMeta.thumbnailFilename));
          addRelatedFile(relatedVideoFilesDrawer, vItem.transcodedFilename || (normalizedMeta && normalizedMeta.transcodedFilename));
        } else if (thumbMapDrawer && thumbMapDrawer[filename]) {
          addRelatedFile(relatedVideoFilesDrawer, thumbMapDrawer[filename]);
        }
        
        // 🔥 [修復 2025-11-23] 所有從 newMediaVideos 渲染的節點都應該被保留
        // 不應該檢查 localFiles（重新載入後 localFiles 是空的）
        var preserveVideoClasses = ['synced-preview'];
        
        var displayName = isNewSystem ? (vItem.originalName || filename) : filename;
        var removeHandler = "return deleteStudentFile(this, '" + (r.studentName || '').replace(/'/g, "\\'") + "', '" + filename.replace(/'/g, "\\'") + "')";
        return buildMediaPreviewHtml({
          type: 'video',
          previewUrl: url,
          thumbUrl: thumbUrl,
          filename: displayName,
          sourceFilename: sourceFilename,
          removable: true,
          removeHandler: removeHandler,
          lazy: false,
          forceReady: true,
          videoId: videoId,
          recordPath: relativePathHintDrawer || r.relativePath || r.recordPath || '',
          mediaId: videoId,
          relatedFiles: relatedVideoFilesDrawer,
          extraClasses: preserveVideoClasses
        });
      }).join('');
          var filesHtml = (localPhotoBlocks + localVideoBlocks + photoBlocks + videoBlocks) || '<div style="color:#94a3b8;font-size:13px">尚無檔案</div>';
          var safeComment = global.FLB.Course.escapeHtml(r.comment || '');
          return '' +
          '<div class="record-item" data-student="' + sid + '" style="border-bottom:1px solid rgba(0,0,0,.06);padding:8px 0">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">' +
              '<div style="font-weight:700"><i class="fas fa-user"></i> ' + global.FLB.Course.escapeHtml(r.studentName || '') + '</div>' +
              '<div><button class="nav-btn" onclick="toggleDrawerEdit(\'' + (r.studentName || '').replace(/'/g, "\\'") + '\')"><i class="fas fa-edit"></i> 編輯</button></div>' +
            '</div>' +
            '<div style="display:flex;gap:6px;flex-wrap:wrap">' + filesHtml + '</div>' +
            '<div id="drawer-comment-' + sid + '" style="margin-top:6px;font-size:13px;color:#334155">' + safeComment + '</div>' +
            '<div id="drawer-edit-' + sid + '" style="display:none;margin-top:8px">' +
              '<textarea id="drawer-edit-text-' + sid + '" class="comment-area" style="min-height:80px">' + (r.comment || '') + '</textarea>' +
              '<div style="display:flex;gap:8px;margin-top:8px">' +
                '<button class="nav-btn" onclick="saveDrawerEdit(\'' + (r.studentName || '').replace(/'/g, "\\'") + '\')"><i class="fas fa-save"></i> 儲存</button>' +
                '<button class="nav-btn" onclick="cancelDrawerEdit(\'' + (r.studentName || '').replace(/'/g, "\\'") + '\')"><i class="fas fa-times"></i> 取消</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        }).join(''));
      }
      drawer.innerHTML = parts.join('');
      try { setupLazyMedia(drawer); attachThumbLoadingHandlers(drawer); } catch (e) {}
      
      // 🔥 智能生成影片縮圖
      try {
        processPosterContainer(drawer);
      } catch (e) {
        console.warn('⚠️ [抽屜] 智能縮圖生成失敗:', e);
      }
      
      updateRecordsFabBadge();
    } catch (e) {}
  }

  // ======== 抽屜內直編：編輯、刪檔、快取局部更新 ========
  function toggleDrawerEdit(studentName) {
    var sid = encodeURIComponent(studentName || '');
    var el = document.getElementById('drawer-edit-' + sid);
    if (!el) return;
    el.style.display = (el.style.display === 'none' || !el.style.display) ? 'block' : 'none';
  }

  async function saveDrawerEdit(studentName) {
    if (!currentCourse) return;
    var sid = encodeURIComponent(studentName || '');
    var textarea = document.getElementById('drawer-edit-text-' + sid);
    var comment = (textarea && textarea.value) || '';
    try {
      var meta = buildRecordOperationMeta(studentName);
      
      // 🆕 使用新 API v2 (纯文字评语保存)
      console.log('📝 [v2] 保存評語:', studentName, comment.substring(0, 50) + '...');
      await global.FLB.Api.uploadRecordV2({
        course: meta.course,
        period: meta.period,
        date: meta.date,
        studentName: studentName,
        comment: comment,
        instructorName: (currentCourse && currentCourse.instructor) ? currentCourse.instructor : ((currentTeacher && currentTeacher.name) || ''),
        coursePeriod: meta.coursePeriod,
        relativePath: meta.relativePath,
        photos: [],  // 無檔案
        videos: []   // 無檔案
      });
      
      // 🔒 旧代码（已注释，使用新 API v2 代替）
      // await global.FLB.Api.updateRecord({ course: meta.course, period: meta.period, date: meta.date, studentName: studentName, comment: comment, coursePeriod: meta.coursePeriod, relativePath: meta.relativePath });
      
      // 局部更新快取
      if (window.FLB && FLB.State) {
        var st = FLB.State.get();
        var cache = Object.assign({}, st.uploadedRecordsCache || {});
        var list = Array.isArray(cache.students) ? cache.students.slice() : [];
        var idx = list.findIndex(function (x) { return (x.studentName || '') === (studentName || ''); });
        if (idx >= 0) { list[idx] = Object.assign({}, list[idx], { comment: comment }); }
        cache.students = list;
        FLB.State.set({ uploadedRecordsCache: cache });
      }
      // 局部 UI 更新
      var commentDiv = document.getElementById('drawer-comment-' + sid);
      if (commentDiv) commentDiv.textContent = comment;
      toggleDrawerEdit(studentName);
      // 主卡也刷新現況
      try { var st2 = FLB.State.get(); renderStudentPager(st2.selectedCourse, st2.currentStudentIndex || 0); } catch (e) {}
      showToast('已更新評論', 'success');
    } catch (e) { console.error(e); showToast('更新失敗：' + (e.message || ''), 'error'); }
  }

  function cancelDrawerEdit(studentName) { toggleDrawerEdit(studentName); }

  async function deleteDrawerFile(triggerEl, studentName, filename) {
    if (typeof triggerEl === 'string' && typeof studentName === 'string' && typeof filename === 'undefined') {
      // 向後相容：僅傳入 (studentName, filename)
      return deleteStudentFile(null, triggerEl, studentName);
    }
    return deleteStudentFile(triggerEl, studentName, filename);
  }

  var lastOverviewRenderState = { key: '', data: null, grid: '', summary: '', updatedAt: 0 };

  function cloneOverviewData(src) {
    try {
      return JSON.parse(JSON.stringify(src || null));
    } catch (e) {
      if (!src || typeof src !== 'object') return src;
      return Object.assign({}, src);
    }
  }

  function rememberOverviewRenderState(courseKey, overviewData, gridHtml) {
    try {
      lastOverviewRenderState = {
        key: courseKey || '',
        data: cloneOverviewData(overviewData),
        grid: gridHtml || '',
        summary: (overviewData && overviewData.summary) || '',
        updatedAt: Date.now()
      };
    } catch (e) {
      console.warn('⚠️ [OverviewCache] 快取課程總覽資料失敗:', e);
    }
  }

  function renderUploadedRecords(data, options) {
    var container = document.getElementById('uploadedRecordsSection');
    if (!container) return;
    
    // 🔥 [調試 2025-11-27] 添加調試日誌確認函數被調用
    console.log('🚨 [調試] renderUploadedRecords 被調用:', {
      timestamp: new Date().toISOString(),
      options: options,
      dataKeys: Object.keys(data || {}),
      hasStudents: !!(data && data.students && data.students.length)
    });
    
    hasRenderedUploadedRecords = true;
    var opts = options || {};
    var courseKey = opts.courseKey || getCourseCacheKey();
    var allowOverviewFallback = !!opts.allowOverviewFallback;
    var activeKey = getCourseCacheKey();
    if (courseKey && activeKey && courseKey !== activeKey) {
      console.warn('⚠️ [renderUploadedRecords] 課程鍵不匹配，略過渲染', { courseKey: courseKey, activeKey: activeKey });
      return;
    }
    var dataset = (data && typeof data === 'object') ? data : {};
    var overviewFromCache = false;
    if (!dataset.overview && allowOverviewFallback && lastOverviewRenderState.key === courseKey && lastOverviewRenderState.data) {
      dataset = Object.assign({}, dataset, { overview: cloneOverviewData(lastOverviewRenderState.data) });
      overviewFromCache = true;
      console.log('ℹ️ [renderUploadedRecords] 使用快取的課程總覽資料，避免內容閃爍');
    }
    dataset = sanitizeRecordPayload(dataset, courseKey);
    var overviewHtml = '';
    if (!dataset.overview) {
      try {
        var overviewHost = document.getElementById('overviewExistingPreviews');
        if (overviewHost) {
          overviewHost.innerHTML = '';
          try { delete overviewHost.dataset.renderSource; } catch (e) {}
          // 🔥 重新設置 Grid 樣式（innerHTML 會移除內聯樣式）
          try { ensureOverviewGridStyle(); } catch (e) {}
          try { updateOverviewZonesAndPlus(); } catch (e) {}
        }
      } catch (err) {
        console.warn('⚠️ [renderUploadedRecords] 清空課程總覽預覽失敗:', err);
      }
    }
    if (dataset.overview) {
      var ovPhotos = dataset.overview.photos || 0;
      var ovVideos = dataset.overview.videos || 0;
      var photoStat = '<span class="media-stat photo-stat"><i class="fas fa-image"></i> <strong>' + ovPhotos + '</strong> 張</span>';
      var videoStat = '<span class="media-stat video-stat"><i class="fas fa-video"></i> <strong>' + ovVideos + '</strong> 支</span>';
      var metaLine = '<div class="overview-stats"><i class="fas fa-clipboard-list"></i> 課程總覽' + photoStat + videoStat + '</div>';
      var photoItems = [];
      var videoItems = [];
      
      if (Array.isArray(dataset.overview.newMediaPhotos) && dataset.overview.newMediaPhotos.length > 0) {
        photoItems = dataset.overview.newMediaPhotos;
        console.log('📸 [課程總覽-新系統] 照片:', photoItems.length, '張');
      } else {
        var filesPhotos = Array.isArray(dataset.overview.files) ? dataset.overview.files : [];
        photoItems = filesPhotos.filter(function(f){ return isImageFilename(f) && !isGeneratedThumbnailName(f); });
        console.log('📸 [課程總覽-舊系統] 照片:', photoItems.length, '張');
      }
      
      if (Array.isArray(dataset.overview.newMediaVideos) && dataset.overview.newMediaVideos.length > 0) {
        videoItems = dataset.overview.newMediaVideos;
        console.log('🎬 [課程總覽-新系統] 影片:', videoItems.length, '個');
      } else {
        var filesVideos = Array.isArray(dataset.overview.files) ? dataset.overview.files : [];
        videoItems = filesVideos.filter(function(f){ return isVideoFilename(f); });
        console.log('🎬 [課程總覽-舊系統] 影片:', videoItems.length, '個');
      }
      
      var rel = dataset.overview.relativePath || '';
      var coursePeriod = '';
      
      if (currentCourse) {
        coursePeriod = currentCourse.title || currentCourse.coursePeriod || '';
        console.log('🔍 [課程總覽] currentCourse:', {
          title: currentCourse.title,
          coursePeriod: currentCourse.coursePeriod,
          date: currentCourse.date,
          '最終使用': coursePeriod
        });
      } else {
        console.warn('⚠️ [課程總覽] currentCourse 不存在');
      }
      
      function buildUrl(filename){
        if (!filename || !rel) {
          console.warn('⚠️ buildUrl: 缺少必要参数', { filename: filename, relativePath: rel });
          return '';
        }
        console.log('🔍 [buildUrl] 輸入參數:', { 
          filename: filename, 
          relativePath: rel,
          '是否為相對路徑': /^\d+-\d\//.test(rel)
        });
        var url = buildDirectFileUrl(rel, filename, { record: dataset.overview });
        console.log('🔍 [buildUrl] 生成的 URL:', url);
        return url;
      }
      
      var photoBlocks = photoItems.map(function(pItem){
        var isNewSystem = (typeof pItem === 'object' && pItem.id);
        var filename = isNewSystem ? pItem.filename : pItem;
        var url = buildUrl(filename);
        var displayName = isNewSystem ? (pItem.originalName || filename) : filename;
        var removeHandler = "return deleteOverviewFile(this, '" + String(filename).replace(/'/g, "\\'") + "')";
        
        console.log('📸 [課程總覽] 照片:', filename, '→', url);
        
        return buildMediaPreviewHtml({
          type: 'image',
          previewUrl: url,
          filename: displayName,
          removable: true,
          removeHandler: removeHandler,
          lazy: false,
          forceReady: true,
          recordPath: rel
        });
      }).join('');
      
      var overviewThumbMap = {};
      if (dataset.overview && dataset.overview.videoThumbnails && typeof dataset.overview.videoThumbnails === 'object') overviewThumbMap = dataset.overview.videoThumbnails;
      console.log('🎞️ [課程總覽] 影片縮圖映射:', overviewThumbMap);
      
      var videoBlocks = videoItems.map(function(vItem){
        var isNewSystem = (typeof vItem === 'object' && vItem && vItem.id);
        var filename = isNewSystem ? (vItem.filename || vItem.name || vItem.path || '') : vItem;
        var normalizedMeta = isNewSystem ? normalizeVideoMeta(vItem) : null;
        var videoId = (normalizedMeta && normalizedMeta.id) || (isNewSystem ? vItem.id : null);
        var sourceFilename = (normalizedMeta && normalizedMeta.filename) || filename;
        var url = '';
        
        if (normalizedMeta) {
          url = resolveVideoMetaUrl(dataset.overview, normalizedMeta, false);
        }
        if (!url) {
          url = buildRecordFileUrl(dataset.overview || {}, sourceFilename || filename) || buildUrl(sourceFilename || filename);
        }
        if (!url && videoId) {
          console.warn('⚠️ [課程總覽-抽屜] 缺少 Drive 代理，影片暫無法預覽:', { videoId: videoId });
        }
        
        var thumbUrl = '';
        if (normalizedMeta) {
          thumbUrl = resolveVideoMetaUrl(dataset.overview, normalizedMeta, true) || '';
        }
        if (!thumbUrl) {
          if (isNewSystem && vItem.thumbnailFilename) {
            thumbUrl = buildRecordFileUrl(dataset.overview || {}, vItem.thumbnailFilename) || buildUrl(vItem.thumbnailFilename);
          } else {
            var fallbackThumb = overviewThumbMap && overviewThumbMap[filename];
            thumbUrl = fallbackThumb ? buildUrl(fallbackThumb) : '';
          }
        }
        
        var relatedOverviewFiles = [];
        if (isNewSystem) {
          addRelatedFile(relatedOverviewFiles, vItem.thumbnailFilename || (normalizedMeta && normalizedMeta.thumbnailFilename));
          addRelatedFile(relatedOverviewFiles, vItem.transcodedFilename || (normalizedMeta && normalizedMeta.transcodedFilename));
        } else {
          var overviewLegacyThumb = overviewThumbMap && overviewThumbMap[filename];
          if (overviewLegacyThumb) addRelatedFile(relatedOverviewFiles, overviewLegacyThumb);
        }
        var displayName = isNewSystem ? (vItem.originalName || filename) : filename;
        var removeHandler = "return deleteOverviewFile(this, '" + String(filename).replace(/'/g, "\\'") + "')";
        
        return buildMediaPreviewHtml({
          type: 'video',
          previewUrl: url,
          thumbUrl: thumbUrl,
          filename: displayName,
          sourceFilename: sourceFilename,
          removable: true,
          removeHandler: removeHandler,
          lazy: false,
          forceReady: true,
          videoId: videoId,
          recordPath: rel,
          mediaId: videoId,
          relatedFiles: relatedOverviewFiles
        });
      }).join('');
      var grid = (photoBlocks || videoBlocks) ? ('<div class="file-previews">' + photoBlocks + videoBlocks + '</div>') : '';
      overviewHtml = '<div class="record-overview"><div>' + metaLine + '</div>' +
        ( (dataset.overview.overviewSummary || dataset.overview.summary) ? ('<div class="record-overview-summary">' + global.FLB.Course.escapeHtml((dataset.overview.overviewSummary || dataset.overview.summary).substring(0, 120)) + (((dataset.overview.overviewSummary || dataset.overview.summary).length > 120) ? '...' : '') + '</div>') : '') +
        grid +
        '</div>';
      try {
        var cont = document.getElementById('overviewExistingPreviews');
        if (cont) {
          cont.innerHTML = grid;
          try { cont.dataset.renderSource = 'legacy'; } catch (e) {}
          // 🔥 重新設置 Grid 樣式（innerHTML 會移除內聯樣式）
          try { ensureOverviewGridStyle(); } catch (e) {}
          setupLazyMedia(cont);
          attachThumbLoadingHandlers(cont);
          console.log('⏭️ [overviewExistingPreviews] 跳過自動縮圖生成，避免 404');
          try { updateOverviewZonesAndPlus(); } catch (e) {}
        }
        if (!overviewFromCache) {
          rememberOverviewRenderState(courseKey, dataset.overview, grid);
        }
      } catch (e) {
        console.error('❌ [課程總覽] 渲染失敗:', e);
      }
      try {
        var __ovText = (dataset.overview && (dataset.overview.overviewSummary || dataset.overview.summary)) || '';
        var shouldHydrateForm = typeof hydrateOverviewFieldsFromSummary === 'function' && __ovText && typeof __ovText === 'string' && __ovText.trim();
        var forceHydrateForCourse = courseKey && courseKey !== lastOverviewHydratedKey;
        var isPristine = isOverviewFormPristine();
        
        // 🔍 [診斷] 詳細記錄回填條件
        console.log('🔍 [回填診斷] 課程總覽回填條件檢查:', {
          'courseKey': courseKey,
          'lastOverviewHydratedKey': lastOverviewHydratedKey,
          'overviewFromCache': overviewFromCache,
          'shouldHydrateForm': shouldHydrateForm,
          'forceHydrateForCourse': forceHydrateForCourse,
          'isOverviewFormPristine': isPristine,
          'hasOverviewText': !!__ovText,
          'overviewTextLength': __ovText.length,
          '最終條件': shouldHydrateForm && (!overviewFromCache || isPristine || forceHydrateForCourse)
        });
        
        if (shouldHydrateForm && (!overviewFromCache || isPristine || forceHydrateForCourse)) {
          console.log('✅ [回填表單] 開始回填課程總覽數據...');
          hydrateOverviewFieldsFromSummary(__ovText, { force: forceHydrateForCourse || !overviewFromCache });
          lastTextSnapshot = computeOverviewTextSnapshot();
          lastOverviewSnapshot = computeOverviewSnapshot();
          try { lastOverviewHydratedKey = courseKey || null; } catch (e) {}
        } else {
          console.warn('⚠️ [回填表單] 條件不符，跳過回填');
        }
      } catch (e) {
        console.error('❌ [回填表單] 失敗:', e);
      }
    }
    var students = Array.isArray(dataset.students) ? dataset.students : [];
    console.log('📦 [renderUploadedRecords] API返回数据:', {
      'students数量': students.length,
      '第一个学生数据': students[0],
      '是否有newMediaVideos': students[0] && !!students[0].newMediaVideos,
      '是否有newMediaPhotos': students[0] && !!students[0].newMediaPhotos
    });
    
    var studentsHtml = students.length ? students.map(function (r) {
      // 🔥 優先使用新媒體系統數據
      var photos = [];
      var videos = [];
      var videoThumbnails = {};
      
      // 🔍 调试：显示当前学生的原始数据
      console.log('👤 [renderUploadedRecords] 学生原始数据:', r.studentName, {
        'newMediaVideos': r.newMediaVideos,
        'newMediaPhotos': r.newMediaPhotos,
        'files': r.files,
        '所有key': Object.keys(r)
      });
      
      // 檢查新媒體系統照片
      if (r.newMediaPhotos && Array.isArray(r.newMediaPhotos) && r.newMediaPhotos.length > 0) {
        photos = r.newMediaPhotos;
        console.log('📸 [抽屜渲染-新媒體] 使用 newMediaPhotos:', r.studentName, photos.length, '張');
      } else if (r.files && r.files.photos) {
        photos = r.files.photos.map(function(fn) { return { filename: fn, isOldSystem: true }; });
        console.log('📸 [抽屜渲染-舊系統] 使用 files.photos:', r.studentName, photos.length, '張');
      }
      
      // 檢查新媒體系統影片
      if (r.newMediaVideos && Array.isArray(r.newMediaVideos) && r.newMediaVideos.length > 0) {
        videos = r.newMediaVideos;
        // 構建縮圖映射
        r.newMediaVideos.forEach(function(v) {
          if (v.thumbnailFilename) {
            videoThumbnails[v.filename] = v.thumbnailFilename;
          }
        });
        console.log('🎬 [抽屜渲染-新媒體] 使用 newMediaVideos:', r.studentName, videos.length, '個');
      } else if (r.files && r.files.videos) {
        videos = r.files.videos.map(function(fn) { return { filename: fn, isOldSystem: true }; });
        videoThumbnails = r.videoThumbnails || (r.files && r.files.videoThumbnails) || {};
        console.log('🎬 [抽屜渲染-舊系統] 使用 files.videos:', r.studentName, videos.length, '個');
      }
      
      // 🔍 調試：檢查學生記錄中的影片數據
      console.log('📊 [抽屜渲染] 學生:', r.studentName, {
        'newMediaPhotos': r.newMediaPhotos,
        'newMediaVideos': r.newMediaVideos,
        'files.photos': r.files && r.files.photos,
        'files.videos': r.files && r.files.videos,
        '最終photos數量': photos.length,
        '最終videos數量': videos.length,
        'videoThumbnails': videoThumbnails
      });
      
      // ❌ [修復 2025-11-18] 移除清除快取邏輯，避免抹除舊檔案
      // 只有在服務器明確返回數據時才應該更新快取
      // clearServerMediaCache(r.studentName, 'photos');
      // clearServerMediaCache(r.studentName, 'videos');
      
      // 記憶服務器端媒體列表（轉換為文件名數組）- 🔥 增加安全檢查
      var photoFilenames = photos.map(function(p) { 
        var fn = typeof p === 'string' ? p : (p && p.filename ? p.filename : null);
        return fn;
      }).filter(function(fn) { return fn != null && typeof fn === 'string'; });
      
      var videoFilenames = videos.map(function(v) { 
        var fn = typeof v === 'string' ? v : (v && v.filename ? v.filename : null);
        return fn;
      }).filter(function(fn) { return fn != null && typeof fn === 'string'; });
      
      console.log('🔍 [檔案名稱提取]', {
        '照片原始': photos.length,
        '照片提取': photoFilenames.length,
        '影片原始': videos.length,
        '影片提取': videoFilenames.length
      });
      
      rememberServerMediaList(r.studentName, 'photos', photoFilenames);
      rememberServerMediaList(r.studentName, 'videos', videoFilenames);
      
      var localPhotos = (r.localFiles && Array.isArray(r.localFiles.photos)) ? r.localFiles.photos : [];
      var localVideos = (r.localFiles && Array.isArray(r.localFiles.videos)) ? r.localFiles.videos : [];
      // 🔥 [修復 2025-11-17] 本地檔案應該視為已上傳（不再顯示 local 樣式）
      // 因為到這個階段，檔案已經上傳到 Drive，只是還沒有正式的檔案 ID
      var localPhotoBlocks = localPhotos.map(function (url, idx) {
        // 🔥 [修復 2025-11-23] 添加保留標記，確保切換學生時不會丟失這些節點
        // 🔥 [簡化 2025-11-23] 移除 thumb-loading 元素
        return '<div class="file-preview existing synced-preview upload-success preview-clickable" data-preview-type="image" data-preview-url="' + global.FLB.Course.escapeHtml(url) + '" data-local-url="' + global.FLB.Course.escapeHtml(url) + '" data-student="' + global.FLB.Course.escapeHtml(r.studentName) + '" data-awaiting-sync="1" data-synced="1" data-local-preserve="1">' +
          '<img src="' + url + '" alt="照片">' +
          '<button class="remove-btn" type="button" onclick="return false;" style="opacity:0.5;cursor:not-allowed;" title="請重新載入後刪除"><i class="fas fa-times"></i></button>' +
        '</div>';
      }).join('');
      var localVideoBlocks = localVideos.map(function (url, idx) {
        var cacheKeyDrawer = normalizeThumbKey(url);
        var pc = videoPosterCache[cacheKeyDrawer] || '';
        // 🔥 [修復 2025-11-23] 添加保留標記，確保切換學生時不會丟失這些節點
        return '<div class="file-preview existing synced-preview upload-success preview-clickable" data-preview-type="video" data-preview-url="' + global.FLB.Course.escapeHtml(url) + '" data-local-url="' + global.FLB.Course.escapeHtml(url) + '" data-student="' + global.FLB.Course.escapeHtml(r.studentName) + '" data-awaiting-sync="1" data-synced="1" data-local-preserve="1">' +
          '<video src="' + url + '" preload="metadata" muted playsinline crossorigin="anonymous"' + (pc ? (' poster="' + pc + '"') : '') + '></video>' +
          '<img class="video-poster" src="' + (pc || '') + '" alt="" aria-hidden="true" ' + (pc ? '' : 'style="display:none"') + ' />' +
          '<div class="video-fallback-icon" aria-hidden="true" style="' + (pc ? 'display:none' : 'display:block') + '">🎬</div>' +
          '<button class="remove-btn" type="button" onclick="return false;" style="opacity:0.5;cursor:not-allowed;" title="請重新載入後刪除"><i class="fas fa-times"></i></button>' +
        '</div>';
      }).join('');
      // 🔥 [統一修復] 照片渲染邏輯（區分新舊系統）
      console.log('🔍 [抽屜照片渲染-開始] 學生:', r.studentName, {
        '照片總數': photos.length,
        '照片內容': photos
      });
      
      var filteredPhotos = photos.filter(function(pItem) {
        // 🔥 安全提取 filename
        var fn = null;
        if (typeof pItem === 'string') {
          fn = pItem;
        } else if (pItem && typeof pItem === 'object' && pItem.filename) {
          fn = pItem.filename;
        }
        
        // 只處理有效的檔案名稱
        if (!fn || typeof fn !== 'string') {
          console.warn('⚠️ [照片過濾] 無效的照片項目:', pItem);
          return false;
        }
        
        return isImageFilename(fn) && !isGeneratedThumbnailName(fn);
      });
      
      console.log('🔍 [抽屜照片渲染-過濾後] 學生:', r.studentName, {
        '過濾後數量': filteredPhotos.length,
        '過濾後內容': filteredPhotos
      });
      var relativePathHintList = safeResolveRelativePathHint(r);
      var courseNameHintList = r.courseName || '';
      var semesterHintList = r.semester || '';

      var photoBlocks = filteredPhotos.map(function (pItem) {
        // 🔥 深度除錯：顯示 pItem 的完整結構
        console.log('🔍 [照片渲染-詳細]', {
          'pItem類型': typeof pItem,
          'pItem': pItem,
          'pItem.id': pItem && pItem.id,
          'pItem.filename': pItem && pItem.filename,
          'pItem.filename類型': pItem && typeof pItem.filename
        });
        
        // 區分新舊系統
        var isNewSystem = (typeof pItem === 'object' && pItem && pItem.id);
        var filename = null;
        var photoId = null;
        
        if (isNewSystem) {
          photoId = pItem.id;
          // 🔥 處理 filename 可能是物件的情況
          if (typeof pItem.filename === 'string') {
            filename = pItem.filename;
          } else if (pItem.filename && typeof pItem.filename === 'object') {
            // filename 本身是物件，嘗試提取實際檔名
            console.warn('⚠️ [照片渲染] filename 是物件:', pItem.filename);
            // 嘗試常見的屬性名稱
            filename = pItem.filename.filename || pItem.filename.name || pItem.filename.originalname || String(pItem.filename);
          }
        } else {
          // 舊系統：pItem 可能是字串或物件
          if (typeof pItem === 'string') {
            filename = pItem;
          } else if (typeof pItem === 'object' && pItem !== null) {
            // 優先使用 filename，其次 name，最後 path
            filename = pItem.filename || pItem.name || pItem.path || String(pItem);
          } else {
            filename = String(pItem || '');
          }
        }
        
        // 🔥 最後一道防線：確保 filename 是字串
        if (!filename || typeof filename !== 'string') {
          console.error('❌ [照片渲染] filename 無效:', { 
            pItem, 
            filename,
            'pItem完整結構': JSON.stringify(pItem, null, 2)
          });
          return '';  // 返回空字串，避免錯誤
        }
        
        // 建立 URL
        var url;
        if (isNewSystem) {
          // 新系統：使用 Drive proxy (proxyUrl)
          var coursePeriod = r.coursePeriod || '';
          var date = r.date || '';
          var studentName = r.studentName || '';
          
          // 🔥 [重要] date 應該是完整資料夾名稱（包含主題），例如 "2025-11-05 四足獸"
          // 🔥 [修復 2025-11-21] 在 overrides 中包含 filename，以便 fallback 邏輯可以使用
          url = buildDrivePhotoPreviewUrl(photoId, r, {
            date: date,
            studentName: studentName,
            coursePeriod: coursePeriod,
            courseName: courseNameHintList,
            semester: semesterHintList,
            relativePath: relativePathHintList,
            filename: filename  // 🔥 關鍵修復：傳入 filename 以便 fallback 使用
          });
          console.log('📸 [抽屜-新系統] 照片:', { 
            photoId: photoId, 
            coursePeriod: coursePeriod, 
            date: date, 
            studentName: studentName, 
            url: url 
          });
        } else {
          // 舊系統：使用傳統 buildRecordFileUrl
          url = buildRecordFileUrl(r, filename);
        }
        
        // 🔥 [修復 2025-11-23] 所有從 newMediaPhotos 渲染的節點都應該被保留
        // 不應該檢查 localFiles（重新載入後 localFiles 是空的）
        var preservePhotoClasses = ['synced-preview'];
        
        var displayName = isNewSystem ? (pItem.originalName || filename) : filename;
        var removeHandler = "return deleteStudentFile(this, '" + (r.studentName || '').replace(/'/g, "\\'") + "', '" + filename.replace(/'/g, "\\'") + "')";
        var html = buildMediaPreviewHtml({
          type: 'image',
          previewUrl: url,
          filename: displayName,
          removable: true,
          removeHandler: removeHandler,
          lazy: false,
          forceReady: true,
          recordPath: relativePathHintList || r.relativePath || r.recordPath || '',
          extraClasses: preservePhotoClasses
        });
        
        console.log('🔍 [抽屜照片HTML] 學生:', r.studentName, {
          'photoId': photoId,
          'HTML長度': html.length,
          'HTML前100字': html.substring(0, 100)
        });
        
        return html;
      }).join('');
      
      console.log('🔍 [抽屜照片渲染-完成] 學生:', r.studentName, {
        '照片HTML總長度': photoBlocks.length,
        '照片HTML前200字': photoBlocks.substring(0, 200)
      });
      
      // 使用我們之前構建的 videoThumbnails（新媒體系統已包含）
      var thumbMapDrawer = videoThumbnails;
      
      // 🔍 调试日志：检查本地暂存影片状态
      console.log('🎬 [学生影片渲染] 学生:', r.studentName, {
        '服务器端影片': videos,
        '本地暂存影片': localVideos,
        '本地暂存影片数量': localVideos.length,
        '影片缩图映射': thumbMapDrawer
      });
      
      // 若仍有本地待同步的影片，先顯示本地影片區塊，避免立即去抓取伺服器端新檔造成 404
      var suppressServerVideos = Array.isArray(localVideos) && localVideos.length > 0;
      
      if (suppressServerVideos) {
        console.warn('⚠️ [抑制服务器端影片] 学生:', r.studentName, '因为还有', localVideos.length, '个本地暂存影片');
      }
      
      // 🔥 [修復] 允許顯示沒有縮圖的影片（使用預設圖標）
      var filteredVideos = videos.filter(function(vItem) {
        // 🔥 安全提取 filename
        var fn = null;
        if (typeof vItem === 'string') {
          fn = vItem;
        } else if (vItem && typeof vItem === 'object' && vItem.filename) {
          fn = vItem.filename;
        }
        
        // 只處理有效的檔案名稱
        if (!fn || typeof fn !== 'string') {
          console.warn('⚠️ [影片過濾] 無效的影片項目:', vItem);
          return false;
        }
        
        if (!isVideoFilename(fn)) return false;
        
        // 新系統視頻：允許沒有縮圖的影片（會顯示預設圖標）
        var isNewSystem = (typeof vItem === 'object' && vItem && vItem.id);
        if (isNewSystem && (!vItem.thumbnailFilename || vItem.thumbnailFilename.trim() === '')) {
          console.log('⚠️ [抽屜-顯示無縮圖視頻] 將顯示預設圖標:', { id: vItem.id, filename: vItem.filename, status: vItem.status });
          // 不再過濾掉，允許顯示（buildMediaPreviewHtml 會處理沒有縮圖的情況）
        }
        
        return true;
      });
      
      console.log('🔍 [抽屜-視頻過濾] 原始數量:', videos.length, '過濾後:', filteredVideos.length);
      
      // 🔥 [統一修復] 影片渲染邏輯（與主卡片完全一致）
      var videoBlocks = suppressServerVideos ? '' : filteredVideos.map(function (vItem) {
        // 🔥 深度除錯：顯示 vItem 的完整結構
        console.log('🎬 [影片渲染-詳細]', {
          'vItem類型': typeof vItem,
          'vItem': vItem,
          'vItem.id': vItem && vItem.id,
          'vItem.filename': vItem && vItem.filename,
          'vItem.filename類型': vItem && typeof vItem.filename
        });
        
        // 區分新舊系統
        var isNewSystem = (typeof vItem === 'object' && vItem && vItem.id);
        var filename = null;
        var videoId = null;
        
        if (isNewSystem) {
          videoId = vItem.id;
          // 🔥 處理 filename 可能是物件的情況
          if (typeof vItem.filename === 'string') {
            filename = vItem.filename;
          } else if (vItem.filename && typeof vItem.filename === 'object') {
            // filename 本身是物件，嘗試提取實際檔名
            console.warn('⚠️ [影片渲染] filename 是物件:', vItem.filename);
            // 嘗試常見的屬性名稱
            filename = vItem.filename.filename || vItem.filename.name || vItem.filename.originalname || String(vItem.filename);
          }
        } else {
          // 舊系統：vItem 可能是字串或物件
          if (typeof vItem === 'string') {
            filename = vItem;
          } else if (typeof vItem === 'object' && vItem !== null) {
            // 優先使用 filename，其次 name，最後 path
            filename = vItem.filename || vItem.name || vItem.path || String(vItem);
          } else {
            filename = String(vItem || '');
          }
        }
        
        // 🔥 最後一道防線：確保 filename 是字串
        if (!filename || typeof filename !== 'string') {
          console.error('❌ [影片渲染] filename 無效:', { 
            vItem, 
            filename,
            'vItem完整結構': JSON.stringify(vItem, null, 2)
          });
          return '';  // 返回空字串，避免錯誤
        }
        
        // 🔥 建立影片下載 URL
        var normalizedMeta = isNewSystem ? normalizeVideoMeta(vItem) : null;
        var url = '';
        if (normalizedMeta) {
          url = resolveVideoMetaUrl(r, normalizedMeta, false);
        }
        if (!url) {
          url = buildRecordFileUrl(r, filename);
        }
        if (!url && videoId) {
          console.warn('⚠️ [抽屜-新系統] 缺少 Drive 代理，影片暫無法預覽:', { videoId: videoId });
        }
        
        var thumbUrl = '';
        var shouldShowPlaceholder = false;
        if (normalizedMeta) {
          thumbUrl = resolveVideoMetaUrl(r, normalizedMeta, true) || '';
        }
        if (!thumbUrl) {
          if (isNewSystem && vItem.thumbnailFilename) {
            thumbUrl = buildRecordFileUrl(r, vItem.thumbnailFilename);
          } else {
            var thumbName = thumbMapDrawer && thumbMapDrawer[filename];
            thumbUrl = thumbName ? buildRecordFileUrl(r, thumbName) : '';
          }
        }
        
        // 🔥 [關鍵修正] 抽屜使用硬編碼 forceReady: true（手機端批量渲染需要）
        var displayName = isNewSystem ? (vItem.originalName || filename) : filename;
        var removeHandler = "return deleteStudentFile(this, '" + (r.studentName || '').replace(/'/g, "\\'") + "', '" + filename.replace(/'/g, "\\'") + "')";
        
        // 🔍 調試：最終渲染參數
        console.log('🎬 [抽屜-最終渲染] 影片:', {
          filename: displayName,
          previewUrl: url,
          thumbUrl: thumbUrl,
          shouldShowPlaceholder: shouldShowPlaceholder,
          lazy: false,
          forceReady: true,
          '手機端優化': '硬編碼 forceReady=true'
        });
        
        var relatedFilesListView = [];
        if (isNewSystem) {
          addRelatedFile(relatedFilesListView, vItem.thumbnailFilename || (normalizedMeta && normalizedMeta.thumbnailFilename));
          addRelatedFile(relatedFilesListView, vItem.transcodedFilename || (normalizedMeta && normalizedMeta.transcodedFilename));
        } else if (thumbMapDrawer && thumbMapDrawer[filename]) {
          addRelatedFile(relatedFilesListView, thumbMapDrawer[filename]);
        }
        
        // 🔥 [修復 2025-11-23] 所有從 newMediaVideos 渲染的節點都應該被保留
        // 不應該檢查 localFiles（重新載入後 localFiles 是空的）
        var preserveVideoClasses = ['synced-preview'];
        
        return buildMediaPreviewHtml({
          type: 'video',
          previewUrl: url,
          thumbUrl: thumbUrl,  // 🔥 不再條件清空，直接使用
          filename: displayName,
          sourceFilename: filename,
          removable: true,
          removeHandler: removeHandler,
          lazy: false,  // 🔥 [關鍵] 完全不使用 lazy（手機端需要立即加載）
          forceReady: true,  // 🔥 [關鍵] 硬編碼 true（不依賴緩存計算）
          videoId: videoId,
          recordPath: relativePathHintList || r.relativePath || r.recordPath || '',
          mediaId: videoId,
          relatedFiles: relatedFilesListView,
          extraClasses: preserveVideoClasses
        });
      }).join('');
      var filesHtml = (localPhotoBlocks + localVideoBlocks + photoBlocks + videoBlocks) || '<div style="color:#94a3b8;font-size:13px">尚無檔案</div>';
      
      console.log('🔍 [抽屜最終HTML] 學生:', r.studentName, {
        'localPhotoBlocks長度': localPhotoBlocks.length,
        'localVideoBlocks長度': localVideoBlocks.length,
        'photoBlocks長度': photoBlocks.length,
        'videoBlocks長度': videoBlocks.length,
        'filesHtml總長度': filesHtml.length,
        'filesHtml前300字': filesHtml.substring(0, 300)
      });
      
      var safeComment = global.FLB.Course.escapeHtml(r.comment || '');
      var photoCountDisplay = (r.photos != null ? r.photos : photos.length) + (localPhotos.length || 0);
      var videoCountDisplay = (r.videos != null ? r.videos : videos.length) + (localVideos.length || 0);
      return '<div class="record-item" id="record-item-' + global.FLB.Course.escapeHtml(r.studentName || '') + '">' +
        '<div class="record-item-title"><i class="fas fa-user"></i> ' + global.FLB.Course.escapeHtml(r.studentName || '') + '</div>' +
        '<div class="record-item-stats"><span><i class="fas fa-camera"></i> ' + photoCountDisplay + '</span><span><i class="fas fa-video"></i> ' + videoCountDisplay + '</span></div>' +
        (safeComment ? ('<div class="record-item-comment">' + safeComment + '</div>') : '') +
        '<div class="record-item-files file-previews">' + filesHtml + '</div>' +
        '<div class="record-item-actions">' +
          '<button class="nav-btn" onclick="startEditStudentRecord(\'' + (r.studentName || '') + '\', \'' + safeComment.replace(/'/g, "\\'") + '\')"><i class="fas fa-edit"></i> 編輯</button>' +
          '<button class="nav-btn" onclick="deleteStudentRecord(\'' + (r.studentName || '') + '\')"><i class="fas fa-trash"></i> 刪除</button>' +
        '</div>' +
      '</div>';
    }).join('') : '<div class="empty-state"><i class="fas fa-folder-open"></i> 尚無學生記錄</div>';

    container.innerHTML = overviewHtml + '<div class="record-students">' + studentsHtml + '</div>';
    
    // 🔥 [一進一出 2025-11-27] Drive 版本渲染完成，立即移除對應的本地預覽
    // 實現真正的「一進一出」：Drive 版本進來，本地版本立即出去
    setTimeout(function() {
      try {
        console.log('🔄 [一進一出] Drive 版本渲染完成，開始移除本地預覽');
        
        // 🔥 [修復] Drive 版本沒有 data-upload-id，改用檔案名稱匹配
        // 收集所有 Drive 版本的檔案名稱和學生名稱
        var driveFileInfo = new Map(); // key: "studentName:fileName", value: true
        var drivePreviews = container.querySelectorAll('.record-item .file-preview');
        
        drivePreviews.forEach(function(preview) {
          var fileName = preview.getAttribute('data-file-name');
          var recordItem = preview.closest('.record-item');
          if (!recordItem) return;
          
          var titleElement = recordItem.querySelector('.record-item-title');
          if (!titleElement) return;
          
          var studentName = titleElement.textContent.replace(/^\s*[^\s]*\s*/, '').trim();
          if (studentName && fileName) {
            var key = studentName + ':' + fileName;
            driveFileInfo.set(key, true);
            console.log('📋 [一進一出] 發現 Drive 檔案:', key);
          }
        });
        
        console.log('🔄 [一進一出] 發現 Drive 版本檔案數量:', driveFileInfo.size);
        
        // 移除所有對應的本地預覽
        var removedCount = 0;
        ['photos', 'videos'].forEach(function(type) {
          for (var studentIndex = 0; studentIndex < studentFiles.length; studentIndex++) {
            var studentName = studentFiles[studentIndex].name;
            if (!studentName) continue;
            
            var localContainer = document.getElementById(type + '-preview-' + studentIndex);
            if (!localContainer) continue;
            
            var localPreviews = localContainer.querySelectorAll('.file-preview.upload-success[data-file-name]');
            
            localPreviews.forEach(function(preview) {
              var fileName = preview.getAttribute('data-file-name');
              if (fileName) {
                var key = studentName + ':' + fileName;
                if (driveFileInfo.has(key)) {
                  console.log('🗑️ [一進一出] 移除本地預覽:', {
                    studentName: studentName,
                    fileName: fileName,
                    uploadId: preview.getAttribute('data-upload-id')
                  });
                  
                  // 清理 blob URL
                  revokePreviewObjectUrl(preview);
                  
                  // 移除 DOM 節點
                  preview.remove();
                  removedCount++;
                }
              }
            });
          }
        });
        
        console.log('✅ [一進一出] 完成，共移除', removedCount, '個本地預覽');
        
      } catch (e) {
        console.error('❌ [一進一出] 執行失敗:', e);
      }
    }, 100); // 極短延遲確保 DOM 完全更新
    
    try {
      setupLazyMedia(container);
      attachThumbLoadingHandlers(container);
      
      // 🔥 [修復] 不再自動生成縮圖，避免 404 錯誤
      // SmartPosterGenerator 只應處理本地上傳的 blob URL
      console.log('⏭️ [uploadedRecordsSection] 跳過自動縮圖生成，避免 404');
      // SmartPosterGenerator.processContainer(container);
    } catch (e) {
      console.warn('⚠️ [已上傳記錄] 智能縮圖生成失敗:', e);
    }
  }

  function isOverviewFormPristine() {
    try {
      var ids = ['ov_type','ov_date','ov_names','ov_count','ov_teacher','ov_topic','ov_perf','ov_issue','ov_solution'];
      for (var i = 0; i < ids.length; i++) {
        var el = document.getElementById(ids[i]);
        if (el && String(el.value || '').trim().length) {
          return false;
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // ============= 從 summary.txt 反向回填面板欄位 =============
  function hydrateOverviewFieldsFromSummary(summary, options) {
    try {
      var s = String(summary || '');
      if (!s.trim()) return;
      var opts = options || {};
      var force = !!opts.force;
      var get = function(label){
        try {
          var safe = String(label||'').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          var re = new RegExp('^' + safe + '\\s*：(.*)$', 'm');
          var m = s.match(re); return m ? (m[1] || '').trim() : '';
        } catch (_) { return ''; }
      };
      var map = {
        ov_type: get('課程種類'),
        ov_date: get('日期'),
        ov_names: get('學生姓名'),
        ov_count: (function(){ var v = get('上課人數'); var m = v.match(/\d+/); return m ? m[0] : v; })(),
        ov_teacher: get('講師姓名'),
        ov_topic: get('課程主題'),
        ov_perf: get('學生的狀況與表現'),
        ov_issue: get('遇到的問題'),
        ov_solution: get('解決的方法')
      };
      Object.keys(map).forEach(function(id){
        var el = document.getElementById(id);
        if (!el) return;
        var incoming = map[id] || '';
        var current = String(el.value || '');
        var userEdited = el.dataset && el.dataset.userEdited === '1';
        var shouldReplace = force || !current.trim();
        if (!shouldReplace && !incoming) {
          shouldReplace = force; // force 時即使空字串也覆寫
        }
        if (shouldReplace && (!userEdited || force)) {
          if (current !== incoming) {
            el.value = incoming;
          }
          if (el.dataset) {
            delete el.dataset.userEdited;
            el.dataset.lastHydratedValue = incoming;
            el.dataset.fromSummary = '1';
          }
        }
      });
      try { saveOverviewDraft(); } catch (e) {}
      try {
        lastTextSnapshot = computeOverviewTextSnapshot();
        lastOverviewSnapshot = computeOverviewSnapshot();
      } catch (e) {}
    } catch (e) {}
  }

  // ============= 🔥 Flex 佈局修復：確保容器樣式 =============
  function ensureOverviewGridStyle() {
    try {
      var containers = [
        { id: 'overviewPhotosPreviews', name: '待上傳預覽' },
        { id: 'overviewExistingPreviews', name: '已上傳預覽' }
      ];
      
      containers.forEach(function(container) {
        var el = document.getElementById(container.id);
        if (el) {
          // 🔥 強制設置 Flex 佈局內聯樣式（最高優先級）
          el.style.cssText = 'display:flex !important;flex-direction:row !important;flex-wrap:wrap !important;gap:10px !important;margin-top:10px !important;padding:12px !important;justify-content:flex-start !important;align-items:flex-start !important;align-content:flex-start !important;width:100% !important;';
          console.log('✅ [ensureOverviewGridStyle] 已重新設置', container.name, 'Flex 樣式');
        }
      });
    } catch (e) {
      console.error('❌ [ensureOverviewGridStyle] 設置失敗:', e);
    }
  }

  // ============= 課程總覽：DropZone 顯示與 + 加號邏輯 =============
  function updateOverviewZonesAndPlus() {
    try {
      var host = document.getElementById('overviewExistingPreviews');
      var dz = document.getElementById('overviewPhotosDropZone');
      var input = document.getElementById('overviewPhotosInput');
      if (!host || !dz || !input) return;
      var hasExisting = host.querySelectorAll('.file-preview').length > 0;
      // 隱藏/顯示 DropZone
      dz.style.display = hasExisting ? 'none' : '';
      // 追加 + 按鈕
      var btnId = 'overview-add-plus';
      var btn = document.getElementById(btnId);
      if (hasExisting) {
        if (!btn) {
          var html = '<button type="button" class="add-more-btn" id="' + btnId + '" onclick="return triggerAddOverviewFile()" aria-label="新增課程總覽媒體"><i class="fas fa-plus"></i></button>';
          host.insertAdjacentHTML('beforeend', html);
        }
      } else {
        if (btn) try { btn.remove(); } catch (e) {}
      }
    } catch (e) {}
  }
  function triggerAddOverviewFile(){
    try { var input = document.getElementById('overviewPhotosInput'); if (input) input.click(); } catch (e) {}
    return false;
  }
  global.triggerAddOverviewFile = triggerAddOverviewFile;

  async function deleteStudentRecord(studentName) {
    if (!currentCourse || !studentName) return;
    if (!confirm('確定要刪除 ' + studentName + ' 的學習記錄嗎？')) return;
    try {
      var meta = buildRecordOperationMeta(studentName);
      await global.FLB.Api.deleteRecord({
        course: meta.course,
        period: meta.period,
        coursePeriod: meta.coursePeriod,
        date: meta.date,
        studentName: studentName,
        relativePath: meta.relativePath
      });
      showToast('已刪除 ' + studentName + ' 的學習記錄', 'success');
      requestCourseReload({ showLoader: false, delay: 400 });
    } catch (e) {
      console.error('刪除失敗', e);
      showToast('刪除失敗：' + (e.message || ''), 'error');
    }
  }

  function startEditStudentRecord(studentName, currentComment) {
    var id = 'record-item-' + studentName;
    var item = document.getElementById(id);
    if (!item) return;
    item.innerHTML = '' +
      '<div class="record-edit-form">' +
        '<label class="upload-label">編輯評論</label>' +
        '<textarea id="edit-comment" class="comment-area">' + (currentComment || '') + '</textarea>' +
        '<div class="upload-area"><label class="upload-label">新增照片</label><input type="file" id="edit-photos" accept="image/*" multiple></div>' +
        '<div class="upload-area"><label class="upload-label">新增影片</label><input type="file" id="edit-videos" accept="video/*" multiple></div>' +
        '<div class="record-item-actions">' +
          '<button class="nav-btn" onclick="saveEditStudentRecord(\'' + studentName + '\')"><i class="fas fa-save"></i> 儲存</button>' +
          '<button class="nav-btn" onclick="return reloadRecordsFromServer()"><i class="fas fa-times"></i> 取消</button>' +
        '</div>' +
      '</div>';
  }

  async function saveEditStudentRecord(studentName) {
    if (!currentCourse) return;
    try {
      var meta = buildRecordOperationMeta(studentName);
      var comment = (document.getElementById('edit-comment') || {}).value || '';
      var photosInput = document.getElementById('edit-photos');
      var videosInput = document.getElementById('edit-videos');
      var photosFiles = photosInput && photosInput.files ? Array.prototype.slice.call(photosInput.files) : [];
      var videosFiles = videosInput && videosInput.files ? Array.prototype.slice.call(videosInput.files) : [];
      
      // 🚀 流式處理照片與影片（避免記憶體爆炸）
      var totalFiles = photosFiles.length + videosFiles.length;
      var photos = [];
      var videos = [];
      
      // 顯示進度 Toast
      var editProgressToastId = null;
      var showProgressFn = USE_GLOBAL_PROGRESS_TOAST && window.FLB && window.FLB.UI && window.FLB.UI.showProgressToast;
      var updateProgressFn = USE_GLOBAL_PROGRESS_TOAST && window.FLB && window.FLB.UI && window.FLB.UI.updateProgressToast;
      var hideProgressFn = USE_GLOBAL_PROGRESS_TOAST && window.FLB && window.FLB.UI && window.FLB.UI.hideProgressToast;
      
      if (totalFiles > 3 && showProgressFn) {
        editProgressToastId = showProgressFn('處理編輯媒體', 0);
      }
      
      var processedCount = 0;
      
      // 逐個處理照片
      for (var i = 0; i < photosFiles.length; i++) {
        try {
          var processedPhoto = await compressImageIfNeeded(photosFiles[i]);
          photos.push(processedPhoto);
        } catch (photoErr) {
          console.warn('⚠️ 照片壓縮失敗，使用原檔案:', photosFiles[i].name);
          photos.push(photosFiles[i]);
        }
        
        processedCount++;
        if (editProgressToastId && updateProgressFn) {
          var pct = Math.round((processedCount / totalFiles) * 100);
          updateProgressFn(editProgressToastId, pct);
        }
        
        // 每 5 個清理記憶體
        if ((i + 1) % 5 === 0 && window.LearningUploadCleanup) {
          try {
            window.LearningUploadCleanup.cleanup({ silent: true });
            await new Promise(function(resolve) { setTimeout(resolve, 30); });
          } catch (e) {}
        }
      }
      
      // 逐個處理影片
      for (var j = 0; j < videosFiles.length; j++) {
        try {
          var processedVideo = await compressVideoIfNeeded(videosFiles[j]);
          videos.push(processedVideo);
        } catch (videoErr) {
          console.warn('⚠️ 影片處理失敗，使用原檔案:', videosFiles[j].name);
          videos.push(videosFiles[j]);
        }
        
        processedCount++;
        if (editProgressToastId && updateProgressFn) {
          var pct = Math.round((processedCount / totalFiles) * 100);
          updateProgressFn(editProgressToastId, pct);
        }
      }
      
      // 隱藏進度 Toast
      if (editProgressToastId && hideProgressFn) {
        hideProgressFn(editProgressToastId);
      }
      
      console.log('✅ [saveEditStudentRecord] 流式處理完成：照片', photos.length, '個，影片', videos.length, '個');
      
      // 🆕 使用新 API v2 (自动处理媒体上传 + 评语保存)
      console.log('📝 [v2] 更新学生记录:', studentName, '照片:', photos.length, '影片:', videos.length);
      await global.FLB.Api.uploadRecordV2({
        course: meta.course,
        period: meta.period,
        date: meta.date,
        studentName: studentName,
        comment: comment,
        instructorName: (currentCourse && currentCourse.instructor) ? currentCourse.instructor : ((currentTeacher && currentTeacher.name) || ''),
        photos: photos,
        videos: videos,
        coursePeriod: meta.coursePeriod,
        relativePath: meta.relativePathUnified || meta.relativePath
      });
      
      // 🔒 旧代码（已注释，使用新 API v2 代替）
      // await global.FLB.Api.updateRecord({
      //   course: meta.course,
      //   period: meta.period,
      //   date: meta.date,
      //   studentName: studentName,
      //   comment: comment,
      //   photos: photos,
      //   videos: videos,
      //   coursePeriod: meta.coursePeriod,
      //   relativePath: meta.relativePathUnified || meta.relativePath
      // });
      
      showToast('已更新 ' + studentName + ' 的記錄', 'success');
      requestCourseReload({ showLoader: false, delay: 600 });
    } catch (e) {
      console.error('更新失敗', e);
      showToast('更新失敗：' + (e.message || ''), 'error');
    }
  }

  function pushUniqueNode(list, node) {
    if (!node) return;
    if (list.indexOf(node) === -1) list.push(node);
  }

  function getStudentRecordContainers(studentName) {
    var containers = [];
    try {
      var sid = encodeURIComponent(studentName || '');
      var listItem = document.getElementById('record-item-' + sid);
      if (listItem) containers.push(listItem);
      var drawerRoot = document.getElementById('recordsDrawerContent');
      if (drawerRoot) {
        var drawerItem = drawerRoot.querySelector('.record-item[data-student="' + sid + '"]');
        if (drawerItem) containers.push(drawerItem);
      }
    } catch (e) {}
    return containers;
  }

  function collectStudentPreviewNodes(studentName, filename, triggerEl) {
    var nodes = [];
    var baseName = String(filename || '').split('/').pop();
    if (triggerEl) {
      pushUniqueNode(nodes, triggerEl.closest('.file-preview'));
    }
    try {
      var containers = getStudentRecordContainers(studentName);
      containers.forEach(function (recItem) {
        var previews = recItem.querySelectorAll('.file-previews .file-preview.existing[data-filename]');
        Array.prototype.forEach.call(previews, function (node) {
          var f = node.getAttribute('data-filename') || '';
          if (filenamesEqual(f, filename) || filenamesEqual(f, baseName)) {
            pushUniqueNode(nodes, node);
          }
        });
      });
    } catch (e) {}
    return nodes;
  }

  function collectStudentUploadPreviewNodes(studentIndex, filename, isPhoto) {
    var nodes = [];
    if (typeof studentIndex !== 'number' || studentIndex < 0) return nodes;
    var baseName = String(filename || '').split('/').pop();
    var containerId = (isPhoto ? 'photos' : 'videos') + '-preview-' + studentIndex;
    var container = document.getElementById(containerId);
    if (!container) return nodes;
    var previews = container.querySelectorAll('.file-preview.existing[data-filename]');
    Array.prototype.forEach.call(previews, function (node) {
      var f = node.getAttribute('data-filename') || '';
      if (filenamesEqual(f, filename) || filenamesEqual(f, baseName)) {
        pushUniqueNode(nodes, node);
      }
    });
    return nodes;
  }

  function filterValidMediaFiles(files, type) {
    var allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    var allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
    var MAX_FILE_SIZE = 100 * 1024 * 1024;
    var valid = [];
    var invalid = [];
    files.forEach(function(file) {
      if (!file || !file.name) {
        invalid.push('無效檔案');
        return;
      }
      var fileType = file.type || '';
      var fileNameLower = file.name.toLowerCase();
      if (type === 'photos') {
        var isImage = allowedImageTypes.indexOf(fileType) >= 0 || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(fileNameLower);
        if (!isImage) {
          invalid.push(file.name + ' (非圖片格式)');
          return;
        }
      } else if (type === 'videos') {
        var isVideo = allowedVideoTypes.indexOf(fileType) >= 0 || /\.(mp4|webm|mov|avi|quicktime)$/i.test(fileNameLower);
        if (!isVideo) {
          invalid.push(file.name + ' (非影片格式)');
          return;
        }
      }
      if (file.size > MAX_FILE_SIZE) {
        invalid.push(file.name + ' (檔案過大: ' + (file.size / 1024 / 1024).toFixed(2) + ' MB)');
        return;
      }
      valid.push(file);
    });
    return { validFiles: valid, invalidMessages: invalid };
  }

  function persistPendingPreviewMeta(studentIndex, type, pendingMeta, file, objectUrl) {
    try {
      if (!pendingMeta || !pendingMeta.tempId || !window.PendingMediaStore) return;
      var patch = {
        previewType: type === 'videos' ? 'video' : 'image',
        studentName: getStudentNameByIndex(studentIndex),
        isOverview: studentIndex === OVERVIEW_UPLOAD_INDEX,
        courseKey: getCourseCacheKey(currentCourse)
      };
      if (file) {
        if (file.name) patch.fileName = file.name;
        if (file.type) patch.mimeType = file.type;
        if (typeof file.size === 'number') patch.fileSize = file.size;
        if (typeof file.lastModified === 'number') patch.lastModified = file.lastModified;
      }
      if (objectUrl) {
        patch.objectUrl = objectUrl;
      }
      PendingMediaStore.update(pendingMeta.tempId, patch);
    } catch (e) {}
  }

  function registerPendingMediaEntries(studentIndex, type, files) {
    var metas = [];
    var entry = ensureStudentFileEntry(studentIndex, (currentCourse && currentCourse.students && currentCourse.students[studentIndex]) || {});
    entry[type] = entry[type] || [];
    var courseKey = getCourseCacheKey(currentCourse);
    var studentName = getStudentNameByIndex(studentIndex);
    files.forEach(function(file) {
      var entryIndex = entry[type].length;
      var tempId = window.PendingMediaStore
        ? PendingMediaStore.create({
            studentIndex: studentIndex,
            type: type,
            entryIndex: entryIndex,
            fileName: file.name,
            fileSize: file.size,
            state: 'queued',
            isOverview: studentIndex === OVERVIEW_UPLOAD_INDEX,
            courseKey: courseKey,
            studentName: studentName,
            mimeType: file.type || '',
            previewType: type === 'videos' ? 'video' : 'image'
          })
        : ('pending-' + Date.now() + '-' + Math.random().toString(36).slice(2));
      var meta = {
        tempId: tempId,
        studentIndex: studentIndex,
        type: type,
        entryIndex: entryIndex,
        state: 'queued',
        fileName: file.name,
        mimeType: file.type || '',
        courseKey: courseKey,
        studentName: studentName,
        isOverview: studentIndex === OVERVIEW_UPLOAD_INDEX
      };
      file.__pendingMeta = Object.assign({}, meta);
      entry[type].push(file);
      metas.push(meta);
    });
    return metas;
  }

  function clearPendingFileList(list) {
    if (!Array.isArray(list)) return;
    list.forEach(function(file) {
      try {
        clearPendingMeta(file, { removeElement: true });
      } catch (_) {}
    });
  }

  function syncOverviewPendingEntries(options) {
    options = options || {};
    var entry = ensureStudentFileEntry(OVERVIEW_UPLOAD_INDEX, { name: '課程總覽' });
    if (options.replace !== false) {
      clearPendingFileList(entry.photos);
      clearPendingFileList(entry.videos);
      entry.photos = [];
      entry.videos = [];
    }
    if (Array.isArray(options.photos) && options.photos.length) {
      registerPendingMediaEntries(OVERVIEW_UPLOAD_INDEX, 'photos', options.photos);
    }
    if (Array.isArray(options.videos) && options.videos.length) {
      registerPendingMediaEntries(OVERVIEW_UPLOAD_INDEX, 'videos', options.videos);
    }
    replaceArrayContents(window.overviewPhotosFiles, entry.photos || []);
    replaceArrayContents(window.overviewVideosFiles, entry.videos || []);
    enqueuePendingUploads(OVERVIEW_UPLOAD_INDEX, 'photos');
    enqueuePendingUploads(OVERVIEW_UPLOAD_INDEX, 'videos');
  }

  function ensureOverviewFilesRegistered() {
    var photos = window.overviewPhotosFiles || [];
    var videos = window.overviewVideosFiles || [];
    var needsSync = photos.some(function(file){ return !file || !file.__pendingMeta; }) ||
      videos.some(function(file){ return !file || !file.__pendingMeta; });
    if (needsSync && (photos.length || videos.length)) {
      syncOverviewPendingEntries({
        photos: photos,
        videos: videos,
        replace: true
      });
    }
  }

  function getPendingFileListFor(studentIndex, type) {
    if (studentIndex === OVERVIEW_UPLOAD_INDEX) {
      return type === 'videos' ? (window.overviewVideosFiles || []) : (window.overviewPhotosFiles || []);
    }
    var student = (currentCourse && currentCourse.students && currentCourse.students[studentIndex]) || null;
    var entry = ensureStudentFileEntry(studentIndex, student);
    return (entry && entry[type]) ? entry[type] : [];
  }

  function findPendingFileByTempId(studentIndex, type, tempId) {
    if (!tempId) return null;
    var list = getPendingFileListFor(studentIndex, type);
    if (!Array.isArray(list)) return null;
    for (var i = 0; i < list.length; i++) {
      var file = list[i];
      if (file && file.__pendingMeta && file.__pendingMeta.tempId === tempId) {
        return file;
      }
    }
    return null;
  }

  var __restoringPendingUploads = false;

  function restorePendingUploads(options) {
    options = options || {};
    if (__restoringPendingUploads && options.skipIfRunning) {
      return;
    }
    if (!window.PendingMediaStore || typeof PendingMediaStore.listAll !== 'function') return;
    var courseKey = getCourseCacheKey(currentCourse);
    if (!courseKey) return;
    var entries = PendingMediaStore.listAll().filter(function(entry) {
      if (!entry) return false;
      if (entry.courseKey && entry.courseKey !== courseKey) return false;
      var state = entry.state || 'queued';
      if (state === 'synced' || state === 'failed') return false;
      return true;
    });
    if (!entries.length) return;
    __restoringPendingUploads = true;
    try {
      var grouped = {};
      entries.forEach(function(entry) {
        var studentIndex = typeof entry.studentIndex === 'number' ? entry.studentIndex : OVERVIEW_UPLOAD_INDEX;
        if (!grouped[studentIndex]) {
          grouped[studentIndex] = { studentIndex: studentIndex, photos: [], videos: [] };
        }
        var bucket = grouped[studentIndex];
        var type = (entry.type === 'videos') ? 'videos' : 'photos';
        bucket[type].push(entry);
      });

      Object.keys(grouped).forEach(function(studentKey) {
        var info = grouped[studentKey];
        if (info.studentIndex === OVERVIEW_UPLOAD_INDEX) {
          ensureOverviewFilesRegistered();
          var overviewContainer = document.getElementById('overviewPhotosPreviews');
          if (!overviewContainer) return;
          var overviewEntries = info.photos.concat(info.videos);
          if (!overviewEntries.length) return;
          if (hasMissingPendingPreviews(overviewContainer, overviewEntries)) {
            renderOverviewPendingList(overviewEntries);
          }
          return;
        }
        ['photos', 'videos'].forEach(function(type) {
          if (!info[type] || !info[type].length) return;
          var containerId = (type === 'videos' ? 'videos-preview-' : 'photos-preview-') + info.studentIndex;
          var container = document.getElementById(containerId);
          if (!container) return;
          if (!hasMissingPendingPreviews(container, info[type])) return;
          renderPendingListForStudent(info.studentIndex, type);
        });
      });

      entries.forEach(function(entry) {
        if (window.PendingMediaActions) {
          PendingMediaActions.updateState(entry.id, entry.state || 'queued', entry.statusText || '');
        }
      });
    } catch (e) {
      console.warn('⚠️ [restorePendingUploads] 還原失敗:', e);
    } finally {
      __restoringPendingUploads = false;
    }
  }

  function hasMissingPendingPreviews(container, entryList) {
    if (!container || !entryList || !entryList.length) return false;
    return entryList.some(function(entry) {
      if (!entry || !entry.id) return false;
      return !container.querySelector('.file-preview[data-temp-id="' + entry.id + '"]');
    });
  }

  function renderPendingListForStudent(studentIndex, type) {
    try {
      var files = getPendingFileListFor(studentIndex, type) || [];
      if (!files.length) return false;
      var filesToRender = files.slice();
      var container = document.getElementById((type === 'videos' ? 'videos' : 'photos') + '-preview-' + studentIndex);
      if (!container) return false;
      if (window.SharedIntegration && typeof window.SharedIntegration.renderStudentPreviews === 'function') {
        window.SharedIntegration.renderStudentPreviews({
          studentIndex: studentIndex,
          type: type,
          files: filesToRender,
          container: container,
          onRemove: function(idx, isImage) {
            var kind = isImage ? 'photos' : 'videos';
            removeFile(studentIndex, kind, idx);
          }
        });
      } else {
        updateFilePreviews(studentIndex, type);
      }
      return true;
    } catch (error) {
      console.warn('⚠️ [restorePendingUploads] renderPendingListForStudent 失敗:', error);
      try { updateFilePreviews(studentIndex, type); } catch (e) {}
      return false;
    }
  }

  function renderOverviewPendingList(entryList) {
    try {
      var previewContainer = document.getElementById('overviewPhotosPreviews');
      if (!previewContainer) return false;
      var photos = window.overviewPhotosFiles || [];
      var videos = window.overviewVideosFiles || [];
      var total = photos.length + videos.length;
      if (!total) return false;
      var merged = photos.concat(videos);
      if (window.SharedMediaPreviewer) {
        window.SharedMediaPreviewer.renderPreviews({
          container: previewContainer,
          files: merged,
          clearExisting: true,
          onRemove: function(idx, isImage) {
            if (isImage) {
              removeOverviewPhoto(idx);
            } else {
              removeOverviewVideo(Math.max(0, idx - photos.length));
            }
          }
        });
        
        // 🔥 [統一 2025-11-19] 設置 data-file-id 並統一綁定（課程總覽備援）
        setTimeout(function() {
          try {
            var allPreviews = previewContainer.querySelectorAll('.file-preview');
            var photoIndex = 0, videoIndex = 0;
            allPreviews.forEach(function(preview) {
              if (!preview.getAttribute('data-file-id')) {
                var previewType = preview.getAttribute('data-preview-type') || preview.getAttribute('data-file-type');
                var isVideo = previewType === 'video';
                var type = isVideo ? 'videos' : 'photos';
                var index = isVideo ? videoIndex++ : photoIndex++;
                preview.setAttribute('data-file-id', 'file-overview-' + type + '-' + index);
              }
              if (typeof window.ensureDeleteButtonWorks === 'function') {
                window.ensureDeleteButtonWorks(preview);
              }
            });
          } catch (bindErr) {
            console.warn('⚠️ [課程總覽備援] 統一綁定失敗:', bindErr);
          }
        }, 100); // 🔧 [統一 2025-11-19] 與 SharedIntegration 保持一致的延遲時間
      } else {
        previewContainer.innerHTML = '';
        merged.forEach(function(file, idx) {
          var isVideo = /^video\//i.test(file.type) || (idx >= photos.length);
          var url = '';
          try { url = URL.createObjectURL(file); } catch (e) {}
          var preview = document.createElement('div');
          preview.className = 'file-preview new-upload restored-preview';
          preview.setAttribute('data-temp-id', file.__pendingMeta && file.__pendingMeta.tempId ? file.__pendingMeta.tempId : ('restored-' + idx));
          preview.setAttribute('data-preview-type', isVideo ? 'video' : 'image');
          preview.setAttribute('data-object-url', url);
          if (file && file.__pendingMeta) {
            file.__pendingMeta.objectUrl = url;
            persistPendingPreviewMeta(OVERVIEW_UPLOAD_INDEX, isVideo ? 'videos' : 'photos', file.__pendingMeta, file, url);
          }
          if (isVideo) {
            var videoEl = document.createElement('video');
            videoEl.src = url;
            videoEl.muted = true;
            videoEl.setAttribute('playsinline', '');
            videoEl.setAttribute('preload', 'metadata');
            preview.appendChild(videoEl);
          } else {
            var imgEl = document.createElement('img');
            imgEl.src = url;
            imgEl.alt = file.name || '預覽';
            preview.appendChild(imgEl);
          }
          markPreviewForLocalPreserve(preview);
          ensureFilePreviewOverlay(preview);
          var removeBtn = document.createElement('button');
          removeBtn.className = 'remove-btn';
          removeBtn.type = 'button';
          (function(localIdx, asVideo) {
            removeBtn.onclick = function() {
              if (asVideo) {
                removeOverviewVideo(Math.max(0, localIdx));
              } else {
                removeOverviewPhoto(Math.max(0, localIdx));
              }
            };
          })(isVideo ? (idx - photos.length) : idx, isVideo);
          var removeIcon = document.createElement('i');
          removeIcon.className = 'fas fa-times';
          removeBtn.appendChild(removeIcon);
          preview.appendChild(removeBtn);
          previewContainer.appendChild(preview);
        });
      }
      return true;
    } catch (error) {
      console.warn('⚠️ [restorePendingUploads] renderOverviewPendingList 失敗:', error);
      return false;
    }
  }

  function handleUploadCenterBridge(event) {
    try {
      var detail = event && event.detail;
      if (!detail || !detail.task || !detail.task.meta) return;
      var tempId = detail.task.meta.tempId;
      if (!tempId) return;
      var action = detail.action;
      var percent = (detail.changes && typeof detail.changes.percent === 'number')
        ? detail.changes.percent
        : (detail.task.percent || 0);
      var label = '上傳中… ' + Math.max(1, Math.min(100, Math.round(percent || 0))) + '%';
      if (action === 'queued') {
        if (window.PendingMediaStore) {
          PendingMediaStore.update(tempId, { state: 'ready', updatedAt: Date.now() });
        }
        if (window.PendingMediaActions) {
          PendingMediaActions.updateState(tempId, 'ready', '排隊中…');
        }
        return;
      }
      if (action === 'progress') {
        if (window.PendingMediaStore) {
          PendingMediaStore.update(tempId, { state: 'uploading', updatedAt: Date.now(), progress: percent });
        }
        if (window.PendingMediaActions) {
          var preview = document.querySelector('.file-preview[data-temp-id="' + tempId + '"]');
          if (!preview || preview.getAttribute('data-pending-state') !== 'uploading') {
            PendingMediaActions.updateState(tempId, 'uploading', label);
          }
          PendingMediaActions.updateProgress(tempId, percent, label);
        }
        return;
      }
      if (action === 'done') {
        if (window.PendingMediaStore) {
          PendingMediaStore.update(tempId, { state: 'synced', updatedAt: Date.now(), completedAt: Date.now() });
        }
        if (window.PendingMediaActions) {
          PendingMediaActions.updateState(tempId, 'synced', '已完成');
        }
        return;
      }
      if (action === 'error') {
        var message = (detail.changes && detail.changes.message) || '上傳失敗';
        if (window.PendingMediaStore) {
          PendingMediaStore.update(tempId, { state: 'failed', error: message, updatedAt: Date.now() });
        }
        if (window.PendingMediaActions) {
          PendingMediaActions.updateState(tempId, 'failed', message);
        }
        return;
      }
    } catch (err) {
      console.warn('⚠️ [UploadCenterBridge] 無法同步狀態', err);
    }
  }

  function ensureUploadCenterBridge() {
    if (typeof window === 'undefined') return;
    if (window.__uploadCenterBridgeBound) return;
    window.addEventListener('upload-center-update', handleUploadCenterBridge);
    window.__uploadCenterBridgeBound = true;
  }

  ensureUploadCenterBridge();

  function collectPendingMediaSummary(studentIndex) {
    var summary = { ready: [], pending: [], failed: [], total: 0 };
    var entry = ensureStudentFileEntry(studentIndex, (currentCourse && currentCourse.students && currentCourse.students[studentIndex]) || {});
    ['photos', 'videos'].forEach(function(type) {
      var list = entry[type] || [];
      list.forEach(function(file) {
        if (!file) return;
        summary.total++;
        var meta = file.__pendingMeta || null;
        if (!meta || !meta.tempId) {
          summary.pending.push({ type: type, file: file, meta: meta, reason: 'missing-meta' });
          return;
        }
        var storeEntry = window.PendingMediaStore ? PendingMediaStore.get(meta.tempId) : null;
        var mediaId = meta.mediaId || (storeEntry && storeEntry.mediaId) || null;
        var state = (storeEntry && storeEntry.state) || (mediaId ? 'synced' : (meta.state || 'queued'));
        if (state === 'synced' && mediaId) {
          summary.ready.push({ type: type, file: file, meta: meta, tempId: meta.tempId, mediaId: mediaId });
        } else if (state === 'failed') {
          summary.failed.push({ type: type, file: file, meta: meta, tempId: meta.tempId });
        } else {
          summary.pending.push({ type: type, file: file, meta: meta, tempId: meta.tempId, state: state });
        }
      });
    });
    return summary;
  }

  function enqueuePendingUploads(studentIndex, type) {
    if (!window.MediaUploadController) return;
    var entry = ensureStudentFileEntry(studentIndex, (currentCourse && currentCourse.students && currentCourse.students[studentIndex]) || {});
    var list = entry[type] || [];
    list.forEach(function(file) {
      if (!file || !file.__pendingMeta) return;
      if (file.__pendingMeta.enqueued) return;
      file.__pendingMeta.enqueued = true;
      if (window.PendingMediaStore) {
        PendingMediaStore.update(file.__pendingMeta.tempId, { state: 'ready', queuedAt: Date.now() });
      }
      if (window.PendingMediaActions) {
        PendingMediaActions.updateState(file.__pendingMeta.tempId, 'ready', '排隊中…');
      }
      MediaUploadController.enqueue({
        studentIndex: studentIndex,
        type: type,
        file: file,
        meta: file.__pendingMeta
      });
    });
  }

  function finalizeSyncedPreviewElement(preview, meta) {
    if (!preview) return;
    preview.classList.add('existing', 'synced-preview');
    preview.classList.remove('new-upload', 'pending', 'uploading');
    preview.setAttribute('data-awaiting-sync', '1');
    markPreviewForLocalPreserve(preview);
    preview.removeAttribute('data-temp-id');
    preview.removeAttribute('data-pending-state');
    var overlay = preview.querySelector('.file-uploading-overlay');
    // 🔥 [修復 2025-11-18] 不設定 inline style，由 CSS .synced-preview 控制
    // if (overlay) {
    //   overlay.style.display = 'none';
    // }
    var mediaEl = preview.querySelector('video, img');
    var proxyUrl = meta && meta.proxyUrl ? meta.proxyUrl : '';
    if (!proxyUrl && meta && meta.drivePath && typeof ensureDriveMediaProxy === 'function') {
      proxyUrl = ensureDriveMediaProxy(meta.drivePath);
    }
    if (proxyUrl && mediaEl) {
      try { mediaEl.src = proxyUrl; } catch (e) {}
      preview.setAttribute('data-preview-url', proxyUrl);
      preview.setAttribute('data-drive-proxy', proxyUrl);
      preview.setAttribute('data-drive-path', meta.drivePath || '');
    }
    var removeBtn = preview.querySelector('.remove-btn');
    if (removeBtn) {
      removeBtn.disabled = true;
      removeBtn.setAttribute('aria-disabled', 'true');
      removeBtn.classList.add('disabled');
      removeBtn.title = '已同步到 Drive';
    }
    var blobUrl = preview.getAttribute('data-object-url');
    if (blobUrl && blobUrl.startsWith('blob:')) {
      try {
        if (window.LearningUploadBlobURL) {
          window.LearningUploadBlobURL.release(blobUrl, true);
        } else {
          URL.revokeObjectURL(blobUrl);
        }
      } catch (e) {}
    }
    preview.removeAttribute('data-object-url');
  }

  function clearPendingMeta(file, options) {
    if (!file || !file.__pendingMeta) return;
    var meta = file.__pendingMeta;
    var shouldRemoveElement = !(options && options.removeElement === false);
    if (meta.tempId && window.PendingMediaStore) {
      PendingMediaStore.remove(meta.tempId);
    }
    if (meta.objectUrl && meta.objectUrl.indexOf && meta.objectUrl.indexOf('blob:') === 0) {
      try {
        if (window.LearningUploadBlobURL) {
          window.LearningUploadBlobURL.release(meta.objectUrl, true);
        } else {
          URL.revokeObjectURL(meta.objectUrl);
        }
      } catch (e) {}
    }
    if (meta.tempId) {
      if (shouldRemoveElement) {
        if (window.PendingMediaActions) {
          PendingMediaActions.remove(meta.tempId);
        }
      } else {
        var preview = document.querySelector('.file-preview[data-temp-id="' + meta.tempId + '"]');
        finalizeSyncedPreviewElement(preview, meta);
      }
    }
    delete file.__pendingMeta;
  }

  function markPendingFilesState(files, state, message) {
    if (!Array.isArray(files)) return;
    files.forEach(function(file) {
      if (!file || !file.__pendingMeta) return;
      file.__pendingMeta.state = state;
      if (window.PendingMediaStore && file.__pendingMeta.tempId) {
        PendingMediaStore.update(file.__pendingMeta.tempId, { state: state, updatedAt: Date.now() });
      }
      if (window.PendingMediaActions && file.__pendingMeta.tempId) {
        PendingMediaActions.updateState(file.__pendingMeta.tempId, state, message);
      }
      if (state === 'synced') {
        clearPendingMeta(file, { removeElement: false });
      }
    });
  }

  function reindexPendingEntries(list) {
    if (!Array.isArray(list)) return;
    list.forEach(function(file, idx) {
      if (file && file.__pendingMeta) {
        file.__pendingMeta.entryIndex = idx;
        if (window.PendingMediaStore && file.__pendingMeta.tempId) {
          PendingMediaStore.update(file.__pendingMeta.tempId, { entryIndex: idx });
        }
      }
    });
  }

  function getPendingStatusLabel(meta) {
    if (!meta) return '待上傳';
    switch (meta.state) {
      case 'processing':
        return '壓縮中…';
      case 'ready':
        return '等待上傳';
      case 'uploading':
        return '上傳中…';
      case 'synced':
        return '已完成';
      case 'failed':
        return '處理失敗';
      default:
        return '待上傳';
    }
  }

  function setPreviewProgress(preview, percent) {
    if (!preview) {
      console.warn('🔍 [setPreviewProgress] preview 為空');
      return;
    }
    var helpers = ensureFilePreviewOverlay(preview);
    if (!helpers || !helpers.progressFill) {
      console.warn('🔍 [setPreviewProgress] 找不到 progressFill:', helpers);
      return;
    }
    var bounded = Math.max(0, Math.min(100, Number(percent) || 0));
    
    // 🔥 [修復 2025-11-18] 直接設置像素值而非百分比，避免與 progress-monitor.js 衝突
    var pixelWidth = Math.round(70 * bounded / 100);
    helpers.progressFill.style.width = pixelWidth + 'px';
    
    // 🔍 診斷日誌
    var overlayWidth = window.getComputedStyle(helpers.overlay).width;
    var progressBarWidth = window.getComputedStyle(helpers.progressBar).width;
    var previewWidth = window.getComputedStyle(preview).width;
    console.log('📊 [setPreviewProgress] 進度更新:', {
      percent: bounded + '%',
      element: helpers.progressFill,
      classes: preview.className,
      inlineWidth: helpers.progressFill.style.width,
      computedWidth: window.getComputedStyle(helpers.progressFill).width,
      display: window.getComputedStyle(helpers.progressFill).display,
      visibility: window.getComputedStyle(helpers.progressFill).visibility,
      height: window.getComputedStyle(helpers.progressFill).height,
      '容器寬度': {
        preview: previewWidth,
        overlay: overlayWidth,
        progressBar: progressBarWidth
      }
    });
    
    if (bounded >= 100) {
      helpers.overlay.setAttribute('data-progress-complete', '1');
      // 🔥 [修復 2025-11-18] 進度達到 100% 時，主動淡出並隱藏 overlay
      // 避免 overlay 遮擋刪除按鈕，導致無法點擊
      setTimeout(function() {
        try {
          // 添加淡出動畫
          helpers.overlay.style.transition = 'opacity 0.4s ease-out';
          helpers.overlay.style.opacity = '0';
          
          // 動畫結束後完全隱藏並移除 pointer-events
          setTimeout(function() {
            // 🔥 [修復 2025-11-18] 不設定 inline style，由 CSS 控制
            // helpers.overlay.style.display = 'none';
            helpers.overlay.style.pointerEvents = 'none';
            console.log('✅ [進度條] overlay 已淡出並隱藏');
          }, 400); // 與動畫時間一致
        } catch (e) {
          console.warn('⚠️ [進度條] 隱藏 overlay 失敗:', e);
        }
      }, 200); // 等待 200ms 讓用戶看到 100%
    } else {
      helpers.overlay.removeAttribute('data-progress-complete');
    }
    try { preview.setAttribute('data-last-progress', String(bounded)); } catch (e) {}
  }
  // 🎬 小檔案/單分片情境：進度事件可能直接 0→100，為避免觀感跳動，加入平滑補間
  function animatePreviewProgress(preview, from, to, durationMs) {
    try { if (!preview) return; } catch (e) { return; }
    var start = Math.max(0, Math.min(100, Number(from) || 0));
    var end = Math.max(0, Math.min(100, Number(to) || 0));
    if (end <= start) { setPreviewProgress(preview, end); return; }
    if (preview.__progressAnimTimer) { clearInterval(preview.__progressAnimTimer); preview.__progressAnimTimer = null; }
    var steps = Math.max(3, Math.floor(durationMs / 120));
    var step = 0;
    var delta = (end - start) / steps;
    setPreviewProgress(preview, start);
    preview.__progressAnimTimer = setInterval(function(){
      step++;
      var next = Math.round(start + delta * step);
      if (step >= steps || next >= end) {
        clearInterval(preview.__progressAnimTimer);
        preview.__progressAnimTimer = null;
        setPreviewProgress(preview, end);
        return;
      }
      setPreviewProgress(preview, next);
    }, 120);
  }


  function findStudentIndexInState(studentName) {
    if (!(window.FLB && FLB.State)) return -1;
    try {
      var st = FLB.State.get();
      var students = st.students || [];
      var idx = -1;
      if (window.NormalizeUtils && NormalizeUtils.isSameStudent) {
        idx = students.findIndex(function (s) { return NormalizeUtils.isSameStudent(s && s.name, studentName); });
      }
      if (idx < 0) {
        idx = students.findIndex(function (s) { return (s && s.name) === studentName; });
      }
      return idx;
    } catch (e) {
      return -1;
    }
  }

  function collectOverviewPreviewNodes(filename, triggerEl) {
    var nodes = [];
    var baseName = String(filename || '').split('/').pop();
    if (triggerEl) {
      pushUniqueNode(nodes, triggerEl.closest('.file-preview'));
    }
    try {
      var host = document.getElementById('overviewExistingPreviews');
      if (!host) return nodes;
      var previews = host.querySelectorAll('.file-preview.existing[data-filename]');
      Array.prototype.forEach.call(previews, function (node) {
        var f = node.getAttribute('data-filename') || '';
        if (filenamesEqual(f, filename) || filenamesEqual(f, baseName)) {
          pushUniqueNode(nodes, node);
        }
      });
    } catch (e) {}
    return nodes;
  }

  // ==================== 🧹 刪除確認排程（避免 NAS 延遲回彈） ====================
  function rememberPendingDeletion(studentName, filename, options) {
    options = options || {};
    if (!studentName || !filename || !currentCourse) return;
    if (!AUTO_REFRESH_AFTER_UPLOAD) {
      console.log('🧊 [刪除確認] Cache-only 模式，跳過背景重抓', { student: studentName, file: filename });
      return;
    }
    try {
      var courseKey = getCourseCacheKey(currentCourse || {});
      var normalizedName = normalizeToken(studentName || '');
      var key = buildDeletionConfirmKey(courseKey, normalizedName, filename);
      var existing = pendingDeletionConfirmations[key];
      if (existing && existing.timer) {
        clearTimeout(existing.timer);
      }
      pendingDeletionConfirmations[key] = {
        studentName: studentName,
        filename: filename,
        normalizedName: normalizedName,
        courseKey: courseKey,
        type: options.type || (isVideoFilename(filename) ? 'video' : 'photo'),
        attempts: 0,
        maxAttempts: options.maxAttempts || MAX_DELETION_CONFIRMATION_ATTEMPTS,
        timer: null
      };
      console.log('🧹 [刪除確認] 排程檢查', { student: studentName, filename: filename });
      schedulePendingDeletionCheck(key, DELETION_CONFIRMATION_INITIAL_DELAY);
    } catch (e) {
      console.warn('⚠️ [刪除確認] 無法建立排程:', e);
    }
  }

  function buildDeletionConfirmKey(courseKey, normalizedName, filename) {
    return [String(courseKey || ''), String(normalizedName || ''), String(filename || '')].join('::');
  }

  function schedulePendingDeletionCheck(key, delayMs) {
    var entry = pendingDeletionConfirmations[key];
    if (!entry) return;
    if (!AUTO_REFRESH_AFTER_UPLOAD) {
      clearPendingDeletionEntry(key);
      return;
    }
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    entry.timer = setTimeout(function () {
      entry.timer = null;
      runPendingDeletionCheck(key);
    }, Math.max(400, Number(delayMs || DELETION_CONFIRMATION_INITIAL_DELAY)));
  }

  async function runPendingDeletionCheck(key) {
    var entry = pendingDeletionConfirmations[key];
    if (!entry) return;
    if (!AUTO_REFRESH_AFTER_UPLOAD) {
      clearPendingDeletionEntry(key);
      return;
    }
    var activeCourseKey = getCourseCacheKey(currentCourse || {});
    if (entry.courseKey !== activeCourseKey) {
      clearPendingDeletionEntry(key);
      return;
    }
    entry.attempts++;
    console.log('⌛ [刪除確認] 檢查進行中', {
      student: entry.studentName,
      filename: entry.filename,
      attempt: entry.attempts
    });
    try {
      await refreshStudentRecordByName(entry.studentName, { silentFallback: true });
    } catch (err) {
      console.warn('⚠️ [刪除確認] 單筆刷新失敗:', err && err.message ? err.message : err);
    }
    if (!doesCachedRecordContainFile(entry.studentName, entry.filename, entry.type)) {
      console.log('✅ [刪除確認] 已確認刪除', { student: entry.studentName, filename: entry.filename });
      clearPendingDeletionEntry(key);
      return;
    }
    if (entry.attempts >= entry.maxAttempts) {
      clearPendingDeletionEntry(key);
      showToast('檔案刪除同步較慢，請稍後重新整理。', 'warning');
      return;
    }
    schedulePendingDeletionCheck(key, 900 + entry.attempts * 600);
  }

  function doesCachedRecordContainFile(studentName, filename, typeHint) {
    if (!(window.FLB && FLB.State)) return true;
    try {
      var st = FLB.State.get();
      var cache = st && st.uploadedRecordsCache;
      var students = cache && Array.isArray(cache.students) ? cache.students : [];
      if (!students.length) return false;
      var normalizedName = normalizeToken(studentName || '');
      var record = students.find(function (r) {
        return normalizeToken(r && r.studentName) === normalizedName;
      });
      if (!record) return false;
      return recordHasFilename(record, filename, typeHint);
    } catch (e) {
      console.warn('⚠️ [刪除確認] 檢查快取失敗:', e);
      return true;
    }
  }

  function recordHasFilename(record, filename, typeHint) {
    if (!record || !filename) return false;
    var baseName = String(filename || '').split('/').pop();
    function matches(value) {
      return filenamesEqual(value, filename) || filenamesEqual(value, baseName);
    }
    function matchesFromList(list) {
      if (!Array.isArray(list)) return false;
      return list.some(function (item) {
        var resolved = extractFilenameFromEntry(item);
        return matches(resolved);
      });
    }
    if (!typeHint || typeHint === 'photo') {
      if (matchesFromList(record.files && record.files.photos)) return true;
      if (matchesFromList(record.newMediaPhotos)) return true;
    }
    if (!typeHint || typeHint === 'video') {
      if (matchesFromList(record.files && record.files.videos)) return true;
      if (matchesFromList(record.newMediaVideos)) return true;
    }
    return false;
  }

  function extractFilenameFromEntry(entry) {
    if (!entry) return '';
    if (typeof entry === 'string') return entry;
    if (typeof entry === 'object') {
      return entry.filename || entry.fileName || entry.name || entry.path || entry.originalName || entry.transcodedFilename || '';
    }
    return '';
  }

  function clearPendingDeletionEntry(key) {
    var entry = pendingDeletionConfirmations[key];
    if (!entry) return;
    if (entry.timer) {
      clearTimeout(entry.timer);
    }
    delete pendingDeletionConfirmations[key];
  }

  async function deleteStudentFile(triggerEl, studentName, filename) {
    if (!currentCourse || !studentName || !filename) return false;
    if (!confirm('刪除此檔案？\n' + filename)) return false;
    var isPhoto = !isVideoFilename(filename);
    var previewNodes = collectStudentPreviewNodes(studentName, filename, triggerEl);
    var studentIndex = findStudentIndexInState(studentName);
    if (studentIndex >= 0) {
      collectStudentUploadPreviewNodes(studentIndex, filename, isPhoto).forEach(function(node){ pushUniqueNode(previewNodes, node); });
    }
    previewNodes.forEach(function(node){ markPreviewDeleting(node, '刪除中...'); });
    var recordContainers = getStudentRecordContainers(studentName);
    var primaryPreviewEl = triggerEl ? triggerEl.closest('.file-preview') : null;
    if (!primaryPreviewEl && previewNodes.length) {
      primaryPreviewEl = previewNodes[0];
    }
    var domRecordPath = primaryPreviewEl ? decodeDataAttr(primaryPreviewEl.getAttribute('data-record-path')) : '';
    var domRelatedFilesRaw = primaryPreviewEl ? parseRelatedFilesAttr(primaryPreviewEl.getAttribute('data-related-files')) : [];
    var domRelatedFiles = [];
    if (Array.isArray(domRelatedFilesRaw)) {
      domRelatedFilesRaw.forEach(function (name) { addRelatedFile(domRelatedFiles, name); });
    }
    try {
      var meta = buildRecordOperationMeta(studentName);
      var recordPathOverride = domRecordPath || meta.relativePath;
      await deleteRecordFileViaDrive(meta, studentName, filename, recordPathOverride);
      removeStudentFileFromCache(studentName, filename);

      try {
        if (window.FLB && FLB.State && studentIndex >= 0) {
          var st2 = FLB.State.get();
          var students = st2.students || [];
          ensureStudentFileEntry(studentIndex, students[studentIndex]);
          var base = studentFiles[studentIndex];
          base.existingCounts = base.existingCounts || { photos: 0, videos: 0, text: 0 };
          if (isPhoto) { base.existingCounts.photos = Math.max(0, (base.existingCounts.photos || 0) - 1); }
          else { base.existingCounts.videos = Math.max(0, (base.existingCounts.videos || 0) - 1); }
          var count = getTotalCount(studentIndex, isPhoto ? 'photos' : 'videos');
          var required = isPhoto ? 3 : 1;
          updateIndicator(studentIndex, isPhoto ? 'photo' : 'video', count >= required);
          try { updateCapsule(studentIndex); } catch (e) {}
          try { renderBottomTabs(); } catch (e) {}
          checkUploadReady(studentIndex, { silent: true });
        }
      } catch (e) {}

      previewNodes.forEach(animatePreviewRemoval);
      setTimeout(function(){
        try { recordContainers.forEach(function (container) { refreshRecordItemStats(container); }); } catch (e) {}
      }, 280);
      try { renderDrawerFromState(); } catch (e) {}
      try { updateRecordsFabBadge(); } catch (e) {}
      try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}

      // 🔥 立即清除所有相關緩存
      try {
        clearServerMediaCache(studentName, 'photos');
        clearServerMediaCache(studentName, 'videos');
        
        // 清除影片縮圖緩存
        Object.keys(videoThumbnailReadyCache).forEach(function(key) {
          if (key.indexOf(studentName) === 0) {
            delete videoThumbnailReadyCache[key];
          }
        });
        
        // 清除 localStorage
        var courseKey = (currentCourse.courseName || '') + '_' + (currentCourse.date || '');
        localStorage.removeItem('uploadedRecords_' + courseKey);
        
        console.log('✅ [刪除後] 已清除所有緩存');
      } catch (cacheErr) {
        console.warn('⚠️ [刪除後] 清除緩存失敗:', cacheErr);
      }
      
      if (AUTO_REFRESH_AFTER_UPLOAD) {
        try {
          requestCourseReload({ force: true, clearCache: true, showLoader: false, delay: 500, allowCacheBypass: true, reason: 'student-delete' });
        } catch (reloadErr) {
          console.warn('⚠️ [刪除後] 重新載入失敗:', reloadErr);
        }
      } else {
        console.log('🧊 [刪除後] Cache-only 模式，已直接更新 UI/快取，不觸發重新抓取');
      }
      var extraFiles = Array.isArray(domRelatedFiles) ? domRelatedFiles.slice() : [];
      extraFiles = extraFiles.filter(function(extra) { return extra && !filenamesEqual(extra, filename); });
      for (var rf = 0; rf < extraFiles.length; rf++) {
        var extraName = extraFiles[rf];
        try {
          await deleteRecordFileViaDrive(meta, studentName, extraName, recordPathOverride);
          removeStudentFileFromCache(studentName, extraName);
          rememberPendingDeletion(studentName, extraName, { type: isVideoFilename(extraName) ? 'video' : 'photo' });
        } catch (extraErr) {
          console.warn('⚠️ [刪除附屬檔案失敗]', extraName, extraErr);
        }
      }
      rememberPendingDeletion(studentName, filename, { type: isPhoto ? 'photo' : 'video' });
      showToast('已刪除檔案', 'success');
    } catch (e) {
      console.error('刪除檔案失敗', e);
      previewNodes.forEach(clearPreviewDeleting);
      showToast('刪除檔案失敗：' + (e.message || ''), 'error');
    }
    return false;
  }

  async function deleteRecordFileViaDrive(meta, studentName, targetFilename, recordPathOverride) {
    if (!meta || !targetFilename) return;
    var finalPath = recordPathOverride || meta.relativePath;
    await global.FLB.Api.deleteRecord({
      course: meta.course,
      period: meta.period,
      coursePeriod: meta.coursePeriod,
      date: meta.date,
      studentName: studentName,
      filename: targetFilename,
      relativePath: finalPath,
      recordPath: finalPath
    });
  }

  function removeStudentFileFromCache(studentName, filename) {
    if (!(window.FLB && FLB.State) || !studentName || !filename) return;
    try {
      var st = FLB.State.get();
      var cache = Object.assign({}, st.uploadedRecordsCache || {});
      var list = Array.isArray(cache.students) ? cache.students.slice() : [];
      var idx = list.findIndex(function (x) { return (x.studentName || '') === (studentName || ''); });
      if (idx < 0) return;
      var rec = Object.assign({}, list[idx]);
      var files = Object.assign({ photos: [], videos: [] }, rec.files || {});
      var beforePhotosLen = files.photos.length;
      files.photos = (files.photos || []).filter(function (n) { return !filenamesEqual(n, filename); });
      var beforeVideosLen = files.videos.length;
      files.videos = (files.videos || []).filter(function (n) { return !filenamesEqual(n, filename); });
      var changed = beforePhotosLen !== files.photos.length || beforeVideosLen !== files.videos.length;

      if (Array.isArray(rec.newMediaPhotos)) {
        var before = rec.newMediaPhotos.length;
        rec.newMediaPhotos = rec.newMediaPhotos.filter(function (entry) {
          return !filenamesEqual(extractFilenameFromEntry(entry), filename);
        });
        if (before !== rec.newMediaPhotos.length) changed = true;
      }
      if (Array.isArray(rec.newMediaVideos)) {
        var beforeVideos = rec.newMediaVideos.length;
        rec.newMediaVideos = rec.newMediaVideos.filter(function (entry) {
          if (!entry) return true;
          var candidates = [
            entry.filename,
            entry.fileName,
            entry.transcodedFilename,
            entry.thumbnailFilename
          ];
          return !candidates.some(function (c) { return filenamesEqual(c, filename); });
        });
        if (beforeVideos !== rec.newMediaVideos.length) changed = true;
      }
      if (rec.videoThumbnails && typeof rec.videoThumbnails === 'object') {
        var vt = Object.assign({}, rec.videoThumbnails);
        var keysBefore = Object.keys(vt).length;
        Object.keys(vt).forEach(function (key) {
          var value = vt[key];
          if (filenamesEqual(key, filename) || filenamesEqual(value, filename)) {
            delete vt[key];
          }
        });
        if (keysBefore !== Object.keys(vt).length) {
          changed = true;
          rec.videoThumbnails = vt;
          files.videoThumbnails = Object.assign({}, vt);
        }
      }
      if (!changed) return;
      rec.files = files;
      rec.photos = files.photos.length;
      rec.videos = files.videos.length;
      list[idx] = rec;
      cache.students = list;
      FLB.State.set({ uploadedRecordsCache: cache });
    } catch (err) {
      console.warn('⚠️ [removeStudentFileFromCache] 失敗:', err);
    }
  }

  async function deleteOverviewFile(triggerEl, filename) {
    if (!currentCourse || !filename) return false;
    if (!confirm('刪除此課程總覽檔案？\n' + filename)) return false;
    var previewNodes = collectOverviewPreviewNodes(filename, triggerEl);
    previewNodes.forEach(function(node){ markPreviewDeleting(node, '刪除中...'); });
    try {
      var st = (window.FLB && FLB.State) ? FLB.State.get() : null;
      var cache = st && st.uploadedRecordsCache ? st.uploadedRecordsCache : {};
      var overviewCache = cache && cache.overview ? cache.overview : null;
      var rel = overviewCache ? (overviewCache.relativePathUnified || overviewCache.relativePath || '') : '';
      var recordPath = overviewCache ? (overviewCache.recordPath || overviewCache.relativePathUnified || overviewCache.relativePath || '') : '';
      if (!rel) {
        var overviewMeta = buildRecordOperationMeta('課程總覽');
        rel = overviewMeta.relativePathUnified || overviewMeta.relativePath || '';
        if (!recordPath) recordPath = rel;
      }
      if (!rel) {
        throw new Error('無法解析課程總覽路徑，請重新載入後重試');
      }
      recordPath = ensureDriveAbsolutePath(recordPath || rel);
      var startDate = new Date(currentCourse.start);
      var dateStr = formatDateTWISO(startDate);
      var parsed = {};
      try {
        if (global.FLB && global.FLB.Course && typeof global.FLB.Course.parseTitle === 'function') {
          parsed = global.FLB.Course.parseTitle(currentCourse.title || '') || {};
        }
      } catch (e) {}
      var courseParam = currentCourse.courseName || parsed.courseName || parsed.course || currentCourse.title || '';
      var periodParam = (parsed.period || '').replace(/\s+/g, '');
      if (!periodParam && overviewCache && overviewCache.coursePeriod) {
        periodParam = String(overviewCache.coursePeriod).replace(/\s+/g, '');
      }
      await global.FLB.Api.deleteRecord({
        course: courseParam,
        period: periodParam,
        date: dateStr,
        filename: filename,
        relativePath: rel,
        recordPath: recordPath
      });

      console.log('✅ [deleteOverviewFile] 刪除成功，清除缓存');
      try {
        var cacheKey = buildLocalCacheKey();
        localStorage.removeItem(cacheKey);
        console.log('✅ [deleteOverviewFile] localStorage 缓存已清除');
      } catch (e) {
        console.warn('⚠️ [deleteOverviewFile] 清除 localStorage 失敗:', e);
      }
      markUploadedCacheDirty('overview-delete', false);
      try {
        if (window.FLB && FLB.State) {
          FLB.State.set({ uploadedRecordsCache: null });
          console.log('✅ [deleteOverviewFile] FLB.State 缓存已清除');
        }
      } catch (e) {
        console.warn('⚠️ [deleteOverviewFile] 清除 FLB.State 失敗:', e);
      }

      previewNodes.forEach(animatePreviewRemoval);
      showToast('已刪除檔案', 'success');
      try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}

      if (AUTO_REFRESH_AFTER_UPLOAD) {
        try {
          requestCourseReload({ showLoader: false, delay: 400, allowCacheBypass: true, reason: 'overview-delete' });
          console.log('✅ [deleteOverviewFile] 已排程重新載入');
        } catch (e) {
          console.error('❌ [deleteOverviewFile] 排程重新載入失敗:', e);
        }
      } else {
        console.log('🧊 [deleteOverviewFile] 已移除預覽 (cache-only)，不觸發重新抓取');
      }
      return true;
    } catch (e) {
      console.error(e);
      previewNodes.forEach(clearPreviewDeleting);
      showToast('刪除失敗：' + (e.message || ''), 'error');
      return false;
    }
  }

  async function openHistory() { 
    var p = document.getElementById('historyPanel'); 
    if (p) { 
      p.classList.add('open');
      
      // 🔥 先載入顏色配置，再填充選單
      await loadColorConfigs();
      populateTeacherFilter();
      populateCourseTypeFilter();
      
      // 🔥 預設篩選為「本週」
      applyQuickFilter('week');
      
      console.log('✅ 歷史記錄面板已開啟（預設本週篩選）');
    } else {
      console.error('❌ 找不到 historyPanel 元素');
    }
  }
  function closeHistory() { 
    var p = document.getElementById('historyPanel'); 
    if (p) {
      p.classList.remove('open'); 
      console.log('✅ 歷史記錄面板已關閉');
    }
  }
  
  // 🔥 歷史記錄 FAB 事件處理
  function initHistoryFab() {
    var historyFab = document.getElementById('historyFab');
    if (historyFab) {
      historyFab.addEventListener('click', async function(e) {
        console.log('🔍 歷史記錄 FAB 被點擊');
        e.preventDefault();
        e.stopPropagation();
        
        // 🔥 先載入顏色配置，再開啟面板
        await loadColorConfigs();
        openHistory();
        
        // 🔥 載入學期列表
        loadSemesters();
      });
      console.log('✅ 歷史記錄 FAB 已初始化');
    } else {
      console.error('❌ 找不到 historyFab 元素');
    }
  }
  
  // ==================== 🔥 新增：學期和課程管理函數 ====================
  
  // 載入學期列表
  async function loadSemesters() {
    try {
      console.log('🔍 開始載入學期列表...');
      var data = await global.FLB.Api.getSemesters();
      if (data && data.success && data.semesters) {
        var select = document.getElementById('filterSemester');
        if (select) {
          select.innerHTML = '<option value="">全部學期</option>' +
            data.semesters.map(function(s) { 
              return '<option value="' + s + '">' + s + '</option>'; 
            }).join('');
          console.log('✅ 學期列表載入成功:', data.semesters.length, '個學期');
        }
      }
    } catch (e) {
      console.error('❌ 載入學期列表失敗:', e);
    }
  }
  
  // 🔥 載入講師和課程顏色配置
  async function loadColorConfigs() {
    try {
      // 載入講師顏色
      var teacherResponse = await fetch('/api/teachers');
      var teacherData = await teacherResponse.json();
      
      if (teacherData.success && teacherData.data && teacherData.data.teachers) {
        window.teacherColorMap = {};
        teacherData.data.teachers.forEach(function(teacher) {
          if (teacher.name && teacher.color) {
            window.teacherColorMap[teacher.name] = teacher.color;
          }
        });
        console.log('✅ 講師顏色已載入:', Object.keys(window.teacherColorMap).length, '位講師');
        console.log('📋 講師清單:', Object.keys(window.teacherColorMap));
        console.log('🎨 講師顏色映射:', window.teacherColorMap);
      } else {
        console.warn('⚠️ 講師顏色載入失敗，使用預設值');
      }
      
      // 載入課程類型顏色
      var courseResponse = await fetch('/api/course-colors');
      var courseData = await courseResponse.json();
      
      if (courseData && (courseData.data || courseData.colors || courseData)) {
        var colors = courseData.data || courseData.colors || courseData;
        window.courseTypeColorMap = {
          'ESM': colors.ESM || '#FFB3D9',
          'SPM': colors.SPM || '#FFA726',
          'SPIKE': colors.SPIKE || '#FFD54F',
          'BOOST': colors.BOOST || '#4FC3F7',
          'EV3': colors.EV3 || '#66BB6A',
          'MINECRAFT': colors.MINECRAFT || '#00b894',
          '資訊課': colors['資訊課'] || '#9C27B0',
          '程式': colors['程式'] || '#3F51B5',
          '機器人': colors['機器人'] || '#FF9800',
          '創客': colors['創客'] || '#4CAF50',
          'OTHER': colors.OTHER || colors.other || '#9E9E9E'
        };
        console.log('✅ 課程類型顏色已載入:', Object.keys(window.courseTypeColorMap).length, '種類型');
      }
    } catch (error) {
      console.error('❌ 載入顏色配置失敗:', error);
      // 使用預設顏色
      window.teacherColorMap = {};
      window.courseTypeColorMap = {
        'ESM': '#FFB3D9',
        'SPM': '#FFA726',
        'SPIKE': '#FFD54F',
        'BOOST': '#4FC3F7',
        'EV3': '#66BB6A',
        'MINECRAFT': '#00b894',
        '資訊課': '#9C27B0',
        '程式': '#3F51B5',
        '機器人': '#FF9800',
        '創客': '#4CAF50',
        'OTHER': '#9E9E9E'
      };
    }
  }
  
  // 🔥 填充講師選單
  function populateTeacherFilter() {
    var teacherSelect = document.getElementById('filterTeacher');
    if (!teacherSelect) return;
    
    // 從顏色配置中獲取講師列表
    var teachers = window.teacherColorMap ? Object.keys(window.teacherColorMap) : 
      ['YOKI', 'TED', 'AGNES', 'HANSEN', 'JAMES', 'IVAN', 'XIAN', 'EASON', 'BELLA', 'GILLIAN', 'DANIEL', 'Dirty', 'TIM', 'Melody'];
    
    teacherSelect.innerHTML = '<option value="">全部講師</option>' +
      teachers.map(function(t) {
        return '<option value="' + t + '">' + t + '</option>';
      }).join('');
    
    console.log('✅ 講師選單已填充:', teachers.length, '位講師');
  }
  
  // 🔥 填充課別選單
  function populateCourseTypeFilter() {
    var courseTypeSelect = document.getElementById('filterCourseType');
    if (!courseTypeSelect) return;
    
    // 從顏色配置中獲取課別列表
    var courseTypes = window.courseTypeColorMap ? Object.keys(window.courseTypeColorMap).filter(function(k) { return k !== 'OTHER'; }) :
      ['SPIKE', 'SPM', 'ESM', 'EV3', 'BOOST', 'MINECRAFT', '資訊課', '程式', '機器人', '創客'];
    
    courseTypeSelect.innerHTML = '<option value="">全部課別</option>' +
      courseTypes.map(function(ct) {
        return '<option value="' + ct + '">' + ct + '</option>';
      }).join('');
    
    console.log('✅ 課別選單已填充:', courseTypes.length, '種課別');
  }
  
  // 學期變更時載入課程列表
  async function onSemesterChange() {
    // 🔥 篩選條件變動時自動收合篩選區
    autoCollapseFilters();
    
    var semester = document.getElementById('filterSemester').value;
    var courseSelect = document.getElementById('filterCourse');
    
    if (!semester) {
      courseSelect.innerHTML = '<option value="">全部課程</option>';
      loadHistory();
      return;
    }
    
    try {
      console.log('🔍 載入課程列表:', semester);
      courseSelect.innerHTML = '<option value="">載入中...</option>';
      var data = await global.FLB.Api.getCourses(semester);
      if (data && data.success && data.courses) {
        courseSelect.innerHTML = '<option value="">全部課程</option>' +
          data.courses.map(function(c) { 
            return '<option value="' + c + '">' + c + '</option>'; 
          }).join('');
        console.log('✅ 課程列表載入成功:', data.courses.length, '個課程');
      }
    } catch (e) {
      console.error('❌ 載入課程列表失敗:', e);
      courseSelect.innerHTML = '<option value="">載入失敗</option>';
    }
    
    loadHistory();
  }
  
  // 快速篩選
  function applyQuickFilter(filterType) {
    console.log('🔍 應用快速篩選:', filterType);
    
    // 更新按鈕狀態
    var buttons = document.querySelectorAll('.quick-filter-btn');
    buttons.forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.filter === filterType);
    });
    
    var dateInput = document.getElementById('filterDate');
    var today = new Date();
    
    // 🔥 儲存篩選類型到全域變數
    window.currentQuickFilter = filterType;
    
    switch (filterType) {
      case 'today':
        dateInput.value = today.toISOString().split('T')[0];
        break;
      case 'week':
        // 🔥 本週模式：清空日期輸入，後續在前端篩選整週的記錄
        dateInput.value = '';
        break;
      case 'all':
      default:
        dateInput.value = '';
        break;
    }
    
    loadHistory();
  }
  
  // 跳轉到記錄詳情
  function jumpToRecord(recordJson) {
    try {
      var record = JSON.parse(decodeURIComponent(recordJson));
      console.log('🔍 跳轉到記錄:', record);
      
      // 關閉歷史記錄面板
      closeHistory();
      
      // 🔥 從 course 字串中提取時間資訊（例如 "SPIKE 三 18:30-20:30 第8週"）
      var courseStr = record.course || '';
      var dateStr = record.date || '';
      
      // 提取日期（可能包含主題，如 "2025-11-05 四足獸"）
      var dateParts = dateStr.split(' ');
      var dateOnly = dateParts[0]; // 取出純日期部分
      var topic = dateParts.slice(1).join(' '); // 剩餘的是主題
      
      // 提取時間（支援 HH:MM-HH:MM 或 HHMM-HHMM）
      var timeMatch = courseStr.match(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})|(\d{4})-(\d{4})/);
      var startTime = '';
      var endTime = '';
      
      if (timeMatch) {
        if (timeMatch[1] && timeMatch[2]) {
          startTime = timeMatch[1]; // 例如 18:30
          endTime = timeMatch[2];   // 例如 20:30
        } else if (timeMatch[3] && timeMatch[4]) {
          // 將 HHMM 轉為 HH:MM
          startTime = timeMatch[3].substring(0,2) + ':' + timeMatch[3].substring(2);
          endTime   = timeMatch[4].substring(0,2) + ':' + timeMatch[4].substring(2);
        }
      }
      
      console.log('🔍 解析結果:', {
        course: courseStr,
        date: dateOnly,
        topic: topic,
        startTime: startTime,
        endTime: endTime
      });
      
      // 構建目標 URL 參數（包含更多資訊）
      var params = new URLSearchParams({
        course: courseStr,
        date: dateOnly,
        autoLoad: 'true'
      });
      
      // 如果有時間資訊，也加入
      if (startTime) {
        params.set('time', startTime);
      }
      if (endTime) {
        params.set('end', endTime);
      }
      // 若有講師資訊，亦加入（提升多堂同日的命中率）
      try {
        var teacherFromRecord = record.teacher || record.instructorName || '';
        if (teacherFromRecord) params.set('instructor', teacherFromRecord);
      } catch (e) {}
      
      // 如果有主題，也加入
      if (topic) {
        params.set('topic', topic);
      }
      
      // 如果有學生名稱且不是課程總覽，也加入
      if (record.studentName && record.type !== 'overview') {
        params.set('student', record.studentName);
      }
      
      console.log('🔗 跳轉 URL:', window.location.pathname + '?' + params.toString());
      
      // 重新載入頁面並帶入參數
      window.location.href = window.location.pathname + '?' + params.toString();
      
    } catch (e) {
      console.error('❌ 跳轉失敗:', e);
      alert('無法開啟該記錄，請稍後再試');
    }
  }
  
  // 🔥 篩選區折疊/展開
  function toggleHistoryFilters() {
    var container = document.getElementById('historyFiltersContainer');
    if (container) {
      container.classList.toggle('collapsed');
      console.log('🔄 切換篩選區:', container.classList.contains('collapsed') ? '收起' : '展開');
    }
  }
  
  // 🔥 自動收合篩選區（當篩選條件變動時）
  function autoCollapseFilters() {
    var container = document.getElementById('historyFiltersContainer');
    if (container && !container.classList.contains('collapsed')) {
      container.classList.add('collapsed');
      console.log('✅ 篩選條件變動，自動收合篩選區');
    }
  }
  
  // 🔥 歷史記錄卡片折疊/展開
  function toggleHistoryRecord(recordId) {
    var card = document.getElementById(recordId);
    if (card) {
      card.classList.toggle('expanded');
      var isExpanded = card.classList.contains('expanded');
      console.log('🔄 切換課程卡片:', recordId, isExpanded ? '展開' : '收起');
      
      // 更新展開指示器圖標
      var indicator = card.querySelector('.record-expand-icon i');
      if (indicator) {
        indicator.className = isExpanded ? 'fas fa-chevron-up' : 'fas fa-chevron-down';
      }
    }
  }
  
  // 🔥 切換歷史記錄的 Tab（課程總覽 / 學生記錄）
  function switchRecordTab(recordId, tabName) {
    var card = document.getElementById(recordId);
    if (!card) return;
    
    // 切換 Tab 按鈕的 active 狀態
    var tabs = card.querySelectorAll('.record-tab');
    tabs.forEach(function(tab) {
      var isActive = tab.getAttribute('data-tab') === tabName;
      if (isActive) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // 切換 Tab 面板的顯示
    var panels = card.querySelectorAll('.record-tab-panel');
    panels.forEach(function(panel) {
      var isActive = panel.getAttribute('data-panel') === tabName;
      if (isActive) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });
    
    console.log('🔄 切換 Tab:', recordId, '→', tabName);
  }
  
  // 🔥 暴露到全域（供 HTML onclick 使用）
  window.openHistory = openHistory;
  window.closeHistory = closeHistory;
  window.onSemesterChange = onSemesterChange;
  window.applyQuickFilter = applyQuickFilter;
  window.switchRecordTab = switchRecordTab;
  window.jumpToRecord = jumpToRecord;
  window.toggleHistoryFilters = toggleHistoryFilters;
  window.toggleHistoryRecord = toggleHistoryRecord;

  // 🔥 條件日誌系統（僅在開發環境或啟用除錯時輸出）
  var DEBUG_MODE = window.location.hostname === 'localhost' || 
                   window.location.hostname === '127.0.0.1' ||
                   window.location.search.includes('debug=true');
  
  function debugLog() {
    if (DEBUG_MODE && console && console.log) {
      console.log.apply(console, arguments);
    }
  }
  
  function debugWarn() {
    if (DEBUG_MODE && console && console.warn) {
      console.warn.apply(console, arguments);
    }
  }
  
  function debugError() {
    if (console && console.error) {
      console.error.apply(console, arguments);
    }
  }
  
  // 🔥 根據背景顏色計算合適的文字顏色
  function getContrastColor(hexColor) {
    if (!hexColor) return '#000000';
    
    // 移除 # 符號
    var hex = hexColor.replace('#', '');
    
    // 轉換為 RGB
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    
    // 計算亮度 (使用 YIQ 公式)
    var yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    
    // 根據亮度返回黑色或白色
    return (yiq >= 128) ? '#000000' : '#FFFFFF';
  }
  
  // 🔥 大小寫不敏感的講師顏色查找
  function getTeacherColor(teacherName) {
    if (!teacherName || !window.teacherColorMap) return null;
    
    // 嘗試直接匹配
    if (window.teacherColorMap[teacherName]) {
      return window.teacherColorMap[teacherName];
    }
    
    // 嘗試大小寫不敏感匹配
    var teacherUpper = teacherName.toUpperCase();
    for (var key in window.teacherColorMap) {
      if (window.teacherColorMap.hasOwnProperty(key)) {
        if (key.toUpperCase() === teacherUpper) {
          return window.teacherColorMap[key];
        }
      }
    }
    
    return null;
  }
  
  // 🔥 大小寫不敏感的課別顏色查找
  function getCourseTypeColor(courseType) {
    if (!courseType || !window.courseTypeColorMap) return null;
    
    // 嘗試直接匹配
    if (window.courseTypeColorMap[courseType]) {
      return window.courseTypeColorMap[courseType];
    }
    
    // 嘗試大小寫不敏感匹配
    var typeUpper = courseType.toUpperCase();
    for (var key in window.courseTypeColorMap) {
      if (window.courseTypeColorMap.hasOwnProperty(key)) {
        if (key.toUpperCase() === typeUpper) {
          return window.courseTypeColorMap[key];
        }
      }
    }
    
    return null;
  }
  
  // 🔥 從課程名稱提取時間（用於排序）
  function extractTimeFromCourse(courseName) {
    if (!courseName) return null;
    var match = courseName.match(/(\d{1,2}):(\d{2})/);
    if (match) {
      var hour = match[1].padStart(2, '0');
      var minute = match[2];
      return hour + ':' + minute;
    }
    return null;
  }
  
  // 🔥 從課程路徑或標題中提取講師名稱
  function extractTeacherFromRecord(record, debugMode) {
    if (!record) {
      if (debugMode) console.log('🔍 [提取講師] 記錄為空');
      return null;
    }
    
    if (debugMode) {
      console.log('🔍 [提取講師] 開始提取:', {
        course: record.course,
        path: record.path || record.recordPath || record.relativePath,
        teacher: record.teacher
      });
    }
    
    // 方法1: 從 record.teacher 欄位直接獲取（如果後端有提供）
    if (record.teacher) {
      if (debugMode) console.log('✅ [提取講師] 方法1成功（直接欄位）:', record.teacher);
      return record.teacher;
    }
    
    // 方法2: 從課程路徑中解析（例如：data/learning-portfolio/113-1/YOKI/...）
    var rawPath = record.path || record.recordPath || record.relativePath || '';
    if (rawPath) {
      var pathParts = rawPath.split('/');
      if (debugMode) console.log('🔍 [提取講師] 路徑分段:', pathParts);
      
      // 講師名稱通常在學期後面
      for (var i = 0; i < pathParts.length; i++) {
        if (pathParts[i].match(/^\d{3}-\d$/)) {
          if (debugMode) console.log('🔍 [提取講師] 找到學期:', pathParts[i], '索引:', i);
          if (i + 1 < pathParts.length) {
            var potentialTeacher = pathParts[i + 1];
            if (debugMode) console.log('🔍 [提取講師] 檢查可能的講師:', potentialTeacher);
            if (isValidTeacherName(potentialTeacher)) {
              if (debugMode) console.log('✅ [提取講師] 方法2成功（從路徑）:', potentialTeacher);
              return potentialTeacher;
            } else {
              if (debugMode) console.log('❌ [提取講師] 不是有效的講師名稱:', potentialTeacher);
            }
          }
        }
      }
      if (debugMode) console.log('⚠️ [提取講師] 方法2失敗：無法從路徑中找到講師');
    } else if (debugMode) { console.log('⚠️ [提取講師] 記錄中沒有可用的路徑欄位'); }
    
    // 方法3: 從課程標題中查找（如 "JAMES - SPIKE 課程"）
    var courseTitle = record.course || '';
    var teacherNames = window.teacherColorMap ? Object.keys(window.teacherColorMap) :
      ['YOKI', 'TED', 'AGNES', 'HANSEN', 'JAMES', 'IVAN', 'XIAN', 'EASON', 'BELLA', 'GILLIAN', 'DANIEL', 'Dirty', 'TIM', 'Melody'];
    
    if (debugMode) debugLog('🔍 [提取講師] 從標題查找，可用講師:', teacherNames);
    
    var titleUpper = courseTitle.toUpperCase();
    
    // 🔥 改進：使用單詞邊界匹配，避免錯誤匹配子字串
    for (var i = 0; i < teacherNames.length; i++) {
      var teacher = teacherNames[i];
      var teacherUpper = teacher.toUpperCase();
      
      // 使用正則表達式確保完整單詞匹配
      // \b 表示單詞邊界，或者檢查前後是否為分隔符
      var regex = new RegExp('(^|[^a-zA-Z])' + teacherUpper + '($|[^a-zA-Z])');
      if (regex.test(titleUpper)) {
        if (debugMode) debugLog('✅ [提取講師] 方法3成功（從標題）:', teacher);
        return teacher;
      }
    }
    
    if (debugMode) debugLog('❌ [提取講師] 所有方法都失敗，無法提取講師');
    return null;
  }
  
  // 🔥 檢查是否為有效的講師名稱
  function isValidTeacherName(name) {
    if (!name) return false;
    var teacherNames = window.teacherColorMap ? Object.keys(window.teacherColorMap) :
      ['YOKI', 'TED', 'AGNES', 'HANSEN', 'JAMES', 'IVAN', 'XIAN', 'EASON', 'BELLA', 'GILLIAN', 'DANIEL', 'Dirty', 'TIM', 'Melody'];
    return teacherNames.some(function(t) {
      return t.toUpperCase() === name.toUpperCase();
    });
  }
  
  // 🔥 從課程標題中提取課別
  function extractCourseTypeFromTitle(courseTitle) {
    if (!courseTitle) return null;
    
    // 從顏色配置中獲取課別列表，或使用預設列表
    var courseTypeList = window.courseTypeColorMap ? Object.keys(window.courseTypeColorMap).filter(function(k) { return k !== 'OTHER'; }) :
      ['SPIKE', 'SPM', 'ESM', 'EV3', 'BOOST', 'MINECRAFT', '資訊課', '程式', '機器人', '創客'];
    
    // 將列表轉換為對象便於查找
    var courseTypes = {};
    for (var i = 0; i < courseTypeList.length; i++) {
      var type = courseTypeList[i];
      courseTypes[type] = type;
    }
    
    var titleUpper = courseTitle.toUpperCase();
    for (var key in courseTypes) {
      if (courseTypes.hasOwnProperty(key) && titleUpper.includes(key.toUpperCase())) {
        return courseTypes[key];
      }
    }
    
    return null;
  }

  async function loadHistory() {
    try {
      // 🔥 篩選條件變動時自動收合篩選區
      autoCollapseFilters();
      
      debugLog('🔍 [前端] 開始載入歷史記錄');
      var semester = (document.getElementById('filterSemester') || {}).value || '';
      var course = (document.getElementById('filterCourse') || {}).value || '';
      var date = (document.getElementById('filterDate') || {}).value || '';
      var teacher = (document.getElementById('filterTeacher') || {}).value || '';
      var courseType = (document.getElementById('filterCourseType') || {}).value || '';
      
      debugLog('🔍 [前端] 篩選條件:', { semester, course, date, teacher, courseType });
      
      var container = document.getElementById('historyRecords');
      if (!container) {
        console.error('❌ 找不到 historyRecords 容器');
        return;
      }
      
      // 顯示載入中
      container.innerHTML = '<div class="history-loading"><i class="fas fa-spinner fa-spin" style="font-size:32px; color:#10b981;"></i><p style="margin-top:12px; color:#64748b;">載入中...</p></div>';
      
      var data = await global.FLB.Api.getHistory({ semester: semester, course: course, date: date });
      
      debugLog('✅ [前端] API 回應:', data);
      debugLog('📊 [前端] API 統計:', {
        success: data ? data.success : false,
        recordsCount: data && data.records ? data.records.length : 0,
        searchPath: data ? data.searchPath : 'N/A'
      });
      
      if (!data || !data.success) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>載入失敗</h3><p>請稍後再試</p></div>';
        return;
      }
      
      var records = data.records || [];
      
      // 🔍 調試：查看前幾筆記錄的完整結構
      if (records.length > 0) {
        debugLog('🔍 [調試] 後端返回記錄總數:', records.length);
        debugLog('🔍 [調試] 第一筆記錄:', {
          course: records[0].course,
          date: records[0].date,
          teacher: records[0].teacher || '❌ 無講師',
          studentName: records[0].studentName,
          type: records[0].type,
          photos: records[0].photos,
          videos: records[0].videos
        });
        if (records.length > 1) {
          debugLog('🔍 [調試] 第二筆記錄:', {
            course: records[1].course,
            date: records[1].date,
            teacher: records[1].teacher || '❌ 無講師',
            studentName: records[1].studentName,
            type: records[1].type
          });
        }
        
        // 🔥 統計有多少記錄包含講師資訊
        var withTeacher = records.filter(function(r) { return r.teacher; }).length;
        debugLog('📊 [統計] 有講師資訊的記錄:', withTeacher + '/' + records.length);
        debugLog('📊 [統計] 講師分佈:', records.reduce(function(acc, r) {
          if (r.teacher) {
            acc[r.teacher] = (acc[r.teacher] || 0) + 1;
          }
          return acc;
        }, {}));
        
        // 🔥 顯示課程分佈統計
        var courseStats = {};
        records.forEach(function(r) {
          var courseName = r.course || '未知課程';
          courseStats[courseName] = (courseStats[courseName] || 0) + 1;
        });
        debugLog('📊 [調試] 課程分佈:', courseStats);
        
        // 🔥 顯示所有課程的完整清單（用於除錯）
        debugLog('📋 [調試] 所有課程清單:');
        if (DEBUG_MODE) {
          records.forEach(function(r, idx) {
            console.log(`  ${idx + 1}. ${r.course} - ${r.date} - ${r.studentName} (${r.type})`);
          });
        }
      } else {
        debugWarn('⚠️ [前端] 後端返回 0 筆記錄');
      }
      
      // 🔥 套用本週篩選
      if (window.currentQuickFilter === 'week') {
        debugLog('🔍 應用本週篩選');
        var today = new Date();
        var currentDay = today.getDay() || 7; // 0 是週日，轉為 7
        var monday = new Date(today);
        monday.setDate(today.getDate() - currentDay + 1);
        monday.setHours(0, 0, 0, 0);
        
        var sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        debugLog('🔍 本週範圍:', monday.toISOString(), '到', sunday.toISOString());
        
        records = records.filter(function(record) {
          if (!record.date) return false;
          
          // 🔥 改進：從 date 字串提取日期部分（格式可能是 "2025-11-05" 或 "2025-11-05 四足獸"）
          var dateParts = record.date.split(' ');
          var dateStr = dateParts[0];
          
          // 🔥 改進：使用正則表達式確保日期格式正確並補零
          var dateMatch = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
          if (!dateMatch) {
            debugWarn('⚠️ 日期格式不正確:', dateStr);
            return false;
          }
          
          var year = dateMatch[1];
          var month = dateMatch[2].padStart(2, '0');
          var day = dateMatch[3].padStart(2, '0');
          var normalizedDateStr = year + '-' + month + '-' + day;
          
          // 🔥 改進：使用明確的本地時區解析（避免 UTC 時區問題）
          var recordDate = new Date(normalizedDateStr + 'T00:00:00');
          
          if (isNaN(recordDate.getTime())) {
            debugWarn('⚠️ 日期解析失敗:', normalizedDateStr);
            return false;
          }
          
          return recordDate >= monday && recordDate <= sunday;
        });
        
        debugLog('🔍 本週篩選後:', records.length, '筆記錄');
        
        // 🔥 顯示篩選後的課程清單
        if (records.length > 0) {
          console.log('📋 [本週篩選後] 課程清單:');
          records.forEach(function(r, idx) {
            console.log(`  ${idx + 1}. ${r.course} - ${r.date}`);
          });
        }
      }
      
      // 🔥 套用前端篩選（講師和課別）
      if (teacher || courseType) {
        debugLog('🔍 開始講師/課別篩選，條件:', { teacher: teacher, courseType: courseType });
        debugLog('📊 篩選前記錄數:', records.length);
        
        var beforeFilterCount = records.length;
        
        records = records.filter(function(record, idx) {
          var recordTeacher = extractTeacherFromRecord(record, idx < 5); // 前5筆啟用詳細日誌
          var recordCourseType = extractCourseTypeFromTitle(record.course);
          
          // 🔥 改進：大小寫不敏感比較
          var teacherMatch = !teacher || (
            recordTeacher && 
            recordTeacher.toUpperCase() === teacher.toUpperCase()
          );
          
          var courseTypeMatch = !courseType || (
            recordCourseType && 
            recordCourseType.toUpperCase() === courseType.toUpperCase()
          );
          
          if (idx < 5) {
            debugLog(`🔍 [記錄 ${idx + 1}/${beforeFilterCount}]`, {
              course: record.course,
              recordTeacher: recordTeacher,
              recordCourseType: recordCourseType,
              targetTeacher: teacher,
              targetCourseType: courseType,
              teacherMatch: teacherMatch,
              courseTypeMatch: courseTypeMatch,
              pass: teacherMatch && courseTypeMatch
            });
          }
          
          return teacherMatch && courseTypeMatch;
        });
        
        debugLog('✅ 篩選完成:', {
          before: beforeFilterCount,
          after: records.length,
          filtered: beforeFilterCount - records.length
        });
        
        // 🔥 顯示講師/課別篩選後的課程清單
        if (records.length > 0) {
          console.log('📋 [講師/課別篩選後] 課程清單:');
          records.forEach(function(r, idx) {
            console.log(`  ${idx + 1}. ${r.course} - ${r.date} - ${r.studentName}`);
          });
        }
      } else {
        console.log('ℹ️ 無講師/課別篩選條件，顯示所有記錄');
      }
      
      if (records.length === 0) {
        container.innerHTML = '<div class="empty-state"><i class="fas fa-folder-open"></i><h3>沒有找到記錄</h3><p>嘗試調整篩選條件或選擇其他日期</p></div>';
        console.log('📭 沒有找到任何記錄');
        return;
      }
      
      console.log('📊 找到', records.length, '筆記錄');
      
      // 🔥 將記錄按課程+日期分組（合併同一堂課的總覽和學生記錄）
      var groupedRecords = {};
      records.forEach(function(record) {
        // 🔥 改進：從課程名稱提取時間，增加分組鍵的唯一性
        var courseTime = extractTimeFromCourse(record.course) || '';
        var key = record.course + '|' + record.date + '|' + courseTime;
        
        if (!groupedRecords[key]) {
          groupedRecords[key] = {
            course: record.course,
            date: record.date,
            courseTime: courseTime,
            overview: null,
            students: [],
            totalPhotos: 0,
            totalVideos: 0
          };
        }
        
        if (record.type === 'overview') {
          groupedRecords[key].overview = record;
        } else {
          groupedRecords[key].students.push(record);
        }
        
        groupedRecords[key].totalPhotos += record.photos || 0;
        groupedRecords[key].totalVideos += record.videos || 0;
      });
      
      // 🔥 改進：轉換為陣列並排序（最新的在前，同日期按時間排序）
      var groupedArray = Object.values(groupedRecords).sort(function(a, b) {
        // 提取純日期部分進行比較
        var dateA = a.date.split(' ')[0];
        var dateB = b.date.split(' ')[0];
        
        // 首先按日期降序（最新在前）
        var dateCompare = dateB.localeCompare(dateA);
        if (dateCompare !== 0) return dateCompare;
        
        // 日期相同，按課程時間升序排序（早的在前）
        var timeA = a.courseTime || '00:00';
        var timeB = b.courseTime || '00:00';
        return timeA.localeCompare(timeB);
      });
      
      debugLog('✅ 合併後共', groupedArray.length, '堂課程');
      
      // 🔥 新的渲染邏輯：每堂課顯示為一個可折疊卡片
      container.innerHTML = groupedArray.map(function (group, index) {
        var dateStr = group.date || '';
        var course = group.course || '';
        var overview = group.overview;
        var students = group.students || [];
        var totalPhotos = group.totalPhotos || 0;
        var totalVideos = group.totalVideos || 0;
        
        // 🔥 課程總覽內容（優先使用 overviewSummary，其次使用 comment）
        var overviewComment = overview ? ((overview.overviewSummary || overview.comment) || '') : '';
        var hasOverview = overviewComment && overviewComment.trim().length > 0;
        var overviewPreview = overviewComment.length > 200 ? (overviewComment.substring(0, 200) + '...') : overviewComment;
        
        // 🔥 獲取講師資訊（優先使用後端返回的資料）
        var teacher = null;
        
        // 🔍 調試：顯示 overview 物件結構
        if (index < 3 && overview) {
          console.log('🔍 [記錄 ' + (index + 1) + '] overview 物件:', {
            teacher: overview.teacher,
            course: overview.course,
            type: overview.type,
            '所有鍵': Object.keys(overview)
          });
        }
        
        if (overview && overview.teacher) {
          teacher = overview.teacher;
          if (index < 5) console.log('✅ [記錄 ' + (index + 1) + '] 講師來源: 課程總覽 →', teacher);
        } else if (students.length > 0 && students[0].teacher) {
          teacher = students[0].teacher;
          if (index < 5) console.log('✅ [記錄 ' + (index + 1) + '] 講師來源: 第一位學生 →', teacher);
        }
        
        // 如果後端沒有提供，嘗試從課程名稱匹配
        if (!teacher) {
          var dummyRecord = { course: course, path: overview ? overview.path : '' };
          teacher = extractTeacherFromRecord(dummyRecord, index < 5);
          if (index < 5) {
            if (teacher) {
              console.log('🔍 [記錄 ' + (index + 1) + '] 講師來源: 前端提取 -', teacher);
            } else {
              console.warn('⚠️ [記錄 ' + (index + 1) + '] 無法提取講師:', { course: course, path: overview ? overview.path : '' });
            }
          }
        }
        
        // 🔥 提取課別
        var courseTypeVal = extractCourseTypeFromTitle(course);
        
        // 🔥 改進：使用大小寫不敏感的顏色查找函數
        var teacherColor = teacher ? getTeacherColor(teacher) : null;
        var courseTypeColor = courseTypeVal ? getCourseTypeColor(courseTypeVal) : null;
        
        // 🔥 生成講師標籤樣式（有顏色用動態顏色，無顏色用預設樣式）
        var teacherTagStyle = '';
        if (teacherColor) {
          var teacherTextColor = getContrastColor(teacherColor);
          teacherTagStyle = 'background: ' + teacherColor + '; color: ' + teacherTextColor + '; border: 1px solid ' + teacherColor + ';';
        } else if (teacher) {
          // 🔥 預設樣式：藍色系
          teacherTagStyle = 'background: #3b82f6; color: #ffffff; border: 1px solid #3b82f6;';
        }
        
        // 🔥 除錯日誌：顯示講師標籤狀態
        if (index < 5) {
          debugLog('🎨 [記錄 ' + (index + 1) + '] 講師標籤:', {
            teacher: teacher,
            teacherColor: teacherColor || '(使用預設藍色)',
            hasTag: !!teacher,
            tagStyle: teacherTagStyle ? '✅ 有樣式' : '❌ 無樣式'
          });
        }
        
        // 🔥 生成課別標籤樣式
        var courseTypeTagStyle = '';
        if (courseTypeColor) {
          var courseTypeTextColor = getContrastColor(courseTypeColor);
          courseTypeTagStyle = 'background: ' + courseTypeColor + '; color: ' + courseTypeTextColor + '; border: 1px solid ' + courseTypeColor + ';';
        }
        
        // 生成唯一ID
        var recordId = 'history-record-' + index;
        
        return (
          '<div class="history-record" id="' + recordId + '">' +
            // 🔥 摘要區（可點擊展開）
            '<div class="history-record-summary" onclick="toggleHistoryRecord(\'' + recordId + '\')">' +
              '<div class="record-header">' +
                '<div class="record-main-info">' +
                  '<div class="record-course-name">' + global.FLB.Course.escapeHtml(course) + '</div>' +
                  '<div class="record-tags">' +
                    (teacher ? '<span class="record-tag record-tag--teacher" style="' + teacherTagStyle + '"><i class="fas fa-user-tie"></i> ' + global.FLB.Course.escapeHtml(teacher) + '</span>' : '') +
                    (courseTypeVal ? '<span class="record-tag record-tag--course-type" style="' + courseTypeTagStyle + '"><i class="fas fa-tag"></i> ' + global.FLB.Course.escapeHtml(courseTypeVal) + '</span>' : '') +
                  '</div>' +
                '</div>' +
                '<div class="record-expand-icon">' +
                  '<i class="fas fa-chevron-down"></i>' +
                '</div>' +
              '</div>' +
              '<div class="record-meta">' +
                '<div class="record-date"><i class="fas fa-calendar"></i> ' + global.FLB.Course.escapeHtml(dateStr) + '</div>' +
                '<div class="record-stats">' +
                  '<span><i class="fas fa-users"></i> ' + (students.length > 0 ? students.length + ' 位學生' : '無學生記錄') + '</span>' +
                  '<span><i class="fas fa-camera"></i> ' + totalPhotos + '</span>' +
                  '<span><i class="fas fa-video"></i> ' + totalVideos + '</span>' +
                  (hasOverview ? '<span><i class="fas fa-file-alt"></i> ' + overviewComment.length + ' 字</span>' : '') +
                '</div>' +
              '</div>' +
            '</div>' +
            // 🔥 詳細內容區（預設隱藏）- 使用 Tab 切換
            '<div class="history-record-details">' +
              '<div class="history-record-details-inner">' +
                // 🎯 Tab 選單（只在有內容時顯示）
                ((hasOverview && students.length > 0) ? 
                  '<div class="record-tabs">' +
                    '<button class="record-tab active" data-tab="overview" onclick="switchRecordTab(\'' + recordId + '\', \'overview\')">' +
                      '<i class="fas fa-chalkboard-teacher"></i> 課程總覽' +
                    '</button>' +
                    '<button class="record-tab" data-tab="students" onclick="switchRecordTab(\'' + recordId + '\', \'students\')">' +
                      '<i class="fas fa-user-graduate"></i> 學生記錄 (' + students.length + ')' +
                    '</button>' +
                  '</div>'
                  : ''
                ) +
                // 📋 Tab 內容區
                '<div class="record-tab-content">' +
                  // 課程總覽 Tab
                  (hasOverview ? 
                    (function() {
                      // 🔥 確保 overview 物件包含完整的 course 和 date 資訊
                      var overviewWithFullInfo = Object.assign({}, overview, {
                        course: course,
                        date: dateStr,
                        type: 'overview'
                      });
                      return (
                        '<div class="record-tab-panel active" data-panel="overview">' +
                          '<div class="overview-card">' +
                            '<div class="overview-card-header">' +
                              '<i class="fas fa-clipboard-list"></i>' +
                              '<span>課程紀錄</span>' +
                            '</div>' +
                            '<div class="overview-card-body">' +
                              '<div class="overview-comment">' + 
                                global.FLB.Course.escapeHtml(overviewPreview).replace(/\n/g, '<br>') +
                              '</div>' +
                            '</div>' +
                            (overview && overview.path ? 
                              '<div class="overview-card-footer">' +
                                '<button class="card-action-btn" onclick="event.stopPropagation(); jumpToRecord(\'' + encodeURIComponent(JSON.stringify(overviewWithFullInfo)) + '\');">' +
                                  '<i class="fas fa-external-link-alt"></i> 查看完整內容' +
                                '</button>' +
                              '</div>'
                              : ''
                            ) +
                          '</div>' +
                        '</div>'
                      );
                    })()
                    : ''
                  ) +
                  // 學生記錄 Tab
                  (students.length > 0 ? 
                    '<div class="record-tab-panel' + (hasOverview ? '' : ' active') + '" data-panel="students">' +
                      '<div class="students-grid">' +
                        students.map(function(student) {
                          var studentComment = student.comment || '';
                          var hasStudentComment = studentComment && studentComment.trim().length > 0;
                          var studentPreview = studentComment.length > 150 ? (studentComment.substring(0, 150) + '...') : studentComment;
                          
                          // 🔥 確保 student 物件包含完整的 course 和 date 資訊
                          var studentWithFullInfo = Object.assign({}, student, {
                            course: course,
                            date: dateStr,
                            type: 'student'
                          });
                          
                          return (
                            '<div class="student-card">' +
                              '<div class="student-card-header">' +
                                '<div class="student-info">' +
                                  '<i class="fas fa-user-circle"></i>' +
                                  '<span class="student-card-name">' + global.FLB.Course.escapeHtml(student.studentName) + '</span>' +
                                '</div>' +
                                '<div class="student-media-count">' +
                                  '<span><i class="fas fa-image"></i> ' + (student.photos || 0) + '</span>' +
                                  '<span><i class="fas fa-film"></i> ' + (student.videos || 0) + '</span>' +
                                '</div>' +
                              '</div>' +
                              '<div class="student-card-body">' +
                                (hasStudentComment ? 
                                  '<div class="student-card-comment">' + global.FLB.Course.escapeHtml(studentPreview).replace(/\n/g, '<br>') + '</div>' 
                                  : '<div class="student-card-empty"><i class="fas fa-inbox"></i> 尚無評語記錄</div>'
                                ) +
                              '</div>' +
                              '<div class="student-card-footer">' +
                                '<button class="card-action-btn" onclick="event.stopPropagation(); jumpToRecord(\'' + encodeURIComponent(JSON.stringify(studentWithFullInfo)) + '\');">' +
                                  '<i class="fas fa-eye"></i> 查看完整記錄' +
                                '</button>' +
                              '</div>' +
                            '</div>'
                          );
                        }).join('') +
                      '</div>' +
                    '</div>' 
                    : ''
                  ) +
                  // 無內容提示
                  (!hasOverview && students.length === 0 ? 
                    '<div class="record-empty-state">' +
                      '<i class="fas fa-inbox"></i>' +
                      '<p>本課程暫無記錄</p>' +
                    '</div>'
                    : ''
                  ) +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>'
        );
      }).join('');
      
      debugLog('✅ 歷史記錄渲染完成');
    } catch (e) {
      debugError('❌ 載入歷史記錄失敗:', e);
      
      // 🔥 改進：錯誤分類與友善提示
      var container = document.getElementById('historyRecords');
      if (container) {
        var errorType = '未知錯誤';
        var suggestion = '請稍後再試';
        var showRetry = true;
        
        var errorMsg = e.message || '';
        
        // 根據錯誤類型提供不同的提示
        if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
          errorType = '網路連線問題';
          suggestion = '請檢查您的網路連線後重試';
        } else if (errorMsg.includes('JSON') || errorMsg.includes('parse')) {
          errorType = '資料格式錯誤';
          suggestion = '伺服器返回的資料格式不正確，請聯絡技術支援';
        } else if (errorMsg.includes('timeout') || errorMsg.includes('timed out')) {
          errorType = '請求超時';
          suggestion = '伺服器回應時間過長，請重試或稍後再試';
        } else if (errorMsg.includes('permission') || errorMsg.includes('denied')) {
          errorType = '權限不足';
          suggestion = '您沒有查看此資料的權限，請聯絡管理員';
          showRetry = false;
        }
        
        container.innerHTML = 
          '<div class="empty-state" style="padding: 40px 20px;">' +
            '<i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f59e0b; margin-bottom: 16px;"></i>' +
            '<h3 style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">' + errorType + '</h3>' +
            '<p style="color: #64748b; margin-bottom: 20px;">' + suggestion + '</p>' +
            (showRetry ? '<button onclick="loadHistory()" style="background: #10b981; color: white; border: none; padding: 10px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;"><i class="fas fa-redo"></i> 重新載入</button>' : '') +
          '</div>';
      }
      
      showToast('載入失敗: ' + errorType, 'error');
    }
  }

  function refreshCourses() { loadCompletedCourses(); }

  function goBack() { try { global.location.href = 'https://calendar.funlearnbar.synology.me/perfect-calendar-modular.html'; } catch (e) { global.location.href = '/perfect-calendar-modular.html'; } }
  function goToToday() { global.location.href = '/learning-record-upload.html'; }

  function bindFilters() {
    var rangeFilterEl = document.getElementById('rangeFilter');
    var statusFilterEl = document.getElementById('statusFilter');
    if (rangeFilterEl) {
      rangeFilterEl.addEventListener('change', function () {
        var target = (global.FLB.UrlParams && global.FLB.UrlParams.getTargetInfo && global.FLB.UrlParams.getTargetInfo()) || {};
        currentFilterDateOverride = target.date || null;
        try { window.__suppressAutoSelectUntil = Date.now() + 2000; } catch (e) {}
        loadCompletedCourses({ suppressAutoSelect: true });
      });
    }
    if (statusFilterEl) {
      statusFilterEl.addEventListener('change', function () {
        var filtered = renderFilteredCourses();
        renderCourseCards(filtered);
        updateCourseSummary(allCourses, courseFiltersMeta, filtered.length);
      });
    }
  }

  function buildUniqueList(items) {
    var seen = {};
    var out = [];
    items.forEach(function (v) {
      var key = String(v || '').trim();
      if (key && !seen[key]) { seen[key] = true; out.push(key); }
    });
    return out.sort();
  }

  function initAdvancedFilters() {
    // 講師下拉
    var instructorEl = document.getElementById('instructorFilter');
    if (instructorEl) {
      var instructors = buildUniqueList(allCourses.map(function (c) { return c.instructor; }));
      var selected = activeFilters.instructor || (currentTeacher && currentTeacher.name) || '';
      var options = ['<option value="">全部講師</option>'].concat(instructors.map(function (name) {
        var sel = (name === selected) ? ' selected' : '';
        return '<option value="' + global.FLB.Course.escapeHtml(name) + '"' + sel + '>' + global.FLB.Course.escapeHtml(name) + '</option>';
      }));
      instructorEl.innerHTML = options.join('');
      instructorEl.addEventListener('change', function () {
        activeFilters.instructor = instructorEl.value;
        var filtered = renderFilteredCourses();
        renderCourseCards(filtered);
        updateCourseSummary(allCourses, courseFiltersMeta, filtered.length);
      });
    }
    // 類別下拉（courseName）
    var courseTypeEl = document.getElementById('courseTypeFilter');
    if (courseTypeEl) {
      var types = buildUniqueList(allCourses.map(function (c) { return c.courseName; }));
      var options2 = ['<option value="">全部類別</option>'].concat(types.map(function (t) {
        var sel = (t === activeFilters.courseType) ? ' selected' : '';
        return '<option value="' + global.FLB.Course.escapeHtml(t) + '"' + sel + '>' + global.FLB.Course.escapeHtml(t) + '</option>';
      }));
      courseTypeEl.innerHTML = options2.join('');
      courseTypeEl.addEventListener('change', function () {
        activeFilters.courseType = courseTypeEl.value;
        var filtered = renderFilteredCourses();
        renderCourseCards(filtered);
        updateCourseSummary(allCourses, courseFiltersMeta, filtered.length);
      });
    }
    // 學生搜尋
    var studentSearchEl = document.getElementById('studentSearch');
    if (studentSearchEl) {
      var handler = function () {
        activeFilters.studentQuery = studentSearchEl.value || '';
        var filtered = renderFilteredCourses();
        renderCourseCards(filtered);
        updateCourseSummary(allCourses, courseFiltersMeta, filtered.length);
      };
      studentSearchEl.addEventListener('input', handler);
      studentSearchEl.addEventListener('change', handler);
    }
    // 日期挑選器
    var datePickerEl = document.getElementById('datePicker');
    if (datePickerEl) {
      // 預設值
      if (!datePickerEl.value && courseFiltersMeta && courseFiltersMeta.date) {
        datePickerEl.value = courseFiltersMeta.date;
      }
      datePickerEl.addEventListener('change', function () {
        currentFilterDateOverride = datePickerEl.value || null;
        // 更新標題日期顯示
        try {
          var displayDate = currentFilterDateOverride ? new Date(currentFilterDateOverride) : new Date();
          var dateEl = document.getElementById('currentDate');
          if (dateEl) {
            var today = new Date();
            var isToday = (displayDate.toDateString() === today.toDateString());
            var dateStr = displayDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            dateEl.innerHTML = isToday ? dateStr : (dateStr + ' <span style="color: #ff9800; font-size: 0.9em; margin-left: 10px;">（歷史課程）</span>');
          }
        } catch (e) {}
        try { window.__suppressAutoSelectUntil = Date.now() + 2000; } catch (e) {}
        loadCompletedCourses({ suppressAutoSelect: true });
      });
    }
  }

  async function initializePage() {
    // 🧠 啟動記憶體壓力監控器（第一優先）
    try {
      if (memoryMonitor && typeof memoryMonitor.start === 'function') {
        memoryMonitor.start();
        console.log('✅ 記憶體壓力監控器已啟動');
      }
    } catch (e) {
      console.warn('⚠️ 記憶體監控器啟動失敗:', e);
    }
    
    // 🔥 初始化智能縮圖生成器
    try {
      SmartPosterGenerator.init();
    } catch (e) {
      console.warn('⚠️ SmartPosterGenerator 初始化失敗:', e);
    }
    
    setupTopTabsStickyObserver();
    setupPreviewOverlay();
    try { setupProgressIndicator(); } catch (e) {}
    try {
      var ovTitleEl = document.getElementById('overviewCourseTitle');
      if (ovTitleEl) ovTitleEl.textContent = '尚未選擇課程';
      window.__stuTransferPct = null;
      window.__ovTransferPct = null;
    } catch (e) {}
    try {
      // 🧰📱 浮動篩選抽屜（Mobile）綁定與同步 —— 僅在「課程清單」步驟顯示
      (function setupFilterDrawer(){
        try {
          var fab = document.getElementById('filterFab');
          var drawer = document.getElementById('filterDrawer');
          var closeBtn = document.getElementById('filterCloseBtn');
          if (!fab || !drawer || !closeBtn) return;

          function openDrawer(){
            try {
              // 以目前主篩選值初始化抽屜輸入
              var range = (document.getElementById('rangeFilter')||{}).value || 'today';
              var date = (document.getElementById('datePicker')||{}).value || '';
              var status = (document.getElementById('statusFilter')||{}).value || 'all';
              var instructor = (document.getElementById('instructorFilter')||{}).value || '';
              var courseType = (document.getElementById('courseTypeFilter')||{}).value || '';
              var studentQ = (document.getElementById('studentSearch')||{}).value || (activeFilters && activeFilters.studentQuery) || '';

              var mRange = document.getElementById('m_rangeFilter');
              var mDate = document.getElementById('m_datePicker');
              var mStatus = document.getElementById('m_statusFilter');
              var mInstructor = document.getElementById('m_instructorFilter');
              var mCourseType = document.getElementById('m_courseTypeFilter');
              var mStudent = document.getElementById('m_studentSearch');

              if (mRange) mRange.value = (range === 'week' ? 'week' : 'today');
              if (mDate) mDate.value = date || '';
              if (mStatus) mStatus.value = status || 'all';

              // 選項清單同步（講師／類別）
              var instructors = (function(){
                try { return Array.isArray(allCourses) ? Array.from(new Set(allCourses.map(function(c){ return (c && c.instructor) || ''; }).filter(Boolean))).sort() : []; } catch(e){ return []; }
              })();
              var types = (function(){
                try { return Array.isArray(allCourses) ? Array.from(new Set(allCourses.map(function(c){ return (c && c.courseName) || ''; }).filter(Boolean))).sort() : []; } catch(e){ return []; }
              })();
              if (mInstructor) {
                var optsI = ['<option value="">全部講師</option>'].concat(instructors.map(function(name){ return '<option value="' + (window.FLB && FLB.Course ? FLB.Course.escapeHtml(name) : name) + '">' + (window.FLB && FLB.Course ? FLB.Course.escapeHtml(name) : name) + '</option>'; }));
                mInstructor.innerHTML = optsI.join('');
                mInstructor.value = instructor || '';
              }
              if (mCourseType) {
                var optsT = ['<option value="">全部類別</option>'].concat(types.map(function(t){ return '<option value="' + (window.FLB && FLB.Course ? FLB.Course.escapeHtml(t) : t) + '">' + (window.FLB && FLB.Course ? FLB.Course.escapeHtml(t) : t) + '</option>'; }));
                mCourseType.innerHTML = optsT.join('');
                mCourseType.value = courseType || '';
              }
              if (mStudent) mStudent.value = studentQ || '';

              // 🗓️ 初始化星期按鈕狀態（依照 activeWeekdays）
              try {
                var mBar = document.getElementById('m_weekdayFilterBar');
                if (mBar) {
                  Array.prototype.forEach.call(mBar.querySelectorAll('.wd-btn'), function(btn){
                    var v = parseInt(btn.getAttribute('data-wd')||'0',10)||0;
                    if (v && activeWeekdays && activeWeekdays.has(v)) btn.classList.add('active'); else btn.classList.remove('active');
                  });
                }
              } catch (e) {}

              drawer.style.transform = 'translateY(0)';
            } catch (e) {}
          }
          function closeDrawer(){ try { drawer.style.transform = 'translateY(110%)'; } catch (e) {} }

          // 套用抽屜變更 → 影響主清單並刷新
          function applyMobileFilters(){
            try {
              var mRange = document.getElementById('m_rangeFilter');
              var mDate = document.getElementById('m_datePicker');
              var mStatus = document.getElementById('m_statusFilter');
              var mInstructor = document.getElementById('m_instructorFilter');
              var mCourseType = document.getElementById('m_courseTypeFilter');
              var mStudent = document.getElementById('m_studentSearch');

              // 1) 範圍/日期 會影響 API 取得課程，呼叫 loadCompletedCourses()
              var rangeEl = document.getElementById('rangeFilter'); if (rangeEl && mRange) rangeEl.value = mRange.value === 'week' ? 'week' : 'today';
              var dateEl = document.getElementById('datePicker'); if (dateEl && mDate) dateEl.value = mDate.value || '';
              currentFilterDateOverride = (mDate && mDate.value) ? mDate.value : null;

              // 2) 狀態/講師/類別/學生 搜尋則本地刷新
              var statusEl = document.getElementById('statusFilter'); if (statusEl && mStatus) statusEl.value = mStatus.value || 'all';
              activeFilters.instructor = (mInstructor && mInstructor.value) || '';
              activeFilters.courseType = (mCourseType && mCourseType.value) || '';
              activeFilters.studentQuery = (mStudent && mStudent.value) || '';

              // 🗓️ 讀取抽屜的星期選擇並同步至 activeWeekdays
              try {
                var mBar = document.getElementById('m_weekdayFilterBar');
                if (mBar) {
                  var sel = new Set();
                  Array.prototype.forEach.call(mBar.querySelectorAll('.wd-btn.active'), function(btn){
                    var v = parseInt(btn.getAttribute('data-wd')||'0',10)||0; if (v) sel.add(v);
                  });
                  activeWeekdays = sel; // 覆蓋當前星期集合
                  // 同步到主視圖的星期列 UI
                  try {
                    var bar = document.getElementById('weekdayFilterBar');
                    if (bar) {
                      Array.prototype.forEach.call(bar.querySelectorAll('.wd-btn'), function(btn){
                        var v = parseInt(btn.getAttribute('data-wd')||'0',10)||0;
                        if (v && activeWeekdays.has(v)) btn.classList.add('active'); else btn.classList.remove('active');
                      });
                    }
                  } catch (e) {}
                }
              } catch (e) {}

              // 重新整理列表
              var filtered = renderFilteredCourses();
              renderCourseCards(filtered);
              updateCourseSummary(allCourses, courseFiltersMeta, filtered.length);

              // 若僅範圍/日期改變，重新抓取課程（放最後避免兩次重排）
              if (mRange || mDate) {
                // 避免連續操作造成多次請求，稍微延遲合併
                clearTimeout(window.__lrReloadTimer);
                window.__lrReloadTimer = setTimeout(function(){
                  try { window.__suppressAutoSelectUntil = Date.now() + 2000; } catch (e) {}
                  try { loadCompletedCourses({ suppressAutoSelect: true }); } catch (e) {}
                }, 120);
              }
            } catch (e) {}
          }

          fab.addEventListener('click', function(ev){
            try { if (ev) { ev.preventDefault(); ev.stopPropagation(); } } catch (_) {}
            try { if (window.FLB && FLB.Router) { var r=FLB.Router.getRoute(); if (!r || (r.step!=='select')) FLB.Router.navigate({ step: 'select' }); } } catch (e) {}
            // 抑制自動選課短時間發生
            try { window.__suppressAutoSelectUntil = Date.now() + 2000; } catch (e) {}
            openDrawer();
          });
          closeBtn.addEventListener('click', function(){ closeDrawer(); });

          // 抽屜內變更即時生效（手機體驗：立刻看到結果）
          ;['m_rangeFilter','m_datePicker','m_statusFilter','m_instructorFilter','m_courseTypeFilter','m_studentSearch']
            .forEach(function(id){ var el=document.getElementById(id); if(!el) return; el.addEventListener('change', function(){ try { window.__suppressAutoSelectUntil = Date.now() + 2000; } catch (e) {} applyMobileFilters(); }); el.addEventListener('input', function(){ try { window.__suppressAutoSelectUntil = Date.now() + 2000; } catch (e) {} applyMobileFilters(); }); });

          // 🗓️ 抽屜星期列：點擊切換 active 並套用
          try {
            var mBar = document.getElementById('m_weekdayFilterBar');
            if (mBar) {
              mBar.addEventListener('click', function(e){
                var b = e.target.closest('.wd-btn'); if (!b) return;
                b.classList.toggle('active'); try { window.__suppressAutoSelectUntil = Date.now() + 2000; } catch (e) {}
                applyMobileFilters();
              });
            }
          } catch (e) {}

          // 與 Router 整合：僅在 step === 'select' 顯示 FAB
          try {
            if (window.FLB && FLB.Router) {
              var applyFabVisible = function(route){
                try {
                  var step = (route && route.step) || (FLB.Router.getRoute && FLB.Router.getRoute().step) || 'select';
                  fab.style.display = (step === 'select' ? 'flex' : 'none');
                } catch(e) {}
              };
              // 對外提供保險函式：當 Router 尚未就緒時依據視圖 DOM 顯示
              window.__lrToggleFilterFab = function(){
                try {
                  if (window.FLB && FLB.Router && typeof FLB.Router.getRoute === 'function') {
                    applyFabVisible(FLB.Router.getRoute());
                    return;
                  }
                  var vs = document.getElementById('view-select');
                  var visible = false;
                  try { visible = !!(vs && vs.style.display !== 'none'); } catch (_) { visible = !!vs; }
                  fab.style.display = visible ? 'flex' : 'none';
                } catch (e) {}
              };
              FLB.Router.onChange(applyFabVisible);
              applyFabVisible(FLB.Router.getRoute());
            } else {
              // Router 不可用：以視圖可見性推斷
              window.__lrToggleFilterFab = function(){
                try {
                  var vs = document.getElementById('view-select');
                  var visible = false;
                  try { visible = !!(vs && vs.style.display !== 'none'); } catch (_) { visible = !!vs; }
                  fab.style.display = visible ? 'flex' : 'none';
                } catch (e) {}
              };
              window.__lrToggleFilterFab();
            }
          } catch (e) {}
        } catch (e) {}
      })();

      var fab = document.getElementById('uploadCenterFab');
      if (fab) {
        fab.addEventListener('click', function(){ try { UploadCenter.open(); } catch (e) {} });
      }
      var back = document.getElementById('backFab');
      if (back) {
        back.addEventListener('click', function(){ try { window.location.href = 'https://calendar.funlearnbar.synology.me/perfect-calendar-modular.html'; } catch (e) {} });
      }
      var picker = document.getElementById('coursePickerFab');
      if (picker) {
        picker.addEventListener('click', function(){
          try {
            // 記住當前選擇的課程，切到選擇清單後自動捲到該卡片
            if (window.FLB && FLB.State) {
              var st = FLB.State.get();
              var selCourse = st && st.selectedCourse;
              if (selCourse && (selCourse.id || selCourse.title)) {
                window.__pendingScrollToCourseId = selCourse.id || (window.FLB && FLB.Id && FLB.Id.normalizeCourseId ? FLB.Id.normalizeCourseId(selCourse) : selCourse.title);
              }
            }
            if (window.FLB && FLB.Router) FLB.Router.navigate({ step: 'select' });
            // 補一次保險：若列表已存在，立刻嘗試捲動
            setTimeout(function(){
              try {
                var pid = window.__pendingScrollToCourseId;
                var courseList = document.getElementById('courseList');
                if (pid && courseList) {
                  var targetEl = courseList.querySelector('.course-item[data-course-id="' + pid + '"]');
                  if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              } catch (e) {}
            }, 160);
          } catch (e) {}
        });
      }
      
      // 🔥 初始化歷史記錄 FAB
      try {
        initHistoryFab();
      } catch (e) {
        console.warn('⚠️ 初始化歷史記錄 FAB 失敗:', e);
      }

      // 🗓️ 綁定星期快速篩選列
      try {
        (function bindWeekdayFilterBar(){
          var host = document.getElementById('weekdayFilterBar');
          if (!host) return;
          host.addEventListener('click', function(e){
            var btn = e.target.closest('.wd-btn');
            if (!btn) return;
            var val = parseInt(btn.getAttribute('data-wd')||'0',10)||0; // 1~7
            if (!val) return;
            // 切換選取狀態（多選）
            if (btn.classList.contains('active')) { btn.classList.remove('active'); activeWeekdays.delete(val); }
            else { btn.classList.add('active'); activeWeekdays.add(val); }
            // 重新渲染列表
            var filtered = renderFilteredCourses();
            renderCourseCards(filtered);
            updateCourseSummary(allCourses, courseFiltersMeta, filtered.length);
          });
          // 預設：若無深連結，啟用今天所在星期，否則不預選
          try {
            var target = (window.FLB && FLB.UrlParams && FLB.UrlParams.getTargetInfo && FLB.UrlParams.getTargetInfo()) || {};
            if (!target || (!target.eventId && !target.date)) {
              var now = new Date(); var jsDay = now.getDay(); var wd = (jsDay===0)?7:jsDay; // 1~7
              var btnToday = host.querySelector('.wd-btn[data-wd="' + wd + '"]');
              if (btnToday) { btnToday.classList.add('active'); activeWeekdays.add(wd); }
            }
          } catch (e) {}
        })();
      } catch (e) {}

      // 🔄 進度條即時同步：監聽重要 State 變化
      try {
        if (window.FLB && FLB.State && typeof FLB.State.on === 'function') {
          var __rpTimer = null;
          var debounced = function(){ clearTimeout(__rpTimer); __rpTimer = setTimeout(function(){ try { refreshProgress(); } catch (e) {} }, 60); };
          FLB.State.on(['students','uploadedRecordsCache','drafts','progress'], function(){ debounced(); });
        }
      } catch (e) {}
      window.closeUploadCenter = function(){ try { UploadCenter.close(); var b=document.getElementById('uploadCenterBackdrop'); if(b) b.style.display='none'; } catch (e) {} };
      window.openUploadCenter = function(){ try { UploadCenter.open(); var b=document.getElementById('uploadCenterBackdrop'); if(b) b.style.display='block'; } catch (e) {} };
      window.toggleUploadCenterView = function(){
        try {
          var next = (UploadCenter.viewMode || 'card') === 'card' ? 'list' : 'card';
          UploadCenter.setViewMode(next);
        } catch (e) {}
      };
      window.toggleUploadCenterSize = function(){
        try {
          var next = (UploadCenter.drawerMode || 'standard') === 'compact' ? 'standard' : 'compact';
          UploadCenter.setDrawerMode(next);
        } catch (e) {}
      };
      // 初次渲染（若任務在 DOM 準備前已建立）
      try { UploadCenter.render(); } catch (e) {}
    } catch (e) {}
    await loadCurrentUser();
    // 讀取學生篩選配置（含最小剩餘堂數）
    try {
      if (global.FLB && FLB.Api && typeof FLB.Api.getStudentFilterConfig === 'function') {
        var cfgResp = await FLB.Api.getStudentFilterConfig();
        var data = (cfgResp && cfgResp.data) || cfgResp || {};
        if (global.FLB && FLB.State) {
          var ex = FLB.State.get && FLB.State.get();
          if (FLB.State.set) FLB.State.set({ studentFilterConfig: Object.assign({}, ex && ex.studentFilterConfig || {}, data) });
        } else {
          global.__STUDENT_FILTER_CONFIG = data;
        }
      }
    } catch (e) { console.warn('讀取系統設定失敗（使用預設）', e); }
    var target = (global.FLB.UrlParams && global.FLB.UrlParams.getTargetInfo && global.FLB.UrlParams.getTargetInfo()) || {};
    urlInstructor = target.instructor || null;
    var today = new Date();
    var displayDate = target.date ? new Date(target.date) : new Date();
    var dateStr = displayDate.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
    var dateElement = document.getElementById('currentDate');
    var isToday = (displayDate.toDateString() === today.toDateString());
    if (dateElement) {
      if (!isToday) {
        dateElement.innerHTML = dateStr + ' <span style="color: #ff9800; font-size: 0.9em; margin-left: 10px;">（歷史課程）</span>';
      } else { dateElement.textContent = dateStr; }
    }
    if (target.instructor) currentTeacher = { name: target.instructor };
    if (target.date) currentFilterDateOverride = target.date;
    bindFilters();
    setupDragAndDrop();
    setupRecordsDrawer();
    updateRecordsFabBadge();
    // 鍵盤快捷鍵（桌面）
    try {
      document.addEventListener('keydown', function (e) {
        try {
          if (!(window.FLB && FLB.Router && FLB.State)) return;
          var route = (FLB.Router.getRoute && FLB.Router.getRoute()) || {};
          var step = route.step || 'select';
          if (step !== 'student') return;
          if (e.key === 'ArrowLeft') { e.preventDefault(); goStudent(-1); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); goStudent(+1); }
          else if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter')) {
            var st = FLB.State.get();
            uploadStudentRecord(st.currentStudentIndex || 0);
          }
        } catch (err) {}
      });
      // 視窗尺寸變化時刷新桌面清單
      var resizeTimer = null;
      window.addEventListener('resize', function(){ clearTimeout(resizeTimer); resizeTimer = setTimeout(function(){ try { renderDesktopStudentList(); } catch (e) {} }, 150); });
    } catch (e) {}
    // 模式切換按鈕（使用 Router 控制）
    try {
      var btnS = document.getElementById('btnStudentMode');
      var btnO = document.getElementById('btnOverviewMode');
      var btnS2 = document.getElementById('btnStudentMode2');
      var btnO2 = document.getElementById('btnOverviewMode2');
      function goStudentModeOrScroll() {
        try {
          if (!(window.FLB && FLB.Router)) return;
          var route = FLB.Router.getRoute();
          if ((route.step || 'select') === 'student') {
            // 同頁點擊：僅捲動到學生區
            var s = document.getElementById('studentsSection');
            if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            FLB.Router.navigate({ step: 'student' });
          }
        } catch (e) {}
      }
      function goOverviewModeOrScroll() {
        try {
          if (!(window.FLB && FLB.Router)) return;
          var route = FLB.Router.getRoute();
          if ((route.step || 'select') === 'overview') {
            var ov = document.getElementById('view-overview');
            if (ov) ov.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            FLB.Router.navigate({ step: 'overview' });
          }
        } catch (e) {}
      }
      if (btnS) btnS.addEventListener('click', goStudentModeOrScroll);
      if (btnO) btnO.addEventListener('click', goOverviewModeOrScroll);
      if (btnS2) btnS2.addEventListener('click', goStudentModeOrScroll);
      if (btnO2) btnO2.addEventListener('click', goOverviewModeOrScroll);
    } catch (e) {}
    // 預設僅顯示已結束課程
    var statusFilterEl = document.getElementById('statusFilter');
    if (statusFilterEl) statusFilterEl.value = 'completed';
    var overviewSummary = document.getElementById('overviewSummary');
    if (overviewSummary) {
      overviewSummary.addEventListener('input', function (e) {
        var countEl = document.getElementById('overviewSummaryCount');
        if (countEl) countEl.textContent = String((e.target.value || '').length);
      });
    }
    loadCompletedCourses();

    // ✅ 移除強制顯示監控，讓切換邏輯正常工作

    // 綁定 Router 視圖切換
    try {
      if (window.FLB && FLB.Router) {
        var applyRoute = function (route) {
          var step = (route && route.step) || FLB.Router.getRoute().step || 'select';
          var vs = {
            select: document.getElementById('view-select'),
            student: document.getElementById('studentsSection'),
            overview: document.getElementById('view-overview')
          };
          if (step === 'select') {
            try { var titleEl = document.getElementById('overviewCourseTitle'); if (titleEl) titleEl.textContent = '尚未選擇課程'; } catch (e) {}
          }
          if (vs.select) vs.select.style.display = (step === 'select' ? '' : 'none');
          
          // ✅ 修正切換邏輯：根據 step 正確顯示/隱藏對應區塊
          // 概念：overview 在 studentsSection 內，因此切換時只切內部卡片顯示
          if (vs.student) {
            // studentsSection 始終顯示（因為課程總覽在裡面）
            vs.student.style.display = '';
            
            // 獲取學生卡片和課程總覽
            var studentCard = document.getElementById('studentsGrid') && document.getElementById('studentsGrid').closest('.glass-card');
            
            if (step === 'student') {
              // 學生模式：顯示學生卡片，隱藏課程總覽
              try { preserveOverviewPreviewNodes(); } catch (e) {}
              if (studentCard) studentCard.style.display = '';
              // 🔥 [修復 2025-11-16] 切回學生模式時還原所有學生的上傳中節點
              try { reattachAllShadowBuffers(); } catch (e) {}
              if (vs.overview) {
                vs.overview.style.display = 'none';
                vs.overview.style.visibility = 'hidden';
                vs.overview.style.opacity = '0';
              }
            } else if (step === 'overview') {
              try { preserveActiveUploadNodes(); } catch (e) {}
              // 課程總覽模式：隱藏學生卡片，顯示課程總覽
              if (studentCard) studentCard.style.display = 'none';
              if (vs.overview) {
                vs.overview.style.display = 'block';
                vs.overview.style.visibility = 'visible';
                vs.overview.style.opacity = '1';
                try { reattachOverviewPreviewNodes(); } catch (e) {}
                try { restorePendingUploads(); } catch (e) {}
                // ✅ 只在首次載入或強制刷新時才重新載入資料
                // 避免每次切換都重新載入，導致卡頓
                const shouldForceReload = !vs.overview.dataset.loaded || (route && route.force);
                if (shouldForceReload) {
                  try { 
                    loadUploadedRecordsForCurrentCourse({ force: route && route.force || false }); 
                    vs.overview.dataset.loaded = 'true';
                  } catch (e) {}
                } else {
                  // 如果已經載入過，只觸發渲染（使用快取）
                  try {
                    if (currentCourse && typeof window.LearningOverviewRenderer !== 'undefined') {
                      window.LearningOverviewRenderer.render(currentCourse, { skipExisting: true, force: false });
                    }
                  } catch (e) {}
                }
              }
            } else {
              // 其他模式（select）：都隱藏
              if (studentCard) studentCard.style.display = 'none';
              if (vs.overview) {
                vs.overview.style.display = 'none';
                vs.overview.style.visibility = 'hidden';
                vs.overview.style.opacity = '0';
              }
            }
          }
          var tabs = document.getElementById('topTabs') || document.getElementById('bottomTabs');
          if (tabs) {
            tabs.style.display = (step === 'student' || step === 'overview') ? 'flex' : 'none';
            if (step !== 'student') tabs.classList.remove('is-sticky');
          }

          // 若是 student 視圖且帶 studentIndex，切換到對應學生
          if (step === 'student') {
            var idx = parseInt((route && route.studentIndex) || '0', 10) || 0;
            if (window.FLB && FLB.State) {
              var st = FLB.State.get();
              if (Array.isArray(st.students) && st.students.length) {
                idx = Math.max(0, Math.min(st.students.length - 1, idx));
                if (st.currentStudentIndex !== idx) FLB.State.set({ currentStudentIndex: idx });
                renderStudentPager(st.selectedCourse, idx);
                renderBottomTabs();
                try { restorePendingUploads(); } catch (e) {}
              }
            }
          }
          // 🧭 模式切換按鈕：有學生→兩顆都顯示（在課程總覽也看得到「課程總覽」按鈕）；沒學生→整個切換條隱藏。
          try {
            var bars = [document.getElementById('modeSwitchBar'), document.getElementById('modeSwitchBarOv')];
            var btnS = document.getElementById('btnStudentMode');
            var btnO = document.getElementById('btnOverviewMode');
            var btnS2 = document.getElementById('btnStudentMode2');
            var btnO2 = document.getElementById('btnOverviewMode2');
            var st4 = (window.FLB && FLB.State) ? FLB.State.get() : { students: [] };
            var hasStudents = Array.isArray(st4.students) && st4.students.length > 0;
            bars.forEach(function(bar){ if (bar) bar.style.display = hasStudents ? '' : 'none'; });
            [btnS, btnO, btnS2, btnO2].forEach(function(b){ if (b) b.style.display = hasStudents ? '' : 'none'; });
            // active 樣式
            [btnS, btnS2].forEach(function(b){ if (!b) return; if (step === 'student') b.classList.add('active'); else b.classList.remove('active'); });
            [btnO, btnO2].forEach(function(b){ if (!b) return; if (step === 'overview') b.classList.add('active'); else b.classList.remove('active'); });
          } catch (e) {}
          syncUrlWithRoute({ step: step, studentIndex: (route && route.studentIndex) || 0 });
        };
        function syncUrlWithRoute(route){
          try {
            var info = window.__deepLinkInfo || initialDeepLinkParams || {};
            var step = (route && route.step) || 'select';
            var params = new URLSearchParams();
            if (info && info.eventId) params.set('eventId', info.eventId);
            if (info && info.date) params.set('date', info.date);
            if (info && info.time) params.set('time', info.time);
            if (info && info.instructor) params.set('instructor', info.instructor);
            if (step && step !== 'select') {
              params.set('step', step);
              if (step === 'student') {
                var idx = parseInt((route && route.studentIndex) || '0', 10) || 0;
                params.set('studentIndex', String(idx));
              }
            }
            var base = window.location.pathname;
            var query = params.toString();
            var nextUrl = query ? (base + '?' + query) : base;
            window.history.replaceState({}, document.title, nextUrl);
          } catch (e) {}
        }
        FLB.Router.onChange(applyRoute);
        applyRoute(FLB.Router.getRoute());
        try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}
      }
    } catch (err) { console.warn('Router 綁定失敗', err); }
    
    // 🔥 綁定課程總覽上傳按鈕（2025-11-08 修復）
    try {
      var overviewSyncBtn = document.getElementById('overviewSyncStatus');
      if (overviewSyncBtn) {
        overviewSyncBtn.style.cursor = 'pointer';
        overviewSyncBtn.onclick = function() {
          console.log('🚀 [手動上傳] 課程總覽上傳被觸發');
          uploadOverview({ silent: false });
        };
        console.log('✅ [初始化] 課程總覽上傳按鈕已綁定');
      }
    } catch (err) {
      console.warn('⚠️ 課程總覽上傳按鈕綁定失敗:', err);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initializePage();
    
    // 🔥 確保課程總覽容器使用 Grid 佈局
    try {
      ensureOverviewGridStyle();
      console.log('✅ [DOMContentLoaded] 已初始化課程總覽 Grid 佈局');
    } catch (e) {
      console.error('❌ [DOMContentLoaded] Grid 佈局初始化失敗:', e);
    }
    
    if (posterErrorQueue && posterErrorQueue.length) {
      try {
        posterErrorQueue.forEach(function (item) {
          pushPosterErrorMessage(item.context, item.detail);
        });
      } finally {
        posterErrorQueue = [];
      }
    }
  });

  // 對外暴露（供 HTML inline handler 使用）
  global.openHistory = openHistory;
  global.closeHistory = closeHistory;
  global.loadHistory = loadHistory;
  global.refreshCourses = refreshCourses;
  global.uploadOverview = uploadOverview;
  // 🔥 暴露 Grid 佈局修復函數（供其他模組使用）
  global.ensureOverviewGridStyle = ensureOverviewGridStyle;
  // 🧾 頁面初始化後預填「課程紀錄內容」欄位與預覽
  try {
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(function(){
        try {
          if (!currentCourse) return;
          var startDate = new Date(currentCourse.start);
          var parsed = global.FLB.Course.parseTitle(currentCourse.title || '');
          var courseType = ((currentCourse.location || '').indexOf('線上') !== -1) ? '線上' : '教室';
          var dateStrPretty = startDate.toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit' });
          var st = (window.FLB && FLB.State) ? FLB.State.get() : { students: [] };
          var names = (st.students || []).map(function(s){ return s && s.name || ''; }).filter(Boolean);
          var count = names.length;
          var teacher = (window.currentTeacher && window.currentTeacher.name) || (currentTeacher && currentTeacher.name) || '';
          var topic = parsed && (parsed.courseName || parsed.course) || (currentCourse.courseName || '');
          // 預填各欄位
          var f_type = document.getElementById('ov_type'); if (f_type && !f_type.value) f_type.value = courseType;
          var f_date = document.getElementById('ov_date'); if (f_date && !f_date.value) f_date.value = dateStrPretty.replaceAll('/', '-');
          var f_names = document.getElementById('ov_names'); if (f_names && !f_names.value) f_names.value = (names.join(' ') || '');
          var f_count = document.getElementById('ov_count'); if (f_count && !f_count.value) f_count.value = String(count || 0);
          var f_teacher = document.getElementById('ov_teacher'); if (f_teacher && !f_teacher.value) f_teacher.value = teacher;
          var f_topic = document.getElementById('ov_topic'); if (f_topic && !f_topic.value) f_topic.value = topic;

          var preview = buildOverviewBlockFromFields();
          var pv = document.getElementById('overviewMetaPreview');
          if (pv) pv.value = preview;

          // 欄位變更時：即時更新預覽＋儲存草稿
          ;(function(){
            var ids = ['ov_type','ov_date','ov_names','ov_count','ov_teacher','ov_topic','ov_perf','ov_issue','ov_solution'];
            ids.forEach(function(id){
              var el = document.getElementById(id);
              if (!el) return;
              el.addEventListener('input', function(){
                try { el.dataset.userEdited = '1'; } catch (e) {}
                try { delete el.dataset.fromSummary; } catch (e) {}
                var pv = document.getElementById('overviewMetaPreview');
                if (pv) pv.value = buildOverviewBlockFromFields();
                try { saveOverviewDraft(); } catch (e) {}
                // 僅更新預覽與草稿，不立即上傳
                try { if (typeof refreshProgress === 'function') refreshProgress(); } catch (e) {}
              });
              // 離開焦點後延後上傳
              el.addEventListener('blur', function(){
                // 🔥 視覺反饋：邊框閃爍綠色（檢查是否有變更）
                try {
                  var snapNow = computeOverviewSnapshot();
                  if (snapNow !== lastOverviewSnapshot) {
                    el.classList.add('comment-saved-flash');
                    setTimeout(function() {
                      el.classList.remove('comment-saved-flash');
                    }, 2000);
                  }
                } catch (e) {}
                
                // 🔥 優先使用獨立文字上傳（不等待媒體處理）
                try {
                  if (typeof scheduleTextOnlyUpload === 'function') {
                    console.log('📝 [Blur事件] 觸發獨立文字上傳...');
                    scheduleTextOnlyUpload(800); // 800ms 延遲
                  } else {
                    // 回退：使用完整上傳
                    scheduleOverviewAutoSave();
                  }
                } catch (e) {
                  scheduleOverviewAutoSave();
                }
              });
              // ⌨️ Enter 自動跳到下一個欄位（Shift+Enter 保留換行於 textarea）
              el.addEventListener('keydown', function(ev){
                try {
                  if (ev.key !== 'Enter') return;
                  var isTextarea = (el.tagName === 'TEXTAREA');
                  if (isTextarea && (ev.shiftKey || ev.ctrlKey || ev.metaKey || ev.altKey)) {
                    // Shift+Enter 或 Ctrl+Enter：允許換行，也觸發閃爍效果
                    setTimeout(function() {
                      try {
                        var snapNow = computeOverviewSnapshot();
                        if (snapNow !== lastOverviewSnapshot) {
                          el.classList.add('comment-saved-flash');
                          setTimeout(function() {
                            el.classList.remove('comment-saved-flash');
                          }, 2000);
                        }
                      } catch (e) {}
                    }, 0);
                    return; // 允許換行
                  }
                  // 一般 Enter：跳到下一個欄位，先觸發閃爍效果
                  setTimeout(function() {
                    try {
                      var snapNow = computeOverviewSnapshot();
                      if (snapNow !== lastOverviewSnapshot) {
                        el.classList.add('comment-saved-flash');
                        setTimeout(function() {
                          el.classList.remove('comment-saved-flash');
                        }, 2000);
                      }
                    } catch (e) {}
                    
                    // 🔥 Enter 也觸發獨立文字上傳
                    try {
                      if (typeof scheduleTextOnlyUpload === 'function') {
                        console.log('📝 [Enter鍵] 觸發獨立文字上傳...');
                        scheduleTextOnlyUpload(800);
                      }
                    } catch (e) {}
                  }, 0);
                  ev.preventDefault();
                  var order = ['ov_type','ov_date','ov_names','ov_count','ov_teacher','ov_topic','ov_perf','ov_issue','ov_solution'];
                  var i = order.indexOf(id);
                  var nextId = (i >= 0 && i < order.length-1) ? order[i+1] : null;
                  if (nextId) {
                    var nx = document.getElementById(nextId); if (nx) { try { nx.focus(); nx.select && nx.select(); } catch (e) {} }
                  } else {
                    el.blur();
                  }
                } catch (e) {}
              });
            });
          })();
          // 載入先前草稿（若有）
          try { loadOverviewDraft(); var pv=document.getElementById('overviewMetaPreview'); if (pv) pv.value = buildOverviewBlockFromFields(); } catch (e) {}
        } catch (e) {}
      }, 500);
    });
  } catch (e) {}

  function buildOverviewBlockFromFields() {
    try {
      var t = (document.getElementById('ov_type') || {}).value || '';
      var d = (document.getElementById('ov_date') || {}).value || '';
      var names = (document.getElementById('ov_names') || {}).value || '';
      var c = (document.getElementById('ov_count') || {}).value || '0';
      var te = (document.getElementById('ov_teacher') || {}).value || '';
      var tp = (document.getElementById('ov_topic') || {}).value || '';
      var perf = (document.getElementById('ov_perf') || {}).value || '';
      var issue = (document.getElementById('ov_issue') || {}).value || '';
      var solution = (document.getElementById('ov_solution') || {}).value || '';
      var parts = [
        '課程紀錄內容',
        '課程種類：' + t,
        '日期：' + (d || ''),
        '學生姓名：' + names,
        '上課人數：' + c + '人',
        '講師姓名：' + te,
        '課程主題：' + tp,
        '',
        '課堂狀況紀錄',
        '學生的狀況與表現：' + (perf || '—'),
        '遇到的問題：' + (issue || '—'),
        '解決的方法：' + (solution || '—')
      ];
      return parts.join('\n');
    } catch (e) { return ''; }
  }

  // ============= 課程總覽：本地草稿（隨時儲存） =============
  function getOverviewDraftKey() {
    try {
      var d = (document.getElementById('ov_date') || {}).value || '';
      var courseId = (currentCourse && (currentCourse.id || currentCourse.title)) || 'COURSE';
      return 'lr_ov_draft_' + String(courseId) + '_' + String(d);
    } catch (e) { return 'lr_ov_draft'; }
  }
  function saveOverviewDraft() {
    try {
      var key = getOverviewDraftKey();
      var data = {
        type: (document.getElementById('ov_type') || {}).value || '',
        date: (document.getElementById('ov_date') || {}).value || '',
        names: (document.getElementById('ov_names') || {}).value || '',
        count: (document.getElementById('ov_count') || {}).value || '',
        teacher: (document.getElementById('ov_teacher') || {}).value || '',
        topic: (document.getElementById('ov_topic') || {}).value || '',
        perf: (document.getElementById('ov_perf') || {}).value || '',
        issue: (document.getElementById('ov_issue') || {}).value || '',
        solution: (document.getElementById('ov_solution') || {}).value || ''
      };
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  }
  function loadOverviewDraft() {
    try {
      var key = getOverviewDraftKey();
      var raw = localStorage.getItem(key);
      if (!raw) return;
      var data = JSON.parse(raw);
      if (!data) return;
      var map = {
        ov_type: data.type, ov_date: data.date, ov_names: data.names, ov_count: data.count,
        ov_teacher: data.teacher, ov_topic: data.topic, ov_perf: data.perf, ov_issue: data.issue, ov_solution: data.solution
      };
      Object.keys(map).forEach(function(id){ var el = document.getElementById(id); if (el && !el.value) el.value = map[id] || ''; });
      try {
        lastTextSnapshot = computeOverviewTextSnapshot();
        lastOverviewSnapshot = computeOverviewSnapshot();
      } catch (e) {}
    } catch (e) {}
  }
  function clearOverviewDraft() {
    try { localStorage.removeItem(getOverviewDraftKey()); } catch (e) {}
  }
  global.uploadStudentRecord = uploadStudentRecord;
  global.removeFile = removeFile;
  global.ensureDeleteButtonWorks = ensureDeleteButtonWorks;
  global.removeOverviewPhoto = removeOverviewPhoto;
  global.removeOverviewVideo = removeOverviewVideo;
  global.goBack = goBack;
  global.goToToday = goToToday;
  global.buildDriveProxyPath = buildDriveProxyPath;
  global.buildDirectFileUrl = buildDirectFileUrl;
  global.deleteStudentRecord = deleteStudentRecord;
  global.startEditStudentRecord = startEditStudentRecord;
  global.saveEditStudentRecord = saveEditStudentRecord;
  global.deleteStudentFile = deleteStudentFile;
  global.deleteOverviewFile = deleteOverviewFile;

  // === UploadCenter 渲染 hook：更新「上傳課程總覽」按鈕為整體進度條 ===
  window.__onUploadCenterRender = function(tasks){
    try {
      var btn = document.getElementById('uploadOverviewBtn');
      var syncFill = document.getElementById('overviewSyncFill');
      var syncText = document.getElementById('overviewSyncText');
      var list = (tasks || []).filter(function(t){ return t && (t.type === 'overview' || (t.type === 'comment' && t.studentIndex === OVERVIEW_UPLOAD_INDEX)); });
      var uploading = list.filter(function(t){ return t.status === 'uploading'; });
      var avg = 0;
      if (uploading.length) {
        var sum = uploading.reduce(function(s,t){ return s + (Number(t.percent)||0); }, 0);
        avg = Math.max(0, Math.min(100, Math.round(sum / uploading.length)));
      }
      // 懸浮小條
      var fb = document.getElementById('overviewFloatBar');
      var fbFill = document.getElementById('overviewFloatFill');
      var fbDot = document.getElementById('overviewFloatDot');
      if (fb) {
        // 首次依 sessionStorage 還原收合狀態
        if (fb.__init !== true) {
          fb.__init = true;
          try {
            var collapsed = sessionStorage.getItem('ovFloatCollapsed') === '1';
            if (collapsed) fb.classList.add('collapsed');
          } catch (e) {}
          fb.addEventListener('click', function(){
            try {
              var c = fb.classList.toggle('collapsed');
              sessionStorage.setItem('ovFloatCollapsed', c ? '1' : '0');
              // 即時套用視覺
              if (c) {
                if (fbFill) fbFill.style.width = '0%';
                if (fbDot) fbDot.style.display = 'block';
                var p = isNaN(avg) ? 0 : avg; fbDot.style.background = 'conic-gradient(#60a5fa ' + p + '%, #e5e7eb ' + p + '%)';
              } else {
                if (fbDot) fbDot.style.display = 'none';
              }
            } catch (e) {}
          });
        }
      }
      if (fb && fbFill) {
        if (uploading.length) {
          fb.style.display = 'block';
          if (!fb.classList.contains('collapsed')) fbFill.style.width = avg + '%';
          if (fbDot && fb.classList.contains('collapsed')) { var p2 = isNaN(avg) ? 0 : avg; fbDot.style.background = 'conic-gradient(#60a5fa ' + p2 + '%, #e5e7eb ' + p2 + '%)'; }
        } else {
          fb.style.display = 'none';
          fbFill.style.width = '0%';
        }
      }
      // 若有舊按鈕，仍維持其進度條；同時同步更新新的狀態條
      if (btn) {
        var bar = btn.querySelector('.btn-progress');
        if (!bar) {
          bar = document.createElement('div');
          bar.className = 'btn-progress';
          bar.style.position = 'absolute';
          bar.style.left = '6px';
          bar.style.right = '6px';
          bar.style.bottom = '6px';
          bar.style.height = '6px';
          bar.style.borderRadius = '999px';
          bar.style.background = 'rgba(255,255,255,.45)';
          var fill = document.createElement('div');
          fill.className = 'fill';
          fill.style.height = '100%';
          fill.style.width = '0%';
          fill.style.borderRadius = '999px';
          fill.style.background = '#60a5fa';
          fill.style.transition = 'width .35s ease';
          bar.appendChild(fill);
          btn.style.position = 'relative';
          btn.appendChild(bar);
        }
        var fillEl = bar.querySelector('.fill');
        if (uploading.length) {
          bar.style.opacity = '1';
          if (fillEl) fillEl.style.width = avg + '%';
        } else {
          if (fillEl) fillEl.style.width = '0%';
          bar.style.opacity = '0';
        }
      }
      // 新的同步條
      if (syncFill) syncFill.style.width = (uploading.length ? avg : 0) + '%';
      if (syncText) {
        if (uploading.length) syncText.textContent = '同步中 ' + (isNaN(avg) ? 0 : avg) + '%';
        else syncText.textContent = '已同步';
      }
      try { window.__ovTransferPct = uploading.length ? avg : null; } catch (e) {}
      try {
        var stuTasks = (tasks || []).filter(function(t){ return t && t.sid != null && t.sid >= 0 && t.type !== 'overview'; });
        var stuActive = stuTasks.filter(function(t){ return t.status === 'uploading'; });
        if (stuActive.length) {
          var ssum = 0; stuActive.forEach(function(t){ ssum += (Number(t.percent) || 0); });
          var savg = Math.max(0, Math.min(100, Math.round(ssum / stuActive.length)));
          try { window.__stuTransferPct = savg; } catch (e) {}
        } else {
          try { window.__stuTransferPct = null; } catch (e) {}
        }
      } catch (e) {}

      // 🔧 限制刷新頻率，避免畫面跳動
      try {
        window.__ucLastRefreshTs = window.__ucLastRefreshTs || 0;
        var now = Date.now();
        if (now - window.__ucLastRefreshTs > 250) {
          window.__ucLastRefreshTs = now;
          setTimeout(function(){ try { refreshProgress(); } catch (e) {} }, 0);
        }
      } catch (_) {}
    } catch (e) {}
  };
  // Drawer 直編
  global.toggleDrawerEdit = toggleDrawerEdit;

  // 💤 懶載入：觀察容器中的 img/video，進入可視區才設定 src
  var __lazyObserver = null;
  var __lazyQueue = [];
  var __lazyActive = 0;
  function isLowEndDevice() {
    try {
      if (typeof window !== 'undefined' && window.__LOW_END) return true;
      var bodyLow = (document && document.body && document.body.classList && document.body.classList.contains('low-end'));
      if (bodyLow) return true;
      var hc = (navigator && navigator.hardwareConcurrency) || 0;
      var dm = (navigator && navigator.deviceMemory) || 0;
      return (hc && hc <= 4) || (dm && dm <= 2);
    } catch (e) { return false; }
  }
  function getLazyLimit() { return isLowEndDevice() ? 2 : 10; }
  function lazyAcquire(run) {
    try {
      var limit = getLazyLimit();
      if (__lazyActive >= limit) { __lazyQueue.push(run); return; }
      __lazyActive++; run();
    } catch (e) { try { run(); } catch (_) {} }
  }
  function lazyRelease() {
    try { __lazyActive = Math.max(0, __lazyActive - 1); } catch (e) { __lazyActive = 0; }
    if (__lazyQueue.length) {
      var next = __lazyQueue.shift();
      try { __lazyActive++; next(); } catch (e) { __lazyActive = Math.max(0, __lazyActive - 1); }
    }
  }
  function setupLazyMedia(root) {
    try {
      var scope = root || document;
      var nodes = scope.querySelectorAll('img[data-src], video[data-src]');
      if (!nodes || nodes.length === 0) return;
      if (!('IntersectionObserver' in window)) {
        // 瀏覽器不支援 IO，直接套用 src（已附 loading="lazy"，仍具一定節省）
        Array.prototype.forEach.call(nodes, function (el) { applyLazySrc(el); });
        return;
      }
      if (!__lazyObserver) {
        var rm = isLowEndDevice() ? '200px 0px' : '2200px 0px';
        __lazyObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              var el = entry.target;
              applyLazySrc(el);
              try { __lazyObserver.unobserve(el); } catch (e) {}
            }
          });
        }, { root: null, rootMargin: rm, threshold: 0.01 });
      }
      Array.prototype.forEach.call(nodes, function (el) { try { __lazyObserver.observe(el); } catch (e) { applyLazySrc(el); } });
      // 🚀 預先載入最前面的幾個媒體，加速首屏縮圖
      try {
        var preCount = isLowEndDevice() ? 3 : 32;
        for (var i = 0; i < Math.min(preCount, nodes.length); i++) { applyLazySrc(nodes[i]); }
      } catch (e) {}
    } catch (e) { /* 忽略懶載入錯誤 */ }
  }

  function applyLazySrc(el) {
    try {
      var src = el.getAttribute('data-src');
      if (!src) return;
      var wrap = el.closest('.file-preview');
      lazyAcquire(function () {
        if (el.tagName === 'IMG') {
          // 先掛事件，再設定 src，避免快取瞬時完成錯過 load 事件
          var onLoad = function(){
            try {
              el.removeEventListener('load', onLoad);
              if (wrap) {
                wrap.classList.remove('lazy');
                wrap.classList.remove('loading');
                wrap.classList.add('loaded');
                var tl = wrap.querySelector('.thumb-loading');
                if (tl) tl.style.display = 'none';
              }
            } catch (e) {}
            lazyRelease();
          };
          var onErr = function(){ try { el.removeEventListener('error', onErr); } catch(e){} lazyRelease(); };
          try { el.addEventListener('load', onLoad); el.addEventListener('error', onErr); } catch (_) {}
          el.setAttribute('src', src);
          el.removeAttribute('data-src');
          // 若已在快取且同步完成，直接移除 lazy
          try {
            if (el.complete && el.naturalWidth > 0) {
              if (wrap) {
                wrap.classList.remove('lazy');
                wrap.classList.remove('loading');
                wrap.classList.add('loaded');
                var tlInstant = wrap.querySelector('.thumb-loading');
                if (tlInstant) tlInstant.style.display = 'none';
              }
              lazyRelease();
            }
          } catch (e) {}
          // ⏱️ 兜底：避免某些瀏覽器不觸發 load（例如跨執行緒提前完成）
          setTimeout(function(){
            try {
              if (el.complete && el.naturalWidth > 0 && wrap) {
                wrap.classList.remove('lazy');
                wrap.classList.remove('loading');
                wrap.classList.add('loaded');
                var tl2 = wrap.querySelector('.thumb-loading');
                if (tl2) tl2.style.display = 'none';
              }
            } catch (e) {}
          }, 700);
        } else if (el.tagName === 'VIDEO') {
          try { el.setAttribute('crossorigin', 'anonymous'); } catch (e) {}
          el.setAttribute('src', src);
          el.setAttribute('preload', 'metadata');
          if (typeof el.load === 'function') el.load();
          el.removeAttribute('data-src');
          var removeLazy = function () {
            try {
              if (wrap && (!el.getAttribute('poster') && !(el.readyState >= 2))) return;
              if (wrap) {
                wrap.classList.remove('lazy');
                wrap.classList.remove('loading');
                wrap.classList.add('loaded');
                var tl3 = wrap.querySelector('.thumb-loading');
                if (tl3) tl3.style.display = 'none';
              }
            } catch (e) {}
          };
          el.addEventListener('loadeddata', function onVD() {
            try { el.removeEventListener('loadeddata', onVD); removeLazy(); } catch (e) {}
            lazyRelease();
          });
          el.addEventListener('error', function onVE(){ try { el.removeEventListener('error', onVE); } catch(e){} lazyRelease(); });
          setTimeout(function(){ try { removeLazy(); } catch (e) {} }, 1500);
          try { generateVideoPoster(el); } catch (e) {}
        }
      });
    } catch (e) { /* 略過 */ }
  }

  // 🌀 針對立即有 src 的媒體，補上載入中指示與完成後移除
  function ensureThumbLoading(node) {
    try {
      if (!node) return;
      var wrap = node;
      // 課程總覽容器或已存在 overlay 的預覽，不啟用旋轉縮圖指示
      try {
        if ((wrap.closest && (wrap.closest('#overviewPhotosPreviews') || wrap.closest('#overviewExistingPreviews'))) || wrap.querySelector('.file-uploading-overlay')) {
          return;
        }
      } catch (e) {}
      if (wrap && wrap.getAttribute && wrap.getAttribute('data-thumb-ready') === '1') {
        wrap.classList.remove('loading');
        wrap.classList.add('loaded');
        var readyTl = wrap.querySelector('.thumb-loading');
        if (readyTl) readyTl.style.display = 'none';
        return;
      }
      if (wrap && wrap.getAttribute && wrap.getAttribute('data-static-thumb') === '1') {
        wrap.classList.remove('loading');
        wrap.classList.add('loaded');
        try {
          var tlStatic = wrap.querySelector('.thumb-loading');
          if (tlStatic) tlStatic.style.display = 'none';
        } catch (e) {}
        return;
      }
      if (wrap && wrap.querySelector && wrap.querySelector('.video-fallback-icon')) {
        wrap.classList.remove('loading');
        wrap.classList.add('loaded');
        try {
          var tlFallback = wrap.querySelector('.thumb-loading');
          if (tlFallback) tlFallback.style.display = 'none';
        } catch (e) {}
        return;
      }
      try { wrap.classList.add('loading'); wrap.classList.remove('loaded'); } catch (e) {}
      var media = wrap.querySelector('img, video');
      if (!media) return;
      var ensureSpinner = function () {
        if (wrap.querySelector('.thumb-loading')) return;
        var sp = document.createElement('div');
        sp.className = 'thumb-loading';
        sp.setAttribute('aria-hidden', 'true');
        wrap.appendChild(sp);
      };
      ensureSpinner();
      var hide = function () {
        try {
          wrap.classList.remove('loading');
          wrap.classList.add('loaded');
          var tl = wrap.querySelector('.thumb-loading');
          if (tl) tl.style.display = 'none';
          var key = '';
          try { key = media.currentSrc || media.src || media.getAttribute('data-src') || media.getAttribute('src'); } catch (_) {}
          if (!key && wrap) {
            try { key = wrap.getAttribute('data-preview-url') || ''; } catch (_) {}
          }
          if (wrap) {
            try { wrap.setAttribute('data-thumb-ready', '1'); } catch (_) {}
          }
          rememberThumb(key);
        } catch (e) {}
      };
      if (media.tagName === 'IMG') {
        if (media.complete && media.naturalWidth > 0) {
          hide();
        } else {
          media.addEventListener('load', hide, { once: true });
          media.addEventListener('error', hide, { once: true });
          setTimeout(hide, 2500);
        }
        return;
      }
      try {
        media.preload = 'metadata';
        media.muted = true;
        media.playsInline = true;
        media.autoplay = true;
        media.loop = false;
        if (typeof media.setAttribute === 'function') {
          media.setAttribute('playsinline', 'true');
          media.setAttribute('muted', 'true');
        }
        if (typeof media.load === 'function') media.load();
      } catch (e) {}
      var onReady = function () {
        try { media.removeEventListener('loadeddata', onReady); } catch (e) {}
        try { media.removeEventListener('loadedmetadata', onReady); } catch (e) {}
        try { generateVideoPoster(media); } catch (e) {}
        hide();
        try {
          if (media.readyState >= 2) {
            var duration = Number(media.duration || 0);
            if (duration > 0.2) {
              try { media.currentTime = Math.min(Math.max(duration * 0.12, 0.08), Math.max(duration - 0.1, 0.12)); } catch (seekErr) {}
            }
          }
          try { media.pause(); } catch (pauseErr) {}
          var posterImg = wrap ? wrap.querySelector('img.video-poster') : null;
          if (posterImg && !posterImg.src) posterImg.style.display = 'none';
          var fallbackIcon = wrap ? wrap.querySelector('.video-fallback-icon') : null;
          if (fallbackIcon) fallbackIcon.style.display = 'none';
          if (wrap) wrap.classList.remove('video-fallback');
          media.style.opacity = '1';
          media.style.display = 'block';
        } catch (vidErr) {}
      };
      media.addEventListener('loadeddata', onReady);
      media.addEventListener('loadedmetadata', onReady);
      media.addEventListener('error', hide, { once: true });
      setTimeout(function () {
        try { generateVideoPoster(media); } catch (e) {}
        hide();
        try {
          var fallbackIcon = wrap ? wrap.querySelector('.video-fallback-icon') : null;
          if (fallbackIcon && (!media.poster || !media.poster.length)) fallbackIcon.style.display = 'block';
        } catch (e) {}
      }, isLowEndDevice() ? 4500 : 2800);
    } catch (e) {}
  }
  function attachThumbLoadingHandlers(root) {
    try {
      var scope = root || document;
      // 課程總覽（新上傳/既有）不啟用旋轉縮圖指示，維持與學生頁相同的 overlay/進度呈現
      var id = (scope && scope.id) || '';
      if (id === 'overviewPhotosPreviews' || id === 'overviewExistingPreviews') return;
      var nodes = scope.querySelectorAll('.file-preview');
      Array.prototype.forEach.call(nodes, function(n){ 
        try { 
          // 若已有 overlay（共用渲染）或屬於課程總覽容器，跳過
          if (n.querySelector('.file-uploading-overlay')) return;
          if (n.closest && (n.closest('#overviewPhotosPreviews') || n.closest('#overviewExistingPreviews'))) return;
          ensureThumbLoading(n); 
        } catch (e) {} 
      });
    } catch (e) {}
  }

  // 🎞️ 生成影片縮圖（第一幀），加快辨識
  function generateVideoPoster(videoEl) {
    try {
      if (!videoEl || videoEl.tagName !== 'VIDEO') return;
      
      // 🔥 [修復] 檢查元素是否仍在 DOM 中
      if (!videoEl.isConnected) {
        console.log('⏭️ [generateVideoPoster] 影片元素已從 DOM 移除');
        return;
      }
      
      if (videoEl.__posterPromise) return;
      var src = videoEl.getAttribute('data-src') || videoEl.getAttribute('src') || videoEl.currentSrc || '';
      if (!src) return;
      
      // 🔥 [修復] 檢查 src 是否為 blob: 或 http: 開頭（有效 URL）
      if (!src.startsWith('blob:') && !src.startsWith('http:') && !src.startsWith('https:') && !src.startsWith('/')) {
        console.log('⏭️ [generateVideoPoster] 無效的影片 src:', src);
        return;
      }
      
      var cacheKeyLookup = normalizeThumbKey(src);
      if (videoPosterCache[cacheKeyLookup]) {
        try {
          videoEl.setAttribute('poster', videoPosterCache[cacheKeyLookup]);
          videoEl.__hasPoster = true;
          if (posterRetryRegistry && posterRetryRegistry[cacheKeyLookup]) {
            try { clearTimeout(posterRetryRegistry[cacheKeyLookup].timer); } catch (e) {}
            delete posterRetryRegistry[cacheKeyLookup];
          }
          var wrapCached = videoEl.closest('.file-preview');
          if (wrapCached) {
            wrapCached.classList.remove('video-fallback');
            var cacheOverlay = wrapCached.querySelector('img.video-poster');
            if (!cacheOverlay) {
              cacheOverlay = document.createElement('img');
              cacheOverlay.className = 'video-poster';
              cacheOverlay.alt = 'poster';
              wrapCached.appendChild(cacheOverlay);
            }
            cacheOverlay.src = videoPosterCache[cacheKeyLookup];
            cacheOverlay.style.display = 'block';
          }
        } catch (e) {}
        return;
      }
      var wrap = videoEl.closest('.file-preview');
      
      // 🔥 [修復] 再次確認元素仍在 DOM 中（在開始異步操作前）
      if (!videoEl.isConnected || (wrap && !wrap.isConnected)) {
        console.log('⏭️ [generateVideoPoster] 元素在異步操作前已從 DOM 移除');
        return;
      }
      
      videoEl.__posterPromise = capturePosterFromSource(src).then(function (data) {
        videoEl.__posterPromise = null;
        
        // 🔥 [修復] 檢查元素在異步完成後是否仍在 DOM 中
        if (!videoEl.isConnected) {
          console.log('⏭️ [generateVideoPoster] 影片元素在縮圖生成完成後已從 DOM 移除');
          return;
        }
        
          if (data && data.length > 32) {
            var cacheKey = normalizeThumbKey(src);
            videoPosterCache[cacheKey] = data;
          try {
            videoEl.setAttribute('poster', data);
            videoEl.__hasPoster = true;
            if (posterRetryRegistry && posterRetryRegistry[cacheKey]) {
              try { clearTimeout(posterRetryRegistry[cacheKey].timer); } catch (e) {}
              delete posterRetryRegistry[cacheKey];
            }
          } catch (e) {}
          if (wrap) {
            wrap.classList.remove('video-fallback');
            var overlay = wrap.querySelector('img.video-poster');
            if (!overlay) {
              overlay = document.createElement('img');
              overlay.className = 'video-poster';
              overlay.alt = 'poster';
              wrap.appendChild(overlay);
            }
            overlay.src = data;
            overlay.style.display = 'block';
            var fallbackIcon = wrap.querySelector('.video-fallback-icon');
            if (fallbackIcon) fallbackIcon.remove();
          }
        } else if (wrap) {
          wrap.classList.add('video-fallback');
          if (!wrap.querySelector('.video-fallback-icon')) {
            var icon = document.createElement('div');
            icon.className = 'video-fallback-icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = '🎬';
            wrap.appendChild(icon);
          }
          schedulePosterRetry(videoEl, src);
        }
      }).catch(function () {
        videoEl.__posterPromise = null;
        schedulePosterRetry(videoEl, src);
      });
    } catch (e) {}
  }
  global.saveDrawerEdit = saveDrawerEdit;
  global.cancelDrawerEdit = cancelDrawerEdit;
  global.deleteDrawerFile = deleteDrawerFile;
  global.triggerAddFile = triggerAddFile;

  function setupTopTabsStickyObserver() {
    var tabs = document.getElementById('topTabs');
    var sentinel = document.getElementById('topTabsSentinel');
    if (!tabs || !sentinel || !('IntersectionObserver' in window)) return;
    if (topTabsStickyObserver) topTabsStickyObserver.disconnect();
    topTabsStickyObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          tabs.classList.remove('is-sticky');
          try { document.body.classList.remove('with-sticky-tabs'); } catch (e) {}
        } else {
          tabs.classList.add('is-sticky');
          try { document.body.classList.add('with-sticky-tabs'); } catch (e) {}
        }
      });
    }, { threshold: [0, 1] });
    topTabsStickyObserver.observe(sentinel);
  }

  function clearNewUploadPreviews(studentIndex) {
    // ✅ 不再立即移除；改為保留在前端，顯示已上傳，並等待伺服器回傳檔名後由 re-render 取代
    ['photos', 'videos'].forEach(function(type) {
      var container = document.getElementById(type + '-preview-' + studentIndex);
      if (!container) return;
      Array.prototype.slice.call(container.querySelectorAll('.file-preview.new-upload')).forEach(function (node) {
        // 若本檔已標記上傳失敗則略過，保留錯誤狀態供使用者檢視/重試
        if (node.classList.contains('upload-error')) return;
        var typeAllDone = Array.isArray(node.classList) && node.classList.contains('awaiting-persistence');
        if (typeAllDone) return;
        
        // 🔥 [修復] 確保 data-preview-url 屬性存在
        var previewUrl = node.getAttribute('data-preview-url');
        var objectUrl = node.getAttribute('data-object-url');
        
        // 如果 data-preview-url 不存在，但 data-object-url 存在，則複製過去
        if (!previewUrl && objectUrl) {
          node.setAttribute('data-preview-url', objectUrl);
          console.log('💡 [clearNewUploadPreviews] 從 data-object-url 恢復 data-preview-url');
        }
        
        // 如果兩者都不存在，嘗試從媒體元素獲取
        if (!previewUrl && !objectUrl) {
          var mediaElement = node.querySelector('img, video');
          if (mediaElement && mediaElement.src) {
            node.setAttribute('data-preview-url', mediaElement.src);
            node.setAttribute('data-object-url', mediaElement.src);
            console.log('💡 [clearNewUploadPreviews] 從媒體元素 src 設定 data-preview-url');
          }
        }
        
        node.classList.remove('uploading');
        node.classList.remove('upload-error');
        node.classList.add('upload-success');
        node.classList.add('awaiting-persistence');
        node.setAttribute('data-awaiting-sync', '1');
        
        // 🔥 [修復 2025-11-18] 同步中狀態也不顯示 overlay，只更新文字
        var overlay = node.querySelector('.file-uploading-overlay');
        if (overlay) {
          // overlay.style.display = 'flex';  // 不強制顯示，由 CSS hover 控制
          var txt = overlay.querySelector('.progress-text');
          if (txt) txt.textContent = '✓ 同步中';
          console.log('✅ [clearNewUploadPreviews] 顯示同步中狀態（等待伺服器確認）');
        }
        
        var bar = node.querySelector('.file-upload-progress');
        if (bar) bar.style.display = 'none';
        
        // 🔥 暫時禁用刪除按鈕，等待同步完成
        var del = node.querySelector('.remove-btn');
        if (del) {
          del.disabled = true;
          del.title = '同步中，請稍候';
        }
      });
    });
    if (currentOverlayUrl && currentOverlayUrl.indexOf('blob:') === 0 && previewOverlayEl && previewOverlayEl.classList.contains('open')) {
      closePreviewOverlay();
    }
  }

  function closePreviewOverlay() {
    if (!previewOverlayEl) return;
    var media = previewOverlayBody && previewOverlayBody.querySelector('video');
    if (media && typeof media.pause === 'function') {
      media.pause();
      media.removeAttribute('src');
      if (typeof media.load === 'function') media.load();
    }
    if (previewOverlayBody) previewOverlayBody.innerHTML = '';
    previewOverlayEl.classList.remove('open');
    previewOverlayEl.setAttribute('aria-hidden', 'true');
    if (currentOverlayUrl) {
      if (pendingOverlayRevokes.has(currentOverlayUrl)) {
        try { URL.revokeObjectURL(currentOverlayUrl); } catch (err) { console.warn('⚠️ 無法釋放預覽 URL:', err); }
        pendingOverlayRevokes.delete(currentOverlayUrl);
      }
      pendingOverlayRevokes.forEach(function (url) {
        try { URL.revokeObjectURL(url); } catch (err) { console.warn('⚠️ 無法釋放預覽 URL:', err); }
      });
      pendingOverlayRevokes.clear();
    }
    currentOverlayUrl = null;
  }
  
  // 🔥 暴露到全域，供 HTML onclick 使用
  window.closePreviewOverlay = closePreviewOverlay;

  function openPreviewOverlay(url, type) {
    if (!previewOverlayEl || !previewOverlayBody) return;
    
    // 使用異步更新，不阻塞主線程
    updateDOMAsync(function() {
      _openPreviewOverlaySync(url, type);
    }, 50); // 預覽可以稍微延遲，但不要太久
  }
  
  function _openPreviewOverlaySync(url, type) {
    if (!previewOverlayEl || !previewOverlayBody) return;
    
    // 🔍 調試：輸出預覽資訊
    console.log('🎬 [openPreviewOverlay] 打開預覽:', {
      'URL': url,
      'type': type,
      '是否為 blob': url && url.indexOf('blob:') === 0,
      '是否為縮圖': url && (url.indexOf('.thumb.jpg') > -1 || url.indexOf('.preview.jpg') > -1),
      'User Agent': navigator.userAgent
    });
    
    previewOverlayBody.innerHTML = '';
    if (type === 'video') {
      // 🔥 使用 DOM API 創建視頻元素（更好的移動端兼容性）
      var video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.autoplay = true;
      video.playsInline = true;  // 標準屬性
      video.setAttribute('playsinline', '');  // iOS 需要
      video.setAttribute('webkit-playsinline', '');  // 舊版 iOS 需要
      video.setAttribute('x5-video-player-type', 'h5');  // 微信/QQ 瀏覽器
      video.setAttribute('x5-video-player-fullscreen', 'false');  // 微信內不全屏
      video.muted = false;  // 不靜音（因為是預覽）
      video.preload = 'metadata';
      
      // 🔥 手動觸發播放（繞過 autoplay 限制）
      video.addEventListener('loadedmetadata', function() {
        console.log('📹 [視頻元數據載入完成] 嘗試播放...');
        var playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.then(function() {
            console.log('✅ [視頻自動播放] 成功');
          }).catch(function(error) {
            console.warn('⚠️ [視頻自動播放] 被阻止:', error.message);
            console.log('💡 提示：用戶需要手動點擊播放按鈕');
          });
        }
      });
      
      // 🔥 錯誤處理
      video.addEventListener('error', function(e) {
        var errorCode = video.error ? video.error.code : null;
        var errorMessage = video.error ? video.error.message : '未知錯誤';
        
        // MediaError 錯誤碼對照
        var errorTypes = {
          1: 'MEDIA_ERR_ABORTED: 影片載入被中止',
          2: 'MEDIA_ERR_NETWORK: 網路錯誤，無法載入影片',
          3: 'MEDIA_ERR_DECODE: 影片解碼失敗（檔案可能損壞）',
          4: 'MEDIA_ERR_SRC_NOT_SUPPORTED: 影片格式不支援或檔案損壞'
        };
        
        var errorDesc = errorTypes[errorCode] || '未知錯誤';
        
        console.error('❌ [影片播放錯誤]:', {
          '錯誤碼': errorCode,
          '錯誤類型': errorDesc,
          '詳細訊息': errorMessage,
          '影片 URL': url,
          '檔案名稱': url.split('/').pop()
        });
        
        // 顯示友好的錯誤訊息
        previewOverlayBody.innerHTML = `
          <div style="padding: 40px; text-align: center; color: #fff;">
            <i class="fas fa-exclamation-triangle" style="font-size: 48px; color: #f59e0b; margin-bottom: 20px;"></i>
            <h3 style="margin-bottom: 16px;">影片無法播放</h3>
            <p style="color: #9ca3af; margin-bottom: 8px;">${errorDesc}</p>
            <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">檔案可能損壞或格式不完整</p>
            <div style="display: flex; gap: 12px; justify-content: center;">
              <a href="${url}" download class="nav-btn" style="background: #3b82f6;">
                <i class="fas fa-download"></i> 下載檔案
              </a>
              <button onclick="closePreviewOverlay()" class="nav-btn" style="background: #6b7280;">
                <i class="fas fa-times"></i> 關閉
              </button>
            </div>
            <p style="color: #6b7280; font-size: 12px; margin-top: 16px;">💡 提示：檔案可能在上傳時未完成，請嘗試重新上傳</p>
          </div>
        `;
        
        // 顯示 Toast 提示
        if (typeof showToast === 'function') {
          showToast('影片無法播放：' + errorDesc, 'error');
        }
      });
      
      previewOverlayBody.appendChild(video);
    } else {
      previewOverlayBody.insertAdjacentHTML('beforeend', '<img src="' + url + '" alt="預覽">');
    }
    previewOverlayEl.classList.add('open');
    previewOverlayEl.setAttribute('aria-hidden', 'false');
    currentOverlayUrl = url && url.indexOf('blob:') === 0 ? url : null;
  }

  function setupPreviewOverlay() {
    previewOverlayEl = document.getElementById('previewOverlay');
    previewOverlayBody = document.getElementById('previewOverlayBody');
    if (previewOverlayBound) return;
    previewOverlayBound = true;
    var closeBtn = document.getElementById('previewOverlayClose');
    if (closeBtn) {
      closeBtn.addEventListener('click', function (event) {
        event.preventDefault();
        closePreviewOverlay();
      });
    }
    if (previewOverlayEl) {
      previewOverlayEl.addEventListener('click', function (event) {
        if (event.target === previewOverlayEl) {
          closePreviewOverlay();
        }
      });
    }
    document.addEventListener('keyup', function (event) {
      if (event.key === 'Escape') closePreviewOverlay();
    });
  document.addEventListener('click', function (event) {
      var removeBtn = event.target.closest('.file-preview .remove-btn');
      if (removeBtn) {
        event.stopPropagation();
        return;
      }
      var previewNode = event.target.closest('.file-preview.preview-clickable');
      if (!previewNode) return;
      var previewUrl = previewNode.getAttribute('data-preview-url');
      var previewType = previewNode.getAttribute('data-preview-type') || 'image';
      var filename = previewNode.getAttribute('data-filename') || '';
      
      // 🔥 [修復] 如果 data-preview-url 不存在，嘗試使用 data-object-url 作為備用
      if (!previewUrl) {
        previewUrl = previewNode.getAttribute('data-object-url');
        if (previewUrl) {
          console.log('💡 [點擊預覽] data-preview-url 缺失，使用 data-object-url 備用:', previewUrl);
        }
      }
      
      // 🔥 [修復] 如果還是沒有 URL，嘗試從 img/video 元素獲取 src
      if (!previewUrl) {
        var mediaElement = previewNode.querySelector('img, video');
        if (mediaElement && mediaElement.src) {
          previewUrl = mediaElement.src;
          console.log('💡 [點擊預覽] 使用媒體元素 src 作為備用:', previewUrl);
        }
      }
      
      // 🔍 調試：點擊事件
      console.log('👆 [點擊預覽] 觸發:', {
        'previewUrl': previewUrl,
        'previewType': previewType,
        'filename': filename,
        'element': previewNode,
        'hasObjectUrl': !!previewNode.getAttribute('data-object-url'),
        'hasMediaSrc': !!(previewNode.querySelector('img, video') && previewNode.querySelector('img, video').src)
      });
      
      if (!previewUrl) {
        console.error('❌ [點擊預覽] 無法獲取預覽 URL');
        return;
      }
      event.preventDefault();
      openPreviewOverlay(previewUrl, previewType);
  });

  document.addEventListener('click', function (event) {
    try {
      var entry = event.target.closest('.poster-error-entry');
      if (!entry) return;
      entry.classList.remove('visible');
      setTimeout(function(){
        try { if (entry.parentNode) entry.parentNode.removeChild(entry); } catch (e) {}
        var panel = ensurePosterErrorPanel();
        if (panel && !panel.childNodes.length) panel.classList.remove('show');
      }, 200);
    } catch (e) {}
  });

  // ========= 上傳節點保護：避免滑動時被清掉 =========
  function getShadowHost() {
    var host = document.getElementById('uploadShadowHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'uploadShadowHost';
      host.style.display = 'none';
      document.body.appendChild(host);
    }
    return host;
  }
  
  function preserveActiveUploadNodes() {
    try {
      var host = getShadowHost();
      if (!host) return;
      var buffers = getShadowBuffersForActiveCourse();
      var containers = document.querySelectorAll('.file-previews[id^="photos-preview-"], .file-previews[id^="videos-preview-"]');
      
      console.log('🔍 [preserveActiveUploadNodes] 找到容器:', containers.length);
      
      containers.forEach(function(container) {
        var allNodes = container.querySelectorAll('.file-preview');
        var preserveNodes = Array.prototype.filter.call(allNodes, shouldPreservePreviewNode);
        
        console.log('📊 [preserveActiveUploadNodes] 容器:', container.id, {
          總節點數: allNodes.length,
          需保存數: preserveNodes.length,
          節點詳情: preserveNodes.map(n => ({
            className: n.className,
            'data-synced': n.getAttribute('data-synced'),
            'data-awaiting-sync': n.getAttribute('data-awaiting-sync'),
            'data-media-id': n.getAttribute('data-media-id'),
            'data-temp-id': n.getAttribute('data-temp-id')
          }))
        });
        
        if (!preserveNodes.length) return;
        var match = container.id.match(/(photos|videos)-preview-(\d+)/);
        if (!match) return;
        var type = match[1] === 'videos' ? 'videos' : 'photos';
        var studentIndex = match[2];
        buffers[studentIndex] = buffers[studentIndex] || { photos: [], videos: [] };
        var bucket = buffers[studentIndex][type] = buffers[studentIndex][type] || [];
        bucket.length = 0;
        preserveNodes.forEach(function(node) {
          try {
            host.appendChild(node);
            bucket.push(node);
            console.log('✅ [preserveActiveUploadNodes] 已保存節點到 shadow DOM');
          } catch (e) {
            console.error('❌ [preserveActiveUploadNodes] 保存節點失敗:', e);
          }
        });
      });
    } catch (e) {
      console.error('❌ [preserveActiveUploadNodes] 總體失敗:', e);
    }
  }
  
  function reattachShadowNodesFor(index) {
    try {
      var k = String(index);
      var buffers = getShadowBuffersForActiveCourse();
      var buf = buffers && buffers[k];
      
      console.log('🔄 [reattachShadowNodesFor] 學生:', index, {
        有緩衝區: !!buf,
        照片節點數: buf && buf.photos ? buf.photos.length : 0,
        影片節點數: buf && buf.videos ? buf.videos.length : 0
      });
      
      if (!buf) return;
      var photos = document.getElementById('photos-preview-' + index);
      var videos = document.getElementById('videos-preview-' + index);
      
      var restoredCount = 0;
      if (photos && Array.isArray(buf.photos)) {
        buf.photos.forEach(function (n) { 
          try { 
            photos.appendChild(n); 
            restoredCount++;
            console.log('✅ [reattachShadowNodesFor] 還原照片節點');
          } catch (e) {
            console.error('❌ [reattachShadowNodesFor] 還原照片節點失敗:', e);
          } 
        });
      }
      if (videos && Array.isArray(buf.videos)) {
        buf.videos.forEach(function (n) { 
          try { 
            videos.appendChild(n); 
            restoredCount++;
            console.log('✅ [reattachShadowNodesFor] 還原影片節點');
          } catch (e) {
            console.error('❌ [reattachShadowNodesFor] 還原影片節點失敗:', e);
          } 
        });
      }
      
      console.log('📊 [reattachShadowNodesFor] 完成還原:', restoredCount, '個節點');
      
      buf.photos = [];
      buf.videos = [];
      try { updateDropZones(index); appendAddMoreButton(index, 'photos'); appendAddMoreButton(index, 'videos'); } catch (e) {}
    } catch (e) {
      console.error('❌ [reattachShadowNodesFor] 總體失敗:', e);
    }
  }

  function reattachAllShadowBuffers() {
    try {
      var buffers = getShadowBuffersForActiveCourse();
      Object.keys(buffers || {}).forEach(function(key) {
        reattachShadowNodesFor(key);
      });
    } catch (e) {}
  }

  // ==================== 課程總覽預覽節點保留（視圖切換用） ====================
  function getOverviewShadowHost() {
    var host = document.getElementById('overviewShadowHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'overviewShadowHost';
      host.style.display = 'none';
      document.body.appendChild(host);
    }
    return host;
  }
  function preserveOverviewPreviewNodes() {
    try {
      var buffer = getOverviewShadowBufferForActiveCourse();
      var host = getOverviewShadowHost();
      var wrap = document.getElementById('overviewPhotosPreviews');
      if (!wrap) return;
      var list = Array.prototype.filter.call(wrap.querySelectorAll('.file-preview'), shouldPreservePreviewNode);
      if (!list.length) return;
      buffer.nodes = [];
      list.forEach(function(n){ try { host.appendChild(n); buffer.nodes.push(n); } catch (e) {} });
      console.log('💾 [OverviewShadow] 已暫存節點:', buffer.nodes.length);
    } catch (e) {}
  }
  function reattachOverviewPreviewNodes() {
    try {
      var buffer = getOverviewShadowBufferForActiveCourse();
      if (!buffer.nodes || !buffer.nodes.length) return;
      var wrap = document.getElementById('overviewPhotosPreviews');
      if (!wrap) return;
      buffer.nodes.forEach(function(n){ try { wrap.appendChild(n); } catch (e) {} });
      console.log('📦 [OverviewShadow] 已復掛節點:', buffer.nodes.length);
      buffer.nodes = [];
    } catch (e) {}
  }

  // ============================================
  // 🧹 記憶體清理：頁面卸載時清理所有資源
  // ============================================
  function cleanupOnUnload() {
    try {
      console.log('🧹 開始清理資源...');
      
      // 1. 清理所有計時器
      Object.keys(autoUploadTimers || {}).forEach(function(key) {
        try {
          if (autoUploadTimers[key]) {
            clearTimeout(autoUploadTimers[key]);
            delete autoUploadTimers[key];
          }
        } catch (e) {}
      });
      if (overviewScheduleTimer) {
        clearTimeout(overviewScheduleTimer);
        overviewScheduleTimer = null;
      }
      if (overviewAutoTimer) {
        clearTimeout(overviewAutoTimer);
        overviewAutoTimer = null;
      }
      if (window.__lrReloadTimer) {
        clearTimeout(window.__lrReloadTimer);
        window.__lrReloadTimer = null;
      }
      
      // 2. 清理 IntersectionObserver
      if (topTabsStickyObserver) {
        try {
          topTabsStickyObserver.disconnect();
          topTabsStickyObserver = null;
        } catch (e) {}
      }
      
      // 3. 清理所有 Blob URL
      try {
        // 清理學生檔案的 Blob URL
        Object.keys(studentFiles || {}).forEach(function(studentIndex) {
          var entry = studentFiles[studentIndex];
          if (!entry) return;
          ['photos', 'videos'].forEach(function(type) {
            var files = entry[type] || [];
            files.forEach(function(file) {
              // 檢查是否有對應的 Blob URL 需要清理
              try {
                var container = document.getElementById(type + '-preview-' + studentIndex);
                if (container) {
                  Array.prototype.slice.call(container.querySelectorAll('[data-object-url]')).forEach(function(node) {
                    var url = node.getAttribute('data-object-url');
                    if (url && url.indexOf('blob:') === 0) {
                      try { URL.revokeObjectURL(url); } catch (e) {}
                    }
                  });
                }
              } catch (e) {}
            });
          });
        });
        
        // 清理課程總覽的 Blob URL
        try {
          var overviewContainer = document.getElementById('overviewPhotosPreviews');
          if (overviewContainer) {
            Array.prototype.slice.call(overviewContainer.querySelectorAll('[data-object-url]')).forEach(function(node) {
              var url = node.getAttribute('data-object-url');
              if (url && url.indexOf('blob:') === 0) {
                try { URL.revokeObjectURL(url); } catch (e) {}
              }
            });
          }
        } catch (e) {}
        
        // 清理 pendingOverlayRevokes
        pendingOverlayRevokes.forEach(function(url) {
          try { URL.revokeObjectURL(url); } catch (e) {}
        });
        pendingOverlayRevokes.clear();
        
        // 清理當前預覽的 Blob URL
        if (currentOverlayUrl && currentOverlayUrl.indexOf('blob:') === 0) {
          try { URL.revokeObjectURL(currentOverlayUrl); } catch (e) {}
          currentOverlayUrl = null;
        }
      } catch (e) {
        console.warn('⚠️ 清理 Blob URL 時發生錯誤:', e);
      }
      
      // 4. 清理影片元素
      try {
        if (previewOverlayBody) {
          var media = previewOverlayBody.querySelector('video');
          if (media) {
            try {
              media.pause();
              media.removeAttribute('src');
              if (typeof media.load === 'function') media.load();
            } catch (e) {}
          }
        }
      } catch (e) {}
      
      // 5. 清理上傳狀態
      uploadingStudents = {};
      activeUploadsByStudent = {};
      activeUploadsTotal = 0;
      
      console.log('✅ 資源清理完成');
    } catch (error) {
      console.error('❌ 清理資源時發生錯誤:', error);
    }
  }

  // 註冊頁面卸載事件
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanupOnUnload);
    window.addEventListener('pagehide', cleanupOnUnload);
    // 對於單頁應用，也監聽 visibilitychange
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
          try {
            if (topTabsStickyObserver) {
              topTabsStickyObserver.disconnect();
            }
          } catch (e) {}
          try { preserveActiveUploadNodes(); } catch (e) {}
          try { preserveOverviewPreviewNodes(); } catch (e) {}
        } else {
          try { reattachAllShadowBuffers(); } catch (e) {}
          try { reattachOverviewPreviewNodes(); } catch (e) {}
          try { restorePendingUploads({ reason: 'visibilitychange', skipIfRunning: false }); } catch (e) {}
        }
      });
    }
    try {
      window.addEventListener('pageshow', function() {
        try { reattachAllShadowBuffers(); } catch (e) {}
        try { reattachOverviewPreviewNodes(); } catch (e) {}
        try { restorePendingUploads({ reason: 'pageshow', skipIfRunning: true }); } catch (e) {}
      });
    } catch (e) {}
  }

  // ============================================
  // 🎬 影片上傳輔助函數
  // ============================================

  /**
   * 估算上傳時間
   * @param {number} fileSize - 檔案大小（bytes）
   * @returns {string} 預估時間文字
   */
  function estimateUploadTime(fileSize) {
    if (!fileSize || fileSize <= 0) return '未知';
    
    try {
      // 根據網路連線估算速度
      var profile = window.SharedMediaUploader?.getConnectionProfile() || {};
      var speedMbps = 10; // 預設 10 Mbps
      
      if (profile.fast) {
        speedMbps = 20;
      } else if (profile.slow) {
        speedMbps = 3;
      } else if (profile.downlink > 0) {
        speedMbps = profile.downlink;
      }
      
      // 計算時間（秒）- 考慮上傳速度通常是下載速度的 1/3
      var uploadSpeedBytesPerSec = (speedMbps * 1024 * 1024 / 8) / 3;
      var estimatedSeconds = fileSize / uploadSpeedBytesPerSec;
      
      // 加上處理時間（約 20%）
      estimatedSeconds = estimatedSeconds * 1.2;
      
      if (estimatedSeconds < 10) {
        return '不到 10 秒';
      } else if (estimatedSeconds < 60) {
        return Math.ceil(estimatedSeconds) + ' 秒';
      } else if (estimatedSeconds < 3600) {
        return Math.ceil(estimatedSeconds / 60) + ' 分鐘';
      } else {
        var hours = Math.floor(estimatedSeconds / 3600);
        var minutes = Math.ceil((estimatedSeconds % 3600) / 60);
        return hours + ' 小時 ' + (minutes > 0 ? minutes + ' 分鐘' : '');
      }
    } catch (error) {
      console.warn('⚠️ 估算上傳時間失敗:', error);
      return '未知';
    }
  }

  /**
   * 🎬 大檔案上傳前確認
   * @param {File} file - 檔案物件
   * @returns {Promise<boolean>} 是否繼續上傳
   */
  function confirmLargeVideoUpload(file) {
    return new Promise(function(resolve) {
      try {
        if (!file) {
          resolve(true);
          return;
        }
        
        var sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        var estimatedTime = estimateUploadTime(file.size);
        var fileName = file.name || '影片檔案';
        
        // 檢查配置是否啟用確認對話框
        var config = window.LearningUploadConfig;
        var confirmEnabled = config?.get('video.confirmLargeUpload') !== false;
        var thresholdMB = config?.get('video.confirmThresholdMB') || 100;
        
        // 檔案小於閾值，直接通過
        if (file.size < thresholdMB * 1024 * 1024 || !confirmEnabled) {
          resolve(true);
          return;
        }
        
        // 顯示確認對話框
        var message = '您即將上傳大型影片檔案：\n\n' +
          '檔案：' + fileName + '\n' +
          '大小：' + sizeMB + ' MB\n' +
          '預估時間：' + estimatedTime + '\n\n' +
          '建議：\n' +
          '• 保持網路連線穩定\n' +
          '• 避免同時開啟其他應用\n' +
          '• 可隨時取消上傳\n\n' +
          '確定要繼續嗎？';
        
        var confirmed = window.confirm(message);
        console.log('🎬 [大檔案確認]', fileName, '(' + sizeMB + ' MB) -', confirmed ? '✅ 確認' : '❌ 取消');
        
        resolve(confirmed);
      } catch (error) {
        console.error('❌ [大檔案確認] 錯誤:', error);
        // 錯誤時預設允許上傳
        resolve(true);
      }
    });
  }

  /**
   * 🎬 顯示記憶體使用狀況
   * @returns {string} 記憶體使用文字
   */
  function getMemoryUsageText() {
    try {
      if (performance && performance.memory) {
        var used = performance.memory.usedJSHeapSize;
        var limit = performance.memory.jsHeapSizeLimit;
        var usedMB = (used / (1024 * 1024)).toFixed(0);
        var limitMB = (limit / (1024 * 1024)).toFixed(0);
        var ratio = (used / limit * 100).toFixed(1);
        
        return '記憶體使用：' + usedMB + ' / ' + limitMB + ' MB (' + ratio + '%)';
      }
      return '記憶體使用：無法取得';
    } catch (error) {
      return '記憶體使用：錯誤';
    }
  }

  /**
   * 🎬 顯示友善的錯誤訊息
   * @param {Error} error - 錯誤物件
   * @param {File} file - 相關檔案
   */
  function showFriendlyErrorMessage(error, file) {
    try {
      // 使用錯誤分類函數
      var category = window.LearningUploadCategorizeError 
        ? window.LearningUploadCategorizeError(error)
        : { type: 'unknown', userMessage: error.message };
      
      var fileName = file && file.name ? file.name : '檔案';
      var sizeMB = file && file.size ? (file.size / (1024 * 1024)).toFixed(1) + ' MB' : '未知大小';
      
      var message = '❌ 上傳失敗\n\n' +
        '檔案：' + fileName + ' (' + sizeMB + ')\n' +
        '錯誤：' + category.userMessage;
      
      // 記憶體不足時顯示記憶體狀況
      if (category.type === 'memory') {
        message += '\n\n' + getMemoryUsageText();
      }
      
      alert(message);
      console.error('❌ [上傳錯誤]', {
        file: fileName,
        size: sizeMB,
        errorType: category.type,
        message: category.userMessage
      });
    } catch (e) {
      // 後備處理
      alert('上傳失敗：' + (error?.message || '未知錯誤'));
      console.error('❌ [上傳錯誤]', error);
    }
  }

  // 將輔助函數掛載到全域供其他模組使用
  if (typeof window !== 'undefined') {
    window.estimateUploadTime = estimateUploadTime;
    window.confirmLargeVideoUpload = confirmLargeVideoUpload;
    window.getMemoryUsageText = getMemoryUsageText;
    window.showFriendlyErrorMessage = showFriendlyErrorMessage;
  }

  // 對外暴露常用函式（供 DevTools 或其他模組呼叫）
  if (typeof window !== 'undefined') {
    window.loadUploadedRecordsForCurrentCourse = loadUploadedRecordsForCurrentCourse;
    window.fetchStudentFsRecord = fetchStudentFsRecord;
    window.scheduleAutoUpload = scheduleAutoUpload;
    window.requestCourseReload = requestCourseReload;
    // 🔥 [修復 2025-11-18] 暴露 removeFile 函數，讓刪除按鈕可以正常工作
    window.removeFile = removeFile;
    window.reloadRecordsFromServer = function(opts) {
      requestCourseReload(Object.assign({ showLoader: false }, opts || {}));
      return false;
    };
  }

  // 🔥 [修復] 閉合整個 IIFE 函數作用域
}  // 閉合 IIFE 主函數體
})(window);
