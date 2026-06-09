export type CallStatus = 'pending' | 'active' | 'ended';

export type ParticipantRole = 'creator' | 'invitee';

export type ParticipantStatus = 'invited' | 'joined' | 'left' | 'declined';

export interface CallParticipant {
  userId: string;
  role: ParticipantRole;
  status: ParticipantStatus;
  invitedAt: string;
  joinedAt?: string;
  leftAt?: string;
}

export interface Call {
  id: string;
  roomId: string;
  status: CallStatus;
  creatorId: string;
  participants: CallParticipant[];
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  endedBy?: string;
}

export interface CreateCallInput {
  creatorId: string;
  roomId?: string;
  invitees?: string[];
}

export type CallEventType =
  | 'created'
  | 'invited'
  | 'accepted'
  | 'joined'
  | 'left'
  | 'ended';

export interface CallEvent {
  id: number;
  callId: string;
  type: CallEventType;
  userId: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}
