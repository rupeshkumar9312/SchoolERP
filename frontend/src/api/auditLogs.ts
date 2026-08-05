import { apiGet } from './client';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface AuditLogEntry {
  id: number;
  entityType: string;
  entityId: number;
  action: AuditAction;
  actor: { id: number; name: string } | null;
  oldValues: unknown;
  newValues: unknown;
  createdAt: string;
}

export interface AuditLogFilters {
  entityType?: string;
  userId?: number;
  from?: string;
  to?: string;
}

export function listAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.userId) params.set('userId', String(filters.userId));
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const query = params.toString();
  return apiGet<AuditLogEntry[]>(`/audit-logs${query ? `?${query}` : ''}`);
}
