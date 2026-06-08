import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  CallsService,
  CallForbiddenError,
  CallNotFoundError,
} from './calls.service';
import {
  InvalidCallTransitionError,
  type CallState,
} from './domain/call-state.machine';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
    email?: string;
    [k: string]: unknown;
  };
}

interface CreateCallDto {
  type: 'audio' | 'video';
}

function userIdFrom(req: AuthenticatedRequest): string {
  const id = req.user?.userId;
  if (typeof id !== 'string' || id === '') {
    throw new BadRequestException('authenticated user is required');
  }
  return id;
}

@Controller('calls')
@UseGuards(JwtAuthGuard)
export class CallsController {
  constructor(private readonly calls: CallsService) {}

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() body: CreateCallDto) {
    const userId = userIdFrom(req);
    if (body?.type !== 'audio' && body?.type !== 'video') {
      throw new BadRequestException('type must be "audio" or "video"');
    }
    const call = await this.calls.createCall({
      type: body.type,
      createdBy: userId,
    });
    return {
      id: call.id,
      type: call.type,
      mode: call.mode,
      status: call.status,
      createdBy: call.createdBy,
      startedAt: call.startedAt,
      endedAt: call.endedAt,
    };
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    try {
      const call = await this.calls.findById(id);
      return call;
    } catch (err) {
      throw mapNotFound(err);
    }
  }

  @Post(':id/invite')
  @HttpCode(HttpStatus.OK)
  async invite(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ status: CallState }> {
    const userId = userIdFrom(req);
    try {
      const call = await this.calls.invite(id, {
        userId,
        hostUserId: userId,
      });
      return { status: call.status };
    } catch (err) {
      throw mapError(err);
    }
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  async accept(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ status: CallState }> {
    const userId = userIdFrom(req);
    try {
      const call = await this.calls.accept(id, { userId });
      return { status: call.status };
    } catch (err) {
      throw mapError(err);
    }
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ status: CallState }> {
    const userId = userIdFrom(req);
    try {
      const call = await this.calls.reject(id, { userId });
      return { status: call.status };
    } catch (err) {
      throw mapError(err);
    }
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ status: CallState }> {
    const userId = userIdFrom(req);
    try {
      const call = await this.calls.cancel(id, {
        userId,
        hostUserId: userId,
      });
      return { status: call.status };
    } catch (err) {
      throw mapError(err);
    }
  }

  @Post(':id/connect')
  @HttpCode(HttpStatus.OK)
  async connect(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ status: CallState }> {
    const userId = userIdFrom(req);
    try {
      const call = await this.calls.connect(id, { userId });
      return { status: call.status };
    } catch (err) {
      throw mapError(err);
    }
  }

  @Post(':id/active')
  @HttpCode(HttpStatus.OK)
  async activate(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ status: CallState }> {
    const userId = userIdFrom(req);
    try {
      const call = await this.calls.activate(id, {
        userId,
        participants: 2,
      });
      return { status: call.status };
    } catch (err) {
      throw mapError(err);
    }
  }

  @Post(':id/reconnect')
  @HttpCode(HttpStatus.OK)
  async reconnect(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ status: CallState }> {
    const userId = userIdFrom(req);
    try {
      const call = await this.calls.reconnect(id, { userId });
      return { status: call.status };
    } catch (err) {
      throw mapError(err);
    }
  }

  @Post(':id/reconnected')
  @HttpCode(HttpStatus.OK)
  async reconnected(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ status: CallState }> {
    const userId = userIdFrom(req);
    try {
      const call = await this.calls.reconnected(id, { userId });
      return { status: call.status };
    } catch (err) {
      throw mapError(err);
    }
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  async end(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ status: CallState }> {
    const userId = userIdFrom(req);
    try {
      const call = await this.calls.end(id, {
        userId,
        hostUserId: userId,
      });
      return { status: call.status };
    } catch (err) {
      throw mapError(err);
    }
  }

  @Get(':id/events')
  async listEvents(@Param('id') id: string) {
    try {
      await this.calls.findById(id);
    } catch (err) {
      throw mapNotFound(err);
    }
    return this.calls.listEvents(id);
  }
}

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeCallsController {
  constructor(private readonly calls: CallsService) {}

  @Get('calls/active')
  async active(@Req() req: AuthenticatedRequest) {
    const userId = userIdFrom(req);
    return this.calls.findActiveForUser(userId);
  }
}

function mapNotFound(err: unknown): NotFoundException {
  if (err instanceof CallNotFoundError) {
    return new NotFoundException(err.message);
  }
  throw err;
}

function mapError(err: unknown): Error {
  if (err instanceof CallNotFoundError) {
    return new NotFoundException(err.message);
  }
  if (err instanceof CallForbiddenError) {
    return new ForbiddenException(err.message);
  }
  if (err instanceof InvalidCallTransitionError) {
    return new ConflictException(err.message);
  }
  throw err;
}
