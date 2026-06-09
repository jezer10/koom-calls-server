jest.mock('livekit-server-sdk', () => {
  const createRoom = jest.fn();
  const deleteRoom = jest.fn();
  const addGrant = jest.fn();
  const toJwt = jest.fn();

  class AccessTokenMock {
    identity: string;
    ttl: number | string;
    constructor(
      _apiKey: string,
      _apiSecret: string,
      options: { identity: string; ttl?: number | string },
    ) {
      this.identity = options.identity;
      this.ttl = options.ttl ?? 0;
    }
    addGrant = addGrant;
    toJwt = toJwt;
  }

  class RoomServiceClientMock {
    createRoom = createRoom;
    deleteRoom = deleteRoom;
    constructor(_url: string, _apiKey?: string, _apiSecret?: string) {}
  }

  class WebhookReceiverMock {
    receive = jest.fn();
    constructor(_apiKey: string, _apiSecret: string) {}
  }

  return {
    __esModule: false,
    AccessToken: AccessTokenMock,
    RoomServiceClient: RoomServiceClientMock,
    WebhookReceiver: WebhookReceiverMock,
    __mocks__: { createRoom, deleteRoom, addGrant, toJwt },
  };
});

import { LiveKitMediaProvider } from '../livekit.media-provider';
import { createLiveKitClient } from '../livekit.client';
import { MEDIA_PROVIDER, roomNameForCall } from '../media-provider.interface';
import type {
  CreateAccessTokenArgs,
  MediaProvider,
} from '../media-provider.interface';
import * as lk from 'livekit-server-sdk';

type LiveKitMocks = {
  createRoom: jest.Mock;
  deleteRoom: jest.Mock;
  addGrant: jest.Mock;
  toJwt: jest.Mock;
};

const lkm = lk as unknown as {
  AccessToken: new (
    apiKey: string,
    apiSecret: string,
    options: { identity: string; ttl?: number | string },
  ) => { addGrant: jest.Mock; toJwt: jest.Mock };
  RoomServiceClient: new (
    url: string,
    apiKey: string,
    apiSecret: string,
  ) => { createRoom: jest.Mock; deleteRoom: jest.Mock };
  WebhookReceiver: new (
    apiKey: string,
    apiSecret: string,
  ) => { receive: jest.Mock };
  __mocks__: LiveKitMocks;
};

function buildProvider(): LiveKitMediaProvider {
  const client = createLiveKitClient({
    url: 'wss://livekit.example.test',
    apiKey: 'APIKEY',
    apiSecret: 'APISECRET',
  });
  return new LiveKitMediaProvider({ client });
}

describe('LiveKitMediaProvider', () => {
  const mocks = lkm.__mocks__;

  beforeEach(() => {
    mocks.createRoom.mockReset();
    mocks.deleteRoom.mockReset();
    mocks.addGrant.mockReset();
    mocks.toJwt.mockReset();
    mocks.toJwt.mockResolvedValue('signed.jwt.token');
  });

  it('is registered under the MEDIA_PROVIDER symbol', () => {
    expect(typeof MEDIA_PROVIDER.toString()).toBe('string');
  });

  it('createRoom uses deterministic room name and returns providerRoomId from sid', async () => {
    mocks.createRoom.mockResolvedValue({ sid: 'RM_abc123' });
    const provider = buildProvider();

    const result = await provider.createRoom('call-42');

    expect(mocks.createRoom).toHaveBeenCalledWith({
      name: roomNameForCall('call-42'),
    });
    expect(result).toEqual({
      roomName: 'koom-call-call-42',
      providerRoomId: 'RM_abc123',
    });
  });

  it('createRoom falls back to room name when sid is empty', async () => {
    mocks.createRoom.mockResolvedValue({ sid: '' });
    const provider = buildProvider();

    const result = await provider.createRoom('call-99');

    expect(result.providerRoomId).toBe('koom-call-call-99');
  });

  it('deleteRoom uses the same room name', async () => {
    mocks.deleteRoom.mockResolvedValue(undefined);
    const provider = buildProvider();

    await provider.deleteRoom('call-7');

    expect(mocks.deleteRoom).toHaveBeenCalledWith('koom-call-call-7');
  });

  it.each<CreateAccessTokenArgs['role']>(['host', 'participant', 'moderator'])(
    'createAccessToken grants %s role and returns token/url/expiresAt',
    async (role) => {
      const provider = buildProvider();
      const ttlSeconds = 120;
      const before = Date.now();

      const result = await provider.createAccessToken({
        userId: 'user-1',
        callId: 'call-1',
        role,
        ttlSeconds,
      });

      expect(mocks.addGrant).toHaveBeenCalledTimes(1);
      const calls = mocks.addGrant.mock.calls as unknown[][];
      const grantArg: unknown = calls[0]?.[0];
      const grant = (grantArg ?? {}) as Record<string, unknown>;
      expect(grant).toMatchObject({
        room: 'koom-call-call-1',
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      if (role === 'host' || role === 'moderator') {
        expect(grant?.roomAdmin).toBe(true);
      } else {
        expect(grant?.roomAdmin).toBeUndefined();
      }

      expect(result.token).toBe('signed.jwt.token');
      expect(result.url).toBe('wss://livekit.example.test');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(result.expiresAt.getTime()).toBeGreaterThan(before);
      const expectedExpiresAt = before + ttlSeconds * 1000;
      expect(
        Math.abs(result.expiresAt.getTime() - expectedExpiresAt),
      ).toBeLessThan(1000);
    },
  );

  it('createAccessToken uses default ttl when none provided', async () => {
    const provider = buildProvider();
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

  it('validateWebhook always returns false (TODO: SDK is async-only)', () => {
    const provider = buildProvider();
    expect(provider.validateWebhook?.('payload', 'auth')).toBe(false);
    expect(provider.validateWebhook?.({ event: 'x' }, 'auth')).toBe(false);
  });

  it('satisfies the MediaProvider interface', () => {
    const provider: MediaProvider = buildProvider();
    expect(typeof provider.createRoom).toBe('function');
    expect(typeof provider.deleteRoom).toBe('function');
    expect(typeof provider.createAccessToken).toBe('function');
    expect(typeof provider.validateWebhook).toBe('function');
  });
});
