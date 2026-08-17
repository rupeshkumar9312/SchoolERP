import { useCallback, useEffect, useState } from 'react';
import type { AttendanceRecord } from '../../api/attendance';
import { ApiError } from '../../api/client';
import type { Student } from '../../api/students';
import { listMyClassStudents, listStudents } from '../../api/students';
import { useAuth } from '../../auth/useAuth';
import { EmptyState } from '../../components/EmptyState';
import { TableSkeleton } from '../../components/Skeleton';

interface StudentAttendanceSearchProps {
  fetchHistory: (studentId: number) => Promise<AttendanceRecord[]>;
}

/** Search-any-student flow shared by the web "By student" tab. ADMIN-tier
 * hits the server-side /students search; a TEACHER (no student.view) filters
 * their own /students/my-classes roster client-side instead. */
export function StudentAttendanceSearch({ fetchHistory }: StudentAttendanceSearchProps) {
  const { hasPermission } = useAuth();
  const canSearchAll = hasPermission('student.view');

  const [query, setQuery] = useState('');
  const [myStudents, setMyStudents] = useState<Student[] | null>(null);
  const [results, setResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Student | null>(null);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (canSearchAll) return;
    void listMyClassStudents()
      .then(setMyStudents)
      .catch(() => setMyStudents([]));
  }, [canSearchAll]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }

    if (!canSearchAll) {
      const lower = q.toLowerCase();
      setResults(
        (myStudents ?? []).filter(
          (s) => s.name.toLowerCase().includes(lower) || (s.admissionNo?.toLowerCase().includes(lower) ?? false),
        ),
      );
      return;
    }

    setSearching(true);
    setSearchError(null);
    const handle = setTimeout(() => {
      listStudents({ search: q })
        .then(setResults)
        .catch((err) => setSearchError(err instanceof ApiError ? err.message : 'Search failed'))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [query, canSearchAll, myStudents]);

  const selectStudent = useCallback(
    async (student: Student) => {
      setSelected(student);
      setResults([]);
      setQuery('');
      setLoadingHistory(true);
      setHistoryError(null);
      try {
        setHistory(await fetchHistory(student.id));
      } catch (err) {
        setHistoryError(err instanceof ApiError ? err.message : 'Failed to load attendance history');
      } finally {
        setLoadingHistory(false);
      }
    },
    [fetchHistory],
  );

  return (
    <>
      <div className="filter-bar">
        <label className="field">
          <span>Search by name or admission no.</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing a student's name…"
            autoFocus
          />
        </label>
      </div>

      {searchError && (
        <div className="status down">
          <strong>Error</strong>
          <p>{searchError}</p>
        </div>
      )}

      {query.trim() && !selected && (
        <div className="card">
          {searching ? (
            <p className="muted">Searching…</p>
          ) : results.length === 0 ? (
            <EmptyState title="No students found" message="Try a different name or admission number." />
          ) : (
            <ul className="roster-list">
              {results.map((s) => (
                <li key={s.id} className="roster-row">
                  <div className="roster-name">
                    <strong>{s.name}</strong>
                    <span className="muted">
                      {' '}
                      {s.admissionNo && `· ${s.admissionNo} `}· {s.class.name} - {s.section.name}
                    </span>
                  </div>
                  <button type="button" className="secondary" onClick={() => void selectStudent(s)}>
                    View history
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && (
        <>
          <div className="card-head">
            <h2>{selected.name}</h2>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSelected(null);
                setHistory([]);
              }}
            >
              Search again
            </button>
          </div>
          <p className="subtitle">
            {selected.admissionNo && `${selected.admissionNo} · `}
            {selected.class.name} - {selected.section.name}
          </p>

          {historyError && (
            <div className="status down">
              <strong>Error</strong>
              <p>{historyError}</p>
            </div>
          )}

          {loadingHistory ? (
            <TableSkeleton columns={3} />
          ) : history.length === 0 ? (
            <EmptyState title="No attendance recorded" message="Nothing has been marked for this student yet." />
          ) : (
            <div className="card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Marked by</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => (
                    <tr key={record.id}>
                      <td data-label="Date">{record.date}</td>
                      <td data-label="Status">
                        <span className={`badge status-badge-${record.status.toLowerCase()}`}>
                          {record.status}
                        </span>
                      </td>
                      <td data-label="Marked by">{record.markedBy.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
