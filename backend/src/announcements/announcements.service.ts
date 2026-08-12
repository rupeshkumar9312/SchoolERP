import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AudienceRole, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { STUDENT_ROLE, TEACHER_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

export interface AnnouncementView {
  id: number;
  title: string;
  body: string;
  audiences: AudienceRole[];
  createdBy: { id: number; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

type AnnouncementWithRefs = Prisma.AnnouncementGetPayload<{
  include: { createdBy: true; audiences: true };
}>;

const ANNOUNCEMENT_INCLUDE = { createdBy: true, audiences: true } as const;

@Injectable()
export class AnnouncementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Admin-tier roles see every announcement (they're the ones managing them,
   * including ones not addressed to ADMIN); a TEACHER or STUDENT only sees
   * announcements whose audience list includes their own group. */
  async findAll(actor: AuthenticatedUser): Promise<AnnouncementView[]> {
    const rows = await this.prisma.announcement.findMany({
      where: this.isAdminTier(actor) ? {} : this.visibleToWhere(actor),
      include: ANNOUNCEMENT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toView(r));
  }

  async findOne(id: number, actor: AuthenticatedUser): Promise<AnnouncementView> {
    const row = await this.findRowOrThrow(id);
    this.assertMayView(row, actor);
    return this.toView(row);
  }

  async create(dto: CreateAnnouncementDto, actor: AuthenticatedUser): Promise<AnnouncementView> {
    const row = await this.prisma.announcement.create({
      data: {
        title: dto.title,
        body: dto.body,
        createdById: actor.id,
        audiences: { create: dto.audiences.map((audience) => ({ audience })) },
      },
      include: ANNOUNCEMENT_INCLUDE,
    });
    await this.audit.record({
      entityType: 'Announcement',
      entityId: row.id,
      action: 'CREATE',
      userId: actor.id,
      newValues: row,
    });
    return this.toView(row);
  }

  async update(
    id: number,
    dto: UpdateAnnouncementDto,
    actor: AuthenticatedUser,
  ): Promise<AnnouncementView> {
    const existing = await this.findRowOrThrow(id);

    // AnnouncementAudience has no single-column id (its PK is the
    // announcementId+audience pair), so a changed audience list is applied
    // as delete-then-recreate inside one transaction rather than a nested
    // "update" that Prisma has no way to key by.
    const row = await this.prisma.$transaction(async (tx) => {
      if (dto.audiences) {
        await tx.announcementAudience.deleteMany({ where: { announcementId: id } });
      }
      return tx.announcement.update({
        where: { id },
        data: {
          title: dto.title,
          body: dto.body,
          audiences: dto.audiences
            ? { create: dto.audiences.map((audience) => ({ audience })) }
            : undefined,
        },
        include: ANNOUNCEMENT_INCLUDE,
      });
    });

    await this.audit.record({
      entityType: 'Announcement',
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
    await this.prisma.announcement.delete({ where: { id } });
    await this.audit.record({
      entityType: 'Announcement',
      entityId: id,
      action: 'DELETE',
      userId: actor.id,
      oldValues: existing,
    });
  }

  private async findRowOrThrow(id: number): Promise<AnnouncementWithRefs> {
    const row = await this.prisma.announcement.findUnique({
      where: { id },
      include: ANNOUNCEMENT_INCLUDE,
    });
    if (!row) throw new NotFoundException('Announcement not found');
    return row;
  }

  private assertMayView(row: AnnouncementWithRefs, actor: AuthenticatedUser): void {
    if (this.isAdminTier(actor)) return;
    const group = this.audienceGroupFor(actor.roleName);
    if (!row.audiences.some((a) => a.audience === group)) {
      throw new ForbiddenException('This announcement is not addressed to you');
    }
  }

  private visibleToWhere(actor: AuthenticatedUser): Prisma.AnnouncementWhereInput {
    return { audiences: { some: { audience: this.audienceGroupFor(actor.roleName) } } };
  }

  /** Only TEACHER and STUDENT are scoped to their own audience group —
   * SUPER_ADMIN/DIRECTOR/PRINCIPAL/ADMIN all see and manage everything. */
  private isAdminTier(actor: AuthenticatedUser): boolean {
    return actor.roleName !== TEACHER_ROLE && actor.roleName !== STUDENT_ROLE;
  }

  private audienceGroupFor(roleName: string): AudienceRole {
    if (roleName === STUDENT_ROLE) return AudienceRole.STUDENT;
    if (roleName === TEACHER_ROLE) return AudienceRole.TEACHER;
    return AudienceRole.ADMIN;
  }

  private toView(row: AnnouncementWithRefs): AnnouncementView {
    return {
      id: row.id,
      title: row.title,
      body: row.body,
      audiences: row.audiences.map((a) => a.audience),
      createdBy: row.createdBy ? { id: row.createdBy.id, name: row.createdBy.name } : null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
