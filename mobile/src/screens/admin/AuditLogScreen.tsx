import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuditAction, AuditLogEntry, listAuditLogs } from '../../api/auditLogs';
import { ApiError } from '../../api/client';
import { MAX_ROSTER_PAGE_SIZE } from '../../api/pagination';
import { UserListItem, listUsers } from '../../api/users';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, radius, spacing } from '../../theme';
import { formatDateTime } from '../../utils/format';

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

const ACTION_TONE: Record<AuditAction, 'success' | 'warning' | 'danger'> = {
  CREATE: 'success',
  UPDATE: 'warning',
  DELETE: 'danger',
};

export function AuditLogScreen(): React.JSX.Element {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [entityType, setEntityType] = useState<string | null>(null);
  const [userId, setUserId] = useState<number | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [entries, setEntries] = useState<AuditLogEntry[] | null>(null);
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
    setError(null);
    try {
      setEntries(
        await listAuditLogs({
          entityType: entityType ?? undefined,
          userId: userId ?? undefined,
          from: from.trim() || undefined,
          to: to.trim() || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load audit logs');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityType, userId, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingView />;
  if (error && !entries) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View>
        <Text style={styles.heading}>Audit Log</Text>
        <Text style={styles.subtitle}>Accountability trail — who changed what, and when.</Text>
      </View>

      <Card style={styles.card}>
        <SelectField
          label="Entity type"
          value={entityType}
          onChange={setEntityType}
          placeholder="All types"
          options={ENTITY_TYPES.map((t) => ({ value: t, label: t }))}
        />
        <SelectField
          label="Actor"
          value={userId}
          onChange={setUserId}
          placeholder="All users"
          options={users.map((u) => ({ value: u.id, label: u.name }))}
        />
        <DateField label="From" value={from} onChange={setFrom} maximumDate={to ? new Date(`${to}T00:00:00`) : undefined} />
        <DateField label="To" value={to} onChange={setTo} minimumDate={from ? new Date(`${from}T00:00:00`) : undefined} />
      </Card>

      {error && entries && <Text style={styles.error}>{error}</Text>}

      {entries && entries.length === 0 && (
        <Card><Text style={styles.muted}>No audit entries found. Try clearing your filters.</Text></Card>
      )}

      {entries?.map((entry) => {
        const expanded = expandedId === entry.id;
        return (
          <Card key={entry.id} style={styles.card}>
            <View style={styles.rowHead}>
              <Badge label={entry.action} tone={ACTION_TONE[entry.action]} />
              <Text style={styles.entity}>
                {entry.entityType} #{entry.entityId}
              </Text>
            </View>
            <Text style={styles.muted}>{formatDateTime(entry.createdAt)}</Text>
            <Text style={styles.muted}>Actor: {entry.actor?.name ?? '—'}</Text>

            <Touchable style={styles.toggle} onPress={() => setExpandedId(expanded ? null : entry.id)}>
              <Text style={styles.toggleText}>{expanded ? 'Hide changes' : 'View changes'}</Text>
            </Touchable>

            {expanded && (
              <View style={styles.diff}>
                <View style={styles.diffCol}>
                  <Text style={styles.diffLabel}>Before</Text>
                  <Text style={styles.diffCode}>{JSON.stringify(entry.oldValues, null, 2) ?? 'null'}</Text>
                </View>
                <View style={styles.diffCol}>
                  <Text style={styles.diffLabel}>After</Text>
                  <Text style={styles.diffCode}>{JSON.stringify(entry.newValues, null, 2) ?? 'null'}</Text>
                </View>
              </View>
            )}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.textMuted, marginTop: 2 },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  card: { gap: spacing.sm },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  entity: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text },
  toggle: { alignSelf: 'flex-start', paddingVertical: spacing.xs },
  toggleText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.primary },
  diff: { gap: spacing.sm },
  diffCol: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: spacing.sm, gap: spacing.xs },
  diffLabel: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  diffCode: { fontSize: 11, fontFamily: fonts.body, color: colors.text },
});
