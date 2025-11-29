/**
 * 學習歷程上傳系統 - 上傳管理模組
 * 處理學生上傳、課程總覽上傳等核心上傳邏輯
 * 
 * ⚠️ 向後兼容設計：
 * - 不覆蓋全域函數，僅提供輔助功能
 * - 與現有上傳邏輯共存，逐步遷移
 */

(function (global) {
  'use strict';

  const State = global.LearningUploadState;
  const Config = global.LearningUploadConfig;
  const Constants = global.LearningUploadConstants;
  const UploadQueue = global.LearningUploadQueue;
  const RetryManager = global.LearningUploadRetryManager;

  // ============================================
  // 上傳管理器
  // ============================================
  class UploadManager {
    constructor() {
      this.activeUploads = new Map(); // 追蹤活躍的上傳
      this.uploadHistory = []; // 上傳歷史記錄
    }

    /**
     * 驗證上傳資料
     */
    validateUploadData(data, type) {
      const errors = [];

      if (type === 'student') {
        // 學生上傳驗證
        if (!data.studentId && !data.studentName) {
          errors.push('缺少學生資訊');
        }
        if (!data.eventId && !data.courseId) {
          errors.push('缺少課程資訊');
        }
        if (!data.date) {
          errors.push('缺少課程日期');
        }

        // 檢查必要欄位
        const photos = Array.isArray(data.photos) ? data.photos : [];
        const videos = Array.isArray(data.videos) ? data.videos : [];
        const comment = (data.comment || '').trim();

        // 照片數量檢查（至少需要 3 張）
        const validPhotos = photos.filter(p => p && (p instanceof File || p instanceof Blob || (p.name && p.size)));
        if (validPhotos.length < 3) {
          errors.push(`照片數量不足（需要 3 張，目前 ${validPhotos.length} 張）`);
        }
        
        // 評語字數檢查（建議至少 20 字）
        if (comment.length < 20) {
          errors.push(`評語字數不足（建議 20 字以上，目前 ${comment.length} 字）`);
        }

      } else if (type === 'overview') {
        // 課程總覽驗證
        if (!data.eventId && !data.courseId) {
          errors.push('缺少課程資訊');
        }
        if (!data.date) {
          errors.push('缺少課程日期');
        }
      }

      return {
        valid: errors.length === 0,
        errors: errors
      };
    }

    /**
     * 準備上傳表單資料
     */
    prepareFormData(data, type) {
      const formData = new FormData();

      if (type === 'student') {
        // 學生上傳
        formData.append('studentName', data.studentName || '');
        formData.append('eventId', data.eventId || data.courseId || '');
        formData.append('date', data.date || '');
        formData.append('comment', data.comment || '');
        formData.append('attendanceStatus', data.attendanceStatus || 'present');

        // 添加照片
        if (data.photos && data.photos.length > 0) {
          data.photos.forEach((file, index) => {
            formData.append('photos', file, file.name || `photo-${index}.jpg`);
          });
        }

        // 添加影片
        if (data.videos && data.videos.length > 0) {
          data.videos.forEach((file, index) => {
            formData.append('videos', file, file.name || `video-${index}.mp4`);
          });
        }

      } else if (type === 'overview') {
        // 課程總覽上傳
        formData.append('eventId', data.eventId || data.courseId || '');
        formData.append('date', data.date || '');
        formData.append('courseType', data.courseType || '');
        formData.append('studentNames', data.studentNames || '');
        formData.append('studentCount', data.studentCount || '0');
        formData.append('teacher', data.teacher || '');
        formData.append('topic', data.topic || '');
        formData.append('performance', data.performance || '');
        formData.append('issues', data.issues || '');
        formData.append('solutions', data.solutions || '');

        // 添加照片/影片
        if (data.photos && data.photos.length > 0) {
          data.photos.forEach((file, index) => {
            formData.append('photos', file, file.name || `overview-${index}`);
          });
        }
      }

      return formData;
    }

    /**
     * 執行上傳
     */
    async upload(data, type, options = {}) {
      const uploadId = this.generateUploadId();
      
      try {
        // 驗證資料
        const validation = this.validateUploadData(data, type);
        if (!validation.valid && !options.skipValidation) {
          throw new Error('資料驗證失敗：' + validation.errors.join('、'));
        }

        // 準備 FormData
        const formData = this.prepareFormData(data, type);

        // 確定 API 端點
        const endpoint = type === 'student' 
          ? '/api/learning-portfolio'
          : '/api/learning-portfolio/overview';

        // 記錄開始上傳
        this.activeUploads.set(uploadId, {
          type: type,
          startTime: Date.now(),
          data: data,
          status: 'uploading'
        });

        // 發送請求
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`上傳失敗 (${response.status}): ${errorText}`);
        }

        const result = await response.json();

        // 記錄成功
        this.activeUploads.get(uploadId).status = 'completed';
        this.activeUploads.get(uploadId).endTime = Date.now();
        this.uploadHistory.push({
          id: uploadId,
          type: type,
          success: true,
          timestamp: new Date()
        });

        console.log('✅ 上傳成功:', type, uploadId);
        
        return {
          success: true,
          uploadId: uploadId,
          data: result
        };

      } catch (error) {
        console.error('❌ 上傳失敗:', error);
        
        // 記錄失敗
        if (this.activeUploads.has(uploadId)) {
          this.activeUploads.get(uploadId).status = 'failed';
          this.activeUploads.get(uploadId).error = error.message;
        }
        
        this.uploadHistory.push({
          id: uploadId,
          type: type,
          success: false,
          error: error.message,
          timestamp: new Date()
        });

        return {
          success: false,
          uploadId: uploadId,
          error: error.message
        };
      } finally {
        // 清理活躍上傳記錄（延遲清理）
        setTimeout(() => {
          this.activeUploads.delete(uploadId);
        }, 5000);
      }
    }

    /**
     * 批次上傳學生記錄
     */
    async uploadBatch(students, options = {}) {
      const results = [];
      const maxConcurrent = options.maxConcurrent || 3;
      
      console.log(`📦 開始批次上傳：${students.length} 位學生，最大併發數：${maxConcurrent}`);

      // 使用佇列管理併發
      if (UploadQueue) {
        for (const student of students) {
          const result = await UploadQueue.add(async () => {
            return await this.upload(student, 'student', options);
          }, {
            priority: options.priority || 'normal',
            studentName: student.studentName
          });
          results.push(result);
        }
      } else {
        // 後備：簡單的併發控制
        for (let i = 0; i < students.length; i += maxConcurrent) {
          const batch = students.slice(i, i + maxConcurrent);
          const batchResults = await Promise.all(
            batch.map(student => this.upload(student, 'student', options))
          );
          results.push(...batchResults);
        }
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`✅ 批次上傳完成：${successCount}/${students.length} 成功`);

      return {
        total: students.length,
        success: successCount,
        failed: students.length - successCount,
        results: results
      };
    }

    /**
     * 產生唯一上傳 ID
     */
    generateUploadId() {
      return `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * 取得上傳統計
     */
    getStats() {
      const recent = this.uploadHistory.slice(-100); // 最近 100 筆
      const success = recent.filter(h => h.success).length;
      const failed = recent.filter(h => !h.success).length;
      const active = this.activeUploads.size;

      return {
        active: active,
        recentSuccess: success,
        recentFailed: failed,
        recentTotal: recent.length,
        successRate: recent.length > 0 ? (success / recent.length * 100).toFixed(1) + '%' : '0%'
      };
    }

    /**
     * 清除歷史記錄
     */
    clearHistory() {
      this.uploadHistory = [];
      console.log('🧹 已清除上傳歷史記錄');
    }
  }

  // ============================================
  // 導出
  // ============================================
  const uploadManager = new UploadManager();
  global.LearningUploadManager = uploadManager;

  console.log('✅ UploadManager 已載入');

})(window);

