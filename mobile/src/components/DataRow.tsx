import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';

export function DataRow({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.value}>{children}</View>
    </View>
  );
}

export function DataRowText({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <DataRow label={label}>
      <Text style={styles.text}>{value}</Text>
    </DataRow>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  label: { fontSize: 12, fontFamily: fonts.bodySemiBold, color: colors.textMuted, opacity: 0.75 },
  value: { flexShrink: 1, alignItems: 'flex-end' },
  text: { fontSize: 14, fontFamily: fonts.body, color: colors.text, textAlign: 'right' },
});
