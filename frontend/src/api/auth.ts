import { apiGet, apiPost } from './client';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: { id: number; name: string };
  permissions: string[];
  /** True until this user sets their own password — the frontend forces a
   * change-password screen while this is true, regardless of role. */
  mustChangePassword: boolean;
  /** Only present when role.name === 'STUDENT'. */
  student?: {
    id: number;
    admissionNo: string;
    class: { id: number; name: string };
    section: { id: number; name: string };
  };
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/login', { email, password });
}

export function refresh(): Promise<LoginResponse> {
  return apiPost<LoginResponse>('/auth/refresh');
}

export function logout(): Promise<void> {
  return apiPost<void>('/auth/logout');
}

export function me(): Promise<AuthUser> {
  return apiGet<AuthUser>('/auth/me');
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/** Serves both the forced first-login change and a later voluntary change
 * from Settings — only the caller's UI messaging differs. */
export function changePassword(payload: ChangePasswordPayload): Promise<{ user: AuthUser }> {
  return apiPost<{ user: AuthUser }>('/auth/change-password', payload);
}
