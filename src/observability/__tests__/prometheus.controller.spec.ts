import { Test, TestingModule } from '@nestjs/testing';
import { Registry } from 'prom-client';
import { PrometheusController } from '../prometheus.controller';
import {
  CallMetricsService,
  CALL_METRICS_REGISTRY,
} from '../call-metrics.service';

interface FakeResponse {
  send: (body: string) => void;
}

describe('PrometheusController', () => {
  async function buildModule(): Promise<TestingModule> {
    return Test.createTestingModule({
      controllers: [PrometheusController],
      providers: [
        {
          provide: CALL_METRICS_REGISTRY,
          useFactory: () => new Registry(),
        },
        CallMetricsService,
      ],
    }).compile();
  }

  it('is defined', async () => {
    const moduleRef = await buildModule();
    const controller = moduleRef.get(PrometheusController);
    expect(controller).toBeDefined();
  });

  it('renders Prometheus exposition format on GET /metrics', async () => {
    const moduleRef = await buildModule();
    const controller = moduleRef.get(PrometheusController);
    const metrics = moduleRef.get(CallMetricsService);

    metrics.incCall('audio', 'created');
    metrics.incCall('video', 'failed');
    metrics.observeTimeToConnect(0.5);
    metrics.incReconnection();

    const fakeRes: FakeResponse = { send: jest.fn() };

    await controller.getMetrics(fakeRes as never);

    expect(fakeRes.send).toHaveBeenCalledTimes(1);
    const sendMock = fakeRes.send as jest.Mock;
    const calls = sendMock.mock.calls as unknown as Array<[string]>;
    const body = calls[0][0];
    expect(typeof body).toBe('string');
    expect(body).toContain('# HELP');
    expect(body).toContain('# TYPE');
    expect(body).toMatch(/koom_call_total\{/);
    expect(body).toContain('koom_call_duration_seconds');
    expect(body).toContain('koom_call_time_to_connect_seconds');
    expect(body).toMatch(/koom_call_reconnections_total(?:\{[^}]*\})? \d/);
  });

  it('exposes the Content-Type header via the @Header decorator', () => {
    type HeaderMeta = Array<{ name: string; value: string }> | undefined;
    const proto = PrometheusController.prototype as unknown as Record<
      string,
      object
    >;
    const handler = proto['getMetrics'];
    const headers = Reflect.getMetadata('__headers__', handler) as HeaderMeta;
    const list: Array<{ name: string; value: string }> = Array.isArray(headers)
      ? headers.flat()
      : (headers ?? []);
    const contentType = list.find((h) => h.name === 'Content-Type');
    expect(contentType).toBeDefined();
    expect(contentType?.value).toContain('text/plain');
    expect(contentType?.value).toContain('version=0.0.4');
  });
});
