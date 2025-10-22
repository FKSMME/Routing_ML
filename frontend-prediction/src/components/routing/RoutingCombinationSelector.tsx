import "./RoutingCombinationSelector.css";

import { type TimelineStep,useRoutingStore } from "@store/routingStore";
import { Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface RoutingMatrixCombo {
  key: string;
  routingSetCode: string | null;
  variantCode: string | null;
  primaryRoutingCode: string | null;
  secondaryRoutingCode: string | null;
  count: number;
}

export function RoutingCombinationSelector() {
  const timeline = useRoutingStore((state) => state.timeline);
  const processGroups = useRoutingStore((state) => state.processGroups);
  const activeProcessGroupId = useRoutingStore((state) => state.activeProcessGroupId);
  const setActiveProcessGroup = useRoutingStore((state) => state.setActiveProcessGroup);

  const [selectedRoutingSet, setSelectedRoutingSet] = useState<string>("");
  const [selectedVariantCode, setSelectedVariantCode] = useState<string>("");
  const [selectedPrimaryRouting, setSelectedPrimaryRouting] = useState<string>("");
  const [selectedSecondaryRouting, setSelectedSecondaryRouting] = useState<string>("");

  const resolveRoutingSetCode = useCallback(
    (step: TimelineStep): string | null =>
      step.routingSetCode ?? step.metadata?.routingSetCode ?? null,
    [],
  );

  const resolveVariantCode = useCallback(
    (step: TimelineStep): string | null =>
      step.variantCode ?? step.metadata?.variantCode ?? null,
    [],
  );

  const resolvePrimaryRoutingCode = useCallback(
    (step: TimelineStep): string | null =>
      step.primaryRoutingCode ?? step.metadata?.primaryRoutingCode ?? null,
    [],
  );

  const resolveSecondaryRoutingCode = useCallback(
    (step: TimelineStep): string | null =>
      step.secondaryRoutingCode ?? step.metadata?.secondaryRoutingCode ?? null,
    [],
  );

  const timelineMatrixCombos = useMemo<RoutingMatrixCombo[]>(() => {
    const combos = new Map<string, RoutingMatrixCombo>();
    timeline.forEach((step) => {
      const routingSet = resolveRoutingSetCode(step);
      const variant = resolveVariantCode(step);
      const primary = resolvePrimaryRoutingCode(step);
      const secondary = resolveSecondaryRoutingCode(step);
      const key = [routingSet ?? "", variant ?? "", primary ?? "", secondary ?? ""].join("::");
      const existing = combos.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        combos.set(key, {
          key,
          routingSetCode: routingSet,
          variantCode: variant,
          primaryRoutingCode: primary,
          secondaryRoutingCode: secondary,
          count: 1,
        });
      }
    });
    return Array.from(combos.values()).sort(
      (a, b) => b.count - a.count || a.key.localeCompare(b.key),
    );
  }, [
    resolveRoutingSetCode,
    resolveVariantCode,
    resolvePrimaryRoutingCode,
    resolveSecondaryRoutingCode,
    timeline,
  ]);

  const routingSetOptions = useMemo(() => {
    const values = new Set<string>();
    timelineMatrixCombos.forEach((combo) => {
      if (combo.routingSetCode) {
        values.add(combo.routingSetCode);
      }
    });
    return Array.from(values).sort();
  }, [timelineMatrixCombos]);

  const variantOptions = useMemo(() => {
    const values = new Set<string>();
    timelineMatrixCombos.forEach((combo) => {
      if (selectedRoutingSet && combo.routingSetCode !== selectedRoutingSet) {
        return;
      }
      if (combo.variantCode) {
        values.add(combo.variantCode);
      }
    });
    return Array.from(values).sort();
  }, [timelineMatrixCombos, selectedRoutingSet]);

  const primaryRoutingOptions = useMemo(() => {
    const values = new Set<string>();
    timelineMatrixCombos.forEach((combo) => {
      if (selectedRoutingSet && combo.routingSetCode !== selectedRoutingSet) {
        return;
      }
      if (selectedVariantCode && combo.variantCode !== selectedVariantCode) {
        return;
      }
      if (combo.primaryRoutingCode) {
        values.add(combo.primaryRoutingCode);
      }
    });
    return Array.from(values).sort();
  }, [timelineMatrixCombos, selectedRoutingSet, selectedVariantCode]);

  const secondaryRoutingOptions = useMemo(() => {
    const values = new Set<string>();
    timelineMatrixCombos.forEach((combo) => {
      if (selectedRoutingSet && combo.routingSetCode !== selectedRoutingSet) {
        return;
      }
      if (selectedVariantCode && combo.variantCode !== selectedVariantCode) {
        return;
      }
      if (selectedPrimaryRouting && combo.primaryRoutingCode !== selectedPrimaryRouting) {
        return;
      }
      if (combo.secondaryRoutingCode) {
        values.add(combo.secondaryRoutingCode);
      }
    });
    return Array.from(values).sort();
  }, [timelineMatrixCombos, selectedPrimaryRouting, selectedRoutingSet, selectedVariantCode]);

  // Reset cascading dropdowns when parent selection changes
  useEffect(() => {
    setSelectedVariantCode("");
    setSelectedPrimaryRouting("");
    setSelectedSecondaryRouting("");
  }, [selectedRoutingSet]);

  useEffect(() => {
    setSelectedPrimaryRouting("");
    setSelectedSecondaryRouting("");
  }, [selectedVariantCode]);

  useEffect(() => {
    setSelectedSecondaryRouting("");
  }, [selectedPrimaryRouting]);

  const activeProcessGroup = useMemo(
    () => processGroups.find((group) => group.id === activeProcessGroupId) ?? null,
    [activeProcessGroupId, processGroups],
  );

  const hasRoutingCombinations = timelineMatrixCombos.length > 0;

  return (
    <div className="routing-combination-selector">
      <div className="selector-header">
        <Filter size={16} />
        <h3>라우팅 조합 & 공정 그룹</h3>
      </div>

      {/* Process Group Selection */}
      <div className="selector-field">
        <label htmlFor="routing-combo-process-group">공정 그룹</label>
        <select
          id="routing-combo-process-group"
          value={activeProcessGroupId ?? ""}
          onChange={(e) => setActiveProcessGroup(e.target.value ? e.target.value : null)}
          className="selector-input"
        >
          <option value="">선택하지 않음</option>
          {processGroups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name} · {group.type === "machining" ? "가공" : "후처리"}
            </option>
          ))}
        </select>
        {activeProcessGroup && (
          <p className="selector-hint">
            컬럼: {activeProcessGroup.defaultColumns.map((col) => col.key).join(", ") || "없음"}
          </p>
        )}
      </div>

      {/* Routing Combination Selection */}
      {hasRoutingCombinations ? (
        <div className="selector-field">
          <label>라우팅 조합 필터</label>
          <div className="selector-grid">
            <select
              value={selectedRoutingSet}
              onChange={(e) => setSelectedRoutingSet(e.target.value)}
              className="selector-input"
            >
              <option value="">전체 주라우팅</option>
              {routingSetOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              value={selectedVariantCode}
              onChange={(e) => setSelectedVariantCode(e.target.value)}
              className="selector-input"
              disabled={!selectedRoutingSet}
            >
              <option value="">전체 Variant</option>
              {variantOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              value={selectedPrimaryRouting}
              onChange={(e) => setSelectedPrimaryRouting(e.target.value)}
              className="selector-input"
              disabled={!selectedRoutingSet}
            >
              <option value="">전체 주라우팅 코드</option>
              {primaryRoutingOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>

            <select
              value={selectedSecondaryRouting}
              onChange={(e) => setSelectedSecondaryRouting(e.target.value)}
              className="selector-input"
              disabled={!selectedPrimaryRouting}
            >
              <option value="">전체 부라우팅 코드</option>
              {secondaryRoutingOptions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          {timelineMatrixCombos.length > 0 && (
            <div className="selector-summary">
              <p className="selector-hint">타임라인에서 감지된 라우팅 조합 ({timelineMatrixCombos.length}개):</p>
              <ul className="combo-list">
                {timelineMatrixCombos.slice(0, 3).map((combo) => (
                  <li key={combo.key}>
                    {combo.routingSetCode ?? "기본"} / {combo.variantCode ?? "-"} /{" "}
                    {combo.primaryRoutingCode ?? "-"} / {combo.secondaryRoutingCode ?? "-"} ·{" "}
                    {combo.count}단계
                  </li>
                ))}
                {timelineMatrixCombos.length > 3 && (
                  <li className="combo-more">외 {timelineMatrixCombos.length - 3}개 조합</li>
                )}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="selector-field">
          <p className="selector-hint">타임라인에 라우팅 조합 정보가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
