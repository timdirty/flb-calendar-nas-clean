/**
 * 學習歷程上傳系統 - 課程總覽渲染模組
 * 優化課程總覽的渲染和更新
 */

(function (global) {
  'use strict';

  const State = global.LearningUploadState;
  const DOM = global.LearningUploadDOM;
  
  // 🔥 引用全局 updateDOMAsync 函數（如果存在）
  const updateDOMAsync = global.updateDOMAsync || function(fn, timeout) {
    // 降級：使用 setTimeout
    setTimeout(fn, timeout || 16);
  };

  // ============================================
  // 課程總覽渲染器
  // ============================================
  class OverviewRenderer {
    constructor() {
      this.lastRenderData = null;
      this.fieldIds = ['ov_type', 'ov_date', 'ov_names', 'ov_count', 'ov_teacher', 'ov_topic', 'ov_perf', 'ov_issue', 'ov_solution'];
      
      // 🔒 添加渲染鎖
      this.isRendering = false;
      this.renderQueue = [];
    }

    /**
     * 渲染課程總覽區域
     */
    render(course, options = {}) {
      const mergedOptions = Object.assign({ skipExisting: true, force: false, prefetchedOverview: null }, options || {});
      let resolvedCourse = course || null;
      if (!resolvedCourse && mergedOptions.prefetchedOverview) {
        resolvedCourse = this.buildCourseFromOverview(mergedOptions.prefetchedOverview);
      }
      if (!resolvedCourse) {
        this.renderEmpty();
        return;
      }
      const prefetchedMedia = mergedOptions.prefetchedOverview ? this.transformOverviewRecord(mergedOptions.prefetchedOverview) : null;

      // 🔒 檢查渲染鎖
      if (this.isRendering && !mergedOptions.force) {
        console.warn('⚠️ [課程總覽] 正在渲染中，跳過重複調用');
        // 將請求加入佇列，等當前渲染完成後再處理
        this.renderQueue.push({ course: resolvedCourse, options: mergedOptions });
        return;
      }

      try {
        // 🔒 設置渲染鎖
        this.isRendering = true;
        
        // 🔥 防抖：避免短時間內多次渲染導致影片消失（500ms 內只渲染一次）
        const courseId = resolvedCourse.id || resolvedCourse.title || '';
        const now = Date.now();
        if (this._lastRenderTime && this._lastRenderCourseId === courseId && (now - this._lastRenderTime) < 500 && !mergedOptions.force) {
          console.log('⏭️ [課程總覽] 跳過重複渲染（防抖）');
          this.isRendering = false;
          this.processNextInQueue();
          return;
        }
        this._lastRenderTime = now;
        this._lastRenderCourseId = courseId;

        // 更新標題
        this.updateTitle(resolvedCourse);

        // 填充表單欄位（改為異步）
        this.populateFieldsAsync(resolvedCourse, mergedOptions);

        // 顯示已上傳的媒體（傳遞 force 選項）
        if (!mergedOptions.skipExisting) {
          this.renderExistingMedia(resolvedCourse, {
            force: mergedOptions.force || false,
            skipExisting: mergedOptions.skipExisting,
            prefetchedMedia: prefetchedMedia
          });
        }

        console.log('✅ 課程總覽渲染完成');

      } catch (error) {
        console.error('❌ 課程總覽渲染失敗:', error);
      } finally {
        // 🔓 釋放鎖
        this.isRendering = false;
        // 處理佇列中的下一個請求
        this.processNextInQueue();
      }
    }

    /**
     * 處理渲染佇列中的下一個請求
     */
    processNextInQueue() {
      if (this.renderQueue.length > 0) {
        const next = this.renderQueue.shift();
        console.log('🔄 [渲染佇列] 處理下一個請求');
        setTimeout(() => this.render(next.course, next.options), 100);
      }
    }

    /**
     * 更新課程標題
     */
    updateTitle(course) {
      const titleEl = DOM.$('#overviewCourseTitle');
      if (titleEl) {
        titleEl.textContent = course.title || course.courseName || '未命名課程';
      }
    }

    /**
     * 填充表單欄位
     */
    populateFields(course, options = {}) {
      const fieldData = this.prepareFieldData(course);

      // 批量更新欄位
      Object.keys(fieldData).forEach(fieldId => {
        const el = DOM.$(`#${fieldId}`);
        if (el && el.value !== fieldData[fieldId]) {
          // 只在值不同時更新，避免觸發不必要的事件
          if (!options.silent) {
            el.value = fieldData[fieldId];
          } else {
            // 靜默更新（不觸發 input 事件）
            Object.getOwnPropertyDescriptor(
              Object.getPrototypeOf(el), 
              'value'
            ).set.call(el, fieldData[fieldId]);
          }
        }
      });

      this.lastRenderData = fieldData;
    }

    /**
     * 🔥 異步填充表單欄位（逐個更新，不阻塞）
     */
    async populateFieldsAsync(course, options = {}) {
      const fieldData = this.prepareFieldData(course);
      const fieldIds = Object.keys(fieldData);
      
      console.log(`📝 開始異步更新 ${fieldIds.length} 個表單欄位...`);
      
      // 🔥 使用 updateDOMAsync 逐個更新欄位
      for (let i = 0; i < fieldIds.length; i++) {
        const fieldId = fieldIds[i];
        const value = fieldData[fieldId];
        
        // 使用 Promise 包裝 updateDOMAsync
        await new Promise(resolve => {
          updateDOMAsync(() => {
            const el = DOM.$(`#${fieldId}`);
            if (el) {
              const userEdited = el.dataset && el.dataset.userEdited === '1';
              const fromSummary = el.dataset && el.dataset.fromSummary === '1';
              const hasValue = String(el.value || '').trim().length > 0;
              if (!options.force && (userEdited || fromSummary)) {
                resolve();
                return;
              }
              if (hasValue && !options.force) {
                resolve();
                return;
              }
              if (el.value !== value) {
                if (!options.silent) {
                  el.value = value;
                } else {
                  Object.getOwnPropertyDescriptor(
                    Object.getPrototypeOf(el), 
                    'value'
                  ).set.call(el, value);
                }
                if (el.dataset) {
                  el.dataset.autoFilled = '1';
                }
              }
            }
            resolve();
          }, 0);
        });
      }
      
      this.lastRenderData = fieldData;
      console.log(`✅ 已更新 ${fieldIds.length} 個表單欄位`);
    }

    /**
     * 準備欄位資料
     */
    prepareFieldData(course) {
      const data = {};

      // 課程類型
      data.ov_type = this.extractCourseType(course);

      // 日期
      data.ov_date = course.date || course.formattedDate || '';

      // 學生姓名
      const students = course.students || [];
      data.ov_names = students.map(s => s.name).join('、');

      // 學生人數
      data.ov_count = String(students.length);

      // 講師
      data.ov_teacher = course.instructor || '';

      // 其他欄位保持空白（由用戶填寫）
      data.ov_topic = '';
      data.ov_perf = '';
      data.ov_issue = '';
      data.ov_solution = '';

      return data;
    }

    /**
     * 提取課程類型
     */
    extractCourseType(course) {
      if (course.courseType) {
        return course.courseType;
      }

      // 從標題提取
      const title = course.title || course.courseName || '';
      const parser = global.FLB?.CourseTitleParser;
      
      if (parser && parser.parse) {
        const parsed = parser.parse(title);
        return parsed.course || parsed.courseName || '';
      }

      // 後備：簡單提取第一個單詞
      const match = title.match(/^[\u4e00-\u9fa5A-Za-z0-9]+/);
      return match ? match[0] : '';
    }

    buildCourseFromOverview(overview) {
      if (!overview) return null;
      return {
        id: overview.recordPath || overview.relativePath || '',
        title: overview.coursePeriod || overview.courseName || '課程總覽',
        courseName: overview.courseName || '',
        coursePeriod: overview.coursePeriod || '',
        date: overview.date || overview.dateKey || '',
        formattedDate: overview.date || overview.dateKey || '',
        instructor: overview.instructor || '',
        students: []
      };
    }

    /**
     * 渲染已上傳的媒體（分批異步處理，避免阻塞主線程）
     * ✅ 添加快取機制，避免重複載入
     */
    async renderExistingMedia(course, options = {}) {
      const previewsContainer = DOM.$('#overviewExistingPreviews');
      if (!previewsContainer) return;

      if (options.skipExisting) {
        console.log('⏭️ [課程總覽] skipExisting=true，維持現有預覽');
        return;
      }

      if (previewsContainer.dataset && previewsContainer.dataset.renderSource === 'legacy' && !options.force) {
        console.log('⏭️ [課程總覽] 已由舊系統渲染，跳過新模組預覽');
        return;
      }

      try {
        // ✅ 快取檢查：如果已經載入過相同課程的媒體，且不是強制刷新，則跳過
        const courseId = course.id || course.title || '';
        
        if (!options.force && this._mediaCache && this._mediaCache.courseId === courseId && this._mediaCache.mediaCount > 0) {
          // 檢查 DOM 中是否已經有媒體元素
          const existingPreviews = previewsContainer.querySelectorAll('.file-preview.existing');
          if (existingPreviews.length === this._mediaCache.mediaCount) {
            console.log('⏭️ [課程總覽] 媒體已載入，跳過重複載入');
            return;
          }
        }

        // 取得已上傳的記錄
        let uploadedRecords = options.prefetchedMedia || null;
        if (!uploadedRecords) {
          uploadedRecords = await this.fetchExistingRecords(course, { force: options.force });
        }
        
        // 🔥 檢查是否有任何媒體（照片或影片）
        const hasPhotos = uploadedRecords && Array.isArray(uploadedRecords.overviewPhotos) && uploadedRecords.overviewPhotos.length > 0;
        const hasVideos = uploadedRecords && Array.isArray(uploadedRecords.overviewVideos) && uploadedRecords.overviewVideos.length > 0;
        
        if (!hasPhotos && !hasVideos) {
          // ✅ 異步清空容器（避免阻塞）
          await new Promise(resolve => {
            updateDOMAsync(() => {
              previewsContainer.innerHTML = '';
              try { delete previewsContainer.dataset.renderSource; } catch (e) {}
              // 更新快取
              this._mediaCache = { courseId, mediaCount: 0 };
              resolve();
            }, 0);
          });
          try { global.updateOverviewZonesAndPlus && global.updateOverviewZonesAndPlus(); } catch (e) {}
          return;
        }

        // ✅ 合併所有媒體
        const allMedia = [];
        if (hasPhotos) {
          uploadedRecords.overviewPhotos.forEach((media, index) => {
            allMedia.push({ ...media, index, type: 'image' });
          });
        }
        if (hasVideos) {
          uploadedRecords.overviewVideos.forEach((media, index) => {
            allMedia.push({ ...media, index: index + (hasPhotos ? uploadedRecords.overviewPhotos.length : 0), type: 'video' });
          });
        }

        const totalCount = allMedia.length;
        
        // ✅ 如果媒體數量相同且已載入，跳過重新載入
        if (!options.force && this._mediaCache && this._mediaCache.courseId === courseId && this._mediaCache.mediaCount === totalCount) {
          const existingPreviews = previewsContainer.querySelectorAll('.file-preview.existing');
          if (existingPreviews.length === totalCount) {
            console.log('⏭️ [課程總覽] 媒體已載入，跳過重複載入');
            return;
          }
        }

        // ✅ 清空容器（只在必要時，異步執行）
        if (options.force || !previewsContainer.querySelector('.file-preview.existing')) {
          await new Promise(resolve => {
            updateDOMAsync(() => {
              previewsContainer.innerHTML = '';
              try { delete previewsContainer.dataset.renderSource; } catch (e) {}
              resolve();
            }, 0);
          });
        }

        console.log(`📦 開始分批載入 ${totalCount} 個課程總覽媒體（避免阻塞主線程）...`);

        // ✅ 分批渲染配置（調整為更小的批次和更長的延遲，確保不阻塞）
        const BATCH_SIZE = 3; // 每批處理 3 個（減少批次大小）
        const DELAY_MS = 50; // 每批之間延遲 50ms（增加延遲時間）

        // ✅ 使用 setTimeout 而非 await，讓載入完全異步，不阻塞 UI
        let currentIndex = 0;
        
        const processBatchAsync = () => {
          if (currentIndex >= allMedia.length) {
            // 更新快取
            this._mediaCache = { courseId, mediaCount: totalCount };
            console.log(`✅ 已載入 ${totalCount} 個課程總覽媒體（照片: ${hasPhotos ? uploadedRecords.overviewPhotos.length : 0}, 影片: ${hasVideos ? uploadedRecords.overviewVideos.length : 0}）`);
            return;
          }

          const endIndex = Math.min(currentIndex + BATCH_SIZE, allMedia.length);
          const batch = allMedia.slice(currentIndex, endIndex);

          // 🔥 使用 updateDOMAsync 創建和添加預覽元素（避免阻塞）
          updateDOMAsync(() => {
            const fragment = document.createDocumentFragment();
            batch.forEach(media => {
              const preview = this.createMediaPreviewLazy(media, media.index, course);
              fragment.appendChild(preview);
            });
            previewsContainer.appendChild(fragment);
            try {
              global.setupLazyMedia && global.setupLazyMedia(previewsContainer);
              global.attachThumbLoadingHandlers && global.attachThumbLoadingHandlers(previewsContainer);
            } catch (handlerErr) {
              console.warn('⚠️ [課程總覽] 應用預覽處理失敗:', handlerErr);
            }
            
            // ✅ 延遲載入媒體源
            if (window.requestIdleCallback) {
              window.requestIdleCallback(() => {
                batch.forEach((media, batchIndex) => {
                  const previewIndex = currentIndex + batchIndex;
                  const preview = previewsContainer.children[previewIndex];
                  if (preview) {
                    this.loadMediaSource(preview, media);
                  }
                });
              }, { timeout: 200 });
            } else {
              setTimeout(() => {
                batch.forEach((media, batchIndex) => {
                  const previewIndex = currentIndex + batchIndex;
                  const preview = previewsContainer.children[previewIndex];
                  if (preview) {
                    this.loadMediaSource(preview, media);
                  }
                });
              }, 20);
            }
          }, 0);

          console.log(`✅ 已載入 ${endIndex} / ${totalCount} 個媒體`);

          // 處理下一批（延遲執行，讓瀏覽器有空閒時間處理用戶操作）
          currentIndex = endIndex;
          if (currentIndex < allMedia.length) {
            setTimeout(processBatchAsync, DELAY_MS);
          } else {
            // 更新快取
            this._mediaCache = { courseId, mediaCount: totalCount };
            console.log(`✅ 已載入 ${totalCount} 個課程總覽媒體（照片: ${hasPhotos ? uploadedRecords.overviewPhotos.length : 0}, 影片: ${hasVideos ? uploadedRecords.overviewVideos.length : 0}）`);
          }
        };

        // ✅ 立即開始處理第一批（不等待）
        processBatchAsync();
        try { global.updateOverviewZonesAndPlus && global.updateOverviewZonesAndPlus(); } catch (e) {}

      } catch (error) {
        console.error('❌ 載入已上傳媒體失敗:', error);
        previewsContainer.innerHTML = '';
        try { delete previewsContainer.dataset.renderSource; } catch (e) {}
        try { global.updateOverviewZonesAndPlus && global.updateOverviewZonesAndPlus(); } catch (e) {}
      }
    }

    /**
     * 載入媒體源（延遲設置 src，避免阻塞）
     */
    loadMediaSource(preview, media) {
      const img = preview.querySelector('img');
      const video = preview.querySelector('video');
      
      if (img && !img.src) {
        img.src = media.url || media.thumbnailUrl || '';
      }
      
      if (video && !video.src) {
        video.src = media.url || '';
        if (media.thumbnailUrl) {
          video.poster = media.thumbnailUrl;
        }
      }
    }

    /**
     * 取得已上傳的記錄
     * 🔥 2025-11-08: 改用 Drive API
     */
    async fetchExistingRecords(course, options = {}) {
      try {
        // ✅ 優先使用已載入的快取資料（避免重複 API 請求）
        if (!options.force) {
          const cachedOverview = global.FLB?.State?.get?.()?.uploadedRecordsCache?.overview;
          if (cachedOverview && cachedOverview.relativePath) {
            console.log('📦 [課程總覽] 使用快取資料渲染');
            return this.transformOverviewRecord(cachedOverview);
          }
        }
        
        // 🔥 使用 Drive API 查詢記錄
        const parsed = global.FLB?.Course?.parseTitle?.(course.title || course.courseName || '');
        const courseName = parsed?.courseName || course.courseName || '';
        const period = (parsed?.period || '').replace(/\s+/g, '').replace(/:(?=\d{2})/g, '');
        const date = course.date || course.formattedDate || '';
        const semester = course.semester || '114-1';
        
        // 構建 coursePeriod（與上傳時一致）
        const coursePeriod = course.title || `${courseName} ${period}`.trim();
        
        const response = await global.FLB?.Api?.getRecordsByCourse({
          course: courseName,
          period: period,
          date: date,
          coursePeriod: coursePeriod,
          semester: semester
        });
        
        if (!response || !response.success) {
          throw new Error('取得記錄失敗');
        }

        // 提取課程總覽記錄
        const overview = response.overview;
        if (!overview) {
          return null;
        }

        return this.transformOverviewRecord(overview);

      } catch (error) {
        console.error('❌ 取得已上傳記錄失敗:', error);
        return null;
      }
    }

    transformOverviewRecord(overview) {
      if (!overview) return null;
      const result = {
        overviewPhotos: [],
        overviewVideos: []
      };
      const relPath = overview.relativePath || overview.recordPath || '';
      const photoEntries = Array.isArray(overview.photoEntries)
        ? overview.photoEntries
        : (Array.isArray(overview.photos) && typeof overview.photos[0] === 'object' ? overview.photos : []);
      const videoEntries = Array.isArray(overview.videoEntries)
        ? overview.videoEntries
        : (Array.isArray(overview.videos) && typeof overview.videos[0] === 'object' ? overview.videos : []);

      if (photoEntries.length) {
        result.overviewPhotos = photoEntries
          .map(entry => this.normalizeMediaEntry(entry, relPath, 'image'))
          .filter(Boolean);
      }

      if (!result.overviewPhotos.length && Array.isArray(overview.files)) {
        result.overviewPhotos = overview.files
          .filter(entry => {
            var name = typeof entry === 'string' ? entry : (entry && (entry.filename || entry.name || entry.path));
            return this.isImageFile(name || '');
          })
          .map(entry => this.normalizeMediaEntry(entry, relPath, 'image'))
          .filter(Boolean);
      }

      if (videoEntries.length) {
        result.overviewVideos = videoEntries
          .map(entry => this.normalizeMediaEntry(entry, relPath, 'video'))
          .filter(Boolean);
      }

      if (!result.overviewVideos.length && Array.isArray(overview.files)) {
        result.overviewVideos = overview.files
          .filter(entry => {
            var name = typeof entry === 'string' ? entry : (entry && (entry.filename || entry.name || entry.path));
            return this.isVideoFile(name || '');
          })
          .map(entry => this.normalizeMediaEntry(entry, relPath, 'video'))
          .filter(Boolean);
      }

      return result;
    }

    normalizeMediaEntry(entry, relativePath, type) {
      if (entry == null) return null;
      if (typeof entry === 'object' && entry.filesystemPath) {
        entry.path = entry.filesystemPath;
      }
      var filename = '';
      if (typeof entry === 'string') {
        filename = entry;
      } else if (entry && typeof entry === 'object') {
        filename = entry.fileName || entry.filename || entry.name || entry.path || '';
      }
      filename = String(filename || '').trim();
      if (!filename) return null;

      const directPath = entry && entry.path ? String(entry.path) : '';
      const normalizedPath = directPath ? (directPath.startsWith('/') ? directPath : '/' + directPath) : '';
      const baseUrl = entry && (entry.proxyUrl || entry.url);
      const url = baseUrl || (normalizedPath ? `/api/drive-media${normalizedPath}` : this.buildDriveMediaUrl(relativePath, filename));
      let thumbnailUrl = url;
      if (type === 'video') {
        if (entry && entry.thumbnailUrl) {
          thumbnailUrl = entry.thumbnailUrl;
        } else if (entry && entry.thumbnailFilename) {
          thumbnailUrl = this.buildDriveMediaUrl(relativePath, entry.thumbnailFilename);
        } else if (!normalizedPath) {
          thumbnailUrl = url;
        }
      }
      return {
        filename: filename,
        url: url,
        thumbnailUrl: thumbnailUrl
      };
    }

    buildDriveMediaUrl(relativePath, filename, options) {
      if (!relativePath || !filename) return '';
      const directFn = typeof global.buildDirectFileUrl === 'function' ? global.buildDirectFileUrl : null;
      if (directFn) {
        return directFn(relativePath, filename, options);
      }
      const proxyPath = this.encodeDrivePath(relativePath, filename);
      return proxyPath ? `/api/drive-media/${proxyPath}` : '';
    }

    encodeDrivePath(relativePath, filename) {
      const helper = typeof global.buildDriveProxyPath === 'function' ? global.buildDriveProxyPath : null;
      if (helper) return helper(relativePath, filename);
      const segments = [];
      function pushSeg(source) {
        if (!source) return;
        String(source).replace(/^\/+/, '').split('/').forEach(seg => {
          if (!seg) return;
          segments.push(encodeURIComponent(seg));
        });
      }
      pushSeg(relativePath);
      pushSeg(filename);
      return segments.join('/');
    }

    /**
     * 創建媒體預覽元素（懶加載版本，不立即設置 src）
     */
    createMediaPreviewLazy(media, index, course) {
      // 🔥 使用與主系統一致的 file-preview 類別，確保 CSS 樣式正確應用
      const preview = document.createElement('div');
      preview.className = 'file-preview existing preview-clickable';
      preview.dataset.filename = media.filename || '';
      preview.dataset.previewType = media.type || (this.isVideoFile(media.filename) ? 'video' : 'image');
      // ✅ 設置預覽 URL：優先使用實際媒體 URL，事件委派會用於預覽覆蓋層
      preview.dataset.previewUrl = media.url || media.thumbnailUrl || '';

      const isVideo = media.type === 'video' || this.isVideoFile(media.filename);

      if (isVideo) {
        // 影片預覽（先不設置 src，稍後分批設置）
        const video = document.createElement('video');
        // ✅ 不立即設置 src，避免阻塞主線程
        video.className = 'video-poster';
        video.controls = false;
        video.muted = true;
        video.playsInline = true;
        video.loading = 'lazy'; // 原生懶加載
        
        preview.appendChild(video);

        const playOverlay = document.createElement('div');
        playOverlay.className = 'video-play-overlay';
        playOverlay.innerHTML = '<i class="fas fa-play-circle"></i>';
        // ✅ 移除 onclick，讓事件委派處理
        preview.appendChild(playOverlay);

      } else {
        // 圖片預覽（先不設置 src，稍後分批設置）
        const img = document.createElement('img');
        // ✅ 不立即設置 src，避免阻塞主線程
        img.alt = media.filename || '照片';
        img.loading = 'lazy'; // 原生懶加載
        // 🔥 確保圖片有正確的樣式（CSS 會處理，但這裡確保沒有內聯樣式干擾）
        img.style.width = '';
        img.style.height = '';
        img.style.maxWidth = '';
        img.style.maxHeight = '';
        preview.appendChild(img);
      }

      // 刪除按鈕（使用與主系統一致的 remove-btn 類別）
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'remove-btn';
      deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
      deleteBtn.setAttribute('aria-label', `刪除${isVideo ? '影片' : '照片'}`);
      deleteBtn.onclick = async (e) => {
        e.stopPropagation(); // 防止觸發預覽點擊
        if (confirm(`確定要刪除這個${isVideo ? '影片' : '照片'}嗎？`)) {
          await this.deleteMedia(course, media.filename);
          preview.remove();
        }
      };

      preview.appendChild(deleteBtn);

      // ✅ 移除直接設置 onclick，改用事件委派（已在 learning-record-upload.js 中實現）
      // 事件委派會自動處理 .file-preview.preview-clickable 的點擊事件
      // 刪除按鈕的點擊事件已經在 deleteBtn 上處理（e.stopPropagation()），不會觸發預覽
      // 預覽功能由 learning-record-upload.js 中的事件委派處理（第 15275-15320 行）
      // 會調用 openPreviewOverlay() 顯示預覽覆蓋層，而不是下載檔案

      return preview;
    }

    /**
     * 創建媒體預覽元素（保留原方法以向後兼容）
     */
    createMediaPreview(media, index, course) {
      // 🔥 使用與主系統一致的 file-preview 類別，確保 CSS 樣式正確應用
      const preview = document.createElement('div');
      preview.className = 'file-preview existing preview-clickable';
      preview.dataset.filename = media.filename || '';
      preview.dataset.previewType = this.isVideoFile(media.filename) ? 'video' : 'image';
      // ✅ 設置預覽 URL：優先使用實際媒體 URL，事件委派會用於預覽覆蓋層
      preview.dataset.previewUrl = media.url || media.thumbnailUrl || '';

      const isVideo = this.isVideoFile(media.filename);

      if (isVideo) {
        // 影片預覽
        const video = document.createElement('video');
        video.src = media.url || '';
        video.className = 'video-poster';
        video.controls = false;
        video.muted = true;
        video.playsInline = true;
        
        if (media.thumbnailUrl) {
          video.poster = media.thumbnailUrl;
        }
        
        preview.appendChild(video);

        const playOverlay = document.createElement('div');
        playOverlay.className = 'video-play-overlay';
        playOverlay.innerHTML = '<i class="fas fa-play-circle"></i>';
        // ✅ 移除 onclick，讓事件委派處理（learning-record-upload.js 中的事件委派會處理 .file-preview.preview-clickable 的點擊）

        preview.appendChild(playOverlay);

      } else {
        // 圖片預覽
        const img = document.createElement('img');
        img.src = media.url || media.thumbnailUrl || '';
        img.alt = media.filename || '照片';
        img.loading = 'lazy';
        // 🔥 確保圖片有正確的樣式（CSS 會處理，但這裡確保沒有內聯樣式干擾）
        img.style.width = '';
        img.style.height = '';
        img.style.maxWidth = '';
        img.style.maxHeight = '';
        preview.appendChild(img);
      }

      // 刪除按鈕（使用與主系統一致的 remove-btn 類別）
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'remove-btn';
      deleteBtn.innerHTML = '<i class="fas fa-times"></i>';
      deleteBtn.setAttribute('aria-label', `刪除${isVideo ? '影片' : '照片'}`);
      deleteBtn.onclick = async (e) => {
        e.stopPropagation(); // 防止觸發預覽點擊
        if (confirm(`確定要刪除這個${isVideo ? '影片' : '照片'}嗎？`)) {
          await this.deleteMedia(course, media.filename);
          preview.remove();
        }
      };

      preview.appendChild(deleteBtn);

      // ✅ 移除直接設置 onclick，改用事件委派（已在 learning-record-upload.js 中實現）
      // 事件委派會自動處理 .file-preview.preview-clickable 的點擊事件
      // 刪除按鈕的點擊事件已經在 deleteBtn 上處理（e.stopPropagation()），不會觸發預覽
      // 預覽功能由 learning-record-upload.js 中的事件委派處理（第 15275-15320 行）
      // 會調用 openPreviewOverlay() 顯示預覽覆蓋層，而不是下載檔案

      return preview;
    }

    /**
     * 刪除媒體
     * 🔥 2025-11-08: 改用 Synology Drive API
     */
    async deleteMedia(course, filename) {
      try {
        // 🔥 使用 Drive API 刪除（與學生頁面一致）
        // 需要構建 recordPath，類似於 buildRecordOperationMeta 的邏輯
        
        // 嘗試從快取獲取 relativePath
        let relativePath = '';
        try {
          const state = global.FLB?.State?.get();
          const cache = state?.uploadedRecordsCache;
          if (cache?.overview?.relativePath) {
            relativePath = cache.overview.relativePath;
            console.log('📁 [deleteMedia] 使用快取的 relativePath:', relativePath);
          }
        } catch (e) {
          console.warn('⚠️ [deleteMedia] 無法從快取獲取 relativePath:', e);
        }
        
        // 如果沒有快取路徑，嘗試從 course 物件構建
        if (!relativePath && course) {
          // 解析課程標題
          const parsed = global.FLB?.Course?.parseTitle?.(course.title || course.courseName || '');
          const courseName = parsed?.courseName || course.courseName || '';
          const date = course.date || course.formattedDate || '';
          const semester = course.semester || '114-1'; // 預設學期
          
          // 🔥 構建路徑：與 api-client.js 保持一致
          // 格式：/Fun Learn Bar/FLB-Learning-Portfolio/{semester}/{courseName}/{date}/課程總覽
          relativePath = `/Fun Learn Bar/FLB-Learning-Portfolio/${semester}/${courseName}/${date}/課程總覽`;
          console.log('📁 [deleteMedia] 構建新的 relativePath:', relativePath);
        }
        
        if (!relativePath) {
          throw new Error('無法確定記錄路徑');
        }
        
        // 🔥 使用 Drive API 刪除
        await global.FLB.Api.deleteRecord({
          relativePath: relativePath,
          filename: filename
        });
        
        console.log('✅ [deleteMedia] 媒體已刪除:', filename);
        
        // 更新快取：移除該檔案
        try {
          const state = global.FLB?.State?.get();
          if (state?.uploadedRecordsCache?.overview) {
            const overview = state.uploadedRecordsCache.overview;
            if (Array.isArray(overview.photos)) {
              overview.photos = overview.photos.filter(p => p.name !== filename);
            }
            if (Array.isArray(overview.videos)) {
              overview.videos = overview.videos.filter(v => v.name !== filename);
            }
            global.FLB.State.set({ uploadedRecordsCache: state.uploadedRecordsCache });
            console.log('✅ [deleteMedia] 快取已更新');
          }
        } catch (e) {
          console.warn('⚠️ [deleteMedia] 更新快取失敗:', e);
        }
        
        if (global.showToast) {
          global.showToast('已刪除', 'success');
        }

        return true;

      } catch (error) {
        console.error('❌ [deleteMedia] 刪除媒體失敗:', error);
        
        if (global.showToast) {
          global.showToast('刪除失敗: ' + error.message, 'error');
        }

        return false;
      }
    }

    /**
     * 判斷是否為圖片檔案
     */
    isImageFile(filename) {
      if (!filename) return false;
      const imageExts = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
      const lowerFilename = String(filename).toLowerCase();
      return imageExts.some(ext => lowerFilename.endsWith(ext));
    }

    /**
     * 判斷是否為影片檔案
     */
    isVideoFile(filename) {
      if (!filename) return false;
      const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
      const lowerFilename = String(filename).toLowerCase();
      return videoExts.some(ext => lowerFilename.endsWith(ext));
    }

    /**
     * 渲染空狀態
     */
    renderEmpty() {
      // 清空所有欄位
      this.fieldIds.forEach(fieldId => {
        const el = DOM.$(`#${fieldId}`);
        if (el) {
          el.value = '';
        }
      });

      // 清空標題
      const titleEl = DOM.$('#overviewCourseTitle');
      if (titleEl) {
        titleEl.textContent = '請選擇課程';
      }

      // 清空預覽
      const previewsContainer = DOM.$('#overviewExistingPreviews');
      if (previewsContainer) {
        previewsContainer.innerHTML = '';
        try { delete previewsContainer.dataset.renderSource; } catch (e) {}
        // 🔥 重新設置 Grid 樣式（innerHTML 會移除內聯樣式）
        try { global.ensureOverviewGridStyle && global.ensureOverviewGridStyle(); } catch (e) {}
        try { global.updateOverviewZonesAndPlus && global.updateOverviewZonesAndPlus(); } catch (e) {}
      }
    }

    /**
     * 清除所有欄位
     */
    clearFields() {
      this.renderEmpty();
      
      // 同時清除新上傳的預覽
      const newPreviewsContainer = DOM.$('#overviewPhotosPreviews');
      if (newPreviewsContainer) {
        newPreviewsContainer.innerHTML = '';
        // 🔥 重新設置 Grid 樣式（innerHTML 會移除內聯樣式）
        try { global.ensureOverviewGridStyle && global.ensureOverviewGridStyle(); } catch (e) {}
      }

      // 重置檔案輸入
      const fileInput = DOM.$('#overviewPhotosInput');
      if (fileInput) {
        fileInput.value = '';
      }

      console.log('🧹 課程總覽欄位已清空');
    }

    /**
     * 取得表單資料
     */
    getFormData() {
      const data = {};

      this.fieldIds.forEach(fieldId => {
        const el = DOM.$(`#${fieldId}`);
        if (el) {
          data[fieldId] = el.value || '';
        }
      });

      return data;
    }

    /**
     * 驗證表單資料
     */
    validateFormData(data) {
      const errors = [];

      // 必填欄位檢查
      if (!data.ov_type) {
        errors.push('課程類型不能為空');
      }
      if (!data.ov_date) {
        errors.push('課程日期不能為空');
      }

      return {
        valid: errors.length === 0,
        errors: errors
      };
    }
  }

  // ============================================
  // 導出
  // ============================================
  const overviewRenderer = new OverviewRenderer();
  global.LearningOverviewRenderer = overviewRenderer;

  console.log('✅ OverviewRenderer 已載入');

})(window);
