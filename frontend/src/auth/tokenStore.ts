// In-memory only — never localStorage/sessionStorage, so a stolen XSS payload
// can't read the access token. The refresh token lives in an httpOnly cookie
// the browser manages entirely; losing this on a page refresh is intentional
// and is why AuthProvider calls /auth/refresh once on mount.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
