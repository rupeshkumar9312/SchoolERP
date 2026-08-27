import { useMemo, useRef, useState } from 'react';
import type { AttendanceTrendPoint } from '../../api/dashboard';

interface TrendChartProps {
  points?: AttendanceTrendPoint[];
}

// A stable empty-array reference for the no-data fallback — an inline `[]`
// default would be a fresh array on every render, invalidating the
// useMemos below each time.
const NO_POINTS: AttendanceTrendPoint[] = [];

const WIDTH = 640;
const HEIGHT = 220;
const PAD = { top: 20, right: 10, bottom: 26, left: 10 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;
const GRID_LINES = [0, 25, 50, 75, 100];

interface Plotted {
  x: number;
  y: number | null;
  point: AttendanceTrendPoint;
}

function xAt(i: number, n: number): number {
  return n <= 1 ? PAD.left : PAD.left + (i / (n - 1)) * PLOT_W;
}

function yAt(percent: number): number {
  return PAD.top + (1 - percent / 100) * PLOT_H;
}

/** Builds a smooth path through a run of points via the "quadratic through
 * midpoints" trick: each segment curves toward the midpoint between two data
 * points using the first point as the control, so the line bends at every
 * sample without the sharp elbows a plain polyline would have — no charting
 * library needed for something this small. */
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
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

/** The dashboard's hero visual — org-wide student attendance % across the
 * last 14 days as a smooth glowing area chart, with a hover readout. Days
 * nobody has marked yet (weekends, holidays, "today" before first period)
 * carry `presentPercent: null` and are rendered as gaps rather than a dip
 * to zero — see dashboard.service.ts's toTrend(). */
// Guards an older/unrestarted backend not sending this field yet, so a
// missing field doesn't crash the whole dashboard.
export function AttendanceTrendChart({ points = NO_POINTS }: TrendChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotted: Plotted[] = useMemo(
    () =>
      points.map((point, i) => ({
        x: xAt(i, points.length),
        y: point.presentPercent === null ? null : yAt(point.presentPercent),
        point,
      })),
    [points],
  );

  // Split into runs of consecutive non-null points so the path breaks
  // cleanly across gaps instead of a straight line jumping over them.
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

  // Show a handful of evenly-spaced date labels rather than all 14 —
  // crowds far less and reads better at any container width.
  const labelIndices = useMemo(() => {
    const n = points.length;
    if (n <= 5) return points.map((_, i) => i);
    const step = (n - 1) / 4;
    return [0, 1, 2, 3, 4].map((i) => Math.round(i * step));
  }, [points]);

  const handleMove: React.MouseEventHandler<SVGSVGElement> = (e) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || points.length === 0) return;
    const relX = (e.clientX - rect.left) / rect.width;
    const fraction = (relX * WIDTH - PAD.left) / PLOT_W;
    const idx = Math.round(fraction * (points.length - 1));
    setHoverIndex(Math.max(0, Math.min(points.length - 1, idx)));
  };

  const hovered = hoverIndex !== null ? plotted[hoverIndex] : null;

  if (points.length === 0) {
    return <p className="muted">No attendance history yet.</p>;
  }

  return (
    <div className="trend-chart">
      <div className="trend-chart-head">
        <div>
          <span className="trend-chart-value">{latest?.presentPercent ?? '—'}%</span>
          <span className="trend-chart-caption">present today, org-wide</span>
        </div>
        {delta !== null && (
          <span className={`trend-chart-delta ${delta >= 0 ? 'up' : 'down'}`}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs last week
          </span>
        )}
      </div>

      <div className="trend-chart-canvas">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          className="trend-chart-svg"
          onMouseMove={handleMove}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.38" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
            <filter id="trendGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {GRID_LINES.map((g) => (
            <line
              key={g}
              className="trend-chart-grid"
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={yAt(g)}
              y2={yAt(g)}
            />
          ))}

          {runs.map((run, i) => (
            <path
              key={`area-${i}`}
              d={`${smoothLine(run)} L ${run[run.length - 1].x} ${PAD.top + PLOT_H} L ${run[0].x} ${PAD.top + PLOT_H} Z`}
              fill="url(#trendFill)"
              stroke="none"
            />
          ))}
          {runs.map((run, i) => (
            <path key={`line-${i}`} className="trend-chart-line" d={smoothLine(run)} filter="url(#trendGlow)" />
          ))}

          {plotted.map(
            (p, i) =>
              p.y !== null &&
              i === plotted.length - 1 && (
                <circle key="latest" className="trend-chart-latest-dot" cx={p.x} cy={p.y} r={4.5} />
              ),
          )}

          {hovered && hovered.y !== null && (
            <>
              <line
                className="trend-chart-hover-guide"
                x1={hovered.x}
                x2={hovered.x}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
              />
              <circle className="trend-chart-hover-dot" cx={hovered.x} cy={hovered.y} r={5} />
            </>
          )}
        </svg>

        {hovered && (
          <div
            className="trend-chart-tooltip"
            style={{ left: `${(hovered.x / WIDTH) * 100}%`, top: hovered.y ?? PAD.top }}
          >
            <strong>{hovered.point.presentPercent === null ? 'Not marked' : `${hovered.point.presentPercent}%`}</strong>
            <span>{formatDateLabel(hovered.point.date)}</span>
          </div>
        )}

        <div className="trend-chart-labels">
          {labelIndices.map((i) => (
            <span key={i} style={{ left: `${(xAt(i, points.length) / WIDTH) * 100}%` }}>
              {formatDateLabel(points[i].date)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
