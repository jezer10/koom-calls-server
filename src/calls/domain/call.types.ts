export enum CallType {
  Audio = 'audio',
  Video = 'video',
}

export enum CallMode {
  Sfu = 'sfu',
}

export enum CallStatus {
  Created = 'created',
  Ringing = 'ringing',
  Accepted = 'accepted',
  Connecting = 'connecting',
  Active = 'active',
  Reconnecting = 'reconnecting',
  Ended = 'ended',
  Cancelled = 'cancelled',
  Rejected = 'rejected',
  Missed = 'missed',
  Failed = 'failed',
}

export enum ParticipantRole {
  Host = 'host',
  Participant = 'participant',
  Moderator = 'moderator',
}

export enum ParticipantStatus {
  Invited = 'invited',
  Ringing = 'ringing',
  Accepted = 'accepted',
  Joined = 'joined',
  Left = 'left',
  Rejected = 'rejected',
  Disconnected = 'disconnected',
}
