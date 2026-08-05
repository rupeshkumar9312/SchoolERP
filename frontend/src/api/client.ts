const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  let res: Response;

  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
  } catch {
    throw new ApiError(`Could not reach the API at ${API_URL}. Is the backend running?`);
  }

  if (!res.ok) {
    throw new ApiError(`GET ${path} failed with ${res.status}`, res.status);
  }

  return (await res.json()) as T;
}

export { API_URL };
