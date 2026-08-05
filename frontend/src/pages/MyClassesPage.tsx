import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { Assignment } from '../api/teachers';
import { listMyAssignments } from '../api/teachers';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';

export function MyClassesPage() {
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyAssignments()
      .then(setAssignments)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your classes'));
  }, []);

  return (
    <>
      <h1>My Classes</h1>
      <p className="subtitle">Classes, sections and subjects assigned to you.</p>

      {error && (
        <div className="status down">
          <strong>Couldn't load your classes</strong>
          <p>{error}</p>
        </div>
      )}

      {!error && assignments === null && <TableSkeleton columns={4} />}

      {assignments !== null &&
        (assignments.length === 0 ? (
          <EmptyState title="No assigned classes yet" />
        ) : (
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Class teacher?</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Class">{a.class.name}</td>
                    <td data-label="Section">{a.section.name}</td>
                    <td data-label="Subject">{a.subject.name}</td>
                    <td data-label="Class teacher?">
                      {a.isClassTeacher ? <span className="badge">Yes</span> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}
