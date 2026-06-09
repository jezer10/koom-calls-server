import { Module } from '@nestjs/common';
import { InMemoryPresenceService } from './presence.service';
import { PRESENCE_SERVICE } from './presence.service.interface';

@Module({
  providers: [
    InMemoryPresenceService,
    { provide: PRESENCE_SERVICE, useExisting: InMemoryPresenceService },
  ],
  exports: [PRESENCE_SERVICE, InMemoryPresenceService],
})
export class PresenceModule {}
