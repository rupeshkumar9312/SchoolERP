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
const GRID_LINES = [0, 25, 50, 75, 100];
const BASE_Y = PAD.top + PLOT_H;

function toneFor(percent: number): string {
  if (percent >= 90) return 'var(--color-success)';
  if (percent >= 75) return 'var(--color-warning)';
  return 'var(--color-danger)';
}

function yAt(percent: number): number {
  return PAD.top + (1 - percent / 100) * PLOT_H;
}

function truncate(name: string): string {
  return name.length > 8 ? `${name.slice(0, 7)}…` : name;
}

/** Today's per-class present %, lowest first — the class that needs a
 * follow-up call is the one an admin wants to see without scrolling, so
 * this deliberately doesn't sort "nicest number first." Classes with
 * nothing marked yet are already excluded upstream (dashboard.service.ts).
 * Drawn as an actual bar chart (shared grid/axis with the trend chart)
 * rather than a stack of flat-colored progress rows. */
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
    return <p className="muted">No class has marked attendance yet today.</p>;
  }

  const slot = PLOT_W / shown.length;
  const barWidth = Math.min(64, slot * 0.5);

  return (
    <div className="class-bar-chart">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className="class-bar-chart-svg">
        {GRID_LINES.map((g) => (
          <line key={g} className="trend-chart-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={yAt(g)} y2={yAt(g)} />
        ))}
        {shown.map((c, i) => {
          const pct = c.presentPercent ?? 0;
          const cx = PAD.left + slot * i + slot / 2;
          const barX = cx - barWidth / 2;
          const barY = grown ? yAt(pct) : BASE_Y;
          const barHeight = grown ? BASE_Y - yAt(pct) : 0;
          return (
            <g key={c.classId}>
              <rect
                className="class-bar-rect"
                x={barX}
                y={barY}
                width={barWidth}
                height={barHeight}
                rx={6}
                fill={toneFor(pct)}
              />
              <text x={cx} y={barY - 8} textAnchor="middle" className="class-bar-value-label">
                {pct}%
              </text>
              <text x={cx} y={BASE_Y + 20} textAnchor="middle" className="class-bar-name-label">
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
