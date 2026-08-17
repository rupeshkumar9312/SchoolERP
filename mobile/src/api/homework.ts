import { apiDelete, apiGet, apiPatch, apiPost, apiUpload, type PickedFile } from './client';

export interface HomeworkAssignment {
  id: number;
  title: string;
  description: string | null;
  class: { id: number; name: string };
  section: { id: number; name: string };
  subject: { id: number; name: string };
  teacher: { id: number; name: string };
  dueDate: string;
  seriesId: string | null;
  attachment: { fileName: string; mimeType: string; size: number } | null;
  submittedCount: number;
  totalStudents: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentHomeworkAssignment {
  id: number;
  title: string;
  description: string | null;
  subject: { id: number; name: string };
  teacher: { id: number; name: string };
  dueDate: string;
  attachment: { fileName: string; mimeType: string; size: number } | null;
  submitted: boolean;
}

export interface HomeworkSubmission {
  student: { id: number; name: string; admissionNo: string | null };
  submitted: boolean;
  submittedAt: string | null;
  remarks: string | null;
}

export interface SetHomeworkSubmissionPayload {
  submitted: boolean;
  remarks?: string;
}

export interface ListHomeworkAssignmentsFilters {
  classId?: number;
  sectionId?: number;
  subjectId?: number;
  teacherId?: number;
}

export interface CreateHomeworkAssignmentPayload {
  title: string;
  description?: string;
  classId: number;
  sectionId: number;
  subjectId: number;
  dueDate: string;
  repeatWeeklyUntil?: string;
}

export function listHomeworkAssignments(
  filters: ListHomeworkAssignmentsFilters = {},
): Promise<HomeworkAssignment[]> {
  const params = new URLSearchParams();
  if (filters.classId !== undefined) params.set('classId', String(filters.classId));
  if (filters.sectionId !== undefined) params.set('sectionId', String(filters.sectionId));
  if (filters.subjectId !== undefined) params.set('subjectId', String(filters.subjectId));
  if (filters.teacherId !== undefined) params.set('teacherId', String(filters.teacherId));
  const query = params.toString();
  return apiGet<HomeworkAssignment[]>(`/assignments${query ? `?${query}` : ''}`);
}

export function listMyHomeworkAssignments(): Promise<StudentHomeworkAssignment[]> {
  return apiGet<StudentHomeworkAssignment[]>('/assignments/me');
}

export function createHomeworkAssignment(
  payload: CreateHomeworkAssignmentPayload,
): Promise<HomeworkAssignment> {
  return apiPost<HomeworkAssignment>('/assignments', payload);
}

export function deleteHomeworkAssignment(id: number): Promise<void> {
  return apiDelete<void>(`/assignments/${id}`);
}

export function uploadHomeworkAttachment(id: number, file: PickedFile): Promise<HomeworkAssignment> {
  return apiUpload<HomeworkAssignment>(`/assignments/${id}/attachment`, 'file', file);
}

export function deleteHomeworkAttachment(id: number): Promise<HomeworkAssignment> {
  return apiDelete<HomeworkAssignment>(`/assignments/${id}/attachment`);
}

export function listHomeworkSubmissions(assignmentId: number): Promise<HomeworkSubmission[]> {
  return apiGet<HomeworkSubmission[]>(`/assignments/${assignmentId}/submissions`);
}

export function setHomeworkSubmission(
  assignmentId: number,
  studentId: number,
  payload: SetHomeworkSubmissionPayload,
): Promise<HomeworkSubmission> {
  return apiPatch<HomeworkSubmission>(`/assignments/${assignmentId}/submissions/${studentId}`, payload);
}
