import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as academic from '../api/academic';
import { ApiError } from '../api/client';
import type { ExamSubjectInput, ExamType } from '../api/exams';
import { EXAM_TYPE_LABELS, createExam } from '../api/exams';

const EXAM_TYPES: ExamType[] = ['CLASS_TEST', 'UNIT_TEST', 'MID_TERM', 'TERM_EXAM', 'FINAL_EXAM', 'OTHER'];

interface SubjectRowDraft {
  subjectId: string;
  maxMarks: string;
  passMarks: string;
  examDate: string;
}

const emptyRow = (): SubjectRowDraft => ({ subjectId: '', maxMarks: '', passMarks: '', examDate: '' });

// Creates the Exam umbrella (name + type). Picking a class here is
// optional — if one's picked, its dates and subjects are sent along in the
// same request so single-class creation stays a one-step flow; if not,
// classes (each fully independent, with their own dates and subjects) are
// added afterwards from the exam's detail page via "+ Add class".
export function ExamFormPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [type, setType] = useState<ExamType>('UNIT_TEST');
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<academic.Subject[]>([]);
  const [rows, setRows] = useState<SubjectRowDraft[]>([emptyRow()]);

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

  const updateRow = (index: number, patch: Partial<SubjectRowDraft>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };
  const addRow = () => setRows((prev) => [...prev, emptyRow()]);
  const removeRow = (index: number) => setRows((prev) => prev.filter((_, i) => i !== index));
  const pickedSubjectIds = new Set(rows.map((r) => r.subjectId).filter(Boolean));

  // Class is optional here — an exam can be created with just a name and
  // type, and classes (each with their own dates and subjects) added
  // afterwards from the exam's detail page via "+ Add class". If a class
  // *is* picked on this form, though, its dates and at least one subject
  // are still required — a half-filled schedule isn't useful.
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!classId) {
      setSubmitting(true);
      try {
        const created = await createExam({ name: name.trim(), type });
        navigate(`/exams/${created.id}`);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to create exam');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!startDate || !endDate) {
      setError('Add a start and end date for the selected class, or clear the class to skip it for now.');
      return;
    }
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
      setError('Add at least one subject with a max marks value, or clear the class to skip it for now.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createExam({
        name: name.trim(),
        type,
        schedule: {
          classId: Number(classId),
          startDate,
          endDate,
          subjects: picked,
        },
      });
      navigate(`/exams/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create exam');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h1>New exam</h1>

      <form className="card" onSubmit={(e) => void onSubmit(e)}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Unit Test 1" required />
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

        <p className="muted">
          Optionally set up a class below — you can add this and other classes to the exam afterwards, each with
          its own dates and subjects, from the exam's page.
        </p>

        <label className="field">
          <span>Academic year</span>
          <select
            value={yearId}
            onChange={(e) => {
              setYearId(e.target.value);
              setClassId('');
              setRows([emptyRow()]);
            }}
          >
            <option value="">Select…</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Class (optional)</span>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setRows([emptyRow()]);
            }}
            disabled={!yearId}
          >
            <option value="">Select…</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Start date</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={!classId}
          />
        </label>

        <label className="field">
          <span>End date</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate || undefined}
            disabled={!classId}
          />
        </label>

        <div className="field">
          <span>Subjects</span>
          {!classId ? (
            <p className="muted">Select a class above to add its subjects now, or skip this and add it later.</p>
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

        {error && (
          <div className="status down">
            <strong>Couldn't create exam</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create exam'}
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/exams')}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
