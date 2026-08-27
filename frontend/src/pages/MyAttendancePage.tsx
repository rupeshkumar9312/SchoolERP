import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { TeacherAttendanceRecord } from '../api/teacherAttendance';
import {
  getTeacherSelfServeConfig,
  listTeacherAttendance,
  markTeacherAttendance,
} from '../api/teacherAttendance';
import { AttendanceStatusToggle } from './attendance/AttendanceStatusToggle';
import { todayUtcDate } from './attendance/todayUtc';
import type { AttendanceStatus } from '../api/attendance';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';

function fmtTime(iso?: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
}

function fmtWorked(mins?: number | null): string {
  if (mins == null || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function MyAttendancePage() {
  const today = todayUtcDate();
  const [history, setHistory] = useState<TeacherAttendanceRecord[]>([]);
  const [manualMarkEnabled, setManualMarkEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [records, config] = await Promise.all([
        listTeacherAttendance(),
        getTeacherSelfServeConfig(),
      ]);
      setHistory(records);
      setManualMarkEnabled(config.manualMarkEnabled);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your attendance');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const todayRecord = history.find((r) => r.date === today);
  const status: AttendanceStatus | null = todayRecord?.status ?? null;

  const onMark = async (next: AttendanceStatus) => {
    setSaving(true);
    setError(null);
    try {
      const updated = await markTeacherAttendance({ date: today, status: next });
      setHistory((prev) => [updated, ...prev.filter((r) => r.date !== today)]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark attendance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1>My Attendance</h1>
      <p className="subtitle">
        {manualMarkEnabled
          ? 'Mark your own attendance for today.'
          : 'Check in by scanning the QR on the staff display with the EDVANCE app.'}
      </p>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Today ({today})</h2>
        </div>
        {manualMarkEnabled ? (
          <AttendanceStatusToggle value={status} onChange={(next) => void onMark(next)} disabled={saving} />
        ) : status ? (
          <span className={`badge status-badge-${status.toLowerCase()}`}>{status}</span>
        ) : (
          <p className="muted">
            Not checked in yet — scan the QR on the staff display with the EDVANCE app.
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Recent history</h2>
        </div>
        {loading ? (
          <>
            <Skeleton height="1.1rem" className="skeleton-block" />
            <Skeleton height="1.1rem" className="skeleton-block" />
            <Skeleton height="1.1rem" className="skeleton-block" />
          </>
        ) : history.length === 0 ? (
          <EmptyState title="No attendance marked yet" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Status</th>
                <th>Check in</th>
                <th>Check out</th>
                <th>Hours</th>
                <th>Marked by</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 14).map((record) => (
                <tr key={record.id}>
                  <td data-label="Date">{record.date}</td>
                  <td data-label="Status">
                    <span className={`badge status-badge-${record.status.toLowerCase()}`}>{record.status}</span>
                  </td>
                  <td data-label="Check in">{fmtTime(record.checkInAt)}</td>
                  <td data-label="Check out">{fmtTime(record.checkOutAt)}</td>
                  <td data-label="Hours">{fmtWorked(record.workedMinutes)}</td>
                  <td data-label="Marked by">{record.markedBy.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
