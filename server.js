const express = require('express');
const cors = require('cors');
const compression = require('compression');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { Worker } = require('worker_threads');
const courseNameCleaner = require('./utils/course-name-cleaner');
const semesterHelper = require('./utils/semester-helper');
const dateFormatter = require('./utils/date-formatter');
const metadataTransformer = require('./utils/metadata-transformer');
const { getCurrentSemester: getUnifiedSemester, isSemesterFormat } = semesterHelper;
const { formatDateYYYYMMDD, formatDateTWISO } = dateFormatter;
const schedule = require('node-schedule');
// 🔥 修復 2025-11-27：照片處理管道已整合到 learning-upload-helper.js 內部
// const { photoQueueManager } = require('./services/media/photo-queue-manager');
let XLSX = null;
try { XLSX = require('xlsx'); } catch (e) { console.warn('⚠️ xlsx 模組未安裝，Excel 匯出將不可用'); }
const multer = require('multer');

// 載入環境變數
require('dotenv').config({ path: '.env.nas' });

// 設定預設時區（如果未設定）
if (!process.env.TZ) {
    process.env.TZ = 'Asia/Taipei';
}

// 🚀 Synology Drive API 整合（2025-11-08）
const SynologyDriveClient = require('./synology-drive-client');
const DrivePathManager = require('./drive-path-manager');
const driveUploadQueue = require('./services/drive-upload-queue');
const useMockCalDav = process.env.MOCK_CALDAV === '1';
const SynologyCalendarClientClass = useMockCalDav
  ? require('./tests/mocks/mock-synology-calendar-client')
  : require('./synology-calendar-client');
const LearningUploadHelper = require('./learning-upload-helper');
const MediaSessionRegistry = require('./services/media/media-session-registry');
const driveMediaIndex = require('./services/drive-media-index');

// 🚀 效能優化模組（2025-11-01）
const safeFile = require('./utils/safe-file-operations');
const SmartCacheManager = require('./utils/smart-cache-manager');
const AttendanceBatcher = require('./utils/attendance-batcher');
const logger = require('./utils/logger');

// 載入提醒排程器
const ReminderScheduler = require('./reminder-scheduler');

// 載入通知管理器
const NotificationManager = require('./notification-manager');
const TeacherRegistry = require('./teacher-registry');
// ✅ 2025-11-11：媒體分片全面改用 /api/drive-upload/*，Legacy /api/media/videos/* 僅保留 410 提示

// 載入簽到隊列管理器
const AttendanceQueueManager = require('./attendance-queue-manager');
const StudentCourseHistoryLogger = require('./services/student-course-history-logger');

let CourseStudentMatcher = null;
let CourseTitleParser = null;
try {
    CourseStudentMatcher = require('./public/js/modules/course-student-matcher');
} catch (error) {
    console.warn('⚠️ 無法載入 CourseStudentMatcher:', error.message);
}
try {
    CourseTitleParser = require('./public/js/modules/course-title-parser');
} catch (error) {
    console.warn('⚠️ 無法載入 CourseTitleParser:', error.message);
}

function parseCourseTitleSafe(title) {
    if (!title || !CourseTitleParser || typeof CourseTitleParser.parse !== 'function') {
        return null;
    }
    try {
        return CourseTitleParser.parse(title);
    } catch (error) {
        console.warn('⚠️ CourseTitleParser 解析失敗:', error.message);
        return null;
    }
}

// 載入假日同步管理器
const HolidaySyncManager = require('./holiday-sync-manager');

// 🚀 Google Sheets API 終極方案
const FastAttendanceManager = require('./fast-attendance');
const fastAttendance = new FastAttendanceManager();
const studentCourseHistoryLogger = new StudentCourseHistoryLogger();

const SPECIAL_EVENT_REQUESTS_FILE = path.join(__dirname, 'data', 'special-event-requests.json');
const SPECIAL_EVENT_REQUESTS_DEFAULT = { pending: [], history: [] };
const SPECIAL_EVENT_HISTORY_LIMIT = 200;
ensureJsonFileInitialized(SPECIAL_EVENT_REQUESTS_FILE, SPECIAL_EVENT_REQUESTS_DEFAULT);

const NotionCourseSyncManager = require('./notion-course-sync-manager');
const notionCourseSyncManager = new NotionCourseSyncManager({
    configPath: path.join(__dirname, 'data/notion-course-sync-config.json'),
    mappingPath: path.join(__dirname, 'data/notion-course-sync-mappings.json'),
    coursePath: path.join(__dirname, 'data/notion-course-catalog.json'),
    logPath: path.join(__dirname, 'logs/notion-course-sync-log.json')
});
const TEMP_STUDENTS_ARCHIVE_PATH = path.join(__dirname, 'data', 'temporary-students-archive.json');
ensureJsonFileInitialized(TEMP_STUDENTS_ARCHIVE_PATH, { students: [] });

// 🚀 Google Sheets Students 模組（直接從 Sheets 讀取學生資料）
const GoogleSheetsStudents = require('./google-sheets-students');
const googleSheetsStudents = new GoogleSheetsStudents();

const DRIVE_PATH_LOG_DIR = path.join(__dirname, 'logs');
const DRIVE_PATH_MONITOR_FILE = path.join(DRIVE_PATH_LOG_DIR, 'drive-path-monitor.log');

try {
    if (!fs.existsSync(DRIVE_PATH_LOG_DIR)) {
        fs.mkdirSync(DRIVE_PATH_LOG_DIR, { recursive: true });
    }
} catch (logErr) {
    console.warn('⚠️ 無法建立 drive path log 資料夾:', logErr.message);
}

function logDrivePathDebug(entry = {}) {
    try {
        const payload = Object.assign({ timestamp: new Date().toISOString() }, entry);
        fs.appendFile(DRIVE_PATH_MONITOR_FILE, JSON.stringify(payload) + '\n', (err) => {
            if (err && process.env.NODE_ENV !== 'production') {
                console.warn('⚠️ 無法寫入 drive path log:', err.message);
            }
        });
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('⚠️ logDrivePathDebug 失敗:', err.message);
        }
    }
}

// 🚀 Google Sheets Admin 管理客製化操作
const GoogleSheetsClient = require('./google-sheets-client');
const adminStudentSheetClient = new GoogleSheetsClient();
let adminStudentSheetReady = false;

const VIDEO_EXT_REGEX = /\.(mp4|mov|avi|webm|m4v)$/i;
const IMAGE_EXT_REGEX = /\.(jpg|jpeg|png|heic|bmp|gif|webp)$/i;
let FFMPEG_BIN = process.env.FFMPEG_PATH || 'ffmpeg';
let ffmpegUnavailable = false;
const thumbnailFailureCache = new Set();
const thumbnailMetadataCache = new Map(); // key: videoPath -> { mtimeMs, thumbName }

function resolveFfmpegBinary(initialCandidate) {
    const candidates = [];
    if (initialCandidate) candidates.push(initialCandidate);
    candidates.push(
        '/usr/bin/ffmpeg',
        '/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        '/opt/bin/ffmpeg',
        '/var/packages/CodecPack/target/usr/bin/ffmpeg',
        '/volume1/@appstore/CodecPack/usr/bin/ffmpeg'
    );
    const visited = new Set();
    for (const candidate of candidates) {
        if (!candidate || visited.has(candidate)) continue;
        visited.add(candidate);
        try {
            if (!fs.existsSync(candidate)) continue;
            fs.accessSync(candidate, fs.constants.X_OK);
            const res = spawnSync(candidate, ['-version'], { stdio: 'ignore' });
            if (res && res.status === 0) {
                return candidate;
            }
        } catch (e) {
            continue;
        }
    }
    return initialCandidate || 'ffmpeg';
}

FFMPEG_BIN = resolveFfmpegBinary(FFMPEG_BIN);
try {
    console.log('🎞️ FFmpeg 執行檔:', FFMPEG_BIN);
} catch (e) {}

class AsyncQueue {
    constructor(concurrency) {
        this.concurrency = Math.max(1, Number(concurrency) || 1);
        this.queue = [];
        this.active = 0;
    }

    push(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this._next();
        });
    }

    setConcurrency(n) {
        this.concurrency = Math.max(1, Number(n) || 1);
        this._next();
    }

    _next() {
        if (this.active >= this.concurrency) return;
        const task = this.queue.shift();
        if (!task) return;
        this.active++;
        Promise.resolve()
            .then(task.fn)
            .then(result => task.resolve(result))
            .catch(err => task.reject(err))
            .finally(() => {
                this.active = Math.max(0, this.active - 1);
                if (this.queue.length) this._next();
            });
    }
}

const thumbnailQueue = new AsyncQueue(process.env.THUMBNAIL_CONCURRENCY || 2);
const TEACHER_LIST_CSV_PATH = path.join(__dirname, 'public', 'teacher_list_data.csv');
const TEACHER_STATUS_CACHE_TTL_MS = Number(process.env.TEACHER_STATUS_CACHE_TTL_MS || 180000);
const teacherReportStatusCache = new Map();

function splitCsvLine(line = '') {
    const result = [];
    let current = '';
    let inQuotes = false;
    const input = String(line || '').replace(/\r$/, '');
    for (let i = 0; i < input.length; i += 1) {
        const char = input[i];
        if (char === '"') {
            if (inQuotes && input[i + 1] === '"') {
                current += '"';
                i += 1;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function escapeCsvValue(value) {
    const str = String(value ?? '');
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function normalizeTeacherIdentifier(name = '') {
    return String(name || '')
        .toLowerCase()
        .replace(/[\s\u3000]/g, '')
        .replace(/[🙏🏻*「」『』【】()（）\[\]]/g, '')
        .trim();
}

function buildTeacherListHeaderMap(headers = []) {
    const normalized = headers.map(h => String(h || '').trim().toLowerCase());
    const findIndex = (keywords, fallbackIndex) => {
        for (let i = 0; i < normalized.length; i += 1) {
            if (keywords.every(keyword => normalized[i].includes(keyword))) {
                return i;
            }
        }
        return typeof fallbackIndex === 'number' ? fallbackIndex : -1;
    };
    return {
        teacher: findIndex(['老師', 'teacher'], 0),
        link: findIndex(['連結', 'link'], 1),
        webApi: findIndex(['web', 'api'], 2),
        readApi: findIndex(['讀', '報表', 'api'], 3),
        userId: findIndex(['user', 'id'], 4),
        googleSheetReadApi: findIndex(['google', 'read', 'api'], -1)
    };
}

function readTeacherListCsvRecords() {
    try {
        if (!fs.existsSync(TEACHER_LIST_CSV_PATH)) {
            return { records: [], headers: [], headerMap: buildTeacherListHeaderMap([]) };
        }
        const csvData = fs.readFileSync(TEACHER_LIST_CSV_PATH, 'utf8');
        const lines = csvData.split(/\r?\n/).filter(line => line.trim());
        if (!lines.length) {
            return { records: [], headers: [], headerMap: buildTeacherListHeaderMap([]) };
        }
        const headerCells = splitCsvLine(lines[0]);
        const headerMap = buildTeacherListHeaderMap(headerCells);
        const records = [];
        for (let i = 1; i < lines.length; i += 1) {
            const cells = splitCsvLine(lines[i]);
            if (!cells.length) continue;
            const record = {
                teacher: cells[headerMap.teacher] || '',
                link: cells[headerMap.link] || '',
                webApi: cells[headerMap.webApi] || '',
                readApi: cells[headerMap.readApi] || '',
                userId: cells[headerMap.userId] || '',
                googleSheetReadApi: headerMap.googleSheetReadApi >= 0 ? (cells[headerMap.googleSheetReadApi] || '') : (cells[5] || ''),
                normalizedName: normalizeTeacherIdentifier(cells[headerMap.teacher] || '')
            };
            records.push(record);
        }
        return { records, headers: headerCells, headerMap };
    } catch (error) {
        console.error('❌ 讀取 teacher_list_data.csv 失敗:', error);
        return { records: [], headers: [], headerMap: buildTeacherListHeaderMap([]) };
    }
}

function maskSensitiveUrl(url = '') {
    if (!url) return '';
    const idx = url.indexOf('?');
    return idx === -1 ? url : `${url.slice(0, idx)}?***`;
}

function getTaipeiDateParts(dateInput = null) {
    const baseDate = dateInput instanceof Date ? dateInput : new Date(dateInput || Date.now());
    const formatter = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(baseDate);
    const result = { year: '0000', month: '00', day: '00' };
    parts.forEach(({ type, value }) => {
        if (type === 'year') result.year = value;
        if (type === 'month') result.month = value;
        if (type === 'day') result.day = value;
    });
    return {
        year: Number(result.year),
        month: result.month,
        day: result.day,
        iso: `${result.year}-${result.month}-${result.day}`,
        display: `${result.year}/${result.month}/${result.day}`
    };
}

function parseDateQueryParam(value) {
    if (!value) {
        return getTaipeiDateParts();
    }
    const sanitized = String(value).trim();
    const cleaned = sanitized
        .replace(/（.*?）/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/年/g, '/')
        .replace(/月/g, '/')
        .replace(/日/g, '')
        .replace(/－|–|—/g, '-')
        .replace(/~|～/g, '-')
        .replace(/\s+/g, '');
    const parts = cleaned.split(/[\/-]/).filter(Boolean);
    if (parts.length === 3) {
        const [y, m, d] = parts;
        const candidate = new Date(`${y}-${m}-${d}T00:00:00+08:00`);
        return getTaipeiDateParts(candidate);
    }
    if (parts.length === 2) {
        const base = getTaipeiDateParts();
        const [m, d] = parts;
        const candidate = new Date(`${base.year}-${m}-${d}T00:00:00+08:00`);
        return getTaipeiDateParts(candidate);
    }
    const parsed = new Date(sanitized);
    if (!Number.isNaN(parsed.getTime())) {
        return getTaipeiDateParts(parsed);
    }
    return getTaipeiDateParts();
}

function canonicalizeSheetDate(value, fallbackYear) {
    if (!value) return '';
    let text = String(value).trim();
    if (!text) return '';
    text = text
        .replace(/（.*?）/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/星期[一二三四五六日天]/gi, '')
        .replace(/週[一二三四五六日天]/gi, '')
        .replace(/年/g, '/')
        .replace(/月/g, '/')
        .replace(/日/g, '')
        .replace(/－|–|—|~|～/g, '/')
        .replace(/\s+/g, '');
    const fullMatch = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/);
    if (fullMatch) {
        const [, y, m, d] = fullMatch;
        return `${y}-${String(Number(m)).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`;
    }
    const shortMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
    if (shortMatch) {
        const [, m, d] = shortMatch;
        const year = Number(fallbackYear) || getTaipeiDateParts().year;
        return `${year}-${String(Number(m)).padStart(2, '0')}-${String(Number(d)).padStart(2, '0')}`;
    }
    const digitsMatch = text.match(/(\d{4})(\d{2})(\d{2})/);
    if (digitsMatch) {
        const [, y, m, d] = digitsMatch;
        return `${y}-${m}-${d}`;
    }
    return '';
}

const SERVER_SPECIAL_EVENT_TYPES = {
    stop: ['停課', '取消', '暫停', '休息', '放假', '請假'],
    trial: ['體驗', '體驗課', '體驗班'],
    substitute: ['代課', '代理', '支援'],
    timeShift: ['改時間', '調課', '延後', '提前']
};

const SPECIAL_EVENT_KEYWORD_PATTERN = buildSpecialEventKeywordPattern();

function buildSpecialEventKeywordPattern() {
    const keywords = Object.values(SERVER_SPECIAL_EVENT_TYPES)
        .reduce((all, list) => all.concat(list), [])
        .filter(Boolean);
    if (!keywords.length) {
        return null;
    }
    const escaped = keywords
        .map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
    return new RegExp(`(${escaped})`, 'gi');
}

function normalizeCourseLabel(value) {
    if (!value) return '';
    const parsed = parseCourseTitleSafe(value);
    if (parsed && parsed.course) {
        return parsed.course.replace(/\s+/g, '').toUpperCase();
    }
    const cleaned = stripSpecialMarkers(String(value));
    return cleaned.replace(/\s+/g, '').toUpperCase();
}

function stripSpecialMarkers(value = '') {
    if (!value) return '';
    let text = String(value)
        .replace(/\[[^\]]+\]/g, ' ')
        .replace(/[（）()【】]/g, ' ')
        .replace(/公告[:：]?/gi, ' ')
        .replace(/第\s*\d+[週周]/gi, ' ');

    if (SPECIAL_EVENT_KEYWORD_PATTERN) {
        text = text.replace(SPECIAL_EVENT_KEYWORD_PATTERN, ' ');
    }

    // 移除「星期/週 + 時間 + 可能的地點」描述
    text = text.replace(/(?:星期|週|周)?[一二三四五六日天]\s*\d{1,2}:?\d{2}\s*[-~～﹣–—]\s*\d{1,2}:?\d{2}(?:\s*[^\s\d]+)?/gi, ' ');
    // 移除純時間區段（含 HHMM 形式）
    text = text.replace(/\d{1,2}:?\d{2}\s*[-~～﹣–—]\s*\d{1,2}:?\d{2}/g, ' ');

    return text.replace(/\s{2,}/g, ' ').trim();
}

function normalizeTimeSignatureForServer(value) {
    if (!value) return '';
    const text = String(value).trim();
    const colonMatch = text.match(/(\d{1,2}):?(\d{2})\s*[-~～﹣–—]\s*(\d{1,2}):?(\d{2})/);
    if (colonMatch) {
        const [, sh, sm, eh, em] = colonMatch;
        return `${sh.padStart(2, '0')}${sm}-${eh.padStart(2, '0')}${em}`;
    }
    const digitsMatch = text.match(/(\d{4})\s*[-~～﹣–—]\s*(\d{4})/);
    if (digitsMatch) {
        return `${digitsMatch[1]}-${digitsMatch[2]}`;
    }
    return text.replace(/\s+/g, '');
}

function parseTimeSignatureRange(signature) {
    if (!signature) return null;
    const match = String(signature).match(/(\d{2})(\d{2})-(\d{2})(\d{2})/);
    if (!match) return null;
    const [, sh, sm, eh, em] = match;
    const startHour = Number(sh);
    const endHour = Number(eh);
    const startMinute = Number(sm);
    const endMinute = Number(em);
    if (
        Number.isNaN(startHour) ||
        Number.isNaN(endHour) ||
        Number.isNaN(startMinute) ||
        Number.isNaN(endMinute)
    ) {
        return null;
    }
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    if (end <= start) return null;
    return { start, end };
}

function timeSignaturesOverlap(signatureA, signatureB) {
    if (!signatureA || !signatureB) return false;
    const rangeA = parseTimeSignatureRange(signatureA);
    const rangeB = parseTimeSignatureRange(signatureB);
    if (!rangeA || !rangeB) return false;
    return Math.max(rangeA.start, rangeB.start) < Math.min(rangeA.end, rangeB.end);
}

function parseSheetStudentCount(raw) {
    if (raw === undefined || raw === null) return null;
    const matches = String(raw).match(/\d+/g);
    if (!matches || !matches.length) return null;
    return Number(matches[matches.length - 1]);
}

function buildSheetFieldMap(headers = []) {
    const normalized = headers.map(h => String(h || '').trim().toLowerCase());
    const findIndex = (keywords, fallbackIndex) => {
        for (let i = 0; i < normalized.length; i += 1) {
            if (keywords.every(keyword => normalized[i].includes(keyword))) {
                return i;
            }
        }
        return typeof fallbackIndex === 'number' ? fallbackIndex : -1;
    };
    return {
        courseName: findIndex(['課程', '名稱'], 0),
        courseTime: findIndex(['上課', '時間'], 1),
        courseDate: findIndex(['課程', '日期'], 2),
        studentCount: findIndex(['人數', '助教'], 3),
        courseContent: findIndex(['課程', '內容'], 4)
    };
}

function mapSheetRows(values = [], fallbackYear) {
    if (!Array.isArray(values) || values.length === 0) return [];
    const headerRow = values[0] || [];
    const fieldMap = buildSheetFieldMap(headerRow);
    const rows = [];
    for (let i = 1; i < values.length; i += 1) {
        const cells = values[i];
        if (!cells || cells.every(cell => !String(cell || '').trim())) continue;
        const courseDateRaw = cells[fieldMap.courseDate] || '';
        const canonicalDate = canonicalizeSheetDate(courseDateRaw, fallbackYear);
        const courseName = cells[fieldMap.courseName] || '';
        const courseTime = cells[fieldMap.courseTime] || '';
        const studentCountRaw = cells[fieldMap.studentCount] || '';
        const courseContent = cells[fieldMap.courseContent] || '';
        const parsedCourseMeta = parseCourseTitleSafe(courseName) || {};
        const parsedCourseName = parsedCourseMeta.course || '';
        const parsedCourseTime = parsedCourseMeta.timeInfo || '';
        const titleTimeSignature = normalizeTimeSignatureForServer(parsedCourseTime);
        let primaryTimeSignature = normalizeTimeSignatureForServer(courseTime);
        let alternateTimeSignature = '';
        if (!primaryTimeSignature && titleTimeSignature) {
            primaryTimeSignature = titleTimeSignature;
        } else if (primaryTimeSignature && titleTimeSignature && primaryTimeSignature !== titleTimeSignature) {
            alternateTimeSignature = titleTimeSignature;
        }

        rows.push({
            rowIndex: i + 1,
            courseName,
            courseTime,
            courseDateRaw,
            courseContent,
            studentCountRaw,
            canonicalDate,
            courseNormalized: normalizeCourseLabel(courseName || parsedCourseName),
            normalizedCourseFromTitle: parsedCourseName ? normalizeCourseLabel(parsedCourseName) : '',
            timeSignature: primaryTimeSignature,
            alternateTimeSignature,
            courseTimeAlternate: alternateTimeSignature ? parsedCourseTime : '',
            studentCount: parseSheetStudentCount(studentCountRaw)
        });
    }
    return rows;
}

function findTeacherRecordByName(records = [], queryName = '') {
    const normalizedTarget = normalizeTeacherIdentifier(queryName);
    if (!normalizedTarget) return null;
    for (const record of records) {
        if (!record || !record.teacher) continue;
        const normalizedRecord = record.normalizedName || normalizeTeacherIdentifier(record.teacher);
        if (!normalizedRecord) continue;
        if (
            normalizedRecord === normalizedTarget ||
            normalizedRecord.includes(normalizedTarget) ||
            normalizedTarget.includes(normalizedRecord)
        ) {
            return record;
        }
    }
    return null;
}

// 初始化 FastAttendance 和 GoogleSheetsStudents
(async () => {
    try {
        await fastAttendance.initialize();
        console.log('✅ FastAttendance 系統已啟動');
        
        await googleSheetsStudents.initialize();
        console.log('✅ GoogleSheetsStudents 系統已啟動');

        await notionCourseSyncManager.initialize();
        console.log('✅ Notion 課程同步管理器已啟動');

        await adminStudentSheetClient.initialize();
        adminStudentSheetReady = true;
        console.log('✅ AdminStudentSheetClient 系統已啟動');

    } catch (error) {
        console.error('❌ 系統初始化失敗:', error);
    }
})();

// 🔧 輔助函數：從配置文件讀取正職群組 ID
function getStaffGroupId() {
  try {
    const configPath = path.join(__dirname, 'notification-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      return config?.roles?.admin?.group_id || 'C9cd9530405411fdd46de96f4e6cdecb7';
    }
  } catch (error) {
    console.error('❌ 讀取正職群組 ID 失敗:', error);
  }
  // 返回預設值作為後備
  return 'C9cd9530405411fdd46de96f4e6cdecb7';
}

// 🔧 輔助函數：從事件標題提取講師名稱
function extractTeacherNameFromTitle(title) {
    if (!title) return null;
    
    // 嘗試多種模式匹配講師名稱
    // 模式 1: "課程 - 講師名稱" 或 "講師名稱 - 課程"
    const pattern1 = /[-–—]\s*([A-Za-z\u4e00-\u9fa5]+(?:\s+[A-Za-z\u4e00-\u9fa5]+)?)\s*(?:老師|講師)?$/;
    const pattern2 = /^([A-Za-z\u4e00-\u9fa5]+(?:\s+[A-Za-z\u4e00-\u9fa5]+)?)\s*(?:老師|講師)?\s*[-–—]/;
    
    // 模式 3: 直接包含 "XX老師" 或 "XX講師"
    const pattern3 = /([A-Za-z\u4e00-\u9fa5]+)\s*(?:老師|講師)/;
    
    let match = title.match(pattern1) || title.match(pattern2) || title.match(pattern3);
    
    if (match && match[1]) {
        // 移除可能的空格和標點符號
        let teacherName = match[1].trim();
        // 移除 "老師" 或 "講師" 後綴（如果有）
        teacherName = teacherName.replace(/(?:老師|講師)$/, '').trim();
        return teacherName;
    }
    
    return null;
}

// 🔧 輔助函數：從 teacher_data.json 找到講師 userId
function getTeacherUserId(teacherName) {
    if (!teacherName) return null;
    
    try {
        const teacherDataPath = path.join(__dirname, 'teacher_data.json');
        if (!fs.existsSync(teacherDataPath)) {
            console.error('❌ teacher_data.json 不存在');
            return null;
        }
        
        const teacherData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
        const teachers = teacherData.teachers || [];
        
        // 不區分大小寫比對
        const normalizedName = teacherName.toUpperCase().trim();
        const teacher = teachers.find(t => 
            t.name && t.name.toUpperCase().trim() === normalizedName
        );
        
        if (teacher && teacher.userId) {
            return teacher.userId;
        }
        
        console.log(`⚠️ 找不到講師 ${teacherName} 的 userId`);
        return null;
        
    } catch (error) {
        console.error(`❌ 讀取講師資料失敗:`, error);
        return null;
    }
}

function upsertEnvValue(key, value) {
  const envPath = path.join(__dirname, '.env.nas');
  let envContent = '';

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }

  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, 'm');

  if (regex.test(envContent)) {
    envContent = envContent.replace(regex, line);
  } else {
    if (envContent.length && !envContent.endsWith('\n')) {
      envContent += '\n';
    }
    envContent += line;
  }

  if (!envContent.endsWith('\n')) {
    envContent += '\n';
  }

  fs.writeFileSync(envPath, envContent, 'utf8');
}

function ensureJsonFileInitialized(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
      console.log(`📁 已初始化檔案: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`❌ 初始化檔案失敗: ${filePath}`, error);
  }
}

function cloneSpecialEventState(state = SPECIAL_EVENT_REQUESTS_DEFAULT) {
  return {
    pending: Array.isArray(state?.pending) ? [...state.pending] : [],
    history: Array.isArray(state?.history) ? [...state.history] : []
  };
}

async function readSpecialEventRequestsData() {
  const data = await safeFile.readJSON(SPECIAL_EVENT_REQUESTS_FILE, SPECIAL_EVENT_REQUESTS_DEFAULT);
  return cloneSpecialEventState(data);
}

function sanitizeNotificationOptions(options = {}) {
  // 僅在前端明確勾選時才發送通知
  return {
    notifyStaffGroup: options?.notifyStaffGroup === true,
    notifyInstructor: options?.notifyInstructor === true
  };
}

function generateSpecialEventRequestId() {
  return `ser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveTeacherNameForEvent(event = {}) {
  return event.instructor ||
    event.teacher ||
    event.teacherName ||
    event.host ||
    extractTeacherNameFromTitle(event.title || event.summary || '');
}

function extractEventTimestamp(primaryValue, fallbackSeconds) {
  if (primaryValue) {
    const parsed = Date.parse(primaryValue);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  if (fallbackSeconds) {
    const ts = Number(fallbackSeconds) * 1000;
    if (!Number.isNaN(ts)) {
      return ts;
    }
  }
  return null;
}

function buildEventTimeDisplay(event = {}) {
  const startTs = extractEventTimestamp(event.start || event.startTime, event.dtstart);
  const endTs = extractEventTimestamp(event.end || event.endTime, event.dtend);
  if (!startTs) return '';

  const startDate = new Date(startTs);
  const endDate = endTs ? new Date(endTs) : null;
  let display = startDate.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  if (endDate) {
    const sameDay = startDate.toDateString() === endDate.toDateString();
    if (sameDay) {
      display += ` - ${endDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      display += ` ~ ${endDate.toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })}`;
    }
  }

  return display;
}

function buildEventDateMeta(event = {}) {
  const startTs = extractEventTimestamp(event.start || event.startTime, event.dtstart);
  const endTs = extractEventTimestamp(event.end || event.endTime, event.dtend);
  if (!startTs) {
    return {
      dateStr: '未提供日期',
      weekday: '',
      timeRange: '未知時間'
    };
  }
  const date = new Date(startTs);
  const dateStr = date.toLocaleDateString('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' });
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = `星期${weekdays[date.getDay()]}`;
  const startTime = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
  let timeRange = startTime;
  if (endTs) {
    const endDate = new Date(endTs);
    const endTime = endDate.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    timeRange = `${startTime} - ${endTime}`;
  }
  return { dateStr, weekday, timeRange };
}

function buildEventLocationLabel(event = {}) {
  const locationInfoName = event.location_info?.name || event.location_info?.displayName;
  return event.location || locationInfoName || '未提供地點';
}

function buildSpecialEventResponsePayload(state, historyLimit = 50) {
  const limit = Math.min(SPECIAL_EVENT_HISTORY_LIMIT, Math.max(1, Number(historyLimit) || 50));
  const normalized = cloneSpecialEventState(state);
  const sortedPending = [...normalized.pending].sort((a, b) => {
    const aTime = Date.parse(a?.createdAt || '') || 0;
    const bTime = Date.parse(b?.createdAt || '') || 0;
    return aTime - bTime;
  });
  return {
    pending: sortedPending,
    history: normalized.history.slice(-limit)
  };
}

function buildSpecialEventNotificationMessage(event, markers = [], note) {
  const badge = markers && markers.length ? markers.map(m => `[${m}]`).join('') : '特殊事件';
  const courseTitle = event?.title || event?.summary || event?.courseType || '未命名課程';
  const teacherName = resolveTeacherNameForEvent(event) || '未設定';
  const timeDisplay = buildEventTimeDisplay(event);

  const lines = [
    `📢 ${badge} ${courseTitle}`.trim(),
    timeDisplay ? `📅 ${timeDisplay}` : null,
    teacherName ? `👩‍🏫 講師：${teacherName}` : null
  ];

  if (note && note.trim()) {
    lines.push(`📝 備註：${note.trim()}`);
  }

  lines.push('— FLB 行事曆系統');
  return lines.filter(Boolean).join('\n');
}

async function dispatchSpecialEventNotifications(event, markers, note, options = {}) {
  const normalizedOptions = sanitizeNotificationOptions(options);
  const results = [];
  if (!normalizedOptions.notifyInstructor && !normalizedOptions.notifyStaffGroup) {
    return results;
  }

  const message = buildSpecialEventNotificationMessage(event, markers, note);
  const selectPrimaryMarker = () => {
    if (!Array.isArray(markers) || markers.length === 0) return null;
    const supported = markers.find(m => notificationManager.SPECIAL_EVENT_COLORS && notificationManager.SPECIAL_EVENT_COLORS[m]);
    return supported || markers[0];
  };
  const primaryMarker = selectPrimaryMarker();
  const courseTitle = event?.title || event?.summary || event?.courseType || '未命名課程';
  const teacherName = resolveTeacherNameForEvent(event) || '未設定';
  const { dateStr, weekday, timeRange } = buildEventDateMeta(event);
  const locationLabel = buildEventLocationLabel(event);
  const flexVariables = {
    teacherName,
    courseName: courseTitle,
    courseDate: dateStr,
    weekday,
    courseTime: timeRange,
    location: locationLabel,
    specialEventType: primaryMarker || null,
    specialEventNote: note && note.trim() ? note.trim() : '無'
  };
  const flexPayload = notificationManager.buildFlexMessage('specialEventAlert', flexVariables);
  const sendOptions = flexPayload ? { flexMessage: flexPayload, altText: message } : null;

  if (normalizedOptions.notifyInstructor) {
    const teacherName = resolveTeacherNameForEvent(event);
    const teacherUserId = getTeacherUserId(teacherName);
    if (teacherName && teacherUserId) {
      try {
        const response = await notificationManager.sendLineMessage(
          teacherUserId,
          flexPayload ? '' : message,
          sendOptions || {}
        );
        results.push({ target: 'instructor', success: true, userId: teacherUserId, response });
      } catch (error) {
        console.error('❌ 發送講師通知失敗:', error.message);
        results.push({ target: 'instructor', success: false, error: error.message });
      }
    } else {
      results.push({ target: 'instructor', success: false, error: '找不到講師 userId' });
    }
  }

  if (normalizedOptions.notifyStaffGroup) {
    const staffGroupId = getStaffGroupId();
    if (staffGroupId) {
      try {
        const response = await notificationManager.sendLineMessage(
          staffGroupId,
          flexPayload ? '' : message,
          sendOptions || {}
        );
        results.push({ target: 'staffGroup', success: true, groupId: staffGroupId, response });
      } catch (error) {
        console.error('❌ 發送正職群組通知失敗:', error.message);
        results.push({ target: 'staffGroup', success: false, error: error.message });
      }
    } else {
      results.push({ target: 'staffGroup', success: false, error: '未設定正職群組 ID' });
    }
  }

  return results;
}

// 批次通知佇列（用於合併多個通知）
const pendingNotifications = {
  leave: [],      // 請假通知
  pending: [],    // 待確認通知
  timers: {}      // 定時器
};

// ==================== Google Sheets 學生資料管理（Admin） ====================
const GOOGLE_SHEETS_SPREADSHEET_ID = '1A2dPb0iyvaqVGTOKqGcsq7aC6UHNttVcJ82r-G0xevk';
const STUDENT_SHEET_NAME = '學生Data(Sync Notion Class)';
const STUDENT_SHEET_RANGE = `'${STUDENT_SHEET_NAME}'!A1:AF`;
const STUDENT_SHEET_DATA_RANGE = `'${STUDENT_SHEET_NAME}'!A2:AF`;
const STUDENT_SHEET_CACHE_TTL = 60 * 1000; // 1 分鐘快取

const STUDENT_SHEET_HEADER_KEY_MAP = {
  '姓名': 'name',
  '就讀學校 與 年級': 'schoolGrade',
  '家長姓名': 'parentName',
  '家長姓名 / 聯絡': 'parentName',
  '家長姓名/聯絡': 'parentName',
  '家長姓名/聯絡方式': 'parentName',
  '家長聯絡電話': 'parentPhone',
  '家長聯絡方式（Email/Line ID）': 'parentContact',
  '家長聯絡資訊': 'parentContact',
  '家長聯絡': 'parentContact',
  '所屬課程': 'courseCategory',
  '課程類型': 'courseCategory',
  '課程分類': 'courseCategory',
  '課程名稱': 'courseName',
  '購買堂數': 'purchasedSessions',
  '剩餘堂數': 'remainingSessions',
  '本期收費（總）': 'currentTuition',
  '備註': 'note',
  '收費訊息': 'billingInfo',
  '公式計算用': 'formulaMemo',
  '自動訊息(堂數)': 'autoMessageSessions',
  '自動訊息(續報)': 'autoMessageRenew',
  '早鳥': 'isEarlyBird',
  '舊生': 'isReturning',
  '團報': 'isGroupSignup',
  '超早鳥（7/31前）': 'isSuperEarlyBird',
  'Notion Page ID': 'notionPageId',
  'userId': 'userId',
  'LINE User ID': 'userId',
  'LINE user ID': 'userId',
  'LINE userId': 'userId',
  'line user id': 'userId',
  'Line User ID': 'userId',
  'LINE USER ID': 'userId',
  '課程規劃': 'coursePlan',
  '#REF!': 'refValue',
  '通知對象類型': 'notificationTargetType',
  '通知對象': 'notificationTargetType',
  '通知群組ID': 'notificationGroupId',
  '通知群組名稱': 'notificationGroupName',
  '通知備註': 'notificationNotes',
  'groupId': 'groupId',
  'groupName': 'groupName',
  'type': 'type',
  'memberCount': 'memberCount',
  'description': 'description',
  'firstSeenAt': 'firstSeenAt',
  'lastActivityAt': 'lastActivityAt'
};

const STUDENT_SHEET_EDITABLE_KEYS = new Set([
  'name',
  'schoolGrade',
  'parentName',
  'parentPhone',
  'parentContact',
  'courseCategory',
  'courseName',
  'purchasedSessions',
  'remainingSessions',
  'currentTuition',
  'note',
  'billingInfo',
  'autoMessageSessions',
  'autoMessageRenew',
  'isEarlyBird',
  'isReturning',
  'isGroupSignup',
  'isSuperEarlyBird',
  'notionPageId',
  'userId',
  'coursePlan',
  'notificationTargetType',
  'notificationGroupId',
  'notificationGroupName',
  'notificationNotes'
]);

const STUDENT_SHEET_NUMERIC_KEYS = new Set([
  'purchasedSessions',
  'remainingSessions',
  'currentTuition'
]);

const STUDENT_SHEET_BOOLEAN_KEYS = new Set([
  'isEarlyBird',
  'isReturning',
  'isGroupSignup',
  'isSuperEarlyBird'
]);

const studentSheetCache = {
  fetchedAt: 0,
  columns: null,
  rows: null
};

const studentSheetMeta = {
  sheetId: null,
  fetchedAt: 0
};

const GROUP_SHEET_NAME = '群組資料表 (groups)';
const GROUP_SHEET_RANGE = `'${GROUP_SHEET_NAME}'!A1:K`;
const GROUP_SHEET_CACHE_TTL = 60 * 1000;

const groupSheetCache = {
  fetchedAt: 0,
  columns: null,
  groups: null
};

const PARENT_USERS_SHEET_NAME = '使用者資料表 (users)';
const PARENT_USERS_RANGE = `'${PARENT_USERS_SHEET_NAME}'!A:Z`;
const PARENT_USERS_CACHE_TTL = 60 * 1000;
const GOOGLE_SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

const parentUsersCache = {
  fetchedAt: 0,
  parents: null,
  columns: null
};

function ensureAdminSheetInitialized() {
  if (!adminStudentSheetReady) {
    throw new Error('AdminStudentSheetClient 尚未初始化完成');
  }
}

function toColumnLetter(colIndex) {
  let letter = '';
  let temp = colIndex;
  while (temp > 0) {
    const remainder = (temp - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter;
}

function normalizeHeaderKey(header) {
  if (!header) return '';
  const trimmed = String(header).trim();
  if (STUDENT_SHEET_HEADER_KEY_MAP[trimmed]) {
    return STUDENT_SHEET_HEADER_KEY_MAP[trimmed];
  }
  return trimmed
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

function normalizeOutputValue(key, value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'string') return value.trim();
  return String(value);
}

function formatValueForSheet(key, value) {
  if (value === null || value === undefined) return '';
  if (STUDENT_SHEET_BOOLEAN_KEYS.has(key)) {
    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }
    const str = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y', '是', 'v', '✅'].includes(str)) return 'TRUE';
    if (['false', '0', 'no', 'n', '否', '✖', 'x'].includes(str)) return 'FALSE';
    return value;
  }
  if (STUDENT_SHEET_NUMERIC_KEYS.has(key)) {
    if (value === '') return '';
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num;
    }
  }
  return typeof value === 'string' ? value.trim() : value;
}

async function getStudentSheetId() {
  const now = Date.now();
  if (studentSheetMeta.sheetId && (now - studentSheetMeta.fetchedAt) < STUDENT_SHEET_CACHE_TTL) {
    return studentSheetMeta.sheetId;
  }

  ensureAdminSheetInitialized();
  const properties = await adminStudentSheetClient.getSheetProperties(STUDENT_SHEET_NAME);
  if (!properties || typeof properties.sheetId === 'undefined') {
    throw new Error(`找不到工作表 ${STUDENT_SHEET_NAME} 的 sheetId`);
  }
  studentSheetMeta.sheetId = properties.sheetId;
  studentSheetMeta.fetchedAt = now;
  return studentSheetMeta.sheetId;
}

async function fetchStudentSheetData(forceReload = false) {
  const now = Date.now();
  if (!forceReload && studentSheetCache.columns && studentSheetCache.rows && (now - studentSheetCache.fetchedAt) < STUDENT_SHEET_CACHE_TTL) {
    return {
      columns: studentSheetCache.columns,
      rows: studentSheetCache.rows,
      fetchedAt: studentSheetCache.fetchedAt
    };
  }

  ensureAdminSheetInitialized();
  const rawData = await adminStudentSheetClient.getSheetData(STUDENT_SHEET_RANGE);
  if (!rawData || rawData.length === 0) {
    throw new Error('學生試算表無資料');
  }

  const [headerRow, ...dataRows] = rawData;
  const columns = headerRow.map((header, index) => {
    const normalizedKey = normalizeHeaderKey(header);
    const columnIndex = index + 1;
    return {
      header: header || '',
      key: normalizedKey,
      columnIndex,
      columnLetter: toColumnLetter(columnIndex),
      editable: STUDENT_SHEET_EDITABLE_KEYS.has(normalizedKey)
    };
  });

  const meaningfulRows = dataRows
    .map((rowValues, idx) => {
      const rowNumber = idx + 2;
      const values = {};
      let hasContent = false;

      columns.forEach((column, columnIndex) => {
        const cellValue = rowValues && rowValues[columnIndex] !== undefined ? rowValues[columnIndex] : '';
        const normalizedValue = normalizeOutputValue(column.key, cellValue);
        if (normalizedValue !== '') {
          hasContent = true;
        }
        values[column.key] = normalizedValue;
      });

      // 🔥 改進：必須有學生姓名才算有效資料
      const hasValidName = values.name && String(values.name).trim() !== '' && String(values.name).trim() !== '-';
      
      if (!hasContent || !hasValidName) {
        return null;
      }

      return {
        rowNumber,
        values
      };
    })
    .filter(Boolean);

  let parentUsers = [];
  try {
    const parentData = await fetchParentUserSheetData();
    parentUsers = parentData.parents || [];
  } catch (error) {
    console.warn('⚠️ 載入家長資料失敗（忽略並繼續）:', error.message || error);
  }

  let groupData = [];
  try {
    const groupResult = await fetchGroupSheetData();
    groupData = groupResult.groups || [];
  } catch (error) {
    console.warn('⚠️ 載入群組資料失敗（忽略並繼續）:', error.message || error);
  }

  const parentMapByName = new Map();
  parentUsers.forEach(parent => {
    const aliases = Array.isArray(parent.aliases) && parent.aliases.length
      ? parent.aliases
      : [parent.name];
    aliases.forEach(alias => {
      const key = normalizeParentKey(alias);
      if (key && !parentMapByName.has(key)) {
        parentMapByName.set(key, parent);
      }
    });
  });

  const groupMapById = new Map();
  const groupMapByName = new Map();
  groupData.forEach(group => {
    const id = (group.groupId || '').toString().trim();
    const name = (group.groupName || '').toString().trim();
    if (id) {
      groupMapById.set(id.toLowerCase(), group);
    }
    if (name) {
      groupMapByName.set(name.replace(/\s+/g, '').toLowerCase(), group);
    }
  });

  meaningfulRows.forEach(entry => {
    if (!entry || !entry.values) return;
    const values = entry.values;

    if (values.parentName) {
      let parentName = values.parentName;
      let extractedContact = '';

      if (parentName.includes('\n')) {
        const parts = parentName.split('\n').map(part => part.trim()).filter(Boolean);
        if (parts.length) {
          parentName = parts[0];
          if (parts.length > 1) {
            extractedContact = parts.slice(1).join(' / ');
          }
        }
      } else {
        const separators = ['｜', '|', '/', '／', '，', ',', '  '];
        for (const sep of separators) {
          if (parentName.includes(sep)) {
            const parts = parentName.split(sep).map(part => part.trim()).filter(Boolean);
            if (parts.length) {
              parentName = parts[0];
              if (parts.length > 1) {
                extractedContact = parts.slice(1).join(' / ');
              }
              break;
            }
          }
        }
      }

      values.parentName = parentName.trim();
      if (extractedContact && !values.parentContact) {
        values.parentContact = extractedContact;
      }
    }

    if (!values.userId && values.parentName) {
      const parentKey = normalizeParentKey(values.parentName);
      if (parentKey && parentMapByName.has(parentKey)) {
        const parent = parentMapByName.get(parentKey);
        if (parent.userId) {
          values.userId = parent.userId;
        }
        if (!values.parentContact && parent.contact) {
          values.parentContact = parent.contact;
        }
      }
    }

    if (!values.notificationTargetType && values.userId) {
      values.notificationTargetType = 'individual';
    }

    const candidateGroupIds = [
      values.notificationGroupId,
      values.groupId
    ];

    let matchedGroup = null;
    for (const rawId of candidateGroupIds) {
      const id = (rawId || '').toString().trim();
      if (!id) continue;
      const group = groupMapById.get(id.toLowerCase());
      if (group) {
        matchedGroup = group;
        if (!values.notificationGroupId) {
          values.notificationGroupId = group.groupId || id;
        }
        break;
      }
    }

    if (!matchedGroup && values.notificationGroupName) {
      const key = values.notificationGroupName.replace(/\s+/g, '').toLowerCase();
      matchedGroup = groupMapByName.get(key) || null;
    }

    if (!matchedGroup && values.groupName) {
      const key = values.groupName.replace(/\s+/g, '').toLowerCase();
      matchedGroup = groupMapByName.get(key) || null;
    }

    if (matchedGroup) {
      if (!values.notificationGroupId && matchedGroup.groupId) {
        values.notificationGroupId = matchedGroup.groupId;
      }
      if (!values.notificationGroupName && matchedGroup.groupName) {
        values.notificationGroupName = matchedGroup.groupName;
      }
      if (!values.notificationTargetType) {
        values.notificationTargetType = 'group';
      }
    }
  });

  studentSheetCache.columns = columns;
  studentSheetCache.rows = meaningfulRows;
  studentSheetCache.fetchedAt = now;

  return {
    columns,
    rows: meaningfulRows,
    fetchedAt: now
  };
}

function invalidateStudentSheetCache() {
  studentSheetCache.columns = null;
  studentSheetCache.rows = null;
  studentSheetCache.fetchedAt = 0;
}

function invalidateGroupSheetCache() {
  groupSheetCache.columns = null;
  groupSheetCache.groups = null;
  groupSheetCache.fetchedAt = 0;
}

function normalizeParentKey(name) {
  if (!name) return '';
  return String(name)
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function findColumnIndex(headers, aliases) {
  if (!Array.isArray(headers)) return -1;
  const normalizedAliases = aliases.map(alias => alias.toLowerCase());
  return headers.findIndex(header => {
    const normalizedHeader = String(header || '').trim().toLowerCase();
    return normalizedAliases.includes(normalizedHeader);
  });
}

async function fetchParentUserSheetData(forceReload = false) {
  const now = Date.now();
  if (!forceReload &&
      parentUsersCache.parents &&
      (now - parentUsersCache.fetchedAt) < PARENT_USERS_CACHE_TTL) {
    return {
      parents: parentUsersCache.parents,
      columns: parentUsersCache.columns,
      fetchedAt: parentUsersCache.fetchedAt
    };
  }

  const apiKey = process.env.GOOGLE_SHEETS_API_KEY || 'AIzaSyDfYBGUCp1ixevg06acZCvWimwdqLKxh9Y';
  if (!apiKey) {
    throw new Error('缺少 GOOGLE_SHEETS_API_KEY');
  }

  const encodedRange = encodeURIComponent(PARENT_USERS_RANGE);
  const url = `${GOOGLE_SHEETS_API_BASE}/${GOOGLE_SHEETS_SPREADSHEET_ID}/values/${encodedRange}?key=${apiKey}`;

  console.log('🔄 從 Google Sheets 讀取家長資料...');

  try {
    const response = await axios.get(url, { timeout: 10000 });
    const rows = response.data?.values || [];
    if (!rows.length) {
      throw new Error('家長資料表為空');
    }

    const headers = rows[0] || [];
    const nameIndex = findColumnIndex(headers, [
      '姓名',
      'name',
      '家長姓名',
      '名稱',
      '顯示名稱',
      'display name',
      'displayname',
      'username',
      'user name'
    ]);
    const userIdIndex = findColumnIndex(headers, [
      'userid',
      'user id',
      'line user id',
      'lineuserid',
      'line userID',
      'line_user_id'
    ]);
    const contactIndex = findColumnIndex(headers, [
      '聯絡方式',
      '聯絡資訊',
      '聯絡資料',
      'contact',
      'contact info',
      'line id',
      'lineid',
      'phone',
      '電話'
    ]);
    const noteIndex = findColumnIndex(headers, [
      '備註',
      'note',
      'notes'
    ]);

    if (nameIndex === -1 || userIdIndex === -1) {
      throw new Error(`找不到必要欄位 (nameIndex=${nameIndex}, userIdIndex=${userIdIndex})`);
    }

    const parents = [];

    rows.slice(1).forEach((row, idx) => {
      const name = (row[nameIndex] || '').toString().trim();
      const userId = (row[userIdIndex] || '').toString().trim();
      if (!name || !userId || !userId.startsWith('U')) {
        return;
      }

      const contact = contactIndex >= 0 ? (row[contactIndex] || '').toString().trim() : '';
      const note = noteIndex >= 0 ? (row[noteIndex] || '').toString().trim() : '';

      const aliasCandidates = name
        .split(/[,，、／/()（）\s]+/)
        .map(part => part.trim())
        .filter(Boolean);
      const aliases = Array.from(new Set([name, ...aliasCandidates]));

      const parentRecord = {
        rowNumber: idx + 2,
        name,
        userId,
        contact,
        note,
        aliases
      };

      parents.push(parentRecord);
    });

    parentUsersCache.parents = parents;
    parentUsersCache.columns = headers;
    parentUsersCache.fetchedAt = now;

    console.log(`✅ 家長資料載入完成，共 ${parents.length} 筆`);

    return {
      parents,
      columns: headers,
      fetchedAt: now
    };
  } catch (error) {
    console.error('❌ 讀取家長資料失敗:', error.message || error);
    throw error;
  }
}

async function fetchGroupSheetData(forceReload = false) {
  const now = Date.now();
  if (!forceReload &&
      groupSheetCache.groups &&
      (now - groupSheetCache.fetchedAt) < GROUP_SHEET_CACHE_TTL) {
    return {
      columns: groupSheetCache.columns,
      groups: groupSheetCache.groups,
      fetchedAt: groupSheetCache.fetchedAt
    };
  }

  ensureAdminSheetInitialized();
  const rawData = await adminStudentSheetClient.getSheetData(GROUP_SHEET_RANGE);
  if (!rawData || rawData.length === 0) {
    throw new Error('群組資料為空');
  }

  const [headerRow, ...dataRows] = rawData;
  const columns = headerRow.map((header, index) => {
    const normalizedKey = normalizeHeaderKey(header);
    const columnIndex = index + 1;
    return {
      header: header || '',
      key: normalizedKey,
      columnIndex,
      columnLetter: toColumnLetter(columnIndex)
    };
  });

  const groups = dataRows
    .map((rowValues, idx) => {
      const rowNumber = idx + 2;
      const values = {};
      let hasContent = false;

      columns.forEach((column, columnIndex) => {
        const cellValue = rowValues && rowValues[columnIndex] !== undefined ? rowValues[columnIndex] : '';
        const normalizedValue = normalizeOutputValue(column.key, cellValue);
        if (normalizedValue !== '') {
          hasContent = true;
        }
        values[column.key] = normalizedValue;
      });

      if (!hasContent) return null;

      const groupId = values.groupId || values.groupID || values.id || '';
      const groupName = values.groupName || values.name || '';
      if (!groupId && !groupName) {
        return null;
      }

      return {
        rowNumber,
        groupId,
        groupName,
        type: values.type || '',
        memberCount: values.memberCount || '',
        description: values.description || '',
        firstSeenAt: values.firstSeenAt || '',
        lastActivityAt: values.lastActivityAt || '',
        raw: values
      };
    })
    .filter(Boolean);

  groupSheetCache.columns = columns;
  groupSheetCache.groups = groups;
  groupSheetCache.fetchedAt = now;

  return {
    columns,
    groups,
    fetchedAt: now
  };
}
// 批次發送通知函數（3秒延遲，可合併多個通知）
async function sendBatchNotifications(responseType, notificationManager) {
  try {
    const notifications = pendingNotifications[responseType];
    
    if (notifications.length === 0) {
      console.log(`📭 [批次通知] 沒有待發送的${responseType === 'leave' ? '請假' : '待確認'}通知`);
      return;
    }
    
    console.log(`📬 [批次通知] 準備發送 ${notifications.length} 個${responseType === 'leave' ? '請假' : '待確認'}通知`);
    
    // 讀取配置
    const leaveNotifConfigPath = path.join(__dirname, 'data', 'leave-notification-config.json');
    if (!fs.existsSync(leaveNotifConfigPath)) {
      console.log('⚠️ 找不到請假通知配置文件');
      return;
    }
    
    const notifConfig = JSON.parse(fs.readFileSync(leaveNotifConfigPath, 'utf8'));
    
    if (!notifConfig.enabled || !notifConfig.notifyOn[responseType] || !notifConfig.groupId) {
      console.log(`⚠️ 通知未啟用或未設定群組 ID`);
      return;
    }
    
    // 決定使用 Carousel 還是單個 Flex Message
    if (notifications.length === 1) {
      // 單個通知
      console.log(`📤 [批次通知] 發送單個通知`);
      const notif = notifications[0];
      
      let messageToSend;
      
      if (notifConfig.useFlexMessage) {
        const templateType = responseType === 'leave' ? 'leaveNotification' : 'pendingNotification';
        const flexMessage = notificationManager.buildFlexMessage(templateType, notif.variables);
        
        if (flexMessage) {
          messageToSend = {
            flexMessage,
            altText: responseType === 'leave' 
              ? `🏥 學生請假通知 - ${notif.variables.studentName}`
              : `⏳ 學生待確認通知 - ${notif.variables.studentName}`
          };
        }
      }
      
      if (!messageToSend) {
        // 使用純文字
        let baseMessage = '';
        if (responseType === 'leave') {
          baseMessage = `🏥 學生請假通知\n\n👤 學生：${notif.variables.studentName}\n📚 課程：${notif.variables.courseName}\n📅 日期：${notif.variables.courseDate} ${notif.variables.weekday}\n⏰ 時間：${notif.variables.courseTime}\n📍 地點：${notif.variables.location}\n\n🏥 請假理由：${notif.variables.leaveReason}\n⏱️ 回覆時間：${notif.variables.replyTime}`;
        } else {
          baseMessage = `⏳ 學生待確認通知\n\n👤 學生：${notif.variables.studentName}\n📚 課程：${notif.variables.courseName}\n📅 日期：${notif.variables.courseDate} ${notif.variables.weekday}\n⏰ 時間：${notif.variables.courseTime}\n📍 地點：${notif.variables.location}\n\n⏱️ 回覆時間：${notif.variables.replyTime}\n\n💡 家長尚未確認是否出席`;
        }
        
        // ✅ 新增：資料缺失警告
        if (notif.variables.dataIncomplete) {
          baseMessage += `\n\n⚠️ 資料不完整警告\n缺失欄位：${notif.variables.missingFields}\n提示：該學生可能未在系統中登記該課程`;
        }
        
        messageToSend = baseMessage;
      }
      
      const sendResult = await notificationManager.sendLineMessage(
        notifConfig.groupId,
        typeof messageToSend === 'string' ? messageToSend : '',
        messageToSend
      );
      
      if (sendResult.success) {
        console.log(`✅ [批次通知] 單個通知已發送`);
      } else {
        console.log(`❌ [批次通知] 單個通知發送失敗: ${sendResult.error}`);
      }
    } else {
      // 多個通知，使用 Carousel
      console.log(`🎠 [批次通知] 使用 Carousel 發送 ${notifications.length} 個通知`);
      
      const templateType = responseType === 'leave' ? 'leaveNotification' : 'pendingNotification';
      const variablesArray = notifications.map(n => n.variables);
      
      // 使用 buildCarousel 建立 Carousel
      const carousel = notificationManager.buildCarousel(variablesArray, templateType);
      
      if (carousel) {
        const altText = responseType === 'leave'
          ? `🏥 學生請假通知 - ${notifications.length} 位學生`
          : `⏳ 學生待確認通知 - ${notifications.length} 位學生`;
        
        const sendResult = await notificationManager.sendLineMessage(
          notifConfig.groupId,
          '',
          { flexMessage: carousel, altText }
        );
        
        if (sendResult.success) {
          console.log(`✅ [批次通知] Carousel 已發送`);
        } else {
          console.log(`❌ [批次通知] Carousel 發送失敗: ${sendResult.error}`);
        }
      } else {
        console.log(`❌ [批次通知] 建立 Carousel 失敗`);
      }
    }
    
    // 清空佇列
    pendingNotifications[responseType] = [];
    
  } catch (error) {
    console.error(`❌ [批次通知] 發送失敗:`, error);
    // 清空佇列（避免重複發送）
    pendingNotifications[responseType] = [];
  }
}

// 載入系統設定函數
function loadSystemSettings() {
  try {
    const settingsPath = path.join(__dirname, 'system-settings.json');
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(settingsData);
    } else {
      // 如果檔案不存在，使用預設值
      return {
        scheduler: { checkInterval: 5, timeout: 60000, retryDelay: 1000 },
        timezone: { offset: 8, name: "Asia/Taipei" },
        reminders: { 
          todayReminderHour: 8, 
          todayReminderMinute: 0, 
          beforeClassMinutes: 30, 
          tomorrowReminderHour: 19, 
          tomorrowReminderMinute: 30, 
          sendDelay: 1000 
        },
        studentReminders: { defaultHour: 19, defaultMinute: 30, defaultDuration: 5, defaultEnabled: true },
        matching: { durationTolerance: 30, timeTolerance: 30 },
        api: { baseUrl: "https://calendar.funlearnbar.synology.me", timeout: 60000 },
        dateRange: { futureDays: 30, pastDays: 7 }
      };
    }
  } catch (error) {
    console.error('❌ 載入系統設定失敗:', error);
    // 如果載入失敗，使用預設值
    return {
      scheduler: { checkInterval: 5, timeout: 60000, retryDelay: 1000 },
      timezone: { offset: 8, name: "Asia/Taipei" },
      reminders: { 
        todayReminderHour: 8, 
        todayReminderMinute: 0, 
        beforeClassMinutes: 30, 
        tomorrowReminderHour: 19, 
        tomorrowReminderMinute: 30, 
        sendDelay: 1000 
      },
      studentReminders: { defaultHour: 19, defaultMinute: 30, defaultDuration: 5, defaultEnabled: true },
      matching: { durationTolerance: 30, timeTolerance: 30 },
      api: { baseUrl: "https://calendar.funlearnbar.synology.me", timeout: 60000 },
      dateRange: { futureDays: 30, pastDays: 7 }
    };
  }
}

// ===== Period 解析函數 =====
/**
 * 解析 period 字串為結構化資料
 * @param {string} periodStr - 原始 period 字串 (如 "三 0840-0920", "一四 1930-2030 到府")
 * @returns {Object} 結構化的 periodParsed 物件
 */
function parsePeriodString(periodStr) {
  // 預設回傳結構
  const result = {
    weekdays: [],
    startTime: null,
    endTime: null,
    location: null,
    note: null,
    raw: periodStr || ''
  };

  // 如果輸入無效，回傳預設值
  if (!periodStr || typeof periodStr !== 'string') {
    return result;
  }

  try {
    // 1. 提取星期（支援中文星期：一二三四五六日）
    const weekdayPattern = /[一二三四五六日]/g;
    const weekdayMatches = periodStr.match(weekdayPattern);
    if (weekdayMatches) {
      // 去重並保持順序
      result.weekdays = [...new Set(weekdayMatches)];
    }

    // 2. 提取時間範圍（支援多種格式）
    // 格式支援：HHMM-HHMM, HH:MM-HH:MM, HHMM~HHMM 等
    const timePattern = /(\d{1,2}):?(\d{2})\s*[-~–—]\s*(\d{1,2}):?(\d{2})/;
    const timeMatch = periodStr.match(timePattern);
    
    if (timeMatch) {
      const [_, h1, m1, h2, m2] = timeMatch;
      // 標準化為 HH:MM 格式
      result.startTime = `${h1.padStart(2, '0')}:${m1}`;
      result.endTime = `${h2.padStart(2, '0')}:${m2}`;
    }

    // 3. 提取地點關鍵字
    if (periodStr.includes('到府')) {
      result.location = '到府';
    } else if (periodStr.includes('松山')) {
      result.location = '松山';
    } else if (periodStr.includes('外')) {
      result.location = '外';
    }

    // 4. 提取備註關鍵字
    if (periodStr.includes('客製化')) {
      result.note = '客製化';
    } else if (periodStr.includes('包班')) {
      result.note = '包班';
    } else if (periodStr.includes('代課')) {
      result.note = '代課';
    }

  } catch (error) {
    console.error('❌ 解析 period 字串失敗:', periodStr, error);
    // 發生錯誤時回傳基本結構（不中斷流程）
  }

  return result;
}

// 內存數據庫替代 SQLite3
const memoryDB = {
  teachers: new Map(),
  cache: new Map(),
  
  set(key, value) {
    this.cache.set(key, value);
  },
  
  get(key) {
    return this.cache.get(key);
  },
  
  has(key) {
    return this.cache.has(key);
  },
  
  delete(key) {
    return this.cache.delete(key);
  },
  
  clear() {
    this.cache.clear();
  }
};

const app = express();
const PORT = process.env.PORT || 3002;

// 🚀 初始化智能快取管理器（2025-11-01 效能優化）
const globalCache = new SmartCacheManager({
    defaultTTL: 300000,  // 5 分鐘
    maxSize: 1000
});
console.log('✅ 智能快取管理器已初始化');

// 🚀 初始化 Synology Drive 客戶端（2025-11-08）
let driveClient, drivePathManager, learningUploadHelper;

try {
    // 🔥 檢查必要環境變數
    if (!process.env.SYNOLOGY_HOST) {
        console.error('⚠️ [警告] SYNOLOGY_HOST 環境變數未設置，學習歷程上傳功能將無法使用');
        console.error('💡 請在 .env.nas 檔案中設置以下環境變數：');
        console.error('   SYNOLOGY_HOST=your-nas-host');
        console.error('   SYNOLOGY_PORT=9102');
        console.error('   SYNOLOGY_PROTOCOL=https');
        console.error('   SYNOLOGY_USERNAME=your-username');
        console.error('   SYNOLOGY_PASSWORD=your-password');
        console.error('   SYNOLOGY_DRIVE_ROOT=/Fun Learn Bar/FLB-Learning-Portfolio');
    } else {
        driveClient = new SynologyDriveClient({
            host: process.env.SYNOLOGY_HOST,
            port: process.env.SYNOLOGY_PORT || 9102,
            protocol: process.env.SYNOLOGY_PROTOCOL || 'https',
            username: process.env.SYNOLOGY_USERNAME,
            password: process.env.SYNOLOGY_PASSWORD
        });

        drivePathManager = new DrivePathManager({
            driveRoot: process.env.SYNOLOGY_DRIVE_ROOT || '/Fun Learn Bar/FLB-Learning-Portfolio'
        });

        learningUploadHelper = new LearningUploadHelper(driveClient, drivePathManager);

        // 🧩 將 Drive 相關服務掛載到 app，供路由模組（含 V2 API）存取
        app.set('learningUploadHelper', learningUploadHelper);

        console.log('✅ Synology Drive 客戶端已初始化');
    }
} catch (error) {
    console.error('❌ [錯誤] Synology Drive 客戶端初始化失敗:', error.message);
    console.error('💡 請檢查 .env.nas 檔案中的環境變數設置');
    // 不中斷伺服器啟動，但上傳功能將無法使用
}

function ensureDriveServicesReady(res) {
    if (!driveClient || !drivePathManager || !learningUploadHelper) {
        if (res) {
            res.status(503).json({
                success: false,
                message: 'Synology Drive 服務尚未啟用，請檢查環境變數設定'
            });
        }
        return false;
    }
    return true;
}

function validateDriveContextFields(context = {}) {
    const missing = [];
    if (!context.semester) missing.push('semester');
    if (!context.courseName) missing.push('courseName');
    if (!context.date) missing.push('date');
    if (!context.isOverview && !context.studentName) missing.push('studentName');
    return missing;
}

// 🔥 使用統一的學期工具：根據日期計算學期
function resolveSemesterFromDateInput(dateStr) {
    return getUnifiedSemester(dateStr);
}

// 🔥 使用統一的學期格式驗證
function sanitizeSemesterInput(value) {
    if (!value) return '';
    const trimmed = String(value).trim();
    return isSemesterFormat(trimmed) ? trimmed : '';
}

function resolveDriveRecordPathFromQuery(query = {}) {
    if (!drivePathManager) return null;

    const relativePath = query.relativePath;
    if (relativePath) {
        let normalized = String(relativePath).replace(/\\+/g, '/');
        if (!normalized.startsWith('/')) normalized = '/' + normalized;
        if (!normalized.startsWith(drivePathManager.driveRoot)) {
            normalized = path.posix.join(drivePathManager.driveRoot, normalized);
        }
        return normalized.replace(/\/+/g, '/');
    }

    const date = query.date;
    const courseName = query.courseName || query.coursePeriod;
    const studentNameRaw = query.studentName;
    const topic = query.topic || null;
    if (!courseName || !date) {
        return null;
    }

    const semester = query.semester || resolveSemesterFromDateInput(date);
    const isOverview = query.isOverview === 'true' || studentNameRaw === '課程總覽' || !studentNameRaw;

    try {
        if (isOverview) {
            return drivePathManager.buildOverviewRecordPath(semester, courseName, date, topic);
        }
        return drivePathManager.buildStudentRecordPath(semester, courseName, date, topic, studentNameRaw);
    } catch (error) {
        console.error('❌ [drive-path] 生成路徑失敗:', {
            semester,
            courseName,
            date,
            studentName: studentNameRaw,
            message: error.message
        });
        return null;
    }
}

function guessMimeTypeFromName(fileName, fallback = 'application/octet-stream') {
    if (!fileName) return fallback;
    const ext = path.extname(String(fileName)).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        default:
            return fallback;
    }
}

// 初始化提醒排程器
const reminderScheduler = new ReminderScheduler();

// 初始化通知管理器
const notificationManager = new NotificationManager();

// 初始化簽到隊列管理器
const queueFilePath = path.join(__dirname, 'data', 'attendance-queue.json');
const attendanceQueueManager = new AttendanceQueueManager(queueFilePath, notificationManager, {
    courseHistoryLogger: studentCourseHistoryLogger
});
console.log('✅ 簽到隊列管理器已初始化');

// 初始化假日同步管理器
const holidayManager = new HolidaySyncManager();
// ⏰ 啟動定期同步任務（每天凌晨 2 點 - 台灣時區，錯開其他任務）
holidayManager.startScheduledSync();
console.log('✅ 假日同步管理器已初始化（台灣時區，每日 02:00）');

// ===== 每日出缺席統計報告 =====
/**
 * 生成當日出缺席統計報告
 */
const DAILY_ATTENDANCE_REPORTS_PATH = path.join(__dirname, 'data', 'daily-attendance-reports.json');
const DAILY_ATTENDANCE_REPORT_RETENTION_DAYS = 365;

async function saveDailyAttendanceReport(reportRecord = {}) {
  try {
    if (!reportRecord || typeof reportRecord !== 'object') {
      throw new Error('報告資料格式錯誤');
    }

    await safeFile.atomicUpdate(
      DAILY_ATTENDANCE_REPORTS_PATH,
      async (data = {}) => {
        const reports = Array.isArray(data.reports) ? data.reports.slice() : [];

        const existingIndex = reports.findIndex(item => item && item.date === reportRecord.date);
        if (existingIndex >= 0) {
          reports[existingIndex] = {
            ...reports[existingIndex],
            ...reportRecord
          };
        } else {
          reports.push(reportRecord);
        }

        reports.sort((a, b) => {
          if (!a?.date) return -1;
          if (!b?.date) return 1;
          return a.date.localeCompare(b.date);
        });

        if (DAILY_ATTENDANCE_REPORT_RETENTION_DAYS > 0) {
          const cutoffDate = new Date(reminderScheduler.getTaiwanTime());
          cutoffDate.setDate(cutoffDate.getDate() - DAILY_ATTENDANCE_REPORT_RETENTION_DAYS);
          const cutoffStr = cutoffDate.toISOString().split('T')[0];
          return {
            reports: reports.filter(item => !item?.date || item.date >= cutoffStr)
          };
        }

        return { reports };
      },
      { reports: [] }
    );

    console.log('✅ 每日出缺席統計報告已寫入快取檔案');
  } catch (error) {
    console.error('❌ 保存每日出缺席統計報告失敗:', error);
  }
}

// 通用計算：指定日期（台灣時區）產出每日統計，選擇性發送 Flex 與快取
async function computeDailyAttendanceSummaryForDate(dateStr, options = {}) {
  try {
    const {
      source = 'scheduler',
      sendFlex = false,
      persistCache = true
    } = options;

    console.log('📊 計算每日出缺席統計...', { source, dateStr, sendFlex, persistCache });

    // 日期正規化
    const today = dateStr && /\d{4}-\d{2}-\d{2}/.test(dateStr)
      ? dateStr
      : reminderScheduler.getTaiwanDateString();

    const taiwanNow = reminderScheduler.getTaiwanTime();
    const generatedAt = taiwanNow.toISOString();
    
    console.log(`📅 統計日期 (台灣時區): ${today}`);
    
    // 讀取學生提醒 baseline
    const remindersDataPath = path.join(__dirname, 'data', 'reminders.json');
    let studentReminders = [];
    if (fs.existsSync(remindersDataPath)) {
      console.log(`📂 讀取學生提醒資料: ${remindersDataPath}`);
      try {
        const remindersData = JSON.parse(fs.readFileSync(remindersDataPath, 'utf8'));
        studentReminders = remindersData.studentReminders || [];
      } catch (error) {
        console.error('❌ 解析學生提醒資料失敗，將以空資料生成報告:', error.message);
      }
    } else {
      console.log('⚠️ 找不到學生提醒資料，將以空資料生成報告');
      console.log(`   檢查路徑: ${remindersDataPath}`);
    }
    
    console.log(`📊 總學生提醒數: ${studentReminders.length}`);
    if (studentReminders.length > 0) {
      // 顯示前 3 個提醒的日期（除錯用）
      const dates = studentReminders.slice(0, 3).map(r => r.courseDate);
      console.log(`   前3個提醒日期: ${dates.join(', ')}`);
    }

    // 篩選「指定日期」的學生提醒
    let todayReminders = studentReminders.filter(r => r.courseDate === today);
    if (todayReminders.length === 0) {
      console.log('📭 指定日期沒有學生提醒 baseline，嘗試即時從行事曆建立 baseline...');
      try {
        if (typeof reminderScheduler.generateStudentBaselineForDate === 'function') {
          todayReminders = await reminderScheduler.generateStudentBaselineForDate(today);
          console.log(`✅ 即時 baseline 建立完成：${todayReminders.length} 筆`);
        }
      } catch (err) {
        console.error('❌ 即時 baseline 建立失敗：', err.message);
      }
      if (todayReminders.length === 0) {
        console.log('📭 仍無 baseline，將以空資料生成報告');
      }
    } else {
      console.log(`📚 指定日期共有 ${todayReminders.length} 個課程提醒`);
    }
    
    // 讀取學生回應資料
    const studentResponsesPath = path.join(__dirname, 'data', 'student-responses.json');
    let responses = [];
    if (fs.existsSync(studentResponsesPath)) {
      const responsesData = JSON.parse(fs.readFileSync(studentResponsesPath, 'utf8'));
      responses = (responsesData.responses || []).filter(r => r.courseDate === today);
    }
    
    console.log(`💬 今天共有 ${responses.length} 個學生回應`);
    
    const normalizeKey = (value) => (value || '').toString().trim().toLowerCase();
    const statusLabelMap = {
      attend: '✅ 已確認出席',
      leave: '🏥 請假',
      pending: '⏳ 待確認',
      noResponse: '❔ 未回應'
    };
    
    const responseExactMap = new Map();
    const responseFallbackMap = new Map();
    responses.forEach(resp => {
      if (!resp) return;
      const studentKey = normalizeKey(resp.studentName);
      const courseKey = normalizeKey(resp.courseName);
      const courseDate = resp.courseDate || today;
      const exactKey = `${studentKey}|${courseDate}|${courseKey}`;
      const fallbackKey = `${studentKey}|${courseDate}`;
      if (studentKey) {
        if (!responseExactMap.has(exactKey)) {
          responseExactMap.set(exactKey, resp);
        }
        if (!responseFallbackMap.has(fallbackKey)) {
          responseFallbackMap.set(fallbackKey, resp);
        }
      }
    });
    
    const summaryCounts = {
      total: todayReminders.length,
      attend: 0,
      leave: 0,
      pending: 0,
      noResponse: 0
    };
    
    const categories = {
      attend: [],
      leave: [],
      pending: [],
      noResponse: []
    };
    
    const matchedResponseIds = new Set();
    
    todayReminders.forEach(reminder => {
      const studentName = reminder.studentName || '未知學生';
      const courseName = reminder.courseName || '未命名課程';
      const courseDate = reminder.courseDate || today;
      const normalizedStudent = normalizeKey(studentName);
      const normalizedCourse = normalizeKey(courseName);
      const exactKey = `${normalizedStudent}|${courseDate}|${normalizedCourse}`;
      const fallbackKey = `${normalizedStudent}|${courseDate}`;
      const response = responseExactMap.get(exactKey) || responseFallbackMap.get(fallbackKey) || null;
      
      let status = 'attend';
      if (response) {
        matchedResponseIds.add(response.id);
        if (response.responseType === 'leave') {
          status = 'leave';
        } else if (response.responseType === 'pending') {
          status = 'pending';
        } else if (response.responseType === 'attend') {
          status = 'attend';
        } else {
          status = 'noResponse';
        }
      } else {
        status = 'noResponse';
      }
      
      const targetType = reminder.notificationTargetType || (reminder.notificationGroupId ? 'group' : 'individual');
      const statusRecord = {
        reminderId: reminder.id || null,
        responseId: response?.id || null,
        studentName,
        courseName,
        courseDate,
        courseTime: reminder.courseTime || response?.courseTime || '',
        teacherName: reminder.teacherName || response?.teacherName || '',
        location: reminder.location || response?.location || '',
        parentUserId: reminder.parentUserId || null,
        parentName: reminder.parentName || response?.parentName || '',
        parentContact: reminder.parentContact || response?.parentContact || '',
        notificationTargetType: targetType,
        notificationGroupId: reminder.notificationGroupId || null,
        notificationGroupName: reminder.notificationGroupName || null,
        groupId: reminder.notificationGroupId || null,
        groupName: reminder.notificationGroupName || null,
        status,
        statusLabel: statusLabelMap[status],
        leaveReason: response?.leaveReason || null,
        respondedAt: response?.timestamp || null,
        responseSource: response?.source || null,
        notes: response?.note || response?.memo || reminder.note || ''
      };
      
      categories[status].push(statusRecord);
      summaryCounts[status] += 1;
    });
    
    const orphanResponses = responses.filter(resp => {
      if (!resp) return false;
      if (!resp.id) return true;
      return !matchedResponseIds.has(resp.id);
    }).map(resp => ({
      responseId: resp.id,
      studentName: resp.studentName || '未知學生',
      courseName: resp.courseName || '未命名課程',
      courseDate: resp.courseDate || today,
      courseTime: resp.courseTime || '',
      parentName: resp.parentName || '',
      parentContact: resp.parentContact || '',
      responseType: resp.responseType || '未知',
      leaveReason: resp.leaveReason || '',
      timestamp: resp.timestamp || null,
      source: resp.source || null,
      statusLabel: resp.responseType && statusLabelMap[resp.responseType] ? statusLabelMap[resp.responseType] : (resp.responseType || '未知')
    }));
    
    if (orphanResponses.length > 0) {
      console.log(`⚠️ 發現 ${orphanResponses.length} 筆未匹配到提醒的回應，已記錄於報告中供後續查核`);
    }
    
    const respondedCount = summaryCounts.total - summaryCounts.noResponse;
    const responseRate = summaryCounts.total > 0 ? respondedCount / summaryCounts.total : 0;
    const hasAttentionItems = (summaryCounts.leave + summaryCounts.pending + summaryCounts.noResponse) > 0;
    const isNoCourse = summaryCounts.total === 0;
    
    if (!hasAttentionItems && !isNoCourse) {
      console.log('✅ 所有學生都已確認會出席，將發送全勤報告');
    }
    
    // 建構報告訊息 - 使用 Flex Message
    const groupId = getStaffGroupId();
    console.log(`📤 準備發送統計報告到群組: ${groupId}`);
    
    // 建構 Flex Message
    const summaryRows = [
      { label: '📚 課程堂數', value: summaryCounts.total, color: '#111111' },
      { label: '👥 已回覆', value: respondedCount, color: '#2563eb' },
      { label: '✅ 已確認出席', value: summaryCounts.attend, color: '#10b981' },
      { label: '⏳ 待確認', value: summaryCounts.pending, color: '#f59e0b' },
      { label: '❔ 未回應', value: summaryCounts.noResponse, color: '#6b7280' },
      { label: '🏥 請假', value: summaryCounts.leave, color: '#ef4444' }
    ];
    
    const summaryBoxContents = summaryRows.map((row, index) => ({
      type: 'box',
      layout: 'horizontal',
      contents: [
        {
          type: 'text',
          text: row.label,
          size: 'sm',
          color: row.color,
          flex: 0
        },
        {
          type: 'text',
          text: String(row.value),
          size: 'sm',
          color: row.color,
          align: 'end',
          weight: 'bold'
        }
      ],
      margin: index === 0 ? 'none' : 'md'
    }));
    
    const summaryBox = {
      type: 'box',
      layout: 'vertical',
      contents: summaryBoxContents,
      paddingAll: '13px',
      backgroundColor: '#f3f4f6',
      cornerRadius: '8px'
    };

    const bodyContents = [summaryBox];

    if (responseRate > 0) {
      bodyContents.push(
        {
          type: 'separator',
          margin: 'xl'
        },
        {
          type: 'text',
          text: `📈 回覆率：${(responseRate * 100).toFixed(1)}%`,
          weight: 'bold',
          size: 'sm',
          color: '#1d4ed8',
          margin: 'xl'
        }
      );
    }

    if (categories.pending.length > 0) {
      bodyContents.push(
        {
          type: 'separator',
          margin: 'xl'
        },
        {
          type: 'text',
          text: `⏳ 待確認 (${categories.pending.length})`,
          weight: 'bold',
          size: 'md',
          margin: 'xl',
          color: '#f59e0b'
        },
        ...categories.pending.map((item, index) => ({
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${index + 1}. ${item.studentName}`,
              size: 'sm',
              weight: 'bold',
              color: '#111111'
            },
            {
              type: 'text',
              text: item.courseName || '未命名課程',
              size: 'xs',
              color: '#666666',
              margin: 'xs'
            },
            {
              type: 'text',
              text: `⏰ ${item.courseTime || '未提供'} | 待確認`,
              size: 'xs',
              color: '#999999',
              margin: 'xs'
            }
          ],
          margin: 'md',
          paddingAll: '10px',
          backgroundColor: '#fff7ed',
          cornerRadius: '6px'
        }))
      );
    }

    if (categories.noResponse.length > 0) {
      bodyContents.push(
        {
          type: 'separator',
          margin: 'xl'
        },
        {
          type: 'text',
          text: `❔ 未回應 (${categories.noResponse.length})`,
          weight: 'bold',
          size: 'md',
          margin: 'xl',
          color: '#6b7280'
        },
        ...categories.noResponse.map((item, index) => ({
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${index + 1}. ${item.studentName}`,
              size: 'sm',
              weight: 'bold',
              color: '#111111'
            },
            {
              type: 'text',
              text: item.courseName || '未命名課程',
              size: 'xs',
              color: '#666666',
              margin: 'xs'
            },
            {
              type: 'text',
              text: `⏰ ${item.courseTime || '未提供'} | 未回應`,
              size: 'xs',
              color: '#9ca3af',
              margin: 'xs'
            }
          ],
          margin: 'md',
          paddingAll: '10px',
          backgroundColor: '#f9fafb',
          cornerRadius: '6px'
        }))
      );
    }

    if (categories.leave.length > 0) {
      bodyContents.push(
        {
          type: 'separator',
          margin: 'xl'
        },
        {
          type: 'text',
          text: `🏥 請假名單 (${categories.leave.length})`,
          weight: 'bold',
          size: 'md',
          margin: 'xl',
          color: '#ef4444'
        },
        ...categories.leave.map((item, index) => ({
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: `${index + 1}. ${item.studentName}`,
              size: 'sm',
              weight: 'bold',
              color: '#111111'
            },
            {
              type: 'text',
              text: item.courseName || '未命名課程',
              size: 'xs',
              color: '#666666',
              margin: 'xs'
            },
            {
              type: 'text',
              text: `⏰ ${item.courseTime || '未提供'} | 請假`,
              size: 'xs',
              color: '#f87171',
              margin: 'xs'
            }
          ],
          margin: 'md',
          paddingAll: '10px',
          backgroundColor: '#fef2f2',
          cornerRadius: '6px'
        }))
      );
    }

    const reportTime = new Date().toLocaleString('zh-TW', { 
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    const flexMessage = {
      type: 'bubble',
      size: 'giga',  // ✅ 改為最大尺寸（全幅）
      header: {
        type: 'box',
        layout: 'horizontal',  // ✅ 改為水平佈局以容納 logo
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '📊 每日出缺席統計',
                weight: 'bold',
                size: 'xl',
                color: '#FFFFFF'
              },
              {
                type: 'text',
                text: today,
                size: 'sm',
                color: '#FFFFFFCC',
                margin: 'md'
              }
            ],
            flex: 1
          },
          {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'image',
                url: 'https://calendar.funlearnbar.synology.me/logo.jpg',  // ✅ Logo 圖片
                size: 'xxs',
                aspectMode: 'cover',
                aspectRatio: '1:1',
                gravity: 'top',
                flex: 0
              }
            ],
            width: '60px',
            height: '60px',
            justifyContent: 'center',
            alignItems: 'center'
          }
        ],
        backgroundColor: '#4f46e5',
        paddingAll: '20px',
        spacing: 'md'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: bodyContents
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: `⏰ ${reportTime}`,
            size: 'xxs',
            color: '#999999',
            align: 'center'
          },
          {
            type: 'text',
            text: '💡 已確認出席的學生不在此列表',
            size: 'xxs',
            color: '#999999',
            align: 'center',
            margin: 'xs'
          }
        ],
        paddingAll: '13px'
      }
    };
    
    // 發送 Flex Message
    const altText = isNoCourse
      ? `📊 每日出缺席統計 (${today}) - 今日沒有排程課程`
      : hasAttentionItems
        ? `📊 每日出缺席統計 (${today}) - 總${summaryCounts.total}堂，已回覆${respondedCount}，待確認${summaryCounts.pending}，未回應${summaryCounts.noResponse}，請假${summaryCounts.leave}`
        : `✅ 全勤提醒 (${today}) - ${summaryCounts.total} 堂課皆已確認出席`;
    
    // 視需要發送 Flex
    let deliveryResult = { success: false, error: null };
    if (sendFlex) {
      const sendOptions = { flexMessage, altText };
      const result = await notificationManager.sendLineMessage(groupId, '', sendOptions);
      deliveryResult = { success: !!result.success, error: result.success ? null : (result.error || 'unknown') };
      if (deliveryResult.success) {
        console.log('✅ 每日出缺席統計報告發送成功');
      } else {
        console.error('❌ 每日出缺席統計報告發送失敗:', deliveryResult.error);
      }
    }

    const record = {
      date: today,
      generatedAt,
      source,
      summary: {
        total: summaryCounts.total,
        responded: respondedCount,
        attend: summaryCounts.attend,
        pending: summaryCounts.pending,
        noResponse: summaryCounts.noResponse,
        leave: summaryCounts.leave,
        responseRate
      },
      categories,
      orphanResponses,
      remindersProcessed: todayReminders.length,
      responsesProcessed: responses.length,
      delivery: {
        success: deliveryResult.success,
        hasAttention: hasAttentionItems,
        isNoCourse,
        altText,
        error: deliveryResult.success ? null : deliveryResult.error || null
      },
      meta: {
        source,
        baselineMissing: summaryCounts.total === 0 && responses.length > 0,
        orphanResponseCount: orphanResponses.length
      }
    };
    
    if (persistCache) {
      await saveDailyAttendanceReport(record);
    }
    
    return record;
    
  } catch (error) {
    console.error('❌ 生成每日出缺席統計報告失敗:', error);
    throw error;
  }
}

// 舊介面：保留供排程與手動觸發呼叫（預設今日）
async function generateDailyAttendanceReport(options = {}) {
  const { source = 'scheduler' } = options || {};
  // 防重複（僅排程）
  if (source === 'scheduler') {
    const existingReports = safeFile.readJSONSync(DAILY_ATTENDANCE_REPORTS_PATH, { reports: [] });
    const today = reminderScheduler.getTaiwanDateString();
    const todayReport = existingReports.reports?.find(r => r.date === today && r.delivery?.success);
    if (todayReport) {
      const sentTime = new Date(todayReport.generatedAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      console.log(`⚠️ 今日統計報告已發送過 (${sentTime})，跳過重複發送`);
      console.log(`   報告來源: ${todayReport.source || 'unknown'}`);
      return;
    }
  }
  const today = reminderScheduler.getTaiwanDateString();
  await computeDailyAttendanceSummaryForDate(today, { source, sendFlex: true, persistCache: true });
}

/**
 * 清理過期的學生回應記錄
 * 保留當天及未來 7 天的回應，刪除更早的記錄
 */
async function cleanupOldStudentResponses() {
  try {
    console.log('🧹 開始清理過期學生回應記錄...');
    
    const studentResponsesPath = path.join(__dirname, 'data', 'student-responses.json');
    if (!fs.existsSync(studentResponsesPath)) {
      console.log('⚠️ 找不到學生回應檔案，跳過清理');
      return;
    }
    
    // 讀取現有資料
    const responsesData = JSON.parse(fs.readFileSync(studentResponsesPath, 'utf8'));
    const responses = responsesData.responses || [];
    const originalCount = responses.length;
    
    // 計算保留日期範圍（預設保留過去 365 天、未來 30 天）
    // ✅ 統一使用 reminderScheduler 的時間方法
    const today = reminderScheduler.getTaiwanTime();
    const pastRetentionDays = 365;
    const futureRetentionDays = 30;
    const pastCutoff = new Date(today.getTime() - pastRetentionDays * 24 * 60 * 60 * 1000);
    const futureCutoff = new Date(today.getTime() + futureRetentionDays * 24 * 60 * 60 * 1000);
    
    const pastCutoffStr = pastCutoff.toISOString().split('T')[0];
    const futureCutoffStr = futureCutoff.toISOString().split('T')[0];
    
    console.log(`📅 保留日期範圍: ${pastCutoffStr} ~ ${futureCutoffStr}（過去 ${pastRetentionDays} 天 / 未來 ${futureRetentionDays} 天）`);
    
    // 過濾：只保留範圍內的回應
    const filteredResponses = responses.filter(r => {
      if (!r.courseDate) return false;  // 移除無日期的記錄
      return r.courseDate >= pastCutoffStr && r.courseDate <= futureCutoffStr;
    });
    
    const removedCount = originalCount - filteredResponses.length;
    
    if (removedCount > 0) {
      // 寫回檔案
      responsesData.responses = filteredResponses;
      fs.writeFileSync(
        studentResponsesPath,
        JSON.stringify(responsesData, null, 2),
        'utf8'
      );
      console.log(`✅ 清理完成：移除 ${removedCount} 筆過期記錄，保留 ${filteredResponses.length} 筆`);
    } else {
      console.log(`✅ 無需清理：所有 ${originalCount} 筆記錄都在有效範圍內`);
    }
    
  } catch (error) {
    console.error('❌ 清理過期學生回應記錄失敗:', error);
  }
}

// ⏰ 設定每日統計報告排程（每天早上8點 - 台灣時區）
// 🔒 防重複：僅在生產環境或明確啟用時註冊
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DAILY_REPORT === 'true') {
  schedule.scheduleJob(
    { hour: 8, minute: 0, tz: 'Asia/Taipei' },
    async () => {
      const now = new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
      console.log('⏰ [定時任務] 觸發每日出缺席統計報告 (台灣時間 08:00)');
      console.log(`   當前時間: ${now}`);
      console.log(`   環境: ${process.env.NODE_ENV || 'development'}`);
      
      try {
        await generateDailyAttendanceReport({ source: 'scheduler' });
        console.log('✅ [定時任務] 每日統計報告執行完成');
      } catch (error) {
        console.error('❌ [定時任務] 每日統計報告執行失敗:', error);
      }
    }
  );
  console.log('✅ 每日出缺席統計報告排程已啟動 (每天 08:00 台灣時間)');
} else {
  console.log('⚠️  每日出缺席統計報告排程已禁用（開發環境）');
  console.log('   如需啟用，請設定環境變數 ENABLE_DAILY_REPORT=true');
}

// 19:10 前置健康檢查排程（確保 19:30 前 baseline 存在）
if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DAILY_REPORT === 'true') {
  schedule.scheduleJob(
    { hour: 19, minute: 10, tz: 'Asia/Taipei' },
    async () => {
      try {
        console.log('⏰ [定時任務] 觸發 19:10 前置檢查');
        // 直接呼叫內部處理邏輯
        const taiwanTime = reminderScheduler.getTaiwanTime();
        const tomorrow = new Date(taiwanTime); tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        const remindersData = reminderScheduler.loadReminders();
        const existing = (remindersData.studentReminders || []).filter(r => r.courseDate === tomorrowStr);
        if (existing.length === 0) {
          await reminderScheduler.generateStudentReminders();
        }
        await notificationManager.sendLineMessage(getStaffGroupId(), `🩺 前置檢查自動完成（目標 ${tomorrowStr}）`);
        console.log('✅ [定時任務] 前置檢查完成');
      } catch (e) {
        console.error('❌ [定時任務] 前置檢查失敗:', e);
      }
    }
  );
  console.log('✅ 19:10 前置健康檢查排程已啟動 (台灣時間)');
}

// ⏰ 設定每日清理排程（每天凌晨 0 點 - 台灣時區，錯開其他任務）
schedule.scheduleJob(
  { hour: 0, minute: 0, tz: 'Asia/Taipei' },
  () => {
    console.log('⏰ [定時任務] 觸發清理過期學生回應 (台灣時間 00:00)');
    cleanupOldStudentResponses();
  }
);
console.log('✅ 學生回應自動清理排程已啟動 (每天 00:00 台灣時間，保留過去365天/未來30天)');

// ===== 事件快取管理器 =====
let eventsCache = {
  data: null,
  lastUpdate: null,
  isUpdating: false,
  isReady: false  // 🔥 新增：標記快取是否已就緒
};

// ===== 學生資料快取（5 分鐘） =====
let studentsCache = {
  data: null,
  etag: null,
  lastUpdate: 0
};

function toDateKey(rawDate) {
  if (!rawDate) return '';
  const dt = new Date(rawDate);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().split('T')[0];
}

function findCachedEventByMeta(meta = {}) {
  const eventsList = eventsCache?.data?.events || eventsCache?.data?.data;
  if (!Array.isArray(eventsList) || eventsList.length === 0) {
    return null;
  }

  const normalizedId = (meta.eventId || '').trim();
  if (normalizedId) {
    const matchById = eventsList.find(event => {
      const candidates = [event.id, event.uid, event.evt_id, event._raw?.uid, event._raw?.evt_id];
      return candidates.some(value => value && String(value) === normalizedId);
    });
    if (matchById) {
      return matchById;
    }
  }

  const dateKey = toDateKey(meta.date);
  if (!dateKey) {
    return null;
  }
  const courseNeedle = (meta.courseName || '').toUpperCase();
  if (!courseNeedle) {
    return null;
  }
  return eventsList.find(event => {
    const eventDateKey = toDateKey(event.start);
    if (eventDateKey !== dateKey) return false;
    const title = (event.title || '').toUpperCase();
    return title.includes(courseNeedle);
  }) || null;
}

function deriveCourseCategoryFromTitle(title, fallback) {
  if (fallback && String(fallback).trim()) {
    return String(fallback).trim().toUpperCase();
  }
  if (CourseStudentMatcher && typeof CourseStudentMatcher.extractCourseName === 'function' && title) {
    const extracted = CourseStudentMatcher.extractCourseName(title);
    if (extracted) {
      return extracted;
    }
  }
  const match = (title || '').match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : '';
}

function deriveTopicFromTitle(title = '') {
  if (!title) return '';
  const sanitized = title.replace(/\s+/g, ' ').trim();
  if (!sanitized) return '';
  const separators = ['｜', '|', '－', '—', '–', '-'];
  for (const sep of separators) {
    const idx = sanitized.lastIndexOf(sep);
    if (idx > -1 && idx < sanitized.length - 1) {
      const candidate = sanitized.slice(idx + 1).trim();
      if (candidate && !/^[一二三四五六日]?\s?\d{1,2}:?\d{2}-\d{1,2}:?\d{2}/.test(candidate)) {
        return candidate;
      }
    }
  }
  return '';
}

function sanitizeTopicCandidate(candidate = '') {
  if (!candidate) return '';
  let cleaned = String(candidate)
    .replace(/https?:\/\/[^\s)）]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.includes('（') || cleaned.includes('(')) {
    const idx = Math.min(
      cleaned.indexOf('（') === -1 ? Infinity : cleaned.indexOf('（'),
      cleaned.indexOf('(') === -1 ? Infinity : cleaned.indexOf('(')
    );
    if (idx !== Infinity && idx > 0) {
      cleaned = cleaned.slice(0, idx).trim();
    }
  }
  cleaned = cleaned.replace(/[，、。；;：:]+$/g, '').replace(/^[：:\-]+/g, '').trim();
  return cleaned;
}

function deriveCourseTopicFromEvent(event) {
  if (!event) return '';
  if (event.courseTopic && String(event.courseTopic).trim()) {
    return String(event.courseTopic).trim();
  }
  const description = event.description || '';
  const topicPatterns = [
    /課程主題\s*[：:\-]\s*([^\n\r]+)/i,
    /主題\s*[：:\-]\s*([^\n\r]+)/i,
    /教學主題\s*[：:\-]\s*([^\n\r]+)/i,
    /教案主題\s*[：:\-]\s*([^\n\r]+)/i,
    /教案名稱\s*[：:\-]\s*([^\n\r]+)/i,
    /教案\s*[：:\-]\s*([^\n\r]+)/i
  ];
  for (const pattern of topicPatterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const candidate = sanitizeTopicCandidate(match[1]);
      if (candidate) {
        return candidate;
      }
    }
  }
  return deriveTopicFromTitle(event.title || '');
}

function resolveCourseHistoryMeta(meta = {}) {
  const initialTopic = (meta.courseTopic || '').trim();
  const initialCategory = (meta.courseCategory || '').trim();
  const cachedEvent = findCachedEventByMeta(meta);
  const resolvedCategory = initialCategory || deriveCourseCategoryFromTitle(cachedEvent?.title || meta.courseName, meta.courseType);
  const resolvedTopic = initialTopic || deriveCourseTopicFromEvent(cachedEvent) || deriveTopicFromTitle(meta.courseName || '');
  const resolvedCourseName = (meta.courseDisplayName || '').trim() || (cachedEvent?.title || '').trim() || (meta.courseName || '').trim() || (meta.courseType || '').trim();
  return {
    courseTopic: resolvedTopic,
    courseCategory: resolvedCategory,
    courseName: resolvedCourseName,
    cachedEvent
  };
}

// 定期獲取 CalDAV 事件的函數
async function updateEventsCache() {
  if (eventsCache.isUpdating) {
    console.log('⏳ 事件快取更新中，跳過此次更新');
    return;
  }
  
  try {
    eventsCache.isUpdating = true;
    console.log('🔄 開始更新事件快取...');
    
    if (!caldavClient) {
      console.log('⚠️ CalDAV 客戶端未初始化，跳過更新');
      return;
    }
    
    // 獲取日期範圍（從本週一開始，到未來30天）
    const systemSettings = loadSystemSettings();
    const dateRange = systemSettings.dateRange || {};
    const futureDays = Math.max(1, parseInt(dateRange.futureDays || 30, 10));
    const pastDays = Math.max(0, parseInt(dateRange.pastDays || 7, 10));
    
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - pastDays);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + futureDays);
    
    console.log('📅 日期範圍:', {
      今天: now.toLocaleDateString('zh-TW'),
      起始日期: startDate.toLocaleDateString('zh-TW'),
      結束日期: endDate.toLocaleDateString('zh-TW'),
      pastDays,
      futureDays
    });
    
    const events = await caldavClient.getAllInstructorEvents(startDate, endDate);
    
    // 轉換事件格式
    const formattedEvents = events.map(event => ({
      id: event.uid || event.evt_id || event.id,
      title: event.title || event.summary,
      instructor: event.instructor,
      start: event.start,
      end: event.end,
      type: event.type || 'other',
      description: event.description || '',
      location: event.location || '',
      time: event.time || '',
      lessonUrl: event.lessonUrl || '',
      calendarId: event.calendarId || event.cal_id || event.calendar_id || 'default',  // 🔥 添加 calendarId
      // 🔥 保留 Unix timestamp 用於更新事件
      dtstart: event.dtstart,
      dtend: event.dtend,
      is_all_day: event.is_all_day || event.isAllDay || false
    }));
    
    eventsCache.data = {
      success: true,
      events: formattedEvents,
      data: formattedEvents,
      source: 'caldav-cache',
      type: 'full',
      lastUpdate: new Date().toISOString()
    };
    eventsCache.lastUpdate = Date.now();
    eventsCache.isReady = true;  // 🔥 標記快取已就緒
    
    console.log(`✅ 事件快取更新成功，獲取 ${formattedEvents.length} 個事件`);
    
  } catch (error) {
    console.error('❌ 更新事件快取失敗:', error.message);
  } finally {
    eventsCache.isUpdating = false;
  }
}

// 每10分鐘更新一次快取
setInterval(() => {
  updateEventsCache();
}, 10 * 60 * 1000);

// 🔥 修復：首次快取更新會在 CalDAV 初始化完成後立即執行
// 不再使用延遲機制，確保 Docker 重啟後快速建立快取
console.log('✅ 事件快取管理器已啟動，每10分鐘更新一次（首次在 CalDAV 初始化後立即執行）');
// ===== 事件快取管理器結束 =====

// 中間件設定
app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.line-scdn.net https://liffsdk.line-scdn.net; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; font-src 'self' https://cdnjs.cloudflare.com https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' blob: https://cdnjs.cloudflare.com https://static.line-scdn.net https://liffsdk.line-scdn.net https://api.line.me https://api-data.line.me https://course-viewer.funlearnbar.synology.me https://sheets.googleapis.com; media-src 'self' blob:; frame-src 'self';"
  );
  next();
});

// 🚀 壓縮設定 - 優化大型 HTML 檔案載入速度
app.use(compression({
  level: 6, // ⬆️ 提高壓縮等級（1-9，6 提供更好的壓縮率，適合大型檔案）
  threshold: 1024, // 只壓縮大於 1KB 的回應
  memLevel: 8, // 記憶體等級（1-9，8 提供更好的壓縮效果）
  strategy: 1, // Z_FILTERED 策略，對文字內容壓縮效果更好
  filter: (req, res) => {
    // 對 HTML、CSS、JS、JSON 進行壓縮
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

app.use(cors({
  origin: [
    'https://calendar.funlearnbar.synology.me',
    'http://localhost:5173',  // 開發環境：前端 V2
    'http://localhost:5174'   // 備用端口
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 🔥 特別處理 student_data.json - 禁止快取，確保即時更新
app.get('/student_data.json', (req, res) => {
  console.log('📥 請求 student_data.json (無快取)');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.sendFile(path.join(__dirname, 'public', 'student_data.json'));
});

// 🚀 靜態檔案服務 - 優化快取策略與壓縮
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h', // 預設快取 1 小時
  etag: true, // 啟用 ETag
  lastModified: true, // 啟用 Last-Modified
  setHeaders: (res, filePath) => {
    // 為所有可壓縮檔案添加 Vary 標頭，確保代理伺服器正確處理壓縮版本
    if (filePath.match(/\.(html|css|js|json|svg|xml|txt)$/i)) {
      res.set('Vary', 'Accept-Encoding');
    }
    
    // HTML 檔案：不快取，避免 LIFF 初始化問題
    if (filePath.endsWith('.html')) {
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
      // 提示瀏覽器這是可壓縮的文字內容
      res.set('Content-Type', 'text/html; charset=utf-8');
    }
    // CSS/JS 檔案：極短期快取（1分鐘）+ 必須重新驗證
    // 🔥 避免手機瀏覽器長期緩存舊版本，配合前端版本檢測機制
    else if (filePath.endsWith('.css') || filePath.endsWith('.js')) {
      res.set('Cache-Control', 'public, max-age=60, must-revalidate');
      res.set('Pragma', 'no-cache');
    }
    // 
    else if (filePath.match(/\.(jpg|jpeg|png|gif|svg|woff|woff2|ttf|eot)$/i)) {
      res.set('Cache-Control', 'public, max-age=3600');
    }
    // JSON 
    else if (filePath.endsWith('.json')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    }
  }
}));

// V2 React 
app.use('/frontend-v2', express.static(path.join(__dirname, 'frontend-v2', 'dist')));

// LIFF 
app.get('/', (req, res) => {
  res.redirect('/perfect-calendar-optimized-complete2.html');
});

// LIFF URL 
app.get('/perfect-calendar-optimized-complete2.html/', (req, res) => {
  res.redirect(301, '/perfect-calendar-optimized-complete2.html');
});

// 載入講師資料
let teachers = [];
try {
  const teachersData = fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8');
  teachers = JSON.parse(teachersData);
  console.log('✅ 講師資料載入成功');
} catch (error) {
  console.error('❌ 載入講師資料失敗:', error.message);
}

// CalDAV 客戶端
let caldavClient = null;
let caldavInitialized = false;

// 初始化並登入 CalDAV 客戶端
async function initCalDAVClient() {
  try {
    caldavClient = new SynologyCalendarClientClass(
      process.env.CALDAV_URL || 'https://funlearnbar.synology.me:9102',
      process.env.CALDAV_USERNAME || 'testacount',
      process.env.CALDAV_PASSWORD || 'testacount'
    );
    if (useMockCalDav) {
      console.log('🧪 使用 Mock Synology Calendar 客戶端 (MOCK_CALDAV=1)');
    }
    console.log('✅ Synology Calendar API 客戶端初始化成功');
    
    // 立即登入
    console.log('🔐 正在登入 Synology Calendar...');
    const loginSuccess = await caldavClient.login();
    
    if (loginSuccess) {
      console.log('✅ CalDAV 客戶端登入成功');
      caldavInitialized = true;
    } else {
      console.error('❌ CalDAV 客戶端登入失敗');
      caldavClient = null;
    }
  } catch (error) {
    console.error('❌ CalDAV 客戶端初始化失敗:', error.message);
    caldavClient = null;
  }
}

// ===== 學生資料自動更新管理器 =====

// 抽取的學生資料更新函數
async function updateStudentDataFromGoogleSheets() {
  const settings = loadSystemSettings();
  const syncSettings = settings.studentDataSync || {};
  
  // 檢查是否啟用
  if (!syncSettings.enabled) {
    console.log('⚠️ 學生資料同步功能已停用');
    return { success: false, message: '學生資料同步功能已停用' };
  }
  
  // 檢查是否正在更新中，避免重複請求
  if (memoryDB.get('updating_student_data')) {
    // 🚀 使用智能日誌節流（5秒內只輸出一次）
    logger.throttle('student-data-updating', 'WARN', '⏳ 學生資料正在更新中，跳過此次更新');
    return { success: false, message: '學生資料正在更新中' };
  }
  
  try {
    // 設置更新標記
    memoryDB.set('updating_student_data', true);
    
    if (syncSettings.logUpdates) {
      console.log('🔄 [自動更新] 開始更新學生資料...');
    }
    
    // ⚙️ 為避免寫入快取資料，先清除快取確保拉取最新內容
    try {
      googleSheetsStudents.clearCache();
    } catch (clearError) {
      console.warn('⚠️ 無法清除學生資料快取（忽略）:', clearError.message);
    }
    
    let sheetResult;
    let retryCount = 0;
    const maxRetries = syncSettings.retryMaxAttempts || 3;
    const retryDelay = (syncSettings.retryDelaySeconds || 60) * 1000;
    
    while (retryCount < maxRetries) {
      try {
        if (syncSettings.logUpdates) {
          console.log(`🔄 嘗試透過 Google Sheets API 取得學生資料 (第 ${retryCount + 1} 次)...`);
        }
        sheetResult = await googleSheetsStudents.getAllStudents();
        break;
      } catch (error) {
        retryCount++;
        console.log(`❌ 第 ${retryCount} 次嘗試失敗:`, error.message);
        if (retryCount >= maxRetries) {
          throw error;
        }
        console.log(`⏳ 等待 ${retryDelay/1000} 秒後重試...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    if (sheetResult && sheetResult.success) {
      const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
      const students = Array.isArray(sheetResult.students) ? sheetResult.students : [];
      const studentCount = sheetResult.count || students.length;
      
      if (syncSettings.logUpdates) {
        console.log('📊 從 Google Sheets 獲得的學生數量:', studentCount);
      }
      
      // 🔥 統計 periodParsed 完整度（資料本身已包含，但保留原本的偵錯資訊）
      if (syncSettings.logUpdates && students.length > 0) {
        let parsedCount = 0;
        let parseFailCount = 0;
        students.forEach(student => {
          const parsed = student.periodParsed || parsePeriodString(student.period || '');
          if (parsed && parsed.startTime && parsed.endTime) {
            parsedCount++;
          } else if (student.period) {
            parseFailCount++;
          }
        });
        console.log(`✅ Period 解析統計: 成功 ${parsedCount} / 失敗 ${parseFailCount} / 總計 ${students.length}`);
      }
      
      // 添加更新時間戳記到資料中
      const updatedData = {
        success: true,
        count: studentCount,
        students,
        lastUpdated: new Date().toISOString(),
        updateNote: `// 最後更新時間: ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`
      };
      
      // 直接覆蓋寫入
      fs.writeFileSync(studentDataPath, JSON.stringify(updatedData, null, 2));
      
      // 驗證檔案是否寫入成功
      const fileStats = fs.statSync(studentDataPath);
      
      if (syncSettings.logUpdates) {
        console.log('✅ [自動更新] 學生資料更新成功');
        console.log('📅 檔案修改時間:', fileStats.mtime);
        console.log('📏 檔案大小:', fileStats.size, 'bytes');
        console.log('👥 學生數量:', studentCount);
      }
      
      // 清除更新標記
      memoryDB.delete('updating_student_data');
      
      return {
        success: true,
        message: '學生資料更新成功',
        timestamp: new Date().toISOString(),
        studentCount
      };
    } else {
      console.error('❌ Google Sheets API 回應格式錯誤，實際回應:', sheetResult);
      throw new Error('Google Sheets API 回應格式錯誤。期望 { success: true, students: [...] }');
    }
    
  } catch (error) {
    console.error('❌ [自動更新] 更新學生資料失敗:', error.message);
    
    // 清除更新標記
    memoryDB.delete('updating_student_data');
    
    return {
      success: false,
      message: '更新學生資料失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// 學生資料自動更新排程器
let studentDataSyncSchedule = null;
let studentDataSyncInterval = null;

function startStudentDataAutoSync() {
  const settings = loadSystemSettings();
  const syncSettings = settings.studentDataSync || {};
  
  // 停止現有排程
  if (studentDataSyncSchedule) {
    studentDataSyncSchedule.cancel();
    studentDataSyncSchedule = null;
  }
  if (studentDataSyncInterval) {
    clearInterval(studentDataSyncInterval);
    studentDataSyncInterval = null;
  }
  
  if (!syncSettings.enabled || !syncSettings.autoUpdateEnabled) {
    console.log('ℹ️ 學生資料自動同步已停用');
    return;
  }
  
  // 方案1：每日定時更新
  if (syncSettings.updateTime) {
    const [hour, minute] = syncSettings.updateTime.split(':').map(Number);
    
    // 使用台灣時區的排程設定
    studentDataSyncSchedule = schedule.scheduleJob(
      { hour, minute, tz: 'Asia/Taipei' },
      async () => {
        console.log(`🕐 [排程] 每日定時更新學生資料 (台灣時間 ${syncSettings.updateTime})`);
        await updateStudentDataFromGoogleSheets();
      }
    );
    
    console.log(`✅ 已啟動學生資料每日自動更新 (每天 ${syncSettings.updateTime} 台灣時間)`);
  }
  
  // 方案3：間隔更新（如果設定了間隔時間）
  if (syncSettings.intervalMinutes && syncSettings.intervalMinutes > 0) {
    const intervalMs = syncSettings.intervalMinutes * 60 * 1000;
    
    studentDataSyncInterval = setInterval(async () => {
      console.log(`🕐 [排程] 間隔更新學生資料 (每 ${syncSettings.intervalMinutes} 分鐘)`);
      await updateStudentDataFromGoogleSheets();
    }, intervalMs);
    
    console.log(`✅ 已啟動學生資料間隔自動更新 (每 ${syncSettings.intervalMinutes} 分鐘)`);
  }
}

// ==================== 臨時學生自動清理排程 + 備援機制 ====================

// 🔐 備份目前的臨時學生列表到 backups/temporary-students
async function backupTemporaryStudents(reason = 'manual') {
  try {
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    const exists = fs.existsSync(tempDataPath);
    if (!exists) {
      console.log('⚠️ [臨時學生備份] temporary_students.json 不存在，略過備份');
      return null;
    }

    const tempData = safeFile.readJSONSync(tempDataPath, { students: [] }) || { students: [] };
    const students = Array.isArray(tempData.students) ? tempData.students : [];

    const backupsDir = path.join(__dirname, 'backups', 'temporary-students');
    try {
      await fs.promises.mkdir(backupsDir, { recursive: true });
    } catch (mkdirErr) {
      console.error('❌ [臨時學生備份] 建立備份目錄失敗:', mkdirErr);
      return null;
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const safeReason = typeof reason === 'string' && reason.trim() ? reason.trim().replace(/[^a-zA-Z0-9_-]+/g, '-') : 'manual';
    const fileName = `temporary_students-${stamp}-${safeReason}.json`;
    const backupPath = path.join(backupsDir, fileName);

    await fs.promises.writeFile(backupPath, JSON.stringify({ students }, null, 2), 'utf8');

    console.log(`📝 [臨時學生備份] 已建立備份 (${safeReason})：${backupPath}（${students.length} 筆）`);
    return { fileName, path: backupPath, count: students.length, createdAt: now.toISOString() };
  } catch (error) {
    console.error('❌ [臨時學生備份] 建立備份失敗:', error);
    return null;
  }
}

// 清理過期的臨時學生（會先自動備份一次）
async function cleanupExpiredTemporaryStudents() {
  try {
    // 先做一次自動備份，避免異常情況導致資料全數消失時無法回復
    await backupTemporaryStudents('auto-cleanup');

    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    const tempData = safeFile.readJSONSync(tempDataPath, { students: [] }) || { students: [] };
    const students = Array.isArray(tempData.students) ? tempData.students : [];
    const now = new Date();
    const validStudents = [];
    const expiredStudents = [];
    
    students.forEach(student => {
      if (!student) return;
      const expirySource = student.expiryDate || student.scheduledDate;
      if (!expirySource) {
        validStudents.push(student);
        return;
      }
      const expiry = new Date(`${expirySource}T23:59:59`);
      if (Number.isNaN(expiry.getTime()) || expiry >= now) {
        validStudents.push(student);
      } else {
        expiredStudents.push({ ...student });
      }
    });
    
    if (expiredStudents.length === 0) {
      console.log(`✅ 臨時學生檢查完成：無過期學生，當前 ${validStudents.length} 位`);
      return;
    }
    
    await safeFile.writeJSON(tempDataPath, { students: validStudents });
    
    const archivedStamp = new Date().toISOString();
    const archivedEntries = expiredStudents.map(student => ({
      ...student,
      archivedAt: student.archivedAt || archivedStamp,
      archivedReason: student.archivedReason || 'expired'
    }));
    
    await safeFile.atomicUpdate(
      TEMP_STUDENTS_ARCHIVE_PATH,
      async (archiveData = { students: [] }) => {
        const existing = Array.isArray(archiveData.students) ? archiveData.students : [];
        return {
          ...archiveData,
          students: [...archivedEntries, ...existing]
        };
      },
      { students: [] }
    );
    
    console.log(`🗂️ 已封存 ${archivedEntries.length} 位臨時學生，剩餘 ${validStudents.length} 位`);
  } catch (error) {
    console.error('❌ 清理過期臨時學生失敗:', error);
  }
}

// 啟動臨時學生自動清理排程
function startTemporaryStudentsCleanup() {
  // 🔥 檢查環境變數是否禁用自動清理
  const AUTO_CLEANUP_ENABLED = process.env.AUTO_CLEANUP_TEMP_STUDENTS !== 'false';
  
  if (!AUTO_CLEANUP_ENABLED) {
    console.log('⚠️ 臨時學生自動清理已禁用（環境變數 AUTO_CLEANUP_TEMP_STUDENTS=false）');
    console.log('   如需啟用，請在 .env.nas 中設定 AUTO_CLEANUP_TEMP_STUDENTS=true');
    return;
  }
  
  // ⏰ 每天凌晨1點清理過期的臨時學生（台灣時區，錯開其他任務）
  schedule.scheduleJob(
    { hour: 1, minute: 0, tz: 'Asia/Taipei' },
    async () => {
      console.log('⏰ [定時任務] 開始清理過期的臨時學生... (台灣時間 01:00)');
      await cleanupExpiredTemporaryStudents();
    }
  );
  
  console.log('✅ 已啟動臨時學生自動清理排程（每天凌晨 01:00 台灣時間）');
  console.log('   如需禁用，請在 .env.nas 中設定 AUTO_CLEANUP_TEMP_STUDENTS=false');
}
// 在服務器啟動時初始化
initCalDAVClient()
  .then(() => {
    // CalDAV 初始化完成後，立即執行首次快取更新
    if (caldavInitialized) {
      console.log('🚀 CalDAV 初始化完成，立即執行首次快取更新...');
      updateEventsCache();
    }
    
    // 啟動學生資料自動更新排程
    console.log('🚀 啟動學生資料自動更新排程...');
    startStudentDataAutoSync();
    
    // 啟動臨時學生自動清理排程
    console.log('🚀 啟動臨時學生自動清理排程...');
    startTemporaryStudentsCleanup();
  })
  .catch(err => {
    console.error('❌ CalDAV 初始化錯誤:', err);
  });

// 健康檢查端點
// 🔥 提供 Flex Message 範本給前端
app.get('/api/flex-templates', (req, res) => {
  try {
    const flexTemplates = notificationManager.flexTemplates;
    console.log('🔍 返回 Flex 範本，keys:', Object.keys(flexTemplates || {}));
    console.log('🔍 templates 屬性存在:', !!flexTemplates.templates);
    if (flexTemplates.templates) {
      console.log('🔍 templates keys:', Object.keys(flexTemplates.templates));
    }
    // ✅ 統一回應格式：包裝成 { success: true, data: ... }
    res.json({
      success: true,
      data: flexTemplates || {
        enabled: false,
        templates: {},
        quickReply: {
          enabled: true,
          options: [],
          leaveReasons: []
        },
        carousel: { maxBubbles: 10 }
      }
    });
  } catch (error) {
    console.error('❌ 獲取 Flex 範本失敗:', error);
    res.status(500).json({ success: false, message: '獲取範本失敗', error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cache_age: Date.now(),
    environment: process.env.NODE_ENV || 'development',
    caldav_configured: !!process.env.CALDAV_URL
  });
});

// ==================== 假日資料 API ====================

// 取得所有假日資料
app.get('/api/holidays', (req, res) => {
  try {
    const holidays = holidayManager.getHolidays();
    res.json({
      success: true,
      data: holidays,
      lastSync: holidayManager.lastSyncTime,
      count: holidays.holidays?.length || 0
    });
  } catch (error) {
    console.error('❌ 取得假日資料失敗:', error);
    res.status(500).json({
      success: false,
      error: '取得假日資料失敗',
      message: error.message
    });
  }
});

// 檢查指定日期是否為假日
app.get('/api/holidays/check/:date', (req, res) => {
  try {
    const { date } = req.params;
    const holiday = holidayManager.isHoliday(date);
    
    res.json({
      success: true,
      date: date,
      isHoliday: !!holiday,
      holiday: holiday
    });
  } catch (error) {
    console.error('❌ 檢查假日失敗:', error);
    res.status(500).json({
      success: false,
      error: '檢查假日失敗',
      message: error.message
    });
  }
});

// 取得指定月份的假日
app.get('/api/holidays/:year/:month', (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    
    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({
        success: false,
        error: '無效的年份或月份'
      });
    }
    
    const holidays = holidayManager.getHolidaysInMonth(year, month);
    
    res.json({
      success: true,
      year: year,
      month: month,
      holidays: holidays,
      count: holidays.length
    });
  } catch (error) {
    console.error('❌ 取得月份假日失敗:', error);
    res.status(500).json({
      success: false,
      error: '取得月份假日失敗',
      message: error.message
    });
  }
});

// 手動觸發同步
app.post('/api/holidays/sync', async (req, res) => {
  try {
    console.log('🔄 收到手動同步假日請求');
    const result = await holidayManager.syncHolidays();
    
    res.json({
      success: result.success,
      message: result.success ? '假日資料同步成功' : '假日資料同步失敗',
      ...result
    });
  } catch (error) {
    console.error('❌ 手動同步假日失敗:', error);
    res.status(500).json({
      success: false,
      error: '手動同步假日失敗',
      message: error.message
    });
  }
});

// 取得假日同步狀態
app.get('/api/holidays/status', (req, res) => {
  try {
    const status = holidayManager.getStatus();
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('❌ 取得假日狀態失敗:', error);
    res.status(500).json({
      success: false,
      error: '取得假日狀態失敗',
      message: error.message
    });
  }
});

// ==================== 假日資料 API 結束 ====================

// 獲取系統日誌端點
app.get('/api/logs', (req, res) => {
  try {
    // 獲取真實的排程器狀態和提醒數據
    const remindersData = reminderScheduler.loadReminders();
    const reminders = remindersData.reminders || [];
    const studentReminders = remindersData.studentReminders || [];
    
    // 統計提醒狀態
    const pendingReminders = reminders.filter(r => r.status === 'pending');
    const failedReminders = reminders.filter(r => r.status === 'failed');
    const sentReminders = reminders.filter(r => r.status === 'sent');
    
    // 生成詳細的提醒狀態日誌
    const logs = [];
    
    // 添加系統狀態日誌
    logs.push({
      timestamp: new Date().toISOString(),
      level: 'info',
      message: `排程器正在運行 - 總提醒: ${reminders.length}, 待發送: ${pendingReminders.length}, 已發送: ${sentReminders.length}, 失敗: ${failedReminders.length}`,
      source: 'scheduler'
    });
    
    // 添加失敗提醒的詳細資訊
    if (failedReminders.length > 0) {
      failedReminders.forEach((reminder, index) => {
        logs.push({
          timestamp: new Date(Date.now() - (index + 1) * 60000).toISOString(), // 每分鐘一個
          level: 'error',
          message: `❌ 提醒發送失敗: ${reminder.courseName} (${reminder.teacherName}) - ${reminder.error || '未知錯誤'}`,
          source: 'reminder-send',
          details: {
            reminderId: reminder.id,
            courseName: reminder.courseName,
            teacherName: reminder.teacherName,
            type: reminder.type,
            error: reminder.error,
            scheduledTime: reminder.scheduledTime
          }
        });
      });
    }
    
    // 添加待發送提醒的詳細資訊
    if (pendingReminders.length > 0) {
      // 按類型分組顯示提醒
      const todayReminders = pendingReminders.filter(r => r.type === 'today');
      const tomorrowReminders = pendingReminders.filter(r => r.type === 'tomorrow');
      const beforeClassReminders = pendingReminders.filter(r => r.type === 'before-class');
      
      // 顯示當日提醒
      todayReminders.forEach((reminder, index) => {
        const scheduledTime = new Date(reminder.scheduledTime);
        const now = new Date();
        const timeDiff = Math.floor((scheduledTime - now) / (1000 * 60));
        
        logs.push({
          timestamp: new Date(Date.now() - (index + 1) * 30000).toISOString(),
          level: 'info',
          message: `⏳ 當日提醒: ${reminder.courseName} (${reminder.teacherName}) - ${timeDiff > 0 ? `${timeDiff}分鐘後` : '已到時間'}`,
          source: 'reminder-pending',
          details: {
            reminderId: reminder.id,
            courseName: reminder.courseName,
            teacherName: reminder.teacherName,
            type: reminder.type,
            scheduledTime: reminder.scheduledTime,
            timeDiff: timeDiff
          }
        });
      });
      
      // 顯示隔日提醒
      tomorrowReminders.forEach((reminder, index) => {
        const scheduledTime = new Date(reminder.scheduledTime);
        const now = new Date();
        const timeDiff = Math.floor((scheduledTime - now) / (1000 * 60));
        
        logs.push({
          timestamp: new Date(Date.now() - (index + 1) * 30000).toISOString(),
          level: 'info',
          message: `⏳ 隔日提醒: ${reminder.courseName} (${reminder.teacherName}) - ${timeDiff > 0 ? `${timeDiff}分鐘後` : '已到時間'}`,
          source: 'reminder-pending',
          details: {
            reminderId: reminder.id,
            courseName: reminder.courseName,
            teacherName: reminder.teacherName,
            type: reminder.type,
            scheduledTime: reminder.scheduledTime,
            timeDiff: timeDiff
          }
        });
      });
      
      // 顯示課前提醒
      beforeClassReminders.forEach((reminder, index) => {
        const scheduledTime = new Date(reminder.scheduledTime);
        const now = new Date();
        const timeDiff = Math.floor((scheduledTime - now) / (1000 * 60));
        
        logs.push({
          timestamp: new Date(Date.now() - (index + 1) * 30000).toISOString(),
          level: 'info',
          message: `⏳ 課前提醒: ${reminder.courseName} (${reminder.teacherName}) - ${timeDiff > 0 ? `${timeDiff}分鐘後` : '已到時間'}`,
          source: 'reminder-pending',
          details: {
            reminderId: reminder.id,
            courseName: reminder.courseName,
            teacherName: reminder.teacherName,
            type: reminder.type,
            scheduledTime: reminder.scheduledTime,
            timeDiff: timeDiff
          }
        });
      });
    }
    
    // 添加已發送提醒的詳細資訊
    if (sentReminders.length > 0) {
      sentReminders.slice(0, 3).forEach((reminder, index) => { // 只顯示前3個
        logs.push({
          timestamp: reminder.sentAt || new Date(Date.now() - (index + 1) * 120000).toISOString(),
          level: 'success',
          message: `✅ 提醒發送成功: ${reminder.courseName} (${reminder.teacherName})`,
          source: 'reminder-send',
          details: {
            reminderId: reminder.id,
            courseName: reminder.courseName,
            teacherName: reminder.teacherName,
            type: reminder.type,
            sentAt: reminder.sentAt
          }
        });
      });
    }
    
    // 添加學生提醒狀態
    if (studentReminders.length > 0) {
      const pendingStudentReminders = studentReminders.filter(r => r.status === 'pending');
      const failedStudentReminders = studentReminders.filter(r => r.status === 'failed');
      const sentStudentReminders = studentReminders.filter(r => r.status === 'sent');
      
      logs.push({
        timestamp: new Date(Date.now() - 300000).toISOString(),
        level: 'info',
        message: `👨‍🎓 學生提醒狀態 - 總數: ${studentReminders.length}, 待發送: ${pendingStudentReminders.length}, 已發送: ${sentStudentReminders.length}, 失敗: ${failedStudentReminders.length}`,
        source: 'student-reminders'
      });
      
      // 顯示待發送的學生提醒詳細資訊
      if (pendingStudentReminders.length > 0) {
        pendingStudentReminders.forEach((reminder, index) => {
          const scheduledTime = new Date(reminder.scheduledTime);
          const now = new Date();
          const timeDiff = Math.floor((scheduledTime - now) / (1000 * 60));
          
          logs.push({
            timestamp: new Date(Date.now() - (index + 1) * 30000).toISOString(),
            level: 'info',
            message: `⏳ 學生提醒: ${reminder.courseName} (${reminder.studentName}) - ${timeDiff > 0 ? `${timeDiff}分鐘後` : '已到時間'}`,
            source: 'student-reminder-pending',
            details: {
              reminderId: reminder.id,
              courseName: reminder.courseName,
              studentName: reminder.studentName,
              type: 'student',
              scheduledTime: reminder.scheduledTime,
              timeDiff: timeDiff
            }
          });
        });
      }
      
      // 顯示失敗的學生提醒詳細資訊
      if (failedStudentReminders.length > 0) {
        failedStudentReminders.forEach((reminder, index) => {
          logs.push({
            timestamp: new Date(Date.now() - (index + 1) * 60000).toISOString(),
            level: 'error',
            message: `❌ 學生提醒發送失敗: ${reminder.courseName} (${reminder.studentName}) - ${reminder.error || '未知錯誤'}`,
            source: 'student-reminder-send',
            details: {
              reminderId: reminder.id,
              courseName: reminder.courseName,
              studentName: reminder.studentName,
              type: 'student',
              error: reminder.error,
              scheduledTime: reminder.scheduledTime
            }
          });
        });
      }
      
      // 顯示已發送的學生提醒詳細資訊
      if (sentStudentReminders.length > 0) {
        sentStudentReminders.slice(0, 3).forEach((reminder, index) => {
          logs.push({
            timestamp: reminder.sentAt || new Date(Date.now() - (index + 1) * 120000).toISOString(),
            level: 'success',
            message: `✅ 學生提醒發送成功: ${reminder.courseName} (${reminder.studentName})`,
            source: 'student-reminder-send',
            details: {
              reminderId: reminder.id,
              courseName: reminder.courseName,
              studentName: reminder.studentName,
              type: 'student',
              sentAt: reminder.sentAt
            }
          });
        });
      }
    }
    
    // 添加其他系統日誌
    logs.push(
      {
        timestamp: new Date(Date.now() - 600000).toISOString(),
        level: 'warn',
        message: 'LINE API 達到月限制 (429)',
        source: 'line-api'
      },
      {
        timestamp: new Date(Date.now() - 900000).toISOString(),
        level: 'info',
        message: '從 CalDAV 獲取 155 個事件',
        source: 'caldav'
      },
      {
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        level: 'info',
        message: 'Google Sheets API 更新學生資料成功',
        source: 'google-sheets'
      }
    );
    
    // 按時間排序（最新的在前）
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      data: logs,
      total: logs.length,
      summary: {
        totalReminders: reminders.length,
        pending: pendingReminders.length,
        sent: sentReminders.length,
        failed: failedReminders.length,
        studentReminders: studentReminders.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '獲取日誌失敗',
      error: error.message
    });
  }
});
// 系統時間端點
app.get('/api/system-time', (req, res) => {
  try {
    const now = new Date();
    const utcTime = now.toISOString();
    
    // 計算台灣時間 (UTC+8) - 使用正確的時區轉換
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;
    const hour = parts.find(part => part.type === 'hour').value;
    const minute = parts.find(part => part.type === 'minute').value;
    const second = parts.find(part => part.type === 'second').value;
    
    const taiwanTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`);
    const taiwanTimeStr = taiwanTime.toISOString();
    
    // 計算台灣時間的小時、分鐘、秒
    const taiwanHours = taiwanTime.getHours();
    const taiwanMinutes = taiwanTime.getMinutes();
    const taiwanSeconds = taiwanTime.getSeconds();
    
    // 重新計算台灣時間的ISO字符串
    const taiwanISO = taiwanTime.toISOString();
    
    res.json({
      success: true,
      data: {
        utc: {
          iso: utcTime,
          display: now.getUTCHours().toString().padStart(2, '0') + ':' + 
                  now.getUTCMinutes().toString().padStart(2, '0') + ':' + 
                  now.getUTCSeconds().toString().padStart(2, '0'),
          timestamp: now.getTime()
        },
        taiwan: {
          iso: taiwanISO,
          display: taiwanHours.toString().padStart(2, '0') + ':' + 
                  taiwanMinutes.toString().padStart(2, '0') + ':' + 
                  taiwanSeconds.toString().padStart(2, '0'),
          timestamp: taiwanTime.getTime()
        },
        timezone: {
          offset: 8,
          name: 'Asia/Taipei'
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// GET /api/leave-notification-config - 獲取請假通知配置
app.get('/api/leave-notification-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'data', 'leave-notification-config.json');
    
    if (!fs.existsSync(configPath)) {
      // 預設配置（若檔案不存在）
      const defaultConfig = {
        enabled: true,
        groupId: getStaffGroupId(),
        notifyOn: { attend: false, leave: true, pending: true },
        useFlexMessage: true,
        description: '學生回應自動通知設定'
      };
      return res.json({
        success: true,
        data: defaultConfig,
        message: '使用預設配置'
      });
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    res.json({ success: true, data: config });
  } catch (error) {
    console.error('讀取請假通知配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取請假通知配置失敗: ' + error.message
    });
  }
});

// POST /api/leave-notification-config - 儲存請假通知配置
app.post('/api/leave-notification-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'data', 'leave-notification-config.json');
    const newConfig = req.body || {};
    
    // 基本驗證
    const enabled = !!newConfig.enabled;
    const groupId = typeof newConfig.groupId === 'string' ? newConfig.groupId.trim() : '';
    const notifyOn = newConfig.notifyOn || {};
    const useFlexMessage = newConfig.useFlexMessage !== false;
    
    if (enabled && !groupId) {
      return res.status(400).json({
        success: false,
        message: '啟用通知時必須提供群組 ID'
      });
    }
    
    const atLeastOne = !!(notifyOn.attend || notifyOn.leave || notifyOn.pending);
    if (enabled && !atLeastOne) {
      return res.status(400).json({
        success: false,
        message: '啟用通知時至少需要選擇一種通知條件'
      });
    }
    
    const finalConfig = {
      enabled,
      groupId,
      notifyOn: {
        attend: !!notifyOn.attend,
        leave: notifyOn.leave !== false,   // 預設 true
        pending: notifyOn.pending !== false // 預設 true
      },
      useFlexMessage,
      description: typeof newConfig.description === 'string' ? newConfig.description : '學生回應自動通知設定'
    };
    
    // 備份舊檔
    if (fs.existsSync(configPath)) {
      const backupPath = path.join(__dirname, 'data', `leave-notification-config.json.backup-${Date.now()}`);
      try { fs.copyFileSync(configPath, backupPath); } catch (_) {}
    }
    
    fs.writeFileSync(configPath, JSON.stringify(finalConfig, null, 2));
    console.log('✅ 請假通知配置已更新:', finalConfig);
    
    res.json({
      success: true,
      message: '請假通知配置已儲存',
      data: finalConfig
    });
  } catch (error) {
    console.error('更新請假通知配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新請假通知配置失敗: ' + error.message
    });
  }
});

// 計時器倒數端點
app.get('/api/timer-countdowns', (req, res) => {
  try {
    const now = new Date();
    
    // 計算台灣時間的小時、分鐘、秒
    const taiwanHours = (now.getUTCHours() + 8) % 24;
    const taiwanMinutes = now.getUTCMinutes();
    const taiwanSeconds = now.getUTCSeconds();
    
    // 獲取系統設定（提前載入）
    const settings = loadSystemSettings() || {};
    
    // 安全處理時區設定（預設 Asia/Taipei, UTC+8）
    const timezone = (settings && settings.timezone) ? settings.timezone : { offset: 8, name: 'Asia/Taipei' };
    const timezoneOffset = (typeof timezone.offset === 'number' && isFinite(timezone.offset)) ? timezone.offset : 8;

    // 獲取學生提醒設定
    const studentReminderSettings = reminderScheduler.getStudentReminderSettings();
    const studentReminderHour = studentReminderSettings?.hour || 19;
    const studentReminderMinute = studentReminderSettings?.minute || 30;
    
    // 計算學生提醒倒數
    // 直接使用UTC時間計算，但考慮台灣時區
    let targetDate = new Date(now);
    targetDate.setUTCHours(studentReminderHour - timezoneOffset, studentReminderMinute, 0, 0); // 台灣時間轉UTC
    
    // 如果今天的學生提醒時間已過，計算明天的
    if (taiwanHours > studentReminderHour || (taiwanHours === studentReminderHour && taiwanMinutes >= studentReminderMinute)) {
      targetDate.setUTCDate(targetDate.getUTCDate() + 1);
    }
    
    const studentReminderDiff = targetDate.getTime() - now.getTime();
    const studentReminderHours = Math.floor(studentReminderDiff / (1000 * 60 * 60));
    const studentReminderMinutes = Math.floor((studentReminderDiff % (1000 * 60 * 60)) / (1000 * 60));
    const studentReminderSeconds = Math.floor((studentReminderDiff % (1000 * 60)) / 1000);
    
    // 計算排程檢查倒數（每5分鐘）
    const nextCheck = new Date(now);
    const currentMinute = taiwanMinutes;
    const nextCheckMinute = Math.ceil(currentMinute / 5) * 5;
    
    if (nextCheckMinute >= 60) {
      nextCheck.setUTCHours(nextCheck.getUTCHours() + 1);
      nextCheck.setUTCMinutes(0);
    } else {
      nextCheck.setUTCMinutes(nextCheckMinute);
    }
    nextCheck.setUTCSeconds(0);
    nextCheck.setUTCMilliseconds(0);
    
    const schedulerCheckDiff = nextCheck.getTime() - now.getTime();
    const schedulerCheckMinutes = Math.floor(schedulerCheckDiff / (1000 * 60));
    const schedulerCheckSeconds = Math.floor((schedulerCheckDiff % (1000 * 60)) / 1000);
    
    // 安全地獲取提醒設定，提供預設值
    const reminders = (settings && settings.reminders) || {
      todayReminderHour: 8,
      todayReminderMinute: 0,
      tomorrowReminderHour: 19,
      tomorrowReminderMinute: 30,
      beforeClassMinutes: 30
    };
    
    const todayReminderTime = `${(reminders.todayReminderHour || 8).toString().padStart(2, '0')}:${(reminders.todayReminderMinute || 0).toString().padStart(2, '0')}`;
    const tomorrowReminderTime = `${(reminders.tomorrowReminderHour || 19).toString().padStart(2, '0')}:${(reminders.tomorrowReminderMinute || 30).toString().padStart(2, '0')}`;
    const beforeClassMinutes = reminders.beforeClassMinutes || 30;
    
    // 解析時間
    const [todayHour, todayMinute] = todayReminderTime.split(':').map(Number);
    const [tomorrowHour, tomorrowMinute] = tomorrowReminderTime.split(':').map(Number);
    
    // 計算當日提醒倒數（今天08:00）
    let todayTarget = new Date(now);
    todayTarget.setUTCHours(todayHour - timezoneOffset, todayMinute, 0, 0); // 台灣時間轉UTC
    if (taiwanHours > todayHour || (taiwanHours === todayHour && taiwanMinutes >= todayMinute)) {
      todayTarget.setUTCDate(todayTarget.getUTCDate() + 1);
    }
    const todayReminderDiff = todayTarget.getTime() - now.getTime();
    const todayReminderHours = Math.floor(todayReminderDiff / (1000 * 60 * 60));
    const todayReminderMinutes = Math.floor((todayReminderDiff % (1000 * 60 * 60)) / (1000 * 60));
    const todayReminderSeconds = Math.floor((todayReminderDiff % (1000 * 60)) / 1000);
    
    // 計算隔日提醒倒數（今天19:30）
    let tomorrowTarget = new Date(now);
    tomorrowTarget.setUTCHours(tomorrowHour - timezoneOffset, tomorrowMinute, 0, 0); // 台灣時間轉UTC
    if (taiwanHours > tomorrowHour || (taiwanHours === tomorrowHour && taiwanMinutes >= tomorrowMinute)) {
      tomorrowTarget.setUTCDate(tomorrowTarget.getUTCDate() + 1);
    }
    const tomorrowReminderDiff = tomorrowTarget.getTime() - now.getTime();
    const tomorrowReminderHours = Math.floor(tomorrowReminderDiff / (1000 * 60 * 60));
    const tomorrowReminderMinutes = Math.floor((tomorrowReminderDiff % (1000 * 60 * 60)) / (1000 * 60));
    const tomorrowReminderSeconds = Math.floor((tomorrowReminderDiff % (1000 * 60)) / 1000);
    
    // 計算課前提醒倒數（找到最近的課前提醒）
    let beforeClassReminderDiff = 0;
    let beforeClassNextTime = '暫無';
    
    try {
      const remindersData = loadReminders();
      const reminders = remindersData.reminders || [];
      const today = new Date(now.getTime() + (8 * 60 * 60 * 1000)).toISOString().split('T')[0];
      
      const beforeClassReminders = reminders.filter(r => 
        r.type === 'before-class' && 
        r.courseDate === today
      );
      
      if (beforeClassReminders.length > 0) {
        let nearestTime = null;
        beforeClassReminders.forEach(reminder => {
          try {
            // 正確解析台灣時間並轉換為 UTC
            const [year, month, day] = reminder.courseDate.split('-').map(Number);
            const [hour, minute] = reminder.courseTime.split(':').map(Number);
            
            // 創建台灣時間的課程時間
            const courseTimeTaiwan = new Date(year, month - 1, day, hour, minute, 0);
            
            // 轉換為 UTC 時間
            const courseTimeUTC = new Date(courseTimeTaiwan.getTime() - (8 * 60 * 60 * 1000));
            
            // 計算課前提醒時間（提前指定分鐘）
            const beforeClassTime = new Date(courseTimeUTC.getTime() - (beforeClassMinutes * 60 * 1000));
            
            // 只考慮未來的課前提醒時間，且課程還沒開始
            if (beforeClassTime > now && courseTimeUTC > now && (!nearestTime || beforeClassTime < nearestTime)) {
              nearestTime = beforeClassTime;
            }
          } catch (error) {
            console.error('解析課前提醒時間失敗:', error);
          }
        });
        
        if (nearestTime) {
          beforeClassReminderDiff = nearestTime.getTime() - now.getTime();
          beforeClassNextTime = nearestTime.toLocaleString('zh-TW');
        }
      }
    } catch (error) {
      console.error('計算課前提醒倒數失敗:', error);
    }
    
    const beforeClassHours = Math.floor(beforeClassReminderDiff / (1000 * 60 * 60));
    const beforeClassMinutesCalc = Math.floor((beforeClassReminderDiff % (1000 * 60 * 60)) / (1000 * 60));
    const beforeClassSeconds = Math.floor((beforeClassReminderDiff % (1000 * 60)) / 1000);
    
    
    res.json({
      success: true,
      data: {
        studentReminder: {
          hours: studentReminderHours,
          minutes: studentReminderMinutes,
          seconds: studentReminderSeconds,
          display: `${studentReminderHours}小時${studentReminderMinutes}分鐘${studentReminderSeconds}秒`,
          diff: studentReminderDiff,
          nextTime: new Date(now.getTime() + studentReminderDiff).toLocaleString('zh-TW')
        },
        schedulerCheck: {
          minutes: schedulerCheckMinutes,
          seconds: schedulerCheckSeconds,
          display: `${schedulerCheckMinutes}分鐘${schedulerCheckSeconds}秒`
        },
        todayReminder: {
          hours: todayReminderHours,
          minutes: todayReminderMinutes,
          seconds: todayReminderSeconds,
          display: `${todayReminderHours}小時${todayReminderMinutes}分鐘${todayReminderSeconds}秒`,
          diff: todayReminderDiff,
          nextTime: new Date(now.getTime() + todayReminderDiff).toLocaleString('zh-TW')
        },
        tomorrowReminder: {
          hours: tomorrowReminderHours,
          minutes: tomorrowReminderMinutes,
          seconds: tomorrowReminderSeconds,
          display: `${tomorrowReminderHours}小時${tomorrowReminderMinutes}分鐘${tomorrowReminderSeconds}秒`,
          diff: tomorrowReminderDiff,
          nextTime: new Date(now.getTime() + tomorrowReminderDiff).toLocaleString('zh-TW')
        },
        beforeClassReminder: {
          hours: beforeClassHours,
          minutes: beforeClassMinutesCalc,
          seconds: beforeClassSeconds,
          display: beforeClassReminderDiff > 0 ? `${beforeClassHours}小時${beforeClassMinutesCalc}分鐘${beforeClassSeconds}秒` : '暫無',
          diff: beforeClassReminderDiff,
          nextTime: beforeClassNextTime
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});
// 獲取行事曆事件 API
app.get('/api/events', async (req, res) => {
  try {
    // 檢查是否要求強制刷新（忽略快取）
    const forceRefresh = req.headers['x-force-refresh'] === 'true';
    
    // 優先使用快取的資料（如果快取存在且未過期，且非強制刷新）
    const cacheAge = eventsCache.lastUpdate ? (Date.now() - eventsCache.lastUpdate) / 1000 : Infinity;
    const cacheMaxAge = 600; // 10分鐘
    
    if (eventsCache.data && cacheAge < cacheMaxAge && !forceRefresh) {
      // 🔥 使用節流機制，避免日誌洗版（60秒內只輸出一次快取使用訊息）
      const lastCacheLogTime = memoryDB.get('events_cache_log_time') || 0;
      const now = Date.now();
      if (now - lastCacheLogTime > 60000) { // 60秒
        console.log(`📦 使用快取的事件資料（快取年齡: ${Math.floor(cacheAge)}秒）`);
        memoryDB.set('events_cache_log_time', now);
      }
      return res.json({
        ...eventsCache.data,
        cached: true,
        cacheAge: Math.floor(cacheAge)
      });
    }
    
    // 🔥 修復：如果快取正在建立中，等待快取完成（而不是自己再抓一次）
    if (eventsCache.isUpdating && !forceRefresh) {
      // 🔥 使用節流機制，避免日誌洗版
      const lastBuildingLogTime = memoryDB.get('events_building_log_time') || 0;
      const now = Date.now();
      if (now - lastBuildingLogTime > 30000) { // 30秒
        console.log('⏳ 快取正在建立中，等待快取完成...');
        memoryDB.set('events_building_log_time', now);
      }
      
      // 最多等待 30 秒
      const maxWaitTime = 30000; // 30秒
      const startTime = Date.now();
      
      while (eventsCache.isUpdating && (Date.now() - startTime) < maxWaitTime) {
        await new Promise(resolve => setTimeout(resolve, 100)); // 每 100ms 檢查一次
      }
      
      // 如果等待後快取已建立，直接回傳
      if (eventsCache.data) {
        const finalCacheAge = eventsCache.lastUpdate ? (Date.now() - eventsCache.lastUpdate) / 1000 : 0;
        console.log(`✅ 快取建立完成，使用快取資料（等待時間: ${Math.floor((Date.now() - startTime) / 1000)}秒）`);
        return res.json({
          ...eventsCache.data,
          cached: true,
          cacheAge: Math.floor(finalCacheAge),
          waited: true,
          waitTime: Date.now() - startTime
        });
      }
      
      console.log('⚠️ 等待逾時或快取建立失敗，改為即時獲取');
    }
    
    // 如果快取不存在或已過期，或要求強制刷新，則即時獲取
    if (forceRefresh) {
      console.log('🔄 收到強制刷新請求，忽略快取，直接從 CalDAV 獲取事件...');
    } else if (!eventsCache.data) {
      console.log('⚠️ 快取不存在，即時從 CalDAV 獲取事件...');
    } else {
      console.log('⚠️ 快取已過期，即時從 CalDAV 獲取事件...');
    }
    
    if (!caldavClient) {
      console.log('CalDAV 客戶端未初始化，使用模擬數據');
      return res.json({
        success: true,
        events: [],
        data: [],
        source: 'mock'
      });
    }

    // 獲取日期範圍（從本週一開始，到未來30天）
    const systemSettings = loadSystemSettings();
    const dateRange = systemSettings.dateRange || {};
    const futureDays = Math.max(1, parseInt(dateRange.futureDays || 30, 10));
    const pastDays = Math.max(0, parseInt(dateRange.pastDays || 7, 10));
    
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - pastDays);
    startDate.setHours(0, 0, 0, 0);
    
    const endDate = new Date(now);
    endDate.setDate(now.getDate() + futureDays);

    console.log('📅 正在即時從 CalDAV 獲取事件...');
    console.log('📅 日期範圍:', {
      今天: now.toLocaleDateString('zh-TW'),
      起始日期: startDate.toLocaleDateString('zh-TW'),
      結束日期: endDate.toLocaleDateString('zh-TW'),
      pastDays,
      futureDays
    });
    const events = await caldavClient.getAllInstructorEvents(startDate, endDate);
    
    // 調試：顯示原始事件的前幾個和時間範圍
    if (events.length > 0) {
      console.log('\n🔍 調試 - 獲取到 ' + events.length + ' 個事件');
      console.log('🔍 調試 - 原始事件範例 (前3個):');
      events.slice(0, 3).forEach((event, i) => {
        console.log(`事件 ${i + 1}:`, {
          uid: event.uid,
          evt_id: event.evt_id,
          id: event.id,
          title: event.title,
          summary: event.summary,
          instructor: event.instructor,
          start: event.start,
          startDate: new Date(event.start).toLocaleDateString('zh-TW')
        });
      });
      
      // 統計本週的事件數量
      const weekStart = new Date(startDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);
      
      const weekEvents = events.filter(event => {
        const eventDate = new Date(event.start);
        return eventDate >= weekStart && eventDate <= weekEnd;
      });
      
      console.log('📊 本週事件統計:', {
        本週範圍: `${weekStart.toLocaleDateString('zh-TW')} - ${weekEnd.toLocaleDateString('zh-TW')}`,
        本週事件數: weekEvents.length,
        總事件數: events.length
      });
    }
    
    // 轉換事件格式以符合前端需求
    const formattedEvents = events.map(event => ({
      id: event.uid || event.evt_id || event.id,  // 使用 uid 作為主要 ID
      title: event.title || event.summary,
      instructor: event.instructor,
      start: event.start,
      end: event.end,
      type: event.type || 'other',
      description: event.description || '',
      location: event.location || '',
      time: event.time || '',
      lessonUrl: event.lessonUrl || '',
      calendarId: event.calendarId || event.cal_id || event.calendar_id || 'default',  // 🔥 添加 calendarId 到頂層
      // 🔥 保留 Unix timestamp 用於更新事件
      dtstart: event.dtstart,
      dtend: event.dtend,
      is_all_day: event.is_all_day || event.isAllDay || false,
      // 保留原始欄位以便除錯
      _raw: {
        uid: event.uid,
        evt_id: event.evt_id,
        calendarId: event.calendarId
      }
    }));

    // 調試：顯示格式化後的事件
    if (formattedEvents.length > 0) {
      console.log('\n🔍 調試 - 格式化後的事件 (前3個):');
      formattedEvents.slice(0, 3).forEach((event, i) => {
        console.log(`事件 ${i + 1}:`, {
          id: event.id,
          title: event.title,
          instructor: event.instructor,
          start: event.start
        });
      });
    }

    console.log(`\n✅ 成功即時獲取 ${formattedEvents.length} 個事件`);
    
    // 更新快取
    eventsCache.data = {
      success: true,
      events: formattedEvents,
      data: formattedEvents,
      source: 'caldav',
      type: 'full',
      lastUpdate: new Date().toISOString()
    };
    eventsCache.lastUpdate = Date.now();
    console.log('📦 已更新事件快取');
    
    res.json({
      success: true,
      events: formattedEvents,  // 改為 events 以符合前端期望
      data: formattedEvents,     // 保留 data 以便向後兼容
      source: 'caldav-realtime',
      type: 'full',
      cached: false
    });
  } catch (error) {
    console.error('獲取行事曆事件失敗:', error.message);
    console.log('回退到模擬數據');
    
    // 如果 CalDAV 失敗，回退到模擬數據
    res.json({
      success: true,
      events: [],
      data: [],
      source: 'mock',
      type: 'full',
      error: error.message
    });
  }
});

// 手動觸發更新事件快取 API
app.post('/api/events/refresh-cache', async (req, res) => {
  try {
    console.log('🔄 收到手動刷新快取請求');
    await updateEventsCache();
    
    res.json({
      success: true,
      message: '事件快取已成功刷新',
      eventCount: eventsCache.data ? eventsCache.data.events.length : 0,
      lastUpdate: eventsCache.data ? eventsCache.data.lastUpdate : null
    });
  } catch (error) {
    console.error('❌ 手動刷新快取失敗:', error.message);
    res.status(500).json({
      success: false,
      message: '刷新快取失敗: ' + error.message
    });
  }
});

// 獲取快取狀態 API
app.get('/api/events/cache-status', (req, res) => {
  const cacheAge = eventsCache.lastUpdate ? Math.floor((Date.now() - eventsCache.lastUpdate) / 1000) : null;
  
  res.json({
    success: true,
    cached: !!eventsCache.data,
    eventCount: eventsCache.data ? eventsCache.data.events.length : 0,
    lastUpdate: eventsCache.data ? eventsCache.data.lastUpdate : null,
    cacheAge: cacheAge,
    cacheAgeMinutes: cacheAge ? Math.floor(cacheAge / 60) : null,
    isUpdating: eventsCache.isUpdating,
    isReady: eventsCache.isReady  // 🔥 新增：快取就緒狀態
  });
});

// ==================== 🔥 特殊事件標記 API ====================

// 標記特殊事件
app.post('/api/events/mark-special', async (req, res) => {
  try {
    const {
      eventId,
      specialType,
      specialTypes,
      note,
      newStartTime,
      newEndTime,
      substituteTeacher,
      announcementContent,
      preserveDescription,
      notificationOptions
    } = req.body;
    
    // 🔥 支援多標記：優先使用 specialTypes 陣列，向後相容 specialType
    let markers = [];
    if (specialTypes && Array.isArray(specialTypes) && specialTypes.length > 0) {
      markers = specialTypes;
    } else if (specialType) {
      markers = [specialType];
    }
    
    const preserveOriginalDescription = preserveDescription !== false; // 預設保留原描述
    const normalizedNotificationOptions = sanitizeNotificationOptions(notificationOptions);
    
    console.log('🌟 收到特殊事件標記請求:', { 
      eventId, 
      specialType,
      specialTypes,
      markers, // 🔥 實際使用的標記陣列
      note,
      newStartTime,
      newEndTime,
      substituteTeacher,
      announcementContent,
      preserveOriginalDescription,
      notificationOptions: normalizedNotificationOptions
    });
    
    if (!eventId || markers.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必要參數：eventId 或 specialType/specialTypes'
      });
    }
    
    // 🔥 驗證互斥規則（與前端一致）
    const MUTUALLY_EXCLUSIVE_RULES = {
      '停課': ['體驗', '代課', '改時間'],
      '體驗': ['停課'],
      '代課': ['停課'],
      '改時間': ['停課']
    };
    
    // 檢查標記組合是否違反互斥規則
    for (let i = 0; i < markers.length; i++) {
      const marker = markers[i];
      const mutexTypes = MUTUALLY_EXCLUSIVE_RULES[marker] || [];
      
      for (let j = i + 1; j < markers.length; j++) {
        if (mutexTypes.includes(markers[j])) {
          console.error('❌ 互斥規則驗證失敗:', {
            marker1: marker,
            marker2: markers[j],
            allMarkers: markers
          });
          return res.status(400).json({
            success: false,
            error: `「${marker}」與「${markers[j]}」互斥，不能同時標記`
          });
        }
      }
    }
    console.log('✅ 互斥規則驗證通過:', markers);
    
    // 🔥 驗證改時間必須提供新時間
    if (markers.includes('改時間')) {
      if (!newStartTime || !newEndTime) {
        return res.status(400).json({
          success: false,
          error: '改時間需要提供 newStartTime 和 newEndTime'
        });
      }
      if (newEndTime <= newStartTime) {
        return res.status(400).json({
          success: false,
          error: '結束時間必須晚於開始時間'
        });
      }
    }
    
    // 🔥 驗證代課必須提供代課講師
    if (markers.includes('代課')) {
      // 🔥 修復 1：檢查是否提供代課講師（包括空字串檢查）
      if (!substituteTeacher || substituteTeacher.trim() === '') {
        return res.status(400).json({
          success: false,
          error: '代課需要提供代課講師'
        });
      }
      
      // 🔥 修復 2：檢查代課講師是否為原講師（必須先取得事件才能驗證，所以這部分會在事件查找後檢查）
      // 註：此驗證將在找到事件後進行（第 4584 行之後）
    }
    
    // 🔥 驗證公告必須提供公告內容
    if (markers.includes('公告')) {
      if (!announcementContent || announcementContent.trim() === '') {
        return res.status(400).json({
          success: false,
          error: '公告需要提供 announcementContent'
        });
      }
    }
    
    // 從快取中找到事件
    // 🔥 修復：支援多種快取結構（events 或 data 欄位）
    const eventsList = eventsCache.data?.events || eventsCache.data?.data || null;
    
    if (!eventsCache.data || !eventsList || !Array.isArray(eventsList) || eventsList.length === 0) {
      console.error('❌ 事件快取未就緒:', {
        hasData: !!eventsCache.data,
        hasEvents: !!(eventsCache.data?.events),
        hasDataArray: !!(eventsCache.data?.data),
        eventsListType: eventsList ? typeof eventsList : 'null',
        eventsListLength: eventsList ? eventsList.length : 0,
        cacheKeys: eventsCache.data ? Object.keys(eventsCache.data) : []
      });
      return res.status(500).json({
        success: false,
        error: '事件快取未就緒，請稍後再試。請重新整理頁面後再試。'
      });
    }
    
    // 🔥 增強事件查找邏輯：支援多種 ID 格式（uid, evt_id, id）
    const event = eventsList.find(e => {
      const matchById = e.id === eventId;
      const matchByUid = e.uid === eventId || (e._raw && e._raw.uid === eventId);
      const matchByEvtId = e.evt_id === eventId || (e._raw && e._raw.evt_id === eventId);
      return matchById || matchByUid || matchByEvtId;
    });
    
    if (!event) {
      console.error('❌ 找不到指定的事件:', {
        eventId: eventId,
        eventIdType: typeof eventId,
        totalEvents: eventsList.length,
        sampleIds: eventsList.slice(0, 5).map(e => ({
          id: e.id,
          uid: e.uid || (e._raw && e._raw.uid),
          evt_id: e.evt_id || (e._raw && e._raw.evt_id),
          title: e.title || e.summary
        })),
        // 🔥 檢查是否有部分匹配的事件（可能是 ID 格式問題）
        partialMatches: eventsList.filter(e => {
          const eId = String(e.id || '');
          const eUid = String(e.uid || e._raw?.uid || '');
          return eId.includes(eventId) || eUid.includes(eventId) || eventId.includes(eId) || eventId.includes(eUid);
        }).slice(0, 3).map(e => ({
          id: e.id,
          uid: e.uid || (e._raw && e._raw.uid),
          title: e.title || e.summary
        }))
      });
      return res.status(404).json({
        success: false,
        error: `找不到指定的事件 (ID: ${eventId})，請重新載入頁面後再試`
      });
    }
    
    console.log('✅ 找到事件:', {
      id: event.id,
      uid: event.uid || (event._raw && event._raw.uid),
      evt_id: event.evt_id || (event._raw && event._raw.evt_id),
      title: event.title,
      calendarId: event.calendarId || event.cal_id,
      instructor: event.instructor
    });
    
    // 🔥 修復 2 實施：檢查代課講師是否為原講師
    if (markers.includes('代課') && substituteTeacher) {
      const originalInstructor = event.instructor;
      if (originalInstructor && substituteTeacher === originalInstructor) {
        console.error('❌ 代課驗證失敗：選擇的代課講師與原講師相同', {
          original: originalInstructor,
          substitute: substituteTeacher,
          eventId: eventId,
          eventTitle: event.title
        });
        return res.status(400).json({
          success: false,
          error: `不能選擇原授課講師「${originalInstructor}」作為代課講師`
        });
      }
      console.log('✅ 代課驗證通過:', {
        original: originalInstructor,
        substitute: substituteTeacher
      });
    }
    
    // 🔥 生成新標題（支援多標記）
    const currentTitle = event.title || '';
    const allSpecialMarkers = ['停課', '體驗', '代課', '改時間', '調課', '延後', '提前', '公告'];
    
    // 🔥 移除標題中的所有現有特殊標記
    let cleanTitle = currentTitle;
    for (const marker of allSpecialMarkers) {
      const markerPatterns = [
        new RegExp(`\\[${marker}\\]\\s*`, 'gi'),
        new RegExp(`\\s*${marker}\\s*`, 'gi')
      ];
      markerPatterns.forEach(pattern => {
        cleanTitle = cleanTitle.replace(pattern, ' ');
      });
    }
    cleanTitle = cleanTitle.replace(/\s{2,}/g, ' ').trim();
    
    // 🔥 生成新標題：多標記格式 [標記1][標記2] 原標題
    // 注意：公告不加入標題，只更新描述
    const titleMarkers = markers.filter(m => m !== '公告');
    let newTitle = currentTitle;
    
    if (titleMarkers.length > 0) {
      // 生成標記前綴：[體驗][改時間]
      const markerPrefix = titleMarkers.map(m => `[${m}]`).join('');
      newTitle = `${markerPrefix} ${cleanTitle}`;
      console.log(`   🏷️ 生成多標記標題: ${newTitle}`);
    } else if (markers.includes('公告') && markers.length === 1) {
      // 如果只有公告標記，不修改標題
      newTitle = currentTitle;
      console.log(`   📢 僅公告標記：不修改標題`);
    } else {
      // 沒有標記，恢復乾淨標題
      newTitle = cleanTitle;
      console.log(`   🧹 移除所有標記：${newTitle}`);
    }
    
    // 🔥 更新描述（支援多標記＆保留原描述）
    const cleanDescriptionMarkers = (desc = '') => {
      let cleaned = desc || '';
      const patterns = [
        /(?:\r?\n)?\s*\[特殊事件備註\][^\r\n]*/gi,
        /(?:\r?\n)?\s*特殊事件備註[^\r\n]*/gi,
        /(?:\r?\n)?\s*\[代課講師\][^\r\n]*/gi,
        /(?:\r?\n)?\s*代課講師[^\r\n]*/gi,
        /(?:\r?\n)?\s*\[公告(?:內容)?\][^\r\n]*/gi,
        /(?:\r?\n)?\s*公告(?:內容)?\s*[：:][^\r\n]*/gi,
        /(?:\r?\n)?\s*公告[^\r\n]*/gi,
        /(?:\r?\n)?\s*備註\s*[：:][^\r\n]*/gi,
        /(?:\r?\n)?\s*\[備註\][^\r\n]*/gi
      ];
      patterns.forEach(p => cleaned = cleaned.replace(p, ''));
      cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
      return cleaned;
    };
    
    const buildNewDescription = (baseDesc = '') => {
      let newDesc = preserveOriginalDescription ? (baseDesc || '') : '';
      newDesc = cleanDescriptionMarkers(newDesc);
      
      const sections = [];
      if (note && note.trim()) {
        sections.push(`[特殊事件備註] ${note.trim()}`);
      }
      if (markers.includes('代課') && substituteTeacher) {
        sections.push(`[代課講師] ${substituteTeacher}`);
      }
      if (markers.includes('公告') && announcementContent) {
        sections.push(`[公告] ${announcementContent.trim()}`);
      }
      
      if (sections.length > 0) {
        newDesc = newDesc.trim();
        newDesc = newDesc ? `${newDesc}\n\n${sections.join('\n\n')}` : sections.join('\n\n');
      }
      
      return newDesc.trim();
    };
    
    // 優先使用事件自身的描述，必要時再用完整事件的描述（需在代課移動時補強）
    let baseDescription = event.description || event._raw?.description || '';
    let newDescription = buildNewDescription(baseDescription);

    if (preserveOriginalDescription && (!baseDescription || baseDescription.trim() === '')) {
      try {
        const fullEvent = await loadFullEventData();
        if (fullEvent?.description) {
          console.log('   💾 補回完整事件描述，避免清空原內容');
          baseDescription = fullEvent.description;
          newDescription = buildNewDescription(baseDescription);
        }
      } catch (fullDescError) {
        console.warn('   ⚠️ 無法補回完整事件描述:', fullDescError.message);
      }
    }
    
    console.log('🔄 更新事件:', {
      舊標題: currentTitle,
      新標題: newTitle,
      標記類型: markers, // 🔥 改為多標記陣列
      備註: note,
      代課講師: substituteTeacher,
      公告內容: announcementContent,
      新開始時間: newStartTime,
      新結束時間: newEndTime
    });
    
    // 調用 Synology Calendar API 更新事件
    let calendarId = event.calendarId || event.cal_id || (event._raw && event._raw.calendarId);
    if (!calendarId) {
      console.error('❌ 事件缺少 calendarId:', {
        eventId: eventId,
        event: {
          id: event.id,
          calendarId: event.calendarId,
          cal_id: event.cal_id,
          _raw: event._raw
        }
      });
      return res.status(500).json({
        success: false,
        error: '事件缺少 calendarId，無法更新事件'
      });
    }
    
    // 🔥 修正 calendarId 格式（必須以 / 開頭和結尾，符合 Synology Calendar API 要求）
    const sanitizeCalId = (id) => {
      if (!id) return id;
      let v = String(id);
      if (!v.startsWith('/')) v = '/' + v;
      if (!v.endsWith('/')) v = v + '/';
      return v;
    };
    
    calendarId = sanitizeCalId(calendarId);
    console.log(`   📋 calendarId 格式修正後: ${calendarId}`);
    
    // 🔥 代課功能：需要移動到指定講師的日曆
    // 重要：移動日曆是代課功能的核心需求
    // 但只有在添加標記時才移動，移除標記時不移動
    const eventIcalUid = event.uid || event.ical_uid || (event._raw && event._raw.uid) || eventId;
    let targetCalendarId = calendarId;
    let needMoveCalendar = false;
    let targetCalendar = null;  // 🔥 保存目標日曆對象，供後續使用
    let fullEventData = null;
    let substitutionWarning = null;  // 🔥 記錄代課警告訊息

    const loadFullEventData = async () => {
      if (fullEventData) {
        return fullEventData;
      }
      try {
        console.log(`🔍 需要完整事件描述，使用 ical_uid 重新抓取: ${eventIcalUid}`);
        fullEventData = await caldavClient.getEventByIcalUid(calendarId, eventIcalUid);
        console.log('   ✅ 已抓取完整事件資料供描述使用');
      } catch (fullEventError) {
        console.error('   ⚠️ 取得完整事件描述失敗:', fullEventError.message);
        throw fullEventError;
      }
      return fullEventData;
    };
    
    // 🔥 判斷是否為移除標記操作（markers 為空或不包含實際標記）
    const isRemovingMarker = markers.length === 0 || (markers.length === 1 && markers[0] === '公告');
    
    if (markers.includes('代課') && substituteTeacher && !isRemovingMarker) {
      // 只有當添加標記時才移動日曆
      console.log(`\n🔍 ========== 代課功能：開始尋找目標日曆 ==========`);
      console.log(`   代課講師名稱: "${substituteTeacher}"`);
      console.log(`   原日曆 ID: ${calendarId}`);
      
      try {
        // 獲取所有日曆
        console.log('   步驟 1: 獲取所有日曆列表...');
        const calendars = await caldavClient.getCalendars();
        console.log(`   ✅ 獲取到 ${calendars.length} 個日曆`);
        console.log('   📅 日曆列表:', calendars.map(c => `"${c.displayName}" (${c.id})`).join(', '));
        
        // 🔥 模糊比對：忽略大小寫和空白
        console.log('\n   步驟 2: 執行模糊比對...');
        const normalizeStr = (str) => str.replace(/\s+/g, '').toLowerCase();
        const targetName = normalizeStr(substituteTeacher);
        console.log(`   標準化後的目標名稱: "${targetName}"`);
        
        targetCalendar = calendars.find(cal => {
          const calName = normalizeStr(cal.displayName);
          const isMatch = calName === targetName || 
                         calName.includes(targetName) || 
                         targetName.includes(calName);
          console.log(`   比對 "${cal.displayName}" (標準化: "${calName}") → ${isMatch ? '✅ 匹配' : '❌ 不匹配'}`);
          return isMatch;
        });
        
        console.log('\n   步驟 3: 判斷是否需要移動...');
        // 🔥 重要：確保兩個日曆 ID 都使用相同的格式進行比較
        const normalizedTargetId = sanitizeCalId(targetCalendar?.id || '');
        const normalizedCurrentId = sanitizeCalId(calendarId);
        
        console.log(`   原日曆 ID (標準化): ${normalizedCurrentId}`);
        console.log(`   目標日曆 ID (標準化): ${normalizedTargetId}`);
        
        if (targetCalendar && normalizedTargetId !== normalizedCurrentId) {
          targetCalendarId = normalizedTargetId; // 🔥 使用已標準化的 ID
          needMoveCalendar = true;
          console.log(`   ✅ 找到代課講師日曆: "${targetCalendar.displayName}"`);
          console.log(`   📦 需要移動: ${normalizedCurrentId} → ${normalizedTargetId}`);
          console.log(`   📋 目標日曆 original_cal_id (原始值): ${targetCalendar.originalId || '未提供'}`);
          console.log(`   📋 目標日曆 cal_id: ${normalizedTargetId}`);
          // 🔥 檢查目標日曆權限
          if (targetCalendar.privilege && targetCalendar.privilege.toUpperCase() !== 'RW') {
            console.warn(`   ⚠️ 警告：目標日曆權限為 ${targetCalendar.privilege}（非 RW），可能無法創建事件`);
          } else {
            console.log(`   ✅ 目標日曆權限: ${targetCalendar.privilege || 'RW'}`);
          }
        } else if (targetCalendar && normalizedTargetId === normalizedCurrentId) {
          console.log(`   ⚠️ 代課講師日曆與原日曆相同 (${normalizedCurrentId})，無需移動`);
          needMoveCalendar = false;
        } else {
          console.warn(`   ❌ 找不到「${substituteTeacher}」的日曆`);
          console.warn(`   將使用原日曆: ${normalizedCurrentId}`);
          console.warn(`   ⚠️ 注意：事件將保留在原日曆，但標題會顯示代課資訊`);
          needMoveCalendar = false;
          // 🔥 記錄警告資訊，稍後在回應中告知前端
          substitutionWarning = `找不到講師「${substituteTeacher}」的日曆，事件已標記為代課但保留在原日曆`;
        }
        console.log(`========== 代課功能：目標日曆查找完成 ==========\n`);
      } catch (error) {
        console.error('❌ 獲取日曆列表失敗:', error.message);
        console.error(error.stack);
        console.warn('   將繼續使用原日曆更新事件');
        needMoveCalendar = false;
      }
    } else if (isRemovingMarker) {
      console.log(`\n🔍 ========== 移除標記操作 ==========`);
      console.log(`   ⚠️ 移除標記：不移動日曆，只更新標題和描述`);
      console.log(`========== 移除標記處理完成 ==========\n`);
    }
    
    // 📝 直接傳遞完整的事件資料給更新方法
    console.log('📋 事件完整資料:', {
      id: event.id,
      calendarId: calendarId,
      title: event.title,
      dtstart: event.dtstart,
      dtend: event.dtend,
      is_all_day: event.is_all_day || event.isAllDay,
      location: event.location,
      description: event.description ? event.description.substring(0, 50) + '...' : ''
    });
    
    // 🔍 確保 event 物件有所有必要欄位
    if (!event.dtstart || !event.dtend) {
      console.error('❌ 事件缺少時間戳記欄位');
      return res.status(500).json({
        success: false,
        error: '事件資料不完整，缺少 dtstart 或 dtend'
      });
    }
    
    // 🔥 構建更新資料（根據類型決定要更新的欄位）
    // 注意：部分日曆對可選欄位驗證較嚴格（可能回 9009），
    // 僅在需要變更描述內容時才傳入 description（避免無變更時硬帶入原 description）。
    const updates = {};
    
    // 🔥 若包含非公告標記或需要清除舊標記，才更新標題
    const hasNonAnnouncementMarkers = markers.some(marker => marker !== '公告');
    if (hasNonAnnouncementMarkers || markers.length === 0) {
      updates.title = newTitle;
    }
    
    const hasSubstituteMarker = markers.includes('代課');
    const hasAnnouncementMarker = markers.includes('公告');
    const shouldUpdateDescription = !!note ||
      (hasSubstituteMarker && substituteTeacher) ||
      (hasAnnouncementMarker && announcementContent) ||
      markers.length > 0;
    if (shouldUpdateDescription) {
      updates.description = newDescription;
    }
    
    // 🔥 如果是改時間，需要更新 dtstart 和 dtend
    // ⚠️ 重要：必須在 updates 物件中包含新時間，因為 updateEvent 會先 get 獲取事件，
    // 然後使用 get 回傳的時間。我們需要在 updates 中提供新時間，讓 updateEvent 使用更新值。
    if (markers.includes('改時間')) {
      console.log('⏰ 改時間：更新事件時間');
      console.log(`   原始時間: ${new Date(event.dtstart * 1000).toLocaleString('zh-TW')} - ${new Date(event.dtend * 1000).toLocaleString('zh-TW')}`);
      console.log(`   新時間: ${new Date(newStartTime * 1000).toLocaleString('zh-TW')} - ${new Date(newEndTime * 1000).toLocaleString('zh-TW')}`);
      
      // 🔥 在 updates 物件中包含新時間
      updates.dtstart = newStartTime;
      updates.dtend = newEndTime;
      
      // 同時更新 event 物件的時間（作為備用）
      event.dtstart = newStartTime;
      event.dtend = newEndTime;
      
      console.log(`   ✅ 已將新時間加入 updates 物件:`, {
        dtstart: updates.dtstart,
        dtend: updates.dtend
      });
    }
    
    let updateResult = false;
    
    // 🔥 如果需要移動日曆（代課到不同講師）
    if (needMoveCalendar) {
      console.log('\n📦 ========== 執行日曆移動（創建+刪除策略）==========');
      console.log(`   目標日曆 ID: ${targetCalendarId}`);
      console.log(`   原日曆 ID: ${calendarId}`);
      console.log(`   事件 ID: ${eventId}`);
      
      try {
        // 🔥 重要：Synology Calendar API 不支持使用 set 方法跨日曆移動
        // 必須使用「創建新事件 + 刪除舊事件」的方式
        
        // 步驟 1: 在目標日曆創建新事件
        console.log('\n   步驟 1/2: 在新日曆創建事件...');
        
        // 獲取事件的完整資料
        const fullEvent = await loadFullEventData();
        console.log(`   ✅ 成功獲取完整事件資料`);
        console.log(`   🔍 事件詳細資訊:`);
        console.log(`      evt_id: ${fullEvent.evt_id}`);
        console.log(`      is_repeat_evt: ${fullEvent.is_repeat_evt} (${typeof fullEvent.is_repeat_evt})`);
        console.log(`      repeat_setting: ${JSON.stringify(fullEvent.repeat_setting, null, 2)}`);
        console.log(`      repeat_setting 類型: ${typeof fullEvent.repeat_setting}`);
        console.log(`      repeat_setting 是否為物件: ${typeof fullEvent.repeat_setting === 'object' && fullEvent.repeat_setting !== null}`);
        if (fullEvent.repeat_setting && typeof fullEvent.repeat_setting === 'object') {
            console.log(`      repeat_setting 鍵數量: ${Object.keys(fullEvent.repeat_setting).length}`);
        }
        
        // 準備新事件資料（使用完整事件資料，但標題和描述使用新的）
        // 🔥 確保所有必填欄位都有明確的值
        // 🔥 代課功能：即使原事件是重複的，代課事件只需要單次事件
        // 所以我們將 is_repeat_evt 設為 false，並且明確不傳送 repeat_setting
        console.log(`   🔍 代課事件處理：設為非重複事件（即使原事件是重複的）`);
        console.log(`   🔍 原事件是否為重複事件: ${fullEvent.is_repeat_evt}`);
        if (fullEvent.repeat_setting) {
          console.log(`   ⚠️ 原事件有 repeat_setting，但代課事件不會繼承（將創建為單次事件）`);
        }
        
        // 如果快取內沒有描述但完整事件有描述，補回來以避免代課時清空描述
        if (preserveOriginalDescription && (!baseDescription || baseDescription.trim() === '') && fullEvent.description) {
          console.log('   💾 使用完整事件描述作為基底（避免清空原描述）');
          baseDescription = fullEvent.description;
          newDescription = buildNewDescription(baseDescription);
        }
        
        const newEventData = {
          title: newTitle,
          summary: newTitle,
          description: newDescription.substring(0, 5000),  // 🔥 限制 description 長度（5000 字符），避免 URL 編碼問題
          // 🔥 優先使用 fullEvent 的時間戳記（從 API 獲取的完整資料），確保格式正確
          dtstart: fullEvent.dtstart || event.dtstart,  
          dtend: fullEvent.dtend || event.dtend,      
          is_all_day: fullEvent.is_all_day === true,  // 🔥 明確轉換為 boolean
          isAllDay: fullEvent.is_all_day === true,    // 🔥 同時提供兩種格式
          tz_id: fullEvent.tz_id || 'Asia/Taipei',
          is_repeat_evt: false,  // 🔥 代課事件總是單次事件（不重複）- 強制設為 false
          // 🔥 明確不包含 repeat_setting，確保代課事件為單次事件
          // 即使原事件有 repeat_setting，也不傳遞給代課事件
          // 傳遞其他可能需要的欄位
          color: fullEvent.color || '',
          notify_setting: [],  // 🔥 代課事件使用空陣列（避免格式問題）
          participant: [],  // 🔥 代課事件使用空陣列（避免格式問題）
          // 🔥 如果有 location_info，也要傳遞（原事件可能有位置資訊）
          // 但為了避免格式問題，先測試不傳遞 location_info
          // location_info: fullEvent.location_info || (event.location ? {
          //   address: '',
          //   gps: { lat: -1, lng: -1 },
          //   map_type: '',
          //   name: event.location,
          //   place_id: ''
          // } : null)
        };
        
        // 🔥 清理和驗證 description（移除可能的控制字符）
        if (newEventData.description) {
          newEventData.description = newEventData.description
            .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // 移除控制字符
            .substring(0, 5000); // 限制長度為 5000 字符
        } else {
          // 如果 description 為空，使用標題作為備用
          newEventData.description = newTitle;
        }
        
        // 🔥 如果包含改時間標記，優先採用新時間戳記
        if (markers.includes('改時間') && newStartTime && newEndTime) {
          newEventData.dtstart = Number(newStartTime);
          newEventData.dtend = Number(newEndTime);
        }
        
        // 🔥 驗證時間戳記是否有效
        // 🔥 優先使用 fullEvent 的時間戳記，確保格式正確
        if (!newEventData.dtstart || !newEventData.dtend || 
            isNaN(Number(newEventData.dtstart)) || isNaN(Number(newEventData.dtend))) {
          console.error('   ❌ 時間戳記無效:', {
            dtstart: newEventData.dtstart,
            dtend: newEventData.dtend,
            eventDtstart: event.dtstart,
            eventDtend: event.dtend,
            fullEventDtstart: fullEvent.dtstart,
            fullEventDtend: fullEvent.dtend
          });
          // 🔥 強制使用 fullEvent 的時間戳記
          if (fullEvent.dtstart && fullEvent.dtend) {
            console.log('   🔄 強制使用 fullEvent 的時間戳記');
            newEventData.dtstart = Number(fullEvent.dtstart);
            newEventData.dtend = Number(fullEvent.dtend);
          } else {
            throw new Error('無法獲取有效的事件時間戳記');
          }
        } else {
          // 🔥 確保時間戳記是數字格式
          newEventData.dtstart = Number(newEventData.dtstart);
          newEventData.dtend = Number(newEventData.dtend);
        }
        
        console.log('   🔍 時間戳記驗證:', {
          dtstart: newEventData.dtstart,
          dtend: newEventData.dtend,
          dtstart_date: new Date(newEventData.dtstart * 1000).toLocaleString('zh-TW'),
          dtend_date: new Date(newEventData.dtend * 1000).toLocaleString('zh-TW')
        });
        
        // 🔥 雙重驗證：確保代課事件不會有 repeat_setting
        if (newEventData.repeat_setting !== undefined) {
          console.warn('   ⚠️ 警告：代課事件資料中發現 repeat_setting，將強制移除');
          delete newEventData.repeat_setting;
        }
        
        console.log('   新事件資料:', JSON.stringify({
          title: newEventData.title,
          dtstart: newEventData.dtstart,
          dtend: newEventData.dtend,
          is_all_day: newEventData.is_all_day,
          is_repeat_evt: newEventData.is_repeat_evt,
          has_repeat_setting: false,  // 🔥 確認：代課事件不包含 repeat_setting（單次事件）
          has_location_info: !!newEventData.location_info
        }, null, 2));
        
        // 🔥 創建新事件前的最終驗證
        console.log('\n   🔍 創建事件前的最終驗證:');
        console.log(`      目標日曆 ID (cal_id): ${targetCalendarId}`);
        // 🔥 根據 Synology Calendar API 文檔，original_cal_id 應該是目標日曆的 originalId
        // 但如果目標日曆不是共享日曆，original_cal_id 可能應該等於 cal_id
        // 先嘗試使用目標日曆的 originalId，如果沒有則使用 targetCalendarId
        let targetOriginalCalId = targetCalendar?.originalId;
        // 🔥 重要：如果 originalId 不存在或為空，使用 cal_id（根據 API 文檔，非共享日曆的 original_cal_id 應該等於 cal_id）
        if (!targetOriginalCalId || targetOriginalCalId.trim() === '') {
          targetOriginalCalId = targetCalendarId;
          console.log(`      ⚠️ 目標日曆沒有 originalId，使用 cal_id 作為 original_cal_id`);
        } else {
          // 🔥 確保 originalId 格式正確（以 / 開頭和結尾）
          targetOriginalCalId = sanitizeCalId(targetOriginalCalId);
          console.log(`      ✅ 使用目標日曆的 originalId 作為 original_cal_id`);
        }
        console.log(`      目標日曆 original_cal_id: ${targetOriginalCalId}`);
        console.log(`      原日曆 ID: ${calendarId}`);
        console.log(`      時間戳記: dtstart=${newEventData.dtstart} (${typeof newEventData.dtstart}), dtend=${newEventData.dtend} (${typeof newEventData.dtend})`);
        console.log(`      標題: ${newEventData.title}`);
        console.log(`      描述長度: ${newEventData.description?.length || 0}`);
        console.log(`      是否全天: ${newEventData.is_all_day}`);
        console.log(`      是否重複: ${newEventData.is_repeat_evt}`);
        
        // 🔥 創建新事件（傳入目標日曆的 originalId 用於 original_cal_id）
        // 根據 Synology Calendar API 文檔，original_cal_id 應該是目標日曆的 originalId，而不是原日曆的 ID
        let createResult;
        try {
          createResult = await caldavClient.createEvent(targetCalendarId, newEventData, targetOriginalCalId);
        } catch (createError) {
          console.error('\n❌ 創建事件時發生錯誤:', {
            error: createError.message,
            stack: createError.stack,
            targetCalendarId,
            calendarId,
            eventData: {
              title: newEventData.title,
              dtstart: newEventData.dtstart,
              dtend: newEventData.dtend,
              is_all_day: newEventData.is_all_day
            }
          });
          throw new Error(`創建失敗: ${createError.message}`);
        }
        
        if (!createResult || !createResult.evt_id) {
          console.error('\n❌ 創建事件返回無效結果:', createResult);
          throw new Error('在新日曆創建事件失敗：返回結果無效');
        }
        
        console.log('   ✅ 新事件創建成功，ID:', createResult.evt_id);
        
        // 步驟 2: 刪除原日曆中的事件
        console.log('\n   步驟 2/2: 刪除原日曆事件...');
        
        const deleteResult = await caldavClient.deleteEvent(calendarId, eventIcalUid);
        
        if (deleteResult) {
          console.log('   ✅ 原事件刪除成功');
          console.log('   ========== 日曆移動完成 ==========\n');
          updateResult = true;
        } else {
          console.warn('   ⚠️ 原事件刪除失敗，但新事件已創建');
          console.log('   ========== 日曆移動部分完成 ==========\n');
          updateResult = true;
        }
      } catch (moveError) {
        console.error('\n❌ 移動事件失敗:', moveError.message);
        console.error('   錯誤堆疊:', moveError.stack);
        throw moveError;
      }
    } else {
      console.log('\n📝 在原日曆更新事件（無需移動）');
      console.log(`   日曆 ID: ${calendarId}`);
      console.log(`   事件 ID: ${eventId}`);
      console.log(`   更新內容:`, updates);
      
      try {
        // 🔥 使用正確的事件 ID：優先使用 evt_id，如果沒有則使用 eventId
        // 注意：updateEvent 方法會先使用 ical_uid 或 evt_id 獲取完整事件，然後使用 evt_id 更新
        // 所以我們需要傳遞 ical_uid，如果沒有則傳遞 evt_id
        const actualEventId = event.uid || event.ical_uid || (event._raw && event._raw.uid) || 
                             event.evt_id || (event._raw && event._raw.evt_id) || eventId;
        console.log(`   實際使用的事件 ID: ${actualEventId}`);
        console.log(`   事件 ID 類型: ${typeof actualEventId}`);
        
        updateResult = await caldavClient.updateEvent(calendarId, actualEventId, updates, event);
        if (updateResult) {
          console.log('   ✅ 事件更新成功\n');
        } else {
          console.error('   ❌ 事件更新返回 false');
        }
      } catch (updateError) {
        console.error('❌ 更新事件失敗:', updateError.message);
        console.error('   錯誤堆疊:', updateError.stack);
        console.error('   事件資訊:', {
          calendarId,
          eventId,
          actualEventId: event.uid || event.ical_uid || (event._raw && event._raw.uid) || 
                        event.evt_id || (event._raw && event._raw.evt_id) || eventId,
          updates
        });
        throw updateError; // 重新拋出錯誤，讓上層處理
      }
    }
    
    if (updateResult) {
      // 清除快取以觸發重新載入
      eventsCache.data = null;
      eventsCache.lastUpdate = null;
      
      // 觸發背景更新
      setTimeout(() => updateEventsCache(), 1000);
      
      let successMessage = '';
      const hasMarkers = markers.length > 0;
      const nonAnnouncementMarkers = markers.filter(marker => marker !== '公告');
      const announcementOnly = hasMarkers && nonAnnouncementMarkers.length === 0;
      
      if (!hasMarkers) {
        successMessage = '已更新課程標題';
      } else if (announcementOnly && markers.length === 1) {
        successMessage = '已成功添加公告內容到描述欄位';
      } else {
        const markerLabel = (nonAnnouncementMarkers.length > 0 ? nonAnnouncementMarkers : markers).join(' + ');
        successMessage = `已成功標記為「${markerLabel}」`;
        if (markers.includes('公告')) {
          successMessage += '，公告內容已同步';
        }
      }
      
      if (needMoveCalendar && markers.includes('代課')) {
        successMessage += `，並移動至「${substituteTeacher}」的日曆`;
      }

      let notificationResults = [];
      if (normalizedNotificationOptions.notifyInstructor || normalizedNotificationOptions.notifyStaffGroup) {
        try {
          const notificationTarget = fullEventData || event;
          notificationResults = await dispatchSpecialEventNotifications(
            notificationTarget,
            markers,
            note,
            normalizedNotificationOptions
          );
        } catch (notifyError) {
          console.error('⚠️ 特殊事件通知發送失敗:', notifyError.message);
        }
      }
      
      console.log('✅ 特殊事件標記成功');
      const response = {
        success: true,
        message: successMessage,
        updatedEvent: {
          id: eventId,
          title: newTitle,
          description: newDescription,
          markers: markers
        }
      };
      
      // 🔥 如果有代課警告，加入回應中
      if (substitutionWarning) {
        response.warning = substitutionWarning;
        console.log('⚠️ 回傳警告訊息:', substitutionWarning);
      }
      
      return res.status(200).json(response);
    } else {
      res.status(500).json({
        success: false,
        error: '更新 Synology Calendar 失敗'
      });
    }
    
  } catch (error) {
    console.error('❌ 標記特殊事件失敗:', {
      error: error.message,
      stack: error.stack,
      eventId: req.body.eventId,
      specialType: req.body.specialType,
      substituteTeacher: req.body.substituteTeacher,
      // 🔥 輸出完整的錯誤對象以便診斷
      errorName: error.name,
      errorCode: error.code,
      errorResponse: error.response?.data
    });
    
    // 🔥 根據錯誤類型返回更詳細的錯誤訊息
    let errorMessage = '標記失敗';
    if (error.message) {
      errorMessage += ': ' + error.message;
    }
    
    // 🔥 如果是 Synology API 錯誤，返回更詳細的錯誤訊息
    if (error.response?.data?.error) {
      const apiError = error.response.data.error;
      errorMessage += ` (API 錯誤碼: ${apiError.code})`;
      if (apiError.errors) {
        errorMessage += ` - ${JSON.stringify(apiError.errors)}`;
      }
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
});

// ==================== 特殊事件申請佇列 ====================
app.get('/api/special-events/requests', async (req, res) => {
  try {
    const historyLimit = Math.min(
      SPECIAL_EVENT_HISTORY_LIMIT,
      Math.max(1, Number(req.query.historyLimit) || 30)
    );
    const state = await readSpecialEventRequestsData();
    const payload = buildSpecialEventResponsePayload(state, historyLimit);
    res.json({
      success: true,
      data: payload
    });
  } catch (error) {
    console.error('❌ 讀取特殊事件申請佇列失敗:', error);
    res.status(500).json({
      success: false,
      error: '讀取特殊事件申請失敗',
      message: error.message
    });
  }
});

app.post('/api/special-events/requests', async (req, res) => {
  try {
    const { eventSnapshot, requestPayload, requestedBy, note, tags, metadata } = req.body || {};
    if (!requestPayload || !requestPayload.eventId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要參數：requestPayload.eventId'
      });
    }

    const normalizedPayload = JSON.parse(JSON.stringify(requestPayload));
    normalizedPayload.notificationOptions = sanitizeNotificationOptions(normalizedPayload.notificationOptions);

    const now = new Date().toISOString();
    const queueItem = {
      id: generateSpecialEventRequestId(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      requestedBy: requestedBy || 'admin-dashboard',
      note: typeof note === 'string' ? note.trim() : '',
      tags: Array.isArray(tags) ? tags : (Array.isArray(normalizedPayload.specialTypes) ? normalizedPayload.specialTypes : []),
      metadata: metadata || {},
      eventSnapshot: eventSnapshot || {},
      requestPayload: normalizedPayload,
      history: [
        {
          action: 'queued',
          by: requestedBy || 'admin-dashboard',
          timestamp: now,
          note: ''
        }
      ]
    };

    await safeFile.atomicUpdate(
      SPECIAL_EVENT_REQUESTS_FILE,
      async (current = SPECIAL_EVENT_REQUESTS_DEFAULT) => {
        const nextState = cloneSpecialEventState(current);
        nextState.pending.push(queueItem);
        return nextState;
      },
      SPECIAL_EVENT_REQUESTS_DEFAULT
    );

    res.json({
      success: true,
      data: queueItem
    });
  } catch (error) {
    console.error('❌ 建立特殊事件申請失敗:', error);
    res.status(500).json({
      success: false,
      error: '新增特殊事件申請失敗',
      message: error.message
    });
  }
});

app.patch('/api/special-events/requests/:id', async (req, res) => {
  try {
    const requestId = req.params.id;
    const { status, resolutionNote, processedBy, result } = req.body || {};
    const allowedStatuses = new Set(['pending', 'sent', 'cancelled', 'failed']);

    if (!status || !allowedStatuses.has(status)) {
      return res.status(400).json({
        success: false,
        error: '狀態無效或缺少必要參數'
      });
    }

    const updateActor = processedBy || 'admin-dashboard';
    const updateNote = typeof resolutionNote === 'string' ? resolutionNote : '';

    let updatedState = null;
    await safeFile.atomicUpdate(
      SPECIAL_EVENT_REQUESTS_FILE,
      async (current = SPECIAL_EVENT_REQUESTS_DEFAULT) => {
        const nextState = cloneSpecialEventState(current);
        const index = nextState.pending.findIndex(item => item.id === requestId);
        if (index === -1) {
          throw new Error('REQUEST_NOT_FOUND');
        }

        const record = nextState.pending[index];
        record.updatedAt = new Date().toISOString();
        record.history = Array.isArray(record.history) ? record.history : [];

        if (status === 'pending') {
          if (req.body.note !== undefined) {
            record.note = String(req.body.note);
          }
          if (req.body.requestPayload) {
            record.requestPayload = {
              ...record.requestPayload,
              ...req.body.requestPayload
            };
            if (req.body.requestPayload.notificationOptions) {
              record.requestPayload.notificationOptions = sanitizeNotificationOptions(
                req.body.requestPayload.notificationOptions
              );
            }
          }
          record.history.push({
            action: 'updated',
            by: updateActor,
            timestamp: record.updatedAt,
            note: updateNote
          });
        } else {
          record.status = status;
          record.completedAt = record.updatedAt;
          record.resolutionNote = updateNote;
          record.processedBy = updateActor;
          if (result !== undefined) {
            record.result = result;
          }
          record.history.push({
            action: status,
            by: updateActor,
            timestamp: record.updatedAt,
            note: updateNote
          });
          nextState.pending.splice(index, 1);
          nextState.history.push(record);
          if (nextState.history.length > SPECIAL_EVENT_HISTORY_LIMIT) {
            nextState.history = nextState.history.slice(-SPECIAL_EVENT_HISTORY_LIMIT);
          }
        }

        updatedState = nextState;
        return nextState;
      },
      SPECIAL_EVENT_REQUESTS_DEFAULT
    );

    const payload = buildSpecialEventResponsePayload(updatedState);
    res.json({
      success: true,
      data: payload
    });
  } catch (error) {
    if (error.message === 'REQUEST_NOT_FOUND') {
      return res.status(404).json({
        success: false,
        error: '找不到指定的申請'
      });
    }
    console.error('❌ 更新特殊事件申請失敗:', error);
    res.status(500).json({
      success: false,
      error: '更新特殊事件申請失敗',
      message: error.message
    });
  }
});

// 移除特殊事件標記
app.post('/api/events/remove-special', async (req, res) => {
  try {
    const { eventId } = req.body;
    
    console.log('🗑️ 收到移除特殊事件標記請求:', { eventId });
    
    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: '缺少必要參數：eventId'
      });
    }
    
    // 從快取中找到事件
    // 🔥 修復：支援多種快取結構（events 或 data 欄位）
    const eventsList = eventsCache.data?.events || eventsCache.data?.data || null;
    
    if (!eventsCache.data || !eventsList || !Array.isArray(eventsList) || eventsList.length === 0) {
      console.error('❌ 事件快取未就緒:', {
        hasData: !!eventsCache.data,
        hasEvents: !!(eventsCache.data?.events),
        hasDataArray: !!(eventsCache.data?.data),
        eventsListLength: eventsList ? eventsList.length : 0
      });
      return res.status(500).json({
        success: false,
        error: '事件快取未就緒，請稍後再試'
      });
    }
    
    // 🔥 增強事件查找邏輯：支援多種 ID 格式（uid, evt_id, id）
    const event = eventsList.find(e => {
      const matchById = e.id === eventId;
      const matchByUid = e.uid === eventId || (e._raw && e._raw.uid === eventId);
      const matchByEvtId = e.evt_id === eventId || (e._raw && e._raw.evt_id === eventId);
      return matchById || matchByUid || matchByEvtId;
    });
    
    if (!event) {
      console.error('❌ 找不到指定的事件:', {
        eventId: eventId,
        totalEvents: eventsList.length
      });
      return res.status(404).json({
        success: false,
        error: `找不到指定的事件 (ID: ${eventId})`
      });
    }
    
    console.log('📝 找到事件:', event.title);
    
    // 移除標題中的特殊標記
    let newTitle = event.title || '';
    const specialMarkers = ['停課', '體驗', '代課', '改時間', '調課', '延後', '提前'];
    
    for (const marker of specialMarkers) {
      const patterns = [
        new RegExp(`\\[${marker}\\]\\s*`, 'g'),
        new RegExp(`${marker}\\s*`, 'g')
      ];
      for (const pattern of patterns) {
        newTitle = newTitle.replace(pattern, '');
      }
    }
    
    newTitle = newTitle.trim();
    
    // 移除描述中的備註和代課講師資訊
    let newDescription = event.description || '';
    // 🔥 移除 [特殊事件備註] 標記及其後的所有內容（匹配到結尾）
    newDescription = newDescription.replace(/\n\n\[特殊事件備註\].*$/s, '');
    // 🔥 移除 [代課講師] 標記及其後的所有內容（匹配到結尾）
    newDescription = newDescription.replace(/\n\n\[代課講師\].*$/s, '');
    // 🔥 移除描述中所有代課相關關鍵字和內容
    // 移除「代課：」開頭的行
    newDescription = newDescription.replace(/^.*代課：.*$/gm, '');
    // 移除包含「代課講師」的行
    newDescription = newDescription.replace(/^.*代課講師.*$/gm, '');
    // 移除包含「由.*代課」的行
    newDescription = newDescription.replace(/^.*由.*代課.*$/gm, '');
    // 移除包含「代理講師」的行
    newDescription = newDescription.replace(/^.*代理講師.*$/gm, '');
    // 移除包含「由.*代理」的行
    newDescription = newDescription.replace(/^.*由.*代理.*$/gm, '');
    // 移除包含「支援講師」的行
    newDescription = newDescription.replace(/^.*支援講師.*$/gm, '');
    // 移除包含「由.*支援」的行
    newDescription = newDescription.replace(/^.*由.*支援.*$/gm, '');
    // 🔥 清理多餘的換行符（三個或以上換成兩個，兩個或以上換成兩個）
    newDescription = newDescription.replace(/\n{3,}/g, '\n\n').replace(/\n{2,}/g, '\n\n').trim();
    
    console.log('🔄 移除標記:', {
      舊標題: event.title,
      新標題: newTitle,
      舊描述: event.description,
      新描述: newDescription
    });
    
    // 調用 Synology Calendar API 更新事件
    const calendarId = event.calendarId || event.cal_id;
    if (!calendarId) {
      return res.status(500).json({
        success: false,
        error: '事件缺少 calendarId'
      });
    }
    
    // 📝 直接傳遞完整的事件資料給更新方法
    console.log('📋 事件完整資料:', {
      id: event.id,
      calendarId: calendarId,
      dtstart: event.dtstart,
      dtend: event.dtend
    });
    
    const updateResult = await caldavClient.updateEvent(calendarId, eventId, {
      title: newTitle,
      description: newDescription
    }, event);
    
    if (updateResult) {
      // 清除快取以觸發重新載入
      eventsCache.data = null;
      eventsCache.lastUpdate = null;
      
      // 觸發背景更新
      setTimeout(() => updateEventsCache(), 1000);
      
      console.log('✅ 特殊事件標記已移除');
      res.json({
        success: true,
        message: '已成功移除特殊事件標記',
        newTitle: newTitle
      });
    } else {
      res.status(500).json({
        success: false,
        error: '更新 Synology Calendar 失敗'
      });
    }
    
  } catch (error) {
    console.error('❌ 移除特殊事件標記失敗:', error);
    res.status(500).json({
      success: false,
      error: '移除失敗: ' + error.message
    });
  }
});

// Google Sheets 代理 API - 使用 Railway 版本的成功做法
app.post('/api/proxy/google-sheets', async (req, res) => {
  try {
    const { action, course, period, records, googleSheetsUrl, payload: requestPayload } = req.body;
    
    console.log('📤 收到 Google Sheets API 請求:', { action, course, period });
    
    let apiUrl, payload;
    
    if (action === 'getRosterAttendance') {
      // ✅ 修復 2025-11-28: 使用 google-sheets-students.js 替代舊的 Google Apps Script API
      console.log('✅ 使用 google-sheets-students.js 獲取學生名單');
      
      const cleanCourse = course ? course.trim() : '';
      const cleanPeriod = period ? period.trim() : '';
      
      console.log('🔍 清理後的參數:', { cleanCourse, cleanPeriod });
      
      try {
        // 使用新的 Google Sheets Students 模組
        const result = await googleSheetsStudents.getStudentsByCourse(cleanCourse, cleanPeriod);
        
        console.log(`✅ 從 google-sheets-students.js 獲取學生: ${result.count} 位`);
        
        // 轉換為舊格式以保持前端相容性
        const response = {
          success: true,
          count: result.count,
          students: result.students.map(s => ({
            name: s.name,
            course: s.course,
            period: s.period,
            remainingClasses: s.remaining || s.remainingClasses,
            attendance: s.attendance || {}
          }))
        };
        
        return res.json(response);
        
      } catch (error) {
        console.error('❌ google-sheets-students.js 查詢失敗:', error);
        return res.json({
          success: false,
          error: error.message,
          count: 0,
          students: []
        });
      }
      
    } else if (action === 'updateAttendance' || action === 'update') {
      apiUrl = googleSheetsUrl || 'https://script.google.com/macros/s/AKfycbxfj5fwNIc8ncbqkOm763yo6o06wYPHm2nbfd_1yLkHlakoS9FtYfYJhvGCaiAYh_vjIQ/dev';
      payload = requestPayload || req.body;
      
      if (payload.action === 'update' && payload.name) {
        const singleResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': 'NID=525=nsWVvbAon67C2qpyiEHQA3SUio_GqBd7RqUFU6BwB97_4LHggZxLpDgSheJ7WN4w3Z4dCQBiFPG9YKAZgAokFYCuuQw04dkm-FX9-XHAIBIqJf1645n3RZrg86GcUVJOf3gN-5eTHXFIQovTmgRC6cXllv82SnQuKsGMq7CHH60XDSwyC99s9P2gmyXLppI'
          },
          body: JSON.stringify(payload)
        });
        
        if (!singleResponse.ok) {
          throw new Error(`單筆簽到記錄 API 請求失敗: ${singleResponse.status} ${singleResponse.statusText}`);
        }
        
        const responseText = await singleResponse.text();
        let singleData;
        try {
          singleData = JSON.parse(responseText);
        } catch (parseError) {
          singleData = { success: true, message: responseText };
        }
        
        return res.json(singleData);
      }
    } else {
      return res.status(400).json({
        success: false,
        error: '不支援的操作',
        message: '未知的 action 類型'
      });
    }
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'NID=525=nsWVvbAon67C2qpyiEHQA3SUio_GqBd7RqUFU6BwB97_4LHggZxLpDgSheJ7WN4w3Z4dCQBiFPG9YKAZgAokFYCuuQw04dkm-FX9-XHAIBIqJf1645n3RZrg86GcUVJOf3gN-5eTHXFIQovTmgRC6cXllv82SnQuKsGMq7CHH60XDSwyC99s9P2gmyXLppI'
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Google Sheets API 請求失敗: ${response.status} ${response.statusText}`);
    }
    
    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      data = { success: true, message: responseText };
    }
    
    res.json(data);
  } catch (error) {
    console.error('❌ Google Sheets 代理請求失敗:', error);
    res.status(500).json({
      success: false,
      error: '代理請求失敗',
      message: error.message
    });
  }
});

// 講師 Web API 查找端點
app.post('/api/teacher-web-api', async (req, res) => {
  try {
    const { teacherName } = req.body;
    if (!teacherName) {
      return res.status(400).json({
        success: false,
        message: '缺少講師名稱參數'
      });
    }

    console.log('🔍 查找講師 Web API:', teacherName);
    const { records } = readTeacherListCsvRecords();
    if (!records.length) {
      return res.status(404).json({
        success: false,
        message: '講師資料檔案不存在'
      });
    }

    const matchedRecord = findTeacherRecordByName(records, teacherName);
    if (!matchedRecord) {
      console.log('❌ 在 CSV 中找不到講師:', teacherName);
      return res.json({
        success: false,
        message: `找不到講師 "${teacherName}" 的 Web API 配置`
      });
    }

    if (!matchedRecord.webApi) {
      console.log('⚠️ 講師沒有配置 Web API:', matchedRecord.teacher);
      return res.json({
        success: false,
        message: `講師 "${matchedRecord.teacher}" 沒有配置 Web API`
      });
    }

    console.log('✅ 找到講師 Web API:', maskSensitiveUrl(matchedRecord.webApi));
    return res.json({
      success: true,
      teacherName: matchedRecord.teacher,
      webApi: matchedRecord.webApi,
      message: '成功找到講師 Web API'
    });
  } catch (error) {
    console.error('❌ 查找講師 Web API 失敗:', error);
    res.status(500).json({
      success: false,
      message: '查找講師 Web API 失敗',
      error: error.message
    });
  }
});
// 講師報表提交 API
app.post('/api/teacher-report', async (req, res) => {
  try {
    const { 
      teacherName, courseName, fullCourseTitle, courseTime, date, studentCount, courseContent, mode,
      presentStudents, absentStudents, unmarkedStudents 
    } = req.body;
    
    console.log('📊 收到講師報表提交:', { 
      teacherName, courseName, fullCourseTitle, courseTime, date, studentCount, courseContent, mode,
      presentCount: presentStudents?.length || 0,
      absentCount: absentStudents?.length || 0,
      unmarkedCount: unmarkedStudents?.length || 0
    });
    
    // 驗證學生人數
    let validStudentCount = 0;
    if (typeof studentCount === 'number' && !isNaN(studentCount)) {
      validStudentCount = studentCount;
    } else if (typeof studentCount === 'string' && !isNaN(parseInt(studentCount))) {
      validStudentCount = parseInt(studentCount);
    } else {
      console.warn('⚠️ 學生人數無效，使用預設值 0:', studentCount);
      validStudentCount = 0;
    }
    
    // 🔥 如果 studentCount 為 0 但 presentStudents 有資料，使用 presentStudents.length
    if (validStudentCount === 0 && Array.isArray(presentStudents) && presentStudents.length > 0) {
      validStudentCount = presentStudents.length;
      console.log('📊 從 presentStudents 更新 studentCount:', validStudentCount);
    }
    
    console.log('📊 學生人數驗證結果:', {
      original: studentCount,
      type: typeof studentCount,
      valid: validStudentCount,
      presentCount: presentStudents?.length || 0,
      absentCount: absentStudents?.length || 0
    });
    
    // 根據行事曆講師名稱模糊比對，提取「老師」部分
    let matchedTeacherName = teacherName;
    if (teacherName && teacherName.includes('老師')) {
      // 如果包含「老師」，直接使用
      matchedTeacherName = teacherName;
    } else {
      // 嘗試從講師名稱中提取「老師」部分
      const teacherMatch = teacherName.match(/(.+?)\s*老師/);
      if (teacherMatch) {
        matchedTeacherName = teacherMatch[1].trim() + '老師';
      } else {
        // 如果沒有「老師」，直接使用原名稱
        matchedTeacherName = teacherName;
      }
    }
    
    console.log('🔍 講師名稱比對結果:', {
      original: teacherName,
      matched: matchedTeacherName
    });
    
    // 從 CSV 中查找講師的 Google Sheets 連結和 Web API
    let teacherSheetUrl = null;
    let teacherWebApiUrl = null;
    let csvTeacherName = null;
    const { records: teacherRecords } = readTeacherListCsvRecords();
    const csvRecord = findTeacherRecordByName(teacherRecords, matchedTeacherName);
    if (csvRecord) {
      teacherSheetUrl = csvRecord.link || null;
      teacherWebApiUrl = csvRecord.webApi || null;
      csvTeacherName = csvRecord.teacher;
      console.log('✅ 找到講師資料:', {
        原始CSV名稱: csvRecord.teacher,
        工作表連結: teacherSheetUrl,
        WebAPI: maskSensitiveUrl(teacherWebApiUrl)
      });
    } else {
      console.warn('⚠️ 在 CSV 中找不到講師:', matchedTeacherName);
    }

    // 檢查是否找到講師的 Web API
    if (!teacherWebApiUrl || teacherWebApiUrl === '') {
      console.error('❌ 找不到講師的 Web API URL');
      return res.status(400).json({
        success: false,
        message: `講師「${teacherName}」沒有配置 Web API，請聯絡管理員設定`,
        teacherName: teacherName,
        matchedTeacherName: matchedTeacherName
      });
    }
    
    if (!teacherSheetUrl) {
      console.warn('⚠️ 找不到講師的 Google Sheets 連結');
    }
    
    // 調用講師專屬的 Google Sheets API
    console.log('🔗 調用講師的 Google Sheets API:', teacherWebApiUrl);
    
    // 使用從 CSV 找到的講師名稱，如果沒有找到則使用原始名稱
    const finalTeacherName = csvTeacherName || matchedTeacherName;
    console.log('📝 最終使用的講師名稱:', finalTeacherName);
    
    const requestPayload = {
      action: "appendTeacherCourse",
      sheetName: "報表",
      teacherName: finalTeacherName,
      teacherSheetUrl: teacherSheetUrl,  // 加入講師連結
      "課程名稱": fullCourseTitle || courseName,
      "上課時間": courseTime,
      "課程日期": date,
      "人數_助教": validStudentCount.toString(),
      "課程內容": courseContent
    };
    
    console.log('📤 發送到 Google Sheets 的完整資料:', JSON.stringify(requestPayload, null, 2));
    
    const webApiResponse = await axios.post(teacherWebApiUrl, requestPayload, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000 // 10秒超時
    });
    
    console.log('✅ 講師 Web API 回應 (狀態碼):', webApiResponse.status);
    console.log('✅ 講師 Web API 回應 (完整內容):', JSON.stringify(webApiResponse.data, null, 2));
    console.log('✅ 講師 Web API 回應 (Headers):', webApiResponse.headers);
    
    // 檢查回應內容是否表示成功
    if (webApiResponse.data && typeof webApiResponse.data === 'object') {
      if (webApiResponse.data.success === false) {
        console.error('❌ Google Sheets API 返回失敗:', webApiResponse.data);
        throw new Error(`Google Sheets API 錯誤: ${webApiResponse.data.message || webApiResponse.data.error || '未知錯誤'}`);
      }
    }
    
    res.json({
      success: true,
      message: '講師報表提交成功',
      data: {
        teacherName,
        courseName,
        courseTime,
        date,
        studentCount: validStudentCount,
        originalStudentCount: studentCount,
        courseContent,
        mode,
        timestamp: new Date().toISOString(),
        webApiUrl: teacherWebApiUrl,
        webApiResponse: webApiResponse.data,
        // 🔥 新增：返回簽到統計資料，供前端使用
        presentStudents: presentStudents || [],
        absentStudents: absentStudents || [],
        unmarkedStudents: unmarkedStudents || []
      }
    });
    
  } catch (error) {
    console.error('❌ 講師報表提交失敗:', error);
    
    // 如果是 Web API 調用失敗，提供更詳細的錯誤信息
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({
        success: false,
        message: '講師 Web API 調用超時',
        error: '講師 Web API 回應超時，請稍後重試'
      });
    } else if (error.response) {
      return res.status(502).json({
        success: false,
        message: '講師 Web API 調用失敗',
        error: `講師 Web API 返回錯誤: ${error.response.status} ${error.response.statusText}`,
        details: error.response.data
      });
    } else {
      return res.status(500).json({
        success: false,
        message: '講師報表提交失敗',
        error: error.message
      });
    }
  }
});

app.get('/api/teacher-report/status', async (req, res) => {
  try {
    const teacherQuery = (req.query.teacher || '').trim();
    if (!teacherQuery) {
      return res.status(400).json({
        success: false,
        message: '缺少 teacher 參數'
      });
    }

    const dateInfo = parseDateQueryParam(req.query.date);
    const rawCourseQuery = req.query.course || '';
    const rawTimeQuery = req.query.time || '';
    const courseNormalized = normalizeCourseLabel(rawCourseQuery);
    const timeSignature = normalizeTimeSignatureForServer(rawTimeQuery);
    const cacheKey = `${normalizeTeacherIdentifier(teacherQuery)}:${dateInfo.iso}:${courseNormalized}:${timeSignature}`;

    if (req.query.force === 'true') {
      teacherReportStatusCache.delete(cacheKey);
    }

    const cached = teacherReportStatusCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < TEACHER_STATUS_CACHE_TTL_MS) {
      const cachedPayload = { ...cached.payload };
      cachedPayload.cache = {
        ...cachedPayload.cache,
        hit: true,
        ageMs: Date.now() - cached.timestamp
      };
      return res.json(cachedPayload);
    }

    const { records } = readTeacherListCsvRecords();
    if (!records.length) {
      return res.status(404).json({
        success: false,
        message: '講師列表不存在'
      });
    }

    const matchedRecord = findTeacherRecordByName(records, teacherQuery);
    if (!matchedRecord) {
      return res.status(404).json({
        success: false,
        message: `找不到講師 ${teacherQuery}`
      });
    }

    const readApiUrl = matchedRecord.googleSheetReadApi || matchedRecord.readApi;
    if (!readApiUrl) {
      return res.status(400).json({
        success: false,
        message: `講師 ${matchedRecord.teacher} 缺少 read API`
      });
    }

    console.log('📡 讀取講師報表狀態:', {
      teacher: matchedRecord.teacher,
      date: dateInfo.iso,
      queryCourse: rawCourseQuery,
      queryTime: rawTimeQuery,
      normalizedCourse: courseNormalized,
      timeSignature,
      readApi: maskSensitiveUrl(readApiUrl)
    });

    const response = await axios.get(readApiUrl, {
      timeout: Number(process.env.TEACHER_STATUS_FETCH_TIMEOUT || 8000)
    });
    const values = Array.isArray(response.data?.values) ? response.data.values : [];
    const rows = mapSheetRows(values, dateInfo.year);
    const candidates = rows.filter(row => row.canonicalDate === dateInfo.iso);
    let bestRow = null;
    if (candidates.length) {
      bestRow = candidates.reduce((currentBest, row) => {
        let score = 1;
        if (courseNormalized && row.courseNormalized) {
          if (row.courseNormalized === courseNormalized) score += 3;
          else if (row.courseNormalized.includes(courseNormalized) || courseNormalized.includes(row.courseNormalized)) score += 1;
        }
        const rowTimeCandidates = [row.timeSignature, row.alternateTimeSignature].filter(Boolean);
        if (timeSignature && rowTimeCandidates.length) {
          if (rowTimeCandidates.includes(timeSignature)) {
            score += 2;
          } else if (rowTimeCandidates.some(sig => timeSignaturesOverlap(sig, timeSignature))) {
            score += 1;
          }
        }
        if (!currentBest || score > currentBest.score || (score === currentBest.score && row.rowIndex > currentBest.rowIndex)) {
          return { ...row, score };
        }
        return currentBest;
      }, null);
    }

    let matchInfo = {
      status: bestRow ? 'match' : 'not_found',
      requestedCourse: courseNormalized,
      requestedTime: timeSignature,
      foundCourse: bestRow?.courseNormalized || '',
      foundTime: bestRow?.timeSignature || '',
      rowScore: bestRow?.score || 0
    };
    let isConfidentMatch = false;
    if (bestRow) {
      const rowCourseNorm = bestRow.courseNormalized || '';
      const rowTimeCandidates = [bestRow.timeSignature, bestRow.alternateTimeSignature].filter(Boolean);
      const rowPrimaryTime = bestRow.timeSignature || '';
      const courseExactMatch = Boolean(courseNormalized && rowCourseNorm && rowCourseNorm === courseNormalized);
      const courseLooseMatch = Boolean(
        courseNormalized &&
        rowCourseNorm &&
        (rowCourseNorm.includes(courseNormalized) || courseNormalized.includes(rowCourseNorm))
      );
      const timeExactMatch = Boolean(timeSignature && rowTimeCandidates.length && rowTimeCandidates.some(sig => sig === timeSignature));
      const timeOverlap = Boolean(timeSignature && rowTimeCandidates.length && rowTimeCandidates.some(sig => timeSignaturesOverlap(sig, timeSignature)));
      const timeMismatch = Boolean(
        timeSignature &&
        rowTimeCandidates.length &&
        !timeExactMatch &&
        !timeOverlap
      );
      const matchedTimeSignature = timeExactMatch ? timeSignature : (timeOverlap ? rowPrimaryTime : '');
      let matchedTimeLabel = bestRow.courseTime;
      if (matchedTimeSignature && bestRow.alternateTimeSignature === matchedTimeSignature && bestRow.courseTimeAlternate) {
        matchedTimeLabel = bestRow.courseTimeAlternate;
      }

      // ⚠️ 嚴格匹配規則：
      // - 同時提供 course 與 time：課程需精準相同，時間需完全相同或有交集
      // - 只提供 course：僅接受課程精準匹配
      // - 只提供 time：接受時間精準相同或有交集
      if (courseNormalized && timeSignature) {
        isConfidentMatch = courseExactMatch && (timeExactMatch || timeOverlap);
      } else if (courseNormalized) {
        isConfidentMatch = courseExactMatch;
      } else if (timeSignature) {
        isConfidentMatch = timeExactMatch || timeOverlap;
      } else {
        isConfidentMatch = false; // 沒有提供關鍵資訊，不做自動匹配
      }
      if (courseExactMatch && timeMismatch) {
        matchInfo.timeWarning = true;
        matchInfo.reason = 'time_mismatch';
      }
      matchInfo = {
        status: isConfidentMatch ? 'match' : 'mismatch',
        requestedCourse: courseNormalized,
        requestedCourseRaw: rawCourseQuery,
        foundCourse: rowCourseNorm,
        foundCourseRaw: bestRow.courseName,
        courseExactMatch,
        courseLooseMatch,
        requestedTime: timeSignature,
        requestedTimeRaw: rawTimeQuery,
        foundTime: matchedTimeSignature || rowPrimaryTime,
        foundTimeRaw: matchedTimeLabel,
        foundTimeRawAlternate: bestRow.courseTimeAlternate || '',
        timeExactMatch,
        timeOverlap,
        timeMismatch,
        timeWarning: matchInfo.timeWarning || false,
        reason: matchInfo.reason || (isConfidentMatch ? 'ok' : 'mismatch'),
        rowScore: bestRow.score || 0
      };
      console.log('🧮 講師報表比對結果', {
        teacher: matchedRecord.teacher,
        date: dateInfo.iso,
        status: matchInfo.status,
        requestedCourse: rawCourseQuery,
        foundCourse: bestRow.courseName,
        requestedTime: rawTimeQuery,
        foundTime: bestRow.courseTime,
        courseExactMatch,
        courseLooseMatch,
        timeExactMatch,
        timeOverlap,
        timeMismatch,
        score: bestRow.score
      });
    }
    const hasReport = Boolean(bestRow) && isConfidentMatch;

    const payload = {
      success: true,
      teacher: {
        requested: teacherQuery,
        matched: matchedRecord.teacher
      },
      query: {
        dateIso: dateInfo.iso,
        dateDisplay: dateInfo.display,
        course: req.query.course || '',
        courseNormalized,
        time: req.query.time || '',
        timeSignature
      },
      hasReport,
      data: hasReport && bestRow ? {
        courseName: bestRow.courseName,
        courseTime: bestRow.courseTime,
        courseTimeAlternate: bestRow.courseTimeAlternate || '',
        courseDateRaw: bestRow.courseDateRaw,
        canonicalDate: bestRow.canonicalDate,
        studentCount: bestRow.studentCount,
        studentCountRaw: bestRow.studentCountRaw,
        courseContent: bestRow.courseContent,
        sheetRow: bestRow.rowIndex,
        score: bestRow.score
      } : null,
      closestRow: !hasReport && bestRow ? {
        courseName: bestRow.courseName,
        courseTime: bestRow.courseTime,
        courseTimeAlternate: bestRow.courseTimeAlternate || '',
        courseDateRaw: bestRow.courseDateRaw,
        canonicalDate: bestRow.canonicalDate,
        studentCount: bestRow.studentCount,
        studentCountRaw: bestRow.studentCountRaw,
        courseContent: bestRow.courseContent,
        sheetRow: bestRow.rowIndex,
        score: bestRow.score
      } : null,
      sheet: {
        url: matchedRecord.link || '',
        range: response.data?.range || '',
        readApiSource: matchedRecord.googleSheetReadApi ? 'googleSheetReadApi' : 'readApi'
      },
      match: matchInfo,
      fetchedAt: new Date().toISOString(),
      cache: {
        hit: false,
        ttlMs: TEACHER_STATUS_CACHE_TTL_MS
      }
    };

    if (!bestRow) {
      payload.recentRows = rows.slice(-3).map(row => ({
        courseName: row.courseName,
        courseTime: row.courseTime,
        courseDateRaw: row.courseDateRaw,
        canonicalDate: row.canonicalDate,
        studentCount: row.studentCount
      }));
    }

    teacherReportStatusCache.set(cacheKey, {
      timestamp: Date.now(),
      payload
    });

    res.json(payload);
  } catch (error) {
    console.error('❌ 查詢講師報表狀態失敗:', error);
    res.status(502).json({
      success: false,
      message: '讀取講師報表狀態失敗',
      error: error.message
    });
  }
});

// 學生簽到通知 API
app.post('/api/student-attendance-notification', async (req, res) => {
  try {
    const { 
      teacher, course, time, start, end, studentId, studentName, status, 
      message, teacherName, courseName, presentStudents, absentStudents, unmarkedStudents 
    } = req.body;
    
    console.log('📨 收到學生簽到通知請求:', { 
      teacher, course, time, studentName, status, 
      hasMessage: !!message, 
      teacherName: teacherName || teacher,
      courseName: courseName || course,
      presentCount: presentStudents?.length || 0,
      absentCount: absentStudents?.length || 0,
      unmarkedCount: unmarkedStudents?.length || 0
    });
    
    // 檢查是否為講師報表通知
    if (message && (message.includes('講師報表') || message.includes('講師報告'))) {
      const {
        courseTime: bodyCourseTime,
        date: bodyDate,
        presentStudents = [],
        absentStudents = [],
        unmarkedStudents = [],
        studentCount: bodyStudentCount,
        courseContent: bodyCourseContent,
        mode: bodyMode,
        attendanceSummary: bodySummary,
        teacherStatus: bodyTeacherStatus
      } = req.body;
      const resolvedTeacherName = teacherName || teacher || '未知講師';
      const resolvedCourseName = courseName || course || '未知課程';
      const resolvedTime = bodyCourseTime || time || '未知時間';
      const resolvedDate = bodyDate || new Date().toLocaleDateString('zh-TW');
      const resolvedStudentCount = (typeof bodyStudentCount === 'number' && !isNaN(bodyStudentCount))
        ? bodyStudentCount
        : (presentStudents?.length || 0);
      const reportData = {
        teacherName: resolvedTeacherName,
        courseName: resolvedCourseName,
        time: resolvedTime,
        date: resolvedDate,
        studentCount: resolvedStudentCount,
        courseContent: bodyCourseContent || '講師報表提交',
        mode: bodyMode || '講師模式',
        attendanceSummary: bodySummary || req.body.attendanceStats || '無統計資料',
        teacherStatus: bodyTeacherStatus || '已提交報表',
        presentStudents,
        absentStudents,
        unmarkedStudents
      };

      const result = await notificationManager.sendTeacherReportNotification(reportData);
      try {
        await notificationManager.sendTeacherReportFlexToAdmin({
          teacherName: reportData.teacherName,
          courseName: reportData.courseName,
          time: reportData.time,
          date: reportData.date,
          studentCount: reportData.studentCount,
          courseContent: reportData.courseContent,
          mode: reportData.mode,
          attendanceSummary: reportData.attendanceSummary,
          teacherStatus: reportData.teacherStatus,
          presentNames: presentStudents,
          absentNames: absentStudents,
          unmarkedNames: unmarkedStudents
        });
      } catch (flexError) {
        console.warn('⚠️ 發送正職群組 Flex 失敗，不影響講師通知:', flexError.message);
      }

      return res.json({
        success: result.success,
        message: result.message,
        results: result.results
      });
    }
    
    // 構建出席統計
    const attendanceStats = [];
    const totalStudents = (presentStudents?.length || 0) + (absentStudents?.length || 0) + (unmarkedStudents?.length || 0);
    
    if (presentStudents && presentStudents.length > 0) {
      attendanceStats.push(`✅ 出席: ${presentStudents.length}人`);
    }
    if (absentStudents && absentStudents.length > 0) {
      attendanceStats.push(`❌ 缺席: ${absentStudents.length}人`);
    }
    if (unmarkedStudents && unmarkedStudents.length > 0) {
      attendanceStats.push(`⚠️ 未標記: ${unmarkedStudents.length}人`);
    }
    
    // 構建詳細的學生名單
    let studentDetails = '';
    if (presentStudents && presentStudents.length > 0) {
      studentDetails += `\n✅ 出席 (${presentStudents.length}人):\n`;
      studentDetails += presentStudents.map(s => `  • ${s}`).join('\n');
    }
    if (absentStudents && absentStudents.length > 0) {
      studentDetails += `\n\n❌ 缺席 (${absentStudents.length}人):\n`;
      studentDetails += absentStudents.map(s => `  • ${s}`).join('\n');
    }
    if (unmarkedStudents && unmarkedStudents.length > 0) {
      studentDetails += `\n\n⚠️ 未標記 (${unmarkedStudents.length}人):\n`;
      studentDetails += unmarkedStudents.map(s => `  • ${s}`).join('\n');
    }
    
    // 使用通知管理器發送學生簽到通知
    const attendanceData = {
      teacherName: teacherName || teacher || '未知講師',
      courseName: courseName || course || '未知課程',
      time: time || (start ? new Date(start).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }) : '未知時間'),
      studentName: `共 ${totalStudents} 位學生`,
      status: attendanceStats.join(', ') || '無統計資料',
      attendanceStats: studentDetails || '無統計資料'
    };
    
    const result = await notificationManager.sendStudentAttendanceNotification(attendanceData);
    
    res.json({
      success: result.success,
      message: result.message,
      results: result.results
    });
  } catch (error) {
    console.error('❌ 發送學生簽到通知失敗:', error);
    res.status(500).json({
      success: false,
      error: '發送通知失敗',
      message: error.message
    });
  }
});

// 通知配置管理 API
app.get('/api/notification-config', (req, res) => {
  try {
    const status = notificationManager.getConfigStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '獲取通知配置失敗',
      message: error.message
    });
  }
});

// 重新載入通知配置 API
app.post('/api/notification-config/reload', (req, res) => {
  try {
    notificationManager.reloadConfig();
    res.json({
      success: true,
      message: '通知配置已重新載入'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '重新載入配置失敗',
      message: error.message
    });
  }
});

// ==================== 🔥 講師群組設定 API ====================

/**
 * GET /api/teacher-group-config - 獲取講師群組設定
 */
app.get('/api/teacher-group-config', (req, res) => {
    try {
        const configPath = path.join(__dirname, 'notification-config.json');
        if (!fs.existsSync(configPath)) {
            return res.status(404).json({
                success: false,
                error: '配置檔案不存在'
            });
        }
        
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const teacherGroup = config?.roles?.teacher_group || {};
        
        res.json({
            success: true,
            data: {
                group_id: teacherGroup.group_id || '',
                name: teacherGroup.name || '講師群組',
                description: teacherGroup.description || ''
            }
        });
    } catch (error) {
        console.error('❌ 獲取講師群組設定失敗:', error);
        res.status(500).json({
            success: false,
            error: '獲取講師群組設定失敗',
            message: error.message
        });
    }
});

/**
 * PUT /api/teacher-group-config - 更新講師群組設定
 */
app.put('/api/teacher-group-config', (req, res) => {
    try {
        const { group_id } = req.body;
        
        if (!group_id || typeof group_id !== 'string') {
            return res.status(400).json({
                success: false,
                error: '請提供有效的 group_id'
            });
        }
        
        const configPath = path.join(__dirname, 'notification-config.json');
        if (!fs.existsSync(configPath)) {
            return res.status(404).json({
                success: false,
                error: '配置檔案不存在'
            });
        }
        
        // 讀取現有配置
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // 確保 roles.teacher_group 存在
        if (!config.roles) config.roles = {};
        if (!config.roles.teacher_group) {
            config.roles.teacher_group = {
                name: '講師群組',
                description: '所有講師的群組，接收課程異動通知',
                permissions: [
                    'receive_class_cancellation_notifications',
                    'receive_class_resumption_notifications',
                    'receive_schedule_change_notifications'
                ]
            };
        }
        
        // 更新 group_id
        config.roles.teacher_group.group_id = group_id.trim();
        
        // 寫回檔案
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
        
        console.log('✅ 講師群組設定已更新:', group_id);
        
        res.json({
            success: true,
            message: '講師群組設定已更新',
            data: {
                group_id: config.roles.teacher_group.group_id
            }
        });
    } catch (error) {
        console.error('❌ 更新講師群組設定失敗:', error);
        res.status(500).json({
            success: false,
            error: '更新講師群組設定失敗',
            message: error.message
        });
    }
});

// 測試通知發送 API
app.post('/api/notification-config/test', async (req, res) => {
  try {
    const { type, data } = req.body;
    
    let result;
    switch (type) {
      case 'student_attendance':
        result = await notificationManager.sendStudentAttendanceNotification(data);
        break;
      case 'teacher_report':
        result = await notificationManager.sendTeacherReportNotification(data);
        break;
      case 'reminder':
        result = await notificationManager.sendReminderNotification(data);
        break;
      default:
        throw new Error('未知的通知類型');
    }
    
    res.json({
      success: result.success,
      message: result.message,
      results: result.results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: '測試通知發送失敗',
      message: error.message
    });
  }
});

// 主頁面路由
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>FLB講師行事曆檢視系統</title>
      <script>window.location.href="/perfect-calendar.html";</script>
    </head>
    <body>
      <p>正在重定向到講師行事曆檢視系統...</p>
    </body>
    </html>
  `);
});

// ==================== 🚀 極速簽到 API（終極方案） ====================

app.post('/api/attendance/fast', async (req, res) => {
    try {
        const { 
            studentName, 
            courseName, 
            date, 
            mark, 
            courseType, 
            studentIndex,
            teacher,
            courseTime,
            eventId,
            courseTopic,
            courseTopicOverride,
            courseCategory,
            lessonUrl,
            courseDisplayName
        } = req.body;

        const manualCourseTopic = typeof courseTopicOverride === 'string' ? courseTopicOverride.trim() : '';
        const normalizedCourseTopic = manualCourseTopic || (typeof courseTopic === 'string' ? courseTopic.trim() : '');
        if (manualCourseTopic) {
            console.log('✏️ 使用講師覆寫的課堂主題:', manualCourseTopic);
        }

        if (!studentName || !courseName || !date) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數: studentName, courseName, date'
            });
        }

        // 🔥 第一步：檢查是否為臨時學生（體驗課/補課）
        const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
        let isTrialStudent = false;  // 體驗課學生
        let isMakeupStudent = false; // 補課學生
        let tempStudent = null;
        
        if (fs.existsSync(tempDataPath)) {
            const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
            
            // 🔥 檢查 students 陣列是否存在
            if (!tempData || !Array.isArray(tempData.students)) {
                console.error('❌ temporary_students.json 格式錯誤: students 陣列不存在');
                return res.status(500).json({
                    success: false,
                    error: 'temporary_students.json 格式錯誤'
                });
            }
            
            tempStudent = tempData.students.find(s => s.name === studentName);
            
            if (tempStudent) {
                if (tempStudent.type === 'trial') {
                    isTrialStudent = true;
                    console.log(`🎓 檢測到體驗課學生: ${studentName}`);
                } else if (tempStudent.type === 'makeup') {
                    isMakeupStudent = true;
                    console.log(`🔄 檢測到補課學生: ${studentName} (正式學生補課)`);
                }
            }
        }

        // 🔥 體驗課學生簽到：只更新 temporary_students.json，不查詢 Google Sheets
        if (isTrialStudent) {
            console.log(`📝 處理臨時學生簽到: ${studentName} @ ${date}`);
            
            // 初始化 attendance 陣列
            if (!tempStudent.attendance) {
                tempStudent.attendance = [];
            }
            
            // 更新或新增出席記錄
            const existingIndex = tempStudent.attendance.findIndex(a => a.date === date);
            const newAttendanceRecord = {
                date: date,
                present: mark === 'V' ? true : mark === 'X' ? false : 'leave'
            };
            
            if (existingIndex >= 0) {
                tempStudent.attendance[existingIndex] = newAttendanceRecord;
            } else {
                tempStudent.attendance.push(newAttendanceRecord);
            }
            
            // 寫回檔案
            const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
            if (!tempData || !Array.isArray(tempData.students)) {
                console.error('❌ temporary_students.json 格式錯誤: students 陣列不存在');
                return res.status(500).json({
                    success: false,
                    error: 'temporary_students.json 格式錯誤'
                });
            }
            const studentIdx = tempData.students.findIndex(s => s.name === studentName);
            if (studentIdx >= 0) {
                tempData.students[studentIdx] = tempStudent;
                fs.writeFileSync(tempDataPath, JSON.stringify(tempData, null, 2), 'utf8');
            }
            
            console.log(`✅ 體驗課學生簽到成功:`, {
                student: studentName,
                date: date,
                mark: mark,
                type: 'trial'
            });
            
            return res.json({
                success: true,
                data: {
                    name: tempStudent.name,
                    course: tempStudent.course,
                    remaining: tempStudent.remaining || 1,
                    isTemporary: true,
                    isTrial: true
                },
                message: '體驗課學生簽到成功'
            });
        }

        // 🔥 正常學生簽到（包括補課學生）：使用 fastAttendance.signIn() 查詢 Google Sheets
        // 補課學生雖然在 temporary_students.json 中，但因為是正式學生，所以要走真實簽到流程
        const isFastMode = courseType && studentIndex !== undefined && studentIndex >= 0;
        const mode = isFastMode ? '⚡ 快速模式' : '⚠️ Fallback 模式';
        
        console.log(`🚀 極速簽到請求: ${studentName} -> ${courseName} @ ${date} [${mode}]`);
        if (isFastMode) {
            console.log(`   - courseType: ${courseType}, studentIndex: ${studentIndex}`);
        }

        // 🔥 傳遞 options 給 signIn 方法（包含前端提供的快取資料）
        const result = await fastAttendance.signIn(
            studentName,
            courseName,
            date,
            mark || 'V',
            { courseType, studentIndex } // 🆕 傳遞快取資料，避免重複查詢
        );

        // 🔥 簽到成功後，同步更新 student_data.json
        if (result.success) {
            try {
                const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
                
                if (fs.existsSync(studentDataPath)) {
                    const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
                    
                    // 🔥 檢查 students 陣列是否存在
                    if (!studentData || !Array.isArray(studentData.students)) {
                        console.error('❌ student_data.json 格式錯誤: students 陣列不存在');
                        return res.status(500).json({
                            success: false,
                            error: 'student_data.json 格式錯誤',
                            data: result.data
                        });
                    }
                    
                    const student = studentData.students.find(s => s.name === studentName);
                    
                    if (student) {
                        // 初始化 attendance 陣列
                        if (!student.attendance) {
                            student.attendance = [];
                        }
                        
                        // 檢查這個日期之前的出席狀態
                        const previousAttendance = student.attendance.find(a => a.date === date);
                        const wasPreviouslyPresent = previousAttendance?.present === true;
                        const isNowPresent = (mark === 'V');
                        
                        // 🔥 智能計算剩餘堂數變化
                        let remainingChange = 0;
                        
                        if (wasPreviouslyPresent && !isNowPresent) {
                            // 情況 1: 之前出席 → 現在改為缺席/請假 = +1 堂（還回來）
                            remainingChange = +1;
                            console.log('🔄 之前已出席，現在改為缺席/請假 → 還回 1 堂');
                        } else if (!wasPreviouslyPresent && isNowPresent) {
                            // 情況 2: 之前缺席/請假/無記錄 → 現在改為出席 = -1 堂
                            remainingChange = -1;
                            console.log('🔄 之前未出席，現在改為出席 → 扣除 1 堂');
                        } else {
                            // 情況 3: 缺席→請假、請假→缺席、出席→出席 = 不變
                            remainingChange = 0;
                            console.log('🔄 狀態變更但不影響堂數');
                        }
                        
                        // 更新 remaining
                        if (remainingChange !== 0) {
                            student.remaining += remainingChange;
                            console.log(`📚 堂數變化: ${remainingChange > 0 ? '+' : ''}${remainingChange} → 剩餘 ${student.remaining} 堂`);
                        }
                        
                        // 更新或新增出席記錄
                        const existingIndex = student.attendance.findIndex(a => a.date === date);
                        const newAttendanceRecord = {
                            date: date,
                            present: mark === 'V' ? true : mark === 'X' ? false : 'leave'
                        };
                        
                        if (existingIndex >= 0) {
                            student.attendance[existingIndex] = newAttendanceRecord;
                        } else {
                            student.attendance.push(newAttendanceRecord);
                        }
                        
                        // 寫回檔案
                        fs.writeFileSync(studentDataPath, JSON.stringify(studentData, null, 2), 'utf8');
                        
                        console.log('✅ student_data.json 已同步更新:', {
                            student: studentName,
                            date: date,
                            mark: mark,
                            remainingChange: remainingChange,
                            remaining: student.remaining
                        });
                        
                        // 更新返回結果中的 remaining
                        if (result.data) {
                            result.data.remaining = student.remaining;
                        }
                    }
                }
                
                // 🔥 如果是補課學生，同時也要更新 temporary_students.json 中的出席記錄
                if (isMakeupStudent && tempStudent) {
                    console.log('📝 同步更新補課學生的臨時記錄');
                    
                    // 初始化 attendance 陣列
                    if (!tempStudent.attendance) {
                        tempStudent.attendance = [];
                    }
                    
                    // 更新或新增出席記錄
                    const tempExistingIndex = tempStudent.attendance.findIndex(a => a.date === date);
                    const tempAttendanceRecord = {
                        date: date,
                        present: mark === 'V' ? true : mark === 'X' ? false : 'leave'
                    };
                    
                    if (tempExistingIndex >= 0) {
                        tempStudent.attendance[tempExistingIndex] = tempAttendanceRecord;
                    } else {
                        tempStudent.attendance.push(tempAttendanceRecord);
                    }
                    
                    // 寫回 temporary_students.json
                    const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
                    if (!tempData || !Array.isArray(tempData.students)) {
                        console.error('❌ temporary_students.json 格式錯誤: students 陣列不存在');
                        return res.json({
                            success: false,
                            error: 'temporary_students.json 格式錯誤',
                            data: result.data
                        });
                    }
                    const tempStudentIdx = tempData.students.findIndex(s => s.name === studentName);
                    if (tempStudentIdx >= 0) {
                        tempData.students[tempStudentIdx] = tempStudent;
                        fs.writeFileSync(tempDataPath, JSON.stringify(tempData, null, 2), 'utf8');
                        console.log('✅ 補課學生臨時記錄已同步更新');
                    }
                }
            } catch (error) {
                console.error('⚠️ 更新 student_data.json 失敗:', error);
                // 不影響主流程，只記錄警告
            }
        }

        if (result.success && mark === 'V') {
            const historyMeta = resolveCourseHistoryMeta({
                courseTopic: normalizedCourseTopic,
                courseCategory,
                courseName,
                courseType,
                date,
                eventId,
                courseDisplayName: courseDisplayName
            });
            studentCourseHistoryLogger.enqueueLog({
                studentName,
                courseName: historyMeta.courseName || courseName,
                courseCategory: historyMeta.courseCategory,
                courseTopic: historyMeta.courseTopic,
                date,
                teacher: teacher || '',
                courseTime: courseTime || '',
                lessonUrl: lessonUrl || historyMeta.cachedEvent?.lessonPlanUrl || '',
                eventId,
                source: 'fast',
                attendanceStatus: 'present'
            });
        } else if (result.success && mark !== 'V') {
            const historyMeta = resolveCourseHistoryMeta({
                courseTopic: normalizedCourseTopic,
                courseCategory,
                courseName,
                courseType,
                date,
                eventId,
                courseDisplayName: courseDisplayName
            });
            await studentCourseHistoryLogger.removeRecord({
                studentName,
                courseName: historyMeta.courseName || courseName,
                courseCategory: historyMeta.courseCategory,
                courseTopic: historyMeta.courseTopic,
                date
            });
        }

        const statusCode = result.success ? 200 : 400;
        res.status(statusCode).json(result);

    } catch (error) {
        console.error('❌ 極速簽到 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤: ' + error.message
        });
    }
});

// ==================== 清除快取 API ====================

app.post('/api/attendance/clear-cache', (req, res) => {
    try {
        fastAttendance.clearCache();
        res.json({
            success: true,
            message: '✅ 快取已清除'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== 學生上過課紀錄 API ====================

	app.get('/api/course-history', async (req, res) => {
	    try {
	        const records = await studentCourseHistoryLogger.fetchRecords({
	            limit: req.query.limit,
	            startDate: req.query.startDate,
	            endDate: req.query.endDate,
	            student: req.query.student,
	            course: req.query.course,
	            topic: req.query.topic,
	            source: req.query.source,
	            teacher: req.query.teacher,
	            courseCategory: req.query.courseCategory
	        });
        res.json({
            success: true,
            data: records
        });
    } catch (error) {
        console.error('❌ 讀取學生上課紀錄失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message || '讀取失敗'
        });
    }
});

app.get('/api/course-history/audit', async (req, res) => {
    try {
        const entries = await studentCourseHistoryLogger.readAuditLog({
            limit: req.query.limit
        });
        res.json({
            success: true,
            data: entries
        });
    } catch (error) {
        console.error('❌ 讀取學生上課紀錄 audit 失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message || '讀取失敗'
        });
    }
});

app.post('/api/course-history/clear-cache', async (req, res) => {
    try {
        const result = await studentCourseHistoryLogger.clearCache({
            reason: req.body?.reason || '',
            requestedBy: req.body?.requestedBy || 'admin-api'
        });
        res.json({
            success: true,
            data: result
        });
    } catch (error) {
        console.error('❌ 清除學生上課紀錄快取失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message || '清除失敗'
        });
    }
});

// ==================== 🏥 請假管理 API ====================

/**
 * POST /api/leave-attendance - 登記請假（支援批次）
 * 請求體：{ students: [{ name, course, date, reason?, notify? }] }
 */
app.post('/api/leave-attendance', async (req, res) => {
    try {
        const { students } = req.body;

        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({
                success: false,
                error: '請提供學生請假資料'
            });
        }

        console.log(`🏥 收到請假請求: ${students.length} 位學生`);

        const results = [];
        const leaveRecordsPath = path.join(__dirname, 'data', 'leave-records.json');

        // 讀取現有請假記錄
        let leaveRecords = { records: [] };
        if (fs.existsSync(leaveRecordsPath)) {
            try {
                leaveRecords = JSON.parse(fs.readFileSync(leaveRecordsPath, 'utf8'));
            } catch (error) {
                console.warn('⚠️ 讀取請假記錄失敗，使用空記錄:', error);
            }
        }

        // 🔥 第一階段：處理每位學生的請假標記
        let needNotify = false; // 是否有學生需要通知
        const successfulLeaveRecords = []; // 成功的請假記錄（用於通知）
        
        for (const student of students) {
            const { name, course, date, period = '', reason = '', notify = false } = student;

            try {
                // 驗證必要欄位
                if (!name || !course || !date) {
                    results.push({
                        name: name || '未知',
                        success: false,
                        message: '缺少必要欄位'
                    });
                    continue;
                }

                console.log(`🏥 處理請假: ${name} -> ${course} @ ${date}`);

                // 🔥 使用 FastAttendance 標記請假
                const markResult = await fastAttendance.markLeave(name, course, date, reason);

                if (!markResult.success) {
                    results.push({
                        name: name,
                        success: false,
                        message: markResult.error || '標記請假失敗'
                    });
                    continue;
                }

                // 🔥 計算星期幾（使用台灣時區）
                // 修復：確保使用台灣時區正確計算星期
                const dateStr = date.includes('T') ? date.split('T')[0] : date; // 移除時間部分
                const [year, month, day] = dateStr.split('-').map(Number);
                const dateObj = new Date(year, month - 1, day); // 使用本地時區建立日期
                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                const weekday = weekdays[dateObj.getDay()];
                console.log(`📅 日期計算: ${date} -> ${year}/${month}/${day} -> 星期${weekday}`);

                // 🔥 保存請假記錄到 JSON
                const recordId = `leave_${date}_${course}_${name}`;
                const now = new Date().toISOString();

                const leaveRecord = {
                    id: recordId,
                    studentName: name,
                    course: course,
                    period: period || '',
                    date: date,
                    weekday: weekday,
                    reason: reason || '未填寫',
                    registeredAt: now,
                    registeredBy: 'admin',
                    notified: false,
                    notifiedAt: null,
                    notifyTargets: []
                };

                // 檢查是否已存在該記錄
                const existingIndex = leaveRecords.records.findIndex(r => r.id === recordId);
                if (existingIndex >= 0) {
                    // 更新現有記錄
                    leaveRecords.records[existingIndex] = {
                        ...leaveRecords.records[existingIndex],
                        ...leaveRecord,
                        updatedAt: now
                    };
                    console.log(`📝 更新請假記錄: ${recordId}`);
                } else {
                    // 新增記錄
                    leaveRecords.records.push(leaveRecord);
                    console.log(`📝 新增請假記錄: ${recordId}`);
                }

                // 🔥 加入成功記錄列表（用於後續通知）
                if (notify) {
                    needNotify = true;
                    successfulLeaveRecords.push({
                        ...leaveRecord,
                        studentName: name,
                        courseName: course
                    });
                }

                // 🔥 同步更新 student_data.json（確保 check-class-absence 能即時看到請假狀態）
                try {
                    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
                    if (fs.existsSync(studentDataPath)) {
                        const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
                        if (!studentData || !Array.isArray(studentData.students)) {
                            console.error('❌ student_data.json 格式錯誤: students 陣列不存在');
                            return res.status(500).json({ success: false, error: 'student_data.json 格式錯誤' });
                        }
                        const student = studentData.students.find(s => s.name === name && s.course === course);
                        if (student) {
                            if (!student.attendance) {
                                student.attendance = [];
                            }

                            const newAttendanceRecord = {
                                date: date,
                                present: 'leave'
                            };

                            const existingIndex = student.attendance.findIndex(a => a.date === date);
                            if (existingIndex >= 0) {
                                student.attendance[existingIndex] = newAttendanceRecord;
                            } else {
                                student.attendance.push(newAttendanceRecord);
                            }

                            fs.writeFileSync(studentDataPath, JSON.stringify(studentData, null, 2), 'utf8');
                            console.log('✅ student_data.json 已同步更新（請假）:', { student: name, course, date });
                        } else {
                            console.warn('⚠️ student_data.json 中找不到學生，無法同步請假狀態:', name, course);
                        }
                    }
                } catch (error) {
                    console.error('⚠️ 同步 student_data.json（請假）失敗:', error);
                }

                results.push({
                    name: name,
                    success: true,
                    message: '請假登記成功',
                    notifyScheduled: notify
                });

            } catch (error) {
                console.error(`❌ 處理 ${name} 請假失敗:`, error);
                results.push({
                    name: name,
                    success: false,
                    message: error.message
                });
            }
        }

        // 🔥 第二階段：智能通知合併（相同家長的請假用 Carousel）
        if (needNotify && successfulLeaveRecords.length > 0) {
            try {
                console.log(`📢 智能通知合併：準備發送 ${successfulLeaveRecords.length} 筆請假通知`);
                await sendSmartLeaveNotifications(successfulLeaveRecords, leaveRecords);
            } catch (error) {
                console.warn('⚠️ 通知發送異常（不影響請假登記）:', error);
            }
        }

        // 🚀 異步寫入請假記錄檔案（效能優化）
        try {
            await safeFile.writeJSON(leaveRecordsPath, leaveRecords);
            console.log(`✅ 請假記錄已保存 (共 ${leaveRecords.records.length} 筆，異步 + 鎖)`);
        } catch (error) {
            console.error('❌ 寫入請假記錄失敗:', error);
        }

        // 🔥 回傳結果（包含課程資訊供前端檢查全班缺席）
        const allSuccess = results.every(r => r.success);
        
        // 提取成功請假的課程資訊（用於前端全班缺席檢查）
        const leaveInfo = [];
        for (const student of students) {
            const result = results.find(r => r.name === student.name);
            if (result && result.success) {
                leaveInfo.push({
                    courseType: student.course,
                    period: student.period || '',
                    date: student.date,
                    studentName: student.name
                });
            }
        }
        
        res.status(allSuccess ? 200 : 207).json({
            success: allSuccess,
            results: results,
            message: `處理完成：成功 ${results.filter(r => r.success).length}/${results.length}`,
            shouldCheckAbsence: allSuccess && leaveInfo.length > 0,
            leaveInfo: leaveInfo
        });

    } catch (error) {
        console.error('❌ 請假登記 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤: ' + error.message
        });
    }
});

/**
 * DELETE /api/leave-attendance - 取消請假
 * 請求體：{ studentName, courseName, date }
 */
app.delete('/api/leave-attendance', async (req, res) => {
    try {
        const { studentName, courseName, date, period } = req.body;

        if (!studentName || !courseName || !date) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數'
            });
        }

        console.log(`🔄 取消請假: ${studentName} -> ${courseName} @ ${date}${period ? ` (${period})` : ''}`);

        // 🔥 使用 FastAttendance 取消請假標記
        const cancelResult = await fastAttendance.cancelLeave(studentName, courseName, date);

        if (!cancelResult.success) {
            return res.status(400).json(cancelResult);
        }

        // 🔥 更新請假記錄檔案
        const leaveRecordsPath = path.join(__dirname, 'data', 'leave-records.json');
        if (fs.existsSync(leaveRecordsPath)) {
            try {
                const leaveRecords = JSON.parse(fs.readFileSync(leaveRecordsPath, 'utf8'));
                const recordId = `leave_${date}_${courseName}_${studentName}`;
                
                // 移除該記錄
                leaveRecords.records = leaveRecords.records.filter(r => r.id !== recordId);
                
                fs.writeFileSync(leaveRecordsPath, JSON.stringify(leaveRecords, null, 2), 'utf8');
                console.log(`✅ 請假記錄已移除: ${recordId}`);
            } catch (error) {
                console.warn('⚠️ 更新請假記錄失敗:', error);
            }
        }

        // 🔥 回傳成功結果，並提供課程資訊供前端檢查是否需要發送恢復上課通知
        res.json({
            success: true,
            message: '請假已取消',
            data: cancelResult.data,
            shouldCheckResumption: true,  // 🔥 旗標：提示前端檢查是否需要恢復上課通知
            courseInfo: {
                date: date,
                courseType: courseName,
                period: period || '',
                studentName: studentName
            }
        });

    } catch (error) {
        console.error('❌ 取消請假 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤: ' + error.message
        });
    }
});

/**
 * GET /api/attendance-status - 查詢簽到狀態
 * 查詢參數：?course=SPM&date=2025-01-31
 */
app.get('/api/attendance-status', async (req, res) => {
    try {
        const { course, date } = req.query;

        if (!course || !date) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數 course 或 date'
            });
        }

        console.log(`📊 查詢簽到狀態: ${course} @ ${date}`);

        const result = await fastAttendance.getAttendanceStatus(course, date);

        res.json(result);

    } catch (error) {
        console.error('❌ 查詢簽到狀態 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤: ' + error.message
        });
    }
});

/**
 * POST /api/notify-leave - 發送請假通知（獨立端點，支援延遲發送）
 * 請求體：{ studentName, courseName, date, reason, weekday?, targets?: ['staff', 'parent'] }
 */
app.post('/api/notify-leave', async (req, res) => {
    try {
        const { studentName, courseName, date, reason, weekday, targets = ['staff', 'parent'] } = req.body;

        if (!studentName || !courseName || !date) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數'
            });
        }

        console.log(`📢 發送請假通知: ${studentName} -> ${courseName} @ ${date}`);

        // 計算星期幾（如果沒有提供）
        let wd = weekday;
        if (!wd) {
            const dateObj = new Date(date + 'T00:00:00+08:00');
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            wd = weekdays[dateObj.getDay()];
        }

        const result = await sendLeaveNotification(studentName, courseName, date, reason, wd, targets);

        // 🔥 更新請假記錄的通知狀態
        const leaveRecordsPath = path.join(__dirname, 'data', 'leave-records.json');
        if (fs.existsSync(leaveRecordsPath)) {
            try {
                const leaveRecords = JSON.parse(fs.readFileSync(leaveRecordsPath, 'utf8'));
                const recordId = `leave_${date}_${courseName}_${studentName}`;
                const idx = leaveRecords.records.findIndex(r => r.id === recordId);
                
                if (idx >= 0) {
                    leaveRecords.records[idx].notified = true;
                    leaveRecords.records[idx].notifiedAt = new Date().toISOString();
                    leaveRecords.records[idx].notifyTargets = targets;
                    fs.writeFileSync(leaveRecordsPath, JSON.stringify(leaveRecords, null, 2), 'utf8');
                }
            } catch (error) {
                console.warn('⚠️ 更新通知狀態失敗:', error);
            }
        }

        res.json(result);

    } catch (error) {
        console.error('❌ 發送請假通知 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤: ' + error.message
        });
    }
});

/**
 * POST /api/check-class-absence - 檢查班級是否全員缺席
 * 請求體：{ courseType, period, date }
 */
app.post('/api/check-class-absence', async (req, res) => {
    try {
        const { courseType, period, date } = req.body;

        if (!courseType || !date) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數：courseType 和 date'
            });
        }

        console.log(`🔍 檢查班級缺席狀況 - 課程: ${courseType}, 時段: ${period || '全部'}, 日期: ${date}`);

        // 🔥 載入學生資料（合併正式與臨時學生）
        const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
        const tempStudentDataPath = path.join(__dirname, 'public', 'temporary_students.json');

        let allStudents = [];

        // 載入正式學生
        if (fs.existsSync(studentDataPath)) {
            const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
            if (studentData.students && Array.isArray(studentData.students)) {
                allStudents = [...studentData.students];
            }
        }

        // 載入臨時學生
        if (fs.existsSync(tempStudentDataPath)) {
            const tempData = JSON.parse(fs.readFileSync(tempStudentDataPath, 'utf8'));
            if (tempData.students && Array.isArray(tempData.students)) {
                allStudents = [...allStudents, ...tempData.students];
            }
        }

        console.log(`📊 總學生數: ${allStudents.length}`);

        const normalizePeriodValue = (value) => {
            if (!value) return '';
            return String(value)
                .replace(/：/g, ':')
                .replace(/-/g, '')
                .replace(/:/g, '')
                .replace(/\s+/g, '')
                .toUpperCase();
        };

        const normalizedTargetPeriod = normalizePeriodValue(period);

        // 🔥 先挑出該課程所有學生
        const courseStudents = allStudents.filter(student => student.course === courseType);

        let classStudents = courseStudents;

        // 若有指定時段，優先比對到完全相符的時段；若找不到才回退到全部課程
        if (normalizedTargetPeriod) {
            const matchedByPeriod = courseStudents.filter(student => {
                const normalizedStudentPeriod = normalizePeriodValue(student.period);
                if (!normalizedStudentPeriod) return false;
                return (
                    normalizedStudentPeriod === normalizedTargetPeriod ||
                    normalizedStudentPeriod.includes(normalizedTargetPeriod) ||
                    normalizedTargetPeriod.includes(normalizedStudentPeriod)
                );
            });

            if (matchedByPeriod.length > 0) {
                classStudents = matchedByPeriod;
            } else {
                console.warn(`⚠️ 找不到時段 ${period} 的學生，改以課程 ${courseType} 全部學生為基準比對`);
            }
        }

        console.log(`📚 該班級學生數: ${classStudents.length}`);

        if (classStudents.length === 0) {
            return res.json({
                success: true,
                allAbsent: false,
                totalStudents: 0,
                absentStudents: 0,
                students: [],
                message: '該課程沒有學生'
            });
        }

        // 🔥 檢查每位學生在指定日期的出缺席狀態
        const studentsStatus = classStudents.map(student => {
            const attendance = student.attendance || [];
            const dateRecord = attendance.find(record => record.date === date);

            let status = 'unknown'; // 未簽到
            if (dateRecord) {
                if (dateRecord.present === true) {
                    status = 'present'; // 出席
                } else if (dateRecord.present === 'leave') {
                    status = 'leave'; // 請假
                } else if (dateRecord.present === false) {
                    status = 'absent'; // 缺席
                }
            }

            return {
                name: student.name,
                status: status,
                period: student.period
            };
        });

        // 🔥 判斷是否全班缺席
        // 定義：所有學生都是「請假」或「缺席」，且至少有一位學生
        const absentCount = studentsStatus.filter(s => 
            s.status === 'leave' || s.status === 'absent'
        ).length;

        const allAbsent = absentCount === classStudents.length && classStudents.length > 0;

        console.log(`📊 缺席統計: ${absentCount}/${classStudents.length} (全班缺席: ${allAbsent})`);

        res.json({
            success: true,
            allAbsent: allAbsent,
            totalStudents: classStudents.length,
            absentStudents: absentCount,
            students: studentsStatus,
            courseType: courseType,
            period: period,
            date: date
        });

    } catch (error) {
        console.error('❌ 檢查班級缺席 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤: ' + error.message
        });
    }
});

// ==================== 🔥 全班缺席通知 API ====================

/**
 * POST /api/notify-class-cancellation - 發送全班缺席停課通知
 */
app.post('/api/notify-class-cancellation', async (req, res) => {
    try {
        const { eventId, date, courseType, teacherName, totalStudents, time } = req.body;
        
        if (!date || !courseType || !teacherName) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數 (date, courseType, teacherName)'
            });
        }
        
        console.log('📢 準備發送全班缺席停課通知:', { date, courseType, teacherName, totalStudents });
        
        // 🔥 載入 Flex Message 模板
        const flexTemplatePath = path.join(__dirname, 'flex-message-templates.json');
        if (!fs.existsSync(flexTemplatePath)) {
            throw new Error('Flex Message 模板檔案不存在');
        }
        
        const flexTemplates = JSON.parse(fs.readFileSync(flexTemplatePath, 'utf8'));
        const templateData = flexTemplates.templates.class_cancelled;
        
        if (!templateData) {
            throw new Error('找不到 class_cancelled 模板');
        }
        
        // 🔥 替換模板變數
        const flexMessage = JSON.parse(JSON.stringify(templateData));
        const replacements = {
            '{teacherName}': teacherName,
            '{courseName}': courseType,
            '{date}': date,
            '{time}': time || '(未指定時間)',
            '{totalStudents}': totalStudents || '?'
        };
        
        // 遞迴替換所有字串中的變數
        function replaceInObject(obj) {
            for (let key in obj) {
                if (typeof obj[key] === 'string') {
                    for (let [placeholder, value] of Object.entries(replacements)) {
                        obj[key] = obj[key].replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
                    }
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    replaceInObject(obj[key]);
                }
            }
        }
        replaceInObject(flexMessage);
        
        // 🔥 讀取通知配置
        const notifConfigPath = path.join(__dirname, 'notification-config.json');
        const notifConfig = JSON.parse(fs.readFileSync(notifConfigPath, 'utf8'));
        
        const teacherGroupId = notifConfig?.roles?.teacher_group?.group_id;
        const staffGroupId = notifConfig?.roles?.admin?.group_id;
        
        const results = [];
        
        // 🔥 1. 發送給講師個人（若找得到 userId）
        const teacherUserId = getTeacherUserId(teacherName);
        if (teacherUserId) {
            console.log(`📤 發送通知給講師個人: ${teacherName} (${teacherUserId})`);
            try {
                const result = await notificationManager.sendLineMessage(
                    teacherUserId,
                    '',
                    { type: 'flex', altText: '⚠️ 全班缺席停課通知', contents: flexMessage }
                );
                results.push({ target: '講師個人', success: result.success, userId: teacherUserId });
            } catch (err) {
                console.error(`❌ 發送給講師個人失敗:`, err);
                results.push({ target: '講師個人', success: false, error: err.message });
            }
        } else {
            console.log(`⚠️ 找不到講師 ${teacherName} 的 userId，跳過個人通知`);
            results.push({ target: '講師個人', success: false, error: '找不到講師 userId' });
        }
        
        // 🔥 2. 發送給講師群組
        if (teacherGroupId) {
            console.log(`📤 發送通知給講師群組: ${teacherGroupId}`);
            try {
                const result = await notificationManager.sendLineMessage(
                    teacherGroupId,
                    '',
                    { type: 'flex', altText: '⚠️ 全班缺席停課通知', contents: flexMessage }
                );
                results.push({ target: '講師群組', success: result.success, groupId: teacherGroupId });
            } catch (err) {
                console.error(`❌ 發送給講師群組失敗:`, err);
                results.push({ target: '講師群組', success: false, error: err.message });
            }
        } else {
            console.log(`⚠️ 未設定講師群組 ID，跳過講師群組通知`);
            results.push({ target: '講師群組', success: false, error: '未設定講師群組 ID' });
        }
        
        // 🔥 3. 發送給正職群組
        if (staffGroupId) {
            console.log(`📤 發送通知給正職群組: ${staffGroupId}`);
            try {
                const result = await notificationManager.sendLineMessage(
                    staffGroupId,
                    '',
                    { type: 'flex', altText: '⚠️ 全班缺席停課通知', contents: flexMessage }
                );
                results.push({ target: '正職群組', success: result.success, groupId: staffGroupId });
            } catch (err) {
                console.error(`❌ 發送給正職群組失敗:`, err);
                results.push({ target: '正職群組', success: false, error: err.message });
            }
        } else {
            console.log(`⚠️ 未設定正職群組 ID，跳過正職群組通知`);
            results.push({ target: '正職群組', success: false, error: '未設定正職群組 ID' });
        }
        
        const successCount = results.filter(r => r.success).length;
        console.log(`✅ 全班缺席通知發送完成: ${successCount}/${results.length} 成功`);
        
        res.json({
            success: successCount > 0,
            message: `通知已發送 (${successCount}/${results.length} 成功)`,
            results: results
        });
        
    } catch (error) {
        console.error('❌ 發送全班缺席通知失敗:', error);
        res.status(500).json({
            success: false,
            error: '發送通知失敗',
            message: error.message
        });
    }
});

/**
 * POST /api/notify-class-resumption - 發送課程恢復上課通知
 */
app.post('/api/notify-class-resumption', async (req, res) => {
    try {
        const { eventId, date, courseType, teacherName, studentName, attendCount, totalStudents, time } = req.body;
        
        if (!date || !courseType || !teacherName || !studentName) {
            return res.status(400).json({
                success: false,
                error: '缺少必要參數 (date, courseType, teacherName, studentName)'
            });
        }
        
        console.log('📢 準備發送課程恢復上課通知:', { date, courseType, teacherName, studentName, attendCount, totalStudents });
        
        // 🔥 載入 Flex Message 模板
        const flexTemplatePath = path.join(__dirname, 'flex-message-templates.json');
        if (!fs.existsSync(flexTemplatePath)) {
            throw new Error('Flex Message 模板檔案不存在');
        }
        
        const flexTemplates = JSON.parse(fs.readFileSync(flexTemplatePath, 'utf8'));
        const templateData = flexTemplates.templates.class_resumed;
        
        if (!templateData) {
            throw new Error('找不到 class_resumed 模板');
        }
        
        // 🔥 替換模板變數
        const flexMessage = JSON.parse(JSON.stringify(templateData));
        const replacements = {
            '{teacherName}': teacherName,
            '{courseName}': courseType,
            '{date}': date,
            '{time}': time || '(未指定時間)',
            '{studentName}': studentName,
            '{attendCount}': attendCount || '?',
            '{totalStudents}': totalStudents || '?'
        };
        
        // 遞迴替換所有字串中的變數
        function replaceInObject(obj) {
            for (let key in obj) {
                if (typeof obj[key] === 'string') {
                    for (let [placeholder, value] of Object.entries(replacements)) {
                        obj[key] = obj[key].replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
                    }
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    replaceInObject(obj[key]);
                }
            }
        }
        replaceInObject(flexMessage);
        
        // 🔥 讀取通知配置
        const notifConfigPath = path.join(__dirname, 'notification-config.json');
        const notifConfig = JSON.parse(fs.readFileSync(notifConfigPath, 'utf8'));
        
        const teacherGroupId = notifConfig?.roles?.teacher_group?.group_id;
        const staffGroupId = notifConfig?.roles?.admin?.group_id;
        
        const results = [];
        
        // 🔥 1. 發送給講師個人（若找得到 userId）
        const teacherUserId = getTeacherUserId(teacherName);
        if (teacherUserId) {
            console.log(`📤 發送通知給講師個人: ${teacherName} (${teacherUserId})`);
            try {
                const result = await notificationManager.sendLineMessage(
                    teacherUserId,
                    '',
                    { type: 'flex', altText: '✅ 課程恢復上課通知', contents: flexMessage }
                );
                results.push({ target: '講師個人', success: result.success, userId: teacherUserId });
            } catch (err) {
                console.error(`❌ 發送給講師個人失敗:`, err);
                results.push({ target: '講師個人', success: false, error: err.message });
            }
        } else {
            console.log(`⚠️ 找不到講師 ${teacherName} 的 userId，跳過個人通知`);
            results.push({ target: '講師個人', success: false, error: '找不到講師 userId' });
        }
        
        // 🔥 2. 發送給講師群組
        if (teacherGroupId) {
            console.log(`📤 發送通知給講師群組: ${teacherGroupId}`);
            try {
                const result = await notificationManager.sendLineMessage(
                    teacherGroupId,
                    '',
                    { type: 'flex', altText: '✅ 課程恢復上課通知', contents: flexMessage }
                );
                results.push({ target: '講師群組', success: result.success, groupId: teacherGroupId });
            } catch (err) {
                console.error(`❌ 發送給講師群組失敗:`, err);
                results.push({ target: '講師群組', success: false, error: err.message });
            }
        } else {
            console.log(`⚠️ 未設定講師群組 ID，跳過講師群組通知`);
            results.push({ target: '講師群組', success: false, error: '未設定講師群組 ID' });
        }
        
        // 🔥 3. 發送給正職群組
        if (staffGroupId) {
            console.log(`📤 發送通知給正職群組: ${staffGroupId}`);
            try {
                const result = await notificationManager.sendLineMessage(
                    staffGroupId,
                    '',
                    { type: 'flex', altText: '✅ 課程恢復上課通知', contents: flexMessage }
                );
                results.push({ target: '正職群組', success: result.success, groupId: staffGroupId });
            } catch (err) {
                console.error(`❌ 發送給正職群組失敗:`, err);
                results.push({ target: '正職群組', success: false, error: err.message });
            }
        } else {
            console.log(`⚠️ 未設定正職群組 ID，跳過正職群組通知`);
            results.push({ target: '正職群組', success: false, error: '未設定正職群組 ID' });
        }
        
        const successCount = results.filter(r => r.success).length;
        console.log(`✅ 恢復上課通知發送完成: ${successCount}/${results.length} 成功`);
        
        res.json({
            success: successCount > 0,
            message: `通知已發送 (${successCount}/${results.length} 成功)`,
            results: results
        });
        
    } catch (error) {
        console.error('❌ 發送恢復上課通知失敗:', error);
        res.status(500).json({
            success: false,
            error: '發送通知失敗',
            message: error.message
        });
    }
});

/**
 * GET /api/leave-records - 獲取所有請假記錄
 */
app.get('/api/leave-records', (req, res) => {
    try {
        const leaveRecordsPath = path.join(__dirname, 'data', 'leave-records.json');
        
        if (!fs.existsSync(leaveRecordsPath)) {
            return res.json({
                success: true,
                records: []
            });
        }

        const leaveRecords = JSON.parse(fs.readFileSync(leaveRecordsPath, 'utf8'));
        
        // 按日期倒序排列（最新的在前面）
        leaveRecords.records.sort((a, b) => {
            return new Date(b.registeredAt) - new Date(a.registeredAt);
        });

        res.json({
            success: true,
            records: leaveRecords.records
        });

    } catch (error) {
        console.error('❌ 讀取請假記錄 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: '伺服器錯誤: ' + error.message
        });
    }
});

/**
 * PUT /api/leave-records/:id - 更新請假記錄
 */
app.put('/api/leave-records/:id', async (req, res) => {
    try {
        const recordId = req.params.id;
        const { studentName, course, date, weekday, reason, userId } = req.body;

        console.log(`🔄 更新請假記錄 [ID: ${recordId}]:`, { studentName, course, date, weekday, reason, userId });

        // 🔥 驗證必要欄位
        if (!studentName || !course || !date) {
            return res.status(400).json({
                success: false,
                message: '缺少必要欄位'
            });
        }

        const leaveRecordsPath = path.join(__dirname, 'data', 'leave-records.json');
        
        // 讀取現有記錄
        let leaveRecords = { records: [] };
        if (fs.existsSync(leaveRecordsPath)) {
            leaveRecords = JSON.parse(fs.readFileSync(leaveRecordsPath, 'utf8'));
        }

        // 找到要更新的記錄
        const recordIndex = leaveRecords.records.findIndex(r => r.id === recordId);
        
        if (recordIndex === -1) {
            return res.status(404).json({
                success: false,
                message: '找不到該請假記錄'
            });
        }

        // 取得舊記錄（用於 Google Sheets 清除）
        const oldRecord = leaveRecords.records[recordIndex];

        // 🔥 更新記錄（包含 userId）
        leaveRecords.records[recordIndex] = {
            ...oldRecord,
            studentName: studentName,
            course: course,
            date: date,
            weekday: weekday,
            reason: reason || '未填寫',
            userId: userId || oldRecord.userId || '',  // 🔥 支持 userId 更新
            updatedAt: new Date().toISOString()  // 新增更新時間
        };

        // 保存到檔案
        fs.writeFileSync(leaveRecordsPath, JSON.stringify(leaveRecords, null, 2), 'utf8');
        console.log(`✅ 請假記錄已更新 [ID: ${recordId}]`);

        // 🔥 如果日期或學生有變更，更新 Google Sheets
        const dateChanged = oldRecord.date !== date;
        const studentChanged = oldRecord.studentName !== studentName || oldRecord.course !== course;

        if (dateChanged || studentChanged) {
            try {
                console.log('🔄 同步更新 Google Sheets...');
                
                // 1. 清除舊日期的標記（如果日期改變了）
                if (dateChanged) {
                    try {
                        const clearOldResult = await googleSheetsClient.markLeave(
                            oldRecord.studentName,
                            oldRecord.course,
                            oldRecord.date,
                            false  // 清除標記
                        );
                        if (clearOldResult.success) {
                            console.log(`✅ 已清除舊日期 ${oldRecord.date} 的請假標記`);
                        }
                    } catch (error) {
                        console.error(`⚠️ 清除舊標記失敗:`, error);
                    }
                }

                // 2. 在新日期標記請假
                const markResult = await googleSheetsClient.markLeave(
                    studentName,
                    course,
                    date,
                    true  // 標記請假
                );

                if (markResult.success) {
                    console.log(`✅ 已在 Google Sheets 標記新日期 ${date} 為請假`);
                } else {
                    console.warn(`⚠️ Google Sheets 更新失敗: ${markResult.error}`);
                }
            } catch (error) {
                console.error('❌ Google Sheets 同步失敗:', error);
            }
        }

        res.json({
            success: true,
            message: '更新成功',
            record: leaveRecords.records[recordIndex]
        });

    } catch (error) {
        console.error('❌ 更新請假記錄 API 錯誤:', error);
        res.status(500).json({
            success: false,
            message: '伺服器錯誤: ' + error.message
        });
    }
});

/**
 * 🔥 輔助函數：發送請假通知
 */
async function sendLeaveNotification(studentName, courseName, date, reason, weekday, targets = ['staff', 'parent']) {
    console.log(`📢 開始發送請假通知...`);
    
    try {
        // 🔥 查詢學生資料（取得 userId）
        const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
        let studentUserId = null;
        
        if (fs.existsSync(studentDataPath)) {
            const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
            const student = studentData.students?.find(s => s.name === studentName && s.course === courseName);
            if (student && student.userId) {
                studentUserId = student.userId;
                console.log(`   - 找到學生 LINE ID: ${studentUserId}`);
            }
        }

        // 🔥 準備 Flex Message 變數
        const now = new Date();
        const variables = {
            studentName: studentName,
            courseName: courseName,
            courseDate: date,
            weekday: `星期${weekday}`,
            courseTime: '(請假日)',
            location: '(請假)',
            leaveReason: reason || '未填寫',
            replyTime: now.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
        };

        const results = [];

        // 🔥 發送給正職群組（必發）
        if (targets.includes('staff')) {
            try {
                const staffGroupId = getStaffGroupId();
                console.log(`   - 發送給正職群組: ${staffGroupId}`);
                
                const flexMessage = notificationManager.buildFlexMessage('leaveConfirmation', variables);
                
                if (flexMessage) {
                    const staffResult = await notificationManager.sendLineMessage(
                        staffGroupId,
                        `✅ 學生請假確認 - ${studentName}`,
                        { flexMessage, altText: `✅ 學生請假確認 - ${studentName}` }
                    );
                    results.push({ target: 'staff', success: staffResult.success });
                } else {
                    console.warn('⚠️ Flex Message 建立失敗，使用純文字');
                    const textMessage = `✅ 學生請假確認\n\n📋 已完成請假登記\n\n👤 學生：${studentName}\n📚 課程：${courseName}\n📅 日期：${date} 星期${weekday}\n🏥 請假理由：${reason || '未填寫'}\n⏱️ 登記時間：${variables.replyTime}`;
                    
                    const staffResult = await notificationManager.sendLineMessage(staffGroupId, textMessage);
                    results.push({ target: 'staff', success: staffResult.success });
                }
            } catch (error) {
                console.error('❌ 發送給正職群組失敗:', error);
                results.push({ target: 'staff', success: false, error: error.message });
            }
        }

        // 🔥 發送給家長（若有 userId）
        if (targets.includes('parent') && studentUserId) {
            try {
                console.log(`   - 發送給家長: ${studentUserId}`);
                
                const flexMessage = notificationManager.buildFlexMessage('leaveConfirmation', variables);
                
                if (flexMessage) {
                    const parentResult = await notificationManager.sendLineMessage(
                        studentUserId,
                        `✅ 學生請假確認 - ${studentName}`,
                        { flexMessage, altText: `✅ 學生請假確認 - ${studentName}` }
                    );
                    results.push({ target: 'parent', success: parentResult.success });
                } else {
                    const textMessage = `✅ 學生請假確認\n\n📋 已完成請假登記\n\n👤 學生：${studentName}\n📚 課程：${courseName}\n📅 日期：${date} 星期${weekday}\n🏥 請假理由：${reason || '未填寫'}\n⏱️ 登記時間：${variables.replyTime}`;
                    
                    const parentResult = await notificationManager.sendLineMessage(studentUserId, textMessage);
                    results.push({ target: 'parent', success: parentResult.success });
                }
            } catch (error) {
                console.error('❌ 發送給家長失敗:', error);
                results.push({ target: 'parent', success: false, error: error.message });
            }
        } else if (targets.includes('parent') && !studentUserId) {
            console.log('   - 跳過家長通知（無 LINE ID）');
            results.push({ target: 'parent', success: false, error: '無 LINE ID' });
        }

        const allSuccess = results.every(r => r.success);
        console.log(`${allSuccess ? '✅' : '⚠️'} 請假通知發送完成:`, results);

        return {
            success: allSuccess,
            message: '通知發送完成',
            results: results
        };

    } catch (error) {
        console.error('❌ 發送請假通知失敗:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 🎠 智能通知合併：相同家長的請假用 Carousel，不同家長分別發送
 * @param {Array} leaveRecords - 成功的請假記錄
 * @param {Object} allLeaveRecords - 全部請假記錄（用於更新狀態）
 */
async function sendSmartLeaveNotifications(leaveRecords, allLeaveRecords) {
    console.log('🎠 智能通知合併開始...');
    
    try {
        // 讀取學生資料
        const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
        let studentData = { students: [] };
        
        if (fs.existsSync(studentDataPath)) {
            studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
        }
        
        // 🔥 步驟 1：為每個請假記錄找到對應的學生 userId
        // 修復：改用學生姓名匹配（不限定課程），避免課程類別不匹配導致找不到 userId
        const enrichedRecords = leaveRecords.map(record => {
            // 優先匹配 name + course，若找不到則只用 name 匹配（取第一個同名學生的 userId）
            let student = studentData.students?.find(
                s => s.name === record.studentName && s.course === record.courseName
            );
            
            if (!student) {
                // 降級策略：只用姓名匹配（適用於學生有多個課程的情況）
                student = studentData.students?.find(s => s.name === record.studentName);
                if (student) {
                    console.log(`⚠️ 學生 ${record.studentName} 使用姓名匹配找到 userId（請假課程: ${record.courseName}, 匹配課程: ${student.course}）`);
                }
            }
            
            return {
                ...record,
                userId: student?.userId || null,
                matchedCourse: student?.course || null // 記錄實際匹配到的課程
            };
        });
        
        // 🔥 步驟 2：按 userId 分組
        const groupedByUserId = {};
        enrichedRecords.forEach(record => {
            const userId = record.userId || 'no-user-id';
            if (!groupedByUserId[userId]) {
                groupedByUserId[userId] = [];
            }
            groupedByUserId[userId].push(record);
        });
        
        console.log(`📊 分組結果: ${Object.keys(groupedByUserId).length} 個家長`);
        
        // 🔥 步驟 3：正職群組通知（所有請假記錄合併為一個 Carousel）
        const staffGroupId = getStaffGroupId();
        try {
            if (enrichedRecords.length === 1) {
                // 單一請假：發送單一 Bubble
                const record = enrichedRecords[0];
                const flexMessage = notificationManager.buildFlexMessage('leaveConfirmation', {
                    studentName: record.studentName,
                    courseName: record.courseName,
                    courseDate: record.date,
                    weekday: `星期${record.weekday}`,
                    courseTime: '(請假日)',
                    location: '(請假)',
                    leaveReason: record.reason || '未填寫',
                    replyTime: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
                });
                
                await notificationManager.sendLineMessage(
                    staffGroupId,
                    `✅ 學生請假確認 - ${record.studentName}`,
                    { flexMessage, altText: `✅ 學生請假確認 - ${record.studentName}` }
                );
                console.log(`✅ 正職群組：發送單一請假通知`);
                
            } else {
                // 多個請假：發送 Carousel
                const bubbles = enrichedRecords.map(record => ({
                    ...notificationManager.buildFlexMessage('leaveConfirmation', {
                        studentName: record.studentName,
                        courseName: record.courseName,
                        courseDate: record.date,
                        weekday: `星期${record.weekday}`,
                        courseTime: '(請假日)',
                        location: '(請假)',
                        leaveReason: record.reason || '未填寫',
                        replyTime: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
                    })
                }));
                
                const carouselMessage = {
                    type: 'carousel',
                    contents: bubbles
                };
                
                await notificationManager.sendLineMessage(
                    staffGroupId,
                    `✅ 學生請假確認 - ${enrichedRecords.length} 位學生`,
                    { 
                        flexMessage: carouselMessage,
                        altText: `✅ 學生請假確認 - ${enrichedRecords.length} 位學生`
                    }
                );
                console.log(`🎠 正職群組：發送 Carousel (${enrichedRecords.length} 位學生)`);
            }
        } catch (error) {
            console.error('❌ 正職群組通知失敗:', error);
        }
        
        // 🔥 步驟 4：家長通知（相同 userId 合併為 Carousel）
        for (const [userId, records] of Object.entries(groupedByUserId)) {
            if (userId === 'no-user-id') {
                console.log(`⏭️ 跳過無 LINE ID 的學生 (${records.length} 位)`);
                continue;
            }
            
            try {
                if (records.length === 1) {
                    // 單一孩子請假：發送單一 Bubble
                    const record = records[0];
                    const flexMessage = notificationManager.buildFlexMessage('leaveConfirmation', {
                        studentName: record.studentName,
                        courseName: record.courseName,
                        courseDate: record.date,
                        weekday: `星期${record.weekday}`,
                        courseTime: '(請假日)',
                        location: '(請假)',
                        leaveReason: record.reason || '未填寫',
                        replyTime: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
                    });
                    
                    await notificationManager.sendLineMessage(
                        userId,
                        `✅ 學生請假確認 - ${record.studentName}`,
                        { flexMessage, altText: `✅ 學生請假確認 - ${record.studentName}` }
                    );
                    console.log(`✅ 家長 ${userId}: 發送單一請假通知`);
                    
                } else {
                    // 多個孩子請假：發送 Carousel
                    const bubbles = records.map(record => ({
                        ...notificationManager.buildFlexMessage('leaveConfirmation', {
                            studentName: record.studentName,
                            courseName: record.courseName,
                            courseDate: record.date,
                            weekday: `星期${record.weekday}`,
                            courseTime: '(請假日)',
                            location: '(請假)',
                            leaveReason: record.reason || '未填寫',
                            replyTime: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
                        })
                    }));
                    
                    const carouselMessage = {
                        type: 'carousel',
                        contents: bubbles
                    };
                    
                    await notificationManager.sendLineMessage(
                        userId,
                        `✅ 學生請假確認 - ${records.length} 位孩子`,
                        { 
                            flexMessage: carouselMessage,
                            altText: `✅ 學生請假確認 - ${records.length} 位孩子`
                        }
                    );
                    console.log(`🎠 家長 ${userId}: 發送 Carousel (${records.length} 位孩子)`);
                }
                
                // 更新通知狀態
                records.forEach(record => {
                    const idx = allLeaveRecords.records.findIndex(r => r.id === record.id);
                    if (idx >= 0) {
                        allLeaveRecords.records[idx].notified = true;
                        allLeaveRecords.records[idx].notifiedAt = new Date().toISOString();
                        allLeaveRecords.records[idx].notifyTargets = ['staff', 'parent'];
                    }
                });
                
            } catch (error) {
                console.error(`❌ 家長 ${userId} 通知失敗:`, error);
            }
        }
        
        console.log('🎠 智能通知合併完成');
        
        return { success: true };
        
    } catch (error) {
        console.error('❌ 智能通知合併失敗:', error);
        return { success: false, error: error.message };
    }
}

// ==================== 🔍 調試 API：查看學生列表 ====================

app.get('/api/attendance/debug/students', async (req, res) => {
    try {
        if (!fastAttendance.initialized) {
            await fastAttendance.initialize();
        }
        
        const studentIndex = await fastAttendance.sheetsClient.buildStudentIndex();
        const limit = parseInt(req.query.limit) || 20;
        
        const students = Array.from(studentIndex.entries())
            .slice(0, limit)
            .map(([name, data]) => ({
                name: name,
                courses: data.courses,
                userRow: data.userRow,
                userId: data.userId
            }));
        
        res.json({
            success: true,
            totalStudents: studentIndex.size,
            displayCount: students.length,
            students: students,
            message: `共有 ${studentIndex.size} 位學生（顯示前 ${students.length} 位）`
        });
    } catch (error) {
        console.error('❌ 調試 API 錯誤:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: error.stack
        });
    }
});

// ==================== 📚 學生資料 API（從 Google Sheets 即時讀取）====================

/**
 * 🚀 獲取所有學生資料（從 Google Sheets 即時讀取）
 * GET /api/students/from-sheets
 * 
 * Response 格式完全對接現有 student_data.json:
 * {
 *   success: true,
 *   count: 90,
 *   students: [
 *     {
 *       name: "學生姓名",
 *       course: "課程名稱",
 *       period: "時段",
 *       remaining: 10,
 *       userId: "LINE User ID",
 *       coursePlan: "課程計畫",
 *       remainingFromCourseSheet: 10,
 *       attendance: [{date: "2025-10-27", present: true}],
 *       periodParsed: {valid: true, weekdays: ["一"], ...}
 *     }
 *   ]
 * }
 */
app.get('/api/students/from-sheets', async (req, res) => {
    try {
        console.log('📚 請求學生資料（從 Google Sheets）');
        const startTime = Date.now();

        const data = await googleSheetsStudents.getAllStudents();
        const elapsed = Date.now() - startTime;

        res.json({
            ...data,
            source: 'google-sheets',
            cached: googleSheetsStudents.isCacheValid(),
            responseTime: elapsed,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ 獲取學生資料失敗:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * 🔄 清除學生資料快取
 * POST /api/students/clear-cache
 */
app.post('/api/students/clear-cache', (req, res) => {
    try {
        googleSheetsStudents.clearCache();
        res.json({
            success: true,
            message: '✅ 學生資料快取已清除'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * 🎯 按課程獲取學生（場景化優化 - 學生簽到專用）
 * GET /api/students/by-course?course=SPM
 * 
 * 使用場景：
 * - 講師點開某課程的學生簽到頁面
 * - 只讀取該課程的學生資料（比讀取全部快 75%）
 * 
 * Response 格式與 /api/students/from-sheets 相同，但只包含該課程的學生
 */
app.get('/api/students/by-course', async (req, res) => {
    try {
        const { course } = req.query;
        
        if (!course) {
            return res.status(400).json({
                success: false,
                error: '缺少 course 參數'
            });
        }

        console.log(`🎯 場景化請求: ${course} 課程學生資料`);
        const startTime = Date.now();

        const data = await googleSheetsStudents.getStudentsByCourse(course);
        const elapsed = Date.now() - startTime;

        res.json({
            ...data,
            source: 'google-sheets',
            responseTime: elapsed,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error(`❌ 獲取課程學生失敗 (${req.query.course}):`, error);
        res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// 🔥 新增：快速簽到隊列API（立即返回，後台處理）
app.post('/api/attendance/queue', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const { 
            teacher, 
            course, 
            time, 
            start, 
            end, 
            studentId, 
            studentName, 
            attendanceStatus, // 'present' 或 'absent'
            eventId,
            courseTopic,
            courseCategory,
            lessonUrl
        } = req.body;
        
        console.log('⚡ 收到簽到請求:', { 
            studentName, 
            attendanceStatus, 
            teacher, 
            course 
        });
        
        // ========== 第一步：驗證必要參數 ==========
        if (!studentName || !attendanceStatus) {
            return res.status(400).json({
                success: false,
                error: 'MISSING_PARAMS',
                message: '缺少必要參數：studentName 和 attendanceStatus'
            });
        }
        
        if (!['present', 'absent'].includes(attendanceStatus)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_STATUS',
                message: '無效的簽到狀態'
            });
        }
        
        // ========== 第二步：驗證學生是否存在 ==========
        const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
        const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
        
        let studentExists = false;
        let isTrialStudent = false;  // 體驗課學生
        let isMakeupStudent = false; // 補課學生
        let studentInfo = null;
        
        // 先檢查是否為臨時學生（體驗課/補課）
        if (fs.existsSync(tempDataPath)) {
            const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
            if (!tempData || !Array.isArray(tempData.students)) {
                console.error('❌ temporary_students.json 格式錯誤: students 陣列不存在');
                return res.status(500).json({ success: false, error: 'temporary_students.json 格式錯誤' });
            }
            const tempStudent = tempData.students.find(s => s.name === studentName);
            
            if (tempStudent) {
                if (tempStudent.type === 'trial') {
                    // 體驗課學生：不在 student_data.json，只在 temporary_students.json
                    isTrialStudent = true;
                    studentExists = true;
                    studentInfo = {
                        name: tempStudent.name,
                        course: tempStudent.course,
                        isTemporary: true,
                        isTrial: true
                    };
                    console.log(`🎓 檢測到體驗課學生: ${studentName}`);
                } else if (tempStudent.type === 'makeup') {
                    // 補課學生：在 student_data.json 中有，要走真實簽到
                    isMakeupStudent = true;
                    console.log(`🔄 檢測到補課學生: ${studentName} (正式學生補課)`);
                }
            }
        }
        
        // 檢查正式學生（包括補課學生）
        if (!isTrialStudent && fs.existsSync(studentDataPath)) {
            const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
            if (!studentData || !Array.isArray(studentData.students)) {
                console.error('❌ student_data.json 格式錯誤: students 陣列不存在');
                return res.status(500).json({ success: false, error: 'student_data.json 格式錯誤' });
            }
            const student = studentData.students.find(s => s.name === studentName);
            
            if (student) {
                studentExists = true;
                studentInfo = {
                    name: student.name,
                    course: student.course,
                    remaining: student.remaining
                };
            }
        }
        
        if (!studentExists) {
            return res.status(404).json({
                success: false,
                error: 'STUDENT_NOT_FOUND',
                message: `找不到學生：${studentName}`
            });
        }
        
        console.log('✅ 學生驗證通過:', studentInfo);
        
        // ========== 第三步：檢查重複提交 ==========
        const today = new Date().toISOString().split('T')[0];
        const queue = attendanceQueueManager.readQueue();
        
        const duplicate = queue.find(r => 
            r.studentName === studentName &&
            r.date === today &&
            r.course === course &&
            r.time === time &&
            r.status !== 'failed'
        );
        
        if (duplicate) {
            console.log('⚠️ 發現重複提交:', duplicate.id);
            
            return res.json({
                success: true,
                duplicate: true,
                message: '此記錄已在處理隊列中',
                recordId: duplicate.id,
                studentInfo: studentInfo
            });
        }
        
        // ========== 第四步：立即更新 student_data.json（樂觀更新）==========
        let previousState = null; // 用於回退
        let updatedRemaining = studentInfo.remaining;
        
        // 🔥 體驗課學生：只更新 temporary_students.json，不走真實簽到
        if (isTrialStudent) {
            console.log('📝 體驗課學生：只更新臨時記錄');
            
            const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
            if (!tempData || !Array.isArray(tempData.students)) {
                console.error('❌ temporary_students.json 格式錯誤: students 陣列不存在');
                throw new Error('temporary_students.json 格式錯誤');
            }
            const tempStudent = tempData.students.find(s => s.name === studentName);
            
            if (tempStudent) {
                // 初始化 attendance 陣列
                if (!tempStudent.attendance) {
                    tempStudent.attendance = [];
                }
                
                // 保存更新前的狀態
                previousState = {
                    attendance: JSON.parse(JSON.stringify(tempStudent.attendance))
                };
                
                // 更新或新增出席記錄
                const existingIndex = tempStudent.attendance.findIndex(a => a.date === today);
                const newAttendanceRecord = {
                    date: today,
                    present: attendanceStatus === 'present' ? true : 
                             attendanceStatus === 'absent' ? false : 
                             'leave'
                };
                
                if (existingIndex >= 0) {
                    tempStudent.attendance[existingIndex] = newAttendanceRecord;
                } else {
                    tempStudent.attendance.push(newAttendanceRecord);
                }
                
                // 寫回檔案
                if (!tempData || !Array.isArray(tempData.students)) {
                    console.error('❌ temporary_students.json 格式錯誤: students 陣列不存在');
                    throw new Error('temporary_students.json 格式錯誤');
                }
                const studentIdx = tempData.students.findIndex(s => s.name === studentName);
                if (studentIdx >= 0) {
                    tempData.students[studentIdx] = tempStudent;
                    fs.writeFileSync(tempDataPath, JSON.stringify(tempData, null, 2), 'utf8');
                }
                
                console.log('✅ 體驗課學生臨時記錄已更新:', {
                    student: studentName,
                    date: today,
                    status: attendanceStatus
                });
                
                updatedRemaining = tempStudent.remaining || 1;
                studentInfo.remaining = updatedRemaining;
            }
        } else if (!isTrialStudent) {
            // 🔥 正常學生（包括補課學生）：更新 student_data.json
            console.log('📝 立即更新 student_data.json');
            
            const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
            if (!studentData || !Array.isArray(studentData.students)) {
                console.error('❌ student_data.json 格式錯誤: students 陣列不存在');
                throw new Error('student_data.json 格式錯誤');
            }
            const student = studentData.students.find(s => s.name === studentName);
            
            if (student) {
                // 初始化 attendance 陣列（如果不存在）
                if (!student.attendance) {
                    student.attendance = [];
                }
                
                // 🔥 檢查這個日期之前的出席狀態
                const previousAttendance = student.attendance.find(a => a.date === today);
                const wasPreviouslyPresent = previousAttendance?.present === true;
                const isNowPresent = attendanceStatus === 'present';
                
                // 保存更新前的狀態（用於失敗回退）
                previousState = {
                    attendance: JSON.parse(JSON.stringify(student.attendance)),
                    remaining: student.remaining,
                    previousAttendanceRecord: previousAttendance ? {...previousAttendance} : null
                };
                
                // 🔥 智能計算剩餘堂數變化
                let remainingChange = 0;
                
                if (wasPreviouslyPresent && !isNowPresent) {
                    // 情況 1: 之前出席 → 現在改為缺席/請假 = +1 堂（還回來）
                    remainingChange = +1;
                    console.log('🔄 之前已出席，現在改為缺席/請假 → 還回 1 堂');
                } else if (!wasPreviouslyPresent && isNowPresent) {
                    // 情況 2: 之前缺席/請假/無記錄 → 現在改為出席 = -1 堂
                    remainingChange = -1;
                    console.log('🔄 之前未出席，現在改為出席 → 扣除 1 堂');
                } else {
                    // 情況 3: 缺席→請假、請假→缺席、出席→出席 = 不變
                    remainingChange = 0;
                    console.log('🔄 狀態變更但不影響堂數');
                }
                
                // 更新 remaining
                if (remainingChange !== 0) {
                    student.remaining += remainingChange;
                    updatedRemaining = student.remaining;
                    console.log(`📚 堂數變化: ${remainingChange > 0 ? '+' : ''}${remainingChange} → 剩餘 ${updatedRemaining} 堂`);
                }
                
                // 🔥 更新或新增出席記錄
                const existingIndex = student.attendance.findIndex(a => a.date === today);
                const newAttendanceRecord = {
                    date: today,
                    present: attendanceStatus === 'present' ? true : 
                             attendanceStatus === 'absent' ? false : 
                             'leave'
                };
                
                if (existingIndex >= 0) {
                    // 更新現有記錄
                    student.attendance[existingIndex] = newAttendanceRecord;
                } else {
                    // 新增記錄
                    student.attendance.push(newAttendanceRecord);
                }
                
                // 立即寫回檔案
                fs.writeFileSync(studentDataPath, JSON.stringify(studentData, null, 2), 'utf8');
                
                console.log('✅ student_data.json 已立即更新:', {
                    student: studentName,
                    date: today,
                    status: attendanceStatus,
                    remainingChange: remainingChange,
                    remaining: updatedRemaining,
                    wasPresent: wasPreviouslyPresent,
                    isPresent: isNowPresent
                });
                
                // 更新返回的學生資訊
                studentInfo.remaining = updatedRemaining;
            }
        }
        
        // ========== 第五步：寫入隊列（僅用於 Google Sheets 異步處理）==========
        // 🔥 體驗課學生不需要寫入 Google Sheets，直接返回成功
        if (isTrialStudent) {
            const processingTime = Date.now() - startTime;
            
            return res.json({
                success: true,
                message: '體驗課學生簽到成功',
                recordId: `trial-${studentName}-${today}`,
                studentInfo: studentInfo,
                isTrial: true,
                processingTime: processingTime
            });
        }
        
        const historyMeta = resolveCourseHistoryMeta({
            courseTopic,
            courseCategory,
            courseName: course,
            courseType: course,
            date: today,
            eventId,
            courseDisplayName: course
        });

        // 🔥 正常學生和補課學生：寫入隊列，等待同步到 Google Sheets
        const recordId = await attendanceQueueManager.addToQueue({
            teacher,
            course,
            time,
            start,
            end,
            studentId,
            studentName,
            attendanceStatus,
            date: today,
            isTemporaryStudent: false,  // 補課學生也按正常學生處理
            isMakeupStudent: isMakeupStudent,
            previousState, // 保存更新前的狀態，用於失敗回退
            courseTopic: historyMeta.courseTopic,
            courseCategory: historyMeta.courseCategory,
            courseNameForLog: historyMeta.courseName || course,
            lessonUrl,
            eventId
        });

        if (attendanceStatus !== 'present') {
            await studentCourseHistoryLogger.removeRecord({
                studentName,
                courseName: historyMeta.courseName || course,
                courseCategory: historyMeta.courseCategory,
                courseTopic: historyMeta.courseTopic,
                date: today
            });
        }
        
        const processingTime = Date.now() - startTime;
        
        console.log(`✅ 簽到記錄已加入隊列: ${recordId} (耗時 ${processingTime}ms)`);
        
        // ========== 第六步：返回確認 ==========
        res.json({
            success: true,
            message: '簽到記錄已確認並加入處理隊列',
            recordId: recordId,
            studentInfo: studentInfo,
            queued: true,
            timestamp: new Date().toISOString(),
            processingTime: processingTime
        });
        
    } catch (error) {
        console.error('❌ 處理簽到請求失敗:', error);
        
        res.status(500).json({
            success: false,
            error: 'SERVER_ERROR',
            message: '伺服器處理失敗: ' + error.message
        });
    }
});

// 🔥 新增：查詢隊列狀態API
app.get('/api/attendance/queue/stats', (req, res) => {
    try {
        const stats = attendanceQueueManager.getQueueStats(); 
        res.json({
            success: true,
            stats: stats
        });
    } catch (error) {
        console.error('❌ 獲取隊列統計失敗:', error);
        res.status(500).json({
            success: false,
            message: '獲取隊列統計失敗: ' + error.message
        });
    }
});

// 🔥 新增：手動重試失敗記錄API
app.post('/api/attendance/queue/retry-failed', async (req, res) => {
    try {
        await attendanceQueueManager.processQueue();
        const stats = attendanceQueueManager.getQueueStats();
        
        res.json({
            success: true,
            message: '已觸發隊列處理',
            stats: stats
        });
    } catch (error) {
        console.error('❌ 重試失敗記錄失敗:', error);
        res.status(500).json({
            success: false,
            message: '重試失敗記錄失敗: ' + error.message
        });
    }
});

// 更新學生簽到記錄到 student_data.json
app.post('/api/update-student-attendance', async (req, res) => {
  try {
    const { studentName, date, present } = req.body;
    
    console.log('📝 收到更新學生簽到記錄請求:', { studentName, date, present });
    
    if (!studentName || !date) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：studentName 和 date'
      });
    }
    
    // ========== 先檢查是否為臨時學生 ==========
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    if (fs.existsSync(tempDataPath)) {
      try {
        const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
        if (!tempData || !Array.isArray(tempData.students)) {
          console.error('❌ temporary_students.json 格式錯誤: students 陣列不存在');
          return { success: false, error: 'temporary_students.json 格式錯誤' };
        }
        const tempStudentIndex = tempData.students.findIndex(s => s.name === studentName);
        
        if (tempStudentIndex !== -1) {
          console.log('🎯 找到臨時學生，更新簽到記錄:', studentName);
          
          const tempStudent = tempData.students[tempStudentIndex];
          
          // 確保 attendance 陣列存在
          if (!tempStudent.attendance) {
            tempStudent.attendance = [];
          }
          
          // 查找是否已有該日期的記錄
          const existingRecordIndex = tempStudent.attendance.findIndex(record => record.date === date);
          
          if (existingRecordIndex !== -1) {
            // 更新現有記錄
            tempStudent.attendance[existingRecordIndex].present = present;
            console.log('✅ 更新臨時學生現有簽到記錄:', { studentName, date, present });
          } else {
            // 添加新記錄
            tempStudent.attendance.push({ date, present });
            console.log('✅ 添加臨時學生新簽到記錄:', { studentName, date, present });
          }
          
          // 更新最後出席日期
          if (present) {
            tempStudent.lastAttendanceDate = date;
            console.log('📅 更新臨時學生最後出席日期:', { studentName, lastAttendanceDate: date });
          }
          
          // 🚀 異步寫回臨時學生檔案（效能優化）
          await safeFile.writeJSON(tempDataPath, tempData);
          console.log('✅ temporary_students.json 更新成功（異步 + 鎖）');
          
          // 如果是補課學生，鏡像更新到 student_data.json（確保重新載入後不會重置）
          let mirroredResult = null;
          if (tempStudent.type === 'makeup') {
            try {
              const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
              if (fs.existsSync(studentDataPath)) {
                const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
                if (!studentData || !Array.isArray(studentData.students)) {
                    console.error('❌ student_data.json 格式錯誤: students 陣列不存在');
                    return res.status(500).json({ success: false, error: 'student_data.json 格式錯誤' });
                }
                const studentIndex = studentData.students.findIndex(s => s.name === studentName);
                if (studentIndex !== -1) {
                  const student = studentData.students[studentIndex];
                  if (!student.attendance) {
                    student.attendance = [];
                  }
                  const existingRecordIndex2 = student.attendance.findIndex(r => r.date === date);
                  if (existingRecordIndex2 !== -1) {
                    const oldPresent = student.attendance[existingRecordIndex2].present;
                    student.attendance[existingRecordIndex2].present = present;
                    // 依照原有邏輯調整 remaining
                    if (present && !oldPresent && (student.remaining || 0) > 0) {
                      student.remaining = Math.max(0, (student.remaining || 0) - 1);
                    } else if (!present && oldPresent === true) {
                      student.remaining = (student.remaining || 0) + 1;
                    }
                  } else {
                    student.attendance.push({ date, present });
                    if (present && (student.remaining || 0) > 0) {
                      student.remaining = Math.max(0, (student.remaining || 0) - 1);
                    }
                  }
                  // 更新最後出席日期
                  if (student.attendance && student.attendance.length > 0) {
                    const presentRecords = student.attendance.filter(r => r.present === true);
                    if (presentRecords.length > 0) {
                      presentRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
                      student.lastAttendanceDate = presentRecords[0].date;
                    }
                  }
                  await safeFile.writeJSON(studentDataPath, studentData);
                  console.log('✅ student_data.json（補課鏡像）更新成功（異步 + 鎖）');
                  mirroredResult = {
                    totalRecords: student.attendance.length,
                    remaining: student.remaining || 0,
                    lastAttendanceDate: student.lastAttendanceDate || null
                  };
                } else {
                  console.warn('⚠️ 找不到對應的正式學生，跳過鏡像更新:', studentName);
                }
              }
            } catch (mirrorErr) {
              console.error('⚠️ 補課鏡像更新 student_data.json 失敗:', mirrorErr);
            }
          }

          return res.json({
            success: true,
            message: '臨時學生簽到記錄更新成功',
            data: {
              studentName,
              date,
              present,
              isTemporary: true,
              totalRecords: tempStudent.attendance.length,
              mirroredToStudentData: tempStudent.type === 'makeup',
              ...(mirroredResult || {})
            }
          });
        }
      } catch (error) {
        console.error('⚠️ 檢查臨時學生時發生錯誤:', error);
        // 繼續處理正常學生
      }
    }
    
    // ========== 處理正常學生 ==========
    // 讀取 student_data.json
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    let studentData;
    
    try {
      const fileContent = fs.readFileSync(studentDataPath, 'utf8');
      studentData = JSON.parse(fileContent);
    } catch (error) {
      console.error('❌ 讀取 student_data.json 失敗:', error);
      return res.status(500).json({
        success: false,
        message: '讀取學生資料檔案失敗'
      });
    }
    
    // 🔥 檢查 students 陣列是否存在
    if (!studentData || !Array.isArray(studentData.students)) {
        console.error('❌ student_data.json 格式錯誤: students 陣列不存在');
        return { success: false, error: 'student_data.json 格式錯誤' };
    }
    
    // 查找對應的學生
    const studentIndex = studentData.students.findIndex(student => student.name === studentName);
    
    if (studentIndex === -1) {
      console.log('⚠️ 找不到學生:', studentName);
      return res.status(404).json({
        success: false,
        message: `找不到學生: ${studentName}`
      });
    }
    
    // 更新或添加簽到記錄
    const student = studentData.students[studentIndex];
    
    // 確保 attendance 陣列存在
    if (!student.attendance) {
      student.attendance = [];
    }
    
    // 查找是否已有該日期的記錄
    const existingRecordIndex = student.attendance.findIndex(record => record.date === date);
    
    if (existingRecordIndex !== -1) {
      // 更新現有記錄
      const oldPresent = student.attendance[existingRecordIndex].present;
      student.attendance[existingRecordIndex].present = present;
      console.log('✅ 更新現有簽到記錄:', { studentName, date, present, oldPresent });
      
      // 如果從缺席/請假改為出席，則減少剩餘堂數
      if (present && !oldPresent && (student.remaining || 0) > 0) {
        student.remaining = Math.max(0, (student.remaining || 0) - 1);
        console.log('📉 從缺席改為出席，減少剩餘堂數:', { studentName, remaining: student.remaining });
      }
      // 如果從出席改為缺席/請假，則增加剩餘堂數
      else if (!present && oldPresent === true) {
        student.remaining = (student.remaining || 0) + 1;
        console.log('📈 從出席改為缺席，增加剩餘堂數:', { studentName, remaining: student.remaining });
      }
    } else {
      // 添加新記錄
      student.attendance.push({
        date: date,
        present: present
      });
      console.log('✅ 添加新簽到記錄:', { studentName, date, present });
      
      // 如果是新記錄且為出席，則減少剩餘堂數
      if (present && (student.remaining || 0) > 0) {
        student.remaining = Math.max(0, (student.remaining || 0) - 1);
        console.log('📉 新記錄出席，減少剩餘堂數:', { studentName, remaining: student.remaining });
      }
    }
    
    // 🔥 計算並更新最後出席日期
    if (student.attendance && student.attendance.length > 0) {
      // 找出所有 present === true 的記錄
      const presentRecords = student.attendance.filter(record => record.present === true);
      if (presentRecords.length > 0) {
        // 按日期排序，取最新的
        presentRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
        student.lastAttendanceDate = presentRecords[0].date;
        console.log('📅 更新最後出席日期:', { studentName, lastAttendanceDate: student.lastAttendanceDate });
      }
    }
    
    // 🚀 異步寫回檔案（效能優化）
    try {
      await safeFile.writeJSON(studentDataPath, studentData);
      console.log('✅ student_data.json 更新成功（異步 + 鎖）');
    } catch (error) {
      console.error('❌ 寫入 student_data.json 失敗:', error);
      return res.status(500).json({
        success: false,
        message: '寫入學生資料檔案失敗'
      });
    }
    
    res.json({
      success: true,
      message: '學生簽到記錄更新成功',
      data: {
        studentName,
        date,
        present,
        totalRecords: student.attendance.length,
        remaining: student.remaining || 0,
        lastAttendanceDate: student.lastAttendanceDate || null
      }
    });
    
  } catch (error) {
    console.error('❌ 更新學生簽到記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新學生簽到記錄失敗',
      error: error.message
    });
  }
});
// ==================== Admin 學生試算表 API ====================
app.get('/api/admin/student-sheet', async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';
    const data = await fetchStudentSheetData(force);

    res.json({
      success: true,
      columns: data.columns,
      rows: data.rows,
      fetchedAt: new Date(data.fetchedAt).toISOString()
    });
  } catch (error) {
    console.error('❌ 讀取學生試算表失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取學生試算表失敗',
      error: error.message
    });
  }
});

app.get('/api/admin/groups', async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';
    const data = await fetchGroupSheetData(force);

    res.json({
      success: true,
      groups: data.groups,
      columns: data.columns,
      fetchedAt: new Date(data.fetchedAt).toISOString()
    });
  } catch (error) {
    console.error('❌ 讀取群組資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取群組資料失敗',
      error: error.message
    });
  }
});

app.patch('/api/admin/student-sheet/:row', async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.row, 10);
    if (Number.isNaN(rowNumber) || rowNumber < 2) {
      return res.status(400).json({
        success: false,
        message: '行號必須大於等於 2'
      });
    }

    const { values } = req.body || {};
    if (!values || typeof values !== 'object') {
      return res.status(400).json({
        success: false,
        message: '缺少更新內容'
      });
    }

    const data = await fetchStudentSheetData();
    const columnMap = new Map(data.columns.map(col => [col.key, col]));

    const updates = Object.entries(values)
      .filter(([key]) => columnMap.has(key) && STUDENT_SHEET_EDITABLE_KEYS.has(key));

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '沒有可更新的欄位'
      });
    }

    ensureAdminSheetInitialized();
    const rowRange = `'${STUDENT_SHEET_NAME}'!A${rowNumber}:W${rowNumber}`;
    const currentRow = await adminStudentSheetClient.getSheetData(rowRange);
    const rowArray = new Array(data.columns.length).fill('');

    if (currentRow && currentRow[0]) {
      currentRow[0].forEach((cellValue, idx) => {
        if (idx < rowArray.length) {
          rowArray[idx] = cellValue;
        }
      });
    }

    updates.forEach(([key, value]) => {
      const column = columnMap.get(key);
      const colIndex = column.columnIndex - 1;
      rowArray[colIndex] = formatValueForSheet(key, value);
    });

    await adminStudentSheetClient.batchUpdate([
      {
        range: rowRange,
        values: [rowArray]
      }
    ], 'USER_ENTERED');

    invalidateStudentSheetCache();

    res.json({
      success: true,
      rowNumber,
      updatedFields: updates.map(([key]) => key)
    });
  } catch (error) {
    console.error('❌ 更新學生試算表失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新學生試算表失敗',
      error: error.message
    });
  }
});

app.post('/api/admin/student-sheet', async (req, res) => {
  try {
    const { values } = req.body || {};
    if (!values || typeof values !== 'object') {
      return res.status(400).json({
        success: false,
        message: '缺少新增資料'
      });
    }

    const data = await fetchStudentSheetData();
    const newRow = new Array(data.columns.length).fill('');

    data.columns.forEach((column, idx) => {
      if (values[column.key] !== undefined && values[column.key] !== null) {
        newRow[idx] = formatValueForSheet(column.key, values[column.key]);
      }
    });

    if (!newRow[0] || String(newRow[0]).trim() === '') {
      return res.status(400).json({
        success: false,
        message: '學生姓名為必填欄位'
      });
    }

    ensureAdminSheetInitialized();
    const result = await adminStudentSheetClient.appendRows(`'${STUDENT_SHEET_NAME}'!A:W`, [newRow], 'USER_ENTERED');

    let insertedRow = null;
    const updatedRange = result?.updates?.updatedRange || '';
    const rangeMatch = updatedRange.match(/![A-Z]+(\d+):[A-Z]+(\d+)/);
    if (rangeMatch) {
      insertedRow = parseInt(rangeMatch[1], 10);
    }

    invalidateStudentSheetCache();

    res.json({
      success: true,
      rowNumber: insertedRow,
      updatedRange,
      values: newRow
    });
  } catch (error) {
    console.error('❌ 新增學生資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '新增學生資料失敗',
      error: error.message
    });
  }
});

app.delete('/api/admin/student-sheet/:row', async (req, res) => {
  try {
    const rowNumber = parseInt(req.params.row, 10);
    if (Number.isNaN(rowNumber) || rowNumber < 2) {
      return res.status(400).json({
        success: false,
        message: '行號必須大於等於 2'
      });
    }

    const sheetId = await getStudentSheetId();
    ensureAdminSheetInitialized();

    await adminStudentSheetClient.batchUpdateRequest([
      {
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber
          }
        }
      }
    ]);

    invalidateStudentSheetCache();

    res.json({
      success: true,
      rowNumber
    });
  } catch (error) {
    console.error('❌ 刪除學生資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '刪除學生資料失敗',
      error: error.message
    });
  }
});

// 更新學生資料API - 從Google Sheets獲取最新資料（使用共用函數）
app.post('/api/update-student-data', async (req, res) => {
  try {
    // 🚀 優化：先檢查是否正在更新中（避免日誌洗版）
    if (memoryDB.get('updating_student_data')) {
      logger.throttle('manual-update-skip', 'WARN', '⏳ [手動請求] 學生資料正在更新中，跳過');
      return res.status(202).json({
        success: false,
        message: '學生資料正在更新中，請稍後再試',
        updating: true,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log('🔄 [手動] 開始更新學生資料...');
    const result = await updateStudentDataFromGoogleSheets();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ [手動] 更新學生資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新學生資料失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 獲取學生資料API - 返回當前student_data.json的內容
app.get('/api/student-data', (req, res) => {
  try {
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    
    if (!fs.existsSync(studentDataPath)) {
      return res.status(404).json({
        success: false,
        message: '學生資料文件不存在'
      });
    }
    
    const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
    
    // 🔥 動態計算每個學生的最後出席日期（如果還沒有的話）
    if (studentData.students && Array.isArray(studentData.students)) {
      studentData.students.forEach(student => {
        if (!student.lastAttendanceDate && student.attendance && student.attendance.length > 0) {
          // 找出所有 present === true 的記錄
          const presentRecords = student.attendance.filter(record => record.present === true);
          if (presentRecords.length > 0) {
            // 按日期排序，取最新的
            presentRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
            student.lastAttendanceDate = presentRecords[0].date;
          }
        }
      });
    }
    
    res.json({
      success: true,
      data: studentData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 讀取學生資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取學生資料失敗',
      error: error.message
    });
  }
});

// 系統狀態監控API
app.get('/api/system-status', (req, res) => {
  try {
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    const studentDataExists = fs.existsSync(studentDataPath);
    
    let studentDataInfo = null;
    if (studentDataExists) {
      const stats = fs.statSync(studentDataPath);
      studentDataInfo = {
        exists: true,
        size: stats.size,
        lastModified: stats.mtime,
        age: Date.now() - stats.mtime.getTime()
      };
    }
    
    const settings = loadSystemSettings();
    const syncSettings = settings.studentDataSync || {};
    
    const systemInfo = {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.version,
      platform: process.platform,
      timestamp: new Date().toISOString(),
      studentData: studentDataInfo,
      cache: {
        size: memoryDB.cache.size,
        updating: memoryDB.get('updating_student_data') || false
      },
      studentDataSync: {
        enabled: syncSettings.enabled,
        autoUpdateEnabled: syncSettings.autoUpdateEnabled,
        updateTime: syncSettings.updateTime,
        intervalMinutes: syncSettings.intervalMinutes,
        hasSchedule: studentDataSyncSchedule !== null,
        hasInterval: studentDataSyncInterval !== null
      }
    };
    
    res.json({
      success: true,
      data: systemInfo
    });
    
  } catch (error) {
    console.error('❌ 獲取系統狀態失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取系統狀態失敗',
      error: error.message
    });
  }
});

// ==================== 學生資料同步管理 API ====================

// 獲取學生資料同步設定
app.get('/api/student-data-sync/settings', (req, res) => {
  try {
    const settings = loadSystemSettings();
    const syncSettings = settings.studentDataSync || {};
    
    res.json({
      success: true,
      data: {
        ...syncSettings,
        hasSchedule: studentDataSyncSchedule !== null,
        hasInterval: studentDataSyncInterval !== null,
        isUpdating: memoryDB.get('updating_student_data') || false
      }
    });
  } catch (error) {
    console.error('❌ 獲取同步設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取同步設定失敗',
      error: error.message
    });
  }
});

// 更新學生資料同步設定
app.post('/api/student-data-sync/settings', (req, res) => {
  try {
    const newSettings = req.body;
    
    // 讀取現有設定
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    
    // 更新學生資料同步設定
    settings.studentDataSync = {
      ...settings.studentDataSync,
      ...newSettings
    };
    
    // 寫回檔案
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    
    // 重新啟動排程
    console.log('🔄 重新啟動學生資料自動更新排程...');
    startStudentDataAutoSync();
    
    res.json({
      success: true,
      message: '同步設定已更新',
      data: settings.studentDataSync
    });
  } catch (error) {
    console.error('❌ 更新同步設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新同步設定失敗',
      error: error.message
    });
  }
});

// 立即執行學生資料同步（手動觸發）
app.post('/api/student-data-sync/trigger', async (req, res) => {
  try {
    console.log('🔄 [手動觸發] 立即執行學生資料同步...');
    const result = await updateStudentDataFromGoogleSheets();
    res.json(result);
  } catch (error) {
    console.error('❌ [手動觸發] 同步失敗:', error);
    res.status(500).json({
      success: false,
      message: '同步失敗',
      error: error.message
    });
  }
});

// 停止學生資料自動同步
app.post('/api/student-data-sync/stop', (req, res) => {
  try {
    if (studentDataSyncSchedule) {
      studentDataSyncSchedule.cancel();
      studentDataSyncSchedule = null;
      console.log('⏹️ 已停止每日定時同步');
    }
    
    if (studentDataSyncInterval) {
      clearInterval(studentDataSyncInterval);
      studentDataSyncInterval = null;
      console.log('⏹️ 已停止間隔同步');
    }
    
    res.json({
      success: true,
      message: '學生資料自動同步已停止'
    });
  } catch (error) {
    console.error('❌ 停止同步失敗:', error);
    res.status(500).json({
      success: false,
      message: '停止同步失敗',
      error: error.message
    });
  }
});
// 啟動學生資料自動同步
app.post('/api/student-data-sync/start', (req, res) => {
  try {
    console.log('▶️ 啟動學生資料自動同步...');
    startStudentDataAutoSync();
    
    res.json({
      success: true,
      message: '學生資料自動同步已啟動',
      hasSchedule: studentDataSyncSchedule !== null,
      hasInterval: studentDataSyncInterval !== null
    });
  } catch (error) {
    console.error('❌ 啟動同步失敗:', error);
    res.status(500).json({
      success: false,
      message: '啟動同步失敗',
      error: error.message
    });
  }
});
// 更新特定課程資料API
app.post('/api/update-course-data', (req, res) => {
  try {
    const { course, students, timestamp } = req.body;
    
    console.log(`🔄 開始更新 ${course} 課程資料...`);
    console.log(`📊 收到 ${students.length} 名學生資料`);
    
    // 讀取現有學生資料
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    let allStudents = [];
    
    if (fs.existsSync(studentDataPath)) {
      const existingData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
      allStudents = existingData.students || [];
    }
    
    // 移除該課程的舊資料
    allStudents = allStudents.filter(student => student.course !== course);
    
    // 添加新資料
    allStudents = allStudents.concat(students);
    
    // 更新總數
    const updatedData = {
      success: true,
      count: allStudents.length,
      students: allStudents,
      lastUpdated: timestamp || new Date().toISOString(),
      updatedCourse: course
    };
    
    // 寫入文件
    fs.writeFileSync(studentDataPath, JSON.stringify(updatedData, null, 2));
    
    console.log(`✅ ${course} 課程資料更新成功`);
    console.log(`📊 總學生數: ${allStudents.length}`);
    
    res.json({
      success: true,
      message: `${course} 課程資料更新成功`,
      course: course,
      studentCount: students.length,
      totalStudents: allStudents.length,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 更新課程資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新課程資料失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 批量更新多個課程資料API
app.post('/api/update-multiple-courses', (req, res) => {
  try {
    const { courses } = req.body;
    
    console.log(`🔄 開始批量更新 ${courses.length} 個課程資料...`);
    
    // 讀取現有學生資料
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    let allStudents = [];
    
    if (fs.existsSync(studentDataPath)) {
      const existingData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
      allStudents = existingData.students || [];
    }
    
    const updatedCourses = [];
    
    // 處理每個課程
    for (const courseData of courses) {
      const { course, students } = courseData;
      
      // 移除該課程的舊資料
      allStudents = allStudents.filter(student => student.course !== course);
      
      // 添加新資料
      allStudents = allStudents.concat(students);
      
      updatedCourses.push({
        course: course,
        studentCount: students.length
      });
      
      console.log(`✅ ${course}: ${students.length} 名學生`);
    }
    
    // 更新總數
    const updatedData = {
      success: true,
      count: allStudents.length,
      students: allStudents,
      lastUpdated: new Date().toISOString(),
      updatedCourses: updatedCourses
    };
    
    // 寫入文件
    fs.writeFileSync(studentDataPath, JSON.stringify(updatedData, null, 2));
    
    console.log(`🎉 批量更新完成，總學生數: ${allStudents.length}`);
    
    res.json({
      success: true,
      message: '批量更新成功',
      totalStudents: allStudents.length,
      updatedCourses: updatedCourses,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 批量更新失敗:', error);
    res.status(500).json({
      success: false,
      message: '批量更新失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 獲取講師資料API
app.get('/api/teachers', (req, res) => {
  try {
    console.log('📚 獲取講師資料...');
    
    const teacherData = TeacherRegistry.getTeacherData();
    const teachers = teacherData.teacherList.map(teacher => ({
      name: teacher.name,
      userId: teacher.userId,
      color: teacher.color,
      aliases: teacher.aliases,
      normalizedName: teacher.normalizedName
    }));

    console.log(`✅ 成功獲取 ${teachers.length} 位講師資料（統一來源）`);

    res.json({
      success: true,
      data: {
        teachers,
        count: teachers.length,
        lastUpdate: teacherData.lastUpdate || new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 獲取講師資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取講師資料失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 更新講師資料 API（包含顏色設定）
app.put('/api/teachers', (req, res) => {
  try {
    console.log('📝 收到更新講師資料請求...');
    
    const { teachers } = req.body;
    
    if (!Array.isArray(teachers)) {
      return res.status(400).json({
        success: false,
        message: '講師資料格式錯誤，需要陣列格式',
        timestamp: new Date().toISOString()
      });
    }
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    
    // 驗證每個講師資料
    for (const teacher of teachers) {
      if (!teacher.name || !teacher.userId) {
        return res.status(400).json({
          success: false,
          message: '每位講師必須包含 name 和 userId',
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // 建立備份
    if (fs.existsSync(teacherDataPath)) {
      const backupPath = `${teacherDataPath}.backup-${Date.now()}`;
      fs.copyFileSync(teacherDataPath, backupPath);
      console.log('✅ 已建立備份:', backupPath);
    }
    
    // 寫入新資料
    const newData = {
      teachers: teachers,
      last_update: new Date().toISOString()
    };
    
    fs.writeFileSync(teacherDataPath, JSON.stringify(newData, null, 2), 'utf8');
    console.log(`✅ 成功更新 ${teachers.length} 位講師資料`);
    
    // 重新載入講師快取
    const registrySnapshot = TeacherRegistry.reload();
    global.teachers = registrySnapshot.list.map(entry => ({
      name: entry.name,
      userId: entry.userId,
      color: entry.color
    }));
    
    res.json({
      success: true,
      message: '講師資料更新成功',
      data: {
        count: teachers.length,
        lastUpdate: newData.last_update,
        teachers: TeacherRegistry.getTeacherList()
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 更新講師資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新講師資料失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 綁定講師 API
app.post('/api/teacher-binding', (req, res) => {
  try {
    const { userId, displayName, teacherName } = req.body;
    
    console.log('🔗 收到講師綁定請求:', { userId, teacherName });
    
    if (!userId || !teacherName) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：userId 或 teacherName'
      });
    }
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    
    // 讀取現有的講師資料
    let teacherData = { teachers: [], last_update: new Date().toISOString() };
    if (fs.existsSync(teacherDataPath)) {
      teacherData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
      
      // 兼容舊格式：如果是物件格式，轉換為陣列
      if (!Array.isArray(teacherData.teachers) && typeof teacherData.teachers === 'object') {
        teacherData.teachers = Object.entries(teacherData.teachers).map(([name, userId]) => ({
          name: name,
          userId: userId
        }));
      }
    }
    
    // 確保 teachers 是陣列
    if (!Array.isArray(teacherData.teachers)) {
      teacherData.teachers = [];
    }
    
    // 檢查是否已經綁定過（只比對 userId）
    const existingIndex = teacherData.teachers.findIndex(t => t.userId === userId);
    
    if (existingIndex !== -1) {
      console.log(`⚠️ 用戶 ${userId} 已綁定到 ${teacherData.teachers[existingIndex].name}，將更新綁定`);
      // 更新現有綁定
      teacherData.teachers[existingIndex].name = teacherName;
    } else {
      // 添加新綁定
      teacherData.teachers.push({
        name: teacherName,
        userId: userId
      });
    }
    
    teacherData.last_update = new Date().toISOString();
    
    console.log('📝 準備寫入資料:', {
      totalTeachers: teacherData.teachers.length,
      newTeacher: { name: teacherName, userId: userId },
      filePath: teacherDataPath
    });
    
    // 備份舊檔案
    if (fs.existsSync(teacherDataPath)) {
      const backupPath = path.join(__dirname, 'teacher_data.json.backup');
      fs.copyFileSync(teacherDataPath, backupPath);
      console.log('📦 已備份舊檔案');
    }
    
    // 保存更新後的資料（同步寫入並驗證）
    const dataToWrite = JSON.stringify(teacherData, null, 2);
    fs.writeFileSync(
      teacherDataPath, 
      dataToWrite,
      'utf8'
    );
    
    // 立即驗證寫入是否成功
    const verifyData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
    const verifyTeacher = verifyData.teachers.find(t => t.userId === userId);
    
    if (!verifyTeacher) {
      throw new Error('驗證失敗：寫入後無法在檔案中找到新綁定的講師');
    }
    
    console.log(`✅ 講師綁定成功並已驗證: ${teacherName} (${userId})`);
    console.log(`📊 當前共有 ${verifyData.teachers.length} 位已綁定講師`);
    
    res.json({
      success: true,
      message: '講師綁定成功',
      data: {
        teacherName: teacherName,
        userId: userId,
        totalBindings: verifyData.teachers.length
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 講師綁定失敗:', error);
    res.status(500).json({
      success: false,
      message: '講師綁定失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 🚀 極速綁定檢查：通過 userId 快速查找（優化版，最快速度）
app.post('/api/quick-bind-by-userid', (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.json({ 
        success: false, 
        message: '缺少 userId 參數' 
      });
    }
    
    console.log('⚡ 極速綁定查詢:', userId);
    
    const teacherInfo = TeacherRegistry.findTeacherByUserId(userId);
    if (teacherInfo) {
      console.log(`⚡⚡⚡ 極速綁定成功: ${userId} → ${teacherInfo.name}`);
      return res.json({
        success: true,
        bound: true,
        teacherName: teacherInfo.name,
        userId: userId,
        method: 'userId-exact-match',
        timestamp: new Date().toISOString()
      });
    }

    console.log('💡 極速查詢：未找到匹配的講師');
    return res.json({ 
      success: true, 
      bound: false,
      message: '未找到匹配的講師' 
    });
    
  } catch (error) {
    console.error('❌ 極速綁定查詢失敗:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ========== 設定管理 API ==========

// 獲取講師資料設定 (teacher_data.json)
app.get('/api/settings/teachers', (req, res) => {
  try {
    console.log('📚 獲取講師資料設定...');
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    
    if (fs.existsSync(teacherDataPath)) {
      const teacherData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
      
      res.json({
        success: true,
        data: teacherData,
        timestamp: new Date().toISOString()
      });
    } else {
      res.json({
        success: true,
        data: { teachers: [], last_update: new Date().toISOString() },
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('❌ 獲取講師資料設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取講師資料設定失敗',
      error: error.message
    });
  }
});

// 儲存講師資料設定 (teacher_data.json)
app.post('/api/settings/teachers', (req, res) => {
  try {
    console.log('💾 儲存講師資料設定...');
    
    const { teachers } = req.body;
    
    if (!Array.isArray(teachers)) {
      return res.status(400).json({
        success: false,
        message: '講師資料格式錯誤'
      });
    }
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    const backupPath = path.join(__dirname, `teacher_data.json.backup-${Date.now()}`);
    
    // 備份現有檔案
    if (fs.existsSync(teacherDataPath)) {
      fs.copyFileSync(teacherDataPath, backupPath);
    }
    
    // 儲存新資料
    const teacherData = {
      teachers: teachers,
      last_update: new Date().toISOString()
    };
    
    fs.writeFileSync(teacherDataPath, JSON.stringify(teacherData, null, 2), 'utf8');
    
    TeacherRegistry.reload();
    global.teachers = TeacherRegistry.getTeacherList().map(entry => ({
      name: entry.name,
      userId: entry.userId,
      color: entry.color
    }));

    console.log('✅ 講師資料設定已儲存');
    res.json({
      success: true,
      message: '講師資料設定儲存成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 儲存講師資料設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存講師資料設定失敗',
      error: error.message
    });
  }
});

// 獲取講師列表設定 (teacher_list_data.csv)
app.get('/api/settings/teacher-list', (req, res) => {
  try {
    console.log('📋 獲取講師列表設定...');
    const { records } = readTeacherListCsvRecords();
    const teachers = records.map(record => ({
      teacher: record.teacher,
      link: record.link,
      webApi: record.webApi,
      readApi: record.readApi,
      userId: record.userId,
      googleSheetReadApi: record.googleSheetReadApi || ''
    }));

    res.json({
      success: true,
      data: teachers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 獲取講師列表設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取講師列表設定失敗',
      error: error.message
    });
  }
});

// 儲存講師列表設定 (teacher_list_data.csv)
app.post('/api/settings/teacher-list', (req, res) => {
  try {
    console.log('💾 儲存講師列表設定...');
    
    const { teachers } = req.body;
    
    if (!Array.isArray(teachers)) {
      return res.status(400).json({
        success: false,
        message: '講師列表格式錯誤'
      });
    }
    
    const csvPath = TEACHER_LIST_CSV_PATH;
    const backupPath = path.join(__dirname, 'public', `teacher_list_data.csv.backup-${Date.now()}`);
    
    // 備份現有檔案
    if (fs.existsSync(csvPath)) {
      fs.copyFileSync(csvPath, backupPath);
    }
    
    // 生成 CSV 內容
    let csvContent = '老師,連結,Web API,讀報表 API,user id,google shhet api (read)\n';
    teachers.forEach(teacher => {
      const record = {
        teacher: teacher.teacher || '',
        link: teacher.link || '',
        webApi: teacher.webApi || '',
        readApi: teacher.readApi || '',
        userId: teacher.userId || '',
        googleSheetReadApi: teacher.googleSheetReadApi || teacher.googleReadApi || ''
      };
      csvContent += [
        escapeCsvValue(record.teacher),
        escapeCsvValue(record.link),
        escapeCsvValue(record.webApi),
        escapeCsvValue(record.readApi),
        escapeCsvValue(record.userId),
        escapeCsvValue(record.googleSheetReadApi)
      ].join(',') + '\n';
    });
    
    fs.writeFileSync(csvPath, csvContent, 'utf8');
    
    console.log('✅ 講師列表設定已儲存');
    res.json({
      success: true,
      message: '講師列表設定儲存成功',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 儲存講師列表設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存講師列表設定失敗',
      error: error.message
    });
  }
});
// 獲取系統設定 (system-settings.json)
app.get('/api/settings/system', (req, res) => {
  try {
    console.log('⚙️ 獲取系統設定...');
    
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ 獲取系統設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取系統設定失敗',
      error: error.message
    });
  }
});

// 儲存系統設定 (system-settings.json)
app.post('/api/settings/system', (req, res) => {
  try {
    console.log('💾 儲存系統設定...');
    
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const newSettings = req.body;
    
    const mergedSettings = {
      ...loadSystemSettings(),
      ...newSettings,
      dateRange: {
        futureDays: Math.max(1, parseInt(newSettings.dateRange?.futureDays ?? newSettings.futureDays ?? 30, 10)),
        pastDays: Math.max(0, parseInt(newSettings.dateRange?.pastDays ?? newSettings.pastDays ?? 7, 10))
      }
    };
    
    if ('futureDays' in mergedSettings) delete mergedSettings.futureDays;
    if ('pastDays' in mergedSettings) delete mergedSettings.pastDays;
    
    // 備份舊設定
    if (fs.existsSync(settingsPath)) {
      const backupPath = path.join(__dirname, `system-settings.json.backup-${Date.now()}`);
      fs.copyFileSync(settingsPath, backupPath);
    }
    
    // 寫入新設定
    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
    
    console.log('✅ 系統設定已更新');
    
    res.json({
      success: true,
      message: '系統設定已更新',
      data: mergedSettings
    });
  } catch (error) {
    console.error('❌ 儲存系統設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存系統設定失敗',
      error: error.message
    });
  }
});
// ========== 原有 API 繼續 ==========
// 解除講師綁定 API
app.post('/api/teacher-unbinding', (req, res) => {
  try {
    const { userId } = req.body;
    
    console.log('🔓 收到解除講師綁定請求:', userId);
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：userId'
      });
    }
    
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    
    if (!fs.existsSync(teacherDataPath)) {
      return res.status(404).json({
        success: false,
        message: '講師資料檔案不存在'
      });
    }
    
    // 讀取現有的講師資料
    const teacherData = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
    
    // 兼容舊格式：如果是物件格式，轉換為陣列
    if (!Array.isArray(teacherData.teachers) && typeof teacherData.teachers === 'object') {
      teacherData.teachers = Object.entries(teacherData.teachers).map(([name, userId]) => ({
        name: name,
        userId: userId
      }));
    }
    
    // 查找綁定索引
    const existingIndex = teacherData.teachers.findIndex(t => t.userId === userId);
    
    if (existingIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '未找到該用戶的綁定記錄'
      });
    }
    
    const teacherName = teacherData.teachers[existingIndex].name;
    
    // 備份舊檔案
    const backupPath = path.join(__dirname, 'teacher_data.json.backup');
    fs.copyFileSync(teacherDataPath, backupPath);
    
    // 刪除綁定（從陣列中移除）
    teacherData.teachers.splice(existingIndex, 1);
    teacherData.last_update = new Date().toISOString();
    
    // 保存更新後的資料
    fs.writeFileSync(
      teacherDataPath, 
      JSON.stringify(teacherData, null, 2),
      'utf8'
    );
    
    console.log(`✅ 解除綁定成功: ${teacherName} (${userId})`);
    
    res.json({
      success: true,
      message: '解除綁定成功',
      data: {
        teacherName: teacherName,
        userId: userId
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 解除綁定失敗:', error);
    res.status(500).json({
      success: false,
      message: '解除綁定失敗',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});
// 提醒管理相關API
const remindersDataPath = path.join(__dirname, 'data', 'reminders.json');

// 確保data目錄存在
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// 生成手動提醒訊息函數
async function generateManualReminderMessage(teacherName, courseName, courseDate, courseTime, type) {
  try {
    // 獲取範本設定
    const response = await fetch(`http://localhost:3002/api/templates`);
    const data = await response.json();
    
    let template;
    if (data.success && data.data) {
      // 處理課前提醒的範本映射
      const templateKey = type === 'before-class' ? 'beforeClass' : type;
      template = data.data[templateKey] || data.data.today;
    } else {
      // 使用預設範本
      template = getDefaultTemplate(type);
    }
    
    const date = new Date(courseDate);
    const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    
    // 準備變數
    const variables = {
      teacherName,
      courseName,
      courseTime,
      courseDate: formattedDate + ' 星期' + weekday,
      location: '未設定地點',
      lessonPlanUrl: '',
      googleMapsUrl: '',
      minutes: type === 'before-class' ? '30' : ''
    };
    
    // 處理範本
    let result = template;
    Object.keys(variables).forEach(key => {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, variables[key] || '');
    });
    
    return result;
  } catch (error) {
    console.error('❌ 獲取範本失敗，使用預設範本:', error);
    return getDefaultTemplate(type, teacherName, courseName, courseDate, courseTime);
  }
}

function getDefaultTemplate(type, teacherName, courseName, courseDate, courseTime) {
  const date = new Date(courseDate);
  const formattedDate = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
  
  if (type === 'today') {
    return `今日課程提醒

👨‍🏫 講師：${teacherName}
📖 課程：${courseName}
⏰ 時間：${courseTime}
📅 日期：${formattedDate} 星期${weekday}
📍 地點：未設定地點
📋 教案連結：
🗺️ 地圖連結：

請準備好課程內容，祝教學順利！`;
  } else if (type === 'before-class') {
    const beforeClassMinutes = 30;
    return `📚 課程即將開始

👨‍🏫 講師：${teacherName}
📖 課程：${courseName}
⏰ 時間：${courseTime}
📅 日期：${formattedDate} 星期${weekday}
📍 地點：未設定地點
📋 教案連結：
🗺️ 地圖連結：

課程將在 ${beforeClassMinutes} 分鐘後開始，請準備就緒！`;
  } else {
    return `明日課程提醒

👨‍🏫 講師：${teacherName}
📖 課程：${courseName}
⏰ 時間：${courseTime}
📅 日期：${formattedDate} 星期${weekday}
📍 地點：未設定地點
📋 教案連結：
🗺️ 地圖連結：

請提前準備課程內容！`;
  }
}
// 讀取提醒資料
function loadReminders() {
  try {
    if (fs.existsSync(remindersDataPath)) {
      // 檢查檔案權限
      const stats = fs.statSync(remindersDataPath);
      console.log('📄 提醒檔案資訊:', {
        exists: true,
        size: stats.size,
        mode: stats.mode.toString(8),
        uid: stats.uid,
        gid: stats.gid
      });
      
      const data = fs.readFileSync(remindersDataPath, 'utf8');
      const parsed = JSON.parse(data);
      
      // 確保 studentReminders 陣列存在
      if (!parsed.studentReminders) {
        parsed.studentReminders = [];
      }
      
      console.log('✅ 成功讀取提醒資料，數量:', parsed.reminders ? parsed.reminders.length : 0);
      console.log('✅ 成功讀取學生提醒資料，數量:', parsed.studentReminders ? parsed.studentReminders.length : 0);
      return parsed;
    } else {
      console.log('⚠️ 提醒檔案不存在，創建新檔案');
      const initialData = { reminders: [], studentReminders: [] };
      fs.writeFileSync(remindersDataPath, JSON.stringify(initialData, null, 2));
      return initialData;
    }
  } catch (error) {
    console.error('❌ 讀取提醒資料失敗:', error);
    console.error('錯誤詳情:', {
      code: error.code,
      errno: error.errno,
      syscall: error.syscall,
      path: error.path
    });
    
    // 嘗試創建新檔案
    try {
      const initialData = { reminders: [], studentReminders: [] };
      fs.writeFileSync(remindersDataPath, JSON.stringify(initialData, null, 2));
      console.log('✅ 創建新的提醒檔案');
      return initialData;
    } catch (writeError) {
      console.error('❌ 創建提醒檔案也失敗:', writeError);
      return { reminders: [], studentReminders: [] };
    }
  }
}

// 範本處理函數
function processTemplate(template, reminder) {
  if (!template) return '';
  
  console.log('🔧 開始處理範本變數...');
  const now = new Date();
  const courseDate = new Date(reminder.courseDate);
  const courseTime = reminder.courseTime;
  
  // 計算距離上課時間
  let timeUntilClass = '';
  if (courseTime) {
    try {
      const [hours, minutes] = courseTime.split(':');
      const courseDateTime = new Date(courseDate);
      courseDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      const timeDiff = courseDateTime.getTime() - now.getTime();
      if (timeDiff > 0) {
        const hoursLeft = Math.floor(timeDiff / (1000 * 60 * 60));
        const minutesLeft = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hoursLeft > 0) {
          timeUntilClass = `${hoursLeft}小時${minutesLeft}分鐘`;
        } else {
          timeUntilClass = `${minutesLeft}分鐘`;
        }
      }
      console.log('⏰ 計算時間差:', timeUntilClass);
    } catch (error) {
      console.error('計算時間差錯誤:', error);
    }
  }
  
  // 星期幾對應
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = weekdays[courseDate.getDay()];
  
  // 提醒類型文字對應
  const typeTextMap = {
    'today': '當日',
    'tomorrow': '隔日',
    'before-class': '課前'
  };
  
  console.log('📋 變數替換前範本:', template);
  console.log('📊 變數值:', {
    teacherName: reminder.teacherName,
    courseName: reminder.courseName,
    courseTime: courseTime,
    courseDate: reminder.courseDate,
    reminderType: reminder.type,
    reminderTypeText: typeTextMap[reminder.type],
    currentTime: now.toLocaleTimeString('zh-TW', { hour12: false }),
    currentDate: now.toLocaleDateString('zh-TW'),
    weekday: weekday,
    timeUntilClass: timeUntilClass
  });
  
  // 替換變數
  const result = template
    .replace(/\{teacherName\}/g, reminder.teacherName || '未知講師')
    .replace(/\{courseName\}/g, reminder.courseName || '未知課程')
    .replace(/\{courseTime\}/g, courseTime || '未知時間')
    .replace(/\{courseDate\}/g, reminder.courseDate || '未知日期')
    .replace(/\{reminderType\}/g, reminder.type || 'unknown')
    .replace(/\{reminderTypeText\}/g, typeTextMap[reminder.type] || '未知')
    .replace(/\{reminderId\}/g, reminder.id || '')
    .replace(/\{currentTime\}/g, now.toLocaleTimeString('zh-TW', { hour12: false }))
    .replace(/\{currentDate\}/g, now.toLocaleDateString('zh-TW'))
    .replace(/\{weekday\}/g, weekday)
    .replace(/\{timeUntilClass\}/g, timeUntilClass)
    .replace(/\{systemName\}/g, 'FLB講師行事曆系統');
  
  console.log('✅ 範本處理完成');
  return result;
}

// 儲存範本設定API
app.post('/api/templates', (req, res) => {
  try {
    const { templates } = req.body;
    
    if (!templates) {
      return res.status(400).json({
        success: false,
        message: '範本資料不能為空'
      });
    }

    // 儲存範本到檔案
    const templatesPath = path.join(__dirname, 'data', 'templates.json');
    fs.writeFileSync(templatesPath, JSON.stringify(templates, null, 2));
    
    // 🔥 清除快取，確保下次讀取時獲取最新資料
    memoryDB.delete('templates_cache');
    
    console.log('✅ 範本設定已儲存（快取已清除）');
    res.json({
      success: true,
      message: '範本設定已儲存'
    });
  } catch (error) {
    console.error('❌ 儲存範本設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存範本設定失敗',
      error: error.message
    });
  }
});

// 獲取範本設定API
app.get('/api/templates', (req, res) => {
  try {
    // 🔥 檢查快取（5分鐘有效期）
    const cacheKey = 'templates_cache';
    const cacheAge = 5 * 60 * 1000; // 5分鐘
    const cached = memoryDB.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp < cacheAge)) {
      // 使用快取，不輸出日誌避免洗版
      return res.json({
        success: true,
        data: cached.data
      });
    }
    
    // 嘗試從檔案讀取範本設定
    const templatesPath = path.join(__dirname, 'data', 'templates.json');
    let templates = null;
    
    if (fs.existsSync(templatesPath)) {
      try {
        const data = fs.readFileSync(templatesPath, 'utf8');
        templates = JSON.parse(data);
        console.log('✅ 從檔案載入範本設定（已更新快取）');
      } catch (error) {
        console.error('❌ 讀取範本檔案失敗:', error);
      }
    }
    
    // 如果沒有自訂範本，使用預設範本
    if (!templates) {
      templates = {
        today: `今日課程提醒

👨‍🏫 講師：{teacherName}
📖 課程：{courseName}
⏰ 時間：{courseTime}
📅 日期：{courseDate}
📍 地點：{location}
📋 教案連結：{lessonPlanUrl}
🗺️ 地圖連結：{googleMapsUrl}

請準備好課程內容，祝教學順利！`,
        tomorrow: `明日課程提醒

👨‍🏫 講師：{teacherName}
📖 課程：{courseName}
⏰ 時間：{courseTime}
📅 日期：{courseDate}
📍 地點：{location}
📋 教案連結：{lessonPlanUrl}
🗺️ 地圖連結：{googleMapsUrl}

請提前準備課程內容！`,
        beforeClass: `📚 課程即將開始

👨‍🏫 講師：{teacherName}
📖 課程：{courseName}
⏰ 時間：{courseTime}
📅 日期：{courseDate}
📍 地點：{location}
📋 教案連結：{lessonPlanUrl}
🗺️ 地圖連結：{googleMapsUrl}

課程將在 {minutes} 分鐘後開始，請準備就緒！`,
        student: `👋 您好！

📚 課程提醒通知

📖 課程：{courseName}
📅 日期：{courseDate}
⏰ 時間：{courseTime}
📍 地點：{location}
📋 教案連結：{lessonPlanUrl}
🗺️ 地圖連結：{googleMapsUrl}

提醒您要上課喔！謝謝

希望孩子學習愉快、玩得開心`
      };
      console.log('✅ 使用預設範本設定');
    }

    // 🔥 更新快取
    memoryDB.set(cacheKey, {
      data: templates,
      timestamp: Date.now()
    });

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('❌ 獲取範本設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取範本設定失敗',
      error: error.message
    });
  }
});

// 獲取 Flex Message 範本 API
app.get('/api/flex-templates', (req, res) => {
  try {
    const flexTemplatePath = path.join(__dirname, 'flex-message-templates.json');

    let storedTemplates = null;
    if (fs.existsSync(flexTemplatePath)) {
      try {
        const raw = fs.readFileSync(flexTemplatePath, 'utf8');
        storedTemplates = JSON.parse(raw);
      } catch (err) {
        console.error('⚠️ 解析 flex-message-templates.json 失敗，改用預設值:', err);
      }
    }

    const defaults = notificationManager.getDefaultFlexTemplates();
    const responseData = {
      ...(storedTemplates || defaults),
      defaultTemplates: defaults.templates,
      defaultQuickReply: defaults.quickReply,
      defaultCarousel: defaults.carousel
    };

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('❌ 獲取 Flex Message 範本失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取 Flex Message 範本失敗',
      error: error.message
    });
  }
});

// 重新載入 Flex Message 範本（從磁碟讀取，更新後端記憶体）
app.post('/api/flex-templates/reload', (req, res) => {
  try {
    notificationManager.flexTemplates = notificationManager.loadFlexTemplates();
    res.json({
      success: true,
      message: 'Flex Message 範本已重新載入',
      data: notificationManager.flexTemplates
    });
  } catch (error) {
    console.error('❌ 重新載入 Flex 範本失敗:', error);
    res.status(500).json({ success: false, message: '重新載入 Flex 範本失敗', error: error.message });
  }
});

// 儲存 Flex Message 範本 API
app.post('/api/flex-templates', (req, res) => {
  try {
    const { templates, enabled, quickReply, carousel } = req.body || {};
    const flexTemplatePath = path.join(__dirname, 'flex-message-templates.json');

    const payload = {
      enabled: Boolean(enabled),
      templates: templates && typeof templates === 'object' ? templates : {},
      quickReply: {
        enabled: quickReply?.enabled !== false,
        perType: {
          today: quickReply?.perType?.today === true,
          tomorrow: quickReply?.perType?.tomorrow === true,
          beforeClass: quickReply?.perType?.beforeClass === true,
          student: quickReply?.perType?.student !== false
        },
        options: Array.isArray(quickReply?.options) && quickReply.options.length ? quickReply.options : [
          { label: '✅ 會出席', data: 'attend' },
          { label: '🏥 請假', data: 'leave' },
          { label: '⏳ 待確認', data: 'pending' }
        ],
        leaveReasons: Array.isArray(quickReply?.leaveReasons) && quickReply.leaveReasons.length
          ? quickReply.leaveReasons
          : ['生病', '家庭因素', '臨時有事', '其他']
      },
      carousel: {
        maxBubbles: Number.isInteger(carousel?.maxBubbles) ? carousel.maxBubbles : 10
      }
    };

    fs.writeFileSync(flexTemplatePath, JSON.stringify(payload, null, 2));

    notificationManager.flexTemplates = notificationManager.loadFlexTemplates();

    console.log('✅ Flex Message 範本已儲存');

    res.json({
      success: true,
      message: 'Flex Message 範本已儲存',
      data: payload
    });
  } catch (error) {
    console.error('❌ 儲存 Flex Message 範本失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存 Flex Message 範本失敗',
      error: error.message
    });
  }
});

// 測試發送特定 Flex 範本
app.post('/api/flex-templates/:type/send-test', async (req, res) => {
  const { type } = req.params;
  const { specialEventType, useSpecialTemplate } = req.body || {};
  
  // 🎨 決定實際使用的範本類型
  const actualTemplateType = useSpecialTemplate || type;
  
  // 🎨 根據特殊事件類型調整課程名稱
  const eventNames = {
    '停課': '🔴 停課 - 示範課程',
    '體驗': '🟢 體驗課 - 示範課程',
    '代課': '🔵 代課 - 示範課程',
    '改時間': '🟠 調課 - 示範課程',
    // 講師特殊範本對應的課程名稱
    'todayCancelled': '🔴 停課 - Python 程式設計',
    'tomorrowCancelled': '🔴 停課通知 - 數學課',
    'beforeClassCancelled': '🔴 停課 - 英文會話',
    'todayExperience': '🟢 體驗課 - 機器人程式設計',
    'tomorrowExperience': '🟢 體驗 - Scratch 創意程式',
    'beforeClassExperience': '🟢 體驗課 - 3D 列印設計',
    'todaySubstitute': '🔵 代課 - 物理實驗課',
    'tomorrowSubstitute': '🔵 代課通知 - 化學課',
    'beforeClassSubstitute': '🔵 代課 - 生物課',
    'todayTimeChange': '🟠 調課 - 美術課',
    'tomorrowTimeChange': '🟠 改時間 - 音樂課',
    'beforeClassTimeChange': '🟠 延後 - 體育課',
    // ✅ 新增：學生特殊範本對應的課程名稱
    'studentExperience': '🌟 體驗課 - SPIKE 機器人課程',
    'studentSubstitute': '👥 代課通知 - Python 程式設計',
    'studentTimeChange': '🔄 調課通知 - ESM 樂高課程'
  };
  
  let courseName = '示範課程';
  if (useSpecialTemplate) {
    // 使用特殊範本時，課程名稱從對照表中獲取
    courseName = eventNames[useSpecialTemplate] || '示範課程';
  } else if (specialEventType) {
    // 使用模擬模式時，根據特殊事件類型調整課程名稱
    courseName = eventNames[specialEventType] || '示範課程';
  }
  
  console.log(`🎨 測試發送 - 基礎範本: ${type}, 實際範本: ${actualTemplateType}, 特殊事件模擬: ${specialEventType || '無'}, 課程名稱: ${courseName}`);
  
  const sample = {
    teacherName: '示範講師',
    courseName: courseName,
    courseDate: new Date().toISOString().split('T')[0],
    courseTime: '15:30',
    location: '示範教室',
    weekday: '週二',
    lessonPlanUrl: 'https://funlearnbar.example/lesson-plan',
    googleMapsUrl: 'https://maps.google.com/?q=FunLearnBar',
    studentName: '示範學生',
    timeUntilClass: '45分鐘後',
    reminderTypeText: '示範',
    reminderId: `preview-${Date.now()}`,
    description: '這是示範訊息',
    systemName: '樂程坊課程系統',
    // 🔥 新增學生範本需要的變數
    badgeText: '測試',
    classDetailUrl: 'https://calendar.funlearnbar.synology.me',
    locationMapQuery: encodeURIComponent('示範教室'),
    studentId: 'TEST_STUDENT_001',
    scheduleId: 'TEST_SCHEDULE_001',
    makeupUrl: 'https://calendar.funlearnbar.synology.me'
  };

  try {
    const currentTemplates = notificationManager.flexTemplates || notificationManager.getDefaultFlexTemplates();
    
    // 檢查特殊範本是否存在
    const template = currentTemplates.templates?.[actualTemplateType];

    if (!template) {
      return res.status(404).json({
        success: false,
        message: `找不到 Flex 範本類型: ${actualTemplateType}`
      });
    }

    // 🎨 如果使用特殊範本，直接從範本生成；否則使用 buildFlexMessage（會偵測特殊事件）
    let flexMessage;
    if (useSpecialTemplate) {
      // 直接使用特殊範本
      flexMessage = JSON.parse(JSON.stringify(template));
      flexMessage = notificationManager.replaceFlexVariables(flexMessage, sample);
      flexMessage = notificationManager.cleanFlexMessage(flexMessage);
      console.log(`🌟 使用特殊事件專用範本: ${actualTemplateType}`);
    } else {
      // 使用 buildFlexMessage（會根據 courseName 偵測特殊事件）
      flexMessage = notificationManager.buildFlexMessage(type, sample);
    }
    
    if (!flexMessage) {
      throw new Error('無法建構 Flex Message');
    }
    
    // 🔍 詳細日誌：打印生成的 Flex Message
    console.log(`🔍 [測試發送 ${actualTemplateType}] 生成的 Flex Message:`, JSON.stringify(flexMessage, null, 2));

    const quickReply = notificationManager.buildQuickReply(sample, type);

    const result = await notificationManager.sendTestMessage(`這是 Flex 範本 「${actualTemplateType}」 的測試訊息。`, {
      flexMessage,
      altText: `[測試] ${sample.courseName}`,
      quickReply
    });

    if (!result.success) {
      throw new Error(result.error || '發送測試訊息失敗');
    }

    res.json({
      success: true,
      message: '測試 Flex 範本已發送給管理員',
      data: {
        templateType: actualTemplateType,
        baseType: type,
        useSpecialTemplate: !!useSpecialTemplate,
        sample
      }
    });
  } catch (error) {
    console.error('❌ Flex 測試發送失敗:', error);
    res.status(500).json({
      success: false,
      message: 'Flex 測試發送失敗',
      error: error.message
    });
  }
});

// 測試發送多個學生版本（Carousel + Quick Reply）
app.post('/api/flex-templates/student/send-test-multi', async (req, res) => {
  try {
    const { templateType } = req.body || {};
    console.log(`📤 [測試] 開始發送多個學生版本... (範本: ${templateType || 'student'})`);
    
    // ✅ 根據範本類型決定課程名稱和特殊事件類型
    const templateConfig = {
      'studentExperience': {
        courseName1: '🌟 SPIKE 機器人體驗課',
        courseName2: '🌟 Python 程式設計體驗',
        specialEventType: '體驗'
      },
      'studentSubstitute': {
        courseName1: '👥 ESM 日 9:30 代課',
        courseName2: '👥 SPM 六 9:30 代課',
        specialEventType: '代課'
      },
      'studentTimeChange': {
        courseName1: '🔄 BOOST 調課通知',
        courseName2: '🔄 SPIKE 改時間',
        specialEventType: '改時間'
      },
      'student': {
        courseName1: 'SPM 六 9:30-11:00',
        courseName2: 'ESM 日 9:30-10:30',
        specialEventType: null
      }
    };
    
    const config = templateConfig[templateType] || templateConfig['student'];
    
    // 建立多個示範學生的資料
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const dateStr = `${year}年${month}月${day}日`;
    const weekdays = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const weekday = weekdays[now.getDay()];
    
    const students = [
      {
        studentName: '小明',
        courseName: config.courseName1,
        courseDate: dateStr,
        courseTime: '09:30-11:00',
        location: '站前教室',
        weekday: weekday,
        teacherName: '示範講師',
        lessonPlanUrl: 'https://funlearnbar.example/lesson-plan',
        googleMapsUrl: 'https://maps.google.com/?q=FunLearnBar+站前教室',
        badgeText: '測試',
        classDetailUrl: 'https://calendar.funlearnbar.synology.me',
        locationMapQuery: encodeURIComponent('站前教室'),
        studentId: 'TEST_STUDENT_001',
        scheduleId: 'TEST_SCHEDULE_001',
        makeupUrl: 'https://calendar.funlearnbar.synology.me',
        // ✅ 新增：傳遞特殊事件類型
        specialEventType: config.specialEventType
      },
      {
        studentName: '小華',
        courseName: config.courseName2,
        courseDate: dateStr,
        courseTime: '09:30-10:30',
        location: '站前教室',
        weekday: weekday,
        teacherName: '示範講師',
        lessonPlanUrl: 'https://funlearnbar.example/lesson-plan',
        googleMapsUrl: 'https://maps.google.com/?q=FunLearnBar+站前教室',
        badgeText: '測試',
        classDetailUrl: 'https://calendar.funlearnbar.synology.me',
        locationMapQuery: encodeURIComponent('站前教室'),
        studentId: 'TEST_STUDENT_002',
        scheduleId: 'TEST_SCHEDULE_002',
        makeupUrl: 'https://calendar.funlearnbar.synology.me',
        // ✅ 新增：傳遞特殊事件類型
        specialEventType: config.specialEventType
      }
    ];

    console.log(`🎠 建構 Carousel（${students.length} 個學生，範本: ${templateType || 'student'}）...`);
    
    // ✅ 建構 Carousel，傳遞指定的範本類型
    const carousel = notificationManager.buildCarousel(students, templateType || 'student');
    if (!carousel) {
      throw new Error('建構 Carousel 失敗');
    }

    console.log('✅ Carousel 建構成功');

    // 建構統一 Quick Reply（多個學生）
    console.log('💬 建構多學生 Quick Reply...');
    const quickReply = notificationManager.buildMultiStudentQuickReply(students, 'student');
    if (quickReply) {
      console.log('✅ Quick Reply 建構成功');
    } else {
      console.log('⚠️ Quick Reply 建構失敗（可能未啟用）');
    }

    // 發送測試訊息
    const result = await notificationManager.sendTestMessage('這是多個學生 Carousel + Quick Reply 的測試訊息。', {
      flexMessage: carousel,
      altText: `[測試] 課程提醒 - ${students.length} 個孩子的課程`,
      quickReply
    });

    if (!result.success) {
      throw new Error(result.error || '發送測試訊息失敗');
    }

    res.json({
      success: true,
      message: `測試 Carousel 已發送給管理員（${students.length} 個學生）`,
      studentCount: students.length,
      students: students.map(s => s.studentName)
    });
    
  } catch (error) {
    console.error('❌ 多學生 Carousel 測試發送失敗:', error);
    res.status(500).json({
      success: false,
      message: '多學生 Carousel 測試發送失敗',
      error: error.message
    });
  }
});
// 兼容別名：提供 /api/calendar-events 與 /api/events 相同資料
app.get('/api/calendar-events', async (req, res) => {
  try {
    const forceRefresh = req.query.forceRefresh === 'true';
    const cacheAge = eventsCache.lastUpdate ? (Date.now() - eventsCache.lastUpdate) / 1000 : Infinity;
    const cacheMaxAge = 600; // 10 分鐘

    if (eventsCache.data && cacheAge < cacheMaxAge && !forceRefresh) {
      return res.json({
        ...eventsCache.data,
        cached: true,
        cacheAge: Math.floor(cacheAge)
      });
    }

    await updateEventsCache();

    if (eventsCache.data) {
      const finalCacheAge = eventsCache.lastUpdate ? (Date.now() - eventsCache.lastUpdate) / 1000 : 0;
      return res.json({
        ...eventsCache.data,
        cached: true,
        cacheAge: Math.floor(finalCacheAge)
      });
    }

    return res.json({
      success: true,
      events: [],
      data: [],
      source: 'mock',
      cached: false,
      cacheAge: null,
      lastUpdate: null
    });
  } catch (error) {
    console.error('❌ /api/calendar-events 失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得行事曆事件失敗',
      error: error.message
    });
  }
});

// 儲存提醒資料
function saveReminders(remindersData) {
  try {
    fs.writeFileSync(remindersDataPath, JSON.stringify(remindersData, null, 2));
    return true;
  } catch (error) {
    console.error('儲存提醒資料失敗:', error);
    return false;
  }
}
// 獲取提醒列表API
app.get('/api/reminders', (req, res) => {
  try {
    console.log('📋 獲取提醒列表...');
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    const studentReminders = remindersData.studentReminders || [];
    console.log(`✅ 成功獲取 ${reminders.length} 個一般提醒，${studentReminders.length} 個學生提醒`);
    
    // 顯示提醒統計
    const statusCounts = reminders.reduce((acc, reminder) => {
      acc[reminder.status] = (acc[reminder.status] || 0) + 1;
      return acc;
    }, {});
    console.log('📊 一般提醒狀態統計:', statusCounts);
    
    const studentStatusCounts = studentReminders.reduce((acc, reminder) => {
      acc[reminder.status] = (acc[reminder.status] || 0) + 1;
      return acc;
    }, {});
    console.log('📊 學生提醒狀態統計:', studentStatusCounts);
    
    res.json({
      success: true,
      data: reminders,
      studentReminders: studentReminders,
      count: reminders.length + studentReminders.length
    });
  } catch (error) {
    console.error('❌ 獲取提醒列表失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取提醒列表失敗',
      error: error.message
    });
  }
});

// 建立新提醒API
app.post('/api/reminders', async (req, res) => {
  try {
    const { teacherName, courseName, courseDate, courseTime, type, message } = req.body;
    
    console.log('📝 收到建立提醒請求:', { teacherName, courseName, courseDate, courseTime, type, hasMessage: !!message });
    
    if (!teacherName || !courseName || !courseDate || !courseTime || !type) {
      console.log('❌ 缺少必要參數');
      return res.status(400).json({
        success: false,
        message: '缺少必要參數'
      });
    }
    
    const remindersData = loadReminders();
    
    // 計算提醒時間（統一使用 UTC 格式）
    let scheduledTime;
    if (type === 'before-class') {
      // 課前提醒：課程時間前30分鐘
      const beforeClassMinutes = 30; // 可從設定檔讀取
      const [year, month, day] = courseDate.split('-').map(Number);
      const [hour, minute] = courseTime.split(':').map(Number);
      
      // ✅ 使用正確的台灣時區轉換
      const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
      const courseDateTimeUTC = new Date(taiwanTimeStr);
      
      // 計算課前提醒時間（提前指定分鐘）
      const beforeClassTime = new Date(courseDateTimeUTC.getTime() - (beforeClassMinutes * 60 * 1000));
      scheduledTime = beforeClassTime.toISOString();
      
      console.log(`⏰ 手動創建課前提醒: ${courseName} - ${teacherName}`);
      console.log(`   課程時間 (台灣): ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
      console.log(`   課程時間 (UTC): ${courseDateTimeUTC.toISOString()}`);
      console.log(`   課前提醒時間 (UTC): ${scheduledTime}`);
      console.log(`   課前提醒時間 (台灣): ${new Date(scheduledTime).toLocaleString('zh-TW', {timeZone: 'Asia/Taipei'})} (提前${beforeClassMinutes}分鐘)`);
    } else if (type === 'today') {
      // 當日提醒：當天08:00（台灣時間）
      const [year, month, day] = courseDate.split('-').map(Number);
      const reminderDate = new Date(year, month - 1, day, 8, 0, 0);
      
      // 轉換為 UTC 時間格式（台灣時間 - 8小時）
      const utcTime = new Date(reminderDate.getTime() - (8 * 60 * 60 * 1000));
      scheduledTime = utcTime.toISOString();
    } else if (type === 'tomorrow') {
      // 隔日提醒：前一天19:30（台灣時間）
      const [year, month, day] = courseDate.split('-').map(Number);
      const reminderDate = new Date(year, month - 1, day - 1, 19, 30, 0);
      
      // 轉換為 UTC 時間格式（台灣時間 - 8小時）
      const utcTime = new Date(reminderDate.getTime() - (8 * 60 * 60 * 1000));
      scheduledTime = utcTime.toISOString();
    }
    
    // 生成提醒訊息（如果沒有提供自定義訊息）
    let generatedMessage = message;
    if (!generatedMessage) {
      generatedMessage = await generateManualReminderMessage(teacherName, courseName, courseDate, courseTime, type);
    }
    
    // ✅ 嘗試從 CalDAV 獲取完整的課程資訊
    let location = '未指定地點';
    let description = '';
    let lessonPlanUrl = '';
    let googleMapsUrl = '';
    
    try {
      // 使用全域的 CalDAV 客戶端
      if (!caldavClient) {
        console.log('⚠️ CalDAV 客戶端未初始化，無法獲取課程資訊');
        throw new Error('CalDAV 客戶端未初始化');
      }
      
      // 獲取當天的所有講師事件
      const startDate = new Date(courseDate + 'T00:00:00+08:00');
      const endDate = new Date(courseDate + 'T23:59:59+08:00');
      console.log(`📅 查詢 ${courseDate} 的行事曆事件...`);
      const events = await caldavClient.getAllInstructorEvents(startDate, endDate);
      console.log(`📋 找到 ${events.length} 個事件`);
      
      // 尋找匹配的事件
      const matchedEvent = events.find(event => {
        const eventTitle = event.title || event.summary || '';
        const eventInstructor = event.instructor || '';
        
        // 從課程名稱中提取關鍵字（例如：「ESM 四 17:30-18:30 到府 第8週」 -> 「ESM」）
        const courseKeyword = courseName.split(/\s+/)[0];
        
        // 比對課程名稱和講師（使用更寬鬆的匹配）
        const titleMatch = eventTitle.includes(courseKeyword) || courseName.includes(eventTitle);
        const instructorMatch = eventInstructor === teacherName;
        
        console.log(`🔍 檢查事件: "${eventTitle}" vs "${courseName}" (關鍵字: "${courseKeyword}"), 講師: ${eventInstructor} vs ${teacherName}`);
        console.log(`   匹配結果: 標題=${titleMatch}, 講師=${instructorMatch}`);
        
        return titleMatch && instructorMatch;
      });
      
      if (matchedEvent) {
        console.log('✅ 找到對應的行事曆事件，提取完整資訊');
        location = matchedEvent.location || '未指定地點';
        description = matchedEvent.description || '';
        
        // 從描述中提取教案連結
        const notionUrlRegex = /\(https:\/\/www\.notion\.so\/([^)]+)\)/;
        let notionMatch = description.match(notionUrlRegex);
        
        if (!notionMatch) {
          const generalNotionRegex = /https:\/\/www\.notion\.so\/([^)\s]+)/;
          notionMatch = description.match(generalNotionRegex);
        }
        
        if (notionMatch) {
          lessonPlanUrl = `https://www.notion.so/${notionMatch[1]}`;
        }
        
        // 生成 Google Maps URL
        if (location && location !== '未指定地點') {
          googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
        }
        
        console.log(`📍 地點: ${location}`);
        console.log(`📖 教案連結: ${lessonPlanUrl || '未設定'}`);
      } else {
        console.log('⚠️ 找不到對應的行事曆事件，使用預設值');
      }
    } catch (error) {
      console.error('❌ 獲取行事曆事件失敗:', error.message);
    }
    
    // 計算星期幾
    const date = new Date(courseDate);
    const weekday = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'][date.getDay()];
    
    // ✅ 查找講師的 LINE User ID（在創建提醒時就設置，避免後續查找問題）
    let teacherUserId = null;
    try {
      const teacherInfo = TeacherRegistry.findTeacherByName(teacherName);
      if (teacherInfo && teacherInfo.userId) {
        // ✅ 驗證 User ID 不是測試 ID
        if (teacherInfo.userId !== 'local-test-user' && 
            !teacherInfo.userId.startsWith('test-') && 
            !teacherInfo.userId.startsWith('local-') &&
            teacherInfo.userId.startsWith('U') &&
            teacherInfo.userId.length === 33) {
          teacherUserId = teacherInfo.userId;
          console.log(`✅ 找到講師 ${teacherName} 的 User ID: ${teacherUserId}`);
        } else {
          console.log(`⚠️ 講師 ${teacherName} 的 User ID 是測試 ID 或無效格式: ${teacherInfo.userId}`);
        }
      } else {
        console.log(`⚠️ 找不到講師 ${teacherName} 的 User ID`);
      }
    } catch (error) {
      console.error(`❌ 查找講師 User ID 失敗:`, error);
    }
    
    const newReminder = {
      id: `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      teacherName,
      teacherUserId: teacherUserId, // ✅ 在創建時就設置正確的 User ID
      courseName,
      courseDate,
      courseTime,
      type,
      message: generatedMessage,
      status: 'pending',
      scheduledTime: scheduledTime,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      // ✅ 新增 Flex Message 需要的欄位
      location: location,
      description: description,
      lessonPlanUrl: lessonPlanUrl,
      googleMapsUrl: googleMapsUrl,
      weekday: weekday
    };
    
    remindersData.reminders = remindersData.reminders || [];
    remindersData.reminders.push(newReminder);
    
    if (saveReminders(remindersData)) {
      console.log('✅ 提醒建立成功:', newReminder.id);
      res.json({
        success: true,
        message: '提醒建立成功',
        data: newReminder
      });
    } else {
      throw new Error('儲存提醒資料失敗');
    }
    
  } catch (error) {
    console.error('❌ 建立提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '建立提醒失敗',
      error: error.message
    });
  }
});
// 發送提醒API
app.post('/api/reminders/:id/send', async (req, res) => {
  try {
    const reminderId = req.params.id;
    const remindersData = loadReminders();
    const reminder = remindersData.reminders.find(r => r.id === reminderId);
    
    if (!reminder) {
      console.log('❌ 發送提醒失敗: 找不到提醒', reminderId);
      return res.status(404).json({
        success: false,
        message: '找不到指定的提醒'
      });
    }
    
    console.log('📤 開始發送提醒:', reminderId);
    console.log('📋 提醒詳情:', {
      teacherName: reminder.teacherName,
      courseName: reminder.courseName,
      courseDate: reminder.courseDate,
      courseTime: reminder.courseTime,
      type: reminder.type,
      status: reminder.status,
      teacherUserId: reminder.teacherUserId || '(無)'
    });
    
    // 查找講師的LINE User ID
    console.log('🔍 開始查找講師LINE User ID...');
    console.log(`📋 提醒中的講師名稱: ${reminder.teacherName}`);
    console.log(`📋 提醒中存儲的 teacherUserId: ${reminder.teacherUserId || '(無)'}`);
    
    // ✅ 如果提醒中存儲的 User ID 是測試 ID，則強制清除它並重新查找
    if (reminder.teacherUserId && (reminder.teacherUserId === 'local-test-user' || reminder.teacherUserId.startsWith('test-') || reminder.teacherUserId.startsWith('local-'))) {
      console.log(`🚨 提醒中存儲的 User ID "${reminder.teacherUserId}" 是測試 ID，強制清除並重新查找...`);
      reminder.teacherUserId = null; // 清除測試 ID
      // ✅ 立即保存，確保不會再次使用測試 ID
      saveReminders(remindersData);
      console.log('✅ 已清除提醒中的測試 ID 並保存');
    }
    
    // ✅ 強制清除快取並重新載入最新資料
    TeacherRegistry.reload(); // 清除快取
    console.log('🔄 已強制重新載入 TeacherRegistry');
    
    // ✅ 直接從檔案讀取，確保使用最新資料
    console.log('📂 直接從檔案讀取 teacher_data.json...');
    const teacherData = JSON.parse(fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8'));
    console.log(`📋 檔案中的講師數量: ${teacherData.teachers?.length || 0}`);
    
    // ✅ 先從檔案中查找，確保使用最新資料
    let teacherUserId = null;
    if (Array.isArray(teacherData.teachers)) {
      const correctTeacher = teacherData.teachers.find(t => {
        const nameMatch = t.name === reminder.teacherName || 
                         t.name?.toUpperCase() === reminder.teacherName?.toUpperCase() ||
                         t.name?.toLowerCase() === reminder.teacherName?.toLowerCase();
        const isValid = t.userId && 
                        t.userId !== 'local-test-user' && 
                        !t.userId.startsWith('test-') && 
                        !t.userId.startsWith('local-') &&
                        t.name !== 'local-test-user' &&
                        !t.name.startsWith('test-') &&
                        !t.name.startsWith('local-');
        return nameMatch && isValid;
      });
      
      if (correctTeacher) {
        teacherUserId = correctTeacher.userId;
        console.log(`✅ 從檔案直接找到講師 ${reminder.teacherName}: ${teacherUserId}`);
      } else {
        console.log(`⚠️ 檔案中未找到有效的講師 ${reminder.teacherName}，嘗試使用 TeacherRegistry...`);
      }
    }
    
    // ✅ 如果檔案查找失敗，使用 TeacherRegistry
    if (!teacherUserId) {
      let teacherInfo = TeacherRegistry.findTeacherByName(reminder.teacherName);
      
      if (teacherInfo && teacherInfo.userId) {
        teacherUserId = teacherInfo.userId;
        console.log(`✅ 使用 TeacherRegistry 找到講師 ${reminder.teacherName}: ${teacherUserId}`);
        
        // ✅ 驗證找到的 User ID 不是測試 ID
        if (teacherUserId === 'local-test-user' || teacherUserId.startsWith('test-') || teacherUserId.startsWith('local-')) {
          console.log(`❌ TeacherRegistry 返回的 User ID "${teacherUserId}" 是測試 ID，將重新從檔案查找...`);
          teacherInfo = null;
          teacherUserId = null;
        }
      }
    }
    
    // ✅ 如果還是沒找到，使用回退邏輯
    if (!teacherUserId) {
      console.log('⚠️ 前兩種方法都未找到，使用回退邏輯...');
      
      // ✅ 統一處理：如果 teachers 是陣列格式，轉換為物件格式
      // ✅ 同時過濾掉測試名稱（如 "local-test-user"）
      let teachers = teacherData.teachers;
      if (Array.isArray(teachers)) {
        const teachersObj = {};
        console.log(`📋 開始處理 ${teachers.length} 個講師條目...`);
        teachers.forEach(teacher => {
          // ✅ 詳細日誌：顯示每個講師的資訊
          console.log(`🔍 檢查講師: name="${teacher.name}", userId="${teacher.userId}"`);
          
          // ✅ 跳過測試名稱的講師條目
          if (teacher.name && teacher.userId) {
            // ✅ 檢查是否為測試名稱或測試 ID
            const isTestName = teacher.name === 'local-test-user' || 
                              teacher.name.startsWith('test-') || 
                              teacher.name.startsWith('local-');
            const isTestUserId = teacher.userId === 'local-test-user' || 
                                teacher.userId.startsWith('test-') || 
                                teacher.userId.startsWith('local-');
            
            if (isTestName || isTestUserId) {
              console.log(`⚠️ 跳過測試條目: name="${teacher.name}", userId="${teacher.userId}" (isTestName=${isTestName}, isTestUserId=${isTestUserId})`);
            } else {
              // ✅ 特別處理：如果已經有同名講師，檢查並替換為正確的 User ID
              if (teachersObj[teacher.name]) {
                const existingUserId = teachersObj[teacher.name];
                if (existingUserId === 'local-test-user' || existingUserId.startsWith('test-') || existingUserId.startsWith('local-')) {
                  console.log(`🔄 替換測試 ID: ${teacher.name} (${existingUserId} -> ${teacher.userId})`);
                  teachersObj[teacher.name] = teacher.userId;
                } else {
                  console.log(`⚠️ 重複的講師名稱 "${teacher.name}"，保留現有的 User ID: ${existingUserId}`);
                }
              } else {
                teachersObj[teacher.name] = teacher.userId;
                console.log(`✅ 載入講師: ${teacher.name} -> ${teacher.userId}`);
              }
            }
          } else {
            console.log(`⚠️ 跳過無效條目: name="${teacher.name}", userId="${teacher.userId}"`);
          }
        });
        teachers = teachersObj;
        console.log(`✅ 已將 teacher_data.json 從陣列格式轉換為物件格式（${Object.keys(teachersObj).length} 位講師）`);
        console.log(`📋 最終 teachersObj 內容:`, JSON.stringify(teachersObj, null, 2));
      }
      
      console.log('📚 可用的講師列表:', Object.keys(teachers));
      console.log(`🔍 查找講師 "${reminder.teacherName}" 在 teachers 物件中...`);
      console.log(`🔍 teachers["${reminder.teacherName}"] =`, teachers[reminder.teacherName]);
      
      // 嘗試不同的名稱格式匹配
      teacherUserId = teachers[reminder.teacherName];
      console.log('🔍 嘗試精確匹配:', reminder.teacherName, '->', teacherUserId ? `✅ 找到: ${teacherUserId}` : '❌ 未找到');
      
      // ✅ 如果找到的是測試 ID，立即清除並重新查找
      if (teacherUserId && (teacherUserId === 'local-test-user' || teacherUserId.startsWith('test-') || teacherUserId.startsWith('local-'))) {
        console.log(`🚨 發現測試 ID "${teacherUserId}"，清除並重新查找...`);
        teacherUserId = null;
      }
      
      if (!teacherUserId) {
        // 嘗試首字母大寫格式
        const capitalizedName = reminder.teacherName.charAt(0).toUpperCase() + reminder.teacherName.slice(1).toLowerCase();
        teacherUserId = teachers[capitalizedName];
        console.log('🔍 嘗試首字母大寫:', capitalizedName, '->', teacherUserId ? `✅ 找到: ${teacherUserId}` : '❌ 未找到');
      }
      
      if (!teacherUserId) {
        // 嘗試全小寫格式
        const lowerCaseName = reminder.teacherName.toLowerCase();
        teacherUserId = teachers[lowerCaseName];
        console.log('🔍 嘗試全小寫:', lowerCaseName, '->', teacherUserId ? `✅ 找到: ${teacherUserId}` : '❌ 未找到');
      }
      
      if (!teacherUserId) {
        // 嘗試模糊匹配（排除測試名稱）
        const teacherNames = Object.keys(teachers).filter(name => 
          name !== 'local-test-user' && !name.startsWith('test-') && !name.startsWith('local-')
        );
        const matchedTeacher = teacherNames.find(name => 
          name.toLowerCase() === reminder.teacherName.toLowerCase() ||
          name.toUpperCase() === reminder.teacherName.toUpperCase()
        );
        
        if (matchedTeacher) {
          teacherUserId = teachers[matchedTeacher];
          console.log('🔍 模糊匹配成功:', matchedTeacher, '->', teacherUserId ? `✅ 找到: ${teacherUserId}` : '❌ 未找到');
        } else {
          console.log('🔍 模糊匹配失敗');
        }
      }
    }
    
    // ✅ 最終驗證：如果找到的 User ID 是測試 ID，強制從檔案重新查找
    if (teacherUserId && (teacherUserId === 'local-test-user' || teacherUserId.startsWith('test-') || teacherUserId.startsWith('local-'))) {
      console.log(`🚨 最終驗證失敗：找到的 User ID "${teacherUserId}" 是測試 ID，強制從檔案重新查找...`);
      const freshTeacherData = JSON.parse(fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8'));
      if (Array.isArray(freshTeacherData.teachers)) {
        const correctTeacher = freshTeacherData.teachers.find(t => {
          const nameMatch = t.name === reminder.teacherName || 
                           t.name?.toUpperCase() === reminder.teacherName?.toUpperCase() ||
                           (reminder.teacherName === 'TIM' && t.name === 'TIM');
          const isValid = t.userId && 
                          t.userId !== 'local-test-user' && 
                          !t.userId.startsWith('test-') && 
                          !t.userId.startsWith('local-') &&
                          t.userId.startsWith('U') &&
                          t.userId.length === 33;
          return nameMatch && isValid;
        });
        
        if (correctTeacher) {
          teacherUserId = correctTeacher.userId;
          console.log(`✅ 已強制修正為正確的 User ID: ${teacherUserId}`);
        } else {
          console.log(`❌ 無法從檔案中找到有效的講師 ${reminder.teacherName}`);
          console.log(`📋 檔案中的所有講師:`, freshTeacherData.teachers.map(t => `${t.name} (${t.userId})`).join(', '));
        }
      }
    }
    
    if (!teacherUserId) {
      console.log(`❌ 找不到講師 ${reminder.teacherName} 的LINE User ID`);
      const teacherList = TeacherRegistry.getTeacherList();
      console.log(`📋 可用的講師: ${teacherList.map(t => t.name).join(', ')}`);
      return res.status(400).json({
        success: false,
        message: `找不到講師 ${reminder.teacherName} 的LINE User ID`
      });
    }
    
    // ✅ 最終驗證：在輸出之前再次檢查
    if (teacherUserId && (teacherUserId === 'local-test-user' || teacherUserId.startsWith('test-') || teacherUserId.startsWith('local-'))) {
      console.log(`🚨 最終驗證：發現測試 ID "${teacherUserId}"，強制修正...`);
      const freshTeacherData = JSON.parse(fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8'));
      if (Array.isArray(freshTeacherData.teachers)) {
        const correctTeacher = freshTeacherData.teachers.find(t => {
          const nameMatch = t.name === reminder.teacherName || 
                           t.name?.toUpperCase() === reminder.teacherName?.toUpperCase() ||
                           (reminder.teacherName === 'TIM' && t.name === 'TIM');
          const isValid = t.userId && 
                          t.userId !== 'local-test-user' && 
                          !t.userId.startsWith('test-') && 
                          !t.userId.startsWith('local-') &&
                          t.userId.startsWith('U') &&
                          t.userId.length === 33;
          return nameMatch && isValid;
        });
        
        if (correctTeacher) {
          const oldUserId = teacherUserId;
          teacherUserId = correctTeacher.userId;
          console.log(`✅ 已強制修正 User ID: ${oldUserId} -> ${teacherUserId}`);
        } else {
          console.log(`❌ 無法從檔案中找到有效的講師 ${reminder.teacherName}`);
          console.log(`📋 檔案中的所有講師:`, freshTeacherData.teachers.map(t => `${t.name} (${t.userId})`).join(', '));
          return res.status(400).json({
            success: false,
            message: `找不到講師 ${reminder.teacherName} 的有效 LINE User ID`
          });
        }
      }
    }
    
    console.log('✅ 找到講師LINE User ID:', teacherUserId);
    
    // 準備變數用於 Flex Message
    console.log('📝 開始準備提醒訊息...');
    
    // ✅ 動態計算距離上課的時間
    let timeUntilClass = '30分鐘後';  // 預設值
    if (reminder.type === 'before-class' && reminder.courseDate && reminder.courseTime) {
      try {
        const [year, month, day] = reminder.courseDate.split('-').map(Number);
        const [hour, minute] = reminder.courseTime.split(':').map(Number);
        
        // 使用台灣時區創建課程時間
        const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
        const courseDateTime = new Date(taiwanTimeStr);
        const now = new Date();
        const diff = courseDateTime - now;
        const minutesUntil = Math.floor(diff / (1000 * 60));
        
        if (minutesUntil > 60) {
          const hours = Math.floor(minutesUntil / 60);
          const mins = minutesUntil % 60;
          timeUntilClass = mins > 0 ? `${hours}小時${mins}分鐘後` : `${hours}小時後`;
        } else if (minutesUntil > 0) {
          timeUntilClass = `${minutesUntil}分鐘後`;
        } else if (minutesUntil > -30) {
          timeUntilClass = '即將開始';
        } else {
          timeUntilClass = '已開始';
        }
        
        console.log(`⏰ 計算上課時間: 課程時間=${taiwanTimeStr}, 剩餘=${timeUntilClass}`);
      } catch (error) {
        console.error('❌ 計算上課時間失敗:', error);
      }
    }
    
    const variables = {
      teacherName: reminder.teacherName || '未知講師',
      courseName: reminder.courseName || '未知課程',
      courseDate: reminder.courseDate || '未知日期',
      courseTime: reminder.courseTime || '未知時間',
      location: reminder.location || '未指定地點',
      description: reminder.description || '',
      lessonPlanUrl: reminder.lessonPlanUrl || '',
      googleMapsUrl: reminder.googleMapsUrl || 'https://maps.google.com',
      weekday: reminder.weekday || getWeekday(reminder.courseDate),  // ✅ 優先使用 reminder.weekday
      currentTime: new Date().toLocaleTimeString('zh-TW'),
      currentDate: new Date().toLocaleDateString('zh-TW'),
      reminderType: reminder.type,
      reminderTypeText: reminder.type === 'today' ? '當日' : reminder.type === 'tomorrow' ? '隔日' : '課前',
      timeUntilClass: timeUntilClass,  // ✅ 使用動態計算的值
      systemName: '樂程坊課程系統',
      reminderId: reminder.id
    };

    // 檢查是否有 LINE Channel Access Token
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      console.error('❌ LINE_CHANNEL_ACCESS_TOKEN 未設定，無法發送提醒');
      return res.status(500).json({
        success: false,
        message: 'LINE_CHANNEL_ACCESS_TOKEN 未設定，無法發送提醒',
        data: reminder
      });
    }

    // 使用 NotificationManager 發送
    console.log('📤 開始透過 NotificationManager 發送提醒...');
    console.log('🎯 目標講師:', reminder.teacherName, 'LINE User ID:', teacherUserId);
    
    // 準備發送選項
    let sendOptions = {};
    let notificationMessage;

    // 檢查是否啟用 Flex Message
    if (notificationManager.flexTemplates.enabled) {
      console.log('✨ 使用 Flex Message 格式');
      const flexMessage = notificationManager.buildFlexMessage(reminder.type, variables);
      if (flexMessage) {
        sendOptions.flexMessage = flexMessage;
        sendOptions.altText = `${variables.reminderTypeText}課程提醒 - ${variables.courseName}`;
        notificationMessage = sendOptions.altText; // 用於 log
      }
    }

    // 如果沒有 Flex Message，使用文字訊息
    if (!sendOptions.flexMessage) {
      console.log('📝 使用文字訊息格式');
      if (reminder.message) {
        notificationMessage = processTemplate(reminder.message, reminder);
      } else {
        const templates = {
          today: `📚 今日課程提醒\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}\n📍 地點：{location}\n\n請準備好課程內容，祝教學順利！`,
          tomorrow: `📚 明日課程提醒\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}\n📍 地點：{location}\n\n請提前準備課程內容！`,
          'before-class': `📚 課程即將開始\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}\n📍 地點：{location}\n⌛ 距離上課：{timeUntilClass}\n\n課程即將開始，請準備就緒！`
        };
        const template = templates[reminder.type] || `📚 課程提醒\n\n👨‍🏫 講師：{teacherName}\n📖 課程：{courseName}\n⏰ 時間：{courseTime}\n📅 日期：{courseDate}`;
        notificationMessage = notificationManager.formatMessage(template, variables);
      }
    }

    console.log('📝 訊息類型:', sendOptions.flexMessage ? 'Flex Message' : '文字訊息');
    
    // 按類型決定是否附加 Quick Reply
    console.log(`🔍 [Server] 開始檢查 Quick Reply，提醒類型: ${reminder.type}`);
    const qr = notificationManager.buildQuickReply(variables, reminder.type);
    if (qr) {
      sendOptions.quickReply = qr;
      console.log(`✅ [Server] Quick Reply 已附加到 sendOptions`);
    } else {
      console.log(`❌ [Server] 類型 ${reminder.type} 不需要 Quick Reply`);
    }
    console.log(`📊 [Server] 最終 sendOptions:`, JSON.stringify({
      hasFlexMessage: !!sendOptions.flexMessage,
      hasQuickReply: !!sendOptions.quickReply,
      altText: sendOptions.altText
    }, null, 2));

    // 透過 NotificationManager 發送
    const result = await notificationManager.sendLineMessage(teacherUserId, notificationMessage, sendOptions);
    
    // ✅ 處理跳過的訊息（無效的 User ID 格式）
    if (result.skipped) {
      console.log(`⏭️ 跳過發送提醒給 ${reminder.teacherName} (${result.details || result.error})`);
      
      // 更新提醒狀態為 skipped
      reminder.status = 'skipped';
      reminder.error = result.details || result.error || 'User ID 格式無效';
      reminder.updatedAt = new Date().toISOString();
      saveReminders(remindersData);
      
      // 返回成功回應（因為這是預期的行為，不是錯誤）
      return res.json({
        success: true,
        message: '提醒已跳過（測試 ID 或無效格式）',
        skipped: true,
        details: result.details || result.error,
        data: reminder
      });
    }
    
    // 處理實際發送失敗的情況
    if (!result.success) {
      throw new Error(result.error || '發送失敗');
    }
    
    console.log('📊 訊息發送成功');
    
    // 更新提醒狀態
    console.log('💾 更新提醒狀態為 sent...');
    reminder.status = 'sent';
    reminder.sentAt = new Date().toISOString();
    reminder.updatedAt = new Date().toISOString();
    saveReminders(remindersData);
    console.log('✅ 提醒狀態更新完成');
    
    console.log('✅ 提醒發送成功:', reminderId);
    res.json({
      success: true,
      message: '提醒發送成功',
      data: reminder,
      flexMessageUsed: !!sendOptions.flexMessage,
      messageType: sendOptions.flexMessage ? 'flex' : 'text'
    });
    
  } catch (error) {
    console.error('❌ 發送提醒失敗:', error);
    
    // 更新提醒狀態為失敗
    const remindersData = loadReminders();
    const reminder = remindersData.reminders.find(r => r.id === req.params.id);
    if (reminder) {
      reminder.status = 'failed';
      reminder.updatedAt = new Date().toISOString();
      saveReminders(remindersData);
    }
    
    res.status(500).json({
      success: false,
      message: '發送提醒失敗',
      error: error.message
    });
  }
});

// 測試發送提醒 API（僅發送給管理員）
app.post('/api/reminders/:id/send-test', async (req, res) => {
  try {
    const reminderId = req.params.id;
    const remindersData = loadReminders();
    const reminder = remindersData.reminders.find(r => r.id === reminderId);
    
    if (!reminder) {
      console.log('❌ 測試發送失敗: 找不到提醒', reminderId);
      return res.status(404).json({
        success: false,
        message: '找不到指定的提醒'
      });
    }
    
    console.log('🧪 測試模式：開始發送提醒給管理員:', reminderId);
    console.log('📋 提醒詳情:', {
      teacherName: reminder.teacherName,
      courseName: reminder.courseName,
      courseDate: reminder.courseDate,
      courseTime: reminder.courseTime,
      type: reminder.type
    });
    
    // 獲取管理員 User ID
    const adminUserId = notificationManager.getAdminUserId();
    console.log('👤 管理員 User ID:', adminUserId);
    
    // ✅ 動態計算距離上課的時間
    let timeUntilClass = '30分鐘後';  // 預設值
    if (reminder.type === 'before-class' && reminder.courseDate && reminder.courseTime) {
      try {
        const [year, month, day] = reminder.courseDate.split('-').map(Number);
        const [hour, minute] = reminder.courseTime.split(':').map(Number);
        
        // 使用台灣時區創建課程時間
        const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
        const courseDateTime = new Date(taiwanTimeStr);
        const now = new Date();
        const diff = courseDateTime - now;
        const minutesUntil = Math.floor(diff / (1000 * 60));
        
        if (minutesUntil > 60) {
          const hours = Math.floor(minutesUntil / 60);
          const mins = minutesUntil % 60;
          timeUntilClass = mins > 0 ? `${hours}小時${mins}分鐘後` : `${hours}小時後`;
        } else if (minutesUntil > 0) {
          timeUntilClass = `${minutesUntil}分鐘後`;
        } else if (minutesUntil > -30) {
          timeUntilClass = '即將開始';
        } else {
          timeUntilClass = '已開始';
        }
        
        console.log(`⏰ [測試] 計算上課時間: 課程時間=${taiwanTimeStr}, 剩餘=${timeUntilClass}`);
      } catch (error) {
        console.error('❌ 計算上課時間失敗:', error);
      }
    }
    
    // 準備變數
    const variables = {
      teacherName: reminder.teacherName || '未知講師',
      courseName: reminder.courseName || '未知課程',
      courseDate: reminder.courseDate || '未知日期',
      courseTime: reminder.courseTime || '未知時間',
      location: reminder.location || '未指定地點',
      description: reminder.description || '',
      lessonPlanUrl: reminder.lessonPlanUrl || '',
      googleMapsUrl: reminder.googleMapsUrl || 'https://maps.google.com',
      weekday: reminder.weekday || getWeekday(reminder.courseDate),  // ✅ 優先使用 reminder.weekday
      currentTime: new Date().toLocaleTimeString('zh-TW'),
      currentDate: new Date().toLocaleDateString('zh-TW'),
      reminderType: reminder.type,
      reminderTypeText: reminder.type === 'today' ? '當日' : reminder.type === 'tomorrow' ? '隔日' : '課前',
      timeUntilClass: timeUntilClass,  // ✅ 使用動態計算的值
      systemName: '樂程坊課程系統',
      reminderId: reminder.id
    };
    
    // 檢查是否啟用 Flex Message
    let sendOptions = {};
    if (notificationManager.flexTemplates.enabled) {
      const flexMessage = notificationManager.buildFlexMessage(reminder.type, variables);
      if (flexMessage) {
        sendOptions.flexMessage = flexMessage;
        sendOptions.altText = `[測試] ${variables.reminderTypeText}課程提醒 - ${variables.courseName}`;
      }
    }
    
    // 構建測試訊息
    let testMessage;
    if (!sendOptions.flexMessage) {
      // 使用文字訊息
      testMessage = `[測試模式]\n\n📚 ${variables.reminderTypeText}課程提醒\n\n👨‍🏫 講師：${variables.teacherName}\n📖 課程：${variables.courseName}\n⏰ 時間：${variables.courseTime}\n📅 日期：${variables.courseDate}\n📍 地點：${variables.location}\n\n這是測試訊息，僅發送給管理員。`;
    }
    
    // 使用 NotificationManager 發送測試訊息
    const result = await notificationManager.sendTestMessage(testMessage, sendOptions);
    
    if (result.success) {
      console.log('✅ 測試訊息發送成功');
      res.json({
        success: true,
        message: '測試訊息已發送給管理員',
        flexMessageUsed: !!sendOptions.flexMessage,
        messageType: sendOptions.flexMessage ? 'flex' : 'text',
        data: {
          reminder: reminder,
          sentTo: 'admin',
          adminUserId: adminUserId,
          flexMessageEnabled: notificationManager.flexTemplates.enabled
        }
      });
    } else {
      throw new Error(result.error || '發送測試訊息失敗');
    }
    
  } catch (error) {
    console.error('❌ 測試發送失敗:', error);
    res.status(500).json({
      success: false,
      message: '測試發送失敗',
      error: error.message
    });
  }
});

// ✅ 新增：學生提醒測試發送 API（僅發送給管理員）
app.post('/api/student-reminders/:id/send-test', async (req, res) => {
  try {
    const reminderId = req.params.id;
    console.log(`🧪 [測試] 學生提醒測試發送請求: ${reminderId}`);

    // 讀取學生提醒資料
    const reminderData = loadReminders();
    const studentReminders = reminderData.studentReminders || [];
    const reminder = studentReminders.find(r => r.id === reminderId);

    if (!reminder) {
      console.log('❌ 測試發送失敗: 找不到學生提醒', reminderId);
      return res.status(404).json({
        success: false,
        message: '找不到指定的學生提醒'
      });
    }

    console.log(`📝 學生提醒內容:`, {
      studentName: reminder.studentName,
      courseName: reminder.courseName,
      courseDate: reminder.courseDate,
      specialEventType: reminder.specialEventType
    });

    // 🔍 獲取管理員 User ID
    const adminUserId = notificationManager.getAdminUserId();
    console.log('👤 管理員 User ID:', adminUserId);
    
    // 判斷是否使用 Flex Message
    const flexMessageEnabled = notificationManager.flexTemplates?.enabled !== false;
    
    let messageResult;
    
    if (flexMessageEnabled) {
      // ✨ 使用 Flex Message 發送
      const variables = {
        courseName: reminder.courseName || '未知課程',
        courseDate: reminder.courseDate || '未知日期',
        courseTime: reminder.courseTime || '未知時間',
        location: reminder.location || '未設定地點',
        description: reminder.description || '',
        lessonPlanUrl: reminder.lessonPlanUrl || '',
        googleMapsUrl: reminder.googleMapsUrl || '',
        weekday: reminder.weekday || '',
        studentName: reminder.studentName || '學生',
        specialEventType: reminder.specialEventType || null  // ✅ 傳遞特殊事件類型
      };

      console.log(`🎨 使用學生 Flex Message 發送測試，特殊事件: ${variables.specialEventType || '無'}`);
      
      const flexMessage = notificationManager.buildFlexMessage(
        'student',  // 學生範本
        variables
      );

      // ✅ 建構 Quick Reply
      const quickReply = notificationManager.buildQuickReply(variables, 'student');
      console.log(`💬 Quick Reply 建構: ${quickReply ? '成功' : '失敗'}`);

      const testMessage = `🧪 [學生提醒測試]\n學生: ${reminder.studentName}\n課程: ${reminder.courseName}\n日期: ${reminder.courseDate}`;
      
      messageResult = await notificationManager.sendLineMessage(
        adminUserId,
        testMessage,
        {
          flexMessage: flexMessage,
          altText: `[測試] ${reminder.studentName} - ${reminder.courseName}`,
          quickReply: quickReply  // ✅ 使用建構的 QuickReply
        }
      );
    } else {
      // 📝 使用文字訊息發送
      const testMessage = `🧪 [學生提醒測試]\n\n${reminder.message}\n\n📝 提醒ID: ${reminderId}\n👤 學生: ${reminder.studentName}\n📚 課程: ${reminder.courseName}\n📅 日期: ${reminder.courseDate} ${reminder.courseTime}`;
      messageResult = await notificationManager.sendLineMessage(adminUserId, testMessage);
    }

    if (messageResult.success) {
      console.log(`✅ 學生提醒測試訊息已發送給管理員`);
      res.json({
        success: true,
        message: '測試訊息已發送給管理員',
        data: {
          reminderId,
          studentName: reminder.studentName,
          flexMessageEnabled,
          sentTo: 'admin',
          adminUserId: adminUserId
        }
      });
    } else {
      console.error(`❌ 學生提醒測試發送失敗:`, messageResult.error);
      res.status(500).json({
        success: false,
        message: '發送失敗: ' + (messageResult.error || '未知錯誤')
      });
    }

  } catch (error) {
    console.error('❌ 學生提醒測試發送錯誤:', error);
    res.status(500).json({
      success: false,
      message: '伺服器錯誤: ' + error.message
    });
  }
});
// Quick Reply 出席回應處理 API
app.post('/api/quick-reply/attendance', async (req, res) => {
  try {
    const { studentName, courseName, courseDate, response, leaveReason } = req.body;
    
    console.log('📝 收到學生出席回覆:', {
      studentName,
      courseName,
      courseDate,
      response,
      leaveReason
    });
    
    // 讀取學生回應記錄
    const studentResponsesPath = path.join(__dirname, 'data', 'student-responses.json');
    let responsesData = { responses: [] };
    
    if (fs.existsSync(studentResponsesPath)) {
      try {
        const data = fs.readFileSync(studentResponsesPath, 'utf8');
        responsesData = JSON.parse(data);
      } catch (error) {
        console.error('❌ 讀取學生回應記錄失敗:', error);
      }
    }
    
    // 新增回應記錄
    const newResponse = {
      id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      studentName,
      courseName,
      courseDate,
      responseType: response, // attend, leave, pending
      leaveReason: leaveReason || null,
      timestamp: new Date().toISOString()
    };
    
    responsesData.responses.push(newResponse);
    
    // 🚀 異步儲存回應記錄（效能優化）
    await safeFile.writeJSON(studentResponsesPath, responsesData);
    
    console.log('✅ 學生回應記錄已儲存（異步 + 鎖）');
    
    // 發送通知給管理員（可選）
    const responseText = response === 'attend' ? '會出席' : 
                        response === 'leave' ? '請假' : 
                        '待確認';
    
    const adminMessage = `📋 學生出席回覆\n\n👤 學生：${studentName}\n📖 課程：${courseName}\n📅 日期：${courseDate}\n✅ 回覆：${responseText}${leaveReason ? `\n📝 原因：${leaveReason}` : ''}`;
    
    try {
      await notificationManager.sendLineMessage(
        notificationManager.getAdminUserId(),
        adminMessage
      );
      console.log('✅ 已通知管理員');
    } catch (error) {
      console.error('⚠️ 通知管理員失敗:', error);
    }
    
    res.json({
      success: true,
      message: '出席回覆已記錄',
      data: newResponse
    });
    
  } catch (error) {
    console.error('❌ 處理出席回覆失敗:', error);
    res.status(500).json({
      success: false,
      message: '處理出席回覆失敗',
      error: error.message
    });
  }
});
// ========================================
// POST /api/student-responses
// 用途：接收外部系統的學生回應資料並發送群組通知
// 請求體：{ studentName, courseName, courseDate, responseType, leaveReason?, userId?, timestamp?, courseTime?, location?, weekday? }
// ========================================
app.post('/api/student-responses', async (req, res) => {
  try {
    const {
      studentName,
      courseName,
      courseDate,
      responseType,
      leaveReason,
      userId,
      timestamp
    } = req.body;
    
    // ✅ 方案 1：初步驗證必填欄位（允許 courseName 為空，稍後從資料庫補充）
    console.log(`📥 [學生回應 API] 收到請求:`, {
      studentName,
      courseName: courseName || '(空)',
      courseDate,
      responseType,
      hasLeaveReason: !!leaveReason
    });
    
    if (!studentName || !courseDate || !responseType) {
      console.error(`❌ [驗證失敗] 缺少必填欄位:`, {
        studentName: !!studentName,
        courseDate: !!courseDate,
        responseType: !!responseType
      });
      return res.status(400).json({
        success: false,
        message: '缺少必填欄位',
        required: ['studentName', 'courseDate', 'responseType'],
        note: 'courseName 可以為空，系統會從資料庫補充'
      });
    }
    
    // 驗證 responseType
    const validTypes = ['attend', 'leave', 'pending'];
    if (!validTypes.includes(responseType)) {
      console.error(`❌ [驗證失敗] 無效的回應類型: ${responseType}`);
      return res.status(400).json({
        success: false,
        message: `無效的回應類型。有效值: ${validTypes.join(', ')}`
      });
    }
    
    // 如果是請假，必須有理由
    if (responseType === 'leave' && !leaveReason) {
      console.error(`❌ [驗證失敗] 請假缺少理由`);
      return res.status(400).json({
        success: false,
        message: '請假回應必須提供理由'
      });
    }
    
    console.log(`✅ [初步驗證] 通過，準備補充缺失欄位...`);
    
    const studentResponsesPath = path.join(__dirname, 'data', 'student-responses.json');
    let responsesData = { responses: [] };
    
    // 讀取現有資料
    if (fs.existsSync(studentResponsesPath)) {
      try {
        const data = fs.readFileSync(studentResponsesPath, 'utf8');
        responsesData = JSON.parse(data);
        if (!responsesData.responses) {
          responsesData.responses = [];
        }
      } catch (error) {
        console.warn('⚠️ 無法讀取現有學生回應，將創建新檔案');
        responsesData = { responses: [] };
      }
    }
    
    // 🔧 補充缺失的欄位（從學生提醒資料庫查詢）
    let enrichedCourseName = courseName;
    let enrichedCourseTime = req.body.courseTime || '';
    let enrichedLocation = req.body.location || '';
    let enrichedWeekday = req.body.weekday || '';
    let enrichedTeacherName = req.body.teacherName || '';
    let matchingReminder = null;
    
    if (!enrichedCourseName || !enrichedCourseTime || !enrichedLocation || !enrichedWeekday) {
      console.log(`🔍 [補充欄位] 檢測到缺失欄位，嘗試從學生提醒資料庫補充...`);
      console.log(`   缺失: courseName=${!enrichedCourseName}, courseTime=${!enrichedCourseTime}, location=${!enrichedLocation}, weekday=${!enrichedWeekday}`);
      
      try {
        // 從 reminders.json 查找匹配的學生提醒
        const remindersDataPath = path.join(__dirname, 'data', 'reminders.json');
        if (fs.existsSync(remindersDataPath)) {
          const remindersData = JSON.parse(fs.readFileSync(remindersDataPath, 'utf8'));
          const studentReminders = remindersData.studentReminders || [];
          
          // 查找匹配的提醒（根據學生姓名和課程日期）
          matchingReminder = studentReminders.find(r => 
            r.studentName === studentName && 
            r.courseDate === courseDate &&
            r.status !== 'expired'  // 排除過期的提醒
          );
          
          if (matchingReminder) {
            console.log(`✅ [補充欄位] 找到匹配的學生提醒: ${matchingReminder.courseName}`);
            
            // 補充缺失的欄位
            if (!enrichedCourseName) {
              enrichedCourseName = matchingReminder.courseName || courseName;
              console.log(`   ✅ 補充 courseName: ${enrichedCourseName}`);
            }
            if (!enrichedCourseTime) {
              enrichedCourseTime = matchingReminder.courseTime || '';
              console.log(`   ✅ 補充 courseTime: ${enrichedCourseTime}`);
            }
            if (!enrichedLocation) {
              enrichedLocation = matchingReminder.location || '';
              console.log(`   ✅ 補充 location: ${enrichedLocation}`);
            }
            if (!enrichedWeekday) {
              enrichedWeekday = matchingReminder.weekday || '';
              console.log(`   ✅ 補充 weekday: ${enrichedWeekday}`);
            }
            if (!enrichedTeacherName) {
              enrichedTeacherName = matchingReminder.teacherName || enrichedTeacherName;
              if (enrichedTeacherName) {
                console.log(`   ✅ 補充 teacherName: ${enrichedTeacherName}`);
              }
            }
          } else {
            console.log(`⚠️ [補充欄位] 找不到匹配的學生提醒，使用預設值`);
            // 至少補充 weekday（可以從日期計算）
            if (!enrichedWeekday && courseDate) {
              enrichedWeekday = getWeekday(courseDate);
              console.log(`   ✅ 從日期計算 weekday: ${enrichedWeekday}`);
            }
          }
        }
      } catch (error) {
        console.error('❌ [補充欄位] 查詢失敗:', error.message);
        // 至少嘗試計算 weekday
        if (!enrichedWeekday && courseDate) {
          try {
            enrichedWeekday = getWeekday(courseDate);
          } catch (e) {
            console.error('❌ 計算 weekday 失敗:', e.message);
          }
        }
      }
    }
    
    // ✅ 方案 2：補充後二次驗證（檢查但不阻斷流程）
    console.log(`🔍 [二次驗證] 檢查補充後的欄位...`);
    
    let dataIncomplete = false;
    const missingFields = [];
    
    if (!enrichedCourseName) {
      console.warn(`⚠️ [資料缺失] courseName 即使補充後仍為空`);
      console.warn(`   學生: ${studentName}, 日期: ${courseDate}`);
      enrichedCourseName = '❓未知課程';  // ✅ 使用預設值，不阻斷流程
      missingFields.push('課程名稱');
      dataIncomplete = true;
    }
    
    if (!enrichedCourseTime) {
      missingFields.push('上課時間');
      dataIncomplete = true;
    }
    
    if (!enrichedLocation) {
      missingFields.push('上課地點');
      dataIncomplete = true;
    }
    
    if (!enrichedWeekday) {
      missingFields.push('星期');
      dataIncomplete = true;
    }
    
    if (!enrichedTeacherName && matchingReminder?.teacherName) {
      enrichedTeacherName = matchingReminder.teacherName;
      console.log(`   ✅ 從提醒補充 teacherName: ${enrichedTeacherName}`);
    }
    
    if (dataIncomplete) {
      console.warn(`⚠️ [資料不完整] 以下欄位缺失: ${missingFields.join(', ')}`);
      console.warn(`   仍會繼續處理並發送通知，但會標註資料缺失警告`);
    }
    
    console.log(`✅ [二次驗證] 完成，補充後的資料:`, {
      studentName,
      courseName: enrichedCourseName,
      courseDate,
      courseTime: enrichedCourseTime || '(未知)',
      location: enrichedLocation || '(未知)',
      weekday: enrichedWeekday || '(未知)',
      responseType,
      dataIncomplete,
      source: req.body.source || 'api',
      missingFields: dataIncomplete ? missingFields : []
    });
    
    // 生成回應 ID
    const responseId = `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 建立回應記錄（使用補充後的欄位）
    const newResponse = {
      id: responseId,
      studentName,
      courseName: enrichedCourseName,
      courseDate,
      responseType,
      timestamp: timestamp || new Date().toISOString(),
      userId: userId || 'unknown',
      courseTime: enrichedCourseTime || null,
      location: enrichedLocation || null,
      weekday: enrichedWeekday || (courseDate ? getWeekday(courseDate) : null),
      teacherName: enrichedTeacherName || (matchingReminder?.teacherName || null),
      reminderId: matchingReminder?.id || null,
      courseUid: matchingReminder?.uid || null,
      specialEventType: matchingReminder?.specialEventType || null,
      dataIncomplete,
      missingFields: dataIncomplete ? missingFields : []
    };
    
    // 如果是請假，加入理由
    if (responseType === 'leave') {
      newResponse.leaveReason = leaveReason;
    }
    
    // 檢查是否已有相同的記錄（防止重複）
    // ✅ 修復：使用 enrichedCourseName 來比對
    // 策略：
    // 1. 如果課程名稱已知（不是"❓未知課程"），嚴格比對 studentName + courseDate + courseName
    // 2. 如果課程名稱未知，寬鬆比對 studentName + courseDate（假設同一天只有一門課）
    const existingIndex = responsesData.responses.findIndex(r => {
      if (r.studentName !== studentName || r.courseDate !== courseDate) {
        return false;
      }
      
      // 如果新回應的課程名稱已知（不是 "❓未知課程"）
      if (enrichedCourseName && enrichedCourseName !== '❓未知課程') {
        return r.courseName === enrichedCourseName;
      }
      
      // 如果新回應的課程名稱未知，則只要學生和日期相同就算重複
      // （假設同一天該學生只有一門課，或者是同一筆記錄的更新）
      return true;
    });
    
    if (existingIndex !== -1) {
      // 更新現有記錄
      console.log(`📝 更新現有回應: ${studentName} - ${enrichedCourseName} - ${courseDate}`);
      responsesData.responses[existingIndex] = newResponse;
    } else {
      // 新增記錄
      console.log(`✅ 新增學生回應: ${studentName} - ${enrichedCourseName} - ${courseDate} - ${responseType}`);
      responsesData.responses.push(newResponse);
    }
    
    // 儲存檔案
    fs.writeFileSync(
      studentResponsesPath,
      JSON.stringify(responsesData, null, 2),
      'utf8'
    );
    
    console.log(`💾 學生回應已儲存 (總數: ${responsesData.responses.length})`);
    
    // 🔔 發送自動通知到群組（批次處理）
    try {
      const leaveNotifConfigPath = path.join(__dirname, 'data', 'leave-notification-config.json');
      if (fs.existsSync(leaveNotifConfigPath)) {
        const notifConfig = JSON.parse(fs.readFileSync(leaveNotifConfigPath, 'utf8'));
        
        // 檢查是否啟用，且符合通知條件
        if (notifConfig.enabled && notifConfig.notifyOn[responseType]) {
          console.log(`🔔 加入批次通知佇列: ${responseType === 'leave' ? '請假' : responseType === 'pending' ? '待確認' : '會出席'} - ${studentName}`);
          
          // 準備變數資料（使用補充後的欄位）
          const now = new Date();
          const replyTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          
          const variables = {
            studentName,
            courseName: enrichedCourseName,      // ✅ 使用補充後的欄位
            courseDate,
            courseTime: enrichedCourseTime,      // ✅ 使用補充後的欄位
            location: enrichedLocation,          // ✅ 使用補充後的欄位
            weekday: enrichedWeekday,            // ✅ 使用補充後的欄位
            leaveReason: leaveReason || '',
            replyTime,
            // ✅ 新增：資料完整性標記
            dataIncomplete,
            missingFields: dataIncomplete ? missingFields.join(', ') : ''
          };
          
          console.log(`📋 [批次通知] 準備通知變數:`, {
            studentName: variables.studentName,
            courseName: variables.courseName,
            courseDate: variables.courseDate,
            responseType: responseType,
            dataIncomplete,
            missingFields: dataIncomplete ? missingFields : []
          });
          
          // 加入批次佇列
          pendingNotifications[responseType].push({ variables });
          
          // 清除現有定時器（如果有）
          if (pendingNotifications.timers[responseType]) {
            clearTimeout(pendingNotifications.timers[responseType]);
          }
          
          // ✅ 使用延遲（15秒）允許合併同批次請求，支援 Carousel
          // 每次新訊息進來會重設定時器，確保批次訊息能合併發送
          // 15秒是平衡點：足夠合併間隔較久的回應，又不會延遲太久
          pendingNotifications.timers[responseType] = setTimeout(() => {
            console.log(`⏰ [批次通知] 定時器觸發 - ${responseType}`);
            sendBatchNotifications(responseType, notificationManager);
          }, 15000);  // 15000ms 延遲，可合併大部分情況
          
          console.log(`📦 [批次通知] 佇列中有 ${pendingNotifications[responseType].length} 個通知，15秒後發送（新訊息會重設定時器）`);
        }
      }
    } catch (notifError) {
        console.error('⚠️ 發送批次通知失敗（但回應已儲存）:', notifError);
        // 通知失敗不影響主流程，繼續返回成功
    }
    
    // 🎯 返回成功回應
    res.json({
      success: true,
      message: '學生回應已儲存',
      responseId: responseId,
      data: {
        studentName,
        courseName: enrichedCourseName,
        courseDate,
        responseType
      }
    });
    
  } catch (error) {
    console.error('❌ 儲存學生回應失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存學生回應失敗',
      error: error.message
    });
  }
});

// 獲取學生回應記錄 API
app.get('/api/student-responses', (req, res) => {
  try {
    const studentResponsesPath = path.join(__dirname, 'data', 'student-responses.json');
    
    if (fs.existsSync(studentResponsesPath)) {
      const data = fs.readFileSync(studentResponsesPath, 'utf8');
      const responsesData = JSON.parse(data);
      
      res.json({
        success: true,
        data: responsesData.responses || []
      });
    } else {
      res.json({
        success: true,
        data: []
      });
    }
  } catch (error) {
    console.error('❌ 獲取學生回應記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取學生回應記錄失敗',
      error: error.message
    });
  }
});

// 家長回應統計摘要 API
app.get('/api/student-responses/summary', async (req, res) => {
  try {
    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
    const normalizeDate = (value, fallback) => {
      if (typeof value !== 'string' || !DATE_REGEX.test(value)) {
        return fallback;
      }
      return value;
    };
    const normalizeKey = (value) => (value || '').toString().trim().toLowerCase();
    const parseListParam = (param, mapper) => {
      if (!param) return null;
      const values = Array.isArray(param) ? param : String(param).split(',');
      const result = values
        .map(v => decodeURIComponent(String(v).trim()))
        .filter(v => v && v.toLowerCase() !== 'all');
      if (result.length === 0) return null;
      if (typeof mapper === 'function') {
        const mapped = result.map(mapper).filter(Boolean);
        return mapped.length ? new Set(mapped) : null;
      }
      return new Set(result.map(v => normalizeKey(v)));
    };
    
    const statusAlias = {
      attend: 'attend',
      leave: 'leave',
      pending: 'pending',
      'no-response': 'noResponse',
      'no_response': 'noResponse',
      'noresponse': 'noResponse',
      'noResponse': 'noResponse'
    };
    
    const statusLabelMap = {
      attend: '✅ 會出席',
      leave: '🏥 請假',
      pending: '⏳ 待確認',
      noResponse: '❔ 未回應'
    };
    
    const todayTaiwan = reminderScheduler.getTaiwanDateString();
    let startDateStr = normalizeDate(req.query.start, todayTaiwan);
    let endDateStr = normalizeDate(req.query.end, startDateStr);
    
    if (!startDateStr) {
      startDateStr = todayTaiwan;
      endDateStr = todayTaiwan;
    } else if (!endDateStr) {
      endDateStr = startDateStr;
    }
    
    const toTaiwanDate = (dateStr) => new Date(`${dateStr}T00:00:00+08:00`);
    let startDate = toTaiwanDate(startDateStr);
    let endDate = toTaiwanDate(endDateStr);
    
    if (endDate < startDate) {
      const tempDate = startDate;
      startDate = endDate;
      endDate = tempDate;
      const tempStr = startDateStr;
      startDateStr = endDateStr;
      endDateStr = tempStr;
    }
    
    const maxRangeDays = 30;
    const diffDays = Math.floor((endDate - startDate) / (24 * 60 * 60 * 1000));
    if (diffDays > maxRangeDays) {
      endDate = new Date(startDate.getTime() + maxRangeDays * 24 * 60 * 60 * 1000);
      endDateStr = endDate.toISOString().split('T')[0];
    }
    
    const statusFilterSet = parseListParam(req.query.status, value => statusAlias[value.toLowerCase()] || null);
    const teacherFilterSet = parseListParam(req.query.teacher);
    const courseFilterSet = parseListParam(req.query.course);
    const studentFilterSet = parseListParam(req.query.student);
    
    const reportsData = safeFile.readJSONSync(DAILY_ATTENDANCE_REPORTS_PATH, { reports: [] }) || { reports: [] };
    const storedReports = Array.isArray(reportsData.reports) ? reportsData.reports : [];
    const reportMap = new Map();
    storedReports.forEach(report => {
      if (report && report.date) {
        reportMap.set(report.date, report);
      }
    });
    
    const teacherSet = new Set();
    const courseSet = new Set();
    const studentSet = new Set();
    
    const stats = {
      totalReminders: 0,
      attend: 0,
      leave: 0,
      pending: 0,
      noResponse: 0
    };
    
    const dailyStatsMap = new Map();
    const details = [];
    const reportPreviews = [];
    const availableDates = [];
    const missingDates = [];
    
    const collectPreview = (report) => {
      if (!report || !report.date) return;
      const summary = report.summary || {};
      const total = Number(summary.total ?? summary.totalReminders ?? 0);
      const leaveCount = Number(summary.leave ?? 0);
      const pendingCount = Number(summary.pending ?? 0);
      const noResponseCount = Number(summary.noResponse ?? summary['no-response'] ?? 0);
      const attendCount = Number(summary.attend ?? Math.max(0, total - leaveCount - pendingCount - noResponseCount));
      const responded = Number(summary.responded ?? (total - noResponseCount));
      const responseRate = Number(summary.responseRate ?? (total > 0 ? responded / total : 0));
      const hasAttention = leaveCount > 0 || pendingCount > 0 || noResponseCount > 0;
      let summaryText = '✅ 所有學生都已確認出席';
      if (total === 0) {
        summaryText = '📭 今日沒有排程課程';
      } else if (hasAttention) {
        const parts = [];
        if (leaveCount > 0) parts.push(`請假 ${leaveCount} 位`);
        if (pendingCount > 0) parts.push(`待確認 ${pendingCount} 位`);
        if (noResponseCount > 0) parts.push(`未回應 ${noResponseCount} 位`);
        summaryText = parts.join('，');
      }
      reportPreviews.push({
        date: report.date,
        total,
        attend: attendCount,
        leave: leaveCount,
        pending: pendingCount,
        noResponse: noResponseCount,
        responded,
        responseRate,
        summaryText,
        hasAttention,
        generatedAt: report.generatedAt || null,
        source: report.meta?.source || report.source || 'scheduler'
      });
    };
    
    // 以台灣時區切分日期範圍，避免 UTC 造成「前一天」偏移
    const datesInRange = [];
    const toTaiwanDateString = (d) => {
      const t = new Date(d.getTime() + 8 * 60 * 60 * 1000); // 轉為 +08:00 視角
      const y = t.getUTCFullYear();
      const m = String(t.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(t.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${dd}`;
    };
    for (let cursor = new Date(startDate); cursor <= endDate; cursor.setDate(cursor.getDate() + 1)) {
      datesInRange.push(toTaiwanDateString(cursor));
    }
    
    for (const dateStr of datesInRange) {
      let report = reportMap.get(dateStr);
      if (!report) {
        // 即時計算缺漏日期（不寫入、不發送）
        try {
          report = await computeDailyAttendanceSummaryForDate(dateStr, { source: 'summary', sendFlex: false, persistCache: false });
          if (report) {
            // 不放回 reportMap（避免視覺上像是快取了），但可參與輸出
            availableDates.push(dateStr);
            collectPreview(report);
          } else {
            missingDates.push(dateStr);
            continue;
          }
        } catch (e) {
          missingDates.push(dateStr);
          continue;
        }
      } else {
        availableDates.push(dateStr);
        collectPreview(report);
      }
      const categories = report.categories || {};
      const records = []
        .concat(Array.isArray(categories.attend) ? categories.attend.map(r => ({ ...r, status: r.status || 'attend' })) : [])
        .concat(Array.isArray(categories.leave) ? categories.leave.map(r => ({ ...r, status: r.status || 'leave' })) : [])
        .concat(Array.isArray(categories.pending) ? categories.pending.map(r => ({ ...r, status: r.status || 'pending' })) : [])
        .concat(Array.isArray(categories.noResponse) ? categories.noResponse.map(r => ({ ...r, status: r.status || 'noResponse' })) : []);
      
      records.forEach(record => {
        const teacherName = (record.teacherName || '').trim();
        if (teacherName) teacherSet.add(teacherName);
        const courseName = (record.courseName || '').trim();
        if (courseName) courseSet.add(courseName);
        const studentName = (record.studentName || '').trim();
        if (studentName) studentSet.add(studentName);
      });
      
      records.forEach(record => {
        const originalStatus = (record.status || '').toString();
        const normalizedStatus = statusAlias[originalStatus.toLowerCase()] || originalStatus;
        if (!['attend', 'leave', 'pending', 'noResponse'].includes(normalizedStatus)) {
          return;
        }
        
        if (statusFilterSet && !statusFilterSet.has(normalizedStatus)) {
          return;
        }
        
        const teacherName = (record.teacherName || '').trim();
        const normalizedTeacher = normalizeKey(teacherName);
        if (teacherFilterSet && !teacherFilterSet.has(normalizedTeacher)) {
          return;
        }
        
        const courseName = (record.courseName || '').trim();
        const normalizedCourse = normalizeKey(courseName);
        if (courseFilterSet && !courseFilterSet.has(normalizedCourse)) {
          return;
        }
        
        const studentName = (record.studentName || '').trim();
        const normalizedStudent = normalizeKey(studentName);
        if (studentFilterSet && !studentFilterSet.has(normalizedStudent)) {
          return;
        }
        
        const detail = {
          ...record,
          status: normalizedStatus,
          statusLabel: record.statusLabel || statusLabelMap[normalizedStatus] || normalizedStatus,
          courseDate: record.courseDate || dateStr,
          reportDate: dateStr,
          generatedAt: report.generatedAt || null,
          source: report.meta?.source || report.source || 'scheduler'
        };
        details.push(detail);
        
        stats.totalReminders += 1;
        stats[normalizedStatus] = (stats[normalizedStatus] || 0) + 1;
        
        if (!dailyStatsMap.has(dateStr)) {
          dailyStatsMap.set(dateStr, {
            date: dateStr,
            total: 0,
            attend: 0,
            leave: 0,
            pending: 0,
            noResponse: 0,
            generatedAt: report.generatedAt || null,
            source: report.meta?.source || report.source || 'scheduler'
          });
        }
        const daily = dailyStatsMap.get(dateStr);
        daily.total += 1;
        daily[normalizedStatus] = (daily[normalizedStatus] || 0) + 1;
      });
      
      const dailyEntry = dailyStatsMap.get(dateStr);
      if (dailyEntry) {
        dailyEntry.responded = dailyEntry.total - dailyEntry.noResponse;
        dailyEntry.responseRate = dailyEntry.total > 0 ? dailyEntry.responded / dailyEntry.total : 0;
      }
    }
    
    details.sort((a, b) => {
      if (a.courseDate !== b.courseDate) {
        return a.courseDate < b.courseDate ? -1 : 1;
      }
      const timeA = (a.courseTime || '').toString();
      const timeB = (b.courseTime || '').toString();
      if (timeA === timeB) {
        return a.studentName.localeCompare(b.studentName, 'zh-TW');
      }
      return timeA.localeCompare(timeB, 'zh-TW');
    });
    
    const dailyStats = Array.from(dailyStatsMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    const respondedTotal = stats.totalReminders - stats.noResponse;
    const responseRate = stats.totalReminders > 0 ? respondedTotal / stats.totalReminders : 0;
    
    const filterOptions = {
      statuses: [
        { value: 'attend', label: statusLabelMap.attend },
        { value: 'leave', label: statusLabelMap.leave },
        { value: 'pending', label: statusLabelMap.pending },
        { value: 'noResponse', label: statusLabelMap.noResponse }
      ],
      teachers: Array.from(teacherSet).sort((a, b) => a.localeCompare(b, 'zh-TW')),
      courses: Array.from(courseSet).sort((a, b) => a.localeCompare(b, 'zh-TW')),
      students: Array.from(studentSet).sort((a, b) => a.localeCompare(b, 'zh-TW'))
    };
    
    res.json({
      success: true,
      data: {
        range: {
          start: startDateStr,
          end: endDateStr,
          days: datesInRange.length
        },
        totals: {
          ...stats,
          responded: respondedTotal,
          responseRate
        },
        daily: dailyStats,
        details,
        filters: filterOptions,
        statusLabels: statusLabelMap,
        reportPreviews: reportPreviews.sort((a, b) => a.date.localeCompare(b.date)),
        generatedAt: new Date().toISOString(),
        meta: {
          availableDates,
          missingDates
        }
      }
    });
  } catch (error) {
    console.error('❌ 產生家長回應統計失敗:', error);
    res.status(500).json({
      success: false,
      message: '無法產生家長回應統計',
      error: error.message
    });
  }
});

app.get('/api/daily-attendance-reports', (req, res) => {
  try {
    const reportsData = safeFile.readJSONSync(DAILY_ATTENDANCE_REPORTS_PATH, { reports: [] }) || { reports: [] };
    res.json({
      success: true,
      data: Array.isArray(reportsData.reports) ? reportsData.reports : [],
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 讀取每日出缺席報告快取失敗:', error);
    res.status(500).json({
      success: false,
      message: '無法讀取每日出缺席報告',
      error: error.message
    });
  }
});

// 手動觸發每日出缺席統計報告 API
app.post('/api/daily-attendance-report/trigger', async (req, res) => {
  try {
    console.log('🔧 [手動觸發] 每日出缺席統計報告');
    
    // 執行統計報告生成
    await generateDailyAttendanceReport({ source: 'manual' });
    
    res.json({
      success: true,
      message: '每日出缺席統計報告已觸發',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 手動觸發每日出缺席統計報告失敗:', error);
    res.status(500).json({
      success: false,
      message: '觸發失敗',
      error: error.message
    });
  }
});

// 19:30 前置健康檢查（確保明日 baseline 存在）
app.post('/api/reminder-scheduler/preflight', async (req, res) => {
  try {
    console.log('🩺 [前置檢查] 19:30 學生提醒 baseline 檢查');
    const taiwanTime = reminderScheduler.getTaiwanTime();
    const tomorrow = new Date(taiwanTime); tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const remindersData = reminderScheduler.loadReminders();
    const existing = (remindersData.studentReminders || []).filter(r => r.courseDate === tomorrowStr);
    let generated = 0;

    // 取行事曆事件 + 臨時學生統計
    let events = [];
    try { events = await reminderScheduler.getCalendarEvents(); } catch(e) { console.error('⚠️ 取得行事曆事件失敗:', e.message); }
    const tomorrowEvents = events.filter(ev => (ev.start||'').startsWith(tomorrowStr));

    let tempStudents = []; let tempActiveTomorrow = 0;
    try {
      const tempPath = path.join(__dirname, 'public', 'temporary_students.json');
      if (fs.existsSync(tempPath)) {
        const tmp = JSON.parse(fs.readFileSync(tempPath,'utf8'));
        tempStudents = Array.isArray(tmp.students) ? tmp.students : [];
        tempActiveTomorrow = tempStudents.filter(s => s && s.scheduledDate === tomorrowStr).length;
      }
    } catch (e) { console.error('⚠️ 讀取臨時學生失敗:', e.message); }

    if (existing.length === 0) {
      console.log('⚠️ 明日 baseline 不存在，開始自動生成');
      const all = await reminderScheduler.generateStudentReminders();
      generated = all.filter(r => r.courseDate === tomorrowStr).length;
    } else {
      console.log(`✅ 明日 baseline 已存在：${existing.length} 筆`);
    }

    const issue = tomorrowEvents.length === 0 ? '⚠️ 明日沒有行事曆事件' : (generated === 0 && existing.length === 0 ? '⚠️ 未能生成 baseline' : null);
    const msgLines = [
      `🩺 前置檢查（${tomorrowStr}）`,
      `📅 明日事件：${tomorrowEvents.length} 筆`,
      `👨‍🎓 臨時學生（排定明日）：${tempActiveTomorrow} 位`,
      `🗂️ baseline：已存在 ${existing.length}／新增 ${generated}`
    ];
    if (issue) msgLines.push(issue);
    try { await notificationManager.sendLineMessage(getStaffGroupId(), msgLines.join('\n')); } catch (e) {}

    res.json({ success: true, date: tomorrowStr, existing: existing.length, generated, tomorrowEvents: tomorrowEvents.length, tempStudentsTomorrow: tempActiveTomorrow });
  } catch (error) {
    console.error('❌ 前置檢查失敗:', error);
    res.status(500).json({ success: false, message: '前置檢查失敗', error: error.message });
  }
});

// 手動觸發清理過期學生回應 API
app.post('/api/student-responses/cleanup', async (req, res) => {
  try {
    console.log('🔧 [手動觸發] 清理過期學生回應');
    
    // 執行清理
    await cleanupOldStudentResponses();
    
    res.json({
      success: true,
      message: '過期學生回應清理已完成',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ 手動觸發清理失敗:', error);
    res.status(500).json({
      success: false,
      message: '清理失敗',
      error: error.message
    });
  }
});

// 匯出 Excel：學生回應（含 Summary/Details，可選 groupBy）
app.get('/api/student-responses/export.xlsx', async (req, res) => {
  try {
    if (!XLSX) return res.status(500).json({ success: false, message: 'xlsx 模組不可用' });

    // 參數解析與正規化（沿用 summary 的規則）
    const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
    const normalizeDate = (v, fb) => (typeof v === 'string' && DATE_REGEX.test(v)) ? v : fb;
    const statusAlias = { attend: 'attend', leave: 'leave', pending: 'pending', 'no-response': 'noResponse', noresponse: 'noResponse', noResponse: 'noResponse' };
    const parseListParam = (p, mapper) => {
      if (!p) return null; const arr = Array.isArray(p) ? p : String(p).split(',');
      const result = arr.map(v => decodeURIComponent(String(v).trim())).filter(Boolean);
      if (!result.length) return null; if (typeof mapper==='function'){ const m = result.map(mapper).filter(Boolean); return m.length? new Set(m): null; }
      return new Set(result.map(v => v.toLowerCase()));
    };

    const todayTW = reminderScheduler.getTaiwanDateString();
    const start = normalizeDate(req.query.start, todayTW);
    const end = normalizeDate(req.query.end, start);
    const statusSet = parseListParam(req.query.status, v => statusAlias[v.toLowerCase()]||null);
    const teacherSet = parseListParam(req.query.teacher);
    const courseSet = parseListParam(req.query.course);
    const studentSet = parseListParam(req.query.student);
    const groupBy = (req.query.groupBy || 'none').toString();

    // 日期範圍
    const days = [];
    let cur = new Date(`${start}T00:00:00+08:00`);
    const endDate = new Date(`${end}T00:00:00+08:00`);
    while (cur <= endDate) { days.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate()+1); }

    const allRecords = [];
    const dailyRows = [];

    for (const d of days) {
      const report = await computeDailyAttendanceSummaryForDate(d, { source:'export', sendFlex:false, persistCache:false });
      const cats = report.categories || {};
      const records = []
        .concat((cats.attend||[]).map(r=>({ ...r, status: 'attend'})))
        .concat((cats.leave||[]).map(r=>({ ...r, status: 'leave'})))
        .concat((cats.pending||[]).map(r=>({ ...r, status: 'pending'})))
        .concat((cats.noResponse||[]).map(r=>({ ...r, status: 'noResponse'})));

      // 過濾
      for (const rec of records) {
        const st = rec.status;
        if (statusSet && !statusSet.has(st)) continue;
        const t = (rec.teacherName||'').trim().toLowerCase();
        if (teacherSet && !teacherSet.has(t)) continue;
        const c = (rec.courseName||'').trim().toLowerCase();
        if (courseSet && !courseSet.has(c)) continue;
        const s = (rec.studentName||'').trim().toLowerCase();
        if (studentSet && !studentSet.has(s)) continue;
        allRecords.push(rec);
      }

      const sum = report.summary || {};
      dailyRows.push({ date: d, total: sum.total||0, attend: sum.attend||0, leave: sum.leave||0, pending: sum.pending||0, noResponse: sum.noResponse||0, responded: (sum.responded ?? ((sum.total||0)-(sum.noResponse||0))), responseRate: sum.responseRate||0 });
    }

    // 構建工作簿
    const wb = XLSX.utils.book_new();
    // Summary sheet（每日彙總 + groupBy 可選）
    const summaryAoA = [['日期','總數','已出席','請假','待確認','未回應','已回覆','回覆率']]
      .concat(dailyRows.map(r => [r.date, r.total, r.attend, r.leave, r.pending, r.noResponse, r.responded, r.responseRate]));

    if (groupBy === 'teacher' || groupBy === 'course') {
      const map = new Map();
      for (const rec of allRecords) {
        const key = groupBy === 'teacher' ? (rec.teacherName||'未指定') : (rec.courseName||'未指定');
        const item = map.get(key) || { total:0, attend:0, leave:0, pending:0, noResponse:0 };
        item.total += 1; item[rec.status] = (item[rec.status]||0)+1; map.set(key, item);
      }
      summaryAoA.push([]); summaryAoA.push([groupBy==='teacher'?'講師彙總':'課程彙總']);
      summaryAoA.push([groupBy==='teacher'?'講師':'課程','總數','已出席','請假','待確認','未回應','已回覆','回覆率']);
      Array.from(map.entries()).sort((a,b)=>a[0].localeCompare(b[0],'zh-TW')).forEach(([k,v])=>{
        const responded = v.total - (v.noResponse||0); const rate = v.total? responded/v.total:0;
        summaryAoA.push([k, v.total, v.attend||0, v.leave||0, v.pending||0, v.noResponse||0, responded, rate]);
      });
    }
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoA);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // Details sheet
    const rows = allRecords.map(r => ({
      date: r.courseDate, weekday: r.weekday||'', student: r.studentName||'', course: r.courseName||'', teacher: r.teacherName||'', courseTime: r.courseTime||'', status: r.status, parent: r.parentName||r.parentContact||'', targetType: r.notificationTargetType||r.targetType||'', targetLabel: r.notificationGroupName||r.groupName||r.parentContact||'', notes: r.leaveReason||r.notes||''
    }));
    const wsDetails = XLSX.utils.json_to_sheet(rows, { header:['date','weekday','student','course','teacher','courseTime','status','parent','targetType','targetLabel','notes'] });
    XLSX.utils.book_append_sheet(wb, wsDetails, 'Details');

    const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
    const filename = `parent-responses-${start}_${end}${groupBy!=='none'?`-${groupBy}`:''}.xlsx`;
    res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);
    return res.send(buf);
  } catch (error) {
    console.error('❌ 匯出 Excel 失敗:', error);
    res.status(500).json({ success:false, message:'匯出失敗', error: error.message });
  }
});

// 輔助函數：取得星期幾
function getWeekday(dateString) {
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const date = new Date(dateString);
  return `星期${weekdays[date.getDay()]}`;
}

// ========================================
// ❌ 已停用：LINE Webhook 直接處理（2025-10-24）
// ========================================
// 原因：改用轉發系統（FLB-LINE-Bot）處理所有 Quick Reply 互動
// 行事曆系統現在只負責接收 API 請求（POST /api/student-responses）
// ========================================
/*
// LINE Webhook 處理（已停用）
app.post('/webhook/line', async (req, res) => {
  const startTime = Date.now();
  
  try {
    // 📡 記錄轉發系統資訊（根據 WEBHOOK串接技術指南）
    const forwardedFrom = req.headers['x-forwarded-from'];
    const forwardTime = req.headers['x-forward-time'];
    const authHeader = req.headers['authorization'];
    
    console.log('📥 收到 Webhook 請求', {
      timestamp: new Date().toISOString(),
      forwardedFrom: forwardedFrom || '(直接)',
      forwardTime: forwardTime || '(未提供)',
      hasAuth: authHeader ? '✓' : '✗',
      ip: req.ip
    });
    
    // 🔒 驗證來源（如果是從轉發系統來的）
    if (forwardedFrom && forwardedFrom !== 'FLB-LINE-Bot') {
      console.error('❌ 來源驗證失敗:', forwardedFrom);
      return res.status(403).json({ error: 'Forbidden', message: '來源驗證失敗' });
    }
    
    // 🔐 驗證 API 密鑰（可選，如果環境變數有設定）
    const expectedApiKey = process.env.WEBHOOK_API_KEY;
    if (expectedApiKey && authHeader !== `Bearer ${expectedApiKey}`) {
      console.error('❌ API 密鑰驗證失敗');
      return res.status(401).json({ error: 'Unauthorized', message: 'API 密鑰驗證失敗' });
    }
    
    const events = req.body.events || [];
    const destination = req.body.destination;
    
    console.log('📥 LINE Webhook 事件:', {
      eventCount: events.length,
      destination: destination || '(未提供)',
      eventTypes: events.map(e => e.type).join(', ')
    });
    
    // 快速回應 200 OK（符合 LINE Webhook 要求）
    res.status(200).json({ success: true });
    
    // 非同步處理事件
    for (const event of events) {
      try {
        console.log('📋 處理事件類型:', event.type);
        
        if (event.type === 'postback') {
          // 處理 Quick Reply 回應
          const postbackData = JSON.parse(event.postback.data || '{}');
          console.log('📝 Postback 資料:', postbackData);
          
          if (postbackData.action === 'attendance_reply') {
            // 學生出席回覆
            const { response, courseName, courseDate, studentName, courseTime, location, weekday } = postbackData;
            
            console.log(`👤 學生回覆 - ${studentName}: ${response} (${courseName} ${courseDate})`);
            
            if (response === 'leave') {
              // 🏥 請假流程：詢問請假理由
              console.log('🏥 請假流程開始，詢問請假理由...');
              
              // 保存等待狀態
              const pendingLeavePath = path.join(__dirname, 'pending-leave-requests.json');
              let pendingData = { pendingLeaves: [] };
              
              if (fs.existsSync(pendingLeavePath)) {
                const data = fs.readFileSync(pendingLeavePath, 'utf8');
                pendingData = JSON.parse(data);
              }
              
              const pendingLeave = {
                userId: event.source.userId,
                studentName,
                courseName,
                courseDate,
                courseTime: courseTime || '未知時間',
                location: location || '未知地點',
                weekday: weekday || '',
                timestamp: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10分鐘過期
              };
              
              pendingData.pendingLeaves.push(pendingLeave);
              fs.writeFileSync(pendingLeavePath, JSON.stringify(pendingData, null, 2));
              
              // 發送請假理由選項
              const leaveMessage = `🏥 ${studentName} - ${courseName}\n${courseDate}\n\n請選擇請假理由：`;
              
              const quickReply = {
                items: [
                  {
                    type: 'action',
                    action: {
                      type: 'postback',
                      label: '🤒 生病',
                      data: JSON.stringify({
                        action: 'leave_reason',
                        reason: '生病',
                        studentName,
                        courseName,
                        courseDate
                      })
                    }
                  },
                  {
                    type: 'action',
                    action: {
                      type: 'postback',
                      label: '👨‍👩‍👧 家庭因素',
                      data: JSON.stringify({
                        action: 'leave_reason',
                        reason: '家庭因素',
                        studentName,
                        courseName,
                        courseDate
                      })
                    }
                  },
                  {
                    type: 'action',
                    action: {
                      type: 'postback',
                      label: '⚠️ 臨時有事',
                      data: JSON.stringify({
                        action: 'leave_reason',
                        reason: '臨時有事',
                        studentName,
                        courseName,
                        courseDate
                      })
                    }
                  },
                  {
                    type: 'action',
                    action: {
                      type: 'postback',
                      label: '📝 其他',
                      data: JSON.stringify({
                        action: 'leave_reason',
                        reason: '其他',
                        studentName,
                        courseName,
                        courseDate
                      })
                    }
                  }
                ]
              };
              
              await notificationManager.sendLineMessage(
                event.source.userId,
                leaveMessage,
                { quickReply }
              );
              
              console.log('✅ 已發送請假理由選項');
              
            } else {
              // ✅ 會出席 或 ⏳ 待確認：直接記錄
              const studentResponsesPath = path.join(__dirname, 'data', 'student-responses.json');
              let responsesData = { responses: [] };
              
              if (fs.existsSync(studentResponsesPath)) {
                const data = fs.readFileSync(studentResponsesPath, 'utf8');
                responsesData = JSON.parse(data);
              }
              
              const newResponse = {
                id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                studentName,
                courseName,
                courseDate,
                responseType: response,
                leaveReason: null,
                timestamp: new Date().toISOString(),
                userId: event.source.userId
              };
              
              responsesData.responses.push(newResponse);
              fs.writeFileSync(studentResponsesPath, JSON.stringify(responsesData, null, 2));
              
              console.log('✅ 學生回應已記錄');
              
              // 發送確認訊息給使用者
              const confirmMessage = response === 'attend' ? 
                `✅ 已記錄：${studentName} 會出席 ${courseName}\n日期：${courseDate}` :
                `⏳ 已記錄：${studentName} 待確認 ${courseName}\n日期：${courseDate}`;
              
              await notificationManager.sendLineMessage(
                event.source.userId,
                confirmMessage
              );
              
              // 🎯 檢查配置並發送通知到群組（待確認）
              if (response === 'pending') {
                console.log('🔍 [待確認通知] 開始處理待確認通知流程');
                const leaveConfigPath = path.join(__dirname, 'data', 'leave-notification-config.json');
                let leaveConfig = {
                  enabled: true,
                  groupId: getStaffGroupId(),
                  notifyOn: { leave: true, pending: true },
                  useFlexMessage: true
                };
                
                if (fs.existsSync(leaveConfigPath)) {
                  try {
                    leaveConfig = JSON.parse(fs.readFileSync(leaveConfigPath, 'utf8'));
                    console.log('🔍 [待確認通知] 讀取配置成功:', leaveConfig);
                  } catch (error) {
                    console.warn('⚠️ 讀取請假通知配置失敗，使用預設配置:', error);
                  }
                } else {
                  console.log('🔍 [待確認通知] 配置文件不存在，使用預設配置');
                }
                
                console.log('🔍 [待確認通知] 配置檢查:', {
                  enabled: leaveConfig.enabled,
                  notifyOnPending: leaveConfig.notifyOn.pending,
                  groupId: leaveConfig.groupId
                });
                
                // 檢查是否需要發送待確認通知
                if (leaveConfig.enabled && leaveConfig.notifyOn.pending && leaveConfig.groupId) {
                  console.log('📤 準備發送待確認通知到群組:', leaveConfig.groupId);
                  
                  const flexVariables = {
                    studentName,
                    courseName,
                    courseDate,
                    weekday: weekday || '',
                    courseTime: courseTime || '未知時間',
                    location: location || '未知地點',
                    replyTime: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
                  };
                  
                  try {
                    if (leaveConfig.useFlexMessage) {
                      // 使用 Flex Message
                      const template = notificationManager.flexTemplates?.templates?.pendingNotification;
                      if (template) {
                        let pendingFlexMessage = notificationManager.replaceFlexVariables(
                          JSON.parse(JSON.stringify(template)), 
                          flexVariables
                        );
                        pendingFlexMessage = notificationManager.cleanFlexMessage(pendingFlexMessage);
                        
                        console.log('🔍 [待確認通知] 準備發送 Flex Message 到群組');
                        const result = await notificationManager.sendLineMessage(
                          leaveConfig.groupId,
                          '',
                          {
                            flexMessage: pendingFlexMessage,
                            altText: `⏳ 待確認通知 - ${studentName} - ${courseName}`
                          }
                        );
                        
                        if (result.success) {
                          console.log('✅ 待確認通知已發送到群組（Flex Message）');
                        } else {
                          console.error('❌ 待確認通知發送失敗:', result.error);
                          throw new Error(result.error);
                        }
                      } else {
                        console.warn('⚠️ 找不到 pendingNotification 範本，使用文字訊息');
                        const staffMessage = `⏳ 學生待確認通知\n\n👤 學生：${studentName}\n📖 課程：${courseName}\n📅 日期：${courseDate} ${weekday || ''}\n⏰ 時間：${courseTime || '未知時間'}\n📍 地點：${location || '未知地點'}\n⏱️ 回覆時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;
                        await notificationManager.sendLineMessage(leaveConfig.groupId, staffMessage);
                        console.log('✅ 待確認通知已發送到群組（文字訊息）');
                      }
                    } else {
                      // 使用文字訊息
                      const staffMessage = `⏳ 學生待確認通知\n\n👤 學生：${studentName}\n📖 課程：${courseName}\n📅 日期：${courseDate} ${weekday || ''}\n⏰ 時間：${courseTime || '未知時間'}\n📍 地點：${location || '未知地點'}\n⏱️ 回覆時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;
                      await notificationManager.sendLineMessage(leaveConfig.groupId, staffMessage);
                      console.log('✅ 待確認通知已發送到群組（文字訊息）');
                    }
                  } catch (notificationError) {
                    console.error('❌ 發送待確認通知到群組時發生錯誤:', notificationError);
                    // 即使群組通知失敗，也不影響主流程
                  }
                } else {
                  console.log('ℹ️ 待確認通知功能已停用或未配置群組 ID');
                }
              }
              
              // 通知管理員（保留原有邏輯）
              const adminMessage = `📋 學生出席回覆\n\n👤 學生：${studentName}\n📖 課程：${courseName}\n📅 日期：${courseDate}\n✅ 回覆：${response === 'attend' ? '會出席' : '待確認'}`;
              
              await notificationManager.sendLineMessage(
                notificationManager.getAdminUserId(),
                adminMessage
              );
              
              console.log('✅ 確認訊息已發送');
            }
          } else if (postbackData.action === 'leave_reason') {
            // 🏥 處理請假理由回覆
            const { reason, studentName, courseName, courseDate } = postbackData;
            
            console.log(`🏥 收到請假理由 - ${studentName}: ${reason}`);
            
            // 從等待列表中找到對應的請假申請
            const pendingLeavePath = path.join(__dirname, 'pending-leave-requests.json');
            let pendingData = { pendingLeaves: [] };
            
            if (fs.existsSync(pendingLeavePath)) {
              const data = fs.readFileSync(pendingLeavePath, 'utf8');
              pendingData = JSON.parse(data);
            }
            
            const leaveIndex = pendingData.pendingLeaves.findIndex(
              l => l.userId === event.source.userId && 
                   l.studentName === studentName && 
                   l.courseName === courseName &&
                   l.courseDate === courseDate
            );
            
            if (leaveIndex !== -1) {
              const leaveInfo = pendingData.pendingLeaves[leaveIndex];
              
              // 記錄到學生回應
              const studentResponsesPath = path.join(__dirname, 'data', 'student-responses.json');
              let responsesData = { responses: [] };
              
              if (fs.existsSync(studentResponsesPath)) {
                const data = fs.readFileSync(studentResponsesPath, 'utf8');
                responsesData = JSON.parse(data);
              }
              
              const newResponse = {
                id: `response_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                studentName,
                courseName,
                courseDate,
                responseType: 'leave',
                leaveReason: reason,
                timestamp: new Date().toISOString(),
                userId: event.source.userId
              };
              
              responsesData.responses.push(newResponse);
              fs.writeFileSync(studentResponsesPath, JSON.stringify(responsesData, null, 2));
              
              // 發送確認訊息給家長
              await notificationManager.sendLineMessage(
                event.source.userId,
                `✅ 已記錄：${studentName} 請假 ${courseName}\n日期：${courseDate}\n理由：${reason}\n\n謝謝您的回覆！`
              );
              
              // 🎯 檢查配置並發送通知到群組
              console.log('🔍 [請假通知] 開始處理請假通知流程');
              const leaveConfigPath = path.join(__dirname, 'leave-notification-config.json');
              let leaveConfig = {
                enabled: true,
                groupId: getStaffGroupId(),
                notifyOn: { leave: true, pending: true },
                useFlexMessage: true
              };
              
              if (fs.existsSync(leaveConfigPath)) {
                try {
                  leaveConfig = JSON.parse(fs.readFileSync(leaveConfigPath, 'utf8'));
                  console.log('🔍 [請假通知] 讀取配置成功:', leaveConfig);
                } catch (error) {
                  console.warn('⚠️ 讀取請假通知配置失敗，使用預設配置:', error);
                }
              } else {
                console.log('🔍 [請假通知] 配置文件不存在，使用預設配置');
              }
              
              console.log('🔍 [請假通知] 配置檢查:', {
                enabled: leaveConfig.enabled,
                notifyOnLeave: leaveConfig.notifyOn.leave,
                groupId: leaveConfig.groupId
              });
              
              // 檢查是否需要發送通知
              if (leaveConfig.enabled && leaveConfig.notifyOn.leave && leaveConfig.groupId) {
                console.log('📤 準備發送請假通知到群組:', leaveConfig.groupId);
                
                const flexVariables = {
                  studentName,
                  courseName,
                  courseDate,
                  weekday: leaveInfo.weekday || '',
                  courseTime: leaveInfo.courseTime || '未知時間',
                  location: leaveInfo.location || '未知地點',
                  leaveReason: reason,
                  replyTime: new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
                };
                
                try {
                  if (leaveConfig.useFlexMessage) {
                    // 使用 Flex Message
                    const template = notificationManager.flexTemplates?.templates?.leaveNotification;
                    if (template) {
                      let leaveFlexMessage = notificationManager.replaceFlexVariables(
                        JSON.parse(JSON.stringify(template)), 
                        flexVariables
                      );
                      leaveFlexMessage = notificationManager.cleanFlexMessage(leaveFlexMessage);
                      
                      console.log('🔍 [請假通知] 準備發送 Flex Message 到群組');
                      const result = await notificationManager.sendLineMessage(
                        leaveConfig.groupId,
                        '',
                        {
                          flexMessage: leaveFlexMessage,
                          altText: `🏥 請假通知 - ${studentName} - ${courseName}`
                        }
                      );
                      
                      if (result.success) {
                        console.log('✅ 請假通知已發送到群組（Flex Message）');
                      } else {
                        console.error('❌ 請假通知發送失敗:', result.error);
                        throw new Error(result.error);
                      }
                    } else {
                      console.warn('⚠️ 找不到 leaveNotification 範本，使用文字訊息');
                      const staffMessage = `🏥 學生請假通知\n\n👤 學生：${studentName}\n📖 課程：${courseName}\n📅 日期：${courseDate} ${leaveInfo.weekday}\n⏰ 時間：${leaveInfo.courseTime}\n📍 地點：${leaveInfo.location}\n🏥 理由：${reason}\n⏱️ 回覆時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;
                      await notificationManager.sendLineMessage(leaveConfig.groupId, staffMessage);
                      console.log('✅ 請假通知已發送到群組（文字訊息）');
                    }
                  } else {
                    // 使用文字訊息
                    const staffMessage = `🏥 學生請假通知\n\n👤 學生：${studentName}\n📖 課程：${courseName}\n📅 日期：${courseDate} ${leaveInfo.weekday}\n⏰ 時間：${leaveInfo.courseTime}\n📍 地點：${leaveInfo.location}\n🏥 理由：${reason}\n⏱️ 回覆時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`;
                    await notificationManager.sendLineMessage(leaveConfig.groupId, staffMessage);
                    console.log('✅ 請假通知已發送到群組（文字訊息）');
                  }
                } catch (notificationError) {
                  console.error('❌ 發送請假通知到群組時發生錯誤:', notificationError);
                  // 即使群組通知失敗，也不影響主流程
                }
              } else {
                console.log('ℹ️ 請假通知功能已停用或未配置群組 ID');
              }
              
              // 移除已處理的等待項目
              pendingData.pendingLeaves.splice(leaveIndex, 1);
              fs.writeFileSync(pendingLeavePath, JSON.stringify(pendingData, null, 2));
              
              console.log('✅ 請假處理完成');
            } else {
              console.log('⚠️ 找不到對應的等待請假申請');
              await notificationManager.sendLineMessage(
                event.source.userId,
                '抱歉，找不到對應的請假申請，請重新操作。'
              );
            }
          }
        } else if (event.type === 'message' && event.message.type === 'text') {
          // 處理文字訊息（可能是請假原因的補充）
          // 這裡可以實作更複雜的對話邏輯
          console.log('💬 收到文字訊息:', event.message.text);
        }
        
      } catch (eventError) {
        console.error('❌ 處理單個事件失敗:', eventError);
      }
    }
    
    // 記錄處理完成
    const processingTime = Date.now() - startTime;
    console.log(`✅ Webhook 處理完成 (${processingTime}ms)`);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('❌ Webhook 處理失敗:', {
      error: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`
    });
    // 即使錯誤也要回應 200，避免 LINE/轉發系統重送
    if (!res.headersSent) {
      res.status(200).json({ success: true, error: 'Processing failed but acknowledged' });
    }
  }
});
*/
// ========================================
// 更新提醒API（支援一般提醒和學生提醒）
app.put('/api/reminders/:id', (req, res) => {
  try {
    const reminderId = req.params.id;
    const updates = req.body;
    console.log('📝 收到更新提醒請求:', reminderId, updates);
    
    const remindersData = loadReminders();
    
    // 先在一般提醒中尋找
    let reminderIndex = remindersData.reminders.findIndex(r => r.id === reminderId);
    let isStudentReminder = false;
    
    // 如果沒找到，在學生提醒中尋找
    if (reminderIndex === -1) {
      reminderIndex = remindersData.studentReminders.findIndex(r => r.id === reminderId);
      isStudentReminder = true;
      console.log('🔍 在學生提醒中找到:', reminderIndex !== -1);
    } else {
      console.log('🔍 在一般提醒中找到:', reminderIndex !== -1);
    }
    
    if (reminderIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的提醒'
      });
    }
    
    // 更新提醒資料
    if (isStudentReminder) {
      remindersData.studentReminders[reminderIndex] = {
        ...remindersData.studentReminders[reminderIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      console.log('✅ 學生提醒更新成功');
    } else {
      remindersData.reminders[reminderIndex] = {
        ...remindersData.reminders[reminderIndex],
        ...updates,
        updatedAt: new Date().toISOString()
      };
      console.log('✅ 一般提醒更新成功');
    }
    
    if (saveReminders(remindersData)) {
      const updatedReminder = isStudentReminder ? 
        remindersData.studentReminders[reminderIndex] : 
        remindersData.reminders[reminderIndex];
        
      res.json({
        success: true,
        message: '提醒更新成功',
        data: updatedReminder
      });
    } else {
      throw new Error('儲存提醒資料失敗');
    }
    
  } catch (error) {
    console.error('❌ 更新提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新提醒失敗',
      error: error.message
    });
  }
});
// 刪除提醒API（支援一般提醒和學生提醒）
app.delete('/api/reminders/:id', (req, res) => {
  try {
    const reminderId = req.params.id;
    console.log('🗑️ 收到刪除提醒請求:', reminderId);
    
    const remindersData = loadReminders();
    
    // ⭐ 修復：先在一般提醒中尋找
    let reminderIndex = remindersData.reminders.findIndex(r => r.id === reminderId);
    let isStudentReminder = false;
    let deletedReminder;
    
    // 如果沒找到，在學生提醒中尋找
    if (reminderIndex === -1) {
      reminderIndex = remindersData.studentReminders?.findIndex(r => r.id === reminderId) ?? -1;
      isStudentReminder = true;
      console.log('🔍 在學生提醒中尋找:', reminderIndex !== -1 ? '找到' : '未找到');
    } else {
      console.log('🔍 在一般提醒中找到');
    }
    
    if (reminderIndex === -1) {
      console.log('❌ 找不到指定的提醒:', reminderId);
      return res.status(404).json({
        success: false,
        message: '找不到指定的提醒'
      });
    }
    
    // 從對應的陣列中刪除
    if (isStudentReminder) {
      deletedReminder = remindersData.studentReminders.splice(reminderIndex, 1)[0];
      console.log('🗑️ 已刪除學生提醒:', {
        id: deletedReminder.id,
        studentName: deletedReminder.studentName,
        courseName: deletedReminder.courseName,
        status: deletedReminder.status
      });
    } else {
      deletedReminder = remindersData.reminders.splice(reminderIndex, 1)[0];
      console.log('🗑️ 已刪除提醒:', {
        id: deletedReminder.id,
        teacherName: deletedReminder.teacherName,
        courseName: deletedReminder.courseName,
        status: deletedReminder.status
      });
    }
    
    if (saveReminders(remindersData)) {
      console.log('✅ 提醒刪除成功，已儲存到資料庫');
      res.json({
        success: true,
        message: isStudentReminder ? '學生提醒刪除成功' : '提醒刪除成功',
        data: deletedReminder
      });
    } else {
      console.log('❌ 儲存資料庫失敗');
      throw new Error('儲存提醒資料失敗');
    }
    
  } catch (error) {
    console.error('❌ 刪除提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '刪除提醒失敗',
      error: error.message
    });
  }
});

// 排程器控制API
app.post('/api/reminder-scheduler/start', (req, res) => {
  try {
    console.log('🚀 收到啟動排程器請求');
    reminderScheduler.start();
    console.log('✅ 提醒排程器已啟動');
    res.json({
      success: true,
      message: '提醒排程器已啟動'
    });
  } catch (error) {
    console.error('❌ 啟動排程器失敗:', error);
    res.status(500).json({
      success: false,
      message: '啟動排程器失敗',
      error: error.message
    });
  }
});

app.post('/api/reminder-scheduler/stop', (req, res) => {
  try {
    reminderScheduler.stop();
    res.json({
      success: true,
      message: '提醒排程器已停止'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '停止排程器失敗',
      error: error.message
    });
  }
});

app.get('/api/reminder-scheduler/status', (req, res) => {
  try {
    const status = reminderScheduler.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '獲取排程器狀態失敗',
      error: error.message
    });
  }
});

// 獲取學生資料API（合併正常學生和臨時學生）
app.get('/api/students', (req, res) => {
  try {
    console.log('👨‍🎓 獲取學生資料...');

    // 🔧 前端尚未完整支援 304，忽略條件式請求避免返回空內容
    if (req.headers['if-none-match']) {
      delete req.headers['if-none-match'];
    }
    if (req.headers['if-modified-since']) {
      delete req.headers['if-modified-since'];
    }

    // 先檢查快取是否有效（5 分鐘）
    const nowTs = Date.now();
    const maxAgeMs = 5 * 60 * 1000;
    if (studentsCache.data && (nowTs - studentsCache.lastUpdate) < maxAgeMs) {
      res.set('ETag', studentsCache.etag || 'W/"students-cache"');
      res.set('Cache-Control', 'no-store');
      return res.json(studentsCache.data);
    }
    
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    
    let regularStudents = [];
    
    if (fs.existsSync(studentDataPath)) {
      const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
      regularStudents = studentData.students || [];
      console.log('✅ 成功讀取正常學生資料，數量:', regularStudents.length);
    } else {
      console.log('⚠️ 學生資料檔案不存在，僅返回臨時學生');
    }
    
    // 讀取臨時學生
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    let tempStudents = [];
    
    if (fs.existsSync(tempDataPath)) {
      const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
      const now = new Date();
      
      // 過濾掉過期的臨時學生
      tempStudents = tempData.students.filter(s => {
        const expiry = new Date(s.expiryDate + 'T23:59:59');
        return expiry >= now;
      });
      
      console.log('✅ 成功讀取臨時學生資料，數量:', tempStudents.length);
    }
    
    // 合併學生列表
    const allStudents = [...regularStudents, ...tempStudents];

    // 產生簡單 ETag（基於來源檔案 mtime 與數量）
    let m1 = 0, m2 = 0;
    try { if (fs.existsSync(studentDataPath)) m1 = fs.statSync(studentDataPath).mtimeMs || 0; } catch (e) {}
    try { if (fs.existsSync(tempDataPath)) m2 = fs.statSync(tempDataPath).mtimeMs || 0; } catch (e) {}
    const etag = `W/"${m1}-${m2}-${allStudents.length}"`;

    const payload = {
      success: true,
      students: allStudents,
      count: allStudents.length,
      regularCount: regularStudents.length,
      temporaryCount: tempStudents.length
    };

    // 更新快取
    studentsCache = { data: payload, etag, lastUpdate: nowTs };

    res.set('ETag', etag);
    res.set('Cache-Control', 'no-store');
    res.json(payload);
  } catch (error) {
    console.error('❌ 讀取學生資料失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取學生資料失敗',
      students: []  // ← 也改為 students 保持一致
    });
  }
});

// ==================== 臨時學生管理 API ====================

// 0. 獲取 Google Sheets 家長資料（用於體驗課學生選擇家長）
app.get('/api/parent-users', async (req, res) => {
  try {
    const force = req.query.force === '1' || req.query.force === 'true';
    const data = await fetchParentUserSheetData(force);
    res.json({
      success: true,
      data: data.parents,
      fetchedAt: new Date(data.fetchedAt).toISOString()
    });
  } catch (error) {
    console.error('❌ 獲取家長資料失敗:', error.message || error);
    res.status(500).json({
      success: false,
      message: '獲取家長資料失敗',
      error: error.message || String(error)
    });
  }
});

// 0.1 手動建立臨時學生備份（供前端操作）
app.post('/api/temporary-students/backup', async (req, res) => {
  try {
    const result = await backupTemporaryStudents('manual-api');
    if (!result) {
      return res.status(500).json({
        success: false,
        message: '建立備份失敗'
      });
    }
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('❌ 手動建立臨時學生備份失敗:', error);
    res.status(500).json({
      success: false,
      message: '建立備份失敗',
      error: error.message
    });
  }
});

// 0.2 取得臨時學生備份清單
app.get('/api/temporary-students/backups', async (req, res) => {
  try {
    const backupsDir = path.join(__dirname, 'backups', 'temporary-students');
    let files = [];
    try {
      files = await fs.promises.readdir(backupsDir);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return res.json({ success: true, data: [] });
      }
      throw err;
    }

    const jsonFiles = files.filter(f => f.endsWith('.json')).sort().reverse();
    const items = [];

    for (const fileName of jsonFiles) {
      const fullPath = path.join(backupsDir, fileName);
      try {
        const stat = await fs.promises.stat(fullPath);
        let count = null;
        try {
          const raw = await fs.promises.readFile(fullPath, 'utf8');
          const parsed = JSON.parse(raw);
          const students = Array.isArray(parsed.students) ? parsed.students : [];
          count = students.length;
        } catch (parseErr) {
          console.warn('⚠️ 解析臨時學生備份檔失敗，略過筆數:', fileName, parseErr.message);
        }

        items.push({
          fileName,
          createdAt: stat.mtime.toISOString(),
          count
        });
      } catch (statErr) {
        console.warn('⚠️ 讀取臨時學生備份檔資訊失敗，略過:', fileName, statErr.message);
      }
    }

    res.json({
      success: true,
      data: items
    });
  } catch (error) {
    console.error('❌ 取得臨時學生備份清單失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得備份清單失敗',
      error: error.message
    });
  }
});

// 0.3 從指定備份檔還原臨時學生列表
app.post('/api/temporary-students/restore', async (req, res) => {
  try {
    const { fileName } = req.body || {};
    if (!fileName || typeof fileName !== 'string') {
      return res.status(400).json({
        success: false,
        message: '缺少備份檔名 fileName'
      });
    }

    const backupsDir = path.join(__dirname, 'backups', 'temporary-students');
    const backupPath = path.join(backupsDir, fileName);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的備份檔'
      });
    }

    // 還原前先備份目前 active 狀態
    await backupTemporaryStudents('before-restore');

    const raw = await fs.promises.readFile(backupPath, 'utf8');
    const parsed = JSON.parse(raw);
    const students = Array.isArray(parsed.students) ? parsed.students : [];

    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    await safeFile.writeJSON(tempDataPath, { students });

    console.log('✅ [臨時學生還原] 已從備份還原:', {
      backupPath,
      count: students.length
    });

    res.json({
      success: true,
      data: {
        fileName,
        count: students.length
      }
    });
  } catch (error) {
    console.error('❌ 從備份還原臨時學生失敗:', error);
    res.status(500).json({
      success: false,
      message: '從備份還原失敗',
      error: error.message
    });
  }
});

// 1. 獲取臨時學生列表
app.get('/api/temporary-students', (req, res) => {
  try {
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    
    if (!fs.existsSync(tempDataPath)) {
      fs.writeFileSync(tempDataPath, JSON.stringify({ students: [] }, null, 2));
    }
    
    const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
    
    // 🔥 檢查 students 陣列是否存在
    if (!tempData || !Array.isArray(tempData.students)) {
      console.error('❌ temporary_students.json 格式錯誤: students 陣列不存在');
      return res.status(500).json({
        success: false,
        error: 'temporary_students.json 格式錯誤'
      });
    }
    
    // 🔥 自動過濾過期的臨時學生（修復版）
    const now = new Date();
    const validStudents = tempData.students.filter(s => {
      // 🎯 使用 expiryDate 或 scheduledDate 作為過期日期（備援機制）
      const expirySource = s.expiryDate || s.scheduledDate;
      
      // 🎯 如果沒有過期日期，保留該學生（向後相容舊資料）
      if (!expirySource) {
        console.log(`⚠️ 臨時學生 ${s.name} 沒有過期日期，保留該學生`);
        return true;
      }
      
      // 🎯 解析過期日期（設為當天 23:59:59）
      const expiry = new Date(expirySource + 'T23:59:59');
      
      // 🎯 檢查日期是否有效
      if (isNaN(expiry.getTime())) {
        console.warn(`⚠️ 臨時學生 ${s.name} 的過期日期無效 (${expirySource})，保留該學生`);
        return true;
      }
      
      // 🎯 比較過期日期與當前時間
      const isValid = expiry >= now;
      if (!isValid) {
        console.log(`🗑️ 過濾過期臨時學生: ${s.name} (過期日期: ${expirySource})`);
      }
      return isValid;
    });
    
    res.json({ success: true, data: validStudents });
  } catch (error) {
    console.error('❌ 獲取臨時學生失敗:', error);
    res.status(500).json({ success: false, message: '獲取臨時學生失敗', error: error.message });
  }
});

app.get('/api/temporary-students/archive', async (req, res) => {
  try {
    const { type, course, dateFrom, dateTo, name, search, limit } = req.query || {};
    const archiveData = await safeFile.readJSON(TEMP_STUDENTS_ARCHIVE_PATH, { students: [] }) || { students: [] };
    const students = Array.isArray(archiveData.students) ? archiveData.students : [];
    const normalizedType = type ? type.trim().toLowerCase() : '';
    const zhTypeQuery = type ? type.trim() : '';
    const normalizedCourse = course ? course.trim() : '';
    const nameQuery = (name || search || '').trim().toLowerCase();
    const hasDateFrom = Boolean(dateFrom);
    const hasDateTo = Boolean(dateTo);
    const limitNumber = Math.min(Math.max(parseInt(limit, 10) || 500, 1), 5000);
    
    let filtered = students;
    
    if (normalizedType || zhTypeQuery) {
      filtered = filtered.filter(student => {
        const studentType = student.type === 'makeup' ? 'makeup' : 'trial';
        const zhType = student.type === 'makeup' ? '補課' : '體驗';
        return (normalizedType && studentType === normalizedType) || (zhTypeQuery && zhType === zhTypeQuery);
      });
    }
    
    if (normalizedCourse) {
      filtered = filtered.filter(student => (student.course || '').trim() === normalizedCourse);
    }
    
    if (hasDateFrom) {
      filtered = filtered.filter(student => {
        const date = (student.scheduledDate || '').slice(0, 10);
        return date >= dateFrom;
      });
    }
    
    if (hasDateTo) {
      filtered = filtered.filter(student => {
        const date = (student.scheduledDate || '').slice(0, 10);
        return date <= dateTo;
      });
    }
    
    if (nameQuery) {
      filtered = filtered.filter(student => {
        const nameValue = (student.name || '').toLowerCase();
        const courseValue = (student.course || '').toLowerCase();
        return nameValue.includes(nameQuery) || courseValue.includes(nameQuery);
      });
    }
    
    const limitedData = filtered.slice(0, limitNumber);
    
    res.json({
      success: true,
      data: limitedData,
      total: filtered.length
    });
  } catch (error) {
    console.error('❌ 獲取臨時學生歷史紀錄失敗:', error);
    res.status(500).json({ success: false, message: '獲取臨時學生歷史紀錄失敗', error: error.message });
  }
});
// 2. 新增臨時學生
// 🔥 清理 Flex Message：移除空白 text 欄位
function cleanFlexMessage(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  
  if (Array.isArray(obj)) {
    // 過濾掉包含空 text 的項目
    return obj
      .map(item => cleanFlexMessage(item))
      .filter(item => {
        // 如果是 text 類型且 text 為空，則移除
        if (item && item.type === 'text' && (!item.text || item.text.trim() === '')) {
          return false;
        }
        // 如果是 box 且沒有內容，則移除
        if (item && item.type === 'box' && item.contents && item.contents.length === 0) {
          return false;
        }
        return true;
      });
  }
  
  const cleaned = {};
  for (const key in obj) {
    if (key === 'text' && typeof obj[key] === 'string' && obj[key].trim() === '') {
      // 如果 text 為空字串，設為 "無"
      cleaned[key] = '無';
    } else if (key === 'contents' && Array.isArray(obj[key])) {
      const cleanedContents = cleanFlexMessage(obj[key]);
      // 只有當清理後還有內容時才保留
      if (cleanedContents.length > 0) {
        cleaned[key] = cleanedContents;
      }
    } else {
      cleaned[key] = cleanFlexMessage(obj[key]);
    }
  }
  
  return cleaned;
}

app.post('/api/temporary-students', async (req, res) => {
  try {
    console.log('🔍 收到新增臨時學生請求，原始數據:', req.body);
    const { name, type, course, scheduledDate, scheduledTime, location, detailedAddress, notificationNote, originalStudent, originalPeriod, originalCourse, userId, skipNotification } = req.body;
    
    // 驗證必要欄位
    if (!name || !type || !course || !scheduledDate || !scheduledTime) {
      console.error('❌ 缺少必要欄位:', { name, type, course, scheduledDate, scheduledTime });
      return res.status(400).json({ success: false, message: '缺少必要欄位' });
    }
    
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    
    if (!fs.existsSync(tempDataPath)) {
      fs.writeFileSync(tempDataPath, JSON.stringify({ students: [] }, null, 2));
    }
    
    const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
    
    // 解析時段
    const periodParsed = parsePeriodString(scheduledTime);
    
    // 🔥 計算 remaining 和 userId：
    // - 補課學生：從 student_data.json 查找原學生的 remaining 和 userId
    // - 體驗學生：remaining 設為 1，userId 從請求中獲取
    let remaining = 1; // 預設為體驗學生
    let studentUserId = userId || ''; // 從請求中獲取userId
    
    if (type === 'makeup') {
      try {
        const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
        if (fs.existsSync(studentDataPath)) {
          const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
          if (!studentData || !Array.isArray(studentData.students)) {
              console.error('❌ student_data.json 格式錯誤: students 陣列不存在');
              return res.status(500).json({ success: false, error: 'student_data.json 格式錯誤' });
          }
          const originalStudentData = studentData.students.find(s => s.name === name);
          if (originalStudentData) {
            remaining = originalStudentData.remaining || 0;
            studentUserId = originalStudentData.userId || '';
            console.log(`📊 補課學生 ${name} - 剩餘堂數: ${remaining}, userId: ${studentUserId}`);
          } else {
            console.warn(`⚠️ 找不到原學生 ${name}，使用預設值 (remaining = 0, userId = '')`);
            remaining = 0;
          }
        }
      } catch (error) {
        console.warn(`⚠️ 讀取學生資料失敗，使用預設值:`, error.message);
        remaining = 0;
      }
    } else if (type === 'trial') {
      console.log(`🆕 體驗課學生 ${name} - userId: ${studentUserId || '(未提供)'}`);
    }
    
    const newStudent = {
      id: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      type,
      course,
      scheduledDate,
      scheduledTime,
      period: scheduledTime,
      periodParsed,
      originalStudent: originalStudent || name,
      originalCourse: originalCourse || course,
      originalPeriod: originalPeriod || '',
      remaining,  // 🔥 使用計算後的 remaining
      userId: studentUserId,  // 🔥 補課學生自動獲取，體驗課學生手動輸入
      location: location || '樂程坊',  // 🔥 地點
      detailedAddress: detailedAddress || '',  // 🔥 具體地址（新增）
      notificationNote: notificationNote || '',  // 🔥 通知備註（顯示在LINE訊息中）
      expiryDate: scheduledDate,
      attendance: [],
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    };
    
    tempData.students.push(newStudent);
    await safeFile.writeJSON(tempDataPath, tempData);
    
    console.log('✅ 新增臨時學生成功（異步 + 鎖）:', {
      name: newStudent.name,
      type: newStudent.type,
      remaining: newStudent.remaining,
      userId: newStudent.userId || '(無)',
      period: newStudent.period,
      scheduledDate: newStudent.scheduledDate
    });
    
    // 🔥 自動發送通知（如果有 userId 且未要求跳過）
    let notificationSent = false;
    console.log(`🔍 檢查是否發送通知: userId=${newStudent.userId}, skipNotification=${skipNotification}`);
    
    if (newStudent.userId && !skipNotification) {
      try {
        console.log(`📤 嘗試自動發送${type === 'makeup' ? '補課' : '體驗'}通知給 ${newStudent.name}...`);
        console.log(`📤 userId: ${newStudent.userId}`);
        
        // 載入 Flex Message 範本
        const flexTemplates = notificationManager.flexTemplates;
        console.log(`🔍 flexTemplates 存在:`, !!flexTemplates);
        console.log(`🔍 flexTemplates.templates 存在:`, !!flexTemplates?.templates);
        
        if (flexTemplates && flexTemplates.templates) {
          const templateName = type === 'makeup' ? 'makeupSuccess' : 'trialSuccess';
          console.log(`🔍 尋找範本: ${templateName}`);
          
          let template = flexTemplates.templates[templateName];
          console.log(`🔍 範本找到:`, !!template);
          
          if (template) {
            // 深拷貝範本
            template = JSON.parse(JSON.stringify(template));
            
            // 解析日期和星期
            const dateObj = new Date(newStudent.scheduledDate);
            const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
            const weekday = weekdays[dateObj.getDay()];
            
            // 🔥 組裝完整地點資訊
            let locationDisplay = (newStudent.location && newStudent.location.trim() !== '') ? newStudent.location : '樂程坊';
            if (newStudent.detailedAddress && newStudent.detailedAddress.trim() !== '') {
              locationDisplay = `${locationDisplay} | ${newStudent.detailedAddress}`;
            }
            
            // 🔥 組裝 Google Maps URL
            let googleMapsUrl = '';
            if (newStudent.detailedAddress && newStudent.detailedAddress.trim() !== '') {
              const encodedAddress = encodeURIComponent(newStudent.detailedAddress);
              googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
            }
            
            // 🔥 準備替換變數（使用新欄位）
            const variables = {
              '{studentName}': newStudent.name || '學生',
              '{courseName}': newStudent.course || '課程',
              '{courseDate}': newStudent.scheduledDate || '',
              '{weekday}': weekday || '',
              '{courseTime}': (newStudent.scheduledTime && newStudent.scheduledTime.trim() !== '') ? newStudent.scheduledTime : '時段未指定',
              '{originalPeriod}': (newStudent.originalPeriod && newStudent.originalPeriod.trim() !== '') ? newStudent.originalPeriod : '無',
              '{teacherName}': '樂程坊講師',
              '{location}': locationDisplay,
              '{googleMapsUrl}': googleMapsUrl,
              '{note}': (newStudent.notificationNote && newStudent.notificationNote.trim() !== '') ? newStudent.notificationNote : '無'
            };
            
            console.log(`🔍 替換變數:`, variables);
            
            // 替換範本變數
            let templateString = JSON.stringify(template);
            Object.keys(variables).forEach(key => {
              templateString = templateString.replace(new RegExp(key.replace(/[{()}]/g, '\\$&'), 'g'), variables[key]);
            });
            template = JSON.parse(templateString);
            
            // 🔥 若無具體地址，則移除導航按鈕（footer）
            if (!googleMapsUrl) {
              delete template.footer;
            }
            
            // 🔥 清理 Flex Message：移除空白 text 欄位
            template = cleanFlexMessage(template);
            
            console.log(`🔍 範本替換完成，準備發送...`);
            
            // 發送 LINE 訊息
            const typeLabel = type === 'makeup' ? '補課設定成功' : '體驗課程建立成功';
            const sendResult = await notificationManager.sendLineMessage(
              newStudent.userId,
              typeLabel,
              {
                flexMessage: template,
                altText: `${typeLabel} - ${newStudent.name} ${newStudent.course}`
              }
            );
            
            console.log(`🔍 發送結果:`, sendResult);
            
            if (sendResult.success) {
              notificationSent = true;
              console.log(`✅ ${typeLabel}通知已自動發送給 ${newStudent.name}`);
            } else {
              console.error(`⚠️ 自動發送通知失敗:`, sendResult.error);
            }
          } else {
            console.error(`❌ 找不到範本: ${templateName}`);
          }
        } else {
          console.error(`❌ flexTemplates 或 flexTemplates.templates 不存在`);
        }
      } catch (notifError) {
        console.error('❌ 自動發送通知時發生錯誤:', notifError);
        console.error('❌ 錯誤堆疊:', notifError.stack);
      }
    } else if (!newStudent.userId) {
      console.log('ℹ️ 學生無 User ID，跳過自動發送通知');
    } else if (skipNotification) {
      console.log('ℹ️ 用戶選擇跳過通知');
    }
    
    res.json({ 
      success: true, 
      data: newStudent, 
      message: '新增成功',
      notificationSent
    });
  } catch (error) {
    console.error('❌ 新增臨時學生失敗:', error);
    res.status(500).json({ success: false, message: '新增臨時學生失敗', error: error.message });
  }
});

// 3. 更新臨時學生
app.put('/api/temporary-students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, course, scheduledDate, scheduledTime, location, detailedAddress, notificationNote, userId } = req.body;
    
    console.log('🔄 收到更新臨時學生請求:', { id, ...req.body });
    
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    
    if (!fs.existsSync(tempDataPath)) {
      return res.status(404).json({ success: false, message: '臨時學生資料檔案不存在' });
    }
    
    const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
    const index = tempData.students.findIndex(s => s.id === id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, message: '找不到該學生' });
    }
    
    const student = tempData.students[index];
    
    // 更新欄位（保留原有的 type, id, createdAt 等）
    if (name) student.name = name;
    if (course) student.course = course;
    if (scheduledDate) {
      student.scheduledDate = scheduledDate;
      student.expiryDate = scheduledDate;  // 同步更新過期日期
    }
    if (scheduledTime) {
      student.scheduledTime = scheduledTime;
      student.period = scheduledTime;
      student.periodParsed = parsePeriodString(scheduledTime);
    }
    if (location !== undefined) student.location = location;  // 🔥 更新地點
    if (detailedAddress !== undefined) student.detailedAddress = detailedAddress;  // 🔥 更新具體地址
    if (notificationNote !== undefined) student.notificationNote = notificationNote;  // 🔥 更新通知備註
    if (userId !== undefined) student.userId = userId;
    
    // 🔥 如果是補課學生且沒有 userId，嘗試從 student_data.json 獲取
    if (student.type === 'makeup' && !student.userId && name) {
      try {
        const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
        if (fs.existsSync(studentDataPath)) {
          const studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
          if (!studentData || !Array.isArray(studentData.students)) {
              console.error('❌ student_data.json 格式錯誤: students 陣列不存在');
              return res.status(500).json({ success: false, error: 'student_data.json 格式錯誤' });
          }
          const originalStudentData = studentData.students.find(s => s.name === name);
          if (originalStudentData && originalStudentData.userId) {
            student.userId = originalStudentData.userId;
            console.log(`🔄 補課學生自動更新 userId: ${name} → ${student.userId}`);
          }
        }
      } catch (error) {
        console.warn('⚠️ 自動獲取 userId 失敗:', error.message);
      }
    }
    
    tempData.students[index] = student;
    await safeFile.writeJSON(tempDataPath, tempData);
    
    console.log('✅ 更新臨時學生成功（異步 + 鎖）:', student.name);
    
    res.json({ success: true, data: student, message: '更新成功' });
  } catch (error) {
    console.error('❌ 更新臨時學生失敗:', error);
    res.status(500).json({ success: false, message: '更新臨時學生失敗', error: error.message });
  }
});

// 4. 刪除臨時學生
app.delete('/api/temporary-students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    
    if (!fs.existsSync(tempDataPath)) {
      return res.status(404).json({ success: false, message: '臨時學生資料檔案不存在' });
    }
    
    const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
    const index = tempData.students.findIndex(s => s.id === id);
    
    if (index === -1) {
      return res.status(404).json({ success: false, message: '找不到該學生' });
    }
    
    const deletedStudent = tempData.students[index];
    tempData.students.splice(index, 1);
    await safeFile.writeJSON(tempDataPath, tempData);
    
    console.log('✅ 刪除臨時學生（異步 + 鎖）:', deletedStudent.name);
    
    res.json({ success: true, message: '刪除成功' });
  } catch (error) {
    console.error('❌ 刪除臨時學生失敗:', error);
    res.status(500).json({ success: false, message: '刪除臨時學生失敗', error: error.message });
  }
});

// 5. 發送補課/體驗通知給家長
app.post('/api/send-temporary-student-notification', async (req, res) => {
  try {
    const { studentId, type } = req.body;
    
    console.log('📤 收到發送臨時學生通知請求:', { studentId, type });
    
    // 驗證參數
    if (!studentId || !type) {
      return res.status(400).json({ success: false, message: '缺少必要參數 (studentId, type)' });
    }
    
    // 讀取臨時學生資料
    const tempDataPath = path.join(__dirname, 'public', 'temporary_students.json');
    if (!fs.existsSync(tempDataPath)) {
      return res.status(404).json({ success: false, message: '臨時學生資料檔案不存在' });
    }
    
    const tempData = JSON.parse(fs.readFileSync(tempDataPath, 'utf8'));
    const student = tempData.students.find(s => s.id === studentId);
    
    if (!student) {
      return res.status(404).json({ success: false, message: '找不到該學生' });
    }
    
    // 檢查是否有 userId
    if (!student.userId) {
      return res.status(400).json({ success: false, message: '該學生沒有 User ID，無法發送通知' });
    }
    
    // 載入 Flex Message 範本
    const flexTemplates = notificationManager.flexTemplates;
    if (!flexTemplates || !flexTemplates.templates) {
      return res.status(500).json({ success: false, message: 'Flex Message 範本載入失敗' });
    }
    
    // 根據類型選擇範本
    const templateName = type === 'makeup' ? 'makeupSuccess' : 'trialSuccess';
    let template = flexTemplates.templates[templateName];
    
    if (!template) {
      return res.status(500).json({ success: false, message: `找不到 ${templateName} 範本` });
    }
    
    // 深拷貝範本
    template = JSON.parse(JSON.stringify(template));
    
    // 解析日期和星期
    const dateObj = new Date(student.scheduledDate);
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    const weekday = weekdays[dateObj.getDay()];
    
    // 🔥 組裝地點顯示文字
    let locationDisplay = (student.location && student.location.trim() !== '') ? student.location : '樂程坊';
    if (student.detailedAddress && student.detailedAddress.trim() !== '') {
      locationDisplay = `${locationDisplay} | ${student.detailedAddress}`;
    }
    
    // 🔥 組裝 Google Maps 導航 URL
    let googleMapsUrl = '';
    if (student.detailedAddress && student.detailedAddress.trim() !== '') {
      const encodedAddress = encodeURIComponent(student.detailedAddress);
      googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    }
    
    // 🔥 準備替換變數（與自動發送保持一致）
    const variables = {
      '{studentName}': student.name || '學生',
      '{courseName}': student.course || '課程',
      '{courseDate}': student.scheduledDate || '',
      '{weekday}': weekday || '',
      '{courseTime}': (student.scheduledTime && student.scheduledTime.trim() !== '') ? student.scheduledTime : '時段未指定',
      '{originalPeriod}': (student.originalPeriod && student.originalPeriod.trim() !== '') ? student.originalPeriod : '無',
      '{teacherName}': '樂程坊講師',
      '{location}': locationDisplay,  // 🔥 修改：完整地點顯示
      '{note}': (student.notificationNote && student.notificationNote.trim() !== '') ? student.notificationNote : '無',
      '{googleMapsUrl}': googleMapsUrl  // 🔥 新增：Google Maps 導航 URL
    };
    
    console.log(`🔍 [手動發送] 替換變數:`, variables);
    
    // 替換範本變數
    let templateString = JSON.stringify(template);
    Object.keys(variables).forEach(key => {
      templateString = templateString.replace(new RegExp(key.replace(/[{()}]/g, '\\$&'), 'g'), variables[key]);
    });
    template = JSON.parse(templateString);
    
    // 🔥 清理 Flex Message：移除空白 text 欄位
    template = cleanFlexMessage(template);
    
    // 🔥 新增：若無具體地址，則移除導航按鈕（footer）
    if (!googleMapsUrl) {
      delete template.footer;
    }
    
    console.log(`🔍 [手動發送] 範本替換完成，準備發送...`);
    
    // 發送 LINE 訊息
    const typeLabel = type === 'makeup' ? '補課設定成功' : '體驗課程建立成功';
    const sendResult = await notificationManager.sendLineMessage(
      student.userId,
      typeLabel,
      {
        flexMessage: template,
        altText: `${typeLabel} - ${student.name} ${student.course}`
      }
    );
    
    if (sendResult.success) {
      console.log(`✅ ${typeLabel}通知已發送給 ${student.name} (${student.userId})`);
      res.json({ 
        success: true, 
        message: '通知發送成功',
        data: {
          studentName: student.name,
          userId: student.userId,
          type: typeLabel
        }
      });
    } else {
      console.error(`❌ ${typeLabel}通知發送失敗:`, sendResult.error);
      res.status(500).json({ 
        success: false, 
        message: `通知發送失敗: ${sendResult.error}` 
      });
    }
    
  } catch (error) {
    console.error('❌ 發送臨時學生通知失敗:', error);
    res.status(500).json({ 
      success: false, 
      message: '發送通知失敗', 
      error: error.message 
    });
  }
});

// 獲取學生提醒API
app.get('/api/student-reminders', (req, res) => {
  try {
    console.log('📋 收到獲取學生提醒請求');
    const remindersData = loadReminders();
    const studentReminders = remindersData.studentReminders || [];
    
    // 按創建時間排序（最新的在前）
    studentReminders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    console.log(`📊 返回 ${studentReminders.length} 個學生提醒`);
    res.json({
      success: true,
      data: studentReminders
    });
  } catch (error) {
    console.error('❌ 獲取學生提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取學生提醒失敗',
      error: error.message
    });
  }
});

// 儲存學生提醒API
app.post('/api/student-reminders', (req, res) => {
  try {
    console.log('💾 收到儲存學生提醒請求');
    const { studentReminders } = req.body;
    
    if (!studentReminders || !Array.isArray(studentReminders)) {
      return res.status(400).json({
        success: false,
        message: '無效的學生提醒資料'
      });
    }
    
    const remindersData = loadReminders();
    remindersData.studentReminders = studentReminders;
    
    if (saveReminders(remindersData)) {
      console.log(`✅ 成功儲存 ${studentReminders.length} 個學生提醒`);
      res.json({
        success: true,
        message: '學生提醒儲存成功',
        count: studentReminders.length
      });
    } else {
      throw new Error('儲存學生提醒失敗');
    }
    
  } catch (error) {
    console.error('❌ 儲存學生提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存學生提醒失敗',
      error: error.message
    });
  }
});

// 發送學生提醒API
app.post('/api/student-reminders/:id/send', async (req, res) => {
  try {
    const { id } = req.params;
    const { message, parentUserId } = req.body;
    
    console.log('📤 發送學生提醒:', { id, parentUserId });
    
    if (!parentUserId || parentUserId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '找不到家長的LINE User ID'
      });
    }
    
    if (!message || message.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '提醒訊息不能為空'
      });
    }
    
    // 發送 LINE 通知給家長
    console.log('📤 開始發送LINE通知給家長...');
    console.log('🎯 目標家長LINE User ID:', parentUserId);
    console.log('📝 發送訊息長度:', message.length, '字元');
    
    // ✅ 檢查是否啟用 Flex Message 並準備學生提醒的 Flex Message
    let lineMessage;
    let sendOptions = {};
    
    if (notificationManager.flexTemplates.enabled) {
      console.log('🎨 使用 Flex Message 發送學生提醒');
      
      // 從 reminders.json 中獲取完整的提醒資訊
      const remindersData = loadReminders();
      const studentReminder = remindersData.studentReminders.find(r => r.id === id);
      
      if (studentReminder) {
        // 準備變數 - 學生提醒範本需要的變數
        const variables = {
          studentName: studentReminder.studentName || '學生',
          teacherName: studentReminder.teacherName || '講師',
          courseName: studentReminder.courseName || '未知課程',
          courseDate: studentReminder.courseDate || '未知日期',
          weekday: studentReminder.weekday || getWeekday(studentReminder.courseDate),
          courseTime: studentReminder.courseTime || '未知時間',
          location: studentReminder.location || '未指定地點',
          googleMapsUrl: studentReminder.googleMapsUrl || 'https://maps.google.com',
          // ✅ 新增：傳遞特殊事件類型（用於選擇學生特殊範本）
          specialEventType: studentReminder.specialEventType || null
        };
        
        // 建構 Flex Message
        const flexMessage = notificationManager.buildFlexMessage('student', variables);
        
        if (flexMessage) {
          sendOptions.flexMessage = flexMessage;
          sendOptions.altText = `課程提醒 - ${variables.courseName}`;
          
          // 檢查是否啟用 Quick Reply
          const quickReply = notificationManager.buildQuickReply(variables, 'student');
          if (quickReply) {
            sendOptions.quickReply = quickReply;
          }
          
          console.log('✅ 已建構學生提醒 Flex Message');
        } else {
          console.log('⚠️ Flex Message 建構失敗，使用文字訊息');
        }
      }
    }
    
    // 使用 NotificationManager 發送訊息
    const result = await notificationManager.sendLineMessage(parentUserId, message, sendOptions);
    
    if (!result.success) {
      throw new Error(result.error || '發送失敗');
    }
    
    console.log('📊 訊息發送成功');
    
    // 更新學生提醒狀態
    console.log('💾 更新學生提醒狀態為 sent...');
    const remindersData = loadReminders();
    const studentReminderIndex = remindersData.studentReminders.findIndex(r => r.id === id);
    
    if (studentReminderIndex !== -1) {
      remindersData.studentReminders[studentReminderIndex].status = 'sent';
      remindersData.studentReminders[studentReminderIndex].sentAt = new Date().toISOString();
      remindersData.studentReminders[studentReminderIndex].updatedAt = new Date().toISOString();
      saveReminders(remindersData);
      console.log('✅ 學生提醒狀態更新完成');
    }
    
    console.log('✅ 學生提醒發送成功:', parentUserId);
    res.json({
      success: true,
      message: '學生提醒發送成功',
      flexMessageUsed: !!sendOptions.flexMessage,
      messageType: sendOptions.flexMessage ? 'flex' : 'text',
      result: result
    });
    
  } catch (error) {
    console.error('❌ 發送學生提醒失敗:', error);
    
    // 更新提醒狀態為失敗
    try {
      const remindersData = loadReminders();
      const studentReminderIndex = remindersData.studentReminders.findIndex(r => r.id === req.params.id);
      
      if (studentReminderIndex !== -1) {
        remindersData.studentReminders[studentReminderIndex].status = 'failed';
        remindersData.studentReminders[studentReminderIndex].updatedAt = new Date().toISOString();
        saveReminders(remindersData);
      }
    } catch (updateError) {
      console.error('❌ 更新提醒狀態失敗:', updateError);
    }
    
    res.status(500).json({
      success: false,
      message: '發送學生提醒失敗',
      error: error.message
    });
  }
});

// 批次發送學生提醒 API（支援 carousel）
app.post('/api/student-reminders/batch-send', async (req, res) => {
  try {
    const { reminderIds, parentUserId } = req.body;
    
    if (!reminderIds || !Array.isArray(reminderIds) || reminderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '請提供有效的提醒 ID 陣列'
      });
    }
    
    if (!parentUserId) {
      return res.status(400).json({
        success: false,
        message: '請提供家長 User ID'
      });
    }
    
    console.log(`📦 批次發送 ${reminderIds.length} 個學生提醒給家長 ${parentUserId}`);
    
    // 載入所有學生提醒
    const remindersData = loadReminders();
    const reminders = reminderIds.map(id => 
      remindersData.studentReminders.find(r => r.id === id)
    ).filter(r => r !== undefined);
    
    if (reminders.length === 0) {
      return res.status(404).json({
        success: false,
        message: '找不到任何學生提醒'
      });
    }
    
    console.log(`✅ 找到 ${reminders.length} 個學生提醒`);
    
    // 準備變數陣列 - 學生提醒範本需要的變數
    const variablesArray = reminders.map(reminder => {
      // 🔥 組裝完整地點資訊（地點簡稱 | 具體地址）
      let locationDisplay = reminder.location || '樂程坊';
      if (reminder.detailedAddress && reminder.detailedAddress.trim() !== '') {
        locationDisplay = `${locationDisplay} | ${reminder.detailedAddress}`;
      }
      
      return {
        studentName: reminder.studentName || '學生',
        teacherName: reminder.teacherName || '講師',
        courseName: reminder.courseName || '未知課程',
        courseDate: reminder.courseDate || '未知日期',
        weekday: reminder.weekday || getWeekday(reminder.courseDate),
        courseTime: reminder.courseTime || '未知時間',
        location: locationDisplay,  // 🔥 完整地點資訊
        detailedAddress: reminder.detailedAddress || '',  // 🔥 具體地址
        googleMapsUrl: reminder.googleMapsUrl || '',  // 🔥 空字串表示無導航
        // ✅ 新增：傳遞特殊事件類型（用於選擇學生特殊範本）
        specialEventType: reminder.specialEventType || null
      };
    });
    
    // 準備訊息
    let message = '';
    let sendOptions = {};
    let isCarousel = false;
    
    // ⚠️ 移除 enabled 檢查，總是嘗試建構 Flex Message
    try {
      if (reminders.length > 1) {
        // 多個學生提醒（一個家長多個孩子），使用 carousel
        console.log(`🎠 建構學生提醒 Carousel（${reminders.length} 個孩子）`);
        const carousel = notificationManager.buildCarousel(variablesArray, 'student');
        if (carousel) {
          sendOptions.flexMessage = carousel;
          sendOptions.altText = `課程提醒 - ${reminders.length} 個孩子的課程`;
          isCarousel = true;
          console.log('✅ Carousel 建構成功');
        } else {
          console.log('⚠️ Carousel 建構失敗，將使用文字訊息');
        }
      } else {
        // 單個學生提醒
        console.log('🎨 建構單一學生提醒 Flex Message');
        const flexMessage = notificationManager.buildFlexMessage('student', variablesArray[0]);
        if (flexMessage) {
          sendOptions.flexMessage = flexMessage;
          sendOptions.altText = `課程提醒 - ${variablesArray[0].studentName} - ${variablesArray[0].courseName}`;
          console.log('✅ Flex Message 建構成功');
        } else {
          console.log('⚠️ Flex Message 建構失敗，將使用文字訊息');
        }
      }
      
      // 添加 Quick Reply（支援單個和多個孩子）
      if (reminders.length === 1) {
        // 單個孩子：使用標準 Quick Reply（具體課程資訊）
        const quickReply = notificationManager.buildQuickReply(variablesArray[0], 'student');
        if (quickReply) {
          sendOptions.quickReply = quickReply;
          console.log('✅ 已添加 Quick Reply（單個學生）');
        }
      } else if (reminders.length > 1) {
        // 多個孩子：使用統一 Quick Reply（簡化版）
        const quickReply = notificationManager.buildMultiStudentQuickReply(variablesArray, 'student');
        if (quickReply) {
          sendOptions.quickReply = quickReply;
          console.log(`✅ 已添加 Quick Reply（${reminders.length} 個學生統一按鈕）`);
        }
      }
    } catch (error) {
      console.error('❌ 建構學生提醒 Flex Message 失敗:', error);
      console.log('⚠️ 降級使用文字訊息');
    }
    
    // 如果沒有 Flex Message，使用文字訊息
    if (!sendOptions.flexMessage) {
      console.log('📝 使用文字訊息');
      message = reminders.map(reminder => {
        return `📚 課程提醒\n\n👨‍🎓 學生：${reminder.studentName}\n👨‍🏫 講師：${reminder.teacherName}\n📖 課程：${reminder.courseName}\n⏰ 時間：${reminder.courseTime}\n📅 日期：${reminder.courseDate}\n📍 地點：${reminder.location || '未設定地點'}\n\n提醒您要上課喔！謝謝`;
      }).join('\n\n---\n\n');
    }
    
    // 發送訊息
    const result = await notificationManager.sendLineMessage(parentUserId, message, sendOptions);
    
    if (!result.success) {
      throw new Error(result.error || '發送失敗');
    }
    
    console.log('📊 學生提醒批次發送成功');
    
    // 更新提醒狀態
    for (const reminder of reminders) {
      const index = remindersData.studentReminders.findIndex(r => r.id === reminder.id);
      if (index !== -1) {
        remindersData.studentReminders[index].status = 'sent';
        remindersData.studentReminders[index].sentAt = new Date().toISOString();
      }
    }
    saveReminders(remindersData);
    
    res.json({
      success: true,
      message: '學生提醒批次發送成功',
      count: reminders.length,
      flexMessageUsed: !!sendOptions.flexMessage,
      messageType: sendOptions.flexMessage ? 'flex' : 'text',
      isCarousel: isCarousel
    });
    
  } catch (error) {
    console.error('❌ 學生提醒批次發送失敗:', error);
    res.status(500).json({
      success: false,
      message: '學生提醒批次發送失敗',
      error: error.message
    });
  }
});
// 獲取學生提醒設定API
app.get('/api/student-reminder-settings', (req, res) => {
  try {
    console.log('⏰ 獲取學生提醒設定...');
    let settings = reminderScheduler.getStudentReminderSettings();
    
    // ✅ 如果設定為 null 或未定義，提供預設值
    if (!settings) {
      console.log('⚠️ 學生提醒設定為 null，使用預設值');
      settings = {
        enabled: true,
        hour: 19,
        minute: 30,
        duration: 5
      };
    }
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('❌ 獲取學生提醒設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取學生提醒設定失敗',
      error: error.message
    });
  }
});

// 重置今日提醒狀態API
app.post('/api/reminders/reset-today', (req, res) => {
  try {
    console.log('🔄 手動重置今日提醒狀態...');
    
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    
    // 使用台灣時區 (UTC+8)
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000; // UTC+8 毫秒
    const taiwanTime = new Date(now.getTime() + taiwanOffset);
    const today = taiwanTime.toISOString().split('T')[0];
    
    let resetCount = 0;
    
    // 重置所有今日提醒為 pending（只重置未發送的）
    reminders.forEach(reminder => {
      if (reminder.courseDate === today) {
        // 只重置未發送過且未完成的提醒
        if (reminder.status !== 'sent' && reminder.status !== 'completed' && !reminder.sentAt) {
          reminder.status = 'pending';
          resetCount++;
          console.log(`🔄 重置提醒: ${reminder.courseName} - ${reminder.teacherName}`);
        } else {
          console.log(`⏭️ 提醒已發送/完成，跳過: ${reminder.courseName} - ${reminder.teacherName} (狀態: ${reminder.status})`);
        }
      }
    });
    
    // 保存更新
    saveReminders(remindersData);
    
    console.log(`✅ 已重置 ${resetCount} 個今日提醒`);
    
    res.json({
      success: true,
      message: `已重置 ${resetCount} 個今日提醒狀態`,
      resetCount: resetCount
    });
    
  } catch (error) {
    console.error('❌ 重置今日提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '重置今日提醒失敗',
      error: error.message
    });
  }
});
// 重置課前提醒狀態API
app.post('/api/reminders/reset-before-class', (req, res) => {
  try {
    console.log('🔄 手動重置課前提醒狀態...');
    
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    
    // 使用台灣時區 (UTC+8)
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000; // UTC+8 毫秒
    const taiwanTime = new Date(now.getTime() + taiwanOffset);
    const today = taiwanTime.toISOString().split('T')[0];
    
    let resetCount = 0;
    
    // 重置課前提醒為 pending（簡化邏輯：只重置未發送過的）
    reminders.forEach(reminder => {
      if (reminder.courseDate === today && reminder.type === 'before-class') {
        // 計算課程時間
        const courseTime = new Date(`${reminder.courseDate}T${reminder.courseTime}:00`);
        
        // 如果課程還沒開始
        if (courseTime > now) {
          // 簡化邏輯：只重置未發送過且未完成的課前提醒
          if (reminder.status !== 'sent' && reminder.status !== 'completed' && !reminder.sentAt) {
            reminder.status = 'pending';
            resetCount++;
            console.log(`🔄 重置課前提醒: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
          } else {
            console.log(`⏭️ 課前提醒已發送/完成，跳過: ${reminder.courseName} - ${reminder.teacherName} (狀態: ${reminder.status})`);
          }
        } else {
          console.log(`⏰ 課程已開始，跳過: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
        }
      }
    });
    
    // 保存更新
    saveReminders(remindersData);
    
    console.log(`✅ 已重置 ${resetCount} 個課前提醒`);
    
    res.json({
      success: true,
      message: `已重置 ${resetCount} 個課前提醒狀態`,
      resetCount: resetCount
    });
    
  } catch (error) {
    console.error('❌ 重置課前提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '重置課前提醒失敗',
      error: error.message
    });
  }
});

// 按行事曆重置提醒API
app.post('/api/reminders/reset-by-calendar', (req, res) => {
  try {
    const { instructor, reminderType } = req.body;
    
    if (!instructor) {
      return res.status(400).json({
        success: false,
        message: '請提供講師名稱'
      });
    }
    
    console.log(`🔄 手動重置 ${instructor} 的提醒...`);
    
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    
    let resetCount = 0;
    
    reminders.forEach(reminder => {
      const shouldReset = reminder.teacherName === instructor && 
                         (!reminderType || reminder.type === reminderType) &&
                         reminder.status !== 'sent' && 
                         reminder.status !== 'completed' &&
                         !reminder.sentAt;
      
      if (shouldReset) {
        reminder.status = 'pending';
        reminder.sentAt = null;
        resetCount++;
        console.log(`🔄 重置提醒: ${reminder.courseName} - ${reminder.teacherName} (${reminder.type})`);
      }
    });
    
    // 保存更新
    saveReminders(remindersData);
    
    const typeText = reminderType ? `${reminderType}提醒` : '所有提醒';
    console.log(`✅ 已重置 ${instructor} 的 ${resetCount} 個${typeText}`);
    
    res.json({
      success: true,
      message: `成功重置 ${instructor} 的 ${resetCount} 個${typeText}`,
      resetCount,
      instructor,
      reminderType
    });
    
  } catch (error) {
    console.error('❌ 按行事曆重置提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '按行事曆重置提醒失敗',
      error: error.message
    });
  }
});

// 按行事曆重置課前提醒API
app.post('/api/reminders/reset-before-class-by-calendar', (req, res) => {
  try {
    const { instructor } = req.body;
    
    if (!instructor) {
      return res.status(400).json({
        success: false,
        message: '請提供講師名稱'
      });
    }
    
    console.log(`🔄 手動重置 ${instructor} 的課前提醒...`);
    
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    
    // 使用台灣時區 (UTC+8)
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000; // UTC+8 毫秒
    const taiwanTime = new Date(now.getTime() + taiwanOffset);
    const today = taiwanTime.toISOString().split('T')[0];
    
    let resetCount = 0;
    
    // 重置指定講師的課前提醒為 pending
    reminders.forEach(reminder => {
      if (reminder.courseDate === today && 
          reminder.type === 'before-class' && 
          reminder.teacherName === instructor) {
        
        // 計算課程時間
        const courseTime = new Date(`${reminder.courseDate}T${reminder.courseTime}:00`);
        
        // 如果課程還沒開始
        if (courseTime > now) {
          // 只重置未發送過且未完成的課前提醒
          if (reminder.status !== 'sent' && reminder.status !== 'completed' && !reminder.sentAt) {
            reminder.status = 'pending';
            reminder.sentAt = null;
            resetCount++;
            console.log(`🔄 重置課前提醒: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
          } else {
            console.log(`⏭️ 課前提醒已發送/完成，跳過: ${reminder.courseName} - ${reminder.teacherName} (狀態: ${reminder.status})`);
          }
        } else {
          console.log(`⏰ 課程已開始，跳過: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
        }
      }
    });
    
    // 保存更新
    saveReminders(remindersData);
    
    console.log(`✅ 已重置 ${instructor} 的 ${resetCount} 個課前提醒`);
    
    res.json({
      success: true,
      message: `成功重置 ${instructor} 的 ${resetCount} 個課前提醒`,
      resetCount,
      instructor
    });
    
  } catch (error) {
    console.error('❌ 按行事曆重置課前提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '按行事曆重置課前提醒失敗',
      error: error.message
    });
  }
});

// 個別重置課前提醒API
app.post('/api/reminders/reset-before-class-individual', (req, res) => {
  try {
    const { reminderId } = req.body;
    
    if (!reminderId) {
      return res.status(400).json({
        success: false,
        message: '請提供提醒ID'
      });
    }
    
    console.log(`🔄 手動重置個別課前提醒: ${reminderId}`);
    
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    
    // 找到指定的提醒
    const reminder = reminders.find(r => r.id === reminderId);
    
    if (!reminder) {
      return res.status(404).json({
        success: false,
        message: '找不到指定的提醒'
      });
    }
    
    // 檢查是否為課前提醒
    if (reminder.type !== 'before-class') {
      return res.status(400).json({
        success: false,
        message: '只能重置課前提醒'
      });
    }
    
    // 使用台灣時區 (UTC+8)
    const now = new Date();
    const taiwanOffset = 8 * 60 * 60 * 1000; // UTC+8 毫秒
    const taiwanTime = new Date(now.getTime() + taiwanOffset);
    const today = taiwanTime.toISOString().split('T')[0];
    
    // 檢查是否為今天的提醒
    if (reminder.courseDate !== today) {
      return res.status(400).json({
        success: false,
        message: '只能重置今天的課前提醒'
      });
    }
    
    // 計算課程時間
    const courseTime = new Date(`${reminder.courseDate}T${reminder.courseTime}:00`);
    
    // 檢查課程是否還沒開始
    if (courseTime <= now) {
      return res.status(400).json({
        success: false,
        message: '課程已開始，無法重置'
      });
    }
    
    // 檢查提醒是否已發送或已完成（防止重複發送）
    if ((reminder.status === 'sent' || reminder.status === 'completed') && reminder.sentAt) {
      return res.status(400).json({
        success: false,
        message: '此提醒已發送/完成，無法重置',
        status: reminder.status,
        sentAt: reminder.sentAt
      });
    }
    
    // 重置提醒狀態
    reminder.status = 'pending';
    reminder.sentAt = null;
    
    // 保存更新
    saveReminders(remindersData);
    
    console.log(`✅ 已重置個別課前提醒: ${reminder.courseName} - ${reminder.teacherName} (課程時間: ${courseTime.toISOString()})`);
    
    res.json({
      success: true,
      message: `成功重置課前提醒: ${reminder.courseName}`,
      reminder: {
        id: reminder.id,
        courseName: reminder.courseName,
        teacherName: reminder.teacherName,
        courseTime: reminder.courseTime,
        status: reminder.status
      }
    });
    
  } catch (error) {
    console.error('❌ 個別重置課前提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '個別重置課前提醒失敗',
      error: error.message
    });
  }
});

// 清理重複提醒
app.post('/api/reminders/cleanup', (req, res) => {
  try {
    console.log('🧹 手動清理重複提醒...');
    reminderScheduler.cleanupExpiredReminders();
    
    res.json({
      success: true,
      message: '重複提醒清理完成'
    });
  } catch (error) {
    console.error('清理重複提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '清理重複提醒失敗'
    });
  }
});

// 設定學生提醒API
app.post('/api/student-reminder-settings', (req, res) => {
  try {
    const { hour, minute, duration, enabled } = req.body;
    console.log('⏰ 設定學生提醒:', { hour, minute, duration, enabled });
    
    // 驗證輸入
    if (hour !== undefined && (hour < 0 || hour > 23)) {
      return res.status(400).json({
        success: false,
        message: '小時必須在 0-23 之間'
      });
    }
    
    if (minute !== undefined && (minute < 0 || minute > 59)) {
      return res.status(400).json({
        success: false,
        message: '分鐘必須在 0-59 之間'
      });
    }
    
    if (duration !== undefined && (duration < 1 || duration > 60)) {
      return res.status(400).json({
        success: false,
        message: '執行窗口必須在 1-60 分鐘之間'
      });
    }
    
    // 更新設定
    const newSettings = {};
    if (hour !== undefined) newSettings.hour = parseInt(hour);
    if (minute !== undefined) newSettings.minute = parseInt(minute);
    if (duration !== undefined) newSettings.duration = parseInt(duration);
    if (enabled !== undefined) newSettings.enabled = Boolean(enabled);
    
    reminderScheduler.setStudentReminderSettings(newSettings);
    
    res.json({
      success: true,
      message: '學生提醒設定已更新',
      data: reminderScheduler.getStudentReminderSettings()
    });
  } catch (error) {
    console.error('❌ 設定學生提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '設定學生提醒失敗',
      error: error.message
    });
  }
});

// 獲取排程設定API
app.get('/api/schedule-settings', async (req, res) => {
  try {
    console.log('⏰ 獲取排程設定...');
    const settings = reminderScheduler.getSystemSettings();
    
    // 獲取跳過課程統計
    let skippedCourses = [];
    try {
      const events = await reminderScheduler.getCalendarEvents();
      const skipKeywords = settings.skipKeywords?.keywords || ['停課', '請假'];
      const skipEnabled = settings.skipKeywords?.enabled !== false;
      
      if (skipEnabled && skipKeywords.length > 0) {
        skippedCourses = events.filter(event => {
          return skipKeywords.some(keyword => event.title.includes(keyword));
        }).map(event => ({
          title: event.title,
          instructor: event.instructor,
          start: event.start,
          matchedKeywords: skipKeywords.filter(keyword => event.title.includes(keyword))
        }));
      }
    } catch (error) {
      console.log('⚠️ 獲取跳過課程統計失敗:', error.message);
    }
    
    // 安全地獲取提醒設定，提供預設值
    const reminders = settings.reminders || {
      todayReminderHour: 8,
      todayReminderMinute: 0,
      tomorrowReminderHour: 19,
      tomorrowReminderMinute: 30,
      beforeClassMinutes: 30
    };
    
    res.json({
      success: true,
      data: {
        todayReminderTime: `${(reminders.todayReminderHour || 8).toString().padStart(2, '0')}:${(reminders.todayReminderMinute || 0).toString().padStart(2, '0')}`,
        tomorrowReminderTime: `${(reminders.tomorrowReminderHour || 19).toString().padStart(2, '0')}:${(reminders.tomorrowReminderMinute || 30).toString().padStart(2, '0')}`,
        beforeClassMinutes: reminders.beforeClassMinutes || 30,
        enableAutoReminders: true,
        skipKeywordsEnabled: settings.skipKeywords?.enabled !== false,
        skipKeywords: settings.skipKeywords?.keywords || ['停課', '請假'],
        skippedCourses: skippedCourses
      }
    });
  } catch (error) {
    console.error('獲取排程設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取設定失敗'
    });
  }
});
// 設定排程設定API
app.post('/api/schedule-settings', (req, res) => {
  try {
    const { tomorrowReminderTime, beforeClassMinutes, skipKeywordsEnabled, skipKeywords } = req.body;
    console.log('⏰ 設定排程設定:', { tomorrowReminderTime, beforeClassMinutes, skipKeywordsEnabled, skipKeywords });
    
    // 解析隔日提醒時間（如果提供）
    let hour = 19, minute = 30; // 預設值
    if (tomorrowReminderTime) {
      [hour, minute] = tomorrowReminderTime.split(':').map(Number);
    }
    
    // 驗證輸入（如果提供）
    if (tomorrowReminderTime && (hour < 0 || hour > 23 || minute < 0 || minute > 59)) {
      return res.status(400).json({
        success: false,
        message: '無效的隔日提醒時間'
      });
    }
    
    if (beforeClassMinutes && (beforeClassMinutes < 1 || beforeClassMinutes > 120)) {
      return res.status(400).json({
        success: false,
        message: '無效的課前提醒時間'
      });
    }
    
    // 處理跳過關鍵字
    let processedSkipKeywords = ['停課', '請假']; // 預設值
    if (skipKeywords && typeof skipKeywords === 'string') {
      processedSkipKeywords = skipKeywords.split(',').map(k => k.trim()).filter(k => k.length > 0);
    }
    
    // 獲取現有設定
    const currentSettings = reminderScheduler.getSystemSettings();
    
    // 準備更新設定
    const updateSettings = {};
    
    // 更新提醒設定（如果提供）
    if (tomorrowReminderTime || beforeClassMinutes) {
      updateSettings.reminders = {
        ...currentSettings.reminders,
        ...(tomorrowReminderTime && { tomorrowReminderHour: hour, tomorrowReminderMinute: minute }),
        ...(beforeClassMinutes && { beforeClassMinutes: beforeClassMinutes })
      };
    }
    
    // 更新跳過關鍵字設定（如果提供）
    if (skipKeywordsEnabled !== undefined || skipKeywords) {
      updateSettings.skipKeywords = {
        enabled: skipKeywordsEnabled !== false,
        keywords: processedSkipKeywords
      };
    }
    
    // 更新系統設定
    if (Object.keys(updateSettings).length > 0) {
      reminderScheduler.updateSystemSettings(updateSettings);
    }
    
    res.json({
      success: true,
      message: '排程設定已更新',
      data: {
        tomorrowReminderTime: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`,
        beforeClassMinutes: beforeClassMinutes || currentSettings.reminders.beforeClassMinutes,
        skipKeywordsEnabled: skipKeywordsEnabled !== false,
        skipKeywords: processedSkipKeywords
      }
    });
  } catch (error) {
    console.error('設定排程設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '設定失敗'
    });
  }
});
// 時區診斷端點
// 注意：此 API 目前未在前端使用，保留供調試用
app.get('/api/timezone-debug', (req, res) => {
  try {
    const now = new Date();
    // 正確的台灣時區轉換
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const year = parts.find(part => part.type === 'year').value;
    const month = parts.find(part => part.type === 'month').value;
    const day = parts.find(part => part.type === 'day').value;
    const hour = parts.find(part => part.type === 'hour').value;
    const minute = parts.find(part => part.type === 'minute').value;
    const second = parts.find(part => part.type === 'second').value;
    
    const taiwanTime = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`);
    
    // 獲取學生提醒設定
    const studentReminderSettings = reminderScheduler.getStudentReminderSettings();
    const studentReminderHour = studentReminderSettings?.hour || 19;
    const studentReminderMinute = studentReminderSettings?.minute || 30;
    
    // 舊的計算方式（有問題）
    const oldWay = new Date(now.getFullYear(), now.getUTCMonth(), now.getUTCDate(), studentReminderHour, studentReminderMinute, 0, 0);
    
    // 新的計算方式（修復後）
    let newWay = new Date(now);
    newWay.setUTCHours(studentReminderHour - 8, studentReminderMinute, 0, 0);
    
    // 計算台灣時間的小時、分鐘
    const taiwanHours = taiwanTime.getHours();
    const taiwanMinutes = taiwanTime.getMinutes();
    
    // 如果今天的學生提醒時間已過，計算明天的
    if (taiwanHours > studentReminderHour || (taiwanHours === studentReminderHour && taiwanMinutes >= studentReminderMinute)) {
      newWay.setUTCDate(newWay.getUTCDate() + 1);
    }
    
    res.json({
      success: true,
      data: {
        currentTime: {
          utc: now.toISOString(),
          taiwan: taiwanTime.toISOString(),
          taiwanHours: taiwanTime.getHours(),
          taiwanMinutes: taiwanTime.getMinutes()
        },
        studentReminderSettings: {
          hour: studentReminderHour,
          minute: studentReminderMinute
        },
        oldCalculation: {
          target: oldWay.toISOString(),
          diff: oldWay.getTime() - now.getTime(),
          hours: Math.floor((oldWay.getTime() - now.getTime()) / (1000 * 60 * 60))
        },
        newCalculation: {
          target: newWay.toISOString(),
          diff: newWay.getTime() - now.getTime(),
          hours: Math.floor((newWay.getTime() - now.getTime()) / (1000 * 60 * 60))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 排程器診斷端點
// 注意：此 API 目前未在前端使用（已移除 runDiagnostic 按鈕），保留供調試用
app.get('/api/reminder-scheduler/diagnostic', async (req, res) => {
  try {
    console.log('🔍 開始排程器診斷...');
    
    // 檢查排程器狀態
    const status = reminderScheduler.getStatus();
    console.log('📊 排程器狀態:', status);
    
    // 檢查提醒資料
    const remindersData = loadReminders();
    const reminders = remindersData.reminders || [];
    console.log('📋 提醒資料:', reminders.length, '個');
    
    // 檢查講師資料
    const teacherData = JSON.parse(fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8'));
    const teachers = Object.keys(teacherData.teachers);
    console.log('👨‍🏫 講師資料:', teachers.length, '位');
    
    // 檢查 CalDAV 事件
    let events = [];
    try {
      events = await reminderScheduler.getCalendarEvents();
      console.log('📅 CalDAV 事件:', events.length, '個');
    } catch (error) {
      console.error('❌ CalDAV 錯誤:', error.message);
    }
    
    // 檢查今日事件
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(event => event.start && event.start.startsWith(today));
    console.log('📅 今日事件:', todayEvents.length, '個');
    
    // 測試講師匹配
    const testMatches = [];
    for (const event of todayEvents.slice(0, 3)) {
      const teacher = reminderScheduler.findTeacherByName(event.instructor, teacherData.teachers);
      testMatches.push({
        eventInstructor: event.instructor,
        matched: !!teacher,
        teacherName: teacher ? Object.keys(teacherData.teachers).find(name => teacherData.teachers[name] === teacher) : null
      });
    }
    
    res.json({
      success: true,
      data: {
        scheduler: status,
        reminders: {
          total: reminders.length,
          byStatus: reminders.reduce((acc, r) => {
            acc[r.status] = (acc[r.status] || 0) + 1;
            return acc;
          }, {})
        },
        teachers: {
          total: teachers.length,
          names: teachers
        },
        events: {
          total: events.length,
          today: todayEvents.length,
          sample: events.slice(0, 3).map(e => ({
            title: e.title,
            instructor: e.instructor,
            start: e.start,
            time: e.time
          }))
        },
        testMatches: testMatches
      }
    });
  } catch (error) {
    console.error('❌ 診斷失敗:', error);
    res.status(500).json({
      success: false,
      message: '診斷失敗',
      error: error.message
    });
  }
});

app.post('/api/reminder-scheduler/run', async (req, res) => {
  try {
    await reminderScheduler.runScheduledTasks();
    res.json({
      success: true,
      message: '排程任務執行完成'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '執行排程任務失敗',
      error: error.message
    });
  }
});

// 強制生成學生提醒API
app.post('/api/reminder-scheduler/generate-student-reminders', async (req, res) => {
  try {
    console.log('👨‍🎓 強制生成學生提醒...');
    
    // 直接調用學生提醒生成函數
    const studentReminders = await reminderScheduler.generateStudentReminders();
    
    res.json({
      success: true,
      message: '學生提醒生成完成',
      data: {
        count: studentReminders.length,
        reminders: studentReminders
      }
    });
  } catch (error) {
    console.error('❌ 強制生成學生提醒失敗:', error);
    res.status(500).json({
      success: false,
      message: '強制生成學生提醒失敗',
      error: error.message
    });
  }
});
// 測試排程器詳細執行過程
app.post('/api/reminder-scheduler/test', async (req, res) => {
  try {
    console.log('🧪 開始測試排程器詳細執行過程...');
    
    // 獲取今日事件
    const events = await reminderScheduler.getCalendarEvents();
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(event => event.start && event.start.startsWith(today));
    
    console.log(`📅 今日事件數量: ${todayEvents.length}`);
    
    const testResults = [];
    
    for (const event of todayEvents) {
      console.log(`🔍 處理事件: ${event.title} - ${event.instructor}`);
      
      // 解析課程時間
      const courseTime = reminderScheduler.parseCourseTime(event.time || event.title);
      console.log(`⏰ 解析時間:`, courseTime);
      
      // 測試講師匹配
      const teacherData = reminderScheduler.loadTeacherData();
      const teacher = reminderScheduler.findTeacherByName(event.instructor, teacherData.teachers);
      console.log(`👨‍🏫 講師匹配:`, teacher ? '成功' : '失敗');
      
      testResults.push({
        event: {
          title: event.title,
          instructor: event.instructor,
          start: event.start,
          time: event.time
        },
        courseTime: courseTime,
        teacherMatched: !!teacher,
        teacherName: teacher ? Object.keys(teacherData.teachers).find(name => teacherData.teachers[name] === teacher) : null
      });
    }
    
    res.json({
      success: true,
      data: {
        todayEvents: todayEvents.length,
        testResults: testResults
      }
    });
  } catch (error) {
    console.error('❌ 測試失敗:', error);
    res.status(500).json({
      success: false,
      message: '測試失敗',
      error: error.message
    });
  }
});

// 手動觸發午夜清理和重新載入
app.post('/api/reminder-scheduler/midnight-cleanup', async (req, res) => {
  try {
    console.log('🌅 手動觸發午夜清理和重新載入...');
    
    await reminderScheduler.forceMidnightCleanupAndReload();
    
    res.json({
      success: true,
      message: '午夜清理和重新載入完成，提醒將按照設定時間自動發送'
    });
  } catch (error) {
    console.error('❌ 午夜清理失敗:', error);
    res.status(500).json({
      success: false,
      message: '午夜清理失敗',
      error: error.message
    });
  }
});
// 批次重試失敗的提醒
// 注意：此 API 目前未在前端使用，保留供未來可能需要
app.post('/api/reminders/retry-failed', async (req, res) => {
  try {
    console.log('🔄 批次重試失敗的提醒...');
    
    const remindersData = loadReminders();
    const failedReminders = remindersData.reminders.filter(r => r.status === 'failed');
    
    console.log(`📊 找到 ${failedReminders.length} 個失敗的提醒`);
    
    if (failedReminders.length === 0) {
      return res.json({
        success: true,
        message: '沒有失敗的提醒需要重試',
        data: {
          total: 0,
          reset: 0
        }
      });
    }
    
    // 重置為 pending 狀態，讓排程器重新處理
    let resetCount = 0;
    failedReminders.forEach(reminder => {
      const index = remindersData.reminders.findIndex(r => r.id === reminder.id);
      if (index !== -1) {
        remindersData.reminders[index].status = 'pending';
        remindersData.reminders[index].retryCount = 0;
        delete remindersData.reminders[index].error;
        delete remindersData.reminders[index].sentAt;
        resetCount++;
      }
    });
    
    saveReminders(remindersData);
    
    console.log(`✅ 已重置 ${resetCount} 個失敗提醒為 pending 狀態`);
    
    res.json({
      success: true,
      message: `已重置 ${resetCount} 個失敗提醒，排程器將自動重新發送`,
      data: {
        total: failedReminders.length,
        reset: resetCount
      }
    });
  } catch (error) {
    console.error('❌ 批次重試失敗:', error);
    res.status(500).json({
      success: false,
      message: '批次重試失敗',
      error: error.message
    });
  }
});

// 批次發送指定的提醒
app.post('/api/reminders/batch-send', async (req, res) => {
  try {
    const { reminderIds, sendDelay, groupByRecipient } = req.body;
    
    console.log('📤 批次發送提醒...');
    console.log('📋 提醒數量:', reminderIds?.length);
    console.log('🎯 分組發送:', groupByRecipient);
    
    if (!reminderIds || !Array.isArray(reminderIds) || reminderIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: '請提供有效的提醒ID列表'
      });
    }
    
    const delay = sendDelay || 3000;
    const remindersData = loadReminders();
    const teacherList = TeacherRegistry.getTeacherList();

    // 獲取所有要發送的提醒
    const remindersToSend = reminderIds
      .map(id => remindersData.reminders.find(r => r.id === id))
      .filter(r => r);
    
    const results = {
      total: reminderIds.length,
      success: 0,
      failed: 0,
      carouselSent: 0,
      singleSent: 0,
      errors: []
    };
    
    // 如果啟用分組且啟用 Flex Message，則按收件者分組
    if (groupByRecipient && notificationManager.flexTemplates.enabled) {
      console.log('🎨 使用 Carousel 分組發送');
      
      // 按講師分組
      const groupedByTeacher = {};
      for (const reminder of remindersToSend) {
        const teacherNameRaw = reminder.teacherName || '未知講師';
        const teacherKey = reminderScheduler.normalizeTeacherName(teacherNameRaw) || (teacherNameRaw.trim() || teacherNameRaw);
        const displayName = teacherNameRaw.trim() || teacherNameRaw;
        if (!groupedByTeacher[teacherKey]) {
          groupedByTeacher[teacherKey] = {
            displayName,
            reminders: []
          };
        }
        groupedByTeacher[teacherKey].displayName = groupedByTeacher[teacherKey].displayName || displayName;
        groupedByTeacher[teacherKey].reminders.push(reminder);
      }
      
      const teacherGroups = Object.values(groupedByTeacher);
      console.log(`📊 分組結果: ${teacherGroups.length} 位講師`);
      
      // 為每個講師發送（可能是 carousel 或單一訊息）
      for (const group of teacherGroups) {
        const teacherName = group.displayName || '未知講師';
        const reminders = group.reminders;
        try {
          let teacherUserId = reminders.find(r => r.teacherUserId)?.teacherUserId || null;
          let teacherInfo = null;
          let resolvedTeacherName = teacherName;

          if (teacherUserId) {
            teacherInfo = TeacherRegistry.findTeacherByUserId(teacherUserId);
          }

          if (!teacherInfo) {
            teacherInfo = TeacherRegistry.findTeacherByName(teacherName);
            if (teacherInfo && !teacherUserId) {
              teacherUserId = teacherInfo.userId || null;
            }
          }

          if (teacherInfo && teacherInfo.name) {
            resolvedTeacherName = teacherInfo.displayName || teacherInfo.name;
          }

          if (!teacherUserId) {
            console.log(`⚠️ 找不到講師 ${teacherName} 的 LINE User ID，跳過`);
            const availableTeachers = teacherList.map(item => item.name).join(', ');
            if (availableTeachers) {
              console.log(`📋 已設定的講師清單: ${availableTeachers}`);
            }
            results.failed += reminders.length;
            reminders.forEach(r => {
              r.status = 'failed';
              r.error = '找不到講師 LINE User ID';
              r.teacherUserId = null;
              results.errors.push({
                reminderId: r.id,
                error: `找不到講師 ${teacherName} 的 LINE User ID`
              });
            });
            continue;
          }

          // 回寫解析後的講師資訊，避免下次重複解析
          const normalizedResolved = TeacherRegistry.normalizeTeacherName(resolvedTeacherName);
          reminders.forEach(reminder => {
            reminder.teacherUserId = teacherUserId;
            if (!reminder.teacherName || TeacherRegistry.normalizeTeacherName(reminder.teacherName) === normalizedResolved) {
              reminder.teacherName = resolvedTeacherName;
            }
          });
          
          console.log(`📤 發送給 ${resolvedTeacherName} (${reminders.length} 個提醒)`);
          
          // 準備變數陣列
          const variablesArray = reminders.map(reminder => {
            // 動態計算 timeUntilClass（for before-class 提醒）
            let timeUntilClass = '30分鐘後';
            if (reminder.type === 'before-class' && reminder.courseTime) {
              try {
                const [hour, minute] = reminder.courseTime.split(':').map(n => parseInt(n, 10));
                const year = new Date().getFullYear();
                const [month, day] = reminder.courseDate.split('-').slice(1).map(n => parseInt(n, 10));
                const taiwanTimeStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00+08:00`;
                const courseDateTime = new Date(taiwanTimeStr);
                const now = new Date();
                const diff = courseDateTime - now;
                const minutesUntil = Math.floor(diff / (1000 * 60));
                
                if (minutesUntil > 60) {
                  const hours = Math.floor(minutesUntil / 60);
                  const mins = minutesUntil % 60;
                  timeUntilClass = mins > 0 ? `${hours}小時${mins}分鐘後` : `${hours}小時後`;
                } else if (minutesUntil > 0) {
                  timeUntilClass = `${minutesUntil}分鐘後`;
                } else if (minutesUntil > -30) {
                  timeUntilClass = '即將開始';
                } else {
                  timeUntilClass = '已開始';
                }
              } catch (error) {
                console.error('計算上課時間失敗:', error);
              }
            }
            
            return {
              teacherName: reminder.teacherName || '未知講師',
              courseName: reminder.courseName || '未知課程',
              courseDate: reminder.courseDate || '未知日期',
              courseTime: reminder.courseTime || '未知時間',
              location: reminder.location || '未指定地點',
              description: reminder.description || '',
              lessonPlanUrl: reminder.lessonPlanUrl || '',
              googleMapsUrl: reminder.googleMapsUrl || 'https://maps.google.com',
              weekday: getWeekday(reminder.courseDate),
              currentTime: new Date().toLocaleTimeString('zh-TW'),
              currentDate: new Date().toLocaleDateString('zh-TW'),
              reminderType: reminder.type,
              reminderTypeText: reminder.type === 'today' ? '當日' : reminder.type === 'tomorrow' ? '隔日' : '課前',
              timeUntilClass: timeUntilClass,
              systemName: '樂程坊課程系統',
              reminderId: reminder.id
            };
          });
          
          // 建構 Flex Message（單一或 carousel）
          const templateType = reminders[0].type; // 使用第一個提醒的類型
          let flexMessage;
          let altText;
          
          if (reminders.length > 1) {
            // 多個提醒 -> Carousel
            flexMessage = notificationManager.buildCarousel(variablesArray, templateType);
            altText = `${variablesArray[0].reminderTypeText}課程提醒 (${reminders.length} 個課程)`;
            results.carouselSent++;
            console.log(`🎠 建構 Carousel (${reminders.length} 個 bubbles)`);
          } else {
            // 單一提醒 -> 單一 bubble
            flexMessage = notificationManager.buildFlexMessage(templateType, variablesArray[0]);
            altText = `${variablesArray[0].reminderTypeText}課程提醒 - ${variablesArray[0].courseName}`;
            results.singleSent++;
            console.log(`📋 建構單一 Flex Message`);
          }
          
          // 準備發送選項
          const sendOptions = { flexMessage, altText };
          
          // 如果是單一提醒，按類型決定是否附加 Quick Reply
          if (reminders.length === 1) {
            const qr = notificationManager.buildQuickReply(variablesArray[0], reminders[0].type);
            if (qr) {
              sendOptions.quickReply = qr;
            }
          }
          
          // 發送
          const sendResult = await notificationManager.sendLineMessage(
            teacherUserId,
            altText,
            sendOptions
          );
          
          if (sendResult.success) {
            results.success += reminders.length;
            // 更新所有提醒的狀態
            reminders.forEach(reminder => {
              reminder.status = 'sent';
              reminder.sentAt = new Date().toISOString();
              reminder.updatedAt = new Date().toISOString();
            });
            console.log(`✅ 成功發送給 ${resolvedTeacherName}`);
          } else if (sendResult.skipped) {
            // ✅ 處理跳過的訊息（無效的 User ID 格式）
            console.log(`⏭️ 跳過發送給 ${resolvedTeacherName} (${sendResult.details || sendResult.error})`);
            reminders.forEach(reminder => {
              reminder.status = 'skipped';
              reminder.error = sendResult.details || sendResult.error || 'User ID 格式無效';
              reminder.updatedAt = new Date().toISOString();
            });
            // 跳過的訊息不計入成功或失敗
          } else {
            throw new Error(sendResult.error || '發送失敗');
          }
          
          // 延遲
          if (delay > 0) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
          
        } catch (error) {
          console.error(`❌ 發送給 ${teacherName} 失敗:`, error);
          results.failed += reminders.length;
          reminders.forEach(r => {
            results.errors.push({
              reminderId: r.id,
              error: error.message
            });
            // 標記為失敗
            r.status = 'failed';
            r.updatedAt = new Date().toISOString();
          });
        }
      }
      
      // 儲存更新
      saveReminders(remindersData);
      
    } else {
      // 傳統逐個發送
      console.log('📝 使用傳統逐個發送');
      
      for (const reminderId of reminderIds) {
        try {
          console.log(`📤 發送提醒: ${reminderId}`);
          
          const response = await axios.post(
            `http://localhost:${PORT}/api/reminders/${reminderId}/send`,
            {},
            { timeout: 30000 }
          );
          
          if (response.data.success) {
            results.success++;
            results.singleSent++;
            console.log(`✅ 提醒發送成功: ${reminderId}`);
          } else {
            results.failed++;
            results.errors.push({
              reminderId,
              error: response.data.message
            });
            console.log(`❌ 提醒發送失敗: ${reminderId}`);
          }
          
          if (delay > 0 && reminderIds.indexOf(reminderId) < reminderIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            reminderId,
            error: error.message
          });
          console.error(`❌ 發送提醒失敗: ${reminderId}`, error.message);
        }
      }
    }
    
    console.log(`✅ 批次發送完成: 成功 ${results.success}/${results.total}`);
    console.log(`📊 Carousel: ${results.carouselSent}, 單一訊息: ${results.singleSent}`);
    
    res.json({
      success: true,
      message: `批次發送完成: 成功 ${results.success}/${results.total}`,
      data: results
    });
  } catch (error) {
    console.error('❌ 批次發送失敗:', error);
    res.status(500).json({
      success: false,
      message: '批次發送失敗',
      error: error.message
    });
  }
});

// ✅ 優化：強制刷新行事曆（用於即時響應）
app.post('/api/calendar/force-refresh', async (req, res) => {
  try {
    console.log('🔄 收到強制刷新行事曆請求...');
    
    if (!reminderScheduler) {
      return res.status(503).json({
        success: false,
        message: '提醒排程器未啟動'
      });
    }
    
    const result = await reminderScheduler.forceRefresh();
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('❌ 強制刷新失敗:', error);
    res.status(500).json({
      success: false,
      message: '強制刷新失敗',
      error: error.message
    });
  }
});

// 地址映射管理 API
// 獲取地址映射設定
app.get('/api/address-mappings', (req, res) => {
  try {
    console.log('📍 獲取地址映射設定...');
    const mappingsPath = path.join(__dirname, 'data', 'address-mappings.json');
    
    let mappings = [];
    if (fs.existsSync(mappingsPath)) {
      const mappingsData = fs.readFileSync(mappingsPath, 'utf8');
      mappings = JSON.parse(mappingsData);
    } else {
      // 如果檔案不存在，使用預設值
      mappings = [
        {
          original: '台北市中正區開封街1段2號9樓',
          display: 'FunLearnBar站前教室'
        }
      ];
    }
    
    res.json({
      success: true,
      data: mappings
    });
  } catch (error) {
    console.error('❌ 獲取地址映射失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取地址映射失敗',
      error: error.message
    });
  }
});

// 儲存地址映射設定
app.post('/api/address-mappings', (req, res) => {
  try {
    const { mappings } = req.body;
    console.log('📍 儲存地址映射設定:', mappings);
    
    if (!mappings || !Array.isArray(mappings)) {
      return res.status(400).json({
        success: false,
        message: '地址映射資料格式錯誤'
      });
    }
    
    // 確保 data 目錄存在
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 儲存到檔案
    const mappingsPath = path.join(dataDir, 'address-mappings.json');
    fs.writeFileSync(mappingsPath, JSON.stringify(mappings, null, 2), 'utf8');
    
    res.json({
      success: true,
      message: '地址映射設定已儲存'
    });
  } catch (error) {
    console.error('❌ 儲存地址映射失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存地址映射失敗',
      error: error.message
    });
  }
});

// ==================== 管理員 API ====================

// 管理員密碼（請修改為安全的密碼）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_TOKEN_SECRET = 'flb-admin-secret-key-' + Date.now();
// 🔥 [修復 2025-11-27] 使用共用 Auth 中間件的 Token 存儲，確保 V3 路由也能驗證
const authMiddleware = require('./routes/middleware/auth');
let adminTokens = authMiddleware.adminTokens;

// 生成管理員 token
function generateAdminToken() {
  return 'admin_' + Math.random().toString(36).substring(2) + Date.now();
}

// 驗證管理員 token
function verifyAdminToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未授權' });
  }

  const token = authHeader.substring(7);
  if (!adminTokens.has(token)) {
    return res.status(401).json({ success: false, message: 'Token 無效' });
  }

  next();
}

// 管理員登入
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;

  if (password === ADMIN_PASSWORD) {
    const token = generateAdminToken();
    adminTokens.add(token);
    
    // Token 24小時後過期
    setTimeout(() => {
      adminTokens.delete(token);
    }, 24 * 60 * 60 * 1000);

    res.json({
      success: true,
      token: token
    });
  } else {
    res.status(401).json({
      success: false,
      message: '密碼錯誤'
    });
  }
});

// 讀取系統設定
app.get('/api/admin/system-settings', verifyAdminToken, (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '讀取系統設定失敗',
      error: error.message
    });
  }
});
// 儲存系統設定
app.post('/api/admin/system-settings', verifyAdminToken, (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const newSettings = req.body;
    
    const mergedSettings = {
      ...loadSystemSettings(),
      ...newSettings,
      dateRange: {
        futureDays: Math.max(1, parseInt(newSettings.dateRange?.futureDays ?? newSettings.futureDays ?? 30, 10)),
        pastDays: Math.max(0, parseInt(newSettings.dateRange?.pastDays ?? newSettings.pastDays ?? 7, 10))
      }
    };
    
    if ('futureDays' in mergedSettings) delete mergedSettings.futureDays;
    if ('pastDays' in mergedSettings) delete mergedSettings.pastDays;
    
    // 備份舊設定
    if (fs.existsSync(settingsPath)) {
      const backupPath = path.join(__dirname, `system-settings.json.backup-${Date.now()}`);
      fs.copyFileSync(settingsPath, backupPath);
    }
    
    // 寫入新設定
    fs.writeFileSync(settingsPath, JSON.stringify(mergedSettings, null, 2));
    
    console.log('✅ 系統設定已更新');
    
    res.json({
      success: true,
      message: '系統設定已更新',
      data: mergedSettings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '儲存系統設定失敗',
      error: error.message
    });
  }
});
// 讀取學生提醒設定
app.get('/api/admin/student-reminder-settings', verifyAdminToken, (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'student-reminder-settings.json');
    const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '讀取提醒設定失敗',
      error: error.message
    });
  }
});

// 儲存學生提醒設定
app.post('/api/admin/student-reminder-settings', verifyAdminToken, (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'student-reminder-settings.json');
    
    // 備份現有設定
    const backupPath = path.join(__dirname, 'student-reminder-settings.json.backup');
    if (fs.existsSync(settingsPath)) {
      fs.copyFileSync(settingsPath, backupPath);
    }

    // 儲存新設定
    fs.writeFileSync(settingsPath, JSON.stringify(req.body, null, 2), 'utf8');
    
    res.json({
      success: true,
      message: '提醒設定已儲存'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '儲存提醒設定失敗',
      error: error.message
    });
  }
});

// 讀取講師資料
app.get('/api/admin/teacher-data', verifyAdminToken, (req, res) => {
  try {
    const dataPath = path.join(__dirname, 'teacher_data.json');
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    res.json({
      success: true,
      data: data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '讀取講師資料失敗',
      error: error.message
    });
  }
});

// 新增講師
app.post('/api/admin/teacher-data/add', verifyAdminToken, (req, res) => {
  try {
    const { name, userId } = req.body;
    const dataPath = path.join(__dirname, 'teacher_data.json');
    
    // 讀取現有資料
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // 檢查是否已存在
    if (data.teachers[name]) {
      return res.status(400).json({
        success: false,
        message: '該講師已存在'
      });
    }

    // 備份
    const backupPath = path.join(__dirname, 'teacher_data.json.backup');
    fs.copyFileSync(dataPath, backupPath);

    // 新增講師
    data.teachers[name] = userId;
    data.last_update = new Date().toISOString();

    // 儲存
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    
    res.json({
      success: true,
      message: '講師新增成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '新增講師失敗',
      error: error.message
    });
  }
});

// 刪除講師
app.post('/api/admin/teacher-data/delete', verifyAdminToken, (req, res) => {
  try {
    const { name } = req.body;
    const dataPath = path.join(__dirname, 'teacher_data.json');
    
    // 讀取現有資料
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    
    // 檢查是否存在
    if (!data.teachers[name]) {
      return res.status(404).json({
        success: false,
        message: '找不到該講師'
      });
    }

    // 備份
    const backupPath = path.join(__dirname, 'teacher_data.json.backup');
    fs.copyFileSync(dataPath, backupPath);

    // 刪除講師
    delete data.teachers[name];
    data.last_update = new Date().toISOString();

    // 儲存
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
    
    res.json({
      success: true,
      message: '講師刪除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '刪除講師失敗',
      error: error.message
    });
  }
});

// 讀取講師列表資料
app.get('/api/admin/teacher-list-data', verifyAdminToken, (req, res) => {
  try {
    const { records } = readTeacherListCsvRecords();
    const data = records.map(record => ({
      name: record.teacher || '',
      sheetUrl: record.link || '',
      webApi: record.webApi || '',
      reportApi: record.readApi || '',
      userId: record.userId || '',
      googleSheetReadApi: record.googleSheetReadApi || ''
    }));

    res.json({
      success: true,
      data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '讀取講師列表失敗',
      error: error.message
    });
  }
});
// 建立備份
app.post('/api/admin/backup/create', verifyAdminToken, (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup_${timestamp}`;
    const backupPath = path.join(backupDir, `${backupName}.json`);

    // 收集所有配置文件
    const backup = {
      timestamp: new Date().toISOString(),
      files: {
        systemSettings: JSON.parse(fs.readFileSync(path.join(__dirname, 'system-settings.json'), 'utf8')),
        studentReminderSettings: JSON.parse(fs.readFileSync(path.join(__dirname, 'student-reminder-settings.json'), 'utf8')),
        teacherData: JSON.parse(fs.readFileSync(path.join(__dirname, 'teacher_data.json'), 'utf8')),
        teacherListData: fs.readFileSync(TEACHER_LIST_CSV_PATH, 'utf8')
      }
    };

    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');

    res.json({
      success: true,
      message: '備份建立成功',
      backupName: backupName
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '建立備份失敗',
      error: error.message
    });
  }
});
// 讀取備份歷史
app.get('/api/admin/backup/history', verifyAdminToken, (req, res) => {
  try {
    const backupDir = path.join(__dirname, 'backups');
    if (!fs.existsSync(backupDir)) {
      return res.json({
        success: true,
        backups: []
      });
    }

    const files = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          name: file.replace('.json', ''),
          date: stats.mtime,
          size: stats.size
        };
      })
      .sort((a, b) => b.date - a.date);

    res.json({
      success: true,
      backups: files
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '讀取備份歷史失敗',
      error: error.message
    });
  }
});
// 還原備份
app.post('/api/admin/backup/restore', verifyAdminToken, (req, res) => {
  try {
    const { name } = req.body;
    const backupPath = path.join(__dirname, 'backups', `${name}.json`);

    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({
        success: false,
        message: '找不到備份檔案'
      });
    }

    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    // 還原所有檔案
    fs.writeFileSync(
      path.join(__dirname, 'system-settings.json'),
      JSON.stringify(backup.files.systemSettings, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(__dirname, 'student-reminder-settings.json'),
      JSON.stringify(backup.files.studentReminderSettings, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      path.join(__dirname, 'teacher_data.json'),
      JSON.stringify(backup.files.teacherData, null, 2),
      'utf8'
    );
    fs.writeFileSync(
      TEACHER_LIST_CSV_PATH,
      backup.files.teacherListData,
      'utf8'
    );

    res.json({
      success: true,
      message: '備份還原成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '還原備份失敗',
      error: error.message
    });
  }
});

// 測試提醒發送
app.post('/api/admin/test-reminder', verifyAdminToken, async (req, res) => {
  try {
    // 這裡可以實作測試提醒的邏輯
    res.json({
      success: true,
      message: '測試提醒已發送'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '發送測試提醒失敗',
      error: error.message
    });
  }
});

// ==================== 管理員 API 結束 ====================

// ==================== Notion 課程同步 API ====================
app.get('/api/course-sync/notion/config', async (req, res) => {
  try {
    const config = await notionCourseSyncManager.getConfig({
      includeProperties: true,
      forceRefreshProperties: req.query.refresh === 'true'
    });
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('❌ 取得 Notion 同步設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '取得 Notion 同步設定失敗',
      error: error.message
    });
  }
});

app.post('/api/course-sync/notion/config', async (req, res) => {
  try {
    const updatedConfig = await notionCourseSyncManager.saveConfig(req.body || {});
    const response = await notionCourseSyncManager.getConfig({ includeProperties: true });
    res.json({
      success: true,
      message: '設定已儲存',
      data: response,
      savedConfig: updatedConfig
    });
  } catch (error) {
    console.error('❌ 儲存 Notion 同步設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '儲存 Notion 同步設定失敗',
      error: error.message
    });
  }
});

app.post('/api/course-sync/notion/test', async (req, res) => {
  try {
    const result = await notionCourseSyncManager.testConnection(req.body || {});
    res.json({
      success: true,
      message: 'Notion 連線成功',
      data: result
    });
  } catch (error) {
    console.error('❌ Notion 連線測試失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Notion 連線測試失敗'
    });
  }
});

app.get('/api/course-sync/notion/properties', async (req, res) => {
  try {
    const properties = await notionCourseSyncManager.fetchDatabaseProperties({
      forceRefresh: req.query.refresh === 'true'
    });
    res.json({
      success: true,
      data: properties
    });
  } catch (error) {
    console.error('❌ 取得 Notion 欄位失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '取得 Notion 欄位失敗'
    });
  }
});

app.post('/api/course-sync/notion/mappings', async (req, res) => {
  try {
    const saved = await notionCourseSyncManager.saveMappings(req.body?.mappings || []);
    res.json({
      success: true,
      message: '欄位對應已儲存',
      data: saved
    });
  } catch (error) {
    console.error('❌ 儲存欄位對應失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '儲存欄位對應失敗'
    });
  }
});

app.post('/api/course-sync/notion/secret', async (req, res) => {
  try {
    const { secret } = req.body || {};
    if (!secret || typeof secret !== 'string') {
      return res.status(400).json({
        success: false,
        message: '請提供有效的 Notion API Token'
      });
    }

    if (!/^secret_|^ntn_/i.test(secret)) {
      console.warn('⚠️ Notion Token 格式非預期，仍將寫入環境變數');
    }

    upsertEnvValue('NOTION_API_SECRET', secret);
    process.env.NOTION_API_SECRET = secret;
    notionCourseSyncManager.setSecret(secret);
    await notionCourseSyncManager.appendLog('info', '更新 Notion API Token', {
      tokenLength: secret.length || 0
    });

    res.json({
      success: true,
      message: 'Notion Token 已更新'
    });
  } catch (error) {
    console.error('❌ 更新 Notion Token 失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '更新 Notion Token 失敗'
    });
  }
});

app.post('/api/course-sync/notion/import', async (req, res) => {
  try {
    const summary = await notionCourseSyncManager.syncFromNotion(req.body || {});
    res.json({
      success: true,
      message: '已完成 Notion → 系統同步',
      data: summary
    });
  } catch (error) {
    console.error('❌ Notion 匯入失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Notion 匯入失敗'
    });
  }
});

app.post('/api/course-sync/notion/export', async (req, res) => {
  try {
    const summary = await notionCourseSyncManager.syncToNotion(req.body || {});
    res.json({
      success: true,
      message: '已完成 系統 → Notion 同步',
      data: summary
    });
  } catch (error) {
    console.error('❌ Notion 匯出失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Notion 匯出失敗'
    });
  }
});

app.post('/api/course-sync/notion/preview', async (req, res) => {
  try {
    const diff = await notionCourseSyncManager.previewDiff();
    res.json({
      success: true,
      data: diff
    });
  } catch (error) {
    console.error('❌ 產生同步差異失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '產生同步差異失敗'
    });
  }
});

app.get('/api/course-sync/notion/logs', async (req, res) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const logs = await notionCourseSyncManager.getLogs(limit);
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('❌ 取得 Notion 同步紀錄失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '取得同步紀錄失敗'
    });
  }
});

app.delete('/api/course-sync/notion/logs', async (req, res) => {
  try {
    await notionCourseSyncManager.clearLogs();
    res.json({
      success: true,
      message: '同步紀錄已清除'
    });
  } catch (error) {
    console.error('❌ 清除同步紀錄失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message || '清除同步紀錄失敗'
    });
  }
});

// ==================== 學生資料 API ====================
// 注意：/api/students 路由已在第 3672 行定義，此處不需重複
// ==================== 學生資料 API 結束 ====================

// ==================== V2 學生 API（React 前端專用）====================
// 載入 V2 學生路由模組
const v2StudentsRouter = require('./routes/v2-students');
// 🔥 修復 2025-11-27：載入 V2 學生上傳路由（整合照片處理管道）
const v2StudentsUploadRouter = require('./routes/v2-students-upload');

// 將 Google Sheets Students 服務掛載到 app
app.set('googleSheetsStudents', googleSheetsStudents);

// 註冊 V2 學生 API 路由
app.use('/api/v2', v2StudentsRouter);
// 🔥 修復 2025-11-27：註冊 V2 學生上傳路由
app.use('/api/v2', v2StudentsUploadRouter);

console.log('✅ V2 學生 API 已註冊：/api/v2/');
console.log('✅ V2 學生上傳 API 已註冊：/api/v2/students/upload');
// ==================== V2 學生 API 結束 ====================

// ==================== V2 課程 API（React 前端專用）====================
// 載入 V2 課程路由模組
const v2CoursesRouter = require('./routes/v2-courses');

// 將事件快取掛載到 app（供路由使用）
app.set('eventsCache', eventsCache);

// 註冊 V2 課程 API 路由
app.use('/api/v2', v2CoursesRouter);

console.log('✅ V2 課程 API 已註冊：/api/v2/courses');
// ==================== V2 課程 API 結束 ====================

// ==================== V2 Deep Link API（React 前端專用）====================
// 載入 V2 Deep Link 路由模組
const v2DeeplinkRouter = require('./routes/v2-deeplink');

// 註冊 V2 Deep Link API 路由
app.use('/api/v2', v2DeeplinkRouter);

console.log('✅ V2 Deep Link API 已註冊：/api/v2/deeplink-course');
// ==================== V2 Deep Link API 結束 ====================

// ==================== 🚀 模組化路由系統（階段二：獨立模組遷移）====================
// 載入新的模組化路由系統
// ==================== 模組化路由系統（已移至 server.js 結尾處） ====================
// 注意：路由初始化已移至所有服務定義之後，避免 "Cannot access before initialization" 錯誤
// 參見：server.js 第 20091-20127 行
// ==================== 模組化路由系統結束 ====================

// ==================== 管理員配置 API ====================

// GET /api/admin/info - 獲取管理員資訊
app.get('/api/admin/info', (req, res) => {
  try {
    // 從 notification-config.json 讀取管理員資訊
    const configPath = path.join(__dirname, 'notification-config.json');
    let adminUserId = null;
    let staffGroupId = null;
    
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      adminUserId = config?.roles?.admin?.user_id || null;
      staffGroupId = config?.roles?.admin?.group_id || null;
    }
    
    res.json({
      success: true,
      data: {
        userId: adminUserId,
        staffGroupId: staffGroupId,
        hasToken: !!process.env.LINE_CHANNEL_ACCESS_TOKEN
      }
    });
  } catch (error) {
    console.error('獲取管理員資訊失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取管理員資訊失敗: ' + error.message
    });
  }
});

// POST /api/admin/set - 設定管理員
app.post('/api/admin/set', async (req, res) => {
  try {
    const { adminUserId, staffGroupId } = req.body;
    
    if (!adminUserId || adminUserId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '管理員 User ID 為必填'
      });
    }
    
    if (!staffGroupId || staffGroupId.trim() === '') {
      return res.status(400).json({
        success: false,
        message: '正職群組 ID 為必填'
      });
    }
    
    // 更新 notification-config.json
    const configPath = path.join(__dirname, 'notification-config.json');
    let config = {};
    
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    // 確保結構存在
    if (!config.roles) config.roles = {};
    if (!config.roles.admin) config.roles.admin = {};
    
    // 更新管理員資訊
    config.roles.admin.user_id = adminUserId.trim();
    config.roles.admin.group_id = staffGroupId.trim();
    
    // 寫入檔案
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    console.log('✅ 管理員配置已更新:', { adminUserId, staffGroupId });
    
    res.json({
      success: true,
      message: '管理員設定成功',
      data: {
        userId: adminUserId,
        staffGroupId: staffGroupId
      }
    });
    
  } catch (error) {
    console.error('設定管理員失敗:', error);
    res.status(500).json({
      success: false,
      message: '設定管理員失敗: ' + error.message
    });
  }
});

// ==================== 管理員配置 API 結束 ====================

// ==================== LINE 測試 API ====================

// POST /api/test-line-notification - 測試 LINE 通知
app.post('/api/test-line-notification', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
      return res.status(500).json({
        success: false,
        message: 'LINE_CHANNEL_ACCESS_TOKEN 未設定',
        hint: '請先在 LINE API 設定中設定 Channel Access Token'
      });
    }
    
    const testUserId = userId || process.env.ADMIN_USER_ID;
    
    if (!testUserId) {
      return res.status(400).json({
        success: false,
        message: '未設定管理員 User ID',
        hint: '請先在管理員配置中設定 User ID'
      });
    }
    
    const testMessage = message || `🧪 LINE 通知測試\n\n系統正常運作中！\n測試時間：${new Date().toLocaleString('zh-TW')}`;
    
    const response = await axios.post('https://api.line.me/v2/bot/message/push', {
      to: testUserId,
      messages: [{
        type: 'text',
        text: testMessage
      }]
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ LINE 測試通知發送成功:', testUserId);
    
    res.json({
      success: true,
      message: 'LINE 通知測試成功',
      data: {
        userId: testUserId,
        messageLength: testMessage.length,
        lineResponse: response.data
      }
    });
    
  } catch (error) {
    console.error('LINE 通知測試失敗:', error);
    
    const errorMessage = error.response?.data?.message || error.message;
    const errorDetails = error.response?.data?.details || [];
    
    res.status(500).json({
      success: false,
      message: 'LINE 通知測試失敗',
      error: errorMessage,
      details: errorDetails,
      hint: error.response?.status === 401 ? '請檢查 LINE_CHANNEL_ACCESS_TOKEN 是否正確' : 
            error.response?.status === 400 ? '請檢查管理員 User ID 是否正確' :
            '請檢查 LINE API 設定'
    });
  }
});

// ==================== LINE 測試 API 結束 ====================

// ==================== 系統設定 API ====================

// GET /api/system-settings - 獲取系統設定
app.get('/api/system-settings', (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'system-settings.json');
    
    if (!fs.existsSync(settingsPath)) {
      return res.status(404).json({
        success: false,
        message: '系統設定檔案不存在'
      });
    }
    
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('讀取系統設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取系統設定失敗: ' + error.message
    });
  }
});

// POST /api/system-settings - 更新系統設定
app.post('/api/system-settings', async (req, res) => {
  try {
    // 🚀 防抖機制（避免頻繁保存）
    if (memoryDB.get('saving_system_settings')) {
      logger.throttle('system-settings-save', 'WARN', '⏳ 系統設定保存進行中，跳過');
      return res.status(202).json({
        success: false,
        message: '系統設定保存進行中，請稍後再試',
        saving: true
      });
    }
    
    memoryDB.set('saving_system_settings', true);
    
    const settingsPath = path.join(__dirname, 'system-settings.json');
    const newSettings = req.body;
    
    const mergedSettings = {
      ...loadSystemSettings(),
      ...newSettings,
      dateRange: {
        futureDays: Math.max(1, parseInt(newSettings.dateRange?.futureDays ?? newSettings.futureDays ?? 30, 10)),
        pastDays: Math.max(0, parseInt(newSettings.dateRange?.pastDays ?? newSettings.pastDays ?? 7, 10))
      }
    };
    
    if ('futureDays' in mergedSettings) delete mergedSettings.futureDays;
    if ('pastDays' in mergedSettings) delete mergedSettings.pastDays;
    
    // 🚀 改用異步寫入
    await safeFile.writeJSON(settingsPath, mergedSettings);
    
    console.log('✅ 系統設定已更新（異步 + 鎖）');
    
    res.json({
      success: true,
      message: '系統設定已更新',
      data: mergedSettings
    });
  } catch (error) {
    console.error('更新系統設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新系統設定失敗: ' + error.message
    });
  } finally {
    // 🚀 釋放保存鎖（3秒後）
    setTimeout(() => {
      memoryDB.delete('saving_system_settings');
    }, 3000);
  }
});

// 🎨 GET /api/course-colors - 獲取課程類別顏色配置
app.get('/api/course-colors', (req, res) => {
  try {
    const settingsPath = path.join(__dirname, 'system-settings.json');
    
    // 預設顏色配置（如果檔案不存在或沒有配置）
    const defaultColors = {
      ESM: '#FFB3D9',
      SPM: '#FFA726',
      SPIKE: '#FFD54F',
      BOOST: '#4FC3F7',
      EV3: '#66BB6A',
      MINECRAFT: '#8BC34A',
      OTHER: '#9E9E9E'
    };
    
    if (!fs.existsSync(settingsPath)) {
      console.log('⚠️ 系統設定檔案不存在，使用預設課程顏色');
      return res.json({
        success: true,
        data: defaultColors,
        message: '使用預設課程顏色配置'
      });
    }
    
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const courseColors = settings.courseColors || defaultColors;
    
    console.log('✅ 成功載入課程顏色配置:', Object.keys(courseColors).length, '種課程類型');
    
    res.json({
      success: true,
      data: courseColors
    });
  } catch (error) {
    console.error('❌ 讀取課程顏色配置失敗:', error);
    
    // 發生錯誤時返回預設顏色
    res.json({
      success: true,
      data: {
        ESM: '#FFB3D9',
        SPM: '#FFA726',
        SPIKE: '#FFD54F',
        BOOST: '#4FC3F7',
        EV3: '#66BB6A',
        MINECRAFT: '#8BC34A',
        OTHER: '#9E9E9E'
      },
      message: '使用預設課程顏色配置（讀取設定失敗）'
    });
  }
});

// GET /api/student-filter-config - 獲取學生篩選配置
app.get('/api/student-filter-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'data', 'student-filter-config.json');
    
    // 如果配置文件不存在，返回預設配置
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        debugMode: false,
        minRemainingClasses: 0,
        enableRemainingCheck: true,
        showInCurrentWeek: true, // 🎯 當週持續顯示低於最小堂數的學生
        courseMatchMode: 'exact', // 'exact' 或 'fuzzy'
        timeMatchRules: {
          allowWeekSuffix: true,
          allowSubstituteKeyword: true,
          normalizeTimeFormat: true
        }
      };
      
      return res.json({
        success: true,
        data: defaultConfig,
        message: '使用預設配置'
      });
    }
    
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    
    console.log('✅ 學生篩選配置已載入');
    
    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('讀取學生篩選配置失敗:', error);
    
    // 返回預設配置作為降級方案
    const defaultConfig = {
      debugMode: false,
      minRemainingClasses: 0,
      enableRemainingCheck: true,
      showInCurrentWeek: true, // 🎯 當週持續顯示低於最小堂數的學生
      courseMatchMode: 'exact',
      timeMatchRules: {
        allowWeekSuffix: true,
        allowSubstituteKeyword: true,
        normalizeTimeFormat: true
      }
    };
    
    res.json({
      success: true,
      data: defaultConfig,
      message: '使用預設配置（載入失敗）'
    });
  }
});

// POST /api/student-filter-config - 更新學生篩選配置
app.post('/api/student-filter-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'data', 'student-filter-config.json');
    const newConfig = req.body;
    
    // 驗證配置格式
    if (typeof newConfig.debugMode !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'debugMode 必須是布林值'
      });
    }
    
    if (typeof newConfig.minRemainingClasses !== 'number' || newConfig.minRemainingClasses < 0) {
      return res.status(400).json({
        success: false,
        message: 'minRemainingClasses 必須是非負數'
      });
    }
    
    // 備份舊配置
    if (fs.existsSync(configPath)) {
      const backupPath = path.join(__dirname, 'data', `student-filter-config.json.backup-${Date.now()}`);
      fs.copyFileSync(configPath, backupPath);
    }
    
    // 寫入新配置
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    
    console.log('✅ 學生篩選配置已更新:', newConfig);
    
    res.json({
      success: true,
      message: '學生篩選配置已更新',
      data: newConfig
    });
  } catch (error) {
    console.error('更新學生篩選配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新學生篩選配置失敗: ' + error.message
    });
  }
});

// POST /api/calendar-config - 更新行事曆設定
app.post('/api/calendar-config', async (req, res) => {
  try {
    const { baseUrl, username, password, calendarId } = req.body;
    
    if (!baseUrl || !username) {
      return res.status(400).json({
        success: false,
        message: '請提供行事曆 URL 和用戶名稱'
      });
    }
    
    const envPath = path.join(__dirname, '.env.nas');
    
    // 讀取現有的 .env.nas 內容
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新環境變數
    const updateEnvVar = (key, value) => {
      if (!value) return;
      const line = `${key}=${value}`;
      if (envContent.includes(`${key}=`)) {
        envContent = envContent.replace(new RegExp(`${key}=.*`, 'g'), line);
      } else {
        envContent += `\n${line}`;
      }
    };
    
    updateEnvVar('CALDAV_URL', baseUrl);
    updateEnvVar('CALDAV_USERNAME', username);
    if (password) {
      updateEnvVar('CALDAV_PASSWORD', password);
    }
    
    // 寫入文件
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ 行事曆設定已更新到 .env.nas');
    console.log('⚠️ 請重啟 Docker 服務以載入新配置');
    
    res.json({
      success: true,
      message: '行事曆設定已儲存，請重啟 Docker 服務以載入新配置',
      needRestart: true
    });
  } catch (error) {
    console.error('更新行事曆設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新行事曆設定失敗: ' + error.message
    });
  }
});
// POST /api/reminder-config - 更新提醒設定
app.post('/api/reminder-config', (req, res) => {
  try {
    const { 
      todayReminderHour, 
      todayReminderMinute, 
      tomorrowReminderHour, 
      tomorrowReminderMinute,
      beforeClassMinutes 
    } = req.body;
    
    const settingsPath = path.join(__dirname, 'system-settings.json');
    
    if (!fs.existsSync(settingsPath)) {
      return res.status(404).json({
        success: false,
        message: '系統設定檔案不存在'
      });
    }
    
    // 讀取現有設定
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    
    // 更新提醒設定
    if (todayReminderHour !== undefined) {
      settings.reminders.todayReminderHour = todayReminderHour;
    }
    if (todayReminderMinute !== undefined) {
      settings.reminders.todayReminderMinute = todayReminderMinute;
    }
    if (tomorrowReminderHour !== undefined) {
      settings.reminders.tomorrowReminderHour = tomorrowReminderHour;
    }
    if (tomorrowReminderMinute !== undefined) {
      settings.reminders.tomorrowReminderMinute = tomorrowReminderMinute;
    }
    if (beforeClassMinutes !== undefined) {
      settings.reminders.beforeClassMinutes = beforeClassMinutes;
    }
    
    // 備份舊設定
    const backupPath = path.join(__dirname, `system-settings.json.backup-${Date.now()}`);
    fs.copyFileSync(settingsPath, backupPath);
    
    // 寫入新設定
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    
    console.log('✅ 提醒設定已更新');
    
    res.json({
      success: true,
      message: '提醒設定已更新'
    });
  } catch (error) {
    console.error('更新提醒設定失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新提醒設定失敗: ' + error.message
    });
  }
});

// ==================== LINE 配置管理 API ====================

// GET /api/line-config - 獲取 LINE 配置狀態
app.get('/api/line-config', (req, res) => {
  try {
    const hasToken = !!process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const tokenLength = hasToken ? process.env.LINE_CHANNEL_ACCESS_TOKEN.length : 0;
    const tokenPreview = hasToken ? process.env.LINE_CHANNEL_ACCESS_TOKEN.substring(0, 20) : null;
    const liffClientId = process.env.LIFF_CLIENT_ID || null;
    
    res.json({
      success: true,
      data: {
        hasToken,
        tokenLength,
        tokenPreview,
        liffClientId,
        adminUserId: process.env.ADMIN_USER_ID || null,
        environment: process.env.NODE_ENV || 'development'
      }
    });
  } catch (error) {
    console.error('獲取 LINE 配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取 LINE 配置失敗: ' + error.message
    });
  }
});
// POST /api/line-config - 更新 LINE 配置
app.post('/api/line-config', async (req, res) => {
  try {
    const { lineChannelToken, liffClientId } = req.body;
    
    if (!lineChannelToken || lineChannelToken.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'LINE Channel Access Token 為必填'
      });
    }
    
    const envPath = path.join(__dirname, '.env.nas');
    
    // 讀取現有的 .env.nas 內容
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    // 更新或添加 LINE_CHANNEL_ACCESS_TOKEN
    const tokenLine = `LINE_CHANNEL_ACCESS_TOKEN=${lineChannelToken}`;
    const liffLine = liffClientId ? `LIFF_CLIENT_ID=${liffClientId}` : '';
    
    // 檢查是否已存在
    if (envContent.includes('LINE_CHANNEL_ACCESS_TOKEN=')) {
      // 替換現有的 Token
      envContent = envContent.replace(
        /LINE_CHANNEL_ACCESS_TOKEN=.*/g,
        tokenLine
      );
    } else {
      // 添加新的 Token
      envContent += '\n\n# LINE Messaging API\n' + tokenLine + '\n';
    }
    
    // 更新或添加 LIFF_CLIENT_ID
    if (liffClientId) {
      if (envContent.includes('LIFF_CLIENT_ID=')) {
        envContent = envContent.replace(
          /LIFF_CLIENT_ID=.*/g,
          liffLine
        );
      } else {
        envContent += liffLine + '\n';
      }
    }
    
    // 寫入文件
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ LINE 配置已更新到 .env.nas');
    console.log('⚠️ 請重啟 Docker 服務以載入新配置');
    
    res.json({
      success: true,
      message: 'LINE 配置已儲存，請重啟 Docker 服務以載入新配置',
      needRestart: true,
      data: {
        tokenLength: lineChannelToken.length,
        tokenPreview: lineChannelToken.substring(0, 20) + '...',
        liffClientId: liffClientId || null
      }
    });
    
  } catch (error) {
    console.error('更新 LINE 配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新 LINE 配置失敗: ' + error.message
    });
  }
});

// ==================== LINE 配置 API 結束 ====================

// ==================== 特殊事件配置 API ====================

// 🔧 Helper：讀取特殊事件配置（統一入口，避免硬編碼）
function getSpecialEventsConfig() {
  const configPath = path.join(__dirname, 'special-events-config.json');
  
  if (!fs.existsSync(configPath)) {
    // 如果配置文件不存在，返回預設值
    const defaultConfig = {
      "停課": { enabled: true, keywords: ["停課", "取消", "暫停", "休息", "放假", "請假"] },
      "體驗": { enabled: true, keywords: ["體驗", "體驗課", "體驗班"] },
      "代課": { enabled: true, keywords: ["代課", "代理", "支援"] },
      "改時間": { enabled: true, keywords: ["調課", "延後", "提前", "改時間"] },
      "公告": { enabled: true, keywords: ["公告", "通知", "提醒"] }
    };
    
    console.log('⚠️ 特殊事件配置文件不存在，使用預設值');
    return { config: defaultConfig, isDefault: true };
  }
  
  try {
    const data = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(data);
    return { config, isDefault: false };
  } catch (error) {
    console.error('❌ 讀取特殊事件配置失敗:', error);
    throw error;
  }
}

// GET /api/special-events-config - 獲取特殊事件配置（管理後台使用）
app.get('/api/special-events-config', (req, res) => {
  try {
    const { config, isDefault } = getSpecialEventsConfig();
    console.log('✅ 成功載入特殊事件配置');
    
    res.json({
      success: true,
      data: config,
      isDefault: isDefault
    });
  } catch (error) {
    console.error('❌ 讀取特殊事件配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '讀取特殊事件配置失敗: ' + error.message
    });
  }
});
// POST /api/special-events-config - 更新特殊事件配置
app.post('/api/special-events-config', (req, res) => {
  try {
    const configPath = path.join(__dirname, 'special-events-config.json');
    const newConfig = req.body;
    
    // 驗證配置格式
    const requiredTypes = ['停課', '體驗', '代課', '改時間', '公告'];
    for (const type of requiredTypes) {
      if (!newConfig[type]) {
        return res.status(400).json({
          success: false,
          message: `缺少必要的事件類型：${type}`
        });
      }
      
      if (typeof newConfig[type].enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: `${type} 的 enabled 必須為布林值`
        });
      }
      
      if (!Array.isArray(newConfig[type].keywords)) {
        return res.status(400).json({
          success: false,
          message: `${type} 的 keywords 必須為陣列`
        });
      }
    }
    
    // 備份舊配置（如果存在）
    if (fs.existsSync(configPath)) {
      const backupPath = path.join(__dirname, `special-events-config.json.backup-${Date.now()}`);
      fs.copyFileSync(configPath, backupPath);
      console.log('✅ 已備份舊配置到:', backupPath);
    }
    
    // 寫入新配置
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
    
    console.log('✅ 特殊事件配置已更新');
    console.log('📋 新配置:', JSON.stringify(newConfig, null, 2));
    
    res.json({
      success: true,
      message: '特殊事件配置已更新',
      data: newConfig
    });
  } catch (error) {
    console.error('❌ 更新特殊事件配置失敗:', error);
    res.status(500).json({
      success: false,
      message: '更新特殊事件配置失敗: ' + error.message
    });
  }
});
// 🎯 GET /api/special-event-types - 獲取啟用的特殊事件類型（special-events-api-test.html 使用）
app.get('/api/special-event-types', (req, res) => {
  try {
    const { config } = getSpecialEventsConfig();
    // 嘗試從 flex-message-templates.json 讀取顏色，若失敗則使用預設值
    const templatesPath = path.join(__dirname, 'flex-message-templates.json');
    let specialEventColors = {
      '停課': '#dc3545',
      '體驗': '#FFD700',
      '代課': '#2196F3',
      '改時間': '#f59e0b',
      '公告': '#9333ea'
    };
    try {
      if (fs.existsSync(templatesPath)) {
        const templatesJson = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
        if (templatesJson && templatesJson.specialEventColors) {
          specialEventColors = Object.assign(specialEventColors, templatesJson.specialEventColors);
        }
      }
    } catch (e) {
      console.warn('⚠️ 無法讀取 flex-message-templates.json，將使用預設顏色');
    }

    // Emoji 對照（與通知系統一致）
    const emojiMap = {
      '停課': '🔴',
      '體驗': '🟢',
      '代課': '🔵',
      '改時間': '🟠',
      '公告': '🟣'
    };

    // 小工具：#RRGGBB 轉 rgba(r,g,b,a)
    const hexToRgba = (hex, alpha) => {
      if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
      let h = hex.replace('#', '');
      if (h.length === 3) {
        h = h.split('').map(c => c + c).join('');
      }
      const r = parseInt(h.substring(0, 2), 16);
      const g = parseInt(h.substring(2, 4), 16);
      const b = parseInt(h.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    };

    // 只返回啟用的事件類型，並補齊顏色、Emoji、外框寬度
    const enabledTypes = {};
    for (const [type, data] of Object.entries(config)) {
      if (!data.enabled) continue;

      const colorHex = specialEventColors[type] || '#999999';
      enabledTypes[type] = {
        enabled: true,
        keywords: data.keywords,
        color: colorHex,
        glowColor: hexToRgba(colorHex, 0.3),
        borderWidth: '3px',
        emoji: emojiMap[type] || ''
      };
    }

    console.log('✅ 返回啟用的特殊事件類型（含樣式）:', Object.keys(enabledTypes));

    res.json({
      success: true,
      data: enabledTypes,
      count: Object.keys(enabledTypes).length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ 獲取特殊事件類型失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取特殊事件類型失敗: ' + error.message
    });
  }
});

// 🔑 GET /api/special-event-keywords - 獲取所有關鍵字（special-events-api-test.html 使用）
app.get('/api/special-event-keywords', (req, res) => {
  try {
    const { config } = getSpecialEventsConfig();
    
    // 只返回啟用事件的關鍵字
    const keywords = {};
    for (const [type, data] of Object.entries(config)) {
      if (data.enabled) {
        keywords[type] = data.keywords;
      }
    }
    
    console.log('✅ 返回特殊事件關鍵字:', keywords);
    
    res.json({
      success: true,
      data: keywords
    });
  } catch (error) {
    console.error('❌ 獲取特殊事件關鍵字失敗:', error);
    res.status(500).json({
      success: false,
      message: '獲取特殊事件關鍵字失敗: ' + error.message
    });
  }
});

// 🔍 POST /api/detect-special-event - 偵測單一事件類型（special-events-api-test.html 使用）
app.post('/api/detect-special-event', (req, res) => {
  try {
    const { title } = req.body;
    
    if (!title) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：title'
      });
    }
    
    const { config } = getSpecialEventsConfig();
    
    // 使用 notification-manager 的偵測邏輯
    let detectedType = null;
    const titleLower = title.toLowerCase();
    
    for (const [type, data] of Object.entries(config)) {
      if (!data.enabled) continue;
      
      for (const keyword of data.keywords) {
        if (titleLower.includes(keyword.toLowerCase())) {
          detectedType = type;
          break;
        }
      }
      
      if (detectedType) break;
    }
    
    console.log(`🔍 偵測事件「${title}」=> ${detectedType || '正常課程'}`);
    
    res.json({
      success: true,
      data: {
        title: title,
        specialEventType: detectedType,
        isSpecialEvent: detectedType !== null
      }
    });
  } catch (error) {
    console.error('❌ 偵測特殊事件失敗:', error);
    res.status(500).json({
      success: false,
      message: '偵測特殊事件失敗: ' + error.message
    });
  }
});

// 📊 POST /api/detect-batch-events - 批量偵測事件類型（special-events-api-test.html 使用）
app.post('/api/detect-batch-events', (req, res) => {
  try {
    const { titles } = req.body;
    
    if (!Array.isArray(titles)) {
      return res.status(400).json({
        success: false,
        message: '參數 titles 必須是陣列'
      });
    }
    
    const { config } = getSpecialEventsConfig();
    
    const results = titles.map(title => {
      let detectedType = null;
      const titleLower = title.toLowerCase();
      
      for (const [type, data] of Object.entries(config)) {
        if (!data.enabled) continue;
        
        for (const keyword of data.keywords) {
          if (titleLower.includes(keyword.toLowerCase())) {
            detectedType = type;
            break;
          }
        }
        
        if (detectedType) break;
      }
      
      return {
        title: title,
        specialEventType: detectedType,
        isSpecialEvent: detectedType !== null
      };
    });
    
    const specialEventCount = results.filter(r => r.isSpecialEvent).length;
    
    console.log(`📊 批量偵測 ${titles.length} 個事件，發現 ${specialEventCount} 個特殊事件`);
    
    res.json({
      success: true,
      data: results,
      summary: {
        total: titles.length,
        specialEvents: specialEventCount,
        normalCourses: titles.length - specialEventCount
      }
    });
  } catch (error) {
    console.error('❌ 批量偵測特殊事件失敗:', error);
    res.status(500).json({
      success: false,
      message: '批量偵測特殊事件失敗: ' + error.message
    });
  }
});

// ==================== 特殊事件配置 API 結束 ====================

// ==================== Google API 配置 ====================
const googleApiConfigPath = path.join(__dirname, 'google-api-config.json');

// 獲取 Google API 設定
app.get('/api/google-api-config', (req, res) => {
  try {
    if (fs.existsSync(googleApiConfigPath)) {
      const config = JSON.parse(fs.readFileSync(googleApiConfigPath, 'utf8'));
      res.json({success: true, data: config});
    } else {
      res.json({success: true, data: {}});
    }
  } catch (error) {
    console.error('❌ 讀取 Google API 配置失敗:', error);
    res.status(500).json({success: false, message: error.message});
  }
});

// 儲存 Google API 設定
app.post('/api/google-api-config', (req, res) => {
  try {
    const config = req.body;
    fs.writeFileSync(googleApiConfigPath, JSON.stringify(config, null, 2));
    console.log('✅ Google API 配置已儲存:', config);
    res.json({success: true, message: '設定已儲存'});
  } catch (error) {
    console.error('❌ 儲存 Google API 配置失敗:', error);
    res.status(500).json({success: false, message: error.message});
  }
});

// ==================== 緩存管理 API ====================
// 清除事件快取
app.post('/api/events/clear-cache', (req, res) => {
  try {
    eventsCache.data = null;
    eventsCache.lastUpdate = null;
    console.log('✅ 事件快取已清除');
    res.json({success: true, message: '事件快取已清除'});
  } catch (error) {
    console.error('❌ 清除事件快取失敗:', error);
    res.status(500).json({success: false, message: error.message});
  }
});

// 清除所有快取
app.post('/api/cache/clear-all', (req, res) => {
  try {
    eventsCache.data = null;
    eventsCache.lastUpdate = null;
    
    // 清除 memoryDB 如果存在
    if (typeof memoryDB !== 'undefined' && memoryDB && typeof memoryDB.clear === 'function') {
      memoryDB.clear();
    }
    
    console.log('✅ 所有快取已清除');
    res.json({success: true, message: '所有快取已清除'});
  } catch (error) {
    console.error('❌ 清除快取失敗:', error);
    res.status(500).json({success: false, message: error.message});
  }
});

// ==================== 學習歷程上傳系統 ====================

// 學期判斷函數
// 🔥 使用統一的學期計算工具
function getCurrentSemester() {
  return getUnifiedSemester();
}

// 路徑生成函數（統一處理 relativePath / coursePeriod 差異）
function generateLearningPath(course, period, date, studentName = null, isOverview = false, coursePeriodAlt = null, relativePath = null, overviewFolder = '課程總覽') {
  const basePath = process.env.NODE_ENV === 'production'
    ? '/volume1/Fun Learn Bar/學習歷程 automatic'
    : path.join(__dirname, 'data', 'learning-portfolio');

  if (relativePath) {
    const normalized = path.normalize(String(relativePath)).replace(/^([.]{2,})(\\|\/|$)/g, '');
    let full = path.join(basePath, normalized);
    try {
      const segments = normalized.split(/\\|\//).filter(Boolean);
      const lastSeg = segments[segments.length - 1] || '';
      if (isOverview) {
        const target = overviewFolder || '課程總覽';
        if (lastSeg !== target) full = path.join(full, target);
      } else if (studentName) {
        if (lastSeg !== String(studentName)) full = path.join(full, studentName);
      }
    } catch (_) {}
    return full;
  }

  const semester = getCurrentSemester();
  const normalizedCoursePeriod = (function normalize(courseValue, periodValue) {
    if (coursePeriodAlt && String(coursePeriodAlt).trim().length) {
      // 🔥 清理 coursePeriodAlt 中的週次
      return cleanCourseName(String(coursePeriodAlt).trim());
    }
    // 🔥 先清理課程名稱中的週次
    const courseName = cleanCourseName(String(courseValue || '').trim());
    const pad4 = (s) => String(s || '').padStart(4, '0');
    try {
      let raw = String(periodValue || '').replace(/\s+/g, '').replace(/:/g, '');
      const match = raw.match(/^([日一二三四五六])?-?(\d{3,4})[-~–—]?(\d{3,4})$/);
      if (match) {
        const week = match[1] ? `${match[1]}-` : '';
        return `${courseName}-${week}${pad4(match[2])}-${pad4(match[3])}`;
      }
      return `${courseName}-${raw}`;
    } catch (err) {
      console.warn('⚠️ normalize course period 失敗:', err.message);
      return `${courseName}-${periodValue || ''}`;
    }
  })(course, period);

  let fullPath = path.join(basePath, semester, normalizedCoursePeriod, date);

  try {
    if (!fs.existsSync(fullPath)) {
      const alt = (function deriveAlt() {
        const cp = String(normalizedCoursePeriod || '');
        const withDash = cp.match(/^(.*?)-([日一二三四五六])-(\d{4}-\d{4})$/);
        if (withDash) {
          return path.join(basePath, semester, `${withDash[1]}-${withDash[2]}${withDash[3]}`, date);
        }
        const withoutDash = cp.match(/^(.*?)-([日一二三四五六])(\d{4}-\d{4})$/);
        if (withoutDash) {
          return path.join(basePath, semester, `${withoutDash[1]}-${withoutDash[2]}-${withoutDash[3]}`, date);
        }
        return null;
      })();
      if (alt && fs.existsSync(alt)) {
        fullPath = alt;
      }
    }
  } catch (_) {}

  if (isOverview) {
    fullPath = path.join(fullPath, overviewFolder || '課程總覽');
  } else if (studentName) {
    fullPath = path.join(fullPath, studentName);
  }

  return fullPath;
}

function isVideoFileName(name) {
  return VIDEO_EXT_REGEX.test(String(name || ''));
}

function isImageFileName(name) {
  return IMAGE_EXT_REGEX.test(String(name || ''));
}

function isGeneratedThumbnailName(name) {
  // 🔥 过滤所有缩图文件：.thumb.jpg（小缩图）和 .preview.jpg（预览图）
  return /\.(thumb|preview)\.(jpe?g|png|webp)$/i.test(String(name || ''));
}

function runFfmpeg(args) {
  return new Promise((resolve) => {
    if (ffmpegUnavailable) {
      const recovered = resolveFfmpegBinary(FFMPEG_BIN);
      if (recovered && recovered !== FFMPEG_BIN) {
        FFMPEG_BIN = recovered;
        ffmpegUnavailable = false;
      } else {
        return resolve(false);
      }
    }
    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'ignore'] });
    let settled = false;
    proc.on('error', () => {
      const fallback = resolveFfmpegBinary(null);
      if (fallback && fallback !== FFMPEG_BIN) {
        FFMPEG_BIN = fallback;
        ffmpegUnavailable = false;
      } else {
        ffmpegUnavailable = true;
      }
      if (!settled) { settled = true; resolve(false); }
    });
    proc.on('close', (code) => {
      if (!settled) {
        settled = true;
        resolve(code === 0);
      }
    });
  });
}

async function generateThumbnailWithFfmpeg(videoPath, thumbPath) {
  if (ffmpegUnavailable) return false;
  const sceneArgs = ['-y', '-i', videoPath, '-vf', "select=gt(scene\\,0.28),scale=360:-1", '-frames:v', '1', thumbPath];
  const fallbackArgs = ['-y', '-ss', '1.5', '-i', videoPath, '-vf', 'scale=360:-1', '-frames:v', '1', thumbPath];
  const earlyArgs = ['-y', '-ss', '0.25', '-i', videoPath, '-vf', 'scale=360:-1', '-frames:v', '1', thumbPath];

  const validate = () => {
    try {
      const stat = fs.statSync(thumbPath);
      return stat && stat.size > 1500;
    } catch (e) {
      return false;
    }
  };

  if (await runFfmpeg(sceneArgs) && validate()) return true;
  if (await runFfmpeg(fallbackArgs) && validate()) return true;
  if (await runFfmpeg(earlyArgs) && validate()) return true;
  return validate();
}

async function ensureVideoThumbnail(videoPath) {
  return thumbnailQueue.push(() => ensureVideoThumbnailInternal(videoPath));
}

async function ensureVideoThumbnailInternal(videoPath) {
  try {
    if (!videoPath || !fs.existsSync(videoPath) || !isVideoFileName(videoPath)) return null;
    const dir = path.dirname(videoPath);
    const ext = path.extname(videoPath);
    const base = path.basename(videoPath, ext);
    const thumbName = `${base}.thumb.jpg`;
    const thumbPath = path.join(dir, thumbName);
    let lastMtime = null;
    try {
      const stats = fs.statSync(videoPath);
      lastMtime = stats.mtimeMs;
      const cached = thumbnailMetadataCache.get(videoPath);
      if (cached && cached.mtimeMs === lastMtime) {
        const cachedThumb = cached.thumbName;
        if (cachedThumb && fs.existsSync(path.join(dir, cachedThumb))) {
          return cachedThumb;
        }
      }
      const stat = fs.statSync(thumbPath);
      if (stat && stat.size > 1500) return thumbName;
    } catch (e) { /* not exists */ }

    if (ffmpegUnavailable || thumbnailFailureCache.has(videoPath)) return fs.existsSync(thumbPath) ? thumbName : null;

    const generated = await generateThumbnailWithFfmpeg(videoPath, thumbPath);
    if (!generated) {
      thumbnailFailureCache.add(videoPath);
      try { if (fs.existsSync(thumbPath) && fs.statSync(thumbPath).size < 1500) fs.unlinkSync(thumbPath); } catch (_) {}
      return null;
    }
    if (lastMtime == null) {
      try { lastMtime = fs.statSync(videoPath).mtimeMs; } catch (_) {}
    }
    thumbnailMetadataCache.set(videoPath, { mtimeMs: lastMtime, thumbName });
    return thumbName;
  } catch (err) {
    console.warn('⚠️ 產生影片縮圖失敗:', err.message);
    return null;
  }
}

async function ensureThumbnailsForList(dirPath, fileList) {
  const map = {};
  for (const name of fileList) {
    try {
      const full = path.join(dirPath, name);
      const thumb = await ensureVideoThumbnail(full);
      if (thumb) map[name] = thumb;
    } catch (e) {}
  }
  return map;
}

// 🔄 配置 multer 存儲（2025-11-08 改用 memory storage + Drive API）
// 註解：不再直接寫入本地磁碟，而是先存到記憶體，再由 API 處理後上傳到 Drive
const storage = multer.memoryStorage();

// 文件過濾器
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/avi'];
  
  // 🔥 判斷是照片還是影片字段
  const isPhotoField = file.fieldname === 'photos' || file.fieldname === 'overviewPhotos';
  const isVideoField = file.fieldname === 'videos' || file.fieldname === 'overviewVideos';
  
  if (isPhotoField) {
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.warn('⚠️ [文件過濾] 不支援的圖片格式:', file.mimetype, '檔名:', file.originalname);
      cb(new Error(`不支援的圖片格式: ${file.mimetype}`), false);
    }
  } else if (isVideoField) {
    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      console.warn('⚠️ [文件過濾] 不支援的影片格式:', file.mimetype, '檔名:', file.originalname);
      cb(new Error(`不支援的影片格式: ${file.mimetype}`), false);
    }
  } else {
    // 其他字段（如 metadata）允許通過
    cb(null, true);
  }
};

function normalizeCourseId(event) {
  if (!event) return null;
  return event.id || event.uid || event.evt_id || event._raw?.uid || event._raw?.evt_id || null;
}

function parseMetadataInput(raw) {
  if (!raw) return metadataTransformer.getEmptyMetadata();
  
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.warn('⚠️ 解析 metadata 失敗，使用空物件:', error.message);
      return metadataTransformer.getEmptyMetadata();
    }
  }
  
  // 🔥 使用 MetadataTransformer 標準化 metadata
  return metadataTransformer.normalize(parsed);
}

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 600 * 1024 * 1024 // 600MB（增加限制以支援更大型影片）
  }
});

const mediaChunkTempDir = path.join(__dirname, 'data', 'media-temp');
try {
  if (!fs.existsSync(mediaChunkTempDir)) {
    fs.mkdirSync(mediaChunkTempDir, { recursive: true });
  }
} catch (err) {
  console.error('⚠️ 建立媒體暫存目錄失敗:', err);
}
const mediaChunkUpload = multer({
  dest: mediaChunkTempDir,
  limits: {
    fileSize: Number(process.env.MEDIA_CHUNK_MAX_SIZE || 200 * 1024 * 1024)
  }
});

const driveChunkTempDir = path.join(__dirname, 'data', 'drive-media-temp');
try {
  if (!fs.existsSync(driveChunkTempDir)) {
    fs.mkdirSync(driveChunkTempDir, { recursive: true });
  }
} catch (err) {
  console.error('⚠️ 建立 Drive 分片暫存目錄失敗:', err);
}
const driveChunkRegistry = new MediaSessionRegistry(driveChunkTempDir);
driveChunkRegistry.startCleanup();

// ==================== Drive Upload 背景 Worker ====================

const ENABLE_DRIVE_UPLOAD_WORKER = process.env.ENABLE_DRIVE_UPLOAD_WORKER !== 'false';

async function processDriveUploadJobs() {
  try {
    const maxConcurrent = 1; // 先保守一次處理一個 Job，避免壓力過大
    const jobs = await driveUploadQueue.getPendingJobs(maxConcurrent);
    if (!jobs || jobs.length === 0) {
      return;
    }

    for (const job of jobs) {
      console.log('📝 [DriveUploadWorker] 處理 Job 開始:', {
        id: job.id,
        localPath: job.localPath,
        semester: job.semester,
        courseName: job.courseName,
        date: job.date,
        studentName: job.studentName,
        isOverview: job.isOverview,
        attempts: job.attempts,
      });

      await driveUploadQueue.updateJob(job.id, { status: 'processing' });

      try {
        const result = await learningUploadHelper.uploadMediaFromLocalFile({
          localPath: job.localPath,
          originalName: job.originalName,
          mimeType: job.mimeType || 'application/octet-stream',
          mediaCategory: job.mediaCategory || 'auto',
          semester: job.semester,
          courseName: job.courseName,
          date: job.date,
          topic: job.topic,
          studentName: job.studentName,
          isOverview: job.isOverview,
        });

        const mediaId = (result.mediaEntry && result.mediaEntry.id) ||
          `drive-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;

        await driveMediaIndex.appendRecord({
          id: mediaId,
          drivePath: result.remotePath,
          proxyUrl: result.proxyUrl,
          mimeType: result.mimeType,
          size: result.size,
          storage: 'drive',
          courseName: job.courseName,
          studentName: job.studentName,
          dateKey: job.date,
          isOverview: job.isOverview,
          uploadedAt: Date.now(),
        });

        await driveUploadQueue.markJobDone(job.id, {
          mediaId,
          proxyUrl: result.proxyUrl,
        });

        // 清理本地合併檔案
        if (job.localPath) {
          fs.unlink(job.localPath, (err) => {
            if (err && err.code !== 'ENOENT') {
              console.error('⚠️ [DriveUploadWorker] 清理本地合併檔案失敗:', {
                localPath: job.localPath,
                message: err.message,
              });
            }
          });
        }

        console.log('✅ [DriveUploadWorker] Job 完成:', {
          id: job.id,
          mediaId,
          drivePath: result.remotePath,
        });
      } catch (workerError) {
        await driveUploadQueue.markJobError(job.id, {
          message: workerError && workerError.message,
        });
      }
    }
  } catch (e) {
    console.error('❌ [DriveUploadWorker] 處理 Job 失敗:', e);
  }
}

if (ENABLE_DRIVE_UPLOAD_WORKER) {
  const intervalMs = Number(process.env.DRIVE_UPLOAD_WORKER_INTERVAL_MS || 5000);
  console.log('🚀 [DriveUploadWorker] 已啟用，輪詢間隔(ms):', intervalMs);
  const timer = setInterval(() => {
    processDriveUploadJobs().catch((err) => {
      console.error('❌ [DriveUploadWorker] 執行錯誤:', err);
    });
  }, intervalMs);
  timer.unref?.();
} else {
  console.log('⏸ [DriveUploadWorker] 已停用（ENABLE_DRIVE_UPLOAD_WORKER=false）');
}
// API: 獲取今天已結束的課程列表
app.get('/api/learning-records/today-completed-courses', async (req, res) => {
  try {
    const { eventId, date, range, instructor, cache } = req.query;
    const useCache = cache !== 'false'; // 預設使用快取，?cache=false 可強制即時抓取
    console.log('📚 獲取學習歷程課程列表...', { eventId, date, range, instructor, cache: useCache });

    // 決定查詢日期範圍
    const now = new Date();
    const requestedDate = date ? new Date(date) : null;
    const targetDate = !requestedDate || Number.isNaN(requestedDate.getTime()) ? new Date(now) : requestedDate;
    targetDate.setHours(0, 0, 0, 0);

    let startDate = new Date(targetDate);
    let endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);
    let effectiveRange = 'day';

    if (range === 'week') {
      effectiveRange = 'week';
      const dayOfWeek = targetDate.getDay();
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      startDate = new Date(targetDate);
      startDate.setDate(targetDate.getDate() + diffToMonday);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);
    }

    console.log('📅 查詢日期範圍:', {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      effectiveRange
    });

    // 🔥 先嘗試使用快取（與 /api/events 共用）
    // 若快取不可用或未涵蓋，才回源 CalDAV
    let events = [];

    // 區域範圍判定函式（供快取與回源共用）
    const isEventWithinRange = (event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      if (effectiveRange === 'week') {
        return eventStart <= endDate && eventEnd >= startDate;
      }
      return eventStart >= startDate && eventStart <= endDate;
    };

    let eventsSource = 'none';

    if (useCache && eventsCache && eventsCache.data && Array.isArray(eventsCache.data.events)) {
      const cachedEvents = eventsCache.data.events;
      // 先以日期範圍過濾
      let inRange = cachedEvents.filter(isEventWithinRange);
      // 若有講師參數，先在快取中做初步講師過濾以降低資料量（最終仍會有正式講師篩選）
      if (instructor) {
        const targetInstructor = instructor.trim().toUpperCase();
        inRange = inRange.filter(evt => {
          const courseInstructor = (evt.instructor || '').trim().toUpperCase();
          return courseInstructor === targetInstructor ||
                 courseInstructor.includes(targetInstructor) ||
                 targetInstructor.includes(courseInstructor);
        });
      }
      if (inRange.length > 0) {
        events = inRange;
        eventsSource = 'cache';
        console.log('📦 使用事件快取，命中數量:', events.length);
      }
    }

    if (eventsSource !== 'cache') {
      if (!caldavClient) {
        console.warn('⚠️ CalDAV 客戶端未初始化，嘗試從 /api/events 獲取');
        const eventsResponse = await axios.get(`http://localhost:${PORT}/api/events`);
        if (eventsResponse.data.success && eventsResponse.data.events) {
          // 二次以範圍過濾
          events = eventsResponse.data.events.filter(isEventWithinRange);
          eventsSource = 'events-endpoint';
        }
      } else {
        // 從 CalDAV 直接獲取指定日期範圍的事件
        console.log('📅 從 CalDAV 獲取課程...');
        const rawEvents = await caldavClient.getAllInstructorEvents(startDate, endDate);
        // 轉換為前端格式
        events = rawEvents.map(event => ({
          id: event.uid || event.evt_id || event.id,
          title: event.title || event.summary,
          instructor: event.instructor,
          start: event.start,
          end: event.end,
          type: event.type || 'other',
          description: event.description || '',
          location: event.location || '',
          time: event.time || '',
          lessonUrl: event.lessonUrl || '',
          _raw: {
            uid: event.uid,
            evt_id: event.evt_id,
            calendarId: event.calendarId
          }
        }));
        eventsSource = 'caldav';
        console.log('✅ 從 CalDAV 獲取到', events.length, '個課程');
      }
    }

    function normalizeCourseId(event) {
      if (!event) return null;
      return event.id || event.uid || event.evt_id || event._raw?.uid || event._raw?.evt_id || null;
    }

    const targetEventId = eventId || null;
    const matchedEvent = targetEventId
      ? events.find(event => {
          const possibleIds = [
            event.id,
            event.uid,
            event.evt_id,
            event._raw?.uid,
            event._raw?.evt_id
          ].filter(Boolean);
          return possibleIds.some(idValue => idValue === targetEventId);
        })
      : null;

    const isWithinRange = (event) => {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);

      if (effectiveRange === 'week') {
        return eventStart <= endDate && eventEnd >= startDate;
      }

      return eventStart >= startDate && eventStart <= endDate;
    };

    const filteredByRange = events.filter(event => isWithinRange(event));

    // 將匹配的事件加入集合避免重複
    const eventMap = new Map();
    const addEventToMap = event => {
      if (!event) return;
      const key = normalizeCourseId(event) || `${event.title}-${event.start}`;
      if (!eventMap.has(key)) {
        eventMap.set(key, event);
      }
    };

    filteredByRange.forEach(addEventToMap);
    addEventToMap(matchedEvent);

    const combinedEvents = Array.from(eventMap.values()).sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });

    console.log('✅ 找到符合篩選的課程數量:', combinedEvents.length);

    // 讀取學生資料
    const studentDataPath = path.join(__dirname, 'public', 'student_data.json');
    let studentData = { students: [] };
    if (fs.existsSync(studentDataPath)) {
      studentData = JSON.parse(fs.readFileSync(studentDataPath, 'utf8'));
    }

    // 讀取講師顏色
    const teacherDataPath = path.join(__dirname, 'teacher_data.json');
    const teacherColorMap = {};
    if (fs.existsSync(teacherDataPath)) {
      try {
        const teacherRaw = JSON.parse(fs.readFileSync(teacherDataPath, 'utf8'));
        let teachers = [];
        if (Array.isArray(teacherRaw.teachers)) {
          teachers = teacherRaw.teachers;
        } else if (teacherRaw.teachers && typeof teacherRaw.teachers === 'object') {
          teachers = Object.entries(teacherRaw.teachers).map(([name, value]) => {
            if (typeof value === 'object') {
              return { name, ...value };
            }
            return { name, userId: value };
          });
        }

        teachers.forEach(teacher => {
          if (teacher.name) {
            teacherColorMap[teacher.name.toUpperCase()] = teacher.color || null;
          }
        });
      } catch (teacherError) {
        console.warn('⚠️ 讀取講師顏色失敗:', teacherError);
      }
    }

    const formatTimeRange = (startDateTime, endDateTime) => {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      const pad = value => value.toString().padStart(2, '0');
      return `${pad(start.getHours())}:${pad(start.getMinutes())} - ${pad(end.getHours())}:${pad(end.getMinutes())}`;
    };

    const determineStatus = (startDateTime, endDateTime) => {
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      if (end < now) return 'completed';
      if (start > now) return 'upcoming';
      return 'ongoing';
    };

    // 🔥 引入共用的課程匹配邏輯模組
    const CourseStudentMatcher = require('./public/js/modules/course-student-matcher.js');
    
    // 🔥 輔助函數：從課程標題提取時段資訊
    const extractPeriodFromTitle = (title, start, end) => {
      // 從開始和結束時間提取時段（例如 "日 1000-1200"）
      // ⚠️ 注意：CalDAV 返回的時間字串沒有時區資訊（如 "2025-10-19T10:00:00"）
      // JavaScript 會將其視為本地時間或 UTC 時間（取決於運行環境）
      // 我們需要將其解析為台灣時間（UTC+8）
      
      let startDate, endDate;
      
      // 檢查時間字串是否包含時區資訊
      if (typeof start === 'string' && !start.includes('Z') && !start.includes('+') && !start.includes('-', 10)) {
        // 沒有時區資訊，手動加上 +08:00 (台灣時區)
        startDate = new Date(start + '+08:00');
        endDate = new Date(end + '+08:00');
      } else {
        // 已經包含時區資訊，直接解析
        startDate = new Date(start);
        endDate = new Date(end);
      }
      
      // 星期對應（使用本地時間方法，因為我們已經處理了時區）
      const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
      const weekday = weekdays[startDate.getDay()];
      
      // 時間格式化（HHMM）- 使用本地時間方法
      const pad = (num) => String(num).padStart(2, '0');
      const startTime = `${pad(startDate.getHours())}${pad(startDate.getMinutes())}`;
      const endTime = `${pad(endDate.getHours())}${pad(endDate.getMinutes())}`;
      
      return `${weekday} ${startTime}-${endTime}`;
    };
    
    // 🔥 後端不再做學生篩選，只返回課程資料和元數據
    // 學生篩選完全由前端使用共用的 student-filter.js 來處理
    const coursesWithMetadata = combinedEvents.map(course => {
      const courseTitle = course.title || '';
      
      // 🔥 使用共用模組提取課程名稱
      const courseName = CourseStudentMatcher.extractCourseName(courseTitle);
      
      const courseStart = new Date(course.start);
      const dateKey = courseStart.toISOString().split('T')[0];

      const status = determineStatus(course.start, course.end);
      const instructorName = (course.instructor || '').toUpperCase();
      const instructorColor = teacherColorMap[instructorName] || null;

      // 🔥 提取課程時段（用於前端篩選）
      const coursePeriod = extractPeriodFromTitle(courseTitle, course.start, course.end);

      console.log('📚 課程資料:', {
        eventId: course.id || course.uid || course.evt_id,
        courseTitle,
        extractedCourseName: courseName,
        extractedPeriod: coursePeriod
      });

      return {
        ...course,
        id: normalizeCourseId(course) || `${courseName}-${courseStart.getTime()}`,
        courseName,
        coursePeriod,  // 🔥 加入課程時段供前端使用
        dateKey,
        status,
        isCompleted: status === 'completed',
        timeRange: formatTimeRange(course.start, course.end),
        instructorColor
      };
    });

    // 🔥 根據 instructor 參數篩選課程
    let filteredCourses = coursesWithMetadata;
    if (instructor) {
      const targetInstructor = instructor.trim().toUpperCase();
      filteredCourses = coursesWithMetadata.filter(course => {
        const courseInstructor = (course.instructor || '').trim().toUpperCase();
        // 支援部分匹配和完全匹配
        const exactMatch = courseInstructor === targetInstructor;
        const partialMatch = courseInstructor.includes(targetInstructor) || targetInstructor.includes(courseInstructor);
        return exactMatch || partialMatch;
      });
      
      console.log('👨‍🏫 講師篩選結果:', {
        instructor: targetInstructor,
        originalCount: coursesWithMetadata.length,
        filteredCount: filteredCourses.length
      });
    }

    res.json({
      success: true,
      filters: {
        range: effectiveRange,
        date: targetDate.toISOString().split('T')[0],
        requestedEventId: targetEventId,
        instructor: instructor || null,
        today: now.toISOString().split('T')[0]
      },
      meta: {
        total: filteredCourses.length,
        highlightEventId: normalizeCourseId(matchedEvent)
      },
      courses: filteredCourses
    });
  } catch (error) {
    console.error('❌ 獲取學習歷程課程列表失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 新版媒體 API（支持照片和影片）====================

const DRIVE_PHOTO_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp', '.avif']);

function determineMediaCategory(fileType, filename) {
  if (fileType && /^image\//i.test(fileType)) return 'photo';
  if (fileType && /^video\//i.test(fileType)) return 'video';
  const ext = path.extname(filename || '').toLowerCase();
  if (DRIVE_PHOTO_EXT.has(ext)) return 'photo';
  return 'video';
}

function formatDriveMediaRecord(record) {
  if (!record) return null;
  return {
    id: record.id,
    storage: 'drive',
    drivePath: record.drivePath,
    proxyUrl: record.proxyUrl,
    mimeType: record.mimeType,
    fileSize: record.size,
    studentName: record.studentName || null,
    courseName: record.courseName || null,
    dateKey: record.dateKey || null,
    isOverview: !!record.isOverview,
    uploadedAt: record.uploadedAt || null
  };
}

function normalizeRelativePathValue(input) {
  if (!input) return '';
  return String(input).replace(/\\/g, '/').replace(/^\/+/, '').trim();
}

function resolveDriveContext(metadata = {}) {
  try {
    const parsed = learningUploadHelper.parseUploadParams(metadata || {});
    return {
      semester: parsed.semester,
      courseName: parsed.courseName,
      date: parsed.date,
      topic: parsed.topic,
      studentName: parsed.studentName,
      isOverview: parsed.isOverview
    };
  } catch (err) {
    const relative = normalizeRelativePathValue(metadata.relativePathUnified || metadata.relativePath);
    const parts = relative ? relative.split('/').filter(Boolean) : [];
    let semester = (metadata.semester && String(metadata.semester).trim())
      || sanitizeSemesterInput(parts[0])
      || getCurrentSemester();
    let courseName = metadata.coursePeriod || metadata.courseName || parts[parts.length >= 2 ? 1 : 0] || '未命名課程';
    let dateSegment = parts.length >= 3 ? parts[2] : (metadata.dateKey || metadata.date || '');
    let studentSegment = parts.length >= 4 ? parts[3] : metadata.studentName || '';

    let date = metadata.dateKey || metadata.date || '';
    let topic = metadata.topic || '';
    if (dateSegment) {
      const match = dateSegment.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/);
      if (match) {
        date = date || match[1];
        topic = topic || match[2] || '';
      } else if (!date) {
        date = dateSegment;
      }
    }
    if (!date) {
      const now = new Date();
      date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    const isOverview = metadata.mode === 'overview' || studentSegment === '課程總覽';
    const studentName = isOverview ? null : (studentSegment || metadata.studentName || '');

    if (isOverview && (!topic || String(topic).trim().length === 0)) {
      try {
        topic = drivePathManager.deriveTopicFromCourseName(courseName) || '課程';
      } catch (_) {}
    }

    return {
      semester,
      courseName,
      date,
      topic,
      studentName,
      isOverview
    };
  }
}

async function mergeDriveChunks(session) {
  if (!session) {
    throw new Error('上傳會話不存在');
  }
  const mergedPath = path.join(session.tempDir, `merged-${Date.now()}`);
  await fs.promises.mkdir(session.tempDir, { recursive: true });
  const writeStream = fs.createWriteStream(mergedPath);

  for (let i = 0; i < session.totalChunks; i++) {
    const chunkPath = path.join(session.tempDir, `chunk_${i}`);
    const data = await fs.promises.readFile(chunkPath);
    writeStream.write(data);
  }

  await new Promise((resolve, reject) => {
    writeStream.end();
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  return mergedPath;
}

const LEGACY_MEDIA_API_MESSAGE = 'Legacy media API 已停止服務，請改用 /api/drive-upload/* 或 /api/drive-media/*';

function respondLegacyMediaApi(req, res) {
  if (req && req.file && req.file.path) {
    fs.unlink(req.file.path, () => {});
  }
  return res.status(410).json({
    success: false,
    message: LEGACY_MEDIA_API_MESSAGE
  });
}

async function handleDriveUploadInit(req, res) {
  if (!ensureDriveServicesReady(res)) return;
  try {
    const payload = req.body || {};
    const filename = String(payload.filename || '').trim();
    const fileSize = Number(payload.fileSize || 0);
    const chunkSize = Number(payload.chunkSize || 6 * 1024 * 1024); // 預設 6MB

    if (!filename) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：filename'
      });
    }

    // 對於空檔案或小檔案，允許 fileSize = 0 或很小
    if (fileSize < 0) {
      return res.status(400).json({
        success: false,
        message: '檔案大小不能為負數'
      });
    }

    // 如果檔案大小為 0，將其作為單一分片處理
    const effectiveChunkSize = fileSize === 0 ? 1 : chunkSize;

    if (fileSize > Number(process.env.MEDIA_FILE_MAX_SIZE || 2 * 1024 * 1024 * 1024)) {
      return res.status(400).json({
        success: false,
        message: '檔案過大，請分割或壓縮後再上傳'
      });
    }

    const metadata = parseMetadataInput(payload.metadata);

    const session = await driveChunkRegistry.createSession({
      filename,
      fileSize,
      chunkSize: effectiveChunkSize,  // 使用調整後的分片大小
      fileType: payload.fileType || 'application/octet-stream',
      metadata,
      expireMs: Number(payload.expireMs || 0) || undefined
    });

    res.json({
      success: true,
      uploadId: session.uploadId,
      totalChunks: session.totalChunks,
      chunkSize: session.chunkSize,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    console.error('❌ Drive 分片初始化失敗:', error);
    res.status(500).json({
      success: false,
      message: '媒體上傳初始化失敗',
      error: error.message
    });
  }
}

async function handleDriveUploadChunk(req, res) {
  let tempPath = req.file?.path || null;
  try {
    const { uploadId, chunkIndex } = req.body || {};
    if (!uploadId || chunkIndex === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：uploadId、chunkIndex'
      });
    }

    if (!req.file || !req.file.path) {
      return res.status(400).json({
        success: false,
        message: '未收到檔案分片'
      });
    }

    const session = driveChunkRegistry.getSession(uploadId);
    if (!session) {
      return res.status(404).json({ success: false, message: '上傳會話不存在或已過期' });
    }

    await fs.promises.mkdir(session.tempDir, { recursive: true });
    const finalChunkPath = path.join(session.tempDir, `chunk_${chunkIndex}`);
    await fs.promises.rename(req.file.path, finalChunkPath);
    tempPath = null;
    session.receivedChunks.add(Number(chunkIndex));

    const percentage = session.totalChunks > 0
      ? Math.round((session.receivedChunks.size / session.totalChunks) * 100)
      : 0;

    res.json({
      success: true,
      receivedChunks: session.receivedChunks.size,
      totalChunks: session.totalChunks,
      progress: percentage
    });
  } catch (error) {
    console.error('❌ Drive 分片上傳失敗:', error);
    res.status(500).json({
      success: false,
      message: '分片上傳失敗',
      error: error.message
    });
  } finally {
    if (tempPath) {
      // 直接嘗試刪除，如果檔案不存在會在 callback 中忽略錯誤
      fs.unlink(tempPath, (err) => {
        // 忽略錯誤，檔案可能已經被移動或不存在
        if (err && err.code !== 'ENOENT') {
          console.error('清理臨時檔案失敗:', err);
        }
      });
    }
  }
}

async function handleDriveUploadComplete(req, res) {
  if (!ensureDriveServicesReady(res)) return;
  const { uploadId, metadata } = req.body || {};
  if (!uploadId) {
    return res.status(400).json({ success: false, message: '缺少必要參數：uploadId' });
  }

  const session = driveChunkRegistry.getSession(uploadId);
  if (!session) {
    return res.status(404).json({ success: false, message: '上傳會話不存在或已過期' });
  }
  if (session.totalChunks > 0 && session.receivedChunks.size !== session.totalChunks) {
    return res.status(400).json({
      success: false,
      message: `分片不完整: 已接收 ${session.receivedChunks.size}/${session.totalChunks}`
    });
  }

  const mergedMetadata = { ...session.metadata, ...parseMetadataInput(metadata) };
  const context = resolveDriveContext(mergedMetadata);
  const missingFields = validateDriveContextFields(context);
  const providedRelativePath = normalizeRelativePathValue(mergedMetadata.relativePathUnified || mergedMetadata.relativePath || '');
  let canonicalRelativePath = '';
  let canonicalAbsolutePath = '';

  if (missingFields.length > 0) {
    logDrivePathDebug({
      stage: 'server:missing-context',
      uploadId,
      metadata: mergedMetadata,
      context,
      missingFields
    });
    return res.status(400).json({
      success: false,
      message: '缺少必要欄位: ' + missingFields.join(', ')
    });
  }

  try {
    canonicalAbsolutePath = context.isOverview
      ? drivePathManager.buildOverviewRecordPath(context.semester, context.courseName, context.date, context.topic)
      : drivePathManager.buildStudentRecordPath(context.semester, context.courseName, context.date, context.topic, context.studentName);
    const normalized = canonicalAbsolutePath.replace(drivePathManager.driveRoot || '', '') || '';
    canonicalRelativePath = normalized.replace(/^\/+/, '');
  } catch (canonicalErr) {
    logDrivePathDebug({
      stage: 'server:canonical-error',
      uploadId,
      error: canonicalErr.message,
      context
    });
  }

  logDrivePathDebug({
    stage: 'server:drive-context',
    uploadId,
    metadata: mergedMetadata,
    context,
    providedRelativePath,
    canonicalRelativePath
  });

  if (providedRelativePath && canonicalRelativePath && providedRelativePath !== canonicalRelativePath) {
    logDrivePathDebug({
      stage: 'server:path-mismatch',
      uploadId,
      providedRelativePath,
      canonicalRelativePath
    });
  }

  let mergedFilePath = null;

  try {
    mergedFilePath = await mergeDriveChunks(session);

    const jobPayload = {
      localPath: mergedFilePath,
      originalName: session.filename,
      mimeType: session.fileType || 'application/octet-stream',
      mediaCategory: determineMediaCategory(session.fileType, session.filename),
      semester: context.semester,
      courseName: context.courseName,
      date: context.date,
      topic: context.topic,
      studentName: context.studentName,
      isOverview: context.isOverview,
      relativePath: canonicalRelativePath || providedRelativePath || '',
    };

    const job = await driveUploadQueue.enqueueJob(jobPayload);

    // 移除 session，但保留 mergedFilePath 給 worker 使用
    await driveChunkRegistry.removeSession(uploadId, { skipFilesystemCleanup: true });

    return res.status(202).json({
      success: true,
      status: 'queued',
      uploadId,
      jobId: job.id,
    });
  } catch (error) {
    console.error('❌ Drive 分片合併或 Job 建立失敗:', error);
    return res.status(500).json({
      success: false,
      message: '分片合併或 Job 建立失敗',
      error: error.message,
    });
  } finally {
    // 若 mergedFilePath 尚未成功加入 Job，則在這裡清理
    if (!mergedFilePath) {
      await driveChunkRegistry.removeSession(uploadId);
    }
  }
}

app.post('/api/drive-upload/init', handleDriveUploadInit);
app.post('/api/drive-upload/chunk', mediaChunkUpload.single('chunk'), handleDriveUploadChunk);
app.post('/api/drive-upload/complete', handleDriveUploadComplete);

app.post('/api/media/videos/init', respondLegacyMediaApi);
app.post('/api/media/videos/chunk', respondLegacyMediaApi);
app.post('/api/media/videos/complete', respondLegacyMediaApi);
function matchesFilterField(value, expected) {
  if (!expected) return true;
  const actual = String(value || '').toLowerCase();
  const target = String(expected || '').toLowerCase();
  return actual.includes(target);
}

function filterDriveMediaRecord(record, filters) {
  if (!record) return false;
  if (filters.date && String(record.dateKey || '') !== String(filters.date)) return false;
  if (filters.course && !matchesFilterField(record.courseName, filters.course)) return false;
  if (filters.student && !matchesFilterField(record.studentName, filters.student)) return false;
  if (filters.instructor && !matchesFilterField(record.instructorName, filters.instructor)) return false;
  if (filters.courseId && !matchesFilterField(record.courseId, filters.courseId)) return false;
  if (filters.mode === 'overview' && !record.isOverview) return false;
  if (filters.mode === 'student' && record.isOverview) return false;
  return true;
}

app.get('/api/drive-media/records', async (req, res) => {
  try {
    const filters = {
      date: req.query.date,
      course: req.query.course,
      student: req.query.student,
      instructor: req.query.instructor,
      courseId: req.query.courseId,
      mode: req.query.mode
    };

    const driveItems = (await driveMediaIndex.listRecords())
      .map(formatDriveMediaRecord)
      .filter(Boolean)
      .filter((record) => filterDriveMediaRecord(record, filters));

    res.json({
      success: true,
      items: driveItems
    });
  } catch (error) {
    console.error('❌ Drive 媒體列表讀取失敗:', error);
    res.status(500).json({
      success: false,
      message: '媒體列表讀取失敗',
      error: error.message
    });
  }
});

app.get('/api/drive-media/records/:recordId', async (req, res) => {
  try {
    const driveRecord = await driveMediaIndex.findRecordById(req.params.recordId);
    if (!driveRecord) {
      return res.status(404).json({ success: false, message: '找不到媒體紀錄' });
    }
    return res.json({ success: true, record: formatDriveMediaRecord(driveRecord) });
  } catch (error) {
    console.error('❌ Drive 媒體紀錄取得失敗:', error);
    res.status(500).json({
      success: false,
      message: '媒體紀錄讀取失敗',
      error: error.message
    });
  }
});

app.get('/api/media/videos', respondLegacyMediaApi);
app.get('/api/media/videos/:recordId', respondLegacyMediaApi);
app.get('/api/media/videos/:recordId/download', respondLegacyMediaApi);
app.get('/api/media/videos/:recordId/thumbnail', respondLegacyMediaApi);

// ==================== 學習記錄純文字保存 API（媒體分離新架構）====================
// ==================== 學習記錄純文字保存 API（媒體分離新架構）====================

app.post('/api/learning-records/save', async (req, res) => {
  if (!ensureDriveServicesReady(res)) return;
  try {
    const {
      course,
      period,
      date,
      studentName,
      comment,
      mediaIds = [],
      isOverview,
      overviewSummary,
      coursePeriod,
      relativePath,
      overviewFolder,
      instructorName
    } = req.body || {};

    if (!date) {
      return res.status(400).json({ success: false, message: '缺少必要欄位: date' });
    }

    const context = resolveDriveContext({
      relativePath,
      coursePeriod: coursePeriod || course,
      courseName: course,
      dateKey: date,
      studentName,
      mode: isOverview ? 'overview' : 'student'
    });

    const basePath = context.isOverview
      ? drivePathManager.buildOverviewRecordPath(context.semester, context.courseName, context.date, context.topic)
      : drivePathManager.buildStudentRecordPath(context.semester, context.courseName, context.date, context.topic, context.studentName);

    await driveClient.ensureFolderExists(basePath);

    if (comment && comment.trim()) {
      const commentPath = drivePathManager.getCommentPath(basePath);
      await driveClient.uploadFile(Buffer.from(comment.trim(), 'utf-8'), commentPath, {
        contentType: 'text/plain',
        overwrite: true
      });
    }

    if (context.isOverview && overviewSummary && overviewSummary.trim()) {
      const summaryPath = drivePathManager.getOverviewPath(basePath);
      await driveClient.uploadFile(Buffer.from(overviewSummary.trim(), 'utf-8'), summaryPath, {
        contentType: 'text/plain',
        overwrite: true
      });
    }

    if (instructorName && instructorName.trim()) {
      const instructorPath = path.posix.join(basePath, 'instructor.txt');
      await driveClient.uploadFile(Buffer.from(instructorName.trim(), 'utf-8'), instructorPath, {
        contentType: 'text/plain',
        overwrite: true
      });
    }

    const mediaEntries = [];
    for (const id of mediaIds) {
      const record = await driveMediaIndex.findRecordById(id);
      if (record) {
        mediaEntries.push({
          id: record.id,
          fileName: path.basename(record.drivePath),
          proxyUrl: record.proxyUrl,
          size: record.size,
          mimeType: record.mimeType,
          type: determineMediaCategory(record.mimeType, record.drivePath)
        });
      }
    }

    const photos = mediaEntries
      .filter((entry) => entry.type === 'photo')
      .map((entry) => ({ fileName: entry.fileName, size: entry.size, proxyUrl: entry.proxyUrl, mimeType: entry.mimeType, mediaId: entry.id }));
    const videos = mediaEntries
      .filter((entry) => entry.type === 'video')
      .map((entry) => ({ fileName: entry.fileName, size: entry.size, proxyUrl: entry.proxyUrl, mimeType: entry.mimeType, mediaId: entry.id }));

    const recordMeta = {
      semester: context.semester,
      courseName: context.courseName,
      date: context.date,
      topic: context.topic,
      studentName: context.studentName,
      isOverview: context.isOverview,
      hasComment: !!(comment && comment.trim()),
      hasOverviewSummary: !!(context.isOverview && overviewSummary && overviewSummary.trim()),
      mediaIds,
      photos,
      videos,
      totalPhotos: photos.length,
      totalVideos: videos.length,
      updatedAt: new Date().toISOString(),
      overviewFolder: overviewFolder || '課程總覽'
    };

    const metaPath = drivePathManager.getRecordMetaPath(basePath);
    await driveClient.uploadFile(Buffer.from(JSON.stringify(recordMeta, null, 2), 'utf-8'), metaPath, {
      contentType: 'application/json',
      overwrite: true
    });

    const relativeDrivePath = basePath.startsWith(drivePathManager.driveRoot)
      ? basePath.slice(drivePathManager.driveRoot.length).replace(/^\/+/, '')
      : basePath;

    res.json({
      success: true,
      message: '學習記錄保存成功',
      data: {
        path: basePath,
        relativePath: relativeDrivePath,
        mediaCount: mediaIds.length,
        hasComment: recordMeta.hasComment,
        hasOverviewSummary: recordMeta.hasOverviewSummary
      }
    });
  } catch (error) {
    console.error('❌ 保存學習記錄失敗:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ==================== 🚀 Synology Drive 版本上傳 API（2025-11-08）====================

/**
 * 🔍 調試中間件：記錄上傳請求參數
 */
app.use('/api/learning-records/upload-drive', (req, res, next) => {
    // 只在 POST 請求時記錄
    if (req.method !== 'POST') {
        return next();
    }
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════════════════╗');
    console.log('║              🔍 調試：前端上傳請求參數                               ║');
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('📅 時間:', new Date().toLocaleString('zh-TW'));
    console.log('');
    console.log('📝 Body 參數:');
    console.log('  semester:', req.body?.semester);
    console.log('  courseName:', req.body?.courseName);
    console.log('  date:', req.body?.date);
    console.log('  topic:', req.body?.topic);
    console.log('  studentName:', req.body?.studentName);
    console.log('');
    console.log('🔄 相容參數（舊版）:');
    console.log('  course:', req.body?.course);
    console.log('  period:', req.body?.period);
    console.log('  coursePeriod:', req.body?.coursePeriod);
    console.log('  relativePath:', req.body?.relativePath);
    console.log('');
    
    // 如果 courseName 被截斷，標記警告
    if (req.body?.courseName && req.body.courseName.includes('1610') && !req.body.courseName.includes('1740')) {
        console.log('⚠️  警告：courseName 可能被截斷！');
        console.log('   收到:', req.body.courseName);
        console.log('   預期應包含完整時間範圍（如: 1610-1740）');
    }
    
    console.log('╚══════════════════════════════════════════════════════════════════════╝');
    console.log('');
    
    next();
});

/**
 * 🆕 Drive 版本學習記錄上傳 API
 * 
 * 用途：將學習記錄上傳到 Synology Drive（取代本地檔案系統）
 * 端點：POST /api/learning-records/upload-drive
 * 狀態：新版 API，與舊版並存
 */
app.post('/api/learning-records/upload-drive', upload.fields([
  { name: 'photos', maxCount: 50 },
  { name: 'videos', maxCount: 20 },
  { name: 'overviewPhotos', maxCount: 50 },
  { name: 'overviewVideos', maxCount: 20 }  // 🔥 新增：支援課程總覽影片
]), async (req, res) => {
  // 🔥 檢查 Synology Drive 客戶端是否已初始化
  if (!learningUploadHelper) {
    console.error('❌ [Drive 上傳] Synology Drive 客戶端未初始化');
    return res.status(503).json({
      success: false,
      error: 'Synology Drive 服務未配置，請檢查環境變數設置（SYNOLOGY_HOST 等）'
    });
  }
  
  try {
    const {
      semester,
      courseName,
      date,
      topic,
      studentName,
      comment,
      isOverview,
      overviewSummary,
      // 舊版相容參數
      course,
      period,
      coursePeriod,
      relativePath
    } = req.body;

    console.log('📤 [Drive 上傳] 接收上傳請求:', {
      semester,
      courseName,
      date,
      studentName: studentName || '課程總覽',
      isOverview,
      hasPhotos: !!req.files?.photos?.length || !!req.files?.overviewPhotos?.length,
      hasVideos: !!req.files?.videos?.length || !!req.files?.overviewVideos?.length
    });

    // 🔧 課程名稱映射表（修復前端截斷問題）
    const courseNameMapping = {
        'SPIKE 五 1610': 'SPIKE 五 1610-1740 松山',
        'SPIKE 五 16:10': 'SPIKE 五 16:10-17:40 松山',
        'ESM 四 1730': 'ESM 四 1730-1830 到府',
        'ESM 四 17:30': 'ESM 四 17:30-18:30 到府',
        'BOOST 六 1530': 'BOOST 六 1530-1700 到府',
        'BOOST 六 15:30': 'BOOST 六 15:30-17:00 到府',
    };
    
    // 🔄 向後相容：解析舊版參數
    let finalSemester = semester;
    let finalCourseName = courseName;
    let finalTopic = topic;
    
    // 🔧 修復截斷的課程名稱
    if (finalCourseName && courseNameMapping[finalCourseName]) {
        console.log('🔧 [課程名稱映射] 修復截斷名稱：', finalCourseName, '→', courseNameMapping[finalCourseName]);
        finalCourseName = courseNameMapping[finalCourseName];
    } else if (finalCourseName) {
        // 嘗試部分匹配
        for (const [shortName, fullName] of Object.entries(courseNameMapping)) {
            if (finalCourseName.startsWith(shortName)) {
                console.log('🔧 [課程名稱映射] 部分匹配修復：', finalCourseName, '→', fullName);
                finalCourseName = fullName;
                break;
            }
        }
    }

    if (!finalSemester || !finalCourseName) {
      // 嘗試從 coursePeriod 解析
      if (coursePeriod) {
        const parts = coursePeriod.split('/');
        if (parts.length >= 2) {
          finalSemester = parts[0];
          finalCourseName = parts.slice(1).join('/');
        }
      } else if (course && period) {
        // 使用 course + period（需要額外處理學期）
        finalSemester = '114-1'; // 預設值，實際應從系統設定獲取
        finalCourseName = `${course} ${period}`;
      }
    }

    // 驗證必要欄位
    if (!finalSemester || !finalCourseName || !date) {
            return res.status(400).json({ 
                success: false, 
        error: '缺少必要欄位: semester, courseName, date'
      });
    }

    const normalizedCourseName = courseNameCleaner.cleanCourseName(finalCourseName);
    const resolvedTopic = (learningUploadHelper && typeof learningUploadHelper._resolveTopicInput === 'function')
      ? learningUploadHelper._resolveTopicInput(finalTopic, normalizedCourseName)
      : (finalTopic || '課程');

    // 判斷是課程總覽還是學生記錄
    const isOverviewMode = isOverview === 'true' || isOverview === true;

    if (isOverviewMode) {
      // ==================== 課程總覽 ====================
      console.log('📋 [Drive 上傳] 處理課程總覽');

      // 🔥 支援多種字段名組合
      const photos = req.files?.overviewPhotos || req.files?.photos || [];
      const videos = req.files?.overviewVideos || req.files?.videos || [];
      // 🔥 兼容前端：comment 或 overviewSummary
      const summary = comment || overviewSummary || '';

      try {
        const result = await learningUploadHelper.uploadOverviewRecord({
          semester: finalSemester,
          courseName: normalizedCourseName,
          date,
          topic: resolvedTopic,
          photos,
          videos,
          summary
        });

        console.log('✅ [Drive 上傳] 課程總覽上傳成功');

        return res.json({
            success: true, 
          message: '課程總覽上傳成功',
          data: {
            basePath: result.basePath,
            photos: result.photos.length,
            videos: result.videos.length,
            summary: result.summary,
            topic: resolvedTopic,
            files: {
              photos: Array.isArray(result.photos) ? result.photos.map(p => ({
                name: p.fileName,
                url: p.proxyUrl,
                size: p.size
              })) : [],
              videos: Array.isArray(result.videos) ? result.videos.map(v => ({
                name: v.fileName,
                url: v.proxyUrl,
                size: v.size
              })) : []
            },
            metadata: result.metadata
          }
        });

    } catch (error) {
        console.error('❌ [Drive 上傳] 課程總覽上傳失敗:', error.message);
        return res.status(500).json({
            success: false, 
          error: error.message
        });
      }

      } else {
      // ==================== 學生記錄 ====================
      console.log('👤 [Drive 上傳] 處理學生記錄');

      if (!studentName) {
        return res.status(400).json({
          success: false,
          error: '缺少學生姓名'
        });
      }

      const photos = req.files?.photos || [];
      const videos = req.files?.videos || [];

      try {
        // 🔥 修復 2025-11-27：移除外部預處理，改用 learning-upload-helper 內部整合
        const result = await learningUploadHelper.uploadStudentRecord({
          semester: finalSemester,
          courseName: normalizedCourseName,
          date,
          topic: resolvedTopic,
          studentName,
          photos,
          videos,
          comment: comment || ''
        });

        console.log('✅ [Drive 上傳] 學生記錄上傳成功');

        return res.json({
        success: true,
        message: '學習記錄上傳成功',
          data: {
            basePath: result.basePath,
          studentName,
            photos: result.photos.length,
            videos: result.videos.length,
            comment: result.comment,
            topic: resolvedTopic,
          files: {
              photos: Array.isArray(result.photos) ? result.photos.map(p => ({
                name: p.fileName,
                url: p.proxyUrl,
                size: p.size
              })) : [],
              videos: Array.isArray(result.videos) ? result.videos.map(v => ({
                name: v.fileName,
                url: v.proxyUrl,
                size: v.size
              })) : []
            },
            metadata: result.metadata
          }
        });
    
  } catch (error) {
        console.error('❌ [Drive 上傳] 學生記錄上傳失敗:', error.message);
        
        // 門檻驗證錯誤使用 400
        if (error.message.includes('至少需要') || error.message.includes('評語')) {
      return res.status(400).json({
        success: false,
            error: error.message
      });
    }
    
        // 其他錯誤使用 500
        return res.status(500).json({
        success: false,
          error: '上傳失敗: ' + error.message
        });
      }
    }

  } catch (error) {
    console.error('❌ [Drive 上傳] 未預期的錯誤:', error);
    console.error('❌ [錯誤堆疊]:', error.stack);  // 🔥 新增：打印完整堆栈
    return res.status(500).json({
      success: false,
      error: '系統錯誤: ' + error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined  // 🔥 開發模式顯示堆棧
    });
  }
});

// ==================== Drive 歷史記錄查詢 API 🆕 ====================

/**
 * 查詢學習歷程記錄（從 Synology Drive）
 * GET /api/learning-records/history-drive?semester=114-1&courseName=XXX&date=2025-11-08
 */
app.get('/api/learning-records/history-drive', async (req, res) => {
  try {
    const { semester, courseName, date, course } = req.query;
    
    console.log('🔍 [Drive 歷史記錄] 查詢參數:', { semester, courseName, course, date });
    
    // 向後相容：course → courseName
    const finalCourseName = courseName || course;
    
    // 呼叫 helper 查詢記錄
    const records = await learningUploadHelper.listLearningRecords({
      semester,
      courseName: finalCourseName,
      date
    });
    
    // 為每個記錄的檔案生成代理 URL
    const recordsWithUrls = records.map(record => {
      const result = {
        ...record,
        photos: record.photos.map(photo => ({
          ...photo,
          url: `/api/drive-media${photo.path}`
        })),
        videos: record.videos.map(video => ({
          ...video,
          url: `/api/drive-media${video.path}`
        }))
      };
      
      // 🔍 調試：輸出每個記錄的詳細資訊
      console.log('🔍 [Drive 歷史記錄] 記錄詳情:', {
        studentName: record.studentName,
        isOverview: record.isOverview,
        recordPath: record.recordPath,
        photos數量: record.photos.length,
        videos數量: record.videos.length,
        photos前3個: record.photos.slice(0, 3).map(p => p.name),
        videos前3個: record.videos.slice(0, 3).map(v => v.name)
      });
      
      return result;
    });
    
    console.log('✅ [Drive 歷史記錄] 查詢成功，找到', recordsWithUrls.length, '筆記錄');
    
    return res.json({
      success: true,
      records: recordsWithUrls,
      count: recordsWithUrls.length,
      searchParams: {
        semester,
        courseName: finalCourseName,
        date
      }
    });
    
  } catch (error) {
    console.error('❌ [Drive 歷史記錄] 查詢失敗:', error.message);
    return res.status(500).json({
      success: false,
      error: '查詢失敗: ' + error.message
    });
  }
});

// ==================== 學習歷程集中索引 API ====================

/**
 * 讀取單堂課的學習歷程索引摘要（集中索引，不掃描 Drive）
 * GET /api/learning-records/index/course?semester=...&courseName=...&date=...[&topic=...]
 */
app.get('/api/learning-records/index/course', async (req, res) => {
  try {
    const { semester, courseName, date, topic } = req.query || {};

    if (!semester || !courseName || !date) {
      return res.status(400).json({
        success: false,
        message: '缺少必要參數：semester, courseName, date',
      });
    }

    const summary = await learningRecordsIndex.getCourseSummary({
      semester,
      courseName,
      date,
      topic,
    });

    return res.json({
      success: true,
      data: summary || null,
    });
  } catch (error) {
    console.error('❌ 讀取學習歷程索引（單堂課）失敗:', error);
    return res.status(500).json({
      success: false,
      message: error && error.message ? error.message : '讀取索引失敗',
    });
  }
});

/**
 * 讀取完整學習歷程集中索引（管理 / 除錯用）
 * GET /api/learning-records/index
 */
app.get('/api/learning-records/index', async (req, res) => {
  try {
    const index = await learningRecordsIndex.getFullIndex();
    return res.json({
      success: true,
      data: index,
    });
  } catch (error) {
    console.error('❌ 讀取完整學習歷程索引失敗:', error);
    return res.status(500).json({
      success: false,
      message: error && error.message ? error.message : '讀取索引失敗',
    });
  }
});

/**
 * 刪除學習記錄（從 Synology Drive）
 * DELETE /api/learning-records/drive/:recordPath
 */
app.delete('/api/learning-records/drive/*', async (req, res) => {
  try {
    // recordPath 從 URL 的 wildcard 部分獲取
    const recordPath = '/' + req.params[0];
    // fileName 從 query 參數獲取（如果有）
    const fileName = req.query.fileName || req.query.filename;
    
    console.log('🗑️  [Drive 刪除] 接收刪除請求:', { recordPath, fileName });
    
    // 驗證路徑格式
    if (!recordPath || recordPath === '/') {
      return res.status(400).json({
        success: false,
        error: '無效的記錄路徑'
      });
    }
    
    let result;
    
    if (fileName) {
      // 🔥 刪除單個文件
      console.log('📄 [Drive 刪除] 刪除單個文件:', fileName);
      result = await learningUploadHelper.deleteSingleFile(recordPath, fileName);
      console.log('✅ [Drive 刪除] 單個文件刪除成功');
      
      return res.json({
        success: true,
        message: '文件已刪除',
        data: result
      });
    } else {
      // 🗂️ 刪除整個記錄目錄
      console.log('🗂️  [Drive 刪除] 刪除整個記錄目錄');
      result = await learningUploadHelper.deleteLearningRecord(recordPath);
      console.log('✅ [Drive 刪除] 記錄目錄刪除成功');
      
      return res.json({
        success: true,
        message: '記錄已刪除',
        data: result
      });
    }
    
  } catch (error) {
    console.error('❌ [Drive 刪除] 刪除失敗:', error.message);
    
    // 安全錯誤使用 403
    if (error.message.includes('安全錯誤')) {
      return res.status(403).json({
        success: false,
        error: error.message
      });
    }
    
    // 其他錯誤使用 500
    return res.status(500).json({
      success: false,
      error: '刪除失敗: ' + error.message
    });
  }
});

/**
 * 批次刪除學習記錄（從 Synology Drive）
 * POST /api/learning-records/drive/batch-delete
 * Body: { recordPaths: ["/path1", "/path2", ...] }
 */
app.post('/api/learning-records/drive/batch-delete', async (req, res) => {
  try {
    const { recordPaths } = req.body;
    
    console.log('🗑️  [Drive 批次刪除] 接收刪除請求:', recordPaths?.length, '筆記錄');
    
    // 驗證參數
    if (!Array.isArray(recordPaths) || recordPaths.length === 0) {
      return res.status(400).json({
        success: false,
        error: '無效的參數：recordPaths 必須是非空陣列'
      });
    }
    
    // 呼叫 helper 批次刪除
    const results = await learningUploadHelper.deleteLearningRecordsBatch(recordPaths);
    
    const success = results.failed.length === 0;
    
    console.log(`${success ? '✅' : '⚠️'} [Drive 批次刪除] 完成:`, {
      total: results.total,
      success: results.success.length,
      failed: results.failed.length
    });
    
    return res.json({
      success: success,
      message: success 
        ? '所有記錄已刪除' 
        : `部分記錄刪除失敗 (${results.failed.length}/${results.total})`,
      data: results
    });
    
  } catch (error) {
    console.error('❌ [Drive 批次刪除] 刪除失敗:', error.message);
    return res.status(500).json({
      success: false,
      error: '批次刪除失敗: ' + error.message
    });
  }
});

// ==================== 舊版本上傳 API（保留向後相容）====================

// API: 上傳學習記錄（舊版，使用本地檔案系統）

// ==================== ✅ 舊版 Multer 直接上傳 API（已恢復） ====================


// API: 刪除學習記錄

// API: 取得學習記錄檔案（回傳檔案串流供預覽/下載）

// API: 更新學習記錄

// ==================== 學習歷程上傳系統結束 ====================

// ==================== Synology Drive 媒體代理 API（2025-11-08）====================

app.get('/api/media/photos/:photoId/preview', async (req, res) => {
    if (!ensureDriveServicesReady(res)) return;

    const { photoId } = req.params;
    if (!photoId) {
        return res.status(400).json({ success: false, message: '缺少 photoId' });
    }

    const recordPath = resolveDriveRecordPathFromQuery(req.query);
    if (!recordPath) {
        return res.status(400).json({
            success: false,
            message: '缺少必要參數：需要 coursePeriod/courseName、date 與 studentName'
        });
    }

    const photosMetaPath = path.posix.join(recordPath, 'photos-meta.json').replace(/\/+/g, '/');

    try {
        const photosMeta = await learningUploadHelper._readOptionalJson(photosMetaPath, {
            label: 'photos-meta.json',
            fallback: []
        });

        if (!Array.isArray(photosMeta) || photosMeta.length === 0) {
            return res.status(404).json({ success: false, message: '找不到照片元資料' });
        }

        const photo = photosMeta.find(entry => entry && entry.id === photoId);
        if (!photo) {
            return res.status(404).json({ success: false, message: '找不到對應的照片記錄' });
        }

        const candidates = [];
        if (photo.thumbnails && photo.thumbnails.medium) candidates.push(photo.thumbnails.medium);
        if (photo.thumbnails && photo.thumbnails.small) candidates.push(photo.thumbnails.small);
        if (photo.previewFilename) candidates.push(photo.previewFilename);
        if (photo.filename) candidates.push(photo.filename);

        if (candidates.length === 0) {
            return res.status(404).json({ success: false, message: '照片記錄缺少檔名資訊' });
        }

        let fileStream = null;
        let selectedFile = null;

        for (const candidate of candidates) {
            const driveFilePath = path.posix.join(recordPath, candidate).replace(/\/+/g, '/');
            try {
                const upstream = await driveClient.getFileStream(driveFilePath);
                fileStream = upstream.stream || upstream;
                selectedFile = candidate;
                break;
            } catch (error) {
                console.warn('⚠️ [photo-preview] 無法讀取文件, 嘗試下一個候選項目:', {
                    driveFilePath,
                    message: error.message
                });
            }
        }

        if (!fileStream) {
            return res.status(404).json({ success: false, message: '找不到可用的預覽檔案' });
        }

        const contentType = photo.mimeType || guessMimeTypeFromName(selectedFile, 'image/jpeg');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400');

        fileStream.on('error', (error) => {
            console.error('❌ [photo-preview] 串流錯誤:', error.message);
            if (!res.headersSent) {
                res.status(500).end();
            } else {
                res.destroy(error);
            }
        });

        fileStream.pipe(res);
    } catch (error) {
        console.error('❌ [photo-preview] 發生錯誤:', error.message);
        res.status(500).json({ success: false, message: '無法讀取照片預覽', error: error.message });
    }
});

app.get('/api/media/photos/:photoId/original', async (req, res) => {
    if (!ensureDriveServicesReady(res)) return;

    const { photoId } = req.params;
    if (!photoId) {
        return res.status(400).json({ success: false, message: '缺少 photoId' });
    }

    const recordPath = resolveDriveRecordPathFromQuery(req.query);
    if (!recordPath) {
        return res.status(400).json({
            success: false,
            message: '缺少必要參數：需要 coursePeriod/courseName、date 與 studentName'
        });
    }

    const photosMetaPath = path.posix.join(recordPath, 'photos-meta.json').replace(/\/+/g, '/');

    try {
        const photosMeta = await learningUploadHelper._readOptionalJson(photosMetaPath, {
            label: 'photos-meta.json',
            fallback: []
        });

        if (!Array.isArray(photosMeta) || photosMeta.length === 0) {
            return res.status(404).json({ success: false, message: '找不到照片元資料' });
        }

        const photo = photosMeta.find(entry => entry && entry.id === photoId);
        if (!photo || !photo.filename) {
            return res.status(404).json({ success: false, message: '找不到照片檔案資訊' });
        }

        const driveFilePath = path.posix.join(recordPath, photo.filename).replace(/\/+/g, '/');
        let fileStream;
        try {
            const upstream = await driveClient.getFileStream(driveFilePath);
            fileStream = upstream.stream || upstream;
        } catch (error) {
            console.error('❌ [photo-original] 讀取檔案失敗:', error.message);
            return res.status(404).json({ success: false, message: '找不到原始照片檔案' });
        }

        const fileNameForHeader = encodeURIComponent(photo.originalName || photo.filename);
        const contentType = photo.mimeType || guessMimeTypeFromName(photo.filename, 'image/jpeg');

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileNameForHeader}"`);
        res.setHeader('Cache-Control', 'public, max-age=86400');

        fileStream.on('error', (error) => {
            console.error('❌ [photo-original] 串流錯誤:', error.message);
            if (!res.headersSent) {
                res.status(500).end();
            } else {
                res.destroy(error);
            }
        });

        fileStream.pipe(res);
    } catch (error) {
        console.error('❌ [photo-original] 發生錯誤:', error.message);
        res.status(500).json({ success: false, message: '無法讀取原始照片', error: error.message });
    }
});

/**
 * 🔐 安全的 Drive 媒體代理端點
 * 
 * 用途：為前端提供安全的 Drive 檔案存取，不直接暴露 SID
 * 路徑格式：/api/drive-media/{drive_path}
 * 例如：/api/drive-media/Fun Learn Bar/FLB-Learning-Portfolio/114-1/SPIKE.../photo.jpg
 */
app.get('/api/drive-media/*', async (req, res) => {
    try {
        // 提取並解碼檔案路徑（移除前綴，避免 %20 等造成路徑判斷失敗）
        const rawPath = req.params[0] || '';
        const decoded = decodeURIComponent(rawPath);
        let filePath = '/' + decoded;
        
        console.log('📥 [Drive 代理] 請求檔案:', filePath);
        
        // 驗證路徑安全性（必須在 Drive 根目錄下）
        if (!drivePathManager.isInDriveRoot(filePath)) {
            // 向後相容：若路徑是類似 "/2025上學期/..."，視為相對於 Drive Root 的路徑
            const candidate = path.posix.join(drivePathManager.driveRoot, filePath.replace(/^\/+/, ''));
            if (drivePathManager.isInDriveRoot(candidate)) {
                console.warn('⚠️ [Drive 代理] 路徑缺少 Drive 根目錄，已自動補上:', {
                    original: filePath,
                    fixed: candidate,
                });
                filePath = candidate;
            } else {
                console.error('❌ [Drive 代理] 不安全的路徑:', filePath);
                return res.status(403).json({
                    success: false,
                    error: '無效的檔案路徑'
                });
            }
        }
        
        // Range 支援：瀏覽器影片預覽需要部分內容回應
        const rangeHeader = req.headers['range'];
        const upstream = await driveClient.getFileStream(filePath, {
            headers: rangeHeader ? { Range: rangeHeader } : undefined
        });
        const fileStream = upstream.stream || upstream; // 向後相容
        
        // 根據副檔名設定 Content-Type
        const ext = path.extname(filePath).toLowerCase();
        const contentTypeMap = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.mov': 'video/quicktime',
            '.webm': 'video/webm',
            '.avi': 'video/x-msvideo',
            '.json': 'application/json',
            '.txt': 'text/plain'
        };
        
        const contentType = contentTypeMap[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        // 告知可部分傳輸
        res.setHeader('Accept-Ranges', 'bytes');
        
        // 轉發上游 Range 回應頭（若有）
        try {
            const h = upstream.headers || {};
            if (h['content-range']) res.setHeader('Content-Range', h['content-range']);
            if (h['content-length']) res.setHeader('Content-Length', h['content-length']);
            if (h['accept-ranges']) res.setHeader('Accept-Ranges', h['accept-ranges']);
            // 若上游為 206，對應下游也使用 206
            if (upstream.status === 206) res.status(206);
        } catch (_) {}

        // 設定快取標頭（24小時）
        res.setHeader('Cache-Control', 'public, max-age=86400');
        
        // 串流傳輸檔案
        fileStream.pipe(res);
        
        console.log('✅ [Drive 代理] 檔案串流已建立:', filePath);
        
    } catch (error) {
        console.error('❌ [Drive 代理] 錯誤:', error.message);
        
        // 如果 SID 過期，嘗試重新認證後再試一次
        if (error.message && error.message.includes('error code 105')) {
            try {
                console.log('🔄 [Drive 代理] SID 過期，重新認證...');
                await driveClient.login();
                // 重試（保留 Range）
                const rawPath = req.params[0] || '';
                const decoded = decodeURIComponent(rawPath);
                const filePath = '/' + decoded;
                const rangeHeader = req.headers['range'];
                const upstream = await driveClient.getFileStream(filePath, { headers: rangeHeader ? { Range: rangeHeader } : undefined });
                const fileStream = upstream.stream || upstream;
                const ext = path.extname(filePath).toLowerCase();
                const contentType = contentTypeMap[ext] || 'application/octet-stream';
                res.setHeader('Content-Type', contentType);
                res.setHeader('Accept-Ranges', 'bytes');
                const h = upstream.headers || {};
                if (h['content-range']) res.setHeader('Content-Range', h['content-range']);
                if (h['content-length']) res.setHeader('Content-Length', h['content-length']);
                if (upstream.status === 206) res.status(206);
                res.setHeader('Cache-Control', 'public, max-age=86400');
                fileStream.pipe(res);
                console.log('✅ [Drive 代理] 重試成功');
                return;
            } catch (retryError) {
                console.error('❌ [Drive 代理] 重試失敗:', retryError.message);
            }
        }
        
        // 如果是檔案不存在，返回 404
        if (error.message && (error.message.includes('404') || error.message.includes('not found'))) {
            return res.status(404).json({
                success: false,
                error: '檔案不存在'
            });
        }
        
        // 其他錯誤返回 500
        res.status(500).json({
            success: false,
            error: '無法載入檔案'
        });
  }
});

/**
 * 🔗 獲取 Drive 檔案的代理 URL
 * 
 * 用途：將 Drive 路徑轉換為前端可用的代理 URL
 * 請求：POST /api/drive-media/url
 * Body: { path: "/Fun Learn Bar/FLB-Learning-Portfolio/.../photo.jpg" }
 * 回應：{ success: true, url: "/api/drive-media/Fun Learn Bar/FLB-Learning-Portfolio/.../photo.jpg" }
 */
app.post('/api/drive-media/url', (req, res) => {
    try {
        const { path: drivePath } = req.body;
        
        if (!drivePath) {
      return res.status(400).json({
        success: false,
                error: '缺少 path 參數'
            });
        }
        
        // 驗證路徑安全性
        if (!drivePathManager.isInDriveRoot(drivePath)) {
            return res.status(403).json({
        success: false,
                error: '無效的檔案路徑'
            });
        }
        
        // 移除開頭的斜線（如果有）
        const cleanPath = drivePath.startsWith('/') ? drivePath.substring(1) : drivePath;
        
        // 構建代理 URL
        const proxyUrl = `/api/drive-media/${cleanPath}`;
    
    res.json({
      success: true,
            url: proxyUrl,
            drivePath: drivePath
    });
    
  } catch (error) {
        console.error('❌ [Drive URL] 錯誤:', error.message);
    res.status(500).json({
      success: false,
            error: error.message
    });
  }
});

// ==================== 健康檢查端點 ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '2.4.0',
    services: {
      drive: driveClient ? 'initialized' : 'not initialized',
      pathManager: drivePathManager ? 'initialized' : 'not initialized',
      uploadHelper: learningUploadHelper ? 'initialized' : 'not initialized'
    }
  });
});

// ==================== API 結束 ====================

// ==================== 初始化模組化路由系統 ====================
try {
    console.log('🚀 [Routes] 初始化模組化路由系統');
    
    // 載入路由初始化器
    const { initializeRoutes } = require('./routes');
    
    // 準備服務實例
    const services = {
        holidaySyncManager: holidayManager,  // 重用已存在的實例
        eventsCache: eventsCache,            // 傳遞事件快取
        googleSheetsStudents: googleSheetsStudents,  // 傳遞 Google Sheets 服務
        fastAttendance: fastAttendance,      // 傳遞 FastAttendance 服務
        attendanceQueueManager: attendanceQueueManager,  // 傳遞簽到佇列管理器
        reminderScheduler: reminderScheduler, // 傳遞提醒排程器
        notificationManager: notificationManager, // 傳遞通知管理器
        // 🚀 Phase 5: 媒體系統服務
        driveClient: driveClient,            // Synology Drive 客戶端
        driveChunkRegistry: driveChunkRegistry,  // Drive 分片會話註冊表
        driveUploadQueue: driveUploadQueue,  // Drive 上傳佇列
        drivePathManager: drivePathManager,  // Drive 路徑管理器
        driveMediaIndex: driveMediaIndex,    // Drive 媒體索引
        learningUploadHelper: learningUploadHelper, // 學習記錄上傳助手
        learningRecordsIndex: learningRecordsIndex  // 學習記錄索引
    };
    
    // 初始化路由模組
    initializeRoutes(app, services);
    
    console.log('✅ [Routes] 模組化路由系統已成功整合');
    
} catch (error) {
    console.error('❌ [Routes] 模組化路由系統整合失敗:', error.message);
    console.error('🔧 [Routes] 請檢查 routes/ 目錄結構和依賴是否正確');
    // 不中斷伺服器啟動，僅記錄錯誤
}
// ==================== 模組化路由系統結束 ====================

// 🔥 ==================== 地點對應表管理 API ====================

const LOCATION_MAPPING_PATH = path.join(__dirname, 'location-mapping.json');

// 讀取地點對應表
app.get('/api/location-mapping', (req, res) => {
  try {
    if (!fs.existsSync(LOCATION_MAPPING_PATH)) {
      // 如果檔案不存在，建立預設對應表
      const defaultMapping = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        mappings: {},
        '預設地址': '樂程坊'
      };
      fs.writeFileSync(LOCATION_MAPPING_PATH, JSON.stringify(defaultMapping, null, 2));
      return res.json({ success: true, data: defaultMapping });
    }
    
    const data = JSON.parse(fs.readFileSync(LOCATION_MAPPING_PATH, 'utf8'));
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ 讀取地點對應表失敗:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 更新整個地點對應表
app.put('/api/location-mapping', async (req, res) => {
  try {
    const { mappings, 預設地址 } = req.body;
    
    if (!mappings || typeof mappings !== 'object') {
      return res.status(400).json({
        success: false,
        error: '請提供有效的 mappings 物件'
      });
    }
    
    const currentData = fs.existsSync(LOCATION_MAPPING_PATH) 
      ? JSON.parse(fs.readFileSync(LOCATION_MAPPING_PATH, 'utf8'))
      : {};
    
    const updatedData = {
      version: currentData.version || '1.0.0',
      lastUpdated: new Date().toISOString(),
      mappings: mappings,
      '預設地址': 預設地址 || currentData['預設地址'] || '樂程坊',
      metadata: currentData.metadata || {
        description: '地點簡稱與具體地址的對應表',
        usage: '當學生沒有設定個別地址時，系統會查詢此對應表來取得具體地址'
      }
    };
    
    await fs.promises.writeFile(LOCATION_MAPPING_PATH, JSON.stringify(updatedData, null, 2));
    console.log('✅ 地點對應表已更新');
    
    res.json({ success: true, data: updatedData });
  } catch (error) {
    console.error('❌ 更新地點對應表失敗:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 新增或更新單個地點
app.post('/api/location-mapping/location', async (req, res) => {
  try {
    const { name, address } = req.body;
    
    if (!name || !address) {
      return res.status(400).json({
        success: false,
        error: '請提供地點名稱和地址'
      });
    }
    
    const data = fs.existsSync(LOCATION_MAPPING_PATH)
      ? JSON.parse(fs.readFileSync(LOCATION_MAPPING_PATH, 'utf8'))
      : { mappings: {}, '預設地址': '樂程坊' };
    
    data.mappings[name] = address;
    data.lastUpdated = new Date().toISOString();
    
    await fs.promises.writeFile(LOCATION_MAPPING_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ 已新增/更新地點: ${name} -> ${address}`);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ 新增地點失敗:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 刪除單個地點
app.delete('/api/location-mapping/location/:name', async (req, res) => {
  try {
    const { name } = req.params;
    
    if (!fs.existsSync(LOCATION_MAPPING_PATH)) {
      return res.status(404).json({
        success: false,
        error: '地點對應表不存在'
      });
    }
    
    const data = JSON.parse(fs.readFileSync(LOCATION_MAPPING_PATH, 'utf8'));
    
    if (!data.mappings[name]) {
      return res.status(404).json({
        success: false,
        error: `找不到地點: ${name}`
      });
    }
    
    delete data.mappings[name];
    data.lastUpdated = new Date().toISOString();
    
    await fs.promises.writeFile(LOCATION_MAPPING_PATH, JSON.stringify(data, null, 2));
    console.log(`✅ 已刪除地點: ${name}`);
    
    res.json({ success: true, data });
  } catch (error) {
    console.error('❌ 刪除地點失敗:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== 地點對應表管理 API 結束 ====================

// 啟動服務器
app.listen(PORT, () => {
  console.log('🚀 FLB講師行事曆LIFF應用運行在端口', PORT);
  console.log('🌐 主頁面: http://localhost:' + PORT);
  console.log('🔧 API端點: http://localhost:' + PORT + '/api/teachers');
  console.log('🔗 代理端點: http://localhost:' + PORT + '/api/google-script');
  console.log('📊 健康檢查: http://localhost:' + PORT + '/api/health');
  console.log('🔔 提醒管理: http://localhost:' + PORT + '/course-reminder-management.html');
  console.log('⚙️  管理後台: http://localhost:' + PORT + '/admin-settings.html (密碼: admin123)');
  console.log('🌍 環境:', process.env.NODE_ENV || 'development');
  
  // 自動啟動提醒排程器（開發環境可透過環境變數禁用）
  if (process.env.DISABLE_AUTO_REMINDERS !== 'true') {
    console.log('🕐 啟動提醒排程器...');
    reminderScheduler.start();
  } else {
    console.log('⚠️  提醒排程器已禁用（開發模式）');
    console.log('   如需啟用，請移除環境變數 DISABLE_AUTO_REMINDERS');
  }
});

// 🔍 调试端点：检查视频状态（智能搜索）
app.get('/api/debug/video-status', (req, res) => {
  try {
    const { course, period, date, studentName } = req.query;
    
    if (!course || !period || !date || !studentName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }
    
    const basePath = '/volume1/Fun Learn Bar/學習歷程 automatic';
    const semester = getCurrentSemester();
    
    // 尝试多种可能的路径格式
    const possiblePaths = [];
    
    // 1. 使用 generateLearningPath（标准化格式）
    try {
      const standardPath = generateLearningPath(course, period, date, studentName, false);
      possiblePaths.push({ type: 'standard', path: standardPath });
    } catch (e) {}
    
    // 2. 直接组合（保留原始格式）
    const directPath = path.join(basePath, semester, `${course}-${period}`, date, studentName);
    possiblePaths.push({ type: 'direct', path: directPath });
    
    // 3. 去除时段中的空格和冒号
    const periodNoSpace = period.replace(/\s+/g, '').replace(/:/g, '');
    const noSpacePath = path.join(basePath, semester, `${course}-${periodNoSpace}`, date, studentName);
    possiblePaths.push({ type: 'noSpace', path: noSpacePath });
    
    // 4. 智能搜索：在学期目录下查找匹配的课程目录
    try {
      const semesterPath = path.join(basePath, semester);
      if (fs.existsSync(semesterPath)) {
        const courseDirs = fs.readdirSync(semesterPath);
        const matchingDir = courseDirs.find(dir => {
          return dir.includes(course) && (dir.includes(period) || dir.includes(periodNoSpace));
        });
        
        if (matchingDir) {
          const smartPath = path.join(semesterPath, matchingDir, date, studentName);
          possiblePaths.push({ type: 'smart', path: smartPath });
        }
      }
    } catch (e) {
      console.warn('智能搜索失败:', e.message);
    }
    
    // 查找第一个存在的路径
    let recordPath = null;
    let pathType = null;
    
    for (const { type, path: testPath } of possiblePaths) {
      if (fs.existsSync(testPath)) {
        recordPath = testPath;
        pathType = type;
        console.log(`✅ 找到路径 (${type}):`, testPath);
        break;
      }
    }
    
    const result = {
      requestParams: { course, period, date, studentName },
      semester,
      testedPaths: possiblePaths.map(p => p.path),
      recordPath,
      pathType,
      exists: !!recordPath,
      files: [],
      videosMeta: null,
      mediaMeta: null,
      photosMeta: null
    };
    
    if (recordPath) {
      try {
        result.files = fs.readdirSync(recordPath).map(f => {
          const fullPath = path.join(recordPath, f);
          const stat = fs.statSync(fullPath);
          return {
            name: f,
            size: stat.size,
            isDirectory: stat.isDirectory()
          };
        });
      } catch (e) {
        result.filesError = e.message;
      }
      
      // 读取 videos-meta.json
      const videosMetaPath = path.join(recordPath, 'videos-meta.json');
      if (fs.existsSync(videosMetaPath)) {
        try {
          const content = fs.readFileSync(videosMetaPath, 'utf8');
          result.videosMeta = JSON.parse(content);
        } catch (e) {
          result.videosMetaError = e.message;
        }
      }
      
      // 读取 photos-meta.json
      const photosMetaPath = path.join(recordPath, 'photos-meta.json');
      if (fs.existsSync(photosMetaPath)) {
        try {
          const content = fs.readFileSync(photosMetaPath, 'utf8');
          result.photosMeta = JSON.parse(content);
        } catch (e) {
          result.photosMetaError = e.message;
        }
      }
      
      // 读取 media-meta.json
      const mediaMetaPath = path.join(recordPath, 'media-meta.json');
      if (fs.existsSync(mediaMetaPath)) {
        try {
          const content = fs.readFileSync(mediaMetaPath, 'utf8');
          result.mediaMeta = JSON.parse(content);
        } catch (e) {
          result.mediaMetaError = e.message;
        }
      }
    }
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('❌ 调试端点错误:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// 🧹 清理端点：删除元数据中引用的已删除文件
app.post('/api/clean-metadata', (req, res) => {
  try {
    const { course, period, date, studentName } = req.body;
    
    if (!course || !period || !date || !studentName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }
    
    const recordPath = generateLearningPath(course, period, date, studentName, false);
    
    if (!fs.existsSync(recordPath)) {
      return res.status(404).json({
        success: false,
        error: '目录不存在'
      });
    }
    
    let totalCleaned = 0;
    const result = {
      recordPath,
      videos: { before: 0, after: 0, cleaned: 0 },
      photos: { before: 0, after: 0, cleaned: 0 }
    };
    
    // 清理 videos-meta.json
    const videosMetaPath = path.join(recordPath, 'videos-meta.json');
    if (fs.existsSync(videosMetaPath)) {
      try {
        const content = fs.readFileSync(videosMetaPath, 'utf8');
        const allVideos = JSON.parse(content);
        
        if (Array.isArray(allVideos)) {
          result.videos.before = allVideos.length;
          
          const existingVideos = allVideos.filter(v => {
            const videoPath = path.join(recordPath, v.filename || '');
            return fs.existsSync(videoPath);
          });
          
          result.videos.after = existingVideos.length;
          result.videos.cleaned = result.videos.before - result.videos.after;
          totalCleaned += result.videos.cleaned;
          
          if (existingVideos.length !== allVideos.length) {
            fs.writeFileSync(
              videosMetaPath,
              JSON.stringify(existingVideos, null, 2),
              'utf8'
            );
            console.log(`✅ 清理 videos-meta.json: ${allVideos.length} → ${existingVideos.length}`);
          }
        }
      } catch (e) {
        result.videos.error = e.message;
      }
    }
    
    // 清理 photos-meta.json
    const photosMetaPath = path.join(recordPath, 'photos-meta.json');
    if (fs.existsSync(photosMetaPath)) {
      try {
        const content = fs.readFileSync(photosMetaPath, 'utf8');
        const allPhotos = JSON.parse(content);
        
        if (Array.isArray(allPhotos)) {
          result.photos.before = allPhotos.length;
          
          const existingPhotos = allPhotos.filter(p => {
            const photoPath = path.join(recordPath, p.filename || '');
            return fs.existsSync(photoPath);
          });
          
          result.photos.after = existingPhotos.length;
          result.photos.cleaned = result.photos.before - result.photos.after;
          totalCleaned += result.photos.cleaned;
          
          if (existingPhotos.length !== allPhotos.length) {
            fs.writeFileSync(
              photosMetaPath,
              JSON.stringify(existingPhotos, null, 2),
              'utf8'
            );
            console.log(`✅ 清理 photos-meta.json: ${allPhotos.length} → ${existingPhotos.length}`);
          }
        }
      } catch (e) {
        result.photos.error = e.message;
      }
    }
    
    result.totalCleaned = totalCleaned;
    
    res.json({
      success: true,
      data: result,
      message: `已清理 ${totalCleaned} 个无效引用`
    });
  } catch (error) {
    console.error('❌ 清理元数据失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 🧹 批量清理 API：掃描所有學習記錄，清理不存在的媒體檔案記錄
app.post('/api/clean-all-metadata', async (req, res) => {
  try {
    console.log('🧹 開始批量清理所有學習記錄的無效媒體引用...');
    
    const basePath = process.env.NODE_ENV === 'production'
      ? '/volume1/Fun Learn Bar/學習歷程 automatic'
      : path.join(__dirname, 'data', 'learning-portfolio');
    
    if (!fs.existsSync(basePath)) {
      return res.status(404).json({
        success: false,
        error: '學習記錄根目錄不存在'
      });
    }
    
    const stats = {
      totalDirectories: 0,
      processedDirectories: 0,
      photosMetaCleaned: 0,
      videosMetaCleaned: 0,
      totalPhotosRemoved: 0,
      totalVideosRemoved: 0,
      emptyMetaDeleted: 0,
      errors: []
    };
    
    // 遞迴掃描函數
    function scanDirectory(dirPath) {
      try {
        const items = fs.readdirSync(dirPath);
        
        for (const item of items) {
          const fullPath = path.join(dirPath, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            stats.totalDirectories++;
            
            // 檢查是否為學生目錄（包含 photos-meta.json、videos-meta.json 或 media-meta.json）
            const photosMetaPath = path.join(fullPath, 'photos-meta.json');
            const videosMetaPath = path.join(fullPath, 'videos-meta.json');
            const mediaMetaPath = path.join(fullPath, 'media-meta.json');
            const hasMetaFiles = fs.existsSync(photosMetaPath) || fs.existsSync(videosMetaPath) || fs.existsSync(mediaMetaPath);
            
            if (hasMetaFiles) {
              stats.processedDirectories++;
              console.log('🔍 檢查目錄:', fullPath);
              
              // 清理 photos-meta.json
              if (fs.existsSync(photosMetaPath)) {
                try {
                  const content = fs.readFileSync(photosMetaPath, 'utf8');
                  const allPhotos = JSON.parse(content);
                  
                  if (Array.isArray(allPhotos)) {
                    const existingPhotos = allPhotos.filter(p => {
                      const photoPath = path.join(fullPath, p.filename || '');
                      const exists = fs.existsSync(photoPath);
                      if (!exists) {
                        console.log('  ⚠️ 照片不存在:', p.filename);
                      }
                      return exists;
                    });
                    
                    const removed = allPhotos.length - existingPhotos.length;
                    if (removed > 0) {
                      stats.photosMetaCleaned++;
                      stats.totalPhotosRemoved += removed;
                      
                      if (existingPhotos.length === 0) {
                        // 刪除空的 meta 檔案
                        fs.unlinkSync(photosMetaPath);
                        stats.emptyMetaDeleted++;
                        console.log('  ✅ 刪除空的 photos-meta.json');
                      } else {
                        // 更新 meta 檔案
                        fs.writeFileSync(photosMetaPath, JSON.stringify(existingPhotos, null, 2), 'utf8');
                        console.log(`  ✅ 清理 photos-meta.json: ${allPhotos.length} → ${existingPhotos.length}`);
                      }
                    }
                  }
                } catch (e) {
                  stats.errors.push({ path: photosMetaPath, error: e.message });
                  console.error('  ❌ 清理 photos-meta.json 失敗:', e.message);
                }
              }
              
              // 清理 videos-meta.json
              if (fs.existsSync(videosMetaPath)) {
                try {
                  const content = fs.readFileSync(videosMetaPath, 'utf8');
                  const allVideos = JSON.parse(content);
                  
                  if (Array.isArray(allVideos)) {
                    const existingVideos = allVideos.filter(v => {
                      const videoPath = path.join(fullPath, v.filename || '');
                      const exists = fs.existsSync(videoPath);
                      if (!exists) {
                        console.log('  ⚠️ 影片不存在:', v.filename);
                      }
                      return exists;
                    });
                    
                    const removed = allVideos.length - existingVideos.length;
                    if (removed > 0) {
                      stats.videosMetaCleaned++;
                      stats.totalVideosRemoved += removed;
                      
                      if (existingVideos.length === 0) {
                        // 刪除空的 meta 檔案
                        fs.unlinkSync(videosMetaPath);
                        stats.emptyMetaDeleted++;
                        console.log('  ✅ 刪除空的 videos-meta.json');
                      } else {
                        // 更新 meta 檔案
                        fs.writeFileSync(videosMetaPath, JSON.stringify(existingVideos, null, 2), 'utf8');
                        console.log(`  ✅ 清理 videos-meta.json: ${allVideos.length} → ${existingVideos.length}`);
                      }
                    }
                  }
                } catch (e) {
                  stats.errors.push({ path: videosMetaPath, error: e.message });
                  console.error('  ❌ 清理 videos-meta.json 失敗:', e.message);
                }
              }
              
              // 🔥 清理 media-meta.json（混合照片+影片）
              if (fs.existsSync(mediaMetaPath)) {
                try {
                  const content = fs.readFileSync(mediaMetaPath, 'utf8');
                  const mediaMeta = JSON.parse(content);
                  
                  if (mediaMeta.files && Array.isArray(mediaMeta.files)) {
                    const beforeCount = mediaMeta.files.length;
                    
                    // 過濾掉不存在的檔案
                    mediaMeta.files = mediaMeta.files.filter(file => {
                      const filePath = path.join(fullPath, file.filename || '');
                      const exists = fs.existsSync(filePath);
                      if (!exists) {
                        const fileType = (file.type || '').startsWith('video/') ? '影片' : '照片';
                        console.log(`  ⚠️ media-meta.json: ${fileType}不存在:`, file.filename);
                        
                        // 更新統計（根據檔案類型）
                        if (fileType === '影片') {
                          stats.totalVideosRemoved++;
                        } else {
                          stats.totalPhotosRemoved++;
                        }
                      }
                      return exists;
                    });
                    
                    const afterCount = mediaMeta.files.length;
                    if (beforeCount !== afterCount) {
                      if (afterCount === 0) {
                        // 刪除空的 meta 檔案
                        fs.unlinkSync(mediaMetaPath);
                        stats.emptyMetaDeleted++;
                        console.log('  ✅ 刪除空的 media-meta.json');
                      } else {
                        // 更新 meta 檔案
                        mediaMeta.updatedAt = Date.now();
                        fs.writeFileSync(mediaMetaPath, JSON.stringify(mediaMeta, null, 2), 'utf8');
                        console.log(`  ✅ 清理 media-meta.json: ${beforeCount} → ${afterCount}`);
                      }
                    }
                  }
                } catch (e) {
                  stats.errors.push({ path: mediaMetaPath, error: e.message });
                  console.error('  ❌ 清理 media-meta.json 失敗:', e.message);
                }
              }
            }
            
            // 遞迴掃描子目錄
            scanDirectory(fullPath);
          }
        }
      } catch (e) {
        stats.errors.push({ path: dirPath, error: e.message });
        console.error('❌ 掃描目錄失敗:', dirPath, e.message);
      }
    }
    
    // 開始掃描
    scanDirectory(basePath);
    
    console.log('✅ 批量清理完成');
    console.log('📊 統計資訊:', {
      總目錄數: stats.totalDirectories,
      處理目錄數: stats.processedDirectories,
      照片meta已清理: stats.photosMetaCleaned,
      影片meta已清理: stats.videosMetaCleaned,
      移除照片記錄數: stats.totalPhotosRemoved,
      移除影片記錄數: stats.totalVideosRemoved,
      刪除空meta檔案數: stats.emptyMetaDeleted,
      錯誤數: stats.errors.length
    });
    
    res.json({
      success: true,
      data: stats,
      message: `已清理 ${stats.totalPhotosRemoved + stats.totalVideosRemoved} 個無效媒體引用`
    });
    
  } catch (error) {
    console.error('❌ 批量清理失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 優雅關閉
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信號，正在關閉服務器...');
  reminderScheduler.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('收到SIGINT信號，正在關閉服務器...');
  reminderScheduler.stop();
  process.exit(0);
});
