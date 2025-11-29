/**
 * 媒體索引管理
 * - 使用 safe-file-operations 實現鎖定寫入
 * - 提供查詢、插入與更新方法
 */

const path = require('path');
const safeFile = require('../../utils/safe-file-operations');

const INDEX_PATH = process.env.LEARNING_MEDIA_INDEX
    ? path.resolve(process.env.LEARNING_MEDIA_INDEX)
    : path.join(__dirname, '..', '..', 'data', 'learning-media', 'index.json');

async function readIndex() {
    const data = await safeFile.readJSON(INDEX_PATH, { files: [] });
    if (!data || typeof data !== 'object') {
        return { files: [] };
    }
    if (!Array.isArray(data.files)) {
        data.files = [];
    }
    return data;
}

async function appendRecord(record) {
    return safeFile.atomicUpdate(
        INDEX_PATH,
        async (current) => {
            const next = Array.isArray(current.files) ? current : { files: [] };
            const files = Array.isArray(next.files) ? next.files.slice() : [];
            files.push(record);
            return { files };
        },
        { files: [] }
    );
}

async function updateRecord(predicate, updater) {
    return safeFile.atomicUpdate(
        INDEX_PATH,
        async (current) => {
            const base = Array.isArray(current?.files) ? current.files.slice() : [];
            const updated = base.map((entry) => {
                if (predicate(entry)) {
                    return { ...entry, ...updater(entry) };
                }
                return entry;
            });
            return { files: updated };
        },
        { files: [] }
    );
}

async function listRecords(filters = {}) {
    const index = await readIndex();
    const files = Array.isArray(index.files) ? index.files : [];
    const entries = files.filter((item) => {
        if (!item) return false;
        if (filters.bucketId && item.bucketId !== filters.bucketId) return false;
        if (filters.studentName && item.studentName !== filters.studentName) return false;
        if (filters.courseName && item.courseName !== filters.courseName) return false;
        if (filters.instructorName && item.instructorName !== filters.instructorName) return false;
        if (filters.dateKey && item.dateKey !== filters.dateKey) return false;
        if (filters.status && item.status !== filters.status) return false;
        return true;
    });
    return entries;
}

async function findRecordById(id) {
    const index = await readIndex();
    const files = Array.isArray(index.files) ? index.files : [];
    return files.find((item) => item && item.id === id) || null;
}

module.exports = {
    INDEX_PATH,
    readIndex,
    appendRecord,
    updateRecord,
    listRecords,
    findRecordById
};
