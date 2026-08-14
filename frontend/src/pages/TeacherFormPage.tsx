import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import { createTeacher, getTeacher, updateTeacher } from '../api/teachers';
import { shareCredentialsViaWhatsApp } from '../utils/whatsapp';

export function TeacherFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [edvanceId, setEdvanceId] = useState('');
  const [phone, setPhone] = useState('');
  const [qualification, setQualification] = useState('');
  const [joiningDate, setJoiningDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLogin, setCreatedLogin] = useState<{ email: string; alias: string; temporaryPassword: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTeacher(Number(id))
      .then((teacher) => {
        setName(teacher.name);
        setEmail(teacher.email);
        setEdvanceId(teacher.edvanceId);
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
          phone: phone || undefined,
          qualification: qualification || undefined,
          joiningDate: joiningDate || undefined,
          isActive,
        });
        navigate('/teachers');
      } else {
        const created = await createTeacher({
          name,
          phone: phone || undefined,
          qualification: qualification || undefined,
          joiningDate,
        });
        setCreatedLogin(created.login);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save teacher');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;

  if (createdLogin) {
    return (
      <>
        <h1>Teacher added</h1>
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
            <button
              type="button"
              className="secondary"
              onClick={() =>
                shareCredentialsViaWhatsApp({
                  name,
                  loginId: createdLogin.alias,
                  password: createdLogin.temporaryPassword,
                })
              }
            >
              Share via WhatsApp
            </button>
            <button type="button" onClick={() => navigate('/teachers')}>
              Done
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{isEdit ? 'Edit teacher' : 'New teacher'}</h1>

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
          <button type="button" className="secondary" onClick={() => navigate('/teachers')}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
