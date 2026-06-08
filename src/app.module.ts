import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SignalingModule } from './signaling/signaling.module';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [SignalingModule, SecurityModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
