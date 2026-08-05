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

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

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
