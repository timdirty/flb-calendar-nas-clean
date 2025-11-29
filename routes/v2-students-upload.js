const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const courseNameCleaner = require('../utils/course-name-cleaner');
const { photoQueueManager } = require('../services/media/photo-queue-manager');

// 配置 multer 用於檔案上傳
const upload = multer({ 
  dest: 'temp/',
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  }
});

/**
 * POST /api/v2/students/upload
 * V2 學生檔案上傳 API（整合照片處理管道）
 */
router.post('/students/upload', upload.fields([
  { name: 'photos', maxCount: 50 },
  { name: 'videos', maxCount: 20 }
]), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { 
      semester, 
      courseName, 
      date, 
      studentName, 
      topic = '',
      comment = '' 
    } = req.body;

    console.log('📤 [V2 Upload] 學生檔案上傳開始:', {
      semester,
      courseName,
      date,
      studentName,
      topic,
      hasPhotos: !!(req.files && req.files.photos),
      hasVideos: !!(req.files && req.files.videos)
    });

    // 驗證必要欄位
    if (!semester || !courseName || !date || !studentName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要欄位：semester, courseName, date, studentName'
      });
    }

    // 獲取 learning-upload-helper
    const learningUploadHelper = req.app.get('learningUploadHelper');
    if (!learningUploadHelper) {
      console.error('❌ [V2 Upload] LearningUploadHelper 未初始化');
      return res.status(503).json({
        success: false,
        error: '學習歷程服務未初始化'
      });
    }

    // 清理課程名稱
    const normalizedCourseName = courseNameCleaner.cleanCourseName(courseName);
    const resolvedTopic = learningUploadHelper._resolveTopicInput(topic, normalizedCourseName);

    // 構建基礎路徑
    const basePath = learningUploadHelper.pathManager.buildStudentRecordPath(
      semester,
      normalizedCourseName,
      date,
      resolvedTopic,
      studentName
    );

    console.log('📂 [V2 Upload] 基礎路徑:', basePath);

    // 確保目錄存在
    await learningUploadHelper.driveClient.createFolder(basePath);

    const uploadedFiles = {
      photos: [],
      videos: []
    };

    // 處理照片上傳（整合照片處理管道）
    if (req.files && req.files.photos && req.files.photos.length > 0) {
      console.log(`📸 [V2 Upload] 處理 ${req.files.photos.length} 張照片`);
      
      for (let i = 0; i < req.files.photos.length; i++) {
        const photoFile = req.files.photos[i];
        const photoId = `${studentName}-${Date.now()}-${i}`;
        
        try {
          // 🔥 關鍵修復：使用照片處理管道
          const photoMetaPath = learningUploadHelper.pathManager.getPhotosMetaPath(basePath);
          
          // 將檔案加入照片處理隊列
          await new Promise((resolve, reject) => {
            photoQueueManager.addJob({
              id: photoId,
              filePath: photoFile.path,
              originalName: photoFile.originalname,
              mimeType: photoFile.mimetype || 'image/jpeg',
              outputDir: basePath,
              metaPath: photoMetaPath,
              onComplete: (result) => {
                console.log(`✅ [V2 Upload] 照片處理完成: ${result.originalName}`);
                uploadedFiles.photos.push({
                  id: photoId,
                  filename: result.filename,
                  originalName: result.originalName,
                  url: result.url,
                  size: result.size,
                  uploadedAt: new Date().toISOString()
                });
                resolve(result);
              },
              onError: (error) => {
                console.error(`❌ [V2 Upload] 照片處理失敗: ${photoFile.originalname}`, error);
                // 即使處理失敗，也嘗試直接上傳原始檔案
                learningUploadHelper.driveClient.uploadFile(
                  `${basePath}/${photoFile.originalname}`,
                  fs.createReadStream(photoFile.path),
                  photoFile.mimetype || 'image/jpeg'
                ).then(() => {
                  uploadedFiles.photos.push({
                    id: photoId,
                    filename: photoFile.originalname,
                    originalName: photoFile.originalname,
                    url: `/api/drive-media${basePath}/${photoFile.originalname}`,
                    size: photoFile.size,
                    uploadedAt: new Date().toISOString()
                  });
                  resolve();
                }).catch(reject);
              }
            });
          });

        } catch (error) {
          console.error(`❌ [V2 Upload] 照片 ${i + 1} 處理失敗:`, error);
          // 繼續處理其他檔案
        }
      }
    }

    // 處理影片上傳
    if (req.files && req.files.videos && req.files.videos.length > 0) {
      console.log(`🎬 [V2 Upload] 處理 ${req.files.videos.length} 部影片`);
      
      for (let i = 0; i < req.files.videos.length; i++) {
        const videoFile = req.files.videos[i];
        const videoId = `${studentName}-${Date.now()}-${i}`;
        
        try {
          // 直接上傳影片檔案
          const videoPath = `${basePath}/${videoFile.originalname}`;
          await learningUploadHelper.driveClient.uploadFile(
            videoPath,
            fs.createReadStream(videoFile.path),
            videoFile.mimetype || 'video/mp4'
          );

          uploadedFiles.videos.push({
            id: videoId,
            filename: videoFile.originalname,
            originalName: videoFile.originalname,
            url: `/api/drive-media${videoPath}`,
            size: videoFile.size,
            uploadedAt: new Date().toISOString()
          });

          console.log(`✅ [V2 Upload] 影片上傳完成: ${videoFile.originalname}`);

        } catch (error) {
          console.error(`❌ [V2 Upload] 影片 ${i + 1} 上傳失敗:`, error);
        }
      }
    }

    // 處理評語
    if (comment && comment.trim()) {
      try {
        const commentPath = `${basePath}/comment.txt`;
        await learningUploadHelper.driveClient.uploadFile(
          commentPath,
          Buffer.from(comment.trim(), 'utf8'),
          'text/plain'
        );
        console.log('✅ [V2 Upload] 評語儲存完成');
      } catch (error) {
        console.warn('⚠️ [V2 Upload] 評語儲存失敗:', error.message);
      }
    }

    // 清理臨時檔案
    const allFiles = [...(req.files?.photos || []), ...(req.files?.videos || [])];
    for (const file of allFiles) {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (error) {
        console.warn('⚠️ [V2 Upload] 清理臨時檔案失敗:', error.message);
      }
    }

    const duration = Date.now() - startTime;
    const totalUploaded = uploadedFiles.photos.length + uploadedFiles.videos.length;

    console.log(`🎉 [V2 Upload] 上傳完成，耗時 ${duration}ms，共 ${totalUploaded} 個檔案`);

    return res.json({
      success: true,
      data: {
        files: uploadedFiles,
        basePath,
        uploadedCount: totalUploaded,
        processingTime: duration
      },
      message: `成功上傳 ${totalUploaded} 個檔案`
    });

  } catch (error) {
    console.error('❌ [V2 Upload] 上傳失敗:', error);
    
    // 清理臨時檔案
    const allFiles = [...(req.files?.photos || []), ...(req.files?.videos || [])];
    for (const file of allFiles) {
      try {
        if (fs.existsSync(file.path)) {
          fs.unlinkSync(file.path);
        }
      } catch (cleanupError) {
        console.warn('⚠️ [V2 Upload] 錯誤清理臨時檔案失敗:', cleanupError.message);
      }
    }

    return res.status(500).json({
      success: false,
      error: error.message || '上傳失敗'
    });
  }
});

module.exports = router;
