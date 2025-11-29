/**
 * 🎨 上傳反饋與錯誤處理系統
 * 建立日期: 2025-11-16
 * 用途: 提供友善的上傳狀態反饋和錯誤訊息
 */

(function(global) {
    'use strict';

    // ==================== 錯誤訊息映射表 ====================
    
    const ERROR_MESSAGES = {
        // 網路錯誤
        'ERR_NETWORK': {
            title: '網路連線問題',
            message: '無法連接到伺服器，請檢查網路連線後重試',
            icon: '🌐',
            type: 'error',
            actions: [{
                text: '重試',
                action: 'retry'
            }, {
                text: '檢查網路',
                action: 'check-network',
                secondary: true
            }]
        },
        'NETWORK_ERROR': {
            title: '網路連線失敗',
            message: '請確認網路連線是否正常',
            icon: '📡',
            type: 'error',
            actions: [{ text: '重試', action: 'retry' }]
        },
        
        // 檔案錯誤
        'FILE_TOO_LARGE': {
            title: '檔案過大',
            message: '照片請小於 10MB，影片請小於 50MB',
            icon: '📁',
            type: 'warning',
            actions: [{
                text: '重新選擇',
                action: 'reselect'
            }, {
                text: '了解限制',
                action: 'learn-more',
                secondary: true
            }]
        },
        'UNSUPPORTED_FORMAT': {
            title: '不支援的檔案格式',
            message: '請選擇 JPG、PNG 圖片或 MP4 影片',
            icon: '⚠️',
            type: 'warning',
            actions: [{ text: '重新選擇', action: 'reselect' }]
        },
        'FILE_READ_ERROR': {
            title: '檔案讀取失敗',
            message: '無法讀取此檔案，請確認檔案是否損壞',
            icon: '❌',
            type: 'error',
            actions: [{ text: '重新選擇', action: 'reselect' }]
        },
        
        // 上傳錯誤
        'TIMEOUT': {
            title: '上傳超時',
            message: '上傳時間過長，請檢查網路速度後重試',
            icon: '⏱️',
            type: 'error',
            actions: [{ text: '重試', action: 'retry' }]
        },
        'UPLOAD_FAILED': {
            title: '上傳失敗',
            message: '上傳過程中發生錯誤，請稍後再試',
            icon: '⚠️',
            type: 'error',
            actions: [{ text: '重試', action: 'retry' }]
        },
        
        // 伺服器錯誤
        'SERVER_ERROR': {
            title: '系統暫時無法處理',
            message: '伺服器繁忙中，請稍後再試',
            icon: '⚙️',
            type: 'error',
            actions: [{
                text: '稍後重試',
                action: 'retry-later'
            }, {
                text: '回報問題',
                action: 'report',
                secondary: true
            }]
        },
        '500': {
            title: '伺服器錯誤',
            message: '系統發生錯誤，我們正在處理中',
            icon: '🔧',
            type: 'error',
            actions: [{ text: '重試', action: 'retry' }]
        },
        
        // 權限錯誤
        'PERMISSION_DENIED': {
            title: '權限不足',
            message: '您沒有權限執行此操作',
            icon: '🔒',
            type: 'error',
            actions: [{
                text: '聯絡管理員',
                action: 'contact-admin'
            }]
        },
        'QUOTA_EXCEEDED': {
            title: '儲存空間不足',
            message: '您的儲存空間已滿，請清理後再試',
            icon: '💾',
            type: 'warning',
            actions: [{
                text: '清理空間',
                action: 'clean-storage'
            }]
        },
        
        // 404 錯誤
        '404': {
            title: '找不到資源',
            message: '請求的資源不存在',
            icon: '🔍',
            type: 'error',
            actions: [{ text: '返回', action: 'go-back' }]
        },
        
        // 預設錯誤
        'DEFAULT': {
            title: '發生錯誤',
            message: '操作失敗，請稍後再試',
            icon: '⚠️',
            type: 'error',
            actions: [{ text: '確定', action: 'dismiss' }]
        }
    };

    // ==================== Toast 通知系統 ====================
    
    class ToastNotification {
        constructor() {
            this.container = null;
            this.activeToasts = new Set();
            this.init();
        }

        init() {
            // 建立 Toast 容器
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:10000;display:flex;flex-direction:column;gap:12px;';
            document.body.appendChild(this.container);
        }

        /**
         * 顯示 Toast 通知
         * @param {string} message - 訊息內容
         * @param {string} type - 類型: success, error, warning, info
         * @param {Object} options - 選項
         */
        show(message, type = 'info', options = {}) {
            const {
                title = '',
                duration = type === 'error' ? 5000 : 3000,
                action = null,
                position = 'top-center',
                closeable = true
            } = options;

            const toast = this.createToast(message, type, title, action, closeable);
            this.container.appendChild(toast);
            this.activeToasts.add(toast);

            // 自動關閉
            if (duration > 0) {
                setTimeout(() => this.hide(toast), duration);
            }

            return toast;
        }

        createToast(message, type, title, action, closeable) {
            const toast = document.createElement('div');
            toast.className = `toast-notification ${type}`;

            const iconMap = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'ℹ'
            };

            let html = `
                <div class="toast-icon">${iconMap[type] || 'ℹ'}</div>
                <div class="toast-content">
                    ${title ? `<div class="toast-title">${this.escapeHtml(title)}</div>` : ''}
                    <div class="toast-message">${this.escapeHtml(message)}</div>
                    ${action ? `
                        <div class="toast-action">
                            <button class="toast-action-btn" data-action="${action.action}">
                                ${this.escapeHtml(action.text)}
                            </button>
                        </div>
                    ` : ''}
                </div>
            `;

            if (closeable) {
                html += `<button class="toast-close" aria-label="關閉">×</button>`;
            }

            toast.innerHTML = html;

            // 綁定事件
            if (closeable) {
                const closeBtn = toast.querySelector('.toast-close');
                closeBtn?.addEventListener('click', () => this.hide(toast));
            }

            if (action && action.onClick) {
                const actionBtn = toast.querySelector('.toast-action-btn');
                actionBtn?.addEventListener('click', () => {
                    action.onClick();
                    this.hide(toast);
                });
            }

            return toast;
        }

        hide(toast) {
            if (!toast || !this.activeToasts.has(toast)) return;

            toast.classList.add('toast-hide');
            this.activeToasts.delete(toast);

            setTimeout(() => {
                toast.remove();
            }, 300);
        }

        escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        // 快捷方法
        success(message, options = {}) {
            return this.show(message, 'success', options);
        }

        error(message, options = {}) {
            return this.show(message, 'error', options);
        }

        warning(message, options = {}) {
            return this.show(message, 'warning', options);
        }

        info(message, options = {}) {
            return this.show(message, 'info', options);
        }
    }

    // ==================== 上傳反饋管理器 ====================
    
    class UploadFeedbackManager {
        constructor() {
            this.toast = new ToastNotification();
        }

        /**
         * 顯示上傳開始反饋
         */
        showUploadStart(element, fileName) {
            if (!element) return;

            element.classList.add('uploading');
            
            // 建立進度顯示
            let progressOverlay = element.querySelector('.file-uploading-overlay');
            if (!progressOverlay) {
                progressOverlay = document.createElement('div');
                progressOverlay.className = 'file-uploading-overlay';
                progressOverlay.innerHTML = `
                    <div class="progress-bar"></div>
                    <div class="upload-percentage">0%</div>
                `;
                element.appendChild(progressOverlay);
            }

            console.log('📤 [上傳開始]', fileName);
        }

        /**
         * 更新上傳進度
         */
        updateUploadProgress(element, percent) {
            if (!element) return;

            const progressBar = element.querySelector('.progress-bar');
            const percentageText = element.querySelector('.upload-percentage');

            if (progressBar) {
                progressBar.style.width = `${percent}%`;
            }

            if (percentageText) {
                percentageText.textContent = `${Math.round(percent)}%`;
            }
        }

        /**
         * 顯示上傳成功反饋
         */
        showUploadSuccess(element, fileName) {
            if (!element) return;

            element.classList.remove('uploading');
            element.classList.add('upload-success');

            // 移除進度覆蓋層
            const overlay = element.querySelector('.file-uploading-overlay');
            if (overlay) {
                overlay.remove();
            }

            // 建立成功勾選圖示
            const checkmark = document.createElement('div');
            checkmark.className = 'success-checkmark';
            checkmark.innerHTML = '<i class="fas fa-check-circle"></i>';
            element.appendChild(checkmark);

            // 3 秒後淡出勾選
            setTimeout(() => {
                checkmark.classList.add('fade-out');
                setTimeout(() => checkmark.remove(), 500);
                element.classList.remove('upload-success');
            }, 3000);

            // Toast 通知
            this.toast.success(`✅ ${fileName || '檔案'}上傳成功！`, {
                duration: 2000
            });

            console.log('✅ [上傳成功]', fileName);
        }

        /**
         * 顯示上傳失敗反饋
         */
        showUploadError(element, errorCode, fileName, retryCallback) {
            if (!element) return;

            element.classList.remove('uploading');
            element.classList.add('upload-error');

            // 移除進度覆蓋層
            const overlay = element.querySelector('.file-uploading-overlay');
            if (overlay) {
                overlay.remove();
            }

            // 建立錯誤圖示
            const errorIcon = document.createElement('div');
            errorIcon.className = 'error-icon';
            errorIcon.innerHTML = '<i class="fas fa-exclamation-circle"></i>';
            element.appendChild(errorIcon);

            // 獲取友善的錯誤訊息
            const errorInfo = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.DEFAULT;

            // Toast 通知（帶重試按鈕）
            this.toast.error(errorInfo.message, {
                title: errorInfo.title,
                duration: 5000,
                action: retryCallback ? {
                    text: '重試',
                    action: 'retry',
                    onClick: retryCallback
                } : null
            });

            console.error('❌ [上傳失敗]', fileName, errorCode);
        }

        /**
         * 處理錯誤並顯示友善訊息
         */
        handleError(error, context = {}) {
            let errorCode = 'DEFAULT';

            // 識別錯誤類型
            if (error.code) {
                errorCode = error.code;
            } else if (error.message) {
                if (/network|ERR_NETWORK/i.test(error.message)) {
                    errorCode = 'NETWORK_ERROR';
                } else if (/timeout/i.test(error.message)) {
                    errorCode = 'TIMEOUT';
                } else if (/404/i.test(error.message)) {
                    errorCode = '404';
                } else if (/500|server/i.test(error.message)) {
                    errorCode = 'SERVER_ERROR';
                }
            }

            const errorInfo = ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.DEFAULT;

            // 顯示錯誤 Toast
            this.toast.error(errorInfo.message, {
                title: errorInfo.title,
                duration: 5000
            });

            // 記錄詳細錯誤到 console
            console.error('❌ [錯誤處理]', {
                code: errorCode,
                message: error.message,
                stack: error.stack,
                context
            });

            return errorInfo;
        }
    }

    // ==================== 全域 API ====================
    
    const feedbackManager = new UploadFeedbackManager();

    // 暴露到全域
    global.UploadFeedback = {
        showStart: (element, fileName) => feedbackManager.showUploadStart(element, fileName),
        updateProgress: (element, percent) => feedbackManager.updateUploadProgress(element, percent),
        showSuccess: (element, fileName) => feedbackManager.showUploadSuccess(element, fileName),
        showError: (element, errorCode, fileName, retryCallback) => 
            feedbackManager.showUploadError(element, errorCode, fileName, retryCallback),
        handleError: (error, context) => feedbackManager.handleError(error, context),
        toast: feedbackManager.toast
    };

    // 快捷函數（向後相容）
    global.showToast = function(message, type = 'info', options = {}) {
        return feedbackManager.toast.show(message, type, options);
    };

    console.log('✅ 上傳反饋系統已初始化');

})(window);
