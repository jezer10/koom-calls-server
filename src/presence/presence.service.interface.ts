export const PRESENCE_SERVICE = Symbol('PRESENCE_SERVICE');

export interface PresenceService {
  markOnline(userId: string, socketId: string): void;
  markOffline(userId: string, socketId: string): void;
  whoIsOnline(userIds: string[]): Promise<string[]>;
  trackCall(callId: string, socketId: string): void;
  untrackCall(callId: string, socketId: string): void;
  callParticipants(callId: string): Promise<string[]>;
}
