import { useEffect,useState } from "react";

import type { DrawingViewerConfig } from "../components/routing/DrawingViewerSettings";

const STORAGE_KEY = "drawingViewerSettings";

const DEFAULT_CONFIG: DrawingViewerConfig = {
  erpId: "",
  defaultSheet: "1",
  width: 1200,
  height: 800,
};

/**
 * ERP 도면 조회 설정을 관리하는 React Hook
 *
 * localStorage에서 설정을 로드하고, 설정 변경 시 자동으로 저장합니다.
 *
 * @returns 도면 조회 설정 객체
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const settings = useDrawingViewerSettings();
 *
 *   return (
 *     <div>
 *       <p>ERP ID: {settings.erpId}</p>
 *       <p>Window Size: {settings.width}x{settings.height}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useDrawingViewerSettings(): DrawingViewerConfig {
  const [config, setConfig] = useState<DrawingViewerConfig>(() => {
    // 초기 로드: localStorage에서 설정 읽기
    try {
      const savedConfig = localStorage.getItem(STORAGE_KEY);
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (error) {
      console.error("Failed to load drawing viewer settings:", error);
    }
    return DEFAULT_CONFIG;
  });

  // localStorage 변경 감지 (다른 탭에서 설정 변경 시)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const parsed = JSON.parse(event.newValue);
          setConfig({ ...DEFAULT_CONFIG, ...parsed });
        } catch (error) {
          console.error("Failed to parse storage change:", error);
        }
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return config;
}

/**
 * 도면 조회 설정을 localStorage에서 직접 로드합니다.
 * (Hook이 아닌 일반 함수)
 *
 * @returns 도면 조회 설정 객체
 */
export function loadDrawingViewerSettings(): DrawingViewerConfig {
  try {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load drawing viewer settings:", error);
  }
  return DEFAULT_CONFIG;
}

/**
 * 도면 조회 설정을 localStorage에 저장합니다.
 *
 * @param config - 저장할 설정
 */
export function saveDrawingViewerSettings(config: DrawingViewerConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error("Failed to save drawing viewer settings:", error);
    throw error;
  }
}
