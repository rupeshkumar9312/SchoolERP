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
}

const EMPTY: FormState = {
  enabled: false,
  latitude: '',
  longitude: '',
  radiusM: '150',
  maxAccuracyM: '75',
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
      });
      setUpdatedAt(saved.updatedAt);
      setForm((prev) => ({ ...prev, enabled: saved.enabled }));
      toast('Geofence settings saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save the geofence settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1>QR check-in geofence</h1>
      <p className="subtitle">
        When enabled, a teacher’s app must report a location within the radius below (and a
        good GPS fix) for the QR scan to mark attendance. Enforcement is server-side.
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
