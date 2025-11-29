/**
 * FLB V2 課程 API 路由
 * 將 Synology Calendar 事件轉換為前端課程格式
 * 🔥 使用與 perfect-calendar-modular.html 相同的解析邏輯
 */

const express = require('express');
const router = express.Router();
const path = require('path');

// 🔥 載入共用的課程標題解析模組（與前端共用）
const CourseTitleParser = require(path.join(__dirname, '../public/js/modules/course-title-parser.js'));
const v2StudentsRouter = require('./v2-students');
const transformStudentsToV2Format = v2StudentsRouter.transformStudentsToV2Format;
const courseNameCleaner = require('../utils/course-name-cleaner');
const semesterHelper = require('../utils/semester-helper');
const learningRecordsIndex = require('../utils/learning-records-index');

/**
 * 將事件轉換為課程格式
 * 🔥 使用 CourseTitleParser 確保與前端解析一致
 */
function eventToCourse(event) {
  // 解析日期和時間
  const startDate = new Date(event.dtstart * 1000);
  const endDate = new Date(event.dtend * 1000);
  
  const dateStr = startDate.toISOString().split('T')[0];
  const startTime = startDate.toTimeString().slice(0, 5);
  const endTime = endDate.toTimeString().slice(0, 5);
  
  // 🔥 使用共用模組解析課程標題
  const title = event.title || event.summary || '';
  const parsed = CourseTitleParser.parse(title);
  
  // 解析週次（如果有）
  const weekMatch = title.match(/第(\d+)週/);
  const weekNumber = weekMatch ? parseInt(weekMatch[1]) : undefined;
  
  // 解析學期（預設當前年度）
  const year = startDate.getFullYear();
  const month = startDate.getMonth() + 1;
  let semester = `${year}上學期`;
  if (month >= 2 && month <= 7) {
    semester = `${year}下學期`;
  }
  
  return {
    id: event.evt_id || event.id || `event-${event.dtstart}`,
    name: title, // 保留完整標題
    courseName: parsed.courseName, // 🔥 解析後的課程名稱（如 SPIKE, EV3）
    date: dateStr,
    time: `${startTime}-${endTime}`,
    weekday: parsed.weekday, // 🔥 星期幾
    location: parsed.location || event.location || '',
    weekNumber,
    semester,
    teacherId: event.calendarId || event.cal_id,
    teacherName: event.instructor || event.cal_displayname || '',
    studentCount: 0, // 需要從學生資料計算
    status: getEventStatus(startDate, endDate),
    // 🔥 保留解析結果和原始事件
    metadata: {
      parsed, // 課程解析結果
      originalEvent: event
    }
  };
}

/**
 * 判斷課程狀態
 */
function getEventStatus(startDate, endDate) {
  const now = new Date();
  
  if (now < startDate) {
    return 'pending';
  } else if (now >= startDate && now <= endDate) {
    return 'in-progress';
  } else {
    return 'completed';
  }
}

/**
 * 過濾課程
 */
function filterCourses(courses, params) {
  let filtered = [...courses];
  
  // 日期範圍過濾
  if (params.startDate) {
    filtered = filtered.filter(c => c.date >= params.startDate);
  }
  if (params.endDate) {
    filtered = filtered.filter(c => c.date <= params.endDate);
  }
  
  // 地點過濾
  if (params.location) {
    const locationLower = params.location.toLowerCase();
    filtered = filtered.filter(c => 
      c.location.toLowerCase().includes(locationLower)
    );
  }
  
  // 講師過濾
  if (params.teacherId) {
    filtered = filtered.filter(c => c.teacherId === params.teacherId);
  }
  
  return filtered;
}

/**
 * GET /api/v2/courses
 * 獲取課程列表
 */
router.get('/courses', async (req, res) => {
  try {
    console.log('📚 [V2 Courses] 獲取課程列表', req.query);
    
    // 是否為輕量模式：僅返回課程基本資訊，不計算學生與上傳統計
    const mode = (req.query.mode || '').toString();
    const includeStatsParam = (req.query.includeStats || '').toString();
    const isSummaryMode = mode === 'summary' || includeStatsParam === 'false';
    
    // 從 app 獲取事件快取
    const eventsCache = req.app.get('eventsCache');
    
    if (!eventsCache || !eventsCache.data) {
      return res.status(503).json({
        success: false,
        error: '事件快取未就緒',
        data: []
      });
    }
    
    // 從快取中取得事件陣列（支援多種結構）
    const eventsList = eventsCache.data.events || eventsCache.data.data || [];
    
    if (!Array.isArray(eventsList)) {
      console.error('❌ [V2 Courses] 事件資料不是陣列:', typeof eventsList);
      return res.status(500).json({
        success: false,
        error: '事件資料格式錯誤',
        data: []
      });
    }
    
    // 轉換事件為課程
    const courses = eventsList.map(eventToCourse);
    
    // 過濾課程
    const filtered = filterCourses(courses, req.query);
    
    // 🔢 為每堂課計算學生數量與上傳統計（重用 V2 學生 API 的完整篩選邏輯）
    const googleSheetsStudents = req.app.get('googleSheetsStudents');
    const learningUploadHelper = req.app.get('learningUploadHelper');

    if (!isSummaryMode && googleSheetsStudents && typeof transformStudentsToV2Format === 'function') {
      try {
        const studentResult = await googleSheetsStudents.getAllStudents();
        if (studentResult && studentResult.success && Array.isArray(studentResult.students)) {
          const allStudents = studentResult.students;
          const eventMap = new Map();
          eventsList.forEach((event) => {
            if (!event) return;
            const id = event.evt_id || event.id || `event-${event.dtstart}`;
            if (id) {
              eventMap.set(id, event);
            }
          });

          for (const course of filtered) {
            // 預設統計值
            course.studentCount = course.studentCount || 0;
            course.uploadedStudentCount = 0;
            course.totalUploadedFiles = 0;

            try {
              const rawEvent = eventMap.get(course.id);
              if (!rawEvent) {
                course.studentCount = 0;
                continue;
              }

              const matchingEvent = {
                title: rawEvent.title || rawEvent.summary || '',
                start: rawEvent.dtstart,
                end: rawEvent.dtend,
                location: rawEvent.location || '',
                time: rawEvent.time || '',
                _raw: rawEvent,
              };

              const v2StudentsForCourse = transformStudentsToV2Format(
                allStudents,
                course.name,
                matchingEvent,
                course.date,
              ) || [];

              course.studentCount = Array.isArray(v2StudentsForCourse)
                ? v2StudentsForCourse.length
                : 0;

              // 📊 上傳統計：優先使用 learning-records-index 快速查詢
              if (course.date && course.name) {
                try {
                  const semester = course.semester || semesterHelper.getCurrentSemester(course.date);
                  const normalizedCourseName = courseNameCleaner.cleanCourseName(course.name);

                  // 🔍 [除錯 2025-11-26] 記錄課程名稱清理過程
                  console.log('🔍 [V2 Courses] 查詢上傳統計:', {
                    originalName: course.name,
                    cleanedName: normalizedCourseName,
                    semester,
                    date: course.date
                  });

                  // 🚀 使用索引快速查詢（避免掃描 Drive）
                  const courseSummary = await learningRecordsIndex.getCourseSummary({
                    semester,
                    courseName: normalizedCourseName,
                    date: course.date,
                    topic: '', // 可選：若需要區分主題
                  });

                  console.log('📊 [V2 Courses] 索引查詢結果:', {
                    found: !!courseSummary,
                    summary: courseSummary ? {
                      studentsCount: Object.keys(courseSummary.students || {}).length,
                      hasOverview: !!courseSummary.overview
                    } : null
                  });

                  if (courseSummary) {
                    // 統計學生上傳數
                    const students = courseSummary.students || {};
                    const uploadedStudentSet = new Set();
                    let totalFiles = 0;

                    Object.values(students).forEach((studentEntry) => {
                      if (!studentEntry) return;
                      const photoCount = studentEntry.photoCount || 0;
                      const videoCount = studentEntry.videoCount || 0;
                      const fileCount = photoCount + videoCount;

                      if (fileCount > 0 || studentEntry.hasComment) {
                        const studentName = String(studentEntry.studentName || '').trim();
                        if (studentName) {
                          uploadedStudentSet.add(studentName);
                          totalFiles += fileCount;
                        }
                      }
                    });

                    course.uploadedStudentCount = uploadedStudentSet.size;
                    course.totalUploadedFiles = totalFiles;

                    // 課程總覽統計
                    const overview = courseSummary.overview;
                    if (overview) {
                      const hasOverviewContent = overview.hasPhotos || overview.hasVideos || overview.hasSummary;
                      course.overviewUploaded = hasOverviewContent;
                      // 若索引有記錄檔案數，可在此補充
                      course.overviewFileCount = hasOverviewContent ? 1 : 0;
                    } else {
                      course.overviewUploaded = false;
                      course.overviewFileCount = 0;
                    }
                  }
                } catch (uploadStatsError) {
                  console.warn('⚠️ [V2 Courses] 計算課程上傳統計失敗:', {
                    courseId: course.id,
                    courseName: course.name,
                    error: uploadStatsError.message,
                  });
                }
              }
            } catch (countError) {
              console.warn('⚠️ [V2 Courses] 計算課程學生數量失敗:', {
                courseId: course.id,
                courseName: course.name,
                error: countError.message,
              });
              course.studentCount = 0;
            }
          }
        }
      } catch (studentError) {
        console.warn('⚠️ [V2 Courses] 批次載入學生資料以計算學生數失敗:', studentError.message);
      }
    }
    
    // 排序（按日期和時間）
    filtered.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.time.localeCompare(b.time);
    });
    
    console.log(`✅ [V2 Courses] 返回 ${filtered.length} 個課程`);
    
    res.json({
      success: true,
      data: filtered
    });
    
  } catch (error) {
    console.error('❌ [V2 Courses] 獲取課程失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: []
    });
  }
});

/**
 * GET /api/v2/courses/search
 * 搜尋課程
 */
router.get('/courses/search', async (req, res) => {
  try {
    const { q } = req.query;
    console.log('🔍 [V2 Courses] 搜尋課程:', q);
    
    if (!q) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const eventsCache = req.app.get('eventsCache');
    
    if (!eventsCache || !eventsCache.data) {
      return res.status(503).json({
        success: false,
        error: '事件快取未就緒',
        data: []
      });
    }
    
    // 轉換並搜尋
    const keyword = q.toLowerCase();
    const courses = eventsCache.data
      .map(eventToCourse)
      .filter(course => 
        course.name.toLowerCase().includes(keyword) ||
        course.location.toLowerCase().includes(keyword) ||
        (course.teacherName && course.teacherName.toLowerCase().includes(keyword))
      );
    
    console.log(`✅ [V2 Courses] 找到 ${courses.length} 個匹配課程`);
    
    res.json({
      success: true,
      data: courses
    });
    
  } catch (error) {
    console.error('❌ [V2 Courses] 搜尋課程失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: []
    });
  }
});

/**
 * GET /api/v2/courses/upload-stats
 * 查詢單一課程的上傳統計（供原版日曆使用）
 * 🎯 為 perfect-calendar-modular.html 提供輕量級統計資料
 * 
 * Query Parameters:
 * - eventId: 課程事件 ID
 * - date: 課程日期 (YYYY-MM-DD)
 * - courseName: 課程名稱
 */
router.get('/courses/upload-stats', async (req, res) => {
  try {
    const { eventId, date, courseName } = req.query;
    
    // 參數驗證
    if (!date || !courseName) {
      return res.status(400).json({
        success: false,
        error: '缺少必要參數 (date, courseName)',
        data: null
      });
    }
    
    console.log('📊 [V2 Courses] 查詢上傳統計:', { eventId, date, courseName });
    
    // 1️⃣ 取得學期
    const semester = semesterHelper.getCurrentSemester(date);
    
    // 2️⃣ 清理課程名稱（移除週次）
    const cleanedCourseName = courseNameCleaner.cleanCourseName(courseName);
    
    console.log('📊 [V2 Courses] 上傳統計查詢:', {
      eventId,
      date,
      originalCourseName: courseName,
      cleanedCourseName
    });
    
    // 3️⃣ 查詢索引（模糊匹配 topic）
    const courseSummary = await learningRecordsIndex.getCourseSummary({
      semester,
      courseName: cleanedCourseName,
      date,
      topic: '' // 模糊匹配（不指定主題）
    });
    
    // 4️⃣ 計算學生總數（從事件快取和 Google Sheets）
    let totalStudents = 0;
    const eventsCache = req.app.get('eventsCache');
    const googleSheetsStudents = req.app.get('googleSheetsStudents');
    
    console.log('🔍 [V2 Courses] 開始計算學生總數:', {
      hasEventsCache: !!eventsCache,
      hasGoogleSheetsStudents: !!googleSheetsStudents,
      eventId
    });
    
    if (eventsCache && eventsCache.data && googleSheetsStudents) {
      try {
        // 找到對應的事件
        const eventsList = eventsCache.data.events || eventsCache.data.data || [];
        console.log('🔍 [V2 Courses] 事件列表:', {
          eventsCount: Array.isArray(eventsList) ? eventsList.length : 0,
          sampleEventIds: Array.isArray(eventsList) 
            ? eventsList.slice(0, 3).map(e => e?.evt_id || e?.uid || `event-${e?.dtstart}`) 
            : []
        });
        
        // 🔥 [修復 2025-11-28] 多種 ID 格式匹配
        // 快取中的事件可能使用不同的 ID 格式：evt_id, uid, event-{dtstart}
        const event = Array.isArray(eventsList) 
          ? eventsList.find(e => {
              if (!e) return false;
              return (
                e.evt_id === eventId ||
                e.uid === eventId ||
                e.id === eventId ||
                `event-${e.dtstart}` === eventId
              );
            })
          : null;
        
        console.log('🔍 [V2 Courses] 事件匹配結果:', {
          found: !!event,
          eventTitle: event?.title || event?.summary || null,
          eventId: event?.evt_id || event?.uid || event?.id || null,
          searchingFor: eventId
        });
        
        if (event) {
          // 取得所有學生
          const studentResult = await googleSheetsStudents.getAllStudents();
          
          if (studentResult && studentResult.success && Array.isArray(studentResult.students)) {
            // 組裝事件物件供 transformStudentsToV2Format 使用
            const matchingEvent = {
              title: event.title || event.summary || '',
              start: event.dtstart,
              end: event.dtend,
              location: event.location || '',
              time: `${new Date(event.dtstart * 1000).toTimeString().slice(0, 5)}-${new Date(event.dtend * 1000).toTimeString().slice(0, 5)}`,
              _raw: event
            };
            
            // 🔥 [修復 2025-11-28] 使用原始事件標題（未清理）進行學生匹配
            // 原因：Google Sheets 中的學生 period 包含時間冒號 (16:10-17:40)
            // 但 cleanedCourseName 已移除冒號 (1610-1740)，導致匹配失敗
            const v2Students = transformStudentsToV2Format(
              studentResult.students,
              event.title || event.summary || courseName, // 使用事件原始標題
              matchingEvent,
              date
            ) || [];
            
            totalStudents = v2Students.length;
            console.log('✅ [V2 Courses] 學生匹配結果:', {
              courseTitle: event.title || event.summary,
              matchedStudents: totalStudents
            });
          }
        }
      } catch (studentError) {
        console.warn('⚠️ [V2 Courses] 計算學生總數失敗:', studentError.message);
        // 繼續執行，totalStudents 保持為 0
      }
    }
    
    // 5️⃣ 統計上傳資料
    let uploadedStudentCount = 0;
    let totalUploadedFiles = 0;
    let overviewUploaded = false;
    let overviewFileCount = 0;
    
    if (courseSummary) {
      // 學生統計
      const students = courseSummary.students || {};
      const uploadedStudentSet = new Set();
      
      Object.values(students).forEach((student) => {
        if (!student) return;
        
        const photoCount = student.photoCount || 0;
        const videoCount = student.videoCount || 0;
        const fileCount = photoCount + videoCount;
        
        // 有檔案或有評語都算已上傳
        if (fileCount > 0 || student.hasComment) {
          const studentName = String(student.studentName || '').trim();
          if (studentName) {
            uploadedStudentSet.add(studentName);
            totalUploadedFiles += fileCount;
          }
        }
      });
      
      uploadedStudentCount = uploadedStudentSet.size;
      
      // 🎯 課程總覽統計（參照 /api/v2/courses 的完整邏輯）
      const overview = courseSummary.overview;
      if (overview) {
        const hasOverviewContent = overview.hasPhotos || overview.hasVideos || overview.hasSummary;
        overviewUploaded = hasOverviewContent;
        overviewFileCount = hasOverviewContent ? ((overview.photoCount || 0) + (overview.videoCount || 0)) : 0;
      } else {
        // ✅ 明確設置預設值，確保前端總是能收到這個欄位
        overviewUploaded = false;
        overviewFileCount = 0;
      }
    }
    
    // 6️⃣ 返回統計結果
    const result = {
      eventId,
      date,
      courseName: cleanedCourseName,
      studentCount: totalStudents,
      uploadedStudentCount,
      totalUploadedFiles,
      overviewUploaded,
      overviewFileCount,
      // 計算上傳百分比
      uploadPercentage: totalStudents > 0 
        ? Math.round((uploadedStudentCount / totalStudents) * 100) 
        : 0,
      lastUpdatedAt: courseSummary ? courseSummary.updatedAt : null
    };
    
    console.log('✅ [V2 Courses] 返回上傳統計:', result);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    console.error('❌ [V2 Courses] 查詢課程上傳統計失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: null
    });
  }
});

/**
 * GET /api/v2/courses/:id
 * 獲取單個課程
 */
router.get('/courses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('📚 [V2 Courses] 獲取課程:', id);
    
    const eventsCache = req.app.get('eventsCache');
    
    if (!eventsCache || !eventsCache.data) {
      return res.status(503).json({
        success: false,
        error: '事件快取未就緒'
      });
    }
    
    // 查找事件（支援多種快取結構，與 /courses 路由一致）
    const eventsList = eventsCache.data.events || eventsCache.data.data || [];

    let event = null;
    if (Array.isArray(eventsList)) {
      event = eventsList.find(e => 
        e && (e.evt_id === id || `event-${e.dtstart}` === id)
      ) || null;
    } else {
      console.error('❌ [V2 Courses] 單一課程查詢時 eventsCache.data 不是陣列:', typeof eventsCache.data);
    }
    
    if (!event) {
      return res.status(404).json({
        success: false,
        error: '課程不存在'
      });
    }
    
    const course = eventToCourse(event);
    
    console.log('✅ [V2 Courses] 返回課程:', course.name);
    
    res.json({
      success: true,
      data: course
    });
    
  } catch (error) {
    console.error('❌ [V2 Courses] 獲取課程失敗:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
