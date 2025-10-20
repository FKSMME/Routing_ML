import { CardShell } from "@components/common/CardShell";
import { HyperspeedBackground } from "@components/HyperspeedBackground";
import { LogIn, UserPlus } from "lucide-react";
import { type FormEvent,useState } from "react";

import { ThemeToggle } from "../ThemeToggle";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
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
          const errorData = await response.json().catch(() => ({ detail: "회원가입 실패" }));
          throw new Error(errorData.detail || "회원가입에 실패했습니다");
        }

        await response.json();
        setSuccess("회원가입이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.");
        setUsername("");
        setPassword("");
        setDisplayName("");
        setFullName("");
        setEmail("");
        setTimeout(() => setMode("login"), 3000);
      } else {
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
    <div className="relative flex min-h-screen items-center justify-center surface-base p-6 overflow-hidden">
      <HyperspeedBackground />
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      <CardShell
        className="w-full max-w-md"
        style={{ position: "relative", zIndex: 1 }}
        tone="soft"
        padding="lg"
        innerClassName="space-y-6"
        interactive={false}
      >
        <header className="text-center space-y-2">
          <div className="mb-2 flex justify-center">
            <div className="rounded-full surface-card/90 p-4 shadow-lg">
              {mode === "login" ? <LogIn size={32} className="text-accent-strong" /> : <UserPlus size={32} className="text-accent-strong" />}
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-accent-strong">Routing ML Console</h1>
          <p className="text-sm text-muted">
            {mode === "login" ? "로그인하여 시스템에 접근하세요" : "새 계정을 생성하세요"}
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
            <>
              <div className="space-y-2">
                <label htmlFor="fullName" className="block text-sm font-medium text-foreground">
                  전체 이름 (선택사항)
                </label>
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="form-control w-full"
                  placeholder="전체 이름을 입력하세요"
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  이메일 주소 (선택사항)
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="form-control w-full"
                  placeholder="email@company.com"
                  disabled={loading}
                />
                <p className="text-xs text-muted">승인 알림을 받을 이메일 주소</p>
              </div>

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
            </>
          )}

          {error ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>
          ) : null}

          {success ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-300">{success}</div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (mode === "login" ? "로그인 중..." : "가입 중...") : mode === "login" ? "로그인" : "회원가입"}
          </button>
        </form>

        <footer className="text-center space-y-3 text-xs text-muted">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
              setSuccess(null);
            }}
            className="text-accent hover:text-accent-strong transition-colors"
            disabled={loading}
          >
            {mode === "login" ? "계정이 없으신가요? 회원가입" : "이미 계정이 있으신가요? 로그인"}
          </button>

          <div className="space-y-1 text-foreground">
            <p>비밀번호를 잊으셨나요? <span className="font-medium">KSM Support</span>에게 문의하세요.</p>
            <p>
              Email: <a href="mailto:syyun@ksm.co.kr" className="text-accent hover:text-accent-strong">syyun@ksm.co.kr</a>
            </p>
            <p>Tel: 010-9718-0580</p>
          </div>

          <p className="pt-2 text-[11px] text-muted-strong">© 2025 KSM. All rights reserved.</p>
        </footer>
      </CardShell>
    </div>
  );
}
