// ============================================
// 📊 學習歷程集中索引（learning-records-index.json）
// ============================================
// 功能：
// - 以單一 JSON 檔集中記錄「每堂課 / 每位學生 / 課程總覽」的提交狀態摘要
// - 提供快速查詢 API，避免每次都掃描 Drive 上的所有檔案與 meta
// - 透過 safe-file-operations + 檔案鎖，確保併發寫入安全
//
// 注意：
// - 真正的檔案結構與 metadata 仍以 Synology Drive 為主，本索引只是快取型摘要
// - 若出現不一致，可透過「重建索引」工具從 Drive 重新掃描

const path = require('path');
const safeFileOps = require('./safe-file-operations');
const SmartCacheManager = require('./smart-cache-manager');
const DrivePathHelper = require('./drive-path-helper');

// 索引檔案路徑
const INDEX_FILE_PATH = path.join(__dirname, '..', 'data', 'learning-records-index.json');

// DrivePathHelper 用於從完整路徑解析出學期 / 課程 / 日期 / 學生等資訊
const driveRoot = process.env.SYNOLOGY_DRIVE_ROOT || '/Fun Learn Bar/FLB-Learning-Portfolio';
const drivePathHelper = new DrivePathHelper(driveRoot);

// 30 秒 TTL 的輕量快取，避免高頻讀檔
const cache = new SmartCacheManager({ defaultTTL: 30000, maxSize: 200 });

function getDefaultIndex() {
  return {
    version: 1,
    updatedAt: null,
    courses: {}, // courses[courseKey] = { semester, courseName, date, topic, overview, students }
  };
}

function buildCourseKey(semester, courseName, date, topic) {
  const s = String(semester || '').trim();
  const c = String(courseName || '').trim();
  const d = String(date || '').trim();
  const t = String(topic || '').trim();
  return [s, c, d, t].join('::');
}

function buildStudentKey(studentName) {
  return String(studentName || '').trim() || '__UNKNOWN__';
}

async function readIndex() {
  try {
    const index = await safeFileOps.readJSON(INDEX_FILE_PATH, getDefaultIndex());
    if (!index || typeof index !== 'object') return getDefaultIndex();
    return index;
  } catch (error) {
    console.error('❌ [LearningRecordsIndex] 讀取索引失敗，將使用預設值:', error.message);
    return getDefaultIndex();
  }
}

async function updateIndex(mutator) {
  const updated = await safeFileOps.atomicUpdate(INDEX_FILE_PATH, async (current) => {
    const base = !current || typeof current !== 'object' ? getDefaultIndex() : current;
    const next = await mutator(base) || base;
    next.version = next.version || 1;
    next.updatedAt = new Date().toISOString();
    return next;
  }, getDefaultIndex());

  // 清除全域快取，避免舊資料殘留
  try {
    cache.clear();
  } catch (_) {}

  return updated;
}

// ==================== 對外 API：更新摘要 ====================

/**
 * 更新學生學習歷程摘要
 * @param {Object} payload
 * @param {string} payload.semester
 * @param {string} payload.courseName
 * @param {string} payload.date - YYYY-MM-DD
 * @param {string} [payload.topic]
 * @param {string} payload.studentName
 * @param {number} [payload.photoCount]
 * @param {number} [payload.videoCount]
 * @param {boolean} [payload.hasComment]
 */
async function updateStudentRecordSummary(payload = {}) {
  const {
    semester,
    courseName,
    date,
    topic,
    studentName,
    photoCount,
    videoCount,
    hasComment,
  } = payload;

  if (!semester || !courseName || !date || !studentName) {
    console.warn('⚠️ [LearningRecordsIndex] updateStudentRecordSummary 缺少必要欄位，略過:', {
      semester,
      courseName,
      date,
      studentName,
    });
    return null;
  }

  const courseKey = buildCourseKey(semester, courseName, date, topic);
  const studentKey = buildStudentKey(studentName);

  const index = await updateIndex((data) => {
    if (!data.courses) data.courses = {};
    if (!data.courses[courseKey]) {
      data.courses[courseKey] = {
        semester,
        courseName,
        date,
        topic: topic || '',
        overview: null,
        students: {},
      };
    }

    const courseEntry = data.courses[courseKey];
    if (!courseEntry.students) courseEntry.students = {};

    const now = new Date().toISOString();
    const existing = courseEntry.students[studentKey] || {
      studentName,
      photoCount: 0,
      videoCount: 0,
      hasComment: false,
      hasAnyUpload: false,
      lastUpdatedAt: now,
      lastUploadTime: null,
    };

    existing.studentName = studentName;
    if (typeof photoCount === 'number' && !Number.isNaN(photoCount)) {
      existing.photoCount = photoCount;
    }
    if (typeof videoCount === 'number' && !Number.isNaN(videoCount)) {
      existing.videoCount = videoCount;
    }
    if (typeof hasComment === 'boolean') {
      existing.hasComment = hasComment;
    }

    const effectivePhotoCount = typeof photoCount === 'number' && !Number.isNaN(photoCount)
      ? photoCount
      : existing.photoCount || 0;
    const effectiveVideoCount = typeof videoCount === 'number' && !Number.isNaN(videoCount)
      ? videoCount
      : existing.videoCount || 0;

    const anyUpload = effectivePhotoCount + effectiveVideoCount > 0 || !!existing.hasComment;
    existing.hasAnyUpload = anyUpload;

    existing.lastUpdatedAt = now;
    if (anyUpload) {
      existing.lastUploadTime = now;
    }

    courseEntry.students[studentKey] = existing;
    data.courses[courseKey] = courseEntry;

    return data;
  });

  return index.courses[courseKey];
}

/**
 * 更新課程總覽摘要
 * @param {Object} payload
 * @param {string} payload.semester
 * @param {string} payload.courseName
 * @param {string} payload.date
 * @param {string} [payload.topic]
 * @param {boolean} [payload.hasPhotos]
 * @param {boolean} [payload.hasVideos]
 * @param {boolean} [payload.hasSummary] - 是否有文字總結（summary.txt 或 comment）
 */
async function updateOverviewRecordSummary(payload = {}) {
  const {
    semester,
    courseName,
    date,
    topic,
    hasPhotos,
    hasVideos,
    hasSummary,
  } = payload;

  if (!semester || !courseName || !date) {
    console.warn('⚠️ [LearningRecordsIndex] updateOverviewRecordSummary 缺少必要欄位，略過:', {
      semester,
      courseName,
      date,
    });
    return null;
  }

  const courseKey = buildCourseKey(semester, courseName, date, topic);

  const index = await updateIndex((data) => {
    if (!data.courses) data.courses = {};
    if (!data.courses[courseKey]) {
      data.courses[courseKey] = {
        semester,
        courseName,
        date,
        topic: topic || '',
        overview: null,
        students: {},
      };
    }

    const courseEntry = data.courses[courseKey];
    const now = new Date().toISOString();

    const overview = courseEntry.overview || {
      hasPhotos: false,
      hasVideos: false,
      hasSummary: false,
      lastUpdatedAt: now,
    };

    if (typeof hasPhotos === 'boolean') overview.hasPhotos = hasPhotos;
    if (typeof hasVideos === 'boolean') overview.hasVideos = hasVideos;
    if (typeof hasSummary === 'boolean') overview.hasSummary = hasSummary;
    overview.lastUpdatedAt = now;

    courseEntry.overview = overview;
    data.courses[courseKey] = courseEntry;
    return data;
  });

  return index.courses[courseKey];
}

// ==================== 對外 API：刪除 / 清理 ====================

/**
 * 根據完整 Drive 路徑移除索引中的紀錄
 * - 學生記錄路徑：移除該學生的索引
 * - 課程總覽路徑：清空 overview 摘要
 */
async function removeRecordByDrivePath(fullPath) {
  if (!fullPath) return null;

  let parsed;
  try {
    parsed = drivePathHelper.parsePath(fullPath);
  } catch (error) {
    console.warn('⚠️ [LearningRecordsIndex] 解析路徑失敗，無法移除索引:', {
      fullPath,
      message: error && error.message,
    });
    return null;
  }

  const { semester, courseName, date, topic, studentName, isOverview } = parsed;
  if (!semester || !courseName || !date) {
    console.warn('⚠️ [LearningRecordsIndex] 解析到的欄位不足，略過移除:', parsed);
    return null;
  }

  const courseKey = buildCourseKey(semester, courseName, date, topic);
  const studentKey = buildStudentKey(studentName);

  const index = await updateIndex((data) => {
    if (!data.courses || !data.courses[courseKey]) {
      return data;
    }

    const courseEntry = data.courses[courseKey];

    if (isOverview) {
      courseEntry.overview = null;
    } else if (courseEntry.students && courseEntry.students[studentKey]) {
      delete courseEntry.students[studentKey];
    }

    const hasStudents = courseEntry.students && Object.keys(courseEntry.students).length > 0;
    const hasOverview = !!courseEntry.overview;

    if (!hasStudents && !hasOverview) {
      delete data.courses[courseKey];
    } else {
      data.courses[courseKey] = courseEntry;
    }

    return data;
  });

  return index.courses[courseKey] || null;
}

// ==================== 對外 API：查詢 ====================

/**
 * 取得某堂課程的索引摘要
 * 🔥 [修復 2025-11-26] 支援模糊匹配：當 topic 為空時，匹配任何 topic
 */
async function getCourseSummary(params = {}) {
  const { semester, courseName, date, topic } = params;
  if (!semester || !courseName || !date) {
    return null;
  }

  const index = await readIndex();
  
  // 如果有指定 topic，精確匹配
  if (topic && String(topic).trim()) {
    const courseKey = buildCourseKey(semester, courseName, date, topic);
    const cacheKey = `course:${courseKey}`;
    
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    
    const courseEntry = index.courses && index.courses[courseKey] ? index.courses[courseKey] : null;
    
    if (courseEntry) {
      cache.set(cacheKey, courseEntry);
    }
    
    return courseEntry;
  }
  
  // 🔍 topic 為空時，模糊匹配：找出符合 semester + courseName + date 的第一筆記錄
  const prefix = `${semester}::${courseName}::${date}::`;
  const matchingKey = Object.keys(index.courses || {}).find(key => key.startsWith(prefix));
  
  if (matchingKey) {
    const courseEntry = index.courses[matchingKey];
    // 使用模糊匹配的 key 作為快取 key
    const cacheKey = `course:fuzzy:${prefix}`;
    cache.set(cacheKey, courseEntry);
    return courseEntry;
  }
  
  return null;
}

/**
 * 取得完整索引（僅供管理後台或除錯使用）
 */
async function getFullIndex() {
  return await readIndex();
}

module.exports = {
  INDEX_FILE_PATH,
  updateStudentRecordSummary,
  updateOverviewRecordSummary,
  removeRecordByDrivePath,
  getCourseSummary,
  getFullIndex,
};

/**
 * 🔄 從完整記錄列表重建整個索引
 * @param {Array<Object>} records - 由 LearningUploadHelper._buildRecordFromMetadata 產生的記錄陣列
 */
async function rebuildIndexFromRecords(records = []) {
  const index = getDefaultIndex();
  const nowIso = new Date().toISOString();

  if (!Array.isArray(records) || records.length === 0) {
    index.updatedAt = nowIso;
    await safeFileOps.writeJSON(INDEX_FILE_PATH, index, true);
    try { cache.clear(); } catch (_) {}
    return index;
  }

  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue;
    const semester = rec.semester;
    const courseName = rec.courseName;
    const date = rec.date;
    const topic = rec.topic;
    if (!semester || !courseName || !date) continue;

    const courseKey = buildCourseKey(semester, courseName, date, topic);
    if (!index.courses[courseKey]) {
      index.courses[courseKey] = {
        semester,
        courseName,
        date,
        topic: topic || '',
        overview: null,
        students: {},
      };
    }

    const courseEntry = index.courses[courseKey];
    const ts = rec.uploadTime || rec.uploadedAt || nowIso;

    if (rec.isOverview) {
      const hasPhotos = typeof rec.photoCount === 'number'
        ? rec.photoCount > 0
        : (Array.isArray(rec.photos) && rec.photos.length > 0) ||
          (Array.isArray(rec.newMediaPhotos) && rec.newMediaPhotos.length > 0);
      const hasVideos = typeof rec.videoCount === 'number'
        ? rec.videoCount > 0
        : (Array.isArray(rec.videos) && rec.videos.length > 0) ||
          (Array.isArray(rec.newMediaVideos) && rec.newMediaVideos.length > 0);
      const hasSummary = !!(rec.overviewSummary || rec.comment);

      const overview = courseEntry.overview || {
        hasPhotos: false,
        hasVideos: false,
        hasSummary: false,
        lastUpdatedAt: ts,
      };

      overview.hasPhotos = overview.hasPhotos || hasPhotos;
      overview.hasVideos = overview.hasVideos || hasVideos;
      overview.hasSummary = overview.hasSummary || hasSummary;
      overview.lastUpdatedAt = ts;

      courseEntry.overview = overview;
      index.courses[courseKey] = courseEntry;
      continue;
    }

    const studentName = rec.studentName;
    if (!studentName) continue;
    const studentKey = buildStudentKey(studentName);

    if (!courseEntry.students) courseEntry.students = {};
    const existing = courseEntry.students[studentKey] || {
      studentName,
      photoCount: 0,
      videoCount: 0,
      hasComment: false,
      hasAnyUpload: false,
      lastUpdatedAt: ts,
      lastUploadTime: null,
    };

    existing.studentName = studentName;
    if (typeof rec.photoCount === 'number' && !Number.isNaN(rec.photoCount)) {
      existing.photoCount = rec.photoCount;
    }
    if (typeof rec.videoCount === 'number' && !Number.isNaN(rec.videoCount)) {
      existing.videoCount = rec.videoCount;
    }
    const hasComment = !!rec.comment;
    existing.hasComment = existing.hasComment || hasComment;

    const anyUpload = (existing.photoCount || 0) + (existing.videoCount || 0) > 0 || existing.hasComment;
    existing.hasAnyUpload = anyUpload;
    existing.lastUpdatedAt = ts;
    if (anyUpload) {
      existing.lastUploadTime = ts;
    }

    courseEntry.students[studentKey] = existing;
    index.courses[courseKey] = courseEntry;
  }

  index.updatedAt = new Date().toISOString();
  await safeFileOps.writeJSON(INDEX_FILE_PATH, index, true);
  try { cache.clear(); } catch (_) {}
  return index;
}

module.exports.rebuildIndexFromRecords = rebuildIndexFromRecords;
module.exports.buildCourseKey = buildCourseKey;
module.exports.buildStudentKey = buildStudentKey;
