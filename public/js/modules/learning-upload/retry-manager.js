/**
 * 學習歷程上傳系統 - 重試機制管理器
 * 統一管理上傳失敗的重試邏輯
 */

(function (global) {
  'use strict';

  const State = global.LearningUploadState;
  const Config = global.LearningUploadConfig;
  const Constants = global.LearningUploadConstants;
  
  // 🚀 新增：錯誤處理系統
  const ErrorHandler = global.LearningUploadErrorHandler;
  const ErrorTypes = global.LearningUploadErrorTypes;

  // ============================================
  // 錯誤類型分類
  // ============================================
  /**
   * 🎬 分類錯誤類型，決定是否可重試
   * @param {Error} error - 錯誤物件
   * @returns {Object} { type, retryable, userMessage }
   */
  function categorizeError(error) {
    if (!error) {
      return { type: 'unknown', retryable: false, userMessage: '未知錯誤' };
    }

    const msg = String(error.message || '').toLowerCase();
    const name = String(error.name || '').toLowerCase();
    
    // 🔴 記憶體相關錯誤（不可重試）
    if (msg.includes('memory') || msg.includes('heap') || 
        msg.includes('out of memory') || msg.includes('記憶體')) {
      return {
        type: 'memory',
        retryable: false,
        userMessage: '記憶體不足。建議：\n1. 關閉其他應用程式\n2. 單獨上傳該檔案\n3. 使用電腦上傳'
      };
    }
    
    // 🔴 配額超出錯誤（不可重試）
    if (msg.includes('quota') || msg.includes('storage') || msg.includes('配額')) {
      return {
        type: 'quota',
        retryable: false,
        userMessage: '儲存空間不足，請清理後再試'
      };
    }
    
    // 🟡 網路相關錯誤（可重試）
    if (msg.includes('network') || msg.includes('fetch') || 
        msg.includes('connection') || msg.includes('網路') ||
        name.includes('networkerror')) {
      return {
        type: 'network',
        retryable: true,
        userMessage: '網路連線失敗，將自動重試'
      };
    }
    
    // 🟡 超時錯誤（可重試）
    if (msg.includes('timeout') || msg.includes('超時') || msg.includes('timed out')) {
      return {
        type: 'timeout',
        retryable: true,
        userMessage: '請求超時，將自動重試'
      };
    }
    
    // 🟡 伺服器錯誤（可重試）
    if (msg.includes('500') || msg.includes('502') || msg.includes('503') || 
        msg.includes('server error') || msg.includes('伺服器')) {
      return {
        type: 'server',
        retryable: true,
        userMessage: '伺服器暫時無法處理，將自動重試'
      };
    }
    
    // 🔴 檔案格式錯誤（不可重試）
    if (msg.includes('invalid') || msg.includes('format') || msg.includes('格式')) {
      return {
        type: 'format',
        retryable: false,
        userMessage: '檔案格式不支援'
      };
    }
    
    // 🟡 其他錯誤（預設可重試）
    return {
      type: 'unknown',
      retryable: true,
      userMessage: '上傳失敗，將自動重試'
    };
  }

  // ============================================
  // 重試管理器
  // ============================================
  class RetryManager {
    constructor() {
      this.retries = new Map(); // key -> { count, lastAttempt, config, errorType }
      this.maxRetries = Constants.UPLOAD?.MAX_RETRIES || 3;
      this.baseDelay = Config.get('upload.retryDelay') || 1000;
    }

    /**
     * 🚀 映射錯誤類型到新的 ErrorTypes
     */
    mapErrorTypeToErrorTypes(oldType) {
      if (!ErrorTypes) return null;
      
      const mapping = {
        'memory': ErrorTypes.MEMORY_EXCEEDED,
        'quota': ErrorTypes.UPLOAD_QUOTA_EXCEEDED,
        'network': ErrorTypes.NETWORK_ERROR,
        'timeout': ErrorTypes.NETWORK_TIMEOUT,
        'server': ErrorTypes.SERVER_ERROR,
        'format': ErrorTypes.FILE_TYPE_INVALID,
        'unknown': ErrorTypes.UNKNOWN_ERROR
      };
      
      return mapping[oldType] || ErrorTypes.UNKNOWN_ERROR;
    }

    /**
     * 記錄失敗（增加重試計數）
     */
    recordFailure(key) {
      const entry = this.retries.get(key) || { count: 0, lastAttempt: 0 };
      entry.count++;
      entry.lastAttempt = Date.now();
      this.retries.set(key, entry);
      
      return entry.count;
    }

    /**
     * 重置重試計數
     */
    reset(key) {
      if (key) {
        this.retries.delete(key);
      } else {
        this.retries.clear();
      }
    }

    /**
     * 獲取重試次數
     */
    getRetryCount(key) {
      const entry = this.retries.get(key);
      return entry ? entry.count : 0;
    }

    /**
     * 獲取剩餘重試次數
     */
    getRemainingRetries(key) {
      const count = this.getRetryCount(key);
      return Math.max(0, this.maxRetries - count);
    }

    /**
     * 判斷是否可以重試
     */
    canRetry(key) {
      return this.getRetryCount(key) < this.maxRetries;
    }

    /**
     * 計算重試延遲（指數退避）
     */
    getRetryDelay(key) {
      const count = this.getRetryCount(key);
      // 指數退避：1s, 2s, 4s, 8s...
      return this.baseDelay * Math.pow(2, count);
    }

    /**
     * 執行重試（帶延遲）
     */
    async retry(key, fn, context) {
      if (!this.canRetry(key)) {
        throw new Error(`已達到最大重試次數 (${this.maxRetries})`);
      }

      const delay = this.getRetryDelay(key);
      const remaining = this.getRemainingRetries(key);

      console.log(`🔄 [Retry] ${key}: 延遲 ${delay}ms 後重試（剩餘 ${remaining} 次）`);

      // 延遲後執行
      await new Promise(resolve => setTimeout(resolve, delay));

      try {
        const result = await fn.call(context);
        // 成功後重置計數
        this.reset(key);
        return result;
      } catch (e) {
        // 失敗後記錄
        this.recordFailure(key);
        throw e;
      }
    }

    /**
     * 🎬 帶自動重試的執行器（智能錯誤處理）
     * @param {string} key - 重試鍵
     * @param {Function} fn - 要執行的函數
     * @param {Object} context - 執行上下文
     * @param {Object} options - 選項 { onError: 錯誤回調 }
     */
    async executeWithRetry(key, fn, context, options = {}) {
      let lastError;
      let lastErrorCategory;

      while (this.canRetry(key)) {
        try {
          const result = await fn.call(context);
          this.reset(key);
          return result;
        } catch (e) {
          lastError = e;
          
          // 🎬 分類錯誤
          const errorCategory = categorizeError(e);
          lastErrorCategory = errorCategory;
          
          console.error(`❌ [Retry] ${key}: 錯誤類型 ${errorCategory.type}`, e.message);
          
          // 🚀 使用新的錯誤處理系統
          if (ErrorHandler) {
            ErrorHandler.handleError({
              type: this.mapErrorTypeToErrorTypes(errorCategory.type),
              originalError: e,
              context: { key, retryCount: this.getRetryCount(key) },
              showNotification: false // 暫時不顯示，等到最終失敗時才顯示
            });
          }
          
          // 🔴 不可重試的錯誤，立即中斷
          if (!errorCategory.retryable) {
            console.error(`❌ [Retry] ${key}: 錯誤不可重試 (${errorCategory.type})`);
            
            // 🚀 顯示錯誤通知
            if (ErrorHandler) {
              ErrorHandler.handleError({
                type: this.mapErrorTypeToErrorTypes(errorCategory.type),
                originalError: e,
                message: errorCategory.userMessage,
                context: { key },
                showNotification: true
              });
            }
            
            // 呼叫錯誤回調
            if (typeof options.onError === 'function') {
              try {
                options.onError(e, errorCategory);
              } catch (cbError) {
                console.error('❌ [Retry] 錯誤回調失敗:', cbError);
              }
            }
            
            throw new Error(errorCategory.userMessage || e.message);
          }
          
          const count = this.recordFailure(key);
          
          if (!this.canRetry(key)) {
            console.error(`❌ [Retry] ${key}: 已達最大重試次數 (${this.maxRetries})`);
            
            // 🚀 顯示最終失敗通知
            if (ErrorHandler) {
              ErrorHandler.handleError({
                type: this.mapErrorTypeToErrorTypes(errorCategory.type),
                originalError: e,
                message: `${errorCategory.userMessage}\n已重試 ${this.maxRetries} 次，請稍後再試。`,
                context: { key, maxRetries: this.maxRetries },
                showNotification: true
              });
            }
            
            // 最後一次失敗的錯誤回調
            if (typeof options.onError === 'function') {
              try {
                options.onError(e, errorCategory);
              } catch (cbError) {}
            }
            
            break;
          }

          const delay = this.getRetryDelay(key);
          console.warn(`⚠️ [Retry] ${key}: 第 ${count} 次失敗，${delay}ms 後重試 - ${errorCategory.userMessage}`);
          
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // 拋出更友善的錯誤訊息
      const finalMessage = lastErrorCategory?.userMessage || lastError?.message || '執行失敗';
      throw new Error(finalMessage);
    }

    /**
     * 獲取統計資訊
     */
    getStats() {
      const stats = {
        total: this.retries.size,
        byCount: {}
      };

      this.retries.forEach((entry, key) => {
        const count = entry.count;
        if (!stats.byCount[count]) {
          stats.byCount[count] = 0;
        }
        stats.byCount[count]++;
      });

      return stats;
    }

    /**
     * 清理過期的重試記錄（超過 1 小時未重試）
     */
    cleanup(maxAge) {
      const now = Date.now();
      const age = maxAge || 60 * 60 * 1000; // 1 小時

      const toRemove = [];
      this.retries.forEach((entry, key) => {
        if (now - entry.lastAttempt > age) {
          toRemove.push(key);
        }
      });

      toRemove.forEach(key => this.retries.delete(key));

      if (toRemove.length > 0) {
        console.log(`🧹 [RetryManager] 清理了 ${toRemove.length} 條過期重試記錄`);
      }

      return toRemove.length;
    }
  }

  // ============================================
  // 導出
  // ============================================
  const retryManager = new RetryManager();
  global.LearningUploadRetryManager = retryManager;
  
  // 🎬 導出錯誤分類函數供外部使用
  global.LearningUploadCategorizeError = categorizeError;

  // 定期清理過期記錄
  setInterval(() => {
    retryManager.cleanup();
  }, 10 * 60 * 1000); // 每 10 分鐘

})(window);
