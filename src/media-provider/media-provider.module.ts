import { Module } from '@nestjs/common';
import { NoopMediaProvider } from './noop.media-provider';
import { MEDIA_PROVIDER } from './media-provider.interface';

@Module({
  providers: [
    NoopMediaProvider,
    { provide: MEDIA_PROVIDER, useExisting: NoopMediaProvider },
  ],
  exports: [MEDIA_PROVIDER, NoopMediaProvider],
})
export class MediaProviderModule {}
