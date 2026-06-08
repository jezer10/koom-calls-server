import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SignalingModule } from './signaling/signaling.module';
import { ObservabilityModule } from './observability/observability.module';

@Module({
  imports: [SignalingModule, ObservabilityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
