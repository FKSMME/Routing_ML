/**
 * routingDataExtractor.ts
 *
 * routingStore의 timeline 데이터를 API 요청에 사용할 수 있는 형식으로 변환합니다.
 *
 * 주요 기능:
 * - TimelineStep → RoutingGroupStep 변환
 * - 필수 필드 검증
 * - 데이터 정규화
 */

import type { RoutingGroupStep } from "@app-types/routing";
import type { TimelineStep } from "@store/routingStore";

/**
 * TimelineStep을 RoutingGroupStep으로 변환합니다.
 *
 * @param step - routingStore의 TimelineStep 객체
 * @returns RoutingGroupStep 객체 (API 호출에 사용 가능한 형식)
 */
export function convertTimelineStepToRoutingStep(
  step: TimelineStep
): RoutingGroupStep {
  return {
    seq: step.seq,
    process_code: step.processCode,
    description: step.description ?? null,
    duration_min: step.runTime ?? null,
    setup_time: step.setupTime ?? null,
    wait_time: step.waitTime ?? null,
    routing_set_code: step.routingSetCode ?? step.metadata?.routingSetCode ?? null,
    variant_code: step.variantCode ?? step.metadata?.variantCode ?? null,
    primary_routing_code: step.primaryRoutingCode ?? step.metadata?.primaryRoutingCode ?? null,
    secondary_routing_code: step.secondaryRoutingCode ?? step.metadata?.secondaryRoutingCode ?? null,
    branch_code: step.branchCode ?? step.metadata?.branchCode ?? null,
    branch_label: step.branchLabel ?? step.metadata?.branchLabel ?? null,
    branch_path: step.branchPath ?? step.metadata?.branchPath ?? null,
    sql_values: step.sqlValues ?? step.metadata?.sqlValues ?? null,
    metadata: step.metadata ?? null,
  };
}

/**
 * Timeline 전체를 RoutingGroupStep 배열로 변환합니다.
 *
 * @param timeline - routingStore의 timeline 배열
 * @returns RoutingGroupStep 배열
 */
export function convertTimelineToRoutingSteps(
  timeline: TimelineStep[]
): RoutingGroupStep[] {
  return timeline.map(convertTimelineStepToRoutingStep);
}

/**
 * Timeline을 데이터 매핑 API에서 사용할 수 있는 dictionary 형식으로 변환합니다.
 *
 * 각 TimelineStep의 모든 필드를 flat한 dictionary로 변환하여
 * 데이터 매핑 프로파일의 routing_field와 매칭할 수 있도록 합니다.
 *
 * @param timeline - routingStore의 timeline 배열
 * @returns Dictionary 배열 (각 행은 { field_name: value } 형식)
 */
export function convertTimelineToMappingData(
  timeline: TimelineStep[]
): Array<Record<string, unknown>> {
  return timeline.map((step) => {
    // 기본 필드들
    const row: Record<string, unknown> = {
      seq: step.seq,
      processCode: step.processCode,
      process_code: step.processCode, // snake_case 별칭
      description: step.description ?? null,
      setupTime: step.setupTime ?? null,
      setup_time: step.setupTime ?? null, // snake_case 별칭
      runTime: step.runTime ?? null,
      run_time: step.runTime ?? null, // snake_case 별칭
      waitTime: step.waitTime ?? null,
      wait_time: step.waitTime ?? null, // snake_case 별칭
      itemCode: step.itemCode ?? null,
      item_code: step.itemCode ?? null, // snake_case 별칭
      candidateId: step.candidateId ?? null,
      candidate_id: step.candidateId ?? null, // snake_case 별칭
      routingSetCode: step.routingSetCode ?? null,
      routing_set_code: step.routingSetCode ?? null, // snake_case 별칭
      variantCode: step.variantCode ?? null,
      variant_code: step.variantCode ?? null, // snake_case 별칭
      primaryRoutingCode: step.primaryRoutingCode ?? null,
      primary_routing_code: step.primaryRoutingCode ?? null, // snake_case 별칭
      secondaryRoutingCode: step.secondaryRoutingCode ?? null,
      secondary_routing_code: step.secondaryRoutingCode ?? null, // snake_case 별칭
      branchCode: step.branchCode ?? null,
      branch_code: step.branchCode ?? null, // snake_case 별칭
      branchLabel: step.branchLabel ?? null,
      branch_label: step.branchLabel ?? null, // snake_case 별칭
      branchPath: step.branchPath ?? null,
      branch_path: step.branchPath ?? null, // snake_case 별칭
    };

    // sqlValues 병합 (최상위 레벨로)
    if (step.sqlValues && typeof step.sqlValues === "object") {
      Object.entries(step.sqlValues).forEach(([key, value]) => {
        row[key] = value;
        // camelCase도 추가 (이미 snake_case인 경우 중복되지 않도록)
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (camelKey !== key) {
          row[camelKey] = value;
        }
      });
    }

    // metadata 필드들 병합
    if (step.metadata && typeof step.metadata === "object") {
      Object.entries(step.metadata).forEach(([key, value]) => {
        // sqlValues, extra는 이미 처리했으므로 제외
        if (key === "sqlValues" || key === "extra") {
          return;
        }
        row[key] = value;
        // camelCase도 추가
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        if (camelKey !== key) {
          row[camelKey] = value;
        }
      });
    }

    return row;
  });
}

/**
 * Timeline 데이터의 유효성을 검증합니다.
 *
 * @param timeline - 검증할 timeline 배열
 * @returns 검증 결과 { valid: boolean, errors: string[] }
 */
export function validateTimelineData(
  timeline: TimelineStep[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(timeline)) {
    errors.push("Timeline must be an array");
    return { valid: false, errors };
  }

  if (timeline.length === 0) {
    errors.push("Timeline is empty");
    return { valid: false, errors };
  }

  timeline.forEach((step, index) => {
    if (!step.processCode || step.processCode.trim() === "") {
      errors.push(`Step ${index + 1}: processCode is required`);
    }

    if (typeof step.seq !== "number" || step.seq < 0) {
      errors.push(`Step ${index + 1}: seq must be a non-negative number`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 활성화된 라우팅 그룹 ID를 생성합니다.
 *
 * @param activeProductId - routingStore의 activeProductId
 * @param activeGroupId - routingStore의 activeGroupId
 * @returns 라우팅 그룹 ID (fallback: "current-timeline")
 */
export function generateRoutingGroupId(
  activeProductId: string | null,
  activeGroupId: string | null
): string {
  if (activeGroupId && activeGroupId.trim() !== "") {
    return activeGroupId;
  }
  if (activeProductId && activeProductId.trim() !== "") {
    return activeProductId;
  }
  return "current-timeline";
}
