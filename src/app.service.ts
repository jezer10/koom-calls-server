import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHello(): string {
    return 'Koom Calls signaling server';
  }

  getInfo() {
    const signalingNamespace = this.configService.getOrThrow<string>(
      'SIGNALING_NAMESPACE',
    );
    return {
      name: 'koom-calls-server',
      version: '0.0.1',
      signaling: {
        namespace: signalingNamespace,
      },
      peer: {
        enabled: this.configService.get<string>('SKIP_PEER') !== '1',
        port: this.configService.getOrThrow<number>('PEER_PORT'),
        path: this.configService.getOrThrow<string>('PEER_PATH'),
        key: this.configService.getOrThrow<string>('PEER_KEY'),
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
