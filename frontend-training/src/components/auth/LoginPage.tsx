import { BackgroundControls } from "@components/BackgroundControls";
import { CardShell } from "@components/common/CardShell";
import { FullScreen3DBackground } from "@components/FullScreen3DBackground";
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
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "ȸ������ ����" }));
          throw new Error(errorData.detail || "ȸ�����Կ� �����߽��ϴ�");
        }

        await response.json();
        setSuccess("ȸ�������� �Ϸ�Ǿ����ϴ�. ������ ���� �� �α����� �� �ֽ��ϴ�.");
        setUsername("");
        setPassword("");
        setDisplayName("");
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
          const errorData = await response.json().catch(() => ({ detail: "�α��� ����" }));
          throw new Error(errorData.detail || "�α��ο� �����߽��ϴ�");
        }

        const data = await response.json();
        if (data.status !== "approved") {
          throw new Error("������ ���ε��� �ʾҽ��ϴ�. �����ڿ��� �����ϼ���.");
        }

        onLoginSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "������ �߻��߽��ϴ�");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center surface-base p-6 overflow-hidden">
      <FullScreen3DBackground />
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
            {mode === "login" ? "�α����Ͽ� �ý��ۿ� �����ϼ���" : "�� ������ �����ϼ���"}
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-foreground">
              ����� ID
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="form-control w-full"
              placeholder="����� ID�� �Է��ϼ���"
              required
              autoFocus
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              ��й�ȣ
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-control w-full"
              placeholder="��й�ȣ�� �Է��ϼ���"
              required
              disabled={loading}
            />
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <label htmlFor="displayName" className="block text-sm font-medium text-foreground">
                ǥ�� �̸� (���û���)
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="form-control w-full"
                placeholder="ǥ���� �̸��� �Է��ϼ���"
                disabled={loading}
              />
            </div>
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
            {loading ? (mode === "login" ? "�α��� ��..." : "���� ��...") : mode === "login" ? "�α���" : "ȸ������"}
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
            {mode === "login" ? "������ �����Ű���? ȸ������" : "�̹� ������ �����Ű���? �α���"}
          </button>

          <div className="space-y-1 text-foreground">
            <p>��й�ȣ�� ������? <span className="font-medium">KSM Support</span>���� �����ϼ���.</p>
            <p>
              Email: <a href="mailto:syyun@ksm.co.kr" className="text-accent hover:text-accent-strong">syyun@ksm.co.kr</a>
            </p>
            <p>Tel: 010-9718-0580</p>
          </div>

          <p className="pt-2 text-[11px] text-muted-strong">© 2025 KSM. All rights reserved.</p>
        </footer>
      </CardShell>\r\n      <BackgroundControls />\r\n    </div>
  );
}
