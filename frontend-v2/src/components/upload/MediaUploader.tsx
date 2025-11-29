/**
 * 媒體上傳器元件
 */
import { useRef } from 'react';
import { Button } from '../ui/Button';

const MAX_FILE_SIZE_MB = 600;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

interface MediaUploaderProps {
  onFilesSelect: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  disabled?: boolean;
  compact?: boolean;
}

export function MediaUploader({
  onFilesSelect,
  accept = 'image/*,video/*',
  multiple = true,
  maxFiles = 20,
  disabled = false,
  compact = false,
}: MediaUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) return;

    const oversizedFiles = files.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
    const validFilesBySize = files.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);

    if (oversizedFiles.length > 0) {
      const names = oversizedFiles
        .map((file) => `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`)
        .join('\n');
      alert(`以下檔案超過單檔 ${MAX_FILE_SIZE_MB}MB 上限，已略過：\n${names}`);
    }

    // 限制檔案數量
    const selectedFiles = validFilesBySize.slice(0, maxFiles);

    if (selectedFiles.length > 0) {
      onFilesSelect(selectedFiles);
    }

    // 重置 input 以允許重複選擇相同檔案
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const files = Array.from(event.dataTransfer.files);

    // 過濾符合 accept 的檔案
    const validTypeFiles = files.filter((file) => {
      if (accept.includes('image/*') && file.type.startsWith('image/')) return true;
      if (accept.includes('video/*') && file.type.startsWith('video/')) return true;
      return false;
    });

    if (validTypeFiles.length === 0) return;

    const oversizedFiles = validTypeFiles.filter((file) => file.size > MAX_FILE_SIZE_BYTES);
    const validFilesBySize = validTypeFiles.filter((file) => file.size <= MAX_FILE_SIZE_BYTES);

    if (oversizedFiles.length > 0) {
      const names = oversizedFiles
        .map((file) => `${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`)
        .join('\n');
      alert(`以下檔案超過單檔 ${MAX_FILE_SIZE_MB}MB 上限，已略過：\n${names}`);
    }

    if (validFilesBySize.length > 0) {
      const selectedFiles = validFilesBySize.slice(0, maxFiles);
      onFilesSelect(selectedFiles);
    }
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
      />

      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg text-center
          transition-colors
          ${
            disabled
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50 cursor-pointer'
          }
        `}
        onClick={disabled ? undefined : handleClick}
        style={{ padding: compact ? '0.4rem 0.75rem' : '2rem' }}
      >
        <div className={`${compact ? 'space-y-1 text-xs' : 'space-y-4'}`}>
          {/* 圖示 */}
          <div className={compact ? 'text-xl' : 'text-5xl'}>📁</div>

          {/* 標題 */}
          <div>
            <h3 className={`${compact ? 'text-xs' : 'text-lg'} font-semibold text-gray-900 mb-0.5`}>
              {compact ? '新增更多檔案' : '選擇或拖曳檔案'}
            </h3>
            {!compact && (
              <p className="text-sm text-gray-600">
                支援照片與影片，最多 {maxFiles} 個檔案
              </p>
            )}
          </div>

          {/* 按鈕 */}
          {!disabled && (
            <Button
              variant="primary"
              size={compact ? 'sm' : 'md'}
              onClick={(e) => {
                e.stopPropagation();
                handleClick();
              }}
            >
              {compact ? '新增檔案' : '選擇檔案'}
            </Button>
          )}

          {/* 提示 */}
          {!compact && (
            <div className="text-xs text-gray-500 space-y-1">
              <p>✓ 支援 JPG、PNG、GIF、MP4、MOV 等格式</p>
              <p>✓ 單個檔案最大 600MB</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
