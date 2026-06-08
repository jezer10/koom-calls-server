import { Controller, Get, Header, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CallMetricsService } from './call-metrics.service';

@Controller('metrics')
export class PrometheusController {
  constructor(private readonly metrics: CallMetricsService) {}

  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(@Res() res: Response): Promise<void> {
    const body = await this.metrics.registry.metrics();
    res.send(body);
  }
}
