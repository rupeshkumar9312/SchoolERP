import { apiGet } from './client';

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
