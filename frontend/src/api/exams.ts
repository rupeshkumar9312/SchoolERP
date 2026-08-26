import { apiDelete, apiGet, apiPatch, apiPost } from './client';

export type ExamType = 'CLASS_TEST' | 'UNIT_TEST' | 'MID_TERM' | 'TERM_EXAM' | 'FINAL_EXAM' | 'OTHER';
export type ExamScheduleStatus = 'DRAFT' | 'PUBLISHED';

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

/** One class's independent sitting of an Exam — its own dates, subjects and
 * publish status. An Exam has one of these per class it's been scheduled
 * for, with no constraint between them (no shared subject list). */
export interface ExamSchedule {
  id: number;
  examId: number;
  class: { id: number; name: string };
  academicYear: { id: number; name: string };
  startDate: string;
  endDate: string;
  status: ExamScheduleStatus;
  createdBy: { id: number; name: string } | null;
  subjects: ExamSubjectRow[];
  createdAt: string;
  updatedAt: string;
}

/** The exam's identity — name + type — plus an optional overall date
 * window. Every class it's been scheduled for is a separate, independent
 * entry in `schedules`, with its own dates that may differ from this one. */
export interface Exam {
  id: number;
  name: string;
  type: ExamType;
  startDate: string | null;
  endDate: string | null;
  createdBy: { id: number; name: string } | null;
  schedules: ExamSchedule[];
  createdAt: string;
  updatedAt: string;
}

export interface ExamSubjectInput {
  subjectId: number;
  maxMarks: number;
  passMarks?: number;
  examDate?: string;
}

export interface CreateExamScheduleInput {
  classId: number;
  startDate: string;
  endDate: string;
  subjects: ExamSubjectInput[];
}

export interface CreateExamPayload {
  name: string;
  type: ExamType;
  startDate?: string;
  endDate?: string;
  /** Optional first class sitting, created together with the umbrella in
   * one request — keeps single-class creation a one-step flow. Additional
   * classes are added afterwards via addExamSchedule(). */
  schedule?: CreateExamScheduleInput;
}

export interface UpdateExamPayload {
  name?: string;
  type?: ExamType;
  startDate?: string;
  endDate?: string;
}

export interface UpdateExamSchedulePayload {
  startDate?: string;
  endDate?: string;
}

export interface ListExamsFilters {
  academicYearId?: number;
  classId?: number;
  type?: ExamType;
  status?: ExamScheduleStatus;
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

/** Adds one more class to an existing exam — fully independent of every
 * other class already scheduled under it (own dates, own subject list). */
export function addExamSchedule(examId: number, payload: CreateExamScheduleInput): Promise<Exam> {
  return apiPost<Exam>(`/exams/${examId}/schedules`, payload);
}

export function updateExamSchedule(
  examId: number,
  scheduleId: number,
  payload: UpdateExamSchedulePayload,
): Promise<Exam> {
  return apiPatch<Exam>(`/exams/${examId}/schedules/${scheduleId}`, payload);
}

export function deleteExamSchedule(examId: number, scheduleId: number): Promise<Exam> {
  return apiDelete<Exam>(`/exams/${examId}/schedules/${scheduleId}`);
}

/** Makes this class's marks visible to its students (see getMyExamResults
 * below). Per-schedule, not umbrella-wide — publishing one class's sitting
 * of an exam has no effect on any other class scheduled under it. */
export function publishExamSchedule(examId: number, scheduleId: number): Promise<Exam> {
  return apiPost<Exam>(`/exams/${examId}/schedules/${scheduleId}/publish`);
}

export function unpublishExamSchedule(examId: number, scheduleId: number): Promise<Exam> {
  return apiPost<Exam>(`/exams/${examId}/schedules/${scheduleId}/unpublish`);
}

export function addExamSubject(
  examId: number,
  scheduleId: number,
  payload: ExamSubjectInput,
): Promise<Exam> {
  return apiPost<Exam>(`/exams/${examId}/schedules/${scheduleId}/subjects`, payload);
}

export function updateExamSubject(
  examId: number,
  scheduleId: number,
  subjectRowId: number,
  payload: Partial<Omit<ExamSubjectInput, 'subjectId'>>,
): Promise<Exam> {
  return apiPatch<Exam>(`/exams/${examId}/schedules/${scheduleId}/subjects/${subjectRowId}`, payload);
}

export function removeExamSubject(examId: number, scheduleId: number, subjectRowId: number): Promise<Exam> {
  return apiDelete<Exam>(`/exams/${examId}/schedules/${scheduleId}/subjects/${subjectRowId}`);
}

export interface ExamSubjectProgress {
  examSubjectId: number;
  subject: { id: number; name: string };
  enteredCount: number;
  totalStudents: number;
}

export function getExamProgress(examId: number, scheduleId: number): Promise<ExamSubjectProgress[]> {
  return apiGet<ExamSubjectProgress[]>(`/exams/${examId}/schedules/${scheduleId}/progress`);
}

/** Cross-subject total/percentage/rank for one student on one schedule.
 * Null until every subject on the schedule has a recorded mark for them
 * (graded or absent) — a partial total would misrepresent their standing. */
export interface ScheduleStudentTotal {
  totalObtained: number | null;
  totalMax: number;
  percentage: number | null;
  /** Competition ranking within the whole class (ties share a rank; the
   * next rank skips accordingly — 1, 2, 2, 4). */
  rank: number | null;
}

export interface ReportCardSubjectColumn {
  examSubjectId: number;
  subject: { id: number; name: string };
  maxMarks: number;
}

export interface ReportCardSubjectCell {
  examSubjectId: number;
  marksObtained: number | null;
  isAbsent: boolean;
}

export interface ReportCardRow {
  student: { id: number; name: string; admissionNo: string | null };
  section: { id: number; name: string };
  subjects: ReportCardSubjectCell[];
  total: ScheduleStudentTotal;
}

/** The full class's cross-subject standing for one schedule — every active
 * student in the class, sorted by rank (students whose total isn't
 * computable yet sort after, alphabetically). */
export interface ScheduleReportCard {
  exam: { id: number; name: string; type: ExamType };
  schedule: {
    id: number;
    class: { id: number; name: string };
    status: ExamScheduleStatus;
    startDate: string;
    endDate: string;
  };
  subjects: ReportCardSubjectColumn[];
  rows: ReportCardRow[];
}

export function getExamReportCard(examId: number, scheduleId: number): Promise<ScheduleReportCard> {
  return apiGet<ScheduleReportCard>(`/exams/${examId}/schedules/${scheduleId}/report-card`);
}

// ---- Marks entry (teacher-facing) ----

/** One (exam, schedule, subject a teacher teaches, section they teach it in)
 * combo — a flattened list of concrete marks-entry targets, not one row per
 * exam or per schedule. */
export interface TeacherExamEntry {
  exam: { id: number; name: string; type: ExamType };
  schedule: { id: number; status: ExamScheduleStatus; startDate: string; endDate: string };
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
  scheduleId: number,
  subjectId: number,
  sectionId: number,
): Promise<ExamMarkRosterRow[]> {
  return apiGet<ExamMarkRosterRow[]>(
    `/exams/${examId}/schedules/${scheduleId}/marks?subjectId=${subjectId}&sectionId=${sectionId}`,
  );
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

export function saveExamMarks(
  examId: number,
  scheduleId: number,
  payload: SaveExamMarksPayload,
): Promise<ExamMarkRosterRow[]> {
  return apiPost<ExamMarkRosterRow[]>(`/exams/${examId}/schedules/${scheduleId}/marks`, payload);
}

// ---- Results (student-facing) ----

export interface StudentExamResultSubject {
  subject: { id: number; name: string };
  maxMarks: number;
  passMarks: number | null;
  marksObtained: number | null;
  isAbsent: boolean;
  percentage: number | null;
  passed: boolean | null;
}

/** One class's PUBLISHED sitting of an exam, from the signed-in student's
 * own point of view. Unpublished schedules for their class never appear
 * here at all. */
export interface StudentExamResult {
  exam: { id: number; name: string; type: ExamType };
  schedule: { id: number; startDate: string; endDate: string };
  subjects: StudentExamResultSubject[];
  summary: ScheduleStudentTotal & { totalStudents: number };
}

export function getMyExamResults(): Promise<StudentExamResult[]> {
  return apiGet<StudentExamResult[]>('/exams/me/results');
}
