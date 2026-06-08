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
  Req,
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
  CallConflictError,
  CallForbiddenError,
  CallInvalidStateError,
  CallNotFoundError,
  CallEventsStore,
  CallsService,
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
        roomId: dto.roomId,
        invitees: dto.invitees,
      });
      return this.toResponse(call);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Get(':id')
  get(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const call = this.calls.getCall(id);
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
      const call = this.calls.invite(id, userIdOrThrow(req), dto.inviteeId);
      return this.toResponse(call);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const call = this.calls.accept(id, userIdOrThrow(req));
      return this.toResponse(call);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Post(':id/join')
  @HttpCode(200)
  join(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const call = this.calls.join(id, userIdOrThrow(req));
      return this.toResponse(call);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Post(':id/end')
  @HttpCode(200)
  end(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const call = this.calls.end(id, userIdOrThrow(req));
      return this.toResponse(call);
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Get(':id/turn-credentials')
  async turnCredentials(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const userId = userIdOrThrow(req);
      const call = this.calls.getCall(id);
      if (!this.calls.isParticipant(call, userId)) {
        throw new CallForbiddenError('Not a participant of this call');
      }
      if (call.status === 'ended') {
        throw new CallInvalidStateError('Call has ended');
      }
      const creds = await this.turn.generateCredentials({
        userId,
        callId: id,
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
      const call = this.calls.getCall(id);
      if (!this.calls.isParticipant(call, userId)) {
        throw new CallForbiddenError('Not a participant of this call');
      }
      if (call.status === 'ended') {
        throw new CallInvalidStateError('Call has ended');
      }
      return await this.sfu.issueToken({ callId: id, userId });
    } catch (err) {
      throw this.translateError(err);
    }
  }

  @Get(':id/events')
  eventsFor(@Param('id') id: string, @Req() req: AuthedRequest) {
    try {
      const call = this.calls.getCall(id);
      const userId = userIdOrThrow(req);
      if (!this.calls.isParticipant(call, userId)) {
        throw new CallForbiddenError('Not a participant of this call');
      }
      return { events: this.events.forCall(id) };
    } catch (err) {
      throw this.translateError(err);
    }
  }

  private toResponse(call: ReturnType<CallsService['getCall']>) {
    return {
      id: call.id,
      roomId: call.roomId,
      status: call.status,
      creatorId: call.creatorId,
      participants: call.participants,
      createdAt: call.createdAt,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
      endedBy: call.endedBy,
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
    if (err instanceof Error) {
      return new BadRequestException(err.message);
    }
    return new BadRequestException('Unknown error');
  }
}
