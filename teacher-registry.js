const fs = require('fs');
const path = require('path');

const TEACHER_DATA_PATH = path.join(__dirname, 'teacher_data.json');

let cache = null;

function normalizeTeacherName(name) {
    if (!name) {
        return '';
    }

    return name
        .toString()
        .trim()
        .replace(/老師$/gi, '')
        .replace(/老師/gi, '')
        .replace(/\(.*?\)/g, '')
        .replace(/（.*?）/g, '')
        .replace(/[\s\u3000]+/g, '')
        .replace(/[\-_]/g, '')
        .replace(/[\uFE0F\u200D]/g, '')
        .toUpperCase();
}

function safeArray(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()];
    }
    return [];
}

function ensureCache() {
    try {
        const stats = fs.existsSync(TEACHER_DATA_PATH) ? fs.statSync(TEACHER_DATA_PATH) : null;
        const mtime = stats ? stats.mtimeMs : null;

        if (cache && cache.mtime === mtime) {
            return cache;
        }

        const teacherList = [];
        const mapByName = {};
        const mapByLower = {};
        const mapByNormalized = {};
        const mapByUserId = {};

        let rawData = { teachers: [] };

        if (fs.existsSync(TEACHER_DATA_PATH)) {
            const source = fs.readFileSync(TEACHER_DATA_PATH, 'utf8');
            rawData = JSON.parse(source);
        }

        const rawTeachers = Array.isArray(rawData.teachers)
            ? rawData.teachers
            : typeof rawData.teachers === 'object' && rawData.teachers !== null
                ? Object.entries(rawData.teachers).map(([name, value]) => {
                    if (typeof value === 'object' && value !== null) {
                        return {
                            name,
                            userId: value.userId,
                            color: value.color || null,
                            aliases: safeArray(value.aliases)
                        };
                    }
                    return {
                        name,
                        userId: value,
                        color: null,
                        aliases: []
                    };
                })
                : [];

        rawTeachers.forEach((teacher) => {
            if (!teacher || !teacher.name) {
                return;
            }

            const trimmedName = teacher.name.trim();
            
            // ✅ 跳過測試名稱的講師條目（如 "local-test-user"）
            if (trimmedName === 'local-test-user' || trimmedName.startsWith('test-') || trimmedName.startsWith('local-')) {
                console.log(`⚠️ [TeacherRegistry] 跳過測試名稱的講師條目: ${trimmedName}`);
                return;
            }
            
            // ✅ 跳過測試 User ID
            if (teacher.userId && (teacher.userId === 'local-test-user' || teacher.userId.startsWith('test-') || teacher.userId.startsWith('local-'))) {
                console.log(`⚠️ [TeacherRegistry] 跳過測試 User ID 的講師條目: ${trimmedName} (${teacher.userId})`);
                return;
            }

            const normalized = normalizeTeacherName(trimmedName);
            const aliases = safeArray(teacher.aliases);
            const entry = {
                name: trimmedName,
                displayName: trimmedName,
                userId: teacher.userId || null,
                color: teacher.color || null,
                aliases,
                normalizedName: normalized
            };

            teacherList.push(entry);

            mapByName[trimmedName] = entry;
            mapByLower[trimmedName.toLowerCase()] = entry;
            if (entry.userId) {
                mapByUserId[entry.userId] = entry;
            }

            if (!mapByNormalized[normalized] || (!mapByNormalized[normalized].userId && entry.userId)) {
                mapByNormalized[normalized] = entry;
            }

            aliases.forEach((alias) => {
                if (!alias) {
                    return;
                }
                const aliasTrimmed = alias.trim();
                if (!aliasTrimmed) {
                    return;
                }
                const aliasLower = aliasTrimmed.toLowerCase();
                const aliasNormalized = normalizeTeacherName(aliasTrimmed);

                mapByName[aliasTrimmed] = entry;
                mapByLower[aliasLower] = entry;
                if (!mapByNormalized[aliasNormalized] || (!mapByNormalized[aliasNormalized].userId && entry.userId)) {
                    mapByNormalized[aliasNormalized] = entry;
                }
            });
        });

        cache = {
            list: teacherList,
            mapByName,
            mapByLower,
            mapByNormalized,
            mapByUserId,
            rawData,
            mtime
        };

        return cache;
    } catch (error) {
        console.error('❌ 載入 teacher_data.json 失敗:', error);
        cache = {
            list: [],
            mapByName: {},
            mapByLower: {},
            mapByNormalized: {},
            mapByUserId: {},
            rawData: { teachers: [] },
            mtime: null
        };
        return cache;
    }
}

function getTeacherData() {
    const snapshot = ensureCache();

    const teacherMap = {};
    snapshot.list.forEach((entry) => {
        teacherMap[entry.name] = {
            userId: entry.userId || null,
            color: entry.color || null,
            aliases: entry.aliases,
            normalizedName: entry.normalizedName
        };
    });

    return {
        teachers: teacherMap,
        teacherList: snapshot.list.map((entry) => ({
            name: entry.name,
            userId: entry.userId || null,
            color: entry.color || null,
            aliases: entry.aliases,
            normalizedName: entry.normalizedName
        })),
        lastUpdate: snapshot.rawData.last_update || null
    };
}

function getTeacherList() {
    const snapshot = ensureCache();
    return snapshot.list.map((entry) => ({
        name: entry.name,
        userId: entry.userId || null,
        color: entry.color || null,
        aliases: entry.aliases,
        normalizedName: entry.normalizedName
    }));
}

function findTeacherByName(name) {
    if (!name) {
        return null;
    }

    const snapshot = ensureCache();
    const trimmed = name.toString().trim();
    if (!trimmed) {
        return null;
    }

    const lower = trimmed.toLowerCase();
    if (snapshot.mapByName[trimmed]) {
        return snapshot.mapByName[trimmed];
    }

    if (snapshot.mapByLower[lower]) {
        return snapshot.mapByLower[lower];
    }

    const normalized = normalizeTeacherName(trimmed);
    if (snapshot.mapByNormalized[normalized]) {
        return snapshot.mapByNormalized[normalized];
    }

    return null;
}

function findTeacherByUserId(userId) {
    if (!userId) {
        return null;
    }

    const snapshot = ensureCache();
    return snapshot.mapByUserId[userId] || null;
}

function getTeacherNameMap() {
    const snapshot = ensureCache();
    return snapshot.mapByName;
}

function reload() {
    cache = null;
    return ensureCache();
}

module.exports = {
    normalizeTeacherName,
    getTeacherData,
    getTeacherList,
    getTeacherNameMap,
    findTeacherByName,
    findTeacherByUserId,
    reload
};

