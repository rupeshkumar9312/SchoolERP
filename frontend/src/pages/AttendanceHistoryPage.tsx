import { useCallback, useEffect, useState } from 'react';
import type { AttendanceRecord, AttendanceStatus } from '../api/attendance';
import {
  getStudentAttendanceHistory,
  listAttendance,
  updateAttendance,
} from '../api/attendance';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { AttendanceStatusToggle } from './attendance/AttendanceStatusToggle';
import { todayUtcDate } from './attendance/todayUtc';
import { useClassSectionScope } from './attendance/useClassSectionScope';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';
import { StudentAttendanceSearch } from './attendance/StudentAttendanceSearch';

type Mode = 'class' | 'student';

export function AttendanceHistoryPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('attendance.student.edit');
  const [mode, setMode] = useState<Mode>('class');
  const scope = useClassSectionScope();
  const { classId, sectionId } = scope;
  const [date, setDate] = useState(todayUtcDate());

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!classId || !sectionId || !date) {
      setRecords([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setRecords(
        await listAttendance({
          classId: Number(classId),
          sectionId: Number(sectionId),
          date,
        }),
      );
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to load attendance',
      );
    } finally {
      setLoading(false);
    }
  }, [classId, sectionId, date]);

  useEffect(() => {
    if (mode === 'class') void load();
  }, [mode, load]);

  const onEdit = async (record: AttendanceRecord, status: AttendanceStatus) => {
    setSavingId(record.id);
    setError(null);
    try {
      const updated = await updateAttendance(record.id, status);
      setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Failed to update attendance',
      );
    } finally {
      setSavingId(null);
    }
  };

  return (
    <>
      <h1>Attendance History</h1>
      <p className="subtitle">
        Look up attendance by class and date, or search for a student directly.
      </p>

      <div className="row-actions" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={mode === 'class' ? '' : 'secondary'}
          onClick={() => setMode('class')}
        >
          By class &amp; date
        </button>
        <button
          type="button"
          className={mode === 'student' ? '' : 'secondary'}
          onClick={() => setMode('student')}
        >
          By student
        </button>
      </div>

      {mode === 'student' ? (
        <StudentAttendanceSearch fetchHistory={getStudentAttendanceHistory} />
      ) : (
        <>
          <div className="filter-bar">
            {scope.canBrowseAcademicStructure ? (
              <>
                <label className="field">
                  <span>Academic year</span>
                  <select
                    value={scope.yearId}
                    onChange={(e) => {
                      scope.setYearId(e.target.value);
                      scope.setClassId('');
                      scope.setSectionId('');
                    }}
                  >
                    <option value="">Select a year</option>
                    {scope.years.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Class</span>
                  <select
                    value={scope.classId}
                    onChange={(e) => {
                      scope.setClassId(e.target.value);
                      scope.setSectionId('');
                    }}
                    disabled={!scope.yearId}
                  >
                    <option value="">Select a class</option>
                    {scope.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Section</span>
                  <select
                    value={scope.sectionId}
                    onChange={(e) => scope.setSectionId(e.target.value)}
                    disabled={!scope.classId}
                  >
                    <option value="">Select a section</option>
                    {scope.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label className="field">
                <span>Class &amp; section</span>
                <select
                  value={classId && sectionId ? `${classId}-${sectionId}` : ''}
                  onChange={(e) => scope.selectMyOption(e.target.value)}
                >
                  <option value="">Select a class &amp; section</option>
                  {scope.myOptions.map((o) => (
                    <option
                      key={`${o.classId}-${o.sectionId}`}
                      value={`${o.classId}-${o.sectionId}`}
                    >
                      {o.className} - {o.sectionName}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="field">
              <span>Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>

          {error && (
            <div className="status down">
              <strong>Error</strong>
              <p>{error}</p>
            </div>
          )}

          {!classId || !sectionId ? (
            <EmptyState
              title="Select a class and section"
              message="Pick a class and section above to see attendance."
            />
          ) : loading ? (
            <TableSkeleton columns={4} />
          ) : records.length === 0 ? (
            <EmptyState
              title="No attendance marked"
              message="Nothing has been marked for this date yet."
            />
          ) : (
            <div className="card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Admission No.</th>
                    <th>Name</th>
                    <th>Status</th>
                    <th>Marked by</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td data-label="Admission No.">
                        {record.student.admissionNo}
                      </td>
                      <td data-label="Name">{record.student.name}</td>
                      <td data-label="Status">
                        {canEdit ? (
                          <AttendanceStatusToggle
                            value={record.status}
                            onChange={(status) => void onEdit(record, status)}
                            disabled={savingId === record.id}
                          />
                        ) : (
                          <span
                            className={`badge status-badge-${record.status.toLowerCase()}`}
                          >
                            {record.status}
                          </span>
                        )}
                      </td>
                      <td data-label="Marked by">{record.markedBy.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
