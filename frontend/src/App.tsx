import { useMemo, useState } from "react";

import { CandidatePanel } from "@components/CandidatePanel";
import { Header } from "@components/Header";
import { FeatureWeightPanel } from "@components/FeatureWeightPanel";
import { MetricsPanel } from "@components/MetricsPanel";
import { PredictionControls } from "@components/PredictionControls";
import { WorkflowGraphPanel } from "@components/WorkflowGraphPanel";
import { TimelinePanel } from "@components/TimelinePanel";
import { ExportOptionsPanel } from "@components/ExportOptionsPanel";
import { TrainingConsole } from "@components/TrainingConsole";
import { DataSourceConfigurator } from "@components/DataSourceConfigurator";
import { VisualizationSummary } from "@components/VisualizationSummary";
import { usePredictRoutings } from "@hooks/usePredictRoutings";
import { useWorkflowConfig } from "@hooks/useWorkflowConfig";

const DEFAULT_ITEM = "ITEM-001";

export default function App() {
  const [itemCodes, setItemCodes] = useState<string[]>([DEFAULT_ITEM]);
  const [topK, setTopK] = useState<number>(10);
  const [threshold, setThreshold] = useState<number>(0.3);
  const [selectedProfile, setSelectedProfile] = useState<string | null>("geometry-focus");
  const [manualWeights, setManualWeights] = useState<Record<string, number>>({});
  const [exportFormats, setExportFormats] = useState<string[]>(["csv", "excel"]);
  const [withVisualization, setWithVisualization] = useState<boolean>(true);

  const workflow = useWorkflowConfig();

  const { data, isLoading, isFetching, refetch } = usePredictRoutings({
    itemCodes,
    topK,
    threshold,
    featureWeights: manualWeights,
    weightProfile: selectedProfile,
    exportFormats,
    withVisualization,
  });

  const availableProfiles = useMemo(() => {
    const profiles = data?.metrics.feature_weights?.profiles;
    if (profiles && profiles.length > 0) {
      return profiles.map((profile) => ({ name: profile.name, description: profile.description ?? undefined }));
    }
    return [
      { name: "default", description: "기본 가중치" },
      { name: "geometry-focus", description: "치수/형상 강조" },
      { name: "operation-history", description: "공정 시간 중심" },
    ];
  }, [data?.metrics.feature_weights?.profiles]);

  const handleManualWeightChange = (feature: string, value: number) => {
    setManualWeights((prev) => ({ ...prev, [feature]: value }));
    setSelectedProfile("custom");
  };

  const handleResetWeights = () => {
    setManualWeights({});
    setSelectedProfile("default");
  };

  const toggleFormat = (format: string, enabled: boolean) => {
    setExportFormats((prev) => {
      if (enabled) {
        if (prev.includes(format)) return prev;
        return [...prev, format];
      }
      return prev.filter((item) => item !== format);
    });
  };

  const handleUpdateAccessPath = async (path: string) => {
    await workflow.saveConfig({ data_source: { access_path: path } });
  };

  const handleToggleBlueprint = async (id: string, enabled: boolean) => {
    await workflow.saveConfig({ data_source: { blueprint_switches: [{ id, enabled }] } });
  };

  return (
    <div className="app-shell">
      <Header onRefresh={refetch} loading={isLoading || isFetching} />
      <main className="app-main">
        <aside className="column column-left">
          <PredictionControls
            itemCodes={itemCodes}
            onChangeItemCodes={setItemCodes}
            topK={topK}
            onChangeTopK={setTopK}
            threshold={threshold}
            onChangeThreshold={setThreshold}
            loading={isLoading || isFetching}
            onSubmit={refetch}
          />
          <FeatureWeightPanel
            profiles={availableProfiles}
            selectedProfile={selectedProfile}
            onSelectProfile={setSelectedProfile}
            manualWeights={manualWeights}
            onChangeManualWeight={handleManualWeightChange}
            onReset={handleResetWeights}
          />
          <MetricsPanel metrics={data?.metrics} loading={isLoading || isFetching} />
          <ExportOptionsPanel
            config={workflow.data?.export}
            selectedFormats={exportFormats}
            onToggleFormat={toggleFormat}
            withVisualization={withVisualization}
            onToggleVisualization={setWithVisualization}
          />
        </aside>

        <section className="column column-center space-y-6">
          <CandidatePanel candidates={data?.candidates ?? []} loading={isLoading || isFetching} />
          <VisualizationSummary metrics={data?.metrics} />
        </section>

        <aside className="column column-right space-y-6">
          <TimelinePanel routings={data?.items ?? []} loading={isLoading || isFetching} />
          <TrainingConsole defaultMetadata={workflow.data?.visualization.projector_metadata_columns} />
          <DataSourceConfigurator
            config={workflow.data?.data_source}
            saving={workflow.saving}
            onUpdateAccessPath={handleUpdateAccessPath}
            onToggleBlueprint={handleToggleBlueprint}
          />
        </aside>
      </main>
      <WorkflowGraphPanel />
    </div>
  );
}
