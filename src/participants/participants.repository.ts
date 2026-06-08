// PLACEHOLDER: LBR-68 will provide the concrete participant repository
// implementation. We define the contract here so other modules can depend on
// the symbol.
export const PARTICIPANTS_REPOSITORY = Symbol('PARTICIPANTS_REPOSITORY');

export interface ParticipantsRepository {
  listByCall(callId: string): Promise<Array<Record<string, unknown>>>;
  upsert(
    participant: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  remove(callId: string, userId: string): Promise<void>;
}
