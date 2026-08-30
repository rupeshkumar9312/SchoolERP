import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit/audit-log.service';
import { STUDENT_ROLE } from '../auth/roles.constants';
import { edvanceLoginAlias, nextEdvanceId } from '../common/generate-edvance-id';
import { generateTempPassword } from '../common/generate-temp-password';
import { PaginatedResult, resolvePagination } from '../common/pagination';
import { withTransactionRetry } from '../common/with-transaction-retry';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students.query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

const PASSWORD_BCRYPT_ROUNDS = 10;
/** Synthetic login domain — students have no real email on file, only a
 * guardian's, so the login address is derived from the generated Edvance ID
 * rather than asking an admin to invent one at admission time. */
const STUDENT_LOGIN_EMAIL_DOMAIN = 'student.edvance.edu';

export interface StudentView {
  id: number;
  admissionNo: string | null;
  aadharNumber: string | null;
  name: string;
  dateOfBirth: Date | null;
  gender: string | null;
  class: { id: number; name: string };
  section: { id: number; name: string };
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  address: string | null;
  isActive: boolean;
  admissionDate: Date;
  createdAt: Date;
  hasLogin: boolean;
  /** null when hasLogin is false (a student admitted with no portal login). */
  edvanceId: string | null;
}

/** Only returned once, from create() — the plaintext password is never stored
 * or retrievable again, so an admin must copy/share it immediately.
 * `alias` is the short form of `email` (e.g. 'stu000123') — both work at login. */
export interface StudentCreateResult extends StudentView {
  login: { email: string; alias: string; temporaryPassword: string };
}

/** Exactly the fields toView() below reads — used everywhere a Student row
 * is fetched so no call site pulls the full related class/section/user rows
 * just to discard most of them. */
const STUDENT_SELECT = {
  id: true,
  admissionNo: true,
  aadharNumber: true,
  name: true,
  dateOfBirth: true,
  gender: true,
  class: { select: { id: true, name: true } },
  section: { select: { id: true, name: true } },
  guardianName: true,
  guardianPhone: true,
  guardianEmail: true,
  address: true,
  isActive: true,
  admissionDate: true,
  createdAt: true,
  userId: true,
  user: { select: { edvanceId: true } },
} satisfies Prisma.StudentSelect;

type StudentWithRefs = Prisma.StudentGetPayload<{ select: typeof STUDENT_SELECT }>;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: ListStudentsQueryDto): Promise<PaginatedResult<StudentView>> {
    const where: Prisma.StudentWhereInput = {
      classId: query.classId,
      sectionId: query.sectionId,
      ...(query.search
        ? {
            OR: [{ name: { contains: query.search } }, { admissionNo: { contains: query.search } }],
          }
        : {}),
    };
    const { page, pageSize, skip, take } = resolvePagination(query);
    const [students, total] = await Promise.all([
      this.prisma.student.findMany({
        where,
        select: STUDENT_SELECT,
        orderBy: { name: 'asc' },
        skip,
        take,
      }),
      this.prisma.student.count({ where }),
    ]);
    return { items: students.map((s) => this.toView(s)), total, page, pageSize };
  }

  async findOne(id: number): Promise<StudentView> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      select: STUDENT_SELECT,
    });
    if (!student) throw new NotFoundException('Student not found');
    return this.toView(student);
  }

  /** Provisions a portal login (User, role STUDENT) alongside the Student row
   * in one transaction, at admission time — mirrors TeachersService.create()'s
   * "user + profile together" flow. The generated password is returned once,
   * in plaintext, for the admin to hand to the student/guardian; it is never
   * stored or retrievable again.
   *
   * `reservedEdvanceId` is for bulk import only — every other caller omits
   * it and gets the normal one-at-a-time nextEdvanceId() behavior
   * unchanged. Bulk import reserves a whole block up front (see
   * reserveEdvanceIdBlock()) so N concurrent rows aren't all fighting over
   * the same id_sequences row lock — that contention is what was closing
   * connections under load before this existed. */
  async create(
    dto: CreateStudentDto,
    actorId?: number,
    reservedEdvanceId?: string,
  ): Promise<StudentCreateResult> {
    await this.assertSectionBelongsToClass(dto.sectionId, dto.classId);

    const role = await this.prisma.role.findUnique({ where: { name: STUDENT_ROLE } });
    if (!role) throw new BadRequestException('STUDENT role is not seeded');

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_BCRYPT_ROUNDS);

    try {
      // Two unchecked (scalar-FK) creates in one transaction, rather than a
      // single nested `student.create({ data: { user: { create: {...} } } })`
      // — Prisma's nested-write shape requires relation-style `class: {
      // connect }` for every field once one relation is nested, which would
      // mean rewriting classId/sectionId too. A transaction keeps the same
      // atomicity with the plain scalar-FK style used everywhere else here.
      const { student, loginEmail, alreadyExisted } = await withTransactionRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            // withTransactionRetry re-runs this whole callback on a dropped
            // connection (P2028) — if the DB actually committed the previous
            // attempt and only the acknowledgment was lost (a real risk on
            // a remote host with no pooler in front of it), blindly
            // redoing the inserts creates a genuine duplicate. Blank
            // admission numbers have no constraint to catch that. Only
            // reservedEdvanceId callers (bulk import) hit this, since only
            // they can retry with the *same* id twice — a fresh
            // nextEdvanceId() call would never collide with itself.
            if (reservedEdvanceId) {
              const existingUser = await tx.user.findUnique({
                where: { edvanceId: reservedEdvanceId },
                select: { id: true, email: true },
              });
              if (existingUser) {
                const existingStudent = await tx.student.findUnique({
                  where: { userId: existingUser.id },
                  select: STUDENT_SELECT,
                });
                if (existingStudent) {
                  return {
                    student: existingStudent,
                    loginEmail: existingUser.email,
                    alreadyExisted: true,
                  };
                }
              }
            }

            const edvanceId = reservedEdvanceId ?? (await nextEdvanceId(tx, 'STU'));
            const loginEmail = `${edvanceId.toLowerCase()}@${STUDENT_LOGIN_EMAIL_DOMAIN}`;
            const user = await tx.user.create({
              data: { name: dto.name, email: loginEmail, edvanceId, passwordHash, roleId: role.id },
            });
            const student = await tx.student.create({
              data: {
                admissionNo: dto.admissionNo,
                aadharNumber: dto.aadharNumber,
                name: dto.name,
                dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
                gender: dto.gender,
                classId: dto.classId,
                sectionId: dto.sectionId,
                guardianName: dto.guardianName,
                guardianPhone: dto.guardianPhone,
                guardianEmail: dto.guardianEmail,
                address: dto.address,
                admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : undefined,
                userId: user.id,
              },
              select: STUDENT_SELECT,
            });
            return { student, loginEmail, alreadyExisted: false };
          },
          // Generous margin over Prisma's 2s/5s defaults — this transaction
          // is 3 sequential round-trips, and on a remote DB host with no
          // pooler in front of it those add up fast under any latency.
          { maxWait: 10000, timeout: 15000 },
        ),
      );
      // Skip the audit write too — it already ran on whichever earlier
      // attempt actually created this row.
      if (!alreadyExisted) {
        await this.audit.record({
          entityType: 'Student',
          entityId: student.id,
          action: 'CREATE',
          userId: actorId,
          newValues: student,
        });
      }
      return {
        ...this.toView(student),
        login: {
          email: loginEmail,
          alias: edvanceLoginAlias(student.user!.edvanceId),
          temporaryPassword: alreadyExisted
            ? '(unavailable — this row was already imported by an earlier attempt)'
            : temporaryPassword,
        },
      };
    } catch (error) {
      throw this.mapError(error, 'A student with this admission number already exists');
    }
  }

  async update(id: number, dto: UpdateStudentDto, actorId?: number): Promise<StudentView> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Student not found');

    if (dto.classId !== undefined && dto.sectionId === undefined) {
      throw new BadRequestException('sectionId is required when changing classId');
    }
    if (dto.sectionId !== undefined) {
      const effectiveClassId = dto.classId ?? existing.classId;
      await this.assertSectionBelongsToClass(dto.sectionId, effectiveClassId);
    }

    try {
      const student = await this.prisma.student.update({
        where: { id },
        data: {
          admissionNo: dto.admissionNo,
          aadharNumber: dto.aadharNumber,
          name: dto.name,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          gender: dto.gender,
          classId: dto.classId,
          sectionId: dto.sectionId,
          guardianName: dto.guardianName,
          guardianPhone: dto.guardianPhone,
          guardianEmail: dto.guardianEmail,
          address: dto.address,
          admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : undefined,
          isActive: dto.isActive,
        },
        select: STUDENT_SELECT,
      });
      await this.audit.record({
        entityType: 'Student',
        entityId: student.id,
        action: 'UPDATE',
        userId: actorId,
        oldValues: existing,
        newValues: student,
      });
      return this.toView(student);
    } catch (error) {
      throw this.mapError(error, 'A student with this admission number already exists');
    }
  }

  async remove(id: number, actorId?: number): Promise<void> {
    const existing = await this.prisma.student.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Student not found');
    if (existing.userId) {
      // Cascades to the Student row too (User.student, Student.userId onDelete: Cascade) —
      // same shape as TeachersService.remove() deleting via the linked User row.
      await this.prisma.user.delete({ where: { id: existing.userId } });
    } else {
      await this.prisma.student.delete({ where: { id } });
    }
    await this.audit.record({
      entityType: 'Student',
      entityId: id,
      action: 'DELETE',
      userId: actorId,
      oldValues: existing,
    });
  }

  /**
   * Read-only scope for a teacher: students in any class+section they teach a
   * subject in, OR are the class (homeroom) teacher of — a class teacher needs
   * their full roster even for a section they don't personally teach a subject in.
   */
  async findForTeacher(userId: number): Promise<StudentView[]> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundException('No teacher profile for this account');

    const [assignments, classTeacherSections] = await Promise.all([
      this.prisma.teacherClassSubject.findMany({
        where: { teacherId: teacher.id },
        select: { classId: true, sectionId: true },
        distinct: ['classId', 'sectionId'],
      }),
      this.prisma.section.findMany({
        where: { classTeacherId: teacher.id },
        select: { id: true, classId: true },
      }),
    ]);

    const scopes = new Map<string, { classId: number; sectionId: number }>();
    for (const a of assignments) scopes.set(`${a.classId}-${a.sectionId}`, a);
    for (const s of classTeacherSections) {
      scopes.set(`${s.classId}-${s.id}`, { classId: s.classId, sectionId: s.id });
    }
    if (scopes.size === 0) return [];

    const students = await this.prisma.student.findMany({
      where: {
        OR: [...scopes.values()].map((a) => ({ classId: a.classId, sectionId: a.sectionId })),
      },
      select: STUDENT_SELECT,
      orderBy: { name: 'asc' },
    });
    return students.map((s) => this.toView(s));
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

  private toView(student: StudentWithRefs): StudentView {
    return {
      id: student.id,
      admissionNo: student.admissionNo,
      aadharNumber: student.aadharNumber,
      name: student.name,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      class: { id: student.class.id, name: student.class.name },
      section: { id: student.section.id, name: student.section.name },
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      guardianEmail: student.guardianEmail,
      address: student.address,
      isActive: student.isActive,
      admissionDate: student.admissionDate,
      createdAt: student.createdAt,
      hasLogin: student.userId !== null,
      edvanceId: student.user?.edvanceId ?? null,
    };
  }

  private mapError(error: unknown, conflictMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Two unique columns now (admissionNo, aadharNumber) can trigger this
        // — check which one actually collided instead of always blaming
        // admissionNo, since that's just wrong when it was the Aadhaar
        // number. Prisma's `target` is a field-name array on most
        // providers; MySQL sometimes reports the constraint name as a bare
        // string instead, hence checking both shapes.
        const target = error.meta?.target;
        const collided = Array.isArray(target)
          ? target.join(',')
          : typeof target === 'string'
            ? target
            : '';
        if (collided.toLowerCase().includes('aadhar')) {
          return new ConflictException('A student with this Aadhar number already exists');
        }
        return new ConflictException(conflictMessage);
      }
      if (error.code === 'P2025') return new NotFoundException('Not found');
    }
    return error as Error;
  }
}
