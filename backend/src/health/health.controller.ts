import { Controller, Get, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type DependencyStatus = 'up' | 'down';

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  uptime: number;
  timestamp: string;
  dependencies: {
    database: { status: DependencyStatus; error?: string };
  };
}

export interface LivenessResponse {
  status: 'ok';
  uptime: number;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Liveness only — no DB round trip, no dependency of any kind. Answers
   * exactly one question: is the Node process up and serving requests.
   * This is what a platform health-check probe or load balancer should
   * poll frequently, since it can't itself go "down" because the database
   * is slow or unreachable — that's what GET /health (below) is for. */
  @Get('live')
  live(): LivenessResponse {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Full check, including the database — "is this instance actually able
   * to serve real requests," not just "is the process alive." Costs one
   * DB round trip per call, so don't point a high-frequency prober at this
   * one; use /health/live for that. */
  @Get()
  async check(): Promise<HealthResponse> {
    let database: HealthResponse['dependencies']['database'];

    try {
      await this.prisma.ping();
      database = { status: 'up' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Database health check failed: ${message}`);
      database = { status: 'down', error: message };
    }

    return {
      status: database.status === 'up' ? 'ok' : 'degraded',
      service: 'school-erp-api',
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: { database },
    };
  }
}
