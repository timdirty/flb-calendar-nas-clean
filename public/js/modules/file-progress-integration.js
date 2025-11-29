/**
 * 🔌 FileProgressManager 整合層
 * 
 * 職責：
 * 1. 提供向後相容的介面
 * 2. 自動偵測並使用新/舊系統
 * 3. 簡化上層代碼的遷移
 * 
 * 使用方式：
 * ```javascript
 * // 不需改動上層邏輯，自動選擇最佳實現
 * const progress = FileProgress.create(preview, { fileName: 'photo.jpg' });
 * FileProgress.update(progress, 50);
 * FileProgress.complete(progress);
 * ```
 * 
 * @version 1.0.0
 * @date 2025-11-18
 */

(function(global) {
  'use strict';

  // ============================================
  // 相容層：統一介面
  // ============================================
  const FileProgress = {
    /**
     * 創建進度追蹤
     * @param {HTMLElement} preview - 預覽元素
     * @param {Object} options - 選項
     * @returns {string} 進度 ID
     */
    create(preview, options = {}) {
      // 優先使用新系統
      if (global.FileProgressManager) {
        return global.FileProgressManager.create(preview, options);
      }
      
      // 回退到舊系統
      console.warn('⚠️ FileProgressManager 未載入，使用舊系統');
      return this._createLegacy(preview, options);
    },

    /**
     * 更新進度
     * @param {string} id - 進度 ID
     * @param {number} percent - 百分比（0-100）
     * @param {string} [statusText] - 狀態文字
     */
    update(id, percent, statusText) {
      if (global.FileProgressManager) {
        return global.FileProgressManager.update(id, percent, statusText);
      }
      
      return this._updateLegacy(id, percent, statusText);
    },

    /**
     * 標記完成
     * @param {string} id - 進度 ID
     */
    complete(id) {
      if (global.FileProgressManager) {
        return global.FileProgressManager.complete(id);
      }
      
      return this._completeLegacy(id);
    },

    /**
     * 標記失敗
     * @param {string} id - 進度 ID
     * @param {string} errorMessage - 錯誤訊息
     */
    fail(id, errorMessage) {
      if (global.FileProgressManager) {
        return global.FileProgressManager.fail(id, errorMessage);
      }
      
      return this._failLegacy(id, errorMessage);
    },

    /**
     * 移除進度
     * @param {string} id - 進度 ID
     */
    remove(id) {
      if (global.FileProgressManager) {
        return global.FileProgressManager.remove(id);
      }
      
      return this._removeLegacy(id);
    },

    /**
     * 取得統計
     */
    getStats() {
      if (global.FileProgressManager) {
        return global.FileProgressManager.getStats();
      }
      
      return {
        total: this._legacyTasks.size,
        pending: 0,
        uploading: 0,
        completed: 0,
        failed: 0
      };
    },

    // ============================================
    // 舊系統實現（回退方案）
    // ============================================
    _legacyTasks: new Map(),

    _createLegacy(preview, options) {
      const id = options.id || 'legacy-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      
      // 使用舊的 ensureFilePreviewOverlay
      let helpers = null;
      if (typeof global.ensureFilePreviewOverlay === 'function') {
        helpers = global.ensureFilePreviewOverlay(preview);
      }

      this._legacyTasks.set(id, {
        id,
        preview,
        helpers,
        percent: 0,
        options
      });

      return id;
    },

    _updateLegacy(id, percent, statusText) {
      const task = this._legacyTasks.get(id);
      if (!task) return false;

      task.percent = percent;

      // 使用舊的 setPreviewProgress
      if (typeof global.setPreviewProgress === 'function') {
        global.setPreviewProgress(task.preview, percent);
      } else if (task.helpers) {
        const pixelWidth = Math.round(70 * percent / 100);
        task.helpers.progressFill.style.width = pixelWidth + 'px';
        if (statusText && task.helpers.progressText) {
          task.helpers.progressText.textContent = statusText;
        }
      }

      return true;
    },

    _completeLegacy(id) {
      const task = this._legacyTasks.get(id);
      if (!task) return false;

      // 使用舊的 setPreviewProgress
      if (typeof global.setPreviewProgress === 'function') {
        global.setPreviewProgress(task.preview, 100);
      }

      // 標記完成
      task.preview.classList.remove('pending', 'uploading');
      task.preview.classList.add('upload-success');

      // 延遲隱藏 overlay
      setTimeout(() => {
        if (task.helpers && task.helpers.overlay) {
          task.helpers.overlay.style.opacity = '0';
          setTimeout(() => {
            task.helpers.overlay.style.display = 'none';
          }, 400);
        }
      }, 200);

      // 觸發回調
      if (typeof task.options.onComplete === 'function') {
        try {
          task.options.onComplete();
        } catch (e) {
          console.error('❌ onComplete 回調失敗:', e);
        }
      }

      return true;
    },

    _failLegacy(id, errorMessage) {
      const task = this._legacyTasks.get(id);
      if (!task) return false;

      task.preview.classList.remove('pending', 'uploading');
      task.preview.classList.add('upload-error');

      if (task.helpers && task.helpers.progressText) {
        task.helpers.progressText.textContent = errorMessage || '上傳失敗';
      }

      // 觸發回調
      if (typeof task.options.onError === 'function') {
        try {
          task.options.onError(errorMessage);
        } catch (e) {
          console.error('❌ onError 回調失敗:', e);
        }
      }

      return true;
    },

    _removeLegacy(id) {
      return this._legacyTasks.delete(id);
    }
  };

  // ============================================
  // 便捷工具函數
  // ============================================

  /**
   * 批次創建進度
   * @param {Array<HTMLElement>} previews - 預覽元素陣列
   * @param {Object} baseOptions - 基礎選項
   * @returns {Array<string>} 進度 ID 陣列
   */
  FileProgress.createBatch = function(previews, baseOptions = {}) {
    return previews.map((preview, index) => {
      const options = {
        ...baseOptions,
        id: baseOptions.id ? `${baseOptions.id}-${index}` : undefined
      };
      return this.create(preview, options);
    });
  };

  /**
   * 批次更新進度
   * @param {Array<string>} ids - 進度 ID 陣列
   * @param {number} percent - 百分比
   * @param {string} [statusText] - 狀態文字
   */
  FileProgress.updateBatch = function(ids, percent, statusText) {
    ids.forEach(id => this.update(id, percent, statusText));
  };

  /**
   * 批次完成
   * @param {Array<string>} ids - 進度 ID 陣列
   */
  FileProgress.completeBatch = function(ids) {
    ids.forEach(id => this.complete(id));
  };

  /**
   * 監聽進度事件（僅新系統支援）
   * @param {string} event - 事件名稱
   * @param {Function} callback - 回調函數
   * @returns {Function} 取消監聽函數
   */
  FileProgress.on = function(event, callback) {
    if (global.FileProgressManager) {
      return global.FileProgressManager.on(event, callback);
    }
    
    console.warn('⚠️ 事件監聽僅在新系統中支援');
    return () => {};
  };

  /**
   * 清理已完成的任務
   */
  FileProgress.cleanup = function() {
    if (global.FileProgressManager) {
      return global.FileProgressManager.cleanupCompleted();
    }
    
    // 舊系統手動清理
    const toRemove = [];
    this._legacyTasks.forEach((task, id) => {
      if (task.percent >= 100) {
        toRemove.push(id);
      }
    });
    toRemove.forEach(id => this._legacyTasks.delete(id));
    return toRemove.length;
  };

  // ============================================
  // 導出
  // ============================================
  global.FileProgress = FileProgress;

  console.log('✅ FileProgress 整合層已載入');
  console.log('   使用系統:', global.FileProgressManager ? '新系統 (FileProgressManager)' : '舊系統 (回退)');

})(window);
