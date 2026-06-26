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
import { Test } from '@nestjs/testing';
import * as lk from 'livekit-server-sdk';
import { StaticSfuService } from './sfu.service';
import type { LiveKitConfig } from '../config/app.config';

const lkm = lk as unknown as {
  AccessToken: new (
    apiKey: string,
    apiSecret: string,
    options: { identity: string; ttl?: number | string },
  ) => { addGrant: jest.Mock; toJwt: jest.Mock };
  __mocks__: { addGrant: jest.Mock; toJwt: jest.Mock };
};

function buildConfig(values: Partial<LiveKitConfig>): LiveKitConfig {
  return {
    url: '',
    apiKey: '',
    apiSecret: '',
    httpUrl: '',
    sfuUrl: '',
    ...values,
  };
}

describe('StaticSfuService', () => {
  const { addGrant, toJwt } = lkm.__mocks__;

  beforeEach(() => {
    addGrant.mockReset();
    toJwt.mockReset();
  });

  it('signs a LiveKit JWT with apiKey/apiSecret and a VideoGrant for the call room', async () => {
    toJwt.mockResolvedValue('signed.jwt.value');
    const service = new StaticSfuService(
      buildConfig({
        url: 'ws://localhost:7880',
        apiKey: 'devkey',
        apiSecret: 'devsecret',
        sfuUrl: 'ws://localhost:7880',
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

  it('prefers sfuUrl over url', async () => {
    toJwt.mockResolvedValue('jwt');
    const service = new StaticSfuService(
      buildConfig({
        url: 'ws://localhost:7880',
        apiKey: 'devkey',
        apiSecret: 'devsecret',
        sfuUrl: 'wss://sfu.koom.example.com/v1/rtc',
      }),
    );

    const result = await service.issueToken({
      callId: 'c1',
      userId: 'u1',
    });

    expect(result.url).toBe('wss://sfu.koom.example.com/v1/rtc');
  });

  it('falls back to url when sfuUrl is empty', async () => {
    toJwt.mockResolvedValue('jwt');
    const service = new StaticSfuService(
      buildConfig({
        url: 'ws://localhost:7880',
        apiKey: 'devkey',
        apiSecret: 'devsecret',
        sfuUrl: '',
      }),
    );

    const result = await service.issueToken({ callId: 'c1', userId: 'u1' });
    expect(result.url).toBe('');
  });

  it('throws ServiceUnavailableException when apiKey is missing', async () => {
    const service = new StaticSfuService(
      buildConfig({ apiSecret: 'devsecret' }),
    );

    await expect(
      service.issueToken({ callId: 'c1', userId: 'u1' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(toJwt).not.toHaveBeenCalled();
    expect(addGrant).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException when apiSecret is missing', async () => {
    const service = new StaticSfuService(
      buildConfig({ apiKey: 'devkey' }),
    );

    await expect(
      service.issueToken({ callId: 'c1', userId: 'u1' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('derives roomId as `sfu-<callId>` (preserves existing client contract)', async () => {
    toJwt.mockResolvedValue('jwt');
    const service = new StaticSfuService(
      buildConfig({ apiKey: 'devkey', apiSecret: 'devsecret' }),
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
