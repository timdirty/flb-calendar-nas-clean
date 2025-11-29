/**
 * Student Course Matcher Module (UMD)
 * 提供前後端共用的課程與學生匹配工具。
 */
(function (global, factory) {
    if (typeof module === 'object' && typeof module.exports === 'object') {
        const CourseTitleParser = require('./course-title-parser');
        module.exports = factory(CourseTitleParser);
    } else {
        const root = global || (typeof window !== 'undefined' ? window : globalThis);
        const parser = (root && root.FLB && root.FLB.CourseTitleParser) || root.CourseTitleParser;
        const matcher = factory(parser);
        root.FLB = root.FLB || {};
        root.FLB.StudentCourseMatcher = matcher;
    }
})(typeof window !== 'undefined' ? window : globalThis, function (CourseTitleParser) {
    if (!CourseTitleParser || typeof CourseTitleParser.parse !== 'function') {
        throw new Error('CourseTitleParser is required for StudentCourseMatcher');
    }

    const HOME_KEYWORDS = ['到府', '到宅', '到校', '到園', '家教', '到家'];
    const CENTER_KEYWORDS = ['站前', '松山', '內湖', '復興', '中山', '南京', '樂程坊'];

    function normalizeText(value) {
        return (value || '')
            .toString()
            .trim()
            .replace(/\s+/g, ' ');
    }

    function normalizeCourseName(value) {
        return normalizeText(value).replace(/\s+/g, '').toLowerCase();
    }

    function toHHMM(value) {
        if (!value) return '';
        if (value.includes(':')) {
            const [h, m] = value.split(':');
            return `${h.padStart(2, '0')}${m.padStart(2, '0')}`;
        }
        if (value.length === 4) {
            return value;
        }
        if (value.length === 5) {
            return value.replace(':', '');
        }
        return value.padStart(4, '0');
    }

    function hhmmToMinutes(value) {
        const hhmm = toHHMM(value);
        if (!hhmm || hhmm.length !== 4 || /\D/.test(hhmm)) return null;
        const hours = parseInt(hhmm.slice(0, 2), 10);
        const minutes = parseInt(hhmm.slice(2, 4), 10);
        return hours * 60 + minutes;
    }

    function minutesDiff(a, b) {
        if (a === null || b === null) return null;
        return Math.abs(a - b);
    }

    function detectLocationInfo(rawText, mapAddress) {
        const text = normalizeText(rawText);
        if (!text) {
            return { type: 'unknown', label: '' };
        }

        const compact = text.replace(/\s+/g, '');
        if (HOME_KEYWORDS.some(keyword => compact.includes(keyword))) {
            return { type: 'home', label: 'home' };
        }

        let label = text;
        if (typeof mapAddress === 'function') {
            try {
                label = mapAddress(text) || label;
            } catch (error) {
                console.error('❌ mapAddress 失敗:', error);
            }
        }

        const normalizedLabel = label.replace(/\s+/g, '').toLowerCase();
        if (CENTER_KEYWORDS.some(keyword => normalizedLabel.includes(keyword))) {
            return { type: 'onsite', label: normalizedLabel };
        }

        return { type: 'onsite', label: normalizedLabel || 'onsite' };
    }

    function mergeLocationSources(parts) {
        return parts
            .filter(Boolean)
            .map(part => normalizeText(part))
            .filter(Boolean)
            .join(' ');
    }

    function deriveWeekday(weekday, dateValue) {
        if (weekday) return weekday;
        if (!dateValue) return '';
        let date;
        // 🔥 支援 Unix timestamp（秒）或 ISO 字串
        if (typeof dateValue === 'number') {
            date = dateValue < 10000000000 
                ? new Date(dateValue * 1000) 
                : new Date(dateValue);
        } else {
            date = new Date(dateValue);
        }
        if (Number.isNaN(date.getTime())) return '';
        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        return weekdays[date.getDay()];
    }

    function calculateDurationMinutes(start, end) {
        const startMinutes = hhmmToMinutes(start);
        const endMinutes = hhmmToMinutes(end);
        if (startMinutes === null || endMinutes === null) return null;
        let diff = endMinutes - startMinutes;
        if (diff < 0) diff += 24 * 60;
        return diff;
    }

    function parseStudentPeriod(student) {
        if (!student) return {};
        if (student.periodParsed && typeof student.periodParsed === 'object') {
            return {
                weekday: Array.isArray(student.periodParsed.weekdays) ? student.periodParsed.weekdays[0] : '',
                startTime: student.periodParsed.startTime || '',
                endTime: student.periodParsed.endTime || '',
                location: student.periodParsed.location || ''
            };
        }

        const parsed = CourseTitleParser.parse(student.period || '');
        return {
            weekday: parsed.weekday || '',
            startTime: parsed.startTime || '',
            endTime: parsed.endTime || '',
            location: parsed.location || ''
        };
    }

    function extractTimeFromTimestamp(timestamp) {
        if (!timestamp) return '';
        // 🔥 支援 Unix timestamp（秒）或 ISO 字串
        if (typeof timestamp === 'number') {
            // Unix timestamp（秒）→ 轉換為毫秒
            const date = timestamp < 10000000000 
                ? new Date(timestamp * 1000) 
                : new Date(timestamp);
            if (isNaN(date.getTime())) return '';
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }
        // ISO 字串
        if (typeof timestamp === 'string' && timestamp.includes('T')) {
            return timestamp.split('T')[1]?.substring(0, 5) || '';
        }
        return '';
    }

    function buildEventSignature(event, options) {
        const parsed = CourseTitleParser.parse(event.title || event.courseName || '');
        const courseName = parsed.courseName || event.courseName || '';
        const normalizedCourseName = normalizeCourseName(courseName);

        if (!normalizedCourseName) {
            return null;
        }

        const weekday = deriveWeekday(parsed.weekday, event.start);
        const startTime = parsed.startTime || extractTimeFromTimestamp(event.start);
        const endTime = parsed.endTime || extractTimeFromTimestamp(event.end);

        const locationSource = mergeLocationSources([
            parsed.location,
            event.location,
            event.description,
            options && options.locationHint
        ]);
        const locationInfo = detectLocationInfo(locationSource, options && options.mapAddress);

        return {
            normalizedCourseName,
            weekday,
            startTime: toHHMM(startTime),
            endTime: toHHMM(endTime),
            locationInfo,
            raw: {
                parsed,
                locationSource
            }
        };
    }

    function buildStudentSignature(student, options) {
        const parsedPeriod = parseStudentPeriod(student);
        const normalizedCourseName = normalizeCourseName(student.course || student.courseName || '');

        const locationParts = [parsedPeriod.location, student.location];
        let locationSource = mergeLocationSources(locationParts);

        if (!locationSource && student.period) {
            const periodCompact = student.period.replace(/\s+/g, '');
            if (HOME_KEYWORDS.some(keyword => periodCompact.includes(keyword))) {
                locationSource = '到府';
            }
        }

        const locationInfo = detectLocationInfo(locationSource, options && options.mapAddress);

        return {
            student,
            normalizedCourseName,
            weekday: parsedPeriod.weekday,
            startTime: toHHMM(parsedPeriod.startTime),
            endTime: toHHMM(parsedPeriod.endTime),
            locationInfo,
            raw: {
                parsedPeriod,
                locationSource
            }
        };
    }

    function matchStudentsForEvent(event, students, options = {}) {
        if (!event || !students || !Array.isArray(students)) {
            return [];
        }

        const eventSignature = buildEventSignature(event, options);
        if (!eventSignature) {
            return [];
        }

        const timeTolerance = typeof options.timeTolerance === 'number'
            ? options.timeTolerance
            : (options.matching && typeof options.matching.timeTolerance === 'number'
                ? options.matching.timeTolerance
                : 10);

        const durationTolerance = typeof options.durationTolerance === 'number'
            ? options.durationTolerance
            : (options.matching && typeof options.matching.durationTolerance === 'number'
                ? options.matching.durationTolerance
                : 30);

        const eventStartMinutes = hhmmToMinutes(eventSignature.startTime);
        const eventEndMinutes = hhmmToMinutes(eventSignature.endTime);
        const eventDuration = calculateDurationMinutes(eventSignature.startTime, eventSignature.endTime);

        // 🔥 新增：剩餘堂數檢查選項（預設不檢查，保持向後相容）
        const checkRemaining = options.checkRemaining !== undefined ? options.checkRemaining : false;
        const minRemainingClasses = options.minRemainingClasses !== undefined ? options.minRemainingClasses : 0;
        
        // ✅ 新增：課程日期（用於臨時學生檢查）
        let courseDate = options.courseDate;
        if (!courseDate && event.start) {
            if (typeof event.start === 'number') {
                // Unix timestamp → YYYY-MM-DD
                const date = event.start < 10000000000 
                    ? new Date(event.start * 1000) 
                    : new Date(event.start);
                if (!isNaN(date.getTime())) {
                    courseDate = date.toISOString().split('T')[0];
                }
            } else if (typeof event.start === 'string' && event.start.includes('T')) {
                courseDate = event.start.split('T')[0];
            }
        }
        
        // ✅ 新增：嚴格日期檢查模式（預設 false，顯示所有可能的學生）
        const strictDateCheck = options.strictDateCheck !== undefined ? options.strictDateCheck : false;

        let matchedStudents = students.filter(student => {
            // 🔥 剩餘堂數檢查
            if (checkRemaining) {
                const remaining = student.remaining || 0;
                if (remaining < minRemainingClasses) {
                    return false;
                }
            }

            // ✅ 檢查臨時學生（體驗課/補課）的 scheduledDate（只在嚴格模式下檢查）
            // 💡 預設模式（strictDateCheck=false）：不檢查，讓講師提前看到所有可能的學生（備課用）
            // 💡 嚴格模式（strictDateCheck=true）：檢查，確保只能在正確日期簽到/提醒
            if (student.isTemporary && student.scheduledDate && courseDate && strictDateCheck) {
                if (student.scheduledDate !== courseDate) {
                    if (options.debugMode) {
                        console.log(`❌ 臨時學生 ${student.name} 的排定日期 ${student.scheduledDate} 與課程日期 ${courseDate} 不符，跳過（嚴格模式）`);
                    }
                    return false;
                }
                if (options.debugMode) {
                    console.log(`✅ 臨時學生 ${student.name} 的排定日期 ${student.scheduledDate} 與課程日期 ${courseDate} 匹配`);
                }
            }

            const signature = buildStudentSignature(student, options);

            if (!signature.normalizedCourseName || signature.normalizedCourseName !== eventSignature.normalizedCourseName) {
                return false;
            }

            if (eventSignature.weekday && signature.weekday && eventSignature.weekday !== signature.weekday) {
                return false;
            }

            const studentStartMinutes = hhmmToMinutes(signature.startTime);
            if (eventStartMinutes !== null && studentStartMinutes !== null) {
                const diff = minutesDiff(eventStartMinutes, studentStartMinutes);
                if (diff !== null && diff > timeTolerance) {
                    return false;
                }
            }

            const studentDuration = calculateDurationMinutes(signature.startTime, signature.endTime);
            if (eventDuration !== null && studentDuration !== null) {
                const diff = Math.abs(eventDuration - studentDuration);
                if (diff > durationTolerance) {
                    return false;
                }
            }

            const eventLocationType = eventSignature.locationInfo.type;
            const studentLocationType = signature.locationInfo.type;

            if (eventLocationType !== 'unknown' && studentLocationType !== 'unknown') {
                if (eventLocationType !== studentLocationType) {
                    return false;
                }

                if (eventLocationType === 'onsite') {
                    const eventLabel = eventSignature.locationInfo.label;
                    const studentLabel = signature.locationInfo.label;
                    if (eventLabel && studentLabel && eventLabel !== studentLabel) {
                        return false;
                    }
                }
            }

            if (eventLocationType === 'home' && studentLocationType !== 'home') {
                return false;
            }

            if (studentLocationType === 'home' && eventLocationType !== 'home') {
                return false;
            }

            return true;
        });

        // 🔥 新增：信心度評分（選擇性功能）
        if (options.withConfidence) {
            matchedStudents = matchedStudents.map(student => {
                const confidence = calculateMatchConfidence(student, event, eventSignature, options);
                return {
                    ...student,
                    _matchConfidence: confidence.score,
                    _matchReason: confidence.reason
                };
            });
            
            // 依信心度排序
            matchedStudents.sort((a, b) => b._matchConfidence - a._matchConfidence);
        }

        return matchedStudents;
    }

    function calculateMatchConfidence(student, event, eventSignature, options) {
        let confidence = 0;
        let reasons = [];

        const signature = buildStudentSignature(student, options);

        // 課程名稱匹配（基礎40分）
        if (signature.normalizedCourseName === eventSignature.normalizedCourseName) {
            confidence += 40;
            reasons.push('課程名稱匹配');
        }

        // 星期匹配（加20分）
        if (eventSignature.weekday && signature.weekday) {
            if (eventSignature.weekday === signature.weekday) {
                confidence += 20;
                reasons.push('星期匹配');
            }
        }

        // 時間匹配（加30分）
        const eventStartMinutes = hhmmToMinutes(eventSignature.startTime);
        const studentStartMinutes = hhmmToMinutes(signature.startTime);
        if (eventStartMinutes !== null && studentStartMinutes !== null) {
            const diff = minutesDiff(eventStartMinutes, studentStartMinutes);
            if (diff !== null && diff <= 10) {
                if (diff === 0) {
                    confidence += 30;
                    reasons.push('時間完全匹配');
                } else {
                    confidence += 20;
                    reasons.push(`時間接近（誤差${diff}分鐘）`);
                }
            }
        }

        // 地點匹配（加10分）
        const eventLocationType = eventSignature.locationInfo.type;
        const studentLocationType = signature.locationInfo.type;
        if (eventLocationType !== 'unknown' && studentLocationType !== 'unknown') {
            if (eventLocationType === studentLocationType) {
                confidence += 10;
                reasons.push(`地點類型匹配（${eventLocationType}）`);
                
                // 站所名稱也匹配（額外加5分）
                if (eventLocationType === 'onsite') {
                    const eventLabel = eventSignature.locationInfo.label;
                    const studentLabel = signature.locationInfo.label;
                    if (eventLabel && studentLabel && eventLabel === studentLabel) {
                        confidence += 5;
                        reasons.push('站所名稱匹配');
                    }
                }
            }
        }

        return {
            score: Math.min(confidence, 100),
            reason: reasons.join('、')
        };
    }

    // 🔥 向後相容 API：模擬 course-student-matcher.js 的介面
    function extractCourseName(courseTitle) {
        if (!courseTitle) return '';
        const parsed = CourseTitleParser.parse(courseTitle);
        return parsed.courseName || '';
    }

    function findStudentsByCourse(courseName, studentData, options = {}) {
        const students = (studentData && studentData.students) ? studentData.students : (Array.isArray(studentData) ? studentData : []);
        if (!students.length) return [];
        
        const normalizedTarget = normalizeCourseName(courseName);
        return students.filter(student => {
            const studentCourse = normalizeCourseName(student.course || student.courseName || '');
            return studentCourse === normalizedTarget;
        });
    }

    function matchStudentsByTitle(courseTitle, studentData, options = {}) {
        const courseName = extractCourseName(courseTitle);
        const students = findStudentsByCourse(courseName, studentData, options);
        return {
            courseName,
            courseTitle,
            students,
            studentsCount: students.length
        };
    }

    return {
        // 主要 API
        matchStudentsForEvent,
        calculateMatchConfidence,
        
        // 🔥 向後相容 API（與 course-student-matcher.js 兼容）
        extractCourseName,
        findStudentsByCourse,
        matchStudentsByTitle,
        
        // 內部工具（除錯用）
        _internal: {
            detectLocationInfo,
            buildEventSignature,
            buildStudentSignature,
            normalizeCourseName,
            parseStudentPeriod
        },
        
        version: '3.0.0'  // 升級版本號
    };
});

// ==================== 🔥 向後相容層（瀏覽器環境） ====================
if (typeof window !== 'undefined' && typeof window.FLB !== 'undefined' && window.FLB.StudentCourseMatcher) {
    const matcher = window.FLB.StudentCourseMatcher;
    
    // 🔥 創建向後相容的 CourseStudentMatcher API
    // 讓舊代碼 window.CourseStudentMatcher.* 可以繼續運作
    window.CourseStudentMatcher = {
        extractCourseName: matcher.extractCourseName,
        findStudentsByCourse: matcher.findStudentsByCourse,
        matchStudentsByTitle: matcher.matchStudentsByTitle,
        
        // 🔥 注意：這些函數在新版本中不存在，提供基本實作
        normalizeTimeFormat: function(timeStr) {
            return (timeStr || '').replace(/\s+/g, '').toLowerCase();
        },
        
        isTimeMatch: function(studentPeriod, targetTime) {
            if (!studentPeriod || !targetTime) return false;
            return studentPeriod.includes(targetTime) || targetTime.includes(studentPeriod);
        },
        
        getAvailableCourses: function(studentData) {
            const students = (studentData && studentData.students) ? studentData.students : [];
            const courses = [...new Set(students.map(s => s.course || s.courseName).filter(Boolean))];
            return courses.sort();
        },
        
        version: '3.0.0 (compatibility)'
    };
    
    console.log('✅ StudentCourseMatcher v' + matcher.version + ' 已載入（進階版 + 向後相容層）');
    console.log('   ↳ window.FLB.StudentCourseMatcher：進階 API（推薦使用）');
    console.log('   ↳ window.CourseStudentMatcher：相容層（向後相容）');
}

