import type { Course } from '../types';

const SPECIAL_MARKERS = ['[停課]', '[體驗]', '[改時間]', '[代課]', '停課', '體驗', '改時間', '代課'];
const TOPIC_HINT_PATTERNS = [
  /課程主題\s*[：:\-]\s*([^\n\r]+)/i,
  /主題\s*[：:\-]\s*([^\n\r]+)/i,
  /教學主題\s*[：:\-]\s*([^\n\r]+)/i,
  /教案主題\s*[：:\-]\s*([^\n\r]+)/i,
  /教案名稱\s*[：:\-]\s*([^\n\r]+)/i,
  /教案\s*[：:\-]\s*([^\n\r]+)/i,
];

function sanitizeTopic(candidate: string): string {
  if (!candidate) return '';
  return candidate
    .replace(/[（(][^）)]*(https?:?\/?\/?|https|http|www\.)[^）)]*[）)]/gi, '')
    .replace(/https?:?\/?\/?\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/[()（）]/g, '')
    .replace(/\s+/g, '')
    .replace(/[<>:"\/\\|?*\x00-\x1F]/g, '')
    .substring(0, 50)
    .trim();
}

function extractFromDescription(description?: string): string {
  if (!description) return '';
  for (const pattern of TOPIC_HINT_PATTERNS) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const sanitized = sanitizeTopic(match[1]);
      if (sanitized) {
        return sanitized;
      }
    }
  }
  return '';
}

function stripSpecialMarkers(title: string): string {
  let output = title;
  
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

/**
 * 擷取供 Synology Drive 路徑使用的課程主題，優先順序：
 * 1. metadata.lessonInfo.name
 * 2. course.topic
 * 3. metadata.description 系列關鍵字
 * 4. 課程標題推導
 * 5. 課程 ID 片段
 */
export function extractCourseTopicForPath(course?: Course): string {
  if (!course) {
    return '課程';
  }

  const lessonInfoName = (course as any)?.metadata?.lessonInfo?.name;
  if (lessonInfoName) {
    const sanitized = sanitizeTopic(lessonInfoName);
    if (sanitized) {
      return sanitized;
    }
  }

  if (course.topic) {
    const sanitized = sanitizeTopic(course.topic);
    if (sanitized) {
      return sanitized;
    }
  }

  const description = (course as any)?.metadata?.originalEvent?.description || (course as any)?.metadata?.description;
  const descriptionTopic = extractFromDescription(description);
  if (descriptionTopic) {
    return descriptionTopic;
  }

  const rawTitle = stripSpecialMarkers(course.name || '');
  let cleaned = rawTitle
    .replace(/^(SPIKE|SPM|ESM|BOOST|EV3|MINECRAFT|SCRATCH|PYTHON)\s+/i, '')
    .replace(/[日一二三四五六]\s*\d{1,2}\s*:?(?:\d{2})?\s*[-~–—]\s*\d{1,2}\s*:?(?:\d{2})?/g, '')
    .replace(/第\d+週/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const sanitized = sanitizeTopic(cleaned);
  if (sanitized) {
    return sanitized;
  }

  if (course.id) {
    const idPart = course.id.split('-')[0];
    const fallbackFromId = sanitizeTopic(idPart);
    if (fallbackFromId) {
      return fallbackFromId;
    }
  }

  return '課程';
}
