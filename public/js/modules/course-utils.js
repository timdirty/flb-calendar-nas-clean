(function (global) {
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  const Course = {
    // 🔥 解析課程標題，提取課程名稱和時段資訊
    parseTitle(title) {
      if (!title || typeof title !== 'string') {
        return { courseName: '', period: '', instructor: '' };
      }
      
      // 🎯 處理包含 "—" 分隔符的格式（如：課程名稱 — 講師 — 時段）
      if (title.includes('—')) {
        const parts = title.split('—').map(s => s.trim());
        return {
          courseName: parts[0] || '',
          instructor: parts[1] || '',
          period: parts[2] || ''
        };
      }
      
      // 🎯 處理空白分隔的格式（如：課程名稱 講師 時段）
      const parts = title.split(/\s+/).filter(Boolean);
      
      if (parts.length === 0) {
        return { courseName: '', period: '', instructor: '' };
      }
      
      // 🎯 第一個部分通常是課程名稱
      let courseName = parts[0] || '';
      
      // 🎯 智能判斷是否移除尾部數字（教室編號等）
      if (/[\u4e00-\u9fa5]/.test(courseName)) {
        // 包含中文，移除尾部數字（如 資訊課401 → 資訊課）
        courseName = courseName.replace(/\d+$/, '');
      }
      
      // 🎯 提取講師名稱（通常在第二個位置或包含中文的部分）
      let instructor = '';
      let period = '';
      
      if (parts.length > 1) {
        // 假設講師名稱在第二個位置
        instructor = parts[1] || '';
        
        // 時段資訊可能在後面的部分
        if (parts.length > 2) {
          period = parts.slice(2).join(' ');
        }
      }
      
      return {
        courseName: courseName.trim(),
        instructor: instructor.trim(),
        period: period.trim()
      };
    },
    
    determineStatus(start, end, refDate) {
      if (!start || !end) return 'unknown';
      const ref = new Date(refDate || new Date());
      const s = new Date(start);
      const e = new Date(end);
      if (e <= ref) return 'completed';
      if (s > ref) return 'upcoming';
      return 'ongoing';
    },
    formatDate(dateValue) {
      if (!dateValue) return '-';
      const parsed = new Date(dateValue);
      if (Number.isNaN(parsed.getTime())) return escapeHtml(dateValue);
      return new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
      }).format(parsed);
    },
    formatTimeRange(courseLike) {
      if (courseLike && courseLike.timeRange) return escapeHtml(courseLike.timeRange);
      if (!courseLike || !courseLike.start || !courseLike.end) return '-';
      const start = new Date(courseLike.start);
      const end = new Date(courseLike.end);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '-';
      const fmt = new Intl.DateTimeFormat('zh-TW', { timeZone: 'Asia/Taipei', hour: '2-digit', minute: '2-digit', hour12: false });
      return fmt.format(start) + ' - ' + fmt.format(end);
    },
    escapeHtml
  };

  global.FLB = global.FLB || {};
  global.FLB.Course = Course;
})(window);


