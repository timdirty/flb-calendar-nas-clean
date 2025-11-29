const crypto = require('crypto');

// 📝 簡單的記憶體 Job 佇列實作
// - 適用於目前單機 Node 服務與短期背景處理需求
// - 若日後需要跨進程或持久化，可再替換為 Redis / DB 版本

const jobs = new Map();

function createJobId() {
  try {
    return crypto.randomUUID();
  } catch (e) {
    return `drive-job-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }
}

function cloneJob(job) {
  return job ? { ...job } : null;
}

/**
 * 建立新的上傳 Job，預設狀態為 pending
 * payload 結構由 server.js 的 handleDriveUploadComplete 負責組裝
 */
async function enqueueJob(payload = {}) {
  const id = createJobId();
  const now = Date.now();

  const job = {
    id,
    status: 'pending', // pending | processing | done | error
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    ...payload,
  };

  jobs.set(id, job);

  console.log('📝 [DriveUploadQueue] 新增 Job:', {
    id: job.id,
    localPath: job.localPath,
    semester: job.semester,
    courseName: job.courseName,
    date: job.date,
    studentName: job.studentName,
    isOverview: job.isOverview,
  });

  return cloneJob(job);
}

/**
 * 取得待處理的 Job 清單（僅回傳狀態為 pending 的）
 * @param {number} maxConcurrent 最多取得幾個 Job
 */
async function getPendingJobs(maxConcurrent = 1) {
  const result = [];

  for (const job of jobs.values()) {
    if (job.status === 'pending') {
      result.push(cloneJob(job));
      if (result.length >= maxConcurrent) break;
    }
  }

  return result;
}

/**
 * 更新指定 Job 的欄位
 */
async function updateJob(id, patch = {}) {
  const job = jobs.get(id);
  if (!job) {
    console.warn('⚠️ [DriveUploadQueue] 無法更新不存在的 Job:', id);
    return null;
  }

  Object.assign(job, patch, {
    updatedAt: Date.now(),
  });

  return cloneJob(job);
}

/**
 * 將 Job 標記為完成
 */
async function markJobDone(id, extra = {}) {
  const job = jobs.get(id);
  if (!job) {
    console.warn('⚠️ [DriveUploadQueue] 無法標記完成，Job 不存在:', id);
    return null;
  }

  Object.assign(job, extra, {
    status: 'done',
    completedAt: Date.now(),
    updatedAt: Date.now(),
  });

  console.log('✅ [DriveUploadQueue] Job 已完成:', {
    id: job.id,
    localPath: job.localPath,
  });

  return cloneJob(job);
}

/**
 * 將 Job 標記為錯誤
 */
async function markJobError(id, extra = {}) {
  const job = jobs.get(id);
  if (!job) {
    console.warn('⚠️ [DriveUploadQueue] 無法標記錯誤，Job 不存在:', id);
    return null;
  }

  job.attempts = (job.attempts || 0) + 1;

  Object.assign(job, extra, {
    status: 'error',
    errorAt: Date.now(),
    updatedAt: Date.now(),
  });

  console.warn('❌ [DriveUploadQueue] Job 標記為錯誤:', {
    id: job.id,
    attempts: job.attempts,
    message: extra && extra.message,
  });

  return cloneJob(job);
}

module.exports = {
  enqueueJob,
  getPendingJobs,
  updateJob,
  markJobDone,
  markJobError,
};

