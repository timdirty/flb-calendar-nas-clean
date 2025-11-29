/**
 * 課程 API 服務
 */
import { apiClient } from './client';
import type { Course, ApiResponse, DeeplinkCoursePayload } from '../../types';
import { mockCourseApi, MOCK_MODE_ENABLED } from '../mock/mockApi';

// 根據環境決定使用 Mock 或真實 API（僅由 VITE_MOCK_MODE 控制）
const useMock = MOCK_MODE_ENABLED;

export const courseApi = {
  /**
   * 獲取課程列表
   * - 預設以 summary 模式請求（不計算學生與上傳統計），僅在需要時才顯式要求 full
   */
  async getCourses(params?: {
    startDate?: string;
    endDate?: string;
    location?: string;
    teacherId?: string;
    mode?: 'summary' | 'full';
    includeStats?: boolean;
  }): Promise<Course[]> {
    const finalParams = { ...(params || {}) } as {
      startDate?: string;
      endDate?: string;
      location?: string;
      teacherId?: string;
      mode?: 'summary' | 'full';
      includeStats?: boolean;
    };

    // 如果呼叫端沒有特別指定，就預設使用輕量 summary 模式
    if (!finalParams.mode && typeof finalParams.includeStats === 'undefined') {
      finalParams.mode = 'summary';
    }

    if (useMock) {
      return mockCourseApi.getCourses(finalParams);
    }
    const response = await apiClient.get<ApiResponse<Course[]>>('/v2/courses', {
      params: finalParams,
    });
    return response.data.data || [];
  },

  /**
   * 獲取單個課程
   */
  async getCourse(id: string): Promise<Course> {
    if (useMock) {
      return mockCourseApi.getCourse(id);
    }
    const response = await apiClient.get<ApiResponse<Course>>(`/v2/courses/${id}`);
    if (!response.data.data) {
      throw new Error('課程不存在');
    }
    return response.data.data;
  },

  /**
   * 獲取今日課程
   * 🔥 預設啟用上傳統計，讓課程卡片顯示上傳進度
   */
  async getTodayCourses(): Promise<Course[]> {
    if (useMock) {
      return mockCourseApi.getTodayCourses();
    }
    const today = new Date().toISOString().split('T')[0];
    return this.getCourses({ 
      startDate: today, 
      endDate: today,
      includeStats: true  // 🚀 啟用上傳統計
    });
  },

  /**
   * 獲取本週課程
   * 🔥 預設啟用上傳統計，讓課程卡片顯示上傳進度
   */
  async getWeekCourses(): Promise<Course[]> {
    if (useMock) {
      return mockCourseApi.getWeekCourses();
    }
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    return this.getCourses({
      startDate: startOfWeek.toISOString().split('T')[0],
      endDate: endOfWeek.toISOString().split('T')[0],
      includeStats: true  // 🚀 啟用上傳統計
    });
  },

  /**
   * 搜尋課程
   */
  async searchCourses(keyword: string): Promise<Course[]> {
    if (useMock) {
      return mockCourseApi.searchCourses(keyword);
    }
    const response = await apiClient.get<ApiResponse<Course[]>>('/v2/courses/search', {
      params: { q: keyword },
    });
    return response.data.data || [];
  },

  async getDeeplinkCourse(params: {
    courseId?: string;
    courseTitle?: string;
    date?: string;
    instructor?: string;
  }): Promise<DeeplinkCoursePayload> {
    if (useMock) {
      return mockCourseApi.getDeeplinkCourse(params);
    }

    const response = await apiClient.get<ApiResponse<DeeplinkCoursePayload>>('/v2/deeplink-course', {
      params,
    });

    if (!response.data.data) {
      throw new Error(response.data.error || '無法透過 Deep Link 取得課程');
    }

    return response.data.data;
  },
};
