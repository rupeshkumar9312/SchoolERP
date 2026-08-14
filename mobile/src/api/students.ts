import { apiDelete, apiGet, apiPatch, apiPost, apiUpload, PickedFile } from './client';

export interface Student {
  id: number;
  admissionNo: string;
  name: string;
  dateOfBirth: string | null;
  gender: string | null;
  class: { id: number; name: string };
  section: { id: number; name: string };
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  address: string | null;
  isActive: boolean;
  admissionDate: string;
  createdAt: string;
  hasLogin: boolean;
  /** null when hasLogin is false. */
  edvanceId: string | null;
}

/** Only returned once, from createStudent() — the plaintext password can't be
 * retrieved again after this response, so the UI must show it immediately. */
export interface StudentCreateResult extends Student {
  login: { email: string; alias: string; temporaryPassword: string };
}

export interface StudentFilters {
  classId?: number;
  sectionId?: number;
  search?: string;
}

export interface CreateStudentPayload {
  admissionNo: string;
  name: string;
  dateOfBirth?: string;
  gender?: string;
  classId: number;
  sectionId: number;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  address?: string;
  admissionDate?: string;
}

export interface UpdateStudentPayload {
  admissionNo?: string;
  name?: string;
  dateOfBirth?: string;
  gender?: string;
  classId?: number;
  sectionId?: number;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  address?: string;
  admissionDate?: string;
  isActive?: boolean;
}

/** ADMIN-tier only (student.view) — every student in the school, optionally
 * filtered. A TEACHER should use listMyClassStudents() instead. */
export function listStudents(filters: StudentFilters = {}): Promise<Student[]> {
  const params = new URLSearchParams();
  if (filters.classId) params.set('classId', String(filters.classId));
  if (filters.sectionId) params.set('sectionId', String(filters.sectionId));
  if (filters.search) params.set('search', filters.search);
  const query = params.toString();
  return apiGet<Student[]>(`/students${query ? `?${query}` : ''}`);
}

export function getStudent(id: number): Promise<Student> {
  return apiGet<Student>(`/students/${id}`);
}

export function createStudent(payload: CreateStudentPayload): Promise<StudentCreateResult> {
  return apiPost<StudentCreateResult>('/students', payload);
}

export function updateStudent(id: number, payload: UpdateStudentPayload): Promise<Student> {
  return apiPatch<Student>(`/students/${id}`, payload);
}

export function deleteStudent(id: number): Promise<void> {
  return apiDelete<void>(`/students/${id}`);
}

/** A teacher's own roster across every class/section they teach. */
export function listMyClassStudents(): Promise<Student[]> {
  return apiGet<Student[]>('/students/my-classes');
}

export interface BulkImportFailure {
  row: number;
  admissionNo: string;
  name: string;
  error: string;
}

export interface BulkImportResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  failures: BulkImportFailure[];
  failuresWorkbookBase64: string | null;
}

export function bulkImportStudents(file: PickedFile): Promise<BulkImportResult> {
  return apiUpload<BulkImportResult>('/students/bulk-import', 'file', file);
}
