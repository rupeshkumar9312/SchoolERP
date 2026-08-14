import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { Role } from '../api/roles';
import { listRoles } from '../api/roles';
import { createUser, getUser, updateUser } from '../api/users';

export function UserFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [edvanceId, setEdvanceId] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLogin, setCreatedLogin] = useState<{ email: string; alias: string; temporaryPassword: string } | null>(null);

  useEffect(() => {
    void listRoles().then(setRoles);
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getUser(Number(id))
      .then((user) => {
        setName(user.name);
        setEmail(user.email);
        setEdvanceId(user.edvanceId);
        setPhone(user.phone ?? '');
        setRoleId(String(user.role.id));
        setIsActive(user.isActive);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load user'))
      .finally(() => setLoading(false));
  }, [id]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateUser(Number(id), {
          name,
          phone: phone || undefined,
          roleId: roleId ? Number(roleId) : undefined,
          isActive,
        });
        navigate('/users');
      } else {
        const created = await createUser({
          name,
          phone: phone || undefined,
          roleId: Number(roleId),
        });
        setCreatedLogin(created.login);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;

  if (createdLogin) {
    return (
      <>
        <h1>User created</h1>
        <div className="card">
          <p>
            A login was created automatically. Copy these credentials now — the password can't be
            shown again after you leave this page.
          </p>
          <label className="field">
            <span>Login email</span>
            <input value={createdLogin.email} readOnly onFocus={(e) => e.target.select()} />
          </label>
          <label className="field">
            <span>Short login ID (use this to sign in instead)</span>
            <input value={createdLogin.alias} readOnly onFocus={(e) => e.target.select()} />
          </label>
          <label className="field">
            <span>Temporary password</span>
            <input
              value={createdLogin.temporaryPassword}
              readOnly
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="form-actions">
            <button type="button" onClick={() => navigate('/users')}>
              Done
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{isEdit ? 'Edit user' : 'New user'}</h1>

      <form className="card" onSubmit={onSubmit}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        {isEdit && (
          <>
            <label className="field">
              <span>Login ID</span>
              <input value={email} readOnly disabled />
            </label>
            <label className="field">
              <span>Edvance ID</span>
              <input value={edvanceId} readOnly disabled />
            </label>
          </>
        )}

        <label className="field">
          <span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>

        <label className="field">
          <span>Role</span>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
            <option value="" disabled>
              Select a role
            </option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        {isEdit && (
          <label className="field field-checkbox">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Active</span>
          </label>
        )}

        {!isEdit && (
          <p className="muted">A login email and temporary password will be generated automatically.</p>
        )}

        {error && (
          <div className="status down">
            <strong>Couldn't save</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/users')}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
