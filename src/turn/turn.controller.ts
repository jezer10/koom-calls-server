import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StaticTurnService } from './turn.service';
import type { TurnCredentials } from './turn.types';

@Controller('turn')
export class TurnController {
  constructor(private readonly turnService: StaticTurnService) {}

  @Get('credentials')
  @UseGuards(JwtAuthGuard)
  getCredentials(@Req() req: Request): TurnCredentials {
    const user = req.user as { userId?: string } | undefined;
    const userId = user?.userId ?? 'anonymous';
    return this.turnService.generateCredentials({
      userId,
      callId: 'default',
    });
  }
}
