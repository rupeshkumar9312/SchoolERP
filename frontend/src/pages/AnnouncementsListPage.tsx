import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Announcement } from '../api/announcements';
import { AUDIENCE_LABELS, deleteAnnouncement, listAnnouncements } from '../api/announcements';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/useAuth';
import { EmptyState } from '../components/EmptyState';
import { Pager } from '../components/Pager';
import { TableSkeleton } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';

const PAGE_SIZE = 25;

export function AnnouncementsListPage() {
  const { state, hasPermission } = useAuth();
  const currentUser = state.status === 'authenticated' ? state.user : null;
  const canManage = hasPermission('announcement.create') || hasPermission('announcement.edit') || hasPermission('announcement.delete');
  // Holding the permission is necessary but not sufficient — only the
  // creator or a super admin may act on a *specific* announcement (matches
  // the server-side check in AnnouncementsService.assertMayModify).
  const canModify = (a: Announcement) =>
    !!currentUser && (currentUser.role.name === 'SUPER_ADMIN' || currentUser.id === a.createdBy?.id);
  const confirm = useConfirm();
  const toast = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await listAnnouncements({ page, limit: PAGE_SIZE });
      setAnnouncements(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load announcements');
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (announcement: Announcement) => {
    const ok = await confirm({
      title: `Delete "${announcement.title}"?`,
      message: "This can't be undone.",
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setDeletingId(announcement.id);
    try {
      await deleteAnnouncement(announcement.id);
      setAnnouncements((prev) => (prev ?? []).filter((a) => a.id !== announcement.id));
      setTotal((prev) => prev - 1);
      toast('Announcement deleted.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete announcement');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="card-head">
        <h1>Announcements</h1>
        {hasPermission('announcement.create') && (
          <Link to="/announcements/new">
            <button>New announcement</button>
          </Link>
        )}
      </div>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {!error && announcements === null && <TableSkeleton columns={4} />}

      {announcements !== null &&
        (announcements.length === 0 ? (
          <EmptyState title="No announcements yet" />
        ) : (
          <>
            {announcements.map((a) => (
              <div key={a.id} className="card">
                <div className="card-head">
                  <h2>{a.title}</h2>
                  <div className="row-actions">
                    {a.audiences.map((audience) => (
                      <span key={audience} className="badge">
                        {AUDIENCE_LABELS[audience]}
                      </span>
                    ))}
                  </div>
                </div>
                {a.body && <p>{a.body}</p>}
                {a.imageUrl && (
                  <img
                    src={a.imageUrl}
                    alt=""
                    style={{ width: '100%', maxHeight: 320, objectFit: 'cover', borderRadius: 8 }}
                  />
                )}
                <p className="muted">
                  {a.createdBy ? `Posted by ${a.createdBy.name}` : 'Posted'} on{' '}
                  {new Date(a.createdAt).toLocaleDateString()}
                </p>
                {canManage && canModify(a) && (
                  <div className="row-actions">
                    {hasPermission('announcement.edit') && (
                      <Link to={`/announcements/${a.id}/edit`}>
                        <button className="secondary">Edit</button>
                      </Link>
                    )}
                    {hasPermission('announcement.delete') && (
                      <button
                        className="danger"
                        onClick={() => void onDelete(a)}
                        disabled={deletingId === a.id}
                      >
                        {deletingId === a.id ? 'Deleting…' : 'Delete'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
          </>
        ))}
    </>
  );
}
