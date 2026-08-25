import { apiGet, apiPost } from './client';

// Mobile only covers the teacher-facing marks-entry flow (Phase 2) — exam
// definition stays a web-only, admin-tier task (Phase 1 decision: low
// frequency, form-heavy, not worth building twice yet).

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
