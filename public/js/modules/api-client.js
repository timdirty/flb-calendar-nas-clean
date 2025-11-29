// ==================== 🚀 API Client 2.0 (2025-11-04) ====================
// 新架構：媒體與文字分離
// - 媒體文件 → /api/drive-upload/* (分片上傳 + Synology Drive 寫入)
// - 文字評語 → /api/learning-records/save (純文字 API)
// - 向後相容：保留舊 API 支援，但優先使用新架構
// ========================================================================

(function (global) {
  const DRIVE_ROOT_PATH = (global && global.__FLB_DRIVE_ROOT__) || '/Fun Learn Bar/FLB-Learning-Portfolio';

  function normalizeDrivePath(input) {
    var cleanRoot = DRIVE_ROOT_PATH;
    var target = String(input || '').trim();
    if (!target) return cleanRoot;
    var normalized = target.replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }
    if (normalized.startsWith(cleanRoot)) {
      return normalized;
    }
    normalized = normalized.replace(/^\/+/, '');
    return (cleanRoot + '/' + normalized).replace(/\/{2,}/g, '/');
  }
  function buildQuery(params) {
    const sp = new URLSearchParams();
    Object.keys(params || {}).forEach((k) => {
      const v = params[k];
      if (v !== undefined && v !== null && String(v).length > 0) {
        sp.set(k, String(v));
      }
    });
    sp.set('_t', Date.now());
    return sp.toString();
  }

  async function handleResponse(resp) {
    const isJson = (resp.headers.get('content-type') || '').includes('application/json');
    if (!resp.ok) {
      if (isJson) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || ('HTTP ' + resp.status + ': ' + resp.statusText));
      } else {
        const txt = await resp.text().catch(() => '');
        throw new Error('HTTP ' + resp.status + ': ' + resp.statusText + (txt ? ' - ' + txt.slice(0, 120) : ''));
      }
    }
    return isJson ? resp.json() : resp.text();
  }

  // ==================== 🆕 媒體上傳輔助函數 ====================
  
  /**
   * 使用新媒體 API 上傳單個文件
   * @param {File} file - 文件對象
   * @param {object} metadata - 元數據
   * @param {function} onProgress - 進度回調
   * @returns {Promise<string>} 返回 mediaId
   */
  async function uploadMediaFile(file, metadata, onProgress) {
    if (!global.ChunkedUploader) {
      throw new Error('ChunkedUploader 模組未載入');
    }
    
    const record = await global.ChunkedUploader.uploadFileChunked(
      file,
      onProgress,
      null,  // onError
      { metadata }
    );
    
    if (!record || !record.id) {
      throw new Error('媒體上傳失敗：未返回 ID');
    }
    
    return record;
  }

  /**
   * 批次上傳媒體文件
   * @param {File[]} files - 文件陣列
   * @param {object} metadata - 元數據
   * @param {function} onProgress - 進度回調 (percent, current, total)
   * @returns {Promise<string[]>} 返回 mediaIds 陣列
   */
  async function uploadMediaBatch(files, metadata, onProgress) {
    if (!files || files.length === 0) return [];
    
    const mediaIds = [];
    const total = files.length;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const mediaRecord = await uploadMediaFile(file, metadata, (filePercent) => {
        // 計算總體進度
        const overallPercent = Math.round(((i + filePercent / 100) / total) * 100);
        if (onProgress) onProgress(overallPercent, i + 1, total);
      });
      mediaIds.push(mediaRecord.id);
    }
    
    return mediaIds;
  }

  // ==================== 📡 API 函數 ====================

  const Api = {
    // ==================== 輔助：學期列表 ====================
    async getSemesters() {
      // 先嘗試呼叫後端 /api/semesters（若存在）
      try {
        const resp = await fetch('/api/semesters');
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.success && Array.isArray(data.semesters)) {
            return { success: true, semesters: data.semesters };
          }
        }
      } catch (_) {}
      // 後端無對應 API：前端動態推算當前與上一學期（ROC 年）
      function computeCurrentSemester(d) {
        const dt = d || new Date();
        const y = dt.getFullYear();
        const m = dt.getMonth() + 1; // 1-12
        // 台灣學期：8~1 月為上學期(1)，2~7 月為下學期(2)
        // 例：2025/11 → 114-1（2025-1911=114）
        const roc = y - 1911;
        const term = (m >= 8 || m <= 1) ? 1 : 2;
        return `${roc}-${term}`;
      }
      function previousSemester(sem) {
        const [yy, tt] = String(sem || '').split('-');
        let roc = parseInt(yy, 10) || 114;
        let term = parseInt(tt, 10) || 1;
        if (term === 2) term = 1; else { term = 2; roc = roc - 1; }
        return `${roc}-${term}`;
      }
      const cur = computeCurrentSemester();
      const prev = previousSemester(cur);
      return { success: true, semesters: [cur, prev] };
    },
    // ==================== 查詢相關 ====================
    
    async getStudentFilterConfig() {
      const resp = await fetch('/api/student-filter-config');
      return handleResponse(resp);
    },
    
    async getSystemSettings() {
      const resp = await fetch('/api/system-settings');
      return handleResponse(resp);
    },
    
    async getCompletedCourses(opts) {
      const query = buildQuery({
        range: opts && opts.range === 'week' ? 'week' : 'day',
        date: opts && opts.date,
        eventId: opts && opts.eventId,
        instructor: opts && opts.instructor
      });
      const url = '/api/learning-records/today-completed-courses?' + query;
      const resp = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
      });
      const data = await handleResponse(resp);
      if (!data || data.success === false) {
        throw new Error((data && data.message) || '獲取課程失敗');
      }
      return data;
    },

    async getStudentData() {
      const resp = await fetch('/api/students');
      return handleResponse(resp);
    },

    async checkCompletion({ course, period, date, studentName }) {
      const query = buildQuery({ course, period, date, studentName });
      const resp = await fetch('/api/learning-records/check-completion?' + query);
      return handleResponse(resp);
    },

    async getHistory(filters) {
      const query = buildQuery(filters || {});
      const resp = await fetch('/api/learning-records/history-drive?' + query);
      const raw = await handleResponse(resp);
      if (!raw || !raw.records) return raw;
      // 正規化欄位：補上 course/date/type 並展開 photos/videos 物件陣列
      const normalizeFromPath = (rec) => {
        const p = String(rec.recordPath || rec.relativePath || rec.path || '').replace(/\\+/g, '/');
        const parts = p.split('/').filter(Boolean);
        const idxFLB = parts.findIndex(x => x === 'FLB-Learning-Portfolio');
        const courseName = (idxFLB >= 0 && parts[idxFLB + 2]) ? parts[idxFLB + 2] : (rec.courseName || rec.course || '');
        const dateSeg = (idxFLB >= 0 && parts[idxFLB + 3]) ? parts[idxFLB + 3] : (rec.date || '');
        let dateOnly = rec.date || '';
        let topic = '';
        const m = String(dateSeg || '').match(/^(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/);
        if (m) { dateOnly = dateOnly || m[1]; topic = m[2] || ''; }
        return { course: courseName || '', date: dateOnly || rec.date || '', topic };
      };
      const normalizeMedia = (arr) => Array.isArray(arr) ? arr.map(x => (typeof x === 'string' ? x : (x && (x.name || x.filename) || ''))).filter(Boolean) : [];
      const records = (raw.records || []).map(r => {
        const base = Object.assign({}, r);
        const fromPath = normalizeFromPath(base);
        base.course = base.course || fromPath.course || '';
        base.date = base.date || fromPath.date || '';
        base.type = (base.isOverview || base.studentName === '課程總覽') ? 'overview' : 'student';
        // 補齊 teacher 欄位（優先後端，否則從文字解析）
        base.teacher = base.teacher || base.instructorName || base.instructor || '';
        if (!base.teacher) {
          const text = base.overviewSummary || base.comment || '';
          if (text) {
            try {
              const m = String(text).match(/(?:講師姓名|講師|老師)\s*[：: ]\s*([A-Za-z\u4E00-\u9FFF]+)\b/);
              if (m && m[1]) base.teacher = m[1].trim();
            } catch (e) {}
          }
        }
        // 規整照片/影片欄位
        if (Array.isArray(base.photos)) base.photos = base.photos.length; else if (typeof base.photos !== 'number') base.photos = 0;
        if (Array.isArray(base.videos)) base.videos = base.videos.length; else if (typeof base.videos !== 'number') base.videos = 0;
        // 提供 files 陣列方便渲染
        base.files = base.files || {};
        base.files.photos = base.files.photos || normalizeMedia(r.photos);
        base.files.videos = base.files.videos || normalizeMedia(r.videos);
        return base;
      });
      return Object.assign({}, raw, { records });
    },
    
    // ❌ 已刪除：getSemesters, getCourses（本地文件系統 API）
    // ❌ 已刪除：lookupStudentByDate（本地文件系統 API）
    // ✅ 改用 Drive API

    async getRecordsByCourse({ course, period, date, coursePeriod, semester }) {
      // 🔥 2025-11-08: 改用 Drive API
      // 從 coursePeriod 或 course+period 構建 courseName
      let courseName = coursePeriod || `${course} ${period || ''}`.trim();
      
      const query = buildQuery({ 
        semester: semester || '114-1', 
        courseName, 
        date 
      });
      
      // 🔍 [診斷 2025-11-19] 輸出完整查詢 URL
      const fullUrl = '/api/learning-records/history-drive?' + query;
      console.log('🔍 [API查詢] 完整URL:', fullUrl);
      console.log('🔍 [API查詢] 參數解析:', { 
        semester: semester || '114-1', 
        courseName, 
        course,
        period,
        coursePeriod,
        date 
      });
      
      const resp = await fetch(fullUrl);
      console.log('🔍 [API回應] HTTP狀態:', resp.status, resp.statusText);
      
      const result = await handleResponse(resp);
      console.log('🔍 [API回應] handleResponse後的結果:', {
        'result存在': !!result,
        'result類型': typeof result,
        '所有keys': result ? Object.keys(result) : [],
        'result.records存在': !!(result && result.records),
        'result.success': result ? result.success : undefined
      });
      
      // 🔍 調試：輸出原始 API 返回資料
      console.log('🔍 [API原始資料] 後端返回:', {
        'result存在': !!result,
        'result.records存在': !!(result && result.records),
        'records數量': result && result.records ? result.records.length : 0,
        'records類型': result && result.records ? (Array.isArray(result.records) ? 'array' : typeof result.records) : 'N/A',
        '所有records詳情': result && result.records ? result.records.map((r, idx) => ({
          index: idx,
          studentName: r.studentName,
          name: r.name,
          isOverview: r.isOverview,
          recordPath: r.recordPath,
          relativePath: r.relativePath,
          photos數量: Array.isArray(r.photos) ? r.photos.length : (typeof r.photos === 'number' ? r.photos : 'N/A'),
          videos數量: Array.isArray(r.videos) ? r.videos.length : (typeof r.videos === 'number' ? r.videos : 'N/A'),
          'photos前3個': Array.isArray(r.photos) ? r.photos.slice(0, 3).map(p => typeof p === 'object' ? p.name : p) : [],
          'videos前3個': Array.isArray(r.videos) ? r.videos.slice(0, 3).map(v => typeof v === 'object' ? v.name : v) : [],
          '所有keys': Object.keys(r || {})
        })) : []
      });
      
      // 🔄 轉換為舊格式以保持兼容性
      if (result && result.records) {
        // 🔍 調試：輸出每個記錄的分類判斷過程
        console.log('🔍 [API轉換前] 分類判斷過程:', {
          'records數量': result.records.length,
          '每個記錄的分類判斷': result.records.map((r, idx) => ({
            index: idx,
            'r.studentName': r.studentName,
            'r.name': r.name,
            'r.isOverview': r.isOverview,
            'r.recordPath': r.recordPath,
            '判斷isOverview': r.isOverview === true,
            '判斷studentName===課程總覽': r.studentName === '課程總覽',
            '是否為overview': r.isOverview || r.studentName === '課程總覽',
            '是否為student': !r.isOverview && r.studentName !== '課程總覽'
          }))
        });
        
        // 區分課程總覽和學生記錄
        const overviewCandidates = (result.records || []).filter(r => r && (r.isOverview || r.studentName === '課程總覽'));
        // 避免選到「時間段」當主題（如 三1830-2030、18:30-20:30 等）
        function pickBestOverview(candidates){
          if (!Array.isArray(candidates) || candidates.length === 0) return null;
          const timeLike = /^([日一二三四五六])?\s*\d{1,2}[:\-–—]?\d{2}(?:[-~–—]\d{1,2}[:\-–—]?\d{2})?$/;
          const good = candidates.filter(r => {
            const p = String(r.recordPath || r.relativePath || '');
            const m = p.match(/\/(\d{4}-\d{2}-\d{2})\s+([^/]+)\//);
            const topic = m ? (m[2] || '').trim() : '';
            return topic && !timeLike.test(topic);
          });
          // 有明確主題者優先，否則退回第一個候選（至少仍含日期資料夾）
          return good[0] || candidates[0] || null;
        }
        const overview = pickBestOverview(overviewCandidates);
        const students = result.records.filter(r => !r.isOverview && r.studentName !== '課程總覽');
        
        console.log('🔍 [API轉換前] 分類結果:', {
          'overview存在': !!overview,
          'overview.studentName': overview ? overview.studentName : null,
          'overview.isOverview': overview ? overview.isOverview : null,
          'students數量': students.length,
          'students名稱列表': students.map(s => s.studentName || s.name || '無名稱')
        });
        
        // 🔥 重要：轉換 photos/videos 數據結構
        // 後端返回：photos: [{name, path, size, url}], videos: [{name, path, size, url}]
        // 前端期望：newMediaPhotos/newMediaVideos 用於渲染縮圖
        if (overview) {
          const photoObjs = Array.isArray(overview.photos) ? overview.photos : [];
          const videoObjs = Array.isArray(overview.videos) ? overview.videos : [];
          
          // 🎯 [修復 2025-11-19] 設置新媒體系統格式，讓渲染邏輯可以正確顯示照片
          // 將後端的 {name, path, url} 轉換為前端期待的 {filename, name, url, proxyUrl} 格式
          overview.newMediaPhotos = photoObjs.map(p => ({
            id: p.id || `photo-${p.name}`,
            filename: p.name,
            name: p.name,
            originalName: p.name,
            url: p.url,
            proxyUrl: p.proxyUrl || p.url,
            drivePath: p.path || p.drivePath,
            size: p.size || 0
          }));
          
          overview.newMediaVideos = videoObjs.map(v => ({
            id: v.id || `video-${v.name}`,
            filename: v.name,
            name: v.name,
            originalName: v.name,
            url: v.url,
            proxyUrl: v.proxyUrl || v.url,
            drivePath: v.path || v.drivePath,
            thumbnailFilename: v.thumbnailFilename || null,
            thumbnailProxyUrl: v.thumbnailProxyUrl || null,
            size: v.size || 0
          }));
          
          // 更新數量（前端需要數字）
          overview.photos = photoObjs.length;
          overview.videos = videoObjs.length;
          
          // 向後相容：保留 photoEntries/videoEntries
          overview.photoEntries = photoObjs;
          overview.videoEntries = videoObjs;
          
          // 向後相容：files 陣列（僅檔名）
          overview.files = [];
          if (photoObjs.length > 0) {
            overview.files.push(...photoObjs.map(p => p.name));
          }
          if (videoObjs.length > 0) {
            overview.files.push(...videoObjs.map(v => v.name));
          }
          
          // 🔥 前端需要 relativePath 來構建 Drive URL
          overview.relativePath = overview.recordPath || '';
          overview.courseName = overview.courseName || course;
          overview.coursePeriod = overview.coursePeriod || coursePeriod;
          overview.date = overview.date || date;
          
          console.log('🔄 [API轉換] overview數據:', {
            photos: overview.photos,
            videos: overview.videos,
            newMediaPhotos: overview.newMediaPhotos.length,
            newMediaVideos: overview.newMediaVideos.length,
            files: overview.files.length,
            relativePath: overview.relativePath
          });
        }
        
        // 轉換學生記錄格式
        students.forEach(student => {
          // 🔥 後端返回的格式：photos/videos 是物件陣列 [{name, path, size, url}]
          // 🔥 前端期望的格式：newMediaPhotos/newMediaVideos 用於渲染，files 用於向後相容
          const photoObjs = Array.isArray(student.photos) ? student.photos : [];
          const videoObjs = Array.isArray(student.videos) ? student.videos : [];
          
          // 🎯 [修復 2025-11-19] 同步設置新媒體系統格式（與課程總覽一致）
          student.newMediaPhotos = photoObjs.map(p => ({
            id: p.id || `photo-${p.name}`,
            filename: p.name,
            name: p.name,
            originalName: p.name,
            url: p.url,
            proxyUrl: p.proxyUrl || p.url,
            drivePath: p.path || p.drivePath,
            size: p.size || 0
          }));
          
          student.newMediaVideos = videoObjs.map(v => ({
            id: v.id || `video-${v.name}`,
            filename: v.name,
            name: v.name,
            originalName: v.name,
            url: v.url,
            proxyUrl: v.proxyUrl || v.url,
            drivePath: v.path || v.drivePath,
            thumbnailFilename: v.thumbnailFilename || null,
            thumbnailProxyUrl: v.thumbnailProxyUrl || null,
            size: v.size || 0
          }));
          
          // 向後相容：構建 files 物件（檔名字串陣列）
          student.files = {
            photos: photoObjs.map(p => {
              return typeof p === 'string' ? p : (p.name || p.filename || '');
            }).filter(Boolean),
            videos: videoObjs.map(v => {
              return typeof v === 'string' ? v : (v.name || v.filename || '');
            }).filter(Boolean)
          };
          
          // 更新數量統計（數字）
          student.photos = photoObjs.length;
          student.videos = videoObjs.length;
          
          // 🔥 前端需要 relativePath 來構建 Drive URL（與課程總覽一致）
          student.relativePath = student.recordPath || '';
          
          // 🔥 確保 studentName 欄位存在（用於匹配）
          if (!student.studentName) {
            student.studentName = student.name || '';
          }
          
          console.log('🔄 [API轉換] 學生記錄:', {
            studentName: student.studentName,
            newMediaPhotos: student.newMediaPhotos.length,
            newMediaVideos: student.newMediaVideos.length,
            photos: student.photos,
            videos: student.videos,
            'files.photos數量': student.files.photos.length,
            'files.videos數量': student.files.videos.length,
            relativePath: student.relativePath
          });
        });
        
        return {
          success: true,
          overview: overview || null,
          students: students || [],
          path: result.searchParams
        };
      }
      
      return { success: true, overview: null, students: [] };
    },

    async deleteRecord(params) {
      // 🔥 2025-11-08: 改用 Drive 刪除 API
      // 支援兩種參數格式：
      // 1. { recordPath: '/Fun Learn Bar/...' }
      // 2. { relativePath: '/Fun Learn Bar/...', filename: 'photo.jpg' } (刪除單個文件)
      // 3. { semester, courseName, date, studentName } (刪除整個記錄)
      
      let recordPath = params.recordPath;
      let fileName = params.filename || params.fileName;
      
      // 如果沒有 recordPath，嘗試使用 relativePath
      if (!recordPath && params.relativePath) {
        recordPath = params.relativePath;
      }
      
      // 如果還是沒有，嘗試從 semester/courseName/date 構建
      if (!recordPath && params.semester && params.courseName && params.date) {
        const semester = params.semester;
        const courseName = params.courseName;
        const date = params.date;
        const studentName = params.studentName || '課程總覽';
        
        recordPath = `/Fun Learn Bar/FLB-Learning-Portfolio/${semester}/${courseName}/${date}/${studentName}`;
      }
      
      if (!recordPath) {
        console.error('❌ [deleteRecord] 缺少必要參數:', params);
        throw new Error('缺少 recordPath 參數');
      }
      
      recordPath = normalizeDrivePath(recordPath);
      const encodedRecordPath = encodeURI(recordPath);
      
      // 🔥 構建 URL，如果有 fileName 就添加為查詢參數
      let url = `/api/learning-records/drive${encodedRecordPath}`;
      if (fileName) {
        url += `?fileName=${encodeURIComponent(fileName)}`;
        console.log('📄 [deleteRecord] 刪除單個文件:', { recordPath, fileName });
      } else {
        console.log('🗂️  [deleteRecord] 刪除整個記錄目錄:', recordPath);
      }
      
      const resp = await fetch(url, { method: 'DELETE' });
      return handleResponse(resp);
    },

    // ==================== 🆕 新架構上傳 (推薦使用) ====================

    /**
     * 上傳學習記錄 (新架構：媒體分離)
     * @param {FormData|object} data - 可以是 FormData 或普通對象
     * @param {function} onProgress - 進度回調
     * @returns {Promise<object>} 上傳結果
     */
    async uploadRecordV2(data, onProgress) {
      // 從 FormData 或對象中提取數據
      const isFormData = data instanceof FormData;
      const course = isFormData ? data.get('course') : data.course;
      const period = isFormData ? data.get('period') : data.period;
      const date = isFormData ? data.get('date') : data.date;
      const studentName = isFormData ? (data.get('studentName') || '') : (data.studentName || '');
      const comment = isFormData ? data.get('comment') : data.comment;
      const coursePeriod = isFormData ? (data.get('coursePeriod') || '') : (data.coursePeriod || '');
      const relativePath = isFormData ? (data.get('relativePath') || '') : (data.relativePath || '');
      const relativePathUnified = isFormData ? (data.get('relativePathUnified') || '') : (data.relativePathUnified || '');
      const isOverview = isFormData ? (String(data.get('isOverview')) === 'true') : !!data.isOverview;
      const instructorName = isFormData ? (data.get('instructorName') || '') : (data.instructorName || '');
      const overviewSummary = isFormData ? data.get('overviewSummary') : data.overviewSummary;
      const semester = isFormData ? (data.get('semester') || '') : (data.semester || '');
      const topic = isFormData ? (data.get('topic') || '') : (data.topic || '');
      
      // 提取文件
      const photos = isFormData ? data.getAll('photos') : (data.photos || []);
      const videos = isFormData ? data.getAll('videos') : (data.videos || []);
      
      // 步驟 1: 上傳媒體 (如果有)
      const mediaIds = [];
      const totalFiles = photos.length + videos.length;
      let currentFile = 0;
      
      const updateProgress = () => {
        if (onProgress) {
          const percent = totalFiles > 0 ? Math.round((currentFile / totalFiles) * 90) : 90;
          onProgress(percent);
        }
      };
      
      // 準備共用元數據（提供後端生成「日期＋主題」的必要資訊）
      const buildCommonMeta = (mode) => {
        // 🔄 使用 MetadataTransformer 統一格式
        const rawMeta = {
          studentName: studentName || (isOverview ? '課程總覽' : ''),
          dateKey: date,
          courseName: course,
          period,
          mode: mode || (isOverview ? 'overview' : 'student'),
          semester,
          topic,
          coursePeriod,
          relativePathUnified: relativePathUnified || relativePath
        };
        
        // 如果有 MetadataTransformer 可用，使用統一格式
        if (window.metadataTransformer && window.metadataTransformer.toFrontendFormat) {
          const normalized = window.metadataTransformer.normalize(rawMeta);
          return window.metadataTransformer.toFrontendFormat(normalized);
        }
        
        // 備用：移除空值
        Object.keys(rawMeta).forEach((k) => { 
          if (rawMeta[k] === undefined || rawMeta[k] === null || String(rawMeta[k]).length === 0) {
            delete rawMeta[k];
          }
        });
        return rawMeta;
      };

      // 上傳照片
      const uploadedPhotoRecords = [];
      if (photos.length > 0) {
        const photoMetadata = buildCommonMeta('photo');
        
        for (const photo of photos) {
          const mediaRecord = await uploadMediaFile(photo, photoMetadata, () => {
            updateProgress();
          });
          mediaIds.push(mediaRecord.id);
          currentFile++;
          uploadedPhotoRecords.push(mediaRecord);
        }
      }
      
      // 上傳影片
      const uploadedVideoRecords = [];
      if (videos.length > 0) {
        const videoMetadata = buildCommonMeta('video');
        
        for (const video of videos) {
          const mediaRecord = await uploadMediaFile(video, videoMetadata, () => {
            updateProgress();
          });
          mediaIds.push(mediaRecord.id);
          currentFile++;
          uploadedVideoRecords.push(mediaRecord);
        }
      }
      
      // 步驟 2: 保存文字記錄
      if (onProgress) onProgress(95);
      
      const recordData = {
        course,
        period,
        date,
        studentName: studentName || (isOverview ? '課程總覽' : ''),
        comment,
        mediaIds,
        isOverview,
        overviewSummary,
        coursePeriod,
        relativePath,
        semester,
        topic,
        relativePathUnified
      };
      
      // 附加講師名稱（若有）
      if (instructorName) {
        recordData.instructorName = instructorName;
      }
      const result = await this.saveRecordMetadata(recordData);
      if (onProgress) onProgress(100);
      
      // 附帶本次上傳的媒體檔名與路徑，方便前端立即綁定刪除
      return Object.assign({}, result, {
        uploadedMediaRecords: {
          photos: uploadedPhotoRecords,
          videos: uploadedVideoRecords
        }
      });
    },

    async uploadMediaStandalone(file, metadata, onProgress) {
      return uploadMediaFile(file, metadata, onProgress);
    },

    async saveRecordMetadata(recordData) {
      const resp = await fetch('/api/learning-records/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData)
      });
      return handleResponse(resp);
    },

    /**
     * 更新學習記錄 (新架構：媒體分離)
     * @param {object} data - 更新數據
     * @param {function} onProgress - 進度回調
     * @returns {Promise<object>} 更新結果
     */
    async updateRecordV2(data, onProgress) {
      // 使用相同的邏輯，因為新 API 是冪等的
      return this.uploadRecordV2(data, onProgress);
    },

    // ==================== 🔄 向後相容 (使用舊 API，逐步廢棄) ====================

    /**
     * 上傳學習記錄 (舊 API，向後相容)
     * ⚠️ 建議使用 uploadRecordV2
     */
    async uploadRecord(formData) {
      console.warn('⚠️ [API] uploadRecord 使用舊 API，建議改用 uploadRecordV2');
      const resp = await fetch('/api/learning-records/upload', {
        method: 'POST',
        body: formData
      });
      const data = await handleResponse(resp);
      if (!data || data.success === false) {
        throw new Error((data && data.message) || '上傳失敗');
      }
      return data;
    },

    /**
     * 上傳學習記錄 (帶進度，舊 API)
     * ⚠️ 建議使用 uploadRecordV2
     */
    uploadRecordWithProgress(formData, onProgress) {
      console.warn('⚠️ [API] uploadRecordWithProgress 使用舊 API，建議改用 uploadRecordV2');
      
      // 🔍 除錯：記錄 FormData 內容
      if (formData instanceof FormData) {
        console.log('📤 [API] FormData 內容:');
        for (const [key, value] of formData.entries()) {
          if (value instanceof File) {
            console.log(`  ${key}: [File] ${value.name} (${(value.size / 1024).toFixed(2)} KB, ${value.type})`);
          } else {
            console.log(`  ${key}:`, value);
          }
        }
      }
      
      const xhr = new XMLHttpRequest();
      const promise = new Promise(function (resolve, reject) {
        try {
          xhr.open('POST', '/api/learning-records/upload');
          
          // 🔍 除錯：記錄請求開始
          console.log('📡 [API] 發送 POST 請求到 /api/learning-records/upload');
          
          xhr.upload.onprogress = function (evt) {
            if (!evt.lengthComputable) return;
            const percent = Math.round((evt.loaded / evt.total) * 100);
            if (typeof onProgress === 'function') onProgress(percent, evt);
          };
          
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            
            // 🔍 除錯：記錄完整的回應
            console.log('📥 [API] 收到回應:', {
              status: xhr.status,
              statusText: xhr.statusText,
              responseText: xhr.responseText ? xhr.responseText.substring(0, 500) : '(empty)',
              responseTextLength: xhr.responseText ? xhr.responseText.length : 0
            });
            
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText || '{}');
                console.log('✅ [API] 解析成功:', data);
                if (data && data.success !== false) return resolve(data);
                console.error('❌ [API] API 回傳 success: false', data);
                reject(new Error((data && data.message) || '上傳失敗'));
              } catch (e) {
                console.error('❌ [API] JSON 解析失敗:', e, 'responseText:', xhr.responseText);
                reject(new Error('上傳回應解析失敗: ' + e.message));
              }
            } else {
              try {
                let msg = '';
                try {
                  const data = JSON.parse(xhr.responseText || '{}');
                  msg = (data && data.message) || '';
                  console.error('❌ [API] HTTP 錯誤，伺服器回應:', data);
                } catch (_) {
                  msg = (xhr.responseText || '').slice(0, 200);
                  console.error('❌ [API] HTTP 錯誤，無法解析回應:', xhr.responseText);
                }
                const errorMsg = 'HTTP ' + xhr.status + (xhr.statusText ? (': ' + xhr.statusText) : '') + (msg ? (' - ' + msg) : '');
                console.error('❌ [API] 拒絕 Promise:', errorMsg);
                reject(new Error(errorMsg));
              } catch (e) {
                const errorMsg = 'HTTP ' + xhr.status + (xhr.statusText ? (': ' + xhr.statusText) : '');
                console.error('❌ [API] 錯誤處理失敗:', e, errorMsg);
                reject(new Error(errorMsg));
              }
            }
          };
          
          xhr.onerror = function () {
            console.error('❌ [API] XHR onerror 事件觸發', {
              status: xhr.status,
              statusText: xhr.statusText,
              readyState: xhr.readyState,
              responseText: xhr.responseText
            });
            reject(new Error('網路錯誤，請重試'));
          };
          
          xhr.ontimeout = function () {
            console.error('❌ [API] XHR ontimeout 事件觸發');
            reject(new Error('請求超時，請重試'));
          };
          
          xhr.send(formData);
        } catch (e) {
          console.error('❌ [API] uploadRecordWithProgress 異常:', e);
          reject(e);
        }
      });
      return { promise, abort: function () { try { xhr.abort(); } catch (e) {} } };
    },

    /**
     * 更新學習記錄 (帶進度，舊 API)
     * ⚠️ 建議使用 updateRecordV2
     */
    updateRecordWithProgress(formData, onProgress) {
      console.warn('⚠️ [API] updateRecordWithProgress 使用舊 API，建議改用 updateRecordV2');
      const xhr = new XMLHttpRequest();
      const promise = new Promise(function (resolve, reject) {
        try {
          xhr.open('PUT', '/api/learning-records/0');
          xhr.upload.onprogress = function (evt) {
            if (!evt.lengthComputable) return;
            const percent = Math.round((evt.loaded / evt.total) * 100);
            if (typeof onProgress === 'function') onProgress(percent, evt);
          };
          xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText || '{}');
                if (data && data.success !== false) return resolve(data);
                reject(new Error((data && data.message) || '更新失敗'));
              } catch (e) { reject(new Error('更新回應解析失敗')); }
            } else {
              try {
                let msg = '';
                try { const data = JSON.parse(xhr.responseText || '{}'); msg = (data && data.message) || ''; }
                catch (_) { msg = (xhr.responseText || '').slice(0, 200); }
                reject(new Error('HTTP ' + xhr.status + (xhr.statusText ? (': ' + xhr.statusText) : '') + (msg ? (' - ' + msg) : '')));
              } catch (e) {
                reject(new Error('HTTP ' + xhr.status + (xhr.statusText ? (': ' + xhr.statusText) : '')));
              }
            }
          };
          xhr.onerror = function () { reject(new Error('網路錯誤，請重試')); };
          xhr.send(formData);
        } catch (e) { reject(e); }
      });
      return { promise, abort: function () { try { xhr.abort(); } catch (e) {} } };
    },

    /**
     * 更新學習記錄 (舊 API)
     * ⚠️ 建議使用 updateRecordV2
     */
    async updateRecord({ course, period, date, studentName, comment, photos, videos, coursePeriod, relativePath }) {
      console.warn('⚠️ [API] updateRecord 使用舊 API，建議改用 updateRecordV2');
      const form = new FormData();
      form.append('course', course);
      form.append('period', period);
      form.append('date', date);
      form.append('studentName', studentName);
      if (coursePeriod) form.append('coursePeriod', coursePeriod);
      if (relativePath) form.append('relativePath', relativePath);
      if (comment != null) form.append('comment', comment);
      (photos || []).forEach(f => {
        try { form.append('photos', f, (f && f.name) ? f.name : 'photo.jpg'); }
        catch(e) { form.append('photos', f); }
      });
      (videos || []).forEach(f => {
        try { form.append('videos', f, (f && f.name) ? f.name : 'video.mp4'); }
        catch(e) { form.append('videos', f); }
      });
      const resp = await fetch('/api/learning-records/0', { method: 'PUT', body: form });
      return handleResponse(resp);
    }
  };

  global.FLB = global.FLB || {};
  global.FLB.Api = Api;
})(window);
