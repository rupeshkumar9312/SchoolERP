import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LoginAuditEntry, LoginEvent, LoginPlatform, listLoginAudits } from '../../api/loginAudits';
import { ApiError } from '../../api/client';
import { MAX_ROSTER_PAGE_SIZE, PAGE_SIZE } from '../../api/pagination';
import { UserListItem, listUsers } from '../../api/users';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { colors, fonts, spacing } from '../../theme';
import { formatDateTime } from '../../utils/format';

const EVENT_LABELS: Record<LoginEvent, string> = {
  LOGIN: 'Login',
  REFRESH: 'Session resumed',
  LOGIN_FAILED: 'Failed attempt',
};

const EVENT_TONE: Record<LoginEvent, 'success' | 'warning' | 'danger'> = {
  LOGIN: 'success',
  REFRESH: 'warning',
  LOGIN_FAILED: 'danger',
};

const EVENT_OPTIONS: Array<{ value: LoginEvent; label: string }> = [
  { value: 'LOGIN', label: 'Login' },
  { value: 'REFRESH', label: 'Session resumed' },
  { value: 'LOGIN_FAILED', label: 'Failed attempt' },
];

const PLATFORM_OPTIONS: Array<{ value: LoginPlatform; label: string }> = [
  { value: 'WEB', label: 'Web' },
  { value: 'MOBILE', label: 'Mobile' },
];

export function LoginHistoryScreen(): React.JSX.Element {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [userId, setUserId] = useState<number | null>(null);
  const [event, setEvent] = useState<LoginEvent | null>(null);
  const [platform, setPlatform] = useState<LoginPlatform | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [entries, setEntries] = useState<LoginAuditEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Populates the "User" filter dropdown — needs every user, not one page
    // (see the same pattern in AuditLogScreen). Runs once on mount.
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
    setError(null);
    try {
      const result = await listLoginAudits({
        userId: userId ?? undefined,
        event: event ?? undefined,
        platform: platform ?? undefined,
        from: from.trim() || undefined,
        to: to.trim() || undefined,
        page: 1,
        limit: PAGE_SIZE,
      });
      setEntries(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load login history');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, event, platform, from, to]);

  const loadMore = async () => {
    if (!entries) return;
    setLoadingMore(true);
    try {
      const nextPage = Math.floor(entries.length / PAGE_SIZE) + 1;
      const result = await listLoginAudits({
        userId: userId ?? undefined,
        event: event ?? undefined,
        platform: platform ?? undefined,
        from: from.trim() || undefined,
        to: to.trim() || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      setEntries((prev) => [...(prev ?? []), ...result.items]);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more entries');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (error && !entries) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={load} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.heading}>Login History</Text>
        <Text style={styles.subtitle}>
          Who logged in, when, and from where — including sessions resumed without re-entering a password.
        </Text>
      </View>

      <Card style={styles.card}>
        <SelectField
          label="User"
          value={userId}
          onChange={setUserId}
          placeholder="All users"
          options={users.map((u) => ({ value: u.id, label: u.name }))}
        />
        <SelectField label="Event" value={event} onChange={setEvent} placeholder="All events" options={EVENT_OPTIONS} />
        <SelectField
          label="Platform"
          value={platform}
          onChange={setPlatform}
          placeholder="Web & mobile"
          options={PLATFORM_OPTIONS}
        />
        <DateField label="From" value={from} onChange={setFrom} maximumDate={to ? new Date(`${to}T00:00:00`) : undefined} />
        <DateField label="To" value={to} onChange={setTo} minimumDate={from ? new Date(`${from}T00:00:00`) : undefined} />
      </Card>

      {error && entries && <Text style={styles.error}>{error}</Text>}

      {entries && entries.length === 0 && (
        <Card>
          <Text style={styles.muted}>No login activity found. Try clearing your filters.</Text>
        </Card>
      )}

      {entries?.map((entry) => (
        <Card key={entry.id} style={styles.card}>
          <View style={styles.rowHead}>
            <Badge label={EVENT_LABELS[entry.event]} tone={EVENT_TONE[entry.event]} />
            <Text style={styles.platform}>{entry.platform === 'MOBILE' ? 'Mobile' : 'Web'}</Text>
          </View>
          <Text style={styles.user}>{entry.user?.name ?? entry.identifier}</Text>
          <Text style={styles.muted}>{formatDateTime(entry.createdAt)}</Text>
          {entry.failureReason && <Text style={styles.muted}>{entry.failureReason}</Text>}
          {entry.ipAddress && <Text style={styles.muted}>IP: {entry.ipAddress}</Text>}
          {entry.userAgent && (
            <Text style={styles.muted} numberOfLines={1}>
              {entry.userAgent}
            </Text>
          )}
        </Card>
      ))}

      {entries && entries.length > 0 && entries.length < total && (
        <Button label={`Load more (${entries.length} of ${total})`} variant="secondary" onPress={() => void loadMore()} loading={loadingMore} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  card: { gap: spacing.xs },
  rowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  platform: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  user: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.text },
});
