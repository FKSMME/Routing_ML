export type UserStatus = "pending" | "approved" | "rejected";

export interface RegisterRequestPayload {
  username: string;
  password: string;
  displayName?: string | null;
  fullName?: string | null;
  email?: string | null;
}

export interface RegisterResponsePayload {
  username: string;
  status: UserStatus;
  is_admin: boolean;
  message: string;
}

export interface LoginRequestPayload {
  username: string;
  password: string;
}

export interface LoginResponsePayload {
  username: string;
  display_name?: string | null;
  status: UserStatus;
  is_admin: boolean;
  token: string;
  issued_at: string;
  expires_at: string;
}

export interface UserStatusResponsePayload {
  username: string;
  display_name?: string | null;
  status: UserStatus;
  is_admin: boolean;
}

export interface UserSession {
  username: string;
  displayName?: string | null;
  status: UserStatus;
  isAdmin: boolean;
  issuedAt: string;
  expiresAt: string;
}

export interface AuthenticatedUserPayload extends UserStatusResponsePayload {
  issued_at: string;
  expires_at: string;
  session_id?: string | null;
  client_host?: string | null;
}
