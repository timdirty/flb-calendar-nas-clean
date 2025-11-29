/**
 * Mock API 服務
 * 模擬後端 API 響應，用於開發和測試
 */
import type { Course, Student, StudentUploadOverview, StudentUploadStatus, DeeplinkCoursePayload } from '../../types';
import {
  mockCourses,
  getCourseById,
  getTodayCourses,
} from './mockCourses';
import {
  getStudentsByCourseId,
  getStudentById,
  updateStudentAttendance,
  updateStudentUploadStatus,
} from './mockStudents';

// 模擬網路延遲
const delay = (ms: number = 300) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock 課程 API
 */
export const mockCourseApi = {
  /**
   * 獲取課程列表
   */
  async getCourses(params?: {
    startDate?: string;
    endDate?: string;
    location?: string;
    teacherId?: string;
  }): Promise<Course[]> {
    await delay();

    let courses = [...mockCourses];

    // 日期篩選
    if (params?.startDate || params?.endDate) {
      courses = courses.filter((course) => {
        const courseDate = new Date(course.date);
        if (params.startDate) {
          const startDate = new Date(params.startDate);
          if (courseDate < startDate) return false;
        }
        if (params.endDate) {
          const endDate = new Date(params.endDate);
          if (courseDate > endDate) return false;
        }
        return true;
      });
    }

    // 地點篩選
    if (params?.location) {
      courses = courses.filter((course) => course.location === params.location);
    }

    // 教師篩選
    if (params?.teacherId) {
      courses = courses.filter((course) => course.teacherId === params.teacherId);
    }

    return courses;
  },

  /**
   * 獲取單個課程
   */
  async getCourse(id: string): Promise<Course> {
    await delay();

    const course = getCourseById(id);
    if (!course) {
      throw new Error('課程不存在');
    }
    return course;
  },

  /**
   * 獲取今日課程
   */
  async getTodayCourses(): Promise<Course[]> {
    await delay(200);
    return getTodayCourses();
  },

  /**
   * 獲取本週課程
   */
  async getWeekCourses(): Promise<Course[]> {
    await delay();
    // 簡化：返回所有課程
    return [...mockCourses];
  },

  /**
   * 搜尋課程
   */
  async searchCourses(keyword: string): Promise<Course[]> {
    await delay(200);

    return mockCourses.filter(
      (course) =>
        course.name.toLowerCase().includes(keyword.toLowerCase()) ||
        course.location.toLowerCase().includes(keyword.toLowerCase()) ||
        course.teacherName?.toLowerCase().includes(keyword.toLowerCase())
    );
  },

  async getDeeplinkCourse(params: {
    courseId?: string;
    courseTitle?: string;
    date?: string;
    instructor?: string;
  }): Promise<DeeplinkCoursePayload> {
    await delay(200);

    const { courseId, courseTitle } = params;

    let course: Course | undefined;

    if (courseId) {
      course = mockCourses.find((c) => String(c.id) === String(courseId));
    }

    if (!course && courseTitle) {
      course = mockCourses.find((c) => c.name === courseTitle);
    }

    if (!course) {
      throw new Error('找不到對應課程');
    }

    const students = getStudentsByCourseId(course.id);

    const settings = {
      semester: course.semester,
      topic: course.topic || null,
      classroom: course.location || null,
    };

    return {
      course,
      students,
      settings,
    };
  },
};

/**
 * Mock 學生 API
 */
export const mockStudentApi = {
  /**
   * 獲取課程的學生列表
   */
  async getStudentsByCourse(courseId: string): Promise<Student[]> {
    await delay();
    return getStudentsByCourseId(courseId);
  },

  /**
   * 獲取單個學生資訊
   */
  async getStudent(id: string): Promise<Student> {
    await delay();

    const student = getStudentById(id);
    if (!student) {
      throw new Error('學生不存在');
    }
    return student;
  },

  /**
   * 更新學生出席狀態
   */
  async updateAttendance(
    id: string,
    attendance: Student['attendance']
  ): Promise<void> {
    await delay(100);
    updateStudentAttendance(id, attendance);
  },

  /**
   * 批次更新出席狀態
   */
  async batchUpdateAttendance(
    updates: Array<{ id: string; attendance: Student['attendance'] }>
  ): Promise<void> {
    await delay(200);
    updates.forEach(({ id, attendance }) => {
      updateStudentAttendance(id, attendance);
    });
  },

  /**
   * 獲取學生上傳狀態
   */
  async getUploadStatus(
    studentId: string,
    _params: {
      course: Course;
      studentName: string;
    }
  ): Promise<{ uploadStatus: StudentUploadStatus; uploadOverview: StudentUploadOverview }> {
    await delay(100);

    const student = getStudentById(studentId);
    if (!student) {
      throw new Error('學生不存在');
    }
    return {
      uploadStatus: student.uploadStatus,
      uploadOverview: {
        uploadedCount: (student.uploadStatus.photos || 0) + (student.uploadStatus.videos || 0),
        hasComment: Boolean(student.comment && student.comment.length > 0),
        lastUploadAt: null,
        lastCommentAt: student.comment ? new Date().toISOString() : null,
      },
    };
  },
};

/**
 * Mock 上傳 API
 */
export const mockUploadApi = {
  /**
   * 模擬檔案上傳
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<{ url: string; path: string }> {
    // 模擬上傳進度
    const totalSteps = 10;
    for (let i = 0; i <= totalSteps; i++) {
      await delay(100);
      if (onProgress) {
        onProgress((i / totalSteps) * 100);
      }
    }

    // 返回模擬的 URL
    return {
      url: URL.createObjectURL(file),
      path: `/uploads/${Date.now()}-${file.name}`,
    };
  },

  /**
   * 批次上傳檔案
   */
  async uploadFiles(
    files: File[],
    onProgress?: (fileIndex: number, progress: number) => void
  ): Promise<Array<{ url: string; path: string }>> {
    const results: Array<{ url: string; path: string }> = [];

    for (let i = 0; i < files.length; i++) {
      const result = await this.uploadFile(files[i], (progress) => {
        if (onProgress) {
          onProgress(i, progress);
        }
      });
      results.push(result);
    }

    return results;
  },

  /**
   * 完成上傳後更新學生狀態
   */
  async completeUpload(
    studentId: string,
    photoCount: number,
    videoCount: number
  ): Promise<void> {
    await delay(100);
    updateStudentUploadStatus(studentId, photoCount, videoCount);
  },
};

/**
 * 啟用 Mock 模式標記
 */
export const MOCK_MODE_ENABLED = import.meta.env.VITE_MOCK_MODE === 'true';
