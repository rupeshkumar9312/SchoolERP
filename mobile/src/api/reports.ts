import { apiGet } from './client';

export interface AttendanceCounts {
  present: number;
  absent: number;
  late: number;
  leave: number;
  totalMarked: number;
  percent: number | null;
}

export interface StudentAttendanceRow extends AttendanceCounts {
  student: { id: number; admissionNo: string | null; name: string };
  class: { id: number; name: string };
  section: { id: number; name: string };
}

export interface ClassAttendanceRow extends AttendanceCounts {
  class: { id: number; name: string };
  studentCount: number;
}

export interface AttendanceSummary {
  range: { from: string; to: string };
  classSummaries: ClassAttendanceRow[];
  students: StudentAttendanceRow[];
}

export interface DefaultersReport {
  range: { from: string; to: string };
  threshold: number;
  defaulters: StudentAttendanceRow[];
}

export interface TeacherAttendanceRow extends AttendanceCounts {
  teacher: { id: number; name: string };
}

export interface StaffAttendanceSummary {
  range: { from: string; to: string };
  teachers: TeacherAttendanceRow[];
}

export interface ReportFilters {
  classId?: number;
  sectionId?: number;
  from?: string;
  to?: string;
}

function buildQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, string | number | undefined>)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

export function getAttendanceSummary(filters: ReportFilters = {}): Promise<AttendanceSummary> {
  return apiGet<AttendanceSummary>(`/reports/attendance-summary${buildQuery(filters)}`);
}

export function getDefaulters(filters: ReportFilters & { threshold?: number } = {}): Promise<DefaultersReport> {
  return apiGet<DefaultersReport>(`/reports/defaulters${buildQuery(filters)}`);
}

export function getStaffAttendanceSummary(
  filters: { teacherId?: number; from?: string; to?: string } = {},
): Promise<StaffAttendanceSummary> {
  return apiGet<StaffAttendanceSummary>(`/reports/staff-attendance-summary${buildQuery(filters)}`);
}
