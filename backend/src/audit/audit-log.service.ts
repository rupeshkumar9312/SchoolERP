import { Injectable, Logger } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs.query.dto';

export interface RecordAuditLogParams {
  entityType: string;
  entityId: number;
  action: AuditAction;
  userId?: number | null;
  oldValues?: unknown;
  newValues?: unknown;
}

export interface AuditLogView {
  id: number;
  entityType: string;
  entityId: number;
  action: AuditAction;
  actor: { id: number; name: string } | null;
  oldValues: unknown;
  newValues: unknown;
  createdAt: Date;
}

type AuditLogWithUser = Prisma.AuditLogGetPayload<{ include: { user: true } }>;

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fire-and-forget by design: a failure here must never roll back or fail
   * the real mutation that already succeeded. Logged to the server console
   * instead of thrown so a broken audit table can't take down attendance
   * marking or student admission.
   */
  async record(params: RecordAuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          userId: params.userId ?? null,
          oldValues: this.toJson(params.oldValues),
          newValues: this.toJson(params.newValues),
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write audit log for ${params.entityType}#${params.entityId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findAll(query: ListAuditLogsQueryDto): Promise<AuditLogView[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        entityType: query.entityType,
        userId: query.userId,
        createdAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lte: query.to ? new Date(query.to) : undefined,
        },
      },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return rows.map((r) => this.toView(r));
  }

  private toJson(value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (value === undefined || value === null) return Prisma.JsonNull;
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private toView(row: AuditLogWithUser): AuditLogView {
    return {
      id: row.id,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      actor: row.user ? { id: row.user.id, name: row.user.name } : null,
      oldValues: row.oldValues,
      newValues: row.newValues,
      createdAt: row.createdAt,
    };
  }
}
