import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { StudentHomeworkAssignment } from '../api/homework';
import { downloadHomeworkAttachment, listMyHomeworkAssignments } from '../api/homework';
import { triggerBlobDownload } from '../api/students';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';

export function StudentAssignmentsPage() {
  const [assignments, setAssignments] = useState<StudentHomeworkAssignment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAssignments(await listMyHomeworkAssignments());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load assignments');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onDownloadAttachment = async (a: StudentHomeworkAssignment) => {
    if (!a.attachment) return;
    try {
      const blob = await downloadHomeworkAttachment(a.id);
      triggerBlobDownload(blob, a.attachment.fileName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download attachment');
    }
  };

  return (
    <>
      <h1>My Assignments</h1>
      <p className="subtitle">Homework set for your class, most recent first.</p>

      {error && (
        <div className="status down">
          <strong>Couldn't load assignments</strong>
          <p>{error}</p>
        </div>
      )}

      {!error && assignments === null && <TableSkeleton columns={5} />}

      {assignments !== null &&
        (assignments.length === 0 ? (
          <EmptyState title="No assignments yet" />
        ) : (
          <div className="card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Subject</th>
                  <th>Due date</th>
                  <th>Attachment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td data-label="Title">
                      {a.title}
                      {a.description && <p className="muted">{a.description}</p>}
                    </td>
                    <td data-label="Subject">{a.subject.name}</td>
                    <td data-label="Due date">{a.dueDate.slice(0, 10)}</td>
                    <td data-label="Attachment">
                      {a.attachment ? (
                        <button className="secondary" onClick={() => void onDownloadAttachment(a)}>
                          {a.attachment.fileName}
                        </button>
                      ) : (
                        <span className="muted">None</span>
                      )}
                    </td>
                    <td data-label="Status">
                      {a.submitted ? (
                        <span className="badge status-badge-present">Submitted</span>
                      ) : (
                        <span className="badge status-badge-absent">Not submitted</span>
                      )}
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
