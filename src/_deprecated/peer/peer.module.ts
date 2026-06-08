/**
 * @deprecated This module belongs to the legacy PeerJS-based signaling path.
 * It is kept under `_deprecated/peer/` to preserve history and existing tests
 * for the old peer-server wiring. LiveKit (M3) replaces it; do not import from
 * the application graph.
 */
import { Module } from '@nestjs/common';

@Module({})
export class PeerModule {}
