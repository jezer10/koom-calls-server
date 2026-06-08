export type CallEventType =
  | 'call:ringing'
  | 'call:accept'
  | 'call:reject'
  | 'call:cancel'
  | 'call:end';

export type WebrtcSignalType =
  | 'webrtc:offer'
  | 'webrtc:answer'
  | 'webrtc:ice-candidate';

export type SfuEventType =
  | 'sfu:join-room'
  | 'sfu:publish-track'
  | 'sfu:subscribe-track';

export interface RoomMember {
  socketId: string;
  userId: string;
  joinedAt: number;
}

export interface SignalingUserData {
  userId: string;
}

export interface CallInviteForUser {
  callId: string;
  from: string;
  type: 'audio' | 'video';
}

export interface CallEventBroadcast {
  callId: string;
  from: string;
  event: CallEventType;
}

export interface PeerJoinedEvent {
  callId: string;
  userId: string;
  socketId: string;
}

export interface PeerLeftEvent {
  callId: string;
  userId: string;
  socketId: string;
}

export interface PeerReconnectingEvent {
  callId: string;
  userId: string;
  socketId: string;
}

export interface SfuEventAck {
  status: 'pending-m3' | 'ok' | 'error';
  detail?: string;
}
