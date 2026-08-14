import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export interface AcademicYear {
  id: number;
  name: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface SchoolClass {
  id: number;
  name: string;
  academicYearId: number;
  createdAt: string;
}

export interface Section {
  id: number;
  name: string;
  classId: number;
  createdAt: string;
}

export interface Subject {
  id: number;
  name: string;
  classId: number;
  createdAt: string;
}

export function listAcademicYears(): Promise<AcademicYear[]> {
  return apiGet<AcademicYear[]>('/academic-years');
}

export function createAcademicYear(name: string, isCurrent?: boolean): Promise<AcademicYear> {
  return apiPost<AcademicYear>('/academic-years', { name, isCurrent });
}

export function updateAcademicYear(id: number, data: { name?: string; isCurrent?: boolean }): Promise<AcademicYear> {
  return apiPatch<AcademicYear>(`/academic-years/${id}`, data);
}

export function deleteAcademicYear(id: number): Promise<void> {
  return apiDelete<void>(`/academic-years/${id}`);
}

export function listClasses(academicYearId: number): Promise<SchoolClass[]> {
  return apiGet<SchoolClass[]>(`/classes?academicYearId=${academicYearId}`);
}

export function createClass(name: string, academicYearId: number): Promise<SchoolClass> {
  return apiPost<SchoolClass>('/classes', { name, academicYearId });
}

export function updateClass(id: number, name: string): Promise<SchoolClass> {
  return apiPatch<SchoolClass>(`/classes/${id}`, { name });
}

export function deleteClass(id: number): Promise<void> {
  return apiDelete<void>(`/classes/${id}`);
}

export function listSections(classId: number): Promise<Section[]> {
  return apiGet<Section[]>(`/sections?classId=${classId}`);
}

export function createSection(name: string, classId: number): Promise<Section> {
  return apiPost<Section>('/sections', { name, classId });
}

export function updateSection(id: number, name: string): Promise<Section> {
  return apiPatch<Section>(`/sections/${id}`, { name });
}

export function deleteSection(id: number): Promise<void> {
  return apiDelete<void>(`/sections/${id}`);
}

export function listSubjects(classId: number): Promise<Subject[]> {
  return apiGet<Subject[]>(`/subjects?classId=${classId}`);
}

export function createSubject(name: string, classId: number): Promise<Subject> {
  return apiPost<Subject>('/subjects', { name, classId });
}

export function updateSubject(id: number, name: string): Promise<Subject> {
  return apiPatch<Subject>(`/subjects/${id}`, { name });
}

export function deleteSubject(id: number): Promise<void> {
  return apiDelete<void>(`/subjects/${id}`);
}
