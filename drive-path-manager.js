/**
 * ============================================
 * Synology Drive 路徑管理模組
 * ============================================
 * 功能：管理 Drive 中的檔案路徑結構，與現有本地檔案系統結構保持一致
 * 版本：1.0.0
 * 日期：2025-11-08
 */

const path = require('path');
const { cleanCourseName } = require('./utils/course-name-cleaner');
const {
    deriveTopicFromCourseName: deriveTopicFromCourseNameHelper,
    sanitizeTopicForPath
} = require('./utils/course-topic-helper');

class DrivePathManager {
    constructor(config = {}) {
        // Drive 根目錄（從環境變數獲取）
        this.driveRoot = this._normalizeDriveRoot(
            config.driveRoot || process.env.SYNOLOGY_DRIVE_ROOT || '/Fun Learn Bar/FLB-Learning-Portfolio'
        );
        this.driveRootDepth = this.driveRoot.split('/').filter(Boolean).length;
        
        console.log('✅ [DrivePathManager] 路徑管理器已初始化, 根目錄:', this.driveRoot);
    }

    /**
     * ==================== 路徑構建 ====================
     */

    /**
     * 構建完整的 Drive 路徑
     * 
     * @param {Object} params - 路徑參數
     * @param {string} params.semester - 學期（例如：114-1）
     * @param {string} params.courseName - 課程名稱（例如：SPIKE 三 18:30-20:30 第8週）
     * @param {string} params.date - 日期（例如：2025-11-05）
     * @param {string} [params.topic] - 主題（可選，例如：四足獸）
     * @param {string} [params.studentName] - 學生名稱（可選，例如：蔡定言）
     * @param {string} [params.fileName] - 檔案名稱（可選）
     * @returns {string} 完整的 Drive 路徑
     */
    buildPath(params) {
        const { semester, courseName, date, topic, studentName, fileName } = params;

        // 驗證必要參數
        if (!semester) {
            throw new Error('buildPath: semester 參數為必填');
        }
        if (!courseName) {
            throw new Error('buildPath: courseName 參數為必填');
        }
        if (!date) {
            throw new Error('buildPath: date 參數為必填');
        }

        // 構建路徑元件（先移除週次再清理特殊字元）
        const cleanedCourseName = cleanCourseName ? cleanCourseName(courseName) : courseName;
        const sanitizedCourseName = this.sanitizeComponent(cleanedCourseName);
        const pathParts = [this.driveRoot, semester, sanitizedCourseName];

        // 日期 + 主題（缺少時改為統一推導）
        const resolvedTopic = this._resolveTopicForPath(topic, cleanedCourseName);
        const dateFolderSegment = resolvedTopic ? `${date} ${resolvedTopic}` : date;
        pathParts.push(dateFolderSegment.trim());

        // 學生名稱或課程總覽
        if (studentName) {
            const sanitizedStudentName = this.sanitizeComponent(studentName);
            pathParts.push(sanitizedStudentName);
        } else {
            pathParts.push('課程總覽');
        }

        // 檔案名稱（如果有）
        if (fileName) {
            const sanitizedFileName = this.sanitizeComponent(fileName);
            pathParts.push(sanitizedFileName);
        }

        // 使用 POSIX 路徑格式（Drive 使用 Linux 路徑）
        const fullPath = pathParts.join('/');

        console.log('🔨 [DrivePathManager] 構建路徑:', {
            semester,
            courseName,
            date,
            topic: resolvedTopic,
            studentName,
            fileName,
            result: fullPath
        });

        return fullPath;
    }

    /**
     * 構建學生記錄目錄路徑
     */
    buildStudentRecordPath(semester, courseName, date, topic, studentName) {
        return this.buildPath({
            semester,
            courseName,
            date,
            topic,
            studentName
        });
    }

    /**
     * 構建課程總覽目錄路徑
     */
    buildOverviewRecordPath(semester, courseName, date, topic) {
        return this.buildPath({
            semester,
            courseName,
            date,
            topic,
            studentName: null // 使用預設的「課程總覽」
        });
    }

    /**
     * 構建學期目錄路徑
     */
    buildSemesterPath(semester) {
        return path.posix.join(this.driveRoot, semester);
    }

    /**
     * 構建課程目錄路徑
     */
    buildCoursePath(semester, courseName) {
        return path.posix.join(this.driveRoot, semester, courseName);
    }

    /**
     * ==================== 路徑解析 ====================
     */

    /**
     * 解析 Drive 路徑為結構化資料
     * 
     * @param {string} fullPath - 完整的 Drive 路徑
     * @returns {Object} 解析後的路徑元件
     */
    parsePath(fullPath) {
        try {
            // 移除根目錄前綴
            let relativePath = fullPath;
            if (fullPath.startsWith(this.driveRoot)) {
                relativePath = fullPath.substring(this.driveRoot.length);
            }

            // 移除開頭的斜線
            if (relativePath.startsWith('/')) {
                relativePath = relativePath.substring(1);
            }

            // 分割路徑
            const parts = relativePath.split('/').filter(p => p.length > 0);

            if (parts.length < 3) {
                throw new Error('路徑格式不正確，至少需要: 學期/課程名稱/日期');
            }

            const parsed = {
                semester: parts[0],
                courseName: parts[1],
                dateOrDateTopic: parts[2],
                studentNameOrOverview: parts[3] || null,
                fileName: parts[4] || null
            };

            // 解析日期和主題
            const dateTopicMatch = parsed.dateOrDateTopic.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/);
            if (dateTopicMatch) {
                parsed.date = dateTopicMatch[1];
                parsed.topic = dateTopicMatch[2] || null;
            } else {
                parsed.date = parsed.dateOrDateTopic;
                parsed.topic = null;
            }

            // 判斷是學生還是課程總覽
            if (parsed.studentNameOrOverview === '課程總覽') {
                parsed.isOverview = true;
                parsed.studentName = null;
            } else {
                parsed.isOverview = false;
                parsed.studentName = parsed.studentNameOrOverview;
            }

            console.log('🔍 [DrivePathManager] 解析路徑:', {
                original: fullPath,
                relativePath: relativePath,
                parts: parts,
                'parts[3]': parts[3],
                'studentNameOrOverview': parsed.studentNameOrOverview,
                parsed: {
                    semester: parsed.semester,
                    courseName: parsed.courseName,
                    date: parsed.date,
                    topic: parsed.topic,
                    studentName: parsed.studentName,
                    isOverview: parsed.isOverview
                }
            });

            return parsed;
        } catch (error) {
            console.error('❌ [DrivePathManager] 路徑解析失敗:', error.message);
            throw new Error(`無法解析路徑: ${fullPath}`);
        }
    }

    /**
     * 嘗試從課程名稱推導主題（後端容錯用，避免只建立「日期」資料夾）
     * 規則與前端 extractCourseTopicForPath 接近，但更保守：
     * - 移除特殊標記 [停課][體驗][改時間][代課]
     * - 去掉講師後綴（- 老師名）
     * - 去掉課程類型前綴（SPIKE/EV3/MINECRAFT/SCRATCH/PYTHON/BOOST/ESM/SPM）
     * - 去掉「第N週」、星期+時段（例：三 1830-2030 或 三 18:30-20:30）
     * - 只保留 50 字以內，空白合併
     */
    deriveTopicFromCourseName(courseName) {
        try {
            let title = String(courseName || '').trim();
            if (!title) return '';

            // 🔥 [修復 2025-11-27] 移除所有開頭的中括號標記（包括連續多個）
            // 使用 while 循環確保移除所有連續的中括號
            while (/^\s*\[[^\]]*\]\s*/.test(title)) {
                title = title.replace(/^\s*\[[^\]]*\]\s*/, '');
            }

            // 去除講師名（- XXX），但確保不誤傷時間範圍
            // 只移除結尾的 "- XXX" 格式，且確保 XXX 不包含數字
            title = title.replace(/\s*[-－]\s*([^\d-－]+)$/, '');

            // 去除課程前綴
            title = title.replace(/^(SPIKE|SPM|ESM|BOOST|EV3|MINECRAFT|SCRATCH|PYTHON)\s+/i, '');

            // 去除星期+時段（含 18:30-20:30 或 1830-2030 等多種寫法）
            title = title
                // 三 18:30-20:30、三 1830-2030
                .replace(/[日一二三四五六]\s*\d{1,2}\s*:?\s*\d{2}\s*[-~–—]\s*\d{1,2}\s*:?\s*\d{2}/g, '')
                // 單獨時段（18:30-20:30、1830-2030）
                .replace(/\b\d{1,2}\s*:?\s*\d{2}\s*[-~–—]\s*\d{1,2}\s*:?\s*\d{2}\b/g, '')
                // 殘留的星期字
                .replace(/[日一二三四五六](?=\s|$)/g, '');

            // 去除「第N週」
            title = title.replace(/第\d+週/g, '');

            // 清理字元
            title = this.sanitizeComponent(title).replace(/\s+/g, '').substring(0, 50).trim();

            // 若仍像「時間段」或過短，視為無效主題
            if (!title || title.length < 2 || /^(\d{1,2}[-:–—]?\d{2})([-~–—](\d{1,2}[-:–—]?\d{2}))?$/.test(title)) {
                return '';
            }
            return title;
        } catch (e) {
            return '';
        }
    }

    /**
     * ==================== 路徑驗證 ====================
     */

    /**
     * 驗證路徑格式是否正確
     */
    validatePath(fullPath) {
        try {
            this.parsePath(fullPath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * 檢查路徑是否在 Drive 根目錄下
     */
    isInDriveRoot(fullPath) {
        return fullPath.startsWith(this.driveRoot);
    }

    toProxyUrl(fullPath) {
        if (!fullPath) return '';
        const normalized = String(fullPath).replace(/\\/g, '/');
        let relative = normalized;
        if (normalized.startsWith(this.driveRoot)) {
            relative = normalized.substring(this.driveRoot.length);
        }
        if (!relative.startsWith('/')) {
            relative = '/' + relative;
        }
        return encodeURI(('/api/drive-media' + relative).replace(/\/+/g, '/'));
    }

    /**
     * ==================== 路徑轉換 ====================
     */

    /**
     * 從本地檔案系統路徑轉換為 Drive 路徑
     * 
     * @param {string} localPath - 本地路徑（例如：data/learning-portfolio/114-1/...）
     * @returns {string} Drive 路徑
     */
    localToDrivePath(localPath) {
        // 移除 data/learning-portfolio 前綴
        const prefixes = ['data/learning-portfolio/', 'data/learning-portfolio', 'learning-portfolio/'];
        let cleanPath = localPath;
        
        for (const prefix of prefixes) {
            if (cleanPath.startsWith(prefix)) {
                cleanPath = cleanPath.substring(prefix.length);
                break;
            }
        }

        // 移除開頭的斜線
        if (cleanPath.startsWith('/')) {
            cleanPath = cleanPath.substring(1);
        }

        // 組合 Drive 根目錄
        const drivePath = path.posix.join(this.driveRoot, cleanPath);

        console.log('🔄 [DrivePathManager] 本地路徑轉 Drive 路徑:', {
            local: localPath,
            drive: drivePath
        });

        return drivePath;
    }

    /**
     * 從 Drive 路徑轉換為本地檔案系統路徑（用於相容性）
     * 
     * @param {string} drivePath - Drive 路徑
     * @returns {string} 本地路徑
     */
    driveToLocalPath(drivePath) {
        // 移除 Drive 根目錄前綴
        let relativePath = drivePath;
        if (drivePath.startsWith(this.driveRoot)) {
            relativePath = drivePath.substring(this.driveRoot.length);
        }

        // 移除開頭的斜線
        if (relativePath.startsWith('/')) {
            relativePath = relativePath.substring(1);
        }

        // 組合本地路徑
        const localPath = path.join('data', 'learning-portfolio', relativePath);

        console.log('🔄 [DrivePathManager] Drive 路徑轉本地路徑:', {
            drive: drivePath,
            local: localPath
        });

        return localPath;
    }

    /**
     * ==================== 元資料檔案路徑 ====================
     */

    /**
     * 獲取記錄元資料檔案路徑
     */
    getRecordMetaPath(basePath) {
        return path.posix.join(basePath, 'record-meta.json');
    }

    /**
     * 獲取媒體索引檔案路徑
     */
    getMediaIndexPath(basePath) {
        return path.posix.join(basePath, 'media-index.json');
    }

    /**
     * 獲取照片元資料檔案路徑
     */
    getPhotosMetaPath(basePath) {
        return path.posix.join(basePath, 'photos-meta.json');
    }

    /**
     * 獲取影片元資料檔案路徑
     */
    getVideosMetaPath(basePath) {
        return path.posix.join(basePath, 'videos-meta.json');
    }

    /**
     * 獲取評語檔案路徑
     */
    getCommentPath(basePath) {
        return path.posix.join(basePath, 'comment.txt');
    }

    /**
     * 獲取課程總覽檔案路徑
     */
    getOverviewPath(basePath) {
        return path.posix.join(basePath, 'overview.txt');
    }

    /**
     * ==================== 輔助函數 ====================
     */
    _normalizeDriveRoot(root) {
        let normalized = String(root || '').trim();
        if (!normalized) normalized = '/Fun Learn Bar/FLB-Learning-Portfolio';
        if (!normalized.startsWith('/')) {
            normalized = '/' + normalized;
        }
        return normalized.replace(/\/+$/, '');
    }

    /**
     * 清理單一路徑段（避免 Synology 不支援的字元）
     */
    sanitizeComponent(component) {
        if (component === undefined || component === null) {
            return '';
        }
        return String(component)
            .replace(/[<>:"|?*]/g, '')
            .replace(/[\\\/]/g, '-')
            .replace(/：/g, '-')
            .replace(/:/g, '-')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * 標準化檔案名稱（移除特殊字元）
     */
    sanitizeFileName(fileName) {
        // 移除或替換不安全的字元
        return this.sanitizeComponent(fileName);
    }

    /**
     * 生成唯一檔案名稱（避免衝突）
     */
    generateUniqueFileName(baseName, extension) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        const sanitized = this.sanitizeFileName(baseName);
        return `${sanitized}-${timestamp}-${random}${extension}`;
    }

    /**
     * 從完整路徑提取檔案名稱
     */
    getFileName(fullPath) {
        return path.basename(fullPath);
    }

    /**
     * 從完整路徑提取目錄路徑
     */
    getDirName(fullPath) {
        return path.dirname(fullPath);
    }

    /**
     * 獲取檔案副檔名
     */
    getExtension(fileName) {
        return path.extname(fileName).toLowerCase();
    }

    /**
     * 判斷是否為圖片檔案
     */
    isImageFile(fileName) {
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.heic', '.heif'];
        const ext = this.getExtension(fileName);
        return imageExtensions.includes(ext);
    }

    /**
     * 判斷是否為影片檔案
     */
    isVideoFile(fileName) {
        const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.flv', '.wmv', '.m4v'];
        const ext = this.getExtension(fileName);
        return videoExtensions.includes(ext);
    }

    /**
     * ==================== 路徑範例生成（用於測試） ====================
     */

    /**
     * 生成範例路徑（用於開發測試）
     */
    generateExamplePaths() {
        const examples = {
            semester: this.buildSemesterPath('114-1'),
            course: this.buildCoursePath('114-1', 'SPIKE 三 18:30-20:30 第8週'),
            studentRecord: this.buildStudentRecordPath(
                '114-1',
                'SPIKE 三 18:30-20:30 第8週',
                '2025-11-05',
                '四足獸',
                '蔡定言'
            ),
            overviewRecord: this.buildOverviewRecordPath(
                '114-1',
                'SPIKE 三 18:30-20:30 第8週',
                '2025-11-05',
                '四足獸'
            ),
            photoFile: this.buildPath({
                semester: '114-1',
                courseName: 'SPIKE 三 18:30-20:30 第8週',
                date: '2025-11-05',
                topic: '四足獸',
                studentName: '蔡定言',
                fileName: 'photo-1.jpg'
            }),
            videoFile: this.buildPath({
                semester: '114-1',
                courseName: 'SPIKE 三 18:30-20:30 第8週',
                date: '2025-11-05',
                topic: '四足獸',
                studentName: '蔡定言',
                fileName: 'video-1.mp4'
            }),
            metaFile: this.buildPath({
                semester: '114-1',
                courseName: 'SPIKE 三 18:30-20:30 第8週',
                date: '2025-11-05',
                topic: '四足獸',
                studentName: '蔡定言',
                fileName: 'record-meta.json'
            })
        };

        console.log('📋 [DrivePathManager] 範例路徑:', examples);
        return examples;
    }

    _resolveTopicForPath(explicitTopic = '', courseName = '') {
        const userTopic = sanitizeTopicForPath(explicitTopic);
        if (userTopic) {
            return userTopic;
        }
        const derivedShared = sanitizeTopicForPath(deriveTopicFromCourseNameHelper(courseName));
        if (derivedShared) {
            return derivedShared;
        }
        const legacyDerived = this.deriveTopicFromCourseName(courseName);
        if (legacyDerived) {
            return legacyDerived;
        }
        return '課程';
    }
}

module.exports = DrivePathManager;
