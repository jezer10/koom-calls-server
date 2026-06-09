import { Injectable } from '@nestjs/common';
import type { PresenceService } from './presence.service.interface';

@Injectable()
export class InMemoryPresenceService implements PresenceService {
  private readonly userSockets = new Map<string, Set<string>>();
  private readonly socketToUser = new Map<string, string>();
  private readonly callSockets = new Map<string, Set<string>>();
  private readonly socketToCall = new Map<string, string>();

  markOnline(userId: string, socketId: string): void {
    let sockets = this.userSockets.get(userId);
    if (!sockets) {
      sockets = new Set();
      this.userSockets.set(userId, sockets);
    }
    sockets.add(socketId);
    this.socketToUser.set(socketId, userId);
  }

  markOffline(userId: string, socketId: string): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) this.userSockets.delete(userId);
    }
    this.socketToUser.delete(socketId);
  }

  async whoIsOnline(userIds: string[]): Promise<string[]> {
    return Promise.resolve(
      userIds.filter((id) => (this.userSockets.get(id)?.size ?? 0) > 0),
    );
  }

  trackCall(callId: string, socketId: string): void {
    let sockets = this.callSockets.get(callId);
    if (!sockets) {
      sockets = new Set();
      this.callSockets.set(callId, sockets);
    }
    sockets.add(socketId);
    this.socketToCall.set(socketId, callId);
  }

  untrackCall(callId: string, socketId: string): void {
    const sockets = this.callSockets.get(callId);
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) this.callSockets.delete(callId);
    }
    this.socketToCall.delete(socketId);
  }

  async callParticipants(callId: string): Promise<string[]> {
    const sockets = this.callSockets.get(callId) ?? new Set<string>();
    const userIds = new Set<string>();
    for (const socketId of sockets) {
      const userId = this.socketToUser.get(socketId);
      if (userId) userIds.add(userId);
    }
    return Promise.resolve(Array.from(userIds));
  }
}
