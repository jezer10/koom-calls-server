import { NoopMediaProvider } from '../noop.media-provider';
import type { MediaProvider } from '../media-provider.interface';

describe('NoopMediaProvider', () => {
  it('createRoom returns deterministic fake values', async () => {
    const provider: MediaProvider = new NoopMediaProvider();
    const result = await provider.createRoom('call-1');
    expect(result).toEqual({
      roomName: 'koom-call-call-1',
      providerRoomId: 'noop-call-1',
    });
  });

  it('createRoom is stable across calls for the same id', async () => {
    const provider = new NoopMediaProvider();
    const a = await provider.createRoom('call-2');
    const b = await provider.createRoom('call-2');
    expect(a).toEqual(b);
  });

  it('deleteRoom resolves with no side effects', async () => {
    const provider = new NoopMediaProvider();
    await expect(provider.deleteRoom('call-1')).resolves.toBeUndefined();
  });

  it('createAccessToken returns a deterministic token and future expiresAt', async () => {
    const provider = new NoopMediaProvider();
    const before = Date.now();
    const result = await provider.createAccessToken({
      userId: 'u-1',
      callId: 'call-1',
      role: 'host',
      ttlSeconds: 30,
    });
    expect(result.token).toBe('noop-token:u-1:call-1:host');
    expect(result.url).toMatch(/^noop:\/\//);
    expect(result.expiresAt).toBeInstanceOf(Date);
    const expectedExpiresAt = before + 30 * 1000;
    expect(
      Math.abs(result.expiresAt.getTime() - expectedExpiresAt),
    ).toBeLessThan(1000);
  });

  it('createAccessToken defaults to a 1h TTL when none given', async () => {
    const provider = new NoopMediaProvider();
    const before = Date.now();
    const result = await provider.createAccessToken({
      userId: 'u',
      callId: 'c',
      role: 'participant',
    });
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 60 * 60 * 1000 - 1000,
    );
  });

  it('validateWebhook always returns false', () => {
    const provider = new NoopMediaProvider();
    expect(provider.validateWebhook?.('payload', 'sig')).toBe(false);
    expect(provider.validateWebhook?.({ event: 'x' }, 'sig')).toBe(false);
  });
});
