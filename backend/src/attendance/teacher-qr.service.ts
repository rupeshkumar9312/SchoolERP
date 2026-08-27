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

export type ScanDirection = 'in' | 'out';

/** Claims inside the rotating QR token. */
interface AttendanceTokenClaims {
  typ: 'teacher-att';
  /** Which QR the kiosk was showing. Absent ⇒ 'in', so a kiosk build from
   * before check-out existed keeps working as a check-in. */
  dir?: ScanDirection;
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
  /** Which QR this is — the kiosk shows the matching label. */
  dir: ScanDirection;
  issuedAt: string;
  expiresAt: string;
  ttlSec: number;
  /** How often the kiosk should re-pull (< ttlSec, so tokens overlap). */
  rotateSec: number;
  /** So the kiosk can render a countdown without trusting its own clock. */
  serverTime: string;
  /** Lets the kiosk show/hide its check-in / check-out toggle. */
  checkoutEnabled: boolean;
  /** "HH:mm" local — the kiosk auto-switches to check-out at/after this. */
  checkoutAutoSwitchAt: string | null;
}

export interface ScanResult {
  id: number;
  teacher: { id: number; name: string };
  date: string;
  status: string;
  method: string;
  /** What this scan did. */
  event: 'CHECK_IN' | 'CHECK_OUT';
  checkInAt: string | null;
  checkOutAt: string | null;
  /** checkOutAt − checkInAt in whole minutes, when both are known. */
  workedMinutes: number | null;
  markedAt: string | null;
  markedBy: { id: number; name: string };
  /** True when this exact event was already recorded — the scan was a no-op. */
  alreadyMarked: boolean;
}

const ATTENDANCE_INCLUDE = {
  teacher: { include: { user: true } },
  markedBy: true,
} as const;

type AttendanceRow = Prisma.TeacherAttendanceGetPayload<{ include: typeof ATTENDANCE_INCLUDE }>;

interface ApplyContext {
  existing: AttendanceRow | null;
  teacher: { id: number };
  actor: AuthenticatedUser;
  dto: ScanTeacherAttendanceDto;
  jti: string;
  now: Date;
  date: Date;
  alreadyScannedToken: boolean;
}

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
  async getCurrentToken(
    kiosk: KioskTokenClaims,
    mode: ScanDirection = 'in',
  ): Promise<CurrentQrResult> {
    const secret = this.requireSecret();
    const settings = await this.geofence.get();
    if (mode === 'out' && !settings.checkoutEnabled) {
      throw new BadRequestException('Check-out is not enabled for this school.');
    }
    const ttlSec = this.config.get<number>('ATT_QR_TOKEN_TTL_SEC') ?? 25;
    const rotateSec = this.config.get<number>('ATT_QR_ROTATE_SEC') ?? 12;

    const now = Date.now();
    const claims: AttendanceTokenClaims = {
      typ: 'teacher-att',
      dir: mode,
      jti: randomUUID(),
      sid: kiosk.sid,
    };
    const token = await this.jwt.signAsync(claims, { secret, expiresIn: ttlSec });

    return {
      token,
      dir: mode,
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlSec * 1000).toISOString(),
      ttlSec,
      rotateSec,
      serverTime: new Date(now).toISOString(),
      checkoutEnabled: settings.checkoutEnabled,
      checkoutAutoSwitchAt: settings.checkoutAutoSwitchAt,
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
    const dir: ScanDirection = claims.dir === 'out' ? 'out' : 'in';

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

    // 3. Geofence (no-op unless an admin has enabled it). Checked before the
    //    replay guard so a teacher standing at the wrong spot doesn't burn the
    //    token and then have to wait for the next one.
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

    // 4. Load today's row and pre-validate the direction *before* consuming the
    //    token, so a rejected check-out doesn't burn it.
    const now = new Date();
    const date = this.todayDate();
    const existing = await this.prisma.teacherAttendance.findUnique({
      where: { teacherId_date: { teacherId: teacher.id, date } },
      include: ATTENDANCE_INCLUDE,
    });

    if (dir === 'out') {
      const settings = await this.geofence.get();
      if (!existing || existing.checkInAt == null) {
        if (!settings.allowCheckoutWithoutCheckin) {
          throw new BadRequestException('Check in first before checking out.');
        }
      } else {
        const minsSinceCheckIn = Math.round(
          (now.getTime() - existing.checkInAt.getTime()) / 60_000,
        );
        if (minsSinceCheckIn < settings.minSessionMinutes) {
          throw new BadRequestException(
            `You checked in ${minsSinceCheckIn} min ago — you can check out after ${settings.minSessionMinutes} min.`,
          );
        }
      }
    }

    // 5. Replay guard: one token, one action per teacher.
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

    // 6. Write.
    const ctx: ApplyContext = {
      existing,
      teacher,
      actor,
      dto,
      jti: claims.jti,
      now,
      date,
      alreadyScannedToken,
    };
    return dir === 'out' ? this.applyCheckOut(ctx) : this.applyCheckIn(ctx);
  }

  // --- write paths -------------------------------------------------------

  private async applyCheckIn(ctx: ApplyContext): Promise<ScanResult> {
    const { existing, teacher, actor, dto, jti, now, date, alreadyScannedToken } = ctx;

    if (existing) {
      if (existing.checkInAt != null) {
        return this.toResult(existing, 'CHECK_IN', true); // idempotent — already checked in
      }
      // Row exists (manual/admin mark, or ABSENT/LEAVE) with no check-in yet — fill it.
      const flipStatus = existing.status === 'ABSENT' || existing.status === 'LEAVE';
      const row = await this.prisma.teacherAttendance.update({
        where: { id: existing.id },
        data: {
          checkInAt: now,
          method: 'QR',
          markedAt: now,
          sourceJti: jti,
          markedLat: dto.lat ?? null,
          markedLng: dto.lng ?? null,
          markedAccuracyM: dto.accuracy ?? null,
          markedById: actor.id,
          ...(flipStatus ? { status: this.isLateNow() ? 'LATE' : 'PRESENT' } : {}),
        },
        include: ATTENDANCE_INCLUDE,
      });
      await this.audit.record({
        entityType: 'TeacherAttendance',
        entityId: row.id,
        action: 'UPDATE',
        userId: actor.id,
        oldValues: existing,
        newValues: row,
      });
      return this.toResult(row, 'CHECK_IN', false);
    }

    if (alreadyScannedToken) {
      this.logger.warn(
        `QR token ${jti} was consumed by teacher ${teacher.id} but no attendance row exists; recreating`,
      );
    }
    const status = this.isLateNow() ? 'LATE' : 'PRESENT';
    const row = await this.prisma.teacherAttendance.create({
      data: {
        teacherId: teacher.id,
        date,
        status,
        method: 'QR',
        markedAt: now,
        checkInAt: now,
        sourceJti: jti,
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
    return this.toResult(row, 'CHECK_IN', false);
  }

  private async applyCheckOut(ctx: ApplyContext): Promise<ScanResult> {
    const { existing, teacher, actor, dto, jti, now, date, alreadyScannedToken } = ctx;

    if (alreadyScannedToken && existing?.checkOutAt != null) {
      return this.toResult(existing, 'CHECK_OUT', true); // replay of the same out-token
    }

    if (!existing) {
      // Only reachable with allowCheckoutWithoutCheckin — record a bare check-out.
      const status = this.isLateNow() ? 'LATE' : 'PRESENT';
      const row = await this.prisma.teacherAttendance.create({
        data: {
          teacherId: teacher.id,
          date,
          status,
          method: 'QR',
          markedAt: now,
          checkOutAt: now,
          checkOutSourceJti: jti,
          checkOutLat: dto.lat ?? null,
          checkOutLng: dto.lng ?? null,
          checkOutAccuracyM: dto.accuracy ?? null,
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
      return this.toResult(row, 'CHECK_OUT', false);
    }

    // Last-out-wins: overwrite checkOutAt even if it was already set.
    const row = await this.prisma.teacherAttendance.update({
      where: { id: existing.id },
      data: {
        checkOutAt: now,
        checkOutSourceJti: jti,
        checkOutLat: dto.lat ?? null,
        checkOutLng: dto.lng ?? null,
        checkOutAccuracyM: dto.accuracy ?? null,
      },
      include: ATTENDANCE_INCLUDE,
    });
    await this.audit.record({
      entityType: 'TeacherAttendance',
      entityId: row.id,
      action: 'UPDATE',
      userId: actor.id,
      oldValues: existing,
      newValues: row,
    });
    return this.toResult(row, 'CHECK_OUT', false);
  }

  // --- helpers --------------------------------------------------------------

  private requireSecret(): string {
    const secret = this.config.get<string>('ATT_QR_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('QR attendance is not configured on this server.');
    }
    return secret;
  }

  /** The calendar day to file a scan under. Must match how the rest of the app
   * buckets a `@db.Date` — the dashboard, the list endpoints and the mobile /
   * web clients all use the UTC calendar day (see DashboardService.todayUtcDate
   * and mobile `todayIsoDate`). Keying this off SCHOOL_TZ instead would file a
   * scan on a different day than the dashboard queries whenever the two dates
   * disagree (i.e. after UTC midnight but before the local day rolls over), so
   * a fresh check-in would read back as "not checked in yet". */
  private todayDate(): Date {
    return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  }

  /** Wall-clock "is it past the cutoff?" — genuinely a local-time question, so
   * this one stays in SCHOOL_TZ. It only picks PRESENT vs LATE; it doesn't
   * decide which day the row belongs to. */
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

  private toResult(
    row: AttendanceRow,
    event: 'CHECK_IN' | 'CHECK_OUT',
    alreadyMarked: boolean,
  ): ScanResult {
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
      event,
      checkInAt: row.checkInAt ? row.checkInAt.toISOString() : null,
      checkOutAt: row.checkOutAt ? row.checkOutAt.toISOString() : null,
      workedMinutes,
      markedAt: row.markedAt ? row.markedAt.toISOString() : null,
      markedBy: { id: row.markedBy.id, name: row.markedBy.name },
      alreadyMarked,
    };
  }
}
