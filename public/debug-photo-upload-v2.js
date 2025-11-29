/**
 * 照片上傳問題診斷工具 v2
 * 修正變數名稱，增強診斷功能
 */

(function() {
  'use strict';
  
  window.PhotoUploadDebugger = {
    /**
     * 檢查學生的照片狀態（修正版）
     */
    checkPhotoState: function(studentIndex) {
      console.log('='.repeat(60));
      console.log('📸 學生', studentIndex, '照片狀態檢查');
      console.log('='.repeat(60));
      
      // 1. 檢查 FLB.State（伺服器記錄）
      var state = null;
      var student = null;
      var uploaded = null;
      
      try {
        if (window.FLB && FLB.State) {
          state = FLB.State.get();
          if (state && Array.isArray(state.students)) {
            student = state.students[studentIndex];
            if (student) {
              uploaded = student.uploaded;
            }
          }
        }
      } catch (e) {
        console.error('❌ 讀取 FLB.State 失敗:', e);
      }
      
      if (!student) {
        console.error('❌ 找不到學生', studentIndex);
        return null;
      }
      
      console.log('\n📦 伺服器記錄 (FLB.State.students[' + studentIndex + '].uploaded):');
      if (uploaded) {
        var newPhotos = uploaded.newMediaPhotos || [];
        var oldPhotos = (uploaded.files && uploaded.files.photos) || [];
        
        console.log('  新系統照片 (newMediaPhotos):', newPhotos.length, '張');
        if (newPhotos.length > 0) {
          newPhotos.forEach(function(photo, idx) {
            console.log('    [' + idx + ']', photo.id, '-', photo.originalName || photo.filename);
            console.log('        狀態:', photo.status || 'unknown');
            console.log('        上傳時間:', photo.uploadedAt || 'unknown');
          });
        }
        
        console.log('  舊系統照片 (files.photos):', oldPhotos.length, '張');
        if (oldPhotos.length > 0) {
          oldPhotos.forEach(function(photo, idx) {
            console.log('    [' + idx + ']', photo);
          });
        }
      } else {
        console.log('  ⚠️ 沒有上傳記錄');
      }
      
      // 2. 檢查 studentFiles（本地待上傳）
      console.log('\n💾 本地待上傳 (studentFiles[' + studentIndex + ']):');
      if (typeof studentFiles !== 'undefined' && studentFiles[studentIndex]) {
        var entry = studentFiles[studentIndex];
        console.log('  待上傳照片:', entry.photos ? entry.photos.length : 0, '張');
        console.log('  待上傳影片:', entry.videos ? entry.videos.length : 0, '張');
        
        if (entry.photos && entry.photos.length > 0) {
          entry.photos.forEach(function(photo, idx) {
            if (photo instanceof File) {
              console.log('    [' + idx + '] File:', photo.name, '(' + (photo.size / 1024 / 1024).toFixed(2) + ' MB)');
            } else {
              console.log('    [' + idx + '] 物件:', photo);
            }
          });
        }
      } else {
        console.log('  ⚠️ studentFiles 未定義或沒有此學生的資料');
      }
      
      // 3. 檢查 DOM 預覽容器
      console.log('\n🖼️ DOM 預覽容器:');
      var photosContainer = document.getElementById('photos-preview-' + studentIndex);
      if (!photosContainer) {
        console.error('  ❌ 照片預覽容器不存在: photos-preview-' + studentIndex);
        return null;
      }
      
      var allPreviews = photosContainer.querySelectorAll('.file-preview');
      var existing = photosContainer.querySelectorAll('.file-preview.existing, .file-preview.loaded');
      var newUpload = photosContainer.querySelectorAll('.file-preview.new-upload');
      var loading = photosContainer.querySelectorAll('.file-preview.loading');
      
      console.log('  總預覽數:', allPreviews.length);
      console.log('  已上傳預覽:', existing.length, '個');
      console.log('  新上傳預覽:', newUpload.length, '個');
      console.log('  載入中預覽:', loading.length, '個');
      
      // 4. 詳細列出每個預覽
      if (allPreviews.length > 0) {
        console.log('\n📋 預覽節點詳情:');
        allPreviews.forEach(function(preview, idx) {
          var classes = Array.prototype.slice.call(preview.classList).join(', ');
          var type = preview.classList.contains('existing') || preview.classList.contains('loaded') ? '已上傳' : '新上傳';
          var isLoading = preview.classList.contains('loading') ? ' (載入中)' : '';
          var url = preview.getAttribute('data-preview-url') || preview.getAttribute('data-object-url') || 'N/A';
          var filename = preview.getAttribute('data-filename') || 'N/A';
          var fileId = preview.getAttribute('data-file-id') || 'N/A';
          
          console.log('  [' + idx + '] ' + type + isLoading);
          console.log('       Class:', classes);
          console.log('       File ID:', fileId);
          console.log('       Filename:', filename);
          console.log('       URL:', url.substring(0, 60) + '...');
        });
      }
      
      console.log('\n' + '='.repeat(60));
      console.log('✅ 檢查完成');
      console.log('='.repeat(60));
      
      return {
        server: {
          newPhotos: uploaded && uploaded.newMediaPhotos ? uploaded.newMediaPhotos.length : 0,
          oldPhotos: uploaded && uploaded.files && uploaded.files.photos ? uploaded.files.photos.length : 0
        },
        local: {
          photos: (typeof studentFiles !== 'undefined' && studentFiles[studentIndex]) ? 
                  (studentFiles[studentIndex].photos || []).length : 0
        },
        dom: {
          total: allPreviews.length,
          existing: existing.length,
          newUpload: newUpload.length,
          loading: loading.length
        }
      };
    },
    
    /**
     * 檢查上傳狀態
     */
    checkUploadStatus: function(studentIndex) {
      console.log('='.repeat(60));
      console.log('🔍 檢查上傳狀態');
      console.log('='.repeat(60));
      
      // 檢查是否有正在上傳的檔案
      if (typeof UploadCenter !== 'undefined') {
        console.log('✅ UploadCenter 可用');
        // 可以添加更多 UploadCenter 的檢查
      } else {
        console.warn('⚠️ UploadCenter 未定義');
      }
      
      // 檢查是否有失敗的上傳
      var photosContainer = document.getElementById('photos-preview-' + studentIndex);
      if (photosContainer) {
        var failedPreviews = photosContainer.querySelectorAll('.file-preview.error, .file-preview.failed');
        console.log('❌ 失敗的預覽:', failedPreviews.length, '個');
        
        var loadingPreviews = photosContainer.querySelectorAll('.file-preview.loading');
        console.log('⏳ 載入中的預覽:', loadingPreviews.length, '個');
      }
      
      console.log('='.repeat(60));
    },
    
    /**
     * 啟用上傳日誌監聽
     */
    watchUploads: function() {
      console.log('👁️ 開始監聽上傳過程...');
      
      // 攔截 console.log，過濾上傳相關訊息
      var originalLog = console.log;
      var uploadLogs = [];
      
      console.log = function() {
        var msg = Array.prototype.slice.call(arguments).join(' ');
        
        // 過濾上傳相關訊息
        if (msg.indexOf('照片上傳') >= 0 || 
            msg.indexOf('添加到列表') >= 0 ||
            msg.indexOf('上傳成功') >= 0 ||
            msg.indexOf('上傳失敗') >= 0 ||
            msg.indexOf('newMediaPhotos') >= 0) {
          uploadLogs.push({
            time: new Date().toISOString(),
            message: msg
          });
        }
        
        originalLog.apply(console, arguments);
      };
      
      // 5 秒後顯示摘要
      setTimeout(function() {
        console.log = originalLog;
        console.log('\n' + '='.repeat(60));
        console.log('📊 上傳日誌摘要 (最近 5 秒):');
        console.log('='.repeat(60));
        uploadLogs.forEach(function(log) {
          console.log('[' + log.time.substring(11, 19) + ']', log.message);
        });
        console.log('='.repeat(60));
      }, 5000);
      
      console.log('✅ 監聽已啟動，5 秒後顯示摘要');
      console.log('現在請上傳照片...');
    },
    
    /**
     * 完整診斷流程
     */
    runFullDiagnostic: function(studentIndex) {
      console.log('🚀 開始完整診斷...\n');
      
      var result = this.checkPhotoState(studentIndex);
      console.log('\n');
      this.checkUploadStatus(studentIndex);
      
      console.log('\n📝 診斷建議:');
      
      if (result) {
        if (result.dom.loading > 0) {
          console.log('⚠️ 有', result.dom.loading, '個預覽仍在載入中，請等待上傳完成');
        }
        
        if (result.dom.newUpload > result.server.newPhotos) {
          console.log('⚠️ DOM 中有', result.dom.newUpload, '個新預覽，但伺服器只有', result.server.newPhotos, '張照片');
          console.log('   可能原因：上傳失敗或正在進行中');
          console.log('   建議：查看控制台是否有錯誤訊息，或使用 watchUploads() 監聽');
        }
        
        if (result.server.newPhotos === 0 && result.local.photos > 0) {
          console.log('💡 本地有', result.local.photos, '張待上傳照片，但伺服器沒有記錄');
          console.log('   建議：檢查是否已按下上傳按鈕');
        }
        
        if (result.server.newPhotos > 0 && result.dom.existing === 0) {
          console.log('⚠️ 伺服器有', result.server.newPhotos, '張照片，但 DOM 沒有顯示');
          console.log('   建議：重新整理頁面');
        }
      }
      
      console.log('\n✅ 診斷完成');
    }
  };
  
  console.log('✅ 照片上傳診斷工具 v2 已載入');
  console.log('');
  console.log('使用方法：');
  console.log('  PhotoUploadDebugger.checkPhotoState(0)      - 檢查學生 0 的照片狀態');
  console.log('  PhotoUploadDebugger.checkUploadStatus(0)    - 檢查上傳狀態');
  console.log('  PhotoUploadDebugger.watchUploads()          - 監聽上傳過程（5秒）');
  console.log('  PhotoUploadDebugger.runFullDiagnostic(0)    - 完整診斷');
  console.log('');
})();

