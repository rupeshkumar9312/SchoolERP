import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { TeacherAttendanceRecord } from '../api/teacherAttendance';
import { listTeacherAttendance, markTeacherAttendance } from '../api/teacherAttendance';
import { AttendanceStatusToggle } from './attendance/AttendanceStatusToggle';
import { todayUtcDate } from './attendance/todayUtc';
import type { AttendanceStatus } from '../api/attendance';
import { EmptyState } from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';

export function MyAttendancePage() {
  const today = todayUtcDate();
  const [history, setHistory] = useState<TeacherAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setHistory(await listTeacherAttendance());
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
  const status: AttendanceStatus = todayRecord?.status ?? 'PRESENT';

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
      <p className="subtitle">Mark your own attendance for today.</p>

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
        <AttendanceStatusToggle value={status} onChange={(next) => void onMark(next)} disabled={saving} />
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
