import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { TEACHER_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import { ListTeacherAttendanceQueryDto } from './dto/list-teacher-attendance.query.dto';
import { MarkTeacherAttendanceDto } from './dto/mark-teacher-attendance.dto';

export interface TeacherAttendanceView {
  id: number;
  teacher: { id: number; name: string };
  date: string;
  status: string;
  markedBy: { id: number; name: string };
  createdAt: Date;
  updatedAt: Date;
}

type TeacherAttendanceWithRefs = Prisma.TeacherAttendanceGetPayload<{
  include: { teacher: { include: { user: true } }; markedBy: true };
}>;

const TEACHER_ATTENDANCE_INCLUDE = {
  teacher: { include: { user: true } },
  markedBy: true,
} as const;

@Injectable()
export class TeacherAttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  async mark(
    dto: MarkTeacherAttendanceDto,
    actor: AuthenticatedUser,
  ): Promise<TeacherAttendanceView> {
    const teacherId = await this.resolveTargetTeacherId(dto.teacherId, actor, true);
    if (teacherId === undefined) throw new BadRequestException('teacherId is required');

    if (
      actor.roleName === TEACHER_ROLE &&
      this.toDateOnly(new Date(dto.date)) !== this.toDateOnly(new Date())
    ) {
      throw new ForbiddenException('Teachers can only mark their own attendance for today');
    }

    const row = await this.prisma.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId, date: new Date(dto.date) } },
      update: { status: dto.status, markedById: actor.id },
      create: { teacherId, date: new Date(dto.date), status: dto.status, markedById: actor.id },
      include: TEACHER_ATTENDANCE_INCLUDE,
    });
    return this.toView(row);
  }

  async findAll(
    query: ListTeacherAttendanceQueryDto,
    actor: AuthenticatedUser,
  ): Promise<TeacherAttendanceView[]> {
    const teacherId = await this.resolveTargetTeacherId(query.teacherId, actor, false);

    const rows = await this.prisma.teacherAttendance.findMany({
      where: {
        teacherId,
        date: query.date ? new Date(query.date) : undefined,
      },
      include: TEACHER_ATTENDANCE_INCLUDE,
      orderBy: [{ date: 'desc' }, { teacher: { user: { name: 'asc' } } }],
    });
    return rows.map((r) => this.toView(r));
  }

  /**
   * A plain TEACHER is always scoped to their own teacherId regardless of what
   * was requested; admins pick any teacherId (required to mark, optional to browse).
   */
  private async resolveTargetTeacherId(
    requestedTeacherId: number | undefined,
    actor: AuthenticatedUser,
    isMark: boolean,
  ): Promise<number | undefined> {
    if (actor.roleName === TEACHER_ROLE) {
      const own = await this.prisma.teacher.findUnique({ where: { userId: actor.id } });
      if (!own) throw new ForbiddenException('No teacher profile for this account');
      if (requestedTeacherId !== undefined && requestedTeacherId !== own.id) {
        throw new ForbiddenException('You can only mark or view your own attendance');
      }
      return own.id;
    }

    if (isMark && requestedTeacherId === undefined) {
      throw new BadRequestException('teacherId is required');
    }
    if (requestedTeacherId !== undefined) {
      const exists = await this.prisma.teacher.findUnique({ where: { id: requestedTeacherId } });
      if (!exists) throw new NotFoundException('Teacher not found');
    }
    return requestedTeacherId;
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toView(row: TeacherAttendanceWithRefs): TeacherAttendanceView {
    return {
      id: row.id,
      teacher: { id: row.teacher.id, name: row.teacher.user.name },
      date: row.date.toISOString().slice(0, 10),
      status: row.status,
      markedBy: { id: row.markedBy.id, name: row.markedBy.name },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
