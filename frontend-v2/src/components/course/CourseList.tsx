/**
 * 課程列表元件
 */
import { memo } from 'react';
import type { Course } from '../../types';
import { CourseCard } from './CourseCard';

interface CourseListProps {
  courses: Course[];
  selectedId?: string;
  onSelect?: (course: Course) => void;
  loading?: boolean;
  emptyMessage?: string;
  // layout 變體：預設為 grid，全寬頁面使用；drawer 內可用 horizontal 橫向滑動排列
  variant?: 'grid' | 'horizontal';
  keyboardFocusIndex?: number | null;
}

function CourseListComponent({
  courses,
  selectedId,
  onSelect,
  loading = false,
  emptyMessage = '暫無課程',
  variant = 'grid',
  keyboardFocusIndex = null,
}: CourseListProps) {
  if (loading) {
    const skeletonItems = [0, 1, 2, 3, 4, 5, 6, 7, 8];

    if (variant === 'horizontal') {
      return (
        <div className="grid grid-cols-1 gap-3">
          {skeletonItems.map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3 space-y-3 animate-pulse skeleton-animate"
            >
              <div className="h-4 bg-blue-100 rounded w-40" />
              <div className="h-3 bg-blue-50 rounded w-32" />
              <div className="h-3 bg-blue-50 rounded w-24" />
              <div className="h-8 bg-blue-50 rounded w-full" />
            </div>
          ))}
        </div>
      );
    }

    // 一般多欄 grid 下的骨架
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {skeletonItems.map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3 space-y-3 animate-pulse skeleton-animate"
          >
            <div className="h-4 bg-blue-100 rounded w-40" />
            <div className="h-3 bg-blue-50 rounded w-32" />
            <div className="h-3 bg-blue-50 rounded w-24" />
            <div className="h-8 bg-blue-50 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">📚 {emptyMessage}</p>
      </div>
    );
  }

  if (variant === 'horizontal') {
    // 抽屜內使用：固定單欄，直向滾動檢視課程
    return (
      <div className="grid grid-cols-1 gap-3 fade-in-soft">
        {courses.map((course, index) => (
          <CourseCard
            key={`${course.id}-${index}`}
            course={course}
            selected={course.id === selectedId}
            keyboardFocused={keyboardFocusIndex === index}
            onClick={() => onSelect?.(course)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 fade-in-soft">
      {courses.map((course, index) => (
        <CourseCard
          key={`${course.id}-${index}`}
          course={course}
          selected={course.id === selectedId}
          keyboardFocused={keyboardFocusIndex === index}
          onClick={() => onSelect?.(course)}
        />
      ))}
    </div>
  );
}

export const CourseList = memo(CourseListComponent);
