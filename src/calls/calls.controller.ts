import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/authenticated-user';
import { TURN_SERVICE } from '../turn/turn.types';
import type { TurnService } from '../turn/turn.types';
import { SFU_SERVICE } from '../sfu/sfu.types';
import type { SfuService } from '../sfu/sfu.types';
import {
  CallCodeCollisionError,
  CallConflictError,
  CallForbiddenError,
  CallInvalidStateError,
  CallNotFoundError,
  CallEventsStore,
  CallsService,
  ListStatus,
} from './calls.service';
import { parseCreateCallDto, parseInviteCallDto } from './dto';

interface AuthedRequest extends Request {
  user?: AuthenticatedUser;
}

function userIdOrThrow(req: AuthedRequest): string {
  if (!req.user) {
    throw new ForbiddenException('Authenticated user required');
  }
  return req.user.userId;
}

function parseListStatus(raw: unknown): ListStatus {
  if (raw === undefined || raw === null || raw === '') return 'all';
  if (raw === 'all' || raw === 'pending' || raw === 'active' || raw === 'ended') {
    return raw;
  }
  throw new BadRequestException(
    "status must be one of: 'all', 'pending', 'active', 'ended'",
  );
}

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(
    private readonly calls: CallsService,
    private readonly events: CallEventsStore,
    @Inject(TURN_SERVICE) private readonly turn: TurnService,
    @Inject(SFU_SERVICE) private readonly sfu: SfuService,
  ) {}

  @Post()
  @HttpCode(201)
  create(@Body() body: unknown, @Req() req: AuthedRequest) {
    try {
      const dto = parseCreateCallDto(body);
      const call = this.calls.createCall({
        creatorId: userIdOrThrow(req),
        invitees: dto.invitees,
        visibility: dto.visibility,
      });
      return this.toResponse(call);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Get('mine')
  listMine(@Query('status') statusRaw: unknown, @Req() req: AuthedRequest) {
    try {
      const status = parseListStatus(statusRaw);
      const userId = userIdOrThrow(req);
      const calls = this.calls.listForUser(userId, { status });
      return { calls: calls.map((c) => this.toListItem(c)) };
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const call = this.calls.getCallByIdOrCode(id);
      const userId = userIdOrThrow(req);
      if (!this.calls.isParticipant(call, userId)) {
        throw new CallForbiddenError('Not a participant of this call');
      }
      return this.toResponse(call);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Post(':id/invite')
  @HttpCode(200)
  invite(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: AuthedRequest,
  ) {
    try {
      const dto = parseInviteCallDto(body);
      const call = this.calls.getCallByIdOrCode(id);
      const updated = this.calls.invite(call.id, userIdOrThrow(req), dto.inviteeId);
      return this.toResponse(updated);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const call = this.calls.getCallByIdOrCode(id);
      const updated = this.calls.accept(call.id, userIdOrThrow(req));
      return this.toResponse(updated);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Post(':id/join')
  @HttpCode(200)
  join(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const call = this.calls.getCallByIdOrCode(id);
      const updated = this.calls.join(call.id, userIdOrThrow(req));
      return this.toResponse(updated);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Post(':id/end')
  @HttpCode(200)
  end(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const call = this.calls.getCallByIdOrCode(id);
      const updated = this.calls.end(call.id, userIdOrThrow(req));
      return this.toResponse(updated);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Get(':id/turn-credentials')
  async turnCredentials(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const userId = userIdOrThrow(req);
      const call = this.calls.getCallByIdOrCode(id);
      if (!this.calls.isParticipant(call, userId)) {
        throw new CallForbiddenError('Not a participant of this call');
      }
      if (call.status === 'ended') {
        throw new CallInvalidStateError('Call has ended');
      }
      const creds = await this.turn.generateCredentials({
        userId,
        callId: call.id,
      });
      return creds;
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Post(':id/sfu-token')
  @HttpCode(200)
  async sfuToken(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const userId = userIdOrThrow(req);
      const call = this.calls.getCallByIdOrCode(id);
      if (!this.calls.isParticipant(call, userId)) {
        throw new CallForbiddenError('Not a participant of this call');
      }
      if (call.status === 'ended') {
        throw new CallInvalidStateError('Call has ended');
      }
      return await this.sfu.issueToken({ callId: call.id, userId });
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Get(':id/events')
  eventsFor(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const call = this.calls.getCallByIdOrCode(id);
      const userId = userIdOrThrow(req);
      if (!this.calls.isParticipant(call, userId)) {
        throw new CallForbiddenError('Not a participant of this call');
      }
      return { events: this.events.forCall(call.id) };
    } catch (err) {
      throw this.translateError(err);
    }
  }

  private toResponse(call: ReturnType<CallsService['getCall']>) {
    return {
      id: call.id,
      roomId: call.roomId,
      status: call.status,
      visibility: call.visibility,
      creatorId: call.creatorId,
      participants: call.participants,
      createdAt: call.createdAt,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      endedBy: call.endedBy,
    };
  }

  private toListItem(call: ReturnType<CallsService['getCall']>) {
    return {
      id: call.id,
      roomId: call.roomId,
      status: call.status,
      visibility: call.visibility,
      creatorId: call.creatorId,
      createdAt: call.createdAt,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      participantCount: call.participants.length,
    };
  }

  private translateError(err: unknown): Error {
    if (err instanceof CallNotFoundError) {
      return new NotFoundException(err.message);
    }
    if (err instanceof CallForbiddenError) {
      return new ForbiddenException(err.message);
    }
    if (err instanceof CallConflictError) {
      return new ConflictException(err.message);
    }
    if (err instanceof CallInvalidStateError) {
      return new ConflictException(err.message);
    }
    if (err instanceof CallCodeCollisionError) {
      return new ServiceUnavailableException(err.message);
    }
    if (err instanceof Error) {
      return new BadRequestException(err.message);
    }
    return new BadRequestException('Unknown error');
  }
}
