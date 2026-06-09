import { CoturnTurnService, signTurnPassword } from '../turn.service';
import type { TurnConfig } from '../turn.service';

const baseConfig: TurnConfig = {
  url: 'turn:turn.example.com:3478',
  sharedSecret: 'dev-turn-secret',
  ttlSeconds: 3600,
  realm: 'koom.local',
  stunUrls: ['stun:stun.l.google.com:19302'],
};

const makeService = (config: TurnConfig = baseConfig, clock?: () => Date) =>
  new CoturnTurnService(config, clock);

describe('CoturnTurnService', () => {
  it('uses the {expiry}:{userId} format for the username', () => {
    const fixedNow = new Date('2024-06-08T11:00:00.000Z');
    const service = makeService(baseConfig, () => fixedNow);

    const creds = service.generateCredentials('user-uuid');

    expect(creds.iceServers[1]?.username).toBe('1717848000:user-uuid');
  });

  it('produces an HMAC-SHA1 password that matches a hand-computed vector', () => {
    const fixedNow = new Date('2024-06-08T11:00:00.000Z');
    const service = makeService(baseConfig, () => fixedNow);

    const creds = service.generateCredentials('user-uuid');

    expect(creds.iceServers[1]?.credentialType).toBe('password');
    expect(creds.iceServers[1]?.credential).toBe(
      'OukEr4HWOjUj+aeoZekZSSwGMPo=',
    );
  });

  it('respects the configured TTL when computing expiry', () => {
    const fixedNow = new Date('2024-06-08T11:00:00.000Z');
    const service = makeService(
      { ...baseConfig, ttlSeconds: 60 },
      () => fixedNow,
    );

    const creds = service.generateCredentials('user-uuid');

    expect(creds.expiresAt).toBe('2024-06-08T11:01:00.000Z');
    expect(creds.iceServers[1]?.username?.startsWith('1717844460:')).toBe(true);
  });

  it('includes UDP and TCP transport variants of the TURN URL', () => {
    const fixedNow = new Date('2024-06-08T11:00:00.000Z');
    const service = makeService(
      {
        ...baseConfig,
        url: 'turn:turn.example.com:3478',
      },
      () => fixedNow,
    );

    const creds = service.generateCredentials('user-uuid');
    const turnEntry = creds.iceServers[1];

    expect(turnEntry?.urls).toEqual([
      'turn:turn.example.com:3478?transport=udp',
      'turn:turn.example.com:3478?transport=tcp',
    ]);
  });

  it('prepends configured STUN servers to the iceServers list', () => {
    const fixedNow = new Date('2024-06-08T11:00:00.000Z');
    const service = makeService(
      {
        ...baseConfig,
        stunUrls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
        ],
      },
      () => fixedNow,
    );

    const creds = service.generateCredentials('user-uuid');

    expect(creds.iceServers[0]).toEqual({
      urls: 'stun:stun.l.google.com:19302',
    });
    expect(creds.iceServers[1]).toEqual({
      urls: 'stun:stun1.l.google.com:19302',
    });
    expect(creds.iceServers[2]?.credentialType).toBe('password');
  });

  it('derives a deterministic password for a given user/secret/expiry', () => {
    const fixedNow = new Date('2024-06-08T11:00:00.000Z');
    const serviceA = makeService(baseConfig, () => fixedNow);
    const serviceB = makeService(baseConfig, () => fixedNow);

    const a = serviceA.generateCredentials('alice');
    const b = serviceB.generateCredentials('alice');

    expect(a.iceServers[1]?.credential).toBe(b.iceServers[1]?.credential);
    expect(a.iceServers[1]?.username).toBe(b.iceServers[1]?.username);
  });

  it('produces different credentials for different user ids', () => {
    const fixedNow = new Date('2024-06-08T11:00:00.000Z');
    const service = makeService(baseConfig, () => fixedNow);

    const alice = service.generateCredentials('alice');
    const bob = service.generateCredentials('bob');

    expect(alice.iceServers[1]?.username).not.toBe(bob.iceServers[1]?.username);
    expect(alice.iceServers[1]?.credential).not.toBe(
      bob.iceServers[1]?.credential,
    );
  });
});

describe('signTurnPassword', () => {
  it('produces base64(HMAC-SHA1(secret, username))', () => {
    const password = signTurnPassword('my-secret', '1717862400:user-uuid');

    expect(password).toBe('VnxwttjOOeww/bPkLhucQqMA/7Q=');
  });
});
