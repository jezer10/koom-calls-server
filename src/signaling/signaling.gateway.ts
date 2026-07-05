import { ConfigService } from '@nestjs/config';
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
import { Inject, Logger } from '@nestjs/common';
import type * as Io from 'socket.io';
import { RoomRegistry } from './room.registry';
import { RateLimitGuard } from './rate-limit.guard';
import { type CallsEventBus, CALLS_EVENT_BUS } from './calls-event-bus';
import { JwtWsMiddleware } from './jwt-ws.middleware';
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
} from './dto/signaling.dto';
import type {
  CallEventBroadcast,
  CallEventType,
  PeerJoinedEvent,
  PeerLeftEvent,
  PeerReconnectingEvent,
  SfuEventAck,
} from './signaling.types';

interface SocketData {
  userId?: string;
  token?: string;
}

function isSocketData(value: unknown): value is SocketData {
  return typeof value === 'object' && value !== null;
}

function getUserId(socket: Io.Socket): string {
  const data = socket.data as Record<string, unknown>;
  if (isSocketData(data) && typeof data.userId === 'string') {
    return data.userId;
  }
  throw new WsException('forbidden');
}

@WebSocketGateway()
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SignalingGateway.name);
  private readonly rateLimit = new RateLimitGuard();

  @WebSocketServer()
  server!: Io.Namespace;

  private readonly namespace: string;
  private readonly corsOrigin: string | string[];

  constructor(
    private readonly registry: RoomRegistry,
    @Inject(CALLS_EVENT_BUS) private readonly callsEventBus: CallsEventBus,
    private readonly configService: ConfigService,
  ) {
    this.namespace = this.configService.getOrThrow<string>(
      'signaling.namespace',
    );
    this.corsOrigin = this.configService.get<string>('app.corsOrigin') ?? '*';
  }

  afterInit(server: Io.Namespace): void {
    const middleware = new JwtWsMiddleware({
      secret: this.configService.getOrThrow<string>('auth.secret'),
    });
    server.use((socket: Io.Socket, next: (err?: Error) => void) => {
      middleware.use(socket, (err) => {
        if (err) {
          try {
            socket.emit('auth:error', { reason: 'unauthorized' });
            socket.disconnect(true);
          } catch {
            /* swallow */
          }
          next(err);
          return;
        }
        this.logger.log(
          `authenticated socket ${socket.id} as userId=${String(getUserId(socket))}`,
        );
        next();
      });
    });
  }

  handleConnection(client: Io.Socket): void {
    this.logger.log(`client connected: ${client.id}`);
  }

  handleDisconnect(client: Io.Socket): void {
    const left = this.registry.leave(client.id);
    for (const { callId, member } of left) {
      const event: PeerLeftEvent = {
        callId,
        userId: member.userId,
        socketId: client.id,
      };
      this.server.to(callId).emit('peer:left', event);
    }
    if (left.length > 0) {
      this.logger.log(
        `client disconnected: ${client.id}; cleaned ${left.length} call room(s)`,
      );
    }
  }

  async emitCallInvite(
    callId: string,
    from: string,
    to: string[],
    type: 'audio' | 'video',
  ): Promise<{ delivered: string[]; skipped: string[] }> {
    const delivered: string[] = [];
    const skipped: string[] = [];
    for (const userId of to) {
      const auth = await this.callsEventBus.isParticipant(callId, userId);
      const isParticipant =
        auth.authorized || this.registry.isParticipant(callId, userId);
      if (!isParticipant) {
        skipped.push(userId);
        continue;
      }
      const event = { callId, from, type };
      this.server.to(`user:${userId}`).emit('call:invite', event);
      delivered.push(userId);
    }
    return { delivered, skipped };
  }

  @SubscribeMessage('peer:join')
  async handlePeerJoin(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseCallInvitePayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    const callId = parsed.value.callId;
    if (parsed.value.from !== userId) {
      throw new WsException('forbidden');
    }
    const auth = await this.callsEventBus.isParticipant(callId, userId);
    if (!auth.authorized && !this.registry.isParticipant(callId, userId)) {
      throw new WsException('forbidden');
    }
    const member = this.registry.join(callId, client.id, userId);
    await client.join(callId);

    const event: PeerJoinedEvent = {
      callId,
      userId: member.userId,
      socketId: client.id,
    };
    client.to(callId).emit('peer:joined', event);

    const peers = this.registry
      .members(callId)
      .filter((m) => m.socketId !== client.id)
      .map((m) => ({ socketId: m.socketId, userId: m.userId }));

    return { ok: true, callId, userId, peers };
  }

  @SubscribeMessage('peer:leave')
  handlePeerLeave(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseCallRingingPayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    const callId = parsed.value.callId;
    const member = this.registry.member(callId, client.id);
    if (!member || member.userId !== userId) {
      throw new WsException('forbidden');
    }
    void client.leave(callId);
    this.registry.leave(client.id);
    const event: PeerLeftEvent = {
      callId,
      userId,
      socketId: client.id,
    };
    this.server.to(callId).emit('peer:left', event);
    return { ok: true, callId };
  }

  @SubscribeMessage('peer:reconnect')
  handlePeerReconnect(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseCallRingingPayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    const callId = parsed.value.callId;
    const member = this.registry.member(callId, client.id);
    if (!member || member.userId !== userId) {
      throw new WsException('forbidden');
    }
    const event: PeerReconnectingEvent = {
      callId,
      userId,
      socketId: client.id,
    };
    this.server.to(callId).emit('peer:reconnecting', event);
    return { ok: true, callId };
  }

  @SubscribeMessage('call:invite')
  async handleCallInvite(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseCallInvitePayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    const { callId, from, to, type } = parsed.value;
    if (from !== userId) {
      throw new WsException('forbidden');
    }
    await this.emitCallInvite(callId, from, to, type);
    return { ok: true, callId };
  }

  @SubscribeMessage('call:ringing')
  async handleCallRinging(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseCallRingingPayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    return this.handleCallEvent(parsed.value.callId, 'call:ringing', userId);
  }

  @SubscribeMessage('call:accept')
  async handleCallAccept(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseCallAcceptPayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    return this.handleCallEvent(parsed.value.callId, 'call:accept', userId);
  }

  @SubscribeMessage('call:reject')
  async handleCallReject(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseCallRejectPayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    return this.handleCallEvent(parsed.value.callId, 'call:reject', userId);
  }

  @SubscribeMessage('call:cancel')
  async handleCallCancel(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseCallCancelPayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    return this.handleCallEvent(parsed.value.callId, 'call:cancel', userId);
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseCallEndPayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    return this.handleCallEvent(parsed.value.callId, 'call:end', userId);
  }

  @SubscribeMessage('sfu:join-room')
  async handleSfuJoinRoom(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ): Promise<SfuEventAck> {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseSfuJoinRoomPayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    return this.handleSfuEvent(parsed.value.callId, userId, true);
  }

  @SubscribeMessage('sfu:publish-track')
  async handleSfuPublishTrack(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ): Promise<SfuEventAck> {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseSfuPublishTrackPayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    return this.handleSfuEvent(parsed.value.callId, userId, false);
  }

  @SubscribeMessage('sfu:subscribe-track')
  async handleSfuSubscribeTrack(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ): Promise<SfuEventAck> {
    this.enforceRateLimit(client);
    const userId = getUserId(client);
    const parsed = parseSfuSubscribeTrackPayload(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    return this.handleSfuEvent(parsed.value.callId, userId, false);
  }

  private async handleCallEvent(
    callId: string,
    event: CallEventType,
    userId: string,
  ): Promise<{ ok: true; callId: string; event: CallEventType }> {
    const auth = await this.callsEventBus.isParticipant(callId, userId);
    const isParticipant =
      auth.authorized || this.registry.isParticipant(callId, userId);
    if (!isParticipant) {
      throw new WsException('forbidden');
    }
    await this.callsEventBus.onCallEvent(callId, event, userId);
    const payload: CallEventBroadcast = { callId, from: userId, event };
    this.server.to(callId).emit('call:event', payload);
    return { ok: true, callId, event };
  }

  private async handleSfuEvent(
    callId: string,
    userId: string,
    requireConnectedState: boolean,
  ): Promise<SfuEventAck> {
    const auth = await this.callsEventBus.isParticipant(callId, userId);
    const isParticipant =
      auth.authorized || this.registry.isParticipant(callId, userId);
    if (!isParticipant) {
      throw new WsException('forbidden');
    }
    if (
      requireConnectedState &&
      auth.state !== 'accepted' &&
      auth.state !== 'active'
    ) {
      throw new WsException('forbidden');
    }
    return { status: 'pending-m3' };
  }

  private enforceRateLimit(client: Io.Socket): void {
    const allowed = this.rateLimit.tryConsume(client.id);
    if (!allowed) {
      throw new WsException('rate_limited');
    }
  }
}
