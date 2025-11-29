/**
 * 學生相關 React Query Hooks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentApi } from '../services/api';
import type { Student, Course } from '../types';

/**
 * 獲取課程的學生列表
 * @param courseId - 課程 ID
 * @param courseTitle - 課程標題（用於後端匹配學生）
 * @param semester - 學期（用於後端決定 Drive 路徑）
 * @param topic - 課程主題（用於後端決定正確的子資料夾名稱）
 */
export function useStudentsByCourse(
  courseId: string,
  courseTitle?: string,
  semester?: string,
  topic?: string
) {
  return useQuery<Student[]>({
    queryKey: ['students', 'course', courseId, courseTitle, semester, topic],
    queryFn: () => studentApi.getStudentsByCourse(courseId, courseTitle, semester, topic),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 獲取單個學生
 */
export function useStudent(id: string) {
  return useQuery<Student>({
    queryKey: ['student', id],
    queryFn: () => studentApi.getStudent(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * 更新學生出席狀態
 */
export function useUpdateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variables: {
      id: string;
      attendance: Student['attendance'];
      course?: Course | null;
    }) => studentApi.updateAttendance(variables.id, variables.attendance),
    onSuccess: (_, variables) => {
      // 更新快取
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student', variables.id] });
      if (variables.course) {
        const courseKey = variables.course.id || variables.course.name;
        queryClient.invalidateQueries({
          queryKey: ['student-learning-records', variables.id, courseKey],
        });
      }
    },
  });
}

/**
 * 批次更新出席狀態
 */
export function useBatchUpdateAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Array<{ id: string; attendance: Student['attendance'] }>) =>
      studentApi.batchUpdateAttendance(updates),
    onSuccess: () => {
      // 更新所有學生相關的快取
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
  });
}

/**
 * 獲取學生上傳狀態
 */
export function useUploadStatus(
  studentId: string,
  course?: Course,
  studentName?: string,
  topic?: string
) {
  return useQuery<{
    uploadStatus: Student['uploadStatus'];
    uploadOverview: Student['uploadOverview'];
  }>({
    queryKey: ['uploadStatus', studentId, course?.id || course?.name, studentName, topic],
    queryFn: () => {
      if (!course || !studentName) {
        throw new Error('Missing course or studentName for upload status');
      }
      return studentApi.getUploadStatus(studentId, {
        course,
        studentName,
        topic,
      });
    },
    enabled: !!studentId && !!course && !!studentName,
    staleTime: 1 * 60 * 1000,
  });
}

/**
 * 獲取學生的學習記錄（已上傳的檔案）
 */
export function useStudentLearningRecords(course?: Course, student?: Student) {
  const courseKey = course?.id || course?.name;

  return useQuery({
    queryKey: ['student-learning-records', student?.id, courseKey],
    queryFn: () => {
      if (!course || !student) return { photos: [], videos: [] };
      return studentApi.getStudentLearningRecords({ course, student });
    },
    enabled: !!course && !!student,
    staleTime: 1000 * 60 * 5, // 5 分鐘快取
  });
}

/**
 * 更新學生評語
 */
export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      comment,
      course,
      student,
    }: {
      id: string;
      comment: string;
      course: Course;
      student: Student;
    }) =>
      studentApi.updateComment({ id, comment, course, student }),
    onSuccess: (_, variables) => {
      // 更新快取
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['student', variables.id] });
      const courseKey = variables.course?.id || variables.course?.name;
      if (courseKey) {
        queryClient.invalidateQueries({
          queryKey: ['student-learning-records', variables.id, courseKey],
        });
      }
    },
  });
}
