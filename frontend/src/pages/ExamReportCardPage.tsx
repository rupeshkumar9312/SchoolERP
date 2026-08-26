import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { ScheduleReportCard } from '../api/exams';
import { EXAM_TYPE_LABELS, getExamReportCard } from '../api/exams';
import { TableSkeleton } from '../components/Skeleton';

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// Full class's cross-subject standing for one schedule — every active
// student, one column per subject, plus a computed Total/%/Rank. A
// student's total/rank stays blank until every subject on the schedule has
// a recorded mark for them (see the backend's ScheduleStudentTotal doc
// comment) — shown as "—" rather than a misleading partial total.
export function ExamReportCardPage() {
  const { id, scheduleId } = useParams();
  const examId = Number(id);
  const scheduleIdNum = Number(scheduleId);

  const [report, setReport] = useState<ScheduleReportCard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setReport(await getExamReportCard(examId, scheduleIdNum));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load report card');
    }
  }, [examId, scheduleIdNum]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="status down">
        <strong>Couldn't load report card</strong>
        <p>{error}</p>
      </div>
    );
  }

  if (!report) return <TableSkeleton columns={6} />;

  return (
    <>
      <div className="card-head">
        <h1>{report.exam.name} — Report Card</h1>
        <span className={`badge ${report.schedule.status === 'PUBLISHED' ? 'status-badge-present' : ''}`}>
          {report.schedule.status === 'PUBLISHED' ? 'Published' : 'Draft'}
        </span>
      </div>
      <p className="subtitle">
        {EXAM_TYPE_LABELS[report.exam.type]} · {report.schedule.class.name} ·{' '}
        {toDateInputValue(report.schedule.startDate)} – {toDateInputValue(report.schedule.endDate)}
      </p>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Student</th>
              <th>Admission No.</th>
              <th>Section</th>
              {report.subjects.map((s) => (
                <th key={s.examSubjectId}>{s.subject.name}</th>
              ))}
              <th>Total</th>
              <th>%</th>
            </tr>
          </thead>
          <tbody>
            {report.rows.map((row) => (
              <tr key={row.student.id}>
                <td data-label="Rank">{row.total.rank ?? '—'}</td>
                <td data-label="Student">{row.student.name}</td>
                <td data-label="Admission No.">{row.student.admissionNo ?? '—'}</td>
                <td data-label="Section">{row.section.name}</td>
                {row.subjects.map((cell) => (
                  <td key={cell.examSubjectId} data-label={report.subjects.find((s) => s.examSubjectId === cell.examSubjectId)?.subject.name}>
                    {cell.isAbsent ? 'Absent' : cell.marksObtained !== null ? cell.marksObtained : '—'}
                  </td>
                ))}
                <td data-label="Total">
                  {row.total.totalObtained !== null ? `${row.total.totalObtained}/${row.total.totalMax}` : '—'}
                </td>
                <td data-label="%">{row.total.percentage !== null ? `${row.total.percentage}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link to={`/exams/${examId}/schedules/${scheduleIdNum}`}>
        <button type="button" className="secondary">
          Back to schedule
        </button>
      </Link>
    </>
  );
}
