import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditLogService } from '../audit/audit-log.service';
import { STUDENT_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students.query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

const PASSWORD_BCRYPT_ROUNDS = 10;
/** Synthetic login domain — students have no real email on file, only a
 * guardian's, so the login address is derived from the (unique) admission
 * number rather than asking an admin to invent one at admission time. */
const STUDENT_LOGIN_EMAIL_DOMAIN = 'student.schoolerp.local';

export interface StudentView {
  id: number;
  admissionNo: string;
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
}

/** Only returned once, from create() — the plaintext password is never stored
 * or retrievable again, so an admin must copy/share it immediately. */
export interface StudentCreateResult extends StudentView {
  login: { email: string; temporaryPassword: string };
}

type StudentWithRefs = Prisma.StudentGetPayload<{ include: { class: true; section: true } }>;

@Injectable()
export class StudentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: ListStudentsQueryDto): Promise<StudentView[]> {
    const students = await this.prisma.student.findMany({
      where: {
        classId: query.classId,
        sectionId: query.sectionId,
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search } },
                { admissionNo: { contains: query.search } },
              ],
            }
          : {}),
      },
      include: { class: true, section: true },
      orderBy: { name: 'asc' },
    });
    return students.map((s) => this.toView(s));
  }

  async findOne(id: number): Promise<StudentView> {
    const student = await this.prisma.student.findUnique({
      where: { id },
      include: { class: true, section: true },
    });
    if (!student) throw new NotFoundException('Student not found');
    return this.toView(student);
  }

  /** Provisions a portal login (User, role STUDENT) alongside the Student row
   * in one transaction, at admission time — mirrors TeachersService.create()'s
   * "user + profile together" flow. The generated password is returned once,
   * in plaintext, for the admin to hand to the student/guardian; it is never
   * stored or retrievable again. */
  async create(dto: CreateStudentDto, actorId?: number): Promise<StudentCreateResult> {
    await this.assertSectionBelongsToClass(dto.sectionId, dto.classId);

    const role = await this.prisma.role.findUnique({ where: { name: STUDENT_ROLE } });
    if (!role) throw new BadRequestException('STUDENT role is not seeded');

    const loginEmail = `${dto.admissionNo.toLowerCase()}@${STUDENT_LOGIN_EMAIL_DOMAIN}`;
    const temporaryPassword = this.generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_BCRYPT_ROUNDS);

    try {
      // Two unchecked (scalar-FK) creates in one transaction, rather than a
      // single nested `student.create({ data: { user: { create: {...} } } })`
      // — Prisma's nested-write shape requires relation-style `class: {
      // connect }` for every field once one relation is nested, which would
      // mean rewriting classId/sectionId too. A transaction keeps the same
      // atomicity with the plain scalar-FK style used everywhere else here.
      const student = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { name: dto.name, email: loginEmail, passwordHash, roleId: role.id },
        });
        return tx.student.create({
          data: {
            admissionNo: dto.admissionNo,
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
          include: { class: true, section: true },
        });
      });
      await this.audit.record({
        entityType: 'Student',
        entityId: student.id,
        action: 'CREATE',
        userId: actorId,
        newValues: student,
      });
      return { ...this.toView(student), login: { email: loginEmail, temporaryPassword } };
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
        include: { class: true, section: true },
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
      include: { class: true, section: true },
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
    };
  }

  /** Readable, guessable-enough-to-type-by-hand temp password — the admin
   * copies it once from the create response and hands it to the student. */
  private generateTempPassword(): string {
    return randomBytes(6).toString('base64url');
  }

  private mapError(error: unknown, conflictMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return new ConflictException(conflictMessage);
      if (error.code === 'P2025') return new NotFoundException('Not found');
    }
    return error as Error;
  }
}
