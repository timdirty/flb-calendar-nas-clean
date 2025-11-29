/**
 * ============================================
 * 學習歷程上傳輔助模組（Drive API 版本）
 * ============================================
 * 功能：簡化學習歷程上傳到 Synology Drive 的邏輯
 * 版本：1.0.0
 * 日期：2025-11-08
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const SynologyDriveClient = require('./synology-drive-client');
const DrivePathManager = require('./drive-path-manager');
const learningRecordsIndex = require('./utils/learning-records-index');
const { formatDateYYYYMMDD } = require('./utils/date-formatter');
const { cleanCourseName, cleanCoursePeriod } = require('./utils/course-name-cleaner');
const {
    deriveTopicFromCourseName: deriveTopicFromCourseNameHelper,
    sanitizeTopicForPath
} = require('./utils/course-topic-helper');
const metadataTransformer = require('./utils/metadata-transformer');

const PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'bmp', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v', 'mpg', 'mpeg']);

function isGeneratedThumbnailName(name) {
    return /\.(thumb|preview)\.(jpe?g|png|webp)$/i.test(String(name || ''));
}
const COMMENT_HISTORY_MAX_ENTRIES = 20;

class LearningUploadHelper {
    // 🔥 新增 2025-11-27：元數據檔案更新鎖定機制
    constructor(driveClient, pathManager) {
        this.driveClient = driveClient;
        this.pathManager = pathManager;
        this.driveRootDepth = (this.pathManager.driveRoot || '').split('/').filter(Boolean).length;
        this.ffmpegBin = process.env.FFMPEG_PATH || 'ffmpeg';
        this.photoMetaLocks = new Map(); // 追蹤正在處理的元數據檔案
    }

    async _runFfmpeg(args) {
        return await new Promise((resolve) => {
            const proc = spawn(this.ffmpegBin, args, { stdio: ['ignore', 'ignore', 'ignore'] });
            let settled = false;
            proc.on('error', () => {
                if (!settled) {
                    settled = true;
                    resolve(false);
                }
            });
            proc.on('close', (code) => {
                if (!settled) {
                    settled = true;
                    resolve(code === 0);
                }
            });
        });
    }

    async _createTempFile(prefix, ext, buffer) {
        const dir = os.tmpdir();
        const name = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}${ext || ''}`;
        const fullPath = path.join(dir, name);
        await fs.promises.writeFile(fullPath, buffer);
        return fullPath;
    }

    async _generateAndUploadVideoThumbnail(basePath, fileName, buffer) {
        if (!buffer || !Buffer.isBuffer(buffer)) {
            return null;
        }

        let videoPath;
        let thumbPath;

        try {
            const ext = path.extname(fileName) || '.mp4';
            const base = path.basename(fileName, ext);
            const thumbName = `${base}.thumb.jpg`;
            const remoteThumbPath = path.posix.join(basePath, thumbName);

            videoPath = await this._createTempFile('learning-video', ext, buffer);
            thumbPath = path.join(os.tmpdir(), `${base}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}.thumb.jpg`);

            const args = [
                '-y',
                '-ss', '2',
                '-i', videoPath,
                '-vframes', '1',
                '-vf', 'scale=1280:-2',
                thumbPath,
            ];

            const ok = await this._runFfmpeg(args);
            if (!ok) {
                return null;
            }

            let stat;
            try {
                stat = await fs.promises.stat(thumbPath);
            } catch (_) {
                return null;
            }
            if (!stat || stat.size <= 1500) {
                return null;
            }

            const thumbBuffer = await fs.promises.readFile(thumbPath);
            await this.driveClient.uploadFile(thumbBuffer, remoteThumbPath, {
                contentType: 'image/jpeg',
                overwrite: true,
            });

            return thumbName;
        } catch (error) {
            console.warn('⚠️ [學習歷程] 產生影片縮圖失敗（略過）:', error.message);
            return null;
        } finally {
            try {
                if (videoPath && fs.existsSync(videoPath)) {
                    fs.unlinkSync(videoPath);
                }
            } catch (_) {}
            try {
                if (thumbPath && fs.existsSync(thumbPath)) {
                    fs.unlinkSync(thumbPath);
                }
            } catch (_) {}
        }
    }

    /**
     * ==================== 學生記錄上傳 ====================
     */

    /**
     * 上傳學生記錄（照片、影片、評語）
     */
    async uploadStudentRecord(params) {
        const {
            semester,
            courseName: rawCourseName,
            date,
            topic,
            studentName,
            photos = [],
            videos = [],
            comment = ''
        } = params;

        // 🔥 [修復 2025-11-26] 清理課程名稱（移除週次），確保索引 key 一致
        const courseName = cleanCourseName(rawCourseName);

        console.log('📤 [學習歷程] 上傳學生記錄:', {
            semester,
            courseName,
            rawCourseName,  // 記錄原始名稱供除錯
            date,
            studentName,
            photoCount: photos.length,
            videoCount: videos.length
        });

        // 驗證必要欄位
        if (!semester || !courseName || !date || !studentName) {
            throw new Error('缺少必要欄位: semester, courseName, date, studentName');
        }

        // 🔥 驗證門檻（調整為更靈活的規則）
        // 至少需要 1 張照片、1 個影片或評語
        const hasComment = comment && comment.trim().length > 0;
        if (photos.length === 0 && videos.length === 0 && !hasComment) {
            throw new Error('至少需要上傳 1 張照片、1 個影片或填寫評語');
        }

        // 🔥 評語驗證改為警告而非錯誤（允許稍後補充）
        // 如果沒有評語或評語太短，只記錄警告，不阻止上傳
        if (!comment || comment.trim().length < 20) {
            console.warn('⚠️ [學習歷程] 評語未填寫或字數不足 20 字，建議補充');
            // 不再拋出錯誤，允許上傳後再補充評語
        }

        // 構建 Drive 路徑
        const resolvedTopic = this._resolveTopicInput(topic, courseName);
        const basePath = this.pathManager.buildStudentRecordPath(
            semester,
            courseName,
            date,
            resolvedTopic,
            studentName
        );

        console.log('📁 [Drive 上傳] 目標路徑:', basePath);

        // 確保目錄存在
        await this.driveClient.ensureFolderExists(basePath);

        // 上傳結果
        const uploadResults = {
            photos: [],
            videos: [],
            comment: null,
            metadata: null
        };

        // 🔥 注意 2025-11-27：照片預處理目前無法使用
        // 原因：multer 使用 memoryStorage()，檔案只有 .buffer 沒有 .path
        // TODO：未來如需照片處理，需改用 diskStorage() 或支援從 buffer 處理
        let processedPhotos = photos;

        // 上傳照片
        if (processedPhotos.length > 0) {
            console.log('📸 [Drive 上傳] 上傳', processedPhotos.length, '張照片');
            
            for (let i = 0; i < processedPhotos.length; i++) {
                const photo = processedPhotos[i];
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 8);
                const ext = path.extname(photo.originalname || photo.name || '.jpg');
                const fileName = `${studentName}_photo_${i + 1}_${timestamp}_${random}${ext}`;
                const filePath = path.posix.join(basePath, fileName);
                
                try {
                    const result = await this.driveClient.uploadFile(photo.buffer, filePath, {
                        contentType: photo.mimetype || 'image/jpeg',
                        overwrite: false
                    });
                    
                    uploadResults.photos.push({
                        id: photo.id,
                        originalName: photo.originalname || photo.name,
                        drivePath: result.path,
                        proxyUrl: `/api/drive-media/${result.path.substring(1)}`,
                        size: photo.size || photo.buffer.length,
                        fileName: fileName,
                        mimeType: photo.mimetype || 'image/jpeg',
                        processedMetadata: photo.processedMetadata
                    });
                    
                    console.log(`✅ [Drive 上傳] 照片 ${i + 1}/${processedPhotos.length} 完成`);
                } catch (error) {
                    console.error(`❌ [Drive 上傳] 照片 ${i + 1} 失敗:`, error.message);
                    throw new Error(`照片上傳失敗: ${photo.originalname || photo.name}`);
                }
            }
        }

        // 上傳影片
        if (videos.length > 0) {
            console.log('🎥 [Drive 上傳] 上傳', videos.length, '個影片');
            
            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 8);
                const ext = path.extname(video.originalname || video.name || '.mp4');
                const fileName = `${studentName}_video_${i + 1}_${timestamp}_${random}${ext}`;
                const filePath = path.posix.join(basePath, fileName);
                
                try {
                    const result = await this.driveClient.uploadFile(video.buffer, filePath, {
                        contentType: video.mimetype || 'video/mp4',
                        overwrite: false
                    });

                    let thumbnailFilename = null;
                    try {
                        thumbnailFilename = await this._generateAndUploadVideoThumbnail(basePath, fileName, video.buffer);
                    } catch (_) {
                        thumbnailFilename = null;
                    }
                    
                    uploadResults.videos.push({
                        originalName: video.originalname || video.name,
                        drivePath: result.path,
                        proxyUrl: `/api/drive-media/${result.path.substring(1)}`,
                        size: video.size || video.buffer.length,
                        fileName: fileName,
                        mimeType: video.mimetype || 'video/mp4',
                        thumbnailFilename
                    });
                    
                    console.log(`✅ [Drive 上傳] 影片 ${i + 1}/${videos.length} 完成`);
                } catch (error) {
                    console.error(`❌ [Drive 上傳] 影片 ${i + 1} 失敗:`, error.message);
                    throw new Error(`影片上傳失敗: ${video.originalname || video.name}`);
                }
            }
        }

        // 🔥 上傳評語（如果有評語）
        if (comment && comment.trim().length > 0) {
            const commentPath = path.posix.join(basePath, 'comment.txt');
            const commentBuffer = Buffer.from(comment, 'utf-8');
            
            try {
                await this.driveClient.uploadFile(commentBuffer, commentPath, {
                    contentType: 'text/plain',
                    overwrite: true
                });
                
                uploadResults.comment = {
                    text: comment,
                    length: comment.length,
                    path: commentPath
                };
                
                console.log('✅ [Drive 上傳] 評語已儲存');
            } catch (error) {
                console.error('❌ [Drive 上傳] 評語儲存失敗:', error.message);
                throw new Error('評語儲存失敗');
            }
        } else {
            console.log('📝 [Drive 上傳] 沒有評語，跳過評語儲存');
        }

        // 🔥 上傳元資料（record-meta.json）
        const metadata = {
            semester,
            courseName,
            date,
            topic: resolvedTopic,
            studentName,
            uploadTime: new Date().toISOString(),
            comment: comment,
            photos: uploadResults.photos.map(p => ({
                fileName: p.fileName,
                size: p.size,
                proxyUrl: p.proxyUrl
            })),
            videos: uploadResults.videos.map(v => ({
                fileName: v.fileName,
                size: v.size,
                proxyUrl: v.proxyUrl
            })),
            totalPhotos: uploadResults.photos.length,
            totalVideos: uploadResults.videos.length,
            isOverview: false
        };

        const metaPath = this.pathManager.getRecordMetaPath(basePath);
        const metaBuffer = Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');
        
        console.log('📝 [Drive 上傳] 準備儲存 record-meta.json:', metaPath);
        
        try {
            await this.driveClient.uploadFile(metaBuffer, metaPath, {
                contentType: 'application/json',
                overwrite: true
            });
            
            uploadResults.metadata = metadata;
            uploadResults.metadataPath = metaPath;
            
            console.log('✅ [Drive 上傳] record-meta.json 已儲存');
        } catch (error) {
            // 🔥 [修復 2025-11-16] metadata 上傳失敗時記錄詳細錯誤，並標記警告
            console.error('❌ [Drive 上傳] record-meta.json 儲存失敗:', {
                metaPath,
                error: error.message,
                stack: error.stack
            });
            uploadResults.metadataError = error.message;
            uploadResults.metadataWarning = 'record-meta.json 儲存失敗，但照片/影片已成功上傳。建議稍後手動建立或重新上傳。';
            // 不拋出錯誤，允許流程繼續（照片/影片已成功上傳）
        }

        // 🔁 同步新媒體索引（建立 photos-meta.json / videos-meta.json）
        const mediaMetaResult = await this._syncMediaMeta(basePath, {
            photos: uploadResults.photos,
            videos: uploadResults.videos
        });

        if (mediaMetaResult.photos.length > 0) {
            uploadResults.newMediaPhotos = mediaMetaResult.photos;
        }
        if (mediaMetaResult.videos.length > 0) {
            uploadResults.newMediaVideos = mediaMetaResult.videos;
        }

        console.log('✅ [學習歷程] 學生記錄上傳完成:', {
            photos: uploadResults.photos.length,
            videos: uploadResults.videos.length,
            basePath
        });

        // 🔄 更新集中索引（學生）
        try {
            await learningRecordsIndex.updateStudentRecordSummary({
                semester,
                courseName,
                date,
                topic: resolvedTopic,
                studentName,
                photoCount: metadata.totalPhotos,
                videoCount: metadata.totalVideos,
                hasComment: !!comment && comment.trim().length > 0
            });
        } catch (indexError) {
            console.warn('⚠️ [LearningRecordsIndex] 更新學生索引失敗（略過）:', indexError.message);
        }

        return {
            success: true,
            basePath,
            ...uploadResults
        };
    }

    /**
     * ==================== 評語更新（供 V2 使用） ====================
     */

    /**
     * 更新現有學生記錄的評語
     *
     * 注意：
     * - 僅更新指定路徑下的 comment.txt 與 record-meta.json.comment
     * - 不會變更既有的照片/影片資料
     */
    async updateStudentComment(params = {}) {
        const {
            semester,
            courseName: rawCourseName,
            date,
            topic,
            studentName,
            comment = ''
        } = params;

        // 🔥 [修復 2025-11-26] 清理課程名稱（移除週次），確保索引 key 一致
        const courseName = cleanCourseName(rawCourseName);

        console.log('✏️  [學習歷程] 更新學生評語:', {
            semester,
            courseName,
            rawCourseName,  // 記錄原始名稱供除錯
            date,
            topic,
            studentName,
            hasComment: !!comment && String(comment).trim().length > 0
        });

        if (!semester || !courseName || !date || !studentName) {
            throw new Error('updateStudentComment: 缺少必要欄位 (semester, courseName, date, studentName)');
        }

        const resolvedTopic = this._resolveTopicInput(topic, courseName);
        const basePath = this.pathManager.buildStudentRecordPath(
            semester,
            courseName,
            date,
            resolvedTopic,
            studentName
        );

        let exists = false;
        try {
            exists = await this._directoryExists(basePath);
        } catch (error) {
            // Synology FileStation 408 或「不存在」錯誤，視為目錄尚未建立
            const msg = String(error && error.message || '');
            console.warn('⚠️ [學習歷程] 檢查目錄存在狀態失敗，將視為不存在:', {
                basePath,
                message: msg
            });
            if (!(msg.includes('408') || msg.includes('does not exist') || msg.includes('不存在'))) {
                // 其他錯誤仍然往外拋，避免誤掩蓋真正問題
                throw error;
            }
            exists = false;
        }

        if (!exists) {
            console.warn('⚠️ [學習歷程] 嘗試更新不存在的學生記錄目錄:', basePath);
            // 🔥 修正：如果目錄不存在，自動創建目錄結構
            console.log('🔧 [學習歷程] 自動創建學生記錄目錄:', basePath);
            await this._ensureDirectoryExists(basePath);
        }

        const commentPath = path.posix.join(basePath, 'comment.txt');

        // 0) 在覆寫之前，嘗試讀取舊評語以寫入 comment-history.json
        let previousComment = '';
        try {
            const commentFileExists = await this._fileExists(commentPath);
            if (commentFileExists) {
                const commentResponse = await this.driveClient.getFileStream(commentPath);
                const commentStream = this._ensureReadableStream(commentResponse, 'comment.txt');
                const commentText = await this._streamToString(commentStream);
                if (typeof commentText === 'string') {
                    previousComment = commentText.trim();
                }
            }
        } catch (error) {
            console.warn('⚠️ [學習歷程] 讀取舊評語以建立歷史紀錄失敗（略過，不中斷流程）:', {
                basePath,
                error: error.message
            });
        }

        const newCommentText = String(comment || '').trim();

        if (previousComment && previousComment !== newCommentText) {
            const historyPath = path.posix.join(basePath, 'comment-history.json');
            try {
                const history = await this._readOptionalJson(historyPath, {
                    label: 'comment-history.json',
                    fallback: []
                });

                const safeHistory = Array.isArray(history) ? history : [];
                safeHistory.push({
                    text: previousComment,
                    updatedAt: new Date().toISOString()
                });

                if (safeHistory.length > COMMENT_HISTORY_MAX_ENTRIES) {
                    safeHistory.splice(0, safeHistory.length - COMMENT_HISTORY_MAX_ENTRIES);
                }

                await this._uploadJson(historyPath, safeHistory, 'comment-history.json');
                console.log('✅ [學習歷程] 評語歷史已更新:', {
                    basePath,
                    historyCount: safeHistory.length
                });
            } catch (historyError) {
                console.warn('⚠️ [學習歷程] 更新 comment-history.json 失敗（略過，不影響主流程）:', {
                    basePath,
                    error: historyError.message
                });
            }
        }

        // 1) 更新 comment.txt
        try {
            const commentBuffer = Buffer.from(String(comment || ''), 'utf-8');

            await this.driveClient.uploadFile(commentBuffer, commentPath, {
                contentType: 'text/plain',
                overwrite: true
            });

            console.log('✅ [學習歷程] comment.txt 已更新:', {
                basePath,
                commentLength: commentBuffer.length
            });
        } catch (error) {
            console.error('❌ [學習歷程] 更新 comment.txt 失敗:', {
                basePath,
                error: error.message
            });
            throw new Error('評語檔案更新失敗');
        }

        // 2) 更新 record-meta.json 中的 comment 欄位（若存在）
        try {
            const metaPath = this.pathManager.getRecordMetaPath(basePath);
            const metadata = await this._readOptionalJson(metaPath, {
                label: 'record-meta.json',
                fallback: null
            });

            if (metadata) {
                metadata.comment = comment || '';
                await this._uploadJson(metaPath, metadata, 'record-meta.json');
                console.log('✅ [學習歷程] record-meta.json 評語已更新');
            } else {
                console.warn('⚠️ [學習歷程] 找不到 record-meta.json，僅更新 comment.txt:', metaPath);
            }
        } catch (error) {
            console.error('⚠️ [學習歷程] 更新 record-meta.json 評語失敗（略過，不影響 comment.txt）:', error.message);
        }

        // 更新集中索引中的評語狀態（不重新計算數量，優先速度）
        try {
            await learningRecordsIndex.updateStudentRecordSummary({
                semester,
                courseName,
                date,
                topic: resolvedTopic,
                studentName,
                hasComment: !!comment && String(comment).trim().length > 0
            });
        } catch (indexError) {
            console.warn('⚠️ [LearningRecordsIndex] 更新學生評語索引失敗（略過）:', indexError.message);
        }

        return {
            success: true,
            basePath,
            comment: comment || ''
        };
    }

    /**
     * ==================== 分片上傳整合 ====================
     */

    async uploadMediaFromLocalFile(params = {}) {
        const {
            localPath,
            originalName,
            mimeType = 'application/octet-stream',
            mediaCategory = 'auto', // 'photo' | 'video' | 'auto'
            semester,
            courseName,
            date,
            topic,
            studentName,
            isOverview = false
        } = params;

        if (!localPath) {
            throw new Error('uploadMediaFromLocalFile: localPath 未提供');
        }
        if (!semester || !courseName || !date) {
            throw new Error('uploadMediaFromLocalFile: 缺少必要欄位 (semester/courseName/date)');
        }

        // 使用 fs.promises.stat 來檢查檔案是否存在
        let stat;
        try {
            stat = await fs.promises.stat(localPath);
        } catch (error) {
            if (error.code === 'ENOENT') {
                throw new Error(`uploadMediaFromLocalFile: localPath 不存在: ${localPath}`);
            }
            throw error;
        }
        const resolvedTopic = this._resolveTopicInput(topic, courseName);
        const basePath = isOverview
            ? this.pathManager.buildOverviewRecordPath(semester, courseName, date, resolvedTopic)
            : this.pathManager.buildStudentRecordPath(semester, courseName, date, resolvedTopic, studentName);

        await this.driveClient.ensureFolderExists(basePath);

        const inferredIsPhoto = mediaCategory === 'photo' || (mediaCategory === 'auto' && /^image\//i.test(mimeType));
        const fileType = inferredIsPhoto ? 'photo' : 'video';
        const ext = path.extname(originalName || localPath) || (fileType === 'photo' ? '.jpg' : '.mp4');
        const baseName = path.basename(originalName || localPath, ext) || (fileType === 'photo' ? 'photo' : 'video');
        const sanitizedBase = this.pathManager.sanitizeComponent(baseName) || (fileType === 'photo' ? 'photo' : 'video');
        const fileName = this.pathManager.generateUniqueFileName(sanitizedBase, ext);
        const remotePath = path.posix.join(basePath, fileName);

        await this.driveClient.uploadFile(localPath, remotePath, {
            contentType: mimeType,
            overwrite: false
        });

        const proxyUrl = `/api/drive-media/${remotePath.replace(/^\/+/, '')}`;
        let thumbnailFilename = null;
        if (fileType === 'video') {
            try {
                const buffer = await fs.promises.readFile(localPath);
                thumbnailFilename = await this._generateAndUploadVideoThumbnail(basePath, fileName, buffer);
            } catch (_) {
                thumbnailFilename = null;
            }
        }

        const uploadsPayload = fileType === 'photo'
            ? { photos: [{
                    fileName,
                    originalName: originalName || baseName,
                    size: stat.size,
                    proxyUrl,
                    mimeType
                }], videos: [] }
            : { photos: [], videos: [{
                    fileName,
                    originalName: originalName || baseName,
                    size: stat.size,
                    proxyUrl,
                    mimeType,
                    thumbnailFilename
                }] };

        const metaResult = await this._syncMediaMeta(basePath, uploadsPayload);
        const mediaEntry = fileType === 'photo' ? (metaResult.photos[0] || null) : (metaResult.videos[0] || null);

        // 快速更新索引：僅標記有上傳，不重新計算總數
        try {
            if (isOverview) {
                await learningRecordsIndex.updateOverviewRecordSummary({
                    semester,
                    courseName,
                    date,
                    topic: resolvedTopic,
                    hasPhotos: fileType === 'photo' ? true : undefined,
                    hasVideos: fileType === 'video' ? true : undefined
                });
            } else if (studentName) {
                await learningRecordsIndex.updateStudentRecordSummary({
                    semester,
                    courseName,
                    date,
                    topic: resolvedTopic,
                    studentName
                });
            }
        } catch (indexError) {
            console.warn('⚠️ [LearningRecordsIndex] 單檔上傳索引更新失敗（略過）:', indexError.message);
        }

        return {
            success: true,
            basePath,
            remotePath,
            proxyUrl,
            fileName,
            mimeType,
            size: stat.size,
            type: fileType,
            mediaEntry
        };
    }

    /**
     * ==================== 課程總覽上傳 ====================
     */

    /**
     * 上傳課程總覽（照片、影片、摘要）
     */
    async uploadOverviewRecord(params) {
        const {
            semester,
            courseName: rawCourseName,
            date,
            topic,
            photos = [],
            videos = [],
            summary = ''
        } = params;

        // 🔥 [修復 2025-11-26] 清理課程名稱（移除週次），確保索引 key 一致
        const courseName = cleanCourseName(rawCourseName);

        console.log('📤 [學習歷程] 上傳課程總覽:', {
            semester,
            courseName,
            rawCourseName,  // 記錄原始名稱供除錯
            date,
            photoCount: photos.length,
            videoCount: videos.length
        });

        // 驗證必要欄位
        if (!semester || !courseName || !date) {
            throw new Error('缺少必要欄位: semester, courseName, date');
        }

        // 構建 Drive 路徑（若 topic 缺失，後端容錯：從 courseName 推導）
        const safeTopic = this._resolveTopicInput(topic, courseName);
        const basePath = this.pathManager.buildOverviewRecordPath(
            semester,
            courseName,
            date,
            safeTopic
        );

        console.log('📁 [Drive 上傳] 目標路徑:', basePath);

        // 確保目錄存在
        await this.driveClient.ensureFolderExists(basePath);

        // 上傳結果
        const uploadResults = {
            photos: [],
            videos: [],
            summary: null,
            metadata: null
        };

        // 上傳照片
        if (photos.length > 0) {
            console.log('📸 [Drive 上傳] 上傳', photos.length, '張課程總覽照片');
            
            for (let i = 0; i < photos.length; i++) {
                const photo = photos[i];
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 8);
                const ext = path.extname(photo.originalname || photo.name || '.jpg');
                const fileName = `overview_photo_${i + 1}_${timestamp}_${random}${ext}`;
                const filePath = path.posix.join(basePath, fileName);
                
                try {
                    const result = await this.driveClient.uploadFile(photo.buffer, filePath, {
                        contentType: photo.mimetype || 'image/jpeg',
                        overwrite: false
                    });
                    
                    uploadResults.photos.push({
                        originalName: photo.originalname || photo.name,
                        drivePath: result.path,
                        proxyUrl: `/api/drive-media/${result.path.substring(1)}`,  // 🔥 修复：添加缺失的斜杠
                        size: photo.size || photo.buffer.length,
                        fileName: fileName,
                        mimeType: photo.mimetype || 'image/jpeg'
                    });
                    
                    console.log(`✅ [Drive 上傳] 照片 ${i + 1}/${photos.length} 完成`);
                } catch (error) {
                    console.error(`❌ [Drive 上傳] 照片 ${i + 1} 失敗:`, error.message);
                    // 課程總覽照片失敗不中斷流程
                }
            }
        }

        // 上傳影片
        if (videos.length > 0) {
            console.log('🎥 [Drive 上傳] 上傳', videos.length, '個課程總覽影片');
            
            for (let i = 0; i < videos.length; i++) {
                const video = videos[i];
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 8);
                const ext = path.extname(video.originalname || video.name || '.mp4');
                const fileName = `overview_video_${i + 1}_${timestamp}_${random}${ext}`;
                const filePath = path.posix.join(basePath, fileName);
                
                try {
                    const result = await this.driveClient.uploadFile(video.buffer, filePath, {
                        contentType: video.mimetype || 'video/mp4',
                        overwrite: false
                    });

                    let thumbnailFilename = null;
                    try {
                        thumbnailFilename = await this._generateAndUploadVideoThumbnail(basePath, fileName, video.buffer);
                    } catch (_) {
                        thumbnailFilename = null;
                    }
                    
                    uploadResults.videos.push({
                        originalName: video.originalname || video.name,
                        drivePath: result.path,
                        proxyUrl: `/api/drive-media/${result.path.substring(1)}`,
                        size: video.size || video.buffer.length,
                        fileName: fileName,
                        mimeType: video.mimetype || 'video/mp4',
                        thumbnailFilename
                    });
                    
                    console.log(`✅ [Drive 上傳] 影片 ${i + 1}/${videos.length} 完成`);
                } catch (error) {
                    console.error(`❌ [Drive 上傳] 影片 ${i + 1} 失敗:`, error.message);
                    // 課程總覽影片失敗不中斷流程
                }
            }
        }

        // 🔁 同步課程總覽的媒體 meta
        const overviewMetaResult = await this._syncMediaMeta(basePath, {
            photos: uploadResults.photos,
            videos: uploadResults.videos
        });

        if (overviewMetaResult.photos.length > 0) {
            uploadResults.newMediaPhotos = overviewMetaResult.photos;
        }
        if (overviewMetaResult.videos.length > 0) {
            uploadResults.newMediaVideos = overviewMetaResult.videos;
        }

        // 上傳課程總覽摘要
        if (summary && summary.trim().length > 0) {
            const summaryPath = this.pathManager.getOverviewPath(basePath);
            const summaryBuffer = Buffer.from(summary, 'utf-8');
            
            try {
                await this.driveClient.uploadFile(summaryBuffer, summaryPath, {
                    contentType: 'text/plain',
                    overwrite: true
                });
                
                uploadResults.summary = {
                    text: summary,
                    length: summary.length,
                    path: summaryPath
                };
                
                console.log('✅ [Drive 上傳] 課程摘要已儲存');
            } catch (error) {
                console.error('❌ [Drive 上傳] 課程摘要儲存失敗:', error.message);
                // 摘要失敗不中斷流程
            }
        }

        // 上傳元資料
        const metadata = {
            semester,
            courseName,
            date,
            topic: safeTopic,
            isOverview: true,
            uploadTime: new Date().toISOString(),
            summary: summary || '',
            photos: uploadResults.photos.map(p => ({
                fileName: p.fileName,
                size: p.size,
                proxyUrl: p.proxyUrl
            })),
            videos: uploadResults.videos.map(v => ({
                fileName: v.fileName,
                size: v.size,
                proxyUrl: v.proxyUrl
            })),
            totalPhotos: uploadResults.photos.length,
            totalVideos: uploadResults.videos.length
        };

        const metaPath = this.pathManager.getRecordMetaPath(basePath);
        const metaBuffer = Buffer.from(JSON.stringify(metadata, null, 2), 'utf-8');
        
        try {
            await this.driveClient.uploadFile(metaBuffer, metaPath, {
                contentType: 'application/json',
                overwrite: true
            });
            
            uploadResults.metadata = metadata;
            
            console.log('✅ [Drive 上傳] 元資料已儲存');
        } catch (error) {
            console.error('❌ [Drive 上傳] 元資料儲存失敗:', error.message);
        }

        console.log('✅ [學習歷程] 課程總覽上傳完成:', {
            photos: uploadResults.photos.length,
            videos: uploadResults.videos.length,
            basePath
        });

        // 更新集中索引：課程總覽
        try {
            await learningRecordsIndex.updateOverviewRecordSummary({
                semester,
                courseName,
                date,
                topic: safeTopic,
                hasPhotos: uploadResults.photos.length > 0,
                hasVideos: uploadResults.videos.length > 0,
                hasSummary: !!summary && String(summary).trim().length > 0
            });
        } catch (indexError) {
            console.warn('⚠️ [LearningRecordsIndex] 更新課程總覽索引失敗（略過）:', indexError.message);
        }

        return {
            success: true,
            basePath,
            ...uploadResults
        };
    }

    /**
     * ==================== 路徑解析輔助 ====================
     */

    /**
     * 從前端參數解析學期、課程名稱、日期、主題
     */
    parseUploadParams(reqBody) {
        // 🔄 使用 MetadataTransformer 標準化參數
        const normalized = metadataTransformer.normalize(reqBody);
        
        // 清理課程名稱中的週次
        const cleanedCourseName = cleanCourseName(normalized.courseName);
        const resolvedTopic = this._resolveTopicInput(normalized.topic, cleanedCourseName);
        
        return {
            semester: normalized.semester,
            courseName: cleanedCourseName,
            date: normalized.date,
            topic: resolvedTopic,
            studentName: normalized.studentName,
            isOverview: normalized.isOverview,
            comment: normalized.comment,
            relativePath: normalized.relativePath
        };
    }

    _resolveTopicInput(rawTopic = '', courseName = '') {
        const userTopic = sanitizeTopicForPath(rawTopic);
        if (userTopic) {
            return userTopic;
        }
        const derived = sanitizeTopicForPath(deriveTopicFromCourseNameHelper(courseName));
        if (derived) {
            return derived;
        }
        return '課程';
    }

    /**
     * ==================== 歷史記錄查詢 ====================
     */

    /**
     * 列出指定條件的學習歷程記錄
     * @param {Object} params - 查詢參數
     * @param {string} params.semester - 學期（選填）
     * @param {string} params.courseName - 課程名稱（選填）
     * @param {string} params.date - 日期（選填）
     * @returns {Promise<Array>} 記錄列表
     */
    async listLearningRecords(params = {}) {
        const { semester, courseName, date } = params;
        
        console.log('🔍 [歷史記錄] 查詢參數:', { semester, courseName, date });
        
        // 🔥 清理 courseName 中的特殊字元（與 buildPath 保持一致）
        const sanitizedCourseName = courseName ? this.pathManager.sanitizeComponent(courseName) : courseName;
        const allowSemesterFallback = !courseName;
        
        const buildPathCandidates = (courseComponent) => {
            const candidates = [];
            if (semester && courseComponent && date) {
                candidates.push(`${this.pathManager.driveRoot}/${semester}/${courseComponent}/${date}`.replace(/\/+/g, '/'));
            }
            if (semester && courseComponent) {
                candidates.push(`${this.pathManager.driveRoot}/${semester}/${courseComponent}`.replace(/\/+/g, '/'));
            }
            return candidates;
        };
        
        const searchPathCandidates = [];
        const pushCandidate = (p, label) => {
            if (p && !searchPathCandidates.includes(p)) {
                searchPathCandidates.push(p);
                console.log(`📝 [診斷] 加入候選路徑 (${label || '未命名'}):`, p);
            }
        };
        
        // 優先使用清理後的課程名稱
        if (sanitizedCourseName) {
            buildPathCandidates(sanitizedCourseName).forEach(p => pushCandidate(p));
        }
        // 舊資料夾可能保留冒號，加入原始課程名稱作為候選
        if (courseName && sanitizedCourseName !== courseName) {
            buildPathCandidates(courseName).forEach(p => pushCandidate(p));
        }
        if (allowSemesterFallback) {
            if (semester) {
                pushCandidate(`${this.pathManager.driveRoot}/${semester}`.replace(/\/+/g, '/'));
            }
            pushCandidate(this.pathManager.driveRoot);
        }
        
        console.log('🔍 [診斷] 所有候選路徑:', searchPathCandidates);
        
        let searchPath = searchPathCandidates[0];
        const pathCheckResults = [];
        
        for (const candidate of searchPathCandidates) {
            const exists = await this._directoryExists(candidate);
            pathCheckResults.push({ path: candidate, exists });
            console.log(`🔍 [診斷] 檢查路徑: ${candidate} -> ${exists ? '✅ 存在' : '❌ 不存在'}`);
            
            if (exists) {
                searchPath = candidate;
                if (candidate !== searchPathCandidates[0]) {
                    console.log('🔀 [歷史記錄] 使用候選搜尋路徑:', candidate);
                }
                break;
            }
        }
        
        console.log('📊 [診斷] 路徑檢查結果摘要:', pathCheckResults);
        
        if (!searchPath) {
            console.warn('⚠️ [診斷] 所有候選路徑都不存在！');
            console.warn('⚠️ [診斷] 查詢參數:', { semester, courseName, date });
            console.warn('⚠️ [診斷] 清理後的課程名稱:', sanitizedCourseName);
            console.warn('⚠️ [診斷] 候選路徑列表:', searchPathCandidates);
            console.log('ℹ️ [歷史記錄] 目標課程資料夾不存在，直接返回空結果');
            return [];
        }
        
        console.log('🔍 [歷史記錄] 最終搜尋路徑:', searchPath);
        
        try {
            await this.driveClient.ensureAuthenticated();
            
            // 遞迴掃描所有學習記錄
            const records = await this._scanRecordsRecursive(searchPath, { semester, courseName, date });
            
            console.log('✅ [歷史記錄] 找到', records.length, '筆記錄');
            
            return records;
        } catch (error) {
            console.error('❌ [歷史記錄] 查詢失敗:', error.message);
            throw error;
        }
    }

    /**
     * 列出指定條件的學習歷程記錄（精準模式，供 V2 使用）
     *
     * 與 listLearningRecords 的差異：
     * - 僅根據 semester + courseName (+ date) 組合成少數幾個明確路徑
     * - 不再對 /<semester> 或根目錄做 fallback 掃描，避免大量 408 與噪音
     * - 其他遞迴掃描與 metadata 解析邏輯沿用 _scanRecordsRecursive
     *
     * @param {Object} params - 查詢參數
     * @param {string} params.semester - 學期（必填，用於 V2 視圖）
     * @param {string} params.courseName - 課程名稱（必填）
     * @param {string} params.date - 日期（選填，用於縮小範圍）
     * @returns {Promise<Array>} 記錄列表
     */
    async listLearningRecordsExact(params = {}) {
        const { semester, courseName, date } = params;

        console.log('🔍 [歷史記錄/精準] 查詢參數:', { semester, courseName, date });

        if (!semester || !courseName) {
            console.warn('⚠️ [歷史記錄/精準] 缺少必要欄位 semester 或 courseName，返回空結果');
            return [];
        }

        const sanitizedCourseName = this.pathManager.sanitizeComponent(courseName);

        const buildPathCandidates = (courseComponent) => {
            const candidates = [];
            if (semester && courseComponent && date) {
                candidates.push(`${this.pathManager.driveRoot}/${semester}/${courseComponent}/${date}`.replace(/\/+/g, '/'));
            }
            if (semester && courseComponent) {
                candidates.push(`${this.pathManager.driveRoot}/${semester}/${courseComponent}`.replace(/\/+/g, '/'));
            }
            return candidates;
        };

        const searchPathCandidates = [];
        const pushCandidate = (p, label) => {
            if (p && !searchPathCandidates.includes(p)) {
                searchPathCandidates.push(p);
                console.log(`📝 [診斷/精準] 加入候選路徑 (${label || '未命名'}):`, p);
            }
        };

        // 優先使用清理後的課程名稱
        if (sanitizedCourseName) {
            buildPathCandidates(sanitizedCourseName).forEach((p) => pushCandidate(p, 'sanitized'));
        }
        // 舊資料夾可能保留冒號，加入原始課程名稱作為候選
        if (courseName && sanitizedCourseName !== courseName) {
            buildPathCandidates(courseName).forEach((p) => pushCandidate(p, 'raw'));
        }

        console.log('🔍 [診斷/精準] 所有候選路徑:', searchPathCandidates);

        if (searchPathCandidates.length === 0) {
            console.warn('⚠️ [歷史記錄/精準] 無任何候選路徑，直接返回空結果');
            return [];
        }

        let searchPath = searchPathCandidates[0];
        const pathCheckResults = [];

        for (const candidate of searchPathCandidates) {
            const exists = await this._directoryExists(candidate);
            pathCheckResults.push({ path: candidate, exists });
            console.log(`🔍 [診斷/精準] 檢查路徑: ${candidate} -> ${exists ? '✅ 存在' : '❌ 不存在'}`);

            if (exists) {
                searchPath = candidate;
                if (candidate !== searchPathCandidates[0]) {
                    console.log('🔀 [歷史記錄/精準] 使用候選搜尋路徑:', candidate);
                }
                break;
            }
        }

        console.log('📊 [診斷/精準] 路徑檢查結果摘要:', pathCheckResults);

        if (!searchPath || !pathCheckResults.some((r) => r.exists)) {
            console.log('ℹ️ [歷史記錄/精準] 目標課程資料夾不存在，直接返回空結果');
            return [];
        }

        console.log('🔍 [歷史記錄/精準] 最終搜尋路徑:', searchPath);

        try {
            await this.driveClient.ensureAuthenticated();

            const records = await this._scanRecordsRecursive(searchPath, {
                semester,
                courseName,
                date,
            });

            console.log('✅ [歷史記錄/精準] 找到', records.length, '筆記錄');

            return records;
        } catch (error) {
            console.error('❌ [歷史記錄/精準] 查詢失敗:', error.message);
            throw error;
        }
    }

    /**
     * 遞迴掃描目錄，找出所有學習記錄
     * @private
     */
    async _scanRecordsRecursive(dirPath, filters = {}) {
        const records = [];
        
        try {
            const depthFromRoot = this._getDepthFromRoot(dirPath);
            const shouldCheckMetadata = depthFromRoot >= 4;
            if (shouldCheckMetadata) {
                // 🔥 首先檢查當前目錄本身是否為記錄目錄
                // 🔥 文件名為 record-meta.json（前端上傳時使用的命名）
                const currentMetadataPath = `${dirPath}/record-meta.json`.replace(/\/+/g, '/');
                const currentMetadataExists = await this._fileExists(currentMetadataPath);
                
                if (currentMetadataExists) {
                    // 當前目錄就是記錄目錄
                    try {
                        const metadata = await this._readMetadata(currentMetadataPath);
                        console.log('🔍 [歷史記錄] 讀取 metadata:', {
                            dirPath,
                            'metadata.studentName': metadata.studentName,
                            'metadata.isOverview': metadata.isOverview,
                            'metadata所有keys': Object.keys(metadata || {})
                        });
                        const record = await this._buildRecordFromMetadata(dirPath, metadata);
                        console.log('🔍 [歷史記錄] 構建後的記錄:', {
                            dirPath,
                            'record.studentName': record.studentName,
                            'record.isOverview': record.isOverview,
                            'record.photos數量': record.photos ? record.photos.length : 0,
                            'record.videos數量': record.videos ? record.videos.length : 0
                        });
                        records.push(record);
                        console.log('✅ [歷史記錄] 找到記錄:', dirPath);
                        return records; // 找到記錄後直接返回，不再遞歸
                    } catch (error) {
                        console.warn('⚠️ [歷史記錄] 讀取當前目錄 metadata 失敗:', currentMetadataPath, error.message);
                    }
                } else {
                    // 🔥 [修復 2025-11-16] 找不到 record-meta.json 時，嘗試從路徑和檔案推斷
                    // 🔴 [修復 2025-11-16-2] 僅依賴 photos-meta.json 存在來判斷，避免深度誤判
                    const photosMetaPath = `${dirPath}/photos-meta.json`.replace(/\/+/g, '/');
                    const hasPhotosMeta = await this._fileExists(photosMetaPath);
                    
                    if (hasPhotosMeta) {
                        // 確定是學習記錄目錄（有 photos-meta.json），嘗試從路徑推斷 metadata
                        try {
                            console.log('💡 [歷史記錄] 找不到 record-meta.json 但有 photos-meta.json，從路徑推斷:', dirPath);
                            const pathInfo = this.pathManager.parsePath(dirPath);
                            
                            // 🔥 驗證路徑解析結果是否合理
                            if (!pathInfo.studentName || pathInfo.studentName.trim().length === 0) {
                                console.warn('⚠️ [歷史記錄] 路徑解析失敗：無法推斷 studentName，跳過:', dirPath);
                                // 繼續掃描子目錄，不加入記錄
                            } else {
                                // 建立推斷的 metadata
                                const inferredMetadata = {
                                    semester: pathInfo.semester,
                                    courseName: pathInfo.courseName,
                                    date: pathInfo.date,
                                    topic: pathInfo.topic,
                                    studentName: pathInfo.studentName,
                                    isOverview: pathInfo.isOverview,
                                    uploadTime: new Date().toISOString(),
                                    comment: '',
                                    _inferred: true // 標記為推斷的 metadata
                                };
                                
                                console.log('🔍 [歷史記錄] 推斷 metadata:', {
                                    dirPath,
                                    depthFromRoot,
                                    'inferred.studentName': inferredMetadata.studentName,
                                    'inferred.isOverview': inferredMetadata.isOverview
                                });
                                
                                const record = await this._buildRecordFromMetadata(dirPath, inferredMetadata);
                                
                                // 只有在確實有照片或影片時才加入記錄
                                if (record.photos.length > 0 || record.videos.length > 0 || 
                                    record.newMediaPhotos.length > 0 || record.newMediaVideos.length > 0) {
                                    console.log('✅ [歷史記錄] 從路徑推斷記錄成功:', dirPath, '學生:', inferredMetadata.studentName);
                                    records.push(record);
                                    return records;
                                } else {
                                    console.log('⚠️ [歷史記錄] 推斷的記錄中沒有媒體檔案，跳過:', dirPath);
                                }
                            }
                        } catch (error) {
                            console.warn('⚠️ [歷史記錄] 從路徑推斷 metadata 失敗:', dirPath, error.message);
                        }
                    }
                }
            }
            
            // 如果當前目錄不是記錄目錄，則遞歸掃描子目錄
            const result = await this.driveClient.listFiles(dirPath);
            const files = result.files || [];
            
            for (const file of files) {
                const filePath = `${dirPath}/${file.name}`.replace(/\/+/g, '/');
                
                if (file.isdir) {
                    // 遞歸掃描子目錄
                    const subRecords = await this._scanRecordsRecursive(filePath, filters);
                    records.push(...subRecords);
                }
            }
        } catch (error) {
            if (error && error.code === 'DRIVE_PATH_UNAVAILABLE') {
                console.warn('⚠️ [歷史記錄] 目錄不可用，略過掃描:', dirPath);
            } else if (!error.message.includes('不存在')) {
                console.warn('⚠️ [歷史記錄] 掃描目錄失敗:', dirPath, error.message);
            }
        }
        
        return records;
    }

    /**
     * 檢查檔案是否存在
     * @private
     */
    async _fileExists(filePath) {
        try {
            await this.driveClient.getFileStream(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 檢查目錄是否存在
     * @private
     */
    async _directoryExists(dirPath) {
        try {
            const result = await this.driveClient.listFiles(dirPath);
            return Array.isArray(result.files);
        } catch (error) {
            const message = error?.message || '';
            if (error && error.code === 'DRIVE_PATH_UNAVAILABLE') {
                console.warn('⚠️ [歷史記錄] 目錄不可用（Synology 408）:', dirPath);
                return false;
            }
            if (message.includes('404') || message.includes('不存在')) {
                console.warn('⚠️ [歷史記錄] 目錄不存在:', dirPath);
                return false;
            }
            console.warn('⚠️ [歷史記錄] 無法確認目錄是否存在:', dirPath, message);
            return false;
        }
    }

    _getDepthFromRoot(fullPath) {
        const normalized = String(fullPath || '').split('/').filter(Boolean).length;
        return Math.max(0, normalized - (this.driveRootDepth || 0));
    }

    _generateMediaId(prefix) {
        try {
            return `${prefix || 'media'}-${crypto.randomUUID()}`;
        } catch (error) {
            return `${prefix || 'media'}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        }
    }

    async _uploadJson(filePath, data, label) {
        const buffer = Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
        await this.driveClient.uploadFile(buffer, filePath, {
            contentType: 'application/json',
            overwrite: true
        });
        console.log(`✅ [新媒體] ${label} 已更新:`, filePath);
    }

    // 🔥 新增 2025-11-27：帶鎖的元數據更新，防止並行覆蓋
    async _updateMetaWithLock(metaPath, updateFn) {
        // 如果該檔案正在被處理，等待前一個處理完成
        while (this.photoMetaLocks.has(metaPath)) {
            await this.photoMetaLocks.get(metaPath);
        }

        // 創建新的處理 Promise
        let resolvePromise;
        const lockPromise = new Promise(resolve => {
            resolvePromise = resolve;
        });
        this.photoMetaLocks.set(metaPath, lockPromise);

        try {
            // 執行實際的更新操作
            const result = await updateFn();
            return result;
        } finally {
            // 釋放鎖
            this.photoMetaLocks.delete(metaPath);
            resolvePromise();
        }
    }

    async _updateDriveMetaFile(basePath, type, uploads) {
        if (!Array.isArray(uploads) || uploads.length === 0) {
            return [];
        }

        const metaPath = type === 'photo'
            ? path.posix.join(basePath, 'photos-meta.json').replace(/\/+/g, '/')
            : path.posix.join(basePath, 'videos-meta.json').replace(/\/+/g, '/');
        const label = type === 'photo' ? 'photos-meta.json' : 'videos-meta.json';

        // 🔥 關鍵修復 2025-11-27：使用鎖定機制防止並行覆蓋
        return await this._updateMetaWithLock(metaPath, async () => {
            try {
                const existingList = await this._readOptionalJson(metaPath, { label, fallback: [] }) || [];
                const normalizedList = Array.isArray(existingList) ? existingList.slice() : [];
                const entryMap = new Map();
                normalizedList.forEach(entry => {
                    if (entry && entry.filename) {
                        entryMap.set(entry.filename, entry);
                    }
                });

                const createdEntries = [];
                const nowIso = new Date().toISOString();

                // 🔥 修復 2025-11-27：使用預處理的元數據，不再重複處理
                uploads.forEach(upload => {
                    if (!upload || !upload.fileName) {
                        return;
                    }

                    const filename = upload.fileName;
                    const existing = entryMap.get(filename) || {};
                    const id = upload.id || existing.id || this._generateMediaId(type === 'photo' ? 'photo' : 'video');
                    
                    let baseEntry = {
                        id,
                        filename,
                        originalName: upload.originalName || upload.name || existing.originalName || filename,
                        fileSize: upload.size || existing.fileSize || 0,
                        uploadedAt: existing.uploadedAt || nowIso,
                        status: existing.status || 'ready',
                        source: existing.source || 'drive',
                        proxyUrl: upload.proxyUrl || existing.proxyUrl || null
                    };

                    if (type === 'photo') {
                        // 🔥 關鍵修復：使用預處理的詳細元數據
                        if (upload.processedMetadata) {
                            baseEntry = {
                                ...baseEntry,
                                thumbnails: upload.processedMetadata.thumbnails || {},
                                exif: upload.processedMetadata.exif || {},
                                dimensions: upload.processedMetadata.dimensions || {},
                                processedAt: upload.processedMetadata.processedAt || nowIso,
                                processingVersion: upload.processedMetadata.version || '1.0'
                            };
                        } else {
                            baseEntry.thumbnails = existing.thumbnails || {};
                        }
                    } else {
                        baseEntry.thumbnailFilename = upload.thumbnailFilename || existing.thumbnailFilename || null;
                        baseEntry.transcodedFilename = existing.transcodedFilename || null;
                        baseEntry.mimeType = upload.mimeType || existing.mimeType || 'video/mp4';
                    }

                    entryMap.set(filename, baseEntry);
                    upload.id = id;
                    createdEntries.push(baseEntry);
                });

                const finalList = Array.from(entryMap.values());
                console.log(`🔒 [元數據鎖定] 準備更新 ${label}：現有 ${normalizedList.length} 筆 + 新增 ${createdEntries.length} 筆 = 總共 ${finalList.length} 筆`);
                await this._uploadJson(metaPath, finalList, label);
                return createdEntries;
            } catch (error) {
                console.warn(`⚠️ [新媒體] 無法更新 ${label}:`, error.message);
                return [];
            }
        });
    }

    async _syncMediaMeta(basePath, uploads = {}) {
        const result = { photos: [], videos: [] };

        result.photos = await this._updateDriveMetaFile(basePath, 'photo', uploads.photos);
        result.videos = await this._updateDriveMetaFile(basePath, 'video', uploads.videos);

        return result;
    }

    async _removeRecordMetadataEntry(recordPath, type, filename) {
        const metaPath = this.pathManager.getRecordMetaPath(recordPath);
        const metadata = await this._readOptionalJson(metaPath, { label: 'record-meta.json', fallback: null });
        if (!metadata) return false;
        const targetKey = type === 'video' ? 'videos' : 'photos';
        const totalKey = type === 'video' ? 'totalVideos' : 'totalPhotos';
        if (!Array.isArray(metadata[targetKey]) || metadata[targetKey].length === 0) {
            return false;
        }
        const beforeLength = metadata[targetKey].length;
        metadata[targetKey] = metadata[targetKey].filter(entry => {
            if (!entry) return true;
            if (typeof entry === 'string') return entry !== filename;
            const name = entry.fileName || entry.filename || entry.name;
            return name !== filename;
        });
        const changed = metadata[targetKey].length !== beforeLength;
        if (changed) {
            const updatedCount = metadata[targetKey].length;
            if (typeof metadata[totalKey] === 'number') {
                metadata[totalKey] = Math.max(0, updatedCount);
            }
            await this._uploadJson(metaPath, metadata, 'record-meta.json');
        }
        return changed;
    }

    async _removeMediaMetaEntry(recordPath, type, filename) {
        const metaPath = type === 'video'
            ? this.pathManager.getVideosMetaPath(recordPath)
            : this.pathManager.getPhotosMetaPath(recordPath);
        const label = type === 'video' ? 'videos-meta.json' : 'photos-meta.json';
        const entries = await this._readOptionalJson(metaPath, { label, fallback: [] });
        if (!Array.isArray(entries) || entries.length === 0) {
            return false;
        }
        const beforeLength = entries.length;
        const filtered = entries.filter(entry => {
            if (!entry) return true;
            const name = entry.filename || entry.fileName || entry.name;
            return name !== filename;
        });
        if (filtered.length === beforeLength) return false;
        await this._uploadJson(metaPath, filtered, label);
        return true;
    }

    async _removeMediaIndexEntry(recordPath, filename) {
        const mediaMetaPath = path.posix.join(recordPath, 'media-meta.json');
        const mediaMeta = await this._readOptionalJson(mediaMetaPath, { label: 'media-meta.json', fallback: null });
        if (!mediaMeta || !Array.isArray(mediaMeta.files)) {
            return false;
        }
        const beforeLength = mediaMeta.files.length;
        mediaMeta.files = mediaMeta.files.filter(entry => {
            if (!entry) return true;
            const name = entry.filename || entry.fileName || entry.name;
            return name !== filename;
        });
        if (mediaMeta.files.length === beforeLength) {
            return false;
        }
        await this._uploadJson(mediaMetaPath, mediaMeta, 'media-meta.json');
        return true;
    }

    /**
     * 讀取 metadata.json
     * @private
     */
    async _readMetadata(metadataPath) {
        const upstream = await this.driveClient.getFileStream(metadataPath);
        const stream = this._ensureReadableStream(upstream, 'metadata.json');
        return this._parseJsonStream(stream, 'metadata.json 格式錯誤');
    }

    async _readOptionalJson(filePath, { label = 'JSON', fallback = null } = {}) {
        if (!filePath) {
            return fallback;
        }

        try {
            const upstream = await this.driveClient.getFileStream(filePath);
            const stream = this._ensureReadableStream(upstream, label);
            return await this._parseJsonStream(stream, `${label} 格式錯誤`);
        } catch (error) {
            const message = error?.message || '';
            if (message.includes('404') || message.includes('不存在')) {
                console.log(`⚠️ [新媒體] ${label} 不存在，跳過:`, filePath);
                return fallback;
            }
            console.warn(`⚠️ [新媒體] 讀取 ${label} 失敗:`, { filePath, message });
            return fallback;
        }
    }

    async _parseJsonStream(stream, errorMessage) {
        const raw = await this._streamToString(stream);
        try {
            return JSON.parse(raw);
        } catch (error) {
            throw new Error(errorMessage);
        }
    }

    _ensureReadableStream(response, label = 'Drive stream') {
        const candidate = response ? (response.stream || response) : null;
        if (!candidate || typeof candidate.on !== 'function') {
            throw new Error(`${label} 不是合法的串流物件`);
        }
        return candidate;
    }

    _streamToString(stream) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            stream.on('data', chunk => {
                try {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                } catch (bufferError) {
                    reject(bufferError);
                }
            });
            stream.on('end', () => {
                try {
                    resolve(Buffer.concat(chunks).toString('utf8'));
                } catch (concatError) {
                    reject(concatError);
                }
            });
            stream.on('error', reject);
        });
    }

    /**
     * 從 metadata 建立記錄物件
     * @private
     */
    async _buildRecordFromMetadata(recordPath, metadata) {
        // 列出記錄目錄中的所有檔案
        const result = await this.driveClient.listFiles(recordPath);
        const files = result.files || [];
        const fileNameSet = new Set(
            files
                .filter(file => !file.isdir)
                .map(file => file.name)
        );
        
        console.log('🔍 [掃描記錄] 開始掃描目錄:', {
            recordPath,
            studentName: metadata.studentName,
            files總數: files.length,
            files列表: files.map(f => ({ name: f.name, isdir: f.isdir }))
        });
        
        // 分類檔案
        const photos = [];
        const videos = [];
        
        for (const file of files) {
            if (file.isdir) {
                console.log('⏭️ [掃描記錄] 跳過目錄:', file.name);
                continue;
            }
            if (file.name === 'record-meta.json' || file.name === 'metadata.json') {
                console.log('⏭️ [掃描記錄] 跳過 metadata 檔案:', file.name);
                continue;
            }
            
            const ext = (file.name.split('.').pop() || '').toLowerCase();
            const filePath = `${recordPath}/${file.name}`.replace(/\/+/g, '/');
            
            console.log('[掃描記錄] 處理檔案:', {
                name: file.name,
                ext: ext,
                isPhoto: ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext),
                isVideo: ['mp4', 'mov', 'avi', 'webm'].includes(ext)
            });
            
            const driveProxyUrl = this.pathManager.isInDriveRoot(filePath)
                ? this.pathManager.toProxyUrl(filePath)
                : null;

            if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
                if (isGeneratedThumbnailName(file.name)) {
                    console.log('⏭️ [掃描記錄] 跳過縮圖檔案:', file.name);
                    continue;
                }
                photos.push({
                    name: file.name,
                    path: filePath,
                    drivePath: filePath,
                    size: file.additional?.size || 0,
                    proxyUrl: driveProxyUrl
                });
                console.log('✅ [掃描記錄] 加入照片:', file.name);
            } else if (['mp4', 'mov', 'avi', 'webm'].includes(ext)) {
                videos.push({
                    name: file.name,
                    path: filePath,
                    drivePath: filePath,
                    size: file.additional?.size || 0,
                    proxyUrl: driveProxyUrl
                });
                console.log('✅ [掃描記錄] 加入影片:', file.name);
            } else {
                console.log('⏭️ [掃描記錄] 跳過未知類型檔案:', file.name, '副檔名:', ext);
            }
        }
        
        console.log('📊 [掃描記錄] 掃描結果:', {
            recordPath,
            studentName: metadata.studentName,
            photos數量: photos.length,
            videos數量: videos.length,
            photos列表: photos.map(p => p.name),
            videos列表: videos.map(v => v.name)
        });

        // 🔥 讀取新媒體系統的 meta 檔案
        const photosMetaPath = `${recordPath}/photos-meta.json`.replace(/\/+/g, '/');
        const videosMetaPath = `${recordPath}/videos-meta.json`.replace(/\/+/g, '/');
        const mediaMetaPath = `${recordPath}/media-meta.json`.replace(/\/+/g, '/');

        const photosMetaPromise = fileNameSet.has('photos-meta.json')
            ? this._readOptionalJson(photosMetaPath, { label: 'photos-meta.json', fallback: [] })
            : Promise.resolve([]);
        const videosMetaPromise = fileNameSet.has('videos-meta.json')
            ? this._readOptionalJson(videosMetaPath, { label: 'videos-meta.json', fallback: [] })
            : Promise.resolve([]);
        const mediaMetaPromise = fileNameSet.has('media-meta.json')
            ? this._readOptionalJson(mediaMetaPath, { label: 'media-meta.json', fallback: null })
            : Promise.resolve(null);

        const [photosMetaRaw, videosMetaRaw, mediaMetaRaw] = await Promise.all([
            photosMetaPromise,
            videosMetaPromise,
            mediaMetaPromise
        ]);

        const normalizePhotoEntry = (entry) => {
            if (!entry || !entry.id) return null;
            const filename = entry.filename || entry.fileName || '';
            if (!filename) {
                console.warn('⚠️ [新媒體] 照片缺少檔名，略過:', { recordPath, id: entry.id });
                return null;
            }
            return {
                ...entry,
                filename
            };
        };

        const normalizeVideoEntry = (entry) => {
            if (!entry || !entry.id) return null;
            const filename = entry.filename || entry.fileName || '';
            if (!filename) {
                console.warn('⚠️ [新媒體] 影片缺少檔名，略過:', { recordPath, id: entry.id });
                return null;
            }

            const thumbnailFilename = entry.thumbnailFilename || entry.thumbnail?.filename || null;
            const transcodedFilename = entry.transcodedFilename || entry.transcoded?.filename || null;
            const mimeType = String(entry.type || entry.mimeType || '');
            const isVideoType = mimeType.toLowerCase().startsWith('video/');
            const isVideoByExt = /\.(mp4|mov|avi|webm|mkv|m4v)$/i.test(filename);
            if (!isVideoType && !isVideoByExt) {
                return null;
            }

            return {
                ...entry,
                filename,
                originalName: entry.originalName || filename,
                thumbnailFilename,
                transcodedFilename
            };
        };

        let newMediaPhotos = Array.isArray(photosMetaRaw)
            ? photosMetaRaw.map(normalizePhotoEntry).filter(Boolean)
            : [];

        let newMediaVideos = [];
        let videoMetaSource = 'none';

        if (mediaMetaRaw && Array.isArray(mediaMetaRaw.files)) {
            newMediaVideos = mediaMetaRaw.files
                .map(normalizeVideoEntry)
                .filter(Boolean);
            if (newMediaVideos.length > 0) {
                videoMetaSource = 'media-meta.json';
            }
        }

        if (newMediaVideos.length === 0 && Array.isArray(videosMetaRaw)) {
            newMediaVideos = videosMetaRaw
                .map(normalizeVideoEntry)
                .filter(Boolean);
            if (newMediaVideos.length > 0) {
                videoMetaSource = 'videos-meta.json';
            }
        }

        const videoThumbnails = {};
        const collectThumbnail = (entry) => {
            if (!entry) return;
            const thumb = entry.thumbnailFilename || entry.thumbnail?.filename;
            if (!thumb) return;
            const mainName = entry.filename || entry.fileName;
            if (mainName) {
                videoThumbnails[mainName] = thumb;
            }
            const transcodedName = entry.transcodedFilename || entry.transcoded?.filename;
            if (transcodedName) {
                videoThumbnails[transcodedName] = thumb;
            }
        };
        newMediaVideos.forEach(collectThumbnail);
        if (Array.isArray(videosMetaRaw) && videosMetaRaw.length > 0) {
            videosMetaRaw.forEach(collectThumbnail);
        }

        const enhanceLegacyPhoto = (photo) => {
            if (!photo) return photo;
            if (!photo.proxyUrl && this.pathManager.isInDriveRoot(photo.path || '')) {
                photo.proxyUrl = this.pathManager.toProxyUrl(photo.path);
            }
            return photo;
        };

        const enhanceLegacyVideo = (video) => {
            if (!video) return video;
            if (!video.proxyUrl && this.pathManager.isInDriveRoot(video.path || '')) {
                video.proxyUrl = this.pathManager.toProxyUrl(video.path);
            }
            if (!video.drivePath && video.path) {
                video.drivePath = video.path;
            }
            const thumbName = videoThumbnails[video.name];
            if (thumbName && !video.thumbnailFilename) {
                video.thumbnailFilename = thumbName;
                const thumbPath = `${recordPath}/${thumbName}`.replace(/\/+/g, '/');
                if (this.pathManager.isInDriveRoot(thumbPath)) {
                    video.thumbnailProxyUrl = this.pathManager.toProxyUrl(thumbPath);
                }
            }
            return video;
        };

        photos.forEach(enhanceLegacyPhoto);
        videos.forEach(enhanceLegacyVideo);

        // 🔥 [修復 2025-11-19] 為新媒體系統補充 proxyUrl 和 drivePath
        const enhanceNewMediaPhoto = (photo) => {
            if (!photo || !photo.filename) return photo;
            const photoPath = `${recordPath}/${photo.filename}`.replace(/\/+/g, '/');
            
            if (!photo.drivePath) {
                photo.drivePath = photoPath;
            }
            
            if (!photo.proxyUrl && this.pathManager.isInDriveRoot(photoPath)) {
                photo.proxyUrl = this.pathManager.toProxyUrl(photoPath);
            }
            
            return photo;
        };

        const enhanceNewMediaVideo = (video) => {
            if (!video || !video.filename) return video;
            const videoPath = `${recordPath}/${video.filename}`.replace(/\/+/g, '/');
            
            if (!video.drivePath) {
                video.drivePath = videoPath;
            }
            
            if (!video.proxyUrl && this.pathManager.isInDriveRoot(videoPath)) {
                video.proxyUrl = this.pathManager.toProxyUrl(videoPath);
            }
            
            // 補充縮圖的 proxyUrl
            if (video.thumbnailFilename) {
                const thumbPath = `${recordPath}/${video.thumbnailFilename}`.replace(/\/+/g, '/');
                if (!video.thumbnailProxyUrl && this.pathManager.isInDriveRoot(thumbPath)) {
                    video.thumbnailProxyUrl = this.pathManager.toProxyUrl(thumbPath);
                }
            }
            
            // 補充轉碼檔的 proxyUrl
            if (video.transcodedFilename) {
                const transcodedPath = `${recordPath}/${video.transcodedFilename}`.replace(/\/+/g, '/');
                if (!video.transcodedProxyUrl && this.pathManager.isInDriveRoot(transcodedPath)) {
                    video.transcodedProxyUrl = this.pathManager.toProxyUrl(transcodedPath);
                }
            }
            
            return video;
        };

        newMediaPhotos.forEach(enhanceNewMediaPhoto);
        newMediaVideos.forEach(enhanceNewMediaVideo);

        console.log('🆕 [新媒體] 解析 meta 完成:', {
            recordPath,
            新媒體照片數: newMediaPhotos.length,
            新媒體影片數: newMediaVideos.length,
            影片來源: videoMetaSource,
            已補充proxyUrl: true
        });
        
        // 解析路徑獲取結構化資訊
        const pathInfo = this.pathManager.parsePath(recordPath);
        
        // 🔥 重要：確保 studentName 優先使用 metadata 中的值（上傳時保存的）
        // pathInfo 中的 studentName 可能來自路徑解析，但 metadata 中的更準確
        const finalStudentName = metadata.studentName || pathInfo.studentName || '';
        const finalIsOverview = metadata.isOverview !== undefined ? metadata.isOverview : (finalStudentName === '課程總覽');
        
        console.log('🔍 [構建記錄] 合併 metadata 和 pathInfo:', {
            recordPath,
            'metadata.studentName': metadata.studentName,
            'pathInfo.studentName': pathInfo.studentName,
            '最終studentName': finalStudentName,
            'metadata.isOverview': metadata.isOverview,
            '最終isOverview': finalIsOverview,
            photos數量: photos.length,
            videos數量: videos.length
        });
        
        let commentText = typeof metadata.comment === 'string' ? metadata.comment : '';
        if (!commentText && fileNameSet.has('comment.txt')) {
            const commentPath = `${recordPath}/comment.txt`.replace(/\/+/g, '/');
            try {
                const commentResponse = await this.driveClient.getFileStream(commentPath);
                const commentStream = this._ensureReadableStream(commentResponse, 'comment.txt');
                commentText = (await this._streamToString(commentStream)).trim();
            } catch (error) {
                console.warn('⚠️ [掃描記錄] 無法讀取 comment.txt，將略過:', { commentPath, message: error?.message });
            }
        }

        // 🔥 2025-11-12：課程總覽文字 overviewSummary（summary.txt）回填
        let overviewSummaryText = '';
        try {
            if (finalIsOverview && fileNameSet.has('summary.txt')) {
                const summaryPath = `${recordPath}/summary.txt`.replace(/\\+/g, '/');
                const summaryResponse = await this.driveClient.getFileStream(summaryPath);
                const summaryStream = this._ensureReadableStream(summaryResponse, 'summary.txt');
                overviewSummaryText = (await this._streamToString(summaryStream)).trim();
            }
        } catch (error) {
            console.warn('⚠️ [掃描記錄] 無法讀取 summary.txt，將略過:', { recordPath, message: error?.message });
        }

        // 🧑‍🏫 讀取講師名稱（instructor.txt），供歷史記錄顯示與比對
        let instructorNameText = typeof metadata.instructorName === 'string' ? metadata.instructorName : '';
        try {
            if (!instructorNameText && fileNameSet.has('instructor.txt')) {
                const instructorPath = `${recordPath}/instructor.txt`.replace(/\\+/g, '/');
                const instructorResponse = await this.driveClient.getFileStream(instructorPath);
                const instructorStream = this._ensureReadableStream(instructorResponse, 'instructor.txt');
                instructorNameText = (await this._streamToString(instructorStream)).trim();
            }
        } catch (error) {
            console.warn('⚠️ [掃描記錄] 無法讀取 instructor.txt，將略過:', { recordPath, message: error?.message });
        }

        // 🧑‍🏫 Fallback：若仍無講師，嘗試自 overviewSummaryText 解析（例如「講師姓名：TIM」）
        if (!instructorNameText && overviewSummaryText) {
            try {
                const m = overviewSummaryText.match(/(?:講師姓名|講師|老師)\s*[：: ]\s*([A-Za-z\u4E00-\u9FFF]+)\b/);
                if (m && m[1]) instructorNameText = m[1].trim();
            } catch (e) {}
        }

        return {
            ...metadata,
            ...pathInfo,
            studentName: finalStudentName,  // 🔥 確保使用正確的 studentName
            isOverview: finalIsOverview,     // 🔥 確保 isOverview 正確設置
            comment: commentText,
            overviewSummary: overviewSummaryText,
            instructorName: instructorNameText,
            recordPath,
            photos,
            videos,
            newMediaPhotos,
            newMediaVideos,
            videoThumbnails,
            photoCount: photos.length + newMediaPhotos.length,
            videoCount: videos.length + newMediaVideos.length
        };
    }

    /**
     * ==================== 記錄刪除 ====================
     */

    /**
     * 刪除學習記錄（刪除整個目錄）
     * @param {string} recordPath - 記錄路徑（例如：/FLB-Learning-Portfolio/114-1/課程名/2025-11-08/學生名）
     * @returns {Promise<Object>} 刪除結果
     */
    async deleteLearningRecord(recordPath) {
        console.log('🗑️  [刪除記錄] 開始刪除:', recordPath);
        
        try {
            await this.driveClient.ensureAuthenticated();
            
            // 驗證路徑是否在 Drive 根目錄內
            if (!this.pathManager.isInDriveRoot(recordPath)) {
                throw new Error('安全錯誤：只能刪除 Drive 根目錄內的檔案');
            }
            
            // 先列出目錄內容（用於日誌）
            let filesCount = 0;
            try {
                const result = await this.driveClient.listFiles(recordPath);
                // 🔥 修復：listFiles 返回 { files: [...] }，不是數組
                filesCount = result.files ? result.files.length : 0;
                console.log('🗑️  [刪除記錄] 目錄包含', filesCount, '個檔案');
            } catch (error) {
                console.warn('⚠️ [刪除記錄] 無法列出目錄內容:', error.message);
            }
            
            // 刪除整個目錄及其所有內容
            // 注意：需要先刪除所有子文件，然後刪除目錄本身
            try {
                const result = await this.driveClient.listFiles(recordPath);
                if (result.files && result.files.length > 0) {
                    // 先刪除所有文件
                    for (const file of result.files) {
                        const filePath = `${recordPath}/${file.name}`.replace(/\/+/g, '/');
                        try {
                            await this.driveClient.deleteFile(filePath);
                            console.log('✅ [刪除記錄] 已刪除文件:', file.name);
                        } catch (error) {
                            console.warn('⚠️ [刪除記錄] 刪除文件失敗:', file.name, error.message);
                        }
                    }
                }
                
                // 最後刪除空目錄
                await this.driveClient.deleteFile(recordPath);
            } catch (error) {
                // 如果先刪除文件的方式失敗，嘗試直接刪除目錄
                console.warn('⚠️ [刪除記錄] 批次刪除失敗，嘗試直接刪除目錄:', error.message);
                await this.driveClient.deleteFile(recordPath);
            }
            
            console.log('✅ [刪除記錄] 刪除成功:', recordPath);

            // 移除集中索引中的對應紀錄
            try {
                await learningRecordsIndex.removeRecordByDrivePath(recordPath);
            } catch (indexError) {
                console.warn('⚠️ [LearningRecordsIndex] 刪除索引紀錄失敗（略過）:', indexError.message);
            }

            return {
                success: true,
                recordPath,
                filesDeleted: filesCount
            };
            
        } catch (error) {
            console.error('❌ [刪除記錄] 刪除失敗:', error.message);
            throw error;
        }
    }

    /**
     * 批次刪除多個記錄
     * @param {Array<string>} recordPaths - 記錄路徑陣列
     * @returns {Promise<Object>} 刪除結果統計
     */
    async deleteLearningRecordsBatch(recordPaths) {
        console.log('🗑️  [批次刪除] 開始刪除', recordPaths.length, '筆記錄');
        
        const results = {
            success: [],
            failed: [],
            total: recordPaths.length
        };
        
        for (const recordPath of recordPaths) {
            try {
                await this.deleteLearningRecord(recordPath);
                results.success.push(recordPath);
            } catch (error) {
                console.error('❌ [批次刪除] 刪除失敗:', recordPath, error.message);
                results.failed.push({
                    recordPath,
                    error: error.message
                });
            }
        }
        
        console.log('✅ [批次刪除] 完成:', {
            total: results.total,
            success: results.success.length,
            failed: results.failed.length
        });
        
        return results;
    }

    /**
     * 刪除單個文件（照片或影片）
     * @param {string} recordPath - 記錄目錄路徑
     * @param {string} fileName - 文件名稱
     */
    async deleteSingleFile(recordPath, fileName) {
        try {
            console.log('🗑️  [單個文件刪除] 開始:', { recordPath, fileName });
            
            // 驗證路徑是否在 Drive 根目錄內
            if (!this.pathManager.isInDriveRoot(recordPath)) {
                throw new Error('安全錯誤：只能刪除 Drive 根目錄內的檔案');
            }
            
            // 構建完整文件路徑
            const filePath = path.posix.join(recordPath, fileName);
            
            // 刪除文件
            await this.driveClient.deleteFile(filePath);
            
            console.log('✅ [單個文件刪除] 刪除成功:', filePath);

            try {
                const ext = path.extname(fileName).toLowerCase().replace('.', '');
                const isPhoto = PHOTO_EXTENSIONS.has(ext);
                const isVideo = VIDEO_EXTENSIONS.has(ext);
                if (isPhoto || isVideo) {
                    const type = isVideo ? 'video' : 'photo';
                    await this._removeRecordMetadataEntry(recordPath, type, fileName);
                    await this._removeMediaMetaEntry(recordPath, type, fileName);
                    if (isVideo) {
                        await this._removeMediaIndexEntry(recordPath, fileName);
                        const base = path.basename(fileName, path.extname(fileName));
                        const thumbName = `${base}.thumb.jpg`;
                        if (isGeneratedThumbnailName(thumbName)) {
                            const thumbPath = path.posix.join(recordPath, thumbName);
                            try {
                                await this.driveClient.deleteFile(thumbPath);
                                console.log('✅ [單個文件刪除] 同步刪除縮圖:', thumbPath);
                            } catch (thumbError) {
                                const msg = String(thumbError && thumbError.message || '');
                                if (!msg.includes('does not exist') && !msg.includes('404')) {
                                    console.warn('⚠️ [單個文件刪除] 刪除縮圖失敗（略過）:', {
                                        thumbPath,
                                        message: msg
                                    });
                                }
                            }
                        }
                    }
                }
            } catch (metaError) {
                console.warn('⚠️ [單個文件刪除] 更新元資料失敗:', metaError.message);
            }
            
            return {
                success: true,
                filePath,
                fileName
            };
            
        } catch (error) {
            console.error('❌ [單個文件刪除] 刪除失敗:', error.message);
            throw error;
        }
    }

    /**
     * ==================== 輔助方法 ====================
     */

    /**
     * 確保目錄存在（若不存在則創建）
     * @param {string} dirPath - 目錄路徑
     * @returns {Promise<void>}
     */
    async _ensureDirectoryExists(dirPath) {
        try {
            // 嘗試列出目錄內容來檢查是否存在
            await this.driveClient.listFolder(dirPath);
        } catch (error) {
            const msg = String(error && error.message || '');
            // 408（列出資料夾失敗）或 does not exist / 404 一律視為「目錄尚未建立」，啟動自動建立流程
            if (msg.includes('does not exist') || msg.includes('404') || msg.includes('408')) {
                // 目錄不存在，需要創建
                console.log(`🔧 [學習歷程] 創建目錄: ${dirPath}`);
                
                // 創建一個臨時檔案來確保目錄被創建
                const tempPath = path.posix.join(dirPath, '.gitkeep');
                const tempBuffer = Buffer.from('', 'utf-8');
                
                try {
                    await this.driveClient.uploadFile(tempBuffer, tempPath, {
                        contentType: 'text/plain',
                        overwrite: true
                    });
                    console.log(`✅ [學習歷程] 目錄創建成功: ${dirPath}`);
                } catch (createError) {
                    console.error(`❌ [學習歷程] 目錄創建失敗: ${dirPath}`, createError.message);
                    throw new Error(`無法創建目錄: ${dirPath}`);
                }
            } else {
                // 其他錯誤
                throw error;
            }
        }
    }
}

module.exports = LearningUploadHelper;
