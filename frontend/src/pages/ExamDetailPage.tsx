import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as academic from '../api/academic';
import { ApiError } from '../api/client';
import type { Exam, ExamSubjectProgress, ExamType } from '../api/exams';
import {
  EXAM_TYPE_LABELS,
  addExamSubject,
  getExam,
  getExamProgress,
  removeExamSubject,
  updateExam,
  updateExamSubject,
} from '../api/exams';
import { useAuth } from '../auth/useAuth';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';

const EXAM_TYPES: ExamType[] = ['CLASS_TEST', 'UNIT_TEST', 'MID_TERM', 'TERM_EXAM', 'FINAL_EXAM', 'OTHER'];

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

export function ExamDetailPage() {
  const { id } = useParams();
  const examId = Number(id);
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('exam.edit');
  const confirm = useConfirm();
  const toast = useToast();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingHeader, setEditingHeader] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState<ExamType>('UNIT_TEST');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [savingHeader, setSavingHeader] = useState(false);

  const [subjects, setSubjects] = useState<academic.Subject[]>([]);
  const [progress, setProgress] = useState<ExamSubjectProgress[]>([]);
  const [newSubjectId, setNewSubjectId] = useState('');
  const [newMaxMarks, setNewMaxMarks] = useState('');
  const [newPassMarks, setNewPassMarks] = useState('');
  const [newExamDate, setNewExamDate] = useState('');
  const [addingSubject, setAddingSubject] = useState(false);

  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [rowMaxMarks, setRowMaxMarks] = useState('');
  const [rowPassMarks, setRowPassMarks] = useState('');
  const [rowExamDate, setRowExamDate] = useState('');
  const [savingRowId, setSavingRowId] = useState<number | null>(null);
  const [removingRowId, setRemovingRowId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const row = await getExam(examId);
      setExam(row);
      setName(row.name);
      setType(row.type);
      setStartDate(toDateInputValue(row.startDate));
      setEndDate(toDateInputValue(row.endDate));
      setSubjects(await academic.listSubjects(row.class.id));
      setProgress(await getExamProgress(examId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load exam');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaveHeader = async (e: FormEvent) => {
    e.preventDefault();
    setSavingHeader(true);
    setError(null);
    try {
      const updated = await updateExam(examId, { name: name.trim(), type, startDate, endDate });
      setExam(updated);
      setEditingHeader(false);
      toast('Exam updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update exam');
    } finally {
      setSavingHeader(false);
    }
  };

  const availableSubjects = exam
    ? subjects.filter((s) => !exam.subjects.some((es) => es.subject.id === s.id))
    : [];

  const onAddSubject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSubjectId || !newMaxMarks) return;
    setAddingSubject(true);
    setError(null);
    try {
      const updated = await addExamSubject(examId, {
        subjectId: Number(newSubjectId),
        maxMarks: Number(newMaxMarks),
        passMarks: newPassMarks ? Number(newPassMarks) : undefined,
        examDate: newExamDate || undefined,
      });
      setExam(updated);
      setProgress(await getExamProgress(examId));
      setNewSubjectId('');
      setNewMaxMarks('');
      setNewPassMarks('');
      setNewExamDate('');
      toast('Subject added.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to add subject');
    } finally {
      setAddingSubject(false);
    }
  };

  const startEditRow = (row: Exam['subjects'][number]) => {
    setEditingRowId(row.id);
    setRowMaxMarks(String(row.maxMarks));
    setRowPassMarks(row.passMarks !== null ? String(row.passMarks) : '');
    setRowExamDate(row.examDate ? toDateInputValue(row.examDate) : '');
  };

  const onSaveRow = async (rowId: number) => {
    setSavingRowId(rowId);
    setError(null);
    try {
      const updated = await updateExamSubject(examId, rowId, {
        maxMarks: rowMaxMarks ? Number(rowMaxMarks) : undefined,
        passMarks: rowPassMarks ? Number(rowPassMarks) : undefined,
        examDate: rowExamDate || undefined,
      });
      setExam(updated);
      setEditingRowId(null);
      toast('Subject updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update subject');
    } finally {
      setSavingRowId(null);
    }
  };

  const onRemoveRow = async (row: Exam['subjects'][number]) => {
    const ok = await confirm({ title: `Remove ${row.subject.name}?`, confirmLabel: 'Remove' });
    if (!ok) return;
    setRemovingRowId(row.id);
    setError(null);
    try {
      const updated = await removeExamSubject(examId, row.id);
      setExam(updated);
      setProgress(await getExamProgress(examId));
      toast('Subject removed.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove subject');
    } finally {
      setRemovingRowId(null);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;
  if (!exam) return <p className="muted">Exam not found.</p>;

  return (
    <>
      <div className="card-head">
        <h1>{exam.name}</h1>
        <span className={`badge ${exam.status === 'PUBLISHED' ? 'status-badge-present' : ''}`}>
          {exam.status === 'PUBLISHED' ? 'Published' : 'Draft'}
        </span>
      </div>
      <p className="subtitle">
        {exam.class.name} · {exam.academicYear.name}
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
            <label className="field">
              <span>Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </label>
            <label className="field">
              <span>End date</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} required />
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
          <>
            <p>
              <strong>Type:</strong> {EXAM_TYPE_LABELS[exam.type]}
            </p>
            <p>
              <strong>Start date:</strong> {startDate}
            </p>
            <p>
              <strong>End date:</strong> {endDate}
            </p>
          </>
        )}
      </section>

      <section className="card">
        <h2>Subjects</h2>
        {exam.subjects.length === 0 ? (
          <p className="muted">No subjects yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Max marks</th>
                <th>Pass marks</th>
                <th>Paper date</th>
                <th>Marks entered</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {exam.subjects.map((row) => {
                const p = progress.find((x) => x.examSubjectId === row.id);
                return editingRowId === row.id ? (
                  <tr key={row.id}>
                    <td data-label="Subject">{row.subject.name}</td>
                    <td data-label="Max marks">
                      <input
                        type="number"
                        min={1}
                        value={rowMaxMarks}
                        onChange={(e) => setRowMaxMarks(e.target.value)}
                        style={{ width: '6rem' }}
                      />
                    </td>
                    <td data-label="Pass marks">
                      <input
                        type="number"
                        min={0}
                        value={rowPassMarks}
                        onChange={(e) => setRowPassMarks(e.target.value)}
                        style={{ width: '6rem' }}
                      />
                    </td>
                    <td data-label="Paper date">
                      <input type="date" value={rowExamDate} onChange={(e) => setRowExamDate(e.target.value)} />
                    </td>
                    <td data-label="Marks entered">{p ? `${p.enteredCount}/${p.totalStudents}` : '—'}</td>
                    <td data-label="Actions">
                      <div className="row-actions">
                        <button onClick={() => void onSaveRow(row.id)} disabled={savingRowId === row.id}>
                          {savingRowId === row.id ? 'Saving…' : 'Save'}
                        </button>
                        <button className="secondary" onClick={() => setEditingRowId(null)}>
                          Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={row.id}>
                    <td data-label="Subject">{row.subject.name}</td>
                    <td data-label="Max marks">{row.maxMarks}</td>
                    <td data-label="Pass marks">{row.passMarks ?? '—'}</td>
                    <td data-label="Paper date">{row.examDate ? toDateInputValue(row.examDate) : '—'}</td>
                    <td data-label="Marks entered">{p ? `${p.enteredCount}/${p.totalStudents}` : '—'}</td>
                    {canEdit && (
                      <td data-label="Actions">
                        <div className="row-actions">
                          <button className="secondary" onClick={() => startEditRow(row)}>
                            Edit
                          </button>
                          <button
                            className="danger"
                            onClick={() => void onRemoveRow(row)}
                            disabled={removingRowId === row.id}
                          >
                            {removingRowId === row.id ? 'Removing…' : 'Remove'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {canEdit && (
          <form onSubmit={(e) => void onAddSubject(e)} className="row-actions" style={{ marginTop: '1rem', flexWrap: 'wrap' }}>
            <select value={newSubjectId} onChange={(e) => setNewSubjectId(e.target.value)} required>
              <option value="" disabled>
                {availableSubjects.length === 0 ? 'No more subjects to add' : 'Select subject…'}
              </option>
              {availableSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              placeholder="Max marks"
              value={newMaxMarks}
              onChange={(e) => setNewMaxMarks(e.target.value)}
              style={{ width: '7rem' }}
              required
            />
            <input
              type="number"
              min={0}
              placeholder="Pass marks (optional)"
              value={newPassMarks}
              onChange={(e) => setNewPassMarks(e.target.value)}
              style={{ width: '10rem' }}
            />
            <input
              type="date"
              value={newExamDate}
              onChange={(e) => setNewExamDate(e.target.value)}
              title="Paper date (optional)"
            />
            <button type="submit" disabled={addingSubject || availableSubjects.length === 0}>
              {addingSubject ? 'Adding…' : '+ Add subject'}
            </button>
          </form>
        )}
      </section>

      <button type="button" className="secondary" onClick={() => navigate('/exams')}>
        Back to exams
      </button>
    </>
  );
}
