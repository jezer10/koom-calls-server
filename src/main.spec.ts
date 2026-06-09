import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { bootstrap } from './main';
import { startPeerServer } from './_deprecated/peer/peer-server';

jest.mock('./_deprecated/peer/peer-server', () => ({
  startPeerServer: jest.fn(),
}));

const startPeerServerMock = startPeerServer as jest.MockedFunction<
  typeof startPeerServer
>;

describe('bootstrap()', () => {
  let logSpy: jest.SpyInstance;
  let createSpy: jest.SpyInstance;
  let listenSpy: jest.Mock;

  beforeEach(() => {
    startPeerServerMock.mockClear();
    listenSpy = jest.fn().mockResolvedValue(undefined);
    const fakeApp = {
      listen: listenSpy,
      get: jest.fn().mockReturnValue({}),
      useWebSocketAdapter: jest.fn(),
    };
    createSpy = jest
      .spyOn(NestFactory, 'create')
      .mockResolvedValue(fakeApp as never);
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    createSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('does NOT spawn the peer server by default', async () => {
    await bootstrap();
    expect(startPeerServerMock).not.toHaveBeenCalled();
  });

  it('does NOT log PeerJS broker / PeerJS WS in the banner by default', async () => {
    await bootstrap();
    const all = logSpy.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .join('\n');
    expect(all).not.toContain('PeerJS broker');
    expect(all).not.toContain('PeerJS WS');
  });

  it('still logs the signaling server banner', async () => {
    await bootstrap();
    const all = logSpy.mock.calls
      .map((c: unknown[]) => String(c[0]))
      .join('\n');
    expect(all).toContain('Signaling server listening');
    expect(all).toContain('Socket.IO signaling');
  });

  it('spawns the peer server only when explicitly opted in', async () => {
    await bootstrap({ enablePeerServer: true });
    expect(startPeerServerMock).toHaveBeenCalledTimes(1);
  });
});
