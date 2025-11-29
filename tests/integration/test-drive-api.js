/**
 * Drive API concurrency and saveRecord smoke tests
 */
const fs = require('fs');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: f}) => f(...args));

async function createTemp(sizeBytes, name) {
  const p = path.join('/tmp', name);
  const buf = Buffer.alloc(sizeBytes, 0xab);
  fs.writeFileSync(p, buf);
  return p;
}

async function init(filename, fileSize, fileType, metadata) {
  const resp = await fetch('http://localhost:3002/api/drive-upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, fileSize, fileType, chunkSize: 1024 * 1024, metadata })
  });
  const data = await resp.json();
  if (!data.success) throw new Error('init failed: ' + (data.message || ''));
  return data;
}

async function chunk(uploadId, idx, filePath, offset, length) {
  const fd = new (require('form-data'))();
  const stream = fs.createReadStream(filePath, { start: offset, end: offset + length - 1 });
  fd.append('chunk', stream);
  fd.append('uploadId', uploadId);
  fd.append('chunkIndex', String(idx));
  const resp = await fetch('http://localhost:3002/api/drive-upload/chunk', { method: 'POST', body: fd });
  const data = await resp.json();
  if (!data.success) throw new Error('chunk failed: ' + (data.message || ''));
  return data;
}

async function complete(uploadId, metadata) {
  const resp = await fetch('http://localhost:3002/api/drive-upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploadId, metadata })
  });
  const data = await resp.json();
  if (!data.success) throw new Error('complete failed: ' + (data.message || ''));
  return data.record;
}

async function saveRecord(payload) {
  const resp = await fetch('http://localhost:3002/api/learning-records/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await resp.json();
  if (!data.success) throw new Error('save failed: ' + (data.message || ''));
  return data;
}

(async () => {
  const courseName = '自動化測試課程';
  const date = new Date().toISOString().slice(0,10);
  const student = '測試學生';
  const metaBase = { courseName, date, studentName: student, mode: 'student', semester: '114-1' };

  // create 3 temp files of different sizes
  const p1 = await createTemp(200 * 1024, 'drive-test-1.jpg');
  const p2 = await createTemp(1.4 * 1024 * 1024 | 0, 'drive-test-2.jpg');
  const p3 = await createTemp(3.2 * 1024 * 1024 | 0, 'drive-test-3.mp4');
  const files = [
    { path: p1, type: 'image/jpeg', name: path.basename(p1) },
    { path: p2, type: 'image/jpeg', name: path.basename(p2) },
    { path: p3, type: 'video/mp4', name: path.basename(p3) }
  ];

  const records = [];
  await Promise.all(files.map(async (f) => {
    const st = fs.statSync(f.path);
    const initRes = await init(f.name, st.size, f.type, metaBase);
    const total = Math.max(1, Math.ceil(st.size / (1024 * 1024)));
    const chunkSize = 1024 * 1024;
    for (let i = 0; i < total; i++) {
      const offset = i * chunkSize;
      const len = Math.min(chunkSize, st.size - offset);
      await chunk(initRes.uploadId, i, f.path, offset, len);
    }
    const rec = await complete(initRes.uploadId, metaBase);
    records.push(rec);
  }));

  const mediaIds = records.map(r => r.id);
  const saveRes = await saveRecord({
    course: courseName,
    period: '1830-2030',
    date,
    studentName: student,
    comment: '自動化測試：批次上傳 + 同步文字',
    mediaIds,
    coursePeriod: 'SPIKE 三1830-2030',
    relativePath: `/Fun Learn Bar/FLB-Learning-Portfolio/114-1/${courseName}/${date}/${student}`
  });

  console.log('✅ drive api test ok:', { uploaded: records.length, mediaIds, save: saveRes.success });
  process.exit(0);
})().catch((e) => { console.error('❌ drive api test failed:', e.message); process.exit(1); });
