const express = require('express');
const path = require('path');

const router = express.Router();

const todayCoursesService = require('../services/today-courses-service');
const v2StudentsRouter = require('./v2-students');
const transformStudentsToV2Format = v2StudentsRouter.transformStudentsToV2Format;
const semesterHelper = require('../utils/semester-helper');
const courseNameCleaner = require('../utils/course-name-cleaner');

/**
 * 解析並驗證 Deep Link 查詢參數
 */
function parseDeeplinkParams(query) {
  const courseId = typeof query.courseId === 'string' && query.courseId.trim() ? query.courseId.trim() : null;
  const courseTitle = typeof query.courseTitle === 'string' && query.courseTitle.trim() ? query.courseTitle.trim() : null;
  const date = typeof query.date === 'string' && query.date.trim() ? query.date.trim() : null;
  const instructor = typeof query.instructor === 'string' && query.instructor.trim() ? query.instructor.trim() : null;

  return { courseId, courseTitle, date, instructor };
}

/**
 * 從課程列表中解析出目標課程
 */
function resolveCourseFromList(courses, params) {
  const { courseId, courseTitle } = params;

  let target = null;

  if (courseId) {
    target = courses.find((course) => String(course.id) === String(courseId));
  }

  if (!target && courseTitle) {
    target = courses.find((course) => course.name === courseTitle || course.courseName === courseTitle);
  }

  return target || null;
}

/**
 * 從事件快取尋找對應的 raw event（供學生匹配使用）
 */
function findMatchingEventFromCache(app, course) {
  const eventsCache = app.get('eventsCache');
  const eventsList = eventsCache?.data?.events || eventsCache?.data?.data || [];

  if (!Array.isArray(eventsList) || !eventsList.length || !course) {
    return null;
  }

  const rawEvent = eventsList.find((event) => {
    if (!event) return false;
    const eventId = event.evt_id || event.id || `event-${event.dtstart}`;
    const title = event.title || event.summary || '';
    return (
      String(eventId) === String(course.id) ||
      title === course.name
    );
  });

  if (!rawEvent) {
    return null;
  }

  return {
    title: rawEvent.title || rawEvent.summary || '',
    start: rawEvent.dtstart,
    end: rawEvent.dtend,
    location: rawEvent.location || '',
    time: rawEvent.time || '',
    _raw: rawEvent,
  };
}

/**
 * 從 matchingEvent 計算課程日期 (YYYY-MM-DD)
 */
function getCourseDateFromEvent(matchingEvent) {
  if (!matchingEvent || !matchingEvent.start) {
    return null;
  }

  const timestamp = matchingEvent.start;
  const date = timestamp < 10000000000
    ? new Date(timestamp * 1000)
    : new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().split('T')[0];
}

/**
 * GET /api/v2/deeplink-course
 * 一次回傳：課程 + 學生列表 + 基本設定
 */
router.get('/deeplink-course', async (req, res) => {
  try {
    const params = parseDeeplinkParams(req.query);
    const { courseId, courseTitle, date } = params;

    console.log('🔗 [V2 Deeplink] 解析 Deep Link 參數:', params);

    if (!courseId && !courseTitle && !date) {
      return res.status(400).json({
        success: false,
        code: 'MISSING_DEEPLINK_PARAMS',
        error: '需要至少提供 courseId 或 (courseTitle + date)',
      });
    }

    // 1️⃣ 先從 today-courses service 取得指定日期的課程列表
    const targetDate = date || new Date().toISOString().split('T')[0];
    const { courses } = await todayCoursesService.getTodayCourses(req.app, { dateOverride: targetDate });

    if (!Array.isArray(courses) || !courses.length) {
      console.warn('⚠️ [V2 Deeplink] 指定日期沒有課程:', targetDate);
      return res.status(404).json({
        success: false,
        code: 'COURSE_NOT_FOUND',
        error: '指定日期沒有找到對應課程',
      });
    }

    // 2️⃣ 嘗試從課程列表中解析出目標課程
    const course = resolveCourseFromList(courses, params);

    if (!course) {
      console.warn('⚠️ [V2 Deeplink] 無法從課程列表解析目標課程:', {
        params,
        courseCount: courses.length,
      });
      return res.status(404).json({
        success: false,
        code: 'COURSE_NOT_FOUND',
        error: '找不到對應課程',
      });
    }

    console.log('✅ [V2 Deeplink] 已解析目標課程:', {
      id: course.id,
      name: course.name,
      date: course.date,
      teacherId: course.teacherId,
    });

    // 3️⃣ 準備學生資料來源
    const googleSheetsStudents = req.app.get('googleSheetsStudents');

    if (!googleSheetsStudents) {
      throw new Error('Google Sheets Students 服務未初始化');
    }

    const studentResult = await googleSheetsStudents.getAllStudents();

    if (!studentResult || !studentResult.success || !Array.isArray(studentResult.students)) {
      throw new Error(studentResult?.error || '獲取學生數據失敗');
    }

    // 4️⃣ 從事件快取找到 matchingEvent，讓 transformStudentsToV2Format 可以做精準匹配
    const matchingEvent = findMatchingEventFromCache(req.app, course);
    const courseDate = course.date || getCourseDateFromEvent(matchingEvent) || targetDate;

    console.log('📅 [V2 Deeplink] 課程日期解析結果:', {
      fromCourse: course.date,
      fromEvent: getCourseDateFromEvent(matchingEvent),
      final: courseDate,
    });

    // 5️⃣ 使用共用轉換函數建立 V2 學生列表
    const v2Students = transformStudentsToV2Format(
      studentResult.students,
      course.name,
      matchingEvent,
      courseDate,
    );

    console.log(`✅ [V2 Deeplink] 建立 V2 學生列表: ${v2Students.length} 位`);

    // 6️⃣ 基本設定（目前以 semester 為主，其餘可按需擴充）
    const resolvedSemester = course.semester || semesterHelper.getCurrentSemester(courseDate);

    const settings = {
      semester: resolvedSemester,
      topic: course.metadata?.parsed?.topic || null,
      classroom: course.location || null,
    };

    // 7️⃣ 組合回應
    return res.json({
      success: true,
      data: {
        course,
        students: v2Students,
        settings,
      },
    });
  } catch (error) {
    console.error('❌ [V2 Deeplink] Deep Link API 失敗:', error);
    return res.status(500).json({
      success: false,
      code: 'DEEPLINK_INTERNAL_ERROR',
      error: error.message || 'Deep Link API 失敗',
    });
  }
});

module.exports = router;
