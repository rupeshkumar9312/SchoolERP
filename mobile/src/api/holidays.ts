import { apiDelete, apiGet, apiPost } from './client';

export interface Holiday {
  id: number;
  date: string;
  name: string;
  createdAt: string;
}

export function listHolidays(from?: string, to?: string): Promise<Holiday[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return apiGet<Holiday[]>(`/holidays${query ? `?${query}` : ''}`);
}

export function createHoliday(date: string, name: string): Promise<Holiday> {
  return apiPost<Holiday>('/holidays', { date, name });
}

export function deleteHoliday(id: number): Promise<void> {
  return apiDelete<void>(`/holidays/${id}`);
}
