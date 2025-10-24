import { useQuery } from "@tanstack/react-query";
import { fetchModelVersions, type ModelListResponse } from "@lib/apiClient";

export interface UseModelVersionsOptions {
  /**
   * 조회할 최대 모델 개수
   */
  limit?: number;

  /**
   * 쿼리 활성화 여부. 기본값: true
   */
  enabled?: boolean;
}

/**
 * 사용 가능한 모델 버전 목록을 조회하는 Hook
 *
 * @example
 * ```tsx
 * const { data: modelList, isLoading } = useModelVersions();
 *
 * if (isLoading) return <div>Loading...</div>;
 *
 * return (
 *   <select>
 *     {modelList?.models.map(model => (
 *       <option key={model.version_name} value={model.version_name}>
 *         {model.version_name}
 *       </option>
 *     ))}
 *   </select>
 * );
 * ```
 */
export function useModelVersions(options: UseModelVersionsOptions = {}) {
  const { limit, enabled = true } = options;

  return useQuery<ModelListResponse, Error>({
    queryKey: ["models", "versions", limit],
    queryFn: () => fetchModelVersions(limit),
    enabled,
    staleTime: 60000, // 60초 동안 캐시 유효
    retry: 1, // 실패 시 1회 재시도
  });
}
