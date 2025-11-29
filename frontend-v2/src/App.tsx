/**
 * FLB 學習歷程上傳系統 V2.0
 * 主應用元件
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCourseStore } from './store/courseStore';
import { useStudentStore } from './store/studentStore';
import { useUploadStore } from './store/uploadStore';
import { useTodayCourses, useWeekCourses, useCourses, useCourseOverview } from './hooks/useCourses';
import { useStudentsByCourse, useUpdateComment, useStudentLearningRecords } from './hooks/useStudents';
import { resolveMediaUrl } from './utils/media';
import { CourseList } from './components/course/CourseList';
import { CourseDrawer } from './components/course/CourseDrawer';
import { StudentList } from './components/student/StudentList';
import { UploadProgress } from './components/student/UploadProgress';
import { MediaUploader } from './components/upload/MediaUploader';
import { FilePreview } from './components/upload/FilePreview';
import { RemoteMediaCard } from './components/upload/RemoteMediaCard';
import { CommentEditor } from './components/student/CommentEditor';
import { Button } from './components/ui/Button';
import { Icon } from './components/ui/Icon';
import { useUploadStudentRecord, useUploadOverviewRecord } from './hooks/useUpload';
import type { Course, Student, MediaFile } from './types';
import { studentApi } from './services/api/studentApi';
import { courseApi } from './services/api/courseApi';
import { apiClient } from './services/api/client';
import { StudentMediaDrawer } from './components/student/StudentMediaDrawer';
import { extractCourseTopicForPath } from './utils/courseTopic';
import { getCurrentSemesterFromDate } from './utils/semester';
import { uploadLargeVideosInParallel, uploadSmallFilesInParallel } from './services/upload/parallelUploadManager';
import { normalizeCourseName } from './utils/courseName';
import { ENABLE_CHUNK_UPLOAD, isLargeFile } from './services/upload/uploadConfig';

type PreviewMedia = {
  type: 'photo' | 'video';
  url: string;
  name: string;
};

type CourseIndexStudentEntry = {
  studentName?: string;
  photoCount?: number;
  videoCount?: number;
  hasComment?: boolean;
  hasAnyUpload?: boolean;
  lastUploadTime?: string | null;
  lastUpdatedAt?: string;
};

type CourseIndexSummary = {
  semester: string;
  courseName: string;
  date: string;
  topic?: string;
  overview?: {
    hasPhotos?: boolean;
    hasVideos?: boolean;
    hasSummary?: boolean;
    lastUpdatedAt?: string;
  } | null;
  students: Record<string, CourseIndexStudentEntry>;
};

function parseOverviewSummary(summary: string): {
  studentStatus: string;
  problems: string;
  solutions: string;
} {
  const result = {
    studentStatus: '',
    problems: '',
    solutions: '',
  };

  if (!summary) return result;

  const trimmed = summary.trim();
  if (!trimmed) return result;

  // 依據標題切分區塊，與上傳時的格式對齊
  const sections = trimmed.split(/(?=【學生的狀況與表現】|【遇到的問題】|【解決的方法】)/g);

  for (const block of sections) {
    const text = block.trim();
    if (!text) continue;

    if (text.startsWith('【學生的狀況與表現】')) {
      result.studentStatus = text.replace('【學生的狀況與表現】', '').trim();
    } else if (text.startsWith('【遇到的問題】')) {
      result.problems = text.replace('【遇到的問題】', '').trim();
    } else if (text.startsWith('【解決的方法】')) {
      result.solutions = text.replace('【解決的方法】', '').trim();
    }
  }

  // 舊資料可能沒有使用標題格式，則整段放入第一欄
  if (!result.studentStatus && !result.problems && !result.solutions) {
    result.studentStatus = trimmed;
  }

  return result;
}

function App() {
  const [currentPage, setCurrentPage] = useState<'courses' | 'students' | 'overview'>('courses');
  const [isUploading, setIsUploading] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<PreviewMedia | null>(null);
  const [deletingFileName, setDeletingFileName] = useState<string | null>(null);
  const [overviewDeletingFileName, setOverviewDeletingFileName] = useState<string | null>(null);
  const [isMediaDrawerOpen, setIsMediaDrawerOpen] = useState(false);
  const [isCourseDrawerOpen, setIsCourseDrawerOpen] = useState(false);
  const [overviewFiles, setOverviewFiles] = useState<File[]>([]);
  const [overviewPreviewFiles, setOverviewPreviewFiles] = useState<MediaFile[]>([]);
  const [overviewUploaded, setOverviewUploaded] = useState(false);
  const [overviewJustSaved, setOverviewJustSaved] = useState(false);
  const [overviewNotes, setOverviewNotes] = useState({
    studentStatus: '',
    problems: '',
    solutions: '',
  });
  const [globalError, setGlobalError] = useState<string | null>(null);
  // 🗑️ [註釋 2025-11-26] 移除集中索引摘要顯示後不再需要這些狀態變數
  // const [courseIndexSummary, setCourseIndexSummary] = useState<CourseIndexSummary | null>(null);
  // const [courseIndexLoading, setCourseIndexLoading] = useState(false);
  // const [indexUploadsByStudentId, setIndexUploadsByStudentId] = useState<Record<string, any>>({});
  const [indexOverviewStatus, setIndexOverviewStatus] = useState<any>(null);
  const [indexRefetchTrigger, setIndexRefetchTrigger] = useState(0); // 🔥 新增：索引重新抓取觸發器
  const [indexUploadsByStudentId, setIndexUploadsByStudentId] = useState<
    Record<
      string,
      {
        hasAnyUpload?: boolean;
        lastUploadTime?: string | null;
        hasComment?: boolean;
      }
    >
  >({});
  const [initialCourseParams, setInitialCourseParams] = useState<
    | {
        courseId?: string;
        courseTitle?: string;
        date?: string;
        instructor?: string;
      }
    | null
  >(null);
  const [hasAppliedInitialCourse, setHasAppliedInitialCourse] = useState(false);
  const [isApplyingInitialCourse, setIsApplyingInitialCourse] = useState(false);
  const [semesterOverride, setSemesterOverride] = useState<string | null>(null);
  const [isSemesterDialogOpen, setIsSemesterDialogOpen] = useState(false);
  const [semesterDraft, setSemesterDraft] = useState('');
  const [courseRange, setCourseRange] = useState<'today' | 'week' | 'all'>('today');
  const [filterInstructor, setFilterInstructor] = useState('');
  const [filterCourseType, setFilterCourseType] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  // 🔧 [修復 2025-11-27] 移除自動週次篩選後不再需要此狀態
  // const [hasInitializedWeekFilterFromToday, setHasInitializedWeekFilterFromToday] =
  //   useState(false);
  const [hasInitializedCurrentPage, setHasInitializedCurrentPage] = useState(false);
  const [filterKeyword, setFilterKeyword] = useState('');
  const [studentViewMode, setStudentViewMode] = useState<'list' | 'upload'>('list');
  const [courseKeyboardIndex, setCourseKeyboardIndex] = useState<number | null>(null);
  const [studentKeyboardIndex, setStudentKeyboardIndex] = useState<number | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0); // -1 ~ 1 之間，代表螢幕寬度比例
  const [isDragging, setIsDragging] = useState(false);
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const prevSliderIndexRef = useRef<number>(0);
  const overviewStudentStatusRef = useRef<HTMLTextAreaElement | null>(null);
  const overviewProblemsRef = useRef<HTMLTextAreaElement | null>(null);
  const overviewSolutionsRef = useRef<HTMLTextAreaElement | null>(null);
  const lastWheelTimeRef = useRef<number>(0);

  // Zustand stores
  const { selectedCourse, selectCourse, setCourses } = useCourseStore();
  const {
    students,
    selectedStudent,
    selectStudent,
    setStudents,
    getUploadProgress,
    updateUploadStatus,
  } = useStudentStore();
  const {
    currentTask,
    createTask,
    removeFile,
    clearTask,
    completeFile,
    updateFileStatus,
    updateFileProgress,
    retryFile,
    getFileForRetry,
  } = useUploadStore();
  const uploadStudentRecordMutation = useUploadStudentRecord();
  const uploadOverviewRecordMutation = useUploadOverviewRecord();
  const queryClient = useQueryClient();

  const courseTopicForPath = selectedCourse ? extractCourseTopicForPath(selectedCourse) : undefined;

  // 取得目前 slider 索引：0=學生列表、1=上傳/評語、2=課程總覽
  const getCurrentSliderIndex = () => {
    if (!selectedCourse) return 0;
    if (currentPage === 'overview') return 2;
    if (currentPage === 'students') {
      return studentViewMode === 'upload' ? 1 : 0;
    }
    return 0;
  };

  // 目前操作流程步驟：1. 選課 → 2. 選學生 → 3. 上傳 / 寫評語 → 4. 課程總覽
  const currentStep = useMemo(() => {
    if (!selectedCourse) {
      return 1;
    }
    if (currentPage === 'courses') {
      return 1;
    }
    if (currentPage === 'overview') {
      return 4;
    }
    if (!selectedStudent) {
      return 2;
    }
    // 學生管理頁 + 列表模式：視為「選學生」步驟
    if (currentPage === 'students' && studentViewMode === 'list') {
      return 2;
    }
    // 已選學生，處於上傳 / 評語畫面時，視為第 3 步
    return 3;
  }, [selectedCourse, selectedStudent, currentPage, studentViewMode]);

  const handleStepClick = (stepId: number) => {
    if (stepId === 1) {
      setCurrentPage('courses');
      setStudentViewMode('list');
      return;
    }

    if (!selectedCourse) {
      return;
    }

    if (stepId === 2) {
      setCurrentPage('students');
      setStudentViewMode('list');
      return;
    }

    if (stepId === 3) {
      if (!selectedStudent) return;
      setCurrentPage('students');
      setStudentViewMode('upload');
      return;
    }

    if (stepId === 4) {
      setCurrentPage('overview');
    }
  };

  // 手勢切換：在「學生列表 → 上傳 / 評語 → 課程總覽」三個概念 tab 間左右滑動
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!selectedCourse) return;
    if (currentPage !== 'students' && currentPage !== 'overview') return;

    const touch = e.touches[0];
    if (!touch) return;

    touchStartXRef.current = touch.clientX;
    touchStartYRef.current = touch.clientY;
    setIsDragging(false);
    setDragOffset(0);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!selectedCourse) return;
    if (currentPage !== 'students' && currentPage !== 'overview') return;

    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    if (startX == null || startY == null) return;

    const touch = e.touches[0];
    if (!touch) return;

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;

    // 垂直位移大於水平位移，視為捲動，不啟動 slider
    if (!isDragging) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy)) {
        return;
      }
      setIsDragging(true);
    }

    const container = sliderRef.current;
    const width = container?.offsetWidth || window.innerWidth || 1;
    const ratio = dx / width; // -1 ~ 1
    setDragOffset(ratio);
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!selectedCourse) return;
    if (currentPage !== 'students' && currentPage !== 'overview') return;

    const startX = touchStartXRef.current;
    const startY = touchStartYRef.current;
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    const container = sliderRef.current;
    const width = container?.offsetWidth || window.innerWidth || 1;

    if (startX == null || startY == null) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const touch = e.changedTouches[0];
    if (!touch) {
      setIsDragging(false);
      setDragOffset(0);
      return;
    }

    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    const distanceRatio = dx / width;
    const SWIPE_DISTANCE_RATIO = 0.2; // 至少滑動 20% 螢幕寬度
    const VERTICAL_LIMIT = 40;

    setIsDragging(false);
    setDragOffset(0);

    if (absDy > VERTICAL_LIMIT || absDx < 10) {
      return;
    }

    const index = getCurrentSliderIndex();
    let nextIndex = index;

    if (Math.abs(distanceRatio) >= SWIPE_DISTANCE_RATIO) {
      if (distanceRatio < 0 && index < 2) {
        nextIndex = index + 1; // 向左滑：下一個
      } else if (distanceRatio > 0 && index > 0) {
        nextIndex = index - 1; // 向右滑：上一個
      }
    }

    if (nextIndex === index) return;

    if (nextIndex === 0) {
      setCurrentPage('students');
      setStudentViewMode('list');
    } else if (nextIndex === 1) {
      setCurrentPage('students');
      setStudentViewMode('upload');
    } else if (nextIndex === 2) {
      setCurrentPage('overview');
    }
  };

  const handleGlobalWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    // 僅在非 deep link + 已選課程時，允許透過滑鼠左右滾動從步驟 1（選課）切換到下一步：
    // 有學生 → 步驟 2（學生列表），無學生 → 步驟 4（課程總覽）
    if (initialCourseParams) return;
    if (!selectedCourse) return;

    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    if (absX < 20 || absX < absY) return;

    const now = Date.now();
    if (now - lastWheelTimeRef.current < 400) {
      return;
    }
    lastWheelTimeRef.current = now;

    // 只有在課程列表頁面才處理從步驟 1 → 下一步
    if (currentPage === 'courses' && e.deltaX > 0) {
      e.preventDefault();
      if (students.length === 0) {
        // 無學生：直接到課程總覽（步驟 4）
        setCurrentPage('overview');
      } else {
        // 有學生：先進入學生管理列表（步驟 2）
        setCurrentPage('students');
        setStudentViewMode('list');
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!selectedCourse) return;
    if (currentPage !== 'students' && currentPage !== 'overview') return;

    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);

    // 垂直滾動或水平位移太小時，不觸發切換
    if (absX < 20 || absX < absY) return;

    const now = Date.now();
    if (now - lastWheelTimeRef.current < 400) {
      return;
    }
    lastWheelTimeRef.current = now;

    // 若當前課程沒有學生，視為僅剩步驟 1（選課）與 4（課程總覽）：
    // 在課程總覽往左滾動時，直接回到選課頁
    if (students.length === 0) {
      if (currentPage === 'overview' && e.deltaX < 0) {
        setCurrentPage('courses');
        setStudentViewMode('list');
      }
      return;
    }

    const index = getCurrentSliderIndex();
    let nextIndex = index;

    if (e.deltaX > 0) {
      if (index < 2) {
        // 往右滾（內容往左移）→ 下一個 panel
        nextIndex = index + 1;
      }
    } else if (e.deltaX < 0) {
      if (index > 0) {
        // 往左滾（內容往右移）→ 上一個 panel
        nextIndex = index - 1;
      } else if (!initialCourseParams) {
        // 非 deep link 模式：已在最左邊，再往左滾時回到步驟 1「選課」
        setCurrentPage('courses');
        setStudentViewMode('list');
        return;
      }
    }

    if (nextIndex === index) return;

    if (nextIndex === 0) {
      setCurrentPage('students');
      setStudentViewMode('list');
    } else if (nextIndex === 1) {
      setCurrentPage('students');
      setStudentViewMode('upload');
    } else if (nextIndex === 2) {
      setCurrentPage('overview');
    }
  };

  const currentSliderIndex = getCurrentSliderIndex();
  const baseTranslate = -currentSliderIndex * 100;
  const dragTranslate = dragOffset * 100;
  const sliderTranslate = baseTranslate + dragTranslate;

  // 切換 slider panel 時，將視窗捲動回頂端，避免從高頁面滑到矮頁面時只看到空白
  useEffect(() => {
    const prev = prevSliderIndexRef.current;
    if (prev === currentSliderIndex) return;

    prevSliderIndexRef.current = currentSliderIndex;

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentSliderIndex]);

  const uploadSemester = useMemo(() => {
    if (semesterOverride && semesterOverride.trim()) {
      return semesterOverride.trim();
    }
    if (selectedCourse?.semester) {
      return selectedCourse.semester;
    }
    if (selectedCourse?.date) {
      return getCurrentSemesterFromDate(selectedCourse.date);
    }
    return '';
  }, [semesterOverride, selectedCourse]);

  // React Query：課程列表（今日 / 本週 / 全部）
  const {
    data: todayCourses,
    isLoading: todayCoursesLoading,
    error: todayCoursesError,
    refetch: refetchTodayCourses,
  } = useTodayCourses();

  const {
    data: weekCourses,
    isLoading: weekCoursesLoading,
    error: weekCoursesError,
  } = useWeekCourses({ enabled: courseRange === 'week' });

  const {
    data: allCourses,
    isLoading: allCoursesLoading,
    error: allCoursesError,
  } = useCourses(undefined, { enabled: courseRange === 'all' });

  const activeCourses = useMemo(() => {
    if (courseRange === 'week') return weekCourses || [];
    if (courseRange === 'all') return allCourses || [];
    return todayCourses || [];
  }, [courseRange, todayCourses, weekCourses, allCourses]);

  const activeCoursesLoading =
    courseRange === 'week'
      ? weekCoursesLoading
      : courseRange === 'all'
      ? allCoursesLoading
      : todayCoursesLoading;

  const activeCoursesError =
    courseRange === 'week'
      ? weekCoursesError
      : courseRange === 'all'
      ? allCoursesError
      : todayCoursesError;
  const shouldLoadCourseOverview = currentPage === 'overview' && !!selectedCourse;

  const instructorOptions = useMemo(() => {
    const map = new Map<string, string>();
    activeCourses.forEach((course) => {
      const rawId = (course.teacherId || '').trim();
      const rawName = (course.teacherName || '').trim();
      if (!rawId && !rawName) return;
      const key = (rawId || rawName).toLowerCase();
      if (map.has(key)) return;
      // 🔧 [修復 2025-11-27] 講師選單只顯示姓名，不顯示 userId 括號
      const label = rawName || rawId;
      map.set(key, label);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [activeCourses]);

  const filteredCourses = useMemo(() => {
    const normalizedInstructor = filterInstructor.trim().toLowerCase();
    const normalizedType = filterCourseType.trim().toLowerCase();
    const normalizedWeek = filterWeek.trim();
    const normalizedKeyword = filterKeyword.trim().toLowerCase();

    return activeCourses.filter((course) => {
      const teacherName = (course.teacherName || '').trim().toLowerCase();
      const teacherId = (course.teacherId || '').trim().toLowerCase();
      const courseName = (course.name || '').trim().toLowerCase();
      const courseLocation = (course.location || '').trim().toLowerCase();

      const rawTitle = (course.name || '').trim();
      let rawType = ((course as any).courseType || '').trim();
      if (!rawType && rawTitle) {
        const cleanedTitle = rawTitle.replace(/^\s*\[[^\]]*]\s*/, '').trim();
        rawType = cleanedTitle.split(/\s+/)[0] || '';
      }
      const courseType = rawType.toLowerCase();

      const dateStr = (course as any).date as string | undefined;
      let weekdayChar = '';
      if (dateStr) {
        const d = new Date(dateStr);
        if (!Number.isNaN(d.getTime())) {
          const weekdayChars = ['日', '一', '二', '三', '四', '五', '六'] as const;
          weekdayChar = weekdayChars[d.getDay()];
        }
      }

      if (normalizedInstructor) {
        if (!teacherId.includes(normalizedInstructor) && !teacherName.includes(normalizedInstructor)) {
          return false;
        }
      }

      if (normalizedType) {
        if (!courseType.includes(normalizedType)) {
          return false;
        }
      }

      if (normalizedWeek) {
        if (weekdayChar !== normalizedWeek) {
          return false;
        }
      }

      if (normalizedKeyword) {
        const combined = `${courseName} ${courseLocation}`.trim();
        if (!combined.includes(normalizedKeyword)) {
          return false;
        }
      }

      return true;
    });
  }, [activeCourses, filterInstructor, filterCourseType, filterWeek, filterKeyword]);

  const courseTypeOptions = useMemo(() => {
    const set = new Set<string>();
    activeCourses.forEach((course) => {
      const rawTitle = (course.name || '').trim();
      let type = ((course as any).courseType || '').trim();

      if (!type && rawTitle) {
        // 移除開頭的 [停課] / [代課] 這類方括號標記，再取第一個空白前字串作為課別
        const cleanedTitle = rawTitle.replace(/^\s*\[[^\]]*]\s*/, '').trim();
        type = cleanedTitle.split(/\s+/)[0] || '';
      }

      if (!type) return;
      set.add(type);
    });
    return Array.from(set).map((label) => ({ value: label.toLowerCase(), label }));
  }, [activeCourses]);

  const weekOptions = useMemo(() => {
    const weekdayChars = ['日', '一', '二', '三', '四', '五', '六'] as const;
    const set = new Set<string>();

    activeCourses.forEach((course) => {
      const dateStr = (course as any).date as string | undefined;
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (Number.isNaN(d.getTime())) return;
      const idx = d.getDay(); // 0=日, 1=一 ...
      const ch = weekdayChars[idx];
      set.add(ch);
    });

    const order: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 7 };
    return Array.from(set).sort((a, b) => (order[a] || 99) - (order[b] || 99));
  }, [activeCourses]);

  // 🔧 [修復 2025-11-27] 移除自動週次篩選，「今日視圖」應顯示今天的所有課程，不應自動篩選星期幾
  // 今日視圖：僅在第一次時依據「今天星期幾」自動初始化週次篩選
  // useEffect(() => {
  //   if (hasInitializedWeekFilterFromToday) return;
  //   if (courseRange !== 'today') return;
  //
  //   const weekdayChars = ['日', '一', '二', '三', '四', '五', '六'] as const;
  //   const now = new Date();
  //   const ch = weekdayChars[now.getDay()];
  //   setFilterWeek(ch);
  //   setHasInitializedWeekFilterFromToday(true);
  // }, [courseRange, hasInitializedWeekFilterFromToday]);

  // 切換到「本週」範圍時，重置週次篩選為「全部週次」
  useEffect(() => {
    if (courseRange === 'week') {
      setFilterWeek('');
    }
  }, [courseRange]);

  const {
    data: courseOverview,
    isLoading: courseOverviewLoading,
    error: courseOverviewError,
  } = useCourseOverview(shouldLoadCourseOverview ? selectedCourse || undefined : undefined);
  const {
    data: courseStudents,
    isLoading: studentsLoading,
    isFetched: studentsFetched,
    error: studentsError,
    refetch: refetchStudents,
  } = useStudentsByCourse(
    selectedCourse?.id || '',
    selectedCourse?.name,   // 傳遞課程標題給後端匹配學生
    uploadSemester || selectedCourse?.semester, // 傳遞學期（優先使用 override），讓後端使用正確 Drive 路徑
    courseTopicForPath       // 傳入與學習記錄相同的主題，對齊 Drive 子資料夾
  );
  const {
    data: learningRecords,
    isLoading: learningRecordsLoading,
    error: learningRecordsError,
    refetch: refetchLearningRecords,
  } = useStudentLearningRecords(selectedCourse || undefined, selectedStudent || undefined);
  const updateCommentMutation = useUpdateComment();
  const deleteMediaMutation = useMutation({
    mutationFn: async ({ course, student, fileName }: { course: Course; student: Student; fileName: string }) => {
      return studentApi.deleteLearningRecordMedia({ course, student, fileName });
    },
    onSuccess: (_, variables) => {
      const courseKey = variables.course.id || variables.course.name;
      if (courseKey) {
        queryClient.invalidateQueries({
          queryKey: ['student-learning-records', variables.student.id, courseKey],
        });
      }
      setDeletingFileName(null);
    },
    onError: () => {
      setDeletingFileName(null);
    },
  });

  const deleteOverviewMediaMutation = useMutation({
    mutationFn: async ({ fileName }: { fileName: string }) => {
      if (!courseOverview || !courseOverview.recordPath) {
        throw new Error('缺少課程總覽路徑，無法刪除媒體');
      }
      return studentApi.deleteCourseOverviewMedia({
        recordPath: courseOverview.recordPath,
        fileName,
      });
    },
    onSuccess: () => {
      // 刪除成功後重新載入課程總覽，以取得最新媒體列表
      if (selectedCourse) {
        const courseKey = selectedCourse.id || selectedCourse.name;
        if (courseKey) {
          queryClient.invalidateQueries({
            queryKey: ['course-overview', courseKey],
          });
        }
      }
      setOverviewDeletingFileName(null);
    },
    onError: () => {
      setOverviewDeletingFileName(null);
    },
  });

  const isLearningRecordsLoading = learningRecordsLoading;
  const isCourseOverviewLoading = courseOverviewLoading;
  const hasLearningRecordsError = !!learningRecordsError;

  useEffect(() => {
    let cancelled = false;

    const loadSemesterSetting = async () => {
      if (typeof window === 'undefined') return;

      try {
        const response = await apiClient.get('/system-settings');
        const payload = response?.data;
        const settings = payload?.data || payload;
        const label = settings?.upload?.semesterLabel;

        if (!cancelled && label && String(label).trim()) {
          const value = String(label).trim();
          setSemesterOverride(value);
          try {
            window.localStorage.setItem('flbUploadSemesterOverride', value);
          } catch (e) {
            void e;
          }
          return;
        }
      } catch (error) {
        // 若後端設定讀取失敗則退回瀏覽器端設定
      }

      if (cancelled || typeof window === 'undefined') return;
      try {
        const stored = window.localStorage.getItem('flbUploadSemesterOverride');
        if (stored && stored.trim()) {
          setSemesterOverride(stored.trim());
        }
      } catch (e) {
        void e;
      }
    };

    void loadSemesterSetting();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (uploadStudentRecordMutation.isError) {
      if (!globalError) {
        setGlobalError('學習記錄上傳失敗，請稍後再試');
      }
    } else if (uploadOverviewRecordMutation.isError) {
      if (!globalError) {
        setGlobalError('課程總覽上傳失敗，請稍後再試');
      }
    } else if (updateCommentMutation.isError) {
      if (!globalError) {
        setGlobalError('評語儲存失敗，請稍後再試');
      }
    } else if (deleteMediaMutation.isError) {
      if (!globalError) {
        setGlobalError('刪除檔案失敗，請稍後再試');
      }
    } else if (
      !uploadStudentRecordMutation.isError &&
      !uploadOverviewRecordMutation.isError &&
      !updateCommentMutation.isError &&
      !deleteMediaMutation.isError
    ) {
      setGlobalError(null);
    }
  }, [
    uploadStudentRecordMutation.isError,
    uploadOverviewRecordMutation.isError,
    updateCommentMutation.isError,
    deleteMediaMutation.isError,
    globalError,
  ]);

  // 🔗 從 URL 解析行事曆 deep link 參數（courseId / courseTitle / date / instructor）
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const search = window.location.search || '';
      if (!search) return;

      const sp = new URLSearchParams(search);
      const courseId = sp.get('courseId') || undefined;
      const courseTitle = sp.get('courseTitle') || undefined;
      const date = sp.get('date') || undefined;

      // instructor 一般會是講師代號或姓名（例如 TIM），僅在存在時用來過濾課程抽屜
      const instructor = sp.get('instructor') || undefined;

      if (courseId || courseTitle || date || instructor) {
        setInitialCourseParams({ courseId, courseTitle, date, instructor });
      }
    } catch (e) {
      // 僅記錄警告，不影響正常流程
      // eslint-disable-next-line no-console
      console.warn('⚠️ 解析 deep link 參數失敗:', e);
    }
  }, []);

  // 根據 deep link 參數，自動選定課程並跳轉到學生管理頁
  useEffect(() => {
    if (!initialCourseParams || hasAppliedInitialCourse) return;
    if (selectedCourse) return; // 使用者已經手動選擇課程時不覆蓋

    let cancelled = false;

    const applyDeepLinkCourse = async () => {
      setIsApplyingInitialCourse(true);
      try {
        const { courseId, courseTitle, date, instructor } = initialCourseParams;

        try {
          const deeplinkResult = await courseApi.getDeeplinkCourse({
            courseId,
            courseTitle,
            date,
            instructor,
          });

          if (!cancelled && deeplinkResult && deeplinkResult.course) {
            handleCourseSelect(deeplinkResult.course);
            if (Array.isArray(deeplinkResult.students)) {
              setStudents(deeplinkResult.students);
            }
            setCurrentPage('students');
            setHasAppliedInitialCourse(true);
            return;
          }
        } catch (deeplinkError) {
          void deeplinkError;
        }

        const fallbackParams = initialCourseParams;
        const { courseId: fbCourseId, courseTitle: fbCourseTitle, date: fbDate } =
          fallbackParams;

        let target: Course | undefined;

        if (Array.isArray(todayCourses) && todayCourses.length > 0) {
          if (fbCourseId) {
            target = todayCourses.find((c) => c.id === fbCourseId);
          }

          if (!target && fbCourseTitle && fbDate) {
            target = todayCourses.find((c) => c.name === fbCourseTitle && c.date === fbDate);
          }

          if (!target && fbCourseTitle) {
            target = todayCourses.find((c) => c.name === fbCourseTitle);
          }

          if (!target && fbCourseId) {
            target = todayCourses.find((c) => String(c.id) === String(fbCourseId));
          }
        }

        if (!target && fbCourseId) {
          try {
            const course = await courseApi.getCourse(fbCourseId);
            target = course;
          } catch (e) {
            void e;
          }
        }

        if (!target && fbCourseTitle && fbDate) {
          try {
            const coursesByDate = await courseApi.getCourses({ startDate: fbDate, endDate: fbDate });
            target = coursesByDate.find((c) => c.name === fbCourseTitle);
          } catch (e) {
            void e;
          }
        }

        if (!target && fbCourseTitle && !fbDate) {
          try {
            const searchedCourses = await courseApi.searchCourses(fbCourseTitle);
            target =
              searchedCourses.find((c) => c.name === fbCourseTitle) || searchedCourses[0];
          } catch (e) {
            void e;
          }
        }

        if (!target || cancelled) return;

        handleCourseSelect(target);
        setCurrentPage('students');
        setHasAppliedInitialCourse(true);
      } catch (e) {
        void e;
      } finally {
        if (!cancelled) {
          setIsApplyingInitialCourse(false);
        }
      }
    };

    void applyDeepLinkCourse();

    return () => {
      cancelled = true;
      setIsApplyingInitialCourse(false);
    };
  }, [todayCourses, initialCourseParams, hasAppliedInitialCourse, selectedCourse, setStudents]);

  // 首次載入時，若沒有正在處理的 deep link，預設回到「課程選擇」頁
  useEffect(() => {
    if (hasInitializedCurrentPage) return;

    // 若有 deep link 且尚未套用，交由 deep link 邏輯決定頁面
    if (initialCourseParams && !hasAppliedInitialCourse) {
      return;
    }

    setCurrentPage('courses');
    setHasInitializedCurrentPage(true);
  }, [initialCourseParams, hasAppliedInitialCourse, hasInitializedCurrentPage]);

  useEffect(() => {
    if (!selectedStudent || !learningRecords) return;
    const photosCount = Array.isArray(learningRecords.photos) ? learningRecords.photos.length : 0;
    const videosCount = Array.isArray(learningRecords.videos) ? learningRecords.videos.length : 0;
    if (photosCount === 0 && videosCount === 0) return;
    updateUploadStatus(selectedStudent.id, 'photos', photosCount);
    updateUploadStatus(selectedStudent.id, 'videos', videosCount);
  }, [learningRecords, selectedStudent, updateUploadStatus]);

  // 集中索引：依目前選中的課程讀取學習歷程索引 summary
  useEffect(() => {
    if (!selectedCourse) {
      // setCourseIndexSummary(null);
      setIndexUploadsByStudentId({});
      setIndexOverviewStatus(null);
      // setCourseIndexError(null);
      // setCourseIndexLoading(false);
      return;
    }

    const semester =
      (uploadSemester && uploadSemester.trim()) ||
      selectedCourse.semester ||
      (selectedCourse.date ? getCurrentSemesterFromDate(selectedCourse.date) : '');
    const courseName = selectedCourse.name;
    const date = selectedCourse.date;

    if (!semester || !courseName || !date) {
      // setCourseIndexSummary(null);
      setIndexUploadsByStudentId({});
      setIndexOverviewStatus(null);
      // setCourseIndexError(null);
      return;
    }

    let cancelled = false;

    const fetchIndex = async () => {
      // setCourseIndexLoading(true);
      // setCourseIndexError(null);

      try {
        // 🔥 除錯：記錄查詢參數
        const queryParams = {
          semester,
          courseName,
          date,
          topic: courseTopicForPath || undefined,
        };
        console.log('🔍 [索引查詢] 查詢參數:', queryParams);
        
        const response = await apiClient.get('/learning-records/index/course', {
          params: queryParams,
        });

        if (cancelled) return;

        const payload = response?.data;
        const summary: CourseIndexSummary | null = (payload && payload.data) || payload || null;

        // 🔥 除錯：記錄 API 回應結構
        console.log('🔍 [索引查詢] 完整 API 回應:', response);
        console.log('🔍 [索引查詢] payload:', payload);
        console.log('🔍 [索引查詢] summary:', summary);
        if (summary) {
          console.log('🔍 [索引查詢] summary 中的所有欄位:', Object.keys(summary));
        }

        if (!summary) {
          // setCourseIndexSummary(null);
          setIndexUploadsByStudentId({});
          setIndexOverviewStatus(null);
          return;
        }

        // setCourseIndexSummary(summary);
        
        // 🔥 [修復 2025-11-26] 從索引中提取課程總覽上傳狀態
        if (summary.overview) {
          console.log('📊 [索引] 課程總覽狀態:', summary.overview);
          setIndexOverviewStatus(summary.overview);
        } else {
          console.log('⚠️ [索引] 課程總覽狀態: 無資料');
          setIndexOverviewStatus(null);
        }

        const uploadsById: Record<
          string,
          {
            hasAnyUpload?: boolean;
            lastUploadTime?: string | null;
            hasComment?: boolean;
          }
        > = {};

        if (summary.students && Array.isArray(students) && students.length > 0) {
          const nameToId = new Map<string, string>();
          students.forEach((stu) => {
            const key = (stu.name || '').trim().toLowerCase();
            if (key && !nameToId.has(key)) {
              nameToId.set(key, stu.id);
            }
          });

          Object.values(summary.students).forEach((entry) => {
            if (!entry) return;
            const rawName = (entry.studentName || '').trim().toLowerCase();
            if (!rawName) return;
            const id = nameToId.get(rawName);
            if (!id) return;
            uploadsById[id] = {
              hasAnyUpload: !!entry.hasAnyUpload,
              lastUploadTime: entry.lastUploadTime || null,
              hasComment: !!entry.hasComment,
            };
          });
        }

        setIndexUploadsByStudentId(uploadsById);
      } catch (error: any) {
        if (cancelled) return;
        // 失敗時不影響主要上傳流程，只記錄錯誤以便顯示提示
        // const message =
        //   error && error.message
        //     ? String(error.message)
        //     : '讀取集中索引失敗，稍後可再嘗試或使用管理頁檢查。';
        // setCourseIndexError(message);
        // setCourseIndexSummary(null);
        setIndexUploadsByStudentId({});
        setIndexOverviewStatus(null);
      } finally {
        if (!cancelled) {
          // setCourseIndexLoading(false);
        }
      }
    };

    void fetchIndex();

    return () => {
      cancelled = true;
    };
  }, [selectedCourse, uploadSemester, courseTopicForPath, students, indexRefetchTrigger]);

  // 🔥 監聽課程總覽上傳成功事件，觸發索引重新抓取
  const handleOverviewUploadSuccess = useCallback(() => {
    console.log('🔄 [索引] 課程總覽上傳成功，觸發索引重新抓取');
    setIndexRefetchTrigger(prev => prev + 1);
    
    // 🔥 修復：直接使課程總覽查詢失效，確保已上傳檔案回補顯示
    if (selectedCourse) {
      const courseKey = selectedCourse.id || selectedCourse.name;
      console.log('🔄 [課程總覽] 使課程總覽查詢失效:', courseKey);
      queryClient.invalidateQueries({ queryKey: ['course-overview', courseKey] });
    }
  }, [selectedCourse, queryClient]);

  useEffect(() => {
    window.addEventListener('overview-upload-success', handleOverviewUploadSuccess);
    return () => {
      window.removeEventListener('overview-upload-success', handleOverviewUploadSuccess);
    };
  }, [handleOverviewUploadSuccess]);

  // 同步課程數據到 store
  useEffect(() => {
    if (todayCourses) {
      setCourses(todayCourses);
    }
  }, [todayCourses, setCourses]);

  // 同步學生數據到 store
  useEffect(() => {
    if (courseStudents) {
      setStudents(courseStudents);
    }
  }, [courseStudents, setStudents]);

  // 若該課程沒有學生，學生管理頁自動跳轉到「課程總覽」
  useEffect(() => {
    if (!selectedCourse) return;
    if (currentPage !== 'students') return;
    if (studentsLoading) return;
    // 🔥 [修復 2025-11-27] 增加 studentsFetched 檢查，確保只在「真正載入完成後確認沒有學生」時才跳轉
    // 避免在課程切換過程中因為 students.length 暫時為 0 而誤判
    if (!studentsFetched) return;
    
    // 🔥 [修復 2025-11-27] 使用 courseStudents（API 資料源）而非 students（store），避免同步延遲
    const actualStudentCount = courseStudents?.length ?? students.length;
    if (actualStudentCount === 0) {
      setCurrentPage('overview');
    }
  }, [selectedCourse, currentPage, studentsLoading, studentsFetched, courseStudents, students.length]);

  useEffect(() => {
    if (currentPage !== 'courses') return;
    if (filteredCourses.length === 0) {
      setCourseKeyboardIndex(null);
      return;
    }
    setCourseKeyboardIndex((prev) => {
      if (prev == null || prev < 0 || prev >= filteredCourses.length) return null;
      return prev;
    });
  }, [currentPage, filteredCourses.length]);

  useEffect(() => {
    if (currentPage !== 'students' || studentViewMode !== 'list') return;
    if (students.length === 0) {
      setStudentKeyboardIndex(null);
      return;
    }
    setStudentKeyboardIndex((prev) => {
      if (prev == null || prev < 0 || prev >= students.length) return 0;
      return prev;
    });
  }, [currentPage, studentViewMode, students.length]);

  // 鍵盤快捷鍵（桌面）：使用方向鍵在操作流程步驟間切換
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target) {
        const tagName = target.tagName;
        const isEditable =
          tagName === 'INPUT' ||
          tagName === 'TEXTAREA' ||
          tagName === 'SELECT' ||
          target.isContentEditable;
        if (isEditable) {
          return;
        }
      }

      if (event.key === 'ArrowRight') {
        // 若當前課程沒有學生，步驟僅在 1（選課）與 4（課程總覽）之間切換
        if (selectedCourse && students.length === 0) {
          if (currentStep === 1) {
            event.preventDefault();
            handleStepClick(4);
          }
          return;
        }

        const nextStep = Math.min(4, currentStep + 1);
        if (nextStep !== currentStep) {
          event.preventDefault();
          handleStepClick(nextStep);
        }
      } else if (event.key === 'ArrowLeft') {
        // 若當前課程沒有學生，步驟僅在 1（選課）與 4（課程總覽）之間切換
        if (selectedCourse && students.length === 0) {
          if (currentStep === 4) {
            event.preventDefault();
            handleStepClick(1);
          }
          return;
        }

        const prevStep = Math.max(1, currentStep - 1);
        if (prevStep !== currentStep) {
          event.preventDefault();
          handleStepClick(prevStep);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentStep, selectedCourse, students.length]);

  // 課程選擇處理
  const handleCourseSelect = (course: typeof selectedCourse) => {
    selectCourse(course);
    selectStudent(null);
    // 重置課程總覽暫存狀態，避免不同課程之間共用同一批檔案或總結文字
    overviewPreviewFiles.forEach((file) => {
      if (file.preview) URL.revokeObjectURL(file.preview);
    });
    setOverviewFiles([]);
    setOverviewPreviewFiles([]);
    setOverviewNotes({ studentStatus: '', problems: '', solutions: '' });
    setOverviewUploaded(false);
    setCurrentPage('students');
  };

  const handleEditSemester = () => {
    if (!selectedCourse) return;
    const current =
      (semesterOverride && semesterOverride.trim()) ||
      selectedCourse.semester ||
      (selectedCourse.date ? getCurrentSemesterFromDate(selectedCourse.date) : '');
    setSemesterDraft(current || '');
    setIsSemesterDialogOpen(true);
  };

  // 學生選擇處理：選定學生後自動切換到「上傳 / 評語」檢視
  const handleStudentSelect = (student: typeof selectedStudent) => {
    selectStudent(student);
    setStudentViewMode('upload');
  };

  // 檔案選擇處理（學生上傳）
  const handleFilesSelect = (files: File[]) => {
    if (!selectedCourse || !selectedStudent) return;
    
    createTask(selectedCourse.id, selectedStudent.id, files);
  };

  // 檔案選擇處理（課程總覽）
  const handleOverviewFilesSelect = (files: File[]) => {
    if (!selectedCourse) return;
    setOverviewFiles((prev) => [...prev, ...files]);

    const newMediaFiles: MediaFile[] = files.map((file, index) => ({
      id: `overview-file-${Date.now()}-${index}`,
      file,
      type: file.type.startsWith('image/') ? 'photo' : 'video',
      status: 'pending',
      progress: 0,
      preview: URL.createObjectURL(file),
      metadata: { size: file.size },
    }));

    setOverviewPreviewFiles((prev) => [...prev, ...newMediaFiles]);
  };

  const handlePreviewMedia = (media: PreviewMedia) => {
    setPreviewMedia(media);
  };

  const handleClosePreview = () => {
    setPreviewMedia(null);
  };

  const handleDeleteRemoteMedia = (fileName: string) => {
    if (!selectedCourse || !selectedStudent || !fileName) return;
    if (window.confirm(`確定要刪除「${fileName}」嗎？`)) {
      setDeletingFileName(fileName);
      deleteMediaMutation.mutate({
        course: selectedCourse,
        student: selectedStudent,
        fileName,
      });
    }
  };

  const handleDeleteOverviewMedia = (fileName: string) => {
    if (!selectedCourse || !fileName) return;
    if (window.confirm(`確定要刪除「${fileName}」嗎？`)) {
      setOverviewDeletingFileName(fileName);
      deleteOverviewMediaMutation.mutate({
        fileName,
      });
    }
  };


  // 開始上傳（學生上傳，使用並行上傳）
  const handleStartUpload = async () => {
    if (!selectedCourse || !selectedStudent || !currentTask || currentTask.files.length === 0) {
      return;
    }

    try {
      setIsUploading(true);

      // 標記所有檔案為「上傳中」
      currentTask.files.forEach((file) => {
        updateFileStatus(currentTask.id, file.id, 'uploading');
      });

      // 依檔案大小與型別決定使用直傳或分片上傳
      const legacyEntries = currentTask.files.filter((entry) => {
        const isVideo = entry.type === 'video' || entry.file.type.startsWith('video/');
        if (!ENABLE_CHUNK_UPLOAD) return true;
        if (!isVideo) return true;
        return !isLargeFile(entry.file.size);
      });
      const chunkEntries = currentTask.files.filter((entry) => {
        const isVideo = entry.type === 'video' || entry.file.type.startsWith('video/');
        if (!ENABLE_CHUNK_UPLOAD) return false;
        if (!isVideo) return false;
        return isLargeFile(entry.file.size);
      });

      console.log('📤 [V2 Upload][student][split]', {
        legacy: legacyEntries.map((e) => ({ name: e.file.name, size: e.file.size, type: e.type })),
        chunk: chunkEntries.map((e) => ({ name: e.file.name, size: e.file.size, type: e.type })),
      });

      // 🔥 [並行上傳] 小檔案/照片逐個並行上傳
      if (legacyEntries.length > 0) {
        console.log(`📸 [並行上傳] 開始並行上傳 ${legacyEntries.length} 個小檔案`);
        
        await uploadSmallFilesInParallel({
          files: legacyEntries.map((e) => e.file),
          uploadSingleFileFn: async (file) => {
            // 逐個上傳每個檔案
            const result = await uploadStudentRecordMutation.mutateAsync({
              course: selectedCourse,
              student: selectedStudent,
              comment: selectedStudent.comment,
              files: [file], // 只傳單個檔案
              onUploadProgress: (event) => {
                const total = event.total || 0;
                if (!total) return;
                const ratio = Math.min(1, Math.max(0, (event.loaded || 0) / total));
                const percent = Math.round(ratio * 100);
                const entry = legacyEntries.find((e) => e.file === file);
                if (entry) {
                  updateFileProgress(currentTask.id, entry.id, percent);
                }
              },
            });

            const uploadedUrl =
              result.data?.files?.photos?.find((p: any) => p.name === file.name)?.url ||
              result.data?.files?.videos?.find((v: any) => v.name === file.name)?.url ||
              '';

            return { uploadedUrl };
          },
          onProgress: (file, percent) => {
            const entry = legacyEntries.find((e) => e.file === file);
            if (entry) {
              updateFileProgress(currentTask.id, entry.id, percent);
            }
          },
          onComplete: (file, uploadedUrl) => {
            const entry = legacyEntries.find((e) => e.file === file);
            if (entry) {
              completeFile(currentTask.id, entry.id, uploadedUrl);
            }
          },
          onError: (file, error) => {
            const entry = legacyEntries.find((e) => e.file === file);
            if (entry) {
              updateFileStatus(currentTask.id, entry.id, 'error', error);
            }
          },
        });

        console.log(`✅ [並行上傳] 小檔案上傳完成`);
      }

      // 🔥 [並行上傳] 大影片並行分片上傳
      if (chunkEntries.length > 0 && ENABLE_CHUNK_UPLOAD) {
        const semester = uploadSemester || getCurrentSemesterFromDate(selectedCourse.date);
        const normalizedCourseName = normalizeCourseName(selectedCourse.name);

        console.log(`🎬 [並行上傳] 開始並行上傳 ${chunkEntries.length} 個大影片`);

        await uploadLargeVideosInParallel({
          files: chunkEntries.map((e) => e.file),
          mode: 'student',
          metadata: {
            semester,
            courseName: normalizedCourseName,
            date: selectedCourse.date,
            topic: courseTopicForPath,
            studentName: selectedStudent.name,
          },
          onProgress: (file, percent) => {
            const entry = chunkEntries.find((e) => e.file === file);
            if (entry) {
              updateFileProgress(currentTask.id, entry.id, percent);
            }
          },
          onComplete: (file, uploadedUrl) => {
            const entry = chunkEntries.find((e) => e.file === file);
            if (entry) {
              completeFile(currentTask.id, entry.id, uploadedUrl);
            }
          },
          onError: (file, error) => {
            const entry = chunkEntries.find((e) => e.file === file);
            if (entry) {
              updateFileStatus(currentTask.id, entry.id, 'error', error);
              
              if (error.includes('逾時') && !globalError) {
                setGlobalError(error);
              }
            }
          },
        });

        console.log(`✅ [並行上傳] 大影片上傳完成`);
      }

    } catch (error) {
      console.error('❌ [V2 Upload] 上傳失敗:', error);

      const isTimeoutError = error instanceof Error && error.message === '__REQUEST_TIMEOUT__';
      let friendlyMessage =
        '上傳失敗：可能是網路不穩或檔案過大，建議改用穩定的 Wi‑Fi / 區網環境，或先壓縮影片後再試一次。';

      if (isTimeoutError) {
        friendlyMessage =
          '上傳逾時：這次上傳超過 120 秒未完成，建議改用穩定的 Wi‑Fi / 區網環境，或先壓縮影片後再試一次。';
        setGlobalError(friendlyMessage);
      }

      if (currentTask) {
        currentTask.files.forEach((file) => {
          updateFileStatus(currentTask.id, file.id, 'error', friendlyMessage);
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  // 開始上傳（課程總覽）
  const handleStartOverviewUpload = async () => {
    if (!selectedCourse) return;

    const hasOverviewDirtyNotesLocal =
      !!overviewNotes.studentStatus.trim() ||
      !!overviewNotes.problems.trim() ||
      !!overviewNotes.solutions.trim();

    if (!hasOverviewDirtyNotesLocal && overviewFiles.length === 0) {
      return;
    }

    try {
      setIsUploading(true);

      const sections: string[] = [];
      const trim = (v: string) => v.trim();

      if (trim(overviewNotes.studentStatus)) {
        sections.push(`【學生的狀況與表現】\n${trim(overviewNotes.studentStatus)}`);
      }
      if (trim(overviewNotes.problems)) {
        sections.push(`【遇到的問題】\n${trim(overviewNotes.problems)}`);
      }
      if (trim(overviewNotes.solutions)) {
        sections.push(`【解決的方法】\n${trim(overviewNotes.solutions)}`);
      }

      const summary = sections.join('\n\n');

      const overviewLegacyFiles = overviewFiles.filter((file) => {
        const isVideo = file.type.startsWith('video/');
        if (!ENABLE_CHUNK_UPLOAD) return true;
        if (!isVideo) return true;
        return !isLargeFile(file.size);
      });

      const overviewChunkFiles = overviewFiles.filter((file) => {
        const isVideo = file.type.startsWith('video/');
        if (!ENABLE_CHUNK_UPLOAD) return false;
        if (!isVideo) return false;
        return isLargeFile(file.size);
      });

      setOverviewPreviewFiles((prev) =>
        prev.map((file) =>
          overviewFiles.includes(file.file)
            ? { ...file, status: 'uploading' as const, progress: 0 }
            : file
        )
      );

      // 🔥 修正：即使只有文字（沒有任何檔案），也要呼叫後端上傳課程總覽
      if (hasOverviewDirtyNotesLocal || overviewLegacyFiles.length > 0) {
        // 🔥 統一上傳策略：像學生上傳一樣分批處理
        const smallFiles = overviewLegacyFiles.filter(file => !isLargeFile(file.size));
        const largeFiles = overviewLegacyFiles.filter(file => isLargeFile(file.size));
        
        console.log('📦 [課程總覽] 分批上傳策略:', {
          小檔案數量: smallFiles.length,
          大檔案數量: largeFiles.length,
          總檔案數量: overviewLegacyFiles.length
        });

        // 1. 先上傳小檔案（並行）
        if (smallFiles.length > 0) {
          console.log('🚀 [課程總覽] 開始並行上傳小檔案...');
          let summaryUploaded = false; // 🔥 修復：使用標誌而非依賴陣列索引
          
          await uploadSmallFilesInParallel({
            files: smallFiles,
            uploadSingleFileFn: async (file) => {
              // 逐個上傳每個檔案，只在第一個成功時傳遞 summary
              const shouldUploadSummary = !summaryUploaded;
              const result = await uploadOverviewRecordMutation.mutateAsync({
                course: selectedCourse,
                summary: shouldUploadSummary ? summary : undefined, // 只在第一個檔案傳遞 summary
                files: [file], // 只傳單個檔案
                onUploadProgress: (event) => {
                  const total = event.total || 0;
                  if (!total) return;
                  const ratio = Math.min(1, Math.max(0, (event.loaded || 0) / total));
                  const percent = Math.round(ratio * 100);

                  setOverviewPreviewFiles((prev) =>
                    prev.map((entry) =>
                      entry.file === file
                        ? { ...entry, progress: percent, status: 'uploading' as const }
                        : entry
                    )
                  );
                },
              });

              // 標記 summary 已上傳
              if (shouldUploadSummary && result?.data) {
                summaryUploaded = true;
                console.log('📝 [課程總覽] Summary 已在第一個檔案上傳完成');
              }

              const uploadedUrl =
                result.data?.files?.photos?.find((p: any) => p.name === file.name)?.url ||
                result.data?.files?.videos?.find((v: any) => v.name === file.name)?.url ||
                '';
              return { uploadedUrl };
            },
            onProgress: (file, percent) => {
              setOverviewPreviewFiles((prev) =>
                prev.map((entry) =>
                  entry.file === file
                    ? { ...entry, progress: percent, status: 'uploading' as const }
                    : entry
                )
              );
            },
            onComplete: (file, _uploadedUrl) => {
              console.log(`✅ [課程總覽] 小檔案上傳成功: ${file.name}`);
              
              // 🔥 「一進一出」機制：課程總覽專用 - 移除已完成的本地預覽
              console.log('🗑️ [一進一出-課程總覽] 移除已完成的本地預覽:', file.name);
              
              // 檢查當前狀態
              console.log('🔍 [DEBUG] 移除前 overviewFiles 數量:', overviewFiles.length);
              console.log('🔍 [DEBUG] 移除前 overviewPreviewFiles 數量:', overviewPreviewFiles.length);
              
              // 🔥 修復：使用函數式更新避免閉包問題
              setOverviewFiles(prev => {
                console.log('🔍 [DEBUG] setOverviewFiles prev 數量:', prev.length);
                const filtered = prev.filter(f => {
                  const isCompleted = f.size === file.size && f.type === file.type;
                  if (isCompleted) {
                    console.log('🗑️ [一進一出-課程總覽] 移除本地預覽:', f.name);
                    return false; // 移除這個檔案
                  }
                  return true; // 保留這個檔案
                });
                console.log('🔍 [DEBUG] setOverviewFiles filtered 數量:', filtered.length);
                return filtered;
              });
              
              // 移除 overviewPreviewFiles 中的對應項目
              setOverviewPreviewFiles(prev => {
                console.log('🔍 [DEBUG] setOverviewPreviewFiles prev 數量:', prev.length);
                const filtered = prev.filter(entry => {
                  const isCompleted = entry.file.size === file.size && entry.file.type === file.type;
                  if (isCompleted) {
                    console.log('🗑️ [一進一出-課程總覽] 移除預覽項目:', entry.file.name);
                    return false; // 移除這個檔案
                  }
                  return true; // 保留這個檔案
                });
                console.log('🔍 [DEBUG] setOverviewPreviewFiles filtered 數量:', filtered.length);
                return filtered;
              });
            },
            onError: (file, error) => {
              setOverviewPreviewFiles((prev) =>
                prev.map((entry) =>
                  entry.file === file
                    ? { ...entry, status: 'error' as const, error }
                    : entry
                )
              );
              console.error(`❌ [課程總覽] 小檔案上傳失敗: ${file.name}`, error);
            },
          });
        }

        // 2. 再上傳大檔案（序列）
        if (largeFiles.length > 0) {
          console.log('🎬 [課程總覽] 開始序列上傳大檔案...');
          
          // 構建 metadata，參考學生上傳的實現
          const semester = 
            (uploadSemester && uploadSemester.trim()) ||
            selectedCourse.semester ||
            (selectedCourse.date ? getCurrentSemesterFromDate(selectedCourse.date) : '');
          const normalizedCourseName = normalizeCourseName(selectedCourse.name);
          const courseTopicForPath = extractCourseTopicForPath(selectedCourse);
          
          await uploadLargeVideosInParallel({
            files: largeFiles,
            mode: 'overview',
            metadata: {
              semester,
              courseName: normalizedCourseName,
              date: selectedCourse.date,
              topic: courseTopicForPath,
              isOverview: true,
            },
            onProgress: (file, percent) => {
              setOverviewPreviewFiles((prev) =>
                prev.map((entry) =>
                  entry.file === file
                    ? { ...entry, progress: percent, status: 'uploading' as const }
                    : entry
                )
              );
            },
            onComplete: (file, uploadedUrl) => {
              setOverviewPreviewFiles((prev) =>
                prev.map((entry) =>
                  entry.file === file
                    ? { ...entry, progress: 100, status: 'completed' as const, uploadedUrl }
                    : entry
                )
              );
              console.log(`✅ [課程總覽] 大檔案上傳成功: ${file.name}`);
              
              // 🔥 「一進一出」機制：大檔案完成後移除預覽
              console.log('🗑️ [一進一出-課程總覽] 移除大檔案預覽:', file.name);
              
              // 移除 overviewFiles 中的對應檔案
              setOverviewFiles((prev) => 
                prev.filter(f => {
                  const isCompleted = f.size === file.size && f.type === file.type;
                  if (isCompleted) {
                    console.log('🗑️ [一進一出-課程總覽] 移除大檔案項目:', f.name);
                    return false; // 移除這個檔案
                  }
                  return true; // 保留這個檔案
                })
              );
              
              // 移除 overviewPreviewFiles 中的對應項目
              setOverviewPreviewFiles((prev) =>
                prev.filter(entry => {
                  const isCompleted = entry.file.size === file.size && entry.file.type === file.type;
                  if (isCompleted) {
                    console.log('🗑️ [一進一出-課程總覽] 移除大檔案預覽項目:', entry.file.name);
                    return false; // 移除這個檔案
                  }
                  return true; // 保留這個檔案
                })
              );
            },
            onError: (file, error) => {
              setOverviewPreviewFiles((prev) =>
                prev.map((entry) =>
                  entry.file === file
                    ? { ...entry, status: 'error' as const, error }
                    : entry
                )
              );
              console.error(`❌ [課程總覽] 大檔案上傳失敗: ${file.name}`, error);
            },
          });
        }

        // 3. 如果沒有檔案，只上傳文字
        if (overviewLegacyFiles.length === 0 && hasOverviewDirtyNotesLocal) {
          console.log('📝 [課程總覽] 只上傳文字摘要...');
          await uploadOverviewRecordMutation.mutateAsync({
            course: selectedCourse,
            summary,
            files: [],
          });
        }

        // 直傳小檔在整體請求成功後，將對應預覽項目標記為完成，顯示綠勾
        if (overviewLegacyFiles.length > 0) {
          setOverviewPreviewFiles((prev) =>
            prev.map((file) =>
              overviewLegacyFiles.includes(file.file)
                ? { ...file, progress: 100, status: 'completed' as const }
                : file
            )
          );
        }
      }

      // 🔥 [並行上傳] 課程總覽大影片並行分片上傳
      if (overviewChunkFiles.length > 0 && ENABLE_CHUNK_UPLOAD) {
        const semester = uploadSemester || getCurrentSemesterFromDate(selectedCourse.date);
        const normalizedCourseName = normalizeCourseName(selectedCourse.name);

        console.log(`🎬 [並行上傳][課程總覽] 開始並行上傳 ${overviewChunkFiles.length} 個大影片`);

        await uploadLargeVideosInParallel({
          files: overviewChunkFiles,
          mode: 'overview',
          metadata: {
            semester,
            courseName: normalizedCourseName,
            date: selectedCourse.date,
            topic: courseTopicForPath,
            isOverview: true,
          },
          onProgress: (file, percent) => {
            setOverviewPreviewFiles((prev) =>
              prev.map((entry) =>
                entry.file === file
                  ? { ...entry, progress: percent, status: 'uploading' as const }
                  : entry
              )
            );
          },
          onComplete: (file, uploadedUrl) => {
            setOverviewPreviewFiles((prev) =>
              prev.map((entry) =>
                entry.file === file
                  ? {
                      ...entry,
                      progress: 100,
                      status: 'completed' as const,
                      metadata: { ...(entry.metadata || {}), uploadedUrl },
                    }
                  : entry
              )
            );
          },
          onError: (file, error) => {
            setOverviewPreviewFiles((prev) =>
              prev.map((entry) =>
                entry.file === file
                  ? {
                      ...entry,
                      status: 'error' as const,
                      metadata: { ...(entry.metadata || {}), error },
                    }
                  : entry
              )
            );

            if (error.includes('逾時') && !globalError) {
              setGlobalError(error);
            }
          },
        });

        console.log(`✅ [並行上傳][課程總覽] 大影片上傳完成`);
      }

      setOverviewFiles([]);
      setOverviewUploaded(true);

      // 🔔 課程總覽上傳成功後，讓文字欄位外框短暫閃綠，提供明顯回饋
      setOverviewJustSaved(true);
      setTimeout(() => {
        setOverviewJustSaved(false);
      }, 1200);
    } catch (error: any) {
      console.error('❌ [V2 Upload] 課程總覽上傳失敗:', error);

      if (error instanceof Error && error.message === '__REQUEST_TIMEOUT__') {
        setGlobalError(
          '課程總覽上傳逾時：這次上傳超過 120 秒未完成，建議改用穩定的 Wi‑Fi / 區網環境，或先壓縮影片後再試一次。'
        );
      }
    } finally {
      setIsUploading(false);
    }
  };

  // 🔥 重試功能：處理學生上傳失敗的檔案
  const handleRetryFile = async (taskId: string, fileId: string) => {
    if (!selectedCourse || !selectedStudent) {
      console.error('❌ [重試] 缺少課程或學生資訊');
      return;
    }

    const fileToRetry = getFileForRetry(taskId, fileId);
    if (!fileToRetry) {
      console.error('❌ [重試] 找不到要重試的檔案');
      return;
    }

    console.log(`🔄 [重試] 開始重試檔案: ${fileToRetry.file.name}`);

    try {
      // 重置檔案狀態
      retryFile(taskId, fileId);

      // 使用並行上傳管理器重新上傳單個檔案
      await uploadSmallFilesInParallel({
        files: [fileToRetry.file],
        uploadSingleFileFn: async (file) => {
          const result = await uploadStudentRecordMutation.mutateAsync({
            course: selectedCourse,
            student: selectedStudent,
            comment: selectedStudent.comment,
            files: [file],
            onUploadProgress: (event) => {
              const total = event.total || 0;
              if (!total) return;
              const ratio = Math.min(1, Math.max(0, (event.loaded || 0) / total));
              const percent = Math.round(ratio * 100);
              updateFileProgress(taskId, fileId, percent);
            },
          });

            const uploadedUrl =
              result.data?.files?.photos?.find((p: any) => p.name === file.name)?.url ||
              result.data?.files?.videos?.find((v: any) => v.name === file.name)?.url ||
              '';

            return { uploadedUrl };
        },
        onProgress: (_file, percent) => {
          updateFileProgress(taskId, fileId, percent);
        },
        onComplete: (file, uploadedUrl) => {
          completeFile(taskId, fileId, uploadedUrl);
          console.log(`✅ [重試] 檔案重試成功: ${file.name}`);
        },
        onError: (file, error) => {
          updateFileStatus(taskId, fileId, 'error', error);
          console.error(`❌ [重試] 檔案重試失敗: ${file.name}`, error);
        },
      });

    } catch (error) {
      updateFileStatus(taskId, fileId, 'error', error instanceof Error ? error.message : '重試失敗');
      console.error(`❌ [重試] 檔案重試失敗: ${fileToRetry.file.name}`, error);
    }
  };

  // 🔥 重試功能：處理課程總覽上傳失敗的檔案
  const handleRetryOverviewFile = async (fileId: string) => {
    if (!selectedCourse) {
      console.error('❌ [重試總覽] 缺少課程資訊');
      return;
    }

    const fileToRetry = overviewPreviewFiles.find((f) => f.id === fileId);
    if (!fileToRetry) {
      console.error('❌ [重試總覽] 找不到要重試的檔案');
      return;
    }

    console.log(`🔄 [重試總覽] 開始重試檔案: ${fileToRetry.file.name}`);

    try {
      // 重置檔案狀態
      setOverviewPreviewFiles((prev) =>
        prev.map((file) =>
          file.id === fileId
            ? { ...file, status: 'pending' as const, progress: 0, error: undefined }
            : file
        )
      );

      // 判斷檔案類型並使用對應的上傳方式
      const isLargeVideo = isLargeFile(fileToRetry.file.size);

      if (isLargeVideo) {
        // 大影片使用分片上傳
        const semester = 
          (uploadSemester && uploadSemester.trim()) ||
          selectedCourse.semester ||
          (selectedCourse.date ? getCurrentSemesterFromDate(selectedCourse.date) : '');
        const normalizedCourseName = normalizeCourseName(selectedCourse.name);
        const courseTopicForPath = extractCourseTopicForPath(selectedCourse);
        
        await uploadLargeVideosInParallel({
          files: [fileToRetry.file],
          mode: 'overview',
          metadata: {
            semester,
            courseName: normalizedCourseName,
            date: selectedCourse.date,
            topic: courseTopicForPath,
            isOverview: true,
          },
          onProgress: (file, percent) => {
            setOverviewPreviewFiles((prev) =>
              prev.map((entry) =>
                entry.file === file
                  ? { ...entry, progress: percent, status: 'uploading' as const }
                  : entry
              )
            );
          },
          onComplete: (file, uploadedUrl) => {
            setOverviewPreviewFiles((prev) =>
              prev.map((entry) =>
                entry.file === file
                  ? { ...entry, progress: 100, status: 'completed' as const, uploadedUrl }
                  : entry
              )
            );
            console.log(`✅ [重試總覽] 大影片重試成功: ${file.name}`);
          },
          onError: (file, error) => {
            setOverviewPreviewFiles((prev) =>
              prev.map((entry) =>
                entry.file === file
                  ? { ...entry, status: 'error' as const, error }
                  : entry
              )
            );
            console.error(`❌ [重試總覽] 大影片重試失敗: ${file.name}`, error);
          },
        });
      } else {
        // 小檔案直接上傳
        await uploadSmallFilesInParallel({
          files: [fileToRetry.file],
          uploadSingleFileFn: async (file) => {
            const result = await uploadOverviewRecordMutation.mutateAsync({
              course: selectedCourse,
              files: [file],
              onUploadProgress: (event) => {
                const total = event.total || 0;
                if (!total) return;
                const ratio = Math.min(1, Math.max(0, (event.loaded || 0) / total));
                const percent = Math.round(ratio * 100);
                setOverviewPreviewFiles((prev) =>
                  prev.map((entry) =>
                    entry.file === file
                      ? { ...entry, progress: percent, status: 'uploading' as const }
                      : entry
                  )
                );
              },
            });

            // 🔥 「一進一出」機制：課程總覽重試專用 - 基於伺服器回應移除已完成的本地預覽
            console.log('🗑️ [一進一出-課程總覽重試] 移除已完成的本地預覽');
            
            // 從伺服器回應中獲取實際上傳成功的檔案資訊
            const uploadedFiles: { size: number; type: string }[] = [];
            if (result?.data?.files) {
              if (result.data.files.photos) {
                uploadedFiles.push(...result.data.files.photos.map((p: any) => ({
                  size: p.size || 0,
                  type: 'photo'
                })));
              }
              if (result.data.files.videos) {
                uploadedFiles.push(...result.data.files.videos.map((v: any) => ({
                  size: v.size || 0,
                  type: 'video'
                })));
              }
            }
            
            console.log('🔍 [一進一出-課程總覽重試] 伺服器回應檔案:', uploadedFiles);
            
            // 逐個移除已完成的檔案
            setOverviewFiles((prev) => 
              prev.filter(file => {
                const isUploaded = uploadedFiles.some(uploaded => 
                  uploaded.size === file.size && uploaded.type === (file.type.startsWith('image/') ? 'photo' : 'video')
                );
                
                if (isUploaded) {
                  console.log('🗑️ [一進一出-課程總覽重試] 移除本地預覽:', file.name);
                  // 注意：overviewFiles 是原生 File 物件，沒有 preview 屬性
                  // Blob URL 由 overviewPreviewFiles 管理，這裡不需要釋放
                  return false; // 移除這個檔案
                }
                return true; // 保留這個檔案
              })
            );
            
            setOverviewPreviewFiles((prev) =>
              prev.filter(file => {
                const isUploaded = uploadedFiles.some(uploaded => 
                  uploaded.size === file.file.size && uploaded.type === (file.file.type.startsWith('image/') ? 'photo' : 'video')
                );
                
                if (isUploaded) {
                  console.log('🗑️ [一進一出-課程總覽重試] 移除預覽項目:', file.file.name);
                  return false; // 移除這個檔案
                }
                return true; // 保留這個檔案
              })
            );

            const uploadedUrl =
              result.data?.files?.photos?.find((p: any) => p.name === file.name)?.url ||
              result.data?.files?.videos?.find((v: any) => v.name === file.name)?.url ||
              '';
            return { uploadedUrl };
          },
          onProgress: (file, percent) => {
            setOverviewPreviewFiles((prev) =>
              prev.map((entry) =>
                entry.file === file
                  ? { ...entry, progress: percent, status: 'uploading' as const }
                  : entry
              )
            );
          },
          onComplete: (file, uploadedUrl) => {
            setOverviewPreviewFiles((prev) =>
              prev.map((entry) =>
                entry.file === file
                  ? { ...entry, progress: 100, status: 'completed' as const, uploadedUrl }
                  : entry
              )
            );
            console.log(`✅ [重試總覽] 檔案重試成功: ${file.name}`);
          },
          onError: (file, error) => {
            setOverviewPreviewFiles((prev) =>
              prev.map((entry) =>
                entry.file === file
                  ? { ...entry, status: 'error' as const, error }
                  : entry
              )
            );
            console.error(`❌ [重試總覽] 檔案重試失敗: ${file.name}`, error);
          },
        });
      }

    } catch (error) {
      setOverviewPreviewFiles((prev) =>
        prev.map((file) =>
          file.id === fileId
            ? { ...file, status: 'error' as const, error: error instanceof Error ? error.message : '重試失敗' }
            : file
        )
      );
      console.error(`❌ [重試總覽] 檔案重試失敗: ${fileToRetry.file.name}`, error);
    }
  };

  // 合併新上傳的檔案和已上傳的檔案（使用共用 media 工具解析 URL）

  const activeTaskFiles = useMemo(() => {
    if (
      currentTask &&
      selectedCourse &&
      selectedStudent &&
      currentTask.courseId === selectedCourse.id &&
      currentTask.studentId === selectedStudent.id
    ) {
      return currentTask.files;
    }
    return [];
  }, [currentTask, selectedCourse, selectedStudent]);

  const remotePhotos = useMemo(
    () =>
      (learningRecords?.photos || []).map((photo: any, index) => ({
        id: `remote-photo-${photo.name || index}-${index}`,
        name: photo.name || `照片 ${index + 1}`,
        url: resolveMediaUrl(photo.proxyUrl || photo.url),
        size: photo.size || 0,
        type: 'photo' as const,
      })),
    [learningRecords?.photos, resolveMediaUrl]
  );

  const remoteVideos = useMemo(
    () =>
      (learningRecords?.videos || []).map((video: any, index) => ({
        id: `remote-video-${video.name || index}-${index}`,
        name: video.name || `影片 ${index + 1}`,
        url: resolveMediaUrl(video.transcodedProxyUrl || video.proxyUrl || video.url),
        size: video.size || 0,
        type: 'video' as const,
        thumbnailUrl: video.thumbnailProxyUrl
          ? resolveMediaUrl(video.thumbnailProxyUrl)
          : video.thumbnailUrl
          ? resolveMediaUrl(video.thumbnailUrl)
          : video.thumbnail
          ? resolveMediaUrl(video.thumbnail)
          : undefined,
      })),
    [learningRecords?.videos, resolveMediaUrl]
  );

  // const hasRemoteMedia = remotePhotos.length + remoteVideos.length > 0; // 暫時未使用，保留供未來參考

  // 🔥 合併學生上傳：本次上傳 + 已上傳（智能去重）
  const allStudentMediaFiles = useMemo(() => {
    const fileNameSet = new Set<string>();
    const mergedFiles: any[] = [];

    // 1. 先加入本次上傳的檔案（優先顯示，因為有進度狀態）
    activeTaskFiles.forEach((file: any) => {
      const fileName = file.file?.name || file.name;
      if (fileName && !fileNameSet.has(fileName)) {
        fileNameSet.add(fileName);
        mergedFiles.push({
          ...file,
          source: 'local' as const,
        });
      }
    });

    // 2. 再加入遠端照片（排除重複）
    remotePhotos.forEach((photo: any) => {
      if (!fileNameSet.has(photo.name)) {
        fileNameSet.add(photo.name);
        mergedFiles.push({
          id: photo.id,
          name: photo.name,
          url: photo.url,
          size: photo.size,
          type: 'photo' as const,
          status: 'completed' as const,
          progress: 100,
          source: 'remote' as const,
          preview: photo.url, // 使用遠端 URL 作為預覽
        });
      }
    });

    // 3. 最後加入遠端影片（排除重複）
    remoteVideos.forEach((video: any) => {
      if (!fileNameSet.has(video.name)) {
        fileNameSet.add(video.name);
        mergedFiles.push({
          id: video.id,
          name: video.name,
          url: video.url,
          size: video.size,
          type: 'video' as const,
          status: 'completed' as const,
          progress: 100,
          source: 'remote' as const,
          preview: video.thumbnailUrl || video.url, // 預覽用，優先使用縮圖
          thumbnailUrl: video.thumbnailUrl, // 🔥 修復：RemoteMediaCard 需要此屬性顯示縮圖
        });
      }
    });

    return mergedFiles;
  }, [activeTaskFiles, remotePhotos, remoteVideos]);

  // 計算上傳進度
  const uploadProgress = selectedCourse
    ? getUploadProgress(selectedCourse.id)
    : { completed: 0, total: 0 };

  const noStudentsForSelectedCourse =
    !!selectedCourse && !studentsLoading && students.length === 0;

  const allStudentsUploaded =
    uploadProgress.total > 0 && uploadProgress.completed === uploadProgress.total;

  const hasOverviewDirtyNotes =
    !!overviewNotes.studentStatus.trim() ||
    !!overviewNotes.problems.trim() ||
    !!overviewNotes.solutions.trim();

  const isOverviewEditing =
    !overviewUploaded && (hasOverviewDirtyNotes || overviewFiles.length > 0 || overviewPreviewFiles.length > 0);

  const isOverviewTextLoading =
    isCourseOverviewLoading &&
    !overviewUploaded &&
    !isOverviewEditing &&
    !courseOverviewError &&
    !overviewNotes.studentStatus &&
    !overviewNotes.problems &&
    !overviewNotes.solutions;

  // 從 Drive 回填課程總覽（僅在尚未編輯且本地沒有內容時觸發）
  useEffect(() => {
    if (!selectedCourse || !courseOverview) return;

    // 使用者已經開始編輯，避免被 Drive 覆蓋
    if (isOverviewEditing) return;

    const hasLocalNotes =
      !!overviewNotes.studentStatus ||
      !!overviewNotes.problems ||
      !!overviewNotes.solutions;
    const hasLocalPreview = overviewPreviewFiles.length > 0;

    // 若本地已有任何文字或預覽，也不覆蓋
    if (hasLocalNotes || hasLocalPreview) return;

    const summaryText = (courseOverview.summary || '').trim();

    // 若 Drive 僅有媒體但沒有文字摘要，仍標記為已上傳
    if (!summaryText) {
      setOverviewUploaded(true);
      return;
    }

    const parsed = parseOverviewSummary(summaryText);

    setOverviewNotes({
      studentStatus: parsed.studentStatus,
      problems: parsed.problems,
      solutions: parsed.solutions,
    });
    setOverviewUploaded(true);
  }, [
    selectedCourse?.id,
    courseOverview,
    isOverviewEditing,
    overviewNotes.studentStatus,
    overviewNotes.problems,
    overviewNotes.solutions,
    overviewPreviewFiles.length,
  ]);

  const progressSource: any[] = activeTaskFiles as any[];
  const totalFiles = progressSource.length;
  const completedFiles = progressSource.filter((file: any) => file.status === 'completed').length;
  const uploadingFiles = progressSource.filter((file: any) => file.status === 'uploading').length;

  const overviewRemotePhotos = useMemo(
    () =>
      (courseOverview?.photos || []).map((photo: any, index) => ({
        id: `overview-remote-photo-${photo.name || index}-${index}`,
        name: photo.name || `照片 ${index + 1}`,
        url: resolveMediaUrl(photo.proxyUrl || photo.url),
        size: photo.size || 0,
        fileName: photo.fileName || photo.name,
        type: 'photo' as const,
      })),
    [courseOverview?.photos, resolveMediaUrl]
  );

  const overviewRemoteVideos = useMemo(
    () =>
      (courseOverview?.videos || []).map((video: any, index) => ({
        id: `overview-remote-video-${video.name || index}-${index}`,
        name: video.name || `影片 ${index + 1}`,
        url: resolveMediaUrl(video.transcodedProxyUrl || video.proxyUrl || video.url),
        size: video.size || 0,
        fileName: video.fileName || video.name,
        type: 'video' as const,
        thumbnailUrl: video.thumbnailProxyUrl
          ? resolveMediaUrl(video.thumbnailProxyUrl)
          : video.thumbnailUrl
          ? resolveMediaUrl(video.thumbnailUrl)
          : video.thumbnail
          ? resolveMediaUrl(video.thumbnail)
          : undefined,
      })),
    [courseOverview?.videos, resolveMediaUrl]
  );

  // const _hasOverviewRemoteMedia = overviewRemotePhotos.length + overviewRemoteVideos.length > 0; // 暫時未使用，保留供未來參考

  // 🔥 合併課程總覽：本次上傳 + 已上傳（智能去重）
  const allOverviewMediaFiles = useMemo(() => {
    const fileNameSet = new Set<string>();
    const mergedFiles: any[] = [];

    // 1. 先加入本次上傳的檔案（優先顯示，因為有進度狀態）
    overviewPreviewFiles.forEach((file: any) => {
      const fileName = file.file?.name || file.name;
      if (fileName && !fileNameSet.has(fileName)) {
        fileNameSet.add(fileName);
        mergedFiles.push({
          ...file,
          source: 'local' as const,
        });
      }
    });

    // 2. 再加入遠端照片（排除重複）
    overviewRemotePhotos.forEach((photo: any) => {
      if (!fileNameSet.has(photo.name)) {
        fileNameSet.add(photo.name);
        mergedFiles.push({
          id: photo.id,
          name: photo.name,
          url: photo.url,
          size: photo.size,
          fileName: photo.fileName,
          type: 'photo' as const,
          status: 'completed' as const,
          progress: 100,
          source: 'remote' as const,
          preview: photo.url,
        });
      }
    });

    // 3. 最後加入遠端影片（排除重複）
    overviewRemoteVideos.forEach((video: any) => {
      if (!fileNameSet.has(video.name)) {
        fileNameSet.add(video.name);
        mergedFiles.push({
          id: video.id,
          name: video.name,
          url: video.url,
          size: video.size,
          fileName: video.fileName,
          type: 'video' as const,
          status: 'completed' as const,
          progress: 100,
          source: 'remote' as const,
          preview: video.thumbnailUrl || video.url, // 預覽用，優先使用縮圖
          thumbnailUrl: video.thumbnailUrl, // 🔥 修復：RemoteMediaCard 需要此屬性顯示縮圖
        });
      }
    });

    return mergedFiles;
  }, [overviewPreviewFiles, overviewRemotePhotos, overviewRemoteVideos]);

  const logoUrl = import.meta.env.VITE_LOGO_URL || '/logo.jpg';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {isApplyingInitialCourse && (
        <div className="bg-blue-50 border-b border-blue-200 text-blue-700 text-xs sm:text-sm px-4 py-2 text-center animate-pulse">
          正在依行事曆連結載入課程…
        </div>
      )}

      {/* 學期設定彈窗 */}
      {isSemesterDialogOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-4 sm:p-5">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Icon name="overview" size="sm" />
              <span>設定上傳路徑的學期</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mb-3">
              這裡設定的學期字串會用在 Synology Drive 路徑的學期資料夾，例如：
              <span className="font-mono text-gray-800 ml-1">2025上學期</span>
              、
              <span className="font-mono text-gray-800 ml-1">2025下學期</span>
              或
              <span className="font-mono text-gray-800 ml-1">2025寒假營</span>。
              所有上傳（直傳與分片）都會共用這個設定。
            </p>
            <div className="mb-3">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                快速選擇常用學期
              </label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value="__custom__"
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val || val === '__custom__') return;
                  setSemesterDraft(val);
                }}
              >
                <option value="__custom__">手動輸入（自訂學期）</option>
                <option value="2025上學期">2025上學期</option>
                <option value="2025下學期">2025下學期</option>
                <option value="2025寒假營">2025寒假營</option>
                <option value="2025夏令營">2025夏令營</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                學期字串
              </label>
              <input
                type="text"
                value={semesterDraft}
                onChange={(e) => setSemesterDraft(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="例如：2025上學期"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                留空並按「清除自訂」可恢復使用課程本身的學期（或依日期自動判斷）。
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-end gap-2 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsSemesterDialogOpen(false);
                }}
              >
                取消
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  setSemesterOverride(null);
                  setSemesterDraft('');
                  try {
                    window.localStorage.removeItem('flbUploadSemesterOverride');
                  } catch (e) {
                    void e;
                  }
                  try {
                    await apiClient.post('/system-settings', {
                      upload: {
                        semesterLabel: null,
                      },
                    });
                  } catch (e) {
                    // 若後端更新失敗，前端仍維持本地設定，之後可再嘗試
                    void e;
                  }
                  setIsSemesterDialogOpen(false);
                }}
              >
                清除自訂學期
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={async () => {
                  const value = semesterDraft.trim();
                  if (!value) {
                    setSemesterOverride(null);
                    try {
                      window.localStorage.removeItem('flbUploadSemesterOverride');
                    } catch (e) {
                      void e;
                    }
                    try {
                      await apiClient.post('/system-settings', {
                        upload: {
                          semesterLabel: null,
                        },
                      });
                    } catch (e) {
                      void e;
                    }
                    setIsSemesterDialogOpen(false);
                    return;
                  }

                  setSemesterOverride(value);
                  try {
                    window.localStorage.setItem('flbUploadSemesterOverride', value);
                  } catch (e) {
                    void e;
                  }

                  try {
                    await apiClient.post('/system-settings', {
                      upload: {
                        semesterLabel: value,
                      },
                    });
                  } catch (e) {
                    void e;
                  }

                  setIsSemesterDialogOpen(false);
                }}
              >
                儲存學期設定
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <img
                src={logoUrl}
                alt="Fun Learn Bar"
                className="h-9 w-9 rounded-full shadow-sm border border-gray-200 object-cover"
              />
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900 leading-snug">
                  學習歷程上傳中心
                </h1>
                {selectedCourse ? (
                  <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1 flex flex-wrap items-center gap-1">
                    {selectedCourse && (
                      <button
                        type="button"
                        onClick={handleEditSemester}
                        className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        title="點擊修改上傳路徑使用的學期字串（會套用到所有上傳）"
                      >
                        <span>{uploadSemester || selectedCourse.semester || '設定學期'}</span>
                        {semesterOverride && (
                          <span className="ml-1 text-[10px] text-blue-500">自訂</span>
                        )}
                      </button>
                    )}
                    <span className="whitespace-normal break-words">
                      {selectedCourse.name} · {selectedCourse.date}
                      {selectedCourse.time && ` · ${selectedCourse.time}`}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                    請先從右上角「📅 切換課程」選擇要上傳的課程
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCourseDrawerOpen(true)}
                disabled={todayCoursesLoading}
              >
                📅 切換課程
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Global error banner */}
      {globalError && (
        <div className="bg-red-50 border-b border-red-200 text-red-800">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between text-xs sm:text-sm">
            <span className="mr-3 truncate">{globalError}</span>
            <button
              type="button"
              onClick={() => setGlobalError(null)}
              className="ml-2 text-red-700 hover:text-red-900 font-medium flex-shrink-0"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      {/* 課程總覽頁面：底部固定操作列 */}
      {currentPage === 'overview' && selectedCourse && (hasOverviewDirtyNotes || overviewFiles.length > 0) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 backdrop-blur px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-xs sm:text-sm text-gray-700">
              {hasOverviewDirtyNotes ? '已編輯課程總覽文字' : '尚未編輯課程總覽文字'}
              {overviewFiles.length > 0 && `，選擇 ${overviewFiles.length} 個檔案`}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="md"
                onClick={() => {
                  overviewPreviewFiles.forEach((file) => {
                    if (file.preview) URL.revokeObjectURL(file.preview);
                  });
                  setOverviewFiles([]);
                  setOverviewPreviewFiles([]);
                }}
                disabled={isUploading || overviewFiles.length === 0}
              >
                清除全部
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleStartOverviewUpload}
                disabled={
                  isUploading || (!hasOverviewDirtyNotes && overviewFiles.length === 0)
                }
                loading={isUploading}
              >
                <span className="inline-flex items-center gap-1">
                  <Icon name="overview" size="sm" />
                  <span>上傳課程總覽</span>
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation（sticky，方便滾動時切換） */}
      <nav className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="flex overflow-x-auto no-scrollbar space-x-3 sm:space-x-8">
            {/* 課程選擇 Tab */}
            {!initialCourseParams && (
              <button
                onClick={() => setCurrentPage('courses')}
                className={`flex-1 whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm sm:text-base ${
                  currentPage === 'courses'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col items-center gap-0.5">
                  <div className="flex items-center justify-center gap-1">
                    <Icon name="student" size="sm" />
                    <span>課程選擇</span>
                  </div>
                </div>
              </button>
            )}

            {/* 學生管理 Tab */}
            <button
              onClick={() => setCurrentPage('students')}
              disabled={!selectedCourse}
              className={`flex-1 whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm sm:text-base ${
                currentPage === 'students'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center justify-center gap-1">
                  <Icon name="students" size="sm" />
                  <span>學生管理</span>
                  {selectedCourse && students.length > 0 && (
                    <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                      {students.length}
                    </span>
                  )}
                </div>
                {noStudentsForSelectedCourse && (
                  <span className="text-[10px] text-yellow-600">無學生名單</span>
                )}
              </div>
            </button>

            {/* 課程總覽 Tab */}
            <button
              onClick={() => setCurrentPage('overview')}
              disabled={!selectedCourse}
              className={`flex-1 whitespace-nowrap py-3 px-2 border-b-2 font-medium text-sm sm:text-base ${
                currentPage === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center justify-center gap-1">
                  <Icon name="overview" size="sm" />
                  <span>課程總覽</span>
                </div>
                {overviewUploaded || selectedCourse?.overviewUploaded || (indexOverviewStatus && (indexOverviewStatus.hasPhotos || indexOverviewStatus.hasVideos || indexOverviewStatus.hasSummary)) ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    已上傳
                  </span>
                ) : isOverviewEditing ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                    編輯中
                  </span>
                ) : allStudentsUploaded ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    建議填寫
                  </span>
                ) : null}
              </div>
            </button>
          </div>
          <div className="py-1.5 text-center text-[11px] text-gray-600 overflow-x-auto no-scrollbar">
            <div className="inline-flex items-center justify-center gap-1 sm:gap-2 whitespace-nowrap">
              <span className="hidden sm:inline mr-1">操作流程：</span>
              {[
                { id: 1, label: '選課' },
                { id: 2, label: '選學生' },
                { id: 3, label: '上傳 / 寫評語' },
                { id: 4, label: '課程總覽' },
              ].map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={
                    noStudentsForSelectedCourse && (step.id === 2 || step.id === 3)
                      ? undefined
                      : () => handleStepClick(step.id)
                  }
                  disabled={noStudentsForSelectedCourse && (step.id === 2 || step.id === 3)}
                  className="inline-flex items-center gap-1 focus:outline-none disabled:opacity-60"
                >
                  <span
                    className={`inline-flex items-center justify-center rounded-full border px-1.5 py-0.5 text-[10px] ${
                      noStudentsForSelectedCourse && (step.id === 2 || step.id === 3)
                        ? 'bg-red-50 text-red-500 border-red-200'
                        : currentStep === step.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : step.id < currentStep
                        ? 'bg-blue-50 text-blue-600 border-blue-100'
                        : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    {step.id}
                  </span>
                  <span
                    className={
                      'whitespace-nowrap ' +
                      (noStudentsForSelectedCourse && (step.id === 2 || step.id === 3)
                        ? 'text-red-600'
                        : currentStep === step.id
                        ? 'font-semibold text-blue-700'
                        : '')
                    }
                  >
                    {step.label}
                    {noStudentsForSelectedCourse && (step.id === 2 || step.id === 3) && (
                      <span className="hidden sm:inline">（不需要）</span>
                    )}
                  </span>
                  {index < 3 && <span className="text-gray-400 mx-0.5">→</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main
        className="flex-1 w-full px-2 py-8 sm:px-6 lg:px-8"
        onWheel={handleGlobalWheel}
      >
        {/* 課程選擇頁面（支援今日 / 本週 / 全部 + 篩選） */}
        {currentPage === 'courses' && (
          <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">📅 選擇課程</h2>
                <p className="text-xs sm:text-sm text-gray-500 mt-1">
                  先從下方列表選擇一堂課程，再進入學生管理與上傳流程
                </p>
              </div>
              <div className="flex items-center rounded-full border border-gray-200 bg-white overflow-hidden text-[9px] sm:text-[10px] md:text-[11px] shrink-0 w-32 sm:w-36 md:w-40">
                <button
                  type="button"
                  onClick={() => setCourseRange('today')}
                  className={`flex-1 px-1 py-1 sm:px-2 sm:py-1.5 text-center ${
                    courseRange === 'today' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="sm:hidden">今</span>
                  <span className="hidden sm:inline">今日</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCourseRange('week')}
                  className={`flex-1 px-1 py-1 sm:px-2 sm:py-1.5 text-center border-l border-gray-200 ${
                    courseRange === 'week' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="sm:hidden">週</span>
                  <span className="hidden sm:inline">本週</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCourseRange('all')}
                  className={`flex-1 px-1 py-1 sm:px-2 sm:py-1.5 text-center border-l border-gray-200 ${
                    courseRange === 'all' ? 'bg-blue-50 text-blue-700' : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <span className="sm:hidden">全</span>
                  <span className="hidden sm:inline">全部</span>
                </button>
              </div>
            </div>

            {/* 篩選列 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs sm:text-sm">
              <div className="flex flex-col gap-1">
                <span className="text-gray-600">講師</span>
                <select
                  value={filterInstructor}
                  onChange={(e) => setFilterInstructor(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-xs sm:text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部講師</option>
                  {instructorOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-600">課別</span>
                <select
                  value={filterCourseType}
                  onChange={(e) => setFilterCourseType(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-xs sm:text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部課別</option>
                  {courseTypeOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-600">週次</span>
                <select
                  value={filterWeek}
                  onChange={(e) => setFilterWeek(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-xs sm:text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">全部週次</option>
                  {weekOptions.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-gray-600">關鍵字</span>
                <input
                  type="text"
                  value={filterKeyword}
                  onChange={(e) => setFilterKeyword(e.target.value)}
                  placeholder="課名、地點…"
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {activeCoursesError && (
              <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 flex items-start gap-2">
                <span className="mt-0.5">⚠️</span>
                <div className="flex-1 flex flex-wrap items-center gap-1">
                  <span>無法載入課程列表，請稍後再試。</span>
                  {courseRange === 'today' && (
                    <button
                      type="button"
                      onClick={() => refetchTodayCourses()}
                      className="text-[11px] text-red-700 underline decoration-dotted"
                    >
                      重試
                    </button>
                  )}
                </div>
              </div>
            )}

            <CourseList
              courses={filteredCourses}
              selectedId={selectedCourse?.id}
              onSelect={handleCourseSelect}
              loading={!!activeCoursesLoading}
              emptyMessage={
                activeCoursesLoading
                  ? '正在載入課程…'
                  : courseRange === 'today'
                  ? '今日沒有課程'
                  : '沒有符合條件的課程'
              }
              keyboardFocusIndex={courseKeyboardIndex}
            />
          </div>
        )}

        {/* Slider：學生列表 / 上傳・評語 / 課程總覽 */}
        {selectedCourse && currentPage !== 'courses' && (
          <div
            className="overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            <div
              ref={sliderRef}
              className={`flex w-full ${isDragging ? '' : 'transition-transform duration-200 ease-out'}`}
              style={{ transform: `translate3d(${sliderTranslate}%, 0, 0)` }}
            >
              {/* Panel 0：學生列表 */}
              <div className="w-full flex-shrink-0 pr-2 sm:pr-4">
                <div className="space-y-6">
                  <div className={`flex items-center justify-between ${currentSliderIndex === 0 ? 'fade-in-soft' : ''}`}>
                    <div>
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <Icon name="students" size="md" />
                        <span>學生管理</span>
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        在此檢視並選擇學生，查看出缺席與上傳狀態
                      </p>
                      {studentsError && (
                        <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 flex items-start gap-2">
                          <span className="mt-0.5">⚠️</span>
                          <div className="flex-1 flex flex-wrap items-center gap-1">
                            <span>無法載入學生名單，請稍後再試。</span>
                            <button
                              type="button"
                              onClick={() => refetchStudents()}
                              className="text-[11px] text-red-700 underline decoration-dotted"
                            >
                              重試
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 上傳進度 */}
                  {uploadProgress.total > 0 && (
                    <UploadProgress
                      completed={uploadProgress.completed}
                      total={uploadProgress.total}
                    />
                  )}

                  {/* 🗑️ [隱藏 2025-11-26] 集中索引摘要已移除以節省版面空間 */}
                  {/* {courseIndexSummary && (...)} */}
                  {/* {courseIndexError && (...)} */}

                  {/* 子檢視模式提示（這裡只顯示目前選擇學生）*/}
                  <div className="flex items-center justify-between pt-1">
                    <div className="inline-flex items-center bg-gray-100 rounded-full px-2 py-1 text-[11px] text-gray-600">
                      <span>檢視模式：學生列表（向左滑動可前往「上傳 / 評語」）</span>
                    </div>
                    {selectedStudent && (
                      <div className="text-xs text-gray-600">
                        目前選擇：
                        <span className="font-semibold ml-1">{selectedStudent.name}</span>
                      </div>
                    )}
                  </div>

                  {/* 學生列表 */}
                  <StudentList
                    students={students}
                    selectedId={selectedStudent?.id}
                    onSelect={handleStudentSelect}
                    loading={studentsLoading}
                    emptyMessage="此課程沒有學生"
                    showUploadStatus={true}
                    keyboardFocusIndex={studentKeyboardIndex}
                    indexUploadsByStudentId={indexUploadsByStudentId}
                    onOpenMedia={(student: Student) => {
                      selectStudent(student);
                      setIsMediaDrawerOpen(true);
                    }}
                  />

                  {selectedStudent && (
                    <p className="text-xs text-gray-500">
                      已選擇 {selectedStudent.name}，可滑動到「上傳 / 評語」或點擊上方 pill 進行媒體上傳。
                    </p>
                  )}
                </div>
              </div>

              {/* Panel 1：上傳 / 評語 */}
              <div className="w-full flex-shrink-0 px-1 sm:px-2">
                <div className="space-y-6">
                  <div className={`flex items-center justify-between ${currentSliderIndex === 1 ? 'fade-in-soft' : ''}`}>
                    <div>
                      <h2 className="text-xl font-bold flex items-center gap-2">
                        <Icon name="upload" size="md" />
                        <span>上傳 / 評語</span>
                      </h2>
                      <p className="text-sm text-gray-600 mt-1">
                        針對單一學生上傳學習紀錄與撰寫評語
                      </p>
                    </div>
                    <div className="text-xs text-gray-600 text-right space-y-1">
                      <button
                        type="button"
                        onClick={() => setStudentViewMode('list')}
                        className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                      >
                        <span>← 返回學生列表</span>
                      </button>
                      <div>向右滑回學生列表</div>
                      <div>向左滑前往課程總覽</div>
                    </div>
                  </div>

                  {!selectedStudent && (
                    <div className="mt-2 border border-dashed border-yellow-300 rounded-xl p-4 bg-yellow-50 text-xs text-yellow-800">
                      請先在「學生列表」檢視中選擇一位學生，才能進行上傳與評語編輯。
                    </div>
                  )}

                  {selectedStudent && (
                    <>
                      {/* 評語編輯器 */}
                      <CommentEditor
                        studentId={selectedStudent.id}
                        studentName={selectedStudent.name}
                        // 若 Drive 中已有評語記錄，優先使用以實現「重新整理後回填」
                        initialComment={learningRecords?.comment ?? selectedStudent.comment}
                        commentHistory={learningRecords?.commentHistory}
                        onSave={(comment) => {
                          updateCommentMutation.mutate({
                            id: selectedStudent.id,
                            comment,
                            course: selectedCourse,
                            student: selectedStudent,
                          });
                        }}
                        loading={isLearningRecordsLoading || updateCommentMutation.isPending}
                        success={updateCommentMutation.isSuccess}
                        error={updateCommentMutation.isError}
                      />

                      {/* 上傳器（學生上傳）*/}
                      {!isLearningRecordsLoading && (
                        <MediaUploader
                          onFilesSelect={handleFilesSelect}
                          accept="image/*,video/*"
                          multiple={true}
                          maxFiles={20}
                          disabled={isUploading}
                          compact={allStudentMediaFiles.length > 0}
                        />
                      )}

                      {/* 🔥 統一檔案區塊：合併本次上傳與已上傳（智能去重）*/}
                      <div className="relative min-h-[220px]">
                        {isLearningRecordsLoading && allStudentMediaFiles.length === 0 && (
                          <div className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white/80 shadow-sm px-4 py-3 animate-pulse skeleton-animate">
                            <div className="flex items-center justify-between mb-3">
                              <div className="h-4 bg-blue-100 rounded w-32" />
                              <div className="h-3 bg-blue-50 rounded w-24" />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="h-24 bg-blue-50 rounded-xl" />
                              ))}
                            </div>
                          </div>
                        )}

                        {!isLearningRecordsLoading && allStudentMediaFiles.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-base font-medium flex items-center gap-2">
                                <Icon name="upload" size="sm" />
                                <span>學習紀錄</span>
                              </h4>
                              <span className="text-sm text-gray-500">
                                共 {allStudentMediaFiles.length} 個檔案
                              </span>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {allStudentMediaFiles.map((file: any) => {
                                // 本地上傳中的檔案
                                if (file.source === 'local') {
                                  return (
                                    <FilePreview
                                      key={file.id}
                                      file={file}
                                      onRemove={() => {
                                        if (currentTask && file.id.startsWith('file-')) {
                                          removeFile(currentTask.id, file.id);
                                        }
                                      }}
                                      onRetry={() => {
                                        if (currentTask && file.id.startsWith('file-')) {
                                          handleRetryFile(currentTask.id, file.id);
                                        }
                                      }}
                                      showProgress={true}
                                    />
                                  );
                                }
                                // 遠端已上傳的檔案
                                return (
                                  <RemoteMediaCard
                                    key={file.id}
                                    {...file}
                                    onPreview={() =>
                                      handlePreviewMedia({
                                        type: file.type,
                                        url: file.url,
                                        name: file.name,
                                      })
                                    }
                                    onDelete={() => handleDeleteRemoteMedia(file.name)}
                                    deleting={deletingFileName === file.name}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {!isLearningRecordsLoading && allStudentMediaFiles.length === 0 && (
                          <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600 flex flex-col items-center gap-1">
                            <span className="text-lg">📁</span>
                            <span className="font-medium text-gray-800">目前沒有任何檔案</span>
                            <span className="text-xs">請選擇照片或影片上傳學習紀錄</span>
                          </div>
                        )}
                      </div>

                      {/* 檔案預覽：包含本次選擇與既有上傳記錄 */}
                      {/* <div className="relative min-h-[220px]">
                        {activeTaskFiles.length > 0 && (
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-base font-medium">
                                本次選擇 {activeTaskFiles.length} 個檔案
                              </h4>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {activeTaskFiles.map((file: any) => (
                                <FilePreview
                                  key={file.id}
                                  file={file}
                                  onRemove={() => {
                                    if (currentTask && file.id.startsWith('file-')) {
                                      removeFile(currentTask.id, file.id);
                                    }
                                  }}
                                  onRetry={() => {
                                    if (currentTask && file.id.startsWith('file-')) {
                                      handleRetryFile(currentTask.id, file.id);
                                    }
                                  }}
                                  showProgress={true}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {isLearningRecordsLoading && activeTaskFiles.length === 0 && (
                          <div className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white/80 shadow-sm px-4 py-3 animate-pulse skeleton-animate">
                            <div className="flex items-center justify-between mb-3">
                              <div className="h-4 bg-blue-100 rounded w-32" />
                              <div className="h-3 bg-blue-50 rounded w-24" />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {[0, 1, 2, 3].map((i) => (
                                <div key={i} className="h-24 bg-blue-50 rounded-xl" />
                              ))}
                            </div>
                          </div>
                        )}

                        {!isLearningRecordsLoading && hasRemoteMedia && (
                          <div className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white/80 shadow-sm px-4 py-3 fade-in-soft">
                            <div className="flex items-center justify-between">
                              <h4 className="text-base font-medium flex items-center gap-2">
                                <Icon name="drive" size="sm" />
                                <span>已上傳</span>
                              </h4>
                              <span className="text-sm text-gray-500">
                                共 {remotePhotos.length + remoteVideos.length} 個檔案（{remotePhotos.length} 張照片、{remoteVideos.length} 支影片）
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              這裡是過去已成功上傳到 Drive 的紀錄，可直接預覽或刪除，不影響本次新增的檔案。
                            </p>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {remotePhotos.map((photo) => (
                                <RemoteMediaCard
                                  key={photo.id}
                                  {...photo}
                                  onPreview={() =>
                                    handlePreviewMedia({
                                      type: 'photo',
                                      url: photo.url,
                                      name: photo.name,
                                    })
                                  }
                                  onDelete={() => handleDeleteRemoteMedia(photo.name)}
                                  deleting={deletingFileName === photo.name}
                                />
                              ))}
                              {remoteVideos.map((video) => (
                                <RemoteMediaCard
                                  key={video.id}
                                  {...video}
                                  onPreview={() =>
                                    handlePreviewMedia({
                                      type: 'video',
                                      url: video.url,
                                      name: video.name,
                                    })
                                  }
                                  onDelete={() => handleDeleteRemoteMedia(video.name)}
                                  deleting={deletingFileName === video.name}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {!isLearningRecordsLoading && activeTaskFiles.length === 0 && !hasRemoteMedia && (
                          <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600 flex flex-col items-center gap-1">
                            <span className="text-lg">📁</span>
                            <span className="font-medium text-gray-800">目前沒有任何檔案</span>
                            <span className="text-xs text-gray-500">
                              尚未選擇任何檔案，也沒有既有 Drive 紀錄。
                            </span>
                          </div>
                        )}
                      </div> */}
                    </>
                  )}
                </div>
              </div>

              {/* Panel 2：課程總覽 */}
              <div className="w-full flex-shrink-0 pl-2 sm:pl-4">
                {selectedCourse && (
                  <div className="space-y-6">
                    <div className={`flex items-center justify-between ${currentSliderIndex === 2 ? 'fade-in-soft' : ''}`}>
                      <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                          <Icon name="overview" size="lg" />
                          <span>課程總覽</span>
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                          為整堂課留下總結與共用照片／影片紀錄
                        </p>
                        {isCourseOverviewLoading && (
                          <p className="text-xs text-gray-500 mt-1">正在從 Drive 載入課程總覽…</p>
                        )}
                        {courseOverviewError && (
                          <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 flex items-start gap-2">
                            <span className="mt-0.5">⚠️</span>
                            <div className="flex-1">
                              無法載入課程總覽，您仍可直接編輯文字與上傳檔案。
                            </div>
                          </div>
                        )}
                        {overviewJustSaved && !isUploading && !courseOverviewError && (
                          <p className="text-xs text-green-600 mt-1">課程總覽已上傳</p>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 text-right">
                        <div>向右滑回上傳 / 評語</div>
                      </div>
                    </div>

                    <div className="space-y-4 rounded-xl border border-gray-200 bg-white/80 shadow-sm px-4 py-3">
                      <p className="text-xs text-gray-500">
                        這裡用來記錄整堂課的重點與活動照片，不與個別學生綁定。
                      </p>

                      {/* 學生的狀況與表現 */}
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-700">
                          👀 學生的狀況與表現
                        </label>
                        {isOverviewTextLoading ? (
                          <div className="space-y-2 animate-pulse skeleton-animate">
                            <div className="h-3 bg-blue-100 rounded w-24" />
                            <div className="h-4 bg-blue-50 rounded w-full" />
                            <div className="h-4 bg-blue-50 rounded w-5/6" />
                          </div>
                        ) : (
                          <textarea
                            ref={overviewStudentStatusRef}
                            className={`w-full border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 fade-in-soft ${
                              overviewJustSaved
                                ? 'border-green-400 ring-2 ring-green-300 animate-pulse'
                                : 'border-gray-300'
                            }`}
                            rows={3}
                            placeholder="例如：學生整體專注度如何？對課程內容的反應、參與度⋯⋯"
                            value={overviewNotes.studentStatus}
                            onChange={(e) =>
                              setOverviewNotes((prev) => ({ ...prev, studentStatus: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                overviewProblemsRef.current?.focus();
                              }
                            }}
                          />
                        )}
                      </div>

                      {/* 遇到的問題 */}
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-700">
                          ⚠️ 遇到的問題
                        </label>
                        {isOverviewTextLoading ? (
                          <div className="space-y-2 animate-pulse skeleton-animate">
                            <div className="h-3 bg-blue-100 rounded w-20" />
                            <div className="h-4 bg-blue-50 rounded w-full" />
                            <div className="h-4 bg-blue-50 rounded w-4/5" />
                          </div>
                        ) : (
                          <textarea
                            ref={overviewProblemsRef}
                            className={`w-full border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              overviewJustSaved
                                ? 'border-green-400 ring-2 ring-green-300 animate-pulse'
                                : 'border-gray-300'
                            }`}
                            rows={3}
                            placeholder="例如：哪些概念學生比較不熟？在哪些活動中看出理解有困難⋯⋯"
                            value={overviewNotes.problems}
                            onChange={(e) =>
                              setOverviewNotes((prev) => ({ ...prev, problems: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                overviewStudentStatusRef.current?.focus();
                              } else if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                overviewSolutionsRef.current?.focus();
                              }
                            }}
                          />
                        )}
                      </div>

                      {/* 解決的方法 */}
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-gray-700">
                          💡 解決的方法
                        </label>
                        {isOverviewTextLoading ? (
                          <div className="space-y-2 animate-pulse skeleton-animate">
                            <div className="h-3 bg-blue-100 rounded w-20" />
                            <div className="h-4 bg-blue-50 rounded w-full" />
                            <div className="h-4 bg-blue-50 rounded w-2/3" />
                          </div>
                        ) : (
                          <textarea
                            ref={overviewSolutionsRef}
                            className={`w-full border rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                              overviewJustSaved
                                ? 'border-green-400 ring-2 ring-green-300 animate-pulse'
                                : 'border-gray-300'
                            }`}
                            rows={3}
                            placeholder="例如：使用什麼教學策略、舉例方式或分組活動來協助學生理解⋯⋯"
                            value={overviewNotes.solutions}
                            onChange={(e) =>
                              setOverviewNotes((prev) => ({ ...prev, solutions: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                overviewProblemsRef.current?.focus();
                              }
                            }}
                          />
                        )}
                      </div>
                    </div>

                    {/* 上傳器（課程總覽）*/}
                    {!isCourseOverviewLoading && (
                      <MediaUploader
                        onFilesSelect={handleOverviewFilesSelect}
                        accept="image/*,video/*"
                        multiple={true}
                        maxFiles={20}
                        disabled={isUploading}
                        compact={allOverviewMediaFiles.length > 0}
                      />
                    )}

                    {/* 🔥 統一檔案區塊：合併本次上傳與已上傳（智能去重）*/}
                    <div className="mt-4 space-y-4">
                      {isCourseOverviewLoading && allOverviewMediaFiles.length === 0 && (
                        <div className="space-y-3 rounded-xl border border-gray-200 bg-white/80 shadow-sm px-4 py-3 animate-pulse skeleton-animate">
                          <div className="flex items-center justify-between mb-3">
                            <div className="h-4 bg-blue-100 rounded w-32" />
                            <div className="h-3 bg-blue-50 rounded w-24" />
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {[0, 1, 2, 3].map((i) => (
                              <div key={i} className="h-24 bg-blue-50 rounded-xl" />
                            ))}
                          </div>
                        </div>
                      )}

                      {!isCourseOverviewLoading && allOverviewMediaFiles.length > 0 && (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-base font-medium flex items-center gap-2">
                              <Icon name="overview" size="sm" />
                              <span>課程總覽媒體</span>
                            </h4>
                            <span className="text-sm text-gray-500">
                              共 {allOverviewMediaFiles.length} 個檔案
                            </span>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {allOverviewMediaFiles.map((file: any) => {
                              // 本地上傳中的檔案
                              if (file.source === 'local') {
                                return (
                                  <FilePreview
                                    key={file.id}
                                    file={file}
                                    showProgress={true}
                                    onRemove={() => {
                                      if (file.preview) {
                                        URL.revokeObjectURL(file.preview);
                                      }
                                      setOverviewPreviewFiles((prev) =>
                                        prev.filter((f) => f.id !== file.id)
                                      );
                                      setOverviewFiles((prev) =>
                                        prev.filter((f) => f !== file.file)
                                      );
                                    }}
                                    onRetry={() => {
                                      handleRetryOverviewFile(file.id);
                                    }}
                                  />
                                );
                              }
                              // 遠端已上傳的檔案
                              return (
                                <RemoteMediaCard
                                  key={file.id}
                                  {...file}
                                  onPreview={() =>
                                    handlePreviewMedia({
                                      type: file.type,
                                      url: file.url,
                                      name: file.name,
                                    })
                                  }
                                  onDelete={() => handleDeleteOverviewMedia(file.fileName || file.name)}
                                  deleting={overviewDeletingFileName === (file.fileName || file.name)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {!isCourseOverviewLoading && allOverviewMediaFiles.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600 flex flex-col items-center gap-1">
                          <span className="text-lg">📁</span>
                          <span className="font-medium text-gray-800">目前沒有任何檔案</span>
                          <span className="text-xs">請選擇照片或影片上傳課程總覽紀錄</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </main>

      {/* 學生管理頁：右側媒體抽屜 */}
      {selectedCourse && selectedStudent && (
        <StudentMediaDrawer
          open={isMediaDrawerOpen}
          course={selectedCourse}
          student={selectedStudent}
          photos={remotePhotos}
          videos={remoteVideos}
          loading={isLearningRecordsLoading}
          error={hasLearningRecordsError}
          deletingFileName={deletingFileName}
          onClose={() => setIsMediaDrawerOpen(false)}
          onPreview={handlePreviewMedia}
          onDelete={handleDeleteRemoteMedia}
          onRetry={() => refetchLearningRecords()}
        />
      )}

      {/* 課程選擇抽屜：使用今日課程列表，若 deep link 帶 instructor 則在 Drawer 內預設只顯示該講師課程 */}
      <CourseDrawer
        open={isCourseDrawerOpen}
        courses={Array.isArray(todayCourses) ? todayCourses : []}
        instructorCode={initialCourseParams?.instructor}
        selectedCourse={selectedCourse}
        loading={todayCoursesLoading}
        onSelect={handleCourseSelect as any}
        onClose={() => setIsCourseDrawerOpen(false)}
      />

      {/* 學生上傳：底部固定操作列（行動裝置友善） */}
      {currentPage === 'students' && selectedStudent && selectedCourse && activeTaskFiles.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-white/95 backdrop-blur px-4 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-700">
              總共 {totalFiles} 個檔案，已完成 {completedFiles} 個
              {uploadingFiles > 0 && (
                <span>，上傳中 {uploadingFiles} 個</span>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="md"
                onClick={() => currentTask && clearTask(currentTask.id)}
                disabled={isUploading}
              >
                清除全部
              </Button>
              <Button
                variant="primary"
                size="md"
                onClick={handleStartUpload}
                disabled={isUploading}
                loading={isUploading}
              >
                <span className="inline-flex items-center gap-1">
                  <Icon name="upload" size="sm" />
                  <span>{isUploading ? '上傳中…' : '開始上傳'}</span>
                </span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            powered by 樂程坊 FunLearnBar © 2025
          </p>
        </div>
      </footer>

      {previewMedia && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4" onClick={handleClosePreview}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <p
                  className="text-xs sm:text-sm font-medium text-gray-900 truncate max-w-full break-all"
                  title={previewMedia.name}
                >
                  {previewMedia.name}
                </p>
                <p className="text-xs text-gray-500">點擊任意空白處即可關閉</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleClosePreview}>
                關閉
              </Button>
            </div>
            <div className="rounded-xl overflow-hidden bg-gray-100 max-h-[80vh] flex items-center justify-center">
              {previewMedia.type === 'photo' ? (
                <img src={previewMedia.url} alt={previewMedia.name} className="max-w-full max-h-[75vh] object-contain" />
              ) : (
                <video
                  src={previewMedia.url}
                  controls
                  className="w-full max-h-[75vh]"
                  playsInline
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
