/**
 * 🗂️ Drive 路徑處理統一工具
 * 用於處理所有 Synology Drive 路徑相關操作
 */

// 引入依賴（Node.js 環境）
let _publicDrivePathSemesterHelper, _publicDrivePathDateFormatter, _publicDrivePathCourseNameCleaner;
if (typeof require !== 'undefined') {
    _publicDrivePathSemesterHelper = require('./semester-helper');
    _publicDrivePathDateFormatter = require('./date-formatter');
    _publicDrivePathCourseNameCleaner = require('./course-name-cleaner');
}

/**
 * Drive 路徑處理類別
 */
class DrivePathHelper {
    /**
     * 建構函數
     * @param {string} driveRoot - Drive 根路徑
     */
    constructor(driveRoot = '/Fun Learn Bar/FLB-Learning-Portfolio') {
        this.driveRoot = driveRoot;
        this.semesterHelper = _publicDrivePathSemesterHelper || (typeof window !== 'undefined' ? window.SemesterHelper : null);
        this.dateFormatter = _publicDrivePathDateFormatter || (typeof window !== 'undefined' ? window.DateFormatter : null);
        this.courseNameCleaner = _publicDrivePathCourseNameCleaner || (typeof window !== 'undefined' ? window.CourseNameCleaner : null);
    }

    /**
     * 移除 Drive 根路徑前綴
     * @param {string} path - 原始路徑
     * @returns {string} 清理後的路徑
     */
    stripRootPrefix(path) {
        if (!path) return '';
        
        // 正規化路徑分隔符號
        let normalized = String(path).replace(/\\/g, '/').trim();
        
        // 移除重複的斜線
        normalized = normalized.replace(/\/{2,}/g, '/');
        
        // 移除根路徑前綴
        if (normalized.startsWith(this.driveRoot)) {
            normalized = normalized.slice(this.driveRoot.length);
        }
        
        // 移除開頭的斜線
        return normalized.replace(/^\/+/, '');
    }

    /**
     * 加上 Drive 根路徑前綴
     * @param {string} relativePath - 相對路徑
     * @returns {string} 完整路徑
     */
    addRootPrefix(relativePath) {
        if (!relativePath) return this.driveRoot;
        
        const cleaned = this.stripRootPrefix(relativePath);
        if (!cleaned) return this.driveRoot;
        
        return `${this.driveRoot}/${cleaned}`.replace(/\/{2,}/g, '/');
    }

    /**
     * 正規化相對路徑
     * @param {string} relativePath - 相對路徑
     * @param {Object} options - 選項
     * @returns {string} 正規化的路徑
     */
    normalizeRelativePath(relativePath, options = {}) {
        const cleaned = this.stripRootPrefix(relativePath);
        if (!cleaned) return '';
        
        const segments = cleaned.split('/').map(seg => seg.trim()).filter(Boolean);
        if (!segments.length) return '';
        
        // 確保第一段是學期
        if (!this.isSemesterSegment(segments[0])) {
            const semester = options.semester || this.getCurrentSemester();
            if (semester) {
                segments.unshift(semester);
            }
        }
        
        // 清理每個段落
        const cleanedSegments = segments.map((seg, index) => {
            // 跳過學期段落（第一個）
            if (index === 0 && this.isSemesterSegment(seg)) {
                return seg;
            }
            
            // 🔥 清理課程名稱段落（通常是第二個）
            if (index === 1) {
                return this.sanitizeSegment(seg, true);
            }
            
            // 跳過日期段落（通常是第三個）
            if (this.isDateSegment(seg)) {
                // 保留日期段落的格式（可能包含主題）
                return seg;
            }
            return this.sanitizeSegment(seg);
        });
        
        return cleanedSegments.join('/');
    }

    /**
     * 解析路徑為結構化資料
     * @param {string} path - 路徑
     * @returns {Object} 解析後的資料
     */
    parsePath(path) {
        const cleaned = this.stripRootPrefix(path);
        if (!cleaned) return {};
        
        const segments = cleaned.split('/').filter(Boolean);
        
        // 標準格式：學期/課程/日期主題/學生名稱
        const result = {
            semester: segments[0] || '',
            courseName: segments[1] || '',
            dateWithTopic: segments[2] || '',
            studentName: segments[3] || '',
            additionalPath: segments.slice(4).join('/')
        };
        
        // 解析日期和主題
        if (result.dateWithTopic) {
            const match = result.dateWithTopic.match(/^(\d{4}-\d{2}-\d{2})(?:\s+(.+))?$/);
            if (match) {
                result.date = match[1];
                result.topic = match[2] || '';
            } else {
                // 可能只有日期或只有主題
                if (/^\d{4}-\d{2}-\d{2}$/.test(result.dateWithTopic)) {
                    result.date = result.dateWithTopic;
                    result.topic = '';
                } else {
                    result.date = '';
                    result.topic = result.dateWithTopic;
                }
            }
        } else {
            result.date = '';
            result.topic = '';
        }
        
        // 判斷是否為課程總覽
        result.isOverview = result.studentName === '課程總覽' || 
                           result.studentName === 'overview' ||
                           !result.studentName;
        
        return result;
    }

    /**
     * 建構路徑
     * @param {Object} components - 路徑組成
     * @returns {string} 建構的路徑
     */
    buildPath(components) {
        const {
            semester,
            courseName,
            date,
            topic,
            studentName,
            isOverview
        } = components;
        
        // 確保必要欄位
        const finalSemester = semester || this.getCurrentSemester();
        // 🔥 課程名稱需要清理週次資訊
        const finalCourseName = this.sanitizeSegment(courseName || '課程', true);
        const finalDate = date || this.formatDate(new Date());
        const finalTopic = topic ? this.sanitizeSegment(topic) : '';
        const finalStudentName = isOverview ? '課程總覽' : this.sanitizeSegment(studentName || '學生');
        
        // 組合日期和主題
        const dateSegment = finalTopic ? `${finalDate} ${finalTopic}` : finalDate;
        
        // 組合路徑
        const segments = [
            finalSemester,
            finalCourseName,
            dateSegment,
            finalStudentName
        ].filter(Boolean);
        
        return segments.join('/');
    }

    /**
     * 清理路徑段落（移除不合法字元）
     * @param {string} segment - 路徑段落
     * @param {boolean} cleanCourseName - 是否清理課程名稱中的週次
     * @returns {string} 清理後的段落
     */
    sanitizeSegment(segment, cleanCourseName = false) {
        if (!segment) return '';
        
        let cleaned = String(segment);
        
        // 🔥 清理課程名稱中的週次資訊
        if (cleanCourseName) {
            if (this.courseNameCleaner && this.courseNameCleaner.cleanCourseName) {
                cleaned = this.courseNameCleaner.cleanCourseName(cleaned);
            } else {
                // 備用：移除週次標記
                cleaned = cleaned
                    .replace(/\s+第\d+週/gi, '')
                    .replace(/\s+第.{1,3}週/gi, '')
                    .replace(/\s+week\s*\d+/gi, '')
                    .replace(/\s+w\d+/gi, '');
            }
        }
        
        // 清理不合法字元
        return cleaned
            .replace(/[<>:"|?*]/g, '')     // 移除 Windows 不合法字元
            .replace(/[\\\/]/g, '-')        // 路徑分隔符號改為橫線
            .replace(/：/g, '-')            // 中文冒號改為橫線
            .replace(/:/g, '-')             // 英文冒號改為橫線
            .replace(/\s+/g, ' ')           // 多個空白合併為一個
            .trim();                        // 移除首尾空白
    }

    /**
     * 判斷是否為學期格式
     * @param {string} val - 要檢查的字串
     * @returns {boolean} 是否為學期格式
     */
    isSemesterSegment(val) {
        if (!val) return false;
        
        // 使用 semester-helper 的函數（如果可用）
        if (this.semesterHelper && this.semesterHelper.isSemesterFormat) {
            return this.semesterHelper.isSemesterFormat(val);
        }
        
        // 備用邏輯
        return /^(\d{3}-[12]|(?:夏令營|冬令營)-\d{4})$/i.test(String(val).trim());
    }

    /**
     * 判斷是否為日期格式段落
     * @param {string} val - 要檢查的字串
     * @returns {boolean} 是否包含日期
     */
    isDateSegment(val) {
        if (!val) return false;
        return /^\d{4}-\d{2}-\d{2}/.test(String(val));
    }

    /**
     * 獲取當前學期
     * @returns {string} 當前學期
     */
    getCurrentSemester() {
        // 使用 semester-helper 的函數（如果可用）
        if (this.semesterHelper && this.semesterHelper.getCurrentSemester) {
            return this.semesterHelper.getCurrentSemester();
        }
        
        // 備用邏輯
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const taiwanYear = year - 1911;
        
        if (month >= 3 && month <= 6) return `${taiwanYear}-2`;
        if (month >= 7 && month <= 8) return `夏令營-${year}`;
        if (month >= 9 && month <= 12) return `${taiwanYear}-1`;
        return `冬令營-${year}`;
    }

    /**
     * 格式化日期
     * @param {Date|string|number} date - 日期
     * @returns {string} 格式化的日期
     */
    formatDate(date) {
        // 使用 date-formatter 的函數（如果可用）
        if (this.dateFormatter && this.dateFormatter.formatDateYYYYMMDD) {
            return this.dateFormatter.formatDateYYYYMMDD(date);
        }
        
        // 備用邏輯
        const d = date ? new Date(date) : new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 驗證路徑是否合法
     * @param {string} path - 要驗證的路徑
     * @returns {Object} 驗證結果
     */
    validatePath(path) {
        const result = {
            isValid: true,
            errors: [],
            warnings: []
        };
        
        if (!path) {
            result.isValid = false;
            result.errors.push('路徑為空');
            return result;
        }
        
        const parsed = this.parsePath(path);
        
        // 檢查學期
        if (!parsed.semester) {
            result.warnings.push('缺少學期資訊');
        } else if (!this.isSemesterSegment(parsed.semester)) {
            result.isValid = false;
            result.errors.push('學期格式不正確: ' + parsed.semester);
        }
        
        // 檢查課程名稱
        if (!parsed.courseName) {
            result.warnings.push('缺少課程名稱');
        }
        
        // 檢查日期
        if (!parsed.date && !parsed.topic) {
            result.warnings.push('缺少日期或主題');
        }
        
        // 檢查學生名稱（除非是課程總覽）
        if (!parsed.studentName && !parsed.isOverview) {
            result.warnings.push('缺少學生名稱');
        }
        
        return result;
    }

    /**
     * 比較兩個路徑是否指向同一位置
     * @param {string} path1 - 路徑1
     * @param {string} path2 - 路徑2
     * @returns {boolean} 是否相同
     */
    isSamePath(path1, path2) {
        if (!path1 || !path2) return false;
        
        const normalized1 = this.normalizeRelativePath(path1);
        const normalized2 = this.normalizeRelativePath(path2);
        
        return normalized1 === normalized2;
    }

    /**
     * 取得路徑的顯示名稱
     * @param {string} path - 路徑
     * @returns {string} 顯示名稱
     */
    getDisplayName(path) {
        const parsed = this.parsePath(path);
        
        if (parsed.isOverview) {
            return `課程總覽 - ${parsed.courseName || '未知課程'}`;
        }
        
        return parsed.studentName || '未知';
    }
}

// Node.js 環境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DrivePathHelper;
}

// 瀏覽器環境
if (typeof window !== 'undefined') {
    window.DrivePathHelper = DrivePathHelper;
}
