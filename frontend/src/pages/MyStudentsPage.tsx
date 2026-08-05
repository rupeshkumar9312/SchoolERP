import { useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { Student } from '../api/students';
import { listMyClassStudents } from '../api/students';

export function MyStudentsPage() {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyClassStudents()
      .then(setStudents)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load your students'));
  }, []);

  return (
    <>
      <h1>My Students</h1>
      <p className="subtitle">Read-only — students in classes assigned to you.</p>

      {error && (
        <div className="status down">
          <strong>Couldn't load your students</strong>
          <p>{error}</p>
        </div>
      )}

      {!error && students === null && <p className="muted">Loading…</p>}

      {students !== null &&
        (students.length === 0 ? (
          <p className="muted">No students in your assigned classes yet.</p>
        ) : (
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Admission No.</th>
                  <th>Name</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Guardian</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td data-label="Admission No.">{s.admissionNo}</td>
                    <td data-label="Name">{s.name}</td>
                    <td data-label="Class">{s.class.name}</td>
                    <td data-label="Section">{s.section.name}</td>
                    <td data-label="Guardian">{s.guardianName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </>
  );
}
