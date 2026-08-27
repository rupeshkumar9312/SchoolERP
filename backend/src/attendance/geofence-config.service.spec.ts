import { BadRequestException } from '@nestjs/common';
import { GeofenceConfigService, haversineMeters } from './geofence-config.service';

// Bangalore-ish reference point.
const LAT = 12.9716;
const LNG = 77.5946;

function makeService(row: Record<string, unknown> | null) {
  const prisma = {
    attendanceGeofenceConfig: {
      findUnique: jest.fn().mockResolvedValue(row),
      upsert: jest
        .fn()
        .mockImplementation(({ create, update }: Record<string, Record<string, unknown>>) =>
          Promise.resolve({
            id: 1,
            latitude: null,
            longitude: null,
            radiusM: 150,
            maxAccuracyM: 75,
            enabled: false,
            ...(row ? update : create),
            updatedAt: new Date('2026-08-28T00:00:00.000Z'),
          }),
        ),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  return { service: new GeofenceConfigService(prisma as never, audit as never), prisma };
}

const enabledRow = {
  id: 1,
  enabled: true,
  latitude: LAT,
  longitude: LNG,
  radiusM: 150,
  maxAccuracyM: 75,
  updatedAt: new Date(),
};

describe('haversineMeters', () => {
  it('is ~0 for identical points', () => {
    expect(haversineMeters(LAT, LNG, LAT, LNG)).toBeLessThan(0.001);
  });

  it('roughly matches a known short distance (~111 m per 0.001° of latitude)', () => {
    const d = haversineMeters(LAT, LNG, LAT + 0.001, LNG);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(120);
  });
});

describe('GeofenceConfigService.check', () => {
  it('passes straight through when the geofence is disabled', async () => {
    const { service } = makeService({ ...enabledRow, enabled: false });
    await expect(service.check({ lat: 0, lng: 0, accuracy: 5 })).resolves.toEqual({ ok: true });
  });

  it('passes through (with a warning) when enabled but coordinates are missing', async () => {
    const { service } = makeService({ ...enabledRow, latitude: null, longitude: null });
    await expect(service.check({ lat: LAT, lng: LNG, accuracy: 5 })).resolves.toEqual({ ok: true });
  });

  it('rejects a scan with no coordinates', async () => {
    const { service } = makeService(enabledRow);
    await expect(service.check({ accuracy: 5 })).resolves.toMatchObject({
      ok: false,
      code: 'LOCATION_REQUIRED',
    });
  });

  it('rejects a mock location before checking distance', async () => {
    const { service } = makeService(enabledRow);
    await expect(
      service.check({ lat: LAT, lng: LNG, accuracy: 5, mocked: true }),
    ).resolves.toMatchObject({ ok: false, code: 'MOCKED' });
  });

  it('rejects a fix worse than maxAccuracyM', async () => {
    const { service } = makeService(enabledRow);
    await expect(service.check({ lat: LAT, lng: LNG, accuracy: 120 })).resolves.toMatchObject({
      ok: false,
      code: 'INACCURATE',
    });
    await expect(service.check({ lat: LAT, lng: LNG })).resolves.toMatchObject({
      ok: false,
      code: 'INACCURATE',
    });
  });

  it('rejects a point outside the radius and reports the distance', async () => {
    const { service } = makeService(enabledRow);
    const res = await service.check({ lat: LAT + 0.01, lng: LNG, accuracy: 10 }); // ~1.1 km away
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('OUTSIDE');
      expect(res.distanceM).toBeGreaterThan(900);
    }
  });

  it('accepts a point inside the radius with a good fix', async () => {
    const { service } = makeService(enabledRow);
    await expect(
      service.check({ lat: LAT + 0.0005, lng: LNG, accuracy: 10 }), // ~55 m away
    ).resolves.toEqual({ ok: true });
  });
});

describe('GeofenceConfigService.update', () => {
  it('refuses to enable the geofence without coordinates', async () => {
    const { service } = makeService(null);
    await expect(
      service.update({ enabled: true, radiusM: 150, maxAccuracyM: 75 }, 1),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows enabling once coordinates are supplied, and audits the change', async () => {
    const { service, prisma } = makeService(null);
    const res = await service.update(
      { enabled: true, latitude: LAT, longitude: LNG, radiusM: 200, maxAccuracyM: 60 },
      9,
    );
    expect(res).toMatchObject({ enabled: true, latitude: LAT, longitude: LNG, radiusM: 200 });
    expect(prisma.attendanceGeofenceConfig.upsert).toHaveBeenCalled();
  });
});
