import { useState, lazy, Suspense, type FormEvent } from "react";
import { CardShell } from "@components/common/CardShell";
import { LogIn, UserPlus } from "lucide-react";
import { ThemeToggle } from "../ThemeToggle";

// 🚀 Three.js 지연 로딩 (초기 번들 크기 -600KB)
const Ballpit = lazy(() => import("@components/effects/Ballpit"));


interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "register") {
        // 회원가입
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
            display_name: displayName || undefined
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "회원가입 실패" }));
          throw new Error(errorData.detail || "회원가입에 실패했습니다");
        }

        const data = await response.json();
        setSuccess("회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
        setUsername("");
        setPassword("");
        setDisplayName("");
        setTimeout(() => setMode("login"), 3000);
      } else {
        // 로그인
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "로그인 실패" }));
          throw new Error(errorData.detail || "로그인에 실패했습니다");
        }

        const data = await response.json();

        if (data.status !== "approved") {
          throw new Error("계정이 승인되지 않았습니다. 관리자에게 문의하세요.");
        }

        onLoginSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center surface-base p-6" style={{ position: 'relative' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}>
        <Suspense fallback={<div className="surface-base" style={{ width: '100%', height: '100%' }} />}>
          <Ballpit count={100} followCursor={true} />
        </Suspense>
      </div>
      <div className="absolute top-4 right-4" style={{ zIndex: 10 }}>
        <ThemeToggle />
      </div>
      <CardShell
        className="w-full max-w-md"
        style={{ position: 'relative', zIndex: 1 }}
        tone="soft"
        padding="lg"
        innerClassName="space-y-6"
        interactive={false}
      >
        <header className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full surface-card p-4">
              {mode === "login" ? (
                <LogIn size={32} className="text-accent-strong" />
              ) : (
                <UserPlus size={32} className="text-accent-strong" />
              )}
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-accent-strong">Routing ML Console</h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "login" ? "로그인하여 시스템에 접속하세요" : "새 계정을 생성하세요"}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-foreground">
              사용자 ID
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-control w-full"
              placeholder="사용자 ID를 입력하세요"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-control w-full"
              placeholder="비밀번호를 입력하세요"
              required
              disabled={loading}
            />
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <label htmlFor="displayName" className="block text-sm font-medium text-foreground">
                표시 이름 (선택사항)
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="form-control w-full"
                placeholder="표시할 이름을 입력하세요"
                disabled={loading}
              />
            </div>
          )}

          {error ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">
              {success}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (mode === "login" ? "로그인 중..." : "가입 중...") : (mode === "login" ? "로그인" : "회원가입")}
          </button>
        </form>

        <footer className="text-center space-y-2">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
              setSuccess(null);
            }}
            className="text-xs text-accent hover:text-accent-strong transition-colors"
            disabled={loading}
          >
            {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
          </button>
        </footer>
      </CardShell>
    </div>
  );
}
