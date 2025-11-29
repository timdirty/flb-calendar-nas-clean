const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const courseNameCleaner = require('../utils/course-name-cleaner');
const semesterHelper = require('../utils/semester-helper');

function normalizeTimestampInput(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (typeof value === 'number') {
    const msValue = value > 1e12 ? value : value * 1000;
    const date = new Date(msValue);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      const msValue = numeric > 1e12 ? numeric : numeric * 1000;
      const numericDate = new Date(msValue);
      if (!Number.isNaN(numericDate.getTime())) {
        return numericDate.toISOString();
      }
    }

    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function pickLatestTimestamp(currentIso, candidateIso) {
  if (!candidateIso) return currentIso;
  if (!currentIso) return candidateIso;
  return candidateIso > currentIso ? candidateIso : currentIso;
}

function toDateKey(input) {
  const iso = normalizeTimestampInput(input);
  return iso ? iso.split('T')[0] : null;
}

const EMPTY_UPLOAD_STATUS = Object.freeze({
  photos: 0,
  videos: 0,
  completed: false,
});

const EMPTY_UPLOAD_OVERVIEW = Object.freeze({
  uploadedCount: 0,
  hasComment: false,
  lastUploadAt: null,
  lastCommentAt: null,
});

function createEmptyUploadStatus() {
  return { ...EMPTY_UPLOAD_STATUS };
}

function createEmptyUploadOverview() {
  return { ...EMPTY_UPLOAD_OVERVIEW };
}

async function buildStudentUploadOverview(learningUploadHelper, {
  semester,
  courseName,
  date,
  studentName,
  topic = '',
}) {
  const normalizedCourseName = courseNameCleaner.cleanCourseName(courseName);
  const resolvedTopic = learningUploadHelper._resolveTopicInput(topic, normalizedCourseName);
  const basePath = learningUploadHelper.pathManager.buildStudentRecordPath(
    semester,
    normalizedCourseName,
    date,
    resolvedTopic,
    studentName
  );

  const summary = {
    basePath,
    exists: false,
    photos: 0,
    videos: 0,
    uploadedCount: 0,
    hasComment: false,
    lastUploadAt: null,
    lastCommentAt: null,
  };

  let directoryExists = false;
  try {
    directoryExists = await learningUploadHelper._directoryExists(basePath);
  } catch (error) {
    console.warn('⚠️ [V2 API] 無法檢查學生記錄目錄是否存在:', {
      basePath,
      error: error.message,
    });
  }

  if (!directoryExists) {
    try {
      const records = await learningUploadHelper.listLearningRecords({
        semester,
        courseName: normalizedCourseName,
        date,
      });
      if (Array.isArray(records) && records.length > 0) {
        const match = records.find((record) => {
          const a = String(record && record.studentName || '').trim();
          const b = String(studentName || '').trim();
          return a === b;
        });
        if (match) {
          const photos = Array.isArray(match.photos) ? match.photos.length : 0;
          const videos = Array.isArray(match.videos) ? match.videos.length : 0;
          summary.exists = true;
          summary.photos = photos;
          summary.videos = videos;
          summary.uploadedCount = photos + videos;
          summary.hasComment = typeof match.comment === 'string' && match.comment.trim().length > 0;
          const uploadIso = normalizeTimestampInput(match.uploadTime || match.lastUploadAt);
          if (uploadIso) {
            summary.lastUploadAt = uploadIso;
          }
          const commentIso = normalizeTimestampInput(match.lastCommentAt || match.commentTime);
          if (commentIso) {
            summary.lastCommentAt = commentIso;
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ [V2 API] 後援 listLearningRecords 失敗:', {
        basePath,
        semester,
        courseName: normalizedCourseName,
        date,
        studentName,
        error: error.message,
      });
    }
    return summary;
  }

  summary.exists = true;

  const pathManager = learningUploadHelper.pathManager;
  const recordMeta = await learningUploadHelper._readOptionalJson(
    pathManager.getRecordMetaPath(basePath),
    { label: 'record-meta.json', fallback: null }
  );

  if (recordMeta) {
    const totalPhotos = typeof recordMeta.totalPhotos === 'number'
      ? recordMeta.totalPhotos
      : Array.isArray(recordMeta.photos) ? recordMeta.photos.length : 0;
    const totalVideos = typeof recordMeta.totalVideos === 'number'
      ? recordMeta.totalVideos
      : Array.isArray(recordMeta.videos) ? recordMeta.videos.length : 0;

    summary.photos = totalPhotos;
    summary.videos = totalVideos;
    summary.uploadedCount = totalPhotos + totalVideos;
    summary.hasComment = typeof recordMeta.comment === 'string' && recordMeta.comment.trim().length > 0;

    const metaUploadIso = normalizeTimestampInput(recordMeta.uploadTime);
    if (metaUploadIso) {
      summary.lastUploadAt = metaUploadIso;
    }
  }

  const folderContent = await learningUploadHelper.driveClient.listFolder(basePath).catch((error) => {
    console.warn('⚠️ [V2 API] 列出學生記錄資料夾失敗:', {
      basePath,
      error: error.message,
    });
    return null;
  });

  if (folderContent && Array.isArray(folderContent.files)) {
    const commentFile = folderContent.files.find((file) => file && file.name === 'comment.txt');
    if (commentFile) {
      const commentIso = normalizeTimestampInput(commentFile.modified);
      if (commentIso) {
        summary.lastCommentAt = commentIso;
      }
      if (!summary.hasComment) {
        summary.hasComment = (commentFile.size || 0) > 0;
      }
    }
  }

  const photosMeta = await learningUploadHelper._readOptionalJson(
    pathManager.getPhotosMetaPath(basePath),
    { label: 'photos-meta.json', fallback: [] }
  );
  const videosMeta = await learningUploadHelper._readOptionalJson(
    pathManager.getVideosMetaPath(basePath),
    { label: 'videos-meta.json', fallback: [] }
  );

  const photoEntries = Array.isArray(photosMeta) ? photosMeta.filter(Boolean) : [];
  const videoEntries = Array.isArray(videosMeta) ? videosMeta.filter(Boolean) : [];

  // 🔥 V2 規則：只要有 photos-meta / videos-meta，就以 meta 長度為準
  if (photoEntries.length > 0) {
    summary.photos = photoEntries.length;
  }
  if (videoEntries.length > 0) {
    summary.videos = videoEntries.length;
  }

  summary.uploadedCount = summary.photos + summary.videos;

  let latestUploadIso = summary.lastUploadAt;

  photoEntries.forEach((entry) => {
    const iso = normalizeTimestampInput(entry.uploadedAt || entry.updatedAt || entry.createdAt);
    latestUploadIso = pickLatestTimestamp(latestUploadIso, iso);
  });

  videoEntries.forEach((entry) => {
    const iso = normalizeTimestampInput(entry.uploadedAt || entry.updatedAt || entry.createdAt);
    latestUploadIso = pickLatestTimestamp(latestUploadIso, iso);
  });

  if (latestUploadIso) {
    summary.lastUploadAt = latestUploadIso;
  }

  return summary;
}

router.delete('/students/:studentId/learning-records/media', async (req, res) => {
  try {
    const { studentId } = req.params;
    const {
      semester,
      courseName,
      date,
      studentName,
      topic,
      fileName,
    } = req.body || {};

    if (!semester || !courseName || !date || !studentName || !fileName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要欄位：semester, courseName, date, studentName, fileName',
      });
    }


    const learningUploadHelper = req.app.get('learningUploadHelper');
    if (!learningUploadHelper) {
      console.error('❌ [V2 API] LearningUploadHelper 未初始化，無法刪除媒體');
      return res.status(503).json({
        success: false,
        error: '學習歷程服務未初始化，無法刪除媒體',
      });
    }

    const payload = await buildLearningRecordsPayload(learningUploadHelper, {
      semester,
      courseName,
      date,
      studentName,
      topic,
    });

    if (!payload.basePath) {
      throw new Error('找不到對應的記錄路徑');
    }

    await learningUploadHelper.deleteSingleFile(payload.basePath, fileName);

    const refreshedPayload = await buildLearningRecordsPayload(learningUploadHelper, {
      semester,
      courseName,
      date,
      studentName,
      topic,
    });

    return res.json({
      success: true,
      data: {
        photos: refreshedPayload.photos,
        videos: refreshedPayload.videos,
        comment: refreshedPayload.comment,
      },
    });
  } catch (error) {
    console.error('❌ [V2 API] 刪除媒體失敗:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '刪除媒體失敗',
    });
  }
});
async function buildLearningRecordsPayload(learningUploadHelper, {
  semester,
  courseName,
  date,
  studentName,
  topic,
}) {
  const normalizedCourseName = courseNameCleaner.cleanCourseName(courseName);
  const resolvedTopic = learningUploadHelper._resolveTopicInput(topic, normalizedCourseName);
  const basePath = learningUploadHelper.pathManager.buildStudentRecordPath(
    semester,
    normalizedCourseName,
    date,
    resolvedTopic,
    studentName
  );

  const exists = await learningUploadHelper._directoryExists(basePath);
  if (!exists) {
    return {
      basePath,
      photos: [],
      videos: [],
      comment: null,
    };
  }

  const folderContent = await learningUploadHelper.driveClient.listFolder(basePath);
  const photos = [];
  const videos = [];
  let comment = null;
  let commentHistory = [];

  const normalizeMediaEntries = (rawEntries, type) => {
    if (!rawEntries) return [];
    const key = type === 'photo' ? 'photos' : 'videos';
    if (Array.isArray(rawEntries)) return rawEntries;
    if (Array.isArray(rawEntries[key])) return rawEntries[key];
    if (Array.isArray(rawEntries.entries)) return rawEntries.entries;
    return [];
  };

  const resolveMediaUrl = (entry, fileNameFallback) => {
    const rawPath = entry?.path || entry?.relativePath || fileNameFallback;
    if (!rawPath) return null;
    const normalizedPath = rawPath.startsWith('/')
      ? rawPath
      : `${basePath}/${rawPath}`;
    return `/api/drive-media${normalizedPath.replace(/\/+/g, '/')}`;
  };

  const pushPhotoEntries = (entries) => {
    entries.forEach(entry => {
      if (!entry) return;
      const fileName = entry.fileName || entry.filename || entry.name;
      if (!fileName) return;
      const size = entry.size || entry.fileSize || 0;
      const url = entry.proxyUrl || entry.previewUrl || resolveMediaUrl(entry, fileName);
      if (!url) return;
      photos.push({
        name: fileName,
        url,
        size,
      });
    });
  };

  const pushVideoEntries = (entries) => {
    entries.forEach(entry => {
      if (!entry) return;
      const fileName = entry.fileName || entry.filename || entry.name;
      if (!fileName) return;
      const size = entry.size || entry.fileSize || 0;
      const transcodedFilename = entry.transcodedFilename || (entry.transcoded && entry.transcoded.filename);
      const thumbnailFilename = entry.thumbnailFilename || (entry.thumbnail && entry.thumbnail.filename);

      const transcodedProxyUrl = entry.transcodedProxyUrl || (transcodedFilename
        ? resolveMediaUrl(entry, transcodedFilename)
        : null);

      const thumbnailProxyUrl = entry.thumbnailProxyUrl || (thumbnailFilename
        ? resolveMediaUrl(entry, thumbnailFilename)
        : null);

      const url =
        transcodedProxyUrl ||
        entry.proxyUrl ||
        entry.previewUrl ||
        entry.downloadUrl ||
        resolveMediaUrl(entry, fileName);
      if (!url) return;

      videos.push({
        name: fileName,
        url,
        size,
        transcodedProxyUrl: transcodedProxyUrl || undefined,
        thumbnailProxyUrl: thumbnailProxyUrl || undefined,
      });
    });
  };

  for (const item of folderContent.files || []) {
    if (item.name === 'comment.txt') {
      try {
        const commentResponse = await learningUploadHelper.driveClient.getFileStream(
          `${basePath}/${item.name}`.replace(/\/+/g, '/')
        );
        const commentStream = learningUploadHelper._ensureReadableStream(commentResponse, 'comment.txt');
        comment = await learningUploadHelper._streamToString(commentStream);
      } catch (error) {
        console.warn('⚠️ [V2 API] 讀取評語失敗:', error.message);
      }
    } else if (item.name.startsWith('photos-meta.json')) {
      try {
        const metaPath = `${basePath}/${item.name}`.replace(/\/+/g, '/');
        const metaResponse = await learningUploadHelper.driveClient.getFileStream(metaPath);
        const metaStream = learningUploadHelper._ensureReadableStream(metaResponse, item.name);
        const metaContent = await learningUploadHelper._streamToString(metaStream);
        const photoMeta = JSON.parse(metaContent);
        pushPhotoEntries(normalizeMediaEntries(photoMeta, 'photo'));
      } catch (error) {
        console.warn('⚠️ [V2 API] 讀取照片元資料失敗:', error.message);
      }
    } else if (item.name.startsWith('videos-meta.json')) {
      try {
        const metaPath = `${basePath}/${item.name}`.replace(/\/+/g, '/');
        const metaResponse = await learningUploadHelper.driveClient.getFileStream(metaPath);
        const metaStream = learningUploadHelper._ensureReadableStream(metaResponse, item.name);
        const metaContent = await learningUploadHelper._streamToString(metaStream);
        const videoMeta = JSON.parse(metaContent);
        pushVideoEntries(normalizeMediaEntries(videoMeta, 'video'));
      } catch (error) {
        console.warn('⚠️ [V2 API] 讀取影片元資料失敗:', error.message);
      }
    }
  }

  // 讀取評語歷史（comment-history.json），若存在
  try {
    const historyPath = path.join(basePath, 'comment-history.json');
    const history = await learningUploadHelper._readOptionalJson(historyPath, {
      label: 'comment-history.json',
      fallback: [],
    });

    if (Array.isArray(history)) {
      commentHistory = history
        .filter((entry) => entry && typeof entry.text === 'string')
        .map((entry) => ({
          text: String(entry.text || ''),
          updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : null,
        }));
    }
  } catch (error) {
    console.warn('⚠️ [V2 API] 讀取評語歷史失敗（略過，不影響主流程）:', error.message);
  }

  return {
    basePath,
    photos,
    videos,
    comment: comment || null,
    commentHistory,
  };
}
/**
 * ==================== V2 學生 API ====================
 * 提供給 React V2 前端使用的學生相關 API
 * 支援評語欄位和完整的學生數據管理
 * 🔥 使用與 perfect-calendar-modular.html 相同的學生匹配邏輯
 */

// 🔥 載入共用的課程標題解析和學生匹配模組（與前端共用）
const CourseTitleParser = require(path.join(__dirname, '../public/js/modules/course-title-parser.js'));
const StudentCourseMatcher = require(path.join(__dirname, '../public/js/modules/student-course-matcher.js'));

// 🔥 停課關鍵字（與前端一致）
const SUSPENSION_KEYWORDS = ['停課', '取消', '暫停', '休息', '放假', '請假'];

/**
 * 讀取學生篩選配置
 */
function getStudentFilterConfig() {
  try {
    const configPath = path.join(__dirname, '../data/student-filter-config.json');
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn('⚠️ 無法載入學生篩選配置，使用預設值:', error);
  }
  // 預設配置
  return {
    debugMode: false,
    enableRemainingCheck: true,
    minRemainingClasses: 1,
    showInCurrentWeek: true
  };
}

/**
 * 檢查課程是否停課
 */
function isCourseSuspended(courseTitle) {
  if (!courseTitle) return false;
  const titleUpper = courseTitle.toUpperCase();
  return SUSPENSION_KEYWORDS.some(keyword => titleUpper.includes(keyword.toUpperCase()));
}

/**
 * 檢查學生出缺席狀態
 * @param {Object} student - 學生物件
 * @param {string} dateKey - 日期 (YYYY-MM-DD)
 * @returns {Object} { status: 'present'|'leave'|'absent'|'unknown', locked: boolean }
 */
function checkAttendanceStatus(student, dateKey) {
  if (!student || !dateKey) {
    return { status: 'unknown', locked: false };
  }

  const records = Array.isArray(student.attendance) ? student.attendance : [];
  const matchedRecord = records.find(entry => {
    if (!entry || !entry.date) return false;
    const entryDate = new Date(entry.date).toISOString().split('T')[0];
    return entryDate === dateKey;
  });

  if (!matchedRecord) {
    return { status: 'unknown', locked: false };
  }

  const presentValue = matchedRecord.present;
  let status = 'unknown';

  if (presentValue === true) {
    status = 'present';
  } else if (presentValue === false) {
    status = 'absent';
  } else if (typeof presentValue === 'string') {
    const normalized = presentValue.toLowerCase();
    if (normalized === 'leave') {
      status = 'leave';
    } else if (normalized === 'absent' || normalized === 'absence') {
      status = 'absent';
    } else if (normalized === 'present') {
      status = 'present';
    }
  }

  // 🔥 請假或缺席時鎖定上傳
  const locked = (status === 'leave' || status === 'absent');

  return { status, locked };
}

/**
 * 將 Google Sheets 學生數據轉換為 V2 格式
 * 🔥 使用 CourseStudentMatcher 確保與前端匹配邏輯一致
 * @param {Array} students - Google Sheets 學生數據
 * @param {string} courseTitle - 課程標題（完整標題，如 "SPIKE 五 16:10-17:40 松山 第8週"）
 * @param {Object} event - 課程事件物件（可選，用於更精確的匹配）
 * @param {string} dateKey - 課程日期 (YYYY-MM-DD)
 * @returns {Array} V2 格式的學生數據
 */
function transformStudentsToV2Format(students, courseTitle = null, event = null, dateKey = null) {
  if (!Array.isArray(students)) {
    return [];
  }

  // 🔥 第一步：只保留有完整 course 和 period 的學生
  let filteredStudents = students.filter(student => {
    const hasCourse = student.course && String(student.course).trim() !== '';
    const hasPeriod = student.period && String(student.period).trim() !== '';
    return hasCourse && hasPeriod;
  });

  console.log(`📊 [V2 Students] 資料完整性檢查:`, {
    原始學生數: students.length,
    有完整資料: filteredStudents.length,
    被過濾掉: students.length - filteredStudents.length
  });

  // 🔥 第二步：讀取學生篩選配置
  const filterConfig = getStudentFilterConfig();
  console.log(`⚙️ [V2 Students] 學生篩選配置:`, filterConfig);

  // 🔥 第三步：檢查課程是否停課
  const isSuspended = isCourseSuspended(courseTitle);
  if (isSuspended) {
    console.warn(`⛔ [V2 Students] 課程已停課，不返回學生:`, courseTitle);
    return []; // 停課時不返回任何學生
  }

  // 🔥 第四步：預處理學生數據並檢查剩餘堂數
  const weekdayMap = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0 };
  
  filteredStudents = filteredStudents.filter(student => {
    // 解析 period
    if (student.period && !student.periodParsed) {
      try {
        const parsed = CourseTitleParser.parse(student.period);
        student.periodParsed = {
          ...parsed,
          weekdays: parsed.weekday ? [weekdayMap[parsed.weekday] || 0] : []
        };
      } catch (error) {
        console.warn(`⚠️ 解析學生時段失敗: ${student.name}`, error);
      }
    }

    // 🔥 剩餘堂數檢查（補課/體驗學生跳過）
    const isMakeupOrTrial = student.type === 'makeup' || student.type === 'trial';
    if (filterConfig.enableRemainingCheck && !isMakeupOrTrial) {
      const remaining = parseInt(student.remaining) || 0;
      let hasRemainingClasses = remaining >= filterConfig.minRemainingClasses;

      // 🔥 智能持續顯示：一週內有簽到記錄的學生仍然顯示
      if (!hasRemainingClasses && filterConfig.showInCurrentWeek) {
        let lastAttendanceDate = student.lastAttendanceDate || student.last_attendance_date;
        if (!lastAttendanceDate && student.attendance && Array.isArray(student.attendance)) {
          const presentRecords = student.attendance.filter(record => record.present === true);
          if (presentRecords.length > 0) {
            presentRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
            lastAttendanceDate = presentRecords[0].date;
          }
        }
        if (lastAttendanceDate) {
          const attendanceDate = new Date(lastAttendanceDate);
          const now = new Date();
          const daysDiff = Math.floor((now - attendanceDate) / (1000 * 60 * 60 * 24));
          if (daysDiff <= 7) {
            hasRemainingClasses = true;
            console.log(`   🎯 智能持續顯示: ${student.name} (上次簽到 ${daysDiff} 天前)`);
          }
        }
      }

      if (!hasRemainingClasses) {
        console.log(`   ❌ 過濾學生: ${student.name} (剩餘堂數: ${remaining} < ${filterConfig.minRemainingClasses})`);
        return false;
      }
    }

    return true;
  });

  console.log(`✅ [V2 Students] 剩餘堂數篩選後: ${filteredStudents.length} 位學生`);

  // 🔥 如果提供了課程標題和事件，使用新版 StudentCourseMatcher 進行匹配
  if (courseTitle && event) {
    // 解析課程標題獲取課程名稱
    const parsed = CourseTitleParser.parse(courseTitle);
    const courseName = parsed.courseName;

    console.log('📚 [V2 Students] 課程匹配:', {
      courseTitle,
      parsed: parsed.courseName,
      weekday: parsed.weekday,
      location: parsed.location
    });

    // 🔥 使用新版 StudentCourseMatcher.matchStudentsForEvent（與前端一致）
    // ⚠️ 注意：必須傳入已過濾的 filteredStudents，而不是原始的 students
    filteredStudents = StudentCourseMatcher.matchStudentsForEvent(
      event,
      filteredStudents,  // 🔥 使用已過濾的學生列表（只包含有 course 和 period 的學生）
      {
        withConfidence: true,        // 啟用信心度評分
        timeTolerance: 10,           // 開始時間容忍 10 分鐘
        durationTolerance: 20,       // 持續時間容忍 20 分鐘（與前端一致）
        checkRemaining: false,       // 不檢查剩餘堂數
        strictDateCheck: false       // 不嚴格檢查日期
      }
    );

    console.log(`✅ [V2 Students] 匹配結果:`, {
      總學生數: students.length,
      匹配到: filteredStudents.length,
      有event精確匹配: true,
      前3位學生: filteredStudents.slice(0, 3).map(s => ({
        name: s.name,
        course: s.course,
        period: s.period,
        confidence: s._matchConfidence || null
      }))
    });
  } else if (courseTitle) {
    // 沒有 event 時，只按課程名稱過濾（在已過濾的學生中再過濾）
    const parsed = CourseTitleParser.parse(courseTitle);
    const courseName = parsed.courseName.toUpperCase();
    
    filteredStudents = filteredStudents.filter(s => 
      (s.course || '').toUpperCase() === courseName
    );
    
    console.log(`✅ [V2 Students] 僅課程名稱匹配:`, {
      原始學生數: students.length,
      匹配到: filteredStudents.length
    });
  }

  // 🔥 第五步：補充出缺席狀態和上傳鎖定狀態
  const studentsWithAttendance = filteredStudents.map(student => {
    if (dateKey) {
      const attendanceInfo = checkAttendanceStatus(student, dateKey);
      student.attendanceStatus = attendanceInfo.status;
      student.attendanceLocked = attendanceInfo.locked;
      if (attendanceInfo.locked) {
        const statusText = attendanceInfo.status === 'leave' ? '今日已請假' : '今日缺席';
        console.log(`   🔒 鎖定學生: ${student.name} (${statusText})`);
      }
    }

    if (!student.attendanceStatus || student.attendanceStatus === 'unknown') {
      console.log(`   ℹ️ 標記學生為未紀錄: ${student.name}（無出缺席紀錄）`);
      student.attendanceStatus = 'unknown';
      student.attendanceLocked = false;
    }

    return student;
  });

  console.log(`✅ [V2 Students] 最終返回: ${studentsWithAttendance.length} 位學生`);

  return studentsWithAttendance.map((student, index) => {
    const attendanceStatus = student.attendanceStatus || 'present';
    const attendanceLocked = attendanceStatus === 'leave' || attendanceStatus === 'absent';

    return {
      id: student.id || `student-${index + 1}`,
      name: student.name || student.nickname || '未知學生',
      courseId: courseTitle || 'unknown',
      attendance: attendanceStatus,
      attendanceLocked,
      comment: student.comment || '',
      uploadStatus: {
        photos: 0,
        videos: 0,
        completed: false,
      },
      metadata: {
        grade: student.grade || null,
        parentContact: student.parentContact || null,
        course: student.course || null,
        period: student.period || null,
        confidence: student.confidence || null,
        originalData: student,
      },
    };
  });
}

/**
 * GET /api/v2/courses/:courseId/students
 * 獲取指定課程的學生列表
 * 🔥 courseId 應該是完整的課程標題，如 "SPIKE 五 16:10-17:40 松山 第8週"
 * 或使用 query 參數 courseTitle
 */
router.get('/courses/:courseId/students', async (req, res) => {
  try {
    // 支援兩種方式：路徑參數或 query 參數
    const courseTitle = req.query.courseTitle || decodeURIComponent(req.params.courseId);
    const courseId = req.params.courseId;
    console.log(`📚 [V2 API] 獲取課程學生: ${courseTitle} (ID: ${courseId})`);

    // 從 Google Sheets 獲取學生數據
    const googleSheetsStudents = req.app.get('googleSheetsStudents');
    
    if (!googleSheetsStudents) {
      throw new Error('Google Sheets Students 服務未初始化');
    }

    // 獲取所有學生（讓 CourseStudentMatcher 來篩選）
    const result = await googleSheetsStudents.getAllStudents();
    
    if (!result.success) {
      throw new Error(result.error || '獲取學生數據失敗');
    }

    // 🔥 從事件快取中找到對應的 event 物件（用於精確匹配時間、星期、地點）
    let matchingEvent = null;
    const eventsCache = req.app.get('eventsCache');
    
    // 🔥 從快取物件中取得事件陣列（與 v2-courses.js 邏輯一致）
    const eventsList = eventsCache?.data?.events || eventsCache?.data?.data || [];
    
    console.log(`🔍 [V2 API] 事件快取診斷:`, {
      快取存在: !!eventsCache,
      快取就緒: eventsCache?.isReady || false,
      事件陣列大小: eventsList.length,
      查找courseId: courseId,
      查找courseTitle: courseTitle,
      快取前3筆事件ID: eventsList.slice(0, 3).map(e => ({
        evt_id: e.evt_id,
        id: e.id,
        title: e.title || e.summary
      }))
    });
    
    if (eventsList && Array.isArray(eventsList) && eventsList.length > 0) {
      const rawEvent = eventsList.find(event => {
        const eventId = event.evt_id || event.id;
        const eventTitle = event.title || event.summary || '';
        return eventId === courseId || eventTitle === courseTitle;
      });
      
      if (rawEvent) {
        // 🔥 轉換為 CourseStudentMatcher 期待的格式
        matchingEvent = {
          title: rawEvent.title || rawEvent.summary || '',
          start: rawEvent.dtstart,  // Unix timestamp
          end: rawEvent.dtend,      // Unix timestamp  
          location: rawEvent.location || '',
          time: rawEvent.time || '',
          // 保留原始數據
          _raw: rawEvent
        };
        
        console.log(`✅ [V2 API] 找到對應事件:`, {
          id: rawEvent.evt_id || rawEvent.id,
          title: matchingEvent.title,
          start: matchingEvent.start,
          end: matchingEvent.end,
          location: matchingEvent.location
        });
      } else {
        console.warn(`⚠️ [V2 API] 未找到對應事件，將使用課程名稱匹配`);
      }
    } else {
      console.error(`❌ [V2 API] eventsCache 不可用！`);
    }

    // 🔥 計算課程日期（用於出缺席檢查）
    let courseDate = null;
    if (matchingEvent && matchingEvent.start) {
      const timestamp = matchingEvent.start;
      const date = timestamp < 10000000000 
        ? new Date(timestamp * 1000) 
        : new Date(timestamp);
      if (!isNaN(date.getTime())) {
        courseDate = date.toISOString().split('T')[0];
      }
    }
    console.log(`📅 [V2 API] 課程日期: ${courseDate}`);

    // 🔥 使用共用模組進行匹配和轉換（傳入 event 進行精確匹配）
    const v2Students = transformStudentsToV2Format(
      result.students, 
      courseTitle,
      matchingEvent,  // 🔥 傳入 event 物件進行時間、星期、地點匹配
      courseDate      // 🔥 傳入課程日期進行出缺席檢查
    );

    console.log(`✅ [V2 API] 返回 ${v2Students.length} 位學生`);

    const learningUploadHelper = req.app.get('learningUploadHelper');
    const manualDateKey = typeof req.query.date === 'string' ? req.query.date : null;
    const dateKey = courseDate || manualDateKey || null;
    const manualSemester = typeof req.query.semester === 'string' ? req.query.semester : null;
    const courseSemester = manualSemester || (dateKey ? semesterHelper.getCurrentSemester(dateKey) : null);
    const topicParam = typeof req.query.topic === 'string' ? req.query.topic : '';

    let responseStudents = v2Students;

    if (learningUploadHelper && dateKey && courseSemester && v2Students.length > 0) {
      try {
        const normalizedCourseName = courseNameCleaner.cleanCourseName(courseTitle);

        console.log('🔍 [V2 API] 批次載入學習紀錄以建立學生上傳概況:', {
          semester: courseSemester,
          courseTitle,
          normalizedCourseName,
          dateKey,
          topic: topicParam,
          studentCount: v2Students.length,
        });

        // 🚀 [優化 2025-11-26] 優先使用索引快速查詢，避免掃描 Drive
        const learningRecordsIndex = require('../utils/learning-records-index');
        const courseSummary = await learningRecordsIndex.getCourseSummary({
          semester: courseSemester,
          courseName: normalizedCourseName,
          date: dateKey,
          topic: topicParam || '',
        });

        console.log('📊 [V2 API] 索引查詢結果:', {
          found: !!courseSummary,
          studentsInIndex: courseSummary ? Object.keys(courseSummary.students || {}).length : 0,
        });

        // 將索引資料轉換為 records 格式
        const records = [];
        if (courseSummary && courseSummary.students) {
          Object.values(courseSummary.students).forEach((studentEntry) => {
            if (!studentEntry) return;
            records.push({
              studentName: studentEntry.studentName,
              photoCount: studentEntry.photoCount || 0,
              videoCount: studentEntry.videoCount || 0,
              totalPhotos: studentEntry.photoCount || 0,
              totalVideos: studentEntry.videoCount || 0,
              comment: studentEntry.hasComment ? '(有評語)' : '',
              uploadTime: studentEntry.lastUploadTime || studentEntry.lastUpdatedAt,
              isOverview: false,
            });
          });
        }

        const recordMap = new Map();

        if (Array.isArray(records) && records.length > 0) {
          records.forEach((record) => {
            if (!record || record.isOverview) return;

            const key = String(record.studentName || '').trim();
            if (!key) return;

            const existing = recordMap.get(key);
            if (!existing) {
              recordMap.set(key, record);
              return;
            }

            const currentIso = normalizeTimestampInput(existing.uploadTime);
            const candidateIso = normalizeTimestampInput(record.uploadTime);
            const latest = pickLatestTimestamp(currentIso, candidateIso);
            if (latest === candidateIso) {
              recordMap.set(key, record);
            }
          });
        }

        const buildOverviewFromRecord = (record) => {
          if (!record) {
            return {
              uploadStatus: createEmptyUploadStatus(),
              uploadOverview: createEmptyUploadOverview(),
            };
          }

          const newMediaPhotos = Array.isArray(record.newMediaPhotos) ? record.newMediaPhotos : [];
          const legacyPhotos = Array.isArray(record.photos) ? record.photos : [];
          const newMediaVideos = Array.isArray(record.newMediaVideos) ? record.newMediaVideos : [];
          const legacyVideos = Array.isArray(record.videos) ? record.videos : [];

          const metaPhotoCount = newMediaPhotos.length;
          const metaVideoCount = newMediaVideos.length;

          let photoCount;
          if (metaPhotoCount > 0) {
            photoCount = metaPhotoCount;
          } else if (typeof record.totalPhotos === 'number') {
            photoCount = record.totalPhotos;
          } else if (typeof record.photoCount === 'number') {
            photoCount = record.photoCount;
          } else {
            photoCount = legacyPhotos.length;
          }

          let videoCount;
          if (metaVideoCount > 0) {
            videoCount = metaVideoCount;
          } else if (typeof record.totalVideos === 'number') {
            videoCount = record.totalVideos;
          } else if (typeof record.videoCount === 'number') {
            videoCount = record.videoCount;
          } else {
            videoCount = legacyVideos.length;
          }

          // 🔍 [除錯 2025-11-26] 記錄計算過程
          console.log('📊 [buildOverviewFromRecord] 計算結果:', {
            studentName: record.studentName,
            photoCount,
            videoCount,
            sources: {
              metaPhotoCount,
              'record.totalPhotos': record.totalPhotos,
              'record.photoCount': record.photoCount,
              legacyPhotosLength: legacyPhotos.length,
              metaVideoCount,
              'record.totalVideos': record.totalVideos,
              'record.videoCount': record.videoCount,
              legacyVideosLength: legacyVideos.length,
            },
          });

          const uploadedCount = photoCount + videoCount;
          const hasComment = typeof record.comment === 'string' && record.comment.trim().length > 0;

          let latestUploadIso = normalizeTimestampInput(record.uploadTime);

          newMediaPhotos.forEach((entry) => {
            const iso = normalizeTimestampInput(entry.uploadedAt || entry.updatedAt || entry.createdAt);
            latestUploadIso = pickLatestTimestamp(latestUploadIso, iso);
          });

          newMediaVideos.forEach((entry) => {
            const iso = normalizeTimestampInput(entry.uploadedAt || entry.updatedAt || entry.createdAt);
            latestUploadIso = pickLatestTimestamp(latestUploadIso, iso);
          });

          return {
            uploadStatus: {
              photos: photoCount,
              videos: videoCount,
              completed: photoCount > 0 && videoCount > 0,
            },
            uploadOverview: {
              uploadedCount,
              hasComment,
              lastUploadAt: latestUploadIso,
              lastCommentAt: null,
            },
          };
        };

        responseStudents = v2Students.map((student) => {
          const key = String(student.name || '').trim();
          const record = recordMap.get(key) || null;

          const { uploadStatus, uploadOverview } = buildOverviewFromRecord(record);

          return {
            ...student,
            uploadStatus,
            uploadOverview,
          };
        });
      } catch (error) {
        console.error('⚠️ [V2 API] 批次建立上傳概況失敗:', error.message);
        responseStudents = v2Students.map((student) => ({
          ...student,
          uploadOverview: createEmptyUploadOverview(),
        }));
      }
    } else {
      responseStudents = v2Students.map((student) => ({
        ...student,
        uploadOverview: createEmptyUploadOverview(),
      }));
    }

    res.json({
      success: true,
      data: responseStudents,
      message: `找到 ${v2Students.length} 位學生`,
      metadata: {
        courseTitle,
        totalStudents: result.students.length,
        matchedStudents: v2Students.length,
        hasEventMatch: !!matchingEvent
      }
    });
  } catch (error) {
    console.error('❌ [V2 API] 獲取課程學生失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: [],
    });
  }
});

/**
 * GET /api/v2/students/:id
 * 獲取單個學生資訊
 */
router.get('/students/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`📚 [V2 API] 獲取學生資訊: ${id}`);

    const googleSheetsStudents = req.app.get('googleSheetsStudents');
    
    if (!googleSheetsStudents) {
      throw new Error('Google Sheets Students 服務未初始化');
    }

    // 獲取所有學生
    const result = await googleSheetsStudents.getAllStudents();
    
    if (!result.success) {
      throw new Error(result.error || '獲取學生數據失敗');
    }

    // 查找指定學生
    const student = result.students.find((s) => s.id === id || s.name === id);
    
    if (!student) {
      return res.status(404).json({
        success: false,
        error: '學生不存在',
        data: null,
      });
    }

    // 轉換為 V2 格式
    const v2Students = transformStudentsToV2Format([student]);
    
    res.json({
      success: true,
      data: v2Students[0] || null,
    });
  } catch (error) {
    console.error('❌ [V2 API] 獲取學生失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null,
    });
  }
});

/**
 * PATCH /api/v2/students/:id/attendance
 * 更新學生出席狀態
 */
router.patch('/students/:id/attendance', async (req, res) => {
  try {
    const { id } = req.params;
    const { attendance } = req.body;

    console.log(`📝 [V2 API] 更新出席狀態: ${id} -> ${attendance}`);

    // 驗證出席狀態
    const validStatuses = ['present', 'absent', 'leave', 'unknown'];
    if (!validStatuses.includes(attendance)) {
      return res.status(400).json({
        success: false,
        error: '無效的出席狀態',
      });
    }

    // TODO: 實現出席狀態儲存邏輯
    // 目前只是模擬成功響應
    // 實際應該儲存到資料庫或檔案系統

    res.json({
      success: true,
      message: '出席狀態已更新',
    });
  } catch (error) {
    console.error('❌ [V2 API] 更新出席狀態失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/v2/students/attendance/batch
 * 批次更新出席狀態
 */
router.post('/students/attendance/batch', async (req, res) => {
  try {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: '更新數據格式錯誤',
      });
    }

    console.log(`📝 [V2 API] 批次更新出席: ${updates.length} 位學生`);

    // TODO: 實現批次出席狀態儲存邏輯
    // 實際應該儲存到資料庫或檔案系統

    res.json({
      success: true,
      message: `已更新 ${updates.length} 位學生的出席狀態`,
    });
  } catch (error) {
    console.error('❌ [V2 API] 批次更新出席失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/v2/students/:studentId/upload-status
 * 獲取學生上傳狀態
 */
router.get('/students/:studentId/upload-status', async (req, res) => {
  try {
    const { studentId } = req.params;
    const {
      semester,
      courseName,
      date,
      studentName,
      topic,
    } = req.query;

    console.log(`📊 [V2 API] 獲取上傳狀態: ${studentId}`, {
      semester,
      courseName,
      date,
      studentName,
    });

    if (!semester || !courseName || !date || !studentName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要欄位：semester, courseName, date, studentName',
        data: {
          uploadStatus: createEmptyUploadStatus(),
          uploadOverview: createEmptyUploadOverview(),
        },
      });
    }

    const learningUploadHelper = req.app.get('learningUploadHelper');
    if (!learningUploadHelper) {
      console.error('❌ [V2 API] LearningUploadHelper 未初始化，無法取得上傳狀態');
      return res.status(503).json({
        success: false,
        error: '學習歷程服務未初始化，無法取得上傳狀態',
      });
    }

    const overview = await buildStudentUploadOverview(learningUploadHelper, {
      semester,
      courseName,
      date,
      studentName,
      topic,
    });

    const uploadStatus = {
      photos: overview.photos || 0,
      videos: overview.videos || 0,
      completed: overview.photos > 0 && overview.videos > 0,
    };

    const uploadOverview = {
      uploadedCount: overview.uploadedCount,
      hasComment: overview.hasComment,
      lastUploadAt: overview.lastUploadAt,
      lastCommentAt: overview.lastCommentAt,
    };

    res.json({
      success: true,
      data: {
        uploadStatus,
        uploadOverview,
      },
    });
  } catch (error) {
    console.error('❌ [V2 API] 獲取上傳狀態失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: {
        uploadStatus: createEmptyUploadStatus(),
        uploadOverview: createEmptyUploadOverview(),
      },
    });
  }
});

/**
 * PATCH /api/v2/students/:id/comment
 * 使用 V2 API 更新學生評語，並同步到 Synology Drive：
 * - 更新 comment.txt
 * - 更新 record-meta.json.comment（若存在）
 */
router.patch('/students/:id/comment', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      comment,
      semester,
      courseName,
      date,
      topic,
      studentName,
    } = req.body || {};

    console.log('💬 [V2 API] 更新評語請求:', {
      id,
      semester,
      courseName,
      date,
      topic,
      studentName,
      hasComment: typeof comment === 'string' && comment.trim().length > 0,
    });

    if (typeof comment !== 'string') {
      return res.status(400).json({
        success: false,
        error: '評語格式錯誤，必須為字串',
      });
    }

    if (!semester || !courseName || !date || !studentName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要欄位：semester, courseName, date, studentName',
      });
    }

    const learningUploadHelper = req.app.get('learningUploadHelper');
    if (!learningUploadHelper) {
      console.error('❌ [V2 API] LearningUploadHelper 未初始化，無法更新評語');
      return res.status(503).json({
        success: false,
        error: '學習歷程服務未初始化，無法更新評語',
      });
    }

    const normalizedCourseName = courseNameCleaner.cleanCourseName(courseName);
    const resolvedTopic = learningUploadHelper._resolveTopicInput(topic, normalizedCourseName);
    const result = await learningUploadHelper.updateStudentComment({
      semester,
      courseName: normalizedCourseName,
      date,
      topic: resolvedTopic,
      studentName,
      comment,
    });

    return res.json({
      success: true,
      message: '評語已更新',
      data: {
        id,
        semester,
        courseName: normalizedCourseName,
        date,
        topic: resolvedTopic,
        studentName,
        comment: result.comment,
        basePath: result.basePath,
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('❌ [V2 API] 更新評語失敗:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '更新評語失敗',
    });
  }
});

/**
 * GET /api/v2/students/:id/learning-records
 * 獲取特定學生的學習記錄（已上傳的檔案）
 *
 * Query 參數：
 * - semester: 學期（例如 114-1）
 * - courseName: 完整課程名稱
 * - date: 日期（YYYY-MM-DD）
 * - studentName: 學生姓名
 */
router.get('/students/:id/learning-records', async (req, res) => {
  try {
    const { id } = req.params;
    const { semester, courseName, date, studentName, topic } = req.query;

    console.log('🔍 [V2 API] 獲取學生學習記錄:', { id, semester, courseName, date, studentName });

    if (!semester || !courseName || !date || !studentName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要欄位：semester, courseName, date, studentName',
      });
    }

    const learningUploadHelper = req.app.get('learningUploadHelper');
    if (!learningUploadHelper) {
      console.error('❌ [V2 API] LearningUploadHelper 未初始化，無法獲取學習記錄');
      return res.status(503).json({
        success: false,
        error: '學習歷程服務未初始化，無法獲取學習記錄',
      });
    }

    const payload = await buildLearningRecordsPayload(learningUploadHelper, {
      semester,
      courseName,
      date,
      studentName,
      topic,
    });

    return res.json({
      success: true,
      data: {
        photos: payload.photos,
        videos: payload.videos,
        comment: payload.comment,
        commentHistory: payload.commentHistory || [],
      },
    });
  } catch (error) {
    console.error('❌ [V2 API] 獲取學生學習記錄失敗:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '獲取學習記錄失敗',
    });
  }
});

/**
 * GET /api/v2/learning-records
 * 查詢學習歷程紀錄（V2 包裝版），重用 Synology Drive 後端邏輯
 *
 * Query 參數：
 * - semester: 學期（例如 114-1）
 * - courseName: 完整課程名稱（例如 SPIKE 五 16:10-17:40 松山 第8週）
 * - date: 日期（YYYY-MM-DD，可選，傳了會縮小範圍）
 * - course: 向後相容欄位，等同 courseName
 */
router.get('/learning-records', async (req, res) => {
  try {
    const { semester, courseName, date, course } = req.query;

    console.log('🔍 [V2 API] 查詢學習歷程紀錄:', { semester, courseName, course, date });

    const finalCourseName = courseName || course;

    const learningUploadHelper = req.app.get('learningUploadHelper');
    if (!learningUploadHelper) {
      console.error('❌ [V2 API] LearningUploadHelper 未初始化，無法查詢歷史紀錄');
      return res.status(503).json({
        success: false,
        error: '學習歷程服務未初始化，無法查詢歷史紀錄',
        data: [],
      });
    }

    const normalizedCourseName = finalCourseName ? courseNameCleaner.cleanCourseName(finalCourseName) : finalCourseName;
    const records = await learningUploadHelper.listLearningRecordsExact({
      semester,
      courseName: normalizedCourseName,
      date,
    });

    // 與 /api/learning-records/history-drive 類似，為每個檔案附上 url
    const recordsWithUrls = records.map((record) => {
      const photos = (record.photos || []).map((photo) => ({
        ...photo,
        url: photo.proxyUrl || (photo.path ? `/api/drive-media${photo.path}` : null),
      }));

      const videos = (record.videos || []).map((video) => ({
        ...video,
        url: video.proxyUrl || (video.path ? `/api/drive-media${video.path}` : null),
      }));

      const enriched = {
        ...record,
        photos,
        videos,
      };

      console.log('🔍 [V2 API] 歷史紀錄詳情:', {
        studentName: enriched.studentName,
        isOverview: enriched.isOverview,
        recordPath: enriched.recordPath,
        photos數量: photos.length,
        videos數量: videos.length,
      });

      return enriched;
    });

    console.log('✅ [V2 API] 歷史紀錄查詢成功，找到', recordsWithUrls.length, '筆記錄');

    return res.json({
      success: true,
      data: recordsWithUrls,
      message: `找到 ${recordsWithUrls.length} 筆學習歷程紀錄`,
      metadata: {
        semester: semester || null,
        courseName: finalCourseName || null,
        date: date || null,
      },
    });
  } catch (error) {
    console.error('❌ [V2 API] 歷史紀錄查詢失敗:', error);
    return res.status(500).json({
      success: false,
      error: error.message || '歷史紀錄查詢失敗',
      data: [],
    });
  }
});

// 將關鍵轉換函數掛載到 router，供其他模組（如 v2-courses.js）重用
router.transformStudentsToV2Format = transformStudentsToV2Format;

module.exports = router;
