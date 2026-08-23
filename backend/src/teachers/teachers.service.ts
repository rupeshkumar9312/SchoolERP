import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuditLogService } from '../audit/audit-log.service';
import { TEACHER_ROLE } from '../auth/roles.constants';
import { edvanceLoginAlias, nextEdvanceId } from '../common/generate-edvance-id';
import { generateTempPassword } from '../common/generate-temp-password';
import { withTransactionRetry } from '../common/with-transaction-retry';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { ListTeachersQueryDto } from './dto/list-teachers.query.dto';
import { SetClassTeacherDto } from './dto/set-class-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';

const PASSWORD_BCRYPT_ROUNDS = 10;
const TEACHER_LOGIN_EMAIL_DOMAIN = 'teacher.edvance.edu';

export interface TeacherView {
  id: number;
  userId: number;
  name: string;
  email: string;
  edvanceId: string;
  phone: string | null;
  isActive: boolean;
  qualification: string | null;
  joiningDate: Date;
  createdAt: Date;
}

export interface TeacherCreateResult extends TeacherView {
  /** Shown once, in the create response only — never retrievable again.
   * `alias` is the short form of `email` (e.g. 'tch000123') — both work at login. */
  login: { email: string; alias: string; temporaryPassword: string };
}

export interface AssignmentView {
  id: number;
  class: { id: number; name: string };
  section: { id: number; name: string };
  subject: { id: number; name: string };
  /** Whether this teacher is also the class (homeroom) teacher of this section. */
  isClassTeacher: boolean;
  createdAt: Date;
}

export interface ClassTeacherSectionView {
  class: { id: number; name: string };
  section: { id: number; name: string };
}

type TeacherWithUser = Prisma.TeacherGetPayload<{ include: { user: true } }>;
type AssignmentWithRefs = Prisma.TeacherClassSubjectGetPayload<{
  include: { class: true; section: true; subject: true };
}>;
type SectionWithClass = Prisma.SectionGetPayload<{ include: { class: true } }>;

@Injectable()
export class TeachersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: ListTeachersQueryDto = {}): Promise<TeacherView[]> {
    const teachers = await this.prisma.teacher.findMany({
      where: query.isActive !== undefined ? { user: { isActive: query.isActive } } : undefined,
      include: { user: true },
      orderBy: { user: { name: 'asc' } },
    });
    return teachers.map((t) => this.toView(t));
  }

  async findOne(id: number): Promise<TeacherView> {
    const teacher = await this.prisma.teacher.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');
    return this.toView(teacher);
  }

  async create(dto: CreateTeacherDto, actorId?: number): Promise<TeacherCreateResult> {
    const role = await this.prisma.role.findUnique({ where: { name: TEACHER_ROLE } });
    if (!role) throw new BadRequestException('TEACHER role is not seeded');

    const temporaryPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, PASSWORD_BCRYPT_ROUNDS);
    try {
      const teacher = await withTransactionRetry(() =>
        this.prisma.$transaction(
          async (tx) => {
            const edvanceId = await nextEdvanceId(tx, 'TCH');
            const email = `${edvanceId.toLowerCase()}@${TEACHER_LOGIN_EMAIL_DOMAIN}`;
            return tx.teacher.create({
              data: {
                qualification: dto.qualification,
                joiningDate: new Date(dto.joiningDate),
                user: {
                  create: {
                    name: dto.name,
                    email,
                    edvanceId,
                    phone: dto.phone,
                    passwordHash,
                    roleId: role.id,
                  },
                },
              },
              include: { user: true },
            });
          },
          { maxWait: 10000, timeout: 15000 },
        ),
      );
      await this.audit.record({
        entityType: 'Teacher',
        entityId: teacher.id,
        action: 'CREATE',
        userId: actorId,
        newValues: teacher,
      });
      return {
        ...this.toView(teacher),
        login: {
          email: teacher.user.email,
          alias: edvanceLoginAlias(teacher.user.edvanceId),
          temporaryPassword,
        },
      };
    } catch (error) {
      throw this.mapError(error, 'A teacher login could not be created — please retry');
    }
  }

  async update(id: number, dto: UpdateTeacherDto, actorId?: number): Promise<TeacherView> {
    const existing = await this.prisma.teacher.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) throw new NotFoundException('Teacher not found');

    try {
      const teacher = await this.prisma.teacher.update({
        where: { id },
        data: {
          qualification: dto.qualification,
          joiningDate: dto.joiningDate ? new Date(dto.joiningDate) : undefined,
          user: {
            update: {
              name: dto.name,
              phone: dto.phone,
              isActive: dto.isActive,
            },
          },
        },
        include: { user: true },
      });
      await this.audit.record({
        entityType: 'Teacher',
        entityId: teacher.id,
        action: 'UPDATE',
        userId: actorId,
        oldValues: existing,
        newValues: teacher,
      });
      return this.toView(teacher);
    } catch (error) {
      throw this.mapError(error, 'Could not update this teacher');
    }
  }

  async remove(id: number, actorId?: number): Promise<void> {
    const existing = await this.prisma.teacher.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!existing) throw new NotFoundException('Teacher not found');
    try {
      // Cascades to the Teacher row and their assignments (User.teacher, Teacher.assignments onDelete: Cascade).
      await this.prisma.user.delete({ where: { id: existing.userId } });
    } catch (error) {
      throw this.mapError(
        error,
        'Cannot delete this teacher: they have marked attendance records that must be reassigned first',
      );
    }
    await this.audit.record({
      entityType: 'Teacher',
      entityId: id,
      action: 'DELETE',
      userId: actorId,
      oldValues: existing,
    });
  }

  async findAssignments(teacherId: number): Promise<AssignmentView[]> {
    await this.assertTeacherExists(teacherId);
    const rows = await this.prisma.teacherClassSubject.findMany({
      where: { teacherId },
      include: { class: true, section: true, subject: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => this.toAssignmentView(r));
  }

  async findMyAssignments(userId: number): Promise<AssignmentView[]> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundException('No teacher profile for this account');
    return this.findAssignments(teacher.id);
  }

  async createAssignment(
    teacherId: number,
    dto: CreateAssignmentDto,
    actorId?: number,
  ): Promise<AssignmentView> {
    await this.assertTeacherExists(teacherId);

    const [section, subject] = await Promise.all([
      this.prisma.section.findUnique({ where: { id: dto.sectionId } }),
      this.prisma.subject.findUnique({ where: { id: dto.subjectId } }),
    ]);
    if (!section || section.classId !== dto.classId) {
      throw new BadRequestException('That section does not belong to the given class');
    }
    if (!subject || subject.classId !== dto.classId) {
      throw new BadRequestException('That subject does not belong to the given class');
    }

    const data = {
      teacherId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      subjectId: dto.subjectId,
    };
    try {
      let row: AssignmentWithRefs;
      if (dto.isClassTeacher) {
        // Atomic: the assignment and the homeroom hand-off succeed or fail together.
        const [created] = await this.prisma.$transaction([
          this.prisma.teacherClassSubject.create({
            data,
            include: { class: true, section: true, subject: true },
          }),
          this.prisma.section.update({
            where: { id: dto.sectionId },
            data: { classTeacherId: teacherId },
          }),
        ]);
        row = { ...created, section: { ...created.section, classTeacherId: teacherId } };
      } else {
        row = await this.prisma.teacherClassSubject.create({
          data,
          include: { class: true, section: true, subject: true },
        });
      }
      await this.audit.record({
        entityType: 'TeacherAssignment',
        entityId: row.id,
        action: 'CREATE',
        userId: actorId,
        newValues: row,
      });
      return this.toAssignmentView(row);
    } catch (error) {
      throw this.mapError(
        error,
        'This teacher is already assigned to that class, section and subject',
      );
    }
  }

  async removeAssignment(teacherId: number, assignmentId: number, actorId?: number): Promise<void> {
    const row = await this.prisma.teacherClassSubject.findUnique({ where: { id: assignmentId } });
    if (!row || row.teacherId !== teacherId) throw new NotFoundException('Assignment not found');
    await this.prisma.teacherClassSubject.delete({ where: { id: assignmentId } });
    await this.audit.record({
      entityType: 'TeacherAssignment',
      entityId: assignmentId,
      action: 'DELETE',
      userId: actorId,
      oldValues: row,
    });
  }

  /** Makes this teacher the class (homeroom) teacher of the section, replacing whoever held it. */
  async setClassTeacher(
    teacherId: number,
    dto: SetClassTeacherDto,
  ): Promise<ClassTeacherSectionView> {
    await this.assertTeacherExists(teacherId);
    const section = await this.prisma.section.update({
      where: { id: dto.sectionId },
      data: { classTeacherId: teacherId },
      include: { class: true },
    });
    return this.toClassTeacherView(section);
  }

  /** No-ops if this teacher doesn't currently hold the section — never clears someone else's. */
  async unsetClassTeacher(teacherId: number, sectionId: number): Promise<void> {
    await this.prisma.section.updateMany({
      where: { id: sectionId, classTeacherId: teacherId },
      data: { classTeacherId: null },
    });
  }

  async findClassTeacherOf(teacherId: number): Promise<ClassTeacherSectionView[]> {
    await this.assertTeacherExists(teacherId);
    const sections = await this.prisma.section.findMany({
      where: { classTeacherId: teacherId },
      include: { class: true },
      orderBy: { name: 'asc' },
    });
    return sections.map((s) => this.toClassTeacherView(s));
  }

  async findMyClassTeacherOf(userId: number): Promise<ClassTeacherSectionView[]> {
    const teacher = await this.prisma.teacher.findUnique({ where: { userId } });
    if (!teacher) throw new NotFoundException('No teacher profile for this account');
    return this.findClassTeacherOf(teacher.id);
  }

  private async assertTeacherExists(id: number): Promise<void> {
    const teacher = await this.prisma.teacher.findUnique({ where: { id } });
    if (!teacher) throw new NotFoundException('Teacher not found');
  }

  private toView(teacher: TeacherWithUser): TeacherView {
    return {
      id: teacher.id,
      userId: teacher.userId,
      name: teacher.user.name,
      email: teacher.user.email,
      edvanceId: teacher.user.edvanceId,
      phone: teacher.user.phone,
      isActive: teacher.user.isActive,
      qualification: teacher.qualification,
      joiningDate: teacher.joiningDate,
      createdAt: teacher.createdAt,
    };
  }

  private toAssignmentView(row: AssignmentWithRefs): AssignmentView {
    return {
      id: row.id,
      class: { id: row.class.id, name: row.class.name },
      section: { id: row.section.id, name: row.section.name },
      subject: { id: row.subject.id, name: row.subject.name },
      isClassTeacher: row.section.classTeacherId === row.teacherId,
      createdAt: row.createdAt,
    };
  }

  private toClassTeacherView(section: SectionWithClass): ClassTeacherSectionView {
    return {
      class: { id: section.class.id, name: section.class.name },
      section: { id: section.id, name: section.name },
    };
  }

  private mapError(error: unknown, conflictMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002' || error.code === 'P2003')
        return new ConflictException(conflictMessage);
      if (error.code === 'P2025') return new NotFoundException('Not found');
    }
    return error as Error;
  }
}
