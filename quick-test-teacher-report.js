'use strict';

/**
 * quick-test-teacher-report.js
 *
 * 目的：在不呼叫真實 Google Apps Script 的情況下，快速驗證
 * - `public/teacher_list_data.csv` 是否能找到指定講師
 * - `/api/teacher-report` 會組成的 payload 是否正確
 * - （可選）當設定 `QT_TEACHER_REPORT_REMOTE=true` 時，真的呼叫老師 Web API
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config({ path: '.env.nas' });

const DEFAULT_TEACHER = process.env.QT_TEACHER_NAME || 'Yoki 🙏🏻';
const RUN_REMOTE = /^true$/i.test(process.env.QT_TEACHER_REPORT_REMOTE || '');
const CSV_PATH = path.join(__dirname, 'public', 'teacher_list_data.csv');

function cleanTeacherName(name = '') {
  return String(name)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[\u3000\u00a0]/g, '')
    .replace(/[🙏🏻*「」『』【】()（）]/g, '')
    .replace(/老師$/g, '')
    .trim();
}

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result.map((part) => part.replace(/^"|"$/g, ''));
}

function loadTeacherRecords() {
  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`找不到 teacher_list_data.csv，路徑：${CSV_PATH}`);
  }
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const [header, ...lines] = content.split(/\r?\n/).filter(Boolean);
  if (!header || header.indexOf('老師') === -1) {
    throw new Error('teacher_list_data.csv 缺少標題列或格式不正確');
  }
  const records = [];
  lines.forEach((line) => {
    if (!line.trim()) return;
    const [teacher, sheetUrl, webApiUrl, reportApiUrl, userId] = splitCsvLine(line);
    if (!teacher) return;
    records.push({ teacher, sheetUrl, webApiUrl, reportApiUrl, userId });
  });
  if (!records.length) {
    throw new Error('teacher_list_data.csv 沒有任何講師資料');
  }
  return records;
}

function findTeacherRecord(targetName, records) {
  const cleanTarget = cleanTeacherName(targetName);
  for (const record of records) {
    const cleanCsv = cleanTeacherName(record.teacher);
    if (!cleanCsv) continue;
    if (cleanCsv === cleanTarget) {
      return { ...record, matchMethod: '完全匹配', matchedName: record.teacher };
    }
    if (cleanCsv.includes(cleanTarget) && cleanTarget.length >= 2) {
      return { ...record, matchMethod: 'CSV 包含指定名稱', matchedName: record.teacher };
    }
    if (cleanTarget.includes(cleanCsv) && cleanCsv.length >= 2) {
      return { ...record, matchMethod: '指定名稱包含 CSV 名稱', matchedName: record.teacher };
    }
  }
  return null;
}

function buildTeacherPayload(teacherName, record) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  return {
    action: 'appendTeacherCourse',
    sheetName: '報表',
    teacherName: record.matchedName || teacherName,
    teacherSheetUrl: record.sheetUrl,
    課程名稱: `【自動測試】${teacherName} 課程`,
    上課時間: '19:30-21:00',
    課程日期: dateStr,
    人數_助教: '8',
    課程內容: 'Quick test payload 驗證資料映射'
  };
}

async function maybePingWebApi(record, payload) {
  if (!RUN_REMOTE) {
    console.log('🛡️ 目前為 dry-run 模式，未呼叫 Google Apps Script Web API');
    return;
  }
  if (!record.webApiUrl) {
    throw new Error(`講師「${record.teacher}」缺少 Web API URL，無法進行遠端測試`);
  }
  console.log(`🌐 連線至 ${record.webApiUrl} …`);
  const response = await axios.post(record.webApiUrl, payload, { timeout: 10000 });
  console.log('✅ Web API 回應：', JSON.stringify(response.data, null, 2));
}

async function run() {
  try {
    const teacherName = DEFAULT_TEACHER;
    console.log('🚀 快速測試講師報表：', teacherName);
    const records = loadTeacherRecords();
    const record = findTeacherRecord(teacherName, records);
    if (!record) {
      throw new Error(`在 teacher_list_data.csv 中找不到講師「${teacherName}」`);
    }
    if (!record.webApiUrl) {
      console.warn('⚠️ 找到講師，但缺少 Web API URL，僅能進行前置驗證。');
    }
    const payload = buildTeacherPayload(teacherName, record);
    console.log('📦 產生的 payload：\n', JSON.stringify(payload, null, 2));
    await maybePingWebApi(record, payload);
    console.log('✅ quick-test-teacher-report 完成，資料映射正常。');
  } catch (error) {
    console.error('❌ quick-test-teacher-report 失敗：', error.message);
    process.exitCode = 1;
  }
}

run();
