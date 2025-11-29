/**
 * 學習歷程上傳系統 - 自動測試工具
 * 驗證所有新模組是否正確載入和運作
 */

(function (global) {
  'use strict';

  // ============================================
  // 測試框架
  // ============================================
  class SelfTest {
    constructor() {
      this.tests = [];
      this.results = [];
      this.startTime = null;
    }

    /**
     * 添加測試
     */
    add(name, testFn) {
      this.tests.push({ name, testFn });
    }

    /**
     * 執行所有測試
     */
    async runAll() {
      try {
        console.log('');
        console.log('═══════════════════════════════════════════');
        console.log('🧪 學習歷程上傳系統 - 自動測試');
        console.log('═══════════════════════════════════════════');
        console.log('');

        this.startTime = Date.now();
        this.results = [];

        for (const test of this.tests) {
          await this.runTest(test);
        }

        return this.printSummary();
      } catch (error) {
        console.error('❌ 測試執行異常:', error);
        return {
          total: 0,
          passed: 0,
          failed: 1,
          duration: 0,
          success: false,
          error: error.message
        };
      }
    }

    /**
     * 執行單一測試
     */
    async runTest(test) {
      const startTime = Date.now();
      let result = {
        name: test.name,
        passed: false,
        error: null,
        duration: 0
      };

      try {
        await test.testFn();
        result.passed = true;
        console.log(`✅ PASS: ${test.name}`);
      } catch (error) {
        result.error = error.message;
        console.error(`❌ FAIL: ${test.name}`);
        console.error(`   錯誤: ${error.message}`);
      }

      result.duration = Date.now() - startTime;
      this.results.push(result);
    }

    /**
     * 打印測試摘要
     */
    printSummary() {
      const totalDuration = Date.now() - this.startTime;
      const passed = this.results.filter(r => r.passed).length;
      const failed = this.results.filter(r => !r.passed).length;
      const total = this.results.length;

      console.log('');
      console.log('═══════════════════════════════════════════');
      console.log('📊 測試摘要');
      console.log('═══════════════════════════════════════════');
      console.log(`總計: ${total} 個測試`);
      console.log(`通過: ${passed} ✅`);
      console.log(`失敗: ${failed} ❌`);
      console.log(`耗時: ${totalDuration}ms`);
      console.log('═══════════════════════════════════════════');
      console.log('');

      if (failed > 0) {
        console.log('失敗的測試:');
        this.results.filter(r => !r.passed).forEach(r => {
          console.log(`  ❌ ${r.name}: ${r.error}`);
        });
        console.log('');
      }

      // 返回測試結果
      return {
        total: total,
        passed: passed,
        failed: failed,
        duration: totalDuration,
        success: failed === 0
      };
    }

    /**
     * 斷言輔助函數
     */
    assert(condition, message) {
      if (!condition) {
        throw new Error(message || '斷言失敗');
      }
    }

    assertEquals(actual, expected, message) {
      if (actual !== expected) {
        throw new Error(message || `期望 ${expected}，實際 ${actual}`);
      }
    }

    assertExists(value, message) {
      if (value === null || value === undefined) {
        throw new Error(message || '值不存在');
      }
    }

    assertType(value, type, message) {
      if (typeof value !== type) {
        throw new Error(message || `期望類型 ${type}，實際 ${typeof value}`);
      }
    }
  }

  // ============================================
  // 定義測試案例
  // ============================================
  const selfTest = new SelfTest();

  // 測試 1: 檢查所有新模組是否載入
  selfTest.add('模組載入檢查', () => {
    const modules = {
      'UploadManager': global.LearningUploadManager,
      'UploadProgress': global.LearningUploadProgress,
      'MediaPreviewManager': global.LearningMediaPreviewManager,
      'CourseRenderer': global.LearningCourseRenderer,
      'StudentRenderer': global.LearningStudentRenderer,
      'OverviewRenderer': global.LearningOverviewRenderer,
      'IntegrationLayer': global.LearningIntegrationLayer
    };

    Object.keys(modules).forEach(name => {
      selfTest.assertExists(modules[name], `${name} 模組未載入`);
    });
  });

  // 測試 2: UploadManager 基本功能
  selfTest.add('UploadManager 基本功能', () => {
    const manager = global.LearningUploadManager;
    selfTest.assertExists(manager, 'UploadManager 不存在');
    selfTest.assertType(manager.validateUploadData, 'function', 'validateUploadData 不是函數');
    selfTest.assertType(manager.prepareFormData, 'function', 'prepareFormData 不是函數');
    selfTest.assertType(manager.upload, 'function', 'upload 不是函數');

    // 創建模擬的 File 對象（使用 Object.defineProperty 正確設置屬性）
    const mockFile = (name, size = 1024) => {
      const blob = new Blob(['test'], { type: 'image/jpeg' });
      // 使用 Object.defineProperty 添加 name 和 size 屬性
      Object.defineProperty(blob, 'name', {
        value: name,
        writable: false,
        enumerable: true
      });
      // Blob 已經有 size 屬性，無需覆蓋
      return blob;
    };

    // 測試驗證功能
    const validation = manager.validateUploadData({
      studentName: '測試學生',
      eventId: 'test-123',
      date: '2025-11-05',
      photos: [mockFile('photo1.jpg'), mockFile('photo2.jpg'), mockFile('photo3.jpg')],
      comment: '這是一個測試評語，超過二十個字，內容豐富完整'
    }, 'student');

    if (!validation.valid) {
      console.error('驗證失敗原因:', validation.errors);
    }

    selfTest.assert(validation.valid, `驗證應該通過，但失敗了：${validation.errors.join('、')}`);
    selfTest.assertEquals(validation.errors.length, 0, '不應該有錯誤');
  });

  // 測試 3: UploadProgress 基本功能
  selfTest.add('UploadProgress 基本功能', () => {
    const progress = global.LearningUploadProgress;
    selfTest.assertExists(progress, 'UploadProgress 不存在');
    selfTest.assertType(progress.createTask, 'function', 'createTask 不是函數');
    selfTest.assertType(progress.updateProgress, 'function', 'updateProgress 不是函數');
    selfTest.assertType(progress.calculateStudentProgress, 'function', 'calculateStudentProgress 不是函數');

    // 測試進度計算
    const testProgress = progress.calculateStudentProgress({
      photoCount: 3,
      videoCount: 1,
      commentLength: 25
    });

    selfTest.assert(testProgress === 100, `完整資料應該是 100%，實際 ${testProgress}%`);
  });

  // 測試 4: MediaPreviewManager 基本功能
  selfTest.add('MediaPreviewManager 基本功能', () => {
    const manager = global.LearningMediaPreviewManager;
    selfTest.assertExists(manager, 'MediaPreviewManager 不存在');
    selfTest.assertType(manager.generatePhotoPreview, 'function', 'generatePhotoPreview 不是函數');
    selfTest.assertType(manager.generateVideoPreview, 'function', 'generateVideoPreview 不是函數');
    selfTest.assertType(manager.clearAll, 'function', 'clearAll 不是函數');

    const stats = manager.getStats();
    selfTest.assertExists(stats, '統計資訊不存在');
    selfTest.assertType(stats.total, 'number', 'total 應該是數字');
  });

  // 測試 5: CourseRenderer 基本功能
  selfTest.add('CourseRenderer 基本功能', () => {
    const renderer = global.LearningCourseRenderer;
    selfTest.assertExists(renderer, 'CourseRenderer 不存在');
    selfTest.assertType(renderer.render, 'function', 'render 不是函數');
    selfTest.assertType(renderer.renderCourseCard, 'function', 'renderCourseCard 不是函數');
    selfTest.assertType(renderer.formatCourseTime, 'function', 'formatCourseTime 不是函數');

    // 測試課程卡片渲染
    const testCourse = {
      id: 'test-123',
      title: '測試課程',
      start: new Date(),
      end: new Date(),
      instructor: '測試講師',
      students: []
    };

    const card = renderer.renderCourseCard(testCourse, 0);
    selfTest.assertExists(card, '課程卡片應該存在');
    selfTest.assertEquals(card.tagName, 'DIV', '課程卡片應該是 DIV 元素');
  });

  // 測試 6: StudentRenderer 基本功能
  selfTest.add('StudentRenderer 基本功能', () => {
    const renderer = global.LearningStudentRenderer;
    selfTest.assertExists(renderer, 'StudentRenderer 不存在');
    selfTest.assertType(renderer.renderCard, 'function', 'renderCard 不是函數');
    selfTest.assertType(renderer.updateCard, 'function', 'updateCard 不是函數');

    // 測試學生卡片渲染
    const testStudent = {
      name: '測試學生',
      remaining: 10,
      attendanceStatus: 'present'
    };

    const card = renderer.renderCard(testStudent, 0);
    selfTest.assertExists(card, '學生卡片應該存在');
    selfTest.assertEquals(card.tagName, 'DIV', '學生卡片應該是 DIV 元素');
  });

  // 測試 7: OverviewRenderer 基本功能
  selfTest.add('OverviewRenderer 基本功能', () => {
    const renderer = global.LearningOverviewRenderer;
    selfTest.assertExists(renderer, 'OverviewRenderer 不存在');
    selfTest.assertType(renderer.render, 'function', 'render 不是函數');
    selfTest.assertType(renderer.getFormData, 'function', 'getFormData 不是函數');
    selfTest.assertType(renderer.validateFormData, 'function', 'validateFormData 不是函數');
  });

  // 測試 8: IntegrationLayer 基本功能
  selfTest.add('IntegrationLayer 基本功能', () => {
    const integration = global.LearningIntegrationLayer;
    selfTest.assertExists(integration, 'IntegrationLayer 不存在');
    selfTest.assertType(integration.enable, 'function', 'enable 不是函數');
    selfTest.assertType(integration.disable, 'function', 'disable 不是函數');
    selfTest.assertType(integration.getStatus, 'function', 'getStatus 不是函數');

    const status = integration.getStatus();
    selfTest.assertExists(status, '狀態資訊不存在');
    selfTest.assertType(status.enabled, 'boolean', 'enabled 應該是布林值');
    selfTest.assertExists(status.modules, '模組狀態不存在');
  });

  // 測試 9: 檢查向後兼容函數
  selfTest.add('向後兼容函數檢查', () => {
    // 檢查原有函數是否保留
    const compatFunctions = [
      'renderCourseCards',
      'updateStudentProgressIndicators',
      'useNewUpload',
      'useNewRenderCourse',
      'useNewRenderOverview'
    ];

    compatFunctions.forEach(funcName => {
      selfTest.assertExists(
        global[funcName],
        `向後兼容函數 ${funcName} 不存在`
      );
    });
  });

  // 測試 10: DOM 工具檢查
  selfTest.add('DOM 工具檢查', () => {
    const DOM = global.LearningUploadDOM;
    if (DOM) {
      selfTest.assertType(DOM.$, 'function', 'DOM.$ 應該是函數');
      selfTest.assertType(DOM.$$, 'function', 'DOM.$$ 應該是函數');
    }
  });

  // ============================================
  // 導出並提供全域函數
  // ============================================
  global.LearningUploadSelfTest = selfTest;

  // 提供便捷的測試函數
  global.runLearningUploadTests = async function() {
    return await selfTest.runAll();
  };

  // 自動執行測試（延遲執行，確保所有模組載入完成）
  setTimeout(() => {
    console.log('🚀 自動執行測試（3 秒後開始）...');
    setTimeout(async () => {
      try {
        // 檢查基本環境
        if (!global.LearningUploadManager) {
          console.warn('⚠️ 核心模組尚未完全載入，跳過測試');
          global.__learningUploadTestResult = { 
            skipped: true, 
            reason: '核心模組未載入' 
          };
          return;
        }

        const result = await selfTest.runAll();
        
        if (!result) {
          console.error('❌ 測試執行失敗，未返回結果');
          global.__learningUploadTestResult = { 
            error: '測試執行失敗，未返回結果',
            success: false
          };
          return;
        }
        
        if (result.success) {
          console.log('🎉 所有測試通過！系統準備就緒。');
        } else {
          console.warn('⚠️ 有測試失敗，請檢查上方錯誤訊息。');
        }

        // 儲存測試結果到全域
        global.__learningUploadTestResult = result;
      } catch (error) {
        console.error('❌ 測試執行發生錯誤:', error);
        console.error('❌ 錯誤堆疊:', error.stack);
        global.__learningUploadTestResult = { 
          error: error.message,
          stack: error.stack,
          success: false
        };
      }
    }, 3000);
  }, 100);

  console.log('✅ SelfTest 已載入');
  console.log('💡 使用 runLearningUploadTests() 手動執行測試');

})(window);

