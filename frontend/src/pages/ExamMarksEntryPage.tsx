import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { ExamMarkRosterRow } from '../api/exams';
import { getExamMarksRoster, saveExamMarks } from '../api/exams';

interface Draft {
  marks: string;
  absent: boolean;
}

export function ExamMarksEntryPage() {
  const { id, scheduleId } = useParams();
  const examId = Number(id);
  const scheduleIdNum = Number(scheduleId);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const subjectId = Number(searchParams.get('subjectId'));
  const sectionId = Number(searchParams.get('sectionId'));

  const [roster, setRoster] = useState<ExamMarkRosterRow[]>([]);
  // Partial — a student only gets a draft entry once touched, either from an
  // already-saved mark or an explicit edit. Same "no default value" rule
  // attendance marking follows.
  const [drafts, setDrafts] = useState<Partial<Record<number, Draft>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSavedAt(null);
    try {
      const rows = await getExamMarksRoster(examId, scheduleIdNum, subjectId, sectionId);
      setRoster(rows);
      const next: Partial<Record<number, Draft>> = {};
      for (const row of rows) {
        if (row.marksObtained !== null || row.isAbsent) {
          next[row.student.id] = { marks: row.marksObtained !== null ? String(row.marksObtained) : '', absent: row.isAbsent };
        }
      }
      setDrafts(next);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load roster');
    } finally {
      setLoading(false);
    }
  }, [examId, scheduleIdNum, subjectId, sectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setDraft = (studentId: number, patch: Partial<Draft>) => {
    setDrafts((prev) => ({
      ...prev,
      [studentId]: { marks: prev[studentId]?.marks ?? '', absent: prev[studentId]?.absent ?? false, ...patch },
    }));
  };

  const touchedCount = roster.filter((r) => {
    const d = drafts[r.student.id];
    return d && (d.absent || d.marks !== '');
  }).length;

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const records = roster
        .filter((r) => {
          const d = drafts[r.student.id];
          return d && (d.absent || d.marks !== '');
        })
        .map((r) => {
          const d = drafts[r.student.id]!;
          return {
            studentId: r.student.id,
            isAbsent: d.absent,
            marksObtained: d.absent ? undefined : Number(d.marks),
          };
        });
      await saveExamMarks(examId, scheduleIdNum, { subjectId, sectionId, records });
      setSavedAt(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save marks');
    } finally {
      setSaving(false);
    }
  };

  if (!subjectId || !sectionId) {
    return <p className="muted">Missing subject or section — go back to My Exams and pick an entry.</p>;
  }

  return (
    <>
      <h1>Enter marks</h1>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}
      {savedAt && (
        <div className="status up">
          <strong>Saved</strong>
          <p>Marks saved at {savedAt}.</p>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading roster…</p>
      ) : roster.length === 0 ? (
        <p className="muted">No students in this class and section.</p>
      ) : (
        <section className="card">
          <div className="card-head">
            <h2>Roster ({roster.length})</h2>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Admission No.</th>
                <th>Student</th>
                <th>Marks</th>
                <th>Absent</th>
              </tr>
            </thead>
            <tbody>
              {roster.map((r) => {
                const d = drafts[r.student.id];
                return (
                  <tr key={r.student.id}>
                    <td data-label="Admission No.">{r.student.admissionNo ?? '—'}</td>
                    <td data-label="Student">{r.student.name}</td>
                    <td data-label="Marks">
                      <input
                        type="number"
                        min={0}
                        value={d?.marks ?? ''}
                        disabled={!!d?.absent}
                        onChange={(e) => setDraft(r.student.id, { marks: e.target.value })}
                        style={{ width: '6rem' }}
                      />
                    </td>
                    <td data-label="Absent">
                      <input
                        type="checkbox"
                        checked={d?.absent ?? false}
                        onChange={(e) => setDraft(r.student.id, { absent: e.target.checked })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div className="form-actions">
            <button onClick={() => void onSave()} disabled={saving || touchedCount === 0}>
              {saving ? 'Saving…' : 'Save marks'}
            </button>
            <span className="muted">
              {touchedCount} of {roster.length} entered
            </span>
            <button type="button" className="secondary" onClick={() => navigate('/my-exams')}>
              Back to my exams
            </button>
          </div>
        </section>
      )}
    </>
  );
}
