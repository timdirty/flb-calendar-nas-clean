/**
 * 🗂️ Drive 路徑處理統一工具（前端版本）
 * 提供與後端一致的路徑處理邏輯
 */

(function(global) {
    'use strict';

    /**
     * Drive 路徑處理類別（前端版本）
     */
    class DrivePathHelper {
        /**
         * 建構函數
         * @param {string} driveRoot - Drive 根路徑
         */
        constructor(driveRoot = '/Fun Learn Bar/FLB-Learning-Portfolio') {
            this.driveRoot = driveRoot;
            this.semesterHelper = global.SemesterHelper || null;
            this.dateFormatter = global.DateFormatter || null;
            this.courseNameCleaner = global.CourseNameCleaner || null;
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
         * 建構完整路徑
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
         * @param {Date|string} date - 日期物件或字串
         * @returns {string} 格式化後的日期
         */
        formatDate(date) {
            // 使用 date-formatter 的函數（如果可用）
            if (this.dateFormatter && this.dateFormatter.formatDateYYYYMMDD) {
                return this.dateFormatter.formatDateYYYYMMDD(date);
            }
            
            // 備用邏輯
            const d = date instanceof Date ? date : new Date(date);
            if (isNaN(d.getTime())) return '';
            
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            
            return `${year}-${month}-${day}`;
        }

        /**
         * 清理整個路徑（保持結構但清理每個段落）
         * @param {string} path - 原始路徑
         * @param {Object} options - 選項
         * @returns {string} 清理後的路徑
         */
        cleanPath(path, options = {}) {
            if (!path) return '';
            
            // 先移除根路徑前綴
            const relative = this.stripRootPrefix(path);
            
            // 分解路徑
            const segments = relative.split('/').filter(Boolean);
            
            if (segments.length === 0) return '';
            
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
         * 比較兩個路徑是否指向相同的位置
         * @param {string} path1 - 路徑 1
         * @param {string} path2 - 路徑 2
         * @returns {boolean} 是否相同
         */
        isSamePath(path1, path2) {
            if (!path1 || !path2) return false;
            
            const clean1 = this.cleanPath(path1);
            const clean2 = this.cleanPath(path2);
            
            return clean1 === clean2;
        }

        /**
         * 從路徑中提取組件
         * @param {string} path - 路徑
         * @returns {Object} 提取的組件
         */
        extractComponents(path) {
            if (!path) return {};
            
            const relative = this.stripRootPrefix(path);
            const segments = relative.split('/').filter(Boolean);
            
            const components = {};
            
            // 提取學期（第一個段落）
            if (segments[0] && this.isSemesterSegment(segments[0])) {
                components.semester = segments[0];
            }
            
            // 提取課程名稱（第二個段落）
            if (segments[1]) {
                components.courseName = segments[1];
            }
            
            // 提取日期和主題（第三個段落）
            if (segments[2]) {
                const dateMatch = segments[2].match(/^(\d{4}-\d{2}-\d{2})\s*(.*)?$/);
                if (dateMatch) {
                    components.date = dateMatch[1];
                    if (dateMatch[2]) {
                        components.topic = dateMatch[2];
                    }
                } else {
                    components.topic = segments[2];
                }
            }
            
            // 提取學生名稱（第四個段落）
            if (segments[3]) {
                if (segments[3] === '課程總覽') {
                    components.isOverview = true;
                } else {
                    components.studentName = segments[3];
                }
            }
            
            return components;
        }
    }

    // 建立單例實例
    const instance = new DrivePathHelper();
    
    // 匯出到全域
    global.DrivePathHelper = DrivePathHelper;
    global.drivePathHelper = instance;
    
    // 提供相容性別名
    global.DrivePathUtils = instance;
    
    console.log('✅ [DrivePathHelper] 前端模組已載入');
    
})(typeof window !== 'undefined' ? window : global);
