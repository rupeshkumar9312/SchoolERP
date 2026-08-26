import { apiDelete, apiGet, apiGetBlob, apiPatch, apiPost, apiUpload } from './client';
import { appendPageParams, type PageParams, type Paginated } from './pagination';

// Named "Homework*" here (not "Assignment*") even though the backend model
// and UI both say "Assignment" — `api/teachers.ts` already exports an
// unrelated `Assignment` type/functions for TeacherClassSubject ("who
// teaches what"). This is a different concept ("what homework was set"); the
// prefix avoids a same-name collision when a page needs both APIs at once.
export interface HomeworkAssignment {
  id: number;
  title: string;
  description: string | null;
  class: { id: number; name: string };
  section: { id: number; name: string };
  subject: { id: number; name: string };
  teacher: { id: number; name: string };
  dueDate: string;
  /** Shared by every occurrence of a recurring-weekly creation; null for a one-off. */
  seriesId: string | null;
  attachment: { fileName: string; mimeType: string; size: number } | null;
  submittedCount: number;
  totalStudents: number;
  createdAt: string;
  updatedAt: string;
}

/** A student's own read-only view of one assignment — narrower than
 * HomeworkAssignment: no classmate-facing submittedCount/totalStudents, just
 * this student's own submitted flag. */
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

export interface ListHomeworkAssignmentsFilters extends PageParams {
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
  /** Creates one assignment per week up to and including this date. */
  repeatWeeklyUntil?: string;
}

export interface UpdateHomeworkAssignmentPayload {
  title?: string;
  description?: string;
  dueDate?: string;
}

export interface HomeworkBulkImportFailure {
  row: number;
  title: string;
  error: string;
}

export interface HomeworkBulkImportResult {
  totalRows: number;
  successCount: number;
  failureCount: number;
  failures: HomeworkBulkImportFailure[];
  failuresWorkbookBase64: string | null;
}

export function listHomeworkAssignments(
  filters: ListHomeworkAssignmentsFilters = {},
): Promise<Paginated<HomeworkAssignment>> {
  const params = new URLSearchParams();
  if (filters.classId !== undefined) params.set('classId', String(filters.classId));
  if (filters.sectionId !== undefined) params.set('sectionId', String(filters.sectionId));
  if (filters.subjectId !== undefined) params.set('subjectId', String(filters.subjectId));
  if (filters.teacherId !== undefined) params.set('teacherId', String(filters.teacherId));
  appendPageParams(params, filters);
  const query = params.toString();
  return apiGet<Paginated<HomeworkAssignment>>(`/assignments${query ? `?${query}` : ''}`);
}

export function listMyHomeworkAssignments(): Promise<StudentHomeworkAssignment[]> {
  return apiGet<StudentHomeworkAssignment[]>('/assignments/me');
}

export function createHomeworkAssignment(
  payload: CreateHomeworkAssignmentPayload,
): Promise<HomeworkAssignment> {
  return apiPost<HomeworkAssignment>('/assignments', payload);
}

export function updateHomeworkAssignment(
  id: number,
  payload: UpdateHomeworkAssignmentPayload,
): Promise<HomeworkAssignment> {
  return apiPatch<HomeworkAssignment>(`/assignments/${id}`, payload);
}

export function deleteHomeworkAssignment(id: number): Promise<void> {
  return apiDelete<void>(`/assignments/${id}`);
}

// ---- Attachments ----

export function uploadHomeworkAttachment(id: number, file: File): Promise<HomeworkAssignment> {
  return apiUpload<HomeworkAssignment>(`/assignments/${id}/attachment`, 'file', file);
}

export function deleteHomeworkAttachment(id: number): Promise<HomeworkAssignment> {
  return apiDelete<HomeworkAssignment>(`/assignments/${id}/attachment`);
}

export function downloadHomeworkAttachment(id: number): Promise<Blob> {
  return apiGetBlob(`/assignments/${id}/attachment`);
}

// ---- Submission tracking ----

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

// ---- Bulk import ----

export function bulkImportHomeworkAssignments(file: File): Promise<HomeworkBulkImportResult> {
  return apiUpload<HomeworkBulkImportResult>('/assignments/bulk-import', 'file', file);
}

export function downloadHomeworkImportTemplate(): Promise<Blob> {
  return apiGetBlob('/assignments/bulk-import/template');
}
