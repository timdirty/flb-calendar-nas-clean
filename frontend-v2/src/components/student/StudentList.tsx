/**
 * 學生列表元件
 */
import { memo, useMemo } from 'react';
import type { Student } from '../../types';
import { StudentCard } from './StudentCard';

interface StudentListProps {
  students: Student[];
  selectedId?: string;
  onSelect?: (student: Student) => void;
  loading?: boolean;
  emptyMessage?: string;
  showUploadStatus?: boolean;
  filterAttendance?: Student['attendance'] | 'all';
  onOpenMedia?: (student: Student) => void;
  keyboardFocusIndex?: number | null;
  indexUploadsByStudentId?: Record<string, any>;
}

function StudentListComponent({
  students,
  selectedId,
  onSelect,
  loading = false,
  emptyMessage = '暫無學生',
  showUploadStatus = true,
  filterAttendance = 'all',
  onOpenMedia,
  keyboardFocusIndex = null,
}: StudentListProps) {
  // 篩選學生
  const filteredStudents = useMemo(
    () =>
      filterAttendance === 'all'
        ? students
        : students.filter((s) => s.attendance === filterAttendance),
    [students, filterAttendance]
  );

  // 統計資訊（必須在任何條件 return 之前宣告，避免 Hooks 順序變動）
  const stats = useMemo(
    () => ({
      total: students.length,
      present: students.filter((s) => s.attendance === 'present').length,
      absent: students.filter((s) => s.attendance === 'absent').length,
      leave: students.filter((s) => s.attendance === 'leave').length,
    }),
    [students]
  );

  if (loading) {
    return (
      <div className="-mx-2 sm:-mx-4 space-y-3">
        {/* 統計摘要骨架 */}
        <div className="h-10 rounded-xl bg-blue-100 animate-pulse skeleton-animate" />

        {/* 學生卡片骨架 */}
        <div className="space-y-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3 flex items-center justify-between gap-3 animate-pulse skeleton-animate"
            >
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-blue-100 rounded w-28" />
                <div className="h-3 bg-blue-50 rounded w-40" />
              </div>
              <div className="w-20 h-6 bg-blue-50 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (filteredStudents.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">👥 {emptyMessage}</p>
      </div>
    );
  }

  const gridColsClass =
    filteredStudents.length === 1
      ? 'grid-cols-1'
      : 'grid-cols-1 sm:grid-cols-2';

  return (
    <div className="-mx-2 sm:-mx-4">
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white shadow-sm px-3 sm:px-5 py-3 fade-in-soft">
        {/* 統計摘要 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <span>總數：</span>
            <span className="font-semibold text-gray-900">{stats.total}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>出席：</span>
            <span className="font-semibold text-green-700">{stats.present}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span>請假：</span>
            <span className="font-semibold text-yellow-700">{stats.leave}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>缺席：</span>
            <span className="font-semibold text-red-700">{stats.absent}</span>
          </div>
        </div>

        {/* 學生卡片網格 */}
        <div className={`grid ${gridColsClass} gap-3 sm:gap-4`}>
          {filteredStudents.map((student, index) => (
            <StudentCard
              key={student.id}
              student={student}
              selected={student.id === selectedId}
              keyboardFocused={keyboardFocusIndex === index}
              onClick={() => onSelect?.(student)}
              showUploadStatus={showUploadStatus}
              onOpenMedia={onOpenMedia ? () => onOpenMedia(student) : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const StudentList = memo(StudentListComponent);
