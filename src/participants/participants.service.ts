import { Injectable } from '@nestjs/common';

@Injectable()
export class ParticipantsService {
  // Minimal noop. LBR-68/69 will add the real implementation; for M1 we
  // only need the class to exist so ParticipantsModule can wire it.
  ping(): string {
    return 'participants:ok';
  }
}
