import { Logger } from '@nestjs/common';
import { NoopMediaProvider } from '../noop.media-provider';

describe('NoopMediaProvider', () => {
  let provider: NoopMediaProvider;
  let debugSpy: jest.SpyInstance;

  beforeEach(() => {
    provider = new NoopMediaProvider();
    debugSpy = jest
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  it('creates a deterministic room name from the callId', async () => {
    await expect(provider.createRoom('call-42')).resolves.toEqual({
      roomName: 'room-call-42',
    });
    expect(debugSpy).toHaveBeenCalledWith('[noop] createRoom(call-42)');
  });

  it('deleteRoom resolves and logs a debug line', async () => {
    await expect(provider.deleteRoom('call-42')).resolves.toBeUndefined();
    expect(debugSpy).toHaveBeenCalledWith('[noop] deleteRoom(call-42)');
  });

  it('mints a deterministic access token for a given user/call/role', async () => {
    const a = await provider.createAccessToken({
      userId: 'alice',
      callId: 'call-1',
      role: 'host',
    });
    const b = await provider.createAccessToken({
      userId: 'alice',
      callId: 'call-1',
      role: 'host',
    });
    expect(a.token).toBe(b.token);
    expect(a.url).toBe(b.url);
    expect(a.token).toMatch(/^noop-token-/);
    expect(a.url).toContain(a.token);
    expect(a.expiresAt).toBeInstanceOf(Date);
    expect(a.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('produces different tokens for different roles/users', async () => {
    const host = await provider.createAccessToken({
      userId: 'alice',
      callId: 'call-1',
      role: 'host',
    });
    const guest = await provider.createAccessToken({
      userId: 'bob',
      callId: 'call-1',
      role: 'participant',
    });
    expect(host.token).not.toBe(guest.token);
  });
});
