/**
 * 課程狀態管理
 */
import { create } from 'zustand';
import type { Course, CourseFilter } from '../types';

interface CourseState {
  // 狀態
  courses: Course[];
  selectedCourse: Course | null;
  filter: CourseFilter;
  loading: boolean;
  error: string | null;

  // Actions
  setCourses: (courses: Course[]) => void;
  selectCourse: (course: Course | null) => void;
  setFilter: (filter: Partial<CourseFilter>) => void;
  clearFilter: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 輔助方法
  getFilteredCourses: () => Course[];
  getCourseById: (id: string) => Course | undefined;
}

export const useCourseStore = create<CourseState>((set, get) => ({
  // 初始狀態
  courses: [],
  selectedCourse: null,
  filter: {},
  loading: false,
  error: null,

  // Actions
  setCourses: (courses) => set({ courses, error: null }),
  
  selectCourse: (course) => set({ selectedCourse: course }),
  
  setFilter: (newFilter) => set((state) => ({
    filter: { ...state.filter, ...newFilter }
  })),
  
  clearFilter: () => set({ filter: {} }),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error, loading: false }),

  // 輔助方法
  getFilteredCourses: () => {
    const { courses, filter } = get();
    
    return courses.filter((course) => {
      // 日期範圍篩選
      if (filter.dateRange) {
        const courseDate = new Date(course.date);
        const startDate = new Date(filter.dateRange.start);
        const endDate = new Date(filter.dateRange.end);
        if (courseDate < startDate || courseDate > endDate) {
          return false;
        }
      }

      // 地點篩選
      if (filter.location && course.location !== filter.location) {
        return false;
      }

      // 教師篩選
      if (filter.teacher && course.teacherId !== filter.teacher) {
        return false;
      }

      // 狀態篩選
      if (filter.status && course.status !== filter.status) {
        return false;
      }

      return true;
    });
  },

  getCourseById: (id) => {
    return get().courses.find((course) => course.id === id);
  },
}));
