// V2 Chunk Upload 全域設定與共用常數
// 僅負責前端參數，不直接綁定任何 React 元件

export const LARGE_FILE_THRESHOLD_MB = 100; // 超過此大小的影片改走分片上傳

export const CHUNK_SIZE_SMALL = 10 * 1024 * 1024; // 10MB
export const CHUNK_SIZE_LARGE = 15 * 1024 * 1024; // 15MB

export const CHUNK_MAX_RETRIES = 3; // 單一 chunk 最多重試次數

// 與後端上傳 timeout 策略對齊（目前為 120 秒）
export const CHUNK_REQUEST_TIMEOUT_MS = 120_000;

// 是否啟用 Chunk Upload 功能（預設開啟，但可透過環境變數關閉）
const envFlag = (import.meta as any).env?.VITE_ENABLE_CHUNK_UPLOAD;
export const ENABLE_CHUNK_UPLOAD: boolean =
  typeof envFlag === 'string'
    ? envFlag === 'true'
    : true;

// 根據檔案大小決定 chunk 大小（可依實測調整門檻）
export function getChunkSizeForFile(fileSizeBytes: number): number {
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return CHUNK_SIZE_SMALL;
  }

  const sizeMB = fileSizeBytes / (1024 * 1024);
  if (sizeMB < 150) {
    return CHUNK_SIZE_SMALL;
  }
  return CHUNK_SIZE_LARGE;
}

export function isLargeFile(fileSizeBytes: number): boolean {
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) return false;
  const sizeMB = fileSizeBytes / (1024 * 1024);
  return sizeMB > LARGE_FILE_THRESHOLD_MB;
}
