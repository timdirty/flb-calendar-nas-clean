/**
 * Card 卡片元件
 */
import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  hoverable?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Card({
  children,
  title,
  subtitle,
  actions,
  hoverable = false,
  onClick,
  className = '',
}: CardProps) {
  const baseClasses = 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-200';
  const hoverClasses = hoverable
    ? 'cursor-pointer hover:shadow-md hover:border-blue-200 active:scale-[0.99]'
    : '';

  return (
    <div
      className={`${baseClasses} ${hoverClasses} ${className}`}
      onClick={onClick}
    >
      {(title || subtitle || actions) && (
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-200 flex items-start justify-between">
          <div>
            {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
            {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex gap-2">{actions}</div>}
        </div>
      )}
      <div className="px-3 py-2.5 sm:px-4 sm:py-4 md:px-5 md:py-5">{children}</div>
    </div>
  );
}
