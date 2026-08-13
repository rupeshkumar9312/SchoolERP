import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'edvance_access_token';
const REFRESH_TOKEN_KEY = 'edvance_refresh_token';

// The access token also lives in memory so synchronous reads (every API call)
// don't have to await SecureStore on the hot path. It's re-hydrated from
// SecureStore once at app startup.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export async function loadStoredTokens(): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  const [storedAccess, storedRefresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  accessToken = storedAccess;
  return { accessToken: storedAccess, refreshToken: storedRefresh };
}

export async function persistTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
  accessToken = tokens.accessToken;
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function updateAccessToken(token: string): Promise<void> {
  accessToken = token;
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}
