import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { TeacherExamEntry } from '../api/exams';
import { EXAM_TYPE_LABELS, listMyExams } from '../api/exams';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';

interface ExamGroup {
  exam: TeacherExamEntry['exam'];
  entries: TeacherExamEntry[];
}

// Grouped by the Exam umbrella (e.g. "Unit Test 1") rather than one flat row
// per class+section+subject — a teacher sees the umbrella once, with every
// class/section/subject they teach under it nested beneath.
function groupByExam(entries: TeacherExamEntry[]): ExamGroup[] {
  const groups = new Map<number, ExamGroup>();
  for (const entry of entries) {
    const existing = groups.get(entry.exam.id);
    if (existing) {
      existing.entries.push(entry);
    } else {
      groups.set(entry.exam.id, { exam: entry.exam, entries: [entry] });
    }
  }
  return [...groups.values()];
}

export function MyExamsPage() {
  const [entries, setEntries] = useState<TeacherExamEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMyExams()
      .then(setEntries)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load exams'));
  }, []);

  const groups = entries ? groupByExam(entries) : [];

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

      {!error && entries === null && <TableSkeleton columns={6} />}

      {entries !== null &&
        (groups.length === 0 ? (
          <EmptyState
            title="No exams yet"
            message="Ask an admin to set up an exam for a class you teach."
          />
        ) : (
          groups.map((group) => (
            <section className="card" key={group.exam.id}>
              <div className="card-head">
                <h2>{group.exam.name}</h2>
                <span className="badge">{EXAM_TYPE_LABELS[group.exam.type]}</span>
              </div>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Subject</th>
                    <th>Status</th>
                    <th>Marks entered</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map((e) => (
                    <tr key={`${e.schedule.id}-${e.examSubject.id}-${e.section.id}`}>
                      <td data-label="Class">{e.class.name}</td>
                      <td data-label="Section">{e.section.name}</td>
                      <td data-label="Subject">{e.examSubject.subjectName}</td>
                      <td data-label="Status">
                        <span className={`badge ${e.schedule.status === 'PUBLISHED' ? 'status-badge-present' : ''}`}>
                          {e.schedule.status === 'PUBLISHED' ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td data-label="Marks entered">
                        {e.enteredCount}/{e.totalStudents}
                      </td>
                      <td data-label="Actions">
                        <Link
                          to={`/exams/${e.exam.id}/schedules/${e.schedule.id}/marks?subjectId=${e.examSubject.subjectId}&sectionId=${e.section.id}`}
                        >
                          <button type="button">Enter marks</button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))
        ))}
    </>
  );
}
