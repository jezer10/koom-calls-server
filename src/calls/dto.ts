import type { CallVisibility } from './call.types';

export interface CreateCallDto {
  invitees?: string[];
  visibility?: CallVisibility;
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
  if (raw.visibility !== undefined) {
    if (raw.visibility !== 'private' && raw.visibility !== 'link') {
      throw new Error("visibility must be either 'private' or 'link'");
    }
    dto.visibility = raw.visibility;
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
