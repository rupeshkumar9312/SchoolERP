import { API_URL, ApiError, apiGet, apiPatch, apiPost } from './client';

export interface KioskSession {
  /** Long-lived (hours) display-session token. Store it on the kiosk device. */
  token: string;
  sid: string;
  /** Human-readable lifetime, e.g. "12h". */
  expiresIn: string;
}

export type ScanDirection = 'in' | 'out';

export interface CurrentQr {
  /** The compact JWT to render as a QR code. */
  token: string;
  /** Which QR this is — check-in or check-out. */
  dir: ScanDirection;
  issuedAt: string;
  expiresAt: string;
  ttlSec: number;
  /** How soon the kiosk should re-pull. Always < ttlSec so codes overlap. */
  rotateSec: number;
  /** Server clock at issue time — lets the kiosk run a countdown without
   * trusting its own (possibly wrong) clock. */
  serverTime: string;
  /** Whether the check-out QR is available at all. */
  checkoutEnabled: boolean;
  /** "HH:mm" local — auto-switch the kiosk to check-out at/after this time. */
  checkoutAutoSwitchAt: string | null;
}

/** Admin-only. Mints a session for whichever device is calling. */
export function provisionKioskSession(): Promise<KioskSession> {
  return apiPost<KioskSession>('/attendance/teacher-qr/kiosk-session');
}

export interface GeofenceConfig {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  /** Accepted distance from the campus centre, in metres. */
  radiusM: number;
  /** Worst GPS accuracy radius a scan may report and still be trusted, in metres. */
  maxAccuracyM: number;
  /** Master switch for the second (check-out) QR. */
  checkoutEnabled: boolean;
  /** "HH:mm" local — kiosk auto-switches to check-out at/after this; null = manual only. */
  checkoutAutoSwitchAt: string | null;
  /** Reject a check-out scanned sooner than this many minutes after check-in. */
  minSessionMinutes: number;
  /** When false a check-out with no check-in that day is rejected. */
  allowCheckoutWithoutCheckin: boolean;
  updatedAt: string | null;
}

export type GeofenceConfigInput = Pick<
  GeofenceConfig,
  | 'enabled'
  | 'latitude'
  | 'longitude'
  | 'radiusM'
  | 'maxAccuracyM'
  | 'checkoutEnabled'
  | 'checkoutAutoSwitchAt'
  | 'minSessionMinutes'
  | 'allowCheckoutWithoutCheckin'
>;

/** Admin-only. Reads the DB-stored QR check-in geofence. */
export function getGeofenceConfig(): Promise<GeofenceConfig> {
  return apiGet<GeofenceConfig>('/attendance/teacher-qr/geofence');
}

/** Admin-only. Full replace of the geofence config. */
export function updateGeofenceConfig(input: GeofenceConfigInput): Promise<GeofenceConfig> {
  return apiPatch<GeofenceConfig>('/attendance/teacher-qr/geofence', input);
}

/**
 * Pulls the QR the kiosk should be showing right now. Authenticated with the
 * kiosk session token, never a user token — so this deliberately bypasses the
 * shared api client (which injects the logged-in user's access token).
 */
export async function fetchCurrentQr(
  kioskToken: string,
  mode: ScanDirection = 'in',
): Promise<CurrentQr> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/attendance/teacher-qr/current?mode=${mode}`, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${kioskToken}` },
    });
  } catch {
    throw new ApiError(`Could not reach the API at ${API_URL}.`);
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? `Fetching the current QR failed with ${res.status}`, res.status);
  }
  return (await res.json()) as CurrentQr;
}
