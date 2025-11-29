/**
 * 學習歷程上傳系統 - 配置管理
 * 集中管理系統配置，支援動態調整和環境差異
 */

(function (global) {
  'use strict';

  const Constants = global.LearningUploadConstants || {};

  // ============================================
  // 預設配置
  // ============================================
  const defaultConfig = {
    // 上傳配置
    upload: {
      chunkSize: 6 * 1024 * 1024, // 6MB
      concurrency: 3,
      retryDelay: 1000, // 重試延遲（ms）
      maxRetries: Constants.UPLOAD?.MAX_RETRIES || 3,
      autoUploadDelay: 2000 // 自動上傳延遲（ms）
    },

    // 媒體處理配置
    media: {
      photoCompression: {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85
      },
      videoPoster: {
        quality: 0.7,
        maxWidth: 640,
        maxHeight: 360
      },
      lazyLoad: true,
      preloadCount: 3 // 預載入數量
    },

    // 🎬 影片上傳專用配置
    video: {
      // 檔案大小閾值（MB）
      largeFileThresholdMB: 50,
      hugeFileThresholdMB: 150,
      
      // 縮圖配置
      enablePosterForLargeFiles: false, // 大檔案是否生成縮圖
      posterSkipThresholdMB: 100, // 超過此大小跳過縮圖生成
      
      // 記憶體限制
      minFreeMemoryMB: 200, // 最低可用記憶體要求（MB）
      emergencyCleanupThresholdRatio: 0.85, // 緊急清理閾值（記憶體使用比例）
      
      // 併發控制
      maxConcurrencyNormal: 3, // 正常併發數
      maxConcurrencyMedium: 2, // 中檔案併發數
      maxConcurrencyLarge: 1, // 大檔案併發數
      
      // 分片大小（MB）
      chunkSizeSmall: 6, // <50MB
      chunkSizeMedium: 10, // 50-150MB
      chunkSizeLarge: 15, // >150MB
      
      // 用戶體驗
      showEstimatedTime: true, // 顯示預估時間
      confirmLargeUpload: true, // 大檔案上傳前確認
      confirmThresholdMB: 100, // 確認對話框閾值（MB）
      
      // 記憶體監控
      enableMemoryMonitor: true, // 啟用記憶體監控
      memoryMonitorInterval: 2000 // 監控間隔（ms）
    },

    // UI 配置
    ui: {
      virtualScroll: true, // 啟用虛擬滾動
      itemHeight: Constants.PERFORMANCE?.VIRTUAL_SCROLL_ITEM_HEIGHT || 120,
      renderBatchSize: 10, // 批量渲染大小
      animationEnabled: true,
      debounceDelay: Constants.PERFORMANCE?.DEBOUNCE_DELAY || 300,
      throttleDelay: Constants.PERFORMANCE?.THROTTLE_DELAY || 100
    },

    // 快取配置
    cache: {
      enabled: true,
      ttl: Constants.UPLOAD?.CACHE_TTL || 30 * 60 * 1000,
      maxSize: 50 * 1024 * 1024, // 50MB
      strategy: 'lru' // lru, fifo, none
    },

    // 性能配置
    performance: {
      enableIdleCallback: true,
      idleTimeout: Constants.PERFORMANCE?.IDLE_TIMEOUT || 2000,
      enableWebWorker: false, // 未來可啟用 Web Worker
      enableServiceWorker: false
    },

    // 開發模式配置
    dev: {
      enableLogging: true,
      enablePerformanceMonitor: false,
      mockUpload: false
    }
  };

  // ============================================
  // 配置管理器
  // ============================================
  class ConfigManager {
    constructor() {
      this.config = this.mergeConfig(defaultConfig, this.loadUserConfig());
      this.applyEnvironmentConfig();
    }

    /**
     * 載入用戶自訂配置（從 localStorage）
     */
    loadUserConfig() {
      try {
        const stored = localStorage.getItem('learning_upload_config');
        return stored ? JSON.parse(stored) : {};
      } catch (e) {
        console.warn('⚠️ 載入用戶配置失敗:', e);
        return {};
      }
    }

    /**
     * 保存用戶配置
     */
    saveUserConfig(partialConfig) {
      try {
        const current = this.loadUserConfig();
        const merged = this.mergeConfig(current, partialConfig);
        localStorage.setItem('learning_upload_config', JSON.stringify(merged));
        this.config = this.mergeConfig(defaultConfig, merged);
        return true;
      } catch (e) {
        console.error('❌ 保存用戶配置失敗:', e);
        return false;
      }
    }

    /**
     * 合併配置物件
     */
    mergeConfig(base, override) {
      const result = { ...base };
      for (const key in override) {
        if (override[key] && typeof override[key] === 'object' && !Array.isArray(override[key])) {
          result[key] = this.mergeConfig(base[key] || {}, override[key]);
        } else {
          result[key] = override[key];
        }
      }
      return result;
    }

    /**
     * 根據環境調整配置
     */
    applyEnvironmentConfig() {
      // 檢測低階設備
      const isLowEnd = this.detectLowEndDevice();
      if (isLowEnd) {
        this.config.ui.virtualScroll = true;
        this.config.ui.animationEnabled = false;
        this.config.media.lazyLoad = true;
        this.config.performance.enableIdleCallback = false;
        
        // 🎬 低階設備的影片上傳優化
        this.config.video.enablePosterForLargeFiles = false;
        this.config.video.posterSkipThresholdMB = 50; // 更低的閾值
        this.config.video.maxConcurrencyNormal = 2;
        this.config.video.maxConcurrencyMedium = 1;
        this.config.video.maxConcurrencyLarge = 1;
        this.config.video.largeFileThresholdMB = 30; // 更早進入大檔案模式
        this.config.video.hugeFileThresholdMB = 100;
        
        console.log('📱 檢測到低階設備，已調整配置（含影片上傳優化）');
      }

      // 🔍 檢測記憶體狀況
      if (performance && performance.memory) {
        const totalMemoryMB = performance.memory.jsHeapSizeLimit / (1024 * 1024);
        
        // 低記憶體設備（<512MB）
        if (totalMemoryMB < 512) {
          this.config.video.confirmThresholdMB = 50;
          this.config.video.posterSkipThresholdMB = 30;
          this.config.video.emergencyCleanupThresholdRatio = 0.75;
          console.log('⚠️ 檢測到低記憶體環境 (' + totalMemoryMB.toFixed(0) + ' MB)，已啟用嚴格模式');
        }
      }

      // 開發模式
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        this.config.dev.enableLogging = true;
        this.config.dev.enablePerformanceMonitor = true;
      }
    }

    /**
     * 檢測低階設備
     */
    detectLowEndDevice() {
      const hc = navigator.hardwareConcurrency || 0;
      const dm = navigator.deviceMemory || 0;
      const thresholds = Constants.DEVICE || {};
      
      return (hc > 0 && hc <= (thresholds.LOW_END_CPU || 4)) ||
             (dm > 0 && dm <= (thresholds.LOW_END_MEMORY || 2));
    }

    /**
     * 獲取配置值
     */
    get(path) {
      const keys = path.split('.');
      let value = this.config;
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
     * 設置配置值
     */
    set(path, value) {
      const keys = path.split('.');
      const lastKey = keys.pop();
      let target = this.config;
      
      for (const key of keys) {
        if (!target[key] || typeof target[key] !== 'object') {
          target[key] = {};
        }
        target = target[key];
      }
      
      target[lastKey] = value;
      return true;
    }

    /**
     * 獲取完整配置
     */
    getAll() {
      return { ...this.config };
    }
  }

  // ============================================
  // 導出
  // ============================================
  const configManager = new ConfigManager();
  global.LearningUploadConfig = configManager;

})(window);
