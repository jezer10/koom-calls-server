import { Injectable, Logger } from '@nestjs/common';
import type { Labels, MetricsService } from './metrics.service.interface';

@Injectable()
export class ConsoleMetricsService implements MetricsService {
  private readonly logger = new Logger(ConsoleMetricsService.name);

  counter(name: string, labels?: Labels): void {
    this.logger.debug(`metric counter ${name} ${this.formatLabels(labels)}`);
  }

  histogram(name: string, value: number, labels?: Labels): void {
    this.logger.debug(
      `metric histogram ${name}=${value} ${this.formatLabels(labels)}`,
    );
  }

  gauge(name: string, value: number, labels?: Labels): void {
    this.logger.debug(
      `metric gauge ${name}=${value} ${this.formatLabels(labels)}`,
    );
  }

  private formatLabels(labels?: Labels): string {
    if (!labels) return '';
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';
    return entries.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ');
  }
}
