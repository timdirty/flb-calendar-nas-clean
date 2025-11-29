const path = require('path');
const axios = require('axios');
const schedule = require('node-schedule');
const safeFileOps = require('./utils/safe-file-operations');
const { Logger } = require('./utils/logger');
const notionLogger = new Logger({ level: process.env.NOTION_SYNC_LOG_LEVEL || 'INFO' });

const DEFAULT_CONFIG = {
    databaseId: '',
    databaseUrl: '',
    integrationName: '',
    instructorProperty: '',
    autoSyncEnabled: false,
    autoSyncInterval: 60,
    conflictStrategy: 'manual',
    syncRange: 'upcoming',
    lastSync: null,
    connectionStatus: 'pending',
    connectionMessage: '尚未檢查連線'
};

class NotionCourseSyncManager {
    constructor(options = {}) {
        this.configPath = options.configPath || path.join(__dirname, 'data/notion-course-sync-config.json');
        this.mappingPath = options.mappingPath || path.join(__dirname, 'data/notion-course-sync-mappings.json');
        this.coursePath = options.coursePath || path.join(__dirname, 'data/notion-course-catalog.json');
        this.logPath = options.logPath || path.join(__dirname, 'logs/notion-course-sync-log.json');

        this.memoryLogs = [];
        this.maxMemoryLogs = 200;

        this.config = { ...DEFAULT_CONFIG };
        this.mappings = [];
        this.propertyCache = new Map(); // propertyId -> { id, name, type }
        this.autoSyncJob = null;
        this.autoSyncRule = null;
        this.autoSyncLabel = 'NotionCourseSyncAutoJob';
        this.syncInProgress = false;
        this.secretOverride = options.secretOverride || null;
    }

    async initialize() {
        try {
            this.config = await safeFileOps.readJSON(this.configPath, { ...DEFAULT_CONFIG });
            this.mappings = await safeFileOps.readJSON(this.mappingPath, []);
            const logData = await safeFileOps.readJSON(this.logPath, { logs: [] });
            this.memoryLogs = Array.isArray(logData?.logs) ? logData.logs.slice(0, this.maxMemoryLogs) : [];

            if (!this.secretOverride) {
                this.secretOverride = process.env.NOTION_API_SECRET || process.env.NOTION_TOKEN || null;
            }

            await this.refreshAutoSyncSchedule();

            notionLogger.success('Notion 課程同步管理器初始化完成');
        } catch (error) {
            notionLogger.error('初始化 Notion 課程同步管理器失敗:', error);
        }
    }

    getSecret() {
        const secret = this.secretOverride || process.env.NOTION_API_SECRET || process.env.NOTION_TOKEN || '';
        if (!secret) {
            throw new Error('缺少 Notion API 金鑰，請在 .env.nas 設定 NOTION_API_SECRET');
        }
        return secret;
    }

    hasSecret() {
        return Boolean(this.secretOverride || process.env.NOTION_API_SECRET || process.env.NOTION_TOKEN);
    }

    setSecret(secret) {
        this.secretOverride = secret || null;
    }

    async getConfig(options = {}) {
        const includeProperties = options.includeProperties !== false;
        let availableProperties = [];

        if (includeProperties) {
            try {
                availableProperties = await this.fetchDatabaseProperties({
                    forceRefresh: Boolean(options.forceRefreshProperties)
                });
            } catch (error) {
                notionLogger.warn('取得 Notion 欄位時發生錯誤:', error.message);
            }
        }

        return {
            ...this.config,
            mappings: this.mappings,
            availableProperties,
            hasSecret: this.hasSecret()
        };
    }

    async saveConfig(updates = {}) {
        const nextConfig = {
            ...this.config,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        if (!nextConfig.databaseId && nextConfig.databaseUrl) {
            const extractedId = this.extractDatabaseId(nextConfig.databaseUrl);
            if (extractedId) {
                nextConfig.databaseId = extractedId;
            }
        }

        if (nextConfig.autoSyncInterval && Number(nextConfig.autoSyncInterval) < 5) {
            nextConfig.autoSyncInterval = 5;
        }

        this.config = nextConfig;
        await safeFileOps.writeJSON(this.configPath, this.config);
        await this.refreshAutoSyncSchedule();
        await this.appendLog('info', '更新同步設定', { updates: nextConfig });

        return this.config;
    }

    async saveMappings(mappings = []) {
        if (!Array.isArray(mappings)) {
            throw new Error('欄位對應資料格式不正確');
        }
        this.mappings = mappings;
        await safeFileOps.writeJSON(this.mappingPath, mappings);
        await this.appendLog('info', '儲存欄位對應', { count: mappings.length });
        return mappings;
    }

    async clearLogs() {
        this.memoryLogs = [];
        await safeFileOps.writeJSON(this.logPath, { logs: [] });
        notionLogger.info('🧹 清除 Notion 同步紀錄完成');
    }

    async getLogs(limit = 100) {
        if (!this.memoryLogs.length) {
            const logData = await safeFileOps.readJSON(this.logPath, { logs: [] });
            this.memoryLogs = Array.isArray(logData?.logs) ? logData.logs : [];
        }
        return this.memoryLogs.slice(0, limit);
    }

    async testConnection({ databaseId, databaseUrl } = {}) {
        const notionSecret = this.getSecret();
        const targetDatabaseId = databaseId || this.config.databaseId || this.extractDatabaseId(databaseUrl || this.config.databaseUrl);

        if (!targetDatabaseId) {
            throw new Error('尚未設定 Notion 資料庫 ID');
        }

        const response = await axios.get(`https://api.notion.com/v1/databases/${targetDatabaseId}`, {
            headers: this.buildHeaders(notionSecret)
        });

        const dbTitle = this.parseDatabaseTitle(response.data);
        await this.appendLog('info', 'Notion 連線測試成功', { databaseId: targetDatabaseId, title: dbTitle });

        this.config.connectionStatus = 'ready';
        this.config.connectionMessage = `連線成功：${dbTitle || targetDatabaseId}`;
        await safeFileOps.writeJSON(this.configPath, this.config);

        return {
            databaseId: targetDatabaseId,
            title: dbTitle,
            raw: response.data
        };
    }

    async fetchDatabaseProperties({ forceRefresh = false } = {}) {
        const databaseId = this.config.databaseId;
        if (!databaseId) {
            return [];
        }

        if (this.propertyCache.size && !forceRefresh) {
            return Array.from(this.propertyCache.values());
        }

        try {
            const notionSecret = this.getSecret();
            const response = await axios.get(`https://api.notion.com/v1/databases/${databaseId}`, {
                headers: this.buildHeaders(notionSecret)
            });

            const properties = response.data?.properties || {};
            const list = Object.entries(properties).map(([name, detail]) => ({
                id: detail.id,
                name,
                type: detail.type
            }));

            this.propertyCache.clear();
            list.forEach(item => {
                this.propertyCache.set(item.id, item);
            });

            return list;
        } catch (error) {
            notionLogger.error('取得 Notion 欄位失敗:', error.message);
            throw error;
        }
    }

    async syncFromNotion(options = {}) {
        const notionSecret = this.getSecret();
        const databaseId = this.config.databaseId;
        if (!databaseId) {
            throw new Error('尚未設定 Notion 資料庫 ID');
        }

        await this.ensureProperties();

        const remotePages = await this.fetchAllPages({
            notionSecret,
            databaseId,
            syncRange: options.syncRange || this.config.syncRange
        });

        const remoteCourses = remotePages.map(page => this.convertPageToCourse(page));
        const { courses: localCourses } = await this.getLocalCourses();

        const mergeResult = this.mergeRemoteCoursesIntoLocal(remoteCourses, localCourses);
        await this.saveLocalCourses(mergeResult.mergedCourses);

        const summary = {
            created: mergeResult.created,
            updated: mergeResult.updated,
            unchanged: mergeResult.unchanged,
            untouchedLocal: mergeResult.untouchedLocal
        };

        this.config.lastSync = {
            timestamp: new Date().toISOString(),
            direction: 'pull',
            status: 'success',
            summary
        };
        await safeFileOps.writeJSON(this.configPath, this.config);

        await this.appendLog('info', '完成 Notion → 系統同步', summary);

        return summary;
    }

    async syncToNotion(options = {}) {
        const notionSecret = this.getSecret();
        const databaseId = this.config.databaseId;
        if (!databaseId) {
            throw new Error('尚未設定 Notion 資料庫 ID');
        }

        await this.ensureProperties();

        const { courses: localCourses } = await this.getLocalCourses();
        if (!localCourses.length) {
            throw new Error('本地無可同步的課程資料');
        }

        const syncableMappings = this.mappings.filter(item => item && (item.direction === 'push' || item.direction === 'both'));
        if (!syncableMappings.length) {
            throw new Error('尚未設定可匯出的欄位對應（方向需為雙向或僅匯出）');
        }

        const summary = { created: 0, updated: 0, skipped: 0 };
        const updatedLocalCourses = [...localCourses];
        const pageMap = await this.fetchExistingPagesMap({ notionSecret, databaseId, mappings: syncableMappings });

        for (let i = 0; i < updatedLocalCourses.length; i++) {
            const course = updatedLocalCourses[i];
            const courseKey = this.getCourseKey(course);
            const payload = this.buildNotionPropertyPayload(course, syncableMappings);

            if (!payload || Object.keys(payload).length === 0) {
                summary.skipped++;
                continue;
            }

            try {
                if (course.notionPageId || pageMap.has(courseKey)) {
                    const pageId = course.notionPageId || pageMap.get(courseKey);
                    await axios.patch(`https://api.notion.com/v1/pages/${pageId}`, {
                        properties: payload
                    }, {
                        headers: this.buildHeaders(notionSecret)
                    });
                    updatedLocalCourses[i] = {
                        ...course,
                        notionPageId: pageId,
                        lastPushedAt: new Date().toISOString()
                    };
                    summary.updated++;
                } else {
                    const response = await axios.post('https://api.notion.com/v1/pages', {
                        parent: { database_id: databaseId },
                        properties: payload
                    }, {
                        headers: this.buildHeaders(notionSecret)
                    });

                    updatedLocalCourses[i] = {
                        ...course,
                        notionPageId: response.data?.id,
                        lastPushedAt: new Date().toISOString()
                    };
                    summary.created++;
                }
            } catch (error) {
                summary.skipped++;
                await this.appendLog('error', '同步課程至 Notion 失敗', {
                    courseKey,
                    message: error.message
                });
            }
        }

        await this.saveLocalCourses(updatedLocalCourses);
        this.config.lastSync = {
            timestamp: new Date().toISOString(),
            direction: 'push',
            status: 'success',
            summary
        };
        await safeFileOps.writeJSON(this.configPath, this.config);
        await this.appendLog('info', '完成 系統 → Notion 同步', summary);

        return summary;
    }

    async previewDiff() {
        const notionSecret = this.getSecret();
        const databaseId = this.config.databaseId;
        if (!databaseId) {
            throw new Error('尚未設定 Notion 資料庫 ID');
        }

        await this.ensureProperties();

        const { courses: localCourses } = await this.getLocalCourses();
        const remotePages = await this.fetchAllPages({ notionSecret, databaseId });
        const remoteCourses = remotePages.map(page => this.convertPageToCourse(page));

        const diff = this.computeDiff(localCourses, remoteCourses);
        await this.appendLog('info', '產生同步差異預覽', {
            totalDiffs: diff.totalDiffs,
            localOnly: diff.localOnly.length,
            remoteOnly: diff.remoteOnly.length,
            conflicts: diff.conflicts.length
        });

        return diff;
    }

    async refreshAutoSyncSchedule() {
        // 🔧 開發環境控制：禁用自動同步
        if (process.env.DISABLE_AUTO_REMINDERS === 'true') {
            notionLogger.info('⚠️ [Notion 同步] 已禁用自動同步（開發模式）');
            notionLogger.info('   手動 API 仍可使用：/api/notion/sync');
            return;
        }

        if (this.autoSyncJob) {
            try {
                this.autoSyncJob.cancel();
            } catch (error) {
                try {
                    schedule.cancelJob(this.autoSyncJob);
                } catch (cancelError) {
                    notionLogger.warn('取消既有自動同步排程時發生警告:', cancelError.message);
                }
            }
            this.autoSyncJob = null;
            notionLogger.info('⏹️ 已關閉 Notion 自動同步排程');
        }

        if (!this.config.autoSyncEnabled) {
            return;
        }

        if (!this.config.databaseId) {
            notionLogger.warn('尚未設定 Notion 資料庫 ID，無法啟動自動同步');
            return;
        }

        const intervalMinutes = Math.max(5, Number(this.config.autoSyncInterval) || 60);
        const rule = new schedule.RecurrenceRule();
        rule.minute = new schedule.Range(0, 59, intervalMinutes);

        this.autoSyncJob = schedule.scheduleJob(this.autoSyncLabel, rule, async () => {
            if (this.syncInProgress) {
                notionLogger.warn('⚠️ 自動同步已在進行中，跳過此次排程');
                return;
            }

            this.syncInProgress = true;
            notionLogger.schedule('Notion 雙向同步', 'start');
            try {
                await this.syncFromNotion({ triggeredBy: 'auto' });
                notionLogger.schedule('Notion 雙向同步', 'done');
            } catch (error) {
                notionLogger.error('自動同步失敗:', error.message);
                await this.appendLog('error', '自動同步失敗', { message: error.message });
                notionLogger.schedule('Notion 雙向同步', 'error');
            } finally {
                this.syncInProgress = false;
            }
        });

        notionLogger.info(`⏰ 已設定 Notion 自動同步，每 ${intervalMinutes} 分鐘執行一次`);
    }

    // ==================== 輔助方法 ====================

    async ensureProperties() {
        if (this.propertyCache.size === 0) {
            await this.fetchDatabaseProperties({ forceRefresh: true });
        }
    }

    extractDatabaseId(url = '') {
        if (!url) return '';
        const cleaned = url.trim();
        const hyphenPattern = /([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/;
        const plainPattern = /([0-9a-fA-F]{32})/;

        const hyphenMatch = cleaned.match(hyphenPattern);
        if (hyphenMatch) {
            return hyphenMatch[1].replace(/-/g, '');
        }

        const plainMatch = cleaned.match(plainPattern);
        if (plainMatch) {
            return plainMatch[1];
        }

        return '';
    }

    parseDatabaseTitle(database) {
        if (!database?.title || !database.title.length) {
            return '';
        }
        return database.title.map(part => part.plain_text).join('');
    }

    buildHeaders(secret) {
        return {
            'Authorization': `Bearer ${secret}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
        };
    }

    async fetchAllPages({ notionSecret, databaseId, syncRange }) {
        const pages = [];
        let hasMore = true;
        let startCursor = undefined;
        let guard = 0;

        while (hasMore && guard < 50) {
            guard++;
            const response = await axios.post(`https://api.notion.com/v1/databases/${databaseId}/query`, {
                start_cursor: startCursor,
                page_size: 50
            }, {
                headers: this.buildHeaders(notionSecret)
            });

            const results = response.data?.results || [];
            pages.push(...results);
            hasMore = response.data?.has_more;
            startCursor = response.data?.next_cursor;
        }

        return pages;
    }

    convertPageToCourse(page) {
        const course = {
            notionPageId: page.id,
            lastPulledAt: new Date().toISOString()
        };

        const mappingArray = Array.isArray(this.mappings) ? this.mappings : [];

        mappingArray.forEach(mapping => {
            if (!mapping || (mapping.direction !== 'pull' && mapping.direction !== 'both')) {
                return;
            }
            const property = this.findPropertyById(page.properties, mapping.propertyId);
            course[mapping.field] = this.extractPropertyValue(property);
        });

        if (!course.courseCode) {
            course.courseCode = course.title || course.timeRange || course.weekday || `course-${page.id}`;
        }

        course.courseId = this.getCourseKey(course);
        return course;
    }

    findPropertyById(properties, propertyId) {
        if (!properties || !propertyId) return null;
        const list = Object.values(properties);
        return list.find(item => item.id === propertyId) || null;
    }

    extractPropertyValue(property) {
        if (!property) return '';
        const type = property.type;
        switch (type) {
            case 'title':
                return property.title?.map(part => part.plain_text).join('') || '';
            case 'rich_text':
                return property.rich_text?.map(part => part.plain_text).join('') || '';
            case 'select':
                return property.select?.name || '';
            case 'multi_select':
                return property.multi_select?.map(item => item.name).join(', ') || '';
            case 'people':
                return property.people?.map(person => person.name || person.id).join(', ') || '';
            case 'url':
                return property.url || '';
            case 'phone_number':
                return property.phone_number || '';
            case 'email':
                return property.email || '';
            case 'number':
                return property.number ?? '';
            case 'checkbox':
                return property.checkbox ? 'true' : 'false';
            case 'date':
                return property.date?.start || '';
            default:
                return '';
        }
    }

    buildNotionPropertyPayload(course, mappings) {
        const payload = {};

        mappings.forEach(mapping => {
            if (!mapping?.propertyId) return;
            const propertyMeta = this.propertyCache.get(mapping.propertyId);
            if (!propertyMeta) return;

            const value = course[mapping.field];
            const propertyName = propertyMeta.name;
            payload[propertyName] = this.buildPropertyByType(propertyMeta.type, value);
        });

        return payload;
    }

    buildPropertyByType(type, value) {
        const textValue = typeof value === 'number' ? String(value) : (value || '').toString().trim();
        switch (type) {
            case 'title':
                return {
                    title: textValue ? [{
                        type: 'text',
                        text: { content: textValue }
                    }] : []
                };
            case 'rich_text':
                return {
                    rich_text: textValue ? [{
                        type: 'text',
                        text: { content: textValue }
                    }] : []
                };
            case 'select':
                return {
                    select: textValue ? { name: textValue } : null
                };
            case 'multi_select': {
                const values = textValue
                    ? textValue.split(/[,，;]/).map(item => item.trim()).filter(Boolean)
                    : [];
                return {
                    multi_select: values.map(name => ({ name }))
                };
            }
            case 'url':
                return {
                    url: textValue || null
                };
            case 'number': {
                const numberValue = Number(textValue);
                return {
                    number: Number.isNaN(numberValue) ? null : numberValue
                };
            }
            case 'checkbox':
                return {
                    checkbox: textValue === 'true' || textValue === '1' || textValue === '是'
                };
            case 'date': {
                if (!textValue) return { date: null };
                return {
                    date: { start: textValue }
                };
            }
            default:
                return {
                    rich_text: textValue ? [{
                        type: 'text',
                        text: { content: textValue }
                    }] : []
                };
        }
    }

    getCourseKey(course = {}) {
        return (course.courseCode || course.courseId || course.title || course.notionPageId || '').toString();
    }

    mergeRemoteCoursesIntoLocal(remoteCourses, localCourses) {
        const localMap = new Map();
        localCourses.forEach(course => {
            localMap.set(this.getCourseKey(course), course);
        });

        const mergedCourses = [];
        let created = 0;
        let updated = 0;
        let unchanged = 0;

        remoteCourses.forEach(remote => {
            const key = this.getCourseKey(remote);
            const existing = localMap.get(key);

            if (!existing) {
                mergedCourses.push({
                    ...remote,
                    syncState: 'imported',
                    lastPulledAt: new Date().toISOString()
                });
                created++;
                return;
            }

            const merged = {
                ...existing,
                ...remote,
                syncState: 'synced',
                lastPulledAt: new Date().toISOString()
            };

            const isChanged = JSON.stringify(existing) !== JSON.stringify(merged);
            if (isChanged) {
                updated++;
            } else {
                unchanged++;
            }

            mergedCourses.push(merged);
            localMap.delete(key);
        });

        const untouchedLocal = Array.from(localMap.values()).map(item => ({
            ...item,
            syncState: item.syncState || 'local-only'
        }));

        mergedCourses.push(...untouchedLocal);

        return {
            mergedCourses,
            created,
            updated,
            unchanged,
            untouchedLocal: untouchedLocal.length
        };
    }

    computeDiff(localCourses = [], remoteCourses = []) {
        const localMap = new Map();
        const remoteMap = new Map();

        localCourses.forEach(course => {
            localMap.set(this.getCourseKey(course), course);
        });

        remoteCourses.forEach(course => {
            remoteMap.set(this.getCourseKey(course), course);
        });

        const localOnly = [];
        const remoteOnly = [];
        const conflicts = [];

        localMap.forEach((localCourse, key) => {
            if (!remoteMap.has(key)) {
                localOnly.push(localCourse);
            } else {
                const remoteCourse = remoteMap.get(key);
                const diffFields = this.diffCourseFields(localCourse, remoteCourse);
                if (diffFields.length) {
                    conflicts.push({
                        key,
                        fields: diffFields,
                        local: localCourse,
                        remote: remoteCourse
                    });
                }
            }
        });

        remoteMap.forEach((remoteCourse, key) => {
            if (!localMap.has(key)) {
                remoteOnly.push(remoteCourse);
            }
        });

        return {
            totalDiffs: localOnly.length + remoteOnly.length + conflicts.length,
            localOnly,
            remoteOnly,
            conflicts
        };
    }

    diffCourseFields(localCourse, remoteCourse) {
        const diffFields = [];
        const fields = Array.from(new Set([...Object.keys(localCourse), ...Object.keys(remoteCourse)]));
        const ignoreKeys = new Set(['lastPulledAt', 'lastPushedAt', 'syncState', 'notionPageId']);

        fields.forEach(field => {
            if (ignoreKeys.has(field)) return;
            const localValue = localCourse[field] ?? '';
            const remoteValue = remoteCourse[field] ?? '';
            if (localValue !== remoteValue) {
                diffFields.push(field);
            }
        });

        return diffFields;
    }

    async fetchExistingPagesMap({ notionSecret, databaseId, mappings }) {
        const keyFieldMapping = mappings.find(item => item.field === 'courseCode') || mappings[0];
        if (!keyFieldMapping) {
            return new Map();
        }

        const remotePages = await this.fetchAllPages({ notionSecret, databaseId });
        const map = new Map();
        remotePages.forEach(page => {
            const course = this.convertPageToCourse(page);
            map.set(this.getCourseKey(course), page.id);
        });
        return map;
    }

    async getLocalCourses() {
        const data = await safeFileOps.readJSON(this.coursePath, { courses: [], updatedAt: null });
        if (!Array.isArray(data.courses)) {
            data.courses = [];
        }
        return data;
    }

    async saveLocalCourses(courses = []) {
        const payload = {
            courses,
            updatedAt: new Date().toISOString()
        };
        await safeFileOps.writeJSON(this.coursePath, payload);
        return payload;
    }

    async appendLog(level, message, meta = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            meta
        };

        this.memoryLogs.unshift(entry);
        this.memoryLogs = this.memoryLogs.slice(0, this.maxMemoryLogs);

        await safeFileOps.atomicUpdate(this.logPath, async current => {
            const logs = Array.isArray(current?.logs) ? current.logs : [];
            logs.unshift(entry);
            return {
                logs: logs.slice(0, this.maxMemoryLogs),
                updatedAt: new Date().toISOString()
            };
        }, { logs: [] });
    }
}

module.exports = NotionCourseSyncManager;
