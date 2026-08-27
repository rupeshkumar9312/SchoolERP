import {
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import { TeacherQrService } from './teacher-qr.service';

const SECRET = 'test-qr-secret-0123456789-abcdef';

type ConfigMap = Record<string, unknown>;

function makeService(
  overrides: {
    config?: ConfigMap;
    teacher?: unknown;
    existingRow?: Record<string, unknown> | null;
    consumptionCreate?: () => Promise<unknown>;
    geofenceCheck?: unknown;
    geofenceConfig?: Record<string, unknown>;
  } = {},
) {
  const config = {
    ATT_QR_SECRET: SECRET,
    ATT_QR_TOKEN_TTL_SEC: 25,
    ATT_QR_ROTATE_SEC: 12,
    ATT_QR_GRACE_SEC: 5,
    ATT_QR_KIOSK_SESSION_TTL: '12h',
    SCHOOL_TZ: 'Asia/Kolkata',
    ATT_CUTOFF: '23:59',
    ...(overrides.config ?? {}),
  };

  const prisma = {
    teacher: {
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides.teacher === undefined
            ? { id: 7, userId: 42, user: { isActive: true, name: 'T' } }
            : overrides.teacher,
        ),
    },
    attendanceQrConsumption: {
      create: jest
        .fn()
        .mockImplementation(overrides.consumptionCreate ?? (() => Promise.resolve({}))),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    teacherAttendance: {
      findUnique: jest.fn().mockResolvedValue(overrides.existingRow ?? null),
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 101,
          ...data,
          date: new Date('2026-08-27T00:00:00.000Z'),
          teacher: { id: 7, user: { name: 'Ananya' } },
          markedBy: { id: 42, name: 'Ananya' },
        }),
      ),
      update: jest
        .fn()
        .mockImplementation(
          ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) =>
            Promise.resolve({
              ...(overrides.existingRow ?? {}),
              id: where.id,
              ...data,
              teacher: { id: 7, user: { name: 'Ananya' } },
              markedBy: { id: 42, name: 'Ananya' },
            }),
        ),
    },
  };

  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const jwt = new JwtService();
  const configService = { get: jest.fn((k: string) => config[k]) };
  const geofence = {
    check: jest.fn().mockResolvedValue(overrides.geofenceCheck ?? { ok: true }),
    get: jest.fn().mockResolvedValue({
      enabled: false,
      checkoutEnabled: true,
      checkoutAutoSwitchAt: null,
      minSessionMinutes: 30,
      allowCheckoutWithoutCheckin: false,
      ...(overrides.geofenceConfig ?? {}),
    }),
  };

  const service = new TeacherQrService(
    prisma as never,
    jwt,
    configService as never,
    audit as never,
    geofence as never,
  );
  return { service, prisma, audit, jwt, geofence };
}

function attToken(
  jwt: JwtService,
  claims: Record<string, unknown>,
  opts: Record<string, unknown> = {},
) {
  return jwt.sign(
    { typ: 'teacher-att', jti: 'jti-1', sid: 'sid-1', ...claims },
    {
      secret: SECRET,
      expiresIn: 25,
      ...opts,
    },
  );
}

const actor = { id: 42, email: 't@x', roleId: 5, roleName: 'TEACHER' };

describe('TeacherQrService.scan', () => {
  it('rejects a token signed with the wrong secret', async () => {
    const { service, jwt } = makeService();
    const bad = jwt.sign(
      { typ: 'teacher-att', jti: 'j', sid: 's' },
      { secret: 'other-secret-000000', expiresIn: 25 },
    );
    await expect(service.scan({ token: bad }, actor)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an expired token with a "scan the current one" message', async () => {
    const { service, jwt } = makeService();
    const expired = attToken(jwt, {}, { expiresIn: -10 });
    await expect(service.scan({ token: expired }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a token whose typ is not teacher-att (e.g. an auth or kiosk token)', async () => {
    const { service, jwt } = makeService();
    const wrongType = jwt.sign(
      { typ: 'kiosk', jti: 'j', sid: 's' },
      { secret: SECRET, expiresIn: 25 },
    );
    await expect(service.scan({ token: wrongType }, actor)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a non-teacher caller', async () => {
    const { service, jwt } = makeService();
    const token = attToken(jwt, {});
    await expect(service.scan({ token }, { ...actor, roleName: 'ADMIN' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects when the account has no teacher profile', async () => {
    const { service, jwt } = makeService({ teacher: null });
    await expect(service.scan({ token: attToken(jwt, {}) }, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects an inactive teacher', async () => {
    const { service, jwt } = makeService({
      teacher: { id: 7, userId: 42, user: { isActive: false, name: 'T' } },
    });
    await expect(service.scan({ token: attToken(jwt, {}) }, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns 503 when ATT_QR_SECRET is not configured', async () => {
    const { service, jwt } = makeService({ config: { ATT_QR_SECRET: undefined } });
    const token = jwt.sign(
      { typ: 'teacher-att', jti: 'j', sid: 's' },
      { secret: SECRET, expiresIn: 25 },
    );
    await expect(service.scan({ token }, actor)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('creates a PRESENT QR row on the happy path and records the jti consumed', async () => {
    const { service, prisma, audit, jwt } = makeService();
    const res = await service.scan({ token: attToken(jwt, {}) }, actor);

    expect(prisma.attendanceQrConsumption.create).toHaveBeenCalledWith({
      data: { jti: 'jti-1', teacherId: 7 },
    });
    expect(prisma.teacherAttendance.create).toHaveBeenCalledTimes(1);
    const created = prisma.teacherAttendance.create.mock.calls[0][0].data;
    expect(created).toMatchObject({
      teacherId: 7,
      status: 'PRESENT',
      method: 'QR',
      sourceJti: 'jti-1',
      markedById: 42,
    });
    expect(created.markedAt).toBeInstanceOf(Date);
    expect(res).toMatchObject({ status: 'PRESENT', method: 'QR', alreadyMarked: false });
    expect(audit.record).toHaveBeenCalled();
  });

  it('marks LATE when the scan lands at/after the cutoff', async () => {
    const { service, prisma, jwt } = makeService({ config: { ATT_CUTOFF: '00:00' } });
    await service.scan({ token: attToken(jwt, {}) }, actor);
    expect(prisma.teacherAttendance.create.mock.calls[0][0].data.status).toBe('LATE');
  });

  it('files the row under the UTC calendar day (matches the dashboard/list) even when SCHOOL_TZ has already rolled over', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-27T22:00:00.000Z')); // 03:30 next day in IST
    try {
      const { service, prisma, jwt } = makeService({ config: { SCHOOL_TZ: 'Asia/Kolkata' } });
      await service.scan({ token: attToken(jwt, {}) }, actor);
      const date: Date = prisma.teacherAttendance.create.mock.calls[0][0].data.date;
      expect(date.toISOString()).toBe('2026-08-27T00:00:00.000Z');
    } finally {
      jest.useRealTimers();
    }
  });

  it('passes the scan coordinates to the geofence check', async () => {
    const { service, geofence, jwt } = makeService();
    await service.scan(
      { token: attToken(jwt, {}), lat: 12.9, lng: 77.6, accuracy: 20, mocked: false },
      actor,
    );
    expect(geofence.check).toHaveBeenCalledWith({
      lat: 12.9,
      lng: 77.6,
      accuracy: 20,
      mocked: false,
    });
  });

  it('rejects with 403 when the geofence check says the teacher is OUTSIDE', async () => {
    const { service, prisma, jwt } = makeService({
      geofenceCheck: { ok: false, code: 'OUTSIDE', message: 'Too far.' },
    });
    await expect(service.scan({ token: attToken(jwt, {}) }, actor)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.attendanceQrConsumption.create).not.toHaveBeenCalled();
  });

  it('rejects with 400 when the geofence check fails on location/accuracy/mock', async () => {
    const { service, prisma, jwt } = makeService({
      geofenceCheck: { ok: false, code: 'INACCURATE', message: 'Bad fix.' },
    });
    await expect(service.scan({ token: attToken(jwt, {}) }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.attendanceQrConsumption.create).not.toHaveBeenCalled();
  });

  it('is idempotent when the teacher has already checked in today — no write', async () => {
    const existingRow = {
      id: 55,
      status: 'PRESENT',
      method: 'QR',
      markedAt: new Date('2026-08-27T03:30:00.000Z'),
      checkInAt: new Date('2026-08-27T03:30:00.000Z'),
      checkOutAt: null,
      date: new Date('2026-08-27T00:00:00.000Z'),
      teacher: { id: 7, user: { name: 'Ananya' } },
      markedBy: { id: 1, name: 'Admin' },
    };
    const { service, prisma, jwt } = makeService({ existingRow });
    const res = await service.scan({ token: attToken(jwt, {}) }, actor);
    expect(prisma.teacherAttendance.create).not.toHaveBeenCalled();
    expect(prisma.teacherAttendance.update).not.toHaveBeenCalled();
    expect(res).toMatchObject({ id: 55, event: 'CHECK_IN', alreadyMarked: true });
  });

  it('a check-in on a manual row with no checkInAt fills it and flips method to QR', async () => {
    const existingRow = {
      id: 55,
      status: 'ABSENT',
      method: 'MANUAL',
      markedAt: new Date('2026-08-27T02:00:00.000Z'),
      checkInAt: null,
      checkOutAt: null,
      date: new Date('2026-08-27T00:00:00.000Z'),
      teacher: { id: 7, user: { name: 'Ananya' } },
      markedBy: { id: 1, name: 'Admin' },
    };
    const { service, prisma, jwt } = makeService({ existingRow, config: { ATT_CUTOFF: '23:59' } });
    const res = await service.scan({ token: attToken(jwt, {}) }, actor);
    expect(prisma.teacherAttendance.create).not.toHaveBeenCalled();
    const patch = prisma.teacherAttendance.update.mock.calls[0][0].data;
    expect(patch).toMatchObject({ method: 'QR', status: 'PRESENT' });
    expect(patch.checkInAt).toBeInstanceOf(Date);
    expect(res).toMatchObject({ event: 'CHECK_IN', alreadyMarked: false });
  });

  it('treats a replayed token (P2002 on consumption) as an idempotent confirmation', async () => {
    const existingRow = {
      id: 55,
      status: 'PRESENT',
      method: 'QR',
      markedAt: new Date(),
      checkInAt: new Date(),
      checkOutAt: null,
      date: new Date('2026-08-27T00:00:00.000Z'),
      teacher: { id: 7, user: { name: 'Ananya' } },
      markedBy: { id: 42, name: 'Ananya' },
    };
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const { service, prisma, jwt } = makeService({
      existingRow,
      consumptionCreate: () => Promise.reject(p2002),
    });
    const res = await service.scan({ token: attToken(jwt, {}) }, actor);
    expect(prisma.teacherAttendance.create).not.toHaveBeenCalled();
    expect(res.alreadyMarked).toBe(true);
  });
});

const OUT_TOKEN = { dir: 'out' as const };

describe('TeacherQrService.scan — check-out', () => {
  const checkedInRow = {
    id: 55,
    status: 'PRESENT',
    method: 'QR',
    markedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    checkInAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
    checkOutAt: null,
    date: new Date('2026-08-27T00:00:00.000Z'),
    teacher: { id: 7, user: { name: 'Ananya' } },
    markedBy: { id: 42, name: 'Ananya' },
  };

  it('rejects a check-out when the teacher has not checked in', async () => {
    const { service, prisma, jwt } = makeService({ existingRow: null });
    await expect(service.scan({ token: attToken(jwt, OUT_TOKEN) }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.attendanceQrConsumption.create).not.toHaveBeenCalled();
  });

  it('rejects a check-out inside the minimum session window', async () => {
    const freshRow = { ...checkedInRow, checkInAt: new Date(Date.now() - 5 * 60 * 1000) };
    const { service, prisma, jwt } = makeService({
      existingRow: freshRow,
      geofenceConfig: { checkoutEnabled: true, minSessionMinutes: 30 },
    });
    await expect(service.scan({ token: attToken(jwt, OUT_TOKEN) }, actor)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.attendanceQrConsumption.create).not.toHaveBeenCalled();
  });

  it('records the check-out and returns worked minutes', async () => {
    const { service, prisma, jwt } = makeService({ existingRow: checkedInRow });
    const res = await service.scan({ token: attToken(jwt, OUT_TOKEN) }, actor);
    const patch = prisma.teacherAttendance.update.mock.calls[0][0].data;
    expect(patch.checkOutAt).toBeInstanceOf(Date);
    expect(patch.checkOutSourceJti).toBe('jti-1');
    expect(res.event).toBe('CHECK_OUT');
    expect(res.workedMinutes).toBeGreaterThanOrEqual(239); // ~4h
    expect(res.alreadyMarked).toBe(false);
  });

  it('a replayed check-out token is an idempotent confirmation', async () => {
    const alreadyOut = { ...checkedInRow, checkOutAt: new Date() };
    const p2002 = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const { service, prisma, jwt } = makeService({
      existingRow: alreadyOut,
      consumptionCreate: () => Promise.reject(p2002),
    });
    const res = await service.scan({ token: attToken(jwt, OUT_TOKEN) }, actor);
    expect(prisma.teacherAttendance.update).not.toHaveBeenCalled();
    expect(res).toMatchObject({ event: 'CHECK_OUT', alreadyMarked: true });
  });
});

describe('TeacherQrService token issuance', () => {
  it('getCurrentToken issues a teacher-att token that verifies and carries the kiosk sid', async () => {
    const { service, jwt } = makeService();
    const res = await service.getCurrentToken({ typ: 'kiosk', sid: 'kiosk-9', by: 1 });
    const decoded = jwt.verify<{ typ: string; sid: string; jti: string; dir: string }>(res.token, {
      secret: SECRET,
    });
    expect(decoded.typ).toBe('teacher-att');
    expect(decoded.sid).toBe('kiosk-9');
    expect(decoded.dir).toBe('in');
    expect(res.dir).toBe('in');
    expect(decoded.jti).toEqual(expect.any(String));
    expect(new Date(res.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(res.rotateSec).toBeLessThan(res.ttlSec);
  });

  it('getCurrentToken(mode="out") signs a dir=out token when check-out is enabled', async () => {
    const { service, jwt } = makeService({ geofenceConfig: { checkoutEnabled: true } });
    const res = await service.getCurrentToken({ typ: 'kiosk', sid: 'k', by: 1 }, 'out');
    expect(res.dir).toBe('out');
    expect(jwt.verify<{ dir: string }>(res.token, { secret: SECRET }).dir).toBe('out');
  });

  it('getCurrentToken(mode="out") is rejected when check-out is disabled', async () => {
    const { service } = makeService({ geofenceConfig: { checkoutEnabled: false } });
    await expect(
      service.getCurrentToken({ typ: 'kiosk', sid: 'k', by: 1 }, 'out'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createKioskSession issues a verifiable kiosk token and audits it', async () => {
    const { service, audit, jwt } = makeService();
    const res = await service.createKioskSession({
      id: 3,
      email: 'a',
      roleId: 1,
      roleName: 'ADMIN',
    });
    const decoded = jwt.verify<{ typ: string; sid: string; by: number }>(res.token, {
      secret: SECRET,
    });
    expect(decoded).toMatchObject({ typ: 'kiosk', by: 3 });
    expect(decoded.sid).toEqual(res.sid);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'AttendanceKioskSession',
        action: 'CREATE',
        userId: 3,
      }),
    );
  });
});
