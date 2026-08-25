import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as academic from '../api/academic';
import { ApiError } from '../api/client';
import type { Exam, ExamScheduleStatus, ExamType } from '../api/exams';
import { EXAM_TYPE_LABELS, deleteExam, listExams } from '../api/exams';
import { useAuth } from '../auth/useAuth';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';

const EXAM_TYPES: ExamType[] = ['CLASS_TEST', 'UNIT_TEST', 'MID_TERM', 'TERM_EXAM', 'FINAL_EXAM', 'OTHER'];

export function ExamsListPage() {
  const { hasPermission } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();

  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setExams(
        await listExams({
          academicYearId: yearId ? Number(yearId) : undefined,
          classId: classId ? Number(classId) : undefined,
          type: (type || undefined) as ExamType | undefined,
          status: (status || undefined) as ExamScheduleStatus | undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load exams');
    } finally {
      setLoading(false);
    }
  }, [yearId, classId, type, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (exam: Exam) => {
    const ok = await confirm({
      title: `Delete "${exam.name}"?`,
      message: "This can't be undone.",
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setDeletingId(exam.id);
    try {
      await deleteExam(exam.id);
      setExams((prev) => prev.filter((e) => e.id !== exam.id));
      toast('Exam deleted.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete exam');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="card-head">
        <h1>Exams</h1>
        {hasPermission('exam.create') && (
          <Link to="/exams/new">
            <button type="button">New exam</button>
          </Link>
        )}
      </div>
      <p className="subtitle">Class tests, unit tests and term exams across the school.</p>

      <div className="filter-bar">
        <label className="field">
          <span>Academic year</span>
          <select
            value={yearId}
            onChange={(e) => {
              setYearId(e.target.value);
              setClassId('');
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
          <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!yearId}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {EXAM_TYPES.map((t) => (
              <option key={t} value={t}>
                {EXAM_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <TableSkeleton columns={4} />
      ) : exams.length === 0 ? (
        <EmptyState title="No exams found" message="Try clearing your filters, or create the first one." />
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Classes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((e) => (
                <tr key={e.id}>
                  <td data-label="Name">
                    <Link to={`/exams/${e.id}`}>{e.name}</Link>
                  </td>
                  <td data-label="Type">{EXAM_TYPE_LABELS[e.type]}</td>
                  <td data-label="Classes">
                    {e.schedules.length === 0 ? (
                      <span className="muted">None yet</span>
                    ) : (
                      e.schedules.map((s) => (
                        <span key={s.id} className="badge" style={{ marginRight: '0.3rem' }}>
                          {s.class.name}
                        </span>
                      ))
                    )}
                  </td>
                  <td data-label="Actions">
                    <div className="row-actions">
                      <Link to={`/exams/${e.id}`}>
                        <button type="button" className="secondary">
                          Manage
                        </button>
                      </Link>
                      {hasPermission('exam.delete') && (
                        <button
                          className="danger"
                          onClick={() => void onDelete(e)}
                          disabled={deletingId === e.id}
                        >
                          {deletingId === e.id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
