const CourseStudentMatcher = (function() {
    'use strict';
    const SPECIAL_MARKERS = ['改時間', '體驗', '體驗課', '體驗班', '代課', '停課', '請假', '補課', '取消', '休息'];
    const LOCATION_KEYWORDS = ['到府', '到宅', '到家', '家教', '到校', '到園', '到店'];

    let CourseTitleParserModule = null;
    try {
        if (typeof require === 'function') {
            CourseTitleParserModule = require('./course-title-parser');
        }
    } catch (error) {
        CourseTitleParserModule = null;
    }
    if (!CourseTitleParserModule && typeof window !== 'undefined') {
        CourseTitleParserModule = window.CourseTitleParser || (window.FLB && window.FLB.CourseTitleParser) || null;
    }

    function stripSpecialMarkers(title) {
        if (!title || typeof title !== 'string') return '';
        let sanitized = title;
        try {
            const pattern = SPECIAL_MARKERS
                .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('|');
            if (pattern) {
                const bracketed = new RegExp(`[\\[\\(（【]\\s*(?:${pattern})(?:課|班|日|活動|事件)?\\s*[\\]\\)）】]`, 'gi');
                const leading = new RegExp(`^(?:\\s*(?:${pattern})(?:課|班|日|活動|事件)?\\s*[-–—:]?\\s*)+`, 'gi');
                const trailing = new RegExp(`(?:\\s*[-–—:]?\\s*(?:${pattern})(?:課|班|日|活動|事件)?)+$`, 'gi');
                sanitized = sanitized.replace(bracketed, ' ')
                    .replace(leading, '')
                    .replace(trailing, '');
            }
            sanitized = sanitized.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        } catch (_) {
            sanitized = String(title || '').trim();
        }
        return sanitized || String(title || '').trim();
    }

    function extractCourseName(courseTitle) {
        if (!courseTitle) {
            console.warn('⚠️ extractCourseName: 課程標題為空');
            return '';
        }
        const sanitizedTitle = stripSpecialMarkers(courseTitle);
        const baseTitle = sanitizedTitle || courseTitle;
        let courseName = '';
        
        if (baseTitle.includes('—')) {
            courseName = baseTitle.split('—')[0].trim();
        } else {
            // 🎯 取第一個空白前的部分
            const firstPart = baseTitle.split(/\s+/)[0].trim();
            
            // 🎯 智能判斷是否移除尾部數字
            // 如果是純英文或英文+數字（如 EV3, SPIKE, MP3），保留完整
            // 如果是中文+數字（如 資訊課401, 龍華501），移除尾部數字
            if (/^[A-Za-z0-9]+$/.test(firstPart)) {
                // 純英文或英文+數字，保留完整（如 EV3, SPIKE, MP3）
                courseName = firstPart;
            } else if (/[\u4e00-\u9fa5]/.test(firstPart)) {
                // 包含中文，移除尾部數字（如 資訊課401 → 資訊課）
                courseName = firstPart.replace(/\d+$/, '');
            } else {
                // 其他情況，保留原樣
                courseName = firstPart;
            }
            
            // 如果移除數字後為空，使用原始值
            if (!courseName) {
                courseName = firstPart;
            }
        }
        
        console.log('📚 extractCourseName:', { input: courseTitle, sanitized: baseTitle, output: courseName });
        return courseName.toUpperCase();
    }
    
    function findStudentsByCourse(courseName, studentData, options = {}) {
        const { includeZeroRemaining = true, event = null, minConfidence = 60 } = options;
        if (!courseName) {
            console.warn('⚠️ findStudentsByCourse: 課程名稱為空');
            return [];
        }
        if (!studentData || !studentData.students || !Array.isArray(studentData.students)) {
            console.error('❌ findStudentsByCourse: 學生資料格式錯誤', studentData);
            return [];
        }
        const targetCourse = courseName.toUpperCase();
        let matchedStudents = studentData.students.filter(student => {
            const hasRemainingClasses = includeZeroRemaining 
                ? (student.remaining || 0) >= 0 
                : (student.remaining || 0) > 0;
            if (!hasRemainingClasses) return false;
            const studentCourse = (student.course || '').toUpperCase();
            return studentCourse === targetCourse;
        });
        if (event) {
            matchedStudents = matchedStudents
                .map(student => {
                    const matchResult = matchStudentToEvent(student, event, options);
                    return { student, matchResult };
                })
                .filter(item => item.matchResult.confidence >= minConfidence)
                .sort((a, b) => b.matchResult.confidence - a.matchResult.confidence)
                .map(item => ({
                    ...item.student,
                    _matchConfidence: item.matchResult.confidence,
                    _matchReason: item.matchResult.reason
                }));
        }
        return matchedStudents;
    }
    
    function matchStudentsByTitle(courseTitle, studentData, options = {}) {
        const courseName = extractCourseName(courseTitle);
        const students = findStudentsByCourse(courseName, studentData, options);
        return { courseName, courseTitle, students, studentsCount: students.length };
    }
    
    function ensureWeekdayTimeSpacing(input) {
        if (!input || typeof input !== 'string') return '';
        let value = input;
        try {
            value = value.replace(/([^\s一二三四五六日])([一二三四五六日])/g, '$1 $2');
            value = value.replace(/([一二三四五六日])\s*(\d{1,2}:\d{2})/g, '$1 $2');
            value = value.replace(/([一二三四五六日])\s*(\d{3,4})(?=[^\d]|$)/g, '$1 $2');
            value = value.replace(/(\d{1,2}:\d{2})-(\d{1,2}:\d{2})([^\s\d])/g, '$1-$2 $3');
            value = value.replace(/(\d{4})-(\d{4})([^\s\d])/g, '$1-$2 $3');
            value = value.replace(/\s{2,}/g, ' ').trim();
        } catch (_) {
            value = String(input || '').trim();
        }
        return value;
    }

    function stripCoursePrefix(input) {
        if (!input) return '';
        // 🔥 修復：支援多詞課程名稱（如 "SPIKE PRO"）
        // 匹配開頭所有非星期字符，直到遇到星期為止
        return input.replace(/^[^一二三四五六日]+(?=[一二三四五六日])/i, '').trim();
    }

    function stripPostTimeDescriptor(input) {
        if (!input) return '';
        let value = input;
        try {
            // 只能移除週次/週數相關字樣，其餘（地點、描述）必須保留
            value = value
                .replace(/第[一二三四五六七八九十\d]+[週周]/gi, '')
                .replace(/Week\s*\d+/gi, '')
                .replace(/week\s*\d+/gi, '')
                .replace(/週次\s*\d+/gi, '');
        } catch (_) {
            value = String(input || '');
        }
        return value;
    }

    function normalizeLocationLabel(value) {
        if (!value) return '';
        return value.toString().replace(/\s+/g, '').replace(/[：:]/g, '').toLowerCase();
    }

    function extractLocationFromText(text) {
        if (!text) return '';
        const trimmed = text.trim();
        if (!trimmed) return '';
        for (const keyword of LOCATION_KEYWORDS) {
            if (trimmed.includes(keyword)) {
                return keyword;
            }
        }
        const timePattern = /[一二三四五六日]\s*\d{1,2}:?\d{2}\s*[-–—]\s*\d{1,2}:?\d{2}\s*(.+)$/;
        const match = trimmed.match(timePattern);
        if (match && match[1]) {
            return match[1].replace(/第\d+[週周].*/gi, '').trim();
        }
        return '';
    }

    function parseTitleMeta(source) {
        if (!source || !CourseTitleParserModule || typeof CourseTitleParserModule.parse !== 'function') {
            return null;
        }
        try {
            return CourseTitleParserModule.parse(source);
        } catch (error) {
            console.warn('⚠️ CourseTitleParser 解析失敗:', error.message);
            return null;
        }
    }

    function extractEventLocation(event) {
        if (!event) return '';
        const candidates = [];
        if (event.location) candidates.push(event.location);
        if (event.extendedProps && event.extendedProps.location) {
            candidates.push(event.extendedProps.location);
        }
        if (event.title) {
            const parsed = parseTitleMeta(event.title);
            if (parsed && parsed.location) {
                candidates.push(parsed.location);
            }
        }
        if (event.description) {
            candidates.push(extractLocationFromText(event.description));
        }
        return candidates.find(value => value && value.trim().length > 0) || '';
    }

    function extractStudentLocation(student) {
        if (!student) return '';
        if (student.periodParsed && student.periodParsed.location) {
            return student.periodParsed.location;
        }
        if (student.period) {
            const parsed = parseTitleMeta(student.period);
            if (parsed && parsed.location) {
                return parsed.location;
            }
            return extractLocationFromText(student.period);
        }
        return '';
    }

    function normalizeTimeFormat(timeStr) {
        if (!timeStr) return '';
        let normalized = ensureWeekdayTimeSpacing(String(timeStr));
        normalized = stripCoursePrefix(normalized);
        let sanitized = normalized
            .replace(/\s*第[一二三四五六七八九十\d]+周\s*/gi, '')
            .replace(/\s*第[一二三四五六七八九十\d]+週\s*/gi, '')
            .replace(/\s*Week\s*\d+\s*/gi, '')
            .replace(/\s*week\s*\d+\s*/gi, '')
            .replace(/\s+/g, '')
            .toLowerCase()
            .replace(/(\d{1,2}):(\d{2})/g, (match, h, m) => h.padStart(2, '0') + m);
        sanitized = stripPostTimeDescriptor(sanitized);
        return sanitized;
    }
    
    function isTimeMatch(studentPeriod, targetTime) {
        if (!studentPeriod || !targetTime) return false;
        const cleanStudentPeriod = normalizeTimeFormat(studentPeriod);
        const cleanTargetTime = normalizeTimeFormat(targetTime);
        const extractBaseTime = (timeStr) => {
            return stripPostTimeDescriptor(
                timeStr
                    .replace(/\s*第\d+週\s*代課\s*$/, '')
                    .replace(/\s*第\d+周\s*代課\s*$/, '')
                    .replace(/\s*第\d+週\s*$/, '')
                    .replace(/\s*第\d+周\s*$/, '')
                    .replace(/\s*代課\s*$/, '')
                    .replace(/\s+$/, '')
            );
        };
        const baseStudentPeriod = extractBaseTime(cleanStudentPeriod);
        const baseTargetTime = extractBaseTime(cleanTargetTime);
        const exactMatch = cleanStudentPeriod === cleanTargetTime;
        const prefixMatch = cleanStudentPeriod && cleanStudentPeriod.startsWith(cleanTargetTime) && cleanStudentPeriod.length > cleanTargetTime.length;
        const baseTimeMatch = baseStudentPeriod && baseTargetTime && baseStudentPeriod === baseTargetTime;
        return exactMatch || prefixMatch || baseTimeMatch;
    }
    
    function getAvailableCourses(studentData) {
        if (!studentData || !studentData.students || !Array.isArray(studentData.students)) return [];
        const courses = [...new Set(studentData.students.map(s => s.course).filter(Boolean))];
        return courses.sort();
    }
    
    function getCourseStats(courseName, studentData) {
        const students = findStudentsByCourse(courseName, studentData, { includeZeroRemaining: true });
        const stats = {
            courseName,
            totalStudents: students.length,
            activeStudents: students.filter(s => (s.remaining || 0) > 0).length,
            zeroRemainingStudents: students.filter(s => (s.remaining || 0) === 0).length,
            totalRemainingClasses: students.reduce((sum, s) => sum + (s.remaining || 0), 0),
            averageRemainingClasses: 0
        };
        if (stats.activeStudents > 0) {
            const activeStudentsRemaining = students
                .filter(s => (s.remaining || 0) > 0)
                .reduce((sum, s) => sum + s.remaining, 0);
            stats.averageRemainingClasses = Math.round(activeStudentsRemaining / stats.activeStudents * 10) / 10;
        }
        return stats;
    }
    
    function validateStudentMatch(student, courseName, targetTime = null) {
        if (!student || !courseName) return false;
        const studentCourse = (student.course || '').toUpperCase();
        const targetCourse = courseName.toUpperCase();
        const courseMatch = studentCourse === targetCourse;
        if (!courseMatch) return false;
        if (targetTime && student.period) {
            return isTimeMatch(student.period, targetTime);
        }
        return true;
    }
    
    function getEventWeekday(event) {
        if (event.weekday) return event.weekday;
        if (event.start) {
            try {
                let date;
                // 🔥 處理 Unix timestamp（秒）或毫秒數
                if (typeof event.start === 'number') {
                    // 判斷是秒還是毫秒（秒數通常 < 10^10）
                    date = event.start < 10000000000 
                        ? new Date(event.start * 1000)  // 秒 → 毫秒
                        : new Date(event.start);         // 已經是毫秒
                } else {
                    date = new Date(event.start);
                }
                
                if (isNaN(date.getTime())) return null;
                const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
                return weekdays[date.getDay()];
            } catch (error) {
                console.error('⚠️ 無法從事件提取星期:', error);
                return null;
            }
        }
        return null;
    }
    
    function formatTime(dateValue) {
        if (!dateValue) return null;
        try {
            let date;
            // 🔥 處理 Unix timestamp（秒）或毫秒數
            if (typeof dateValue === 'number') {
                // 判斷是秒還是毫秒（秒數通常 < 10^10）
                date = dateValue < 10000000000 
                    ? new Date(dateValue * 1000)  // 秒 → 毫秒
                    : new Date(dateValue);         // 已經是毫秒
            } else {
                date = new Date(dateValue);
            }
            
            if (isNaN(date.getTime())) return null;
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        } catch (error) {
            console.error('⚠️ 無法格式化時間:', error);
            return null;
        }
    }
    
    function timeOverlap(start1, end1, start2, end2) {
        if (!start1 || !end1 || !start2 || !end2) return false;
        try {
            const toMinutes = (timeStr) => {
                const [h, m] = timeStr.split(':').map(Number);
                return h * 60 + m;
            };
            const s1 = toMinutes(start1);
            const e1 = toMinutes(end1);
            const s2 = toMinutes(start2);
            const e2 = toMinutes(end2);
            return s1 < e2 && s2 < e1;
        } catch (error) {
            console.error('⚠️ 無法檢查時間重疊:', error);
            return false;
        }
    }
    
    function matchStudentToEvent(student, event, options = {}) {
        const result = { matched: false, confidence: 0, reason: '' };
        if (!student || !event) {
            result.reason = '無效的學生或事件資料';
            return result;
        }
        const courseName = extractCourseName(event.title || '');
        const studentCourse = (student.course || '').toUpperCase();
        const eventCourse = courseName.toUpperCase();
        if (eventCourse !== studentCourse) {
            result.reason = '課程名稱不匹配';
            return result;
        }
        result.confidence += 40;
        if (student.periodParsed && student.periodParsed.startTime) {
            const eventWeekday = getEventWeekday(event);
            if (eventWeekday && student.periodParsed.weekdays && student.periodParsed.weekdays.length > 0) {
                if (student.periodParsed.weekdays.includes(eventWeekday)) {
                    result.confidence += 30;
                } else {
                    result.reason = `星期不匹配 (事件: ${eventWeekday}, 學生: ${student.periodParsed.weekdays.join(',')})`;
                    return result;
                }
            }
            const eventStartTime = formatTime(event.start);
            const eventEndTime = formatTime(event.end);
            if (eventStartTime && eventEndTime) {
                // 🔥 精確匹配：開始和結束時間都必須相同
                if (eventStartTime === student.periodParsed.startTime && eventEndTime === student.periodParsed.endTime) {
                    result.confidence += 30;
                    result.matched = true;
                    result.reason = '精確匹配（課程+星期+時間）';
                    return result;
                }
                
                // 🔥 嚴格時間匹配：只允許開始時間相差 10 分鐘以內
                const toMinutes = (timeStr) => {
                    const [h, m] = timeStr.split(':').map(Number);
                    return h * 60 + m;
                };
                const eventStartMinutes = toMinutes(eventStartTime);
                const eventEndMinutes = toMinutes(eventEndTime);
                const studentStartMinutes = toMinutes(student.periodParsed.startTime);
                const studentEndMinutes = toMinutes(student.periodParsed.endTime);
                
                const startDiff = Math.abs(eventStartMinutes - studentStartMinutes);
                const endDiff = Math.abs(eventEndMinutes - studentEndMinutes);
                
                // 🔥 開始時間差異 <= 10 分鐘 且 結束時間差異 <= 10 分鐘
                if (startDiff <= 10 && endDiff <= 10) {
                    result.confidence += 25;
                    result.matched = true;
                    result.reason = `接近匹配（課程+星期+時間接近，開始差${startDiff}分，結束差${endDiff}分）`;
                    return result;
                } else {
                    // 🔥 時間差異太大，直接拒絕
                    result.reason = `時間不匹配（開始差${startDiff}分，結束差${endDiff}分）`;
                    return result;
                }
            }
        }
        if (student.period && event.time) {
            if (isTimeMatch(student.period, event.time)) {
                result.confidence += 20;
                result.matched = result.confidence >= 60;
                result.reason = result.matched ? '字串匹配（降級）' : '信心度不足';
                return result;
            }
        }

        const eventLocation = normalizeLocationLabel(extractEventLocation(event));
        const studentLocation = normalizeLocationLabel(extractStudentLocation(student));
        if (eventLocation || studentLocation) {
            if (!eventLocation || !studentLocation) {
                result.reason = eventLocation ? '學生缺少地點資訊' : '事件缺少地點資訊';
                return result;
            }
            if (eventLocation !== studentLocation) {
                result.reason = '地點不匹配';
                return result;
            }
            result.confidence += 20;
            if (result.confidence >= 60) {
                result.matched = true;
                result.reason = '課程、時間與地點匹配';
                return result;
            }
        }
        result.reason = `僅課程匹配，信心度不足 (${result.confidence}分)`;
        return result;
    }
    
    return {
        extractCourseName, findStudentsByCourse, matchStudentsByTitle,
        normalizeTimeFormat, isTimeMatch, matchStudentToEvent,
        getEventWeekday, formatTime, timeOverlap,
        getAvailableCourses, getCourseStats, validateStudentMatch,
        version: '2.0.0'
    };
})();
if (typeof window !== 'undefined') {
    window.CourseStudentMatcher = CourseStudentMatcher;
    console.error('✅ CourseStudentMatcher v' + CourseStudentMatcher.version + ' 已載入');
    // 標記模組已載入（僅瀏覽器）
    if (window.LOAD_PROGRESS) {
        window.LOAD_PROGRESS.updateProgress('Matcher');
    }
}

// Node.js 匯出（供 server.js 引用）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CourseStudentMatcher;
}
