import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { StudentSummary } from '../../api/dashboard';
import { getStudentSummary } from '../../api/dashboard';
import { ApiError } from '../../api/client';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';

export function StudentDashboard() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<StudentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getStudentSummary());
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

  const { student, myAttendanceToday, attendanceThisMonth, upcomingAssignments } = summary;

  return (
    <>
      <p className="subtitle" style={{ marginTop: '-1rem' }}>
        {student.class.name} - {student.section.name} · Admission No. {student.admissionNo}
      </p>

      <section className="card">
        <div className="card-head">
          <h2>Today's attendance</h2>
          <button className="secondary" onClick={() => navigate('/student/attendance')}>
            View history
          </button>
        </div>
        {myAttendanceToday ? (
          <div className="stat-value">
            <span className={`badge status-badge-${myAttendanceToday.status.toLowerCase()}`}>
              {myAttendanceToday.status}
            </span>
          </div>
        ) : (
          <p className="muted">Not marked yet today.</p>
        )}
      </section>

      <section className="card">
        <h2>This month's attendance</h2>
        {attendanceThisMonth.totalMarked === 0 ? (
          <p className="muted">No attendance marked yet this month.</p>
        ) : (
          <>
            <div className="stat-value">{attendanceThisMonth.presentPercent}% present</div>
            <div className="progress-bar">
              <div
                className="progress-bar-fill"
                style={{ width: `${attendanceThisMonth.presentPercent ?? 0}%` }}
              />
            </div>
            <p className="stat-sub">
              {attendanceThisMonth.present} of {attendanceThisMonth.totalMarked} days present
            </p>
          </>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Upcoming assignments</h2>
          <button className="secondary" onClick={() => navigate('/student/assignments')}>
            View all
          </button>
        </div>
        {upcomingAssignments.length === 0 ? (
          <EmptyState title="No upcoming assignments" />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Subject</th>
                <th>Due date</th>
              </tr>
            </thead>
            <tbody>
              {upcomingAssignments.map((a) => (
                <tr key={a.id}>
                  <td data-label="Title">{a.title}</td>
                  <td data-label="Subject">{a.subject.name}</td>
                  <td data-label="Due date">{a.dueDate.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
