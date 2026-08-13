import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Screen } from '../../components/Screen';
import { colors, fonts, spacing } from '../../theme';
import { formatBytes, formatDate } from '../../utils/format';
import { openAttachment } from '../../utils/download';
import type { StudentAssignmentsStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<StudentAssignmentsStackParamList, 'AssignmentDetail'>;

export function StudentAssignmentDetailScreen({ route }: Props): React.JSX.Element {
  const { assignment } = route.params;
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownload = async () => {
    if (!assignment.attachment) return;
    setDownloadError(null);
    setDownloading(true);
    try {
      await openAttachment(`/assignments/${assignment.id}/attachment`, assignment.attachment.fileName);
    } catch {
      setDownloadError('Could not open the attachment.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Screen>
      <Card style={styles.card}>
        <Text style={styles.title}>{assignment.title}</Text>
        <Text style={styles.muted}>{assignment.subject.name} · {assignment.teacher.name}</Text>
        <Badge label={assignment.submitted ? 'Submitted' : 'Pending'} tone={assignment.submitted ? 'success' : 'warning'} />
        <Text style={styles.due}>Due {formatDate(assignment.dueDate)}</Text>
      </Card>

      {assignment.description && (
        <Card>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.body}>{assignment.description}</Text>
        </Card>
      )}

      {assignment.attachment && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Attachment</Text>
          <Text style={styles.body}>
            {assignment.attachment.fileName} ({formatBytes(assignment.attachment.size)})
          </Text>
          {downloadError && <Text style={styles.error}>{downloadError}</Text>}
          <Button label="Open attachment" variant="secondary" onPress={handleDownload} loading={downloading} />
        </Card>
      )}
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
});
