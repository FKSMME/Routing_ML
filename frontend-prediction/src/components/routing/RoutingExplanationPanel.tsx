import type { CandidateRouting } from "@app-types/routing";
import { useMemo } from "react";

interface RoutingExplanationPanelProps {
  candidate: CandidateRouting | null;
  className?: string;
}

interface FeatureImportanceItem {
  feature: string;
  score: number;
  displayName: string;
}

const FEATURE_DISPLAY_NAMES: Record<string, string> = {
  ITEM_NM: "품목명",
  SPEC: "규격",
  MATERIAL: "재질",
  ITEM_TYPE: "품목유형",
  UNIT: "단위",
  DRAW_NO: "도면번호",
  ITEM_GRP: "품목그룹",
  CUSTOMER: "고객사",
  PRODUCT_LINE: "제품라인",
  COMPLEXITY: "복잡도",
};

function getFeatureDisplayName(feature: string): string {
  return FEATURE_DISPLAY_NAMES[feature] || feature;
}

function getSimilarityLevel(score: number): { label: string; className: string } {
  if (score >= 0.9) {
    return { label: "매우 높음", className: "similarity-level--very-high" };
  }
  if (score >= 0.75) {
    return { label: "높음", className: "similarity-level--high" };
  }
  if (score >= 0.6) {
    return { label: "보통", className: "similarity-level--medium" };
  }
  if (score >= 0.4) {
    return { label: "낮음", className: "similarity-level--low" };
  }
  return { label: "매우 낮음", className: "similarity-level--very-low" };
}

export function RoutingExplanationPanel({ candidate, className = "" }: RoutingExplanationPanelProps) {
  const featureImportanceList = useMemo<FeatureImportanceItem[]>(() => {
    if (!candidate?.feature_importance) {
      return [];
    }

    return Object.entries(candidate.feature_importance)
      .map(([feature, score]) => ({
        feature,
        score,
        displayName: getFeatureDisplayName(feature),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 features
  }, [candidate?.feature_importance]);

  const matchedFeatures = useMemo<string[]>(() => {
    if (!candidate?.matched_features) {
      return [];
    }
    return candidate.matched_features.map(getFeatureDisplayName);
  }, [candidate?.matched_features]);

  const similarityLevel = useMemo(() => {
    if (!candidate) {
      return { label: "-", className: "" };
    }
    return getSimilarityLevel(candidate.SIMILARITY_SCORE);
  }, [candidate]);

  if (!candidate) {
    return (
      <div className={`routing-explanation-panel ${className}`}>
        <div className="routing-explanation-panel__empty">
          후보를 선택하면 추천 근거가 표시됩니다
        </div>
      </div>
    );
  }

  return (
    <div className={`routing-explanation-panel ${className}`}>
      <div className="routing-explanation-panel__header">
        <h3 className="routing-explanation-panel__title">왜 이 라우팅?</h3>
        <span className="routing-explanation-panel__subtitle">추천 근거 분석</span>
      </div>

      <div className="routing-explanation-panel__section">
        <h4 className="routing-explanation-panel__section-title">유사도 점수</h4>
        <div className="similarity-score">
          <div className="similarity-score__value">
            {(candidate.SIMILARITY_SCORE * 100).toFixed(1)}%
          </div>
          <div className={`similarity-score__level ${similarityLevel.className}`}>
            {similarityLevel.label}
          </div>
        </div>
        <p className="routing-explanation-panel__description">
          선택한 품목과 후보 품목 <strong>{candidate.CANDIDATE_ITEM_CD}</strong>의
          유사도 점수입니다.
        </p>
      </div>

      {featureImportanceList.length > 0 && (
        <div className="routing-explanation-panel__section">
          <h4 className="routing-explanation-panel__section-title">
            주요 매칭 특성 (Feature Importance)
          </h4>
          <p className="routing-explanation-panel__description">
            유사도 계산에 가장 큰 영향을 준 특성들입니다.
          </p>
          <ul className="feature-importance-list">
            {featureImportanceList.map((item) => (
              <li key={item.feature} className="feature-importance-list__item">
                <div className="feature-importance-list__label">
                  {item.displayName}
                </div>
                <div className="feature-importance-list__bar-container">
                  <div
                    className="feature-importance-list__bar"
                    style={{ width: `${item.score * 100}%` }}
                  />
                </div>
                <div className="feature-importance-list__value">
                  {(item.score * 100).toFixed(0)}%
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {matchedFeatures.length > 0 && (
        <div className="routing-explanation-panel__section">
          <h4 className="routing-explanation-panel__section-title">일치하는 속성</h4>
          <p className="routing-explanation-panel__description">
            두 품목 간 일치하는 특성들입니다.
          </p>
          <div className="matched-features">
            {matchedFeatures.map((feature, index) => (
              <span key={index} className="matched-features__tag">
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      {candidate.PROCESS_COUNT !== null && candidate.PROCESS_COUNT !== undefined && (
        <div className="routing-explanation-panel__section">
          <h4 className="routing-explanation-panel__section-title">공정 정보</h4>
          <div className="process-info">
            <span className="process-info__label">총 공정 수</span>
            <span className="process-info__value">{candidate.PROCESS_COUNT}단계</span>
          </div>
        </div>
      )}

      <div className="routing-explanation-panel__footer">
        <div className="routing-explanation-panel__note">
          💡 <strong>참고:</strong> 유사도 점수가 높을수록 현재 품목과 유사한 라우팅입니다.
        </div>
      </div>
    </div>
  );
}

export default RoutingExplanationPanel;
