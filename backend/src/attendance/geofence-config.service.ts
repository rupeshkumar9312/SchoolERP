import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateGeofenceConfigDto } from './dto/update-geofence-config.dto';

const SINGLETON_ID = 1;

const DEFAULTS = {
  enabled: false,
  latitude: null as number | null,
  longitude: null as number | null,
  radiusM: 150,
  maxAccuracyM: 75,
  checkoutEnabled: false,
  checkoutAutoSwitchAt: null as string | null,
  minSessionMinutes: 30,
  allowCheckoutWithoutCheckin: false,
};

/** Admin-facing shape — the full config (geofence + check-out). */
export interface GeofenceConfigView {
  enabled: boolean;
  latitude: number | null;
  longitude: number | null;
  radiusM: number;
  maxAccuracyM: number;
  checkoutEnabled: boolean;
  checkoutAutoSwitchAt: string | null;
  minSessionMinutes: number;
  allowCheckoutWithoutCheckin: boolean;
  updatedAt: string | null;
}

/** What a teacher's app is allowed to know about the geofence — just enough to
 * drive the scan UI. */
export interface GeofencePublicView {
  enabled: boolean;
  maxAccuracyM: number;
}

/** What a teacher's app is allowed to know about check-out. */
export interface CheckoutPublicView {
  enabled: boolean;
  minSessionMinutes: number;
  autoSwitchAt: string | null;
}

export interface ScanCoords {
  lat?: number | null;
  lng?: number | null;
  accuracy?: number | null;
  mocked?: boolean | null;
}

export type GeofenceRejectionCode = 'LOCATION_REQUIRED' | 'INACCURATE' | 'MOCKED' | 'OUTSIDE';

export type GeofenceCheckResult =
  { ok: true } | { ok: false; code: GeofenceRejectionCode; message: string; distanceM?: number };

const REJECTION_MESSAGES: Record<GeofenceRejectionCode, string> = {
  LOCATION_REQUIRED:
    'Turn on location to check in — the school needs to confirm you are on campus.',
  INACCURATE:
    "Your GPS fix isn't precise enough. Move near a window or step outside, then try again.",
  MOCKED: 'Your location looks simulated. Check-in needs your device’s real location.',
  OUTSIDE: 'You are too far from campus to check in.',
};

@Injectable()
export class GeofenceConfigService {
  private readonly logger = new Logger(GeofenceConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async get(): Promise<GeofenceConfigView> {
    const row = await this.prisma.attendanceGeofenceConfig.findUnique({
      where: { id: SINGLETON_ID },
    });
    if (!row) return { ...DEFAULTS, updatedAt: null };
    return {
      enabled: row.enabled,
      latitude: row.latitude,
      longitude: row.longitude,
      radiusM: row.radiusM,
      maxAccuracyM: row.maxAccuracyM,
      checkoutEnabled: row.checkoutEnabled,
      checkoutAutoSwitchAt: row.checkoutAutoSwitchAt,
      minSessionMinutes: row.minSessionMinutes,
      allowCheckoutWithoutCheckin: row.allowCheckoutWithoutCheckin,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getPublic(): Promise<GeofencePublicView> {
    const cfg = await this.get();
    return { enabled: cfg.enabled, maxAccuracyM: cfg.maxAccuracyM };
  }

  async getCheckoutPublic(): Promise<CheckoutPublicView> {
    const cfg = await this.get();
    return {
      enabled: cfg.checkoutEnabled,
      minSessionMinutes: cfg.minSessionMinutes,
      autoSwitchAt: cfg.checkoutAutoSwitchAt,
    };
  }

  async update(dto: UpdateGeofenceConfigDto, actorId: number): Promise<GeofenceConfigView> {
    const latitude = dto.latitude ?? null;
    const longitude = dto.longitude ?? null;
    if (dto.enabled && (latitude === null || longitude === null)) {
      throw new BadRequestException(
        'Set the campus latitude and longitude before enabling the geofence.',
      );
    }

    const before = await this.prisma.attendanceGeofenceConfig.findUnique({
      where: { id: SINGLETON_ID },
    });

    const data = {
      enabled: dto.enabled,
      latitude,
      longitude,
      radiusM: dto.radiusM,
      maxAccuracyM: dto.maxAccuracyM,
      checkoutEnabled: dto.checkoutEnabled ?? false,
      checkoutAutoSwitchAt: dto.checkoutAutoSwitchAt ?? null,
      minSessionMinutes: dto.minSessionMinutes ?? DEFAULTS.minSessionMinutes,
      allowCheckoutWithoutCheckin: dto.allowCheckoutWithoutCheckin ?? false,
      updatedById: actorId,
    };
    const row = await this.prisma.attendanceGeofenceConfig.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...data },
      update: data,
    });

    await this.audit.record({
      entityType: 'AttendanceGeofenceConfig',
      entityId: SINGLETON_ID,
      action: before ? 'UPDATE' : 'CREATE',
      userId: actorId,
      oldValues: before,
      newValues: row,
    });

    return {
      enabled: row.enabled,
      latitude: row.latitude,
      longitude: row.longitude,
      radiusM: row.radiusM,
      maxAccuracyM: row.maxAccuracyM,
      checkoutEnabled: row.checkoutEnabled,
      checkoutAutoSwitchAt: row.checkoutAutoSwitchAt,
      minSessionMinutes: row.minSessionMinutes,
      allowCheckoutWithoutCheckin: row.allowCheckoutWithoutCheckin,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Called on every QR scan. A short-circuit `{ ok: true }` when the geofence
   * is off keeps check-in location-free until an admin turns it on. */
  async check(coords: ScanCoords): Promise<GeofenceCheckResult> {
    const cfg = await this.get();
    if (!cfg.enabled) return { ok: true };

    if (cfg.latitude === null || cfg.longitude === null) {
      // update() forbids this combination; treat a manual DB edit that produced
      // it as "not configured" rather than locking every teacher out.
      this.logger.warn('Geofence is enabled but has no coordinates — allowing scan.');
      return { ok: true };
    }

    if (coords.lat == null || coords.lng == null) {
      return {
        ok: false,
        code: 'LOCATION_REQUIRED',
        message: REJECTION_MESSAGES.LOCATION_REQUIRED,
      };
    }
    if (coords.mocked === true) {
      return { ok: false, code: 'MOCKED', message: REJECTION_MESSAGES.MOCKED };
    }
    if (coords.accuracy == null || coords.accuracy > cfg.maxAccuracyM) {
      return { ok: false, code: 'INACCURATE', message: REJECTION_MESSAGES.INACCURATE };
    }

    const distanceM = haversineMeters(cfg.latitude, cfg.longitude, coords.lat, coords.lng);
    if (distanceM > cfg.radiusM) {
      return {
        ok: false,
        code: 'OUTSIDE',
        message: `${REJECTION_MESSAGES.OUTSIDE} You are about ${Math.round(distanceM)} m away.`,
        distanceM: Math.round(distanceM),
      };
    }
    return { ok: true };
  }
}

/** Great-circle distance between two lat/lng points, in metres. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}
