import { Fragment, useCallback, useEffect, useState } from 'react';
import { listAuditLogs, type AuditAction, type AuditLogEntry } from '../api/auditLogs';
import { ApiError } from '../api/client';
import { MAX_ROSTER_PAGE_SIZE } from '../api/pagination';
import { listUsers, type UserListItem } from '../api/users';
import { EmptyState } from '../components/EmptyState';
import { TableSkeleton } from '../components/Skeleton';

const ENTITY_TYPES = [
  'Student',
  'Teacher',
  'TeacherAssignment',
  'User',
  'StudentAttendance',
  'TeacherAttendance',
  'Assignment',
  'AssignmentSubmission',
];

const ACTION_BADGE: Record<AuditAction, string> = {
  CREATE: 'status-badge-present',
  UPDATE: 'status-badge-late',
  DELETE: 'status-badge-absent',
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function AuditLogsPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [entityType, setEntityType] = useState('');
  const [userId, setUserId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    // Populates the actor-filter dropdown — needs every user, not one page,
    // and a school can have more of them than a single page holds (the
    // backend caps a page at MAX_ROSTER_PAGE_SIZE), so page through until
    // exhausted. Runs once on mount, not a hot path.
    void (async () => {
      const all: UserListItem[] = [];
      let page = 1;
      for (;;) {
        const result = await listUsers({ page, limit: MAX_ROSTER_PAGE_SIZE });
        all.push(...result.items);
        if (all.length >= result.total || result.items.length === 0) break;
        page += 1;
      }
      setUsers(all);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(
        await listAuditLogs({
          entityType: entityType || undefined,
          userId: userId ? Number(userId) : undefined,
          from: from || undefined,
          to: to || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [entityType, userId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h1>Audit Log</h1>
      <p className="subtitle">Accountability trail — who changed what, and when.</p>

      <div className="filter-bar">
        <label className="field">
          <span>Entity type</span>
          <select value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All types</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Actor</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>From</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>To</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <TableSkeleton columns={5} />
      ) : entries.length === 0 ? (
        <EmptyState title="No audit entries found" message="Try clearing your filters." />
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor</th>
                <th>Changes</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <Fragment key={entry.id}>
                  <tr>
                    <td data-label="When">{formatTimestamp(entry.createdAt)}</td>
                    <td data-label="Action">
                      <span className={`badge ${ACTION_BADGE[entry.action]}`}>{entry.action}</span>
                    </td>
                    <td data-label="Entity">
                      {entry.entityType} #{entry.entityId}
                    </td>
                    <td data-label="Actor">{entry.actor?.name ?? '—'}</td>
                    <td data-label="Changes">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      >
                        {expandedId === entry.id ? 'Hide' : 'View'}
                      </button>
                    </td>
                  </tr>
                  {expandedId === entry.id && (
                    <tr>
                      <td colSpan={5}>
                        <div className="audit-diff">
                          <div>
                            <h3>Before</h3>
                            <pre>{JSON.stringify(entry.oldValues, null, 2) ?? 'null'}</pre>
                          </div>
                          <div>
                            <h3>After</h3>
                            <pre>{JSON.stringify(entry.newValues, null, 2) ?? 'null'}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
