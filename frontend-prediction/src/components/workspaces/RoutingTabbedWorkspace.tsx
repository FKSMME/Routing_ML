import React from "react";
import { BarChart3 } from "lucide-react";
import { Tabs } from "../ui/Tabs";
import { PredictionControls } from "../PredictionControls";
import { ReferenceMatrixPanel } from "../routing/ReferenceMatrixPanel";
import { TimelinePanel } from "../TimelinePanel";
import { VisualizationSummary } from "../VisualizationSummary";
import { RoutingExplanationPanel } from "../routing/RoutingExplanationPanel";
import { FeatureWeightPanel } from "../FeatureWeightPanel";
import { MetricsPanel } from "../MetricsPanel";
import { CandidatePanel } from "../CandidatePanel";
import { RoutingGroupControls } from "../RoutingGroupControls";

interface RoutingTabbedWorkspaceProps {
  // Controls
  itemCodes: string[];
  onChangeItemCodes: (codes: string[]) => void;
  topK: number;
  onChangeTopK: (value: number) => void;
  threshold: number;
  onChangeThreshold: (value: number) => void;
  loading: boolean;
  onSubmit: () => void;
  errorMessage?: string;

  // Data
  data?: any;
  selectedCandidate?: any;

  // Feature weights
  featureWeights: {
    availableProfiles: { name: string; description?: string | null; weights?: Record<string, number> }[];
    profile: string | null;
    manualWeights: Record<string, number>;
  };
  setFeatureWeightProfile: (profile: string | null) => void;
  setManualWeight: (feature: string, weight: number) => void;
  resetManualWeights: () => void;

  // Other
  renderPredictionBanner?: () => React.ReactNode;
  tabKey?: string;
}

export function RoutingTabbedWorkspace({
  itemCodes,
  onChangeItemCodes,
  topK,
  onChangeTopK,
  threshold,
  onChangeThreshold,
  loading,
  onSubmit,
  errorMessage,
  data,
  selectedCandidate,
  featureWeights,
  setFeatureWeightProfile,
  setManualWeight,
  resetManualWeights,
  renderPredictionBanner,
  tabKey = "default",
}: RoutingTabbedWorkspaceProps) {
  const tabs = [
    {
      id: "unified",
      label: "라우팅 생성",
      icon: null,
      content: (
        <div className="routing-unified-workspace" style={{ display: 'flex', width: '100%', minHeight: '800px', gap: '1rem' }}>
          {/* 좌측: 제어판 (20%) */}
          <div className="control-section" style={{ flex: '0 0 20%', minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
            {renderPredictionBanner?.()}
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
              <h3 className="text-lg font-semibold mb-4 text-slate-200">제어판</h3>
              <PredictionControls
                itemCodes={itemCodes}
                onChangeItemCodes={onChangeItemCodes}
                topK={topK}
                onChangeTopK={onChangeTopK}
                threshold={threshold}
                onChangeThreshold={onChangeThreshold}
                loading={loading}
                onSubmit={onSubmit}
                errorMessage={errorMessage}
              />
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
              <ReferenceMatrixPanel key={`reference-${tabKey}`} />
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50">
              <RoutingGroupControls variant="embedded" />
            </div>
          </div>

          {/* 중간: 시각화 (50%) */}
          <div className="visualization-section" style={{ flex: '0 0 50%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 flex-1">
              <h3 className="text-lg font-semibold mb-4 text-slate-200">시각화</h3>
              <TimelinePanel key={`timeline-${tabKey}`} />
              <div className="mt-4">
                <VisualizationSummary metrics={data?.metrics} />
              </div>
            </div>
          </div>

          {/* 우측: 후보목록 (30%) */}
          <div className="candidates-section" style={{ flex: '0 0 30%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-200">후보목록</h3>
                <span className="text-xs text-slate-400">
                  {data?.candidates?.length || 0}개 후보
                </span>
              </div>
              <div className="text-sm text-slate-400 mb-4">
                워크스페이스에서 공정 그룹을 만들어 놓으면 시각화에 있는 라우팅 순서를 출력할때 공정 그룹이 부 라우팅으로 같이 출력됩니다.
              </div>
              <CandidatePanel key={`candidates-${tabKey}`} />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "analysis",
      label: "분석결과",
      icon: <BarChart3 size={18} />,
      content: (
        <div className="routing-tab-content">
          <FeatureWeightPanel
            profiles={featureWeights.availableProfiles}
            selectedProfile={featureWeights.profile}
            onSelectProfile={setFeatureWeightProfile}
            manualWeights={featureWeights.manualWeights}
            onChangeManualWeight={setManualWeight}
            onReset={resetManualWeights}
          />
          <MetricsPanel metrics={data?.metrics} loading={loading} />
          <RoutingExplanationPanel candidate={selectedCandidate} />
        </div>
      ),
    },
  ];

  return (
    <div className="routing-tabbed-workspace" data-layout-fix="v3-unified">
      <Tabs tabs={tabs} defaultTab="unified" />
    </div>
  );
}
