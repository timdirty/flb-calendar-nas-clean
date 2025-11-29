/**
 * ============================================
 * Worker 池管理器
 * ============================================
 * 功能：管理 Web Worker 池，分配任務並處理降級
 */

(function (global) {
  'use strict';

  // ==================== 配置 ====================
  const CONFIG = {
    maxWorkers: 2,              // 最大 Worker 數量
    idleTimeout: 30000,         // Worker 閒置超時（30秒）
    taskTimeout: 15000,         // 任務超時（15秒）
    enableWorker: true          // 是否啟用 Worker（可動態調整）
  };

  // ==================== Worker 池 ====================
  class WorkerPool {
    constructor(workerScript, options = {}) {
      this.workerScript = workerScript;
      this.config = { ...CONFIG, ...options };
      this.workers = [];
      this.taskQueue = [];
      this.taskId = 0;
      this.pendingTasks = new Map(); // taskId -> { resolve, reject, timeout }
      
      // 檢測 Worker 支援
      this.isWorkerSupported = this.checkWorkerSupport();
      
      console.log('🚀 [WorkerPool] 初始化', {
        script: workerScript,
        supported: this.isWorkerSupported,
        maxWorkers: this.config.maxWorkers
      });
    }

    /**
     * 檢查 Worker 支援
     */
    checkWorkerSupport() {
      if (!this.config.enableWorker) return false;
      
      try {
        return typeof Worker !== 'undefined' && 
               typeof OffscreenCanvas !== 'undefined';
      } catch (e) {
        console.warn('⚠️ [WorkerPool] Worker 不支援:', e);
        return false;
      }
    }

    /**
     * 執行任務
     */
    async execute(type, data, options = {}) {
      const taskId = ++this.taskId;
      
      // 如果不支援 Worker，直接返回錯誤（讓調用方降級）
      if (!this.isWorkerSupported) {
        return Promise.reject(new Error('Worker 不支援'));
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingTasks.delete(taskId);
          reject(new Error('任務超時'));
        }, options.timeout || this.config.taskTimeout);

        this.pendingTasks.set(taskId, { resolve, reject, timeout });

        // 將任務加入隊列
        this.taskQueue.push({
          id: taskId,
          type,
          data,
          options
        });

        // 處理隊列
        this.processQueue();
      });
    }

    /**
     * 處理任務隊列
     */
    async processQueue() {
      // 如果沒有待處理任務，返回
      if (this.taskQueue.length === 0) return;

      // 尋找空閒的 Worker
      let worker = this.findIdleWorker();

      // 如果沒有空閒 Worker，且未達上限，創建新的
      if (!worker && this.workers.length < this.config.maxWorkers) {
        worker = await this.createWorker();
      }

      // 如果有空閒 Worker，分配任務
      if (worker) {
        const task = this.taskQueue.shift();
        this.assignTask(worker, task);
        
        // 繼續處理隊列
        this.processQueue();
      }
    }

    /**
     * 尋找空閒 Worker
     */
    findIdleWorker() {
      return this.workers.find(w => !w.busy);
    }

    /**
     * 創建新 Worker
     */
    async createWorker() {
      try {
        const worker = new Worker(this.workerScript);
        const wrappedWorker = {
          instance: worker,
          busy: false,
          lastUsed: Date.now(),
          id: this.workers.length + 1
        };

        // 監聽訊息
        worker.addEventListener('message', (event) => {
          this.handleWorkerMessage(wrappedWorker, event);
        });

        // 監聽錯誤
        worker.addEventListener('error', (event) => {
          console.error('❌ [WorkerPool] Worker 錯誤:', event);
          this.handleWorkerError(wrappedWorker, event);
        });

        this.workers.push(wrappedWorker);
        console.log('✅ [WorkerPool] 創建 Worker #' + wrappedWorker.id);

        return wrappedWorker;
      } catch (error) {
        console.error('❌ [WorkerPool] 創建 Worker 失敗:', error);
        this.isWorkerSupported = false;
        return null;
      }
    }

    /**
     * 分配任務給 Worker
     */
    assignTask(worker, task) {
      worker.busy = true;
      worker.currentTaskId = task.id;
      worker.lastUsed = Date.now();

      console.log('📤 [WorkerPool] 分配任務', {
        workerId: worker.id,
        taskId: task.id,
        type: task.type
      });

      // 發送訊息給 Worker
      worker.instance.postMessage({
        id: task.id,
        type: task.type,
        data: task.data
      });
    }

    /**
     * 處理 Worker 訊息
     */
    handleWorkerMessage(worker, event) {
      const { id, type, data, error } = event.data;

      worker.busy = false;
      worker.currentTaskId = null;

      const pendingTask = this.pendingTasks.get(id);
      if (!pendingTask) {
        console.warn('⚠️ [WorkerPool] 未找到待處理任務:', id);
        return;
      }

      // 清除超時
      clearTimeout(pendingTask.timeout);
      this.pendingTasks.delete(id);

      // 處理結果
      if (type === 'success') {
        console.log('✅ [WorkerPool] 任務完成:', id);
        pendingTask.resolve(data);
      } else if (type === 'error') {
        console.error('❌ [WorkerPool] 任務失敗:', id, error);
        pendingTask.reject(new Error(error.message));
      }

      // 繼續處理隊列
      this.processQueue();
    }

    /**
     * 處理 Worker 錯誤
     */
    handleWorkerError(worker, event) {
      worker.busy = false;
      
      if (worker.currentTaskId) {
        const pendingTask = this.pendingTasks.get(worker.currentTaskId);
        if (pendingTask) {
          clearTimeout(pendingTask.timeout);
          this.pendingTasks.delete(worker.currentTaskId);
          pendingTask.reject(new Error('Worker 執行錯誤'));
        }
        worker.currentTaskId = null;
      }
    }

    /**
     * 清理閒置 Worker
     */
    cleanup() {
      const now = Date.now();
      this.workers = this.workers.filter(worker => {
        if (worker.busy) return true;
        
        const idle = now - worker.lastUsed;
        if (idle > this.config.idleTimeout) {
          console.log('🧹 [WorkerPool] 終止閒置 Worker #' + worker.id);
          worker.instance.terminate();
          return false;
        }
        
        return true;
      });
    }

    /**
     * 終止所有 Worker
     */
    terminateAll() {
      console.log('🛑 [WorkerPool] 終止所有 Worker');
      this.workers.forEach(worker => {
        worker.instance.terminate();
      });
      this.workers = [];
      this.taskQueue = [];
      this.pendingTasks.clear();
    }

    /**
     * 獲取統計資訊
     */
    getStats() {
      return {
        totalWorkers: this.workers.length,
        busyWorkers: this.workers.filter(w => w.busy).length,
        queuedTasks: this.taskQueue.length,
        pendingTasks: this.pendingTasks.size,
        supported: this.isWorkerSupported
      };
    }
  }

  // ==================== 全域單例 ====================
  let videoThumbnailWorkerPool = null;

  /**
   * 獲取或創建影片縮圖 Worker 池
   */
  function getVideoThumbnailWorkerPool() {
    if (!videoThumbnailWorkerPool) {
      videoThumbnailWorkerPool = new WorkerPool(
        '/js/workers/video-thumbnail-worker.js',
        { maxWorkers: 2 }
      );
      
      // 定期清理閒置 Worker
      setInterval(() => {
        if (videoThumbnailWorkerPool) {
          videoThumbnailWorkerPool.cleanup();
        }
      }, 60000); // 每分鐘檢查一次
    }
    return videoThumbnailWorkerPool;
  }

  // ==================== 頁面卸載時清理 ====================
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      if (videoThumbnailWorkerPool) {
        videoThumbnailWorkerPool.terminateAll();
      }
    });
  }

  // ==================== 導出 ====================
  const WorkerPoolManager = {
    WorkerPool,
    getVideoThumbnailWorkerPool
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkerPoolManager;
  } else if (typeof global !== 'undefined') {
    global.WorkerPoolManager = WorkerPoolManager;
  }

})(typeof window !== 'undefined' ? window : this);

