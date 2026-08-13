import type { AttendanceStatus } from './api/attendance';
import type { AudienceRole } from './api/announcements';

export const ATTENDANCE_STATUS_META: Record<AttendanceStatus, { label: string; tone: 'success' | 'danger' | 'warning' | 'info' }> = {
  PRESENT: { label: 'Present', tone: 'success' },
  ABSENT: { label: 'Absent', tone: 'danger' },
  LATE: { label: 'Late', tone: 'warning' },
  LEAVE: { label: 'Leave', tone: 'info' },
};

export const AUDIENCE_LABELS: Record<AudienceRole, string> = {
  STUDENT: 'Students',
  TEACHER: 'Teachers',
  ADMIN: 'Admins',
};
