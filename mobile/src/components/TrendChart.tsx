import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Line, Path, Stop, Circle } from 'react-native-svg';
import type { AttendanceTrendPoint } from '../api/dashboard';
import { colors, fonts, spacing } from '../theme';

interface TrendChartProps {
  points?: AttendanceTrendPoint[];
}

const NO_POINTS: AttendanceTrendPoint[] = [];

const WIDTH = 320;
const HEIGHT = 160;
const PAD = { top: 14, right: 6, bottom: 22, left: 6 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const GRID_LINES = [0, 25, 50, 75, 100];

function xAt(i: number, n: number): number {
  return n <= 1 ? PAD.left : PAD.left + (i / (n - 1)) * PLOT_W;
}

function yAt(percent: number): number {
  return PAD.top + (1 - percent / 100) * PLOT_H;
}

/** Same "quadratic through midpoints" trick as the web trend chart — see
 * frontend/src/components/charts/TrendChart.tsx — so the line bends at
 * every sample without a charting library. */
function smoothLine(pts: Array<{ x: number; y: number }>): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i];
    const next = pts[i + 1];
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;
    d += ` Q ${curr.x} ${curr.y} ${midX} ${midY}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function formatDateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
}

/** Org-wide student attendance % over the selected range — mobile port of
 * the web dashboard's hero chart. No hover readout (nothing to hover on a
 * touchscreen); the header stat + delta carries the "what's happening
 * right now" job instead. Days nobody has marked yet carry
 * `presentPercent: null` and render as a gap rather than a dip to zero. */
export function AttendanceTrendChart({ points = NO_POINTS }: TrendChartProps): React.JSX.Element {
  const plotted = useMemo(
    () =>
      points.map((point, i) => ({
        x: xAt(i, points.length),
        y: point.presentPercent === null ? null : yAt(point.presentPercent),
      })),
    [points],
  );

  const runs = useMemo(() => {
    const result: Array<Array<{ x: number; y: number }>> = [];
    let current: Array<{ x: number; y: number }> = [];
    for (const p of plotted) {
      if (p.y === null) {
        if (current.length) result.push(current);
        current = [];
      } else {
        current.push({ x: p.x, y: p.y });
      }
    }
    if (current.length) result.push(current);
    return result;
  }, [plotted]);

  const latest = [...points].reverse().find((p) => p.presentPercent !== null) ?? null;
  const weekAgoIdx = points.length - 8;
  const weekAgo = weekAgoIdx >= 0 ? points[weekAgoIdx] : null;
  const delta =
    latest && weekAgo && weekAgo.presentPercent !== null ? latest.presentPercent! - weekAgo.presentPercent : null;

  const labelIndices = useMemo(() => {
    const n = points.length;
    if (n <= 4) return points.map((_, i) => i);
    const step = (n - 1) / 3;
    return [0, 1, 2, 3].map((i) => Math.round(i * step));
  }, [points]);

  if (points.length === 0) {
    return <Text style={styles.muted}>No attendance history yet.</Text>;
  }

  return (
    <View>
      <View style={styles.head}>
        <View>
          <Text style={styles.value}>{latest?.presentPercent ?? '—'}%</Text>
          <Text style={styles.caption}>present today, org-wide</Text>
        </View>
        {delta !== null && (
          <View style={[styles.deltaPill, { backgroundColor: delta >= 0 ? colors.successTint : colors.dangerTint }]}>
            <Text style={[styles.deltaText, { color: delta >= 0 ? colors.success : colors.danger }]}>
              {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs last week
            </Text>
          </View>
        )}
      </View>

      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Defs>
          <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={0.32} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {GRID_LINES.map((g) => (
          <Line key={g} x1={PAD.left} x2={WIDTH - PAD.right} y1={yAt(g)} y2={yAt(g)} stroke={colors.border} strokeWidth={1} />
        ))}

        {runs.map((run, i) => (
          <Path
            key={`area-${i}`}
            d={`${smoothLine(run)} L ${run[run.length - 1].x} ${PAD.top + PLOT_H} L ${run[0].x} ${PAD.top + PLOT_H} Z`}
            fill="url(#trendFill)"
          />
        ))}
        {runs.map((run, i) => (
          <Path key={`line-${i}`} d={smoothLine(run)} stroke={colors.primary} strokeWidth={2.5} fill="none" />
        ))}

        {plotted.map(
          (p, i) =>
            p.y !== null &&
            i === plotted.length - 1 && <Circle key="latest" cx={p.x} cy={p.y} r={4} fill={colors.primary} />,
        )}
      </Svg>

      <View style={styles.labels}>
        {labelIndices.map((i) => (
          <Text key={i} style={styles.labelText}>
            {formatDateLabel(points[i].date)}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xs },
  value: { fontSize: 24, fontFamily: fonts.headingBold, color: colors.text },
  caption: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
  deltaPill: { paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 999 },
  deltaText: { fontSize: 12, fontFamily: fonts.bodySemiBold },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  labelText: { fontSize: 10, fontFamily: fonts.body, color: colors.textMuted },
});
