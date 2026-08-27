import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { AttendanceStatus } from '../api/attendance';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { MAX_ROSTER_PAGE_SIZE } from '../api/pagination';
import type { Teacher } from '../api/teachers';
import { listTeachers } from '../api/teachers';
import { listTeacherAttendance, markTeacherAttendance } from '../api/teacherAttendance';
import type { TeacherAttendanceRecord } from '../api/teacherAttendance';
import { AttendanceStatusToggle } from './attendance/AttendanceStatusToggle';
import { todayUtcDate } from './attendance/todayUtc';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';

export function StaffAttendancePage() {
  const { hasPermission } = useAuth();
  const [date, setDate] = useState(todayUtcDate());
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [records, setRecords] = useState<TeacherAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allTeachers, attendance] = await Promise.all([
        listTeachers({ isActive: true, limit: MAX_ROSTER_PAGE_SIZE }),
        listTeacherAttendance({ date }),
      ]);
      setTeachers(allTeachers.items);
      setRecords(attendance);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load staff attendance');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const onMark = async (teacherId: number, status: AttendanceStatus) => {
    setSavingId(teacherId);
    setError(null);
    try {
      const updated = await markTeacherAttendance({ teacherId, date, status });
      setRecords((prev) => [updated, ...prev.filter((r) => r.teacher.id !== teacherId)]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to mark attendance');
    } finally {
      setSavingId(null);
    }
  };

  const byTeacherId = new Map(records.map((r) => [r.teacher.id, r]));

  return (
    <>
      <h1>Staff Attendance</h1>
      <p className="subtitle">Filter by date and mark or correct any teacher's attendance.</p>

      {hasPermission('attendance.teacher.qr.manage') && (
        <p className="subtitle">
          <Link to="/kiosk" target="_blank" rel="noopener">
            Open the QR check-in kiosk ↗
          </Link>{' '}
          — run this on a screen at the staff entrance so teachers scan to mark themselves present.
          {' · '}
          <Link to="/attendance/qr-geofence">Geofence settings</Link>
        </p>
      )}

      <div className="filter-bar">
        <label className="field">
          <span>Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <TableSkeleton columns={3} />
      ) : teachers.length === 0 ? (
        <EmptyState title="No teachers found" />
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Marked by</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => {
                const record = byTeacherId.get(teacher.id);
                return (
                  <tr key={teacher.id}>
                    <td data-label="Name">{teacher.name}</td>
                    <td data-label="Status">
                      <AttendanceStatusToggle
                        value={record?.status ?? null}
                        onChange={(status) => void onMark(teacher.id, status)}
                        disabled={savingId === teacher.id}
                      />
                    </td>
                    <td data-label="Marked by">{record?.markedBy.name ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
