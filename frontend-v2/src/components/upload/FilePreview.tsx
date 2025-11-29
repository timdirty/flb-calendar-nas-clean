/**
 * 檔案預覽元件
 */
import { memo, useState, useRef, useEffect } from 'react';
import type { MediaFile } from '../../types';
import { ProgressBar } from '../ui/ProgressBar';

interface FilePreviewProps {
  file: MediaFile;
  onRemove?: () => void;
  showProgress?: boolean;
  onRetry?: () => void;
}

function FilePreviewComponent({ file, onRemove, showProgress = true, onRetry }: FilePreviewProps) {
  const [imageError, setImageError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);

  const statusConfig = {
    pending: { label: '等待中', color: 'bg-gray-100 text-gray-700' },
    uploading: { label: '上傳中', color: 'bg-blue-100 text-blue-700' },
    completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
    error: { label: '錯誤', color: 'bg-red-100 text-red-700' },
  };

  useEffect(() => {
    if (file.type !== 'video') return;
    
    // 🔥 修復：優先使用後端提供的 thumbnailUrl
    if (file.thumbnailUrl) {
      setVideoThumbnail(file.thumbnailUrl);
      return;
    }
    
    const src = file.url || file.preview;
    if (!src) return;

    let cancelled = false;
    const video = document.createElement('video');
    video.src = src;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const handleLoadedMetadata = () => {
      if (cancelled) return;
      try {
        video.currentTime = 0.2;
      } catch {}
    };

    const handleSeeked = () => {
      if (cancelled) return;
      const width = video.videoWidth || 320;
      const height = video.videoHeight || 180;
      if (!width || !height) return;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      try {
        ctx.drawImage(video, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setVideoThumbnail(dataUrl);
      } catch {}
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('seeked', handleSeeked);
      video.src = '';
    };
  }, [file.type, file.url, file.preview, file.thumbnailUrl]);

  const config = statusConfig[file.status];

  const startLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
    }
    longPressTimer.current = window.setTimeout(() => {
      setIsPreviewOpen(true);
    }, 500);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // 格式化檔案大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="relative group bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* 預覽圖片/影片 */}
      <div
        className="aspect-[4/3] bg-gray-100 relative overflow-hidden"
        onMouseDown={startLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
        onTouchStart={startLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
      >
        {file.type === 'photo' && (file.preview || file.url) && !imageError ? (
          <img
            src={file.url || file.preview}
            alt={file.file.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : file.type === 'video' && (videoThumbnail || file.preview || file.url) ? (
          <img
            src={videoThumbnail || file.preview || file.url}
            alt={file.file.name}
            loading="lazy"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl">
              {file.type === 'photo' ? '🖼️' : '🎬'}
            </span>
          </div>
        )}

        {/* 上傳進度覆蓋層 */}
        {showProgress && file.status === 'uploading' && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white">
            <div className="w-4/5">
              <ProgressBar
                value={file.progress}
                max={100}
                showPercentage={false}
                size="sm"
                // 使用預設藍色進度條，與整體淺藍主色系對齊
              />
              {file.progress < 100 ? (
                <p className="text-xs text-center mt-2">{file.progress}%</p>
              ) : (
                <p className="text-xs text-center mt-2 leading-snug">
                  已傳送到伺服器，正在寫入 Drive（可能需要一段時間），請勿關閉此頁面
                </p>
              )}
            </div>
          </div>
        )}

        {/* 完成標記 */}
        {file.status === 'completed' && (
          <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
            ✓
          </div>
        )}

        {/* 錯誤標記 */}
        {file.status === 'error' && (
          <div className="absolute inset-0 bg-red-500/90 flex items-center justify-center text-white">
            <div className="text-center px-4">
              <p className="text-2xl mb-2">✗</p>
              <p className="text-xs mb-3">{file.error || '上傳失敗'}</p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="bg-white text-red-500 px-3 py-1 rounded-full text-xs font-medium hover:bg-red-50 active:scale-95 transition-all"
                  title="重新上傳"
                >
                  🔄 重試
                </button>
              )}
            </div>
          </div>
        )}

        {/* 刪除按鈕（行動裝置預設可見，桌機以 hover 顯示） */}
        {onRemove && file.status !== 'uploading' && (
          <button
            onClick={onRemove}
            className="absolute top-2 left-2 bg-red-500 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity hover:bg-red-600 active:scale-95"
            title="移除"
          >
            ✕
          </button>
        )}
      </div>

      {/* 檔案資訊 */}
      <div className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className={`text-xs px-2 py-1 rounded-full ${config.color}`}>
            {config.label}
          </span>
          <span className="text-xs text-gray-500">
            {formatSize(file.metadata?.size || 0)}
          </span>
        </div>
        <p className="text-xs text-gray-600 truncate" title={file.file.name}>
          {file.file.name}
        </p>
      </div>

      {/* 長按放大預覽 */}
      {isPreviewOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div className="max-w-4xl max-h-full">
            {file.type === 'photo' ? (
              <img
                src={file.url || file.preview}
                alt={file.file.name}
                loading="lazy"
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <video
                src={file.url || file.preview}
                className="max-w-full max-h-full"
                controls
                autoPlay
                muted
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const FilePreview = memo(FilePreviewComponent);
