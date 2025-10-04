import { Header } from "@components/Header";
import { HeroBanner } from "@components/HeroBanner";
import { MainNavigation } from "@components/MainNavigation";
import { ResponsiveNavigationDrawer } from "@components/ResponsiveNavigationDrawer";
import { LoginPage } from "@components/auth/LoginPage";
import { OptionsWorkspace } from "@components/workspaces/OptionsWorkspace";
import { TrainingStatusWorkspace } from "@components/workspaces/TrainingStatusWorkspace";
import { useResponsiveNav } from "@hooks/useResponsiveNav";
import { useWorkspaceStore } from "@store/workspaceStore";
import { useAuthStore } from "@store/authStore";
import { BarChart3, Menu, Route, Settings } from "lucide-react";
import { useEffect, useState } from "react";

// 🟢 Training & Model Management Web Service
const NAVIGATION_ITEMS = [
  {
    id: "algorithm",
    label: "알고리즘",
    description: "블루프린트 그래프 · 설정 Drawer · 코드 템플릿",
    icon: <Route size={18} />,
  },
  {
    id: "training-status",
    label: "학습 데이터 현황",
    description: "모델 버전 카드 · TensorBoard · 피처 토글",
    icon: <BarChart3 size={18} />,
  },
  {
    id: "options",
    label: "시스템 옵션",
    description: "표준편차 · 유사 품목 규칙 · ERP/Access 설정",
    icon: <Settings size={18} />,
  },
];

export default function App() {
  const { layout, isDrawerMode, isOpen: isNavOpen, isPersistent, toggle, close } = useResponsiveNav();

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
      workspace = <HeroBanner activeMenu={activeMenu} onNavigate={setActiveMenu} />;
      break;
    case "training-status":
      workspace = <TrainingStatusWorkspace />;
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
      {isPersistent ? (
        <MainNavigation items={NAVIGATION_ITEMS} activeId={activeMenu} onSelect={setActiveMenu} />
      ) : (
        <ResponsiveNavigationDrawer
          items={NAVIGATION_ITEMS}
          activeId={activeMenu}
          onSelect={setActiveMenu}
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
      {workspace}
    </div>
  );
}
