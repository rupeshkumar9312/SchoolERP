import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { AudienceRole } from '../api/announcements';
import { AUDIENCE_LABELS, createAnnouncement, getAnnouncement, updateAnnouncement } from '../api/announcements';
import { ApiError } from '../api/client';

const ALL_AUDIENCES: AudienceRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];

export function AnnouncementFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audiences, setAudiences] = useState<AudienceRole[]>([]);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getAnnouncement(Number(id))
      .then((a) => {
        setTitle(a.title);
        setBody(a.body);
        setAudiences(a.audiences);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load announcement'))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleAudience = (audience: AudienceRole) => {
    setAudiences((prev) =>
      prev.includes(audience) ? prev.filter((a) => a !== audience) : [...prev, audience],
    );
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (audiences.length === 0) {
      setError('Select at least one audience.');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit) {
        await updateAnnouncement(Number(id), { title, body, audiences });
      } else {
        await createAnnouncement({ title, body, audiences });
      }
      navigate('/announcements');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>{isEdit ? 'Edit announcement' : 'New announcement'}</h1>

      <form className="card" onSubmit={onSubmit}>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </label>

        <label className="field">
          <span>Body</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} required />
        </label>

        <div className="field">
          <span>Visible to</span>
          {ALL_AUDIENCES.map((audience) => (
            <label key={audience} className="field-checkbox">
              <input
                type="checkbox"
                checked={audiences.includes(audience)}
                onChange={() => toggleAudience(audience)}
              />
              <span>{AUDIENCE_LABELS[audience]}</span>
            </label>
          ))}
        </div>

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
          <button type="button" className="secondary" onClick={() => navigate('/announcements')}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
