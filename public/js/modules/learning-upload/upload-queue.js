/**
 * 學習歷程上傳系統 - 上傳佇列管理器
 * 管理上傳佇列、併發控制、優先級處理
 */

(function (global) {
  'use strict';

  const State = global.LearningUploadState;
  const Config = global.LearningUploadConfig;
  const Constants = global.LearningUploadConstants;

  // ============================================
  // 上傳佇列管理器
  // ============================================
  class UploadQueue {
    constructor() {
      this.queue = []; // 待處理任務
      this.active = new Map(); // 進行中任務
      this.completed = new Map(); // 已完成任務
      this.failed = new Map(); // 失敗任務
      
      this.maxConcurrency = Config.get('upload.concurrency') || 3;
      this.isProcessing = false;
      
      // 動態調整並發數
      this.adjustConcurrency();
    }

    /**
     * 動態調整並發數（根據設備性能）
     */
    adjustConcurrency() {
      const isLowEnd = Config.detectLowEndDevice && Config.detectLowEndDevice();
      
      if (isLowEnd) {
        this.maxConcurrency = 2; // 低階設備降低併發
      } else {
        this.maxConcurrency = Config.get('upload.concurrency') || 3;
      }
      
      console.log(`📡 [UploadQueue] 並發數設定為: ${this.maxConcurrency}`);
    }

    /**
     * 添加任務到佇列
     */
    add(task) {
      if (!task || !task.id || !task.execute) {
        console.error('❌ [UploadQueue] 無效的任務');
        return false;
      }

      // 檢查是否已存在
      if (this.active.has(task.id) || this.queue.find(t => t.id === task.id)) {
        console.warn('⚠️ [UploadQueue] 任務已存在:', task.id);
        return false;
      }

      task.priority = task.priority || 0;
      task.addedAt = Date.now();
      task.status = 'pending';

      this.queue.push(task);
      
      // 按優先級排序（高優先級在前）
      this.queue.sort((a, b) => b.priority - a.priority);

      console.log(`➕ [UploadQueue] 添加任務: ${task.id} (優先級: ${task.priority})`);

      // 觸發處理
      this.process();

      return true;
    }

    /**
     * 移除任務
     */
    remove(taskId) {
      const index = this.queue.findIndex(t => t.id === taskId);
      if (index > -1) {
        this.queue.splice(index, 1);
        console.log(`➖ [UploadQueue] 移除任務: ${taskId}`);
        return true;
      }

      // 嘗試取消進行中的任務
      if (this.active.has(taskId)) {
        const task = this.active.get(taskId);
        if (task.cancel) {
          task.cancel();
        }
        this.active.delete(taskId);
        console.log(`🚫 [UploadQueue] 取消任務: ${taskId}`);
        return true;
      }

      return false;
    }

    /**
     * 處理佇列
     */
    async process() {
      if (this.isProcessing) return;
      this.isProcessing = true;

      while (this.queue.length > 0 && this.active.size < this.maxConcurrency) {
        const task = this.queue.shift();
        if (!task) continue;

        this.executeTask(task);
      }

      this.isProcessing = false;
    }

    /**
     * 執行單個任務
     */
    async executeTask(task) {
      task.status = 'active';
      task.startedAt = Date.now();
      this.active.set(task.id, task);

      console.log(`▶️ [UploadQueue] 開始執行: ${task.id}`);

      try {
        const result = await task.execute();
        
        task.status = 'completed';
        task.completedAt = Date.now();
        task.result = result;
        
        this.active.delete(task.id);
        this.completed.set(task.id, task);

        console.log(`✅ [UploadQueue] 完成: ${task.id}`);

        // 觸發完成回調
        if (task.onComplete) {
          task.onComplete(result);
        }

      } catch (error) {
        task.status = 'failed';
        task.failedAt = Date.now();
        task.error = error;

        this.active.delete(task.id);
        this.failed.set(task.id, task);

        console.error(`❌ [UploadQueue] 失敗: ${task.id}`, error);

        // 觸發失敗回調
        if (task.onError) {
          task.onError(error);
        }

      } finally {
        // 繼續處理下一個任務
        this.process();
      }
    }

    /**
     * 清空佇列
     */
    clear() {
      this.queue = [];
      
      // 取消所有進行中的任務
      this.active.forEach(task => {
        if (task.cancel) {
          task.cancel();
        }
      });
      
      this.active.clear();
      console.log('🧹 [UploadQueue] 已清空佇列');
    }

    /**
     * 暫停佇列
     */
    pause() {
      this.isPaused = true;
      console.log('⏸️ [UploadQueue] 已暫停');
    }

    /**
     * 恢復佇列
     */
    resume() {
      this.isPaused = false;
      console.log('▶️ [UploadQueue] 已恢復');
      this.process();
    }

    /**
     * 獲取統計資訊
     */
    getStats() {
      return {
        pending: this.queue.length,
        active: this.active.size,
        completed: this.completed.size,
        failed: this.failed.size,
        maxConcurrency: this.maxConcurrency
      };
    }

    /**
     * 獲取任務狀態
     */
    getTaskStatus(taskId) {
      if (this.active.has(taskId)) return 'active';
      if (this.completed.has(taskId)) return 'completed';
      if (this.failed.has(taskId)) return 'failed';
      if (this.queue.find(t => t.id === taskId)) return 'pending';
      return 'not_found';
    }

    /**
     * 清理已完成的任務（釋放記憶體）
     */
    cleanup(maxAge) {
      const now = Date.now();
      const age = maxAge || 10 * 60 * 1000; // 10 分鐘

      // 清理已完成的任務
      const completedToRemove = [];
      this.completed.forEach((task, id) => {
        if (now - task.completedAt > age) {
          completedToRemove.push(id);
        }
      });
      completedToRemove.forEach(id => this.completed.delete(id));

      // 清理失敗的任務
      const failedToRemove = [];
      this.failed.forEach((task, id) => {
        if (now - task.failedAt > age) {
          failedToRemove.push(id);
        }
      });
      failedToRemove.forEach(id => this.failed.delete(id));

      const total = completedToRemove.length + failedToRemove.length;
      if (total > 0) {
        console.log(`🧹 [UploadQueue] 清理了 ${total} 個舊任務記錄`);
      }

      return total;
    }
  }

  // ============================================
  // 導出
  // ============================================
  const uploadQueue = new UploadQueue();
  global.LearningUploadQueue = uploadQueue;

  // 定期清理舊任務
  setInterval(() => {
    uploadQueue.cleanup();
  }, 5 * 60 * 1000); // 每 5 分鐘

})(window);
