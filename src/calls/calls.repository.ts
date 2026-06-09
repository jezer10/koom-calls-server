// PLACEHOLDER: LBR-68 will provide the concrete repository implementation.
// We define the contract here so other modules can depend on the symbol.
export const CALLS_REPOSITORY = Symbol('CALLS_REPOSITORY');

export interface CallsRepository {
  findById(id: string): Promise<null | Record<string, unknown>>;
  save(call: Record<string, unknown>): Promise<Record<string, unknown>>;
}
