/**
 * 學習歷程上傳系統 - 整合層
 * 連接新模組與現有代碼，確保向後兼容
 */

(function (global) {
  'use strict';

  // 引用新模組
  const UploadManager = global.LearningUploadManager;
  const UploadProgress = global.LearningUploadProgress;
  const MediaPreviewManager = global.LearningMediaPreviewManager;
  const CourseRenderer = global.LearningCourseRenderer;
  const StudentRenderer = global.LearningStudentRenderer;
  const OverviewRenderer = global.LearningOverviewRenderer;

  // ============================================
  // 整合層
  // ============================================
  class IntegrationLayer {
    constructor() {
      this.enabled = true; // 可以動態開關
      this.hooks = new Map(); // 擴展鉤子
    }

    /**
     * 增強現有的 refreshProgress 函數
     */
    enhanceRefreshProgress(originalRefreshProgress) {
      const self = this;
      
      return function enhancedRefreshProgress() {
        // 1. 執行原有邏輯
        if (typeof originalRefreshProgress === 'function') {
          originalRefreshProgress();
        }

        // 2. 如果整合層啟用，使用新的進度追蹤
        if (self.enabled && UploadProgress) {
          try {
            self.syncProgressToNewModule();
          } catch (error) {
            console.warn('⚠️ 進度同步到新模組失敗:', error);
          }
        }
      };
    }

    /**
     * 同步進度到新模組
     */
    syncProgressToNewModule() {
      if (!UploadProgress) return;

      // 從現有狀態取得進度資訊
      const state = global.FLB?.State?.get?.();
      if (!state) return;

      const progress = state.progress || {};
      const students = state.students || [];
      const drafts = state.drafts || {};

      // 更新每個學生的進度
      students.forEach((student, index) => {
        const draft = drafts[String(index)] || {};
        const photoCount = (draft.photos || []).length;
        const videoCount = (draft.videos || []).length;
        const commentLength = (draft.comment || '').length;

        // 使用新模組更新進度指示器
        UploadProgress.updateStudentProgress(index, {
          photoCount: photoCount,
          videoCount: videoCount,
          commentLength: commentLength
        });
      });
    }

    /**
     * 增強媒體預覽處理
     */
    enhanceMediaPreview(type, files, studentIndex) {
      if (!this.enabled || !MediaPreviewManager) {
        return null; // 返回 null 表示使用原有邏輯
      }

      try {
        // 使用新模組生成預覽
        const isPhoto = type === 'photos' || type === 'photo';
        return MediaPreviewManager.generatePreviews(
          Array.from(files),
          isPhoto ? 'photo' : 'video',
          {
            maxConcurrent: 3,
            onDelete: (file, container) => {
              // 觸發原有的刪除邏輯
              if (global.handleFileDelete) {
                global.handleFileDelete(file, container, studentIndex, type);
              }
            }
          }
        );
      } catch (error) {
        console.warn('⚠️ 使用新模組生成預覽失敗，回退到原有邏輯:', error);
        return null;
      }
    }

    /**
     * 增強課程渲染
     */
    enhanceRenderCourseCards(courses) {
      if (!this.enabled || !CourseRenderer) {
        return false; // 返回 false 表示使用原有邏輯
      }

      try {
        const containerEl = document.getElementById('courseList');
        if (!containerEl) return false;

        CourseRenderer.render(courses, containerEl);
        return true; // 成功使用新模組
      } catch (error) {
        console.warn('⚠️ 使用新模組渲染課程失敗，回退到原有邏輯:', error);
        return false;
      }
    }

    /**
     * 增強學生卡片渲染
     */
    enhanceStudentCard(student, index, options = {}) {
      if (!this.enabled || !StudentRenderer) {
        return null;
      }

      try {
        return StudentRenderer.renderCard(student, index, options);
      } catch (error) {
        console.warn('⚠️ 使用新模組渲染學生卡片失敗:', error);
        return null;
      }
    }

    /**
     * 增強課程總覽渲染
     */
    enhanceOverviewRender(course) {
      if (!this.enabled || !OverviewRenderer) {
        return false;
      }

      try {
        OverviewRenderer.render(course);
        return true;
      } catch (error) {
        console.warn('⚠️ 使用新模組渲染課程總覽失敗:', error);
        return false;
      }
    }

    /**
     * 增強上傳功能
     */
    enhanceUpload(data, type, options = {}) {
      if (!this.enabled || !UploadManager) {
        return null;
      }

      try {
        return UploadManager.upload(data, type, options);
      } catch (error) {
        console.warn('⚠️ 使用新模組上傳失敗:', error);
        return null;
      }
    }

    /**
     * 註冊擴展鉤子
     */
    registerHook(name, callback) {
      if (!this.hooks.has(name)) {
        this.hooks.set(name, []);
      }
      this.hooks.get(name).push(callback);
    }

    /**
     * 觸發擴展鉤子
     */
    triggerHook(name, ...args) {
      const hooks = this.hooks.get(name) || [];
      hooks.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`❌ 鉤子 ${name} 執行失敗:`, error);
        }
      });
    }

    /**
     * 啟用整合層
     */
    enable() {
      this.enabled = true;
      console.log('✅ 整合層已啟用');
    }

    /**
     * 禁用整合層（回退到原有邏輯）
     */
    disable() {
      this.enabled = false;
      console.log('⚠️ 整合層已禁用，使用原有邏輯');
    }

    /**
     * 取得狀態
     */
    getStatus() {
      return {
        enabled: this.enabled,
        modules: {
          uploadManager: !!UploadManager,
          uploadProgress: !!UploadProgress,
          mediaPreviewManager: !!MediaPreviewManager,
          courseRenderer: !!CourseRenderer,
          studentRenderer: !!StudentRenderer,
          overviewRenderer: !!OverviewRenderer
        },
        hooks: Array.from(this.hooks.keys())
      };
    }
  }

  // ============================================
  // 導出並自動整合
  // ============================================
  const integrationLayer = new IntegrationLayer();
  global.LearningIntegrationLayer = integrationLayer;

  // ⚠️ 安全的增強：僅在模組可用時才整合
  if (typeof global.refreshProgress === 'function') {
    const originalRefreshProgress = global.refreshProgress;
    global.refreshProgress = integrationLayer.enhanceRefreshProgress(originalRefreshProgress);
    console.log('✅ refreshProgress 已增強（保留原有邏輯）');
  }

  // 提供便捷的全域函數（可選使用）
  global.useNewUpload = (data, type, options) => {
    return integrationLayer.enhanceUpload(data, type, options);
  };

  global.useNewRenderCourse = (courses) => {
    return integrationLayer.enhanceRenderCourseCards(courses);
  };

  global.useNewRenderOverview = (course) => {
    return integrationLayer.enhanceOverviewRender(course);
  };

  console.log('✅ IntegrationLayer 已載入');
  console.log('📊 整合層狀態:', integrationLayer.getStatus());

})(window);

