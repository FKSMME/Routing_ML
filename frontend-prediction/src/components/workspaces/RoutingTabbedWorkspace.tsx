import React from "react";
import { Settings, BarChart3, Eye, ListChecks } from "lucide-react";
import { Tabs } from "../ui/Tabs";
import { PredictionControls } from "../PredictionControls";
import { ReferenceMatrixPanel } from "../routing/ReferenceMatrixPanel";
import { TimelinePanel } from "../TimelinePanel";
import { VisualizationSummary } from "../VisualizationSummary";
import { RoutingExplanationPanel } from "../routing/RoutingExplanationPanel";
import { FeatureWeightPanel } from "../FeatureWeightPanel";
import { MetricsPanel } from "../MetricsPanel";
import { CandidatePanel } from "../CandidatePanel";

interface RoutingTabbedWorkspaceProps {
  // Controls
  itemCodes: string;
  onChangeItemCodes: (value: string) => void;
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
    availableProfiles: string[];
    profile: string;
    manualWeights: Record<string, number>;
  };
  setFeatureWeightProfile: (profile: string) => void;
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
      id: "control",
      label: "제어판",
      icon: <Settings size={18} />,
      content: (
        <div className="routing-tab-content">
          {renderPredictionBanner?.()}
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
          <ReferenceMatrixPanel key={`reference-${tabKey}`} />
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
    {
      id: "visualization",
      label: "시각화",
      icon: <Eye size={18} />,
      content: (
        <div className="routing-tab-content">
          <TimelinePanel key={`timeline-${tabKey}`} />
          <VisualizationSummary metrics={data?.metrics} />
        </div>
      ),
    },
    {
      id: "candidates",
      label: "후보목록",
      icon: <ListChecks size={18} />,
      content: (
        <div className="routing-tab-content">
          <CandidatePanel key={`candidates-${tabKey}`} />
        </div>
      ),
    },
  ];

  return (
    <div className="routing-tabbed-workspace" data-layout-fix="v2">
      <Tabs tabs={tabs} defaultTab="control" />
    </div>
  );
}
