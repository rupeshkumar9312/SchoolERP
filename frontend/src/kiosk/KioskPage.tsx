import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ApiError } from '../api/client';
import {
  fetchCurrentQr,
  provisionKioskSession,
  type CurrentQr,
  type ScanDirection,
} from '../api/teacherQr';
import { useAuth } from '../auth/useAuth';
import {
  clearKioskSession,
  loadKioskModeOverride,
  loadKioskSession,
  saveKioskModeOverride,
  saveKioskSession,
  type StoredKioskSession,
} from './kioskStorage';
import './Kiosk.css';

const MANAGE_PERMISSION = 'attendance.teacher.qr.manage';
const DAILY_RELOAD_MS = 24 * 60 * 60 * 1000;
const OFFLINE_RETRY_MS = 4000;

export function KioskPage() {
  const [session, setSession] = useState<StoredKioskSession | null>(() => loadKioskSession());

  useEffect(() => {
    document.body.classList.add('kiosk-body');
    return () => document.body.classList.remove('kiosk-body');
  }, []);

  if (!session) {
    return <KioskSetup onProvisioned={setSession} />;
  }
  return (
    <KioskDisplay
      session={session}
      onInvalidSession={() => {
        clearKioskSession();
        setSession(null);
      }}
    />
  );
}

function KioskSetup({ onProvisioned }: { onProvisioned: (s: StoredKioskSession) => void }) {
  const { state, hasPermission } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provision = async () => {
    setBusy(true);
    setError(null);
    try {
      const stored = saveKioskSession(await provisionKioskSession());
      onProvisioned(stored);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not provision this device.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kiosk-screen kiosk-screen--setup">
      <div className="kiosk-setup-card">
        <p className="kiosk-wordmark">EDVANCE</p>
        <h1>Attendance kiosk</h1>

        {state.status === 'loading' && <p className="kiosk-muted">Checking your session…</p>}

        {state.status !== 'loading' && !hasPermission(MANAGE_PERMISSION) && (
          <>
            <p className="kiosk-muted">
              This device isn&rsquo;t set up yet. Open this page while signed in as an
              administrator to turn it into a check-in display.
            </p>
            <Link className="kiosk-btn kiosk-btn--ghost" to="/login">
              Sign in
            </Link>
          </>
        )}

        {state.status !== 'loading' && hasPermission(MANAGE_PERMISSION) && (
          <>
            <p className="kiosk-muted">
              Provision this screen once. It will then show a rotating QR that teachers
              scan to check in &mdash; no sign-in needed on this device afterwards.
            </p>
            <button className="kiosk-btn" onClick={provision} disabled={busy}>
              {busy ? 'Provisioning…' : 'Provision this device'}
            </button>
            {error && <p className="kiosk-error">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}

interface Snapshot {
  qr: CurrentQr;
  receivedAt: number;
}

/** 'out' when the local wall-clock has reached HH:mm, else 'in'. */
function autoModeFor(hhmm: string): ScanDirection {
  const [h, m] = hhmm.split(':').map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() >= h * 60 + m ? 'out' : 'in';
}

function KioskDisplay({
  session,
  onInvalidSession,
}: {
  session: StoredKioskSession;
  onInvalidSession: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [now, setNow] = useState(() => Date.now());
  const [qrSize, setQrSize] = useState(() => computeQrSize());
  const [mode, setMode] = useState<ScanDirection>(() => loadKioskModeOverride() ?? 'in');

  const pullTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const invalidRef = useRef(onInvalidSession);
  invalidRef.current = onInvalidSession;
  // Once an operator toggles, stop honouring the auto-switch schedule for today.
  const manualOverrideRef = useRef(loadKioskModeOverride() !== null);

  const schedulePull = useCallback((delayMs: number, run: () => void) => {
    if (pullTimer.current) clearTimeout(pullTimer.current);
    pullTimer.current = setTimeout(run, delayMs);
  }, []);

  const chooseMode = (m: ScanDirection) => {
    manualOverrideRef.current = true;
    saveKioskModeOverride(m);
    setMode(m);
  };

  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const qr = await fetchCurrentQr(session.token, mode);
        if (cancelled) return;

        // Follow the auto-switch schedule until an operator overrides it.
        if (!manualOverrideRef.current && qr.checkoutEnabled && qr.checkoutAutoSwitchAt) {
          const auto = autoModeFor(qr.checkoutAutoSwitchAt);
          if (auto !== mode) {
            setMode(auto); // re-runs this effect, which re-pulls in the new mode
            return;
          }
        }

        setSnapshot({ qr, receivedAt: Date.now() });
        setConnection('live');
        schedulePull(Math.max(1000, qr.rotateSec * 1000), pull);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          invalidRef.current();
          return;
        }
        setConnection('offline');
        schedulePull(OFFLINE_RETRY_MS, pull);
      }
    };

    void pull();
    return () => {
      cancelled = true;
      if (pullTimer.current) clearTimeout(pullTimer.current);
    };
  }, [session.token, mode, schedulePull]);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const id = setInterval(() => setNow(Date.now()), reduced ? 1000 : 200);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => window.location.reload(), DAILY_RELOAD_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    const onResize = () => setQrSize(computeQrSize());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const remainingMs = useMemo(() => {
    if (!snapshot) return 0;
    const { qr, receivedAt } = snapshot;
    const serverRemaining = new Date(qr.expiresAt).getTime() - new Date(qr.serverTime).getTime();
    return Math.max(0, serverRemaining - (now - receivedAt));
  }, [snapshot, now]);

  const fraction = snapshot ? Math.min(1, remainingMs / (snapshot.qr.ttlSec * 1000)) : 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const isOut = mode === 'out';
  const showToggle = snapshot?.qr.checkoutEnabled ?? false;

  return (
    <div className={`kiosk-screen${isOut ? ' kiosk-screen--out' : ''}`}>
      <header className="kiosk-head">
        <p className="kiosk-wordmark">EDVANCE</p>
        <p className="kiosk-head-title">{isOut ? 'Staff check-out' : 'Staff check-in'}</p>
        {showToggle && (
          <div className="kiosk-modeswitch" role="group" aria-label="Kiosk mode">
            <button
              className={`kiosk-modeswitch-btn${!isOut ? ' is-on' : ''}`}
              onClick={() => chooseMode('in')}
            >
              Check in
            </button>
            <button
              className={`kiosk-modeswitch-btn${isOut ? ' is-on' : ''}`}
              onClick={() => chooseMode('out')}
            >
              Check out
            </button>
          </div>
        )}
      </header>

      <main className="kiosk-stage">
        <div className={`kiosk-qr-card${connection === 'offline' ? ' is-stale' : ''}`}>
          {snapshot ? (
            <QRCodeSVG
              value={snapshot.qr.token}
              size={qrSize}
              level="M"
              marginSize={2}
              bgColor="#ffffff"
              fgColor="#0a0e1a"
            />
          ) : (
            <div className="kiosk-qr-placeholder" style={{ width: qrSize, height: qrSize }}>
              {connection === 'offline' ? 'Reconnecting…' : 'Starting…'}
            </div>
          )}

          <CountdownRing fraction={fraction} seconds={seconds} active={connection === 'live'} />
        </div>

        <p className="kiosk-caption">
          Scan with the <strong>EDVANCE app</strong> to {isOut ? 'check out' : 'mark your attendance'}
        </p>

        {connection === 'offline' && (
          <p className="kiosk-status kiosk-status--offline">
            Display offline &mdash; the code on screen may be stale. Check the network.
          </p>
        )}
      </main>

      <footer className="kiosk-foot">
        <span>
          Device {session.sid.slice(0, 8)} &middot; set up{' '}
          {new Date(session.provisionedAt).toLocaleDateString()}
        </span>
        <button
          className="kiosk-reset"
          onClick={() => {
            if (window.confirm('Reset this device? It will need to be provisioned again.')) {
              invalidRef.current();
            }
          }}
        >
          Reset device
        </button>
      </footer>
    </div>
  );
}

function CountdownRing({
  fraction,
  seconds,
  active,
}: {
  fraction: number;
  seconds: number;
  active: boolean;
}) {
  const R = 34;
  const C = 2 * Math.PI * R;
  return (
    <div className={`kiosk-ring${active ? '' : ' is-idle'}`} aria-hidden="true">
      <svg viewBox="0 0 80 80">
        <circle className="kiosk-ring-track" cx="40" cy="40" r={R} />
        <circle
          className="kiosk-ring-value"
          cx="40"
          cy="40"
          r={R}
          style={{ strokeDasharray: C, strokeDashoffset: C * (1 - fraction) }}
        />
      </svg>
      <span className="kiosk-ring-num">{active ? seconds : '–'}</span>
    </div>
  );
}

function computeQrSize(): number {
  const basis = Math.min(window.innerWidth, window.innerHeight);
  return Math.round(Math.max(220, Math.min(520, basis * 0.42)));
}
