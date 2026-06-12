jest.mock('livekit-server-sdk', () => {
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

  return {
    __esModule: false,
    AccessToken: AccessTokenMock,
    __mocks__: { addGrant, toJwt },
  };
});

import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as lk from 'livekit-server-sdk';
import { StaticSfuService } from './sfu.service';

const lkm = lk as unknown as {
  AccessToken: new (
    apiKey: string,
    apiSecret: string,
    options: { identity: string; ttl?: number | string },
  ) => { addGrant: jest.Mock; toJwt: jest.Mock };
  __mocks__: { addGrant: jest.Mock; toJwt: jest.Mock };
};

function buildConfig(
  values: Record<string, string | undefined>,
): ConfigService {
  return {
    get: <T = string>(key: string): T | undefined =>
      values[key] as T | undefined,
    getOrThrow: <T = string>(key: string): T => {
      const v = values[key];
      if (v === undefined) {
        throw new Error(`Missing env var ${key}`);
      }
      return v as T;
    },
  } as unknown as ConfigService;
}

describe('StaticSfuService', () => {
  const { addGrant, toJwt } = lkm.__mocks__;

  beforeEach(() => {
    addGrant.mockReset();
    toJwt.mockReset();
  });

  it('signs a LiveKit JWT with LIVEKIT_API_KEY/SECRET and a VideoGrant for the call room', async () => {
    toJwt.mockResolvedValue('signed.jwt.value');
    const service = new StaticSfuService(
      buildConfig({
        LIVEKIT_URL: 'ws://localhost:7880',
        LIVEKIT_API_KEY: 'devkey',
        LIVEKIT_API_SECRET: 'devsecret',
      }),
    );

    const result = await service.issueToken({
      callId: 'call-123',
      userId: 'user-abc',
    });

    expect(toJwt).toHaveBeenCalledTimes(1);
    expect(addGrant).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const grant = addGrant.mock.calls[0][0] as Record<string, unknown>;
    expect(grant).toMatchObject({
      room: 'sfu-call-123',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    expect(result).toEqual({
      token: 'signed.jwt.value',
      url: 'ws://localhost:7880',
      roomId: 'sfu-call-123',
      callId: 'call-123',
      userId: 'user-abc',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      expiresAt: expect.any(String),
    });
  });

  it('prefers SFU_URL over LIVEKIT_URL when both are set', async () => {
    toJwt.mockResolvedValue('jwt');
    const service = new StaticSfuService(
      buildConfig({
        SFU_URL: 'wss://sfu.koom.example.com/v1/rtc',
        LIVEKIT_URL: 'ws://localhost:7880',
        LIVEKIT_API_KEY: 'devkey',
        LIVEKIT_API_SECRET: 'devsecret',
      }),
    );

    const result = await service.issueToken({
      callId: 'c1',
      userId: 'u1',
    });

    expect(result.url).toBe('wss://sfu.koom.example.com/v1/rtc');
  });

  it('throws ServiceUnavailableException when LIVEKIT_API_KEY is missing', async () => {
    const service = new StaticSfuService(
      buildConfig({
        LIVEKIT_API_KEY: undefined,
        LIVEKIT_API_SECRET: 'devsecret',
      }),
    );

    await expect(
      service.issueToken({ callId: 'c1', userId: 'u1' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(toJwt).not.toHaveBeenCalled();
    expect(addGrant).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException when LIVEKIT_API_SECRET is missing', async () => {
    const service = new StaticSfuService(
      buildConfig({
        LIVEKIT_API_KEY: 'devkey',
        LIVEKIT_API_SECRET: undefined,
      }),
    );

    await expect(
      service.issueToken({ callId: 'c1', userId: 'u1' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('derives roomId as `sfu-<callId>` (preserves existing client contract)', async () => {
    toJwt.mockResolvedValue('jwt');
    const service = new StaticSfuService(
      buildConfig({
        LIVEKIT_API_KEY: 'devkey',
        LIVEKIT_API_SECRET: 'devsecret',
      }),
    );

    const result = await service.issueToken({
      callId: 'XYZ-789',
      userId: 'u1',
    });

    expect(result.roomId).toBe('sfu-XYZ-789');
  });
});

// Ensures the Test import is referenced (some configs tree-shake it otherwise).
void Test;
