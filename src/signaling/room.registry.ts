import { Injectable, Logger } from '@nestjs/common';

export interface RoomMember {
  socketId: string;
  userId: string;
  joinedAt: number;
}

export interface JoinResult {
  selfSocketId: string;
  existingPeers: RoomMember[];
}

@Injectable()
export class RoomRegistry {
  private readonly logger = new Logger(RoomRegistry.name);
  private readonly rooms = new Map<string, Map<string, RoomMember>>();

  join(roomId: string, socketId: string, userId: string): JoinResult {
    const members = this.rooms.get(roomId) ?? new Map<string, RoomMember>();
    const existing: RoomMember[] = [];
    for (const [id, member] of members) {
      if (id !== socketId) existing.push(member);
    }

    members.set(socketId, {
      socketId,
      userId,
      joinedAt: Date.now(),
    });
    this.rooms.set(roomId, members);

    this.logger.log(
      `user ${userId} (${socketId}) joined room ${roomId}; peers=${existing.length}`,
    );

    return { selfSocketId: socketId, existingPeers: existing };
  }

  leave(socketId: string): Array<{ roomId: string; userId: string }> {
    const left: Array<{ roomId: string; userId: string }> = [];
    for (const [roomId, members] of this.rooms) {
      const member = members.get(socketId);
      if (member) {
        members.delete(socketId);
        left.push({ roomId, userId: member.userId });
        if (members.size === 0) this.rooms.delete(roomId);
      }
    }
    return left;
  }

  members(roomId: string): RoomMember[] {
    return Array.from(this.rooms.get(roomId)?.values() ?? []);
  }

  member(roomId: string, socketId: string): RoomMember | undefined {
    return this.rooms.get(roomId)?.get(socketId);
  }

  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  roomCount(): number {
    return this.rooms.size;
  }

  memberCount(): number {
    let total = 0;
    for (const members of this.rooms.values()) total += members.size;
    return total;
  }

  reset(): void {
    this.rooms.clear();
  }
}
