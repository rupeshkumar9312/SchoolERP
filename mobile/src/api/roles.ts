import { apiGet } from './client';

export interface Role {
  id: number;
  name: string;
}

export function listRoles(): Promise<Role[]> {
  return apiGet<Role[]>('/roles');
}
