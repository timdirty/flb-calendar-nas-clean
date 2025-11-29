/**
 * ============================================
 * 共用模組整合層
 * ============================================
 * 功能：連接共用模組與主程式，統一處理學生、課程總覽、抽屜的上傳/預覽
 * 作用：提供統一的 API，隱藏底層實現細節
 */

(function (global) {
  'use strict';

  // ==================== 依賴檢查 ====================
  var Uploader = global.SharedMediaUploader;
  var Previewer = global.SharedMediaPreviewer;
  var Loader = global.SharedMediaLoader;

  if (!Uploader || !Previewer || !Loader) {
    console.error('❌ [SharedIntegration] 缺少依賴模組');
    return;
  }

  function markLocalPreviewNodes(container) {
    try {
      if (!container) return;
      var nodes = container.querySelectorAll('.file-preview');
      Array.prototype.forEach.call(nodes, function(node) {
        if (!node) return;
        if (node.getAttribute('data-local-preserve') === '1') return;
        if (node.hasAttribute('data-temp-id') || node.classList.contains('new-upload')) {
          node.setAttribute('data-local-preserve', '1');
        }
      });
    } catch (e) {}
  }

  // ==================== 統一處理函數 ====================
  
  /**
   * 處理學生照片/影片選擇
   * 
   * @param {Object} options - 配置選項
   * @param {FileList|File[]} options.files - 檔案列表
   * @param {number} options.studentIndex - 學生索引
   * @param {string} options.type - 類型：'photos' 或 'videos'
   * @param {Object} options.entry - 學生資料 entry
   * @param {Function} options.onProgress - 進度回調
   * @param {Function} options.updatePreview - 更新預覽回調
   * @param {Function} options.checkUpload - 檢查上傳條件回調
   * 
   * @returns {Promise<Array>} 處理後的檔案列表
   */
  async function handleStudentMediaSelect(options) {
    try {
      var files = options.files;
      var studentIndex = options.studentIndex;
      var type = options.type; // 'photos' or 'videos'
      var entry = options.entry;
      
      console.log('🎯 [SharedIntegration] 處理學生媒體:', {
        studentIndex: studentIndex,
        type: type,
        filesCount: files.length,
        entryPhotosLength: entry.photos ? entry.photos.length : 0,
        entryVideosLength: entry.videos ? entry.videos.length : 0
      });

      // 🔥 [修復 2025-11-18] 先創建預覽節點，確保 DOM 就緒後再更新狀態
      if (typeof options.updatePreview === 'function') {
        console.log('🎨 [SharedIntegration] 預先創建預覽節點');
        options.updatePreview(studentIndex, type);
        
        // 等待 DOM 渲染完成
        await new Promise(function(resolve) {
          setTimeout(resolve, 50);
        });
      }

      (files || []).forEach(function(file) {
        if (file && file.__pendingMeta) {
          file.__pendingMeta.state = 'processing';
          if (global.PendingMediaStore && file.__pendingMeta.tempId) {
            global.PendingMediaStore.update(file.__pendingMeta.tempId, { state: 'processing' });
          }
          if (global.PendingMediaActions) {
            global.PendingMediaActions.updateState(file.__pendingMeta.tempId, 'processing', '壓縮中…');
          }
        }
      });

      // 🚀 使用共用上傳器處理檔案
      var processedFiles = await Uploader.processFiles({
        files: files,
        type: type === 'photos' ? 'image' : 'video',
        compress: type === 'photos', // 只壓縮照片
        onProgress: function(current, total, file) {
          console.log('📦 [' + current + '/' + total + '] 處理:', file.name);
          if (typeof options.onProgress === 'function') {
            options.onProgress(current, total, file);
          }
        },
        onFileProcessed: function(file, index) {
          // 立即加入 entry
          console.log('📦 [SharedIntegration] 檔案處理完成:', {
            fileName: file.name,
            fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB',
            index: index,
            entryLengthBefore: entry[type].length
          });
          var meta = file && file.__pendingMeta ? file.__pendingMeta : null;
          if (meta && typeof meta.entryIndex === 'number') {
            entry[type][meta.entryIndex] = file;
            file.__pendingMeta = file.__pendingMeta || meta;
            file.__pendingMeta.entryIndex = meta.entryIndex;
            file.__pendingMeta.state = 'ready';
            if (global.PendingMediaStore) {
              global.PendingMediaStore.update(meta.tempId, { entryIndex: meta.entryIndex, state: 'ready' });
            }
            if (global.PendingMediaActions) {
              global.PendingMediaActions.updateState(meta.tempId, 'ready', '等待自動上傳');
            }
          } else {
            entry[type].push(file);
          }
          
          console.log('✅ [SharedIntegration] 檔案已加入 entry:', {
            entryLengthAfter: entry[type].length
          });
        },
        onComplete: function(allFiles) {
          console.log('✅ [SharedIntegration] 學生媒體處理完成:', {
            allFilesLength: allFiles.length,
            entryPhotosLength: entry.photos ? entry.photos.length : 0,
            entryVideosLength: entry.videos ? entry.videos.length : 0
          });
          
          // 🔥 [修復 2025-11-18] 預覽節點已在處理前創建，這裡只需要觸發上傳檢查
          // 不再重複調用 updatePreview，避免重複創建節點
          if (typeof options.checkUpload === 'function') {
            console.log('🚀 [SharedIntegration] 準備呼叫 checkUpload');
            options.checkUpload(studentIndex);
          } else {
            console.warn('⚠️ [SharedIntegration] checkUpload 回調不存在');
          }
        },
        onError: function(error, file) {
          console.error('❌ [SharedIntegration] 處理失敗:', file ? file.name : 'unknown', error);
          if (file && file.__pendingMeta) {
            file.__pendingMeta.state = 'failed';
            if (global.PendingMediaStore) {
              global.PendingMediaStore.update(file.__pendingMeta.tempId, { state: 'failed', error: error && error.message });
            }
            if (global.PendingMediaActions) {
              global.PendingMediaActions.updateState(file.__pendingMeta.tempId, 'failed', (error && error.message) || '處理失敗');
            }
          }
        }
      });
      
      return processedFiles;
      
    } catch (error) {
      console.error('❌ [SharedIntegration] handleStudentMediaSelect 失敗:', error);
      throw error;
    }
  }

  /**
   * 處理課程總覽照片/影片選擇（混合模式）
   * 
   * @param {Object} options - 配置選項
   * @param {FileList|File[]} options.files - 檔案列表
   * @param {string|Element} options.previewContainer - 預覽容器
   * @param {Function} options.onRemovePhoto - 刪除照片回調
   * @param {Function} options.onRemoveVideo - 刪除影片回調
   * @param {Function} options.scheduleAutoSave - 自動儲存回調
   * 
   * @returns {Promise<void>}
   */
  async function handleOverviewMediaSelect(options) {
    try {
      var files = Array.isArray(options.files)
        ? options.files
        : Array.prototype.slice.call(options.files);
      var previewContainer = options.previewContainer;
      
      console.log('🎯 [SharedIntegration] 處理課程總覽媒體:', files.length, '個檔案');
      
      // 🧹 清除現有預覽
      Previewer.cleanupPreviews(previewContainer);
      
      if (!files.length) {
        console.log('✅ [SharedIntegration] 沒有檔案，預覽已清空');
        return;
      }
      
      // 🔧 先以與學生頁相同的流程處理檔案（照片壓縮、影片直傳）
      var processed = await Uploader.processFiles({
        files: files,
        type: 'mixed', // 同時包含 image/video
        compress: true, // 照片預壓縮（與學生頁一致）
        onProgress: function(current, total, file){
          console.log('📦 [' + current + '/' + total + '] 準備預覽:', file && file.name);
        }
      });

      // 將結果拆分為 images/videos（供呼叫者更新全域）
      var images = processed.filter(function(f){ return /^image\//i.test(f.type || ''); });
      var videos = processed.filter(function(f){ return /^video\//i.test(f.type || ''); });
      if (typeof options.onProcessed === 'function') {
        try { options.onProcessed({ images: images, videos: videos, all: processed }); } catch (e) {}
      }

      // 🎨 渲染預覽（課程總覽關閉旋轉 spinner，顯示 overlay 進度）
      Previewer.renderPreviews({
        container: previewContainer,
        files: processed,
        clearExisting: true,
        config: { disableSpinner: true },
        onRemove: function(index, isImage) {
          if (isImage && typeof options.onRemovePhoto === 'function') {
            options.onRemovePhoto(index);
          } else if (!isImage && typeof options.onRemoveVideo === 'function') {
            options.onRemoveVideo(index);
          }
        },
        onClick: function(file, index, element) {
          console.log('🖱️ [SharedIntegration] 點擊預覽:', file.name);
        }
      });
      markLocalPreviewNodes(previewContainer);

      // 🔥 [統一 2025-11-19] 為課程總覽預覽設置 data-file-id
      // 確保統一的刪除按鈕綁定機制（ensureDeleteButtonWorks）可用
      try {
        var host = (typeof previewContainer === 'string')
          ? document.getElementById(previewContainer) || document.querySelector(previewContainer)
          : previewContainer;
        
        if (host) {
          var allPreviews = host.querySelectorAll('.file-preview');
          console.log('🔧 [SharedIntegration-Overview] 設置 data-file-id:', allPreviews.length, '個預覽');
          
          var photoIndex = 0;
          var videoIndex = 0;
          
          allPreviews.forEach(function(preview) {
            if (!preview.getAttribute('data-file-id')) {
              var previewType = preview.getAttribute('data-preview-type') || preview.getAttribute('data-file-type');
              var isVideo = previewType === 'video';
              var type = isVideo ? 'videos' : 'photos';
              var index = isVideo ? videoIndex++ : photoIndex++;
              var fileId = 'file-overview-' + type + '-' + index;
              
              preview.setAttribute('data-file-id', fileId);
              console.log('✅ [SharedIntegration-Overview] 設置:', fileId);
            }
          });
          
          // 🔥 [修復時序 2025-11-19] 設置完 data-file-id 後，再次調用統一綁定
          // 因為 renderPreviews 中的統一綁定執行時 data-file-id 還不存在
          if (typeof window.ensureDeleteButtonWorks === 'function') {
            console.log('🔧 [SharedIntegration-Overview] 重新綁定刪除按鈕（時序修復）');
            allPreviews.forEach(function(preview) {
              if (preview.getAttribute('data-file-id')) {
                window.ensureDeleteButtonWorks(preview);
              }
            });
            console.log('✅ [SharedIntegration-Overview] 刪除按鈕已重新綁定');
          }
        }
      } catch (idErr) {
        console.warn('⚠️ [SharedIntegration-Overview] 設置 data-file-id 失敗:', idErr);
      }

      // 📊 立即刷新頂部進度條（文字/媒體變更即時反映）
      try { if (typeof window.refreshProgress === 'function') window.refreshProgress(); } catch (e) {}

      // 🔥 [簡化 2025-11-23] 已從源頭刪除 .thumb-loading 創建邏輯，不再需要移除殘留 spinner
      // 直接設置預覽初始狀態
      try {
        var host = (typeof previewContainer === 'string')
          ? document.getElementById(previewContainer) || document.querySelector(previewContainer)
          : previewContainer;
        if (host) {
          var previews = host.querySelectorAll('.file-preview');
          previews.forEach(function(node){
            try {
              if (window.SharedPreviewRenderer) {
                window.SharedPreviewRenderer.ensureOverlay(node);
                window.SharedPreviewRenderer.setProgress(node, 0, '等待上傳');
              }
            } catch (e) {}
          });
        }
      } catch (e) {}

      
      // 📤 觸發自動儲存（延遲 600ms，避免無條件即刻同步）
      if (typeof options.scheduleAutoSave === 'function') {
        setTimeout(function(){
          try { options.scheduleAutoSave(600); } catch (_) {}
        }, 0);
      }
      
      console.log('✅ [SharedIntegration] 課程總覽預覽渲染完成');
      
    } catch (error) {
      console.error('❌ [SharedIntegration] handleOverviewMediaSelect 失敗:', error);
      throw error;
    }
  }

  /**
   * 渲染學生檔案預覽
   * 
   * @param {Object} options - 配置選項
   * @param {number} options.studentIndex - 學生索引
   * @param {string} options.type - 類型：'photos' 或 'videos'
   * @param {File[]} options.files - 檔案列表
   * @param {string|Element} options.container - 預覽容器
   * @param {Function} options.onRemove - 刪除回調
   */
  function renderStudentPreviews(options) {
    try {
      var studentIndex = options.studentIndex;
      var type = options.type;
      var files = options.files || [];
      var container = options.container;
      
      console.log('🎨 [SharedIntegration] 渲染學生預覽:', studentIndex, type, files.length, '個檔案');
      
      // 🎨 使用共用預覽器渲染（增量模式，不清除已上傳的預覽）
      Previewer.renderPreviews({
        container: container,
        files: files,
        clearExisting: false, // 🔥 [修復] 改用增量模式，避免清除已上傳的預覽
        onRemove: function(index, isImage) {
          if (typeof options.onRemove === 'function') {
            options.onRemove(index, type);
          }
        },
        onClick: function(file, index, element) {
          console.log('🖱️ [SharedIntegration] 點擊預覽:', file.name);
          // 可以在這裡添加全螢幕預覽邏輯
        }
      });
      markLocalPreviewNodes(container);
      
      // 🔥 [修復 2025-11-17] 確保刪除按鈕事件有效
      setTimeout(function() {
        try {
          console.log('🔍 [SharedIntegration] 開始驗證刪除按鈕... 容器:', container);
          var allPreviews = container.querySelectorAll('.file-preview');
          console.log('🔍 [SharedIntegration] 找到', allPreviews.length, '個預覽節點');
          
          for (var i = 0; i < allPreviews.length; i++) {
            var preview = allPreviews[i];
            
            // 確保每個預覽都有正確的 data-file-id
            if (!preview.getAttribute('data-file-id')) {
              var fileIndex = preview.getAttribute('data-file-index');
              if (fileIndex === null || fileIndex === undefined) {
                // 從 id 屬性獲取（格式：preview-image-0 或 preview-video-0）
                var idMatch = preview.id && preview.id.match(/preview-(?:image|video)-(\d+)/);
                if (idMatch) {
                  fileIndex = idMatch[1];
                }
              }
              
              if (fileIndex !== null && fileIndex !== undefined) {
                var fileId = 'file-' + studentIndex + '-' + type + '-' + fileIndex;
                preview.setAttribute('data-file-id', fileId);
                console.log('🔧 [SharedIntegration] 設置 data-file-id:', fileId);
              }
            }
            
            // 確保刪除按鈕事件正確綁定
            var removeBtn = preview.querySelector('.remove-btn');
            if (removeBtn) {
              // 如果有全域的 ensureDeleteButtonWorks，使用它
              if (typeof window.ensureDeleteButtonWorks === 'function') {
                window.ensureDeleteButtonWorks(preview);
                console.log('✅ [SharedIntegration] 使用 ensureDeleteButtonWorks 綁定刪除按鈕');
              } else {
                console.warn('⚠️ [SharedIntegration] ensureDeleteButtonWorks 不存在');
              }
            }
          }
          console.log('✅ [SharedIntegration] 刪除按鈕驗證完成');
        } catch (e) {
          console.error('❌ [SharedIntegration] 刪除按鈕驗證失敗:', e);
        }
      }, 100); // 延遲確保 DOM 就緒
      
    } catch (error) {
      console.error('❌ [SharedIntegration] renderStudentPreviews 失敗:', error);
    }
  }

  // ==================== 導出模組 ====================
  
  var SharedIntegration = {
    handleStudentMediaSelect: handleStudentMediaSelect,
    handleOverviewMediaSelect: handleOverviewMediaSelect,
    renderStudentPreviews: renderStudentPreviews
  };

  // 掛載到全域
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedIntegration;
  } else {
    global.SharedIntegration = SharedIntegration;
  }

  console.log('✅ [SharedIntegration] 整合層已載入');

})(typeof window !== 'undefined' ? window : this);
