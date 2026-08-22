import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

interface StatTileProps {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  tint: string;
  tintBg: string;
}

/** A single count (e.g. "Total Classes: 5") has no composition to chart —
 * this is the correct form for it (see dataviz skill: "sometimes the answer
 * is not a chart"). Still meant to read as more than plain text: an icon +
 * tint carries the category, matching the donut charts' visual language. */
export function StatTile({ icon, value, label, tint, tintBg }: StatTileProps): React.JSX.Element {
  return (
    <View style={styles.tile}>
      <View style={[styles.iconWrap, { backgroundColor: tintBg }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontSize: 22, fontFamily: fonts.headingBold, color: colors.text },
  label: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
});
