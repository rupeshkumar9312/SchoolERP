import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { ExamType } from '../api/exams';
import { EXAM_TYPE_LABELS, createExam } from '../api/exams';

const EXAM_TYPES: ExamType[] = ['CLASS_TEST', 'UNIT_TEST', 'MID_TERM', 'TERM_EXAM', 'FINAL_EXAM', 'OTHER'];

// Creates the Exam umbrella (name + type + an overall date window). Classes
// — each with their own independent dates and subjects — are added
// afterwards from the exam's detail page via "+ Add class".
export function ExamFormPage() {
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [type, setType] = useState<ExamType>('UNIT_TEST');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const created = await createExam({
        name: name.trim(),
        type,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
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

        <p className="muted">
          Add classes to this exam afterwards, each with its own dates and subjects, from the exam's page.
        </p>

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
