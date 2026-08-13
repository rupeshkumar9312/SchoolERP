import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { TEACHER_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ListAttendanceQueryDto } from './dto/list-attendance.query.dto';
import { MarkAttendanceDto } from './dto/mark-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

export interface AttendanceView {
  id: number;
  student: { id: number; name: string; admissionNo: string };
  class: { id: number; name: string };
  section: { id: number; name: string };
  date: string;
  status: string;
  markedBy: { id: number; name: string };
  createdAt: Date;
  updatedAt: Date;
}

type AttendanceWithRefs = Prisma.StudentAttendanceGetPayload<{
  include: { student: true; class: true; section: true; markedBy: true };
}>;

const ATTENDANCE_INCLUDE = { student: true, class: true, section: true, markedBy: true } as const;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async markBulk(dto: MarkAttendanceDto, actor: AuthenticatedUser): Promise<AttendanceView[]> {
    await this.assertSectionBelongsToClass(dto.sectionId, dto.classId);

    if (this.isScopedToOwnClasses(actor)) {
      await this.assertIsClassTeacher(actor.id, dto.classId, dto.sectionId);
      this.assertSameDayForTeacher(new Date(dto.date));
    }

    const studentIds = dto.records.map((r) => r.studentId);
    await this.assertStudentsBelongToSection(studentIds, dto.sectionId);

    const date = new Date(dto.date);

    // Captured before the upsert so each row's audit entry can tell CREATE
    // (no prior record for that student+date) apart from UPDATE (a correction).
    const existingRows = await this.prisma.studentAttendance.findMany({
      where: { date, studentId: { in: studentIds } },
    });
    const existingByStudentId = new Map(existingRows.map((r) => [r.studentId, r]));

    const rows = await this.prisma.$transaction(
      dto.records.map((record) =>
        this.prisma.studentAttendance.upsert({
          where: { studentId_date: { studentId: record.studentId, date } },
          update: {
            status: record.status,
            classId: dto.classId,
            sectionId: dto.sectionId,
            markedById: actor.id,
          },
          create: {
            studentId: record.studentId,
            date,
            status: record.status,
            classId: dto.classId,
            sectionId: dto.sectionId,
            markedById: actor.id,
          },
          include: ATTENDANCE_INCLUDE,
        }),
      ),
    );

    await Promise.all(
      rows.map((row) => {
        const before = existingByStudentId.get(row.studentId) ?? null;
        return this.audit.record({
          entityType: 'StudentAttendance',
          entityId: row.id,
          action: before ? 'UPDATE' : 'CREATE',
          userId: actor.id,
          oldValues: before,
          newValues: row,
        });
      }),
    );

    return rows.map((r) => this.toView(r));
  }

  /** Identity-pinned "me" route for a STUDENT — resolved from the caller's own
   * Student row via userId, same pattern as TeacherAttendanceService's
   * self-mark scoping. Full history, not a single date, since a student has
   * no picker UI for it. */
  async findForStudent(userId: number): Promise<AttendanceView[]> {
    const student = await this.prisma.student.findUnique({ where: { userId } });
    if (!student) throw new NotFoundException('No student profile for this account');

    const rows = await this.prisma.studentAttendance.findMany({
      where: { studentId: student.id },
      include: ATTENDANCE_INCLUDE,
      orderBy: { date: 'desc' },
    });
    return rows.map((r) => this.toView(r));
  }

  /**
   * Full attendance history for a single student, regardless of date — backs
   * the "search any student" flows on web and mobile. ADMIN-tier can look up
   * anyone; a TEACHER is scoped to students in a class/section they teach a
   * subject in or are the homeroom teacher of. Deliberately broader than the
   * homeroom-only scope used for marking/editing, since this is read-only and
   * mirrors what StudentsService.findForTeacher already exposes via
   * /students/my-classes.
   */
  async findHistoryForStudent(studentId: number, actor: AuthenticatedUser): Promise<AttendanceView[]> {
    const student = await this.prisma.student.findUnique({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    if (this.isScopedToOwnClasses(actor)) {
      await this.assertCanViewStudent(actor.id, student.classId, student.sectionId);
    }

    const rows = await this.prisma.studentAttendance.findMany({
      where: { studentId },
      include: ATTENDANCE_INCLUDE,
      orderBy: { date: 'desc' },
    });
    return rows.map((r) => this.toView(r));
  }

  private async assertCanViewStudent(userId: number, classId: number, sectionId: number): Promise<void> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new ForbiddenException('No teacher profile for this account');

    const [teaches, isClassTeacher] = await Promise.all([
      this.prisma.teacherClassSubject.findFirst({
        where: { teacherId: teacher.id, classId, sectionId },
      }),
      this.prisma.section.findFirst({
        where: { id: sectionId, classId, classTeacherId: teacher.id },
      }),
    ]);
    if (!teaches && !isClassTeacher) {
      throw new ForbiddenException('You do not teach this student');
    }
  }

  async findAll(
    query: ListAttendanceQueryDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceView[]> {
    await this.assertSectionBelongsToClass(query.sectionId, query.classId);

    if (this.isScopedToOwnClasses(actor)) {
      await this.assertIsClassTeacher(actor.id, query.classId, query.sectionId);
    }

    const rows = await this.prisma.studentAttendance.findMany({
      where: { classId: query.classId, sectionId: query.sectionId, date: new Date(query.date) },
      include: ATTENDANCE_INCLUDE,
      orderBy: { student: { name: 'asc' } },
    });
    return rows.map((r) => this.toView(r));
  }

  async update(
    id: number,
    dto: UpdateAttendanceDto,
    actor: AuthenticatedUser,
  ): Promise<AttendanceView> {
    const existing = await this.prisma.studentAttendance.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Attendance record not found');

    if (this.isScopedToOwnClasses(actor)) {
      await this.assertIsClassTeacher(actor.id, existing.classId, existing.sectionId);
      this.assertSameDayForTeacher(existing.date);
    }

    const row = await this.prisma.studentAttendance.update({
      where: { id },
      data: { status: dto.status, markedById: actor.id },
      include: ATTENDANCE_INCLUDE,
    });
    await this.audit.record({
      entityType: 'StudentAttendance',
      entityId: id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });
    return this.toView(row);
  }

  /** DIRECTOR/PRINCIPAL/ADMIN/SUPER_ADMIN have unrestricted access; only a bare TEACHER is scoped. */
  private isScopedToOwnClasses(actor: AuthenticatedUser): boolean {
    return actor.roleName === TEACHER_ROLE;
  }

  private assertSameDayForTeacher(date: Date): void {
    if (this.toDateOnly(date) !== this.toDateOnly(new Date())) {
      throw new ForbiddenException('Teachers can only mark or edit attendance for today');
    }
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  /**
   * Attendance rights belong to the section's class (homeroom) teacher, not
   * every subject teacher assigned to teach there — a TeacherClassSubject row
   * only proves someone teaches a subject in the section, not that they may
   * take its roll. classId is accepted (and re-checked) purely as defence in
   * depth against a caller passing a section that's since moved classes.
   */
  private async assertIsClassTeacher(
    userId: number,
    classId: number,
    sectionId: number,
  ): Promise<void> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new ForbiddenException('No teacher profile for this account');

    const section = await this.prisma.section.findUnique({ where: { id: sectionId } });
    if (!section || section.classId !== classId || section.classTeacherId !== teacher.id) {
      throw new ForbiddenException('You are not the class teacher of this section');
    }
  }

  private async assertSectionBelongsToClass(sectionId: number, classId: number): Promise<void> {
    const [klass, section] = await Promise.all([
      this.prisma.class.findUnique({ where: { id: classId } }),
      this.prisma.section.findUnique({ where: { id: sectionId } }),
    ]);
    if (!klass) throw new BadRequestException('Unknown classId');
    if (!section || section.classId !== classId) {
      throw new BadRequestException('That section does not belong to the given class');
    }
  }

  private async assertStudentsBelongToSection(
    studentIds: number[],
    sectionId: number,
  ): Promise<void> {
    const count = await this.prisma.student.count({ where: { id: { in: studentIds }, sectionId } });
    if (count !== new Set(studentIds).size) {
      throw new BadRequestException('One or more students do not belong to that class and section');
    }
  }

  private toView(row: AttendanceWithRefs): AttendanceView {
    return {
      id: row.id,
      student: { id: row.student.id, name: row.student.name, admissionNo: row.student.admissionNo },
      class: { id: row.class.id, name: row.class.name },
      section: { id: row.section.id, name: row.section.name },
      date: this.toDateOnly(row.date),
      status: row.status,
      markedBy: { id: row.markedBy.id, name: row.markedBy.name },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
