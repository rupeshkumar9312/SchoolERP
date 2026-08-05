import type { AttendanceStatus } from '../../api/attendance';

const STATUSES: AttendanceStatus[] = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];

const LABELS: Record<AttendanceStatus, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  LATE: 'Late',
  LEAVE: 'Leave',
};

interface AttendanceStatusToggleProps {
  value: AttendanceStatus;
  onChange: (status: AttendanceStatus) => void;
  disabled?: boolean;
}

/** Shared toggle-button group behind both the roster (bulk mark) and the
 * history view's inline edit — one status per student, four fast buttons. */
export function AttendanceStatusToggle({ value, onChange, disabled }: AttendanceStatusToggleProps) {
  return (
    <div className="status-toggle">
      {STATUSES.map((status) => (
        <button
          key={status}
          type="button"
          className={`status-toggle-btn status-${status.toLowerCase()} ${value === status ? 'status-toggle-active' : ''}`}
          onClick={() => onChange(status)}
          disabled={disabled}
        >
          {LABELS[status]}
        </button>
      ))}
    </div>
  );
}
