import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  AudienceRole,
  createAnnouncement,
  removeAnnouncementImage,
  updateAnnouncement,
  uploadAnnouncementImage,
} from '../api/announcements';
import { ApiError, PickedFile } from '../api/client';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ImageViewerModal } from '../components/ImageViewerModal';
import { Screen } from '../components/Screen';
import { Touchable } from '../components/Touchable';
import { AUDIENCE_LABELS } from '../constants';
import { colors, fonts, radius, spacing } from '../theme';
import type { AnnouncementsStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AnnouncementsStackParamList, 'AnnouncementForm'>;

const ALL_AUDIENCES: AudienceRole[] = ['STUDENT', 'TEACHER', 'ADMIN'];
const IMAGE_MIME = 'image/*';

export function AnnouncementFormScreen({ route, navigation }: Props): React.JSX.Element {
  const existing = route.params?.announcement;
  const isEdit = !!existing;

  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [audiences, setAudiences] = useState<AudienceRole[]>(existing?.audiences ?? []);
  const [existingImageUrl, setExistingImageUrl] = useState(existing?.imageUrl ?? null);
  const [pickedImage, setPickedImage] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removingImage, setRemovingImage] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);

  const toggleAudience = (audience: AudienceRole) => {
    setAudiences((prev) => (prev.includes(audience) ? prev.filter((a) => a !== audience) : [...prev, audience]));
  };

  const handlePickImage = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: IMAGE_MIME, copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setPickedImage({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'image/jpeg' });
  };

  const handleRemoveExistingImage = async () => {
    if (!existing) return;
    setRemovingImage(true);
    setError(null);
    try {
      await removeAnnouncementImage(existing.id);
      setExistingImageUrl(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove image');
    } finally {
      setRemovingImage(false);
    }
  };

  const hasImage = !!(pickedImage ?? existingImageUrl);

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!body.trim() && !hasImage) {
      setError('Add a body or an image.');
      return;
    }
    if (audiences.length === 0) {
      setError('Select at least one audience.');
      return;
    }
    setSubmitting(true);
    try {
      const trimmedBody = body.trim();
      const saved =
        isEdit && existing
          ? // On edit, "" is sent explicitly to clear a body the user removed
            // (valid as long as the image stays attached).
            await updateAnnouncement(existing.id, { title: title.trim(), body: trimmedBody, audiences })
          : await createAnnouncement({ title: title.trim(), body: trimmedBody || undefined, audiences });
      if (pickedImage) {
        try {
          await uploadAnnouncementImage(saved.id, pickedImage);
        } catch (err) {
          // The announcement itself saved fine — an image upload failure
          // shouldn't strand the user re-submitting title/body/audiences.
          setError(
            `Announcement saved, but the image failed to upload: ${err instanceof ApiError ? err.message : 'unknown error'}`,
          );
          return;
        }
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
          <Text style={styles.label}>Body {hasImage ? '(optional)' : ''}</Text>
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

        <View>
          <Text style={styles.label}>Image {body.trim() ? '(optional)' : ''}</Text>
          {(pickedImage ?? existingImageUrl) && (
            <Touchable onPress={() => setViewerUri(pickedImage?.uri ?? existingImageUrl ?? null)}>
              <Image source={{ uri: pickedImage?.uri ?? existingImageUrl ?? undefined }} style={styles.imagePreview} />
            </Touchable>
          )}
          <View style={styles.imageActions}>
            <View style={styles.imageActionHalf}>
              <Button
                label={pickedImage || existingImageUrl ? 'Change image' : 'Pick image'}
                variant="secondary"
                onPress={() => void handlePickImage()}
              />
            </View>
            {existingImageUrl && !pickedImage && (
              <View style={styles.imageActionHalf}>
                <Button
                  label="Remove image"
                  variant="danger"
                  onPress={() => void handleRemoveExistingImage()}
                  loading={removingImage}
                />
              </View>
            )}
          </View>
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        <Button label={isEdit ? 'Save changes' : 'Post announcement'} onPress={handleSubmit} loading={submitting} />
      </Card>
      <ImageViewerModal uri={viewerUri} onClose={() => setViewerUri(null)} />
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
  imagePreview: {
    width: '100%',
    height: 160,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceHover,
    marginBottom: spacing.sm,
  },
  imageActions: { flexDirection: 'row', gap: spacing.sm },
  imageActionHalf: { flex: 1 },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
});
