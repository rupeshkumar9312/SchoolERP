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
    existingRow?: unknown;
    consumptionCreate?: () => Promise<unknown>;
    geofenceCheck?: unknown;
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
    },
  };

  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const jwt = new JwtService();
  const configService = { get: jest.fn((k: string) => config[k]) };
  const geofence = {
    check: jest.fn().mockResolvedValue(overrides.geofenceCheck ?? { ok: true }),
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

  it('is idempotent when a row for today already exists — no overwrite', async () => {
    const existingRow = {
      id: 55,
      status: 'PRESENT',
      method: 'MANUAL',
      markedAt: new Date('2026-08-27T03:30:00.000Z'),
      date: new Date('2026-08-27T00:00:00.000Z'),
      teacher: { id: 7, user: { name: 'Ananya' } },
      markedBy: { id: 1, name: 'Admin' },
    };
    const { service, prisma, jwt } = makeService({ existingRow });
    const res = await service.scan({ token: attToken(jwt, {}) }, actor);
    expect(prisma.teacherAttendance.create).not.toHaveBeenCalled();
    expect(res).toMatchObject({ id: 55, alreadyMarked: true, method: 'MANUAL' });
  });

  it('treats a replayed token (P2002 on consumption) as an idempotent confirmation', async () => {
    const existingRow = {
      id: 55,
      status: 'PRESENT',
      method: 'QR',
      markedAt: new Date(),
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

describe('TeacherQrService token issuance', () => {
  it('getCurrentToken issues a teacher-att token that verifies and carries the kiosk sid', async () => {
    const { service, jwt } = makeService();
    const res = await service.getCurrentToken({ typ: 'kiosk', sid: 'kiosk-9', by: 1 });
    const decoded = jwt.verify<{ typ: string; sid: string; jti: string }>(res.token, {
      secret: SECRET,
    });
    expect(decoded.typ).toBe('teacher-att');
    expect(decoded.sid).toBe('kiosk-9');
    expect(decoded.jti).toEqual(expect.any(String));
    expect(new Date(res.expiresAt).getTime()).toBeGreaterThan(Date.now());
    expect(res.rotateSec).toBeLessThan(res.ttlSec);
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
