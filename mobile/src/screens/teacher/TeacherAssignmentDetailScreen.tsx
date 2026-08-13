import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, StyleSheet, Text, View } from 'react-native';
import {
  deleteHomeworkAssignment,
  deleteHomeworkAttachment,
  HomeworkSubmission,
  listHomeworkSubmissions,
  setHomeworkSubmission,
  uploadHomeworkAttachment,
} from '../../api/homework';
import { ApiError } from '../../api/client';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { ErrorView } from '../../components/ErrorView';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { Touchable } from '../../components/Touchable';
import { colors, fonts, spacing } from '../../theme';
import { formatBytes, formatDate } from '../../utils/format';
import { openAttachment } from '../../utils/download';
import type { TeacherAssignmentsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<TeacherAssignmentsStackParamList, 'AssignmentDetail'>;

export function TeacherAssignmentDetailScreen({ route, navigation }: Props): React.JSX.Element {
  const [assignment, setAssignment] = useState(route.params.assignment);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSubmissions(await listHomeworkSubmissions(assignment.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load submissions');
    } finally {
      setLoading(false);
    }
  }, [assignment.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDownload = async () => {
    if (!assignment.attachment) return;
    setDownloading(true);
    try {
      await openAttachment(`/assignments/${assignment.id}/attachment`, assignment.attachment.fileName);
    } catch {
      // A failed open isn't worth a persistent banner here — the user can just retry.
    } finally {
      setDownloading(false);
    }
  };

  const handleToggle = async (studentId: number, submitted: boolean) => {
    setTogglingId(studentId);
    try {
      const updated = await setHomeworkSubmission(assignment.id, studentId, { submitted: !submitted });
      setSubmissions((prev) => prev?.map((s) => (s.student.id === studentId ? updated : s)) ?? null);
    } catch {
      // Leave state as-is; the row's button remains actionable to retry.
    } finally {
      setTogglingId(null);
    }
  };

  const handlePickAttachment = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const picked = result.assets[0];

    setAttachmentError(null);
    setAttachmentBusy(true);
    try {
      const updated = await uploadHomeworkAttachment(assignment.id, {
        uri: picked.uri,
        name: picked.name,
        mimeType: picked.mimeType ?? 'application/octet-stream',
      });
      setAssignment(updated);
    } catch (err) {
      setAttachmentError(err instanceof ApiError ? err.message : 'Could not upload attachment');
    } finally {
      setAttachmentBusy(false);
    }
  };

  const handleRemoveAttachment = () => {
    Alert.alert('Remove attachment', 'Remove the attachment from this assignment?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setAttachmentError(null);
          setAttachmentBusy(true);
          try {
            const updated = await deleteHomeworkAttachment(assignment.id);
            setAssignment(updated);
          } catch (err) {
            setAttachmentError(err instanceof ApiError ? err.message : 'Could not remove attachment');
          } finally {
            setAttachmentBusy(false);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert('Delete assignment', `Delete "${assignment.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteHomeworkAssignment(assignment.id);
            navigation.goBack();
          } catch {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.title}>{assignment.title}</Text>
        <Text style={styles.muted}>{assignment.class.name} - {assignment.section.name} · {assignment.subject.name}</Text>
        <Text style={styles.due}>Due {formatDate(assignment.dueDate)}</Text>
      </Card>

      {assignment.description && (
        <Card>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.body}>{assignment.description}</Text>
        </Card>
      )}

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Attachment</Text>
        {attachmentError && <Text style={styles.error}>{attachmentError}</Text>}
        {assignment.attachment ? (
          <>
            <Text style={styles.body}>
              {assignment.attachment.fileName} ({formatBytes(assignment.attachment.size)})
            </Text>
            <Button label="Open attachment" variant="secondary" onPress={handleDownload} loading={downloading} />
            <Button
              label="Remove attachment"
              variant="secondary"
              onPress={handleRemoveAttachment}
              loading={attachmentBusy}
            />
          </>
        ) : (
          <>
            <Text style={styles.muted}>No attachment yet.</Text>
            <Button label="Add attachment" variant="secondary" onPress={handlePickAttachment} loading={attachmentBusy} />
          </>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Submissions</Text>
        {loading && <LoadingView />}
        {error && <ErrorView message={error} onRetry={load} />}
        {submissions?.map((s) => (
          <Touchable
            key={s.student.id}
            onPress={() => handleToggle(s.student.id, s.submitted)}
            disabled={togglingId === s.student.id}
          >
            <View style={styles.submissionRow}>
              <View>
                <Text style={styles.name}>{s.student.name}</Text>
                <Text style={styles.muted}>{s.student.admissionNo}</Text>
              </View>
              <Badge label={s.submitted ? 'Submitted' : 'Pending'} tone={s.submitted ? 'success' : 'warning'} />
            </View>
          </Touchable>
        ))}
      </Card>

      <Button label="Delete assignment" variant="danger" onPress={handleDelete} loading={deleting} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  title: { fontSize: 19, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  due: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  sectionTitle: { fontSize: 14, fontFamily: fonts.headingBold, color: colors.text },
  body: { fontSize: 14, fontFamily: fonts.body, color: colors.text, lineHeight: 20 },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  submissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { fontSize: 14, fontFamily: fonts.bodySemiBold, color: colors.text },
});
