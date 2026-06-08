import { Module } from '@nestjs/common';
import { StaticSfuService } from './sfu.service';
import { SFU_SERVICE } from './sfu.types';

@Module({
  providers: [
    StaticSfuService,
    {
      provide: SFU_SERVICE,
      useExisting: StaticSfuService,
    },
  ],
  exports: [SFU_SERVICE, StaticSfuService],
})
export class SfuModule {}
