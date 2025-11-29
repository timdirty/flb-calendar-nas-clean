/**
 * 🎯 檔案上傳進度管理器
 * 
 * 職責：
 * 1. 統一管理所有檔案的上傳進度
 * 2. 事件驅動，不使用輪詢
 * 3. 自動更新 UI（通過事件通知）
 * 4. 記憶體安全（自動清理完成的任務）
 * 
 * 使用方式：
 * ```javascript
 * const progressId = FileProgressManager.create(previewElement, {
 *   fileName: 'photo.jpg',
 *   onComplete: () => console.log('完成')
 * });
 * 
 * FileProgressManager.update(progressId, 50); // 更新到 50%
 * FileProgressManager.complete(progressId);   // 標記完成
 * ```
 * 
 * @version 1.0.0
 * @date 2025-11-18
 */

(function(global) {
  'use strict';

  // ============================================
  // 配置
  // ============================================
  const CONFIG = {
    PROGRESS_BAR_WIDTH: 70,        // 進度條固定寬度（px）
    AUTO_HIDE_DELAY: 200,          // 完成後延遲隱藏時間（ms）
    FADE_OUT_DURATION: 400,        // 淡出動畫時間（ms）
    AUTO_CLEANUP_INTERVAL: 30000,  // 自動清理間隔（ms）
    MAX_COMPLETED_TASKS: 50        // 最多保留的已完成任務數
  };

  // ============================================
  // 進度任務類
  // ============================================
  class ProgressTask {
    constructor(id, previewElement, options = {}) {
      this.id = id;
      this.preview = previewElement;
      this.fileName = options.fileName || '';
      this.percent = 0;
      this.status = 'pending'; // pending, uploading, completed, failed
      this.createdAt = Date.now();
      this.completedAt = null;
      
      // 回調函數
      this.onUpdate = options.onUpdate || null;
      this.onComplete = options.onComplete || null;
      this.onError = options.onError || null;
      
      // UI 元素（延遲創建）
      this.elements = null;
    }

    /**
     * 確保 UI 元素存在
     */
    ensureElements() {
      if (this.elements) return this.elements;
      
      if (!this.preview) {
        console.warn('⚠️ [ProgressTask] preview 元素不存在');
        return null;
      }

      // 查找或創建 overlay
      let overlay = this.preview.querySelector('.file-uploading-overlay');
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'file-uploading-overlay';
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        this.preview.appendChild(overlay);
      }

      // 查找或創建 progress-text
      let progressText = overlay.querySelector('.progress-text');
      if (!progressText) {
        progressText = document.createElement('span');
        progressText.className = 'progress-text';
        progressText.textContent = '等待上傳';
        overlay.insertBefore(progressText, overlay.firstChild);
      }

      // 查找或創建 progress-bar
      let progressBar = overlay.querySelector('.file-upload-progress');
      if (!progressBar) {
        progressBar = document.createElement('div');
        progressBar.className = 'file-upload-progress';
        overlay.appendChild(progressBar);
      }

      // 查找或創建 progress-fill
      let progressFill = progressBar.querySelector('.file-upload-progress-fill');
      if (!progressFill) {
        progressFill = document.createElement('div');
        progressFill.className = 'file-upload-progress-fill';
        progressBar.appendChild(progressFill);
      }

      this.elements = { overlay, progressText, progressBar, progressFill };
      return this.elements;
    }

    /**
     * 更新進度
     */
    updateProgress(percent, statusText) {
      this.percent = Math.max(0, Math.min(100, Number(percent) || 0));
      this.status = this.percent >= 100 ? 'completed' : 'uploading';
      
      const elements = this.ensureElements();
      if (!elements) return;

      // 顯示 overlay
      elements.overlay.style.display = 'flex';
      elements.overlay.style.opacity = '1';
      elements.overlay.style.pointerEvents = 'none';

      // 更新進度條（使用像素值）
      const pixelWidth = Math.round(CONFIG.PROGRESS_BAR_WIDTH * this.percent / 100);
      elements.progressFill.style.width = pixelWidth + 'px';

      // 更新文字
      if (statusText) {
        elements.progressText.textContent = statusText;
      } else {
        elements.progressText.textContent = this.percent + '%';
      }

      // 更新預覽狀態類
      this.preview.classList.remove('pending', 'upload-error');
      this.preview.classList.add('uploading');

      // 觸發回調
      if (typeof this.onUpdate === 'function') {
        try {
          this.onUpdate(this.percent, this);
        } catch (e) {
          console.error('❌ [ProgressTask] onUpdate 回調失敗:', e);
        }
      }

      console.log(`📊 [Progress] ${this.id}: ${this.percent}%`);
    }

    /**
     * 標記完成
     */
    markComplete() {
      this.percent = 100;
      this.status = 'completed';
      this.completedAt = Date.now();

      const elements = this.ensureElements();
      if (!elements) return;

      // 更新到 100%
      const pixelWidth = CONFIG.PROGRESS_BAR_WIDTH;
      elements.progressFill.style.width = pixelWidth + 'px';
      elements.progressText.textContent = '完成';

      // 更新狀態
      this.preview.classList.remove('pending', 'uploading', 'upload-error');
      this.preview.classList.add('upload-success');

      // 延遲後淡出並隱藏 overlay
      setTimeout(() => {
        try {
          elements.overlay.style.transition = `opacity ${CONFIG.FADE_OUT_DURATION}ms ease-out`;
          elements.overlay.style.opacity = '0';

          setTimeout(() => {
            elements.overlay.style.display = 'none';
            elements.overlay.style.pointerEvents = 'none';
            console.log('✅ [Progress] overlay 已隱藏:', this.id);
          }, CONFIG.FADE_OUT_DURATION);
        } catch (e) {
          console.warn('⚠️ [Progress] 隱藏 overlay 失敗:', e);
        }
      }, CONFIG.AUTO_HIDE_DELAY);

      // 觸發回調
      if (typeof this.onComplete === 'function') {
        try {
          this.onComplete(this);
        } catch (e) {
          console.error('❌ [ProgressTask] onComplete 回調失敗:', e);
        }
      }

      console.log(`✅ [Progress] 完成: ${this.id}`);
    }

    /**
     * 標記失敗
     */
    markFailed(errorMessage) {
      this.status = 'failed';
      this.completedAt = Date.now();

      const elements = this.ensureElements();
      if (!elements) return;

      // 顯示錯誤
      elements.overlay.style.display = 'flex';
      elements.overlay.style.opacity = '1';
      elements.progressText.textContent = errorMessage || '上傳失敗';
      elements.progressFill.style.width = '0px';

      // 更新狀態
      this.preview.classList.remove('pending', 'uploading', 'upload-success');
      this.preview.classList.add('upload-error');

      // 觸發回調
      if (typeof this.onError === 'function') {
        try {
          this.onError(errorMessage, this);
        } catch (e) {
          console.error('❌ [ProgressTask] onError 回調失敗:', e);
        }
      }

      console.error(`❌ [Progress] 失敗: ${this.id} - ${errorMessage}`);
    }

    /**
     * 清理資源
     */
    cleanup() {
      this.preview = null;
      this.elements = null;
      this.onUpdate = null;
      this.onComplete = null;
      this.onError = null;
    }
  }

  // ============================================
  // 進度管理器
  // ============================================
  class FileProgressManager {
    constructor() {
      this.tasks = new Map();
      this.eventListeners = new Map();
      this.autoCleanupTimer = null;
      
      this.startAutoCleanup();
      console.log('✅ FileProgressManager 已初始化');
    }

    /**
     * 創建新的進度任務
     */
    create(previewElement, options = {}) {
      const id = options.id || this.generateId();
      
      if (this.tasks.has(id)) {
        console.warn('⚠️ [ProgressManager] 任務已存在，將覆蓋:', id);
        this.remove(id);
      }

      const task = new ProgressTask(id, previewElement, options);
      this.tasks.set(id, task);
      
      this.emit('created', task);
      console.log(`🆕 [ProgressManager] 創建任務: ${id}`);
      
      return id;
    }

    /**
     * 更新進度
     */
    update(taskId, percent, statusText) {
      const task = this.tasks.get(taskId);
      if (!task) {
        console.warn('⚠️ [ProgressManager] 任務不存在:', taskId);
        return false;
      }

      task.updateProgress(percent, statusText);
      this.emit('updated', task);
      return true;
    }

    /**
     * 標記完成
     */
    complete(taskId) {
      const task = this.tasks.get(taskId);
      if (!task) {
        console.warn('⚠️ [ProgressManager] 任務不存在:', taskId);
        return false;
      }

      task.markComplete();
      this.emit('completed', task);
      return true;
    }

    /**
     * 標記失敗
     */
    fail(taskId, errorMessage) {
      const task = this.tasks.get(taskId);
      if (!task) {
        console.warn('⚠️ [ProgressManager] 任務不存在:', taskId);
        return false;
      }

      task.markFailed(errorMessage);
      this.emit('failed', task);
      return true;
    }

    /**
     * 移除任務
     */
    remove(taskId) {
      const task = this.tasks.get(taskId);
      if (!task) return false;

      task.cleanup();
      this.tasks.delete(taskId);
      this.emit('removed', task);
      
      console.log(`🗑️ [ProgressManager] 移除任務: ${taskId}`);
      return true;
    }

    /**
     * 取得任務
     */
    get(taskId) {
      return this.tasks.get(taskId);
    }

    /**
     * 取得所有任務
     */
    getAll() {
      return Array.from(this.tasks.values());
    }

    /**
     * 取得統計資訊
     */
    getStats() {
      const tasks = this.getAll();
      return {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        uploading: tasks.filter(t => t.status === 'uploading').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length
      };
    }

    /**
     * 清理已完成的任務
     */
    cleanupCompleted() {
      const now = Date.now();
      const toRemove = [];

      this.tasks.forEach((task, taskId) => {
        if (task.status === 'completed' || task.status === 'failed') {
          // 完成超過 30 秒的任務才清理
          if (task.completedAt && (now - task.completedAt) > 30000) {
            toRemove.push(taskId);
          }
        }
      });

      // 如果已完成任務過多，強制清理最舊的
      const completedTasks = Array.from(this.tasks.values())
        .filter(t => t.status === 'completed' || t.status === 'failed')
        .sort((a, b) => a.completedAt - b.completedAt);

      if (completedTasks.length > CONFIG.MAX_COMPLETED_TASKS) {
        const excess = completedTasks.length - CONFIG.MAX_COMPLETED_TASKS;
        completedTasks.slice(0, excess).forEach(task => {
          if (!toRemove.includes(task.id)) {
            toRemove.push(task.id);
          }
        });
      }

      toRemove.forEach(taskId => this.remove(taskId));

      if (toRemove.length > 0) {
        console.log(`🧹 [ProgressManager] 清理了 ${toRemove.length} 個已完成任務`);
      }

      return toRemove.length;
    }

    /**
     * 啟動自動清理
     */
    startAutoCleanup() {
      if (this.autoCleanupTimer) return;

      this.autoCleanupTimer = setInterval(() => {
        this.cleanupCompleted();
      }, CONFIG.AUTO_CLEANUP_INTERVAL);

      console.log('✅ [ProgressManager] 自動清理已啟動');
    }

    /**
     * 停止自動清理
     */
    stopAutoCleanup() {
      if (this.autoCleanupTimer) {
        clearInterval(this.autoCleanupTimer);
        this.autoCleanupTimer = null;
        console.log('⏹️ [ProgressManager] 自動清理已停止');
      }
    }

    /**
     * 生成唯一 ID
     */
    generateId() {
      return 'progress-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 監聽事件
     */
    on(event, callback) {
      if (!this.eventListeners.has(event)) {
        this.eventListeners.set(event, new Set());
      }
      this.eventListeners.get(event).add(callback);
      
      // 返回取消監聽的函數
      return () => this.off(event, callback);
    }

    /**
     * 取消監聽
     */
    off(event, callback) {
      const listeners = this.eventListeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    }

    /**
     * 觸發事件
     */
    emit(event, data) {
      const listeners = this.eventListeners.get(event);
      if (!listeners) return;

      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`❌ [ProgressManager] 事件監聽器執行失敗 (${event}):`, e);
        }
      });
    }

    /**
     * 銷毀管理器
     */
    destroy() {
      this.stopAutoCleanup();
      this.tasks.forEach((task, taskId) => this.remove(taskId));
      this.eventListeners.clear();
      console.log('🔥 [ProgressManager] 已銷毀');
    }
  }

  // ============================================
  // 導出
  // ============================================
  const manager = new FileProgressManager();
  
  global.FileProgressManager = manager;
  
  // 便捷函數
  global.createFileProgress = (preview, options) => manager.create(preview, options);
  global.updateFileProgress = (id, percent, text) => manager.update(id, percent, text);
  global.completeFileProgress = (id) => manager.complete(id);
  global.failFileProgress = (id, error) => manager.fail(id, error);

  console.log('✅ FileProgressManager v1.0.0 已載入');

})(window);
