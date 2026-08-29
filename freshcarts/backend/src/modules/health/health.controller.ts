import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from 'src/common/decorators';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Liveness: the process is running and able to answer. */
  @Public()
  @Get()
  live() {
    return {
      status: 'ok',
      service: 'freshcarts-api',
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: the process can actually serve traffic (dependencies included). */
  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) response: Response) {
    const report = await this.healthService.check();
    response.status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
