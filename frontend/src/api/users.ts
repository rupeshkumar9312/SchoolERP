import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import { appendPageParams, type PageParams, type Paginated } from './pagination';

export interface UserListItem {
  id: number;
  email: string;
  edvanceId: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  role: { id: number; name: string };
  createdAt: string;
}

/** Shown once, in the create response only — never retrievable again.
 * `alias` is the short form of `email` (e.g. 'adm001') — both work at login. */
export interface UserCreateResult extends UserListItem {
  login: { email: string; alias: string; temporaryPassword: string };
}

/** No email/password — both are auto-generated server-side. */
export interface CreateUserPayload {
  name: string;
  phone?: string;
  roleId: number;
}

export interface UpdateUserPayload {
  name?: string;
  phone?: string;
  roleId?: number;
  isActive?: boolean;
}

export interface UserFilters extends PageParams {
  roleId?: number;
  search?: string;
}

export function listUsers(filters: UserFilters = {}): Promise<Paginated<UserListItem>> {
  const params = new URLSearchParams();
  if (filters.roleId) params.set('roleId', String(filters.roleId));
  if (filters.search) params.set('search', filters.search);
  appendPageParams(params, filters);
  const query = params.toString();
  return apiGet<Paginated<UserListItem>>(`/users${query ? `?${query}` : ''}`);
}

export function getUser(id: number): Promise<UserListItem> {
  return apiGet<UserListItem>(`/users/${id}`);
}

export function createUser(payload: CreateUserPayload): Promise<UserCreateResult> {
  return apiPost<UserCreateResult>('/users', payload);
}

export function updateUser(id: number, payload: UpdateUserPayload): Promise<UserListItem> {
  return apiPatch<UserListItem>(`/users/${id}`, payload);
}

export function deleteUser(id: number): Promise<void> {
  return apiDelete<void>(`/users/${id}`);
}

/** SUPER_ADMIN only — generates a fresh temp password for this user (returned
 * once) and forces them to change it on next login. */
export function resetUserPassword(id: number): Promise<{ temporaryPassword: string }> {
  return apiPost<{ temporaryPassword: string }>(`/users/${id}/reset-password`);
}
