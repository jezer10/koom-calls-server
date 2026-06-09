import { Logger } from '@nestjs/common';
import { NoopNotificationsService } from '../notifications.service';

describe('NoopNotificationsService', () => {
  let service: NoopNotificationsService;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new NoopNotificationsService();
    debugSpy = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  it('resolves and logs a debug line including the payload', async () => {
    await expect(
      service.notify('alice', 'call.invited', { callId: 'c-1' }),
    ).resolves.toBeUndefined();
    expect(debugSpy).toHaveBeenCalledTimes(1);
    const [message] = debugSpy.mock.calls[0] as [string];
    expect(message).toContain('alice');
    expect(message).toContain('call.invited');
    expect(message).toContain('c-1');
  });

  it('handles undefined payloads without throwing', async () => {
    await expect(
      service.notify('bob', 'ping', undefined),
    ).resolves.toBeUndefined();
    expect(debugSpy).toHaveBeenCalledTimes(1);
  });
});
