/**
 * Theme Management Hook
 * 다크/라이트 테마 전환 및 LocalStorage 저장
 */
import { useEffect,useState } from 'react';

export type Theme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'routing-ml-theme';
const DEFAULT_THEME: Theme = 'light'; // 현장 환경 고려하여 라이트 테마 기본값

/**
 * 시스템 다크 모드 선호도 확인
 */
function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/**
 * LocalStorage에서 저장된 테마 로드
 */
function getStoredTheme(): Theme | null {
  if (typeof window === 'undefined') return null;

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return null;
}

/**
 * 테마를 LocalStorage에 저장
 */
function saveTheme(theme: Theme): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

/**
 * HTML 루트 요소에 테마 클래스 적용
 */
function applyThemeToDOM(theme: Theme): void {
  if (typeof window === 'undefined') return;

  const root = document.documentElement;

  if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // data-theme 속성도 설정 (CSS 변수용)
  root.setAttribute('data-theme', theme);
}

/**
 * 테마 관리 훅
 *
 * @returns {Object} theme, setTheme, toggleTheme
 *
 * @example
 * ```tsx
 * function App() {
 *   const { theme, toggleTheme } = useTheme();
 *
 *   return (
 *     <button onClick={toggleTheme}>
 *       {theme === 'light' ? '🌙 다크 모드' : '☀️ 라이트 모드'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useTheme() {
  // 초기 테마: LocalStorage > 시스템 설정 > 기본값
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = getStoredTheme();
    if (stored) return stored;

    // 현장 환경 고려: 시스템 설정 무시하고 항상 라이트 테마 기본
    return DEFAULT_THEME;
  });

  // 테마 변경 시 DOM 업데이트 및 저장
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyThemeToDOM(newTheme);
    saveTheme(newTheme);
  };

  // 테마 토글
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  // 컴포넌트 마운트 시 테마 적용
  useEffect(() => {
    applyThemeToDOM(theme);
  }, [theme]);

  // 시스템 다크 모드 설정 변경 감지 (선택적)
  useEffect(() => {
    // 사용자가 명시적으로 테마를 선택한 경우 시스템 설정 무시
    const stored = getStoredTheme();
    if (stored) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      // 현장 환경에서는 시스템 변경 무시
      // 필요시 주석 해제:
      // setTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return {
    theme,
    setTheme,
    toggleTheme,
    isDark: theme === 'dark',
    isLight: theme === 'light',
  };
}

/**
 * 테마 Provider 없이도 사용 가능한 간단한 훅
 * Context API 사용 시 ThemeProvider 구현 권장
 */
export default useTheme;
