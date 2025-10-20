import { BarChart3 } from "lucide-react";
import React, { useEffect,useState } from "react";

import { CandidatePanel } from "../CandidatePanel";
import { FeatureWeightPanel } from "../FeatureWeightPanel";
import { MetricsPanel } from "../MetricsPanel";
import { PredictionControls } from "../PredictionControls";
import { ErpItemExplorer } from "../routing/ErpItemExplorer";
import { RoutingExplanationPanel } from "../routing/RoutingExplanationPanel";
import { TimelinePanel } from "../TimelinePanel";
import { Tabs } from "../ui/Tabs";
import { VisualizationSummary } from "../VisualizationSummary";

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
  const [activeTab, setActiveTab] = useState("control");

  // 예측 성공 시 시각화 탭으로 자동 전환
  useEffect(() => {
    if (!loading && data?.candidates && data.candidates.length > 0) {
      setActiveTab("visualization");
    }
  }, [loading, data?.candidates]);
  const tabs = [
    {
      id: "control",
      label: "제어판",
      icon: null,
      content: (
        <div className="routing-control-tab" style={{ display: 'flex', width: '100%', gap: '1rem', padding: '1rem' }}>
          {/* 좌측: ERP View (40%) */}
          <div className="erp-view-section" style={{ flex: '0 0 40%', minWidth: '400px' }}>
            <ErpItemExplorer onAddItems={onChangeItemCodes} />
          </div>

          {/* 우측: 제어판 (60%) */}
          <div className="control-panel-section" style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {renderPredictionBanner?.()}

            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50">
              <h3 className="text-xl font-semibold mb-4 text-slate-200">⚙️ 제어판</h3>
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
          </div>
        </div>
      ),
    },
    {
      id: "visualization",
      label: "시각화",
      icon: <BarChart3 size={18} />,
      content: (
        <div className="routing-visualization-tab" style={{ display: 'flex', width: '100%', minHeight: '800px', gap: '1rem', padding: '1rem' }}>
          {/* 좌측: 시각화 (70%) */}
          <div className="visualization-section" style={{ flex: '0 0 70%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50 flex-1">
              <h3 className="text-xl font-semibold mb-4 text-slate-200">📊 시각화</h3>
              <TimelinePanel key={`timeline-${tabKey}`} />
              <div className="mt-4">
                <VisualizationSummary metrics={data?.metrics} />
              </div>
            </div>
          </div>

          {/* 우측: 후보목록 (30%) */}
          <div className="candidates-section" style={{ flex: '0 0 30%', minWidth: '320px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50 flex-1 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-slate-200">📋 후보목록</h3>
                <span className="text-xs text-slate-400">
                  {data?.candidates?.length || 0}개 후보
                </span>
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
    <div className="routing-tabbed-workspace" data-layout-fix="v3-tabs">
      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
