import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, Text, View } from 'react-native';
import { Announcement, listAnnouncements } from '../api/announcements';
import { ApiError } from '../api/client';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { ErrorView } from '../components/ErrorView';
import { LoadingView } from '../components/LoadingView';
import { Screen } from '../components/Screen';
import { AUDIENCE_LABELS } from '../constants';
import { colors, fonts, spacing } from '../theme';
import { formatDate } from '../utils/format';

export function AnnouncementsScreen(): React.JSX.Element {
  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    try {
      setAnnouncements(await listAnnouncements());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load announcements');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading) return <LoadingView />;
  if (error) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <Text style={styles.heading}>Announcements</Text>
      {announcements && announcements.length === 0 && (
        <Card><Text style={styles.muted}>No announcements yet.</Text></Card>
      )}
      {announcements?.map((a) => (
        <Card key={a.id} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.title}>{a.title}</Text>
            <View style={styles.badgeRow}>
              {a.audiences.map((aud) => (
                <Badge key={aud} label={AUDIENCE_LABELS[aud]} tone="primary" />
              ))}
            </View>
          </View>
          <Text style={styles.body}>{a.body}</Text>
          <Text style={styles.muted}>
            {a.createdBy ? `Posted by ${a.createdBy.name}` : 'Posted'} on {formatDate(a.createdAt)}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  body: { fontSize: 14, fontFamily: fonts.body, color: colors.text, lineHeight: 20 },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
});
