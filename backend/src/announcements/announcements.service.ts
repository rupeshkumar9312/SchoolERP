import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AudienceRole, Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { STUDENT_ROLE, SUPER_ADMIN_ROLE, TEACHER_ROLE } from '../auth/roles.constants';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { PaginatedResult, resolvePagination } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { PushNotificationService } from '../push-notifications/push-notifications.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { ListAnnouncementsQueryDto } from './dto/list-announcements.query.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

export interface AnnouncementView {
  id: number;
  title: string;
  body: string | null;
  audiences: AudienceRole[];
  createdBy: { id: number; name: string } | null;
  /** Null when no image was attached. A direct, publicly-resolvable URL —
   * render it straight in an <Image>, no auth-gated download step. */
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

type AnnouncementWithRefs = Prisma.AnnouncementGetPayload<{
  include: { createdBy: true; audiences: true };
}>;

const ANNOUNCEMENT_INCLUDE = { createdBy: true, audiences: true } as const;
const IMAGE_FOLDER = 'schoolerp/announcements';
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Injectable()
export class AnnouncementsService {
  private readonly logger = new Logger(AnnouncementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly pushNotifications: PushNotificationService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /** Admin-tier roles see every announcement (they're the ones managing them,
   * including ones not addressed to ADMIN); a TEACHER or STUDENT only sees
   * announcements whose audience list includes their own group. */
  async findAll(
    actor: AuthenticatedUser,
    query: ListAnnouncementsQueryDto = {},
  ): Promise<PaginatedResult<AnnouncementView>> {
    const where = this.isAdminTier(actor) ? {} : this.visibleToWhere(actor);
    const { page, pageSize, skip, take } = resolvePagination(query);
    const [rows, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where,
        include: ANNOUNCEMENT_INCLUDE,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.announcement.count({ where }),
    ]);
    return { items: rows.map((r) => this.toView(r)), total, page, pageSize };
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

    // Awaited (not fire-and-forget) — the production API runs on Vercel's
    // serverless functions, which freeze immediately once the response is
    // sent, so anything not awaited here risks never actually completing.
    // A push failure must never fail the announcement itself, though.
    try {
      await this.pushNotifications.notifyAudiences(dto.audiences, {
        title: row.title,
        // An image-only announcement has no body — push payloads need text.
        body: row.body ?? '📷 View the attached image',
        data: { type: 'announcement', announcementId: row.id },
      });
    } catch (error) {
      this.logger.error('Failed to send announcement push notifications', error instanceof Error ? error.stack : error);
    }

    return this.toView(row);
  }

  async update(
    id: number,
    dto: UpdateAnnouncementDto,
    actor: AuthenticatedUser,
  ): Promise<AnnouncementView> {
    const existing = await this.findRowOrThrow(id);
    this.assertMayModify(existing, actor);

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
    this.assertMayModify(existing, actor);
    if (existing.imagePath) await this.destroyImage(existing.imagePath);
    await this.prisma.announcement.delete({ where: { id } });
    await this.audit.record({
      entityType: 'Announcement',
      entityId: id,
      action: 'DELETE',
      userId: actor.id,
      oldValues: existing,
    });
  }

  // ---- Image ----
  // Public delivery (type: 'upload'), unlike Assignment/LeaveApplication
  // attachments — meant to render inline for the whole audience, not sit
  // behind a per-request auth check. No download-proxy route needed:
  // `imageUrl` on the view is already a direct, browsable link.

  async attachImage(id: number, actor: AuthenticatedUser, file: Express.Multer.File): Promise<AnnouncementView> {
    const existing = await this.findRowOrThrow(id);
    this.assertMayModify(existing, actor);

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException('Unsupported file type. Allowed: PNG, JPEG or WEBP.');
    }

    const uploaded = await this.cloudinary.uploadBuffer(file.buffer, {
      folder: IMAGE_FOLDER,
      resourceType: 'image',
      filename: file.originalname,
      deliveryType: 'upload',
    });

    // Replacing an existing image — remove the old asset once the new one is safely uploaded.
    if (existing.imagePath) await this.destroyImage(existing.imagePath);

    const row = await this.prisma.announcement.update({
      where: { id },
      data: { imagePath: uploaded.public_id, imageUrl: uploaded.secure_url },
      include: ANNOUNCEMENT_INCLUDE,
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

  async removeImage(id: number, actor: AuthenticatedUser): Promise<AnnouncementView> {
    const existing = await this.findRowOrThrow(id);
    this.assertMayModify(existing, actor);
    if (!existing.imagePath) throw new NotFoundException('This announcement has no image');

    await this.destroyImage(existing.imagePath);

    const row = await this.prisma.announcement.update({
      where: { id },
      data: { imagePath: null, imageUrl: null },
      include: ANNOUNCEMENT_INCLUDE,
    });
    await this.audit.record({
      entityType: 'Announcement',
      entityId: id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });
    return this.toView(row);
  }

  /** Best-effort delete — an orphaned Cloudinary asset is a non-issue (no
   * client ever sees `imagePath`), so this never blocks the DB write it accompanies. */
  private async destroyImage(publicId: string): Promise<void> {
    await this.cloudinary.destroy(publicId, 'image', 'upload').catch((error) => {
      this.logger.error(`Failed to delete Cloudinary asset ${publicId}`, error instanceof Error ? error.stack : error);
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

  /** Editing/deleting is narrower than the announcement.edit/delete
   * permission that gates the route: only SUPER_ADMIN (which already
   * bypasses PermissionGuard entirely) and the original creator may act on
   * a given announcement — holding the permission alone (e.g. a DIRECTOR)
   * isn't enough to touch someone else's post. An announcement whose
   * creator account was since deleted (createdById null, onDelete: SetNull)
   * is editable only by SUPER_ADMIN, since there's no creator left to match. */
  private assertMayModify(row: AnnouncementWithRefs, actor: AuthenticatedUser): void {
    if (actor.roleName === SUPER_ADMIN_ROLE) return;
    if (row.createdById === actor.id) return;
    throw new ForbiddenException('Only the creator or a super admin can edit or delete this announcement');
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
      imageUrl: row.imageUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
