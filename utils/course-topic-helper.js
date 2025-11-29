/**
 * 共用課程主題推導工具（前後端一致）
 * - 提供 extractCourseTopicForPath 供完整課程物件使用
 * - 提供 deriveTopicFromCourseName 供僅有標題時的備援推導
 */

const SPECIAL_MARKERS = ['[停課]', '[體驗]', '[改時間]', '[代課]', '停課', '體驗', '改時間', '代課'];
const COURSE_PREFIXES = ['SPIKE', 'SPM', 'ESM', 'BOOST', 'EV3', 'MINECRAFT', 'SCRATCH', 'PYTHON'];
const TOPIC_HINT_PATTERNS = [
  /課程主題\s*[：:\-]\s*([^\n\r]+)/i,
  /主題\s*[：:\-]\s*([^\n\r]+)/i,
  /教學主題\s*[：:\-]\s*([^\n\r]+)/i,
  /教案主題\s*[：:\-]\s*([^\n\r]+)/i,
  /教案名稱\s*[：:\-]\s*([^\n\r]+)/i,
  /教案\s*[：:\-]\s*([^\n\r]+)/i
];

function sanitizeTopicForPath(candidate) {
  if (!candidate) return '';
  let normalized = String(candidate)
    // 移除括號中的 URL 或疑似網址片段
    .replace(/[（(][^）)]*(https?:?\/?\/?|https|http|www\.)[^）)]*[）)]/gi, '')
    // 移除裸露的網址片段
    .replace(/https?:?\/?\/?\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    // 最後移除殘餘括號字元
    .replace(/[()（）]/g, '');

  return normalized
    .replace(/\s+/g, '')
    .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '')
    .substring(0, 50)
    .trim();
}

function extractFromDescription(description) {
  if (!description) return '';
  for (const pattern of TOPIC_HINT_PATTERNS) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const sanitized = sanitizeTopicForPath(match[1]);
      if (sanitized) {
        return sanitized;
      }
    }
  }
  return '';
}

function stripSpecialMarkers(title) {
  if (!title) return '';
  let output = String(title);
  
  // 🔥 [修復 2025-11-27] 移除所有開頭的中括號標記（包括連續多個）
  // 例如：[代課] [改時間] MINECRAFT → MINECRAFT
  // 使用 while 循環確保移除所有連續的中括號
  while (/^\s*\[[^\]]*\]\s*/.test(output)) {
    output = output.replace(/^\s*\[[^\]]*\]\s*/, '');
  }
  
  // 移除特定的停課/體驗等標記詞（備援，處理沒有中括號的情況）
  SPECIAL_MARKERS.forEach((marker) => {
    output = output.replace(new RegExp(marker, 'gi'), '');
  });
  
  // ⚠️ 講師名移除需要精確匹配，避免誤傷時間範圍
  // 只移除結尾的 "- XXX" 格式，且確保 XXX 不包含數字（避免誤傷時間）
  output = output.replace(/\s*[-－]\s*([^\d-－]+)$/, '');
  
  return output.trim();
}

function removeCoursePrefixes(title) {
  if (!title) return '';
  const prefixRegex = new RegExp(`^(${COURSE_PREFIXES.join('|')})\s+`, 'i');
  return title.replace(prefixRegex, '');
}

function removeTimeAndWeekSegments(title) {
  if (!title) return '';
  return title
    // 三 18:30-20:30、三 1830-2030
    .replace(/[日一二三四五六]\s*\d{1,2}\s*:?:?\d{2}\s*[-~–—]\s*\d{1,2}\s*:?:?\d{2}/g, '')
    // 單獨時間段 18:30-20:30
    .replace(/\b\d{1,2}\s*:?:?\d{2}\s*[-~–—]\s*\d{1,2}\s*:?:?\d{2}\b/g, '')
    // 單獨星期字
    .replace(/[日一二三四五六](?=\s|$)/g, '')
    // 第N週 / 週N / Week N
    .replace(/第\d+週/gi, '')
    .replace(/第.{1,3}週/gi, '')
    .replace(/week\s*\d+/gi, '')
    .replace(/w\d+/gi, '')
    .replace(/週\d+/gi, '');
}

function deriveTopicFromCourseName(courseName) {
  if (!courseName) return '';
  let title = stripSpecialMarkers(courseName);
  title = removeCoursePrefixes(title);
  title = removeTimeAndWeekSegments(title);
  title = title.replace(/\s+/g, ' ').trim();
  const sanitized = sanitizeTopicForPath(title);
  if (sanitized && sanitized.length >= 2) {
    return sanitized;
  }
  return '';
}

function extractCourseTopicForPath(course = {}) {
  if (!course) {
    return '課程';
  }

  const lessonInfoName = course?.metadata?.lessonInfo?.name;
  if (lessonInfoName) {
    const sanitized = sanitizeTopicForPath(lessonInfoName);
    if (sanitized) {
      return sanitized;
    }
  }

  if (course.topic) {
    const sanitized = sanitizeTopicForPath(course.topic);
    if (sanitized) {
      return sanitized;
    }
  }

  const description = course?.metadata?.originalEvent?.description || course?.metadata?.description;
  const descriptionTopic = extractFromDescription(description);
  if (descriptionTopic) {
    return descriptionTopic;
  }

  const derivedFromName = deriveTopicFromCourseName(course.name || course.courseName);
  if (derivedFromName) {
    return derivedFromName;
  }

  if (course.id) {
    const idPart = String(course.id).split('-')[0];
    const fallback = sanitizeTopicForPath(idPart);
    if (fallback) {
      return fallback;
    }
  }

  return '課程';
}

module.exports = {
  extractCourseTopicForPath,
  deriveTopicFromCourseName,
  sanitizeTopicForPath,
};
