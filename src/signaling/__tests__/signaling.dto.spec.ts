import {
  parseCallAcceptPayload,
  parseCallCancelPayload,
  parseCallEndPayload,
  parseCallInvitePayload,
  parseCallRejectPayload,
  parseCallRingingPayload,
  parseSfuJoinRoomPayload,
  parseSfuPublishTrackPayload,
  parseSfuSubscribeTrackPayload,
  parseWebrtcAnswerPayload,
  parseWebrtcIceCandidatePayload,
  parseWebrtcOfferPayload,
} from '../dto/signaling.dto';

describe('signaling.dto parsers', () => {
  describe('parseCallInvitePayload', () => {
    it('accepts a valid payload', () => {
      const result = parseCallInvitePayload({
        callId: 'c1',
        from: 'alice',
        to: ['bob', 'carol'],
        type: 'video',
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.callId).toBe('c1');
        expect(result.value.to).toEqual(['bob', 'carol']);
      }
    });

    it.each([
      [{}],
      [{ callId: '' }],
      [{ callId: 'c1' }],
      [{ callId: 'c1', from: '', to: ['bob'], type: 'audio' }],
      [{ callId: 'c1', from: 'alice', to: [], type: 'audio' }],
      [{ callId: 'c1', from: 'alice', to: ['bob'], type: 'webrtc' }],
    ])('rejects %p', (input) => {
      const result = parseCallInvitePayload(input);
      expect(result.ok).toBe(false);
    });
  });

  describe('parseCallRingingPayload / parseCallAcceptPayload / parseCallRejectPayload / parseCallCancelPayload / parseCallEndPayload', () => {
    const parsers = {
      'call:ringing': parseCallRingingPayload,
      'call:accept': parseCallAcceptPayload,
      'call:reject': parseCallRejectPayload,
      'call:cancel': parseCallCancelPayload,
      'call:end': parseCallEndPayload,
    } as const;

    Object.entries(parsers).forEach(([name, parser]) => {
      describe(name, () => {
        it('accepts a payload with callId', () => {
          const r = parser({ callId: 'c1' });
          expect(r.ok).toBe(true);
        });
        it('rejects a payload without callId', () => {
          const r = parser({});
          expect(r.ok).toBe(false);
        });
        it('rejects non-objects', () => {
          const r = parser('nope');
          expect(r.ok).toBe(false);
        });
      });
    });
  });

  describe('webrtc signal parsers', () => {
    const parsers = {
      'webrtc:offer': parseWebrtcOfferPayload,
      'webrtc:answer': parseWebrtcAnswerPayload,
      'webrtc:ice-candidate': parseWebrtcIceCandidatePayload,
    } as const;

    Object.entries(parsers).forEach(([name, parser]) => {
      describe(name, () => {
        it('accepts a valid signal payload', () => {
          const r = parser({ callId: 'c1', to: 'bob', signal: { sdp: 'x' } });
          expect(r.ok).toBe(true);
        });
        it('rejects when to is missing', () => {
          const r = parser({ callId: 'c1', signal: {} });
          expect(r.ok).toBe(false);
        });
        it('rejects when callId is missing', () => {
          const r = parser({ to: 'bob', signal: {} });
          expect(r.ok).toBe(false);
        });
      });
    });
  });

  describe('sfu parsers', () => {
    const parsers = {
      'sfu:join-room': parseSfuJoinRoomPayload,
      'sfu:publish-track': parseSfuPublishTrackPayload,
      'sfu:subscribe-track': parseSfuSubscribeTrackPayload,
    } as const;

    Object.entries(parsers).forEach(([name, parser]) => {
      describe(name, () => {
        it('accepts a payload with callId', () => {
          const r = parser({ callId: 'c1' });
          expect(r.ok).toBe(true);
        });
        it('accepts extra optional fields', () => {
          const r = parser({
            callId: 'c1',
            room: 'room-1',
            trackId: 'track-1',
          });
          expect(r.ok).toBe(true);
        });
        it('rejects when callId is missing', () => {
          const r = parser({ room: 'r' });
          expect(r.ok).toBe(false);
        });
      });
    });
  });
});
