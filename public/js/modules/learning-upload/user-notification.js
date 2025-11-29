/**
 * 學習歷程上傳系統 - 用戶通知 UI
 * 提供美觀、友善的通知介面
 */

(function (global) {
    'use strict';

    // ============================================
    // 通知管理器
    // ============================================
    class UserNotificationManager {
        constructor() {
            this.container = null;
            this.activeNotifications = new Map();
            this.notificationIdCounter = 0;
            
            this.init();
        }

        /**
         * 初始化通知容器
         */
        init() {
            // 檢查是否已存在
            this.container = document.getElementById('learning-upload-notifications');
            
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.id = 'learning-upload-notifications';
                this.container.className = 'learning-upload-notifications';
                
                // 插入到 body
                if (document.body) {
                    document.body.appendChild(this.container);
                } else {
                    document.addEventListener('DOMContentLoaded', () => {
                        document.body.appendChild(this.container);
                    });
                }
            }
            
            // 插入樣式
            this.injectStyles();
            
            console.log('✅ [通知系統] 已初始化');
        }

        /**
         * 插入 CSS 樣式
         */
        injectStyles() {
            if (document.getElementById('learning-upload-notification-styles')) {
                return;
            }
            
            const style = document.createElement('style');
            style.id = 'learning-upload-notification-styles';
            style.textContent = `
                .learning-upload-notifications {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    z-index: 99999;
                    pointer-events: none;
                    max-width: 420px;
                }
                
                .learning-upload-notification {
                    pointer-events: all;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
                    margin-bottom: 12px;
                    overflow: hidden;
                    animation: slideInRight 0.3s ease-out;
                    transition: all 0.3s ease;
                }
                
                .learning-upload-notification.hiding {
                    animation: slideOutRight 0.3s ease-in;
                    opacity: 0;
                    transform: translateX(100%);
                }
                
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                @keyframes slideOutRight {
                    from {
                        opacity: 1;
                        transform: translateX(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateX(100%);
                    }
                }
                
                .learning-upload-notification-header {
                    display: flex;
                    align-items: center;
                    padding: 16px;
                    border-bottom: 1px solid #f0f0f0;
                }
                
                .learning-upload-notification-icon {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-right: 12px;
                    flex-shrink: 0;
                    font-size: 14px;
                }
                
                .learning-upload-notification.success .learning-upload-notification-icon {
                    background: #d4edda;
                    color: #155724;
                }
                
                .learning-upload-notification.error .learning-upload-notification-icon {
                    background: #f8d7da;
                    color: #721c24;
                }
                
                .learning-upload-notification.warning .learning-upload-notification-icon {
                    background: #fff3cd;
                    color: #856404;
                }
                
                .learning-upload-notification.info .learning-upload-notification-icon {
                    background: #d1ecf1;
                    color: #0c5460;
                }
                
                .learning-upload-notification-title {
                    flex: 1;
                    font-weight: 600;
                    font-size: 15px;
                    color: #333;
                }
                
                .learning-upload-notification-close {
                    background: none;
                    border: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #999;
                    transition: all 0.2s;
                    font-size: 18px;
                    line-height: 1;
                    padding: 0;
                }
                
                .learning-upload-notification-close:hover {
                    background: #f5f5f5;
                    color: #333;
                }
                
                .learning-upload-notification-body {
                    padding: 16px;
                }
                
                .learning-upload-notification-message {
                    color: #666;
                    font-size: 14px;
                    line-height: 1.5;
                    margin-bottom: 0;
                    white-space: pre-wrap;
                }
                
                .learning-upload-notification-suggestions {
                    margin-top: 12px;
                    padding: 12px;
                    background: #f8f9fa;
                    border-radius: 8px;
                }
                
                .learning-upload-notification-suggestions-title {
                    font-size: 13px;
                    font-weight: 600;
                    color: #333;
                    margin-bottom: 8px;
                }
                
                .learning-upload-notification-suggestions-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .learning-upload-notification-suggestions-list li {
                    font-size: 13px;
                    color: #666;
                    padding-left: 20px;
                    position: relative;
                    margin-bottom: 6px;
                }
                
                .learning-upload-notification-suggestions-list li:last-child {
                    margin-bottom: 0;
                }
                
                .learning-upload-notification-suggestions-list li::before {
                    content: '💡';
                    position: absolute;
                    left: 0;
                    font-size: 12px;
                }
                
                .learning-upload-notification-actions {
                    padding: 12px 16px;
                    background: #f8f9fa;
                    display: flex;
                    gap: 8px;
                    justify-content: flex-end;
                }
                
                .learning-upload-notification-button {
                    padding: 8px 16px;
                    border: none;
                    border-radius: 6px;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                
                .learning-upload-notification-button.primary {
                    background: #007bff;
                    color: white;
                }
                
                .learning-upload-notification-button.primary:hover {
                    background: #0056b3;
                }
                
                .learning-upload-notification-button.secondary {
                    background: white;
                    color: #666;
                    border: 1px solid #ddd;
                }
                
                .learning-upload-notification-button.secondary:hover {
                    background: #f5f5f5;
                }
                
                .learning-upload-notification-progress {
                    height: 3px;
                    background: #e9ecef;
                    position: relative;
                    overflow: hidden;
                }
                
                .learning-upload-notification-progress-bar {
                    height: 100%;
                    background: currentColor;
                    transition: width 0.1s linear;
                }
                
                .learning-upload-notification.success .learning-upload-notification-progress-bar {
                    background: #28a745;
                }
                
                .learning-upload-notification.error .learning-upload-notification-progress-bar {
                    background: #dc3545;
                }
                
                .learning-upload-notification.warning .learning-upload-notification-progress-bar {
                    background: #ffc107;
                }
                
                .learning-upload-notification.info .learning-upload-notification-progress-bar {
                    background: #17a2b8;
                }
                
                /* 響應式設計 */
                @media (max-width: 768px) {
                    .learning-upload-notifications {
                        left: 12px;
                        right: 12px;
                        top: 12px;
                        max-width: none;
                    }
                }
            `;
            
            document.head.appendChild(style);
        }

        /**
         * 顯示通知
         * @param {Object} options - 通知選項
         * @returns {string} 通知 ID
         */
        show(options) {
            const {
                type = 'info',
                title = '通知',
                message = '',
                suggestions = [],
                duration = 5000,
                actions = [],
                onClose = null,
                persistent = false
            } = options;
            
            const id = `notification-${++this.notificationIdCounter}`;
            
            // 創建通知元素
            const notification = this.createNotificationElement({
                id,
                type,
                title,
                message,
                suggestions,
                actions,
                persistent,
                duration
            });
            
            // 插入容器
            this.container.appendChild(notification);
            
            // 儲存參考
            const notificationData = {
                id,
                element: notification,
                onClose,
                timer: null
            };
            
            this.activeNotifications.set(id, notificationData);
            
            // 設置自動關閉（如果不是持久化）
            if (!persistent && duration > 0) {
                notificationData.timer = setTimeout(() => {
                    this.hide(id);
                }, duration);
            }
            
            console.log(`📢 [通知] 顯示通知 (${type}): ${title}`);
            
            return id;
        }

        /**
         * 創建通知元素
         */
        createNotificationElement(options) {
            const { id, type, title, message, suggestions, actions, persistent, duration } = options;
            
            const notification = document.createElement('div');
            notification.id = id;
            notification.className = `learning-upload-notification ${type}`;
            
            // 圖標映射
            const iconMap = {
                success: '✓',
                error: '✕',
                warning: '⚠',
                info: 'i'
            };
            
            // 標題列
            const header = document.createElement('div');
            header.className = 'learning-upload-notification-header';
            
            const icon = document.createElement('div');
            icon.className = 'learning-upload-notification-icon';
            icon.textContent = iconMap[type] || 'i';
            header.appendChild(icon);
            
            const titleElement = document.createElement('div');
            titleElement.className = 'learning-upload-notification-title';
            titleElement.textContent = title;
            header.appendChild(titleElement);
            
            const closeButton = document.createElement('button');
            closeButton.className = 'learning-upload-notification-close';
            closeButton.innerHTML = '×';
            closeButton.onclick = () => this.hide(id);
            header.appendChild(closeButton);
            
            notification.appendChild(header);
            
            // 內容
            const body = document.createElement('div');
            body.className = 'learning-upload-notification-body';
            
            if (message) {
                const messageElement = document.createElement('p');
                messageElement.className = 'learning-upload-notification-message';
                messageElement.textContent = message;
                body.appendChild(messageElement);
            }
            
            // 建議
            if (suggestions && suggestions.length > 0) {
                const suggestionsContainer = document.createElement('div');
                suggestionsContainer.className = 'learning-upload-notification-suggestions';
                
                const suggestionsTitle = document.createElement('div');
                suggestionsTitle.className = 'learning-upload-notification-suggestions-title';
                suggestionsTitle.textContent = '建議：';
                suggestionsContainer.appendChild(suggestionsTitle);
                
                const suggestionsList = document.createElement('ul');
                suggestionsList.className = 'learning-upload-notification-suggestions-list';
                
                suggestions.forEach(suggestion => {
                    const li = document.createElement('li');
                    li.textContent = suggestion;
                    suggestionsList.appendChild(li);
                });
                
                suggestionsContainer.appendChild(suggestionsList);
                body.appendChild(suggestionsContainer);
            }
            
            notification.appendChild(body);
            
            // 動作按鈕
            if (actions && actions.length > 0) {
                const actionsContainer = document.createElement('div');
                actionsContainer.className = 'learning-upload-notification-actions';
                
                actions.forEach(action => {
                    const button = document.createElement('button');
                    button.className = `learning-upload-notification-button ${action.style || 'secondary'}`;
                    button.textContent = action.label;
                    button.onclick = () => {
                        if (typeof action.onClick === 'function') {
                            action.onClick();
                        }
                        if (action.closeOnClick !== false) {
                            this.hide(id);
                        }
                    };
                    actionsContainer.appendChild(button);
                });
                
                notification.appendChild(actionsContainer);
            }
            
            // 進度條（如果有自動關閉）
            if (!persistent && duration > 0) {
                const progress = document.createElement('div');
                progress.className = 'learning-upload-notification-progress';
                
                const progressBar = document.createElement('div');
                progressBar.className = 'learning-upload-notification-progress-bar';
                progressBar.style.width = '100%';
                progress.appendChild(progressBar);
                
                notification.appendChild(progress);
                
                // 動畫進度條
                setTimeout(() => {
                    progressBar.style.transition = `width ${duration}ms linear`;
                    progressBar.style.width = '0%';
                }, 10);
            }
            
            return notification;
        }

        /**
         * 隱藏通知
         */
        hide(id) {
            const notificationData = this.activeNotifications.get(id);
            
            if (!notificationData) {
                return;
            }
            
            const { element, onClose, timer } = notificationData;
            
            // 清除計時器
            if (timer) {
                clearTimeout(timer);
            }
            
            // 添加隱藏動畫
            element.classList.add('hiding');
            
            // 動畫結束後移除元素
            setTimeout(() => {
                if (element.parentNode) {
                    element.parentNode.removeChild(element);
                }
                
                this.activeNotifications.delete(id);
                
                // 執行回調
                if (typeof onClose === 'function') {
                    try {
                        onClose();
                    } catch (error) {
                        console.error('❌ [通知] 關閉回調執行失敗:', error);
                    }
                }
            }, 300);
            
            console.log(`✅ [通知] 已隱藏通知: ${id}`);
        }

        /**
         * 隱藏所有通知
         */
        hideAll() {
            const ids = Array.from(this.activeNotifications.keys());
            ids.forEach(id => this.hide(id));
        }

        /**
         * 快捷方法：成功通知
         */
        success(message, options = {}) {
            return this.show({
                type: 'success',
                title: options.title || '成功',
                message,
                ...options
            });
        }

        /**
         * 快捷方法：錯誤通知
         */
        error(message, options = {}) {
            return this.show({
                type: 'error',
                title: options.title || '錯誤',
                message,
                duration: options.duration !== undefined ? options.duration : 8000,
                ...options
            });
        }

        /**
         * 快捷方法：警告通知
         */
        warning(message, options = {}) {
            return this.show({
                type: 'warning',
                title: options.title || '警告',
                message,
                ...options
            });
        }

        /**
         * 快捷方法：資訊通知
         */
        info(message, options = {}) {
            return this.show({
                type: 'info',
                title: options.title || '提示',
                message,
                ...options
            });
        }
    }

    // ============================================
    // 導出
    // ============================================
    const notificationManager = new UserNotificationManager();
    
    global.LearningUploadNotification = notificationManager;
    
    // 便捷函數
    global.showUserNotification = function(options) {
        return notificationManager.show(options);
    };

})(window);


