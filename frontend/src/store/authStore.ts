import type { LoginRequestPayload, RegisterRequestPayload, RegisterResponsePayload, UserSession, UserStatus, UserStatusResponsePayload } from "@app-types/auth";
import { approveUserAccount, fetchCurrentUser, loginUser, logoutUser, registerUser, rejectUserAccount } from "@lib/apiClient";
import axios from "axios";
import { create } from "zustand";

const toSessionFromLogin = (payload: { username: string; display_name?: string | null; status: UserStatus; is_admin: boolean; issued_at: string; expires_at: string }): UserSession => ({
  username: payload.username,
  displayName: payload.display_name ?? undefined,
  status: payload.status,
  isAdmin: payload.is_admin,
  issuedAt: payload.issued_at,
  expiresAt: payload.expires_at,
});

const resolveErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return (error.response?.data as { detail?: string })?.detail ?? error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "알 수 없는 오류가 발생했습니다";
};

interface AuthStoreState {
  user: UserSession | null;
  loading: boolean;
  error?: string;
  register: (payload: RegisterRequestPayload) => Promise<RegisterResponsePayload>;
  login: (payload: LoginRequestPayload) => Promise<UserSession>;
  logout: () => Promise<void>;
  refresh: () => Promise<UserSession | null>;
  approveUser: (params: { username: string; makeAdmin?: boolean }) => Promise<UserStatusResponsePayload>;
  rejectUser: (params: { username: string; reason?: string | null }) => Promise<UserStatusResponsePayload>;
  clearError: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  loading: false,
  error: undefined,
  async register(payload) {
    set({ loading: true, error: undefined });
    try {
      const response = await registerUser(payload);
      set({ loading: false });
      return response;
    } catch (error) {
      const message = resolveErrorMessage(error);
      set({ loading: false, error: message });
      throw error;
    }
  },
  async login(payload) {
    set({ loading: true, error: undefined });
    try {
      const response = await loginUser(payload);
      const session = toSessionFromLogin(response);
      set({ user: session, loading: false });
      return session;
    } catch (error) {
      const message = resolveErrorMessage(error);
      set({ loading: false, error: message });
      throw error;
    }
  },
  async logout() {
    try {
      await logoutUser();
    } finally {
      set({ user: null });
    }
  },
  async refresh() {
    set({ loading: true, error: undefined });
    try {
      const session = await fetchCurrentUser();
      set({ user: session, loading: false });
      return session;
    } catch (error) {
      const message = resolveErrorMessage(error);
      set({ loading: false, error: message });
      throw error;
    }
  },
  async approveUser(params) {
    const response = await approveUserAccount(params);
    return response;
  },
  async rejectUser(params) {
    const response = await rejectUserAccount(params);
    return response;
  },
  clearError() {
    set({ error: undefined });
  },
}));
