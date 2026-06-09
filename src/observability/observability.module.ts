import { Module } from '@nestjs/common';
import { ConsoleMetricsService } from './metrics.service';
import { METRICS_SERVICE } from './metrics.service.interface';

@Module({
  providers: [
    ConsoleMetricsService,
    { provide: METRICS_SERVICE, useExisting: ConsoleMetricsService },
  ],
  exports: [METRICS_SERVICE, ConsoleMetricsService],
})
export class ObservabilityModule {}
