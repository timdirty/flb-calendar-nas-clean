// ============================================
// 🚀 智能上传管理器（多设备自适应）
// 版本：1.0.0 | 2025-11-08
// ============================================

(function(global) {
    'use strict';

    // ==================== 设备性能检测 ====================
    
    /**
     * 检测设备性能等级
     * @returns {Object} 设备配置信息
     */
    function detectDeviceProfile() {
        const profile = {
            cpuCores: navigator.hardwareConcurrency || 2,
            maxConcurrent: 3, // 默认值（已廢棄，使用 maxPhotoParallel/maxVideoParallel）
            maxPhotoParallel: 3,  // 🔥 新增：照片並行數
            maxVideoParallel: 1,  // 🔥 新增：影片並行數
            shouldCompress: false,
            compressionQuality: 0.8,
            deviceType: 'unknown',
            memoryLimit: 4096 * 1024 * 1024, // 默认 4GB
            isLIFF: false,
            uploadDelay: 150  // 🔥 新增：上傳延遲（毫秒）
        };

        // 1. 检测 LIFF 环境
        if (typeof liff !== 'undefined') {
            profile.isLIFF = true;
            profile.deviceType = 'liff-mobile';
            profile.maxPhotoParallel = 3;  // 🔥 手機 LIFF：照片3並行
            profile.maxVideoParallel = 1;  // 🔥 手機 LIFF：影片1並行
            profile.maxConcurrent = 1; // 向後兼容（已廢棄）
            profile.shouldCompress = false; // 手機不壓縮
            profile.uploadDelay = 150;
            console.log('📱 [LIFF] 手機優化模式：照片3並行，影片1並行，無壓縮');
            return profile;
        }

        // 2. 检测内存限制
        if (performance.memory && performance.memory.jsHeapSizeLimit) {
            profile.memoryLimit = performance.memory.jsHeapSizeLimit;
        }

        // 3. 根据 CPU 核心数和内存判断设备等级
        const memoryGB = profile.memoryLimit / (1024 * 1024 * 1024);
        
        // 🔥 检测是否为移动设备
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
        
        if (isMobile && !isTablet) {
            // 🔥 移動設備（手機）：照片3並行，影片1並行
            profile.deviceType = 'mobile';
            profile.maxPhotoParallel = 3;
            profile.maxVideoParallel = 1;
            profile.maxConcurrent = 1; // 向後兼容（已廢棄）
            profile.shouldCompress = false; // 手機不壓縮，避免CPU負擔
            profile.uploadDelay = 150;
            console.log('📱 [移動設備] 照片3並行，影片1並行，無壓縮');
        } else {
            // 🔥 桌面設備/平板：照片5並行，影片2並行
            profile.deviceType = 'desktop';
            profile.maxPhotoParallel = 5;
            profile.maxVideoParallel = 2;
            profile.maxConcurrent = 3; // 向後兼容（已廢棄）
            profile.shouldCompress = true;  // 桌面可壓縮
            profile.compressionQuality = 0.85;
            profile.uploadDelay = 100;
            console.log('💻 [桌面設備] 照片5並行，影片2並行，圖片壓縮');
        }

        console.log('🔍 [设备检测] 配置信息:', {
            类型: profile.deviceType,
            CPU核心: profile.cpuCores,
            内存: (memoryGB).toFixed(1) + 'GB',
            照片並行: profile.maxPhotoParallel,
            影片並行: profile.maxVideoParallel,
            前端压缩: profile.shouldCompress,
            上傳延遲: profile.uploadDelay + 'ms'
        });

        return profile;
    }

    // ==================== 内存监控 ====================

    /**
     * 获取当前可用内存（MB）
     * @returns {number} 可用内存（MB）
     */
    function getAvailableMemory() {
        if (!performance.memory) {
            return Infinity; // 如果无法检测，假设内存充足
        }
        const used = performance.memory.usedJSHeapSize;
        const limit = performance.memory.jsHeapSizeLimit;
        const available = (limit - used) / (1024 * 1024);
        return available;
    }

    /**
     * 检查内存压力等级
     * @returns {Object} { level: 'normal'|'medium'|'high'|'critical', available: number }
     */
    function checkMemoryPressure() {
        const available = getAvailableMemory();
        let level = 'normal';
        
        if (available < 100) {
            level = 'critical'; // 危急：< 100MB
        } else if (available < 200) {
            level = 'high'; // 高压：< 200MB
        } else if (available < 500) {
            level = 'medium'; // 中压：< 500MB
        }

        return { level, available };
    }

    // ==================== 图片压缩 ====================

    /**
     * 压缩图片文件
     * @param {File} file - 原始图片文件
     * @param {number} quality - 压缩质量 (0-1)
     * @param {number} maxWidth - 最大宽度
     * @returns {Promise<File>} 压缩后的文件
     */
    function compressImage(file, quality, maxWidth) {
        return new Promise((resolve, reject) => {
            // 不压缩非图片文件
            if (!file.type.startsWith('image/')) {
                resolve(file);
                return;
            }

            // HEIC 文件不压缩（浏览器无法处理）
            if (file.type === 'image/heic' || file.type === 'image/heif') {
                console.log('⚠️ [图片压缩] HEIC 格式跳过压缩:', file.name);
                resolve(file);
                return;
            }

            // 小于 500KB 的图片不压缩
            if (file.size < 500 * 1024) {
                console.log('✅ [图片压缩] 文件较小，跳过压缩:', file.name, (file.size / 1024).toFixed(0) + 'KB');
                resolve(file);
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = function() {
                    // 计算缩放尺寸
                    let width = img.width;
                    let height = img.height;
                    
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }

                    // 创建 Canvas
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // 转换为 Blob
                    canvas.toBlob(function(blob) {
                        if (!blob) {
                            reject(new Error('Canvas toBlob 失败'));
                            return;
                        }

                        // 创建新 File 对象
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });

                        const originalSize = (file.size / 1024).toFixed(0);
                        const compressedSize = (compressedFile.size / 1024).toFixed(0);
                        const ratio = ((1 - compressedFile.size / file.size) * 100).toFixed(0);

                        console.log('✅ [图片压缩] 成功:', file.name, {
                            原始: originalSize + 'KB',
                            压缩后: compressedSize + 'KB',
                            减少: ratio + '%'
                        });

                        resolve(compressedFile);
                    }, 'image/jpeg', quality);
                };
                img.onerror = function() {
                    console.warn('⚠️ [图片压缩] 加载失败，使用原图:', file.name);
                    resolve(file);
                };
                img.src = e.target.result;
            };
            reader.onerror = function() {
                console.warn('⚠️ [图片压缩] 读取失败，使用原图:', file.name);
                resolve(file);
            };
            reader.readAsDataURL(file);
        });
    }

    // ==================== 智能上传管理器 ====================

    class SmartUploadManager {
        constructor(options) {
            this.options = options || {};
            this.deviceProfile = detectDeviceProfile();
            this.uploadQueue = [];
            this.activeUploads = 0;
            this.uploadedFiles = new Set(); // 防止重复上传
            this.failedFiles = []; // 失败文件列表
            this.totalFiles = 0;
            this.completedFiles = 0;
            this.aborted = false;
            
            // 回调函数
            this.onProgress = options.onProgress || function() {};
            this.onFileProgress = options.onFileProgress || function() {};
            this.onComplete = options.onComplete || function() {};
            this.onError = options.onError || function() {};
            this.onMemoryWarning = options.onMemoryWarning || function() {};
        }

        /**
         * 批量上传文件
         * @param {Array} files - 文件数组
         * @param {Object} metadata - 元数据
         * @returns {Promise<Object>} 上传结果
         */
        async uploadBatch(files, metadata) {
            console.log('📤 [智能上传] 开始批量上传:', files.length, '个文件');
            
            this.totalFiles = files.length;
            this.completedFiles = 0;
            this.failedFiles = [];
            this.aborted = false;

            // 1. 内存检查
            const memoryStatus = checkMemoryPressure();
            console.log('🧠 [内存检查]:', {
                等级: memoryStatus.level,
                可用: memoryStatus.available.toFixed(0) + 'MB'
            });

            // 2. 根据内存压力动态调整并发数
            let maxConcurrent = this.deviceProfile.maxConcurrent;
            
            if (memoryStatus.level === 'critical') {
                console.warn('⚠️ [内存告警] 内存危急，暂停上传等待垃圾回收...');
                this.onMemoryWarning('critical', memoryStatus.available);
                
                // 强制垃圾回收（如果可用）
                if (window.gc) {
                    window.gc();
                    await this.sleep(2000); // 等待 2 秒
                }
                
                // 重新检查
                const newStatus = checkMemoryPressure();
                if (newStatus.level === 'critical') {
                    throw new Error('内存不足，无法继续上传');
                }
            }
            
            if (memoryStatus.level === 'high') {
                maxConcurrent = 1; // 强制单文件上传
                console.warn('⚠️ [内存告警] 内存紧张，降级为单文件上传');
                this.onMemoryWarning('high', memoryStatus.available);
            } else if (memoryStatus.level === 'medium') {
                maxConcurrent = Math.min(2, maxConcurrent); // 最多 2 个并发
                console.log('⚠️ [内存告警] 内存中等，限制并发数为 2');
            }

            // 3. 文件预处理（压缩 + 排序）
            const processedFiles = await this.preprocessFiles(files);

            // 4. 构建上传队列
            this.uploadQueue = processedFiles.map((file, index) => ({
                file: file,
                index: index,
                retries: 0,
                status: 'pending', // pending | uploading | success | failed
                progress: 0,
                metadata: metadata
            }));

            // 5. 开始并发上传
            const promises = [];
            for (let i = 0; i < maxConcurrent; i++) {
                promises.push(this.processQueue());
            }

            // 6. 等待所有上传完成
            await Promise.all(promises);

            // 7. 返回结果
            const result = {
                success: this.failedFiles.length === 0,
                total: this.totalFiles,
                completed: this.completedFiles,
                failed: this.failedFiles.length,
                failedFiles: this.failedFiles
            };

            console.log('✅ [智能上传] 批量上传完成:', result);
            this.onComplete(result);

            return result;
        }

        /**
         * 处理上传队列（工作线程）
         */
        async processQueue() {
            while (!this.aborted) {
                // 从队列中取出待上传的文件
                const task = this.uploadQueue.find(t => t.status === 'pending');
                if (!task) {
                    break; // 队列为空，退出
                }

                // 标记为上传中
                task.status = 'uploading';
                this.activeUploads++;

                try {
                    // 上传单个文件
                    await this.uploadSingleFile(task);
                    task.status = 'success';
                    this.completedFiles++;
                    
                    // 🔥 只在檢測到 418 錯誤或完成批次時延遲
                    // 正常情況下不延遲，充分利用網絡帶寬
                    
                } catch (err) {
                    console.error('❌ [智能上传] 文件上传失败:', task.file.name, err);
                    
                    // 🔥 如果是 418 错误（速率限制），延遲更久
                    if (err.message.includes('418')) {
                        console.warn('⚠️ [速率限制] 延遲 2 秒後重試...');
                        await this.sleep(2000);
                    }
                    
                    // 重试逻辑
                    if (task.retries < 3) {
                        task.retries++;
                        task.status = 'pending'; // 重新加入队列
                        console.log('🔄 [重試]', task.file.name, `(${task.retries}/3)`);
                        await this.sleep(1000 * task.retries); // 退避重试
                    } else {
                        task.status = 'failed';
                        this.failedFiles.push({
                            name: task.file.name,
                            error: err.message
                        });
                    }
                } finally {
                    this.activeUploads--;
                }

                // 更新总体进度
                const overallProgress = (this.completedFiles / this.totalFiles) * 100;
                this.onProgress(overallProgress, this.completedFiles, this.totalFiles);
            }
        }

        /**
         * 🔥 批次上傳（一次 HTTP 請求發送所有文件）
         * 這是推薦的上傳方式，可以充分利用後端並行上傳到 Drive 的能力
         * @param {Array} files - 文件數組
         * @param {Object} metadata - 元數據
         * @returns {Promise<Object>} 上傳結果
         */
        async uploadBatchSingleRequest(files, metadata) {
            // 🔥 允許沒有文件的情況（只有評語）
            if (files.length === 0) {
                console.log('📝 [批次上傳] 只有評語，沒有文件');
            } else {
                console.log('🚀 [批次上傳] 開始一次性上傳', files.length, '個文件');
            }
            
            try {
                const formData = new FormData();
                
                // 添加元數據
                Object.keys(metadata).forEach(key => {
                    formData.append(key, metadata[key]);
                });
                
                // 添加所有文件（一次性，如果有的話）
                files.forEach(file => {
                    // 🔥 正確處理課程總覽和學生記錄的檔案欄位名稱
                    let fieldName;
                    if (file.type.startsWith('video/')) {
                        // 影片：課程總覽使用 overviewVideos，學生記錄使用 videos
                        fieldName = metadata.isOverview ? 'overviewVideos' : 'videos';
                    } else {
                        // 照片：課程總覽使用 overviewPhotos，學生記錄使用 photos
                        fieldName = metadata.isOverview ? 'overviewPhotos' : 'photos';
                    }
                    formData.append(fieldName, file, file.name);
                });
                
                // 發送單一請求（使用 XMLHttpRequest 追蹤進度）
                return await new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    
                    // 上傳進度
                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable) {
                            const progress = (e.loaded / e.total) * 100;
                            console.log('📤 [批次上傳] 進度:', progress.toFixed(1) + '%');
                            
                            if (this.onProgress) {
                                this.onProgress(progress, 0, files.length, e.loaded, e.total);
                            }
                        }
                    });
                    
                    xhr.addEventListener('load', () => {
                        if (xhr.status === 200) {
                            try {
                                const response = JSON.parse(xhr.responseText);
                                if (response.success) {
                                    console.log('✅ [批次上傳] 上傳成功');
                                    resolve({
                                        success: true,
                                        total: files.length,
                                        completed: files.length,
                                        failed: 0,
                                        data: response.data
                                    });
                                } else {
                                    const errorMsg = response.error || '上傳失敗';
                                    console.error('❌ [批次上傳] 伺服器回應錯誤:', errorMsg);
                                    reject(new Error(errorMsg));
                                }
                            } catch (e) {
                                console.error('❌ [批次上傳] 解析響應失敗:', e, 'responseText:', xhr.responseText);
                                reject(new Error('解析響應失敗: ' + e.message));
                            }
                        } else {
                            // 🔥 嘗試解析錯誤響應
                            let errorMsg = 'HTTP ' + xhr.status;
                            try {
                                const errorResponse = JSON.parse(xhr.responseText);
                                if (errorResponse.error) {
                                    errorMsg = errorResponse.error;
                                }
                            } catch (e) {
                                // 如果無法解析，使用預設訊息
                            }
                            console.error('❌ [批次上傳] HTTP 錯誤:', xhr.status, errorMsg);
                            console.error('📋 [批次上傳] 請求元數據:', metadata);
                            reject(new Error(errorMsg));
                        }
                    });
                    
                    xhr.addEventListener('error', () => {
                        reject(new Error('網絡錯誤'));
                    });
                    
                    xhr.addEventListener('abort', () => {
                        reject(new Error('上傳已取消'));
                    });
                    
                    xhr.open('POST', '/api/learning-records/upload-drive', true);
                    xhr.send(formData);
                });
                
            } catch (error) {
                console.error('❌ [批次上傳] 失敗:', error);
                return {
                    success: false,
                    total: files.length,
                    completed: 0,
                    failed: files.length,
                    error: error.message
                };
            }
        }

        /**
         * 上传单个文件（逐个发送请求）
         * ⚠️ 已廢棄：建議使用 uploadBatchSingleRequest 以獲得更好的性能
         * @param {Object} task - 上传任务
         * @returns {Promise<void>}
         */
        async uploadSingleFile(task) {
            return new Promise((resolve, reject) => {
                const formData = new FormData();
                
                // 添加元数据
                Object.keys(task.metadata).forEach(key => {
                    formData.append(key, task.metadata[key]);
                });
                
                // 添加文件
                // 🔥 正確處理課程總覽和學生記錄的檔案欄位名稱
                let fieldName;
                if (task.file.type.startsWith('video/')) {
                    // 影片：課程總覽使用 overviewVideos，學生記錄使用 videos
                    fieldName = task.metadata.isOverview ? 'overviewVideos' : 'videos';
                } else {
                    // 照片：課程總覽使用 overviewPhotos，學生記錄使用 photos
                    fieldName = task.metadata.isOverview ? 'overviewPhotos' : 'photos';
                }
                formData.append(fieldName, task.file, task.file.name);

                // 使用 XMLHttpRequest 上传（支持进度追踪）
                const xhr = new XMLHttpRequest();

                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const progress = (e.loaded / e.total) * 100;
                        task.progress = progress;
                        
                        // 回调单文件进度
                        this.onFileProgress(task.index, task.file.name, progress, e.loaded, e.total);
                    }
                });

                xhr.addEventListener('load', () => {
                    if (xhr.status === 200) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            if (response.success) {
                                console.log('✅ [智能上传] 文件上传成功:', task.file.name);
                                resolve(response);
                            } else {
                                reject(new Error(response.error || '上传失败'));
                            }
                        } catch (e) {
                            reject(new Error('解析响应失败'));
                        }
                    } else {
                        reject(new Error('HTTP ' + xhr.status));
                    }
                });

                xhr.addEventListener('error', () => {
                    reject(new Error('网络错误'));
                });

                xhr.addEventListener('abort', () => {
                    reject(new Error('上传已取消'));
                });

                // 发送请求
                xhr.open('POST', '/api/learning-records/upload-drive', true);
                xhr.send(formData);
            });
        }

        /**
         * 文件预处理（压缩 + 排序）
         * @param {Array} files - 原始文件数组
         * @returns {Promise<Array>} 处理后的文件数组
         */
        async preprocessFiles(files) {
            console.log('🔧 [文件预处理] 开始处理', files.length, '个文件...');
            
            const processed = [];

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                let processedFile = file;
                
                // 🔥 只壓縮圖片，影片不處理（提升速度）
                if (this.deviceProfile.shouldCompress && file.type.startsWith('image/')) {
                    try {
                        processedFile = await compressImage(
                            file, 
                            this.deviceProfile.compressionQuality,
                            2048 // 最大宽度 2048px
                        );
                    } catch (err) {
                        console.warn('⚠️ [文件预处理] 压缩失败，使用原图:', file.name, err);
                        processedFile = file;
                    }
                } else if (file.type.startsWith('video/')) {
                    // 🔥 影片直接使用原檔，不壓縮（大幅提升速度）
                    console.log('🎥 [文件預處理] 影片不壓縮，直接上傳:', file.name);
                    processedFile = file;
                }

                processed.push(processedFile);

                // 每處理 5 個文件，檢查一次記憶體
                if ((i + 1) % 5 === 0) {
                    const memoryStatus = checkMemoryPressure();
                    if (memoryStatus.level === 'high' || memoryStatus.level === 'critical') {
                        console.warn('⚠️ [文件预处理] 内存压力高，暂停处理...');
                        await this.sleep(1000);
                        
                        // 如果還是高壓，停止壓縮
                        if (checkMemoryPressure().level !== 'normal') {
                            console.warn('⚠️ [文件预处理] 停止压缩，剩余文件使用原图');
                            this.deviceProfile.shouldCompress = false;
                        }
                    }
                }
            }

            // 按文件大小排序（小文件優先，提供快速反饋）
            processed.sort((a, b) => a.size - b.size);

            console.log('✅ [文件预处理] 处理完成');
            return processed;
        }

        /**
         * 中止所有上传
         */
        abort() {
            console.log('🛑 [智能上传] 中止所有上传');
            this.aborted = true;
        }

        /**
         * 延迟函数
         * @param {number} ms - 毫秒数
         * @returns {Promise<void>}
         */
        sleep(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
    }

    // ==================== 导出到全局 ====================

    if (!global.FLB) {
        global.FLB = {};
    }

    global.FLB.SmartUploadManager = SmartUploadManager;
    global.FLB.detectDeviceProfile = detectDeviceProfile;
    global.FLB.checkMemoryPressure = checkMemoryPressure;
    global.FLB.getAvailableMemory = getAvailableMemory;

    console.log('✅ [智能上传管理器] 模块已加载');

})(window);
