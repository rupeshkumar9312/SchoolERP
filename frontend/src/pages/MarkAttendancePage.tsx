import { useCallback, useEffect, useState } from 'react';
import type { AttendanceStatus } from '../api/attendance';
import { listAttendance, markAttendance } from '../api/attendance';
import { ApiError } from '../api/client';
import type { Student } from '../api/students';
import { listMyClassStudents, listStudents } from '../api/students';
import { AttendanceStatusToggle } from './attendance/AttendanceStatusToggle';
import { todayUtcDate } from './attendance/todayUtc';
import { useClassSectionScope } from './attendance/useClassSectionScope';

export function MarkAttendancePage() {
  const scope = useClassSectionScope();
  const { classId, sectionId } = scope;
  const [date, setDate] = useState(todayUtcDate());

  const [roster, setRoster] = useState<Student[]>([]);
  const [statuses, setStatuses] = useState<Record<number, AttendanceStatus>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const loadRoster = useCallback(async () => {
    if (!classId || !sectionId || !date) return;
    setLoading(true);
    setError(null);
    setSavedAt(null);
    try {
      // A TEACHER has no student.view — reuse the scoped /students/my-classes
      // roster (Module 5) instead of the full GET /students an admin uses.
      const rosterPromise = scope.canBrowseAcademicStructure
        ? listStudents({ classId: Number(classId), sectionId: Number(sectionId) })
        : listMyClassStudents().then((all) =>
            all.filter((s) => s.class.id === Number(classId) && s.section.id === Number(sectionId)),
          );
      const [students, existing] = await Promise.all([
        rosterPromise,
        listAttendance({ classId: Number(classId), sectionId: Number(sectionId), date }),
      ]);
      setRoster(students);
      const byStudent = new Map(existing.map((r) => [r.student.id, r.status]));
      const next: Record<number, AttendanceStatus> = {};
      for (const s of students) {
        next[s.id] = byStudent.get(s.id) ?? 'PRESENT';
      }
      setStatuses(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  }, [classId, sectionId, date, scope.canBrowseAcademicStructure]);

  useEffect(() => {
    void loadRoster();
  }, [loadRoster]);

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await markAttendance({
        classId: Number(classId),
        sectionId: Number(sectionId),
        date,
        records: roster.map((s) => ({ studentId: s.id, status: statuses[s.id] })),
      });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const setAllTo = (status: AttendanceStatus) => {
    const next: Record<number, AttendanceStatus> = {};
    for (const s of roster) next[s.id] = status;
    setStatuses(next);
  };

  return (
    <>
      <h1>Mark Attendance</h1>
      <p className="subtitle">Pick a class, section and date to load the roster.</p>

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
                <option key={`${o.classId}-${o.sectionId}`} value={`${o.classId}-${o.sectionId}`}>
                  {o.className} - {o.sectionName}
                </option>
              ))}
            </select>
          </label>
        )}

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

      {savedAt && (
        <div className="status up">
          <strong>Saved</strong>
          <p>Attendance saved at {savedAt}.</p>
        </div>
      )}

      {!classId || !sectionId ? (
        <p className="muted">Select a class and section to load the roster.</p>
      ) : loading ? (
        <p className="muted">Loading roster…</p>
      ) : roster.length === 0 ? (
        <p className="muted">No students in this class and section.</p>
      ) : (
        <>
          <div className="card-head">
            <h2>Roster ({roster.length})</h2>
            <div className="row-actions">
              <button type="button" className="secondary" onClick={() => setAllTo('PRESENT')}>
                Mark all present
              </button>
            </div>
          </div>

          <ul className="roster-list">
            {roster.map((student) => (
              <li key={student.id} className="roster-row">
                <div className="roster-name">
                  <strong>{student.name}</strong>
                  <span className="muted"> · {student.admissionNo}</span>
                </div>
                <AttendanceStatusToggle
                  value={statuses[student.id] ?? 'PRESENT'}
                  onChange={(status) => setStatuses((prev) => ({ ...prev, [student.id]: status }))}
                />
              </li>
            ))}
          </ul>

          <div className="form-actions">
            <button onClick={() => void onSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save attendance'}
            </button>
          </div>
        </>
      )}
    </>
  );
}
