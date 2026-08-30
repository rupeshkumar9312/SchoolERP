import { useEffect, useMemo, useState } from 'react';
import type { ClassAttendanceToday } from '../../api/dashboard';

interface ClassBarChartProps {
  classes?: ClassAttendanceToday[];
}

// A stable empty-array reference — an inline `[]` default would be a fresh
// array every render, invalidating the useMemo below each time.
const NO_CLASSES: ClassAttendanceToday[] = [];

const MAX_BARS = 8;
const WIDTH = 640;
const HEIGHT = 240;
const PAD = { top: 26, right: 12, bottom: 30, left: 12 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const GRID_LINES = 4; // evenly-spaced lines, count scale is per-render (max enrollment varies)
const BASE_Y = PAD.top + PLOT_H;

function toneFor(percent: number | null): string {
  if (percent === null) return 'var(--color-text-muted)';
  if (percent >= 90) return 'var(--color-success)';
  if (percent >= 75) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function truncate(name: string): string {
  return name.length > 8 ? `${name.slice(0, 7)}…` : name;
}

/** Today's per-class attendance next to each class's total enrollment —
 * lowest attendance % first, so the class that needs a follow-up call is
 * the one an admin sees without scrolling. Two bars per class (enrolled vs
 * present) rather than a percent alone, so a "100%" class of 3 doesn't
 * read the same as a "100%" class of 40. */
export function ClassBarChart({ classes = NO_CLASSES }: ClassBarChartProps) {
  const [grown, setGrown] = useState(false);

  useEffect(() => {
    // Mount with bars at 0 height, then grow on the next frame — CSS
    // transitions don't fire on a value that was already there at mount.
    const raf = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const sorted = useMemo(
    () => [...classes].sort((a, b) => (a.presentPercent ?? 0) - (b.presentPercent ?? 0)),
    [classes],
  );
  const shown = sorted.slice(0, MAX_BARS);
  const hiddenCount = sorted.length - shown.length;

  if (shown.length === 0) {
    return <p className="muted">No students enrolled in any class yet.</p>;
  }

  const maxCount = Math.max(...shown.map((c) => c.totalStudents), 1);
  // Round the axis ceiling up to a tidy number above the tallest bar, so it
  // never touches the top edge and gridlines land on round-ish values.
  const axisMax = Math.ceil((maxCount * 1.15) / 5) * 5 || 5;
  const yAt = (count: number) => PAD.top + (1 - count / axisMax) * PLOT_H;

  const slot = PLOT_W / shown.length;
  const barWidth = Math.min(26, slot * 0.24);
  const barGap = Math.max(3, barWidth * 0.25);

  return (
    <div className="class-bar-chart">
      <div className="class-bar-legend">
        <span className="class-bar-legend-item">
          <span className="class-bar-legend-dot class-bar-legend-dot-total" /> Total students
        </span>
        <span className="class-bar-legend-item">
          <span className="class-bar-legend-dot class-bar-legend-dot-present" /> Present today
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="class-bar-chart-svg">
        {Array.from({ length: GRID_LINES + 1 }, (_, i) => (axisMax / GRID_LINES) * i).map((g) => (
          <line
            key={g}
            className="trend-chart-grid"
            x1={PAD.left}
            x2={WIDTH - PAD.right}
            y1={yAt(g)}
            y2={yAt(g)}
          />
        ))}
        {shown.map((c, i) => {
          const groupCenter = PAD.left + slot * i + slot / 2;
          const totalBarX = groupCenter - barGap / 2 - barWidth;
          const presentBarX = groupCenter + barGap / 2;

          const totalY = grown ? yAt(c.totalStudents) : BASE_Y;
          const totalHeight = grown ? BASE_Y - yAt(c.totalStudents) : 0;
          const presentY = grown ? yAt(c.presentCount) : BASE_Y;
          const presentHeight = grown ? BASE_Y - yAt(c.presentCount) : 0;

          return (
            <g key={c.classId}>
              <rect
                className="class-bar-rect class-bar-rect-total"
                x={totalBarX}
                y={totalY}
                width={barWidth}
                height={totalHeight}
                rx={4}
              />
              <text x={totalBarX + barWidth / 2} y={totalY - 6} textAnchor="middle" className="class-bar-value-label">
                {c.totalStudents}
              </text>

              <rect
                className="class-bar-rect"
                x={presentBarX}
                y={presentY}
                width={barWidth}
                height={presentHeight}
                rx={4}
                fill={toneFor(c.presentPercent)}
              />
              <text
                x={presentBarX + barWidth / 2}
                y={presentY - 6}
                textAnchor="middle"
                className="class-bar-value-label"
              >
                {c.presentPercent === null ? '—' : c.presentCount}
              </text>

              <text x={groupCenter} y={BASE_Y + 20} textAnchor="middle" className="class-bar-name-label">
                {truncate(c.className)}
              </text>
            </g>
          );
        })}
      </svg>
      {hiddenCount > 0 && (
        <p className="muted class-bar-more">
          +{hiddenCount} more class{hiddenCount === 1 ? '' : 'es'}
        </p>
      )}
    </div>
  );
}
