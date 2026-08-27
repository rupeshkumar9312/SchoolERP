import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { TEACHER_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CorrectTeacherAttendanceDto } from './dto/correct-teacher-attendance.dto';
import { ListTeacherAttendanceQueryDto } from './dto/list-teacher-attendance.query.dto';
import { MarkTeacherAttendanceDto } from './dto/mark-teacher-attendance.dto';
import {
  GeofenceConfigService,
  type CheckoutPublicView,
  type GeofencePublicView,
} from './geofence-config.service';

export interface TeacherAttendanceView {
  id: number;
  teacher: { id: number; name: string };
  date: string;
  status: string;
  /** MANUAL | QR | ADMIN — how the row was recorded. */
  method: string;
  /** Wall-clock instant the row was set; null for pre-QR historical rows. */
  markedAt: string | null;
  /** QR check-in / check-out times, and the whole-minute gap between them. */
  checkInAt: string | null;
  checkOutAt: string | null;
  workedMinutes: number | null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly config: ConfigService,
    private readonly geofence: GeofenceConfigService,
  ) {}

  /** Phase 5 switch. When off, a plain TEACHER must use the QR scan
   * (POST /attendance/teachers/scan) instead of self-marking here. Admins are
   * never affected — they mark/correct other teachers' rows through this route. */
  private manualMarkEnabled(): boolean {
    return this.config.get<string>('TEACHER_MANUAL_MARK_ENABLED') !== 'false';
  }

  async getSelfServeConfig(): Promise<{
    manualMarkEnabled: boolean;
    geofence: GeofencePublicView;
    checkout: CheckoutPublicView;
  }> {
    return {
      manualMarkEnabled: this.manualMarkEnabled(),
      geofence: await this.geofence.getPublic(),
      checkout: await this.geofence.getCheckoutPublic(),
    };
  }

  async mark(
    dto: MarkTeacherAttendanceDto,
    actor: AuthenticatedUser,
  ): Promise<TeacherAttendanceView> {
    const teacherId = await this.resolveTargetTeacherId(dto.teacherId, actor, true);
    if (teacherId === undefined) throw new BadRequestException('teacherId is required');

    if (actor.roleName === TEACHER_ROLE) {
      if (!this.manualMarkEnabled()) {
        throw new ForbiddenException(
          'Manual check-in is disabled. Scan the QR on the staff display with the EDVANCE app.',
        );
      }
      if (this.toDateOnly(new Date(dto.date)) !== this.toDateOnly(new Date())) {
        throw new ForbiddenException('Teachers can only mark their own attendance for today');
      }
    }

    const date = new Date(dto.date);
    // Captured before the upsert — this route doubles as create-or-correct
    // (see README), so whether a row already existed decides CREATE vs UPDATE.
    const existing = await this.prisma.teacherAttendance.findUnique({
      where: { teacherId_date: { teacherId, date } },
    });

    // method/markedAt let Reports and the mobile app tell a manual mark apart
    // from a QR scan (POST /attendance/teachers/scan). This route is always the
    // manual path, whether it's a teacher self-marking or an admin correcting.
    const row = await this.prisma.teacherAttendance.upsert({
      where: { teacherId_date: { teacherId, date } },
      update: { status: dto.status, markedById: actor.id, method: 'MANUAL', markedAt: new Date() },
      create: {
        teacherId,
        date,
        status: dto.status,
        markedById: actor.id,
        method: 'MANUAL',
        markedAt: new Date(),
      },
      include: TEACHER_ATTENDANCE_INCLUDE,
    });
    await this.audit.record({
      entityType: 'TeacherAttendance',
      entityId: row.id,
      action: existing ? 'UPDATE' : 'CREATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });
    return this.toView(row);
  }

  /** Admin-only. Corrects the check-in / check-out timestamps on one row for a
   * missed or wrong scan. Teachers can't reach this — they only ever scan. */
  async correct(
    id: number,
    dto: CorrectTeacherAttendanceDto,
    actor: AuthenticatedUser,
  ): Promise<TeacherAttendanceView> {
    if (actor.roleName === TEACHER_ROLE) {
      throw new ForbiddenException('Only an administrator can correct attendance times.');
    }
    const existing = await this.prisma.teacherAttendance.findUnique({
      where: { id },
      include: TEACHER_ATTENDANCE_INCLUDE,
    });
    if (!existing) throw new NotFoundException('Attendance record not found');

    const data: Prisma.TeacherAttendanceUpdateInput = {};
    if (dto.checkInAt !== undefined)
      data.checkInAt = dto.checkInAt ? new Date(dto.checkInAt) : null;
    if (dto.checkOutAt !== undefined)
      data.checkOutAt = dto.checkOutAt ? new Date(dto.checkOutAt) : null;
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update — provide checkInAt and/or checkOutAt');
    }

    const nextCheckIn =
      dto.checkInAt !== undefined
        ? dto.checkInAt
          ? new Date(dto.checkInAt)
          : null
        : existing.checkInAt;
    const nextCheckOut =
      dto.checkOutAt !== undefined
        ? dto.checkOutAt
          ? new Date(dto.checkOutAt)
          : null
        : existing.checkOutAt;
    if (nextCheckIn && nextCheckOut && nextCheckOut.getTime() <= nextCheckIn.getTime()) {
      throw new BadRequestException('Check-out must be after check-in.');
    }

    const row = await this.prisma.teacherAttendance.update({
      where: { id },
      data,
      include: TEACHER_ATTENDANCE_INCLUDE,
    });
    await this.audit.record({
      entityType: 'TeacherAttendance',
      entityId: row.id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
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
      const target = await this.prisma.teacher.findUnique({
        where: { id: requestedTeacherId },
        include: { user: true },
      });
      if (!target) throw new NotFoundException('Teacher not found');
      // Only blocks marking (writing) a new/corrected record — browsing past
      // attendance for a since-deactivated teacher stays allowed.
      if (isMark && !target.user.isActive) {
        throw new BadRequestException('Cannot mark attendance for an inactive teacher');
      }
    }
    return requestedTeacherId;
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toView(row: TeacherAttendanceWithRefs): TeacherAttendanceView {
    const workedMinutes =
      row.checkInAt && row.checkOutAt
        ? Math.round((row.checkOutAt.getTime() - row.checkInAt.getTime()) / 60_000)
        : null;
    return {
      id: row.id,
      teacher: { id: row.teacher.id, name: row.teacher.user.name },
      date: row.date.toISOString().slice(0, 10),
      status: row.status,
      method: row.method,
      markedAt: row.markedAt ? row.markedAt.toISOString() : null,
      checkInAt: row.checkInAt ? row.checkInAt.toISOString() : null,
      checkOutAt: row.checkOutAt ? row.checkOutAt.toISOString() : null,
      workedMinutes,
      markedBy: { id: row.markedBy.id, name: row.markedBy.name },
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
