import { BarChart3 } from "lucide-react";
import React, { useEffect,useState } from "react";

import { CandidatePanel } from "../CandidatePanel";
import { FeatureWeightPanel } from "../FeatureWeightPanel";
import { MetricsPanel } from "../MetricsPanel";
import { PredictionControls } from "../PredictionControls";
import { ErpItemExplorer } from "../routing/ErpItemExplorer";
import { ItemListPanel } from "../routing/ItemListPanel";
import { RoutingCombinationSelector } from "../routing/RoutingCombinationSelector";
import { RoutingExplanationPanel } from "../routing/RoutingExplanationPanel";
import { CandidateNodeTabs } from "../routing/CandidateNodeTabs";
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
      label: "예측 대상 품목",
      icon: null,
      content: (
        <div className="routing-control-tab" data-layout="erp-enhanced">
          <div className="routing-control-layout">
            <section className="routing-control-left">
              <ErpItemExplorer onAddItems={onChangeItemCodes} />
            </section>

            <section className="routing-control-right">
              {renderPredictionBanner?.()}

              <div className="routing-control-panel">
                <h3 className="routing-control-panel__title">⚙️ 라우팅 생성</h3>
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
            </section>
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
          {/* 좌측: 품목 리스트 + 라우팅 조합 (15%) */}
          <div className="item-list-section" style={{ flex: '0 0 15%', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 overflow-y-auto">
              <ItemListPanel />
            </div>
            <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 overflow-y-auto">
              <RoutingCombinationSelector />
            </div>
          </div>

          {/* 중앙: 시각화 (55%) */}
          <div className="visualization-section" style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="bg-slate-900/50 rounded-xl p-6 border border-slate-700/50 flex-1">
              <h3 className="text-xl font-semibold mb-4 text-slate-200">📊 시각화</h3>
              <CandidateNodeTabs className="mb-4" />
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
