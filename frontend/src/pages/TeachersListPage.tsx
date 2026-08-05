import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { Teacher } from '../api/teachers';
import { deleteTeacher, listTeachers } from '../api/teachers';
import { useAuth } from '../auth/useAuth';

export function TeachersListPage() {
  const { hasPermission } = useAuth();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTeachers(await listTeachers());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (teacher: Teacher) => {
    if (!window.confirm(`Delete ${teacher.name}? This removes their login too and can't be undone.`)) return;
    setDeletingId(teacher.id);
    try {
      await deleteTeacher(teacher.id);
      setTeachers((prev) => prev.filter((t) => t.id !== teacher.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete teacher');
    } finally {
      setDeletingId(null);
    }
  };

  const canEdit = hasPermission('teacher.edit');
  const canDelete = hasPermission('teacher.delete');
  const canAssign = hasPermission('teacher.assign');
  const showActions = canEdit || canDelete || canAssign;

  return (
    <>
      <div className="card-head">
        <h1>Teachers</h1>
        {hasPermission('teacher.create') && (
          <Link to="/teachers/new">
            <button>New teacher</button>
          </Link>
        )}
      </div>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : teachers.length === 0 ? (
        <p className="muted">No teachers yet.</p>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Qualification</th>
                <th>Joined</th>
                <th>Status</th>
                {showActions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr key={teacher.id}>
                  <td data-label="Name">{teacher.name}</td>
                  <td data-label="Email">{teacher.email}</td>
                  <td data-label="Phone">{teacher.phone ?? '—'}</td>
                  <td data-label="Qualification">{teacher.qualification ?? '—'}</td>
                  <td data-label="Joined">{new Date(teacher.joiningDate).toLocaleDateString()}</td>
                  <td data-label="Status">
                    <span className={`badge ${teacher.isActive ? 'status-badge-present' : 'status-badge-inactive'}`}>
                      {teacher.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {showActions && (
                    <td data-label="Actions">
                      <div className="row-actions">
                        {canAssign && (
                          <Link to={`/teachers/${teacher.id}/assignments`}>
                            <button className="secondary">Assignments</button>
                          </Link>
                        )}
                        {canEdit && (
                          <Link to={`/teachers/${teacher.id}/edit`}>
                            <button className="secondary">Edit</button>
                          </Link>
                        )}
                        {canDelete && (
                          <button className="danger" onClick={() => void onDelete(teacher)} disabled={deletingId === teacher.id}>
                            {deletingId === teacher.id ? 'Deleting…' : 'Delete'}
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
