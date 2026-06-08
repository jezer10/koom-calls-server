import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CallParticipantEntity } from './domain/participant.entity';
import { ParticipantsRepository } from './participants.repository';

@Module({
  imports: [TypeOrmModule.forFeature([CallParticipantEntity])],
  providers: [ParticipantsRepository],
  exports: [ParticipantsRepository],
})
export class ParticipantsModule {}
