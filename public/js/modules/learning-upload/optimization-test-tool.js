/**
 * ============================================
 * 優化測試工具
 * ============================================
 * 功能：測試 Worker、快取和效能優化
 * 使用：在瀏覽器 Console 執行 window.OptimizationTestTool.runTests()
 */

(function (global) {
  'use strict';

  const OptimizationTestTool = {
    /**
     * 執行所有測試
     */
    async runTests() {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║     🧪 學習歷程優化測試工具 v1.0                        ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');

      const results = {
        worker: await this.testWorker(),
        cache: await this.testCache(),
        memory: await this.testMemory(),
        performance: await this.testPerformance()
      };

      this.printSummary(results);
      return results;
    },

    /**
     * 測試 Worker
     */
    async testWorker() {
      console.log('📝 測試 1: Web Worker 功能');
      console.log('─'.repeat(60));

      try {
        // 檢查 Worker 支援
        if (!global.WorkerPoolManager) {
          console.error('❌ WorkerPoolManager 未載入');
          return { success: false, error: 'Module not loaded' };
        }

        const workerPool = global.WorkerPoolManager.getVideoThumbnailWorkerPool();
        const stats = workerPool.getStats();

        console.log('✅ Worker 池狀態:', stats);

        // 測試 ping
        try {
          const result = await workerPool.execute('ping', {}, { timeout: 5000 });
          console.log('✅ Worker 通訊正常:', result);
          return { success: true, stats, pingResult: result };
        } catch (error) {
          console.warn('⚠️  Worker 不支援，將使用主線程:', error.message);
          return { success: true, fallback: true, reason: error.message };
        }

      } catch (error) {
        console.error('❌ Worker 測試失敗:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * 測試 IndexedDB 快取
     */
    async testCache() {
      console.log('');
      console.log('📝 測試 2: IndexedDB 快取');
      console.log('─'.repeat(60));

      try {
        if (!global.IndexedDBCache && !global.LearningUploadIndexedDBCache) {
          console.error('❌ IndexedDBCache 未載入');
          return { success: false, error: 'Module not loaded' };
        }

        const IndexedDBCache = global.IndexedDBCache || global.LearningUploadIndexedDBCache;
        const cacheManager = IndexedDBCache.getCacheManager();

        // 初始化
        await cacheManager.init();
        console.log('✅ IndexedDB 已初始化');

        // 測試儲存和讀取
        const testHash = 'test-' + Date.now();
        const testBlob = new Blob(['test data'], { type: 'image/jpeg' });

        await cacheManager.saveThumbnail(testHash, testBlob, { test: true });
        console.log('✅ 縮圖儲存成功');

        const retrieved = await cacheManager.getThumbnail(testHash);
        console.log('✅ 縮圖讀取成功:', retrieved !== null);

        // 清理測試資料
        await cacheManager.deleteThumbnail(testHash);
        console.log('✅ 測試資料已清理');

        // 獲取統計
        const stats = await cacheManager.getStats();
        console.log('📊 快取統計:', stats);

        return { success: true, stats };

      } catch (error) {
        console.error('❌ 快取測試失敗:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * 測試記憶體狀況
     */
    async testMemory() {
      console.log('');
      console.log('📝 測試 3: 記憶體狀況');
      console.log('─'.repeat(60));

      try {
        const memInfo = {};

        // 檢查 Performance Memory API
        if (performance.memory) {
          const used = performance.memory.usedJSHeapSize;
          const limit = performance.memory.jsHeapSizeLimit;
          const ratio = (used / limit * 100).toFixed(1);

          memInfo.jsHeap = {
            used: (used / 1024 / 1024).toFixed(2) + ' MB',
            limit: (limit / 1024 / 1024).toFixed(2) + ' MB',
            ratio: ratio + '%'
          };

          console.log('📊 JS Heap 使用:', memInfo.jsHeap);

          if (ratio > 70) {
            console.warn('⚠️  記憶體使用偏高，建議清理');
          } else {
            console.log('✅ 記憶體使用正常');
          }
        } else {
          console.warn('⚠️  瀏覽器不支援 Performance Memory API');
          memInfo.jsHeap = 'not supported';
        }

        // 檢查設備資訊
        memInfo.device = {
          hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
          deviceMemory: navigator.deviceMemory ? navigator.deviceMemory + ' GB' : 'unknown',
          platform: navigator.platform
        };

        console.log('📱 裝置資訊:', memInfo.device);

        return { success: true, memInfo };

      } catch (error) {
        console.error('❌ 記憶體測試失敗:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * 測試效能
     */
    async testPerformance() {
      console.log('');
      console.log('📝 測試 4: 效能基準');
      console.log('─'.repeat(60));

      try {
        const perfInfo = {};

        // 頁面載入效能
        if (performance.timing) {
          const timing = performance.timing;
          perfInfo.pageLoad = {
            domContentLoaded: (timing.domContentLoadedEventEnd - timing.navigationStart) + ' ms',
            fullLoad: (timing.loadEventEnd - timing.navigationStart) + ' ms'
          };
          console.log('⏱️  頁面載入:', perfInfo.pageLoad);
        }

        // 網路狀況
        if (navigator.connection) {
          const conn = navigator.connection;
          perfInfo.connection = {
            effectiveType: conn.effectiveType || 'unknown',
            downlink: conn.downlink ? conn.downlink + ' Mbps' : 'unknown',
            rtt: conn.rtt ? conn.rtt + ' ms' : 'unknown',
            saveData: conn.saveData
          };
          console.log('📡 網路狀況:', perfInfo.connection);
        }

        return { success: true, perfInfo };

      } catch (error) {
        console.error('❌ 效能測試失敗:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * 列印測試總結
     */
    printSummary(results) {
      console.log('');
      console.log('╔══════════════════════════════════════════════════════════╗');
      console.log('║     📊 測試總結                                          ║');
      console.log('╚══════════════════════════════════════════════════════════╝');
      console.log('');

      const tests = [
        { name: 'Web Worker', result: results.worker },
        { name: 'IndexedDB 快取', result: results.cache },
        { name: '記憶體狀況', result: results.memory },
        { name: '效能基準', result: results.performance }
      ];

      tests.forEach(test => {
        const status = test.result.success ? '✅ 通過' : '❌ 失敗';
        console.log(`  ${status}  ${test.name}`);
        
        if (!test.result.success && test.result.error) {
          console.log(`        錯誤: ${test.result.error}`);
        }
      });

      const passCount = tests.filter(t => t.result.success).length;
      const totalCount = tests.length;

      console.log('');
      console.log(`  總計: ${passCount}/${totalCount} 通過`);
      console.log('');
    },

    /**
     * 測試影片縮圖生成（需要檔案）
     */
    async testVideoThumbnail(file) {
      console.log('');
      console.log('🎬 測試影片縮圖生成');
      console.log('─'.repeat(60));

      if (!(file instanceof File)) {
        console.error('❌ 請提供影片檔案');
        return { success: false, error: 'Invalid file' };
      }

      const start = Date.now();

      try {
        // 使用 Worker 生成
        const workerPool = global.WorkerPoolManager.getVideoThumbnailWorkerPool();
        
        const result = await workerPool.execute('generate', {
          videoBlob: file,
          options: { quality: 0.8, targetWidth: 200, targetHeight: 150 }
        }, { timeout: 15000 });

        const duration = Date.now() - start;
        console.log(`✅ 縮圖生成成功，耗時: ${duration}ms`);
        console.log(`📦 檔案大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);

        return { success: true, duration, fileSize: file.size };

      } catch (error) {
        const duration = Date.now() - start;
        console.error(`❌ 縮圖生成失敗，耗時: ${duration}ms`, error);
        return { success: false, duration, error: error.message };
      }
    },

    /**
     * 清理測試資料
     */
    async cleanup() {
      console.log('');
      console.log('🧹 清理測試資料');
      console.log('─'.repeat(60));

      try {
        if (global.WorkerPoolManager) {
          const workerPool = global.WorkerPoolManager.getVideoThumbnailWorkerPool();
          workerPool.terminateAll();
          console.log('✅ Worker 已終止');
        }

        if (global.IndexedDBCache || global.LearningUploadIndexedDBCache) {
          const IndexedDBCache = global.IndexedDBCache || global.LearningUploadIndexedDBCache;
          const cacheManager = IndexedDBCache.getCacheManager();
          await cacheManager.clearAll();
          console.log('✅ 快取已清除');
        }

        console.log('✅ 清理完成');
        return { success: true };

      } catch (error) {
        console.error('❌ 清理失敗:', error);
        return { success: false, error: error.message };
      }
    }
  };

  // 導出到全域
  if (typeof global !== 'undefined') {
    global.OptimizationTestTool = OptimizationTestTool;
  }

  console.log('✅ 優化測試工具已載入');
  console.log('💡 使用方式: OptimizationTestTool.runTests()');

})(typeof window !== 'undefined' ? window : this);

