import { apiGet, apiPatch, apiPost } from './client';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';

export interface AttendanceRecord {
  id: number;
  student: { id: number; name: string; admissionNo: string };
  class: { id: number; name: string };
  section: { id: number; name: string };
  date: string;
  status: AttendanceStatus;
  markedBy: { id: number; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceQuery {
  classId: number;
  sectionId: number;
  date: string;
}

export function listAttendance(query: AttendanceQuery): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams({
    classId: String(query.classId),
    sectionId: String(query.sectionId),
    date: query.date,
  });
  return apiGet<AttendanceRecord[]>(`/attendance/students?${params.toString()}`);
}

export function markAttendance(payload: {
  classId: number;
  sectionId: number;
  date: string;
  records: Array<{ studentId: number; status: AttendanceStatus }>;
}): Promise<AttendanceRecord[]> {
  return apiPost<AttendanceRecord[]>('/attendance/students', payload);
}

export function updateAttendance(id: number, status: AttendanceStatus): Promise<AttendanceRecord> {
  return apiPatch<AttendanceRecord>(`/attendance/students/${id}`, { status });
}

export function listMyAttendance(): Promise<AttendanceRecord[]> {
  return apiGet<AttendanceRecord[]>('/attendance/students/me');
}

/** Full history for an arbitrary student — the server scopes a TEACHER to
 * students they teach or are homeroom teacher for; ADMIN-tier is unrestricted. */
export function getStudentAttendanceHistory(studentId: number): Promise<AttendanceRecord[]> {
  return apiGet<AttendanceRecord[]>(`/attendance/students/${studentId}/history`);
}
