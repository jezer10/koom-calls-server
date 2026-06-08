import { isJoinPayload, isSignalPayload } from './signaling.types';

describe('signaling.types guards', () => {
  describe('isJoinPayload', () => {
    it.each([
      [null, false],
      [undefined, false],
      ['string', false],
      [42, false],
      [{}, false],
      [{ roomId: '' }, false],
      [{ userId: 'alice' }, false],
      [{ roomId: 'r', userId: '' }, false],
      [{ roomId: 'r', userId: 'alice' }, true],
      [{ roomId: 'r', userId: 'alice', extra: 1 }, true],
    ])('validates %p as %p', (input, expected) => {
      expect(isJoinPayload(input)).toBe(expected);
    });
  });

  describe('isSignalPayload', () => {
    it.each([
      [null, false],
      [{}, false],
      [{ roomId: 'r', from: 'a', to: 'b' }, false],
      [{ roomId: 'r', from: 'a', to: 'b', signal: null }, true],
      [{ roomId: 'r', from: 'a', to: 'b', signal: { sdp: 'x' } }, true],
    ])('validates %p as %p', (input, expected) => {
      expect(isSignalPayload(input)).toBe(expected);
    });
  });
});
