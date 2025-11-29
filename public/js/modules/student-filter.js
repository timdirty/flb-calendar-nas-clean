// 🔥 [修復 2025-11-19] 追蹤已警告的學生，避免重複輸出
const _warnedStudents = new Set();

function warnStudentOnce(studentName, reason) {
    const key = `${studentName}:${reason}`;
    if (!_warnedStudents.has(key)) {
        _warnedStudents.add(key);
        console.warn(`⚠️ 學生 ${studentName} ${reason}，跳過篩選`);
    }
}

async function getSpecialEventsKeywords() {
    try {
        const cached = localStorage.getItem('special_events_keywords_cache');
        const cacheTime = localStorage.getItem('special_events_keywords_cache_time');
        if (cached && cacheTime) {
            const age = Date.now() - parseInt(cacheTime);
            if (age < 5 * 60 * 1000) return JSON.parse(cached);
        }
        const response = await fetch('/api/special-events-config');
        const result = await response.json();
        if (result.success && result.data) {
            const allKeywords = [];
            for (const [type, config] of Object.entries(result.data)) {
                if (config.enabled && config.keywords) {
                    allKeywords.push(...config.keywords);
                }
            }
            const keywordsData = { allKeywords, byType: result.data };
            localStorage.setItem('special_events_keywords_cache', JSON.stringify(keywordsData));
            localStorage.setItem('special_events_keywords_cache_time', Date.now().toString());
            return keywordsData;
        }
        return getDefaultKeywords();
    } catch (error) {
        console.warn('⚠️ 獲取特殊事件關鍵字失敗，使用預設值:', error);
        return getDefaultKeywords();
    }
}

function getDefaultKeywords() {
    const defaultConfig = {
        "停課": { enabled: true, keywords: ["停課", "取消", "暫停", "休息", "放假", "請假"] },
        "體驗": { enabled: true, keywords: ["體驗", "體驗課", "體驗班"] },
        "代課": { enabled: true, keywords: ["代課", "代理", "支援"] },
        "補課": { enabled: true, keywords: ["補課", "調課", "延後", "提前", "改時間"] }
    };
    const allKeywords = [];
    for (const config of Object.values(defaultConfig)) {
        if (config.enabled) allKeywords.push(...config.keywords);
    }
    return { allKeywords, byType: defaultConfig };
}

function normalizeEventDateValue(value) {
    if (!value) return null;
    if (value instanceof Date) {
        try {
            return value.toISOString();
        } catch (error) {
            return null;
        }
    }
    if (typeof value === 'number') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date.toISOString();
    }
    if (typeof value === 'string') {
        return value;
    }
    if (value && typeof value.toISOString === 'function') {
        try {
            return value.toISOString();
        } catch (error) {
            return null;
        }
    }
    return null;
}

function formatTimeSegment(token) {
    if (!token) return '';
    const str = String(token);
    if (str.includes(':')) {
        const parts = str.split(':');
        return parts[0].padStart(2, '0') + ':' + (parts[1] || '00').padStart(2, '0');
    }
    if (str.length === 4) {
        return str.slice(0, 2) + ':' + str.slice(2);
    }
    if (str.length === 3) {
        return '0' + str.charAt(0) + ':' + str.slice(1);
    }
    return str;
}

function derivePeriodFromParsed(student) {
    if (!student || !student.periodParsed) return '';
    const parsed = student.periodParsed;
    let weekday = '';
    if (Array.isArray(parsed.weekdays) && parsed.weekdays.length > 0) {
        weekday = parsed.weekdays[0];
    } else if (parsed.weekday) {
        weekday = parsed.weekday;
    }
    const start = formatTimeSegment(parsed.startTime || parsed.start_time);
    const end = formatTimeSegment(parsed.endTime || parsed.end_time);
    if (weekday && start && end) {
        return `${weekday} ${start}-${end}`;
    }
    if (start && end) {
        return `${start}-${end}`;
    }
    return '';
}

function normalizeLocationLabel(value) {
    if (!value) return '';
    return value.toString().replace(/\s+/g, '').replace(/[：:]/g, '').toLowerCase();
}

function parseCourseMeta(source) {
    if (!source || typeof window === 'undefined') return null;
    const parser = (window.FLB && window.FLB.CourseTitleParser) || window.CourseTitleParser;
    if (!parser || typeof parser.parse !== 'function') return null;
    try {
        return parser.parse(source);
    } catch (error) {
        console.warn('⚠️ CourseTitleParser.parse 失敗:', error.message);
        return null;
    }
}

function buildEventPayload(course, time, meta = {}) {
    const parsed = parseCourseMeta(meta.title || '');
    const fallbackTitle = (meta.title || `${course || ''} ${time || ''}`).trim();
    const normalizedStart = normalizeEventDateValue(meta.start);
    const normalizedEnd = normalizeEventDateValue(meta.end);
    return {
        title: fallbackTitle,
        courseName: course,
        start: normalizedStart,
        end: normalizedEnd,
        location: meta.location || (parsed && parsed.location) || '',
        description: meta.description || ''
    };
}

function extractLocationFromText(text) {
    if (!text) return '';
    const parsed = parseCourseMeta(text);
    if (parsed && parsed.location) {
        return parsed.location;
    }
    if (/到府|到宅|到家|家教/gi.test(text)) {
        return '到府';
    }
    if (/站前|松山|內湖|復興|中山|南京|樂程坊/gi.test(text)) {
        return text;
    }
    return '';
}

function extractStudentLocation(student) {
    if (!student) return '';
    if (student.periodParsed && student.periodParsed.location) {
        return student.periodParsed.location;
    }
    if (student.location) {
        return student.location;
    }
    return extractLocationFromText(student.period || '');
}

function matchStudentsWithAdvancedMatcher(students, course, time, options = {}) {
    if (typeof window === 'undefined') return null;
    const matcher = window.FLB && window.FLB.StudentCourseMatcher;
    if (!matcher || typeof matcher.matchStudentsForEvent !== 'function') return null;
    const eventMeta = options.eventMeta;
    if (!eventMeta) return null;
    const eventPayload = buildEventPayload(course, time, eventMeta);
    try {
        const matched = matcher.matchStudentsForEvent(eventPayload, students, {
            withConfidence: true,
            timeTolerance: options.timeTolerance || 10,
            durationTolerance: options.durationTolerance || 20
        });
        if (Array.isArray(matched) && matched.length > 0) {
            matched.forEach(student => {
                student._matchedByAdvanced = true;
            });
            console.log('✅ StudentCourseMatcher 命中學生：', matched.length);
            return matched;
        }
    } catch (error) {
        console.warn('⚠️ StudentCourseMatcher.matchStudentsForEvent 失敗，改用傳統比對:', error);
    }
    return null;
}

function isInCurrentWeek(date) {
    if (!date) return false;
    const targetDate = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(targetDate.getTime())) return false;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);
    return targetDate >= startOfWeek && targetDate <= endOfWeek;
}

async function filterStudentsByCourseAndTime(students, course, time, options = {}) {
    const config = {
        debugMode: options.debugMode || false,
        minRemainingClasses: options.minRemainingClasses !== undefined ? options.minRemainingClasses : 0,
        enableRemainingCheck: options.enableRemainingCheck !== false,
        showInCurrentWeek: options.showInCurrentWeek !== false,
        courseDate: options.courseDate || null,
        timeTolerance: options.timeTolerance,
        durationTolerance: options.durationTolerance,
        eventMeta: options.eventMeta || null
    };
    if (!students || !Array.isArray(students)) {
        console.warn('⚠️ filterStudentsByCourseAndTime: students 參數無效', students);
        return [];
    }
    if (!course || !time) {
        console.warn('⚠️ filterStudentsByCourseAndTime: course 或 time 參數為空', { course, time });
        return [];
    }
    
    console.log('🔍 開始篩選學生:', { course, time, totalStudents: students.length });
    
    const specialKeywords = await getSpecialEventsKeywords();
    const courseMatcher = typeof window !== 'undefined' ? window.CourseStudentMatcher : null;
    const hasSharedNormalizer = courseMatcher && typeof courseMatcher.normalizeTimeFormat === 'function';
    const hasSharedComparer = courseMatcher && typeof courseMatcher.isTimeMatch === 'function';

    let studentsToEvaluate = students;
    const advancedMatched = matchStudentsWithAdvancedMatcher(students, course, time, config);
    if (advancedMatched && advancedMatched.length > 0) {
        studentsToEvaluate = advancedMatched;
    }

    const normalizeTimeFormat = (timeStr) => {
        if (hasSharedNormalizer) {
            return courseMatcher.normalizeTimeFormat(timeStr);
        }
        if (!timeStr) return '';
        return timeStr
            .replace(/\s*第[一二三四五六七八九十\d]+[周週]\s*/gi, '')
            .replace(/\s*Week\s*\d+\s*/gi, '')
            .replace(/\s*week\s*\d+\s*/gi, '')
            .replace(/\s+/g, '')
            .toLowerCase()
            .replace(/(\d{1,2}):(\d{2})/g, (match, h, m) => h.padStart(2, '0') + m);
    };

    const extractBaseTime = (timeStr) => {
        let result = timeStr;
        result = result.replace(/^[A-Za-z0-9\s]+(?=[一二三四五六日]|$)/, '');
        result = result.replace(/\s*第\d+[周週]\s*/g, '');
        if (specialKeywords && specialKeywords.allKeywords) {
            const keywordsPattern = specialKeywords.allKeywords
                .map(kw => kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                .join('|');
            if (keywordsPattern) {
                const regex = new RegExp(`\\s*(${keywordsPattern})\\s*$`, 'gi');
                result = result.replace(regex, '');
            }
        }
        result = result.replace(/\s+$/, '');
        return result;
    };

    const isTimeMatch = (studentPeriod, targetTime) => {
        if (!studentPeriod || !targetTime) return false;
        if (hasSharedComparer) {
            return courseMatcher.isTimeMatch(studentPeriod, targetTime);
        }
        const cleanStudentPeriod = normalizeTimeFormat(studentPeriod);
        const cleanTargetTime = normalizeTimeFormat(targetTime);
        const baseStudentPeriod = extractBaseTime(cleanStudentPeriod);
        const baseTargetTime = extractBaseTime(cleanTargetTime);
        const exactMatch = cleanStudentPeriod === cleanTargetTime;
        const startsWith = cleanStudentPeriod && cleanTargetTime && cleanStudentPeriod.startsWith(cleanTargetTime) && cleanStudentPeriod.length > cleanTargetTime.length;
        const baseMatch = baseStudentPeriod && baseTargetTime && baseStudentPeriod === baseTargetTime;
        return exactMatch || startsWith || baseMatch;
    };
    const normalizeFunc = window.NormalizeUtils?.normalizeCourseName || function(s) { 
        return String(s || '').trim().replace(/\s+/g, '').toLowerCase(); 
    };
    const targetCourseNormalized = normalizeFunc(course);

    const targetLocationLabel = normalizeLocationLabel(config.eventMeta?.location || '');

    const filteredStudents = studentsToEvaluate.filter((student, index) => {
        // 🔥 添加詳細的個別學生篩選日誌
        if (config.debugMode) {
            console.log(`\n📋 檢查學生 [${index + 1}/${students.length}]: ${student.name}`, {
                course: student.course,
                period: student.period,
                remaining: student.remaining,
                type: student.type
            });
        }
        
        // 🔥 容錯處理：如果學生缺少 course 欄位，一律跳過
        if (!student.course) {
            warnStudentOnce(student.name, '缺少 course 欄位');
            return false;
        }
        const matchedByAdvanced = !!student._matchedByAdvanced;
        const effectiveStudentPeriod = student.period || derivePeriodFromParsed(student);
        if (!effectiveStudentPeriod || String(effectiveStudentPeriod).trim().length === 0) {
            warnStudentOnce(student.name, '缺少 period 欄位');
            return false;
        }

        // 🔥 修復：補課學生和體驗學生跳過剩餘堂數檢查
        let hasRemainingClasses = true;
        const isMakeupOrTrial = student.type === 'makeup' || student.type === 'trial';
        
        if (isMakeupOrTrial && config.debugMode) {
            console.log(`   🟢 ${student.type === 'makeup' ? '補課' : '體驗'}學生，跳過剩餘堂數檢查:`, student.name);
        }
        
        if (config.enableRemainingCheck && !isMakeupOrTrial) {
            const remaining = student.remaining || 0;
            hasRemainingClasses = remaining >= config.minRemainingClasses;
            if (config.debugMode) {
                console.log(`   剩餘堂數檢查: ${remaining} >= ${config.minRemainingClasses} = ${hasRemainingClasses}`);
            }
            if (!hasRemainingClasses && config.showInCurrentWeek) {
                let lastAttendanceDate = student.lastAttendanceDate || student.last_attendance_date;
                if (!lastAttendanceDate && student.attendance && Array.isArray(student.attendance) && student.attendance.length > 0) {
                    const presentRecords = student.attendance.filter(record => record.present === true);
                    if (presentRecords.length > 0) {
                        presentRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
                        lastAttendanceDate = presentRecords[0].date;
                    }
                }
                if (lastAttendanceDate) {
                    const attendanceDate = new Date(lastAttendanceDate);
                    const now = new Date();
                    const daysDiff = Math.floor((now - attendanceDate) / (1000 * 60 * 60 * 24));
                    if (daysDiff <= 7) {
                        hasRemainingClasses = true;
                        if (config.debugMode) {
                            console.log(`   當週持續顯示: 上次簽到 ${daysDiff} 天前 → 繼續顯示`);
                        }
                    }
                }
            }
        }
        
        const normalizedStudentCourse = normalizeFunc(student.course);
        let courseMatch = matchedByAdvanced ? true : (normalizedStudentCourse === targetCourseNormalized);
        
        if (config.debugMode) {
            console.log(`   課程比對: "${normalizedStudentCourse}" === "${targetCourseNormalized}" = ${courseMatch}`);
        }

        if (!courseMatch && effectiveStudentPeriod) {
            const normalizedPeriod = normalizeFunc(effectiveStudentPeriod);
            courseMatch = normalizedPeriod.startsWith(targetCourseNormalized);
            if (config.debugMode && courseMatch) {
                console.log(`   課程比對(period開頭): "${normalizedPeriod}".startsWith("${targetCourseNormalized}") = true`);
            }
        }
        if (!courseMatch && effectiveStudentPeriod) {
            const normalizedPeriod = normalizeFunc(effectiveStudentPeriod);
            if (normalizedPeriod.startsWith(targetCourseNormalized) && targetCourseNormalized.startsWith(normalizedStudentCourse)) {
                courseMatch = true;
                if (config.debugMode) {
                    console.log(`   課程比對(雙向匹配): true`);
                }
            }
        }
        
        let timeMatch = matchedByAdvanced ? true : false;
        if (!matchedByAdvanced && effectiveStudentPeriod) {
            timeMatch = isTimeMatch(effectiveStudentPeriod, time);
            
            if (config.debugMode) {
                const cleanStudentPeriod = normalizeTimeFormat(effectiveStudentPeriod);
                const cleanTargetTime = normalizeTimeFormat(time);
                const baseStudentPeriod = extractBaseTime(cleanStudentPeriod);
                const baseTargetTime = extractBaseTime(cleanTargetTime);
                
                console.log(`   時間正規化:`);
                console.log(`     學生: "${effectiveStudentPeriod}" → "${cleanStudentPeriod}"`);
                console.log(`     目標: "${time}" → "${cleanTargetTime}"`);
                console.log(`   基礎時間提取:`);
                console.log(`     學生: "${cleanStudentPeriod}" → "${baseStudentPeriod}"`);
                console.log(`     目標: "${cleanTargetTime}" → "${baseTargetTime}"`);
                console.log(`   使用共用模組: ${hasSharedComparer}`);
                console.log(`   時間比對結果: ${timeMatch}`);
            }
        }
        
        let locationMatch = true;
        const targetLocationLabel = normalizeLocationLabel(config.eventMeta?.location || '');
        if (!matchedByAdvanced && targetLocationLabel) {
            const studentLocationLabel = normalizeLocationLabel(extractStudentLocation(student));
            if (studentLocationLabel) {
                locationMatch =
                    studentLocationLabel === targetLocationLabel ||
                    studentLocationLabel.indexOf(targetLocationLabel) !== -1 ||
                    targetLocationLabel.indexOf(studentLocationLabel) !== -1;
            } else {
                locationMatch = false;
            }
            if (config.debugMode) {
                console.log(`   地點比對: 學生="${studentLocationLabel}" 事件="${targetLocationLabel}" -> ${locationMatch}`);
            }
        }

        const finalResult = hasRemainingClasses && courseMatch && timeMatch && locationMatch;
        
        if (config.debugMode) {
            console.log(`   ✅ 最終判定: 剩餘堂數(${hasRemainingClasses}) && 課程匹配(${courseMatch}) && 時間匹配(${timeMatch}) && 地點匹配(${locationMatch}) = ${finalResult}\n`);
        }
        
        return finalResult;
    });
    
    filteredStudents.forEach(student => {
        if (student._matchedByAdvanced) {
            delete student._matchedByAdvanced;
        }
    });

    console.log('✅ 篩選完成:', {
        targetCourse: course,
        targetTime: time,
        totalStudents: students.length,
        candidatesAfterMatcher: studentsToEvaluate.length,
        filteredCount: filteredStudents.length,
        filteredNames: filteredStudents.map(s => s.name).join(', ')
    });
    
    return filteredStudents;
}

async function getStudentFilterConfig() {
    try {
        const cached = localStorage.getItem('student_filter_config');
        const cacheTime = localStorage.getItem('student_filter_config_time');
        if (cached && cacheTime) {
            const age = Date.now() - parseInt(cacheTime);
            if (age < 5 * 60 * 1000) return JSON.parse(cached);
        }
        const response = await fetch('/api/student-filter-config');
        const result = await response.json();
        if (result.success && result.data) {
            localStorage.setItem('student_filter_config', JSON.stringify(result.data));
            localStorage.setItem('student_filter_config_time', Date.now().toString());
            return result.data;
        }
        return {
            debugMode: false,
            minRemainingClasses: 0,
            enableRemainingCheck: true,
            showInCurrentWeek: true
        };
    } catch (error) {
        console.warn('⚠️ 獲取學生篩選配置失敗，使用預設值:', error);
        return {
            debugMode: false,
            minRemainingClasses: 0,
            enableRemainingCheck: true,
            showInCurrentWeek: true
        };
    }
}

async function filterStudentsWithConfig(students, course, time, optionsOverride = {}) {
    const config = await getStudentFilterConfig();
    const { eventMeta = null, ...rest } = optionsOverride || {};
    const finalOptions = { ...config, ...rest, eventMeta };
    return filterStudentsByCourseAndTime(students, course, time, finalOptions);
}

// ==================== 🔥 暴露到全域作用域（三個頁面共用） ====================
if (typeof window !== 'undefined') {
    // 🔥 關鍵：暴露篩選函數到全域，讓 main.js、learning-record-upload.js、course-reminder-management.html 都可以使用
    window.filterStudentsByCourseAndTime = filterStudentsByCourseAndTime;
    window.filterStudentsWithConfig = filterStudentsWithConfig;
    window.getStudentFilterConfig = getStudentFilterConfig;
    window.getSpecialEventsKeywords = getSpecialEventsKeywords;
    
    console.log('✅ Student Filter 函數已暴露到全域:', {
        filterStudentsByCourseAndTime: typeof window.filterStudentsByCourseAndTime,
        filterStudentsWithConfig: typeof window.filterStudentsWithConfig,
        getStudentFilterConfig: typeof window.getStudentFilterConfig,
        getSpecialEventsKeywords: typeof window.getSpecialEventsKeywords
    });
}

// 標記模組已載入
if (window.LOAD_PROGRESS) { 
    window.LOAD_PROGRESS.updateProgress('Filter');
}
console.error('✅ Student Filter 已載入');
