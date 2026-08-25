import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as academic from '../api/academic';
import { ApiError } from '../api/client';
import type { Exam, ExamSubjectInput, ExamType } from '../api/exams';
import { EXAM_TYPE_LABELS, addExamSchedule, deleteExamSchedule, getExam, updateExam } from '../api/exams';
import { useAuth } from '../auth/useAuth';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';

const EXAM_TYPES: ExamType[] = ['CLASS_TEST', 'UNIT_TEST', 'MID_TERM', 'TERM_EXAM', 'FINAL_EXAM', 'OTHER'];

interface SubjectRowDraft {
  subjectId: string;
  maxMarks: string;
  passMarks: string;
  examDate: string;
}

const emptyRow = (): SubjectRowDraft => ({ subjectId: '', maxMarks: '', passMarks: '', examDate: '' });

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// The exam umbrella page: name/type header + a "Class schedules" table, one
// row per independent ExamSchedule ("+ Add class" schedules another class
// with its own dates and subject list). Each row's "Manage" link opens
// ExamSchedulePage for that one class's subject management.
export function ExamDetailPage() {
  const { id } = useParams();
  const examId = Number(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('exam.edit');
  const canCreate = hasPermission('exam.create');
  const canDelete = hasPermission('exam.delete');
  const confirm = useConfirm();
  const toast = useToast();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingHeader, setEditingHeader] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ExamType>('UNIT_TEST');
  const [savingHeader, setSavingHeader] = useState(false);

  const [addingClass, setAddingClass] = useState(false);
  const [submittingClass, setSubmittingClass] = useState(false);
  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<academic.Subject[]>([]);
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState<SubjectRowDraft[]>([emptyRow()]);

  const [removingScheduleId, setRemovingScheduleId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getExam(examId);
      setExam(row);
      setName(row.name);
      setType(row.type);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load exam');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setSubjects([]);
      return;
    }
    void academic.listSubjects(Number(classId)).then(setSubjects);
  }, [classId]);

  const onSaveHeader = async (e: FormEvent) => {
    e.preventDefault();
    setSavingHeader(true);
    setError(null);
    try {
      const updated = await updateExam(examId, { name: name.trim(), type });
      setExam(updated);
      setEditingHeader(false);
      toast('Exam updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update exam');
    } finally {
      setSavingHeader(false);
    }
  };

  const scheduledClassIds = new Set((exam?.schedules ?? []).map((s) => s.class.id));
  const availableClasses = classes.filter((c) => !scheduledClassIds.has(c.id));

  const resetClassForm = () => {
    setYearId('');
    setClassId('');
    setStartDate('');
    setEndDate('');
    setRows([emptyRow()]);
  };

  const updateRow = (index: number, patch: Partial<SubjectRowDraft>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));
  const pickedSubjectIds = new Set(rows.map((r) => r.subjectId).filter(Boolean));

  const onAddClass = async (e: FormEvent) => {
    e.preventDefault();
    if (!classId || !startDate || !endDate) return;
    const picked: ExamSubjectInput[] = [];
    for (const row of rows) {
      if (!row.subjectId || !row.maxMarks) continue;
      picked.push({
        subjectId: Number(row.subjectId),
        maxMarks: Number(row.maxMarks),
        passMarks: row.passMarks ? Number(row.passMarks) : undefined,
        examDate: row.examDate || undefined,
      });
    }
    if (picked.length === 0) {
      setError('Add at least one subject with a max marks value.');
      return;
    }

    setSubmittingClass(true);
    setError(null);
    try {
      const updated = await addExamSchedule(examId, {
        classId: Number(classId),
        startDate,
        endDate,
        subjects: picked,
      });
      setExam(updated);
      setAddingClass(false);
      resetClassForm();
      toast('Class added to exam.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add class');
    } finally {
      setSubmittingClass(false);
    }
  };

  const onRemoveSchedule = async (schedule: Exam['schedules'][number]) => {
    const ok = await confirm({
      title: `Remove ${schedule.class.name} from this exam?`,
      message: 'This deletes its dates, subjects and any marks entered for it.',
      confirmLabel: 'Remove',
    });
    if (!ok) return;
    setRemovingScheduleId(schedule.id);
    setError(null);
    try {
      const updated = await deleteExamSchedule(examId, schedule.id);
      setExam(updated);
      toast('Class removed from exam.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove class');
    } finally {
      setRemovingScheduleId(null);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;
  if (!exam) return <p className="muted">Exam not found.</p>;

  return (
    <>
      <div className="card-head">
        <h1>{exam.name}</h1>
      </div>
      <p className="subtitle">
        {EXAM_TYPE_LABELS[exam.type]}
        {exam.createdBy ? ` · Created by ${exam.createdBy.name}` : ''}
      </p>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Details</h2>
          {canEdit && !editingHeader && (
            <button type="button" className="secondary" onClick={() => setEditingHeader(true)}>
              Edit
            </button>
          )}
        </div>

        {editingHeader ? (
          <form onSubmit={(e) => void onSaveHeader(e)}>
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              <span>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as ExamType)}>
                {EXAM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EXAM_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-actions">
              <button type="submit" disabled={savingHeader}>
                {savingHeader ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="secondary" onClick={() => setEditingHeader(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p>
            <strong>Type:</strong> {EXAM_TYPE_LABELS[exam.type]}
          </p>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Class schedules</h2>
          {canCreate && !addingClass && (
            <button type="button" onClick={() => setAddingClass(true)}>
              + Add class
            </button>
          )}
        </div>

        {exam.schedules.length === 0 ? (
          <p className="muted">No classes scheduled yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Academic year</th>
                <th>Dates</th>
                <th>Status</th>
                <th>Subjects</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exam.schedules.map((s) => (
                <tr key={s.id}>
                  <td data-label="Class">{s.class.name}</td>
                  <td data-label="Academic year">{s.academicYear.name}</td>
                  <td data-label="Dates">
                    {toDateInputValue(s.startDate)} – {toDateInputValue(s.endDate)}
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${s.status === 'PUBLISHED' ? 'status-badge-present' : ''}`}>
                      {s.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td data-label="Subjects">{s.subjects.length}</td>
                  <td data-label="Actions">
                    <div className="row-actions">
                      <Link to={`/exams/${examId}/schedules/${s.id}`}>
                        <button type="button" className="secondary">
                          Manage
                        </button>
                      </Link>
                      {canDelete && (
                        <button
                          className="danger"
                          onClick={() => void onRemoveSchedule(s)}
                          disabled={removingScheduleId === s.id}
                        >
                          {removingScheduleId === s.id ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {addingClass && (
          <form onSubmit={(e) => void onAddClass(e)} style={{ marginTop: '1rem' }}>
            <label className="field">
              <span>Academic year</span>
              <select
                value={yearId}
                onChange={(e) => {
                  setYearId(e.target.value);
                  setClassId('');
                  setRows([emptyRow()]);
                }}
                required
              >
                <option value="" disabled>
                  Select…
                </option>
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
                  setRows([emptyRow()]);
                }}
                disabled={!yearId}
                required
              >
                <option value="" disabled>
                  {yearId && availableClasses.length === 0 ? 'Every class already scheduled' : 'Select…'}
                </option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </label>

            <label className="field">
              <span>End date</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || undefined}
                required
              />
            </label>

            <div className="field">
              <span>Subjects</span>
              {!classId ? (
                <p className="muted">Select a class first.</p>
              ) : (
                <>
                  {rows.map((row, i) => (
                    <div key={i} className="row-actions" style={{ marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      <select value={row.subjectId} onChange={(e) => updateRow(i, { subjectId: e.target.value })}>
                        <option value="">Select subject…</option>
                        {subjects
                          .filter((s) => String(s.id) === row.subjectId || !pickedSubjectIds.has(String(s.id)))
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        placeholder="Max marks"
                        value={row.maxMarks}
                        onChange={(e) => updateRow(i, { maxMarks: e.target.value })}
                        style={{ width: '7rem' }}
                      />
                      <input
                        type="number"
                        min={0}
                        placeholder="Pass marks (optional)"
                        value={row.passMarks}
                        onChange={(e) => updateRow(i, { passMarks: e.target.value })}
                        style={{ width: '10rem' }}
                      />
                      <input
                        type="date"
                        value={row.examDate}
                        onChange={(e) => updateRow(i, { examDate: e.target.value })}
                        title="Paper date (optional)"
                      />
                      {rows.length > 1 && (
                        <button type="button" className="danger" onClick={() => removeRow(i)}>
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="secondary" onClick={addRow}>
                    + Add subject
                  </button>
                </>
              )}
            </div>

            <div className="form-actions">
              <button type="submit" disabled={submittingClass}>
                {submittingClass ? 'Adding…' : 'Add class'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setAddingClass(false);
                  resetClassForm();
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      <button type="button" className="secondary" onClick={() => navigate('/exams')}>
        Back to exams
      </button>
    </>
  );
}
