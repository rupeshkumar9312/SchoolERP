import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export type ExamType = 'CLASS_TEST' | 'UNIT_TEST' | 'MID_TERM' | 'TERM_EXAM' | 'FINAL_EXAM' | 'OTHER';
export type ExamStatus = 'DRAFT' | 'PUBLISHED';

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  CLASS_TEST: 'Class test',
  UNIT_TEST: 'Unit test',
  MID_TERM: 'Mid term',
  TERM_EXAM: 'Term exam',
  FINAL_EXAM: 'Final exam',
  OTHER: 'Other',
};

export interface ExamSubjectRow {
  id: number;
  subject: { id: number; name: string };
  maxMarks: number;
  passMarks: number | null;
  examDate: string | null;
}

export interface Exam {
  id: number;
  name: string;
  type: ExamType;
  class: { id: number; name: string };
  academicYear: { id: number; name: string };
  startDate: string;
  endDate: string;
  status: ExamStatus;
  createdBy: { id: number; name: string } | null;
  subjects: ExamSubjectRow[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamSubjectInput {
  subjectId: number;
  maxMarks: number;
  passMarks?: number;
  examDate?: string;
}

export interface CreateExamPayload {
  name: string;
  type: ExamType;
  classId: number;
  startDate: string;
  endDate: string;
  subjects: ExamSubjectInput[];
}

export interface UpdateExamPayload {
  name?: string;
  type?: ExamType;
  startDate?: string;
  endDate?: string;
}

export interface ListExamsFilters {
  academicYearId?: number;
  classId?: number;
  type?: ExamType;
  status?: ExamStatus;
}

export function listExams(filters: ListExamsFilters = {}): Promise<Exam[]> {
  const params = new URLSearchParams();
  if (filters.academicYearId !== undefined) params.set('academicYearId', String(filters.academicYearId));
  if (filters.classId !== undefined) params.set('classId', String(filters.classId));
  if (filters.type !== undefined) params.set('type', filters.type);
  if (filters.status !== undefined) params.set('status', filters.status);
  const query = params.toString();
  return apiGet<Exam[]>(`/exams${query ? `?${query}` : ''}`);
}

export function getExam(id: number): Promise<Exam> {
  return apiGet<Exam>(`/exams/${id}`);
}

export function createExam(payload: CreateExamPayload): Promise<Exam> {
  return apiPost<Exam>('/exams', payload);
}

export function updateExam(id: number, payload: UpdateExamPayload): Promise<Exam> {
  return apiPatch<Exam>(`/exams/${id}`, payload);
}

export function deleteExam(id: number): Promise<void> {
  return apiDelete<void>(`/exams/${id}`);
}

export function addExamSubject(examId: number, payload: ExamSubjectInput): Promise<Exam> {
  return apiPost<Exam>(`/exams/${examId}/subjects`, payload);
}

export function updateExamSubject(
  examId: number,
  subjectRowId: number,
  payload: Partial<Omit<ExamSubjectInput, 'subjectId'>>,
): Promise<Exam> {
  return apiPatch<Exam>(`/exams/${examId}/subjects/${subjectRowId}`, payload);
}

export function removeExamSubject(examId: number, subjectRowId: number): Promise<Exam> {
  return apiDelete<Exam>(`/exams/${examId}/subjects/${subjectRowId}`);
}

export interface ExamSubjectProgress {
  examSubjectId: number;
  subject: { id: number; name: string };
  enteredCount: number;
  totalStudents: number;
}

export function getExamProgress(examId: number): Promise<ExamSubjectProgress[]> {
  return apiGet<ExamSubjectProgress[]>(`/exams/${examId}/progress`);
}

// ---- Marks entry (teacher-facing) ----

/** One (exam, subject a teacher teaches, section they teach it in) combo —
 * a flattened list of concrete marks-entry targets, not one row per exam. */
export interface TeacherExamEntry {
  exam: { id: number; name: string; type: ExamType; status: ExamStatus; startDate: string; endDate: string };
  class: { id: number; name: string };
  section: { id: number; name: string };
  examSubject: {
    id: number;
    subjectId: number;
    subjectName: string;
    maxMarks: number;
    passMarks: number | null;
    examDate: string | null;
  };
  enteredCount: number;
  totalStudents: number;
}

export function listMyExams(): Promise<TeacherExamEntry[]> {
  return apiGet<TeacherExamEntry[]>('/exams/me');
}

export interface ExamMarkRosterRow {
  student: { id: number; name: string; admissionNo: string | null };
  marksObtained: number | null;
  isAbsent: boolean;
  remarks: string | null;
}

export function getExamMarksRoster(
  examId: number,
  subjectId: number,
  sectionId: number,
): Promise<ExamMarkRosterRow[]> {
  return apiGet<ExamMarkRosterRow[]>(`/exams/${examId}/marks?subjectId=${subjectId}&sectionId=${sectionId}`);
}

export interface ExamMarkRecordInput {
  studentId: number;
  marksObtained?: number;
  isAbsent?: boolean;
}

export interface SaveExamMarksPayload {
  subjectId: number;
  sectionId: number;
  records: ExamMarkRecordInput[];
}

export function saveExamMarks(examId: number, payload: SaveExamMarksPayload): Promise<ExamMarkRosterRow[]> {
  return apiPost<ExamMarkRosterRow[]>(`/exams/${examId}/marks`, payload);
}
