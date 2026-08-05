import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { createTeacher, getTeacher, updateTeacher } from '../api/teachers';

export function TeacherFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [qualification, setQualification] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTeacher(Number(id))
      .then((teacher) => {
        setName(teacher.name);
        setEmail(teacher.email);
        setPhone(teacher.phone ?? '');
        setQualification(teacher.qualification ?? '');
        setJoiningDate(teacher.joiningDate.slice(0, 10));
        setIsActive(teacher.isActive);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load teacher'))
      .finally(() => setLoading(false));
  }, [id]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateTeacher(Number(id), {
          name,
          email,
          phone: phone || undefined,
          qualification: qualification || undefined,
          joiningDate: joiningDate || undefined,
          isActive,
        });
      } else {
        await createTeacher({
          name,
          email,
          phone: phone || undefined,
          password,
          qualification: qualification || undefined,
          joiningDate,
        });
      }
      navigate('/teachers');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save teacher');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>{isEdit ? 'Edit teacher' : 'New teacher'}</h1>

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
          <span>Qualification</span>
          <input
            value={qualification}
            onChange={(e) => setQualification(e.target.value)}
            placeholder="e.g. M.Sc Mathematics"
          />
        </label>

        <label className="field">
          <span>Joining date</span>
          <input
            type="date"
            value={joiningDate}
            onChange={(e) => setJoiningDate(e.target.value)}
            required
          />
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
          <button type="button" className="secondary" onClick={() => navigate('/teachers')}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
