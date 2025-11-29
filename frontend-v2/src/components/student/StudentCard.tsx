/**
 * 學生卡片元件
 */
import type { Student } from '../../types';
import { Card } from '../ui/Card';
import { Icon } from '../ui/Icon';

interface StudentCardProps {
  student: Student;
  onClick?: () => void;
  selected?: boolean;
  showUploadStatus?: boolean;
  onOpenMedia?: () => void;
}

export function StudentCard({
  student,
  onClick,
  selected = false,
  showUploadStatus = true,
  onOpenMedia,
  keyboardFocused = false,
}: StudentCardProps & { keyboardFocused?: boolean }) {
  const attendanceConfig = {
    present: { label: '出席', color: 'bg-green-100 text-green-700', icon: '✓' },
    absent: { label: '缺席', color: 'bg-red-100 text-red-700', icon: '✗' },
    leave: { label: '請假', color: 'bg-yellow-100 text-yellow-700', icon: '!' },
    unknown: { label: '未標記', color: 'bg-yellow-50 text-yellow-700 border border-yellow-200', icon: '?' },
  } as const;

  const config = attendanceConfig[student.attendance];

  const photosCount = student.uploadStatus?.photos || 0;
  const videosCount = student.uploadStatus?.videos || 0;

  return (
    <Card
      hoverable
      onClick={onClick}
      className={`w-full ${selected
        ? 'ring-2 ring-blue-500 border-blue-100 bg-blue-50/40 selected-flash'
        : keyboardFocused
        ? 'ring-2 ring-blue-300 border-blue-100 bg-blue-50/20'
        : ''}`}
    >
      <div className="space-y-3">
        {/* 學生名稱與出席狀態 */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-semibold text-gray-900 text-base sm:text-lg flex items-center gap-2 truncate leading-snug">
              <Icon name="student" />
              <span className="truncate">{student.name}</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {onOpenMedia && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMedia();
                }}
                className="px-2 py-1 text-xs rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-100 inline-flex items-center gap-1"
              >
                <Icon name="drive" size="sm" />
                <span>檔案</span>
              </button>
            )}
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${config.color}`}
            >
              <span>{config.icon}</span>
              <span>{config.label}</span>
            </span>
          </div>
        </div>

        {/* 簡易檔案概況（評語 / 照片 / 影片） */}
        {showUploadStatus && (
          <div className="flex flex-wrap gap-2 text-[11px] text-gray-600">
            <span
              className={`px-2 py-0.5 rounded-full border ${
                student.uploadOverview?.hasComment || (student.comment && student.comment.length > 0)
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              💬 評語
              <span className="ml-1">
                {student.uploadOverview?.hasComment || (student.comment && student.comment.length > 0)
                  ? '✓'
                  : '–'}
              </span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                photosCount > 0
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              <Icon name="camera" size="sm" />
              <span>照片</span>
              <span className="ml-0.5 font-semibold">{photosCount}</span>
            </span>
            <span
              className={`px-2 py-0.5 rounded-full border inline-flex items-center gap-1 ${
                videosCount > 0
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-gray-200 bg-gray-50 text-gray-500'
              }`}
            >
              <Icon name="video" size="sm" />
              <span>影片</span>
              <span className="ml-0.5 font-semibold">{videosCount}</span>
            </span>
          </div>
        )}

        {/* 最後上傳時間（只保留一行） */}
        {showUploadStatus && student.attendance === 'present' && student.uploadOverview && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span>⏱ 最後上傳</span>
              <span className="text-gray-500">
                {student.uploadOverview.lastUploadAt
                  ? new Date(student.uploadOverview.lastUploadAt).toLocaleTimeString('zh-TW', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: false,
                    })
                  : '尚未上傳'}
              </span>
            </div>
          </div>
        )}

        {/* 請假或缺席提示 */}
        {student.attendance !== 'present' && student.attendance !== 'unknown' && (
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center">
              {student.attendance === 'leave' ? '請假無需上傳' : '缺席無需上傳'}
            </p>
          </div>
        )}

        {/* 選中指示器 */}
        {selected && (
          <div className="pt-2 border-t border-gray-100">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 text-[11px] font-medium">
              ✓ 已選擇
            </span>
          </div>
        )}
      </div>
    </Card>
  );
}
