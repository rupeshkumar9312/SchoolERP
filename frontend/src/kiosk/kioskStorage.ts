import type { KioskSession } from '../api/teacherQr';

const KEY = 'edvance.kiosk.session';

export interface StoredKioskSession extends KioskSession {
  /** ISO timestamp this device was provisioned — shown in the footer. */
  provisionedAt: string;
}

export function loadKioskSession(): StoredKioskSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredKioskSession>;
    if (!parsed.token || !parsed.sid) return null;
    return {
      token: parsed.token,
      sid: parsed.sid,
      expiresIn: parsed.expiresIn ?? '',
      provisionedAt: parsed.provisionedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveKioskSession(session: KioskSession): StoredKioskSession {
  const stored: StoredKioskSession = { ...session, provisionedAt: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Private-mode / storage-disabled: the session still works for this page
    // load, it just won't survive a refresh.
  }
  return stored;
}

export function clearKioskSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
