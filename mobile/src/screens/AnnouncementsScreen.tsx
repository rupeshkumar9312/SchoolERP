import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';
import { Announcement, deleteAnnouncement, listAnnouncements } from '../api/announcements';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ErrorView } from '../components/ErrorView';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { LoadingView } from '../components/LoadingView';
import { Screen } from '../components/Screen';
import { Touchable } from '../components/Touchable';
import { AUDIENCE_LABELS } from '../constants';
import { colors, fonts, radius, spacing } from '../theme';
import { formatDate } from '../utils/format';
import type { AnnouncementsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AnnouncementsStackParamList, 'AnnouncementsList'>;

export function AnnouncementsScreen({ navigation }: Props): React.JSX.Element {
  const { user, hasPermission } = useAuth();
  const canCreate = hasPermission('announcement.create');
  const canEdit = hasPermission('announcement.edit');
  const canDelete = hasPermission('announcement.delete');
  const canManage = canCreate || canEdit || canDelete;
  // Holding the permission is necessary but not sufficient — only the
  // creator or a super admin may act on a *specific* announcement (matches
  // the server-side check in AnnouncementsService.assertMayModify).
  const canModify = (a: Announcement) =>
    !!user && (user.role.name === 'SUPER_ADMIN' || user.id === a.createdBy?.id);

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

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

  const handleDelete = (a: Announcement) => {
    Alert.alert('Delete announcement', `Delete "${a.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingId(a.id);
          try {
            await deleteAnnouncement(a.id);
            setAnnouncements((prev) => (prev ?? []).filter((x) => x.id !== a.id));
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not delete announcement');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingView />;
  if (error && !announcements) return <Screen><ErrorView message={error} onRetry={load} /></Screen>;

  return (
    <Screen refreshing={loading} onRefresh={load}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Announcements</Text>
        {canCreate && (
          <Button label="+ New" onPress={() => navigation.navigate('AnnouncementForm', undefined)} />
        )}
      </View>

      {error && announcements && <Text style={styles.error}>{error}</Text>}

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
          {a.body && <Text style={styles.body}>{a.body}</Text>}
          {a.imageUrl && (
            <Touchable onPress={() => setViewerUri(a.imageUrl)} rippleColor={colors.primaryTint}>
              <Image source={{ uri: a.imageUrl }} style={styles.image} resizeMode="cover" />
            </Touchable>
          )}
          <Text style={styles.muted}>
            {a.createdBy ? `Posted by ${a.createdBy.name}` : 'Posted'} on {formatDate(a.createdAt)}
          </Text>

          {canManage && canModify(a) && (
            <View style={styles.actions}>
              {canEdit && (
                <View style={styles.actionHalf}>
                  <Button
                    label="Edit"
                    variant="secondary"
                    onPress={() => navigation.navigate('AnnouncementForm', { announcement: a })}
                  />
                </View>
              )}
              {canDelete && (
                <View style={styles.actionHalf}>
                  <Button
                    label="Delete"
                    variant="danger"
                    onPress={() => handleDelete(a)}
                    loading={deletingId === a.id}
                  />
                </View>
              )}
            </View>
          )}
        </Card>
      ))}
      <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  card: { gap: spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  title: { flex: 1, fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  body: { fontSize: 14, fontFamily: fonts.body, color: colors.text, lineHeight: 20 },
  image: { width: '100%', height: 180, borderRadius: radius.md, backgroundColor: colors.surfaceHover },
  badgeRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end' },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionHalf: { flex: 1 },
});
