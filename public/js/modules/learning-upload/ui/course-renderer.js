/**
 * 學習歷程上傳系統 - 課程渲染模組
 * 優化課程列表渲染，支援虛擬滾動
 */

(function (global) {
  'use strict';

  const State = global.LearningUploadState;
  const DOM = global.LearningUploadDOM;
  const VirtualScroller = global.LearningUploadVirtualScroller;

  // ============================================
  // 課程渲染器
  // ============================================
  class CourseRenderer {
    constructor() {
      this.virtualScroller = null;
      this.renderCache = new Map(); // 渲染快取
      this.lastRenderTime = 0;
    }

    /**
     * 初始化虛擬滾動
     */
    initVirtualScroll(containerEl, options = {}) {
      if (!VirtualScroller) {
        console.warn('⚠️ VirtualScroller 未載入，使用傳統渲染');
        return null;
      }

      this.virtualScroller = new VirtualScroller(containerEl, {
        itemHeight: options.itemHeight || 120,
        buffer: options.buffer || 5,
        renderItem: this.renderCourseCard.bind(this),
        ...options
      });

      return this.virtualScroller;
    }

    /**
     * 渲染課程列表
     */
    render(courses, containerEl, options = {}) {
      if (!containerEl) {
        console.error('❌ 容器元素不存在');
        return;
      }

      // 檢查是否需要重新渲染
      if (this.shouldSkipRender(courses)) {
        return;
      }

      const startTime = Date.now();

      try {
        if (courses.length === 0) {
          this.renderEmpty(containerEl);
          return;
        }

        // 使用虛擬滾動（如果已初始化且課程數量較多）
        if (this.virtualScroller && courses.length > 20) {
          this.virtualScroller.update(courses);
        } else {
          // 傳統批量渲染
          this.renderBatch(courses, containerEl, options);
        }

        const duration = Date.now() - startTime;
        console.log(`✅ 課程列表渲染完成：${courses.length} 堂課，耗時 ${duration}ms`);
        
        this.lastRenderTime = Date.now();

      } catch (error) {
        console.error('❌ 課程列表渲染失敗:', error);
        this.renderError(containerEl, error);
      }
    }

    /**
     * 批量渲染課程卡片
     */
    renderBatch(courses, containerEl, options = {}) {
      // 使用 DocumentFragment 批量操作
      const fragment = document.createDocumentFragment();

      courses.forEach((course, index) => {
        const card = this.renderCourseCard(course, index);
        if (card) {
          fragment.appendChild(card);
        }
      });

      // 一次性更新 DOM
      containerEl.innerHTML = '';
      containerEl.appendChild(fragment);

      // 綁定事件（使用事件委派）
      this.attachEventListeners(containerEl, courses);
    }

    /**
     * 渲染單一課程卡片
     */
    renderCourseCard(course, index) {
      // 檢查快取
      const cacheKey = this.getCacheKey(course);
      if (this.renderCache.has(cacheKey)) {
        return this.renderCache.get(cacheKey).cloneNode(true);
      }

      const card = document.createElement('div');
      card.className = 'course-item';
      card.dataset.courseId = course.id || '';
      card.dataset.index = index;

      // 高亮目標課程
      const highlightedCourseId = State.get('highlightedCourseId');
      if (highlightedCourseId && highlightedCourseId === course.id) {
        card.classList.add('highlighted');
      }

      // 課程標題
      const title = document.createElement('div');
      title.className = 'course-title';
      title.textContent = course.title || course.courseName || '未命名課程';

      // 課程資訊
      const info = document.createElement('div');
      info.className = 'course-info';

      // 時間
      const time = this.formatCourseTime(course);
      const timeSpan = document.createElement('span');
      timeSpan.className = 'course-time';
      timeSpan.innerHTML = `<i class="fas fa-clock"></i> ${time}`;

      // 講師
      if (course.instructor) {
        const teacherSpan = document.createElement('span');
        teacherSpan.className = 'course-teacher';
        teacherSpan.innerHTML = `<i class="fas fa-user"></i> ${course.instructor}`;
        info.appendChild(teacherSpan);
      }

      info.appendChild(timeSpan);

      // 學生數量
      if (course.students && course.students.length > 0) {
        const studentSpan = document.createElement('span');
        studentSpan.className = 'course-students';
        studentSpan.innerHTML = `<i class="fas fa-users"></i> ${course.students.length} 位`;
        info.appendChild(studentSpan);
      }

      // 上傳進度（如果有）
      const progress = this.getCourseProgress(course);
      if (progress > 0) {
        const progressBar = document.createElement('div');
        progressBar.className = 'course-progress-bar';
        progressBar.innerHTML = `
          <div class="progress-fill" style="width: ${progress}%"></div>
          <span class="progress-text">${progress}%</span>
        `;
        card.appendChild(progressBar);
      }

      card.appendChild(title);
      card.appendChild(info);

      // 快取渲染結果
      this.renderCache.set(cacheKey, card.cloneNode(true));

      return card;
    }

    /**
     * 渲染空狀態
     */
    renderEmpty(containerEl) {
      containerEl.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-calendar-times"></i>
          <h3>沒有課程資料</h3>
          <p>請調整日期範圍或篩選條件</p>
        </div>
      `;
    }

    /**
     * 渲染錯誤狀態
     */
    renderError(containerEl, error) {
      const escapeHtml = global.FLB?.Course?.escapeHtml || 
        (str => String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      
      const errorMsg = escapeHtml(error.message || '未知錯誤');
      
      containerEl.innerHTML = `
        <div class="empty-state error">
          <i class="fas fa-exclamation-triangle"></i>
          <h3>載入失敗</h3>
          <p>${errorMsg}</p>
          <button class="nav-btn" onclick="window.refreshCourses?.()">
            <i class="fas fa-sync-alt"></i> 重新載入
          </button>
        </div>
      `;
    }

    /**
     * 格式化課程時間
     */
    formatCourseTime(course) {
      if (!course.start) return '時間未定';

      try {
        const startDate = new Date(course.start);
        const endDate = course.end ? new Date(course.end) : null;

        const dateStr = `${startDate.getMonth() + 1}/${startDate.getDate()}`;
        const startTimeStr = `${String(startDate.getHours()).padStart(2, '0')}:${String(startDate.getMinutes()).padStart(2, '0')}`;
        
        if (endDate) {
          const endTimeStr = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
          return `${dateStr} ${startTimeStr}-${endTimeStr}`;
        }

        return `${dateStr} ${startTimeStr}`;
      } catch (error) {
        return '時間格式錯誤';
      }
    }

    /**
     * 取得課程上傳進度
     */
    getCourseProgress(course) {
      // 從狀態管理器取得上傳記錄
      const uploadedRecordsCache = State.get('uploadedRecordsCache') || {};
      const students = course.students || [];
      
      if (students.length === 0) return 0;

      const uploadedStudents = (uploadedRecordsCache.students || []).filter(record => {
        // 比對課程 ID 和日期
        return record.eventId === course.id;
      });

      return Math.round((uploadedStudents.length / students.length) * 100);
    }

    /**
     * 綁定事件監聽器（使用事件委派）
     */
    attachEventListeners(containerEl, courses) {
      // 移除舊的監聽器
      const oldHandler = containerEl.__courseClickHandler;
      if (oldHandler) {
        containerEl.removeEventListener('click', oldHandler);
      }

      // 新的點擊處理器
      const clickHandler = (event) => {
        const card = event.target.closest('.course-item');
        if (!card) return;

        const index = parseInt(card.dataset.index, 10);
        const course = courses[index];
        
        if (course && global.selectCourse) {
          global.selectCourse(course, card);
        }
      };

      containerEl.addEventListener('click', clickHandler);
      containerEl.__courseClickHandler = clickHandler;
    }

    /**
     * 檢查是否需要跳過渲染
     */
    shouldSkipRender(courses) {
      // 防抖：100ms 內不重複渲染
      if (Date.now() - this.lastRenderTime < 100) {
        return true;
      }

      return false;
    }

    /**
     * 取得快取鍵
     */
    getCacheKey(course) {
      return `${course.id}-${course.title}-${(course.students || []).length}`;
    }

    /**
     * 清除快取
     */
    clearCache() {
      this.renderCache.clear();
      console.log('🧹 課程渲染快取已清除');
    }

    /**
     * 銷毀渲染器
     */
    destroy() {
      if (this.virtualScroller && this.virtualScroller.destroy) {
        this.virtualScroller.destroy();
      }
      this.clearCache();
    }
  }

  // ============================================
  // 導出
  // ============================================
  const courseRenderer = new CourseRenderer();
  global.LearningCourseRenderer = courseRenderer;

  // 向後兼容：提供全局函數
  global.renderCourseCards = (courses) => {
    const containerEl = DOM.$('#courseList');
    if (containerEl) {
      courseRenderer.render(courses, containerEl);
    }
  };

  console.log('✅ CourseRenderer 已載入');

})(window);

