import { useCallback, useEffect, useState } from 'react';
import * as academic from '../api/academic';
import { ApiError } from '../api/client';
import * as reports from '../api/reports';
import { downloadCsv } from '../components/csv';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';

type Tab = 'summary' | 'defaulters' | 'staff';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'summary', label: 'Attendance Summary' },
  { id: 'defaulters', label: 'Defaulters' },
  { id: 'staff', label: 'Staff Attendance' },
];

function percentLabel(percent: number | null): string {
  return percent === null ? '—' : `${percent}%`;
}

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('summary');

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [sections, setSections] = useState<academic.Section[]>([]);
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [threshold, setThreshold] = useState('75');

  const [summary, setSummary] = useState<reports.AttendanceSummary | null>(null);
  const [defaulters, setDefaulters] = useState<reports.DefaultersReport | null>(null);
  const [staff, setStaff] = useState<reports.StaffAttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void academic.listAcademicYears().then(setYears);
  }, []);

  useEffect(() => {
    if (!yearId) {
      setClasses([]);
      return;
    }
    void academic.listClasses(Number(yearId)).then(setClasses);
  }, [yearId]);

  useEffect(() => {
    if (!classId) {
      setSections([]);
      return;
    }
    void academic.listSections(Number(classId)).then(setSections);
  }, [classId]);

  const filters = {
    classId: classId ? Number(classId) : undefined,
    sectionId: sectionId ? Number(sectionId) : undefined,
    from: from || undefined,
    to: to || undefined,
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'summary') {
        setSummary(await reports.getAttendanceSummary(filters));
      } else if (tab === 'defaulters') {
        setDefaulters(await reports.getDefaulters({ ...filters, threshold: Number(threshold) || 75 }));
      } else {
        setStaff(await reports.getStaffAttendanceSummary({ from: filters.from, to: filters.to }));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, classId, sectionId, from, to, threshold]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportSummaryCsv = () => {
    if (!summary) return;
    downloadCsv(
      `attendance-summary-${summary.range.from}-to-${summary.range.to}.csv`,
      ['Admission No.', 'Name', 'Class', 'Section', 'Present', 'Absent', 'Late', 'Leave', 'Total Marked', 'Percent'],
      summary.students.map((s) => [
        s.student.admissionNo,
        s.student.name,
        s.class.name,
        s.section.name,
        s.present,
        s.absent,
        s.late,
        s.leave,
        s.totalMarked,
        s.percent ?? '',
      ]),
    );
  };

  const exportDefaultersCsv = () => {
    if (!defaulters) return;
    downloadCsv(
      `defaulters-below-${defaulters.threshold}pct-${defaulters.range.from}-to-${defaulters.range.to}.csv`,
      ['Admission No.', 'Name', 'Class', 'Section', 'Present', 'Total Marked', 'Percent'],
      defaulters.defaulters.map((s) => [
        s.student.admissionNo,
        s.student.name,
        s.class.name,
        s.section.name,
        s.present,
        s.totalMarked,
        s.percent ?? '',
      ]),
    );
  };

  const exportStaffCsv = () => {
    if (!staff) return;
    downloadCsv(
      `staff-attendance-${staff.range.from}-to-${staff.range.to}.csv`,
      ['Teacher', 'Present', 'Absent', 'Late', 'Leave', 'Total Marked', 'Percent'],
      staff.teachers.map((t) => [t.teacher.name, t.present, t.absent, t.late, t.leave, t.totalMarked, t.percent ?? '']),
    );
  };

  return (
    <>
      <h1>Reports</h1>
      <p className="subtitle">Turn attendance data into decisions.</p>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab-button ${tab === t.id ? 'tab-button-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        {tab !== 'staff' && (
          <>
            <label className="field">
              <span>Academic year</span>
              <select
                value={yearId}
                onChange={(e) => {
                  setYearId(e.target.value);
                  setClassId('');
                  setSectionId('');
                }}
              >
                <option value="">All years</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Class</span>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSectionId('');
                }}
                disabled={!yearId}
              >
                <option value="">All classes</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Section</span>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
                <option value="">All sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <label className="field">
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        {tab === 'defaulters' && (
          <label className="field">
            <span>Threshold %</span>
            <input
              type="number"
              min={0}
              max={100}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </label>
        )}
      </div>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {loading && <TableSkeleton columns={6} />}

      {!loading && tab === 'summary' && summary && (
        <>
          <section className="card">
            <div className="card-head">
              <h2>Attendance % by class</h2>
              <span className="muted">
                {summary.range.from} to {summary.range.to}
              </span>
            </div>
            {summary.classSummaries.length === 0 ? (
              <EmptyState title="No attendance records in this range" />
            ) : (
              summary.classSummaries.map((c) => (
                <div className="bar-chart-row" key={c.class.id}>
                  <span className="bar-chart-label">{c.class.name}</span>
                  <div className="progress-bar">
                    <div className="progress-bar-fill" style={{ width: `${c.percent ?? 0}%` }} />
                  </div>
                  <span className="bar-chart-value">{percentLabel(c.percent)}</span>
                </div>
              ))
            )}
          </section>

          <section className="card">
            <div className="card-head">
              <h2>Per-student breakdown</h2>
              {summary.students.length > 0 && (
                <button type="button" className="secondary" onClick={exportSummaryCsv}>
                  Export CSV
                </button>
              )}
            </div>
            {summary.students.length === 0 ? (
              <EmptyState title="No students to show" />
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Admission No.</th>
                    <th>Name</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Present</th>
                    <th>Absent</th>
                    <th>Late</th>
                    <th>Leave</th>
                    <th>%</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.students.map((s) => (
                    <tr key={s.student.id}>
                      <td data-label="Admission No.">{s.student.admissionNo}</td>
                      <td data-label="Name">{s.student.name}</td>
                      <td data-label="Class">{s.class.name}</td>
                      <td data-label="Section">{s.section.name}</td>
                      <td data-label="Present">{s.present}</td>
                      <td data-label="Absent">{s.absent}</td>
                      <td data-label="Late">{s.late}</td>
                      <td data-label="Leave">{s.leave}</td>
                      <td data-label="%">{percentLabel(s.percent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}

      {!loading && tab === 'defaulters' && defaulters && (
        <section className="card">
          <div className="card-head">
            <h2>
              Below {defaulters.threshold}% ({defaulters.range.from} to {defaulters.range.to})
            </h2>
            {defaulters.defaulters.length > 0 && (
              <button type="button" className="secondary" onClick={exportDefaultersCsv}>
                Export CSV
              </button>
            )}
          </div>
          {defaulters.defaulters.length === 0 ? (
            <EmptyState
              title="No defaulters"
              message="No student in this range falls below the selected threshold."
            />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Admission No.</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Present / Marked</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {defaulters.defaulters.map((s) => (
                  <tr key={s.student.id}>
                    <td data-label="Admission No.">{s.student.admissionNo}</td>
                    <td data-label="Name">{s.student.name}</td>
                    <td data-label="Class">{s.class.name}</td>
                    <td data-label="Section">{s.section.name}</td>
                    <td data-label="Present / Marked">
                      {s.present} / {s.totalMarked}
                    </td>
                    <td data-label="%">
                      <span className="badge status-badge-absent">{percentLabel(s.percent)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}

      {!loading && tab === 'staff' && staff && (
        <section className="card">
          <div className="card-head">
            <h2>
              Staff attendance ({staff.range.from} to {staff.range.to})
            </h2>
            {staff.teachers.length > 0 && (
              <button type="button" className="secondary" onClick={exportStaffCsv}>
                Export CSV
              </button>
            )}
          </div>
          {staff.teachers.length === 0 ? (
            <EmptyState title="No staff attendance records in this range" />
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Late</th>
                  <th>Leave</th>
                  <th>%</th>
                </tr>
              </thead>
              <tbody>
                {staff.teachers.map((t) => (
                  <tr key={t.teacher.id}>
                    <td data-label="Teacher">{t.teacher.name}</td>
                    <td data-label="Present">{t.present}</td>
                    <td data-label="Absent">{t.absent}</td>
                    <td data-label="Late">{t.late}</td>
                    <td data-label="Leave">{t.leave}</td>
                    <td data-label="%">{percentLabel(t.percent)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}
