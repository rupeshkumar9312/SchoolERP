import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import { AuthContext, type AuthState } from './context';
import { setAccessToken } from './tokenStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    // A page load has no access token in memory — try the refresh cookie
    // before deciding the user is logged out.
    authApi
      .refresh()
      .then(({ accessToken, user }) => {
        setAccessToken(accessToken);
        setState({ status: 'authenticated', user });
      })
      .catch(() => {
        setAccessToken(null);
        setState({ status: 'unauthenticated' });
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken, user } = await authApi.login(email, password);
    setAccessToken(accessToken);
    setState({ status: 'authenticated', user });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setAccessToken(null);
      setState({ status: 'unauthenticated' });
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string) => state.status === 'authenticated' && state.user.permissions.includes(permission),
    [state],
  );

  const value = useMemo(() => ({ state, login, logout, hasPermission }), [state, login, logout, hasPermission]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
