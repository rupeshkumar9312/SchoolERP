import { apiGet, apiPost } from './client';
import type { AttendanceStatus } from './attendance';

export type AttendanceMethod = 'MANUAL' | 'QR' | 'ADMIN';

export interface TeacherAttendanceRecord {
  id: number;
  teacher: { id: number; name: string };
  date: string;
  status: AttendanceStatus;
  /** How the row was recorded. Absent on very old rows served by other endpoints. */
  method?: AttendanceMethod;
  /** Wall-clock instant the row was set; null for pre-QR historical rows. */
  markedAt?: string | null;
  /** QR check-in / check-out times and the whole-minute gap between them. */
  checkInAt?: string | null;
  checkOutAt?: string | null;
  workedMinutes?: number | null;
  markedBy: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

export function listMyTeacherAttendance(): Promise<TeacherAttendanceRecord[]> {
  return apiGet<TeacherAttendanceRecord[]>('/attendance/teachers');
}

/** ADMIN-tier only (attendance.teacher.view) — every teacher's attendance for a date. */
export function listTeacherAttendanceForDate(date: string): Promise<TeacherAttendanceRecord[]> {
  return apiGet<TeacherAttendanceRecord[]>(`/attendance/teachers?date=${date}`);
}

export function markTeacherAttendance(payload: {
  teacherId?: number;
  date: string;
  status: AttendanceStatus;
}): Promise<TeacherAttendanceRecord> {
  return apiPost<TeacherAttendanceRecord>('/attendance/teachers', payload);
}

export interface TeacherSelfServeConfig {
  /** False once the app is switched to QR-only check-in — hide the manual controls. */
  manualMarkEnabled: boolean;
  /** Non-secret geofence hints for the scan screen; enforcement is server-side. */
  geofence: { enabled: boolean; maxAccuracyM: number };
  /** Whether a second (check-out) QR exists, and the minimum session length. */
  checkout: { enabled: boolean; minSessionMinutes: number; autoSwitchAt: string | null };
}

export function getTeacherSelfServeConfig(): Promise<TeacherSelfServeConfig> {
  return apiGet<TeacherSelfServeConfig>('/attendance/teachers/self-serve-config');
}

export interface ScanResult {
  id: number;
  teacher: { id: number; name: string };
  date: string;
  status: AttendanceStatus;
  method: AttendanceMethod;
  /** What this scan did. */
  event: 'CHECK_IN' | 'CHECK_OUT';
  checkInAt: string | null;
  checkOutAt: string | null;
  /** checkOutAt − checkInAt in whole minutes, when both are known. */
  workedMinutes: number | null;
  markedAt: string | null;
  markedBy: { id: number; name: string };
  /** True when this exact event was already recorded — the scan was a no-op. */
  alreadyMarked: boolean;
}

export interface ScanCoords {
  lat?: number;
  lng?: number;
  accuracy?: number;
  /** Android-only: true when the fix came from a mock-location provider. */
  mocked?: boolean;
}

/** Redeem a kiosk QR token to mark today's attendance. `coords` are sent when
 * available so the server can capture them for the Phase 6 geofence. */
export function scanTeacherAttendance(token: string, coords?: ScanCoords): Promise<ScanResult> {
  return apiPost<ScanResult>('/attendance/teachers/scan', { token, ...coords });
}
