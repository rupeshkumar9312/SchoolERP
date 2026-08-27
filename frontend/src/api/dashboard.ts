import type { AttendanceStatus } from './attendance';
import { apiGet } from './client';

interface AttendanceBreakdown {
  present: number;
  absent: number;
  late: number;
  leave: number;
  totalMarked: number;
  presentPercent: number | null;
}

export interface AttendanceTrendPoint {
  date: string;
  presentPercent: number | null;
  totalMarked: number;
}

export interface ClassAttendanceToday {
  classId: number;
  className: string;
  presentPercent: number | null;
  totalMarked: number;
}

export interface AdminSummary {
  academicYear: { id: number; name: string } | null;
  totals: { students: number; teachers: number; classes: number; sections: number };
  studentAttendanceToday: AttendanceBreakdown & {
    date: string;
    totalStudents: number;
    sectionsMarked: number;
    totalSections: number;
  };
  teacherAttendanceToday: AttendanceBreakdown & { date: string; totalTeachers: number };
  studentAttendanceTrend: AttendanceTrendPoint[];
  classAttendanceToday: ClassAttendanceToday[];
}

export interface TeacherClass {
  class: { id: number; name: string };
  section: { id: number; name: string };
  subject: { id: number; name: string } | null;
  isClassTeacher: boolean;
}

export interface TeacherSummary {
  teacher: { id: number; name: string };
  classes: TeacherClass[];
  classTeacherOf: Array<{
    class: { id: number; name: string };
    section: { id: number; name: string };
    attendanceMarkedToday: boolean;
  }>;
  myAttendanceToday: { status: AttendanceStatus } | null;
}

export interface StudentSummary {
  student: {
    id: number;
    name: string;
    admissionNo: string | null;
    class: { id: number; name: string };
    section: { id: number; name: string };
  };
  myAttendanceToday: { status: AttendanceStatus } | null;
  attendanceThisMonth: { present: number; totalMarked: number; presentPercent: number | null };
  upcomingAssignments: Array<{
    id: number;
    title: string;
    subject: { id: number; name: string };
    dueDate: string;
  }>;
}

export function getAdminSummary(trendFrom?: string, trendTo?: string): Promise<AdminSummary> {
  const params = new URLSearchParams();
  if (trendFrom) params.set('trendFrom', trendFrom);
  if (trendTo) params.set('trendTo', trendTo);
  const qs = params.toString();
  return apiGet<AdminSummary>(`/dashboard/admin-summary${qs ? `?${qs}` : ''}`);
}

export function getTeacherSummary(): Promise<TeacherSummary> {
  return apiGet<TeacherSummary>('/dashboard/teacher-summary');
}

export function getStudentSummary(): Promise<StudentSummary> {
  return apiGet<StudentSummary>('/dashboard/student-summary');
}
