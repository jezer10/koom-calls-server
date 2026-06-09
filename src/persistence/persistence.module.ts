import { Module } from '@nestjs/common';

// PLACEHOLDER: LBR-68 will fill this with TypeORM/DataSource providers and
// migration wiring. For M1 we only need the module to exist so AppModule can
// import it.
@Module({})
export class PersistenceModule {}
