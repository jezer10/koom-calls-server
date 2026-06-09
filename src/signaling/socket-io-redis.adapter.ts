import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions, Server as IoServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

/**
 * Accepts either a Nest application (production path: the adapter pulls the
 * underlying HTTP server from it) or a raw HTTP server / falsy value
 * (used by tests and offline mode).
 */
export type SocketIoRedisAdapterApp =
  | { getHttpServer?: () => unknown }
  | null
  | undefined;

export interface SocketIoRedisAdapterOptions {
  redisUrl?: string;
}

export class SocketIoRedisAdapter extends IoAdapter {
  private readonly redisUrl: string | undefined;

  constructor(
    app?: SocketIoRedisAdapterApp,
    options: SocketIoRedisAdapterOptions = {},
  ) {
    // Pass the underlying HTTP server so the IoAdapter mounts socket.io on
    // the same port as the REST API instead of binding a new port.
    const httpServer =
      app && typeof app.getHttpServer === 'function'
        ? app.getHttpServer()
        : (app as unknown);
    super(httpServer as never);
    this.redisUrl =
      options.redisUrl && options.redisUrl.length > 0
        ? options.redisUrl
        : undefined;
  }

  createIOServer(port: number, options?: ServerOptions): IoServer {
    const server = super.createIOServer(port, options) as IoServer;
    if (!this.redisUrl) {
      return server;
    }

    const pubClient: Redis = new Redis(this.redisUrl);
    const subClient: Redis = pubClient.duplicate();

    server.adapter(createAdapter(pubClient, subClient));

    return server;
  }
}
