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
