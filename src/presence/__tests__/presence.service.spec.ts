import { InMemoryPresenceService } from '../presence.service';

describe('InMemoryPresenceService', () => {
  let service: InMemoryPresenceService;

  beforeEach(() => {
    service = new InMemoryPresenceService();
  });

  describe('presence', () => {
    it('marks a user online and offline', async () => {
      service.markOnline('alice', 'sock-1');
      expect(await service.whoIsOnline(['alice', 'bob'])).toEqual(['alice']);

      service.markOffline('alice', 'sock-1');
      expect(await service.whoIsOnline(['alice'])).toEqual([]);
    });

    it('keeps the user online while at least one socket remains', async () => {
      service.markOnline('alice', 'sock-1');
      service.markOnline('alice', 'sock-2');
      service.markOffline('alice', 'sock-1');
      expect(await service.whoIsOnline(['alice'])).toEqual(['alice']);
      service.markOffline('alice', 'sock-2');
      expect(await service.whoIsOnline(['alice'])).toEqual([]);
    });

    it('returns the intersection of the input list and online users', async () => {
      service.markOnline('alice', 's1');
      service.markOnline('bob', 's2');
      expect(await service.whoIsOnline(['alice', 'bob', 'carol'])).toEqual([
        'alice',
        'bob',
      ]);
    });

    it('returns an empty list when input is empty', async () => {
      expect(await service.whoIsOnline([])).toEqual([]);
    });
  });

  describe('call tracking', () => {
    it('tracks and untracks sockets per call', async () => {
      service.markOnline('alice', 's1');
      service.markOnline('bob', 's2');
      service.trackCall('call-1', 's1');
      service.trackCall('call-1', 's2');
      expect(await service.callParticipants('call-1')).toEqual([
        'alice',
        'bob',
      ]);

      service.untrackCall('call-1', 's1');
      expect(await service.callParticipants('call-1')).toEqual(['bob']);
    });

    it('returns an empty list for a call with no participants', async () => {
      expect(await service.callParticipants('unknown')).toEqual([]);
    });

    it('ignores sockets without a user mapping', async () => {
      service.trackCall('call-2', 'orphan-sock');
      expect(await service.callParticipants('call-2')).toEqual([]);
    });
  });
});
