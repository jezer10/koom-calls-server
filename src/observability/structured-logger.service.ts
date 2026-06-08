import { Injectable, LoggerService } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import type { Logger as PinoLoggerBase } from 'pino';

const REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'authorization',
  'token',
  'jwt',
  'accessToken',
  'refreshToken',
  'password',
  'sdp',
  'sdpOffer',
  'sdpAnswer',
  'iceCandidates',
  '*.sdp',
  '*.sdpOffer',
  '*.sdpAnswer',
  '*.iceCandidates',
  'req.body.sdp',
  'req.body.signal',
  'body.sdp',
  'body.signal',
];

const REDACT_VALUE = '[REDACTED]';

@Injectable()
export class StructuredLoggerService implements LoggerService {
  constructor(private readonly pino: PinoLogger) {}

  child(context: Record<string, unknown>): PinoLoggerBase {
    return this.pino.logger.child(context);
  }

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.pino.info(this.formatOptional(optionalParams, message));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.pino.error(this.formatOptional(optionalParams, message));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.pino.warn(this.formatOptional(optionalParams, message));
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.pino.debug(this.formatOptional(optionalParams, message));
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.pino.trace(this.formatOptional(optionalParams, message));
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.pino.fatal(this.formatOptional(optionalParams, message));
  }

  private formatOptional(optionalParams: unknown[], message: unknown): unknown {
    if (optionalParams.length === 0) return message;
    return { msg: message, meta: optionalParams };
  }
}

export const structuredLoggerRedaction = {
  paths: REDACT_PATHS as string[],
  censor: REDACT_VALUE,
} as const;

export { REDACT_PATHS, REDACT_VALUE };
