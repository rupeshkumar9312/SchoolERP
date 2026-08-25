import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as academic from '../api/academic';
import { ApiError } from '../api/client';
import type { Exam, ExamSchedule, ExamSubjectProgress } from '../api/exams';
import {
  addExamSubject,
  getExam,
  getExamProgress,
  publishExamSchedule,
  removeExamSubject,
  unpublishExamSchedule,
  updateExamSchedule,
  updateExamSubject,
} from '../api/exams';
import { useAuth } from '../auth/useAuth';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// One class's sitting of an Exam — its own dates and subject list, fully
// independent of every other class scheduled under the same exam. This is
// the old flat-model ExamDetailPage's subjects table, moved one level down.
export function ExamSchedulePage() {
  const { id, scheduleId } = useParams();
  const examId = Number(id);
  const scheduleIdNum = Number(scheduleId);
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('exam.edit');
  const canPublish = hasPermission('exam.marks.publish');
  const confirm = useConfirm();
  const toast = useToast();

  const [togglingPublish, setTogglingPublish] = useState(false);

  const [exam, setExam] = useState<Exam | null>(null);
  const [schedule, setSchedule] = useState<ExamSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingDates, setEditingDates] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [savingDates, setSavingDates] = useState(false);

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
      const sch = row.schedules.find((s) => s.id === scheduleIdNum) ?? null;
      setSchedule(sch);
      if (sch) {
        setStartDate(toDateInputValue(sch.startDate));
        setEndDate(toDateInputValue(sch.endDate));
        setSubjects(await academic.listSubjects(sch.class.id));
        setProgress(await getExamProgress(examId, scheduleIdNum));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load schedule');
    } finally {
      setLoading(false);
    }
  }, [examId, scheduleIdNum]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSaveDates = async (e: FormEvent) => {
    e.preventDefault();
    setSavingDates(true);
    setError(null);
    try {
      const updated = await updateExamSchedule(examId, scheduleIdNum, { startDate, endDate });
      setExam(updated);
      setSchedule(updated.schedules.find((s) => s.id === scheduleIdNum) ?? null);
      setEditingDates(false);
      toast('Dates updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update dates');
    } finally {
      setSavingDates(false);
    }
  };

  const availableSubjects = schedule
    ? subjects.filter((s) => !schedule.subjects.some((es) => es.subject.id === s.id))
    : [];

  const applyUpdatedExam = (updated: Exam) => {
    setExam(updated);
    setSchedule(updated.schedules.find((s) => s.id === scheduleIdNum) ?? null);
  };

  const onTogglePublish = async () => {
    if (!schedule) return;
    const publishing = schedule.status !== 'PUBLISHED';
    if (publishing) {
      const ok = await confirm({
        title: 'Publish this class\'s marks?',
        message: 'Students in this class will immediately be able to see every subject\'s marks entered so far.',
        confirmLabel: 'Publish',
      });
      if (!ok) return;
    }
    setTogglingPublish(true);
    setError(null);
    try {
      const updated = publishing
        ? await publishExamSchedule(examId, scheduleIdNum)
        : await unpublishExamSchedule(examId, scheduleIdNum);
      applyUpdatedExam(updated);
      toast(publishing ? 'Published — students can now see these marks.' : 'Unpublished.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update publish status');
    } finally {
      setTogglingPublish(false);
    }
  };

  const onAddSubject = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSubjectId || !newMaxMarks) return;
    setAddingSubject(true);
    setError(null);
    try {
      const updated = await addExamSubject(examId, scheduleIdNum, {
        subjectId: Number(newSubjectId),
        maxMarks: Number(newMaxMarks),
        passMarks: newPassMarks ? Number(newPassMarks) : undefined,
        examDate: newExamDate || undefined,
      });
      applyUpdatedExam(updated);
      setProgress(await getExamProgress(examId, scheduleIdNum));
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

  const startEditRow = (row: ExamSchedule['subjects'][number]) => {
    setEditingRowId(row.id);
    setRowMaxMarks(String(row.maxMarks));
    setRowPassMarks(row.passMarks !== null ? String(row.passMarks) : '');
    setRowExamDate(row.examDate ? toDateInputValue(row.examDate) : '');
  };

  const onSaveRow = async (rowId: number) => {
    setSavingRowId(rowId);
    setError(null);
    try {
      const updated = await updateExamSubject(examId, scheduleIdNum, rowId, {
        maxMarks: rowMaxMarks ? Number(rowMaxMarks) : undefined,
        passMarks: rowPassMarks ? Number(rowPassMarks) : undefined,
        examDate: rowExamDate || undefined,
      });
      applyUpdatedExam(updated);
      setEditingRowId(null);
      toast('Subject updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update subject');
    } finally {
      setSavingRowId(null);
    }
  };

  const onRemoveRow = async (row: ExamSchedule['subjects'][number]) => {
    const ok = await confirm({ title: `Remove ${row.subject.name}?`, confirmLabel: 'Remove' });
    if (!ok) return;
    setRemovingRowId(row.id);
    setError(null);
    try {
      const updated = await removeExamSubject(examId, scheduleIdNum, row.id);
      applyUpdatedExam(updated);
      setProgress(await getExamProgress(examId, scheduleIdNum));
      toast('Subject removed.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove subject');
    } finally {
      setRemovingRowId(null);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;
  if (!exam || !schedule) return <p className="muted">Schedule not found.</p>;

  return (
    <>
      <div className="card-head">
        <h1>
          {exam.name} · {schedule.class.name}
        </h1>
        <div className="row-actions">
          <span className={`badge ${schedule.status === 'PUBLISHED' ? 'status-badge-present' : ''}`}>
            {schedule.status === 'PUBLISHED' ? 'Published' : 'Draft'}
          </span>
          {canPublish && (
            <button
              type="button"
              className={schedule.status === 'PUBLISHED' ? 'secondary' : ''}
              onClick={() => void onTogglePublish()}
              disabled={togglingPublish}
            >
              {togglingPublish
                ? 'Saving…'
                : schedule.status === 'PUBLISHED'
                  ? 'Unpublish'
                  : 'Publish'}
            </button>
          )}
        </div>
      </div>
      <p className="subtitle">
        {schedule.academicYear.name}
        {schedule.createdBy ? ` · Added by ${schedule.createdBy.name}` : ''}
      </p>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      <section className="card">
        <div className="card-head">
          <h2>Dates</h2>
          {canEdit && !editingDates && (
            <button type="button" className="secondary" onClick={() => setEditingDates(true)}>
              Edit
            </button>
          )}
        </div>

        {editingDates ? (
          <form onSubmit={(e) => void onSaveDates(e)}>
            <label className="field">
              <span>Start date</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </label>
            <label className="field">
              <span>End date</span>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} required />
            </label>
            <div className="form-actions">
              <button type="submit" disabled={savingDates}>
                {savingDates ? 'Saving…' : 'Save'}
              </button>
              <button type="button" className="secondary" onClick={() => setEditingDates(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p>
            <strong>Dates:</strong> {startDate} – {endDate}
          </p>
        )}
      </section>

      <section className="card">
        <h2>Subjects</h2>
        {schedule.subjects.length === 0 ? (
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
              {schedule.subjects.map((row) => {
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

      <Link to={`/exams/${examId}`}>
        <button type="button" className="secondary">
          Back to {exam.name}
        </button>
      </Link>
    </>
  );
}
