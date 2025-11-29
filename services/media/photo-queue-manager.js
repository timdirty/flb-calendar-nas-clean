/**
 * 照片处理队列管理器
 * 功能：异步处理照片（生成缩图、优化等），避免阻塞上传流程
 */

const photoProcessor = require('./photo-processor');
const fs = require('fs');
const path = require('path');

class PhotoQueueManager {
    constructor() {
        this.queue = [];
        this.processing = false;
        this.concurrency = 5; // 🔥 修復 2025-11-27：提升併發數以達到 Line 相簿體驗
        this.activeJobs = 0;
    }

    /**
     * 添加照片到处理队列
     * @param {Object} job - 处理任务
     * @returns {Promise<void>}
     */
    async addJob(job) {
        this.queue.push(job);
        console.log(`📸 照片处理任务已加入队列: ${job.originalName} (队列长度: ${this.queue.length})`);
        
        // 触发处理
        if (!this.processing) {
            this.processQueue();
        }
    }

    /**
     * 处理队列中的任务
     */
    async processQueue() {
        if (this.processing && this.activeJobs >= this.concurrency) {
            return;
        }

        this.processing = true;

        while (this.queue.length > 0 && this.activeJobs < this.concurrency) {
            const job = this.queue.shift();
            this.activeJobs++;
            
            // 异步处理任务
            this.processJob(job)
                .then(() => {
                    this.activeJobs--;
                    console.log(`✅ 照片处理完成: ${job.originalName} (剩余: ${this.queue.length})`);
                    
                    // 继续处理队列
                    if (this.queue.length > 0) {
                        this.processQueue();
                    } else if (this.activeJobs === 0) {
                        this.processing = false;
                        console.log('🎉 所有照片处理完成');
                    }
                })
                .catch((error) => {
                    this.activeJobs--;
                    console.error(`❌ 照片处理失败: ${job.originalName}`, error);
                    
                    // 继续处理其他任务
                    if (this.queue.length > 0) {
                        this.processQueue();
                    } else if (this.activeJobs === 0) {
                        this.processing = false;
                    }
                });
        }
    }

    /**
     * 处理单个任务
     * @param {Object} job - 处理任务
     */
    async processJob(job) {
        const {
            photoId,
            inputPath,
            outputDir,
            originalName,
            metaPath,
            onComplete,
            onError
        } = job;

        try {
            console.log(`🔧 开始处理照片: ${originalName}`);

            // 处理照片（生成缩图 + 可选优化）
            const result = await photoProcessor.processPhoto(
                inputPath,
                outputDir,
                photoId,
                {
                    originalName,
                    optimize: true,      // 启用优化
                    generateThumbs: true // 生成缩图
                }
            );

            if (result.status === 'ready') {
                // 更新元数据文件
                await this.updatePhotosMeta(metaPath, result);

                // 回调通知完成
                if (typeof onComplete === 'function') {
                    onComplete(result);
                }

                console.log(`✅ 照片处理成功: ${originalName}`, {
                    fileSize: `${(result.fileSize / 1024 / 1024).toFixed(2)} MB`,
                    thumbnails: Object.keys(result.thumbnails).length
                });
            } else {
                throw new Error(result.error || '处理失败');
            }

        } catch (error) {
            console.error(`❌ 照片处理异常: ${originalName}`, error);

            // 回调通知错误
            if (typeof onError === 'function') {
                onError(error);
            }

            throw error;
        }
    }

    /**
     * 更新 photos-meta.json（支援並行上傳的鎖定機制）
     * @param {string} metaPath - 元数据文件路径
     * @param {Object} photoMeta - 照片元数据
     */
    async updatePhotosMeta(metaPath, photoMeta) {
        const lockPath = `${metaPath}.lock`;
        const maxRetries = 10;
        const retryDelay = 50; // ms
        
        try {
            // 🔥 原子性創建鎖定檔案
            let lockAcquired = false;
            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    // 使用 'wx' 標誌原子性創建檔案，如果檔案存在會失敗
                    fs.writeFileSync(lockPath, process.pid.toString(), { flag: 'wx' });
                    lockAcquired = true;
                    console.log(`🔒 成功取得鎖定 (${attempt + 1}/${maxRetries})`);
                    break;
                } catch (e) {
                    if (e.code === 'EEXIST') {
                        // 檢查鎖定是否過期（超過 30 秒）
                        try {
                            const lockStat = fs.statSync(lockPath);
                            if (Date.now() - lockStat.mtime.getTime() > 30000) {
                                console.warn('⚠️ 鎖定檔案過期，強制移除:', lockPath);
                                fs.unlinkSync(lockPath);
                                // 嘗試重新創建
                                fs.writeFileSync(lockPath, process.pid.toString(), { flag: 'wx' });
                                lockAcquired = true;
                                break;
                            }
                            
                            // 檢查 PID 是否仍在運行（僅在 Unix 系統有效）
                            try {
                                const lockPid = parseInt(fs.readFileSync(lockPath, 'utf8'));
                                if (lockPid && process.platform !== 'win32') {
                                    process.kill(lockPid, 0); // 不會殺死進程，只是檢查是否存在
                                }
                            } catch (pidError) {
                                console.warn('⚠️ 鎖定進程不存在，移除鎖定:', lockPath);
                                fs.unlinkSync(lockPath);
                                // 嘗試重新創建
                                fs.writeFileSync(lockPath, process.pid.toString(), { flag: 'wx' });
                                lockAcquired = true;
                                break;
                            }
                        } catch (statError) {
                            // 無法讀取鎖定狀態，嘗試移除
                            try {
                                fs.unlinkSync(lockPath);
                            } catch (unlinkError) {
                                // 忽略移除失敗
                            }
                        }
                    } else {
                        throw e;
                    }
                }
                
                if (attempt === maxRetries - 1) {
                    throw new Error('無法取得檔案鎖定，請稍後再試');
                }
                
                console.log(`⏳ 等待鎖定釋放... (${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
            
            if (!lockAcquired) {
                throw new Error('無法取得檔案鎖定');
            }
            
            let photosList = [];

            // 读取现有元数据
            if (fs.existsSync(metaPath)) {
                try {
                    const content = fs.readFileSync(metaPath, 'utf8');
                    photosList = JSON.parse(content);
                    if (!Array.isArray(photosList)) {
                        photosList = [];
                    }
                } catch (e) {
                    console.warn('⚠️ 读取 photos-meta.json 失败，重新创建:', e.message);
                    photosList = [];
                }
            }

            // 检查是否已存在
            const existingIndex = photosList.findIndex(p => p.id === photoMeta.id);
            if (existingIndex >= 0) {
                // 更新现有记录
                photosList[existingIndex] = photoMeta;
            } else {
                // 添加新记录
                photosList.push(photoMeta);
            }

            // 写回文件
            fs.writeFileSync(metaPath, JSON.stringify(photosList, null, 2), 'utf8');
            console.log('✅ 照片元数据已更新:', metaPath);

        } catch (error) {
            console.error('❌ 更新 photos-meta.json 失败:', error);
            throw error;
        } finally {
            // 🔥 釋放鎖定
            try {
                if (fs.existsSync(lockPath)) {
                    fs.unlinkSync(lockPath);
                }
            } catch (e) {
                console.warn('⚠️ 釋放鎖定失敗:', e.message);
            }
        }
    }

    /**
     * 获取队列状态
     */
    getStatus() {
        return {
            queueLength: this.queue.length,
            processing: this.processing,
            activeJobs: this.activeJobs,
            concurrency: this.concurrency
        };
    }

    /**
     * 清空队列
     */
    clearQueue() {
        this.queue = [];
        console.log('🗑️ 照片处理队列已清空');
    }
}

// 单例模式
const photoQueueManager = new PhotoQueueManager();

module.exports = photoQueueManager;


