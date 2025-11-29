/**
 * 照片上傳問題診斷工具
 * 在瀏覽器控制台中運行此腳本
 */

(function() {
  'use strict';
  
  window.PhotoUploadDebugger = {
    /**
     * 檢查學生的照片狀態
     */
    checkPhotoState: function(studentIndex) {
      console.log('='.repeat(60));
      console.log('📸 學生', studentIndex, '照片狀態檢查');
      console.log('='.repeat(60));
      
      // 1. 檢查 studentFiles 陣列
      if (typeof studentFiles === 'undefined') {
        console.error('❌ studentFiles 未定義');
        return;
      }
      
      var entry = studentFiles[studentIndex];
      if (!entry) {
        console.error('❌ studentFiles[' + studentIndex + '] 不存在');
        return;
      }
      
      console.log('📦 記憶體中的照片數量:', entry.photos ? entry.photos.length : 0);
      console.log('📦 記憶體中的影片數量:', entry.videos ? entry.videos.length : 0);
      
      if (entry.photos && entry.photos.length > 0) {
        console.log('📋 照片列表:');
        entry.photos.forEach(function(photo, idx) {
          if (photo instanceof File) {
            console.log('  [' + idx + '] File:', photo.name, '(' + (photo.size / 1024).toFixed(2) + ' KB)');
          } else {
            console.log('  [' + idx + '] 物件:', photo);
          }
        });
      }
      
      // 2. 檢查 DOM 預覽容器
      var photosContainer = document.getElementById('photos-preview-' + studentIndex);
      if (!photosContainer) {
        console.error('❌ 照片預覽容器不存在: photos-preview-' + studentIndex);
        return;
      }
      
      console.log('\n🖼️ DOM 預覽容器狀態:');
      console.log('  總預覽數:', photosContainer.children.length);
      
      var existing = photosContainer.querySelectorAll('.file-preview.existing, .file-preview.loaded');
      var newUpload = photosContainer.querySelectorAll('.file-preview.new-upload');
      
      console.log('  已上傳預覽:', existing.length, '個');
      console.log('  新上傳預覽:', newUpload.length, '個');
      
      // 3. 詳細列出每個預覽
      var allPreviews = photosContainer.querySelectorAll('.file-preview');
      if (allPreviews.length > 0) {
        console.log('\n📋 預覽節點詳情:');
        allPreviews.forEach(function(preview, idx) {
          var type = preview.classList.contains('existing') || preview.classList.contains('loaded') ? '已上傳' : '新上傳';
          var url = preview.getAttribute('data-preview-url') || preview.getAttribute('data-object-url') || 'N/A';
          var filename = preview.getAttribute('data-filename') || 'N/A';
          console.log('  [' + idx + '] ' + type + ':', filename);
          console.log('       URL:', url.substring(0, 60) + '...');
        });
      }
      
      // 4. 檢查是否有重複
      var urls = [];
      var duplicates = [];
      allPreviews.forEach(function(preview) {
        var url = preview.getAttribute('data-preview-url');
        if (url) {
          if (urls.indexOf(url) !== -1) {
            duplicates.push(url);
          } else {
            urls.push(url);
          }
        }
      });
      
      if (duplicates.length > 0) {
        console.warn('\n⚠️ 發現重複預覽:', duplicates.length, '個');
      }
      
      // 5. 檢查 Blob URL 洩漏
      var blobUrls = [];
      allPreviews.forEach(function(preview) {
        var url = preview.getAttribute('data-object-url') || preview.getAttribute('data-blob-url');
        if (url && url.startsWith('blob:')) {
          blobUrls.push(url);
        }
      });
      
      console.log('\n🔗 Blob URL 數量:', blobUrls.length);
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ 檢查完成');
      console.log('='.repeat(60));
      
      return {
        memory: {
          photos: entry.photos ? entry.photos.length : 0,
          videos: entry.videos ? entry.videos.length : 0
        },
        dom: {
          total: photosContainer.children.length,
          existing: existing.length,
          newUpload: newUpload.length,
          duplicates: duplicates.length,
          blobUrls: blobUrls.length
        }
      };
    },
    
    /**
     * 啟用詳細日誌模式
     */
    enableVerboseLogging: function() {
      window.DEBUG_PREVIEW = true;
      console.log('✅ 已啟用詳細日誌模式');
      console.log('現在請重新選擇照片，觀察日誌輸出');
    },
    
    /**
     * 監聽 renderPreviews 調用
     */
    watchRenderPreviews: function() {
      if (!window.SharedMediaPreviewer) {
        console.error('❌ SharedMediaPreviewer 未載入');
        return;
      }
      
      var original = window.SharedMediaPreviewer.renderPreviews;
      var callCount = 0;
      
      window.SharedMediaPreviewer.renderPreviews = function(options) {
        callCount++;
        console.log('\n🎨 [renderPreviews 調用 #' + callCount + ']');
        console.log('  容器:', options.container);
        console.log('  檔案數:', options.files ? options.files.length : 0);
        console.log('  clearExisting:', options.clearExisting);
        console.log('  調用堆疊:', new Error().stack.split('\n').slice(2, 5).join('\n'));
        
        var result = original.apply(this, arguments);
        
        console.log('  ✅ 渲染完成，返回', result.length, '個元素');
        
        return result;
      };
      
      console.log('✅ 已開始監聽 renderPreviews');
      console.log('現在請重新選擇照片，觀察調用情況');
    },
    
    /**
     * 重置監聽
     */
    resetWatch: function() {
      location.reload();
    }
  };
  
  console.log('✅ 照片上傳診斷工具已載入');
  console.log('');
  console.log('使用方法：');
  console.log('  PhotoUploadDebugger.checkPhotoState(0)     - 檢查學生 0 的照片狀態');
  console.log('  PhotoUploadDebugger.enableVerboseLogging() - 啟用詳細日誌');
  console.log('  PhotoUploadDebugger.watchRenderPreviews()  - 監聽渲染調用');
  console.log('');
  console.log('建議操作流程：');
  console.log('  1. 啟用監聽: PhotoUploadDebugger.watchRenderPreviews()');
  console.log('  2. 選擇 3 張照片');
  console.log('  3. 檢查狀態: PhotoUploadDebugger.checkPhotoState(0)');
  console.log('');
})();

