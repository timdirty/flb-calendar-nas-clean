/**
 * 學習歷程上傳系統 - 統一狀態管理器
 * 取代 40+ 全域變數，提供響應式狀態管理和事件通知
 */

(function (global) {
  'use strict';

  const Constants = global.LearningUploadConstants || {};
  const Config = global.LearningUploadConfig || {};

  // ============================================
  // 狀態管理器
  // ============================================
  class StateManager {
    constructor() {
      // 核心狀態
      this.state = {
        // 課程相關
        currentCourse: null,
        allCourses: [],
        highlightedCourseId: null,
        courseFiltersMeta: {},
        currentFilterDateOverride: null,

        // 學生相關
        studentFiles: {},
        allStudentsGlobal: [],
        currentStudentIndex: 0,

        // 用戶相關
        currentUser: null,
        currentTeacher: null,
        urlInstructor: null,

        // 篩選相關
        activeFilters: {
          instructor: '',
          courseType: '',
          studentQuery: ''
        },
        activeWeekdays: new Set(),

        // 上傳相關
        uploadingStudents: {},
        uploadRetryCount: {},
        autoUploadTimers: {},
        activeUploadsByStudent: {},
        activeUploadsTotal: 0,
        lastAutoUploadAt: {},
        lastSubmittedSnapshot: {},

        // UI 相關
        currentSwipeDetach: null,
        topTabsStickyObserver: null,
        previewOverlayEl: null,
        previewOverlayBody: null,
        currentOverlayUrl: null,
        pendingOverlayRevokes: new Set(),
        previewOverlayBound: false,

        // 課程總覽相關
        lastOverviewSnapshot: '',
        forceNextOverviewUpload: false,
        overviewScheduleTimer: null,
        overviewAutoTimer: null,

        // 快取相關
        uploadedCacheHydratedAt: 0,
        batchFsFetchMode: false,

        // 模板相關
        lastSharedVideoFiles: [],
        lastCommentTemplate: '',
        videoTemplatesMem: [],

        // 媒體相關
        videoPosterCache: window.__videoPosterCache || {},
        videoThumbnailReadyCache: window.__videoThumbnailReadyCache || {},
        thumbReadyCache: window.__thumbReadyCache,
        posterErrorPanelEl: null,
        posterErrorQueue: [],
        posterRetryRegistry: {},
        serverMediaIndex: {
          photos: Object.create(null),
          videos: Object.create(null)
        },
        posterErrorRegistry: {},
        shadowBuffers: {}
      };

      // 事件監聽器
      this.listeners = new Map();
      
      // 初始化快取
      this.initializeCaches();
    }

    /**
     * 初始化快取
     */
    initializeCaches() {
      window.__videoPosterCache = this.state.videoPosterCache;
      window.__videoThumbnailReadyCache = this.state.videoThumbnailReadyCache;
      
      if (!this.state.thumbReadyCache || typeof this.state.thumbReadyCache.add !== 'function') {
        try {
          this.state.thumbReadyCache = new Set();
        } catch (e) {
          this.state.thumbReadyCache = {
            _map: {},
            add: function (key) { if (key) this._map[key] = true; },
            has: function (key) { return !!(key && this._map[key]); }
          };
        }
        window.__thumbReadyCache = this.state.thumbReadyCache;
      }
    }

    /**
     * 獲取狀態值
     */
    get(path) {
      const keys = path.split('.');
      let value = this.state;
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return undefined;
        }
      }
      return value;
    }

    /**
     * 設置狀態值（觸發事件）
     */
    set(path, value, silent) {
      const keys = path.split('.');
      const lastKey = keys.pop();
      let target = this.state;
      
      for (const key of keys) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        target = target[key];
      }
      
      const oldValue = target[lastKey];
      target[lastKey] = value;
      
      if (!silent) {
        this.notify(path, value, oldValue);
      }
      
      return true;
    }

    /**
     * 批量更新狀態
     */
    update(updates, silent) {
      const changed = [];
      for (const path in updates) {
        const oldValue = this.get(path);
        this.set(path, updates[path], true);
        changed.push({ path, newValue: updates[path], oldValue });
      }
      
      if (!silent && changed.length > 0) {
        this.notify('*', changed, null);
      }
      
      return changed;
    }

    /**
     * 獲取完整狀態（深拷貝）
     */
    getAll() {
      return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * 重置狀態
     */
    reset() {
      this.state = {
        ...this.state,
        currentCourse: null,
        studentFiles: {},
        uploadingStudents: {},
        activeUploadsByStudent: {},
        activeUploadsTotal: 0
      };
      this.notify('reset', null, null);
    }

    /**
     * 註冊事件監聽器
     */
    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
      
      // 返回取消訂閱函數
      return () => {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
          const index = callbacks.indexOf(callback);
          if (index > -1) {
            callbacks.splice(index, 1);
          }
        }
      };
    }

    /**
     * 移除事件監聽器
     */
    off(event, callback) {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    }

    /**
     * 觸發事件通知
     */
    notify(path, newValue, oldValue) {
      // 觸發特定路徑事件
      const specificEvent = `state:${path}`;
      this.emit(specificEvent, newValue, oldValue);
      
      // 觸發通用狀態變更事件
      this.emit(Constants.EVENTS?.STATE_CHANGED || 'state:changed', { path, newValue, oldValue });
      
      // 觸發相關業務事件
      this.triggerBusinessEvents(path, newValue, oldValue);
    }

    /**
     * 觸發業務相關事件
     */
    triggerBusinessEvents(path, newValue, oldValue) {
      if (path === 'currentCourse') {
        this.emit(Constants.EVENTS?.COURSE_SELECTED || 'course:selected', newValue);
        this.emit(Constants.EVENTS?.COURSE_CHANGED || 'course:changed', { course: newValue, previous: oldValue });
      } else if (path === 'currentStudentIndex') {
        this.emit(Constants.EVENTS?.STUDENT_CHANGED || 'student:changed', newValue);
      } else if (path.startsWith('uploadingStudents.')) {
        const studentIndex = path.split('.')[1];
        if (newValue && !oldValue) {
          this.emit(Constants.EVENTS?.UPLOAD_STARTED || 'upload:started', studentIndex);
        } else if (!newValue && oldValue) {
          this.emit(Constants.EVENTS?.UPLOAD_COMPLETED || 'upload:completed', studentIndex);
        }
      }
    }

    /**
     * 發送事件
     */
    emit(event, ...args) {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.forEach(callback => {
          try {
            callback(...args);
          } catch (e) {
            console.error(`❌ 事件監聽器執行失敗 [${event}]:`, e);
          }
        });
      }
    }

    /**
     * 清理資源
     */
    cleanup() {
      // 清理所有監聽器
      this.listeners.clear();
      
      // 清理快取
      if (this.state.pendingOverlayRevokes instanceof Set) {
        this.state.pendingOverlayRevokes.forEach(url => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {}
        });
        this.state.pendingOverlayRevokes.clear();
      }
      
      // 重置狀態
      this.reset();
    }
  }

  // ============================================
  // 導出
  // ============================================
  const stateManager = new StateManager();
  global.LearningUploadState = stateManager;

  // 向後兼容：提供舊的全域變數訪問方式
  Object.defineProperty(global, 'currentCourse', {
    get: () => stateManager.get('currentCourse'),
    set: (value) => stateManager.set('currentCourse', value)
  });

})(window);
