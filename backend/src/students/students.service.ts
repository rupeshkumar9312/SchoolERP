import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStudentDto } from './dto/create-student.dto';
import { ListStudentsQueryDto } from './dto/list-students.query.dto';
import { UpdateStudentDto } from './dto/update-student.dto';

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
                { name: { contains: query.search, mode: 'insensitive' } },
                { admissionNo: { contains: query.search, mode: 'insensitive' } },
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

  async create(dto: CreateStudentDto, actorId?: number): Promise<StudentView> {
    await this.assertSectionBelongsToClass(dto.sectionId, dto.classId);

    try {
      const student = await this.prisma.student.create({
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
        },
        include: { class: true, section: true },
      });
      await this.audit.record({
        entityType: 'Student',
        entityId: student.id,
        action: 'CREATE',
        userId: actorId,
        newValues: student,
      });
      return this.toView(student);
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
    await this.prisma.student.delete({ where: { id } });
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
    };
  }

  private mapError(error: unknown, conflictMessage: string): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return new ConflictException(conflictMessage);
      if (error.code === 'P2025') return new NotFoundException('Not found');
    }
    return error as Error;
  }
}
