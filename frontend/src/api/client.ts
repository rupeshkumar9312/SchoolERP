import { getAccessToken } from '../auth/tokenStore';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' });
  } catch {
    throw new ApiError(`Could not reach the API at ${API_URL}. Is the backend running?`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = (body as { message?: string } | null)?.message ?? `${init.method ?? 'GET'} ${path} failed with ${res.status}`;
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

/** POST a File as multipart/form-data — the browser sets its own Content-Type boundary, so we must not force JSON. */
export async function apiUpload<T>(path: string, fieldName: string, file: File): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const body = new FormData();
  body.append(fieldName, file);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body, credentials: 'include' });
  } catch {
    throw new ApiError(`Could not reach the API at ${API_URL}. Is the backend running?`);
  }

  if (!res.ok) {
    const responseBody = await res.json().catch(() => null);
    const message =
      (responseBody as { message?: string } | null)?.message ?? `POST ${path} failed with ${res.status}`;
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** GET a binary file (e.g. an .xlsx download) as a Blob, bypassing the JSON parsing in request(). */
export async function apiGetBlob(path: string): Promise<Blob> {
  const token = getAccessToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers, credentials: 'include' });
  } catch {
    throw new ApiError(`Could not reach the API at ${API_URL}. Is the backend running?`);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = (body as { message?: string } | null)?.message ?? `GET ${path} failed with ${res.status}`;
    throw new ApiError(message, res.status);
  }

  return res.blob();
}

export { API_URL };
