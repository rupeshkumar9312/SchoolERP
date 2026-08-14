import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AudienceRole, createAnnouncement, updateAnnouncement } from '../api/announcements';
import { ApiError } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Screen } from '../components/Screen';
import { Touchable } from '../components/Touchable';
import { AUDIENCE_LABELS } from '../constants';
import { colors, fonts, radius, spacing } from '../theme';
import type { AnnouncementsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AnnouncementsStackParamList, 'AnnouncementForm'>;

const ALL_AUDIENCES: AudienceRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];

export function AnnouncementFormScreen({ route, navigation }: Props): React.JSX.Element {
  const existing = route.params?.announcement;
  const isEdit = !!existing;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [audiences, setAudiences] = useState<AudienceRole[]>(existing?.audiences ?? []);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggleAudience = (audience: AudienceRole) => {
    setAudiences((prev) => (prev.includes(audience) ? prev.filter((a) => a !== audience) : [...prev, audience]));
  };

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim() || !body.trim()) {
      setError('Title and body are required.');
      return;
    }
    if (audiences.length === 0) {
      setError('Select at least one audience.');
      return;
    }
    setSubmitting(true);
    try {
      if (isEdit && existing) {
        await updateAnnouncement(existing.id, { title: title.trim(), body: body.trim(), audiences });
      } else {
        await createAnnouncement({ title: title.trim(), body: body.trim(), audiences });
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save announcement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.heading}>{isEdit ? 'Edit announcement' : 'New announcement'}</Text>

        <View>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={colors.textMuted} />
        </View>

        <View>
          <Text style={styles.label}>Body</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={body}
            onChangeText={setBody}
            multiline
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View>
          <Text style={styles.label}>Visible to</Text>
          <View style={styles.audienceRow}>
            {ALL_AUDIENCES.map((audience) => {
              const active = audiences.includes(audience);
              return (
                <Touchable
                  key={audience}
                  onPress={() => toggleAudience(audience)}
                  rippleColor={colors.primaryTint}
                  hitSlop={8}
                  style={[styles.audienceChip, active && styles.audienceChipActive]}
                >
                  <Text style={[styles.audienceChipText, active && styles.audienceChipTextActive]}>
                    {AUDIENCE_LABELS[audience]}
                  </Text>
                </Touchable>
              );
            })}
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        <Button label={isEdit ? 'Save changes' : 'Post announcement'} onPress={handleSubmit} loading={submitting} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  heading: { fontSize: 18, fontFamily: fonts.headingBold, color: colors.text },
  label: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted, marginBottom: spacing.xs },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  // Explicit margins instead of `gap` — `gap` on a flexWrap row has shown up
  // before as visually-correct-but-untappable on Android (the paint position
  // updates but the native touch-hit rect doesn't always follow), while
  // margin never has that class of bug.
  audienceRow: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -spacing.sm, marginBottom: -spacing.sm },
  audienceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  audienceChipActive: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  audienceChipText: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  audienceChipTextActive: { color: colors.primary },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
});
