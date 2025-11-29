// ============================================
// 🔥 錯誤處理器
// ============================================
// 早期錯誤捕獲和顯示

(function() {
    'use strict';
    
    // 在任何其他代碼之前設置錯誤處理
    window.onerror = function(message, source, lineno, colno, error) {
        console.error('❌ JavaScript 錯誤:', { message, source, lineno, colno, error });
        
        // 創建錯誤顯示
        const showError = function() {
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: #f44336;
                color: white;
                padding: 15px;
                z-index: 999999;
                font-size: 14px;
                word-break: break-word;
                max-height: 50vh;
                overflow-y: auto;
            `;
            errorDiv.innerHTML = `
                <strong>❌ JavaScript 錯誤 (行 ${lineno})：</strong><br>
                ${message}<br>
                ${source ? `<small>檔案: ${source}</small><br>` : ''}
                <small style="color: #ffeb3b;">請截圖此錯誤訊息並回報</small>
            `;
            
            if (document.body) {
                document.body.insertBefore(errorDiv, document.body.firstChild);
            } else {
                document.addEventListener('DOMContentLoaded', function() {
                    document.body.insertBefore(errorDiv, document.body.firstChild);
                });
            }
        };
        
        showError();
        return false; // 不阻止瀏覽器預設的錯誤處理
    };
    
    // 捕獲未處理的 Promise 拒絕
    window.addEventListener('unhandledrejection', function(event) {
        console.error('❌ 未處理的 Promise 拒絕:', event.reason);
        // 可以在這裡添加更多處理
    });
    
    console.error('✅ 錯誤處理器已初始化');
    
    // 標記模組已載入
    if (window.LOAD_PROGRESS) {
        window.LOAD_PROGRESS.updateProgress('ErrorHandler');
    }
    
})();

