import { Injectable, Logger } from '@nestjs/common';
import type { RoomMember } from './signaling.types';

@Injectable()
export class RoomRegistry {
  private readonly logger = new Logger(RoomRegistry.name);
  private readonly rooms = new Map<string, Map<string, RoomMember>>();

  join(callId: string, socketId: string, userId: string): RoomMember {
    const room = this.rooms.get(callId) ?? new Map<string, RoomMember>();
    const member: RoomMember = {
      socketId,
      userId,
      joinedAt: Date.now(),
    };
    room.set(socketId, member);
    this.rooms.set(callId, room);
    this.logger.debug(
      `join callId=${callId} socketId=${socketId} userId=${userId} peers=${room.size - 1}`,
    );
    return member;
  }

  leave(socketId: string): Array<{ callId: string; member: RoomMember }> {
    const out: Array<{ callId: string; member: RoomMember }> = [];
    for (const [callId, members] of this.rooms) {
      const member = members.get(socketId);
      if (member) {
        members.delete(socketId);
        out.push({ callId, member });
        if (members.size === 0) this.rooms.delete(callId);
      }
    }
    if (out.length > 0) {
      this.logger.debug(`leave socketId=${socketId} rooms=${out.length}`);
    }
    return out;
  }

  members(callId: string): RoomMember[] {
    return Array.from(this.rooms.get(callId)?.values() ?? []);
  }

  member(callId: string, socketId: string): RoomMember | undefined {
    return this.rooms.get(callId)?.get(socketId);
  }

  hasMember(callId: string, userId: string): boolean {
    const room = this.rooms.get(callId);
    if (!room) return false;
    for (const member of room.values()) {
      if (member.userId === userId) return true;
    }
    return false;
  }

  isParticipant(callId: string, userId: string): boolean {
    return this.hasMember(callId, userId);
  }

  reset(): void {
    this.rooms.clear();
  }

  snapshotForTests(): Map<string, Map<string, RoomMember>> {
    const out = new Map<string, Map<string, RoomMember>>();
    for (const [callId, members] of this.rooms) {
      out.set(callId, new Map(members));
    }
    return out;
  }
}
