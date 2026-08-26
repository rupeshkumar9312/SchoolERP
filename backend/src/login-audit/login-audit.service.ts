import { Injectable, Logger } from '@nestjs/common';
import { LoginEventType, LoginPlatform, Prisma } from '@prisma/client';
import { PaginatedResult, resolvePagination } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import { ListLoginAuditsQueryDto } from './dto/list-login-audits.query.dto';

export interface RecordLoginAuditParams {
  event: LoginEventType;
  platform: LoginPlatform;
  /** The email/alias exactly as submitted — kept even on success, where
   * it's redundant with the resolved user's own email. */
  identifier: string;
  /** Null when the identifier never resolved to a real account. */
  userId?: number | null;
  /** Only meaningful for LOGIN_FAILED. */
  failureReason?: string;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface LoginAuditView {
  id: number;
  event: LoginEventType;
  platform: LoginPlatform;
  identifier: string;
  user: { id: number; name: string } | null;
  failureReason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

const LOGIN_AUDIT_SELECT = {
  id: true,
  event: true,
  platform: true,
  identifier: true,
  failureReason: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  user: { select: { id: true, name: true } },
} satisfies Prisma.LoginAuditSelect;

@Injectable()
export class LoginAuditService {
  private readonly logger = new Logger(LoginAuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Fire-and-forget by design, same contract as AuditLogService.record() —
   * a failure here must never fail or roll back the login/refresh call that
   * already succeeded (or is being rejected for its own, unrelated reason). */
  async record(params: RecordLoginAuditParams): Promise<void> {
    try {
      await this.prisma.loginAudit.create({
        data: {
          event: params.event,
          platform: params.platform,
          identifier: params.identifier,
          userId: params.userId ?? null,
          failureReason: params.failureReason,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to write login audit (${params.event}) for "${params.identifier}"`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async findAll(query: ListLoginAuditsQueryDto): Promise<PaginatedResult<LoginAuditView>> {
    const where: Prisma.LoginAuditWhereInput = {
      userId: query.userId,
      event: query.event,
      platform: query.platform,
      createdAt: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      },
    };
    const { page, pageSize, skip, take } = resolvePagination(query);
    const [rows, total] = await Promise.all([
      this.prisma.loginAudit.findMany({
        where,
        select: LOGIN_AUDIT_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.loginAudit.count({ where }),
    ]);
    return { items: rows, total, page, pageSize };
  }
}
