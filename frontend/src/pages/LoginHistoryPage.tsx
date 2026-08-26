import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import type { LoginAuditEntry, LoginEvent, LoginPlatform } from '../api/loginAudits';
import { listLoginAudits } from '../api/loginAudits';
import { MAX_ROSTER_PAGE_SIZE } from '../api/pagination';
import { listUsers, type UserListItem } from '../api/users';
import { EmptyState } from '../components/EmptyState';
import { Pager } from '../components/Pager';
import { TableSkeleton } from '../components/Skeleton';

const PAGE_SIZE = 25;

const EVENT_LABELS: Record<LoginEvent, string> = {
  LOGIN: 'Login',
  REFRESH: 'Session resumed',
  LOGIN_FAILED: 'Failed attempt',
};

const EVENT_BADGE: Record<LoginEvent, string> = {
  LOGIN: 'status-badge-present',
  REFRESH: 'status-badge-late',
  LOGIN_FAILED: 'status-badge-absent',
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function LoginHistoryPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [userId, setUserId] = useState('');
  const [event, setEvent] = useState('');
  const [platform, setPlatform] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [entries, setEntries] = useState<LoginAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Populates the "User" filter dropdown — needs every user, not one page
    // (see the same pattern in AuditLogsPage). Runs once on mount.
    void (async () => {
      const all: UserListItem[] = [];
      let userPage = 1;
      for (;;) {
        const result = await listUsers({ page: userPage, limit: MAX_ROSTER_PAGE_SIZE });
        all.push(...result.items);
        if (all.length >= result.total || result.items.length === 0) break;
        userPage += 1;
      }
      setUsers(all);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listLoginAudits({
        userId: userId ? Number(userId) : undefined,
        event: (event || undefined) as LoginEvent | undefined,
        platform: (platform || undefined) as LoginPlatform | undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setEntries(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load login history');
    } finally {
      setLoading(false);
    }
  }, [userId, event, platform, from, to, page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <h1>Login History</h1>
      <p className="subtitle">Who logged in, when, and from where — including sessions resumed without re-entering a password.</p>

      <div className="filter-bar">
        <label className="field">
          <span>User</span>
          <select
            value={userId}
            onChange={(e) => {
              setUserId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Event</span>
          <select
            value={event}
            onChange={(e) => {
              setEvent(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All events</option>
            <option value="LOGIN">Login</option>
            <option value="REFRESH">Session resumed</option>
            <option value="LOGIN_FAILED">Failed attempt</option>
          </select>
        </label>
        <label className="field">
          <span>Platform</span>
          <select
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Web &amp; mobile</option>
            <option value="WEB">Web</option>
            <option value="MOBILE">Mobile</option>
          </select>
        </label>
        <label className="field">
          <span>From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field">
          <span>To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <TableSkeleton columns={6} />
      ) : entries.length === 0 ? (
        <EmptyState title="No login activity found" message="Try clearing your filters." />
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>Platform</th>
                <th>User</th>
                <th>IP address</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td data-label="When">{formatTimestamp(entry.createdAt)}</td>
                  <td data-label="Event">
                    <span className={`badge ${EVENT_BADGE[entry.event]}`}>{EVENT_LABELS[entry.event]}</span>
                    {entry.failureReason && <p className="muted">{entry.failureReason}</p>}
                  </td>
                  <td data-label="Platform">{entry.platform === 'MOBILE' ? 'Mobile' : 'Web'}</td>
                  <td data-label="User">{entry.user?.name ?? entry.identifier}</td>
                  <td data-label="IP address">{entry.ipAddress ?? '—'}</td>
                  <td data-label="Device" title={entry.userAgent ?? undefined}>
                    {entry.userAgent ? (entry.userAgent.length > 40 ? `${entry.userAgent.slice(0, 37)}…` : entry.userAgent) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      )}
    </>
  );
}
