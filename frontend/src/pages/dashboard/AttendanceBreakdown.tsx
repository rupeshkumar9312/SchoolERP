import type { CSSProperties } from 'react';

interface AttendanceBreakdownProps {
  present: number;
  absent: number;
  late: number;
  leave: number;
  totalMarked: number;
  presentPercent: number | null;
}

function dotStyle(color: string): CSSProperties {
  return { '--dot-color': color } as CSSProperties;
}

/** Shared present/absent/late/leave breakdown + progress bar, used by both
 * the student- and staff-attendance cards on the admin dashboard. */
export function AttendanceBreakdown({
  present,
  absent,
  late,
  leave,
  totalMarked,
  presentPercent,
}: AttendanceBreakdownProps) {
  if (totalMarked === 0) {
    return <p className="muted">No attendance marked yet today.</p>;
  }

  return (
    <>
      <div className="stat-value">{presentPercent}% present</div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{ width: `${presentPercent ?? 0}%` }} />
      </div>
      <div className="attendance-breakdown">
        <span className="attendance-chip">
          <span className="attendance-chip-dot" style={dotStyle('var(--color-success)')} />
          {present} present
        </span>
        <span className="attendance-chip">
          <span className="attendance-chip-dot" style={dotStyle('var(--color-danger)')} />
          {absent} absent
        </span>
        <span className="attendance-chip">
          <span className="attendance-chip-dot" style={dotStyle('var(--color-warning)')} />
          {late} late
        </span>
        <span className="attendance-chip">
          <span className="attendance-chip-dot" style={dotStyle('var(--color-info)')} />
          {leave} leave
        </span>
      </div>
    </>
  );
}
