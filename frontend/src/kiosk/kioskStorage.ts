import type { KioskSession, ScanDirection } from '../api/teacherQr';

const KEY = 'edvance.kiosk.session';
const MODE_KEY = 'edvance.kiosk.mode';

function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

/** A manual check-in/out toggle only sticks for the rest of the local day —
 * next morning the kiosk falls back to the auto schedule. */
export function loadKioskModeOverride(): ScanDirection | null {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { mode?: ScanDirection; day?: string };
    if (parsed.day !== localDay()) return null;
    return parsed.mode === 'out' || parsed.mode === 'in' ? parsed.mode : null;
  } catch {
    return null;
  }
}

export function saveKioskModeOverride(mode: ScanDirection): void {
  try {
    localStorage.setItem(MODE_KEY, JSON.stringify({ mode, day: localDay() }));
  } catch {
    /* storage disabled — the toggle still works for this page load */
  }
}

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
