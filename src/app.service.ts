import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHello(): string {
    return 'Koom Calls signaling server';
  }

  getInfo() {
    return {
      name: 'koom-calls-server',
      version: '0.0.1',
      signaling: {
        namespace: this.configService.getOrThrow<string>('signaling.namespace'),
      },
      media: {
        provider: 'livekit',
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
