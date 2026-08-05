import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TeacherSummary } from '../../api/dashboard';
import { getTeacherSummary } from '../../api/dashboard';
import { ApiError } from '../../api/client';
import { Skeleton } from '../../components/Skeleton';

export function TeacherDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<TeacherSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getTeacherSummary());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <>
        <div className="card">
          <Skeleton width="40%" height="1.1rem" />
          <Skeleton width="25%" height="2rem" className="skeleton-block" />
        </div>
        <div className="card">
          <Skeleton width="35%" height="1.1rem" />
          <Skeleton width="100%" height="6rem" className="skeleton-block" />
        </div>
      </>
    );
  }

  if (error || !summary) {
    return (
      <div className="status down">
        <strong>Error</strong>
        <p>{error ?? 'Failed to load dashboard'}</p>
      </div>
    );
  }

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>Your attendance today</h2>
          <button className="secondary" onClick={() => navigate('/my-attendance')}>
            {summary.myAttendanceToday ? 'View / update' : 'Mark now'}
          </button>
        </div>
        {summary.myAttendanceToday ? (
          <div className="stat-value">
            <span className={`badge status-badge-${summary.myAttendanceToday.status.toLowerCase()}`}>
              {summary.myAttendanceToday.status}
            </span>
          </div>
        ) : (
          <p className="muted">You haven't marked your attendance for today yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Your homeroom sections</h2>
        {summary.classTeacherOf.length === 0 ? (
          <p className="muted">You're not the class teacher of any section yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Attendance today</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {summary.classTeacherOf.map((c) => (
                <tr key={c.section.id}>
                  <td data-label="Class">{c.class.name}</td>
                  <td data-label="Section">{c.section.name}</td>
                  <td data-label="Attendance today">
                    {c.attendanceMarkedToday ? (
                      <span className="badge status-badge-present">Marked</span>
                    ) : (
                      <span className="badge status-badge-absent">Not marked</span>
                    )}
                  </td>
                  <td data-label="Actions">
                    <button className="secondary" onClick={() => navigate('/attendance/mark')}>
                      Mark attendance
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Your classes</h2>
        {summary.classes.length === 0 ? (
          <p className="muted">No classes assigned yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Subject</th>
                <th>Class teacher?</th>
              </tr>
            </thead>
            <tbody>
              {summary.classes.map((c) => (
                <tr key={`${c.class.id}-${c.section.id}-${c.subject?.id ?? 'none'}`}>
                  <td data-label="Class">{c.class.name}</td>
                  <td data-label="Section">{c.section.name}</td>
                  <td data-label="Subject">{c.subject?.name ?? '—'}</td>
                  <td data-label="Class teacher?">
                    {c.isClassTeacher ? <span className="badge">Yes</span> : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
