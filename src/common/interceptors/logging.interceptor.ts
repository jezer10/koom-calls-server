import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const httpCtx = context.switchToHttp();
    const request = httpCtx.getRequest<Request>();
    const response = httpCtx.getResponse<Response>();
    const method = request.method;
    const url = request.originalUrl ?? request.url;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const durationMs = Date.now() - startedAt;
          this.logger.log(
            `${method} ${url} -> ${response.statusCode} ${durationMs}ms`,
          );
        },
        error: (err: unknown) => {
          const durationMs = Date.now() - startedAt;
          const message = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `${method} ${url} -> ERROR ${durationMs}ms ${message}`,
          );
        },
      }),
    );
  }
}
