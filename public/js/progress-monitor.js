// 🔥 進度條監控器 - 確保所有上傳進度條正常工作
(function() {
    'use strict';
    
    console.log('🚀 進度條監控器啟動');
    
    // 修復單個進度條
    function fixProgressBar(preview) {
        if (!preview) return;
        
        // 🔥 [修復 2025-11-23] 只為正在上傳或待上傳的節點創建 overlay
        // 已上傳完成的節點（existing, loaded, synced-preview, upload-success）不需要 overlay
        var isUploading = preview.classList.contains('uploading') || 
                         preview.classList.contains('pending') ||
                         preview.classList.contains('loading');
        var isCompleted = preview.classList.contains('existing') || 
                         preview.classList.contains('loaded') || 
                         preview.classList.contains('synced-preview') ||
                         (preview.classList.contains('upload-success') && !preview.classList.contains('new-upload'));
        
        if (isCompleted) {
            // 已上傳完成的節點，不需要 overlay
            return;
        }
        
        // 🔥 [修復 2025-11-23] 只在實際需要且缺少時才創建 overlay
        // 檢查是否真的在上傳狀態，而不僅僅是有上傳相關的類別
        if (!isUploading) {
            return;
        }
        
        // 確保有 overlay（只為上傳中的節點）
        var overlay = preview.querySelector('.file-uploading-overlay');
        if (!overlay) {
            // 🔥 只為真正正在上傳的節點創建 overlay
            if (preview.classList.contains('uploading') || preview.classList.contains('pending')) {
                console.log('⚠️ 上傳中節點缺少 overlay，嘗試創建');
                window.ensureFilePreviewOverlay && window.ensureFilePreviewOverlay(preview);
                overlay = preview.querySelector('.file-uploading-overlay');
            }
        }
        
        if (!overlay) return;
        
        // 確保 overlay 可見
        if (preview.classList.contains('uploading') || preview.classList.contains('pending')) {
            overlay.style.opacity = '1';
            overlay.style.visibility = 'visible';
            overlay.style.display = 'flex';
        }
        
        // 確保進度條存在
        var progressBar = overlay.querySelector('.file-upload-progress');
        var progressFill = overlay.querySelector('.file-upload-progress-fill');
        
        if (!progressBar || !progressFill) {
            console.log('⚠️ 缺少進度條元素');
            return;
        }
        
        // 確保進度條可見
        progressBar.style.display = 'block';
        progressBar.style.visibility = 'visible';
        progressBar.style.opacity = '1';
        
        progressFill.style.display = 'block';
        progressFill.style.visibility = 'visible';
        progressFill.style.opacity = '1';
        
        // 獲取當前進度
        var currentWidth = progressFill.style.width;
        
        // 如果是百分比，轉換為像素
        if (currentWidth && currentWidth.includes('%')) {
            var percent = parseFloat(currentWidth);
            if (!isNaN(percent)) {
                var pixelWidth = Math.round(70 * percent / 100);
                progressFill.style.width = pixelWidth + 'px';
                console.log('✅ 進度條修正：' + percent + '% -> ' + pixelWidth + 'px');
            }
        }
        
        // 如果沒有寬度，設置初始值
        if (!currentWidth) {
            progressFill.style.width = '0px';
        }
    }
    
    // 定期檢查所有上傳中的進度條
    function checkAllProgressBars() {
        // 找出所有上傳中或待上傳的預覽
        var uploadingPreviews = document.querySelectorAll('.file-preview.uploading, .file-preview.pending');
        
        uploadingPreviews.forEach(function(preview) {
            fixProgressBar(preview);
            
            // 檢查是否有進度資訊
            var tempId = preview.getAttribute('data-temp-id');
            if (tempId && window.PendingMediaStore) {
                var pendingData = window.PendingMediaStore.get(tempId);
                if (pendingData && pendingData.progress !== undefined) {
                    var percent = Math.max(0, Math.min(100, pendingData.progress));
                    var pixelWidth = Math.round(70 * percent / 100);
                    
                    var progressFill = preview.querySelector('.file-upload-progress-fill');
                    if (progressFill) {
                        progressFill.style.width = pixelWidth + 'px';
                    }
                    
                    var progressText = preview.querySelector('.progress-text');
                    if (progressText) {
                        if (percent >= 100) {
                            progressText.textContent = '完成';
                        } else if (percent === 0) {
                            progressText.textContent = '準備中';
                        } else {
                            progressText.textContent = Math.round(percent) + '%';
                        }
                    }
                }
            }
        });
    }
    
    // 監聽 DOM 變化
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            // 檢查新增的節點
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === 1 && node.classList && node.classList.contains('file-preview')) {
                    // 🔥 [修復] 只處理上傳中的節點，不處理已上傳完成的節點
                    var isUploading = node.classList.contains('uploading') || 
                                     node.classList.contains('pending') ||
                                     node.classList.contains('loading') ||
                                     node.classList.contains('new-upload');
                    var isCompleted = node.classList.contains('existing') || 
                                     node.classList.contains('loaded') || 
                                     node.classList.contains('synced-preview');
                    
                    if (isUploading && !isCompleted) {
                        setTimeout(function() {
                            fixProgressBar(node);
                        }, 100);
                    }
                }
            });
            
            // 檢查類別變化
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                var target = mutation.target;
                if (target.classList && target.classList.contains('file-preview')) {
                    if (target.classList.contains('uploading') || target.classList.contains('pending')) {
                        fixProgressBar(target);
                    }
                }
            }
        });
    });
    
    // 開始觀察的函數
    function startObserving() {
        if (document.body) {
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
            console.log('✅ MutationObserver 已啟動');
        }
    }
    
    // 確保在適當的時機啟動觀察器
    if (document.readyState === 'loading') {
        // DOM 還在載入中，等待 DOMContentLoaded
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        // DOM 已載入完成，直接啟動
        startObserving();
    }
    
    // 定期檢查（每 500ms）
    setInterval(checkAllProgressBars, 500);
    
    // 初始檢查
    setTimeout(checkAllProgressBars, 100);
    
    // 掛載到全域供調試
    window.fixProgressBar = fixProgressBar;
    window.checkAllProgressBars = checkAllProgressBars;
    
    console.log('✅ 進度條監控器已啟動');
})();
