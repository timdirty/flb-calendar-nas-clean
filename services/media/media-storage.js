/**
 * 媒體儲存管理（統一版）
 * - 照片和影片使用相同的學習歷程目錄結構
 * - 路徑格式：/volume1/Fun Learn Bar/學習歷程 automatic/學期/課程-時段/日期/學生名/
 * - 所有媒體檔案（照片、影片、縮圖）都存放在同一目錄
 *
 * 📁 統一結構：
 *   <basePath>/
 *     114-1/                    # 學期
 *       Python-五-0810-0940/    # 課程-時段
 *         2024-11-03/           # 日期
 *           王小明/              # 學生名
 *             photo1.jpg        # 照片
 *             video1.mp4        # 原始影片
 *             video1.webm       # 轉碼影片
 *             video1.thumb.jpg  # 影片縮圖
 *             comment.txt       # 評語
 *           課程總覽/
 *             overview_video.mp4
 */

const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const { getCurrentSemester } = require('../../utils/semester-helper');
const { formatDateYYYYMMDD } = require('../../utils/date-formatter');
const safeFile = require('../../utils/safe-file-operations');

// 🗂️ 使用學習歷程統一目錄（支援開發與生產環境）
const MEDIA_ROOT = process.env.NODE_ENV === 'production'
    ? '/volume1/Fun Learn Bar/學習歷程 automatic'
    : path.join(__dirname, '..', '..', 'data', 'learning-portfolio');

const META_FILENAME = 'media-meta.json';

// ==================== 輔助函數 ====================

/**
 * 格式化日期為 YYYY-MM-DD
 * 🔥 使用統一的 date-formatter
 */
function formatDateKey(dateInput) {
    return formatDateYYYYMMDD(dateInput);
}

/**
 * 取得星期漢字
 */
function getWeekdayChar(dateInput) {
    try {
        const d = dateInput ? new Date(dateInput) : new Date();
        const weekdayChars = ['日', '一', '二', '三', '四', '五', '六'];
        return weekdayChars[d.getDay()] || '';
    } catch (e) {
        return '';
    }
}

/**
 * 安全檔名處理（保留中文，移除特殊字元）
 */
function safeSlug(input, fallback = 'unknown') {
    if (!input || typeof input !== 'string') {
        return fallback;
    }
    return input
        .replace(/[<>:"/\\|?*]/g, '')  // 移除檔案系統不允許的字元
        .trim() || fallback;
}

/**
 * 生成唯一 Hash（用於 bucketId）
 */
function hashForFileName(content) {
    return crypto.createHash('sha1').update(content).digest('hex').slice(0, 10);
}

/**
 * 確保目錄存在
 */
async function ensureDir(target) {
    await fs.mkdir(target, { recursive: true });
    return target;
}

/**
 * 正規化課程時段名稱（統一格式，避免資料夾分裂）
 * 例如：Python 0810-0940 → Python-五-0810-0940
 */
function normalizeCoursePeriod(courseName, period, dateInput) {
    try {
        const weekChar = getWeekdayChar(dateInput);
        const course = String(courseName || '').trim();
        
        // 正規化時段格式：移除空白、冒號，補齊為 4 位數
        const pad4 = (s) => String(s || '').padStart(4, '0');
        let periodStr = String(period || '').replace(/\s+/g, '').replace(/:/g, '');
        
        // 匹配時段格式：可能有或沒有星期字
        const match = periodStr.match(/^([日一二三四五六])?-?(\d{3,4})[-~–—]?(\d{3,4})$/);
        if (match) {
            const existingWeek = match[1];
            const start = pad4(match[2]);
            const end = pad4(match[3]);
            
            // 優先使用已有的星期字，否則使用日期計算的星期字
            const finalWeek = existingWeek || weekChar;
            return finalWeek ? `${course}-${finalWeek}-${start}-${end}` : `${course}-${start}-${end}`;
        }
        
        // 無法解析，直接拼接
        return weekChar ? `${course}-${weekChar}-${periodStr}` : `${course}-${periodStr}`;
    } catch (e) {
        console.error('❌ 正規化課程時段失敗:', e);
        return `${courseName}-${period}`;
    }
}

// ==================== 核心函數 ====================

/**
 * 解析儲存桶（Bucket）結構
 * 返回統一的學習歷程目錄路徑
 */
function resolveBucket(metadata = {}) {
    // 🔍 除錯：輸出傳入的 metadata
    console.log('📁 [resolveBucket] 收到 metadata:', {
        relativePath: metadata.relativePath || 'MISSING',
        isOverview: metadata.isOverview,
        mode: metadata.mode,
        date: metadata.date || metadata.dateKey,
        coursePeriod: metadata.coursePeriod,
        allKeys: Object.keys(metadata)
    });
    
    // 🔥 優先使用前端傳來的 relativePath（包含日期+主題）
    if (metadata.relativePath) {
        const normalized = path.normalize(metadata.relativePath).replace(/^([.]{2,})(\\|\/|$)/g, '');
        const baseDir = path.join(MEDIA_ROOT, normalized);
        const metaPath = path.join(baseDir, META_FILENAME);
        
        // 解析路徑以獲取各個部分
        const parts = normalized.split(path.sep).filter(Boolean);
        const semester = parts[0] || getCurrentSemester();
        const coursePeriod = parts[1] || '';
        const dateFolder = parts[2] || '';  // 包含主題，如 "2025-10-29 夾取機器人"
        const targetName = parts[3] || '課程總覽';
        
        // 提取純日期（用於 dateKey）
        const dateKey = dateFolder.match(/^\d{4}-\d{2}-\d{2}/)
            ? dateFolder.match(/^\d{4}-\d{2}-\d{2}/)[0]
            : formatDateKey(metadata.date || Date.now());
        
        const isOverview = metadata.isOverview || metadata.mode === 'overview' || targetName === '課程總覽';
        const bucketId = hashForFileName(`${semester}|${coursePeriod}|${dateFolder}|${targetName}`);
        
        console.log('📁 [resolveBucket] 使用前端 relativePath:', {
            relativePath: metadata.relativePath,
            baseDir,
            dateFolder,
            dateKey
        });
        
        return {
            bucketId,
            baseDir,
            originDir: baseDir,
            transcodedDir: baseDir,
            thumbsDir: baseDir,
            tempDir: path.join(baseDir, '.tmp'),
            metaPath,
            relativePath: normalized,
            relativeBase: normalized + '/',
            semester,
            coursePeriod,
            dateKey,
            studentName: targetName,
            isOverview,
            instructorName: metadata.instructorName || metadata.teacherName || ''
        };
    }
    
    // 📅 計算學期（備用邏輯）
    const semester = getCurrentSemester(metadata.date || metadata.dateKey || metadata.courseDate);
    
    // 📝 課程時段（統一格式）
    const coursePeriod = metadata.coursePeriod || 
                         normalizeCoursePeriod(
                             metadata.courseName || metadata.courseTitle || metadata.course || 'Course',
                             metadata.period || metadata.coursePeriod || '0000-0000',
                             metadata.date || metadata.dateKey
                         );
    
    // 📅 日期 YYYY-MM-DD
    const dateKey = metadata.dateKey || formatDateKey(metadata.date || metadata.courseDate || Date.now());
    
    // 👤 學生名稱（總覽模式用「課程總覽」）
    const isOverview = metadata.isOverview || metadata.mode === 'overview';
    const targetName = isOverview ? '課程總覽' : safeSlug(metadata.studentName || 'Student');
    
    // 🗂️ 組合完整路徑
    const baseDir = path.join(MEDIA_ROOT, semester, coursePeriod, dateKey, targetName);
    const metaPath = path.join(baseDir, META_FILENAME);
    
    // 📊 相對路徑（用於前端查詢）
    const relativePath = path.join(semester, coursePeriod, dateKey, targetName);
    
    // 🔑 生成唯一 Bucket ID
    const bucketId = hashForFileName(`${semester}|${coursePeriod}|${dateKey}|${targetName}`);
    
    return {
        bucketId,
        baseDir,              // 完整路徑（所有檔案都在這裡）
        originDir: baseDir,   // 原始檔案目錄（與 baseDir 相同）
        transcodedDir: baseDir, // 轉碼檔案目錄（與 baseDir 相同）
        thumbsDir: baseDir,   // 縮圖目錄（與 baseDir 相同）
        tempDir: path.join(baseDir, '.tmp'), // 臨時檔案目錄
        metaPath,
        relativePath,
        relativeBase: relativePath + '/',
        semester,
        coursePeriod,
        dateKey,
        studentName: targetName,
        isOverview,
        instructorName: metadata.instructorName || metadata.teacherName || ''
    };
}

/**
 * 確保儲存桶目錄存在
 */
async function ensureBucket(metadata) {
    const bucket = resolveBucket(metadata);
    
    // 確保主目錄和臨時目錄存在
    await ensureDir(bucket.baseDir);
    await ensureDir(bucket.tempDir);
    
    console.log('✅ 儲存桶已建立:', bucket.baseDir);
    return bucket;
}

/**
 * 讀取儲存桶元資料
 */
async function readBucketMeta(bucket) {
    return safeFile.readJSON(bucket.metaPath, {
        bucketId: bucket.bucketId,
        relativePath: bucket.relativePath,
        semester: bucket.semester,
        coursePeriod: bucket.coursePeriod,
        dateKey: bucket.dateKey,
        studentName: bucket.studentName,
        isOverview: bucket.isOverview,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        files: []
    });
}

/**
 * 寫入儲存桶元資料
 */
async function writeBucketMeta(bucket, updater) {
    return safeFile.atomicUpdate(
        bucket.metaPath,
        async (data) => {
            const base = Array.isArray(data) || typeof data !== 'object'
                ? {
                    bucketId: bucket.bucketId,
                    relativePath: bucket.relativePath,
                    semester: bucket.semester,
                    coursePeriod: bucket.coursePeriod,
                    dateKey: bucket.dateKey,
                    studentName: bucket.studentName,
                    isOverview: bucket.isOverview,
                    createdAt: Date.now(),
                    files: []
                }
                : data;

            const updated = await Promise.resolve(updater({
                ...base,
                bucketId: bucket.bucketId,
                relativePath: bucket.relativePath
            }));

            updated.updatedAt = Date.now();
            return updated;
        },
        {
            bucketId: bucket.bucketId,
            relativePath: bucket.relativePath,
            semester: bucket.semester,
            coursePeriod: bucket.coursePeriod,
            dateKey: bucket.dateKey,
            studentName: bucket.studentName,
            isOverview: bucket.isOverview,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            files: []
        }
    );
}

/**
 * 列出所有儲存桶
 */
async function listBuckets() {
    if (!fsSync.existsSync(MEDIA_ROOT)) {
        console.warn('⚠️ 媒體根目錄不存在:', MEDIA_ROOT);
        return [];
    }

    const results = [];

    async function scanDir(dir, depth = 0) {
        if (depth > 5) return; // 防止過深遞迴
        
        try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const entryPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    // 檢查是否有 media-meta.json（表示是儲存桶）
                    const metaPathCandidate = path.join(entryPath, META_FILENAME);
                    if (fsSync.existsSync(metaPathCandidate)) {
                        try {
                            const meta = await safeFile.readJSON(metaPathCandidate, null);
                            if (meta) {
                                results.push({
                                    ...meta,
                                    baseDir: entryPath
                                });
                            }
                        } catch (err) {
                            console.error('⚠️ 讀取桶狀態失敗:', metaPathCandidate, err.message);
                        }
                    } else {
                        // 繼續遞迴搜尋
                        await scanDir(entryPath, depth + 1);
                    }
                }
            }
        } catch (err) {
            console.error('⚠️ 掃描目錄失敗:', dir, err.message);
        }
    }

    await scanDir(MEDIA_ROOT);
    return results;
}

module.exports = {
    MEDIA_ROOT,
    resolveBucket,
    ensureBucket,
    readBucketMeta,
    writeBucketMeta,
    listBuckets,
    safeSlug,
    getCurrentSemester,
    formatDateKey,
    normalizeCoursePeriod
};
