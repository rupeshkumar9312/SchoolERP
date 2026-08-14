import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export interface Teacher {
  id: number;
  userId: number;
  name: string;
  email: string;
  edvanceId: string;
  phone: string | null;
  isActive: boolean;
  qualification: string | null;
  joiningDate: string;
  createdAt: string;
}

/** Shown once, in the create response only — never retrievable again. */
export interface TeacherCreateResult extends Teacher {
  login: { email: string; alias: string; temporaryPassword: string };
}

/** No email/password — both are auto-generated server-side. */
export interface CreateTeacherPayload {
  name: string;
  phone?: string;
  qualification?: string;
  joiningDate: string;
}

export interface UpdateTeacherPayload {
  name?: string;
  phone?: string;
  qualification?: string;
  joiningDate?: string;
  isActive?: boolean;
}

/** ADMIN-tier only (teacher.view) — every teacher in the school. */
export function listTeachers(): Promise<Teacher[]> {
  return apiGet<Teacher[]>('/teachers');
}

export function getTeacher(id: number): Promise<Teacher> {
  return apiGet<Teacher>(`/teachers/${id}`);
}

export function createTeacher(payload: CreateTeacherPayload): Promise<TeacherCreateResult> {
  return apiPost<TeacherCreateResult>('/teachers', payload);
}

export function updateTeacher(id: number, payload: UpdateTeacherPayload): Promise<Teacher> {
  return apiPatch<Teacher>(`/teachers/${id}`, payload);
}

export function deleteTeacher(id: number): Promise<void> {
  return apiDelete<void>(`/teachers/${id}`);
}

export interface TeacherAssignment {
  id: number;
  class: { id: number; name: string };
  section: { id: number; name: string };
  subject: { id: number; name: string };
  isClassTeacher: boolean;
  createdAt: string;
}

export interface ClassTeacherSection {
  class: { id: number; name: string };
  section: { id: number; name: string };
}

export function listMyAssignments(): Promise<TeacherAssignment[]> {
  return apiGet<TeacherAssignment[]>('/teachers/me/assignments');
}

export function listMyClassTeacherOf(): Promise<ClassTeacherSection[]> {
  return apiGet<ClassTeacherSection[]>('/teachers/me/class-teacher-of');
}

/** ADMIN-tier only (teacher.assign) — manage a specific teacher's subject
 * assignments and class-teacher status. */
export function listAssignments(teacherId: number): Promise<TeacherAssignment[]> {
  return apiGet<TeacherAssignment[]>(`/teachers/${teacherId}/assignments`);
}

export function createAssignment(
  teacherId: number,
  payload: { classId: number; sectionId: number; subjectId: number; isClassTeacher?: boolean },
): Promise<TeacherAssignment> {
  return apiPost<TeacherAssignment>(`/teachers/${teacherId}/assignments`, payload);
}

export function deleteAssignment(teacherId: number, assignmentId: number): Promise<void> {
  return apiDelete<void>(`/teachers/${teacherId}/assignments/${assignmentId}`);
}

export function listClassTeacherOf(teacherId: number): Promise<ClassTeacherSection[]> {
  return apiGet<ClassTeacherSection[]>(`/teachers/${teacherId}/class-teacher-of`);
}

export function setClassTeacher(teacherId: number, sectionId: number): Promise<ClassTeacherSection> {
  return apiPost<ClassTeacherSection>(`/teachers/${teacherId}/class-teacher`, { sectionId });
}

export function unsetClassTeacher(teacherId: number, sectionId: number): Promise<void> {
  return apiDelete<void>(`/teachers/${teacherId}/class-teacher/${sectionId}`);
}
