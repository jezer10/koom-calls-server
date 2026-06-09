import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule, SocketIoRedisAdapter } from './app.module';
import { loadConfig } from './config/app.config';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'sqlite::memory:';
}

export interface BootstrapOptions {
  enablePeerServer?: boolean;
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<void> {
  const config = loadConfig();
  const logger = new Logger('Bootstrap');
  const enablePeer = options.enablePeerServer ?? false;

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: config.signaling.corsOrigin,
      credentials: true,
    },
  });

  app.useWebSocketAdapter(app.get(SocketIoRedisAdapter));

  if (enablePeer) {
    // Lazy-load the legacy PeerJS wiring via require so the _deprecated
    // module is only pulled in when the legacy path is explicitly enabled.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const peerModule = require('./_deprecated/peer/peer-server') as {
      startPeerServer: (opts: {
        port: number;
        key: string;
        path: string;
        allowDiscovery: boolean;
        logger: (line: string) => void;
        errorLogger: (line: string) => void;
        exitLogger: (code: number | null) => void;
      }) => unknown;
    };
    peerModule.startPeerServer({
      port: config.peer.port,
      key: config.peer.key,
      path: config.peer.path,
      allowDiscovery: config.peer.allowDiscovery,
      logger: (line: string) => logger.log(`[peerjs] ${line}`),
      errorLogger: (line: string) => logger.error(`[peerjs] ${line}`),
      exitLogger: (code: number | null) =>
        logger.error(`[peerjs] exited with code ${code}`),
    });
  }

  await app.listen(config.httpPort);

  logger.log(
    `Signaling server listening on http://localhost:${config.httpPort}`,
  );
  logger.log(
    `Socket.IO signaling: ${config.signaling.namespace} (path /socket.io)`,
  );
}

if (require.main === module) {
  void bootstrap();
}
