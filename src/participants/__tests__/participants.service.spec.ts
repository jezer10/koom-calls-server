import { ParticipantsService } from '../participants.service';

describe('ParticipantsService', () => {
  it('is constructible with no dependencies', () => {
    const service = new ParticipantsService();
    expect(service).toBeInstanceOf(ParticipantsService);
  });

  it('exposes a noop ping() for M1', () => {
    const service = new ParticipantsService();
    expect(service.ping()).toBe('participants:ok');
  });
});
