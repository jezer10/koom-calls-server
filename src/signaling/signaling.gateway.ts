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
import { loadConfig } from '../config/app.config';
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
  parseWebrtcAnswerPayload,
  parseWebrtcIceCandidatePayload,
  parseWebrtcOfferPayload,
} from './dto/signaling.dto';
import type {
  CallEventType,
  PeerJoinedEvent,
  PeerLeftEvent,
  PeerReconnectingEvent,
  RoomMember,
  SfuEventAck,
} from './signaling.types';

const config = loadConfig();

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

@WebSocketGateway({
  namespace: config.signaling.namespace,
  cors: { origin: config.signaling.corsOrigin },
})
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(SignalingGateway.name);
  private readonly rateLimit = new RateLimitGuard();

  @WebSocketServer()
  server!: Io.Namespace;

  constructor(
    private readonly registry: RoomRegistry,
    @Inject(CALLS_EVENT_BUS) private readonly callsEventBus: CallsEventBus,
  ) {}

  afterInit(server: Io.Namespace): void {
    const middleware = new JwtWsMiddleware({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
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

  // --- Outgoing "invite" helper (server -> client) ----------------------------

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

  // --- Subscribe handlers ----------------------------------------------------

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
    if (!this.registry.isParticipant(callId, userId)) {
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

  @SubscribeMessage('call:ringing')
  async handleCallRinging(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.forwardCallEvent(
      client,
      payload,
      'call:ringing',
      parseCallRingingPayload,
    );
  }

  @SubscribeMessage('call:accept')
  async handleCallAccept(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.forwardCallEvent(
      client,
      payload,
      'call:accept',
      parseCallAcceptPayload,
    );
  }

  @SubscribeMessage('call:reject')
  async handleCallReject(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.forwardCallEvent(
      client,
      payload,
      'call:reject',
      parseCallRejectPayload,
    );
  }

  @SubscribeMessage('call:cancel')
  async handleCallCancel(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.forwardCallEvent(
      client,
      payload,
      'call:cancel',
      parseCallCancelPayload,
    );
  }

  @SubscribeMessage('call:end')
  async handleCallEnd(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.forwardCallEvent(
      client,
      payload,
      'call:end',
      parseCallEndPayload,
    );
  }

  @SubscribeMessage('webrtc:offer')
  handleWebrtcOffer(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.forwardWebrtc(
      client,
      payload,
      'webrtc:offer',
      parseWebrtcOfferPayload,
    );
  }

  @SubscribeMessage('webrtc:answer')
  handleWebrtcAnswer(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.forwardWebrtc(
      client,
      payload,
      'webrtc:answer',
      parseWebrtcAnswerPayload,
    );
  }

  @SubscribeMessage('webrtc:ice-candidate')
  handleWebrtcIceCandidate(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.forwardWebrtc(
      client,
      payload,
      'webrtc:ice-candidate',
      parseWebrtcIceCandidatePayload,
    );
  }

  @SubscribeMessage('sfu:join-room')
  async handleSfuJoinRoom(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.handleSfu(
      client,
      payload,
      'sfu:join-room',
      parseSfuJoinRoomPayload,
      ['accepted', 'active'],
    );
  }

  @SubscribeMessage('sfu:publish-track')
  async handleSfuPublishTrack(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.handleSfu(
      client,
      payload,
      'sfu:publish-track',
      parseSfuPublishTrackPayload,
    );
  }

  @SubscribeMessage('sfu:subscribe-track')
  async handleSfuSubscribeTrack(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Io.Socket,
  ) {
    this.enforceRateLimit(client);
    return this.handleSfu(
      client,
      payload,
      'sfu:subscribe-track',
      parseSfuSubscribeTrackPayload,
    );
  }

  // --- Private helpers --------------------------------------------------------

  private enforceRateLimit(client: Io.Socket): void {
    if (!this.rateLimit.tryConsume(client.id)) {
      throw new WsException('rate-limit');
    }
  }

  private async forwardCallEvent(
    client: Io.Socket,
    payload: unknown,
    event: CallEventType,
    parser: (
      v: unknown,
    ) =>
      | { ok: true; value: { callId: string } }
      | { ok: false; reason: string },
  ): Promise<{ ok: true; callId: string; event: CallEventType }> {
    const userId = getUserId(client);
    const parsed = parser(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    const callId = parsed.value.callId;
    const auth = await this.callsEventBus.isParticipant(callId, userId);
    if (!auth.authorized && !this.registry.isParticipant(callId, userId)) {
      throw new WsException('forbidden');
    }
    this.server.to(callId).emit('call:event', {
      callId,
      from: userId,
      event,
    });
    void this.callsEventBus.onCallEvent(callId, event, userId);
    return { ok: true, callId, event };
  }

  private forwardWebrtc(
    client: Io.Socket,
    payload: unknown,
    type: 'webrtc:offer' | 'webrtc:answer' | 'webrtc:ice-candidate',
    parser: (
      v: unknown,
    ) =>
      | { ok: true; value: { callId: string; to: string; signal: unknown } }
      | { ok: false; reason: string },
  ): { ok: true; callId: string; to: string; type: string } {
    const userId = getUserId(client);
    const parsed = parser(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    const { callId, to, signal } = parsed.value;
    if (!this.registry.isParticipant(callId, userId)) {
      throw new WsException('forbidden');
    }
    const targetMember = this.findMemberByUserId(callId, to);
    if (!targetMember) {
      throw new WsException(`target user ${to} not in call ${callId}`);
    }
    this.server.to(targetMember.socketId).emit('webrtc:signal', {
      callId,
      from: userId,
      to,
      type,
      signal,
    });
    return { ok: true, callId, to, type };
  }

  private async handleSfu(
    client: Io.Socket,
    payload: unknown,
    type: 'sfu:join-room' | 'sfu:publish-track' | 'sfu:subscribe-track',
    parser: (
      v: unknown,
    ) =>
      | { ok: true; value: { callId: string } }
      | { ok: false; reason: string },
    requiredStates?: Array<
      'pending' | 'ringing' | 'accepted' | 'active' | 'ended'
    >,
  ): Promise<SfuEventAck> {
    const userId = getUserId(client);
    const parsed = parser(payload);
    if (!parsed.ok) {
      throw new WsException(`invalid payload: ${parsed.reason}`);
    }
    const callId = parsed.value.callId;
    const auth = await this.callsEventBus.isParticipant(callId, userId);
    if (!auth.authorized) {
      throw new WsException('forbidden');
    }
    if (requiredStates && requiredStates.length > 0) {
      const state = auth.state;
      if (!state || !requiredStates.includes(state)) {
        throw new WsException(
          `call ${callId} not in required state (${requiredStates.join('|')})`,
        );
      }
    }
    void type;
    return { status: 'pending-m3' };
  }

  private findMemberByUserId(
    callId: string,
    userId: string,
  ): RoomMember | undefined {
    for (const member of this.registry.members(callId)) {
      if (member.userId === userId) return member;
    }
    return undefined;
  }
}
