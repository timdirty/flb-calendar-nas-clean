import { useMemo, useState } from 'react';
import type { Course } from '../../types';
import { CourseList } from './CourseList';
import { Button } from '../ui/Button';

interface CourseDrawerProps {
  open: boolean;
  courses: Course[];
  selectedCourse: Course | null;
  loading: boolean;
  onSelect: (course: Course) => void;
  onClose: () => void;
  instructorCode?: string;
}

export function CourseDrawer({
  open,
  courses,
  selectedCourse,
  loading,
  onSelect,
  onClose,
  instructorCode,
}: CourseDrawerProps) {
  if (!open) return null;

  const [filterMode, setFilterMode] = useState<'instructor' | 'all'>(
    instructorCode ? 'instructor' : 'all'
  );

  const hasInstructorFilter = !!instructorCode;

  const displayCourses = useMemo(() => {
    if (!hasInstructorFilter || filterMode === 'all' || !instructorCode) {
      return courses;
    }

    const code = instructorCode.trim().toLowerCase();

    return courses.filter((course) => {
      const teacherName = (course.teacherName || '').trim().toLowerCase();
      const teacherId = (course.teacherId || '').trim().toLowerCase();

      return teacherId === code || teacherName.includes(code);
    });
  }, [courses, filterMode, hasInstructorFilter, instructorCode]);

  const total = courses.length;
  const hasCourses = total > 0;

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl h-full flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">今日課程</p>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mt-1">
              <span>📅 選擇課程</span>
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            關閉
          </Button>
        </div>

        <div className="px-4 py-2 border-b text-xs text-gray-600 flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span>
              {loading ? (
                <span className="text-gray-500">正在載入今日課程…</span>
              ) : hasCourses ? (
                <>
                  今日共有 <span className="font-medium text-gray-900">{total}</span> 堂課
                </>
              ) : (
                <span className="text-gray-500">今日沒有課程</span>
              )}
            </span>
            {hasInstructorFilter && !loading && displayCourses.length > 0 && (
              <span className="text-[11px] text-gray-500">
                目前顯示 {displayCourses.length} 堂課程
              </span>
            )}
          </div>

          <div className="flex flex-col items-end gap-1">
            {selectedCourse && !loading && (
              <span className="text-[11px] text-blue-600 truncate max-w-[160px]">
                目前：{selectedCourse.name}
              </span>
            )}

            {hasInstructorFilter && !loading && hasCourses && (
              <div className="inline-flex items-center rounded-full border border-gray-200 bg-white overflow-hidden text-[11px]">
                <button
                  type="button"
                  onClick={() => setFilterMode('instructor')}
                  className={`px-2 py-0.5 ${
                    filterMode === 'instructor'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  只看此講師
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-2 py-0.5 border-l border-gray-200 ${
                    filterMode === 'all'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  顯示全部
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <CourseList
            courses={displayCourses}
            selectedId={selectedCourse?.id}
            onSelect={(course) => {
              onSelect(course);
              onClose();
            }}
            loading={loading}
            emptyMessage="今日沒有課程"
            variant="horizontal"
          />
        </div>
      </div>
    </div>
  );
}
