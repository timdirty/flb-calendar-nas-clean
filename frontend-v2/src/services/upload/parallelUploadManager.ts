/**
 * 並行上傳管理器
 * 用於學生上傳和課程總覽上傳的共用邏輯
 */
import {
  initChunkUpload,
  uploadChunk,
  completeChunkUpload,
  ChunkUploadError,
} from './chunkUploadClient';

// 並行上傳配置
const CONCURRENT_UPLOADS = 3; // 最多同時上傳 3 個檔案

// 分批並行上傳工具函數
async function uploadInBatches<T>(
  items: T[],
  uploadFn: (item: T) => Promise<void>,
  batchSize: number = CONCURRENT_UPLOADS
): Promise<PromiseSettledResult<void>[]> {
  const results: PromiseSettledResult<void>[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(uploadFn));
    results.push(...batchResults);
  }

  return results;
}

/**
 * 並行上傳大影片（分片上傳）
 */
export async function uploadLargeVideosInParallel(params: {
  files: File[];
  mode: 'student' | 'overview';
  metadata: {
    semester: string;
    courseName: string;
    date: string;
    topic?: string;
    studentName?: string;
    isOverview?: boolean;
  };
  onProgress: (file: File, percent: number) => void;
  onComplete: (file: File, uploadedUrl: string) => void;
  onError: (file: File, error: string) => void;
}): Promise<{
  successCount: number;
  failureCount: number;
}> {
  const { files, mode, metadata, onProgress, onComplete, onError } = params;

  let successCount = 0;
  let failureCount = 0;

  const uploadSingleVideo = async (file: File) => {
    try {
      console.log(`🎬 [並行上傳] 開始上傳影片: ${file.name}`);

      // 初始化分片上傳
      const initResult = await initChunkUpload({
        file,
        mode,
        metadata,
      });

      const chunkSize = initResult.chunkSize || file.size;
      const totalChunks = initResult.totalChunks || Math.max(1, Math.ceil(file.size / chunkSize));

      // 逐片上傳
      let uploadedBytes = 0;
      for (let index = 0; index < totalChunks; index += 1) {
        const start = index * chunkSize;
        const end = Math.min(start + chunkSize, file.size);
        const blob = file.slice(start, end);

        await uploadChunk({
          uploadId: initResult.uploadId,
          chunkIndex: index,
          chunk: blob,
        });

        uploadedBytes = end;
        const ratio = file.size > 0 ? uploadedBytes / file.size : 1;
        const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
        onProgress(file, percent);

        console.log(`🎬 [並行上傳] ${file.name} 進度: ${percent}% (${index + 1}/${totalChunks})`);
      }

      // 完成上傳
      const completeResult = await completeChunkUpload({
        uploadId: initResult.uploadId,
        metadata,
      });

      const uploadedUrl = completeResult.record?.proxyUrl || '';
      onComplete(file, uploadedUrl);
      successCount++;

      console.log(`✅ [並行上傳] 影片上傳成功: ${file.name}`);
    } catch (error: any) {
      failureCount++;

      const isTimeoutError =
        error instanceof ChunkUploadError && error.code === 'TIMEOUT';
      const friendlyMessage = isTimeoutError
        ? '上傳逾時：這次上傳超過 120 秒未完成，建議改用穩定的 Wi‑Fi / 區網環境，或先壓縮影片後再試一次。'
        : (error instanceof Error ? error.message : '影片上傳失敗，請稍後再試');

      onError(file, friendlyMessage);

      console.error(`❌ [並行上傳] 影片上傳失敗: ${file.name}`, error);
    }
  };

  // 分批並行上傳所有影片
  await uploadInBatches(files, uploadSingleVideo);

  return { successCount, failureCount };
}

/**
 * 並行上傳小檔案/照片（逐個上傳）
 */
export async function uploadSmallFilesInParallel(params: {
  files: File[];
  uploadSingleFileFn: (file: File) => Promise<{ uploadedUrl: string }>;
  onProgress: (file: File, percent: number) => void;
  onComplete: (file: File, uploadedUrl: string) => void;
  onError: (file: File, error: string) => void;
}): Promise<{
  successCount: number;
  failureCount: number;
}> {
  const { files, uploadSingleFileFn, onProgress, onComplete, onError } = params;

  let successCount = 0;
  let failureCount = 0;

  const uploadSingleSmallFile = async (file: File) => {
    try {
      console.log(`📸 [並行上傳] 開始上傳: ${file.name}`);

      // 設置初始上傳中狀態
      onProgress(file, 0);

      // 呼叫上傳函數
      const result = await uploadSingleFileFn(file);

      // 完成
      onProgress(file, 100);
      onComplete(file, result.uploadedUrl);
      successCount++;

      console.log(`✅ [並行上傳] 上傳成功: ${file.name}`);
    } catch (error: any) {
      failureCount++;

      const friendlyMessage =
        error instanceof Error ? error.message : '上傳失敗，請稍後再試';

      onError(file, friendlyMessage);

      console.error(`❌ [並行上傳] 上傳失敗: ${file.name}`, error);
    }
  };

  // 分批並行上傳所有小檔案
  await uploadInBatches(files, uploadSingleSmallFile);

  return { successCount, failureCount };
}

/**
 * 取得檔案在陣列中的唯一標識
 * 用於比對 File 物件
 */
export function getFileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}
