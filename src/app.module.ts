import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SignalingModule } from './signaling/signaling.module';
import { MediaProviderModule } from './media-provider/media-provider.module';

@Module({
  imports: [MediaProviderModule, SignalingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
