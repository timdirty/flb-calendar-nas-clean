interface UploadProgressProps {
  completed: number;
  total: number;
  className?: string;
}

export function UploadProgress({ completed, total, className = '' }: UploadProgressProps) {
  const percentage = total > 0 ? (completed / total) * 100 : 0;

  return (
    <div className={`flex items-center justify-between text-xs sm:text-sm text-gray-600 ${className}`}>
      <div className="flex items-center gap-2">
        <span>上傳進度</span>
        <span className="font-medium">
          {completed} / {total} 位學生
        </span>
      </div>
      <div className="flex-1 ml-3 flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all"
            style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }}
          />
        </div>
        {percentage === 100 && (
          <span className="text-blue-600 font-medium whitespace-nowrap">✓ 全部完成</span>
        )}
      </div>
    </div>
  );
}
