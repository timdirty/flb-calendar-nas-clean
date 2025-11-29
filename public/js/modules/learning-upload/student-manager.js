/**
 * 學習歷程上傳系統 - 學生管理模組
 * 處理學生資料管理、卡片渲染、出缺席處理
 */

(function (global) {
  'use strict';

  const State = global.LearningUploadState;
  const Config = global.LearningUploadConfig;
  const DOM = global.LearningUploadDOM;
  const Attendance = global.LearningUploadAttendance;
  const Constants = global.LearningUploadConstants;

  // ============================================
  // 學生管理器
  // ============================================
  class StudentManager {
    constructor() {
      this.currentIndex = 0;
      this.renderQueue = [];
      this.isRendering = false;
    }

    /**
     * 載入課程學生資料
     */
    async loadCourseStudents(course) {
      if (!course) return [];

      const allStudents = State.get('allStudentsGlobal') || [];
      
      // 使用課程匹配器匹配學生
      let students = [];
      if (global.FLB?.StudentMatcher) {
        try {
          students = await global.FLB.StudentMatcher.matchStudents(course, allStudents);
        } catch (e) {
          console.error('❌ [StudentManager] 學生匹配失敗:', e);
          students = course.students || [];
        }
      } else {
        students = course.students || [];
      }

      // 補充出缺席資訊
      if (Attendance && course.attendanceDateKey) {
        students.forEach(student => {
          const info = Attendance.resolve(student, course.attendanceDateKey);
          student.attendanceStatus = info.status;
          student.attendanceMessage = info.message;
          student.attendanceRecord = info.record;
          student.attendanceClass = info.class;
        });
      }

      // 更新狀態
      course.students = students;
      State.set('currentCourse', course);

      return students;
    }

    /**
     * 設置當前學生索引
     */
    setCurrentIndex(index) {
      const course = State.get('currentCourse');
      if (!course || !course.students) return;

      const maxIndex = course.students.length - 1;
      this.currentIndex = Math.max(0, Math.min(index, maxIndex));
      
      State.set('currentStudentIndex', this.currentIndex);
      
      return this.currentIndex;
    }

    /**
     * 獲取當前學生
     */
    getCurrentStudent() {
      const course = State.get('currentCourse');
      if (!course || !course.students) return null;
      
      return course.students[this.currentIndex] || null;
    }

    /**
     * 切換到下一個學生
     */
    nextStudent() {
      const course = State.get('currentCourse');
      if (!course || !course.students) return;

      if (this.currentIndex < course.students.length - 1) {
        this.setCurrentIndex(this.currentIndex + 1);
        this.renderCurrentStudent();
      }
    }

    /**
     * 切換到上一個學生
     */
    previousStudent() {
      if (this.currentIndex > 0) {
        this.setCurrentIndex(this.currentIndex - 1);
        this.renderCurrentStudent();
      }
    }

    /**
     * 渲染當前學生卡片
     */
    renderCurrentStudent() {
      const student = this.getCurrentStudent();
      if (!student) return;

      // 觸發事件
      State.emit(Constants.EVENTS?.STUDENT_CHANGED || 'student:changed', {
        index: this.currentIndex,
        student: student
      });
    }

    /**
     * 初始化學生卡片
     */
    initializeStudentCards(course) {
      if (!course || !course.students) return;

      const studentFiles = State.get('studentFiles') || {};
      
      course.students.forEach((student, index) => {
        if (!studentFiles[index]) {
          studentFiles[index] = {
            photos: [],
            videos: [],
            comment: '',
            baselineComment: '',
            existingCounts: { photos: 0, videos: 0, text: 0 },
            locked: false,
            name: student.name
          };
        }

        // 根據出缺席狀態設置鎖定狀態
        if (student.attendanceStatus === 'leave' || student.attendanceStatus === 'absent') {
          studentFiles[index].locked = true;
          studentFiles[index].lockReason = student.attendanceMessage;
        }
      });

      State.set('studentFiles', studentFiles);
    }

    /**
     * 批量渲染學生列表（使用 requestIdleCallback）
     */
    renderStudentList(students, container) {
      if (!students || !container) return;

      // 清空容器
      container.innerHTML = '';

      const fragment = document.createDocumentFragment();
      const batchSize = Config.get('ui.renderBatchSize') || 10;

      const renderBatch = (startIndex) => {
        const endIndex = Math.min(startIndex + batchSize, students.length);
        
        for (let i = startIndex; i < endIndex; i++) {
          const student = students[i];
          const card = this.createStudentCard(student, i);
          if (card) {
            fragment.appendChild(card);
          }
        }

        if (fragment.childNodes.length > 0) {
          container.appendChild(fragment);
        }

        if (endIndex < students.length) {
          // 繼續渲染下一批
          if (Config.get('performance.enableIdleCallback') && 
              typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => renderBatch(endIndex), {
              timeout: Config.get('performance.idleTimeout') || 2000
            });
          } else {
            setTimeout(() => renderBatch(endIndex), 0);
          }
        }
      };

      renderBatch(0);
    }

    /**
     * 創建學生卡片元素
     */
    createStudentCard(student, index) {
      if (!student) return null;

      const card = document.createElement('div');
      card.className = 'student-upload-card';
      card.setAttribute('data-student-index', index);
      card.setAttribute('data-student-name', student.name || '');

      // 出缺席狀態
      const status = student.attendanceStatus || 'unknown';
      const statusClass = Attendance?.getStatusClass(status) || '';
      
      if (statusClass) {
        card.classList.add(statusClass);
      }

      // 卡片內容
      const html = this.buildStudentCardHTML(student, index);
      card.innerHTML = html;

      return card;
    }

    /**
     * 構建學生卡片 HTML
     */
    buildStudentCardHTML(student, index) {
      const name = student.name || '未知學生';
      const status = student.attendanceStatus || 'unknown';
      const message = student.attendanceMessage || '';
      const locked = (status === 'leave' || status === 'absent');

      return `
        <div class="student-card-header">
          <h3>${this.escapeHtml(name)}</h3>
          <span class="student-index">#${index + 1}</span>
        </div>
        <div class="attendance-status ${Attendance?.getStatusClass(status) || ''}">
          ${this.escapeHtml(message)}
        </div>
        <div class="upload-sections">
          ${locked ? this.buildLockedContent() : this.buildUploadContent(index)}
        </div>
      `;
    }

    /**
     * 構建鎖定狀態內容
     */
    buildLockedContent() {
      return `
        <div class="locked-content">
          <i class="fas fa-lock"></i>
          <p>因出缺席狀態已鎖定上傳功能</p>
        </div>
      `;
    }

    /**
     * 構建上傳內容
     */
    buildUploadContent(index) {
      return `
        <div class="upload-section">
          <label class="upload-label">📸 照片上傳</label>
          <div id="photos-preview-${index}" class="file-previews"></div>
          <button class="upload-trigger-btn" onclick="triggerAddFile(${index}, 'photos')">
            <i class="fas fa-plus"></i> 新增照片
          </button>
        </div>
        <div class="upload-section">
          <label class="upload-label">🎬 影片上傳</label>
          <div id="videos-preview-${index}" class="file-previews"></div>
          <button class="upload-trigger-btn" onclick="triggerAddFile(${index}, 'videos')">
            <i class="fas fa-plus"></i> 新增影片
          </button>
        </div>
        <div class="upload-section">
          <label class="upload-label">💬 課堂評語</label>
          <textarea 
            id="comment-${index}" 
            class="comment-area" 
            placeholder="請輸入本次課堂評語..."
            rows="4"
            data-student-index="${index}"
          ></textarea>
        </div>
        <div class="upload-actions">
          <button id="upload-btn-${index}" class="upload-btn" onclick="uploadStudentRecord(${index})">
            <i class="fas fa-robot"></i> 系統自動上傳
          </button>
        </div>
      `;
    }

    /**
     * HTML 轉義
     */
    escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * 獲取學生完成度
     */
    getStudentCompletion(index) {
      const studentFile = State.get(`studentFiles.${index}`);
      if (!studentFile) return 0;

      const existing = studentFile.existingCounts || { photos: 0, videos: 0, text: 0 };
      const photosCount = (studentFile.photos?.length || 0) + (existing.photos || 0);
      const videosCount = (studentFile.videos?.length || 0) + (existing.videos || 0);
      const textLen = Math.max(
        studentFile.comment?.length || 0,
        existing.text || 0
      );

      const photosPercent = Math.min(1, photosCount / 3);
      const videosPercent = Math.min(1, videosCount / 1);
      const textPercent = Math.min(1, textLen / 20);

      return Math.round((photosPercent + videosPercent + textPercent) / 3 * 100);
    }

    /**
     * 清理學生資源
     */
    cleanup() {
      this.renderQueue = [];
      this.isRendering = false;
    }
  }

  // ============================================
  // 導出
  // ============================================
  const studentManager = new StudentManager();
  global.LearningUploadStudentManager = studentManager;

  // 向後兼容
  global.goStudent = (delta) => {
    if (delta > 0) {
      studentManager.nextStudent();
    } else {
      studentManager.previousStudent();
    }
  };

})(window);
