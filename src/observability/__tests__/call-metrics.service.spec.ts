import { Registry } from 'prom-client';
import {
  CallMetricsService,
  CALL_METRICS_REGISTRY,
} from '../call-metrics.service';

function createService(): { service: CallMetricsService; registry: Registry } {
  const registry = new Registry();
  const service = new CallMetricsService(registry);
  return { service, registry };
}

async function rendered(registry: Registry): Promise<string> {
  return registry.metrics();
}

describe('CallMetricsService', () => {
  it('uses the injected registry when provided', () => {
    const registry = new Registry();
    const service = new CallMetricsService(registry);
    expect(service.registry).toBe(registry);
  });

  it('falls back to a fresh registry when none is injected', () => {
    const service = new CallMetricsService();
    expect(service.registry).toBeInstanceOf(Registry);
  });

  it('exports the registry token', () => {
    expect(typeof CALL_METRICS_REGISTRY).toBe('symbol');
  });

  it('increments the call total counter for a (type, result) pair', async () => {
    const { service, registry } = createService();
    service.incCall('audio', 'created');
    service.incCall('audio', 'created');
    service.incCall('video', 'ended', 3);

    const text = await rendered(registry);
    expect(text).toMatch(
      /koom_call_total\{[^}]*type="audio"[^}]*result="created"[^}]*\} 2/,
    );
    expect(text).toMatch(
      /koom_call_total\{[^}]*type="video"[^}]*result="ended"[^}]*\} 3/,
    );
  });

  it('observes call duration into a histogram with the expected buckets', async () => {
    const { service, registry } = createService();
    service.observeCallDuration(7);
    service.observeCallDuration(4200);

    const text = await rendered(registry);
    expect(text).toContain('koom_call_duration_seconds_bucket');
    expect(text).toMatch(/koom_call_duration_seconds_bucket\{le="5"/);
    expect(text).toMatch(/koom_call_duration_seconds_bucket\{le="\+Inf"/);
    expect(text).toMatch(/koom_call_duration_seconds_count(?:\{[^}]*\})? 2/);
  });

  it('sets and clears the participants gauge per callId', async () => {
    const { service, registry } = createService();
    service.setParticipants('call-A', 3);
    service.setParticipants('call-B', 5);
    service.clearParticipants('call-A');

    const text = await rendered(registry);
    expect(text).toMatch(
      /koom_call_participants\{[^}]*callId="call-A"[^}]*\} 0/,
    );
    expect(text).toMatch(
      /koom_call_participants\{[^}]*callId="call-B"[^}]*\} 5/,
    );
  });

  it('observes time-to-connect', async () => {
    const { service, registry } = createService();
    service.observeTimeToConnect(0.12);
    service.observeTimeToConnect(2.5);

    const text = await rendered(registry);
    expect(text).toContain('koom_call_time_to_connect_seconds_bucket');
    expect(text).toMatch(
      /koom_call_time_to_connect_seconds_count(?:\{[^}]*\})? 2/,
    );
  });

  it('increments reconnection counter', async () => {
    const { service, registry } = createService();
    service.incReconnection();
    service.incReconnection(2);

    const text = await rendered(registry);
    expect(text).toMatch(/koom_call_reconnections_total(?:\{[^}]*\})? 3/);
  });

  it('increments turn usage per callId', async () => {
    const { service, registry } = createService();
    service.incTurnUsed('call-1', 2);
    service.incTurnUsed('call-2');

    const text = await rendered(registry);
    expect(text).toMatch(/koom_turn_used_total\{[^}]*callId="call-1"[^}]*\} 2/);
    expect(text).toMatch(/koom_turn_used_total\{[^}]*callId="call-2"[^}]*\} 1/);
  });

  it('observes quality samples (rtt, jitter, packet loss) with callId and userId labels', async () => {
    const { service, registry } = createService();
    service.observeQuality('call-X', 'user-Y', {
      rtt: 0.045,
      jitter: 0.012,
      packetLossRatio: 0.001,
    });

    const text = await rendered(registry);
    expect(text).toMatch(
      /koom_call_quality_rtt_seconds_count\{[^}]*callId="call-X"[^}]*userId="user-Y"[^}]*\}/,
    );
    expect(text).toMatch(
      /koom_call_quality_jitter_seconds_count(?:\{[^}]*\})? 1/,
    );
    expect(text).toMatch(
      /koom_call_quality_packet_loss_ratio_count(?:\{[^}]*\})? 1/,
    );
  });

  it('ignores undefined or non-finite quality samples', async () => {
    const { service, registry } = createService();
    service.observeQuality('call-1', 'user-1', {
      rtt: Number.NaN,
      jitter: undefined,
      packetLossRatio: Number.POSITIVE_INFINITY,
    });
    const text = await rendered(registry);
    expect(text).not.toMatch(
      /koom_call_quality_rtt_seconds_count\s*\{?[^}]*\}?\s*\d/,
    );
    expect(text).not.toMatch(
      /koom_call_quality_jitter_seconds_count(?:\{[^}]*\})? 1\b/,
    );
    expect(text).not.toMatch(
      /koom_call_quality_packet_loss_ratio_count(?:\{[^}]*\})? 1\b/,
    );
  });

  it('records ICE state changes per state', async () => {
    const { service, registry } = createService();
    service.incIceStateChange('connected');
    service.incIceStateChange('failed', 2);

    const text = await rendered(registry);
    expect(text).toMatch(
      /koom_call_ice_state_changes_total\{[^}]*state="connected"[^}]*\} 1/,
    );
    expect(text).toMatch(
      /koom_call_ice_state_changes_total\{[^}]*state="failed"[^}]*\} 2/,
    );
  });

  it('resets metrics so the registry reports zero counters', async () => {
    const { service, registry } = createService();
    service.incCall('audio', 'created');
    service.incReconnection();
    expect(await rendered(registry)).toMatch(/koom_call_total\{.*\} 1/);

    service.reset();
    const text = await rendered(registry);
    expect(text).not.toMatch(/koom_call_total\{.*\} [1-9]/);
    expect(text).not.toMatch(
      /koom_call_reconnections_total(?:\{[^}]*\})? [1-9]/,
    );
  });

  it('registerDefaultMetrics can be disabled', () => {
    const { service, registry } = createService();
    service.registerDefaultMetrics({ collectDefaultMetrics: false });
    expect(
      registry.getSingleMetric('process_cpu_user_seconds_total'),
    ).toBeUndefined();
  });
});
