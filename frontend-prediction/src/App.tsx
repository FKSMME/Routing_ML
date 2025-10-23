import { LoginPage } from "@components/auth/LoginPage";
import { BackgroundControls } from "@components/BackgroundControls";
import { Header } from "@components/Header";
import { LiquidEtherBackground } from "@components/LiquidEtherBackground";
import { MainNavigation, type NavigationItem as MainNavigationItem } from "@components/MainNavigation";
import { ResponsiveNavigationDrawer } from "@components/ResponsiveNavigationDrawer";
import { RoutingProductTabs } from "@components/routing/RoutingProductTabs";
// 🚀 Workspace lazy loading (코드 분할)
import { lazy } from "react";
const DataOutputWorkspace = lazy(() => import("@components/workspaces/DataOutputWorkspace").then(m => ({ default: m.DataOutputWorkspace })));
const RoutingConfigWorkspace = lazy(() => import("@components/workspaces/RoutingConfigWorkspace").then(m => ({ default: m.RoutingConfigWorkspace })));
const MasterDataSimpleWorkspace = lazy(() => import("@components/workspaces/MasterDataSimpleWorkspace").then(m => ({ default: m.MasterDataSimpleWorkspace })));
const RoutingTabbedWorkspace = lazy(() => import("@components/workspaces/RoutingTabbedWorkspace").then(m => ({ default: m.RoutingTabbedWorkspace })));
const DataRelationshipManager = lazy(() => import("@components/admin/DataRelationshipManager").then(m => ({ default: m.DataRelationshipManager })));
const ProfileManagementWorkspace = lazy(() => import("@components/workspaces/ProfileManagementWorkspace").then(m => ({ default: m.ProfileManagementWorkspace })));
const DataQualityWorkspace = lazy(() => import("@components/workspaces/DataQualityWorkspace").then(m => ({ default: m.default })));
import ErrorBoundary from "@components/ErrorBoundary";
import { HeroBanner } from "@components/HeroBanner";
import { usePredictRoutings } from "@hooks/usePredictRoutings";
import { useResponsiveNav } from "@hooks/useResponsiveNav";
import { useTheme } from "@hooks/useTheme";
import { useAuthStore } from "@store/authStore";
import { type RoutingProductTab,useRoutingStore } from "@store/routingStore";
import { type AppRole, isMenuAllowedForRoles, type NavigationKey,useWorkspaceStore } from "@store/workspaceStore";
import axios from "axios";
import { Activity, Database, Menu, Settings2, Table, Workflow } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";

// Role-aware navigation configuration
interface NavigationConfig extends MainNavigationItem {
  key: NavigationKey;
}

const NAVIGATION_CONFIG: NavigationConfig[] = [
  {
    key: "routing",
    id: "routing",
    label: "라우팅 생성",
    description: "Drag&Drop 타임라인으로 공정 라우팅을 예측하고 구성합니다.",
    icon: <Workflow size={18} />,
  },
  {
    key: "master-data",
    id: "master-data",
    label: "마스터 데이터",
    description: "기준 데이터를 탐색하고 필요한 자료를 정비합니다.",
    icon: <Database size={18} />,
  },
  {
    key: "routing-config",
    id: "routing-config",
    label: "라우팅 구성",
    description: "라우팅 규칙과 공정 그룹을 설정합니다.",
    icon: <Table size={18} />,
  },
  {
    key: "data-relationship",
    id: "data-relationship",
    label: "데이터 관계 매핑",
    description: "학습 · 예측 · 출력 데이터 간 관계를 정의합니다.",
    icon: <Settings2 size={18} />,
  },
  {
    key: "profile-management",
    id: "profile-management",
    label: "프로필 관리",
    description: "가중치와 환경 프로필을 구성원별로 관리합니다.",
    icon: <Settings2 size={18} />,
  },
  {
    key: "data-quality",
    id: "data-quality",
    label: "데이터 품질 대시보드",
    description: "실적 지표와 이상 징후를 모니터링합니다.",
    icon: <Activity size={18} />,
  },
];
const PREDICTION_DELAY_MESSAGE = "Server response delayed. Please try again in a moment.";

const AuthLoadingScreen = () => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-4 surface-base" role="status" aria-live="polite">
    <div className="h-12 w-12 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
    <div className="text-center space-y-1">
      <p className="text-base font-medium text-slate-200">Checking your session…</p>
      <p className="text-sm text-slate-400">Authenticating with the server. This usually completes in a few seconds.</p>
    </div>
  </div>
);

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

  const authStatus = useAuthStore((state) => state.status);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const isAuthenticated = authStatus === "authenticated";
  const isAuthenticating = authStatus === "unknown" || authStatus === "authenticating";

  // 네비게이션 아이템 (관리자는 추가 메뉴 표시)
    const userRoles = useMemo<AppRole[]>(() => (isAdmin ? ["admin", "user"] : ["user"]), [isAdmin]);

  const allowedNavigation = useMemo(
    () => NAVIGATION_CONFIG.filter((item) => isMenuAllowedForRoles(item.key, userRoles)),
    [userRoles]
  );

  const navigationItems = useMemo<MainNavigationItem[]>(
    () => allowedNavigation.map(({ key: _key, ...item }) => item),
    [allowedNavigation]
  );
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
    if (allowedNavigation.length === 0) {
      return;
    }
    if (!allowedNavigation.some((item) => item.key === activeMenu)) {
      const fallbackKey = allowedNavigation[0].key;
      if (fallbackKey !== activeMenu) {
        setActiveMenu(fallbackKey);
      }
    }
  }, [allowedNavigation, activeMenu, setActiveMenu]);

  useEffect(() => {
    // Currently only desktop layout is supported in workspaceStore
    setWorkspaceLayout("desktop");
  }, [layout, setWorkspaceLayout]);

  // 🎨 Theme management with toggle support
  useTheme();

  const hasSearchItems = itemCodes.length > 0;
  const predictQueryEnabled = isAuthenticated && !isAuthenticating && hasSearchItems;

  const { data, isLoading, isFetching, error, refetch } = usePredictRoutings({
    itemCodes,
    topK,
    threshold,
    featureWeights: featureWeights.manualWeights,
    weightProfile: featureWeights.profile,
    exportFormats: exportProfile.formats,
    withVisualization: exportProfile.withVisualization,
    enabled: predictQueryEnabled,
  });

  // Get selected candidate for explanation panel
  const selectedCandidateId = useRoutingStore((state) => state.selectedCandidateId);
  const selectedCandidate = data?.candidates
    ?.find((candidate) => candidate.CANDIDATE_ITEM_CD === selectedCandidateId) ?? null;

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

  const predictionControlsError = predictionError?.details ?? predictionError?.banner ?? undefined;

  // Authentication bootstrap
  useEffect(() => {
    if (authStatus === "unknown") {
      void checkAuth();
    }
  }, [authStatus, checkAuth]);

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

  const headerConfig =
    allowedNavigation.find((item) => item.key === activeMenu) ??
    allowedNavigation[0] ??
    NAVIGATION_CONFIG[0];

  // 인증 확인 중이면 로딩 표시
  if (isAuthenticating) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  const renderRoutingWorkspace = (tab?: RoutingProductTab) => {
    const tabKey = tab?.id ?? "default";
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="text-muted">로딩 중...</div></div>}>
        <RoutingTabbedWorkspace
          itemCodes={itemCodes}
          onChangeItemCodes={updateItemCodes}
          topK={topK}
          onChangeTopK={updateTopK}
          threshold={threshold}
          onChangeThreshold={updateThreshold}
          loading={isLoading || isFetching}
          onSubmit={refetch}
          errorMessage={predictionControlsError}
          data={data}
          selectedCandidate={selectedCandidate}
          featureWeights={featureWeights}
          setFeatureWeightProfile={setFeatureWeightProfile}
          setManualWeight={setManualWeight}
          resetManualWeights={resetManualWeights}
          renderPredictionBanner={renderPredictionBanner}
          tabKey={tabKey}
        />
      </Suspense>
    );
  };

  const routingContent = (
    <RoutingProductTabs
      renderWorkspace={(tab) => renderRoutingWorkspace(tab)}
      emptyState={renderRoutingWorkspace()}
    />
  );

  let workspace: JSX.Element;
  const loadingFallback = <div className="flex items-center justify-center h-full"><div className="text-muted">워크스페이스 로딩 중...</div></div>;

  switch (activeMenu) {
    case "routing":
      workspace = routingContent;
      break;
    case "master-data":
      workspace = <Suspense fallback={loadingFallback}><MasterDataSimpleWorkspace /></Suspense>;
      break;
    case "routing-config":
    case "routing-matrix":
    case "process-groups":
      workspace = <Suspense fallback={loadingFallback}><RoutingConfigWorkspace /></Suspense>;
      break;
    case "data-output":
      workspace = <Suspense fallback={loadingFallback}><DataOutputWorkspace /></Suspense>;
      break;
    case "data-mapping":
    case "data-relationship":
      workspace = <Suspense fallback={loadingFallback}><DataRelationshipManager /></Suspense>;
      break;
    case "profile-management":
      workspace = <Suspense fallback={loadingFallback}><ProfileManagementWorkspace /></Suspense>;
      break;
    case "data-quality":
      workspace = <Suspense fallback={loadingFallback}><DataQualityWorkspace /></Suspense>;
      break;
    default:
      workspace = <HeroBanner activeMenu={activeMenu} onNavigate={setActiveMenu} />;
  }

  const drawerId = "responsive-navigation";

  return (
    <div className="app-shell" data-nav-mode={isDrawerMode ? "drawer" : "persistent"}>
      <LiquidEtherBackground />
      <BackgroundControls />
      {isPersistent ? (
        <MainNavigation items={navigationItems} activeId={activeMenu} onSelect={(id) => setActiveMenu(id as NavigationKey)} />
      ) : (
        <ResponsiveNavigationDrawer
          items={navigationItems}
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
        title={headerConfig.label}
        description={headerConfig.description}
      />
      <ErrorBoundary>
        <div key={activeMenu} className="workspace-transition dust-effect">
          {workspace}
        </div>
      </ErrorBoundary>
    </div>
  );
}




