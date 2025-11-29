/**
 * 出席狀態切換元件
 */
import type { Student } from '../../types';

interface AttendanceToggleProps {
  value: Student['attendance'];
  onChange: (value: Student['attendance']) => void;
  disabled?: boolean;
}

export function AttendanceToggle({
  value,
  onChange,
  disabled = false,
}: AttendanceToggleProps) {
  const options: Array<{
    value: Student['attendance'];
    label: string;
    icon: string;
    color: string;
  }> = [
    { value: 'present', label: '出席', icon: '✓', color: 'green' },
    { value: 'leave', label: '請假', icon: '!', color: 'yellow' },
    { value: 'absent', label: '缺席', icon: '✗', color: 'red' },
  ];

  return (
    <div className="inline-flex rounded-lg border border-gray-300 bg-white p-1">
      {options.map((option) => {
        const isActive = value === option.value;
        const colorClasses = {
          green: isActive
            ? 'bg-green-500 text-white'
            : 'text-gray-700 hover:bg-green-50',
          yellow: isActive
            ? 'bg-yellow-500 text-white'
            : 'text-gray-700 hover:bg-yellow-50',
          red: isActive
            ? 'bg-red-500 text-white'
            : 'text-gray-700 hover:bg-red-50',
        };

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`
              px-4 py-2 rounded-md text-sm font-medium transition-all
              focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
              ${colorClasses[option.color as keyof typeof colorClasses]}
            `}
          >
            <span className="flex items-center gap-1.5">
              <span>{option.icon}</span>
              <span>{option.label}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
