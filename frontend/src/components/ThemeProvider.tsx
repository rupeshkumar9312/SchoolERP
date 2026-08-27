import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, type Theme } from './themeContext';

const STORAGE_KEY = 'edvance-theme';

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function readStoredTheme(): Theme | null {
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' ? stored : null;
}

/** Light/dark switching for the whole app — index.css's tokens already
 * follow `prefers-color-scheme` on their own; this only takes over once
 * the user makes an explicit choice (an `[data-theme]` attribute on
 * `<html>`, which index.css's rules give priority over the OS setting).
 * Until then nothing changes — same OS-following behavior as before this
 * existed, and the topbar toggle still shows the currently-effective mode. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light'));
  const [explicit, setExplicit] = useState<boolean>(() => readStoredTheme() !== null);

  useEffect(() => {
    const root = document.documentElement;
    if (explicit) {
      root.setAttribute('data-theme', theme);
    } else {
      root.removeAttribute('data-theme');
    }
  }, [theme, explicit]);

  // No explicit choice made yet — keep following the OS setting live, same
  // as a plain `prefers-color-scheme` media query would.
  useEffect(() => {
    if (explicit) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setTheme(mql.matches ? 'dark' : 'light');
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [explicit]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
    setExplicit(true);
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
