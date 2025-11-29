/**
 * 學習歷程上傳系統 - 防抖與節流工具
 * 提供高效的防抖和節流函數，優化性能
 */

(function (global) {
  'use strict';

  const Config = global.LearningUploadConfig || {};

  // ============================================
  // 防抖函數
  // ============================================
  function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
      const context = this;
      
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      
      if (callNow) func.apply(context, args);
    };
  }

  // ============================================
  // 節流函數
  // ============================================
  function throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      const context = this;
      
      if (!inThrottle) {
        func.apply(context, args);
        inThrottle = true;
        setTimeout(() => {
          inThrottle = false;
        }, limit);
      }
    };
  }

  // ============================================
  // 進階節流（使用 requestAnimationFrame）
  // ============================================
  function rafThrottle(func) {
    let rafId;
    return function executedFunction(...args) {
      const context = this;
      
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      
      rafId = requestAnimationFrame(() => {
        func.apply(context, args);
        rafId = null;
      });
    };
  }

  // ============================================
  // 防抖管理器（可取消）
  // ============================================
  class DebounceManager {
    constructor() {
      this.timers = new Map();
    }

    debounce(key, func, wait, immediate) {
      // 清除現有計時器
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
      }
      
      const timer = setTimeout(() => {
        func();
        this.timers.delete(key);
      }, wait);
      
      this.timers.set(key, timer);
      
      return {
        cancel: () => {
          if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
          }
        }
      };
    }

    cancel(key) {
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
    }

    cancelAll() {
      this.timers.forEach(timer => clearTimeout(timer));
      this.timers.clear();
    }
  }

  // ============================================
  // 節流管理器
  // ============================================
  class ThrottleManager {
    constructor() {
      this.throttles = new Map();
    }

    throttle(key, func, limit) {
      if (this.throttles.has(key)) {
        return this.throttles.get(key);
      }
      
      const throttled = throttle(func, limit);
      this.throttles.set(key, throttled);
      return throttled;
    }

    remove(key) {
      this.throttles.delete(key);
    }

    clear() {
      this.throttles.clear();
    }
  }

  // ============================================
  // 導出
  // ============================================
  const debounceManager = new DebounceManager();
  const throttleManager = new ThrottleManager();

  global.LearningUploadDebounce = {
    debounce: debounce,
    throttle: throttle,
    rafThrottle: rafThrottle,
    manager: debounceManager,
    throttleManager: throttleManager
  };

})(window);
