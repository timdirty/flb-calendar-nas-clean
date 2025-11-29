/**
 * 學生預覽功能測試輔助工具
 * 在瀏覽器控制台中執行此腳本，或將其添加到頁面中
 */

(function() {
  'use strict';
  
  window.PreviewTestHelper = {
    /**
     * 檢查特定學生的預覽狀態
     */
    checkStudent: function(index) {
      if (typeof studentFiles === 'undefined') {
        console.error('❌ studentFiles 未定義');
        return null;
      }
      
      var base = studentFiles[index];
      var photosContainer = document.getElementById('photos-preview-' + index);
      var videosContainer = document.getElementById('videos-preview-' + index);
      
      var result = {
        studentIndex: index,
        memory: {
          photos: base ? base.photos.length : 0,
          videos: base ? base.videos.length : 0,
          existingCounts: base ? base.existingCounts : {}
        },
        dom: {
          photos: {
            container: photosContainer ? '存在' : '不存在',
            total: photosContainer ? photosContainer.children.length : 0,
            existing: photosContainer ? photosContainer.querySelectorAll('.file-preview.existing, .file-preview.loaded').length : 0,
            newUpload: photosContainer ? photosContainer.querySelectorAll('.file-preview.new-upload').length : 0
          },
          videos: {
            container: videosContainer ? '存在' : '不存在',
            total: videosContainer ? videosContainer.children.length : 0,
            existing: videosContainer ? videosContainer.querySelectorAll('.file-preview.existing, .file-preview.loaded').length : 0,
            newUpload: videosContainer ? videosContainer.querySelectorAll('.file-preview.new-upload').length : 0
          }
        }
      };
      
      console.log('📊 學生 ' + index + ' 狀態:', result);
      return result;
    },
    
    /**
     * 檢查所有學生
     */
    checkAll: function() {
      if (typeof studentFiles === 'undefined') {
        console.error('❌ studentFiles 未定義');
        return [];
      }
      
      var results = [];
      for (var i = 0; i < studentFiles.length; i++) {
        results.push(this.checkStudent(i));
      }
      return results;
    },
    
    /**
     * 啟用詳細日誌
     */
    enableVerboseLogging: function() {
      window.DEBUG_PREVIEW = true;
      console.log('✅ 已啟用詳細日誌');
    },
    
    /**
     * 禁用詳細日誌
     */
    disableVerboseLogging: function() {
      window.DEBUG_PREVIEW = false;
      console.log('✅ 已禁用詳細日誌');
    },
    
    /**
     * 檢查預覽容器的完整性
     */
    validateContainer: function(index, type) {
      var containerId = type + '-preview-' + index;
      var container = document.getElementById(containerId);
      
      if (!container) {
        console.error('❌ 容器不存在:', containerId);
        return false;
      }
      
      var previews = container.querySelectorAll('.file-preview');
      var existing = container.querySelectorAll('.file-preview.existing, .file-preview.loaded');
      var newUpload = container.querySelectorAll('.file-preview.new-upload');
      
      console.log('🔍 容器驗證:', containerId);
      console.log('  總預覽數:', previews.length);
      console.log('  已上傳:', existing.length);
      console.log('  新上傳:', newUpload.length);
      
      // 檢查是否有重複
      var urls = [];
      var duplicates = [];
      previews.forEach(function(el) {
        var url = el.getAttribute('data-preview-url');
        if (url) {
          if (urls.indexOf(url) !== -1) {
            duplicates.push(url);
          } else {
            urls.push(url);
          }
        }
      });
      
      if (duplicates.length > 0) {
        console.warn('⚠️ 發現重複預覽:', duplicates.length);
        duplicates.forEach(function(url) {
          console.log('  - ' + url.substring(0, 50) + '...');
        });
      }
      
      // 檢查是否有孤立的 Blob URL
      var blobUrls = [];
      previews.forEach(function(el) {
        var url = el.getAttribute('data-blob-url') || el.getAttribute('data-object-url');
        if (url && url.startsWith('blob:')) {
          blobUrls.push(url);
        }
      });
      
      if (blobUrls.length > 0) {
        console.log('🔗 Blob URL 數量:', blobUrls.length);
      }
      
      return true;
    },
    
    /**
     * 監聽 applyExistingRecordToCard 調用
     */
    watchApplyExisting: function() {
      if (typeof applyExistingRecordToCard === 'undefined') {
        console.error('❌ applyExistingRecordToCard 未定義');
        return;
      }
      
      var original = window.applyExistingRecordToCard;
      if (!original) {
        console.error('❌ 無法訪問 applyExistingRecordToCard');
        return;
      }
      
      console.log('👁️ 開始監聽 applyExistingRecordToCard');
      // 無法直接覆蓋，因為是局部函數
      console.warn('⚠️ 此函數可能無法直接監聽（局部作用域）');
    },
    
    /**
     * 測試場景 A：檢查初始狀態
     */
    testScenarioA: function(studentIndex) {
      console.log('📋 測試場景 A：初始狀態檢查');
      console.log('請先選擇一個有已上傳檔案的學生');
      setTimeout(function() {
        this.checkStudent(studentIndex || 0);
        this.validateContainer(studentIndex || 0, 'photos');
        this.validateContainer(studentIndex || 0, 'videos');
      }.bind(this), 1000);
    },
    
    /**
     * 測試場景 B：選擇新檔案
     */
    testScenarioB: function(studentIndex) {
      console.log('📋 測試場景 B：選擇新檔案');
      console.log('請手動選擇新照片/影片');
      console.log('選擇完成後，執行：PreviewTestHelper.checkStudent(' + (studentIndex || 0) + ')');
    },
    
    /**
     * 測試場景 C：切換學生
     */
    testScenarioC: function(studentIndex) {
      console.log('📋 測試場景 C：切換學生');
      console.log('1. 記錄當前狀態');
      var before = this.checkStudent(studentIndex || 0);
      console.log('2. 請切換到其他學生，然後切回來');
      console.log('3. 執行：PreviewTestHelper.verifyScenarioC(' + (studentIndex || 0) + ', ' + JSON.stringify(before) + ')');
      return before;
    },
    
    /**
     * 驗證場景 C
     */
    verifyScenarioC: function(studentIndex, before) {
      console.log('🔍 驗證場景 C：檢查是否恢復');
      var after = this.checkStudent(studentIndex);
      
      console.log('對比結果:');
      console.log('  已上傳照片 - 前:', before.dom.photos.existing, '後:', after.dom.photos.existing);
      console.log('  新上傳照片 - 前:', before.dom.photos.newUpload, '後:', after.dom.photos.newUpload);
      console.log('  已上傳影片 - 前:', before.dom.videos.existing, '後:', after.dom.videos.existing);
      console.log('  新上傳影片 - 前:', before.dom.videos.newUpload, '後:', after.dom.videos.newUpload);
      
      var passed = true;
      if (after.dom.photos.existing < before.dom.photos.existing) {
        console.error('❌ 已上傳照片數量減少！');
        passed = false;
      }
      if (after.dom.photos.newUpload < before.dom.photos.newUpload) {
        console.error('❌ 新上傳照片數量減少！');
        passed = false;
      }
      if (after.dom.videos.existing < before.dom.videos.existing) {
        console.error('❌ 已上傳影片數量減少！');
        passed = false;
      }
      if (after.dom.videos.newUpload < before.dom.videos.newUpload) {
        console.error('❌ 新上傳影片數量減少！');
        passed = false;
      }
      
      if (passed) {
        console.log('✅ 場景 C 通過');
      } else {
        console.error('❌ 場景 C 失敗');
      }
      
      return passed;
    },
    
    /**
     * 完整測試流程
     */
    runFullTest: function(studentIndex) {
      console.log('🚀 開始完整測試流程');
      console.log('');
      console.log('步驟 1/4：檢查初始狀態');
      this.testScenarioA(studentIndex || 0);
      
      console.log('');
      console.log('步驟 2/4：選擇新檔案後，執行：');
      console.log('  PreviewTestHelper.checkStudent(' + (studentIndex || 0) + ')');
      
      console.log('');
      console.log('步驟 3/4：切換學生前，執行：');
      console.log('  var before = PreviewTestHelper.testScenarioC(' + (studentIndex || 0) + ')');
      
      console.log('');
      console.log('步驟 4/4：切換回來後，執行：');
      console.log('  PreviewTestHelper.verifyScenarioC(' + (studentIndex || 0) + ', before)');
    }
  };
  
  console.log('✅ PreviewTestHelper 已載入');
  console.log('使用方法：');
  console.log('  PreviewTestHelper.checkStudent(0)  - 檢查學生 0 的狀態');
  console.log('  PreviewTestHelper.checkAll()      - 檢查所有學生');
  console.log('  PreviewTestHelper.runFullTest(0)  - 運行完整測試');
  console.log('');
})();

