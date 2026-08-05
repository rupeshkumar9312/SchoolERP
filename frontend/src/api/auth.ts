import { apiGet, apiPost } from './client';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: { id: number; name: string };
  permissions: string[];
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
