import { apiGet, apiPatch, apiPost } from './client';
import type { AttendanceStatus } from './attendance';

export interface TeacherAttendanceRecord {
  id: number;
  teacher: { id: number; name: string };
  date: string;
  status: AttendanceStatus;
  method?: 'MANUAL' | 'QR' | 'ADMIN';
  markedAt?: string | null;
  /** QR check-in / check-out times and the whole-minute gap between them. */
  checkInAt?: string | null;
  checkOutAt?: string | null;
  workedMinutes?: number | null;
  markedBy: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface TeacherAttendanceQuery {
  date?: string;
  teacherId?: number;
}

export function listTeacherAttendance(
  query: TeacherAttendanceQuery = {},
): Promise<TeacherAttendanceRecord[]> {
  const params = new URLSearchParams();
  if (query.date) params.set('date', query.date);
  if (query.teacherId) params.set('teacherId', String(query.teacherId));
  const qs = params.toString();
  return apiGet<TeacherAttendanceRecord[]>(`/attendance/teachers${qs ? `?${qs}` : ''}`);
}

export function markTeacherAttendance(payload: {
  teacherId?: number;
  date: string;
  status: AttendanceStatus;
}): Promise<TeacherAttendanceRecord> {
  return apiPost<TeacherAttendanceRecord>('/attendance/teachers', payload);
}

/** Admin-only. Corrects a row's check-in / check-out for a missed scan.
 * Send an ISO string to set, `null` to clear, omit to leave. */
export function correctTeacherAttendance(
  id: number,
  patch: { checkInAt?: string | null; checkOutAt?: string | null },
): Promise<TeacherAttendanceRecord> {
  return apiPatch<TeacherAttendanceRecord>(`/attendance/teachers/${id}`, patch);
}

export interface TeacherSelfServeConfig {
  /** False once the app is switched to QR-only check-in — hide the manual toggle. */
  manualMarkEnabled: boolean;
  /** Non-secret geofence hints for the scan UI; enforcement is server-side. */
  geofence: { enabled: boolean; maxAccuracyM: number };
  /** Whether a second (check-out) QR exists, and the minimum session length. */
  checkout: { enabled: boolean; minSessionMinutes: number; autoSwitchAt: string | null };
}

export function getTeacherSelfServeConfig(): Promise<TeacherSelfServeConfig> {
  return apiGet<TeacherSelfServeConfig>('/attendance/teachers/self-serve-config');
}
