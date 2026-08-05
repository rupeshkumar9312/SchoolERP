import { apiGet } from './client';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  uptime: number;
  timestamp: string;
  dependencies: {
    database: { status: 'up' | 'down'; error?: string };
  };
}

export function fetchHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/health');
}
