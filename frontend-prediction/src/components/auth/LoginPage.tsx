import { BackgroundControls } from "@components/BackgroundControls";
import { CardShell } from "@components/common/CardShell";
import { LiquidEtherBackground } from "@components/LiquidEtherBackground";
import { useAuthStore } from "@store/authStore";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { ThemeToggle } from "../ThemeToggle";

interface LoginPageProps {
  onLoginSuccess: () => Promise<void> | void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const authStatus = useAuthStore((state) => state.status);
  const lastAuthError = useAuthStore((state) => state.lastError);
  const beginAuthCheck = useAuthStore((state) => state.beginAuthCheck);
  const setAuthError = useAuthStore((state) => state.setAuthError);
  const clearAuthError = useAuthStore((state) => state.clearAuthError);

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAuthenticating = authStatus === "authenticating";
  const globalError = useMemo(() => (authStatus === "error" ? lastAuthError : null), [authStatus, lastAuthError]);
  const displayError = localError ?? globalError;

  // Force dark mode on login page (keeps existing visual style)
  useEffect(() => {
    const htmlElement = document.documentElement;
    const previousTheme = htmlElement.getAttribute("data-theme");

    htmlElement.setAttribute("data-theme", "dark");
    htmlElement.classList.add("dark");
    htmlElement.classList.remove("light");

    return () => {
      if (previousTheme && previousTheme !== "dark") {
        htmlElement.setAttribute("data-theme", previousTheme);
        if (previousTheme === "light") {
          htmlElement.classList.add("light");
          htmlElement.classList.remove("dark");
        }
      }
    };
  }, []);

  const resetErrorState = () => {
    setLocalError(null);
    if (authStatus === "error") {
      clearAuthError();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetErrorState();
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === "register") {
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
            display_name: displayName || undefined,
            full_name: fullName || undefined,
            email: email || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "회원가입에 실패했습니다." }));
          throw new Error(errorData.detail || "회원가입 요청을 처리하지 못했습니다.");
        }

        await response.json();
        setSuccess("회원가입이 완료되었습니다. 승인 후 로그인해 주세요.");
        setUsername("");
        setPassword("");
        setDisplayName("");
        setFullName("");
        setEmail("");
        setTimeout(() => setMode("login"), 3000);
      } else {
        beginAuthCheck();
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ username, password }),
          credentials: "include",
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "로그인에 실패했습니다." }));
          throw new Error(errorData.detail || "로그인 요청을 처리하지 못했습니다.");
        }

        const data = await response.json();
        if (data.status !== "approved") {
          throw new Error("계정이 아직 승인되지 않았습니다. 관리자에게 문의해 주세요.");
        }

        await onLoginSuccess();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "요청 처리 중 문제가 발생했습니다.";
      setLocalError(message);
      setAuthError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 text-slate-100">
      <LiquidEtherBackground />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          zIndex: 5,
          background:
            "radial-gradient(circle at 15% 20%, rgba(82, 39, 255, 0.2), transparent 55%)," +
            "radial-gradient(circle at 85% 80%, rgba(255, 159, 252, 0.18), transparent 60%)," +
            "linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(15, 15, 30, 0.55))",
          backdropFilter: "blur(36px)",
          WebkitBackdropFilter: "blur(36px)",
        }}
      />
      <div className="absolute top-4 right-4 z-30">
        <ThemeToggle />
      </div>

      <CardShell className="relative z-20 w-full max-w-md space-y-6 bg-slate-900/70 p-8 shadow-2xl backdrop-blur-xl">
        <header className="space-y-3 text-center">
          <div className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-700/60 bg-slate-800/60 px-4 py-1 text-xs uppercase tracking-[0.2em] text-slate-400">
            Routing ML
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-100">
              {mode === "login" ? "Prediction Routing 로그인" : "새 계정 등록"}
            </h1>
            <p className="text-sm text-slate-400">
              {mode === "login"
                ? "인증된 계정으로 예측 라우팅을 실행하세요."
                : "승인형 계정을 생성하고 관리자의 승인을 기다려 주세요."}
            </p>
          </div>
        </header>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-foreground">
              사용자 ID
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="form-control w-full"
              placeholder="사번 또는 등록된 ID"
              required
              autoFocus
              disabled={loading || isAuthenticating}
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
              onChange={(event) => setPassword(event.target.value)}
              className="form-control w-full"
              placeholder="비밀번호를 입력하세요"
              required
              disabled={loading || isAuthenticating}
            />
          </div>

          {mode === "register" ? (
            <>
              <div className="space-y-2">
                <label htmlFor="fullName" className="block text-sm font-medium text-foreground">
                  이름 (선택)
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="form-control w-full"
                  placeholder="홍길동"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  이메일 (선택)
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="form-control w-full"
                  placeholder="email@company.com"
                  disabled={loading}
                />
                <p className="text-xs text-muted">등록 완료 안내가 이메일로 발송됩니다.</p>
              </div>
              <div className="space-y-2">
                <label htmlFor="displayName" className="block text-sm font-medium text-foreground">
                  표시 이름 (선택)
                </label>
                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="form-control w-full"
                  placeholder="이름 대신 표시할 별칭"
                  disabled={loading}
                />
              </div>
            </>
          ) : null}

          {success ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">{success}</div>
          ) : null}

          {displayError ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">{displayError}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading || isAuthenticating || !username || !password}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading || isAuthenticating ? (mode === "login" ? "로그인 중..." : "등록 중...") : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        <footer className="space-y-3 text-center text-xs text-muted">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              resetErrorState();
              setSuccess(null);
            }}
            className="text-accent hover:text-accent-strong transition-colors"
            disabled={loading || isAuthenticating}
          >
            {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있나요? 로그인"}
          </button>

          <div className="space-y-1 text-foreground">
            <p>
              비밀번호 분실 시 <span className="font-medium">KSM Support</span>로 연락해 주세요.
            </p>
            <p>
              Email:{" "}
              <a href="mailto:syyun@ksm.co.kr" className="text-accent hover:text-accent-strong">
                syyun@ksm.co.kr
              </a>
            </p>
            <p>Tel: 010-9718-0580</p>
          </div>

          <p className="pt-2 text-[11px] text-muted-strong">© 2025 KSM. All rights reserved.</p>
        </footer>
      </CardShell>
      <BackgroundControls />
    </div>
  );
}
