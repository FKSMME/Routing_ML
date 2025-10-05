import { CandidatePanel } from "@components/CandidatePanel";
import { FeatureWeightPanel } from "@components/FeatureWeightPanel";
import { Header } from "@components/Header";
import { HeroBanner } from "@components/HeroBanner";
import { MainNavigation } from "@components/MainNavigation";
import { ParticleBackground } from "@components/ParticleBackground";
import { ResponsiveNavigationDrawer } from "@components/ResponsiveNavigationDrawer";
import { LoginPage } from "@components/auth/LoginPage";
import { MetricsPanel } from "@components/MetricsPanel";
import { PredictionControls } from "@components/PredictionControls";
import { ReferenceMatrixPanel } from "@components/routing/ReferenceMatrixPanel";
import { RoutingProductTabs } from "@components/routing/RoutingProductTabs";
import { RoutingWorkspaceLayout } from "@components/routing/RoutingWorkspaceLayout";
import { DataOutputWorkspace } from "@components/workspaces/DataOutputWorkspace";
import { ProcessGroupsWorkspace } from "@components/workspaces/ProcessGroupsWorkspace";
import { RoutingMatrixWorkspace } from "@components/workspaces/RoutingMatrixWorkspace";
// Routing groups management components removed - not needed in prediction-only mode
// import { RoutingGroupControls } from "@components/RoutingGroupControls";
// import { SaveInterfacePanel } from "@components/SaveInterfacePanel";
import { TimelinePanel } from "@components/TimelinePanel";
import { VisualizationSummary } from "@components/VisualizationSummary";
import { WorkflowGraphPanel } from "@components/WorkflowGraphPanel";
import { usePredictRoutings } from "@hooks/usePredictRoutings";
import { useResponsiveNav } from "@hooks/useResponsiveNav";
import { useRoutingStore, type RoutingProductTab } from "@store/routingStore";
import { useWorkspaceStore, type NavigationKey } from "@store/workspaceStore";
import { useAuthStore } from "@store/authStore";
import { Database, FileOutput, Layers, Menu, Table, Workflow } from "lucide-react";
import axios from "axios";
import { useEffect, useState } from "react";

// 🔵 Prediction & Routing Creation Web Service
const NAVIGATION_ITEMS = [
  {
    id: "master-data",
    label: "기준정보 확인",
    description: "Access 연결 · 트리/행렬 탐색 · 즐겨찾기 히스토리",
    icon: <Database size={18} />,
  },
  {
    id: "routing",
    label: "라우팅 생성",
    description: "Drag&Drop 타임라인 · 후보 공정 카드 · SAVE 패널",
    icon: <Workflow size={18} />,
  },
  {
    id: "routing-matrix",
    label: "라우팅 조합 관리",
    description: "라우팅 세트 · Variant 조합 편집",
    icon: <Table size={18} />,
  },
  {
    id: "process-groups",
    label: "공정 그룹 관리",
    description: "대체 경로 컬럼 · 후공정 고정값 구성",
    icon: <Layers size={18} />,
  },
  {
    id: "data-output",
    label: "데이터 출력 설정",
    description: "컬럼 매핑 매트릭스 · 미리보기 · 프로필 저장",
    icon: <FileOutput size={18} />,
  },
];

const PREDICTION_DELAY_MESSAGE = "Server response delayed. Please try again in a moment.";

interface PredictionErrorInfo {
  banner: string;
  details?: string;
}

const ensureNonEmptyString = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
};

const extractAxiosErrorDetail = (error: unknown): string | undefined => {
  if (!axios.isAxiosError(error)) {
    return undefined;
  }

  const responseData = error.response?.data as unknown;
  const responseString = ensureNonEmptyString(responseData);
  if (responseString) {
    return responseString;
  }

  if (responseData && typeof responseData === "object") {
    const record = responseData as Record<string, unknown>;
    return ensureNonEmptyString(record.detail) ?? ensureNonEmptyString(record.message);
  }

  return ensureNonEmptyString(error.message);
};

const toPredictionErrorInfo = (error: unknown): PredictionErrorInfo => {
  const banner = PREDICTION_DELAY_MESSAGE;
  const detail =
    extractAxiosErrorDetail(error) ??
    (error instanceof Error ? ensureNonEmptyString(error.message) : ensureNonEmptyString(error));

  return detail && detail !== banner ? { banner, details: detail } : { banner };
};

export default function App() {
  const { layout, isDrawerMode, isOpen: isNavOpen, isPersistent, toggle, close } = useResponsiveNav();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const login = useAuthStore((state) => state.login);
  const [authLoading, setAuthLoading] = useState(true);

  // All hooks must be called before any conditional returns
  const activeMenu = useWorkspaceStore((state) => state.activeMenu);
  const setActiveMenu = useWorkspaceStore((state) => state.setActiveMenu);
  const itemCodes = useWorkspaceStore((state) => state.itemSearch.itemCodes);
  const topK = useWorkspaceStore((state) => state.itemSearch.topK);
  const threshold = useWorkspaceStore((state) => state.itemSearch.threshold);
  const updateItemCodes = useWorkspaceStore((state) => state.updateItemCodes);
  const updateTopK = useWorkspaceStore((state) => state.updateTopK);
  const updateThreshold = useWorkspaceStore((state) => state.updateThreshold);
  const featureWeights = useWorkspaceStore((state) => state.featureWeights);
  const setFeatureWeightProfile = useWorkspaceStore((state) => state.setFeatureWeightProfile);
  const setManualWeight = useWorkspaceStore((state) => state.setManualWeight);
  const resetManualWeights = useWorkspaceStore((state) => state.resetManualWeights);
  const exportProfile = useWorkspaceStore((state) => state.exportProfile);
  const applyPredictionResponse = useWorkspaceStore((state) => state.applyPredictionResponse);
  const setWorkspaceLayout = useWorkspaceStore((state) => state.setLayout);

  useEffect(() => {
    const normalizedLayout = layout === "mobile" ? "mobile" : layout === "tablet" ? "tablet" : "desktop";
    setWorkspaceLayout(normalizedLayout);
  }, [layout, setWorkspaceLayout]);

  // 🎨 Force dark mode for cyberpunk theme
  useEffect(() => {
    document.documentElement.classList.add('dark');
    document.body.style.backgroundColor = '#0a0e1a';
  }, []);

  const { data, isLoading, isFetching, error, refetch } = usePredictRoutings({
    itemCodes,
    topK,
    threshold,
    featureWeights: featureWeights.manualWeights,
    weightProfile: featureWeights.profile,
    exportFormats: exportProfile.formats,
    withVisualization: exportProfile.withVisualization,
  });

  const [predictionError, setPredictionError] = useState<PredictionErrorInfo | null>(null);

  useEffect(() => {
    if (error) {
      setPredictionError(toPredictionErrorInfo(error));
    }
  }, [error]);

  useEffect(() => {
    if (data) {
      setPredictionError(null);
    }
  }, [data]);

  useEffect(() => {
    if (itemCodes.length === 0) {
      setPredictionError(null);
    }
  }, [itemCodes]);

  const setRoutingLoading = useRoutingStore((state) => state.setLoading);

  useEffect(() => {
    setRoutingLoading(isLoading || isFetching);
  }, [isLoading, isFetching, setRoutingLoading]);

  useEffect(() => {
    if (data) {
      applyPredictionResponse(data);
    }
  }, [applyPredictionResponse, data]);

  const predictionControlsError = predictionError?.details ?? predictionError?.banner ?? null;

  // 인증 확인
  useEffect(() => {
    const verifyAuth = async () => {
      await checkAuth();
      setAuthLoading(false);
    };
    verifyAuth();
  }, [checkAuth]);

  const handleLoginSuccess = async () => {
    await checkAuth();
  };

  const renderPredictionBanner = () =>
    predictionError ? (
      <div className="status-banner status-banner--error mb-4" role="alert">
        <strong>{predictionError.banner}</strong>
        {predictionError.details ? <p className="mt-1 text-sm">{predictionError.details}</p> : null}
      </div>
    ) : null;

  const headerData = NAVIGATION_ITEMS.find((item) => item.id === activeMenu) ?? NAVIGATION_ITEMS[0];

  // 인증 확인 중이면 로딩 표시
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center surface-base">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
      </div>
    );
  }

  // 인증되지 않은 경우 로그인 페이지 표시
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const renderRoutingWorkspace = (tab?: RoutingProductTab) => {
    const tabKey = tab?.id ?? "default";
    return (
      <RoutingWorkspaceLayout
        left={
          <>
            {renderPredictionBanner()}
            <PredictionControls
              itemCodes={itemCodes}
              onChangeItemCodes={updateItemCodes}
              topK={topK}
              onChangeTopK={updateTopK}
              threshold={threshold}
              onChangeThreshold={updateThreshold}
              loading={isLoading || isFetching}
              onSubmit={refetch}
              errorMessage={predictionControlsError}
            />
            <ReferenceMatrixPanel key={`reference-${tabKey}`} />
          </>
        }
        center={
          <>
            <TimelinePanel key={`timeline-${tabKey}`} />
            <VisualizationSummary metrics={data?.metrics} />
            <FeatureWeightPanel
              profiles={featureWeights.availableProfiles}
              selectedProfile={featureWeights.profile}
              onSelectProfile={setFeatureWeightProfile}
              manualWeights={featureWeights.manualWeights}
              onChangeManualWeight={setManualWeight}
              onReset={resetManualWeights}
            />
            <MetricsPanel metrics={data?.metrics} loading={isLoading || isFetching} />
          </>
        }
        right={
          <>
            <CandidatePanel key={`candidates-${tabKey}`} />
          </>
        }
      />
    );
  };

  const routingContent = (
    <>
      <RoutingProductTabs
        renderWorkspace={(tab) => renderRoutingWorkspace(tab)}
        emptyState={renderRoutingWorkspace()}
      />
      <div className="routing-workspace-grid">
        <aside className="routing-column routing-column--left">
          {renderPredictionBanner()}
          <PredictionControls
            itemCodes={itemCodes}
            onChangeItemCodes={updateItemCodes}
            topK={topK}
            onChangeTopK={updateTopK}
            threshold={threshold}
            onChangeThreshold={updateThreshold}
            loading={isLoading || isFetching}
            onSubmit={refetch}
            errorMessage={predictionControlsError}
          />
          <ReferenceMatrixPanel />
        </aside>

        <section className="routing-column routing-column--center">
          {/* <RoutingProductTabs /> */}
          <TimelinePanel />
          <VisualizationSummary metrics={data?.metrics} />
          <FeatureWeightPanel
            profiles={featureWeights.availableProfiles}
            selectedProfile={featureWeights.profile}
            onSelectProfile={setFeatureWeightProfile}
            manualWeights={featureWeights.manualWeights}
            onChangeManualWeight={setManualWeight}
            onReset={resetManualWeights}
          />
          <MetricsPanel metrics={data?.metrics} loading={isLoading || isFetching} />
        </section>

        <aside className="routing-column routing-column--right">
          <CandidatePanel />
        </aside>
      </div>
    </>
  );

  let workspace: JSX.Element;
  switch (activeMenu) {
    case "master-data":
      workspace = <HeroBanner activeMenu={activeMenu} onNavigate={setActiveMenu} />;
      break;
    case "routing":
      workspace = (
        <>
          {routingContent}
          <WorkflowGraphPanel />
        </>
      );
      break;
    case "routing-matrix":
      workspace = <RoutingMatrixWorkspace />;
      break;
    case "process-groups":
      workspace = <ProcessGroupsWorkspace />;
      break;
    case "data-output":
      workspace = <DataOutputWorkspace />;
      break;
    default:
      workspace = <HeroBanner activeMenu={activeMenu} onNavigate={setActiveMenu} />;
  }

  const drawerId = "responsive-navigation";

  return (
    <div className="app-shell" data-nav-mode={isDrawerMode ? "drawer" : "persistent"}>
      <ParticleBackground />
      {isPersistent ? (
        <MainNavigation items={NAVIGATION_ITEMS} activeId={activeMenu} onSelect={(id) => setActiveMenu(id as NavigationKey)} />
      ) : (
        <ResponsiveNavigationDrawer
          items={NAVIGATION_ITEMS}
          activeId={activeMenu}
          onSelect={(id) => setActiveMenu(id as NavigationKey)}
          open={isNavOpen}
          onClose={close}
          drawerId={drawerId}
        />
      )}
      {isDrawerMode ? (
        <div className="responsive-nav-toggle">
          <button
            type="button"
            className="responsive-nav-toggle__button"
            aria-controls={drawerId}
            aria-expanded={isNavOpen}
            onClick={toggle}
          >
            <Menu size={18} aria-hidden="true" />
            <span>메뉴</span>
          </button>
        </div>
      ) : null}
      <Header
        onRefresh={activeMenu === "routing" ? refetch : () => undefined}
        loading={activeMenu === "routing" ? isLoading || isFetching : false}
        title={headerData.label}
        description={headerData.description}
      />
      <div key={activeMenu} className="workspace-transition dust-effect">
        {workspace}
      </div>
    </div>
  );
}


