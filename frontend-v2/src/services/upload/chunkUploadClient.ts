// 共用 Chunk Upload Client
// 封裝 /api/drive-upload/init|chunk|complete 呼叫，供學生媒體與課程總覽共用

import { apiClient } from '../api/client';
import {
  CHUNK_MAX_RETRIES,
  CHUNK_REQUEST_TIMEOUT_MS,
  getChunkSizeForFile,
} from './uploadConfig';

export type ChunkUploadMode = 'student' | 'overview';

export interface ChunkUploadMetadataBase {
  semester: string;
  courseName: string;
  date: string; // YYYY-MM-DD
  topic?: string;
  studentName?: string; // student 模式必填，overview 可省略
  /**
   * 若前端已有統一相對路徑，可一併傳入供後端比對與紀錄
   * 例如：114-1/課程名稱/2025-10-10/學生姓名
   */
  relativePathUnified?: string;
  [key: string]: any;
}

export interface ChunkInitResult {
  uploadId: string;
  totalChunks: number;
  chunkSize: number;
  expiresAt: number;
}

export interface ChunkUploadProgress {
  success: boolean;
  uploadId: string;
  receivedChunks: number;
  totalChunks: number;
  progress: number; // 0-100
}

export interface DriveMediaRecord {
  id: string;
  storage: 'drive';
  drivePath: string;
  proxyUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  courseName?: string;
  studentName?: string | null;
  dateKey?: string;
  isOverview?: boolean;
}

export interface ChunkCompleteResult {
  success: boolean;
  uploadId: string;
  record?: DriveMediaRecord;
  status?: 'queued' | 'completed';
  jobId?: string;
}

export type ChunkUploadErrorCode =
  | 'TIMEOUT'
  | 'NETWORK'
  | 'SERVER'
  | 'CLIENT'
  | 'CANCELLED';

export class ChunkUploadError extends Error {
  code: ChunkUploadErrorCode;
  status?: number;

  constructor(message: string, code: ChunkUploadErrorCode, status?: number) {
    super(message);
    this.name = 'ChunkUploadError';
    this.code = code;
    this.status = status;
  }
}

function normalizeError(err: any): ChunkUploadError {
  if (err instanceof ChunkUploadError) return err;

  if (err instanceof Error && err.message === '__REQUEST_TIMEOUT__') {
    return new ChunkUploadError('上傳逾時，請稍後再試或改用較穩定的網路', 'TIMEOUT');
  }

  const message = (err && err.message) || '上傳失敗，請稍後再試';
  return new ChunkUploadError(message, 'SERVER');
}

export async function initChunkUpload(params: {
  file: File;
  metadata: Omit<ChunkUploadMetadataBase, 'mode'>;
  mode: ChunkUploadMode;
}): Promise<ChunkInitResult> {
  const { file, metadata, mode } = params;

  const chunkSize = getChunkSizeForFile(file.size);

  try {
    const response = await apiClient.post<{
      success: boolean;
      uploadId: string;
      totalChunks: number;
      chunkSize: number;
      expiresAt: number;
    }>(
      '/drive-upload/init',
      {
        filename: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        chunkSize,
        metadata: {
          ...metadata,
          mode,
        },
      },
      {
        timeout: CHUNK_REQUEST_TIMEOUT_MS,
      },
    );

    if (!response.data?.success) {
      throw new ChunkUploadError(
        response.data && (response.data as any).message
          ? String((response.data as any).message)
          : '初始化分片上傳失敗',
        'SERVER',
      );
    }

    return {
      uploadId: response.data.uploadId,
      totalChunks: response.data.totalChunks,
      chunkSize: response.data.chunkSize,
      expiresAt: response.data.expiresAt,
    };
  } catch (error) {
    throw normalizeError(error);
  }
}

export async function uploadChunk(params: {
  uploadId: string;
  chunkIndex: number;
  chunk: Blob;
  signal?: AbortSignal;
}): Promise<ChunkUploadProgress> {
  const { uploadId, chunkIndex, chunk, signal } = params;

  let attempt = 0;
  // 最多重試 CHUNK_MAX_RETRIES 次
  while (true) {
    attempt += 1;
    try {
      const formData = new FormData();
      formData.append('chunk', chunk, `chunk-${chunkIndex}`);
      formData.append('uploadId', uploadId);
      formData.append('chunkIndex', String(chunkIndex));

      const response = await apiClient.post<{
        success: boolean;
        receivedChunks: number;
        totalChunks: number;
        progress: number;
      }>('/drive-upload/chunk', formData, {
        timeout: CHUNK_REQUEST_TIMEOUT_MS,
        signal,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.data?.success) {
        throw new ChunkUploadError(
          response.data && (response.data as any).message
            ? String((response.data as any).message)
            : '分片上傳失敗',
          'SERVER',
        );
      }

      return {
        success: true,
        uploadId,
        receivedChunks: response.data.receivedChunks,
        totalChunks: response.data.totalChunks,
        progress: response.data.progress,
      };
    } catch (error: any) {
      if (signal?.aborted) {
        throw new ChunkUploadError('使用者已取消上傳', 'CANCELLED');
      }

      const normalized = normalizeError(error);

      // 僅對 timeout / network / server 問題進行重試，且不超過最大次數
      const retriable = normalized.code === 'TIMEOUT' || normalized.code === 'NETWORK' || normalized.code === 'SERVER';
      if (!retriable || attempt >= CHUNK_MAX_RETRIES) {
        throw normalized;
      }

      // 簡單退避：下一次重試前稍作等待
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

export async function completeChunkUpload(params: {
  uploadId: string;
  metadata?: Partial<ChunkUploadMetadataBase>;
}): Promise<ChunkCompleteResult> {
  const { uploadId, metadata } = params;

  try {
    const response = await apiClient.post<{
      success: boolean;
      record?: DriveMediaRecord;
      status?: 'queued' | 'completed';
      jobId?: string;
      message?: string;
    }>(
      '/drive-upload/complete',
      {
        uploadId,
        metadata,
      },
      {
        timeout: CHUNK_REQUEST_TIMEOUT_MS,
      },
    );

    const { data, status } = response;

    if (!data?.success) {
      throw new ChunkUploadError(
        data && data.message ? String(data.message) : '分片合併失敗',
        'SERVER',
        status,
      );
    }

    // 若後端改為背景 Job，可能回傳 202 + queued 狀態，沒有即時 record
    const isQueued = status === 202 || data.status === 'queued';

    if (isQueued) {
      return {
        success: true,
        uploadId,
        status: data.status || 'queued',
        jobId: data.jobId,
      };
    }

    if (!data.record) {
      throw new ChunkUploadError('分片合併成功但缺少媒體紀錄', 'SERVER', status);
    }

    return {
      success: true,
      uploadId,
      record: data.record,
      status: data.status || 'completed',
    };
  } catch (error) {
    throw normalizeError(error);
  }
}
