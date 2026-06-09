import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  Counter,
  Gauge,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export const CALL_METRICS_REGISTRY = Symbol('CallMetricsRegistry');

export type CallResult =
  | 'created'
  | 'ended'
  | 'failed'
  | 'rejected'
  | 'missed'
  | 'cancelled';

export type CallType = 'audio' | 'video' | 'screen' | 'conference';

export const CALL_RESULTS: readonly CallResult[] = [
  'created',
  'ended',
  'failed',
  'rejected',
  'missed',
  'cancelled',
] as const;

export const CALL_TYPES: readonly CallType[] = [
  'audio',
  'video',
  'screen',
  'conference',
] as const;

export const ICE_STATES: readonly string[] = [
  'new',
  'checking',
  'connected',
  'completed',
  'disconnected',
  'failed',
  'closed',
] as const;

export const DURATION_BUCKETS_SECONDS: number[] = [5, 30, 60, 300, 1800, 3600];

const PACKET_LOSS_BUCKETS: number[] = [
  0.0, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0,
];

const TIME_TO_CONNECT_BUCKETS_SECONDS: number[] = [
  0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30,
];

const RTT_BUCKETS_SECONDS: number[] = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2,
];

const JITTER_BUCKETS_SECONDS: number[] = [
  0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5,
];

export interface CallMetricsOptions {
  collectDefaultMetrics?: boolean;
}

@Injectable()
export class CallMetricsService {
  readonly registry: Registry;
  private readonly callTotal: Counter<'type' | 'result'>;
  private readonly callDuration: Histogram<string>;
  private readonly callParticipants: Gauge<string>;
  private readonly timeToConnect: Histogram<string>;
  private readonly reconnections: Counter<string>;
  private readonly turnUsed: Counter<'callId'>;
  private readonly qualityRtt: Histogram<'callId' | 'userId'>;
  private readonly qualityJitter: Histogram<string>;
  private readonly qualityPacketLoss: Histogram<string>;
  private readonly iceStateChanges: Counter<'state'>;

  constructor(
    @Optional()
    @Inject(CALL_METRICS_REGISTRY)
    registry?: Registry,
  ) {
    this.registry = registry ?? new Registry();
    this.registry.setDefaultLabels({ app: 'koom-calls-server' });

    this.callTotal = new Counter({
      name: 'koom_call_total',
      help: 'Total number of calls by type and result',
      labelNames: ['type', 'result'] as const,
      registers: [this.registry],
    });

    this.callDuration = new Histogram({
      name: 'koom_call_duration_seconds',
      help: 'Duration of completed calls in seconds',
      buckets: DURATION_BUCKETS_SECONDS,
      registers: [this.registry],
    });

    this.callParticipants = new Gauge({
      name: 'koom_call_participants',
      help: 'Number of participants in the currently active call (per callId)',
      labelNames: ['callId'] as const,
      registers: [this.registry],
    });

    this.timeToConnect = new Histogram({
      name: 'koom_call_time_to_connect_seconds',
      help: 'Time elapsed between call creation and first successful connection (seconds)',
      buckets: TIME_TO_CONNECT_BUCKETS_SECONDS,
      registers: [this.registry],
    });

    this.reconnections = new Counter({
      name: 'koom_call_reconnections_total',
      help: 'Total number of reconnection events',
      registers: [this.registry],
    });

    this.turnUsed = new Counter({
      name: 'koom_turn_used_total',
      help: 'Total number of times a TURN relay was used, per call',
      labelNames: ['callId'] as const,
      registers: [this.registry],
    });

    this.qualityRtt = new Histogram({
      name: 'koom_call_quality_rtt_seconds',
      help: 'Round-trip time reported by WebRTC stats (seconds)',
      labelNames: ['callId', 'userId'] as const,
      buckets: RTT_BUCKETS_SECONDS,
      registers: [this.registry],
    });

    this.qualityJitter = new Histogram({
      name: 'koom_call_quality_jitter_seconds',
      help: 'Jitter reported by WebRTC stats (seconds)',
      buckets: JITTER_BUCKETS_SECONDS,
      registers: [this.registry],
    });

    this.qualityPacketLoss = new Histogram({
      name: 'koom_call_quality_packet_loss_ratio',
      help: 'Packet loss ratio reported by WebRTC stats (0..1)',
      buckets: PACKET_LOSS_BUCKETS,
      registers: [this.registry],
    });

    this.iceStateChanges = new Counter({
      name: 'koom_call_ice_state_changes_total',
      help: 'Total number of ICE state transitions',
      labelNames: ['state'] as const,
      registers: [this.registry],
    });
  }

  registerDefaultMetrics(options: CallMetricsOptions = {}): void {
    if (options.collectDefaultMetrics ?? true) {
      collectDefaultMetrics({ register: this.registry });
    }
  }

  incCall(type: CallType, result: CallResult, n = 1): void {
    this.callTotal.inc({ type, result }, n);
  }

  observeCallDuration(seconds: number): void {
    this.callDuration.observe(seconds);
  }

  setParticipants(callId: string, count: number): void {
    this.callParticipants.set({ callId }, count);
  }

  clearParticipants(callId: string): void {
    this.callParticipants.set({ callId }, 0);
  }

  observeTimeToConnect(seconds: number): void {
    this.timeToConnect.observe(seconds);
  }

  incReconnection(n = 1): void {
    this.reconnections.inc(n);
  }

  incTurnUsed(callId: string, n = 1): void {
    this.turnUsed.inc({ callId }, n);
  }

  observeQuality(
    callId: string,
    userId: string,
    sample: {
      rtt?: number;
      jitter?: number;
      packetLossRatio?: number;
    },
  ): void {
    if (typeof sample.rtt === 'number' && Number.isFinite(sample.rtt)) {
      this.qualityRtt.observe({ callId, userId }, sample.rtt);
    }
    if (typeof sample.jitter === 'number' && Number.isFinite(sample.jitter)) {
      this.qualityJitter.observe(sample.jitter);
    }
    if (
      typeof sample.packetLossRatio === 'number' &&
      Number.isFinite(sample.packetLossRatio)
    ) {
      this.qualityPacketLoss.observe(sample.packetLossRatio);
    }
  }

  incIceStateChange(state: string, n = 1): void {
    this.iceStateChanges.inc({ state }, n);
  }

  reset(): void {
    this.registry.resetMetrics();
  }
}
