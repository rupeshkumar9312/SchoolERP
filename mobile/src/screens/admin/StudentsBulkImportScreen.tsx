import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { StyleSheet, Text, View } from 'react-native';
import { ApiError, PickedFile } from '../../api/client';
import { BulkImportResult, bulkImportStudents } from '../../api/students';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataRowText } from '../../components/DataRow';
import { Screen } from '../../components/Screen';
import { colors, fonts, spacing } from '../../theme';
import { openAttachment, shareBase64File } from '../../utils/download';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'StudentsBulkImport'>;

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export function StudentsBulkImportScreen({ navigation }: Props): React.JSX.Element {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const handlePickFile = async () => {
    const picked = await DocumentPicker.getDocumentAsync({ type: XLSX_MIME, copyToCacheDirectory: true });
    if (picked.canceled || !picked.assets?.[0]) return;
    const asset = picked.assets[0];
    setFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? XLSX_MIME });
    setResult(null);
    setError(null);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setError(null);
    try {
      await openAttachment('/students/bulk-import/template', 'student-import-template.xlsx');
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Could not download template');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await bulkImportStudents(file);
      setResult(res);
      setFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not import students');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFailures = async () => {
    if (!result?.failuresWorkbookBase64) return;
    setError(null);
    try {
      await shareBase64File(result.failuresWorkbookBase64, 'student-import-failures.xlsx');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not share failures workbook');
    }
  };

  return (
    <Screen>
      <Text style={styles.heading}>Bulk import students</Text>
      <Text style={styles.subtitle}>
        Upload an .xlsx file to admit many students at once. Class and Section are matched by name against the
        current academic year.
      </Text>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>1. Get the template</Text>
        <Text style={styles.muted}>Download the template to see the expected columns and formats.</Text>
        <Button
          label={downloadingTemplate ? 'Downloading…' : 'Download template'}
          variant="secondary"
          onPress={handleDownloadTemplate}
          loading={downloadingTemplate}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle}>2. Upload your file</Text>
        <Button label={file ? file.name : 'Choose .xlsx file'} variant="secondary" onPress={handlePickFile} />
        {error && <Text style={styles.error}>{error}</Text>}
        <Button label={uploading ? 'Importing…' : 'Import students'} onPress={handleUpload} disabled={!file || uploading} loading={uploading} />
      </Card>

      {result && (
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Import summary</Text>
          <View style={styles.badgeRow}>
            <Badge label={`${result.totalRows} rows read`} tone="muted" />
            <Badge label={`${result.successCount} imported`} tone="success" />
            {result.failureCount > 0 && <Badge label={`${result.failureCount} failed`} tone="danger" />}
          </View>

          {result.failureCount > 0 && (
            <>
              <Text style={styles.muted}>
                Some rows could not be imported. Share the failed rows below, fix the issues, and re-upload just
                those rows.
              </Text>
              {result.failuresWorkbookBase64 && (
                <Button label={`Share failed rows (${result.failureCount})`} variant="danger" onPress={handleDownloadFailures} />
              )}
              {result.failures.map((f) => (
                <Card key={f.row} style={styles.failureCard}>
                  <DataRowText label="Row" value={String(f.row)} />
                  <DataRowText label="Admission No." value={f.admissionNo || '—'} />
                  <DataRowText label="Name" value={f.name || '—'} />
                  <DataRowText label="Error" value={f.error} />
                </Card>
              ))}
            </>
          )}

          <Button label="Go to students list" variant="secondary" onPress={() => navigation.navigate('StudentsList')} />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  subtitle: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted, marginTop: -spacing.sm },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  card: { gap: spacing.sm },
  cardTitle: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text },
  badgeRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  failureCard: { backgroundColor: colors.bg, gap: 0 },
});
