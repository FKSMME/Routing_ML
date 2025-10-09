import { useState } from "react";
import type { CandidateRouting } from "@app-types/routing";
import { RoutingExplanationPanel } from "./RoutingExplanationPanel";
import "./RoutingExplanationPanel.css";

// Mock data for demonstration
const MOCK_CANDIDATES: CandidateRouting[] = [
  {
    CANDIDATE_ITEM_CD: "ITEM-A-001",
    SIMILARITY_SCORE: 0.92,
    RANK: 1,
    HAS_ROUTING: "Y",
    PROCESS_COUNT: 8,
    feature_importance: {
      SPEC: 0.85,
      MATERIAL: 0.78,
      ITEM_NM: 0.65,
      COMPLEXITY: 0.52,
      DRAW_NO: 0.38,
    },
    matched_features: ["SPEC", "MATERIAL", "ITEM_TYPE", "UNIT"],
  },
  {
    CANDIDATE_ITEM_CD: "ITEM-B-002",
    SIMILARITY_SCORE: 0.78,
    RANK: 2,
    HAS_ROUTING: "Y",
    PROCESS_COUNT: 6,
    feature_importance: {
      MATERIAL: 0.72,
      ITEM_NM: 0.68,
      SPEC: 0.55,
      CUSTOMER: 0.42,
    },
    matched_features: ["MATERIAL", "ITEM_TYPE"],
  },
  {
    CANDIDATE_ITEM_CD: "ITEM-C-003",
    SIMILARITY_SCORE: 0.65,
    RANK: 3,
    HAS_ROUTING: "Y",
    PROCESS_COUNT: 5,
    feature_importance: {
      ITEM_NM: 0.58,
      UNIT: 0.45,
      ITEM_GRP: 0.38,
    },
    matched_features: ["ITEM_TYPE"],
  },
];

export function RoutingExplanationDemo() {
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateRouting | null>(
    MOCK_CANDIDATES[0]
  );

  return (
    <div style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1.5rem" }}>라우팅 설명 패널 데모</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 400px", gap: "2rem" }}>
        <div>
          <h2 style={{ marginBottom: "1rem" }}>후보 선택</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {MOCK_CANDIDATES.map((candidate) => (
              <button
                key={candidate.CANDIDATE_ITEM_CD}
                onClick={() => setSelectedCandidate(candidate)}
                style={{
                  padding: "1rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  backgroundColor:
                    selectedCandidate?.CANDIDATE_ITEM_CD === candidate.CANDIDATE_ITEM_CD
                      ? "#dbeafe"
                      : "#ffffff",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
                  {candidate.CANDIDATE_ITEM_CD}
                </div>
                <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                  유사도: {(candidate.SIMILARITY_SCORE * 100).toFixed(1)}% | 공정 수:{" "}
                  {candidate.PROCESS_COUNT}
                </div>
              </button>
            ))}
          </div>

          <div style={{ marginTop: "2rem" }}>
            <h3>사용 예시 코드</h3>
            <pre
              style={{
                backgroundColor: "#f3f4f6",
                padding: "1rem",
                borderRadius: "6px",
                overflow: "auto",
                fontSize: "0.875rem",
              }}
            >
              {`import { RoutingExplanationPanel } from "./routing/RoutingExplanationPanel";

// 후보 선택 상태
const [selectedCandidate, setSelectedCandidate] = useState<CandidateRouting | null>(null);

// 렌더링
<RoutingExplanationPanel
  candidate={selectedCandidate}
  className="custom-class"
/>`}
            </pre>
          </div>
        </div>

        <div>
          <RoutingExplanationPanel candidate={selectedCandidate} />
        </div>
      </div>
    </div>
  );
}

export default RoutingExplanationDemo;
