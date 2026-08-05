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
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          email,
          phone: phone || undefined,
          roleId: roleId ? Number(roleId) : undefined,
          isActive,
        });
      } else {
        await createUser({
          name,
          email,
          phone: phone || undefined,
          password,
          roleId: Number(roleId),
        });
      }
      navigate('/users');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>{isEdit ? 'Edit user' : 'New user'}</h1>

      <form className="card" onSubmit={onSubmit}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        <label className="field">
          <span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>

        {!isEdit && (
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
        )}

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
