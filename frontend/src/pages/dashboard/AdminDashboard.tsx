import type { CSSProperties } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AdminSummary } from '../../api/dashboard';
import { getAdminSummary } from '../../api/dashboard';
import { ApiError } from '../../api/client';
import { useAuth } from '../../auth/useAuth';
import {
  IconCalendarCheck,
  IconClasses,
  IconSections,
  IconStudents,
  IconTeachers,
} from '../../components/DashboardIcons';
import { AttendanceTrendChart } from '../../components/charts/TrendChart';
import { ClassBarChart } from '../../components/charts/ClassBarChart';
import { AttendanceBreakdown } from './AttendanceBreakdown';
import { DashboardSkeleton } from '../../components/Skeleton';

const QUICK_LINKS: Array<{ label: string; path: string; permission: string }> = [
  { label: 'Users', path: '/users', permission: 'user.view' },
  { label: 'Academic Setup', path: '/academic-setup', permission: 'academic.view' },
  { label: 'Teachers', path: '/teachers', permission: 'teacher.view' },
  { label: 'Students', path: '/students', permission: 'student.view' },
  { label: 'Attendance History', path: '/attendance/history', permission: 'attendance.student.view' },
  { label: 'Staff Attendance', path: '/staff-attendance', permission: 'teacher.view' },
];

const STAT_ACCENTS = {
  students: { accent: '#2f7cd6', tint: 'rgba(47, 124, 214, 0.14)' },
  teachers: { accent: '#22a375', tint: 'rgba(34, 163, 117, 0.14)' },
  classes: { accent: '#0e9aab', tint: 'rgba(14, 154, 171, 0.14)' },
  sections: { accent: '#64748b', tint: 'rgba(100, 116, 139, 0.14)' },
} as const;

function accentStyle(key: keyof typeof STAT_ACCENTS): CSSProperties {
  return {
    '--stat-accent': STAT_ACCENTS[key].accent,
    '--stat-accent-tint': STAT_ACCENTS[key].tint,
  } as CSSProperties;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

export function AdminDashboard() {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendFrom, setTrendFrom] = useState(() => isoDaysAgo(13));
  const [trendTo, setTrendTo] = useState(TODAY_ISO);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await getAdminSummary(trendFrom, trendTo));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [trendFrom, trendTo]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <DashboardSkeleton />;

  if (error || !summary) {
    return (
      <div className="status down">
        <strong>Error</strong>
        <p>{error ?? 'Failed to load dashboard'}</p>
      </div>
    );
  }

  const { totals, studentAttendanceToday: sa, teacherAttendanceToday: ta } = summary;

  return (
    <>
      <p className="subtitle" style={{ marginTop: '-1rem' }}>
        {summary.academicYear
          ? `Academic year: ${summary.academicYear.name}`
          : 'No academic year is marked current yet.'}
      </p>

      <div className="stat-grid">
        <div className="stat-card" style={accentStyle('students')}>
          <span className="stat-icon">
            <IconStudents />
          </span>
          <div>
            <div className="stat-label">Students</div>
            <div className="stat-value">{totals.students}</div>
          </div>
        </div>
        <div className="stat-card" style={accentStyle('teachers')}>
          <span className="stat-icon">
            <IconTeachers />
          </span>
          <div>
            <div className="stat-label">Teachers</div>
            <div className="stat-value">{totals.teachers}</div>
          </div>
        </div>
        <div className="stat-card" style={accentStyle('classes')}>
          <span className="stat-icon">
            <IconClasses />
          </span>
          <div>
            <div className="stat-label">Classes</div>
            <div className="stat-value">{totals.classes}</div>
          </div>
        </div>
        <div className="stat-card" style={accentStyle('sections')}>
          <span className="stat-icon">
            <IconSections />
          </span>
          <div>
            <div className="stat-label">Sections</div>
            <div className="stat-value">{totals.sections}</div>
          </div>
        </div>
      </div>

      <section className="card trend-chart-card">
        <div className="card-head">
          <h2>Attendance trend</h2>
          <div className="trend-range-picker">
            <label className="field field-inline">
              <span>From</span>
              <input type="date" value={trendFrom} max={trendTo} onChange={(e) => setTrendFrom(e.target.value)} />
            </label>
            <label className="field field-inline">
              <span>To</span>
              <input type="date" value={trendTo} min={trendFrom} max={TODAY_ISO} onChange={(e) => setTrendTo(e.target.value)} />
            </label>
          </div>
        </div>
        <AttendanceTrendChart points={summary.studentAttendanceTrend} />
      </section>

      <div className="dashboard-split">
        <section className="card">
          <div className="card-head">
            <h2>Student attendance today</h2>
            <span className="muted">{sa.date}</span>
          </div>
          <AttendanceBreakdown {...sa} />
          <p className="stat-sub">
            <IconCalendarCheck className="inline-icon" /> {sa.sectionsMarked} of {sa.totalSections} section
            {sa.totalSections === 1 ? '' : 's'} have marked attendance today.
          </p>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Staff attendance today</h2>
            <span className="muted">{ta.date}</span>
          </div>
          <AttendanceBreakdown {...ta} />
          {ta.totalMarked > 0 && (
            <p className="stat-sub">
              of {ta.totalTeachers} teacher{ta.totalTeachers === 1 ? '' : 's'}
            </p>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Attendance by class</h2>
          <span className="muted">Today, lowest first</span>
        </div>
        <ClassBarChart classes={summary.classAttendanceToday} />
      </section>

      <section className="card">
        <h2>Quick links</h2>
        <div className="quick-links">
          {QUICK_LINKS.filter((link) => hasPermission(link.permission)).map((link) => (
            <button key={link.path} onClick={() => navigate(link.path)}>
              {link.label}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
