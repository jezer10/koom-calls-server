import { Injectable } from '@nestjs/common';
import { loadConfig } from './config/app.config';

@Injectable()
export class AppService {
  private readonly config = loadConfig();

  getHello(): string {
    return 'Koom Calls signaling server';
  }

  getInfo() {
    return {
      name: 'koom-calls-server',
      version: '0.0.1',
      signaling: {
        namespace: this.config.signaling.namespace,
      },
      peer: {
        enabled: this.config.peer.enabled,
        port: this.config.peer.port,
        path: this.config.peer.path,
        key: this.config.peer.key,
      },
    };
  }

  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
