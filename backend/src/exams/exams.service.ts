import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ExamScheduleStatus, ExamType, Prisma, Student, Teacher } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { TEACHER_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationService } from '../push-notifications/push-notifications.service';
import { BulkMarksDto } from './dto/bulk-marks.dto';
import { CreateExamScheduleDto } from './dto/create-exam-schedule.dto';
import { CreateExamSubjectDto } from './dto/create-exam-subject.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { ExamMarksRosterQueryDto } from './dto/exam-marks-roster.query.dto';
import { ListExamsQueryDto } from './dto/list-exams.query.dto';
import { UpdateExamScheduleDto } from './dto/update-exam-schedule.dto';
import { UpdateExamSubjectDto } from './dto/update-exam-subject.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

export interface ExamSubjectView {
  id: number;
  subject: { id: number; name: string };
  maxMarks: number;
  passMarks: number | null;
  examDate: Date | null;
}

export interface ExamScheduleView {
  id: number;
  examId: number;
  class: { id: number; name: string };
  academicYear: { id: number; name: string };
  startDate: Date;
  endDate: Date;
  status: ExamScheduleStatus;
  createdBy: { id: number; name: string } | null;
  subjects: ExamSubjectView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamView {
  id: number;
  name: string;
  type: ExamType;
  startDate: Date | null;
  endDate: Date | null;
  createdBy: { id: number; name: string } | null;
  schedules: ExamScheduleView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamMarkRosterRow {
  student: { id: number; name: string; admissionNo: string | null };
  marksObtained: number | null;
  isAbsent: boolean;
  remarks: string | null;
}

/** One row per (schedule, subject a teacher teaches, section they teach it
 * in) — a teacher may teach the same schedule's subject in several sections,
 * or teach several of a schedule's subjects, so this is a flattened list of
 * concrete marks-entry targets, not one row per exam or per schedule. */
export interface TeacherExamEntry {
  exam: { id: number; name: string; type: ExamType };
  schedule: { id: number; status: ExamScheduleStatus; startDate: Date; endDate: Date };
  class: { id: number; name: string };
  section: { id: number; name: string };
  examSubject: {
    id: number;
    subjectId: number;
    subjectName: string;
    maxMarks: number;
    passMarks: number | null;
    examDate: Date | null;
  };
  enteredCount: number;
  totalStudents: number;
}

export interface ExamSubjectProgress {
  examSubjectId: number;
  subject: { id: number; name: string };
  enteredCount: number;
  totalStudents: number;
}

export interface StudentExamResultSubject {
  subject: { id: number; name: string };
  maxMarks: number;
  passMarks: number | null;
  marksObtained: number | null;
  isAbsent: boolean;
  /** Rounded to one decimal place; null while ungraded. */
  percentage: number | null;
  /** null when ungraded or when the subject has no passMarks set. */
  passed: boolean | null;
}

/** Cross-subject standing for one student on one class's ExamSchedule.
 * `totalObtained`/`percentage`/`rank` stay null until every subject on the
 * schedule has a recorded ExamMark for that student (graded or absent) —
 * a partial total would misrepresent where they stand while marks entry is
 * still in progress. Absent counts as 0 toward the total, same as any
 * school's standard convention. */
export interface ScheduleStudentTotal {
  totalObtained: number | null;
  totalMax: number;
  percentage: number | null;
  /** Competition ranking (ties share a rank; the next rank skips
   * accordingly, e.g. 1, 2, 2, 4) within the whole class — an ExamSchedule
   * spans every section of its class, so rank does too. Null alongside
   * totalObtained above. */
  rank: number | null;
}

/** One class's PUBLISHED sitting of an Exam, from a student's own point of
 * view — every subject on that schedule, not just the ones already graded,
 * so an ungraded subject still shows (with null marks) rather than vanishing. */
export interface StudentExamResult {
  exam: { id: number; name: string; type: ExamType };
  schedule: { id: number; startDate: Date; endDate: Date };
  subjects: StudentExamResultSubject[];
  summary: ScheduleStudentTotal & { totalStudents: number };
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

/** The full class's cross-subject standing for one ExamSchedule — every
 * active student in the class (not just ones with marks entered so far),
 * one column per subject on the schedule, sorted by rank (students whose
 * total isn't computable yet — marks entry still incomplete for them —
 * sort after, alphabetically). */
export interface ScheduleReportCard {
  exam: { id: number; name: string; type: ExamType };
  schedule: {
    id: number;
    class: { id: number; name: string };
    status: ExamScheduleStatus;
    startDate: Date;
    endDate: Date;
  };
  subjects: ReportCardSubjectColumn[];
  rows: ReportCardRow[];
}

type ExamWithRefs = Prisma.ExamGetPayload<{ include: typeof EXAM_INCLUDE }>;
type ScheduleWithRefs = Prisma.ExamScheduleGetPayload<{ include: typeof SCHEDULE_INCLUDE }>;
type ExamSubjectWithRefs = Prisma.ExamSubjectGetPayload<{ include: { subject: true } }>;

const EXAM_INCLUDE = {
  createdBy: true,
  schedules: {
    include: {
      class: { include: { academicYear: true } },
      createdBy: true,
      subjects: { include: { subject: true }, orderBy: { id: 'asc' } },
    },
    orderBy: { id: 'asc' },
  },
} satisfies Prisma.ExamInclude;

const SCHEDULE_INCLUDE = {
  class: true,
  subjects: { include: { subject: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.ExamScheduleInclude;

@Injectable()
export class ExamsService {
  private readonly logger = new Logger(ExamsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly pushNotifications: PushNotificationService,
  ) {}

  async findAll(query: ListExamsQueryDto): Promise<ExamView[]> {
    const hasScheduleFilter =
      query.classId !== undefined || query.academicYearId !== undefined || query.status !== undefined;

    const rows = await this.prisma.exam.findMany({
      where: {
        type: query.type,
        schedules: hasScheduleFilter
          ? {
              some: {
                classId: query.classId,
                status: query.status,
                class: query.academicYearId ? { academicYearId: query.academicYearId } : undefined,
              },
            }
          : undefined,
      },
      include: EXAM_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async findOne(id: number): Promise<ExamView> {
    return this.toView(await this.findRowOrThrow(id));
  }

  /** Identity-pinned "me" route for a TEACHER — every (exam, schedule,
   * subject, section) combination they may enter marks for, flattened from
   * their TeacherClassSubject rows intersected with each schedule's subject
   * list. */
  async findForTeacher(actor: AuthenticatedUser): Promise<TeacherExamEntry[]> {
    const teacher = await this.getOwnTeacher(actor.id);
    const assignments = await this.prisma.teacherClassSubject.findMany({ where: { teacherId: teacher.id } });
    if (assignments.length === 0) return [];

    const classIds = [...new Set(assignments.map((a) => a.classId))];
    const sectionIds = [...new Set(assignments.map((a) => a.sectionId))];
    const [schedules, sections] = await Promise.all([
      this.prisma.examSchedule.findMany({
        where: { classId: { in: classIds } },
        include: {
          exam: true,
          class: true,
          subjects: { include: { subject: true }, orderBy: { id: 'asc' } },
        },
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.section.findMany({ where: { id: { in: sectionIds } } }),
    ]);
    const sectionById = new Map(sections.map((s) => [s.id, s]));

    const entries: TeacherExamEntry[] = [];
    for (const schedule of schedules) {
      for (const a of assignments.filter((x) => x.classId === schedule.classId)) {
        const examSubject = schedule.subjects.find((s) => s.subject.id === a.subjectId);
        const section = sectionById.get(a.sectionId);
        if (!examSubject || !section) continue;

        const [enteredCount, totalStudents] = await Promise.all([
          this.prisma.examMark.count({ where: { examSubjectId: examSubject.id, sectionId: a.sectionId } }),
          this.prisma.student.count({ where: { classId: schedule.classId, sectionId: a.sectionId, isActive: true } }),
        ]);
        entries.push({
          exam: { id: schedule.exam.id, name: schedule.exam.name, type: schedule.exam.type },
          schedule: {
            id: schedule.id,
            status: schedule.status,
            startDate: schedule.startDate,
            endDate: schedule.endDate,
          },
          class: { id: schedule.class.id, name: schedule.class.name },
          section: { id: section.id, name: section.name },
          examSubject: {
            id: examSubject.id,
            subjectId: examSubject.subject.id,
            subjectName: examSubject.subject.name,
            maxMarks: examSubject.maxMarks,
            passMarks: examSubject.passMarks,
            examDate: examSubject.examDate,
          },
          enteredCount,
          totalStudents,
        });
      }
    }
    return entries;
  }

  /** Identity-pinned "me" route for a STUDENT — every PUBLISHED schedule for
   * their own class, with their own marks per subject. DRAFT schedules for
   * their class are filtered out entirely at the query level, not
   * shown-but-locked, matching how unpublished Announcements/Assignments
   * stay invisible to students outside their audience. */
  async findResultsForStudent(actor: AuthenticatedUser): Promise<StudentExamResult[]> {
    const student = await this.getOwnStudent(actor.id);
    const schedules = await this.prisma.examSchedule.findMany({
      where: { classId: student.classId, status: 'PUBLISHED' },
      include: {
        exam: true,
        subjects: { include: { subject: true }, orderBy: { id: 'asc' } },
      },
      orderBy: { startDate: 'desc' },
    });
    if (schedules.length === 0) return [];

    // Every classmate is needed to compute rank, even though only the
    // caller's own marks are ever returned in the response below.
    const classmates = await this.prisma.student.findMany({
      where: { classId: student.classId, isActive: true },
      select: { id: true },
    });
    const classmateIds = classmates.map((c) => c.id);

    const allExamSubjectIds = schedules.flatMap((s) => s.subjects.map((su) => su.id));
    const allMarks = await this.prisma.examMark.findMany({
      where: { examSubjectId: { in: allExamSubjectIds } },
    });
    const marksByExamSubjectId = new Map<number, typeof allMarks>();
    for (const m of allMarks) {
      const list = marksByExamSubjectId.get(m.examSubjectId) ?? [];
      list.push(m);
      marksByExamSubjectId.set(m.examSubjectId, list);
    }

    return schedules.map((schedule) => {
      const scheduleMarks = schedule.subjects.flatMap((su) => marksByExamSubjectId.get(su.id) ?? []);
      const totals = this.computeClassTotals(
        classmateIds,
        schedule.subjects.map((s) => ({ id: s.id, maxMarks: s.maxMarks })),
        scheduleMarks,
      );
      const myTotal = totals.get(student.id)!;
      const myMarkByExamSubjectId = new Map(
        scheduleMarks.filter((m) => m.studentId === student.id).map((m) => [m.examSubjectId, m]),
      );

      return {
        exam: { id: schedule.exam.id, name: schedule.exam.name, type: schedule.exam.type },
        schedule: { id: schedule.id, startDate: schedule.startDate, endDate: schedule.endDate },
        subjects: schedule.subjects.map((su) => {
          const mark = myMarkByExamSubjectId.get(su.id);
          const marksObtained = mark?.marksObtained ?? null;
          const isAbsent = mark?.isAbsent ?? false;
          return {
            subject: { id: su.subject.id, name: su.subject.name },
            maxMarks: su.maxMarks,
            passMarks: su.passMarks,
            marksObtained,
            isAbsent,
            percentage: marksObtained !== null ? Math.round((marksObtained / su.maxMarks) * 1000) / 10 : null,
            passed:
              marksObtained !== null && su.passMarks !== null ? marksObtained >= su.passMarks : null,
          };
        }),
        summary: { ...myTotal, totalStudents: classmateIds.length },
      };
    });
  }

  /** Per-subject "entered X / Y" progress for one class's schedule, for the
   * admin exam-detail page — not scoped to one teacher's section like the
   * roster/bulk-save methods below. */
  async getProgress(examId: number, scheduleId: number): Promise<ExamSubjectProgress[]> {
    const schedule = await this.findScheduleRowOrThrow(examId, scheduleId);
    const examSubjectIds = schedule.subjects.map((s) => s.id);
    const [totalStudents, counts] = await Promise.all([
      this.prisma.student.count({ where: { classId: schedule.classId, isActive: true } }),
      this.prisma.examMark.groupBy({
        by: ['examSubjectId'],
        where: { examSubjectId: { in: examSubjectIds } },
        _count: { _all: true },
      }),
    ]);
    const enteredByExamSubjectId = new Map(counts.map((c) => [c.examSubjectId, c._count._all]));

    return schedule.subjects.map((s) => ({
      examSubjectId: s.id,
      subject: { id: s.subject.id, name: s.subject.name },
      enteredCount: enteredByExamSubjectId.get(s.id) ?? 0,
      totalStudents,
    }));
  }

  /** Full class's cross-subject report card for one schedule — every active
   * student in the class, one column per subject, with each row's total/
   * percentage/rank. Admin-tier viewing only (exam.view), same as the exam
   * definition routes — not exposed to teachers, who already see their own
   * subject's roster via the marks-entry routes. */
  async getReportCard(examId: number, scheduleId: number): Promise<ScheduleReportCard> {
    const schedule = await this.findScheduleRowOrThrow(examId, scheduleId);
    const exam = await this.prisma.exam.findUniqueOrThrow({
      where: { id: examId },
      select: { id: true, name: true, type: true },
    });
    const students = await this.prisma.student.findMany({
      where: { classId: schedule.classId, isActive: true },
      include: { section: true },
      orderBy: { name: 'asc' },
    });

    const examSubjectIds = schedule.subjects.map((s) => s.id);
    const marks = await this.prisma.examMark.findMany({ where: { examSubjectId: { in: examSubjectIds } } });
    const totals = this.computeClassTotals(
      students.map((s) => s.id),
      schedule.subjects.map((s) => ({ id: s.id, maxMarks: s.maxMarks })),
      marks,
    );

    const marksByStudentId = new Map<number, Map<number, (typeof marks)[number]>>();
    for (const m of marks) {
      if (!marksByStudentId.has(m.studentId)) marksByStudentId.set(m.studentId, new Map());
      marksByStudentId.get(m.studentId)!.set(m.examSubjectId, m);
    }

    const rows: ReportCardRow[] = students.map((student) => {
      const byExamSubjectId = marksByStudentId.get(student.id);
      return {
        student: { id: student.id, name: student.name, admissionNo: student.admissionNo },
        section: { id: student.section.id, name: student.section.name },
        subjects: schedule.subjects.map((su) => {
          const mark = byExamSubjectId?.get(su.id);
          return { examSubjectId: su.id, marksObtained: mark?.marksObtained ?? null, isAbsent: mark?.isAbsent ?? false };
        }),
        total: totals.get(student.id)!,
      };
    });

    // Best rank first; students whose total isn't computable yet (marks
    // entry still incomplete for them) sort after, alphabetically.
    rows.sort((a, b) => {
      if (a.total.rank !== null && b.total.rank !== null) return a.total.rank - b.total.rank;
      if (a.total.rank !== null) return -1;
      if (b.total.rank !== null) return 1;
      return a.student.name.localeCompare(b.student.name);
    });

    return {
      exam,
      schedule: {
        id: schedule.id,
        class: { id: schedule.class.id, name: schedule.class.name },
        status: schedule.status,
        startDate: schedule.startDate,
        endDate: schedule.endDate,
      },
      subjects: schedule.subjects.map((s) => ({
        examSubjectId: s.id,
        subject: { id: s.subject.id, name: s.subject.name },
        maxMarks: s.maxMarks,
      })),
      rows,
    };
  }

  // ---- Marks entry ----

  async getMarksRoster(
    examId: number,
    scheduleId: number,
    query: ExamMarksRosterQueryDto,
    actor: AuthenticatedUser,
  ): Promise<ExamMarkRosterRow[]> {
    const schedule = await this.findScheduleRowOrThrow(examId, scheduleId);
    const examSubject = this.findExamSubjectOrThrow(schedule, query.subjectId);
    if (actor.roleName === TEACHER_ROLE) {
      const teacher = await this.getOwnTeacher(actor.id);
      await this.assertAssignedToTeach(teacher.id, schedule.classId, query.sectionId, query.subjectId);
    }

    const [students, marks] = await Promise.all([
      this.prisma.student.findMany({
        where: { classId: schedule.classId, sectionId: query.sectionId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.examMark.findMany({ where: { examSubjectId: examSubject.id, sectionId: query.sectionId } }),
    ]);
    const byStudentId = new Map(marks.map((m) => [m.studentId, m]));

    return students.map((s) => {
      const mark = byStudentId.get(s.id);
      return {
        student: { id: s.id, name: s.name, admissionNo: s.admissionNo },
        marksObtained: mark?.marksObtained ?? null,
        isAbsent: mark?.isAbsent ?? false,
        remarks: mark?.remarks ?? null,
      };
    });
  }

  async saveMarksBulk(
    examId: number,
    scheduleId: number,
    dto: BulkMarksDto,
    actor: AuthenticatedUser,
  ): Promise<ExamMarkRosterRow[]> {
    const schedule = await this.findScheduleRowOrThrow(examId, scheduleId);
    const examSubject = this.findExamSubjectOrThrow(schedule, dto.subjectId);
    if (actor.roleName === TEACHER_ROLE) {
      const teacher = await this.getOwnTeacher(actor.id);
      await this.assertAssignedToTeach(teacher.id, schedule.classId, dto.sectionId, dto.subjectId);
    }

    const studentIds = dto.records.map((r) => r.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException('The same student was listed more than once');
    }
    const validStudents = await this.prisma.student.count({
      where: { id: { in: studentIds }, classId: schedule.classId, sectionId: dto.sectionId, isActive: true },
    });
    if (validStudents !== studentIds.length) {
      throw new BadRequestException('One or more students do not belong to this class and section');
    }
    for (const r of dto.records) {
      if (!r.isAbsent && r.marksObtained === undefined) {
        throw new BadRequestException('Marks are required for every student unless marked absent');
      }
      if (!r.isAbsent && r.marksObtained !== undefined && r.marksObtained > examSubject.maxMarks) {
        throw new BadRequestException(`Marks cannot exceed ${examSubject.maxMarks}`);
      }
    }

    // Captured before the upsert so each row's audit entry can tell CREATE
    // (first mark for that student) apart from UPDATE (a correction) — same
    // pattern as AttendanceService.markBulk().
    const existingRows = await this.prisma.examMark.findMany({
      where: { examSubjectId: examSubject.id, studentId: { in: studentIds } },
    });
    const existingByStudentId = new Map(existingRows.map((r) => [r.studentId, r]));

    const rows = await this.prisma.$transaction(
      dto.records.map((r) =>
        this.prisma.examMark.upsert({
          where: { examSubjectId_studentId: { examSubjectId: examSubject.id, studentId: r.studentId } },
          update: {
            marksObtained: r.isAbsent ? null : r.marksObtained,
            isAbsent: !!r.isAbsent,
            sectionId: dto.sectionId,
            enteredById: actor.id,
          },
          create: {
            examSubjectId: examSubject.id,
            studentId: r.studentId,
            sectionId: dto.sectionId,
            marksObtained: r.isAbsent ? null : r.marksObtained,
            isAbsent: !!r.isAbsent,
            enteredById: actor.id,
          },
        }),
      ),
    );

    await Promise.all(
      rows.map((row) => {
        const before = existingByStudentId.get(row.studentId) ?? null;
        return this.audit.record({
          entityType: 'ExamMark',
          entityId: row.id,
          action: before ? 'UPDATE' : 'CREATE',
          userId: actor.id,
          oldValues: before,
          newValues: row,
        });
      }),
    );

    return this.getMarksRoster(examId, scheduleId, { subjectId: dto.subjectId, sectionId: dto.sectionId }, actor);
  }

  // ---- Exam (umbrella) ----

  async create(dto: CreateExamDto, actor: AuthenticatedUser): Promise<ExamView> {
    if (dto.startDate && dto.endDate) {
      this.assertDateRangeValid(dto.startDate, dto.endDate);
    }
    if (dto.schedule) {
      this.assertDateRangeValid(dto.schedule.startDate, dto.schedule.endDate);
      await this.assertSubjectsBelongToClass(dto.schedule.classId, dto.schedule.subjects);
    }

    try {
      const row = await this.prisma.exam.create({
        data: {
          name: dto.name,
          type: dto.type,
          startDate: dto.startDate ? new Date(dto.startDate) : undefined,
          endDate: dto.endDate ? new Date(dto.endDate) : undefined,
          createdById: actor.id,
          schedules: dto.schedule
            ? {
                create: [
                  {
                    classId: dto.schedule.classId,
                    startDate: new Date(dto.schedule.startDate),
                    endDate: new Date(dto.schedule.endDate),
                    createdById: actor.id,
                    subjects: {
                      create: dto.schedule.subjects.map((s) => ({
                        subjectId: s.subjectId,
                        maxMarks: s.maxMarks,
                        passMarks: s.passMarks,
                        examDate: s.examDate ? new Date(s.examDate) : undefined,
                      })),
                    },
                  },
                ],
              }
            : undefined,
        },
        include: EXAM_INCLUDE,
      });
      await this.audit.record({
        entityType: 'Exam',
        entityId: row.id,
        action: 'CREATE',
        userId: actor.id,
        newValues: row,
      });
      return this.toView(row);
    } catch (error) {
      throw this.mapError(error);
    }
  }

  async update(id: number, dto: UpdateExamDto, actor: AuthenticatedUser): Promise<ExamView> {
    const existing = await this.findRowOrThrow(id);

    const effectiveStart = dto.startDate ?? existing.startDate?.toISOString();
    const effectiveEnd = dto.endDate ?? existing.endDate?.toISOString();
    if (effectiveStart && effectiveEnd) {
      this.assertDateRangeValid(effectiveStart, effectiveEnd);
    }

    const row = await this.prisma.exam.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
      include: EXAM_INCLUDE,
    });
    await this.audit.record({
      entityType: 'Exam',
      entityId: row.id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });
    return this.toView(row);
  }

  async remove(id: number, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.findRowOrThrow(id);
    // Cascades exam_schedules -> exam_subjects -> exam_marks.
    await this.prisma.exam.delete({ where: { id } });
    await this.audit.record({
      entityType: 'Exam',
      entityId: id,
      action: 'DELETE',
      userId: actor.id,
      oldValues: existing,
    });
  }

  // ---- Schedules (one per class added under an Exam) ----

  /** Adds one more class to an existing Exam — fully independent of every
   * other class already scheduled under it: its own dates, its own subject
   * list picked from that class's real subjects, no name-matching, no
   * shared template. */
  async addSchedule(examId: number, dto: CreateExamScheduleDto, actor: AuthenticatedUser): Promise<ExamView> {
    await this.findRowOrThrow(examId);
    this.assertDateRangeValid(dto.startDate, dto.endDate);
    await this.assertSubjectsBelongToClass(dto.classId, dto.subjects);

    try {
      const created = await this.prisma.examSchedule.create({
        data: {
          examId,
          classId: dto.classId,
          startDate: new Date(dto.startDate),
          endDate: new Date(dto.endDate),
          createdById: actor.id,
          subjects: {
            create: dto.subjects.map((s) => ({
              subjectId: s.subjectId,
              maxMarks: s.maxMarks,
              passMarks: s.passMarks,
              examDate: s.examDate ? new Date(s.examDate) : undefined,
            })),
          },
        },
      });
      await this.audit.record({
        entityType: 'ExamSchedule',
        entityId: created.id,
        action: 'CREATE',
        userId: actor.id,
        newValues: created,
      });
    } catch (error) {
      throw this.mapError(error);
    }

    return this.toView(await this.findRowOrThrow(examId));
  }

  async updateSchedule(
    examId: number,
    scheduleId: number,
    dto: UpdateExamScheduleDto,
    actor: AuthenticatedUser,
  ): Promise<ExamView> {
    const existing = await this.findScheduleRowOrThrow(examId, scheduleId);
    this.assertDateRangeValid(
      dto.startDate ?? existing.startDate.toISOString(),
      dto.endDate ?? existing.endDate.toISOString(),
    );

    const row = await this.prisma.examSchedule.update({
      where: { id: scheduleId },
      data: {
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      },
    });
    await this.audit.record({
      entityType: 'ExamSchedule',
      entityId: row.id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });

    return this.toView(await this.findRowOrThrow(examId));
  }

  async removeSchedule(examId: number, scheduleId: number, actor: AuthenticatedUser): Promise<ExamView> {
    const existing = await this.findScheduleRowOrThrow(examId, scheduleId);
    // Cascades exam_subjects -> exam_marks for this class only.
    await this.prisma.examSchedule.delete({ where: { id: scheduleId } });
    await this.audit.record({
      entityType: 'ExamSchedule',
      entityId: scheduleId,
      action: 'DELETE',
      userId: actor.id,
      oldValues: existing,
    });

    return this.toView(await this.findRowOrThrow(examId));
  }

  /** Flips one class's schedule to PUBLISHED — the gate that makes its
   * marks visible to students (see findResultsForStudent). Deliberately
   * per-schedule, not umbrella-wide: one class's marks being ready doesn't
   * mean every other class scheduled under the same Exam name is. */
  async publishSchedule(examId: number, scheduleId: number, actor: AuthenticatedUser): Promise<ExamView> {
    const existing = await this.findScheduleRowOrThrow(examId, scheduleId);
    const row = await this.prisma.examSchedule.update({
      where: { id: scheduleId },
      data: { status: 'PUBLISHED' },
    });
    await this.audit.record({
      entityType: 'ExamSchedule',
      entityId: row.id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });

    const updated = this.toView(await this.findRowOrThrow(examId));

    // Awaited, not fire-and-forget — same reasoning as
    // AnnouncementsService.create(): the production API runs on Vercel's
    // serverless functions, which freeze immediately once the response is
    // sent. A push failure must never fail the publish itself, though.
    try {
      await this.pushNotifications.notifyClassStudents(existing.classId, {
        title: 'Results published',
        body: `${updated.name} results are now available.`,
        data: { type: 'examResult', examId, scheduleId },
      });
    } catch (error) {
      this.logger.error(
        'Failed to send exam-published push notifications',
        error instanceof Error ? error.stack : error,
      );
    }

    return updated;
  }

  async unpublishSchedule(examId: number, scheduleId: number, actor: AuthenticatedUser): Promise<ExamView> {
    const existing = await this.findScheduleRowOrThrow(examId, scheduleId);
    const row = await this.prisma.examSchedule.update({
      where: { id: scheduleId },
      data: { status: 'DRAFT' },
    });
    await this.audit.record({
      entityType: 'ExamSchedule',
      entityId: row.id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });
    return this.toView(await this.findRowOrThrow(examId));
  }

  // ---- Subjects (nested under one schedule) ----

  async addSubject(
    examId: number,
    scheduleId: number,
    dto: CreateExamSubjectDto,
    actor: AuthenticatedUser,
  ): Promise<ExamView> {
    const schedule = await this.findScheduleRowOrThrow(examId, scheduleId);
    await this.assertSubjectsBelongToClass(schedule.classId, [dto]);
    this.assertPassMarksValid(dto.maxMarks, dto.passMarks);

    try {
      const created = await this.prisma.examSubject.create({
        data: {
          examScheduleId: scheduleId,
          subjectId: dto.subjectId,
          maxMarks: dto.maxMarks,
          passMarks: dto.passMarks,
          examDate: dto.examDate ? new Date(dto.examDate) : undefined,
        },
      });
      await this.audit.record({
        entityType: 'ExamSubject',
        entityId: created.id,
        action: 'CREATE',
        userId: actor.id,
        newValues: created,
      });
    } catch (error) {
      throw this.mapError(error);
    }

    return this.toView(await this.findRowOrThrow(examId));
  }

  async updateSubject(
    examId: number,
    scheduleId: number,
    examSubjectId: number,
    dto: UpdateExamSubjectDto,
    actor: AuthenticatedUser,
  ): Promise<ExamView> {
    const existing = await this.findSubjectRowOrThrow(scheduleId, examSubjectId);
    this.assertPassMarksValid(dto.maxMarks ?? existing.maxMarks, dto.passMarks ?? existing.passMarks ?? undefined);

    const row = await this.prisma.examSubject.update({
      where: { id: examSubjectId },
      data: {
        maxMarks: dto.maxMarks,
        passMarks: dto.passMarks,
        examDate: dto.examDate ? new Date(dto.examDate) : undefined,
      },
    });
    await this.audit.record({
      entityType: 'ExamSubject',
      entityId: row.id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });

    return this.toView(await this.findRowOrThrow(examId));
  }

  async removeSubject(
    examId: number,
    scheduleId: number,
    examSubjectId: number,
    actor: AuthenticatedUser,
  ): Promise<ExamView> {
    const existing = await this.findSubjectRowOrThrow(scheduleId, examSubjectId);
    const marksEntered = await this.prisma.examMark.count({ where: { examSubjectId } });
    if (marksEntered > 0) {
      throw new ConflictException('Marks have already been entered for this subject — remove them first');
    }

    await this.prisma.examSubject.delete({ where: { id: examSubjectId } });
    await this.audit.record({
      entityType: 'ExamSubject',
      entityId: examSubjectId,
      action: 'DELETE',
      userId: actor.id,
      oldValues: existing,
    });

    return this.toView(await this.findRowOrThrow(examId));
  }

  // ---- Shared helpers ----

  private async findRowOrThrow(id: number): Promise<ExamWithRefs> {
    const row = await this.prisma.exam.findUnique({ where: { id }, include: EXAM_INCLUDE });
    if (!row) throw new NotFoundException('Exam not found');
    return row;
  }

  private async findScheduleRowOrThrow(examId: number, scheduleId: number): Promise<ScheduleWithRefs> {
    const row = await this.prisma.examSchedule.findUnique({ where: { id: scheduleId }, include: SCHEDULE_INCLUDE });
    if (!row || row.examId !== examId) {
      throw new NotFoundException('That class schedule is not part of this exam');
    }
    return row;
  }

  private async findSubjectRowOrThrow(scheduleId: number, examSubjectId: number): Promise<ExamSubjectWithRefs> {
    const row = await this.prisma.examSubject.findUnique({
      where: { id: examSubjectId },
      include: { subject: true },
    });
    if (!row || row.examScheduleId !== scheduleId) {
      throw new NotFoundException('That subject is not part of this schedule');
    }
    return row;
  }

  /** Looks up an already-loaded schedule's ExamSubject row by the underlying
   * Subject's id (what marks-entry callers pass) — no extra query, unlike
   * findSubjectRowOrThrow above which takes the join row's own id. */
  private findExamSubjectOrThrow(schedule: ScheduleWithRefs, subjectId: number): ScheduleWithRefs['subjects'][number] {
    const examSubject = schedule.subjects.find((s) => s.subject.id === subjectId);
    if (!examSubject) throw new NotFoundException('That subject is not part of this schedule');
    return examSubject;
  }

  private async getOwnTeacher(userId: number): Promise<Teacher> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new ForbiddenException('No teacher profile for this account');
    return teacher;
  }

  private async getOwnStudent(userId: number): Promise<Student> {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new ForbiddenException('No student profile for this account');
    return student;
  }

  /** A teacher may only enter marks for a class+section+subject they're
   * actually assigned to teach (a TeacherClassSubject row) — same ownership
   * discipline AssignmentsService applies to setting homework. */
  private async assertAssignedToTeach(
    teacherId: number,
    classId: number,
    sectionId: number,
    subjectId: number,
  ): Promise<void> {
    const assignment = await this.prisma.teacherClassSubject.findFirst({
      where: { teacherId, classId, sectionId, subjectId },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to teach this class, section and subject');
    }
  }

  private assertDateRangeValid(startDate: string, endDate: string): void {
    if (new Date(endDate) < new Date(startDate)) {
      throw new BadRequestException('End date must be on or after the start date');
    }
  }

  /** Cross-subject total, percentage and competition rank (ties share a
   * rank; the next rank skips accordingly — 1, 2, 2, 4) for every given
   * student, scoped to one ExamSchedule's subject list and marks. A
   * student's total stays null until every subject has a recorded
   * ExamMark for them (graded or absent) — see ScheduleStudentTotal's doc
   * comment for why. Shared by getReportCard (whole class) and
   * findResultsForStudent (one student, but rank still needs the whole
   * class's totals to place them). */
  private computeClassTotals(
    studentIds: number[],
    examSubjects: Array<{ id: number; maxMarks: number }>,
    marks: Array<{ studentId: number; examSubjectId: number; marksObtained: number | null; isAbsent: boolean }>,
  ): Map<number, ScheduleStudentTotal> {
    const totalMax = examSubjects.reduce((sum, s) => sum + s.maxMarks, 0);

    const marksByStudentId = new Map<number, Map<number, (typeof marks)[number]>>();
    for (const m of marks) {
      if (!marksByStudentId.has(m.studentId)) marksByStudentId.set(m.studentId, new Map());
      marksByStudentId.get(m.studentId)!.set(m.examSubjectId, m);
    }

    const partial = new Map<number, { totalObtained: number | null; percentage: number | null }>();
    for (const studentId of studentIds) {
      const byExamSubjectId = marksByStudentId.get(studentId);
      const complete =
        examSubjects.length > 0 && byExamSubjectId !== undefined && examSubjects.every((s) => byExamSubjectId.has(s.id));
      const totalObtained = complete
        ? examSubjects.reduce((sum, s) => sum + (byExamSubjectId!.get(s.id)!.isAbsent ? 0 : byExamSubjectId!.get(s.id)!.marksObtained ?? 0), 0)
        : null;
      const percentage = totalObtained !== null ? Math.round((totalObtained / totalMax) * 1000) / 10 : null;
      partial.set(studentId, { totalObtained, percentage });
    }

    const ranked = [...partial.entries()]
      .filter((entry): entry is [number, { totalObtained: number; percentage: number }] => entry[1].totalObtained !== null)
      .sort((a, b) => b[1].totalObtained - a[1].totalObtained);

    const rankByStudentId = new Map<number, number>();
    let rank = 0;
    let lastTotal: number | null = null;
    let seen = 0;
    for (const [studentId, t] of ranked) {
      seen++;
      if (t.totalObtained !== lastTotal) {
        rank = seen;
        lastTotal = t.totalObtained;
      }
      rankByStudentId.set(studentId, rank);
    }

    const result = new Map<number, ScheduleStudentTotal>();
    for (const studentId of studentIds) {
      const t = partial.get(studentId)!;
      result.set(studentId, {
        totalObtained: t.totalObtained,
        totalMax,
        percentage: t.percentage,
        rank: rankByStudentId.get(studentId) ?? null,
      });
    }
    return result;
  }

  private assertPassMarksValid(maxMarks: number, passMarks: number | undefined): void {
    if (passMarks !== undefined && passMarks > maxMarks) {
      throw new BadRequestException('Pass marks cannot exceed max marks');
    }
  }

  /** Every subject in the payload must actually belong to the schedule's
   * class — a subjectId that exists but under a different class is still a
   * valid FK target, so this has to be checked explicitly rather than
   * relying on a P2003 failure. */
  private async assertSubjectsBelongToClass(
    classId: number,
    subjects: Array<{ subjectId: number; maxMarks: number; passMarks?: number }>,
  ): Promise<void> {
    const subjectIds = subjects.map((s) => s.subjectId);
    if (new Set(subjectIds).size !== subjectIds.length) {
      throw new BadRequestException('The same subject was listed more than once');
    }
    for (const s of subjects) {
      this.assertPassMarksValid(s.maxMarks, s.passMarks);
    }

    const found = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds }, classId },
      select: { id: true },
    });
    if (found.length !== subjectIds.length) {
      throw new BadRequestException('One or more subjects do not belong to this class');
    }
  }

  private toView(row: ExamWithRefs): ExamView {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      startDate: row.startDate,
      endDate: row.endDate,
      createdBy: row.createdBy ? { id: row.createdBy.id, name: row.createdBy.name } : null,
      schedules: row.schedules.map((sch) => ({
        id: sch.id,
        examId: sch.examId,
        class: { id: sch.class.id, name: sch.class.name },
        academicYear: { id: sch.class.academicYear.id, name: sch.class.academicYear.name },
        startDate: sch.startDate,
        endDate: sch.endDate,
        status: sch.status,
        createdBy: sch.createdBy ? { id: sch.createdBy.id, name: sch.createdBy.name } : null,
        subjects: sch.subjects.map((s) => ({
          id: s.id,
          subject: { id: s.subject.id, name: s.subject.name },
          maxMarks: s.maxMarks,
          passMarks: s.passMarks,
          examDate: s.examDate,
        })),
        createdAt: sch.createdAt,
        updatedAt: sch.updatedAt,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') return new BadRequestException('Unknown classId or subjectId');
      if (error.code === 'P2002') {
        // MySQL gives meta.target as the violated index's name (a string);
        // other providers give an array of column names — normalize both.
        const target = error.meta?.target;
        const targetText = Array.isArray(target) ? target.join(',') : String(target ?? '');
        if (targetText.includes('examId')) {
          return new ConflictException('This class has already been scheduled for this exam');
        }
        return new BadRequestException('That subject is already part of this schedule');
      }
    }
    return error as Error;
  }
}
