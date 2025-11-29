/**
 * Mock 課程數據
 */
import type { Course } from '../../types';

export const mockCourses: Course[] = [
  {
    id: 'course-1',
    name: 'SPIKE 五 16:10-17:40',
    date: '2025-11-23',
    time: '16:10-17:40',
    location: '松山',
    weekNumber: 8,
    semester: '114-1',
    teacherId: 'teacher-1',
    teacherName: '張老師',
    studentCount: 12,
    status: 'in-progress',
  },
  {
    id: 'course-2',
    name: 'ESM 四 17:30-18:30',
    date: '2025-11-23',
    time: '17:30-18:30',
    location: '到府',
    weekNumber: 8,
    semester: '114-1',
    teacherId: 'teacher-2',
    teacherName: '李老師',
    studentCount: 8,
    status: 'in-progress',
  },
  {
    id: 'course-3',
    name: 'BOOST 六 15:30-17:00',
    date: '2025-11-23',
    time: '15:30-17:00',
    location: '到府',
    weekNumber: 8,
    semester: '114-1',
    teacherId: 'teacher-1',
    teacherName: '張老師',
    studentCount: 10,
    status: 'pending',
  },
  {
    id: 'course-4',
    name: 'SPIKE 三 18:30-20:00',
    date: '2025-11-23',
    time: '18:30-20:00',
    location: '松山',
    weekNumber: 8,
    semester: '114-1',
    teacherId: 'teacher-3',
    teacherName: '王老師',
    studentCount: 15,
    status: 'pending',
  },
  {
    id: 'course-5',
    name: 'EV3 一 16:00-17:30',
    date: '2025-11-23',
    time: '16:00-17:30',
    location: '松山',
    weekNumber: 8,
    semester: '114-1',
    teacherId: 'teacher-2',
    teacherName: '李老師',
    studentCount: 9,
    status: 'completed',
  },
];

/**
 * 根據日期獲取課程
 */
export function getCoursesByDate(date: string): Course[] {
  return mockCourses.filter((course) => course.date === date);
}

/**
 * 根據 ID 獲取課程
 */
export function getCourseById(id: string): Course | undefined {
  return mockCourses.find((course) => course.id === id);
}

/**
 * 獲取今日課程
 */
export function getTodayCourses(): Course[] {
  const today = new Date().toISOString().split('T')[0];
  return getCoursesByDate(today);
}
