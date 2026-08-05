import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export interface Teacher {
  id: number;
  userId: number;
  name: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  qualification: string | null;
  joiningDate: string;
  createdAt: string;
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

export interface CreateTeacherPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  qualification?: string;
  joiningDate: string;
}

export interface UpdateTeacherPayload {
  name?: string;
  email?: string;
  phone?: string;
  qualification?: string;
  joiningDate?: string;
  isActive?: boolean;
}

export function listTeachers(): Promise<Teacher[]> {
  return apiGet<Teacher[]>('/teachers');
}

export function getTeacher(id: number): Promise<Teacher> {
  return apiGet<Teacher>(`/teachers/${id}`);
}

export function createTeacher(payload: CreateTeacherPayload): Promise<Teacher> {
  return apiPost<Teacher>('/teachers', payload);
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
