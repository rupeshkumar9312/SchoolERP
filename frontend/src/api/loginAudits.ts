import { apiGet } from './client';
import { appendPageParams, type PageParams, type Paginated } from './pagination';

export type LoginEvent = 'LOGIN' | 'REFRESH' | 'LOGIN_FAILED';
export type LoginPlatform = 'WEB' | 'MOBILE';

export interface LoginAuditEntry {
  id: number;
  event: LoginEvent;
  platform: LoginPlatform;
  identifier: string;
  user: { id: number; name: string } | null;
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface LoginAuditFilters extends PageParams {
  userId?: number;
  event?: LoginEvent;
  platform?: LoginPlatform;
  from?: string;
  to?: string;
}

export function listLoginAudits(filters: LoginAuditFilters = {}): Promise<Paginated<LoginAuditEntry>> {
  const params = new URLSearchParams();
  if (filters.userId) params.set('userId', String(filters.userId));
  if (filters.event) params.set('event', filters.event);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  appendPageParams(params, filters);
  const query = params.toString();
  return apiGet<Paginated<LoginAuditEntry>>(`/audit-logins${query ? `?${query}` : ''}`);
}
