import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { getGeofenceConfig, updateGeofenceConfig } from '../api/teacherQr';
import { useToast } from '../components/useToast';
import { Skeleton } from '../components/Skeleton';

interface FormState {
  enabled: boolean;
  latitude: string;
  longitude: string;
  radiusM: string;
  maxAccuracyM: string;
  checkoutEnabled: boolean;
  checkoutAutoSwitchAt: string;
  minSessionMinutes: string;
  allowCheckoutWithoutCheckin: boolean;
}

const EMPTY: FormState = {
  enabled: false,
  latitude: '',
  longitude: '',
  radiusM: '150',
  maxAccuracyM: '75',
  checkoutEnabled: false,
  checkoutAutoSwitchAt: '',
  minSessionMinutes: '30',
  allowCheckoutWithoutCheckin: false,
};

export function GeofenceSettingsPage() {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = await getGeofenceConfig();
      setForm({
        enabled: cfg.enabled,
        latitude: cfg.latitude?.toString() ?? '',
        longitude: cfg.longitude?.toString() ?? '',
        radiusM: cfg.radiusM.toString(),
        maxAccuracyM: cfg.maxAccuracyM.toString(),
        checkoutEnabled: cfg.checkoutEnabled,
        checkoutAutoSwitchAt: cfg.checkoutAutoSwitchAt ?? '',
        minSessionMinutes: cfg.minSessionMinutes.toString(),
        allowCheckoutWithoutCheckin: cfg.allowCheckoutWithoutCheckin,
      });
      setUpdatedAt(cfg.updatedAt);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load the geofence settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const hasCoords = form.latitude.trim() !== '' && form.longitude.trim() !== '';

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      toast('This browser has no location support.', 'error');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        set('latitude', pos.coords.latitude.toFixed(6));
        set('longitude', pos.coords.longitude.toFixed(6));
        setLocating(false);
        toast('Filled in this device’s current location.');
      },
      (err) => {
        setLocating(false);
        toast(err.message || 'Could not read this device’s location.', 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await updateGeofenceConfig({
        enabled: form.enabled,
        latitude: hasCoords ? Number(form.latitude) : null,
        longitude: hasCoords ? Number(form.longitude) : null,
        radiusM: Number(form.radiusM),
        maxAccuracyM: Number(form.maxAccuracyM),
        checkoutEnabled: form.checkoutEnabled,
        checkoutAutoSwitchAt: form.checkoutAutoSwitchAt.trim() || null,
        minSessionMinutes: Number(form.minSessionMinutes),
        allowCheckoutWithoutCheckin: form.allowCheckoutWithoutCheckin,
      });
      setUpdatedAt(saved.updatedAt);
      setForm((prev) => ({ ...prev, enabled: saved.enabled, checkoutEnabled: saved.checkoutEnabled }));
      toast('Settings saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save the geofence settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1>QR check-in settings</h1>
      <p className="subtitle">
        The campus geofence for the QR scan, and the optional check-out QR. Enforcement is
        server-side.
      </p>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <section className="card">
          <Skeleton height="1.1rem" className="skeleton-block" />
          <Skeleton height="1.1rem" className="skeleton-block" />
          <Skeleton height="1.1rem" className="skeleton-block" />
        </section>
      ) : (
        <form className="card" onSubmit={onSubmit}>
          <label className="field field-checkbox">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
            />
            <span>Require teachers to be on campus to check in</span>
          </label>
          {form.enabled && !hasCoords && (
            <p className="muted">Set the campus latitude and longitude before enabling.</p>
          )}

          <label className="field">
            <span>Campus latitude</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.latitude}
              onChange={(e) => set('latitude', e.target.value)}
              placeholder="e.g. 12.971600"
            />
          </label>
          <label className="field">
            <span>Campus longitude</span>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              value={form.longitude}
              onChange={(e) => set('longitude', e.target.value)}
              placeholder="e.g. 77.594600"
            />
          </label>

          <div className="form-actions">
            <button type="button" className="secondary" onClick={useCurrentLocation} disabled={locating}>
              {locating ? 'Reading location…' : 'Use this device’s location'}
            </button>
          </div>

          <label className="field">
            <span>Radius (metres)</span>
            <input
              type="number"
              min={10}
              max={5000}
              value={form.radiusM}
              onChange={(e) => set('radiusM', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Max GPS accuracy accepted (metres)</span>
            <input
              type="number"
              min={10}
              max={1000}
              value={form.maxAccuracyM}
              onChange={(e) => set('maxAccuracyM', e.target.value)}
            />
          </label>
          <p className="muted">
            Indoors, phones often only get a 20–50 m fix; too strict a radius or accuracy
            ceiling causes false rejections. Start loose (150–250 m) and tighten after a pilot.
          </p>

          <hr />
          <h2>Check-out QR</h2>
          <label className="field field-checkbox">
            <input
              type="checkbox"
              checked={form.checkoutEnabled}
              onChange={(e) => set('checkoutEnabled', e.target.checked)}
            />
            <span>Show a second QR so teachers can scan out at the end of the day</span>
          </label>
          <label className="field">
            <span>Kiosk auto-switches to check-out at (local time, optional)</span>
            <input
              type="time"
              value={form.checkoutAutoSwitchAt}
              onChange={(e) => set('checkoutAutoSwitchAt', e.target.value)}
            />
          </label>
          <label className="field">
            <span>Minimum minutes between check-in and check-out</span>
            <input
              type="number"
              min={0}
              max={720}
              value={form.minSessionMinutes}
              onChange={(e) => set('minSessionMinutes', e.target.value)}
            />
          </label>
          <label className="field field-checkbox">
            <input
              type="checkbox"
              checked={form.allowCheckoutWithoutCheckin}
              onChange={(e) => set('allowCheckoutWithoutCheckin', e.target.checked)}
            />
            <span>Allow a check-out even if the teacher never checked in</span>
          </label>

          <div className="form-actions">
            <button type="submit" disabled={saving || (form.enabled && !hasCoords)}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>

          {updatedAt && (
            <p className="muted">Last changed {new Date(updatedAt).toLocaleString()}.</p>
          )}
        </form>
      )}
    </>
  );
}
