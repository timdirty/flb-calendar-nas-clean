/**
 * 學生 API 服務
 */
import { apiClient } from './client';
import type {
  Student,
  ApiResponse,
  Course,
  StudentUploadStatus,
  StudentUploadOverview,
  CommentHistoryEntry,
} from '../../types';
import { getCurrentSemesterFromDate } from '../../utils/semester';
import { mockStudentApi, MOCK_MODE_ENABLED } from '../mock/mockApi';
import { normalizeCourseName } from '../../utils/courseName';
import { extractCourseTopicForPath } from '../../utils/courseTopic';

// 根據環境決定使用 Mock 或真實 API（僅由 VITE_MOCK_MODE 控制）
const useMock = MOCK_MODE_ENABLED;

export const studentApi = {
  /**
   * 獲取課程的學生列表
   * @param courseId - 課程 ID 或課程標題
   * @param courseTitle - 可選的課程標題（用於後端匹配）
   * @param semester - 可選的學期字串（若提供將優先用於 Drive 路徑）
   * @param topic - 可選的課程主題（與學習記錄 API 使用同一套推導邏輯）
   */
  async getStudentsByCourse(
    courseId: string,
    courseTitle?: string,
    semester?: string,
    topic?: string
  ): Promise<Student[]> {
    if (useMock) {
      return mockStudentApi.getStudentsByCourse(courseId);
    }
    
    // 🔥 使用 query 參數傳遞課程標題與學期，以便後端精準匹配與決定 Drive 路徑
    const params: Record<string, string> = {};
    if (courseTitle) params.courseTitle = courseTitle;
    if (semester) params.semester = semester;
    if (topic) params.topic = topic;
    const response = await apiClient.get<ApiResponse<Student[]>>(
      `/v2/courses/${encodeURIComponent(courseId)}/students`,
      { params }
    );
    return response.data.data || [];
  },

  /**
   * 獲取單個學生資訊
   */
  async getStudent(id: string): Promise<Student> {
    if (useMock) {
      return mockStudentApi.getStudent(id);
    }
    const response = await apiClient.get<ApiResponse<Student>>(`/v2/students/${id}`);
    if (!response.data.data) {
      throw new Error('學生不存在');
    }
    return response.data.data;
  },

  /**
   * 更新學生出席狀態
   */
  async updateAttendance(
    id: string,
    attendance: Student['attendance']
  ): Promise<void> {
    if (useMock) {
      return mockStudentApi.updateAttendance(id, attendance);
    }
    await apiClient.patch(`/v2/students/${id}/attendance`, { attendance });
  },

  /**
   * 批次更新出席狀態
   */
  async batchUpdateAttendance(
    updates: Array<{ id: string; attendance: Student['attendance'] }>
  ): Promise<void> {
    if (useMock) {
      return mockStudentApi.batchUpdateAttendance(updates);
    }
    await apiClient.post(`/v2/students/attendance/batch`, { updates });
  },

  /**
   * 獲取學生上傳狀態
   */
  async getUploadStatus(
    studentId: string,
    params: {
      course: Course;
      studentName: string;
      topic?: string;
    }
  ): Promise<{ uploadStatus: StudentUploadStatus; uploadOverview: StudentUploadOverview }> {
    if (useMock) {
      return mockStudentApi.getUploadStatus(studentId, params);
    }
    const { course, studentName, topic } = params;
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
    const courseName = normalizeCourseName(course.name);
    const derivedTopic = topic || extractCourseTopicForPath(course);

    const response = await apiClient.get<
      ApiResponse<{ uploadStatus: StudentUploadStatus; uploadOverview: StudentUploadOverview }>
    >(`/v2/students/${studentId}/upload-status`, {
      params: {
        semester,
        courseName,
        date: course.date,
        studentName,
        topic: derivedTopic,
      },
    });

    return (
      response.data.data || {
        uploadStatus: { photos: 0, videos: 0, completed: false },
        uploadOverview: { uploadedCount: 0, hasComment: false, lastUploadAt: null, lastCommentAt: null },
      }
    );
  },

  /**
   * 獲取學生的學習記錄（已上傳的檔案）
   */
  async getStudentLearningRecords(params: {
    course: Course;
    student: Student;
  }): Promise<{
    photos: Array<{ name: string; url: string; size: number }>;
    videos: Array<{ name: string; url: string; size: number }>;
    comment?: string;
    commentHistory?: CommentHistoryEntry[];
  }> {
    const { course, student } = params;

    if (useMock) {
      // Mock 模式：返回空記錄
      console.log('[Mock] 獲取學習記錄:', { course, student });
      return { photos: [], videos: [] };
    }
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
    const courseName = normalizeCourseName(course.name);
    const topic = extractCourseTopicForPath(course);
    
    const response = await apiClient.get<ApiResponse<{
      photos: Array<{ name: string; url: string; size: number }>;
      videos: Array<{ name: string; url: string; size: number }>;
      comment?: string | null;
      commentHistory?: CommentHistoryEntry[];
    }>>(`/v2/students/${student.id}/learning-records`, {
      params: {
        semester,
        courseName,
        date: course.date,
        studentName: student.name,
        topic,
      },
    });

    const payload =
      response.data.data || {
        photos: [],
        videos: [],
        comment: '',
        commentHistory: [],
      };

    return {
      photos: payload.photos || [],
      videos: payload.videos || [],
      comment: payload.comment || '',
      commentHistory: payload.commentHistory || [],
    };
  },

  /**
   * 更新學生評語
   *
   * 需要提供課程與學生資訊，讓後端能正確找到 Synology Drive 上的資料夾：
   * - semester：依課程日期計算（與後端 semester-helper.js 一致）
   * - courseName：完整課程標題（例如：SPIKE 五 16:10-17:40 松山 第8週）
   * - date：YYYY-MM-DD（課程日期）
   * - studentName：學生姓名
   */
  async updateComment(params: {
    id: string;
    comment: string;
    course: Course;
    student: Student;
    topic?: string;
  }): Promise<void> {
    const { id, comment, course, student, topic } = params;

    if (useMock) {
      // Mock 模式：僅輸出 log，不呼叫後端
      console.log('[Mock] 更新評語:', { id, comment, course, student, topic });
      return;
    }
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
    const courseName = normalizeCourseName(course.name);
    const derivedTopic = topic || extractCourseTopicForPath(course);

    await apiClient.patch(`/v2/students/${id}/comment`, {
      comment,
      semester,
      courseName,
      date: course.date,
      topic: derivedTopic,
      studentName: student.name,
    });
  },

  async deleteLearningRecordMedia(params: {
    course: Course;
    student: Student;
    fileName: string;
    topic?: string;
  }): Promise<{
    photos: Array<{ name: string; url: string; size: number }>;
    videos: Array<{ name: string; url: string; size: number }>;
    comment?: string | null;
  }> {
    const { course, student, fileName, topic } = params;

    if (useMock) {
      console.log('[Mock] 刪除媒體:', { course, student, fileName, topic });
      return { photos: [], videos: [] };
    }

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
    const courseName = normalizeCourseName(course.name);
    const derivedTopic = topic || extractCourseTopicForPath(course);

    const response = await apiClient.delete(`/v2/students/${student.id}/learning-records/media`, {
      data: {
        semester,
        courseName,
        date: course.date,
        studentName: student.name,
        topic: derivedTopic,
        fileName,
      },
    });

    return response.data.data || { photos: [], videos: [] };
  },

  /**
   * 讀取課程層級的課程總覽（文字 + 媒體）
   *
   * 回傳資料會包含：
   * - summary：課程總覽文字
   * - recordPath：Drive 上對應 overview 資料夾路徑（用於後續刪除單一檔案）
   * - photos / videos：每個項目都保留原始檔名（fileName）與顯示名稱（name）
   */
  async getCourseOverview(params: { course: Course }): Promise<{
    summary: string;
    recordPath?: string | null;
    photos: Array<{ name: string; url: string; size: number; fileName?: string }>;
    videos: Array<{ name: string; url: string; size: number; fileName?: string }>;
  } | null> {
    const { course } = params;

    if (useMock) {
      return null;
    }

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
    const courseName = normalizeCourseName(course.name);

    const response = await apiClient.get<ApiResponse<any>>('/v2/learning-records', {
      params: {
        semester,
        courseName,
        date: course.date,
      },
    });

    const records: any[] = (response.data.data as any[]) || [];
    const overviewRecords = records.filter((r) => r && r.isOverview);
    if (overviewRecords.length === 0) return null;

    // 取最後更新的一筆（若有 uploadTime 或 updatedAt 則優先使用）
    overviewRecords.sort((a, b) => {
      const aTime = new Date(a.uploadTime || a.updatedAt || 0).getTime();
      const bTime = new Date(b.uploadTime || b.updatedAt || 0).getTime();
      return bTime - aTime;
    });

    const latest = overviewRecords[0] || {};
    const summary: string = latest.summary || '';
    const recordPath: string | null = typeof latest.recordPath === 'string' ? latest.recordPath : null;

    const photos = ((latest.photos as any[]) || [])
      .map((p, index) => ({
        name: p.originalName || p.fileName || p.name || `照片 ${index + 1}`,
        fileName: p.fileName || p.filename || p.name,
        url: p.proxyUrl || p.url || null,
        size: typeof p.size === 'number' ? p.size : 0,
      }))
      .filter((p) => !!p.url);

    const videos = ((latest.videos as any[]) || [])
      .map((v, index) => {
        const name = v.originalName || v.fileName || v.name || `影片 ${index + 1}`;
        const fileName = v.fileName || v.filename || v.name;

        const url =
          v.transcodedProxyUrl ||
          v.proxyUrl ||
          v.url ||
          (v.path ? `/api/drive-media${v.path}` : null);

        const size = typeof v.size === 'number' ? v.size : 0;
        const thumbnailProxyUrl: string | undefined = v.thumbnailProxyUrl || undefined;

        return {
          name,
          fileName,
          url,
          size,
          thumbnailProxyUrl,
        };
      })
      .filter((v) => !!v.url);

    return {
      summary,
      recordPath,
      photos,
      videos,
    };
  },

  /**
   * 刪除課程總覽（overview）中的單一媒體檔案
   *
   * 使用現有的 Drive 刪除端點：DELETE /api/learning-records/drive/*?fileName=XXX
   * recordPath 來自 getCourseOverview 回傳的 recordPath 欄位
   */
  async deleteCourseOverviewMedia(params: {
    recordPath: string;
    fileName: string;
  }): Promise<void> {
    const { recordPath, fileName } = params;

    if (useMock) {
      console.log('[Mock] 刪除課程總覽媒體:', { recordPath, fileName });
      return;
    }

    const safeRecordPath = String(recordPath || '').trim();
    const safeFileName = String(fileName || '').trim();

    if (!safeRecordPath || !safeFileName) {
      throw new Error('recordPath 與 fileName 為必填欄位');
    }

    // 逐段編碼路徑，避免空白與中文造成問題，但保留斜線分段
    const encodedRecordPath = safeRecordPath
      .split('/')
      .filter(Boolean)
      .map(encodeURIComponent)
      .join('/');

    await apiClient.delete(`/learning-records/drive/${encodedRecordPath}`, {
      params: {
        fileName: safeFileName,
      },
    });
  },
};
