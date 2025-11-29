/**
 * 學習歷程上傳系統 - 課程管理模組
 * 處理課程載入、篩選、選擇等功能
 */

(function (global) {
  'use strict';

  const State = global.LearningUploadState;
  const Config = global.LearningUploadConfig;
  const DOM = global.LearningUploadDOM;
  const Attendance = global.LearningUploadAttendance;
  const Debounce = global.LearningUploadDebounce;
  const Cleanup = global.LearningUploadCleanup;

  // ============================================
  // 課程管理器
  // ============================================
  class CourseManager {
    constructor() {
      this.filterDebounce = Debounce.debounce.bind(null, this.applyFilters.bind(this), 
        Config.get('ui.debounceDelay') || 300);
    }

    /**
     * 載入已完成課程
     */
    async loadCompleted(options) {
      try {
        const showToast = global.showToast || (() => {});
        showToast('載入課程中...', 'info');

        const rangeValue = (DOM.$('#rangeFilter') || {}).value || 'today';
        const target = (global.FLB?.UrlParams?.getTargetInfo?.()) || {};
        const targetEventId = target.eventId || null;
        const targetDate = State.get('currentFilterDateOverride') || target.date || null;
        const targetTime = target.time || null;
        const urlInstructor = State.get('urlInstructor');
        const currentTeacher = State.get('currentTeacher');
        const instructor = urlInstructor || (currentTeacher?.name) || null;

        // 快速跳轉時取消講師篩選
        const forceNoInstructor = !!(targetEventId || (targetDate && targetTime));
        const queryInstructor = forceNoInstructor ? null : instructor;

        // 快速跳轉時使用 week 範圍
        const preferWeek = !!(targetEventId || (targetDate && targetTime));
        const range = (preferWeek || rangeValue === 'week') ? 'week' : 'day';

        // API 呼叫
        let data;
        try {
          data = await global.FLB.Api.getCompletedCourses({
            range: range,
            date: targetDate,
            eventId: targetEventId,
            instructor: queryInstructor,
            cache: 'true'
          });

          if (!data || typeof data !== 'object') {
            throw new Error('API 回應格式錯誤');
          }
        } catch (apiError) {
          console.error('❌ [CourseManager] API 呼叫失敗:', apiError);
          throw new Error('無法載入課程資料: ' + (apiError.message || '網路錯誤'));
        }

        const courses = Array.isArray(data.courses) ? data.courses : [];

        // 載入學生資料
        let studentData;
        try {
          studentData = await global.FLB.Api.getStudentData();
          if (!studentData || typeof studentData !== 'object') {
            studentData = { students: [] };
          }
        } catch (studentError) {
          console.error('❌ [CourseManager] 載入學生資料失敗:', studentError);
          studentData = { students: [] };
        }

        const allStudents = Array.isArray(studentData?.students) ? studentData.students : [];

        // 處理課程資料
        const processedCourses = courses.map(course => {
          const status = global.FLB.Course.determineStatus(course.start, course.end, new Date());
          return {
            ...course,
            id: course.id || global.FLB.Id.normalizeCourseId(course),
            start: course.start ? new Date(course.start) : null,
            end: course.end ? new Date(course.end) : null,
            status: status,
            students: undefined // 延後匹配
          };
        });

        // 更新狀態
        State.update({
          'allCourses': processedCourses,
          'allStudentsGlobal': allStudents,
          'courseFiltersMeta': data.meta || {
            total: processedCourses.length,
            requestedEventId: targetEventId,
            date: targetDate,
            range: range,
            highlightEventId: targetEventId || null
          },
          'highlightedCourseId': (data.meta?.highlightEventId || targetEventId) || null
        });

        // 預設講師篩選
        const activeFilters = State.get('activeFilters');
        if (!activeFilters.instructor) {
          State.set('activeFilters.instructor', urlInstructor || (currentTeacher?.name) || '');
        }

        // 應用篩選並渲染
        this.applyFilters();
        this.updateSummary();

        // 自動選課（如果未抑制）
        if (!options?.suppressAutoSelect) {
          const suppressed = window.__suppressAutoSelectUntil && 
                           Date.now() < window.__suppressAutoSelectUntil;
          if (!suppressed) {
            this.autoSelect(targetTime);
          }
        }

        showToast('課程載入完成', 'success');
      } catch (e) {
        console.error('❌ [CourseManager] 載入課程失敗:', e);
        this.showError(e.message || '載入課程失敗');
        const showToast = global.showToast || (() => {});
        showToast('載入課程失敗: ' + (e.message || '請檢查網路連線'), 'error');
      }
    }

    /**
     * 應用篩選條件
     */
    applyFilters() {
      const allCourses = State.get('allCourses') || [];
      const activeFilters = State.get('activeFilters') || {};
      const activeWeekdays = State.get('activeWeekdays') || new Set();

      const filtered = allCourses.filter(course => {
        // 講師篩選
        if (activeFilters.instructor && course.instructor !== activeFilters.instructor) {
          return false;
        }

        // 課程類型篩選
        if (activeFilters.courseType && course.courseName !== activeFilters.courseType) {
          return false;
        }

        // 學生搜尋（需要匹配學生）
        if (activeFilters.studentQuery) {
          const query = activeFilters.studentQuery.toLowerCase();
          const students = course.students || [];
          const hasMatch = students.some(student => 
            (student.name || '').toLowerCase().includes(query)
          );
          if (!hasMatch) return false;
        }

        // 星期篩選
        if (activeWeekdays.size > 0 && course.start) {
          const day = course.start.getDay();
          const weekday = day === 0 ? 7 : day; // 轉換為 1-7
          if (!activeWeekdays.has(weekday)) {
            return false;
          }
        }

        return true;
      });

      // 觸發渲染
      const Constants = global.LearningUploadConstants || {};
      State.emit(Constants.EVENTS?.COURSE_FILTERED || 'course:filtered', filtered);
      
      return filtered;
    }

    /**
     * 更新課程摘要
     */
    updateSummary() {
      const allCourses = State.get('allCourses') || [];
      const filtered = this.applyFilters();
      const meta = State.get('courseFiltersMeta') || {};

      const summaryEl = DOM.$('#courseSummary');
      if (!summaryEl) return;

      const total = allCourses.length;
      const completed = allCourses.filter(c => c.status === 'completed').length;
      const filteredCount = filtered.length;

      summaryEl.innerHTML = `<i class="fas fa-info-circle"></i> <span>共 ${total} 堂課｜已結束 ${completed} 堂｜顯示 ${filteredCount} 堂</span>`;
    }

    /**
     * 自動選課
     */
    async autoSelect(fallbackTime) {
      const target = (global.FLB?.UrlParams?.getTargetInfo?.()) || {};
      const eventId = target.eventId || null;
      const date = target.date || null;
      const time = target.time || fallbackTime || null;

      if (!eventId && !(date && time)) return;

      const allCourses = State.get('allCourses') || [];
      let targetCourse = null;

      // 根據 eventId 查找
      if (eventId) {
        targetCourse = allCourses.find(c => {
          try {
            return global.FLB.Id.matches(eventId, c);
          } catch (e) {
            return false;
          }
        }) || null;
      }

      // 根據日期時間查找
      if (!targetCourse && date && time) {
        const formatDate = (d) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const d_ = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${d_}`;
        };
        const formatTime = (d) => {
          const h = String(d.getHours()).padStart(2, '0');
          const m = String(d.getMinutes()).padStart(2, '0');
          return `${h}:${m}`;
        };
        const timesClose = (t1, t2, tolMin = 10) => {
          try {
            const [h1, m1] = t1.split(':').map(Number);
            const [h2, m2] = t2.split(':').map(Number);
            const diff = Math.abs((h1 * 60 + m1) - (h2 * 60 + m2));
            return diff <= tolMin;
          } catch (e) {
            return t1 === t2;
          }
        };

        targetCourse = allCourses.find(c => {
          if (!c.start) return false;
          const courseDate = formatDate(c.start);
          const courseTime = formatTime(c.start);
          return courseDate === date && (courseTime === time || timesClose(courseTime, time));
        }) || null;
      }

      if (targetCourse) {
        await this.selectCourse(targetCourse);
        const showToast = global.showToast || (() => {});
        showToast('已自動定位到課程：' + (targetCourse.title || ''), 'success');
      }
    }

    /**
     * 選擇課程
     */
    async selectCourse(course, element) {
      if (!course) return;

      // 清理上一個課程的資源
      await Cleanup.cleanupCourseChange();

      // 更新狀態
      State.set('currentCourse', course);

      // 補充出缺席資訊
      if (Attendance) {
        Attendance.augmentCourse(course);
      }

      // 觸發選課事件
      const Constants = global.LearningUploadConstants || {};
      State.emit(Constants.EVENTS?.COURSE_SELECTED || 'course:selected', course);

      // 載入學生資料
      this.loadCourseStudents(course);
    }

    /**
     * 載入課程學生資料
     */
    async loadCourseStudents(course) {
      if (!course || !course.students) {
        return;
      }

      // 這裡可以添加學生資料匹配邏輯
      // 目前直接使用 course.students

      State.emit('course:students-loaded', course.students);
    }

    /**
     * 顯示錯誤訊息
     */
    showError(message) {
      const el = DOM.$('#courseList');
      if (el) {
        const escapeHtml = global.FLB?.Course?.escapeHtml || 
          (str => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
        const errorMsg = escapeHtml(message || '未知錯誤');
        el.innerHTML = `<div class="empty-state">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>載入失敗</h3>
          <p>${errorMsg}</p>
          <button class="nav-btn" onclick="refreshCourses()" style="margin-top:12px;">
            <i class="fas fa-sync-alt"></i> 重新載入
          </button>
        </div>`;
      }
    }
  }

  // ============================================
  // 導出
  // ============================================
  const courseManager = new CourseManager();
  global.LearningUploadCourseManager = courseManager;

  // ⚠️ 暫時禁用全域函數覆蓋，等待完整遷移後再啟用
  // 原因：CourseManager.selectCourse 實作不完整，缺少日期格式化、學生匹配等邏輯
  // TODO: 完成 CourseManager 的完整實作後再啟用以下註釋的代碼
  // global.loadCompletedCourses = courseManager.loadCompleted.bind(courseManager);
  // global.selectCourse = courseManager.selectCourse.bind(courseManager);

})(window);
