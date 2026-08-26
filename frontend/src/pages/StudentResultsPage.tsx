import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { StudentExamResult } from '../api/exams';
import { EXAM_TYPE_LABELS, getMyExamResults } from '../api/exams';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';

export function StudentResultsPage() {
  const [results, setResults] = useState<StudentExamResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setResults(await getMyExamResults());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load results');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h1>My Results</h1>
      <p className="subtitle">Published exam results for your class.</p>

      {error && (
        <div className="status down">
          <strong>Couldn't load results</strong>
          <p>{error}</p>
        </div>
      )}

      {!error && results === null && <TableSkeleton columns={5} />}

      {results !== null &&
        (results.length === 0 ? (
          <EmptyState title="No results yet" message="Results appear here once your school publishes them." />
        ) : (
          results.map((r) => (
            <section className="card" key={r.schedule.id}>
              <div className="card-head">
                <h2>{r.exam.name}</h2>
                <span className="badge">{EXAM_TYPE_LABELS[r.exam.type]}</span>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Marks</th>
                    <th>Percentage</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {r.subjects.map((s) => (
                    <tr key={s.subject.id}>
                      <td data-label="Subject">{s.subject.name}</td>
                      <td data-label="Marks">
                        {s.isAbsent ? 'Absent' : s.marksObtained !== null ? `${s.marksObtained}/${s.maxMarks}` : '—'}
                      </td>
                      <td data-label="Percentage">{s.percentage !== null ? `${s.percentage}%` : '—'}</td>
                      <td data-label="Result">
                        {s.passed === null ? (
                          '—'
                        ) : (
                          <span className={`badge ${s.passed ? 'status-badge-present' : 'status-badge-absent'}`}>
                            {s.passed ? 'Pass' : 'Fail'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <p className="subtitle" style={{ marginTop: '0.75rem' }}>
                {r.summary.totalObtained !== null ? (
                  <>
                    <strong>Total:</strong> {r.summary.totalObtained}/{r.summary.totalMax} ({r.summary.percentage}%)
                    {r.summary.rank !== null && (
                      <>
                        {' · '}
                        <strong>Rank:</strong> {r.summary.rank} of {r.summary.totalStudents}
                      </>
                    )}
                  </>
                ) : (
                  'Total pending — not every subject has been graded yet.'
                )}
              </p>
            </section>
          ))
        ))}
    </>
  );
}
