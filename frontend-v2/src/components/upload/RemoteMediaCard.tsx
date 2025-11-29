import type { FC } from 'react';
import { memo } from 'react';

interface RemoteMediaCardProps {
  id?: string;
  name: string;
  url: string;
  size: number;
  type: 'photo' | 'video';
  // 原始檔名（例如 photos-meta.json / videos-meta.json 中的 fileName），
  // 僅供上層元件在刪除時傳遞，不參與畫面顯示
  fileName?: string;
  thumbnailUrl?: string;
  onPreview?: () => void;
  onDelete?: () => void;
  deleting?: boolean;
}

const RemoteMediaCardComponent: FC<RemoteMediaCardProps> = ({
  name,
  url,
  size,
  type,
  thumbnailUrl,
  onPreview,
  onDelete,
  deleting = false,
}) => {
  const icon = type === 'photo' ? '🖼️' : '🎬';

  const formatSize = (bytes: number) => {
    if (!bytes) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow relative">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
            <p
              className="text-xs font-medium text-gray-900 truncate whitespace-nowrap"
              title={name}
            >
              {name}
            </p>
            <span className="text-[10px] text-gray-500 whitespace-nowrap">
              {formatSize(size)}
            </span>
          </div>
        </div>

        <div
          className={`relative rounded-lg overflow-hidden bg-gray-100 aspect-[4/3] ${
            onPreview ? 'cursor-pointer group' : ''
          }`}
          onClick={onPreview}
        >
          {type === 'photo' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-500 text-sm animate-pulse">
              <span>載入預覽中…</span>
            </div>
          )}

          {type === 'photo' ? (
            <img
              src={url}
              alt={name}
              loading="lazy"
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                'opacity-100'
              }`}
            />
          ) : thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={name}
              loading="lazy"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-100">
              <span className="text-4xl mb-1">🎬</span>
              <span className="text-xs opacity-80">影片</span>
            </div>
          )}

          {onPreview && (
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition flex items-center justify-center text-white text-sm">
              <span className="px-3 py-1 rounded-full bg-black/60">點擊預覽</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md py-1 transition whitespace-nowrap"
        >
          在新分頁開啟
        </a>
        {onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="px-2 py-1 text-xs text-red-600 border border-red-200 rounded-md hover:bg-red-50 active:scale-95 disabled:opacity-50 whitespace-nowrap"
            disabled={deleting}
          >
            {deleting ? '刪除中…' : '刪除'}
          </button>
        )}
      </div>

      {deleting && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-red-600 text-sm rounded-lg">
          刪除中…
        </div>
      )}
    </div>
  );
};

export const RemoteMediaCard = memo(RemoteMediaCardComponent);
