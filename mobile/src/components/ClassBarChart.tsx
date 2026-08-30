import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { ClassAttendanceToday } from '../api/dashboard';
import { colors, fonts, spacing } from '../theme';

interface ClassBarChartProps {
  classes?: ClassAttendanceToday[];
}

const NO_CLASSES: ClassAttendanceToday[] = [];

const MAX_BARS = 6;
const WIDTH = 320;
const HEIGHT = 190;
const PAD = { top: 20, right: 6, bottom: 24, left: 6 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const GRID_LINES = 3;
const BASE_Y = PAD.top + PLOT_H;

function toneFor(percent: number | null): string {
  if (percent === null) return colors.textMuted;
  if (percent >= 90) return colors.success;
  if (percent >= 75) return colors.warning;
  return colors.danger;
}

function truncate(name: string): string {
  return name.length > 6 ? `${name.slice(0, 5)}…` : name;
}

/** Today's per-class attendance next to each class's total enrollment —
 * mobile port of the web dashboard's grouped bar chart. Lowest attendance
 * % first, so the class that needs a follow-up call is the one visible
 * without scrolling. Two bars per class rather than a percent alone, so a
 * "100%" class of 3 doesn't read the same as a "100%" class of 40. */
export function ClassBarChart({ classes = NO_CLASSES }: ClassBarChartProps): React.JSX.Element {
  const sorted = useMemo(
    () => [...classes].sort((a, b) => (a.presentPercent ?? 0) - (b.presentPercent ?? 0)),
    [classes],
  );
  const shown = sorted.slice(0, MAX_BARS);
  const hiddenCount = sorted.length - shown.length;

  if (shown.length === 0) {
    return <Text style={styles.muted}>No students enrolled in any class yet.</Text>;
  }

  const maxCount = Math.max(...shown.map((c) => c.totalStudents), 1);
  const axisMax = Math.ceil((maxCount * 1.15) / 5) * 5 || 5;
  const yAt = (count: number) => PAD.top + (1 - count / axisMax) * PLOT_H;

  const slot = PLOT_W / shown.length;
  const barWidth = Math.min(16, slot * 0.26);
  const barGap = Math.max(2, barWidth * 0.25);

  return (
    <View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
          <Text style={styles.legendLabel}>Total students</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={styles.legendLabel}>Present today</Text>
        </View>
      </View>

      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {Array.from({ length: GRID_LINES + 1 }, (_, i) => (axisMax / GRID_LINES) * i).map((g) => (
          <Line key={g} x1={PAD.left} x2={WIDTH - PAD.right} y1={yAt(g)} y2={yAt(g)} stroke={colors.border} strokeWidth={1} />
        ))}
        {shown.map((c, i) => {
          const groupCenter = PAD.left + slot * i + slot / 2;
          const totalBarX = groupCenter - barGap / 2 - barWidth;
          const presentBarX = groupCenter + barGap / 2;
          const totalY = yAt(c.totalStudents);
          const presentY = yAt(c.presentCount);

          return (
            <React.Fragment key={c.classId}>
              <Rect x={totalBarX} y={totalY} width={barWidth} height={BASE_Y - totalY} rx={3} fill={colors.border} />
              <SvgText x={totalBarX + barWidth / 2} y={totalY - 4} textAnchor="middle" fontSize={9} fill={colors.textMuted}>
                {c.totalStudents}
              </SvgText>

              <Rect
                x={presentBarX}
                y={presentY}
                width={barWidth}
                height={BASE_Y - presentY}
                rx={3}
                fill={toneFor(c.presentPercent)}
              />
              <SvgText x={presentBarX + barWidth / 2} y={presentY - 4} textAnchor="middle" fontSize={9} fill={colors.text}>
                {c.presentPercent === null ? '—' : c.presentCount}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>

      <View style={styles.namesRow}>
        {shown.map((c) => (
          <Text key={c.classId} style={styles.nameLabel} numberOfLines={1}>
            {truncate(c.className)}
          </Text>
        ))}
      </View>

      {hiddenCount > 0 && (
        <Text style={styles.more}>
          +{hiddenCount} more class{hiddenCount === 1 ? '' : 'es'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  legend: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
  namesRow: { flexDirection: 'row', marginTop: 2 },
  nameLabel: { flex: 1, textAlign: 'center', fontSize: 10, fontFamily: fonts.body, color: colors.textMuted },
  more: { marginTop: spacing.xs, fontSize: 12, fontFamily: fonts.body, color: colors.textMuted, textAlign: 'center' },
});
