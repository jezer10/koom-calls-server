import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions, Server as IoServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';

export interface SocketIoRedisAdapterOptions {
  redisUrl?: string;
}

export class SocketIoRedisAdapter extends IoAdapter {
  private readonly redisUrl: string | undefined;

  constructor(app?: object, options: SocketIoRedisAdapterOptions = {}) {
    super(app);
    const envUrl = process.env.REDIS_URL;
    this.redisUrl =
      options.redisUrl ?? (envUrl && envUrl.length > 0 ? envUrl : undefined);
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
