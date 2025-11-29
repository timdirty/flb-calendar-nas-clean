/**
 * 課程相關 React Query Hooks
 */
import { useQuery } from '@tanstack/react-query';
import { courseApi, studentApi } from '../services/api';
import type { Course } from '../types';

/**
 * 獲取課程列表
 */
export function useCourses(
  params?: {
    startDate?: string;
    endDate?: string;
    location?: string;
    teacherId?: string;
  },
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ['courses', params],
    queryFn: () => courseApi.getCourses(params),
    staleTime: 5 * 60 * 1000, // 5 分鐘
    gcTime: 10 * 60 * 1000, // 10 分鐘 (之前的 cacheTime)
    enabled: options?.enabled ?? true,
  });
}

/**
 * 獲取單個課程
 */
export function useCourse(id: string) {
  return useQuery({
    queryKey: ['course', id],
    queryFn: () => courseApi.getCourse(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 獲取今日課程
 */
export function useTodayCourses() {
  return useQuery<Course[]>({
    queryKey: ['courses', 'today'],
    queryFn: () => courseApi.getTodayCourses(),
    staleTime: 1 * 60 * 1000, // 1 分鐘（今日課程更新頻繁）
    refetchInterval: 5 * 60 * 1000, // 每 5 分鐘自動刷新
  });
}

/**
 * 獲取本週課程
 */
export function useWeekCourses(options?: { enabled?: boolean }) {
  return useQuery<Course[]>({
    queryKey: ['courses', 'week'],
    queryFn: () => courseApi.getWeekCourses(),
    staleTime: 5 * 60 * 1000,
    enabled: options?.enabled ?? true,
  });
}

/**
 * 搜尋課程
 */
export function useSearchCourses(keyword: string) {
  return useQuery<Course[]>({
    queryKey: ['courses', 'search', keyword],
    queryFn: () => courseApi.searchCourses(keyword),
    enabled: keyword.length > 0,
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * 讀取課程總覽（從 Drive 回填）
 */
export function useCourseOverview(course?: Course) {
  const courseKey = course?.id || course?.name;

  return useQuery({
    queryKey: ['course-overview', courseKey],
    queryFn: () => {
      if (!course) return null;
      return studentApi.getCourseOverview({ course });
    },
    enabled: !!course,
    staleTime: 5 * 60 * 1000,
  });
}
