import { useState } from "react";
import { Eye, EyeOff, Lock, CheckCircle2, XCircle } from "lucide-react";
import { changePassword } from "@lib/apiClient";
import type { ChangePasswordRequestPayload } from "@app-types/auth";

interface PasswordStrength {
  score: number; // 0-3
  label: "weak" | "medium" | "strong";
  color: string;
}

export function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 비밀번호 강도 계산 (참고용, 강제하지 않음)
  const calculatePasswordStrength = (password: string): PasswordStrength => {
    if (password.length < 4) {
      return { score: 0, label: "weak", color: "text-red-500" };
    }

    let score = 0;
    if (password.length >= 8) score += 1;

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password);

    const charVariety = [hasLower, hasUpper, hasDigit, hasSpecial].filter(Boolean).length;
    if (charVariety >= 2) score += 1;
    if (charVariety >= 3) score += 1;

    const labels: Array<"weak" | "medium" | "strong"> = ["weak", "medium", "medium", "strong"];
    const colors = ["text-red-500", "text-yellow-500", "text-yellow-500", "text-green-500"];

    return { score, label: labels[score], color: colors[score] };
  };

  const passwordStrength = calculatePasswordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canSubmit =
    currentPassword &&
    newPassword &&
    confirmPassword &&
    passwordsMatch &&
    !isSubmitting;

  const togglePasswordVisibility = (field: "current" | "new" | "confirm") => {
    setShowPasswords((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!canSubmit) return;

    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    try {
      const payload: ChangePasswordRequestPayload = {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      };

      const response = await changePassword(payload);

      setSuccess(true);
      setError(null);

      // 폼 초기화
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // 성공 메시지 표시 후 3초 뒤 숨기기
      setTimeout(() => setSuccess(false), 3000);

    } catch (err: unknown) {
      if (err && typeof err === "object" && "response" in err) {
        const axiosError = err as { response?: { data?: { detail?: string } } };
        setError(axiosError.response?.data?.detail || "비밀번호 변경에 실패했습니다.");
      } else {
        setError("비밀번호 변경 중 오류가 발생했습니다.");
      }
      setSuccess(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md frosted-panel p-8 rounded-xl shadow-2xl">
        <div className="text-center mb-8">
          <Lock className="w-12 h-12 mx-auto mb-4 text-accent-strong" />
          <h1 className="text-2xl font-bold text-foreground">비밀번호 변경</h1>
          <p className="text-sm text-muted mt-2">
            보안을 위해 정기적으로 비밀번호를 변경해주세요
          </p>
        </div>

        {success && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500 rounded-lg flex items-center gap-2 text-green-500">
            <CheckCircle2 size={20} />
            <span>비밀번호가 성공적으로 변경되었습니다!</span>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg flex items-center gap-2 text-red-500">
            <XCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 현재 비밀번호 */}
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground mb-2">
              현재 비밀번호 *
            </label>
            <div className="relative">
              <input
                id="currentPassword"
                type={showPasswords.current ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="현재 비밀번호 입력"
                className="input w-full pr-10"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("current")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                aria-label={showPasswords.current ? "비밀번호 숨기기" : "비밀번호 보이기"}
              >
                {showPasswords.current ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* 새 비밀번호 */}
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-foreground mb-2">
              새 비밀번호 *
            </label>
            <div className="relative">
              <input
                id="newPassword"
                type={showPasswords.new ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 입력"
                className="input w-full pr-10"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("new")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                aria-label={showPasswords.new ? "비밀번호 보이기" : "비밀번호 숨기기"}
              >
                {showPasswords.new ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* 비밀번호 강도 인디케이터 (참고용) */}
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted">비밀번호 강도 (참고용)</span>
                  <span className={`font-medium ${passwordStrength.color}`}>
                    {passwordStrength.label === "weak" && "약함"}
                    {passwordStrength.label === "medium" && "보통"}
                    {passwordStrength.label === "strong" && "강함"}
                  </span>
                </div>
                <div className="h-2 bg-surface-dim rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      passwordStrength.label === "weak"
                        ? "bg-red-500 w-1/3"
                        : passwordStrength.label === "medium"
                        ? "bg-yellow-500 w-2/3"
                        : "bg-green-500 w-full"
                    }`}
                  />
                </div>
                <p className="text-xs text-muted mt-1">
                  💡 8자 이상, 영문/숫자/특수문자 조합 권장
                </p>
              </div>
            )}
          </div>

          {/* 새 비밀번호 확인 */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground mb-2">
              새 비밀번호 확인 *
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showPasswords.confirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 다시 입력"
                className="input w-full pr-10"
                required
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("confirm")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                aria-label={showPasswords.confirm ? "비밀번호 숨기기" : "비밀번호 보이기"}
              >
                {showPasswords.confirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* 일치 여부 표시 */}
            {confirmPassword && (
              <div className="mt-2 text-sm flex items-center gap-2">
                {passwordsMatch ? (
                  <>
                    <CheckCircle2 size={16} className="text-green-500" />
                    <span className="text-green-500">비밀번호가 일치합니다</span>
                  </>
                ) : (
                  <>
                    <XCircle size={16} className="text-red-500" />
                    <span className="text-red-500">비밀번호가 일치하지 않습니다</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "변경 중..." : "비밀번호 변경"}
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn-secondary px-6"
            >
              취소
            </button>
          </div>
        </form>

        <div className="mt-6 text-center text-xs text-muted">
          <p>✅ 최소 1자 이상 입력하면 변경 가능합니다</p>
          <p className="mt-1">🔒 비밀번호는 암호화되어 안전하게 저장됩니다</p>
        </div>
      </div>
    </div>
  );
}
