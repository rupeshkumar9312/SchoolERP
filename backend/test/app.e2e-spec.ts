import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('GET /api/health reports the API and its database dependency', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);

    expect(res.body).toMatchObject({
      status: 'ok',
      service: 'school-erp-api',
      dependencies: { database: { status: 'up' } },
    });
  });

  afterAll(async () => {
    // `app` stays undefined if the module failed to compile — don't mask that
    // failure with a TypeError from the teardown hook.
    await app?.close();
  });
});
