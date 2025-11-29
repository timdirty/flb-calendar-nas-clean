/**
 * 學習歷程上傳系統 - 進度追蹤模組
 * 追蹤上傳進度、更新 UI 進度指示器
 */

(function (global) {
  'use strict';

  const State = global.LearningUploadState;
  const DOM = global.LearningUploadDOM;

  // ============================================
  // 進度追蹤器
  // ============================================
  class UploadProgress {
    constructor() {
      this.tasks = new Map(); // 任務追蹤：taskId -> { progress, status, ... }
      this.listeners = new Set(); // 進度監聽器
    }

    /**
     * 創建新任務
     */
    createTask(taskId, options = {}) {
      const task = {
        id: taskId,
        type: options.type || 'unknown',
        total: options.total || 100,
        completed: 0,
        status: 'pending',
        startTime: Date.now(),
        endTime: null,
        metadata: options.metadata || {}
      };

      this.tasks.set(taskId, task);
      this.notifyListeners('created', task);
      
      return task;
    }

    /**
     * 更新任務進度
     */
    updateProgress(taskId, completed, options = {}) {
      const task = this.tasks.get(taskId);
      if (!task) {
        console.warn('⚠️ 任務不存在:', taskId);
        return;
      }

      task.completed = Math.min(completed, task.total);
      task.status = options.status || (task.completed >= task.total ? 'completed' : 'in-progress');
      
      if (options.message) {
        task.message = options.message;
      }

      this.notifyListeners('updated', task);
      
      return task;
    }

    /**
     * 完成任務
     */
    completeTask(taskId, options = {}) {
      const task = this.tasks.get(taskId);
      if (!task) return;

      task.completed = task.total;
      task.status = options.success !== false ? 'completed' : 'failed';
      task.endTime = Date.now();
      task.duration = task.endTime - task.startTime;
      
      if (options.message) {
        task.message = options.message;
      }
      if (options.error) {
        task.error = options.error;
      }

      this.notifyListeners('completed', task);
      
      return task;
    }

    /**
     * 取消任務
     */
    cancelTask(taskId) {
      const task = this.tasks.get(taskId);
      if (!task) return;

      task.status = 'cancelled';
      task.endTime = Date.now();
      
      this.notifyListeners('cancelled', task);
      this.tasks.delete(taskId);
    }

    /**
     * 清除已完成的任務
     */
    clearCompletedTasks() {
      const completed = [];
      this.tasks.forEach((task, taskId) => {
        if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
          completed.push(taskId);
        }
      });
      
      completed.forEach(taskId => this.tasks.delete(taskId));
      console.log(`🧹 已清除 ${completed.length} 個已完成任務`);
    }

    /**
     * 取得任務資訊
     */
    getTask(taskId) {
      return this.tasks.get(taskId);
    }

    /**
     * 取得所有任務
     */
    getAllTasks() {
      return Array.from(this.tasks.values());
    }

    /**
     * 取得任務統計
     */
    getStats() {
      const tasks = this.getAllTasks();
      const stats = {
        total: tasks.length,
        pending: 0,
        inProgress: 0,
        completed: 0,
        failed: 0,
        cancelled: 0
      };

      tasks.forEach(task => {
        if (task.status === 'pending') stats.pending++;
        else if (task.status === 'in-progress') stats.inProgress++;
        else if (task.status === 'completed') stats.completed++;
        else if (task.status === 'failed') stats.failed++;
        else if (task.status === 'cancelled') stats.cancelled++;
      });

      return stats;
    }

    /**
     * 更新學生卡片進度指示器
     */
    updateStudentProgress(studentIndex, data) {
      try {
        // 照片計數
        const photoCount = data.photoCount || 0;
        const photoEl = DOM.$(`#photo-count-${studentIndex}`);
        if (photoEl) {
          photoEl.textContent = photoCount;
        }
        const photoIndicator = DOM.$(`#photo-indicator-${studentIndex}`);
        if (photoIndicator) {
          if (photoCount >= 3) {
            photoIndicator.classList.add('complete');
          } else {
            photoIndicator.classList.remove('complete');
          }
        }

        // 影片計數
        const videoCount = data.videoCount || 0;
        const videoEl = DOM.$(`#video-count-${studentIndex}`);
        if (videoEl) {
          videoEl.textContent = videoCount;
        }
        const videoIndicator = DOM.$(`#video-indicator-${studentIndex}`);
        if (videoIndicator) {
          if (videoCount > 0) {
            videoIndicator.classList.add('complete');
          } else {
            videoIndicator.classList.remove('complete');
          }
        }

        // 評語字數
        const commentLength = data.commentLength || 0;
        const commentEl = DOM.$(`#comment-count-${studentIndex}`);
        if (commentEl) {
          commentEl.textContent = commentLength;
        }
        const commentIndicator = DOM.$(`#comment-indicator-${studentIndex}`);
        if (commentIndicator) {
          if (commentLength >= 20) {
            commentIndicator.classList.add('complete');
          } else {
            commentIndicator.classList.remove('complete');
          }
        }

        // 計算總進度百分比
        const totalProgress = this.calculateStudentProgress({
          photoCount: photoCount,
          videoCount: videoCount,
          commentLength: commentLength
        });

        // 更新膠囊進度條
        const capsuleBar = DOM.$(`#cap-bar-${studentIndex} .fill`);
        if (capsuleBar) {
          capsuleBar.style.width = totalProgress + '%';
        }
        const capsulePercent = DOM.$(`#cap-percent-${studentIndex}`);
        if (capsulePercent) {
          capsulePercent.textContent = totalProgress + '%';
        }

        // 更新膠囊統計
        const capPhoto = DOM.$(`#cap-photo-${studentIndex} .v`);
        if (capPhoto) {
          capPhoto.textContent = photoCount;
        }
        const capVideo = DOM.$(`#cap-video-${studentIndex} .v`);
        if (capVideo) {
          capVideo.textContent = videoCount;
        }
        const capText = DOM.$(`#cap-text-${studentIndex} .v`);
        if (capText) {
          capText.textContent = commentLength;
        }

      } catch (error) {
        console.error('❌ 更新學生進度指示器失敗:', error);
      }
    }

    /**
     * 計算學生上傳完成度（百分比）
     */
    calculateStudentProgress(data) {
      let score = 0;
      const weights = { photo: 50, video: 20, comment: 30 };

      // 照片：3 張滿分
      if (data.photoCount >= 3) {
        score += weights.photo;
      } else {
        score += (data.photoCount / 3) * weights.photo;
      }

      // 影片：有即滿分
      if (data.videoCount > 0) {
        score += weights.video;
      }

      // 評語：20 字滿分
      if (data.commentLength >= 20) {
        score += weights.comment;
      } else {
        score += (data.commentLength / 20) * weights.comment;
      }

      return Math.round(score);
    }

    /**
     * 顯示上傳進度 Toast
     */
    showUploadToast(message, progress) {
      const showToast = global.showToast;
      if (!showToast) return;

      if (progress >= 100) {
        showToast(message + ' ✅', 'success');
      } else if (progress > 0) {
        showToast(message + ` (${progress}%)`, 'info');
      } else {
        showToast(message, 'info');
      }
    }

    /**
     * 添加進度監聽器
     */
    addListener(callback) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    }

    /**
     * 通知監聽器
     */
    notifyListeners(event, task) {
      this.listeners.forEach(callback => {
        try {
          callback(event, task);
        } catch (error) {
          console.error('❌ 進度監聽器執行失敗:', error);
        }
      });
    }
  }

  // ============================================
  // 導出
  // ============================================
  const uploadProgress = new UploadProgress();
  global.LearningUploadProgress = uploadProgress;

  // 向後兼容：提供全局函數
  global.updateStudentProgressIndicators = (studentIndex, data) => {
    uploadProgress.updateStudentProgress(studentIndex, data);
  };

  console.log('✅ UploadProgress 已載入');

})(window);

