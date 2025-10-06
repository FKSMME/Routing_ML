import { LogOut } from "lucide-react";
import { useAuthStore } from "@store/authStore";
import { DarkModeToggle } from "./DarkModeToggle";
import { AnimatedLogo3D } from "./AnimatedLogo3D";

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

  const handleLogout = async () => {
    await logout();
    window.location.reload();
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
          <DarkModeToggle />
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
    </header>
  );
}
