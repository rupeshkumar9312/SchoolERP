import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ExamStatus, ExamType, Prisma, Teacher } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { TEACHER_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import { BulkMarksDto } from './dto/bulk-marks.dto';
import { CreateExamSubjectDto } from './dto/create-exam-subject.dto';
import { CreateExamDto } from './dto/create-exam.dto';
import { ExamMarksRosterQueryDto } from './dto/exam-marks-roster.query.dto';
import { ListExamsQueryDto } from './dto/list-exams.query.dto';
import { UpdateExamSubjectDto } from './dto/update-exam-subject.dto';
import { UpdateExamDto } from './dto/update-exam.dto';

export interface ExamSubjectView {
  id: number;
  subject: { id: number; name: string };
  maxMarks: number;
  passMarks: number | null;
  examDate: Date | null;
}

export interface ExamView {
  id: number;
  name: string;
  type: ExamType;
  class: { id: number; name: string };
  academicYear: { id: number; name: string };
  startDate: Date;
  endDate: Date;
  status: ExamStatus;
  createdBy: { id: number; name: string } | null;
  subjects: ExamSubjectView[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ExamMarkRosterRow {
  student: { id: number; name: string; admissionNo: string | null };
  marksObtained: number | null;
  isAbsent: boolean;
  remarks: string | null;
}

/** One row per (exam, subject a teacher teaches, section they teach it in) —
 * a teacher may teach the same exam's subject in several sections, or teach
 * several of an exam's subjects, so this is a flattened list of concrete
 * marks-entry targets, not one row per exam. */
export interface TeacherExamEntry {
  exam: { id: number; name: string; type: ExamType; status: ExamStatus; startDate: Date; endDate: Date };
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

type ExamWithRefs = Prisma.ExamGetPayload<{ include: typeof EXAM_INCLUDE }>;
type ExamSubjectWithRefs = Prisma.ExamSubjectGetPayload<{ include: { subject: true } }>;

const EXAM_INCLUDE = {
  class: { include: { academicYear: true } },
  createdBy: true,
  subjects: { include: { subject: true }, orderBy: { id: 'asc' } },
} satisfies Prisma.ExamInclude;

@Injectable()
export class ExamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: ListExamsQueryDto): Promise<ExamView[]> {
    const rows = await this.prisma.exam.findMany({
      where: {
        classId: query.classId,
        type: query.type,
        status: query.status,
        class: query.academicYearId ? { academicYearId: query.academicYearId } : undefined,
      },
      include: EXAM_INCLUDE,
      orderBy: { startDate: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async findOne(id: number): Promise<ExamView> {
    return this.toView(await this.findRowOrThrow(id));
  }

  /** Identity-pinned "me" route for a TEACHER — every (exam, subject, section)
   * combination they may enter marks for, flattened from their
   * TeacherClassSubject rows intersected with each exam's subject list. */
  async findForTeacher(actor: AuthenticatedUser): Promise<TeacherExamEntry[]> {
    const teacher = await this.getOwnTeacher(actor.id);
    const assignments = await this.prisma.teacherClassSubject.findMany({ where: { teacherId: teacher.id } });
    if (assignments.length === 0) return [];

    const classIds = [...new Set(assignments.map((a) => a.classId))];
    const sectionIds = [...new Set(assignments.map((a) => a.sectionId))];
    const [exams, sections] = await Promise.all([
      this.prisma.exam.findMany({
        where: { classId: { in: classIds } },
        include: EXAM_INCLUDE,
        orderBy: { startDate: 'desc' },
      }),
      this.prisma.section.findMany({ where: { id: { in: sectionIds } } }),
    ]);
    const sectionById = new Map(sections.map((s) => [s.id, s]));

    const entries: TeacherExamEntry[] = [];
    for (const exam of exams) {
      for (const a of assignments.filter((x) => x.classId === exam.classId)) {
        const examSubject = exam.subjects.find((s) => s.subject.id === a.subjectId);
        const section = sectionById.get(a.sectionId);
        if (!examSubject || !section) continue;

        const [enteredCount, totalStudents] = await Promise.all([
          this.prisma.examMark.count({ where: { examSubjectId: examSubject.id, sectionId: a.sectionId } }),
          this.prisma.student.count({ where: { classId: exam.classId, sectionId: a.sectionId, isActive: true } }),
        ]);
        entries.push({
          exam: {
            id: exam.id,
            name: exam.name,
            type: exam.type,
            status: exam.status,
            startDate: exam.startDate,
            endDate: exam.endDate,
          },
          class: { id: exam.class.id, name: exam.class.name },
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

  /** Per-subject "entered X / Y" progress across the whole exam class (every
   * section), for the admin exam-detail page — not scoped to one teacher's
   * section like the roster/bulk-save methods below. */
  async getProgress(examId: number): Promise<ExamSubjectProgress[]> {
    const exam = await this.findRowOrThrow(examId);
    const examSubjectIds = exam.subjects.map((s) => s.id);
    const [totalStudents, counts] = await Promise.all([
      this.prisma.student.count({ where: { classId: exam.classId, isActive: true } }),
      this.prisma.examMark.groupBy({
        by: ['examSubjectId'],
        where: { examSubjectId: { in: examSubjectIds } },
        _count: { _all: true },
      }),
    ]);
    const enteredByExamSubjectId = new Map(counts.map((c) => [c.examSubjectId, c._count._all]));

    return exam.subjects.map((s) => ({
      examSubjectId: s.id,
      subject: { id: s.subject.id, name: s.subject.name },
      enteredCount: enteredByExamSubjectId.get(s.id) ?? 0,
      totalStudents,
    }));
  }

  // ---- Marks entry ----

  async getMarksRoster(
    examId: number,
    query: ExamMarksRosterQueryDto,
    actor: AuthenticatedUser,
  ): Promise<ExamMarkRosterRow[]> {
    const exam = await this.findRowOrThrow(examId);
    const examSubject = this.findExamSubjectOrThrow(exam, query.subjectId);
    if (actor.roleName === TEACHER_ROLE) {
      const teacher = await this.getOwnTeacher(actor.id);
      await this.assertAssignedToTeach(teacher.id, exam.classId, query.sectionId, query.subjectId);
    }

    const [students, marks] = await Promise.all([
      this.prisma.student.findMany({
        where: { classId: exam.classId, sectionId: query.sectionId, isActive: true },
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
    dto: BulkMarksDto,
    actor: AuthenticatedUser,
  ): Promise<ExamMarkRosterRow[]> {
    const exam = await this.findRowOrThrow(examId);
    const examSubject = this.findExamSubjectOrThrow(exam, dto.subjectId);
    if (actor.roleName === TEACHER_ROLE) {
      const teacher = await this.getOwnTeacher(actor.id);
      await this.assertAssignedToTeach(teacher.id, exam.classId, dto.sectionId, dto.subjectId);
    }

    const studentIds = dto.records.map((r) => r.studentId);
    if (new Set(studentIds).size !== studentIds.length) {
      throw new BadRequestException('The same student was listed more than once');
    }
    const validStudents = await this.prisma.student.count({
      where: { id: { in: studentIds }, classId: exam.classId, sectionId: dto.sectionId, isActive: true },
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

    return this.getMarksRoster(examId, { subjectId: dto.subjectId, sectionId: dto.sectionId }, actor);
  }

  async create(dto: CreateExamDto, actor: AuthenticatedUser): Promise<ExamView> {
    this.assertDateRangeValid(dto.startDate, dto.endDate);
    await this.assertSubjectsBelongToClass(dto.classId, dto.subjects);

    try {
      const row = await this.prisma.exam.create({
        data: {
          name: dto.name,
          type: dto.type,
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
    this.assertDateRangeValid(
      dto.startDate ?? existing.startDate.toISOString(),
      dto.endDate ?? existing.endDate.toISOString(),
    );

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
    // Cascades exam_subjects and, transitively, exam_marks.
    await this.prisma.exam.delete({ where: { id } });
    await this.audit.record({
      entityType: 'Exam',
      entityId: id,
      action: 'DELETE',
      userId: actor.id,
      oldValues: existing,
    });
  }

  // ---- Subjects ----

  async addSubject(
    examId: number,
    dto: CreateExamSubjectDto,
    actor: AuthenticatedUser,
  ): Promise<ExamView> {
    const exam = await this.findRowOrThrow(examId);
    await this.assertSubjectsBelongToClass(exam.classId, [dto]);
    this.assertPassMarksValid(dto.maxMarks, dto.passMarks);

    try {
      const created = await this.prisma.examSubject.create({
        data: {
          examId,
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
    examSubjectId: number,
    dto: UpdateExamSubjectDto,
    actor: AuthenticatedUser,
  ): Promise<ExamView> {
    const existing = await this.findSubjectRowOrThrow(examId, examSubjectId);
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

  async removeSubject(examId: number, examSubjectId: number, actor: AuthenticatedUser): Promise<ExamView> {
    const existing = await this.findSubjectRowOrThrow(examId, examSubjectId);
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

  private async findSubjectRowOrThrow(
    examId: number,
    examSubjectId: number,
  ): Promise<ExamSubjectWithRefs> {
    const row = await this.prisma.examSubject.findUnique({
      where: { id: examSubjectId },
      include: { subject: true },
    });
    if (!row || row.examId !== examId) {
      throw new NotFoundException('That subject is not part of this exam');
    }
    return row;
  }

  /** Looks up an already-loaded exam's ExamSubject row by the underlying
   * Subject's id (what marks-entry callers pass) — no extra query, unlike
   * findSubjectRowOrThrow above which takes the join row's own id. */
  private findExamSubjectOrThrow(exam: ExamWithRefs, subjectId: number): ExamWithRefs['subjects'][number] {
    const examSubject = exam.subjects.find((s) => s.subject.id === subjectId);
    if (!examSubject) throw new NotFoundException('That subject is not part of this exam');
    return examSubject;
  }

  private async getOwnTeacher(userId: number): Promise<Teacher> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new ForbiddenException('No teacher profile for this account');
    return teacher;
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

  private assertPassMarksValid(maxMarks: number, passMarks: number | undefined): void {
    if (passMarks !== undefined && passMarks > maxMarks) {
      throw new BadRequestException('Pass marks cannot exceed max marks');
    }
  }

  /** Every subject in the payload must actually belong to the exam's class —
   * a subjectId that exists but under a different class is still a valid FK
   * target, so this has to be checked explicitly rather than relying on a
   * P2003 failure. */
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
      class: { id: row.class.id, name: row.class.name },
      academicYear: { id: row.class.academicYear.id, name: row.class.academicYear.name },
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status,
      createdBy: row.createdBy ? { id: row.createdBy.id, name: row.createdBy.name } : null,
      subjects: row.subjects.map((s) => ({
        id: s.id,
        subject: { id: s.subject.id, name: s.subject.name },
        maxMarks: s.maxMarks,
        passMarks: s.passMarks,
        examDate: s.examDate,
      })),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private mapError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2003') return new BadRequestException('Unknown classId or subjectId');
      if (error.code === 'P2002') return new BadRequestException('That subject is already part of this exam');
    }
    return error as Error;
  }
}
