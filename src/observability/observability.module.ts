import { Global, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { Registry } from 'prom-client';
import {
  CallMetricsService,
  CALL_METRICS_REGISTRY,
} from './call-metrics.service';
import {
  StructuredLoggerService,
  structuredLoggerRedaction,
} from './structured-logger.service';
import { PrometheusController } from './prometheus.controller';
import {
  CallStatsController,
  FailedCallsController,
} from './call-stats.controller';
import { JwtAuthGuard, AdminAuthGuard } from './auth.guards';

const isProduction = process.env.NODE_ENV === 'production';

interface HttpLikeRequest {
  id?: unknown;
  method?: unknown;
  url?: unknown;
  remoteAddress?: unknown;
}

interface HttpLikeResponse {
  statusCode?: unknown;
}

@Global()
@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (isProduction ? 'info' : 'debug'),
        redact: structuredLoggerRedaction,
        transport: isProduction
          ? undefined
          : {
              target: 'pino-pretty',
              options: {
                singleLine: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname,context',
              },
            },
        autoLogging: {
          ignore: (req: HttpLikeRequest) =>
            req.url === '/metrics' || req.url === '/health',
        },
        customLogLevel: (
          req: HttpLikeRequest,
          res: HttpLikeResponse,
          err?: unknown,
        ) => {
          if (req.url === '/metrics' || req.url === '/health') return 'silent';
          if (err || Number(res.statusCode) >= 500) return 'error';
          if (Number(res.statusCode) >= 400) return 'warn';
          return 'info';
        },
        serializers: {
          req: (req: HttpLikeRequest) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress,
          }),
          res: (res: HttpLikeResponse) => ({ statusCode: res.statusCode }),
        },
      },
    }),
  ],
  controllers: [
    PrometheusController,
    CallStatsController,
    FailedCallsController,
  ],
  providers: [
    {
      provide: CALL_METRICS_REGISTRY,
      useFactory: () => new Registry(),
    },
    CallMetricsService,
    StructuredLoggerService,
    JwtAuthGuard,
    AdminAuthGuard,
  ],
  exports: [CallMetricsService, StructuredLoggerService, CALL_METRICS_REGISTRY],
})
export class ObservabilityModule {
  constructor(private readonly metrics: CallMetricsService) {
    metrics.registerDefaultMetrics();
  }
}
