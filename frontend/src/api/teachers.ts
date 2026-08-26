import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import { appendPageParams, type PageParams, type Paginated } from './pagination';

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

export interface Assignment {
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

export interface TeacherFilters extends PageParams {
  isActive?: boolean;
}

export function listTeachers(filters: TeacherFilters = {}): Promise<Paginated<Teacher>> {
  const params = new URLSearchParams();
  if (filters.isActive !== undefined) params.set('isActive', String(filters.isActive));
  appendPageParams(params, filters);
  const query = params.toString();
  return apiGet<Paginated<Teacher>>(`/teachers${query ? `?${query}` : ''}`);
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

export function listAssignments(teacherId: number): Promise<Assignment[]> {
  return apiGet<Assignment[]>(`/teachers/${teacherId}/assignments`);
}

export function createAssignment(
  teacherId: number,
  payload: { classId: number; sectionId: number; subjectId: number; isClassTeacher?: boolean },
): Promise<Assignment> {
  return apiPost<Assignment>(`/teachers/${teacherId}/assignments`, payload);
}

export function deleteAssignment(teacherId: number, assignmentId: number): Promise<void> {
  return apiDelete<void>(`/teachers/${teacherId}/assignments/${assignmentId}`);
}

export function listMyAssignments(): Promise<Assignment[]> {
  return apiGet<Assignment[]>('/teachers/me/assignments');
}

export function listClassTeacherOf(teacherId: number): Promise<ClassTeacherSection[]> {
  return apiGet<ClassTeacherSection[]>(`/teachers/${teacherId}/class-teacher-of`);
}

export function listMyClassTeacherOf(): Promise<ClassTeacherSection[]> {
  return apiGet<ClassTeacherSection[]>('/teachers/me/class-teacher-of');
}

export function setClassTeacher(teacherId: number, sectionId: number): Promise<ClassTeacherSection> {
  return apiPost<ClassTeacherSection>(`/teachers/${teacherId}/class-teacher`, { sectionId });
}

export function unsetClassTeacher(teacherId: number, sectionId: number): Promise<void> {
  return apiDelete<void>(`/teachers/${teacherId}/class-teacher/${sectionId}`);
}
