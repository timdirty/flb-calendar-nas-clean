/**
 * FLB V2 TypeScript 類型定義
 */

// ==================== 課程相關 ====================

export interface Course {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM-HH:MM
  location: string;
  weekNumber?: number;
  semester: string;
  teacherId?: string;
  teacherName?: string;
  studentCount: number;
  uploadedStudentCount?: number;
  totalUploadedFiles?: number;
  overviewUploaded?: boolean;
  overviewFileCount?: number;
  status?: 'pending' | 'in-progress' | 'completed';
  topic?: string; // 伺服器若已提供課程主題
  metadata?: Record<string, any>; // Synology 事件解析後的額外資訊
}

export interface CourseFilter {
  dateRange?: { start: string; end: string };
  location?: string;
  teacher?: string;
  status?: Course['status'];
}

// ==================== 學生相關 ====================

export interface StudentUploadStatus {
  photos: number;
  videos: number;
  completed: boolean;
}

export interface StudentUploadOverview {
  uploadedCount: number;
  hasComment: boolean;
  lastUploadAt: string | null;
  lastCommentAt: string | null;
}

export interface CommentHistoryEntry {
  text: string;
  updatedAt: string | null;
}

export interface Student {
  id: string;
  name: string;
  courseId: string;
  attendance: 'present' | 'absent' | 'leave' | 'unknown';
  comment?: string; // 教師評語
  uploadStatus: StudentUploadStatus;
  uploadOverview?: StudentUploadOverview;
  metadata?: {
    grade?: string;
    parentContact?: string;
    originalData?: any; // 保存原始 Google Sheets 數據
  };
}

// ==================== 媒體相關 ====================

export interface MediaFile {
  id: string;
  file: File;
  type: 'photo' | 'video';
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  preview?: string; // Blob URL
  error?: string;
  uploadedUrl?: string;
  url?: string;
  thumbnailUrl?: string; // 影片縮圖 URL
  source?: 'local' | 'remote';
  name?: string;
  size?: number;
  fileName?: string;
  metadata?: {
    size?: number;
    duration?: number; // for videos
    width?: number;
    height?: number;
  };
}

export interface UploadTask {
  id: string;
  studentId: string;
  courseId: string;
  files: MediaFile[];
  totalProgress: number;
  status: 'idle' | 'uploading' | 'completed' | 'error';
  startTime?: number;
  endTime?: number;
}

// ==================== 上傳記錄 ====================

export interface UploadRecord {
  id: string;
  courseId: string;
  studentId: string;
  date: string;
  photos: string[]; // URLs
  videos: string[]; // URLs
  metadata: {
    uploadedBy: string;
    uploadedAt: string;
    semester: string;
    courseName: string;
    studentName: string;
  };
}

// ==================== API 響應 ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ==================== UI 狀態 ====================

export interface UIState {
  loading: boolean;
  error: string | null;
  success: string | null;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
}

export interface DeeplinkCourseSettings {
  semester: string;
  topic?: string | null;
  classroom?: string | null;
}

export interface DeeplinkCoursePayload {
  course: Course;
  students: Student[];
  settings: DeeplinkCourseSettings;
}
