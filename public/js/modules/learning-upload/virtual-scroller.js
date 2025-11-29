/**
 * 學習歷程上傳系統 - 虛擬滾動元件
 * 減少 DOM 節點數量，提升大列表渲染效能
 */

(function (global) {
  'use strict';

  const Config = global.LearningUploadConfig;

  // ============================================
  // 虛擬滾動器
  // ============================================
  class VirtualScroller {
    constructor(options) {
      this.container = options.container;
      this.items = options.items || [];
      this.renderItem = options.renderItem;
      this.itemHeight = options.itemHeight || 100;
      this.buffer = options.buffer || 5;
      this.onVisibleChange = options.onVisibleChange;

      this.viewport = { start: 0, end: 0 };
      this.scrollTop = 0;
      this.containerHeight = 0;
      
      this.rafId = null;
      this.isDestroyed = false;

      this.init();
    }

    /**
     * 初始化
     */
    init() {
      if (!this.container) return;

      // 創建內部結構
      this.wrapper = document.createElement('div');
      this.wrapper.style.position = 'relative';
      this.wrapper.style.minHeight = `${this.items.length * this.itemHeight}px`;

      this.contentEl = document.createElement('div');
      this.contentEl.style.position = 'relative';

      this.wrapper.appendChild(this.contentEl);
      this.container.appendChild(this.wrapper);

      // 綁定滾動事件
      this.container.addEventListener('scroll', this.handleScroll.bind(this));
      
      // 監聽視窗大小變化
      window.addEventListener('resize', this.handleResize.bind(this));

      // 首次渲染
      this.update();
    }

    /**
     * 處理滾動
     */
    handleScroll() {
      if (this.rafId) return;

      this.rafId = requestAnimationFrame(() => {
        this.update();
        this.rafId = null;
      });
    }

    /**
     * 處理視窗大小變化
     */
    handleResize() {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => {
        this.update();
      }, 100);
    }

    /**
     * 更新可見項目
     */
    update() {
      if (this.isDestroyed) return;

      this.scrollTop = this.container.scrollTop;
      this.containerHeight = this.container.clientHeight;

      const newViewport = this.calculateViewport();

      // 判斷是否需要重新渲染
      if (newViewport.start !== this.viewport.start || newViewport.end !== this.viewport.end) {
        this.viewport = newViewport;
        this.render();
        
        // 觸發回調
        if (this.onVisibleChange) {
          this.onVisibleChange(this.viewport);
        }
      }
    }

    /**
     * 計算可見視口
     */
    calculateViewport() {
      const start = Math.max(
        0,
        Math.floor(this.scrollTop / this.itemHeight) - this.buffer
      );
      
      const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
      const end = Math.min(
        this.items.length,
        start + visibleCount + this.buffer * 2
      );

      return { start, end };
    }

    /**
     * 渲染可見項目
     */
    render() {
      if (!this.contentEl) return;

      const fragment = document.createDocumentFragment();

      for (let i = this.viewport.start; i < this.viewport.end; i++) {
        const item = this.items[i];
        if (!item) continue;

        const el = this.renderItem(item, i);
        if (!el) continue;

        // 設置絕對定位
        el.style.position = 'absolute';
        el.style.top = `${i * this.itemHeight}px`;
        el.style.width = '100%';
        el.setAttribute('data-index', i);

        fragment.appendChild(el);
      }

      // 替換內容
      this.contentEl.innerHTML = '';
      this.contentEl.appendChild(fragment);
    }

    /**
     * 更新項目列表
     */
    setItems(items) {
      this.items = items || [];
      
      // 更新包裝器高度
      if (this.wrapper) {
        this.wrapper.style.minHeight = `${this.items.length * this.itemHeight}px`;
      }

      this.update();
    }

    /**
     * 滾動到指定項目
     */
    scrollToIndex(index, behavior) {
      if (index < 0 || index >= this.items.length) return;

      const top = index * this.itemHeight;
      this.container.scrollTo({
        top: top,
        behavior: behavior || 'smooth'
      });
    }

    /**
     * 獲取可見項目
     */
    getVisibleItems() {
      return this.items.slice(this.viewport.start, this.viewport.end);
    }

    /**
     * 獲取可見索引範圍
     */
    getVisibleRange() {
      return { ...this.viewport };
    }

    /**
     * 銷毀
     */
    destroy() {
      this.isDestroyed = true;

      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
      }

      if (this.resizeTimer) {
        clearTimeout(this.resizeTimer);
      }

      this.container?.removeEventListener('scroll', this.handleScroll);
      window.removeEventListener('resize', this.handleResize);

      if (this.wrapper && this.wrapper.parentNode) {
        this.wrapper.parentNode.removeChild(this.wrapper);
      }

      this.container = null;
      this.wrapper = null;
      this.contentEl = null;
      this.items = null;
      this.renderItem = null;
    }
  }

  // ============================================
  // 課程列表虛擬滾動器（專用）
  // ============================================
  class CourseListScroller extends VirtualScroller {
    constructor(container) {
      super({
        container: container,
        items: [],
        itemHeight: Config.get('ui.courseCardHeight') || 120,
        buffer: Config.get('virtualScroll.buffer') || 5,
        renderItem: (course, index) => {
          return this.renderCourseCard(course, index);
        }
      });
    }

    /**
     * 渲染課程卡片
     */
    renderCourseCard(course, index) {
      const card = document.createElement('div');
      card.className = 'course-card glass-card';
      card.setAttribute('data-course-id', course.id || '');
      
      // 使用全域的課程管理器渲染
      if (global.LearningUploadCourseManager?.renderCourseCard) {
        const html = global.LearningUploadCourseManager.renderCourseCard(course, index);
        card.innerHTML = html;
      } else {
        card.innerHTML = this.renderFallbackCard(course);
      }

      return card;
    }

    /**
     * 降級渲染（無課程管理器時）
     */
    renderFallbackCard(course) {
      return `
        <div class="course-header">
          <span class="course-type">${course.courseType || ''}</span>
          <span class="course-date">${course.formattedDate || ''}</span>
        </div>
        <div class="course-title">${course.title || ''}</div>
        <div class="course-meta">
          <span class="student-count">${course.students?.length || 0} 位學生</span>
        </div>
      `;
    }
  }

  // ============================================
  // 學生列表虛擬滾動器（專用）
  // ============================================
  class StudentListScroller extends VirtualScroller {
    constructor(container) {
      super({
        container: container,
        items: [],
        itemHeight: Config.get('ui.studentCardHeight') || 150,
        buffer: Config.get('virtualScroll.buffer') || 3,
        renderItem: (student, index) => {
          return this.renderStudentCard(student, index);
        }
      });
    }

    /**
     * 渲染學生卡片
     */
    renderStudentCard(student, index) {
      const card = document.createElement('div');
      card.className = 'student-card';
      card.setAttribute('data-student-index', index);

      // 使用全域的學生管理器渲染
      if (global.LearningUploadStudentManager?.createStudentCard) {
        return global.LearningUploadStudentManager.createStudentCard(student, index);
      } else {
        card.innerHTML = this.renderFallbackCard(student, index);
      }

      return card;
    }

    /**
     * 降級渲染（無學生管理器時）
     */
    renderFallbackCard(student, index) {
      return `
        <div class="student-header">
          <h3>${student.name || ''}</h3>
          <span class="student-index">#${index + 1}</span>
        </div>
        <div class="student-info">
          ${student.attendanceMessage || ''}
        </div>
      `;
    }
  }

  // ============================================
  // 導出
  // ============================================
  global.LearningUploadVirtualScroller = VirtualScroller;
  global.LearningUploadCourseListScroller = CourseListScroller;
  global.LearningUploadStudentListScroller = StudentListScroller;

})(window);
