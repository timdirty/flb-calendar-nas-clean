const WEEK_PATTERNS = [
  /\s+第\d+週/gi,
  /\s+第.{1,3}週/gi,
  /\s+week\s*\d+/gi,
  /\s+w\d+/gi,
  /\s+週\d+/gi,
  /\s*[-_]\s*第\d+週/gi,
  /\s*[-_]\s*week\s*\d+/gi,
];

/**
 * 移除課程名稱中的週次與多餘符號，保留時間與地點。
 * 🔥 [新增 2025-11-27] 同時移除開頭的中括號標記（特殊事件）
 */
export function normalizeCourseName(courseName: string): string {
  if (!courseName) return '';
  let cleaned = String(courseName).trim();
  
  // 🔥 [新增 2025-11-27] 移除開頭的中括號標記（特殊事件）+ 後面的空白
  // 例如：[代課] SPM 三1630-1730 到府 -> SPM 三1630-1730 到府
  cleaned = cleaned.replace(/^\s*\[[^\]]*\]\s*/, '');
  
  // 移除週次標記
  WEEK_PATTERNS.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, '');
  });
  
  cleaned = cleaned.replace(/\s+/g, ' ').replace(/[-_,，、]\s*$/, '').trim();
  return cleaned;
}
