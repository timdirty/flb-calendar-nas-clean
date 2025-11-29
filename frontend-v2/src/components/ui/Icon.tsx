import type { FC } from 'react';

/**
 * 共用線條 ICON 元件（小型自訂集合，避免額外依賴）
 */
export type IconName =
  | 'student'
  | 'students'
  | 'upload'
  | 'overview'
  | 'drive'
  | 'camera'
  | 'video';

interface IconProps {
  name: IconName;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap: Record<NonNullable<IconProps['size']>, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-6 w-6',
};

export const Icon: FC<IconProps> = ({ name, className = '', size = 'md' }) => {
  const base = `inline-block ${sizeMap[size]} ${className}`;

  switch (name) {
    case 'student':
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="8" r="3.2" />
          <path d="M5.5 19.25C6.8 16.8 9.2 15.25 12 15.25s5.2 1.55 6.5 4" />
        </svg>
      );
    case 'students':
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="8" r="2.8" />
          <circle cx="17" cy="9" r="2.4" />
          <path d="M4 19c.9-2.3 2.8-3.8 5-3.8 2.2 0 4.1 1.5 5 3.8" />
          <path d="M14.4 15.2c1.8.2 3.3 1.3 4.1 3.3" />
        </svg>
      );
    case 'upload':
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 16V5" />
          <path d="M8.5 8.5 12 5l3.5 3.5" />
          <rect x="4" y="16" width="16" height="3" rx="1.5" />
        </svg>
      );
    case 'overview':
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="5" y="4" width="14" height="16" rx="2" />
          <path d="M9 9h6M9 13h4" />
        </svg>
      );
    case 'drive':
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7.5 4.5h9l3 5.2-4.5 7.8h-9L2 12.3l5.5-7.8Z" />
          <path d="M2 12.3h6.2M15.8 12.3H22" />
        </svg>
      );
    case 'camera':
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="6" width="18" height="13" rx="3" />
          <path d="M8 6.5 9.7 4h4.6L16 6.5" />
          <circle cx="12" cy="12.5" r="3.3" />
        </svg>
      );
    case 'video':
      return (
        <svg
          className={base}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="4" y="6" width="11" height="12" rx="2" />
          <path d="m15 10 4-2.5v8L15 13" />
        </svg>
      );
    default:
      return null;
  }
};
