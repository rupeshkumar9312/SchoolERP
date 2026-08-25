import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { TeacherExamEntry } from '../api/exams';
import { EXAM_TYPE_LABELS, listMyExams } from '../api/exams';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';

export function MyExamsPage() {
  const [entries, setEntries] = useState<TeacherExamEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyExams()
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load exams'));
  }, []);

  return (
    <>
      <h1>My Exams</h1>
      <p className="subtitle">Exams for the subjects and sections you teach.</p>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {!error && entries === null && <TableSkeleton columns={7} />}

      {entries !== null &&
        (entries.length === 0 ? (
          <EmptyState
            title="No exams yet"
            message="Ask an admin to set up an exam for a class you teach."
          />
        ) : (
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Type</th>
                  <th>Class</th>
                  <th>Section</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Marks entered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={`${e.exam.id}-${e.examSubject.id}-${e.section.id}`}>
                    <td data-label="Exam">{e.exam.name}</td>
                    <td data-label="Type">{EXAM_TYPE_LABELS[e.exam.type]}</td>
                    <td data-label="Class">{e.class.name}</td>
                    <td data-label="Section">{e.section.name}</td>
                    <td data-label="Subject">{e.examSubject.subjectName}</td>
                    <td data-label="Status">
                      <span className={`badge ${e.exam.status === 'PUBLISHED' ? 'status-badge-present' : ''}`}>
                        {e.exam.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td data-label="Marks entered">
                      {e.enteredCount}/{e.totalStudents}
                    </td>
                    <td data-label="Actions">
                      <Link
                        to={`/exams/${e.exam.id}/marks?subjectId=${e.examSubject.subjectId}&sectionId=${e.section.id}`}
                      >
                        <button type="button">Enter marks</button>
                      </Link>
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
