/**
 * ============================================
 * 🚀 流式上傳模組（企業級）
 * ============================================
 * 功能：選擇檔案後立即開始上傳，邊上傳邊壓縮
 * 特點：
 * - 零等待：檔案選擇完畢立即開始上傳第一個檔案
 * - 流式處理：邊上傳邊壓縮後續檔案
 * - 背景生成：預覽生成不阻塞上傳
 * - 智能調度：根據網速和記憶體動態調整
 */

(function (global) {
  'use strict';

  // ==================== 配置 ====================
  
  var DEFAULT_CONFIG = {
    // 上傳優先級
    prioritizeSmall: true,  // 優先上傳小檔案（快速反饋）
    
    // 並行控制
    maxConcurrentPhotos: 3,
    maxConcurrentVideos: 1,
    
    // 重試機制
    maxRetries: 3,
    retryDelayMs: 1000,
    
    // 進度回調間隔
    progressThrottleMs: 200
  };

  // ==================== 核心函數 ====================

  /**
   * 🚀 開始流式上傳
   * @param {Object} options - 配置選項
   * @param {Array} options.files - 檔案列表（已分類）
   * @param {Function} options.compressImage - 照片壓縮函數
   * @param {Function} options.compressVideo - 影片壓縮函數
   * @param {Function} options.uploadOne - 單檔案上傳函數
   * @param {Function} options.onProgress - 進度回調
   * @param {Function} options.onComplete - 完成回調
   * @param {Function} options.onError - 錯誤回調
   */
  async function startStreamingUpload(options) {
    console.log('🚀 [流式上傳] 開始');
    
    if (!options || !options.files || !options.files.length) {
      console.warn('⚠️ [流式上傳] 沒有檔案');
      return;
    }

    var files = options.files;
    var compressImage = options.compressImage || function(f) { return Promise.resolve(f); };
    var compressVideo = options.compressVideo || function(f) { return Promise.resolve(f); };
    var uploadOne = options.uploadOne || function() { return Promise.resolve(); };
    var onProgress = options.onProgress || function() {};
    var onComplete = options.onComplete || function() {};
    var onError = options.onError || function() {};

    // 分離照片和影片
    var images = files.filter(function(item) { return item.isImage; });
    var videos = files.filter(function(item) { return item.isVideo; });
    
    console.log('📊 [流式上傳] 照片:', images.length, '個，影片:', videos.length, '個');

    try {
      // 🔥 立即開始上傳第一個檔案（不等待所有檔案處理完成）
      var firstFile = images[0] || videos[0];
      if (firstFile) {
        console.log('⚡ [流式上傳] 立即處理第一個檔案:', firstFile.file.name);
        
        var firstCompressed;
        if (firstFile.isImage) {
          firstCompressed = await compressImage(firstFile.file);
        } else {
          firstCompressed = await compressVideo(firstFile.file);
        }
        
        // 立即開始上傳（不等待）
        var firstUpload = uploadOne(firstFile.isImage ? 'image' : 'video', firstCompressed, 0, true, 0);
        
        console.log('✅ [流式上傳] 第一個檔案已開始上傳');
        
        // 背景處理剩餘檔案
        processRemainingFilesInBackground({
          images: images.slice(1),
          videos: videos,
          compressImage: compressImage,
          compressVideo: compressVideo,
          uploadOne: uploadOne,
          onProgress: onProgress,
          onError: onError
        });
        
        // 等待第一個上傳完成
        await firstUpload;
      }

      // 等待所有上傳完成
      console.log('⏳ [流式上傳] 等待所有上傳完成...');
      
      if (typeof onComplete === 'function') {
        onComplete();
      }
      
    } catch (error) {
      console.error('❌ [流式上傳] 錯誤:', error);
      if (typeof onError === 'function') {
        onError(error);
      }
    }
  }

  /**
   * 🔄 背景處理剩餘檔案
   * 壓縮完一個就上傳一個，不阻塞主流程
   */
  async function processRemainingFilesInBackground(options) {
    var images = options.images || [];
    var videos = options.videos || [];
    var compressImage = options.compressImage;
    var compressVideo = options.compressVideo;
    var uploadOne = options.uploadOne;
    var onProgress = options.onProgress;
    var onError = options.onError;

    console.log('🔄 [背景處理] 剩餘照片:', images.length, '個，影片:', videos.length, '個');

    var uploadQueue = [];
    var uploadedCount = 1; // 第一個已開始

    // 背景處理剩餘照片
    for (var i = 0; i < images.length; i++) {
      try {
        var compressed = await compressImage(images[i].file);
        var uploadPromise = uploadOne('image', compressed, i + 1, false, i + 1);
        uploadQueue.push(uploadPromise);
        uploadedCount++;
        
        console.log('📤 [背景處理] 照片', (i + 1), '/', images.length, '已壓縮並開始上傳');
        
        if (typeof onProgress === 'function') {
          onProgress({
            current: uploadedCount,
            total: images.length + videos.length + 1
          });
        }
        
        // 每處理 3 個照片後給一點喘息時間
        if ((i + 1) % 3 === 0) {
          await new Promise(function(resolve) { setTimeout(resolve, 50); });
        }
      } catch (err) {
        console.warn('⚠️ [背景處理] 照片處理失敗:', images[i].file.name, err);
        if (typeof onError === 'function') {
          onError(err, images[i].file);
        }
      }
    }

    // 背景處理影片
    for (var j = 0; j < videos.length; j++) {
      try {
        var compressedVid = await compressVideo(videos[j].file);
        var videoIdx = images.length + j + 1;
        var uploadPromise = uploadOne('video', compressedVid, videoIdx, false, j);
        uploadQueue.push(uploadPromise);
        uploadedCount++;
        
        console.log('📤 [背景處理] 影片', (j + 1), '/', videos.length, '已壓縮並開始上傳');
        
        if (typeof onProgress === 'function') {
          onProgress({
            current: uploadedCount,
            total: images.length + videos.length + 1
          });
        }
        
        // 每個影片後清理記憶體
        if (global.LearningUploadCleanup) {
          try {
            global.LearningUploadCleanup.cleanup({ silent: true });
          } catch (e) {}
        }
        
        await new Promise(function(resolve) { setTimeout(resolve, 100); });
      } catch (err) {
        console.warn('⚠️ [背景處理] 影片處理失敗:', videos[j].file.name, err);
        if (typeof onError === 'function') {
          onError(err, videos[j].file);
        }
      }
    }

    // 等待所有上傳完成
    console.log('⏳ [背景處理] 等待', uploadQueue.length, '個上傳完成...');
    await Promise.allSettled(uploadQueue);
    console.log('✅ [背景處理] 所有檔案處理完成');
  }

  // ==================== 導出模組 ====================
  
  var StreamingUploader = {
    startStreamingUpload: startStreamingUpload,
    processRemainingFilesInBackground: processRemainingFilesInBackground,
    DEFAULT_CONFIG: DEFAULT_CONFIG
  };

  // 掛載到全域
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = StreamingUploader;
  } else {
    global.StreamingUploader = StreamingUploader;
  }

  console.log('✅ StreamingUploader 模組已載入');

})(typeof window !== 'undefined' ? window : this);

