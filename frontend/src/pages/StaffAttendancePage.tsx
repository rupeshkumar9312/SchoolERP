import { useCallback, useEffect, useState } from 'react';
import type { AttendanceStatus } from '../api/attendance';
import { ApiError } from '../api/client';
import type { Teacher } from '../api/teachers';
import { listTeachers } from '../api/teachers';
import { listTeacherAttendance, markTeacherAttendance } from '../api/teacherAttendance';
import type { TeacherAttendanceRecord } from '../api/teacherAttendance';
import { AttendanceStatusToggle } from './attendance/AttendanceStatusToggle';
import { todayUtcDate } from './attendance/todayUtc';

export function StaffAttendancePage() {
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
        listTeachers(),
        listTeacherAttendance({ date }),
      ]);
      setTeachers(allTeachers);
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
        <p className="muted">Loading…</p>
      ) : teachers.length === 0 ? (
        <p className="muted">No teachers found.</p>
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
                        value={record?.status ?? 'PRESENT'}
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
