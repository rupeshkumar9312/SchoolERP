import {
  clearTokens,
  getAccessToken,
  getStoredRefreshToken,
  persistTokens,
  updateAccessToken,
} from '../auth/tokenStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:4000/api';

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Set by AuthContext once, so client.ts can force a logout after a refresh
 * fails without importing AuthContext itself (which would be a cycle). */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

// Only login/refresh set this — every other request already has a token.
const MOBILE_CLIENT_HEADER = { 'X-Client': 'mobile' } as const;

interface RawTokens {
  accessToken: string;
  refreshToken?: string;
}

// Concurrent 401s during a token refresh must not each fire their own
// /auth/refresh call (that would race the rotation and strand the losers) —
// they all await this single in-flight promise instead.
let refreshInFlight: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const storedRefreshToken = await getStoredRefreshToken();
    if (!storedRefreshToken) throw new ApiError('No session to refresh', 401);

    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...MOBILE_CLIENT_HEADER },
      body: JSON.stringify({ refreshToken: storedRefreshToken }),
    });

    if (!res.ok) throw new ApiError('Session expired, please log in again', res.status);

    const body = (await res.json()) as RawTokens;
    if (body.refreshToken) {
      await persistTokens({ accessToken: body.accessToken, refreshToken: body.refreshToken });
    } else {
      await updateAccessToken(body.accessToken);
    }
    return body.accessToken;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

async function request<T>(path: string, init: RequestInit = {}, isRetry = false): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(`Could not reach the API at ${API_URL}. Is the backend running?`);
  }

  if (res.status === 401 && !isRetry && path !== '/auth/refresh' && path !== '/auth/login') {
    try {
      await refreshAccessToken();
    } catch {
      await clearTokens();
      onSessionExpired?.();
      throw new ApiError('Session expired, please log in again', 401);
    }
    return request<T>(path, init, true);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      (body as { message?: string } | null)?.message ?? `${init.method ?? 'GET'} ${path} failed with ${res.status}`;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

export interface PickedFile {
  uri: string;
  name: string;
  mimeType: string;
}

/** POSTs a file picked via expo-document-picker as multipart/form-data.
 * React Native's fetch accepts a FormData entry shaped like { uri, name, type }
 * in place of a Blob — there's no File/Blob for a picked document on native. */
async function requestUpload<T>(path: string, fieldName: string, file: PickedFile, isRetry = false): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const body = new FormData();
  body.append(fieldName, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body });
  } catch {
    throw new ApiError(`Could not reach the API at ${API_URL}. Is the backend running?`);
  }

  if (res.status === 401 && !isRetry) {
    try {
      await refreshAccessToken();
    } catch {
      await clearTokens();
      onSessionExpired?.();
      throw new ApiError('Session expired, please log in again', 401);
    }
    return requestUpload<T>(path, fieldName, file, true);
  }

  if (!res.ok) {
    const responseBody = await res.json().catch(() => null);
    const message =
      (responseBody as { message?: string } | null)?.message ?? `POST ${path} failed with ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return (await res.json()) as T;
}

export function apiUpload<T>(path: string, fieldName: string, file: PickedFile): Promise<T> {
  return requestUpload<T>(path, fieldName, file);
}

/** Login is the one endpoint outside request()'s retry loop — it must send
 * the mobile header so the backend hands back a refreshToken in the body. */
export async function apiLogin<T>(email: string, password: string): Promise<T> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...MOBILE_CLIENT_HEADER },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = (body as { message?: string } | null)?.message ?? `Login failed with ${res.status}`;
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

/** Downloads a binary attachment to local storage using the caller's own
 * auth — expo-file-system needs a plain URL+headers pair, not fetch(). */
export function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export { API_URL };
