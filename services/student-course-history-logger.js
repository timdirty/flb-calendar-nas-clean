const fs = require('fs');
const path = require('path');
const GoogleSheetsClient = require('../google-sheets-client');

const RECORD_KEY_HEADER = 'Record Key';
const KEY_COLUMN_LETTER = 'L';

class StudentCourseHistoryLogger {
    constructor(options = {}) {
        this.sheetId = options.spreadsheetId || process.env.COURSE_HISTORY_SPREADSHEET_ID || null;
        this.sheetName = options.sheetName || process.env.COURSE_HISTORY_SHEET_NAME || '學生上過的課';
        const disabled = String(process.env.DISABLE_COURSE_HISTORY_LOGGER || '').toLowerCase() === 'true';
        this.enabled = !disabled;
        this.queue = [];
        this.isProcessing = false;
        this.headerEnsured = false;
        this.recentKeys = [];
        this.maxRecentKeys = options.maxRecentKeys || 200;
        this.client = null;
        this.logsDir = path.join(__dirname, '..', 'logs');
        this.auditLogPath = path.join(this.logsDir, 'student-course-history.log');
        this.ensureLogsDir();
    }

    ensureLogsDir() {
        try {
            if (!fs.existsSync(this.logsDir)) {
                fs.mkdirSync(this.logsDir, { recursive: true });
            }
        } catch (error) {
            console.error('⚠️ 無法建立學生上課紀錄日誌資料夾:', error.message);
        }
    }

    async ensureClient() {
        if (!this.enabled) {
            return false;
        }

        if (!this.client) {
            const clientOptions = this.sheetId ? { spreadsheetId: this.sheetId } : {};
            this.client = new GoogleSheetsClient(clientOptions);
        }

        if (!this.client.sheets) {
            await this.client.initialize();
            if (!this.sheetId) {
                this.sheetId = this.client.SPREADSHEET_ID;
            }
        }

        if (!this.headerEnsured) {
            await this.ensureHeaderRow();
            this.headerEnsured = true;
        }

        return true;
    }

    async ensureHeaderRow() {
        await this.ensureSheetExists();
        const headerRange = `'${this.sheetName}'!A1:L1`;
        try {
            const rows = await this.client.getSheetData(headerRange);
            if (!rows || rows.length === 0 || rows[0].length === 0) {
                await this.client.appendRows(headerRange, [this.getHeaderRow()], 'USER_ENTERED');
                console.log(`✅ 已建立「${this.sheetName}」標題列`);
            } else if ((rows[0][this.getHeaderRow().length - 1] || '').trim() !== RECORD_KEY_HEADER) {
                await this.client.batchUpdate([
                    {
                        range: `'${this.sheetName}'!A1:L1`,
                        values: [this.getHeaderRow()]
                    }
                ], 'USER_ENTERED');
                console.log(`🔄 已更新「${this.sheetName}」標題列，加入 ${RECORD_KEY_HEADER}`);
            }
        } catch (error) {
            console.error('⚠️ 無法檢查學生上課紀錄標題列:', error.message);
            throw error;
        }
    }

    async ensureSheetExists() {
        try {
            const props = await this.client.getSheetProperties(this.sheetName);
            if (!props) {
                await this.client.batchUpdateRequest([
                    {
                        addSheet: {
                            properties: {
                                title: this.sheetName
                            }
                        }
                    }
                ]);
                console.log(`📝 已建立新工作表: ${this.sheetName}`);
            }
        } catch (error) {
            console.error('⚠️ 無法建立學生上課紀錄工作表:', error.message);
            throw error;
        }
    }

    getHeaderRow() {
        return ['Timestamp', 'Date', 'Course Time', 'Student Name', 'Course Category', 'Course Name', 'Course Topic', 'Teacher', 'Source', 'Event ID', 'Lesson URL', RECORD_KEY_HEADER];
    }

    enqueueLog(record = {}) {
        if (!this.enabled) {
            return;
        }
        if (record.attendanceStatus && record.attendanceStatus !== 'present') {
            return;
        }
        const normalized = this.normalizeRecord(record);
        if (!normalized) {
            return;
        }
        const key = normalized.recordKey;
        if (this.recentKeys.includes(key)) {
            return;
        }
        this.queue.push({ normalized, key });
        this.flushQueue();
    }

    normalizeRecord(payload) {
        const studentName = (payload.studentName || '').trim();
        const courseName = (payload.courseName || '').trim();
        if (!studentName || !courseName) {
            return null;
        }
        const normalized = {
            timestamp: new Date().toISOString(),
            date: this.normalizeDate(payload.date),
            courseTime: (payload.courseTime || '').trim(),
            studentName,
            courseCategory: this.normalizeCourseCategory(payload.courseCategory),
            courseName,
            courseTopic: (payload.courseTopic || '').trim(),
            teacher: (payload.teacher || '').trim(),
            source: payload.source || 'fast',
            eventId: (payload.eventId || '').trim(),
            lessonUrl: (payload.lessonUrl || '').trim()
        };
        normalized.recordKey = this.buildRecordKey(normalized);
        return normalized;
    }

    normalizeDate(rawDate) {
        if (!rawDate) {
            return new Date().toISOString().split('T')[0];
        }
        const dateObj = new Date(rawDate);
        if (isNaN(dateObj.getTime())) {
            return rawDate;
        }
        return dateObj.toISOString().split('T')[0];
    }

    async flushQueue() {
        if (this.isProcessing) {
            return;
        }
        this.isProcessing = true;
        while (this.queue.length > 0) {
            const batch = this.queue.splice(0, 10);
            try {
                const ready = await this.ensureClient();
                if (!ready) {
                    break;
                }
                const values = batch.map(({ normalized }) => this.toRow(normalized));
                await this.client.appendRows(`'${this.sheetName}'!A1`, values, 'USER_ENTERED');
                batch.forEach(({ key }) => this.pushRecentKey(key));
                batch.forEach(({ normalized }) => this.writeAuditLog('append', normalized));
                console.log(`✅ 已寫入 ${values.length} 筆學生上過課紀錄`);
            } catch (error) {
                console.error('❌ 寫入學生上課紀錄失敗:', error.message);
            }
        }
        this.isProcessing = false;
    }

    toRow(record) {
        return [
            record.timestamp,
            record.date,
            record.courseTime,
            record.studentName,
            record.courseCategory,
            record.courseName,
            record.courseTopic,
            record.teacher,
            record.source,
            record.eventId,
            record.lessonUrl,
            record.recordKey || this.buildRecordKey(record)
        ];
    }

    pushRecentKey(key) {
        this.recentKeys.push(key);
        if (this.recentKeys.length > this.maxRecentKeys) {
            this.recentKeys.splice(0, this.recentKeys.length - this.maxRecentKeys);
        }
    }

    buildRecordKey(record) {
        return `${record.date}|${record.studentName}|${record.courseName}|${record.courseTopic}`;
    }

    normalizeCourseCategory(category) {
        if (!category) {
            return '';
        }
        const normalized = String(category)
            .replace(/[\u3000]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!normalized) {
            return '';
        }
        const aliasTarget = normalized.replace(/課程?$/i, '').trim();
        if (aliasTarget.toUpperCase() === 'SPIKE') {
            return 'SPIKE';
        }
        return normalized;
    }

    removeKeyFromCache(key) {
        this.recentKeys = this.recentKeys.filter(item => item !== key);
    }

    async removeRecord(record = {}) {
        if (!this.enabled) {
            return;
        }
        const normalized = this.normalizeRecord(record);
        if (!normalized) {
            return;
        }
        const ready = await this.ensureClient();
        if (!ready) {
            return;
        }
        const key = normalized.recordKey;
        try {
            const rowNumber = await this.findRowNumberByKey(key);
            if (rowNumber === -1) {
                console.log('ℹ️ 未在 Google Sheet 找到對應紀錄，無需刪除');
                this.removeKeyFromCache(key);
                return;
            }
            const sheetProps = await this.client.getSheetProperties(this.sheetName);
            if (!sheetProps) {
                console.warn('⚠️ 無法取得工作表資訊，刪除動作中止');
                return;
            }
            await this.client.batchUpdateRequest([
                {
                    deleteDimension: {
                        range: {
                            sheetId: sheetProps.sheetId,
                            dimension: 'ROWS',
                            startIndex: rowNumber - 1,
                            endIndex: rowNumber
                        }
                    }
                }
            ]);
            this.removeKeyFromCache(key);
            this.writeAuditLog('remove', { ...normalized, rowNumber });
            console.log(`🗑️ 已刪除學生上課紀錄 (Row ${rowNumber})`);
        } catch (error) {
            console.error('❌ 刪除學生上課紀錄失敗:', error.message);
            this.writeAuditLog('remove-error', { error: error.message, recordKey: key });
        }
    }

    async findRowNumberByKey(key) {
        const keyRange = `'${this.sheetName}'!${KEY_COLUMN_LETTER}2:${KEY_COLUMN_LETTER}`;
        const rows = await this.client.getSheetData(keyRange);
        if (!rows || rows.length === 0) {
            return -1;
        }
        for (let index = 0; index < rows.length; index++) {
            const value = (rows[index][0] || '').trim();
            if (value === key) {
                return index + 2; // offset for header row
            }
        }
        return -1;
    }

    async fetchRecords(filters = {}) {
        const ready = await this.ensureClient();
        if (!ready) {
            return [];
        }
        const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 200, 1), 1000);
        const range = `'${this.sheetName}'!A2:L${limit + 1}`;
        const rows = await this.client.getSheetData(range);
        if (!rows || rows.length === 0) {
            return [];
        }
        const records = rows
            .map(row => this.rowToRecord(row))
            .filter(Boolean);
        const filtered = records.filter(record => this.filterRecord(record, filters));
        return filtered.slice(0, limit);
    }

    rowToRecord(row = []) {
        const header = this.getHeaderRow();
        const record = {
            timestamp: row[0] || '',
            date: row[1] || '',
            courseTime: row[2] || '',
            studentName: row[3] || '',
            courseCategory: row[4] || '',
            courseName: row[5] || '',
            courseTopic: row[6] || '',
            teacher: row[7] || '',
            source: row[8] || '',
            eventId: row[9] || '',
            lessonUrl: row[10] || '',
            recordKey: row[11] || ''
        };
        if (!record.recordKey) {
            record.recordKey = this.buildRecordKey(record);
        }
        return record;
    }

    filterRecord(record, filters) {
        const startDate = filters.startDate ? new Date(filters.startDate) : null;
        const endDate = filters.endDate ? new Date(filters.endDate) : null;
        if (startDate && !isNaN(startDate) && record.date) {
            const recordDate = new Date(record.date);
            if (!isNaN(recordDate) && recordDate < startDate) {
                return false;
            }
        }
        if (endDate && !isNaN(endDate) && record.date) {
            const recordDate = new Date(record.date);
            if (!isNaN(recordDate) && recordDate > endDate) {
                return false;
            }
        }
        const studentFilter = (filters.student || '').trim().toLowerCase();
        if (studentFilter && record.studentName.toLowerCase().indexOf(studentFilter) === -1) {
            return false;
        }
        const courseFilter = (filters.course || '').trim().toLowerCase();
        if (courseFilter && record.courseName.toLowerCase().indexOf(courseFilter) === -1) {
            return false;
        }
        const topicFilter = (filters.topic || '').trim().toLowerCase();
        if (topicFilter && record.courseTopic.toLowerCase().indexOf(topicFilter) === -1) {
            return false;
        }
        const teacherFilter = (filters.teacher || '').trim().toLowerCase();
        if (teacherFilter && record.teacher.toLowerCase().indexOf(teacherFilter) === -1) {
            return false;
        }
        const categoryFilter = (filters.courseCategory || '').trim();
        if (categoryFilter && categoryFilter !== 'all') {
            if ((record.courseCategory || '').toLowerCase() !== categoryFilter.toLowerCase()) {
                return false;
            }
        }
        if (filters.source && filters.source !== 'all' && record.source !== filters.source) {
            return false;
        }
        return true;
    }

    async readAuditLog(options = {}) {
        const limit = Math.min(Math.max(parseInt(options.limit, 10) || 50, 1), 500);
        if (!fs.existsSync(this.auditLogPath)) {
            return [];
        }
        try {
            const content = fs.readFileSync(this.auditLogPath, 'utf8');
            const lines = content.split('\n').filter(Boolean);
            const recent = lines.slice(-limit);
            return recent.map(line => {
                try {
                    return JSON.parse(line);
                } catch (error) {
                    return { raw: line, error: error.message };
                }
            }).reverse();
        } catch (error) {
            console.error('⚠️ 讀取學生上課紀錄 audit log 失敗:', error.message);
            return [];
        }
    }

    clearCache(options = {}) {
        this.queue = [];
        this.recentKeys = [];
        this.isProcessing = false;
        this.writeAuditLog('clear-cache', {
            reason: options.reason || '',
            requestedBy: options.requestedBy || 'system'
        });
        console.log('🧹 已清除學生上課紀錄快取');
        return {
            clearedAt: new Date().toISOString()
        };
    }

    writeAuditLog(action, payload = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            action,
            recordKey: payload.recordKey || this.buildRecordKey(payload),
            studentName: payload.studentName || '',
            courseName: payload.courseName || '',
            courseTopic: payload.courseTopic || '',
            courseCategory: payload.courseCategory || '',
            date: payload.date || '',
            source: payload.source || '',
            teacher: payload.teacher || '',
            details: payload
        };
        try {
            fs.appendFile(this.auditLogPath, JSON.stringify(entry) + '\n', () => {});
        } catch (error) {
            console.error('⚠️ 寫入學生上課紀錄 audit log 失敗:', error.message);
        }
    }
}

module.exports = StudentCourseHistoryLogger;
