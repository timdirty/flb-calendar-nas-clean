/**
 * 課程卡片元件
 */
import type { Course } from '../../types';
import { Card } from '../ui/Card';

interface CourseCardProps {
  course: Course;
  onClick?: () => void;
  selected?: boolean;
  keyboardFocused?: boolean;
}

export function CourseCard({ course, onClick, selected = false, keyboardFocused = false }: CourseCardProps) {
  // 🚫 [新增 2025-11-27] 檢測停課/請假，禁用課程點擊
  const isCancelled = course.name && (course.name.includes('停課') || course.name.includes('請假'));
  
  return (
    <Card
      hoverable={!isCancelled}
      onClick={isCancelled ? undefined : onClick}
      className={`w-full ${
        isCancelled
          ? 'ring-2 ring-red-500 border-red-200 bg-red-50/30 opacity-75 cursor-not-allowed'
          : selected
          ? 'ring-2 ring-blue-500 border-blue-100 bg-blue-50/40 selected-flash'
          : keyboardFocused
          ? 'ring-2 ring-blue-300 border-blue-100 bg-blue-50/20'
          : ''
      }`}
    >
      <div className="space-y-2 sm:space-y-3 md:space-y-4">
        {/* 🚫 停課/請假警告標示 */}
        {isCancelled && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-100 border border-red-300 rounded-lg">
            <span className="text-red-600 text-sm font-semibold">🚫 停課不可使用</span>
          </div>
        )}
        
        {/* 課程名稱 + 週數 + 狀態 */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-gray-900 text-sm sm:text-base md:text-lg flex-1 leading-tight sm:leading-snug">
            {course.name}
          </h3>
          <div className="flex items-center gap-1 flex-shrink-0">
            {course.weekNumber && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-[11px] md:text-xs text-indigo-600 border border-indigo-100">
                第 {course.weekNumber} 週
              </span>
            )}
            {course.weekNumber && (
              <span className="sm:hidden inline-flex items-center px-1.5 py-0.5 rounded-full bg-indigo-50 text-[10px] text-indigo-600 border border-indigo-100">
                第{course.weekNumber}週
              </span>
            )}
            {selected && (
              <span className="hidden md:inline-flex text-[11px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                ✓ 已選擇
              </span>
            )}
            {selected && (
              <span className="md:hidden text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-medium">
                ✓
              </span>
            )}
          </div>
        </div>

        {/* 手機版：合併資訊到一行 */}
        <div className="sm:hidden flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span>📅</span>
            <span>{course.date}</span>
          </span>
          <span className="text-gray-300">•</span>
          <span className="inline-flex items-center gap-1">
            <span>🕐</span>
            <span>{course.time}</span>
          </span>
          <span className="text-gray-300">•</span>
          <span className="inline-flex items-center gap-1">
            <span>📍</span>
            <span>{course.location}</span>
          </span>
          {course.teacherName && (
            <>
              <span className="text-gray-300">•</span>
              <span className="inline-flex items-center gap-1">
                <span>👨‍🏫</span>
                <span>{course.teacherName}</span>
              </span>
            </>
          )}
        </div>

        {/* 桌面版：分行顯示詳細資訊 */}
        <div className="hidden sm:block space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="inline-block w-5 text-center">📅</span>
            <span>{course.date}</span>
            <span className="text-gray-400">|</span>
            <span>{course.time}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span className="inline-block w-5 text-center">📍</span>
            <span>{course.location}</span>
          </div>
          {course.teacherName && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="inline-block w-5 text-center">👨‍🏫</span>
              <span>{course.teacherName}</span>
            </div>
          )}
        </div>

        {/* 手機版：緊湊統計 */}
        <div className="sm:hidden flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-gray-100 text-[10px]">
          <span className="inline-flex items-center gap-1 text-gray-600">
            <span>👥</span>
            <span className="font-medium">{course.studentCount}</span>
          </span>
          
          {typeof course.uploadedStudentCount === 'number' && (
            <>
              <span className="text-gray-300">•</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                已上傳 {course.uploadedStudentCount}
              </span>
            </>
          )}
          
          {typeof course.totalUploadedFiles === 'number' && course.totalUploadedFiles > 0 && (
            <>
              <span className="text-gray-300">•</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
                {course.totalUploadedFiles} 個檔案
              </span>
            </>
          )}
          
          {typeof course.overviewUploaded === 'boolean' && course.overviewUploaded && (
            <>
              <span className="text-gray-300">•</span>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="mr-0.5">✓</span>
                總覽
              </span>
            </>
          )}
        </div>

        {/* 桌面版：詳細統計 */}
        <div className="hidden sm:block pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block w-5 text-center">👥</span>
                <span className="text-gray-600">{course.studentCount} 位學生</span>
              </div>
              
              {typeof course.uploadedStudentCount === 'number' && (
                <div className="pl-7 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                    已上傳 {course.uploadedStudentCount} / 總學生 {course.studentCount}
                  </span>
                  {typeof course.totalUploadedFiles === 'number' && course.totalUploadedFiles > 0 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200">
                      共 {course.totalUploadedFiles} 個檔案
                    </span>
                  )}
                </div>
              )}

              {typeof course.overviewUploaded === 'boolean' && (
                <div className="pl-7 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full border font-medium ${
                      course.overviewUploaded
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-gray-50 text-gray-500 border-gray-200'
                    }`}
                  >
                    <span className="mr-1">📋</span>
                    {course.overviewUploaded ? '課程總覽已上傳' : '課程總覽尚未上傳'}
                  </span>
                  {course.overviewUploaded && course.overviewFileCount && course.overviewFileCount > 0 && (
                    <span className="text-gray-500">
                      （{course.overviewFileCount} 個檔案）
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
