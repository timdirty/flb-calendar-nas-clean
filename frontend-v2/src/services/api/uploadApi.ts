/**
 * 上傳 API 服務
 */
import { apiClient } from './client';
import type { Course, Student } from '../../types';
import { getCurrentSemesterFromDate } from '../../utils/semester';
import { normalizeCourseName } from '../../utils/courseName';
import { extractCourseTopicForPath } from '../../utils/courseTopic';

export interface UploadRequest {
  semester: string;
  courseName: string;
  date: string;
  studentName: string;
  comment?: string;
  photos?: File[];
  videos?: File[];
}

export interface UploadResponse {
  success: boolean;
  message: string;
  data?: {
    basePath: string;
    studentName: string;
    photos: number;
    videos: number;
    comment?: string;
    summary?: string; // 🔥 新增：課程總覽的 summary 欄位
    files: {
      photos: Array<{
        name: string;
        url: string;
        size: number;
      }>;
      videos: Array<{
        name: string;
        url: string;
        size: number;
      }>;
    };
    metadata: any;
  };
}

export const uploadApi = {
  /**
   * 上傳學習記錄到 Synology Drive
   */
  async uploadStudentRecord(params: {
    course: Course;
    student: Student;
    comment?: string;
    files: File[];
    onUploadProgress?: (event: { loaded?: number; total?: number }) => void;
  }): Promise<UploadResponse> {
    const { course, student, comment, files, onUploadProgress } = params;

    // 準備 FormData
    const formData = new FormData();

    // 基本欄位（支援全域學期 override）
    let semester = course.semester || getCurrentSemesterFromDate(course.date);
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('flbUploadSemesterOverride');
        if (stored && stored.trim()) {
          semester = stored.trim();
        }
      } catch (e) {
        void e;
      }
    }
    const normalizedCourseName = normalizeCourseName(course.name);
    const topic = extractCourseTopicForPath(course);
    formData.append('semester', semester);
    formData.append('courseName', normalizedCourseName);
    formData.append('date', course.date);
    formData.append('studentName', student.name);
    formData.append('topic', topic);

    if (comment && comment.trim()) {
      formData.append('comment', comment.trim());
    }

    // 分類檔案
    const photos: File[] = [];
    const videos: File[] = [];

    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        photos.push(file);
      } else if (file.type.startsWith('video/')) {
        videos.push(file);
      }
    });

    // 添加檔案到 FormData
    photos.forEach((file) => {
      formData.append('photos', file, file.name);
    });

    videos.forEach((file) => {
      formData.append('videos', file, file.name);
    });

    // 呼叫後端 API（上傳允許較長時間，單獨將 timeout 調整為 120 秒）
    const response = await apiClient.post<UploadResponse>('/learning-records/upload-drive', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000,
      // 將上傳進度回傳給呼叫者，用於更新前端進度條
      onUploadProgress: (event) => {
        if (typeof onUploadProgress === 'function') {
          onUploadProgress({ loaded: event.loaded, total: event.total });
        }
      },
    });

    return response.data;
  },

  /**
   * 上傳課程總覽
   */
  async uploadOverviewRecord(params: {
    course: Course;
    summary?: string;
    files: File[];
    onUploadProgress?: (event: { loaded?: number; total?: number }) => void;
  }): Promise<UploadResponse> {
    const { course, summary, files, onUploadProgress } = params;

    const formData = new FormData();

    let semester = course.semester || getCurrentSemesterFromDate(course.date);
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem('flbUploadSemesterOverride');
        if (stored && stored.trim()) {
          semester = stored.trim();
        }
      } catch (e) {
        void e;
      }
    }
    const normalizedCourseName = normalizeCourseName(course.name);
    const topic = extractCourseTopicForPath(course);
    formData.append('semester', semester);
    formData.append('courseName', normalizedCourseName);
    formData.append('date', course.date);
    formData.append('isOverview', 'true');
    formData.append('topic', topic);

    if (summary && summary.trim()) {
      formData.append('comment', summary.trim());
    }

    // 分類檔案
    const photos: File[] = [];
    const videos: File[] = [];

    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        photos.push(file);
      } else if (file.type.startsWith('video/')) {
        videos.push(file);
      }
    });

    // 添加檔案到 FormData
    photos.forEach((file) => {
      formData.append('overviewPhotos', file, file.name);
    });

    videos.forEach((file) => {
      formData.append('overviewVideos', file, file.name);
    });

    const response = await apiClient.post<UploadResponse>('/learning-records/upload-drive', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000,
      onUploadProgress: (event) => {
        if (typeof onUploadProgress === 'function') {
          onUploadProgress({ loaded: event.loaded, total: event.total });
        }
      },
    });

    return response.data;
  },
};
