import { apiGet, apiPost } from './client';
import type { AttendanceStatus } from './attendance';

export interface TeacherAttendanceRecord {
  id: number;
  teacher: { id: number; name: string };
  date: string;
  status: AttendanceStatus;
  markedBy: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

export function listMyTeacherAttendance(): Promise<TeacherAttendanceRecord[]> {
  return apiGet<TeacherAttendanceRecord[]>('/attendance/teachers');
}

export function markTeacherAttendance(payload: {
  date: string;
  status: AttendanceStatus;
}): Promise<TeacherAttendanceRecord> {
  return apiPost<TeacherAttendanceRecord>('/attendance/teachers', payload);
}
