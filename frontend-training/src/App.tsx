import { LoginPage } from "@components/auth/LoginPage";
import { BackgroundControls } from "@components/BackgroundControls";
import { BlueprintGraphPanel } from "@components/blueprint/BlueprintGraphPanel";
import ErrorBoundary from "@components/ErrorBoundary";
import { FullScreen3DBackground } from "@components/FullScreen3DBackground";
import { Header } from "@components/Header";
import { HeroBanner } from "@components/HeroBanner";
import { MainNavigation } from "@components/MainNavigation";
import { ModelTrainingPanel } from "@components/ModelTrainingPanel";
import { ResponsiveNavigationDrawer } from "@components/ResponsiveNavigationDrawer";
import { AlgorithmVisualizationWorkspace } from "@components/workspaces/AlgorithmVisualizationWorkspace";
import { OptionsWorkspace } from "@components/workspaces/OptionsWorkspace";
import { TensorboardWorkspace } from "@components/workspaces/TensorboardWorkspace";
import { TrainingStatusWorkspace } from "@components/workspaces/TrainingStatusWorkspace";
import { useResponsiveNav } from "@hooks/useResponsiveNav";
import { useTheme } from "@hooks/useTheme";
import { useAuthStore } from "@store/authStore";
import type { NavigationKey } from "@store/workspaceStore";
import { useWorkspaceStore } from "@store/workspaceStore";
import { BarChart3, Brain, Menu, Route, ScatterChart,Settings } from "lucide-react";
import { useEffect, useState } from "react";

// 🟢 Training & Model Management Web Service
const NAVIGATION_ITEMS = [
  {
    id: "algorithm",
    label: "알고리즘",
    description: "블루프린트 그래프와 알고리즘 흐름을 한눈에 확인",
    icon: <Route size={18} />,
  },
  {
    id: "training-status",
    label: "훈련 상태 현황",
    description: "모델 버전 카드와 TensorBoard 지표를 모니터링",
    icon: <BarChart3 size={18} />,
  },
  {
    id: "tensorboard",
    label: "TensorBoard",
    description: "3D 임베딩과 지표 시각화를 탐색",
    icon: <ScatterChart size={18} />,
  },
  {
    id: "model-training",
    label: "모델 학습",
    description: "새 모델 학습 실행과 상태 추적",
    icon: <Brain size={18} />,
  },
  {
    id: "options",
    label: "시스템 옵션",
    description: "표준값 · 유사도 설정 · ERP/MSSQL 구성을 관리",
    icon: <Settings size={18} />,
  },
];

export default function App() {
  const { layout, isDrawerMode, isOpen: isNavOpen, isPersistent, toggle, close } = useResponsiveNav();
  useTheme();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const checkAuth = useAuthStore((state) => state.checkAuth);
  const [authLoading, setAuthLoading] = useState(true);

  const activeMenu = useWorkspaceStore((state) => state.activeMenu);
  const setActiveMenu = useWorkspaceStore((state) => state.setActiveMenu);
  const setWorkspaceLayout = useWorkspaceStore((state) => state.setLayout);

  useEffect(() => {
    const normalizedLayout = layout === "mobile" ? "mobile" : layout === "tablet" ? "tablet" : "desktop";
    setWorkspaceLayout(normalizedLayout);
  }, [layout, setWorkspaceLayout]);

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

  const headerData = NAVIGATION_ITEMS.find((item) => item.id === activeMenu) ?? NAVIGATION_ITEMS[0];

  useEffect(() => {
    const resolveMenuFromUrl = () => {
      try {
        const hashCandidate = window.location.hash.replace("#", "").trim();
        const url = new URL(window.location.href);
        const paramCandidate = (url.searchParams.get("menu") ?? "").trim();
        const candidate = paramCandidate || hashCandidate;
        if (
          candidate &&
          candidate !== activeMenu &&
          NAVIGATION_ITEMS.some((item) => item.id === candidate)
        ) {
          setActiveMenu(candidate as NavigationKey);
        }
      } catch {
        // ignore URL parsing errors
      }
    };

    resolveMenuFromUrl();
    window.addEventListener("hashchange", resolveMenuFromUrl);
    window.addEventListener("popstate", resolveMenuFromUrl);
    return () => {
      window.removeEventListener("hashchange", resolveMenuFromUrl);
      window.removeEventListener("popstate", resolveMenuFromUrl);
    };
  }, [activeMenu, setActiveMenu]);

  useEffect(() => {
    const currentHash = window.location.hash.replace("#", "");
    if (currentHash !== activeMenu) {
      const url = new URL(window.location.href);
      url.searchParams.set("menu", activeMenu);
      window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}#${activeMenu}`);
    }
  }, [activeMenu]);

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

  // Training workspace
  let workspace: JSX.Element;
  switch (activeMenu) {
    case "algorithm":
      workspace = <AlgorithmVisualizationWorkspace />;
      break;
    case "training-status":
      workspace = <TrainingStatusWorkspace />;
      break;
    case "tensorboard":
      workspace = <TensorboardWorkspace />;
      break;
    case "model-training":
      workspace = <ModelTrainingPanel />;
      break;
    case "options":
      workspace = <OptionsWorkspace />;
      break;
    default:
      workspace = <HeroBanner activeMenu={activeMenu} onNavigate={setActiveMenu} />;
  }

  const drawerId = "responsive-navigation";

  return (
    <div className="app-shell" data-nav-mode={isDrawerMode ? "drawer" : "persistent"}>
      <FullScreen3DBackground />
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
        onRefresh={() => undefined}
        loading={false}
        title={headerData.label}
        description={headerData.description}
      />
      <ErrorBoundary>
        <div key={activeMenu} className="workspace-transition dust-effect">
          {workspace}
        </div>
      </ErrorBoundary>
    </div>
  );
}

