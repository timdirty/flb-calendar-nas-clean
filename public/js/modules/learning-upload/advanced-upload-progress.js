/**
 * 學習歷程上傳系統 - 進階上傳進度管理器
 * 提供即時速度、剩餘時間、批次進度視覺化
 */

(function (global) {
    'use strict';

    const Notification = global.LearningUploadNotification;

    // ============================================
    // 進階上傳進度管理器
    // ============================================
    class AdvancedUploadProgress {
        constructor() {
            this.uploads = new Map(); // uploadId -> UploadProgress
            this.container = null;
            this.isInitialized = false;
        }

        /**
         * 初始化進度容器
         */
        init() {
            if (this.isInitialized) return;

            // 創建進度容器
            this.container = document.createElement('div');
            this.container.id = 'advanced-upload-progress-container';
            this.container.className = 'advanced-upload-progress-container';

            // 插入樣式
            this.injectStyles();

            // 插入到 body
            if (document.body) {
                document.body.appendChild(this.container);
            } else {
                document.addEventListener('DOMContentLoaded', () => {
                    document.body.appendChild(this.container);
                });
            }

            this.isInitialized = true;
            console.log('✅ [進度管理] 已初始化');
        }

        /**
         * 插入 CSS 樣式
         */
        injectStyles() {
            if (document.getElementById('advanced-upload-progress-styles')) {
                return;
            }

            const style = document.createElement('style');
            style.id = 'advanced-upload-progress-styles';
            style.textContent = `
                .advanced-upload-progress-container {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    z-index: 99998;
                    max-width: 420px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .upload-progress-card {
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
                    padding: 16px;
                    animation: slideInUp 0.3s ease-out;
                    transition: all 0.3s ease;
                }

                .upload-progress-card.minimized {
                    padding: 8px 12px;
                }

                .upload-progress-card.completed {
                    opacity: 0.8;
                }

                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .upload-progress-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                }

                .upload-progress-title {
                    font-weight: 600;
                    font-size: 14px;
                    color: #333;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .upload-progress-icon {
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    animation: rotate 1s linear infinite;
                }

                .upload-progress-icon.completed {
                    animation: none;
                    color: #28a745;
                }

                .upload-progress-icon.failed {
                    animation: none;
                    color: #dc3545;
                }

                @keyframes rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .upload-progress-actions {
                    display: flex;
                    gap: 8px;
                }

                .upload-progress-btn {
                    background: none;
                    border: none;
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #666;
                    transition: all 0.2s;
                    font-size: 12px;
                }

                .upload-progress-btn:hover {
                    background: #f5f5f5;
                    color: #333;
                }

                .upload-progress-body {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .upload-progress-body.minimized {
                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    gap: 8px;
                    height: 28px;
                }

                .upload-progress-body.minimized > * {
                    display: none;
                }

                .upload-progress-body.minimized .upload-progress-bar-container {
                    display: block;
                    flex: 1;
                }

                .upload-progress-body.minimized .upload-progress-details {
                    display: flex;
                    padding: 0;
                    background: none;
                    min-width: 50px;
                }

                .upload-progress-bar-container {
                    width: 100%;
                    height: 8px;
                    background: #e9ecef;
                    border-radius: 4px;
                    overflow: hidden;
                    position: relative;
                }

                .upload-progress-bar {
                    height: 100%;
                    background: linear-gradient(90deg, #007bff 0%, #0056b3 100%);
                    border-radius: 4px;
                    transition: width 0.3s ease;
                    position: relative;
                }

                .upload-progress-bar.completed {
                    background: linear-gradient(90deg, #28a745 0%, #1e7e34 100%);
                }

                .upload-progress-bar.failed {
                    background: linear-gradient(90deg, #dc3545 0%, #bd2130 100%);
                }

                .upload-progress-bar::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(
                        90deg,
                        transparent 0%,
                        rgba(255, 255, 255, 0.3) 50%,
                        transparent 100%
                    );
                    animation: shimmer 2s infinite;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                .upload-progress-stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 12px;
                    font-size: 12px;
                }

                .upload-progress-stat {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }

                .upload-progress-stat-label {
                    color: #666;
                    font-size: 11px;
                }

                .upload-progress-stat-value {
                    color: #333;
                    font-weight: 600;
                    font-size: 13px;
                }

                .upload-progress-details {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    font-size: 12px;
                }

                .upload-progress-filename {
                    flex: 1;
                    color: #666;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    margin-right: 12px;
                }

                .upload-progress-percent {
                    font-weight: 600;
                    color: #007bff;
                    min-width: 40px;
                    text-align: right;
                }

                .upload-progress-batch {
                    margin-top: 8px;
                    padding-top: 8px;
                    border-top: 1px solid #e9ecef;
                }

                .upload-progress-batch-info {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 12px;
                    color: #666;
                }

                /* 響應式 - 手機版優化 */
                @media (max-width: 768px) {
                    .advanced-upload-progress-container {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        max-width: none;
                        background: rgba(255, 255, 255, 0.98);
                        backdrop-filter: blur(10px);
                        box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.1);
                        border-top: 1px solid #e9ecef;
                        padding: 8px;
                        gap: 6px;
                        max-height: 35vh;
                        overflow-y: auto;
                        border-radius: 0;
                    }

                    .upload-progress-card {
                        padding: 8px;
                        border-radius: 8px;
                        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
                    }

                    .upload-progress-card.minimized {
                        padding: 6px 8px;
                    }

                    .upload-progress-header {
                        margin-bottom: 6px;
                    }

                    .upload-progress-title {
                        font-size: 12px;
                        gap: 6px;
                    }

                    .upload-progress-icon {
                        width: 16px;
                        height: 16px;
                        font-size: 12px;
                    }

                    .upload-progress-btn {
                        width: 20px;
                        height: 20px;
                        font-size: 11px;
                    }

                    .upload-progress-body {
                        gap: 6px;
                    }

                    .upload-progress-body.minimized {
                        height: 24px;
                        gap: 6px;
                    }

                    .upload-progress-bar-container {
                        height: 6px;
                    }

                    .upload-progress-stats {
                        gap: 8px;
                        font-size: 11px;
                    }

                    .upload-progress-stat {
                        gap: 2px;
                    }

                    .upload-progress-stat-label {
                        font-size: 10px;
                    }

                    .upload-progress-stat-value {
                        font-size: 11px;
                    }

                    .upload-progress-details {
                        padding: 6px;
                        font-size: 11px;
                        margin-right: 8px;
                    }

                    .upload-progress-filename {
                        font-size: 11px;
                        margin-right: 8px;
                    }

                    .upload-progress-percent {
                        font-size: 11px;
                        min-width: 35px;
                    }

                    .upload-progress-batch {
                        margin-top: 6px;
                        padding-top: 6px;
                        font-size: 11px;
                    }
                }
            `;

            document.head.appendChild(style);
        }

        /**
         * 開始上傳
         */
        startUpload(options) {
            if (!this.isInitialized) {
                this.init();
            }

            const uploadId = options.id || `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const uploadProgress = new UploadProgress(uploadId, options);

            this.uploads.set(uploadId, uploadProgress);

            // 創建進度卡片
            const card = this.createProgressCard(uploadProgress);
            this.container.appendChild(card);

            console.log(`📤 [進度管理] 開始上傳: ${uploadId}`, options);

            return uploadProgress;
        }

        /**
         * 創建進度卡片
         */
        createProgressCard(uploadProgress) {
            const card = document.createElement('div');
            card.className = 'upload-progress-card';
            card.id = `upload-card-${uploadProgress.id}`;
            card.setAttribute('data-upload-id', uploadProgress.id);

            // 標題列
            const header = document.createElement('div');
            header.className = 'upload-progress-header';

            const title = document.createElement('div');
            title.className = 'upload-progress-title';
            title.innerHTML = `
                <span class="upload-progress-icon">⟳</span>
                <span>${uploadProgress.title}</span>
            `;
            header.appendChild(title);

            const actions = document.createElement('div');
            actions.className = 'upload-progress-actions';

            // 收合/展開按鈕
            const minimizeBtn = document.createElement('button');
            minimizeBtn.className = 'upload-progress-btn';
            minimizeBtn.innerHTML = window.innerWidth <= 768 ? '▼' : '−';
            minimizeBtn.title = window.innerWidth <= 768 ? '展開' : '收合';
            minimizeBtn.onclick = () => this.toggleMinimize(uploadProgress.id);
            actions.appendChild(minimizeBtn);

            // 關閉按鈕（完成後才顯示）
            const closeBtn = document.createElement('button');
            closeBtn.className = 'upload-progress-btn';
            closeBtn.innerHTML = '×';
            closeBtn.title = '關閉';
            closeBtn.style.display = 'none';
            closeBtn.onclick = () => this.removeUpload(uploadProgress.id);
            actions.appendChild(closeBtn);

            header.appendChild(actions);
            card.appendChild(header);

            // 進度內容
            const body = document.createElement('div');
            body.className = 'upload-progress-body';

            // 進度條
            const progressBarContainer = document.createElement('div');
            progressBarContainer.className = 'upload-progress-bar-container';

            const progressBar = document.createElement('div');
            progressBar.className = 'upload-progress-bar';
            progressBar.style.width = '0%';
            progressBarContainer.appendChild(progressBar);

            body.appendChild(progressBarContainer);

            // 統計資料
            const stats = document.createElement('div');
            stats.className = 'upload-progress-stats';
            stats.innerHTML = `
                <div class="upload-progress-stat">
                    <div class="upload-progress-stat-label">上傳速度</div>
                    <div class="upload-progress-stat-value" data-stat="speed">0 KB/s</div>
                </div>
                <div class="upload-progress-stat">
                    <div class="upload-progress-stat-label">剩餘時間</div>
                    <div class="upload-progress-stat-value" data-stat="remaining">計算中...</div>
                </div>
                <div class="upload-progress-stat">
                    <div class="upload-progress-stat-label">已上傳</div>
                    <div class="upload-progress-stat-value" data-stat="uploaded">0 MB</div>
                </div>
                <div class="upload-progress-stat">
                    <div class="upload-progress-stat-label">總大小</div>
                    <div class="upload-progress-stat-value" data-stat="total">0 MB</div>
                </div>
            `;
            body.appendChild(stats);

            // 檔案詳情（單檔案時顯示）
            if (!uploadProgress.isBatch) {
                const details = document.createElement('div');
                details.className = 'upload-progress-details';
                details.innerHTML = `
                    <div class="upload-progress-filename">${uploadProgress.filename || '檔案'}</div>
                    <div class="upload-progress-percent">0%</div>
                `;
                body.appendChild(details);
            }

            // 批次資訊（批次上傳時顯示）
            if (uploadProgress.isBatch) {
                const batch = document.createElement('div');
                batch.className = 'upload-progress-batch';
                batch.innerHTML = `
                    <div class="upload-progress-batch-info">
                        <span>進度: <span data-stat="batch-current">0</span> / <span data-stat="batch-total">${uploadProgress.totalFiles}</span></span>
                        <span data-stat="batch-percent">0%</span>
                    </div>
                `;
                body.appendChild(batch);
            }

            card.appendChild(body);

            // 手機版預設收合
            if (window.innerWidth <= 768) {
                body.classList.add('minimized');
                card.classList.add('minimized');
            }

            // 儲存參考
            uploadProgress.card = card;
            uploadProgress.elements = {
                icon: title.querySelector('.upload-progress-icon'),
                progressBar: progressBar,
                closeBtn: closeBtn,
                minimizeBtn: minimizeBtn
            };

            return card;
        }

        /**
         * 更新進度
         */
        updateProgress(uploadId, progress) {
            const uploadProgress = this.uploads.get(uploadId);
            if (!uploadProgress) return;

            uploadProgress.update(progress);

            const card = uploadProgress.card;
            if (!card) return;

            // 更新進度條
            const progressBar = card.querySelector('.upload-progress-bar');
            if (progressBar) {
                progressBar.style.width = `${progress.percent || 0}%`;
            }

            // 更新統計
            this.updateStat(card, 'speed', this.formatSpeed(uploadProgress.speed));
            this.updateStat(card, 'remaining', this.formatTime(uploadProgress.remainingTime));
            this.updateStat(card, 'uploaded', this.formatSize(progress.loaded || 0));
            this.updateStat(card, 'total', this.formatSize(progress.total || 0));

            // 更新百分比
            const percentElement = card.querySelector('.upload-progress-percent');
            if (percentElement) {
                percentElement.textContent = `${Math.round(progress.percent || 0)}%`;
            }

            // 更新批次資訊
            if (uploadProgress.isBatch && progress.batch) {
                this.updateStat(card, 'batch-current', progress.batch.current || 0);
                this.updateStat(card, 'batch-total', progress.batch.total || 0);
                this.updateStat(card, 'batch-percent', `${Math.round(progress.batch.percent || 0)}%`);
            }
        }

        /**
         * 更新統計值
         */
        updateStat(card, statName, value) {
            const element = card.querySelector(`[data-stat="${statName}"]`);
            if (element) {
                element.textContent = value;
            }
        }

        /**
         * 完成上傳
         */
        completeUpload(uploadId, result = {}) {
            const uploadProgress = this.uploads.get(uploadId);
            if (!uploadProgress) return;

            uploadProgress.complete(result);

            const card = uploadProgress.card;
            if (!card) return;

            // 更新樣式
            card.classList.add('completed');
            const icon = card.querySelector('.upload-progress-icon');
            if (icon) {
                icon.innerHTML = '✓';
                icon.classList.add('completed');
            }

            const progressBar = card.querySelector('.upload-progress-bar');
            if (progressBar) {
                progressBar.classList.add('completed');
                progressBar.style.width = '100%';
            }

            // 顯示關閉按鈕
            const closeBtn = card.querySelector('.upload-progress-btn:last-child');
            if (closeBtn) {
                closeBtn.style.display = 'flex';
            }

            // 顯示成功通知
            if (Notification && result.showNotification !== false) {
                Notification.success(
                    result.message || `${uploadProgress.title} 完成`,
                    { duration: 3000 }
                );
            }

            // 3秒後自動移除
            setTimeout(() => {
                this.removeUpload(uploadId);
            }, 3000);

            console.log(`✅ [進度管理] 上傳完成: ${uploadId}`, result);
        }

        /**
         * 上傳失敗
         */
        failUpload(uploadId, error) {
            const uploadProgress = this.uploads.get(uploadId);
            if (!uploadProgress) return;

            uploadProgress.fail(error);

            const card = uploadProgress.card;
            if (!card) return;

            // 更新樣式
            card.classList.add('failed');
            const icon = card.querySelector('.upload-progress-icon');
            if (icon) {
                icon.innerHTML = '✕';
                icon.classList.add('failed');
            }

            const progressBar = card.querySelector('.upload-progress-bar');
            if (progressBar) {
                progressBar.classList.add('failed');
            }

            // 顯示關閉按鈕
            const closeBtn = card.querySelector('.upload-progress-btn:last-child');
            if (closeBtn) {
                closeBtn.style.display = 'flex';
            }

            console.error(`❌ [進度管理] 上傳失敗: ${uploadId}`, error);
        }

        /**
         * 切換收合/展開
         */
        toggleMinimize(uploadId) {
            const card = document.getElementById(`upload-card-${uploadId}`);
            if (!card) return;

            const isMobile = window.innerWidth <= 768;
            card.classList.toggle('minimized');
            const body = card.querySelector('.upload-progress-body');
            if (body) {
                body.classList.toggle('minimized');
            }

            const minimizeBtn = card.querySelector('.upload-progress-btn:first-child');
            if (minimizeBtn) {
                const isMinimized = body.classList.contains('minimized');
                if (isMobile) {
                    minimizeBtn.innerHTML = isMinimized ? '▼' : '▲';
                    minimizeBtn.title = isMinimized ? '展開' : '收合';
                } else {
                    minimizeBtn.innerHTML = isMinimized ? '+' : '−';
                    minimizeBtn.title = isMinimized ? '展開' : '收合';
                }
            }
        }

        /**
         * 移除上傳
         */
        removeUpload(uploadId) {
            const card = document.getElementById(`upload-card-${uploadId}`);
            if (card) {
                card.style.opacity = '0';
                card.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    card.remove();
                }, 300);
            }

            this.uploads.delete(uploadId);
            console.log(`🗑️ [進度管理] 已移除: ${uploadId}`);
        }

        /**
         * 格式化速度
         */
        formatSpeed(bytesPerSecond) {
            if (!bytesPerSecond || bytesPerSecond === 0) return '0 KB/s';

            const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
            let size = bytesPerSecond;
            let unitIndex = 0;

            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024;
                unitIndex++;
            }

            return `${size.toFixed(1)} ${units[unitIndex]}`;
        }

        /**
         * 格式化大小
         */
        formatSize(bytes) {
            if (!bytes || bytes === 0) return '0 MB';

            const units = ['B', 'KB', 'MB', 'GB'];
            let size = bytes;
            let unitIndex = 0;

            while (size >= 1024 && unitIndex < units.length - 1) {
                size /= 1024;
                unitIndex++;
            }

            return `${size.toFixed(1)} ${units[unitIndex]}`;
        }

        /**
         * 格式化時間
         */
        formatTime(seconds) {
            if (!seconds || seconds === Infinity || isNaN(seconds)) return '計算中...';
            if (seconds < 1) return '即將完成';

            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = Math.floor(seconds % 60);

            if (hours > 0) {
                return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            } else if (minutes > 0) {
                return `${minutes}:${String(secs).padStart(2, '0')}`;
            } else {
                return `${secs}秒`;
            }
        }

        /**
         * 清除所有上傳
         */
        clearAll() {
            this.uploads.forEach((_, uploadId) => {
                this.removeUpload(uploadId);
            });
        }
    }

    // ============================================
    // 上傳進度追蹤器
    // ============================================
    class UploadProgress {
        constructor(id, options) {
            this.id = id;
            this.title = options.title || '上傳中';
            this.filename = options.filename || '';
            this.isBatch = options.isBatch || false;
            this.totalFiles = options.totalFiles || 1;

            this.startTime = Date.now();
            this.lastUpdateTime = this.startTime;
            this.lastLoaded = 0;
            this.speed = 0;
            this.remainingTime = 0;

            this.card = null;
            this.elements = {};
        }

        /**
         * 更新進度
         */
        update(progress) {
            const now = Date.now();
            const elapsed = (now - this.lastUpdateTime) / 1000; // 秒

            if (elapsed > 0) {
                const loaded = progress.loaded || 0;
                const total = progress.total || 0;
                const delta = loaded - this.lastLoaded;

                // 計算速度（字節/秒）
                this.speed = delta / elapsed;

                // 計算剩餘時間
                if (this.speed > 0 && total > loaded) {
                    this.remainingTime = (total - loaded) / this.speed;
                }

                this.lastLoaded = loaded;
                this.lastUpdateTime = now;
            }
        }

        /**
         * 完成
         */
        complete(result) {
            this.speed = 0;
            this.remainingTime = 0;
            console.log(`✅ [進度] ${this.id} 完成`, result);
        }

        /**
         * 失敗
         */
        fail(error) {
            this.speed = 0;
            this.remainingTime = 0;
            console.error(`❌ [進度] ${this.id} 失敗`, error);
        }
    }

    // ============================================
    // 導出
    // ============================================
    const progressManager = new AdvancedUploadProgress();

    global.AdvancedUploadProgress = progressManager;

    // 便捷函數
    global.startUploadProgress = function(options) {
        return progressManager.startUpload(options);
    };

    global.updateUploadProgress = function(uploadId, progress) {
        return progressManager.updateProgress(uploadId, progress);
    };

    global.completeUploadProgress = function(uploadId, result) {
        return progressManager.completeUpload(uploadId, result);
    };

    global.failUploadProgress = function(uploadId, error) {
        return progressManager.failUpload(uploadId, error);
    };

})(window);

