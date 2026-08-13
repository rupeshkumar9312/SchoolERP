import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth';
import { ApiError, setSessionExpiredHandler } from '../api/client';
import { clearTokens, loadStoredTokens, persistTokens } from './tokenStore';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: authApi.AuthUser | null;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (payload: authApi.ChangePasswordPayload) => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<authApi.AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setStatus('unauthenticated');
    });
  }, []);

  useEffect(() => {
    (async () => {
      const { refreshToken } = await loadStoredTokens();
      if (!refreshToken) {
        setStatus('unauthenticated');
        return;
      }
      try {
        // request() transparently refreshes the access token via the stored
        // refresh token if it's expired — no separate "am I still logged in"
        // check needed beyond this one call.
        const me = await authApi.me();
        setUser(me);
        setStatus('authenticated');
      } catch {
        await clearTokens();
        setStatus('unauthenticated');
      }
    })();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    try {
      const { accessToken, refreshToken, user: loggedInUser } = await authApi.login(email, password);
      await persistTokens({ accessToken, refreshToken });
      setUser(loggedInUser);
      setStatus('authenticated');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed');
      throw err;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Already unauthenticated locally either way.
    }
    await clearTokens();
    setUser(null);
    setStatus('unauthenticated');
  };

  const changePassword = async (payload: authApi.ChangePasswordPayload) => {
    setError(null);
    try {
      const { user: updated } = await authApi.changePassword(payload);
      setUser(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change password');
      throw err;
    }
  };

  const value = useMemo(
    () => ({ status, user, error, login, logout, changePassword, clearError: () => setError(null) }),
    [status, user, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
