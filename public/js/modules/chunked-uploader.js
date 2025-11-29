/**
 * 🔁 分片上傳模組（2025-11-03 重構版）
 * - 支援 Synology Drive 分片端點 (/api/drive-upload/*)
 * - 具備斷點續傳、進度追蹤、Metadata 傳遞
 * - 與既有呼叫方式相容（onProgress/onChunkComplete）
 */

(function (global) {
    'use strict';

    const DRIVE_UPLOAD_BASE = '/api/drive-upload';
    const DRIVE_MEDIA_RECORD_BASE = '/api/drive-media/records';

    const DEFAULT_CHUNK_SIZE = 6 * 1024 * 1024; // 6MB
    const DEFAULT_CONCURRENCY = 3;
    const FALLBACK_THRESHOLD = 10 * 1024 * 1024; // 10MB 才使用分片

    let concurrency = DEFAULT_CONCURRENCY;

    /**
     * 🎬 根據檔案大小與記憶體狀況動態調整上傳參數
     * @param {number} fileSize - 檔案大小（bytes）
     * @param {string} memoryLevel - 記憶體狀況：'normal', 'medium', 'high', 'critical'
     * @returns {Object} { chunkSize, concurrency }
     */
    function getOptimalChunkConfig(fileSize, memoryLevel) {
        const sizeMB = fileSize / (1024 * 1024);
        
        let chunkSize = DEFAULT_CHUNK_SIZE; // 6MB
        let concurrencyCount = DEFAULT_CONCURRENCY; // 3
        
        // 🔥 根據檔案大小調整
        if (sizeMB < 1.0) {
            // 超小檔（<1MB）：切成至少 3-4 片，確保前端可見進度（每片 ≈ 64KB）
            chunkSize = Math.max(64 * 1024, Math.floor(fileSize / 4) || 64 * 1024);
            concurrencyCount = 1; // 低開銷、提高序列化的可見性
            console.log('🎬 [ChunkConfig] 超小檔案模式:', (chunkSize/1024).toFixed(0) + 'KB/片, 單線程');
        } else if (sizeMB >= 150) {
            // 大檔案：15MB 分片，單線程（減少網路往返，降低記憶體壓力）
            chunkSize = 15 * 1024 * 1024;
            concurrencyCount = 1;
            console.log('🎬 [ChunkConfig] 大檔案模式: 15MB 分片, 單線程上傳');
        } else if (sizeMB >= 50) {
            // 中檔案：10MB 分片，雙線程
            chunkSize = 10 * 1024 * 1024;
            concurrencyCount = 2;
            console.log('🎬 [ChunkConfig] 中檔案模式: 10MB 分片, 2 線程');
        } else {
            // 小檔案：6MB 分片，三線程
            console.log('🎬 [ChunkConfig] 小檔案模式: 6MB 分片, 3 線程');
        }
        
        // 🔥 根據記憶體狀況再次調整
        if (memoryLevel === 'critical') {
            concurrencyCount = 1;
            console.warn('⚠️ [ChunkConfig] 記憶體危急，強制單線程');
        } else if (memoryLevel === 'high') {
            concurrencyCount = Math.min(concurrencyCount, 1);
            console.warn('⚠️ [ChunkConfig] 記憶體緊張，降為單線程');
        } else if (memoryLevel === 'medium') {
            concurrencyCount = Math.min(concurrencyCount, 2);
            console.log('📊 [ChunkConfig] 記憶體中等，最多 2 線程');
        }
        
        return { chunkSize, concurrency: concurrencyCount };
    }

    /**
     * 🔍 檢查記憶體狀況
     */
    function checkMemoryStatus() {
        if (typeof window.SharedMediaUploader !== 'undefined' && 
            typeof window.SharedMediaUploader.checkMemoryPressure === 'function') {
            return window.SharedMediaUploader.checkMemoryPressure();
        }
        
        // 後備檢查
        if (performance && performance.memory) {
            const ratio = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
            if (ratio > 0.9) return { level: 'critical', ratio };
            if (ratio > 0.7) return { level: 'high', ratio };
            if (ratio > 0.5) return { level: 'medium', ratio };
        }
        
        return { level: 'normal', ratio: 0 };
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function toNumber(value, fallback = 0) {
        const num = Number(value);
        return Number.isFinite(num) && num >= 0 ? num : fallback;
    }

    function mergeOptions(base, overrides) {
        if (!overrides || typeof overrides !== 'object') {
            return { ...base };
        }
        return { ...base, ...overrides };
    }

    async function initSession({ filename, fileSize, fileType, chunkSize, metadata }) {
        const res = await fetch(`${DRIVE_UPLOAD_BASE}/init`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename,
                fileSize,
                fileType,
                chunkSize,
                metadata
            })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`初始化上傳失敗 (${res.status}): ${text}`);
        }

        const data = await res.json();
        if (!data.success) {
            throw new Error(data.message || '初始化上傳失敗');
        }

        return data;
    }

    async function sendChunk({ uploadId, chunkIndex, blob, onProgress }) {
        // 使用 XHR 以便取得上傳進度（fetch 無法追蹤 upload 進度）
        return await new Promise((resolve, reject) => {
            try {
                const xhr = new XMLHttpRequest();
                const formData = new FormData();
                formData.append('chunk', blob);
                formData.append('uploadId', uploadId);
                formData.append('chunkIndex', chunkIndex);

                // ⏱️ Fallback：某些瀏覽器（特別是 iOS WebView）不回報 upload.onprogress
                // 啟動一個定時器，若在期間內沒任何進度事件，就以時間推進模擬到 95%
                let anyProgress = false;
                let simulated = 0;
                const maxSimulated = Math.max(1, Math.floor(blob.size * 0.95));
                const tickBytes = Math.max(1, Math.floor(blob.size * 0.06)); // 每次約 6%
                let fallbackTimer = null;

                const ensureFallback = () => {
                    if (fallbackTimer) return;
                    fallbackTimer = setInterval(() => {
                        if (anyProgress) { clearInterval(fallbackTimer); fallbackTimer = null; return; }
                        simulated = Math.min(maxSimulated, simulated + tickBytes);
                        try { if (typeof onProgress === 'function') onProgress(simulated, blob.size); } catch(_){}
                    }, 220);
                };

                xhr.upload.onprogress = function (evt) {
                    if (!evt.lengthComputable) return;
                    anyProgress = true;
                    if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
                    try { if (typeof onProgress === 'function') onProgress(evt.loaded, evt.total); } catch (_) {}
                };

                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) return;
                    if (fallbackTimer) { clearInterval(fallbackTimer); fallbackTimer = null; }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        try {
                            const data = JSON.parse(xhr.responseText || '{}');
                            if (data && data.success) return resolve(data);
                            return reject(new Error((data && data.message) || '分片上傳失敗'));
                        } catch (e) {
                            return reject(new Error('分片回應解析失敗'));
                        }
                    } else {
                        return reject(new Error(`分片上傳失敗 (${xhr.status}): ${xhr.statusText || ''}`));
                    }
                };

                xhr.onerror = function () { reject(new Error('網路錯誤')); };
                xhr.open('POST', `${DRIVE_UPLOAD_BASE}/chunk`);
                // 先觸發 1% 起跳（避免長時間停留在 0%）
                try { if (typeof onProgress === 'function') onProgress(1, blob.size); } catch(_){}
                ensureFallback();
                xhr.send(formData);
            } catch (e) { reject(e); }
        });
    }

    async function completeSession(uploadId, metadata) {
        const res = await fetch(`${DRIVE_UPLOAD_BASE}/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uploadId,
                metadata
            })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`合併檔案失敗 (${res.status}): ${text}`);
        }

        const data = await res.json();
        if (!data.success) {
            throw new Error(data.message || '合併檔案失敗');
        }

        return data.record;
    }

    async function uploadFileChunked(file, onProgress, onChunkComplete, extraOptions) {
        if (!file) {
            throw new Error('缺少檔案');
        }

        let options = {};
        if (extraOptions && typeof extraOptions === 'object') {
            options = mergeOptions(options, extraOptions);
        }
        if (onProgress && typeof onProgress === 'object') {
            options = mergeOptions(options, onProgress);
            onProgress = options.onProgress || null;
        }

        // 🎬 檢查記憶體狀況並動態調整參數
        const memoryStatus = checkMemoryStatus();
        const optimalConfig = getOptimalChunkConfig(file.size, memoryStatus.level);
        
        // 使用動態計算的參數（除非用戶明確指定）
        const effectiveChunkSize = toNumber(options.chunkSize, optimalConfig.chunkSize);
        const effectiveConcurrency = toNumber(options.concurrency, optimalConfig.concurrency);
        const metadata = options.metadata || {};

        console.log('🚀 [ChunkedUploader] 開始分片上傳', {
            filename: file.name,
            sizeMB: (file.size / 1024 / 1024).toFixed(2),
            chunkSizeMB: (effectiveChunkSize / 1024 / 1024).toFixed(2),
            concurrency: effectiveConcurrency,
            memoryLevel: memoryStatus.level
        });

        const session = await initSession({
            filename: file.name,
            fileSize: file.size,
            fileType: file.type || 'application/octet-stream',
            chunkSize: effectiveChunkSize,
            metadata
        });

        const totalChunks = session.totalChunks || Math.ceil(file.size / effectiveChunkSize);
        const queue = [];

        let uploadedBytes = 0;
        let completedChunks = 0;

        const uploadChunk = async (index) => {
            const start = index * effectiveChunkSize;
            const end = Math.min(start + effectiveChunkSize, file.size);
            const blob = file.slice(start, end);

            const maxRetries = 3;
            let attempt = 0;
            while (attempt < maxRetries) {
                try {
                    const uploadedBefore = uploadedBytes;
                    await sendChunk({
                        uploadId: session.uploadId,
                        chunkIndex: index,
                        blob,
                        onProgress: (loaded, total) => {
                            // 以「已完成分片」 + 「當前分片上傳中的已傳位元組」推估整體進度
                            try {
                                const current = Math.min(total, Math.max(0, loaded));
                                const overall = uploadedBefore + current;
                                const percent = Math.round((overall / file.size) * 100);
                                if (typeof onProgress === 'function') onProgress(percent, overall, file.size);
                            } catch (_) {}
                        }
                    });

                    uploadedBytes += blob.size;
                    completedChunks++;

                    if (typeof onProgress === 'function') {
                        const percent = Math.round((uploadedBytes / file.size) * 100);
                        onProgress(percent, uploadedBytes, file.size);
                    }

                    if (typeof onChunkComplete === 'function') {
                        onChunkComplete(completedChunks, totalChunks);
                    }

                    return;
                } catch (error) {
                    attempt++;
                    console.warn(`⚠️ 分片 ${index} 上傳失敗 (第 ${attempt} 次重試):`, error.message);
                    if (attempt >= maxRetries) {
                        throw error;
                    }
                    await sleep(800 * attempt);
                }
            }
        };

        for (let i = 0; i < totalChunks; i++) {
            queue.push(i);
        }

        const workers = Array.from({ length: Math.min(effectiveConcurrency, totalChunks) }, async () => {
            while (queue.length) {
                const index = queue.shift();
                await uploadChunk(index);
            }
        });

        await Promise.all(workers);
        console.log('✅ [ChunkedUploader] 分片上傳完成，開始合併');

        const record = await completeSession(session.uploadId, metadata);
        console.log('🎉 [ChunkedUploader] 影片上傳成功', record);
        return record;
    }

    async function cancelUpload(uploadId) {
        try {
            const res = await fetch(`/api/learning-records/upload/${uploadId}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                console.warn('⚠️ 取消舊版上傳會話失敗:', res.status);
                return false;
            }
            return true;
        } catch (error) {
            console.error('❌ 取消上傳失敗:', error);
            return false;
        }
    }

    async function getUploadStatus(uploadId) {
        try {
            const res = await fetch(`${DRIVE_MEDIA_RECORD_BASE}/${encodeURIComponent(uploadId)}`);
            if (!res.ok) {
                return null;
            }
            const data = await res.json();
            return data.success ? data.record : null;
        } catch (error) {
            console.error('❌ 查詢上傳狀態失敗:', error);
            return null;
        }
    }

    function shouldUseChunkedUpload(file) {
        if (!file) return false;
        
        // 🔥 强制所有图片和视频使用新媒体API（不管文件大小）
        const isImage = /\.(jpg|jpeg|png|gif|webp|heic|heif)$/i.test(file.name || '');
        const isVideo = /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(file.name || '');
        
        if (isImage || isVideo) {
            return true; // 所有照片和影片都用新API
        }
        
        // 其他文件类型仍使用大小判断
        const threshold = toNumber(global.__CHUNK_UPLOAD_THRESHOLD || FALLBACK_THRESHOLD, FALLBACK_THRESHOLD);
        return file.size >= threshold;
    }

    function formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }

    function setConcurrency(count) {
        const next = toNumber(count, DEFAULT_CONCURRENCY);
        concurrency = Math.min(Math.max(1, next), 6);
    }

    function getConcurrency() {
        return concurrency;
    }

    global.ChunkedUploader = {
        uploadFileChunked,
        cancelUpload,
        getUploadStatus,
        shouldUseChunkedUpload,
        formatFileSize,
        setConcurrency,
        getConcurrency,
        CHUNK_SIZE: DEFAULT_CHUNK_SIZE,
        CONCURRENT_UPLOADS: DEFAULT_CONCURRENCY
    };

    console.log('✅ ChunkedUploader 模組已載入 (新版媒體 API)');

})(window);
