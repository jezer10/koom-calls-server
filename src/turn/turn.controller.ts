import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './jwt.strategy';
import { CoturnTurnService } from './turn.service';
import type { TurnCredentials } from './turn.types';

@Controller('turn')
export class TurnController {
  constructor(private readonly turnService: CoturnTurnService) {}

  @Get('credentials')
  @UseGuards(JwtAuthGuard)
  getCredentials(@CurrentUser() user: AuthenticatedUser): TurnCredentials {
    return this.turnService.generateCredentials(user.id);
  }
}
