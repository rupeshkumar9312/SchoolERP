import { ForbiddenException } from '@nestjs/common';
import { TeacherAttendanceService } from './teacher-attendance.service';

function makeService(flag: 'true' | 'false' | undefined) {
  const prisma = {
    teacher: {
      findUnique: jest.fn().mockResolvedValue({
        id: 7,
        userId: 42,
        user: { isActive: true, name: 'Ananya' },
      }),
    },
    teacherAttendance: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({
        id: 1,
        status: 'PRESENT',
        method: 'MANUAL',
        markedAt: new Date(),
        date: new Date('2026-08-27T00:00:00.000Z'),
        teacher: { id: 7, user: { name: 'Ananya' } },
        markedBy: { id: 42, name: 'Ananya' },
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const config = {
    get: jest.fn((k: string) => (k === 'TEACHER_MANUAL_MARK_ENABLED' ? flag : undefined)),
  };
  const geofence = {
    getPublic: jest.fn().mockResolvedValue({ enabled: false, maxAccuracyM: 75 }),
    getCheckoutPublic: jest
      .fn()
      .mockResolvedValue({ enabled: false, minSessionMinutes: 30, autoSwitchAt: null }),
  };
  const service = new TeacherAttendanceService(
    prisma as never,
    audit as never,
    config as never,
    geofence as never,
  );
  return { service, prisma };
}

const today = new Date().toISOString().slice(0, 10);
const teacher = { id: 42, email: 't@x', roleId: 5, roleName: 'TEACHER' };
const admin = { id: 1, email: 'a@x', roleId: 1, roleName: 'ADMIN' };

describe('TeacherAttendanceService — Phase 5 manual-mark switch', () => {
  it('getSelfServeConfig reflects the flag (default enabled) and includes the geofence', async () => {
    await expect(makeService(undefined).service.getSelfServeConfig()).resolves.toEqual({
      manualMarkEnabled: true,
      geofence: { enabled: false, maxAccuracyM: 75 },
      checkout: { enabled: false, minSessionMinutes: 30, autoSwitchAt: null },
    });
    await expect(makeService('true').service.getSelfServeConfig()).resolves.toMatchObject({
      manualMarkEnabled: true,
    });
    await expect(makeService('false').service.getSelfServeConfig()).resolves.toMatchObject({
      manualMarkEnabled: false,
    });
  });

  it('blocks a TEACHER self-mark when the flag is off', async () => {
    const { service } = makeService('false');
    await expect(service.mark({ date: today, status: 'PRESENT' }, teacher)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('still lets a TEACHER self-mark when the flag is on', async () => {
    const { service, prisma } = makeService('true');
    await service.mark({ date: today, status: 'PRESENT' }, teacher);
    expect(prisma.teacherAttendance.upsert).toHaveBeenCalledTimes(1);
  });

  it('never blocks an admin correcting a teacher, even with the flag off', async () => {
    const { service, prisma } = makeService('false');
    await service.mark({ teacherId: 7, date: today, status: 'PRESENT' }, admin);
    expect(prisma.teacherAttendance.upsert).toHaveBeenCalledTimes(1);
  });
});
