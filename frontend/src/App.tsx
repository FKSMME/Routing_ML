import { CandidatePanel } from "@components/CandidatePanel";
import { FeatureWeightPanel } from "@components/FeatureWeightPanel";
import { Header } from "@components/Header";
import { MainNavigation } from "@components/MainNavigation";
import { MasterDataWorkspace } from "@components/master-data/MasterDataWorkspace";
import { MetricsPanel } from "@components/MetricsPanel";
import { PredictionControls } from "@components/PredictionControls";
import { ReferenceMatrixPanel } from "@components/routing/ReferenceMatrixPanel";
import { RoutingProductTabs } from "@components/routing/RoutingProductTabs";
import { RoutingGroupControls } from "@components/RoutingGroupControls";
import { TimelinePanel } from "@components/TimelinePanel";
import { VisualizationSummary } from "@components/VisualizationSummary";
import { WorkflowGraphPanel } from "@components/WorkflowGraphPanel";
import { AlgorithmWorkspace } from "@components/workspaces/AlgorithmWorkspace";
import { DataOutputWorkspace } from "@components/workspaces/DataOutputWorkspace";
import { OptionsWorkspace } from "@components/workspaces/OptionsWorkspace";
import { TrainingStatusWorkspace } from "@components/workspaces/TrainingStatusWorkspace";
import { usePredictRoutings } from "@hooks/usePredictRoutings";
import { useRoutingStore } from "@store/routingStore";
import { useResponsiveLayout } from "@styles/responsive";
import { BarChart3, Database, FileOutput, Route, Settings, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const DEFAULT_ITEM = "ITEM-001";

const NAVIGATION_ITEMS = [
  {
    id: "master-data",
    label: "\uae30\ucd08\u0020\uc815\ubcf4\u0020\uc870\ud68c",
    description: "Access \ub370\uc774\ud130 \uc870\ud68c · \ud544\ud130\ub9c1 · \uc990\uaca8\ucc3e\uae30 \uad00\ub9ac",
    icon: <Database size={18} />,
  },
  {
    id: "routing",
    label: "\ub77c\uc6b0\ud305\u0020\uad6c\uc131",
    description: "\ucd94\ucc9c \ub77c\uc6b0\ud305 \uad6c\uc131 · Drag & Drop \uce94\ubc84\uc2a4",
    icon: <Workflow size={18} />,
  },
  {
    id: "algorithm",
    label: "\uc54c\uace0\ub9ac\uc998",
    description: "Trainer · Predictor \ube14\ub8e8\ud504\ub9b0\ud2b8",
    icon: <Route size={18} />,
  },
  {
    id: "data-output",
    label: "\ub370\uc774\ud130\u0020\ucd9c\ub825\u0020\uc124\uc815",
    description: "CSV · Access · ERP \ucd9c\ub825 \ud504\ub85c\ud544",
    icon: <FileOutput size={18} />,
  },
  {
    id: "training-status",
    label: "\ud559\uc2b5\u0020\ubaa8\ub2c8\ud130\ub9c1",
    description: "TensorBoard · \uac00\uc911\uce58 \uc9c0\ud45c",
    icon: <BarChart3 size={18} />,
  },
  {
    id: "options",
    label: "\uc635\uc158",
    description: "\ud504\ub85c\ud30c\uc77c · \uac80\uc0ac \ud56d\ubaa9 · \ub9e4\ud551 \uc124\uc815",
    icon: <Settings size={18} />,
  },
];

const PLACEHOLDER_MESSAGES: Record<string, { title: string; body: string }> = {};

function MenuPlaceholder({ menuId }: { menuId: string }) {
  const message = PLACEHOLDER_MESSAGES[menuId] ?? {
    title: "\uc900\ube44\u0020\uc911",
    body: "\ud574\ub2f9\u0020\uba54\ub274\uc758\u0020\u0055\u0049\u0020\uad6c\uc131\uc740\u0020\uace7\u0020\uc81c\uacf5\ub420\u0020\uc608\uc815\uc785\ub2c8\ub2e4\u002e",
  };

  return (
    <section className="menu-placeholder">
      <div className="panel-card interactive-card">
        <h2 className="text-heading text-2xl font-semibold mb-3">{message.title}</h2>
        <p className="text-muted leading-relaxed">{message.body}</p>
      </div>
    </section>
  );
}

export default function App() {
  const [itemCodes, setItemCodes] = useState<string[]>([DEFAULT_ITEM]);
  const [topK, setTopK] = useState<number>(10);
  const [threshold, setThreshold] = useState<number>(0.3);
  const [selectedProfile, setSelectedProfile] = useState<string | null>("geometry-focus");
  const [manualWeights, setManualWeights] = useState<Record<string, number>>({});
  const [activeMenu, setActiveMenu] = useState<string>("master-data");

  const layout = useResponsiveLayout();

  const { data, isLoading, isFetching, refetch } = usePredictRoutings({
    itemCodes,
    topK,
    threshold,
    featureWeights: manualWeights,
    weightProfile: selectedProfile,
    exportFormats: ["csv", "excel"],
  });

  const setRoutingLoading = useRoutingStore((state) => state.setLoading);
  const loadRecommendations = useRoutingStore((state) => state.loadRecommendations);

  useEffect(() => {
    setRoutingLoading(isLoading || isFetching);
  }, [isLoading, isFetching, setRoutingLoading]);

  useEffect(() => {
    if (data) {
      loadRecommendations(data);
    }
  }, [data, loadRecommendations]);

  const availableProfiles = useMemo(() => {
    const profiles = data?.metrics.feature_weights?.profiles;
    if (profiles && profiles.length > 0) {
      return profiles.map((profile) => ({ name: profile.name, description: profile.description ?? undefined }));
    }
    return [
      { name: "default", description: "Default" },
      { name: "geometry-focus", description: "Geometry emphasis" },
      { name: "operation-history", description: "Runtime emphasis" },
    ];
  }, [data?.metrics.feature_weights?.profiles]);

  const headerData = NAVIGATION_ITEMS.find((item) => item.id === activeMenu) ?? NAVIGATION_ITEMS[0];

  const routingContent = (
    <div className="routing-workspace-grid">
      <aside className="routing-column routing-column--left">
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
        <ReferenceMatrixPanel />
      </aside>

      <section className="routing-column routing-column--center">
        <RoutingProductTabs />
        <TimelinePanel />
        <VisualizationSummary metrics={data?.metrics} />
        <FeatureWeightPanel
          profiles={availableProfiles}
          selectedProfile={selectedProfile}
          onSelectProfile={setSelectedProfile}
          manualWeights={manualWeights}
          onChangeManualWeight={(feature, value) => {
            setManualWeights((prev) => ({ ...prev, [feature]: value }));
            setSelectedProfile("custom");
          }}
          onReset={() => {
            setManualWeights({});
            setSelectedProfile("default");
          }}
        />
        <MetricsPanel metrics={data?.metrics} loading={isLoading || isFetching} />
      </section>

      <aside className="routing-column routing-column--right">
        <CandidatePanel />
        <RoutingGroupControls />
      </aside>
    </div>
  );

  let workspace: JSX.Element;
  switch (activeMenu) {
    case "master-data":
      workspace = <MasterDataWorkspace layout={layout} />;
      break;
    case "routing":
      workspace = (
        <>
          {routingContent}
          <WorkflowGraphPanel />
        </>
      );
      break;
    case "algorithm":
      workspace = <AlgorithmWorkspace />;
      break;
    case "data-output":
      workspace = <DataOutputWorkspace />;
      break;
    case "training-status":
      workspace = <TrainingStatusWorkspace />;
      break;
    case "options":
      workspace = <OptionsWorkspace />;
      break;
    default:
      workspace = <MenuPlaceholder menuId={activeMenu} />;
  }

  return (
    <div className="app-shell">
      <MainNavigation items={NAVIGATION_ITEMS} activeId={activeMenu} onSelect={setActiveMenu} />
      <Header
        onRefresh={activeMenu === "routing" ? refetch : () => undefined}
        loading={activeMenu === "routing" ? isLoading || isFetching : false}
        title={headerData.label}
        description={headerData.description}
      />
      {workspace}
    </div>
  );
}


