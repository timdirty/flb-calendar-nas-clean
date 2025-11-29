/**
 * 強制顯示進度條修復腳本
 * 如果進度條完全不顯示，執行此腳本強制啟用
 * 
 * 使用方法：
 * 1. 在瀏覽器 Console 中直接貼上並執行
 * 2. 或在 HTML 中引入：<script src="/force-show-progress.js"></script>
 */

(function() {
    console.log('%c🚀 強制顯示進度條修復腳本', 'color: #3b82f6; font-weight: bold; font-size: 16px;');
    
    // 修復所有現有的預覽元素
    function fixAllPreviews() {
        const previews = document.querySelectorAll('.file-preview');
        let fixed = 0;
        
        previews.forEach(preview => {
            // 檢查是否需要修復
            const hasUploading = preview.classList.contains('uploading') || 
                                preview.classList.contains('pending');
            
            if (!hasUploading) {
                return; // 不是上傳中的，跳過
            }
            
            // 確保有 overlay 結構
            let overlay = preview.querySelector('.file-uploading-overlay');
            if (!overlay) {
                overlay = document.createElement('div');
                overlay.className = 'file-uploading-overlay';
                preview.appendChild(overlay);
                console.log('✅ 創建 overlay');
            }
            
            // 強制顯示 overlay
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
            
            // 確保有進度文字
            let progressText = overlay.querySelector('.progress-text');
            if (!progressText) {
                progressText = document.createElement('span');
                progressText.className = 'progress-text';
                progressText.textContent = '上傳中...';
                overlay.insertBefore(progressText, overlay.firstChild);
                console.log('✅ 創建 progressText');
            }
            
            // 確保有進度條容器
            let progressBar = overlay.querySelector('.file-upload-progress');
            if (!progressBar) {
                progressBar = document.createElement('div');
                progressBar.className = 'file-upload-progress';
                overlay.appendChild(progressBar);
                console.log('✅ 創建 progressBar');
            }
            
            // 強制顯示進度條
            progressBar.style.display = 'block';
            progressBar.style.visibility = 'visible';
            progressBar.style.width = '70px';
            
            // 確保有進度條填充
            let progressFill = progressBar.querySelector('.file-upload-progress-fill');
            if (!progressFill) {
                progressFill = document.createElement('div');
                progressFill.className = 'file-upload-progress-fill';
                progressBar.appendChild(progressFill);
                console.log('✅ 創建 progressFill');
            }
            
            // 設置初始寬度（如果沒有設置）
            if (!progressFill.style.width || progressFill.style.width === '0px') {
                progressFill.style.width = '7px'; // 10%
            }
            
            // 強制顯示填充
            progressFill.style.display = 'block';
            progressFill.style.visibility = 'visible';
            progressFill.style.opacity = '1';
            
            fixed++;
        });
        
        if (fixed > 0) {
            console.log(`✅ 已修復 ${fixed} 個進度條`);
        } else {
            console.log('ℹ️ 沒有需要修復的進度條（可能沒有正在上傳的檔案）');
        }
        
        return fixed;
    }
    
    // 立即執行一次
    fixAllPreviews();
    
    // 監控新增的預覽元素
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1 && node.classList && node.classList.contains('file-preview')) {
                    // 延遲一下再檢查，確保類別已添加
                    setTimeout(function() {
                        if (node.classList.contains('uploading') || node.classList.contains('pending')) {
                            console.log('🔍 檢測到新的上傳預覽，自動修復...');
                            fixAllPreviews();
                        }
                    }, 100);
                }
            });
        });
    });
    
    // 監控整個 document
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    console.log('✅ 監控器已啟動，將自動修復新增的進度條');
    
    // 提供全局函數
    window.fixProgress = fixAllPreviews;
    console.log('%c💡 手動執行：window.fixProgress()', 'color: #f59e0b;');
    
    // 每 2 秒自動檢查一次
    setInterval(fixAllPreviews, 2000);
    console.log('✅ 自動檢查已啟動（每 2 秒）');
})();
