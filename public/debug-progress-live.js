/**
 * 進度條實時診斷工具
 * 在上傳頁面的 Console 中執行：
 * 
 * 方法1：直接複製貼上整個腳本
 * 方法2：在 HTML 中引入：<script src="/debug-progress-live.js"></script>
 */

(function() {
    console.log('%c🔍 進度條診斷工具已載入', 'color: #10b981; font-weight: bold; font-size: 14px;');
    
    // 監控所有進度條更新
    const originalSetPreviewProgress = window.setPreviewProgress;
    if (originalSetPreviewProgress) {
        window.setPreviewProgress = function(preview, percent) {
            console.group('📊 setPreviewProgress 被調用');
            console.log('preview:', preview);
            console.log('percent:', percent);
            console.log('preview 類別:', preview ? preview.className : 'N/A');
            
            // 調用原始函數
            const result = originalSetPreviewProgress.apply(this, arguments);
            
            // 檢查結果
            if (preview) {
                const overlay = preview.querySelector('.file-uploading-overlay');
                const progressBar = preview.querySelector('.file-upload-progress');
                const progressFill = preview.querySelector('.file-upload-progress-fill');
                
                console.log('overlay 存在:', !!overlay);
                if (overlay) {
                    const overlayStyle = getComputedStyle(overlay);
                    console.log('overlay display:', overlayStyle.display);
                    console.log('overlay opacity:', overlayStyle.opacity);
                }
                
                console.log('progressBar 存在:', !!progressBar);
                if (progressBar) {
                    const barStyle = getComputedStyle(progressBar);
                    console.log('progressBar display:', barStyle.display);
                    console.log('progressBar width:', barStyle.width);
                }
                
                console.log('progressFill 存在:', !!progressFill);
                if (progressFill) {
                    console.log('progressFill inline width:', progressFill.style.width);
                    console.log('progressFill computed width:', getComputedStyle(progressFill).width);
                }
            }
            
            console.groupEnd();
            return result;
        };
        console.log('✅ 已攔截 setPreviewProgress 函數');
    } else {
        console.warn('⚠️ 找不到 setPreviewProgress 函數');
    }
    
    // 監控 PendingMediaActions.updateProgress
    if (window.PendingMediaActions && window.PendingMediaActions.updateProgress) {
        const originalUpdateProgress = window.PendingMediaActions.updateProgress;
        window.PendingMediaActions.updateProgress = function(tempId, percent, label) {
            console.log('📈 PendingMediaActions.updateProgress:', { tempId, percent, label });
            return originalUpdateProgress.apply(this, arguments);
        };
        console.log('✅ 已攔截 PendingMediaActions.updateProgress');
    }
    
    // 提供診斷命令
    window.debugProgress = {
        // 檢查所有上傳中的預覽
        checkAll: function() {
            console.group('🔍 檢查所有預覽元素');
            const previews = document.querySelectorAll('.file-preview');
            console.log('找到預覽數量:', previews.length);
            
            previews.forEach((preview, index) => {
                console.group(`預覽 #${index}`);
                console.log('類別:', preview.className);
                console.log('data-temp-id:', preview.getAttribute('data-temp-id'));
                
                const overlay = preview.querySelector('.file-uploading-overlay');
                const progressBar = preview.querySelector('.file-upload-progress');
                const progressFill = preview.querySelector('.file-upload-progress-fill');
                
                console.log('overlay:', !!overlay);
                if (overlay) {
                    const style = getComputedStyle(overlay);
                    console.log('  display:', style.display);
                    console.log('  opacity:', style.opacity);
                }
                
                console.log('progressBar:', !!progressBar);
                if (progressBar) {
                    const style = getComputedStyle(progressBar);
                    console.log('  display:', style.display);
                    console.log('  width:', style.width);
                }
                
                console.log('progressFill:', !!progressFill);
                if (progressFill) {
                    const style = getComputedStyle(progressFill);
                    console.log('  inline width:', progressFill.style.width);
                    console.log('  computed width:', style.width);
                    console.log('  display:', style.display);
                }
                
                console.groupEnd();
            });
            
            console.groupEnd();
        },
        
        // 檢查特定預覽
        check: function(selector) {
            const preview = document.querySelector(selector);
            if (!preview) {
                console.error('❌ 找不到元素:', selector);
                return;
            }
            
            console.group('🔍 檢查元素:', selector);
            console.log('類別:', preview.className);
            console.log('data-temp-id:', preview.getAttribute('data-temp-id'));
            
            const overlay = preview.querySelector('.file-uploading-overlay');
            console.log('overlay 存在:', !!overlay);
            if (overlay) {
                const style = getComputedStyle(overlay);
                console.log('overlay display:', style.display);
                console.log('overlay opacity:', style.opacity);
            }
            
            const progressBar = preview.querySelector('.file-upload-progress');
            console.log('progressBar 存在:', !!progressBar);
            if (progressBar) {
                const style = getComputedStyle(progressBar);
                console.log('progressBar display:', style.display);
                console.log('progressBar width:', style.width);
            }
            
            const progressFill = preview.querySelector('.file-upload-progress-fill');
            console.log('progressFill 存在:', !!progressFill);
            if (progressFill) {
                console.log('progressFill inline width:', progressFill.style.width);
                console.log('progressFill computed width:', getComputedStyle(progressFill).width);
            }
            
            console.groupEnd();
        },
        
        // 手動測試進度條
        test: function(selector, percent) {
            const preview = document.querySelector(selector);
            if (!preview) {
                console.error('❌ 找不到元素:', selector);
                return;
            }
            
            console.log('🧪 測試進度條:', selector, percent + '%');
            
            // 添加類別
            preview.classList.add('uploading');
            
            // 確保結構存在
            if (window.ensureFilePreviewOverlay) {
                const helpers = window.ensureFilePreviewOverlay(preview);
                console.log('helpers:', helpers);
                
                if (helpers && helpers.progressFill) {
                    const pixelWidth = Math.round(70 * percent / 100);
                    helpers.progressFill.style.width = pixelWidth + 'px';
                    console.log('✅ 設置寬度:', pixelWidth + 'px');
                }
            }
            
            // 檢查結果
            this.check(selector);
        }
    };
    
    console.log('%c💡 可用命令:', 'color: #f59e0b; font-weight: bold;');
    console.log('debugProgress.checkAll()        - 檢查所有預覽');
    console.log('debugProgress.check(selector)   - 檢查特定元素');
    console.log('debugProgress.test(selector, percent) - 測試進度條');
    console.log('');
    console.log('範例：');
    console.log('debugProgress.checkAll()');
    console.log('debugProgress.test(".file-preview", 50)');
})();
