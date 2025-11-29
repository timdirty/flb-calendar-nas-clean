const path = require('path');
const safeFile = require('../utils/safe-file-operations');

const INDEX_PATH = path.join(__dirname, '..', 'data', 'drive-media-index.json');

async function readIndex() {
  const data = await safeFile.readJSON(INDEX_PATH, { records: [] });
  if (!data || typeof data !== 'object') {
    return { records: [] };
  }
  if (!Array.isArray(data.records)) {
    data.records = [];
  }
  return data;
}

async function appendRecord(record) {
  if (!record || !record.id) {
    throw new Error('appendRecord 需要帶有 id 的 record');
  }
  await safeFile.atomicUpdate(
    INDEX_PATH,
    async (current) => {
      const next = current && typeof current === 'object' ? current : { records: [] };
      const list = Array.isArray(next.records) ? next.records.slice() : [];
      const existsIndex = list.findIndex((item) => item && item.id === record.id);
      if (existsIndex >= 0) {
        list[existsIndex] = { ...list[existsIndex], ...record };
      } else {
        list.push(record);
      }
      return { records: list };
    },
    { records: [] }
  );
  return record;
}

async function findRecordById(id) {
  if (!id) return null;
  const data = await readIndex();
  return data.records.find((item) => item && item.id === id) || null;
}

async function updateRecord(id, updater) {
  if (!id || typeof updater !== 'function') return null;
  let updatedRecord = null;
  await safeFile.atomicUpdate(
    INDEX_PATH,
    async (current) => {
      const next = current && typeof current === 'object' ? current : { records: [] };
      const list = Array.isArray(next.records) ? next.records.slice() : [];
      const idx = list.findIndex((item) => item && item.id === id);
      if (idx >= 0) {
        const original = list[idx];
        const updated = { ...original, ...await updater(original) };
        list[idx] = updated;
        updatedRecord = updated;
      }
      return { records: list };
    },
    { records: [] }
  );
  return updatedRecord;
}

async function removeRecord(id) {
  if (!id) return false;
  let removed = false;
  await safeFile.atomicUpdate(
    INDEX_PATH,
    async (current) => {
      const next = current && typeof current === 'object' ? current : { records: [] };
      const list = Array.isArray(next.records) ? next.records.slice() : [];
      const filtered = list.filter((item) => {
        if (!item) return false;
        if (item.id === id) {
          removed = true;
          return false;
        }
        return true;
      });
      return { records: filtered };
    },
    { records: [] }
  );
  return removed;
}

async function listRecords() {
  const data = await readIndex();
  return data.records;
}

module.exports = {
  INDEX_PATH,
  appendRecord,
  findRecordById,
  updateRecord,
  removeRecord,
  listRecords
};
