/**
 * Theme Toggle Button Component
 * 다크/라이트 테마 전환 버튼
 */
import React from 'react';

import { useTheme } from '../hooks/useTheme';

interface ThemeToggleProps {
  /** 버튼 크기 */
  size?: 'sm' | 'md' | 'lg';
  /** 버튼 스타일 */
  variant?: 'icon' | 'text' | 'both';
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 테마 토글 버튼
 *
 * @example
 * ```tsx
 * // 아이콘만
 * <ThemeToggle variant="icon" />
 *
 * // 텍스트 포함
 * <ThemeToggle variant="both" size="lg" />
 * ```
 */
export function ThemeToggle({
  size = 'md',
  variant = 'icon',
  className = '',
}: ThemeToggleProps) {
  const { theme, toggleTheme, isDark } = useTheme();

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  const icon = isDark ? '☀️' : '🌙';
  const label = isDark ? '라이트 모드' : '다크 모드';

  return (
    <button
      onClick={toggleTheme}
      className={`
        theme-toggle
        inline-flex items-center justify-center
        rounded-lg
        transition-all duration-200
        hover:scale-110 active:scale-95
        focus:outline-none focus:ring-2 focus:ring-offset-2
        ${isDark
          ? 'bg-gray-700 hover:bg-gray-600 text-yellow-300 focus:ring-yellow-500'
          : 'bg-gray-100 hover:bg-gray-200 text-indigo-600 focus:ring-indigo-500'
        }
        ${sizeClasses[size]}
        ${className}
      `}
      title={`${label}로 전환`}
      aria-label={`${label}로 전환`}
    >
      {variant === 'icon' && (
        <span className="text-xl" role="img" aria-hidden="true">
          {icon}
        </span>
      )}

      {variant === 'text' && (
        <span className="font-medium px-3">{label}</span>
      )}

      {variant === 'both' && (
        <>
          <span className="text-xl mr-2" role="img" aria-hidden="true">
            {icon}
          </span>
          <span className="font-medium">{label}</span>
        </>
      )}
    </button>
  );
}

/**
 * 헤더/네비게이션용 컴팩트 토글 버튼
 */
export function CompactThemeToggle({ className = '' }: { className?: string }) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        p-2 rounded-md
        transition-colors duration-200
        ${isDark
          ? 'text-gray-300 hover:text-white hover:bg-gray-700'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
        }
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500
        ${className}
      `}
      title={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
      aria-label={isDark ? '라이트 모드로 전환' : '다크 모드로 전환'}
    >
      {isDark ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
        </svg>
      )}
    </button>
  );
}

export default ThemeToggle;
