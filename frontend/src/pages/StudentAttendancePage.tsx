import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { AttendanceRecord } from '../api/attendance';
import { listMyAttendance } from '../api/attendance';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';

export function StudentAttendancePage() {
  const [history, setHistory] = useState<AttendanceRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setHistory(await listMyAttendance());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load your attendance');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h1>My Attendance</h1>
      <p className="subtitle">Your attendance history, most recent first.</p>

      {error && (
        <div className="status down">
          <strong>Couldn't load your attendance</strong>
          <p>{error}</p>
        </div>
      )}

      {!error && history === null && <TableSkeleton columns={3} />}

      {history !== null &&
        (history.length === 0 ? (
          <EmptyState title="No attendance recorded yet" />
        ) : (
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Marked by</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id}>
                    <td data-label="Date">{record.date}</td>
                    <td data-label="Status">
                      <span className={`badge status-badge-${record.status.toLowerCase()}`}>
                        {record.status}
                      </span>
                    </td>
                    <td data-label="Marked by">{record.markedBy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}
