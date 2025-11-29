/**
 * 學生狀態管理
 */
import { create } from 'zustand';
import type { Student } from '../types';

interface StudentState {
  // 狀態
  students: Student[];
  selectedStudent: Student | null;
  loading: boolean;
  error: string | null;

  // Actions
  setStudents: (students: Student[]) => void;
  selectStudent: (student: Student | null) => void;
  updateStudent: (id: string, updates: Partial<Student>) => void;
  updateAttendance: (id: string, attendance: Student['attendance']) => void;
  updateUploadStatus: (id: string, type: 'photos' | 'videos', count: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  // 輔助方法
  getStudentsByCourse: (courseId: string) => Student[];
  getStudentById: (id: string) => Student | undefined;
  getPresentStudents: (courseId: string) => Student[];
  getUploadProgress: (courseId: string) => { completed: number; total: number };
}

export const useStudentStore = create<StudentState>((set, get) => ({
  // 初始狀態
  students: [],
  selectedStudent: null,
  loading: false,
  error: null,

  // Actions
  setStudents: (students) => set({ students, error: null }),
  
  selectStudent: (student) => set({ selectedStudent: student }),
  
  updateStudent: (id, updates) => set((state) => ({
    students: state.students.map((student) =>
      student.id === id ? { ...student, ...updates } : student
    ),
  })),

  updateAttendance: (id, attendance) => set((state) => ({
    students: state.students.map((student) =>
      student.id === id ? { ...student, attendance } : student
    ),
  })),

  updateUploadStatus: (id, type, count) => set((state) => ({
    students: state.students.map((student) => {
      if (student.id !== id) return student;
      
      const uploadStatus = { ...student.uploadStatus, [type]: count };
      uploadStatus.completed = uploadStatus.photos > 0 && uploadStatus.videos > 0;
      
      return { ...student, uploadStatus };
    }),
  })),
  
  setLoading: (loading) => set({ loading }),
  
  setError: (error) => set({ error, loading: false }),

  // 輔助方法
  getStudentsByCourse: (courseId) => {
    return get().students.filter((student) => student.courseId === courseId);
  },

  getStudentById: (id) => {
    return get().students.find((student) => student.id === id);
  },

  getPresentStudents: (courseId) => {
    return get().students.filter(
      (student) => student.courseId === courseId && student.attendance === 'present'
    );
  },

  getUploadProgress: (_courseId) => {
    // V2：store.students 已經是目前選定課程的學生名單，這裡不再依 courseId 過濾
    const students = get().students;
    // 應該上傳的學生：排除請假與缺席，其餘（出席 / 未標記）都算在內
    const targetStudents = students.filter(
      (s) => s.attendance !== 'leave' && s.attendance !== 'absent'
    );

    // 視為「已完成」的條件：該學生已上傳至少一張照片或一部影片
    const completed = targetStudents.filter((s) => {
      const photos = s.uploadStatus?.photos || 0;
      const videos = s.uploadStatus?.videos || 0;
      return photos + videos > 0;
    }).length;

    return {
      completed,
      total: targetStudents.length,
    };
  },
}));
