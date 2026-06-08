import { Logger } from '@nestjs/common';
import { ConsoleMetricsService } from '../metrics.service';

describe('ConsoleMetricsService', () => {
  let service: ConsoleMetricsService;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new ConsoleMetricsService();
    debugSpy = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  it('logs counter events with no labels', () => {
    service.counter('calls.created');
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('metric counter calls.created'),
    );
  });

  it('logs counter events with formatted labels', () => {
    service.counter('calls.created', { outcome: 'ok', retry: false });
    const [message] = debugSpy.mock.calls[0] as [string];
    expect(message).toContain('metric counter calls.created');
    expect(message).toContain('outcome="ok"');
    expect(message).toContain('retry=false');
  });

  it('logs histograms with a numeric value', () => {
    service.histogram('http.duration.ms', 12.5, { route: '/calls' });
    const [message] = debugSpy.mock.calls[0] as [string];
    expect(message).toContain('metric histogram http.duration.ms=12.5');
    expect(message).toContain('route="/calls"');
  });

  it('logs gauges with a numeric value', () => {
    service.gauge('presence.online', 42);
    const [message] = debugSpy.mock.calls[0] as [string];
    expect(message).toContain('metric gauge presence.online=42');
  });

  it('does not throw when labels is an empty object', () => {
    expect(() => service.counter('calls.created', {})).not.toThrow();
  });
});
