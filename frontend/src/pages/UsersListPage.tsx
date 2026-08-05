import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { Role } from '../api/roles';
import { listRoles } from '../api/roles';
import type { UserListItem } from '../api/users';
import { deleteUser, listUsers } from '../api/users';
import { useAuth } from '../auth/useAuth';

export function UsersListPage() {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const roleId = roleFilter ? Number(roleFilter) : undefined;
      const [userRows, roleRows] = await Promise.all([listUsers(roleId), roles.length ? Promise.resolve(roles) : listRoles()]);
      setUsers(userRows);
      if (!roles.length) setRoles(roleRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (user: UserListItem) => {
    if (!window.confirm(`Delete ${user.name}? This can't be undone.`)) return;
    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="card-head">
        <h1>Users</h1>
        {hasPermission('user.create') && (
          <Link to="/users/new">
            <button>New user</button>
          </Link>
        )}
      </div>

      <div className="field field-inline">
        <span>Filter by role</span>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : users.length === 0 ? (
        <p className="muted">No users found.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              {(hasPermission('user.edit') || hasPermission('user.delete')) && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td data-label="Name">{user.name}</td>
                <td data-label="Email">{user.email}</td>
                <td data-label="Phone">{user.phone ?? '—'}</td>
                <td data-label="Role">{user.role.name}</td>
                <td data-label="Status">{user.isActive ? 'Active' : 'Inactive'}</td>
                {(hasPermission('user.edit') || hasPermission('user.delete')) && (
                  <td data-label="Actions">
                    <div className="row-actions">
                      {hasPermission('user.edit') && (
                        <Link to={`/users/${user.id}/edit`}>
                          <button>Edit</button>
                        </Link>
                      )}
                      {hasPermission('user.delete') && (
                        <button onClick={() => void onDelete(user)} disabled={deletingId === user.id}>
                          {deletingId === user.id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
