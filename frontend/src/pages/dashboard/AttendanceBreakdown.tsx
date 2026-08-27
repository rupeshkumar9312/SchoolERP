import type { CSSProperties } from 'react';
import { RadialProgress } from '../../components/charts/RadialProgress';

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

/** Shared present/absent/late/leave breakdown, used by both the student-
 * and staff-attendance cards on the admin dashboard. The ring replaces
 * what used to be a flat progress bar — same number, reads more like an
 * instrument than a loading bar. */
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
    <div className="attendance-breakdown-layout">
      <RadialProgress percent={presentPercent ?? 0} color="var(--color-success)" label="present" />
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
    </div>
  );
}
