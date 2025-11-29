// 學期計算工具（前端版）
// 與後端 utils/semester-helper.js 保持一致，回傳格式如：114-1、114-2、夏令營-2025、冬令營-2025

export function getCurrentSemesterFromDate(dateInput?: string | Date): string {
  try {
    const d = dateInput ? new Date(dateInput) : new Date();
    if (isNaN(d.getTime())) {
      return getCurrentSemesterFromDate(new Date());
    }

    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    const taiwanYear = year - 1911;

    if (month >= 3 && month <= 6) return `${taiwanYear}-2`;      // 下學期（3-6月）
    if (month >= 7 && month <= 8) return `夏令營-${year}`;       // 暑假（7-8月）
    if (month >= 9 && month <= 12) return `${taiwanYear}-1`;    // 上學期（9-12月）
    return `冬令營-${year}`;                                    // 寒假（1-2月）
  } catch {
    const fallbackYear = new Date().getFullYear() - 1911;
    return `${fallbackYear}-1`;
  }
}
