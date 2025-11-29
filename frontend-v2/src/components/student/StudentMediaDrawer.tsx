import type { Course, Student } from '../../types';
import { RemoteMediaCard } from '../upload/RemoteMediaCard';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

interface StudentMediaDrawerProps {
  open: boolean;
  course: Course;
  student: Student;
  photos: Array<{ id: string; name: string; url: string; size: number }>;
  videos: Array<{ id: string; name: string; url: string; size: number; thumbnailUrl?: string }>;
  loading: boolean;
  error?: boolean;
  deletingFileName?: string | null;
  onClose: () => void;
  onPreview: (params: { type: 'photo' | 'video'; url: string; name: string }) => void;
  onDelete: (fileName: string) => void;
  onRetry?: () => void;
}

export function StudentMediaDrawer({
  open,
  course,
  student,
  photos,
  videos,
  loading,
  error,
  deletingFileName,
  onClose,
  onPreview,
  onDelete,
  onRetry,
}: StudentMediaDrawerProps) {
  if (!open) return null;

  const total = photos.length + videos.length;

  return (
    <div className="fixed inset-0 z-30 flex justify-end">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-full max-w-md bg-white shadow-xl h-full flex flex-col">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 truncate">{course.name}</p>
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2 mt-1">
              <Icon name="drive" size="md" />
              <span>學生檔案</span>
              <span className="text-gray-700">{student.name}</span>
            </h2>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            關閉
          </Button>
        </div>

        <div className="px-4 py-2 border-b bg-gray-50 text-xs text-gray-600">
          {loading ? (
            <span className="text-gray-500">正在從 Drive 載入紀錄…</span>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-700 flex items-start gap-2">
              <span className="mt-0.5">⚠️</span>
              <div className="flex-1 flex flex-wrap items-center gap-1">
                <span>無法載入 Drive 紀錄</span>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="text-[11px] text-red-700 underline decoration-dotted"
                  >
                    重試
                  </button>
                )}
              </div>
            </div>
          ) : (
            <span>
              已上傳檔案：
              <span className="font-medium text-gray-900">{total}</span> 個
              <span className="ml-1 text-gray-500">
                （{photos.length} 張照片、{videos.length} 部影片）
              </span>
            </span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 bg-gray-100 rounded-lg border border-gray-200 animate-pulse skeleton-animate"
                />
              ))}
            </div>
          )}

          {total === 0 && !loading && !error && (
            <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-600 flex flex-col items-center gap-1">
              <span className="text-lg">📁</span>
              <span className="font-medium text-gray-800">尚未有任何 Drive 上傳紀錄</span>
              <span className="text-xs text-gray-500">
                之後從媒體上傳頁面成功上傳的檔案，會自動出現在這裡。
              </span>
            </div>
          )}

          {!loading && error && (
            <div className="mt-4 rounded-xl border border-dashed border-red-300 bg-red-50 px-4 py-6 text-center text-sm text-red-700 flex flex-col items-center gap-1">
              <span className="text-lg">⚠️</span>
              <span className="font-medium">無法載入 Drive 紀錄</span>
              <span className="text-xs text-red-600">
                請稍後再試。您仍可回到媒體上傳頁面繼續上傳新檔案。
              </span>
            </div>
          )}

          {total > 0 && (
            <div className="fade-in-soft">
              {photos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-800">📷 照片</span>
                    <span className="text-gray-500 text-xs">{photos.length} 張</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {photos.map((photo) => (
                      <RemoteMediaCard
                        key={photo.id}
                        id={photo.id}
                        name={photo.name}
                        url={photo.url}
                        size={photo.size}
                        type="photo"
                        onPreview={() =>
                          onPreview({
                            type: 'photo',
                            url: photo.url,
                            name: photo.name,
                          })
                        }
                        onDelete={() => onDelete(photo.name)}
                        deleting={deletingFileName === photo.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {videos.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="font-medium text-gray-800">🎬 影片</span>
                    <span className="text-gray-500 text-xs">{videos.length} 部</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {videos.map((video) => (
                      <RemoteMediaCard
                        key={video.id}
                        id={video.id}
                        name={video.name}
                        url={video.url}
                        size={video.size}
                        type="video"
                        thumbnailUrl={video.thumbnailUrl}
                        onPreview={() =>
                          onPreview({
                            type: 'video',
                            url: video.url,
                            name: video.name,
                          })
                        }
                        onDelete={() => onDelete(video.name)}
                        deleting={deletingFileName === video.name}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
