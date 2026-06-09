import { InMemoryPresenceService } from '../in-memory-presence.service';

describe('InMemoryPresenceService', () => {
  let service: InMemoryPresenceService;

  beforeEach(() => {
    service = new InMemoryPresenceService(60);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('reports a user as online after markOnline and returns them in whoIsOnline', async () => {
    await service.markOnline('user-1', 'sock-a');

    const online = await service.whoIsOnline(['user-1', 'user-2']);

    expect(online.has('user-1')).toBe(true);
    expect(online.has('user-2')).toBe(false);
  });

  it('removes a user from online after markOffline', async () => {
    await service.markOnline('user-1', 'sock-a');
    await service.markOffline('user-1', 'sock-a');

    const online = await service.whoIsOnline(['user-1']);

    expect(online.size).toBe(0);
  });

  it('tracks sockets per call and exposes them via callSockets', async () => {
    await service.trackCall('call-1', 'sock-a');
    await service.trackCall('call-1', 'sock-b');

    const sockets = await service.callSockets('call-1');

    expect(sockets).toEqual(new Set(['sock-a', 'sock-b']));
  });

  it('untracks a single socket from a call without touching the others', async () => {
    await service.trackCall('call-1', 'sock-a');
    await service.trackCall('call-1', 'sock-b');
    await service.untrackCall('call-1', 'sock-a');

    const sockets = await service.callSockets('call-1');

    expect(sockets).toEqual(new Set(['sock-b']));
  });

  it('expires the call bucket after the configured TTL elapses', async () => {
    await service.trackCall('call-1', 'sock-a', 1);

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const sockets = await service.callSockets('call-1');
    expect(sockets.size).toBe(0);
  });

  it('keeps a user online while at least one socket remains, and offline when the last one is removed', async () => {
    await service.markOnline('user-1', 'sock-a');
    await service.markOnline('user-1', 'sock-b');

    let online = await service.whoIsOnline(['user-1']);
    expect(online.has('user-1')).toBe(true);

    await service.markOffline('user-1', 'sock-a');

    online = await service.whoIsOnline(['user-1']);
    expect(online.has('user-1')).toBe(true);

    await service.markOffline('user-1', 'sock-b');

    online = await service.whoIsOnline(['user-1']);
    expect(online.size).toBe(0);
  });

  it('returns the socket set for a user via socketsForUser', async () => {
    await service.markOnline('user-1', 'sock-a');
    await service.markOnline('user-1', 'sock-b');

    const sockets = await service.socketsForUser('user-1');

    expect(sockets).toEqual(new Set(['sock-a', 'sock-b']));
  });
});
