/**
 * 🔄 Metadata 格式轉換統一工具
 * 統一前後端的 metadata 格式，確保一致性
 */

// 引入依賴（Node.js 環境）
let _publicMetadataDateFormatter, _publicMetadataSemesterHelper, _publicMetadataDrivePathHelper;
if (typeof require !== 'undefined') {
    _publicMetadataDateFormatter = require('./date-formatter');
    _publicMetadataSemesterHelper = require('./semester-helper');
    _publicMetadataDrivePathHelper = require('./drive-path-helper');
}

/**
 * Metadata 轉換器類別
 */
class MetadataTransformer {
    /**
     * 建構函數
     */
    constructor() {
        this.dateFormatter = _publicMetadataDateFormatter || (typeof window !== 'undefined' ? window.DateFormatter : null);
        this.semesterHelper = _publicMetadataSemesterHelper || (typeof window !== 'undefined' ? window.SemesterHelper : null);
        this.drivePathHelper = _publicMetadataDrivePathHelper || (typeof window !== 'undefined' ? window.DrivePathHelper : null);
    }

    /**
     * 標準化 metadata（統一格式）
     * @param {Object} input - 輸入的 metadata（可能來自前端或後端）
     * @returns {Object} 標準化後的 metadata
     */
    normalize(input) {
        if (!input || typeof input !== 'object') {
            return this.getEmptyMetadata();
        }

        // 提取所有可能的欄位（相容不同命名）
        const semester = this.extractSemester(input);
        const courseName = this.extractCourseName(input);
        const date = this.extractDate(input);
        const topic = this.extractTopic(input);
        const studentName = this.extractStudentName(input);
        const instructorName = this.extractInstructorName(input);
        const isOverview = this.extractIsOverview(input);
        const relativePath = this.extractRelativePath(input);
        const comment = this.extractComment(input);
        const uploadTime = this.extractUploadTime(input);
        
        // 返回統一格式
        return {
            // 基本資訊
            semester: semester,
            courseName: courseName,
            date: date,
            topic: topic,
            studentName: studentName,
            instructorName: instructorName,
            
            // 狀態標記
            isOverview: isOverview,
            
            // 路徑資訊
            relativePath: relativePath,
            
            // 附加資訊
            comment: comment,
            uploadTime: uploadTime,
            
            // 衍生欄位（相容舊版）
            dateKey: date, // 相容舊版 dateKey
            coursePeriod: courseName, // 相容舊版 coursePeriod
            mode: isOverview ? 'overview' : 'student', // 相容舊版 mode
            teacherName: instructorName, // 相容舊版 teacherName
            
            // 原始資料（除錯用）
            _original: input
        };
    }

    /**
     * 提取學期
     */
    extractSemester(input) {
        const semester = input.semester || 
                        input.semesterSegment || 
                        input.semesterKey ||
                        '';
        
        // 使用 SemesterHelper 驗證格式
        if (this.semesterHelper && this.semesterHelper.isSemesterFormat) {
            if (this.semesterHelper.isSemesterFormat(semester)) {
                return semester;
            }
        }
        
        // 從日期推算學期
        const date = this.extractDate(input);
        if (date && this.semesterHelper && this.semesterHelper.getCurrentSemester) {
            return this.semesterHelper.getCurrentSemester(date);
        }
        
        return semester || '';
    }

    /**
     * 提取課程名稱
     */
    extractCourseName(input) {
        return input.courseName || 
               input.coursePeriod || 
               input.courseTitle || 
               input.course ||
               '';  // 返回空字串而非預設值，讓 merge 可以正確處理
    }

    /**
     * 提取日期
     */
    extractDate(input) {
        const dateValue = input.date || 
                         input.dateKey || 
                         input.courseDate ||
                         input.recordDate ||
                         '';
        
        // 使用 DateFormatter 格式化
        if (dateValue && this.dateFormatter && this.dateFormatter.formatDateYYYYMMDD) {
            return this.dateFormatter.formatDateYYYYMMDD(dateValue);
        }
        
        // 基本格式化
        if (dateValue) {
            const d = new Date(dateValue);
            if (!isNaN(d.getTime())) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
        }
        
        return dateValue || '';
    }

    /**
     * 提取主題
     */
    extractTopic(input) {
        return input.topic || 
               input.subject || 
               input.lessonTopic ||
               input.courseTheme ||
               '';
    }

    /**
     * 提取學生名稱
     */
    extractStudentName(input) {
        // 課程總覽模式不需要學生名稱
        if (this.extractIsOverview(input)) {
            return '課程總覽';
        }
        
        return input.studentName || 
               input.student ||
               input.targetStudent ||
               '';
    }

    /**
     * 提取講師名稱
     */
    extractInstructorName(input) {
        return input.instructorName || 
               input.instructor ||
               input.teacherName ||
               input.teacher ||
               '';
    }

    /**
     * 提取是否為課程總覽
     */
    extractIsOverview(input) {
        // 多種判斷方式
        if (input.isOverview === true || input.isOverview === 'true') {
            return true;
        }
        
        if (input.mode === 'overview') {
            return true;
        }
        
        const studentName = input.studentName || input.student || '';
        if (studentName === '課程總覽' || studentName === 'overview') {
            return true;
        }
        
        return false;
    }

    /**
     * 提取相對路徑
     */
    extractRelativePath(input) {
        // 優先使用統一路徑
        const path = input.relativePath || 
                    input.relativePathUnified ||
                    input.path ||
                    '';
        
        // 如果沒有路徑，嘗試使用 DrivePathHelper 建構
        if (!path && this.drivePathHelper && this.drivePathHelper.buildPath) {
            const components = {
                semester: this.extractSemester(input),
                courseName: this.extractCourseName(input),
                date: this.extractDate(input),
                topic: this.extractTopic(input),
                studentName: this.extractStudentName(input),
                isOverview: this.extractIsOverview(input)
            };
            
            return this.drivePathHelper.buildPath(components);
        }
        
        return path;
    }

    /**
     * 提取註解
     */
    extractComment(input) {
        return input.comment || 
               input.notes ||
               input.description ||
               input.memo ||
               '';
    }

    /**
     * 提取上傳時間
     */
    extractUploadTime(input) {
        const time = input.uploadTime || 
                    input.uploadedAt ||
                    input.createdAt ||
                    input.timestamp ||
                    '';
        
        // 格式化時間
        if (time) {
            const d = new Date(time);
            if (!isNaN(d.getTime())) {
                return d.toISOString();
            }
        }
        
        return time || new Date().toISOString();
    }

    /**
     * 取得空的 metadata 結構
     */
    getEmptyMetadata() {
        return {
            semester: '',
            courseName: '',
            date: '',
            topic: '',
            studentName: '',
            instructorName: '',
            isOverview: false,
            relativePath: '',
            comment: '',
            uploadTime: new Date().toISOString(),
            dateKey: '',
            coursePeriod: '',
            mode: 'student',
            teacherName: '',
            _original: null
        };
    }

    /**
     * 驗證 metadata 是否完整
     * @param {Object} metadata - 要驗證的 metadata
     * @returns {Object} 驗證結果 { valid: boolean, missing: Array, warnings: Array }
     */
    validate(metadata) {
        const missing = [];
        const warnings = [];
        
        // 檢查必要欄位
        if (!metadata.semester) {
            missing.push('semester');
        }
        
        if (!metadata.courseName) {
            missing.push('courseName');
        }
        
        if (!metadata.date) {
            missing.push('date');
        }
        
        if (!metadata.isOverview && !metadata.studentName) {
            missing.push('studentName（非課程總覽模式必須提供）');
        }
        
        // 檢查建議欄位
        if (!metadata.topic) {
            warnings.push('topic（建議提供主題）');
        }
        
        if (!metadata.instructorName) {
            warnings.push('instructorName（建議提供講師名稱）');
        }
        
        if (!metadata.relativePath) {
            warnings.push('relativePath（建議提供相對路徑）');
        }
        
        return {
            valid: missing.length === 0,
            missing: missing,
            warnings: warnings
        };
    }

    /**
     * 合併多個 metadata（優先順序：後者覆蓋前者）
     * @param {...Object} metadataList - 要合併的 metadata 列表
     * @returns {Object} 合併後的 metadata
     */
    merge(...metadataList) {
        const merged = this.getEmptyMetadata();
        
        for (const metadata of metadataList) {
            if (!metadata || typeof metadata !== 'object') {
                continue;
            }
            
            const normalized = this.normalize(metadata);
            
            // 合併非空欄位
            Object.keys(normalized).forEach(key => {
                if (key === '_original') {
                    return; // 跳過原始資料
                }
                
                const value = normalized[key];
                if (value !== undefined && value !== null && value !== '') {
                    merged[key] = value;
                }
            });
        }
        
        return merged;
    }

    /**
     * 轉換為前端格式（相容舊版前端）
     * @param {Object} metadata - 標準化的 metadata
     * @returns {Object} 前端格式的 metadata
     */
    toFrontendFormat(metadata) {
        const normalized = this.normalize(metadata);
        
        return {
            studentName: normalized.studentName,
            dateKey: normalized.date,
            courseName: normalized.courseName,
            period: '', // 前端可能需要，但標準格式沒有
            mode: normalized.isOverview ? 'overview' : 'student',
            semester: normalized.semester,
            topic: normalized.topic,
            coursePeriod: normalized.courseName,
            relativePathUnified: normalized.relativePath,
            relativePath: normalized.relativePath,
            comment: normalized.comment,
            uploadTime: normalized.uploadTime
        };
    }

    /**
     * 轉換為後端格式（相容舊版後端）
     * @param {Object} metadata - 標準化的 metadata
     * @returns {Object} 後端格式的 metadata
     */
    toBackendFormat(metadata) {
        const normalized = this.normalize(metadata);
        
        return {
            semester: normalized.semester,
            courseName: normalized.courseName,
            coursePeriod: normalized.courseName,
            date: normalized.date,
            dateKey: normalized.date,
            topic: normalized.topic,
            studentName: normalized.studentName,
            instructorName: normalized.instructorName,
            teacherName: normalized.instructorName,
            isOverview: normalized.isOverview,
            relativePath: normalized.relativePath,
            comment: normalized.comment,
            uploadTime: normalized.uploadTime,
            metadata: {
                _normalized: true,
                _timestamp: Date.now()
            }
        };
    }
}

// 建立單例實例
const instance = new MetadataTransformer();

// Node.js 環境匯出
if (typeof module !== 'undefined' && module.exports) {
    module.exports = instance;
    module.exports.MetadataTransformer = MetadataTransformer;
}

// 瀏覽器環境匯出
if (typeof window !== 'undefined') {
    window.MetadataTransformer = MetadataTransformer;
    window.metadataTransformer = instance;
    console.log('✅ [MetadataTransformer] 前端模組已載入');
}
