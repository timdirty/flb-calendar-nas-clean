// 🔥 進度條寬度修復 - 強制正確計算寬度
(function() {
    'use strict';
    
    // 覆蓋原有的 setPreviewProgress 函數
    var originalSetPreviewProgress = window.setPreviewProgress;
    
    window.setPreviewProgress = function(preview, percent) {
        if (!preview) return;
        
        var helpers = window.ensureFilePreviewOverlay(preview);
        if (!helpers || !helpers.progressFill) return;
        
        var bounded = Math.max(0, Math.min(100, Number(percent) || 0));
        
        // 強制設置像素寬度而非百分比
        var pixelWidth = Math.round(70 * bounded / 100);
        helpers.progressFill.style.width = pixelWidth + 'px';
        
        // 同時設置百分比作為備用
        helpers.progressFill.style.setProperty('--progress-percent', bounded + '%');
        
        // 診斷日誌
        console.log('🔧 [進度條修復] 設置進度:', {
            percent: bounded + '%',
            pixelWidth: pixelWidth + 'px',
            actualWidth: window.getComputedStyle(helpers.progressFill).width
        });
        
        // 處理完成狀態
        if (bounded >= 100) {
            helpers.overlay.setAttribute('data-progress-complete', '1');
            // 確保 100% 時填滿
            helpers.progressFill.style.width = '70px';
        } else {
            helpers.overlay.removeAttribute('data-progress-complete');
        }
        
        try { 
            preview.setAttribute('data-last-progress', String(bounded)); 
        } catch (e) {}
    };
    
    // 定期檢查並修復進度條寬度
    setInterval(function() {
        var progressFills = document.querySelectorAll('.file-preview.uploading .file-upload-progress-fill');
        progressFills.forEach(function(fill) {
            var currentWidth = fill.style.width;
            if (currentWidth && currentWidth.includes('%')) {
                var percent = parseFloat(currentWidth);
                var pixelWidth = Math.round(70 * percent / 100);
                fill.style.width = pixelWidth + 'px';
            }
        });
    }, 500);
    
    console.log('✅ 進度條寬度修復已載入');
})();
