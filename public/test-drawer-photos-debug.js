/**
 * 抽屜照片顯示問題 - 調試輔助工具
 * 
 * 使用方式：
 * 1. 在瀏覽器控制台中貼上此腳本
 * 2. 執行 testDrawerPhotos() 查看完整診斷資訊
 */

(function() {
    'use strict';
    
    window.testDrawerPhotos = function() {
        console.log('\n═══════════════════════════════════════════');
        console.log('🔍 抽屜照片顯示診斷工具');
        console.log('═══════════════════════════════════════════\n');
        
        // 1. 檢查抽屜DOM結構
        console.log('📋 1. 檢查抽屜DOM結構');
        let drawer = document.getElementById('drawer-progress');
        
        // 如果找不到，嘗試尋找其他可能的抽屜容器
        if (!drawer) {
            console.warn('⚠️ 找不到 #drawer-progress，嘗試尋找其他抽屜...');
            
            // 嘗試其他可能的選擇器
            const possibleSelectors = [
                '.drawer-content',
                '.drawer-container',
                '[class*="drawer"]',
                '.progress-drawer'
            ];
            
            for (const selector of possibleSelectors) {
                drawer = document.querySelector(selector);
                if (drawer) {
                    console.log(`✅ 找到抽屜容器: ${selector}`);
                    break;
                }
            }
            
            if (!drawer) {
                console.error('❌ 找不到任何抽屜容器');
                console.log('\n💡 請先執行以下步驟：');
                console.log('   1. 點擊學生卡片打開抽屜');
                console.log('   2. 確認抽屜已顯示');
                console.log('   3. 再次執行 testDrawerPhotos()');
                console.log('\n或者，手動檢查抽屜內容：');
                console.log('   document.querySelector(".record-item")');
                return;
            }
        } else {
            console.log('✅ 抽屜容器存在 (#drawer-progress)');
        }
        
        // 2. 檢查學生記錄項
        console.log('\n📋 2. 檢查學生記錄項');
        const recordItems = drawer.querySelectorAll('.record-item');
        console.log(`✅ 找到 ${recordItems.length} 個學生記錄項`);
        
        recordItems.forEach((item, index) => {
            const studentName = item.querySelector('.record-item-title')?.textContent.trim();
            console.log(`\n  👤 學生 ${index + 1}: ${studentName}`);
            
            // 檢查檔案容器
            const filesContainer = item.querySelector('.record-item-files');
            if (!filesContainer) {
                console.error('    ❌ 找不到檔案容器 .record-item-files');
                return;
            }
            console.log('    ✅ 檔案容器存在');
            
            // 檢查照片預覽
            const photoPreviews = filesContainer.querySelectorAll('.file-preview[data-preview-type="image"]');
            const videoPreviews = filesContainer.querySelectorAll('.file-preview[data-preview-type="video"]');
            
            console.log(`    📸 照片數量: ${photoPreviews.length}`);
            console.log(`    🎬 影片數量: ${videoPreviews.length}`);
            
            // 詳細檢查每張照片
            if (photoPreviews.length > 0) {
                console.log('\n    📸 照片詳細資訊:');
                photoPreviews.forEach((preview, photoIndex) => {
                    const img = preview.querySelector('img');
                    const previewUrl = preview.getAttribute('data-preview-url');
                    const filename = preview.getAttribute('data-filename');
                    const classes = preview.className;
                    
                    console.log(`      照片 ${photoIndex + 1}:`);
                    console.log(`        - URL: ${previewUrl}`);
                    console.log(`        - 檔名: ${filename}`);
                    console.log(`        - Classes: ${classes}`);
                    console.log(`        - IMG src: ${img ? img.src : '無 IMG 元素'}`);
                    console.log(`        - 可見性: ${window.getComputedStyle(preview).display}`);
                    console.log(`        - 寬度: ${window.getComputedStyle(preview).width}`);
                    console.log(`        - 高度: ${window.getComputedStyle(preview).height}`);
                });
            } else {
                console.warn('    ⚠️ 沒有找到照片預覽元素');
                
                // 檢查是否有「尚無檔案」訊息
                const emptyMessage = filesContainer.querySelector('div[style*="color:#94a3b8"]');
                if (emptyMessage) {
                    console.log('    💬 顯示「尚無檔案」訊息');
                }
                
                // 顯示容器的實際HTML內容（前500字）
                console.log('    📄 容器HTML（前500字）:');
                console.log(`    ${filesContainer.innerHTML.substring(0, 500)}`);
            }
        });
        
        // 3. 檢查記錄快取
        console.log('\n📋 3. 檢查記錄快取');
        if (typeof window.recordCache !== 'undefined') {
            console.log('✅ recordCache 存在');
            const cacheKeys = Object.keys(window.recordCache);
            console.log(`  快取學生數量: ${cacheKeys.length}`);
            
            cacheKeys.forEach(key => {
                const record = window.recordCache[key];
                const photosCount = record.newMediaPhotos ? record.newMediaPhotos.length : 
                                  (record.photos ? record.photos.length : 0);
                const videosCount = record.newMediaVideos ? record.newMediaVideos.length : 
                                  (record.videos ? record.videos.length : 0);
                
                console.log(`  👤 ${key}:`);
                console.log(`    - newMediaPhotos: ${record.newMediaPhotos ? record.newMediaPhotos.length : '無'}`);
                console.log(`    - newMediaVideos: ${record.newMediaVideos ? record.newMediaVideos.length : '無'}`);
                console.log(`    - photos: ${record.photos ? record.photos.length : '無'}`);
                console.log(`    - videos: ${record.videos ? record.videos.length : '無'}`);
                
                if (record.newMediaPhotos && record.newMediaPhotos.length > 0) {
                    console.log(`    📸 照片詳情:`, record.newMediaPhotos);
                }
            });
        } else {
            console.warn('⚠️ recordCache 不存在');
        }
        
        // 4. 檢查CSS樣式
        console.log('\n📋 4. 檢查CSS樣式');
        const samplePreview = drawer.querySelector('.file-preview[data-preview-type="image"]');
        if (samplePreview) {
            const computedStyle = window.getComputedStyle(samplePreview);
            console.log('  照片預覽元素樣式:');
            console.log(`    - display: ${computedStyle.display}`);
            console.log(`    - visibility: ${computedStyle.visibility}`);
            console.log(`    - opacity: ${computedStyle.opacity}`);
            console.log(`    - width: ${computedStyle.width}`);
            console.log(`    - height: ${computedStyle.height}`);
            console.log(`    - position: ${computedStyle.position}`);
            console.log(`    - z-index: ${computedStyle.zIndex}`);
        }
        
        console.log('\n═══════════════════════════════════════════');
        console.log('✅ 診斷完成！請檢查上方的輸出資訊');
        console.log('═══════════════════════════════════════════\n');
    };
    
    // 自動提示
    console.log('💡 測試工具已載入！執行 testDrawerPhotos() 開始診斷');
    
})();

