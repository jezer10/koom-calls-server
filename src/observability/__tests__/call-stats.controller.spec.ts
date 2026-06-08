import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  CallStatsController,
  FailedCallsController,
  FAILED_CALLS_PROVIDER,
  validateCallStatsBody,
  type FailedCallSummary,
} from '../call-stats.controller';
import {
  CallMetricsService,
  CALL_METRICS_REGISTRY,
} from '../call-metrics.service';
import { StructuredLoggerService } from '../structured-logger.service';
import {
  JwtAuthGuard,
  AdminAuthGuard,
  type AuthenticatedRequest,
} from '../auth.guards';
import { PinoLogger } from 'nestjs-pino';
import { Registry } from 'prom-client';

function fakePinoLogger(): PinoLogger {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    logger: {
      child: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    },
  } as unknown as PinoLogger;
}

async function buildModule(): Promise<TestingModule> {
  return Test.createTestingModule({
    controllers: [CallStatsController, FailedCallsController],
    providers: [
      {
        provide: CALL_METRICS_REGISTRY,
        useFactory: () => new Registry(),
      },
      CallMetricsService,
      {
        provide: StructuredLoggerService,
        useFactory: () => new StructuredLoggerService(fakePinoLogger()),
      },
      JwtAuthGuard,
      AdminAuthGuard,
    ],
  }).compile();
}

function reqWith(user?: AuthenticatedRequest['user']): AuthenticatedRequest {
  return { user } as AuthenticatedRequest;
}

describe('validateCallStatsBody', () => {
  it('accepts a minimal webrtc-stats body', () => {
    const out = validateCallStatsBody({ kind: 'webrtc-stats' });
    expect(out.kind).toBe('webrtc-stats');
  });

  it('accepts a full body with all numeric fields', () => {
    const out = validateCallStatsBody({
      kind: 'webrtc-stats',
      rtt: 0.045,
      jitter: 0.012,
      packetLossRatio: 0.001,
      iceState: 'connected',
      bytesSent: 12345,
      bytesReceived: 67890,
      packetsSent: 100,
      packetsReceived: 90,
    });
    expect(out.rtt).toBe(0.045);
    expect(out.iceState).toBe('connected');
  });

  it('rejects a non-object body', () => {
    expect(() => validateCallStatsBody(null)).toThrow(BadRequestException);
    expect(() => validateCallStatsBody('nope')).toThrow(BadRequestException);
  });

  it('rejects unknown kind', () => {
    expect(() => validateCallStatsBody({ kind: 'something-else' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects negative or >1 packet loss', () => {
    expect(() => validateCallStatsBody({ packetLossRatio: -0.1 })).toThrow(
      BadRequestException,
    );
    expect(() => validateCallStatsBody({ packetLossRatio: 1.5 })).toThrow(
      BadRequestException,
    );
  });

  it('rejects non-finite rtt/jitter', () => {
    expect(() => validateCallStatsBody({ rtt: 'fast' })).toThrow(
      BadRequestException,
    );
    expect(() => validateCallStatsBody({ jitter: Number.NaN })).toThrow(
      BadRequestException,
    );
  });

  it('rejects unsupported iceState', () => {
    expect(() => validateCallStatsBody({ iceState: 'unicorn' })).toThrow(
      BadRequestException,
    );
  });

  it('rejects negative byte/packet counts', () => {
    expect(() => validateCallStatsBody({ bytesSent: -1 })).toThrow(
      BadRequestException,
    );
    expect(() => validateCallStatsBody({ packetsReceived: -10 })).toThrow(
      BadRequestException,
    );
  });
});

describe('CallStatsController', () => {
  it('rejects anonymous requests with 403', async () => {
    const moduleRef = await buildModule();
    const controller = moduleRef.get(CallStatsController);

    expect(() =>
      controller.postStats(
        'call-1',
        { kind: 'webrtc-stats', rtt: 0.05 },
        reqWith(),
      ),
    ).toThrow(ForbiddenException);
  });

  it('returns 202, updates metrics and logs structured info on success', async () => {
    const moduleRef = await buildModule();
    const controller = moduleRef.get(CallStatsController);
    const metrics = moduleRef.get(CallMetricsService);
    const logger = moduleRef.get(StructuredLoggerService);
    const childSpy = jest.spyOn(logger, 'child');

    const result = controller.postStats(
      'call-77',
      {
        kind: 'webrtc-stats',
        rtt: 0.045,
        jitter: 0.012,
        packetLossRatio: 0.001,
        iceState: 'connected',
        bytesSent: 12345,
        bytesReceived: 67890,
        packetsSent: 100,
        packetsReceived: 90,
      },
      reqWith({ userId: 'user-1' }),
    );

    expect(result).toEqual({ accepted: true, callId: 'call-77' });

    const text = await metrics.registry.metrics();
    expect(text).toMatch(
      /koom_call_quality_rtt_seconds_count\{[^}]*callId="call-77"[^}]*userId="user-1"[^}]*\}/,
    );
    expect(text).toMatch(
      /koom_call_ice_state_changes_total\{[^}]*state="connected"[^}]*\} 1/,
    );

    expect(childSpy).toHaveBeenCalledWith({
      callId: 'call-77',
      userId: 'user-1',
    });
  });

  it('rejects malformed bodies with BadRequestException', async () => {
    const moduleRef = await buildModule();
    const controller = moduleRef.get(CallStatsController);
    expect(() =>
      controller.postStats(
        'call-1',
        { kind: 'webrtc-stats', rtt: 'oops' },
        reqWith({ userId: 'user-1' }),
      ),
    ).toThrow(BadRequestException);
  });

  it('uses sub as userId fallback', async () => {
    const moduleRef = await buildModule();
    const controller = moduleRef.get(CallStatsController);
    const metrics = moduleRef.get(CallMetricsService);
    controller.postStats(
      'call-9',
      { kind: 'webrtc-stats', rtt: 0.1 },
      reqWith({ sub: 'sub-42' }),
    );
    const text = await metrics.registry.metrics();
    expect(text).toMatch(
      /koom_call_quality_rtt_seconds_count\{[^}]*userId="sub-42"[^}]*\}/,
    );
  });
});

describe('FailedCallsController', () => {
  it('returns an empty list when no provider is bound', async () => {
    const moduleRef = await buildModule();
    const controller = moduleRef.get(FailedCallsController);
    const list = await controller.listFailed();
    expect(list).toEqual([]);
  });

  it('delegates to the bound provider when present', async () => {
    const summaries: FailedCallSummary[] = [
      {
        callId: 'call-1',
        cause: 'ice-failed',
        failedAt: '2026-06-08T00:00:00.000Z',
        metadata: { userId: 'u-1' },
      },
      {
        callId: 'call-2',
        cause: 'user-rejected',
        failedAt: '2026-06-08T00:01:00.000Z',
      },
    ];
    const listFn = jest.fn().mockResolvedValue(summaries);
    const moduleRef = await Test.createTestingModule({
      controllers: [CallStatsController, FailedCallsController],
      providers: [
        {
          provide: CALL_METRICS_REGISTRY,
          useFactory: () => new Registry(),
        },
        CallMetricsService,
        {
          provide: StructuredLoggerService,
          useFactory: () => new StructuredLoggerService(fakePinoLogger()),
        },
        JwtAuthGuard,
        AdminAuthGuard,
        {
          provide: FAILED_CALLS_PROVIDER,
          useValue: { list: listFn },
        },
      ],
    }).compile();
    const controller = moduleRef.get(FailedCallsController);
    const list = await controller.listFailed();
    expect(list).toEqual(summaries);
    expect(listFn).toHaveBeenCalledTimes(1);
  });
});

describe('Auth guards', () => {
  it('JwtAuthGuard allows only requests with a user', async () => {
    const moduleRef = await buildModule();
    const guard = moduleRef.get(JwtAuthGuard);
    const buildCtx = (req: AuthenticatedRequest) =>
      ({
        switchToHttp: () => ({ getRequest: () => req }),
      }) as never;
    expect(guard.canActivate(buildCtx(reqWith()))).toBe(false);
    expect(guard.canActivate(buildCtx(reqWith({ sub: 'u-1' })))).toBe(true);
  });

  it('AdminAuthGuard recognizes role, isAdmin and roles[]', async () => {
    const moduleRef = await buildModule();
    const guard = moduleRef.get(AdminAuthGuard);
    const buildCtx = (req: AuthenticatedRequest) =>
      ({
        switchToHttp: () => ({ getRequest: () => req }),
      }) as never;

    expect(guard.canActivate(buildCtx(reqWith({})))).toBe(false);
    expect(guard.canActivate(buildCtx(reqWith({ role: 'user' })))).toBe(false);
    expect(guard.canActivate(buildCtx(reqWith({ role: 'admin' })))).toBe(true);
    expect(guard.canActivate(buildCtx(reqWith({ isAdmin: true })))).toBe(true);
    expect(guard.canActivate(buildCtx(reqWith({ roles: ['admin'] })))).toBe(
      true,
    );
    expect(guard.canActivate(buildCtx(reqWith({ roles: ['user'] })))).toBe(
      false,
    );
  });
});
