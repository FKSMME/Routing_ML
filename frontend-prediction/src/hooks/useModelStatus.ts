import { useQuery } from "@tanstack/react-query";
import { fetchModelStatus, type ModelStatus } from "@lib/apiClient";

export interface UseModelStatusOptions {
  /**
   * 주기적 폴링 간격 (밀리초). 기본값: 30000 (30초)
   */
  refetchInterval?: number;

  /**
   * 쿼리 활성화 여부. 기본값: true
   */
  enabled?: boolean;
}

/**
 * 현재 로딩된 모델 상태를 조회하는 Hook
 *
 * @example
 * ```tsx
 * const { data: modelStatus, isLoading } = useModelStatus();
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (!modelStatus?.loaded) return <div>Model not loaded</div>;
 *
 * return (
 *   <div>
 *     Model: {modelStatus.version}
 *     Loaded: {modelStatus.loaded ? 'Yes' : 'No'}
 *   </div>
 * );
 * ```
 */
export function useModelStatus(options: UseModelStatusOptions = {}) {
  const {
    refetchInterval = 30000, // 30초마다 자동 갱신
    enabled = true,
  } = options;

  return useQuery<ModelStatus, Error>({
    queryKey: ["model", "status"],
    queryFn: fetchModelStatus,
    refetchInterval,
    enabled,
    staleTime: 25000, // 25초 동안 캐시 유효
    retry: 1, // 실패 시 1회 재시도
  });
}
