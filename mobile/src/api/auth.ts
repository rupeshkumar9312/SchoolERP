import { apiGet, apiLogin, apiPost } from './client';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: { id: number; name: string };
  permissions: string[];
  mustChangePassword: boolean;
  student?: {
    id: number;
    admissionNo: string;
    class: { id: number; name: string };
    section: { id: number; name: string };
  };
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return apiLogin<LoginResponse>(email, password);
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

export function changePassword(payload: ChangePasswordPayload): Promise<{ user: AuthUser }> {
  return apiPost<{ user: AuthUser }>('/auth/change-password', payload);
}
