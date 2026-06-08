import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import * as Io from 'socket.io';
import { loadConfig } from '../config/app.config';
import { RoomRegistry } from './room.registry';
import { isJoinPayload, isSignalPayload } from './signaling.types';
import type { JoinPayload, SignalPayload } from './signaling.types';

const config = loadConfig();

@WebSocketGateway({
  namespace: config.signaling.namespace,
  cors: { origin: config.signaling.corsOrigin },
})
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SignalingGateway.name);

  @WebSocketServer()
  server!: Io.Namespace;

  constructor(private readonly registry: RoomRegistry) {}

  handleConnection(client: Io.Socket) {
    this.logger.log(`client connected: ${client.id}`);
  }

  handleDisconnect(client: Io.Socket) {
    const left = this.registry.leave(client.id);
    for (const { roomId, userId } of left) {
      this.server.to(roomId).emit('user-left', {
        socketId: client.id,
        userId,
        roomId,
      });
      this.server.to(roomId).emit('peer:left', {
        socketId: client.id,
        userId,
        roomId,
        leftAt: Date.now(),
      });
    }
    if (left.length > 0) {
      this.logger.log(
        `client disconnected: ${client.id}; cleaned ${left.length} room(s)`,
      );
    }
  }

  @SubscribeMessage('join')
  handleJoin(
    @MessageBody() payload: JoinPayload,
    @ConnectedSocket() client: Io.Socket,
  ) {
    if (!isJoinPayload(payload)) {
      throw new WsException(
        'Invalid join payload: roomId and userId are required',
      );
    }
    const { roomId, userId } = payload;

    const result = this.registry.join(roomId, client.id, userId);
    void client.join(roomId);

    client.emit('existing-users', {
      socketIds: result.existingPeers.map((p) => p.socketId),
      members: result.existingPeers,
    });

    client.to(roomId).emit('user-joined', {
      socketId: client.id,
      userId,
    });

    client.to(roomId).emit('peer:joined', {
      socketId: client.id,
      userId,
      roomId,
      joinedAt: Date.now(),
    });

    return { ok: true, roomId, userId };
  }

  @SubscribeMessage('offer')
  handleOffer(
    @MessageBody() payload: SignalPayload,
    @ConnectedSocket() client: Io.Socket,
  ) {
    return this.forward(client, payload, 'offer');
  }

  @SubscribeMessage('answer')
  handleAnswer(
    @MessageBody() payload: SignalPayload,
    @ConnectedSocket() client: Io.Socket,
  ) {
    return this.forward(client, payload, 'answer');
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    @MessageBody() payload: SignalPayload,
    @ConnectedSocket() client: Io.Socket,
  ) {
    return this.forward(client, payload, 'ice-candidate');
  }

  private forward(
    client: Io.Socket,
    payload: SignalPayload,
    eventType: 'offer' | 'answer' | 'ice-candidate',
  ) {
    if (!isSignalPayload(payload)) {
      throw new WsException(`Invalid ${eventType} payload`);
    }
    const { roomId, to, signal } = payload;
    const from = payload.from || client.id;

    const target = this.registry.member(roomId, to);
    if (!target) {
      throw new WsException(`Target peer ${to} not in room ${roomId}`);
    }

    this.server.to(to).emit('signal', {
      from,
      to,
      signal,
      roomId,
      type: eventType,
    });
    return { ok: true, to, type: eventType };
  }
}
