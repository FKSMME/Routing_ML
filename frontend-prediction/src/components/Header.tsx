import { useAuthStore } from "@store/authStore";
import { Home, KeyRound,LogOut } from "lucide-react";
import { useState } from "react";

import { AnimatedLogo3D } from "./AnimatedLogo3D";
import { ChangePassword } from "./auth/ChangePassword";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  onRefresh: () => void;
  loading: boolean;
  title: string;
  description: string;
}

export function Header({ onRefresh, loading, title, description }: HeaderProps) {
  const displayName = useAuthStore((state) => state.displayName);
  const username = useAuthStore((state) => state.username);
  const logout = useAuthStore((state) => state.logout);
  const homeUrl = `${window.location.protocol}//${window.location.hostname}:5176`;
  const [showChangePassword, setShowChangePassword] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="app-header">
      <div className="header-content frosted-panel">
        <div className="flex items-center gap-4">
          <AnimatedLogo3D />
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-widest text-accent-strong">Routing-ML</p>
            <h1 className="text-3xl font-semibold text-primary">{title}</h1>
            <p className="text-sm text-muted">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">{displayName || username}</p>
            <p className="text-xs text-muted">{username}</p>
          </div>
          <ThemeToggle />
          <button
            onClick={() => setShowChangePassword(true)}
            className="btn-secondary flex items-center gap-2"
            title="비밀번호 변경"
          >
            <KeyRound size={16} />
            <span>비밀번호 변경</span>
          </button>
          <a
            href={homeUrl}
            className="btn-secondary flex items-center gap-2"
            title="홈으로"
          >
            <Home size={16} />
            <span>홈</span>
          </a>
          <button onClick={onRefresh} disabled={loading} className="btn-primary">
            {loading ? "새로고침 중..." : "새로 고침"}
          </button>
          <button
            onClick={handleLogout}
            className="btn-secondary flex items-center gap-2"
            title="로그아웃"
          >
            <LogOut size={16} />
            <span>로그아웃</span>
          </button>
        </div>
      </div>

      {/* 비밀번호 변경 모달 */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="relative max-w-2xl w-full mx-4">
            <button
              onClick={() => setShowChangePassword(false)}
              className="absolute top-4 right-4 text-muted hover:text-foreground z-10"
              aria-label="닫기"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
            <ChangePassword />
          </div>
        </div>
      )}
    </header>
  );
}
