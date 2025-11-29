/**
 * 學習歷程上傳系統 - 常數定義
 * 集中管理所有常數，避免魔法數字和字串散落各處
 */

(function (global) {
  'use strict';

  // ============================================
  // 版本與快取
  // ============================================
  const CURRENT_VERSION = '20251105-force-save-empty';
  const STORAGE_KEY = 'app_version';

  // ============================================
  // 上傳相關常數
  // ============================================
  const MAX_UPLOAD_RETRIES = 3;
  const UPLOAD_CANCELLED_FLAG = '__UPLOAD_CANCELLED__';
  const UPLOADED_CACHE_TTL = 30 * 60 * 1000; // 30 分鐘

  // ============================================
  // 媒體處理常數
  // ============================================
  const POSTER_RETRY_LIMIT = 5;
  const DEFAULT_POSTER_QUEUE_LIMIT = 1; // 低階設備預設
  const DEFAULT_POSTER_QUEUE_LIMIT_HIGH = 2; // 高階設備

  // ============================================
  // 出缺席狀態常數
  // ============================================
  const ATTENDANCE_STATUS_TEXT = {
    present: '✅ 已出席，請完成上傳。',
    leave: '🏥 今日已請假，系統已鎖定上傳。',
    absent: '⚠️ 今日缺席，系統已鎖定上傳。',
    unknown: '🕒 尚未紀錄出缺席。'
  };

  const ATTENDANCE_STATUS_CLASS = {
    present: 'status-present',
    leave: 'status-leave',
    absent: 'status-absent',
    unknown: 'status-unknown'
  };

  // ============================================
  // DOM 選擇器常數（快取用）
  // ============================================
  const SELECTORS = {
    courseList: '#courseList',
    studentsGrid: '#studentsGrid',
    topTabs: '#topTabs',
    bottomTabs: '#bottomTabs',
    overviewPhotosPreviews: '#overviewPhotosPreviews',
    overviewExistingPreviews: '#overviewExistingPreviews',
    previewOverlay: '#previewOverlay',
    previewOverlayBody: '#previewOverlayBody'
  };

  // ============================================
  // 事件類型常數
  // ============================================
  const EVENTS = {
    STATE_CHANGED: 'state:changed',
    COURSE_SELECTED: 'course:selected',
    COURSE_CHANGED: 'course:changed',
    STUDENT_CHANGED: 'student:changed',
    UPLOAD_STARTED: 'upload:started',
    UPLOAD_PROGRESS: 'upload:progress',
    UPLOAD_COMPLETED: 'upload:completed',
    UPLOAD_FAILED: 'upload:failed',
    MEDIA_LOADED: 'media:loaded',
    MEDIA_ERROR: 'media:error'
  };

  // ============================================
  // 性能優化常數
  // ============================================
  const PERFORMANCE = {
    DEBOUNCE_DELAY: 300,
    THROTTLE_DELAY: 100,
    IDLE_TIMEOUT: 2000, // requestIdleCallback timeout
    VIRTUAL_SCROLL_ITEM_HEIGHT: 120, // 虛擬滾動項目高度（px）
    LAZY_LOAD_THRESHOLD: 200 // 懶加載觸發距離（px）
  };

  // ============================================
  // 設備檢測閾值
  // ============================================
  const DEVICE_THRESHOLDS = {
    LOW_END_CPU: 4, // CPU 核心數 <= 4
    LOW_END_MEMORY: 2, // 記憶體 <= 2GB
    SMALL_SCREEN: 420 // 小螢幕寬度 <= 420px
  };

  // ============================================
  // 導出
  // ============================================
  global.LearningUploadConstants = {
    VERSION: CURRENT_VERSION,
    STORAGE_KEY: STORAGE_KEY,
    UPLOAD: {
      MAX_RETRIES: MAX_UPLOAD_RETRIES,
      CANCELLED_FLAG: UPLOAD_CANCELLED_FLAG,
      CACHE_TTL: UPLOADED_CACHE_TTL
    },
    MEDIA: {
      POSTER_RETRY_LIMIT: POSTER_RETRY_LIMIT,
      POSTER_QUEUE_LIMIT: DEFAULT_POSTER_QUEUE_LIMIT,
      POSTER_QUEUE_LIMIT_HIGH: DEFAULT_POSTER_QUEUE_LIMIT_HIGH
    },
    ATTENDANCE: {
      TEXT: ATTENDANCE_STATUS_TEXT,
      CLASS: ATTENDANCE_STATUS_CLASS
    },
    SELECTORS: SELECTORS,
    EVENTS: EVENTS,
    PERFORMANCE: PERFORMANCE,
    DEVICE: DEVICE_THRESHOLDS
  };

})(window);
