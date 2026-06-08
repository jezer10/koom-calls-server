import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadConfig } from './config/app.config';
import { startPeerServer } from './peer/peer-server';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'sqlite::memory:';
}

export interface BootstrapOptions {
  enablePeerServer?: boolean;
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<void> {
  const config = loadConfig();
  const logger = new Logger('Bootstrap');
  const enablePeer = options.enablePeerServer ?? config.peer.enabled;

  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: config.signaling.corsOrigin,
      credentials: true,
    },
  });

  if (enablePeer) {
    startPeerServer({
      port: config.peer.port,
      key: config.peer.key,
      path: config.peer.path,
      allowDiscovery: config.peer.allowDiscovery,
      logger: (line) => logger.log(`[peerjs] ${line}`),
      errorLogger: (line) => logger.error(`[peerjs] ${line}`),
      exitLogger: (code) => logger.error(`[peerjs] exited with code ${code}`),
    });
  }

  await app.listen(config.httpPort);

  logger.log(
    `Signaling server listening on http://localhost:${config.httpPort}`,
  );
  logger.log(
    `Socket.IO signaling: ${config.signaling.namespace} (path /socket.io)`,
  );
  if (enablePeer) {
    logger.log(
      `PeerJS broker:  http://localhost:${config.peer.port}${config.peer.path === '/' ? '' : config.peer.path}/${config.peer.key}/id`,
    );
    logger.log(
      `PeerJS WS:      ws://localhost:${config.peer.port}/${config.peer.key}/<id>/<token>?key=${config.peer.key}`,
    );
  }
}

if (require.main === module) {
  void bootstrap();
}
