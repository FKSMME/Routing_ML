import { useState, type FormEvent } from "react";
import { CardShell } from "@components/common/CardShell";
import { LogIn } from "lucide-react";

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
        credentials: "include", // 쿠키 포함
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "로그인 실패" }));
        throw new Error(errorData.detail || "로그인에 실패했습니다");
      }

      const data = await response.json();

      // 상태가 approved인 경우에만 로그인 성공
      if (data.status !== "approved") {
        throw new Error("계정이 승인되지 않았습니다. 관리자에게 문의하세요.");
      }

      // 로그인 성공
      onLoginSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center surface-base p-6">
      <CardShell
        className="w-full max-w-md"
        tone="soft"
        padding="lg"
        innerClassName="space-y-6"
        interactive={false}
      >
        <header className="text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-full surface-card p-4">
              <LogIn size={32} className="text-accent-strong" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-accent-strong">Routing ML Console</h1>
          <p className="mt-2 text-sm text-muted">로그인하여 시스템에 접속하세요</p>
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

          {error ? (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <footer className="text-center text-xs text-muted">
          <p>계정이 없으신가요? 관리자에게 문의하세요.</p>
        </footer>
      </CardShell>
    </div>
  );
}
