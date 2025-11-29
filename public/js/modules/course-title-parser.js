/**
 * Course Title Parser Module (UMD)
 * 共用於瀏覽器 (window) 與 Node.js (require)。
 */
(function (global, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory(global);
  } else {
    const parser = factory(global);
    global.CourseTitleParser = parser;
  }
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  const SPECIAL_KEYWORDS = ['改時間', '體驗', '代課', '停課', '請假'];
  const SPECIAL_MARKERS = Array.from(new Set(
    SPECIAL_KEYWORDS.concat(['體驗課', '體驗班', '補課', '取消', '休息'])
  ));

  function escapeRegex(word) {
    return word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function stripSpecialTokens(rawTitle) {
    if (!rawTitle || typeof rawTitle !== 'string') return '';
    let title = rawTitle;
    try {
      const markerPattern = SPECIAL_MARKERS.map(escapeRegex).join('|');
      if (markerPattern) {
        // 🔥 修復：正確轉義方括號，確保能匹配 [代課]、[停課]、[體驗]、[改時間] 等格式
        // 使用 \\[ 和 \\] 來匹配字面上的方括號 [ 和 ]
        const bracketed = new RegExp(`[\\[\\(（【]\\s*(?:${markerPattern})(?:課|班|日|活動|事件)?\\s*[\\]\\)）】]`, 'gi');
        const leading = new RegExp(`^(?:\\s*(?:${markerPattern})(?:課|班|日|活動|事件)?\\s*[-–—:]?\\s*)+`, 'gi');
        const trailing = new RegExp(`(?:\\s*[-–—:]?\\s*(?:${markerPattern})(?:課|班|日|活動|事件)?)+$`, 'gi');
        title = title.replace(bracketed, ' ')
          .replace(leading, '')
          .replace(trailing, '');
      }
      title = title.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    } catch (_) {
      title = String(rawTitle || '').trim();
    }
    return title || String(rawTitle || '').trim();
  }

  function insertSpacingBetweenSegments(rawTitle) {
    if (!rawTitle || typeof rawTitle !== 'string') return '';
    let title = rawTitle;
    try {
      // 課程名稱緊貼星期時，補上一個空白（例如 BOOST六1530）
      title = title.replace(/([^\s一二三四五六日])([一二三四五六日])/g, '$1 $2');
      // 星期緊貼時間（含 HH:MM 或 HHMM）時補空白
      title = title.replace(/([一二三四五六日])\s*(\d{1,2}:\d{2})/g, '$1 $2');
      title = title.replace(/([一二三四五六日])\s*(\d{3,4})(?=[^\d]|$)/g, '$1 $2');
      // 時間範圍後緊接地點時補空白，支援 HH:MM 與 HHMM
      title = title.replace(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})([^\s\d])/g, '$1-$2 $3');
      title = title.replace(/(\d{4})-(\d{4})([^\s\d])/g, '$1-$2 $3');
      // 移除多餘空白
      title = title.replace(/\s{2,}/g, ' ').trim();
    } catch (_) {
      title = String(rawTitle || '').trim();
    }
    return title;
  }

  const PATTERNS = [
    // 英文/數字課程名稱 + 星期 + HH:MM-HH:MM (+ 可選地點) (+ 週數)
    /^([A-Z0-9]+(?:\s+[A-Z0-9]+)*)\s+([一二三四五六日])\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})(?:\s+(.+?))?(?:\s+第\d+[週周].*)?$/,
    // 英文/數字課程名稱 + 星期 + HH:MM-HH:MM + 地點
    /^([A-Z0-9]+)\s+([一二三四五六日])\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s+(.+?)(?:\s+第\d+[週周].*)?$/,
    // 英文/數字課程名稱 + 星期 + HHMM-HHMM + 地點 (允許星期後無空格)
    /^([A-Z0-9]+)\s+([一二三四五六日])\s?(\d{4})-(\d{4})\s+(.+?)(?:\s+第\d+[週周].*)?$/,
    // 英文/數字課程名稱 + 星期 + HH:MM-HH:MM (無地點)
    /^([A-Z0-9]+)\s+([一二三四五六日])\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})(?:\s+(.+?))?(?:\s+第\d+[週周].*)?$/,
    // 英文/數字課程名稱 + 星期 + HHMM-HHMM (無地點)
    /^([A-Z0-9]+)\s+([一二三四五六日])\s+(\d{4})-(\d{4})(?:\s+(.+?))?(?:\s+第\d+[週周].*)?$/,
    // 英文/數字課程名稱 + 星期 + HHMM-HHMM + 地點 (重複定義以增加涵蓋率)
    /^([A-Z0-9]+)\s+([一二三四五六日])\s+(\d{4})-(\d{4})\s+(.+?)(?:\s+第\d+[週周].*)?$/,
    // 中文課程名稱 + 編號 + 星期 + HH:MM-HH:MM (+ 地點)
    /^([\u4e00-\u9fa5]+\d*)\s+([一二三四五六日])\s+(\d{1,2}:\d{2})-(\d{1,2}:\d{2})(?:\s+(.+?))?(?:\s+第\d+[週周].*)?$/,
    // 中文課程名稱 + 星期 + HHMM-HHMM (+ 地點)
    /^([\u4e00-\u9fa5]+\d*)\s+([一二三四五六日])\s?(\d{4})-(\d{4})(?:\s+(.+?))?(?:\s+第\d+[週周].*)?$/
  ];

  const DEFAULT_RESPONSE = Object.freeze({
    courseName: '',
    course: '',      // 🔥 新增：與學生資料欄位一致
    timeInfo: '',
    period: '',      // 🔥 新增：與學生資料欄位一致
    weekday: '',
    startTime: '',
    endTime: '',
    location: '',
    hasSpecialKeyword: false,
    originalTitle: ''
  });

  function toHHMM(timeStr) {
    if (!timeStr) return '';
    if (timeStr.length === 4 && !timeStr.includes(':')) {
      return timeStr;
    }
    if (timeStr.includes(':')) {
      const [hours, minutes] = timeStr.split(':');
      return `${hours.padStart(2, '0')}${minutes.padStart(2, '0')}`;
    }
    return timeStr;
  }

  function parse(title) {
    if (!title || typeof title !== 'string') {
      return DEFAULT_RESPONSE;
    }

    const hasSpecialKeyword = SPECIAL_KEYWORDS.some(keyword => title.includes(keyword));
    const sanitizedTitle = stripSpecialTokens(title);
    const normalizedTitle = insertSpacingBetweenSegments(sanitizedTitle);

    for (const pattern of PATTERNS) {
      const match = normalizedTitle.match(pattern);
      if (match) {
        let courseName = match[1] || '';
        const weekday = match[2] || '';
        const startRaw = match[3] || '';
        const endRaw = match[4] || '';
        let location = match[5] || '';

        // 🔥 移除課程名稱中的空格（只保留第一個詞）
        if (courseName.includes(' ')) {
          courseName = courseName.split(' ')[0];
        }

        // 🔥 從 location 中移除週數資訊（例如：第3週、第10週等）
        if (location) {
          location = location.replace(/第\d+[週周].*/gi, '').trim();
        }

        const startTime = toHHMM(startRaw);
        const endTime = toHHMM(endRaw);

        const timeInfoParts = [];
        if (weekday) timeInfoParts.push(weekday);
        if (startTime && endTime) {
          const displayStart = startRaw.includes(':') ? startRaw : `${startTime.slice(0, 2)}:${startTime.slice(2)}`;
          const displayEnd = endRaw.includes(':') ? endRaw : `${endTime.slice(0, 2)}:${endTime.slice(2)}`;
          timeInfoParts.push(`${displayStart}-${displayEnd}`);
        }
        if (location) timeInfoParts.push(location);

        const finalTimeInfo = timeInfoParts.join(' ').trim();
        
        return {
          courseName,
          course: courseName,      // 🔥 與學生資料欄位一致
          weekday,
          startTime,
          endTime,
          location,
          timeInfo: finalTimeInfo,
          period: finalTimeInfo,   // 🔥 與學生資料欄位一致
          hasSpecialKeyword,
          originalTitle: title
        };
      }
    }

    const fallbackSource = normalizedTitle || sanitizedTitle || title;
    const extractedCourseName = fallbackSource.split(' ')[0] || '';
    
    return {
      ...DEFAULT_RESPONSE,
      hasSpecialKeyword,
      originalTitle: title,
      courseName: extractedCourseName,
      course: extractedCourseName  // 🔥 與學生資料欄位一致
    };
  }

  const parser = { parse, DEFAULT_RESPONSE };

  if (root && typeof root === 'object') {
    root.FLB = root.FLB || {};
    root.FLB.CourseTitleParser = parser;
  }

  return parser;
});
