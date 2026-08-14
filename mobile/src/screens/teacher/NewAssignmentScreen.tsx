import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { createHomeworkAssignment, uploadHomeworkAttachment } from '../../api/homework';
import { ApiError, PickedFile } from '../../api/client';
import { listMyAssignments, TeacherAssignment } from '../../api/teachers';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DateField } from '../../components/DateField';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SelectField } from '../../components/SelectField';
import { colors, fonts, radius, spacing } from '../../theme';
import { todayIsoDate } from '../../utils/format';
import type { TeacherAssignmentsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherAssignmentsStackParamList, 'NewAssignment'>;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function NewAssignmentScreen({ navigation }: Props): React.JSX.Element {
  const [options, setOptions] = useState<TeacherAssignment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selected, setSelected] = useState<TeacherAssignment | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(todayIsoDate());
  const [repeatWeeklyUntil, setRepeatWeeklyUntil] = useState('');
  const [attachment, setAttachment] = useState<PickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setOptions(await listMyAssignments());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'Could not load your classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handlePickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const picked = result.assets[0];
    setAttachment({ uri: picked.uri, name: picked.name, mimeType: picked.mimeType ?? 'application/octet-stream' });
  };

  const handleSubmit = async () => {
    setError(null);
    if (!selected) {
      setError('Choose a class and subject.');
      return;
    }
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    if (!DATE_PATTERN.test(dueDate)) {
      setError('Due date must be in YYYY-MM-DD format.');
      return;
    }
    if (repeatWeeklyUntil) {
      if (!DATE_PATTERN.test(repeatWeeklyUntil)) {
        setError('Repeat weekly until must be in YYYY-MM-DD format.');
        return;
      }
      if (repeatWeeklyUntil < dueDate) {
        setError('Repeat weekly until must be on or after the due date.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const created = await createHomeworkAssignment({
        title: title.trim(),
        description: description.trim() || undefined,
        classId: selected.class.id,
        sectionId: selected.section.id,
        subjectId: selected.subject.id,
        dueDate,
        repeatWeeklyUntil: repeatWeeklyUntil || undefined,
      });
      if (attachment) {
        await uploadHomeworkAttachment(created.id, attachment);
      }
      navigation.goBack();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create assignment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingView />;
  if (loadError || !options) return <Screen><ErrorView message={loadError ?? 'No data'} onRetry={load} /></Screen>;

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.heading}>New assignment</Text>

        <SelectField
          label="Class / Section / Subject"
          value={selected}
          onChange={setSelected}
          options={options.map((o) => ({
            value: o,
            label: `${o.class.name} - ${o.section.name} - ${o.subject.name}`,
          }))}
        />

        <View>
          <Text style={styles.label}>Title</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={colors.textMuted} />
        </View>

        <DateField label="Due date" value={dueDate} onChange={setDueDate} />

        <DateField
          label="Repeat weekly until (optional)"
          value={repeatWeeklyUntil}
          onChange={setRepeatWeeklyUntil}
          minimumDate={dueDate ? new Date(`${dueDate}T00:00:00`) : undefined}
        />

        <View>
          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View>
          <Text style={styles.label}>Attachment (optional)</Text>
          {attachment ? (
            <View style={styles.attachmentRow}>
              <Text style={styles.attachmentName} numberOfLines={1}>{attachment.name}</Text>
              <Button label="Remove" variant="secondary" onPress={() => setAttachment(null)} />
            </View>
          ) : (
            <Button label="Attach file" variant="secondary" onPress={handlePickAttachment} />
          )}
        </View>

        {error && <Text style={styles.error}>{error}</Text>}
        <Button label="Create assignment" onPress={handleSubmit} loading={submitting} />
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  attachmentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attachmentName: { flex: 1, fontSize: 14, fontFamily: fonts.body, color: colors.text },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
});
