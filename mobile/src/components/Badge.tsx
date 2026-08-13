import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

type Tone = 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'muted';

const TONE_COLORS: Record<Tone, { bg: string; fg: string }> = {
  primary: { bg: colors.primaryTint, fg: colors.primary },
  success: { bg: colors.successTint, fg: colors.success },
  danger: { bg: colors.dangerTint, fg: colors.danger },
  warning: { bg: colors.warningTint, fg: colors.warning },
  info: { bg: colors.infoTint, fg: colors.info },
  muted: { bg: colors.surfaceHover, fg: colors.textMuted },
};

export function Badge({ label, tone = 'muted' }: { label: string; tone?: Tone }): React.JSX.Element {
  const { bg, fg } = TONE_COLORS[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  label: { fontSize: 12, fontFamily: fonts.bodySemiBold },
});
