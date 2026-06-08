export interface CreateCallDto {
  roomId?: string;
  invitees?: string[];
}

export interface InviteCallDto {
  inviteeId: string;
}

export function parseCreateCallDto(body: unknown): CreateCallDto {
  if (body === undefined || body === null) return {};
  if (typeof body !== 'object') {
    throw new Error('Body must be an object');
  }
  const raw = body as Record<string, unknown>;
  const dto: CreateCallDto = {};
  if (raw.roomId !== undefined) {
    if (typeof raw.roomId !== 'string' || raw.roomId.length === 0) {
      throw new Error('roomId must be a non-empty string');
    }
    dto.roomId = raw.roomId;
  }
  if (raw.invitees !== undefined) {
    if (!Array.isArray(raw.invitees)) {
      throw new Error('invitees must be an array of userIds');
    }
    for (const id of raw.invitees) {
      if (typeof id !== 'string' || id.length === 0) {
        throw new Error('invitees must be a list of non-empty strings');
      }
    }
    dto.invitees = raw.invitees as string[];
  }
  return dto;
}

export function parseInviteCallDto(body: unknown): InviteCallDto {
  if (body === undefined || body === null) {
    throw new Error('Body is required');
  }
  if (typeof body !== 'object') {
    throw new Error('Body must be an object');
  }
  const raw = body as Record<string, unknown>;
  if (typeof raw.inviteeId !== 'string' || raw.inviteeId.length === 0) {
    throw new Error('inviteeId is required');
  }
  return { inviteeId: raw.inviteeId };
}
