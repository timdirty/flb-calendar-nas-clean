/**
 * Mock 學生數據
 */
import type { Student } from '../../types';

export const mockStudents: Student[] = [
  // Course 1 學生
  {
    id: 'student-1-1',
    name: '洪康傑',
    courseId: 'course-1',
    attendance: 'present',
    uploadStatus: {
      photos: 3,
      videos: 1,
      completed: true,
    },
  },
  {
    id: 'student-1-2',
    name: '張丞沂',
    courseId: 'course-1',
    attendance: 'present',
    uploadStatus: {
      photos: 2,
      videos: 1,
      completed: true,
    },
  },
  {
    id: 'student-1-3',
    name: '魏翔燊',
    courseId: 'course-1',
    attendance: 'present',
    uploadStatus: {
      photos: 4,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-1-4',
    name: '石紹言',
    courseId: 'course-1',
    attendance: 'present',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-1-5',
    name: '陳宥廷',
    courseId: 'course-1',
    attendance: 'leave',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-1-6',
    name: '林詠晴',
    courseId: 'course-1',
    attendance: 'present',
    uploadStatus: {
      photos: 5,
      videos: 2,
      completed: true,
    },
  },
  {
    id: 'student-1-7',
    name: '王品涵',
    courseId: 'course-1',
    attendance: 'absent',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-1-8',
    name: '李承翰',
    courseId: 'course-1',
    attendance: 'present',
    uploadStatus: {
      photos: 3,
      videos: 1,
      completed: true,
    },
  },
  {
    id: 'student-1-9',
    name: '黃芷萱',
    courseId: 'course-1',
    attendance: 'present',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-1-10',
    name: '周子軒',
    courseId: 'course-1',
    attendance: 'present',
    uploadStatus: {
      photos: 2,
      videos: 1,
      completed: true,
    },
  },
  {
    id: 'student-1-11',
    name: '吳宜庭',
    courseId: 'course-1',
    attendance: 'present',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-1-12',
    name: '劉宇恩',
    courseId: 'course-1',
    attendance: 'present',
    uploadStatus: {
      photos: 3,
      videos: 1,
      completed: true,
    },
  },

  // Course 2 學生
  {
    id: 'student-2-1',
    name: '陳冠廷',
    courseId: 'course-2',
    attendance: 'present',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-2-2',
    name: '林子涵',
    courseId: 'course-2',
    attendance: 'present',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-2-3',
    name: '王柏翔',
    courseId: 'course-2',
    attendance: 'present',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-2-4',
    name: '張雅筑',
    courseId: 'course-2',
    attendance: 'leave',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-2-5',
    name: '李柏勳',
    courseId: 'course-2',
    attendance: 'present',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-2-6',
    name: '黃筱涵',
    courseId: 'course-2',
    attendance: 'present',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-2-7',
    name: '吳承恩',
    courseId: 'course-2',
    attendance: 'present',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
  {
    id: 'student-2-8',
    name: '劉品妍',
    courseId: 'course-2',
    attendance: 'present',
    uploadStatus: {
      photos: 0,
      videos: 0,
      completed: false,
    },
  },
];

/**
 * 根據課程 ID 獲取學生
 */
export function getStudentsByCourseId(courseId: string): Student[] {
  return mockStudents.filter((student) => student.courseId === courseId);
}

/**
 * 根據 ID 獲取學生
 */
export function getStudentById(id: string): Student | undefined {
  return mockStudents.find((student) => student.id === id);
}

/**
 * 更新學生出席狀態
 */
export function updateStudentAttendance(
  id: string,
  attendance: Student['attendance']
): void {
  const student = mockStudents.find((s) => s.id === id);
  if (student) {
    student.attendance = attendance;
  }
}

/**
 * 更新學生上傳狀態
 */
export function updateStudentUploadStatus(
  id: string,
  photos: number,
  videos: number
): void {
  const student = mockStudents.find((s) => s.id === id);
  if (student) {
    student.uploadStatus.photos = photos;
    student.uploadStatus.videos = videos;
    student.uploadStatus.completed = photos > 0 && videos > 0;
  }
}
