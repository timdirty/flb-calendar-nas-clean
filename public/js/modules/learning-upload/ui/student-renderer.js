/**
 * 學習歷程上傳系統 - 學生渲染模組
 * 優化學生卡片渲染，減少 DOM 操作
 */

(function (global) {
  'use strict';

  const State = global.LearningUploadState;
  const DOM = global.LearningUploadDOM;
  const Attendance = global.LearningUploadAttendance;

  // ============================================
  // 學生渲染器
  // ============================================
  class StudentRenderer {
    constructor() {
      this.cardCache = new Map(); // 卡片快取
      this.templateCache = null; // 模板快取
    }

    /**
     * 渲染學生卡片
     */
    renderCard(student, index, options = {}) {
      // 檢查快取
      const cacheKey = this.getCacheKey(student, index);
      if (this.cardCache.has(cacheKey) && !options.forceRender) {
        const cached = this.cardCache.get(cacheKey);
        return cached.cloneNode(true);
      }

      const card = document.createElement('div');
      card.className = 'student-card';
      card.id = `student-${index}`;
      card.dataset.studentIndex = index;
      card.dataset.studentName = student.name || '';

      // 使用模板或內聯創建
      const cardContent = this.createCardContent(student, index, options);
      card.appendChild(cardContent);

      // 快取卡片
      if (!options.skipCache) {
        this.cardCache.set(cacheKey, card.cloneNode(true));
      }

      return card;
    }

    /**
     * 創建卡片內容
     */
    createCardContent(student, index, options = {}) {
      const container = document.createElement('div');

      // 1. 進度膠囊
      const capsule = this.createProgressCapsule(index);
      container.appendChild(capsule);

      // 2. 學生標頭
      const header = this.createStudentHeader(student, index);
      container.appendChild(header);

      // 3. 出缺席狀態
      if (Attendance && student.attendanceStatus) {
        const attendanceStatus = this.createAttendanceStatus(student, index);
        container.appendChild(attendanceStatus);
      }

      // 4. 進度指示器
      const indicators = this.createProgressIndicators(index);
      container.appendChild(indicators);

      // 5. 上傳區域
      const uploadAreas = this.createUploadAreas(student, index, options);
      uploadAreas.forEach(area => container.appendChild(area));

      // 6. 上傳按鈕
      const uploadBtn = this.createUploadButton(student, index);
      container.appendChild(uploadBtn);

      return container;
    }

    /**
     * 創建進度膠囊
     */
    createProgressCapsule(index) {
      const capsule = document.createElement('div');
      capsule.className = 'lr-capsule';
      capsule.style.cssText = 'display:flex;gap:8px;align-items:center;justify-content:space-between;margin-bottom:8px;background:#f7fafc;border-radius:12px;padding:6px 10px';

      capsule.innerHTML = `
        <div class="capsule-stats" style="display:flex;gap:10px">
          <span id="cap-photo-${index}">
            <i class="fas fa-camera"></i> <span class="v">0</span>/3
          </span>
          <span id="cap-video-${index}">
            <i class="fas fa-video"></i> 影片<span class="optional-tag">（選）</span> <span class="v">0</span>
          </span>
          <span id="cap-text-${index}">
            <i class="fas fa-comment"></i> <span class="v">0</span>/20
          </span>
        </div>
        <div class="capsule-progress" style="flex:1;margin-left:8px;display:flex;align-items:center;gap:8px">
          <div class="bar" id="cap-bar-${index}" style="flex:1;height:6px;border-radius:3px;background:#e2e8f0;overflow:hidden">
            <div class="fill" style="width:0%;height:100%;background:#10b981"></div>
          </div>
          <div class="percent" id="cap-percent-${index}" style="min-width:42px;text-align:right;font-size:12px;color:#0f766e;font-weight:600">0%</div>
        </div>
      `;

      return capsule;
    }

    /**
     * 創建學生標頭
     */
    createStudentHeader(student, index) {
      const header = document.createElement('div');
      header.className = 'student-header';

      const name = document.createElement('div');
      name.className = 'student-name';
      name.textContent = student.name || '未命名';

      const remaining = document.createElement('div');
      remaining.className = 'student-remaining';
      remaining.textContent = `剩餘 ${student.remaining || 0} 堂`;

      header.appendChild(name);
      header.appendChild(remaining);

      return header;
    }

    /**
     * 創建出缺席狀態
     */
    createAttendanceStatus(student, index) {
      const statusDiv = document.createElement('div');
      statusDiv.className = 'attendance-status';
      statusDiv.id = `attendance-status-${index}`;

      const status = student.attendanceStatus || 'present';
      const statusText = this.getAttendanceStatusText(status);
      const statusClass = `status-${status}`;

      statusDiv.innerHTML = `<span class="${statusClass}">${statusText}</span>`;

      return statusDiv;
    }

    /**
     * 創建進度指示器
     */
    createProgressIndicators(index) {
      const indicators = document.createElement('div');
      indicators.className = 'progress-indicators';

      indicators.innerHTML = `
        <div class="indicator" id="photo-indicator-${index}">
          <div class="icon"><i class="fas fa-camera"></i></div>
          <div class="text"><span id="photo-count-${index}">0</span>/3 照片</div>
        </div>
        <div class="indicator" id="video-indicator-${index}">
          <div class="icon"><i class="fas fa-video"></i></div>
          <div class="text">影片<span class="optional-tag">（選）</span> <span id="video-count-${index}">0</span> 支</div>
        </div>
        <div class="indicator" id="comment-indicator-${index}">
          <div class="icon"><i class="fas fa-comment"></i></div>
          <div class="text"><span id="comment-count-${index}">0</span>/20 字</div>
        </div>
      `;

      return indicators;
    }

    /**
     * 創建上傳區域
     */
    createUploadAreas(student, index, options = {}) {
      const areas = [];

      // 照片上傳
      const photoArea = this.createUploadArea({
        type: 'photos',
        index: index,
        label: '📸 課程照片（需要 3 張）',
        accept: 'image/*',
        placeholder: '點擊或拖放照片（需要 3 張）'
      });
      areas.push(photoArea);

      // 影片上傳
      const videoArea = this.createUploadArea({
        type: 'videos',
        index: index,
        label: '🎬 課程影片',
        accept: 'video/*',
        placeholder: '點擊或拖放影片'
      });
      areas.push(videoArea);

      // 評語區域
      const commentArea = this.createCommentArea(student, index);
      areas.push(commentArea);

      return areas;
    }

    /**
     * 創建單一上傳區域
     */
    createUploadArea(config) {
      const area = document.createElement('div');
      area.className = 'upload-area';

      const label = document.createElement('label');
      label.className = 'upload-label';
      label.textContent = config.label;

      const dropZone = document.createElement('div');
      dropZone.className = 'file-drop-zone';
      dropZone.dataset.student = config.index;
      dropZone.dataset.type = config.type;
      dropZone.innerHTML = `
        <i class="fas fa-${config.type === 'photos' ? 'images' : 'video'}"></i>
        <div class="text">${config.placeholder}</div>
      `;

      const input = document.createElement('input');
      input.type = 'file';
      input.id = `${config.type}-${config.index}`;
      input.className = 'file-input';
      input.accept = config.accept;
      input.multiple = true;
      input.dataset.student = config.index;
      input.dataset.type = config.type;

      const previews = document.createElement('div');
      previews.className = 'file-previews';
      previews.id = `${config.type}-preview-${config.index}`;

      area.appendChild(label);
      area.appendChild(dropZone);
      area.appendChild(input);
      area.appendChild(previews);

      return area;
    }

    /**
     * 創建評語區域
     */
    createCommentArea(student, index) {
      const area = document.createElement('div');
      area.className = 'upload-area';

      const label = document.createElement('label');
      label.className = 'upload-label';
      label.textContent = '💬 課程評語（建議至少 20 字）';

      const textarea = document.createElement('textarea');
      textarea.className = 'comment-area';
      textarea.id = `comment-${index}`;
      textarea.placeholder = `請為 ${student.name || ''} 撰寫課程評語（建議 20 字以上），描述學習表現、進步情況等...`;
      textarea.dataset.student = index;

      const charCount = document.createElement('div');
      charCount.className = 'char-count';
      charCount.innerHTML = `<span id="comment-chars-${index}">0</span> / 20 字`;

      const progress = document.createElement('div');
      progress.className = 'comment-save-progress';
      progress.id = `comment-progress-${index}`;
      progress.innerHTML = `
        <div class="comment-progress-bar">
          <div class="comment-progress-fill" id="comment-progress-fill-${index}"></div>
        </div>
        <div class="comment-progress-text" id="comment-progress-text-${index}"></div>
      `;

      area.appendChild(label);
      area.appendChild(textarea);
      area.appendChild(charCount);
      area.appendChild(progress);

      return area;
    }

    /**
     * 創建上傳按鈕
     */
    createUploadButton(student, index) {
      const button = document.createElement('button');
      button.className = 'upload-btn auto-mode';
      button.id = `upload-btn-${index}`;
      button.disabled = true;
      button.onclick = () => {
        if (global.uploadStudentRecord) {
          global.uploadStudentRecord(index);
        }
      };
      button.innerHTML = '<i class="fas fa-robot"></i> 系統自動上傳';

      return button;
    }

    /**
     * 取得出缺席狀態文字
     */
    getAttendanceStatusText(status) {
      const statusMap = {
        'present': '✅ 出席',
        'late': '⏰ 遲到',
        'absent': '❌ 缺席',
        'leave': '📝 請假'
      };
      return statusMap[status] || status;
    }

    /**
     * 取得快取鍵
     */
    getCacheKey(student, index) {
      return `${student.name}-${index}-${student.remaining || 0}`;
    }

    /**
     * 更新學生卡片（部分更新，避免全部重渲染）
     */
    updateCard(index, updates) {
      // 更新進度指示器
      if (updates.photoCount !== undefined) {
        const el = DOM.$(`#photo-count-${index}`);
        if (el) el.textContent = updates.photoCount;
      }

      if (updates.videoCount !== undefined) {
        const el = DOM.$(`#video-count-${index}`);
        if (el) el.textContent = updates.videoCount;
      }

      if (updates.commentLength !== undefined) {
        const el = DOM.$(`#comment-count-${index}`);
        if (el) el.textContent = updates.commentLength;
      }

      // 更新進度百分比
      if (updates.progress !== undefined) {
        const bar = DOM.$(`#cap-bar-${index} .fill`);
        if (bar) bar.style.width = updates.progress + '%';
        
        const percent = DOM.$(`#cap-percent-${index}`);
        if (percent) percent.textContent = updates.progress + '%';
      }
    }

    /**
     * 清除快取
     */
    clearCache() {
      this.cardCache.clear();
      console.log('🧹 學生卡片快取已清除');
    }
  }

  // ============================================
  // 導出
  // ============================================
  const studentRenderer = new StudentRenderer();
  global.LearningStudentRenderer = studentRenderer;

  console.log('✅ StudentRenderer 已載入');

})(window);

