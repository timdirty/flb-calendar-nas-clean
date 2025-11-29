/**
 * 學習歷程上傳系統 - 錯誤處理管理器
 * 提供統一的錯誤處理、分類、友善訊息和用戶通知
 */

(function (global) {
    'use strict';

    // ============================================
    // 錯誤類型定義
    // ============================================
    const ErrorTypes = {
        // 網路錯誤
        NETWORK_ERROR: 'NETWORK_ERROR',
        NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
        NETWORK_OFFLINE: 'NETWORK_OFFLINE',
        
        // 檔案錯誤
        FILE_TOO_LARGE: 'FILE_TOO_LARGE',
        FILE_TYPE_INVALID: 'FILE_TYPE_INVALID',
        FILE_CORRUPTED: 'FILE_CORRUPTED',
        FILE_READ_ERROR: 'FILE_READ_ERROR',
        
        // 記憶體錯誤
        MEMORY_EXCEEDED: 'MEMORY_EXCEEDED',
        MEMORY_PRESSURE: 'MEMORY_PRESSURE',
        
        // 上傳錯誤
        UPLOAD_FAILED: 'UPLOAD_FAILED',
        UPLOAD_CANCELLED: 'UPLOAD_CANCELLED',
        UPLOAD_QUOTA_EXCEEDED: 'UPLOAD_QUOTA_EXCEEDED',
        
        // 處理錯誤
        COMPRESSION_FAILED: 'COMPRESSION_FAILED',
        THUMBNAIL_FAILED: 'THUMBNAIL_FAILED',
        WORKER_ERROR: 'WORKER_ERROR',
        
        // 伺服器錯誤
        SERVER_ERROR: 'SERVER_ERROR',
        SERVER_UNAVAILABLE: 'SERVER_UNAVAILABLE',
        PERMISSION_DENIED: 'PERMISSION_DENIED',
        
        // 其他
        UNKNOWN_ERROR: 'UNKNOWN_ERROR',
        VALIDATION_ERROR: 'VALIDATION_ERROR'
    };

    // ============================================
    // 錯誤嚴重程度
    // ============================================
    const ErrorSeverity = {
        INFO: 'info',       // 資訊性（可忽略）
        WARNING: 'warning', // 警告（需注意）
        ERROR: 'error',     // 錯誤（需處理）
        CRITICAL: 'critical' // 嚴重（系統級）
    };

    // ============================================
    // 錯誤訊息模板
    // ============================================
    const ErrorMessages = {
        [ErrorTypes.NETWORK_ERROR]: {
            title: '網路連線問題',
            message: '無法連接到伺服器，請檢查您的網路連線。',
            suggestions: [
                '檢查網路連線是否正常',
                '稍後再試',
                '如果問題持續，請聯絡管理員'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: true
        },
        [ErrorTypes.NETWORK_TIMEOUT]: {
            title: '連線逾時',
            message: '伺服器回應時間過長，請稍後再試。',
            suggestions: [
                '檔案可能太大，請稍後再試',
                '檢查網路速度',
                '嘗試分批上傳'
            ],
            severity: ErrorSeverity.WARNING,
            retryable: true
        },
        [ErrorTypes.NETWORK_OFFLINE]: {
            title: '網路已離線',
            message: '您的裝置目前沒有網路連線。',
            suggestions: [
                '請連接到網路後再試',
                '檔案會暫存在本地，連線後可繼續上傳'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: true
        },
        [ErrorTypes.FILE_TOO_LARGE]: {
            title: '檔案太大',
            message: '檔案大小超過限制。',
            suggestions: [
                '單個檔案大小不得超過 500MB',
                '請壓縮檔案後再上傳',
                '或聯絡管理員提高限制'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: false
        },
        [ErrorTypes.FILE_TYPE_INVALID]: {
            title: '檔案格式不支援',
            message: '此檔案格式無法上傳。',
            suggestions: [
                '僅支援照片（JPG, PNG, HEIC）和影片（MP4, MOV）',
                '請轉換檔案格式後再試'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: false
        },
        [ErrorTypes.FILE_CORRUPTED]: {
            title: '檔案已損壞',
            message: '此檔案無法讀取或已損壞。',
            suggestions: [
                '請檢查檔案是否完整',
                '嘗試重新匯出或下載檔案'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: false
        },
        [ErrorTypes.FILE_READ_ERROR]: {
            title: '檔案讀取失敗',
            message: '無法讀取檔案內容。',
            suggestions: [
                '檢查檔案權限',
                '重新選擇檔案',
                '如果問題持續，請嘗試其他瀏覽器'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: true
        },
        [ErrorTypes.MEMORY_EXCEEDED]: {
            title: '記憶體不足',
            message: '系統記憶體不足，無法處理此檔案。',
            suggestions: [
                '關閉其他網頁或應用程式',
                '重新整理頁面',
                '嘗試上傳較小的檔案',
                '分批上傳'
            ],
            severity: ErrorSeverity.CRITICAL,
            retryable: true
        },
        [ErrorTypes.MEMORY_PRESSURE]: {
            title: '記憶體使用過高',
            message: '記憶體使用接近上限，建議減少同時上傳的檔案數。',
            suggestions: [
                '暫停其他上傳',
                '分批上傳',
                '關閉其他網頁'
            ],
            severity: ErrorSeverity.WARNING,
            retryable: true
        },
        [ErrorTypes.UPLOAD_FAILED]: {
            title: '上傳失敗',
            message: '檔案上傳時發生錯誤。',
            suggestions: [
                '請檢查網路連線',
                '稍後再試',
                '如果問題持續，請聯絡管理員'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: true
        },
        [ErrorTypes.UPLOAD_CANCELLED]: {
            title: '上傳已取消',
            message: '您已取消檔案上傳。',
            suggestions: [],
            severity: ErrorSeverity.INFO,
            retryable: false
        },
        [ErrorTypes.UPLOAD_QUOTA_EXCEEDED]: {
            title: '儲存空間不足',
            message: '伺服器儲存空間不足，無法完成上傳。',
            suggestions: [
                '請聯絡管理員清理空間',
                '或刪除舊的學習記錄'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: false
        },
        [ErrorTypes.COMPRESSION_FAILED]: {
            title: '壓縮失敗',
            message: '檔案壓縮時發生錯誤。',
            suggestions: [
                '將嘗試以原始大小上傳',
                '如果問題持續，請選擇其他檔案'
            ],
            severity: ErrorSeverity.WARNING,
            retryable: false
        },
        [ErrorTypes.THUMBNAIL_FAILED]: {
            title: '縮圖生成失敗',
            message: '無法為影片生成預覽圖。',
            suggestions: [
                '不影響上傳，將使用預設圖示',
                '影片檔案本身不受影響'
            ],
            severity: ErrorSeverity.INFO,
            retryable: false
        },
        [ErrorTypes.WORKER_ERROR]: {
            title: '處理程序錯誤',
            message: '背景處理程序發生錯誤。',
            suggestions: [
                '將切換到備用處理方式',
                '不影響上傳功能'
            ],
            severity: ErrorSeverity.WARNING,
            retryable: true
        },
        [ErrorTypes.SERVER_ERROR]: {
            title: '伺服器錯誤',
            message: '伺服器處理請求時發生錯誤。',
            suggestions: [
                '請稍後再試',
                '如果問題持續，請聯絡管理員'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: true
        },
        [ErrorTypes.SERVER_UNAVAILABLE]: {
            title: '伺服器無法使用',
            message: '伺服器目前無法處理請求。',
            suggestions: [
                '可能正在維護中',
                '請稍後再試'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: true
        },
        [ErrorTypes.PERMISSION_DENIED]: {
            title: '權限不足',
            message: '您沒有權限執行此操作。',
            suggestions: [
                '請確認您已登入',
                '聯絡管理員確認權限設定'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: false
        },
        [ErrorTypes.VALIDATION_ERROR]: {
            title: '資料驗證失敗',
            message: '提交的資料不符合要求。',
            suggestions: [
                '請檢查必填欄位是否完整',
                '確認檔案格式正確'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: false
        },
        [ErrorTypes.UNKNOWN_ERROR]: {
            title: '未知錯誤',
            message: '發生了預期外的錯誤。',
            suggestions: [
                '請重新整理頁面',
                '如果問題持續，請聯絡管理員',
                '請提供錯誤發生時的操作步驟'
            ],
            severity: ErrorSeverity.ERROR,
            retryable: true
        }
    };

    // ============================================
    // 錯誤處理管理器
    // ============================================
    class ErrorHandler {
        constructor() {
            this.errorLog = [];
            this.maxLogSize = 100;
            this.notificationQueue = [];
            this.isShowingNotification = false;
            
            // 錯誤統計
            this.errorStats = {
                total: 0,
                byType: {},
                bySeverity: {}
            };
            
            // 監聽全域錯誤
            this.setupGlobalErrorHandlers();
        }

        /**
         * 設置全域錯誤處理器
         */
        setupGlobalErrorHandlers() {
            if (typeof window !== 'undefined') {
                // 捕獲未處理的錯誤
                window.addEventListener('error', (event) => {
                    this.handleError({
                        type: ErrorTypes.UNKNOWN_ERROR,
                        originalError: event.error,
                        message: event.message,
                        stack: event.error?.stack,
                        context: {
                            filename: event.filename,
                            lineno: event.lineno,
                            colno: event.colno
                        }
                    });
                });

                // 捕獲 Promise 拒絕
                window.addEventListener('unhandledrejection', (event) => {
                    this.handleError({
                        type: ErrorTypes.UNKNOWN_ERROR,
                        originalError: event.reason,
                        message: event.reason?.message || 'Promise rejected',
                        stack: event.reason?.stack,
                        context: {
                            promise: true
                        }
                    });
                });

                // 監聽網路狀態
                window.addEventListener('online', () => {
                    console.log('✅ [錯誤處理] 網路已恢復');
                    this.showNotification({
                        type: 'success',
                        message: '網路連線已恢復',
                        duration: 3000
                    });
                });

                window.addEventListener('offline', () => {
                    console.warn('⚠️ [錯誤處理] 網路已離線');
                    this.handleError({
                        type: ErrorTypes.NETWORK_OFFLINE,
                        showNotification: true
                    });
                });
            }
        }

        /**
         * 處理錯誤
         * @param {Object} error - 錯誤物件
         * @returns {Object} 處理後的錯誤資訊
         */
        handleError(error) {
            try {
                // 分類錯誤
                const classifiedError = this.classifyError(error);
                
                // 記錄錯誤
                this.logError(classifiedError);
                
                // 更新統計
                this.updateStats(classifiedError);
                
                // 顯示通知（如果需要）
                if (error.showNotification !== false) {
                    this.showErrorNotification(classifiedError);
                }
                
                // 執行回調（如果有）
                if (typeof error.onError === 'function') {
                    try {
                        error.onError(classifiedError);
                    } catch (callbackError) {
                        console.error('❌ [錯誤處理] 回調執行失敗:', callbackError);
                    }
                }
                
                return classifiedError;
                
            } catch (handlerError) {
                console.error('❌ [錯誤處理] 處理器本身發生錯誤:', handlerError);
                return {
                    type: ErrorTypes.UNKNOWN_ERROR,
                    originalError: error,
                    handlerError: handlerError
                };
            }
        }

        /**
         * 分類錯誤
         */
        classifyError(error) {
            const type = error.type || this.detectErrorType(error);
            const template = ErrorMessages[type] || ErrorMessages[ErrorTypes.UNKNOWN_ERROR];
            
            return {
                type: type,
                severity: error.severity || template.severity,
                title: error.title || template.title,
                message: error.message || template.message,
                suggestions: error.suggestions || template.suggestions,
                retryable: error.retryable !== undefined ? error.retryable : template.retryable,
                originalError: error.originalError || error,
                context: error.context || {},
                timestamp: Date.now(),
                stack: error.stack || error.originalError?.stack
            };
        }

        /**
         * 偵測錯誤類型
         */
        detectErrorType(error) {
            const err = error.originalError || error;
            const message = (err.message || err.toString()).toLowerCase();
            
            // 網路錯誤
            if (message.includes('network') || message.includes('fetch')) {
                return ErrorTypes.NETWORK_ERROR;
            }
            if (message.includes('timeout') || message.includes('timed out')) {
                return ErrorTypes.NETWORK_TIMEOUT;
            }
            if (!navigator.onLine) {
                return ErrorTypes.NETWORK_OFFLINE;
            }
            
            // 記憶體錯誤
            if (message.includes('memory') || message.includes('heap')) {
                return ErrorTypes.MEMORY_EXCEEDED;
            }
            
            // 檔案錯誤
            if (message.includes('file') && message.includes('too large')) {
                return ErrorTypes.FILE_TOO_LARGE;
            }
            if (message.includes('invalid') && (message.includes('file') || message.includes('type'))) {
                return ErrorTypes.FILE_TYPE_INVALID;
            }
            
            // 權限錯誤
            if (message.includes('permission') || message.includes('denied') || message.includes('forbidden')) {
                return ErrorTypes.PERMISSION_DENIED;
            }
            
            // 伺服器錯誤
            if (err.status >= 500 || message.includes('server error')) {
                return ErrorTypes.SERVER_ERROR;
            }
            if (err.status === 503 || message.includes('unavailable')) {
                return ErrorTypes.SERVER_UNAVAILABLE;
            }
            if (err.status === 413 || message.includes('quota')) {
                return ErrorTypes.UPLOAD_QUOTA_EXCEEDED;
            }
            
            return ErrorTypes.UNKNOWN_ERROR;
        }

        /**
         * 記錄錯誤
         */
        logError(error) {
            this.errorLog.push(error);
            
            // 限制日誌大小
            if (this.errorLog.length > this.maxLogSize) {
                this.errorLog.shift();
            }
            
            // 輸出到控制台
            const emoji = this.getSeverityEmoji(error.severity);
            console.error(`${emoji} [錯誤] ${error.title}:`, error.message);
            
            if (error.suggestions && error.suggestions.length > 0) {
                console.log('💡 建議:', error.suggestions);
            }
            
            if (error.stack) {
                console.log('📚 堆疊:', error.stack);
            }
        }

        /**
         * 更新錯誤統計
         */
        updateStats(error) {
            this.errorStats.total++;
            
            // 按類型統計
            if (!this.errorStats.byType[error.type]) {
                this.errorStats.byType[error.type] = 0;
            }
            this.errorStats.byType[error.type]++;
            
            // 按嚴重程度統計
            if (!this.errorStats.bySeverity[error.severity]) {
                this.errorStats.bySeverity[error.severity] = 0;
            }
            this.errorStats.bySeverity[error.severity]++;
        }

        /**
         * 顯示錯誤通知
         */
        showErrorNotification(error) {
            // 根據嚴重程度決定通知類型
            const notificationType = {
                [ErrorSeverity.INFO]: 'info',
                [ErrorSeverity.WARNING]: 'warning',
                [ErrorSeverity.ERROR]: 'error',
                [ErrorSeverity.CRITICAL]: 'error'
            }[error.severity] || 'error';
            
            // 構建通知內容
            const notificationContent = this.buildNotificationContent(error);
            
            this.showNotification({
                type: notificationType,
                title: error.title,
                message: notificationContent,
                duration: error.severity === ErrorSeverity.CRITICAL ? 0 : 8000, // 嚴重錯誤不自動關閉
                retryable: error.retryable,
                error: error
            });
        }

        /**
         * 構建通知內容
         */
        buildNotificationContent(error) {
            let content = error.message;
            
            if (error.suggestions && error.suggestions.length > 0) {
                content += '\n\n建議：\n' + error.suggestions.map(s => `• ${s}`).join('\n');
            }
            
            return content;
        }

        /**
         * 顯示通知
         */
        showNotification(notification) {
            // 加入佇列
            this.notificationQueue.push(notification);
            
            // 如果沒有正在顯示的通知，立即顯示
            if (!this.isShowingNotification) {
                this.processNotificationQueue();
            }
        }

        /**
         * 處理通知佇列
         */
        processNotificationQueue() {
            if (this.notificationQueue.length === 0) {
                this.isShowingNotification = false;
                return;
            }
            
            this.isShowingNotification = true;
            const notification = this.notificationQueue.shift();
            
            // 使用自訂通知系統或瀏覽器原生
            this.displayNotification(notification, () => {
                // 顯示完成後處理下一個
                setTimeout(() => {
                    this.processNotificationQueue();
                }, 500);
            });
        }

        /**
         * 顯示實際通知
         */
        displayNotification(notification, onClose) {
            // 嘗試使用頁面上的通知系統
            if (typeof window.showUserNotification === 'function') {
                window.showUserNotification({
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    duration: notification.duration,
                    onClose: onClose
                });
                return;
            }
            
            // 降級：使用 alert（不理想但確保用戶能看到）
            if (notification.type === 'error' || notification.type === 'warning') {
                const message = notification.title + '\n\n' + notification.message;
                alert(message);
            }
            
            if (typeof onClose === 'function') {
                onClose();
            }
        }

        /**
         * 取得嚴重程度表情符號
         */
        getSeverityEmoji(severity) {
            return {
                [ErrorSeverity.INFO]: 'ℹ️',
                [ErrorSeverity.WARNING]: '⚠️',
                [ErrorSeverity.ERROR]: '❌',
                [ErrorSeverity.CRITICAL]: '🚨'
            }[severity] || '❓';
        }

        /**
         * 取得錯誤日誌
         */
        getErrorLog(filter = {}) {
            let logs = [...this.errorLog];
            
            if (filter.type) {
                logs = logs.filter(log => log.type === filter.type);
            }
            
            if (filter.severity) {
                logs = logs.filter(log => log.severity === filter.severity);
            }
            
            if (filter.since) {
                logs = logs.filter(log => log.timestamp >= filter.since);
            }
            
            return logs;
        }

        /**
         * 取得錯誤統計
         */
        getStats() {
            return {
                ...this.errorStats,
                recentErrors: this.errorLog.slice(-10)
            };
        }

        /**
         * 清除錯誤日誌
         */
        clearLog() {
            this.errorLog = [];
            console.log('✅ [錯誤處理] 錯誤日誌已清除');
        }

        /**
         * 重置統計
         */
        resetStats() {
            this.errorStats = {
                total: 0,
                byType: {},
                bySeverity: {}
            };
            console.log('✅ [錯誤處理] 統計已重置');
        }
    }

    // ============================================
    // 導出
    // ============================================
    const errorHandler = new ErrorHandler();
    
    global.LearningUploadErrorHandler = errorHandler;
    global.LearningUploadErrorTypes = ErrorTypes;
    global.LearningUploadErrorSeverity = ErrorSeverity;
    
    // 便捷函數
    global.handleUploadError = function(error) {
        return errorHandler.handleError(error);
    };

})(window);


