import { apiGet, apiPatch, apiPost } from './client';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';

export interface AttendanceRecord {
  id: number;
  student: { id: number; name: string; admissionNo: string | null };
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

export interface ClassAttendanceHistoryQuery {
  classId: number;
  sectionId: number;
  from?: string;
  to?: string;
}

/** Optionally date-bounded attendance for a whole class/section — unlike
 * listAttendance() (a single exact day, for the mark-attendance flows), this
 * lists every record in the range. A TEACHER is scoped server-side to
 * sections they're the class teacher of. */
export function listAttendanceHistory(query: ClassAttendanceHistoryQuery): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams({ classId: String(query.classId), sectionId: String(query.sectionId) });
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);
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

export interface HistoryDateRange {
  from?: string;
  to?: string;
}

/** Full (optionally date-bounded) history for an arbitrary student — the
 * server scopes a TEACHER to students they teach or are homeroom teacher for. */
export function getStudentAttendanceHistory(studentId: number, range: HistoryDateRange = {}): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  const query = params.toString();
  return apiGet<AttendanceRecord[]>(`/attendance/students/${studentId}/history${query ? `?${query}` : ''}`);
}
