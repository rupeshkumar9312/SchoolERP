import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export interface UserListItem {
  id: number;
  email: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  role: { id: number; name: string };
  createdAt: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  roleId: number;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  phone?: string;
  roleId?: number;
  isActive?: boolean;
}

export function listUsers(roleId?: number): Promise<UserListItem[]> {
  const query = roleId ? `?roleId=${roleId}` : '';
  return apiGet<UserListItem[]>(`/users${query}`);
}

export function getUser(id: number): Promise<UserListItem> {
  return apiGet<UserListItem>(`/users/${id}`);
}

export function createUser(payload: CreateUserPayload): Promise<UserListItem> {
  return apiPost<UserListItem>('/users', payload);
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
