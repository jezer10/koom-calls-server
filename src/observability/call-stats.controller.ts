import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Optional,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CallMetricsService } from './call-metrics.service';
import { StructuredLoggerService } from './structured-logger.service';
import {
  AdminAuthGuard,
  JwtAuthGuard,
  resolveUserId,
  type AuthenticatedRequest,
} from './auth.guards';

export const ICE_STATES_ALLOWED: readonly string[] = [
  'new',
  'checking',
  'connected',
  'completed',
  'disconnected',
  'failed',
  'closed',
] as const;

export interface CallStatsBody {
  kind?: string;
  rtt?: number;
  jitter?: number;
  packetLossRatio?: number;
  iceState?: string;
  bytesSent?: number;
  bytesReceived?: number;
  packetsSent?: number;
  packetsReceived?: number;
}

export interface FailedCallSummary {
  callId: string;
  cause: string;
  failedAt: string;
  metadata?: Record<string, unknown>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isStringIn(
  value: unknown,
  allowed: readonly string[],
): value is string {
  return typeof value === 'string' && allowed.includes(value);
}

export function validateCallStatsBody(body: unknown): CallStatsBody {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Body must be a JSON object');
  }
  const raw = body as Record<string, unknown>;
  if (raw.kind !== undefined && raw.kind !== 'webrtc-stats') {
    throw new BadRequestException(`Unsupported stats kind: ${typeof raw.kind}`);
  }
  if (raw.rtt !== undefined && !isFiniteNumber(raw.rtt)) {
    throw new BadRequestException('rtt must be a finite number');
  }
  if (raw.jitter !== undefined && !isFiniteNumber(raw.jitter)) {
    throw new BadRequestException('jitter must be a finite number');
  }
  if (raw.packetLossRatio !== undefined) {
    if (
      !isFiniteNumber(raw.packetLossRatio) ||
      raw.packetLossRatio < 0 ||
      raw.packetLossRatio > 1
    ) {
      throw new BadRequestException(
        'packetLossRatio must be a finite number between 0 and 1',
      );
    }
  }
  if (
    raw.iceState !== undefined &&
    !isStringIn(raw.iceState, ICE_STATES_ALLOWED)
  ) {
    throw new BadRequestException(
      `iceState must be one of: ${ICE_STATES_ALLOWED.join(', ')}`,
    );
  }
  if (raw.bytesSent !== undefined && !isNonNegativeInt(raw.bytesSent)) {
    throw new BadRequestException('bytesSent must be a non-negative number');
  }
  if (raw.bytesReceived !== undefined && !isNonNegativeInt(raw.bytesReceived)) {
    throw new BadRequestException(
      'bytesReceived must be a non-negative number',
    );
  }
  if (raw.packetsSent !== undefined && !isNonNegativeInt(raw.packetsSent)) {
    throw new BadRequestException('packetsSent must be a non-negative number');
  }
  if (
    raw.packetsReceived !== undefined &&
    !isNonNegativeInt(raw.packetsReceived)
  ) {
    throw new BadRequestException(
      'packetsReceived must be a non-negative number',
    );
  }
  return raw;
}

export const FAILED_CALLS_PROVIDER = Symbol('FailedCallsProvider');

export interface FailedCallsProvider {
  list(): Promise<FailedCallSummary[]>;
}

@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallStatsController {
  constructor(
    private readonly metrics: CallMetricsService,
    private readonly logger: StructuredLoggerService,
  ) {}

  @Post(':id/stats')
  @HttpCode(HttpStatus.ACCEPTED)
  postStats(
    @Param('id') callId: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): { accepted: true; callId: string } {
    const userId = resolveUserId(req as AuthenticatedRequest);
    if (!userId) {
      throw new ForbiddenException('Authenticated user required');
    }
    const stats = validateCallStatsBody(body);

    this.metrics.observeQuality(callId, userId, {
      rtt: stats.rtt,
      jitter: stats.jitter,
      packetLossRatio: stats.packetLossRatio,
    });
    if (stats.iceState) {
      this.metrics.incIceStateChange(stats.iceState);
    }

    this.logger.child({ callId, userId }).info(
      {
        event: 'call-stats',
        rtt: stats.rtt,
        jitter: stats.jitter,
        packetLossRatio: stats.packetLossRatio,
        iceState: stats.iceState,
        bytesSent: stats.bytesSent,
        bytesReceived: stats.bytesReceived,
        packetsSent: stats.packetsSent,
        packetsReceived: stats.packetsReceived,
      },
      'webrtc stats received',
    );

    return { accepted: true, callId };
  }
}

@UseGuards(AdminAuthGuard)
@Controller('observability/calls')
export class FailedCallsController {
  constructor(
    private readonly metrics: CallMetricsService,
    private readonly logger: StructuredLoggerService,
    @Optional()
    @Inject(FAILED_CALLS_PROVIDER)
    private readonly provider?: FailedCallsProvider,
  ) {}

  @Get('failed')
  async listFailed(): Promise<FailedCallSummary[]> {
    void this.metrics;
    void this.logger;
    if (!this.provider) return [];
    return this.provider.list();
  }
}
