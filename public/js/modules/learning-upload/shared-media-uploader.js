/**
 * ============================================
 * 共用媒體上傳器模組
 * ============================================
 * 功能：統一處理照片/影片的選擇、驗證、壓縮和處理
 * 使用場景：學生頁面、課程總覽、抽屜
 */

(function (global) {
  'use strict';

  // ==================== 配置 ====================
  var DEFAULT_CONFIG = {
    // 檔案類型限制
    allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'],
    allowedVideoTypes: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
    
    // 檔案大小限制
    maxFileSizeMB: 100,
    fileSizeWarningMB: 50,
    fileSizeConfirmMB: 200,
    
    // 處理配置
    batchSize: 5,
    batchSizeLowEnd: 3,
    delayBetweenBatches: 50,
    
    // 壓縮配置
    compression: {
      enabled: true,
      minSizeMB: 0.5,
      maxDimension: 1600,
      quality: 0.78,
      largeFileMaxDim: 1400,
      largeFileQuality: 0.72
    }
  };

  // ==================== 工具函數 ====================
  
  /**
   * 檢查網路狀況
   */
  function getConnectionProfile() {
    try {
      var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection || {};
      var et = String(c.effectiveType || '').toLowerCase();
      var down = Number(c.downlink || 0);
      var save = !!c.saveData;
      var slow = save || et.indexOf('2g') !== -1 || et.indexOf('3g') !== -1 || (down > 0 && down < 1.5);
      var fast = !slow && (et.indexOf('4g') !== -1 || down >= 5);
      return { 
        effectiveType: et, 
        downlink: down, 
        saveData: save, 
        slow: slow, 
        fast: fast 
      };
    } catch (e) { 
      return { 
        effectiveType: 'unknown', 
        downlink: 0, 
        saveData: false, 
        slow: false, 
        fast: true 
      }; 
    }
  }

  /**
   * 檢查記憶體壓力
   */
  function checkMemoryPressure() {
    if (typeof window.checkMemoryPressure === 'function') {
      return window.checkMemoryPressure();
    }
    if (!performance || !performance.memory) {
      return { level: 'normal', ratio: 0 };
    }
    var usedJSHeapSize = performance.memory.usedJSHeapSize;
    var jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
    var usageRatio = usedJSHeapSize / jsHeapSizeLimit;
    
    if (usageRatio > 0.9) return { level: 'critical', ratio: usageRatio };
    if (usageRatio > 0.7) return { level: 'high', ratio: usageRatio };
    if (usageRatio > 0.5) return { level: 'medium', ratio: usageRatio };
    return { level: 'normal', ratio: usageRatio };
  }

  /**
   * 🎬 影片記憶體評估
   * 影片解碼與處理通常需要 2-3 倍的記憶體空間
   */
  function estimateVideoMemoryUsage(fileSize) {
    return fileSize * 2.5;
  }

  /**
   * 🎬 影片記憶體安全檢查
   * 檢查是否有足夠記憶體來安全處理影片
   */
  function canSafelyProcessVideo(file) {
    if (!file) {
      return { safe: false, level: 'unknown', needCleanup: false };
    }

    var memStatus = checkMemoryPressure();
    var needed = estimateVideoMemoryUsage(file.size);
    
    // 如果沒有 performance.memory API，採保守策略
    if (!performance || !performance.memory) {
      var sizeMB = file.size / (1024 * 1024);
      // 大於 150MB 的影片建議清理
      return {
        safe: sizeMB < 150,
        level: 'unknown',
        needCleanup: sizeMB > 50
      };
    }
    
    var available = performance.memory.jsHeapSizeLimit - performance.memory.usedJSHeapSize;
    
    return {
      safe: available > needed * 1.5,
      level: memStatus.level,
      needCleanup: memStatus.level !== 'normal',
      availableMB: (available / 1024 / 1024).toFixed(0),
      neededMB: (needed / 1024 / 1024).toFixed(0)
    };
  }

  /**
   * 🎬 影片檔案大小分級
   */
  function classifyVideoSize(fileSize) {
    var sizeMB = fileSize / (1024 * 1024);
    
    if (sizeMB < 50) {
      return { category: 'small', label: '小檔案', needSpecialHandling: false };
    } else if (sizeMB < 150) {
      return { category: 'medium', label: '中檔案', needSpecialHandling: true };
    } else {
      return { category: 'large', label: '大檔案', needSpecialHandling: true };
    }
  }

  /**
   * 🎬 上傳前記憶體清理
   * 在處理大影片前主動釋放記憶體
   */
  function cleanupBeforeVideoProcessing() {
    console.log('🧹 [影片處理] 執行上傳前記憶體清理...');
    
    try {
      // 清除 Blob URLs
      if (window.LearningUploadBlobURL && typeof window.LearningUploadBlobURL.cleanup === 'function') {
        window.LearningUploadBlobURL.cleanup();
      }
      
      // 執行記憶體清理模組
      if (window.LearningUploadCleanup && typeof window.LearningUploadCleanup.cleanup === 'function') {
        window.LearningUploadCleanup.cleanup({ silent: true });
      }
      
      // 清除所有隱藏的 canvas 元素（縮圖生成殘留）
      var canvases = document.querySelectorAll('canvas[style*="display: none"], canvas[hidden]');
      canvases.forEach(function(canvas) {
        try {
          var ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          canvas.width = 1;
          canvas.height = 1;
        } catch (e) {}
      });
      
      console.log('✅ [影片處理] 記憶體清理完成');
      return true;
    } catch (error) {
      console.warn('⚠️ [影片處理] 記憶體清理失敗:', error);
      return false;
    }
  }

  /**
   * 壓縮照片
   */
  async function compressImage(file, config) {
    try {
      if (!file || !/^image\//i.test(file.type)) return file;
      
      // 跳過 HEIC/HEIF（無法用 canvas 轉碼）
      if (/heic|heif/i.test(file.type)) {
        console.log('⚠️ [照片壓縮] HEIC 格式不支援瀏覽器壓縮，建議轉換為 JPEG');
        return file;
      }
      
      // 小檔不壓縮
      var sizeMB = (file.size || 0) / (1024 * 1024);
      if (sizeMB <= config.compression.minSizeMB) return file;
      
      // 動態調整目標
      var profile = getConnectionProfile();
      var maxDim = config.compression.maxDimension;
      var quality = config.compression.quality;
      
      if (sizeMB > 4) { 
        maxDim = config.compression.largeFileMaxDim; 
        quality = config.compression.largeFileQuality; 
      }
      if (profile.slow) { 
        maxDim = Math.min(maxDim, 1400); 
        quality = Math.min(quality, 0.72); 
      }
      
      // 使用外部壓縮函數（如果存在）
      if (typeof window.compressImageIfNeeded === 'function') {
        return await window.compressImageIfNeeded(file);
      }
      
      // 簡易壓縮（基於 Canvas）
      return new Promise(function(resolve) {
        var img = new Image();
        // 🔥 使用 BlobURLManager
        var url = window.BlobURLManager ? 
          window.BlobURLManager.createObjectURL(file, { source: 'photo-compress' }) : 
          URL.createObjectURL(file);
        
        img.onload = function() {
          try {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            
            var width = img.width;
            var height = img.height;
            var ratio = Math.min(maxDim / width, maxDim / height, 1);
            
            canvas.width = width * ratio;
            canvas.height = height * ratio;
            
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            
            canvas.toBlob(function(blob) {
              // 🔥 使用 BlobURLManager
              if (window.BlobURLManager) {
                window.BlobURLManager.revokeObjectURL(url);
              } else {
                URL.revokeObjectURL(url);
              }
              if (blob && blob.size < file.size) {
                var compressed = new File([blob], file.name, { type: 'image/jpeg' });
                console.log('✅ [照片壓縮] 原始:', (file.size / 1024 / 1024).toFixed(2), 'MB → 壓縮:', (compressed.size / 1024 / 1024).toFixed(2), 'MB');
                resolve(compressed);
              } else {
                resolve(file);
              }
            }, 'image/jpeg', quality);
          } catch (e) {
            // 🔥 使用 BlobURLManager
            if (window.BlobURLManager) {
              window.BlobURLManager.revokeObjectURL(url);
            } else {
              URL.revokeObjectURL(url);
            }
            console.warn('⚠️ [照片壓縮] 失敗:', e);
            resolve(file);
          }
        };
        
        img.onerror = function() {
          // 🔥 使用 BlobURLManager
          if (window.BlobURLManager) {
            window.BlobURLManager.revokeObjectURL(url);
          } else {
            URL.revokeObjectURL(url);
          }
          resolve(file);
        };
        
        img.src = url;
      });
    } catch (error) {
      console.error('❌ [照片壓縮] 錯誤:', error);
      return file;
    }
  }

  /**
   * 驗證檔案類型
   */
  function validateFileType(file, expectedType, config) {
    if (!file || !file.name) return false;
    
    var fileType = file.type || '';
    var fileName = file.name.toLowerCase();
    
    if (expectedType === 'image') {
      var isImage = config.allowedImageTypes.indexOf(fileType) >= 0 || 
                   /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(fileName);
      return isImage;
    } else if (expectedType === 'video') {
      var isVideo = config.allowedVideoTypes.indexOf(fileType) >= 0 || 
                   /\.(mp4|webm|mov|avi|quicktime)$/i.test(fileName);
      return isVideo;
    } else if (expectedType === 'mixed') {
      // 混合模式：照片或影片都接受
      var isImage = config.allowedImageTypes.indexOf(fileType) >= 0 || 
                   /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(fileName);
      var isVideo = config.allowedVideoTypes.indexOf(fileType) >= 0 || 
                   /\.(mp4|webm|mov|avi|quicktime)$/i.test(fileName);
      return isImage || isVideo;
    }
    
    return false;
  }

  /**
   * 驗證檔案大小
   */
  function validateFileSize(file, config) {
    var maxSize = config.maxFileSizeMB * 1024 * 1024;
    return file.size <= maxSize;
  }

  // ==================== 主要功能 ====================
  
  /**
   * 處理檔案選擇
   * 
   * @param {Object} options - 配置選項
   * @param {FileList|File[]} options.files - 檔案列表
   * @param {string} options.type - 檔案類型：'image', 'video', 'mixed'
   * @param {boolean} options.compress - 是否壓縮照片（預設 true）
   * @param {Function} options.onProgress - 進度回調 (current, total, file)
   * @param {Function} options.onFileProcessed - 單檔處理完成回調 (file, index)
   * @param {Function} options.onComplete - 全部完成回調 (processedFiles)
   * @param {Function} options.onError - 錯誤回調 (error, file)
   * @param {Object} options.config - 自訂配置（覆蓋預設值）
   * 
   * @returns {Promise<Array>} 處理後的檔案列表
   */
  async function processFiles(options) {
    try {
      // 🔒 參數驗證
      if (!options || !options.files) {
        throw new Error('缺少必要參數：files');
      }
      
      var files = Array.isArray(options.files) 
        ? options.files 
        : Array.prototype.slice.call(options.files);
      
      if (!files.length) {
        console.log('⚠️ [processFiles] 沒有檔案需要處理');
        return [];
      }
      
      var type = options.type || 'mixed';
      var compress = options.compress !== false;
      var config = Object.assign({}, DEFAULT_CONFIG, options.config || {});
      
      console.log('🚀 [processFiles] 開始處理', files.length, '個檔案 (類型:', type, ')');
      
      // 🔍 記憶體壓力檢查
      var memoryStatus = checkMemoryPressure();
      if (memoryStatus.level === 'critical') {
        throw new Error('記憶體不足，請關閉其他應用程式後再試');
      }
      
      if (memoryStatus.level === 'high') {
        config.batchSize = Math.min(config.batchSize, config.batchSizeLowEnd);
        console.log('⚠️ [processFiles] 記憶體使用較高，已啟用省記憶體模式（批次大小:', config.batchSize, ')');
      }
      
      // 📋 驗證所有檔案
      var validFiles = [];
      var invalidFiles = [];
      
      files.forEach(function(file) {
        if (!file || !file.name) {
          invalidFiles.push({ file: null, reason: '無效的檔案' });
          return;
        }
        
        // 驗證類型
        if (!validateFileType(file, type, config)) {
          var expectedTypeText = type === 'image' ? '圖片' : (type === 'video' ? '影片' : '圖片或影片');
          invalidFiles.push({ file: file, reason: '非' + expectedTypeText + '格式' });
          return;
        }
        
        // 驗證大小
        if (!validateFileSize(file, config)) {
          invalidFiles.push({ file: file, reason: '檔案過大 (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)' });
          return;
        }
        
        validFiles.push(file);
      });
      
      // 顯示無效檔案警告
      if (invalidFiles.length > 0) {
        console.warn('⚠️ [processFiles] 無效檔案:', invalidFiles.map(function(item) {
          return (item.file ? item.file.name : '無名稱') + ' (' + item.reason + ')';
        }));
        
        if (typeof options.onError === 'function') {
          invalidFiles.forEach(function(item) {
            options.onError(new Error(item.reason), item.file);
          });
        }
      }
      
      if (!validFiles.length) {
        console.warn('⚠️ [processFiles] 沒有有效檔案');
        return [];
      }
      
      // 📊 檔案大小檢查與提示
      var totalSize = validFiles.reduce(function(sum, f) { return sum + f.size; }, 0);
      var totalSizeMB = (totalSize / 1024 / 1024).toFixed(1);
      
      if (totalSize > config.fileSizeConfirmMB * 1024 * 1024) {
        var confirmMsg = '您選擇的檔案總大小為 ' + totalSizeMB + ' MB，處理可能需要較長時間。是否繼續？';
        if (typeof window.confirm === 'function' && !window.confirm(confirmMsg)) {
          console.log('⚠️ [processFiles] 使用者取消處理');
          return [];
        }
      }
      
      // 🎬 分離影片與照片（影片需要特殊處理）
      var videoFiles = [];
      var imageFiles = [];
      
      validFiles.forEach(function(file) {
        var isVideo = /^video\//i.test(file.type) || /\.(mp4|webm|mov|avi|m4v)$/i.test(file.name);
        if (isVideo) {
          videoFiles.push(file);
        } else {
          imageFiles.push(file);
        }
      });
      
      console.log('📊 [processFiles] 檔案分類: 照片', imageFiles.length, '個，影片', videoFiles.length, '個');
      
      // 🚀 流式處理檔案
      var processedFiles = [];
      var processedCount = 0;
      var totalFiles = validFiles.length;
      
      for (var i = 0; i < validFiles.length; i++) {
        try {
          var file = validFiles[i];
          var fileName = file.name || ('file-' + i);
          var isVideo = /^video\//i.test(file.type) || /\.(mp4|webm|mov|avi|m4v)$/i.test(file.name);
          
          console.log('📦 [' + (i + 1) + '/' + totalFiles + '] 處理:', fileName);
          
          // 🎬 影片專用處理
          if (isVideo) {
            var videoClass = classifyVideoSize(file.size);
            console.log('🎬 [影片處理] 檔案大小分級:', videoClass.label, '(' + (file.size / 1024 / 1024).toFixed(1) + ' MB)');
            
            // 記憶體安全檢查
            var safetyCheck = canSafelyProcessVideo(file);
            console.log('🔍 [影片處理] 記憶體檢查:', safetyCheck);
            
            // 如果需要清理，先執行清理
            if (safetyCheck.needCleanup || videoClass.needSpecialHandling) {
              cleanupBeforeVideoProcessing();
              
              // 清理後等待一下讓瀏覽器回收記憶體
              await new Promise(function(resolve) { setTimeout(resolve, 300); });
            }
            
            // 記憶體嚴重不足，跳過該檔案並警告
            if (!safetyCheck.safe && safetyCheck.level === 'critical') {
              var errorMsg = '記憶體不足，無法處理此影片 (' + (file.size / 1024 / 1024).toFixed(1) + ' MB)。建議：\n1. 關閉其他應用程式\n2. 單獨上傳此影片\n3. 使用電腦上傳';
              console.error('❌ [影片處理]', errorMsg);
              
              if (typeof options.onError === 'function') {
                options.onError(new Error(errorMsg), file);
              }
              
              // 跳過此檔案
              continue;
            }
          }
          
          // 進度回調
          if (typeof options.onProgress === 'function') {
            options.onProgress(i + 1, totalFiles, file);
          }
          
          // 處理單個檔案
          var processedFile = file;
          
          // 壓縮照片（如果需要）
          if (compress && !isVideo && /^image\//i.test(file.type)) {
            try {
              processedFile = await compressImage(file, config);
            } catch (compressErr) {
              console.warn('⚠️ [processFiles] 壓縮失敗，使用原檔案:', fileName, compressErr);
              processedFile = file;
            }
          }

          if (file.__pendingMeta) {
            processedFile.__pendingMeta = Object.assign({}, file.__pendingMeta);
          }
          
          processedFiles.push(processedFile);
          processedCount++;
          
          // 單檔處理完成回調
          if (typeof options.onFileProcessed === 'function') {
            options.onFileProcessed(processedFile, i);
          }
          
          // 🧹 批次間清理記憶體
          // 影片：每個影片後都清理
          // 照片：每 5 個檔案清理一次
          var shouldCleanup = isVideo || ((i + 1) % 5 === 0);
          
          if (shouldCleanup && i < validFiles.length - 1) {
            if (window.LearningUploadCleanup) {
              try {
                window.LearningUploadCleanup.cleanup({ silent: true });
              } catch (cleanupErr) {}
            }
            // 影片處理後給更多喘息時間
            var delay = isVideo ? 500 : config.delayBetweenBatches;
            await new Promise(function(resolve) { setTimeout(resolve, delay); });
          }
          
        } catch (fileErr) {
          console.error('❌ [processFiles] 處理檔案失敗:', validFiles[i].name, fileErr);
          
          // 失敗也要加入（使用原檔案），不中斷流程
          processedFiles.push(validFiles[i]);
          processedCount++;
          
          // 錯誤回調
          if (typeof options.onError === 'function') {
            options.onError(fileErr, validFiles[i]);
          }
        }
      }
      
      console.log('✅ [processFiles] 流式處理完成，共處理', processedCount, '個檔案');
      
      // 全部完成回調
      if (typeof options.onComplete === 'function') {
        options.onComplete(processedFiles);
      }
      
      return processedFiles;
      
    } catch (error) {
      console.error('❌ [processFiles] 處理檔案時發生錯誤:', error);
      if (typeof options.onError === 'function') {
        options.onError(error, null);
      }
      throw error;
    }
  }

  // ==================== 導出模組 ====================
  
  var SharedMediaUploader = {
    processFiles: processFiles,
    compressImage: compressImage,
    validateFileType: validateFileType,
    validateFileSize: validateFileSize,
    checkMemoryPressure: checkMemoryPressure,
    getConnectionProfile: getConnectionProfile,
    // 🎬 影片專用函數
    estimateVideoMemoryUsage: estimateVideoMemoryUsage,
    canSafelyProcessVideo: canSafelyProcessVideo,
    classifyVideoSize: classifyVideoSize,
    cleanupBeforeVideoProcessing: cleanupBeforeVideoProcessing,
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };

  // 掛載到全域
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SharedMediaUploader;
  } else {
    global.SharedMediaUploader = SharedMediaUploader;
  }

})(typeof window !== 'undefined' ? window : this);
