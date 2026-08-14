import { apiDelete, apiPost } from './client';

export function registerPushToken(token: string): Promise<void> {
  return apiPost<void>('/push-tokens', { token });
}

export function unregisterPushToken(token: string): Promise<void> {
  return apiDelete<void>('/push-tokens', { token });
}
