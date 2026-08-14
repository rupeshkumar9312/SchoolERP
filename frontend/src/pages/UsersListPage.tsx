import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { Role } from '../api/roles';
import { listRoles } from '../api/roles';
import type { UserListItem } from '../api/users';
import { deleteUser, listUsers, resetUserPassword } from '../api/users';
import { useAuth } from '../auth/useAuth';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';
import { edvanceLoginAlias, sharePasswordResetViaWhatsApp } from '../utils/whatsapp';

export function UsersListPage() {
  const { state, hasPermission } = useAuth();
  const isSuperAdmin = state.status === 'authenticated' && state.user.role.name === 'SUPER_ADMIN';
  const confirm = useConfirm();
  const toast = useToast();
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [resettingId, setResettingId] = useState<number | null>(null);
  const [resetResult, setResetResult] = useState<
    { name: string; email: string; edvanceId: string; temporaryPassword: string } | null
  >(null);

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
    const ok = await confirm({
      title: `Delete ${user.name}?`,
      message: "This can't be undone.",
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setDeletingId(user.id);
    try {
      await deleteUser(user.id);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast(`${user.name} was deleted.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete user');
    } finally {
      setDeletingId(null);
    }
  };

  const onResetPassword = async (user: UserListItem) => {
    const ok = await confirm({
      title: `Reset ${user.name}'s password?`,
      message: 'A new temporary password will be generated, and they will be signed out of any active session.',
      confirmLabel: 'Reset password',
    });
    if (!ok) return;
    setResettingId(user.id);
    try {
      const { temporaryPassword } = await resetUserPassword(user.id);
      setResetResult({ name: user.name, email: user.email, edvanceId: user.edvanceId, temporaryPassword });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to reset password');
    } finally {
      setResettingId(null);
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
        <TableSkeleton columns={5} />
      ) : users.length === 0 ? (
        <EmptyState title="No users found" message="Try a different role filter, or create the first one." />
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Login ID</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                {(hasPermission('user.edit') || hasPermission('user.delete') || isSuperAdmin) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td data-label="Name">{user.name}</td>
                  <td data-label="Login ID">{user.email}</td>
                  <td data-label="Phone">{user.phone ?? '—'}</td>
                  <td data-label="Role">
                    <span className="role-chip">{user.role.name}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${user.isActive ? 'status-badge-present' : 'status-badge-inactive'}`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {(hasPermission('user.edit') || hasPermission('user.delete') || isSuperAdmin) && (
                    <td data-label="Actions">
                      <div className="row-actions">
                        {hasPermission('user.edit') && (
                          <Link to={`/users/${user.id}/edit`}>
                            <button className="secondary">Edit</button>
                          </Link>
                        )}
                        {hasPermission('user.delete') && (
                          <button className="danger" onClick={() => void onDelete(user)} disabled={deletingId === user.id}>
                            {deletingId === user.id ? 'Deleting…' : 'Delete'}
                          </button>
                        )}
                        {isSuperAdmin && (
                          <button
                            className="secondary"
                            onClick={() => void onResetPassword(user)}
                            disabled={resettingId === user.id}
                          >
                            {resettingId === user.id ? 'Resetting…' : 'Reset password'}
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

      {resetResult && (
        <div className="modal-backdrop" onClick={() => setResetResult(null)}>
          <div className="modal-card" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>Password reset</h3>
            <p>
              New temporary password for <strong>{resetResult.name}</strong> ({resetResult.email}). Copy this
              now — it can't be shown again after you leave this page.
            </p>
            <label className="field">
              <span>Temporary password</span>
              <input value={resetResult.temporaryPassword} readOnly onFocus={(e) => e.target.select()} />
            </label>
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  sharePasswordResetViaWhatsApp({
                    name: resetResult.name,
                    loginId: edvanceLoginAlias(resetResult.edvanceId),
                    password: resetResult.temporaryPassword,
                  })
                }
              >
                Share via WhatsApp
              </button>
              <button type="button" onClick={() => setResetResult(null)} autoFocus>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
