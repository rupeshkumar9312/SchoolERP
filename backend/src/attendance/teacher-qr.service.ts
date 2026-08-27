import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit/audit-log.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { TEACHER_ROLE } from '../auth/roles.constants';
import { PrismaService } from '../prisma/prisma.service';
import type { KioskTokenClaims } from './guards/kiosk-token.guard';
import { ScanTeacherAttendanceDto } from './dto/scan-teacher-attendance.dto';
import { GeofenceConfigService } from './geofence-config.service';

/** Claims inside the rotating QR token. */
interface AttendanceTokenClaims {
  typ: 'teacher-att';
  /** Unique per token — the half of the per-teacher replay key. */
  jti: string;
  /** Display/location id, copied from the kiosk session that issued it. */
  sid: string;
}

export interface KioskSessionResult {
  token: string;
  sid: string;
  /** Human-readable lifetime, e.g. "12h". */
  expiresIn: string;
}

export interface CurrentQrResult {
  /** The compact JWT to render as a QR. */
  token: string;
  issuedAt: string;
  expiresAt: string;
  ttlSec: number;
  /** How often the kiosk should re-pull (< ttlSec, so tokens overlap). */
  rotateSec: number;
  /** So the kiosk can render a countdown without trusting its own clock. */
  serverTime: string;
}

export interface ScanResult {
  id: number;
  teacher: { id: number; name: string };
  date: string;
  status: string;
  method: string;
  markedAt: string | null;
  markedBy: { id: number; name: string };
  /** True when a row for today already existed — the scan was a no-op confirmation. */
  alreadyMarked: boolean;
}

const ATTENDANCE_INCLUDE = {
  teacher: { include: { user: true } },
  markedBy: true,
} as const;

type AttendanceRow = Prisma.TeacherAttendanceGetPayload<{ include: typeof ATTENDANCE_INCLUDE }>;

@Injectable()
export class TeacherQrService {
  private readonly logger = new Logger(TeacherQrService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditLogService,
    private readonly geofence: GeofenceConfigService,
  ) {}

  /** Admin mints a display session for a wall-mounted kiosk. */
  async createKioskSession(actor: AuthenticatedUser): Promise<KioskSessionResult> {
    const secret = this.requireSecret();
    const expiresIn = this.config.get<string>('ATT_QR_KIOSK_SESSION_TTL') ?? '12h';
    const sid = randomUUID();

    const token = await this.jwt.signAsync(
      { typ: 'kiosk', sid, by: actor.id },
      { secret, expiresIn: expiresIn as JwtSignOptions['expiresIn'] },
    );

    await this.audit.record({
      entityType: 'AttendanceKioskSession',
      entityId: 0,
      action: 'CREATE',
      userId: actor.id,
      newValues: { sid, expiresIn },
    });

    return { token, sid, expiresIn };
  }

  /** Kiosk pulls the token it should be showing right now. Stateless — nothing
   * is persisted here; the replay guard lives entirely on the scan side. */
  async getCurrentToken(kiosk: KioskTokenClaims): Promise<CurrentQrResult> {
    const secret = this.requireSecret();
    const ttlSec = this.config.get<number>('ATT_QR_TOKEN_TTL_SEC') ?? 25;
    const rotateSec = this.config.get<number>('ATT_QR_ROTATE_SEC') ?? 12;

    const now = Date.now();
    const claims: AttendanceTokenClaims = { typ: 'teacher-att', jti: randomUUID(), sid: kiosk.sid };
    const token = await this.jwt.signAsync(claims, { secret, expiresIn: ttlSec });

    return {
      token,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlSec * 1000).toISOString(),
      ttlSec,
      rotateSec,
      serverTime: new Date(now).toISOString(),
    };
  }

  /** Teacher scans the kiosk QR from their own authenticated device. */
  async scan(dto: ScanTeacherAttendanceDto, actor: AuthenticatedUser): Promise<ScanResult> {
    const secret = this.requireSecret();
    const graceSec = this.config.get<number>('ATT_QR_GRACE_SEC') ?? 5;

    // 1. Verify the token itself (signature + expiry, with a little grace for scan lag).
    let claims: AttendanceTokenClaims;
    try {
      claims = await this.jwt.verifyAsync<AttendanceTokenClaims>(dto.token, {
        secret,
        clockTolerance: graceSec,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TokenExpiredError') {
        throw new BadRequestException('This QR code has expired. Scan the one on screen now.');
      }
      throw new UnauthorizedException('This QR code is not valid.');
    }
    if (claims.typ !== 'teacher-att' || !claims.jti) {
      throw new UnauthorizedException('This QR code is not valid.');
    }

    // 2. The caller must be an active teacher.
    if (actor.roleName !== TEACHER_ROLE) {
      throw new ForbiddenException('Only teachers can check in with the attendance QR.');
    }
    const teacher = await this.prisma.teacher.findUnique({
      where: { userId: actor.id },
      include: { user: true },
    });
    if (!teacher) {
      throw new ForbiddenException('No teacher profile is linked to this account.');
    }
    if (!teacher.user.isActive) {
      throw new ForbiddenException('This teacher account is inactive.');
    }

    // 2b. Geofence (no-op unless an admin has enabled it). Checked before the
    //     replay guard so a teacher standing at the wrong spot doesn't burn the
    //     token and then have to wait for the next one.
    const geo = await this.geofence.check({
      lat: dto.lat,
      lng: dto.lng,
      accuracy: dto.accuracy,
      mocked: dto.mocked,
    });
    if (!geo.ok) {
      if (geo.code === 'OUTSIDE') throw new ForbiddenException(geo.message);
      throw new BadRequestException(geo.message);
    }

    // 3. Replay guard: one token, one check-in per teacher. A P2002 here means
    //    this teacher already scanned this token — fall through to return the
    //    existing row so a double-tap reads as an idempotent success.
    let alreadyScannedToken = false;
    try {
      await this.prisma.attendanceQrConsumption.create({
        data: { jti: claims.jti, teacherId: teacher.id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        alreadyScannedToken = true;
      } else {
        throw error;
      }
    }
    this.pruneConsumed();

    // 4. Upsert-or-return today's attendance row. An existing row (manual mark,
    //    admin correction, earlier scan) is never overwritten.
    const date = this.schoolToday();
    const existing = await this.prisma.teacherAttendance.findUnique({
      where: { teacherId_date: { teacherId: teacher.id, date } },
      include: ATTENDANCE_INCLUDE,
    });
    if (existing) {
      return this.toResult(existing, true);
    }
    if (alreadyScannedToken) {
      // Consumed but somehow no row — recreate below rather than 409.
      this.logger.warn(
        `QR token ${claims.jti} was consumed by teacher ${teacher.id} but no attendance row exists; recreating`,
      );
    }

    const status = this.isLateNow() ? 'LATE' : 'PRESENT';
    const row = await this.prisma.teacherAttendance.create({
      data: {
        teacherId: teacher.id,
        date,
        status,
        method: 'QR',
        markedAt: new Date(),
        sourceJti: claims.jti,
        markedLat: dto.lat ?? null,
        markedLng: dto.lng ?? null,
        markedAccuracyM: dto.accuracy ?? null,
        markedById: actor.id,
      },
      include: ATTENDANCE_INCLUDE,
    });

    await this.audit.record({
      entityType: 'TeacherAttendance',
      entityId: row.id,
      action: 'CREATE',
      userId: actor.id,
      newValues: row,
    });

    return this.toResult(row, false);
  }

  // --- helpers --------------------------------------------------------------

  private requireSecret(): string {
    const secret = this.config.get<string>('ATT_QR_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('QR attendance is not configured on this server.');
    }
    return secret;
  }

  /** UTC midnight of the current calendar day in SCHOOL_TZ — matches how the
   * rest of the app stores a `@db.Date`, but no longer keyed off server UTC. */
  private schoolToday(): Date {
    const tz = this.config.get<string>('SCHOOL_TZ') || 'UTC';
    const ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    return new Date(`${ymd}T00:00:00.000Z`);
  }

  private isLateNow(): boolean {
    const tz = this.config.get<string>('SCHOOL_TZ') || 'UTC';
    const cutoff = this.config.get<string>('ATT_CUTOFF') || '09:00';
    const hm = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date());
    return hm >= cutoff; // zero-padded HH:mm compares lexically
  }

  private pruneConsumed(): void {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    this.prisma.attendanceQrConsumption
      .deleteMany({ where: { consumedAt: { lt: cutoff } } })
      .catch((error: unknown) =>
        this.logger.warn(
          `Failed to prune consumed QR tokens: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
  }

  private toResult(row: AttendanceRow, alreadyMarked: boolean): ScanResult {
    return {
      id: row.id,
      teacher: { id: row.teacher.id, name: row.teacher.user.name },
      date: row.date.toISOString().slice(0, 10),
      status: row.status,
      method: row.method,
      markedAt: row.markedAt ? row.markedAt.toISOString() : null,
      markedBy: { id: row.markedBy.id, name: row.markedBy.name },
      alreadyMarked,
    };
  }
}
