import type { FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Assignment } from '../api/teachers';
import { listMyAssignments } from '../api/teachers';
import { ApiError } from '../api/client';
import type { ExamSubjectInput } from '../api/exams';
import { createExam } from '../api/exams';
import { useToast } from '../components/useToast';

interface SubjectRowDraft {
  subjectId: string;
  maxMarks: string;
  passMarks: string;
  examDate: string;
}

const emptyRow = (): SubjectRowDraft => ({ subjectId: '', maxMarks: '', passMarks: '', examDate: '' });

// A teacher's self-serve path to a class test — scoped server-side to their
// own classes and, within a class, only the subjects they actually teach
// there (see ExamsService.assertTeacherTeachesClassSubjects). Unlike the
// admin "New exam" form, class + subjects are mandatory here: a teacher
// can't create a bare umbrella and add classes later, since they hold no
// exam.edit/exam.view to come back and finish the job.
export function NewClassTestPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [name, setName] = useState('');
  const [classId, setClassId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rows, setRows] = useState<SubjectRowDraft[]>([emptyRow()]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listMyAssignments()
      .then(setAssignments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your classes'));
  }, []);

  const myClasses = useMemo(() => {
    if (!assignments) return [];
    const byId = new Map<number, { id: number; name: string }>();
    for (const a of assignments) byId.set(a.class.id, a.class);
    return [...byId.values()];
  }, [assignments]);

  const mySubjectsInClass = useMemo(() => {
    if (!assignments || !classId) return [];
    const byId = new Map<number, { id: number; name: string }>();
    for (const a of assignments) {
      if (a.class.id === Number(classId)) byId.set(a.subject.id, a.subject);
    }
    return [...byId.values()];
  }, [assignments, classId]);

  const updateRow = (index: number, patch: Partial<SubjectRowDraft>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));
  const pickedSubjectIds = new Set(rows.map((r) => r.subjectId).filter(Boolean));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
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

    setSubmitting(true);
    try {
      await createExam({
        name: name.trim(),
        type: 'CLASS_TEST',
        schedule: { classId: Number(classId), startDate, endDate, subjects: picked },
      });
      toast('Class test created.');
      navigate('/my-exams');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create class test');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1>New class test</h1>
      <p className="subtitle">For a class and subjects you teach — you can only create class tests here.</p>

      <form className="card" onSubmit={(e) => void onSubmit(e)}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Class Test 1" required />
        </label>

        <label className="field">
          <span>Class</span>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setRows([emptyRow()]);
            }}
            required
          >
            <option value="" disabled>
              {myClasses.length === 0 ? 'No classes assigned to you yet' : 'Select…'}
            </option>
            {myClasses.map((c) => (
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
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate || undefined} required />
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
                    {mySubjectsInClass
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

        {error && (
          <div className="status down">
            <strong>Couldn't create class test</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create class test'}
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/my-exams')}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
