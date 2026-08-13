import { apiGet } from './client';

export interface Student {
  id: number;
  admissionNo: string;
  name: string;
  class: { id: number; name: string };
  section: { id: number; name: string };
  guardianName: string | null;
  isActive: boolean;
}

/** A teacher's own roster across every class/section they teach. */
export function listMyClassStudents(): Promise<Student[]> {
  return apiGet<Student[]>('/students/my-classes');
}
